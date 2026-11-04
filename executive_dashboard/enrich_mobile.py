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

  * window.DASH_OPS and window.DASH_VAL, embedded as data, and window.DASH_BUILD:
    the dates the data is as of plus a version (a fingerprint of this stage's
    inputs), shown under the title and exported as a table in the Excel file.
  * a nav group «قرارات وتشغيل» with eleven sections — inventory valuation and
    coverage, purchases and suppliers, cost pass-through, working capital,
    customer value/risk segments, rep scorecard, price leakage and bonus,
    returns, a price/cost/volume simulator, valuation and ratios, and the data
    cleaning log. Every section ends with a «القرار المقترح» card and tags each
    figure as verified / estimate / assumption.
  * their tables in «التقارير» and the Excel export.

Usage: python3 enrich_mobile.py      (run python3 -m src.ops_ingest first)
"""
import hashlib
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
IS26_JSON = APP.parent / "data" / "processed" / "income_2026.json"


def js(o) -> str:
    return json.dumps(o, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")


def build_info(ops: dict, val: dict, methods: str, is26: dict | None = None) -> dict:
    """Data dates and a version for the header and the Excel export.

    The version fingerprints this stage's inputs, and the date is the one the
    ingest keeps while the operations data is unchanged, so rebuilding the same
    inputs gives the same file byte for byte."""
    parts = [methods, js(ops), js(val)] + ([js(is26)] if is26 else [])
    h = hashlib.sha256("\0".join(parts).encode("utf-8")).hexdigest()[:10]
    vals = (ops.get("inventory") or {}).get("valuations") or []
    return {"version": h, "built": (ops.get("meta") or {}).get("generated"),
            "inventory_as_of": vals[-1]["date"] if vals else None,
            "purchases_through": max(ops.get("purchases") or {"": 0}) or None,
            "suppliers_as_of": (ops.get("suppliers") or {}).get("as_of")}


def data_script(ops: dict, val: dict, methods: str = "", is26: dict | None = None) -> str:
    return ("<script>/* بيانات التشغيل ونتائج التقييم — enrich_mobile.py */\n"
            f"window.DASH_OPS = {js(ops)};\nwindow.DASH_VAL = {js(val)};\n"
            + (f"window.DASH_IS26 = {js(is26)};\n" if is26 else "")
            + f"window.DASH_BUILD = {js(build_info(ops, val, methods, is26))};</script>\n")


def dmy(d: str) -> str:
    return f"{int(d[8:10])}/{int(d[5:7])}"


def nav_notes(ops: dict) -> tuple:
    """Sub-lines of «المخزون» and «المشتريات» name the dates the data actually holds."""
    inv = ops.get("inventory") or {}
    vals = [v["date"] for v in inv.get("valuations") or []] or ["2026-06-30", "2026-07-31"]
    cnt = max(inv.get("counts") or {"2026-08": 0})
    inv_p = ("تقييم " + "، ".join(dmy(d) for d in vals) + " · جرد " + {"2026-09": "30/9"}.get(cnt, "31/8")
             + " بالموقع · تغطية بالأيام من المبيعات")
    ar = {"07": "يوليو", "08": "أغسطس", "09": "سبتمبر", "10": "أكتوبر"}
    months = sorted(ops.get("purchases") or {"2026-07": 0, "2026-08": 0})
    rng = ar.get(months[0][5:7], months[0]) + (" إلى " + ar.get(months[-1][5:7], months[-1]) if len(months) > 1 else "")
    last_kg = "سبتمبر" if any(r.get("kg_sep") is not None for r in inv.get("recipes") or []) else "يوليو"
    return (inv_p, "مشتريات " + rng + " 2026 · تذبذب الأسعار · أرصدة الموردين 02/09",
            "سعر كيلو الوصفات يونيو ← " + last_kg + " مقابل أسعار البيع في الفواتير")


def is26_months(is26: dict | None) -> str:
    """«1–7/2026» for the nav sub-line, from the statements actually embedded."""
    ms = [m for p in (is26 or {}).get("periods", []) for m in p["months"]]
    return f"{int(ms[0][5:7])}–{int(ms[-1][5:7])}/{ms[-1][:4]}" if ms else ""


def edits(methods: str, ops: dict, val: dict, is26: dict | None = None):
    """(name, before, after, text): `text` goes between `before` and `after`,
    which must occur together exactly once in the enhanced file."""
    inv_p, pur_p, cost_p = nav_notes(ops)
    return [
        ("data", "", '<script type="application/json" id="snap-index">', data_script(ops, val, methods, is26)),
        ("registry-ops", '      p:"قواعد معلنة الحدود على المديونية والمبيعات والأسعار والفواتير"});\n', "    return out;\n",
         "\n"
         "    /* قرارات وتشغيل — بيانات التشغيل (DASH_OPS) والفواتير والقوائم ونموذج التقييم. */\n"
         "    const G=\"قرارات وتشغيل\";\n"
         "    if(window.DASH_OPS){\n"
         '      push(G,"dash","ops_inventory",{label:"المخزون",h2:"المخزون — التقييم والتغطية والركود",\n'
         f'        p:"{inv_p}"}});\n'
         '      push(G,"dash","ops_purchases",{label:"المشتريات والموردون",h2:"المشتريات والموردون",\n'
         f'        p:"{pur_p}"}});\n'
         '      push(G,"dash","ops_costpass",{label:"تمرير التكلفة",h2:"تكلفة الخامات مقابل سعر البيع",\n'
         f'        p:"{cost_p}"}});\n'
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
        # «قائمة الدخل الشهرية»: the 2026 statements after the 2025 table, which stays as it was.
        ("income-2026", '{k:"fi1",sub:"الإهلاك السنوي مسجّل في ديسمبر ويُعرض موزّعًا كتقدير للمقارنة"}),\n', "",
         "      ...(this.fs26Cards?this.fs26Cards(F,T):[]),\n"),
        ("fs-header-2026", '"هذا القسم من القوائم المالية (window.DASH_FS) · قوائم دخل "+span+', '" · لا تنطبق عليه فلاتر الفواتير"',
         '(window.DASH_IS26?" · قوائم دخل 2026: "+this.fs26Span():"")+'),
        ("nav-note-2026", '"ميزانيات 31/7 و31/8 و31/12/2025 · قوائم دخل 7–12/2025', ' · من اللوحة التنفيذية",',
         (" و" + is26_months(is26)) if is26_months(is26) else ""),
        # «المستحق»: the overdue measured at the first of the snapshot's month, by
        # rep then their customers, sits above the existing invoice and customer lists.
        ("overdue-byrep", "      kpiEl,\n\n", "      /* These bars total the INVOICE rows only.",
         "      ...(this.opsOdByRep?this.opsOdByRep(D,T,api,cohort):[]),\n\n"),
        # «التقارير»: the chip row sat directly in a height-limited column and was
        # squeezed to a nameless sliver; repNav replaces it with named, coloured
        # groups and table tiles. The original call stays as the fallback branch.
        ("reports-nav", "      ", 'this.pickRow("rt",tables.map(t=>[t.id,t.label]),cur.id,',
         "this.repNav?this.repNav(tables,cur):"),
        # ECharts lays out SVG text with text-anchor assuming left-to-right; inherited
        # direction:rtl flips start/end, so legend text ran over its icons and y-axis
        # labels over the bars. Arabic inside each <text> still shapes and orders correctly.
        # Under the title: the dates the figures are as of, and the build version.
        ("build-line", '"لوحة الأداء التنفيذي المالي")', '),\n        React.createElement("div",{"data-print":"actions"',
         ",\n          (this.opsBuildLine?this.opsBuildLine():null)"),
        ("css-chart-ltr", "</style>\n", "</head>",
         "<style>\n/* Every ECharts chart (the container carries _echarts_instance_): SVG text laid out left-to-right. */\n"
         "[_echarts_instance_] svg{direction:ltr}\n</style>\n"),
    ]


def merge(original: str, methods: str, ops: dict, val: dict, is26: dict | None = None):
    """Return (full_html, insertions) where insertions are (offset_in_output, text)."""
    found = []
    for name, before, after, text in edits(methods, ops, val, is26):
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
    is26 = json.loads(IS26_JSON.read_text(encoding="utf-8")) if IS26_JSON.exists() else None
    return original, merge(original, methods, ops, val, is26)


def main():
    _original, (out, ins) = build()
    OUT_HTML.write_text(out, encoding="utf-8")
    print(f"wrote {OUT_HTML.relative_to(APP)} — {len(out)/1e6:.1f} MB, {len(ins)} insertions")


if __name__ == "__main__":
    main()
