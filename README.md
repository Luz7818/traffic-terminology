# 交通用语语料库 · Traffic Terminology Corpus

> 用途：第一次打开这个仓库的人。看完知道它是什么、能不能解决你的问题、怎么立刻用上。

把日常口语、模糊的交通表述对应到标准的交通工程术语，并给出中英文与定义。
数据本体是 8 个 JSONL 文件，配三个零依赖的使用入口：网页转换器、命令行查询、AI Skill。

输入"早高峰那个红绿灯路口加塞太严重，车根本走不动"，得到的是术语化的
"早高峰时段，信号交叉口违法变更车道行为多发，导致严重拥堵"。这一步今天多由大模型完成，
模型缺一份可查证的对照表时，输出不稳定也无法审阅。这份表就是给这一步用的。

**规模**：807 条术语 · 2038 个口语说法 · 9 类领域 · 中英对照（复核：`python scripts/validate.py`）

**在线演示**：<https://luz7818.github.io/traffic-terminology/>（就是 `web/` 这四个文件，
由 CI 在推 `main` 时发布；这份表也可以离线用，双击本仓 `web/index.html` 即可，复核：
`curl -s -o /dev/null -w '%{http_code}' https://luz7818.github.io/traffic-terminology/data.js` 得 200）

| 口语说法 | 标准术语 | English |
|---|---|---|
| 红绿灯路口 | 信号交叉口 | signalized intersection |
| 加塞 | 违法变更车道 | illegal lane changing |
| 堵死了 | 严重拥堵 | severe congestion |
| 马路牙子（写作「道牙」「路牙」等） | 路缘石 | curb |
| 绿波带 | 干线协调控制 | arterial coordination (green wave coordination) |
| 凹进去的公交站 | 港湾式停靠站 | bus bay |

## 30 秒跑通

```bash
python scripts/query.py 红绿灯路口
```

看到下面这样即为正常（脚本无第三方依赖，Python 3.8+ 均可）：

```
查询「红绿灯路口」，命中 4 条：

[INTX-0002] 信号交叉口  signalized intersection   (匹配度 100)
    口语: 红绿灯路口；有红绿灯的路口；信号灯路口；灯控路口
```

不想装环境：直接用浏览器打开 `web/index.html`，双击即可，不需要服务器和网络。

完整用法（含作为 AI Skill 接入、往库里加一条术语）见
[上手手册](docs/getting-started.md)。

## 三个入口

不知道东西在哪个路径，先看 [目录说明.md](目录说明.md)：整棵目录树、每个目录的入口都在里面，它只做导航。谁负责什么以 `AGENTS.md` 的「仓库地图」为准。

| 想做什么 | 用什么 | 细节 |
|---|---|---|
| 手工转换一段口语描述、查术语 | 打开 `web/index.html` | [web/README.md](web/README.md) |
| 脚本里批量取术语 | `python scripts/query.py <说法>` | [scripts/README.md](scripts/README.md) |
| 让 AI 助手在处理交通文本时用这套词表 | 把 `skill/traffic-terminology/` 拷进支持 Skill 的目录 | [skill/README.md](skill/README.md) |

Skill 自带反向索引，拷走即可独立使用，不需要源数据。

## 数据长什么样

每行一条 JSON，字段共 10 个（6 个必填），完整格式与约束见
[data/README.md](data/README.md)。示例：

```json
{
  "id": "INTX-0002",
  "term_zh": "信号交叉口",
  "term_en": "signalized intersection",
  "category": "交叉口与标志标线",
  "definition": "设有交通信号灯并按配时规则分配通行权的交叉口。",
  "colloquial": ["红绿灯路口", "有红绿灯的路口", "信号灯路口", "灯控路口"],
  "related": ["无信号交叉口", "交通信号灯", "信号配时"],
  "standards": "GB 14886 道路交通信号灯设置与安装规范"
}
```

| 数据文件 | 领域 | ID 前缀 | 条数 |
|---|---|---|---|
| `01_road_infrastructure.jsonl` | 道路与基础设施 | ROAD | 103 |
| `02_intersection.jsonl` | 交叉口与标志标线 | INTX | 96 |
| `03_signal_control.jsonl` | 交通信号控制 | SIG | 115 |
| `04_traffic_flow.jsonl` | 交通流与拥堵 | FLOW | 95 |
| `05_public_transit.jsonl` | 公共交通 | TRANSIT | 101 |
| `06_freeway.jsonl` | 高速公路 | FWY | 90 |
| `07_its.jsonl` | 智能交通 | ITS | 91 |
| `08_safety_parking.jsonl` | 交通安全 / 静态交通（停车） | SAFE | 116 |

8 个文件装 9 类 `category` 标签（`08` 同时收两类）。术语平均带 2.54 个口语说法，
没有一条术语只有一个说法。

## 已知的不足

1. 网页转换器的消歧是"按分值排序后的第一个候选"，不看上下文（口径已与命令行统一并纳入
   回归）。「路边充电桩坏了」这类城市语境仍可能被按字面判成高速术语。需要可靠消歧请用
   Skill 或自行接模型判断。
2. 网页的术语化改写有两层兜底：数据里的 `surface` 句中改写字段（53 个词条）与改写后的
   字面平滑规则，能避免「车根本严重拥堵」这类病句；但规则是有限枚举，长句仍可能不通顺，
   应作为提示而非终稿。
3. 148/807（18.3%）条标了国标或行标依据；未标注不代表没有依据，只是还没逐条核实
   （分文件覆盖报表：`python scripts/validate.py --coverage`）。
4. 语料由人工编写，不是从真实文本抽取的。覆盖面不等于真实分布，用于训练或评测前建议先
   与真实语料对照。
5. 英文译法取交通工程惯用表达，与个别出版物用词可能不同（如"指示标志"用 `mandatory sign`）。

## 校验与可复现

```bash
python scripts/run_all.py     # 校验数据 -> 重建索引 -> 重建网页数据 -> 26 条查询回归 -> 网页回归
```

改完数据必须跑它，否则索引和网页会与数据脱节。产物不含时间戳，重建后 `git diff`
出现改动就说明数据真的变了。网页回归包含两件事：2828 个匹配键的候选顺序与命令行
打分逐一比对；node 加载真实 `web/app.js` 跑 16 条句子转换用例（本机没有 node 时
该项跳过并提示，其余照常）。

## 许可与引用

语料数据与代码均为 [CC BY 4.0](LICENSE)（署名 4.0 国际）。可自由复制、改编、商用，
需要署名并说明是否修改；本库含数据库权利条款，批量抽取词条建衍生库同样需要署名。

数据集当前版本 1.0.0（`data/VERSION`），演进记录见 [CHANGELOG.md](CHANGELOG.md)。
引用格式见 [CITATION.cff](CITATION.cff)，或写：交通用语语料库（Traffic Terminology
Corpus）v1.0.0，https://github.com/Luz7818/traffic-terminology ，CC BY 4.0。

---

准备改这个仓库的 AI 助手请先读 [AGENTS.md](AGENTS.md)。
