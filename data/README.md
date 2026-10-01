# data/ —— 语料本体

> 用途：说明这个目录负责什么、每条记录的字段约束、加词条时的规则。
> 这里是全仓库唯一需要手工编辑的数据目录；`web/` 与 `skill/` 下的内容都由它生成。

存的是术语记录本身：一行一条 JSON（`.jsonl`），8 个文件按领域划分，共 866 条
（复核：`python scripts/validate.py`）。所有查询、网页、AI Skill 用的索引都是从这里
重建出来的，改这里就等于改整个项目的行为。

## 文件清单

| 文件 | 领域 | ID 前缀 | 条数 |
|---|---|---|---|
| `01_road_infrastructure.jsonl` | 道路与基础设施 | ROAD | 116 |
| `02_intersection.jsonl` | 交叉口与标志标线 | INTX | 100 |
| `03_signal_control.jsonl` | 交通信号控制 | SIG | 115 |
| `04_traffic_flow.jsonl` | 交通流与拥堵 | FLOW | 100 |
| `05_public_transit.jsonl` | 公共交通 | TRANSIT | 111 |
| `06_freeway.jsonl` | 高速公路 | FWY | 93 |
| `07_its.jsonl` | 智能交通 | ITS | 96 |
| `08_safety_parking.jsonl` | 交通安全（108）+ 静态交通（停车）（27） | SAFE | 135 |

`08` 一个文件里有两类 `category`，所以全库是 8 个文件 / 9 类标签。查某个前缀当前最大 ID：

```bash
python -c "import json;print(max(json.loads(l)['id'] for l in open('data/03_signal_control.jsonl',encoding='utf-8')))"
```

## 子目录

| 子目录 | 负责 |
|---|---|
| `dialect/` | 方言对照层：每地区一个 `<地区>.json` 正式库（江苏、河南、广东、东北、上海、四川）+ 机器整理的 `candidates.jsonl` 待核实候选池，收录标准与候选→正式流程见下方「和谁打交道」 |

## 字段约束

| 字段 | 必填 | 约束（由 `scripts/validate.py` 强制） |
|---|---|---|
| `id` | ✓ | `<前缀>-<四位数字>`，前缀须与所在文件一致，全库唯一，删除后不复用 |
| `term_zh` | ✓ | 全库唯一（重复报 error）；不得有首尾空白 |
| `term_en` | ✓ | 不得含中文字符或中文标点（error）；两条术语共用同一英文只报 warning |
| `category` | ✓ | 领域标签，需与文件覆盖的类别一致（校验目前不比对这一项，靠人工） |
| `definition` | ✓ | 简明专业定义，不得有首尾空白 |
| `colloquial` | ✓ | 列表，至少 1 项；全库现有 2215 个不同写法（复核：`python scripts/build_index.py`） |
| `related` | ✗ | 列表，每项必须能解析为库内已存在的 `term_zh` 或口语说法，否则报 warning |
| `standards` | ✗ | 单个字符串，格式「编号 名称」；编号若在登记表里，名称必须完全一致 |
| `disambiguation` | 条件必填 | 该词条的口语说法与其他词条重叠时应写，说明什么语境取哪个。缺失记为 warning（不计入 error），但会让「干净状态」破掉 |
| `surface` | ✗ | 对象，键必须是本条 `colloquial` 的原文（校验强制），值是该说法**在句子中**的规范替换形式。用途：口语「堵死了」是谓词、术语「严重拥堵」是名词，整句改写若按字面替换会产出病句，`surface` 给出句中形式（「陷入严重拥堵」）。进 `web/data.js` 的 `sf`（键去括注）与 Skill 索引的 `sf`（键保留原文）。给谓词性口语补字段时优先加在这里 |

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
- **方言对照层**：`dialect/` 目录下的 `<地区>.json`（每地区一个库）是可选叠加，不属于
  本目录的 8 个 `.jsonl` 主库；`phrase` 必须映射到主库词条 ID（validate.py 强制），
  与主库口语键撞车的条目会被记为 warning 且在网页里不生效（主库优先）。
  **收录标准**：真实性优先于数量——每条必须能举出真实使用例句；单字歧义词不收
  （如「赖」），只收短语框架；同一说法多地区共挂同一条允许（validate 记提示），
  映射到不同词条报 error。
  **候选→正式流程**：`dialect/candidates.jsonl` 是机器整理的待核实池（status=待核实，
  不进 build_web / Skill 管线）；核实步骤＝①确认说法真实（问本地人/找语料）②定锚点
  词条（缺则先建主库词条）③移入对应 `<地区>.json` 并写 surface 与 note ④加
  `web_check.py` 用例 ⑤重建。候选池规模上不封顶，但未核实条目严禁直接进正式库。
