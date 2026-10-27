#!/usr/bin/env python3
"""Stage 4: «ذكاء الأعمال» on top of the full mobile dashboard — the approved file.

Reads
  mobile/Abu_Hashem_Mobile_full.html   output of enrich_mobile.py, kept as is
  mobile/patch/bi_methods.js           the new App methods
and writes mobile/Abu_Hashem_Mobile_bi.html, the file management approved as the one
dashboard (26/10/2026); full.html is never written and stays its tested base.

Insertion-only, like stages 1–3: strip the declared insertions from the output and
the full file is what remains (tests/test_bi_mobile.py checks it). Three datasets are
added, each its committed JSON as is: DASH_STD (standard costs), DASH_IS25 (January–May
2025 statements, src/income_2025h1.py) and DASH_ABM (the results of Abohashem-main.zip,
src/abohashem_main.py); the rest is read from what the full file already embeds
(DASH_MARGIN, DASH_OPS, DASH_FS, DASH_IS26, DASH_BUILD and the sales snapshots). Added:

  * a nav group «ذكاء الأعمال» with five sections — executive summary and data
    freshness, profit bridge (price / cost / volume-mix, contribution margin,
    break-even), inventory turnover / dead stock / reconciliation, a unified alert
    register (indicator, actual, threshold, deviation, cause tagged verified or
    hypothesis, action, owner role, status kept on the device), and a KPI
    dictionary with automatic checks plus the data each blocked module needs;
    then «التكلفة المعيارية», «قوائم الدخل 2025» (12 months, June «يحتاج بيانات», and
    2025 against the same 2026 months) and «تحليل Abohashem-main» (the zip's scripts
    run, their tie-outs, salespeople, aging, maturities, items — a June 2026 snapshot).
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

SECTIONS = ("bi_exec", "bi_bridge", "bi_stock", "bi_std", "bi_is25", "bi_abm", "bi_alerts", "bi_kpis")


def js(o) -> str:
    return json.dumps(o, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")


def data_scripts(std: dict | None, is25: dict | None, abm: dict | None) -> str:
    out = ""
    if std:
        out += f"<script>/* التكلفة المعيارية — bi_mobile.py */\nwindow.DASH_STD = {js(std)};</script>\n"
    if is25:
        out += f"<script>/* قوائم الدخل 2025 — src/income_2025h1.py */\nwindow.DASH_IS25 = {js(is25)};</script>\n"
    if abm:
        out += f"<script>/* Abohashem-main.zip — src/abohashem_main.py */\nwindow.DASH_ABM = {js(abm)};</script>\n"
    return out


def edits(methods: str, std: dict | None = None, is25: dict | None = None, abm: dict | None = None):
    """(name, before, after, text): `text` goes between `before` and `after`,
    which must occur together exactly once in the full file."""
    return [
        ("data-bi", "", '<script type="application/json" id="snap-index">', data_scripts(std, is25, abm)),
        ("registry-bi", '      p:"كل قاعدة وعدد ما أثّرت عليه · مطابقة الإجماليات بالمصدر · ما لم يُربط"});\n', "    return out;\n",
         "\n"
         "    /* ذكاء الأعمال — الملف المعتمد (bi_mobile.py). ?nobi في الرابط يخفي المجموعة. */\n"
         "    if(!/[?&#]nobi\\b/.test(String(location.search)+String(location.hash))){\n"
         "      const G2=\"ذكاء الأعمال\";\n"
         '      push(G2,"dash","bi_exec",{label:"الملخص التنفيذي",h2:"الملخص التنفيذي وحداثة البيانات",\n'
         '        p:"أحدث المؤشرات المُتحقَّقة · تاريخ كل مجال بيانات · ما حرّك صافي الربح · أعلى التنبيهات"});\n'
         '      push(G2,"dash","bi_bridge",{label:"جسر الربح",h2:"جسر الربح — السعر والكمية والتكلفة",\n'
         '        p:"جسر صافي الربح بين شهرين من القوائم · أثر السعر والتكلفة والمزيج بالصنف · نقطة التعادل"});\n'
         '      push(G2,"dash","bi_stock",{label:"دوران المخزون والراكد",h2:"المخزون — الدوران والراكد والمطابقة",\n'
         '        p:"أيام المخزون حيث توجد قائمة دخل · الخامات الراكدة والبطيئة · مطابقة التقييم · تكلفة الكيلو"});\n'
         '      if(window.DASH_STD)\n'
         '        push(G2,"dash","bi_std",{label:"التكلفة المعيارية",h2:"التكلفة المعيارية مقابل الفعلية",\n'
         '          p:"معيار العبوة من «سعر انتاج تام» · الانحراف عن قائمة الدخل شهريًا · كل صنف في يونيو 2026"});\n'
         '      if(window.DASH_IS25)\n'
         '        push(G2,"dash","bi_is25",{label:"قوائم الدخل 2025",h2:"قوائم الدخل 2025 كاملة",\n'
         '          p:"12 شهرًا: يناير–مايو من نص القوائم · يونيو يحتاج بيانات · يوليو–ديسمبر المعتمدة · مقارنة بنفس أشهر 2026"});\n'
         '      if(window.DASH_ABM&&window.DASH_ABM.enabled)\n'
         '        push(G2,"dash","bi_abm",{label:"تحليل Abohashem-main",h2:"تحليل Abohashem-main — لقطة يونيو 2026",\n'
         '          p:"تشغيل أكواد الملف المضغوط · المناديب والمديونية · أعمار الديون · المستحق خلال شهر · الأصناف · نموذج التسعير"});\n'
         '      push(G2,"dash","bi_alerts",{label:"سجل التنبيهات",h2:"سجل التنبيهات الموحد",\n'
         '        p:"القيمة والحد والانحراف والسبب والإجراء والمسؤول والحالة لكل تنبيه"});\n'
         '      push(G2,"dash","bi_kpis",{label:"قاموس المؤشرات",h2:"قاموس المؤشرات وجاهزية البيانات",\n'
         '        p:"المصدر والمعادلة والتاريخ والفحص لكل مؤشر · ما ينقص لكل وحدة لم تُبن"});\n'
         "    }\n"),
        ("nav-note-bi", '      "قرارات وتشغيل":"المخزون · المشتريات · رأس المال العامل · شرائح العملاء · المندوبون · المحاكي · التقييم",\n', "",
         '      "ذكاء الأعمال":"الملخص · جسر الربح · دوران المخزون · التكلفة المعيارية · قوائم 2025 · Abohashem-main · سجل التنبيهات · قاموس المؤشرات",\n'),
        ("section-bi", '    if(s.slice(0,4)==="ops_"||s.slice(0,4)==="dec_"||s==="dq_clean") return this.opsSectionBody(s,X,T,api)||[];\n', "",
         '    if(s.slice(0,3)==="bi_") return this.biSectionBody(s,X,T,api)||[];\n'),
        ("export-bi", "    this.opsExport(out,col,num);\n", "",
         "    this.biExport(out,col,num);\n"),
        ("repgroup-bi", '      ["dq","جودة وتنظيف","#64748b",id=>/^dq_/.test(id)],\n', "",
         '      ["bi","ذكاء الأعمال","#14b8a6",id=>/^bi_/.test(id)],\n'),
        ("methods", "", "  buildRepo(){\n", methods),
    ]


def merge(original: str, methods: str, std: dict | None = None, is25: dict | None = None, abm: dict | None = None):
    """Return (bi_html, insertions) where insertions are (offset_in_output, text)."""
    found = []
    for name, before, after, text in edits(methods, std, is25, abm):
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
    return original, merge(original, methods, load(STD_JSON), load(IS25_JSON), load(ABM_JSON))


def main():
    _original, (out, ins) = build()
    OUT_HTML.write_text(out, encoding="utf-8")
    print(f"wrote {OUT_HTML.relative_to(APP)} — {len(out)/1e6:.1f} MB, {len(ins)} insertions")


if __name__ == "__main__":
    main()
