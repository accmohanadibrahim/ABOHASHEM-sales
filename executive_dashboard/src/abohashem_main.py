"""Run the code of Abohashem-main.zip (unzipped in ``abohashem_main/``) and collect its results.

The zip (uploaded 26/10/2026) is a snapshot of the Abohashem repository: a June 2026
sales and debt analysis (``analysis/``) and the costing and WAC models (``model/``).
Its code is file for file the Abohashem repository's main after the 26/10/2026 revert (PR #13),
without the WAC engine and monthly standard of PR #7 (``wac.py``, ``monthly_standard.py``);
it is run here as it is, never edited.

Every script runs in a temporary copy of ``abohashem_main/`` — the folder itself is never
written. Then:
  * the outputs of ``analysis/analyze.py``, ``aging.py``, ``receivables_report.py`` and
    ``due_within_month.py`` are read from that copy and must equal, row for row, the
    copies uploaded to the repository root (the same run, uploaded loose);
  * the headline totals must tie: the items and the customers add up to the invoice total,
    the aging buckets to each customer's debt, the salespeople to the total debt;
  * ``parse_invoices.py`` (PyMuPDF) re-reads the invoice PDF and must give the committed
    ``invoices.json``; ``parse_salespeople.py`` is run on the nine salesperson reports
    named in ``salespeople.json`` only — on its own folder it would read every PDF;
  * ``model/costing_pricing_model.py`` must still tie to the June income statement, and
    ``wac_august_2026.py`` / ``wac_september_2026.py`` (pdftotext, LibreOffice) must rebuild their
    committed reports.
A step whose tool is missing is recorded «لم يُشغَّل» with the reason, not estimated.

Everything is a June snapshot (invoices 2/6–27/6/2026, debt as of 24/6/2026): it is
labelled so and never replaces the newer data already in the dashboard.

    python3 -m src.abohashem_main        # from executive_dashboard/
    ABOHASHEM_MAIN=off                   # skip: writes {"enabled": false}
"""
from __future__ import annotations

import csv
import io
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

APP_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = APP_DIR.parent
SRC_DIR = REPO_ROOT / "abohashem_main"
OUT_JSON = REPO_ROOT / "data" / "processed" / "abohashem_main.json"

ENABLED = True
LABEL = "لقطة يونيو 2026 من ملف Abohashem-main.zip"
AS_OF = {"invoices_from": "2026-06-02", "invoices_to": "2026-06-27", "debt_as_of": "2026-06-24", "aging_ref": "2026-06-27"}
TOL = 0.05
TIMEOUT = 900

ANALYSIS = ["analyze.py", "aging.py", "receivables_report.py", "due_within_month.py"]
OUTPUTS = ["summary.json", "items_summary.csv", "customers_summary.csv", "salespeople_summary.csv", "zero_invoices.csv",
           "aging_by_customer.csv", "receivables_by_customer.csv", "due_within_month_by_customer.csv",
           "maturity_schedule_detail.csv", "report.md"]
TOP = 15


def enabled() -> bool:
    return ENABLED and os.environ.get("ABOHASHEM_MAIN", "").lower() != "off"


def run(cmd: list[str], cwd: Path) -> tuple[int, str]:
    env = dict(os.environ, PYTHONHASHSEED="0", PYTHONDONTWRITEBYTECODE="1")
    p = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=TIMEOUT, env=env)
    return p.returncode, (p.stdout + p.stderr).strip()


def tail(text: str, n: int = 6) -> list[str]:
    return [ln for ln in text.splitlines() if ln.strip()][-n:]


def rows(text: str) -> list[dict]:
    return list(csv.DictReader(io.StringIO(text.lstrip("﻿"))))


def num(x) -> float:
    return float(x) if x not in ("", None) else 0.0


def same_rows(a: str, b: str) -> bool:
    """Same CSV up to row order (aging.py orders equal amounts by a set's iteration order)."""
    return sorted(a.splitlines()) == sorted(b.splitlines())


def has(module: str) -> bool:
    try:
        __import__(module)
        return True
    except ImportError:
        return False


def step(name: str, status: str, detail: str = "", out: str = "") -> dict:
    return {"step": name, "status": status, "detail": detail, "log": tail(out)}


