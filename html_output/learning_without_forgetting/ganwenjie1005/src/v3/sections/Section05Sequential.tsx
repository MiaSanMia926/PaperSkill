import { ChapterNavigation } from "../components/ChapterNavigation";
import { LwfTaskHandoffView } from "../components/LwfTaskHandoffView";
import { getLwfChapter, type LwfChapterId } from "../data/chapters";

const arxivPaperRecord = "https://arxiv.org/abs/1606.09282v3";

export function Section05Sequential({ onOpenReference, onNavigateChapter }: {
  onOpenReference: (termId: string) => void;
  onNavigateChapter: (chapterId: LwfChapterId) => void;
}) {
  const evidenceChapterReady = getLwfChapter("06")?.status === "ready";

  return <section className="v3-narrative-chapter v3-sequential-chapter" id="chapter-05" aria-labelledby="v3-sequential-title">
    <header className="v3-chapter-heading">
      <span className="v3-stage-number">05</span>
      <div><p className="v3-eyebrow">CHAPTER 05 / 08 · SEQUENTIAL TASKS</p><h2 id="v3-sequential-title">Modelₜ₊₁ 如何进入下一任务阶段</h2><p>当前任务训练完成后，最终 Student 成为 Modelₜ₊₁；下一项任务到来后，它只在训练前用于记录该阶段的旧响应。</p></div>
    </header>

    <section className="v3-sequential-block" aria-labelledby="v3-sequence-lifecycle-title">
      <div className="v3-sequential-block-heading"><span>05A · TASK-LEVEL LIFECYCLE</span><h3 id="v3-sequence-lifecycle-title">任务完成后形成 Modelₜ₊₁，再交给下一阶段</h3></div>
      <div className="v3-sequence-timescales" aria-label="区分训练步与任务序列层级">
        <div><span>TRAINING-STEP LEVEL</span><strong>Chapter 03</strong><small>一个 minibatch 中的 Forward → Loss → Backward → Update</small></div>
        <div className="is-current"><span>TASK-SEQUENCE LEVEL</span><strong>Chapter 05</strong><small>一个任务阶段结束后，模型怎样交接到下一任务</small></div>
      </div>
      <LwfTaskHandoffView onOpenReference={onOpenReference} onNavigateChapter={onNavigateChapter} />
    </section>

    <section className="v3-sequential-block" aria-labelledby="v3-refresh-title">
      <div className="v3-sequential-block-heading"><span>05B · RESPONSE TARGET REFRESH</span><h3 id="v3-refresh-title">旧响应目标随阶段重新生成</h3></div>
      <div className="v3-refresh-pair">
        <article><span className="v3-refresh-stage">TASK B STAGE</span><p className="v3-refresh-flow"><b>X<sub>B</sub></b><i aria-hidden="true">→</i><b>Model<sub>A</sub></b><i aria-hidden="true">→</i><b>Y<sub>A</sub><sup>(B)</sup></b></p><small>正式训练前，Model<sub>A</sub> 对 B 阶段输入记录 A 任务响应；Y<sub>A</sub><sup>(B)</sup> 在 B 阶段训练中保持固定。</small></article>
        <article><span className="v3-refresh-stage">TASK C STAGE</span><p className="v3-refresh-flow"><b>X<sub>C</sub></b><i aria-hidden="true">→</i><b>Model<sub>AB</sub></b><i aria-hidden="true">→</i><b>Y<sub>A</sub><sup>(C)</sup>, Y<sub>B</sub><sup>(C)</sup></b></p><small>Task B 完成后的 Model<sub>AB</sub> 在 C 阶段训练前重新记录 A、B 两个旧任务响应。</small></article>
      </div>
      <div className="v3-sequence-drift" aria-label="跨任务阶段的概念性模型演进">
        <span>SEQUENTIAL DRIFT · CONCEPTUAL</span>
        <p>Task A → Model_A → Task B → Model_AB → Task C → Model_ABC</p>
        <small>每阶段先由当前旧模型在新输入上记录固定响应 target；随着共享参数适配，旧任务表现仍可能逐阶段变化。</small>
      </div>
      <p className="v3-refresh-boundary"><strong>不是永久 cache。</strong> Task B 记录的 Y<sub>A</sub><sup>(B)</sup> 不会拿到 Task C 复用：C 阶段使用更新后的 Model<sub>AB</sub>，并在新的 X<sub>C</sub> 上重新记录 Y<sub>A</sub><sup>(C)</sup> 与 Y<sub>B</sub><sup>(C)</sup>；不需要取回旧任务训练图像或标签。</p>
      <div className="v3-sequential-reference-links">
        <button type="button" onClick={() => onOpenReference("sequential-refresh")}>Reference Hub · response refresh ↗</button>
        <button type="button" onClick={() => onOpenReference("figure-4")}>Reference Hub · Figure 4 ↗</button>
      </div>
    </section>

    <section className="v3-sequential-block v3-sequential-evidence" aria-labelledby="v3-figure4-preview-title">
      <div className="v3-sequential-block-heading"><span>05C · PAPER EVIDENCE INDEX</span><h3 id="v3-figure4-preview-title">Figure 4 · 连续加入任务</h3></div>
      <p>论文在 Places365→VOC 与 ImageNet→Indoor Scenes 设置中分批加入任务，观察各任务在多个阶段的表现。这里标出原文位置和证据边界；详细读图留到 Chapter 06。</p>
      <figure className="v3-figure4-preview">
        <div className="v3-figure4-source">
          <span>原文定位 · Figure 4 · 第 8 页</span>
          <strong>连续加入任务后，各阶段的任务表现如何变化？</strong>
          <p>本页不直接展示或重绘论文原图。需要核对原图时，可从 arXiv 论文记录打开。</p>
          <a href={arxivPaperRecord} target="_blank" rel="noreferrer">打开 arXiv 论文记录 ↗</a>
        </div>
        <figcaption>Chapter 06 按论文报告的任务设置、曲线含义和结论边界逐项说明。</figcaption>
      </figure>
      <div className="v3-figure4-actions">
        <p>连续加入任务后，旧任务表现仍可能下降；该图不表示退化必然单调或完全避免。</p>
        <button type="button" disabled={!evidenceChapterReady} onClick={() => evidenceChapterReady && onNavigateChapter("06")}>在 Chapter 06 查看完整证据 →</button>
      </div>
    </section>

    <ChapterNavigation chapterId="05" onNavigate={onNavigateChapter} />
  </section>;
}
