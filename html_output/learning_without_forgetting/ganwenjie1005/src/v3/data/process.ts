import type { FlowStep } from "../../shared/core/flow-stepper";
import type { ProcessLoopSpec } from "../../shared/core/process-loop";
import type { StickySection } from "../../shared/foundation/layout/StickySystemView";

export const keyMoveSteps: FlowStep[] = [
  { id: "key-new-task", title: "新任务到来", description: "旧任务数据不可访问；当前 Xₙ、Yₙ 与 Modelₜ 可用。", relatedIds: ["xn", "new-label", "teacher"] },
  { id: "key-generate-response", title: "记录旧响应", description: "正式训练前，在固定 Modelₜ 上计算并记录 Yₒ；之后把 Yₒ 作为固定 target。", relatedIds: ["xn", "teacher", "yo"] },
  { id: "key-expand-student", title: "扩展 Student", description: "保留共享参数 θₛ 与旧 head θₒ，并增加随机初始化的新任务 head θₙ。", relatedIds: ["student", "theta-s", "old-branch", "new-branch"] },
];

export const trainingSteps: FlowStep[] = [
  { id: "cycle-warmup", title: "Warm-up", description: "Xₙ 经过冻结的 θₛ；只用 Yₙ 形成 L_new 训练 θₙ。已记录的 Yₒ 暂不使用，θₒ 也保持冻结。", relatedIds: ["xn", "new-label", "new-branch", "loss-new"] },
  { id: "cycle-forward", title: "Forward", description: "读取已记录的固定 Yₒ；当前 Student 对 Xₙ 前向，产生 Ŷₒ 与 Ŷₙ。", relatedIds: ["student", "yo", "old-branch", "new-branch"] },
  { id: "cycle-old-loss", title: "旧响应损失", description: "比较已记录的固定 Yₒ 与 Student 的 Ŷₒ，得到 L_old。", relatedIds: ["yo", "old-branch", "loss-old"] },
  { id: "cycle-new-loss", title: "新任务损失", description: "用新任务标签 Yₙ 监督 Student 的 Ŷₙ，得到 L_new。", relatedIds: ["new-label", "new-branch", "loss-new"] },
  { id: "cycle-backward", title: "Backward", description: "L_old → θₒ → θₛ；L_new → θₙ → θₛ。联合阶段 θₛ、θₒ、θₙ 都可训练。", relatedIds: ["loss-old", "loss-new", "theta-s", "old-branch", "new-branch"] },
  { id: "cycle-update", title: "Optimizer Step", description: "将梯度应用到 θₛ、θₒ、θₙ，执行 Student^(k) → Student^(k+1)；当前任务仍在训练中。", relatedIds: ["objective", "optimizer", "updated-student"] },
];

export const processSyncSections: StickySection[] = [...keyMoveSteps, ...trainingSteps].map(({ id }) => ({ id, stepId: id }));