- **下游**：`scripts/build_index.py` → `skill/traffic-terminology/references/`；
  `scripts/build_web.py` → `web/data.js`；`scripts/query.py` 与 `scripts/validate.py` 直接读这里。
- **改这里之后要跑**：`python scripts/run_all.py`。

## 别动

- **`web/data.js` 与 `skill/traffic-terminology/references/` 下的索引和分片都是这里的产物**：
  直接改它们看着最快，下一次 `python scripts/run_all.py` 会整文件覆盖（AGENTS.md 关键约定 1）。
- **产物里不许加时间戳**：`build_web.py` 的 `meta` 只有 `entries` 与 `colloquial` 两个键。
  曾写过 `generated: date.today()`，每次重建都出幻影 diff（判据：下面 D-2）。
- **ID 删除后永久作废、不得复用**：分片与 `related` 都按 ID 寻址，复用旧号会让历史引用
  指向另一条术语（AGENTS.md 关键约定 3）。当前无空洞，判据见下面 D-1。
- **66 项与 `term_zh` 完全相同的自引用不是笔误**：反向索引只按 `colloquial` 建键，
  删掉一项这个术语在 Skill 侧就查不到（复核：A 组）。
- **1743 项 `related` 是引用而不是标签**：删一条术语只会让指向它的引用降级成 warning，
  所以要看「警告 0 项」而不是只看「错误 0 项」（复核：B 组与 `python scripts/validate.py`）。
- **2215 与 2211 两个口语计数都要留着**：差值是「地道（部分场合）」「闪黄灯（口误）」
  「便道（北方叫法）」「马葫芦盖（东北叫法）」四组括注并入同名键，别为"统一口径"去删括注（AGENTS.md 关键约定 6）。
- **别顺手统一行尾**：本目录 8 个 `.jsonl` 是 CRLF、`scripts/*.py` 是 LF，
  `.gitattributes` 里的 `* -text` 就是不让 git 去转（复核：C 组）。

五条命令都在仓库根执行，注释写在每条上方，是它的预期输出：

```bash
# A：输出 66
python -c "import json,glob;print(sum(json.loads(l)['term_zh'] in json.loads(l)['colloquial'] for g in sorted(glob.glob('data/*.jsonl')) for l in open(g,encoding='utf-8') if l.strip()))"
# B：输出 1743
python -c "import json,glob;print(sum(len(json.loads(l).get('related',[])) for g in sorted(glob.glob('data/*.jsonl')) for l in open(g,encoding='utf-8') if l.strip()))"
# C：输出 116 与 0（数据文件带 CR、脚本不带）
python -c "print([(p,open(p,'rb').read().count(b'\r\n')) for p in ['data/01_road_infrastructure.jsonl','scripts/build_index.py']])"
# D-1：八行，每行「条数 = 该前缀最大 ID 序号」，相等即没有空洞
python -c "import json,glob;[print(p,sum(1 for l in open(p,encoding='utf-8') if l.strip()),max(int(json.loads(l)['id'].rsplit('-',1)[1]) for l in open(p,encoding='utf-8') if l.strip())) for p in sorted(glob.glob('data/*.jsonl'))]"
# D-2：重建两份产物之后 git status 里不出现 web/data.js 与 references 行，即产物字节未变
python scripts/build_index.py && python scripts/build_web.py && git status --porcelain
```

上面「2215 与 2211」那两个口语计数另有现成口径：`python scripts/build_index.py` 打印 2215
（原始写法去重），`python scripts/build_web.py` 打印 2211（去括注后的网页匹配键）。
