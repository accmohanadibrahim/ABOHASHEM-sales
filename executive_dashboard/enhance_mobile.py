#!/usr/bin/env python3
"""Stage 2: the roadmap enhancements on top of the merged mobile dashboard.

Reads
  mobile/Abu_Hashem_Mobile_merged.html      output of merge_into_mobile.py, kept as is
  mobile/patch/enhance_methods.js           the new App methods
and writes mobile/Abu_Hashem_Mobile_enhanced.html.

Insertion-only, like stage 1: strip the declared insertions from the output and
the merged file is what remains (tests/test_enhance_mobile.py checks it). Added:

  * light / dark theme. Every neutral colour literal inside the App component is
    wrapped as var(--abh-…, <literal>) — the literal stays as the fallback, so
    the dark theme renders exactly as before and the light theme only defines
    the variables. Chart options are mapped to the light palette at draw time
    (window.__abhTheme), never at build time, so a toggle redraws in place.
    The choice is stored in localStorage "abh_theme" and applied before the
    first paint. Printing keeps its own ink-on-white stylesheet.
  * performance: a chart below the fold is initialised when it scrolls into
    view (IntersectionObserver) instead of on section open; export and print
    force any pending chart to draw first.
  * «تحليلات متقدمة»: ABC by revenue and, separately, by gross profit; seasonality;
    market basket; customer cohorts and churn risk; rule-based alerts — with
    their tables added to «التقارير» and the Excel export.

Usage: python3 enhance_mobile.py
"""
import json
import re
from pathlib import Path

APP = Path(__file__).resolve().parent
MOB = APP / "mobile"
SRC_HTML = MOB / "Abu_Hashem_Mobile_merged.html"
OUT_HTML = MOB / "Abu_Hashem_Mobile_enhanced.html"
METHODS = MOB / "patch" / "enhance_methods.js"

# Dark literal -> light value. Only colours that read wrong on white are here:
# text tones, dark surfaces, white tints and the pale accent text colours. The
# saturated brand/series colours (#10b981, #3b82f6, ...) work on both.
LIGHT = {
    "#e2e8f0": "#0f172a", "#f1f5f9": "#0f172a", "#cbd5e1": "#334155", "#94a3b8": "#475569",
    "#3f4a5f": "#cbd5e1",
    "#93c5fd": "#1d4ed8", "#bfdbfe": "#1e40af", "#fca5a5": "#b91c1c", "#fecaca": "#991b1b",
    "#fcd34d": "#a16207", "#fcd9a0": "#92400e", "#6ee7b7": "#047857", "#86efac": "#15803d",
    "#c4b5fd": "#6d28d9", "#ddd6fe": "#5b21b6",
    "#111827": "#ffffff", "#0d1220": "#ffffff", "#0a0e1a": "#eef2f7", "#070b14": "#eef2f7",
    "rgba(17,24,39,.85)": "#ffffff", "rgba(13,18,32,.75)": "rgba(255,255,255,.94)",
    "rgba(13,18,32,.55)": "rgba(255,255,255,.86)", "rgba(13,18,32,.96)": "rgba(255,255,255,.98)",
    "rgba(3,6,14,.7)": "rgba(15,23,42,.38)", "rgba(3,6,14,.82)": "rgba(15,23,42,.45)",
}
for a in ("02", "03", "035", "04", "05", "06", "07", "08", "09", "10", "12", "14", "2"):
    alpha = float("." + a)
    LIGHT[f"rgba(255,255,255,.{a})"] = f"rgba(15,23,42,{min(0.5, round(alpha * 1.3 + 0.01, 3))})"

LIT_RE = re.compile("|".join(re.escape(k) for k in sorted(LIGHT, key=len, reverse=True)))


def token(lit: str) -> str:
    return "--abh-" + re.sub(r"[^0-9a-z]+", "-", lit.lower()).strip("-")


