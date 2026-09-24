#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""一条命令跑完全部构建与校验：validate -> build_index -> build_web -> query 回归用例。

任一步失败即中止并以非 0 退出，避免数据与索引/网页长期不同步。
用法：python scripts/run_all.py
"""

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCRIPTS = ROOT / "scripts"

STEPS = [
    ("数据校验", ["validate.py"]),
    ("生成反向索引", ["build_index.py"]),
    ("生成网页数据", ["build_web.py"]),
    ("查询回归用例", ["query.py", "--check"]),
]


def main():
    for title, argv in STEPS:
        print(f"\n===== {title}: {' '.join(argv)} =====", flush=True)
        proc = subprocess.run([sys.executable, str(SCRIPTS / argv[0])] + argv[1:], cwd=ROOT)
        if proc.returncode != 0:
            print(f"\n[中止] {title} 失败（退出码 {proc.returncode}）", flush=True)
            return proc.returncode
    print("\n[完成] 全部校验与构建通过，data / 索引 / 网页已同步", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
