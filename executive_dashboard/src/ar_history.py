"""Customer balances by representative over time, for «تاريخ المديونية».

Sources (copied unchanged into ``data/raw/ar_balances/``; uploaded to the repository root):
every «تقرير عن حسابات العملاء» the representatives' balances were printed in — 49 reports
on six dates. The date is the one printed in the report («تاريخ اليوم»), not the file name:
the files named «… 23-7-2026» are printed 25/7/2026 and the «26-6» files 24/6/2026.

Each report is read by word position (PyMuPDF), one row per customer: code, name,
representative, debit and credit. The build stops unless, for every report, the rows add up
to the printed «اجمالى مدين» and «اجمالى دائن» and the printed net.

Not every representative was printed on every date. A missing report stays missing
(«يحتاج بيانات»); a representative's total on a date is never carried forward or
interpolated, and the company total is only given for dates where all are present.

Roll-forward, per customer printed on both dates of each consecutive pair:
    opening balance + invoices − receipts − customer returns = expected closing
with the invoices, receipts and returns of the dashboard's latest sales snapshot
(``snap-dash-2026-09-04.json`` embedded in the full file: January–31 August 2026), each
dated after the opening report and up to the closing one. A customer ties when the printed
closing balance is within 1 EGP of the expected one; the others are listed with their gap,
which the data does not explain (an unrecorded settlement or discount, a receipt outside
the extract, a date difference) — the cause is not guessed. A gap that equals, within 1 EGP,
one of the period's own movements (−invoices, ±receipts, ±returns) is labelled with that
arithmetic match — e.g. «الرصيد المطبوع لا يتضمن فواتير الفترة» — still without a cause. Customers printed on only one
of the two dates are counted, not rolled.

    python3 -m src.ar_history        # from executive_dashboard/
"""
from __future__ import annotations

import hashlib
import json
import re
import subprocess
import sys
import unicodedata
from collections import defaultdict
from pathlib import Path

from . import config as C

APP_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = APP_DIR.parent
RAW = REPO_ROOT / "data" / "raw" / "ar_balances"
OUT_JSON = REPO_ROOT / "data" / "processed" / "ar_history.json"
FULL_HTML = APP_DIR / "mobile" / "Abu_Hashem_Mobile_full.html"
SNAPSHOT = "snap-dash-2026-09-04.json"
TOL = 0.05
TIE = 1.0
TOP = 15

# x-bands of the report columns (points), as in abohashem_main/analysis/parse_salespeople.py.
COLS = {"debit": (152, 208), "credit": (220, 262), "rep": (282, 348), "ctype": (360, 398),
        "name": (400, 492), "code": (502, 548), "row": (553, 572)}
BIDI = re.compile("[‎‏‪-‮⁦-⁩]")
# One spelling per representative across the reports and the file names.
# The reports print «م» for «محمد».
REPS = {"هاني": "هانى", "م امام": "محمد امام", "م امام الصعيد": "محمد امام الصعيد", "م بشرى": "محمد بشرى",
        "م خليل": "محمد خليل"}


def clean(s: str) -> str:
    return BIDI.sub("", unicodedata.normalize("NFKC", s))


def num(s) -> float | None:
    try:
        return float(str(s).replace(",", ""))
    except (TypeError, ValueError):
        return None


def printed(path: Path) -> dict:
    """The date and totals the report prints, from its text."""
    t = clean(subprocess.run(["pdftotext", "-layout", str(path), "-"], capture_output=True, text=True,
                             check=True).stdout)
    d = re.search(r"(\d{4})/(\d{1,2})/(\d{1,2})", t)
    deb = re.search(r"اجمالى مدين\s+([\d.,]+)\s+اجمالى دائن\s+([\d.,]+)", t)
    net = re.search(r"([-\d.,]+)\s+الصافى", t)
    if not (d and deb and net):
        raise SystemExit(f"ar_history: {path.name}: date or totals not found")
    return {"date": f"{d.group(1)}-{int(d.group(2)):02d}-{int(d.group(3)):02d}",
            "debit": num(deb.group(1)), "credit": num(deb.group(2)), "net": num(net.group(1))}