def analysis(work: Path) -> tuple[dict, list[dict], list[str]]:
    an, log, errs = work / "analysis", [], []
    for s in ANALYSIS:
        rc, out = run([sys.executable, s], an)
        log.append(step(f"analysis/{s}", "يعمل" if rc == 0 else "فشل", "" if rc == 0 else f"exit {rc}", out))
        if rc:
            errs.append(f"analysis/{s} exit {rc}")
    res = {}
    for f in OUTPUTS:
        p = an / "output" / f
        if not p.exists():
            errs.append(f"missing output {f}")
            continue
        text = p.read_text(encoding="utf-8-sig")
        root = REPO_ROOT / f
        if root.exists():
            ok = same_rows(text, root.read_text(encoding="utf-8-sig"))
            log.append(step(f"output/{f}", "يطابق النسخة في الجذر" if ok else "يختلف عن النسخة في الجذر"))
            if not ok:
                errs.append(f"{f} differs from the root copy")
        res[f] = text
    return res, log, errs


def reparse(work: Path) -> list[dict]:
    """parse_invoices / parse_salespeople need PyMuPDF; each must give the committed JSON."""
    if not has("fitz"):
        return [step("analysis/parse_invoices.py", "لم يُشغَّل", "يحتاج PyMuPDF (pip install pymupdf)"),
                step("analysis/parse_salespeople.py", "لم يُشغَّل", "يحتاج PyMuPDF (pip install pymupdf)")]
    out = []
    an = work / "analysis"
    committed = (SRC_DIR / "analysis" / "invoices.json").read_bytes()
    rc, log = run([sys.executable, "parse_invoices.py"], an)
    same = rc == 0 and (an / "invoices.json").read_bytes() == committed
    out.append(step("analysis/parse_invoices.py", "يطابق invoices.json" if same else "يختلف/فشل", f"exit {rc}", log))
    # parse_salespeople reads every *.pdf beside analysis/: give it the nine reports only.
    sp = json.loads((SRC_DIR / "analysis" / "salespeople.json").read_text(encoding="utf-8"))
    files = sorted({r["report_file"] for r in sp})
    iso = work.parent / "salespeople_only"
    (iso / "analysis").mkdir(parents=True)
    shutil.copy2(an / "parse_salespeople.py", iso / "analysis")
    for f in files:
        shutil.copy2(SRC_DIR / f, iso / f)
    rc, log = run([sys.executable, "parse_salespeople.py"], iso / "analysis")
    got = json.loads((iso / "analysis" / "salespeople.json").read_text(encoding="utf-8")) if rc == 0 else None
    same = got == sp
    out.append(step("analysis/parse_salespeople.py", "يطابق salespeople.json" if same else "يختلف/فشل",
                    f"{len(files)} تقارير مناديب — على مجلده كاملًا يقرأ كل ملفات PDF فيه، فيُشغَّل على التقارير التسعة فقط", log))
    return out


def model(work: Path) -> tuple[list[dict], dict]:
    md, out, totals = work / "model", [], {}
    rc, log = run([sys.executable, "costing_pricing_model.py"], md)
    for key, pat in (("material_cogs", r"Σ actual material\s*=\s*([\d.,]+)\s*\(COGS ([\d.,]+)\)"),
                     ("operating_profit", r"Σ operating profit\s*=\s*([\d.,]+)\s*\(IS net profit ([\d.,]+)\)")):
        m = re.search(pat, log)
        if m:
            totals[key] = {"model": num(m.group(1).replace(",", "")), "statement": num(m.group(2).replace(",", ""))}
    m = re.search(r"Invoices parsed: (\d+) \| SKUs: (\d+)", log)
    if m:
        totals["invoices"], totals["skus"] = int(m.group(1)), int(m.group(2))
    ties = bool(totals) and all(abs(v["model"] - v["statement"]) <= TOL for k, v in totals.items() if isinstance(v, dict))
    out.append(step("model/costing_pricing_model.py", "يطابق قائمة دخل يونيو" if rc == 0 and ties else "فشل/لا يطابق",
                    f"exit {rc}", log))
    if not has("openpyxl"):
        out.append(step("model/build_workbook.py", "لم يُشغَّل", "يحتاج openpyxl"))
    else:
        rc, log = run([sys.executable, "build_workbook.py"], md)
        out.append(step("model/build_workbook.py", "يعمل" if rc == 0 else "فشل", f"exit {rc}", log))
    for s, report in (("wac_august_2026.py", "WAC_AUGUST_2026_REPORT.md"), ("wac_september_2026.py", "WAC_SEPTEMBER_2026_REPORT.md")):
        if not (shutil.which("pdftotext") and shutil.which("soffice") and has("openpyxl")):
            out.append(step(f"model/{s}", "لم يُشغَّل", "يحتاج pdftotext (poppler-utils) و LibreOffice (soffice) و openpyxl"))
            continue
        rc, log = run([sys.executable, s], md)
        same = rc == 0 and (work / report).read_bytes() == (SRC_DIR / report).read_bytes()
        out.append(step(f"model/{s}", f"يعيد {report} كما هو" if same else "يعمل — التقرير يختلف" if rc == 0 else "فشل",
                        f"exit {rc}", log))
    return out, totals


