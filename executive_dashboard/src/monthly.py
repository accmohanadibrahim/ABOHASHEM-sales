"""Monthly intake checklist — the files the dashboard needs for one month, by fixed name.

Each month has a folder data/monthly/YYYY-MM/ holding these files under these names,
so a month's update is "drop the files, run the build". The months already in the
dashboard were delivered before this layout; their files stay where they are in
data/raw/ops (named kind_YYYY-MM), and the checklist accepts them there too.

    python3 -m src.monthly 2026-10            the checklist for one month (exit 1 if a
                                              required file is missing)
    python3 build_all.py --month 2026-10 --strict
                                              the same check, and stop before building
"""
from __future__ import annotations

import re
import sys
from collections import OrderedDict
from pathlib import Path

from .config import REPO_ROOT

MONTHLY = REPO_ROOT / "data" / "monthly"
LEGACY = REPO_ROOT / "data" / "raw" / "ops"

# fixed name → (required, what it is, who delivers it, legacy file pattern in data/raw/ops)
MANIFEST = OrderedDict([
    ("sales_invoices.pdf", (True, "فواتير المبيعات للشهر ببنودها (من 1 إلى آخر الشهر)", "الإدارة", None)),
    ("collections.pdf", (True, "تحصيلات العملاء للشهر", "الإدارة", None)),
    ("returns_items.pdf", (True, "مرتجعات العملاء للشهر بالأصناف", "الإدارة", "returns_items_{m}.pdf")),
    ("customer_balances_by_rep.pdf", (True, "أرصدة العملاء حسب المندوب فى آخر يوم من الشهر", "الإدارة", None)),
    ("supplier_balances.pdf", (True, "أرصدة الموردين", "الإدارة", "suppliers_{m}-*.pdf")),
    ("purchases.pdf", (True, "تقرير المشتريات التفصيلى للشهر", "الإدارة", "purchases_{m}.pdf")),
    ("inventory_valuation.xlsx", (True, "الجرد آخر الشهر مُسعّرًا بمتوسط التكلفة — "
                                        "stock_count_priced.xlsx من مستودع Abohashem (monthly/YYYY-MM)",
                                  "Abohashem", "inventory_valuation_{m}.xlsx")),
    ("wac.json", (False, "متوسط تكلفة الخامات وسعر كجم الوصفات — wac.json من مستودع Abohashem",
                  "Abohashem", None)),
    ("wac_model.xlsx", (False, "مصنّف احتساب المتوسط التفصيلى (إن صدر)", "Abohashem", "wac_model_{m}.xlsx")),
    ("stock_count.xlsx", (False, "الجرد الفعلى قبل التسعير", "الإدارة", "stock_count_{m}.xlsx")),
    ("income_statement.pdf", (False, "قائمة الدخل التفصيلية للشهر", "المحاسب", None)),
])


def find(name: str, month: str) -> Path | None:
    """Where the month's file is: data/monthly/YYYY-MM/<name>, else its legacy data/raw/ops file."""
    p = MONTHLY / month / name
    if p.exists():
        return p
    pattern = MANIFEST[name][3]
    if pattern:
        hits = sorted(LEGACY.glob(pattern.format(m=month)))
        if hits:
            return hits[-1]
    return None


def check(month: str) -> list[dict]:
    rows = []
    for name, (required, desc, owner, _pat) in MANIFEST.items():
        p = find(name, month)
        rows.append({"file": f"data/monthly/{month}/{name}", "required": required, "desc": desc, "owner": owner,
                     "found": str(p.relative_to(REPO_ROOT)) if p else None})
    return rows


def missing(month: str) -> list[dict]:
    return [r for r in check(month) if r["required"] and not r["found"]]


def months() -> list[str]:
    """Every month with at least one file, in either layout."""
    found = {d.name for d in MONTHLY.glob("????-??") if d.is_dir() and any(d.iterdir())}
    for f in LEGACY.iterdir() if LEGACY.exists() else []:
        m = re.search(r"_(\d{4}-\d{2})(?:-\d{2})?\.\w+$", f.name)
        if m:
            found.add(m.group(1))
    return sorted(found)


def report(month: str) -> str:
    rows = check(month)
    lines = [f"قائمة استلام ملفات {month}:"]
    for r in rows:
        mark = "✔" if r["found"] else ("✘ ناقص" if r["required"] else "– غير موجود (اختيارى)")
        where = f"  ← {r['found']}" if r["found"] and not r["found"].startswith("data/monthly/") else ""
        lines.append(f"  {mark}  {r['file']}  ({r['desc']} — {r['owner']}){where}")
    n = sum(r["required"] and not r["found"] for r in rows)
    lines.append(f"  {'مكتمل' if not n else f'{n} ملف مطلوب ناقص'}")
    return "\n".join(lines)


def main(argv=None) -> int:
    argv = sys.argv[1:] if argv is None else argv
    ms = argv or months()[-1:]
    if not ms or not all(re.fullmatch(r"\d{4}-\d{2}", m) for m in ms):
        print("usage: python3 -m src.monthly YYYY-MM", file=sys.stderr)
        return 2
    for m in ms:
        print(report(m))
    return 1 if any(missing(m) for m in ms) else 0


if __name__ == "__main__":
    raise SystemExit(main())
