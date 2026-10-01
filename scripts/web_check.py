#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""网页侧回归：命令行与网页两套入口共用同一套消歧口径，这里分别锁住。

1) 消歧一致性（纯 Python，必跑）：web/data.js 里每个匹配键的候选顺序，
   必须等于按 CLI 打分（corpus.score）对该键降序、平手按文件序的期望顺序。
   build_web.py 按此排序生成数据，本步骤防止任何一侧改动后口径漂移。
   注：网页按精确匹配键扫描；CLI 查询还会做子串匹配，可能命中不带该键的
   词条（如查「动车」会子串命中口语里含「动车」二字的长句），那部分不在
   本校验范围，属两侧入口的已知差异。
2) 句子转换回归（需要 node）：用 node 加载真实的 web/app.js + web/data.js，
   跑下方 CONVERT_CASES，断言术语化改写文本与首选命中词条。node 不可用时
   跳过并提示（此时第 1 步仍然生效）。

用法：python scripts/web_check.py
"""

import json
import shutil
import subprocess
import sys
from pathlib import Path

from corpus import load_entries, score

ROOT = Path(__file__).resolve().parent.parent

# 句子 -> 期望的术语化改写全文；期望的首选词条 ID 可选（不填则只查改写文本）。
# 第 4 个元素为可选的方言地区代码（None=通用层）。
CONVERT_CASES = [
    ("早高峰那个红绿灯路口加塞太严重，车根本走不动",
     "早高峰那个信号交叉口违法变更车道行为多发，车因拥堵几乎无法移动", "FLOW-0005", None),
    ("路口堵死了", "路口发生排队溢出", "INTX-0048", None),
    ("前面好堵", "前面好拥堵", "FLOW-0037", None),
    ("昨晚撞车了", "昨晚发生道路交通事故", "SAFE-0001", None),
    ("今天一路绿灯", "今天沿线连续绿灯", "SIG-0043", None),
    ("绿灯亮了", "绿灯亮起", "SIG-0011", None),
    ("货车翻车了", "货车发生侧翻事故", "SAFE-0130", None),
    ("司机跑了", "司机肇事逃逸", "SAFE-0019", None),
    ("前方封路了，请绕行", "前方道路封闭，请绕行", "FWY-0050", None),
    ("转弯要礼让行人", "转弯要停车礼让行人", "INTX-0026", None),
    ("早高峰堵车，晚上也堵", "早高峰交通拥堵，晚上也拥堵", "FLOW-0005", None),
    ("闯红灯被拍了", "闯红灯被违法抓拍", "SAFE-0026", None),
    ("路上有点堵", "路上有些拥堵", "FLOW-0041", None),
    ("前面莫名其妙就堵了", "前面堵得莫名其妙（幽灵拥堵）", "FLOW-0069", None),
    ("路中间绿化带被占了", "路中间的中央分隔带被占了", "ROAD-0036", None),
    ("违停太多", "违法停车太多", "SAFE-0030", None),
    ("他开车接打电话", "他分心驾驶", "SAFE-0024", None),
    ("车该年检了", "车该做机动车检验了", "SAFE-0125", None),
    ("压线被拍了", "因压线被违法抓拍了", "ITS-0011", None),
    ("前方注意横风", "前方注意横风（横风区）", "FWY-0091", None),
    ("电动车逆行了", "电动车逆向行驶了", "SAFE-0117", None),
    ("骑电动车被拍了", "骑电动车被违法抓拍", "ITS-0011", None),
    # 方言层（河南 / 江苏）
    ("路上压车了，前面还有电驴乱窜", "路上交通拥堵了，前面还有电动自行车乱窜", "FLOW-0037", "henan"),
    ("这路真得劲", "这路真好走", "FLOW-0043", "henan"),
    ("过火车道要慢点", "过铁路道口要慢点", "INTX-0097", "henan"),
    ("高架上面塞车了", "高架桥上面交通拥堵了", "ROAD-0088", "jiangsu"),
    ("骑电瓶车被拍了", "骑电动自行车被违法抓拍", "SAFE-0127", "jiangsu"),
    ("道板上有摊贩", "人行道上有摊贩", "ROAD-0025", "jiangsu"),
    ("那个路太赖了", "那个路况太差了", "ROAD-0116", "henan"),
    ("那路赖得很", "那路况差得很", "ROAD-0116", "henan"),
    ("这全是搓板路", "这全是搓板路面", "ROAD-0116", None),
    ("路面坑坑洼洼没法走", "路面坑洼不平没法走", "ROAD-0068", None),
    # 通用模式合并全部地区方言
    ("路上压车了", "路上交通拥堵了", "FLOW-0037", None),
    ("那个路太赖了", "那个路况太差了", "ROAD-0116", None),
    ("高架上面塞车了，前面还有电驴", "高架桥上面交通拥堵了，前面还有电动自行车", "ROAD-0088", None),
    ("巴士上有人死火了", "公交上有人发生故障了", "TRANSIT-0002", None),
]


def load_web_data():
    """解析 web/data.js：剥掉注释与 window.TRAFFIC_DATA 赋值外壳后按 JSON 读。"""
    src = (ROOT / "web" / "data.js").read_text(encoding="utf-8")
    marker = "="
    start = src.index(marker) + len(marker)
    payload = src[start:].strip()
    if payload.endswith(";"):
        payload = payload[:-1]
    return json.loads(payload)


def check_disambiguation(data):
    """每个匹配键的候选顺序 == 按 CLI 分值降序、平手按文件序的期望顺序。返回失败键列表。"""
    entries = load_entries()  # 顺序与 data.js 的 entries 一致（都按 DATA_FILES 文件序）
    assert [e["id"] for e in entries] == [e["id"] for e in data["entries"]], \
        "web/data.js 的词条顺序与 data/ 不一致，请先跑 build_web.py"
    failed = []
    for key, ids in data["phrases"].items():
        expected = sorted(ids, key=lambda i: (-score(entries[i], key), i))
        if ids != expected:
            failed.append((key, entries[expected[0]]["id"], entries[ids[0]]["id"]))
    return failed


def run_node_cases():
    """用 node 跑真实前端代码。返回 (状态, 输出消息)。状态: PASS/SKIP/FAIL"""
    node = shutil.which("node")
    if not node:
        return "SKIP", "node 不可用，跳过句子转换回归（消歧一致性校验不受影响）"
    payload = [{"text": t, "region": r} for t, _, _, r in CONVERT_CASES]
    proc = subprocess.run(
        [node, str(ROOT / "scripts" / "web_harness.mjs")],
        input=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        capture_output=True, cwd=ROOT, timeout=60,
    )
    if proc.returncode != 0:
        return "FAIL", "node 执行失败:\n" + proc.stderr.decode("utf-8", "replace").strip()
    results = json.loads(proc.stdout.decode("utf-8"))
    failed = []
    for (text, want_conv, want_id, region), got in zip(CONVERT_CASES, results):
        problems = []
        if got["converted"] != want_conv:
            problems.append(f"改写不符: 期望「{want_conv}」，实得「{got['converted']}」")
        if want_id and got["firstId"] != want_id:
            problems.append(f"首选词条不符: 期望 {want_id}，实得 {got['firstId']}")
        if problems:
            tag = f"（{region}）" if region else ""
            failed.append(f"  「{text}」{tag}\n    " + "\n    ".join(problems))
    if failed:
        return "FAIL", f"{len(failed)}/{len(CONVERT_CASES)} 条句子回归失败:\n" + "\n".join(failed)
    return "PASS", f"{len(CONVERT_CASES)}/{len(CONVERT_CASES)} 条句子转换用例通过（node 真实跑 web/app.js）"


def main():
    data = load_web_data()
    n_keys = len(data["phrases"])
    print(f"网页匹配键 {n_keys} 个（口语键 {data['meta']['colloquial']} 去括注去重 + 标准术语键）")

    failed = check_disambiguation(data)
    if failed:
        print(f"消歧一致性 FAIL：{len(failed)} 个键的网页首候选与 CLI 首选不一致:")
        for key, cli_top, web_top in failed[:10]:
            print(f"  「{key}」CLI→{cli_top}  网页→{web_top}")
        return 1
    print(f"消歧一致性 OK：{n_keys} 个键的网页首候选与 CLI 首选全部一致")

    status, msg = run_node_cases()
    print(("句子转换回归 " if status != "SKIP" else "句子转换回归 SKIP：") + msg)
    return 0 if status in ("PASS", "SKIP") else 1


if __name__ == "__main__":
    sys.exit(main())
