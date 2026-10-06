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
function grainDots(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, n: number) {
  let seed = 48271;
  const rnd = () => {
    seed = (seed * 48271) % 2147483647;
    return seed / 2147483647;
  };
  ctx.fillStyle = C.envDark;
  for (let i = 0; i < n; i++) {
    const gx = x + rnd() * w;
    const gy = y + rnd() * h;
    ctx.beginPath();
    ctx.arc(gx, gy, 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
}
function drawBits(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = C.line;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  const rows = 4, rowH = h / rows, stepX = 8;
  const cols = Math.floor((w - 12) / stepX);
  const a0 = ctx.globalAlpha;
  for (let r = 0; r < rows; r++) {
    for (let i = 0; i < cols; i++) {
      const bx = x + 6 + i * stepX + stepX / 2;
      const by = y + rowH * r + rowH / 2;
      const one = (i + r) % 2 === 0;
      if (one) {
        ctx.fillStyle = C.ink;
        ctx.beginPath();
        ctx.arc(bx, by, 1.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.strokeStyle = C.ink;
        ctx.globalAlpha = a0 * 0.45;
        ctx.beginPath();
        ctx.arc(bx, by, 1.2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = a0;
      }
    }
  }
}

const W = 1080;
const H = 280;
const STEPS = [
  { desc: '原图 x', fb: { text: '原图 x：768×768 像素进入系统。', cls: '' } },
  { desc: '分析变换 gₐ', fb: { text: '分析变换 gₐ 把图像映射到码空间 y——维度缩小到一半。', cls: '' } },
  { desc: '量化 ŷ', fb: { text: '量化把连续值取整成整数 ŷ——这是整条管线里唯一的信息损失。', cls: '' } },
  { desc: '熵编码', fb: { text: '熵编码按概率给每个整数分配码长，得到比特流——实际文件在这一步成形。', cls: '' } },
  { desc: '熵解码', fb: { text: '解码端无损还原整数 ŷ。', cls: '' } },
  { desc: '合成变换 g_s', fb: { text: '合成变换 g_s 重建出 x̂——与 x 几乎一致，编码与解码各只跑一次前向。', cls: 'good' } },
];
const RUNG_TEXT = ['768', '384', '384', '比特', '768'];
const RUNG_Y = [52, 98, 144, 190, 236];
const RUNG_OF_STEP = [0, 1, 2, 3, 2, 4];   // dimension ladder rung per step
const FADE_MS = 200;

function drawStage(ctx: CanvasRenderingContext2D, step: number, alpha: number) {
  ctx.save();
  ctx.globalAlpha = alpha;
  if (step === 1 || step === 6) {
    // full-colour photo: input on the way in, reconstruction on the way out
    drawPhoto(ctx, 160, 30, 480, 220, 1, false);
  } else if (step === 4) {
    // the bit stream that replaces the photo
    drawBits(ctx, 260, 128, 280, 24);
  } else {
    // compacted code space: half-size photo, blue frame, dark negative tint
    const x = 280, y = 85, w = 240, h = 110;
    drawPhoto(ctx, x, y, w, h, 1, false);
    ctx.fillStyle = 'rgba(118,144,106,0.3)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = C.blue;
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
    if (step === 3 || step === 5) grainDots(ctx, x, y, w, h, 60);
  }
  ctx.restore();
}

function drawLadder(ctx: CanvasRenderingContext2D, active: number) {
  label(ctx, '维度', 800, 14, C.ink, 18);
  for (let i = 0; i < RUNG_TEXT.length; i++) {
    const ry = RUNG_Y[i];
    const on = i === active;
    label(ctx, RUNG_TEXT[i], 800, ry - 11, on ? C.blue : C.ink, 18);
    ctx.strokeStyle = on ? C.blue : C.line;
    ctx.lineWidth = on ? 3 : 2;
    ctx.beginPath();
    ctx.moveTo(880, ry);
    ctx.lineTo(1040, ry);
    ctx.stroke();
    if (on) {
      ctx.fillStyle = C.blue;
      ctx.beginPath();
      ctx.arc(960, ry, 7, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// Module 6.1 — six steps from shutter to photo: transform, quantize, entropy
// code, transmit, entropy decode, synthesize.
export const Ch6Mod1: React.FC<WidgetProps> = ({ chapterId, moduleId }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({ step: 1, prev: 1, t0: 0 });
  const rafRef = useRef<number | null>(null);
  const [step, setStep] = useState(1);
  const [feedback, setFeedback] = useState(STEPS[0].fb);

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
      const p = clamp((performance.now() - s.t0) / FADE_MS, 0, 1);
      sceneBg(ctx, W, H);
      if (p < 1 && s.prev !== s.step) drawStage(ctx, s.prev, 1 - p);
      drawStage(ctx, s.step, p < 1 ? p : 1);
      drawLadder(ctx, RUNG_OF_STEP[s.step - 1]);
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

  const goto = (ns: number) => {
    const s = stateRef.current;
    if (ns < 1 || ns > STEPS.length || ns === s.step) return;
    s.prev = s.step;
    s.step = ns;
    s.t0 = performance.now();
    setStep(ns);
    setFeedback(STEPS[ns - 1].fb);
  };

  return (
    <div>
      <canvas id={`cv-${chapterId}-${moduleId}`} ref={canvasRef} width={W} height={H} />
      <div className="step-ctrl">
        <button type="button" className="tiny ghost" onClick={() => goto(stateRef.current.step - 1)} disabled={step <= 1}>
          上一步
        </button>
        <div className="step-label">
          第 <b>{step}</b> / {STEPS.length} 步
        </div>
        <button
          type="button"
          className="tiny"
          onClick={() => goto(stateRef.current.step + 1)}
          disabled={step >= STEPS.length}
        >
          下一步
        </button>
      </div>
      <div className="step-desc">{STEPS[step - 1].desc}</div>
      <div className={`feedback ${feedback.cls}`}>{feedback.text}</div>
    </div>
  );
};

export default Ch6Mod1;
