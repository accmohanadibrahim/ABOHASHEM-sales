/* ============================================================================
   Abu Hashem — Executive Financial Dashboard · client runtime
   Reads window.DASH (pre-aggregated by build.py), renders every visualization
   with the vendored ECharts / Plotly, wires DataTables exports, cross-filtering,
   drill-through and theming. No backend, no network.
   ========================================================================== */
(function () {
"use strict";
const D = window.DASH;
if (!D) { document.body.innerHTML = "<p style='padding:40px'>data.js لم يُحمّل</p>"; return; }

/* ---- palette / formatters ------------------------------------------------ */
const PAL = ["#3b82f6","#8b5cf6","#10b981","#f59e0b","#ef4444","#06b6d4","#f97316","#ec4899","#c4b5fd","#34d399"];
const AGING_KEYS = ["current","d1_30","d31_60","d61_90","d91_120","d120p"];
const AGING_COLORS = {current:"#10b981",d1_30:"#34d399",d31_60:"#f59e0b",d61_90:"#f97316",d91_120:"#ef4444",d120p:"#dc2626"};

const egp = x => (Math.round(x||0)).toLocaleString("en-US") + " ج.م";
const egpK = x => { x=x||0; const a=Math.abs(x);
  if(a>=1e6) return (x/1e6).toFixed(2)+"M ج.م";
  if(a>=1e3) return (x/1e3).toFixed(1)+"K ج.م"; return Math.round(x)+" ج.م"; };
const num = x => (Math.round((x||0)*100)/100).toLocaleString("en-US");
const int = x => Math.round(x||0).toLocaleString("en-US");
const pct = (x,d=1) => ((x||0)*100).toFixed(d) + "%";
const MONTHLABEL = Object.fromEntries((D.meta.available_months||[]).map(m=>[m.v,m.l]));
const ALL_LABEL = D.meta.all_months_label || "جميع الشهور";
const DATA_MONTHS = new Set(D.meta.data_months || []);      // months carrying source data
const monthHasData = m => !m || m==="all" || DATA_MONTHS.has(m);
const monthName = ym => MONTHLABEL[ym] || ym;
// code -> display name (derived once from the line-level data)
const CUST_NAME = {}, ITEM_NAME = {};
D.lines.forEach(l => { CUST_NAME[l.customer_code] = l.customer_name; ITEM_NAME[l.item_code] = l.item_name; });
const curMonthLabel = () => {
  const m = (typeof state!=="undefined" && state.filters.month) || D.meta.default_month;
  if (!m || m==="all") return ALL_LABEL;
  return (MONTHLABEL[m] || m) + (monthHasData(m) ? "" : " — لا توجد بيانات");
};

/* ---- state --------------------------------------------------------------- */
const state = { filters:{month:(D.meta.default_month||"2026-06"),
  customer:"",rep:"",brand:"",item:"",status:"",aging:""}, section:"overview" };
const charts = {};                       // id -> echarts instance
const tables = {};                       // id -> DataTable
const isLight = () => document.body.getAttribute("data-theme") === "light";

/* ========================================================================== */
/*  CONTEXT — apply filters and recompute the aggregates the views consume     */
/* ========================================================================== */
function buildContext() {
  const f = state.filters;
  const mAll = !f.month || f.month === "all";
  let lines = D.lines.filter(l =>
    (mAll || l.month === f.month) &&
    (!f.customer || l.customer_code === f.customer) &&
    (!f.rep      || l.rep === f.rep) &&
    (!f.brand    || l.brand === f.brand) &&
    (!f.item     || l.item_code === f.item));
  const invSet = new Set(lines.map(l => l.invoice_no));
  let invoices = D.invoices.filter(v =>
    (mAll || v.month === f.month) &&
    (!f.customer || v.customer_code === f.customer) &&
    (!f.rep      || v.rep === f.rep) &&
    (!f.status   || v.status === f.status) &&
    ((!f.brand && !f.item) || invSet.has(v.invoice_no)));
  if (f.status) { const s = new Set(invoices.map(v => v.invoice_no)); lines = lines.filter(l => s.has(l.invoice_no)); }

  // Receivables is a fixed AR snapshot; narrow it to the month's active cohort.
  const active = new Set(invoices.map(v => v.customer_code));
  const recv = D.receivables.rows.filter(r =>
    (mAll || active.has(r.customer_code)) &&
    (!f.customer || r.customer_code === f.customer) &&
    (!f.rep      || r.rep === f.rep) &&
    (!f.aging    || r.bucket === f.aging));

  const customers = aggCustomers(lines, invoices);
  return { lines, invoices, recv, customers, products: aggProducts(lines),
           buckets: bucketsFromRows(recv),
           kpis: aggKpis(lines, invoices, recv, customers) };
}

/* Per-customer monthly aggregates joined with the fixed AR / bonus snapshot. */
function aggCustomers(lines, invoices) {
  const asOf = new Date(D.meta.as_of);
  const net = D.meta.net_terms_days;
  const m = new Map();
  for (const v of invoices) {
    let o = m.get(v.customer_code);
    if (!o) { o = { customer_code:v.customer_code, customer_name:v.customer_name,
      sales:0, collections:0, invs:new Set(), unpaid:[] }; m.set(v.customer_code, o); }
    o.sales += v.reported_total||0; o.collections += v.paid||0; o.invs.add(v.invoice_no);
    if (v.remaining>0 && v.reported_total>0) o.unpaid.push(v);
  }
  const lm = new Map();
  for (const l of lines) {
    let o = lm.get(l.customer_code);
    if (!o) { o = { units:0, boxes:0, items:new Set() }; lm.set(l.customer_code, o); }
    o.units += l.qty||0; o.boxes += l.boxes||0; o.items.add(l.item_code);
  }
  const rows = [...m.values()].map(o => {
    const ar = D.customer_ar[o.customer_code] || {};
    const l = lm.get(o.customer_code) || { units:0, boxes:0, items:new Set() };
    const nInv = o.invs.size;
    const rec = {
      customer_code:o.customer_code, customer_name:o.customer_name,
      rep: ar.rep || "غير محدد", city: ar.city || "",
      sales: round2(o.sales), collections: round2(o.collections),
      n_invoices: nInv, n_items: l.items.size, units: round2(l.units), boxes: round2(l.boxes),
      avg_invoice_value: nInv ? round2(o.sales/nInv) : 0,
      total_billed: ar.total_billed != null ? ar.total_billed : round2(o.sales),
      billed_2026: ar.billed_2026 != null ? ar.billed_2026 : null,
      outstanding: ar.outstanding != null ? ar.outstanding : null,
      collected_actual: ar.collected_actual != null ? ar.collected_actual : null,
      returns_actual: ar.returns_actual != null ? ar.returns_actual : null,
      collection_rate: ar.collection_rate != null ? ar.collection_rate : null,
      rate_source: ar.rate_source || "none",
      bonus_pct: ar.bonus_pct || 0, has_ar: !!ar.has_ar,
    };
    rec.bonus_value = round2(o.sales * rec.bonus_pct);
    if (o.unpaid.length) {
      o.unpaid.sort((a,b)=>a.invoice_date<b.invoice_date?-1:1);
      const u = o.unpaid[0]; const due = new Date(u.invoice_date); due.setDate(due.getDate()+net);
      rec.oldest_invoice_no = u.invoice_no; rec.oldest_invoice_date = u.invoice_date;
      rec.oldest_due_date = due.toISOString().slice(0,10);
      rec.oldest_days_overdue = Math.max(0, Math.round((asOf-due)/864e5));
      rec.oldest_amount = round2(u.remaining);
    }
    return rec;
  }).sort((a,b)=>b.sales-a.sales);
  rows.forEach((r,i)=>r.rank=i+1);
  return rows;
}

/* Aging buckets recomputed from the (filtered) AR rows — keeps the chart in sync
   with the month / cross-filter selection. Each row carries its exact per-bucket
   FIFO breakdown, so summing them reconciles precisely to the outstanding total. */
function bucketsFromRows(rows) {
  const b = { current:0, d1_30:0, d31_60:0, d61_90:0, d91_120:0, d120p:0 };
  for (const r of rows) {
    if (r.buckets) { for (const k in b) b[k] += r.buckets[k]||0; }
    else { b.current += r.current||0; if (r.overdue>0) b[r.bucket] += r.overdue||0; }
  }
  return b;
}
const round2 = x => Math.round((x||0)*100)/100;

function aggKpis(lines, invoices, recv, customers) {
  const total_sales = sum(invoices, "reported_total");
  const net_sales = sum(lines, "line_total");
  const qty = sum(lines, "qty");
  const boxes = lines.reduce((a,l)=>a+(l.boxes||0),0);
  const priced = lines.filter(l => l.qty>0 && l.line_total>0);
  const asp = priced.length ? sum(priced,"line_total")/sum(priced,"qty") : 0;
  const outstanding = sum(recv,"outstanding"), overdue = sum(recv,"overdue");
  const billed = customers.reduce((a,c)=>a+(c.total_billed||0),0);
  const cust_out = customers.reduce((a,c)=>a+(c.outstanding||0),0);
  // Collection rate — from ACTUAL 2026 cash receipts when available (real cash
  // collected ÷ billed in 2026 for the filtered cohort); otherwise the billed-
  // vs-outstanding proxy. Kept consistent with the recomputed backend KPI.
  const collected_actual = customers.reduce((a,c)=>a+(c.collected_actual||0),0);
  const billed_2026 = customers.reduce((a,c)=>a+(c.billed_2026||0),0);
  const returns_actual = customers.reduce((a,c)=>a+(c.returns_actual||0),0);
  const collection_rate = D.collections && billed_2026
    ? Math.max(0,Math.min(1,collected_actual/billed_2026))
    : (billed ? Math.max(0,Math.min(1,(billed-cust_out)/billed)) : 0);
  const nInv = new Set(invoices.map(v=>v.invoice_no)).size;
  return {
    total_sales, net_sales, qty, boxes, asp, outstanding, overdue, collection_rate,
    collected_actual, billed_2026, returns_actual,
    collection_rate_basis: (D.collections && billed_2026) ? "actual" : "proxy",
    collections_at_issue: sum(invoices,"paid"),
    n_invoices: nInv,
    n_customers: new Set(invoices.map(v=>v.customer_code)).size,
    zero_invoices: invoices.filter(v=>!v.reported_total).length,
    avg_invoice_value: nInv ? total_sales/nInv : 0,
  };
}

function aggProducts(lines) {
  const m = new Map();
  const grand = sum(lines,"line_total") || 1;
  for (const l of lines) {
    let o = m.get(l.item_code);
    if (!o) { o={item_code:l.item_code,item_name:l.item_name,brand:l.brand,sales:0,qty:0,boxes:0,
                 cust:new Set(),n_lines:0,prices:[]}; m.set(l.item_code,o); }
    o.sales+=l.line_total||0; o.qty+=l.qty||0; o.boxes+=l.boxes||0; o.n_lines++;
    o.cust.add(l.customer_code); if(l.unit_price>0) o.prices.push(l.unit_price);
  }
  const rows=[...m.values()].map(o=>{
    const pr=o.prices;
    return {item_code:o.item_code,item_name:o.item_name,brand:o.brand,sales:o.sales,qty:o.qty,
      boxes:o.boxes,n_customers:o.cust.size,n_lines:o.n_lines,
      max_price:pr.length?Math.max(...pr):null,min_price:pr.length?Math.min(...pr):null,
      asp:o.qty?o.sales/o.qty:0,contribution_pct:o.sales/grand*100,prices:pr};
  }).sort((a,b)=>b.sales-a.sales);
  rows.forEach((r,i)=>r.rank=i+1);
  return rows;
}
const sum = (arr,k) => arr.reduce((a,x)=>a+(x[k]||0),0);
function groupSum(arr,key,val){const m=new Map();for(const x of arr){const k=x[key];m.set(k,(m.get(k)||0)+(x[val]||0));}return m;}

/* ========================================================================== */
/*  ECharts helpers                                                            */
/* ========================================================================== */
function ecBase() {
  const ink = isLight() ? "#0f172a" : "#e2e8f0";
  const muted = isLight() ? "#475569" : "#94a3b8";
  const grid = isLight() ? "rgba(15,23,42,.08)" : "rgba(255,255,255,.06)";
  return {
    color: PAL,
    textStyle:{fontFamily:"Cairo, sans-serif",color:ink},
    grid:{left:14,right:18,top:34,bottom:24,containLabel:true},
    tooltip:{backgroundColor:isLight()?"#fff":"#0d1220",borderColor:grid,
      textStyle:{color:ink,fontFamily:"Cairo"},confine:true},
    legend:{textStyle:{color:muted},top:4,type:"scroll"},
    _ink:ink,_muted:muted,_grid:grid,
  };
}
function ec(id, option) {
  const el = document.getElementById(id);
  if (!el) return;
  let c = charts[id];
  if (c) { c.dispose(); }
  c = echarts.init(el, null, {renderer:"canvas"});
  c.setOption(option);
  charts[id] = c;
  return c;
}
function axis(base, opt) { // shared cartesian axis styling
  const st = {axisLine:{lineStyle:{color:base._grid}},axisLabel:{color:base._muted},
    splitLine:{lineStyle:{color:base._grid}},axisTick:{show:false}};
  return Object.assign({}, st, opt);
}
window.addEventListener("resize", () => Object.values(charts).forEach(c=>c&&c.resize()));

/* ========================================================================== */
/*  Insight box                                                                */
/* ========================================================================== */
function insight(key) {
  // Months with no source data carry no insights — show nothing rather than
  // falling back to another period's commentary.
  const mk = state.filters.month;
  const set = (mk && mk !== "all") ? D.insights_by_month[mk] : D.insights_by_month["all"];
  if (!set) return "";
  const it = set[key];
  if (!it) return "";
  const p = it.priority.includes("عالية")?"p-high":it.priority.includes("متوسطة")?"p-med":"p-low";
  const row = (k,v)=>`<div class="row"><span class="k">${k}:</span><span>${v}</span></div>`;
  return `<div class="insight ${p}">
    <div class="insight-head"><h4>${it.title}</h4><span class="prio ${p}">أولوية ${it.priority}</span></div>
    <div class="insight-grid">
      ${row("ماذا حدث",it.what)}${row("لماذا",it.why)}
      ${row("المخاطر",it.risk)}${row("الفرص",it.opportunity)}
      <div class="row" style="grid-column:1/-1"><span class="k">الإجراء الموصى به:</span><span>${it.action}</span></div>
    </div></div>`;
}

/* ========================================================================== */
/*  Card factory                                                               */
/* ========================================================================== */
function card(o) { // {id,title,sub,cls,tall,short,approx,insightKey,plotly}
  const tools = o.noPng ? "" :
    `<button class="mini-btn" data-png="${o.id}">PNG ⤓</button>`;
  const approx = o.approx ? `<span class="tag-approx">تقديري</span>` : "";
  const h = o.short?"short":o.tall?"tall":"";
  const chartEl = o.plotly ? `<div id="${o.id}" class="echart ${h}"></div>`
                           : `<div id="${o.id}" class="echart ${h}"></div>`;
  return `<div class="card ${o.cls||""}">
    <div class="card-head"><div><h3>${o.title}${approx}</h3>${o.sub?`<span class="sub">${o.sub}</span>`:""}</div>
      <div class="card-tools">${tools}</div></div>
    ${chartEl}
    ${o.insightKey?`<div class="ins-slot" data-ins="${o.insightKey}"></div>`:""}</div>`;
}
function tableCard(o) { // {id,title,approx}
  return `<div class="card span-2">
    <div class="card-head"><div><h3>${o.title}${o.approx?'<span class="tag-approx">تقديري</span>':''}</h3>
      ${o.sub?`<span class="sub">${o.sub}</span>`:""}</div></div>
    <div class="tbl-wrap"><table id="${o.id}" class="display" style="width:100%"></table></div>
    ${o.insightKey?`<div class="ins-slot" data-ins="${o.insightKey}"></div>`:""}</div>`;
}
/* Refresh all insight slots in the active section for the current month. */
function paintInsights(){
  document.querySelectorAll(".section.active .ins-slot").forEach(el=>{
    el.innerHTML = insight(el.dataset.ins);
  });
}

/* ========================================================================== */
/*  KPI cards                                                                  */
/* ========================================================================== */
const KPI_ICONS = {
  sales:'<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>', money:'<path d="M12 1v22"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>',
  users:'<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>',
  doc:'<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/>',
  box:'<path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8"/><path d="M3.3 7L12 12l8.7-5"/>',
  pct:'<path d="M19 5L5 19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
  warn:'<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><path d="M12 9v4M12 17h.01"/>',
  clock:'<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
};
function kpiCard(icon, val, label, accent, sub, subCls, delay) {
  return `<div class="kpi-card" style="--accent:${accent};animation-delay:${delay}s">
    <div class="kpi-ico"><svg viewBox="0 0 24 24" class="ic">${KPI_ICONS[icon]}</svg></div>
    <div class="kpi-val num">${val}</div><div class="kpi-lbl">${label}</div>
    ${sub?`<div class="kpi-sub ${subCls||""}">${sub}</div>`:""}</div>`;
}
function kpiGrid(k) {
  const mon = Object.fromEntries(D.monthly.map(m=>[m.month,m.net_sales]));
  const keys = D.monthly.map(m=>m.month);
  const cm = (state.filters.month && state.filters.month!=="all") ? state.filters.month : null;
  let salesSub="", salesCls="";
  if (cm) {
    const idx = keys.indexOf(cm), prevK = idx>0?keys[idx-1]:null;
    const prev = prevK?mon[prevK]:0, dv = prev?(k.total_sales-prev)/prev:0;
    salesSub = prevK ? (dv>=0?"▲ ":"▼ ")+pct(Math.abs(dv))+" مقابل "+monthName(prevK) : "";
    salesCls = dv>=0?"up":"down";
  } else { salesSub = "كل شهور ٢٠٢٦"; salesCls = "na"; }
  let i=0; const d=()=>0.04*(i++);
  return `<div class="kpi-grid">
    ${kpiCard("sales",egpK(k.total_sales),"إجمالي المبيعات","#3b82f6",salesSub,salesCls,d())}
    ${kpiCard("money",egpK(k.net_sales),"صافي المبيعات","#8b5cf6","","",d())}
    ${kpiCard("money",egpK(k.collections_at_issue),"التحصيل عند الإصدار","#06b6d4","بيع آجل","na",d())}
    ${kpiCard("money",egpK(k.outstanding),"المديونية القائمة","#f59e0b","لقطة "+D.meta.as_of,"na",d())}
    ${kpiCard("warn",egpK(k.overdue),"المتأخرات","#ef4444","تقديري","na",d())}
    ${kpiCard("pct",pct(k.collection_rate),"معدل التحصيل التراكمي","#10b981","","up",d())}
    ${kpiCard("money",egp(k.asp),"متوسط سعر البيع/وحدة","#c4b5fd","","",d())}
    ${kpiCard("box",int(k.qty),"إجمالي الكمية","#34d399","","",d())}
    ${kpiCard("box",int(k.boxes),"إجمالي الكراتين","#f97316","","",d())}
    ${kpiCard("users",int(k.n_customers),"عدد العملاء","#3b82f6","","",d())}
    ${kpiCard("doc",int(k.n_invoices),"عدد الفواتير","#8b5cf6","متوسط "+egpK(k.avg_invoice_value),"na",d())}
    ${kpiCard("warn",int(k.zero_invoices),"فواتير صفرية","#ef4444","بونص/عيّنات","na",d())}
    ${kpiCard("pct","غير متاح","هامش الربح الإجمالي","#64748b","لا توجد تكلفة","na",d())}
  </div>`;
}

/* ========================================================================== */
/*  Chart builders (each takes context D-like `X`)                             */
/* ========================================================================== */
function chMonthly(id,X){const b=ecBase();const rows=D.monthly.filter(m=>m.month>="2025-01");
  const cm=(state.filters.month&&state.filters.month!=="all")?state.filters.month:null;
  ec(id,{...b,tooltip:{...b.tooltip,trigger:"axis",valueFormatter:egp},
    xAxis:axis(b,{type:"category",data:rows.map(r=>r.month)}),
    yAxis:axis(b,{type:"value",axisLabel:{color:b._muted,formatter:egpK}}),
    series:[{type:"line",smooth:true,data:rows.map(r=>Math.round(r.net_sales)),
      areaStyle:{opacity:.22},lineStyle:{width:3,color:PAL[0]},itemStyle:{color:PAL[0]},
      markPoint:{data:[{type:"max",name:"الأعلى"}]},
      markLine:cm?{symbol:"none",data:[{xAxis:cm}],lineStyle:{color:PAL[3],type:"dashed",width:2},
        label:{show:true,color:b._muted,formatter:"الشهر المحدد"}}:undefined}]});}

function chDaily(id,X){const b=ecBase();
  const m=groupSum(X.invoices,"invoice_date","reported_total");
  const c=groupSum(X.invoices,"invoice_date","paid");
  const days=[...m.keys()].sort();
  ec(id,{...b,tooltip:{...b.tooltip,trigger:"axis",valueFormatter:egp},
    legend:{...b.legend,data:["المبيعات","التحصيل"]},
    xAxis:axis(b,{type:"category",data:days.map(d=>d.slice(5))}),
    yAxis:axis(b,{type:"value",axisLabel:{color:b._muted,formatter:egpK}}),
    series:[
      {name:"المبيعات",type:"line",smooth:true,areaStyle:{opacity:.2},lineStyle:{width:2.5,color:PAL[0]},
        itemStyle:{color:PAL[0]},data:days.map(d=>Math.round(m.get(d)))},
      {name:"التحصيل",type:"bar",itemStyle:{color:PAL[2]},data:days.map(d=>Math.round(c.get(d)||0))}]});}

function chTopCustomers(id,X,n){const b=ecBase();
  const cs=[...X.customers].sort((a,b2)=>b2.sales-a.sales).slice(0,n||20).reverse();
  ec(id,{...b,tooltip:{...b.tooltip,trigger:"axis",valueFormatter:egp},
    grid:{...b.grid,left:8},
    xAxis:axis(b,{type:"value",axisLabel:{color:b._muted,formatter:egpK}}),
    yAxis:axis(b,{type:"category",data:cs.map(c=>c.customer_name)}),
    series:[{type:"bar",data:cs.map(c=>Math.round(c.sales)),itemStyle:{color:PAL[0],borderRadius:[0,6,6,0]},
      label:{show:false}}]}).on("click",p=>openDrill(cs[p.dataIndex].customer_code));}

function chTopProducts(id,X,n){const b=ecBase();
  const ps=X.products.slice(0,n||20).reverse();
  ec(id,{...b,tooltip:{...b.tooltip,trigger:"axis",valueFormatter:egp},
    xAxis:axis(b,{type:"value",axisLabel:{color:b._muted,formatter:egpK}}),
    yAxis:axis(b,{type:"category",data:ps.map(p=>p.item_name)}),
    series:[{type:"bar",data:ps.map(p=>Math.round(p.sales)),
      itemStyle:{color:PAL[1],borderRadius:[0,6,6,0]}}]});}

function chPareto(id,X){const b=ecBase();
  const cs=[...X.customers].sort((a,b2)=>b2.sales-a.sales);
  const total=sum(cs,"sales")||1; let cum=0;
  const cats=cs.map(c=>c.customer_name), bar=cs.map(c=>Math.round(c.sales));
  const line=cs.map(c=>{cum+=c.sales;return +(cum/total*100).toFixed(1);});
  ec(id,{...b,tooltip:{...b.tooltip,trigger:"axis"},legend:{...b.legend,data:["المبيعات","التراكمي %"]},
    xAxis:axis(b,{type:"category",data:cats,axisLabel:{show:false}}),
    yAxis:[axis(b,{type:"value",axisLabel:{color:b._muted,formatter:egpK}}),
           axis(b,{type:"value",max:100,axisLabel:{color:b._muted,formatter:"{value}%"},splitLine:{show:false}})],
    series:[{name:"المبيعات",type:"bar",data:bar,itemStyle:{color:PAL[0]}},
      {name:"التراكمي %",type:"line",yAxisIndex:1,data:line,smooth:true,lineStyle:{color:PAL[3],width:2.5},
       itemStyle:{color:PAL[3]},markLine:{data:[{yAxis:80,name:"80%"}],
       lineStyle:{color:PAL[4],type:"dashed"},label:{formatter:"80%",color:b._muted}}}]});}

function chAgingBar(id,X){const b=ecBase();const bk=X.buckets;const lab=D.receivables.bucket_labels;
  ec(id,{...b,tooltip:{...b.tooltip,trigger:"axis",valueFormatter:egp},
    xAxis:axis(b,{type:"category",data:AGING_KEYS.map(k=>lab[k])}),
    yAxis:axis(b,{type:"value",axisLabel:{color:b._muted,formatter:egpK}}),
    series:[{type:"bar",data:AGING_KEYS.map(k=>Math.round(bk[k])),
      itemStyle:{color:p=>AGING_COLORS[AGING_KEYS[p.dataIndex]],borderRadius:[6,6,0,0]},
      label:{show:true,position:"top",color:b._muted,formatter:o=>egpK(o.value)}}]});}

function chAgingWaterfall(id,X){const b=ecBase();const bk=X.buckets;const lab=D.receivables.bucket_labels;
  let acc=0;const base=[],val=[];
  AGING_KEYS.forEach(k=>{base.push(acc);val.push(Math.round(bk[k]));acc+=bk[k];});
  ec(id,{...b,tooltip:{...b.tooltip,trigger:"axis",formatter:p=>{const i=p[1].dataIndex;
      return lab[AGING_KEYS[i]]+"<br/>"+egp(val[i]);}},
    xAxis:axis(b,{type:"category",data:AGING_KEYS.map(k=>lab[k])}),
    yAxis:axis(b,{type:"value",axisLabel:{color:b._muted,formatter:egpK}}),
    series:[{type:"bar",stack:"t",itemStyle:{color:"transparent"},data:base,silent:true},
      {type:"bar",stack:"t",data:val,itemStyle:{color:p=>AGING_COLORS[AGING_KEYS[p.dataIndex]],borderRadius:[4,4,0,0]}}]});}

function chByRep(id,X){const b=ecBase();
  const reps=[...X.recv.reduce((m,r)=>{const o=m.get(r.rep)||{c:0,o:0};o.c+=r.current;o.o+=r.overdue;m.set(r.rep,o);return m;},new Map())]
    .map(([rep,v])=>({rep,current:v.c,overdue:v.o,total:v.c+v.o})).sort((a,b2)=>b2.total-a.total);
  ec(id,{...b,tooltip:{...b.tooltip,trigger:"axis",valueFormatter:egp},legend:{...b.legend,data:["جاري","متأخرات"]},
    xAxis:axis(b,{type:"category",data:reps.map(r=>r.rep)}),
    yAxis:axis(b,{type:"value",axisLabel:{color:b._muted,formatter:egpK}}),
    series:[{name:"جاري",type:"bar",stack:"s",data:reps.map(r=>Math.round(r.current)),itemStyle:{color:PAL[2]}},
      {name:"متأخرات",type:"bar",stack:"s",data:reps.map(r=>Math.round(r.overdue)),itemStyle:{color:PAL[4],borderRadius:[6,6,0,0]}}]});}

function chGauge(id,rate){const b=ecBase();
  ec(id,{...b,series:[{type:"gauge",startAngle:210,endAngle:-30,min:0,max:100,radius:"92%",
    progress:{show:true,width:16,itemStyle:{color:PAL[2]}},
    axisLine:{lineStyle:{width:16,color:[[.7,"#ef4444"],[.9,"#f59e0b"],[1,"#10b981"]]}},
    pointer:{width:5,itemStyle:{color:b._ink}},axisTick:{show:false},splitLine:{length:12,lineStyle:{color:b._muted}},
    axisLabel:{color:b._muted,fontSize:10,distance:-38},
    detail:{valueAnimation:true,formatter:"{value}%",color:b._ink,fontSize:26,offsetCenter:[0,"38%"]},
    title:{offsetCenter:[0,"68%"],color:b._muted,fontSize:12},
    data:[{value:+(rate*100).toFixed(1),name:"معدل التحصيل"}]}]});}

function chDonut(id,pairs,fmt){const b=ecBase();
  ec(id,{...b,tooltip:{...b.tooltip,trigger:"item",valueFormatter:fmt||egp},
    series:[{type:"pie",radius:["48%","74%"],avoidLabelOverlap:true,itemStyle:{borderColor:isLight()?"#fff":"#0d1220",borderWidth:2},
      label:{color:b._muted,formatter:"{b}: {d}%"},
      data:pairs.map((p,i)=>({name:p[0],value:Math.round(p[1]),itemStyle:{color:PAL[i%PAL.length]}}))}]});}

function chTreemap(id,X){const b=ecBase();
  const brands=new Map();
  X.lines.forEach(l=>{let br=brands.get(l.brand);if(!br){br={name:l.brand,children:new Map()};brands.set(l.brand,br);}
    br.children.set(l.item_name,(br.children.get(l.item_name)||0)+(l.line_total||0));});
  const data=[...brands.values()].map((br,i)=>({name:br.name,itemStyle:{color:PAL[i%PAL.length]},
    children:[...br.children].map(([n,v])=>({name:n,value:Math.round(v)}))}));
  ec(id,{...b,tooltip:{...b.tooltip,valueFormatter:egp},series:[{type:"treemap",roam:false,nodeClick:"zoomToNode",
    breadcrumb:{show:true,itemStyle:{color:"#1e293b",textStyle:{color:b._muted}}},
    label:{color:"#fff",fontFamily:"Cairo"},upperLabel:{show:true,height:22,color:"#fff"},
    levels:[{itemStyle:{gapWidth:2,borderColor:isLight()?"#fff":"#0a0e1a"}},{itemStyle:{gapWidth:1}}],data}]});}

function chBox(id,X){const b=ecBase();
  const items=X.products.filter(p=>p.prices&&p.prices.length>=3).slice(0,10);
  // manual five-number summary (vendored echarts build has no dataTool)
  const boxData=items.map(p=>{const s=[...p.prices].sort((a,c)=>a-c);
    const q=f=>s[Math.floor((s.length-1)*f)];return [s[0],q(.25),q(.5),q(.75),s[s.length-1]];});
  ec(id,{...b,tooltip:{...b.tooltip},xAxis:axis(b,{type:"category",data:items.map(p=>p.item_name),
      axisLabel:{color:b._muted,interval:0,rotate:35,fontSize:10}}),
    yAxis:axis(b,{type:"value",name:"سعر الوحدة",axisLabel:{color:b._muted}}),
    series:[{type:"boxplot",data:boxData,itemStyle:{color:"rgba(59,130,246,.25)",borderColor:PAL[0]}}]});}

function chScatter(id,X){const b=ecBase();
  const pts=X.customers.filter(c=>c.outstanding!=null).map(c=>[Math.round(c.sales),Math.round(c.outstanding),c.customer_name,c.collection_rate]);
  ec(id,{...b,tooltip:{...b.tooltip,formatter:p=>`${p.data[2]}<br/>مبيعات: ${egp(p.data[0])}<br/>مديونية: ${egp(p.data[1])}<br/>تحصيل: ${p.data[3]!=null?pct(p.data[3]):"—"}`},
    xAxis:axis(b,{type:"value",name:"مبيعات الفترة",axisLabel:{color:b._muted,formatter:egpK}}),
    yAxis:axis(b,{type:"value",name:"المديونية القائمة",axisLabel:{color:b._muted,formatter:egpK}}),
    series:[{type:"scatter",symbolSize:d=>Math.max(8,Math.sqrt(d[0])/12),
      itemStyle:{color:p=>p.data[3]>=.9?PAL[2]:p.data[3]>=.7?PAL[3]:PAL[4],opacity:.75},data:pts}]});}

function chRadar(id,X){const b=ecBase();
  const top=[...X.customers].sort((a,c)=>c.sales-a.sales).slice(0,5);
  const max=k=>Math.max(...X.customers.map(c=>c[k]||0))||1;
  const ind=[{name:"المبيعات",max:max("sales")},{name:"الفواتير",max:max("n_invoices")},
    {name:"الأصناف",max:max("n_items")},{name:"الكمية",max:max("units")},{name:"معدل التحصيل",max:1}];
  ec(id,{...b,tooltip:{...b.tooltip},legend:{...b.legend,data:top.map(t=>t.customer_name)},
    radar:{indicator:ind,axisName:{color:b._muted,fontSize:11},splitLine:{lineStyle:{color:b._grid}},
      splitArea:{show:false},axisLine:{lineStyle:{color:b._grid}}},
    series:[{type:"radar",data:top.map((t,i)=>({name:t.customer_name,value:[t.sales,t.n_invoices,t.n_items,t.units,t.collection_rate||0],
      lineStyle:{color:PAL[i]},areaStyle:{opacity:.08,color:PAL[i]},itemStyle:{color:PAL[i]}}))}]});}

function chSunburst(id,X){const b=ecBase();
  const top=X.products.slice(0,8).map(p=>p.item_code);
  const reps=new Map();
  X.lines.filter(l=>top.includes(l.item_code)).forEach(l=>{
    let r=reps.get(l.rep);if(!r){r=new Map();reps.set(l.rep,r);}
    r.set(l.item_name,(r.get(l.item_name)||0)+(l.line_total||0));});
  const data=[...reps].map(([rep,items],i)=>({name:rep,itemStyle:{color:PAL[i%PAL.length]},
    children:[...items].map(([n,v])=>({name:n,value:Math.round(v)}))}));
  ec(id,{...b,tooltip:{...b.tooltip,valueFormatter:egp},series:[{type:"sunburst",radius:[0,"92%"],data,
    label:{color:"#fff",fontFamily:"Cairo",minAngle:8},itemStyle:{borderColor:isLight()?"#fff":"#0a0e1a",borderWidth:1}}]});}

function chSankey(id,X){const b=ecBase();
  const topC=[...X.customers].sort((a,c)=>c.sales-a.sales).slice(0,8).map(c=>c.customer_name);
  const topP=X.products.slice(0,8).map(p=>p.item_name);
  const cS=new Set(topC),pS=new Set(topP);
  const links=new Map();
  X.lines.forEach(l=>{if(cS.has(l.customer_name)&&pS.has(l.item_name)){
    const k=l.customer_name+"→"+l.item_name;links.set(k,(links.get(k)||0)+(l.line_total||0));}});
  const nodes=[...new Set([...topC,...topP])].map(n=>({name:n}));
  const linkArr=[...links].map(([k,v])=>{const[s,t]=k.split("→");return{source:s,target:t,value:Math.round(v)};}).filter(l=>l.value>0);
  ec(id,{...b,tooltip:{...b.tooltip,valueFormatter:egp},series:[{type:"sankey",data:nodes,links:linkArr,
    emphasis:{focus:"adjacency"},lineStyle:{color:"gradient",opacity:.4},
    label:{color:b._ink,fontFamily:"Cairo",fontSize:11},nodeGap:8,
    itemStyle:{color:PAL[0],borderColor:"transparent"}}]});}

function chHeatmap(id,X){const b=ecBase();
  const reps=[...new Set(X.lines.map(l=>l.rep))];
  const brands=[...new Set(X.lines.map(l=>l.brand))];
  const m=new Map();X.lines.forEach(l=>{const k=l.rep+"|"+l.brand;m.set(k,(m.get(k)||0)+(l.line_total||0));});
  const data=[];let mx=0;
  reps.forEach((r,ri)=>brands.forEach((br,bi)=>{const v=Math.round(m.get(r+"|"+br)||0);mx=Math.max(mx,v);data.push([bi,ri,v]);}));
  ec(id,{...b,tooltip:{...b.tooltip,formatter:p=>`${reps[p.data[1]]} · ${brands[p.data[0]]}<br/>${egp(p.data[2])}`},
    grid:{...b.grid,bottom:60,left:80},
    xAxis:axis(b,{type:"category",data:brands,axisLabel:{color:b._muted,rotate:30,interval:0,fontSize:10}}),
    yAxis:axis(b,{type:"category",data:reps,axisLabel:{color:b._muted}}),
    visualMap:{min:0,max:mx||1,calculable:true,orient:"horizontal",left:"center",bottom:0,
      inRange:{color:["#0d1220","#3b82f6","#8b5cf6","#ef4444"]},textStyle:{color:b._muted}},
    series:[{type:"heatmap",data,label:{show:false},itemStyle:{borderColor:isLight()?"#fff":"#0a0e1a",borderWidth:1}}]});}

function chVariance(id){const b=ecBase();
  const rows=D.monthly.filter(m=>m.month>="2025-07");
  const dv=rows.map((r,i)=>i===0?0:Math.round(r.net_sales-rows[i-1].net_sales));
  ec(id,{...b,tooltip:{...b.tooltip,trigger:"axis",valueFormatter:egp},
    xAxis:axis(b,{type:"category",data:rows.map(r=>r.month)}),
    yAxis:axis(b,{type:"value",axisLabel:{color:b._muted,formatter:egpK}}),
    series:[{type:"bar",data:dv.map(v=>({value:v,itemStyle:{color:v>=0?PAL[2]:PAL[4],borderRadius:v>=0?[6,6,0,0]:[0,0,6,6]}}))}]});}

function chWaterfall(id,X){const b=ecBase();// sales bridge by brand contribution
  const bm=[...groupSum(X.lines,"brand","line_total")].sort((a,c)=>c[1]-a[1]);
  const cats=["البداية",...bm.map(x=>x[0]),"الإجمالي"];
  let acc=0;const base=[0],val=[0];
  bm.forEach(x=>{base.push(acc);val.push(Math.round(x[1]));acc+=x[1];});
  base.push(0);val.push(Math.round(acc));
  ec(id,{...b,tooltip:{...b.tooltip,trigger:"axis",valueFormatter:egp},
    xAxis:axis(b,{type:"category",data:cats,axisLabel:{color:b._muted,rotate:25,interval:0,fontSize:10}}),
    yAxis:axis(b,{type:"value",axisLabel:{color:b._muted,formatter:egpK}}),
    series:[{type:"bar",stack:"t",itemStyle:{color:"transparent"},data:base,silent:true},
      {type:"bar",stack:"t",data:val.map((v,i)=>({value:v,itemStyle:{color:i===val.length-1?PAL[1]:PAL[0],borderRadius:[4,4,0,0]}}))}]});}

function chHistogram(id,X){ // Plotly histogram of invoice values
  const vals=X.invoices.filter(v=>v.reported_total>0).map(v=>v.reported_total);
  const ink=isLight()?"#0f172a":"#e2e8f0", grid=isLight()?"#e2e8f0":"rgba(255,255,255,.08)";
  Plotly.newPlot(id,[{x:vals,type:"histogram",nbinsx:30,marker:{color:"#3b82f6",line:{color:"#8b5cf6",width:1}}}],
    {paper_bgcolor:"transparent",plot_bgcolor:"transparent",font:{family:"Cairo",color:ink},
     margin:{l:50,r:20,t:20,b:40},bargap:.04,xaxis:{title:"قيمة الفاتورة",gridcolor:grid,zeroline:false},
     yaxis:{title:"عدد الفواتير",gridcolor:grid}},{displayModeBar:false,responsive:true});
  charts[id]={_plotly:true,dispose(){Plotly.purge(id);},resize(){Plotly.Plots.resize(id);},
    getDataURL(){return null;}};}

function chBonusDist(id,X){const b=ecBase();
  const tiers={0:0,1:0,2:0,3:0,5:0};
  X.customers.forEach(c=>{const t=Math.round(c.bonus_pct*100);if(tiers[t]!=null)tiers[t]++;});
  const labels={0:"0%",1:"1%",2:"2%",3:"3%",5:"5%"};
  ec(id,{...b,tooltip:{...b.tooltip,trigger:"axis"},
    xAxis:axis(b,{type:"category",data:Object.keys(tiers).map(t=>labels[t])}),
    yAxis:axis(b,{type:"value",name:"عدد العملاء",axisLabel:{color:b._muted}}),
    series:[{type:"bar",data:Object.values(tiers),
      itemStyle:{color:p=>["#ef4444","#f59e0b","#f97316","#10b981","#3b82f6"][p.dataIndex],borderRadius:[6,6,0,0]},
      label:{show:true,position:"top",color:b._muted}}]});}

function chReconGauge(id){const b=ecBase();const s=D.data_quality;
  chGauge(id,s.reconciliation_rate);}

/* ========================================================================== */
/*  DataTables                                                                 */
/* ========================================================================== */
const DT_LANG={search:"بحث:",lengthMenu:"عرض _MENU_",info:"_START_–_END_ من _TOTAL_",
  paginate:{first:"الأول",last:"الأخير",next:"التالي",previous:"السابق"},zeroRecords:"لا نتائج",
  infoEmpty:"لا سجلات",infoFiltered:"(من _MAX_)",emptyTable:"لا توجد بيانات"};
function dt(id,columns,data,opts){
  if(tables[id]){tables[id].destroy();$("#"+id).empty();}
  tables[id]=$("#"+id).DataTable(Object.assign({
    data,columns,language:DT_LANG,pageLength:10,lengthMenu:[10,25,50,100],
    dom:"<'d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2'Bf>rt<'d-flex justify-content-between align-items-center mt-2'ip>",
    buttons:[{extend:"excelHtml5",text:"Excel",className:"dt-button"},
      {extend:"csvHtml5",text:"CSV",className:"dt-button"},
      {extend:"copyHtml5",text:"نسخ",className:"dt-button"},
      {extend:"print",text:"طباعة",className:"dt-button"}],
    order:opts&&opts.order||[[0,"asc"]],
  },opts||{}));
  return tables[id];}

const bonusBadge=p=>{const t=Math.round(p*100);return `<span class="badge-b bonus-${t}">${t}%</span>`;};
const ageCls=b=>`age-${b}`;

/* ========================================================================== */
/*  SECTION DEFINITIONS                                                         */
/* ========================================================================== */
const SECTIONS = {
  overview:{ label:"لوحة المعلومات",
    dom:()=>`<div class="section-head"><div><h2>لوحة المعلومات التنفيذية</h2>
        <p>ملخص أداء <span id="ovPeriod"></span> — المبيعات والتحصيل والمديونية</p></div></div>
      <div id="kpiHost"></div>
      <div id="fsStrip"></div>
      <div class="grid g-2">
        ${card({id:"c_monthly",title:"اتجاه المبيعات الشهري",sub:"السلسلة الكاملة",insightKey:"monthly_trend"})}
        ${card({id:"c_daily",title:"المبيعات والتحصيل اليومي",sub:""})}
        ${card({id:"c_aging",title:"أعمار الديون",approx:true,insightKey:"aging"})}
        ${card({id:"c_gauge",title:"معدل التحصيل التراكمي",short:true})}
        ${card({id:"c_brand",title:"توزيع المبيعات حسب العلامة"})}
        ${card({id:"c_top10",title:"أعلى ١٠ عملاء",insightKey:"top_customers"})}
      </div>`,
    update:(X)=>{ document.getElementById("kpiHost").innerHTML=kpiGrid(X.kpis);
      const fsS=document.getElementById("fsStrip"); if(fsS&&FS) fsS.innerHTML=`<div class="nav-group-label" style="margin-top:14px">من القوائم المالية — ${fsMon(fsLastM())} (تبويب «الإدارة المالية» للتفاصيل)</div>`+fsKpis();
      const ov=document.getElementById("ovPeriod"); if(ov) ov.textContent=curMonthLabel();
      chMonthly("c_monthly",X);chDaily("c_daily",X);chAgingBar("c_aging",X);chGauge("c_gauge",X.kpis.collection_rate);
      chDonut("c_brand",[...groupSum(X.lines,"brand","line_total")].sort((a,b)=>b[1]-a[1]));
      chTopCustomers("c_top10",X,10); }},

  sales:{ label:"المبيعات",
    dom:()=>`<div class="section-head"><div><h2>تحليل المبيعات</h2><p>الاتجاهات والمقارنات والتفاصيل</p></div></div>
      <div class="grid g-2">
        ${card({id:"s_daily",title:"اتجاه المبيعات اليومي",insightKey:"monthly_trend"})}
        ${card({id:"s_variance",title:"تحليل التباين الشهري (شهر مقابل شهر)"})}
        ${card({id:"s_waterfall",title:"جسر المبيعات حسب العلامة (Waterfall)"})}
        ${card({id:"s_topP",title:"أعلى ٢٠ صنفًا"})}
      </div>
      ${tableCard({id:"t_sales",title:"جدول المبيعات (بنود الفواتير)",sub:"قابل للبحث والفرز والتصدير"})}`,
    update:(X)=>{ chDaily("s_daily",X);chVariance("s_variance");chWaterfall("s_waterfall",X);chTopProducts("s_topP",X,20);
      dt("t_sales",[
        {title:"الفاتورة",data:"invoice_no"},{title:"التاريخ",data:"invoice_date"},
        {title:"العميل",data:"customer_name"},{title:"المندوب",data:"rep"},
        {title:"الصنف",data:"item_name"},{title:"العلامة",data:"brand"},
        {title:"الكمية",data:"qty",render:int},{title:"السعر",data:"unit_price",render:num},
        {title:"الإجمالي",data:"line_total",render:num}],
        X.lines,{order:[[8,"desc"]]}); }},

  customers:{ label:"العملاء",
    dom:()=>`<div class="section-head"><div><h2>تحليل العملاء</h2><p>الترتيب، التركّز، والأداء متعدد الأبعاد</p></div></div>
      <div class="grid g-2">
        ${card({id:"cu_top",title:"أعلى ٢٠ عميلًا حسب المبيعات",insightKey:"top_customers"})}
        ${card({id:"cu_pareto",title:"تحليل باريتو (٨٠/٢٠)",insightKey:"pareto"})}
        ${card({id:"cu_radar",title:"مقارنة أعلى ٥ عملاء (رادار)"})}
        ${card({id:"cu_scatter",title:"المبيعات مقابل المديونية",sub:"حجم النقطة = المبيعات"})}
      </div>
      ${tableCard({id:"t_cust",title:"ترتيب العملاء وكشف الأداء",sub:"انقر صفًا لعرض كشف الحساب"})}`,
    update:(X)=>{ chTopCustomers("cu_top",X,20);chPareto("cu_pareto",X);chRadar("cu_radar",X);chScatter("cu_scatter",X);
      const t=dt("t_cust",[
        {title:"#",data:"rank"},{title:"العميل",data:"customer_name"},{title:"المندوب",data:"rep"},
        {title:"المبيعات",data:"sales",render:num},{title:"الفواتير",data:"n_invoices"},
        {title:"الأصناف",data:"n_items"},{title:"الكراتين",data:"boxes",render:int},
        {title:"متوسط الفاتورة",data:"avg_invoice_value",render:num},
        {title:"المديونية",data:"outstanding",render:d=>d==null?"—":num(d)},
        {title:"معدل التحصيل",data:"collection_rate",render:d=>d==null?"—":pct(d)},
        {title:"الحافز",data:"bonus_pct",render:bonusBadge}],
        X.customers,{order:[[3,"desc"]]});
      $("#t_cust tbody").off("click").on("click","tr",function(){const d=t.row(this).data();if(d)openDrill(d.customer_code);}); }},

  products:{ label:"المنتجات",
    dom:()=>`<div class="section-head"><div><h2>تحليل المنتجات</h2><p>المساهمة، تشتت الأسعار، والأداء</p></div></div>
      <div class="grid g-2">
        ${card({id:"p_top",title:"أعلى ٢٠ صنفًا",insightKey:"top_products"})}
        ${card({id:"p_tree",title:"خريطة الإيراد (علامة ← صنف)"})}
        ${card({id:"p_box",title:"تشتت سعر البيع لأعلى الأصناف"})}
        ${card({id:"p_donut",title:"توزيع الإيراد حسب العلامة"})}
      </div>
      ${tableCard({id:"t_prod",title:"أداء المنتجات",sub:"ASP · أعلى/أدنى سعر · المساهمة"})}`,
    update:(X)=>{ chTopProducts("p_top",X,20);chTreemap("p_tree",X);chBox("p_box",X);
      chDonut("p_donut",[...groupSum(X.lines,"brand","line_total")].sort((a,b)=>b[1]-a[1]));
      dt("t_prod",[
        {title:"#",data:"rank"},{title:"الصنف",data:"item_name"},{title:"العلامة",data:"brand"},
        {title:"المبيعات",data:"sales",render:num},{title:"الكمية",data:"qty",render:int},
        {title:"الكراتين",data:"boxes",render:d=>d==null?"—":int(d)},
        {title:"م.السعر",data:"asp",render:num},{title:"أعلى",data:"max_price",render:d=>d==null?"—":num(d)},
        {title:"أدنى",data:"min_price",render:d=>d==null?"—":num(d)},
        {title:"العملاء",data:"n_customers"},{title:"المساهمة",data:"contribution_pct",render:d=>d.toFixed(1)+"%"}],
        X.products,{order:[[3,"desc"]]}); }},

  receivables:{ label:"المديونية",
    dom:()=>`<div class="section-head"><div><h2>المديونية وتحليل الأعمار</h2>
        <p>لقطة ${D.meta.as_of} <span class="tag-approx">الأعمار تقديرية — لا تواريخ استحقاق بالمصدر</span></p></div></div>
      <div class="grid g-2">
        ${card({id:"r_aging",title:"أعمار الديون",approx:true,insightKey:"aging"})}
        ${card({id:"r_water",title:"تراكم الأعمار (Waterfall)",approx:true})}
        ${card({id:"r_rep",title:"المديونية حسب المندوب",insightKey:"receivables_rep"})}
        ${card({id:"r_donut",title:"جاري مقابل متأخرات"})}
      </div>
      ${tableCard({id:"t_recv",title:"تفاصيل المديونية حسب العميل",approx:true,sub:"الرصيد · جاري · متأخرات · أيام التأخر"})}`,
    update:(X)=>{ chAgingBar("r_aging",X);chAgingWaterfall("r_water",X);chByRep("r_rep",X);
      chDonut("r_donut",[["جاري",sum(X.recv,"current")],["متأخرات",sum(X.recv,"overdue")]]);
      dt("t_recv",[
        {title:"المندوب",data:"rep"},{title:"العميل",data:"customer_name"},
        {title:"آخر نشاط",data:"last_invoice_date"},{title:"الرصيد",data:"outstanding",render:num},
        {title:"جاري",data:"current",render:num},{title:"متأخرات",data:"overdue",render:num},
        {title:"أيام التأخر",data:"days_overdue"},
        {title:"الفئة",data:"bucket",render:b=>`<span class="${ageCls(b)}">${D.receivables.bucket_labels[b]}</span>`}],
        X.recv,{order:[[3,"desc"]]}); }},

  collections:{ label:"التحصيل والتسويات",
    dom:()=>`<div class="section-head"><div><h2>التحصيل والتسويات</h2><p>التحصيل النقدي الفعلي والمرتجعات وتسوية الأرصدة — من مستندَي السدادات والارتجاعات ٢٠٢٦</p></div></div>
      <div class="grid g-2">
        ${card({id:"co_gauge",title:"معدل التحصيل الفعلي (تراكمي ٢٠٢٦)",sub:"تحصيل نقدي ÷ مُفوتر ٢٠٢٦",short:true})}
        <div class="card"><div class="card-head"><h3>التسوية — جسر التحصيل</h3></div><div id="co_recon_host" class="note"></div></div>
        ${card({id:"co_monthly",title:"المبيعات مقابل التحصيل والمرتجعات (شهري ٢٠٢٦)",sub:"جسر تدفق نقدي شهري",cls:"span-2",tall:true})}
        ${card({id:"co_method",title:"التحصيل حسب طريقة الدفع"})}
        ${card({id:"co_rep",title:"التحصيل والمرتجعات حسب المندوب"})}
        ${card({id:"co_bottom",title:"أدنى ١٥ عميلًا في معدل التحصيل الفعلي",cls:"span-2"})}
      </div>
      ${tableCard({id:"t_receipts",title:"سجل السدادات (التحصيل النقدي الفعلي)",sub:"التاريخ · طريقة الدفع · المبلغ",approx:false})}
      ${tableCard({id:"t_returns",title:"سجل المرتجعات",sub:"قيمة المرتجع لكل عميل"})}`,
    update:(X)=>{
      // Gauge + reconciliation are the ANNUAL (cumulative-2026) headline, constant
      // across months and tied EXACTLY to the source documents. The charts and
      // tables below stay month/cross-filter responsive.
      const C0=D.collections||{}, host=document.getElementById("co_recon_host");
      const annualRate=C0.billed_2026?Math.max(0,Math.min(1,C0.grand_total_collected/C0.billed_2026)):0;
      chGauge("co_gauge",annualRate);
      const A=C0.attribution||{};
      if(host){
        const rr=[["إجمالي المُفوتر ٢٠٢٦",egp(C0.billed_2026)],["التحصيل النقدي الفعلي",egp(C0.grand_total_collected)],
          ["المرتجعات",egp(C0.grand_total_returns)],["المديونية القائمة (١٦/٧)",egp(C0.outstanding_1607)],
          ["معدل التحصيل الفعلي",pct(annualRate)]];
        host.innerHTML=rr.map(r=>`<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border2)"><span>${r[0]}</span><b>${r[1]}</b></div>`).join("")
          +`<div class="note" style="margin-top:8px">جسر تقريبي (لا يتضمن رصيد أول المدة)؛ الإجماليان النقديان مطابقان لمستندَي المصدر بالضبط.`
          +(A.receipts_unmatched?` سدادات غير مُطابَقة بالاسم: ${A.receipts_unmatched} (${egp(A.unmatched_collected)}).`:``)+`</div>`;
      }
      const f=state.filters, mAll=!f.month||f.month==="all";
      const flt=r=>(mAll||r.month===f.month)&&(!f.rep||r.rep===f.rep)&&(!f.customer||r.customer_code===f.customer);
      const recs=((D.collections&&D.collections.receipts)||[]).filter(flt);
      const rets=((D.collections&&D.collections.returns_rows)||[]).filter(flt);
      const b=ecBase(), cm=(!mAll)?f.month:null;
      // monthly bridge (full 2026 series; selected month marked)
      const bmonth=groupSum(D.invoices.filter(v=>v.month>="2026-01"),"month","reported_total");
      const cmonth=new Map(), rmonth=new Map();
      ((D.collections&&D.collections.monthly)||[]).forEach(m=>{cmonth.set(m.month,m.collected);rmonth.set(m.month,m.returns);});
      const months=[...new Set([...bmonth.keys(),...cmonth.keys(),...rmonth.keys()])].sort();
      ec("co_monthly",{...b,tooltip:{...b.tooltip,trigger:"axis",valueFormatter:egp},
        legend:{...b.legend,data:["المبيعات","التحصيل","المرتجعات"]},
        xAxis:axis(b,{type:"category",data:months}),
        yAxis:axis(b,{type:"value",axisLabel:{color:b._muted,formatter:egpK}}),
        series:[
          {name:"المبيعات",type:"bar",itemStyle:{color:PAL[0],borderRadius:[4,4,0,0]},data:months.map(m=>Math.round(bmonth.get(m)||0))},
          {name:"التحصيل",type:"bar",itemStyle:{color:PAL[2],borderRadius:[4,4,0,0]},data:months.map(m=>Math.round(cmonth.get(m)||0))},
          {name:"المرتجعات",type:"line",smooth:true,itemStyle:{color:PAL[4]},lineStyle:{width:2.5,color:PAL[4]},
            data:months.map(m=>Math.round(rmonth.get(m)||0)),
            markLine:cm?{symbol:"none",data:[{xAxis:cm}],lineStyle:{color:PAL[3],type:"dashed"},label:{show:true,formatter:"المحدد",color:b._muted}}:undefined}]});
      // by payment method
      const methods=groupSum(recs,"method","amount");
      chDonut("co_method",[...methods.entries()].filter(e=>e[1]>0).sort((a,c)=>c[1]-a[1]));
      // by rep (collected + returns)
      const repC=groupSum(recs,"rep","amount"), repR=groupSum(rets,"rep","value");
      const reps=[...new Set([...repC.keys(),...repR.keys()])].sort((a,c)=>(repC.get(c)||0)-(repC.get(a)||0)).slice(0,12).reverse();
      ec("co_rep",{...b,tooltip:{...b.tooltip,trigger:"axis",valueFormatter:egp},
        legend:{...b.legend,data:["التحصيل","المرتجعات"]},grid:{...b.grid,left:8},
        xAxis:axis(b,{type:"value",axisLabel:{color:b._muted,formatter:egpK}}),
        yAxis:axis(b,{type:"category",data:reps}),
        series:[
          {name:"التحصيل",type:"bar",itemStyle:{color:PAL[2],borderRadius:[0,6,6,0]},data:reps.map(r=>Math.round(repC.get(r)||0))},
          {name:"المرتجعات",type:"bar",itemStyle:{color:PAL[4],borderRadius:[0,6,6,0]},data:reps.map(r=>Math.round(repR.get(r)||0))}]});
      // bottom-15 by actual collection rate
      const bottom=X.customers.filter(c=>c.collection_rate!=null).sort((a,c)=>a.collection_rate-c.collection_rate).slice(0,15).reverse();
      ec("co_bottom",{...b,tooltip:{...b.tooltip,valueFormatter:x=>pct(x)},
        xAxis:axis(b,{type:"value",max:1,axisLabel:{color:b._muted,formatter:x=>pct(x,0)}}),
        yAxis:axis(b,{type:"category",data:bottom.map(c=>c.customer_name)}),
        series:[{type:"bar",data:bottom.map(c=>c.collection_rate),
          itemStyle:{color:p=>p.value>=.9?PAL[2]:p.value>=.7?PAL[3]:PAL[4],borderRadius:[0,6,6,0]}}]});
      dt("t_receipts",[
        {title:"التاريخ",data:"date"},{title:"العميل",data:"customer_name"},{title:"المندوب",data:"rep"},
        {title:"طريقة الدفع",data:"method"},{title:"سند",data:"doc_ref"},{title:"إيصال",data:"receipt_no"},
        {title:"المبلغ",data:"amount",render:num}], recs,{order:[[0,"desc"]]});
      dt("t_returns",[
        {title:"التاريخ",data:"date"},{title:"العميل",data:"customer_name"},{title:"المندوب",data:"rep"},
        {title:"مرجع الفاتورة",data:"invoice_ref"},{title:"قيمة المرتجع",data:"value",render:num}],
        rets,{order:[[0,"desc"]]}); }},

  bonus:{ label:"الحوافز",
    dom:()=>`<div class="section-head"><div><h2>حوافز التحصيل</h2>
        <p>تُحتسب آليًا من معدل التحصيل وفق سلّم قابل للضبط من متغيّر واحد</p></div></div>
      <div class="grid g-2">
        ${card({id:"b_dist",title:"توزيع العملاء على شرائح الحافز",insightKey:"bonus"})}
        <div class="card"><div class="card-head"><h3>سلّم الحافز (BONUS_RULES)</h3></div>
          <div id="ladderHost" class="note"></div></div>
      </div>
      ${tableCard({id:"t_bonus",title:"تقرير الحوافز",sub:"معدل التحصيل · نسبة الحافز · القيمة المستحقة"})}`,
    update:(X)=>{ chBonusDist("b_dist",X);
      const rules=[["أقل من 70%","0%"],["70% – 80%","1%"],["80% – 90%","2%"],["90% – 95%","3%"],["95% – 100%","5%"]];
      const tot=X.customers.reduce((a,c)=>a+(c.bonus_value||0),0);
      document.getElementById("ladderHost").innerHTML=
        rules.map(r=>`<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border2)"><span>${r[0]}</span><b>${r[1]}</b></div>`).join("")+
        `<div style="margin-top:10px">إجمالي الحافز المستحق: <b class="pos">${egp(tot)}</b></div>`;
      const rows=X.customers.filter(c=>c.has_ar).map(c=>c);
      dt("t_bonus",[
        {title:"العميل",data:"customer_name"},{title:"المندوب",data:"rep"},
        {title:"مبيعات الشهر",data:"sales",render:num},{title:"إجمالي مُفوتر",data:"total_billed",render:num},
        {title:"المديونية",data:"outstanding",render:d=>d==null?"—":num(d)},
        {title:"معدل التحصيل",data:"collection_rate",render:d=>d==null?"—":pct(d)},
        {title:"الحافز %",data:"bonus_pct",render:bonusBadge},
        {title:"قيمة الحافز",data:"bonus_value",render:num}],
        rows,{order:[[7,"desc"]]}); }},

  analytics:{ label:"التحليلات المتقدمة",
    dom:()=>`<div class="section-head"><div><h2>التحليلات المتقدمة</h2><p>Sunburst · Sankey · Heatmap · التوزيعات</p></div></div>
      <div class="grid g-2">
        ${card({id:"a_sun",title:"شمسية: مندوب ← صنف",insightKey:"pareto"})}
        ${card({id:"a_sankey",title:"تدفق: عميل ← صنف",tall:true})}
        ${card({id:"a_heat",title:"حرارية: مندوب × علامة"})}
        ${card({id:"a_hist",title:"توزيع قيم الفواتير (Histogram)"})}
      </div>`,
    update:(X)=>{ chSunburst("a_sun",X);chSankey("a_sankey",X);chHeatmap("a_heat",X);chHistogram("a_hist",X); }},

  quality:{ label:"جودة البيانات",
    dom:()=>{const s=D.data_quality;
      const stat=(v,l,a)=>`<div class="kpi-card" style="--accent:${a};animation-delay:0s"><div class="kpi-val num">${v}</div><div class="kpi-lbl">${l}</div></div>`;
      return `<div class="section-head"><div><h2>جودة البيانات</h2>
        <p>مطابقة الاستخراج والقيم الشاذّة — لا يُحذف أي سجل، تُرصد فقط</p></div></div>
      <div class="kpi-grid">
        ${stat(pct(s.reconciliation_rate),"مطابقة الإجماليات","#10b981")}
        ${stat(int(s.n_line_items),"بنود الفواتير","#3b82f6")}
        ${stat(int(s.n_invoices),"عدد الفواتير","#8b5cf6")}
        ${stat(int(s.missing_total),"قيم مفقودة","#f59e0b")}
        ${stat(int(s.duplicate_invoice_count),"فواتير مكررة","#f97316")}
        ${stat(int(s.zero_value_invoice_count),"فواتير صفرية","#ef4444")}
        ${stat(int(s.abnormal_price_count),"أسعار شاذّة","#ec4899")}
        ${stat(int(s.abnormal_qty_count),"كميات شاذّة","#c4b5fd")}
      </div>
      <div class="grid g-2">
        ${card({id:"q_recon",title:"نسبة المطابقة",short:true,insightKey:"data_quality"})}
        ${card({id:"q_hist",title:"توزيع قيم الفواتير"})}
      </div>
      ${tableCard({id:"t_zero",title:"الفواتير صفرية القيمة",insightKey:"zero_invoices",sub:"بونص / عيّنات"})}`;},
    update:(X)=>{ chReconGauge("q_recon");chHistogram("q_hist",X);
      dt("t_zero",[
        {title:"الفاتورة",data:"invoice_no"},{title:"التاريخ",data:"invoice_date"},
        {title:"كود العميل",data:"customer_code"},{title:"العميل",data:"customer_name"},
        {title:"الكمية",data:"qty_total",render:int},
        {title:"بونص",data:"is_bonus",render:v=>v?'<span class="age-d31_60">نعم</span>':"—"}],
        D.zero_invoices,{order:[[1,"asc"]]}); }},
};

/* ========================================================================== */
/*  الإدارة المالية — شاشات القوائم المالية (يُدمج في script.js عند البناء)     */
/*  المصدر: window.DASH_FS من statements_data.js (src/statements.py).           */
/*  إضافة فقط: لا يغيّر أي قسم قائم؛ تختفي الشاشات بهدوء إن غاب الملف.          */
/* ========================================================================== */
const FS = window.DASH_FS || null;
const esc = s => String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const FS_MONTH_AR = {"01":"يناير","02":"فبراير","03":"مارس","04":"أبريل","05":"مايو","06":"يونيو",
  "07":"يوليو","08":"أغسطس","09":"سبتمبر","10":"أكتوبر","11":"نوفمبر","12":"ديسمبر"};
const fsMon = ym => (FS_MONTH_AR[ym.slice(5,7)]||ym)+" "+ym.slice(0,4);
const fsDate = d => d.slice(8,10)+"/"+d.slice(5,7)+"/"+d.slice(0,4);
const fsMonths = () => FS ? FS.meta.income_months : [];
const fsLastM = () => fsMonths()[fsMonths().length-1];
const fsBS = () => FS.balance_sheets[FS.meta.as_of];
const fsCF = () => FS.cash_flows[FS.cash_flows.length-1];
const sevCls = s => s==="high"?"p-high":s==="medium"?"p-med":"p-low";
const sevAr = s => s==="high"?"عالية":s==="medium"?"متوسطة":"منخفضة";
const signCls = v => v>=0?"up":"down";
const dPct = (a,b) => b ? (a-b)/Math.abs(b) : 0;
const fsEmpty = () => `<div class="card"><div class="card-head"><h3>القوائم المالية غير محمّلة</h3></div>
  <p class="sub">شغّل <code>python3 -m src.statements</code> لتوليد statements_data.js من data/raw/.</p></div>`;
const periodTag = t => `<span class="tag-approx" style="background:rgba(59,130,246,.15);color:#93c5fd">${t}</span>`;

/* ---- KPI strip reused on the overview and the finance summary ------------ */
function fsKpis(){
  if(!FS) return "";
  const lm=fsLastM(), ms=fsMonths(), pm=ms[ms.length-2], t=FS.income[lm], p=FS.income[pm];
  const b=fsBS(), cf=fsCF(), wc=FS.working_capital||{};
  const gmD=(t.gross_margin-p.gross_margin)*100;
  let i=0; const d=()=>0.04*(i++);
  return `<div class="kpi-grid" style="margin-top:14px">
    ${kpiCard("sales",egpK(t.net_sales),"صافي المبيعات ("+fsMon(lm)+")","#3b82f6",
      (dPct(t.net_sales,p.net_sales)>=0?"▲ ":"▼ ")+pct(Math.abs(dPct(t.net_sales,p.net_sales)))+" مقابل "+fsMon(pm),
      signCls(t.net_sales-p.net_sales),d())}
    ${kpiCard("pct",pct(t.gross_margin),"هامش مجمل الربح","#10b981",
      (gmD>=0?"▲ ":"▼ ")+Math.abs(gmD).toFixed(1)+" نقطة مقابل "+fsMon(pm),signCls(gmD),d())}
    ${kpiCard("money",egpK(t.ebitda),"EBITDA","#8b5cf6","هامش "+pct(t.ebitda_margin),"",d())}
    ${kpiCard("money",egpK(t.net_profit_pre_dep),"صافي الربح قبل الإهلاك","#06b6d4",
      "بعد إهلاك السنة المحمّل على ديسمبر: "+egpK(t.net_profit_after_dep),t.net_profit_after_dep<0?"down":"na",d())}
    ${kpiCard("clock",egpK(cf.cfo),"التدفق النقدي التشغيلي","#f59e0b",
      fsDate(cf.from)+" → "+fsDate(cf.to)+" (محسوب من الميزانيتين)","na",d())}
    ${kpiCard("warn",egpK(b.net_debt),"صافي الدين","#ef4444",
      "قروض "+egpK(b.interest_bearing_debt)+" − نقدية وودائع "+egpK(b.cash_and_deposits),"na",d())}
    ${kpiCard("clock",(wc.ccc!=null?wc.ccc.toFixed(0):"—")+" يوم","دورة التحويل النقدي","#f97316",
      wc.dso!=null?`تحصيل ${wc.dso.toFixed(0)} + تخزين ${wc.dio.toFixed(0)} − سداد ${wc.dpo.toFixed(0)}`:"","na",d())}
    ${kpiCard("doc",fsBudgetStatus(),"الفعلي مقابل الموازنة","#c4b5fd","قالب: data/budget/budget_2026.csv","na",d())}
  </div>`;
}
function fsBudgetStatus(){
  const bud=FS&&FS.budget||{}; const ks=Object.keys(bud);
  return ks.length? ks.length+" شهر محمّل" : "غير محمّلة";
}

/* ---- charts ---------------------------------------------------------------- */
function chFsPL(id){const b=ecBase();const ms=fsMonths();const I=FS.income;
  ec(id,{...b,tooltip:{...b.tooltip,trigger:"axis",valueFormatter:egp},
    legend:{...b.legend,data:["صافي المبيعات","مجمل الربح","EBITDA","صافي الربح قبل الإهلاك","هامش المجمل"]},
    xAxis:axis(b,{type:"category",data:ms.map(fsMon)}),
    yAxis:[axis(b,{type:"value",axisLabel:{color:b._muted,formatter:egpK}}),
      axis(b,{type:"value",min:0,max:0.6,splitLine:{show:false},axisLabel:{color:b._muted,formatter:v=>Math.round(v*100)+"%"}})],
    series:[
      {name:"صافي المبيعات",type:"bar",data:ms.map(m=>Math.round(I[m].net_sales)),itemStyle:{color:PAL[0],borderRadius:[4,4,0,0]}},
      {name:"مجمل الربح",type:"bar",data:ms.map(m=>Math.round(I[m].gross_profit)),itemStyle:{color:PAL[2],borderRadius:[4,4,0,0]}},
      {name:"EBITDA",type:"bar",data:ms.map(m=>Math.round(I[m].ebitda)),itemStyle:{color:PAL[1],borderRadius:[4,4,0,0]}},
      {name:"صافي الربح قبل الإهلاك",type:"line",data:ms.map(m=>Math.round(I[m].net_profit_pre_dep)),lineStyle:{width:3},itemStyle:{color:PAL[3]}},
      {name:"هامش المجمل",type:"line",yAxisIndex:1,data:ms.map(m=>I[m].gross_margin),lineStyle:{type:"dashed"},itemStyle:{color:PAL[5]},
        tooltip:{valueFormatter:v=>pct(v)}}]});}

function chFsVertical(id){const b=ecBase();const ms=fsMonths();const I=FS.income;
  const s=(k)=>ms.map(m=>I[m].net_sales?I[m][k]/I[m].net_sales:0);
  const ser=[["تكلفة المبيعات","cogs",PAL[4]],["إدارية وعمومية","admin",PAL[3]],["بيعية وتسويقية","selling",PAL[6]],
    ["تمويلية/فروق عملة","finance",PAL[7]],["صافي الربح قبل الإهلاك","net_profit_pre_dep",PAL[2]]];
  ec(id,{...b,tooltip:{...b.tooltip,trigger:"axis",valueFormatter:v=>pct(v)},
    xAxis:axis(b,{type:"category",data:ms.map(fsMon)}),
    yAxis:axis(b,{type:"value",max:1,axisLabel:{color:b._muted,formatter:v=>Math.round(v*100)+"%"}}),
    series:ser.map(([n,k,c])=>({name:n,type:"bar",stack:"v",data:s(k),itemStyle:{color:c}}))});}

function chFsStructure(id,side){const b=ecBase();const ds=FS.meta.balance_sheet_dates;const B=FS.balance_sheets;
  const parts=side==="assets"
    ?[["النقدية والودائع",x=>x.cash_and_deposits],["العملاء",x=>x.receivables],["المخزون",x=>x.inventory],
      ["أصول متداولة أخرى",x=>x.other_current_assets+x.prepaid],["صافي الأصول الثابتة",x=>x.net_fixed_assets],
      ["استثمارات",x=>x.investments_subsidiaries]]
    :[["خصوم متداولة",x=>x.total_current_liabilities],["قرض المبادرة",x=>x.initiative_loan],["قرض السيارة",x=>x.car_loan],
      ["قروض الشركاء",x=>x.shareholder_loans],["حقوق الملكية",x=>x.total_equity]];
  ec(id,{...b,tooltip:{...b.tooltip,trigger:"axis",valueFormatter:egp},
    xAxis:axis(b,{type:"category",data:ds.map(fsDate)}),
    yAxis:axis(b,{type:"value",axisLabel:{color:b._muted,formatter:egpK}}),
    series:parts.map(([n,f],i)=>({name:n,type:"bar",stack:"s",data:ds.map(d=>Math.round(f(B[d]))),itemStyle:{color:PAL[i]}}))});}

function chFsCashBridge(id){const b=ecBase();const cf=fsCF();
  const steps=[["صافي الربح",cf.net_income],["الإهلاك",cf.depreciation],["العملاء",cf.change_receivables],
    ["المخزون",cf.change_inventory],["أصول متداولة أخرى",cf.change_other_current_assets],["الموردون",cf.change_payables],
    ["المستحقات",cf.change_accrued],["الاستثمار الرأسمالي",-cf.capex],["القروض",cf.debt_change],
    ["جاري الشركاء/مسحوبات",cf.equity_other_movements]];
  let acc=0;const base=[],val=[];
  steps.forEach(([,v])=>{base.push(v>=0?acc:acc+v);val.push(v);acc+=v;});
  ec(id,{...b,tooltip:{...b.tooltip,trigger:"axis",formatter:ps=>{const p=ps.find(x=>x.seriesIndex===1);return p?`${p.name}: ${egp(val[p.dataIndex])}`:""}},
    xAxis:axis(b,{type:"category",data:[...steps.map(s=>s[0]),"التغير في النقدية"],axisLabel:{color:b._muted,rotate:25,interval:0,fontSize:10}}),
    yAxis:axis(b,{type:"value",axisLabel:{color:b._muted,formatter:egpK}}),
    series:[{type:"bar",stack:"w",silent:true,itemStyle:{color:"transparent"},data:[...base.map(Math.round),0]},
      {type:"bar",stack:"w",data:[...val.map(v=>({value:Math.round(Math.abs(v)),itemStyle:{color:v>=0?PAL[2]:PAL[4],borderRadius:[4,4,0,0]}})),
        {value:Math.round(Math.abs(acc)),itemStyle:{color:PAL[1],borderRadius:[4,4,0,0]}}]}]});
  val.push(acc);}

function chFsCCC(id){const b=ecBase();const w=FS.working_capital;if(!w)return;
  ec(id,{...b,tooltip:{...b.tooltip,trigger:"axis",valueFormatter:v=>Math.round(v)+" يوم"},
    xAxis:axis(b,{type:"category",data:["أيام التحصيل","أيام التخزين","أيام السداد","دورة التحويل النقدي"]}),
    yAxis:axis(b,{type:"value",axisLabel:{color:b._muted,formatter:v=>v+" يوم"}}),
    series:[{type:"bar",label:{show:true,position:"top",color:b._ink,formatter:p=>Math.round(p.value)},
      data:[{value:w.dso,itemStyle:{color:PAL[0]}},{value:w.dio,itemStyle:{color:PAL[3]}},
        {value:-w.dpo,itemStyle:{color:PAL[2]}},{value:w.ccc,itemStyle:{color:PAL[1]}}]}]});}

function chFsRecon(id){const b=ecBase();const R=FS.sales_reconciliation;
  ec(id,{...b,tooltip:{...b.tooltip,trigger:"axis",valueFormatter:egp},
    xAxis:axis(b,{type:"category",data:R.map(r=>fsMon(r.month))}),
    yAxis:axis(b,{type:"value",axisLabel:{color:b._muted,formatter:egpK}}),
    series:[{name:"صافي المبيعات بالقوائم",type:"bar",data:R.map(r=>Math.round(r.statement_net_sales)),itemStyle:{color:PAL[0]}},
      {name:"مبيعات الفواتير",type:"bar",data:R.map(r=>Math.round(r.invoice_sales||0)),itemStyle:{color:PAL[1]}}]});}

function chFsExpenseDonut(id,month,section){const b=ecBase();
  const it=(FS.income[month].expense_items[section]||[]).filter(x=>x.amount>0).sort((a,c)=>c.amount-a.amount);
  const top=it.slice(0,8), rest=it.slice(8).reduce((a,x)=>a+x.amount,0);
  const data=top.map(x=>({name:x.name,value:Math.round(x.amount)}));if(rest)data.push({name:"أخرى",value:Math.round(rest)});
  ec(id,{...b,tooltip:{...b.tooltip,trigger:"item",valueFormatter:egp},legend:{show:false},
    series:[{type:"pie",radius:["45%","72%"],itemStyle:{borderRadius:6,borderColor:"transparent",borderWidth:2},
      label:{color:b._muted,fontSize:11,formatter:"{b}\n{d}%"},data}]});}

/* ---- tables ---------------------------------------------------------------- */
function fsPLRows(){const ms=fsMonths();const I=FS.income;
  const lines=[["صافي المبيعات","net_sales"],["تكلفة المبيعات","cogs"],["مجمل الربح","gross_profit"],["هامش مجمل الربح","gross_margin",1],
    ["مصروفات إدارية وعمومية","admin"],["مصروفات بيعية وتسويقية","selling"],["EBITDA","ebitda"],["هامش EBITDA","ebitda_margin",1],
    ["مصاريف تمويلية / فروق عملة","finance"],["صافي الربح قبل الإهلاك","net_profit_pre_dep"],
    ["الإهلاك المحمّل فعليًا","depreciation_booked"],["صافي الربح بعد الإهلاك (كما بالقوائم)","net_profit_after_dep"],
    ["الإهلاك الموزّع شهريًا (تقدير)","depreciation_allocated_est"],["صافي الربح بعد إهلاك موزّع (تقدير)","net_profit_dep_allocated_est"]];
  return lines.map(([l,k,isPct])=>{const r={line:l};let tot=0;
    ms.forEach(m=>{const v=I[m][k];r[m]=isPct?(v==null?"—":pct(v)):egp(v);tot+=v||0;});
    r.total=isPct?(k==="gross_margin"?pct(ms.reduce((a,m)=>a+I[m].gross_profit,0)/ms.reduce((a,m)=>a+I[m].net_sales,0))
      :pct(ms.reduce((a,m)=>a+I[m].ebitda,0)/ms.reduce((a,m)=>a+I[m].net_sales,0))):egp(tot);
    return r;});}

function fsBSRows(){const ds=FS.meta.balance_sheet_dates;const B=FS.balance_sheets;const L=FS.bs_labels;
  const keys=["cash","time_deposits","receivables","inventory","prepaid","other_current_assets","total_current_assets",
    "net_fixed_assets","investments_subsidiaries","total_assets","payables","accrued_expenses","total_current_liabilities",
    "initiative_loan","car_loan","shareholder_loans","total_lt_liabilities","total_liabilities","paid_in_capital",
    "partners_current","retained_earnings","net_profit_bs","total_equity","total_liabilities_equity"];
  const a=ds[ds.length-2], z=ds[ds.length-1];
  return keys.filter(k=>ds.some(d=>B[d][k])).map(k=>{const r={line:L[k]||k,bold:/^total/.test(k)};
    ds.forEach(d=>{r[d]=egp(B[d][k]);});
    r.pct=pct(B[z][k]/B[z].total_assets);
    const ch=B[z][k]-B[a][k];r.change=`<span class="${signCls(ch)}">${egp(ch)}</span>`;return r;});}

function fsRatioRows(){const ds=FS.meta.balance_sheet_dates;const B=FS.balance_sheets;
  const R=[["نسبة التداول","current_ratio","x"],["النسبة السريعة","quick_ratio","x"],["نسبة النقدية","cash_ratio","x"],
    ["الالتزامات ÷ حقوق الملكية","liabilities_to_equity","x"],["القروض ÷ حقوق الملكية","debt_to_equity","x"],
    ["حقوق الملكية ÷ الأصول","equity_ratio","%"],["رأس المال العامل","working_capital","egp"],["صافي الدين","net_debt","egp"]];
  return R.map(([l,k,f])=>{const r={line:l};ds.forEach(d=>{const v=B[d][k];r[d]=v==null?"—":f==="%"?pct(v):f==="egp"?egp(v):v.toFixed(2);});return r;});}

function fsCFRows(){const C=FS.cash_flows;
  const L=[["صافي الربح (بعد الإهلاك)","net_income"],["+ الإهلاك","depreciation"],["(زيادة)/نقص العملاء","change_receivables"],
    ["(زيادة)/نقص المخزون","change_inventory"],["(زيادة)/نقص أصول متداولة أخرى","change_other_current_assets"],
    ["زيادة/(نقص) الموردين","change_payables"],["زيادة/(نقص) المستحقات","change_accrued"],["= التدفق النقدي التشغيلي","cfo"],
    ["الاستثمار الرأسمالي","capex"],["= التدفق النقدي الاستثماري","cfi"],["التغير في القروض","debt_change"],
    ["حركة جاري الشركاء / مسحوبات (تسوية حقوق الملكية)","equity_other_movements"],["= التدفق النقدي التمويلي","cff"],
    ["صافي التغير المحسوب","net_change"],["التغير الفعلي في النقدية والودائع","actual_change_cash_deposits"],["فرق المطابقة","check_diff"]];
  return L.map(([l,k])=>{const r={line:l};C.forEach((c,i)=>{r["p"+i]=egp(c[k]);});return r;});}

function fsOcaRows(){const it=FS.other_current_assets[FS.meta.as_of]||[];
  return it.filter(x=>x.amount).map(x=>({...x,name:esc(x.name),category:esc(x.category),amountF:x.amount<0?`<span class="down">${egp(x.amount)}</span>`:egp(x.amount)}));}

function fsLoanRows(){const ds=FS.meta.balance_sheet_dates;
  const rows=FS.loans.map(l=>{const r={name:l.name,kind:l.kind};ds.forEach(d=>{r[d]=egp(l.balances[d]);});r.feb="—";return r;});
  (FS.loans_feb_2026_detail||[]).forEach(x=>{const r=rows.find(r=>x.name.replace("السياؤة","السيارة").includes(r.name.replace("قرض ","").trim()));
    if(r)r.feb=egp(x.amount);else rows.push(Object.assign({name:x.name,kind:x.category,feb:egp(x.amount)},Object.fromEntries(ds.map(d=>[d,"—"]))));});
  return rows;}

/* ---- scenario: COGS ±% on the latest month ------------------------------- */
function fsScenario(){const t=FS.income[fsLastM()];
  const el=document.getElementById("fs_scn");if(!el)return;
  const pc=+document.getElementById("fs_scn_cogs").value/100, pp=+document.getElementById("fs_scn_price").value/100;
  const sales=t.net_sales*(1+pp), cogs=t.cogs*(1+pc), gp=sales-cogs, eb=gp-t.admin-t.selling;
  document.getElementById("fs_scn_lbl").textContent=`تكلفة ${pc>=0?"+":""}${(pc*100).toFixed(0)}% · سعر ${pp>=0?"+":""}${(pp*100).toFixed(0)}%`;
  el.innerHTML=`<div class="kpi-grid">
    ${kpiCard("pct",pct(gp/sales),"هامش المجمل بعد السيناريو","#10b981","الفعلي "+pct(t.gross_margin),signCls(gp/sales-t.gross_margin),0)}
    ${kpiCard("money",egpK(eb),"EBITDA بعد السيناريو","#8b5cf6","الفعلي "+egpK(t.ebitda),signCls(eb-t.ebitda),0)}
    ${kpiCard("money",egpK(eb-t.ebitda),"الأثر الشهري على EBITDA","#f59e0b","× 12 = "+egpK((eb-t.ebitda)*12)+" سنويًا","na",0)}
  </div>`;}

/* ---- sections ------------------------------------------------------------- */
const FIN_SECTIONS = {
  fin_exec:{ label:"الملخص المالي التنفيذي",
    dom:()=>!FS?fsEmpty():`<div class="section-head"><div><h2>الملخص المالي التنفيذي ${periodTag("القوائم المالية 7–12/2025")}</h2>
      <p>المبيعات والربحية والسيولة والانحرافات في شاشة واحدة — من الميزانية وقوائم الدخل الشهرية</p></div></div>
      <div id="fs_kpis"></div>
      <div class="grid g-2" style="margin-top:14px">
        ${card({id:"fs_pl",title:"المبيعات ومجمل الربح وEBITDA شهريًا",sub:"الخط المتقطع: هامش مجمل الربح (المحور الأيسر)",tall:true})}
        ${card({id:"fs_bridge",title:"من صافي الربح إلى التغير في النقدية",sub:fsCF()?fsDate(fsCF().from)+" → "+fsDate(fsCF().to):""})}
      </div>
      ${tableCard({id:"t_fs_alerts",title:"التنبيهات التي تتطلب قرارًا",sub:"المشكلة · القيمة · المسؤول · الإجراء — العتبات في src/statements.py (ALERTS)"})}
      ${tableCard({id:"t_fs_budget",title:"الفعلي مقابل الموازنة",sub:"لا توجد موازنة محمّلة بعد — املأ data/budget/budget_2026.csv (شهر، بند، قيمة) ثم أعد البناء"})}`,
    update:()=>{ if(!FS)return; document.getElementById("fs_kpis").innerHTML=fsKpis();
      chFsPL("fs_pl");chFsCashBridge("fs_bridge");
      dt("t_fs_alerts",[{title:"الشهر",data:"month"},{title:"المشكلة",data:"problem"},
        {title:"الأولوية",data:"severity",render:s=>`<span class="prio ${sevCls(s)}">${sevAr(s)}</span>`},
        {title:"المسؤول",data:"owner"},{title:"الإجراء المطلوب",data:"action"}],FS.alerts,{order:[[0,"desc"]]});
      const bud=FS.budget||{};const ms=Object.keys(bud).sort();
      const rows=ms.flatMap(m=>Object.entries(bud[m]).map(([line,b])=>{const a=(FS.income[m]||{})[line];
        return {month:m,line,budget:egp(b),actual:a==null?"— (لا قائمة دخل لهذا الشهر بعد)":egp(a),
          var:a==null?"—":egp(a-b),varp:a==null||!b?"—":pct((a-b)/b)};}));
      dt("t_fs_budget",[{title:"الشهر",data:"month"},{title:"البند",data:"line"},{title:"الموازنة",data:"budget"},
        {title:"الفعلي",data:"actual"},{title:"الانحراف",data:"var"},{title:"الانحراف %",data:"varp"}],rows); }},

  fin_position:{ label:"المركز المالي",
    dom:()=>!FS?fsEmpty():`<div class="section-head"><div><h2>المركز المالي ${periodTag("في "+fsDate(FS.meta.as_of))}</h2>
      <p>الميزانية مقارنة بـ ${FS.meta.balance_sheet_dates.map(fsDate).join(" · ")} — عمود 28/2/2026 مستبعد لعدم توازنه</p></div></div>
      <div id="fs_pos_kpis"></div>
      <div class="grid g-2" style="margin-top:14px">
        ${card({id:"fs_assets",title:"هيكل الأصول"})}
        ${card({id:"fs_funding",title:"هيكل التمويل"})}
      </div>
      ${tableCard({id:"t_fs_bs",title:"الميزانية المقارنة",sub:"النسبة من إجمالي الأصول لآخر تاريخ · التغير بين آخر تاريخين"})}
      ${tableCard({id:"t_fs_ratios",title:"نسب السيولة والرافعة المالية"})}`,
    update:()=>{ if(!FS)return; const b=fsBS();let i=0;const d=()=>0.04*(i++);
      document.getElementById("fs_pos_kpis").innerHTML=`<div class="kpi-grid">
        ${kpiCard("money",egpK(b.total_assets),"إجمالي الأصول","#3b82f6","","",d())}
        ${kpiCard("money",egpK(b.total_equity),"حقوق الملكية","#10b981",pct(b.equity_ratio)+" من الأصول","na",d())}
        ${kpiCard("money",egpK(b.working_capital),"رأس المال العامل","#8b5cf6","نسبة التداول "+b.current_ratio,"na",d())}
        ${kpiCard("warn",egpK(b.net_debt),"صافي الدين","#ef4444","قروض "+egpK(b.interest_bearing_debt),"na",d())}
        ${kpiCard("money",egpK(b.cash_and_deposits),"النقدية والودائع","#06b6d4","منها ودائع "+egpK(b.time_deposits),"na",d())}
        ${kpiCard("warn",egpK(b.partners_current),"جاري الشركاء","#f97316","رصيد مدين يخفض حقوق الملكية","down",d())}
      </div>`;
      chFsStructure("fs_assets","assets");chFsStructure("fs_funding","funding");
      const ds=FS.meta.balance_sheet_dates;
      dt("t_fs_bs",[{title:"البند",data:"line",render:(v,_,r)=>r.bold?`<b>${v}</b>`:v},
        ...ds.map(x=>({title:fsDate(x),data:x})),{title:"% من الأصول",data:"pct"},{title:"التغير",data:"change"}],
        fsBSRows(),{ordering:false,pageLength:50,paging:false});
      dt("t_fs_ratios",[{title:"النسبة",data:"line"},...ds.map(x=>({title:fsDate(x),data:x}))],fsRatioRows(),{ordering:false,paging:false}); }},

  fin_income:{ label:"قائمة الدخل",
    dom:()=>!FS?fsEmpty():`<div class="section-head"><div><h2>قائمة الدخل الشهرية ${periodTag(fsMon(fsMonths()[0])+" – "+fsMon(fsLastM()))}</h2>
      <p>من قائمة الدخل التفصيلية · الإهلاك السنوي مسجّل في ديسمبر ويُعرض موزّعًا كتقدير للمقارنة</p></div></div>
      ${tableCard({id:"t_fs_pl",title:"قائمة الدخل (شهري + إجمالي الفترة)"})}
      <div class="grid g-2">
        ${card({id:"fs_vert",title:"التحليل الرأسي (% من المبيعات)"})}
        <div class="card"><div class="card-head"><div><h3>سيناريو التكلفة والسعر</h3>
          <span class="sub">على أرقام ${fsMon(fsLastM())} — <b id="fs_scn_lbl"></b></span></div></div>
          <label class="sub">تكلفة المبيعات % <input type="range" id="fs_scn_cogs" min="-15" max="15" value="5" step="1" style="width:100%"></label>
          <label class="sub">سعر البيع % <input type="range" id="fs_scn_price" min="-15" max="15" value="0" step="1" style="width:100%"></label>
          <div id="fs_scn" style="margin-top:10px"></div></div>
        ${card({id:"fs_admin_mix",title:"بنود المصروفات الإدارية — "+fsMon(fsLastM())})}
        ${card({id:"fs_sell_mix",title:"بنود المصروفات البيعية — "+fsMon(fsLastM())})}
      </div>`,
    update:()=>{ if(!FS)return; const ms=fsMonths();
      dt("t_fs_pl",[{title:"البند",data:"line"},...ms.map(m=>({title:fsMon(m),data:m})),{title:"إجمالي الفترة",data:"total"}],
        fsPLRows(),{ordering:false,paging:false});
      chFsVertical("fs_vert");chFsExpenseDonut("fs_admin_mix",fsLastM(),"admin");chFsExpenseDonut("fs_sell_mix",fsLastM(),"selling");
      ["fs_scn_cogs","fs_scn_price"].forEach(id=>{const e=document.getElementById(id);if(e)e.oninput=fsScenario;});fsScenario(); }},

  fin_wc:{ label:"السيولة ورأس المال العامل",
    dom:()=>!FS?fsEmpty():`<div class="section-head"><div><h2>السيولة ورأس المال العامل ${periodTag("في "+fsDate(FS.meta.as_of))}</h2>
      <p>أيام التحصيل والتخزين والسداد · التدفق النقدي المعاد حسابه من الميزانيتين · القروض · العُهد والسُّلف</p></div></div>
      <div id="fs_wc_kpis"></div>
      <div class="grid g-2" style="margin-top:14px">
        ${card({id:"fs_ccc",title:"دورة التحويل النقدي",sub:FS.working_capital?"على أساس "+FS.working_capital.window_months.map(fsMon).join("، "):""})}
        ${card({id:"fs_bridge2",title:"جسر التدفق النقدي",sub:fsCF()?fsDate(fsCF().from)+" → "+fsDate(fsCF().to):""})}
      </div>
      ${tableCard({id:"t_fs_cf",title:"قائمة التدفق النقدي (الطريقة غير المباشرة — محسوبة)",sub:"لا يُعتمد شيت CASH FLOW في الملف لأنه مبني على عمود فبراير غير المتوازن"})}
      ${tableCard({id:"t_fs_loans",title:"القروض",sub:"أرصدة الميزانية + تفصيل فبراير 2026 من ورقة الأصول المتداولة الأخرى"})}
      ${tableCard({id:"t_fs_oca",title:"تفصيل الأصول المتداولة الأخرى — "+fsDate(FS.meta.as_of),sub:"سُلف · عُهد · محافظ إلكترونية — الأرصدة السالبة بالأحمر"})}`,
    update:()=>{ if(!FS)return; const w=FS.working_capital||{};const b=fsBS();let i=0;const d=()=>0.04*(i++);
      document.getElementById("fs_wc_kpis").innerHTML=`<div class="kpi-grid">
        ${kpiCard("clock",(w.dso||0).toFixed(0)+" يوم","أيام التحصيل","#3b82f6","عملاء "+egpK(b.receivables),"na",d())}
        ${kpiCard("box",(w.dio||0).toFixed(0)+" يوم","أيام التخزين","#f59e0b","مخزون "+egpK(b.inventory),"na",d())}
        ${kpiCard("clock",(w.dpo||0).toFixed(0)+" يوم","أيام السداد للموردين","#10b981","موردون "+egpK(b.payables),"na",d())}
        ${kpiCard("clock",(w.ccc||0).toFixed(0)+" يوم","دورة التحويل النقدي","#8b5cf6","","",d())}
        ${kpiCard("pct",b.quick_ratio+"x","النسبة السريعة","#06b6d4","التداول "+b.current_ratio+"x","na",d())}
      </div>`;
      chFsCCC("fs_ccc");chFsCashBridge("fs_bridge2");
      dt("t_fs_cf",[{title:"البند",data:"line"},...FS.cash_flows.map((c,i)=>({title:fsDate(c.from)+" → "+fsDate(c.to),data:"p"+i}))],
        fsCFRows(),{ordering:false,paging:false});
      const ds=FS.meta.balance_sheet_dates;
      dt("t_fs_loans",[{title:"القرض",data:"name"},{title:"النوع",data:"kind"},...ds.map(x=>({title:fsDate(x),data:x})),
        {title:"28/02/2026",data:"feb"}],fsLoanRows(),{ordering:false,paging:false});
      dt("t_fs_oca",[{title:"الفئة",data:"category"},{title:"البند / الشخص",data:"name"},{title:"الرصيد",data:"amountF"}],
        fsOcaRows(),{order:[[0,"asc"]]}); }},

  fin_quality:{ label:"المطابقة وجودة القوائم",
    dom:()=>!FS?fsEmpty():`<div class="section-head"><div><h2>المطابقة وجودة القوائم المالية</h2>
      <p>كل ملاحظة على الملف تظهر هنا ولا تُخفى · مطابقة المبيعات مع الفواتير · قاموس المؤشرات</p></div></div>
      <div id="fs_flags" class="grid g-2"></div>
      <div class="grid g-2" style="margin-top:14px">
        ${card({id:"fs_recon",title:"صافي المبيعات بالقوائم مقابل مبيعات الفواتير"})}
        <div class="card"><div class="card-head"><h3>بيانات مطلوبة من الإدارة</h3></div><ul class="sub" style="line-height:2">
          <li>موازنة 2026 الشهرية → الفعلي مقابل الموازنة</li>
          <li>قوائم دخل يناير 2026 وما بعده → الملخص التنفيذي لعام 2026</li>
          <li>استكمال ميزانية 28/2/2026 أو حذفها</li>
          <li>أرصدة البنوك والخزينة أسبوعيًا → توقع نقدي 13 أسبوعًا</li>
          <li>جدول سداد قرضي المبادرة والسيارة وقروض الشركاء</li>
          <li>سجل الإنتاج (داخل/خارج/عظام/فاقد) → تكلفة الكيلو المنتج والعائد</li></ul></div>
      </div>
      ${tableCard({id:"t_fs_recon",title:"مطابقة المبيعات شهرًا بشهر",sub:"الحد المسموح ±2%"})}
      ${tableCard({id:"t_fs_dict",title:"قاموس المؤشرات",sub:"المعادلة والمصدر والفترة لكل مؤشر في الشاشات المالية"})}`,
    update:()=>{ if(!FS)return;
      document.getElementById("fs_flags").innerHTML=FS.quality_flags.map(f=>`<div class="insight ${sevCls(f.severity)}">
        <div class="insight-head"><h4>${esc(f.title)}</h4><span class="prio ${sevCls(f.severity)}">أولوية ${sevAr(f.severity)}</span></div>
        <div class="insight-grid"><div class="row" style="grid-column:1/-1"><span>${esc(f.detail)}</span></div>
        <div class="row" style="grid-column:1/-1"><span class="k">الإجراء:</span><span>${esc(f.action)}</span></div></div></div>`).join("");
      chFsRecon("fs_recon");
      dt("t_fs_recon",[{title:"الشهر",data:"month",render:fsMon},{title:"القوائم",data:"statement_net_sales",render:egp},
        {title:"الفواتير",data:"invoice_sales",render:v=>v==null?"—":egp(v)},{title:"الفرق",data:"diff",render:v=>v==null?"—":egp(v)},
        {title:"الفرق %",data:"diff_pct",render:v=>v==null?"—":pct(v)},
        {title:"الحالة",data:"ok",render:v=>v==null?"—":v?'<span class="up">مطابق</span>':'<span class="down">يحتاج تفسير</span>'}],
        FS.sales_reconciliation,{ordering:false,paging:false});
      dt("t_fs_dict",[{title:"المؤشر",data:"kpi"},{title:"المعادلة",data:"formula"},{title:"المصدر",data:"source"},{title:"الفترة",data:"period"}],
        FS.kpi_dictionary,{ordering:false,paging:false}); }},
};
Object.assign(SECTIONS, FIN_SECTIONS);

/* ========================================================================== */
/*  Rendering / navigation                                                     */
/* ========================================================================== */
const built = {};
function showSection(id){
  state.section=id;
  document.querySelectorAll(".nav-item").forEach(n=>n.classList.toggle("active",n.dataset.section===id));
  const host=document.getElementById("sections");
  document.querySelectorAll(".section").forEach(s=>s.classList.remove("active"));
  let el=document.getElementById("sec_"+id);
  if(!el){ el=document.createElement("section");el.className="section";el.id="sec_"+id;
    el.innerHTML=SECTIONS[id].dom();host.appendChild(el);built[id]=false; }
  el.classList.add("active");
  const X=buildContext();
  SECTIONS[id].update(X);
  paintInsights();
  built[id]=true;
  bindPng();
  setTimeout(()=>Object.values(charts).forEach(c=>c&&c.resize&&c.resize()),60);
  document.getElementById("sidebar").classList.remove("open");
}
function refreshActive(){ if(state.section){ SECTIONS[state.section].update(buildContext()); paintInsights(); } }

/* ---- PNG export per chart ---- */
function bindPng(){
  document.querySelectorAll("[data-png]").forEach(btn=>{
    btn.onclick=()=>{const c=charts[btn.dataset.png];if(!c)return;
      let url; try{url=c.getDataURL({pixelRatio:2,backgroundColor:isLight()?"#fff":"#0a0e1a"});}catch(e){toast("تعذّر تصدير هذا الرسم");return;}
      if(!url){toast("تصدير PNG غير متاح لهذا الرسم");return;}
      const a=document.createElement("a");a.href=url;a.download=btn.dataset.png+".png";a.click();};
  });
}

/* ========================================================================== */
/*  Drill-through — customer statement                                         */
/* ========================================================================== */
function openDrill(code){
  // Full-year 2026 statement for the customer (independent of the month filter),
  // joined with the fixed AR / bonus snapshot.
  const inv=D.invoices.filter(v=>v.customer_code===code);
  const lines=D.lines.filter(l=>l.customer_code===code);
  if(!inv.length && !lines.length) return;
  const [c]=aggCustomers(lines,inv);
  if(!c) return;
  // Actual cash receipts + returns for this customer (full-year 2026), plus the
  // authoritative final balance from the 2026-07-16 debt snapshot.
  const receipts=((D.collections&&D.collections.receipts)||[]).filter(r=>r.customer_code===code)
                  .sort((a,b)=>a.date<b.date?-1:1);
  const returns=((D.collections&&D.collections.returns_rows)||[]).filter(r=>r.customer_code===code)
                  .sort((a,b)=>a.date<b.date?-1:1);
  const totalColl=receipts.reduce((s,r)=>s+(r.amount||0),0);
  const totalRet=returns.reduce((s,r)=>s+(r.value||0),0);
  const ar=D.customer_ar[code]||{};
  const finalBal=ar.outstanding;                 // مديونية 16/7 (source of truth)
  const items=[...groupSum(lines,"item_name","line_total")].sort((a,b)=>b[1]-a[1]);
  const mk=(v,l)=>`<div class="mini-kpi"><div class="v num">${v}</div><div class="l">${l}</div></div>`;
  const invRows=inv.slice().sort((a,b)=>a.invoice_date<b.invoice_date?-1:1).map(v=>`<tr>
    <td>${v.invoice_no}</td><td>${v.invoice_date}</td><td class="num">${num(v.reported_total)}</td>
    <td class="num">${num(v.paid)}</td><td class="num">${num(v.remaining)}</td>
    <td>${({paid:'<span class="pos">محصّلة</span>',unpaid:'<span class="age-d31_60">غير محصّلة</span>',zero:'<span class="neg">صفرية</span>'}[v.status])}</td></tr>`).join("");
  const collRows=receipts.map(r=>`<tr><td>${r.date}</td><td>${r.method||"—"}</td>
    <td>${r.doc_ref||""}${r.receipt_no?" / "+r.receipt_no:""}</td><td class="num">${num(r.amount)}</td></tr>`).join("")
    || `<tr><td colspan="4" class="note">لا توجد تحصيلات مُطابَقة بالاسم</td></tr>`;
  const retRows=returns.map(r=>`<tr><td>${r.date}</td><td>${r.invoice_ref||""}</td><td class="num">${num(r.value)}</td></tr>`).join("")
    || `<tr><td colspan="3" class="note">لا توجد مرتجعات</td></tr>`;
  const itemRows=items.map(([n,v])=>`<tr><td>${n}</td><td class="num">${num(v)}</td></tr>`).join("");
  document.getElementById("drillTitle").textContent="كشف حساب — "+c.customer_name+" · مندوب: "+(c.rep||"غير محدد");
  document.getElementById("drillBody").innerHTML=`
    <div class="mini-kpis">
      ${mk(egpK(c.sales),"مبيعات ٢٠٢٦")}${mk(egpK(totalColl),"التحصيل الفعلي ٢٠٢٦")}
      ${mk(egpK(totalRet),"المرتجعات ٢٠٢٦")}${mk(finalBal==null?"—":egpK(finalBal),"الرصيد النهائي (١٦/٧)")}
      ${mk(c.collection_rate==null?"—":pct(c.collection_rate),"معدل التحصيل")}${mk(bonusBadge(c.bonus_pct),"الحافز")}
    </div>
    <div class="note" style="margin-bottom:14px">
      المُفوتر ٢٠٢٦: <b>${egp(ar.billed_2026!=null?ar.billed_2026:c.sales)}</b> ·
      التحصيل الفعلي: <b class="pos">${egp(totalColl)}</b> ·
      المرتجعات: <b>${egp(totalRet)}</b> ·
      الرصيد النهائي المعتمد (مديونية ١٦/٧): <b>${finalBal==null?"—":egp(finalBal)}</b>
      ${c.oldest_invoice_no?` · أقدم فاتورة غير محصّلة <b>${c.oldest_invoice_no}</b> (${c.oldest_invoice_date})`:""}
    </div>
    <div style="margin-bottom:16px"><h3 style="margin-bottom:8px">الفواتير</h3><div class="tbl-wrap"><table class="dataTable" style="width:100%">
      <thead><tr><th>الفاتورة</th><th>التاريخ</th><th>الإجمالي</th><th>المدفوع</th><th>الباقي</th><th>الحالة</th></tr></thead>
      <tbody>${invRows}</tbody></table></div></div>
    <div class="grid g-2">
      <div><h3 style="margin-bottom:8px">التحصيلات <span class="note">(نقدي فعلي)</span></h3><div class="tbl-wrap"><table class="dataTable" style="width:100%">
        <thead><tr><th>التاريخ</th><th>طريقة الدفع</th><th>سند / إيصال</th><th>المبلغ</th></tr></thead>
        <tbody>${collRows}</tbody></table></div></div>
      <div><h3 style="margin-bottom:8px">المرتجعات</h3><div class="tbl-wrap"><table class="dataTable" style="width:100%">
        <thead><tr><th>التاريخ</th><th>مرجع الفاتورة</th><th>القيمة</th></tr></thead>
        <tbody>${retRows}</tbody></table></div></div>
    </div>
    <div style="margin-top:16px"><h3 style="margin-bottom:8px">الأصناف المشتراة</h3><div class="tbl-wrap"><table class="dataTable" style="width:100%">
      <thead><tr><th>الصنف</th><th>القيمة</th></tr></thead><tbody>${itemRows}</tbody></table></div></div>`;
  document.getElementById("drillModal").classList.add("open");
}
function closeDrill(){document.getElementById("drillModal").classList.remove("open");}

/* Print / export the open customer statement to a standalone printable page
   (the browser's print dialog offers "Save as PDF"). Works fully offline. */
function printStatement(){
  const modal=document.getElementById("drillModal");
  if(!modal.classList.contains("open")) return;
  const title=document.getElementById("drillTitle").textContent;
  const body=document.getElementById("drillBody").innerHTML;
  const today=new Date().toISOString().slice(0,10);
  const w=window.open("","_blank");
  if(!w){ toast("يُرجى السماح بالنوافذ المنبثقة لتصدير الكشف"); return; }
  w.document.write('<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">'
    +'<title>'+title+'</title><style>'
    +"*{box-sizing:border-box;font-family:'Cairo',Tahoma,Arial,sans-serif}"
    +"body{margin:22px;color:#0f172a;background:#fff}"
    +".stmt-head{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #0f172a;padding-bottom:10px;margin-bottom:12px}"
    +".stmt-head .co{font-size:18px;font-weight:700}"
    +"h2{font-size:15px;margin:0 0 4px}"
    +".mini-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0}"
    +".mini-kpi{border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;text-align:center}"
    +".mini-kpi .v{font-size:15px;font-weight:700}.mini-kpi .l{font-size:11px;color:#475569}"
    +".note{font-size:12px;color:#334155;background:#f1f5f9;padding:8px 10px;border-radius:6px;margin:10px 0;line-height:1.7}"
    +"h3{font-size:13px;margin:14px 0 6px;border-right:3px solid #3b82f6;padding-right:6px}"
    +"table{width:100%;border-collapse:collapse;font-size:11px;margin-bottom:8px}"
    +"th,td{border:1px solid #e2e8f0;padding:4px 6px;text-align:right}th{background:#f1f5f9}"
    +".num{text-align:left;font-variant-numeric:tabular-nums}.tbl-wrap{overflow:visible}"
    +".grid.g-2{display:grid;grid-template-columns:1fr 1fr;gap:14px}"
    +".pos{color:#059669}.neg{color:#dc2626}.age-d31_60{color:#d97706}"
    +"@media print{body{margin:0 10px}.mini-kpi{-webkit-print-color-adjust:exact;print-color-adjust:exact}}"
    +'</style></head><body>'
    +'<div class="stmt-head"><div class="co">أبو هاشم للحوم — Food Industries</div>'
    +'<div style="font-size:12px;color:#475569">تاريخ الطباعة: '+today+'</div></div>'
    +'<h2>'+title+'</h2>'+body+'</body></html>');
  w.document.close(); w.focus();
  setTimeout(()=>{ try{ w.print(); }catch(e){} }, 350);
}

/* ========================================================================== */
/*  Filters                                                                     */
/* ========================================================================== */
function fillFilters(){
  const uniq=(arr,k)=>[...new Set(arr.map(x=>x[k]).filter(Boolean))].sort();
  const pairs=(map)=>Object.entries(map).map(([v,l])=>({v,l})).sort((a,b)=>a.l.localeCompare(b.l,"ar"));
  const opt=(el,vals)=>{vals.forEach(v=>{const o=document.createElement("option");
    o.value=typeof v==="object"?v.v:v;o.textContent=typeof v==="object"?v.l:v;el.appendChild(o);});};

  // Month selector — the one new feature. Populated with the 2026 months present
  // in the data plus an "All months" option; defaults to June.
  const fm=document.getElementById("f_month");
  fm.innerHTML="";
  opt(fm,[{v:"all",l:ALL_LABEL}, ...D.meta.available_months]);
  fm.value=state.filters.month;

  opt(document.getElementById("f_customer"),pairs(CUST_NAME));
  opt(document.getElementById("f_rep"),uniq(D.lines,"rep"));
  opt(document.getElementById("f_item"),pairs(ITEM_NAME));
  opt(document.getElementById("f_brand"),uniq(D.lines,"brand"));
  opt(document.getElementById("f_branch"),uniq(D.lines,"rep"));  // no branch field → salesperson region
  const ag=document.getElementById("f_aging");
  AGING_KEYS.forEach(k=>{const o=document.createElement("option");o.value=k;o.textContent=D.receivables.bucket_labels[k];ag.appendChild(o);});

  const map={f_month:"month",f_customer:"customer",f_rep:"rep",f_item:"item",
             f_brand:"brand",f_branch:"rep",f_status:"status",f_aging:"aging"};
  Object.keys(map).forEach(fid=>document.getElementById(fid).addEventListener("change",e=>{
    state.filters[map[fid]]=e.target.value;
    if(fid==="f_month"){
      document.getElementById("periodLabel").textContent=curMonthLabel();
      if(!monthHasData(e.target.value)) toast("لا توجد بيانات مبيعات لهذا الشهر بالمصدر");
    }
    renderChips(); refreshActive(); }));
}
function renderChips(){
  const f=state.filters;const host=document.getElementById("filterChips");host.innerHTML="";
  const labels={customer:"العميل",rep:"المندوب",item:"الصنف",brand:"العلامة",status:"الحالة",aging:"العمر"};
  const statusL={unpaid:"غير محصّلة",paid:"محصّلة",zero:"صفرية"};
  Object.entries(f).forEach(([k,v])=>{if(!v||k==="month")return;  // month has its own selector
    let txt=CUST_NAME[v]||ITEM_NAME[v]||statusL[v]||(k==="aging"?D.receivables.bucket_labels[v]:v);
    const c=document.createElement("span");c.className="chip";c.innerHTML=`${labels[k]||k}: <b>${txt}</b> ✕`;
    c.onclick=()=>{state.filters[k]="";syncSelects();renderChips();refreshActive();};host.appendChild(c);});
}
function syncSelects(){
  const m={f_month:"month",f_customer:"customer",f_rep:"rep",f_item:"item",
           f_brand:"brand",f_status:"status",f_aging:"aging"};
  Object.entries(m).forEach(([fid,k])=>{const el=document.getElementById(fid);if(el)el.value=state.filters[k];});
  const br=document.getElementById("f_branch");if(br&&br.value!==state.filters.rep)br.value=state.filters.rep;
}
function resetFilters(){  // reset cross-filters but keep the selected month
  const month=state.filters.month;
  state.filters={month,customer:"",rep:"",brand:"",item:"",status:"",aging:""};
  syncSelects();renderChips();refreshActive();toast("أُعيد ضبط الفلاتر");}

/* ---- global quick search: routes to active DataTable ---- */
function wireSearch(){
  document.getElementById("globalSearch").addEventListener("input",e=>{
    const v=e.target.value;Object.values(tables).forEach(t=>{try{t.search(v).draw();}catch(_){}}); });
}

/* ========================================================================== */
/*  Misc: theme, print, export-all, toast                                      */
/* ========================================================================== */
let toastT;
function toast(msg){const t=document.getElementById("toast");t.textContent=msg;t.classList.add("show");
  clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove("show"),2200);}
function toggleTheme(){document.body.setAttribute("data-theme",isLight()?"dark":"light");
  refreshActive();toast(isLight()?"المظهر الفاتح":"المظهر الداكن");}
function exportAll(){const t=tables[Object.keys(tables)[0]];
  const btn=$(".dt-button").filter((i,e)=>/Excel/.test(e.textContent)).first();
  if(btn.length){btn[0].click();}else{toast("افتح قسمًا به جدول للتصدير");}}

/* ========================================================================== */
/*  Boot                                                                        */
/* ========================================================================== */
function boot(){
  document.getElementById("periodLabel").textContent=curMonthLabel();
  const dm=D.meta.data_months||[];
  const span=dm.length?`${monthName(dm[0]).split(" ")[0]}–${monthName(dm[dm.length-1]).split(" ")[0]}`:"";
  document.getElementById("dataNote").innerHTML=
    `المصدر: فواتير 2026 (${span}) · لقطة مديونية ${D.meta.as_of}.<br>`+
    `قيود: لا تكلفة (لا هامش)، لا موازنة، الأعمار تقديرية.`+
    (FS?`<br>القوائم المالية: ميزانية ${fsDate(FS.meta.as_of)} وقوائم دخل ${fsMon(fsMonths()[0])}–${fsMon(fsLastM())} — الهامش والربحية في «الإدارة المالية».`:"");
  fillFilters();wireSearch();
  document.querySelectorAll(".nav-item").forEach(n=>n.addEventListener("click",()=>showSection(n.dataset.section)));
  document.getElementById("btnTheme").onclick=toggleTheme;
  document.getElementById("btnPrint").onclick=()=>window.print();
  document.getElementById("btnExportAll").onclick=exportAll;
  document.getElementById("btnReset").onclick=resetFilters;
  document.getElementById("navToggle").onclick=()=>document.getElementById("sidebar").classList.toggle("open");
  document.getElementById("drillClose").onclick=closeDrill;
  document.getElementById("drillPrint").onclick=printStatement;
  document.getElementById("drillModal").addEventListener("click",e=>{if(e.target.id==="drillModal")closeDrill();});
  document.addEventListener("keydown",e=>{if(e.key==="Escape")closeDrill();});
  showSection("overview");
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();
})();
