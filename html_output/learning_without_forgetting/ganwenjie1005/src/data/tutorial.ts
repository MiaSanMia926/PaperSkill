import type { TutorialData } from "../types";

// Official import source for the current eight-chapter LwF learning spine.
export const tutorial: TutorialData = {
  meta: {
    titleEn: "Learning without Forgetting",
    titleZh: "不遗忘学习",
    venue: "ECCV 2016 · arXiv:1606.09282v3",
    authors: "Zhizhong Li · Derek Hoiem",
    affiliation: "论文首页未列机构",
    domain: "视觉分类与连续任务学习",
    coreProblem: "无法访问旧任务训练数据时，怎样给已有卷积网络添加新预测能力并限制旧能力退化？",
    coreInsight: "用旧模型在新任务输入上的旧任务响应作软约束，同时用新标签学习新任务。",
    keywords: ["持续学习", "知识蒸馏", "卷积神经网络"],
  },
  hero: {
    oldMethod: {
      desc: "直接微调会更新共享层，旧任务表现存在退化风险。",
      componentId: "lwf-hero",
    },
    newMethod: {
      desc: "LwF 在同一新输入上匹配旧响应，并学习新任务标签。",
      componentId: "lwf-hero",
    },
  },
  chapters: [
    {
      "kind": "chapter",
      "id": "chap-00",
      "title": "问题设定",
      "badge": "inf",
      "badgeLabel": "问题设定",
      "bridge": "先确认旧模型仍可运行、旧训练数据不可访问，而当前任务输入与标签可用。",
      "analogy": {
        "title": "本章焦点",
        "text": "旧模型能处理当前新输入；旧任务训练样本与标签仍不可用。"
      },
      "modules": [
        {
          "kind": "module",
          "id": "00.1",
          "title": "核对问题条件",
          "desc": "切换常见训练路线，查看它们对新任务适应、旧任务保持与旧数据的不同要求。",
          "componentId": "problem-compare"
        }
      ],
      "insight": "LwF 用旧模型对当前输入的响应提供旧任务参照，不取回旧训练数据。",
      "takeaways": [
        {
          "icon": "▣",
          "title": "旧模型可用",
          "desc": "已有模型仍能对当前输入产生预测。"
        },
        {
          "icon": "∅",
          "title": "旧训练数据不可用",
          "desc": "适配不依赖旧任务训练图像与标签。"
        },
        {
          "icon": "＋",
          "title": "新任务数据可用",
          "desc": "当前输入与新标签提供新增任务监督。"
        }
      ]
    },
    {
      "kind": "chapter",
      "id": "chap-01",
      "title": "模型结构",
      "badge": "inf",
      "badgeLabel": "模型结构",
      "bridge": "区分上一阶段的 Modelₜ、训练前记录 Yₒ 的响应来源，以及负责后续适配的 Student。",
      "analogy": {
        "title": "本章焦点",
        "text": "共享表示连接旧、新任务 head；旧模型快照提供训练前记录 Yₒ 所需的参数。"
      },
      "modules": [
        {
          "kind": "module",
          "id": "01.1",
          "title": "检查 Teacher 与 Student",
          "desc": "交互查看共享参数、任务专属 head 和模型分工。",
          "componentId": "architecture-map"
        }
      ],
      "insight": "主分类流程中，Modelₜ 只在正式训练前记录 Yₒ；扩展后的 Student 保留 θₒ、增加 θₙ，随后独立参与训练。",
      "takeaways": [
        {
          "icon": "T",
          "title": "Teacher 固定",
          "desc": "旧模型只在正式训练前对 Xₙ 记录 Yₒ。"
        },
        {
          "icon": "S",
          "title": "Student 更新",
          "desc": "Student 先以 Yₙ 预热 θₙ，之后在联合优化中使用固定 Yₒ 与 Yₙ。"
        },
        {
          "icon": "↗",
          "title": "新增任务 head",
          "desc": "每个任务可以保留自己的输出头。"
        }
      ]
    },
    {
      "kind": "chapter",
      "id": "chap-02",
      "title": "关键做法",
      "badge": "both",
      "badgeLabel": "核心做法",
      "bridge": "同一组 Xₙ 分训练前与正式训练两个时点：先由 Modelₜ 记录 Yₒ，之后训练扩展后的 Student。",
      "analogy": {
        "title": "本章焦点",
        "text": "训练前：Xₙ → Modelₜ → 记录 Yₒ；正式训练：Xₙ → Student → Ŷₒ / Ŷₙ。"
      },
      "modules": [
        {
          "kind": "module",
          "id": "02.1",
          "title": "选择监督信号来源",
          "desc": "切换旧响应、新任务标签与不可用旧样本，观察它们服务的训练目标。",
          "componentId": "signal-source"
        }
      ],
      "insight": "Yₒ 是 Modelₜ 在正式训练前对 Xₙ 的记录；Warm-up 只用 Yₙ，进入联合优化后 Student 才读取固定的 Yₒ。",
      "takeaways": [
        {
          "icon": "X",
          "title": "使用当前输入",
          "desc": "训练前 Xₙ 输入 Modelₜ；正式训练时 Xₙ 输入 Student。"
        },
        {
          "icon": "Yₒ",
          "title": "读取旧响应",
          "desc": "Yₒ 在正式训练前记录，Warm-up 暂不使用。"
        },
        {
          "icon": "Yₙ",
          "title": "监督新任务",
          "desc": "当前真实标签监督新任务输出。"
        }
      ]
    },
    {
      "kind": "chapter",
      "id": "chap-03",
      "title": "一次训练",
      "badge": "trn",
      "badgeLabel": "训练过程",
      "bridge": "跟随正式训练中的 Warm-up、Student 前向、损失、反向传播与参数更新。",
      "analogy": {
        "title": "本章焦点",
        "text": "Warm-up 只用 Yₙ 更新 θₙ；联合优化时才用固定 Yₒ 计算 L_old。"
      },
      "modules": [
        {
          "kind": "module",
          "id": "03.1",
          "title": "逐步执行一个训练周期",
          "desc": "查看 Warm-up 的 Yₙ → L_new → θₙ，以及后续 Student 前向、联合损失、梯度传递和参数更新。",
          "componentId": "training-steps"
        }
      ],
      "insight": "固定 Yₒ 与 Ŷₒ 形成 L_old；Yₙ 与 Ŷₙ 形成 L_new；两项损失在共享参数 θₛ 上共同作用。",
      "takeaways": [
        {
          "icon": "1",
          "title": "先前向",
          "desc": "正式训练只运行 Student；旧模型不再前向。"
        },
        {
          "icon": "2",
          "title": "再合并目标",
          "desc": "联合优化时，固定 Yₒ 与新标签 Yₙ 分别监督旧、新任务输出。"
        },
        {
          "icon": "3",
          "title": "最后更新",
          "desc": "优化器在反向计算后改变 Student。"
        }
      ]
    },
    {
      "kind": "chapter",
      "id": "chap-04",
      "title": "机制与边界",
      "badge": "both",
      "badgeLabel": "机制与边界",
      "bridge": "解释 LwF 保持什么、多个目标如何影响共享参数，以及当前输入没有约束到哪里。",
      "analogy": {
        "title": "本章焦点",
        "text": "响应保持作用于当前可观察输入；参数距离与未观察区域是不同问题。"
      },
      "modules": [
        {
          "kind": "module",
          "id": "04.1",
          "title": "比较参数保持与响应保持",
          "desc": "在同一 Xₙ 上对照训练前 Modelₜ 记录的 Yₒ 与正式训练中 Student 的 Ŷₒ，并切换到参数位置视图。",
          "componentId": "lwf-preservation-compare"
        },
        {
          "kind": "module",
          "id": "04.2",
          "title": "检查共同优化目标",
          "desc": "查看旧响应权重、温度和新任务目标如何共同影响共享参数。",
          "componentId": "lwf-objective-balance"
        },
        {
          "kind": "module",
          "id": "04.3",
          "title": "检查输入覆盖边界",
          "desc": "调整示意覆盖状态，区分当前目标约束与未观察的旧域行为。",
          "componentId": "lwf-coverage-boundary"
        }
      ],
      "insight": "匹配 Xₙ 上的旧响应不等于 Student 在整个旧输入域上保持不变。",
      "takeaways": [
        {
          "icon": "Y",
          "title": "保持响应",
          "desc": "LwF 约束当前输入上的旧任务输出行为。"
        },
        {
          "icon": "λ",
          "title": "平衡目标",
          "desc": "旧、新任务损失共同影响共享参数。"
        },
        {
          "icon": "…",
          "title": "承认覆盖边界",
          "desc": "没有进入当前输入的区域不受本轮直接约束。"
        }
      ]
    },
    {
      "kind": "chapter",
      "id": "chap-05",
      "title": "连续任务",
      "badge": "trn",
      "badgeLabel": "连续任务",
      "bridge": "Task t+1 完成后，Student* 晋升为 Modelₜ₊₁；新任务到来后再进入 PREPARE。",
      "analogy": {
        "title": "本章焦点",
        "text": "每个新任务到来后，PREPARE 在正式训练前记录新的 Yₒ 并初始化新 head。"
      },
      "modules": [
        {
          "kind": "module",
          "id": "05.1",
          "title": "跟随任务级状态机",
          "desc": "手动推进 Modelₜ、任务到来、PREPARE、Warm-up、联合优化、Student* 晋升与下一任务交接。",
          "componentId": "lwf-task-handoff"
        }
      ],
      "insight": "Yₒ 只属于当前任务阶段；下一任务到来后，Modelₜ₊₁ 在新输入上重新记录旧响应。",
      "takeaways": [
        {
          "icon": "T",
          "title": "当前 Modelₜ",
          "desc": "Modelₜ 在正式训练前提供当前阶段的 Yₒ。"
        },
        {
          "icon": "↻",
          "title": "刷新响应目标",
          "desc": "新任务进入 PREPARE 后，在其输入上重新记录 Yₒ。"
        },
        {
          "icon": "→",
          "title": "交接 Student",
          "desc": "完整任务训练结束后，Student* 晋升为 Modelₜ₊₁。"
        }
      ]
    },
    {
      "kind": "chapter",
      "id": "chap-06",
      "title": "论文证据",
      "badge": "inf",
      "badgeLabel": "论文证据",
      "bridge": "先读实验协议，再把主张与论文表格、曲线、解释和结论边界对应起来。",
      "analogy": {
        "title": "本章焦点",
        "text": "实验结果只支持与其数据集、模型、指标和协议相符的结论。"
      },
      "modules": [
        {
          "kind": "module",
          "id": "06.1",
          "title": "核验主张与证据",
          "desc": "选择论文证据并判断结论是 Supported、Too Strong 还是 Unsupported。",
          "componentId": "lwf-evidence-explorer"
        }
      ],
      "insight": "局部实验结果不能推出 LwF 消除遗忘或普遍优于所有基线。",
      "takeaways": [
        {
          "icon": "P",
          "title": "先核对协议",
          "desc": "确认任务、架构、划分和指标。"
        },
        {
          "icon": "E",
          "title": "再看证据",
          "desc": "读取原表、原图和作者报告。"
        },
        {
          "icon": "B",
          "title": "最后看边界",
          "desc": "避免将有限结果扩大为普遍保证。"
        }
      ]
    },
    {
      "kind": "chapter",
      "id": "chap-07",
      "title": "完整回放",
      "badge": "both",
      "badgeLabel": "完整回放",
      "bridge": "从 Modelₜ 出发完成 Task t+1，再将 Student* 晋升为 Modelₜ₊₁；Task t+2 到来后回到 PREPARE。",
      "analogy": {
        "title": "本章焦点",
        "text": "旧响应、新任务监督与模型交接组成可重复的任务生命周期。"
      },
      "modules": [
        {
          "kind": "module",
          "id": "07.1",
          "title": "回放模型生命周期轨迹",
          "desc": "沿九个检查点查看输入、输出、参数状态与模型交接；联合训练步骤可回看 Chapter 03。",
          "componentId": "lwf-grand-trail"
        }
      ],
      "insight": "每轮把训练前记录 Yₒ、只用 Yₙ 的 Warm-up、联合优化和模型晋升作为不同阶段。",
      "takeaways": [
        {
          "icon": "1",
          "title": "旧模型仍可用",
          "desc": "旧训练样本不可访问；Modelₜ 仍可在正式训练前记录 Yₒ。"
        },
        {
          "icon": "2",
          "title": "两个目标共同训练",
          "desc": "联合优化中，固定 Yₒ 与当前标签共同作用于 Student。"
        },
        {
          "icon": "↻",
          "title": "任务阶段闭环",
          "desc": "下一任务到来后回到 PREPARE，重新记录当前阶段的 Yₒ。"
        }
      ]
    }
  ],
};
