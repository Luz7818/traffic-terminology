# 给 AI 的项目说明

> 用途：给 AI 编码助手。这里是事实与约束，不含介绍性文字。改动本仓库前先读这份。
> README.md 与 docs/getting-started.md 里被引用的事实以本文件为准，它们只链接不复述。

## 一句话

一份中英对照的交通术语语料库（数据 + 校验构建脚本 + 纯静态网页 + AI Skill），
没有运行时服务，也没有数据库，所有产物都是仓库内的文本文件。

## 当前真实状态

| 项 | 值 | 复核命令 |
|---|---|---|
| 词条数 | 866 条 | `python scripts/validate.py` |
| 数据校验 | 错误 0 项；警告仅两类非数据项——候选池地区提示（候选属于尚无正式库的地区）与多地区共挂说明，均不阻断门禁 | `python scripts/validate.py` 看末行汇总 |
| 歧义口语 | 13 组，均带消歧字段 | `python scripts/validate.py` |
| 查询回归 | 26/26 用例通过 | `python scripts/query.py --check` |
| 网页回归 | 消歧一致 3003 键 + 句子转换 36/36（node 真跑 `web/app.js`，含方言用例） | `python scripts/web_check.py` |
| 句中改写 | 69 个词条带 `surface` 字段；方言层另有若干句中形式（得劲→好走、碰住了→相撞、死火→发生故障、巴士→公交、滑溜→湿滑等） | `python -c "import json,glob;print(sum(1 for g in sorted(glob.glob('data/*.jsonl')) for l in open(g,encoding='utf-8') if l.strip() and json.loads(l).get('surface')))"` |
| 方言对照库 | 6 个地区（江苏 5、河南 9、广东 5、东北 3、上海 2、四川 4，共 28 条）另设 250 条待核实候选池（candidates.jsonl，机器逐文件精梳两轮、不进产品，validate 校验并聚合地区提示）；通用模式合并全部地区方言、选定地区只叠加该地区，主库优先 | `python -c "import json,glob;print({p.split(chr(92))[-1]: len(json.load(open(p,encoding='utf-8'))['entries']) for p in glob.glob('data/dialect/*.json')})"` |
| 静态资源缓存 | 静态资源带 `?v=数据集版本-u<序号>` 缓存参数（当前 1.1.0-u12），改 web/ 源文件就递增序号 | `grep -o 'v=1.1.0-u[0-9]*' web/index.html` |
| 数据集版本 | 1.1.0（`data/VERSION`，演进见 `CHANGELOG.md`，引用见 `CITATION.cff`） | `cat data/VERSION` |
| 标准登记表 | 23 条编号与名称对应 | `python scripts/validate.py`（读 `STANDARDS_REGISTRY`） |
| 标准依据覆盖 | 158/866（18.2%），分文件报表 | `python scripts/validate.py --coverage` |
| 第三方依赖 | 无（Python 只用标准库；`web_check.py` 的句子回归另需 node，缺了会跳过并提示） | `python scripts/run_all.py` |
| CI | 只有一个发布工作流：推 `main`（过渡期 `master` 也触发）把 `web/` 原样发到 GitHub Pages（无构建步骤）。数据与回归门禁仍只在本地跑。**这里不写"最近一次是哪个提交"**——分支每推一次它就变，写进文档同一次提交里就作废了；当前分支 HEAD 的徽章为 `passing`（复核见右）。历史上首次发布失败过一次，原因是 Pages 未在仓库设置里开启，已由 workflow 里的 `enablement: true` 自助开启（两段真实报错见「关键约定 11」）。本机没有 `gh`，但徽章与 Actions 接口对**公开仓都免认证**；URL 里用仓库名 `traffic-terminology`，不是目录名（后者 404）。要提交号再用 `/actions/runs`（匿名限 60 次/小时/IP） | `python -c "import urllib.request as u;b=u.urlopen(u.Request('https://github.com/Luz7818/traffic-terminology/workflows/Deploy%20to%20GitHub%20Pages/badge.svg',headers={'User-Agent':'Mozilla/5.0'}),timeout=30).read().decode();print('passing' in b)"` 应为 `True`；另 `ls .github/workflows`、`python scripts/run_all.py` |
| 在线演示 | https://luz7818.github.io/traffic-terminology/ （项目页路径由仓库名决定，不是 `/corpus/`） | `curl -s -o /dev/null -w '%{http_code}' https://luz7818.github.io/traffic-terminology/data.js` 得 200 |
| 网页口语匹配键数 | 2211 个（去括注后去重口径）；含标准术语的总匹配键 3003 个 | `python scripts/web_check.py`（打印总数） |
| 原始口语去重数 | 2215 条（另一口径，见「约定」第 6 条） | `python scripts/build_index.py` |

## 仓库地图

目录树本身与「每个目录的入口在哪」见仓根 [目录说明.md](目录说明.md)，本节只留职责与隐藏约束，两边不重复列目录。

