"""مركز القيادة — لوحة موحّدة تجمع مخرجات كل مراحل التحليل في صفحة واحدة.

يقرأ ملفات ``data/processed/`` كما تولّدها نصوص ``analysis/`` و``executive_dashboard/src/``،
ويتحقق من أن كل رقم يعرضه يساوي إجمالي مصدره قبل أن يكتب أي مخرج، ثم يكتب:

* ``command_center/data.json`` — نموذج البيانات المجمّع.
* ``command_center/index.html`` — الصفحة المستقلة (البيانات مضمّنة، بلا مكتبات ولا إنترنت).

لا يُقدَّر أي رقم غائب: الشهر الذي لا قائمة له يُعلَّم «يحتاج بيانات»، والتاريخ الناقص «جزئي».

التشغيل::

    python3 command_center/build.py
"""

from __future__ import annotations

import base64
import json
import math
import os
import sys
from datetime import date
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
PROC = ROOT / "data" / "processed"
OUT_DIR = Path(__file__).resolve().parent
TEMPLATE = OUT_DIR / "template.html"
LOGO = ROOT / "executive_dashboard" / "assets" / "abohashem-logo.png"

BRAND_ORDER = ["الهنا", "ابوهاشم", "اسبشيال", "غير مصنف"]
AR_MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"]
TOL = 0.5  # جنيه: سماحية التقريب عند مطابقة الإجماليات

CHECKS: list[dict] = []


def check(name: str, a: float, b: float, tol: float = TOL) -> None:
    """يسجّل مطابقة رقمين ويوقف البناء إن اختلفا."""
    ok = abs(float(a) - float(b)) <= tol
    CHECKS.append({"check": name, "a": round(float(a), 2), "b": round(float(b), 2), "ok": ok})
    if not ok:
        raise SystemExit(f"FAIL {name}: {a} != {b}")


def load_json(name: str) -> dict:
    return json.loads((PROC / name).read_text(encoding="utf-8"))


def r2(x: float | None) -> float | None:
    if x is None or (isinstance(x, float) and math.isnan(x)):
        return None
    return round(float(x), 2)


