"""
Operations data (src/ops_ingest.py -> data/processed/ops_data.json).

Every total extracted from a source file must equal the total printed in that
file. The printed figures below are read off the source documents themselves
(the totals rows of the two valuation workbooks, the footer of each PDF), so a
parser change that drops or doubles a row fails here, not in a chart.

The JSON checks run everywhere. Re-parsing the raw files needs openpyxl,
pdftotext (poppler) and LibreOffice (the September model ships formulas without
cached values) and is skipped where they are missing (the CI image has none of
them); it must then reproduce the committed JSON exactly.
"""
import json
import shutil
import sys
from pathlib import Path

import pytest

APP_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(APP_DIR))

OPS_JSON = APP_DIR.parent / "data" / "processed" / "ops_data.json"

PRINTED = {
    "inventory_jun": 3147542.9247789998,     # «إجمالى قيمة المخزون الكلى آخر يونيه 2026»
    "inventory_jul": 2586995.55,             # «إجمالى قيمة المخزون الكلى آخر يوليو 2026»
    "inventory_jul_raw": 2016665.61,
    "inventory_jul_fg": 570329.94,
    "purchases_jul": 2161488.17,             # «إجمالى مشتريات يوليو»
    "purchases_aug": 2727152.34,             # تقرير المشتريات 01/08–31/08/2026
    "inventory_aug": 3305316.36,             # «إجمالى قيمة المخزون الكلى آخر أغسطس 2026» (ملف «-2»)
    "inventory_aug_raw": 2661861.09,
    "inventory_aug_fg": 643455.27,
    "inventory_sep": 2522417.665092,         # «إجمالى قيمة المخزون الكلى آخر سبتمبر» (نموذج سبتمبر)
    "inventory_sep_raw": 2202826.800592,
    "inventory_sep_fg": 319590.8645,
    "purchases_sep_printed": 2217803.14,     # تقرير المشتريات 01/09–30/09/2026 — الجمالي
    "purchases_sep": 2189453.14,             # «إجمالى مشتريات سبتمبر (بعد التصحيح)»
    "suppliers": 1047063.4319,               # حسابات الموردين 02/09/2026 — دائن الإجمالي
    "returns_jul": 128129.55,                # تقرير مرتجع المبيعات 01/07–30/07
    "returns_aug": 117327.25,                # تقرير مرتجع المبيعات 01/08–31/08
}


@pytest.fixture(scope="module")
def ops():
    if not OPS_JSON.exists():
        pytest.skip("ops_data.json not built")
    return json.loads(OPS_JSON.read_text(encoding="utf-8"))


def test_totals_equal_printed_source(ops):
    inv = ops["inventory"]
    assert inv["jun"]["raw_value"] + inv["jun"]["fg_value"] == pytest.approx(PRINTED["inventory_jun"], abs=1)
    assert inv["jul"]["raw_value"] == pytest.approx(PRINTED["inventory_jul_raw"], abs=1)
    assert inv["jul"]["fg_value"] == pytest.approx(PRINTED["inventory_jul_fg"], abs=1)
    assert inv["jul"]["raw_value"] + inv["jul"]["fg_value"] == pytest.approx(PRINTED["inventory_jul"], abs=1)
    assert ops["purchases"]["2026-07"]["total"] == pytest.approx(PRINTED["purchases_jul"], abs=1)
    assert ops["purchases"]["2026-08"]["total"] == pytest.approx(PRINTED["purchases_aug"], abs=1)
    for m in ("aug", "sep"):
        assert inv[m]["raw_value"] == pytest.approx(PRINTED[f"inventory_{m}_raw"], abs=1)
        assert inv[m]["fg_value"] == pytest.approx(PRINTED[f"inventory_{m}_fg"], abs=1)
        assert inv[m]["raw_value"] + inv[m]["fg_value"] == pytest.approx(PRINTED[f"inventory_{m}"], abs=1)
    sep = ops["purchases"]["2026-09"]
    assert sep["total_printed"] == pytest.approx(PRINTED["purchases_sep_printed"], abs=0.01)
    assert sep["total_recorded"] == pytest.approx(PRINTED["purchases_sep_printed"], abs=1)
    assert sep["total"] == pytest.approx(PRINTED["purchases_sep"], abs=1)
    assert ops["suppliers"]["net_credit"] == pytest.approx(PRINTED["suppliers"], abs=1)
    assert ops["returns_items"]["2026-07"]["total"] == pytest.approx(PRINTED["returns_jul"], abs=1)
    assert ops["returns_items"]["2026-08"]["total"] == pytest.approx(PRINTED["returns_aug"], abs=1)


def test_rows_are_complete(ops):
    """Row numbers printed in the PDFs run 1..n without a gap."""
    for name, rows in (("purchases_aug", ops["purchases"]["2026-08"]["rows"]),
                       ("purchases_sep", ops["purchases"]["2026-09"]["rows"]),
                       ("suppliers", ops["suppliers"]["rows"]),
                       ("returns_jul", ops["returns_items"]["2026-07"]["rows"]),
                       ("returns_aug", ops["returns_items"]["2026-08"]["rows"])):
        assert sorted(r["idx"] for r in rows) == list(range(1, len(rows) + 1)), name


