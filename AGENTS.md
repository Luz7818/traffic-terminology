# AGENTS.md —— 项目协作与代码开发规范（唯一权威入口）

> 用途：给 AI 编码助手与所有开发者。这里是规范入口与索引：目标、原则、流程、模块规则、
> 维护矩阵、阅读清单都在这份文件里。细则一律链接到对应文件，冲突时以细则文件为准并回改本文件。
> 被别的文档引用的事实（词条数、口径、命令、路径）以本文件的「当前状态」为准，其他文档只链接不复述。

## 项目目标

- 定位：中英对照的交通术语语料库（数据 + 校验构建脚本 + 纯静态网页 + AI Skill），没有运行时
  服务、没有数据库，所有产物都是仓库内的文本文件。
- 核心功能：口语→术语转换（网页/CLI/AI Skill 三入口）、数据校验与字节稳定重建、方言对照层。
- 技术栈：Python 标准库（3.8+）+ 原生 JS 静态页，零第三方依赖（复核：`python scripts/run_all.py`）。
- 详情：[README.md](README.md)、[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## 开发原则

1. 正确性优先。
2. 可维护性优先。
3. 代码简洁、项目简洁。
4. 小步迭代。
5. 单模块开发。
6. 每个改动必须有明确设计与验收标准。
7. 禁止一次生成整个项目。
8. 禁止跳步开发。

执行口径：先想后写（假设与歧义先挑明）；最简优先（不加没要求的功能与抽象——本仓连测试框架
都不引入，门禁是文本一致性）；外科手术式改动（不动无关代码，每行改动可追溯到需求）；目标驱动
（先有可验证判据再动手，宣称完成前先跑通 [docs/TESTING.md](docs/TESTING.md) 的 `run_all.py`）。

## 开发流程

**分析 → 设计 → 实现 → 测试 → 文档更新 → Git提交 → 等待确认**。不得跳过任何阶段。

| 阶段 | 产出物 | 放行标准 |
|---|---|---|
| 分析 | 影响面清单（数据/脚本/网页/Skill 哪一侧，口径是否变化） | 影响面说全 |
| 设计 | 方案说明（数据格式变化、口径变化、回退方式） | 验收标准已定义；与更简方案比较过 |
| 实现 | 代码与数据 | 只含设计内改动；生成物由脚本重建不手改 |
| 测试 | 门禁结果 | `python scripts/run_all.py` 退出码 0 |
| 文档更新 | 受影响文档 diff | 维护矩阵逐项过完 |
| Git提交 | 提交 | 符合 [docs/GIT.md](docs/GIT.md)，一批一提交（产物与源数据同批） |
| 等待确认 | —— | 等人确认后推送 |

## 模块开发规则

- 一个智能体一次只开发一个模块；模块完成后才能进入下一模块。
- 如需同时开发，使用多个子智能体，每个子智能体同样一次只开发一个模块。

模块完成标准（全部满足才算完成）：

1. 功能完成：达到 [TODO.md](TODO.md) 中该任务的验收标准。
2. 测试通过：符合 [docs/TESTING.md](docs/TESTING.md)（`run_all.py` 全绿）。
3. 最简原则：代码和项目架构都保持最简洁，无冗余抽象与重复实现。
4. [TODO.md](TODO.md) 更新：勾选完成项、明确下一项。
5. [HISTORY.md](HISTORY.md) 追加变更记录（数据集变化才动版本号，代码/文档变化只记本文件）。
6. 受影响的 docs 更新（按需）。
7. [README.md](README.md) 更新（如有面向使用者的变化）。
8. Commit message 符合 [docs/GIT.md](docs/GIT.md)。

## 文档维护规则

| 事件 | 需更新 |
|---|---|
| 模块完成 | `TODO.md`、`HISTORY.md`、受影响 docs |
| 数据集版本演进（新增词条/字段、修正错误） | `data/VERSION` + `HISTORY.md` + `CITATION.cff`（如引用变化） |
| 架构决策（口径、脚本单源、目录/产物约定变化） | `docs/ARCHITECTURE.md` + `HISTORY.md` 记录缘由 |
| 命令/入口/参数变化 | `README.md` / `docs/GET-START.md` / 对应子目录 README |
| 增删一级或二级目录、目录入库属性变化 | 仓根 `目录说明.md` + 父目录 README 的子目录表 |
| 规模数字（词条数/口语数/覆盖）变化 | 本文件「当前状态」，其他文档只链接 |
| 新对话/新任务开始 | 按下方阅读清单阅读 |

## 开发前阅读清单

每个新对话/新任务，按顺序阅读：

1. 本文件（`AGENTS.md`）
2. [TODO.md](TODO.md)
3. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)（13 条关键约定在这里）
4. [docs/GET-START.md](docs/GET-START.md)
5. [HISTORY.md](HISTORY.md)
6. 与任务相关的 [docs/CODE-STYLE.md](docs/CODE-STYLE.md)、[docs/TESTING.md](docs/TESTING.md)、[docs/GIT.md](docs/GIT.md)

