import { ChapterNavigation } from "../components/ChapterNavigation";
import { LwfGrandTrail } from "../components/LwfGrandTrail";
import type { LwfChapterId } from "../data/chapters";

export function Section07Replay({ onOpenReference, onNavigateChapter }: {
  onOpenReference: (termId: string) => void;
  onNavigateChapter: (chapterId: LwfChapterId) => void;
}) {
  return <section className="v3-narrative-chapter v3-replay-chapter" id="chapter-07" aria-labelledby="v3-replay-title">
    <header className="v3-chapter-heading">
      <span className="v3-stage-number">07</span>
      <div><p className="v3-eyebrow">CHAPTER 07 / 08 · MODEL LINEAGE</p><h2 id="v3-replay-title">沿着模型轨迹，走完一次 LwF 生命周期</h2><p>从旧模型与新任务输入开始，跟随 Student 完成任务训练；下一任务到来后，再为新输入记录固定旧响应。</p></div>
    </header>

    <section className="v3-replay-block" aria-labelledby="v3-replay-block-title">
      <div className="v3-replay-block-heading"><span>07A · GRAND TRAIL</span><h3 id="v3-replay-block-title">九个检查点，追踪模型如何交接到下一任务</h3><p>选择节点查看输入、输出与参数状态，也可以单次播放整条轨迹；联合训练中的 minibatch 顺序仍由 Chapter 03 解释。</p></div>
      <LwfGrandTrail onOpenReference={onOpenReference} onNavigateChapter={onNavigateChapter} />
    </section>

    <section className="v3-replay-takeaways" aria-labelledby="v3-replay-takeaways-title">
      <div className="v3-replay-block-heading"><span>FINAL MENTAL MODEL</span><h3 id="v3-replay-takeaways-title">离开前记住这八件事</h3></div>
      <ol>
        <li>旧训练数据不可用，但旧模型仍可用。</li>
        <li>正式训练前，Modelₜ 只负责在当前新任务输入 Xₙ 上记录 Yₒ；训练期间 Student 读取固定 target。</li>
        <li>Student 保留共享主体和旧 head，并增加新 head θₙ。</li>
        <li>训练 Forward 使用 Student(Xₙ) 产生 Ŷₒ、Ŷₙ；固定 Yₒ 与 Ŷₒ 形成 L_old，Yₙ 与 Ŷₙ 形成 L_new。</li>
        <li>Warm-up 只训练 θₙ；联合优化时 θₛ、θₒ、θₙ 可训练，训练循环不再运行旧模型。</li>
        <li>Backward 计算梯度，Optimizer Step 才更新参数；单次 Student^(k) → Student^(k+1) 不代表任务已结束。</li>
        <li>Task t+1 完成后 Student* 才成为 Modelₜ₊₁；Task t+2 到来后，它在正式训练前为新输入记录新的 Yₒ。</li>
        <li>Yₒ 是旧模型对当前 Xₙ 的响应目标，不是旧任务真值标签、旧数据样本或 replay sample。</li>
      </ol>
    </section>

    <ChapterNavigation chapterId="07" onNavigate={onNavigateChapter} />
  </section>;
}