def test_links_are_never_guessed(ops):
    """A link exists only with the 'high' match flag and a sales code, and
    variant words (حار، خام، عرض …) never link to a plain item."""
    rows = [r for m in ops["returns_items"].values() for r in m["rows"]]
    rows += [r for k in ("jun", "jul", "aug", "sep") for r in ops["inventory"][k]["fg"]]
    for r in rows:
        assert (r["item_code"] is not None) == (r["match"] == "عالية")
    for r in ops["inventory"]["jul"]["fg"]:
        if any(w in r["name"] for w in ("حار", "خام", "عرض", "برازيلي")):
            assert r["item_code"] is None, r["name"]


def test_returns_fields_are_split_cleanly(ops):
    rows = [r for m in ops["returns_items"].values() for r in m["rows"]]
    reps = {r["rep"] for r in rows}
    regions = {r["region"] for r in rows}
    assert not reps & regions, reps & regions          # no rep landed in the region column
    assert "..." not in regions                        # the printed «...» is recorded as «غير محددة»


def test_cleaning_log_is_published(ops):
    ids = {r["id"] for r in ops["cleaning"]}
    assert {"pdf_text", "link_items", "unlinked"} <= ids
    assert all(r["count"] > 0 for r in ops["cleaning"])


def test_valuations_run_in_date_order(ops):
    inv = ops["inventory"]
    vals = inv["valuations"]
    assert [v["key"] for v in vals] == ["jun", "jul", "aug", "sep"]
    assert [v["date"] for v in vals] == sorted(v["date"] for v in vals)
    for v in vals:
        assert v["raw_value"] == inv[v["key"]]["raw_value"] and v["fg_value"] == inv[v["key"]]["fg_value"]


def test_priced_september_count_values_the_same_stock(ops):
    """Quantity by location × the price on the count's own line = the September model's raw total."""
    inv = ops["inventory"]
    cnt = inv["counts"]["2026-09"]
    raw = sum(sum(r["qty"].values()) * (r["price"] or 0) for r in cnt["raw"])
    assert raw == pytest.approx(inv["sep"]["raw_value"], abs=1)
    assert sum(r["qty"] * (r["price"] or 0) for r in cnt["fg"]) == pytest.approx(inv["sep"]["fg_value"], abs=1)


def test_september_correction_is_the_one_confirmed_invoice(ops):
    """Only invoice 1111115217 differs from the printed register; its two lines keep the printed value."""
    rows = ops["purchases"]["2026-09"]["rows"]
    fixed = [r for r in rows if abs(r["total"] - r["total_recorded"]) >= 0.01]
    assert {r["invoice"] for r in fixed} == {"1111115217"} and len(fixed) == 2
    assert sum(r["total"] - r["total_recorded"] for r in fixed) == pytest.approx(-28350, abs=0.01)
    assert {r["id"] for r in ops["cleaning"]} >= {"invoice_fix"}


def test_recipes_carry_four_months(ops):
    for r in ops["inventory"]["recipes"]:
        for k in ("kg_jun", "kg_jul", "kg_aug", "kg_sep"):
            assert r[k] and r[k] > 0, (r["product"], k)


def test_generated_date_is_kept_when_nothing_else_changed(tmp_path):
    from src import ops_ingest

    out = tmp_path / "ops.json"
    old = {"meta": {"generated": "2026-01-01", "notes": ["n"]}, "x": 1}
    out.write_text(json.dumps(old), encoding="utf-8")
    same = {"meta": {"generated": "2026-10-20", "notes": ["n"]}, "x": 1}
    assert ops_ingest.keep_generated(same, out)["meta"]["generated"] == "2026-01-01"
    changed = {"meta": {"generated": "2026-10-20", "notes": ["n"]}, "x": 2}
    assert ops_ingest.keep_generated(changed, out)["meta"]["generated"] == "2026-10-20"


def test_reparse_reproduces_committed_json(ops):
    pytest.importorskip("openpyxl")
    if not shutil.which("pdftotext"):
        pytest.skip("pdftotext (poppler) not installed")
    if not (shutil.which("soffice") or shutil.which("libreoffice")):
        pytest.skip("LibreOffice not installed (the September model is recalculated)")
    from src import ops_ingest

    if not ops_ingest.SNAP_HTML.exists() or not ops_ingest.RAW.exists():
        pytest.skip("raw sources not present")
    ops_ingest.LOG.rules.clear()
    fresh = json.loads(json.dumps(ops_ingest.build(), ensure_ascii=False))
    fresh["meta"]["generated"] = ops["meta"]["generated"]
    assert fresh == ops, "run python3 -m src.ops_ingest"
