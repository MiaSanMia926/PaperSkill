import React, { useEffect, useRef, useState } from 'react';
import { setupCanvas, observeCanvas, clamp } from '../lib/canvasKit';
import type { WidgetProps } from './registry';

// ana-10 「评审打分」— 结果与局限的日常隐喻：三张参赛照片并排挂在墙上，
// 评委同时举起打分牌。循环 7s：三块记分牌以不同速度升起、停在不同高度（绿框照片最高），
// 保持 1.5s 后重置。这里不画奖杯（奖杯留给数据支持的模块）。

const W = 560;
const H = 140;
const PERIOD = 7;

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
  // 本卡片不使用它——奖杯留给论文数据支持的模块（第 10 章 10.1）。
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

const CX = [96, 280, 464];                     // 三张照片 / 三块打分牌的中心
const COLORS = [C.red, C.green, C.purple];     // JPEG / 本文方法 / JPEG 2000
const FRAME_W = 54;
const FRAME_H = 38;
const PAD = 4;
const FRAME_TOP = 12;
const T_END = [0.72, 0.62, 0.70];              // 各自升起的结束时刻（绿框最快）
const SCORE = [0.5, 1.0, 0.72];                // 打分高度：绿框（本文方法）最高
const HOLD_END = 0.94;                         // 保持 1.5s 后重置

export const Ana10: React.FC<WidgetProps> = ({ chapterId, moduleId }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const stateRef = useRef({ ph: 0 });

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
      const ph = (now / 1000) % PERIOD / PERIOD;
      s.ph = ph;

      sceneBg(ctx, W, H);

      const fade = ph > HOLD_END ? clamp(1 - (ph - HOLD_END) / (1 - HOLD_END), 0, 1) : 1;
      ctx.globalAlpha = fade;

      // 三张参赛照片，等高挂在墙上
      for (let i = 0; i < CX.length; i++) {
        const cx = CX[i];
        const fx = cx - FRAME_W / 2 - PAD;
        const fw = FRAME_W + 2 * PAD;
        const fh = FRAME_H + 2 * PAD;
        ctx.strokeStyle = C.muted; ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(fx + 4, FRAME_TOP); ctx.lineTo(cx, 4);
        ctx.moveTo(fx + fw - 4, FRAME_TOP); ctx.lineTo(cx, 4);
        ctx.stroke();
        drawFrame(ctx, fx, FRAME_TOP, fw, fh);
        drawPhoto(ctx, cx - FRAME_W / 2, FRAME_TOP + PAD, FRAME_W, FRAME_H, 1, false);
        ctx.strokeStyle = COLORS[i]; ctx.lineWidth = 3;
        ctx.strokeRect(fx + 1.5, FRAME_TOP + 1.5, fw - 3, fh - 3);
      }

      // 三块打分牌：不同速度升起，停在不同高度
      for (let i = 0; i < CX.length; i++) {
        const cx = CX[i];
        const t = clamp((ph - 0.06) / (T_END[i] - 0.06), 0, 1);
        const rise = 44 * SCORE[i] * easeOut(t);
        const boardBottom = 136 - 8 - rise;
        const boardTop = boardBottom - 26;
        ctx.fillStyle = C.wood;
        ctx.fillRect(cx - 2, boardBottom, 4, 136 - boardBottom);   // 木棍
        ctx.fillRect(cx - 7, 128, 14, 9);                          // 握把
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(cx - 22, boardTop, 44, 26);                   // 白色记分牌
        ctx.strokeStyle = COLORS[i]; ctx.lineWidth = 2;
        ctx.strokeRect(cx - 21, boardTop + 1, 42, 24);
      }

      ctx.globalAlpha = 1;
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

  return (
    <div>
      <canvas id={`cv-${chapterId}-${moduleId}`} ref={canvasRef} width={W} height={H} />
    </div>
  );
};

export default Ana10;
