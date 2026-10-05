# 交通用语语料库 架构

> 用途：给要理解或改动本仓结构的人。架构总览、目录结构（含根目录所有文件用途）、数据组织方式、
> 模块依赖与关键约定都在这里。操作步骤在 `docs/GET-START.md`；数字口径在根目录 `AGENTS.md` 的「当前状态」。

## 架构总览

一份中英对照的交通术语语料库（数据 + 校验构建脚本 + 纯静态网页 + AI Skill），没有运行时服务、
没有数据库，所有产物都是仓库内的文本文件。三个使用入口共享同一份 `data/` 语料：网页转换器
（`web/`，离线可用）、命令行查询（`scripts/query.py`，零依赖）、可安装 AI Skill
（`skill/traffic-terminology/`，自带反向索引可脱离源数据）。

## 目录结构

```
Traffic_terminology/
├── data/                     语料本体，唯一的手工编辑对象（方言对照层在 data/dialect/）
├── docs/                     手册与专项规范，不写板块说明
├── scripts/                  校验、重建、查询、门禁
├── skill/                    可安装的 AI Skill
├── web/                      静态网页转换器
├── CITATION.cff              引用元数据
├── .gitattributes            刻意关掉换行符归一化
└── LICENSE                   CC BY 4.0
```

| 文件 | 用途 |
|---|---|
| `README.md` | 展示用入口：是什么、怎么跑、往哪走 |
| `AGENTS.md` | 规范入口；规模数字与门禁命令的单一来源 |
| `目录说明.md` | 纯导航 |
| `HISTORY.md` | 数据集版本演进记录（版本号单源在 `data/VERSION`） |
| `TODO.md` | 开发计划与当前进度 |
| `data/VERSION` | 数据集版本号单源 |
| `CITATION.cff` | 数据集引用格式 |
| `.gitattributes` | 刻意关掉换行符归一化（保证产物字节稳定） |
| `LICENSE` | CC BY 4.0 |

## 数据组织方式

- 语料本体是 8 个 JSONL 文件、一行一条记录，字段共 10 个（6 个必填），约束见
  `data/README.md`。**8 个文件不等于 8 类**：`08_safety_parking.jsonl` 同时收「交通安全」
  与「静态交通（停车）」两类 `category`，所以是 8 文件 / 9 类标签；分片按文件切，
  切片的 `category` 是该文件内类别的集合。分文件计数见 `AGENTS.md`「当前状态」。
- **方言对照层是网页扫描的可选叠加，不是主库**：`data/dialect/<地区>.json` 每地区一个库
  （6 地区 28 条），`phrase` 必须映射到主库词条 ID（validate 强制）；通用模式合并全部地区、
  选定地区只叠加该地区，主库键永远优先。另有候选池 `dialect/candidates.jsonl`（250 条，
  「待核实」、不进转换与 Skill 管线）。
- **生成物不要手改**：`web/data.js` 与 `skill/traffic-terminology/references/` 下的索引与
  分片都由脚本写出，手改会在下一次 `run_all.py` 时被整体覆盖。
- **产物里不放时间戳**：`build_web.py` 的 `meta` 只有 `entries` 和 `colloquial`。曾有过
  `generated: date.today()`，每次重建都产生幻影 diff，与「字节稳定」冲突。重建后
  `git diff` 有改动就说明数据真的变了。
- **ID 不复用**：删除词条后其 ID 永久作废，新增用该前缀下四位补零的下一个序号。
- **`FILE_ORDER` 只在 `scripts/corpus.py` 写一份**：`build_index.py`、`build_web.py`、
  `query.py` 从 `corpus.DATA_FILES` 取，`validate.py` 从 `corpus.PREFIX_BY_FILE` 取，
  读词条统一走 `corpus.load_entries()`。新增数据文件只改 `corpus.py` 一处；漏改的唯一
  表现是 `validate.py` 报 `[缺失] 数据文件不存在`。
- **两种口语计数并存**：原始写法去重 2215、去括注后的网页匹配键 2211（差值是四组括注写法
  并入同名键）。写文档必须说清用哪个口径，只写数字会漂移。

## 模块依赖关系

```
data/*.jsonl（唯一手工编辑对象）
   └── scripts/corpus.py（单源加载：DATA_FILES / PREFIX_BY_FILE / load_entries / score）
          ├── scripts/validate.py      数据校验（结构 + 方言 + 候选池）
          ├── scripts/build_index.py   重建 Skill 反向索引
          ├── scripts/build_web.py     重建 web/data.js（产物，无时间戳）
          ├── scripts/query.py         CLI 查询（子串匹配）
          └── scripts/run_all.py       总门禁：校验→重建→26 条查询回归→网页回归
web/app.js：独立的网页匹配实现（精确键、最长优先），候选排序共用 corpus.score() 口径
skill/traffic-terminology/references/：脚本产物，可脱离 data/ 独立使用
```