def build_sales() -> dict:
    """مبيعات الفواتير: الشهور × العلامات، أعلى العملاء والأصناف، باريتو."""
    tx = pd.read_csv(PROC / "sales_transactions_enriched.csv", dtype={"customer_code": str})
    tx["date"] = pd.to_datetime(tx["invoice_date"], format="%Y/%m/%d")
    tx["month"] = tx["date"].dt.strftime("%Y-%m")
    tx["brand"] = tx["brand"].fillna("غير مصنف")

    series = pd.read_csv(PROC / "eda_monthly_series.csv")
    months = series["month"].tolist()

    by_month = tx.groupby("month")["line_total"].sum().reindex(months, fill_value=0.0)
    for m, v in zip(months, series["revenue"]):
        check(f"إيراد {m} = eda_monthly_series", by_month[m], v)

    eda = load_json("eda_summary.json")
    check("إجمالي الإيراد = eda_summary", tx["line_total"].sum(), float(eda["total_revenue"]))

    brands = {}
    cube = tx.pivot_table(index="brand", columns="month", values="line_total", aggfunc="sum").reindex(columns=months).fillna(0.0)
    for b in BRAND_ORDER:
        if b in cube.index:
            brands[b] = [r2(v) for v in cube.loc[b].tolist()]
    check("مجموع العلامات = الإجمالي", sum(sum(v) for v in brands.values()), tx["line_total"].sum(), tol=5)

    pareto = pd.read_csv(PROC / "eda_customer_pareto_abc.csv", dtype={"customer_code": str})
    dim = pd.read_csv(PROC / "dim_customers.csv", dtype={"customer_code": str})
    rep_of = dict(zip(dim["customer_code"], dim["rep"].fillna("")))

    top_codes = pareto.head(25)["customer_code"].tolist()
    cust_cube = (
        tx[tx["customer_code"].isin(top_codes)]
        .pivot_table(index="customer_code", columns="month", values="line_total", aggfunc="sum")
        .reindex(columns=months)
        .fillna(0.0)
    )
    cust_brand = tx.pivot_table(index="customer_code", columns="brand", values="line_total", aggfunc="sum").fillna(0.0)
    customers = []
    for _, row in pareto.head(25).iterrows():
        code = row["customer_code"]
        customers.append({
            "code": code,
            "name": row["customer_name"],
            "rep": rep_of.get(code, ""),
            "revenue": r2(row["line_total"]),
            "share": r2(row["line_total"] / tx["line_total"].sum() * 100),
            "abc": row["abc_class"],
            "xyz": row["xyz_class"],
            "monthly": [r2(v) for v in cust_cube.loc[code].tolist()],
            "brands": {b: r2(cust_brand.loc[code].get(b, 0.0)) for b in BRAND_ORDER if b in cust_brand.columns},
        })

    curve_idx = sorted({min(len(pareto) - 1, int(round(p / 100 * len(pareto))) - 1) for p in range(1, 101)})
    curve = [[r2(pareto.iloc[i]["rank_pct"]), r2(pareto.iloc[i]["cum_pct"])] for i in curve_idx if i >= 0]

    items_df = pd.read_csv(PROC / "eda_item_abc_xyz.csv")
    item_cube = tx.pivot_table(index="item_name_canonical", columns="month", values="line_total", aggfunc="sum").reindex(columns=months).fillna(0.0)
    item_qty = tx.groupby("item_name_canonical")["qty"].sum()
    items = []
    for _, row in items_df.head(25).iterrows():
        name = row["item_name_canonical"]
        items.append({
            "name": name,
            "brand": row["brand"] if isinstance(row["brand"], str) else "غير مصنف",
            "revenue": r2(row["line_total"]),
            "qty": r2(item_qty.get(name, 0.0)),
            "abc": row["abc_class"],
            "xyz": row["xyz_class"],
            "monthly": [r2(v) for v in item_cube.loc[name].tolist()],
        })

    abc_counts = pareto["abc_class"].value_counts().to_dict()
    item_abc = items_df["abc_class"].value_counts().to_dict()

    return {
        "months": months,
        "revenue": [r2(v) for v in series["revenue"]],
        "qty": [r2(v) for v in series["qty"]],
        "invoices": series["n_invoices"].astype(int).tolist(),
        "active_customers": series["n_customers"].astype(int).tolist(),
        "asp": [r2(v) for v in series["avg_selling_price"]],
        "brands": brands,
        "customers": customers,
        "items": items,
        "pareto_curve": curve,
        "abc_counts": {k: int(v) for k, v in abc_counts.items()},
        "item_abc_counts": {k: int(v) for k, v in item_abc.items()},
        "totals": {
            "revenue": r2(tx["line_total"].sum()),
            "qty": r2(tx["qty"].sum()),
            "invoices": int(tx["invoice_no"].nunique()),
            "customers": int(eda["n_customers"]),
            "items": int(eda["n_items"]),
            "top10_share": float(eda["top10_customers_revenue_share_pct"]),
            "hhi_customers": float(eda["hhi_customers"]),
            "bonus_lines": int(tx["is_bonus"].sum()),
        },
        "period": {"from": tx["date"].min().strftime("%Y-%m-%d"), "to": tx["date"].max().strftime("%Y-%m-%d")},
    }


