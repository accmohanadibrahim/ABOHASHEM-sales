#!/usr/bin/env python3
"""Rebuild the mobile dashboard chain in order, with one command.

    mobile/Abu_Hashem_Mobile_standalone.html        the original, never edited
      → merge_into_mobile.py   → mobile/Abu_Hashem_Mobile_merged.html
      → enhance_mobile.py      → mobile/Abu_Hashem_Mobile_enhanced.html
      → python3 -m src.ops_ingest → ../data/processed/ops_data.json
      → enrich_mobile.py       → mobile/Abu_Hashem_Mobile_full.html   (production)
      → bi_mobile.py           → mobile/Abu_Hashem_Mobile_bi.html     («ذكاء الأعمال», dev file only)

Usage:
  python3 build_all.py            rebuild every stage
  python3 build_all.py --check    rebuild, then fail if any committed output changed
  python3 build_all.py --skip-ingest
                                  reuse the committed ops_data.json (no pdftotext,
                                  openpyxl or LibreOffice needed)
  python3 build_all.py --month 2026-10 --strict
                                  check that month's files first (src/monthly.py) and
                                  stop before building if a required one is missing

Every build starts by printing the month's intake checklist (the latest month with
files unless --month is given), naming each missing file.

The desktop pipeline (build.py → data.js, statements_data.js) is not part of this
chain: data.js is the frozen 16/7 sales snapshot and build.py does not rebuild it
byte for byte, so rerunning it would rewrite the snapshot. Run it on its own when
new sales files arrive.
"""
import argparse
import hashlib
import subprocess
import sys
from pathlib import Path

APP = Path(__file__).resolve().parent
MOB = APP / "mobile"
OPS_JSON = APP.parent / "data" / "processed" / "ops_data.json"

STAGES = [
    ("merge", [sys.executable, "merge_into_mobile.py"], MOB / "Abu_Hashem_Mobile_merged.html"),
    ("enhance", [sys.executable, "enhance_mobile.py"], MOB / "Abu_Hashem_Mobile_enhanced.html"),
    ("ingest", [sys.executable, "-m", "src.ops_ingest"], OPS_JSON),
    ("enrich", [sys.executable, "enrich_mobile.py"], MOB / "Abu_Hashem_Mobile_full.html"),
    ("bi", [sys.executable, "bi_mobile.py"], MOB / "Abu_Hashem_Mobile_bi.html"),
]


def digest(path: Path) -> str:
    return hashlib.md5(path.read_bytes()).hexdigest() if path.exists() else "-"


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--check", action="store_true", help="fail if a rebuilt output differs from the one on disk")
    ap.add_argument("--skip-ingest", action="store_true", help="keep the committed ops_data.json")
    ap.add_argument("--month", help="YYYY-MM whose intake checklist to print (default: the latest month with files)")
    ap.add_argument("--strict", action="store_true", help="stop before building if a required file of --month is missing")
    args = ap.parse_args(argv)

    sys.path.insert(0, str(APP))
    from src import monthly
    month = args.month or (monthly.months() or [None])[-1]
    if month:
        print(monthly.report(month), flush=True)
        if args.strict and monthly.missing(month):
            print(f"stopped: {month} is missing required files (listed above)")
            return 2

    changed = []
    for name, cmd, out in STAGES:
        if name == "ingest" and args.skip_ingest:
            print(f"[{name}] skipped — using {out.relative_to(APP.parent)}")
            continue
        before = digest(out)
        print(f"[{name}] {' '.join(cmd[1:])}", flush=True)
        subprocess.run(cmd, cwd=APP, check=True)
        after = digest(out)
        if after != before:
            changed.append(out)
        print(f"[{name}] {out.name} {after}{'  (changed)' if after != before else ''}")

    if args.check and changed:
        print("outputs differ from the committed files:", *[f"  {p.relative_to(APP.parent)}" for p in changed], sep="\n")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
