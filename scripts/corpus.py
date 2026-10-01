#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""语料共享配置与匹配核心：数据文件清单、词条读取、CLI 档位打分。

被 query.py / build_index.py / build_web.py / validate.py / web_check.py 复用。
新增数据文件只改这里的 DATA_FILES 一处（原 build_index.py / build_web.py /
query.py / validate.py 四处各写一份的 FILE_ORDER 与 FILE_PREFIX_MAP 已收敛于此）。
"""

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"

PAREN = re.compile(r"[（(][^）)]*[）)]")


def clean_phrase(p):
    """去掉口语说法里的「（北方）」「（口误）」等括注。网页匹配键用它。"""
    return PAREN.sub("", p).strip()

# 数据文件名 -> ID 前缀。列表顺序即读取顺序，也是打分平手时的优先顺序。
DATA_FILES = [
    ("01_road_infrastructure.jsonl", "ROAD"),
    ("02_intersection.jsonl", "INTX"),
    ("03_signal_control.jsonl", "SIG"),
    ("04_traffic_flow.jsonl", "FLOW"),
    ("05_public_transit.jsonl", "TRANSIT"),
    ("06_freeway.jsonl", "FWY"),
    ("07_its.jsonl", "ITS"),
    ("08_safety_parking.jsonl", "SAFE"),
]
FILE_ORDER = [name for name, _ in DATA_FILES]
PREFIX_BY_FILE = dict(DATA_FILES)


def load_entries():
    """按 DATA_FILES 顺序读入全部词条；文件缺失时静默跳过（与原 query.py 一致）。"""
    entries = []
    for filename in FILE_ORDER:
        path = DATA_DIR / filename
        if not path.exists():
            continue
        with path.open(encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    entries.append(json.loads(line))
    return entries


def score(entry, q):
    """返回匹配得分，None 表示不匹配。口语 > 术语 > 英文 > 定义。

    档位固定：100（口语完全相同，含「动车（口误）」去括注后相同）/
    90（中英文术语完全相同）/ 80（口语子串）/ 70（中文术语子串）/
    60（英文子串）/ 40（关联词）/ 30（定义命中），取最高档。
    括注只是注释，去括注后与查询词相同就算完全命中——这与网页匹配键
    （build_web.py 的去括注口径）一致，是 CLI 与网页消歧统一的基础。
    build_web.py 用本函数给每个匹配键的候选排序，保证网页「取首个候选」
    与 CLI「首选命中」是同一个词条。
    """
    q_lower = q.lower()
    best = None
    for c in entry.get("colloquial", []):
        if q == c or q == clean_phrase(c):
            best = max(best or 0, 100)
        elif q in c or c in q:
            best = max(best or 0, 80)
    tz = entry.get("term_zh", "")
    if q == tz:
        best = max(best or 0, 90)
    elif q in tz or tz in q:
        best = max(best or 0, 70)
    te = entry.get("term_en", "").lower()
    if q_lower == te:
        best = max(best or 0, 90)
    elif q_lower in te or te in q_lower:
        best = max(best or 0, 60)
    if q_lower in entry.get("definition", "").lower():
        best = max(best or 0, 30)
    if any(q in r for r in entry.get("related", [])):
        best = max(best or 0, 40)
    return best
