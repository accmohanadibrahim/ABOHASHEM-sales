"""
The approved file (mobile/Abu_Hashem_Mobile_bi.html), opened in a real browser.

Regression: every section of the base file (full.html) renders the same text in the
approved file; the declared exceptions are «التقارير», which lists the new tables, and
«قائمة الدخل», whose own content is followed by the 2025 statements (the two income-statement
sections merged, 27/10/2026). Then the BI sections: no JavaScript errors, figures traced back to the data
they are computed from (recomputed here in Python where the data is in the repo),
the alert status kept on the device, the ?nobi switch, and fault isolation.

Skipped where Playwright or its Chromium is not installed (see test_browser_mobile.py).
"""
import json
import re
from pathlib import Path

import pytest

from test_browser_mobile import FIND_APP

APP_DIR = Path(__file__).resolve().parents[1]
FULL_HTML = APP_DIR / "mobile" / "Abu_Hashem_Mobile_full.html"
BI_HTML = APP_DIR / "mobile" / "Abu_Hashem_Mobile_bi.html"
OPS_JSON = APP_DIR.parent / "data" / "processed" / "ops_data.json"
BI_KEYS = ("bi_map", "bi_exec", "bi_bridge", "bi_stock", "bi_std", "bi_arh", "bi_recipes", "bi_abm", "bi_alerts", "bi_kpis")
IS25_HEAD = "قوائم الدخل 2025 كاملة"
PL_HEAD = "قائمة الدخل الشهرية — يناير 2025 إلى يوليو 2026"


def _open(pg, path, query=""):
    pg.goto(path.as_uri() + query)
    pg.wait_for_selector('[data-print="scroll"]')
    assert pg.evaluate(FIND_APP), "App component not found"
    pg.wait_for_function("() => window.__abhApp.state.ready")


def go(pg, key):
    pg.evaluate("k => window.__abhApp.go(k)", key)
    pg.wait_for_function("k => window.__abhApp.state.section === k", arg=key)
    pg.wait_for_timeout(150)
    return pg.inner_text('[data-print="scroll"]')


@pytest.fixture(scope="module")
def browser():
    sync_api = pytest.importorskip("playwright.sync_api")
    for p in (FULL_HTML, BI_HTML):
        if not p.exists():
            pytest.skip(f"{p.name} not built")
    with sync_api.sync_playwright() as p:
        try:
            b = p.chromium.launch()
        except Exception as e:  # browser binary missing
            pytest.skip(f"Chromium not available: {e}")
        yield b
        b.close()


def _page(browser):
    pg = browser.new_page(viewport={"width": 390, "height": 844})
    pg.errors = []
    pg.on("pageerror", lambda e: pg.errors.append(f"pageerror: {e}"))
    pg.on("console", lambda m: m.type == "error" and pg.errors.append(f"console: {m.text}"))
    return pg


@pytest.fixture(scope="module")
def page(browser):
    pg = _page(browser)
    _open(pg, BI_HTML)
    yield pg
    pg.close()


def test_existing_sections_render_identically(browser):
    full, bi = _page(browser), _page(browser)
    _open(full, FULL_HTML)
    _open(bi, BI_HTML)
    keys = full.evaluate("() => window.__abhApp.registry().map(s => s.key)")
    n_full = full.evaluate("() => window.__abhApp.exportTables().length")
    n_bi = bi.evaluate("() => window.__abhApp.exportTables().filter(t => /^bi_/.test(t.id)).length")
    changed = []
    for k in keys:
        a, b = go(full, k), go(bi, k)
        if k == "r:reports":
            # The only declared difference: the table count and the «ذكاء الأعمال» tile.
            b = b.replace(f"— {n_full + n_bi} جدولًا", f"— {n_full} جدولًا").replace(f" من {n_full + n_bi}\n", f" من {n_full}\n")
            b = b.replace(f"ذكاء الأعمال\n{n_bi} جدول\n", "")
        if k == "fs_income":
            # Declared: one income statement Jan 2025 – Jul 2026 replaces the section's statement
            # tables; with ?nobi the section is the full file's exactly (test_income_merged).
            continue
        if a != b:
            changed.append(k)
    assert full.errors == [] and bi.errors == [], (full.errors, bi.errors)
    assert len(keys) >= 40 and changed == [], changed
    full.close()
    bi.close()


