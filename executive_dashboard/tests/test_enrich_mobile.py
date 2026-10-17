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


def test_committed_output_is_current(built):
    _original, out, _ins = built
    if not rm.OUT_HTML.exists():
        pytest.skip("full file not built")
    assert rm.OUT_HTML.read_text(encoding="utf-8") == out, "run python3 enrich_mobile.py"
