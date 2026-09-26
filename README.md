# 交通用语语料库 · Traffic Terminology Corpus

把日常口语化、模糊的交通表述映射为**标准交通工程术语**的中英对照语料库，并配套可直接投入使用的 AI Skill、纯静态网页转换器与命令行查询工具。

**807 条标准术语 · 2038 个口语说法 · 9 类领域 · 中英对照 · 纯数据无依赖**

---

## 为什么需要它

交通工程领域的输入往往是自然语言的：

> "早高峰那个红绿灯路口加塞太严重，车根本走不动"

而建模、写规范、做数据标注需要的是术语化的：

> "早高峰时段，信号交叉口违法变更车道行为多发，导致严重拥堵"

这一步转换今天大量由大模型完成，但模型缺少一份**可查证、带定义、带国标依据**的对照表，输出就会不稳定、不可复现，也无法审阅。本库就是这张对照表。

| 口语说法 | 标准术语 | English |
|---|---|---|
| 红绿灯路口 | 信号交叉口 | signalized intersection |
| 加塞 | 违法变更车道 | illegal lane changing |
| 堵死了 | 严重拥堵 | severe congestion |
| 马路牙子 | 路缘石 | curb |
| 一路绿灯 | 绿波协调控制 | green wave coordination |
| 凹进去的公交站 | 港湾式停靠站 | bus bay |
| 柱子挡视线 | A柱盲区 | A-pillar blind zone |

价值不止在"同义词表"，而在于三个层面：

1. **口语的地域与句法变体**——"便道/人行道""马路牙子/道牙/路沿石""马葫芦盖/井盖"，这是检索式词典覆盖不了的部分；
2. **每个术语带专业定义与适用条件**，让转换结果可被人工审阅，而不是模型的自说自话；
3. **一词多义被显式建模**——同一个口语说法指向多个术语时，用 `disambiguation` 字段写清取舍条件，把消歧从提示词里挪进数据里。

## 适用对象与场景

- **AI 工程师 / 提示词工程**：作为术语规范化的检索后端与 few-shot 词表，`skill/` 目录可直接装进支持 Skill 的工具；
- **交通工程与城市规划研究者**：写中英文报告、翻译规范、做文献术语对齐时的速查表；
- **交通数据分析与标注**：把导航评价、12123 报警文本、舆情投诉等自然语言语料转成可聚合的结构化标签；
- **智能交通系统（ITS）产品**：为语音交互、工单分诊、路况文本理解提供领域词表；
- **交通专业教学**：中英术语对照 + 定义 + 国标出处，可作术语复习材料。

## 数据概览

| 文件 | 领域 | ID 前缀 | 词条数 |
|---|---|---|---|
| `01_road_infrastructure.jsonl` | 道路与基础设施 | ROAD | 103 |
| `02_intersection.jsonl` | 交叉口与标志标线 | INTX | 96 |
| `03_signal_control.jsonl` | 交通信号控制 | SIG | 115 |
| `04_traffic_flow.jsonl` | 交通流与拥堵 | FLOW | 95 |
| `05_public_transit.jsonl` | 公共交通 | TRANSIT | 101 |
| `06_freeway.jsonl` | 高速公路 | FWY | 90 |
| `07_its.jsonl` | 智能交通 | ITS | 91 |
| `08_safety_parking.jsonl` | 交通安全 / 静态交通（停车） | SAFE | 116 |
| **合计** | | | **807** |

- 口语说法 **2038** 个（原始写法去重），平均每条术语 **2.54** 个说法，**没有任何一条术语只有单一口语**；索引与网页按"去掉「（北方）」等括注后再去重"的**匹配键**计数，为 **2036** 个（`地道`/`闪黄灯` 两组括注写法并入主形）；
- 数据按 **8 个文件**组织，`category` 标签共 **9 类**——`08_safety_parking.jsonl` 同时收录「交通安全」90 条与「静态交通（停车）」26 条；
- 148 条术语标注了国家标准/行业规范依据；
- 12 组跨词条歧义口语全部配有 `disambiguation` 取舍说明。

## 数据格式

`data/*.jsonl` 每行一条 JSON 记录：

