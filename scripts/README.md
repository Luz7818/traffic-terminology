# scripts/ —— 校验、重建与查询

> 用途：说明五个脚本各管一段什么、命令怎么写、失败会是什么样。
> 全部只用 Python 标准库，不需要安装任何东西；从仓库根目录以 `python scripts/<名>.py` 运行。

这个目录是保证「数据 → 索引 → 网页」三者一致的机制。数据本身在 `data/`，
这里的脚本只读数据、写产物，不改数据。

## 文件清单

| 文件 | 干什么 | 关键行为 |
|---|---|---|
| `run_all.py` | 总入口，串起下面四步 | 校验 → 建索引 → 建网页数据 → 查询回归；任一步非 0 立即中止并向外返回同一退出码 |
| `validate.py` | 数据校验 | 逐条查必填字段、类型、ID 格式与前缀、全局唯一、`term_en` 不含中文、首尾空白、`standards` 编号与名称是否配套、`related` 是否可解析（warning 级）、歧义口语是否给了 `disambiguation`；末尾统计词条数与歧义组数 |
| `build_index.py` | 生成反向索引与分片 | 写 `skill/traffic-terminology/references/colloquial_index.json` 与 `slices/<前缀>.json` + `manifest.json`；正文只存一份，索引仅存 ID 列表，避免同一条目被多个口语重复展开 |
| `build_web.py` | 生成网页数据 | 写 `web/data.js`；匹配键 = 去掉「（北方）」等括注后的口语说法 + 标准中文术语；`meta` 只含 `entries` 与 `colloquial` 两个数 |
| `query.py` | 命令行查询 | 支持中文术语、英文、口语、定义部分匹配，按匹配度降序；`-v` 追打定义/关联/标准；`--check` 跑 26 条固定回归用例 |

`validate.py` 里有一张 `STANDARDS_REGISTRY`（23 条标准编号与规范名称的对应表，
复核：`python scripts/validate.py`）。写错编号或名称与编号不配套会直接报错——
它拦住过 `GB 50688` 被配成别的名这种肉眼看不出来的错误。

## 命令

```bash
python scripts/run_all.py          # 改完数据跑这个就够
python scripts/validate.py         # 只看校验结果
python scripts/build_index.py      # 只重建 Skill 用的索引与分片
python scripts/build_web.py        # 只重建网页数据
python scripts/query.py 红绿灯路口  # 查一个说法
python scripts/query.py 信号 -v     # 查部分匹配并看定义
python scripts/query.py --check     # 只跑查询回归
```

成功判据：`run_all.py` 退出码 0，末行 `[完成] 全部校验与构建通过，data / 索引 / 网页已同步`；
`validate.py` 报「错误 0 项，警告 0 项」；`--check` 报「26/26 用例通过」。

## 三个脚本读数据的方式不同

每个脚本里各自写了一份 `FILE_ORDER`（要读哪 8 个数据文件），新增数据文件时三处都要加：

| 脚本 | 文件不存在时 | 后果 |
|---|---|---|
| `build_index.py` | 静默跳过 | 索引里没有这批词条，也不报错 |
| `query.py` | 静默跳过 | 命令行查不到，也不报错 |
| `build_web.py` | 直接抛 `FileNotFoundError` | 会暴露，但会中断 `run_all.py` |

所以"加了数据文件、跑 `run_all.py` 却一切正常"是可能的，此时要核对索引与网页里的条数。

`query.py` 的命中列表固定只展开前 8 条，多的用「… 其余 N 条略」提示，`-v` 不改变这个上限。

## 输出稳定性

两个 build 脚本对同一份数据输出逐字节一致，产物里没有构建时间戳。因此重建后
`git diff` 里出现改动，就意味着数据或脚本真的变了，可以直接提交。

## 和谁打交道

- **上游**：`data/*.jsonl`（唯一输入）。
- **下游**：`web/data.js`、`skill/traffic-terminology/references/`。
- **改了匹配或排序逻辑**：至少跑 `python scripts/query.py --check`；如果改的是
  `web/app.js` 里的匹配，命令行这边不会报错，需要两边分别验证。

## 别动

- 不要给产物加时间戳、随机数或本机路径，那会破坏上一条的稳定性判断。
- `query.py` 的匹配度分值只承诺排序用途，外部没有依赖具体数值，改动前先看 `--check`
  的 26 条用例是否覆盖了你关心的输入。
