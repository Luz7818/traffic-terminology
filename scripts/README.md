# scripts/ —— 校验、重建与查询

> 用途：说明各脚本各管一段什么、命令怎么写、失败会是什么样。
> 全部只用 Python 标准库（`web_check.py` 的句子转换回归另需 node，缺了会跳过并提示）；
> 从仓库根目录以 `python scripts/<名>.py` 运行。

这个目录是保证「数据 → 索引 → 网页」三者一致的机制。数据本身在 `data/`，
这里的脚本只读数据、写产物，不改数据。

## 文件清单

| 文件 | 干什么 | 关键行为 |
|---|---|---|
| `run_all.py` | 总入口，串起下面五步 | 校验 → 建索引 → 建网页数据 → 查询回归 → 网页回归；任一步非 0 立即中止并向外返回同一退出码 |
| `corpus.py` | 共享配置与匹配核心 | `DATA_FILES`（8 个数据文件与 ID 前缀的唯一清单）、`load_entries()`、`score()`（固定档位打分）、`clean_phrase()`（去括注）。所有脚本读数据、排序候选都走这里 |
| `validate.py` | 数据校验 | 逐条查必填字段、类型、ID 格式与前缀、全局唯一、`term_en` 不含中文、首尾空白、`surface` 键是否来自本条口语、`standards` 编号与名称是否配套、`related` 是否可解析（warning 级）、歧义口语是否给了 `disambiguation`；`--coverage` 另打标准依据覆盖报表 |
| `build_index.py` | 生成反向索引与分片 | 写 `skill/traffic-terminology/references/colloquial_index.json` 与 `slices/<前缀>.json` + `manifest.json`；正文只存一份，索引仅存 ID 列表，避免同一条目被多个口语重复展开 |
| `build_web.py` | 生成网页数据 | 写 `web/data.js`；匹配键 = 去掉「（北方）」等括注后的口语说法 + 标准中文术语；每个键的候选按 `corpus.score()` 对该键的分值降序、平手保持文件序——网页「取首个候选」由此与 CLI「首选命中」同口径 |
| `query.py` | 命令行查询 | 支持中文术语、英文、口语、定义部分匹配，按匹配度降序；`-v` 追打定义/关联/标准；`--check` 跑 26 条固定回归用例 |
| `web_check.py` | 网页侧回归 | ① 纯 Python：3003 个匹配键的候选顺序逐一与 CLI 分值排序比对；② node 可用时真跑 `web/app.js` 断言 36 条句子转换用例（含方言与地区用例，用例可带地区代码），node 缺失则跳过该项并提示 |
| `web_harness.mjs` | node 测试通道 | 给 `web_check.py` 调用：在 `window` 打桩后加载真实的 `web/data.js` 与 `web/app.js`（浏览器外模式只执行纯函数核心 `TrafficMatcher`），从 stdin 读用例、输出转换结果 JSON。断言都在 Python 侧 |

`validate.py` 里有一张 `STANDARDS_REGISTRY`（23 条标准编号与规范名称的对应表，
复核：`python scripts/validate.py`）。写错编号或名称与编号不配套会直接报错——
它拦住过 `GB 50688` 被配成别的名这种肉眼看不出来的错误。

## 命令

```bash
python scripts/run_all.py          # 改完数据跑这个就够
python scripts/validate.py         # 只看校验结果
python scripts/validate.py --coverage  # 另打标准依据覆盖报表（不改变退出逻辑）
python scripts/build_index.py      # 只重建 Skill 用的索引与分片
python scripts/build_web.py        # 只重建网页数据
python scripts/query.py 红绿灯路口  # 查一个说法
python scripts/query.py 信号 -v     # 查部分匹配并看定义
python scripts/query.py --check     # 只跑查询回归
python scripts/web_check.py        # 只跑网页回归（消歧一致性 + node 句子用例）
```

成功判据：`run_all.py` 退出码 0，末行 `[完成] 全部校验与构建通过，data / 索引 / 网页已同步`；
`validate.py` 报「错误 0 项，警告 10 项」（候选池地区提示、「已是正式说法」提示与
多地区共挂说明三类非数据项，均不阻断）；`--check` 报「26/26 用例通过」；
`web_check.py` 报「3003 个键……全部一致」与「36/36 条句子转换用例通过」。

## 数据文件清单只写一处

四个读数据的脚本（`query.py` / `build_index.py` / `build_web.py` / `validate.py`）
共用 `corpus.py` 里的 `DATA_FILES`（文件名 ↔ ID 前缀），新增数据文件只改那一处。
文件缺失时的表现：`validate.py` 报 `[缺失]` 错误；`build_web.py` 抛 `FileNotFoundError`；
`build_index.py` 与 `query.py` 静默跳过——前两者会拦住，后两者要靠条数对不上来发现。

`query.py` 的命中列表固定只展开前 8 条，多的用「… 其余 N 条略」提示，`-v` 不改变这个上限。

## 输出稳定性

两个 build 脚本对同一份数据输出逐字节一致，产物里没有构建时间戳。因此重建后
`git diff` 里出现改动，就意味着数据或脚本真的变了，可以直接提交。

## 和谁打交道

- **上游**：`data/*.jsonl`（唯一输入）。
- **下游**：`web/data.js`、`skill/traffic-terminology/references/`。
- **改了匹配或排序逻辑**：跑 `python scripts/run_all.py`。`corpus.score()` 同时喂
  CLI 检索与网页候选排序，改它会同时影响两侧；只改 `web/app.js` 时 `query.py --check`
  不会报错，必须另跑 `web_check.py`（run_all 已包含）。

## 别动

- 不要给产物加时间戳、随机数或本机路径，那会破坏上一条的稳定性判断。
- `query.py` 的匹配度分值只承诺排序用途，外部没有依赖具体数值，改动前先看 `--check`
  的 26 条用例是否覆盖了你关心的输入。
