#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成网页前端数据文件 web/data.js（内嵌词条与口语短语词典）。

匹配键 = 清洗后的口语说法（去掉「（北方）」等括注）+ 标准中文术语。
用法：python scripts/build_web.py
"""

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
WEB_DIR = ROOT / "web"

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

PAREN = re.compile(r"[（(][^）)]*[）)]")


def clean_phrase(p: str) -> str:
    return PAREN.sub("", p).strip()


entries = []
phrase_map = {}  # 匹配键 -> [词条下标]
max_len = 2
col_keys = set()

for filename in FILE_ORDER:
    path = DATA_DIR / filename
    with path.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            rec = json.loads(line)
            entry = {
                "id": rec["id"],
                "zh": rec["term_zh"],
                "en": rec["term_en"],
                "cat": rec["category"],
                "def": rec["definition"],
                "col": rec["colloquial"],
                "rel": rec.get("related", []),
            }
            if rec.get("standards"):
                entry["std"] = rec["standards"]
            if rec.get("disambiguation"):
                entry["dis"] = rec["disambiguation"]
            idx = len(entries)
            entries.append(entry)

            keys = []
            for c in rec["colloquial"]:
                k = clean_phrase(c)
                if k and k not in keys:
                    keys.append(k)
                    col_keys.add(k)
            if rec["term_zh"] not in keys:
                keys.append(rec["term_zh"])
            for k in keys:
                ids = phrase_map.setdefault(k, [])
                if idx not in ids:
                    ids.append(idx)
                max_len = max(max_len, len(k))

payload = {
    "meta": {
        "entries": len(entries),
        "colloquial": len(col_keys),
    },
    "maxLen": max_len,
    "entries": entries,
    "phrases": phrase_map,
}

WEB_DIR.mkdir(exist_ok=True)
out = WEB_DIR / "data.js"
with out.open("w", encoding="utf-8") as f:
    f.write("/* 由 scripts/build_web.py 自动生成，请勿手工编辑 */\n")
    f.write("window.TRAFFIC_DATA = ")
    json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
    f.write(";\n")

print(f"词条 {len(entries)} 条，口语键 {len(col_keys)} 个，匹配键总计 {len(phrase_map)} 个，最长键 {max_len} 字")
print(f"已写入 {out}（{out.stat().st_size / 1024:.0f} KB）")