```json
{
  "id": "SIG-0001",
  "term_zh": "信号交叉口",
  "term_en": "signalized intersection",
  "category": "交通信号控制",
  "definition": "设有交通信号灯并按信号配时规则分配交叉口通行权的交叉口。",
  "colloquial": ["红绿灯路口", "有红绿灯的路口", "信号灯路口"],
  "related": ["无信号交叉口", "环形交叉口", "信号相位"],
  "standards": "GB 14886 道路交通信号灯设置与安装规范",
  "disambiguation": "（仅歧义词条有）与其他术语共享口语说法时的取舍说明"
}
```

| 字段 | 必填 | 说明 |
|---|---|---|
| `id` | ✓ | 领域前缀 + 4 位序号，全局唯一（ROAD/INTX/SIG/FLOW/TRANSIT/FWY/ITS/SAFE） |
| `term_zh` | ✓ | 标准中文术语 |
| `term_en` | ✓ | 标准英文术语（不允许出现中文字符，由校验强制） |
| `category` | ✓ | 领域分类 |
| `definition` | ✓ | 简明专业定义 |
| `colloquial` | ✓ | 口语/模糊说法列表（**核心字段**，校验要求 ≥1；当前 807 条实际全部 ≥2） |
| `related` | ✗ | 关联术语，必须指向库内已存在的术语或口语 |
| `standards` | ✗ | 参考的国家/行业标准规范，格式为「编号 名称」 |
| `disambiguation` | ✗ | 该术语与其他术语共享口语说法时的取舍说明，歧义词条必填 |

## 三种使用方式

### 1. 网页转换器（零依赖，双击即用）

打开 `web/index.html` 即可，纯静态、无需服务器与网络：

- **口语转换**：输入一段口语化描述，自动识别其中所有交通表述，输出术语化改写（高亮）、原文对照和术语卡片（中英对照、定义、领域、关联词、国标依据、消歧说明、歧义候选），支持一键复制、历史记录、`Ctrl+Enter` 快捷转换；
- **术语库**：807 条术语的浏览与检索（术语 / 英文 / 口语 / 定义全文搜索 + 按领域筛选），点击查看完整详情。

### 2. 作为 AI Skill

把 `skill/traffic-terminology/` 整个目录复制到目标工具的 skills 目录。Skill 自带反向索引，不依赖源数据即可独立工作。

索引是归一化结构，`index` 只存候选词条 ID，正文集中在 `entries`，整包 319 KB（若按口语逐条展开会是 567 KB）。上下文预算紧张时，先读 `references/slices/manifest.json`（1.3 KB），再只加载相关领域的 `slices/<前缀>.json`（每片 35–48 KB）。**但有 12 组口语跨领域歧义**（如「路牌」既指路名牌也指交通标志），领域不确定时应回查整包，不要强行按单一分片作答。

### 3. 命令行查询

```bash
python scripts/query.py "红绿灯路口"
python scripts/query.py 加塞
python scripts/query.py green wave
python scripts/query.py 信号 -v      # 显示定义、关联词与标准依据
```

## 工程质量保障

这不是一个"写完就放着的数据集"，构建与校验链路是它的一部分：

```bash
python scripts/run_all.py     # 校验 -> 重建索引 -> 重建网页数据 -> 跑回归用例
```

- **`validate.py`**：schema 完整性、ID 格式与前缀、全局唯一性、`term_en` 不得含中文或中文标点、各字段不得有首尾空白、`related` 必须可解析、歧义口语必须覆盖 `disambiguation`；
- **标准号登记表**：23 条标准编号与规范名称的对应关系内置在校验里，编号与名称写错会直接报错——这拦住过 `GB 50688` 被误写成《城市道路工程设计规范》这类肉眼无法发现的引用错误；
- **`query.py --check`**：26 条固定回归用例，断言典型口语的首选命中不退化，改匹配算法或数据后可立即发现召回倒退；
- **可复现构建**：`build_index.py` / `build_web.py` 的输出对同一份数据字节稳定，不会产生幻影 diff（产物不含构建时间戳；重建后若 `git diff` 出现改动，说明数据与索引/网页真的不同步了）。

