import React, { useEffect, useRef, useState } from 'react';
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

const W = 1080;
const H = 280;
const FADE_MS = 200;

type Mode = 'round' | 'noise';

const MODES: { id: Mode; label: string }[] = [
  { id: 'round', label: '直接取整 round()' },
  { id: 'noise', label: '加均匀噪声（松弛）' },
];

const FEEDBACK: Record<Mode, { text: string; cls: string }> = {
  round: { text: '台阶处处平坦，梯度为 0——参数不知道往哪个方向走，训练卡死。', cls: 'bad' },
  noise: { text: '均匀噪声把台阶抹成缓坡，梯度处处存在——这就是可微的松弛，且 p_ỹ(n) = P_q(n) 在整数点上严格成立。', cls: 'good' },
};

/* loss landscape, left region (20..540) */
const AXIS_X = 62;
const AXIS_Y = 196;
const PX0 = 80;
const PX1 = 520;
const N_STEPS = 6;
const L_HI = 80;   // screen y of the highest loss (left end)
const L_LO = 182;  // screen y of the lowest loss (right end)
const STEP_W = (PX1 - PX0) / N_STEPS;

function stepLevel(i: number): number {
  return L_HI + (L_LO - L_HI) * (i / (N_STEPS - 1));
}

function smoothY(t: number): number {
  return L_LO - (L_LO - L_HI) * (1 - t) * (1 - t);
}

function drawAxes(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = C.line; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(AXIS_X, 58); ctx.lineTo(AXIS_X, AXIS_Y); ctx.lineTo(PX1 + 16, AXIS_Y);
  ctx.stroke();
}

/* round() : the loss is a staircase - flat everywhere, so the gradient is zero */
function drawStaircase(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(PX0, stepLevel(0));
  for (let i = 0; i < N_STEPS; i++) {
    ctx.lineTo(PX0 + i * STEP_W, stepLevel(i));
    ctx.lineTo(PX0 + (i + 1) * STEP_W, stepLevel(i));
    if (i < N_STEPS - 1) ctx.lineTo(PX0 + (i + 1) * STEP_W, stepLevel(i + 1));
  }
  ctx.lineTo(PX1, AXIS_Y);
  ctx.lineTo(PX0, AXIS_Y);
  ctx.closePath();
  ctx.fillStyle = 'rgba(196,63,82,0.13)';
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(PX0, stepLevel(0));
  for (let i = 0; i < N_STEPS; i++) {
    ctx.lineTo(PX0 + i * STEP_W, stepLevel(i));
    ctx.lineTo(PX0 + (i + 1) * STEP_W, stepLevel(i));
    if (i < N_STEPS - 1) ctx.lineTo(PX0 + (i + 1) * STEP_W, stepLevel(i + 1));
  }
  ctx.strokeStyle = C.red; ctx.lineWidth = 3; ctx.lineJoin = 'round';
  ctx.stroke();

  // three short arrows along flat step tops: no direction to descend
  ctx.strokeStyle = C.red; ctx.lineWidth = 2;
  for (const k of [1, 3, 5]) {
    const y = stepLevel(k) - 12;
    const ax = PX0 + k * STEP_W + 12;
    const bx = ax + 32;
    ctx.beginPath(); ctx.moveTo(ax, y); ctx.lineTo(bx, y); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(bx, y); ctx.lineTo(bx - 7, y - 5);
    ctx.moveTo(bx, y); ctx.lineTo(bx - 7, y + 5);
    ctx.stroke();
  }
  // bare value beside one arrow
  ctx.fillStyle = C.muted;
  ctx.font = '15px "Segoe UI", sans-serif';
  ctx.textBaseline = 'top';
  ctx.fillText('0', PX0 + 3 * STEP_W + 52, stepLevel(3) - 27);
  ctx.restore();
}

