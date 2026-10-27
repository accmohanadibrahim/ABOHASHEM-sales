"""
Panée, strips and soya recipe sheets (src/recipes.py), for «وصفات البانيه والاستربس».

Every line, kilo and pack figure must add up as printed, the sources must be the uploaded
files unchanged, and a sales item is linked only where management confirmed it (27/10/2026). Rebuilding from
the sources needs pdftotext and openpyxl; without them only the committed file is checked.
"""
import hashlib
import importlib.util
import json
import shutil
import sys
from pathlib import Path

import pytest

APP_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(APP_DIR))

from src import recipes as rc  # noqa: E402

TOOLS = importlib.util.find_spec("openpyxl") is not None and shutil.which("pdftotext") is not None


@pytest.fixture(scope="module")
def data():
    return json.loads(rc.OUT_JSON.read_text(encoding="utf-8"))


@pytest.mark.skipif(not TOOLS, reason="pdftotext / openpyxl not installed")
def test_committed_file_is_current(data):
    if not rc.FULL_HTML.exists():
        pytest.skip("full file not built")
    try:
        built = rc.build()
    except (ImportError, AttributeError) as e:   # a stub openpyxl on the PYTHONPATH
        pytest.skip(f"openpyxl unusable: {e}")
    assert built == data


def test_sources_are_the_uploads_unchanged(data):
    for r in data["recipes"]:
        src = rc.REPO_ROOT / r["source"]
        assert r["sha256"] == hashlib.sha256(src.read_bytes()).hexdigest()
        up = rc.REPO_ROOT / r["uploaded_as"]
        if up.exists():
            assert up.read_bytes() == src.read_bytes(), r["uploaded_as"]


def test_lines_kilo_and_packs_add_up(data):
    for r in data["recipes"]:
        assert sum(ln["total"] for ln in r["lines"]) == pytest.approx(r["total"], abs=rc.TOL)
        for ln in r["lines"]:
            if ln["qty"] is not None and ln["price"] is not None:
                assert ln["qty"] * ln["price"] == pytest.approx(ln["total"], abs=rc.TOL)
        assert r["per_kg"] + sum(a["value"] for a in r["kg_add"]) == pytest.approx(r["per_kg_loaded"], abs=1e-4)
        for p in r["packs"]:
            if "base_printed_as" not in p:
                assert r["per_kg_loaded"] * p["grams"] / 1000 == pytest.approx(p["base"], abs=1e-3)
            assert p["base"] + p["packaging"] + p["commission"] == pytest.approx(p["total"], abs=1e-3)
            assert p["cost_ex_commission"] == pytest.approx(p["base"] + p["packaging"], abs=1e-4)
    packs = {(r["key"], p["grams"]): round(p["total"], 2) for r in data["recipes"] for p in r["packs"]}
    assert packs == {("panee", 800): 49.12, ("panee", 900): 54.43, ("strips", 900): 130.74, ("soya", 400): 65.33}


def test_links_only_where_management_confirmed(data):
    """27/10/2026: الهنا and اسبشيال share the recipe cost; the soya 400 g sheet is item 10.
    Anything else stays «يحتاج تأكيد الربط»; a confirmed item's margin is price − pack cost."""
    for c in data["candidates"]:
        for i in c["items"]:
            assert i["grams"] == c["grams"]
            rule = rc.CONFIRMED[c["recipe"]]
            confirmed = i["brand"] in rule.get("brands", ()) or i["code"] in rule.get("codes", ())
            assert i["status"] == (rc.DECISION if confirmed else rc.LINK), i["code"]
            if confirmed:
                exp = i["month_price"] if i["month_price"] is not None else i["avg_price"]
                assert i["price"] == exp and i["price_basis"] == (rc.PRICE_MONTH if i["month_price"] is not None else "كل اللقطة")
                assert i["margin"] == pytest.approx(i["price"] - c["pack_total"], abs=1e-3)
                assert i["margin_ex_commission"] == pytest.approx(i["price"] - c["cost_ex_commission"], abs=1e-3)
                assert i["margin_pct"] == pytest.approx(i["margin"] / i["price"], abs=1e-4)
            else:
                assert "margin" not in i
    linked = {(c["recipe"], i["code"]) for c in data["candidates"] for i in c["items"] if i["status"] == rc.DECISION}
    assert ("soya", "10") in linked and {("panee", "346"), ("panee", "398"), ("strips", "441"), ("strips", "447")} <= linked
    assert data["meta"]["decision"]["date"] == "2026-10-27"
    assert {i["family"] for i in data["no_sheet"]} >= {"عجينة بقري"}
    assert all(i["status"] == "يحتاج بيانات" and "margin" not in i for i in data["no_sheet"])
    derived = [r for r in data["recipes"] if r["output_kg_basis"] != "مطبوع"]
    assert {r["key"] for r in derived} == {"panee", "strips"}             # the batch output is not printed there