export const lwfProcess: ProcessLoopSpec = {
  nodes: [
    { id: "xn", label: "Xₙ", kind: "input", group: "当前任务输入", description: "正式训练前输入固定旧模型以记录 Yₒ；训练时输入当前 Student。", position: { x: 130, y: 85 } },
    { id: "teacher", label: "Modelₜ", kind: "module", group: "Response source · before training", description: "固定旧模型只在正式训练前对当前 Xₙ 计算并记录 Yₒ；记录完成后，训练步骤不再调用它。", position: { x: 410, y: 85 } },
    { id: "yo", label: "Yₒ · fixed target", kind: "output", group: "Recorded old response", description: "旧模型在 joint optimization 前对当前任务输入 Xₙ 产生并记录的响应；训练期间不再由 Teacher 逐 minibatch 生成。", position: { x: 690, y: 85 } },
    { id: "student", label: "Current Student · θₛ", kind: "module", group: "Trainable Student", description: "当前可训练 Student 的共享表示；联合优化中 θₛ、θₒ、θₙ 都参与参数更新。", position: { x: 130, y: 235 } },
    { id: "old-branch", label: "θₒ → Ŷₒ", kind: "parameter", group: "Current Student", description: "Student 的旧任务 head；Warm-up 冻结，联合优化时可训练。", position: { x: 410, y: 235 } },
    { id: "loss-old", label: "L_old", kind: "loss", group: "目标", description: "使 Student 的旧任务输出匹配训练前已记录的固定 Yₒ。", position: { x: 690, y: 235 } },
    { id: "new-label", label: "Yₙ", kind: "input", group: "当前任务监督", description: "当前任务的真实标签，只监督新任务输出。", position: { x: 130, y: 385 } },
    { id: "new-branch", label: "θₙ → Ŷₙ", kind: "parameter", group: "Current Student", description: "新初始化的任务 head；Warm-up 单独训练，联合优化时仍可训练。", position: { x: 410, y: 385 } },
    { id: "loss-new", label: "L_new", kind: "loss", group: "目标", description: "用新任务标签 Yₙ 监督 Student 的新任务输出。", position: { x: 690, y: 385 } },
    { id: "objective", label: "L = λₒL_old + L_new + R", kind: "loss", group: "优化", description: "旧响应保持、新任务学习与普通正则项组成训练目标。", position: { x: 130, y: 535 } },
    { id: "optimizer", label: "Optimizer Step", kind: "state", group: "优化", description: "把反向传播得到的梯度应用到当前允许更新的参数。", position: { x: 410, y: 535 } },
    { id: "updated-student", label: "Student^(k+1)", kind: "output", group: "当前任务中的一次更新", description: "optimizer.step() 将当前梯度应用后得到的 Student；整个 Task t+1 训练尚未完成。", position: { x: 690, y: 535 } },
  ],
  edges: [
    { id: "xn-teacher", from: "xn", to: "teacher", kind: "data", label: "当前输入" },
    { id: "teacher-yo", from: "teacher", to: "yo", kind: "data", label: "训练前记录 Yₒ" },
    { id: "xn-student", from: "xn", to: "student", kind: "data", label: "同一批输入" },
    { id: "student-old", from: "student", to: "old-branch", kind: "data", label: "共享表示" },
    { id: "student-new", from: "student", to: "new-branch", kind: "data", label: "共享表示" },
    { id: "yo-old-loss", from: "yo", to: "loss-old", kind: "data", label: "固定 target", path: "orthogonal" },
    { id: "old-output-loss", from: "old-branch", to: "loss-old", kind: "data", label: "Student output" },
    { id: "label-new-loss", from: "new-label", to: "loss-new", kind: "data", label: "新任务真值", path: "orthogonal" },
    { id: "new-output-loss", from: "new-branch", to: "loss-new", kind: "data", label: "Student output" },
    { id: "loss-old-objective", from: "loss-old", to: "objective", kind: "data", label: "旧行为保持" },
    { id: "loss-new-objective", from: "loss-new", to: "objective", kind: "data", label: "新任务学习" },
    { id: "old-loss-head-gradient", from: "loss-old", to: "old-branch", kind: "gradient", direction: "forward", label: "L_old → θₒ" },
    { id: "old-head-shared-gradient", from: "student", to: "old-branch", kind: "gradient", direction: "reverse", label: "θₒ → θₛ" },
    { id: "new-loss-head-gradient", from: "loss-new", to: "new-branch", kind: "gradient", direction: "forward", label: "L_new → θₙ" },
    { id: "new-head-shared-gradient", from: "student", to: "new-branch", kind: "gradient", direction: "reverse", label: "θₙ → θₛ" },
    { id: "objective-optimizer", from: "objective", to: "optimizer", kind: "control", label: "计算梯度后" },
    { id: "optimizer-updated-student", from: "optimizer", to: "updated-student", kind: "control", label: "应用梯度" },
  ],
  steps: [
    {
      id: "key-new-task", title: "新任务到来", summary: "旧训练数据不可用；新任务提供 Xₙ、Yₙ，Modelₜ 仍可访问。",
      activeNodes: ["xn", "teacher", "new-label"], activeEdges: [],
      annotations: [{ target: "xn", text: "当前输入和标签可用；Modelₜ 仍保留旧任务行为。" }],
      detail: { title: "当前阶段可用的信息", bullets: ["当前新任务输入 Xₙ 与标签 Yₙ 可用。", "旧任务训练图像与标签不可用。", "训练前仍可运行上一阶段模型 Modelₜ。"] },
    },
    {
      id: "key-generate-response", title: "记录旧响应", summary: "正式训练前，把 Xₙ 输入固定 Modelₜ 并记录 Yₒ。",
      activeNodes: ["xn", "teacher", "yo"], activeEdges: ["xn-teacher", "teacher-yo"],
      annotations: [{ target: "yo", text: "Yₒ 已记录；它是训练时使用的固定旧响应 target。" }],
      detail: { title: "Yₒ 的来源与状态", bullets: ["它是固定旧模型对当前新任务输入 Xₙ 的响应。", "在 Student 正式训练前计算并记录；之后作为固定 target。", "新增 θₙ 也属于训练前准备，两者没有严格的先后依赖。", "不是旧任务真值标签、旧数据样本或 replay sample。"] },
    },
    {
      id: "key-expand-student", title: "扩展 Student", summary: "建立可训练的 Student，并增加新任务 head θₙ。",
      activeNodes: ["student", "old-branch", "new-branch"], activeEdges: ["student-old", "student-new"],
      annotations: [{ target: "new-branch", text: "新任务 head θₙ 加入 Student。" }],
      detail: { title: "Student 的结构", bullets: ["θₛ 是共享参数。", "θₒ 负责旧任务输出。", "θₙ 负责新任务输出。"] },
    },
    {
      id: "cycle-warmup", title: "Warm-up", summary: "只用新任务监督训练 θₙ；固定 Yₒ 暂不参与。",
      activeNodes: ["xn", "new-label", "new-branch", "loss-new"], activeEdges: ["xn-student", "student-new", "label-new-loss", "new-output-loss"],
      annotations: [
        { target: "student", text: "θₛ 冻结；仅用于前向提取表示。" },
        { target: "new-branch", text: "只有新 head θₙ 可训练。" },
        { target: "loss-new", text: "Yₙ → L_new；Yₒ 与 L_old 留到联合优化。" },
      ],
      detail: { title: "Warm-up 的监督与参数状态", bullets: ["Xₙ 经过冻结的共享表示 θₛ。", "Yₙ 与新任务输出形成 L_new。", "只更新 θₙ；θₛ 与 θₒ 保持冻结。", "训练前已记录的 Yₒ 暂不消费，也不计算 L_old；Joint Optimization 才使用它。"] },
    },
    {
      id: "cycle-forward", title: "Forward", summary: "读取已记录的固定 Yₒ；Student 对 Xₙ 前向产生 Ŷₒ 与 Ŷₙ。",
      activeNodes: ["xn", "yo", "student", "old-branch", "new-branch"],
      activeEdges: ["xn-student", "student-old", "student-new"],
      annotations: [{ target: "yo", text: "固定 target · 训练 Forward 不再调用 Teacher。" }],
      detail: { title: "训练中的 Student Forward", bullets: ["Yₒ 已在训练开始前记录，当前直接读取为固定 target。", "Student: Xₙ → θₛ → θₒ / θₙ → Ŷₒ / Ŷₙ。", "旧模型不需要在每个 minibatch 中重新生成 Yₒ。"] },
    },
    {
      id: "cycle-old-loss", title: "旧响应损失", summary: "已记录的固定 Yₒ 与 Student 的 Ŷₒ 一起形成 L_old。",
      activeNodes: ["yo", "old-branch", "loss-old"], activeEdges: ["yo-old-loss", "old-output-loss"],
      annotations: [{ target: "loss-old", text: "Student 的旧任务输出要匹配预先记录的固定 Yₒ。" }],
      detail: { title: "旧任务保持", bullets: ["Yₒ 是训练前记录的固定软响应目标。", "Ŷₒ 是 Student 当前 Forward 的旧任务输出。"] },
    },
    {
      id: "cycle-new-loss", title: "新任务损失", summary: "真实标签 Yₙ 监督 Student 的新任务输出 Ŷₙ。",
      activeNodes: ["new-label", "new-branch", "loss-new"], activeEdges: ["label-new-loss", "new-output-loss"],
      annotations: [{ target: "loss-new", text: "新任务真值只监督新任务输出。" }],
      detail: { title: "新任务学习", bullets: ["Yₙ 来自当前新任务数据。", "Ŷₙ 是 Student 的新任务预测。"] },
    },
    {
      id: "cycle-backward", title: "Backward", summary: "L_old → θₒ → θₛ；L_new → θₙ → θₛ。联合阶段 θₛ、θₒ、θₙ 都可训练。",
      activeNodes: ["loss-old", "loss-new", "student", "old-branch", "new-branch"],
      activeEdges: ["old-loss-head-gradient", "old-head-shared-gradient", "new-loss-head-gradient", "new-head-shared-gradient"],
      annotations: [
        { target: "old-branch", text: "L_old → θₒ → θₛ。" },
        { target: "new-branch", text: "L_new → θₙ → θₛ。" },
      ],
      detail: { title: "梯度路径与可训练参数", bullets: ["L_old → θₒ → θₛ。", "L_new → θₙ → θₛ。", "联合阶段 θₛ、θₒ、θₙ 都可训练；训练循环读取固定 Yₒ。"] },
    },
    {
      id: "cycle-update", title: "Optimizer Step", summary: "优化器应用梯度之后，Student 参数才真正改变。",
      activeNodes: ["objective", "optimizer", "updated-student"], activeEdges: ["loss-old-objective", "loss-new-objective", "objective-optimizer", "optimizer-updated-student"],
      annotations: [{ target: "optimizer", text: "backward 计算梯度；optimizer.step() 才更新参数。" }],
      detail: { title: "Optimizer Step", bullets: ["Backward 只计算并累积梯度。", "Optimizer Step 应用梯度，更新 θₛ、θₒ、θₙ。", "这只是一次 iteration 更新，Task t+1 训练还会继续。"] },
    },
  ],
};
