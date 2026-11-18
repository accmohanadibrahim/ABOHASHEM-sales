"""Structural guard for the evidence-based KPI coverage matrix.

This verifies documentation completeness and referenced test names only. It does
not claim that the referenced tests prove the KPI formulas.
"""
import re
from pathlib import Path

import pytest

APP_DIR = Path(__file__).resolve().parents[1]
MATRIX = APP_DIR / "docs" / "KPI_COVERAGE_MATRIX.md"
TESTS = APP_DIR / "tests"


def test_matrix_covers_all_register_kpis_and_uses_known_test_refs():
    text = MATRIX.read_text(encoding="utf-8")
    rows = [line for line in text.splitlines() if re.match(r"\| K\d{3} \|", line)]
    ids = [re.match(r"\| (K\d{3}) \|", row).group(1) for row in rows]
    assert len(rows) == 48
    assert ids == [f"K{i:03d}" for i in range(1, 49)]

    known = set()
    for path in TESTS.glob("test_*.py"):
        source = path.read_text(encoding="utf-8")
        known.update(f"{path.name}::{name}" for name in re.findall(r"^def (test_[A-Za-z0-9_]+)\(", source, re.M))

    cited = set(re.findall(r"`(test_[A-Za-z0-9_]+\.py::test_[A-Za-z0-9_]+)`", text))
    assert cited, "matrix must cite concrete tests"
    assert cited <= known, sorted(cited - known)


def test_matrix_classification_counts_are_explicit():
    text = MATRIX.read_text(encoding="utf-8")
    rows = [line for line in text.splitlines() if re.match(r"\| K\d{3} \|", line)]
    counts = {}
    for row in rows:
        cells = [cell.strip() for cell in row.strip("|").split("|")]
        category = cells[3]
        counts[category] = counts.get(category, 0) + 1
    assert counts == {"B": 7, "M": 1, "A": 30, "C": 8, "N": 2}
