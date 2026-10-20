"""
The built mobile dashboard, opened in a real browser (Playwright + Chromium).

The other tests check the HTML as text; these load it at phone size and visit
every section in the navigation, so a JavaScript error in any one of them, a
section that renders nothing, or a headline figure that drifts from the data
it is built from fails here instead of on a phone.

Skipped where Playwright or its Chromium is not installed. CI installs both
(.github/workflows/python-app.yml); locally:

    pip install playwright==1.56.0 && python -m playwright install chromium
"""
import json
from pathlib import Path

import pytest

APP_DIR = Path(__file__).resolve().parents[1]
FULL_HTML = APP_DIR / "mobile" / "Abu_Hashem_Mobile_full.html"
OPS_JSON = APP_DIR.parent / "data" / "processed" / "ops_data.json"

# The App is a React class component with no global handle; the test reaches it
# through React's fiber on the DOM, read-only, and drives it with its own go().
FIND_APP = """() => {
  for (const el of document.querySelectorAll('*'))
    for (const k of Object.keys(el))
      if (k.startsWith('__reactFiber')) {
        for (let f = el[k]; f; f = f.return)
          if (f.stateNode && typeof f.stateNode.registry === 'function') { window.__abhApp = f.stateNode; return true; }
      }
  return false;
}"""


@pytest.fixture(scope="module")
def page():
    sync_api = pytest.importorskip("playwright.sync_api")
    if not FULL_HTML.exists():
        pytest.skip("full file not built")
    with sync_api.sync_playwright() as p:
        try:
            browser = p.chromium.launch()
        except Exception as e:  # browser binary missing
            pytest.skip(f"Chromium not available: {e}")
        pg = browser.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        errors = []
        pg.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
        pg.on("console", lambda m: m.type == "error" and errors.append(f"console: {m.text}"))
        pg.goto(FULL_HTML.as_uri())
        pg.wait_for_selector('[data-print="scroll"]')
        assert pg.evaluate(FIND_APP), "App component not found"
        pg.wait_for_function("() => window.__abhApp.state.ready")
        pg.errors = errors
        yield pg
        browser.close()


@pytest.fixture(scope="module")
def ops():
    return json.loads(OPS_JSON.read_text(encoding="utf-8"))


def go(pg, key):
    pg.evaluate("k => window.__abhApp.go(k)", key)
    pg.wait_for_function("k => window.__abhApp.state.section === k", arg=key)
    pg.wait_for_timeout(150)  # let ECharts finish its first paint
    return pg.inner_text('[data-print="scroll"]')


def test_every_section_renders_without_errors(page):
    keys = page.evaluate("() => window.__abhApp.registry().map(s => s.key)")
    assert len(keys) >= 40, keys
    empty = []
    for k in keys:
        before = len(page.errors)
        text = go(page, k)
        assert page.errors[before:] == [], (k, page.errors[before:])
        if len(text.strip()) < 40:
            empty.append(k)
    assert not empty, f"sections with no content: {empty}"
    assert page.errors == []


def test_every_section_renders_on_the_other_snapshot(page):
    """The 16/7 snapshot stops at 15/7: the sections built for 3/9 must still render on it."""
    snaps = page.evaluate("() => window.__abhApp.state.snaps.map(s => s.key)")
    if len(snaps) < 2:
        pytest.skip("one snapshot only")
    cur = page.evaluate("() => window.__abhApp.state.snap")
    other = next(k for k in snaps if k != cur)
    page.evaluate("k => window.__abhApp.pickSnapshot(k)", other)
    page.wait_for_function("k => window.__abhApp.state.snap === k && window.__abhApp.state.ready", arg=other)
    try:
        for k in page.evaluate("() => window.__abhApp.registry().map(s => s.key)"):
            before = len(page.errors)
            go(page, k)
            assert page.errors[before:] == [], (other, k, page.errors[before:])
    finally:
        page.evaluate("k => window.__abhApp.pickSnapshot(k)", cur)
        page.wait_for_function("k => window.__abhApp.state.snap === k && window.__abhApp.state.ready", arg=cur)


def test_inventory_shows_every_valuation(page, ops):
    text = go(page, "ops_inventory")
    vals = ops["inventory"]["valuations"]
    for v in vals:
        assert f"{round(v['raw_value'] + v['fg_value']):,}" in text, v["date"]
    last = vals[-1]
    d = last["date"]
    assert f"قيمة المخزون {int(d[8:10])}/{int(d[5:7])}/{d[:4]}" in text


def test_purchases_cover_every_month(page, ops):
    go(page, "ops_purchases")
    v = page.evaluate("() => { const V = window.__abhApp.opsPurchases(); return {tot: V.tot, months: V.months}; }")
    assert v["months"] == sorted(ops["purchases"])
    assert v["tot"] == pytest.approx(sum(m["total"] for m in ops["purchases"].values()), abs=1)


def test_reconciliation_has_no_difference(page):
    """«سجل تنظيف البيانات»: every extracted total equals the printed one (difference column 0)."""
    go(page, "dq_clean")
    rows = page.evaluate("""() => [...document.querySelectorAll('table')]
      .filter(t => t.rows.length && t.rows[0].innerText.includes('المطبوع') && t.rows[0].innerText.includes('الفرق'))
      .flatMap(t => [...t.querySelectorAll('tr')].slice(1).map(r => [...r.cells].map(c => c.innerText.trim())))""")
    assert len(rows) >= 8, rows
    assert all(r[-1] in ("0", "(0)") for r in rows), rows


def test_header_and_excel_carry_data_dates_and_version(page, ops):
    build = page.evaluate("() => window.DASH_BUILD")
    line = page.inner_text('[data-build="line"]')
    assert build["version"][:7] in line
    d = ops["inventory"]["valuations"][-1]["date"]
    assert build["inventory_as_of"] == d and f"مخزون \u2066{int(d[8:10])}/{int(d[5:7])}\u2069" in line
    tables = page.evaluate("() => window.__abhApp.exportTables().map(t => [t.id, t.rows.length])")
    ids = dict(tables)
    assert ids.get("build_info") == 7
    for key in ("ops_valuations", "ops_raw_sep", "ops_fg_sep", "ops_purch_rows", "ops_costpass"):
        assert ids.get(key), key