## 已知局限

诚实地列出边界，避免误用：

1. **网页转换器的消歧是"取第一个候选"**，不做上下文判断。"叫了个拖车，路边充电桩又坏了"这类城市语境会被判成高速公路术语。术语卡里附带了"该说法也可指"提示，但改写文本用的是未必正确的那一个。**需要可靠消歧请用 Skill 或自行接入模型判断。**
2. **网页的术语化改写是字面替换**，长句可能产出不通顺的句子（如"车根本交通拥堵"）。它应被视为提示，不是终稿。
3. **`standards` 覆盖率仅 18%**（148/807）。未标注不代表无标准可依，只是尚未逐条核实——凭记忆填编号有风险，宁可留空。
4. **语料为人工构造，未从真实语料抽取。** 口语说法的"地道度"依赖编写者的语感与地域经验，覆盖面不等于分布真实性。若用于训练或评测，建议先与真实文本对照验证。
5. **英文术语采用交通工程惯用译法**，与特定出版物用词可能存在差异（如 指示标志 用 `mandatory sign`）。

## 目录结构

```
Traffic_terminology/
├── README.md
├── data/                            # 语料数据（JSONL，按领域分文件）
├── web/                             # 网页版转换器（纯静态，可直接打开）
│   ├── index.html / style.css / app.js
│   └── data.js                      # 前端数据（脚本生成）
├── skill/traffic-terminology/
│   ├── SKILL.md                     # 可直接投入使用的 AI Skill
│   └── references/
│       ├── colloquial_index.json    # 口语→术语反向索引（脚本生成）
│       └── slices/                  # 按数据文件切分的 8 个分片 + manifest.json
└── scripts/
    ├── validate.py                  # 数据校验与口径回归
    ├── build_index.py               # 生成反向索引与领域分片
    ├── build_web.py                 # 生成网页前端数据 data.js
    ├── run_all.py                   # 串起校验与全部重建步骤
    └── query.py                     # 命令行查询（含 --check 回归用例）
```

## 数据维护约定

- 新增词条按所属领域追加到对应 JSONL 末尾，ID 顺延，不复用已删除的 ID；
- `colloquial` 的说法应尽量口语化、多地域（北方「便道」、南方「人行道」），这是本库的核心价值；
- 口语字段允许出现与 `term_zh` 同名的自引用——反向索引只按 `colloquial` 建键，删掉会让这些精确词从索引里消失；
- 修改数据后运行 `python scripts/run_all.py`，保持校验、索引与网页三者同步；
- `web/data.js` 与 `references/` 下的文件由脚本生成，不要手工编辑。

## 许可

本仓库的**语料数据与脚本代码均采用 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)**（署名 4.0 国际），完整法律文本见根目录 `LICENSE`。

你可以自由复制、 redistribute、改编、用于商业目的，前提是：

- **署名**：注明本语料库的名称与来源链接，并说明你是否做过修改；
- **数据库权利**：本库属于受汇编与数据库保护的数据集合，许可证含 *Sui Generis Database Rights*（见 `LICENSE` Section 4），批量抽取词条构建衍生数据集同样需要署名；
- **无担保**：语料为人工构造，许可证与 `LICENSE` Section 5 均不含任何正确性担保。用于安全、合规或法律结论前请自行核对。

引用时可写作：

> 交通用语语料库（Traffic Terminology Corpus），https://github.com/Luz7818/traffic-terminology ，CC BY 4.0。

BibTeX：

```bibtex
@misc{traffic_terminology_corpus_2026,
  title  = {Traffic Terminology Corpus: Colloquial to Standard Traffic Engineering Terminology (Chinese--English)},
  author = {Luz},
  year   = {2026},
  url    = {https://github.com/Luz7818/traffic-terminology},
  note   = {807 terms, 2038 colloquial expressions, CC BY 4.0}
}
```

## 关于数据准确性

所有术语、定义与英文译法由人工编写并经过逐条通读复核，国标编号与名称的对应关系经过公开标准平台核实。但仍可能存在术语学界的用词分歧或标准更新导致的引用过时——发现问题欢迎提 issue。