def test_bi_sections_render_without_errors(page):
    reg = page.evaluate("() => window.__abhApp.registry().filter(s => s.group === 'ذكاء الأعمال').map(s => s.key)")
    assert tuple(reg) == BI_KEYS
    for k in BI_KEYS:
        before = len(page.errors)
        text = go(page, k)
        assert page.errors[before:] == [], (k, page.errors[before:])
        assert len(text.strip()) > 400, k
        assert "تعذّر عرض هذا القسم" not in text, k
        assert page.evaluate("() => document.documentElement.scrollWidth") <= 390, k


def test_exec_figures_are_the_statement_figures(page):
    text = go(page, "bi_exec")
    r = page.evaluate("""() => { const A = window.__abhApp, [m0, m1] = A.biLastTwo(), s = A.biStmt(m1), T = A.state.T;
      return {m1, sales: T.egpK(s.net_sales), np: T.egpK(s.net_profit), basis: s.basis, label: A.fsMon(m1)}; }""")
    assert r["basis"] == "measured"
    assert r["sales"] in text and r["np"] in text and ("صافي المبيعات " + r["label"]) in text


def test_profit_bridges_add_up(page):
    """Company bridge: start + every Δ = end, for every pair of consecutive months.
    Item bridge: price + cost + volume/mix + new + dropped = the change, to the pound."""
    res = page.evaluate("""() => { const A = window.__abhApp, ms = A.biStmts().map(r => r.period), out = [];
      for (let i = 1; i < ms.length; i++) { const B = A.biPnlBridge(ms[i-1], ms[i]), I = A.biItemBridge(ms[i-1], ms[i]);
        out.push([ms[i], B.residual, I.resRev, I.resGp, I.items.length]); }
      return out; }""")
    assert len(res) >= 12
    for m, r, rr, rg, n in res:
        assert abs(r) < 1, (m, r)
        assert n > 0 and abs(rr) < 1 and abs(rg) < 1, (m, rr, rg)


def test_stock_figures_trace_to_ops_data(page):
    ops = json.loads(OPS_JSON.read_text(encoding="utf-8"))
    inv = ops["inventory"]
    keys = [v["key"] for v in inv["valuations"] if v["key"] != "jun"]
    maps = [{r["name"]: r for r in inv[k]["raw"]} for k in keys]
    dead = sorted(r["name"] for r in inv[keys[-1]]["raw"]
                  if r["qty"] > 0 and all(m.get(r["name"]) and m[r["name"]]["qty"] == r["qty"] for m in maps)
                  and all(not m[r["name"]].get("purch_qty") for m in maps[1:]))
    js = page.evaluate("""() => { const V = window.__abhApp.biStock();
      return {dead: V.dead.map(r => r.name).sort(), dio: V.dio.map(r => [r.month, r.avg, r.cogs, r.dio]),
        unpriced: V.unpriced.map(r => r.name).sort()}; }""")
    assert js["dead"] == dead
    assert js["unpriced"] == sorted(r["name"] for r in inv[keys[-1]]["raw"] if r["qty"] > 0 and not (r.get("wac") or 0) > 0)
    tot = {v["date"][:7]: v["raw_value"] + v["fg_value"] for v in inv["valuations"]}
    for month, avg, cogs, dio in js["dio"]:
        y, mo = int(month[:4]), int(month[5:7])
        prev = f"{y}-{mo - 1:02d}" if mo > 1 else f"{y - 1}-12"
        assert avg == pytest.approx((tot[prev] + tot[month]) / 2 if prev in tot else tot[month])
        if cogs is None:
            assert dio is None, month                      # «يحتاج بيانات», never an estimate
        else:
            days = 31 if mo in (1, 3, 5, 7, 8, 10, 12) else 30 if mo != 2 else 28
            assert dio == pytest.approx(avg / cogs * days), month


