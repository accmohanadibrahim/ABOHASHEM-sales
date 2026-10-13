  /* ==========================================================================
     مُدمج من اللوحة التنفيذية (executive_dashboard) — إضافة فقط.
     كل ما يلي أقسام وبطاقات وجداول جديدة. لا يُعدِّل أي رقم أو قسم قائم في
     تطبيق الجوال، ولا يغيّر أي حساب تعتمد عليه الأقسام القائمة.

       window.DASH_FS  الميزانيات (31/7 و31/8 و31/12/2025) وقوائم الدخل الشهرية
                       7–12/2025 والتدفقات المعاد حسابها والقروض والعُهد
                       وتنبيهات الجودة — من statements_data.js.
       لقطة 16/7/2026  ملف data.js للوحة التنفيذية كما هو، لقطة ثانية بجانب
                       لقطة 3/9 (الافتراضية تبقى الأحدث).
     ========================================================================== */

  /* ---- مساعدات العرض -------------------------------------------------------- */
  fsMon(ym){
    const AR={"01":"يناير","02":"فبراير","03":"مارس","04":"أبريل","05":"مايو","06":"يونيو",
      "07":"يوليو","08":"أغسطس","09":"سبتمبر","10":"أكتوبر","11":"نوفمبر","12":"ديسمبر"};
    ym=String(ym||""); return (AR[ym.slice(5,7)]||ym)+" "+ym.slice(0,4);
  }
  fsDate(d){ d=String(d||""); return this.ltr(d.slice(8,10)+"/"+d.slice(5,7)+"/"+d.slice(0,4)); }

  /* خلية رقمية: الأرقام السالبة بين قوسين وبالأحمر كما في القوائم المالية. */
  fsC(v,k){
    const T=this.state.T;
    if(v==null||v===""||(typeof v==="number"&&!isFinite(v))) return {v:"—"};
    if(typeof v!=="number") return {v:String(v)};
    if(k==="pct") return {v:T.pct(v), c:v<0?"#fca5a5":null};
    if(k==="x") return {v:v.toFixed(2)+"x"};
    if(k==="d") return {v:Math.round(v)+" يوم"};
    const n=Math.round(v);
    return {v:n<0?"("+T.int(-n)+")":T.int(n), c:n<0?"#fca5a5":null};
  }

  /* جدول أفقي قابل للتمرير داخل البطاقة — القوائم المالية تُقرأ صفًا وعمودًا،
     وبطاقات الصفوف المعتادة تُخفي الأعمدة بعد الرابع. */
  fsTable(k,head,rows,opt){
    const o=opt||{};
    if(!rows||!rows.length) return this.empty(o.emptyMsg||"لا توجد بيانات");
    const th={padding:"7px 8px",fontSize:10.5,fontWeight:700,color:"#94a3b8",textAlign:"start",
      whiteSpace:"nowrap",borderBottom:"1px solid rgba(255,255,255,.14)",background:"#111827"};
    const td={padding:"6px 8px",fontSize:11,borderBottom:"1px solid rgba(255,255,255,.05)",
      whiteSpace:"nowrap",fontFamily:"'JetBrains Mono',monospace",textAlign:"start"};
    const td0={...td,fontFamily:"inherit",whiteSpace:"normal",minWidth:o.firstW||118};
    return React.createElement("div",{key:k,"data-fs-table":k,style:{overflowX:"auto",maxWidth:"100%"}},
      React.createElement("table",{style:{borderCollapse:"collapse",width:"100%"}},
        React.createElement("thead",null,React.createElement("tr",null,
          head.map((h,i)=>React.createElement("th",{key:i,style:th},h)))),
        React.createElement("tbody",null,rows.map((r,i)=>{
          const cells=Array.isArray(r)?r:r.cells, bold=!Array.isArray(r)&&r.bold;
          return React.createElement("tr",{key:i,style:bold?{background:"rgba(255,255,255,.035)"}:null},
            cells.map((c,j)=>{
              /* fsC() returns an object for figures; a bare string is text and is
                 set in the body font, wrapping once it is long. */
              const txt=!(c&&typeof c==="object");
              const cv=txt?{v:c}:c;
              const long=txt&&String(c==null?"":c).length>24;
              const base=j===0?td0:txt?{...td,fontFamily:"inherit",
                whiteSpace:long?"normal":"nowrap",minWidth:long?150:0}:td;
              return React.createElement("td",{key:j,style:{...base,
                  fontWeight:bold?800:400,color:cv.c||(j===0?"#e2e8f0":"#cbd5e1")}},
                cv.v==null?"—":cv.v);
            }));
        }))));
  }

  /* قائمة ملاحظات/تنبيهات بلون الأولوية — للتنبيهات العشرة والإنذارات الستة. */
  fsNotes(k,items){
    if(!items||!items.length) return this.empty("لا توجد ملاحظات");
    const col=s=>s==="high"?"#ef4444":s==="medium"?"#f59e0b":"#10b981";
    const ar=s=>s==="high"?"عالية":s==="medium"?"متوسطة":"منخفضة";
    return React.createElement("div",{key:k,style:{display:"flex",flexDirection:"column",gap:8}},
      items.map((it,i)=>React.createElement("div",{key:i,style:{padding:"9px 11px",borderRadius:12,
          background:"rgba(255,255,255,.02)",border:"1px solid rgba(255,255,255,.07)",
          borderInlineStart:"3px solid "+col(it.severity),display:"flex",flexDirection:"column",gap:5}},
        React.createElement("div",{style:{display:"flex",alignItems:"baseline",gap:7}},
          React.createElement("span",{style:{flex:1,minWidth:0,fontSize:12,fontWeight:700,color:"#e2e8f0",
            lineHeight:1.6}},it.title),
          React.createElement("span",{style:{flex:"none",fontSize:9,padding:"2px 7px",borderRadius:99,
            background:col(it.severity)+"22",color:col(it.severity),whiteSpace:"nowrap"}},
            "أولوية "+ar(it.severity))),
        (it.lines||[]).filter(l=>l&&l[1]!=null&&l[1]!=="").map((l,j)=>React.createElement("div",{key:j,
          style:{display:"flex",gap:7,fontSize:11,lineHeight:1.8}},
          React.createElement("span",{style:{flex:"none",width:70,color:"#64748b"}},l[0]),
          React.createElement("span",{style:{flex:1,minWidth:0,color:"#cbd5e1"}},l[1]))))));
  }

  fsAx(b,o){
    return Object.assign({axisLine:{lineStyle:{color:b._grid}},axisTick:{show:false},
      splitLine:{lineStyle:{color:b._grid}},
      axisLabel:{color:b._muted,fontSize:10,fontFamily:"Cairo, sans-serif",hideOverlap:true}},o||{});
  }
  /* The row scrolls sideways, so its min-height is 0; placed straight in the
     height-limited body column it would be squeezed to a sliver. */
  fsPick(k,items,cur,key){
    return React.createElement("div",{key:k,style:{flex:"none"}},
      this.pickRow(k+"r",items,cur,v=>this.setState({[key]:v})));
  }

  /* ---- المؤشرات الثمانية (نفس fsKpis في اللوحة التنفيذية) -------------------- */
  fsKpiRows(F){
    const T=this.state.T, ms=F.meta.income_months, lm=ms[ms.length-1], pm=ms[ms.length-2];
    const t=F.income[lm], p=F.income[pm]||t, b=F.balance_sheets[F.meta.as_of];
    const cf=F.cash_flows[F.cash_flows.length-1], wc=F.working_capital||{};
    const dS=p.net_sales?(t.net_sales-p.net_sales)/Math.abs(p.net_sales):0;
    const gmD=(t.gross_margin-p.gross_margin)*100, bud=Object.keys(F.budget||{});
    return [
      ["صافي المبيعات ("+this.fsMon(lm)+")",T.egpK(t.net_sales),
        (dS>=0?"▲ ":"▼ ")+T.pct(Math.abs(dS))+" مقابل "+this.fsMon(pm),"#3b82f6"],
      ["هامش مجمل الربح",T.pct(t.gross_margin),
        (gmD>=0?"▲ ":"▼ ")+Math.abs(gmD).toFixed(1)+" نقطة مقابل "+this.fsMon(pm),"#10b981"],
      ["EBITDA",T.egpK(t.ebitda),"هامش "+T.pct(t.ebitda_margin),"#8b5cf6"],
      ["صافي الربح قبل الإهلاك",T.egpK(t.net_profit_pre_dep),
        "بعد إهلاك السنة المحمّل على ديسمبر: "+T.egpK(t.net_profit_after_dep),"#06b6d4"],
      ["التدفق النقدي التشغيلي",T.egpK(cf.cfo),
        this.fsDate(cf.from)+" ← "+this.fsDate(cf.to)+" (محسوب من الميزانيتين)","#f59e0b"],
      ["صافي الدين",T.egpK(b.net_debt),
        "قروض "+T.egpK(b.interest_bearing_debt)+" − نقدية وودائع "+T.egpK(b.cash_and_deposits),"#ef4444"],
      ["دورة التحويل النقدي",(wc.ccc!=null?wc.ccc.toFixed(0):"—")+" يوم",
        wc.dso!=null?"تحصيل "+wc.dso.toFixed(0)+" + تخزين "+wc.dio.toFixed(0)+" − سداد "+wc.dpo.toFixed(0):"","#f97316"],
      ["الفعلي مقابل الموازنة",bud.length?bud.length+" شهر محمّل":"غير محمّلة",
        "قالب: data/budget/budget_2026.csv","#c4b5fd"]];
  }

  /* ---- الرسوم (منقولة من chFs* في اللوحة التنفيذية، بأحجام الجوال) ---------- */
  fsPLChart(F){
    const C=this.state.C, T=this.state.T, b=C.ecBase(), ms=F.meta.income_months, I=F.income;
    return {...b,
      tooltip:{...b.tooltip,trigger:"axis",valueFormatter:T.egp},
      legend:{...b.legend,data:["صافي المبيعات","مجمل الربح","EBITDA","صافي الربح قبل الإهلاك","هامش المجمل"]},
      grid:{...b.grid,top:34},
      xAxis:this.fsAx(b,{type:"category",data:ms.map(m=>this.fsMon(m).split(" ")[0])}),
      yAxis:[this.fsAx(b,{type:"value",axisLabel:{color:b._muted,fontSize:10,formatter:T.egpK}}),
        this.fsAx(b,{type:"value",min:0,max:0.6,splitLine:{show:false},
          axisLabel:{color:b._muted,fontSize:10,formatter:v=>Math.round(v*100)+"%"}})],
      series:[
        {name:"صافي المبيعات",type:"bar",data:ms.map(m=>Math.round(I[m].net_sales)),itemStyle:{color:T.PAL[0],borderRadius:[3,3,0,0]}},
        {name:"مجمل الربح",type:"bar",data:ms.map(m=>Math.round(I[m].gross_profit)),itemStyle:{color:T.PAL[2],borderRadius:[3,3,0,0]}},
        {name:"EBITDA",type:"bar",data:ms.map(m=>Math.round(I[m].ebitda)),itemStyle:{color:T.PAL[1],borderRadius:[3,3,0,0]}},
        {name:"صافي الربح قبل الإهلاك",type:"line",data:ms.map(m=>Math.round(I[m].net_profit_pre_dep)),lineStyle:{width:3},itemStyle:{color:T.PAL[3]}},
        {name:"هامش المجمل",type:"line",yAxisIndex:1,data:ms.map(m=>I[m].gross_margin),lineStyle:{type:"dashed"},
          itemStyle:{color:T.PAL[5]},tooltip:{valueFormatter:v=>T.pct(v)}}]};
  }
  fsVerticalChart(F){
    const C=this.state.C, T=this.state.T, b=C.ecBase(), ms=F.meta.income_months, I=F.income;
    const s=k=>ms.map(m=>I[m].net_sales?I[m][k]/I[m].net_sales:0);
    const ser=[["تكلفة المبيعات","cogs",T.PAL[4]],["إدارية وعمومية","admin",T.PAL[3]],["بيعية وتسويقية","selling",T.PAL[6]],
      ["تمويلية/فروق عملة","finance",T.PAL[7]],["صافي الربح قبل الإهلاك","net_profit_pre_dep",T.PAL[2]]];
    return {...b,
      tooltip:{...b.tooltip,trigger:"axis",valueFormatter:v=>T.pct(v)},
      grid:{...b.grid,top:34},
      xAxis:this.fsAx(b,{type:"category",data:ms.map(m=>this.fsMon(m).split(" ")[0])}),
      yAxis:this.fsAx(b,{type:"value",max:1,axisLabel:{color:b._muted,fontSize:10,formatter:v=>Math.round(v*100)+"%"}}),
      series:ser.map(([n,k,c])=>({name:n,type:"bar",stack:"v",data:s(k),itemStyle:{color:c}}))};
  }
  fsStructureChart(F,side){
    const C=this.state.C, T=this.state.T, b=C.ecBase(), ds=F.meta.balance_sheet_dates, B=F.balance_sheets;
    const parts=side==="assets"
      ?[["النقدية والودائع",x=>x.cash_and_deposits],["العملاء",x=>x.receivables],["المخزون",x=>x.inventory],
        ["أصول متداولة أخرى",x=>(x.other_current_assets||0)+(x.prepaid||0)],["صافي الأصول الثابتة",x=>x.net_fixed_assets],
        ["استثمارات",x=>x.investments_subsidiaries]]
      :[["خصوم متداولة",x=>x.total_current_liabilities],["قرض المبادرة",x=>x.initiative_loan],["قرض السيارة",x=>x.car_loan],
        ["قروض الشركاء",x=>x.shareholder_loans],["حقوق الملكية",x=>x.total_equity]];
    return {...b,
      tooltip:{...b.tooltip,trigger:"axis",valueFormatter:T.egp},
      grid:{...b.grid,top:34},
      xAxis:this.fsAx(b,{type:"category",data:ds.map(d=>d.slice(8,10)+"/"+d.slice(5,7)+"/"+d.slice(2,4))}),
      yAxis:this.fsAx(b,{type:"value",axisLabel:{color:b._muted,fontSize:10,formatter:T.egpK}}),
      series:parts.map(([n,f],i)=>({name:n,type:"bar",stack:"s",
        data:ds.map(d=>Math.round(f(B[d])||0)),itemStyle:{color:T.PAL[i]}}))};
  }
  fsBridgeChart(cf){
    const C=this.state.C, T=this.state.T, b=C.ecBase();
    const steps=[["صافي الربح",cf.net_income],["الإهلاك",cf.depreciation],["العملاء",cf.change_receivables],
      ["المخزون",cf.change_inventory],["أصول متداولة أخرى",cf.change_other_current_assets],["الموردون",cf.change_payables],
      ["المستحقات",cf.change_accrued],["الاستثمار الرأسمالي",-cf.capex],["القروض",cf.debt_change],
      ["جاري الشركاء/مسحوبات",cf.equity_other_movements]];
    let acc=0; const base=[], val=[];
    steps.forEach(([,v])=>{ v=v||0; base.push(v>=0?acc:acc+v); val.push(v); acc+=v; });
    val.push(acc);
    const cats=steps.map(s=>s[0]).concat(["التغير في النقدية"]);
    return {...b,
      tooltip:{...b.tooltip,trigger:"axis",formatter:ps=>{const p=ps.find(x=>x.seriesIndex===1);
        return p?p.name+"<br/>"+T.egp(val[p.dataIndex]):"";}},
      grid:{...b.grid,top:14,left:4},
      xAxis:this.fsAx(b,{type:"value",axisLabel:{color:b._muted,fontSize:10,formatter:T.egpK}}),
      yAxis:this.fsAx(b,{type:"category",inverse:true,data:cats,axisLabel:{color:b._muted,fontSize:10}}),
      series:[{type:"bar",stack:"w",silent:true,itemStyle:{color:"transparent"},data:[...base.map(Math.round),0]},
        {type:"bar",stack:"w",data:[...val.slice(0,-1).map(v=>({value:Math.round(Math.abs(v)),
          itemStyle:{color:v>=0?T.PAL[2]:T.PAL[4],borderRadius:3}})),
          {value:Math.round(Math.abs(acc)),itemStyle:{color:T.PAL[1],borderRadius:3}}]}]};
  }
  fsCCCChart(w){
    const C=this.state.C, T=this.state.T, b=C.ecBase();
    if(!w||w.dso==null) return {__empty:true};
    return {...b,
      tooltip:{...b.tooltip,trigger:"axis",valueFormatter:v=>Math.round(v)+" يوم"},
      xAxis:this.fsAx(b,{type:"category",data:["التحصيل","التخزين","السداد","الدورة"]}),
      yAxis:this.fsAx(b,{type:"value",axisLabel:{color:b._muted,fontSize:10,formatter:v=>v+" يوم"}}),
      series:[{type:"bar",label:{show:true,position:"top",color:b._ink,fontSize:10,formatter:p=>Math.round(p.value)},
        data:[{value:w.dso,itemStyle:{color:T.PAL[0]}},{value:w.dio,itemStyle:{color:T.PAL[3]}},
          {value:-w.dpo,itemStyle:{color:T.PAL[2]}},{value:w.ccc,itemStyle:{color:T.PAL[1]}}]}]};
  }
  fsReconChart(F){
    const C=this.state.C, T=this.state.T, b=C.ecBase(), R=F.sales_reconciliation||[];
    if(!R.length) return {__empty:true};
    return {...b,
      tooltip:{...b.tooltip,trigger:"axis",valueFormatter:T.egp},
      legend:{...b.legend,data:["صافي المبيعات بالقوائم","مبيعات الفواتير"]},
      grid:{...b.grid,top:34},
      xAxis:this.fsAx(b,{type:"category",data:R.map(r=>this.fsMon(r.month).split(" ")[0])}),
      yAxis:this.fsAx(b,{type:"value",axisLabel:{color:b._muted,fontSize:10,formatter:T.egpK}}),
      series:[{name:"صافي المبيعات بالقوائم",type:"bar",data:R.map(r=>Math.round(r.statement_net_sales)),itemStyle:{color:T.PAL[0]}},
        {name:"مبيعات الفواتير",type:"bar",data:R.map(r=>Math.round(r.invoice_sales||0)),itemStyle:{color:T.PAL[1]}}]};
  }
  fsExpenseDonut(F,month,section){
    const C=this.state.C;
    const it=(((F.income[month]||{}).expense_items||{})[section]||[]).filter(x=>x.amount>0)
      .sort((a,c)=>c.amount-a.amount);
    const top=it.slice(0,8).map(x=>[x.name,Math.round(x.amount)]);
    const rest=it.slice(8).reduce((a,x)=>a+x.amount,0);
    if(rest) top.push(["أخرى",Math.round(rest)]);
    return C.donut(top);
  }

  /* ---- اختيار الفترة في الشاشات ----------------------------------------------- */
  fsCfIdx(F){ const n=(F.cash_flows||[]).length; const i=this.state.fsCf;
    return (i!=null&&i>=0&&i<n)?i:n-1; }
  fsCfLabel(c){ return this.fsDate(c.from)+" ← "+this.fsDate(c.to); }
  fsBridgeCard(F,k,title){
    const cfs=F.cash_flows||[];
    if(!cfs.length) return this.card(title,this.empty("لا توجد تدفقات محسوبة"),{k});
    const i=this.fsCfIdx(F), cf=cfs[i];
    return this.card(title,[
      cfs.length>1?this.fsPick(k+"p",cfs.map((c,j)=>[j,this.fsCfLabel(c)]),i,"fsCf"):null,
      React.createElement(EChart,{key:"c",option:this.fsBridgeChart(cf),h:this.state.C.H.tall}),
      React.createElement("div",{key:"n",style:{fontSize:10,lineHeight:1.75,color:"#64748b"}},
        "صافي التغير المحسوب "+this.state.T.egp(cf.net_change)+" · التغير الفعلي في النقدية والودائع "
        +this.state.T.egp(cf.actual_change_cash_deposits)+" · فرق المطابقة "+this.state.T.num(cf.check_diff))],
      {k,sub:"الأشهر: "+(cf.months||[]).map(m=>this.fsMon(m).split(" ")[0]).join("، ")});
  }

  /* ---- القسم: الملخص المالي التنفيذي --------------------------------------- */
  fsExec(F,T){
    const C=this.state.C, th=F.alert_thresholds||{};
    const TH={gross_margin_drop_pts:["هبوط هامش مجمل الربح أكثر من",v=>v+" نقطة"],
      admin_pct_of_sales_max:["المصروفات الإدارية فوق نسبة من المبيعات",v=>T.pct(v,0)],
      drawings_pct_of_profit_max:["مسحوبات الشركاء فوق نسبة من صافي الربح",v=>T.pct(v,0)],
      dio_days_max:["أيام التخزين فوق",v=>v+" يوم"],
      sales_recon_pct_max:["فرق مطابقة المبيعات مع الفواتير فوق",v=>T.pct(v,0)]};
    const bud=F.budget||{}, bms=Object.keys(bud).sort();
    const budRows=bms.flatMap(m=>Object.entries(bud[m]).map(([line,bv])=>{
      const a=(F.income[m]||{})[line];
      return [this.fsMon(m),line,this.fsC(bv),a==null?"— (لا قائمة دخل لهذا الشهر بعد)":this.fsC(a),
        a==null?"—":this.fsC(a-bv),a==null||!bv?"—":this.fsC((a-bv)/bv,"pct")];}));
    return [
      this.kpiTiles(this.fsKpiRows(F),"fsk"),
      this.chartCard("المبيعات ومجمل الربح وEBITDA شهريًا",this.fsPLChart(F),
        {k:"fe1",h:C.H.tall,sub:"المتقطع: هامش المجمل (المحور الثاني)"}),
      this.fsBridgeCard(F,"fe2","من صافي الربح إلى التغير في النقدية"),
      this.card("التنبيهات التي تتطلب قرارًا",this.fsNotes("al",(F.alerts||[]).map(a=>({
          severity:a.severity,title:a.problem,
          lines:[["الشهر",this.fsMon(a.month)],["القيمة",a.value],["المسؤول",a.owner],["الإجراء",a.action]]}))),
        {k:"fe3",sub:(F.alerts||[]).length+" تنبيه · الأحدث أولًا"}),
      this.card("حدود التنبيه",this.fsTable("th",["القاعدة","الحد"],
        Object.entries(th).map(([key,v])=>[(TH[key]||[key])[0],(TH[key]&&TH[key][1])?TH[key][1](v):String(v)])),
        {k:"fe4",sub:"العتبات في src/statements.py (ALERTS)"}),
      this.card("الفعلي مقابل الموازنة",budRows.length
          ? this.fsTable("bud",["الشهر","البند","الموازنة","الفعلي","الانحراف","الانحراف %"],budRows)
          : this.empty("لا توجد موازنة محمّلة بعد — املأ data/budget/budget_2026.csv (شهر، بند، قيمة) ثم أعد البناء"),
        {k:"fe5"})];
  }

  /* ---- القسم: المركز المالي ------------------------------------------------- */
  fsBsKeys(F){
    const CORE=["cash","time_deposits","receivables","inventory","prepaid","other_current_assets","total_current_assets",
      "net_fixed_assets","investments_subsidiaries","total_noncurrent_assets","total_assets","payables","accrued_expenses",
      "total_current_liabilities","initiative_loan","car_loan","shareholder_loans","total_lt_liabilities","total_liabilities",
      "paid_in_capital","partners_current","retained_earnings","net_profit_bs","total_equity","total_liabilities_equity"];
    const DERIVED=["balance_diff","interest_bearing_debt","cash_and_deposits","net_debt","working_capital","current_ratio",
      "quick_ratio","cash_ratio","liabilities_to_equity","debt_to_equity","equity_ratio"];
    const ds=F.meta.balance_sheet_dates, B=F.balance_sheets;
    const all=[...new Set(ds.flatMap(d=>Object.keys(B[d])))];
    const extra=all.filter(k=>!CORE.includes(k)&&!DERIVED.includes(k));
    return {core:CORE.filter(k=>ds.some(d=>B[d][k])), extra:extra.filter(k=>ds.some(d=>B[d][k]))};
  }
  fsLabel(F,k){
    const X={due_from_affiliates:"مستحق من أطراف ذات علاقة",lt_investments:"استثمارات طويلة الأجل",
      tax_receivable:"ضرائب مستردة",other_noncurrent_assets:"أصول غير متداولة أخرى",intangibles:"أصول غير ملموسة",
      st_bank_debt:"تسهيلات بنكية قصيرة الأجل",other_credit_balances:"أرصدة دائنة أخرى",dividends_payable:"توزيعات مستحقة",
      provisions_current:"مخصصات متداولة",due_to_affiliates:"مستحق لأطراف ذات علاقة",current_ltd:"الجزء المتداول من القروض",
      tax_provision:"مخصص ضرائب",other_provisions:"مخصصات أخرى",reserves:"احتياطيات",treasury_shares:"أسهم خزينة",
      balance_diff:"فرق التوازن (الأصول − الالتزامات وحقوق الملكية)",interest_bearing_debt:"القروض بفائدة",
      cash_and_deposits:"النقدية والودائع"};
    return (F.bs_labels||{})[k]||X[k]||k;
  }
  fsPosition(F,T){
    const ds=F.meta.balance_sheet_dates, B=F.balance_sheets;
    const sel=ds.includes(this.state.fsBs)?this.state.fsBs:F.meta.as_of;
    const b=B[sel], si=ds.indexOf(sel), prev=si>0?ds[si-1]:null;
    const keys=this.fsBsKeys(F);
    const bsRow=k=>({bold:/^total/.test(k),cells:[this.fsLabel(F,k)].concat(ds.map(d=>this.fsC(B[d][k])),
      [this.fsC(b.total_assets?(b[k]||0)/b.total_assets:null,"pct"),
       prev?this.fsC((b[k]||0)-(B[prev][k]||0)):"—"])});
    const head=["البند"].concat(ds.map(d=>this.fsDate(d)),["% من الأصول ("+this.fsDate(sel)+")",
      prev?"التغير ("+this.fsDate(prev)+" ← "+this.fsDate(sel)+")":"التغير"]);
    const RAT=[["نسبة التداول","current_ratio","x"],["النسبة السريعة","quick_ratio","x"],["نسبة النقدية","cash_ratio","x"],
      ["الالتزامات ÷ حقوق الملكية","liabilities_to_equity","x"],["القروض ÷ حقوق الملكية","debt_to_equity","x"],
      ["حقوق الملكية ÷ الأصول","equity_ratio","pct"],["رأس المال العامل","working_capital"],
      ["القروض بفائدة","interest_bearing_debt"],["النقدية والودائع","cash_and_deposits"],["صافي الدين","net_debt"],
      ["فرق التوازن","balance_diff"]];
    return [
      this.fsPick("bsd",ds.map(d=>[d,this.fsDate(d)]),sel,"fsBs"),
      this.kpiTiles([
        ["إجمالي الأصول",T.egpK(b.total_assets),"في "+this.fsDate(sel),"#3b82f6"],
        ["حقوق الملكية",T.egpK(b.total_equity),T.pct(b.equity_ratio)+" من الأصول","#10b981"],
        ["رأس المال العامل",T.egpK(b.working_capital),"نسبة التداول "+b.current_ratio,"#8b5cf6"],
        ["صافي الدين",T.egpK(b.net_debt),"قروض "+T.egpK(b.interest_bearing_debt),"#ef4444"],
        ["النقدية والودائع",T.egpK(b.cash_and_deposits),"منها ودائع "+T.egpK(b.time_deposits),"#06b6d4"],
        ["جاري الشركاء",T.egpK(b.partners_current),"رصيد مدين يخفض حقوق الملكية","#f97316"]],"fsp"),
      this.chartCard("هيكل الأصول",this.fsStructureChart(F,"assets"),{k:"fp1"}),
      this.chartCard("هيكل التمويل",this.fsStructureChart(F,"funding"),{k:"fp2"}),
      this.card("الميزانية المقارنة",this.fsTable("bs",head,keys.core.map(bsRow)),
        {k:"fp3",sub:"التواريخ الثلاثة المتوازنة · عمود "+(F.meta.dropped_dates||[]).map(d=>this.fsDate(d)).join("، ")+" مستبعد"}),
      keys.extra.length?this.card("بنود أخرى في الميزانية",this.fsTable("bsx",head,keys.extra.map(bsRow)),{k:"fp4"}):null,
      this.card("نسب السيولة والرافعة المالية",this.fsTable("rat",["النسبة"].concat(ds.map(d=>this.fsDate(d))),
        RAT.map(([l,k,f])=>[l].concat(ds.map(d=>this.fsC(B[d][k],f))))),{k:"fp5"})];
  }

  /* ---- القسم: قائمة الدخل --------------------------------------------------- */
  fsIncome(F,T){
    const C=this.state.C, ms=F.meta.income_months, I=F.income, lm=ms[ms.length-1];
    const mon=ms.includes(this.state.fsMonth)?this.state.fsMonth:lm;
    const sum=k=>ms.reduce((a,m)=>a+(I[m][k]||0),0);
    const LINES=[["صافي المبيعات","net_sales"],["تكلفة المبيعات","cogs"],["مجمل الربح","gross_profit",0,1],
      ["هامش مجمل الربح","gross_margin","pct"],["مصروفات إدارية وعمومية","admin"],
      ["الإدارية % من المبيعات","admin_pct","pct"],["مصروفات بيعية وتسويقية","selling"],
      ["البيعية % من المبيعات","selling_pct","pct"],["EBITDA","ebitda",0,1],["هامش EBITDA","ebitda_margin","pct"],
      ["مصاريف تمويلية / فروق عملة","finance"],["بنود أخرى","other_items"],
      ["صافي الربح قبل الإهلاك","net_profit_pre_dep",0,1],["الإهلاك المحمّل فعليًا","depreciation_booked"],
      ["صافي الربح بعد الإهلاك (كما بالقوائم)","net_profit_after_dep",0,1],
      ["الإهلاك الموزّع شهريًا (تقدير)","depreciation_allocated_est"],
      ["صافي الربح بعد إهلاك موزّع (تقدير)","net_profit_dep_allocated_est"]];
    const tot=(k,f)=>f==="pct"
      ? (k==="gross_margin"?sum("gross_profit")/sum("net_sales"):k==="ebitda_margin"?sum("ebitda")/sum("net_sales")
         :k==="admin_pct"?sum("admin")/sum("net_sales"):sum("selling")/sum("net_sales"))
      : sum(k);
    const plRows=LINES.map(([l,k,f,bold])=>({bold:!!bold,cells:[l].concat(ms.map(m=>this.fsC(I[m][k],f)),[this.fsC(tot(k,f),f)])}));
    const scn=this.state.fsScn||{c:5,p:0}, t=I[lm];
    const sales=t.net_sales*(1+scn.p/100), cogs=t.cogs*(1+scn.c/100), gp=sales-cogs, eb=gp-t.admin-t.selling;
    const slider=(lab,key)=>React.createElement("label",{key,style:{display:"flex",flexDirection:"column",gap:4,
        fontSize:11,color:"#94a3b8"}},
      lab+" "+(scn[key]>=0?"+":"")+scn[key]+"%",
      React.createElement("input",{type:"range",min:-15,max:15,step:1,value:scn[key],
        onChange:e=>{const v=+e.target.value; this.setState(s=>({fsScn:{...(s.fsScn||{c:5,p:0}),[key]:v}}));},
        style:{width:"100%"}}));
    const items=(I[mon].expense_items)||{};
    const SECT={admin:"إدارية",selling:"بيعية",finance:"تمويلية"};
    const itemRows=Object.keys(items).flatMap(sec=>(items[sec]||[]).map(x=>[SECT[sec]||sec,x.name,this.fsC(x.amount)]));
    const pop=F.income_pop_sheet||{}, pms=Object.keys(pop).sort();
    const POP=[["صافي المبيعات","net_sales"],["التكلفة","cogs"],["إدارية","admin"],["«أرباح التشغيل» كما بالملف","ebitda_as_labelled"],
      ["الإهلاك","depreciation"],["مصروفات أخرى","other_expenses"],["فروق عملة","fx_loss"],["تمويلية","finance"],["صافي الربح","net_profit"]];
    return [
      this.card("قائمة الدخل (شهري + إجمالي الفترة)",this.fsTable("pl",["البند"].concat(ms.map(m=>this.fsMon(m)),["إجمالي الفترة"]),plRows),
        {k:"fi1",sub:"الإهلاك السنوي مسجّل في ديسمبر ويُعرض موزّعًا كتقدير للمقارنة"}),
      this.chartCard("التحليل الرأسي (% من المبيعات)",this.fsVerticalChart(F),{k:"fi2",h:C.H.tall}),
      this.card("سيناريو التكلفة والسعر",[slider("تكلفة المبيعات","c"),slider("سعر البيع","p"),
        this.kpiTiles([
          ["هامش المجمل بعد السيناريو",T.pct(gp/sales),"الفعلي "+T.pct(t.gross_margin),"#10b981"],
          ["EBITDA بعد السيناريو",T.egpK(eb),"الفعلي "+T.egpK(t.ebitda),"#8b5cf6"],
          ["الأثر الشهري على EBITDA",T.egpK(eb-t.ebitda),"× 12 = "+T.egpK((eb-t.ebitda)*12)+" سنويًا","#f59e0b"]],"scn")],
        {k:"fi3",sub:"على أرقام "+this.fsMon(lm)}),
      this.fsPick("fim",ms.map(m=>[m,this.fsMon(m)]),mon,"fsMonth"),
      this.chartCard("بنود المصروفات الإدارية — "+this.fsMon(mon),this.fsExpenseDonut(F,mon,"admin"),{k:"fi4",h:C.H.base}),
      this.chartCard("بنود المصروفات البيعية — "+this.fsMon(mon),this.fsExpenseDonut(F,mon,"selling"),{k:"fi5",h:C.H.base}),
      this.card("كل بنود المصروفات — "+this.fsMon(mon),this.fsTable("items",["القسم","البند","القيمة"],itemRows),
        {k:"fi6",sub:itemRows.length+" بند · المصدر: "+(I[mon].source||"—")}),
      pms.length?this.card("قائمة الدخل كما وردت في ملف القوائم (pop)",
        this.fsTable("pop",["البند"].concat(pms.map(m=>this.fsMon(m))),POP.map(([l,k])=>[l].concat(pms.map(m=>this.fsC(pop[m][k]))))),
        {k:"fi7",sub:"للمقارنة مع القائمة التفصيلية — يوليو يختلف في الإدارية بـ 75,000"}):null,
      this.card("المصادر",React.createElement("div",{style:{fontSize:11,lineHeight:1.9,color:"#94a3b8"}},
        (F.meta.sources||[]).join(" · ")+" — أُنتجت "+this.ltr(F.meta.generated||"")),{k:"fi8"})];
  }

  /* ---- القسم: السيولة ورأس المال العامل ------------------------------------- */
  fsWc(F,T){
    const C=this.state.C, w=F.working_capital||{}, b=F.balance_sheets[F.meta.as_of];
    const cfs=F.cash_flows||[], ds=F.meta.balance_sheet_dates;
    const odates=Object.keys(F.other_current_assets||{}).sort();
    const od=odates.includes(this.state.fsOca)?this.state.fsOca:(odates.includes(F.meta.as_of)?F.meta.as_of:odates[odates.length-1]);
    const oca=((F.other_current_assets||{})[od]||[]).filter(x=>x.amount);
    const byCat={}; oca.forEach(x=>{byCat[x.category]=(byCat[x.category]||0)+x.amount;});
    const CF=[["صافي الربح (بعد الإهلاك)","net_income"],["+ الإهلاك","depreciation"],["(زيادة)/نقص العملاء","change_receivables"],
      ["(زيادة)/نقص المخزون","change_inventory"],["(زيادة)/نقص أصول متداولة أخرى","change_other_current_assets"],
      ["زيادة/(نقص) الموردين","change_payables"],["زيادة/(نقص) المستحقات","change_accrued"],["= التدفق النقدي التشغيلي","cfo",1],
      ["الاستثمار الرأسمالي","capex"],["= التدفق النقدي الاستثماري","cfi",1],["التغير في القروض","debt_change"],
      ["حركة جاري الشركاء / مسحوبات (تسوية حقوق الملكية)","equity_other_movements"],["= التدفق النقدي التمويلي","cff",1],
      ["صافي التغير المحسوب","net_change",1],["التغير الفعلي في النقدية والودائع","actual_change_cash_deposits"],["فرق المطابقة","check_diff"]];
    return [
      this.kpiTiles([
        ["أيام التحصيل",(w.dso||0).toFixed(0)+" يوم","عملاء "+T.egpK(b.receivables),"#3b82f6"],
        ["أيام التخزين",(w.dio||0).toFixed(0)+" يوم","مخزون "+T.egpK(b.inventory),"#f59e0b"],
        ["أيام السداد للموردين",(w.dpo||0).toFixed(0)+" يوم","موردون "+T.egpK(b.payables),"#10b981"],
        ["دورة التحويل النقدي",(w.ccc||0).toFixed(0)+" يوم",(w.window_days||"—")+" يومًا من البيانات","#8b5cf6"],
        ["النسبة السريعة",b.quick_ratio+"x","التداول "+b.current_ratio+"x","#06b6d4"],
        ["نقدية محبوسة في العملاء والمخزون",T.egpK((w.cash_tied_receivables||0)+(w.cash_tied_inventory||0)),
          "يموّل منها الموردون "+T.egpK(w.funded_by_payables),"#f97316"]],"fsw"),
      this.chartCard("دورة التحويل النقدي",this.fsCCCChart(w),{k:"fw1",h:C.H.short,
        sub:w.window_months?"على أساس "+w.window_months.map(m=>this.fsMon(m).split(" ")[0]).join("، "):""}),
      this.card("أساس حساب الدورة",this.fsTable("wcb",["البند","القيمة"],[
        ["مبيعات الفترة",this.fsC(w.sales_window)],["تكلفة مبيعات الفترة",this.fsC(w.cogs_window)],
        ["عدد الأيام",this.fsC(w.window_days)],["أيام التحصيل",this.fsC(w.dso,"d")],["أيام التخزين",this.fsC(w.dio,"d")],
        ["أيام السداد",this.fsC(w.dpo,"d")],["الدورة النقدية",this.fsC(w.ccc,"d")],
        ["نقدية في العملاء",this.fsC(w.cash_tied_receivables)],["نقدية في المخزون",this.fsC(w.cash_tied_inventory)],
        ["تمويل الموردين",this.fsC(w.funded_by_payables)]]),{k:"fw2",sub:"في "+this.fsDate(w.as_of||F.meta.as_of)}),
      this.fsBridgeCard(F,"fw3","جسر التدفق النقدي"),
      this.card("قائمة التدفق النقدي (الطريقة غير المباشرة — محسوبة)",
        this.fsTable("cf",["البند"].concat(cfs.map(c=>this.fsCfLabel(c))),
          CF.map(([l,k,bold])=>({bold:!!bold,cells:[l].concat(cfs.map(c=>this.fsC(c[k])))}))),
        {k:"fw4",sub:"لا يُعتمد شيت CASH FLOW في الملف لأنه مبني على عمود فبراير غير المتوازن"}),
      this.card("القروض",this.fsTable("loans",["القرض","النوع"].concat(ds.map(d=>this.fsDate(d))),
        (F.loans||[]).map(l=>[l.name,l.kind].concat(ds.map(d=>this.fsC((l.balances||{})[d]))))),{k:"fw5"}),
      this.fsPick("oca",odates.map(d=>[d,this.fsDate(d)]),od,"fsOca"),
      this.card("الأصول المتداولة الأخرى حسب الفئة — "+this.fsDate(od),
        this.fsTable("ocac",["الفئة","الرصيد"],Object.entries(byCat).sort((a,c)=>c[1]-a[1]).map(([c,v])=>[c,this.fsC(v)])
          .concat([{bold:true,cells:["الإجمالي",this.fsC(oca.reduce((a,x)=>a+x.amount,0))]}])),{k:"fw6"}),
      this.card("تفصيل الأصول المتداولة الأخرى — "+this.fsDate(od),
        this.fsTable("ocad",["الفئة","البند / الشخص","الرصيد"],
          oca.slice().sort((a,c)=>a.category<c.category?-1:a.category>c.category?1:c.amount-a.amount)
            .map(x=>[x.category,x.name,this.fsC(x.amount)])),
        {k:"fw7",sub:oca.length+" بند · سُلف · عُهد · محافظ إلكترونية — السالب بالأحمر"})];
  }

  /* ---- القسم: المطابقة وجودة القوائم ---------------------------------------- */
  fsQuality(F,T){
    const C=this.state.C, ms=F.meta.income_months;
    const flags=(F.quality_flags||[]).map(q=>({severity:q.severity,title:q.title,lines:[
      ["التفصيل",q.detail],["الإجراء",q.action],
      ["الفرق",q.gap!=null?T.egp(q.gap):null],["المفسَّر",q.explained!=null?T.egp(q.explained):null],
      ["غير المفسَّر",q.unexplained!=null?T.egp(q.unexplained):null],["الحركة",q.movement!=null?T.egp(q.movement):null]]}));
    const SM=(window.DASH_MARGIN&&window.DASH_MARGIN.statements&&window.DASH_MARGIN.statements.by_month)||[];
    const mp={}; SM.forEach(r=>{mp[r.period]=r;});
    let tm=0,tpre=0,tdep=0,tpost=0;
    const recRows=ms.map(m=>{const i=F.income[m]||{}, r=mp[m];
      const mv=r?r.net_profit:null; if(mv!=null) tm+=mv; tpre+=i.net_profit_pre_dep||0;
      tdep+=i.depreciation_booked||0; tpost+=i.net_profit_after_dep||0;
      return [this.fsMon(m),this.fsC(mv),this.fsC(i.net_profit_pre_dep),this.fsC(i.depreciation_booked),
        this.fsC(i.net_profit_after_dep),this.fsC(mv==null?null:mv-i.net_profit_after_dep)];});
    recRows.push({bold:true,cells:["الإجمالي",this.fsC(tm),this.fsC(tpre),this.fsC(tdep),this.fsC(tpost),this.fsC(tm-tpost)]});
    return [
      this.card("ملاحظات على ملف القوائم",this.fsNotes("fl",flags),{k:"fq1",sub:flags.length+" ملاحظة · تظهر كلها ولا تُخفى"}),
      this.chartCard("صافي المبيعات بالقوائم مقابل مبيعات الفواتير",this.fsReconChart(F),{k:"fq2"}),
      this.card("مطابقة المبيعات شهرًا بشهر",this.fsTable("rec",["الشهر","القوائم","الفواتير","الفرق","الفرق %","الحالة"],
        (F.sales_reconciliation||[]).map(r=>[this.fsMon(r.month),this.fsC(r.statement_net_sales),this.fsC(r.invoice_sales),
          this.fsC(r.diff),this.fsC(r.diff_pct,"pct"),
          r.ok==null?"—":{v:r.ok?"مطابق":"يحتاج تفسير",c:r.ok?"#86efac":"#fca5a5"}])),
        {k:"fq3",sub:"الحد المسموح ±"+T.pct((F.alert_thresholds||{}).sales_recon_pct_max||0.02,0)}),
      this.card("صافي الربح: قسم «الربحية» مقابل القوائم المالية",[
        React.createElement("div",{key:"n",style:{fontSize:11,lineHeight:1.85,color:"#bfdbfe",padding:"8px 10px",
            borderRadius:10,background:"rgba(42,120,214,.09)",border:"1px solid rgba(42,120,214,.26)"}},
          "قسم «الربحية» في هذا التطبيق يسمّي صافي الربح قبل الإهلاك «صافي الربح» — لم يُعدَّل أي رقم فيه. "
          +"القوائم المالية تُحمّل إهلاك سنة 2025 كاملًا على ديسمبر، فالفرق بين الرقمين = الإهلاك المحمّل."),
        this.fsTable("mrec",["الشهر","«الربحية» (قبل الإهلاك)","القوائم قبل الإهلاك","الإهلاك المحمّل",
          "القوائم بعد الإهلاك","الفرق"],recRows)],
        {k:"fq4",sub:SM.length?"window.DASH_MARGIN ↔ window.DASH_FS":"قسم الربحية غير محمّل"}),
      this.card("بيانات مطلوبة من الإدارة",React.createElement("ul",{style:{margin:0,paddingInlineStart:18,
          fontSize:11.5,lineHeight:2,color:"#cbd5e1"}},
        ["موازنة 2026 الشهرية ← الفعلي مقابل الموازنة","قوائم دخل يناير 2026 وما بعده ← الملخص التنفيذي لعام 2026",
         "استكمال ميزانية 28/2/2026 أو حذفها","أرصدة البنوك والخزينة أسبوعيًا ← توقع نقدي 13 أسبوعًا",
         "جدول سداد قرضي المبادرة والسيارة وقروض الشركاء",
         "سجل الإنتاج (داخل/خارج/عظام/فاقد) ← تكلفة الكيلو المنتج والعائد"]
          .map((s,i)=>React.createElement("li",{key:i},s))),{k:"fq5"}),
      this.card("قاموس المؤشرات",this.fsTable("dict",["المؤشر","المعادلة","المصدر","الفترة"],
        (F.kpi_dictionary||[]).map(d=>[d.kpi,d.formula,d.source,d.period]),{firstW:96}),
        {k:"fq6",sub:"المعادلة والمصدر والفترة لكل مؤشر في الشاشات المالية"}),
      this.card("أعمدة مستبعدة من الملف",React.createElement("div",{style:{fontSize:11,lineHeight:1.9,color:"#94a3b8"}},
        (F.meta.excluded_columns_note||"")+((F.meta.dropped_dates||[]).length?" — "+F.meta.dropped_dates.map(d=>this.fsDate(d)).join("، "):"")),
        {k:"fq7"})];
  }

  /* ---- غلاف أقسام القوائم المالية (على نمط buildRepo) ---------------------- */
  buildFs(){
    const st=this.state, F=window.DASH_FS, T=st.T;
    const cur=this.entry()||{h2:"",p:"",label:""};
    const s=this.sec();
    const navEl=this.unifiedNav();
    const ms=F.meta.income_months;
    const span=this.fsMon(ms[0])+" – "+this.fsMon(ms[ms.length-1]);
    const chip=s==="fs_position"?"في "+this.fsDate(F.meta.balance_sheet_dates.includes(st.fsBs)?st.fsBs:F.meta.as_of)
      : s==="fs_wc"?"في "+this.fsDate(F.meta.as_of)
      : s==="fs_quality"?"كل الفترات"
      : span;
    const chipsEl=React.createElement("div",{style:{flex:"none",position:"relative",display:"flex",alignItems:"center",
        gap:6,padding:"8px 13px",overflowX:"auto",borderBottom:"1px solid rgba(255,255,255,.06)"}},
      React.createElement("span",{key:"h2",style:{fontSize:12,fontWeight:700,color:"#e2e8f0",flex:"none",whiteSpace:"nowrap"}},cur.h2),
      React.createElement("span",{key:"p",style:{flex:"none",fontSize:10.5,padding:"4px 9px",borderRadius:99,
        background:"rgba(16,185,129,.14)",border:"1px solid rgba(16,185,129,.3)",color:"#6ee7b7",whiteSpace:"nowrap"}},chip));
    const srcEl=React.createElement("div",{style:{flex:"none",position:"relative",background:"rgba(13,18,32,.75)",
        borderBottom:"1px solid rgba(255,255,255,.06)",padding:"7px 11px",display:"flex",flexDirection:"column",gap:6}},
      React.createElement("div",{key:"r",style:{display:"flex",gap:6,alignItems:"center"}},
        React.createElement("span",{style:{flex:"none",padding:"5px 9px",borderRadius:8,fontSize:10,whiteSpace:"nowrap",
          fontWeight:700,background:"rgba(16,185,129,.14)",border:"1px solid rgba(16,185,129,.34)",color:"#6ee7b7"}},"القوائم المالية"),
        React.createElement("span",{style:{flex:1,minWidth:0,fontSize:11,fontWeight:700,color:"#93c5fd",overflow:"hidden",
          whiteSpace:"nowrap",textOverflow:"ellipsis"}},"ميزانيات "+F.meta.balance_sheet_dates.map(d=>this.fsDate(d)).join(" · "))),
      React.createElement("div",{key:"m",style:{fontSize:9.5,color:"#64748b",lineHeight:1.6}},
        "هذا القسم من القوائم المالية (window.DASH_FS) · قوائم دخل "+span+" · لا تنطبق عليه فلاتر الفواتير"));
    let body;
    if(s==="fs_position") body=this.fsPosition(F,T);
    else if(s==="fs_income") body=this.fsIncome(F,T);
    else if(s==="fs_wc") body=this.fsWc(F,T);
    else if(s==="fs_quality") body=this.fsQuality(F,T);
    else body=this.fsExec(F,T);
    body=[React.createElement("div",{key:"sub",style:{fontSize:11,color:"#64748b",lineHeight:1.7}},cur.p)].concat(body.filter(Boolean));

    const wrap=inner=>React.createElement("div",{onClick:()=>this.setState({sheet:null}),style:{position:"absolute",inset:0,
        zIndex:9,background:"rgba(3,6,14,.7)",display:"flex",alignItems:"flex-end"}},
      React.createElement("div",{onClick:e=>e.stopPropagation(),style:{width:"100%",maxHeight:"78%",overflow:"auto",
          background:"#111827",borderTop:"1px solid rgba(255,255,255,.10)",borderRadius:"22px 22px 0 0",
          padding:"14px 14px 26px",display:"flex",flexDirection:"column",gap:9}},
        [React.createElement("div",{key:"g",style:{width:38,height:4,borderRadius:99,background:"rgba(255,255,255,.2)",
          margin:"0 auto 6px"}})].concat(inner)));
    let sheetEl=null;
    if(st.sheet==="export") sheetEl=this.exportSheet();
    else if(st.sheet==="nav") sheetEl=wrap(this.navSheet());
    else if(st.sheet&&st.sheet.cols) sheetEl=wrap([React.createElement("div",{key:"d",style:{display:"flex",flexDirection:"column"}},
      st.sheet.cols.map((c,i)=>React.createElement("div",{key:i,style:{display:"flex",justifyContent:"space-between",gap:12,
          padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,.06)",fontSize:12}},
        React.createElement("span",{style:{color:"#64748b"}},c[0]),
        React.createElement("b",{style:{color:"#e2e8f0",fontFamily:"'JetBrains Mono',monospace"}},String(c[1](st.sheet.r)??"—")))))]);
    const statusEl=React.createElement("div",null,
      React.createElement("b",{style:{color:"#10b981"}},"window.DASH_FS متصل"),
      React.createElement("div",{style:{marginTop:6,lineHeight:1.9}},"as_of: "+F.meta.as_of+" · أشهر الدخل: "+ms.length));
    const sectionListEl=React.createElement("div",{dir:"rtl",style:{display:"flex",flexDirection:"column",gap:8}},this.navSheet());
    return {bodyEl:body, navEl, chipsEl, filterBarEl:null, srcEl, filterBtnEl:null,
            exportBtnEl:this.exportBtn(), sheetEl, statusEl, sectionListEl};
  }

  /* ---- إضافات على أقسام الفواتير -------------------------------------------- */

  /* في نهاية «لوحة المعلومات»: التحليل العام المكتوب للفترة (كان يُشحن ولا يُعرض)،
     ثم مؤشرات القوائم المالية كما في شريط اللوحة التنفيذية. */
  ovExtras(X,T,api){
    const out=[], ins=this.insightPanel("overview");
    if(ins) out.push(this.card("القراءة العامة للفترة",ins,{k:"ovx1"}));
    const F=window.DASH_FS;
    if(F) out.push(this.card("من القوائم المالية — "+this.fsMon(F.meta.income_months[F.meta.income_months.length-1]),
      [this.kpiTiles(this.fsKpiRows(F),"ovfs"),
       React.createElement("span",{key:"go",onClick:()=>this.go("fs_exec"),style:{alignSelf:"flex-start",fontSize:11,
         padding:"6px 11px",borderRadius:9,cursor:"pointer",background:"rgba(16,185,129,.14)",
         border:"1px solid rgba(16,185,129,.34)",color:"#6ee7b7"}},"التفاصيل في «القوائم المالية» ‹")],
      {k:"ovx2",sub:"قوائم 2025 — فترة مختلفة عن فواتير 2026"}));
    return out;
  }

  /* «المستحق» على لقطة لا تحمل قائمة الفواتير المستحقة (لقطة 16/7 من اللوحة
     التنفيذية): غياب القائمة ليس «لا متأخرات»، فتُعرض متأخرات أرصدة العملاء. */
  overdueFromBalances(T,api){
    const D=api.D, f=this.state.filters, R=D.receivables||{}, C=this.state.C;
    const cohort=this.agingCohort(D,f);
    const rows=(R.rows||[]).filter(r=>(r.overdue||0)>0&&(!cohort||cohort.has(String(r.customer_code))))
      .sort((a,b)=>(b.overdue||0)-(a.overdue||0));
    const tot=rows.reduce((a,r)=>a+(r.overdue||0),0), labels=R.bucket_labels||{};
    const bars=T.AGING_KEYS.filter(k=>k!=="current").map(k=>[labels[k]||k,(R.buckets||{})[k]||0,T.AGING_COLORS[k]]);
    return [
      React.createElement("div",{key:"odn",style:{padding:"10px 12px",borderRadius:12,background:"rgba(237,161,0,.10)",
          border:"1px solid rgba(237,161,0,.30)",fontSize:11,lineHeight:1.8,color:"#fcd34d"}},
        "هذه اللقطة لا تحتوي تفصيل الفواتير المستحقة؛ إجمالي المتأخر حسب أرصدة العملاء = "
        +T.egp(cohort?tot:(R.total_overdue!=null?R.total_overdue:tot))+"."),
      this.kpiTiles([["المتأخر حسب الأرصدة",T.egpK(cohort?tot:R.total_overdue),"لقطة "+this.ltr(R.as_of||D.meta.as_of),"#ef4444"],
        ["عملاء عليهم متأخرات",String(rows.length),cohort?"في هذا التقسيم":"من "+(R.rows||[]).length+" عميل","#f97316"],
        ["الجاري",T.egpK(R.total_current),"لم يحن استحقاقه","#10b981"],
        ["إجمالي المديونية",T.egpK(R.total_outstanding),R.total_credit?"أرصدة دائنة "+T.egpK(R.total_credit):"","#3b82f6"]],"odk"),
      this.card("المتأخر حسب الفئة (الشركة)",this.barsH(bars,T.egpK),{k:"odb",approx:true}),
      this.card("العملاء المتأخرون",this.pagedList("odr",rows,[["العميل",r=>r.customer_name],["متأخر",r=>T.num(r.overdue)],
        ["أيام التأخر",r=>r.days_overdue],["المندوب",r=>r.rep],["الرصيد",r=>T.num(r.outstanding)],["جاري",r=>T.num(r.current)]],
        r=>this.setState({stmt:r.customer_code})),{k:"odl",sub:rows.length+" عميل · اضغط لكشف الحساب"})];
  }

  /* «تفاصيل اللقطة»: كل حقل في data.js لم يكن أي قسم يعرضه — على اللقطة
     النشطة، أيًّا كانت (3/9 أو 16/7). */
  snapDetailBody(X,T,api){
    const st=this.state, D=api.D, f=st.filters, meta=D.meta||{}, Co=D.collections||{}, R=D.receivables||{};
    const dq=D.data_quality||{}, A2=Co.attribution||{}, sn=(st.snaps||[]).find(x=>x.key===st.snap);
    const mk=(f.month&&f.month!=="all")?f.month:"all";
    const insKeys=Object.keys(((D.insights_by_month||{})[mk])||{});
    const kv=(k,rows)=>this.fsTable(k,["البند","القيمة"],rows.filter(r=>r[1]!==undefined));
    const out=[
      this.card("بيانات اللقطة",kv("meta",[
        ["اللقطة",sn?sn.label:"—"],["ملاحظة اللقطة",sn&&sn.note?sn.note:"—"],
        ["الفترة",meta.period_label],["تاريخ الأرصدة",meta.as_of],["تاريخ اللقطة",meta.snapshot_date],
        ["وقت الاستخراج",meta.generated_utc],["أشهر البيانات",(meta.data_months||[]).join("، ")],
        ["مدة السداد (يوم)",meta.net_terms_days],["حد الاستحقاق",meta.overdue_cutoff],
        ["عدد البنود / الفواتير",T.int((D.lines||[]).length)+" / "+T.int((D.invoices||[]).length)]]),{k:"sd1"}),
      this.card("سلّم الحافز كما في البيانات (bonus_rules)",this.fsTable("br",["معدل التحصيل حتى","نسبة الحافز"],
        (meta.bonus_rules||[]).map(r=>[T.pct(r[0],0),T.pct(r[1],0)])),{k:"sd2"}),
      this.card("كل التحليلات المكتوبة — "+(mk==="all"?"جميع الشهور":this.fsMon(mk)),
        insKeys.length?insKeys.map(k=>React.createElement("div",{key:k},this.insightPanel(k))):this.empty("لا توجد تحليلات"),
        {k:"sd3",sub:insKeys.length+" تحليل · اضغط للفتح"}),
      this.card("جودة البيانات — التفصيل",[
        kv("dq",[["بنود الفواتير",T.int(dq.n_line_items)],["الفواتير",T.int(dq.n_invoices)],
          ["مطابقة ناجحة",T.int(dq.reconciliation_pass)],["مطابقة فاشلة",T.int(dq.reconciliation_fail)],
          ["نسبة المطابقة",T.pct(dq.reconciliation_rate)],["قيم مفقودة",T.int(dq.missing_total)],
          ["فواتير مكررة",T.int(dq.duplicate_invoice_count)],["فواتير صفرية",T.int(dq.zero_value_invoice_count)],
          ["قيم سالبة",T.int(dq.negative_value_count)],["أسعار شاذة",T.int(dq.abnormal_price_count)],
          ["كميات شاذة",T.int(dq.abnormal_qty_count)]]),
        this.fsTable("mv",["الحقل","القيم المفقودة"],Object.entries(dq.missing_values||{}).map(([k,v])=>[k,T.int(v)])),
        (dq.duplicate_invoices||[]).length?this.fsTable("dup",["فواتير مكررة"],dq.duplicate_invoices.map(x=>[typeof x==="object"?JSON.stringify(x):String(x)])):null],
        {k:"sd4"}),
      this.card("التحصيل — الإجماليات والفترة",kv("ct",[
        ["إجمالي التحصيل",T.egp(Co.grand_total_collected)],["إجمالي التحصيل كما طُبع في المصدر",T.egp(Co.printed_total_collected)],
        ["إجمالي المرتجعات",T.egp(Co.grand_total_returns)],["إجمالي المرتجعات كما طُبع في المصدر",T.egp(Co.printed_total_returns)],
        ["فترة التحصيلات",(Co.period||{}).collections],["فترة المرتجعات",(Co.period||{}).returns],
        ["المُفوتر 2026",T.egp(Co.billed_2026)],
        ["المديونية القائمة",T.egp(Co.outstanding_as_of!=null?Co.outstanding_as_of:Co.outstanding_1607)]]),{k:"sd5"}),
      this.card("مطابقة السدادات والمرتجعات بالعملاء",kv("att",[
        ["سدادات",T.int(A2.receipts_total)],["مطابَقة",T.int(A2.receipts_matched)],["غير مطابَقة",T.int(A2.receipts_unmatched)],
        ["قيمة غير المطابَق",T.egp(A2.unmatched_collected)],["مرتجعات",T.int(A2.returns_total)],
        ["مرتجعات مطابَقة",T.int(A2.returns_matched)],["مرتجعات غير مطابَقة",T.int(A2.returns_unmatched)],
        ["قيمة المرتجعات غير المطابَقة",T.egp(A2.unmatched_returns)],["تسمية غير المطابَق",A2.unmatched_label]]),{k:"sd6"}),
      this.card("التحصيل الشهري",this.fsTable("cm",["الشهر","التحصيل","عدد السدادات","المرتجعات","عدد المرتجعات"],
        (Co.monthly||[]).map(r=>[this.fsMon(r.month),this.fsC(r.collected),T.int(r.n_receipts),this.fsC(r.returns),T.int(r.n_returns)])),{k:"sd7"}),
      this.card("التحصيل حسب طريقة الدفع",this.fsTable("cmeth",["الطريقة","المبلغ","العدد"],
        (Co.by_method||[]).map(r=>[r.method,this.fsC(r.amount),T.int(r.count)])),{k:"sd8"}),
      this.card("التحصيل حسب المندوب",this.fsTable("crep",["المندوب","التحصيل","المرتجعات","العملاء"],
        (Co.by_rep||[]).map(r=>[r.rep,this.fsC(r.collected),this.fsC(r.returns),T.int(r.customers)])),{k:"sd9"}),
      this.card("التحصيل حسب العميل",this.pagedList("sdc",Co.by_customer||[],[["العميل",r=>r.customer_name],
        ["التحصيل",r=>T.num(r.collected)],["المرتجعات",r=>T.num(r.returns)],["المندوب",r=>r.rep],["الكود",r=>r.customer_code]],
        r=>this.setState({stmt:r.customer_code})),{k:"sd10",sub:(Co.by_customer||[]).length+" عميل · اضغط لكشف الحساب"}),
      this.card("المديونية حسب المندوب (من اللقطة)",this.fsTable("rrep",["المندوب","جاري","متأخر","الرصيد","العملاء"],
        (R.by_rep||[]).map(r=>[r.rep,this.fsC(r.current),this.fsC(r.overdue),this.fsC(r.outstanding),T.int(r.customers)])),{k:"sd11"}),
      this.card("ملخص المديونية والأرصدة الدائنة",kv("rs",[
        ["تاريخ الأرصدة",R.as_of],["إجمالي المديونية",T.egp(R.total_outstanding)],["جاري",T.egp(R.total_current)],
        ["متأخر",T.egp(R.total_overdue)],["متأخر على فواتير",R.overdue_on_invoices!=null?T.egp(R.overdue_on_invoices):undefined],
        ["رصيد أول المدة",R.opening_balance!=null?T.egp(R.opening_balance):undefined],
        ["فواتير مستحقة",R.overdue_invoice_count!=null?T.int(R.overdue_invoice_count):undefined],
        ["عملاء عليهم مستحقات",R.overdue_customers!=null?T.int(R.overdue_customers):undefined],
        ["أرصدة دائنة",T.egp(R.total_credit)],["عملاء بأرصدة دائنة",R.credit_customers!=null?T.int(R.credit_customers):undefined],
        ["الصافي بعد الأرصدة الدائنة",R.net_of_credit!=null?T.egp(R.net_of_credit):undefined]]),{k:"sd12"}),
      (R.credit_rows||[]).length?this.card("العملاء بأرصدة دائنة",this.pagedList("sdcr",R.credit_rows,[["العميل",r=>r.customer_name],
        ["الرصيد الدائن",r=>T.num(r.credit_balance)],["المندوب",r=>r.rep],["الكود",r=>r.customer_code]],
        r=>this.setState({stmt:r.customer_code})),{k:"sd13",sub:R.credit_rows.length+" عميل"}):null,
      this.card("عملاء بلا مندوب رسمي (rep_exceptions)",this.pagedList("sdre",D.rep_exceptions||[],[["العميل",r=>r.customer_name||"—"],
        ["الكود",r=>r.customer_code],["السبب",r=>r.reason]]),{k:"sd14",sub:(D.rep_exceptions||[]).length+" عميل"})];
    return out.filter(Boolean);
  }

  /* جداول إضافية لكتالوج التصدير و«التقارير»: القوائم المالية، وجداول اللقطة
     التي كانت تُعرض على الشاشة ولا تُصدَّر. */
  exportExtras(out,col,num){
    const st=this.state, T=st.T;
    if(st.api){
      const D=st.api.D, X=st.api.buildContext(st.filters||{}), Co=D.collections||{}, R=D.receivables||{};
      out.push(
        {id:"s_customers", label:"ترتيب العملاء — الفواتير", rows:X.customers||[], columns:[
          col("#",null,r=>num(r.rank)), col("كود العميل","customer_code"), col("العميل","customer_name"), col("المندوب","rep"),
          col("المبيعات",null,r=>num(r.sales)), col("الفواتير",null,r=>num(r.n_invoices)), col("الأصناف",null,r=>num(r.n_items)),
          col("الكراتين",null,r=>num(r.boxes)), col("متوسط الفاتورة",null,r=>num(r.avg_invoice_value)),
          col("المديونية",null,r=>num(r.outstanding)), col("معدل التحصيل",null,r=>num(r.collection_rate)),
          col("الحافز %",null,r=>num(r.bonus_pct)), col("قيمة الحافز",null,r=>num(r.bonus_value)),
          col("أقدم فاتورة","oldest_invoice_no"), col("أيام التأخر",null,r=>num(r.oldest_days_overdue))]},
        {id:"s_products", label:"أداء المنتجات — الفواتير", rows:X.products||[], columns:[
          col("#",null,r=>num(r.rank)), col("كود الصنف","item_code"), col("الصنف","item_name"), col("العلامة","brand"),
          col("المبيعات",null,r=>num(r.sales)), col("المساهمة %",null,r=>num(r.contribution_pct)),
          col("الكمية",null,r=>num(r.qty)), col("الكراتين",null,r=>num(r.boxes)), col("متوسط السعر",null,r=>num(r.asp)),
          col("أعلى سعر",null,r=>num(r.max_price)), col("أدنى سعر",null,r=>num(r.min_price)),
          col("العملاء",null,r=>num(r.n_customers))]},
        {id:"s_bonus", label:"تقرير الحوافز — الفواتير", rows:(X.customers||[]).filter(c=>c.has_ar), columns:[
          col("كود العميل","customer_code"), col("العميل","customer_name"), col("المندوب","rep"),
          col("قيمة الحافز",null,r=>num(r.bonus_value)), col("الحافز %",null,r=>num(r.bonus_pct)),
          col("معدل التحصيل",null,r=>num(r.collection_rate)), col("مبيعات الفترة",null,r=>num(r.sales)),
          col("إجمالي مُفوتر",null,r=>num(r.total_billed)), col("المديونية",null,r=>num(r.outstanding))]},
        {id:"s_zero", label:"الفواتير صفرية القيمة", rows:D.zero_invoices||[], columns:[
          col("الفاتورة","invoice_no"), col("التاريخ","invoice_date"), col("كود العميل","customer_code"),
          col("العميل","customer_name"), col("الكمية",null,r=>num(r.qty_total)), col("بونص",null,r=>r.is_bonus?"نعم":"لا")]},
        {id:"s_rep_exc", label:"عملاء بلا مندوب رسمي", rows:D.rep_exceptions||[], columns:[
          col("كود العميل","customer_code"), col("العميل","customer_name"), col("السبب","reason")]},
        {id:"s_credit", label:"العملاء بأرصدة دائنة", rows:R.credit_rows||[], columns:[
          col("كود العميل","customer_code"), col("العميل","customer_name"), col("المندوب","rep"),
          col("الرصيد الدائن",null,r=>num(r.credit_balance))]},
        {id:"s_recv_rep", label:"المديونية حسب المندوب", rows:R.by_rep||[], columns:[
          col("المندوب","rep"), col("جاري",null,r=>num(r.current)), col("متأخر",null,r=>num(r.overdue)),
          col("الرصيد",null,r=>num(r.outstanding)), col("العملاء",null,r=>num(r.customers))]},
        {id:"s_coll_month", label:"التحصيل الشهري", rows:Co.monthly||[], columns:[
          col("الشهر","month"), col("التحصيل",null,r=>num(r.collected)), col("عدد السدادات",null,r=>num(r.n_receipts)),
          col("المرتجعات",null,r=>num(r.returns)), col("عدد المرتجعات",null,r=>num(r.n_returns))]},
        {id:"s_coll_method", label:"التحصيل حسب طريقة الدفع", rows:Co.by_method||[], columns:[
          col("الطريقة","method"), col("المبلغ",null,r=>num(r.amount)), col("العدد",null,r=>num(r.count))]},
        {id:"s_coll_rep", label:"التحصيل حسب المندوب", rows:Co.by_rep||[], columns:[
          col("المندوب","rep"), col("التحصيل",null,r=>num(r.collected)), col("المرتجعات",null,r=>num(r.returns)),
          col("العملاء",null,r=>num(r.customers))]},
        {id:"s_coll_cust", label:"التحصيل حسب العميل", rows:Co.by_customer||[], columns:[
          col("كود العميل","customer_code"), col("العميل","customer_name"), col("المندوب","rep"),
          col("التحصيل",null,r=>num(r.collected)), col("المرتجعات",null,r=>num(r.returns))]});
    }
    const F=window.DASH_FS;
    if(F){
      const ds=F.meta.balance_sheet_dates, B=F.balance_sheets, ms=F.meta.income_months, I=F.income;
      const keys=[...new Set(ds.flatMap(d=>Object.keys(B[d])))];
      const PL=["net_sales","cogs","gross_profit","gross_margin","admin","admin_pct","selling","selling_pct","ebitda",
        "ebitda_margin","finance","other_items","net_profit_pre_dep","depreciation_booked","net_profit_after_dep",
        "depreciation_allocated_est","net_profit_dep_allocated_est"];
      const CFK=["net_income","depreciation","change_receivables","change_inventory","change_other_current_assets",
        "change_payables","change_accrued","cfo","capex","cfi","debt_change","equity_other_movements","cff","net_change",
        "actual_change_cash_deposits","check_diff"];
      const odates=Object.keys(F.other_current_assets||{}).sort();
      const pop=F.income_pop_sheet||{}, pms=Object.keys(pop).sort();
      const popK=[...new Set(pms.flatMap(m=>Object.keys(pop[m])))];
      const SM=(window.DASH_MARGIN&&window.DASH_MARGIN.statements&&window.DASH_MARGIN.statements.by_month)||[];
      out.push(
        {id:"fs_bs", label:"القوائم — الميزانية المقارنة", rows:keys.map(k=>({k,label:this.fsLabel(F,k),...Object.fromEntries(ds.map(d=>[d,B[d][k]]))})),
         columns:[col("البند","label"), col("المفتاح","k")].concat(ds.map(d=>col(d,null,r=>num(r[d]))))},
        {id:"fs_pl", label:"القوائم — قائمة الدخل الشهرية", rows:PL.map(k=>({k,...Object.fromEntries(ms.map(m=>[m,I[m][k]]))})),
         columns:[col("البند","k")].concat(ms.map(m=>col(m,null,r=>num(r[m]))))},
        {id:"fs_exp", label:"القوائم — بنود المصروفات", rows:ms.flatMap(m=>Object.entries(I[m].expense_items||{})
            .flatMap(([sec,arr])=>(arr||[]).map(x=>({month:m,sec,name:x.name,amount:x.amount})))),
         columns:[col("الشهر","month"), col("القسم","sec"), col("البند","name"), col("القيمة",null,r=>num(r.amount))]},
        {id:"fs_pop", label:"القوائم — قائمة الدخل كما بملف pop", rows:popK.map(k=>({k,...Object.fromEntries(pms.map(m=>[m,pop[m][k]]))})),
         columns:[col("البند","k")].concat(pms.map(m=>col(m,null,r=>num(r[m]))))},
        {id:"fs_cf", label:"القوائم — التدفق النقدي المحسوب", rows:CFK.map(k=>({k,...Object.fromEntries(F.cash_flows.map((c,i)=>["p"+i,c[k]]))})),
         columns:[col("البند","k")].concat(F.cash_flows.map((c,i)=>col(c.from+" → "+c.to,null,r=>num(r["p"+i]))))},
        {id:"fs_wc", label:"القوائم — رأس المال العامل", rows:Object.entries(F.working_capital||{}).map(([k,v])=>({k,v:Array.isArray(v)?v.join(", "):v})),
         columns:[col("البند","k"), col("القيمة","v")]},
        {id:"fs_loans", label:"القوائم — القروض", rows:F.loans||[],
         columns:[col("القرض","name"), col("النوع","kind")].concat(ds.map(d=>col(d,null,r=>num((r.balances||{})[d]))))},
        {id:"fs_oca", label:"القوائم — الأصول المتداولة الأخرى (كل التواريخ)",
         rows:odates.flatMap(d=>(F.other_current_assets[d]||[]).map(x=>({date:d,...x}))),
         columns:[col("التاريخ","date"), col("الفئة","category"), col("البند / الشخص","name"), col("الرصيد",null,r=>num(r.amount))]},
        {id:"fs_recon", label:"القوائم — مطابقة المبيعات مع الفواتير", rows:F.sales_reconciliation||[],
         columns:[col("الشهر","month"), col("القوائم",null,r=>num(r.statement_net_sales)), col("الفواتير",null,r=>num(r.invoice_sales)),
           col("الفرق",null,r=>num(r.diff)), col("الفرق %",null,r=>num(r.diff_pct)), col("مطابق",null,r=>r.ok==null?"":r.ok?"نعم":"لا")]},
        {id:"fs_np_recon", label:"القوائم — صافي الربح: الربحية مقابل القوائم",
         rows:ms.map(m=>{const r=SM.find(x=>x.period===m)||{}, i=I[m];
           return {month:m,margin:r.net_profit,pre:i.net_profit_pre_dep,dep:i.depreciation_booked,post:i.net_profit_after_dep};}),
         columns:[col("الشهر","month"), col("الربحية (قبل الإهلاك)",null,r=>num(r.margin)), col("القوائم قبل الإهلاك",null,r=>num(r.pre)),
           col("الإهلاك المحمّل",null,r=>num(r.dep)), col("القوائم بعد الإهلاك",null,r=>num(r.post)),
           col("الفرق",null,r=>r.margin==null?null:num(r.margin-r.post))]},
        {id:"fs_flags", label:"القوائم — ملاحظات الجودة", rows:F.quality_flags||[],
         columns:[col("المعرّف","id"), col("الأولوية","severity"), col("العنوان","title"), col("التفصيل","detail"),
           col("الإجراء","action"), col("الفرق",null,r=>num(r.gap)), col("المفسَّر",null,r=>num(r.explained)),
           col("غير المفسَّر",null,r=>num(r.unexplained)), col("الحركة",null,r=>num(r.movement))]},
        {id:"fs_alerts", label:"القوائم — التنبيهات", rows:F.alerts||[],
         columns:[col("الشهر","month"), col("النوع","kind"), col("الأولوية","severity"), col("المشكلة","problem"),
           col("القيمة",null,r=>num(r.value)), col("المسؤول","owner"), col("الإجراء","action")]},
        {id:"fs_thresholds", label:"القوائم — حدود التنبيه", rows:Object.entries(F.alert_thresholds||{}).map(([k,v])=>({k,v})),
         columns:[col("القاعدة","k"), col("الحد",null,r=>num(r.v))]},
        {id:"fs_dict", label:"القوائم — قاموس المؤشرات", rows:F.kpi_dictionary||[],
         columns:[col("المؤشر","kpi"), col("المعادلة","formula"), col("المصدر","source"), col("الفترة","period")]});
    }
  }