| 路径 | 职责 | 关键点 |
|---|---|---|
| `data/` | 语料本体，唯一的手工编辑对象 | 8 个 `.jsonl`，一行一条记录，字段约束见 `data/README.md`；方言对照层见 `data/dialect/` |
| `scripts/` | 校验、重建、查询、门禁 | 全部零依赖；`run_all.py` 是唯一的总入口 |
| `web/` | 静态网页转换器 | `data.js` 是脚本产物；`app.js` 里有独立的匹配实现 |
| `skill/traffic-terminology/` | 可直接安装的 AI Skill | `references/` 下全是脚本产物，可脱离 `data/` 独立使用 |
| `docs/` | 上手手册 | `docs/getting-started.md` |

## 关键约定（违反会出问题的才列）

1. **生成物不要手改**：`web/data.js`、`skill/traffic-terminology/references/` 下的索引与
   分片都由脚本写出，手改会在下一次 `run_all.py` 时被整体覆盖。改数据或改脚本，再重建。
2. **产物里不放时间戳**：`build_web.py` 的 `meta` 只有 `entries` 和 `colloquial`。
   曾经有 `generated: date.today()`，导致每次重建都产生幻影 diff，与「字节稳定」的承诺冲突。
   重建后如果 `git diff` 有改动，那一定是数据真的变了。
3. **ID 不复用**：删除词条后其 ID 永久作废，新增用该前缀下的下一个序号（四位补零）。
   复用于旧 ID 会让历史引用与分片指向错的词条。
4. **三项校验只到警告级**：`related` 指向不存在的术语、`term_en` 两条重复、歧义口语缺
   `disambiguation` —— 这三项 `validate.py` 记 warning 而非 error。报 warning 时不要顺手把
   整行引用删掉，先确认是不是拼写问题；候选池与多地区共挂的提示是设计内输出，不算数据病。
5. **`FILE_ORDER` 只在 `scripts/corpus.py` 写一份**：`build_index.py`、`build_web.py`、
   `query.py` 从 `corpus.DATA_FILES` 取，`validate.py` 从 `corpus.PREFIX_BY_FILE` 取，
   读词条统一走 `corpus.load_entries()`。新增数据文件只改 `corpus.py` 一处
   （原四个脚本各写一份清单的写法已于 2026-09 收敛；漏改的唯一表现是
   `validate.py` 不认得新文件，报 `[缺失] 数据文件不存在`）。
6. **两种口语计数并存**：原始写法去重 2215、去括注后的口语匹配键 2211。差值是「地道（部分场合）」
   「闪黄灯（口误）」「便道（北方叫法）」「马葫芦盖（东北叫法）」四组括注写法并入同名键。写文档时必须说清用哪个口径，只写数字会再次漂移。
7. **8 个文件不等于 8 类**：`08_safety_parking.jsonl` 同时含「交通安全」与「静态交通（停车）」
   两类 `category`，所以是 8 个数据文件 / 9 类标签。分片按文件切，切片的 `category` 字段
   是该文件内类别的集合，不是首条记录的类别。`validate.py` 不校验 `category` 与文件的对应。
8. **命令行匹配度是固定档位，不是连续分**：`corpus.score()` 只返回
   100（口语完全相同，含「动车（口误）」去括注后相同）/ 90（中英文术语完全相同）/
   80（口语子串）/ 70（中文术语子串）/ 60（英文子串）/ 40（关联词）/ 30（定义命中）
   这几档，取最高档；命中最多展开前 8 条。括注只是注释，去括注后与查询词相同按满分算，
   这与网页匹配键的去括注口径一致（否则「动车」这类键两侧答案会漂移，2026-09 修过）。
   网页侧 `build_web.py` 也用 `corpus.score()` 给每个匹配键的候选排序。
9. **网页与命令行是两套代码、一套消歧口径**：网页扫描在 `web/app.js`（精确匹配键、
   最长优先），CLI 检索在 `scripts/query.py`（另有子串匹配）。两者的候选排序共用
   `corpus.score()`，且 `web_check.py` 逐键校验「data.js 候选顺序 == CLI 分值排序」，
   用 node 真跑 `app.js` 做句子转换回归——改任何一侧都必须过 `web_check.py`，
   只跑 `query.py --check` 不再算数。
10. **`web/` 会被复制到个人站当子页面**：`luzzz.me` 的 `/corpus/` 是 `web/` 四个文件的原样
    副本，由 `luzzz.me/tools/sync-showcases.mjs` 生成。页面里的「返回主页」是相对路径 `../`，
    在 `/corpus/` 下解析成主站、单独部署时解析成上一级目录，两种托管都不用改代码。
    `app.js` 末尾会判断两种情况并把这行摘掉：协议不是 `http(s)`（也就是双击 `index.html`，
    那时上一级只是本地目录，点了会跳去文件列表），以及 `../` 解析出来就是当前页
    （把 `web/` 单独部署在站点根时，点了等于刷新）。
    因此 `web/` 里不要引入依赖仓库根目录的资源路径（`../assets/…` 之类），副本拿不到。
    另有一条硬约束：**访问 URL 必须以 `/` 结尾**。`data.js`、`app.js`、`style.css` 都是相对引用，
    落在 `/corpus`（少斜杠）时基准变成站点根，三者全 404，表现是页面文字都在但转换点不动。
    `python -m http.server` 与 GitHub Pages 会自动补斜杠，Vercel 的 Next 预设默认相反，
    所以收录方 luzzz.me 用 `trailingSlash: true` 把方向反过来（复核见其 `AGENTS.md` 关键约定 9）。

