import React, { useEffect, useRef, useState } from 'react';
import { setupCanvas, observeCanvas, clamp } from '../lib/canvasKit';
import type { WidgetProps } from './registry';

// ch10mod1 「评审开始：三方同码率对比」— P8 结果竞速 + 校验过的数据表。
// 三条赛道（本文方法 / JPEG / JPEG 2000）在 0 → 1 的归一化坐标上按选中指标跑分，
// 数值只取自论文图 5；定性指标不画数字，改用红色「!」与紫色小皇冠标注，
// 奖杯只出现在论文数据支持的胜者赛道上。

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

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

const NAMES = ['本文方法', 'JPEG', 'JPEG 2000'];
const COLORS = [C.green, C.red, C.purple];
const LANE_Y = [70, 140, 210];
const VALUES = [
  [0.9039, 0.8079, 0.8860],   // 图 5：MS-SSIM
  [27.01, 24.85, 26.61],      // 图 5：亮度 PSNR (dB)
  [0.62, 0.6, 0.78],          // 定性：个别图·高码率（无数字）
];
const SCALE = [1, 30, 1];     // 归一化到 0…1 的坐标
const WINNER = [0, 0, 2];     // 支持该指标胜出的赛道
const STAGGER = [0, 120, 240];
const METRIC_LABELS = ['MS-SSIM（越高越好）', 'PSNR 亮度（越高越好）', '个别图·高码率（定性）'];
const FB = [
  { text: 'MS-SSIM：本文方法在全部图像与码率上占优——这里 0.9039 对 JPEG 的 0.8079，且码率还更低（0.113 对 0.121）。', cls: 'good' },
  { text: 'PSNR 亮度：27.01 dB，比 JPEG 高 2.16 dB、比 JPEG 2000 高 0.40 dB，码率同为 0.113 bit/px。', cls: 'good' },
  { text: '高码率的个别图像上（论文图 15），本文方法的 MSE 会被 JPEG 2000 反超——这是论文自己报告的局限，不是全胜。', cls: 'bad' },
];
const X0 = 80;
const X1 = 1000;
const RACE_MS = 2200;
const PRE_FB = { text: '选择一个指标，点击开始评审——赛道按真实数值跑分。', cls: '' };

