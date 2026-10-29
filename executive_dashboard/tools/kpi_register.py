#!/usr/bin/env python3
"""KPI register (docs/KPI_REGISTER.md): every KPI of the approved file with its formula,
the function that computes it, its source, its export table, the tests that check it and
its approval status — the reference the dashboard plan of 27/10/2026 starts from.

Generated, never hand-edited, so it cannot drift from the code:
  * the approved file (mobile/Abu_Hashem_Mobile_bi.html) is opened in Chromium and its own
    catalogues are read — the «قاموس المؤشرات» rows (biKpiRows → bi_kpi_catalog), the
    financial-statements dictionary (DASH_FS.kpi_dictionary → fs_dict), the section registry
    and the export catalogue;
  * KPIs those catalogues do not list are declared once in EXTRA below, each naming the
    function that computes it and the export table that carries it;
  * the tests are found by searching tests/*.py for the export table id inside each test
    function; a KPI no test touches is listed «بلا اختبار مطابقة», never as verified.

Values and dates are left out on purpose: they move with every data refresh, the definitions
do not. Four statuses, mapped from the tags the dashboard already shows (not renamed there):
  مُتحقَّق → فعلي معتمد · يحتاج مراجعة/تأكيد → فعلي يحتاج مراجعة · تقدير/افتراض → تقديري ·
  يحتاج بيانات → غير متاح.

    python3 tools/kpi_register.py            # write docs/KPI_REGISTER.md
    python3 tools/kpi_register.py --check    # exit 1 if the committed register is stale
"""
import ast
import re
import sys
from pathlib import Path

APP = Path(__file__).resolve().parent.parent
BI_HTML = APP / "mobile" / "Abu_Hashem_Mobile_bi.html"
OUT = APP / "docs" / "KPI_REGISTER.md"
TESTS = APP / "tests"

APPROVED, REVIEW, ESTIMATE, MISSING = "فعلي معتمد", "فعلي يحتاج مراجعة", "تقديري", "غير متاح"
STATUS = {"مُتحقَّق": APPROVED, "تقدير": ESTIMATE, "افتراض": ESTIMATE, "يحتاج بيانات": MISSING}

FIND_APP = """() => {
  const root = document.getElementById('root');
  const key = Object.keys(root).find(k => k.startsWith('__reactContainer'));
  const seen = new Set(), stack = [root[key]];
  while (stack.length) {
    const f = stack.pop();
    if (!f || seen.has(f)) continue;
    seen.add(f);
    if (f.stateNode && typeof f.stateNode.registry === 'function') { window.__abhApp = f.stateNode; return true; }
    stack.push(f.child, f.sibling);
  }
  return false;
}"""

