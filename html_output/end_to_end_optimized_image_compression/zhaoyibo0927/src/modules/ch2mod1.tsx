import React, { useEffect, useRef, useState } from 'react';
import { setupCanvas, observeCanvas, clamp } from '../lib/canvasKit';
import type { WidgetProps } from './registry';

// §2 模块 2.1 —— 拖动取样框：不同区域的统计（P6 拖动）
// 左：照片 + 120×120 橙色取样框；右：该区域的像素值直方图（12 个 bin，按区域类型确定性给出）。

const W = 1080;
const H = 280;

// 左侧照片与取样框
const PX = 40, PY = 18, PW = 440, PH = 198;
const SQ = 120;
const MIN_X = PX, MAX_X = PX + PW - SQ;
const MIN_Y = PY, MAX_Y = PY + PH - SQ;

// 右侧直方图
const HB_X0 = 620, HB_X1 = 1020, BASE_Y = 212, MAX_H = 168;
const BINS = 12;

type Region = 'sky' | 'grass' | 'edge';

// 每个区域确定性的一套 bin 高度（示意，非论文数据）
const HIST: Record<Region, number[]> = {
  // 平坦天空：窄窄一段，集中在一个 bin 附近
  sky: [0.02, 0.03, 0.06, 0.16, 0.52, 1.0, 0.52, 0.16, 0.06, 0.03, 0.02, 0.01],
  // 纹理草地：铺得很开，几乎没有空 bin
  grass: [0.3, 0.44, 0.58, 0.72, 0.84, 0.92, 0.9, 0.82, 0.7, 0.56, 0.42, 0.3],
  // 清晰边缘：两个峰共存（低值峰蓝、高值峰橙）
  edge: [0.1, 0.42, 0.88, 0.46, 0.18, 0.12, 0.14, 0.22, 0.54, 0.78, 0.4, 0.14],
};

const FEEDBACK: Record<Region, { text: string; cls: string }> = {
  sky: { text: '平坦区域：像素值集中在窄窄的一段——统计规律强，最容易压缩。', cls: '' },
  grass: { text: '纹理区域：像素值铺得很开——统计规律弱，压缩难度大。', cls: '' },
  edge: { text: '边缘区域：两种像素值共存还带着结构——经典 DCT 在这里最容易出伪影（回想第 1 章）。', cls: 'bad' },
};

// 区域类型由取样框中心的位置决定（房屋在 drawPhoto 中占据的相对范围）
function classify(cx: number, cy: number): Region {
  const nx = (cx - PX) / PW;
  const ny = (cy - PY) / PH;
  const hx0 = 0.34, hx1 = 0.66, hy0 = 0.55, hy1 = 0.8;
  const dxN = 20 / PW, dyN = 20 / PH;
  if (nx >= hx0 && nx <= hx1 && ny >= hy0 && ny <= hy1) return 'grass'; // 落在房屋上
  const nearTopBot =
    nx >= hx0 - dxN && nx <= hx1 + dxN && (Math.abs(ny - hy0) <= dyN || Math.abs(ny - hy1) <= dyN);
  const nearLeftRight =
    ny >= hy0 - dyN && ny <= hy1 + dyN && (Math.abs(nx - hx0) <= dxN || Math.abs(nx - hx1) <= dxN);
  if (nearTopBot || nearLeftRight) return 'edge'; // 房屋边界 ±20px
  if (ny < 0.42) return 'sky';
  return 'grass';
}

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

const toCanvas = (canvas: HTMLCanvasElement, clientX: number, clientY: number) => {
  const r = canvas.getBoundingClientRect();
  return { x: (clientX - r.left) * (W / r.width), y: (clientY - r.top) * (H / r.height) };
};