def build_pnl() -> dict:
    """قائمة الدخل 2025 (شهرية) و2026 (الربع الأول مجمّع ثم شهرية)."""
    h1 = load_json("income_2025h1.json")
    i26 = load_json("income_2026.json")
    rows = []
    confirm = set(h1.get("feb_mar", {}).get("months", [])[1:])  # مارس يطبع نفس فبراير
    for m in h1["months"]:
        check(f"مجمل ربح {m['month']} = صافي − تكلفة", m["net_sales"] - m["cogs"] + m.get("earned_discount", 0) - m.get("inbound_freight", 0), m["gross_profit"], tol=2)
        rows.append({
            "period": m["month"], "label": m["month"], "months": 1, "start": m["month"],
            "net_sales": r2(m["net_sales"]), "cogs": r2(m["cogs"]), "gross_profit": r2(m["gross_profit"]),
            "net_profit": None,
            "status": "يحتاج تأكيد" if m["month"] in confirm else "مستخرج من نص PDF",
        })
    for miss in h1["missing"]:
        rows.append({"period": miss["month"], "label": miss["month"], "months": 1, "start": miss["month"], "net_sales": None, "cogs": None,
                     "gross_profit": None, "net_profit": None, "status": "يحتاج بيانات", "reason": miss["reason"]})
    for m in h1["h2"]:
        check(f"مجمل ربح {m['month']}", m["net_sales"] - m["cogs"], m["gross_profit"], tol=2)
        rows.append({"period": m["month"], "label": m["month"], "months": 1, "start": m["month"],
                     "net_sales": r2(m["net_sales"]), "cogs": r2(m["cogs"]), "gross_profit": r2(m["gross_profit"]),
                     "net_profit": r2(m["net_profit"]), "status": "معتمد"})
    for p in i26["periods"]:
        check(f"مجمل ربح {p['period']}", p["net_sales"] - p["cogs"], p["gross_profit"], tol=2)
        sec = p["sections"]
        expenses = sum(v for v in sec.values() if v)
        rows.append({
            "period": p["period"], "label": p["period"] if len(p["months"]) == 1 else "الربع الأول 2026",
            "months": len(p["months"]), "start": p["months"][0], "end": p["months"][-1],
            "net_sales": r2(p["net_sales"]), "cogs": r2(p["cogs"]), "gross_profit": r2(p["gross_profit"]),
            "net_profit": r2(p["net_profit"]),
            "expenses": {k: r2(v) for k, v in sec.items()},
            "expenses_total": r2(expenses),
            "status": "معتمد",
        })
    # «2026-Q1» يُرتَّب بأول شهوره، لا نصيًّا (Q تأتي بعد الأرقام)
    rows.sort(key=lambda r: r["start"])
    for r in rows:
        if r["net_sales"]:
            r["gm_pct"] = r2(r["gross_profit"] / r["net_sales"] * 100)
            r["nm_pct"] = r2(r["net_profit"] / r["net_sales"] * 100) if r["net_profit"] is not None else None
    ytd = [r for r in rows if r["period"].startswith("2026")]
    ytd_sales = sum(r["net_sales"] for r in ytd)
    ytd_gp = sum(r["gross_profit"] for r in ytd)
    ytd_np = sum(r["net_profit"] for r in ytd)
    h2 = [r for r in rows if "2025-07" <= r["start"] <= "2025-12"]
    return {
        "rows": rows,
        "ytd_2026": {"months": sum(r["months"] for r in ytd), "net_sales": r2(ytd_sales), "gross_profit": r2(ytd_gp),
                     "net_profit": r2(ytd_np), "gm_pct": r2(ytd_gp / ytd_sales * 100), "nm_pct": r2(ytd_np / ytd_sales * 100),
                     "through": ytd[-1].get("end", ytd[-1]["start"])},
        "h2_2025": {"net_sales": r2(sum(r["net_sales"] for r in h2)), "net_profit": r2(sum(r["net_profit"] for r in h2)),
                    "gross_profit": r2(sum(r["gross_profit"] for r in h2))},
    }


