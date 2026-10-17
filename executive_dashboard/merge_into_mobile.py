#!/usr/bin/env python3
"""Merge the executive dashboard's data into the Abu Hashem mobile dashboard.

Reads
  mobile/Abu_Hashem_Mobile_standalone.html   the mobile app, kept byte-for-byte
  data.js                                     window.DASH as of 16/07/2026
  statements_data.js                          window.DASH_FS (financial statements)
  mobile/patch/app_methods.js                 the new App methods
and writes mobile/Abu_Hashem_Mobile_merged.html.

Additive only. Every edit is an insertion at an anchor that must occur exactly
once in the original, so nothing in the mobile file is deleted or rewritten:
strip the insertions back out of the output and the original is what remains
(tests/test_merge_mobile.py checks exactly that). What gets added:

  * data.js, unchanged, as a second AR snapshot next to the bundled 03/09 one.
    The app sorts snapshots by balance date, so 03/09 stays the default and
    «حركة المديونية» (which needs two snapshots) switches itself on.
  * window.DASH_FS and a «القوائم المالية» nav group with five sections ported
    from the executive dashboard's financial screens.
  * «تفاصيل اللقطة»: the data.js fields no mobile section displayed.
  * export tables for all of the above, so «التقارير» and the Excel file carry them.
  * three fixes to bugs already in the mobile file: «المستحق» on a snapshot
    without overdue_invoices no longer claims there are no arrears; the returns
    export reads `value` (the field the rows actually carry) before `amount`;
    and «الربحية» no longer leaves its KPI tiles behind on other sections
    (three grids shared one React key).

Usage: python3 merge_into_mobile.py
"""
import json
from pathlib import Path

APP = Path(__file__).resolve().parent
MOB = APP / "mobile"
SRC_HTML = MOB / "Abu_Hashem_Mobile_standalone.html"
OUT_HTML = MOB / "Abu_Hashem_Mobile_merged.html"
METHODS = MOB / "patch" / "app_methods.js"

SNAP_FILE = "dash-2026-07-23.json"
SNAP_ENTRY = {
    "file": SNAP_FILE,
    "as_of": "2026-07-16",
    "generated": "2026-07-23",
    "label": "لقطة 16 يوليو 2026 — اللوحة التنفيذية",
    "note": "فواتير حتى 15/7 · تحصيلات حتى 18/7 · مرتجعات حتى 16/7 · أرصدة المديونية 16/7",
}


def js_object(path: Path) -> str:
    """The `{...}` literal assigned in a `window.X = {...};` data file."""
    txt = path.read_text(encoding="utf-8")
    i, j = txt.index("{"), txt.rindex("}")
    return txt[i:j + 1]


def snapshot_block(payload: str) -> str:
    # Same convention as the bundled snapshot: "</" is written "<\/" so customer
    # text can never close the block; the app's parseSnapshot() undoes it.
    assert "<!--" not in payload, "payload would put the script parser in escaped state"
    body = payload.replace("</", "<\\/")
    return f'<script type="application/json" id="snap-{SNAP_FILE}">{body}</script>\n'


def fs_block(path: Path) -> str:
    txt = path.read_text(encoding="utf-8").strip()
    assert txt.startswith("window.DASH_FS"), "statements_data.js must assign window.DASH_FS"
    return "<script>" + txt.replace("</script", "<\\/script") + "</script>\n"


