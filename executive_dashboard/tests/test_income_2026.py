"""
2026 income statements (src/income_2026.py) — the committed income_2026.json.

Without pdftotext (the CI image): the committed figures must still add up and agree
with the monthly statements embedded in the dashboard. With pdftotext: re-reading the
PDFs must give the committed file.
"""
import copy
import json
import shutil
import sys
from pathlib import Path

import pytest

APP_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(APP_DIR))

from src import income_2026 as inc  # noqa: E402


@pytest.fixture(scope="module")
def data():
    if not inc.OUT_JSON.exists():
        pytest.skip("income_2026.json not built")
    return json.loads(inc.OUT_JSON.read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def dm():
    return inc.dash_margin()


def test_periods_and_printed_net_profits(data):
    nets = {p["period"]: p["net_profit"] for p in data["periods"]}
    assert list(nets)[:5] == ["2026-Q1", "2026-04", "2026-05", "2026-06", "2026-07"]
    assert nets["2026-Q1"] == pytest.approx(527889.17) and nets["2026-04"] == pytest.approx(61407.05)
    assert nets["2026-07"] == pytest.approx(958973.09)
    assert data["periods"][0]["months"] == ["2026-01", "2026-02", "2026-03"]


def test_every_statement_adds_up_and_matches_the_embedded_statements(data, dm):
    months, outside = dm
    for p in data["periods"]:
        q = copy.deepcopy(p)
        inc.check(q, outside)                       # GP, each section, net — raises on any gap
        inc.cross_check(q, months)                  # sales, COGS, expenses = DASH_MARGIN
        assert [i["in_total"] for i in q["items"]] == [i["in_total"] for i in p["items"]], p["period"]


def test_items_outside_the_printed_totals_are_exactly_the_recorded_ones(data, dm):
    _months, outside = dm
    mine = sorted((p["period"], i["amount"]) for p in data["periods"] for i in p["items"] if not i["in_total"])
    theirs = sorted((r["period"], r["amount"]) for r in outside if r["period"].startswith("2026"))
    assert mine == theirs and len(mine) == 6


def test_a_wrong_total_stops_the_build(data, dm):
    _months, outside = dm
    p = copy.deepcopy(data["periods"][-1])
    p["items"][0]["amount"] += 1000
    with pytest.raises(AssertionError):
        inc.check(p, outside)


def test_operating_is_split_only_where_the_statement_splits_it(data):
    op = {p["period"]: p["sections"]["operating"] for p in data["periods"]}
    assert op["2026-Q1"] is None and op["2026-04"] is None
    assert all(op[m] is not None for m in ("2026-05", "2026-06", "2026-07"))


def test_rereading_the_pdfs_gives_the_committed_file(data):
    if not shutil.which("pdftotext"):
        pytest.skip("pdftotext (poppler) not installed")
    built = inc.build()
    assert dict(built, meta=dict(built["meta"], generated=data["meta"]["generated"])) == data
