#!/usr/bin/env python3
"""Stage 3: «قرارات وتشغيل» on top of the enhanced mobile dashboard.

Reads
  mobile/Abu_Hashem_Mobile_enhanced.html     output of enhance_mobile.py, kept as is
  mobile/patch/enrich_methods.js             the new App methods
  ../data/processed/ops_data.json            src/ops_ingest.py (inventory, purchases,
                                             suppliers, item-level returns, cleaning log)
  ../data/processed/valuation_scenarios.json results of the recalculated valuation model
and writes mobile/Abu_Hashem_Mobile_full.html.

Insertion-only, like stages 1 and 2: strip the declared insertions from the
output and the enhanced file is what remains (tests/test_enrich_mobile.py
checks it). Added:

  * window.DASH_OPS and window.DASH_VAL, embedded as data.
  * a nav group «قرارات وتشغيل» with eleven sections — inventory valuation and
    coverage, purchases and suppliers, cost pass-through, working capital,
    customer value/risk segments, rep scorecard, price leakage and bonus,
    returns, a price/cost/volume simulator, valuation and ratios, and the data
    cleaning log. Every section ends with a «القرار المقترح» card and tags each
    figure as verified / estimate / assumption.
  * their tables in «التقارير» and the Excel export.

Usage: python3 enrich_mobile.py      (run python3 -m src.ops_ingest first)
"""
import json
from pathlib import Path

from enhance_mobile import themed_methods

APP = Path(__file__).resolve().parent
MOB = APP / "mobile"
SRC_HTML = MOB / "Abu_Hashem_Mobile_enhanced.html"
OUT_HTML = MOB / "Abu_Hashem_Mobile_full.html"
METHODS = MOB / "patch" / "enrich_methods.js"
OPS_JSON = APP.parent / "data" / "processed" / "ops_data.json"
VAL_JSON = APP.parent / "data" / "processed" / "valuation_scenarios.json"