def edits(dash: str, fs_script: str, methods: str):
    """(name, before, after, text): `text` goes between `before` and `after`,
    which must occur together exactly once in the original."""
    snap_entry = ", " + json.dumps(SNAP_ENTRY, ensure_ascii=False)
    return [
        # ---- data -------------------------------------------------------------
        ("fs-data", "", '<script type="application/json" id="snap-index">', fs_script),
        ("snap-index",
         '"note": "فواتير وتحصيلات ومرتجعات حتى 31 أغسطس · أرصدة المديونية بتاريخ 3 سبتمبر"}', "]</script>",
         snap_entry),
        ("snap-data", "", "<script>\n/* Abu Hashem mobile — module extracted verbatim from the standalone build.\n"
                          "   Namespace T",
         snapshot_block(dash)),
        # ---- navigation -------------------------------------------------------
        ("push-fs", '      if(src==="repo" && !repo) return;\n', "      const meta=src===\"dash\"",
         '      if(src==="fs" && !window.DASH_FS) return;\n'),
        ("registry-fs", '    push("الربحية والتقارير","repo","reports");\n', "\n",
         "\n"
         "    /* القوائم المالية — window.DASH_FS من اللوحة التنفيذية: ميزانيات 2025 وقوائم\n"
         "       الدخل الشهرية 7–12/2025. مجموعة مستقلة لأن فترتها غير فترة الفواتير. */\n"
         '    push("القوائم المالية","fs","fs_exec",{label:"الملخص المالي التنفيذي",h2:"الملخص المالي التنفيذي",\n'
         '      p:"المبيعات والربحية والسيولة والانحرافات في شاشة واحدة — من الميزانية وقوائم الدخل الشهرية"});\n'
         '    push("القوائم المالية","fs","fs_position",{label:"المركز المالي",h2:"المركز المالي — الميزانية",\n'
         '      p:"الميزانية في 31/7 و31/8 و31/12/2025 · عمود 28/2/2026 مستبعد لعدم توازنه"});\n'
         '    push("القوائم المالية","fs","fs_income",{label:"قائمة الدخل",h2:"قائمة الدخل الشهرية",\n'
         '      p:"من قائمة الدخل التفصيلية · الإهلاك السنوي مسجّل في ديسمبر ويُعرض موزّعًا كتقدير للمقارنة"});\n'
         '    push("القوائم المالية","fs","fs_wc",{label:"السيولة ورأس المال العامل",h2:"السيولة ورأس المال العامل",\n'
         '      p:"أيام التحصيل والتخزين والسداد · التدفق النقدي المعاد حسابه من الميزانيتين · القروض · العُهد والسُّلف"});\n'
         '    push("القوائم المالية","fs","fs_quality",{label:"المطابقة وجودة القوائم",h2:"المطابقة وجودة القوائم المالية",\n'
         '      p:"كل ملاحظة على الملف تظهر هنا ولا تُخفى · مطابقة المبيعات والأرباح · قاموس المؤشرات"});\n'),
        ("registry-snapdetail",
         '    push("تحليلات وجودة البيانات","dash","quality",null,"جودة البيانات — الفواتير");\n', "",
         '    push("تحليلات وجودة البيانات","dash","snapdetail",{label:"تفاصيل اللقطة",\n'
         '      h2:"تفاصيل اللقطة — حقول لم تكن معروضة",\n'
         '      p:"كل ما تحمله اللقطة النشطة ولم يعرضه قسم آخر: التحليلات، الجودة، "\n'
         '        +"التحصيل التفصيلي، الأرصدة الدائنة، الاستثناءات"});\n'),
        ("nav-note", '      "تحليلات وجودة البيانات":"Sunburst وSankey · والمطابقة والقيم الشاذّة",\n', "",
         '      "القوائم المالية":"ميزانيات 31/7 و31/8 و31/12/2025 · قوائم دخل 7–12/2025 · من اللوحة التنفيذية",\n'),
        ("render-fs", "", '    if(src==="repo" && st.RD && st.R) return this.buildRepo();\n',
         '    if(src==="fs" && window.DASH_FS) return this.buildFs();\n'),
        # ---- invoice-side sections -------------------------------------------
        ("section-snapdetail", '    if(s==="reports") return this.reports();\n', "\n",
         '    if(s==="snapdetail") return this.snapDetailBody(X,T,api);\n'),
        ("overview-extras", '{k:"c6",insight:"top_customers",onPick:drill})', "];",
         ",...this.ovExtras(X,T,api)"),
        ("quality-zero-insight", '{sub:"بونص / عيّنات",k:"q3",insight:"zero_invoices"})', "];",
         ',\n      this.card("تحليل الفواتير الصفرية",this.insightPanel("zero_invoices")'
         '||this.empty("لا يوجد تحليل مكتوب لهذا الشهر"),{k:"q4"})'),
        ("overdue-guard", "",
         '    if(!all.length) return [this.card("المستحق والمتأخرات",\n'
         '      this.empty("لا توجد فواتير تجاوزت تاريخ استحقاقها"),{k:"od0"})];\n',
         "    /* لقطة بلا قائمة overdue_invoices (لقطة 16/7 من اللوحة التنفيذية): غيابها\n"
         "       ليس «لا متأخرات» — تُعرض متأخرات أرصدة العملاء بدل رسالة مضلِّلة. */\n"
         "    if(!R.overdue_invoices && (R.rows||[]).length) return this.overdueFromBalances(T,api);\n"),
        # ---- export -----------------------------------------------------------
        ("returns-value", 'col("العميل","customer_name"), col("القيمة",null,r=>num(', "r.amount))]},",
         "r.value ?? "),
        ("export-extras", "", "    return out.filter(t=>t.rows && t.rows.length);\n  }\n\n  exportSheet(){",
         "    /* مُضاف: جداول القوائم المالية وجداول اللقطة غير المُصدَّرة. */\n"
         "    this.exportExtras(out,col,num);\n"),
        # ---- pre-existing bug: «الربحية» renders three KPI grids that all carry
        # the React key "kpi"; the duplicates leave stale tiles on every section
        # opened afterwards. An optional key argument, used only there, fixes it.
        ("kpigrid-param", "  kpiGridRepo(rows", '){\n    return React.createElement("div",{key:"kpi",style:', ",k"),
        ("kpigrid-key", '  kpiGridRepo(rows){\n    return React.createElement("div",{key:', '"kpi",style:', "k||"),
        ("kpigrid-st", "this.kpiGridRepo(M.kpisStatements(R)", ")", ',"kpi_st"'),
        ("kpigrid-win", "this.kpiGridRepo(M.kpisWindow(d,R)", ")", ',"kpi_win"'),
        ("kpigrid-meas", "this.kpiGridRepo(M.kpisMeasured(d,R)", ")", ',"kpi_meas"'),
        # ---- methods ----------------------------------------------------------
        ("methods", "", "  buildRepo(){\n", methods),
    ]