export const Ch10Mod1: React.FC<WidgetProps> = ({ chapterId, moduleId }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const stateRef = useRef({ metric: 0 as 0 | 1 | 2, started: false, t0: 0, finished: false });
  const [metric, setMetric] = useState<0 | 1 | 2>(0);
  const [finished, setFinished] = useState(false);
  const [feedback, setFeedback] = useState(PRE_FB);

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
      const started = s.started;
      const raceEnd = RACE_MS + STAGGER[2];
      const allDone = started && now - s.t0 >= raceEnd;

      sceneBg(ctx, W, H);

      // 评审台
      roundRect(ctx, 16, 24, 1048, 228, 10);
      ctx.fillStyle = 'rgba(255,255,255,0.62)'; ctx.fill();
      ctx.strokeStyle = C.line; ctx.lineWidth = 1.5; ctx.stroke();

      // 起跑线与终点线
      ctx.strokeStyle = C.line; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(X0, 44); ctx.lineTo(X0, 246);
      ctx.moveTo(X1, 44); ctx.lineTo(X1, 246);
      ctx.stroke();
      label(ctx, '0', 66, 234, C.muted, 14);
      label(ctx, '1', 1006, 234, C.muted, 14);

      for (let i = 0; i < NAMES.length; i++) {
        const laneY = LANE_Y[i];
        const pl = started ? clamp((now - s.t0 - STAGGER[i]) / RACE_MS, 0, 1) : 0;
        const frac = (VALUES[s.metric][i] / SCALE[s.metric]) * easeOut(pl);

        label(ctx, NAMES[i], 84, laneY - 26, COLORS[i], 15);
        drawBar(ctx, X0, laneY, X1 - X0, 20, frac, COLORS[i]);

        if (s.metric === 2 && pl > 0) {
          // 定性指标：不画数字，只标出这里发生了什么
          ctx.globalAlpha = clamp(pl, 0, 1);
          if (i === 0) { // 本文方法：红色「!」
            const bx = X0 + (X1 - X0) * VALUES[2][0] + 16;
            const by = laneY + 10;
            ctx.fillStyle = C.red;
            ctx.beginPath(); ctx.arc(bx, by, 11, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 15px "Segoe UI", sans-serif';
            ctx.textBaseline = 'middle';
            ctx.fillText('!', bx - 2, by + 1);
            ctx.textBaseline = 'top';
          }
          if (i === 2) { // JPEG 2000：紫色小皇冠
            const cx0 = X0 + (X1 - X0) * VALUES[2][2] - 30;
            const cy0 = laneY - 16;
            ctx.fillStyle = C.purple;
            ctx.beginPath();
            ctx.moveTo(cx0, cy0 + 12);
            ctx.lineTo(cx0 + 5, cy0 + 3);
            ctx.lineTo(cx0 + 10, cy0 + 10);
            ctx.lineTo(cx0 + 15, cy0 + 3);
            ctx.lineTo(cx0 + 20, cy0 + 10);
            ctx.lineTo(cx0 + 25, cy0 + 3);
            ctx.lineTo(cx0 + 30, cy0 + 12);
            ctx.closePath();
            ctx.fill();
            ctx.fillRect(cx0, cy0 + 12, 30, 3);
          }
          ctx.globalAlpha = 1;
        }
      }

      // 奖杯只落在论文数据支持的胜者赛道上
      if (allDone) {
        const w = WINNER[s.metric];
        const barEnd = X0 + (X1 - X0) * (VALUES[s.metric][w] / SCALE[s.metric]);
        const a = clamp((now - s.t0 - raceEnd) / 250, 0, 1);
        ctx.globalAlpha = a;
        drawTrophy(ctx, barEnd + 14, LANE_Y[w] - 40, 0.8);
        ctx.globalAlpha = 1;
      }

      if (started && !s.finished && allDone) {
        s.finished = true;
        setFinished(true);
        setFeedback(FB[s.metric]);
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
    };
  }, []);

  const onStart = () => {
    const s = stateRef.current;
    s.started = true;
    s.t0 = performance.now();
    s.finished = false;
    setFinished(false);
    setFeedback({ text: '三条赛道同时起跑，按选中的指标累积成绩……', cls: '' });
  };

  const onMetric = (next: 0 | 1 | 2) => {
    const s = stateRef.current;
    s.metric = next;
    s.started = false;
    s.t0 = 0;
    s.finished = false;
    setMetric(next);
    setFinished(false);
    setFeedback(PRE_FB);
  };

  return (
    <div>
      <canvas id={`cv-${chapterId}-${moduleId}`} ref={canvasRef} width={W} height={H} />
      <div className="chip-row">
        {METRIC_LABELS.map((t, i) => (
          <button
            key={t}
            type="button"
            className={`chip ${metric === i ? 'selected' : ''}`}
            onClick={() => onMetric(i as 0 | 1 | 2)}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="step-ctrl">
        <button className="tiny" onClick={onStart}>
          {finished ? '重新评审' : '开始评审'}
        </button>
      </div>
      <table className="paper">
        <thead>
          <tr>
            <th>方法</th>
            <th>码率</th>
            <th>PSNR 亮度</th>
            <th>MS-SSIM</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>本文方法</td>
            <td>0.113 bit/px</td>
            <td>27.01 dB</td>
            <td>0.9039</td>
          </tr>
          <tr>
            <td>JPEG</td>
            <td>0.121 bit/px</td>
            <td>24.85 dB</td>
            <td>0.8079</td>
          </tr>
          <tr>
            <td>JPEG 2000</td>
            <td>0.113 bit/px</td>
            <td>26.61 dB</td>
            <td>0.8860</td>
          </tr>
        </tbody>
      </table>
      <div className={`feedback ${feedback.cls}`}>{feedback.text}</div>
    </div>
  );
};

export default Ch10Mod1;