export const Ch2Mod1: React.FC<WidgetProps> = ({ chapterId, moduleId }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({
    sq: { x: 200, y: 40 },
    region: 'sky' as Region,
    disp: HIST.sky.slice(),
    target: HIST.sky.slice(),
    lastT: performance.now(),
  });
  const rafRef = useRef<number | null>(null);
  const grabRef = useRef({ dx: SQ / 2, dy: SQ / 2, active: false });
  const [region, setRegion] = useState<Region>('sky');
  const [feedback, setFeedback] = useState(FEEDBACK.sky);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let ctx: CanvasRenderingContext2D;
    try {
      ctx = setupCanvas(canvas, W, H);
    } catch {
      return;
    }
    canvas.style.cursor = 'grab';

    const render = () => {
      const s = stateRef.current;
      const now = performance.now();
      const dt = clamp(now - s.lastT, 0, 200);
      s.lastT = now;
      const k = clamp(dt / 150, 0, 1); // 直方图柱高在 150ms 内插值到目标
      for (let i = 0; i < BINS; i++) s.disp[i] += (s.target[i] - s.disp[i]) * k;

      sceneBg(ctx, W, H);

      // 照片 + 取样框
      drawPhoto(ctx, PX, PY, PW, PH, 1, false);
      ctx.strokeStyle = C.orange; ctx.lineWidth = 3;
      ctx.strokeRect(s.sq.x + 1.5, s.sq.y + 1.5, SQ - 3, SQ - 3);

      // 该区域的像素值直方图
      const binW = (HB_X1 - HB_X0) / BINS;
      ctx.strokeStyle = C.line; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(HB_X0 - 10, BASE_Y);
      ctx.lineTo(HB_X1 + 10, BASE_Y);
      ctx.stroke();
      for (let i = 0; i < BINS; i++) {
        const hgt = clamp(s.disp[i], 0, 1) * MAX_H;
        ctx.fillStyle = s.region === 'edge' && i >= 7 ? C.orange : C.blue;
        ctx.fillRect(HB_X0 + i * binW + 3, BASE_Y - hgt, binW - 6, hgt);
      }
      label(ctx, '像素值', HB_X0, 16, C.ink, 18);
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

  const applySquare = (x: number, y: number) => {
    const s = stateRef.current;
    s.sq.x = clamp(x, MIN_X, MAX_X);
    s.sq.y = clamp(y, MIN_Y, MAX_Y);
    const r = classify(s.sq.x + SQ / 2, s.sq.y + SQ / 2);
    if (r !== s.region) {
      s.region = r;
      s.target = HIST[r].slice();
      setRegion(r);
      setFeedback(FEEDBACK[r]);
    }
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget;
    const p = toCanvas(canvas, e.clientX, e.clientY);
    if (p.x < PX || p.x > PX + PW || p.y < PY || p.y > PY + PH) return;
    const s = stateRef.current;
    const insideSquare =
      p.x >= s.sq.x && p.x <= s.sq.x + SQ && p.y >= s.sq.y && p.y <= s.sq.y + SQ;
    grabRef.current.dx = insideSquare ? p.x - s.sq.x : SQ / 2;
    grabRef.current.dy = insideSquare ? p.y - s.sq.y : SQ / 2;
    grabRef.current.active = true;
    canvas.style.cursor = 'grabbing';
    canvas.setPointerCapture(e.pointerId);
    applySquare(p.x - grabRef.current.dx, p.y - grabRef.current.dy);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!grabRef.current.active) return;
    const p = toCanvas(e.currentTarget, e.clientX, e.clientY);
    applySquare(p.x - grabRef.current.dx, p.y - grabRef.current.dy);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    grabRef.current.active = false;
    e.currentTarget.style.cursor = 'grab';
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  return (
    <div data-region={region}>
      <canvas
        id={`cv-${chapterId}-${moduleId}`}
        ref={canvasRef}
        width={W}
        height={H}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
      <div className={`feedback ${feedback.cls}`}>{feedback.text}</div>
    </div>
  );
};

export default Ch2Mod1;
