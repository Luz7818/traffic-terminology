# web/ —— 静态网页转换器

> 用途：说明网页这一块由哪几个文件组成、匹配逻辑在哪、哪些文件是生成的。
> 使用者请直接看 `docs/GET-START.md` 第 2.1 节；这里是给要改它的人。

一个不需要服务器、不需要构建、不需要网络的单页应用。双击 `index.html` 就能用，
数据以全局变量的形式由 `data.js` 挂到 `window.TRAFFIC_DATA` 上，再由 `app.js` 消费。

## 文件清单

| 文件 | 干什么 | 备注 |
|---|---|---|
| `index.html` | 页面骨架：两个标签页（口语转换 / 术语库）、统计条、示例按钮、弹窗容器 | 只引本地三个文件，无 CDN、无网络请求 |
| `style.css` | 全部样式 | 约 26 KB |
| `app.js` | 全部逻辑，包在一个 IIFE 里 | 匹配实现与 `scripts/query.py` 各写一份，见「别动」 |
| `data.js` | 词条与匹配词典 | **脚本产物**，由 `python scripts/build_web.py` 生成，约 322 KB，勿手改 |

## app.js 内部结构

文件是一个 IIFE，**前半段是纯函数核心（不碰 DOM），末尾导出 `window.TrafficMatcher` 后
遇到非浏览器环境（`typeof document === 'undefined'`，即 node 回归）就提前返回**；
`scripts/web_check.py` 依赖这个结构加载真实前端代码跑回归，改结构前先看它。

| 函数 | 责任 |
|---|---|
| `analyze(text)` | 从输入里切出候选片段：按 `DATA.maxLen` 到 2 字做最长优先匹配，命中即消费掉这段字符（匹配前先过 `maskForScan` 掩码）；返回片段与术语分组 |
| `maskForScan(text)` | 扫描掩码：把「电动车」「电瓶车」逐字替换成哨兵字符，使其内部的「动车」等键不参与匹配；段落展示文本仍取原文，按字符位一一对应 |
| `surfaceOf(ent, frag)` | 该片段在句中替换成什么：优先词条的 `sf`（`surface` 句中改写），否则标准术语 |
| `smooth(text)` | 替换完跑一遍 `SMOOTH_RULES` 字面平滑规则（「根本因」→「因」这类残句修补） |
| `toConverted(segments)` | 逐段替换 + 平滑，得到「术语化改写」全文；复制按钮复制的就是它 |
| `renderDemo()` | 渲染输入卡下方的「示例对比」卡片（`DEMO_SENTENCES` 三句，口语琥珀高亮 → 术语绿色高亮，由真实引擎实时算出，不手写结果）；点击整卡即填入输入框并转换 |
| `setRegion(code)` / `renderRegions()` | 方言对照层：`setRegion` 切换地区（存 `localStorage` 键 `tt_region`），扫描时把该地区 `data.js` 的 `dialects.<code>.phrases` 叠加进最长优先匹配（主库键优先）；`renderRegions` 画「通用/江苏/河南」选择 chips，切换后重渲示例、方言面板并重转换 |
| `renderDialectPanel()` | 术语库视图顶部的「方言对照」面板：**面板头部自带地区切换 chips**（与转换页同一状态、双向联动），选中地区列出该地区方言说法（紫色虚线标记 + 出处备注）→ 标准术语，点击行打开词条详情弹窗；「通用」时按地区分组列出全部并提示「通用已含全部地区」 |
| 转换结果的方言标记 | 结果含方言命中时，标题旁显示「<地区>方言 ×N」徽标，与原文对照里的紫色虚线一一对应 |
| `maskForScan(text)` 同节的 `MASK_TERMS` | 现在只掩码「电动车」；「电瓶车」不再掩码（江苏方言层要匹配它，且其内部没有可误配的键） |
| `convert()` | 主流程：`analyze` → 术语化改写（按 surface 形式高亮）→ 原文对照 → 术语卡片 → 平滑滚动定位到结果卡 |
| `termCard(g, i)` | 渲染单个术语卡片：中英、定义、领域、关联词、国标、消歧提示、歧义候选、复制按钮 |
| `buildCatChips()` / `refreshChips()` | 领域筛选标签，标签数量由数据里的 `category` 决定（当前 9 个） |
| `doSearch()` / `renderBrowse()` / `browseRow()` | 术语库侧的全文搜索与列表渲染，`PAGE = 80` 条一页，「加载更多」续翻 |
| `openModal()` / `closeModal()` | 词条详情弹窗 |
| `switchTab(name)` | 两个标签页互斥显示 |
| `loadHistory()` / 相关写入 | 转换历史，存 `localStorage`，键名 `tt_history`，清浏览器数据即丢 |

