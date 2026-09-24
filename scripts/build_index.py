#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成口语→术语反向索引、统计信息与按领域切分的分片。

输出：
  skill/traffic-terminology/references/colloquial_index.json
      { note, stats, entries: {ID: 词条}, index: {口语说法: [ID, ...]} }
  skill/traffic-terminology/references/slices/<前缀>.json
      同一结构、只含该领域的词条与口语，供已知领域时按需加载。

词条正文只存一份（entries 表），index 仅存 ID 列表，避免同一条目被多个
口语说法重复展开导致的体积膨胀。
用法：python scripts/build_index.py
"""

import json
import shutil
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
REF_DIR = ROOT / "skill" / "traffic-terminology" / "references"
SLICE_DIR = REF_DIR / "slices"

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

FIELDS = ("term_zh", "term_en", "category", "definition", "related", "disambiguation", "standards")


def read_entries():
    out = []
    for filename in FILE_ORDER:
        path = DATA_DIR / filename
        if not path.exists():
            continue
        with path.open(encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    out.append(json.loads(line))
    return out


def build(records):
    """把词条列表编译成 {entries, index} 归一化结构。"""
    entries, index = {}, defaultdict(list)
    for rec in records:
        item = {
            "zh": rec["term_zh"],
            "en": rec["term_en"],
            "cat": rec["category"],
            "def": rec["definition"],
            "rel": rec.get("related", []),
        }
        for src, dst in (("disambiguation", "dis"), ("standards", "std")):
            if rec.get(src):
                item[dst] = rec[src]
        entries[rec["id"]] = item
        for c in rec["colloquial"]:
            if rec["id"] not in index[c]:
                index[c].append(rec["id"])
    ordered = dict(sorted(index.items(), key=lambda kv: (-len(kv[1]), kv[0])))
    return entries, ordered


records = read_entries()
entries, index = build(records)

by_prefix = defaultdict(list)
for rec in records:
    by_prefix[rec["id"].rsplit("-", 1)[0]].append(rec)

stats = {
    "total_entries": len(entries),
    "total_colloquial": len(index),
    "ambiguous_colloquial": sum(1 for v in index.values() if len(v) > 1),
    "files": [],
}
for filename in FILE_ORDER:
    stem = filename.split("_", 1)[0]
    prefix = {"01": "ROAD", "02": "INTX", "03": "SIG", "04": "FLOW",
              "05": "TRANSIT", "06": "FWY", "07": "ITS", "08": "SAFE"}[stem]
    stats["files"].append({"file": filename, "prefix": prefix, "entries": len(by_prefix[prefix])})

SLICE_DIR.mkdir(parents=True, exist_ok=True)
for old in SLICE_DIR.glob("*.json"):
    old.unlink()

payload = {
    "note": "由 scripts/build_index.py 自动生成，请勿手工编辑。index 的值是候选词条 ID，正文见 entries。",
    "stats": stats,
    "entries": entries,
    "index": index,
}
with (REF_DIR / "colloquial_index.json").open("w", encoding="utf-8") as f:
    json.dump(payload, f, ensure_ascii=False, indent=1)

manifest = []
for prefix in [s["prefix"] for s in stats["files"]]:
    recs = by_prefix[prefix]
    e, idx = build(recs)
    with (SLICE_DIR / f"{prefix}.json").open("w", encoding="utf-8") as f:
        json.dump({"note": payload["note"], "prefix": prefix, "category": recs[0]["category"],
                   "entries": e, "index": idx}, f, ensure_ascii=False, indent=1)
    manifest.append({"prefix": prefix, "category": recs[0]["category"],
                     "entries": len(e), "colloquial": len(idx), "file": f"slices/{prefix}.json"})
with (SLICE_DIR / "manifest.json").open("w", encoding="utf-8") as f:
    json.dump({"note": payload["note"], "slices": manifest}, f, ensure_ascii=False, indent=1)

print(f"词条总数: {stats['total_entries']}")
for fi in stats["files"]:
    print(f"  {fi['prefix']:8} {fi['entries']:3} 条")
print(f"口语说法总数: {stats['total_colloquial']}（其中歧义 {stats['ambiguous_colloquial']} 组）")
full = (REF_DIR / "colloquial_index.json").stat().st_size / 1024
print(f"整包索引: {full:.0f} KB；分片见 references/slices/（共 {len(manifest)} 片）")