def test_missing_data_is_named_not_estimated(page):
    text = go(page, "bi_stock")
    months = page.evaluate("() => window.__abhApp.biStock().dio.filter(r => r.cogs == null).map(r => window.__abhApp.fsMon(r.month))")
    if months:
        assert "يحتاج بيانات" in text and all(m in text for m in months)
    kpis = go(page, "bi_kpis")
    assert kpis.count("يحتاج بيانات") >= 3 and "budget_2026.csv" in kpis


def test_alert_register_fields_and_status(page):
    page.evaluate("() => { try { localStorage.removeItem('abh.bi.alertStatus'); } catch (e) {} window.__abhApp.__biSt = null; }")
    text = go(page, "bi_alerts")
    for f in ("القيمة الفعلية", "الحد", "الانحراف", "السبب المحتمل", "الإجراء", "المسؤول", "المصدر"):
        assert f in text, f
    rows = page.evaluate("() => window.__abhApp.exportTables().find(t => t.id === 'bi_alert_register').rows.length")
    assert rows > 0 and page.locator("[data-bi-alert]").count() == rows
    first = page.locator("[data-bi-alert]").first
    first.locator('[data-bi-status="قيد المعالجة"]').click()
    page.wait_for_timeout(100)
    stored = json.loads(page.evaluate("() => localStorage.getItem('abh.bi.alertStatus')"))
    rid = first.get_attribute("data-bi-alert")
    assert stored[rid]["s"] == "قيد المعالجة" and re.fullmatch(r"\d{4}-\d{2}-\d{2}", stored[rid]["t"])
    assert "آخر تحديث للحالة" in first.inner_text()
    page.evaluate("() => { localStorage.removeItem('abh.bi.alertStatus'); window.__abhApp.__biSt = null; }")


def test_bi_tables_export(page):
    tabs = dict(page.evaluate("() => window.__abhApp.exportTables().filter(t => /^bi_/.test(t.id)).map(t => [t.id, t.rows.length])"))
    for tid in ("bi_freshness", "bi_bridge_pnl", "bi_bridge_items", "bi_breakeven", "bi_dio", "bi_alert_register",
                "bi_alert_rules", "bi_kpi_catalog", "bi_readiness"):
        assert tabs.get(tid, 0) > 0, tid


def test_map_places_every_section(page):
    """«دليل اللوحة»: every section of the navigation (but the guide itself) is in one of the seven
    groups, with its own label and nav group; the production group, with no section, names the data
    it needs; a name opens its section; the export table is the guide row for row."""
    text = go(page, "bi_map")
    reg = page.evaluate("() => window.__abhApp.registry().filter(s => s.key !== 'bi_map').map(s => [s.key, s.label, s.group])")
    rows = page.evaluate("() => window.__abhApp.biMapRows()")
    assert len(reg) >= 50 and [[r["key"], r["label"], r["nav"]] for r in rows] == [list(x) for x in reg]
    assert [r["key"] for r in rows if r["g"] is None] == []
    groups = page.evaluate("() => window.__abhApp.biMapDef().groups.map(g => g[0])")
    assert len(groups) == 7 and all(f"{i + 1} — {g}" in text for i, g in enumerate(groups))
    used = {r["g"] for r in rows}
    assert used == set(range(7)) - {4}                                   # no production section yet
    assert "يحتاج بيانات: أوامر التشغيل" in text and "\n0\nأقسام لم تُصنَّف\nكل الأقسام في الدليل" in text
    for r in rows:
        assert r["source"] and r["filters"] != "—", r["key"]
        assert r["as_of"] is None or re.fullmatch(r"\d{4}-\d{2}-\d{2}", r["as_of"]), r
    tab = page.evaluate("() => window.__abhApp.exportTables().find(t => t.id === 'bi_map')")
    assert [x["key"] for x in tab["rows"]] == [r["key"] for r in rows]
    page.click('[data-bi-map="ops_inventory"]')
    page.wait_for_function("() => window.__abhApp.state.section === 'ops_inventory'")
    go(page, "bi_map")


