"""
Stage 3 tests (enrich_mobile.py) — «قرارات وتشغيل».

Additive only, like stages 1 and 2: removing the declared insertions from the
full file gives back the enhanced file byte for byte. The embedded data must be
exactly the committed JSON, and the committed full file must be what the
script builds today.
"""
import json
import re
import sys
from pathlib import Path

import pytest

APP_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(APP_DIR))

import enrich_mobile as rm  # noqa: E402

SECTIONS = ("ops_inventory", "ops_purchases", "ops_costpass", "ops_wc", "dec_rfm", "dec_reps",
            "dec_leakage", "dec_returns", "dec_whatif", "dec_valuation", "dq_clean")


@pytest.fixture(scope="module")
def built():
    for p in (rm.SRC_HTML, rm.OPS_JSON, rm.VAL_JSON):
        if not p.exists():
            pytest.skip(f"{p.name} not present")
    original, (out, ins) = rm.build()
    return original, out, ins


def test_enrich_only_inserts(built):
    original, out, ins = built
    stripped = out
    for pos, text in sorted(ins, reverse=True):
        assert stripped[pos:pos + len(text)] == text
        stripped = stripped[:pos] + stripped[pos + len(text):]
    assert stripped == original


def test_every_anchor_is_unique(built):
    original, _out, _ins = built
    for name, before, after, _text in rm.edits("", {}, {}):
        assert original.count(before + after) == 1, name


def test_embedded_data_is_the_committed_json(built):
    _original, out, _ins = built
    for var, path in (("DASH_OPS", rm.OPS_JSON), ("DASH_VAL", rm.VAL_JSON)):
        m = re.search(r"window\." + var + r" = (\{.*?\});\n?(?:window|</script>)", out, re.S)
        assert m, var
        embedded = json.loads(m.group(1).replace("<\\/", "</"))
        assert embedded == json.loads(path.read_text(encoding="utf-8")), var


def test_sections_and_exports_are_wired(built):
    _original, out, _ins = built
    for sid in SECTIONS:
        assert f'"dash","{sid}"' in out, sid
        assert f"{sid}:" in out, sid                          # routed in opsSectionBody
    for tid in ("dec_rfm", "dec_reps", "ops_fg_cover", "ops_purch_items", "ops_suppliers", "ops_returns_items", "dq_cleaning"):
        assert f'id:"{tid}"' in out, tid
    assert out.count("القرار المقترح") >= 1 and out.count("this.opsDecision(") >= len(SECTIONS)


def test_chart_svg_text_is_laid_out_ltr(built):
    """ECharts places SVG text assuming LTR; the page is RTL, so charts get direction:ltr."""
    _original, out, _ins = built
    assert out.count("[_echarts_instance_] svg{direction:ltr}") == 1


def test_costpass_drops_months_the_snapshot_lacks(built):
    """The 16/7 snapshot stops at 15/7: no August column, and half of July is labelled as such."""
    _original, out, _ins = built
    assert "rows.hasAug=has.has(\"2026-08\")" in out
    assert "Cp.hasAug?[col(\"سعر البيع أغسطس\"" in out
    assert "النصف الأول من الشهر" in out


def test_overdue_by_rep_is_wired(built):
    """«المستحق» gains the by-rep view measured at the first of the snapshot month, plus its two exports."""
    _original, out, _ins = built
    assert out.count("...(this.opsOdByRep?this.opsOdByRep(D,T,api,cohort):[]),") == 1
    i = out.index("  overdueBody(X, T, api){")
    assert i < out.index("this.opsOdByRep(D,T,api,cohort)") < out.index('"الفواتير المستحقة"', i)
    for tid in ("od_rep_0109", "od_rep_cust_0109"):
        assert f'id:"{tid}"' in out, tid
    assert 'M=asOf.slice(0,8)+"01"' in out and "if(!R.overdue_invoices||!(M<asOf)) return null;" in out


def test_reports_use_the_named_table_navigator(built):
    """«التقارير» renders grouped, named table tiles; the original chip row stays as the fallback branch."""
    _original, out, _ins = built
    assert out.count('this.repNav?this.repNav(tables,cur):this.pickRow("rt",') == 1
    assert "  repNav(tables,cur){" in out and "  repGroups(){" in out


def test_build_line_and_data_dates(built):
    """The header states the data dates and a version; the same rows are an Excel table."""
    _original, out, _ins = built
    assert out.count("(this.opsBuildLine?this.opsBuildLine():null)") == 1
    i = out.index('"لوحة الأداء التنفيذي المالي")')
    assert out.index("this.opsBuildLine()", i) < out.index('{"data-print":"actions"', i)
    m = re.search(r"window\.DASH_BUILD = (\{.*?\});</script>", out)
    info = json.loads(m.group(1))
    ops = json.loads(rm.OPS_JSON.read_text(encoding="utf-8"))
    assert info["inventory_as_of"] == ops["inventory"]["valuations"][-1]["date"]
    assert info["purchases_through"] == max(ops["purchases"]) and len(info["version"]) == 10
    assert 'id:"build_info"' in out


def test_build_info_is_stable(built):
    """Same inputs, same version — so the full file rebuilds byte for byte."""
    ops = json.loads(rm.OPS_JSON.read_text(encoding="utf-8"))
    val = json.loads(rm.VAL_JSON.read_text(encoding="utf-8"))
    assert rm.build_info(ops, val, "m") == rm.build_info(json.loads(json.dumps(ops)), val, "m")
    assert rm.build_info(ops, val, "m")["version"] != rm.build_info(ops, val, "m2")["version"]


def test_committed_output_is_current(built):
    _original, out, _ins = built
    if not rm.OUT_HTML.exists():
        pytest.skip("full file not built")
    assert rm.OUT_HTML.read_text(encoding="utf-8") == out, "run python3 enrich_mobile.py"


def test_income_2026_is_embedded_and_shown_after_the_2025_table(built):
    """«قائمة الدخل الشهرية» gains the 2026 statements; the 2025 card and its rows stay as they were."""
    _original, out, _ins = built
    if not rm.IS26_JSON.exists():
        pytest.skip("income_2026.json not built")
    m = re.search(r"window\.DASH_IS26 = (\{.*?\});\n", out, re.S)
    assert m and json.loads(m.group(1).replace("<\\/", "</")) == json.loads(rm.IS26_JSON.read_text(encoding="utf-8"))
    i = out.index('{k:"fi1",sub:"الإهلاك السنوي مسجّل في ديسمبر ويُعرض موزّعًا كتقدير للمقارنة"}),\n')
    assert out.index("...(this.fs26Cards?this.fs26Cards(F,T):[]),", i) < out.index('this.chartCard("التحليل الرأسي', i)
    assert out.count('(window.DASH_IS26?" · قوائم دخل 2026: "+this.fs26Span():"")+') == 1
    assert "قوائم دخل 7–12/2025 و1–7/2026 · من اللوحة التنفيذية" in out
    for tid in ("fs_pl_2026", "fs_items_2026", "fs_yoy_2026"):
        assert f'id:"{tid}"' in out, tid
