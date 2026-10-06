import React, { useEffect, useRef, useState } from 'react';
import { setupCanvas, observeCanvas, clamp } from '../lib/canvasKit';
import type { WidgetProps } from './registry';

// §1 模块 1.1 —— 压缩强度滑杆（P1）
// 左边是照片，右边是两个账本（相对值）：码率（蓝）随 1−q 缩短，失真（红）随 q 增长。

const W = 1080;
const H = 280;

// 照片区域
const PX = 60, PY = 28, PW = 360, PH = 190;
// 两个账本
const LABEL_X = 660, BAR_X = 720, BAR_W = 260, BAR_H = 26;
const NUM_X = 992;
const RATE_Y = 90, DIST_Y = 170;

// ---------- 绘图工具箱（每个组件本地实现，绝不跨文件 import） ----------
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
function drawBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, frac: number, color: string) {
  ctx.fillStyle = C.line; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color; ctx.fillRect(x, y, w * clamp(frac, 0, 1), h);
}

function feedbackFor(q: number): { text: string; cls: string } {
  if (q < 0.25) return { text: '码率充足，细节完整——但文件也大。', cls: 'good' };
  if (q < 0.6) return { text: '码率与失真在拉扯，注意边缘已经开始出现色块。', cls: '' };
  return { text: '码率太低，8×8 色块与振铃清晰可见——这就是 JPEG 低码率的代价。', cls: 'bad' };
}

export const Ch1Mod1: React.FC<WidgetProps> = ({ chapterId, moduleId }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({ q: 0.15 });
  const rafRef = useRef<number | null>(null);
  const [q, setQ] = useState(0.15);
  const [feedback, setFeedback] = useState(feedbackFor(0.15));

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
      const qq = clamp(s.q, 0, 1);

      sceneBg(ctx, W, H);

      // 照片：压缩强度越高，色块越明显
      drawPhoto(ctx, PX, PY, PW, PH, 1 - qq, qq > 0.25);
      if (qq >= 0.6) {
        ctx.save();
        ctx.globalAlpha = clamp((qq - 0.6) / 0.4, 0, 1) * 0.7;
        ctx.strokeStyle = C.red; ctx.lineWidth = 3;
        ctx.strokeRect(PX + PW * 0.34, PY + PH * 0.52, PW * 0.32, PH * 0.3);
        ctx.restore();
      }

      // 账本一：码率（相对值，随 q 减小）
      label(ctx, '码率', LABEL_X, RATE_Y - 2, C.blue, 20);
      drawBar(ctx, BAR_X, RATE_Y, BAR_W, BAR_H, 1 - qq, C.blue);
      label(ctx, (1 - qq).toFixed(2), NUM_X, RATE_Y + 2, C.ink, 18);

      // 账本二：失真（相对值，随 q 增大）
      label(ctx, '失真', LABEL_X, DIST_Y - 2, C.red, 20);
      drawBar(ctx, BAR_X, DIST_Y, BAR_W, BAR_H, qq, C.red);
      label(ctx, qq.toFixed(2), NUM_X, DIST_Y + 2, C.ink, 18);
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

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value) / 100;
    stateRef.current.q = v;
    setQ(v);
    setFeedback(feedbackFor(v));
  };

  return (
    <div>
      <canvas id={`cv-${chapterId}-${moduleId}`} ref={canvasRef} width={W} height={H} />
      <div className="ctrl">
        <label>
          压缩强度 <span className="val">{q.toFixed(2)}</span>
        </label>
        <input type="range" min={0} max={100} value={Math.round(q * 100)} onChange={onChange} />
      </div>
      <div className={`feedback ${feedback.cls}`}>{feedback.text}</div>
    </div>
  );
};

export default Ch1Mod1;