def rows_of(path: Path) -> list[dict]:
    import fitz
    out = []
    for page in fitz.open(path):
        words = page.get_text("words")
        hdr = [w[3] for w in words if w[4] in ("المندوب", "كود") and w[1] < 170]
        top = max(hdr) if hdr else 18
        foot = [w[1] for w in words if w[4] == "اجمالى"]
        bottom = min(foot) if foot else 1e9
        data = [w for w in words if top + 1 < w[1] < bottom - 1]
        anchors = sorted((w[1] + w[3]) / 2 for w in data if COLS["row"][0] <= (w[0] + w[2]) / 2 <= COLS["row"][1])
        if not anchors:
            continue
        cells = defaultdict(lambda: defaultdict(list))
        for w in data:
            a = min(anchors, key=lambda an: abs(an - (w[1] + w[3]) / 2))
            xc = (w[0] + w[2]) / 2
            for c, (lo, hi) in COLS.items():
                if lo <= xc <= hi:
                    cells[a][c].append((w[0], w[4]))
        for a in anchors:
            v = {c: " ".join(p[1] for p in sorted(ws)) for c, ws in cells[a].items()}
            if not v.get("code"):
                continue
            name = clean(" ".join(reversed(v.get("name", "").split()))).strip()
            rep = clean(" ".join(reversed(v.get("rep", "").split()))).strip()   # right-to-left, as the name
            out.append({"code": C.canonical_code(v["code"]), "name": name, "rep": REPS.get(rep, rep),
                        "debit": num(v.get("debit")) or 0.0, "credit": num(v.get("credit")) or 0.0})
    return out


def file_rep(rows: list[dict], path: Path) -> str:
    reps = {r["rep"] for r in rows if r["rep"]}
    if len(reps) == 1:
        return reps.pop()
    # A report lists only its representative's customers; a mixed column means a misread.
    raise SystemExit(f"ar_history: {path.name}: representatives {sorted(reps)}")


def snapshot() -> dict:
    html = FULL_HTML.read_text(encoding="utf-8")
    m = re.search(r'<script type="application/json" id="%s">(.*?)</script>' % re.escape(SNAPSHOT), html, re.S)
    if not m:
        raise SystemExit(f"ar_history: {SNAPSHOT} not embedded in {FULL_HTML.name}")
    return json.loads(m.group(1))


# A gap equal (within TIE) to one of the period's own movements — an arithmetic match, not a cause.
PATTERNS = (("sales", -1, "الرصيد المطبوع لا يتضمن فواتير الفترة"),
            ("receipts", 1, "الرصيد المطبوع لا يخصم تحصيلات الفترة"),
            ("receipts", -1, "الفجوة تساوي تحصيلات الفترة بالسالب"),
            ("returns", 1, "الرصيد المطبوع لا يخصم مرتجعات الفترة"),
            ("returns", -1, "الفجوة تساوي مرتجعات الفترة بالسالب"))
OTHER = "لا تساوي حركة واحدة من حركات الفترة"


def pattern(r: dict) -> str:
    for k, sign, label in PATTERNS:
        if r[k] and abs(r["gap"] - sign * r[k]) <= TIE:
            return label
    return OTHER


def rollforward(customers: list[dict], dates: list[str]) -> list[dict]:
    S = snapshot()
    meta = S["meta"]
    cut = max(i["invoice_date"] for i in S["invoices"])
    moves = defaultdict(list)          # code -> [(date, kind, amount)]
    for i in S["invoices"]:
        if i["customer_code"]:
            moves[C.canonical_code(i["customer_code"])].append((i["invoice_date"], "sales", i["reported_total"] or 0.0))
    for r in S["collections"]["receipts"]:
        if r["customer_code"]:
            moves[C.canonical_code(r["customer_code"])].append((r["date"], "receipts", r["amount"]))
    for r in S["collections"]["returns_rows"]:
        if r["customer_code"]:
            moves[C.canonical_code(r["customer_code"])].append((r["date"], "returns", r["value"]))
    out = []
    for d0, d1 in zip(dates, dates[1:]):
        rows, only = [], {"opening": 0, "closing": 0}
        for c in customers:
            b0, b1 = c["by_date"].get(d0), c["by_date"].get(d1)
            if not (b0 and b1):
                if b0 or b1:
                    only["opening" if b0 else "closing"] += 1
                continue
            m = defaultdict(float)
            for d, k, a in moves.get(c["code"], ()):
                if d0 < d <= d1:
                    m[k] += a
            exp = b0["net"] + m["sales"] - m["receipts"] - m["returns"]
            rows.append({"code": c["code"], "name": c["name"], "rep": b1["rep"], "opening": b0["net"],
                         "sales": round(m["sales"], 2), "receipts": round(m["receipts"], 2),
                         "returns": round(m["returns"], 2), "closing": b1["net"], "gap": round(b1["net"] - exp, 2)})
        open_ = [r for r in rows if abs(r["gap"]) > TIE]
        for r in open_:
            r["pattern"] = pattern(r)
        pats = defaultdict(lambda: {"customers": 0, "gap": 0.0})
        for r in open_:
            pats[r["pattern"]]["customers"] += 1
            pats[r["pattern"]]["gap"] += r["gap"]
        by_rep = defaultdict(lambda: defaultdict(float))
        for r in rows:
            g = by_rep[r["rep"]]
            for k in ("opening", "sales", "receipts", "returns", "closing", "gap"):
                g[k] += r[k]
            g["customers"] += 1
            g["tied"] += abs(r["gap"]) <= TIE
        tot = {k: round(sum(r[k] for r in rows), 2) for k in ("opening", "sales", "receipts", "returns", "closing", "gap")}
        out.append({"from": d0, "to": d1, "customers": len(rows), "tied": sum(abs(r["gap"]) <= TIE for r in rows),
                    "only_on_one_date": only, "totals": tot,
                    "after_extract": d1 > cut, "extract_through": cut,
                    "by_rep": [{"rep": k, **{x: round(v, 2) for x, v in g.items()}} for k, g in sorted(by_rep.items())],
                    "patterns": [{"pattern": k, "customers": v["customers"], "gap": round(v["gap"], 2)}
                                 for k, v in sorted(pats.items(), key=lambda kv: -abs(kv[1]["gap"]))],
                    "gaps": sorted(open_, key=lambda r: -abs(r["gap"]))[:TOP]})
    return {"snapshot": SNAPSHOT, "as_of": meta.get("as_of"), "extract_through": cut, "periods": out}


