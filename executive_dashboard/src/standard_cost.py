"""Standard cost per finished pack, from «سعر انتاج تام» (the management's standard costs).

Source (copied unchanged): ``data/raw/cost/standard_cost.xlsx``, sheet «ورقة1»: blocks per
brand (الهنا / اسباشيل / ابو هاشم), each row a pack with mixture cost, packaging cost and
total. The management confirmed (2026-10-20) these unit costs are the standard costs.

Rules:
  * a row is read only if total = mixture + packaging (±0.01);
  * the product type comes from the row's own name, else from the row above it in the
    same block (the Abu Hashem blocks name the product once, then only the weight). A
    block that never names its product is reported in ``unresolved``, not guessed;
  * a row is linked to a sales item code only through the signature (type / brand /
    size) of ``src/ops_ingest.py`` and only when exactly one sales item has it — or
    through an explicit management confirmation in ``CONFIRMED`` (2026-10-20);
  * the file's mixture, packaging and total are never changed. The unit standard used
    (``std``) is the file total. Every kilo of sausage of any brand carries 0.0666666667
    casing (هانك, management 26/10/2026); each brand's recipe sheet in the same workbook adds
    the casing cost per kilo to the paste price (``CASING_CELLS``, found by label, not by
    position), so the sausage figures in «ورقة1» already include it. The build reads that
    cost, and checks for الهنا that every sausage mix is exactly paste × weight + casing.
    Both tables are keyed by the file row AND its name as read, so a changed workbook
    stops the build instead of linking the wrong row.

    python3 -m src.standard_cost        # from executive_dashboard/
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

from .ops_ingest import BRANDS, TYPES, clean_text, link, load_items, norm_name, signature

APP_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = APP_DIR.parent
SRC = REPO_ROOT / "data" / "raw" / "cost" / "standard_cost.xlsx"
OUT_JSON = REPO_ROOT / "data" / "processed" / "standard_cost.json"
SHEET = "ورقة1"
BRAND_ROWS = {"الهنا": "الهنا", "اسباشيل": "اسباشيل", "ابو هاشم": "ابو هاشم"}

DECIDED = "تأكيد الإدارة 20/10/2026"
# file row -> (name as read, product, sales item code): packs the file names differently
# from sales (300/700 = 350/800), or names only the product or only the weight.
CONFIRMED = {
    5: ("سجق الهنا 300", "سجق", "108"),
    6: ("سجق الهنا 700", "سجق", "99"),
    47: ("سجق", "سجق", "7"),
    55: ("350جرام", "كفته", "8"),
    56: ("800جرام", "كفته", "114"),
}
# Casing (هانك), management 26/10/2026: 0.0666666667 per kilo of sausage, any brand.
DECIDED_FILE = "تأكيد الإدارة 26/10/2026"
HANK_PER_KG = 0.0666666667
# brand -> (recipe sheet, casing label, the block header it sits under or None): the cell to
# the right of the label is the casing cost per kilo of sausage that the sheet adds to the paste.
CASING_CELLS = {"الهنا": ("الهنا", "هانك", None),
                "ابو هاشم": ("الهاشم", "هنكات للكيلو", "تكلفه سجق ابوهاشم"),
                "اسباشيل": ("اسبشيال 2026", "هانك", None)}
HANK_PASTE = (8, "عجينة سجق 5 ك")      # الهنا 5 ك paste: the same mix as row 7 without casing
HANK_REF = (7, "سجق الهنا 5 ك")         # casing price = (row 7 mix − paste mix) / row 7 casing
KG_CONFIRMED = {47: 0.35}               # «سجق» names no weight; confirmed = سجق 350 جم ابو هاشم


def _cells(row) -> list:
    return [v for v in row if v not in (None, "") and not (isinstance(v, str) and not v.strip())]


def parse(path: Path = SRC) -> tuple[list, list]:
    import openpyxl  # local import: keeps the module importable without it (as in statements.py)

    ws = openpyxl.load_workbook(path, data_only=True, read_only=True)[SHEET]
    rows, unresolved = [], []
    brand, ptype = None, None
    for i, row in enumerate(ws.iter_rows(values_only=True), start=1):
        c = _cells(row)
        if not c:
            continue
        txt = [clean_text(v) for v in c if isinstance(v, str)]
        nums = [float(v) for v in c if isinstance(v, (int, float))]
        if len(c) == 1 and txt and txt[0] in BRAND_ROWS:
            brand, ptype = BRAND_ROWS[txt[0]], None
            continue
        if any(t.startswith("الاجمال") for t in txt):          # a block header: the product is named again below it
            ptype = None
            continue
        if len(nums) == 4 and not txt:                          # the weight cell is a bare number (1.5 → kilos)
            name, (size, mix, pack, total) = None, nums
            name = f"{size:g} ك"
        elif len(txt) == 1 and len(nums) == 3:
            name, (mix, pack, total) = txt[0], nums
        else:
            continue
        assert abs(mix + pack - total) <= 0.01, f"row {i}: {mix} + {pack} ≠ {total}"
        nn = norm_name(name)
        own = next((p for p in TYPES if p in nn), None)
        if own:
            ptype = own
        typ = own or ptype
        rec = {"row": i, "brand": brand, "name": name, "mix": round(mix, 4), "pack": round(pack, 4), "total": round(total, 4)}
        if i in CONFIRMED:
            cname, cprod, _code = CONFIRMED[i]
            assert name == cname, f"row {i}: «{name}» is not the confirmed «{cname}»"
            rec["product"] = cprod
            brand_word = "" if any(w in nn for w, _ in BRANDS) else brand
            rec["key"] = clean_text(f"{name if cprod in nn else cprod + ' ' + name} {brand_word}")
            rows.append(rec)
            continue
        if not typ:
            rec["reason"] = "الكتلة لا تسمّي المنتج (الوزن فقط)"
            unresolved.append(rec)
            continue
        if not re.search(r"\d", nn):
            rec["reason"] = "الصف يسمّي المنتج دون وزن العبوة"
            unresolved.append(rec)
            continue
        brand_word = "" if any(w in nn for w, _ in BRANDS) else brand
        rec["product"] = typ
        rec["key"] = clean_text(f"{name if own else typ + ' ' + name} {brand_word}")
        rows.append(rec)
    return rows, unresolved


def _kg(r: dict):
    if r["row"] in KG_CONFIRMED:
        return KG_CONFIRMED[r["row"]]
    sig = signature(r["key"])
    return sig[2] / 1000 if sig and isinstance(sig[2], (int, float)) else None


def _num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def read_casing(path: Path = SRC) -> dict:
    """brand -> (casing cost per kilo of sausage, "sheet!cell"), from each brand's recipe sheet."""
    import openpyxl  # local import: keeps the module importable without it (as in statements.py)

    wb = openpyxl.load_workbook(path, data_only=True)
    out = {}
    for brand, (sheet, label, header) in CASING_CELLS.items():
        ws = wb[sheet]
        cells = [c for row in ws.iter_rows() for c in row if isinstance(c.value, str)]
        col = None
        if header:
            hs = [c for c in cells if clean_text(c.value) == header]
            assert len(hs) == 1, f"{sheet}: header «{header}» found {len(hs)} times"
            col = hs[0].column
        hits = [c for c in cells if clean_text(c.value) == label and (col is None or c.column == col)]
        assert len(hits) == 1, f"{sheet}: casing label «{label}» found {len(hits)} times"
        lab = hits[0]
        val = next(((ws.cell(lab.row, c).coordinate, _num(ws.cell(lab.row, c).value))
                    for c in range(lab.column + 1, lab.column + 4) if _num(ws.cell(lab.row, c).value) is not None), None)
        assert val and val[1] > 0, f"{sheet}: no casing cost next to «{label}»"
        out[brand] = (val[1], f"{sheet}!{val[0]}")
    return out


