import React, { useEffect, useRef, useState } from 'react';
import { setupCanvas, observeCanvas, clamp, easeInOutQuad } from '../lib/canvasKit';
import type { WidgetProps } from './registry';

// ---------------------------------------------------------------------------
// Tutorial-wide drawing kit (implemented locally — never imported from another
// widget file). Verbatim copy of the shared kit section in SKILL.md.
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
  if (desk) { ctx.strokeStyle = C.wood; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(0, H - 8); ctx.lineTo(W, H - 8); ctx.stroke(); }
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

// --- local primitives used by this widget ---
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
function drawFilm(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  roundRect(ctx, x, y, w, h, 6); ctx.fillStyle = C.ink; ctx.fill();
  ctx.fillStyle = C.line;
  const hw = 12, hh = 6, gap = 10;
  for (let hx = x + 16; hx + hw <= x + w - 10; hx += hw + gap) {
    roundRect(ctx, hx, y + 5, hw, hh, 2); ctx.fill();
    roundRect(ctx, hx, y + h - 5 - hh, hw, hh, 2); ctx.fill();
  }
}

const W = 560;
const H = 140;
const PERIOD = 6;                       // seconds per loop
const STRIP_X = 130, STRIP_Y = 48, STRIP_W = 300, STRIP_H = 60;
const FRAME_W = 72, FRAME_H = 28, FRAME_GAP = 12, FRAME_PAD = 30;
const FRAME_Y = STRIP_Y + 16;
const DEV_START = [0.12, 0.36, 0.60];   // develop start (front to back)
const DEV_DUR = 0.20;
const FADE_START = 0.86;

// Analogy animation: a film strip lies on the desk; its three frames develop
// into the photo scene front-to-back, then the whole strip fades back.
export const Ana6: React.FC<WidgetProps> = ({ chapterId, moduleId }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({ dev: 0 });
  const rafRef = useRef<number | null>(null);
  const [developed, setDeveloped] = useState(0);

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
      const s = stateRef.current;
      const ph = (performance.now() / 1000) % PERIOD / PERIOD;
      const dev = ph < DEV_START[0] ? 0 : ph < DEV_START[1] ? 1 : ph < DEV_START[2] ? 2 : 3;
      if (dev !== s.dev) {
        s.dev = dev;
        setDeveloped(dev);
      }
      const fadeOut = ph < FADE_START ? 1 : clamp(1 - (ph - FADE_START) / (1 - FADE_START), 0, 1);

      sceneBg(ctx, W, H);
      drawFilm(ctx, STRIP_X, STRIP_Y, STRIP_W, STRIP_H);

      for (let i = 0; i < 3; i++) {
        const fx = STRIP_X + FRAME_PAD + i * (FRAME_W + FRAME_GAP);
        // unexposed film: near-white frame
        ctx.fillStyle = '#eef1ea';
        ctx.fillRect(fx, FRAME_Y, FRAME_W, FRAME_H);
        ctx.strokeStyle = C.muted; ctx.lineWidth = 1;
        ctx.strokeRect(fx + 0.5, FRAME_Y + 0.5, FRAME_W - 1, FRAME_H - 1);

        const p = clamp((ph - DEV_START[i]) / DEV_DUR, 0, 1);
        const wipe = easeInOutQuad(p) * FRAME_W;
        const alpha = easeInOutQuad(p) * fadeOut;
        if (alpha > 0 && wipe > 0) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(fx, FRAME_Y, wipe, FRAME_H);
          ctx.clip();
          ctx.globalAlpha = alpha;
          drawPhoto(ctx, fx, FRAME_Y, FRAME_W, FRAME_H, 1, false);
          ctx.restore();
        }
      }
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

  return <canvas id={`cv-${chapterId}-${moduleId}`} ref={canvasRef} width={W} height={H} />;
};

export default Ana6;
