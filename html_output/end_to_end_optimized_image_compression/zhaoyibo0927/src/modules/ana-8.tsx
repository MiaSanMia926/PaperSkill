import React, { useEffect, useRef } from 'react';
import { setupCanvas, observeCanvas, clamp } from '../lib/canvasKit';
import type { WidgetProps } from './registry';

// ---------------------------------------------------------------------------
// Tutorial-wide drawing kit — implemented locally (never imported from another
// widget file), verbatim from the photography-practice kit.
// ---------------------------------------------------------------------------
const C = {
  bg: '#f5f8f0', env: '#b8c9a7', envDark: '#76906a', wood: '#92400e',
  blue: '#27446e', green: '#228d5c', red: '#c43f52', orange: '#f07e47',
  purple: '#7c3aed', ink: '#21324a', muted: '#68778f', line: '#d7deea',
};

function sceneBg(ctx: CanvasRenderingContext2D, W: number, H: number, desk = false) {
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
  const floorY = H * 0.78;
  ctx.fillStyle = C.env; ctx.fillRect(0, floorY, W, H - floorY);
  ctx.strokeStyle = C.envDark; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, floorY); ctx.lineTo(W, floorY); ctx.stroke();
  if (desk) {
    ctx.strokeStyle = C.wood; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(0, H - 8); ctx.lineTo(W, H - 8); ctx.stroke();
  }
}

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color = C.ink, size = 20) {
  ctx.fillStyle = color; ctx.font = `${size}px "Segoe UI", sans-serif`; ctx.textBaseline = 'top'; ctx.fillText(text, x, y);
}

function drawPhoto(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, quality: number, block = false) {
  // quality in [0,1]; block=true renders an 8x8 mosaic (JPEG blocking) at quality
  const bw = w / 8, bh = h / 8;
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
    const gx = x + i * bw, gy = y + j * bh;
    const mid = (x + w / 2), rel = (gx + bw / 2 - x) / w;
    let col: string;
    const cy = (gy + bh / 2 - y) / h;
    if (cy < 0.42) col = '#dfe8f4';                                  // sky
    else if (cy < 0.62) col = C.env;                                 // far hill
    else if (Math.abs(gx + bw / 2 - mid) < w * 0.16 && cy < 0.8) col = '#a9663a'; // house body
    else if (Math.abs(gx + bw / 2 - mid) < w * 0.18 && cy >= 0.55 && cy < 0.62) col = C.wood; // roof
    else col = C.envDark;                                           // grass
    if (rel > 0.62 && rel < 0.7 && cy > 0.15 && cy < 0.24) col = C.orange; // sun
    if (!block) {
      const g = ctx.createRadialGradient(gx, gy, 2, gx + bw / 2, gy + bh / 2, bw);
      g.addColorStop(0, col); g.addColorStop(1, col);
      ctx.fillStyle = col; ctx.fillRect(gx, gy, bw, bh);
    } else {
      // mosaic: flatten each 8x8 cell to its mean + desaturate with quality
      const t = 1 - quality;
      ctx.fillStyle = col;
      ctx.fillRect(gx, gy, bw, bh);
      if (t > 0.35) { ctx.fillStyle = 'rgba(255,255,255,' + (t - 0.35) * 0.35 + ')'; ctx.fillRect(gx, gy, bw, bh); }
      ctx.strokeStyle = 'rgba(33,50,74,' + (0.25 + t * 0.5) + ')';
      ctx.lineWidth = 1; ctx.strokeRect(gx + 0.5, gy + 0.5, bw - 1, bh - 1);
    }
  }
  if (block && quality < 0.5) { // ringing halo along the house/sun edges
    ctx.strokeStyle = C.red; ctx.globalAlpha = 0.55; ctx.lineWidth = 2;
    ctx.strokeRect(x + w * 0.34, y + h * 0.52, w * 0.32, h * 0.3);
    ctx.globalAlpha = 1;
  }
}