def build_ar() -> dict:
    """تاريخ المديونية: إجمالي كل تاريخ، المندوب × التاريخ، وجسر الحركة."""
    a = load_json("ar_history.json")
    dates = a["meta"]["dates"]
    reps = a["meta"]["reps"]
    matrix = []
    for rep in a["reps"]:
        # تقرير غائب يُحفظ null في المصدر: يبقى فجوة «يحتاج بيانات» ولا يُرحَّل
        cells = [rep["by_date"].get(d) or {} for d in dates]
        matrix.append({"rep": rep["rep"], "values": [r2(c.get("net")) for c in cells],
                       "customers": [c.get("customers") for c in cells]})
    for t in a["totals"]:
        s = sum(m["values"][dates.index(t["date"])] or 0 for m in matrix)
        check(f"مديونية {t['date']} = مجموع المناديب", s, t["net"], tol=1)

    latest_complete = max((t for t in a["totals"] if t["complete"]), key=lambda t: t["date"])
    latest = a["totals"][-1]
    # أعلى العملاء رصيدًا في آخر تاريخ مكتمل، مع مسار أرصدتهم
    top = []
    for c in a["customers"]:
        v = c["by_date"].get(latest_complete["date"])
        if v:
            top.append({"code": c["code"], "name": c["name"], "rep": v.get("rep", ""), "net": r2(v["net"]),
                        "path": [r2(c["by_date"][d]["net"]) if d in c["by_date"] else None for d in dates]})
    top.sort(key=lambda x: -x["net"])
    conc = sum(x["net"] for x in top[:10]) / latest_complete["net"] * 100

    periods = []
    for p in a["rollforward"]["periods"]:
        t = p["totals"]
        check(f"جسر {p['from']}→{p['to']}", t["opening"] + t["sales"] - t["receipts"] - t["returns"] + t["gap"], t["closing"], tol=1)
        periods.append({"from": p["from"], "to": p["to"], "customers": p["customers"], "tied": p["tied"],
                        "after_extract": p["after_extract"], **{k: r2(v) for k, v in t.items()},
                        "collection_rate": r2(t["receipts"] / (t["opening"] + t["sales"]) * 100)})
    return {
        "dates": dates, "reps": reps, "matrix": matrix,
        "totals": [{"date": t["date"], "net": r2(t["net"]), "complete": t["complete"], "missing": t["missing"]} for t in a["totals"]],
        "latest_complete": {"date": latest_complete["date"], "net": r2(latest_complete["net"])},
        "latest": {"date": latest["date"], "net": r2(latest["net"]), "complete": latest["complete"], "missing": latest["missing"]},
        "top_customers": top[:20],
        "top10_concentration": r2(conc),
        "rollforward": periods,
        "note": a["meta"]["note"],
    }


def build_costing() -> dict:
    """هوامش الوصفات المؤكدة، والمخزون، والمشتريات."""
    rec = load_json("recipes.json")
    margins = []
    for c in rec["candidates"]:
        for it in c["items"]:
            if it.get("margin") is None:
                continue
            check(f"هامش {it['name']}", it["price"] - c["cost"], it["margin"], tol=0.01)
            margins.append({"name": it["name"], "brand": it["brand"], "family": it["family"], "grams": it["grams"],
                            "cost": r2(c["cost"]), "price": r2(it["price"]), "price_basis": it["price_basis"],
                            "margin": r2(it["margin"]), "margin_pct": r2(it["margin_pct"] * 100),
                            "commission": r2(it.get("selling_commission")), "qty": r2(it["qty"]), "revenue": r2(it["revenue"]),
                            "status": it["status"]})
    margins.sort(key=lambda m: -m["margin_pct"])

    ops = load_json("ops_data.json")
    inv = [{"date": v["date"], "raw": r2(v["raw_value"]), "fg": r2(v["fg_value"]), "total": r2(v["raw_value"] + v["fg_value"])}
           for v in ops["inventory"]["valuations"]]
    purchases = []
    for month, blk in sorted(ops["purchases"].items()):
        rows = blk["rows"]
        total = sum(r["total"] for r in rows)
        by_item: dict[str, float] = {}
        for r in rows:
            by_item[r["name"]] = by_item.get(r["name"], 0.0) + r["total"]
        top = sorted(by_item.items(), key=lambda kv: -kv[1])[:8]
        purchases.append({"month": month, "total": r2(total), "lines": len(rows),
                          "top": [{"name": k, "total": r2(v), "share": r2(v / total * 100)} for k, v in top]})
    returns = []
    for month, blk in sorted(ops["returns_items"].items()):
        returns.append({"month": month, "value": r2(sum(r["value"] for r in blk["rows"])), "lines": len(blk["rows"])})
    return {"margins": margins, "inventory": inv, "purchases": purchases, "returns": returns,
            "suppliers": {"as_of": ops["suppliers"]["as_of"], "net_credit": r2(ops["suppliers"]["net_credit"])},
            "commission_note": rec["meta"]["commission_note"]}


