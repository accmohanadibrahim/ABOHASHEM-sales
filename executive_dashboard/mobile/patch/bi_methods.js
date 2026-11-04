  /* ==========================================================================
     المرحلة 4 (bi_mobile.py) — «ذكاء الأعمال»: إضافة فقط. الناتج
     (mobile/Abu_Hashem_Mobile_bi.html) هو الملف المعتمد (تأكيد الإدارة 26/10/2026)، وأساسه
     Abu_Hashem_Mobile_full.html لا يتغير: حذف هذه الإضافات يعيده بايتًا ببايت.

     لا بيانات جديدة: كل رقم هنا من البيانات المضمنة أصلًا (DASH_MARGIN للقوائم
     الشهرية وربحية الأصناف، DASH_OPS للمخزون والمشتريات، DASH_FS لتنبيهات 2025،
     ولقطة الفواتير والمديونية). وسوم الأساس هي وسوم المرحلة 3: «مُتحقَّق» من
     المصدر أو حساب مباشر منه، «تقدير» طريقة معلنة، «افتراض» قيمة أو تصنيف نختاره.
     ما لا تملك البيانات المضمنة أساسه يظهر «يحتاج بيانات» باسم الملف المطلوب، لا تقديرًا.

     كل قسم يُعرض داخل try/catch: خطأ في قسم يعرض رسالة مكانه ولا يوقف اللوحة.
     ========================================================================== */

  biSectionBody(s,X,T,api){
    const m={bi_exec:"biExecBody",bi_bridge:"biBridgeBody",bi_stock:"biStockBody",bi_std:"biStdBody",bi_alerts:"biAlertsBody",
      bi_kpis:"biKpisBody",bi_abm:"biAbmBody",bi_arh:"biArhBody",bi_recipes:"biRecipesBody",bi_map:"biMapBody",
      bi_cost:"biCostBody",bi_prod:"biProdBody"}[s];
    if(!m) return null;
    try{ return this[m](X,T,api); }
    catch(e){ return [this.advNote("bi-err","تعذّر عرض هذا القسم ("+String(e&&e.message||e)
      +"). باقي اللوحة يعمل كما هو؛ هذا القسم وحده معطّل حتى يُصلح.","warn")]; }
  }

  /* مفتاح التعطيل: ?nobi أو #nobi في الرابط يخفي كل إضافات ذكاء الأعمال. */
  biOn(){ return !/[?&#]nobi\b/.test(String(location.search)+String(location.hash)); }
  /* قوائم الدخل 2025 داخل قسم «قائمة الدخل» (القوائم المالية) — دمج القسمين بطلب الإدارة 27/10/2026. */
  biIs25InIncome(T,opt){
    if(!window.DASH_IS25||!this.biOn()) return [];
    let body;
    try{ body=this.biIs25Body(null,T,null,opt); }
    catch(e){ body=[this.advNote("bi25err","تعذّر عرض قوائم الدخل 2025 ("+String(e&&e.message||e)+"). باقي القسم يعمل كما هو.","warn")]; }
    return [React.createElement("div",{key:"bi25h","data-bi-is25":"1",style:{marginTop:8,paddingTop:10,
        borderTop:"1px solid var(--abh-rgba-255-255-255-14,rgba(255,255,255,.14))",fontSize:13,fontWeight:700,color:"var(--abh-e2e8f0,#e2e8f0)"}},
      "قوائم الدخل 2025 كاملة",React.createElement("span",{style:{fontSize:10.5,fontWeight:400,color:"#64748b",marginInlineStart:8}},
        (opt&&opt.noTable?"المؤشرات والملاحظات والمقارنة بنفس أشهر 2026 · الأرقام الشهرية في قائمة الدخل الموحدة أعلاه"
          :"12 شهرًا: يناير–مايو من نص القوائم · يونيو يحتاج بيانات · يوليو–ديسمبر المعتمدة · مقارنة بنفس أشهر 2026")))].concat(body);
  }

  /* قائمة الدخل الموحدة يناير 2025 – يوليو 2026 (طلب الإدارة 27/10/2026): تحل محل جداول
     «يوليو–ديسمبر 2025» و«2026» و«2025 الشهري» في قسم «قائمة الدخل»؛ باقي القسم كما هو.
     ?nobi (أو أي خطأ هنا) يعيد القسم الأصلي كما هو. */
  biPlOn(F){ return this.biOn()&&!!window.DASH_IS25&&!!window.DASH_IS26&&!!F&&!!F.income; }
  /* شارة الفترة أعلى القسم: من أول شهر في القائمة الموحدة إلى آخره. */
  biPlSpan(){
    try{ const c=this.biPl().cols; return this.fsMon(c[0].m)+" – "+this.fsMon(c[c.length-1].m); }
    catch(e){ return "يناير 2025 – يوليو 2026"; }
  }
  biIncomeMerged(body,F,T){
    if(!this.biPlOn(F)) return body;
    let card;
    try{ card=this.biPlCard(F,T); }
    catch(e){ return body.concat([this.advNote("biplerr","تعذّر عرض قائمة الدخل الموحدة ("+String(e&&e.message||e)+"). الجداول الأصلية معروضة كما هي.","warn")])
      .concat(this.biIs25InIncome(T)); }
    const i=body.findIndex(e=>e&&e.key==="fi1");
    const out=body.filter(e=>!(e&&(e.key==="fi1"||e.key==="fi26")));
    out.splice(i<0?0:i,0,card);
    return out.concat(this.biIs25InIncome(T,{noTable:true}));
  }
  /* عمود لكل شهر. القيمة رقم، أو null = البند غير مطبوع في قائمة الشهر («—»)، أو "adm" = ضمن الإدارية،
     أو "na" = لا ينطبق (لا يدخل الإجمالي). لا يُحسب بند لا تطبعه القائمة. */
  biPl(){
    const I=window.DASH_IS25, F=window.DASH_FS, cols=[], FI=F.income||{};
    const m25=new Map(I.months.map(r=>[r.month,r])), miss=new Map(I.missing.map(r=>[r.month,r]));
    for(let k=1;k<=12;k++){
      const m="2025-"+String(k).padStart(2,"0"), r=m25.get(m), h=FI[m];
      if(r){ const s=r.sections||{}, split=s.admin!=null;
        cols.push({m,year:"2025",tag:r.needs_confirmation?"يحتاج تأكيد":"نص PDF",warn:!!r.needs_confirmation,
          v:{net:r.net_sales,cogs:r.cogs,gp:r.gross_profit,op:split?"adm":null,admin:split?s.admin:null,selling:split?s.selling:null,
             lump:split?"na":r.expenses,ebitda:split?r.gross_profit-s.admin-s.selling:null,fin:null,other:null,
             np:r.net_profit,dep:null,npa:r.net_profit}}); }
      else if(h) cols.push({m,year:"2025",tag:"معتمدة",
          v:{net:h.net_sales,cogs:h.cogs,gp:h.gross_profit,op:"adm",admin:h.admin,selling:h.selling,lump:"na",ebitda:h.ebitda,
             fin:h.finance,other:h.other_items,np:h.net_profit_pre_dep,dep:h.depreciation_booked,npa:h.net_profit_after_dep}});
      else cols.push({m,year:"2025",need:(miss.get(m)||{}).reason||"لا قائمة دخل لهذا الشهر",tag:"لا قائمة",v:{}});
    }
    this.fs26Cols().forEach(c=>{ const p=c.p, S=p.sections, f=c.f, x=k=>S[k]==null?null:S[k]*f;
      const op=S.operating==null?"adm":S.operating*f, gp=p.gross_profit*f;
      cols.push({m:c.month,year:String(c.month).slice(0,4),est:c.est,tag:c.est?"تقدير":"كما صدرت",
        v:{net:p.net_sales*f,cogs:p.cogs*f,gp,op,admin:x("admin"),selling:x("selling"),lump:"na",
           ebitda:gp-(op==="adm"?0:op)-(S.admin||0)*f-(S.selling||0)*f,fin:x("financing"),other:null,
           np:p.net_profit*f,dep:null,npa:p.net_profit*f}}); });
    const ROWS=[["net","صافي المبيعات"],["cogs","تكلفة المبيعات"],["gp","مجمل الربح",1],["gpm","هامش مجمل الربح","pct"],
      ["op","مصروفات تشغيلية"],["admin","مصروفات إدارية وعمومية"],["selling","مصروفات بيعية وتسويقية"],["lump","مصروفات بلا تقسيم"],
      ["ebitda","EBITDA",1],["ebm","هامش EBITDA","pct"],["fin","تمويلية / فروق عملة"],["other","بنود أخرى"],
      ["np","صافي الربح قبل الإهلاك",1],["npm","هامش صافي الربح","pct"],["dep","الإهلاك المحمّل"],["npa","صافي الربح بعد الإهلاك (كما بالقوائم)",1]];
    const RATIO={gpm:["gp","net"],ebm:["ebitda","net"],npm:["np","net"]};
    const years=[...new Set(cols.map(c=>c.year))];
    const tot=years.map(y=>{ const cs=cols.filter(c=>c.year===y&&!c.need), t={}, part={};
      ["net","cogs","gp","op","admin","selling","lump","ebitda","fin","other","np","dep","npa"].forEach(k=>{
        let sum=0, n=0, gap=false, adm=0;
        cs.forEach(c=>{ const v=c.v[k]; if(typeof v==="number"){sum+=v;n++;} else if(v==="adm") adm++; else if(v!=="na") gap=true; });
        t[k]=n?sum:(adm?"adm":null); part[k]=n>0&&gap; });
      return {year:y,label:"إجمالي "+y,months:cs.length,of:cols.filter(c=>c.year===y).length,t,part}; });
    const val=(o,k)=>{ if(RATIO[k]){ const [a,b]=RATIO[k], x=o[a], z=o[b]; return typeof x==="number"&&typeof z==="number"&&z?x/z:null; } return o[k]; };
    const rows=ROWS.map(([k,label,kind])=>({k,label,bold:kind===1,pct:kind==="pct",
      vals:cols.map(c=>c.need?null:val(c.v,k)),
      /* نسبة على إجمالي جزئي تخلط شهورًا مختلفة، فلا تُعرض. */
      tots:tot.map(t=>{ const r=RATIO[k], part=r?(t.part[r[0]]||t.part[r[1]]):t.part[k];
        return {v:r&&part?null:val(t.t,k),part:r?false:part}; })}));
    return {cols,tot,rows};
  }
  biPlCard(F,T){
    const P=this.biPl(), MS=m=>this.fsMon(m).split(" ")[0];
    const bd="var(--abh-rgba-255-255-255-14,rgba(255,255,255,.14))", bg="var(--abh-111827,#111827)";
    const th={padding:"6px 8px",fontSize:10.5,fontWeight:700,color:"var(--abh-94a3b8,#94a3b8)",whiteSpace:"nowrap",textAlign:"center",
      background:bg,borderBottom:"1px solid "+bd};
    const td={padding:"6px 8px",fontSize:11,whiteSpace:"nowrap",textAlign:"end",fontFamily:"'JetBrains Mono',monospace",
      borderBottom:"1px solid var(--abh-rgba-255-255-255-05,rgba(255,255,255,.05))"};
    const stick={position:"sticky",insetInlineStart:0,zIndex:2,background:bg,textAlign:"start",minWidth:150,whiteSpace:"normal",
      fontFamily:"inherit",borderInlineEnd:"1px solid "+bd};
    const sep={borderInlineStart:"2px solid "+bd};
    const cellOf=(x,pct)=>x==="adm"?{v:"ضمن الإدارية",c:"var(--abh-64748b,#64748b)",t:1}:x==="na"?{v:"—"}:this.fsC(x,pct?"pct":undefined);
    /* ترتيب الأعمدة: أشهر 2025، إجمالي 2025، أشهر 2026، إجمالي 2026. */
    const seq=[]; P.tot.forEach((t,ti)=>{ P.cols.forEach((c,ci)=>{ if(c.year===t.year) seq.push({c,ci}); }); seq.push({t,ti}); });
    const h1=[React.createElement("th",{key:"b",style:{...th,...stick,zIndex:3}},"")].concat(P.tot.map((t,i)=>
      React.createElement("th",{key:"y"+t.year,colSpan:t.of+1,style:{...th,...sep,fontSize:12,color:"var(--abh-e2e8f0,#e2e8f0)",
        textAlign:"start",background:i%2?"var(--abh-rgba-16-185-129-10,rgba(16,185,129,.10))":"var(--abh-rgba-59-130-246-10,rgba(59,130,246,.10))"}},
        React.createElement("span",{style:{position:"sticky",insetInlineStart:160,padding:"0 6px"}},"سنة "+t.year))));
    const h2=[React.createElement("th",{key:"l",style:{...th,...stick,zIndex:3}},"البند")].concat(seq.map((x,j)=>{
      const first=j===0||(x.c&&seq[j-1].t);
      if(x.t) return React.createElement("th",{key:"t"+x.t.year,style:{...th,...sep,color:"var(--abh-e2e8f0,#e2e8f0)"}},x.t.label,
        React.createElement("div",{style:{fontSize:9,fontWeight:400,color:"#64748b"}},x.t.months+" شهرًا"+(x.t.months<x.t.of?" من "+x.t.of:"")));
      const c=x.c;
      return React.createElement("th",{key:"c"+c.m,style:{...th,...(first?sep:{})}},MS(c.m),
        React.createElement("div",{style:{fontSize:9,fontWeight:400,color:c.need?"#c4b5fd":c.warn?"#fcd34d":c.est?"#f59e0b":"#64748b"}},c.tag));
    }));
    const body=P.rows.map(r=>React.createElement("tr",{key:r.k,style:r.bold?{background:"var(--abh-rgba-255-255-255-035,rgba(255,255,255,.035))"}:null},
      [React.createElement("td",{key:"l",style:{...td,...stick,fontWeight:r.bold?800:r.pct?400:500,fontSize:r.pct?10.5:11,
        color:r.pct?"var(--abh-94a3b8,#94a3b8)":"var(--abh-e2e8f0,#e2e8f0)",background:r.bold?"var(--abh-1a2232,#1a2232)":bg}},r.label)]
      .concat(seq.map((x,j)=>{
        const first=j===0||(x.c&&seq[j-1].t);
        if(x.t){ const o=r.tots[x.ti], cv=cellOf(o.v,r.pct);
          return React.createElement("td",{key:"t"+x.t.year,style:{...td,...sep,fontWeight:800,color:cv.c||"var(--abh-e2e8f0,#e2e8f0)",
            background:"var(--abh-rgba-255-255-255-05,rgba(255,255,255,.05))"}},cv.v,o.part&&o.v!=null&&o.v!=="adm"?" *":""); }
        const c=x.c, v=r.vals[x.ci];
        if(c.need) return React.createElement("td",{key:"c"+c.m,style:{...td,...(first?sep:{}),background:"rgba(167,139,250,.06)",
          color:"#c4b5fd",fontFamily:"inherit",fontSize:10}},r.k==="net"?"يحتاج بيانات":"—");
        const cv=cellOf(v,r.pct);
        return React.createElement("td",{key:"c"+c.m,style:{...td,...(first?sep:{}),fontWeight:r.bold?800:400,
          fontStyle:c.est?"italic":null,fontSize:r.pct?10.5:11,fontFamily:cv.t?"inherit":td.fontFamily,
          color:cv.c||(r.pct?"var(--abh-94a3b8,#94a3b8)":"var(--abh-cbd5e1,#cbd5e1)"),
          background:c.est?"rgba(245,158,11,.05)":null}},cv.v);
      }))));
    const table=React.createElement("div",{key:"t","data-bi-pl":"1",style:{overflowX:"auto",maxWidth:"100%",borderRadius:10,border:"1px solid "+bd}},
      React.createElement("table",{style:{borderCollapse:"separate",borderSpacing:0,width:"100%"}},
        React.createElement("thead",null,React.createElement("tr",{key:"h1"},h1),React.createElement("tr",{key:"h2"},h2)),
        React.createElement("tbody",null,body)));
    const note=React.createElement("div",{key:"n",style:{fontSize:10.5,lineHeight:1.85,color:"var(--abh-94a3b8,#94a3b8)"}},
      "يناير–مايو 2025 من نص القوائم المرفوع (يحتاج مراجعة بالـPDF، ومارس مطابق لفبراير بالقرش — يحتاج تأكيد) · يونيو 2025 لا قائمة: يحتاج بيانات · "
      +"يوليو–ديسمبر 2025 من القوائم المعتمدة (إهلاك السنة محمّل في ديسمبر) · قائمة الربع الأول 2026 صدرت واحدة، وأعمدة يناير–مارس موزعة بأوزان المبيعات (تقدير) ومجموعها = القائمة · "
      +"أبريل–يوليو 2026 كما صدرت · «—» بند لا تطبعه قائمة الشهر، ولا يُحسب · «ضمن الإدارية» قبل فصل المصروفات التشغيلية (مايو 2026) · "
      +"قوائم يناير–مايو 2025 و2026 لا تطبع إهلاكًا، فالصافي كما بالقائمة · * إجمالي الشهور التي تطبع البند فقط.");
    return this.card("قائمة الدخل الشهرية — يناير 2025 إلى يوليو 2026",[table,note],
      {k:"bipl",sub:P.cols.filter(c=>!c.need).length+" شهرًا لها قائمة من "+P.cols.length+" · اسحب أفقيًا، وعمود البنود ثابت"});
  }

  /* ---- مساعدات ------------------------------------------------------------- */
  biNeed(k,what){
    return React.createElement("div",{key:k,"data-bi-need":k,style:{padding:"9px 11px",borderRadius:12,
        border:"1px dashed rgba(167,139,250,.45)",background:"rgba(167,139,250,.06)",fontSize:11,lineHeight:1.8,color:"#c4b5fd"}},
      React.createElement("b",null,"يحتاج بيانات: "),what);
  }
  biStatusTag(st){
    const c={"مُتحقَّق":"#10b981","تقدير":"#f59e0b","افتراض":"#a78bfa","يحتاج بيانات":"#64748b"}[st]||"#94a3b8";
    return this.advBadge(st,c);
  }
  biStmts(){ const M=window.DASH_MARGIN; return (M&&M.statements&&M.statements.by_month)||[]; }
  biStmt(m){ return this.biStmts().find(r=>r.period===m)||null; }
  biMeasured(r){ return !!r&&r.basis==="measured"&&!r.estimated; }
  biCats(){ return [["operating","مصروفات التشغيل"],["admin","المصروفات الإدارية"],["selling","المصروفات البيعية"],
    ["financing","المصروفات التمويلية"]]; }
  /* آخر شهرين لهما قائمة دخل مقيسة (لا موزعة من ربع سنة). */
  biLastTwo(){
    const ms=this.biStmts().filter(r=>this.biMeasured(r)).map(r=>r.period);
    return [ms[ms.length-2]||ms[0],ms[ms.length-1]];
  }
  biRef(){ return (window.DASH_BUILD||{}).built||null; }

  /* ======================= 1) الملخص التنفيذي وحداثة البيانات ============== */
  biFresh(D){
    const Bd=window.DASH_BUILD||{}, F=window.DASH_FS, st=this.state, cur=(st.snaps||[]).find(x=>x.key===st.snap);
    const S=this.biStmts(), last=S[S.length-1], ref=this.biRef();
    const lag=d=>d&&ref?this.advDays(d,ref):null;
    const pEnd=Bd.purchases_through?this.opsMonEnd(Bd.purchases_through):null;
    const rows=[
      {id:"sales",domain:"المبيعات والمديونية",as_of:cur&&cur.as_of||(D.receivables||{}).as_of||null,source:"لقطة الفواتير "+(st.snap||"")},
      {id:"inv",domain:"المخزون (تقييم وجرد)",as_of:Bd.inventory_as_of||null,source:"نموذج متوسط التكلفة — DASH_OPS"},
      {id:"pur",domain:"المشتريات",as_of:pEnd,source:"تقارير المشتريات الشهرية"},
      {id:"sup",domain:"أرصدة الموردين",as_of:Bd.suppliers_as_of||null,source:"كشف أرصدة الموردين"},
      {id:"pl",domain:"قوائم الدخل الشهرية",as_of:last?this.opsMonEnd(last.period):null,
        source:"قوائم الدخل "+(last?this.fsMon(last.period):"")+(last&&!this.biMeasured(last)?" (موزعة)":"")},
      {id:"bs",domain:"الميزانية العمومية",as_of:F&&F.meta&&F.meta.as_of||null,source:"القوائم المالية — DASH_FS"},
      {id:"bud",domain:"الموازنة",as_of:null,source:"data/budget/budget_2026.csv"}];
    rows.forEach(r=>{ r.lag=lag(r.as_of);
      r.status=r.as_of==null?"يحتاج بيانات":r.lag<=35?"حديثة":r.lag<=65?"متأخرة شهرًا":"قديمة"; });
    return {rows,ref};
  }
  biExecBody(X,T,api){
    const D=api.D, out=[], Fr=this.biFresh(D), [m0,m1]=this.biLastTwo(), a=this.biStmt(m0), b=this.biStmt(m1);
    const R=D.receivables||{}, vals=window.DASH_OPS?this.opsVals():[], iv=vals[vals.length-1];
    const Al=this.biAlertRows(X,D,this.state.filters||{},T).rows;
    out.push(this.opsLegend("bel"));
    this.biExecCards(this.biExecAnswers(D,T,Al)).forEach(c=>out.push(c));
    const dS=a&&b&&a.net_sales?(b.net_sales-a.net_sales)/Math.abs(a.net_sales):null;
    out.push(this.kpiTiles([
      b?["صافي المبيعات "+this.fsMon(m1),T.egpK(b.net_sales),dS==null?"":(dS>=0?"▲ ":"▼ ")+T.pct(Math.abs(dS))+" مقابل "+this.fsMon(m0),"#3b82f6"]
        :["صافي المبيعات","—","لا قائمة دخل مقيسة","#3b82f6"],
      b?["هامش مجمل الربح",T.pct(b.gross_profit/b.net_sales),a?"كان "+T.pct(a.gross_profit/a.net_sales):"","#10b981"]:["هامش مجمل الربح","—","","#10b981"],
      b?["صافي الربح "+this.fsMon(m1),T.egpK(b.net_profit),"هامش "+T.pct(b.net_profit/b.net_sales),"#06b6d4"]:["صافي الربح","—","","#06b6d4"],
      ["المديونية "+this.opsDmy(R.as_of),T.egpK(R.total_outstanding||0),
        "متأخر "+T.pct(R.total_outstanding?(R.total_overdue||0)/R.total_outstanding:0),"#8b5cf6"],
      iv?["المخزون "+this.opsDmy(iv.date),T.egpK(iv.total),"خامات "+T.egpK(iv.raw_value)+" · تام "+T.egpK(iv.fg_value),"#f59e0b"]
        :["المخزون","—","لا بيانات تشغيل","#f59e0b"],
      ["تنبيهات مفتوحة",T.int(Al.filter(r=>this.biAlertState(r.id).s!=="مغلق").length),
        T.int(Al.filter(r=>r.sev==="high").length)+" عالية الأولوية","#ef4444"]],"bek"));
    out.push(this.advNote("ben","القوائم والهامش «مُتحقَّق» للشهور المقيسة. يناير–مارس 2026 موزعة من قائمة الربع الأول بأوزان المبيعات فلا تُستعمل للمقارنة الشهرية. "
      +"المديونية من لقطة الفواتير والمخزون من نموذج متوسط التكلفة؛ لكل مجال تاريخه في الجدول التالي."));
    const fl={"حديثة":"#10b981","متأخرة شهرًا":"#f59e0b","قديمة":"#ef4444","يحتاج بيانات":"#64748b"};
    out.push(this.card("حداثة البيانات حسب المجال",this.fsTable("bef",["المجال","حتى تاريخ","الأيام حتى "+(Fr.ref||"—"),"الحالة","المصدر"],
      Fr.rows.map(r=>[r.domain,r.as_of?this.fsDate(r.as_of):"—",r.lag==null?"—":{v:r.lag+" يوم"},
        {v:r.status,c:fl[r.status]},r.source])),
      {k:"be1",sub:"الأيام محسوبة حتى تاريخ آخر تحديث لبيانات التشغيل، لا حتى تاريخ فتح الملف"}));
    if(a&&b){
      const Br=this.biPnlBridge(m0,m1), top=Br.steps.filter(s=>s.kind==="d").slice().sort((x,y)=>Math.abs(y.v)-Math.abs(x.v))[0];
      out.push(this.card("ما الذي حرّك صافي الربح "+this.fsMon(m0)+" ← "+this.fsMon(m1),[
        this.opsBars("beb",Br.steps.filter(s=>s.kind==="d").map(s=>({name:s.name,value:s.v,color:s.v>=0?"#10b981":"#ef4444"})),v=>this.fsC(v).v),
        React.createElement("div",{key:"bt",style:{fontSize:11.5,lineHeight:1.8,color:"#cbd5e1"}},
          "صافي الربح من "+T.egpK(Br.p0)+" إلى "+T.egpK(Br.p1)+" ("+(Br.p1-Br.p0>=0?"+":"−")+T.egpK(Math.abs(Br.p1-Br.p0))+"). أكبر عامل: "
          +top.name+" ("+this.fsC(top.v).v+"). التفصيل في «جسر الربح».")],{k:"be2"}));
    }
    const hi=Al.filter(r=>r.sev==="high").slice(0,4);
    if(hi.length) out.push(this.card("أعلى التنبيهات أولوية",this.fsTable("beh",["المؤشر","القيمة","الإجراء","المسؤول"],
      hi.map(r=>[r.kpi,r.value,r.action,r.owner])),{k:"be3"}));
    out.push(this.advLink("bego","سجل التنبيهات الكامل","bi_alerts"));
    return out;
  }

  /* ---- أسئلة الإدارة الخمسة (خطة تنظيم اللوحة، المرحلة 3) --------------------
     كل إجابة من البيانات المضمنة نفسها، ولكلٍّ قسم تفاصيلها. 1–3 من قوائم الدخل فلا تتبع فلاتر
     الفواتير؛ 4–5 من سجل التنبيهات فتتبعها كما يتبعها السجل. لا موازنة ⇒ «يحتاج بيانات» لا مستهدف بديل. */
  biExecAnswers(D,T,Al){
    const [m0,m1]=this.biLastTwo(), out=[];
    const P=window.DASH_IS25&&window.DASH_IS26&&window.DASH_FS?this.biPl():null, col=m=>P&&P.cols.find(c=>c.m===m)||null;
    const c1=col(m1), c0=col(m0), y=m1?(+m1.slice(0,4)-1)+m1.slice(4):null, cy=col(y);
    const chg=(x,b)=>typeof x==="number"&&typeof b==="number"&&b?(x-b)/Math.abs(b):null;
    const gm=c=>c&&!c.need&&c.v.net?c.v.gp/c.v.net:null;
    const sp=v=>v==null?"—":(v>=0?"▲ ":"▼ ")+T.pct(Math.abs(v));
    /* 1) الأداء الحالي */
    if(c1&&c0){
      const rows=[["net","صافي المبيعات"],["gpm","هامش مجمل الربح"],["np","صافي الربح"]].map(([k,l])=>{
        const v=c=>!c||c.need?null:k==="gpm"?gm(c):c.v[k];
        const d=(x,b)=>k==="gpm"?(x==null||b==null?null:(x-b)*100):chg(x,b);
        return {k,l,v1:v(c1),v0:v(c0),vy:v(cy),d0:d(v(c1),v(c0)),dy:d(v(c1),v(cy))}; });
      const r=rows[0];
      out.push({n:1,q:"ما حجم الأداء الحالي؟",go:"fs_income",basis:"مُتحقَّق",m0,m1,y,c1,c0,cy,rows,
        src:"قوائم الدخل: "+this.fsMon(m1)+" ("+c1.tag+") · "+this.fsMon(m0)+" ("+c0.tag+") · "+this.fsMon(y)+" ("+(cy?cy.tag:"لا قائمة")+")",
        answer:"صافي المبيعات "+this.fsMon(m1)+" "+T.egpK(r.v1)+": "+sp(r.d0)+" عن "+this.fsMon(m0)
          +(r.vy==null?" · "+this.fsMon(y)+": يحتاج بيانات":" و"+sp(r.dy)+" عن "+this.fsMon(y))});
    } else out.push({n:1,q:"ما حجم الأداء الحالي؟",go:"fs_income",basis:"يحتاج بيانات",src:"قوائم الدخل",
      need:"قائمتا دخل مقيستان لشهرين متتاليين",answer:"يحتاج بيانات"});
    /* 2) المستهدف — data/budget/budget_2026.csv عبر src/statements.py (DASH_FS.budget) */
    const B=(window.DASH_FS&&window.DASH_FS.budget||{})[m1]||null;
    const LN=[["net_sales","صافي المبيعات","net"],["cogs","تكلفة المبيعات","cogs"],["admin","المصروفات الإدارية","admin"],["selling","المصروفات البيعية","selling"]];
    const brows=B&&c1?LN.filter(([k])=>typeof B[k]==="number").map(([k,l,ck])=>{ const act=c1.v[ck], ok=typeof act==="number";
      return {k,l,bud:B[k],act:ok?act:null,var:ok?act-B[k]:null,pct:ok&&B[k]?(act-B[k])/Math.abs(B[k]):null}; }):[];
    if(brows.length){ const r=brows.find(x=>x.k==="net_sales")||brows[0];
      out.push({n:2,q:"هل نحقق المستهدف؟",go:"fs_exec",basis:"مُتحقَّق",rows:brows,src:"data/budget/budget_2026.csv · قائمة الدخل "+this.fsMon(m1),
        answer:r.l+" "+this.fsMon(m1)+": الفعلي "+T.egpK(r.act)+" مقابل الموازنة "+T.egpK(r.bud)+" ("+sp(r.pct)+")"}); }
    else out.push({n:2,q:"هل نحقق المستهدف؟",go:"fs_exec",basis:"يحتاج بيانات",src:"data/budget/budget_2026.csv",
      need:"لا موازنة معتمدة لـ"+(m1?this.fsMon(m1):"آخر شهر")+" — املأ data/budget/budget_2026.csv (القالب موجود: الشهر والبند والمبلغ)",
      answer:"يحتاج بيانات — لا موازنة معتمدة"});
    /* 3) أين تحقق الربح أو حدثت الخسارة */
    if(m0&&m1&&m0!==m1){
      const Br=this.biPnlBridge(m0,m1), I=this.biItemBridge(m0,m1);
      const ds=Br.steps.filter(s=>s.kind==="d").slice().sort((a,b)=>Math.abs(b.v)-Math.abs(a.v));
      const it=I.items.filter(i=>typeof i.dgp==="number");
      const up=it.slice().sort((a,b)=>b.dgp-a.dgp).filter(i=>i.dgp>0).slice(0,3), dn=it.slice().sort((a,b)=>a.dgp-b.dgp).filter(i=>i.dgp<0).slice(0,3);
      out.push({n:3,q:"أين تحقق الربح أو حدثت الخسارة؟",go:"bi_bridge",basis:"مُتحقَّق",src:"جسر الربح "+this.fsMon(m0)+" ← "+this.fsMon(m1),
        p0:Br.p0,p1:Br.p1,steps:ds.slice(0,3),up,dn,
        answer:"صافي الربح من "+T.egpK(Br.p0)+" إلى "+T.egpK(Br.p1)+" · أكبر عامل: "+(ds[0]?ds[0].name+" ("+this.fsC(ds[0].v).v+")":"—")});
    } else out.push({n:3,q:"أين تحقق الربح أو حدثت الخسارة؟",go:"bi_bridge",basis:"يحتاج بيانات",src:"قوائم الدخل",
      need:"قائمتا دخل مقيستان لشهرين",answer:"يحتاج بيانات"});
    /* 4–5) الانحرافات والإجراء: المفتوحة فقط، الأعلى أولوية، والأحدث داخل كل أولوية. */
    const rank={high:0,medium:1,low:2};
    const top=Al.map((r,i)=>({r,i})).filter(x=>this.biAlertState(x.r.id).s!=="مغلق")
      .sort((a,b)=>(rank[a.r.sev]??3)-(rank[b.r.sev]??3)||String(b.r.updated||"").localeCompare(String(a.r.updated||""))||a.i-b.i)
      .slice(0,3).map(x=>x.r);
    out.push({n:4,q:"ما أهم الانحرافات والمخاطر؟",go:"bi_alerts",basis:top.length?"مُتحقَّق":"—",src:"سجل التنبيهات",alerts:top,
      answer:top.length?top.map(r=>r.kpi).join(" · "):"لا تنبيهات مفتوحة"});
    out.push({n:5,q:"ما الإجراء المطلوب؟",go:"bi_alerts",basis:top.length?"مُتحقَّق":"—",src:"سجل التنبيهات",alerts:top,
      answer:top.length?top.map(r=>r.action+" ("+r.owner+")").join(" · "):"لا تنبيهات مفتوحة"});
    return out;
  }
  biExecCards(A){
    const T=this.state.T, money=v=>v==null?{v:"—"}:this.fsC(v), pctc=v=>v==null?{v:"—"}:{v:(v>=0?"▲ ":"▼ ")+T.pct(Math.abs(v)),c:v>=0?"#6ee7b7":"#fca5a5"};
    const head=a=>React.createElement("div",{key:"h",style:{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap",fontSize:10.5,color:"#64748b"}},
      a.basis!=="—"?this.biStatusTag(a.basis):null,a.src);
    return A.map(a=>{
      const kids=[head(a)], k="bq"+a.n;
      if(a.need) kids.push(this.biNeed(k+"n",a.need));
      else if(a.n===1){
        const ty=a.cy&&!a.cy.need, gp=r=>r.k==="gpm";
        kids.push(this.fsTable(k+"t",["البند",this.fsMon(a.m1),this.fsMon(a.m0),"التغير",this.fsMon(a.y)+(a.cy?" ("+a.cy.tag+")":""),"التغير"],
          a.rows.map(r=>[r.l,gp(r)?T.pct(r.v1):money(r.v1),gp(r)?T.pct(r.v0):money(r.v0),
            gp(r)?{v:r.d0==null?"—":(r.d0>=0?"+":"−")+Math.abs(r.d0).toFixed(1)+" نقطة"}:pctc(r.d0),
            !ty?{v:"يحتاج بيانات",c:"#94a3b8"}:gp(r)?T.pct(r.vy):money(r.vy),
            !ty?{v:"—"}:gp(r)?{v:r.dy==null?"—":(r.dy>=0?"+":"−")+Math.abs(r.dy).toFixed(1)+" نقطة"}:pctc(r.dy)])));
        kids.push(this.advNote(k+"x","المقارنة بالشهر نفسه من العام السابق مرجع لا مستهدف. صافي الربح كما في كل قائمة؛ وقوائم 2025 قبل الإهلاك (الإهلاك السنوي مُحمَّل على ديسمبر)."));
      } else if(a.n===2){
        kids.push(this.fsTable(k+"t",["البند","الموازنة","الفعلي","الانحراف","%"],
          a.rows.map(r=>[r.l,money(r.bud),money(r.act),money(r.var),pctc(r.pct)])));
      } else if(a.n===3){
        kids.push(React.createElement("div",{key:k+"a",style:{fontSize:11.5,lineHeight:1.8,color:"#cbd5e1"}},a.answer+"."));
        kids.push(this.fsTable(k+"s",["أكبر العوامل","الأثر"],a.steps.map(s=>[s.name,money(s.v)])));
        const it=a.up.map(i=>({...i,dir:"ربح"})).concat(a.dn.map(i=>({...i,dir:"خسارة"})));
        /* الصنف الجديد أو المتوقف كله أثر واحد، فلا يُقسَّم إلى سعر وتكلفة وكمية. */
        const fx=(i,v)=>i.kind==="مشترك"?money(v):{v:"—"};
        if(it.length) kids.push(this.fsTable(k+"i",["الصنف","الحالة","Δ مجمل الربح","أثر السعر","أثر التكلفة","الكمية والمزيج"],
          it.map(i=>[i.name,i.kind,{...money(i.dgp),c:i.dgp>=0?"#6ee7b7":"#fca5a5"},fx(i,i.price),fx(i,i.cost),fx(i,i.vol)])));
        kids.push(this.advNote(k+"x","الإجماليات من القوائم «مُتحقَّق»؛ أثر التكلفة بالصنف «تقدير» من تكلفة الصنف في جدول الربحية. التفصيل الكامل وكل الأصناف في «جسر الربح»."));
      } else if(!a.alerts.length) kids.push(this.empty("لا تنبيهات مفتوحة"));
      else if(a.n===4) kids.push(this.fsTable(k+"t",["المؤشر","القيمة","الحد","الانحراف"],a.alerts.map(r=>[r.kpi,r.value,r.thr,r.dev])));
      else kids.push(this.fsTable(k+"t",["الإجراء","المسؤول","الحالة"],a.alerts.map(r=>[{v:React.createElement("span",{onClick:()=>this.go(r.go),
          "data-bi-q5":r.go,style:{cursor:"pointer",color:"var(--abh-93c5fd,#93c5fd)",textDecoration:"underline",textUnderlineOffset:3}},r.action)},
        r.owner,this.biAlertState(r.id).s])));
      kids.push(this.advLink(k+"go","التفاصيل",a.go));
      return this.card(a.n+" — "+a.q,kids,{k});
    });
  }

  /* ======================= 2) جسر الربح (السعر × الكمية × التكلفة) ========== */
  /* على مستوى الشركة: صافي الربح m0 + Δ المبيعات − Δ التكلفة − Δ كل فئة مصروفات = صافي الربح m1.
     شهور الربع الأول 2026 موزعة بلا تفصيل للمصروفات، فيظهر لها Δ الإجمالي سطرًا واحدًا.
     وتصنيف مصروفات 2025 إلى الفئات الأربع معاد من بنود القائمة (category_basis ≠ stated) فهو تقدير. */
  biPnlBridge(m0,m1){
    const a=this.biStmt(m0), b=this.biStmt(m1), C=this.biCats(), cat=(r,k)=>(r.categories||{})[k]||0;
    const has=r=>!!r.categories&&Object.keys(r.categories).length>0, split=has(a)&&has(b);
    const mapped=[a,b].filter(r=>(r.expense_items||[]).some(i=>i.category_basis!=="stated")).map(r=>r.period);
    const steps=[{name:"صافي الربح "+this.fsMon(m0),v:a.net_profit,kind:"s"},
      {name:"Δ صافي المبيعات",v:b.net_sales-a.net_sales,kind:"d"},
      {name:"Δ تكلفة المبيعات",v:-(b.cogs-a.cogs),kind:"d"}]
      .concat(split?C.map(([k,l])=>({name:"Δ "+l,v:-(cat(b,k)-cat(a,k)),kind:"d"}))
        :[{name:"Δ إجمالي المصروفات",v:-(b.total_expenses-a.total_expenses),kind:"d"}]);
    const sum=steps.reduce((s,x)=>s+x.v,0);
    steps.push({name:"صافي الربح "+this.fsMon(m1),v:b.net_profit,kind:"s"});
    const zero=[];
    if(split) C.forEach(([k,l])=>{ const x=cat(a,k), y=cat(b,k);
      if(!x&&y>0) zero.push({name:l,month:m0,other:y,otherMonth:m1});
      if(!y&&x>0) zero.push({name:l,month:m1,other:x,otherMonth:m0}); });
    return {steps,zero,split,mapped,p0:a.net_profit,p1:b.net_profit,residual:b.net_profit-sum,
      verified:this.biMeasured(a)&&this.biMeasured(b)&&(!split||!mapped.length),basis:[a.basis,b.basis]};
  }
  /* على مستوى الصنف (DASH_MARGIN.by_item_month): P = الإيراد ÷ الكمية، C = (الإيراد − مجمل الربح) ÷ الكمية.
       أثر السعر  = Σ ك1 × (س1 − س0)
       أثر التكلفة = − Σ ك1 × (ت1 − ت0)
       أثر الكمية والمزيج = Σ (ك1 − ك0) × (س0 − ت0)   (للإيراد: × س0)
     للأصناف المشتركة بين الشهرين، والأصناف الجديدة والمتوقفة منفصلة؛ المجموع يساوي الفرق تمامًا.
     الكمية والمزيج معًا لا منفصلين: وحدات الأصناف مختلفة (كيس، طبق، كرتونة) فلا كمية إجمالية تقسمهما. */
  biItemBridge(m0,m1){
    const M=window.DASH_MARGIN, rows=(M&&M.by_item_month)||[], A=new Map(), B=new Map();
    rows.forEach(r=>{ if(r.month===m0) A.set(r.item_code,r); if(r.month===m1) B.set(r.item_code,r); });
    const items=[], tot={price:0,cost:0,vol:0,volRev:0,nw:0,nwRev:0,dr:0,drRev:0,rev0:0,rev1:0,gp0:0,gp1:0};
    const est=rows.some(r=>(r.month===m0||r.month===m1)&&r.estimated);
    new Set([...A.keys(),...B.keys()]).forEach(code=>{
      const a=A.get(code), b=B.get(code), q0=a?+a.qty||0:0, q1=b?+b.qty||0:0;
      tot.rev0+=a?a.revenue:0; tot.rev1+=b?b.revenue:0; tot.gp0+=a?a.gross_profit:0; tot.gp1+=b?b.gross_profit:0;
      const o={code,name:(b||a).item_name,brand:(b||a).brand,q0,q1,rev0:a?a.revenue:0,rev1:b?b.revenue:0,gp0:a?a.gross_profit:0,gp1:b?b.gross_profit:0,
        price:0,cost:0,vol:0,kind:"مشترك",basis:[a&&a.basis,b&&b.basis].filter(Boolean).join(" ← ")};
      if(q0>0&&q1>0){
        const P0=a.revenue/q0, P1=b.revenue/q1, C0=(a.revenue-a.gross_profit)/q0, C1=(b.revenue-b.gross_profit)/q1;
        o.p0=P0; o.p1=P1; o.c0=C0; o.c1=C1;
        o.price=q1*(P1-P0); o.cost=-q1*(C1-C0); o.vol=(q1-q0)*(P0-C0); o.volRev=(q1-q0)*P0;
        tot.price+=o.price; tot.cost+=o.cost; tot.vol+=o.vol; tot.volRev+=o.volRev;
      } else if(q1>0){ o.kind="جديد"; tot.nw+=o.gp1-o.gp0; tot.nwRev+=o.rev1-o.rev0; }
      else { o.kind="متوقف"; tot.dr+=o.gp1-o.gp0; tot.drRev+=o.rev1-o.rev0; }
      o.dgp=o.gp1-o.gp0; o.drev=o.rev1-o.rev0;
      items.push(o);
    });
    items.sort((x,y)=>Math.abs(y.dgp)-Math.abs(x.dgp));
    const rel=new Set((M&&M.meta&&M.meta.reliable_months)||[]);
    return {items,tot,est,reliable:rel.has(m0)&&rel.has(m1),
      resRev:(tot.rev1-tot.rev0)-(tot.price+tot.volRev+tot.nwRev+tot.drRev),
      resGp:(tot.gp1-tot.gp0)-(tot.price+tot.cost+tot.vol+tot.nw+tot.dr)};
  }
  /* نقطة التعادل: تكلفة المبيعات متغيرة بالكامل والمصروفات كلها ثابتة — تصنيف مفترض لا من المصدر. */
  biBreakEven(){
    return this.biStmts().filter(r=>this.biMeasured(r)&&r.net_sales>0).map(r=>{
      const cm=(r.net_sales-r.cogs)/r.net_sales, fixed=r.total_expenses, be=cm>0?fixed/cm:null;
      return {month:r.period,sales:r.net_sales,cm,fixed,be,mos:be==null?null:(r.net_sales-be)/r.net_sales};
    });
  }
  biBridgeBody(X,T,api){
    const S=this.biStmts(), out=[];
    if(!S.length) return [this.biNeed("bbn","قوائم الدخل الشهرية (DASH_MARGIN.statements) غير مضمنة في هذا الملف.")];
    const def=this.biLastTwo(), ms=S.map(r=>r.period), st=this.state;
    const m0=ms.includes(st.biB0)?st.biB0:def[0], m1=ms.includes(st.biB1)?st.biB1:def[1];
    out.push(this.opsLegend("bbl"));
    out.push(React.createElement("div",{key:"bbl0",style:{fontSize:11,color:"#94a3b8"}},"من شهر:"));
    out.push(this.fsPick("bbp0",ms.map(m=>[m,this.fsMon(m)]),m0,"biB0"));
    out.push(React.createElement("div",{key:"bbl1",style:{fontSize:11,color:"#94a3b8"}},"إلى شهر:"));
    out.push(this.fsPick("bbp1",ms.map(m=>[m,this.fsMon(m)]),m1,"biB1"));
    if(m0===m1) return out.concat([this.empty("اختر شهرين مختلفين.")]);
    const Br=this.biPnlBridge(m0,m1);
    out.push(this.card("جسر صافي الربح — "+this.fsMon(m0)+" ← "+this.fsMon(m1),[
      React.createElement("div",{key:"t",style:{display:"flex",gap:6,alignItems:"center"}},
        this.opsTag(Br.verified?"v":"e"),React.createElement("span",{style:{fontSize:10.5,color:"#94a3b8"}},
          Br.verified?"الشهران من قوائم دخل مقيسة":Br.basis.some(x=>x!=="measured")?"أحد الشهرين موزع من قائمة ربع سنوية ("+Br.basis.join(" / ")+") — المقارنة إرشادية"
            :"الإجماليات مُتحقَّقة؛ توزيع مصروفات "+Br.mapped.map(m=>this.fsMon(m)).join(" و")+" على الفئات الأربع معاد من بنود القائمة (القائمة الأصلية إدارية وبيعية وتمويلية) فهو تقدير")),
      this.fsTable("bbt",["البند","القيمة"],Br.steps.map(s=>s.kind==="s"?{cells:[s.name,this.fsC(s.v)],bold:true}:[s.name,this.fsC(s.v)])),
      ...Br.zero.map((z,i)=>this.advNote("bbz"+i,z.name+" صفر في "+this.fsMon(z.month)+" وكانت "+this.fsC(z.other).v+" في "+this.fsMon(z.otherMonth)
        +": أكّد مع المحاسب أنها لم تُرحَّل بعد لا أنها توقفت، قبل قراءة أثرها على الربح.","warn")),
      Math.abs(Br.residual)>1?this.advNote("bbr","فرق غير مفسَّر في الجسر: "+this.fsC(Br.residual).v+" — بنود خارج الفئات الأربع.","warn"):null].filter(Boolean),
      {k:"bb1",sub:"المصروفات بإشارة سالبة: زيادتها تخفض الربح"}));
    const I=this.biItemBridge(m0,m1), t=I.tot;
    if(!I.items.length) out.push(this.biNeed("bbi","ربحية الأصناف لـ"+this.fsMon(m0)+" أو "+this.fsMon(m1)+" (DASH_MARGIN.by_item_month تغطي "
      +this.fsMon("2025-07")+"–"+this.fsMon("2026-07")+")."));
    else {
      const a=this.biStmt(m0), b=this.biStmt(m1), cov=(x,s)=>s&&s.net_sales?x/s.net_sales:null;
      out.push(this.card("تحليل السعر والكمية والتكلفة — الأصناف المُكلَّفة",[
        React.createElement("div",{key:"t",style:{display:"flex",gap:6,alignItems:"center"}},
          this.opsTag(I.reliable&&!I.est?"e":"a"),React.createElement("span",{style:{fontSize:10.5,color:"#94a3b8",lineHeight:1.7}},
            I.reliable?"الشهران ضمن الشهور الموثوقة لنموذج التكلفة":"شهر خارج نطاق الموثوقية (مارس 2026 فما بعد): تكلفة يونيو على أسعار مختلفة — أثر التكلفة غير موثوق")),
        this.fsTable("bbx",["الأثر","على الإيراد","على مجمل الربح"],[
          ["السعر",this.fsC(t.price),this.fsC(t.price)],
          ["تكلفة الوحدة","—",this.fsC(t.cost)],
          ["الكمية والمزيج",this.fsC(t.volRev),this.fsC(t.vol)],
          ["أصناف جديدة",this.fsC(t.nwRev),this.fsC(t.nw)],
          ["أصناف متوقفة",this.fsC(t.drRev),this.fsC(t.dr)],
          {cells:["الإجمالي",this.fsC(t.rev1-t.rev0),this.fsC(t.gp1-t.gp0)],bold:true}]),
        React.createElement("div",{key:"cv",style:{fontSize:10.5,lineHeight:1.8,color:"#94a3b8"}},
          "تغطية الأصناف المُكلَّفة من صافي المبيعات: "+(cov(t.rev0,a)==null?"—":T.pct(cov(t.rev0,a)))+" في "+this.fsMon(m0)
          +" و"+(cov(t.rev1,b)==null?"—":T.pct(cov(t.rev1,b)))+" في "+this.fsMon(m1)+". الإيراد هنا قبل المرتجعات ما عدا يونيو 2026.")],
        {k:"bb2",approx:true,sub:"ك = الكمية، س = سعر الوحدة، ت = تكلفة الوحدة"}));
      out.push(this.card("أكبر الأصناف أثرًا على مجمل الربح",this.fsTable("bbit",["الصنف","الحالة","أثر السعر","أثر التكلفة","الكمية والمزيج","Δ مجمل الربح"],
        I.items.slice(0,12).map(o=>[o.name,o.kind,o.kind==="مشترك"?this.fsC(o.price):"—",o.kind==="مشترك"?this.fsC(o.cost):"—",
          o.kind==="مشترك"?this.fsC(o.vol):"—",this.fsC(o.dgp)])),{k:"bb3",sub:"الجدول الكامل في التقارير: «ذكاء الأعمال — جسر الربح بالصنف»"}));
    }
    const BE=this.biBreakEven();
    out.push(this.card("هامش المساهمة ونقطة التعادل",[
      React.createElement("div",{key:"t",style:{display:"flex",gap:6,alignItems:"center"}},this.opsTag("a"),
        React.createElement("span",{style:{fontSize:10.5,color:"#94a3b8",lineHeight:1.7}},
          "افتراض معلن: تكلفة المبيعات متغيرة بالكامل وكل المصروفات ثابتة. التصنيف الفعلي (عمولات البيع متغيرة، جزء من الأجور ثابت) يحتاج قرار المحاسب.")),
      this.fsTable("bbe",["الشهر","صافي المبيعات","نسبة المساهمة","المصروفات (ثابتة)","مبيعات التعادل","هامش الأمان"],
        BE.map(r=>[this.fsMon(r.month),this.fsC(r.sales),this.fsC(r.cm,"pct"),this.fsC(r.fixed),this.fsC(r.be),this.fsC(r.mos,"pct")]))],
      {k:"bb4"}));
    out.push(this.opsDecision("bbd",[
      Math.abs(t.cost)>Math.abs(t.price)&&I.items.length?{t:"تكلفة الوحدة حرّكت مجمل الربح أكثر من السعر ("+this.fsC(t.cost).v+" مقابل "+this.fsC(t.price).v
        +"): راجع «تمرير التكلفة» قبل أي قرار سعر.",tag:I.reliable?"e":"a"}:null,
      t.price<0&&I.items.length?{t:"أثر السعر سالب ("+this.fsC(t.price).v+"): سعر الوحدة انخفض على الأصناف المشتركة — قارن بقسم «تسرب السعر والبونص».",tag:"e"}:null,
      BE.length?{t:"آخر هامش أمان "+this.fsC(BE[BE.length-1].mos,"pct").v+" ("+this.fsMon(BE[BE.length-1].month)+"): انخفاض المبيعات بأكثر من ذلك يُدخل الشهر في الخسارة بالافتراض أعلاه.",tag:"a"}:null]));
    return out;
  }

  /* ======================= 3) المخزون — الدوران والراكد والمطابقة ========== */
  biStock(){
    const O=window.DASH_OPS, I=O.inventory, vals=this.opsVals();
    /* أيام المخزون: متوسط (أول + آخر المدة) ÷ تكلفة مبيعات الشهر × أيامه — حيث توجد قائمة دخل للشهر. */
    const dio=vals.map((v,i)=>{ const m=v.date.slice(0,7), s=this.biStmt(m), p=vals[i-1];
      const avg=p&&p.date.slice(0,7)===this.biPrevMonth(m)?(p.total+v.total)/2:v.total;
      return {date:v.date,month:m,total:v.total,avg,closingOnly:!(p&&p.date.slice(0,7)===this.biPrevMonth(m)),
        cogs:s?s.cogs:null,basis:s?s.basis:null,dio:s&&s.cogs>0?avg/s.cogs*this.opsMonDays(m):null,
        turns:s&&avg>0?s.cogs/avg:null}; });
    const recon=vals.map(v=>({date:v.date,computed:v.total,printed:v.src.total_printed,diff:v.src.total_printed==null?null:v.total-v.src.total_printed}));
    /* الراكد: خامة برصيد ثابت الكمية في كل الجرود المسعّرة من يوليو، ولا مشتريات في أي شهر بعده. */
    const keys=vals.map(v=>v.key).filter(k=>k!=="jun"), lastK=keys[keys.length-1], maps=keys.map(k=>new Map(I[k].raw.map(r=>[r.name,r])));
    const dead=[], slow=[];
    (I[lastK].raw||[]).forEach(r=>{ if(!(r.qty>0)) return;
      const hist=maps.map(m=>m.get(r.name)), same=hist.every(h=>h&&h.qty===r.qty), noBuy=hist.slice(1).every(h=>h&&!h.purch_qty);
      const prev=hist[hist.length-2];
      if(same&&noBuy) dead.push({name:r.name,qty:r.qty,wac:r.wac,value:r.value,since:this.opsMonName(I[keys[0]].date)});
      else if(prev&&prev.qty===r.qty&&!r.purch_qty) slow.push({name:r.name,qty:r.qty,wac:r.wac,value:r.value,since:this.opsMonName(prev.date||I[keys[keys.length-2]].date)}); });
    dead.sort((a,b)=>b.value-a.value); slow.sort((a,b)=>b.value-a.value);
    const unpriced=(I[lastK].raw||[]).filter(r=>r.qty>0&&!(r.wac>0)).map(r=>({name:r.name,qty:r.qty}));
    const months=["jun","jul","aug","sep"].filter(k=>(I.recipes||[]).some(r=>r["kg_"+k]!=null));
    const kg=(I.recipes||[]).map(r=>{ const f=r["kg_"+months[0]], l=r["kg_"+months[months.length-1]];
      return {product:r.product,brand:r.brand,kg:months.map(k=>r["kg_"+k]),chg:f?(l-f)/f:null}; });
    return {vals,dio,recon,dead,slow,unpriced,lastDate:I[lastK].date,firstDate:I[keys[0]].date,months,kg};
  }
  biPrevMonth(m){ const y=+m.slice(0,4), mo=+m.slice(5,7); return mo===1?(y-1)+"-12":y+"-"+String(mo-1).padStart(2,"0"); }
  biStockBody(X,T,api){
    if(!window.DASH_OPS) return [this.opsMissing("bs0")];
    const V=this.advMemo(api,"biStock",()=>this.biStock()), out=[], last=V.vals[V.vals.length-1];
    out.push(this.opsLegend("bsl"));
    out.push(this.kpiTiles([
      ["المخزون "+this.opsDmy(last.date),T.egpK(last.total),"مُتحقَّق · خامات + منتج تام","#f59e0b"],
      ["خامات راكدة",T.egpK(V.dead.reduce((s,r)=>s+r.value,0)),T.int(V.dead.length)+" صنف بلا حركة منذ "+V.dead.concat([{since:"—"}])[0].since,"#ef4444"],
      ["خامات بطيئة",T.egpK(V.slow.reduce((s,r)=>s+r.value,0)),T.int(V.slow.length)+" صنف لم يتغير رصيده في الشهر الأخير","#f97316"],
      ["أصناف برصيد بلا تكلفة",T.int(V.unpriced.length),"مقيّمة بصفر في الجرد","#a78bfa"]],"bsk"));
    out.push(this.card("أيام المخزون ودوّرانه",[
      this.fsTable("bsd",["الشهر","المخزون (متوسط)","تكلفة المبيعات","الدوران الشهري","أيام المخزون"],
        V.dio.map(r=>[this.fsMon(r.month),this.fsC(r.avg),r.cogs==null?{v:"يحتاج بيانات",c:"#c4b5fd"}:this.fsC(r.cogs),
          r.turns==null?"—":{v:r.turns.toFixed(2)+"x"},r.dio==null?"—":this.fsC(r.dio,"d")])),
      V.dio.some(r=>r.cogs==null)?this.biNeed("bsdn","قائمة دخل "+V.dio.filter(r=>r.cogs==null).map(r=>this.fsMon(r.month)).join(" و")
        +" (تكلفة المبيعات) — بدونها لا تُحسب أيام المخزون لهذه الشهور."):null,
      this.advNote("bsdx","تقدير: المخزون بتكلفة الخامات والتعبئة فقط (نموذج المتوسط المرجح) بينما تكلفة المبيعات في القائمة تشمل التصنيع، فالأيام أقل من الحقيقية. "
        +(V.dio.some(r=>r.closingOnly)?"الشهر الأول بلا تقييم سابق يستخدم رصيد آخر المدة وحده.":""),"warn")].filter(Boolean),{k:"bs1",approx:true}));
    out.push(this.card("مطابقة إجمالي التقييم بالمطبوع في المصدر",this.fsTable("bsr",["التاريخ","المحسوب (خامات + تام)","المطبوع","الفرق"],
      V.recon.map(r=>[this.opsDmy(r.date),this.fsC(r.computed),this.fsC(r.printed),r.diff==null?"—":{v:Math.abs(r.diff)<1?"مطابق":this.fsC(r.diff).v,
        c:Math.abs(r.diff||0)<1?"#6ee7b7":"#fca5a5"}])),{k:"bs2"}));
    out.push(this.card("الخامات الراكدة — بلا حركة "+this.opsDmy(V.firstDate)+" ← "+this.opsDmy(V.lastDate),
      this.fsTable("bsx",["الخامة","الكمية","متوسط التكلفة","القيمة"],V.dead.map(r=>[r.name,this.fsC(r.qty),this.fsC(r.wac),this.fsC(r.value)]),
        {emptyMsg:"لا خامة ثابتة الرصيد بلا مشتريات في كل الجرود."}),{k:"bs3",sub:"مُتحقَّق: الكمية نفسها في كل جرد ولا مشتريات"}));
    out.push(this.card("الخامات البطيئة — الرصيد لم يتغير في الشهر الأخير",
      this.fsTable("bss",["الخامة","الكمية","القيمة"],V.slow.slice(0,15).map(r=>[r.name,this.fsC(r.qty),this.fsC(r.value)])),
      {k:"bs4",sub:"أعلى 15 بالقيمة؛ الجدول الكامل في التقارير"}));
    if(V.unpriced.length) out.push(this.card("أصناف برصيد بلا متوسط تكلفة",this.fsTable("bsu",["الصنف","الكمية"],
      V.unpriced.map(r=>[r.name,this.fsC(r.qty)])),{k:"bs5",sub:"قيمتها في الجرد صفر، فإجمالي المخزون أقل من الحقيقي بقيمتها"}));
    if(V.kg.length) out.push(this.card("تكلفة الكيلو للوصفات (خامات وتعبئة)",this.fsTable("bsk2",
      ["المنتج"].concat(V.months.map(k=>this.opsMonName(V.vals.find(v=>v.key===k).date)),["التغير"]),
      V.kg.map(r=>[r.product].concat(r.kg.map(x=>x==null?"—":{v:x.toFixed(2)}),[this.fsC(r.chg,"pct")]))),{k:"bs6",approx:true,sub:"تقدير: وزن الخامة في الوصفة × متوسط تكلفتها في الشهر"}));
    out.push(this.opsDecision("bsdc",[
      V.dead.length?{t:"قرر مصير "+V.dead.length+" خامة راكدة بقيمة "+T.egpK(V.dead.reduce((s,r)=>s+r.value,0))+": صلاحيتها، استعمالها في الإنتاج، أو إيقاف إعادة شرائها.",tag:"v"}:null,
      V.unpriced.length?{t:"أدخل سعر شراء "+V.unpriced.length+" صنف تعبئة برصيد بلا تكلفة في نموذج المتوسط المرجح؛ قيمة المخزون الحالية تستبعدها.",tag:"v"}:null,
      V.dio.some(r=>r.cogs==null)?{t:"اطلب قوائم دخل "+V.dio.filter(r=>r.cogs==null).map(r=>this.fsMon(r.month)).join(" و")+" من المحاسب لاستكمال أيام المخزون.",tag:"v"}:null]));
    return out;
  }

  /* ======================= التكلفة المعيارية (DASH_STD) ===================== */
  /* «سعر انتاج تام»: تكلفة معيارية للعبوة = الخلطة + التغليف (تأكيد الإدارة)، مربوطة بكود المبيعات
     بتوقيع واحد مطابق فقط (src/standard_cost.py).
       شهريًا: التكلفة المعيارية للمبيعات = Σ كمية الصنف المربوط (مع البونص: يخرج من المخزن) × معياره؛
       نسبتها = ÷ إيراد هذه الأصناف؛ والنسبة الفعلية = تكلفة المبيعات ÷ صافي المبيعات في قائمة الشهر.
       الانحراف التقديري = (الفعلية − المعيارية) × صافي المبيعات — يفترض أن الأصناف المربوطة تمثل الباقي.
     لا تكلفة فعلية مستقلة للصنف: «الفعلية» في ربحية الأصناف (نموذج التكلفة) = المعيار × الكمية بالبناء،
     فمقارنتها بالمعيار دائرية ولا تُعرض انحرافًا. لكل صنف يُعرض الهامش المعياري بسعر البيع الفعلي في الفواتير،
     ويُذكر أي صنف يختلف فيه معيار الملف عن تكلفة النموذج (فحص اتساق). */
  biStd(D){
    const S=window.DASH_STD, std=new Map(S.rows.filter(r=>r.item_code).map(r=>[String(r.item_code),r]));
    /* المعيار المستعمل = إجمالي الملف، إلا حيث حددته الإدارة (std_basis يذكر رقم الملف). */
    const U=r=>r.std!=null?r.std:r.total;
    const basis=r=>r.std_basis&&r.std_basis!=="الملف"?r.std_basis:/^تأكيد الإدارة/.test(r.match_basis||"")?"الملف · الربط بتأكيد الإدارة":"الملف";
    const P=(window.DASH_IS26&&window.DASH_IS26.periods)||[], stm={};
    P.forEach(p=>p.months.forEach(m=>{ stm[m]={ratio:p.cogs/p.net_sales,q:p.months.length>1,period:p.period}; }));
    const SM=(window.DASH_MARGIN&&window.DASH_MARGIN.statements&&window.DASH_MARGIN.statements.by_month)||[];
    const by={};
    (D.lines||[]).forEach(l=>{ if(String(l.month||"").slice(0,4)!=="2026") return;
      const o=by[l.month]||(by[l.month]={month:l.month,rev:0,covRev:0,stdCogs:0});
      const t=+l.line_total||0, r=std.get(String(l.item_code)); o.rev+=t;
      if(r){ o.covRev+=t; o.stdCogs+=(+l.qty||0)*U(r); } });
    const months=Object.values(by).sort((a,b)=>a.month.localeCompare(b.month)).map(o=>{
      const s=stm[o.month], ns=(SM.find(x=>x.period===o.month)||{}).net_sales;
      const stdR=o.covRev?o.stdCogs/o.covRev:null, act=s?s.ratio:null;
      return {...o,cov:o.rev?o.covRev/o.rev:0,stdR,actR:act,q:s&&s.q,ns:s?ns:null,
        var:act!=null&&stdR!=null&&ns!=null?(act-stdR)*ns:null}; });
    /* لكل صنف: آخر شهر 2026 في اللقطة — سعر البيع الفعلي (بنود غير البونص) والهامش المعياري. */
    const skuMonth=months.length?months[months.length-1].month:null, M=window.DASH_MARGIN, agg={};
    (D.lines||[]).forEach(l=>{ if(l.month!==skuMonth) return; const c=String(l.item_code); if(!std.has(c)) return;
      const o=agg[c]||(agg[c]={qty:0,bonus:0,rev:0,name:l.item_name});
      if(l.is_bonus||!(+l.line_total>0)) o.bonus+=+l.qty||0; else { o.qty+=+l.qty||0; o.rev+=+l.line_total; } });
    const sku=S.rows.filter(r=>r.item_code).map(r=>{ const o=agg[String(r.item_code)]||{qty:0,bonus:0,rev:0,name:r.key};
      const price=o.qty?o.rev/o.qty:null;
      return {code:r.item_code,name:o.name,brand:r.brand,std:U(r),basis:basis(r),mix:r.mix,pack:r.pack,qty:o.qty,bonus:o.bonus,rev:o.rev,price,
        std_margin:price?(price-U(r))/price:null,std_gp:o.rev-U(r)*(o.qty+o.bonus)}; }).sort((a,b)=>b.rev-a.rev);
    /* فحص اتساق: تكلفة الوحدة التي استعملها نموذج الربحية في يونيو مقابل معيار الملف. */
    const jun=r=>((M&&M.by_item_month)||[]).find(y=>y.month==="2026-06"&&String(y.item_code)===String(r.item_code)&&y.qty>0);
    const cons=S.rows.filter(r=>r.item_code&&!r.cons_ok).map(r=>{
      const x=jun(r), u=x?(x.revenue-x.gross_profit)/x.qty:null;
      return {code:r.item_code,name:x?x.item_name:r.key,std:U(r),model:u,diff:u==null?null:(u-U(r))/U(r)}; })
      .filter(r=>r.diff!=null&&Math.abs(r.diff)>0.05);
    /* السجق: المعيار شامل الهانك (تأكيد الإدارة) مقابل تكلفة الوحدة في نموذج الربحية ليونيو.
       أقرب تفسير للفرق: ≈ 0 → النموذج متفق؛ ≈ الهانك → النموذج لا يحمّل الهانك؛ وإلا (البقية > 10% من المعيار) غير مفسَّر. */
    const hank=S.rows.filter(r=>r.item_code&&r.hank_qty!=null).map(r=>{
      const x=jun(r), u=x?(x.revenue-x.gross_profit)/x.qty:null, gap=u==null?null:U(r)-u, rest=gap==null?null:gap-r.hank_cost;
      return {code:r.item_code,name:x?x.item_name:r.key,brand:r.brand,std:U(r),hank:r.hank_cost,hank_qty:r.hank_qty,hank_price:r.hank_price,
        per_kg:r.hank_per_kg,model:u,gap,rest,qty:x?x.qty:0,
        status:gap==null?null:Math.min(Math.abs(gap),Math.abs(rest))>0.1*U(r)?"غير مفسَّر":Math.abs(gap)<=Math.abs(rest)?"متفق":"النموذج بلا هانك"}; });
    const decided=S.rows.filter(r=>basis(r)!=="الملف");
    return {months,sku,skuMonth,cons,hank,decided,linked:std.size,unmatched:S.unmatched,unresolved:S.unresolved,mon:this.biStdMonthly(D,S,U)};
  }
  /* المعيار الشهري (تأكيد الإدارة 26/10/2026): الوصفة بمتوسط سعر الخامات آخر الشهر — بجوار معيار الملف لا بدلًا منه.
     لكل شهر له ملف: نسبة التكلفة المعيارية للأصناف المربوطة بمعيار الملف وبمعيار الشهر (نفس الأصناف ونفس الكميات مع البونص)،
     وأصناف الخامة الواحدة (مفروم/كبده) مستقلة لأنها ليست في الملف. */
  biStdMonthly(D,S,U){
    const Mo=S.monthly; if(!Mo) return null;
    const fileRow=new Map(S.rows.filter(r=>r.item_code).map(r=>[String(r.item_code),r]));
    const monRow=new Map(Mo.rows.map(r=>[String(r.item_code),r])), single=new Map(Mo.single.map(r=>[String(r.item_code),r]));
    const names={}, by={};
    Mo.months.forEach(m=>{ by[m]={month:m,rev:0,file:0,mon:0,missing:0,sRev:0,sStd:0,sQty:0}; });
    (D.lines||[]).forEach(l=>{ const c=String(l.item_code); names[c]=names[c]||l.item_name; const o=by[l.month]; if(!o) return;
      const q=+l.qty||0, t=+l.line_total||0, f=fileRow.get(c), mr=monRow.get(c), sr=single.get(c);
      if(f){ const x=mr&&mr.by_month[l.month]; o.rev+=t; o.file+=q*U(f);
        if(x&&x.std!=null) o.mon+=q*x.std; else { o.mon+=q*U(f); o.missing+=q; } }
      else if(sr){ const x=sr.by_month[l.month]; o.sRev+=t; o.sQty+=q; if(x&&x.std!=null) o.sStd+=q*x.std; } });
    const months=Mo.months.map(m=>{ const o=by[m];
      return {...o,fileR:o.rev?o.file/o.rev:null,monR:o.rev?o.mon/o.rev:null,sR:o.sRev?o.sStd/o.sRev:null}; });
    const last=Mo.months[Mo.months.length-1];
    const rows=Mo.rows.map(r=>({code:r.item_code,name:names[r.item_code]||r.key,recipe:r.recipe,kg:r.kg,file:r.file_std,
      by:r.by_month,chg:r.by_month[last]&&r.by_month[last].std!=null?r.by_month[last].std/r.file_std-1:null}));
    const singles=Mo.single.map(r=>({code:r.item_code,name:names[r.item_code]||r.item_name_sales,recipe:r.recipe,mgmt:r.mgmt,
      mgmt_basis:r.mgmt_basis,by:r.by_month,chg:r.by_month[last]&&r.by_month[last].std!=null?r.by_month[last].std/r.mgmt-1:null}));
    return {months,rows,singles,list:Mo.months,last,basis:Mo.basis,hank:Mo.hank_price,pool:Mo.pool};
  }
  biStdBody(X,T,api){
    if(!window.DASH_STD) return [this.biNeed("bsd0","ملف التكلفة المعيارية غير مضمن في هذا الملف.")];
    const Z=this.advMemo(api,"biStd",(X2,D)=>this.biStd(D)), out=[], ok=Z.months.filter(r=>r.var!=null), last=ok[ok.length-1];
    out.push(this.opsLegend("bsdl"));
    out.push(this.kpiTiles([
      ["أصناف بتكلفة معيارية",T.int(Z.linked),"من "+T.int(window.DASH_STD.rows.length+Z.unresolved.length)+" صفًا في الملف","#3b82f6"],
      ["تغطية المبيعات",last?T.pct(last.cov):"—",last?"من إيراد "+this.fsMon(last.month):"","#06b6d4"],
      ["الانحراف التقديري",last?T.egpK(last.var):"—",last?this.fsMon(last.month)+" · موجب = فوق المعيار":"","#f59e0b"],
      ["أصناف تُباع دون معيارها",T.int(Z.sku.filter(r=>r.std_margin!=null&&r.std_margin<0).length),Z.skuMonth?"في "+this.fsMon(Z.skuMonth):"","#ef4444"]],"bsdk"));
    out.push(this.advNote("bsdn","المعيار = الخلطة + التغليف للعبوة من ملف «سعر انتاج تام» (تأكيد الإدارة). لا يشمل أجور الإنتاج ولا الأعباء، بينما تكلفة المبيعات في القائمة قد تشملها، "
      +"فجزء من الانحراف فرق أساس قياس لا هدر. كمية البونص تُحسب في التكلفة المعيارية لأنها تخرج من المخزن."));
    out.push(this.card("التكلفة المعيارية مقابل قائمة الدخل — شهريًا",[
      this.fsTable("bsdm",["الشهر","تغطية الإيراد","نسبة التكلفة المعيارية","نسبة التكلفة الفعلية","الانحراف (نقطة)","الانحراف التقديري"],
        Z.months.map(r=>[this.fsMon(r.month),this.fsC(r.cov,"pct"),this.fsC(r.stdR,"pct"),
          r.actR==null?{v:"يحتاج بيانات",c:"#c4b5fd"}:{v:T.pct(r.actR)+(r.q?" (ربع)":"")},
          r.actR==null||r.stdR==null?"—":{v:((r.actR-r.stdR)*100).toFixed(1),c:r.actR>r.stdR?"#fca5a5":"#6ee7b7"},
          r.var==null?"—":this.fsC(r.var)])),
      Z.months.some(r=>r.actR==null)?this.biNeed("bsdmn","قائمة دخل "+Z.months.filter(r=>r.actR==null).map(r=>this.fsMon(r.month)).join(" و")+" لحساب الانحراف."):null].filter(Boolean),
      {k:"bsd1",approx:true,sub:"يناير–مارس: نسبة الربع الأول (قائمة واحدة) · الانحراف تقدير يفترض أن الأصناف المربوطة تمثل الباقي"}));
    const r2=x=>x==null?{v:"—"}:{v:(Math.round(x*100)/100).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})};  // تكلفة العبوة بقرشين
    if(Z.skuMonth) out.push(this.card("الهامش المعياري لكل صنف — "+this.fsMon(Z.skuMonth),this.fsTable("bsds",
      ["الصنف","المعيار للعبوة","أساس المعيار","متوسط سعر البيع","الهامش المعياري","الكمية","بونص","الإيراد","مجمل الربح المعياري"],
      Z.sku.map(r=>[r.name,r2(r.std),r.basis,r2(r.price),r.std_margin==null?"—":{v:T.pct(r.std_margin),c:r.std_margin<0?"#fca5a5":null},
        this.fsC(r.qty),this.fsC(r.bonus),this.fsC(r.rev),this.fsC(r.std_gp)])),
      {k:"bsd2",sub:"مُتحقَّق: المعيار من الملف (أو بتأكيد الإدارة حيث يُذكر) والسعر من الفواتير · مجمل الربح المعياري يحمّل البونص بمعياره"}));
    if(Z.decided.length) out.push(this.card("قرارات الإدارة على ملف التكلفة المعيارية",this.fsTable("bsdq",["الصف في الملف","صنف المبيعات","الكود","المعيار المستعمل","الأساس"],
      Z.decided.map(r=>[r.name,r.item_name_sales||"—",r.item_code||"—",r2(r.std!=null?r.std:r.total),
        [r.std_basis&&r.std_basis!=="الملف"?r.std_basis:null,/^تأكيد الإدارة/.test(r.match_basis||"")?r.match_basis:null].filter(Boolean).join(" · ")])),
      {k:"bsd4",sub:"مُتحقَّق (تأكيد الإدارة): أرقام الملف لا تُعدَّل — الربط والمعيار المستعمل فقط مسجلان بقرار مؤرخ"}));
    out.push(this.advNote("bsdc","لا تكلفة فعلية مستقلة لكل صنف في البيانات: تكلفة الأصناف في «الربحية» محسوبة من المعيار نفسه (الخلطة + التغليف × الكمية) ثم موزع الفرق على الأصناف التجارية، "
      +"فلا يُعرض انحراف بالصنف. الانحراف الفعلي الوحيد هو مستوى الشركة أعلاه."));
    if(Z.cons.length) out.push(this.advNote("bsdx","فحص اتساق: "+Z.cons.map(r=>"«"+r.name+"» معياره في الملف "+r2(r.std).v+" بينما استعمل نموذج الربحية "
      +r2(r.model).v+" للوحدة").join("؛ ")+" — أكّد أي الرقمين هو المعيار.","warn"));
    const um=Z.unmatched.map(r=>[r.brand,r.key,this.fsC(Math.round(r.total*100)/100),r.match_basis])
      .concat(Z.unresolved.map(r=>[r.brand,r.name,this.fsC(Math.round(r.total*100)/100),r.reason]));
    if(um.length) out.push(this.card("صفوف في الملف لم تُربط بصنف مبيعات",this.fsTable("bsdu",["العلامة","الصف","المعيار","السبب"],um),
      {k:"bsd3",sub:"حجم العبوة في الملف يختلف عن أحجام المبيعات (مثل اسبشيال 400/1ك مقابل صغير/عائلي) أو لا صنف مبيعات مقابل — لا يُربط تخمينًا؛ تحتاج تأكيد الإدارة"}));
    const top=Z.sku.filter(r=>r.std_margin!=null&&r.std_margin<0);
    const hk=Z.hank.filter(r=>r.model!=null), hc=hk.filter(r=>r.status==="النموذج بلا هانك"), hu=hk.filter(r=>r.status==="غير مفسَّر");
    const hImp=hc.reduce((a,r)=>a+r.hank*r.qty,0);
    if(hk.length) out.push(this.card("السجق: المعيار شامل الهانك مقابل نموذج الربحية — يونيو 2026",this.fsTable("bsdh",
      ["الصنف","المعيار","منه الهانك","تكلفة النموذج للوحدة","الفرق","الحكم","الكمية"],
      hk.map(r=>[r.name,r2(r.std),r2(r.hank),r2(r.model),r2(r.gap),
        {v:r.status,c:{"متفق":"#6ee7b7","النموذج بلا هانك":"#fca5a5"}[r.status]||"#fcd34d"},this.fsC(r.qty)])),
      {k:"bsd5",approx:true,sub:"الهانك "+(+Z.hank[0].per_kg).toFixed(4)+" لكل كيلو سجق (تأكيد الإدارة) بسعره في ورقة وصفة كل علامة: "
        +[...new Map(Z.hank.map(r=>[r.brand,r.hank_price])).entries()].map(([b,p])=>b+" "+r2(p).v).join("، ")+" · "
        +"الحكم بأقرب تفسير للفرق: ≈ صفر «متفق»، ≈ الهانك «النموذج بلا هانك» (البقية فرق وزن العجينة 300/700 مقابل 350/800)، غير ذلك «غير مفسَّر»"}));
    const Q=Z.mon;
    if(Q){
      const hm=Q.list.map(m=>"المعيار "+this.fsMon(m));
      out.push(this.card("المعيار الشهري: الوصفة بمتوسط سعر آخر الشهر",[
        this.fsTable("bsdw",["الشهر","إيراد الأصناف المربوطة","نسبة التكلفة بمعيار الملف","نسبة التكلفة بمعيار الشهر","الفرق (نقطة)"],
          Q.months.map(r=>r.rev?[this.fsMon(r.month),this.fsC(r.rev),this.fsC(r.fileR,"pct"),this.fsC(r.monR,"pct"),
            {v:((r.monR-r.fileR)*100).toFixed(1),c:r.monR>r.fileR?"#fca5a5":"#6ee7b7"}]
            :[this.fsMon(r.month),{v:"يحتاج بيانات",c:"#c4b5fd"},"—","—","—"])),
        this.fsTable("bsdv",["الصنف","الكود","الوصفة","معيار الملف"].concat(hm,["التغير عن الملف"]),
          Q.rows.map(r=>[r.name,r.code,r.recipe+(r.kg!=null?" × "+r.kg+" كجم":""),r2(r.file)].concat(
            Q.list.map(m=>r.by[m]&&r.by[m].std!=null?r2(r.by[m].std):{v:"يحتاج بيانات",c:"#c4b5fd"}),
            [r.chg==null?"—":{v:T.pct(r.chg),c:r.chg>0?"#fca5a5":"#6ee7b7"}])).concat(
          Q.singles.map(r=>[r.name,r.code,r.recipe,{v:r2(r.mgmt).v+" (الإدارة: "+r.mgmt_basis+")"}].concat(
            Q.list.map(m=>r.by[m]&&r.by[m].std!=null?r2(r.by[m].std):{v:"يحتاج بيانات",c:"#c4b5fd"}),
            [r.chg==null?"—":{v:T.pct(r.chg),c:r.chg>0?"#fca5a5":"#6ee7b7"}])))),
        Q.months.some(r=>!r.rev)?this.biNeed("bsdwn","مبيعات "+Q.months.filter(r=>!r.rev).map(r=>this.fsMon(r.month)).join(" و")
          +" (اللقطة الحالية تنتهي قبلها) لحساب نسبة التكلفة بمعيار الشهر."):null].filter(Boolean),
        {k:"bsd6",sub:"مُتحقَّق: "+Q.basis+" — سعر كجم العجينة من وصفة كل منتج بمتوسط الشهر، والسجق + الهانك 1/15 للكيلو بمتوسط الهانك ("
          +Q.list.map(m=>this.fsMon(m)+" "+r2(Q.hank[m]).v).join("، ")+")، والتغليف من الملف كما هو · "
          +"المفروم والكبدة بوصفة الإدارة ومتوسط اللحم الهندي/الكبدة · لا يُغيّر معيار الملف ولا الجدول الشهري أعلاه"}));
    }
    out.push(this.opsDecision("bsdd",[
      top.length?{t:"أوقف البيع دون المعيار: "+top.map(r=>r.name).join("، ")+" — سعرها أقل من تكلفة خلطتها وتغليفها.",tag:"v"}:null,
      Z.cons.length?{t:"حسم معيار "+Z.cons.map(r=>"«"+r.name+"»").join("، ")+" بين الملف ونموذج الربحية.",tag:"v"}:null,
      hc.length?{t:"أضف الهانك إلى تكلفة "+hc.map(r=>"«"+r.name+"»").join("، ")+" في نموذج الربحية: مجمل ربحها هناك أعلى من الحقيقي بنحو "
        +T.egpK(hImp)+" في يونيو (الهانك × الكمية).",tag:"e"}:null,
      hu.length?{t:"راجع سعر عجينة "+hu.map(r=>"«"+r.name+"»").join("، ")+": الفرق بين المعيار ونموذج الربحية لا يفسّره الهانك.",tag:"v"}:null,
      um.length?{t:"أكّد الصنف المقابل لـ"+um.length+" صفًا غير مربوط لرفع تغطية المبيعات من "+(last?T.pct(last.cov):"—")+".",tag:"v"}:null,
      last&&last.var>0?{t:"الانحراف التقديري "+T.egpK(last.var)+" في "+this.fsMon(last.month)+": افصل أثر الأجور والأعباء (خارج المعيار) قبل اعتباره هدرًا.",tag:"e"}:null]));
    return out;
  }

  /* ======================= قوائم الدخل 2025 كاملة (DASH_IS25) ================ */
  /* يناير–مايو من نص القوائم (income_2025h1.py) · يونيو لا قائمة · يوليو–ديسمبر كما في DASH_FS.
     المقارنة بـ2026 من DASH_IS26 كما صدرت (الربع الأول قائمة واحدة). */
  biIs25(){
    const I=window.DASH_IS25, rows=[];
    I.months.forEach(r=>rows.push({month:r.month,net:r.net_sales,cogs:r.cogs,gp:r.gross_profit,exp:r.expenses,np:r.net_profit,
      inv:r.invoice_sales,basis:r.basis,flags:r.flags,confirm:!!r.needs_confirmation,src:r.uploaded_as}));
    I.missing.forEach(r=>rows.push({month:r.month,need:r.reason}));
    I.h2.forEach(r=>{ const s=r.sections||{}, e=(s.admin||0)+(s.selling||0)+(s.finance||0);
      rows.push({month:r.month,net:r.net_sales,cogs:r.cogs,gp:r.gross_profit,exp:e,np:r.net_profit,basis:r.basis,flags:[],src:r.source,predep:true}); });
    rows.sort((a,b)=>a.month<b.month?-1:1);
    rows.forEach(r=>{ if(r.net){ r.gpm=r.gp/r.net; r.npm=r.np/r.net; r.expr=r.exp/r.net; } });
    const have=rows.filter(r=>r.net!=null), sum=k=>have.reduce((s,r)=>s+r[k],0);
    const Y={net:sum("net"),gp:sum("gp"),np:sum("np"),months:have.length};
    /* 2025 مقابل 2026 لنفس الفترة: الربع الأول مجمّعًا، ثم كل شهر له قائمة في 2026. */
    const P=((window.DASH_IS26||{}).periods)||[], by=new Map(rows.map(r=>[r.month,r]));
    const cmp=P.map(p=>{ const ms=p.months.map(m=>"2025"+m.slice(4)), a=ms.map(m=>by.get(m));
      const ok=a.every(r=>r&&r.net!=null);
      const s=k=>ok?a.reduce((t,r)=>t+r[k],0):null;
      return {label:p.months.length>1?"الربع الأول":this.fsMon(p.period).split(" ")[0],m25:ms,
        net25:s("net"),net26:p.net_sales,np25:s("np"),np26:p.net_profit,gp25:s("gp"),gp26:p.gross_profit,
        confirm:a.some(r=>r&&r.confirm),missing:a.filter(r=>!r||r.net==null).map((r,i)=>ms[i])}; });
    return {rows,Y,cmp};
  }
  biIs25Body(X,T,api,opt){
    if(!window.DASH_IS25) return [this.biNeed("bi25n","قوائم دخل 2025 غير مضمنة في هذا الملف.")];
    const Z=this.biIs25(), out=[], Y=Z.Y, need=Z.rows.filter(r=>r.need), conf=Z.rows.filter(r=>r.confirm);
    out.push(this.kpiTiles([
      ["صافي المبيعات 2025",T.egpK(Y.net),Y.months+" شهرًا لها قائمة من 12","#3b82f6"],
      ["صافي الربح 2025",T.egpK(Y.np),"هامش "+T.pct(Y.np/Y.net)+" · يوليو–ديسمبر قبل الإهلاك","#10b981"],
      ["هامش مجمل الربح",T.pct(Y.gp/Y.net),"متوسط مرجّح بالمبيعات","#06b6d4"],
      ["أشهر تحتاج بيانات أو تأكيدًا",T.int(need.length+conf.length),need.map(r=>this.fsMon(r.month)).concat(conf.map(r=>this.fsMon(r.month)+" (تأكيد)")).join("، "),"#f59e0b"]],"bi25k"));
    out.push(this.advNote("bi25a","يناير–مايو 2025 من نص قوائم الدخل المرفوع (ملفات .pdf.txt — لم تُرفع ملفات PDF نفسها): كل رقم موجود حرفيًا في نص شهره، "
      +"والمبيعات − المردودات − الخصم = الصافي، والصافي − التكلفة = مجمل الربح، ومجمل الربح − المصروفات = صافي الربح. "
      +"تبقى «يحتاج مراجعة» حتى تُقارن بالـPDF. يوليو–ديسمبر من القوائم المالية المعتمدة (DASH_FS) كما هي، وصافي ربحها قبل الإهلاك (إهلاك السنة كله في ديسمبر)."));
    if(!(opt&&opt.noTable)) out.push(this.card("قائمة الدخل الشهرية — 2025",[
      this.fsTable("bi25t",["الشهر","صافي المبيعات","تكلفة المبيعات","مجمل الربح","هامش المجمل","المصروفات","نسبة المصروفات","صافي الربح","هامش الصافي","مبيعات الفواتير","الأساس"],
        Z.rows.map(r=>r.need?[this.fsMon(r.month),{v:"يحتاج بيانات",c:"#c4b5fd"},"—","—","—","—","—","—","—","—",{v:r.need,c:"#c4b5fd"}]
          :[this.fsMon(r.month),this.fsC(r.net),this.fsC(r.cogs),this.fsC(r.gp),this.fsC(r.gpm,"pct"),this.fsC(r.exp),this.fsC(r.expr,"pct"),
            this.fsC(r.np),this.fsC(r.npm,"pct"),r.inv==null?"—":this.fsC(r.inv),
            {v:(r.confirm?"يحتاج تأكيد · ":"")+(r.predep?"مُتحقَّق — قبل الإهلاك":r.basis),c:r.confirm?"#fcd34d":r.predep?"#6ee7b7":"#fcd34d"}])),
      need.length?this.biNeed("bi25tn","قائمة دخل "+need.map(r=>this.fsMon(r.month)).join(" و")+" (لم تُرفع)."):null].filter(Boolean),
      {k:"bi25c",sub:"مبيعات الفواتير = إجمالي فواتير الشهر بعد خصم البنود وقبل المردودات (مصدر مستقل) · تُعرض للمقارنة لا للمطابقة"}));
    const FM=window.DASH_IS25.feb_mar;
    conf.forEach(r=>out.push(this.advNote("bi25f"+r.month,this.fsMon(r.month)+": "+r.flags.join("؛ ")+". صافي ربحها "+T.egpK(r.np)
      +" محسوب على تلك الأرقام كما طُبعت، وفواتير الشهر "+(r.inv==null?"—":T.egpK(r.inv))+" مقابل مبيعات القائمة."
      +(FM?" فرضية: صافي مبيعات الشهرين معًا "+T.egpK(FM.net_sales)+" يختلف عن فواتيرهما بـ "+T.pct(FM.ratio)
        +"، في نطاق باقي الأشهر ("+Object.values(FM.other_months_ratio).map(x=>T.pct(x)).join("، ")
        +") — كأن رقم الشهرين قُسم مناصفة. لا يُعدَّل شيء حتى تؤكد الإدارة.":""),"warn")));
    out.push(this.card("2025 مقابل 2026 — نفس الأشهر",this.fsTable("bi25y",
      ["الفترة","صافي المبيعات 2025","صافي المبيعات 2026","التغير","مجمل الربح 2025","مجمل الربح 2026","صافي الربح 2025","صافي الربح 2026","التغير"],
      Z.cmp.map(c=>{ const ch=(a,b)=>a==null||!a?{v:"—"}:this.fsC((b-a)/Math.abs(a),"pct");
        return c.net25==null?[c.label,{v:"يحتاج بيانات ("+c.missing.map(m=>this.fsMon(m)).join("، ")+")",c:"#c4b5fd"},this.fsC(c.net26),"—","—",this.fsC(c.gp26),"—",this.fsC(c.np26),"—"]
          :[c.label+(c.confirm?" *":""),this.fsC(c.net25),this.fsC(c.net26),ch(c.net25,c.net26),this.fsC(c.gp25),this.fsC(c.gp26),
            this.fsC(c.np25),this.fsC(c.np26),ch(c.np25,c.np26)]; })),
      {k:"bi25d",sub:"2026 من قوائم الدخل كما صدرت (DASH_IS26) · * يشمل مارس 2025 الذي يحتاج تأكيدًا"}));
    out.push(this.opsDecision("bi25x",[
      need.length?{t:"ارفع قائمة دخل "+need.map(r=>this.fsMon(r.month)).join(" و")+" لاستكمال السنة.",tag:"v"}:null,
      conf.length?{t:"راجع "+conf.map(r=>this.fsMon(r.month)).join("، ")+": المبيعات والتكلفة مطابقة لفبراير بالقرش — غالبًا نسخ من قائمة الشهر السابق.",tag:"v"}:null,
      {t:"ارفع ملفات PDF لقوائم يناير–مايو 2025 لتحويل أساسها من «نص مستخرج» إلى «مُتحقَّق».",tag:"v"}]));
    return out;
  }

  /* ======================= تحليل Abohashem-main (DASH_ABM) =================== */
  /* نتائج تشغيل كود الملف المضغوط (abohashem_main.py) — لقطة يونيو 2026؛ لا تحل محل البيانات الأحدث. */
  biAbmBody(X,T,api){
    const A=window.DASH_ABM;
    if(!A||!A.enabled) return [this.biNeed("biab0","نتائج Abohashem-main غير مضمنة (معطلة بـ ABOHASHEM_MAIN=off أو لم تُبن).")];
    const S=A.summary, out=[], G=A.aging_vs_debt, ok=A.checks.filter(c=>c.ok).length, D=A.due_within_month;
    out.push(this.advNote("biabl",A.label+": فواتير "+this.opsDmy(A.as_of.invoices_from)+" ← "+this.opsDmy(A.as_of.invoices_to)
      +" ومديونية المناديب في "+this.opsDmy(A.as_of.debt_as_of)+". لقطة تاريخية للمقارنة — أرقام المبيعات والمديونية الحالية في أقسامها كما هي.","warn"));
    out.push(this.kpiTiles([
      ["مبيعات الفترة",T.egpK(S.total_sales_EGP),T.int(S.invoices)+" فاتورة · "+T.int(S.distinct_customers_invoiced)+" عميلًا","#3b82f6"],
      ["المديونية القائمة",T.egpK(S.total_outstanding_debt_EGP),T.int(S.salespeople)+" مناديب","#ef4444"],
      ["مستحق خلال شهر",T.egpK(D.total),"متأخر "+T.egpK(D.overdue)+" · لاحقًا "+T.egpK(D.later),"#f59e0b"],
      ["فواتير صفرية",T.int(A.zero_invoices.count),"كمية "+T.int(A.zero_invoices.qty),"#a78bfa"]],"biabk"));
    out.push(this.card("تشغيل الأكواد",this.fsTable("biabr",["السكربت","النتيجة","تفاصيل"],
      A.runs.filter(r=>!/^output\//.test(r.step)).map(r=>[r.step,{v:r.status,c:/^(يطابق|يعيد|يعمل)/.test(r.status)?"#6ee7b7":/^لم/.test(r.status)?"#c4b5fd":"#fca5a5"},
        r.detail&&!/^exit 0$/.test(r.detail)?r.detail:(r.log||[]).slice(-1)[0]||""])),
      {k:"biab1",sub:A.runs.filter(r=>/^output\//.test(r.step)&&/^يطابق/.test(r.status)).length+" من "+A.runs.filter(r=>/^output\//.test(r.step)).length
        +" مخرجات تطابق النسخ المرفوعة في جذر المستودع"}));
    out.push(this.card("المطابقات",this.fsTable("biabc",["الفحص","القيمة","المقابل","الحالة"],
      A.checks.map(c=>[c.check,this.fsC(c.a),this.fsC(c.b),{v:c.ok?"يطابق":"لا يطابق",c:c.ok?"#6ee7b7":"#fca5a5"}])),
      {k:"biab2",sub:ok+"/"+A.checks.length+" · أعمار الديون أعلى من المديونية بـ "+T.egpK(G.difference)+" = "+G.unmapped_customers
        +" عملاء بفواتير غير مرتبطين بمندوب ("+T.egpK(G.unmapped_debt)+") + "+G.credit_customers+" رصيدًا دائنًا لا يظهر في الأعمار ("+T.egpK(-G.credit_balances)+")"}));
    out.push(this.card("المناديب — المديونية والانكشاف",this.fsTable("biabs",["المندوب","عملاء","مبيعات الفترة","مبيعات شهرية","المديونية","شهور انكشاف"],
      A.salespeople.map(r=>[r.salesperson,this.fsC(r.customers),this.fsC(r.period_sales_EGP),this.fsC(r.monthly_sales_EGP),this.fsC(r.outstanding_debt_EGP),
        r.credit_exposure_months?{v:(+r.credit_exposure_months).toFixed(2)}:"—"])),
      {k:"biab3",sub:"الانكشاف = المديونية ÷ المبيعات الشهرية (بلا فائدة) — كما في analyze.py"}));
    const ag=A.aging_totals;
    out.push(this.card("أعمار الديون",[
      this.fsTable("biaba",["0–30 يومًا","31–60","61–90","أكثر من 90","رصيد سابق غير مؤرخ"],
        [[this.fsC(ag.days_0_30_EGP),this.fsC(ag.days_31_60_EGP),this.fsC(ag.days_61_90_EGP),this.fsC(ag.days_over_90_EGP),this.fsC(ag.opening_carryover_undated_EGP)]]),
      this.fsTable("biabat",["العميل","المندوب","0–30","رصيد سابق","الإجمالي"],
        A.aging_top.map(r=>[r.customer,r.salesperson,this.fsC(r.days_0_30_EGP),this.fsC(r.opening_carryover_undated_EGP),this.fsC(r.total_debt_EGP)]))],
      {k:"biab4",sub:"الفواتير غير المسددة بعمرها حتى "+this.opsDmy(A.as_of.aging_ref)+" · ما زاد عن الفواتير المؤرخة «رصيد سابق»"}));
    out.push(this.card("المستحق خلال شهر",this.fsTable("biabd",["العميل","المندوب","فواتير","خلال شهر","متأخر","أول استحقاق","آخر استحقاق"],
      D.top.map(r=>[r.customer,r.salesperson,this.fsC(r.invoices),this.fsC(r.due_within_1_month_EGP),this.fsC(r.overdue_EGP),r.first_due_date,r.last_due_date])),{k:"biab5"}));
    out.push(this.card("أعلى الأصناف مبيعًا ومتوسط سعر البيع",this.fsTable("biabi",["الصنف","الوحدة","الكمية","المبيعات","متوسط السعر","أدنى","أعلى"],
      A.items_top.map(r=>[r.item_name,r.unit,this.fsC(r.total_qty),this.fsC(r.total_sales_EGP),{v:(+r.avg_selling_price_EGP).toFixed(2)},
        {v:(+r.min_price_EGP).toFixed(2)},{v:(+r.max_price_EGP).toFixed(2)}])),{k:"biab6"}));
    out.push(this.card("مكافأة العملاء — شرائح analyze.py",this.fsTable("biabb",["العميل","المندوب","المبيعات","المديونية","النسبة","المكافأة"],
      A.customers_bonus.top.map(r=>[r.customer,r.salesperson,this.fsC(r.total_sales_EGP),this.fsC(r.outstanding_debt_EGP),{v:r.bonus_pct+"%"},this.fsC(r.bonus_amount_EGP)])),
      {k:"biab7",sub:"افتراض الملف: 0% أقل من 5 آلاف · 0.5% · 1% · 1.5% · 2% من 250 ألفًا · إجمالي "+T.egpK(A.customers_bonus.total)}));
    const M=A.model||{};
    if(M.material_cogs) out.push(this.card("نموذج التسعير — يونيو 2026",this.fsTable("biabm",["البند","النموذج","قائمة الدخل"],
      [["تكلفة المواد",this.fsC(M.material_cogs.model),this.fsC(M.material_cogs.statement)],
       ["الربح التشغيلي",this.fsC(M.operating_profit.model),this.fsC(M.operating_profit.statement)]]),
      {k:"biab8",sub:T.int(M.invoices)+" فاتورة · "+T.int(M.skus)+" صنفًا · model/costing_pricing_model.py كما في الملف المضغوط"}));
    return out;
  }

  /* ======================= تاريخ المديونية ومطابقة حركتها (DASH_ARH) ======== */
  /* أرصدة العملاء كما طبعتها تقارير المناديب في ستة تواريخ (ar_history.py): التاريخ المطبوع في
     التقرير، والتقرير الغائب «يحتاج بيانات» لا يُرحَّل ولا يُقدَّر. المطابقة لكل عميل طُبع في
     التاريخين: رصيد أول + فواتير − تحصيلات − مرتجعات (لقطة 3/9) مقابل الرصيد المطبوع آخرًا. */
  biArh(){
    const H=window.DASH_ARH, D=H.meta.dates, full=H.totals.filter(t=>t.complete);
    const f0=full.length?full[0].date:null, f1=full.length?full[full.length-1].date:null;
    const reps=H.reps.map(r=>({rep:r.rep,by:r.by_date,ch:f0&&f1&&r.by_date[f0]&&r.by_date[f1]?r.by_date[f1].net-r.by_date[f0].net:null}));
    const P=H.rollforward.periods, tied=P.reduce((s,p)=>s+p.tied,0), cust=P.reduce((s,p)=>s+p.customers,0);
    return {H,D,full,f0,f1,reps,P,tied,cust};
  }
  biArhBody(X,T,api){
    if(!window.DASH_ARH) return [this.biNeed("biar0","تقارير أرصدة المناديب (ar_history.json) غير مضمنة في هذا الملف.")];
    const Z=this.biArh(), H=Z.H, D=Z.D, out=[], d=x=>this.opsDmy(x), last=H.totals[H.totals.length-1];
    const fl=Z.full[Z.full.length-1], R=H.rollforward;
    out.push(this.kpiTiles([
      ["تواريخ التقارير",T.int(D.length),d(D[0])+" ← "+d(D[D.length-1])+" · "+T.int(H.files.length)+" تقريرًا","#3b82f6"],
      ["آخر تاريخ كامل",fl?T.egpK(fl.net):"—",fl?d(fl.date)+" · كل المناديب ("+H.meta.reps.length+")":"لا تاريخ مكتمل","#ef4444"],
      ["آخر تقرير",T.egpK(last.net),d(last.date)+(last.complete?" · كامل":" · بدون "+last.missing.join("، ")),"#f59e0b"],
      ["عملاء تطابقت حركتهم",T.pct(Z.cust?Z.tied/Z.cust:null),T.int(Z.tied)+" من "+T.int(Z.cust)+" (عميل × فترة) · الفرق ≤ 1 ج.م","#10b981"]],"biark"));
    out.push(this.advNote("biara","كل رقم من تقرير «حسابات العملاء» المطبوع لكل مندوب، بالتاريخ المطبوع فيه (ملفات «23-7» مطبوعة 25/7 و«26-6» مطبوعة 24/6). "
      +"صفوف كل تقرير تساوي إجمالي المدين والدائن والصافي المطبوع فيه. المندوب الذي لم يُطبع تقريره في تاريخ «يحتاج بيانات» — لا يُرحَّل رصيده ولا يُقدَّر، "
      +"وإجمالي الشركة لا يُعطى كاملًا إلا في تاريخ حضرت فيه كل التقارير."));
    out.push(this.card("المديونية بالمندوب — كما طُبعت",this.fsTable("biart",["المندوب"].concat(D.map(d)).concat(Z.f0&&Z.f1&&Z.f0!==Z.f1?["التغير "+d(Z.f0)+" ← "+d(Z.f1)]:[]),
      Z.reps.map(r=>[r.rep].concat(D.map(x=>r.by[x]?this.fsC(r.by[x].net):{v:"يحتاج بيانات",c:"#c4b5fd"}))
        .concat(Z.f0&&Z.f1&&Z.f0!==Z.f1?[this.fsC(r.ch)]:[]))
      .concat([{cells:["الإجمالي"].concat(H.totals.map(t=>t.complete?this.fsC(t.net):{v:this.fsC(t.net).v+" · جزئي",c:"#fcd34d"}))
        .concat(Z.f0&&Z.f1&&Z.f0!==Z.f1?[this.fsC(Z.full[Z.full.length-1].net-Z.full[0].net)]:[]),bold:true}])),
      {k:"biar1",sub:"صافي المدين − الدائن · «جزئي» = ينقصه تقرير مندوب واحد على الأقل"}));
    out.push(this.card("مطابقة حركة المديونية — كل فترتين متتاليتين",this.fsTable("biarr",
      ["الفترة","عملاء مطابقون","رصيد أول","فواتير","تحصيلات","مرتجعات","المتوقع","الرصيد المطبوع","الفجوة","ملاحظة"],
      Z.P.map(p=>{ const t=p.totals;
        return [d(p.from)+" ← "+d(p.to),T.int(p.tied)+"/"+T.int(p.customers),this.fsC(t.opening),this.fsC(t.sales),this.fsC(t.receipts),this.fsC(t.returns),
          this.fsC(t.opening+t.sales-t.receipts-t.returns),this.fsC(t.closing),this.fsC(t.gap),
          {v:[p.after_extract?"الفترة تتجاوز نهاية الفواتير المستخرجة ("+d(p.extract_through)+")":"",
              p.only_on_one_date.opening||p.only_on_one_date.closing?T.int(p.only_on_one_date.opening)+" في الأول فقط · "+T.int(p.only_on_one_date.closing)+" في الثاني فقط":""]
            .filter(Boolean).join(" · ")||"—",c:p.after_extract?"#fcd34d":null}]; })),
      {k:"biar2",sub:"لكل عميل طُبع في التاريخين: رصيد أول + فواتير − تحصيلات − مرتجعات من لقطة "+d(R.as_of)+" (حتى "+d(R.extract_through)+")"}));
    out.push(this.card("أنماط الفجوات — تطابق حسابي لا تفسير",this.fsTable("biarp",["الفترة","النمط","عملاء","الفجوة"],
      [].concat(...Z.P.map(p=>p.patterns.map(x=>[d(p.from)+" ← "+d(p.to),x.pattern,T.int(x.customers),this.fsC(x.gap)])))),
      {k:"biar3",sub:"فجوة تساوي (±1 ج.م) حركة واحدة من حركات الفترة نفسها · السبب (تاريخ ترحيل، تسوية، خصم) لا تبيّنه البيانات"}));
    const st=this.state, keys=Z.P.map(p=>p.from+"|"+p.to), cur=keys.includes(st.biArP)?st.biArP:keys[keys.length-1];
    const P=Z.P[keys.indexOf(cur)];
    out.push(React.createElement("div",{key:"biarl",style:{fontSize:11,color:"#94a3b8"}},"أكبر الفجوات في الفترة:"));
    out.push(this.fsPick("biarpk",Z.P.map((p,i)=>[keys[i],d(p.from)+" ← "+d(p.to)]),cur,"biArP"));
    out.push(this.card("أكبر الفجوات بالعميل — "+d(P.from)+" ← "+d(P.to),this.fsTable("biarg",
      ["الكود","العميل","المندوب","رصيد أول","فواتير","تحصيلات","مرتجعات","الرصيد المطبوع","الفجوة","النمط"],
      P.gaps.map(g=>[g.code,g.name,g.rep,this.fsC(g.opening),this.fsC(g.sales),this.fsC(g.receipts),this.fsC(g.returns),this.fsC(g.closing),this.fsC(g.gap),
        {v:g.pattern||"—",c:/لا تساوي/.test(g.pattern||"")?"#94a3b8":"#fcd34d"}])),
      {k:"biar4",sub:"أعلى "+P.gaps.length+" عميلًا بالقيمة المطلقة · الباقي في التصدير"}));
    const miss=H.reps.filter(r=>Object.values(r.by_date).some(v=>!v));
    out.push(this.opsDecision("biarx",[
      miss.length?{t:"ارفع تقارير أرصدة "+miss.map(r=>r.rep+" ("+Object.keys(r.by_date).filter(k=>!r.by_date[k]).map(d).join("، ")+")").join(" · ")+" لاستكمال إجمالي الشركة.",tag:"v"}:null,
      {t:"راجع مع المحاسب العملاء الذين «لا يتضمن رصيدهم المطبوع فواتير الفترة»: تاريخ ترحيل الفاتورة أو فاتورة لم تُرحَّل لحساب العميل.",tag:"v"},
      Z.P.some(p=>p.after_extract)?{t:"فترة "+Z.P.filter(p=>p.after_extract).map(p=>d(p.from)+" ← "+d(p.to)).join("، ")+" تتجاوز آخر فاتورة مستخرجة ("+d(R.extract_through)
        +"): ارفع فواتير وتحصيلات سبتمبر قبل قراءة فجوتها.",tag:"v"}:null]));
    return out;
  }

  /* ======================= وصفات البانيه والاستربس والصويا (DASH_RCP) ========= */
  /* أوراق الخلطة كما طُبعت (recipes.py) — الدفعة، سعر الكيلو، تكلفة العبوة = الكيلو بإضافاته × الوزن + التغليف.
     العمولة لا تدخل أي تكلفة: مصروف بيعي وتسويقي (قرار الإدارة 27/10/2026)، تُعرض بجانب الهامش لا داخله.
     الصنف المقابل غير مطبوع في الورقة: الربط بقرار الإدارة، وما لم يشمله «يحتاج تأكيد الربط». */
  biRecipesBody(X,T,api){
    const C=window.DASH_RCP;
    if(!C) return [this.biNeed("birc0","أوراق الوصفات (recipes.json) غير مضمنة في هذا الملف.")];
    const out=[], d=x=>this.opsDmy(x), n2=v=>v==null?{v:"—"}:{v:(+v).toFixed(2)}, rate=C.meta.commission_rate||{};
    out.push(this.kpiTiles(C.recipes.map((r,i)=>[r.name,n2(r.per_kg_loaded).v+" ج.م/كجم",
      r.packs.map(p=>p.grams+" جم "+n2(p.cost).v).join(" · ")+(r.date?" · "+d(r.date):""),["#f59e0b","#ef4444","#10b981"][i%3]]),"birck"));
    out.push(this.advNote("birca","كل رقم كما طُبع في ورقة الخلطة، وتحققنا أن الكمية × السعر = الإجمالي لكل بند، وأن البنود تساوي إجمالي الدفعة. "
      +"تكلفة العبوة = سعر الكيلو بإضافاته × الوزن + التغليف. العمولة لا تدخل أي تكلفة: هي مصروف بيعي وتسويقي يُحمَّل على المصروفات البيعية والتسويقية "
      +"(قرار الإدارة 27/10/2026)؛ ما تطبعه الورقة شاملًا العمولة معروض للمرجعية فقط. "
      +"الورقة لا تذكر اسم صنف المبيعات؛ الربط بالأصناف بقرار الإدارة: "+C.meta.decision.note+"."));
    C.recipes.forEach(r=>{
      out.push(this.card(r.name+(r.date?" — "+d(r.date):""),[
        this.fsTable("bircl"+r.key,["البند","الكمية","السعر","الإجمالي","من الدفعة"],
          r.lines.map(l=>[l.name,l.qty==null?"—":{v:String(l.qty)},l.price==null?"—":{v:String(l.price)},this.fsC(l.total),this.fsC(l.share,"pct")])
          .concat([{cells:["إجمالي الدفعة","","",this.fsC(r.total),""],bold:true}])),
        this.fsTable("bircp"+r.key,["الكيلو والعبوة","القيمة"],
          [["سعر الكيلو",n2(r.per_kg)]].concat(r.kg_add.map(a=>[a.name,n2(a.value)]))
          .concat([{cells:["سعر الكيلو بالإضافات",n2(r.per_kg_loaded)],bold:true}])
          .concat([].concat(...r.packs.map(p=>[
            [p.grams+" جرام — "+(p.kilo_used!=null?"قرار الإدارة: "+p.kilo_used+" × "+p.grams/1000:(p.base_printed_as||"الخلطة")),n2(p.base)],
            ["تغليف",n2(p.packaging)],
            {cells:[{v:"تكلفة "+(p.label||p.grams+" جرام")+(p.kilo_used!=null?" — قرار الإدارة 27/10/2026":""),c:p.kilo_used!=null?"#6ee7b7":null},n2(p.cost)],bold:true},
            p.printed_total!=null&&p.printed_commission?[{v:"للمرجعية: الورقة تطبع "+n2(p.printed_total).v+" شاملًا عمولة "+n2(p.printed_commission).v+" — خارج التكلفة",c:"#94a3b8"},"—"]:null]
            .filter(Boolean))))),
        this.advNote("bircy"+r.key,"كمية الإنتاج للدفعة: "+T.int(r.output_kg)+" كجم — "+r.output_kg_basis+".",r.output_kg_basis==="مطبوع"?null:"warn")],
        {k:"birc"+r.key,sub:r.uploaded_as}));
    });
    const ok=x=>x.status===C.meta.decision.status, pc=v=>v==null?{v:"—"}:this.fsC(v,"pct");
    out.push(this.card("ربط الوصفات بأصناف المبيعات وهامش الوصفة",this.fsTable("bircc",
      ["العبوة","الصنف","الكود","الكمية","بونص","سعر البيع","أساس السعر","تكلفة الوصفة","هامش الوصفة","نسبة الهامش",
       "عمولة البيع (مصروف بيعي)","تكلفة النموذج يونيو (مجمل / تشغيلي)","الحالة"],
      [].concat(...C.candidates.map(c=>{ const r=C.recipes.find(x=>x.key===c.recipe);
        return c.items.length?c.items.map(i=>[r.name+" "+c.grams+" جم",i.name,i.code,this.fsC(i.qty),this.fsC(i.bonus_qty),
          n2(ok(i)?i.price:i.avg_price),ok(i)?(i.price_basis===C.meta.price_month?"أغسطس 2026 · "+T.int(i.month_qty)+" وحدة":{v:"كل اللقطة — لا مبيعات في أغسطس",c:"#fcd34d"}):"—",
          n2(c.cost),ok(i)?n2(i.margin):"—",ok(i)?pc(i.margin_pct):"—",
          ok(i)&&i.selling_commission!=null?{v:n2(i.selling_commission).v+" ("+T.pct(rate[c.recipe])+")",c:"#94a3b8"}:"—",
          i.model_cost?{v:(+i.model_cost.gross).toFixed(2)+" / "+(+i.model_cost.op).toFixed(2)}:"—",{v:i.status,c:ok(i)?"#6ee7b7":"#fcd34d"}])
          :[[r.name+" "+c.grams+" جم",{v:"لا صنف بنفس الوزن في المبيعات",c:"#94a3b8"},"—","—","—","—","—",n2(c.cost),"—","—","—","—","—"]]; }))),
      {k:"bircd",sub:C.meta.decision.status+": "+C.meta.decision.note+" · هامش الوصفة = سعر البيع − تكلفة العبوة (تشمل التشغيل وأجور المهندس، ولا تشمل العمولة) · الكمية من لقطة "+d(C.meta.snapshot_as_of)}));
    out.push(this.card("أصناف بلا ورقة وصفة — يحتاج بيانات",this.fsTable("bircn",["الصنف","الكود","الكمية","متوسط سعر البيع","السبب"],
      C.no_sheet.map(i=>[i.name,i.code,this.fsC(i.qty),n2(i.avg_price),{v:i.reason,c:"#c4b5fd"}])),{k:"bircm"}));
    const all=[].concat(...C.candidates.map(c=>c.items)), open_=all.filter(i=>!ok(i));
    const thin=all.filter(i=>ok(i)&&i.margin_pct!=null&&i.margin_pct>=0).sort((a,b)=>a.margin_pct-b.margin_pct);
    const cost=new Map(C.candidates.map(c=>[c.recipe+"|"+c.grams,c.cost]));
    const neg=[].concat(...C.candidates.map(c=>c.items.filter(i=>ok(i)&&i.margin<0).map(i=>({...i,cost:c.cost}))));
    const cmp=[].concat(...C.candidates.map(c=>c.items.filter(i=>i.model_cost).map(i=>({hi:c.cost>i.model_cost.op}))));
    out.push(this.opsDecision("bircx",[
      open_.length?{t:"أكّد الصنف المقابل لـ "+open_.map(i=>i.name).join("، ")+" قبل استعمال تكلفة الوصفة في هامشه.",tag:"v"}:null,
      neg.length?{t:"هامش سالب: "+neg.map(i=>i.name+" يُباع بـ "+n2(i.price).v+" وتكلفته "+n2(i.cost).v).join("، ")+" — راجع سعر بيعه قبل الاستمرار.",tag:"v"}:null,
      thin.length?{t:"أضعف هامش وصفة: "+thin.slice(0,3).map(i=>i.name+" "+this.fsC(i.margin_pct,"pct").v).join("، ")
        +" — ومنه تُدفع عمولة البيع (2.5%) ضمن المصروفات البيعية؛ راجع السعر أو التغليف أو بند التشغيل في الورقة.",tag:"e"}:null,
      C.no_sheet.length?{t:"ارفع أوراق خلطة: "+Array.from(new Set(C.no_sheet.map(i=>i.family+(i.family==="عجينة بقري"?"":" "+i.grams+" جم")))).join("، ")+".",tag:"v"}:null,
      cmp.length&&cost.size?{t:"تكلفة الوصفة أعلى من تكلفة النموذج التشغيلية (يونيو 2026) في "+T.int(cmp.filter(x=>x.hi).length)+" من "+T.int(cmp.length)
        +" أصناف لها تكلفة نموذج — تاريخان مختلفان؛ قارن أسعار الخامات بين التاريخين قبل أي قرار تسعير.",tag:"e"}:null]));
    return out;
  }

  /* ============== قسمان مدمجان (طلب الإدارة 29/10/2026) ============== */
  /* محتوى قسم أصلي داخل قسم مدمج: عنوان، ثم جسم القسم كما هو في حاوية لها مفتاحها (فلا تتصادم
     مفاتيح الأقسام المدمجة: «التكلفة المعيارية» و«دوران المخزون» تستعملان bsdn/bsdc/bsdx معًا)،
     وخطأ في جزء يعرض رسالة مكانه ولا يوقف باقي القسم. */
  biPart(k,title,sub,fn){
    let body;
    try{ body=fn()||[]; }
    catch(e){ body=[this.advNote(k+"-err","تعذّر عرض هذا الجزء ("+String(e&&e.message||e)+"). باقي القسم يعمل كما هو.","warn")]; }
    return React.createElement("div",{key:k,"data-bi-part":title,style:{display:"flex",flexDirection:"column",gap:11}},
      React.createElement("div",{style:{marginTop:6,paddingTop:10,borderTop:"1px solid var(--abh-rgba-255-255-255-14,rgba(255,255,255,.14))",
        fontSize:13,fontWeight:700,color:"var(--abh-e2e8f0,#e2e8f0)"}},title,
        sub?React.createElement("span",{style:{fontSize:10.5,fontWeight:400,color:"#64748b",marginInlineStart:8}},sub):null),
      ...body);
  }

  /* ----- «الإنتاج والتشغيل»: وصفات كل المنتجات بالكميات فقط -----
     التسع من ملف وصفات الإدارة (DASH_BOM ← tools/export_bom.py)، والبانيه والاستربس والصويا من أوراقها
     (DASH_RCP)، والمفروم والكبدة من وصفة الإدارة (DASH_STD.monthly.single). لا سعر هنا: الكيلو والعبوة
     في «التكلفة والمخزون». ثم محتوى «وصفات البانيه والاستربس» كما كان. */
  biProd(){
    const B=window.DASH_BOM, C=window.DASH_RCP, S=window.DASH_STD&&window.DASH_STD.monthly;
    const bom=B?B.recipes:[], sheets=C?C.recipes:[], singles=S?S.single:[];
    const sig=r=>JSON.stringify(r.main.concat(r.sub)), same=[];
    bom.forEach((r,i)=>bom.slice(i+1).forEach(x=>{ if(sig(x)===sig(r)) same.push([r.name,x.name]); }));
    /* «توابيل» في الوصفة الرئيسية هي الخلطة الفرعية نفسها، لا خامة. */
    const ings=new Set([].concat(...bom.map(r=>r.main.concat(r.sub).filter(x=>x.ing!=="توابيل").map(x=>x.ing)),
      ...sheets.map(r=>r.lines.filter(l=>l.qty!=null).map(l=>l.name)),singles.map(r=>r.item)));
    return {bom,sheets,singles,same,ings,basis:B&&B.basis,source:B&&B.source};
  }
  biProdBody(X,T,api){
    const Z=this.biProd(), out=[], q=v=>v==null?{v:"—"}:{v:String(+(+v).toFixed(3))};
    out.push(this.kpiTiles([
      ["منتجات بوصفة كميات",T.int(Z.bom.length+Z.sheets.length+Z.singles.length),
        T.int(Z.bom.length)+" من ملف الإدارة · "+T.int(Z.sheets.length)+" أوراق خلطة · "+T.int(Z.singles.length)+" خامة واحدة","#3b82f6"],
      ["خامات مختلفة",T.int(Z.ings.size),"بأسمائها كما طُبعت","#14b8a6"],
      ["أوزان عبوات",T.int(Z.bom.reduce((a,r)=>a+r.packs.length,0)+Z.sheets.reduce((a,r)=>a+r.packs.length,0)+Z.singles.length),"من أوراق الوصفات","#06b6d4"],
      ["وصفات متطابقة البنود",T.int(Z.same.length),Z.same.length?Z.same.map(p=>p.join(" = ")).join(" · "):"لا تكرار","#f59e0b"]],"bprk"));
    if(!Z.bom.length) out.push(this.biNeed("bpr0","ملف كميات الوصفات التسع (data/raw/cost/recipes_bom.json — tools/export_bom.py) غير مضمن في هذا الملف."));
    out.push(this.advNote("bprn","الكميات فقط كما في أوراق الوصفات — بلا أسعار ولا تكلفة؛ كيلو كل خلطة شهريًا وتكلفة كل صنف تام في «التكلفة والمخزون». "
      +(Z.bom.length?"الوصفات التسع من "+Z.source+": "+Z.basis+". بند «توابيل» في الوصفة الرئيسية هو الخلطة الفرعية المعروضة تحته. ":"")
      +"«من الدفعة» نصيب البند من مجموع كميات الدفعة."));
    if(Z.same.length) out.push(this.advNote("bprs","«"+Z.same.map(p=>p.join("» و«")).join("»، «")
      +"» بنفس البنود والكميات تمامًا في ملف الوصفات، فكيلو خلطتها واحد في كل شهر — أكّد أن هذا مقصود لا نسخ.","warn"));
    Z.bom.forEach((r,i)=>{
      const tot=r.main_total, sp=r.main.filter(x=>x.ing==="توابيل").reduce((a,x)=>a+x.qty,0);
      const spOff=r.sub.length&&Math.abs(sp-r.sub_total)>0.001;
      out.push(this.card(r.name+" — "+r.brand,[
        spOff?this.advNote("bprw"+i,"الوصفة الرئيسية تستعمل "+q(sp).v+" كجم توابيل من خلطة فرعية مجموعها "+q(r.sub_total).v
          +" كجم كما في ملف الوصفات — أكّد أيهما الصحيح أو مصير الفرق.","warn"):null,
        this.fsTable("bprm"+i,["الخامة","الكمية (كجم)","من الدفعة"],
          r.main.map(x=>[x.ing+(x.ing==="توابيل"&&r.sub.length?" (الخلطة الفرعية)":""),q(x.qty),tot?this.fsC(x.qty/tot,"pct"):"—"])
          .concat([{cells:["إجمالي الدفعة",q(tot),""],bold:true},[{v:"أساس الإنتاجية (ناتج الدفعة)",c:"#94a3b8"},q(r.yield_kg),""]])),
        r.sub.length?this.fsTable("bprb"+i,["الخلطة الفرعية: "+(r.sub_name||""),"الكمية (كجم)"],
          r.sub.map(x=>[x.ing,q(x.qty)]).concat([{cells:["إجمالي الخلطة الفرعية",q(r.sub_total)],bold:true}])):null,
        this.advNote("bpry"+i,"العبوات: "+r.packs.map(p=>p.sku+" ("+q(p.kg).v+" كجم)").join(" · ")+(r.yield_note?" · "+r.yield_note:""),
          Math.abs(r.yield_kg-tot)>0.01?"warn":null)].filter(Boolean),{k:"bpr"+i,sub:r.sheet}));
    });
    Z.sheets.forEach(r=>{
      const tot=r.lines.reduce((a,l)=>a+(+l.qty||0),0);
      out.push(this.card(r.name+(r.date?" — "+this.opsDmy(r.date):" — ورقة بلا تاريخ"),[
        this.fsTable("bprr"+r.key,["البند","الكمية كما طُبعت","من الدفعة"],
          r.lines.map(l=>[l.name,l.qty==null?{v:"قيمة بلا كمية",c:"#94a3b8"}:q(l.qty),l.qty==null||!tot?"—":this.fsC(l.qty/tot,"pct")])
          .concat([{cells:["مجموع الكميات المطبوعة",q(tot),""],bold:true},
            [{v:"كمية الإنتاج للدفعة — "+r.output_kg_basis,c:r.output_kg_basis==="مطبوع"?"#94a3b8":"#fcd34d"},q(r.output_kg),""]])),
        this.advNote("bprp"+r.key,"العبوات: "+r.packs.map(p=>p.label||p.grams+" جرام").join(" · ")+" · الورقة لا تطبع وحدة الكمية.")],
        {k:"bprc"+r.key,sub:r.uploaded_as}));
    });
    if(Z.singles.length) out.push(this.card("المفروم والكبدة — خامة واحدة",this.fsTable("bprg",["المنتج","صنف المبيعات","الخامة","الكمية للعبوة (كجم)"],
      Z.singles.map(r=>[r.name,r.item_name_sales,r.item,q(r.kg)])),{k:"bprgc",sub:"وصفة الإدارة كما في المعيار الشهري — الكمية فقط"}));
    out.push(this.biPart("bprx","وصفات البانيه والاستربس","كما كانت في قسمها: الأسعار وتكلفة العبوة وربط الأصناف وهامش الوصفة",
      ()=>this.biRecipesBody(X,T,api)));
    return out;
  }

  /* ----- «التكلفة والمخزون»: «التكلفة المعيارية» + «دوران المخزون والراكد» + «تمرير التكلفة» -----
     يبدأ بجدولين جديدين ثم الأقسام الثلاثة بمحتواها كما هو. حقول DASH_OPS مسماة بأشهر 2026 (kg_jun…kg_sep). */
  biCostMonths(){ return [["2026-06","jun"],["2026-07","jul"],["2026-08","aug"],["2026-09","sep"]]; }
  /* كيلو كل خلطة على مدار الشهور: الوصفات التسع من ملف التقييم، أوراق الخلطة في شهر تاريخها،
     المفروم والكبدة سعر كيلو الخامة. ما لا مصدر له في شهر = null (يُعرض «يحتاج بيانات»). */
  biCostKilo(){
    const O=window.DASH_OPS, C=window.DASH_RCP, S=window.DASH_STD&&window.DASH_STD.monthly, MS=this.biCostMonths(), rows=[];
    const rc=(O&&O.inventory&&O.inventory.recipes)||[];
    const twin=r=>rc.filter(x=>x!==r&&MS.every(([,k])=>x["kg_"+k]===r["kg_"+k])).map(x=>x.product);
    rc.forEach(r=>{ const tw=twin(r);
      rows.push({name:r.product,kind:"وصفة · "+r.brand,by:Object.fromEntries(MS.map(([m,k])=>[m,r["kg_"+k]==null?null:+r["kg_"+k]])),
        basis:"ملف التقييم — خامات مباشرة فقط"+(tw.length?" · نفس قيم «"+tw.join("»، «")+"»":"")}); });
    ((C&&C.recipes)||[]).forEach(r=>{ const m=r.date?r.date.slice(0,7):null;
      rows.push({name:r.name,kind:"ورقة خلطة",by:Object.fromEntries(MS.map(([x])=>[x,x===m?r.per_kg:null])),
        basis:r.date?"ورقة "+this.opsDmy(r.date)+" — إجماليها المطبوع (يشمل بنود التشغيل) ÷ كمية الدفعة"
          :"ورقة بلا تاريخ: "+(+r.per_kg).toFixed(2)+" للكيلو — لا تُنسب لشهر"}); });
    const items=new Map();
    ((S&&S.single)||[]).forEach(r=>{ const o=items.get(r.item)||{r,names:[]}; o.names.push(r.name); items.set(r.item,o); });
    items.forEach(({r,names},item)=>rows.push({name:item,kind:"خامة واحدة",by:Object.fromEntries(MS.map(([m])=>[m,r.by_month[m]?r.by_month[m].price:null])),
      basis:"متوسط آخر الشهر (المعيار الشهري) · "+names.join("، ")}));
    rows.forEach(r=>{ const v=MS.map(([m])=>r.by[m]).filter(x=>x!=null); r.chg=v.length>1?v[v.length-1]/v[0]-1:null; });
    return {rows,months:MS.map(([m])=>m)};
  }
  /* تكلفة كل صنف تام: المعيار للعبوة في كل شهر، والفعلي = تكلفة المبيعات في قائمة الدخل × نصيب الأصناف
     المربوطة من إيراد الفواتير، موزعًا عليها بنسبة تكلفتها المعيارية للكميات المباعة مع البونص (اختيار الإدارة).
       المعيار: شهر له معيار شهري → هو؛ غيره → كيلو الشهر من ملف التقييم × الوزن + الهانك بسعر الملف + التغليف،
       وحيث يختلف كيلو ملف التقييم عن عجينة المعيار الشهري (سجق أبو هاشم) → عجينة أول شهر × تغير الكيلو. «تقدير» في الحالتين.
     التوزيع بالمعيار يعطي كل أصناف الشهر نسبة الانحراف نفسها (f − 1). */
  biCostStd(D){
    const S=window.DASH_STD, Mo=S&&S.monthly, O=window.DASH_OPS, MS=this.biCostMonths();
    if(!S||!Mo||!Mo.months.length) return null;
    const U=r=>r.std!=null?r.std:r.total, file=new Map(S.rows.filter(r=>r.item_code).map(r=>[String(r.item_code),r]));
    const ops=new Map(((O&&O.inventory&&O.inventory.recipes)||[]).map(r=>[r.product,r]));
    const m0=Mo.months[0], k0=(MS.find(x=>x[0]===m0)||[])[1], items=[], have=new Set();
    Mo.rows.forEach(r=>{ const c=String(r.item_code), f=file.get(c), o=ops.get(r.recipe), a=r.by_month[m0], kb=o&&k0?o["kg_"+k0]:null;
      const exact=!!a&&a.paste!=null&&kb!=null&&Math.abs(a.paste/r.kg-kb)<0.01, by={};
      have.add(c);
      MS.forEach(([m,k])=>{ const x=r.by_month[m], km=o?o["kg_"+k]:null;
        if(x&&x.std!=null) by[m]={std:x.std,t:"شهري"};
        else if(km==null||!a||a.paste==null||kb==null) by[m]={std:null,t:"يحتاج بيانات"};
        else by[m]={std:(exact?r.kg*km:a.paste*km/kb)+(a.casing>0?(f&&f.hank_cost!=null?f.hank_cost:a.casing):0)+a.pack,
          t:exact?"تقدير بالكيلو":"تقدير بالنسبة"}; });
      items.push({code:c,key:r.key,recipe:r.recipe,by}); });
    S.rows.filter(r=>r.item_code&&!have.has(String(r.item_code))).forEach(r=>items.push({code:String(r.item_code),key:r.key,recipe:"—",
      by:Object.fromEntries(MS.map(([m])=>[m,{std:U(r),t:"الملف"}]))}));
    Mo.single.forEach(r=>items.push({code:String(r.item_code),key:r.name,recipe:r.recipe,
      by:Object.fromEntries(MS.map(([m])=>[m,r.by_month[m]&&r.by_month[m].std!=null?{std:r.by_month[m].std,t:"شهري"}:{std:r.mgmt,t:"الإدارة"}]))}));
    const idx=new Map(items.map(it=>[it.code,it])), mon=Object.fromEntries(MS.map(([m])=>[m,{month:m,rev:0,covRev:0,stdCogs:0}]));
    (D.lines||[]).forEach(l=>{ const o=mon[l.month]; if(!o) return; const t=+l.line_total||0, q=+l.qty||0, it=idx.get(String(l.item_code));
      o.rev+=t; if(!it) return;
      it.name=it.name||l.item_name; o.covRev+=t;
      const s=it.by[l.month]; s.q=(s.q||0)+q; s.rev=(s.rev||0)+t; if(s.std!=null) o.stdCogs+=q*s.std; });
    const months=MS.map(([m])=>{ const o=mon[m], st=this.biStmt(m), cogs=st&&st.cogs!=null?st.cogs:null;
      const cov=o.rev?o.covRev/o.rev:null, alloc=cogs!=null&&cov!=null?cogs*cov:null, f=alloc!=null&&o.stdCogs?alloc/o.stdCogs:null;
      return {...o,cov,cogs,alloc,f,sold:o.rev>0,measured:this.biMeasured(st)}; });
    const fm=new Map(months.map(r=>[r.month,r.f]));
    items.forEach(it=>{ it.name=it.name||it.key;
      MS.forEach(([m])=>{ const s=it.by[m], f=fm.get(m); s.q=s.q||0; s.rev=s.rev||0;
        s.act=f!=null&&s.q&&s.std!=null?s.std*f:null; s.var=s.act==null?null:s.act-s.std; }); });
    const w=it=>MS.reduce((a,[m])=>a+it.by[m].rev,0);
    items.sort((a,b)=>w(b)-w(a));
    return {items,months,m0,list:MS.map(([m])=>m),ratio:items.filter(it=>MS.some(([m])=>it.by[m].t==="تقدير بالنسبة"))};
  }
  biCostBody(X,T,api){
    const out=[], K=this.biCostKilo(), Z=window.DASH_STD?this.advMemo(api,"biCostStd",(X2,D)=>this.biCostStd(D)):null;
    const r2=x=>x==null?{v:"—"}:{v:(Math.round(x*100)/100).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})};
    const need={v:"يحتاج بيانات",c:"#c4b5fd"}, act=Z?Z.months.filter(r=>r.f!=null):[], last=act[act.length-1];
    const wait=Z?Z.months.filter(r=>r.cogs==null).map(r=>this.fsMon(r.month)):[];
    out.push(this.kpiTiles([
      ["خلطات بكيلو شهري",T.int(K.rows.length),"الوصفات + أوراق الخلطة + المفروم والكبدة","#3b82f6"],
      ["الفعلي ÷ المعيار",last?r2(last.f).v:"—",last?this.fsMon(last.month)+" · المحمَّل ÷ المعيارية":"","#f59e0b"],
      ["تغطية الإيراد",last?T.pct(last.cov):"—",last?"أصناف لها معيار · "+this.fsMon(last.month):"","#06b6d4"],
      ["أشهر تنتظر قائمة الدخل",T.int(wait.length),wait.join("، ")||"—","#a78bfa"]],"bcok"));
    out.push(this.advNote("bcon","«التكلفة المعيارية» و«دوران المخزون والراكد» و«تمرير التكلفة» في قسم واحد بكل محتواها كما كانت (طلب الإدارة 29/10/2026)، "
      +"يبدأ بجدولين: كيلو كل خلطة على مدار الشهور، وتكلفة كل صنف تام بالمعيار مقابل الفعلي. الأقسام الأصلية خارج القائمة، و?nobi في الرابط يعيد الملف كما كان."));
    out.push(this.card("كيلو الخلطة على مدار الشهور",this.fsTable("bcoa",["الخلطة","النوع"].concat(K.months.map(m=>this.fsMon(m)),["التغير","الأساس"]),
      K.rows.map(r=>[r.name,r.kind].concat(K.months.map(m=>r.by[m]==null?need:r2(r.by[m])),
        [r.chg==null?"—":{v:T.pct(r.chg),c:r.chg>0?"#fca5a5":"#6ee7b7"},{v:r.basis,c:"#94a3b8"}]))),
      {k:"bcoA",sub:"ج.م للكيلو · مُتحقَّق من مصدر كل صف · الوصفات بلا تعبئة ولا أجور · التغير من أول شهر له قيمة إلى آخره · الخانة الفارغة «يحتاج بيانات» لا تقدير"}));
    if(!Z) out.push(this.biNeed("bco0","ملف التكلفة المعيارية بمعياره الشهري غير مضمن — لا معيار لتكلفة الأصناف."));
    else {
      out.push(this.card("تكلفة المنتج التام — المعيار مقابل الفعلي بالشهر",[
        this.fsTable("bcob",["الشهر","تكلفة المبيعات (القائمة)","تغطية الإيراد","المحمَّل على الأصناف","المعيارية للكميات","الفعلي ÷ المعيار","الانحراف"],
          Z.months.map(r=>[this.fsMon(r.month),r.cogs==null?need:{v:this.fsC(r.cogs).v+(r.measured?"":" (تقدير)")},
            r.sold?this.fsC(r.cov,"pct"):{v:"لا مبيعات في اللقطة",c:"#94a3b8"},r.alloc==null?"—":this.fsC(r.alloc),
            r.sold?this.fsC(r.stdCogs):"—",r.f==null?"—":r2(r.f),
            r.f==null?"—":{v:T.pct(r.f-1)+" · "+T.egpK(r.alloc-r.stdCogs),c:r.f>1?"#fca5a5":"#6ee7b7"}])),
        wait.length?this.biNeed("bcobn","قائمة دخل "+wait.join(" و")+" لحساب الفعلي؛ المعيار معروض لكل شهر في الجدول التالي."):null].filter(Boolean),
        {k:"bcoB",approx:true,sub:"الفعلي = تكلفة المبيعات في قائمة الدخل × نصيب الأصناف المربوطة من إيراد الفواتير، موزعة عليها بنسبة تكلفتها المعيارية للكميات المباعة مع البونص"}));
      const head=["الصنف","المعيار"];
      Z.months.forEach(r=>{ const n=this.fsMon(r.month); head.push("معيار "+n,"فعلي "+n); if(r.f!=null) head.push("الانحراف "+n); });
      const tags=it=>[...new Set(Z.list.map(m=>it.by[m].t))].join(" · ");
      out.push(this.card("تكلفة المنتج التام لكل صنف — للعبوة",this.fsTable("bcoc",head,
        Z.items.map(it=>{ const row=[it.name,{v:tags(it),c:"#94a3b8"}];
          Z.months.forEach(r=>{ const s=it.by[r.month];
            row.push(s.std==null?need:r2(s.std));
            row.push(r.cogs==null?need:s.act==null?{v:s.q?"—":"لم يُبع",c:"#94a3b8"}:r2(s.act));
            if(r.f!=null) row.push(s.var==null?"—":{v:r2(s.var).v,c:s.var>0?"#fca5a5":"#6ee7b7"}); });
          return row; })),
        {k:"bcoC",approx:true,sub:"«شهري» المعيار الشهري (الوصفة بمتوسط آخر الشهر) · «تقدير بالكيلو» كيلو الشهر من ملف التقييم × الوزن + الهانك بسعر الملف + التغليف · "
          +"«تقدير بالنسبة» عجينة "+this.fsMon(Z.m0)+" × تغير كيلو ملف التقييم · «الإدارة» معيار الإدارة بلا شهر · «الملف» معيار الملف ثابت"}));
      out.push(this.advNote("bcod","التوزيع بالتكلفة المعيارية (اختيار الإدارة) يعطي كل أصناف الشهر نسبة الانحراف نفسها = الفعلي ÷ المعيار − 1؛ الفرق بين الأصناف في الجنيه لا في النسبة. "
        +"لا تكلفة فعلية مستقلة لكل صنف في البيانات، فالفعلي بالصنف تقدير بالتوزيع. تكلفة المبيعات في القائمة تشمل الأجور والأعباء والهالك وفرق المخزون، "
        +"والمعيار خامات وتغليف فقط، فجزء من الانحراف فرق أساس قياس لا هدر. الأصناف بلا معيار ("+(last?T.pct(1-last.cov):"—")
        +" من الإيراد) لا يُحمَّل عليها شيء ولا يُحمَّل نصيبها على غيرها."));
      if(Z.ratio.length) out.push(this.advNote("bcor","كيلو ملف التقييم لـ"+[...new Set(Z.ratio.map(it=>"«"+it.recipe+"»"))].join("، ")
        +" يختلف عن عجينة المعيار الشهري (الهانك منفصل في المعيار)، فمعيار الأشهر الأخرى = عجينة "+this.fsMon(Z.m0)+" × تغير الكيلو — «تقدير بالنسبة».","warn"));
      out.push(this.opsDecision("bcox",[
        wait.length?{t:"ارفع قائمة دخل "+wait.join(" و")+" لحساب الفعلي والانحراف لكل صنف.",tag:"v"}:null,
        last&&last.f>1?{t:"الفعلي أعلى من المعيار "+T.pct(last.f-1)+" في "+this.fsMon(last.month)+": افصل الأجور والأعباء (خارج المعيار) قبل اعتباره هدرًا.",tag:"e"}:null]));
    }
    out.push(this.biPart("bcos","التكلفة المعيارية","كما كانت في قسمها",()=>this.biStdBody(X,T,api)));
    out.push(this.biPart("bcot","دوران المخزون والراكد","كما كان في قسمه",()=>this.biStockBody(X,T,api)));
    out.push(this.biPart("bcop","تمرير التكلفة","كما كان في «قرارات وتشغيل»",()=>this.opsCostPassBody(X,T,api)));
    return out;
  }

  /* ======================= 4) سجل التنبيهات الموحد ========================= */
  /* كل تنبيه: المؤشر، القيمة الفعلية، الحد، الانحراف، السبب المحتمل (مُتحقَّق أو فرضية)،
     الإجراء، المسؤول (دور مقترح)، الحالة، تاريخ آخر تحديث. الحالة تُحفظ في هذا الجهاز فقط. */
  biAlertRows(X,D,f,T){
    const out=[], rules=[], R=D.receivables||{}, asOf=R.as_of||null, F=window.DASH_FS, Bd=window.DASH_BUILD||{};
    const api=this.state.api, M=window.DASH_MARGIN;
    const A=(api&&api.D===D?this.advMemo(api,"alerts",(X2,D2,f2)=>this.advAlerts(X2,D2,f2)):this.advAlerts(X,D,f)).items;
    const map={
      od60:{kpi:"متأخرات أكثر من 60 يومًا",thr:"0",owner:"مدير المبيعات / التحصيل",cause:"فواتير تجاوزت استحقاقها بأكثر من 60 يومًا في لقطة المديونية",ct:"v",
        action:"جدولة تحصيل أسبوعية وإيقاف الائتمان الجديد لهؤلاء العملاء"},
      inactive:{kpi:"عملاء بلا شراء وعليهم رصيد",thr:"45 يومًا بلا شراء",owner:"المندوب المسؤول",ct:"h",
        cause:"فرضية: انتقال العميل لمنافس أو نزاع على رصيد — تحتاج زيارة للتحقق",action:"زيارة خلال أسبوع لتحصيل الرصيد ومعرفة سبب التوقف"},
      rep_drop:{kpi:"انخفاض مبيعات مندوب",thr:"−20% عن الشهر السابق",owner:"مدير المبيعات",ct:"h",
        cause:"فرضية: نقص توريد أو فقد عملاء أو تغيير خط سير — راجع «أداء المندوبين»",action:"مراجعة خط السير والعملاء المفقودين مع المندوب"},
      cust_drop:{kpi:"انخفاض مشتريات كبار العملاء",thr:"−20% لأكبر 20 عميلًا",owner:"مدير المبيعات",ct:"h",
        cause:"فرضية: منافسة سعرية أو مشكلة جودة أو توريد",action:"اتصال مباشر بالعميل خلال 48 ساعة"},
      price:{kpi:"بيع دون 90% من السعر الوسيط",thr:"90% من وسيط الصنف في شهره",owner:"مدير المبيعات",ct:"h",
        cause:"البيع دون الوسيط مُتحقَّق من الفواتير؛ سببه (خصم معتمد أم خطأ تسعير) فرضية",action:"اعتماد مسبق لأي سعر دون الوسيط"},
      zero:{kpi:"فواتير صفرية غير مسجلة كبونص",thr:"0",owner:"المحاسب",ct:"v",cause:"فواتير بقيمة صفر في النظام دون علامة بونص",
        action:"تصحيح نوع الفاتورة في النظام"}};
    A.filter(a=>a.id!=="fs").forEach(a=>{ const m=map[a.id]||{kpi:a.title,thr:"—",owner:"—",cause:"—",ct:"h",action:"—"};
      rules.push({id:"adv_"+a.id,kpi:m.kpi,thr:m.thr,on:a.count>0,src:"التنبيهات الذكية"});
      if(!(a.count>0)) return;
      out.push({id:"adv_"+a.id,kpi:m.kpi,value:(a.value!=null?T.egpK(a.value)+" · ":"")+T.int(a.count)+(a.valueLabel?" ("+a.valueLabel+")":""),
        thr:m.thr,dev:a.value!=null?T.egpK(a.value):T.int(a.count),cause:m.cause,ct:m.ct,action:m.action,owner:m.owner,
        sev:a.severity,updated:asOf,go:a.go,src:"لقطة الفواتير"}); });
    const FA=(F&&F.alerts)||[], TH=(F&&F.alert_thresholds)||{};
    const fthr={margin:TH.gross_margin_drop_pts!=null?"هبوط "+TH.gross_margin_drop_pts+" نقطة":"—",admin:TH.admin_pct_of_sales_max!=null?T.pct(TH.admin_pct_of_sales_max)+" من المبيعات":"—",
      drawings:TH.drawings_pct_of_profit_max!=null?T.pct(TH.drawings_pct_of_profit_max)+" من الربح":"—",dio:TH.dio_days_max!=null?TH.dio_days_max+" يوم":"—",
      recon:TH.sales_recon_pct_max!=null?T.pct(TH.sales_recon_pct_max):"—"};
    const fv=(a)=>a.value==null?"—":a.kind==="margin"?(a.value>0?"+":"−")+Math.abs(a.value).toFixed(1)+" نقطة"
      :Math.abs(a.value)>=1000?T.egpK(a.value):String(a.value);
    FA.forEach((a,i)=>{ out.push({id:"fs_"+a.month+"_"+a.kind+"_"+i,kpi:a.problem,value:fv(a),thr:fthr[a.kind]||"—",
      dev:fv(a),cause:"السبب غير محدد في المصدر — يحتاج مراجعة المسؤول",ct:"h",action:a.action||"—",
      owner:a.owner||"—",sev:a.severity,updated:a.month?this.opsMonEnd(a.month):F.meta.as_of,go:"fs_exec",src:"القوائم المالية 2025"}); });
    if(F) rules.push({id:"fs",kpi:"تنبيهات القوائم المالية 2025 ("+FA.length+")",thr:"حدود القوائم",on:FA.length>0,src:"القوائم المالية"});
    /* قواعد جديدة على بيانات 2026 المضمنة. */
    const [m0,m1]=this.biLastTwo(), a=this.biStmt(m0), b=this.biStmt(m1), dPts=TH.gross_margin_drop_pts;
    if(a&&b&&dPts!=null){ const g0=a.gross_profit/a.net_sales*100, g1=b.gross_profit/b.net_sales*100, on=g0-g1>dPts;
      rules.push({id:"bi_gm",kpi:"هبوط هامش مجمل الربح (2026)",thr:"هبوط "+dPts+" نقطة",on,src:"قوائم الدخل الشهرية"});
      if(on) out.push({id:"bi_gm_"+m1,kpi:"هامش مجمل الربح "+this.fsMon(m1),value:g1.toFixed(1)+"% (كان "+g0.toFixed(1)+"%)",thr:"هبوط "+dPts+" نقطة",
        dev:"−"+(g0-g1).toFixed(1)+" نقطة",cause:"فرضية: ارتفاع تكلفة الخامات دون تمريرها للسعر أو تغير مزيج الأصناف — راجع «جسر الربح»",ct:"h",
        action:"تحليل السعر والكمية والتكلفة لـ"+this.fsMon(m1)+" ومراجعة أسعار البيع",owner:"مدير المصنع / المشتريات",
        sev:"high",updated:this.opsMonEnd(m1),go:"bi_bridge",src:"قوائم الدخل الشهرية"}); }
    const bk=R.buckets||{}, old=(bk.d91_120||0)+(bk.d120p||0), share=R.total_outstanding?old/R.total_outstanding:null, thr90=0.05;
    if(share!=null){ const on=share>thr90;
      rules.push({id:"bi_ar90",kpi:"مديونية متأخرة أكثر من 90 يومًا",thr:T.pct(thr90)+" من الرصيد (حد مقترح — افتراض)",on,src:"لقطة المديونية"});
      if(on) out.push({id:"bi_ar90",kpi:"مديونية متأخرة أكثر من 90 يومًا",value:T.egpK(old)+" · "+T.pct(share),thr:T.pct(thr90)+" (افتراض)",
        dev:T.pct(share-thr90),cause:"أرصدة قديمة في شرائح أعمار المديونية",ct:"v",action:"تصنيف كل رصيد: قابل للتحصيل أم مخصص ديون مشكوك فيها",
        owner:"المحاسب / مدير التحصيل",sev:"high",updated:asOf,go:"aging",src:"لقطة المديونية"}); }
    if(window.DASH_OPS){
      const V=this.biStock(), dv=V.dead.reduce((s,r)=>s+r.value,0);
      rules.push({id:"bi_dead",kpi:"خامات راكدة",thr:"0",on:V.dead.length>0,src:"جرود المخزون"});
      if(V.dead.length) out.push({id:"bi_dead",kpi:"خامات راكدة بلا حركة",value:T.egpK(dv)+" · "+V.dead.length+" صنف",thr:"0",dev:T.egpK(dv),
        cause:"الرصيد نفسه في كل جرد من "+this.opsDmy(V.firstDate)+" ولا مشتريات",ct:"v",action:"فحص الصلاحية واستعمالها أو إيقاف شرائها",
        owner:"مدير المخزن / المشتريات",sev:"medium",updated:V.lastDate,go:"bi_cost",src:"جرود المخزون"});
      rules.push({id:"bi_unpriced",kpi:"أصناف برصيد بلا متوسط تكلفة",thr:"0",on:V.unpriced.length>0,src:"جرود المخزون"});
      if(V.unpriced.length) out.push({id:"bi_unpriced",kpi:"أصناف برصيد بلا متوسط تكلفة",value:T.int(V.unpriced.length)+" صنف",thr:"0",dev:T.int(V.unpriced.length),
        cause:"لا سعر شراء لها في نموذج المتوسط المرجح، فقيمتها صفر في الجرد",ct:"v",action:"إدخال سعر الشراء الفعلي في نموذج الشهر",
        owner:"المحاسب",sev:"medium",updated:V.lastDate,go:"bi_cost",src:"جرود المخزون"});
      const Pu=this.opsPurchases(), sp=0.15, wide=Pu.items.filter(o=>o.spread!=null&&o.spread>sp), gap=wide.reduce((s,o)=>s+o.gap,0);
      rules.push({id:"bi_pspread",kpi:"تذبذب سعر شراء الصنف",thr:T.pct(sp)+" بين أعلى وأقل سعر (حد مقترح — افتراض)",on:wide.length>0,src:"المشتريات"});
      if(wide.length) out.push({id:"bi_pspread",kpi:"تذبذب سعر شراء الصنف",value:wide.length+" صنف · فوق أقل سعر "+T.egpK(gap),
        thr:T.pct(sp)+" (افتراض)",dev:T.egpK(gap),cause:"فرضية: مورد مختلف أو تغير سعر السوق أو خطأ إدخال — راجع «المشتريات والموردون»",ct:"h",
        action:"توحيد المورد أو التفاوض على سعر ثابت للأصناف الأعلى إنفاقًا",owner:"المشتريات",sev:"medium",
        updated:Bd.purchases_through?this.opsMonEnd(Bd.purchases_through):null,go:"ops_purchases",src:"المشتريات"});
    }
    if(window.DASH_STD){
      const Z=this.biStd(D), under=Z.sku.filter(r=>r.std_margin!=null&&r.std_margin<0);
      rules.push({id:"bi_std",kpi:"بيع دون التكلفة المعيارية",thr:"سعر البيع < معيار العبوة",on:under.length>0,src:"التكلفة المعيارية"});
      if(under.length) out.push({id:"bi_std",kpi:"بيع دون التكلفة المعيارية ("+this.fsMon(Z.skuMonth)+")",
        value:under.length+" صنف · "+under.map(r=>r.name).join("، "),thr:"0%",dev:"أدنى هامش "+T.pct(Math.min(...under.map(r=>r.std_margin))),
        cause:"متوسط سعر البيع في الفواتير أقل من معيار الخلطة والتغليف",ct:"v",action:"رفع السعر أو إيقاف الخصم على الصنف",owner:"مدير المبيعات",
        sev:"high",updated:this.opsMonEnd(Z.skuMonth),go:"bi_cost",src:"التكلفة المعيارية"});
    }
    const PG=(M&&M.pricing_gap)||[], below=PG.filter(p=>p.gap_pct>0);
    rules.push({id:"bi_floor",kpi:"أصناف تُباع دون سعر الأرضية",thr:"0",on:below.length>0,src:"ربحية الأصناف"});
    if(below.length) out.push({id:"bi_floor",kpi:"أصناف تُباع دون سعر الأرضية",value:below.length+" صنف",thr:"0",dev:below.length+" صنف",
      cause:"متوسط سعر يونيو أقل من سعر الأرضية المحسوب من تكلفة الصنف (تقدير)",ct:"v",action:"مراجعة سعر الأصناف المدرجة في «الربحية»",
      owner:"مدير المبيعات",sev:"medium",updated:(M.meta&&M.meta.cost_month)?this.opsMonEnd(M.meta.cost_month):null,go:"r:margin",src:"ربحية الأصناف"});
    const rank={high:0,medium:1,low:2};
    out.sort((x,y)=>(x.sev in rank?rank[x.sev]:3)-(y.sev in rank?rank[y.sev]:3));
    return {rows:out,rules};
  }
  biAlertStore(){
    if(this.__biSt) return this.__biSt;
    let v={}; try{ v=JSON.parse(localStorage.getItem("abh.bi.alertStatus")||"{}")||{}; }catch(e){ v={}; }
    return this.__biSt=v;
  }
  biAlertState(id){ return this.biAlertStore()[id]||{s:"جديد",t:null}; }
  biSetAlert(id,s){
    const v={...this.biAlertStore(),[id]:{s,t:new Date().toISOString().slice(0,10)}};
    this.__biSt=v; try{ localStorage.setItem("abh.bi.alertStatus",JSON.stringify(v)); }catch(e){}
    this.setState({biTick:(this.state.biTick||0)+1});
  }
  biAlertsBody(X,T,api){
    const D=api.D, A=this.biAlertRows(X,D,this.state.filters||{},T), out=[];
    const col=s=>s==="high"?"#ef4444":s==="medium"?"#f59e0b":"#10b981", ar=s=>s==="high"?"عالية":s==="medium"?"متوسطة":"منخفضة";
    const open=A.rows.filter(r=>this.biAlertState(r.id).s!=="مغلق");
    out.push(this.kpiTiles([
      ["تنبيهات مفتوحة",T.int(open.length),"من "+T.int(A.rows.length),"#ef4444"],
      ["عالية الأولوية",T.int(open.filter(r=>r.sev==="high").length),"","#f97316"],
      ["قيد المعالجة",T.int(A.rows.filter(r=>this.biAlertState(r.id).s==="قيد المعالجة").length),"","#f59e0b"],
      ["قواعد مفعّلة",T.int(A.rules.filter(r=>r.on).length),"من "+T.int(A.rules.length)+" قاعدة","#3b82f6"]],"bak"));
    out.push(this.advNote("ban","الحالة وتاريخ تحديثها يُحفظان على هذا الجهاز فقط (لا خادم ولا سجل مشترك). المسؤول دور مقترح لا اسم شخص. "
      +"وسم السبب: «مُتحقَّق» = واقعة في البيانات، «فرضية» = تفسير محتمل يحتاج تحققًا قبل القرار."));
    const field=(l,v,k)=>React.createElement("div",{key:k,style:{display:"flex",gap:7,fontSize:11,lineHeight:1.8}},
      React.createElement("span",{style:{flex:"none",width:78,color:"#64748b"}},l),
      React.createElement("span",{style:{flex:1,minWidth:0,color:"#cbd5e1"}},v));
    out.push(A.rows.length?React.createElement("div",{key:"bal","data-bi-register":"",style:{display:"flex",flexDirection:"column",gap:8}},
      A.rows.map(r=>{ const S=this.biAlertState(r.id);
        return React.createElement("div",{key:r.id,"data-bi-alert":r.id,style:{padding:"9px 11px",borderRadius:12,background:"rgba(255,255,255,.02)",
            border:"1px solid rgba(255,255,255,.07)",borderInlineStart:"3px solid "+col(r.sev),display:"flex",flexDirection:"column",gap:3,
            opacity:S.s==="مغلق"?.55:1}},
          React.createElement("div",{key:"h",style:{display:"flex",alignItems:"baseline",gap:7}},
            React.createElement("span",{style:{flex:1,minWidth:0,fontSize:12,fontWeight:700,color:"#e2e8f0",lineHeight:1.6}},r.kpi),
            React.createElement("span",{style:{flex:"none",fontSize:9,padding:"2px 7px",borderRadius:99,background:col(r.sev)+"22",
              color:col(r.sev),whiteSpace:"nowrap"}},"أولوية "+ar(r.sev))),
          field("القيمة الفعلية",r.value,"v"), field("الحد",r.thr,"t"), field("الانحراف",r.dev,"d"),
          field("السبب المحتمل",React.createElement("span",null,this.advBadge(r.ct==="v"?"مُتحقَّق":"فرضية",r.ct==="v"?"#10b981":"#a78bfa")," ",r.cause),"c"),
          field("الإجراء",r.action,"a"), field("المسؤول",r.owner,"o"),
          field("المصدر",r.src+(r.updated?" · حتى "+this.opsDmy(r.updated):""),"s"),
          React.createElement("div",{key:"st",style:{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap",marginTop:3}},
            ["جديد","قيد المعالجة","مغلق"].map(s=>React.createElement("span",{key:s,"data-bi-status":s,onClick:()=>this.biSetAlert(r.id,s),
              style:{fontSize:10.5,padding:"4px 10px",borderRadius:99,cursor:"pointer",
                background:S.s===s?"rgba(59,130,246,.18)":"rgba(255,255,255,.03)",
                border:"1px solid "+(S.s===s?"rgba(59,130,246,.45)":"rgba(255,255,255,.08)"),color:S.s===s?"#93c5fd":"#94a3b8"}},s)),
            React.createElement("span",{key:"t",style:{fontSize:10,color:"#64748b"}},S.t?"آخر تحديث للحالة "+this.opsDmy(S.t):"لم تُحدَّث الحالة"),
            r.go?this.advLink("g","التفاصيل",r.go):null)); }))
      :this.empty("لا تنبيه مفعّل في هذه اللقطة والفلاتر."));
    out.push(this.card("القواعد وحدودها",this.fsTable("bar",["القاعدة","الحد","الحالة","البيانات"],
      A.rules.map(r=>[r.kpi,r.thr,{v:r.on?"مفعّلة":"لا تنبيه",c:r.on?"#fca5a5":"#6ee7b7"},r.src])),{k:"ba2"}));
    return out;
  }

  /* ======================= 5) قاموس المؤشرات وجاهزية البيانات ============== */
  biKpiRows(D,T){
    const out=[], [, m1]=this.biLastTwo(), s=this.biStmt(m1), R=D.receivables||{}, ok=b=>b?"ناجح":"فشل";
    const near=(x,y)=>Math.abs((x||0)-(y||0))<1;
    if(s){
      const cats=this.biCats().reduce((a,[k])=>a+((s.categories||{})[k]||0),0);
      const item=((window.DASH_MARGIN.by_item_month)||[]).filter(r=>r.month===m1).reduce((a,r)=>a+r.revenue,0);
      const st=this.biMeasured(s)?"مُتحقَّق":"تقدير", per=this.fsMon(m1), src="قائمة الدخل "+per;
      out.push(
        {kpi:"صافي المبيعات",value:T.egpK(s.net_sales),unit:"ج.م",formula:"كما في قائمة الدخل",source:src,period:"شهري",as_of:this.opsMonEnd(m1),
          check:"تغطية ربحية الأصناف "+T.pct(item/s.net_sales),status:st},
        {kpi:"مجمل الربح",value:T.egpK(s.gross_profit),unit:"ج.م",formula:"صافي المبيعات − تكلفة المبيعات",source:src,period:"شهري",as_of:this.opsMonEnd(m1),
          check:ok(near(s.gross_profit,s.net_sales-s.cogs))+": المجمل = المبيعات − التكلفة",status:st},
        {kpi:"هامش مجمل الربح",value:T.pct(s.gross_profit/s.net_sales),unit:"%",formula:"مجمل الربح ÷ صافي المبيعات",source:src,period:"شهري",
          as_of:this.opsMonEnd(m1),check:"—",status:st},
        {kpi:"إجمالي المصروفات",value:T.egpK(s.total_expenses),unit:"ج.م",formula:"تشغيل + إدارية + بيعية + تمويلية",source:src,period:"شهري",
          as_of:this.opsMonEnd(m1),check:ok(near(cats,s.total_expenses))+": مجموع الفئات = الإجمالي",status:st},
        {kpi:"صافي الربح",value:T.egpK(s.net_profit),unit:"ج.م",formula:"مجمل الربح − إجمالي المصروفات",source:src,period:"شهري",as_of:this.opsMonEnd(m1),
          check:ok(near(s.net_profit,s.gross_profit-s.total_expenses))+": الصافي = المجمل − المصروفات",status:st},
        {kpi:"مبيعات التعادل",value:T.egpK(s.total_expenses/((s.net_sales-s.cogs)/s.net_sales)),unit:"ج.م",
          formula:"المصروفات ÷ نسبة المساهمة (التكلفة متغيرة والمصروفات ثابتة)",source:src,period:"شهري",as_of:this.opsMonEnd(m1),check:"—",status:"افتراض"});
    }
    const rs=(R.rows||[]).reduce((a,r)=>a+(r.outstanding||0),0), bs=Object.values(R.buckets||{}).reduce((a,v)=>a+v,0);
    out.push(
      {kpi:"إجمالي المديونية",value:T.egpK(R.total_outstanding||0),unit:"ج.م",formula:"مجموع أرصدة العملاء",source:"لقطة المديونية",period:"لحظي",
        as_of:R.as_of,check:ok(near(rs,R.total_outstanding))+": مجموع العملاء = الإجمالي",status:"مُتحقَّق"},
      {kpi:"نسبة المتأخر",value:T.pct(R.total_outstanding?(R.total_overdue||0)/R.total_outstanding:0),unit:"%",formula:"المتأخر ÷ إجمالي الرصيد",
        source:"لقطة المديونية",period:"لحظي",as_of:R.as_of,check:ok(near(bs,R.total_outstanding))+": مجموع شرائح الأعمار = الإجمالي",status:"مُتحقَّق"});
    if(window.DASH_OPS){
      const V=this.biStock(), lv=V.vals[V.vals.length-1], rc=V.recon[V.recon.length-1], dLast=V.dio.filter(r=>r.dio!=null).pop();
      const S=window.DASH_OPS.suppliers;
      out.push(
        {kpi:"المخزون (آخر تقييم)",value:T.egpK(lv.total),unit:"ج.م",formula:"خامات بمتوسط التكلفة + منتج تام بتكلفة الوصفة",source:"نموذج متوسط التكلفة",
          period:"شهري",as_of:lv.date,check:rc.diff==null?"لا إجمالي مطبوع":ok(Math.abs(rc.diff)<1)+": المحسوب = المطبوع",status:"مُتحقَّق"},
        {kpi:"أيام المخزون",value:dLast?Math.round(dLast.dio)+" يوم ("+this.fsMon(dLast.month)+")":"—",unit:"يوم",
          formula:"متوسط المخزون ÷ تكلفة مبيعات الشهر × أيامه",source:"التقييمات + قوائم الدخل",period:"شهري",as_of:dLast?dLast.date:null,
          check:V.dio.some(r=>r.cogs==null)?"ينقص "+V.dio.filter(r=>r.cogs==null).map(r=>this.fsMon(r.month)).join("، "):"—",
          status:dLast?"تقدير":"يحتاج بيانات"},
        {kpi:"خامات راكدة",value:T.egpK(V.dead.reduce((a,r)=>a+r.value,0)),unit:"ج.م",formula:"رصيد ثابت في كل الجرود ولا مشتريات",source:"جرود المخزون",
          period:"منذ أول جرد مسعّر",as_of:V.lastDate,check:"—",status:"مُتحقَّق"},
        {kpi:"صافي أرصدة الموردين",value:T.egpK(S.net_credit),unit:"ج.م",formula:"الدائن − المدين",source:"كشف أرصدة الموردين",period:"لحظي",
          as_of:S.as_of,check:S.total_printed==null?"—":ok(near(S.net_credit,S.total_printed))+": المحسوب = المطبوع",status:"مُتحقَّق"});
    }
    if(window.DASH_STD){
      const Z=this.biStd(D), last=Z.months.filter(r=>r.var!=null).pop();
      out.push({kpi:"انحراف التكلفة المعيارية",value:last?T.egpK(last.var)+" ("+this.fsMon(last.month)+")":"—",unit:"ج.م",
        formula:"(تكلفة المبيعات ÷ المبيعات في القائمة − التكلفة المعيارية ÷ إيراد الأصناف المربوطة) × صافي المبيعات",
        source:"سعر انتاج تام + الفواتير + قوائم الدخل 2026",period:"شهري",as_of:last?this.opsMonEnd(last.month):null,
        check:last?"تغطية الأصناف المربوطة "+T.pct(last.cov):"—",status:last?"تقدير":"يحتاج بيانات"});
    }
    out.push(
      {kpi:"الفعلي مقابل الموازنة",value:"—",unit:"ج.م",formula:"الفعلي − الموازنة لكل بند",source:"data/budget/budget_2026.csv",period:"شهري",as_of:null,
        check:"لا موازنة محمّلة",status:"يحتاج بيانات"},
      {kpi:"التدفق النقدي المتوقع (13 أسبوعًا)",value:"—",unit:"ج.م",formula:"تحصيل متوقع − مدفوعات موردين − أقساط − مصروفات",source:"—",period:"أسبوعي",
        as_of:null,check:"لا شروط قروض ولا أرصدة بنوك أسبوعية",status:"يحتاج بيانات"});
    return out;
  }
  biReadiness(){
    return [
      {module:"الإنتاج: الإنتاجية والهالك والجودة وتتبع التشغيلات",need:"أوامر التشغيل: الخامات الصادرة، الناتج بالكجم، الهالك، رقم التشغيلة وتاريخها",owner:"المصنع",status:"يحتاج بيانات"},
      {module:"الموازنة مقابل الفعلي والتوقعات",need:"data/budget/budget_2026.csv (القالب موجود في المستودع)",owner:"المحاسب / الإدارة",status:"يحتاج بيانات"},
      {module:"حدود الائتمان",need:"حد ائتمان معتمد لكل عميل",owner:"الإدارة / مدير المبيعات",status:"يحتاج بيانات"},
      {module:"توقع التحصيل والتدفق النقدي 13 أسبوعًا",need:"جدول أقساط القروض وشروطها، أرصدة البنوك أسبوعيًا، شروط سداد الموردين",owner:"المحاسب",status:"يحتاج بيانات"},
      window.DASH_STD?{module:"التكلفة المعيارية — الأصناف غير المربوطة",need:(window.DASH_STD.unmatched.length+window.DASH_STD.unresolved.length)
        +" صف في «سعر انتاج تام» لا يقابله صنف مبيعات (حجم عبوة مختلف أو صنف غير مبيع) — تأكيد الصنف المقابل لكل منها",owner:"الإدارة",status:"يحتاج تأكيدًا"}
        :{module:"التكلفة المعيارية وانحرافاتها",need:"تكلفة معيارية معتمدة لكل وصفة",owner:"الإدارة",status:"يحتاج بيانات"},
      {module:"دقة الجرد (دفتري مقابل فعلي)",need:"الرصيد الدفتري من النظام لكل صنف في تاريخ كل جرد",owner:"المخزن",status:"يحتاج بيانات"},
      {module:"عمر المخزون وتواريخ الصلاحية",need:"تاريخ الاستلام والصلاحية لكل دفعة",owner:"المخزن",status:"يحتاج بيانات"},
      {module:"قوائم الدخل بعد "+(this.biStmts().slice(-1)[0]?this.fsMon(this.biStmts().slice(-1)[0].period):"—")+" والميزانية بعد "
        +(window.DASH_FS?this.opsDmy(window.DASH_FS.meta.as_of):"—"),need:"income_statement.pdf لكل شهر (القائمة الشهرية للاستلام) وميزانية حديثة",owner:"المحاسب",status:"يحتاج بيانات"},
      {module:"الصلاحيات وسجل التدقيق المشترك",need:"خادم وتسجيل دخول — الملف الحالي ثابت يفتح على الهاتف بلا خادم",owner:"قرار الإدارة (المرحلة 4)",status:"يحتاج قرارًا"}];
  }
  biKpisBody(X,T,api){
    const K=this.biKpiRows(api.D,T), out=[];
    out.push(this.advNote("bkn","لكل مؤشر مصدره ومعادلته وتاريخه وفحص آلي يعاد عند كل فتح للملف. «فشل» في الفحص يعني أن الرقم لا يطابق مكوناته في المصدر نفسه."));
    out.push(this.card("قاموس المؤشرات",this.fsTable("bkt",["المؤشر","القيمة","المعادلة","المصدر","حتى","الفحص","الأساس"],
      K.map(r=>[r.kpi,r.value,r.formula,r.source,r.as_of?this.opsDmy(r.as_of):"—",
        {v:r.check,c:/^فشل/.test(r.check)?"#fca5a5":/^ناجح/.test(r.check)?"#6ee7b7":null},
        {v:r.status,c:{"مُتحقَّق":"#6ee7b7","تقدير":"#fcd34d","افتراض":"#c4b5fd","يحتاج بيانات":"#94a3b8"}[r.status]}])),{k:"bk1"}));
    out.push(this.card("ما لا يمكن بناؤه بالبيانات الحالية",this.fsTable("bkr",["الوحدة","المطلوب","من","الحالة"],
      this.biReadiness().map(r=>[r.module,r.need,r.owner,{v:r.status,c:"#c4b5fd"}])),
      {k:"bk2",sub:"لا يُعرض تقدير مكان أي من هذه الوحدات"}));
    return out;
  }

  /* ======================= 10) دليل اللوحة ================================ */
  /* الأقسام كلها في سبع مجموعات وظيفية (خطة تنظيم اللوحة، 27/10/2026). التنقل الأصلي لا يتغير:
     الدليل قسم مضاف، والانتقال منه بـ go() إلى القسم نفسه في مكانه.
     لكل قسم: [المجموعة، نطاق الفلاتر، مجال تاريخ البيانات]. نطاق الفلاتر مقيس لا مفترض:
     tests/test_browser_bi.py::test_map_filter_scope يطبّق فلتر المندوب والشهر (وفلاتر «التحليل»)
     ويتحقق أن كل قسم يتغير أو لا يتغير كما هو مكتوب هنا، ويفشل إن ظهر قسم لا مكان له في الدليل. */
  biMapDef(){
    const groups=[
      ["الملخص التنفيذي","أهم المؤشرات والتنبيهات في شاشة"],
      ["التحليل التجاري والمبيعات","المبيعات والعملاء والأصناف والمندوبون والمرتجعات"],
      ["التحليل المالي والربحية","القوائم المالية والربحية والمصروفات ورأس المال العامل"],
      ["المخزون والتكلفة","المخزون والمشتريات والتكلفة المعيارية والوصفات"],
      ["التشغيل والإنتاج","الإنتاجية والهالك وتتبع التشغيلات"],
      ["العملاء والتحصيل والمخاطر","المديونية وأعمارها والتحصيل والتنبيهات على المخاطر"],
      ["التقارير والتفاصيل الأصلية","جداول التصدير وجودة البيانات وقاموس المؤشرات"]];
    const keys={
      bi_exec:[0,"rm","mix"], overview:[0,"rm","inv"], fs_exec:[0,"-","fs"], bi_alerts:[0,"rm","mix"],
      sales:[1,"rm","inv"], customers:[1,"rm","inv"], products:[1,"rm","inv"], bonus:[1,"rm","inv"],
      "r:sales":[1,"rf0","agg"], "r:customers":[1,"rf","agg"], "r:brands":[1,"rf","agg"], "r:products":[1,"rf","agg"],
      "r:analysis":[1,"rf","agg"], "r:forecast":[1,"rf-","agg"],
      adv_abc:[1,"rm","inv"], adv_season:[1,"rm","inv"], adv_basket:[1,"rm","inv"], adv_cohort:[1,"rm","inv"],
      dec_rfm:[1,"rm","inv"], dec_reps:[1,"-","inv"], dec_leakage:[1,"rm","inv"], dec_returns:[1,"-","inv"],
      fs_position:[2,"-","fs"], fs_income:[2,"-","pl"], fs_wc:[2,"-","fs"], "r:fin":[2,"rf-","agg"],
      "r:margin":[2,"rf-","agg"], "r:expenses":[2,"rf-","agg"], bi_bridge:[2,"-","pl"], ops_wc:[2,"-","ops"],
      dec_whatif:[2,"-","pl"], dec_valuation:[2,"-","fs"],
      ops_inventory:[3,"-","ops"], ops_purchases:[3,"-","pur"], ops_costpass:[3,"-","pur"], bi_stock:[3,"-","ops"],
      bi_std:[3,"-","std"], bi_recipes:[3,"-","rcp"], bi_cost:[3,"-","std"], bi_prod:[4,"-","rcp"],
      receivables:[5,"r","inv"], overdue:[5,"r","inv"], aging:[5,"r","inv"], armove:[5,"-","inv"], collections:[5,"m","inv"],
      "r:debt":[5,"rf","agg"], bi_arh:[5,"-","arh"], adv_alerts:[5,"rm","inv"],
      "r:reports":[6,"mix","mix"], analytics:[6,"rm","inv"], quality:[6,"rm","inv"], snapdetail:[6,"m","inv"],
      "r:quality":[6,"rf-","agg"], dq_clean:[6,"-","inv"], fs_quality:[6,"-","fs"], bi_kpis:[6,"-","mix"], bi_abm:[6,"-","abm"]};
    const filt={
      rm:["الشهر ✓ · المندوب ✓","#10b981"], r:["المندوب ✓ · الشهر ✗ (رصيد في تاريخ)","#f59e0b"],
      m:["الشهر ✓ · المندوب ✗","#f59e0b"], "-":["لا تنطبق فلاتر الفواتير","#64748b"],
      rf:["فلاتر «التحليل» ✓ (لا فلاتر الفواتير)","#3b82f6"], "rf-":["لا تنطبق — أرقام محسوبة مسبقًا للشركة","#64748b"],
      rf0:["لا تنطبق أي فلاتر","#64748b"], mix:["كل جدول حسب قسمه","#a78bfa"]};
    return {groups,keys,filt};
  }
  /* مصدر بيانات القسم وتاريخها، من التواريخ المضمنة نفسها (لا تاريخ يُكتب باليد). */
  biMapDate(d,Fr){
    const st=this.state, Bd=window.DASH_BUILD||{}, F=window.DASH_FS, fr=id=>Fr.rows.find(r=>r.id===id)||{};
    if(d==="inv") return {src:fr("sales").source,as_of:fr("sales").as_of};
    if(d==="agg"){ const P=st.RD&&st.RD.financial&&st.RD.financial.period;
      return {src:"التجميعات الشهرية"+(P?" "+P.start+" – "+P.end:""),as_of:P?P.end:null}; }
    if(d==="fs") return {src:"الميزانية العمومية — DASH_FS",as_of:F&&F.meta&&F.meta.as_of||null};
    if(d==="pl") return {src:fr("pl").source,as_of:fr("pl").as_of};
    if(d==="ops") return {src:fr("inv").source,as_of:Bd.inventory_as_of||null};
    if(d==="pur") return {src:fr("pur").source,as_of:fr("pur").as_of};
    if(d==="std"){ const M=window.DASH_STD&&window.DASH_STD.monthly, ms=M&&M.months||[], m=ms[ms.length-1];
      return {src:"«سعر انتاج تام»"+(m?" + المعيار الشهري":""),as_of:m?this.opsMonEnd(m):null}; }
    if(d==="arh"){ const ds=window.DASH_ARH&&window.DASH_ARH.meta.dates||[];
      return {src:"تقارير أرصدة المناديب",as_of:ds[ds.length-1]||null}; }
    if(d==="rcp") return {src:"أوراق الوصفات",as_of:window.DASH_RCP&&window.DASH_RCP.meta.as_of||null};
    if(d==="abm") return {src:"Abohashem-main — لقطة",as_of:window.DASH_ABM&&window.DASH_ABM.as_of&&window.DASH_ABM.as_of.debt_as_of||null};
    return {src:"عدة مجالات — لكلٍّ تاريخه في «حداثة البيانات»",as_of:null};
  }
  biMapRows(){
    const Df=this.biMapDef(), Fr=this.biFresh(this.state.api?this.state.api.D:{}), ref=Fr.ref;
    return this.registry().filter(s=>s.key!=="bi_map").map(s=>{
      const k=Df.keys[s.key]||null, dt=k?this.biMapDate(k[2],Fr):{src:"",as_of:null};
      const lag=dt.as_of&&ref?this.advDays(dt.as_of,ref):null;
      return {key:s.key,label:s.label,nav:s.group,g:k?k[0]:null,group:k?Df.groups[k[0]][0]:"لم يُصنَّف",
        filter:k?k[1]:null,filters:k?Df.filt[k[1]][0]:"—",source:dt.src,as_of:dt.as_of,lag,
        fresh:dt.as_of==null?(k&&k[2]==="mix"?"—":"بلا تاريخ"):lag==null?"—":lag<=35?"حديثة":lag<=65?"متأخرة شهرًا":"قديمة"};
    });
  }
  biMapBody(X,T,api){
    const Df=this.biMapDef(), rows=this.biMapRows(), out=[], ref=this.biRef();
    const lost=rows.filter(r=>r.g==null), noF=rows.filter(r=>r.filter&&r.filter!=="rm"&&r.filter!=="mix");
    out.push(this.kpiTiles([
      ["الأقسام",T.int(rows.length),"في "+T.int(new Set(rows.map(r=>r.nav)).size)+" مجموعات في القائمة","#3b82f6"],
      ["المجموعات الوظيفية",T.int(Df.groups.length),T.int(Df.groups.filter((g,i)=>!rows.some(r=>r.g===i)).length)+" بلا قسم بعد","#14b8a6"],
      ["لا تتبع كل فلاتر الفواتير",T.int(noF.length),"مكتوب لكل قسم أدناه","#f59e0b"],
      ["أقسام لم تُصنَّف",T.int(lost.length),lost.length?"تُعرض في آخر الدليل":"كل الأقسام في الدليل",lost.length?"#ef4444":"#10b981"]],"bmk"));
    out.push(this.advNote("bmn","الدليل لا يغيّر القائمة: كل قسم يبقى في مكانه وباسمه، والضغط على اسمه ينقلك إليه. "
      +"«الفلاتر» مقيسة: ✓ يعني أن القسم يتغير بالفلتر، ✗ أنه لا يتغير. «حتى» تاريخ آخر بيانات القسم، "
      +"والحداثة بالأيام حتى "+(ref?this.opsDmy(ref):"—")+" (آخر تحديث لبيانات التشغيل)."));
    const fl={"حديثة":"#10b981","متأخرة شهرًا":"#f59e0b","قديمة":"#ef4444","بلا تاريخ":"#64748b"};
    const link=r=>React.createElement("span",{onClick:()=>this.go(r.key),"data-bi-map":r.key,
      style:{cursor:"pointer",color:"var(--abh-93c5fd,#93c5fd)",textDecoration:"underline",textUnderlineOffset:3}},r.label);
    const table=(k,list)=>this.fsTable(k,["القسم","في القائمة","المصدر","حتى","الفلاتر"],
      list.map(r=>[{v:link(r)},r.nav,r.source,{v:r.as_of?this.opsDmy(r.as_of):r.fresh,c:fl[r.fresh]},
        {v:r.filters,c:(Df.filt[r.filter]||[])[1]}]));
    Df.groups.forEach((g,i)=>{
      const list=rows.filter(r=>r.g===i);
      out.push(this.card((i+1)+" — "+g[0],list.length?table("bmt"+i,list)
        :this.biNeed("bm-need"+i,i===4?this.biReadiness()[0].need+" — لا قسم إنتاج قبل وجودها":"لا قسم بعد"),
        {k:"bm"+i,sub:g[1]+(list.length?" · الأقسام: "+T.int(list.length):"")}));
    });
    if(lost.length) out.push(this.card("لم يُصنَّف بعد",table("bmtx",lost),{k:"bmx",sub:"قسم جديد لم يُضف إلى الدليل"}));
    out.push(this.advNote("bmr","لكل مؤشر معادلته ودالته ومصدره وحالته واختباراته في سجل المؤشرات docs/KPI_REGISTER.md؛ والقيم الحالية في «قاموس المؤشرات»."));
    out.push(this.advLink("bmgo","قاموس المؤشرات","bi_kpis"));
    return out;
  }

  /* جداول «ذكاء الأعمال» لكتالوج التصدير وملف Excel. */
  biExport(out,col,num){
    const st=this.state;
    if(!st.api) return;
    const api=st.api, D=api.D, T=st.T, X=api.buildContext(st.filters||{});
    out.push({id:"bi_freshness",label:"ذكاء الأعمال — حداثة البيانات",rows:this.biFresh(D).rows,columns:[
      col("المجال","domain"), col("حتى تاريخ",null,r=>r.as_of||""), col("الأيام",null,r=>r.lag==null?"":num(r.lag)), col("الحالة","status"), col("المصدر","source")]});
    if(this.biStmts().length){
      const def=this.biLastTwo(), ms=this.biStmts().map(r=>r.period);
      const m0=ms.includes(st.biB0)?st.biB0:def[0], m1=ms.includes(st.biB1)?st.biB1:def[1];
      if(m0!==m1){
        const Br=this.biPnlBridge(m0,m1), I=this.biItemBridge(m0,m1);
        out.push(
          {id:"bi_bridge_pnl",label:"ذكاء الأعمال — جسر صافي الربح "+m0+" ← "+m1,rows:Br.steps,columns:[col("البند","name"), col("القيمة",null,r=>num(r.v))]},
          {id:"bi_bridge_items",label:"ذكاء الأعمال — جسر الربح بالصنف "+m0+" ← "+m1,rows:I.items,columns:[
            col("الكود","code"), col("الصنف","name"), col("العلامة","brand"), col("الحالة","kind"), col("الأساس","basis"),
            col("كمية "+m0,null,r=>num(r.q0)), col("كمية "+m1,null,r=>num(r.q1)), col("إيراد "+m0,null,r=>num(r.rev0)), col("إيراد "+m1,null,r=>num(r.rev1)),
            col("مجمل ربح "+m0,null,r=>num(r.gp0)), col("مجمل ربح "+m1,null,r=>num(r.gp1)),
            col("أثر السعر",null,r=>num(r.price)), col("أثر التكلفة",null,r=>num(r.cost)), col("الكمية والمزيج",null,r=>num(r.vol)),
            col("Δ مجمل الربح",null,r=>num(r.dgp))]});
      }
      out.push({id:"bi_breakeven",label:"ذكاء الأعمال — نقطة التعادل (افتراض: المصروفات ثابتة)",rows:this.biBreakEven(),columns:[
        col("الشهر","month"), col("صافي المبيعات",null,r=>num(r.sales)), col("نسبة المساهمة",null,r=>num(r.cm)), col("المصروفات",null,r=>num(r.fixed)),
        col("مبيعات التعادل",null,r=>num(r.be)), col("هامش الأمان",null,r=>num(r.mos))]});
    }
    if(window.DASH_OPS){
      const V=this.advMemo(api,"biStock",()=>this.biStock());
      out.push(
        {id:"bi_dio",label:"ذكاء الأعمال — أيام المخزون",rows:V.dio,columns:[
          col("الشهر","month"), col("المخزون آخر المدة",null,r=>num(r.total)), col("متوسط المخزون",null,r=>num(r.avg)),
          col("تكلفة المبيعات",null,r=>r.cogs==null?"يحتاج بيانات":num(r.cogs)), col("الدوران الشهري",null,r=>r.turns==null?"":num(r.turns)),
          col("أيام المخزون",null,r=>r.dio==null?"":num(r.dio))]},
        {id:"bi_dead_stock",label:"ذكاء الأعمال — الخامات الراكدة والبطيئة",rows:V.dead.map(r=>({...r,cls:"راكدة"})).concat(V.slow.map(r=>({...r,cls:"بطيئة"}))),columns:[
          col("التصنيف","cls"), col("الخامة","name"), col("الكمية",null,r=>num(r.qty)), col("متوسط التكلفة",null,r=>num(r.wac)), col("القيمة",null,r=>num(r.value)),
          col("بلا حركة منذ","since")]},
        {id:"bi_unpriced",label:"ذكاء الأعمال — أصناف برصيد بلا تكلفة",rows:V.unpriced,columns:[col("الصنف","name"), col("الكمية",null,r=>num(r.qty))]});
    }
    if(window.DASH_STD){
      const Z=this.advMemo(api,"biStd",(X2,D2)=>this.biStd(D2));
      out.push(
        {id:"bi_std_cost",label:"ذكاء الأعمال — التكلفة المعيارية للعبوة",rows:window.DASH_STD.rows.concat(window.DASH_STD.unresolved),columns:[
          col("العلامة","brand"), col("الصف في الملف",null,r=>r.key||r.name), col("الخلطة",null,r=>num(r.mix)), col("التغليف",null,r=>num(r.pack)),
          col("الإجمالي",null,r=>num(r.total)), col("المعيار المستعمل",null,r=>num(r.std!=null?r.std:r.total)), col("أساس المعيار",null,r=>r.std_basis||""),
          col("كود المبيعات",null,r=>r.item_code||""), col("الربط",null,r=>r.match_basis||r.reason||"")]},
        {id:"bi_std_variance_month",label:"ذكاء الأعمال — انحراف التكلفة المعيارية شهريًا",rows:Z.months,columns:[
          col("الشهر","month"), col("إيراد الفواتير",null,r=>num(r.rev)), col("إيراد الأصناف المربوطة",null,r=>num(r.covRev)),
          col("التكلفة المعيارية",null,r=>num(r.stdCogs)), col("نسبة المعيارية",null,r=>num(r.stdR)), col("نسبة القائمة",null,r=>r.actR==null?"يحتاج بيانات":num(r.actR)),
          col("الانحراف التقديري",null,r=>r.var==null?"":num(r.var))]},
        {id:"bi_std_margin_sku",label:"ذكاء الأعمال — الهامش المعياري بالصنف "+(Z.skuMonth||""),rows:Z.sku,columns:[
          col("الكود","code"), col("الصنف","name"), col("المعيار",null,r=>num(r.std)), col("أساس المعيار","basis"), col("متوسط سعر البيع",null,r=>r.price==null?"":num(r.price)),
          col("الهامش المعياري",null,r=>r.std_margin==null?"":num(r.std_margin)), col("الكمية",null,r=>num(r.qty)), col("بونص",null,r=>num(r.bonus)),
          col("الإيراد",null,r=>num(r.rev)), col("مجمل الربح المعياري",null,r=>num(r.std_gp))]});
      if(Z.mon) out.push({id:"bi_std_monthly",label:"ذكاء الأعمال — المعيار الشهري (الوصفة بمتوسط آخر الشهر)",
        rows:Z.mon.rows.concat(Z.mon.singles),columns:[
          col("الكود","code"), col("الصنف","name"), col("الوصفة","recipe"), col("كجم",null,r=>r.kg==null?"":num(r.kg)),
          col("معيار الملف / الإدارة",null,r=>num(r.file!=null?r.file:r.mgmt))].concat(
          Z.mon.list.map(m=>col("المعيار "+m,null,r=>r.by[m]&&r.by[m].std!=null?num(r.by[m].std):"يحتاج بيانات")))});
    }
    if(window.DASH_IS25){
      const Z=this.biIs25();
      out.push(
        {id:"bi_is25",label:"ذكاء الأعمال — قوائم الدخل 2025",rows:Z.rows,columns:[
          col("الشهر","month"), col("صافي المبيعات",null,r=>r.need?"يحتاج بيانات":num(r.net)), col("تكلفة المبيعات",null,r=>r.need?"":num(r.cogs)),
          col("مجمل الربح",null,r=>r.need?"":num(r.gp)), col("المصروفات",null,r=>r.need?"":num(r.exp)), col("صافي الربح",null,r=>r.need?"":num(r.np)),
          col("مبيعات الفواتير",null,r=>r.inv==null?"":num(r.inv)), col("الأساس",null,r=>r.need||((r.confirm?"يحتاج تأكيد · ":"")+r.basis)),
          col("ملاحظات",null,r=>(r.flags||[]).join("؛ ")), col("المصدر",null,r=>r.src||"")]},
        {id:"bi_is25_vs_26",label:"ذكاء الأعمال — 2025 مقابل 2026",rows:Z.cmp,columns:[
          col("الفترة","label"), col("صافي المبيعات 2025",null,r=>r.net25==null?"يحتاج بيانات":num(r.net25)), col("صافي المبيعات 2026",null,r=>num(r.net26)),
          col("مجمل الربح 2025",null,r=>r.gp25==null?"":num(r.gp25)), col("مجمل الربح 2026",null,r=>num(r.gp26)),
          col("صافي الربح 2025",null,r=>r.np25==null?"":num(r.np25)), col("صافي الربح 2026",null,r=>num(r.np26)), col("يحتاج تأكيد",null,r=>r.confirm?"نعم":"")]});
    }
    if(window.DASH_IS25&&window.DASH_IS26&&window.DASH_FS){
      const P=this.biPl(), seq=[];
      P.tot.forEach((t,ti)=>{ P.cols.forEach((c,ci)=>{ if(c.year===t.year) seq.push({c,ci}); }); seq.push({t,ti}); });
      const cv=(x,pct)=>x==="adm"?"ضمن الإدارية":x==="na"||x==null?"":num(x);
      out.push({id:"bi_pl_2025_2026",label:"ذكاء الأعمال — قائمة الدخل يناير 2025 – يوليو 2026",rows:P.rows,columns:[col("البند","label")].concat(
        seq.map(x=>x.t?col(x.t.label,null,r=>cv(r.tots[x.ti].v)+(r.tots[x.ti].part&&r.tots[x.ti].v!=null?" *":""))
          :col(this.fsMon(x.c.m)+" — "+x.c.tag,null,r=>x.c.need?(r.k==="net"?"يحتاج بيانات":""):cv(r.vals[x.ci]))))});
    }
    if(window.DASH_ARH){
      const Z=this.biArh(), per=p=>p.from+" ← "+p.to;
      out.push(
        {id:"bi_ar_history",label:"ذكاء الأعمال — المديونية بالمندوب كما طُبعت",rows:Z.reps.concat([{rep:"الإجمالي",total:true}]),columns:[
          col("المندوب","rep")].concat(Z.D.map(x=>col(x,null,r=>{ if(r.total){ const t=Z.H.totals.find(t=>t.date===x); return num(t.net)+(t.complete?"":" (جزئي)"); }
            return r.by[x]?num(r.by[x].net):"يحتاج بيانات"; })))},
        {id:"bi_ar_rollforward",label:"ذكاء الأعمال — مطابقة حركة المديونية",rows:Z.P,columns:[
          col("من","from"), col("إلى","to"), col("عملاء",null,r=>num(r.customers)), col("مطابقون",null,r=>num(r.tied)),
          col("رصيد أول",null,r=>num(r.totals.opening)), col("فواتير",null,r=>num(r.totals.sales)), col("تحصيلات",null,r=>num(r.totals.receipts)),
          col("مرتجعات",null,r=>num(r.totals.returns)), col("الرصيد المطبوع",null,r=>num(r.totals.closing)), col("الفجوة",null,r=>num(r.totals.gap)),
          col("بعد نهاية الاستخراج",null,r=>r.after_extract?"نعم":"")]},
        {id:"bi_ar_gaps",label:"ذكاء الأعمال — أكبر فجوات المديونية بالعميل",rows:[].concat(...Z.P.map(p=>p.gaps.map(g=>({...g,per:per(p)})))),columns:[
          col("الفترة","per"), col("الكود","code"), col("العميل","name"), col("المندوب","rep"), col("رصيد أول",null,r=>num(r.opening)),
          col("فواتير",null,r=>num(r.sales)), col("تحصيلات",null,r=>num(r.receipts)), col("مرتجعات",null,r=>num(r.returns)),
          col("الرصيد المطبوع",null,r=>num(r.closing)), col("الفجوة",null,r=>num(r.gap)), col("النمط","pattern")]});
    }
    if(window.DASH_RCP){
      const C=window.DASH_RCP;
      out.push(
        {id:"bi_recipes",label:"ذكاء الأعمال — بنود الوصفات",rows:[].concat(...C.recipes.map(r=>r.lines.map(l=>({...l,recipe:r.name})))),columns:[
          col("الوصفة","recipe"), col("البند","name"), col("الكمية",null,r=>r.qty==null?"":num(r.qty)), col("السعر",null,r=>r.price==null?"":num(r.price)),
          col("الإجمالي",null,r=>num(r.total))]},
        {id:"bi_recipe_packs",label:"ذكاء الأعمال — تكلفة العبوة من الوصفة (بلا عمولة)",rows:[].concat(...C.recipes.map(r=>r.packs.map(p=>({...p,recipe:r.name,kg:r.per_kg_loaded})))),columns:[
          col("الوصفة","recipe"), col("الوزن (جم)",null,r=>num(r.grams)), col("سعر الكيلو بالإضافات",null,r=>num(r.kg)), col("الخلطة",null,r=>num(r.base)),
          col("التغليف",null,r=>num(r.packaging)), col("تكلفة العبوة",null,r=>num(r.cost)),
          col("المطبوع شاملًا العمولة (مرجعية)",null,r=>r.printed_total==null?"":num(r.printed_total)), col("الأساس",null,r=>r.basis||"")]},
        {id:"bi_recipe_candidates",label:"ذكاء الأعمال — ربط الوصفات بالأصناف وهامش الوصفة",
          rows:[].concat(...C.candidates.map(c=>c.items.map(i=>({...i,recipe:c.recipe,g:c.grams,cost:c.cost})))),columns:[
          col("الوصفة","recipe"), col("الوزن",null,r=>num(r.g)), col("الكود","code"), col("الصنف","name"), col("الكمية",null,r=>num(r.qty)),
          col("متوسط سعر البيع",null,r=>r.avg_price==null?"":num(r.avg_price)), col("سعر البيع (هامش الوصفة)",null,r=>r.price==null?"":num(r.price)),
          col("أساس السعر",null,r=>r.price_basis||""), col("تكلفة الوصفة",null,r=>num(r.cost)),
          col("هامش الوصفة",null,r=>r.margin==null?"":num(r.margin)), col("نسبة الهامش",null,r=>r.margin_pct==null?"":num(r.margin_pct)),
          col("عمولة البيع (مصروف بيعي — خارج التكلفة)",null,r=>r.selling_commission==null?"":num(r.selling_commission)),
          col("تكلفة النموذج التشغيلية (يونيو)",null,r=>r.model_cost?num(r.model_cost.op):""), col("الحالة","status")]});
    }
    const P=this.biProd();
    if(P.bom.length||P.sheets.length) out.push({id:"bi_prod_bom",label:"ذكاء الأعمال — وصفات المنتجات بالكميات",
      rows:[].concat(...P.bom.map(r=>r.main.map(x=>({recipe:r.name,brand:r.brand,part:"الوصفة الرئيسية",ing:x.ing,qty:x.qty}))
          .concat(r.sub.map(x=>({recipe:r.name,brand:r.brand,part:"الخلطة الفرعية",ing:x.ing,qty:x.qty})))),
        ...P.sheets.map(r=>r.lines.map(l=>({recipe:r.name,brand:"",part:"ورقة الخلطة",ing:l.name,qty:l.qty}))),
        P.singles.map(r=>({recipe:r.name,brand:"",part:"خامة واحدة",ing:r.item,qty:r.kg}))),columns:[
        col("الوصفة","recipe"), col("العلامة","brand"), col("الجزء","part"), col("الخامة","ing"), col("الكمية",null,r=>r.qty==null?"":num(r.qty))]});
    const K=this.biCostKilo();
    if(K.rows.length) out.push({id:"bi_cost_kilo_monthly",label:"ذكاء الأعمال — كيلو الخلطة على مدار الشهور",rows:K.rows,columns:[
      col("الخلطة","name"), col("النوع","kind")].concat(K.months.map(m=>col(m,null,r=>r.by[m]==null?"يحتاج بيانات":num(r.by[m]))),
      [col("التغير",null,r=>r.chg==null?"":num(r.chg)), col("الأساس","basis")])});
    if(window.DASH_STD){
      const Z=this.advMemo(api,"biCostStd",(X2,D2)=>this.biCostStd(D2));
      if(Z) out.push({id:"bi_cost_std_vs_actual",label:"ذكاء الأعمال — تكلفة المنتج التام: المعيار مقابل الفعلي",
        rows:[].concat(...Z.items.map(it=>Z.months.map(m=>({...it.by[m.month],code:it.code,name:it.name,month:m.month,cogs:m.cogs})))),columns:[
        col("الكود","code"), col("الصنف","name"), col("الشهر","month"), col("المعيار للعبوة",null,r=>r.std==null?"يحتاج بيانات":num(r.std)), col("أساس المعيار","t"),
        col("الكمية مع البونص",null,r=>num(r.q)), col("الإيراد",null,r=>num(r.rev)),
        col("الفعلي للعبوة (توزيع)",null,r=>r.cogs==null?"يحتاج بيانات":r.act==null?"":num(r.act)), col("الانحراف للعبوة",null,r=>r.var==null?"":num(r.var))]});
    }
    const AB=window.DASH_ABM;
    if(AB&&AB.enabled) out.push(
      {id:"bi_abm_runs",label:"ذكاء الأعمال — تشغيل أكواد Abohashem-main",rows:AB.runs,columns:[col("السكربت","step"), col("النتيجة","status"), col("تفاصيل","detail")]},
      {id:"bi_abm_salespeople",label:"ذكاء الأعمال — Abohashem-main: المناديب ("+AB.as_of.debt_as_of+")",rows:AB.salespeople,columns:[
        col("المندوب","salesperson"), col("عملاء",null,r=>num(r.customers)), col("مبيعات الفترة",null,r=>num(r.period_sales_EGP)),
        col("المديونية",null,r=>num(r.outstanding_debt_EGP)), col("شهور انكشاف",null,r=>r.credit_exposure_months===""?"":num(r.credit_exposure_months))]},
      {id:"bi_abm_aging",label:"ذكاء الأعمال — Abohashem-main: أعمار الديون",rows:AB.aging_top,columns:[
        col("الكود","customer_code"), col("العميل","customer"), col("المندوب","salesperson"), col("0–30",null,r=>num(r.days_0_30_EGP)),
        col("رصيد سابق",null,r=>num(r.opening_carryover_undated_EGP)), col("الإجمالي",null,r=>num(r.total_debt_EGP))]});
    const A=this.biAlertRows(X,D,st.filters||{},T);
    out.push(
      {id:"bi_alert_register",label:"ذكاء الأعمال — سجل التنبيهات",rows:A.rows,columns:[
        col("المؤشر","kpi"), col("القيمة الفعلية","value"), col("الحد","thr"), col("الانحراف","dev"), col("السبب المحتمل","cause"),
        col("أساس السبب",null,r=>r.ct==="v"?"مُتحقَّق":"فرضية"), col("الإجراء","action"), col("المسؤول","owner"), col("الأولوية","sev"),
        col("الحالة",null,r=>this.biAlertState(r.id).s), col("تاريخ تحديث الحالة",null,r=>this.biAlertState(r.id).t||""),
        col("البيانات حتى",null,r=>r.updated||""), col("المصدر","src")]},
      {id:"bi_alert_rules",label:"ذكاء الأعمال — قواعد التنبيه",rows:A.rules,columns:[
        col("القاعدة","kpi"), col("الحد","thr"), col("مفعّلة",null,r=>r.on?"نعم":"لا"), col("البيانات","src")]},
      {id:"bi_kpi_catalog",label:"ذكاء الأعمال — قاموس المؤشرات",rows:this.biKpiRows(D,T),columns:[
        col("المؤشر","kpi"), col("القيمة","value"), col("الوحدة","unit"), col("المعادلة","formula"), col("المصدر","source"), col("الفترة","period"),
        col("حتى",null,r=>r.as_of||""), col("الفحص","check"), col("الأساس","status")]},
      {id:"bi_readiness",label:"ذكاء الأعمال — جاهزية البيانات",rows:this.biReadiness(),columns:[
        col("الوحدة","module"), col("المطلوب","need"), col("من","owner"), col("الحالة","status")]},
      {id:"bi_exec_answers",label:"ذكاء الأعمال — أسئلة الإدارة الخمسة",rows:this.biExecAnswers(D,T,A.rows),columns:[
        col("#","n"), col("السؤال","q"), col("الإجابة","answer"), col("الأساس","basis"), col("المصدر","src"), col("القسم","go")]},
      {id:"bi_map",label:"ذكاء الأعمال — دليل اللوحة",rows:this.biMapRows(),columns:[
        col("المجموعة","group"), col("القسم","label"), col("المفتاح","key"), col("في القائمة","nav"), col("المصدر","source"),
        col("حتى",null,r=>r.as_of||""), col("الحداثة","fresh"), col("الفلاتر","filters")]});
  }

