# 给 AI 的项目说明

> 用途：给 AI 编码助手。这里是事实与约束，不含介绍性文字。改动本仓库前先读这份。
> README.md 与 docs/上手手册.md 里被引用的事实以本文件为准，它们只链接不复述。

## 一句话

一份中英对照的交通术语语料库（数据 + 校验构建脚本 + 纯静态网页 + AI Skill），
没有运行时服务，也没有数据库，所有产物都是仓库内的文本文件。

## 当前真实状态

| 项 | 值 | 复核命令 |
|---|---|---|
| 词条数 | 807 条 | `python scripts/validate.py` |
| 数据校验 | 0 错误 0 警告 | `python scripts/validate.py` |
| 歧义口语 | 12 组，均带消歧字段 | `python scripts/validate.py` |
| 查询回归 | 26/26 用例通过 | `python scripts/query.py --check` |
| 标准登记表 | 23 条编号与名称对应 | `python scripts/validate.py`（读 `STANDARDS_REGISTRY`） |
| 第三方依赖 | 无（只用标准库） | `python scripts/run_all.py` |
| CI | 无工作流；门禁就是上一条那行命令 | `python scripts/run_all.py` |
| 网页匹配键数 | 2036 个（去括注后去重口径） | `python scripts/build_web.py` |
| 原始口语去重数 | 2038 条（另一口径，见「约定」第 5 条） | `python scripts/build_index.py` |

## 仓库地图

| 路径 | 职责 | 关键点 |
|---|---|---|
| `data/` | 语料本体，唯一的手工编辑对象 | 8 个 `.jsonl`，一行一条记录，字段约束见 `data/README.md` |
| `scripts/` | 校验、重建、查询、门禁 | 全部零依赖；`run_all.py` 是唯一的总入口 |
| `web/` | 静态网页转换器 | `data.js` 是脚本产物；`app.js` 里有独立的匹配实现 |
| `skill/traffic-terminology/` | 可直接安装的 AI Skill | `references/` 下全是脚本产物，可脱离 `data/` 独立使用 |
| `docs/` | 上手手册 | `docs/上手手册.md` |

## 关键约定（违反会出问题的才列）

1. **生成物不要手改**：`web/data.js`、`skill/traffic-terminology/references/` 下的索引与
   分片都由脚本写出，手改会在下一次 `run_all.py` 时被整体覆盖。改数据或改脚本，再重建。
2. **产物里不放时间戳**：`build_web.py` 的 `meta` 只有 `entries` 和 `colloquial`。
   曾经有 `generated: date.today()`，导致每次重建都产生幻影 diff，与「字节稳定」的承诺冲突。
   重建后如果 `git diff` 有改动，那一定是数据真的变了。
3. **ID 不复用**：删除词条后其 ID 永久作废，新增用该前缀下的下一个序号（四位补零）。
   复用于旧 ID 会让历史引用与分片指向错的词条。
4. **三项校验只到警告级**：`related` 指向不存在的术语、`term_en` 两条重复、歧义口语缺
   `disambiguation` —— 这三项 `validate.py` 记 warning 而非 error，所以输出里的「警告 0 项」
   才是干净状态，别只看「错误 0 项」。报 warning 时不要顺手把整行引用删掉，先确认是不是拼写问题。
5. **`FILE_ORDER` 在三个脚本里各写一份**：`build_index.py`、`build_web.py`、`query.py` 各自维护
   要读哪 8 个数据文件。新增文件必须三处都加：前两处漏了分别表现为静默跳过与
   `FileNotFoundError`，`query.py` 漏了则命令行查不到但不报错。
6. **两种口语计数并存**：原始写法去重 2038、去括注后的匹配键 2036。差值是「地道（部分场合）」
   「闪黄灯（口误）」两组括注写法并入主形。写文档时必须说清用哪个口径，只写数字会再次漂移。
7. **8 个文件不等于 8 类**：`08_safety_parking.jsonl` 同时含「交通安全」与「静态交通（停车）」
   两类 `category`，所以是 8 个数据文件 / 9 类标签。分片按文件切，切片的 `category` 字段
   是该文件内类别的集合，不是首条记录的类别。`validate.py` 不校验 `category` 与文件的对应。
8. **命令行匹配度是固定档位，不是连续分**：`query.py` 的 `score()` 只返回
   100（口语完全相同）/ 90（中英文术语完全相同）/ 80（口语子串）/ 70（中文术语子串）/
   60（英文子串）/ 40（关联词）/ 30（定义命中）这几档，取最高档；命中最多展开前 8 条。
   网页侧 `web/app.js` 的 `analyze()` 是另一套最长优先扫描匹配，两边算法与分值体系不同。
9. **网页与命令行是两套匹配实现**：`web/app.js` 的 `convert()` 与 `scripts/query.py` 各自
   独立。只改一边就会出现"网页和命令行结果不一致"，回归用例只覆盖命令行那一侧。

## 改动后的验证

| 动了什么 | 必须跑 |
|---|---|
| `data/*.jsonl` | `python scripts/run_all.py` |
| `scripts/build_index.py` / `scripts/build_web.py` | `python scripts/run_all.py` |
| `scripts/query.py` 的匹配或排序 | `python scripts/query.py --check` |
| `web/app.js` | 打开 `web/index.html` 手测（无自动化），并跑 `python scripts/run_all.py` 确认产物一致 |
| `skill/` 下的 `SKILL.md` | 手工重装一次 Skill 并让助手转一句，确认仍走库内译法 |

`run_all.py` 的顺序是 校验 → 重建索引 → 重建网页数据 → 查询回归，任一步失败即中止并
返回非 0。它的退出码就是这个仓库的门禁。

## 已知坑

- Windows 控制台默认 GBK，脚本输出中文会乱码；用管道捕获时更会变成
  `UnicodeDecodeError`。先 `set PYTHONIOENCODING=utf-8`。
- 分支名是 `master`（其余仓库多为 `main`），推错分支不会报错但不会更新页面。
- 仓库根不是 git 仓库，`Traffic_terminology/` 自身才是；同级还有 6 个互不关联的仓库。
- 网页消歧取首个候选、改写按字面替换，这两点没有测试覆盖，属已知设计取舍而非 bug，
  不要"顺手修好"，改动会牵动第 7 条的双实现同步问题。
- `validate.py` 的 standards 校验只比对登记表里的编号与名称是否配套，不判断该术语是否
  真的归这个标准管。

## 不要做的事

- 不要为了"看起来有 CI"给这个仓库加打包、格式化或类型检查工具；它的门禁是文本一致性，
  `run_all.py` 已经覆盖。
- 不要在 README 或手册里另写一套数字。所有规模数字改到 `AGENTS.md` 的「当前真实状态」，
  其他文档指向这里。
- 不要把 `web/data.js` 或 `references/` 的改动单独提交而不带源数据改动 —— 那说明源数据
  没同步，反了。
