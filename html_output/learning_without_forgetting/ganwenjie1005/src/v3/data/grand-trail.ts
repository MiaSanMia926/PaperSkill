import type { LwfChapterId } from "./chapters";

export type GrandTrailStep = {
  id: string;
  title: string;
  checkpoint: string;
  action: string;
  input: string;
  output: string;
  state: string;
  why: string;
  activeActors: string[];
  activeFlows: string[];
  referenceId?: string;
  chapterRef?: LwfChapterId;
  durationMs: number;
};

export type GrandTrailEdge = { from: string; to: string; flow: string };

export const grandTrailSteps: GrandTrailStep[] = [
  {
    id: "old-model",
    title: "旧模型就绪",
    checkpoint: "START · MODELₜ",
    action: "从已完成任务 1…t 的旧模型开始。",
    input: "Modelₜ · 共享参数 θₛ + 已有任务 head",
    output: "可运行的旧模型",
    state: "旧训练图像与标签不可用；模型参数仍可访问。",
    why: "本阶段的旧响应目标由当前模型在新任务输入上的输出提供。",
    activeActors: ["model", "old-data-locked"],
    activeFlows: [],
    referenceId: "teacher",
    chapterRef: "01",
    durationMs: 900,
  },
  {
    id: "new-task",
    title: "新任务到来",
    checkpoint: "NEW TASK · INPUT",
    action: "新任务带来当前可用的输入与新标签。",
    input: "Xₙ + Yₙ",
    output: "当前阶段训练数据",
    state: "适配阶段只使用新任务数据；旧任务数据仍不可用。",
    why: "LwF 在当前任务样本上学习新标签，也记录旧模型在这些输入上的响应。",
    activeActors: ["model", "new-task", "old-data-locked"],
    activeFlows: ["task-arrival"],
    referenceId: "xn",
    chapterRef: "02",
    durationMs: 1100,
  },
  {
    id: "prepare-adaptation",
    title: "训练前准备 Yₒ 与 θₙ",
    checkpoint: "PREPARE · RESPONSE + HEAD",
    action: "正式训练前，Modelₜ 在当前输入 Xₙ 上记录 Yₒ，同时为新任务初始化随机 θₙ。",
    input: "Modelₜ + Xₙ / Yₙ",
    output: "固定 Yₒ + expanded Student · θₛ + θₒ + θₙ",
    state: "记录 Yₒ 与初始化 θₙ 都是训练前准备，两者没有严格的先后依赖。Modelₜ 只用于记录 Yₒ；之后训练直接读取固定 target。",
    why: "把两个准备动作放在同一检查点，避免把它们画成有因果依赖的先后步骤。",
    activeActors: ["response-source", "new-task", "old-response", "student-active", "new-head"],
    activeFlows: ["response-refresh", "head-branch"],
    referenceId: "yo",
    chapterRef: "02",
    durationMs: 1700,
  },
  {
    id: "warm-up",
    title: "Warm-up 新 head",
    checkpoint: "WARM-UP · ONLY θₙ",
    action: "只用当前任务输入与标签预热新 head。",
    input: "Xₙ + Yₙ → Student 的新任务分支",
    output: "由 L_new 更新后的 θₙ",
    state: "Warm-up 只用 Xₙ 与 Yₙ 形成 L_new 并更新 θₙ；θₛ 与 θₒ 冻结。已记录的 Yₒ 暂不参与，留到后续联合优化。",
    why: "这是论文采用的训练策略；Table 2(b) 指出它对 LwF 并非关键。",
    activeActors: ["student-active", "shared-frozen", "old-head-frozen", "new-head-active"],
    activeFlows: ["new-head-warmup"],
    referenceId: "warm-up",
    chapterRef: "03",
    durationMs: 1300,
  },
  {
    id: "joint-training",
    title: "联合优化两个目标",
    checkpoint: "JOINT TRAINING · L_old + L_new",
    action: "Student 前向产生 Ŷₒ 与 Ŷₙ；固定 Yₒ 与 Ŷₒ 形成 L_old，Yₙ 与 Ŷₙ 形成 L_new，再执行 Backward。",
    input: "Recorded Yₒ + Student(Xₙ) + Yₙ",
    output: "L = λₒ L_old + L_new + R → gradients ready",
    state: "联合阶段 θₛ、θₒ、θₙ 都可训练；训练循环直接读取固定 Yₒ。",
    why: "联合目标在保持已观察旧响应与适配当前任务之间提供权衡。",
    activeActors: ["student-active", "old-response", "old-loss", "new-loss", "gradient", "shared-trainable", "old-head-trainable", "new-head-trainable"],
    activeFlows: ["old-loss", "new-loss", "gradient-wave"],
    referenceId: "joint-optimization",
    chapterRef: "03",
    durationMs: 2200,
  },
  {
    id: "update",
    title: "更新 Student",
    checkpoint: "UPDATE · ONE ITERATION",
    action: "Optimizer 将当前梯度应用到 θₛ、θₒ、θₙ，完成当前任务中的一次参数更新。",
    input: "Student^(k) + gradients",
    output: "Student^(k+1)",
    state: "这是当前任务中的一次 optimizer step；它不代表任务训练已经完成。",
    why: "Backward 计算梯度；Optimizer Step 才将梯度应用到可训练参数。",
    activeActors: ["student-updated", "optimizer", "old-response"],
    activeFlows: ["parameter-update"],
    referenceId: "joint-optimization",
    chapterRef: "03",
    durationMs: 1200,
  },
  {
    id: "task-completion",
    title: "重复迭代直到任务完成",
    checkpoint: "REPEAT · TASK t+1",
    action: "继续执行 minibatch 前向、损失、反向传播和参数更新，直到 Task t+1 训练完成。",
    input: "Student^(k+1) + 后续 minibatches",
    output: "Student* · Task t+1 complete",
    state: "中间 Student^(k+1) 会继续更新；只有任务完成后的最终 Student* 才进入模型晋升。",
    why: "区分一次 optimizer 更新与完整任务阶段结束。",
    activeActors: ["student-active", "old-response", "new-task"],
    activeFlows: ["task-iteration"],
    referenceId: "joint-optimization",
    chapterRef: "05",
    durationMs: 1500,
  },
  {
    id: "promote-model",
    title: "晋升为 Modelₜ₊₁",
    checkpoint: "PROMOTION · TASK COMPLETE",
    action: "Task t+1 训练结束后，最终 Student* 成为 Modelₜ₊₁。",
    input: "Student* · Task t+1 training finished",
    output: "Modelₜ₊₁",
    state: "模型级下标只在完整任务训练结束后赋予；Modelₜ₊₁ 成为下一任务阶段的起点。",
    why: "模型沿任务序列递归交接，构成完整生命周期。",
    activeActors: ["student-final", "model-next"],
    activeFlows: ["model-promotion"],
    referenceId: "sequential-refresh",
    chapterRef: "05",
    durationMs: 1500,
  },
  {
    id: "next-task",
    title: "下一任务到来",
    checkpoint: "NEXT TASK · ARRIVAL",
    action: "Task t+2 到来；Modelₜ₊₁ 与新的 Xₜ₊₂、Yₜ₊₂ 成为下一阶段的起点。",
    input: "Modelₜ₊₁ + Xₜ₊₂ / Yₜ₊₂",
    output: "下一阶段输入与旧模型已就绪",
    state: "Task t+1 的 Yₒ 不会沿用；下一步进入 PREPARE，在 Xₜ₊₂ 上重新记录旧响应并初始化新 head。",
    why: "区分新任务到来与随后记录 Yₒ、加入 θₙ 的训练前准备。",
    activeActors: ["model-next", "next-task"],
    activeFlows: ["task-arrival"],
    referenceId: "sequential-refresh",
    chapterRef: "05",
    durationMs: 1700,
  },
];

export const grandTrailEdges: GrandTrailEdge[] = [
  { from: "old-model", to: "new-task", flow: "task-arrival" },
  { from: "new-task", to: "prepare-adaptation", flow: "response-refresh" },
  { from: "prepare-adaptation", to: "warm-up", flow: "new-head-warmup" },
  { from: "warm-up", to: "joint-training", flow: "gradient-wave" },
  { from: "joint-training", to: "update", flow: "parameter-update" },
  { from: "update", to: "task-completion", flow: "task-iteration" },
  { from: "task-completion", to: "promote-model", flow: "model-promotion" },
  { from: "promote-model", to: "next-task", flow: "task-arrival" },
];

export const jointTrainingSubsteps = ["Forward", "L_old / L_new", "Backward"] as const;