def test_map_filter_scope(browser):
    """What the guide says about filters is what the sections do: an invoice rep filter and a month
    filter, then an «التحليل» brand filter, change a section's text exactly where the guide says ✓."""
    pg = _page(browser)
    _open(pg, BI_HTML)
    empty = {"rep": None, "brand": None, "customerCode": None, "itemName": None}
    rep, month, brand = pg.evaluate("""() => { const D = window.__abhApp.state.api.D, RD = window.__abhApp.state.RD, top = k => {
        const c = {}; D.invoices.forEach(v => c[v[k]] = (c[v[k]] || 0) + 1); return Object.entries(c).sort((a, b) => b[1] - a[1])[0][0]; };
      return [top("rep"), top("month"), RD.brand_summary[0].brand]; }""")
    rows = pg.evaluate("() => window.__abhApp.biMapRows().map(r => [r.key, r.filter])")

    def txt(key, state):
        pg.evaluate("s => window.__abhApp.setState(s)", {"filters": {}, "rf": empty, **state})
        return go(pg, key)

    notice = "الفلاتر لا تنطبق على هذا القسم"
    wrong = []
    for key, code in rows:
        if code == "mix":
            continue
        base = txt(key, {})
        by_rep, by_month = txt(key, {"filters": {"rep": rep}}) != base, txt(key, {"filters": {"month": month}}) != base
        want = {"rm": (True, True), "r": (True, False), "m": (False, True)}.get(code, (False, False))
        ok = (by_rep, by_month) == want
        if code.startswith("rf"):
            t = txt(key, {"rf": {**empty, "brand": brand}})
            ok = ok and {"rf": t != base and notice not in t, "rf-": t == base or notice in t, "rf0": t == base}[code]
        if not ok:
            wrong.append((key, code, by_rep, by_month))
    txt("bi_map", {})
    assert wrong == [] and pg.errors == [], (wrong, pg.errors)
    pg.close()


def test_kill_switch_hides_the_group(browser):
    pg = _page(browser)
    _open(pg, BI_HTML, "?nobi")
    reg = pg.evaluate("() => window.__abhApp.registry().map(s => s.key)")
    assert not [k for k in reg if k.startswith("bi_")] and len(reg) >= 40
    text = go(pg, "fs_income")
    assert IS25_HEAD not in text and PL_HEAD not in text
    assert "قائمة الدخل (شهري + إجمالي الفترة)" in text and "قائمة الدخل 2026 (" in text
    assert "قائمة الدخل الشهرية\nيوليو 2025 – ديسمبر 2025\n" in pg.inner_text("body")
    assert pg.errors == []
    pg.close()


def test_a_failing_section_does_not_break_the_app(browser):
    pg = _page(browser)
    _open(pg, BI_HTML)
    pg.evaluate("() => { window.__abhApp.biStockBody = () => { throw new Error('test fault'); }; }")
    assert "تعذّر عرض هذا القسم (test fault)" in go(pg, "bi_stock")
    assert len(go(pg, "overview").strip()) > 40 and pg.errors == []
    pg.close()


