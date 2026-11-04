#!/usr/bin/env python3
"""How long the mobile dashboard takes to open — an emulated mid-range phone.

Opens mobile/Abu_Hashem_Mobile_full.html in headless Chromium at 390×844
(DPR 2) with the CPU slowed 4× through the DevTools protocol, the usual
stand-in for a mid-range Android phone. The file is local, so there is no
network time: these numbers are parse + script + first render only.

Measured per run, in milliseconds from navigation start:
  dom      DOMContentLoaded (HTML parsed, inline scripts run)
  load     the load event
  ready    the first section has rendered its figures (App state.ready and
           the KPI tiles are in the page)

Usage: python3 measure_open.py [--runs 5] [--cpu 4] [--file other.html]
This is an emulation, not a device measurement; record it as such.
"""
import argparse
import statistics
from pathlib import Path

APP = Path(__file__).resolve().parent
FULL = APP / "mobile" / "Abu_Hashem_Mobile_full.html"

READY = """() => {
  const s = document.querySelector('[data-print="scroll"]');
  return !!s && /ج\\.م/.test(s.innerText) && performance.now();
}"""


def measure(runs: int, cpu: float, path: Path = FULL) -> dict:
    from playwright.sync_api import sync_playwright
    out = {"dom": [], "load": [], "ready": []}
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for _ in range(runs):
            ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True,
                                      has_touch=True)
            page = ctx.new_page()
            cdp = ctx.new_cdp_session(page)
            cdp.send("Emulation.setCPUThrottlingRate", {"rate": cpu})
            page.goto(path.resolve().as_uri(), wait_until="load", timeout=120_000)
            ready = page.wait_for_function(READY, timeout=120_000, polling=50).json_value()
            nav = page.evaluate("() => performance.getEntriesByType('navigation')[0].toJSON()")
            out["dom"].append(nav["domContentLoadedEventEnd"])
            out["load"].append(nav["loadEventEnd"])
            out["ready"].append(ready)
            ctx.close()
        browser.close()
    return out


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--runs", type=int, default=5)
    ap.add_argument("--cpu", type=float, default=4.0, help="CPU slowdown factor (1 = this machine)")
    ap.add_argument("--file", type=Path, default=FULL, help="another build to compare")
    args = ap.parse_args(argv)
    res = measure(args.runs, args.cpu, args.file)
    size = args.file.stat().st_size / 1e6
    print(f"{args.file.name}: {size:.1f} MB · CPU ×{args.cpu:g} · {args.runs} runs (median, min–max ms)")
    for k, v in res.items():
        print(f"  {k:<6} {statistics.median(v):8.0f}   {min(v):.0f}–{max(v):.0f}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
