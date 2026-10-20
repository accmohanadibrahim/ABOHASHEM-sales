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


def test_unit_standard_is_the_file_total_except_the_override(data):
    """«سجق الهنا 5 ك» uses 135.09 (management); the file's 234.68 is kept beside it, unchanged."""
    for r in data["rows"]:
        if r["row"] == 7:
            assert r["name"] == "سجق الهنا 5 ك" and r["item_code"] == "257"
            assert r["std"] == 135.09 and r["total"] == pytest.approx(234.6755) and "234.68" in r["std_basis"]
        else:
            assert r["std"] == r["total"] and r["std_basis"] == "الملف", r


def test_rebuilding_gives_the_committed_file(data):
    pytest.importorskip("openpyxl")
    if not sc.SRC.exists():
        pytest.skip("standard_cost.xlsx not present")
    assert sc.build() == data
