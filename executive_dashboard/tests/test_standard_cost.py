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


def test_links_are_one_to_one_and_by_signature(data):
    linked = [r for r in data["rows"] if r.get("item_code")]
    codes = [r["item_code"] for r in linked]
    assert len(codes) == len(set(codes)) >= 10
    assert all(r["match_basis"].startswith("توقيع مطابق") for r in linked)
    assert {r["key"] for r in data["unmatched"]} == {r["key"] for r in data["rows"] if not r.get("item_code")}


def test_rows_without_a_product_or_a_size_are_reported_not_guessed(data):
    assert {r["name"] for r in data["unresolved"]} == {"سجق", "350جرام", "800جرام"}
    assert all(r.get("reason") for r in data["unresolved"])


def test_rebuilding_gives_the_committed_file(data):
    pytest.importorskip("openpyxl")
    if not sc.SRC.exists():
        pytest.skip("standard_cost.xlsx not present")
    assert sc.build() == data
