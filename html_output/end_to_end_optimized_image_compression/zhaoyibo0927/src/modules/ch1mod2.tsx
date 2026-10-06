import React, { useEffect, useRef, useState } from 'react';
import { setupCanvas, observeCanvas, clamp } from '../lib/canvasKit';
import type { WidgetProps } from './registry';

// §1 模块 1.2 —— 同一张照片：JPEG 与 JPEG 2000 的伪影对比（P3 同步对比）
// 两侧共享同一个进度 p 与同一个相位：左边 JPEG 长出色块与红色振铃，右边 JPEG 2000 长出振铃波纹。

const W = 1080;
const H = 280;
const DURATION = 2400;

const P1 = { x: 20, y: 16, w: 510, h: 232 };   // JPEG（老方法 → 红）
const P2 = { x: 550, y: 16, w: 510, h: 232 };  // JPEG 2000（老方法 → 紫）
const INSET_X = 34, INSET_Y = 30;

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
function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export const Ch1Mod2: React.FC<WidgetProps> = ({ chapterId, moduleId }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({ t0: 0, started: false });
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const [done, setDone] = useState(false);
  const [feedback, setFeedback] = useState({
    text: '按下开始，让两种老方法在相同码率下同台对比。',
    cls: '',
  });

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
      const now = performance.now();
      const s = stateRef.current;
      // 两个面板共享同一个进度 p 与同一个相位
      const p = s.started ? clamp((now - s.t0) / DURATION, 0, 1) : 0;
      const phase = ((now / 1000) % 3) / 3;

      sceneBg(ctx, W, H);

      // 左：JPEG —— 8×8 方块随 p 加重，红色振铃随之浮现
      ctx.strokeStyle = C.red; ctx.lineWidth = 3;
      ctx.strokeRect(P1.x + 1.5, P1.y + 1.5, P1.w - 3, P1.h - 3);
      const lx = P1.x + INSET_X, ly = P1.y + INSET_Y;
      const lw = P1.w - INSET_X * 2, lh = P1.h - INSET_Y * 2;
      drawPhoto(ctx, lx, ly, lw, lh, 1 - p * 0.9, true);
      if (p > 0.05) {
        ctx.save();
        ctx.globalAlpha = p * 0.7 * (0.75 + 0.25 * Math.sin(phase * Math.PI * 2));
        ctx.strokeStyle = C.red; ctx.lineWidth = 3;
        ctx.strokeRect(lx + lw * 0.34, ly + lh * 0.52, lw * 0.32, lh * 0.3);
        ctx.restore();
      }

      // 右：JPEG 2000 —— 不加方块，只长出三圈振铃波纹
      ctx.strokeStyle = C.purple; ctx.lineWidth = 3;
      ctx.strokeRect(P2.x + 1.5, P2.y + 1.5, P2.w - 3, P2.h - 3);
      const rx = P2.x + INSET_X, ry = P2.y + INSET_Y;
      const rw = P2.w - INSET_X * 2, rh = P2.h - INSET_Y * 2;
      drawPhoto(ctx, rx, ry, rw, rh, 1, false);
      if (p > 0.02) {
        ctx.save();
        ctx.globalAlpha = p * 0.7;
        ctx.strokeStyle = C.purple; ctx.lineWidth = 2;
        for (let k = 0; k < 3; k++) {
          const off = k * 9 + Math.sin(phase * Math.PI * 2 + k * 0.6) * 3;
          roundRectPath(
            ctx,
            rx + rw * 0.34 - off,
            ry + rh * 0.52 - off,
            rw * 0.32 + off * 2,
            rh * 0.3 + off * 2,
            8
          );
          ctx.stroke();
        }
        ctx.restore();
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
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  const onCompare = () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    stateRef.current.t0 = performance.now();
    stateRef.current.started = true;
    setDone(false);
    setFeedback({
      text: '两种方法各有各的伪影：JPEG 出方块，JPEG 2000 出振铃。它们都需要手工设计变换，无法针对图像统计自动优化。',
      cls: 'bad',
    });
    timerRef.current = window.setTimeout(() => setDone(true), DURATION);
  };

  return (
    <div>
      <canvas id={`cv-${chapterId}-${moduleId}`} ref={canvasRef} width={W} height={H} />
      <div className="step-ctrl">
        <button className="tiny" onClick={onCompare}>
          {done ? '重新对比' : '开始对比'}
        </button>
      </div>
      <div className={`feedback ${feedback.cls}`}>{feedback.text}</div>
    </div>
  );
};

export default Ch1Mod2;
