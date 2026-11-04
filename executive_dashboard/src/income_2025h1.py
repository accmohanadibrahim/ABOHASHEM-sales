"""January–May 2025 income statements, for «قوائم الدخل 2025 كاملة».

Sources (copied unchanged into ``data/raw/income_2025/``; uploaded to the repository root
on 26/10/2026 as ``دخل شهر N سنة ٢٠٢٥.pdf.txt``): the text pulled out of each month's
statement PDF. The PDFs themselves were not uploaded, and the text is partly garbled —
April's is mostly one reversed line — so the lines cannot be parsed reliably.

The headline figures are therefore transcribed in ``FIGURES`` below, and the build stops
unless, for every month:
  * each transcribed number appears verbatim in that month's text (with or without
    thousands separators), so nothing is typed in that the statement does not print;
  * gross sales − returns − allowed discount = net sales (when the statement prints it),
  * net sales − cost of sales − inbound freight + earned discount = gross profit, and
  * gross profit − the expense sections = the printed net profit.

Nothing is estimated:
  * every month is tagged «مستخرج من نص PDF — يحتاج مراجعة» until the PDFs are checked;
  * March prints exactly February's sales, returns, discount and cost — the figures are
    kept as printed and flagged «يحتاج تأكيد» (the invoices give different sales);
  * June 2025 has no statement and is listed as «يحتاج بيانات»;
  * July–December 2025 are not read here: they are DASH_FS (src/statements.py), unchanged.

Each month's net sales are set beside the invoice total for the month
(``data/processed/eda_monthly_series.csv``, from the sales invoices) — two independent
sources, compared, not reconciled.

    python3 -m src.income_2025h1        # from executive_dashboard/
"""
from __future__ import annotations

import csv
import hashlib
import json
import re
import sys
from pathlib import Path

APP_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = APP_DIR.parent
RAW = REPO_ROOT / "data" / "raw" / "income_2025"
SERIES = REPO_ROOT / "data" / "processed" / "eda_monthly_series.csv"
FS_JSON = REPO_ROOT / "data" / "processed" / "financial_statements.json"
OUT_JSON = REPO_ROOT / "data" / "processed" / "income_2025h1.json"
TOL = 0.02

TEXT_BASIS = "مستخرج من نص PDF — يحتاج مراجعة"
UPLOADED_AS = "دخل شهر {} سنة ٢٠٢٥.pdf.txt"
ARABIC_DIGITS = "١٢٣٤٥"

# As printed. `net_sales` is None where the statement leaves the line blank (Feb, Mar).
# `sections`: Jan prints its expenses as items plus one lump «مصروفات» with no
# admin/selling split; Feb–May print an administrative and a selling total.
FIGURES = {
    "2025-01": {"gross_sales": 3272205.26, "returns": 73508.00, "discount": 337354.15, "net_sales": 2861343.12,
                "inbound_freight": 231.27, "cogs": 1803768.00, "earned_discount": 743.42, "gross_profit": 1058087.27,
                "sections": {"commission": 49550.00, "external_labour": 55180.00, "salaries": 165580.00,
                             "rent": 87450.00, "other": 312588.00},
                "net_profit": 387739.27},
    "2025-02": {"gross_sales": 3069929.5, "returns": 121981.5, "discount": 269458.5, "net_sales": None,
                "inbound_freight": 0.0, "cogs": 1587910.48, "earned_discount": 0.0, "gross_profit": 1090579.02,
                "sections": {"admin": 566990, "selling": 233196},
                "net_profit": 290393.02},
    "2025-03": {"gross_sales": 3069929.50, "returns": 121981.50, "discount": 269458.50, "net_sales": None,
                "inbound_freight": 0.0, "cogs": 1587910.48, "earned_discount": 0.0, "gross_profit": 1090579.02,
                "sections": {"admin": 426464, "selling": 269455},
                "net_profit": 394660.02},
    "2025-04": {"gross_sales": 2742183.00, "returns": 60105.00, "discount": 296388.00, "net_sales": 2385690.00,
                "inbound_freight": 0.0, "cogs": 1107881.61, "earned_discount": 0.0, "gross_profit": 1277808.39,
                "sections": {"admin": 554870, "selling": 262375},
                "net_profit": 460563.39},
    "2025-05": {"gross_sales": 3465258.00, "returns": 96969.00, "discount": 295051.00, "net_sales": 3073238.00,
                "inbound_freight": 0.0, "cogs": 1480474.80, "earned_discount": 0.0, "gross_profit": 1592763.20,
                "sections": {"admin": 639409, "selling": 289404},
                "net_profit": 663950.20},
}
SECTION_LABELS = {"admin": "مصروفات إدارية وعمومية", "selling": "مصروفات بيعية وتسويقية", "commission": "عمولة",
                  "external_labour": "عمالة خارجية", "salaries": "مرتبات", "rent": "إيجار", "other": "مصروفات"}