## 已知的三个行为特征

这三点都有回归锁定（`scripts/web_check.py`），改动请连用例一起改：

1. **消歧取首个候选**：一个口语说法命中多个术语时，改写文本用的是排在前面的那一个。
   候选顺序由 `build_web.py` 按 `corpus.score()` 的分值生成，与命令行「首选命中」同口径；
   但它仍不做上下文判断，卡片里会附带「该说法也可指」提示。
2. **改写是「替换 + 平滑」**：命中片段先按 `surface`/术语替换，再过 `SMOOTH_RULES`
   字面平滑，能避免「车根本严重拥堵」这类病句；但规则是有限枚举，长句仍可能不通顺，
   它应被当作提示，不是终稿。另有 `MASK_TERMS` 掩码表防止「电动车」被内部「动车」误切。
3. **方言命中是地区可选层**：默认「通用」不启用；选了地区后方言片段在原文对照里是
   紫色点线底，改写文本同样走术语替换。方言键按最长优先扫描，个别词在非常规搭配里
   可能过宽（如河南「油路」会命中「加油路口」里的「油路」），发现误配就补回归用例或掩码。

## 和谁打交道

- **上游**：`data/*.jsonl` → `scripts/build_web.py` → `data.js`。
- **下游**：使用者浏览器；`skill/` 不依赖这里。两处收录都只是**复制**这四个文件：
  GitHub Pages 的 <https://luz7818.github.io/traffic-terminology/>（`.github/workflows/pages.yml`
  推 `main` 时发布，过渡期 `master` 也触发），以及个人站 `luzzz.me` 的 `/corpus/` 子页面
  （由 luzzz 仓库的 `tools/sync-showcases.mjs` 复制）。本目录改动不会被它们反向覆盖。
- **改了这里之后**：跑 `python scripts/web_check.py`——它用 node 加载真实的 `app.js`
  跑句子转换回归；同时打开 `web/index.html` 手测一遍页面交互（回归只覆盖纯函数核心，
  不覆盖 DOM）。

## 别动

- 不要手改 `data.js`：下一次 `run_all.py` 会整文件覆盖。
- 改 `web/` 任何源文件后，把 `index.html` 里三个资源引用的 `-u<序号>` 后缀加一
  （当前 `?v=1.1.0-u13`）：浏览器按完整 URL 缓存，序号不变用户就拿旧文件。
  数据集发版时随版本号一起更新。
- 口语转换页的结构：输入卡（输入 / 快捷键 / 方言选择 / 历史）→ **结果区紧跟其后** →
  示例对比卡（含示例对比与更多示例）沉底。转换后自动定位到结果，示例是发现性内容，
  放在产出之后，别再挪回输入卡里。
- 不要在页面里引入 CDN 资源或远程字体：这个页面要能在离线、内网机上直接打开。
- 不要破坏 app.js「纯函数核心在前、`typeof document` 判断、DOM 逻辑在后」的结构：
  `web_check.py` 靠它在 node 里加载真实匹配代码，没有这个结构网页侧就退回无自动化。