# KPIs of the approved file that neither catalogue lists. One entry per KPI:
# (id, name, section, formula, function, source, export table, status, missing data).
EXTRA = [
    ("pl_net_sales", "صافي المبيعات الشهري (يناير 2025 – يوليو 2026)", "fs_income", "كما في قائمة دخل كل شهر",
     "biPl", "DASH_IS25 · DASH_FS.income · DASH_IS26", "bi_pl_2025_2026",
     f"{APPROVED} (يوليو–ديسمبر 2025، أبريل–يوليو 2026) · {REVIEW} (يناير–مايو 2025: نص PDF، ومارس يحتاج تأكيدًا) · "
     f"{ESTIMATE} (يناير–مارس 2026: توزيع الربع) · {MISSING} (يونيو 2025)",
     "قائمة دخل يونيو 2025؛ ملفات PDF لقوائم يناير–مايو 2025؛ قوائم شهرية ليناير–مارس 2026"),
    ("pl_gross_profit", "مجمل الربح وهامشه — شهري", "fs_income", "صافي المبيعات − تكلفة المبيعات؛ الهامش = المجمل ÷ صافي المبيعات",
     "biPl", "DASH_IS25 · DASH_FS.income · DASH_IS26", "bi_pl_2025_2026", "حسب الشهر كصافي المبيعات", "كصافي المبيعات"),
    ("pl_ebitda", "EBITDA وهامشه — شهري", "fs_income",
     "مجمل الربح − التشغيلية − الإدارية − البيعية؛ «—» حيث لا تقسم القائمة مصروفاتها (يناير 2025)",
     "biPl", "DASH_IS25 · DASH_FS.income · DASH_IS26", "bi_pl_2025_2026", "حسب الشهر كصافي المبيعات",
     "تقسيم مصروفات يناير 2025 إلى إدارية وبيعية"),
    ("pl_net_profit", "صافي الربح قبل الإهلاك وبعده — شهري", "fs_income",
     "كما في القائمة؛ الإهلاك مطبوع في قوائم يوليو–ديسمبر 2025 فقط (محمّل في ديسمبر)",
     "biPl", "DASH_IS25 · DASH_FS.income · DASH_IS26", "bi_pl_2025_2026", "حسب الشهر كصافي المبيعات",
     "الإهلاك في قوائم 2026 ويناير–مايو 2025"),
    ("bridge_net_profit", "جسر صافي الربح بين شهرين", "bi_bridge",
     "صافي ربح الشهر الأول + Δ المبيعات − Δ التكلفة − Δ كل فئة مصروفات = صافي ربح الشهر الثاني",
     "biPnlBridge", "DASH_MARGIN.statements", "bi_bridge_pnl",
     f"{APPROVED} لشهرين مقيسين؛ {ESTIMATE} إن كان أحدهما موزعًا من ربع", "—"),
    ("bridge_items", "أثر السعر والتكلفة والكمية والمزيج بالصنف", "bi_bridge",
     "السعر = Σ ك1×(س1−س0) · التكلفة = −Σ ك1×(ت1−ت0) · الكمية والمزيج = Σ (ك1−ك0)×(س0−ت0) · الجديد والمتوقف منفصلان",
     "biItemBridge", "DASH_MARGIN.by_item_month", "bi_bridge_items",
     f"{APPROVED} للشهور الموثوقة في نموذج الربحية؛ {ESTIMATE} غيرها", "—"),
    ("breakeven_margin_of_safety", "هامش الأمان", "bi_bridge", "(صافي المبيعات − مبيعات التعادل) ÷ صافي المبيعات",
     "biBreakEven", "DASH_MARGIN.statements", "bi_breakeven", f"{ESTIMATE} (التكلفة متغيرة والمصروفات ثابتة: افتراض)",
     "تصنيف المصروفات إلى ثابتة ومتغيرة"),
    ("dead_stock_slow", "الخامات البطيئة", "bi_cost", "كمية الخامة لم تتغير بين آخر جردين مسعّرين ولا مشتريات لها في آخر شهر (الراكدة: ثابتة في كل الجرود منذ يوليو)", "biStock",
     "جرود المخزون المسعّرة", "bi_dead_stock", APPROVED, "—"),
    ("std_variance_sku", "الهامش المعياري بالصنف", "bi_cost", "(سعر البيع الفعلي − التكلفة المعيارية للعبوة) ÷ سعر البيع",
     "biStd", "سعر انتاج تام + بنود الفواتير", "bi_std_margin_sku", ESTIMATE, "ربط الأصناف غير المربوطة بالملف"),
    ("std_monthly", "المعيار الشهري (الوصفة بمتوسط آخر الشهر)", "bi_cost",
     "تكلفة الوصفة بمتوسط سعر الخامات آخر الشهر — بجوار معيار الملف لا بدلًا منه", "biStdMonthly",
     "wac الشهري + سعر انتاج تام", "bi_std_monthly", ESTIMATE, "ملف متوسط تكلفة لكل شهر"),
    ("cost_kilo_monthly", "كيلو الخلطة على مدار الشهور", "bi_cost",
     "الوصفات: كيلو ملف التقييم كل شهر (خامات مباشرة) · ورقة الخلطة في شهر تاريخها · المفروم والكبدة متوسط الخامة آخر الشهر",
     "biCostKilo", "DASH_OPS.inventory.recipes · DASH_RCP · DASH_STD.monthly.single", "bi_cost_kilo_monthly",
     f"{APPROVED} · {MISSING} لشهر بلا مصدر", "أوراق خلطة شهرية للبانيه والاستربس والصويا؛ متوسط اللحم والكبدة ليونيو ويوليو"),
    ("cost_std_vs_actual", "تكلفة المنتج التام — المعيار مقابل الفعلي", "bi_cost",
     "الفعلي للعبوة = المعيار × تكلفة مبيعات القائمة × تغطية الإيراد ÷ المعيارية للكميات مع البونص؛ الانحراف = الفعلي − المعيار",
     "biCostStd", "المعيار الشهري + ملف التقييم + قوائم الدخل + بنود الفواتير", "bi_cost_std_vs_actual",
     f"{ESTIMATE} (الفعلي توزيع، ومعيار يونيو ويوليو تقدير) · {MISSING} (أغسطس وسبتمبر: لا قائمة دخل)",
     "قوائم دخل أغسطس وسبتمبر 2026؛ تكلفة فعلية مستقلة بالصنف"),
    ("prod_bom", "كميات وصفات المنتجات", "bi_prod", "كما في ملف وصفات الإدارة وأوراق الخلطة — بلا أسعار",
     "biProd", "recipes_bom.json (tools/export_bom.py) · DASH_RCP · DASH_STD.monthly.single", "bi_prod_bom", APPROVED,
     "أوراق خلطة عجينة البقري وصويا 350"),
    ("ar_printed_balance", "المديونية بالمندوب كما طُبعت", "bi_arh", "مجموع أرصدة عملاء المندوب في تقريره المطبوع",
     "biArh", "تقارير المناديب PDF (data/raw/ar_balances)", "bi_ar_history",
     f"{APPROVED} (كل تقرير يطابق إجماليه المطبوع) · {MISSING} للتقارير الغائبة", "تقارير المناديب الغائبة في 4/7 و30/7 و2/9"),
    ("ar_rollforward_gap", "فجوة مطابقة حركة المديونية", "bi_arh",
     "الرصيد المطبوع − (رصيد أول + فواتير − تحصيلات − مرتجعات من لقطة 3/9)", "biArh",
     "ar_history.json + لقطة 3/9", "bi_ar_rollforward", APPROVED, "—"),
    ("recipe_pack_cost", "تكلفة العبوة من الوصفة", "bi_prod",
     "سعر الكيلو بإضافاته × الوزن + التغليف — بلا عمولة (مصروف بيعي)", "biRecipesBody (src/recipes.py)",
     "أوراق الخلطة 28/8/2026 + قرار الإدارة 27/10/2026", "bi_recipe_packs", APPROVED, "أوراق خلطة عجينة البقري وصويا 350"),
    ("recipe_margin", "هامش الوصفة للصنف", "bi_prod", "سعر بيع أغسطس 2026 − تكلفة العبوة؛ العمولة بجانبه لا داخله",
     "biRecipesBody (src/recipes.py)", "recipes.json + لقطة المبيعات", "bi_recipe_candidates",
     f"{APPROVED} للأصناف المؤكدة بقرار الإدارة · {MISSING} لما يحتاج تأكيد الربط", "تأكيد ربط الأصناف المتبقية"),
    ("recipe_selling_commission", "عمولة البيع (مصروف بيعي)", "bi_prod", "2.5% × سعر بيع الصنف — خارج أي تكلفة",
     "src/recipes.py link()", "قرار الإدارة 27/10/2026", "bi_recipe_candidates", APPROVED, "—"),
    ("abm_aging", "أعمار الديون — Abohashem-main", "bi_abm", "تشغيل analysis/aging.py من الملف المضغوط كما هو",
     "biAbmBody (src/abohashem_main.py)", "Abohashem-main.zip — لقطة يونيو 2026", "bi_abm_aging",
     f"{APPROVED} (لقطة تاريخية)", "—"),
]