def tokenize(text: str):
    """Insertions (offset, text) wrapping each mapped literal as var(--abh-…,lit).

    Literals that are not used as CSS values are left alone: anything inside an
    innerHTML string (an SVG attribute cannot take var()) and anything joined to
    other text with + (it is building a colour, not using one)."""
    ins = []
    for m in LIT_RE.finditer(text):
        i, j = m.span()
        line_start = text.rfind("\n", 0, i) + 1
        line_end = text.find("\n", j)
        line = text[line_start:line_end]
        if "__html" in line or "<svg" in line or "fill=" in line:
            continue
        if re.match(r"""\s*["'`]\s*\+""", text[j:j + 6]) or re.search(r"""\+\s*["'`]\s*$""", text[i - 6:i]):
            continue
        ins.append((i, "var(" + token(m.group()) + ","))
        ins.append((j, ")"))
    return ins


def theme_head() -> str:
    names = {k: token(k) for k in LIGHT}
    css_vars = ";".join(f"{names[k]}:{v}" for k, v in LIGHT.items())
    js_map = json.dumps(LIGHT, ensure_ascii=False)
    return (
        "<style>\n"
        "/* المظهر الفاتح: يعرِّف المتغيرات فقط؛ المظهر الداكن يستخدم القيمة الاحتياطية كما هي. */\n"
        f"html[data-theme=light]{{color-scheme:light;{css_vars}}}\n"
        "html[data-theme=light],html[data-theme=light] body{background:#eef2f7;color:#0f172a}\n"
        "html[data-theme=light] a{color:#1d4ed8}\n"
        "</style>\n"
        "<script>\n"
        "/* المظهر قبل أول رسم (لا وميض)، وتحويل خيارات الرسوم إلى ألوان المظهر عند الرسم. */\n"
        "(function(){\n"
        f"  var MAP={js_map};\n"
        "  var KEY='abh_theme', root=document.documentElement;\n"
        "  function saved(){ try{ return localStorage.getItem(KEY)==='light'?'light':'dark'; }catch(e){ return 'dark'; } }\n"
        "  function apply(t){\n"
        "    if(t==='light') root.setAttribute('data-theme','light'); else root.removeAttribute('data-theme');\n"
        "    var m=document.querySelector('meta[name=\"theme-color\"]');\n"
        "    if(m) m.setAttribute('content', t==='light'?'#eef2f7':'#0a0e1a');\n"
        "  }\n"
        "  apply(saved());\n"
        "  var esc=function(s){ return s.replace(/[.*+?^${}()|[\\]\\\\]/g,'\\\\$&'); };\n"
        "  var LIT=new RegExp(Object.keys(MAP).sort(function(a,b){return b.length-a.length;}).map(esc).join('|'),'g');\n"
        "  var VAR=/var\\(--abh-[a-z0-9-]+,(rgba?\\([^)]*\\)|#[0-9a-fA-F]{3,8})\\)/g;\n"
        "  function str(s,L){\n"
        "    if(s.indexOf('var(--abh-')>=0) s=s.replace(VAR,function(_,lit){ return L&&MAP[lit]?MAP[lit]:lit; });\n"
        "    else if(L) s=s.replace(LIT,function(l){ return MAP[l]; });\n"
        "    return s;\n"
        "  }\n"
        "  function walk(v,L){\n"
        "    if(typeof v==='string') return str(v,L);\n"
        "    if(!v||typeof v!=='object') return v;\n"
        "    if(Array.isArray(v)){ var out=null;\n"
        "      for(var i=0;i<v.length;i++){ var w=walk(v[i],L); if(w!==v[i]&&!out) out=v.slice(); if(out) out[i]=w; }\n"
        "      return out||v; }\n"
        "    var p=Object.getPrototypeOf(v); if(p!==Object.prototype&&p!==null) return v;\n"
        "    var o=null;\n"
        "    for(var k in v){ if(!Object.prototype.hasOwnProperty.call(v,k)) continue;\n"
        "      var x=walk(v[k],L); if(x!==v[k]){ if(!o) o=Object.assign({},v); o[k]=x; } }\n"
        "    return o||v;\n"
        "  }\n"
        "  var cache={dark:new WeakMap(), light:new WeakMap()};\n"
        "  window.__abhLight=function(){ return root.getAttribute('data-theme')==='light'; };\n"
        "  window.__abhTheme=function(o){\n"
        "    if(!o||typeof o!=='object') return o;\n"
        "    var L=window.__abhLight(), c=cache[L?'light':'dark'], r=c.get(o);\n"
        "    if(!r){ r=walk(o,L); c.set(o,r); }\n"
        "    return r;\n"
        "  };\n"
        "  window.__abhSetTheme=function(t){\n"
        "    try{ localStorage.setItem(KEY,t); }catch(e){}\n"
        "    apply(t);\n"
        "    try{ window.dispatchEvent(new Event('abh-theme')); }catch(e){}\n"
        "  };\n"
        "})();\n"
        "</script>\n")


