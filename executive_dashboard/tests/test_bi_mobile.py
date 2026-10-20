"""
Stage 4 tests (bi_mobile.py) — «ذكاء الأعمال», a separate dev file.

Additive only, like stages 1–3: removing the declared insertions from the dev
file gives back the production file byte for byte, so every existing section,
figure and export is untouched. The committed dev file must be what the script
builds today, and the script must never write the production file.
"""
import json
import re
import sys
from pathlib import Path

import pytest

APP_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(APP_DIR))

import bi_mobile as bm  # noqa: E402

TABLES = ("bi_freshness", "bi_bridge_pnl", "bi_bridge_items", "bi_breakeven", "bi_dio", "bi_dead_stock",
          "bi_unpriced", "bi_std_cost", "bi_std_variance_month", "bi_std_margin_sku", "bi_alert_register", "bi_alert_rules",
          "bi_kpi_catalog", "bi_readiness")


@pytest.fixture(scope="module")
def built():
    if not bm.SRC_HTML.exists():
        pytest.skip("full file not built")
    original, (out, ins) = bm.build()
    return original, out, ins


def test_bi_only_inserts(built):
    original, out, ins = built
    stripped = out
    for pos, text in sorted(ins, reverse=True):
        assert stripped[pos:pos + len(text)] == text
        stripped = stripped[:pos] + stripped[pos + len(text):]
    assert stripped == original


def test_every_anchor_is_unique(built):
    original, _out, _ins = built
    for name, before, after, _text in bm.edits("", {}):
        assert original.count(before + after) == 1, name


def test_production_file_is_never_the_output():
    assert bm.OUT_HTML != bm.SRC_HTML
    assert bm.OUT_HTML.name == "Abu_Hashem_Mobile_bi.html"
    assert bm.SRC_HTML.name == "Abu_Hashem_Mobile_full.html"


def test_sections_and_exports_are_wired(built):
    _original, out, _ins = built
    for sid in bm.SECTIONS:
        assert f'"dash","{sid}"' in out, sid
        assert f"{sid}:" in out, sid                          # routed in biSectionBody
    for tid in TABLES:
        assert f'id:"{tid}"' in out, tid
    assert out.count('if(s.slice(0,3)==="bi_") return this.biSectionBody(s,X,T,api)||[];') == 1
    assert out.count("    this.biExport(out,col,num);\n") == 1
    assert out.count('["bi","ذكاء الأعمال","#14b8a6",id=>/^bi_/.test(id)],') == 1


def test_kill_switch_and_fault_isolation(built):
    """?nobi hides the group; each BI section renders inside try/catch."""
    _original, out, _ins = built
    assert "if(!/[?&#]nobi\\b/.test(String(location.search)+String(location.hash))){" in out
    i = out.index("  biSectionBody(s,X,T,api){")
    assert out.index("try{ return this[m](X,T,api); }", i) < out.index("  biNeed(", i)


def test_only_the_standard_costs_are_added(built):
    """The one new dataset is the standard costs (DASH_STD), exactly the committed JSON; the rest is read from the full file."""
    original, out, _ins = built
    for var in ("DASH_DATA", "DASH_MARGIN", "DASH_FS", "DASH_OPS", "DASH_VAL", "DASH_BUILD", "DASH_IS26"):
        assert out.count(f"window.{var} =") == original.count(f"window.{var} ="), var
    if bm.STD_JSON.exists():
        m = re.search(r"window\.DASH_STD = (\{.*?\});</script>", out, re.S)
        assert m and json.loads(m.group(1).replace("<\\/", "</")) == json.loads(bm.STD_JSON.read_text(encoding="utf-8"))


def test_committed_output_is_current(built):
    _original, out, _ins = built
    if not bm.OUT_HTML.exists():
        pytest.skip("bi file not built")
    assert bm.OUT_HTML.read_text(encoding="utf-8") == out, "run python3 bi_mobile.py"
