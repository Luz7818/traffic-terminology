#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""校验 data/*.jsonl 的完整性与规范性。

检查项：JSON 可解析、必填字段、字段类型、ID 前缀与格式、全局 ID 唯一、
term_zh / term_en 全局唯一、colloquial 非空、term_en 不含中文与中文标点、
各文本字段无首尾空白、standards 编号与名称是否自相一致（见 STANDARDS_REGISTRY）、
related 是否指向存在的术语（警告级）。

用法：python scripts/validate.py
"""

import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"

# 文件名前缀 -> 允许的 ID 前缀
FILE_PREFIX_MAP = {
    "01_road_infrastructure.jsonl": "ROAD",
    "02_intersection.jsonl": "INTX",
    "03_signal_control.jsonl": "SIG",
    "04_traffic_flow.jsonl": "FLOW",
    "05_public_transit.jsonl": "TRANSIT",
    "06_freeway.jsonl": "FWY",
    "07_its.jsonl": "ITS",
    "08_safety_parking.jsonl": "SAFE",
}

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
all_terms_zh = Counter()
all_terms_en = Counter()
all_ids = Counter()
term_zh_lookup = {}
colloquial_map = defaultdict(list)
disamb_ids = set()
ambiguities_ok = 0
total = 0

for filename, expected_prefix in FILE_PREFIX_MAP.items():
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
                term_zh_lookup[tz] = rid
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

            for c in rec.get("colloquial", []) if isinstance(rec.get("colloquial"), list) else []:
                if not isinstance(c, str) or not c.strip():
                    errors.append(f"[口语] {loc} colloquial 含空项")
                else:
                    if c != c.strip():
                        errors.append(f"[空白] {loc} colloquial 首尾含空白字符: {c!r}")
                    colloquial_map[c].append(rec.get("id", "?"))

            std = rec.get("standards")
            if rec.get("disambiguation"):
                disamb_ids.add(str(rid))
            if isinstance(std, str) and std.strip():
                for num, canonical in STANDARDS_REGISTRY.items():
                    if std.startswith(num + " ") and std[len(num) + 1:].strip() != canonical:
                        errors.append(
                            f"[标准] {loc} {num} 的名称应为「{canonical}」，实为「{std[len(num) + 1:].strip()}」")
                        break

for rid, cnt in all_ids.items():
    if cnt > 1:
        errors.append(f"[ID] ID 重复 {cnt} 次: {rid}")
for tz, cnt in all_terms_zh.items():
    if cnt > 1:
        errors.append(f"[术语] term_zh 重复 {cnt} 次: {tz}")
for te, cnt in all_terms_en.items():
    if cnt > 1:
        warnings.append(f"[术语] term_en 相同: {te}")

# related 指向性检查（警告级）：允许命中任一词条的 term_zh / colloquial / term_en
known_terms = set(term_zh_lookup)
known_terms.update(colloquial_map.keys())
known_en = set()
for filename in FILE_PREFIX_MAP:
    path = DATA_DIR / filename
    if not path.exists():
        continue
    with path.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                rec = json.loads(line)
            except json.JSONDecodeError:
                continue
            known_en.add(rec.get("term_en", ""))
for filename in FILE_PREFIX_MAP:
    path = DATA_DIR / filename
    if not path.exists():
        continue
    with path.open(encoding="utf-8") as f:
        for lineno, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            try:
                rec = json.loads(line)
            except json.JSONDecodeError:
                continue
            for rel in rec.get("related", []):
                if rel not in known_terms and rel not in known_en:
                    warnings.append(f"[关联] {filename}:{lineno} related 未命中任何术语/口语/英文: {rel}")

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
sys.exit(1 if errors else 0)
