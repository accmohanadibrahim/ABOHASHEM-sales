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

from src import ops_ingest, ar_history, income_2026  # noqa: E402
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
    call_names = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        if isinstance(node.func, ast.Name):
            call_names.append(node.func.id)
        elif isinstance(node.func, ast.Attribute):
            call_names.append(node.func.attr)
    assert "literal_eval" in call_names
    assert "eval" not in call_names


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



def _valid_income_statement():
    return {
        "source": "synthetic-test",
        "period": "2026-01",
        "months": ["2026-01"],
        "net_sales": 100.0,
        "cogs": 60.0,
        "gross_profit": 40.0,
        "sections": {
            "operating": 10.0,
            "admin": 5.0,
            "selling": 5.0,
            "financing": 0.0,
        },
        "items": [],
        "net_profit": 20.0,
    }


def test_valuation_reconciliation_accepts_matching_totals():
    raw, fg = [{"value": 60.0}], [{"value": 40.0}]
    assert ops_ingest.check_valuation(raw, fg, 60.0, 40.0, 100.0) == (60.0, 40.0)


@pytest.mark.parametrize("raw_total, fg_total, all_total", [
    (61.0, 40.0, 100.0),
    (60.0, 41.0, 101.0),
    (60.0, 40.0, 99.0),
])
def test_valuation_reconciliation_rejects_mismatches(raw_total, fg_total, all_total):
    with pytest.raises(ValueError):
        ops_ingest.check_valuation([{"value": 60.0}], [{"value": 40.0}],
                                   raw_total, fg_total, all_total)


def test_income_statement_reconciliation_accepts_matching_totals():
    income_2026.check(_valid_income_statement(), [])


@pytest.mark.parametrize("field, value", [
    ("gross_profit", 41.0),
    ("net_profit", 19.0),
])
def test_income_statement_reconciliation_rejects_mismatches(field, value):
    statement = _valid_income_statement()
    statement[field] = value
    with pytest.raises(ValueError):
        income_2026.check(statement, [])


def test_financial_reconciliation_checks_remain_active_under_python_optimized_mode():
    code = (
        "from src import ops_ingest, income_2026; "
        "failed = False; "
        "try: ops_ingest.check_valuation([{'value': 10}], [], 9, 0, 9); "
        "except ValueError: failed = True; "
        "assert failed, 'valuation mismatch was not rejected'; "
        "p = {'source':'optimized-test','period':'2026-01','months':['2026-01'],"
        "'net_sales':100,'cogs':60,'gross_profit':41,"
        "'sections':{'operating':10,'admin':5,'selling':5,'financing':0},"
        "'items':[],'net_profit':21}; "
        "failed = False; "
        "try: income_2026.check(p, []); "
        "except ValueError: failed = True; "
        "assert failed, 'income mismatch was not rejected'"
    )
    import subprocess
    result = subprocess.run(
        [sys.executable, "-O", "-c", code],
        cwd=APP_DIR,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr or result.stdout
