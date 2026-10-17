"""
Mobile merge tests (merge_into_mobile.py).

The merge must be additive only: removing the declared insertions from the
merged file gives back the original mobile file byte for byte. The embedded
snapshot and financial statements must equal their sources, and the committed
merged file must be what the script builds today.
"""
import hashlib
import json
import re
import sys
from pathlib import Path

import pytest

APP_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(APP_DIR))

import merge_into_mobile as mm  # noqa: E402

ORIGINAL_MD5 = "d831087924c13ebabe039cf2a347d275"  # the mobile file as the user supplied it


@pytest.fixture(scope="module")
def built():
    if not mm.SRC_HTML.exists():
        pytest.skip("original mobile dashboard not present")
    original, (merged, ins) = mm.build()
    return original, merged, ins


def test_original_is_the_supplied_file():
    if not mm.SRC_HTML.exists():
        pytest.skip("original mobile dashboard not present")
    assert hashlib.md5(mm.SRC_HTML.read_bytes()).hexdigest() == ORIGINAL_MD5


def test_merge_only_inserts(built):
    original, merged, ins = built
    assert len(ins) == len(mm.edits("", "", ""))
    out = merged
    for pos, text in sorted(ins, reverse=True):
        assert out[pos:pos + len(text)] == text
        out = out[:pos] + out[pos + len(text):]
    assert out == original


def _script(merged, attrs):
    m = re.search(r"<script " + re.escape(attrs) + r">(.*?)</script>", merged, re.S)
    assert m, attrs
    return m.group(1)


def test_executive_snapshot_is_embedded_unchanged(built):
    _original, merged, _ins = built
    body = _script(merged, f'type="application/json" id="snap-{mm.SNAP_FILE}"')
    src = json.loads(mm.js_object(mm.APP / "data.js"))
    assert json.loads(body.replace("<\\/", "</")) == src
    assert src["meta"]["as_of"] == mm.SNAP_ENTRY["as_of"]


def test_snapshot_index_lists_both_snapshots(built):
    _original, merged, _ins = built
    idx = json.loads(_script(merged, 'type="application/json" id="snap-index"'))
    files = [e["file"] for e in idx]
    assert files == ["dash-2026-09-04.json", mm.SNAP_FILE]
    for f in files:
        assert f'id="snap-{f}"' in merged
    # the newest balance date stays the app's default snapshot
    assert max(idx, key=lambda e: e["as_of"])["file"] == "dash-2026-09-04.json"


def test_financial_statements_are_embedded_unchanged(built):
    _original, merged, _ins = built
    src = (mm.APP / "statements_data.js").read_text(encoding="utf-8").strip()
    assert "<script>" + src + "</script>" in merged
    fs = json.loads(mm.js_object(mm.APP / "statements_data.js"))
    assert round(fs["balance_sheets"]["2025-12-31"]["total_assets"]) == 20296416


def test_committed_output_is_current(built):
    _original, merged, _ins = built
    if not mm.OUT_HTML.exists():
        pytest.skip("merged file not built")
    assert mm.OUT_HTML.read_text(encoding="utf-8") == merged, "run python3 merge_into_mobile.py"
