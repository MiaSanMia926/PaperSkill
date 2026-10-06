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

function tankPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const r = 12;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function fillTank(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, frac: number, color: string) {
  const f = clamp(frac, 0, 1);
  const ix = x + 3, iy = y + 3, iw = w - 6, ih = h - 6;
  tankPath(ctx, ix, iy, iw, ih);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.save();
  tankPath(ctx, ix, iy, iw, ih);
  ctx.clip();
  const lh = ih * f;
  ctx.save();
  ctx.globalAlpha = ctx.globalAlpha * 0.85;
  ctx.fillStyle = color;
  ctx.fillRect(ix, iy + ih - lh, iw, lh);
  ctx.restore();
  ctx.strokeStyle = color; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(ix, iy + ih - lh); ctx.lineTo(ix + iw, iy + ih - lh); ctx.stroke();
  ctx.restore();
  tankPath(ctx, x, y, w, h);
  ctx.strokeStyle = C.ink; ctx.lineWidth = 3; ctx.stroke();
}

/** A sharp layer boundary across the middle of the liquid (layered = quantized). */
function tankBoundary(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, frac: number, color: string, alpha: number) {
  if (alpha <= 0.001) return;
  const base = ctx.globalAlpha;
  const f = clamp(frac, 0, 1);
  const ix = x + 3, iy = y + 3, iw = w - 6, ih = h - 6;
  const lh = ih * f;
  const by = iy + ih - lh * 0.5;
  ctx.save();
  tankPath(ctx, ix, iy, iw, ih);
  ctx.clip();
  ctx.globalAlpha = base * alpha * 0.45;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(ix, iy + ih - lh, iw, lh * 0.5);
  ctx.globalAlpha = base * alpha;
  ctx.strokeStyle = color; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(ix, by); ctx.lineTo(ix + iw, by); ctx.stroke();
  ctx.restore();
  ctx.globalAlpha = base;
}

// ---------------------------------------------------------------------------

const W = 560;
const H = 140;
const PERIOD = 5;

export const Ana7: React.FC<WidgetProps> = ({ chapterId, moduleId }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const stateRef = useRef({ tilt: 0, layered: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let ctx: CanvasRenderingContext2D;
    try {
      ctx = setupCanvas(canvas, W, H);
    } catch {
      return;
    }

    const render = () => {
      // one continuous action: the tank rocks, the developer inside it sloshes
      const ph = ((performance.now() / 1000) % PERIOD) / PERIOD;
      const angle = (Math.sin(ph * Math.PI * 2) * 12 * Math.PI) / 180;
      const speed = Math.abs(Math.cos(ph * Math.PI * 2));
      const layered = clamp((0.45 - speed) / 0.45, 0, 1);
      stateRef.current.tilt = angle;
      stateRef.current.layered = layered;

      sceneBg(ctx, W, H);

      const tw = 90, th = 110;
      const surface = 0.55 + 0.03 * Math.sin(ph * Math.PI * 6);

      ctx.save();
      ctx.translate(280, 120);
      ctx.rotate(angle);
      const bx = -tw / 2, by = -th;
      fillTank(ctx, bx, by, tw, th, surface, C.green);
      // uniform (agitated) developer: one smooth green surface, moving gently
      if (layered < 0.999) {
        const ix = bx + 3, iy = by + 3, iw = tw - 6, ih = th - 6;
        const ly = iy + ih * (1 - surface);
        ctx.save();
        ctx.globalAlpha = ctx.globalAlpha * (1 - layered) * 0.9;
        ctx.strokeStyle = C.green; ctx.lineWidth = 3;
        ctx.beginPath();
        for (let i = 0; i <= 12; i++) {
          const px = ix + (iw * i) / 12;
          const py = ly + Math.sin((i / 12) * Math.PI * 2 + ph * Math.PI * 2) * 1.6;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.restore();
      }
      // the tank is momentarily still at the tilt extremes: layers separate again
      tankBoundary(ctx, bx, by, tw, th, surface, C.red, layered);
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

export default Ana7;
