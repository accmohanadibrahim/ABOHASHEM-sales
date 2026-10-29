"""
Recipe quantities (data/raw/cost/recipes_bom.json, tools/export_bom.py) — «الإنتاج والتشغيل».

The committed JSON is the management BOM's quantities only: nine recipes, each one's totals the sum
of its lines, its yield the divisor of its printed kilo, the same nine products the valuation file
prices each month, and no price anywhere. Where the Abohashem checkout sits next to this repository
the workbook is exported again and must give the committed file (its sha256 included).
"""
import hashlib
import json
import sys
from pathlib import Path

import pytest

APP_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(APP_DIR / "tools"))

import export_bom  # noqa: E402

OPS_JSON = APP_DIR.parent / "data" / "processed" / "ops_data.json"
WORKBOOK = APP_DIR.parent.parent / "Abohashem" / "monthly" / "reference" / "recipes.xlsx"


@pytest.fixture(scope="module")
def bom():
    return json.loads(export_bom.OUT.read_text(encoding="utf-8"))


def test_quantities_only(bom):
    assert len(bom["recipes"]) == 9 and len(bom["sha256"]) == 64
    words = json.dumps(bom, ensure_ascii=False)
    for k in ('"price"', '"total"', '"value"', '"cost"'):
        assert k not in words, k
    for r in bom["recipes"]:
        assert r["main_total"] == pytest.approx(sum(x["qty"] for x in r["main"]))
        assert r["sub_total"] == pytest.approx(sum(x["qty"] for x in r["sub"]))
        assert r["yield_kg"] > 0 and r["packs"] and all(p["kg"] > 0 for p in r["packs"])
    # «توابيل» in the main recipe is the sub-mix; the file uses all of it but in «سجق ابوهاشم»
    # (3.12 of 3.27 kg) — shown in «الإنتاج والتشغيل» for management to confirm, not corrected.
    off = [r["name"] for r in bom["recipes"] if r["sub"]
           and abs(sum(x["qty"] for x in r["main"] if x["ing"] == "توابيل") - r["sub_total"]) > 0.001]
    assert off == ["سجق ابوهاشم"]


def test_same_products_as_the_valuation_file(bom):
    ops = json.loads(OPS_JSON.read_text(encoding="utf-8"))
    assert [r["name"] for r in bom["recipes"]] == [r["product"] for r in ops["inventory"]["recipes"]]


def test_reexport_gives_the_committed_file(bom):
    if not WORKBOOK.exists():
        pytest.skip("Abohashem checkout not next to this repository")
    pytest.importorskip("openpyxl")
    assert hashlib.sha256(WORKBOOK.read_bytes()).hexdigest() == bom["sha256"]
    assert export_bom.read(WORKBOOK) == bom["recipes"]
