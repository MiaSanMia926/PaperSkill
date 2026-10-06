import React, { useEffect, useRef } from 'react';
import { setupCanvas, observeCanvas, clamp } from '../lib/canvasKit';
import type { WidgetProps } from './registry';

// 类比卡（§3 擦亮镜片）：560×140，连续循环，周期 5s。
// 一块大镜片上有三块橙色眩光，一块擦拭布顺时针扫过镜面；
// 布扫过之处眩光淡到 alpha 0.1，一圈扫完后随循环回到初始亮度。
// 唯一的运动主体是那块布。

const W = 560;
const H = 140;
const PERIOD = 5;

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
  // 镜片：同心圆 + 白色高光弧（highlight 0..1 让高光缓慢游走）
  ctx.fillStyle = '#d7deea'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = C.blue; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.72, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.44, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 4;
  const a0 = -2.5 + highlight * 0.5;
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.86, a0, a0 + 0.75); ctx.stroke();
}

// 本卡固定布景：镜片与三块眩光
const LENS = { x: 200, y: 62, r: 50 };
const GLARE = [
  { x: 176, y: 40, r: 17 },
  { x: 224, y: 70, r: 19 },
  { x: 180, y: 84, r: 15 },
];

export const Ana3: React.FC<WidgetProps> = ({ chapterId, moduleId }) => {
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
      const ph = ((performance.now() / 1000) % PERIOD) / PERIOD;
      stateRef.current.ph = ph;

      sceneBg(ctx, W, H);
      drawLens(ctx, LENS.x, LENS.y, LENS.r, ph);

      // 布沿镜面顺时针扫一圈（相位从正上方开始）
      const sweep = -Math.PI / 2 + ph * Math.PI * 2;
      const orbit = LENS.r - 8;
      const wx = LENS.x + Math.cos(sweep) * orbit;
      const wy = LENS.y + Math.sin(sweep) * orbit;

      // 眩光：布扫过之后淡到 alpha 0.1，一圈快走完时回到 0.7
      for (const g of GLARE) {
        let d = ph - (((Math.atan2(g.y - LENS.y, g.x - LENS.x) + Math.PI / 2) / (Math.PI * 2)) % 1 + 1) % 1;
        if (d < 0) d += 1;
        const wiped = 1 - clamp((d - 0.88) / 0.12, 0, 1);
        const alpha = 0.7 - 0.6 * wiped;
        const rg = ctx.createRadialGradient(g.x, g.y, 2, g.x, g.y, g.r);
        rg.addColorStop(0, 'rgba(240,126,71,' + alpha.toFixed(3) + ')');
        rg.addColorStop(0.55, 'rgba(240,126,71,' + (alpha * 0.6).toFixed(3) + ')');
        rg.addColorStop(1, 'rgba(240,126,71,0)');
        ctx.fillStyle = rg;
        ctx.beginPath(); ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2); ctx.fill();
      }

      // 擦拭布：贴着镜面切向的小圆角矩形
      ctx.save();
      ctx.translate(wx, wy);
      ctx.rotate(sweep + Math.PI / 2);
      ctx.fillStyle = C.bg;
      ctx.strokeStyle = C.wood;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-13, -8);
      ctx.lineTo(13, -8);
      ctx.quadraticCurveTo(17, -8, 17, -4);
      ctx.lineTo(17, 4);
      ctx.quadraticCurveTo(17, 8, 13, 8);
      ctx.lineTo(-13, 8);
      ctx.quadraticCurveTo(-17, 8, -17, 4);
      ctx.lineTo(-17, -4);
      ctx.quadraticCurveTo(-17, -8, -13, -8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = C.wood;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-6, -8); ctx.lineTo(-6, 8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(6, -8); ctx.lineTo(6, 8); ctx.stroke();
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

  return (
    <div>
      <canvas id={`cv-${chapterId}-${moduleId}`} ref={canvasRef} width={W} height={H} />
    </div>
  );
};
export default Ana3;