11. **Pages 发布有两个不显然的点**：① `web/` 是零构建的静态目录，所以 workflow 里没有
    `npm run build`，直接把目录当 artifact 上传；改名或加构建步骤要同步改
    `.github/workflows/pages.yml` 的 `path`。② **GitHub Pages 必须在仓库 Settings → Pages
    里人工开启一次（Source 选 GitHub Actions），workflow 的 token 开不了**：未开启时
    `configure-pages` 报 `Error: Get Pages site failed. Please verify that the repository has
    Pages enabled and configured to build using GitHub Actions`；给它加 `enablement: true`
    也只是换成 `Error: Create Pages site failed. Error: Resource not accessible by integration`
    （两段都是 2026-09-27 的 CI 实录，当时就是这么卡住第一次发布的）。
    另外未登录时 `GET /repos/Luz7818/traffic-terminology/pages` 恒返回 404，
    连已开启的 marx-cloud 也一样，别拿它当判据 —— 判据是站点本体：
    `curl -s -o /dev/null -w '%{http_code}' https://luz7818.github.io/traffic-terminology/` 为 200。

13. **方言对照层是网页扫描的可选叠加，不是主库**：`data/dialect/<地区>.json` 每地区一个库
    （region_code / region / entries[]，phrase 必须映射到主库词条 ID，validate.py 强制）。
    build_web.py 把各库编进 `data.js` 的 `dialects` 字段；网页端「方言对照」选了地区才参与
    最长优先扫描，**主库键永远优先**（validate 会把与主库口语键撞车的方言词条记为 warning，
    2026-09-30 就拦下过「高架」「慢车道」「胳膊肘弯」三条死键）。Skill 索引的 `dialects`
    字段同步给模型使用。方言键同样可能有过宽匹配（如「油路」⊂「加油路口」），收窄靠加
    `web_check.py` 用例与 `app.js` 的 `MASK_TERMS`。

## 已知坑

- **`surface` 字段**（数据侧，69 个词条）给出谓词性口语（「堵死了」「撞车了」）在句子里的
  规范替换形式（「陷入严重拥堵」「发生道路交通事故」），键必须是本条 `colloquial` 的原文
  （`validate.py` 强制），进 `web/data.js` 的 `sf`（键去括注）与 Skill 索引的 `sf`（键保留原文）。
  `web/app.js` 的 `SMOOTH_RULES` 是替换后的字面平滑规则（「根本因」→「因」这类残句修补），
  纯字面、按序应用一次。新增 SMOOTH 规则必须同时在 `web_check.py` 的 `CONVERT_CASES` 里加句子用例。
- Windows 控制台默认 GBK，脚本输出中文会乱码；用管道捕获时更会变成
  `UnicodeDecodeError`。先 `set PYTHONIOENCODING=utf-8`。
- 分支名本仓曾是 `master`，2026-09 已本地改名为 `main`（workflow 里 `main`、`master`
  都触发发布）。GitHub 端默认分支若还没在 Settings → Branches 切到 `main`，推送
  `main` 后记得切；切换前推 `master` 也能发布，不会静默丢更新。
- 仓库根不是 git 仓库，`Traffic_terminology/` 自身才是；同级还有 6 个互不关联的仓库。
- 网页消歧是「按 CLI 分值排序后的首候选」，仍不看上下文；句中改写有 `surface` +
  `SMOOTH_RULES` 两层兜底，但长句仍可能不顺——它有回归锁定（`web_check.py`），
  改行为请连用例一起改，别绕过。
- 「电动车」「电瓶车」在网页扫描里被掩码（app.js 的 `MASK_TERMS`）：其内部的
  「动车」等键不参与匹配，否则「骑电动车被拍」会被切成「电 + 动车 → 高速铁路」。
  新增掩码词要同步 `web_check.py` 用例。
- CLI 查询会做子串匹配，可能命中不带该匹配键的词条（如查「动车」也会子串命中口语里
  含「动车」二字的长句词条）；网页只按精确键扫描，没有这条路径。两侧排序口径已统一
  （关键约定 8/9），但「候选集合」在极端子串场景下仍可能不同，属已知设计取舍。
- `validate.py` 的 standards 校验只比对登记表里的编号与名称是否配套，不判断该术语是否
  真的归这个标准管。依据覆盖 18.2%，报表见 `python scripts/validate.py --coverage`。

## 不要做的事

- 不要为了"看起来有 CI"给这个仓库加打包、格式化或类型检查工具；它的门禁是文本一致性，
  `run_all.py` 已经覆盖。
- 不要在 README 或手册里另写一套数字。所有规模数字改到 `AGENTS.md` 的「当前真实状态」，
  其他文档指向这里。
- 不要把 `web/data.js` 或 `references/` 的改动单独提交而不带源数据改动 —— 那说明源数据
  没同步，反了。