def data_script(ops: dict, val: dict) -> str:
    def js(o):
        return json.dumps(o, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    return ("<script>/* بيانات التشغيل ونتائج التقييم — enrich_mobile.py */\n"
            f"window.DASH_OPS = {js(ops)};\nwindow.DASH_VAL = {js(val)};</script>\n")


def edits(methods: str, ops: dict, val: dict):
    """(name, before, after, text): `text` goes between `before` and `after`,
    which must occur together exactly once in the enhanced file."""
    return [
        ("data", "", '<script type="application/json" id="snap-index">', data_script(ops, val)),
        ("registry-ops", '      p:"قواعد معلنة الحدود على المديونية والمبيعات والأسعار والفواتير"});\n', "    return out;\n",
         "\n"
         "    /* قرارات وتشغيل — بيانات التشغيل (DASH_OPS) والفواتير والقوائم ونموذج التقييم. */\n"
         "    const G=\"قرارات وتشغيل\";\n"
         "    if(window.DASH_OPS){\n"
         '      push(G,"dash","ops_inventory",{label:"المخزون",h2:"المخزون — التقييم والتغطية والركود",\n'
         '        p:"جرد 30/6 و31/7 بالقيمة · جرد 31/8 بالكمية · تغطية بالأيام من المبيعات"});\n'
         '      push(G,"dash","ops_purchases",{label:"المشتريات والموردون",h2:"المشتريات والموردون",\n'
         '        p:"مشتريات يوليو وأغسطس 2026 · تذبذب الأسعار · أرصدة الموردين 02/09"});\n'
         '      push(G,"dash","ops_costpass",{label:"تمرير التكلفة",h2:"تكلفة الخامات مقابل سعر البيع",\n'
         '        p:"سعر كيلو الوصفات يونيو ← يوليو مقابل أسعار البيع في الفواتير"});\n'
         '      push(G,"dash","ops_wc",{label:"رأس المال العامل 2026",h2:"رأس المال العامل 2026",\n'
         '        p:"العملاء + المخزون − الموردون · أيام الدورة النقدية مقابل 31/12/2025"});\n'
         "    }\n"
         '    push(G,"dash","dec_rfm",{label:"قيمة ومخاطر العملاء",h2:"شرائح العملاء — القيمة والمخاطر",\n'
         '      p:"الحداثة والتكرار والقيمة مع المديونية · لكل شريحة إجراء"});\n'
         '    push(G,"dash","dec_reps",{label:"أداء المندوبين",h2:"بطاقة أداء المندوبين",\n'
         '      p:"مبيعات · هامش · تحصيل · متأخر · مرتجعات · عملاء جدد — بأوزان معلنة"});\n'
         '    push(G,"dash","dec_leakage",{label:"تسرب السعر والبونص",h2:"تسرب السعر والبونص",\n'
         '      p:"البيع تحت السعر الوسيط للصنف في شهره · قيمة البونص · بنود السعر الصفري"});\n'
         '    push(G,"dash","dec_returns",{label:"المرتجعات",h2:"المرتجعات — بالصنف والمندوب والعميل",\n'
         '      p:"نسبة المرتجع من المبيعات · ملفات الصنف يوليو–أغسطس مطابقة للقطة"});\n'
         '    push(G,"dash","dec_whatif",{label:"محاكي القرار",h2:"محاكي السعر والتكلفة والكمية",\n'
         '      p:"أثر القرار على مجمل وصافي الربح من قوائم 2026 الفعلية"});\n'
         "    if(window.DASH_VAL)\n"
         '      push(G,"dash","dec_valuation",{label:"التقييم والنسب",h2:"نماذج التقييم والنسب المالية",\n'
         '        p:"DCF وLBO توضيحيان بثلاثة سيناريوهات · نطاقات الحساسية · نسب الميزانيات"});\n'
         '    push(G,"dash","dq_clean",{label:"سجل تنظيف البيانات",h2:"سجل تنظيف البيانات",\n'
         '      p:"كل قاعدة وعدد ما أثّرت عليه · مطابقة الإجماليات بالمصدر · ما لم يُربط"});\n'),
        ("nav-note-ops", '      "تحليلات متقدمة":"ABC · الموسمية · سلة المشتريات · الأفواج · التنبيهات",\n', "",
         '      "قرارات وتشغيل":"المخزون · المشتريات · رأس المال العامل · شرائح العملاء · المندوبون · المحاكي · التقييم",\n'),
        ("section-ops", '    if(s.slice(0,4)==="adv_") return this.advSectionBody(s,X,T,api)||[];\n', "",
         '    if(s.slice(0,4)==="ops_"||s.slice(0,4)==="dec_"||s==="dq_clean") return this.opsSectionBody(s,X,T,api)||[];\n'),
        ("export-ops", "    this.advExport(out,col,num);\n", "",
         "    this.opsExport(out,col,num);\n"),
        ("methods", "", "  buildRepo(){\n", methods),
        # ECharts lays out SVG text with text-anchor assuming left-to-right; inherited
        # direction:rtl flips start/end, so legend text ran over its icons and y-axis
        # labels over the bars. Arabic inside each <text> still shapes and orders correctly.
        ("css-chart-ltr", "</style>\n", "</head>",
         "<style>\n/* Every ECharts chart (the container carries _echarts_instance_): SVG text laid out left-to-right. */\n"
         "[_echarts_instance_] svg{direction:ltr}\n</style>\n"),
    ]


def merge(original: str, methods: str, ops: dict, val: dict):
    """Return (full_html, insertions) where insertions are (offset_in_output, text)."""
    found = []
    for name, before, after, text in edits(methods, ops, val):
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
    ops = json.loads(OPS_JSON.read_text(encoding="utf-8"))
    val = json.loads(VAL_JSON.read_text(encoding="utf-8"))
    return original, merge(original, methods, ops, val)


def main():
    _original, (out, ins) = build()
    OUT_HTML.write_text(out, encoding="utf-8")
    print(f"wrote {OUT_HTML.relative_to(APP)} — {len(out)/1e6:.1f} MB, {len(ins)} insertions")


if __name__ == "__main__":
    main()
