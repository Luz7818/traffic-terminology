#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成网页前端数据文件 web/data.js（内嵌词条与口语短语词典）。

匹配键 = 清洗后的口语说法（去掉「（北方）」等括注）+ 标准中文术语。
每个键的候选词条按 query.py（现为 corpus.score）对「该键作为查询词」的分值
降序排列、平手保持文件序，因此网页「取首个候选」与命令行「首选命中」是
同一个词条——消歧口径由数据侧统一，两侧不会各答各的。
词条里的 sf 是 surface 的键去括注后的版本，供句中改写取用。
用法：python scripts/build_web.py
"""

import json
from pathlib import Path

from corpus import DATA_DIR, FILE_ORDER, clean_phrase, score

ROOT = Path(__file__).resolve().parent.parent
WEB_DIR = ROOT / "web"

entries = []
recs = []        # 与 entries 同序的原始记录，供候选排序时打分
phrase_map = {}  # 匹配键 -> [词条下标（按该键的 CLI 分值降序，平手保持文件序）]
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
            if rec.get("surface"):
                sf = {}
                for k, v in rec["surface"].items():
                    ck = clean_phrase(k)
                    if ck and ck not in sf:
                        sf[ck] = v
                if sf:
                    entry["sf"] = sf
            idx = len(entries)
            entries.append(entry)
            recs.append(rec)

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

# 消歧口径统一：每个键的候选顺序 = 把键当作查询词时 CLI 的命中排序
for k, ids in phrase_map.items():
    ids.sort(key=lambda i: (-score(recs[i], k), i))

# 方言对照库（data/dialect/*.json，可选地区层）：方言说法 -> 主库词条下标
dialects = {}
dialect_dir = DATA_DIR / "dialect"
for dpath in sorted(dialect_dir.glob("*.json")) if dialect_dir.exists() else []:
    ddata = json.loads(dpath.read_text(encoding="utf-8"))
    code = ddata["region_code"]
    id_to_idx = {e["id"]: i for i, e in enumerate(entries)}
    phrases = {}
    for ent in ddata.get("entries", []):
        idx = id_to_idx[ent["term"]]
        item = {"i": idx}
        if ent.get("surface"):
            item["s"] = ent["surface"]
        if ent.get("note"):
            item["n"] = ent["note"]
        phrases[ent["phrase"]] = item
        max_len = max(max_len, len(ent["phrase"]))
    dialects[code] = {"region": ddata["region"], "note": ddata.get("note", ""), "phrases": phrases}

payload = {
    "meta": {
        "entries": len(entries),
        "colloquial": len(col_keys),
    },
    "maxLen": max_len,
    "entries": entries,
    "phrases": phrase_map,
    "dialects": dialects,
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
