import React, { useEffect, useRef, useState } from 'react';
import { setupCanvas, observeCanvas, clamp } from '../lib/canvasKit';
import type { WidgetProps } from './registry';

// §4 模块 4.2（ch4mod2）：在率失真曲线上拖动工作点。
// 绿色曲线 = 本文方法，上方红色曲线 = JPEG 参考（同为示意，间距在低码率段最大）；
// 蓝色工作点被约束在绿色曲线上滑动，右侧数值为该点的相对码率与相对失真。

const W = 1080;
const H = 280;

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
function drawKnob(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, angle: number) {
  // 旋钮：木色外环 + 橙色指针（angle 以「正上方」为 0，顺时针为正）
  ctx.fillStyle = '#d7deea'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = C.wood; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = C.line; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.6, 0, Math.PI * 2); ctx.stroke();
  const a = -Math.PI / 2 + angle;
  ctx.strokeStyle = C.orange; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(a) * (r - 6), cy + Math.sin(a) * (r - 6)); ctx.stroke();
  ctx.lineCap = 'butt';
  ctx.fillStyle = C.wood; ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fill();
}

// 绿色曲线（本文方法）：二次贝塞尔 (600,60) → 控制点 (640,140) → (1040,230)
// x(t) = 600 + 80t + 360t²（单调），y(t) = 60 + 160t + 10t²
const X0 = 600;
const X1 = 1040;
function greenT(x: number): number {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (X0 + 80 * mid + 360 * mid * mid < x) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
function greenX(t: number): number {
  return X0 + 80 * t + 360 * t * t;
}
function greenY(x: number): number {
  const t = greenT(x);
  return 60 + 160 * t + 10 * t * t;
}
function greenSlope(t: number): number {
  return (160 + 20 * t) / (80 + 720 * t);
}
// JPEG 参考曲线：同形上移，低码率段间距最大、高码率段收窄
function redYAt(t: number): number {
  return 60 + 160 * t + 10 * t * t - (30 - 20 * t);
}

export const Ch4Mod2: React.FC<WidgetProps> = ({ chapterId, moduleId }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({ pt: { x: 820, y: greenY(820) } });
  const dragRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const [pt, setPt] = useState({ x: 820, y: greenY(820) });
  const [feedback, setFeedback] = useState({ text: '中码率区：差距依然存在。', cls: '' });

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
      const x = clamp(stateRef.current.pt.x, X0, X1);
      const y = greenY(x);

      sceneBg(ctx, W, H);

      // 绘图面板与坐标轴
      ctx.fillStyle = 'rgba(255,255,255,0.82)';
      ctx.fillRect(556, 20, 504, 240);
      ctx.strokeStyle = C.line; ctx.lineWidth = 2;
      ctx.strokeRect(557, 21, 502, 238);
      ctx.strokeStyle = C.line; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(600, 40); ctx.lineTo(600, 230); ctx.lineTo(1050, 230);
      ctx.stroke();

      // JPEG 参考曲线（红色，示意）
      ctx.strokeStyle = C.red; ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i <= 48; i++) {
        const tt = i / 48;
        const cx = greenX(tt);
        const cy = redYAt(tt);
        if (i === 0) ctx.moveTo(cx, cy);
        else ctx.lineTo(cx, cy);
      }
      ctx.stroke();

      // 本文方法曲线（绿色，示意）
      ctx.strokeStyle = C.green; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(X0, 60);
      ctx.quadraticCurveTo(640, 140, X1, 230);
      ctx.stroke();

      // 左侧的斜率提示箭头（橙，无文字）：左端更陡
      const ax = 660;
      const ay = greenY(ax);
      const m = greenSlope(greenT(ax));
      const ux = 1 / Math.hypot(1, m);
      const uy = m / Math.hypot(1, m);
      const sx = ax - 16 * ux;
      const sy = ay - 16 * uy;
      const ex = ax + 16 * ux;
      const ey = ay + 16 * uy;
      ctx.strokeStyle = C.orange; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.fillStyle = C.orange;
      ctx.beginPath();
      ctx.moveTo(ex + 5 * ux, ey + 5 * uy);
      ctx.lineTo(ex - 4 * uy, ey + 4 * ux);
      ctx.lineTo(ex + 4 * uy, ey - 4 * ux);
      ctx.closePath();
      ctx.fill();
      ctx.lineCap = 'butt';

      // 可拖动的工作点（约束在绿色曲线上）
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = C.blue;
      ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();

      // 相对数值（码率 rel = (x−600)/440，失真 rel = 1−(y−60)/170）
      const rl = x > 980 ? x - 62 : x + 14;
      label(ctx, ((x - 600) / 440).toFixed(2), rl, y - 30, C.blue, 15);
      label(ctx, (1 - (y - 60) / 170).toFixed(2), rl, y - 12, C.red, 15);

      // 两个轴标签
      label(ctx, '码率', 604, 238, C.ink, 16);
      label(ctx, '失真', 566, 36, C.ink, 16);
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

  // 唯一的主动作：沿绿色曲线拖动工作点（x 决定 y，y 是 x 的纯函数）
  const applyDrag = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * W;
    const nx = clamp(mx, X0, X1);
    const ny = greenY(nx);
    stateRef.current.pt = { x: nx, y: ny };
    setPt({ x: nx, y: ny });
    setFeedback(
      nx < 740
        ? { text: '低码率区：两条曲线差距最大——本文方法在这里优势最明显（PSNR 尤其低码率占优）。', cls: '' }
        : nx > 940
        ? { text: '高码率区：差距收窄，个别图像上本文方法的 MSE 甚至会被 JPEG 2000 反超（详见第 10 章）。', cls: 'bad' }
        : { text: '中码率区：差距依然存在。', cls: '' }
    );
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    dragRef.current = true;
    canvas.setPointerCapture(e.pointerId);
    applyDrag(e);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current) applyDrag(e);
  };
  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    dragRef.current = false;
    const canvas = canvasRef.current;
    if (canvas && canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
  };

  return (
    <div>
      <canvas
        id={`cv-${chapterId}-${moduleId}`}
        ref={canvasRef}
        width={W}
        height={H}
        style={{ touchAction: 'none', cursor: 'grab' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
      <div className={`feedback ${feedback.cls}`}>{feedback.text}</div>
    </div>
  );
};
export default Ch4Mod2;
