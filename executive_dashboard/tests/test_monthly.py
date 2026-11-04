"""Monthly intake checklist: every missing file of a month is named, in both layouts."""
import sys
from pathlib import Path

import pytest

APP = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(APP))
from src import monthly  # noqa: E402
import build_all  # noqa: E402

REQUIRED = [n for n, (req, *_r) in monthly.MANIFEST.items() if req]


@pytest.fixture
def tree(tmp_path, monkeypatch):
    monkeypatch.setattr(monthly, "MONTHLY", tmp_path / "monthly")
    monkeypatch.setattr(monthly, "LEGACY", tmp_path / "ops")
    monkeypatch.setattr(monthly, "REPO_ROOT", tmp_path)
    (tmp_path / "monthly").mkdir()
    (tmp_path / "ops").mkdir()
    return tmp_path


def test_an_empty_month_names_every_required_file(tree):
    assert [r["file"] for r in monthly.missing("2026-10")] == [f"data/monthly/2026-10/{n}" for n in REQUIRED]
    text = monthly.report("2026-10")
    for n in REQUIRED:
        assert f"✘ ناقص  data/monthly/2026-10/{n}" in text
    assert f"{len(REQUIRED)} ملف مطلوب ناقص" in text


def test_fixed_names_complete_a_month(tree):
    d = tree / "monthly" / "2026-10"
    d.mkdir()
    for n in REQUIRED[:-1]:
        (d / n).write_bytes(b"x")
    assert [r["file"] for r in monthly.missing("2026-10")] == [f"data/monthly/2026-10/{REQUIRED[-1]}"]
    (d / REQUIRED[-1]).write_bytes(b"x")
    assert monthly.missing("2026-10") == [] and "مكتمل" in monthly.report("2026-10")
    assert monthly.months() == ["2026-10"]


def test_legacy_files_still_count(tree):
    (tree / "ops" / "purchases_2026-09.pdf").write_bytes(b"x")
    (tree / "ops" / "suppliers_2026-09-02.pdf").write_bytes(b"x")
    found = {r["file"].rsplit("/", 1)[1]: r["found"] for r in monthly.check("2026-09")}
    assert found["purchases.pdf"] == "ops/purchases_2026-09.pdf"
    assert found["supplier_balances.pdf"] == "ops/suppliers_2026-09-02.pdf"
    assert found["sales_invoices.pdf"] is None
    assert monthly.months() == ["2026-09"]


def test_the_repository_months_report_the_real_gaps():
    """30/9: purchases, suppliers and the priced count are in; sales, collections and balances are not."""
    gaps = {r["file"].rsplit("/", 1)[1] for r in monthly.missing("2026-09")}
    assert gaps == {"sales_invoices.pdf", "collections.pdf", "returns_items.pdf", "customer_balances_by_rep.pdf"}
    assert monthly.months()[-1] == "2026-09"


def test_strict_build_stops_before_building(tree, capsys):
    assert build_all.main(["--month", "2026-10", "--strict"]) == 2
    out = capsys.readouterr().out
    assert "stopped: 2026-10" in out and "data/monthly/2026-10/purchases.pdf" in out
