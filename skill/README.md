# skill/ —— 可直接安装的 AI Skill

> 用途：说明这份 Skill 由什么组成、上下文预算怎么安排、怎么重新生成。
> 整个 `traffic-terminology/` 目录拷进支持 Skill 的工具目录即可使用，不依赖仓库其余部分。

Skill 的作用是把「口语 → 标准术语」这件事交给模型时，给它一份可查的对照表和明确的
查询步骤，避免它凭印象编造译法。`SKILL.md` 是给模型的指令，`references/` 是它要读的数据。

## 文件清单

| 文件 | 干什么 | 备注 |
|---|---|---|
| `traffic-terminology/SKILL.md` | 技能说明与工作流程：识别口语表述 → 查索引 → 按消歧规则选择 → 按规定格式输出 | 含 8 个 ID 前缀的领域对照表与消歧规则 |
| `traffic-terminology/references/colloquial_index.json` | 反向索引：`口语说法 → [词条 ID]`，加上一份 `entries` 正文表 | **脚本产物**，约 319 KB |
| `traffic-terminology/references/slices/manifest.json` | 8 个分片的目录：前缀、类别、条数、文件名 | **脚本产物**，1.3 KB |
| `traffic-terminology/references/slices/<前缀>.json` | ROAD / INTX / SIG / FLOW / TRANSIT / FWY / ITS / SAFE 各一片 | **脚本产物**，每片 35–48 KB |

## 为什么索引要另存一份

网页用 `web/data.js`，Skill 用 `references/`，两份都从 `data/*.jsonl` 重建。
分开的原因是体积与读法：模型一次读入 295 KB 的整页数据太浪费上下文，所以索引做成
归一化结构（正文只存一份，`index` 只放 ID 列表），再按前缀切片，让模型先看 1.3 KB 的
目录、只加载相关的那一片。

两种读法的数据量差别：归一化后整包 319 KB（复核：`python scripts/build_index.py` 末行）；
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
3. 领域不确定时，`SKILL.md` 要求回查整包而不是强行按单片作答 —— 全库有 12 组跨词条
   歧义口语（复核：`python scripts/validate.py`）。

## 别动

- `references/` 下全部是生成物，手改会被覆盖。
- `SKILL.md` 里的输出格式约定（术语 / 英文 / 定义 / 领域 / 消歧）与网页卡片字段是
  同一套语义，改一边记得对照另一边。
