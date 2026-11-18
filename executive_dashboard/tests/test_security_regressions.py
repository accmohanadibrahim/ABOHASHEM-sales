"""Focused regression tests for the security remediation changes.

These tests use synthetic strings and temporary files only. They do not read
company source data or modify dashboard outputs.
"""
import ast
import hashlib
import sys
from pathlib import Path

import pytest

APP_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = APP_DIR.parent
sys.path.insert(0, str(APP_DIR))

from src import ops_ingest, ar_history  # noqa: E402
import build_all  # noqa: E402


BIDI_CODEPOINTS = (
    0x200E, 0x200F,
    0x202A, 0x202B, 0x202C, 0x202D, 0x202E,
    0x2066, 0x2067, 0x2068, 0x2069,
)


@pytest.mark.parametrize("codepoint", BIDI_CODEPOINTS)
def test_ops_clean_text_removes_each_targeted_bidi_control(codepoint):
    control = chr(codepoint)
    assert ops_ingest.clean_text(f"قبل{control}بعد") == "قبلبعد"


@pytest.mark.parametrize("codepoint", BIDI_CODEPOINTS)
def test_ar_history_clean_removes_each_targeted_bidi_control(codepoint):
    control = chr(codepoint)
    assert ar_history.clean(f"قبل{control}بعد") == "قبلبعد"


def test_cleaning_preserves_arabic_words_and_normalizes_compatibility_forms():
    sample = "مُنتج عربي"
    assert ops_ingest.clean_text(sample) == sample
    assert ar_history.clean("ＡＢＣ") == "ABC"


def test_forecasting_uses_literal_eval_not_eval():
    source_path = REPO_ROOT / "analysis" / "07_forecasting.py"
    tree = ast.parse(source_path.read_text(encoding="utf-8"))
    calls = [
        node.func.id
        for node in ast.walk(tree)
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name)
    ]
    assert "literal_eval" in calls
    assert "eval" not in calls


@pytest.mark.parametrize("literal, expected", [
    ("(1, 1, 0)", (1, 1, 0)),
    ("(0, 1, 1)", (0, 1, 1)),
    ("(2, 1, 2)", (2, 1, 2)),
])
def test_literal_eval_accepts_expected_arima_orders(literal, expected):
    assert ast.literal_eval(literal) == expected


@pytest.mark.parametrize("payload", [
    "__import__('os').system('echo unsafe')",
    "open('/tmp/not-created', 'w')",
    "[x for x in (1, 2)]",
])
def test_literal_eval_rejects_executable_or_computed_payloads(payload):
    with pytest.raises((ValueError, SyntaxError)):
        ast.literal_eval(payload)


def test_build_digest_is_sha256_and_stable(tmp_path):
    target = tmp_path / "sample.bin"
    target.write_bytes(b"synthetic test payload")
    expected = hashlib.sha256(b"synthetic test payload").hexdigest()
    assert build_all.digest(target) == expected
    assert build_all.digest(target) == build_all.digest(target)


def test_build_digest_changes_when_file_content_changes(tmp_path):
    target = tmp_path / "sample.bin"
    target.write_bytes(b"version one")
    first = build_all.digest(target)
    target.write_bytes(b"version two")
    assert build_all.digest(target) != first


def test_build_digest_missing_file_marker_is_unchanged(tmp_path):
    assert build_all.digest(tmp_path / "missing.bin") == "-"