阅读完成后**不要写代码**：先做架构评审，输出——项目理解 / 核心模块 / 模块依赖关系 / 潜在风险 /
建议优化项 / 推荐开发顺序 / 是否发现架构问题——然后等待确认。

- 工作区级纪律不在本清单里：新增/摆放文件与目录先读 `../文档标准/项目整体规范.md` §2.3（最小根判断顺序）；跨仓耦合与 Git 纪律见其 §八。
## Git 索引

- Git 规范：[docs/GIT.md](docs/GIT.md)（产物与源数据同批提交；Pages 发布链路；一批一提交）

## 当前状态

| 项 | 值 | 复核命令 |
|---|---|---|
| 词条数 | 866 条 | `python scripts/validate.py` |
| 数据校验 | 错误 0 项；警告仅三类非数据项——候选池地区提示（候选属于尚无正式库的地区）、「已是正式说法，请从候选池移除」提示与多地区共挂说明，均不阻断门禁 | `python scripts/validate.py` 看末行汇总 |
| 歧义口语 | 13 组，均带消歧字段 | `python scripts/validate.py` |
| 查询回归 | 26/26 用例通过 | `python scripts/query.py --check` |
| 网页回归 | 消歧一致 3003 键 + 句子转换 36/36（node 真跑 `web/app.js`，含方言用例） | `python scripts/web_check.py` |
| 句中改写 | 69 个词条带 `surface` 字段；方言层另有若干句中形式（得劲→好走、碰住了→相撞、死火→发生故障、巴士→公交、滑溜→湿滑等） | `python -c "import json,glob;print(sum(1 for g in sorted(glob.glob('data/*.jsonl')) for l in open(g,encoding='utf-8') if l.strip() and json.loads(l).get('surface')))"` |
| 方言对照库 | 6 个地区（江苏 5、河南 9、广东 5、东北 3、上海 2、四川 4，共 28 条）另设 250 条待核实候选池（candidates.jsonl，机器逐文件精梳两轮、不进产品，validate 校验并聚合地区提示）；通用模式合并全部地区方言、选定地区只叠加该地区，主库优先 | `python -c "import json,glob;print({p.split(chr(92))[-1]: len(json.load(open(p,encoding='utf-8'))['entries']) for p in glob.glob('data/dialect/*.json')})"` |
| 静态资源缓存 | 静态资源带 `?v=数据集版本-u<序号>` 缓存参数（当前 1.1.0-u14），改 web/ 源文件就递增序号 | `grep -o 'v=1.1.0-u[0-9]*' web/index.html` |
| 数据集版本 | 1.1.0（`data/VERSION`，演进见 `HISTORY.md`，引用见 `CITATION.cff`） | `cat data/VERSION` |
| 标准登记表 | 23 条编号与名称对应 | `python scripts/validate.py`（读 `STANDARDS_REGISTRY`） |
| 标准依据覆盖 | 158/866（18.2%），分文件报表 | `python scripts/validate.py --coverage` |
| 第三方依赖 | 无（Python 只用标准库；`web_check.py` 的句子回归另需 node，缺了会跳过并提示） | `python scripts/run_all.py` |
| CI | 只有一个发布工作流：推 `main`（过渡期 `master` 也触发）把 `web/` 原样发到 GitHub Pages（无构建步骤）。数据与回归门禁仍只在本地跑。**这里不写"最近一次是哪个提交"**——分支每推一次它就变，写进文档同一次提交里就作废了；当前分支 HEAD 的徽章为 `passing`（复核见右）。历史上首次发布失败过一次，原因是 Pages 未在仓库设置里开启，已由 workflow 里的 `enablement: true` 自助开启（两段真实报错见 `docs/ARCHITECTURE.md` 关键约定 11）。本机没有 `gh`，但徽章与 Actions 接口对**公开仓都免认证**；URL 里用仓库名 `traffic-terminology`，不是目录名（后者 404）。要提交号再用 `/actions/runs`（匿名限 60 次/小时/IP） | `python -c "import urllib.request as u;b=u.urlopen(u.Request('https://github.com/Luz7818/traffic-terminology/workflows/Deploy%20to%20GitHub%20Pages/badge.svg',headers={'User-Agent':'Mozilla/5.0'}),timeout=30).read().decode();print('passing' in b)"` 应为 `True`；另 `ls .github/workflows`、`python scripts/run_all.py` |
| 在线演示 | https://luz7818.github.io/traffic-terminology/ （项目页路径由仓库名决定，不是 `/corpus/`） | `curl -s -o /dev/null -w '%{http_code}' https://luz7818.github.io/traffic-terminology/data.js` 得 200 |
| 网页口语匹配键数 | 2211 个（去括注后去重口径）；含标准术语的总匹配键 3003 个 | `python scripts/web_check.py`（打印总数） |
| 原始口语去重数 | 2215 条（另一口径，见 `docs/ARCHITECTURE.md` 数据组织方式） | `python scripts/build_index.py` |

