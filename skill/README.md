# skill/ —— 可直接安装的 AI Skill

> 用途：说明这份 Skill 由什么组成、上下文预算怎么安排、怎么重新生成。
> 整个 `traffic-terminology/` 目录拷进支持 Skill 的工具目录即可使用，不依赖仓库其余部分。

Skill 的作用是把「口语 → 标准术语」这件事交给模型时，给它一份可查的对照表和明确的
查询步骤，避免它凭印象编造译法。`SKILL.md` 是给模型的指令，`references/` 是它要读的数据。

## 文件清单

| 文件 | 干什么 | 备注 |
|---|---|---|
| `traffic-terminology/SKILL.md` | 技能说明与工作流程：识别口语表述 → 查索引 → 按消歧规则选择 → 按规定格式输出 | 含 8 个 ID 前缀的领域对照表与消歧规则 |
| `traffic-terminology/references/colloquial_index.json` | 反向索引：`口语说法 → [词条 ID]`，加上一份 `entries` 正文表 | **脚本产物**，约 352 KB |
| `traffic-terminology/references/slices/manifest.json` | 8 个分片的目录：前缀、类别、条数、文件名 | **脚本产物**，1.3 KB |
| `traffic-terminology/references/slices/<前缀>.json` | ROAD / INTX / SIG / FLOW / TRANSIT / FWY / ITS / SAFE 各一片 | **脚本产物**，每片 36.0–53.7 KB |

## 子目录

| 子目录 | 负责 |
|---|---|
| `traffic-terminology/` | 这份 Skill 的全部交付物：`SKILL.md` 是给模型的指令，`references/` 是它要读的数据。整个目录可脱离仓库单独拷走 |

按《目录说明》的约定，下钻到 `references/` 与 `references/slices/` 靠本目录这一份说明完成，
不在它们里面再开 `README.md`（那会被工具当成 Skill 的一部分读进上下文）。这两层里的东西
全部由 `scripts/build_index.py` 写出，没有一份手写文件。

「文件清单」里三个体积数字（352 KB / 1.3 KB / 36.0–53.7 KB）的复核，在仓库根执行后把字节数
除以 1024：

```bash
wc -c skill/traffic-terminology/references/colloquial_index.json skill/traffic-terminology/references/slices/*.json
```

## 为什么索引要另存一份

网页用 `web/data.js`，Skill 用 `references/`，两份都从 `data/*.jsonl` 重建。
分开的原因是体积与读法：模型一次读入 324 KB 的整页数据（复核：`wc -c web/data.js`）
太浪费上下文，所以索引做成
归一化结构（正文只存一份，`index` 只放 ID 列表），再按前缀切片，让模型先看 1.3 KB 的
目录、只加载相关的那一片。

两种读法的数据量差别：归一化后整包 352 KB（复核：`python scripts/build_index.py` 末行）；
若把正文按每条口语逐条展开，同一份内容要多占一倍以上空间 —— 这就是 `index` 只存 ID 列表、
正文集中在 `entries` 的原因。

## 重建

```bash
python scripts/build_index.py     # 或 python scripts/run_all.py
```

产物落在本目录，改 `data/` 之后不重跑，Skill 用的就还是旧词表。

## 使用与验证

1. 把 `traffic-terminology/` 整个目录拷进目标工具的 skills 目录。
2. 让助手转换一句「早高峰那个红绿灯路口加塞太严重」。
   回答里应出现库内标准译法（信号交叉口 / signalized intersection、
   违法变更车道 / illegal lane changing），而不是模型自己的说法。
3. 领域不确定时，`SKILL.md` 要求回查整包而不是强行按单片作答 —— 全库有 13 组跨词条
   歧义口语（复核：`python scripts/validate.py`）。

## 和谁打交道

- **上游**：`data/*.jsonl` → `scripts/build_index.py` → 本目录 `traffic-terminology/references/`
  下的 `colloquial_index.json` 与 `slices/`（8 片加 `manifest.json`）。只有这一个脚本写这里。
- **下游**：装了这份 Skill 的 AI 助手 —— 整个 `traffic-terminology/` 拷进所用工具的 skills 目录
  就能独立工作，它不读仓库其他部分，仓库里的脚本与网页也不读这里（`web/data.js` 另有其源）。
- **改这里之后要跑**：三条命令都在仓库根执行；Windows 控制台先 `set PYTHONIOENCODING=utf-8`。

```bash
python scripts/build_index.py    # 重建 references/：首行 866 条、倒数第二行 2215 个说法、末行 352 KB 与 8 片
python scripts/run_all.py        # 全量门禁：校验 → 索引 → 网页数据 → 查询回归 → 网页回归
git status --porcelain           # 重建后应只剩你在改的文档；出现 references 行说明产物被手改过或 data/ 变了
```

`SKILL.md` 是这里唯一手写的文件，脚本不生成它，所以改它没有命令可验：手工重装一次 Skill
（重新拷贝一次 `traffic-terminology/`）并让助手转一句「早高峰那个红绿灯路口加塞太严重」，
回答里出现 `signalized intersection` 与 `illegal lane changing` 才算它读到了这份数据。
Qoder、Claude 等工具的 skills 目录位置各不相同，放对目录后工具才会把它列出来。

## 别动

- `references/` 下全部是生成物，手改会被 `python scripts/build_index.py` 覆盖。
- `SKILL.md` 里的输出格式约定（术语 / 英文 / 定义 / 领域 / 消歧）与网页卡片字段是
  同一套语义，改一边记得对照另一边。
- `SKILL.md` 正文里写死的三组数字 —— 866 条词条 / 2215 个口语说法 / 13 组歧义口语，
  以及 352 KB、1.3 KB、每片 36.0–53.7 KB 这几个体积 —— 都是产物的当前值（复核：
  `python scripts/build_index.py` 的首行与末两行）。数据一改它们就旧了，脚本不会替你改。
- `SKILL.md` 的 frontmatter（`name: traffic-terminology` 与 `description`）是工具列出这份
  Skill 的凭据，看着像注释，删掉或改名会让它压根不被加载，也就没有"查库内译法"这回事。
- `references/slices/` 里的 8 片与 `manifest.json` 由脚本先删后写
  （`build_index.py` 对 `*.json` 逐个 unlink 再重建），不要往里塞自制的第 9 片，下次重建就没了。
