"""
Financial-statements parser tests (src/statements.py).

Lock the balance-sheet / P&L figures read from data/raw/ to the source workbook,
that the dropped Feb-2026 column never appears, and the self-check that the
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
    # Feb-2026 is dropped by management decision: absent everywhere, no flag.
    assert "2026-02-28" not in fs["balance_sheets"]
    assert "2026-02-28" not in fs["other_current_assets"]
    assert not any(f["id"].startswith("bs_unbalanced") for f in fs["quality_flags"])


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


def test_h2_net_profit_reconciliation(fs):
    """B.S. net profit at 31/12/2025 covers Jul-Dec 2025 (confirmed by management)."""
    f = next(f for f in fs["quality_flags"] if f["id"] == "bs_net_profit_mismatch")
    assert f["gap"] == pytest.approx(420_839, abs=1)
    assert f["explained"] == pytest.approx(75_000, abs=1)
    assert f["unexplained"] == pytest.approx(345_839, abs=1)


def test_retained_earnings_movement_flag(fs):
    """Jan-Jun 2025 profit is inside retained earnings, so any 31/7 -> 31/12 move is flagged."""
    f = next(f for f in fs["quality_flags"] if f["id"] == "retained_earnings_movement")
    assert f["movement"] == pytest.approx(-443_367, abs=1)

def test_gross_margin_matches_fs_dictionary_and_monthly_values(fs):
    """K016: the FS dictionary definition matches each detailed monthly statement."""
    definition = next(x for x in fs["kpi_dictionary"] if x["kpi"] == "هامش مجمل الربح")
    assert "تكلفة المبيعات" in definition["formula"]
    assert "صافي المبيعات" in definition["formula"]
    for month, row in fs["income"].items():
        expected = ((row["net_sales"] - row["cogs"]) / row["net_sales"]
                    if row["net_sales"] else None)
        if expected is None:
            assert row["gross_margin"] is None, month
        else:
            assert row["gross_margin"] == pytest.approx(expected, abs=1e-4), month


def test_quick_ratio_formula_and_zero_liabilities():
    """K023: quick ratio excludes inventory and is unavailable when current liabilities are zero."""
    from datetime import datetime
    from openpyxl import Workbook

    def parse(current_liabilities):
        wb = Workbook()
        ws = wb.active
        ws.title = "B.S."
        ws["A1"] = "DATE (Day, Month, Year)"
        ws["D1"] = datetime(2025, 7, 31)
        values = {
            "04": 100, "08": 600, "16": 1000,
            "25": current_liabilities, "42": 1000,
        }
        for row_no, (code, value) in enumerate(values.items(), start=2):
            ws.cell(row=row_no, column=1, value=code)
            ws.cell(row=row_no, column=4, value=value)
        return statements.parse_balance_sheets(wb)[0]["2025-07-31"]

    balanced = parse(250)
    assert balanced["quick_ratio"] == pytest.approx((600 - 100) / 250)
    no_current_liabilities = parse(0)
    assert no_current_liabilities["quick_ratio"] is None


def test_equity_other_movements_matches_change_in_equity_less_net_income():
    """K029: this is a residual movement, not a direct ledger-level partner-current reconciliation."""
    bs = {
        "2025-07-31": {"total_equity": 1_000, "cash_and_deposits": 500},
        "2025-08-31": {"total_equity": 1_250, "cash_and_deposits": 600},
    }
    months = {
        "2025-08": {"net_profit_after_dep": 150, "depreciation_booked": 0},
    }
    result = statements.cash_flows(bs, months)[0]
    assert result["equity_other_movements"] == pytest.approx(
        (1_250 - 1_000) - 150
    )
    assert result["equity_other_movements"] == pytest.approx(100)

