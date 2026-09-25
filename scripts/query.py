#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""命令行查询工具：按口语说法、中文术语、英文术语或定义模糊检索词条。

用法：
  python scripts/query.py 红绿灯路口
  python scripts/query.py 加塞
  python scripts/query.py green wave
  python scripts/query.py 信号 -v     # 显示定义与关联词
  python scripts/query.py --check     # 跑内置回归用例，校验首选命中未退化
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"

# 回归用例：查询词 -> 期望的首选词条 ID。改动匹配算法或数据后用它兜住召回质量。
CHECK_CASES = [
    ("红绿灯路口", "INTX-0002"),
    ("加塞", "SAFE-0028"),
    ("堵死了", "FLOW-0040"),
    ("马路牙子", "ROAD-0040"),
    ("一路绿灯", "SIG-0043"),
    ("斑马线", "INTX-0025"),
    ("读秒", "SIG-0009"),
    ("绿化带", "ROAD-0036"),
    ("导流线", "INTX-0020"),
    ("左转待转区", "INTX-0030"),
    ("礼让行人", "INTX-0026"),
    ("区间测速", "FWY-0044"),
    ("硬路肩", "FWY-0027"),
    ("卡口", "ITS-0009"),
    ("减速带", "SAFE-0049"),
    ("违停", "SAFE-0030"),
    ("立体车库", "SAFE-0096"),
    ("追尾", "SAFE-0007"),
    ("压线", "SAFE-0027"),
    ("闯红灯", "SAFE-0026"),
    ("蓝牌", "INTX-0054"),
    ("车多到流量开始掉头", "FLOW-0065"),
    ("小区门口那条路", "ROAD-0101"),
    ("跑运输要守的规矩", "SAFE-0116"),
    ("慢慢变宽的那一段", "INTX-0096"),
    ("green wave", "SIG-0044"),
]
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


def load_entries():
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
    """返回匹配得分，None 表示不匹配。口语 > 术语 > 英文 > 定义。"""
    q_lower = q.lower()
    best = None
    for c in entry.get("colloquial", []):
        if q == c:
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


def run_check(entries):
    """回归用例：断言每个查询词的首选命中未退化，返回失败用例数。

    用 ASCII 标记避免控制台编码问题。
    """
    failed = 0
    for q, want in CHECK_CASES:
        hits = [(s, e) for e in entries if (s := score(e, q)) is not None]
        hits.sort(key=lambda se: -se[0])
        got = hits[0][1]["id"] if hits else None
        if got == want:
            print(f"OK    {q} -> {got}")
        else:
            failed += 1
            print(f"FAIL  {q} -> 期望 {want}，实得 {got}")
    print(f"\n{len(CHECK_CASES) - failed}/{len(CHECK_CASES)} 用例通过")
    return failed


def main():
    args = sys.argv[1:]
    verbose = "-v" in args
    check = "--check" in args
    args = [a for a in args if a not in ("-v", "--check")]
    entries = load_entries()
    if check:
        sys.exit(1 if run_check(entries) else 0)
    if not args:
        print(__doc__)
        sys.exit(1)
    q = " ".join(args).strip()
    hits = [(s, e) for e in entries if (s := score(e, q)) is not None]
    hits.sort(key=lambda se: -se[0])
    if not hits:
        print(f"未找到与「{q}」相关的词条")
        sys.exit(1)
    print(f"查询「{q}」，命中 {len(hits)} 条：\n")
    shown = hits[:8]
    for s, e in shown:
        print(f"[{e['id']}] {e['term_zh']}  {e['term_en']}   (匹配度 {s})")
        print(f"    口语: {'；'.join(e['colloquial'])}")
        if verbose:
            print(f"    定义: {e['definition']}")
            if e.get("related"):
                print(f"    关联: {'；'.join(e['related'])}")
            if e.get("standards"):
                print(f"    标准: {e['standards']}")
        print()
    if len(hits) > len(shown):
        print(f"... 其余 {len(hits) - len(shown)} 条略（加 -v 查看详情）")


if __name__ == "__main__":
    main()