def _pg():
    from playwright.sync_api import sync_playwright
    pw = sync_playwright().start()
    b = pw.chromium.launch()
    pg = b.new_page(viewport={"width": 390, "height": 844})
    pg.goto(BI_HTML.as_uri())
    pg.wait_for_selector('[data-print="scroll"]')
    assert pg.evaluate(FIND_APP), "App component not found"
    pg.wait_for_function("() => window.__abhApp.state.ready")
    return pw, b, pg


def read_app():
    pw, b, pg = _pg()
    try:
        return pg.evaluate("""() => {
          const A = window.__abhApp, D = A.state.api.D, T = A.state.T;
          return {
            catalog: A.biKpiRows(D, T).map(r => ({kpi: r.kpi, unit: r.unit, formula: r.formula, source: r.source,
                                                  period: r.period, status: r.status,
                                                  checked: /^(ناجح|فشل)/.test(String(r.check || ""))})),
            fsdict: ((window.DASH_FS || {}).kpi_dictionary || []).map(d => ({kpi: d.kpi, formula: d.formula,
                                                                              source: d.source, period: d.period})),
            registry: A.registry().map(s => ({group: s.group, key: s.key, label: s.label})),
            guide: Object.fromEntries(A.biMapRows().map(r => [r.key, r.group])),
            exports: A.exportTables().map(t => ({id: t.id, label: t.label}))};
        }""")
    finally:
        b.close()
        pw.stop()