def merge(original: str, dash: str, fs_script: str, methods: str):
    """Return (merged_html, insertions) where insertions are (offset_in_merged, text)."""
    found = []
    for name, before, after, text in edits(dash, fs_script, methods):
        needle = before + after
        n = original.count(needle)
        assert n == 1, f"anchor {name!r} found {n} times (expected exactly 1)"
        found.append((original.index(needle) + len(before), name, text))
    found.sort()
    out, ins, prev, shift = [], [], 0, 0
    for pos, _name, text in found:
        out.append(original[prev:pos])
        ins.append((pos + shift, text))
        out.append(text)
        shift += len(text)
        prev = pos
    out.append(original[prev:])
    return "".join(out), ins


def build():
    original = SRC_HTML.read_text(encoding="utf-8")
    dash = js_object(APP / "data.js")
    json.loads(dash)  # must be strict JSON: it is parsed with JSON.parse in the app
    fs_script = fs_block(APP / "statements_data.js")
    methods = METHODS.read_text(encoding="utf-8")
    return original, merge(original, dash, fs_script, methods)


def main():
    _original, (merged, ins) = build()
    OUT_HTML.write_text(merged, encoding="utf-8")
    print(f"wrote {OUT_HTML.relative_to(APP)} — {len(merged)/1e6:.1f} MB, {len(ins)} insertions")


if __name__ == "__main__":
    main()
