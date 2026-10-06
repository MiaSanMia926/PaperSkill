import React, { useEffect, useRef, useState } from 'react';
import { setupCanvas, observeCanvas, clamp } from '../lib/canvasKit';
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
function drawCard(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, freeFrac: number) {
  roundRect(ctx, x, y, w, h, 8); ctx.fillStyle = C.blue; ctx.fill();
  roundRect(ctx, x + 10, y + 10, w - 20, 14, 4); ctx.fillStyle = C.line; ctx.fill();
  const bx = x + 10, by = y + h - 22, bw = w - 20, bh = 12;
  roundRect(ctx, bx, by, bw, bh, 6); ctx.fillStyle = C.env; ctx.fill();
  roundRect(ctx, bx, by, bw * clamp(1 - freeFrac, 0, 1), bh, 6); ctx.fillStyle = C.orange; ctx.fill();
}
function drawBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, frac: number, color: string) {
  ctx.fillStyle = C.line; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color; ctx.fillRect(x, y, w * clamp(frac, 0, 1), h);
}

const W = 1080;
const H = 280;
const CHIPS = ['低码率档（λ 小）', '中码率档', '高码率档（λ 大）'];
const QUALITY = [0.35, 0.7, 1.0];   // photo quality per tier
const USED = [0.25, 0.55, 0.9];     // card capacity used per tier
const BAR = [0.25, 0.55, 0.9];      // relative bar lengths (码率 / 画质) per tier
const FB = [
  { text: '低码率档：文件最小，细节最少——适合预览与快速传输。', cls: '' },
  { text: '中码率档：码率与画质折中。', cls: '' },
  { text: '高码率档：细节最丰富，码率最高——适合长期存档。', cls: 'good' },
];
const ANIM_MS = 200;                // bar animation duration

// Module 5.1 — one λ is one operating point: pick a quality tier and watch the
// photo, the memory card and the two relative bars move together.
export const Ch5Mod1: React.FC<WidgetProps> = ({ chapterId, moduleId }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({
    tier: 1,
    from: [BAR[1], BAR[1]],
    target: [BAR[1], BAR[1]],
    disp: [BAR[1], BAR[1]],
    t0: 0,
  });
  const rafRef = useRef<number | null>(null);
  const [tier, setTier] = useState(1);
  const [feedback, setFeedback] = useState(FB[1]);

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
      const p = clamp((performance.now() - s.t0) / ANIM_MS, 0, 1);
      s.disp = [
        s.from[0] + (s.target[0] - s.from[0]) * p,
        s.from[1] + (s.target[1] - s.from[1]) * p,
      ];

      sceneBg(ctx, W, H);

      // Left: the same photo at the tier's quality, slotting toward the card.
      const px = 70 + s.tier * 8;
      drawPhoto(ctx, px, 96, 200, 120, QUALITY[s.tier], true);
      drawCard(ctx, 350, 138, 130, 80, 1 - USED[s.tier]);

      // Right: two relative bars (码率 / 画质) with bare relative numbers.
      const barX = 680, barW = 320, barH = 26;
      label(ctx, '码率', 600, 81, C.ink, 20);
      label(ctx, '画质', 600, 161, C.ink, 20);
      drawBar(ctx, barX, 78, barW, barH, s.disp[0], C.blue);
      drawBar(ctx, barX, 158, barW, barH, s.disp[1], C.green);
      label(ctx, s.disp[0].toFixed(2), barX + barW * s.disp[0] + 12, 82, C.ink, 18);
      label(ctx, s.disp[1].toFixed(2), barX + barW * s.disp[1] + 12, 162, C.ink, 18);
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

  const pick = (t: number) => {
    const s = stateRef.current;
    if (s.tier === t) return;
    s.from = [s.disp[0], s.disp[1]];
    s.target = [BAR[t], BAR[t]];
    s.t0 = performance.now();
    s.tier = t;
    setTier(t);
    setFeedback(FB[t]);
  };

  return (
    <div>
      <canvas id={`cv-${chapterId}-${moduleId}`} ref={canvasRef} width={W} height={H} />
      <div className="chip-row">
        {CHIPS.map((c, i) => (
          <button
            key={c}
            type="button"
            className={`chip${tier === i ? ' selected' : ''}`}
            onClick={() => pick(i)}
          >
            {c}
          </button>
        ))}
      </div>
      <div className={`feedback ${feedback.cls}`}>{feedback.text}</div>
    </div>
  );
};

export default Ch5Mod1;
