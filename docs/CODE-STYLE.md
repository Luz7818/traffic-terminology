# 交通用语语料库 代码风格

> 用途：给改本仓脚本与网页的人与 AI。约定来自既有实践；零第三方依赖，无 lint 配置（有意），
> 门禁是文本一致性。

## 代码风格

- Python 只用标准库（3.8+ 兼容），不引第三方包；网页 JS 原生实现，无构建、无依赖。
- 脚本职责单一：`scripts/` 下每个文件一件事，总入口只有 `run_all.py`。
- 数据清单、打分口径等跨脚本共用逻辑单源在 `scripts/corpus.py`——其他脚本 import 它，
  不复制（原四个脚本各写一份清单的写法已于 2026-09 收敛）。

## 命名与结构约定

- 数据文件 `<两位序号>_<领域>.jsonl`，词条 ID `<前缀>-<四位序号>`，ID 永不复用。
- 方言库 `data/dialect/<地区>.json`（region_code / region / entries[]）；候选池
  `candidates.jsonl` 与正式库严格分离，「待核实」条目不进转换与 Skill 管线。
- 网页匹配相关的新增键：`SMOOTH_RULES`、`MASK_TERMS` 改动必须同步 `web_check.py` 用例。

## 错误处理与编码

- Windows 控制台默认 GBK：脚本输出中文前先 `set PYTHONIOENCODING=utf-8`（或文档示例里注明）。
- 缺文件要有显式拦截与可读报错（如 `validate.py` 对缺失数据文件报 `[缺失] 数据文件不存在`）。
- 产物不带时间戳、不带机器路径——重建必须逐字节一致（字节稳定三条件见
  `docs/ARCHITECTURE.md` 数据组织方式）。

## 日志

无日志设施；校验输出即记录（validate 的错误/警告汇总、web_check 的键数统计）。