def test_standard_cost_variance(page):
    """Monthly: variance = (statement COGS ratio − standard ratio) × net sales; months without a
    statement show «يحتاج بيانات». Per SKU only the standard margin at the invoiced price is shown."""
    text = go(page, "bi_std")
    z = page.evaluate("() => window.__abhApp.biStd(window.__abhApp.state.api.D)")
    assert z["linked"] >= 15 and z["months"]
    assert z["cons"] == []     # every flagged item is a sausage, now compared in the casing table
    by = {h["code"]: h for h in z["hank"]}
    for code in ("108", "99", "257"):                     # الهنا: the gap is the missing casing (paste weight aside)
        assert by[code]["status"] == "النموذج بلا هانك", by[code]
    for code in ("7", "107", "13"):                       # أبو هاشم: the model agrees with the standard
        assert by[code]["status"] == "متفق", by[code]
    for m in z["months"]:
        assert 0 < m["cov"] <= 1 and m["stdCogs"] > 0, m["month"]
        if m["actR"] is None:
            assert m["var"] is None
        else:
            assert m["var"] == pytest.approx((m["actR"] - m["stdR"]) * m["ns"]), m["month"]
    for s in z["sku"]:
        if s["price"] is not None:
            assert s["std_margin"] == pytest.approx((s["price"] - s["std"]) / s["price"])
    assert "لا تكلفة فعلية مستقلة لكل صنف" in text and "صفوف في الملف لم تُربط بصنف مبيعات" in text
    assert "قرارات الإدارة على ملف التكلفة المعيارية" in text and "234.68" in text
    assert "السجق: المعيار شامل الهانك مقابل نموذج الربحية" in text and "فحص اتساق" not in text
    if any(m["actR"] is None for m in z["months"]):
        assert "يحتاج بيانات" in text


def test_monthly_standard(page):
    """Beside the file standard: each linked pack at the month's recipe prices; the file standard
    and the monthly variance table above are unchanged."""
    text = go(page, "bi_std")
    z = page.evaluate("() => window.__abhApp.biStd(window.__abhApp.state.api.D)")
    q = z["mon"]
    assert q["list"] == ["2026-08", "2026-09"]
    sold = [m for m in q["months"] if m["rev"]]
    assert [m["month"] for m in sold] == ["2026-08"]          # the 04/09 snapshot has no September lines
    for m in sold:
        assert m["missing"] == 0
        assert m["fileR"] == pytest.approx(m["file"] / m["rev"]) and m["monR"] == pytest.approx(m["mon"] / m["rev"])
    assert "يحتاج بيانات" in text and "لحساب نسبة التكلفة بمعيار الشهر" in text
    for r in q["rows"]:
        for v in r["by"].values():
            assert v["std"] == pytest.approx(v["paste"] + v["casing"] + v["pack"], abs=1e-3)
    s = {r["code"]: r for r in q["singles"]}
    assert s["1"]["by"]["2026-09"]["std"] == pytest.approx(0.32 * 260.2402 + 6.25, abs=1e-3)
    assert s["2"]["by"]["2026-09"]["std"] == pytest.approx(0.34 * 168.6305 + 6.25, abs=1e-3)
    assert "المعيار الشهري: الوصفة بمتوسط سعر آخر الشهر" in text and "89.53" in text and "90.09" in text
    assert "2026-08" in {m["month"] for m in z["months"]}                # the existing table still lists it
    tabs = page.evaluate("() => window.__abhApp.exportTables().map(t => t.id)")
    assert "bi_std_monthly" in tabs


def test_income_2025_full_year(page):
    """12 months: January–May from the statement text, June «يحتاج بيانات», July–December as DASH_FS;
    March flagged; the 2025-vs-2026 rows add the same months the 2026 statements cover."""
    text = go(page, "fs_income")
    assert IS25_HEAD in text and text.index(IS25_HEAD) > 0         # inside «قائمة الدخل», after its own content
    z = page.evaluate("() => window.__abhApp.biIs25()")
    assert [r["month"] for r in z["rows"]] == [f"2025-{m:02d}" for m in range(1, 13)]
    by = {r["month"]: r for r in z["rows"]}
    assert by["2025-06"].get("need") and "net" not in by["2025-06"]
    assert by["2025-03"]["confirm"] and not by["2025-02"].get("confirm")
    fs = page.evaluate("() => window.DASH_FS.income")
    for m in ("2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12"):
        assert by[m]["net"] == fs[m]["net_sales"] and by[m]["np"] == fs[m]["net_profit_pre_dep"], m
    assert by["2025-01"]["np"] == pytest.approx(387739.27) and by["2025-05"]["net"] == pytest.approx(3073238.0)
    q1 = z["cmp"][0]
    assert q1["label"] == "الربع الأول" and q1["confirm"]
    assert q1["net25"] == pytest.approx(sum(by[m]["net"] for m in ("2025-01", "2025-02", "2025-03")))
    jun = next(c for c in z["cmp"] if c["m25"] == ["2025-06"])
    assert jun["net25"] is None
    assert "يحتاج بيانات" in text and "يحتاج تأكيد" in text and "2025 مقابل 2026" in text
    tabs = page.evaluate("() => window.__abhApp.exportTables().map(t => t.id)")
    assert "bi_is25" in tabs and "bi_is25_vs_26" in tabs


