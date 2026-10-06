import type { TutorialData } from '../types';

export const tutorial: TutorialData = {
  "meta": {
    "titleEn": "End-to-end Optimized Image Compression",
    "titleZh": "端到端优化的图像压缩",
    "venue": "ICLR 2017 · arXiv:1611.01704",
    "authors": "Johannes Ballé, Valero Laparra, Eero P. Simoncelli",
    "affiliation": "New York University · Universitat de València",
    "domain": "图像压缩 · 深度学习",
    "coreProblem": "高维空间的最优量化不可解；经典编解码器把变换、量化、熵编码分开手工设计，低码率下伪影明显（JPEG 色块、JPEG 2000 振铃）。",
    "coreInsight": "把整条压缩管线参数化并用率失真目标<b>端到端</b>优化：非线性分析变换 + 均匀量化 + 非线性合成变换；训练时用<b>均匀噪声松弛</b>替代不可导的量化。",
    "keywords": [
      "图像压缩",
      "率失真优化",
      "GDN",
      "端到端学习"
    ]
  },
  "hero": {
    "oldMethod": {
      "desc": "<b>JPEG（0.121 bit/px）</b>：低码率下细节被 8×8 色块与振铃侵蚀——PSNR 亮度 24.85 dB，MS-SSIM 0.8079。",
      "figure": "./images/fig5-jpeg.png"
    },
    "newMethod": {
      "desc": "<b>本文方法（0.113 bit/px）</b>：码率更低，轮廓被平滑简化而非破坏——PSNR 亮度 27.01 dB，MS-SSIM 0.9039。",
      "figure": "./images/fig5-proposed.png"
    }
  },
  "chapters": [
    {
      "kind": "chapter",
      "id": "chap-1",
      "title": "压缩的代价：为什么照片会变糊",
      "badge": "inf",
      "badgeLabel": "直觉",
      "bridge": "先认识代价：有损压缩不可能既省码率又零失真。老方法的伪影已经摆在眼前，接下来我们看看压缩的第一步——把像素换一种表示。",
      "analogy": {
        "title": "放大一张旧照片",
        "text": "摄影师把照片越放越大，色块和振铃从边缘冒出来——<b>压缩越狠，伪影越明显</b>。",
        "componentId": "ana-1"
      },
      "modules": [
        {
          "kind": "module",
          "id": "1.1",
          "title": "压缩强度滑杆：看伪影如何出现",
          "desc": "拖动滑杆改变压缩强度。左边是照片，右边实时显示<b>码率</b>与<b>失真</b>两个账本（相对值）：压缩越狠，文件越小，画面却被色块和振铃侵蚀。",
          "componentId": "ch1mod1"
        },
        {
          "kind": "module",
          "id": "1.2",
          "title": "同一张照片：JPEG 与 JPEG 2000 的伪影对比",
          "desc": "点击开始，同一张照片以相同低码率交给两种经典方法处理。它们都会失真，但伪影的形状不同：JPEG 是<b>方块</b>，JPEG 2000 是<b>振铃</b>。",
          "componentId": "ch1mod2"
        }
      ],
      "insight": "有损压缩是一场用码率换画质的交易；经典方法靠手工设计的变换与量化，伪影的形状由变换基函数决定——JPEG 出方块，JPEG 2000 出振铃。",
      "takeaways": [
        {
          "icon": "🎯",
          "title": "有损压缩必然有失真",
          "desc": "想要更小的文件，就必须接受画质损失，这是信息论的铁律。"
        },
        {
          "icon": "🔧",
          "title": "JPEG 出方块，JPEG 2000 出振铃",
          "desc": "伪影的形状由各自的手工设计变换（DCT 块 / 小波）决定。"
        },
        {
          "icon": "✨",
          "title": "码率与失真互为代价",
          "desc": "记住这对「账本」，后面整篇论文都在为它记账。"
        }
      ]
    },
    {
      "kind": "chapter",
      "id": "chap-2",
      "title": "从像素到码空间：换一种表示",
      "badge": "inf",
      "badgeLabel": "直觉",
      "bridge": "伪影来自老方法的手工设计变换。想要自动适应图像统计，先得把图像变换到另一个空间——码空间 y 登场。",
      "analogy": {
        "title": "收进取景框",
        "text": "辽阔的风景被收进小小的取景框，构图还在，尺寸变了——<b>变换把图像装进更小的码空间</b>。",
        "componentId": "ana-2"
      },
      "modules": [
        {
          "kind": "module",
          "id": "2.1",
          "title": "拖动取样框：不同区域的统计",
          "desc": "拖动取样框在照片上移动：平坦天空、纹理草地、清晰边缘，三个区域的像素统计各不相同。压缩的机会就藏在<b>统计规律</b>里——统计越整齐，越好压缩。",
          "componentId": "ch2mod1"
        }
      ],
      "formula": {
        "lead": "压缩的第一步不是动像素，而是换一个表示——分析变换把图像映射到码空间 y，并顺带把表示缩小到输入的一半。",
        "unicode": "y = gₐ(x; φ)",
        "symbols": [
          {
            "sym": "y",
            "desc": "码空间表示（维度约为输入的一半）"
          },
          {
            "sym": "gₐ",
            "desc": "分析变换（参数 φ）"
          },
          {
            "sym": "x",
            "desc": "输入图像"
          },
          {
            "sym": "φ",
            "desc": "分析变换的参数"
          }
        ]
      },
      "takeaways": [
        {
          "icon": "🎯",
          "title": "压缩发生在码空间",
          "desc": "先把像素变换成统计更整齐的表示，才谈得上码率与失真。"
        },
        {
          "icon": "🔧",
          "title": "不同区域统计不同",
          "desc": "平坦区域好压缩，纹理与边缘难压缩，伪影偏爱边缘。"
        },
        {
          "icon": "✨",
          "title": "变换的职责是整理统计",
          "desc": "好的表示让后面的量化与熵编码事半功倍。"
        }
      ]
    },
    {
      "kind": "chapter",
      "id": "chap-3",
      "title": "GDN：让统计\"变圆\"的归一化",
      "badge": "inf",
      "badgeLabel": "直觉",
      "bridge": "变换之后，还要把码空间里的统计整理得更规整。本文的招牌非线性 GDN，就是干这件事的。",
      "analogy": {
        "title": "擦亮镜片",
        "text": "镜头上的眩光一块一块被擦掉，画面恢复均匀——<b>GDN 按邻域亮度给每个系数\"除权\"</b>。",
        "componentId": "ana-3"
      },
      "modules": [
        {
          "kind": "module",
          "id": "3.1",
          "title": "拖动系数点：除法归一化的效果",
          "desc": "左边是一块布满眩光的镜片，右边是系数对 (w₁, w₂) 的散点图。把一个系数点拖近强光斑——归一化会把它按<b>邻域亮度</b>压回原点，远离光斑则几乎不动。",
          "componentId": "ch3mod1"
        }
      ],
      "formula": {
        "lead": "每个位置的除法归一化都由它自己和邻居共同决定。",
        "unicode": "uᵢ = wᵢ / √(βᵢ + Σⱼ γᵢⱼ wⱼ²)",
        "symbols": [
          {
            "sym": "uᵢ",
            "desc": "归一化后的第 i 个系数"
          },
          {
            "sym": "wᵢ",
            "desc": "归一化前的系数"
          },
          {
            "sym": "βᵢ",
            "desc": "加性常数（可学习）"
          },
          {
            "sym": "γᵢⱼ",
            "desc": "邻居 j 对 i 的耦合强度（可学习，且 γᵢⱼ=γⱼᵢ）"
          }
        ]
      },
      "takeaways": [
        {
          "icon": "🎯",
          "title": "除法归一化",
          "desc": "每个系数除以「自身与邻域的加权平方和」的开方，抑制抱团的高能量。"
        },
        {
          "icon": "🔧",
          "title": "空间自适应",
          "desc": "归一化强度随位置变化；训练结束后仍是非线性，这是它与批量归一化的本质区别。"
        },
        {
          "icon": "✨",
          "title": "高斯化",
          "desc": "归一化后的局部统计更像高斯分布，为后面的熵编码铺路。"
        }
      ]
    },
    {
      "kind": "chapter",
      "id": "chap-4",
      "title": "R + λD：压缩的记账本",
      "badge": "both",
      "badgeLabel": "双视角",
      "bridge": "直觉部件已经齐了：变换、归一化。现在把它们挂到同一条公式上——率失真联合优化，整篇论文的记账本。",
      "analogy": {
        "title": "双拨盘找平衡",
        "text": "一只手指着画质，一只手指着胶卷余量，摄影师转动拨盘寻找平衡点——<b>λ 就是那根权衡的轴</b>。",
        "componentId": "ana-4"
      },
      "modules": [
        {
          "kind": "module",
          "id": "4.1",
          "title": "拖动 λ：码率与失真的天平",
          "desc": "λ 是权衡旋钮：调大它，天平倒向画质（失真小、码率大）；调小它，天平倒向省流。右侧的率失真曲线会标出你当前的工作点。",
          "componentId": "ch4mod1"
        },
        {
          "kind": "module",
          "id": "4.2",
          "title": "在率失真曲线上拖动工作点",
          "desc": "曲线越低越好：同样的码率，失真越小。拖动工作点沿绿色曲线（本文方法）滑动，观察两个账本的此消彼长；上方红色曲线是 JPEG 参考。",
          "componentId": "ch4mod2"
        }
      ],
      "insight": "记住一条主线：整篇论文都在优化 L = R + λD；λ 是权衡的轴，R 与 D 是两个账本，后面所有章节都在为这三个符号服务。",
      "formula": {
        "lead": "整篇论文的目标函数只有一行：让量化码的熵（码率）尽量小，同时让重建失真尽量小，λ 决定谁更重要。",
        "unicode": "L = −𝔼[log₂ P_q(q)] + λ·𝔼[d(z, ẑ)]，其中 q = round(y)",
        "symbols": [
          {
            "sym": "L",
            "desc": "总损失（率失真代价）"
          },
          {
            "sym": "R = −𝔼[log₂ P_q(q)]",
            "desc": "码率：量化码 q 的离散熵（比特）"
          },
          {
            "sym": "D = 𝔼[d(z, ẑ)]",
            "desc": "失真：感知变换输出 z 与重建 ẑ 之间的距离（本文用 MSE、恒等感知变换）"
          },
          {
            "sym": "λ",
            "desc": "权衡参数：越大越看重画质"
          },
          {
            "sym": "round(y)",
            "desc": "把连续码四舍五入为整数（量化）"
          }
        ]
      },
      "takeaways": [
        {
          "icon": "🎯",
          "title": "一条公式贯穿全文",
          "desc": "L = R + λD：码率是离散熵，失真是重建误差，λ 是权衡轴。"
        },
        {
          "icon": "🔧",
          "title": "量化取整",
          "desc": "q = round(y) 把连续码变成整数，它是唯一的信息损失来源。"
        },
        {
          "icon": "✨",
          "title": "高维最优量化不可解",
          "desc": "所以本文不手工设计量化器，而是学一对变换来配合它。"
        }
      ]
    },
    {
      "kind": "chapter",
      "id": "chap-5",
      "title": "λ：一部相机，多个画质档位",
      "badge": "both",
      "badgeLabel": "双视角",
      "bridge": "公式里的 λ 是权衡的轴。同一个目标函数，λ 不同，优化出的模型完全不同——就像一部相机的多个画质档位。",
      "analogy": {
        "title": "选择画质档位",
        "text": "同一张照片按低、中、高三档存进存储卡，文件大小各不相同——<b>每个 λ 就是一个档位</b>。",
        "componentId": "ana-5"
      },
      "modules": [
        {
          "kind": "module",
          "id": "5.1",
          "title": "三个画质档位：选你的工作点",
          "desc": "论文为每个 λ 单独训练一个模型，λ 从 32 到 2048。这里抽出低、中、高三档：档位越低，文件越小，细节越少。比特流里会写入 λ 索引，解码端据此选择模型。",
          "componentId": "ch5mod1"
        }
      ],
      "takeaways": [
        {
          "icon": "🎯",
          "title": "一个 λ = 一个工作点",
          "desc": "每个 λ 都单独训练一个模型，互不共享。"
        },
        {
          "icon": "🔧",
          "title": "λ 小 → 省流，λ 大 → 保真",
          "desc": "论文覆盖 λ∈[32, 2048]，从低码率档一直到高码率档。"
        },
        {
          "icon": "✨",
          "title": "比特流自带档位信息",
          "desc": "解码端读到 λ 索引，就知道该用哪个模型还原。"
        }
      ]
    },
    {
      "kind": "chapter",
      "id": "chap-6",
      "title": "快门瞬间：编解码的一条龙管线",
      "badge": "inf",
      "badgeLabel": "直觉",
      "bridge": "档位选好了，现在按下快门：一张照片从编码到解码，整条管线六步走完。",
      "analogy": {
        "title": "底片慢慢显影",
        "text": "底片在显影液里慢慢浮现出画面，从潜影变成照片——<b>解码就像显影，一步到位</b>。",
        "componentId": "ana-6"
      },
      "modules": [
        {
          "kind": "module",
          "id": "6.1",
          "title": "从按下快门到照片还原：六步走",
          "desc": "点击「下一步」，跟着一张照片走完编解码全程：变换、量化、熵编码、传输、熵解码、合成。每一步都有维度标注与说明。",
          "componentId": "ch6mod1"
        }
      ],
      "formula": {
        "lead": "整条管线合起来只有一句话：把图像变换到码空间、取整、再变换回来。",
        "unicode": "x̂ = g_s(round(gₐ(x; φ)); θ)",
        "symbols": [
          {
            "sym": "x̂",
            "desc": "重建图像"
          },
          {
            "sym": "g_s",
            "desc": "合成变换（参数 θ）"
          },
          {
            "sym": "round(gₐ(x; φ))",
            "desc": "先分析变换再量化取整"
          },
          {
            "sym": "θ",
            "desc": "合成变换的参数"
          }
        ]
      },
      "takeaways": [
        {
          "icon": "🎯",
          "title": "编码 = 变换 + 量化 + 熵编码",
          "desc": "解码是它的镜像：熵解码 + 合成变换。"
        },
        {
          "icon": "🔧",
          "title": "量化是唯一的损失源",
          "desc": "分析变换与合成变换本身都不丢信息。"
        },
        {
          "icon": "✨",
          "title": "推理只跑前向",
          "desc": "编解码高效；训练昂贵是它付的代价。"
        }
      ]
    },
    {
      "kind": "chapter",
      "id": "chap-7",
      "title": "梯度断了怎么办：均匀噪声松弛",
      "badge": "trn",
      "badgeLabel": "训练",
      "bridge": "管线里有一处断点：量化取整不可导。训练要靠均匀噪声把台阶抹成缓坡——这是本文最关键的训练技巧。",
      "analogy": {
        "title": "摇匀显影罐",
        "text": "摄影师匀速摇动显影罐，药剂从分层变得均匀——<b>均匀噪声让\"台阶\"变成\"缓坡\"</b>。",
        "componentId": "ana-7"
      },
      "modules": [
        {
          "kind": "module",
          "id": "7.1",
          "title": "台阶还是缓坡：量化不可导怎么办",
          "desc": "直接量化让损失变成「台阶」——梯度几乎处处为零，没法下山。论文训练时用<b>加性均匀噪声</b>代替量化，把台阶抹成缓坡；这个松弛在整数点上与原分布完全一致。",
          "componentId": "ch7mod1"
        }
      ],
      "formula": {
        "lead": "加噪码在整数点上的密度恰好等于量化码的概率质量——所以训练时可以直接用差分熵代替离散熵。",
        "unicode": "p_ỹ(n) = P_q(n)（n 为整数），Δy ~ U(−½, ½)",
        "symbols": [
          {
            "sym": "ỹ = y + Δy",
            "desc": "加噪码（只用于训练）"
          },
          {
            "sym": "p_ỹ",
            "desc": "加噪码的密度"
          },
          {
            "sym": "P_q",
            "desc": "量化码的离散分布"
          },
          {
            "sym": "U(−½, ½)",
            "desc": "宽度与量化区间一致的均匀噪声"
          }
        ]
      },
      "takeaways": [
        {
          "icon": "🎯",
          "title": "量化不可导",
          "desc": "round() 的梯度几乎处处为零，梯度下降无法穿过它。"
        },
        {
          "icon": "🔧",
          "title": "训练时加均匀噪声",
          "desc": "宽度与量化区间一致的 U(−½,½)，把离散问题变成连续问题。"
        },
        {
          "icon": "✨",
          "title": "严格而非凑合",
          "desc": "整数点上 p_ỹ(n) = P_q(n)，差分熵与离散熵一一对应。"
        }
      ]
    },
    {
      "kind": "chapter",
      "id": "chap-8",
      "title": "镜头组：端到端学出来的架构",
      "badge": "trn",
      "badgeLabel": "训练",
      "bridge": "训练跑得通了，再看引擎本身：三层「卷积→下采样→GDN」级联，全部参数端到端学出。",
      "analogy": {
        "title": "光线穿过镜头组",
        "text": "一道光线穿过层层镜片，最终在底片上聚焦成清晰的像——<b>这就是三层变换的级联</b>。",
        "componentId": "ana-8"
      },
      "modules": [
        {
          "kind": "module",
          "id": "8.1",
          "title": "点击镜头组：每一级在做什么",
          "desc": "点击架构中的任意一级：左侧镜头组亮起对应镜片，右侧显示该级的<b>维度</b>、<b>通道数</b>与职责。编码端与解码端互为镜像——作者也坦白：<b>网络结构的选择有些随意</b>，更系统的搜索可能带来明显提升。",
          "componentId": "ch8mod1"
        }
      ],
      "formula": {
        "lead": "合成端的每一级都近似逆着分析端来：先 IGDN，再上采样，最后仿射卷积。",
        "unicode": "ŵᵢ = ûᵢ · √(β̂ᵢ + Σⱼ γ̂ᵢⱼ ûⱼ²)",
        "symbols": [
          {
            "sym": "ŵᵢ",
            "desc": "IGDN 还原后的第 i 个值"
          },
          {
            "sym": "ûᵢ",
            "desc": "量化后的码值"
          },
          {
            "sym": "β̂ᵢ, γ̂ᵢⱼ",
            "desc": "合成端自有的参数（与分析端分开学习）"
          }
        ]
      },
      "takeaways": [
        {
          "icon": "🎯",
          "title": "三级级联",
          "desc": "卷积 → 下采样 → GDN，重复三次；码空间维度是输入的一半。"
        },
        {
          "icon": "🔧",
          "title": "合成端是镜像",
          "desc": "IGDN → 上采样 → 卷积，参数独立学习。"
        },
        {
          "icon": "✨",
          "title": "结构选择有些随意",
          "desc": "作者承认架构没有系统搜索，这里仍有提升空间。"
        }
      ]
    },
    {
      "kind": "chapter",
      "id": "chap-9",
      "title": "熵编码：把符号变成比特",
      "badge": "trn",
      "badgeLabel": "训练",
      "bridge": "架构产出的整数码，还要最后一步才变成真实文件——熵编码，给常用符号配短码。",
      "analogy": {
        "title": "给照片装框",
        "text": "常用尺寸的照片用刚好贴合的相框，稀有大尺寸才用大框——<b>熵编码给常用符号配短码</b>。",
        "componentId": "ana-9"
      },
      "modules": [
        {
          "kind": "module",
          "id": "9.1",
          "title": "自适应熵编码：收益有多大",
          "desc": "熵编码按符号出现频率分配码长。切换两种方案：<b>非自适应</b>（固定概率）与<b>自适应</b>（CABAC 上下文）。看总比特数差多少——论文的答案可能出乎意料。",
          "componentId": "ch9mod1"
        }
      ],
      "takeaways": [
        {
          "icon": "🎯",
          "title": "常用符号配短码",
          "desc": "熵编码按概率分配码长，符号频率越偏，省得越多。"
        },
        {
          "icon": "🔧",
          "title": "自适应增益有限",
          "desc": "CABAC 自适应编码只比非自适应略好，这是论文的实测结论。"
        },
        {
          "icon": "✨",
          "title": "码率含全部边信息",
          "desc": "尺寸、颜色标志、λ 索引都要占比特，账本不能漏记。"
        }
      ]
    },
    {
      "kind": "chapter",
      "id": "chap-10",
      "title": "评审打分：结果与局限",
      "badge": "both",
      "badgeLabel": "双视角",
      "bridge": "到此，方法、训练、编码全部就位。最后回到一切开始的地方：把三方方案放到同一张评审桌上打分。",
      "analogy": {
        "title": "评审打分",
        "text": "三张参赛照片并排挂在墙上，评委同时打分——<b>同码率下，谁的照片更干净一目了然</b>。",
        "componentId": "ana-10"
      },
      "modules": [
        {
          "kind": "module",
          "id": "10.1",
          "title": "评审开始：三方同码率对比",
          "desc": "真实数据来自论文图 5：同一张 752×376 图像。点击开始，三条赛道按选中指标跑分。数据表保留精确值；奖杯只在论文数据支持的指标上出现。",
          "componentId": "ch10mod1",
          "figure": "./images/fig5-comparison.png"
        }
      ],
      "formula": {
        "lead": "评审的两个指标都来自附录 6.3 的固定协议：PSNR 用 JPEG 定义的 RGB→Y'CbCr 转换计算，MS-SSIM 只在亮度分量上计算。",
        "unicode": "PSNR = 10 · log₁₀(255² / MSE)",
        "symbols": [
          {
            "sym": "PSNR",
            "desc": "峰值信噪比（dB，越高越好）"
          },
          {
            "sym": "MSE",
            "desc": "均方误差（越低越好）"
          },
          {
            "sym": "MS-SSIM",
            "desc": "多尺度结构相似度（亮度分量，越高越好）"
          }
        ]
      },
      "takeaways": [
        {
          "icon": "🎯",
          "title": "同码率大幅领先",
          "desc": "图 5 示例：0.113 bit/px 下 MS-SSIM 0.9039、亮度 PSNR 27.01 dB，均优于 JPEG/JPEG 2000。"
        },
        {
          "icon": "🔧",
          "title": "但并非全胜",
          "desc": "PSNR 是\"大多数图像\"占优；个别图像高码率 MSE 会被 JPEG 2000 反超。"
        },
        {
          "icon": "✨",
          "title": "局限要记牢",
          "desc": "架构选择随意、训练成本高、自适应熵编码增益小——这是端到端压缩的起点，不是终点。"
        }
      ]
    }
  ],
  "bilibili": [
    {
      "bvid": "BV1uWrABfEvt",
      "title": "深度神经网络图像压缩方法进展综述（刘贤明、柏园超团队）",
      "reason": "领域综述：覆盖率失真优化、非线性变换、量化与熵编码——本文方法的核心部件，适合扩展学习。",
      "cover": "https://i2.hdslb.com/bfs/archive/1c8a951829dc72a577042c798e65dcc0bd5e7fc1.jpg",
      "views": "388播放"
    },
    {
      "bvid": "BV1D5CAYGEfd",
      "title": "可学习的图像视频压缩",
      "reason": "讲座：用自编码器替代传统编解码框架的端到端思路，与本文一脉相承。",
      "cover": "https://i1.hdslb.com/bfs/archive/0817f0f8e2893c1eb63c12e2059a8d8cd6c771f5.jpg",
      "views": "1281播放"
    }
  ]
};