## 已知坑（省下一次的调查时间）

- **`surface` 字段**（69 个词条）给出谓词性口语在句子里的规范替换形式，键必须是本条
  `colloquial` 的原文（validate 强制），进 `web/data.js` 的 `sf`（键去括注）与 Skill 索引的
  `sf`（键保留原文）。`web/app.js` 的 `SMOOTH_RULES` 是替换后的字面平滑规则，纯字面、按序
  应用一次；新增规则必须同时在 `web_check.py` 的 `CONVERT_CASES` 里加句子用例。
- Windows 控制台默认 GBK，脚本输出中文会乱码；用管道捕获时更会 `UnicodeDecodeError`。
  先 `set PYTHONIOENCODING=utf-8`。
- 仓库根 `Project/` 不是 git 仓库，`Traffic_terminology/` 自身才是；同级还有多个互不关联的仓库。
- 网页消歧是"按 CLI 分值排序后的首候选"，仍不看上下文；句中改写有 `surface` +
  `SMOOTH_RULES` 两层兜底，长句仍可能不顺——有回归锁定，改行为请连用例一起改。
- 「电动车」「电瓶车」在网页扫描里被掩码（`MASK_TERMS`）：内部的「动车」等键不参与匹配。
  新增掩码词要同步 `web_check.py` 用例。
- CLI 查询会做子串匹配，可能命中不带该匹配键的词条；网页只按精确键扫描。两侧排序口径已
  统一，但极端子串场景下候选集合仍可能不同，属已知设计取舍。
- `validate.py` 的 standards 校验只比对登记表编号与名称配套，不判断术语是否真归该标准管。
- 不要为了"看起来有 CI"加打包、格式化或类型检查工具；不要在 README 或手册里另写一套数字
  （规模数字以本文件「当前状态」为准）；不要把产物改动单独提交而不带源数据改动。
