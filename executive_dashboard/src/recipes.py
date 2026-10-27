"""Panée, strips and soya recipes (28/8/2026), for «وصفات البانيه والاستربس».

Sources, copied unchanged into ``data/raw/recipes/`` (uploaded to the repository root):
  * «خلطة بانيه 28-8-2026.pdf»   → panee_2026-08-28.pdf
  * «خلطه استربس 28-8-2026.pdf»  → strips_2026-08-28.pdf
  * «خلطة الصويا.xlsx»            → soya.xlsx

Each sheet prints one batch: ingredient lines (quantity × price = total), the batch total,
the cost of a kilo, what is added to the kilo (engineer, Othman, packaging) and the cost of
each pack (the kilo cost × the pack weight, + packaging, + the salesmen's commission).
The PDFs' text comes out of pdftotext partly garbled, so the figures are transcribed in
``RECIPES`` below and the build stops unless, for every recipe:
  * every transcribed number appears verbatim in the source (pdftotext text / the xlsx cells);
  * each line's quantity × price equals its printed total, and the lines add up to the batch;
  * the kilo cost + its additions equals the printed loaded kilo cost;
  * each pack = loaded kilo × weight (+ packaging + commission) as printed.

Nothing is estimated:
  * the batch output the kilo cost was divided by is not printed — it is derived
    (batch total ÷ kilo cost) and labelled so;
  * the commission is kept apart from the material + packaging cost;
  * the sheets do not name the sales item. Items of the latest sales snapshot with the same
    product word and weight are listed as candidates, each «يحتاج تأكيد الربط» — the brand
    and pack (طبق / كيس / اسباشيل) are not on the sheet, so no link is asserted;
  * products and weights with no sheet (عجينة بقري, بانيه 700 جرام, …) are «يحتاج بيانات».

    python3 -m src.recipes        # from executive_dashboard/
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

APP_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = APP_DIR.parent
RAW = REPO_ROOT / "data" / "raw" / "recipes"
OUT_JSON = REPO_ROOT / "data" / "processed" / "recipes.json"
FULL_HTML = APP_DIR / "mobile" / "Abu_Hashem_Mobile_full.html"
SNAPSHOT = "snap-dash-2026-09-04.json"
TOL = 0.01
BIDI = re.compile("[‎‏‪-‮⁦-⁩]")
BASIS = "مطبوع في ورقة الوصفة — المجاميع متحقَّقة"
LINK = "يحتاج تأكيد الربط"

# As printed. qty/price are None where the sheet prints only a total.
RECIPES = [
    {"key": "panee", "name": "خلطة بانيه", "family": "بانيه", "date": "2026-08-28",
     "file": "panee_2026-08-28.pdf", "uploaded_as": "خلطة بانيه 28-8-2026.pdf",
     "lines": [("ام اكس", 12, 1025, 12300), ("جلد فراخ", 30, 28, 840), ("نشا", 200, 27, 5400),
               ("صميد", 150, 16.25, 2437.5), ("صويا", 90, 38, 3420), ("دقيق", 100, 17.5, 1750),
               ("بقسماط اصفر", 420, 38.5, 16170), ("تيتانيوم ابيض", 2, 260, 520), ("بصل", 0, 14.5, 0),
               ("توابل", 63.9, None, 10012), ("تشغيل وجراد", None, None, 76284)],
     "total": 129133.5, "per_kg": 49.36862,
     "kg_add": [("مصاريف تشغيل", 0), ("عثمان", 0.5), ("أجور المهندس", 2)], "per_kg_loaded": 51.86862,
     "packs": [{"grams": 800, "base": 41.4949, "packaging": 6.25, "commission": 1.375, "total": 49.1199},
               {"grams": 900, "base": 46.68176, "packaging": 6.25, "commission": 1.5, "total": 54.43176}]},
    {"key": "strips", "name": "خلطة استربس", "family": "استربس", "date": "2026-08-28",
     "file": "strips_2026-08-28.pdf", "uploaded_as": "خلطه استربس 28-8-2026.pdf",
     "lines": [("فيليه", 500, 195, 97500), ("دقيق", 550, 17.5, 9625), ("نشا", 75, 27, 2025),
               ("توابل", None, None, 9116), ("تشغيل", None, None, 16800), ("جزارة", None, None, 1470),
               ("زيت", None, None, 12066)],
     "total": 148602, "per_kg": 133.8757,
     "kg_add": [("مهندس وعثمان", 2.5), ("تغليف 5 ك", 0.75)], "per_kg_loaded": 137.1257,
     "packs": [{"grams": 900, "base": 123.4131, "packaging": 3.2, "commission": 4.125, "total": 130.7381}]},
    {"key": "soya", "name": "خلطة الصويا", "family": "صويا", "date": None,
     "file": "soya.xlsx", "uploaded_as": "خلطة الصويا.xlsx",
     "lines": [("صويا", 16, 37, 592), ("امامى", 80, 262, 20960), ("دهن", 10, 70, 700), ("شيف", 0, 0, 0),
               ("مياه", 32, 0, 0)],
     "total": 22252, "batch_kg": 138, "per_kg": 161.2463768115942,
     "kg_add": [], "per_kg_loaded": 161.2463768115942,
     # «الطبق» is printed as a value only; its grams are not printed.
     "packs": [{"grams": 400, "label": "مفروم صويا بروتين اقتصادى ٤٠٠ جرام", "base": 59.66115942028985,
                "packaging": 5.67, "commission": 0.0, "total": 65.33115942028985, "base_printed_as": "الطبق"}]},
]
# Weights the sales items are sold in that no sheet prices — listed, never derived.
NO_SHEET = {"عجينة بقري": "لا ورقة وصفة لعجينة البقري في الملفات المرفوعة"}


def clean(s: str) -> str:
    return BIDI.sub("", unicodedata.normalize("NFKC", s))


def source_numbers(r: dict) -> set[float]:
    path = RAW / r["file"]
    if path.suffix == ".pdf":
        t = clean(subprocess.run(["pdftotext", "-layout", str(path), "-"], capture_output=True, text=True,
                                 check=True).stdout)
        return {float(x.replace(",", "")) for x in re.findall(r"\d[\d,]*(?:\.\d+)?", t)}
    import openpyxl
    ws = openpyxl.load_workbook(path, data_only=True).active
    return {float(c) for row in ws.iter_rows(values_only=True) for c in row if isinstance(c, (int, float))}


def check(r: dict, nums: set[float]) -> list[str]:
    errs, k = [], r["key"]

    def seen(x):
        if x and not any(abs(x - n) < 1e-9 for n in nums):
            errs.append(f"{k}: {x} not in {r['file']}")

    for name, q, p, t in r["lines"]:
        for x in (q, p, t):
            seen(x)
        if q is not None and p is not None and abs(q * p - t) > TOL:
            errs.append(f"{k}: {name} {q} × {p} ≠ {t}")
    for x in (r["total"], r["per_kg"], r["per_kg_loaded"], *[v for _, v in r["kg_add"]]):
        seen(x)
    if abs(sum(t for *_, t in r["lines"]) - r["total"]) > TOL:
        errs.append(f"{k}: lines do not add up to {r['total']}")
    if "batch_kg" in r:
        seen(r["batch_kg"])
        if abs(sum(q or 0 for _, q, _, _ in r["lines"]) - r["batch_kg"]) > TOL:
            errs.append(f"{k}: quantities do not add up to {r['batch_kg']} kg")
        if abs(r["total"] / r["batch_kg"] - r["per_kg"]) > 1e-6:
            errs.append(f"{k}: {r['total']} ÷ {r['batch_kg']} ≠ {r['per_kg']}")
    if abs(r["per_kg"] + sum(v for _, v in r["kg_add"]) - r["per_kg_loaded"]) > 1e-4:
        errs.append(f"{k}: kilo cost + additions ≠ {r['per_kg_loaded']}")
    for p in r["packs"]:
        for x in (p["base"], p["packaging"], p["commission"], p["total"]):
            seen(x)
        if "base_printed_as" not in p and abs(r["per_kg_loaded"] * p["grams"] / 1000 - p["base"]) > 1e-3:
            errs.append(f"{k}: {p['grams']} g base ≠ kilo × {p['grams'] / 1000}")
        if abs(p["base"] + p["packaging"] + p["commission"] - p["total"]) > 1e-3:
            errs.append(f"{k}: {p['grams']} g total ≠ base + packaging + commission")
    return errs


def grams(name: str) -> int | None:
    m = re.search(r"(\d{3,4})\s*(?:جرام|جم|ج\b)", name)
    if m:
        return int(m.group(1))
    if re.search(r"(?:^|\s)(?:1\s*)?كيلو", name):
        return 1000
    m = re.search(r"(\d+)\s*ك\b", name)
    return int(m.group(1)) * 1000 if m else None


def embedded(html: str) -> tuple[dict, dict]:
    m = re.search(rf'<script type="application/json" id="{re.escape(SNAPSHOT)}">(.*?)</script>', html, re.S)
    if not m:
        raise SystemExit(f"recipes: {SNAPSHOT} not embedded in {FULL_HTML.name}")
    snap = json.loads(m.group(1))
    i = html.find("window.DASH_MARGIN=")
    margin = {}
    if i >= 0:
        j = html.index("</script>", i)
        margin = json.loads(html[i + len("window.DASH_MARGIN="):j].strip().rstrip(";"))
    return snap, margin


def sales_items(snap: dict, families: list[str]) -> dict[str, dict]:
    """Items of the snapshot whose name holds a recipe's product word (or a no-sheet product)."""
    out = defaultdict(lambda: {"qty": 0.0, "bonus_qty": 0.0, "revenue": 0.0, "paid_qty": 0.0})
    for ln in snap["lines"]:
        name = ln["item_name"]
        fam = next((f for f in families if f in name), None)
        if not fam:
            continue
        r = out[ln["item_code"]]
        r.update(code=ln["item_code"], name=name, family=fam, grams=grams(name), brand=ln.get("brand"))
        q = float(ln.get("qty") or 0)
        r["qty"] += q
        if ln.get("is_bonus"):
            r["bonus_qty"] += q
        else:
            r["paid_qty"] += q
            r["revenue"] += float(ln.get("line_total") or 0)
    for r in out.values():
        r["avg_price"] = round(r["revenue"] / r["paid_qty"], 4) if r["paid_qty"] else None
        for k in ("qty", "bonus_qty", "paid_qty", "revenue"):
            r[k] = round(r[k], 2)
    return dict(out)


