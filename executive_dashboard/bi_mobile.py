#!/usr/bin/env python3
"""Stage 4: «ذكاء الأعمال» on top of the full mobile dashboard — the approved file.

Reads
  mobile/Abu_Hashem_Mobile_full.html   output of enrich_mobile.py, kept as is
  mobile/patch/bi_methods.js           the new App methods
and writes mobile/Abu_Hashem_Mobile_bi.html, the file management approved as the one
dashboard (26/10/2026); full.html is never written and stays its tested base.

Insertion-only, like stages 1–3: strip the declared insertions from the output and
the full file is what remains (tests/test_bi_mobile.py checks it). Five datasets are
added, each its committed JSON as is: DASH_STD (standard costs), DASH_IS25 (January–May
2025 statements, src/income_2025h1.py), DASH_ABM (the results of Abohashem-main.zip,
src/abohashem_main.py), DASH_ARH (the representatives' printed customer balances on six
dates and their roll-forward, src/ar_history.py) and DASH_RCP (the panée / strips / soya
recipe sheets, src/recipes.py); the rest is read from what the full file already embeds
(DASH_MARGIN, DASH_OPS, DASH_FS, DASH_IS26, DASH_BUILD and the sales snapshots). Added:

  * a nav group «ذكاء الأعمال», opened by «دليل اللوحة» — every section in seven functional
    groups with its data source and date and the filters that apply to it (measured, and
    checked by tests/test_browser_bi.py); the original navigation is unchanged. Then five
    sections — executive summary and data
    freshness, profit bridge (price / cost / volume-mix, contribution margin,
    break-even), inventory turnover / dead stock / reconciliation, a unified alert
    register (indicator, actual, threshold, deviation, cause tagged verified or
    hypothesis, action, owner role, status kept on the device), and a KPI
    dictionary with automatic checks plus the data each blocked module needs;
    then «التكلفة المعيارية», «تاريخ المديونية» (the printed balances by representative,
    missing reports «يحتاج بيانات», and the customer roll-forward with its gaps),
    «وصفات البانيه والاستربس» (the recipe sheets, pack cost with packaging — the
    commission is a selling expense, never in a cost —, candidate sales items «يحتاج تأكيد الربط») and «تحليل Abohashem-main»
    (the zip's scripts run, their tie-outs, salespeople, aging, maturities, items — a
    June 2026 snapshot).
  * inside the existing «قائمة الدخل» section of «القوائم المالية»: one income statement,
    January 2025 – July 2026 (June 2025 «يحتاج بيانات», January–March 2026 the quarter split
    by sales weight «تقدير»), in place of the section's July–December 2025 and 2026 tables,
    then the 2025 tiles, notes and 2025-against-2026 table — management, 27/10/2026. With
    ?nobi the section is the full file's, unchanged; its period chip reads the same span.
  * their tables in «التقارير» and the Excel export, under their own group.
  * a kill switch: opening the file with ?nobi (or #nobi) hides the group.

Usage: python3 bi_mobile.py      (run enrich_mobile.py first)
"""
import json
from pathlib import Path

from enhance_mobile import themed_methods

APP = Path(__file__).resolve().parent
MOB = APP / "mobile"
SRC_HTML = MOB / "Abu_Hashem_Mobile_full.html"
OUT_HTML = MOB / "Abu_Hashem_Mobile_bi.html"
METHODS = MOB / "patch" / "bi_methods.js"

STD_JSON = APP.parent / "data" / "processed" / "standard_cost.json"
IS25_JSON = APP.parent / "data" / "processed" / "income_2025h1.json"
ABM_JSON = APP.parent / "data" / "processed" / "abohashem_main.json"
ARH_JSON = APP.parent / "data" / "processed" / "ar_history.json"
RCP_JSON = APP.parent / "data" / "processed" / "recipes.json"

SECTIONS = ("bi_map", "bi_exec", "bi_bridge", "bi_stock", "bi_std", "bi_arh", "bi_recipes", "bi_abm", "bi_alerts", "bi_kpis")


