# 交通用语语料库 测试规范

> 用途：给改完数据或脚本要验证的人。本仓门禁是文本一致性（无测试框架、无 CI 跑测试），
> 总入口 `python scripts/run_all.py`，它的退出码就是门禁。

## 测试分层

| 层 | 管什么 | 入口 |
|---|---|---|
| 数据校验 | 结构、方言层、候选池、标准登记表 | `python scripts/validate.py` |
| 查询回归 | 26 条 CLI 用例 | `python scripts/query.py --check` |
| 网页回归 | 消歧一致（匹配键候选顺序 == CLI 分值排序）+ 句子转换 36/36（node 真跑 `web/app.js`） | `python scripts/web_check.py` |
| 总门禁 | 以上全部 + 重建索引与网页数据 | `python scripts/run_all.py` |

node 缺失时句子转换回归跳过并提示，其余照常。

## 用例编写规范

- 新增/修改 `web/app.js` 的 `SMOOTH_RULES` 或 `MASK_TERMS`，必须同时在
  `scripts/web_check.py` 的 `CONVERT_CASES` 里加句子用例——不许只改行为不锁定。
- 改匹配/排序口径时，`web_check.py` 的逐键比对就是回归；口径变更要两侧同步（见
  `docs/ARCHITECTURE.md` 关键约定 9）。
- 三项校验是警告级（related 断链 / term_en 重复 / 歧义缺消歧字段）：报 warning 先查是不是
  拼写问题，不要顺手删数据；候选池与多地区共挂提示是设计内输出。

## 运行命令

```bash
python scripts/run_all.py     # 总门禁：校验 -> 重建索引 -> 重建网页数据 -> 查询回归 -> 网页回归
```

产物不含时间戳，重建后 `git diff` 出现改动就说明数据真的变了。

## 改动后的验证

| 你动了 | 必须跑 |
|---|---|
| `data/*.jsonl`（含 `data/dialect/`） | `python scripts/run_all.py` |
| `web/index.html` / `web/app.js` / `web/style.css` | 递增 `?v=…-u<序号>` 缓存参数 + `run_all.py` |
| `scripts/*.py` | `run_all.py` |
| `skill/` 源数据或索引逻辑 | `run_all.py`（`references/` 会重建） |
