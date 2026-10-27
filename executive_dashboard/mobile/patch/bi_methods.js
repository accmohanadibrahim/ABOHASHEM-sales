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
      bi_kpis:"biKpisBody",bi_is25:"biIs25Body",bi_abm:"biAbmBody"}[s];
    if(!m) return null;
    try{ return this[m](X,T,api); }
    catch(e){ return [this.advNote("bi-err","تعذّر عرض هذا القسم ("+String(e&&e.message||e)
      +"). باقي اللوحة يعمل كما هو؛ هذا القسم وحده معطّل حتى يُصلح.","warn")]; }
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
  biIs25Body(X,T,api){
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
    out.push(this.card("قائمة الدخل الشهرية — 2025",[
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
        owner:"مدير المخزن / المشتريات",sev:"medium",updated:V.lastDate,go:"bi_stock",src:"جرود المخزون"});
      rules.push({id:"bi_unpriced",kpi:"أصناف برصيد بلا متوسط تكلفة",thr:"0",on:V.unpriced.length>0,src:"جرود المخزون"});
      if(V.unpriced.length) out.push({id:"bi_unpriced",kpi:"أصناف برصيد بلا متوسط تكلفة",value:T.int(V.unpriced.length)+" صنف",thr:"0",dev:T.int(V.unpriced.length),
        cause:"لا سعر شراء لها في نموذج المتوسط المرجح، فقيمتها صفر في الجرد",ct:"v",action:"إدخال سعر الشراء الفعلي في نموذج الشهر",
        owner:"المحاسب",sev:"medium",updated:V.lastDate,go:"bi_stock",src:"جرود المخزون"});
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
        sev:"high",updated:this.opsMonEnd(Z.skuMonth),go:"bi_std",src:"التكلفة المعيارية"});
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
        col("الوحدة","module"), col("المطلوب","need"), col("من","owner"), col("الحالة","status")]});
  }