def test_income_merged(browser, page):
    """One statement Jan 2025 – Jul 2026 in place of the section's statement tables; every figure
    is its source's; June 2025 «يحتاج بيانات»; Q1 2026 the quarter split; ?nobi = the full file."""
    text = go(page, "fs_income")
    assert text.count(PL_HEAD) == 1 and text.index(PL_HEAD) < text.index(IS25_HEAD)
    for gone in ("قائمة الدخل (شهري + إجمالي الفترة)", "قائمة الدخل 2026 (", "قائمة الدخل الشهرية — 2025\n"):
        assert gone not in text, gone
    assert "2025 مقابل 2026" in text and "بنود المصروفات الإدارية" in text and "سيناريو التكلفة والسعر" in text
    assert page.locator("[data-bi-pl]").count() == 1
    chip = page.inner_text("body")                                     # the period chip, above the scroll area
    assert "قائمة الدخل الشهرية\nيناير 2025 – يوليو 2026\n" in chip
    P = page.evaluate("() => window.__abhApp.biPl()")
    months = [c["m"] for c in P["cols"]]
    assert months == [f"2025-{m:02d}" for m in range(1, 13)] + [f"2026-{m:02d}" for m in range(1, 8)]
    by = {c["m"]: c for c in P["cols"]}
    assert by["2025-06"].get("need") and by["2025-03"]["warn"]
    I25 = page.evaluate("() => window.DASH_IS25")
    for r in I25["months"]:
        assert by[r["month"]]["v"]["net"] == r["net_sales"] and by[r["month"]]["v"]["np"] == r["net_profit"]
    fs = page.evaluate("() => window.DASH_FS.income")
    for m in ("2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12"):
        v = by[m]["v"]
        assert (v["net"], v["ebitda"], v["np"], v["npa"]) == (fs[m]["net_sales"], fs[m]["ebitda"],
                                                             fs[m]["net_profit_pre_dep"], fs[m]["net_profit_after_dep"]), m
    P26 = {p["period"]: p for p in page.evaluate("() => window.DASH_IS26.periods")}
    q1 = [by[m] for m in ("2026-01", "2026-02", "2026-03")]
    assert all(c["est"] for c in q1)
    for k, src in (("net", "net_sales"), ("gp", "gross_profit"), ("np", "net_profit")):
        assert sum(c["v"][k] for c in q1) == pytest.approx(P26["2026-Q1"][src])
    for m in ("2026-04", "2026-05", "2026-06", "2026-07"):
        assert by[m]["v"]["net"] == P26[m]["net_sales"] and by[m]["v"]["np"] == P26[m]["net_profit"] and not by[m].get("est")
    rows = {r["k"]: r for r in P["rows"]}
    assert rows["net"]["tots"][0]["v"] == pytest.approx(sum(r["net_sales"] for r in I25["months"]) + sum(fs[m]["net_sales"] for m in fs))
    assert rows["net"]["tots"][1]["v"] == pytest.approx(sum(p["net_sales"] for p in P26.values()))
    assert rows["ebitda"]["tots"][0]["part"] and rows["ebm"]["tots"][0]["v"] is None   # January 2025 prints no split
    assert "4,784,135" in text and "2,861,343" in text and "يحتاج بيانات" in text and "تقدير" in text
    tabs = page.evaluate("() => window.__abhApp.exportTables().map(t => t.id)")
    assert "bi_pl_2025_2026" in tabs
    full, off = _page(browser), _page(browser)
    _open(full, FULL_HTML)
    _open(off, BI_HTML, "?nobi")
    assert go(off, "fs_income") == go(full, "fs_income")
    assert full.errors == [] and off.errors == [] and page.errors == []
    full.close()
    off.close()


