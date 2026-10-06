import { useState } from "react";
import { AlexNetArchitecture } from "../../components/AlexNetArchitecture";
import { TermRef } from "../../shared/core/reference";
import { termsById } from "../data/references";

type ArchitectureMode = "teacher" | "student";
type ParameterNode = "theta_s" | "theta_o" | "theta_n";

const parameterDetails: Record<ParameterNode, { title: string; body: string; termId: string; source: string }> = {
  theta_s: {
    title: "θₛ · 共享参数",
    body: "AlexNet 的 conv1–5、fc6 与 fc7 构成共享主体。固定旧模型只在训练前记录 Yₒ；Student 的 θₛ 在联合优化阶段可训练。",
    termId: "theta-s",
    source: "共享主体 · A01 / A05",
  },
  theta_o: {
    title: "θₒ · 旧任务 head",
    body: "固定旧模型的 θₒ 在正式训练前用于计算并记录 Yₒ；Student 保留 fc8_old 产生 Ŷₒ，联合阶段 θₒ 可训练。",
    termId: "theta-o",
    source: "旧任务输出参数 · A02 / A05",
  },
  theta_n: {
    title: "θₙ · 新任务 head",
    body: "fc8_new 从共享表示分出并输出 Ŷₙ。Warm-up 只训练 θₙ；进入联合优化后 θₙ 继续可训练。",
    termId: "theta-n",
    source: "新任务输出参数 · A03 / A05",
  },
};

const termIdByParameter: Record<ParameterNode, string> = {
  theta_s: "theta-s",
  theta_o: "theta-o",
  theta_n: "theta-n",
};

export function LwfArchitectureView({ onOpenReference }: { onOpenReference: (termId: string) => void }) {
  const [mode, setMode] = useState<ArchitectureMode>("student");
  const [selected, setSelected] = useState<ParameterNode>("theta_s");
  const info = parameterDetails[selected];

  return <div className="v3-alexnet-shell">
    <header className="v3-architecture-switch">
      <div><p className="v3-eyebrow">OLD MODEL → EXPANDED STUDENT</p><strong>切换同一张 AlexNet 图，查看参数边界如何变化</strong></div>
      <div role="group" aria-label="选择模型视图" className="v3-architecture-switch-options">
        <button type="button" aria-pressed={mode === "teacher"} onClick={() => setMode("teacher")}>Teacher</button>
        <button type="button" aria-pressed={mode === "student"} onClick={() => setMode("student")}>Student</button>
      </div>
    </header>

    <AlexNetArchitecture
      compact
      boundary="fc7"
      inputSymbol="Xₙ"
      mode={mode}
      showNewHead={mode === "student"}
      parameterState={mode === "teacher" ? "frozen" : "trainable"}
      sharedState={mode === "teacher" ? "θₛ · FROZEN" : "θₛ · JOINT-TRAINABLE"}
      oldState={mode === "teacher" ? "θₒ · FROZEN · Yₒ source" : "θₒ · JOINT-TRAINABLE"}
      newState="θₙ · WARM-UP / JOINT-TRAINABLE"
      onInspect={(id) => setSelected(id as ParameterNode)}
    />

    <aside className="v3-architecture-inspector" aria-live="polite" aria-label="AlexNet 参数说明">
      <div><p className="v3-eyebrow">SELECTED PARAMETER · {mode === "teacher" ? "TEACHER" : "STUDENT"}</p><h3>{info.title}</h3><p>{info.body}</p></div>
      <div className="v3-inspector-reference"><span>{info.source}</span><span>参数状态 · {mode === "teacher" ? "FROZEN" : selected === "theta_n" ? "Warm-up trainable · Joint trainable" : "Warm-up frozen · Joint trainable"}</span><TermRef term={termsById[termIdByParameter[selected]]} onOpenReference={onOpenReference} /></div>
    </aside>
    <section className="v3-parameter-phase-matrix" aria-label="Teacher、Warm-up 与联合优化的参数状态">
      <p className="v3-eyebrow">PARAMETER STATE BY PHASE</p>
      <div>
        <article><strong>Modelₜ · response recording</strong><span>θₛ frozen · θₒ frozen</span><small>只用于训练前记录 Yₒ；记录完成后退出训练循环。</small></article>
        <article><strong>Student · Warm-up</strong><span>θₛ frozen · θₒ frozen · θₙ trainable</span><small>只训练新任务 head。</small></article>
        <article><strong>Student · Joint optimization</strong><span>θₛ trainable · θₒ trainable · θₙ trainable</span><small>训练循环读取固定 Yₒ，不再运行旧模型。</small></article>
      </div>
    </section>
  </div>;
}
