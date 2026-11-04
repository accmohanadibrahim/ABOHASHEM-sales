"""
Abohashem-main.zip (src/abohashem_main.py) — the unzipped folder, the run, the committed results.

Without PyMuPDF / pdftotext (the main CI job): the folder must be the zip byte for byte,
the analysis scripts (stdlib only) must rerun to the committed tables, and every tie-out
must hold. With them (the abohashem-main CI job): the whole run must give the committed file.
"""
import json
import shutil
import sys
import tempfile
import zipfile
from pathlib import Path

import pytest

APP_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(APP_DIR))

from src import abohashem_main as abm  # noqa: E402

ZIP = abm.REPO_ROOT / "Abohashem-main.zip"


@pytest.fixture(scope="module")
def data():
    if not abm.OUT_JSON.exists():
        pytest.skip("abohashem_main.json not built")
    return json.loads(abm.OUT_JSON.read_text(encoding="utf-8"))


def test_folder_is_the_zip_byte_for_byte():
    z = zipfile.ZipFile(ZIP)
    names = set()
    for i in z.infolist():
        if i.is_dir():
            continue
        rel = i.filename.split("/", 1)[1]
        names.add(rel)
        assert (abm.SRC_DIR / rel).read_bytes() == z.read(i), rel
    extra = {str(p.relative_to(abm.SRC_DIR)) for p in abm.SRC_DIR.rglob("*") if p.is_file()} - names
    assert extra == {"MANIFEST.md"}, extra


def test_the_zip_workflows_stay_inactive():
    root = abm.REPO_ROOT / ".github" / "workflows"
    assert not (root / "python-publish.yml").exists()
    assert (abm.SRC_DIR / ".github" / "workflows" / "python-publish.yml").exists()


def test_analysis_reruns_to_the_committed_tables(data):
    with tempfile.TemporaryDirectory() as tmp:
        work = Path(tmp) / "abohashem_main"
        shutil.copytree(abm.SRC_DIR, work)
        res, log, errs = abm.analysis(work)
    assert errs == [], errs
    sp = json.loads((abm.SRC_DIR / "analysis" / "salespeople.json").read_text(encoding="utf-8"))
    credits = [{"debt": c["debit"] - c["credit"]} for c in sp if c["debit"] - c["credit"] < 0]
    got, e2 = abm.collect(res, credits)
    assert e2 == []
    for k, v in got.items():
        assert data[k] == v, k
    assert [r for r in log if r["step"].startswith("output/")] == [r for r in data["runs"] if r["step"].startswith("output/")]


def test_tie_outs_and_labels(data):
    assert data["enabled"] and data["label"] == abm.LABEL and data["as_of"]["debt_as_of"] == "2026-06-24"
    assert data["checks"] and all(c["ok"] for c in data["checks"])
    s = data["summary"]
    assert s["invoices"] == 256 and s["total_sales_EGP"] == pytest.approx(3376569.54)
    assert s["total_outstanding_debt_EGP"] == pytest.approx(3692545.42)
    g = data["aging_vs_debt"]
    assert g["difference"] == pytest.approx(g["unmapped_debt"] - g["credit_balances"])
    assert data["model"]["operating_profit"]["model"] == pytest.approx(418841.92)


def test_every_script_ran(data):
    st = {r["step"]: r["status"] for r in data["runs"]}
    for s in abm.ANALYSIS:
        assert st[f"analysis/{s}"] == "يعمل", s
    assert st["analysis/parse_invoices.py"] == "يطابق invoices.json"
    assert st["analysis/parse_salespeople.py"] == "يطابق salespeople.json"
    assert st["model/costing_pricing_model.py"] == "يطابق قائمة دخل يونيو"
    assert st["model/wac_august_2026.py"].startswith("يعيد") and st["model/wac_september_2026.py"].startswith("يعيد")
    assert "/tmp" not in json.dumps(data, ensure_ascii=False)


@pytest.mark.skipif(not (abm.has("fitz") and abm.has("openpyxl") and shutil.which("pdftotext") and shutil.which("soffice")),
                    reason="needs PyMuPDF, openpyxl, pdftotext and LibreOffice (the abohashem-main CI job)")
def test_full_run_gives_the_committed_file(data):
    assert abm.build() == data


def test_switch_off(monkeypatch):
    monkeypatch.setenv("ABOHASHEM_MAIN", "off")
    assert abm.build() == {"enabled": False, "label": abm.LABEL}