def test_abohashem_main_section(page):
    """The zip's code results, labelled as the June snapshot; every tie-out holds."""
    text = go(page, "bi_abm")
    a = page.evaluate("() => window.DASH_ABM")
    assert a["enabled"] and all(c["ok"] for c in a["checks"])
    assert "لقطة يونيو 2026 من ملف Abohashem-main.zip" in text and "تشغيل الأكواد" in text and "المطابقات" in text
    assert "3,376,570" in text or "3.38" in text
    tabs = page.evaluate("() => window.__abhApp.exportTables().map(t => t.id)")
    assert {"bi_abm_runs", "bi_abm_salespeople", "bi_abm_aging"} <= set(tabs)


def test_ar_history_section(page):
    """Balances as printed: a missing report is «يحتاج بيانات», never carried forward; the partial
    totals say so; the roll-forward rows add up; each gap row carries its pattern."""
    text = go(page, "bi_arh")
    h = page.evaluate("() => window.DASH_ARH")
    assert "يحتاج بيانات" in text and "جزئي" in text and "مطابقة حركة المديونية" in text and "أنماط الفجوات" in text
    for r in h["reps"]:
        for d, v in r["by_date"].items():
            if v is None:
                assert d in [t["date"] for t in h["totals"] if not t["complete"]]
    for p in h["rollforward"]["periods"]:
        t = p["totals"]
        assert t["opening"] + t["sales"] - t["receipts"] - t["returns"] + t["gap"] == pytest.approx(t["closing"], abs=0.05)
        assert all(g.get("pattern") for g in p["gaps"])
    full = [t for t in h["totals"] if t["complete"]][-1]
    assert full["date"] == "2026-07-25" and full["net"] == pytest.approx(3835132.67)
    tabs = page.evaluate("() => window.__abhApp.exportTables().map(t => t.id)")
    assert {"bi_ar_history", "bi_ar_rollforward", "bi_ar_gaps"} <= set(tabs)


def test_recipes_section(page):
    """The sheets as printed; links as management confirmed them, each with its recipe margin;
    no sheet → «يحتاج بيانات»."""
    text = go(page, "bi_recipes")
    c = page.evaluate("() => window.DASH_RCP")
    assert "49.12" in text and "54.43" in text and "130.74" in text and "65.33" in text
    assert "مؤكد — قرار الإدارة 27/10/2026" in text and "هامش الوصفة" in text and "عمولة البيع (مصروف بيعي)" in text
    assert "هامش بعد العمولة" not in text and "التكلفة قبل العمولة" not in text   # commission is never in a cost
    assert "يحتاج بيانات" in text and "عجينة بقري" in text
    for x in c["candidates"]:
        for i in x["items"]:
            if i["status"].startswith("مؤكد"):
                assert f"{i['margin']:.2f}" in text or f"({abs(i['margin']):.2f})" in text, i["code"]
    assert "42.55" in text and "112.90" in text and "140.32" in text and "قرار الإدارة: 51.86 × 0.7" in text
    assert "هامش سالب: استربس الهنا 1 كيلو" in text                     # sold at 100/kg against 140.32
    tabs = page.evaluate("() => window.__abhApp.exportTables().map(t => t.id)")
    assert {"bi_recipes", "bi_recipe_packs", "bi_recipe_candidates"} <= set(tabs)
