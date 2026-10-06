import { useId, useState } from "react";

type PreservationMode = "parameters" | "responses";

export function PreservationCompare() {
  const [mode, setMode] = useState<PreservationMode>("responses");
  const titleId = useId();
  const isResponses = mode === "responses";

  return <div className="v3-preservation-compare">
    <div className="v3-compact-toggle" role="group" aria-label="选择保持对象">
      <button type="button" aria-pressed={!isResponses} onClick={() => setMode("parameters")}>Parameter view</button>
      <button type="button" aria-pressed={isResponses} onClick={() => setMode("responses")}>Response view</button>
    </div>
    <figure className="v3-preservation-figure" aria-labelledby={titleId}>
      <div className="v3-preservation-stage">
      <div className={`v3-preservation-panel ${isResponses ? "is-active" : "is-inactive"}`} aria-hidden={!isResponses}>
        <div className="v3-response-comparison" role="img" aria-label="固定旧模型在训练前为当前输入 Xn 记录 Yo；训练中的 Current Student 产生 Yhat-o，与固定 target 比较">
        <div className="v3-preservation-input"><strong>Xₙ</strong><span>当前任务输入</span></div>
        <div className="v3-preservation-branches">
          <div className="v3-preservation-branch is-teacher"><span className="v3-preservation-arrow" aria-hidden="true">→</span><div><strong>Frozen Modelₜ</strong><small>训练前记录固定 target</small></div><span className="v3-preservation-arrow" aria-hidden="true">→</span><b>Yₒ</b></div>
          <div className="v3-preservation-branch is-student"><span className="v3-preservation-arrow" aria-hidden="true">→</span><div><strong>Current Student</strong><small>训练中 · 可更新</small></div><span className="v3-preservation-arrow" aria-hidden="true">→</span><b>Ŷₒ</b></div>
          <div className="v3-response-match"><span aria-hidden="true">↕</span>比较同一输入上的旧任务输出</div>
        </div>
        </div>
      </div>
      <div className={`v3-preservation-panel ${!isResponses ? "is-active" : "is-inactive"}`} aria-hidden={isResponses}>
        <div className="v3-parameter-comparison" role="img" aria-label="Parameter-L2 baseline 比较旧共享参数向量 w₀ 与当前共享参数向量 w 的距离">
        <div className="v3-parameter-point"><strong>w₀</strong><span>原始共享参数向量</span></div>
        <div className="v3-parameter-distance"><span aria-hidden="true">↔</span><b>parameter distance</b></div>
        <div className="v3-parameter-point is-current"><strong>w</strong><span>当前共享参数向量</span></div>
        </div>
      </div>
      </div>
      <figcaption id={titleId} aria-live="polite">{isResponses ? "关注同一输入上的旧任务响应是否接近。" : "Parameter-L2 baseline 约束当前共享参数向量 w 靠近原始共享参数 w₀。"}</figcaption>
    </figure>
    <p className="v3-mechanism-takeaway">LwF 直接约束当前可观察输入上的旧任务响应；它不要求 Student 参数停在旧坐标附近。</p>
  </div>;
}