def collect(res: dict, credits: list[dict]) -> tuple[dict, list[str]]:
    """The tables the dashboard shows, plus the tie-outs between them."""
    S = json.loads(res["summary.json"])
    items, cust = rows(res["items_summary.csv"]), rows(res["customers_summary.csv"])
    sp, zero = rows(res["salespeople_summary.csv"]), rows(res["zero_invoices.csv"])
    aging_all, recv = rows(res["aging_by_customer.csv"]), rows(res["receivables_by_customer.csv"])
    due = rows(res["due_within_month_by_customer.csv"])
    aging = [r for r in aging_all if r["customer_code"]]          # aging.py appends a «الإجمالى» row
    aging_printed = [r for r in aging_all if not r["customer_code"]]
    errs = []

    def tie(name, a, b):
        if abs(a - b) > TOL:
            errs.append(f"{name}: {a:,.2f} ≠ {b:,.2f}")
        return {"check": name, "a": round(a, 2), "b": round(b, 2), "ok": abs(a - b) <= TOL}

    buckets = ["days_0_30_EGP", "days_31_60_EGP", "days_61_90_EGP", "days_over_90_EGP", "opening_carryover_undated_EGP"]
    checks = [
        tie("مجموع الأصناف = إجمالي المبيعات", sum(num(r["total_sales_EGP"]) for r in items), S["total_sales_EGP"]),
        tie("مجموع العملاء = إجمالي المبيعات", sum(num(r["total_sales_EGP"]) for r in cust), S["total_sales_EGP"]),
        tie("مجموع المناديب = إجمالي المديونية", sum(num(r["outstanding_debt_EGP"]) for r in sp), S["total_outstanding_debt_EGP"]),
        tie("شرائح الأعمار = مديونية كل عميل", sum(sum(num(r[b]) for b in buckets) for r in aging),
            sum(num(r["total_debt_EGP"]) for r in aging)),
        tie("سطر «الإجمالى» في الأعمار = مجموع العملاء", num(aging_printed[0]["total_debt_EGP"]) if aging_printed else 0.0,
            sum(num(r["total_debt_EGP"]) for r in aging)),
        tie("عدد الفواتير الصفرية", len(zero), S["zero_invoices"]),
    ]
    # Not a tie: aging.py adds invoiced customers missing from the salesperson reports (their
    # unpaid invoices) and drops customers whose report balance is a credit, so its total
    # exceeds the reports' net debt by exactly those two amounts — checked below.
    a_tot, unmapped = sum(num(r["total_debt_EGP"]) for r in aging), [r for r in aging if r["customer_code"] and
                                                                    r["salesperson"].startswith("(غير مرتبط")]
    gap = {"aging_total": round(a_tot, 2), "debt_total": S["total_outstanding_debt_EGP"],
           "difference": round(a_tot - S["total_outstanding_debt_EGP"], 2),
           "unmapped_customers": len(unmapped), "unmapped_debt": round(sum(num(r["total_debt_EGP"]) for r in unmapped), 2),
           "credit_balances": round(sum(num(r["debt"]) for r in credits), 2), "credit_customers": len(credits)}
    checks.append(tie("فرق الأعمار عن المديونية = عملاء غير مرتبطين + أرصدة دائنة", gap["difference"],
                      gap["unmapped_debt"] - gap["credit_balances"]))
    aging_tot = {b: round(sum(num(r[b]) for r in aging), 2) for b in buckets}

    def pick(rs, cols, key):
        return [{c: (num(r[c]) if c.endswith(("EGP", "_pct", "months")) or c in ("invoices", "total_qty", "customers",
                     "times_sold", "period_invoices") else r[c]) for c in cols}
                for r in sorted(rs, key=lambda r: -num(r[key]))[:TOP]]

    return {
        "summary": S,
        "checks": checks,
        "salespeople": pick(sp, ["salesperson", "customers", "period_sales_EGP", "period_invoices", "monthly_sales_EGP",
                                 "outstanding_debt_EGP", "credit_exposure_months"], "outstanding_debt_EGP"),
        "aging_totals": aging_tot,
        "aging_vs_debt": gap,
        "aging_top": pick(aging, ["customer_code", "customer", "salesperson"] + buckets + ["total_debt_EGP"], "total_debt_EGP"),
        "receivables_top": pick(recv, ["customer_code", "customer", "salesperson", "due_debt_EGP", "period_sales_EGP",
                                       "credit_exposure_months"], "due_debt_EGP"),
        "due_within_month": {
            "total": round(sum(num(r["due_within_1_month_EGP"]) for r in due), 2),
            "overdue": round(sum(num(r["overdue_EGP"]) for r in due), 2),
            "later": round(sum(num(r["due_later_EGP"]) for r in due), 2),
            "top": pick(due, ["customer_code", "customer", "salesperson", "invoices", "due_within_1_month_EGP",
                              "overdue_EGP", "first_due_date", "last_due_date"], "due_within_1_month_EGP")},
        "items_top": pick(items, ["item_code", "item_name", "unit", "total_qty", "total_sales_EGP",
                                  "avg_selling_price_EGP", "min_price_EGP", "max_price_EGP"], "total_sales_EGP"),
        "customers_bonus": {
            "total": round(sum(num(r["bonus_amount_EGP"]) for r in cust), 2),
            "top": pick(cust, ["customer_code", "customer", "salesperson", "total_sales_EGP", "outstanding_debt_EGP",
                               "bonus_pct", "bonus_amount_EGP"], "total_sales_EGP")},
        "zero_invoices": {"count": len(zero), "qty": round(sum(num(r["total_qty"]) for r in zero), 2)},
    }, errs


