"""The KPI register (docs/KPI_REGISTER.md) is the code's own, and the checks it cites hold.

  * the committed register equals what tools/kpi_register.py generates from the approved file now;
  * every export table and every test it names exists;
  * the «قاموس المؤشرات» reconciliation checks all pass;
  * the two KPIs that had no matching test now have one: slow raw materials, standard margin per SKU.
"""
import importlib.util
import re
from pathlib import Path

import pytest

APP_DIR = Path(__file__).resolve().parent.parent
BI_HTML = APP_DIR / "mobile" / "Abu_Hashem_Mobile_bi.html"
REGISTER = APP_DIR / "docs" / "KPI_REGISTER.md"


def _tool():
    spec = importlib.util.spec_from_file_location("kpi_register", APP_DIR / "tools" / "kpi_register.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


@pytest.fixture(scope="module")
def page():
    sync_api = pytest.importorskip("playwright.sync_api")
    if not BI_HTML.exists():
        pytest.skip("bi.html not built")
    tool = _tool()
    with sync_api.sync_playwright() as p:
        try:
            b = p.chromium.launch()
        except Exception as e:  # browser binary missing
            pytest.skip(f"Chromium not available: {e}")
        pg = b.new_page(viewport={"width": 390, "height": 844})
        pg.goto(BI_HTML.as_uri())
        pg.wait_for_selector('[data-print="scroll"]')
        assert pg.evaluate(tool.FIND_APP)
        pg.wait_for_function("() => window.__abhApp.state.ready")
        yield pg
        b.close()


def test_register_is_current():
    pytest.importorskip("playwright.sync_api")
    if not BI_HTML.exists():
        pytest.skip("bi.html not built")
    tool = _tool()
    try:
        app = tool.read_app()
    except Exception as e:  # browser binary missing
        pytest.skip(f"Chromium not available: {e}")
    assert REGISTER.read_text(encoding="utf-8") == tool.render(app), "run python3 tools/kpi_register.py"


def test_register_names_only_what_exists(page):
    text = REGISTER.read_text(encoding="utf-8")
    tables = set(page.evaluate("() => window.__abhApp.exportTables().map(t => t.id)"))
    named = set(re.findall(r"\| `([a-z0-9_]+)` \| (?:`test_|بلا)", text))
    assert named and named <= tables, named - tables
    tests = set(_tool().test_index())
    cited = set(re.findall(r"`(test_[a-z0-9_]+\.py::test_[a-z0-9_]+)`", text))
    assert cited and cited <= tests, cited - tests
    assert "| فعلي معتمد |" in text and "غير متاح" in text and "لم يُوثَّق بعد" in text


def test_catalog_checks_pass(page):
    rows = page.evaluate("() => { const A = window.__abhApp; return A.biKpiRows(A.state.api.D, A.state.T)"
                         ".map(r => [r.kpi, String(r.check || '')]); }")
    checked = [(k, c) for k, c in rows if re.match(r"^(ناجح|فشل)", c)]
    assert len(checked) >= 6
    assert all(c.startswith("ناجح") for _, c in checked), [x for x in checked if not x[1].startswith("ناجح")]


def test_slow_and_dead_stock_match_definition(page):
    r = page.evaluate("""() => { const A = window.__abhApp, V = A.biStock(), I = window.DASH_OPS.inventory;
      const keys = A.opsVals().map(v => v.key).filter(k => k !== "jun"), last = I[keys[keys.length - 1]].raw,
            prev = new Map(I[keys[keys.length - 2]].raw.map(x => [x.name, x]));
      return {dead: V.dead, slow: V.slow, last, prev: Object.fromEntries(prev)}; }""")
    by = {x["name"]: x for x in r["last"]}
    for s in r["slow"] + r["dead"]:
        cur, p = by[s["name"]], r["prev"][s["name"]]
        assert cur["qty"] == p["qty"] == s["qty"] and not cur.get("purch_qty"), s["name"]
        assert s["value"] == cur["value"]
    assert not {x["name"] for x in r["dead"]} & {x["name"] for x in r["slow"]}


def test_standard_margin_per_sku_matches_definition(page):
    sku = page.evaluate("() => window.__abhApp.biStd(window.__abhApp.state.api.D).sku")
    priced = [s for s in sku if s["price"]]
    assert priced
    for s in priced:
        assert s["std_margin"] == pytest.approx((s["price"] - s["std"]) / s["price"], abs=1e-9), s["code"]
        assert s["std_gp"] == pytest.approx(s["rev"] - s["std"] * (s["qty"] + s["bonus"]), abs=1e-6), s["code"]


def test_breakeven_matches_definition(page):
    """Break-even sales = expenses ÷ contribution ratio (COGS variable, expenses fixed — an assumption,
    tagged «افتراض»); margin of safety = (sales − break-even) ÷ sales. The catalogue's figure is the
    latest measured month of the same table."""
    r = page.evaluate("""() => { const A = window.__abhApp, D = A.state.api.D, T = A.state.T;
      return {be: A.biBreakEven(), stmts: A.biStmts(), cat: A.biKpiRows(D, T).find(k => k.kpi === "مبيعات التعادل"),
              last: A.biLastTwo()[1], fmt: A.biBreakEven().map(x => [x.month, T.egpK(x.be)])}; }""")
    by = {s["period"]: s for s in r["stmts"]}
    assert r["be"]
    for x in r["be"]:
        s = by[x["month"]]
        cm = (s["net_sales"] - s["cogs"]) / s["net_sales"]
        assert x["cm"] == pytest.approx(cm) and x["fixed"] == s["total_expenses"]
        assert x["be"] == pytest.approx(s["total_expenses"] / cm)
        assert x["mos"] == pytest.approx((s["net_sales"] - x["be"]) / s["net_sales"])
    assert r["cat"]["status"] == "افتراض"
    assert r["cat"]["value"] == dict(r["fmt"])[r["last"]]
