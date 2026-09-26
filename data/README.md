# data/ —— 语料本体

> 用途：说明这个目录负责什么、每条记录的字段约束、加词条时的规则。
> 这里是全仓库唯一需要手工编辑的数据目录；`web/` 与 `skill/` 下的内容都由它生成。

存的是术语记录本身：一行一条 JSON（`.jsonl`），8 个文件按领域划分，共 807 条
（复核：`python scripts/validate.py`）。所有查询、网页、AI Skill 用的索引都是从这里
重建出来的，改这里就等于改整个项目的行为。

## 文件清单

| 文件 | 领域 | ID 前缀 | 条数 |
|---|---|---|---|
| `01_road_infrastructure.jsonl` | 道路与基础设施 | ROAD | 103 |
| `02_intersection.jsonl` | 交叉口与标志标线 | INTX | 96 |
| `03_signal_control.jsonl` | 交通信号控制 | SIG | 115 |
| `04_traffic_flow.jsonl` | 交通流与拥堵 | FLOW | 95 |
| `05_public_transit.jsonl` | 公共交通 | TRANSIT | 101 |
| `06_freeway.jsonl` | 高速公路 | FWY | 90 |
| `07_its.jsonl` | 智能交通 | ITS | 91 |
| `08_safety_parking.jsonl` | 交通安全（90）+ 静态交通（停车）（26） | SAFE | 116 |

`08` 一个文件里有两类 `category`，所以全库是 8 个文件 / 9 类标签。查某个前缀当前最大 ID：

```bash
python -c "import json;print(max(json.loads(l)['id'] for l in open('data/03_signal_control.jsonl',encoding='utf-8')))"
```

## 字段约束

| 字段 | 必填 | 约束（由 `scripts/validate.py` 强制） |
|---|---|---|
| `id` | ✓ | `<前缀>-<四位数字>`，前缀须与所在文件一致，全库唯一，删除后不复用 |
| `term_zh` | ✓ | 全库唯一；不得有首尾空白 |
| `term_en` | ✓ | 全库唯一；不得含中文字符或中文标点（校验强制） |
| `category` | ✓ | 领域标签，需与文件覆盖的类别一致（校验目前不比对这一项，靠人工） |
| `definition` | ✓ | 简明专业定义，不得有首尾空白 |
| `colloquial` | ✓ | 列表，至少 1 项；全库现有 2038 个不同写法（复核：`python scripts/build_index.py`） |
| `related` | ✗ | 列表，每项必须能解析为库内已存在的 `term_zh` 或口语说法，否则报 warning |
| `standards` | ✗ | 单个字符串，格式「编号 名称」；编号若在登记表里，名称必须完全一致 |
| `disambiguation` | 条件必填 | 该词条的口语说法与其他词条重叠时必须写，说明什么语境取哪个 |

## 加词条的顺序

1. 选对文件，在末尾追加一行。
2. `id` 取该前缀下一个序号（四位补零）。
3. `colloquial` 尽量给出多地域说法（便道/人行道、马路牙子/道牙/路沿石）。
   允许包含与 `term_zh` 完全相同的自引用：反向索引只按 `colloquial` 建键，删掉它这个
   精确词就从索引里消失了。
4. 拿不准国标编号与名称是否配套时留空。凭记忆填编号的风险比不填大。
5. 跑 `python scripts/run_all.py`，它会把校验、索引、网页、回归一次走完。

## 和谁打交道

- **上游**：人工编写与复核，没有自动抽取来源。
- **下游**：`scripts/build_index.py` → `skill/traffic-terminology/references/`；
  `scripts/build_web.py` → `web/data.js`；`scripts/query.py` 与 `scripts/validate.py` 直接读这里。
- **改这里之后要跑**：`python scripts/run_all.py`。