def test_index():
    """{test name: source of the test function} for every tests/test_*.py."""
    out = {}
    for f in sorted(TESTS.glob("test_*.py")):
        src = f.read_text(encoding="utf-8")
        for node in ast.parse(src).body:
            if isinstance(node, ast.FunctionDef) and node.name.startswith("test_"):
                out[f"{f.name}::{node.name}"] = ast.get_source_segment(src, node) or ""
    return out


# A test that only checks a table is non-empty is not a matching test.
PRESENCE_ONLY = {"test_browser_bi.py::test_bi_tables_export"}
CATALOG_TEST = "test_kpi_register.py::test_catalog_checks_pass"
# The statements dictionary names KPIs in Arabic; its tests use the data keys.
FS_KEYS = {"هامش مجمل الربح": ["gross_margin"], "EBITDA": ["ebitda"], "صافي الربح قبل الإهلاك": ["net_profit_pre_dep"],
           "صافي الربح بعد الإهلاك": ["net_profit_after_dep"], "رأس المال العامل": ["working_capital"],
           "صافي الدين": ["net_debt"], "نسبة التداول": ["current_ratio"], "النسبة السريعة": ["quick_ratio"],
           "أيام التحصيل DSO": ["dso"], "أيام المخزون DIO": ["dio"], "أيام السداد DPO": ["dpo"],
           "دورة التحويل النقدي": ["ccc"], "التدفق النقدي التشغيلي": ["cfo"],
           "حركة جاري الشركاء/المسحوبات": ["equity_other_movements"]}


# Tests that reconcile a KPI without naming its table or Arabic name (they call its function), each
# read and confirmed to check that very number. Keyed by KPI name or EXTRA id.
TESTED_BY = {
    "أيام المخزون": ["test_browser_bi.py::test_stock_figures_trace_to_ops_data"],
    "خامات راكدة": ["test_browser_bi.py::test_stock_figures_trace_to_ops_data",
                    "test_kpi_register.py::test_slow_and_dead_stock_match_definition"],
    "انحراف التكلفة المعيارية": ["test_browser_bi.py::test_standard_cost_variance"],
    "مبيعات التعادل": ["test_kpi_register.py::test_breakeven_matches_definition"],
    "bridge_net_profit": ["test_browser_bi.py::test_profit_bridges_add_up"],
    "bridge_items": ["test_browser_bi.py::test_profit_bridges_add_up"],
    "breakeven_margin_of_safety": ["test_kpi_register.py::test_breakeven_matches_definition"],
    "dead_stock_slow": ["test_browser_bi.py::test_stock_figures_trace_to_ops_data",
                        "test_kpi_register.py::test_slow_and_dead_stock_match_definition"],
    "std_variance_sku": ["test_browser_bi.py::test_standard_cost_variance",
                         "test_kpi_register.py::test_standard_margin_per_sku_matches_definition"],
    "std_monthly": ["test_browser_bi.py::test_monthly_standard"],
    "cost_kilo_monthly": ["test_browser_bi.py::test_cost_kilo_monthly"],
    "cost_std_vs_actual": ["test_browser_bi.py::test_cost_std_vs_actual"],
}


