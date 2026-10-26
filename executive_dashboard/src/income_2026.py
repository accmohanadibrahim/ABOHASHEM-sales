"""2026 income statements, from the statement PDFs as issued, for «قائمة الدخل الشهرية».

Sources (copied unchanged into ``data/raw/income/``):
  * ``income_statement_2026-Q1.pdf``  — one statement for January–March 2026
  * ``income_statement_2026-04.pdf``  — April
  * ``income_statement_2026-05/06/07.pdf`` — detailed monthly statements
plus any later ``data/monthly/YYYY-MM/income_statement.pdf`` (the monthly intake folder).

Every statement is read line by line from ``pdftotext -layout``: net sales, cost of
sales, gross profit, each expense section with its items, and the printed net
profit. The build stops unless, for every statement:
  * gross profit = net sales − cost of sales,
  * the items of each section add up to its printed total — except items the statement
    lists but leaves out of its printed total, which must be exactly the ones the embedded
    statements already record as outside the totals (``expenses.rows_outside_totals``);
    they are kept with ``in_total: false`` and never counted,
  * gross profit − the sections = the printed net profit, and
  * net sales, cost of sales and total expenses equal the monthly statements already
    embedded in the dashboard (``DASH_MARGIN.statements.by_month``; the quarter is
    checked against the sum of its three months) — two independent extractions.

The PDF text of the Arabic labels comes out partly garbled («مرصوفات», «محاىم»); each
label is mapped to its readable form by the explicit list ``ALIASES`` and the raw text
is kept in ``label_raw``. Nothing is allocated here: the quarter stays one statement.

    python3 -m src.income_2026        # from executive_dashboard/
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from datetime import date
from pathlib import Path

from .ops_ingest import clean_text

APP_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = APP_DIR.parent
RAW = REPO_ROOT / "data" / "raw" / "income"
MONTHLY = REPO_ROOT / "data" / "monthly"
OUT_JSON = REPO_ROOT / "data" / "processed" / "income_2026.json"
ORIG_HTML = APP_DIR / "mobile" / "Abu_Hashem_Mobile_standalone.html"
TOL = 1.0

SECTIONS = [("تشغيلية", "operating"), ("إدارية", "admin"), ("بيعية", "selling"), ("تمويلية", "financing")]

# Readable label for the PDF's text of each expense line. Applied in order; first match wins.
ALIASES = [
    (r"^تصنيع لدى ر$", "تصنيع لدى الغير"),
    (r"^منظفات ومكافحة\.?$", "منظفات ومكافحة"),
    (r"^بدالت ومكاف(ئات|اة)$", "بدلات ومكافآت"),
    (r"^محاىم$", "محامى"),
    (r"^صيانات وق(طه|طع) غيار$", "صيانات وقطع غيار"),
    (r"^تامينات ?و ?حكوىم$", "تامينات وحكومى"),
    (r"^و?هدايا ورش(ا|واى)$", "هدايا ورشاوى"),
    (r"^فواتي كهرباء ونت$", "فواتير كهرباء ونت"),
    (r"^فواتي(ر)? (ال)?كهرباء$", "فواتير الكهرباء"),
    (r"^مصاريف المكاتب$", "مصاريف المكتب"),
    (r"^عمولة البيع \+ ?بدالت$", "عمولة البيع + بدلات"),
    (r"^الفاسي 1842( عربية)?$", "عربية الفاستر 1842"),
    (r"^زيت \+ ?فالتر للعربيات$", "زيت + فلاتر للعربيات"),
    (r"^مواصالت السوان$", "مواصلات أسوان"),
    (r"^كباس رتييد 3782$", "كباس تير يد 3782"),
    (r"^فاسي فتيس$", "فتيس الفاستر"),
    (r"^مصاري[قف] قرض السيارة.*$", "مصاريف قرض السيارة"),
    (r"^مصاريف قرض المبادرة.*$", "مصاريف قرض المبادرة"),
    (r"^تامي عىل المصنع و ?العربيات$", "تأمين على المصنع والعربيات"),
    (r"^مصاريف االشهار$", "مصاريف الإشهار"),
]
# A line holding only the first half of a label whose second half (and amount) is on the next line.
PREFIXES = {"الغي البانيه": ("تصنيع لدى الغير", "تصنيع لدى الغير البانيه")}

NUM_RE = re.compile(r"^-?[\d,]+(?:\.\d+)?$")


def _num(s: str) -> float:
    return float(s.replace(",", ""))


def label_of(raw: str) -> str:
    t = clean_text(raw)
    for pat, rep in ALIASES:
        if re.match(pat, t):
            return rep
    return t


def pdf_text(path: Path) -> str:
    return subprocess.run(["pdftotext", "-layout", str(path), "-"], capture_output=True, text=True, check=True).stdout


def fields(line: str) -> tuple[list[str], list[float]]:
    """(text fields, numbers) of one layout line; percentage cells are dropped."""
    parts = [clean_text(x) for x in re.split(r"\s{3,}", line.strip())]
    text, nums = [], []
    for p in parts:
        if not p or p.endswith("%"):
            continue
        (nums.append(_num(p)) if NUM_RE.match(p) else text.append(p))
    return text, nums


def parse(text: str, source: str) -> dict:
    head: dict[str, float] = {}
    sections: dict[str, float | None] = {}
    order: list[str] = []
    items: list[dict] = []
    cur, pending, after_net = None, None, []
    for line in text.splitlines():
        t, n = fields(line)
        label = " ".join(t)
        if "net_profit" in head:                 # April prints its section totals under the net profit
            if not t and n:
                after_net.extend(n)
            continue
        if label.startswith("صافي") and "net_sales" not in head and n:
            head["net_sales"] = n[-1]
        elif label.startswith("تكلفة المبيعات") and n:
            head["cogs"] = n[-1]
        elif label.startswith("مجمل الربح") and n:
            head["gross_profit"] = n[-1]
        elif label.startswith("صاف ") and n:
            head["net_profit"] = n[-1]
        elif label.startswith("مرصوفات") or label.startswith("مصاريف تمويلية"):
            cur = next(k for w, k in SECTIONS if w in label)
            sections[cur] = n[-1] if n else None
            order.append(cur)
            pending = None
        elif cur is None:
            continue
        elif label in PREFIXES:
            pending = label
        elif t and not n:
            if len(label) > 3:                   # a label wrapped onto two lines; one-letter shards are dropped
                pending = label
        elif n and (t or pending):
            raw = label
            if pending in PREFIXES:
                short, full = PREFIXES[pending]
                name = full if label_of(label) == short else label_of(label)
                raw = pending + " | " + label
            elif pending and len(label) <= 3:
                name, raw = label_of(pending), pending + " | " + label
            else:
                name = label_of(label)
            items.append({"section": cur, "label": name, "label_raw": raw, "amount": n[-1]})
            pending = None
    missing = [k for k in ("net_sales", "cogs", "gross_profit", "net_profit") if k not in head]
    assert not missing, f"{source}: {missing} not found"
    if any(v is None for v in sections.values()):
        assert len(after_net) == len(order), f"{source}: section totals under the net profit do not match the sections"
        sections = dict(zip(order, after_net))
    return {**head, "sections": {k: sections.get(k) for _, k in SECTIONS}, "items": items, "source": source}


def check(p: dict, outside: list) -> None:
    """Stop unless the statement adds up. A section whose items exceed its printed total is
    accepted only when the excess is exactly the items the embedded statements record as
    outside the totals for this period; those items are marked in_total=False."""
    src = p["source"]
    assert abs(p["net_sales"] - p["cogs"] - p["gross_profit"]) <= TOL, f"{src}: GP ≠ sales − COGS"
    out_amounts = [r["amount"] for r in outside if r["period"] in (p["period"], *p["months"])]
    for it in p["items"]:
        it["in_total"] = True
    for k, tot in p["sections"].items():
        if tot is None:
            continue
        sec = [i for i in p["items"] if i["section"] == k]
        gap = sum(i["amount"] for i in sec) - tot
        if abs(gap) > TOL:
            marked = [i for i in sec if i["amount"] and i["amount"] in out_amounts]
            assert marked and abs(sum(i["amount"] for i in marked) - gap) <= TOL, \
                f"{src}: {k} items exceed the printed total by {gap:,.2f}, not explained by rows_outside_totals"
            for i in marked:
                i["in_total"] = False
    exp = sum(v for v in p["sections"].values() if v is not None)
    assert abs(p["gross_profit"] - exp - p["net_profit"]) <= TOL, f"{src}: GP − expenses ≠ printed net profit"


def dash_margin() -> tuple[dict, list]:
    """(monthly statements by period, rows outside the printed totals) as embedded in the dashboard."""
    html = ORIG_HTML.read_text(encoding="utf-8")
    i = html.index("window.DASH_MARGIN=") + len("window.DASH_MARGIN=")
    dm, _ = json.JSONDecoder().raw_decode(html, i)
    st = dm["statements"]
    return {r["period"]: r for r in st["by_month"]}, st["expenses"]["rows_outside_totals"]


def cross_check(p: dict, dm: dict) -> None:
    rows = [dm.get(m) for m in p["months"]]
    if not all(rows):
        return                                   # a month newer than the embedded statements: nothing to compare
    exp = sum(v for v in p["sections"].values() if v is not None)
    for key, mine in (("net_sales", p["net_sales"]), ("cogs", p["cogs"]), ("total_expenses", exp)):
        theirs = sum(r[key] for r in rows)
        assert abs(mine - theirs) <= TOL * len(rows) + 0.01, f"{p['source']}: {key} {mine:,.2f} ≠ DASH_MARGIN {theirs:,.2f}"


def sources() -> list[tuple[str, list[str], Path]]:
    """(period, months, pdf) — the issued files, then the monthly intake folder for later months."""
    out = [("2026-Q1", ["2026-01", "2026-02", "2026-03"], RAW / "income_statement_2026-Q1.pdf")]
    seen = {"2026-01", "2026-02", "2026-03"}
    for f in sorted(RAW.glob("income_statement_2026-[0-9][0-9].pdf")):
        m = f.stem[-7:]
        out.append((m, [m], f))
        seen.add(m)
    for f in sorted(MONTHLY.glob("2026-??/income_statement.pdf")):
        m = f.parent.name
        if m not in seen:
            out.append((m, [m], f))
    return out


def build() -> dict:
    dm, outside = dash_margin()
    periods = []
    for period, months, path in sources():
        p = parse(pdf_text(path), str(path.relative_to(REPO_ROOT)))
        p.update(period=period, months=months)
        check(p, outside)
        cross_check(p, dm)
        periods.append({k: p[k] for k in ("period", "months", "net_sales", "cogs", "gross_profit", "sections",
                                          "items", "net_profit", "source")})
    return {"meta": {"generated": date.today().isoformat(),
                     "note": "الربع الأول 2026 قائمة واحدة كما صدرت؛ لا إهلاك في قوائم 2026",
                     "sources": [p["source"] for p in periods]},
            "periods": periods}


def keep_generated(payload: dict, out: Path = OUT_JSON) -> dict:
    """Keep the stored date while nothing else changed, so rebuilding is byte-for-byte."""
    if out.exists():
        old = json.loads(out.read_text(encoding="utf-8"))
        same = dict(payload, meta=dict(payload["meta"], generated=old.get("meta", {}).get("generated")))
        if same == old:
            return old
    return payload


def main() -> int:
    payload = keep_generated(build())
    OUT_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    for p in payload["periods"]:
        s = p["sections"]
        print(f"{p['period']}: sales {p['net_sales']:,.2f} · GP {p['gross_profit']:,.2f} · net {p['net_profit']:,.2f} · "
              f"{len(p['items'])} items · " + " ".join(f"{k}={v:,.0f}" for k, v in s.items() if v is not None))
    print(f"wrote {OUT_JSON.relative_to(REPO_ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
