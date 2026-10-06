import React, { useEffect, useRef, useState } from 'react';
import { setupCanvas, observeCanvas, clamp } from '../lib/canvasKit';
import type { WidgetProps } from './registry';

// §3 模块 3.1（ch3mod1）：拖动系数点，看除法归一化的效果。
// 左侧是一块布满眩光的镜片，右侧是系数对 (w₁, w₂) 的散点面板：
// 红圈 = 原始位置（未归一化），绿点 = 除以 s 之后的位置（归一化后）。
// s = sqrt(1 + 1.2·Σ_k glare_k·max(0, 1 − dist(pt,G_k)/90))

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
function drawLens(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, highlight: number) {
  // 镜片：同心圆 + 白色高光弧
  ctx.fillStyle = '#d7deea'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = C.blue; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.72, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.44, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 4;
  const a0 = -2.5 + highlight * 0.5;
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.86, a0, a0 + 0.75); ctx.stroke();
}

// 布景：左镜片 + 三块固定眩光，右散点面板
const LENS = { x: 280, y: 140, r: 110 };
const SCAT = { x: 810, y: 140, r: 36 };
const GLARE = [
  { x: 170, y: 110, k: 1 },
  { x: 420, y: 90, k: 0.8 },
  { x: 300, y: 200, k: 0.6 },
];
const GLARE_R = 46;
const FALL = 90;
const MAP_K = 0.5; // 镜片坐标 → 散点坐标的仿射缩放

function normFactor(px: number, py: number): number {
  let sum = 0;
  for (const g of GLARE) {
    const d = Math.hypot(px - g.x, py - g.y);
    sum += g.k * Math.max(0, 1 - d / FALL);
  }
  return Math.sqrt(1 + 1.2 * sum);
}
function mapGhost(px: number, py: number) {
  return { x: SCAT.x + (px - LENS.x) * MAP_K, y: SCAT.y + (py - LENS.y) * MAP_K };
}

export const Ch3Mod1: React.FC<WidgetProps> = ({ chapterId, moduleId }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({ pt: { x: 300, y: 150 } });
  const dragRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const [pt, setPt] = useState({ x: 300, y: 150 });
  const [feedback, setFeedback] = useState({ text: '离光斑远：邻域安静，系数几乎不动。', cls: '' });

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
      const p = stateRef.current.pt;

      sceneBg(ctx, W, H);
      drawLens(ctx, LENS.x, LENS.y, LENS.r, 0.5);

      // 三块固定眩光（强度越大越显眼）
      for (const g of GLARE) {
        const alpha = 0.18 + 0.42 * g.k;
        const rg = ctx.createRadialGradient(g.x, g.y, 2, g.x, g.y, GLARE_R);
        rg.addColorStop(0, 'rgba(240,126,71,' + alpha.toFixed(3) + ')');
        rg.addColorStop(0.55, 'rgba(240,126,71,' + (alpha * 0.55).toFixed(3) + ')');
        rg.addColorStop(1, 'rgba(240,126,71,0)');
        ctx.fillStyle = rg;
        ctx.beginPath(); ctx.arc(g.x, g.y, GLARE_R, 0, Math.PI * 2); ctx.fill();
      }

      // 可拖动的系数点
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(p.x, p.y, 13, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = C.ink;
      ctx.beginPath(); ctx.arc(p.x, p.y, 10, 0, Math.PI * 2); ctx.fill();

      // 右侧散点面板
      ctx.fillStyle = 'rgba(255,255,255,0.82)';
      ctx.fillRect(556, 20, 504, 240);
      ctx.strokeStyle = C.line; ctx.lineWidth = 2;
      ctx.strokeRect(557, 21, 502, 238);
      ctx.strokeStyle = C.line; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(580, SCAT.y); ctx.lineTo(1040, SCAT.y);
      ctx.moveTo(SCAT.x, 40); ctx.lineTo(SCAT.x, 244);
      ctx.stroke();

      // 目标圈
      ctx.strokeStyle = C.green; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(SCAT.x, SCAT.y, SCAT.r, 0, Math.PI * 2); ctx.stroke();

      // 未归一化（红圈）→ 归一化后（绿点）
      const gh = mapGhost(p.x, p.y);
      const s = normFactor(p.x, p.y);
      const nx = SCAT.x + (gh.x - SCAT.x) / s;
      const ny = SCAT.y + (gh.y - SCAT.y) / s;
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = C.line; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(gh.x, gh.y); ctx.lineTo(nx, ny); ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = C.red; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(gh.x, gh.y, 10, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = C.green;
      ctx.beginPath(); ctx.arc(nx, ny, 10, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(nx, ny, 10, 0, Math.PI * 2); ctx.stroke();

      // 图例
      ctx.fillStyle = C.red;
      ctx.beginPath(); ctx.arc(846, 240, 5, 0, Math.PI * 2); ctx.fill();
      label(ctx, '未归一化', 856, 232, C.muted, 14);
      ctx.fillStyle = C.green;
      ctx.beginPath(); ctx.arc(946, 240, 5, 0, Math.PI * 2); ctx.fill();
      label(ctx, '归一化后', 956, 232, C.muted, 14);
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

  // 唯一的主动作：在左侧镜片上拖动系数点（限制在镜片内）
  const applyDrag = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * W;
    const my = ((e.clientY - rect.top) / rect.height) * H;
    let dx = mx - LENS.x;
    let dy = my - LENS.y;
    const d = Math.hypot(dx, dy);
    const maxR = LENS.r - 12;
    if (d > maxR && d > 0) {
      const k = maxR / d;
      dx *= k;
      dy *= k;
    }
    const nx = LENS.x + dx;
    const ny = LENS.y + dy;
    stateRef.current.pt = { x: nx, y: ny };
    setPt({ x: nx, y: ny });
    const s = normFactor(nx, ny);
    setFeedback(
      s >= 1.15
        ? { text: '贴近强光斑：系数被压向原点——归一化强度由<b>周围</b>的亮度决定，这就是空间自适应。', cls: 'good' }
        : { text: '离光斑远：邻域安静，系数几乎不动。', cls: '' }
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
      <div className={`feedback ${feedback.cls}`} dangerouslySetInnerHTML={{ __html: feedback.text }} />
    </div>
  );
};
export default Ch3Mod1;
