import React, { useEffect, useRef, useState } from 'react';
import { setupCanvas, observeCanvas, clamp } from '../lib/canvasKit';
import type { WidgetProps } from './registry';

// §4 模块 4.1（ch4mod1）：拖动 λ，看码率与失真的天平。
// 左边是天平：左盘三卷胶卷（码率），右盘砝码（失真），横梁随 λ 倾斜；
// 右边是率失真曲线：绿色曲线 + 当前工作点，旁边是相对数值 R、D。

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

// 天平与 R-D 曲线的固定几何
const FX = 280;
const FY = 220;
const BEAM = 112;
const ROD = 12;
const PLATE_W = 76;
const PLATE_H = 6;

// 二次贝塞尔：(600,60) → 控制点 (820,120) → (1040,230)（低码率在左上，与模块 4.2 同向）
// x(t) = 600 + 440t，y(t) = 60 + 220t − 50t²，t = v（v 大 → λ 大 → 高码率端）
function curveY(t: number): number {
  return 60 + 220 * t - 50 * t * t;
}

export const Ch4Mod1: React.FC<WidgetProps> = ({ chapterId, moduleId }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({ v: 0.5 });
  const rafRef = useRef<number | null>(null);
  const [v, setV] = useState(0.5);
  const [feedback, setFeedback] = useState({ text: '中等 λ：码率与失真大致均衡。', cls: '' });

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
      const vv = clamp(stateRef.current.v, 0, 1);
      const ang = -0.35 + 0.7 * vv;
      const cs = Math.cos(ang);
      const sn = Math.sin(ang);
      const lx = FX - BEAM * cs;
      const ly = FY + BEAM * sn;
      const rx = FX + BEAM * cs;
      const ry = FY - BEAM * sn;
      const f = vv;

      sceneBg(ctx, W, H);

      // 支点（木色三角 + 底座）
      ctx.fillStyle = C.wood;
      ctx.beginPath();
      ctx.moveTo(FX, FY);
      ctx.lineTo(FX - 22, FY + 34);
      ctx.lineTo(FX + 22, FY + 34);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(FX - 44, FY + 34, 88, 8);

      // 横梁
      ctx.strokeStyle = C.ink; ctx.lineWidth = 7; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(rx, ry); ctx.stroke();
      ctx.lineCap = 'butt';
      ctx.fillStyle = C.wood;
      ctx.beginPath(); ctx.arc(FX, FY, 6, 0, Math.PI * 2); ctx.fill();

      // 左盘：三卷胶卷（大小 ∝ 码率）
      ctx.strokeStyle = C.ink; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx, ly + ROD); ctx.stroke();
      ctx.fillStyle = C.ink;
      ctx.fillRect(lx - PLATE_W / 2, ly + ROD, PLATE_W, PLATE_H);
      const cw = 14 + 6 * f;
      const chh = 20 + 22 * f;
      const total = 3 * cw + 8;
      for (let i = 0; i < 3; i++) {
        const cx0 = lx - total / 2 + i * (cw + 4);
        const cy0 = ly + ROD - chh;
        ctx.fillStyle = C.blue;
        ctx.fillRect(cx0, cy0, cw, chh);
        ctx.fillStyle = C.line;
        ctx.fillRect(cx0, cy0, cw, 5);
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(cx0 + 3, cy0 + 7, 2, chh - 10);
      }

      // 右盘：砝码（大小 ∝ 失真）
      ctx.strokeStyle = C.ink; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx, ry + ROD); ctx.stroke();
      ctx.fillStyle = C.ink;
      ctx.fillRect(rx - PLATE_W / 2, ry + ROD, PLATE_W, PLATE_H);
      const side = 14 + 34 * (1 - vv);
      const bx = rx - side / 2;
      const by = ry + ROD - side;
      ctx.fillStyle = C.red;
      ctx.fillRect(bx, by, side, side);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(bx, by, side, 5);
      ctx.strokeStyle = C.muted; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(rx, by, side * 0.2, Math.PI, 0); ctx.stroke();

      // 右侧率失真曲线面板
      ctx.fillStyle = 'rgba(255,255,255,0.82)';
      ctx.fillRect(556, 20, 504, 240);
      ctx.strokeStyle = C.line; ctx.lineWidth = 2;
      ctx.strokeRect(557, 21, 502, 238);
      ctx.strokeStyle = C.line; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(600, 40); ctx.lineTo(600, 230); ctx.lineTo(1050, 230);
      ctx.stroke();

      // 绿色率失真曲线
      ctx.strokeStyle = C.green; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(600, 60);
      ctx.quadraticCurveTo(820, 120, 1040, 230);
      ctx.stroke();

      // 当前工作点
      const t = vv;
      const px = 600 + 440 * t;
      const py = curveY(t);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(px, py, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = C.blue;
      ctx.beginPath(); ctx.arc(px, py, 6, 0, Math.PI * 2); ctx.fill();

      // 相对数值（R、D 都是相对量）
      const rl = px > 950 ? px - 66 : px + 12;
      label(ctx, 'R ' + vv.toFixed(2), rl, py - 32, C.blue, 15);
      label(ctx, 'D ' + (1 - vv).toFixed(2), rl, py - 14, C.red, 15);

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

  // 唯一的主动作：拖动 λ 滑杆（对数刻度 λ = 32·64^v）
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nv = Number(e.target.value) / 100;
    stateRef.current.v = nv;
    setV(nv);
    setFeedback(
      nv < 0.25
        ? { text: 'λ 小：省流优先，码率低，失真偏大。', cls: '' }
        : nv > 0.75
        ? { text: 'λ 大：画质优先，失真小，码率随之升高。', cls: 'good' }
        : { text: '中等 λ：码率与失真大致均衡。', cls: '' }
    );
  };

  const lambda = Math.round(32 * Math.pow(64, v));

  return (
    <div>
      <canvas id={`cv-${chapterId}-${moduleId}`} ref={canvasRef} width={W} height={H} />
      <div className="ctrl">
        <label>
          λ <span className="val">{lambda}</span>
        </label>
        <input type="range" min={0} max={100} value={Math.round(v * 100)} onChange={onChange} />
      </div>
      <div className={`feedback ${feedback.cls}`}>{feedback.text}</div>
    </div>
  );
};
export default Ch4Mod1;