def build_forecast() -> dict:
    f = load_json("forecast_results.json")
    rows = [{k: (r2(v) if k != "month" else v) for k, v in r.items()} for r in f["forecast_company_revenue"]]
    cv = {k: {m: r2(x) for m, x in v.items()} for k, v in f["cv_summary"].items()}
    return {"rows": rows, "best_model": f["best_model_by_rolling_rmse"], "cv": cv, "note": f["method_note"]}


def build_quality() -> dict:
    q = load_json("data_quality_metrics.json")
    ts = load_json("timeseries_diagnostics.json")
    return {
        "rows": int(q["n_rows"]), "invoices": int(q["n_invoices"]),
        "zero_price_lines": int(q["n_zero_price_lines"]), "bonus_lines": int(q["n_bonus_lines"]),
        "duplicates": int(q["n_duplicate_line_candidates"]), "unparseable_dates": int(q["n_unparseable_dates"]),
        "adf_p": r2(ts["adf_level"]["pvalue"]), "kpss_p": r2(ts["kpss_level"]["pvalue"]),
        "dw": r2(ts["durbin_watson"]), "trend_r2": r2(ts["ols_trend_seasonal"]["r2"]),
    }


def ar_period(row: dict) -> str:
    """«2026-04» ← «أبريل 2026»، والربع المجمّع باسمه."""
    if row["months"] > 1:
        return "الربع الأول " + row["start"][:4]
    return f"{AR_MONTHS[int(row['start'][5:7]) - 1]} {row['start'][:4]}"


def build_insights(d: dict) -> list[dict]:
    """ملاحظات تنفيذية تُحسب من البيانات فقط — كل جملة تحمل رقمها ومصدرها."""
    s, p, a, c = d["sales"], d["pnl"], d["ar"], d["costing"]
    out = []
    rev = s["revenue"]
    h1_25 = sum(rev[0:6]); h1_26 = sum(rev[12:18])
    out.append({"level": "good" if h1_26 >= h1_25 else "serious", "area": "المبيعات",
                "text": f"إيراد الفواتير في النصف الأول 2026 بلغ {h1_26:,.0f} ج مقابل {h1_25:,.0f} ج في النصف الأول 2025 ({(h1_26 / h1_25 - 1) * 100:+.1f}%)."})
    out.append({"level": "warning" if s["totals"]["top10_share"] > 40 else "good", "area": "التركّز",
                "text": f"أعلى 10 عملاء يمثلون {s['totals']['top10_share']:.1f}% من الإيراد؛ أكبر عميل ({s['customers'][0]['name']}) وحده {s['customers'][0]['share']:.1f}%."})
    y = p["ytd_2026"]
    out.append({"level": "good", "area": "الربحية",
                "text": f"يناير–{AR_MONTHS[int(y['through'][-2:]) - 1]} 2026: صافي مبيعات {y['net_sales']:,.0f} ج، مجمل ربح {y['gm_pct']:.1f}%، صافي ربح {y['net_profit']:,.0f} ج ({y['nm_pct']:.1f}%)."})
    best = max((r for r in p["rows"] if r.get("nm_pct") is not None), key=lambda r: r["nm_pct"])
    worst = min((r for r in p["rows"] if r.get("nm_pct") is not None), key=lambda r: r["nm_pct"])
    out.append({"level": "warning", "area": "الربحية",
                "text": f"هامش صافي الربح تذبذب بين {worst['nm_pct']:.1f}% ({ar_period(worst)}) و{best['nm_pct']:.1f}% ({ar_period(best)})."})
    lc = a["latest_complete"]
    out.append({"level": "warning" if a["top10_concentration"] > 35 else "good", "area": "المديونية",
                "text": f"آخر لقطة مكتملة ({lc['date']}): مديونية {lc['net']:,.0f} ج، وأعلى 10 عملاء يحملون {a['top10_concentration']:.1f}% منها."})
    last = a["rollforward"][-1]
    out.append({"level": "serious" if abs(last["gap"]) > 0.1 * last["opening"] else "good", "area": "مطابقة الحركة",
                "text": f"فترة {last['from']}→{last['to']}: فجوة مطابقة {last['gap']:,.0f} ج بين الرصيد المحسوب والمطبوع — تقارير «{'، '.join(a['latest']['missing'])}» غائبة عن آخر تاريخ."})
    neg = [m for m in c["margins"] if m["margin"] < 0]
    for m in neg:
        out.append({"level": "critical", "area": "التسعير",
                    "text": f"«{m['name']}» يُباع بـ {m['price']:,.2f} ج وتكلفة عبوته {m['cost']:,.2f} ج: هامش {m['margin_pct']:.1f}% (سالب)."})
    top_m = c["margins"][0]
    out.append({"level": "good", "area": "التسعير",
                "text": f"أعلى هامش وصفة: «{top_m['name']}» {top_m['margin_pct']:.1f}% ({top_m['margin']:,.2f} ج للعبوة)."})
    inv = c["inventory"]
    out.append({"level": "warning" if inv[-1]["fg"] < inv[0]["fg"] * 0.6 else "good", "area": "المخزون",
                "text": f"مخزون التام انخفض من {inv[0]['fg']:,.0f} ج ({inv[0]['date']}) إلى {inv[-1]['fg']:,.0f} ج ({inv[-1]['date']}) — راجع كفاية التغطية."})
    return out