def apply_hank(rows: list, casing: dict) -> float:
    """Casing on every sausage row (not the paste rows), at the cost per kilo its brand's recipe
    sheet adds. For الهنا the summary itself proves it: (sausage 5 ك − paste 5 ك) ÷ 5 must equal
    that sheet's casing cost, and every الهنا sausage mix = paste-per-kg × weight + casing."""
    by = {r["row"]: r for r in rows}
    paste, ref = by.get(HANK_PASTE[0]), by.get(HANK_REF[0])
    assert paste and paste["name"] == HANK_PASTE[1], f"row {HANK_PASTE[0]} is not «{HANK_PASTE[1]}»"
    assert ref and ref["name"] == HANK_REF[1], f"row {HANK_REF[0]} is not «{HANK_REF[1]}»"
    per_kg = paste["mix"] / _kg(paste)
    assert abs((ref["mix"] - paste["mix"]) / _kg(ref) - casing["الهنا"][0]) <= 0.01, "الهنا casing ≠ its recipe sheet"
    sausages = [r for r in rows if (signature(r["key"]) or ("",))[0] == "سجق"
                or r["row"] in CONFIRMED and CONFIRMED[r["row"]][1] == "سجق"]  # paste is «عجينه-سجق», not sausage
    assert {r["brand"] for r in sausages} == set(casing), "a sausage brand has no casing in its recipe sheet"
    for r in sausages:
        kg = _kg(r)
        assert kg, f"row {r['row']}: sausage without a weight"
        kg_cost, cell = casing[r["brand"]]
        price = kg_cost / HANK_PER_KG                       # per casing: 300 (الهنا, أبو هاشم), 250 (اسباشيل)
        qty, cost = HANK_PER_KG * kg, kg_cost * kg
        if r["brand"] == "الهنا":
            assert abs(per_kg * kg + cost - r["mix"]) <= 0.01, f"row {r['row']}: mix ≠ paste + casing"
        r.update(hank_per_kg=HANK_PER_KG, hank_qty=round(qty, 6), hank_price=round(price, 4), hank_cost=round(cost, 4),
                 hank_source=cell, cons_ok=True,
                 std_basis=f"الملف — يشمل الهانك {qty:.4g} × {price:,.2f} = {cost:,.2f} ({cell})")
    return {b: round(v[0] / HANK_PER_KG, 2) for b, v in casing.items()}