function drawLens(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, highlight = false) {
  ctx.save();
  if (highlight) {
    ctx.beginPath(); ctx.arc(cx, cy, r + 8, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(39,68,110,0.16)';
    ctx.fill();
  }
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(215,222,234,0.45)'; ctx.fill();
  ctx.strokeStyle = C.blue; ctx.lineWidth = 3; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.62, 0, Math.PI * 2);
  ctx.strokeStyle = '#d7deea'; ctx.lineWidth = 3; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.3, 0, Math.PI * 2);
  ctx.strokeStyle = C.blue; ctx.lineWidth = 2; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.84, Math.PI * 1.08, Math.PI * 1.42);
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------------------

const W = 560;
const H = 140;
const PERIOD = 6;

interface Pt { x: number; y: number }

const LENSES: { cx: number; cy: number; r: number }[] = [
  { cx: 120, cy: 70, r: 40 },
  { cx: 240, cy: 70, r: 34 },
  { cx: 350, cy: 70, r: 28 },
];
const FILM = { x: 460, y: 52, w: 34, h: 36 };
// the ray kinks at every lens centre and converges on the film plane
const RAY: Pt[] = [
  { x: 16, y: 100 },
  { x: 120, y: 62 },
  { x: 240, y: 78 },
  { x: 350, y: 66 },
  { x: 478, y: 70 },
];

export const Ana8: React.FC<WidgetProps> = ({ chapterId, moduleId }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const stateRef = useRef({ ph: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let ctx: CanvasRenderingContext2D;
    try {
      ctx = setupCanvas(canvas, W, H);
    } catch {
      return;
    }

    const segLen = (a: Pt, b: Pt) => Math.sqrt((b.x - a.x) * (b.x - a.x) + (b.y - a.y) * (b.y - a.y));

    const render = () => {
      // one continuous action: the light ray travels through the lens stack
      const ph = ((performance.now() / 1000) % PERIOD) / PERIOD;
      stateRef.current.ph = ph;
      const travel = clamp(ph / 0.82, 0, 1);
      const rayAlpha = ph < 0.86 ? 1 : clamp((1 - ph) / 0.14, 0, 1);

      sceneBg(ctx, W, H);

      for (const l of LENSES) drawLens(ctx, l.cx, l.cy, l.r, false);
      ctx.fillStyle = C.ink;
      ctx.fillRect(FILM.x, FILM.y, FILM.w, FILM.h);
      ctx.strokeStyle = C.wood; ctx.lineWidth = 2;
      ctx.strokeRect(FILM.x, FILM.y, FILM.w, FILM.h);

      // walk the polyline up to `travel`
      const segs: number[] = [];
      let total = 0;
      for (let i = 0; i < RAY.length - 1; i++) {
        const d = segLen(RAY[i], RAY[i + 1]);
        segs.push(d);
        total += d;
      }
      let want = travel * total;
      const pts: Pt[] = [{ x: RAY[0].x, y: RAY[0].y }];
      for (let i = 0; i < segs.length; i++) {
        if (want >= segs[i]) {
          pts.push({ x: RAY[i + 1].x, y: RAY[i + 1].y });
          want -= segs[i];
        } else {
          const t = want / segs[i];
          pts.push({
            x: RAY[i].x + (RAY[i + 1].x - RAY[i].x) * t,
            y: RAY[i].y + (RAY[i + 1].y - RAY[i].y) * t,
          });
          break;
        }
      }

      ctx.save();
      ctx.globalAlpha = ctx.globalAlpha * rayAlpha;
      ctx.strokeStyle = C.orange; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
      const head = pts[pts.length - 1];
      ctx.fillStyle = C.orange;
      ctx.beginPath(); ctx.arc(head.x, head.y, 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    };

    const tick = () => {
      render();
      if (!canvas.classList.contains('is-ready')) canvas.classList.add('is-ready');
      rafRef.current = requestAnimationFrame(tick);
    };
    const stop = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
    const start = () => {
      if (!rafRef.current) rafRef.current = requestAnimationFrame(tick);
    };
    const disconnect = observeCanvas(canvas, start, stop);
    return () => {
      stop();
      disconnect();
    };
  }, []);

  return (
    <div>
      <canvas id={`cv-${chapterId}-${moduleId}`} ref={canvasRef} width={W} height={H} />
    </div>
  );
};

export default Ana8;
