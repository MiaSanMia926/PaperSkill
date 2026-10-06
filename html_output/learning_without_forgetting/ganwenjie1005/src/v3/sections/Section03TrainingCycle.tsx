import { TermRef } from "../../shared/core/reference";
import { ChapterNavigation } from "../components/ChapterNavigation";
import { NarrativeStep } from "../components/NarrativeStep";
import { ReplayControl } from "../components/ReplayControl";
import type { LwfChapterId } from "../data/chapters";
import { trainingSteps } from "../data/process";
import { termsById } from "../data/references";

export function Section03TrainingCycle({ activeStepId, onOpenReference, onSelectStep, onNavigateChapter }: {
  activeStepId: string | null;
  onOpenReference: (termId: string) => void;
  onSelectStep: (stepId: string) => void;
  onNavigateChapter: (chapterId: LwfChapterId) => void;
}) {
  return <section className="v3-narrative-chapter v3-training-cycle" id="chapter-03" aria-labelledby="v3-training-title">
    <header className="v3-chapter-heading">
      <span className="v3-stage-number">03</span>
      <div><p className="v3-eyebrow">CHAPTER 03 / 08 · ONE TRAINING CYCLE</p><h2 id="v3-training-title">两项损失，更新同一个 Student</h2><p>目标提供梯度；Optimizer Step 才真正改变参数。</p></div>
    </header>
    <div className="v3-narrative-list">
      {trainingSteps.map((step, index) => <NarrativeStep key={step.id} id={step.id} index={index + 4} title={step.title} description={step.description} active={activeStepId === step.id} onSelect={onSelectStep}>
        {step.id === "cycle-warmup" ? <>
          <p className="v3-parameter-state"><span>θₛ <b>冻结</b></span><span>θₒ <b>冻结</b></span><span>θₙ <b>可训练</b></span></p>
          <p className="v3-narrative-note">Warm-up 是论文采用的训练策略，不是 LwF 保持旧响应的核心机制；Table 2(b) 指出它对 LwF 并非关键。</p>
        </> : null}
        {step.id === "cycle-forward" ? <p className="v3-narrative-note">读取训练前已记录的固定 Yₒ；本次训练 Forward 只让 Student 对 Xₙ 计算 Ŷₒ 与 Ŷₙ，不再调用 Teacher。</p> : null}
        {step.id === "cycle-old-loss" ? <p className="v3-narrative-note"><TermRef term={termsById.yo} onOpenReference={onOpenReference} /> 与 <TermRef term={termsById["yhat-o"]} onOpenReference={onOpenReference} /> 比较，形成旧响应保持项。</p> : null}
        {step.id === "cycle-new-loss" ? <p className="v3-narrative-note"><TermRef term={termsById.yn} onOpenReference={onOpenReference} /> 只监督 Student 的新任务输出 <TermRef term={termsById["yhat-n"]} onOpenReference={onOpenReference} />。</p> : null}
        {step.id === "cycle-backward" ? <>
          <p className="v3-gradient-note">L_old → θₒ → θₛ <span>·</span> L_new → θₙ → θₛ</p>
          <p className="v3-parameter-state"><strong>JOINT · 可训练参数</strong><span>θₛ <b>ACTIVE</b></span><span>θₒ <b>ACTIVE</b></span><span>θₙ <b>ACTIVE</b></span><span>Yₒ <b>FIXED TARGET</b></span></p>
        </> : null}
        {step.id === "cycle-update" ? <>
          <div className="v3-objective-line"><span>联合目标</span><strong>L = λₒ L_old + L_new + R</strong></div>
          <p className="v3-narrative-note"><TermRef term={termsById["lambda-o"]} onOpenReference={onOpenReference} /> 调整旧响应项权重；R 是常规正则项。Backward 只计算梯度，Optimizer Step 才更新 θₛ、θₒ、θₙ；Student^(k) → Student^(k+1) 只是当前任务中的一次迭代。</p>
          <ReplayControl onSelectStep={onSelectStep} />
        </> : null}
      </NarrativeStep>)}
    </div>
    <ChapterNavigation chapterId="03" onNavigate={onNavigateChapter} />
  </section>;
}