def build() -> dict:
    rows, unresolved = parse()
    items = load_items()
    names = {it["code"]: it["name"] for it in items}
    for r in rows:
        c = CONFIRMED.get(r["row"])
        if c:
            assert c[2] in names, f"row {r['row']}: confirmed code {c[2]} is not a sales item"
            r.update({"item_code": c[2], "item_name_sales": names[c[2]], "match": "عالية",
                      "match_basis": f"{DECIDED} — «{r['name']}» = «{names[c[2]]}»"})
        else:
            r.update(link(r["key"], items))
        r["std"], r["std_basis"] = r["total"], "الملف"
        sig = signature(r["key"])
        r["signature"] = None if not sig else f"{sig[0]}/{sig[1] or '—'}/{sig[2]}"
    linked = {r["item_code"] for r in rows if r.get("item_code")}
    dup = [c for c in linked if sum(r.get("item_code") == c for r in rows) > 1]
    assert not dup, f"two standard costs for one sales item: {dup}"
    assert not set(CONFIRMED) - {r["row"] for r in rows}, "a confirmed row was not read"
    hank_price = apply_hank(rows, read_casing())
    return {"meta": {"source": str(SRC.relative_to(REPO_ROOT)), "sheet": SHEET,
                     "basis": "تكلفة معيارية للعبوة = الخلطة + التغليف (تأكيد الإدارة 20/10/2026)",
                     "decisions": DECIDED + ": سجق الهنا 300/700 = 350/800؛ صفوف أبو هاشم «سجق» = سجق 350، "
                                  "«350جرام»/«800جرام» = كفته 350/800. "
                                  + DECIDED_FILE + f": كل كيلو سجق من أي علامة عليه {HANK_PER_KG:.4g} هانك، "
                                  "وأوراق الوصفات في الملف نفسه تضيف تكلفته إلى سعر العجينة، فمعيار السجق في «ورقة1» يشمله "
                                  "(سعر الهانك: " + "، ".join(f"{b} {p:,.2f}" for b, p in hank_price.items()) + ")"},
            "rows": rows, "unresolved": unresolved,
            "unmatched": [r for r in rows if not r.get("item_code")]}


def main() -> int:
    payload = build()
    OUT_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    for r in payload["rows"]:
        print(f"{r['brand']:>9} | {r['key']:<22} | {r['std']:>9.2f} | {r.get('item_code') or '—':>5} | {r['match_basis']}")
    for r in payload["unresolved"]:
        print(f"unresolved row {r['row']}: {r['brand']} «{r['name']}» {r['total']:.2f} — {r['reason']}")
    print(f"wrote {OUT_JSON.relative_to(REPO_ROOT)} — {sum(1 for r in payload['rows'] if r.get('item_code'))} linked, "
          f"{len(payload['unmatched'])} unmatched, {len(payload['unresolved'])} unresolved")
    return 0


if __name__ == "__main__":
    sys.exit(main())