/* uniform noise : the loss is a smooth slope - a usable gradient everywhere */
function drawSmooth(ctx: CanvasRenderingContext2D) {
  ctx.save();
  const N = 40;
  ctx.beginPath();
  ctx.moveTo(PX0, smoothY(0));
  for (let i = 1; i <= N; i++) {
    const t = i / N;
    ctx.lineTo(PX0 + (PX1 - PX0) * t, smoothY(t));
  }
  ctx.lineTo(PX1, AXIS_Y);
  ctx.lineTo(PX0, AXIS_Y);
  ctx.closePath();
  ctx.fillStyle = 'rgba(34,141,92,0.13)';
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(PX0, smoothY(0));
  for (let i = 1; i <= N; i++) {
    const t = i / N;
    ctx.lineTo(PX0 + (PX1 - PX0) * t, smoothY(t));
  }
  ctx.strokeStyle = C.green; ctx.lineWidth = 3; ctx.lineJoin = 'round';
  ctx.stroke();

  // one blue downhill arrow, drawn along the tangent
  const t0 = 0.35;
  const px = PX0 + (PX1 - PX0) * t0;
  const py = smoothY(t0);
  const dx = PX1 - PX0;
  const dy = 2 * (L_LO - L_HI) * (1 - t0);
  const len = Math.sqrt(dx * dx + dy * dy);
  const ux = dx / len;
  const uy = dy / len;
  const half = 32;
  ctx.strokeStyle = C.blue; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(px - ux * half, py - uy * half);
  ctx.lineTo(px + ux * half, py + uy * half);
  ctx.stroke();
  const hx = px + ux * half;
  const hy = py + uy * half;
  const nx = -uy;
  const ny = ux;
  ctx.beginPath();
  ctx.moveTo(hx, hy); ctx.lineTo(hx - ux * 10 + nx * 6, hy - uy * 10 + ny * 6);
  ctx.moveTo(hx, hy); ctx.lineTo(hx - ux * 10 - nx * 6, hy - uy * 10 - ny * 6);
  ctx.stroke();
  ctx.fillStyle = C.blue;
  ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawLandscape(ctx: CanvasRenderingContext2D, mode: Mode) {
  if (mode === 'round') drawStaircase(ctx);
  else drawSmooth(ctx);
}

/* right region: the developer tank (560..1060) */
const TANK = { x: 730, y: 38, w: 160, h: 180 };
const TANK_FRAC = 0.55;

function drawTankScene(ctx: CanvasRenderingContext2D, mode: Mode) {
  if (mode === 'round') {
    // quantized: separated layers, a sharp red boundary, nothing moves
    fillTank(ctx, TANK.x, TANK.y, TANK.w, TANK.h, TANK_FRAC, C.envDark);
    tankBoundary(ctx, TANK.x, TANK.y, TANK.w, TANK.h, TANK_FRAC, C.red, 1);
  } else {
    // relaxed: one uniform liquid, the surface sways by 3 px
    const osc = Math.sin((performance.now() / 1000) * 2.4) * 3;
    const frac = TANK_FRAC + osc / (TANK.h - 6);
    fillTank(ctx, TANK.x, TANK.y, TANK.w, TANK.h, frac, C.green);
  }
}

// ---------------------------------------------------------------------------

export const Ch7Mod1: React.FC<WidgetProps> = ({ chapterId, moduleId }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const stateRef = useRef({ mode: 'round' as Mode, prev: 'round' as Mode, t0: -1e9 });
  const [mode, setMode] = useState<Mode>('round');
  const [feedback, setFeedback] = useState({ text: FEEDBACK.round.text, cls: FEEDBACK.round.cls });

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
      sceneBg(ctx, W, H);
      drawAxes(ctx);
      label(ctx, '损失 L', 20, 34, C.muted, 16);
      label(ctx, '参数 y', 236, 200, C.muted, 16);

      const k = clamp((performance.now() - s.t0) / FADE_MS, 0, 1);
      ctx.save();
      ctx.globalAlpha = 1 - k;
      drawLandscape(ctx, s.prev);
      drawTankScene(ctx, s.prev);
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = k;
      drawLandscape(ctx, s.mode);
      drawTankScene(ctx, s.mode);
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

  const pick = (next: Mode) => {
    const s = stateRef.current;
    if (s.mode === next) return;
    s.prev = s.mode;
    s.mode = next;
    s.t0 = performance.now();
    setMode(next);
    setFeedback(FEEDBACK[next]);
  };

  return (
    <div>
      <canvas id={`cv-${chapterId}-${moduleId}`} ref={canvasRef} width={W} height={H} />
      <div className="chip-row">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            className={`chip${mode === m.id ? ' selected' : ''}`}
            onClick={() => pick(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>
      <div className={`feedback ${feedback.cls}`}>{feedback.text}</div>
    </div>
  );
};

export default Ch7Mod1;
