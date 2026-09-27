# web/ —— 静态网页转换器

> 用途：说明网页这一块由哪几个文件组成、匹配逻辑在哪、哪些文件是生成的。
> 使用者请直接看 `docs/getting-started.md` 第 2.1 节；这里是给要改它的人。

一个不需要服务器、不需要构建、不需要网络的单页应用。双击 `index.html` 就能用，
数据以全局变量的形式由 `data.js` 挂到 `window.TRAFFIC_DATA` 上，再由 `app.js` 消费。

## 文件清单

| 文件 | 干什么 | 备注 |
|---|---|---|
| `index.html` | 页面骨架：两个标签页（口语转换 / 术语库）、统计条、示例按钮、弹窗容器 | 只引本地三个文件，无 CDN、无网络请求 |
| `style.css` | 全部样式 | 约 15 KB |
| `app.js` | 全部逻辑，包在一个 IIFE 里 | 匹配实现与 `scripts/query.py` 各写一份，见「别动」 |
| `data.js` | 词条与匹配词典 | **脚本产物**，由 `python scripts/build_web.py` 生成，约 295 KB，勿手改 |

## app.js 内部结构

| 函数 | 责任 |
|---|---|
| `analyze(text)` | 从输入里切出候选片段：按 `DATA.maxLen` 到 2 字做最长优先匹配，命中即消费掉这段字符 |
| `buildGroupKeyMap(terms)` | 把同一术语的多种写法归到一个组，供高亮与卡片复用 |
| `convert()` | 主流程：`analyze` → 生成术语化改写（命中的词高亮）→ 原文对照 → 术语卡片 |
| `termCard(g, i)` | 渲染单个术语卡片：中英、定义、领域、关联词、国标、消歧提示、歧义候选、复制按钮 |
| `buildCatChips()` / `refreshChips()` | 领域筛选标签，标签数量由数据里的 `category` 决定（当前 9 个） |
| `doSearch()` / `renderBrowse()` / `browseRow()` | 术语库侧的全文搜索与列表渲染，`PAGE = 80` 条一页，「加载更多」续翻 |
| `openModal()` / `closeModal()` | 词条详情弹窗 |
| `switchTab(name)` | 两个标签页互斥显示 |
| `loadHistory()` / 相关写入 | 转换历史，存 `localStorage`，键名 `tt_history`，清浏览器数据即丢 |

## 已知的两个行为特征

这两点是设计取舍，不是缺陷，改动前先看 `AGENTS.md` 的「已知坑」：

1. **消歧取首个候选**：一个口语说法命中多个术语时，改写文本用的是排在前面的那一个，
   不做上下文判断。卡片里会附带「该说法也可指」提示，但改写结果用的可能是错的那个。
2. **改写是字面替换**：把命中的口语片段换成术语，长句可能产出不通顺的结果。
   它应被当作提示，不是终稿。

## 和谁打交道

- **上游**：`data/*.jsonl` → `scripts/build_web.py` → `data.js`。
- **下游**：使用者浏览器；`skill/` 不依赖这里。两处收录都只是**复制**这四个文件：
  GitHub Pages 的 <https://luz7818.github.io/traffic-terminology/>（`.github/workflows/pages.yml`
  推 `master` 时发布），以及个人站 `luzzz.me` 的 `/corpus/` 子页面
  （由 luzzz 仓库的 `tools/sync-showcases.mjs` 复制）。本目录改动不会被它们反向覆盖。
- **改了这里之后**：网页侧没有自动化用例，需要手动复测；如果同时动了匹配逻辑，
  还要对齐 `scripts/query.py` 那一侧，否则命令行与网页会给出不同结果。

## 别动

- 不要手改 `data.js`：下一次 `run_all.py` 会整文件覆盖。
- 不要在页面里引入 CDN 资源或远程字体：这个页面要能在离线、内网机上直接打开。
- 只改 `web/app.js` 而不同步 `scripts/query.py`，会让 26 条回归用例失去代表意义。
