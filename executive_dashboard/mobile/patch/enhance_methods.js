  /* ==========================================================================
     خارطة التطوير (enhance_mobile.py) — إضافة فقط فوق الملف المدموج.

       «تحليلات متقدمة»: تحليل ABC بالإيراد وبالربح (منفصلين)، الموسمية،
       سلة المشتريات، أفواج العملاء والاحتفاظ، والتنبيهات الذكية.

     كل رقم هنا محسوب من بيانات موجودة في الملف؛ لا تكلفة ولا مخزون ولا تاريخ
     صلاحية ولا عميل مُختلَق. ما لا تدعمه البيانات يُقال صراحةً في البطاقة.
     ========================================================================== */

  /* ---- المظهر: فاتح / داكن ------------------------------------------------- */
  themeBtn(){
    const L=!!(window.__abhLight&&window.__abhLight());
    const sun='<svg viewBox="0 0 24 24" style="width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:2;'
      +'stroke-linecap:round;stroke-linejoin:round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4'
      +'M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
    const moon='<svg viewBox="0 0 24 24" style="width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:2;'
      +'stroke-linecap:round;stroke-linejoin:round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
    return React.createElement("span",{key:"theme","data-theme-toggle":L?"light":"dark",role:"button",
      title:L?"المظهر الداكن":"المظهر الفاتح","aria-label":L?"تبديل إلى المظهر الداكن":"تبديل إلى المظهر الفاتح",
      onClick:()=>{ const t=L?"dark":"light"; if(window.__abhSetTheme) window.__abhSetTheme(t); this.setState({abhTheme:t}); },
      style:{width:34,height:34,flex:"none",borderRadius:10,background:"rgba(255,255,255,.03)",
        border:"1px solid rgba(255,255,255,.08)",display:"grid",placeItems:"center",color:"#e2e8f0",cursor:"pointer"},
      dangerouslySetInnerHTML:{__html:L?moon:sun}});
  }

  /* ---- ذاكرة الحسابات: لكل لقطة وتركيبة فلاتر مرة واحدة ---------------------- */
  advMemo(api,name,fn){
    const st=this.state, key=st.snap+"|"+JSON.stringify(st.filters||{});
    if(!this.__adv||this.__adv.key!==key||this.__adv.D!==api.D)
      this.__adv={key, D:api.D, X:api.buildContext(st.filters||{}), memo:{}};
    const m=this.__adv.memo;
    if(!(name in m)) m[name]=fn(this.__adv.X, api.D, st.filters||{});
    return m[name];
  }
  /* بنود الفواتير بكل الفلاتر عدا الشهر — للأفواج والمقارنات الشهرية التي
     تحتاج كل الشهور. */
  advLinesNoMonth(D,f){
    return (D.lines||[]).filter(l=>(!f.customer||l.customer_code===f.customer)&&(!f.rep||l.rep===f.rep)&&
      (!f.brand||l.brand===f.brand)&&(!f.item||l.item_code===f.item));
  }
  advDays(a,b){ return Math.round((Date.parse(b+"T00:00:00Z")-Date.parse(a+"T00:00:00Z"))/864e5); }
  advBadge(txt,color){
    return React.createElement("span",{style:{display:"inline-block",fontSize:10,fontWeight:800,padding:"1px 7px",
      borderRadius:99,background:color+"26",color:color,fontFamily:"'JetBrains Mono',monospace"}},txt);
  }
  advNote(k,text,tone){
    const c=tone==="warn"?["rgba(237,161,0,.10)","rgba(237,161,0,.30)","#fcd34d"]
      :["rgba(59,130,246,.10)","rgba(59,130,246,.30)","#93c5fd"];
    return React.createElement("div",{key:k,style:{padding:"9px 11px",borderRadius:12,background:c[0],
      border:"1px solid "+c[1],fontSize:11,lineHeight:1.8,color:c[2]}},text);
  }
  advLink(k,label,key){
    return React.createElement("span",{key:k,onClick:()=>this.go(key),style:{alignSelf:"flex-start",fontSize:11,
      padding:"6px 11px",borderRadius:9,cursor:"pointer",background:"rgba(59,130,246,.12)",
      border:"1px solid rgba(59,130,246,.30)",color:"#93c5fd"}},label+" ‹");
  }
  advCls(c){ return c==="A"?"#10b981":c==="B"?"#f59e0b":c==="C"?"#ef4444":"#64748b"; }

  /* ---- 1) ABC ---------------------------------------------------------------
     الفئة من الحصة التراكمية قبل الصنف: A حتى 80٪، B حتى 95٪، C الباقي — فالصنف
     الذي يعبر حدّ 80٪ يُحسب في A. */
  advAbcRank(rows,val){
    const pos=rows.filter(r=>val(r)>0).sort((a,b)=>val(b)-val(a));
    const neg=rows.filter(r=>!(val(r)>0)).sort((a,b)=>val(a)-val(b));
    const tot=pos.reduce((a,r)=>a+val(r),0);
    let cum=0;
    pos.forEach((r,i)=>{ const before=tot?cum/tot:0; cum+=val(r);
      r.rank=i+1; r.share=tot?val(r)/tot:0; r.cum=tot?cum/tot:0; r.cls=before<0.8?"A":before<0.95?"B":"C"; });
    neg.forEach(r=>{ r.rank=null; r.share=null; r.cum=null; r.cls="−"; });
    return {rows:pos.concat(neg), tot};
  }
  advAbcRevenue(X){
    const by=new Map();
    for(const l of X.lines||[]){ const t=+l.line_total||0; if(!(t>0)) continue;
      let o=by.get(l.item_code);
      if(!o) by.set(l.item_code,o={item_code:l.item_code,item_name:l.item_name,brand:l.brand,sales:0,qty:0,inv:new Set(),cust:new Set()});
      o.sales+=t; o.qty+=+l.qty||0; o.inv.add(l.invoice_no); o.cust.add(l.customer_code); }
    const rows=[...by.values()].map(o=>({item_code:o.item_code,item_name:o.item_name,brand:o.brand,sales:o.sales,
      qty:o.qty,n_invoices:o.inv.size,n_customers:o.cust.size}));
    return this.advAbcRank(rows,r=>r.sales);
  }
  advAbcProfit(f){
    const M=window.DASH_MARGIN;
    if(!M||!(M.by_item||[]).length) return null;
    const base=M.by_item.filter(r=>(!f.brand||r.brand===f.brand)&&(!f.item||String(r.item_code)===String(f.item)))
      .map(r=>({item_code:String(r.item_code),item_name:r.item_name,brand:r.brand,revenue:r.revenue_costed,
        gp:r.gross_profit,gm:r.gross_margin_pct,op:r.op_profit,qty:r.qty}));
    const byRev=this.advAbcRank(base.map(r=>({...r})),r=>r.revenue);
    const revCls=new Map(byRev.rows.map(r=>[r.item_code,r.cls]));
    const byGp=this.advAbcRank(base,r=>r.gp);
    byGp.rows.forEach(r=>{ r.rev_cls=revCls.get(r.item_code)||"−"; });
    const cross={};
    ["A","B","C","−"].forEach(a=>{ cross[a]={A:0,B:0,C:0,"−":0}; });
    byGp.rows.forEach(r=>{ cross[r.rev_cls][r.cls]++; });
    const meta=M.meta||{};
    return {rows:byGp.rows, totGp:byGp.tot, totRev:base.reduce((a,r)=>a+(r.revenue||0),0), cross, meta,
      uncosted:(M.uncosted_items||[]).filter(r=>!f.item||String(r.item_code)===String(f.item))};
  }
  advParetoChart(rows,valKey,valLabel){
    const C=this.state.C, T=this.state.T, b=C.ecBase(), pos=rows.filter(r=>r.cls!=="−");
    if(!pos.length) return C.EMPTY||{__empty:true};
    return {...b, tooltip:{...b.tooltip,trigger:"axis",
        formatter:ps=>{ const r=pos[ps[0].dataIndex]; return r.item_name+"<br/>"+valLabel+": "+T.egp(r[valKey])
          +"<br/>الحصة: "+T.pct(r.share)+" · التراكمي: "+T.pct(r.cum)+"<br/>الفئة: "+r.cls; }},
      legend:{...b.legend,data:[valLabel,"التراكمي %"]}, grid:{...b.grid,top:32},
      xAxis:this.fsAx(b,{type:"category",data:pos.map(r=>r.rank),axisLabel:{show:false}}),
      yAxis:[this.fsAx(b,{type:"value",axisLabel:{color:b._muted,fontSize:10,formatter:T.egpK}}),
        this.fsAx(b,{type:"value",min:0,max:1,splitLine:{show:false},
          axisLabel:{color:b._muted,fontSize:10,formatter:v=>Math.round(v*100)+"%"}})],
      series:[{name:valLabel,type:"bar",barCategoryGap:"12%",
          data:pos.map(r=>({value:Math.round(r[valKey]),itemStyle:{color:this.advCls(r.cls)}}))},
        {name:"التراكمي %",type:"line",yAxisIndex:1,symbol:"none",data:pos.map(r=>r.cum),
          lineStyle:{width:2.4,color:"#8b5cf6"},itemStyle:{color:"#8b5cf6"},
          markLine:{silent:true,symbol:"none",lineStyle:{type:"dashed",color:b._muted},
            label:{color:b._muted,fontSize:9.5,position:"insideStartTop",formatter:p=>"حد "+Math.round(p.value*100)+"%"},
            data:[{yAxis:0.8},{yAxis:0.95}]}}]};
  }
  advAbcSummary(rows,val,tot){
    const T=this.state.T;
    return ["A","B","C"].map(c=>{ const rs=rows.filter(r=>r.cls===c), v=rs.reduce((a,r)=>a+val(r),0);
      return ["الفئة "+c+" — "+rs.length+" صنف",T.pct(tot?v/tot:0),T.egpK(v),this.advCls(c)]; });
  }
  advAbcBody(X,T,api){
    const f=this.state.filters||{};
    const R=this.advMemo(api,"abcRev",X2=>this.advAbcRevenue(X2));
    const P=this.advMemo(api,"abcProfit",(X2,D,f2)=>this.advAbcProfit(f2));
    const out=[];
    out.push(this.advNote("abcn","يوجد تحليلان منفصلان: ABC بالإيراد من بنود الفواتير (يتبع كل الفلاتر)، "
      +"وABC بالربح من جدول الربحية الذي يغطي الأصناف المكلَّفة فقط. لا يُخلط أحدهما بالآخر، "
      +"ولا تُفترض تكلفة لصنف بلا تكلفة."));
    out.push(this.card("ABC بالإيراد — "+(f.month&&f.month!=="all"?this.fsMon(f.month):"كل شهور اللقطة"),
      R.rows.length?[this.kpiTiles(this.advAbcSummary(R.rows,r=>r.sales,R.tot).concat([["إجمالي مبيعات البنود",T.egpK(R.tot),
          R.rows.length+" صنف بمبيعات","#3b82f6"]]),"abck1"),
        React.createElement(EChart,{key:"c",option:this.advParetoChart(R.rows,"sales","المبيعات"),h:this.state.C.H.base,
          title:"ABC بالإيراد"})]:this.empty("لا توجد مبيعات في هذا التقسيم"),
      {k:"abc1",sub:"بنود الفواتير · بدون البونص والقيم الصفرية"}));
    out.push(this.card("أصناف ABC بالإيراد",this.pagedList("abcr",R.rows,[
      ["الصنف",r=>r.item_name],["الفئة",r=>r.cls],["المبيعات",r=>T.num(r.sales)],["الحصة / التراكمي",r=>T.pct(r.share)+" / "+T.pct(r.cum)],
      ["العلامة",r=>r.brand],["الكمية",r=>T.num(r.qty)],["الفواتير",r=>T.int(r.n_invoices)],["العملاء",r=>T.int(r.n_customers)]],
      r=>this.set("item",r.item_code)),{k:"abc2",sub:"اضغط على صنف لتصفية اللوحة به"}));
    if(!P){
      out.push(this.card("ABC بالربح",this.empty("لا يوجد جدول ربحية (DASH_MARGIN) في هذا الملف — لا يمكن تصنيف الأصناف بالربح دون تكلفة."),{k:"abc3"}));
      return out;
    }
    const m=P.meta, win=(m.reliable_months||[]);
    const winTxt=win.length?this.fsMon(win[0])+" – "+this.fsMon(win[win.length-1]):"—";
    out.push(this.advNote("abcpn","ABC بالربح: مجمل الربح من جدول الربحية للفترة "+winTxt
      +" على تكلفة وحدة "+this.fsMon(m.cost_month)+" (مقيس في "+this.fsMon(m.cost_month)+" وتقديري في باقي الشهور)"
      +(m.n_items_costed!=null?" · "+m.n_items_costed+" صنفًا مكلَّفًا من "+m.n_items_total:"")
      +(m.coverage_pct!=null?" · تغطية الإيراد "+T.pct(m.coverage_pct/100):"")
      +". فلتر الشهر والعميل والمندوب لا ينطبق على هذا الجدول؛ فلتر العلامة والصنف ينطبق.","warn"));
    out.push(this.card("ABC بالربح — مجمل الربح",
      P.rows.length?[this.kpiTiles(this.advAbcSummary(P.rows,r=>r.gp,P.totGp).concat([["مجمل الربح (أصناف مكلَّفة)",T.egpK(P.totGp),
          "على إيراد مُسعَّر "+T.egpK(P.totRev),"#8b5cf6"]]),"abck2"),
        React.createElement(EChart,{key:"c",option:this.advParetoChart(P.rows,"gp","مجمل الربح"),h:this.state.C.H.base,
          title:"ABC بالربح"})]:this.empty("لا أصناف مكلَّفة في هذا التقسيم"),
      {k:"abc3",approx:true,sub:winTxt}));
    out.push(this.card("فئة الإيراد مقابل فئة الربح",
      this.fsTable("abcx",["فئة الإيراد ↓ / فئة الربح ←","A","B","C","هامش سالب"],
        ["A","B","C"].map(a=>["الإيراد "+a].concat(["A","B","C","−"].map(b=>({v:T.int(P.cross[a][b]),
          c:a===b?"#6ee7b7":null}))))),
      {k:"abc4",sub:"كلاهما من جدول الربحية نفسه — نفس الفترة ونفس الأصناف"}));
    out.push(this.card("أصناف ABC بالربح",this.pagedList("abcp",P.rows,[
      ["الصنف",r=>r.item_name],["فئة الربح / الإيراد",r=>r.cls+" / "+r.rev_cls],["مجمل الربح",r=>T.num(r.gp)],
      ["هامش المجمل",r=>r.gm==null?"—":r.gm.toFixed(1)+"%"],["الإيراد المُسعَّر",r=>T.num(r.revenue)],
      ["الربح التشغيلي",r=>T.num(r.op)],["العلامة",r=>r.brand],["الكمية",r=>T.num(r.qty)]]),{k:"abc5",approx:true}));
    out.push(this.card("أصناف بلا تكلفة — خارج ABC بالربح",this.pagedList("abcu",P.uncosted,[
      ["الصنف",r=>r.item_name],["الإيراد",r=>T.num(r.revenue)],["الكود",r=>r.item_code]]),
      {k:"abc6",sub:P.uncosted.length+" صنف · لا تُحسب لها تكلفة صفرية ولا تُقدَّر"}));
    out.push(this.advLink("abcgo","الربحية بثلاثة مستويات في «الربحية»","r:margin"));
    return out;
  }

  /* ---- 2) الموسمية ---------------------------------------------------------- */
  advSeason(X){
    const AR=["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"], ORDER=[6,0,1,2,3,4,5];
    const dow=AR.map(()=>({sales:0,inv:new Set(),days:new Set()})), dom=[];
    for(let d=1;d<=31;d++) dom[d]={sales:0,inv:new Set()};
    for(const l of X.lines||[]){ const t=+l.line_total||0; if(!(t>0)||!l.invoice_date) continue;
      const w=new Date(l.invoice_date+"T00:00:00Z").getUTCDay(), d=+l.invoice_date.slice(8,10);
      dow[w].sales+=t; dow[w].inv.add(l.invoice_no); dow[w].days.add(l.invoice_date);
      dom[d].sales+=t; dom[d].inv.add(l.invoice_no); }
    const wk=ORDER.map(i=>({day:AR[i],sales:dow[i].sales,n_invoices:dow[i].inv.size,n_days:dow[i].days.size,
      avg_per_day:dow[i].days.size?dow[i].sales/dow[i].days.size:0}));
    const dm=[]; for(let d=1;d<=31;d++) dm.push({day:d,sales:dom[d].sales,n_invoices:dom[d].inv.size});
    const third=(a,b)=>dm.filter(r=>r.day>=a&&r.day<=b).reduce((s,r)=>s+r.sales,0);
    const tot=dm.reduce((s,r)=>s+r.sales,0);
    const ms=((window.DASH_DATA||{}).monthly_series||[]), by={};
    ms.forEach(r=>{ by[r.month]=r; });
    const y25=ms.filter(r=>r.month.slice(0,4)==="2025"), mean25=y25.length?y25.reduce((s,r)=>s+r.revenue,0)/y25.length:0;
    const yoy=[]; for(let i=1;i<=12;i++){ const mm=String(i).padStart(2,"0"), a=by["2025-"+mm], b2=by["2026-"+mm];
      if(!a&&!b2) continue;
      yoy.push({month:mm,rev_2025:a?a.revenue:null,rev_2026:b2?b2.revenue:null,
        yoy:a&&b2&&a.revenue?(b2.revenue-a.revenue)/a.revenue:null,index_2025:a&&mean25?a.revenue/mean25:null}); }
    return {wk,dm,tot,thirds:[third(1,10),third(11,20),third(21,31)],yoy,n25:y25.length};
  }
  advSeasonBody(X,T,api){
    const S=this.advMemo(api,"season",X2=>this.advSeason(X2)), C=this.state.C, b=C.ecBase(), out=[];
    const MON=["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
    if(!S.tot) out.push(this.card("نمط أيام الأسبوع",this.empty("لا توجد مبيعات في هذا التقسيم"),{k:"se1"}));
    else{
      const best=S.wk.filter(r=>r.n_days).slice().sort((a,c)=>c.avg_per_day-a.avg_per_day);
      out.push(this.card("نمط أيام الأسبوع",[
        this.kpiTiles([["أقوى يوم (متوسط يومي)",best[0]?best[0].day:"—",best[0]?T.egpK(best[0].avg_per_day)+" لكل يوم عمل":"","#10b981"],
          ["أضعف يوم (متوسط يومي)",best.length?best[best.length-1].day:"—",best.length?T.egpK(best[best.length-1].avg_per_day)+" لكل يوم عمل":"","#ef4444"]],"sek"),
        React.createElement(EChart,{key:"c",h:C.H.base,title:"نمط أيام الأسبوع",option:{...b,
          tooltip:{...b.tooltip,trigger:"axis"},legend:{...b.legend,data:["متوسط المبيعات لكل يوم عمل","عدد الفواتير"]},
          grid:{...b.grid,top:32},xAxis:this.fsAx(b,{type:"category",data:S.wk.map(r=>r.day)}),
          yAxis:[this.fsAx(b,{type:"value",axisLabel:{color:b._muted,fontSize:10,formatter:T.egpK}}),
            this.fsAx(b,{type:"value",splitLine:{show:false}})],
          series:[{name:"متوسط المبيعات لكل يوم عمل",type:"bar",data:S.wk.map(r=>Math.round(r.avg_per_day)),
              itemStyle:{color:T.PAL[0],borderRadius:[3,3,0,0]},tooltip:{valueFormatter:T.egp}},
            {name:"عدد الفواتير",type:"line",yAxisIndex:1,data:S.wk.map(r=>r.n_invoices),itemStyle:{color:T.PAL[3]}}]}}),
        this.fsTable("sewk",["اليوم","المبيعات","الفواتير","أيام العمل","متوسط اليوم"],
          S.wk.map(r=>[r.day,this.fsC(r.sales),T.int(r.n_invoices),T.int(r.n_days),this.fsC(r.avg_per_day)]))],
        {k:"se1",sub:"بنود الفواتير · يتبع الفلاتر · المتوسط = المبيعات ÷ عدد أيام ذلك اليوم التي فيها فواتير"}));
      out.push(this.card("المبيعات خلال الشهر (يوم الشهر)",[
        this.kpiTiles([["الأيام 1–10",T.pct(S.thirds[0]/S.tot),T.egpK(S.thirds[0]),"#3b82f6"],
          ["الأيام 11–20",T.pct(S.thirds[1]/S.tot),T.egpK(S.thirds[1]),"#8b5cf6"],
          ["الأيام 21–31",T.pct(S.thirds[2]/S.tot),T.egpK(S.thirds[2]),"#f59e0b"]],"sedk"),
        React.createElement(EChart,{key:"c",h:C.H.short,title:"المبيعات حسب يوم الشهر",option:{...b,
          tooltip:{...b.tooltip,trigger:"axis",valueFormatter:T.egp},grid:{...b.grid,top:14},
          xAxis:this.fsAx(b,{type:"category",data:S.dm.map(r=>r.day)}),
          yAxis:this.fsAx(b,{type:"value",axisLabel:{color:b._muted,fontSize:10,formatter:T.egpK}}),
          series:[{name:"المبيعات",type:"bar",data:S.dm.map(r=>Math.round(r.sales)),itemStyle:{color:T.PAL[1],borderRadius:[2,2,0,0]}}]}})],
        {k:"se2",sub:"أيام 29–31 لا تتكرر كل شهر، فقارن الثلاثيات بحذر"}));
    }
    if(!S.yoy.length) out.push(this.card("المقارنة السنوية",this.empty("لا توجد سلسلة شهرية (monthly_series) في هذا الملف"),{k:"se3"}));
    else{
      out.push(this.card("2025 مقابل 2026 — نفس الشهر",[
        React.createElement(EChart,{key:"c",h:C.H.base,title:"2025 مقابل 2026",option:{...b,
          tooltip:{...b.tooltip,trigger:"axis",valueFormatter:T.egp},legend:{...b.legend,data:["2025","2026"]},
          grid:{...b.grid,top:32},xAxis:this.fsAx(b,{type:"category",data:S.yoy.map(r=>MON[+r.month-1])}),
          yAxis:this.fsAx(b,{type:"value",axisLabel:{color:b._muted,fontSize:10,formatter:T.egpK}}),
          series:[{name:"2025",type:"bar",data:S.yoy.map(r=>r.rev_2025==null?null:Math.round(r.rev_2025)),itemStyle:{color:T.PAL[5]}},
            {name:"2026",type:"bar",data:S.yoy.map(r=>r.rev_2026==null?null:Math.round(r.rev_2026)),itemStyle:{color:T.PAL[0]}}]}}),
        this.fsTable("seyoy",["الشهر","2025","2026","التغيّر","مؤشر 2025"],S.yoy.map(r=>[MON[+r.month-1],this.fsC(r.rev_2025),
          this.fsC(r.rev_2026),r.yoy==null?"—":this.fsC(r.yoy,"pct"),r.index_2025==null?"—":r.index_2025.toFixed(2)]))],
        {k:"se3",sub:"من التجميعات الشهرية (monthly_series) · لا تتأثر بالفلاتر"}));
      out.push(this.advNote("sen","مؤشر 2025 = إيراد الشهر ÷ متوسط شهور 2025 ("+S.n25+" شهرًا). سنة واحدة كاملة لا تكفي لإثبات "
        +"نمط موسمي متكرر؛ اعتبره مؤشرًا أوليًا حتى تتوفر سنة ثانية كاملة.","warn"));
      out.push(this.advLink("sego","التوقع بثلاثة سيناريوهات في «التوقعات»","r:forecast"));
    }
    return out;
  }

  /* ---- 3) سلة المشتريات ----------------------------------------------------- */
  advBasket(X){
    const MIN=5, inv=new Map(), names={};
    for(const l of X.lines||[]){ const t=+l.line_total||0; if(l.is_bonus||!(t>0)) continue;
      let s=inv.get(l.invoice_no); if(!s) inv.set(l.invoice_no,s=new Set()); s.add(String(l.item_code));
      names[l.item_code]=l.item_name; }
    const N=inv.size, nI={}, pc=new Map(); let multi=0, items=0;
    for(const s of inv.values()){ const a=[...s].sort(); items+=a.length; if(a.length>1) multi++;
      a.forEach(x=>{ nI[x]=(nI[x]||0)+1; });
      for(let i=0;i<a.length;i++) for(let j=i+1;j<a.length;j++){ const k=a[i]+"|"+a[j]; pc.set(k,(pc.get(k)||0)+1); } }
    const pairs=[];
    pc.forEach((c,k)=>{ if(c<MIN) return; const [a,b2]=k.split("|");
      pairs.push({a,b:b2,a_name:names[a],b_name:names[b2],n:c,support:c/N,conf_ab:c/nI[a],conf_ba:c/nI[b2],
        lift:c*N/(nI[a]*nI[b2])}); });
    pairs.sort((x,y)=>y.lift-x.lift||y.n-x.n);
    return {N,multi,avg:N?items/N:0,pairs,nI,names,MIN};
  }
  advBasketBody(X,T,api){
    const B=this.advMemo(api,"basket",X2=>this.advBasket(X2)), out=[];
    if(!B.N) return [this.card("سلة المشتريات",this.empty("لا توجد فواتير مدفوعة القيمة في هذا التقسيم"),{k:"bk0"})];
    out.push(this.kpiTiles([["فواتير محلَّلة",T.int(B.N),"بدون البونص والقيم الصفرية","#3b82f6"],
      ["فواتير بأكثر من صنف",T.pct(B.multi/B.N),T.int(B.multi)+" فاتورة","#8b5cf6"],
      ["متوسط الأصناف في الفاتورة",B.avg.toFixed(2),"","#10b981"],
      ["أزواج متكررة (≥"+B.MIN+" فواتير)",T.int(B.pairs.length),"","#f59e0b"]],"bkk"));
    out.push(this.advNote("bkn","الرفع (Lift) > 1 يعني أن الصنفين يُشتريان معًا أكثر مما تتوقعه الصدفة؛ "
      +"الثقة A→B = نسبة فواتير A التي فيها B؛ الدعم = نسبة كل الفواتير التي فيها الاثنان. "
      +"الحد الأدنى "+B.MIN+" فواتير مشتركة حتى لا تُبنى قاعدة على حالة أو اثنتين."));
    out.push(this.card("أقوى الأصناف المشتراة معًا",this.pagedList("bkp",B.pairs,[
      ["الزوج",r=>r.a_name+" + "+r.b_name],["الرفع",r=>r.lift.toFixed(2)],["فواتير مشتركة",r=>T.int(r.n)],
      ["الثقة A→B / B→A",r=>T.pct(r.conf_ab)+" / "+T.pct(r.conf_ba)],["الدعم",r=>T.pct(r.support)]]),
      {k:"bk1",sub:"مرتبة بالرفع · "+B.pairs.length+" زوج"}));
    const items=Object.keys(B.nI).sort((x,y)=>B.nI[y]-B.nI[x]).slice(0,25);
    const cur=items.includes(this.state.advItem)?this.state.advItem:items[0];
    const partners=B.pairs.filter(p=>p.a===cur||p.b===cur).map(p=>{ const other=p.a===cur?p.b:p.a;
      return {name:B.names[other],n:p.n,conf:p.a===cur?p.conf_ab:p.conf_ba,lift:p.lift}; }).sort((x,y)=>y.conf-x.conf);
    out.push(this.card("يُشترى مع الصنف",[
      this.fsPick("bki",items.map(c=>[c,B.names[c]]),cur,"advItem"),
      this.pagedList("bkw",partners,[["يُشترى معه",r=>r.name],["الثقة",r=>T.pct(r.conf)],["الرفع",r=>r.lift.toFixed(2)],
        ["فواتير مشتركة",r=>T.int(r.n)]])],
      {k:"bk2",sub:(B.names[cur]||"")+" · في "+T.int(B.nI[cur]||0)+" فاتورة"}));
    return out;
  }

  /* ---- 4) أفواج العملاء والاحتفاظ ------------------------------------------- */
  advCohort(D,f){
    const lines=this.advLinesNoMonth(D,f).filter(l=>(+l.line_total||0)>0);
    const months=[...new Set(lines.map(l=>l.month))].sort();
    const cust=new Map(); let last="";
    for(const l of lines){ let c=cust.get(l.customer_code);
      if(!c) cust.set(l.customer_code,c={code:l.customer_code,name:l.customer_name,rep:l.rep,months:new Set(),dates:new Set(),sales:0});
      c.months.add(l.month); c.dates.add(l.invoice_date); c.sales+=+l.line_total||0; if(l.invoice_date>last) last=l.invoice_date; }
    const cs=[...cust.values()]; cs.forEach(c=>{ c.first=[...c.months].sort()[0]; });
    const matrix=months.map(m=>{ const mem=cs.filter(c=>c.first===m);
      return {cohort:m,size:mem.length,cells:months.map(m2=>m2<m?null:(mem.length?mem.filter(c=>c.months.has(m2)).length/mem.length:null))}; });
    const flow=months.map((m,i)=>{ const act=cs.filter(c=>c.months.has(m)), prev=i?months[i-1]:null;
      const prevAct=prev?cs.filter(c=>c.months.has(prev)):[];
      const kept=prev?prevAct.filter(c=>c.months.has(m)).length:null;
      return {month:m,active:act.length,new_c:cs.filter(c=>c.first===m).length,
        returning:prev?act.filter(c=>c.first!==m&&!c.months.has(prev)).length:null,
        lost:prev?prevAct.length-kept:null,retention:prev&&prevAct.length?kept/prevAct.length:null}; });
    const recv=new Map(((D.receivables||{}).rows||[]).map(r=>[String(r.customer_code),r]));
    const risk=[];
    cs.forEach(c=>{ const ds=[...c.dates].sort(); const lastD=ds[ds.length-1], since=this.advDays(lastD,last);
      if(ds.length<3) return;
      const gaps=[]; for(let i=1;i<ds.length;i++) gaps.push(this.advDays(ds[i-1],ds[i]));
      gaps.sort((a,b)=>a-b); const med=gaps[Math.floor(gaps.length/2)];
      if(since>=30&&since>2*med){ const r=recv.get(String(c.code));
        risk.push({customer_code:c.code,customer_name:c.name,rep:c.rep,last:lastD,since,median_gap:med,
          n_dates:ds.length,sales:c.sales,outstanding:r?r.outstanding:null}); } });
    risk.sort((a,b)=>b.sales-a.sales);
    return {months,matrix,flow,risk,last,n:cs.length};
  }
  advHeat(k,head,rows){
    const cell=v=>{ if(v==null) return {txt:"",bg:"transparent"}; const a=Math.max(.06,Math.min(.85,v));
      return {txt:Math.round(v*100)+"%",bg:"rgba(16,185,129,"+a.toFixed(2)+")"}; };
    const th={padding:"6px 6px",fontSize:10,fontWeight:700,color:"#94a3b8",whiteSpace:"nowrap",textAlign:"center",
      borderBottom:"1px solid rgba(255,255,255,.14)"};
    return React.createElement("div",{key:k,"data-fs-table":k,style:{overflowX:"auto",maxWidth:"100%"}},
      React.createElement("table",{style:{borderCollapse:"separate",borderSpacing:2,width:"100%"}},
        React.createElement("thead",null,React.createElement("tr",null,head.map((h,i)=>React.createElement("th",{key:i,style:th},h)))),
        React.createElement("tbody",null,rows.map((r,i)=>React.createElement("tr",{key:i},
          [React.createElement("td",{key:"a",style:{fontSize:10.5,color:"#e2e8f0",whiteSpace:"nowrap",padding:"5px 6px"}},r.label),
           React.createElement("td",{key:"b",style:{fontSize:10.5,color:"#cbd5e1",textAlign:"center",fontFamily:"'JetBrains Mono',monospace"}},r.size)]
          .concat(r.cells.map((v,j)=>{ const c=cell(v);
            return React.createElement("td",{key:j,"data-bar":"fill",style:{fontSize:10,textAlign:"center",padding:"5px 4px",borderRadius:5,
              background:c.bg,color:"#e2e8f0",fontFamily:"'JetBrains Mono',monospace"}},c.txt); })))))));
  }
  advCohortBody(X,T,api){
    const st=this.state, f=st.filters||{};
    const K=this.advMemo(api,"cohort",(X2,D,f2)=>this.advCohort(D,f2)), out=[];
    if(!K.n) return [this.card("أفواج العملاء",this.empty("لا يوجد عملاء بمبيعات في هذا التقسيم"),{k:"co0"})];
    const lastF=K.flow[K.flow.length-1], short=m=>this.fsMon(m).split(" ")[0];
    if(f.month&&f.month!=="all") out.push(this.advNote("con","الأفواج تحتاج كل الشهور، فلا يُطبَّق عليها فلتر الشهر؛ باقي الفلاتر تُطبَّق.","warn"));
    out.push(this.kpiTiles([["عملاء نشطون — "+this.fsMon(lastF.month),T.int(lastF.active),"اشتروا في الشهر","#3b82f6"],
      ["احتفاظ شهري",lastF.retention==null?"—":T.pct(lastF.retention),"من نشطي الشهر السابق","#10b981"],
      ["عملاء جدد في اللقطة",T.int(lastF.new_c),"أول شراء لهم في "+this.fsMon(lastF.month),"#8b5cf6"],
      ["معرّضون للتوقف",T.int(K.risk.length),"غابوا أكثر من ضعف دورتهم المعتادة","#ef4444"]],"cok"));
    out.push(this.advNote("con2","الفوج = شهر أول شراء داخل هذه اللقطة. بيانات الفواتير تبدأ "+this.fsMon(K.months[0])
      +"، لذلك فوج "+this.fsMon(K.months[0])+" يضم كل العملاء القائمين قبل ذلك وليس عملاء جددًا (بيانات مقطوعة من اليسار)."));
    out.push(this.card("مصفوفة الاحتفاظ",this.advHeat("coh",["الفوج","العدد"].concat(K.months.map(short)),
      K.matrix.map(r=>({label:short(r.cohort)+(r.cohort===K.months[0]?" *":""),size:r.size,cells:r.cells}))),
      {k:"co1",sub:"نسبة عملاء الفوج الذين اشتروا في كل شهر"}));
    out.push(this.card("حركة العملاء شهريًا",this.fsTable("cof",["الشهر","نشطون","جدد","عائدون","فُقدوا","الاحتفاظ"],
      K.flow.map(r=>[this.fsMon(r.month),T.int(r.active),T.int(r.new_c),r.returning==null?"—":T.int(r.returning),
        r.lost==null?"—":T.int(r.lost),r.retention==null?"—":T.pct(r.retention)])),{k:"co2"}));
    out.push(this.card("عملاء معرّضون للتوقف",this.pagedList("cor",K.risk,[["العميل",r=>r.customer_name],
      ["أيام منذ آخر شراء",r=>T.int(r.since)],["الدورة المعتادة (يوم)",r=>T.int(r.median_gap)],["مبيعات اللقطة",r=>T.num(r.sales)],
      ["آخر شراء",r=>r.last],["المندوب",r=>r.rep],["الرصيد",r=>r.outstanding==null?"—":T.num(r.outstanding)],["أيام الشراء",r=>T.int(r.n_dates)]],
      r=>this.setState({stmt:r.customer_code})),
      {k:"co3",sub:"مقارنةً بآخر فاتورة في اللقطة ("+this.ltr(K.last)+") · 3 أيام شراء على الأقل · غياب ≥ 30 يومًا وأكثر من ضعف الدورة الوسيطة"}));
    return out;
  }

  /* ---- 5) التنبيهات الذكية --------------------------------------------------- */
  advAlerts(X,D,f){
    const TH={overdue_days:60,inactive_days:45,drop:0.20,min_prev:20000,price:0.90,top_n:20};
    const T=this.state.T, out=[];
    const recv=X.recv||[];
    const od=recv.filter(r=>(r.days_overdue||0)>TH.overdue_days).sort((a,b)=>(b.overdue||0)-(a.overdue||0));
    out.push({id:"od60",severity:od.length?"high":"low",title:"متأخرات أكثر من "+TH.overdue_days+" يومًا",
      value:od.reduce((a,r)=>a+(r.overdue||0),0),count:od.length,go:"overdue",
      rows:od.map(r=>({name:r.customer_name,a:r.overdue,b:r.days_overdue,rep:r.rep,code:r.customer_code})),
      cols:["متأخر","أيام التأخر"]});
    const ina=recv.filter(r=>(r.days_since_last||0)>TH.inactive_days&&(r.outstanding||0)>0).sort((a,b)=>b.outstanding-a.outstanding);
    out.push({id:"inactive",severity:ina.length?"high":"low",title:"عملاء بلا شراء منذ أكثر من "+TH.inactive_days+" يومًا وعليهم رصيد",
      value:ina.reduce((a,r)=>a+(r.outstanding||0),0),count:ina.length,go:"aging",
      rows:ina.map(r=>({name:r.customer_name,a:r.outstanding,b:r.days_since_last,rep:r.rep,code:r.customer_code})),
      cols:["الرصيد","أيام بلا شراء"]});
    const L=this.advLinesNoMonth(D,f).filter(l=>(+l.line_total||0)>0);
    const months=[...new Set(L.map(l=>l.month))].sort();
    const lastDate=L.reduce((a,l)=>l.invoice_date>a?l.invoice_date:a,"");
    const partial=lastDate&&+lastDate.slice(8,10)<28;
    const cm=partial?months[months.length-2]:months[months.length-1], pm=partial?months[months.length-3]:months[months.length-2];
    const sumBy=(m,k)=>{ const o={}; L.forEach(l=>{ if(l.month===m){ o[l[k]]=(o[l[k]]||0)+(+l.line_total||0); } }); return o; };
    const cmpTxt=pm&&cm?this.fsMon(cm)+" مقابل "+this.fsMon(pm)+(partial?" (آخر شهر "+this.fsMon(months[months.length-1])+" غير مكتمل فاستُبعد)":""):"";
    if(pm&&cm){
      const a=sumBy(pm,"rep"), b=sumBy(cm,"rep");
      const rd=Object.keys(a).filter(k=>a[k]>=TH.min_prev&&((b[k]||0)-a[k])/a[k]<-TH.drop)
        .map(k=>({name:k,a:a[k],b:b[k]||0,chg:((b[k]||0)-a[k])/a[k]})).sort((x,y)=>x.chg-y.chg);
      out.push({id:"rep_drop",severity:rd.length?"medium":"low",title:"مندوبون انخفضت مبيعاتهم أكثر من "+Math.round(TH.drop*100)+"٪",
        sub:cmpTxt,count:rd.length,value:rd.reduce((s,r)=>s+(r.a-r.b),0),go:"sales",
        rows:rd.map(r=>({name:r.name,a:r.a,b:r.b,c:r.chg})),cols:[this.fsMon(pm),this.fsMon(cm),"التغيّر"]});
      const ca=sumBy(pm,"customer_code"), cb=sumBy(cm,"customer_code"), nm={};
      L.forEach(l=>{ nm[l.customer_code]=l.customer_name; });
      const top=Object.keys(ca).sort((x,y)=>ca[y]-ca[x]).slice(0,TH.top_n);
      const cd=top.filter(k=>((cb[k]||0)-ca[k])/ca[k]<-TH.drop).map(k=>({name:nm[k],code:k,a:ca[k],b:cb[k]||0,c:((cb[k]||0)-ca[k])/ca[k]}))
        .sort((x,y)=>x.c-y.c);
      out.push({id:"cust_drop",severity:cd.length?"medium":"low",title:"من أكبر "+TH.top_n+" عميلًا: انخفاض أكثر من "+Math.round(TH.drop*100)+"٪",
        sub:cmpTxt,count:cd.length,value:cd.reduce((s,r)=>s+(r.a-r.b),0),go:"customers",
        rows:cd,cols:[this.fsMon(pm),this.fsMon(cm),"التغيّر"]});
    }
    /* المقارنة داخل الشهر نفسه: الأسعار رُفعت في مارس–أبريل 2026، فمقارنة يناير
       بوسيط يناير–أغسطس كانت ستُظهر مستوى السعر القديم كأنه خصم. */
    const pl=(X.lines||[]).filter(l=>!l.is_bonus&&(+l.unit_price||0)>0&&(+l.line_total||0)>0), byIM={};
    pl.forEach(l=>{ const k=l.item_code+"|"+l.month; (byIM[k]=byIM[k]||[]).push(l); });
    const prI={};
    Object.keys(byIM).forEach(k=>{ const ls=byIM[k]; if(ls.length<5) return;
      const ps=ls.map(l=>+l.unit_price).sort((a,b)=>a-b), med=ps[Math.floor(ps.length/2)];
      const low=ls.filter(l=>+l.unit_price<TH.price*med); if(!low.length) return;
      const code=ls[0].item_code, o=prI[code]||(prI[code]={name:ls[0].item_name,code,a:0,gap:0,months:[]});
      o.a+=low.length; o.months.push(ls[0].month);
      o.gap+=low.reduce((s,l)=>s+(+l.line_total)*(med/(+l.unit_price)-1),0); });
    const pr=Object.values(prI).map(o=>({...o,b:o.months.length})).sort((a,b)=>b.gap-a.gap);
    out.push({id:"price",severity:pr.length?"medium":"low",title:"بيع بأقل من "+Math.round(TH.price*100)+"٪ من السعر الوسيط للصنف في الشهر نفسه",
      sub:"يتبع الفلاتر · صنف وشهر فيهما 5 بنود على الأقل",count:pr.reduce((s,r)=>s+r.a,0),value:pr.reduce((s,r)=>s+r.gap,0),go:"products",
      rows:pr,cols:["بنود","شهور"],valueLabel:"فرق تقديري عن السعر الوسيط"});
    const zi=(X.invoices||[]).filter(v=>!v.reported_total&&!v.is_bonus);
    out.push({id:"zero",severity:zi.length?"medium":"low",title:"فواتير صفرية القيمة غير مسجلة كبونص",count:zi.length,value:null,go:"quality",
      rows:zi.map(v=>({name:v.customer_name,a:v.qty_total,b:v.invoice_date,inv:v.invoice_no})),cols:["الكمية","التاريخ"]});
    const FA=(window.DASH_FS&&window.DASH_FS.alerts)||[];
    if(window.DASH_FS) out.push({id:"fs",severity:FA.some(a=>a.severity==="high")?"high":FA.length?"medium":"low",
      title:"تنبيهات القوائم المالية (2025)",count:FA.length,value:null,go:"fs_exec",rows:[],cols:[]});
    return {items:out,TH};
  }
  advAlertsBody(X,T,api){
    const A=this.advMemo(api,"alerts",(X2,D,f2)=>this.advAlerts(X2,D,f2)), out=[];
    const act=A.items.filter(a=>a.count>0), rank={high:0,medium:1,low:2};
    out.push(this.kpiTiles([["تنبيهات عالية",T.int(act.filter(a=>a.severity==="high").length),"","#ef4444"],
      ["تنبيهات متوسطة",T.int(act.filter(a=>a.severity==="medium").length),"","#f59e0b"],
      ["قواعد بلا تنبيه",T.int(A.items.length-act.length),"","#10b981"],
      ["القواعد المفحوصة",T.int(A.items.length),"كلها من بيانات الملف","#3b82f6"]],"alk"));
    out.push(this.card("ملخص التنبيهات",this.fsNotes("aln",A.items.slice().sort((a,b)=>rank[a.severity]-rank[b.severity])
      .map(a=>({severity:a.count?a.severity:"low",title:a.title,
        lines:[["العدد",T.int(a.count)],["القيمة",a.value==null?"":T.egp(a.value)],["الفترة",a.sub||""]]}))),{k:"al1"}));
    act.forEach(a=>{
      if(!a.rows.length){ out.push(this.card(a.title,this.advLink("g"+a.id,"افتح القسم المرتبط",a.go),{k:"al_"+a.id})); return; }
      const cols=[["الاسم",r=>r.name]];
      if(a.id==="price") cols.push(["بنود أقل من الحد",r=>T.int(r.a)],["فرق تقديري",r=>T.num(r.gap)],["الشهور",r=>r.months.join("، ")]);
      else if(a.id==="rep_drop"||a.id==="cust_drop") cols.push([a.cols[0],r=>T.num(r.a)],[a.cols[1],r=>T.num(r.b)],["التغيّر",r=>T.pct(r.c)]);
      else if(a.id==="zero") cols.push(["الفاتورة",r=>r.inv],["الكمية",r=>T.num(r.a)],["التاريخ",r=>r.b]);
      else cols.push([a.cols[0],r=>T.num(r.a)],[a.cols[1],r=>T.int(r.b)],["المندوب",r=>r.rep]);
      out.push(this.card(a.title,[this.pagedList("alr"+a.id,a.rows,cols,r=>{ if(r.code&&a.id!=="price") this.setState({stmt:r.code});
          else if(a.id==="price") this.set("item",r.code); }),
        this.advLink("g"+a.id,"افتح القسم المرتبط",a.go)],{k:"al_"+a.id,sub:(a.sub?a.sub+" · ":"")+a.rows.length+" صف"}));
    });
    out.push(this.card("حدود التنبيه",this.fsTable("alth",["القاعدة","الحد"],[
      ["تأخر الاستحقاق",A.TH.overdue_days+" يومًا"],["غياب عن الشراء مع رصيد",A.TH.inactive_days+" يومًا"],
      ["انخفاض شهري (مندوب / عميل)",Math.round(A.TH.drop*100)+"٪"],["أدنى مبيعات سابقة للمندوب",T.egp(A.TH.min_prev)],
      ["أكبر العملاء المراقَبين",A.TH.top_n+" عميلًا"],["السعر مقابل وسيط الصنف في الشهر نفسه",Math.round(A.TH.price*100)+"٪"]]),
      {k:"al9",sub:"قواعد ثابتة معلنة — لا تنبؤ ولا نموذج"}));
    out.push(this.advNote("aln2","لا تنبيهات للمخزون أو تواريخ الصلاحية أو تكلفة الشراء: الملف لا يحتوي هذه البيانات، ولا تُختلق.","warn"));
    return out;
  }

  advSectionBody(s,X,T,api){
    if(s==="adv_abc") return this.advAbcBody(X,T,api);
    if(s==="adv_season") return this.advSeasonBody(X,T,api);
    if(s==="adv_basket") return this.advBasketBody(X,T,api);
    if(s==="adv_cohort") return this.advCohortBody(X,T,api);
    if(s==="adv_alerts") return this.advAlertsBody(X,T,api);
    return null;
  }

  /* جداول «تحليلات متقدمة» لكتالوج التصدير وملف Excel. */
  advExport(out,col,num){
    const st=this.state;
    if(!st.api) return;
    const api=st.api;
    const R=this.advMemo(api,"abcRev",X2=>this.advAbcRevenue(X2));
    const P=this.advMemo(api,"abcProfit",(X2,D,f2)=>this.advAbcProfit(f2));
    const S=this.advMemo(api,"season",X2=>this.advSeason(X2));
    const B=this.advMemo(api,"basket",X2=>this.advBasket(X2));
    const K=this.advMemo(api,"cohort",(X2,D,f2)=>this.advCohort(D,f2));
    const A=this.advMemo(api,"alerts",(X2,D,f2)=>this.advAlerts(X2,D,f2));
    out.push(
      {id:"adv_abc_rev", label:"ABC بالإيراد — بنود الفواتير", rows:R.rows, columns:[
        col("#",null,r=>num(r.rank)), col("الفئة","cls"), col("كود الصنف","item_code"), col("الصنف","item_name"), col("العلامة","brand"),
        col("المبيعات",null,r=>num(r.sales)), col("الحصة",null,r=>num(r.share)), col("التراكمي",null,r=>num(r.cum)),
        col("الكمية",null,r=>num(r.qty)), col("الفواتير",null,r=>num(r.n_invoices)), col("العملاء",null,r=>num(r.n_customers))]},
      {id:"adv_abc_profit", label:"ABC بالربح — جدول الربحية", rows:P?P.rows:[], columns:[
        col("#",null,r=>num(r.rank)), col("فئة الربح","cls"), col("فئة الإيراد","rev_cls"), col("كود الصنف","item_code"),
        col("الصنف","item_name"), col("العلامة","brand"), col("مجمل الربح",null,r=>num(r.gp)), col("هامش المجمل %",null,r=>num(r.gm)),
        col("الإيراد المُسعَّر",null,r=>num(r.revenue)), col("الربح التشغيلي",null,r=>num(r.op)), col("الحصة",null,r=>num(r.share)),
        col("التراكمي",null,r=>num(r.cum))]},
      {id:"adv_abc_uncosted", label:"أصناف بلا تكلفة (خارج ABC بالربح)", rows:P?P.uncosted:[], columns:[
        col("كود الصنف","item_code"), col("الصنف","item_name"), col("الإيراد",null,r=>num(r.revenue))]},
      {id:"adv_weekday", label:"الموسمية — أيام الأسبوع", rows:S.wk, columns:[
        col("اليوم","day"), col("المبيعات",null,r=>num(r.sales)), col("الفواتير",null,r=>num(r.n_invoices)),
        col("أيام العمل",null,r=>num(r.n_days)), col("متوسط اليوم",null,r=>num(r.avg_per_day))]},
      {id:"adv_dom", label:"الموسمية — يوم الشهر", rows:S.dm, columns:[
        col("اليوم",null,r=>num(r.day)), col("المبيعات",null,r=>num(r.sales)), col("الفواتير",null,r=>num(r.n_invoices))]},
      {id:"adv_yoy", label:"الموسمية — 2025 مقابل 2026", rows:S.yoy, columns:[
        col("الشهر","month"), col("2025",null,r=>num(r.rev_2025)), col("2026",null,r=>num(r.rev_2026)),
        col("التغيّر",null,r=>num(r.yoy)), col("مؤشر 2025",null,r=>num(r.index_2025))]},
      {id:"adv_pairs", label:"سلة المشتريات — الأزواج", rows:B.pairs, columns:[
        col("الصنف A","a_name"), col("الصنف B","b_name"), col("فواتير مشتركة",null,r=>num(r.n)), col("الدعم",null,r=>num(r.support)),
        col("الثقة A→B",null,r=>num(r.conf_ab)), col("الثقة B→A",null,r=>num(r.conf_ba)), col("الرفع",null,r=>num(r.lift))]},
      {id:"adv_cohort", label:"أفواج العملاء — مصفوفة الاحتفاظ", rows:K.matrix, columns:[
        col("الفوج","cohort"), col("العدد",null,r=>num(r.size))].concat(K.months.map((m,i)=>col(m,null,r=>num(r.cells[i]))))},
      {id:"adv_flow", label:"أفواج العملاء — الحركة الشهرية", rows:K.flow, columns:[
        col("الشهر","month"), col("نشطون",null,r=>num(r.active)), col("جدد",null,r=>num(r.new_c)),
        col("عائدون",null,r=>num(r.returning)), col("فُقدوا",null,r=>num(r.lost)), col("الاحتفاظ",null,r=>num(r.retention))]},
      {id:"adv_churn", label:"عملاء معرّضون للتوقف", rows:K.risk, columns:[
        col("كود العميل","customer_code"), col("العميل","customer_name"), col("المندوب","rep"), col("آخر شراء","last"),
        col("أيام منذ آخر شراء",null,r=>num(r.since)), col("الدورة الوسيطة",null,r=>num(r.median_gap)),
        col("أيام الشراء",null,r=>num(r.n_dates)), col("مبيعات اللقطة",null,r=>num(r.sales)), col("الرصيد",null,r=>num(r.outstanding))]},
      {id:"adv_alerts", label:"التنبيهات الذكية", rows:A.items, columns:[
        col("القاعدة","id"), col("العنوان","title"), col("الأولوية",null,r=>r.count?r.severity:"low"),
        col("العدد",null,r=>num(r.count)), col("القيمة",null,r=>num(r.value)), col("الفترة","sub")]});
  }

