import React, { useEffect, useRef, useState } from 'react';
import { setupCanvas, observeCanvas, clamp } from '../lib/canvasKit';
import type { WidgetProps } from './registry';

// ch9mod1 「自适应熵编码：收益有多大」— P4 模式切换。
// 左：墙上的搁板，6 张照片按符号频率排列（4 张小的常用 + 1 张中号 + 1 张大号稀有）。
//     非自适应（固定概率）= 每张都套同样的大相框，缝隙泛红、占满搁板；
//     自适应（CABAC）= 相框贴合照片本身，总宽度明显更短，贴合处亮绿。
// 右：偏斜的符号频率直方图 + 总比特条（非自适应更长，红色；自适应略短，绿色）。

const W = 1080;
const H = 280;

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

function drawFrame(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.strokeStyle = C.blue; ctx.lineWidth = 3;
  ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
}

function drawBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, frac: number, color: string) {
  ctx.fillStyle = C.line; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color; ctx.fillRect(x, y, w * clamp(frac, 0, 1), h);
}

function drawTrophy(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  // 奖杯：杯身 C.orange、底座 C.wood、白色高光；锚点为左上角，约 44*s × 38*s
  ctx.fillStyle = C.orange;
  ctx.beginPath();
  ctx.moveTo(x + 8 * s, y + 2 * s);
  ctx.lineTo(x + 36 * s, y + 2 * s);
  ctx.lineTo(x + 27 * s, y + 21 * s);
  ctx.lineTo(x + 17 * s, y + 21 * s);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = C.orange; ctx.lineWidth = 2.5 * s;
  ctx.beginPath(); ctx.arc(x + 7 * s, y + 9 * s, 5 * s, Math.PI * 0.5, Math.PI * 1.5); ctx.stroke();
  ctx.beginPath(); ctx.arc(x + 37 * s, y + 9 * s, 5 * s, -Math.PI * 0.5, Math.PI * 0.5); ctx.stroke();
  ctx.fillStyle = C.orange;
  ctx.fillRect(x + 20 * s, y + 21 * s, 4 * s, 6 * s);
  ctx.fillStyle = C.wood;
  ctx.fillRect(x + 12 * s, y + 27 * s, 20 * s, 6 * s);
  ctx.fillRect(x + 8 * s, y + 33 * s, 28 * s, 5 * s);
  ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 2 * s;
  ctx.beginPath(); ctx.moveTo(x + 13 * s, y + 6 * s); ctx.lineTo(x + 13 * s, y + 16 * s); ctx.stroke();
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

// 6 张照片：4 张小照片（常用符号）+ 1 张中号 + 1 张大号（稀有符号）
const PHOTOS = [
  { w: 28, h: 20 }, { w: 28, h: 20 }, { w: 28, h: 20 }, { w: 28, h: 20 },
  { w: 40, h: 28 }, { w: 58, h: 42 },
];
const TIGHT_PAD = 5;                                   // 刚好贴合
const LOOSE_PAD = 8;                                   // 固定概率：大框
const UNIFORM_W = 58 + 2 * LOOSE_PAD;                  // 统一的大框尺寸 74
const UNIFORM_H = 42 + 2 * LOOSE_PAD;                  // 58
const GAP = 10;
const START_X = 34;
const SHELF_Y = 226;
const SIG = [1, 0.72, 0.5, 0.34, 0.22, 0.14, 0.09, 0.05]; // 偏斜的符号频率（示意）

export const Ch9Mod1: React.FC<WidgetProps> = ({ chapterId, moduleId }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const stateRef = useRef({ mode: 'fixed' as 'fixed' | 'cabac', m: 1, mFrom: 1, animT0: 0 });
  const [mode, setMode] = useState<'fixed' | 'cabac'>('fixed');
  const [feedback, setFeedback] = useState({
    text: '固定概率：不论实际统计如何，码长分配一成不变——常用符号也被迫用长码。',
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
      const s = stateRef.current;
      const now = performance.now();
      // 两种方案之间 200ms 平滑过渡：m = 1 表示「固定概率」，m = 0 表示「自适应」
      const t = clamp((now - s.animT0) / 200, 0, 1);
      const target = s.mode === 'fixed' ? 1 : 0;
      const m = s.mFrom + (target - s.mFrom) * easeOut(t);
      s.m = m;
      const tight = 1 - m;

      sceneBg(ctx, W, H);

      // ---------- 左：搁板上的相框 ----------
      ctx.fillStyle = C.wood;
      ctx.fillRect(24, SHELF_Y, 512, 7);
      ctx.fillStyle = 'rgba(0,0,0,0.10)';
      ctx.fillRect(24, SHELF_Y + 7, 512, 2);

      let cursor = START_X;
      for (let i = 0; i < PHOTOS.length; i++) {
        const p = PHOTOS[i];
        const pad = TIGHT_PAD + (LOOSE_PAD - TIGHT_PAD) * m;
        const fw = p.w + 2 * TIGHT_PAD + (UNIFORM_W - (p.w + 2 * TIGHT_PAD)) * m;
        const fh = p.h + 2 * TIGHT_PAD + (UNIFORM_H - (p.h + 2 * TIGHT_PAD)) * m;
        const fx = cursor;
        const fy = SHELF_Y - fh;
        const px = fx + (fw - p.w) / 2;
        const py = SHELF_Y - pad - p.h;

        if (m > 0.02) { // 固定概率：相框偏大，缝隙泛红（被浪费的搁板）
          ctx.fillStyle = `rgba(196,63,82,${0.2 * m})`;
          ctx.fillRect(fx + 3, fy + 3, fw - 6, fh - 6);
        }
        drawFrame(ctx, fx, fy, fw, fh);
        drawPhoto(ctx, px, py, p.w, p.h, 1, false);
        if (tight > 0.02) { // 自适应：相框刚好贴合，绿边
          ctx.globalAlpha = tight;
          ctx.strokeStyle = C.green; ctx.lineWidth = 3;
          ctx.strokeRect(fx + 1.5, fy + 1.5, fw - 3, fh - 3);
          ctx.globalAlpha = 1;
        }
        cursor += fw + GAP;
      }

      // ---------- 右：符号频率直方图 ----------
      label(ctx, '符号频率', 566, 30, C.ink, 16);
      const baseY = 196;
      const maxH = 126;
      for (let i = 0; i < SIG.length; i++) {
        const bh = maxH * SIG[i];
        ctx.fillStyle = i === SIG.length - 1 ? C.orange : C.blue; // 稀有符号：橙色
        ctx.fillRect(600 + i * 54, baseY - bh, 40, bh);
      }
      ctx.strokeStyle = C.line; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(590, baseY); ctx.lineTo(1024, baseY); ctx.stroke();

      // ---------- 右：总比特 ----------
      label(ctx, '总比特', 566, 224, C.ink, 16);
      const bitsFrac = 0.9 + 0.1 * m; // 自适应略短一点
      drawBar(ctx, 650, 224, 372, 20, bitsFrac, m > 0.5 ? C.red : C.green);
      ctx.strokeStyle = C.green; ctx.lineWidth = 2; // 自适应方案的长度刻度
      ctx.beginPath();
      ctx.moveTo(650 + 372 * 0.9, 218); ctx.lineTo(650 + 372 * 0.9, 250);
      ctx.stroke();
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

  const onMode = (next: 'fixed' | 'cabac') => {
    const s = stateRef.current;
    if (s.mode === next) return;
    s.mFrom = s.m;
    s.animT0 = performance.now();
    s.mode = next;
    setMode(next);
    setFeedback(
      next === 'fixed'
        ? {
            text: '固定概率：不论实际统计如何，码长分配一成不变——常用符号也被迫用长码。',
            cls: '',
          }
        : {
            text: '自适应只比非自适应略省一点比特——论文图 10 显示收益很小，甚至可能不如 JPEG 2000 熵编码的收益。',
            cls: 'good',
          }
    );
  };

  return (
    <div>
      <canvas id={`cv-${chapterId}-${moduleId}`} ref={canvasRef} width={W} height={H} />
      <div className="chip-row">
        <button
          type="button"
          className={`chip ${mode === 'fixed' ? 'selected' : ''}`}
          onClick={() => onMode('fixed')}
        >
          非自适应（固定概率）
        </button>
        <button
          type="button"
          className={`chip ${mode === 'cabac' ? 'selected' : ''}`}
          onClick={() => onMode('cabac')}
        >
          自适应（CABAC）
        </button>
      </div>
      <div className={`feedback ${feedback.cls}`}>{feedback.text}</div>
    </div>
  );
};

export default Ch9Mod1;