- **网页与命令行是两套代码、一套消歧口径**：两者候选排序共用 `corpus.score()`（固定档位
  100/90/80/70/60/40/30，取最高档）；`web_check.py` 逐键校验「data.js 候选顺序 == CLI
  分值排序」，并用 node 真跑 `app.js` 做句子转换回归——改任何一侧都必须过 `web_check.py`。
- **`web/` 会被复制到个人站当子页面**：`luzzz.me` 的 `/corpus/` 是 `web/` 四个文件的原样
  副本（由其 `tools/sync-showcases.mjs` 生成）。两条硬约束：`web/` 里不要引用仓库根目录
  资源（`../assets/…` 之类，副本拿不到）；**访问 URL 必须以 `/` 结尾**（相对引用在少斜杠
  路径下基准变站点根，三个资源全 404）。收录方 luzzz.me 用 `trailingSlash: true` 配合。
- **Pages 发布**：`web/` 是零构建静态目录，workflow 直接把目录当 artifact 上传，没有
  `npm run build`；改名或加构建步骤要同步改 `.github/workflows/pages.yml` 的 `path`。

## 子目录说明索引

| 子目录 | 说明 |
|---|---|
| `data/` | [data/README.md](../data/README.md)（字段约束、方言层与候选池流程） |
| `scripts/` | [scripts/README.md](../scripts/README.md)（每个脚本的职责与门禁） |
| `skill/` | [skill/README.md](../skill/README.md)（安装方式与产物边界） |
| `web/` | [web/README.md](../web/README.md)（四个文件的分工） |
| `docs/` | 无（文档目录本身） |

## 关键约定（违反会出问题的）

1. **生成物不要手改**——改数据或改脚本，再重建（见「数据组织方式」）。
2. **产物无时间戳**——重建后 `git diff` 有改动 = 数据真的变了。
3. **ID 不复用**——复用会让历史引用与分片指向错的词条。
4. **三项校验只到警告级**：`related` 指向不存在的术语、`term_en` 重复、歧义口语缺
   `disambiguation`。报 warning 不要顺手删整行引用，先确认是不是拼写问题；候选池与
   多地区共挂的提示是设计内输出，不算数据病。
5. **FILE_ORDER 单源**——新增数据文件只改 `scripts/corpus.py` 一处。
6. **口语计数必须带口径**——2215（原始去重）与 2211（网页匹配键）并存。
7. **8 个文件 / 9 类标签**——分片 `category` 是集合，validate 不校验 category 与文件对应。
8. **匹配度是固定档位**——100/90/80/70/60/40/30 取最高，命中最多展开前 8 条；括注去括注
   后相同按满分算，与网页匹配键口径一致。
9. **两套代码一套消歧口径**——改任何一侧必须过 `web_check.py`，只跑 `query.py --check`
   不再算数。
10. **`web/` 是 luzzz.me 的复制源**——冻结路径：目录名 + `index.html/style.css/app.js/data.js`
    四文件名被 `luzzz.me/tools/sync-showcases.mjs` 逐字引用；动了源必须到 luzzz.me 重跑
    `pnpm sync:showcases && pnpm build` 并核对子页面。
11. **Pages 两个不显然的点**——workflow 无构建步骤；Pages 必须在仓库 Settings 人工开启一次
    （token 开不了，`enablement: true` 也会报 Resource not accessible）。未登录时
    `GET /repos/.../pages` 恒 404，别当判据——判据是 `curl` 站点本体得 200。
12. **方言层主库优先**——与主库口语键撞车的方言词条 validate 记 warning；方言键过宽匹配
    （如「油路」⊂「加油路口」）靠 `web_check.py` 用例与 `app.js` 的 `MASK_TERMS` 收窄。
13. **静态资源缓存参数**——`?v=数据集版本-u<序号>`，改 `web/` 源文件就递增序号。

## 已知架构问题

- 网页消歧是「按 CLI 分值排序后的首候选」，不看上下文；`surface` 句中改写 + `SMOOTH_RULES`
  字面平滑两层兜底，长句仍可能不顺——有回归锁定，改行为请连用例一起改。
- 依据覆盖 158/866（18.2%），未标注不代表没有依据；报表 `python scripts/validate.py --coverage`。
- 语料由人工编写而非真实文本抽取，覆盖面不等于真实分布；方言规模上量需转真实语料接入。
