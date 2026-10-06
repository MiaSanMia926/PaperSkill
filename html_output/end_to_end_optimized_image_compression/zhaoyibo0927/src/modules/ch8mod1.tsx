import React, { useEffect, useRef, useState } from 'react';
import { setupCanvas, observeCanvas, clamp } from '../lib/canvasKit';
import type { WidgetProps } from './registry';

// ---------------------------------------------------------------------------
// Tutorial-wide drawing kit — implemented locally (never imported from another
// widget file), verbatim from the photography-practice kit.
// ---------------------------------------------------------------------------
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
  if (desk) {
    ctx.strokeStyle = C.wood; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(0, H - 8); ctx.lineTo(W, H - 8); ctx.stroke();
  }
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

function drawLens(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, highlight = false) {
  ctx.save();
  if (highlight) {
    ctx.beginPath(); ctx.arc(cx, cy, r + 8, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(39,68,110,0.16)';
    ctx.fill();
  }
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(215,222,234,0.45)'; ctx.fill();
  ctx.strokeStyle = C.blue; ctx.lineWidth = 3; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.62, 0, Math.PI * 2);
  ctx.strokeStyle = '#d7deea'; ctx.lineWidth = 3; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.3, 0, Math.PI * 2);
  ctx.strokeStyle = C.blue; ctx.lineWidth = 2; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.84, Math.PI * 1.08, Math.PI * 1.42);
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.stroke();
  ctx.restore();
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

// ---------------------------------------------------------------------------

const W = 1080;
const H = 280;

interface Pt { x: number; y: number }

/* left region (20..420): the lens stack */
const LENSES: { cx: number; cy: number; r: number }[] = [
  { cx: 100, cy: 140, r: 52 },
  { cx: 190, cy: 140, r: 42 },
  { cx: 270, cy: 140, r: 32 },
];
const FILM = { x: 360, y: 118, w: 30, h: 44 };
const RAY: Pt[] = [
  { x: 16, y: 184 },
  { x: 100, y: 140 },
  { x: 190, y: 154 },
  { x: 270, y: 132 },
  { x: 360, y: 140 },
];

/* right region (440..1060): the architecture chain */
interface NodeRect { x: number; y: number; w: number; h: number; text: string; stage: number }

const NODE_W = 82;
const NODE_H = 34;
const NODE_GAP = 6;
const CHAIN_X = 446;
const ROW_A_Y = 75;
const ROW_S_Y = 183;

const A_NODES: { text: string; stage: number }[] = [
  { text: '卷积9×9×128', stage: 0 },
  { text: '↓4', stage: 1 },
  { text: 'GDN', stage: 2 },
  { text: '卷积5×5×128', stage: 0 },
  { text: '↓2', stage: 1 },
  { text: 'GDN', stage: 2 },
  { text: 'y48×48×128', stage: 3 },
];
const S_NODES: { text: string; stage: number }[] = [
  { text: 'IGDN', stage: 4 },
  { text: '↑2', stage: 4 },
  { text: '卷积', stage: 4 },
  { text: '…', stage: 4 },
  { text: 'x̂', stage: 4 },
];

const NODE_RECTS: NodeRect[] = [
  ...A_NODES.map((n, i) => ({
    x: CHAIN_X + i * (NODE_W + NODE_GAP), y: ROW_A_Y, w: NODE_W, h: NODE_H, text: n.text, stage: n.stage,
  })),
  ...S_NODES.map((n, i) => ({
    x: CHAIN_X + i * (NODE_W + NODE_GAP), y: ROW_S_Y, w: NODE_W, h: NODE_H, text: n.text, stage: n.stage,
  })),
];

const STAGE_LENSES: number[][] = [[0], [1], [2], [], [0, 1, 2]];
const STAGE_SEGS: number[][] = [[0], [1], [2], [3], [0, 1, 2, 3]];

const STAGES: string[] = ['第1级 卷积', '下采样', 'GDN', '量化 ŷ', '合成端'];

const DETAIL: string[] = [
  '第 1 级卷积：128 个 9×9 滤波器，输入 1 通道（灰度）。',
  '下采样：每维缩小 4 倍（第 1 级）或 2 倍（第 2、3 级），码率随之下降。',
  'GDN：除法归一化（第 3 章），把局部统计高斯化。',
  '量化 ŷ = round(y)：连续码取整，唯一的信息损失点。',
  '合成端：IGDN → 上采样 → 卷积，与分析端互为镜像（参数 θ 独立学习）。',
];

const FEEDBACK: { text: string; cls: string }[] = [
  { text: '卷积是仿射变换 v = H·u + c，负责提取特征。', cls: '' },
  { text: '下采样把表示一步步缩小——三次下采样后，码空间维度是输入的一半。', cls: '' },
  { text: 'GDN 在训练后保持非线性，空间自适应地压制高能量区域。', cls: '' },
  { text: '量化不可导，训练时的松弛方案见第 7 章。', cls: '' },
  { text: 'IGDN 用同样参数近似还原 GDN，配合上采样把尺寸一步步还回去。', cls: '' },
];

function hitStage(rects: NodeRect[], px: number, py: number): number {
  let best = -1;
  let bestD = 7;
  for (const r of rects) {
    const dx = Math.max(r.x - px, 0, px - (r.x + r.w));
    const dy = Math.max(r.y - py, 0, py - (r.y + r.h));
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d <= 6 && d < bestD) {
      bestD = d;
      best = r.stage;
    }
  }
  return best;
}