def main() -> None:
    data = {
        "meta": {
            "title": "مركز القيادة — أبو هاشم للحوم",
            "generated": date.today().isoformat(),
            "sources": sorted(p.name for p in PROC.glob("*.json")) + ["sales_transactions_enriched.csv", "eda_*.csv", "dim_customers.csv"],
        },
        "sales": build_sales(),
        "pnl": build_pnl(),
        "ar": build_ar(),
        "costing": build_costing(),
        "forecast": build_forecast(),
        "quality": build_quality(),
    }
    # مسار رصيد المديونية لكل عميل من أعلى عملاء المبيعات (للتنقيب)
    ar_src = {c["code"]: c for c in load_json("ar_history.json")["customers"]}
    for cust in data["sales"]["customers"]:
        c = ar_src.get(cust["code"])
        cust["ar_path"] = [r2((c["by_date"].get(d) or {}).get("net")) for d in data["ar"]["dates"]] if c else None
    data["insights"] = build_insights(data)
    data["checks"] = CHECKS

    payload = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    (OUT_DIR / "data.json").write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    logo = "data:image/png;base64," + base64.b64encode(LOGO.read_bytes()).decode() if LOGO.exists() else ""
    body = (TEMPLATE.read_text(encoding="utf-8")
            .replace("/*__DATA__*/null", payload.replace("</", "<\\/"))
            .replace("__LOGO__", logo))
    # الصفحة المحلية مستند كامل؛ نسخة النشر (COMMAND_CENTER_ARTIFACT) بلا هيكل لأن المنصة تضيفه
    html = ('<!doctype html>\n<html lang="ar" dir="rtl">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
            '</head>\n<body>\n' + body + '\n</body>\n</html>\n')
    (OUT_DIR / "index.html").write_text(html, encoding="utf-8")
    if os.environ.get("COMMAND_CENTER_ARTIFACT"):
        Path(os.environ["COMMAND_CENTER_ARTIFACT"]).write_text(body, encoding="utf-8")

    failed = [c for c in CHECKS if not c["ok"]]
    print(f"checks: {len(CHECKS)} PASS, {len(failed)} FAIL")
    print(f"wrote {OUT_DIR / 'index.html'} ({len(html) / 1024:.0f} KB)")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