def build() -> dict:
    files, errs = [], []
    for p in sorted(RAW.glob("*.pdf")):
        pr, rows = printed(p), rows_of(p)
        deb, cr = round(sum(r["debit"] for r in rows), 2), round(sum(r["credit"] for r in rows), 2)
        for k, got in (("debit", deb), ("credit", cr), ("net", round(deb - cr, 2))):
            if abs(got - pr[k]) > TOL:
                errs.append(f"{p.name}: {k} {got:,.2f} ≠ printed {pr[k]:,.2f}")
        files.append({"file": p.name, "sha256": hashlib.sha256(p.read_bytes()).hexdigest(), "date": pr["date"],
                      "rep": file_rep(rows, p), "customers": len(rows), "debit": deb, "credit": cr,
                      "net": round(deb - cr, 2), "rows": rows})
    if errs:
        raise SystemExit("ar_history: rows do not add up to the printed totals:\n  " + "\n  ".join(errs))
    dates = sorted({f["date"] for f in files})
    reps = sorted({f["rep"] for f in files})
    seen = defaultdict(list)
    for f in files:
        seen[(f["date"], f["rep"])].append(f["file"])
    dup = {k: v for k, v in seen.items() if len(v) > 1}
    if dup:
        raise SystemExit(f"ar_history: two reports for one representative and date: {dup}")
    by = {(f["date"], f["rep"]): f for f in files}
    reps_tab = [{"rep": r, "by_date": {d: ({"net": by[(d, r)]["net"], "debit": by[(d, r)]["debit"],
                                             "credit": by[(d, r)]["credit"], "customers": by[(d, r)]["customers"]}
                                            if (d, r) in by else None) for d in dates}} for r in reps]
    totals = [{"date": d, "complete": all((d, r) in by for r in reps),
               "missing": [r for r in reps if (d, r) not in by],
               "net": round(sum(by[(d, r)]["net"] for r in reps if (d, r) in by), 2)} for d in dates]
    # Customers: one balance per date, and the representative it was printed under.
    cust = {}
    for f in files:
        for r in f["rows"]:
            c = cust.setdefault(r["code"], {"code": r["code"], "name": r["name"], "by_date": {}})
            prev = c["by_date"].get(f["date"])
            bal = round(r["debit"] - r["credit"], 2)
            c["by_date"][f["date"]] = {"net": round(bal + (prev["net"] if prev else 0.0), 2), "rep": f["rep"]}
    customers = sorted(cust.values(), key=lambda c: -max((v["net"] for v in c["by_date"].values()), default=0))
    for f in files:
        del f["rows"]
    return {"meta": {"source": "data/raw/ar_balances/", "dates": dates, "reps": reps,
                     "note": "التاريخ المطبوع في كل تقرير · لا يُرحَّل رصيد مندوب غائب في تاريخ ولا يُقدَّر"},
            "files": files, "reps": reps_tab, "totals": totals, "customers": customers,
            "rollforward": rollforward(customers, dates)}


def main() -> int:
    data = build()
    OUT_JSON.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    for t in data["totals"]:
        print(f"{t['date']}: {t['net']:>14,.2f}" + ("" if t["complete"] else f"  (ناقص: {'، '.join(t['missing'])})"))
    for p in data["rollforward"]["periods"]:
        print(f"  {p['from']} → {p['to']}: {p['tied']}/{p['customers']} customers tie · gap {p['totals']['gap']:,.2f}")
    print(f"{len(data['files'])} reports · {len(data['customers'])} customers → {OUT_JSON.relative_to(REPO_ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
