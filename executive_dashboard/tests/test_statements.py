"""
Financial-statements parser tests (src/statements.py).

Lock the balance-sheet / P&L figures read from data/raw/ to the source workbook,
the exclusion of the unbalanced Feb-2026 column, and the self-check that the
recomputed indirect cash flow equals the actual change in cash + deposits.
Skipped automatically when openpyxl is unavailable (stock CI image).
"""
import sys
from pathlib import Path

import pytest

APP_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(APP_DIR))

pytest.importorskip("openpyxl")
from src import statements  # noqa: E402


@pytest.fixture(scope="module")
def fs():
    if not statements.F_POP.exists() or not statements.F_IS_DETAIL.exists():
        pytest.skip("raw statement workbooks not present")
    return statements.build()


def test_only_balanced_columns_are_used(fs):
    assert fs["meta"]["balance_sheet_dates"] == ["2025-07-31", "2025-08-31", "2025-12-31"]
    for bs in fs["balance_sheets"].values():
        assert abs(bs["balance_diff"]) < statements.BALANCE_TOL
    assert any(f["id"] == "bs_unbalanced_2026-02-28" for f in fs["quality_flags"])


def test_december_balance_sheet_reference_figures(fs):
    b = fs["balance_sheets"]["2025-12-31"]
    assert round(b["total_assets"]) == 20_296_416
    assert round(b["total_equity"]) == 15_217_552
    assert round(b["working_capital"]) == 6_946_796
    assert round(b["net_debt"]) == 2_176_706          # 3,845,831 debt − 1,669,125 cash+deposits
    assert b["current_ratio"] == pytest.approx(6.63, abs=0.01)


def test_monthly_income_statements(fs):
    inc = fs["income"]
    assert list(inc) == ["2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12"]
    dec = inc["2025-12"]
    assert round(dec["net_sales"]) == 3_170_826
    assert round(dec["net_profit_pre_dep"]) == 492_625
    assert dec["net_profit_after_dep"] == pytest.approx(-853_662, abs=1)   # annual dep. booked in Dec
    for m, t in inc.items():
        # net = gross − G&A − selling − finance (no unexplained residual)
        calc = t["gross_profit"] - t["admin"] - t["selling"] - t["finance"]
        assert calc == pytest.approx(t["net_profit_pre_dep"], abs=1.0), m


def test_cash_flow_reconciles_to_actual_cash_change(fs):
    assert fs["cash_flows"], "need at least two balanced balance sheets"
    for cf in fs["cash_flows"]:
        assert abs(cf["check_diff"]) < 1.0
    assert round(fs["cash_flows"][0]["cfo"]) == pytest.approx(295_520, abs=2)


def test_working_capital_days(fs):
    wc = fs["working_capital"]
    assert wc["ccc"] == pytest.approx(wc["dso"] + wc["dio"] - wc["dpo"], abs=0.2)
    assert 0 < wc["dso"] < 60 and 0 < wc["dio"] < 120


def test_every_kpi_has_formula_and_source(fs):
    for k in fs["kpi_dictionary"]:
        assert k["formula"] and k["source"] and k["period"]
