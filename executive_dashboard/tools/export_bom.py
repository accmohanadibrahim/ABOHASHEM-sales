#!/usr/bin/env python3
"""Recipe quantities of the nine products (data/raw/cost/recipes_bom.json) — «الإنتاج والتشغيل».

The management BOM lives in the Abohashem repo, monthly/reference/recipes.xlsx (the June 2026
pricing file read by model/wac.py::recipes()). This copies its QUANTITIES only — no price, no
total — so the dashboard can show what goes into each product without a second, drifting cost
basis. Per product, as printed in its sheet:

  * the spice sub-mix (الخلطة الفرعية) and the main recipe (الوصفة الرئيسية), each line its
    material and quantity in kg; a 0 is kept as printed;
  * the yield basis: the divisor of «سعر الكجم (خامات مباشرة فقط)» (e.g. =E40/98.96 →
    98.96 kg), with the sheet's own note on why it differs from the summed weight;
  * the pack sizes (الصنف والوزن) of «تكلفة التعبئة حسب الوزن», weights only.

The source's sha256 is recorded, like data/raw/cost/monthly_standard/. Run again when the
workbook changes; the committed JSON is what the dashboard embeds.

    python3 tools/export_bom.py /path/to/Abohashem/monthly/reference/recipes.xlsx
"""
import hashlib
import json
import re
import sys
from pathlib import Path

APP = Path(__file__).resolve().parent.parent
OUT = APP.parent / "data" / "raw" / "cost" / "recipes_bom.json"
SHEETS = {"منتجات أبو هاشم": "أبو هاشم", "منتجات سبيشال": "سبيشال", "منتجات الهنا": "الهنا"}


def clean(s) -> str:
    return re.sub(r"\s+", " ", str(s or "")).strip()


def read(path: Path) -> list:
    import openpyxl                     # only to export; the committed JSON needs nothing
    wb = openpyxl.load_workbook(path)
    recipes = []
    for sheet, brand in SHEETS.items():
        cur, sec = None, None
        for r in wb[sheet].iter_rows(min_row=2, values_only=True):
            a, b = r[0], clean(r[1])
            if isinstance(a, str) and all(v is None for v in r[1:]):
                t = clean(a)
                if t.startswith("الخلطة الفرعية"):
                    sec, cur["sub_name"] = "sub", t.split(":", 1)[1].strip() if ":" in t else t
                elif t.startswith("الوصفة الرئيسية"):
                    sec = "main"
                elif t.startswith("تكلفة التعبئة"):
                    sec = "pack"
                else:
                    cur, sec = {"name": t, "brand": brand, "sheet": sheet, "sub_name": None, "sub": [], "main": [],
                                "yield_kg": None, "yield_note": None, "packs": []}, None
                    recipes.append(cur)
                continue
            if cur is None:
                continue
            if b == "سعر الكجم (خامات مباشرة فقط)":
                cur["yield_kg"] = round(float(str(r[3]).split("/")[1]), 4)
            elif b.startswith("أساس احتساب سعر الكجم"):
                cur["yield_note"] = b
            elif isinstance(a, (int, float)) and b and b != "الخامة" and sec in ("sub", "main"):
                cur[sec].append({"ing": b, "qty": float(r[2] or 0.0)})
            elif isinstance(a, (int, float)) and b and sec == "pack" and isinstance(r[2], (int, float)):
                cur["packs"].append({"sku": b, "kg": float(r[2])})
    for rc in recipes:
        assert rc["main"] and rc["yield_kg"], f"incomplete recipe {rc['name']}"
        rc["sub_total"] = round(sum(x["qty"] for x in rc["sub"]), 4)
        rc["main_total"] = round(sum(x["qty"] for x in rc["main"]), 4)
    return recipes


def main(argv) -> int:
    if len(argv) != 2:
        print(__doc__)
        return 2
    src = Path(argv[1])
    recipes = read(src)
    out = {"source": "Abohashem monthly/reference/recipes.xlsx (model/wac.py::recipes)",
           "sha256": hashlib.sha256(src.read_bytes()).hexdigest(),
           "basis": "الكميات كما في أوراق الوصفات (ملف تسعير يونيو 2026) — بلا أسعار",
           "recipes": recipes}
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"wrote {OUT.relative_to(APP.parent)} — {len(recipes)} recipes")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
