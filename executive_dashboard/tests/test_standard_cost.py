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
    """26/10/2026: every kilo of sausage, any brand, carries 0.0666666667 casing at the file's price
    (300 = (الهنا 5 ك sausage − its paste) ÷ its casing). الهنا and أبو هاشم include it in the file;
    اسباشيل gets it added. Nothing else changes: std = file total, figures kept as read."""
    by = {r["row"]: r for r in data["rows"]}
    price = (by[7]["mix"] - by[8]["mix"]) / (sc.HANK_PER_KG * 5)
    assert price == pytest.approx(300.0, abs=0.01)
    kg = {5: 0.3, 6: 0.7, 7: 5, 27: 0.3, 28: 0.7, 29: 5, 47: 0.35, 48: 0.8, 49: 3, 50: 5}
    assert {r["row"] for r in data["rows"] if "hank_qty" in r} == set(kg)          # paste rows carry none
    paste_kg = by[8]["mix"] / 5
    for row, w in kg.items():
        r = by[row]
        assert r["hank_qty"] == pytest.approx(sc.HANK_PER_KG * w, abs=1e-6)
        assert r["hank_cost"] == pytest.approx(r["hank_qty"] * price, abs=1e-3)
        if r["brand"] == "الهنا":
            assert r["mix"] == pytest.approx(paste_kg * w + r["hank_cost"], abs=0.01)  # proven from the file
        if r["hank_in_file"]:
            assert r["std"] == r["total"] and r["std_basis"].startswith("الملف — " + sc.DECIDED_FILE), r
        else:
            assert r["brand"] == "اسباشيل" and r["std"] == pytest.approx(r["total"] + r["hank_cost"], abs=1e-3), r
    assert [round(by[x]["std"], 2) for x in (27, 28, 29)] == [24.11, 51.32, 329.13]
    assert round(by[7]["std"], 2) == 234.68                                        # the file, not the model's 135.09
    for r in data["rows"]:
        if "hank_qty" not in r:
            assert r["std"] == r["total"] and r["std_basis"] == "الملف" and not r.get("cons_ok"), r


def test_rebuilding_gives_the_committed_file(data):
    pytest.importorskip("openpyxl")
    if not sc.SRC.exists():
        pytest.skip("standard_cost.xlsx not present")
    assert sc.build() == data