def tests_for(table, names, keys, idx):
    """Tests whose body names the export table id, the KPI's Arabic name, or one of its data keys."""
    pats = [r'["\']' + re.escape(table) + r'["\']'] + [re.escape(n) for n in names if n] \
        + [r'["\']' + re.escape(k) + r'["\']' for k in keys]
    return [t for t, body in idx.items() if t not in PRESENCE_ONLY and any(re.search(p, body) for p in pats)]


def rows(app):
    out = []
    for r in app["catalog"]:
        out.append({"id": "", "name": r["kpi"], "section": "bi_kpis", "formula": r["formula"], "fn": "biKpiRows",
                    "checked": r["checked"],
                    # «قائمة الدخل يوليو 2026» names the latest month, which moves with the data.
                    "source": re.sub(r"^قائمة الدخل \S+ \d{4}$", "قائمة الدخل — آخر شهر مقيس", r["source"]) + " · " + r["period"],
                    "table": "bi_kpi_catalog",
                    "status": STATUS.get(r["status"], r["status"]),
                    "missing": "—" if r["status"] != "يحتاج بيانات" else r["source"]})
    for r in app["fsdict"]:
        out.append({"id": "", "name": r["kpi"], "section": "fs_quality", "formula": r["formula"],
                    "fn": "src/statements.py (kpi_dictionary) · fsQuality", "source": r["source"] + " · " + r["period"],
                    "table": "fs_dict", "status": APPROVED + " (القوائم المالية المعتمدة يوليو–ديسمبر 2025)", "missing": "—"})
    for i, name, sec, formula, fn, src, table, status, missing in EXTRA:
        out.append({"id": i, "key": i, "name": name, "section": sec, "formula": formula, "fn": fn, "source": src,
                    "table": table, "status": status, "missing": missing})
    for n, r in enumerate(out, 1):
        r["id"] = f"K{n:03d}" + (f" ({r['id']})" if r["id"] else "")
    return out


def esc(s):
    return str(s).replace("|", "\\|").replace("\n", " ")


