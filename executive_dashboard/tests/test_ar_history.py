"""
Customer balances by representative (src/ar_history.py), for «تاريخ المديونية».

Every report must add up to its printed totals, a missing report stays missing, the 16/7 and
3/9 balances must equal the receivables the dashboard's snapshots hold, and every roll-forward
row must add up. Rebuilding from the PDFs needs PyMuPDF and pdftotext; without them only the
committed file is checked.
"""
import json
import shutil
import sys
from pathlib import Path

import pytest

APP_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(APP_DIR))

from src import ar_history as ah  # noqa: E402

def _tools() -> bool:
    """Real PyMuPDF (not a stub on the PYTHONPATH) and pdftotext."""
    if shutil.which("pdftotext") is None:
        return False
    try:
        import fitz
    except ImportError:
        return False
    return hasattr(fitz, "open")


TOOLS = _tools()


@pytest.fixture(scope="module")
def data():
    return json.loads(ah.OUT_JSON.read_text(encoding="utf-8"))


@pytest.mark.skipif(not TOOLS, reason="PyMuPDF / pdftotext not installed")
def test_committed_file_is_current(data):
    if not ah.FULL_HTML.exists():
        pytest.skip("full file not built")
    assert ah.build() == data


def test_every_report_is_listed_with_its_hash(data):
    import hashlib
    files = sorted(p.name for p in ah.RAW.glob("*.pdf"))
    assert sorted(f["file"] for f in data["files"]) == files and len(files) == 49
    for f in data["files"]:
        assert f["sha256"] == hashlib.sha256((ah.RAW / f["file"]).read_bytes()).hexdigest(), f["file"]
        assert f["net"] == pytest.approx(f["debit"] - f["credit"], abs=0.01)


def test_missing_reports_stay_missing(data):
    by = {(f["date"], f["rep"]): f for f in data["files"]}
    for r in data["reps"]:
        for d, v in r["by_date"].items():
            assert (v is None) == ((d, r["rep"]) not in by), (r["rep"], d)
    for t in data["totals"]:
        assert t["complete"] == (not t["missing"])
        assert t["net"] == pytest.approx(sum(by[(t["date"], r)]["net"] for r in data["meta"]["reps"]
                                             if (t["date"], r) in by), abs=0.05)


def test_printed_dates_not_file_names(data):
    assert data["meta"]["dates"] == ["2026-06-24", "2026-07-04", "2026-07-16", "2026-07-25", "2026-07-30", "2026-09-02"]
    assert {f["date"] for f in data["files"] if "23-7" in f["file"]} == {"2026-07-25"}


def test_totals_tie_to_the_snapshots(data):
    tot = {t["date"]: t for t in data["totals"]}
    assert tot["2026-06-24"]["net"] == pytest.approx(3692545.42)         # the zip's own summary (24/6)
    assert tot["2026-09-02"]["net"] == pytest.approx(2936534.17)         # snap 3/9 net_of_credit
    assert not tot["2026-09-02"]["complete"] and tot["2026-07-25"]["complete"]


def test_rollforward_adds_up(data):
    for p in data["rollforward"]["periods"]:
        t = p["totals"]
        assert t["opening"] + t["sales"] - t["receipts"] - t["returns"] + t["gap"] == pytest.approx(t["closing"], abs=0.05)
        assert sum(x["customers"] for x in p["patterns"]) == p["customers"] - p["tied"]
        for g in p["gaps"]:
            assert g["opening"] + g["sales"] - g["receipts"] - g["returns"] + g["gap"] == pytest.approx(g["closing"], abs=0.02)
            assert abs(g["gap"]) > ah.TIE and g["pattern"]
            if g["pattern"] != ah.OTHER:
                k, sign = next((k, s) for k, s, lbl in ah.PATTERNS if lbl == g["pattern"])
                assert g["gap"] == pytest.approx(sign * g[k], abs=ah.TIE)
        assert p["after_extract"] == (p["to"] > p["extract_through"])