def js(o) -> str:
    return json.dumps(o, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")


def data_scripts(std: dict | None, is25: dict | None, abm: dict | None, arh: dict | None = None,
                 rcp: dict | None = None) -> str:
    out = ""
    if std:
        out += f"<script>/* التكلفة المعيارية — bi_mobile.py */\nwindow.DASH_STD = {js(std)};</script>\n"
    if is25:
        out += f"<script>/* قوائم الدخل 2025 — src/income_2025h1.py */\nwindow.DASH_IS25 = {js(is25)};</script>\n"
    if abm:
        out += f"<script>/* Abohashem-main.zip — src/abohashem_main.py */\nwindow.DASH_ABM = {js(abm)};</script>\n"
    if arh:
        out += f"<script>/* تاريخ المديونية — src/ar_history.py */\nwindow.DASH_ARH = {js(arh)};</script>\n"
    if rcp:
        out += f"<script>/* وصفات البانيه والاستربس — src/recipes.py */\nwindow.DASH_RCP = {js(rcp)};</script>\n"
    return out


def edits(methods: str, std: dict | None = None, is25: dict | None = None, abm: dict | None = None,
          arh: dict | None = None, rcp: dict | None = None):
    """(name, before, after, text): `text` goes between `before` and `after`,
    which must occur together exactly once in the full file."""
    return [
        ("data-bi", "", '<script type="application/json" id="snap-index">', data_scripts(std, is25, abm, arh, rcp)),
        ("registry-bi", '      p:"كل قاعدة وعدد ما أثّرت عليه · مطابقة الإجماليات بالمصدر · ما لم يُربط"});\n', "    return out;\n",
         "\n"
         "    /* ذكاء الأعمال — الملف المعتمد (bi_mobile.py). ?nobi في الرابط يخفي المجموعة. */\n"
         "    if(!/[?&#]nobi\\b/.test(String(location.search)+String(location.hash))){\n"
         "      const G2=\"ذكاء الأعمال\";\n"
         '      push(G2,"dash","bi_map",{label:"دليل اللوحة",h2:"دليل اللوحة — الأقسام في سبع مجموعات",\n'
         '        p:"كل قسم في مجموعته الوظيفية · مصدره وتاريخ بياناته · الفلاتر التي تنطبق عليه · القائمة الأصلية كما هي"});\n'
         '      push(G2,"dash","bi_exec",{label:"الملخص التنفيذي",h2:"الملخص التنفيذي وحداثة البيانات",\n'
         '        p:"أحدث المؤشرات المُتحقَّقة · تاريخ كل مجال بيانات · ما حرّك صافي الربح · أعلى التنبيهات"});\n'
         '      push(G2,"dash","bi_bridge",{label:"جسر الربح",h2:"جسر الربح — السعر والكمية والتكلفة",\n'
         '        p:"جسر صافي الربح بين شهرين من القوائم · أثر السعر والتكلفة والمزيج بالصنف · نقطة التعادل"});\n'
         '      push(G2,"dash","bi_stock",{label:"دوران المخزون والراكد",h2:"المخزون — الدوران والراكد والمطابقة",\n'
         '        p:"أيام المخزون حيث توجد قائمة دخل · الخامات الراكدة والبطيئة · مطابقة التقييم · تكلفة الكيلو"});\n'
         '      if(window.DASH_STD)\n'
         '        push(G2,"dash","bi_std",{label:"التكلفة المعيارية",h2:"التكلفة المعيارية مقابل الفعلية",\n'
         '          p:"معيار العبوة من «سعر انتاج تام» · الانحراف عن قائمة الدخل شهريًا · كل صنف في يونيو 2026"});\n'
         '      if(window.DASH_ARH)\n'
         '        push(G2,"dash","bi_arh",{label:"تاريخ المديونية",h2:"تاريخ المديونية ومطابقة حركتها",\n'
         '          p:"أرصدة العملاء كما طبعتها تقارير المناديب في ستة تواريخ · رصيد أول + فواتير − تحصيلات − مرتجعات مقابل الرصيد المطبوع"});\n'
         '      if(window.DASH_RCP)\n'
         '        push(G2,"dash","bi_recipes",{label:"وصفات البانيه والاستربس",h2:"وصفات البانيه والاستربس والصويا",\n'
         '          p:"أوراق الخلطة 28/8/2026 كما طُبعت · تكلفة الكيلو والعبوة · العمولة مصروف بيعي خارج التكلفة · ربط الأصناف بقرار الإدارة"});\n'
         '      if(window.DASH_ABM&&window.DASH_ABM.enabled)\n'
         '        push(G2,"dash","bi_abm",{label:"تحليل Abohashem-main",h2:"تحليل Abohashem-main — لقطة يونيو 2026",\n'
         '          p:"تشغيل أكواد الملف المضغوط · المناديب والمديونية · أعمار الديون · المستحق خلال شهر · الأصناف · نموذج التسعير"});\n'
         '      push(G2,"dash","bi_alerts",{label:"سجل التنبيهات",h2:"سجل التنبيهات الموحد",\n'
         '        p:"القيمة والحد والانحراف والسبب والإجراء والمسؤول والحالة لكل تنبيه"});\n'
         '      push(G2,"dash","bi_kpis",{label:"قاموس المؤشرات",h2:"قاموس المؤشرات وجاهزية البيانات",\n'
         '        p:"المصدر والمعادلة والتاريخ والفحص لكل مؤشر · ما ينقص لكل وحدة لم تُبن"});\n'
         "    }\n"),
        ("nav-note-bi", '      "قرارات وتشغيل":"المخزون · المشتريات · رأس المال العامل · شرائح العملاء · المندوبون · المحاكي · التقييم",\n', "",
         '      "ذكاء الأعمال":"دليل اللوحة · الملخص · جسر الربح · دوران المخزون · التكلفة المعيارية · تاريخ المديونية · الوصفات · Abohashem-main · سجل التنبيهات · قاموس المؤشرات",\n'),
        ("section-bi", '    if(s.slice(0,4)==="ops_"||s.slice(0,4)==="dec_"||s==="dq_clean") return this.opsSectionBody(s,X,T,api)||[];\n', "",
         '    if(s.slice(0,3)==="bi_") return this.biSectionBody(s,X,T,api)||[];\n'),
        ("income-chip-bi", '      : s==="fs_quality"?"كل الفترات"\n', "      : span;\n",
         '      : s==="fs_income"&&this.biPlOn(F)?this.biPlSpan()\n'),
        ("income25-bi", "    else body=this.fsExec(F,T);\n", '    body=[React.createElement("div",{key:"sub"',
         '    if(s==="fs_income") body=this.biIncomeMerged(body,F,T);\n'),
        ("export-bi", "    this.opsExport(out,col,num);\n", "",
         "    this.biExport(out,col,num);\n"),
        ("repgroup-bi", '      ["dq","جودة وتنظيف","#64748b",id=>/^dq_/.test(id)],\n', "",
         '      ["bi","ذكاء الأعمال","#14b8a6",id=>/^bi_/.test(id)],\n'),
        ("methods", "", "  buildRepo(){\n", methods),
    ]


def merge(original: str, methods: str, std: dict | None = None, is25: dict | None = None, abm: dict | None = None,
          arh: dict | None = None, rcp: dict | None = None):
    """Return (bi_html, insertions) where insertions are (offset_in_output, text)."""
    found = []
    for name, before, after, text in edits(methods, std, is25, abm, arh, rcp):
        needle = before + after
        n = original.count(needle)
        assert n == 1, f"anchor {name!r} found {n} times (expected exactly 1)"
        found.append((original.index(needle) + len(before), text))
    found.sort(key=lambda x: x[0])
    out, ins, prev, shift = [], [], 0, 0
    for pos, text in found:
        out.append(original[prev:pos])
        ins.append((pos + shift, text))
        out.append(text)
        shift += len(text)
        prev = pos
    out.append(original[prev:])
    return "".join(out), ins


def build():
    original = SRC_HTML.read_text(encoding="utf-8")
    methods = themed_methods(METHODS.read_text(encoding="utf-8"))
    load = lambda p: json.loads(p.read_text(encoding="utf-8")) if p.exists() else None  # noqa: E731
    return original, merge(original, methods, load(STD_JSON), load(IS25_JSON), load(ABM_JSON), load(ARH_JSON),
                           load(RCP_JSON))


def main():
    _original, (out, ins) = build()
    OUT_HTML.write_text(out, encoding="utf-8")
    print(f"wrote {OUT_HTML.relative_to(APP)} — {len(out)/1e6:.1f} MB, {len(ins)} insertions")


if __name__ == "__main__":
    main()
