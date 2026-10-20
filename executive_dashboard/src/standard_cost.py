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
    (``std``) is the file total, except where the management set it (``STD_OVERRIDE``).
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
# file row -> (name as read, unit standard set by the management)
STD_OVERRIDE = {7: ("سجق الهنا 5 ك", 135.09)}


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
        o = STD_OVERRIDE.get(r["row"])
        if o:
            assert r["name"] == o[0], f"row {r['row']}: «{r['name']}» is not «{o[0]}»"
            r["std"], r["std_basis"] = o[1], f"{DECIDED} (الملف {r['total']:,.2f})"
        else:
            r["std"], r["std_basis"] = r["total"], "الملف"
        sig = signature(r["key"])
        r["signature"] = None if not sig else f"{sig[0]}/{sig[1] or '—'}/{sig[2]}"
    linked = {r["item_code"] for r in rows if r.get("item_code")}
    dup = [c for c in linked if sum(r.get("item_code") == c for r in rows) > 1]
    assert not dup, f"two standard costs for one sales item: {dup}"
    assert not set(CONFIRMED) - {r["row"] for r in rows}, "a confirmed row was not read"
    assert not set(STD_OVERRIDE) - {r["row"] for r in rows}, "an overridden row was not read"
    return {"meta": {"source": str(SRC.relative_to(REPO_ROOT)), "sheet": SHEET,
                     "basis": "تكلفة معيارية للعبوة = الخلطة + التغليف (تأكيد الإدارة 20/10/2026)",
                     "decisions": DECIDED + ": سجق الهنا 300/700 = 350/800؛ صفوف أبو هاشم «سجق» = سجق 350، "
                                  "«350جرام»/«800جرام» = كفته 350/800؛ معيار سجق الهنا 5 كيلو = 135.09"},
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
