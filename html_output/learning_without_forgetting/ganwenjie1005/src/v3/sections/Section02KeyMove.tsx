import { TermRef } from "../../shared/core/reference";
import { ChapterNavigation } from "../components/ChapterNavigation";
import { NarrativeStep } from "../components/NarrativeStep";
import type { LwfChapterId } from "../data/chapters";
import { keyMoveSteps } from "../data/process";
import { termsById } from "../data/references";

export function Section02KeyMove({ activeStepId, onOpenReference, onSelectStep, onNavigateChapter }: { activeStepId: string | null; onOpenReference: (termId: string) => void; onSelectStep: (stepId: string) => void; onNavigateChapter: (chapterId: LwfChapterId) => void }) {
  return <section className="v3-narrative-chapter v3-key-move" id="chapter-02" aria-labelledby="v3-key-move-title">
    <header className="v3-chapter-heading">
      <span className="v3-stage-number">02</span>
      <div><p className="v3-eyebrow">CHAPTER 02 / 08 · KEY MOVE</p><h2 id="v3-key-move-title">用当前输入生成旧任务目标</h2><p>旧数据不可访问，但旧模型仍能运行。</p></div>
    </header>
    <div className="v3-narrative-list">
      {keyMoveSteps.map((step, index) => <NarrativeStep key={step.id} id={step.id} index={index + 1} title={step.title} active={activeStepId === step.id} onSelect={onSelectStep}
        description={step.id === "key-new-task" ? <>旧任务训练样本不可用；当前批次提供 <TermRef term={termsById.xn} onOpenReference={onOpenReference} /> 与 <TermRef term={termsById.yn} onOpenReference={onOpenReference} />。</>
          : step.id === "key-generate-response" ? <>正式训练前，把 <TermRef term={termsById.xn} onOpenReference={onOpenReference} /> 输入固定 Modelₜ，记录 <TermRef term={termsById.yo} onOpenReference={onOpenReference} /> 作为固定 target。</>
            : step.description}>
      {step.id === "key-generate-response" ? <p className="v3-narrative-note">正式训练前，固定 Modelₜ 对当前 Xₙ 计算并记录 Yₒ；之后 Yₒ 是固定 target。新增 θₙ 也是训练前准备，与记录 Yₒ 没有严格的先后依赖。Yₒ 不是旧任务真值标签、旧样本或 replay sample。</p> : null}
        {step.id === "key-expand-student" ? <p className="v3-narrative-note"><TermRef term={termsById["theta-s"]} onOpenReference={onOpenReference} /> 是共享主体；<TermRef term={termsById["theta-o"]} onOpenReference={onOpenReference} /> 保留旧输出；新增 <TermRef term={termsById["theta-n"]} onOpenReference={onOpenReference} /> 学习新任务。</p> : null}
      </NarrativeStep>)}
    </div>
    <ChapterNavigation chapterId="02" onNavigate={onNavigateChapter} />
  </section>;
}