def edits(methods: str):
    """(name, before, after, text): `text` goes between `before` and `after`,
    which must occur together exactly once in the merged file."""
    return [
        # ---- theme: tokens + pre-render script ---------------------------------
        ("theme-head", '<meta name="theme-color" content="#0a0e1a">\n', '<meta name="mobile-web-app-capable"',
         theme_head()),
        # ---- EChart: theme mapping, deferred draw, flush ------------------------
        ("chart-theme-listen", "    REGISTRY.push(this);\n", "    this.draw();\n",
         '    this.onTheme = () => { if(this.inst) this.draw(); };\n'
         '    window.addEventListener("abh-theme", this.onTheme);\n'),
        ("chart-unmount", "  componentWillUnmount(){\n", '    window.removeEventListener("resize", this.onResize);\n',
         '    window.removeEventListener("abh-theme", this.onTheme);\n'
         '    if(this.__io){ this.__io.disconnect(); this.__io = null; }\n'),
        ("chart-defer", '    if(!el || !o || typeof echarts === "undefined") return;\n',
         '    if(!this.inst) this.inst = echarts.init(el, null, {renderer:"svg"});\n',
         "    /* مُضاف: رسم مؤجَّل حتى يقترب الرسم من الشاشة. القسم الطويل كان يهيّئ كل\n"
         "       رسومه عند فتحه، وأغلبها خارج الشاشة. التصدير والطباعة يستدعيان flush(). */\n"
         '    if(!this.inst && !this.__seen && typeof IntersectionObserver !== "undefined"\n'
         '       && !document.body.hasAttribute("data-printing")){\n'
         "      if(!this.__io){\n"
         "        const root = el.closest('[data-print=\"scroll\"]');\n"
         "        this.__io = new IntersectionObserver(es => {\n"
         "          if(es.some(e => e.isIntersecting)){\n"
         "            this.__seen = true;\n"
         "            if(this.__io){ this.__io.disconnect(); this.__io = null; }\n"
         "            this.draw();\n"
         "          }\n"
         '        }, {root: root || null, rootMargin: "400px 0px"});\n'
         "        this.__io.observe(el);\n"
         "      }\n"
         "      return;\n"
         "    }\n"),
        ("chart-theme-map", "    this.inst.setOption(", "o, true);\n    this.inst.off(\"click\");",
         "window.__abhTheme ? window.__abhTheme(o) : "),
        ("chart-flush", "  }\n", '  render(){\n    return React.createElement("div",{ref:e=>this.el=e,\n'
         '      "data-chart-title"',
         "  flush(){\n"
         "    if(this.inst || !this.el || !this.props.option) return;\n"
         "    this.__seen = true;\n"
         "    if(this.__io){ this.__io.disconnect(); this.__io = null; }\n"
         "    this.draw();\n"
         "  }\n"),
        # ---- export / print see every chart, drawn or not ------------------------
        ("x-charts-flush", "function charts(){\n", "  return REGISTRY\n",
         "  REGISTRY.forEach(c => { try{ c.flush && c.flush(); }catch(e){} });\n"),
        ("x-print-flush", "  setTimeout(() => {\n",
         "    try{ REGISTRY.forEach(c => c.inst && c.inst.resize()); }catch(e){}\n    window.print();",
         "    REGISTRY.forEach(c => { try{ c.flush && c.flush(); }catch(e){} });\n"),
        ("x-png-host", "  document.body.appendChild(host);\n", "\n  let tmp = null;",
         '  if(window.__abhLight && window.__abhLight()) host.style.background = "#ffffff";\n'),
        ("x-png-bg", '    return tmp.getDataURL({type: "png", pixelRatio: scale || 2,\n'
         "                           backgroundColor: ", '"#111827"});',
         '(window.__abhLight && window.__abhLight()) ? "#ffffff" : '),
        # ---- header: theme toggle ---------------------------------------------
        ("theme-btn", '        React.createElement("div",{"data-print":"actions",style:{display:"flex",gap:7,flex:"none"}},\n'
         "          ", "v.exportBtnEl||null, v.filterBtnEl)),", "this.themeBtn(), "),
        # ---- navigation: «تحليلات متقدمة» --------------------------------------
        ("registry-adv", '         "جودة البيانات — "+T.aggMonths(this.state.RD));\n', "    return out;\n",
         "\n"
         "    /* تحليلات متقدمة — من بنود الفواتير وجدول الربحية، وتتبع الفلاتر. */\n"
         '    push("تحليلات متقدمة","dash","adv_abc",{label:"تحليل ABC",h2:"تحليل ABC — بالإيراد وبالربح",\n'
         '      p:"الإيراد من بنود الفواتير · الربح من جدول الربحية للأصناف المكلَّفة فقط"});\n'
         '    push("تحليلات متقدمة","dash","adv_season",{label:"الموسمية",h2:"الموسمية وأنماط البيع",\n'
         '      p:"أيام الأسبوع · أيام الشهر · 2025 مقابل 2026"});\n'
         '    push("تحليلات متقدمة","dash","adv_basket",{label:"سلة المشتريات",h2:"سلة المشتريات — ما يُشترى معًا",\n'
         '      p:"الدعم والثقة والرفع لكل زوج أصناف في الفاتورة نفسها"});\n'
         '    push("تحليلات متقدمة","dash","adv_cohort",{label:"أفواج العملاء",h2:"أفواج العملاء والاحتفاظ",\n'
         '      p:"شهر أول شراء · الاحتفاظ الشهري · العملاء المعرّضون للتوقف"});\n'
         '    push("تحليلات متقدمة","dash","adv_alerts",{label:"التنبيهات الذكية",h2:"التنبيهات الذكية",\n'
         '      p:"قواعد معلنة الحدود على المديونية والمبيعات والأسعار والفواتير"});\n'),
        ("nav-note-adv", '      "تحليلات وجودة البيانات":"Sunburst وSankey · والمطابقة والقيم الشاذّة",\n', "",
         '      "تحليلات متقدمة":"ABC · الموسمية · سلة المشتريات · الأفواج · التنبيهات",\n'),
        ("section-adv", '    if(s==="snapdetail") return this.snapDetailBody(X,T,api);\n', "\n",
         '    if(s.slice(0,4)==="adv_") return this.advSectionBody(s,X,T,api)||[];\n'),
        # ---- export catalogue ----------------------------------------------------
        ("export-adv", "    this.exportExtras(out,col,num);\n", "",
         "    this.advExport(out,col,num);\n"),
        # ---- methods ------------------------------------------------------------
        ("methods", "", "  buildRepo(){\n", methods),
    ]


