#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成口语→术语反向索引与统计信息。

输出：
  skill/traffic-terminology/references/colloquial_index.json
用法：python scripts/build_index.py
"""

import json
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
OUT_PATH = ROOT / "skill" / "traffic-terminology" / "references" / "colloquial_index.json"

FILE_ORDER = [
    "01_road_infrastructure.jsonl",
    "02_intersection.jsonl",
    "03_signal_control.jsonl",
    "04_traffic_flow.jsonl",
    "05_public_transit.jsonl",
    "06_freeway.jsonl",
    "07_its.jsonl",
    "08_safety_parking.jsonl",
]

index = defaultdict(list)
entries = []
stats = {"files": [], "total_entries": 0, "total_colloquial": 0}

for filename in FILE_ORDER:
    path = DATA_DIR / filename
    count = 0
    if path.exists():
        with path.open(encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                rec = json.loads(line)
                count += 1
                summary = {
                    "id": rec["id"],
                    "term_zh": rec["term_zh"],
                    "term_en": rec["term_en"],
                    "category": rec["category"],
                    "definition": rec["definition"],
                    "related": rec.get("related", []),
                }
                if rec.get("disambiguation"):
                    summary["disambiguation"] = rec["disambiguation"]
                entries.append(summary)
                for c in rec["colloquial"]:
                    index[c].append(summary)
    stats["files"].append({"file": filename, "entries": count})
    stats["total_entries"] += count

stats["total_colloquial"] = len(index)

OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
payload = {
    "generated_note": "由 scripts/build_index.py 自动生成，请勿手工编辑",
    "stats": stats,
    "index": dict(sorted(index.items(), key=lambda kv: -len(kv[1]))),
}
with OUT_PATH.open("w", encoding="utf-8") as f:
    json.dump(payload, f, ensure_ascii=False, indent=1)

print(f"词条总数: {stats['total_entries']}")
for fi in stats["files"]:
    print(f"  {fi['file']}: {fi['entries']} 条")
print(f"口语说法总数: {stats['total_colloquial']}")
print(f"已写入: {OUT_PATH.relative_to(ROOT)}")