function drawOptics(ctx: CanvasRenderingContext2D, sel: number) {
  // faint full light path, so the stack reads as one optical system
  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.strokeStyle = C.orange; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(RAY[0].x, RAY[0].y);
  for (let i = 1; i < RAY.length; i++) ctx.lineTo(RAY[i].x, RAY[i].y);
  ctx.stroke();
  ctx.restore();

  for (let i = 0; i < LENSES.length; i++) {
    const l = LENSES[i];
    drawLens(ctx, l.cx, l.cy, l.r, STAGE_LENSES[sel].indexOf(i) >= 0);
  }

  // film plane: light lands here (the quantized code)
  ctx.fillStyle = C.ink;
  ctx.fillRect(FILM.x, FILM.y, FILM.w, FILM.h);
  ctx.strokeStyle = C.wood; ctx.lineWidth = 2;
  ctx.strokeRect(FILM.x, FILM.y, FILM.w, FILM.h);

  // the light-path segment that belongs to the selected stage
  ctx.save();
  ctx.strokeStyle = C.orange; ctx.lineWidth = 3; ctx.lineCap = 'round';
  for (const s of STAGE_SEGS[sel]) {
    ctx.beginPath();
    ctx.moveTo(RAY[s].x, RAY[s].y);
    ctx.lineTo(RAY[s + 1].x, RAY[s + 1].y);
    ctx.stroke();
  }
  ctx.restore();

  // blue pulse on whatever the selected stage highlights
  const pulse = clamp(0.5 + 0.4 * Math.sin((performance.now() / 1000) * 5), 0, 1);
  ctx.save();
  ctx.globalAlpha = pulse;
  ctx.strokeStyle = C.blue; ctx.lineWidth = 5;
  for (const i of STAGE_LENSES[sel]) {
    ctx.beginPath();
    ctx.arc(LENSES[i].cx, LENSES[i].cy, LENSES[i].r + 5, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (sel === 3) ctx.strokeRect(FILM.x - 5, FILM.y - 5, FILM.w + 10, FILM.h + 10);
  ctx.restore();
}

function drawNode(ctx: CanvasRenderingContext2D, n: NodeRect, selected: boolean) {
  roundRect(ctx, n.x, n.y, n.w, n.h, 8);
  ctx.fillStyle = selected ? C.blue : C.bg;
  ctx.fill();
  ctx.strokeStyle = C.blue; ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = selected ? '#ffffff' : C.ink;
  ctx.font = `${n.text.length > 5 ? 11 : 12}px "Segoe UI", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(n.text, n.x + n.w / 2, n.y + n.h / 2 + 1);
  ctx.textAlign = 'start';
  ctx.textBaseline = 'top';
}

function drawChain(ctx: CanvasRenderingContext2D, sel: number) {
  // y -> IGDN connector
  ctx.strokeStyle = C.orange; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(1015, ROW_A_Y + NODE_H);
  ctx.lineTo(1015, 140);
  ctx.lineTo(427, 140);
  ctx.lineTo(427, ROW_S_Y + NODE_H / 2);
  ctx.lineTo(438, ROW_S_Y + NODE_H / 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(444, ROW_S_Y + NODE_H / 2);
  ctx.lineTo(436, ROW_S_Y + NODE_H / 2 - 5);
  ctx.moveTo(444, ROW_S_Y + NODE_H / 2);
  ctx.lineTo(436, ROW_S_Y + NODE_H / 2 + 5);
  ctx.stroke();

  for (const n of NODE_RECTS) drawNode(ctx, n, n.stage === sel);
}

// ---------------------------------------------------------------------------

export const Ch8Mod1: React.FC<WidgetProps> = ({ chapterId, moduleId }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const stateRef = useRef({ sel: 0 });
  const rectsRef = useRef<NodeRect[]>(NODE_RECTS);
  const [sel, setSel] = useState(0);
  const [detail, setDetail] = useState(DETAIL[0]);
  const [feedback, setFeedback] = useState(FEEDBACK[0]);

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
      sceneBg(ctx, W, H);
      drawOptics(ctx, s.sel);
      label(ctx, '编码端', CHAIN_X, 44, C.muted, 16);
      label(ctx, '解码端', CHAIN_X, 156, C.muted, 16);
      drawChain(ctx, s.sel);
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

  const choose = (next: number) => {
    stateRef.current.sel = next;
    setSel(next);
    setDetail(DETAIL[next]);
    setFeedback(FEEDBACK[next]);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) * W) / rect.width;
    const y = ((e.clientY - rect.top) * H) / rect.height;
    const stage = hitStage(rectsRef.current, x, y);
    if (stage >= 0) choose(stage);
  };

  return (
    <div>
      <canvas
        id={`cv-${chapterId}-${moduleId}`}
        ref={canvasRef}
        width={W}
        height={H}
        onPointerDown={onPointerDown}
      />
      <div className="chip-row">
        {STAGES.map((name, i) => (
          <button
            key={name}
            type="button"
            className={`chip${sel === i ? ' selected' : ''}`}
            onClick={() => choose(i)}
          >
            {name}
          </button>
        ))}
      </div>
      <div className="hotspot-info">{detail}</div>
      <div className={`feedback ${feedback.cls}`}>{feedback.text}</div>
    </div>
  );
};

export default Ch8Mod1;