def model_cost(margin: dict) -> dict[str, dict]:
    """Unit cost the costing model gives each item (June 2026), from DASH_MARGIN — read only."""
    out = {}
    for r in margin.get("by_item", []):
        if r.get("qty") and r.get("revenue_costed") is not None:
            out[r["item_code"]] = {
                "gross": round((r["revenue_costed"] - r["gross_profit"]) / r["qty"], 4),
                "op": round((r["revenue_costed"] - r["op_profit"]) / r["qty"], 4),
                "month": margin.get("meta", {}).get("cost_month")}
    return out


def build() -> dict:
    errs, recipes = [], []
    for r in RECIPES:
        path = RAW / r["file"]
        errs += check(r, source_numbers(r))
        out_kg = r.get("batch_kg") or round(r["total"] / r["per_kg"], 2)
        recipes.append({
            "key": r["key"], "name": r["name"], "family": r["family"], "date": r["date"],
            "lines": [{"name": n, "qty": q, "price": p, "total": t, "share": round(t / r["total"], 4)}
                      for n, q, p, t in r["lines"]],
            "total": r["total"], "per_kg": round(r["per_kg"], 5),
            "output_kg": out_kg, "output_kg_basis": "مطبوع" if "batch_kg" in r else "محسوب: الإجمالي ÷ سعر الكيلو — غير مطبوع",
            "kg_add": [{"name": n, "value": v} for n, v in r["kg_add"]], "per_kg_loaded": round(r["per_kg_loaded"], 5),
            "packs": [{**p, "base": round(p["base"], 5), "total": round(p["total"], 5),
                       "cost_ex_commission": round(p["base"] + p["packaging"], 5)} for p in r["packs"]],
            "basis": BASIS, "source": f"data/raw/recipes/{r['file']}", "uploaded_as": r["uploaded_as"],
            "sha256": hashlib.sha256(path.read_bytes()).hexdigest()})
    if errs:
        raise SystemExit("recipes: the transcribed figures do not hold:\n  " + "\n  ".join(errs))

    snap, margin = embedded(FULL_HTML.read_text(encoding="utf-8"))
    items = sales_items(snap, [r["family"] for r in RECIPES] + list(NO_SHEET))
    mc = model_cost(margin)
    for it in items.values():
        it["model_cost"] = mc.get(it["code"])
    priced = {(r["family"], p["grams"]) for r in RECIPES for p in r["packs"]}
    candidates = []
    for r in recipes:
        for p in r["packs"]:
            its = sorted((it for it in items.values() if it["family"] == r["family"] and it["grams"] == p["grams"]),
                         key=lambda x: -x["qty"])
            candidates.append({"recipe": r["key"], "grams": p["grams"], "pack_total": p["total"],
                               "cost_ex_commission": p["cost_ex_commission"], "status": LINK,
                               "items": [{**it, "status": LINK} for it in its]})
    no_sheet = []
    for it in sorted(items.values(), key=lambda x: (x["family"], x["grams"] or 0)):
        if (it["family"], it["grams"]) in priced:
            continue
        why = NO_SHEET.get(it["family"]) or f"لا ورقة وصفة لوزن {it['grams'] or '—'} جرام"
        no_sheet.append({**it, "reason": why, "status": "يحتاج بيانات"})
    return {
        "meta": {"basis": BASIS, "as_of": "2026-08-28", "snapshot": SNAPSHOT, "snapshot_as_of": snap.get("as_of"),
                 "link_rule": "الصنف المرشح: اسمه يحوي كلمة المنتج ووزن العبوة نفسه — الماركة ونوع العبوة غير مطبوعين في ورقة الوصفة",
                 "model_cost_note": "تكلفة الوحدة في نموذج التكاليف (يونيو 2026) من DASH_MARGIN كما هي — تاريخ مختلف عن الوصفة"},
        "recipes": recipes, "candidates": candidates, "no_sheet": no_sheet}


def main() -> int:
    data = build()
    OUT_JSON.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    for r in data["recipes"]:
        packs = " | ".join(f"{p['grams']} g {p['total']:.2f}" for p in r["packs"])
        print(f"{r['name']}: batch {r['total']:,.2f} · kilo {r['per_kg_loaded']:.4f} · {packs}")
    for c in data["candidates"]:
        print(f"  {c['recipe']} {c['grams']} g → candidates: {', '.join(i['code'] for i in c['items']) or '—'}")
    print(f"  no sheet: {', '.join(i['code'] for i in data['no_sheet'])}")
    print(f"→ {OUT_JSON.relative_to(REPO_ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
