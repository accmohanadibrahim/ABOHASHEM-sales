"""
January–May 2025 income statements (src/income_2025h1.py).

Every transcribed figure must appear in its month's text, every total must add up, March
must carry its flag, June must be «يحتاج بيانات», and July–December must be DASH_FS as is.
"""
import json
import sys
from pathlib import Path

import pytest

APP_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(APP_DIR))

from src import income_2025h1 as inc  # noqa: E402


@pytest.fixture(scope="module")
def data():
    return json.loads(inc.OUT_JSON.read_text(encoding="utf-8"))


def test_committed_file_is_current(data):
    assert inc.build() == data


def test_sources_are_the_uploaded_text_unchanged(data):
    for i, r in enumerate(data["months"]):
        up = inc.REPO_ROOT / inc.UPLOADED_AS.format(inc.ARABIC_DIGITS[i])
        if up.exists():
            assert up.read_bytes() == inc.source(r["month"]).read_bytes(), r["month"]


def test_totals_add_up(data):
    for r in data["months"]:
        net = r["gross_sales"] - r["returns"] - r["discount"]
        assert r["net_sales"] == pytest.approx(net, abs=inc.TOL), r["month"]
        gp = r["net_sales"] - r["cogs"] - r["inbound_freight"] + r["earned_discount"]
        assert r["gross_profit"] == pytest.approx(gp, abs=inc.TOL), r["month"]
        assert r["net_profit"] == pytest.approx(r["gross_profit"] - r["expenses"], abs=inc.TOL), r["month"]
        assert r["basis"] == inc.TEXT_BASIS


def test_a_figure_not_in_the_text_stops_the_build():
    f = dict(inc.FIGURES["2025-05"], net_profit=663950.21)
    errs = inc.check_month("2025-05", f, inc.source("2025-05").read_text(encoding="utf-8"))
    assert any("net_profit" in e for e in errs)


def test_march_june_and_the_second_half(data):
    by = {r["month"]: r for r in data["months"]}
    assert by["2025-03"].get("needs_confirmation") and any("فبراير" in f for f in by["2025-03"]["flags"])
    assert not by["2025-02"].get("needs_confirmation")
    assert [m["month"] for m in data["missing"]] == ["2025-06"]
    fs = json.loads(inc.FS_JSON.read_text(encoding="utf-8"))["income"]
    assert [r["month"] for r in data["h2"]] == sorted(fs)
    for r in data["h2"]:
        assert r["net_sales"] == fs[r["month"]]["net_sales"] and r["net_profit"] == fs[r["month"]]["net_profit_pre_dep"]


def test_printed_net_profits(data):
    nets = {r["month"]: r["net_profit"] for r in data["months"]}
    assert nets == pytest.approx({"2025-01": 387739.27, "2025-02": 290393.02, "2025-03": 394660.02,
                                  "2025-04": 460563.39, "2025-05": 663950.20})