def merge(original: str, methods: str):
    """Return (enhanced_html, insertions) where insertions are (offset_in_output, text)."""
    found = []
    for name, before, after, text in edits(methods):
        needle = before + after
        n = original.count(needle)
        assert n == 1, f"anchor {name!r} found {n} times (expected exactly 1)"
        found.append((original.index(needle) + len(before), 0, text))
    a = original.index("class App extends React.Component")
    b = original.index("window.__C = C;")
    found += [(a + i, 1, t) for i, t in tokenize(original[a:b])]
    found.sort(key=lambda x: (x[0], x[1]))
    out, ins, prev, shift = [], [], 0, 0
    for pos, _k, text in found:
        out.append(original[prev:pos])
        ins.append((pos + shift, text))
        out.append(text)
        shift += len(text)
        prev = pos
    out.append(original[prev:])
    return "".join(out), ins


def themed_methods(src: str) -> str:
    """The new methods get the same var() wrapping as the App they join."""
    out, prev = [], 0
    for pos, text in tokenize(src):
        out.append(src[prev:pos])
        out.append(text)
        prev = pos
    out.append(src[prev:])
    return "".join(out)


def build():
    original = SRC_HTML.read_text(encoding="utf-8")
    methods = themed_methods(METHODS.read_text(encoding="utf-8"))
    return original, merge(original, methods)


def main():
    _original, (out, ins) = build()
    OUT_HTML.write_text(out, encoding="utf-8")
    print(f"wrote {OUT_HTML.relative_to(APP)} — {len(out)/1e6:.1f} MB, {len(ins)} insertions")


if __name__ == "__main__":
    main()