MISSING = {"2025-06": "لا قائمة دخل لشهر يونيو 2025 في الملفات المرفوعة"}
CHECK_FIELDS = ("gross_sales", "returns", "discount", "net_sales", "inbound_freight", "cogs", "earned_discount",
                "gross_profit", "net_profit")


def source(month: str) -> Path:
    return RAW / f"income_statement_{month}.txt"


def spellings(x: float) -> set[str]:
    """How the statement may print x: 1234.5 → 1234.5, 1234.50, 1,234.50 …"""
    out = set()
    for dec in (0, 1, 2, 3):
        if dec == 0 and x != int(x):
            continue
        if dec and round(x, dec) != round(x, 2):
            continue
        s = f"{x:.{dec}f}"
        out.add(s)
        out.add(f"{x:,.{dec}f}")
    return out


def printed(text: str, x: float) -> bool:
    nums = set(re.findall(r"\d[\d,]*(?:\.\d+)?", text))
    return bool(nums & spellings(x))


def check_month(month: str, f: dict, text: str) -> list[str]:
    errs = []
    for k in CHECK_FIELDS:
        v = f[k]
        if v not in (None, 0.0) and not printed(text, v):
            errs.append(f"{month}: {k} {v} not printed in {source(month).name}")
    for k, v in f["sections"].items():
        if not printed(text, v):
            errs.append(f"{month}: section {k} {v} not printed in {source(month).name}")
    net = f["gross_sales"] - f["returns"] - f["discount"]
    if f["net_sales"] is not None and abs(net - f["net_sales"]) > TOL:
        errs.append(f"{month}: gross − returns − discount = {net:.2f} ≠ net sales {f['net_sales']}")
    gp = net - f["cogs"] - f["inbound_freight"] + f["earned_discount"]
    if abs(gp - f["gross_profit"]) > TOL:
        errs.append(f"{month}: net sales − cost = {gp:.2f} ≠ gross profit {f['gross_profit']}")
    npf = f["gross_profit"] - sum(f["sections"].values())
    if abs(npf - f["net_profit"]) > TOL:
        errs.append(f"{month}: gross profit − expenses = {npf:.2f} ≠ net profit {f['net_profit']}")
    return errs


def invoice_sales() -> dict[str, float]:
    if not SERIES.exists():
        return {}
    with SERIES.open(encoding="utf-8") as fh:
        return {r["month"]: round(float(r["revenue"]), 2) for r in csv.DictReader(fh)}


def h2_months() -> list[dict]:
    """July–December 2025 as DASH_FS holds them — read only, for the full-year view."""
    if not FS_JSON.exists():
        return []
    inc = json.loads(FS_JSON.read_text(encoding="utf-8")).get("income", {})
    out = []
    for m in sorted(inc):
        r = inc[m]
        out.append({"month": m, "net_sales": r["net_sales"], "cogs": r["cogs"], "gross_profit": r["gross_profit"],
                    "sections": {"admin": r.get("admin"), "selling": r.get("selling"), "finance": r.get("finance")},
                    "net_profit": r.get("net_profit_pre_dep"), "net_profit_basis": "قبل الإهلاك",
                    "source": r.get("source"), "basis": "مُتحقَّق — DASH_FS"})
    return out


