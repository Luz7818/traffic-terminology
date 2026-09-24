# 交通用语语料库（Traffic Terminology Corpus）

将日常口语化、模糊的交通表述映射为标准交通工程术语的中英对照语料库，用于制作 AI Skill、提示词及交通领域自然语言处理应用。

例如：

| 口语说法 | 标准术语 | 英文 |
|---|---|---|
| 红绿灯路口 | 信号交叉口 | signalized intersection |
| 加塞 | 违法变更车道 | illegal lane changing |
| 堵死了 | 严重拥堵 | severe congestion |
| 马路牙子 | 路缘石 | curb |
| 一路绿灯 | 绿波协调控制 | green wave coordination |

## 目录结构

```
Traffic_terminology/
├── README.md                        # 本文件
├── data/                            # 语料数据（JSONL，按领域分文件）
├── web/                             # 网页版转换器（纯静态，可直接打开）
│   ├── index.html
│   ├── style.css
│   ├── app.js
│   └── data.js                      # 前端数据（脚本生成，内嵌词条与短语词典）
├── skill/traffic-terminology/
│   ├── SKILL.md                     # 可直接投入使用的 AI Skill
│   └── references/
│       ├── colloquial_index.json    # 口语→术语反向索引（脚本生成）
│       └── slices/                  # 按领域切分的 8 个分片 + manifest.json
└── scripts/
    ├── validate.py                  # 数据校验
    ├── build_index.py               # 生成反向索引与统计
    ├── build_web.py                 # 生成网页前端数据 data.js
    ├── run_all.py                   # 串起校验与全部重建步骤
    └── query.py                     # 命令行查询工具（含 --check 回归用例）
```

## 数据格式

每个 `data/*.jsonl` 文件每行一条 JSON 记录：

```json
{
  "id": "SIG-0001",
  "term_zh": "信号交叉口",
  "term_en": "signalized intersection",
  "category": "交通信号控制",
  "definition": "设有交通信号灯并按信号配时规则分配交叉口通行权的交叉口。",
  "colloquial": ["红绿灯路口", "有红绿灯的路口", "信号灯路口"],
  "related": ["无信号交叉口", "环形交叉口", "信号相位"],
  "standards": "GB 14886 道路交通信号灯设置与安装规范"
}
```

### 字段说明

| 字段 | 必填 | 说明 |
|---|---|---|
| `id` | ✓ | 领域前缀 + 4 位序号，全局唯一（ROAD/INTX/SIG/FLOW/TRANSIT/FWY/ITS/SAFE） |
| `term_zh` | ✓ | 标准中文术语 |
| `term_en` | ✓ | 标准英文术语 |
| `category` | ✓ | 领域分类 |
| `definition` | ✓ | 简明专业定义 |
| `colloquial` | ✓ | 口语/模糊说法列表（核心字段，≥1 条） |
| `related` | ✗ | 关联术语，辅助消歧与上下文理解 |
| `disambiguation` | ✗ | 该术语与其他术语共享口语说法时的取舍说明；歧义口语涉及的词条必填，`validate.py` 会检查覆盖情况 |
| `standards` | ✗ | 参考的国家/行业标准规范 |

## 领域划分与统计

| 文件 | 领域 | 前缀 | 词条数 |
|---|---|---|---|
| `01_road_infrastructure.jsonl` | 道路与基础设施 | ROAD | 103 |
| `02_intersection.jsonl` | 交叉口与标志标线 | INTX | 96 |
| `03_signal_control.jsonl` | 交通信号控制 | SIG | 115 |
| `04_traffic_flow.jsonl` | 交通流与拥堵 | FLOW | 95 |
| `05_public_transit.jsonl` | 公共交通 | TRANSIT | 101 |
| `06_freeway.jsonl` | 高速公路 | FWY | 90 |
| `07_its.jsonl` | 智能交通 | ITS | 91 |
| `08_safety_parking.jsonl` | 交通安全与停车 | SAFE | 116 |
| **合计** | | | **807** |

收录口语说法共 **2038** 个（含一词多义），平均每条术语 2.5 个说法，无只有单一口语的词条。数据变动后运行 `python scripts/build_index.py` 可重新生成索引与统计。

## 使用方法

```bash
# 一条命令跑完：校验 -> 重建索引 -> 重建网页数据 -> 查询回归用例
python scripts/run_all.py

# 也可以分步执行
python scripts/validate.py          # 数据校验（0 错误才算通过）
python scripts/build_index.py       # 重新生成反向索引与统计
python scripts/build_web.py         # 重新生成网页数据 data.js

# 查询（支持口语说法、术语、英文的模糊匹配）
python scripts/query.py "红绿灯路口"
python scripts/query.py 加塞
python scripts/query.py green wave
python scripts/query.py --check     # 26 条内置回归用例，防召回退化
```

## 网页版转换器

直接双击打开 `web/index.html` 即可使用（纯静态页面，无需服务器；也可用 `python -m http.server` 起服务后访问）。功能：

- **口语转换**：输入一段口语化描述，自动识别其中所有交通表述，输出术语化改写（高亮）、原文对照和术语卡片（中英对照、定义、领域、关联词、标准依据、歧义候选），支持一键复制、历史记录、Ctrl+Enter 快捷转换；
- **术语库**：807 条术语的浏览与检索（支持术语、英文、口语说法、定义搜索 + 按领域筛选），点击查看详情弹窗。

数据更新后运行 `python scripts/build_web.py` 重新生成 `web/data.js` 即可同步到网页。

## 作为 AI Skill 使用

将 `skill/traffic-terminology/` 目录整体复制到目标 AI 工具的 skills 目录即可。Skill 的工作方式：

1. 从用户输入中识别口语化交通表述；
2. 查询 `references/colloquial_index.json` 反向索引匹配标准术语（`index` 给出候选词条 ID，正文在 `entries`）；
3. 输出「标准术语 + 英文 + 定义 + 消歧说明」，未命中时按语义最近邻回退并标注置信度。

索引是归一化结构：词条正文只存一份，所以整包 319 KB（同一份数据若按口语逐条展开会是 567 KB）。上下文预算紧张时可改读 `references/slices/` 下按领域切分的 8 个分片（每片 35–48 KB），先查 `slices/manifest.json` 决定加载哪片。注意有 12 组口语跨领域歧义（如「路牌」「充电桩」），领域不确定时仍应回查整包索引。

## 数据维护约定

- 新增词条时按所属领域追加到对应 JSONL 文件末尾，ID 顺延，不要复用已删除的 ID；
- `colloquial` 中的说法应尽量口语化、多地域（如北方「便道」、南方「人行道」），这是本库的核心价值；
- 修改数据后必须运行 `python scripts/validate.py` 与 `python scripts/build_index.py` 保持索引同步；
- 同一口语说法映射到多个术语属正常现象，但相关词条必须写 `disambiguation` 说明取舍；`validate.py` 会检查是否全覆盖，未覆盖则输出警告。
