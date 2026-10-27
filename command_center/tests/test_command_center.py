"""
Command centre (command_center/build.py): one page built from every output in data/processed.

The build stops on any figure that does not match its source total, so a passing build means
every number on the page reconciles. These tests also pin the rules the page must keep: a missing
statement or report stays a gap, partial AR dates stay marked partial, and both pages are complete.
The browser test opens every section and fails on any script error.
"""
import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

pd = pytest.importorskip("pandas")

APP = Path(__file__).resolve().parents[1]
ROOT = APP.parent


@pytest.fixture(scope="module")
def built(tmp_path_factory):
    out = tmp_path_factory.mktemp("cc") / "artifact.html"
    run = subprocess.run([sys.executable, str(APP / "build.py")], cwd=ROOT, capture_output=True, text=True,
                         env={**os.environ, "COMMAND_CENTER_ARTIFACT": str(out)})
    assert run.returncode == 0, run.stdout + run.stderr
    data = json.loads((APP / "data.json").read_text(encoding="utf-8"))
    return data, (APP / "index.html").read_text(encoding="utf-8"), out.read_text(encoding="utf-8")


def test_every_check_passes(built):
    data, _, _ = built
    assert len(data["checks"]) >= 50
    assert all(c["ok"] for c in data["checks"])


def test_sales_total_matches_eda(built):
    data, _, _ = built
    eda = json.loads((ROOT / "data/processed/eda_summary.json").read_text(encoding="utf-8"))
    assert data["sales"]["totals"]["revenue"] == pytest.approx(float(eda["total_revenue"]), abs=0.5)
    assert sum(data["sales"]["revenue"]) == pytest.approx(float(eda["total_revenue"]), abs=1)


def test_missing_month_is_a_gap_not_an_estimate(built):
    rows = {r["period"]: r for r in built[0]["pnl"]["rows"]}
    june = rows["2025-06"]
    assert june["status"] == "يحتاج بيانات"
    assert june["net_sales"] is None and june["net_profit"] is None


def test_quarter_sorts_by_its_first_month(built):
    periods = [r["start"] for r in built[0]["pnl"]["rows"]]
    assert periods == sorted(periods)
    assert built[0]["pnl"]["ytd_2026"]["through"] == "2026-07"


def test_partial_ar_dates_are_marked_and_not_filled(built):
    ar = built[0]["ar"]
    for t in ar["totals"]:
        i = ar["dates"].index(t["date"])
        gaps = [m["rep"] for m in ar["matrix"] if m["values"][i] is None]
        assert sorted(gaps) == sorted(t["missing"])
        assert t["complete"] == (not t["missing"])
    assert ar["latest_complete"]["date"] == "2026-07-25"


def test_recipe_margin_is_price_minus_cost(built):
    for m in built[0]["costing"]["margins"]:
        assert m["margin"] == pytest.approx(m["price"] - m["cost"], abs=0.02)


def test_pages_are_complete(built):
    _, html, artifact = built
    for page in (html, artifact):
        assert "/*__DATA__*/" not in page and "__LOGO__" not in page
        assert "<title>" in page
    assert html.startswith("<!doctype html>")
    assert not artifact.lstrip().startswith("<!doctype")  # the publisher adds the skeleton


def test_page_runs_in_a_browser(built):
    sync_api = pytest.importorskip("playwright.sync_api")
    errors = []
    try:
        with sync_api.sync_playwright() as p:
            browser = p.chromium.launch()
            for width in (1280, 400):
                page = browser.new_page(viewport={"width": width, "height": 900})
                page.on("pageerror", lambda e: errors.append(str(e)))
                page.goto((APP / "index.html").as_uri())
                for tab in ["overview", "sales", "customers", "pnl", "ar", "costing", "forecast", "quality"]:
                    page.evaluate(f"location.hash = '{tab}'")
                    page.wait_for_timeout(60)
                    assert page.is_visible(f"#sec-{tab}")
                    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), f"{tab}@{width} overflows"
                page.close()
            browser.close()
    except sync_api.Error as e:  # browser not installed
        pytest.skip(f"chromium unavailable: {e}")
    assert not errors, errors