def build() -> dict:
    inv = invoice_sales()
    months, errs = [], []
    for i, (m, f) in enumerate(FIGURES.items()):
        text = source(m).read_text(encoding="utf-8")
        errs += check_month(m, f, text)
        net = f["net_sales"] if f["net_sales"] is not None else round(f["gross_sales"] - f["returns"] - f["discount"], 2)
        flags = []
        if f["net_sales"] is None:
            flags.append("صافي المبيعات غير مطبوع في القائمة — محسوب: المبيعات − المردودات − الخصم")
        if "admin" not in f["sections"]:
            flags.append("المصروفات بلا تقسيم إداري/بيعي في القائمة")
        months.append({
            "month": m, **{k: f[k] for k in CHECK_FIELDS}, "net_sales": net, "net_sales_printed": f["net_sales"] is not None,
            "sections": dict(f["sections"]), "expenses": round(sum(f["sections"].values()), 2),
            "basis": TEXT_BASIS, "flags": flags, "source": f"data/raw/income_2025/{source(m).name}",
            "uploaded_as": UPLOADED_AS.format(ARABIC_DIGITS[i]),
            "sha256": hashlib.sha256(source(m).read_bytes()).hexdigest(),
            "invoice_sales": inv.get(m),
        })
    # March prints February's revenue and cost to the piastre: kept as printed, flagged.
    by = {r["month"]: r for r in months}
    keys = ("gross_sales", "returns", "discount", "cogs")
    pair = None
    if all(by["2025-03"][k] == by["2025-02"][k] for k in keys):
        by["2025-03"]["flags"].append("نفس مبيعات ومردودات وخصم وتكلفة فبراير بالقرش — يحتاج تأكيد")
        by["2025-03"]["needs_confirmation"] = True
        # Hypothesis, not a correction: the statements' net sales run 2–3% under the invoice totals in
        # the other months; February + March together sit in that band, as if one two-month total was halved.
        if all(by[m]["invoice_sales"] for m in by):
            ratio = {m: round(r["net_sales"] / r["invoice_sales"] - 1, 4) for m, r in by.items()}
            two = by["2025-02"]["net_sales"] + by["2025-03"]["net_sales"]
            inv2 = by["2025-02"]["invoice_sales"] + by["2025-03"]["invoice_sales"]
            pair = {"months": ["2025-02", "2025-03"], "net_sales": round(two, 2), "invoice_sales": round(inv2, 2),
                    "ratio": round(two / inv2 - 1, 4), "other_months_ratio": {m: v for m, v in ratio.items()
                                                                              if m not in ("2025-02", "2025-03")},
                    "basis": "فرضية"}
    if errs:
        raise SystemExit("income_2025h1: the transcribed figures do not hold:\n  " + "\n  ".join(errs))
    return {
        "meta": {"basis": TEXT_BASIS, "note": "يناير–مايو 2025 من نص القوائم؛ يونيو لا قائمة؛ يوليو–ديسمبر من DASH_FS كما هي",
                 "invoice_series": "data/processed/eda_monthly_series.csv"},
        "months": months,
        "missing": [{"month": m, "reason": why} for m, why in MISSING.items()],
        "feb_mar": pair,
        "h2": h2_months(),
    }


def main() -> int:
    data = build()
    OUT_JSON.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    for r in data["months"]:
        print(f"{r['month']}: net sales {r['net_sales']:>14,.2f} | net profit {r['net_profit']:>12,.2f}"
              f"{' | ' + '؛ '.join(r['flags']) if r['flags'] else ''}")
    for r in data["missing"]:
        print(f"{r['month']}: يحتاج بيانات — {r['reason']}")
    print(f"→ {OUT_JSON.relative_to(REPO_ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