def render(app):
    idx, rs = test_index(), rows(app)
    tables = {t["id"]: t["label"] for t in app["exports"]}
    labels = {s["key"]: s["label"] for s in app["registry"]}
    for r in rs:
        r["tests"] = tests_for(r["table"], [r["name"]] if r["table"] in ("bi_kpi_catalog", "fs_dict") else [],
                               FS_KEYS.get(r["name"], []) if r["table"] == "fs_dict" else [], idx)
        if r.get("checked"):
            r["tests"].append(CATALOG_TEST)
        for t in TESTED_BY.get(r.get("key") or r["name"], []):
            if t not in r["tests"]:
                r["tests"].append(t)
        assert r["table"] in tables, f"{r['name']}: export table {r['table']} not in the file"
        assert r["section"] in labels, f"{r['name']}: section {r['section']} not in the registry"
    levels = (APPROVED, REVIEW, ESTIMATE, MISSING)

    def level(st):
        """The one status a KPI has, or None when it differs by period (several levels named)."""
        found = [x for x in levels if x in st]
        return found[0] if len(found) == 1 else None
    for r in rs:
        r["level"] = level(r["status"])
    n = {x: sum(1 for r in rs if r["level"] == x) for x in levels}
    untested = [r for r in rs if not r["tests"] and r["level"] != MISSING]
    L = ["# سجل المؤشرات — KPI_REGISTER", "",
         "مولَّد من الملف المعتمد `mobile/Abu_Hashem_Mobile_bi.html` بـ `tools/kpi_register.py` — لا يُحرَّر يدويًا؛ "
         "`python3 tools/kpi_register.py --check` واختبار `tests/test_kpi_register.py` يفشلان إن اختلف عن الكود.", "",
         "القيم والتواريخ غير مسجلة هنا لأنها تتغير مع كل تحديث للبيانات؛ القيمة الحالية في قسم كل مؤشر وفي جدول تصديره.", "",
         "## الحالات", "",
         "| الحالة | المعنى | الوسم في اللوحة |", "|---|---|---|",
         f"| {APPROVED} | من مصدر مكتمل وتمت مطابقته | «مُتحقَّق» |",
         f"| {REVIEW} | المصدر موجود وعليه ملاحظة أو تأكيد معلّق | «يحتاج مراجعة» / «يحتاج تأكيد» |",
         f"| {ESTIMATE} | نتيجة طريقة أو افتراض معلن | «تقدير» / «افتراض» |",
         f"| {MISSING} | البيانات اللازمة غير موجودة | «يحتاج بيانات» |", "",
         f"**{len(rs)} مؤشرًا**: {APPROVED} {n[APPROVED]} · {REVIEW} {n[REVIEW]} · {ESTIMATE} {n[ESTIMATE]} · {MISSING} {n[MISSING]}"
         f" · يختلف حسب الفترة {len(rs) - sum(n.values())} · بلا اختبار مطابقة {len(untested)}.", "",
         "## المؤشرات", "",
         "| المعرّف | المؤشر | القسم | المعادلة | الدالة | المصدر | جدول التصدير | اختبارات المطابقة | الحالة | البيانات الناقصة |",
         "|---|---|---|---|---|---|---|---|---|---|"]
    for r in rs:
        t = "<br>".join(f"`{x}`" for x in r["tests"]) or ("لا يُحسب — " + MISSING if r["level"] == MISSING
                                                          else "بلا اختبار مطابقة")
        L.append("| " + " | ".join(esc(x) for x in (
            r["id"], r["name"], f"{labels[r['section']]} (`{r['section']}`)", r["formula"], f"`{r['fn']}`", r["source"],
            f"`{r['table']}`", t, r["status"], r["missing"])) + " |")
    # Coverage: every section of the registry, with its documented KPIs. Base sections with none are
    # the register's open work — named, not hidden.
    L += ["", "## التغطية بالقسم", "",
          f"كل أقسام اللوحة ({len(app['registry'])} قسمًا) وعدد مؤشراتها الموثقة هنا. القسم بلا مؤشر موثق لم يُستخرج "
          "تعريف مؤشراته بعد؛ أرقامه في اللوحة كما هي، لكنها خارج هذا السجل حتى تُوثَّق.", "",
          "المجموعة الوظيفية من «دليل اللوحة» (`biMapDef`)، و«في القائمة» مكان القسم في التنقل الأصلي.", "",
          "| المجموعة الوظيفية | في القائمة | القسم | المعرّف | مؤشرات موثقة |", "|---|---|---|---|---|"]
    guide = app["guide"]
    for s in app["registry"]:
        k = sum(1 for r in rs if r["section"] == s["key"])
        g = "دليل اللوحة نفسه" if s["key"] == "bi_map" else guide.get(s["key"], "لم يُصنَّف")
        L.append(f"| {esc(g)} | {esc(s['group'])} | {esc(s['label'])} | `{s['key']}` | {k if k else 'لم يُوثَّق بعد'} |")
    L += ["", "## بلا اختبار مطابقة", ""]
    L += [f"- {r['id']} {r['name']} (`{r['table']}`)" for r in untested] or ["- لا شيء."]
    return "\n".join(L) + "\n"


def main():
    text = render(read_app())
    if "--check" in sys.argv[1:]:
        old = OUT.read_text(encoding="utf-8") if OUT.exists() else ""
        if old != text:
            print(f"{OUT.relative_to(APP)} is stale — run python3 tools/kpi_register.py")
            sys.exit(1)
        print(f"{OUT.relative_to(APP)} up to date")
        return
    OUT.write_text(text, encoding="utf-8")
    print(f"wrote {OUT.relative_to(APP)} — {text.count(chr(10))} lines")


if __name__ == "__main__":
    main()