def build() -> dict:
    if not enabled():
        return {"enabled": False, "label": LABEL}
    if not SRC_DIR.exists():
        raise SystemExit(f"{SRC_DIR} missing — unzip Abohashem-main.zip there first")
    with tempfile.TemporaryDirectory() as tmp:
        work = Path(tmp) / "abohashem_main"
        shutil.copytree(SRC_DIR, work)
        res, log, errs = analysis(work)
        log += reparse(work)  # after the analysis outputs are read: it rewrites the JSON in the copy
        mlog, totals = model(work)
        log += mlog
        for r in log:  # no temporary paths in the committed file
            r["log"] = [ln.replace(tmp, "…") for ln in r["log"] if "FutureWarning" not in ln and "warnings.warn" not in ln]
    sp = json.loads((SRC_DIR / "analysis" / "salespeople.json").read_text(encoding="utf-8"))
    credits = [{"debt": c["debit"] - c["credit"]} for c in sp if c["debit"] - c["credit"] < 0]
    data, e2 = collect(res, credits)
    errs += e2
    if errs:
        raise SystemExit("abohashem_main: " + "; ".join(errs))
    return {"enabled": True, "label": LABEL, "as_of": AS_OF, "source": "abohashem_main/ (Abohashem-main.zip)",
            **data, "model": totals, "runs": log}


def main() -> int:
    data = build()
    OUT_JSON.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    if not data["enabled"]:
        print("abohashem_main: disabled (ABOHASHEM_MAIN=off)")
        return 0
    for r in data["runs"]:
        print(f"  {r['step']:40} {r['status']}{' — ' + r['detail'] if r['detail'] else ''}")
        if r["status"].startswith("فشل") or "يختلف" in r["status"]:
            print("    " + "\n    ".join(r["log"]))
    s = data["summary"]
    print(f"sales {s['total_sales_EGP']:,.2f} · debt {s['total_outstanding_debt_EGP']:,.2f} · "
          f"{sum(c['ok'] for c in data['checks'])}/{len(data['checks'])} tie-outs → {OUT_JSON.relative_to(REPO_ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
