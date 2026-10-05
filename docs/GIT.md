# 交通用语语料库 Git 规范

> 用途：给提交本仓代码的人。分支、发布链路、产物入库边界都在这里。

## 分支与提交策略

- 分支 `main`（本仓曾是 `master`，2026-09 已本地改名；workflow 里 `main`、`master` 都触发
  发布）。GitHub 端默认分支若还没在 Settings → Branches 切到 `main`，推送 `main` 后记得切；
  切换前推 `master` 也能发布，不会静默丢更新。
- **一批一提交**：数据、产物、文档同步变化必须在同一次提交里。**不要把 `web/data.js` 或
  `skill/references/` 的改动单独提交而不带源数据改动**——那说明源数据没同步，反了。
- 提交前门禁：`python scripts/run_all.py`（见 [TESTING.md](TESTING.md)）。

## 必须入库 / 禁止上传

| 判定 | 规则 |
|---|---|
| 必须入库 | `data/`（唯一手工编辑对象）、`scripts/`、`web/` 四文件、`skill/`、全部文档；**字节稳定的约定产物**（`web/data.js`、`skill/.../references/`）按约定目录入库 |
| 禁止上传 | 产物里的时间戳（破坏字节稳定）；`.vercel`、`.env*`（`web/.gitignore` 已挡）；运行期缓存（`.ruff_cache/` 等根 `.gitignore` 已挡） |

## CI 与发布

- `.github/workflows/pages.yml`：推 `main`（过渡期 `master` 也触发）把 `web/` 原样发到
  GitHub Pages，**无构建步骤**；改名或加构建要同步改 workflow 的 `path`。
- Pages 需在仓库 Settings 人工开启一次（workflow token 开不了）；判据是
  `curl -s -o /dev/null -w '%{http_code}' https://luz7818.github.io/traffic-terminology/`
  得 200，不是 `/pages` API（未登录恒 404）。
- tag：数据集 v1.1.0 尚未打 tag（`TODO.md` 任务 1）。

## commit message

- 风格沿用既有历史：`<type>: 中文一句话` 或 `<type>(<scope>): 中文一句话`，
  type 取 `feat / fix / docs / chore / refactor`（复核：`git log --oneline -10`）。
