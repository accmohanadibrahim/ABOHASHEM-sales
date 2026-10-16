"""
Roadmap enhancement tests (enhance_mobile.py).

Stage 2 must be additive only, like stage 1: removing the declared insertions
from the enhanced file gives back the merged file byte for byte. The dark theme
must keep every original colour as the var() fallback, and the committed
enhanced file must be what the script builds today.
"""
import re
import sys
from pathlib import Path

import pytest

APP_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(APP_DIR))

import enhance_mobile as em  # noqa: E402


@pytest.fixture(scope="module")
def built():
    if not em.SRC_HTML.exists():
        pytest.skip("merged mobile dashboard not present")
    original, (out, ins) = em.build()
    return original, out, ins


def test_enhance_only_inserts(built):
    original, out, ins = built
    stripped = out
    for pos, text in sorted(ins, reverse=True):
        assert stripped[pos:pos + len(text)] == text
        stripped = stripped[:pos] + stripped[pos + len(text):]
    assert stripped == original


def test_every_anchor_is_unique(built):
    original, _out, _ins = built
    for name, before, after, _text in em.edits(""):
        assert original.count(before + after) == 1, name


def test_var_wrapping_keeps_the_dark_literal(built):
    _original, out, _ins = built
    wrapped = re.findall(r"var\((--abh-[a-z0-9-]+),(rgba?\([^)]*\)|#[0-9a-fA-F]{3,8})\)", out)
    assert wrapped, "no colour was themed"
    for name, lit in wrapped:
        assert lit in em.LIGHT, lit
        assert name == em.token(lit)
    # every variable used has a light value defined in the theme sheet
    sheet = re.search(r"html\[data-theme=light\]\{([^}]*)\}", out).group(1)
    for name in {n for n, _ in wrapped}:
        assert name + ":" in sheet, name


def test_new_sections_and_exports_are_wired(built):
    _original, out, _ins = built
    for sid in ("adv_abc", "adv_season", "adv_basket", "adv_cohort", "adv_alerts"):
        assert f'"dash","{sid}"' in out
    for tid in ("adv_abc_rev", "adv_abc_profit", "adv_pairs", "adv_cohort", "adv_churn", "adv_alerts"):
        assert f'id:"{tid}"' in out
    assert "abh_theme" in out and "IntersectionObserver" in out


def test_committed_output_is_current(built):
    _original, out, _ins = built
    if not em.OUT_HTML.exists():
        pytest.skip("enhanced file not built")
    assert em.OUT_HTML.read_text(encoding="utf-8") == out, "run python3 enhance_mobile.py"
