#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""校验 data/*.jsonl 的完整性与规范性。

检查项：JSON 可解析、必填字段、字段类型、ID 前缀与格式、全局 ID 唯一、
term_zh / term_en 全局唯一、colloquial 非空、term_en 不含中文与中文标点、
各文本字段无首尾空白、surface 键必须来自本条 colloquial、
standards 编号与名称是否自相一致（见 STANDARDS_REGISTRY）、
related 是否指向存在的术语（警告级）。

用法：python scripts/validate.py [--coverage]
  --coverage  额外打印标准依据（standards 字段）的覆盖情况，供 60% 目标跟踪。
"""

import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

from corpus import PREFIX_BY_FILE

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"

REQUIRED_FIELDS = ["id", "term_zh", "term_en", "category", "definition", "colloquial"]
ID_PATTERN = re.compile(r"^[A-Z]+-\d{4}$")

# 已核实的标准编号 -> 规范名称。standards 里出现该编号时，名称必须一致，
# 防止「编号对、名称错」这类肉眼难辨的引用错误（曾出现 GB 50688 被写成城市道路工程设计规范）。
STANDARDS_REGISTRY = {
    "GB 5768": "道路交通标志和标线",
    "GB 14886": "道路交通信号灯设置与安装规范",
    "GB 14887": "道路交通信号灯",
    "GB 25280": "道路交通信号控制机",
    "GB 50688": "城市道路交通设施设计规范",
    "GB 50763": "无障碍设计规范",
    "GB 51038": "城市道路交通标志和标线设置规范",
    "GB 50157": "地铁设计规范",
    "GB 19151": "机动车用三角警告牌",
    "GB 14166": "汽车安全带系统",
    "GB 27887": "机动车儿童乘员用约束系统",
    "GB 17761": "电动自行车安全技术规范",
    "GB 19522": "车辆驾驶人员血液、呼气酒精含量阈值与检验",
    "GB/T 33171": "城市交通运行状况评价规范",
    "CJJ 37": "城市道路工程设计规范",
    "CJJ 221": "城市地下道路工程设计规范",
    "CJJ/T 119": "城市公共交通工程术语标准",
    "HJ 640": "环境噪声监测技术规范",
    "JTG B01": "公路工程技术标准",
    "JTG D20": "公路路线设计规范",
    "JTG D81": "公路交通安全设施设计规范",
    "JTG H30": "公路养护安全作业规程",
    "GA/T 527": "城市道路交通信号控制方式适用规范",
}

errors = []
warnings = []
_args = sys.argv[1:]
if _args == ["--coverage"]:
    COVERAGE = True
elif _args:
    print(f"未知参数: {' '.join(_args)}（用法: python scripts/validate.py [--coverage]）")
    sys.exit(2)
else:
    COVERAGE = False
all_terms_zh = Counter()
all_terms_en = Counter()
all_ids = Counter()
colloquial_map = defaultdict(list)
disamb_ids = set()
related_refs = []
ambiguities_ok = 0
total = 0
per_file = defaultdict(lambda: [0, 0])  # 文件 -> [词条数, 标了 standards 的条数]
unregistered = defaultdict(list)  # 带编号但不在登记表里的 standards -> 出现位置

for filename, expected_prefix in PREFIX_BY_FILE.items():
    path = DATA_DIR / filename
    if not path.exists():
        errors.append(f"[缺失] 数据文件不存在: {filename}")
        continue
    with path.open(encoding="utf-8") as f:
        for lineno, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            loc = f"{filename}:{lineno}"
            try:
                rec = json.loads(line)
            except json.JSONDecodeError as e:
                errors.append(f"[JSON] {loc} 解析失败: {e}")
                continue
            total += 1
            per_file[filename][0] += 1

            for field in REQUIRED_FIELDS:
                if field not in rec:
                    errors.append(f"[字段] {loc} 缺少必填字段 {field}")
            if "colloquial" in rec and (not isinstance(rec["colloquial"], list) or not rec["colloquial"]):
                errors.append(f"[字段] {loc} colloquial 必须为非空数组")
            for field in ("term_zh", "term_en", "category", "definition"):
                if field in rec and not isinstance(rec[field], str):
                    errors.append(f"[字段] {loc} {field} 应为字符串")

            rid = rec.get("id", "")
            if not ID_PATTERN.match(str(rid)):
                errors.append(f"[ID] {loc} ID 格式非法: {rid!r}（应为 前缀-4位数字）")
            elif not rid.startswith(expected_prefix + "-"):
                errors.append(f"[ID] {loc} ID 前缀应为 {expected_prefix}: {rid}")
            all_ids[rid] += 1

            tz = rec.get("term_zh")
            if tz:
                all_terms_zh[tz] += 1
            te = rec.get("term_en")
            if te:
                all_terms_en[te] += 1
                if re.search(r"[\u4e00-\u9fff]", te):
                    errors.append(f"[英文] {loc} term_en 含中文字符: {te!r}")
                elif re.search(r"[（）「」，、；：／【】]", te):
                    errors.append(f"[英文] {loc} term_en 含中文标点: {te!r}")

            for field in ("id", "term_zh", "term_en", "category", "definition"):
                v = rec.get(field)
                if isinstance(v, str) and v != v.strip():
                    errors.append(f"[空白] {loc} {field} 首尾含空白字符: {v!r}")

            colloquial = rec.get("colloquial")
            if isinstance(colloquial, list):
                for c in colloquial:
                    if not isinstance(c, str) or not c.strip():
                        errors.append(f"[口语] {loc} colloquial 含空项")
                        continue
                    if c != c.strip():
                        errors.append(f"[空白] {loc} colloquial 首尾含空白字符: {c!r}")
                    colloquial_map[c].append(rec.get("id", "?"))

            std = rec.get("standards")
            if isinstance(std, str) and std.strip():
                per_file[filename][1] += 1
                if not (std.startswith("中华人民共和国")
                        or any(std.startswith(num + " ") for num in STANDARDS_REGISTRY)):
                    unregistered[std.strip()].append(loc)
                for num, canonical in STANDARDS_REGISTRY.items():
                    if std.startswith(num + " ") and std[len(num) + 1:].strip() != canonical:
                        errors.append(
                            f"[标准] {loc} {num} 的名称应为「{canonical}」，实为「{std[len(num) + 1:].strip()}」")
                        break
            if rec.get("disambiguation"):
                disamb_ids.add(str(rid))

            # surface：句中改写（网页转换与 Skill 整句改写时替换 colloquial 用的形式）
            sf = rec.get("surface")
            if sf is not None:
                if not isinstance(sf, dict) or not sf:
                    errors.append(f"[改写] {loc} surface 应为非空对象")
                elif isinstance(colloquial, list):
                    for k, v in sf.items():
                        if k not in colloquial:
                            errors.append(f"[改写] {loc} surface 键「{k}」不在本条 colloquial 里")
                        elif not isinstance(v, str) or not v.strip():
                            errors.append(f"[改写] {loc} surface[「{k}」] 应为非空字符串")
                        elif v != v.strip():
                            errors.append(f"[改写] {loc} surface[「{k}」] 首尾含空白字符: {v!r}")

            rel = rec.get("related", [])
            if isinstance(rel, list):
                related_refs.extend((loc, r) for r in rel if isinstance(r, str))

for rid, cnt in all_ids.items():
    if cnt > 1:
        errors.append(f"[ID] ID 重复 {cnt} 次: {rid}")
for tz, cnt in all_terms_zh.items():
    if cnt > 1:
        errors.append(f"[术语] term_zh 重复 {cnt} 次: {tz}")
for te, cnt in all_terms_en.items():
    if cnt > 1:
        warnings.append(f"[术语] term_en 相同: {te}")

# 方言对照库（data/dialect/*.json）：说法须映射到库内词条，区域内唯一
DIALECT_DIR = DATA_DIR / "dialect"
known_ids = {r for r in all_ids if all_ids[r] == 1}
seen_dialect_regions = set()
cross_region = {}  # phrase -> [(region_code, term, surface)]
unknown_regions = {}  # 候选池里尚无正式地区库的地区 -> 条数
for dfile in sorted(DIALECT_DIR.glob("*.json")) if DIALECT_DIR.exists() else []:
    try:
        ddata = json.loads(dfile.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as e:
        errors.append(f"[方言] {dfile.name} 解析失败: {e}")
        continue
    code = ddata.get("region_code", "")
    region = ddata.get("region", "")
    if not code or not region:
        errors.append(f"[方言] {dfile.name} 缺 region_code / region")
    if code in seen_dialect_regions:
        errors.append(f"[方言] region_code 重复: {code}")
    seen_dialect_regions.add(code)
    seen_phrases = set()
    entries = ddata.get("entries", [])
    if not isinstance(entries, list) or not entries:
        errors.append(f"[方言] {dfile.name} entries 应为非空数组")
    for ent in entries if isinstance(entries, list) else []:
        phrase = ent.get("phrase", "")
        term = ent.get("term", "")
        if not phrase or not phrase.strip():
            errors.append(f"[方言] {dfile.name} 存在空 phrase")
            continue
        if phrase != phrase.strip():
            errors.append(f"[方言] {dfile.name} phrase 首尾含空白: {phrase!r}")
        if phrase in seen_phrases:
            errors.append(f"[方言] {dfile.name} phrase 重复: {phrase}")
        seen_phrases.add(phrase)
        cross_region.setdefault(phrase, []).append(
            (code, term, ent.get("surface")))
        if phrase in colloquial_map:
            warnings.append(
                f"[方言] {dfile.name} 「{phrase}」已是主库口语键（{', '.join(colloquial_map[phrase])}），网页里主库优先，该条不会生效")
        if term not in known_ids:
            errors.append(f"[方言] {dfile.name} 「{phrase}」映射的词条不存在: {term}")
        surface = ent.get("surface")
        if surface is not None and (not isinstance(surface, str) or not surface.strip()):
            errors.append(f"[方言] {dfile.name} 「{phrase}」surface 应为非空字符串")

# 候选池（candidates.jsonl）：机器整理的待核实条目，不进 build_web / Skill 管线
cand_file = DIALECT_DIR / "candidates.jsonl"
if cand_file.exists():
    seen_cand = set()
    for lineno, line in enumerate(cand_file.read_text(encoding="utf-8").splitlines(), 1):
        if not line.strip():
            continue
        try:
            c = json.loads(line)
        except json.JSONDecodeError as e:
            errors.append(f"[候选] candidates.jsonl:{lineno} 解析失败: {e}")
            continue
        loc = f"candidates.jsonl:{lineno}"
        phrase = c.get("phrase", "")
        if not phrase.strip():
            errors.append(f"[候选] {loc} phrase 为空")
            continue
        if phrase in seen_cand:
            errors.append(f"[候选] {loc} phrase 重复: {phrase}")
        seen_cand.add(phrase)
        if phrase in cross_region or phrase in colloquial_map:
            warnings.append(f"[候选] {loc} 「{phrase}」已是正式说法，请从候选池移除")
        if c.get("status") != "待核实":
            errors.append(f"[候选] {loc} status 应为「待核实」（核实后请移入对应地区库）")
        rc = c.get("region_code")
        if rc not in seen_dialect_regions and rc != "national":
            unknown_regions.setdefault(rc, 0)
            unknown_regions[rc] += 1
        pt = c.get("proposed_term")
        if pt is not None and pt not in known_ids:
            errors.append(f"[候选] {loc} proposed_term 不存在: {pt}")

for rc, n in sorted(unknown_regions.items()):
    warnings.append(f"[候选] {n} 条候选属于尚无正式地区库的地区「{rc}」，核实后先建 <rc>.json 再转入")

for phrase, hits in cross_region.items():
    if len(hits) > 1:
        targets = {(term, surface) for _, term, surface in hits}
        if len(targets) > 1:
            errors.append(
                f"[方言] 「{phrase}」在多个地区映射到不同词条（{hits}），通用模式无法消歧")
        else:
            warnings.append(
                f"[方言] 「{phrase}」在多个地区共挂同一条（{', '.join(c for c, _, _ in hits)}），属正常")

# related 指向性检查（警告级）：允许命中任一词条的 term_zh / colloquial / term_en
# 词表直接复用主循环已经收集的结果，不再重读一遍数据文件。
known_terms = set(all_terms_zh) | set(colloquial_map) | set(all_terms_en)
for loc, rel in related_refs:
    if rel not in known_terms:
        warnings.append(f"[关联] {loc} related 未命中任何术语/口语/英文: {rel}")

# 一词多义提示（口语说法映射到多个术语，属正常但需 disambiguation 字段说明取舍）
for c, ids in sorted(colloquial_map.items()):
    uniq = sorted(set(ids))
    if len(uniq) > 1:
        missing = [i for i in uniq if i not in disamb_ids]
        if missing:
            warnings.append(
                f"[消歧] 口语「{c}」映射到 {len(uniq)} 个词条，以下缺 disambiguation: {', '.join(missing)}")
        else:
            ambiguities_ok += 1

print(f"共读取 {total} 条词条")
print(f"错误 {len(errors)} 项，警告 {len(warnings)} 项")
print(f"歧义口语 {ambiguities_ok} 组，均已给出 disambiguation")
for e in errors:
    print("ERROR ", e)
for w in warnings:
    print("WARN  ", w)

if COVERAGE:
    n_std = sum(n for _, n in per_file.values())
    pct = n_std / total * 100 if total else 0.0
    print(f"\n===== 标准依据覆盖（--coverage）=====")
    print(f"已标 standards: {n_std}/{total}（{pct:.1f}%），距 60% 目标还差 {max(0, int(total * 0.6) - n_std)} 条")
    for filename, (n_total, n_with) in per_file.items():
        p = n_with / n_total * 100 if n_total else 0.0
        print(f"  {filename:34} {n_with:3}/{n_total:3}（{p:4.1f}%）")
    if unregistered:
        n = sum(len(v) for v in unregistered.values())
        print(f"带编号但未登记进 STANDARDS_REGISTRY 的引用 {n} 处（编号与名称目前不校验，建议补登记）:")
        for std, locs in sorted(unregistered.items()):
            print(f"  {std}  ←  {', '.join(locs[:3])}{'…' if len(locs) > 3 else ''}")
    print("法规类引用（中华人民共和国开头）不校验编号，计入覆盖数。")

sys.exit(1 if errors else 0)
