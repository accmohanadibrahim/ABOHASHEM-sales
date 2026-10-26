"""
Standard costs per pack (src/standard_cost.py) from «سعر انتاج تام» — the committed standard_cost.json.
"""
import json
import sys
from pathlib import Path

import pytest

APP_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(APP_DIR))

from src import standard_cost as sc  # noqa: E402


@pytest.fixture(scope="module")
def data():
    if not sc.OUT_JSON.exists():
        pytest.skip("standard_cost.json not built")
    return json.loads(sc.OUT_JSON.read_text(encoding="utf-8"))


def test_every_row_is_mix_plus_pack(data):
    for r in data["rows"] + data["unresolved"]:
        assert r["mix"] + r["pack"] == pytest.approx(r["total"], abs=0.01), r


def test_links_are_one_to_one_by_signature_or_confirmation(data):
    linked = [r for r in data["rows"] if r.get("item_code")]
    codes = [r["item_code"] for r in linked]
    assert len(codes) == len(set(codes)) >= 15
    for r in linked:
        if r["row"] in sc.CONFIRMED:
            assert r["match_basis"].startswith(sc.DECIDED), r
        else:
            assert r["match_basis"].startswith("توقيع مطابق"), r
    assert {r["key"] for r in data["unmatched"]} == {r["key"] for r in data["rows"] if not r.get("item_code")}


def test_management_confirmations_are_applied_exactly(data):
    """2026-10-20: سجق الهنا 300/700 = 350/800; Abu Hashem «سجق» = سجق 350, «350جرام»/«800جرام» = كفته 350/800."""
    by_row = {r["row"]: r for r in data["rows"]}
    assert {row: by_row[row]["item_code"] for row in sc.CONFIRMED} == {5: "108", 6: "99", 47: "7", 55: "8", 56: "114"}
    assert {row: by_row[row]["name"] for row in sc.CONFIRMED} == {row: c[0] for row, c in sc.CONFIRMED.items()}
    assert data["unresolved"] == []                       # every nameless / weightless row is now confirmed


def test_casing_on_every_sausage_kilo(data):
    """26/10/2026: every kilo of sausage, any brand, carries 0.0666666667 casing. Each brand's recipe
    sheet adds its cost to the paste price (الهنا!هانك 20, الهاشم!هنكات للكيلو 20, اسبشيال 2026!هانك
    250/15), so «ورقة1» already includes it: std = file total for every row, nothing is added."""
    by = {r["row"]: r for r in data["rows"]}
    kg = {5: 0.3, 6: 0.7, 7: 5, 27: 0.3, 28: 0.7, 29: 5, 47: 0.35, 48: 0.8, 49: 3, 50: 5}
    price = {"الهنا": 300.0, "ابو هاشم": 300.0, "اسباشيل": 250.0}      # per casing = cost per kilo × 15
    assert {r["row"] for r in data["rows"] if "hank_qty" in r} == set(kg)          # paste rows carry none
    paste_kg = by[8]["mix"] / 5
    for row, w in kg.items():
        r = by[row]
        assert r["hank_qty"] == pytest.approx(sc.HANK_PER_KG * w, abs=1e-6)
        assert r["hank_price"] == pytest.approx(price[r["brand"]], abs=0.01), r
        assert r["hank_cost"] == pytest.approx(r["hank_qty"] * r["hank_price"], abs=1e-3)
        assert r["hank_source"].split("!")[0] == sc.CASING_CELLS[r["brand"]][0]
        if r["brand"] == "الهنا":                       # proven from «ورقة1» itself: paste + casing
            assert r["mix"] == pytest.approx(paste_kg * w + r["hank_cost"], abs=0.01)
        assert r["std"] == r["total"] and "يشمل الهانك" in r["std_basis"], r
    assert round(by[7]["std"], 2) == 234.68 and [round(by[x]["std"], 2) for x in (27, 28, 29)] == [18.11, 37.32, 229.13]
    for r in data["rows"]:
        if "hank_qty" not in r:
            assert r["std"] == r["total"] and r["std_basis"] == "الملف" and not r.get("cons_ok"), r


def test_casing_is_read_from_the_recipe_sheets():
    pytest.importorskip("openpyxl")
    if not sc.SRC.exists():
        pytest.skip("standard_cost.xlsx not present")
    got = {b: round(v, 4) for b, (v, _cell) in sc.read_casing().items()}
    assert got == {"الهنا": 20.0, "ابو هاشم": 20.0, "اسباشيل": round(250 / 15, 4)}


def test_rebuilding_gives_the_committed_file(data):
    pytest.importorskip("openpyxl")
    if not sc.SRC.exists():
        pytest.skip("standard_cost.xlsx not present")
    assert sc.build() == data


def test_monthly_standard_is_the_recipe_at_the_month_average(data):
    """Management 26/10/2026: kg × the month's paste per kg + casing (sausage rows) + the file's packaging."""
    mon = data["monthly"]
    files = {m: json.loads((sc.MONTHLY_DIR / f"{m}.json").read_text(encoding="utf-8")) for m in mon["months"]}
    assert mon["months"] == sorted(files) == ["2026-08", "2026-09"]
    rows = {r["row"]: r for r in data["rows"]}
    assert {r["item_code"] for r in mon["rows"]} == {r["item_code"] for r in data["rows"] if r.get("item_code")}
    for r in mon["rows"]:
        f = rows[r["row"]]
        assert r["file_std"] == f["std"] and r["kg"] == sc.KG_FILE.get(r["row"], sc._kg(f))
        for m, v in r["by_month"].items():
            rc = files[m]["recipes"][r["recipe"]]
            casing = sc.HANK_PER_KG * r["kg"] * files[m]["hank_price"] if f.get("hank_qty") is not None else 0.0
            assert v["std"] == pytest.approx(r["kg"] * rc["paste_kg"] + casing + f["pack"], abs=1e-3), (r["key"], m)
    assert next(r for r in mon["rows"] if r["row"] == 39)["kg"] == 0.55      # the file's 600 g burger
    single = {s["item_code"]: s for s in mon["single"]}
    assert set(single) == {"1", "2", "33"}
    assert {c: s["mgmt"] for c, s in single.items()} == {"1": 90.09, "2": 65.75, "33": 264.0}
    assert single["33"]["by_month"]["2026-09"]["std"] == pytest.approx(files["2026-09"]["pool"] + 2.0, abs=1e-3)


def test_monthly_standard_can_be_switched_off(monkeypatch):
    monkeypatch.setattr(sc, "MONTHLY", False)
    assert sc.monthly([], {}) is None
