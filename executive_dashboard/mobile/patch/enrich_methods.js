  /* ==========================================================================
     المرحلة 3 (enrich_mobile.py) — «قرارات وتشغيل»: إضافة فقط.

       بيانات جديدة: window.DASH_OPS (المخزون، المشتريات، الموردون، المرتجعات
       بالصنف — من ملفات التشغيل، بعد التنظيف ومطابقة كل إجمالي بالمطبوع في
       المصدر) و window.DASH_VAL (نتائج نموذج التقييم المعاد حسابه).

     كل رقم يحمل وسمًا: «مُتحقَّق» = من المصدر كما هو أو حساب مباشر منه،
     «تقدير» = حساب من بيانات حقيقية بطريقة معلنة، «افتراض» = قيمة يختارها
     المستخدم أو الإدارة. لا تكلفة ولا كمية ولا تاريخ صلاحية ولا عميل مُختلَق.
     ========================================================================== */

  opsTag(kind){
    const c=kind==="v"?"#10b981":kind==="e"?"#f59e0b":"#a78bfa";
    const t=kind==="v"?"مُتحقَّق":kind==="e"?"تقدير":"افتراض";
    return this.advBadge(t,c);
  }
  /* بطاقة «القرار المقترح»: كل بند = نص + وسم أساسه. */
  opsDecision(k,items){
    const list=(items||[]).filter(Boolean);
    return React.createElement("div",{key:k,"data-ops-decision":k,style:{padding:"11px 12px",borderRadius:14,
        background:"rgba(16,185,129,.08)",border:"1px solid rgba(16,185,129,.30)",display:"flex",flexDirection:"column",gap:7}},
      React.createElement("div",{style:{fontSize:12.5,fontWeight:800,color:"#6ee7b7"}},"القرار المقترح"),
      list.length?list.map((it,i)=>React.createElement("div",{key:i,style:{display:"flex",gap:7,alignItems:"baseline",
          fontSize:11.5,lineHeight:1.8,color:"#e2e8f0"}},
        React.createElement("span",{style:{flex:"none"}},this.opsTag(it.tag||"e")),
        React.createElement("span",{style:{flex:1,minWidth:0}},it.t)))
      :React.createElement("div",{style:{fontSize:11.5,color:"#94a3b8"}},"لا قرار عاجل تظهره البيانات في هذا التقسيم."));
  }
  opsLegend(k){
    return React.createElement("div",{key:k,style:{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center",
        fontSize:10.5,color:"#94a3b8"}},
      this.opsTag("v")," من المصدر أو حساب مباشر منه",this.opsTag("e")," طريقة معلنة على بيانات حقيقية",
      this.opsTag("a")," قيمة مدخلة للمحاكاة");
  }
  /* قائمة ترتيب بأشرطة HTML: الاسم كاملًا فوق الشريط. أشرطة ECharts الأفقية
     تقيس تسمية المحور يسارًا-يمينًا ثم ترسمها الصفحة RTL فتختفي تحت الأعمدة. */
  opsBars(k,rows,fmt){
    const mx=Math.max(0,...rows.map(r=>Math.abs(r.value||0)))||1;
    return React.createElement("div",{key:k,"data-ops-bars":k,style:{display:"flex",flexDirection:"column",gap:7}},
      rows.map((r,i)=>React.createElement("div",{key:i,style:{display:"flex",flexDirection:"column",gap:3}},
        React.createElement("div",{style:{display:"flex",justifyContent:"space-between",gap:8,fontSize:11,color:"#cbd5e1"}},
          React.createElement("span",{style:{minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}},r.name),
          React.createElement("span",{style:{flex:"none",fontFamily:"'JetBrains Mono',monospace",color:"#e2e8f0"}},fmt(r.value))),
        React.createElement("div",{style:{height:8,borderRadius:99,background:"rgba(255,255,255,.06)"}},
          React.createElement("div",{"data-bar":"fill",style:{height:"100%",borderRadius:99,background:r.color||"#3b82f6",
            width:Math.max(2,Math.abs(r.value||0)/mx*100).toFixed(1)+"%"}})))));
  }
  opsMed(a){ if(!a.length) return null; const s=a.slice().sort((x,y)=>x-y), n=s.length;
    return n%2?s[(n-1)/2]:(s[n/2-1]+s[n/2])/2; }
  opsMissing(k){
    return this.card("بيانات التشغيل غير موجودة",this.empty("هذا الملف لا يحتوي window.DASH_OPS."),{k});
  }

  /* ---- أساس مشترك لكل لقطة: الأسماء الموحَّدة، المبيعات بالصنف واليوم ---------- */
  opsBase(D){
    if(this.__opsB&&this.__opsB.D===D) return this.__opsB.v;
    const lines=D.lines||[], nameCount=new Map();
    let last="";
    for(const l of lines){
      if(l.invoice_date>last) last=l.invoice_date;
      const m=nameCount.get(l.customer_code)||new Map(); nameCount.set(l.customer_code,m);
      const nm=(l.customer_name||"").trim(); if(nm) m.set(nm,(m.get(nm)||0)+1);
    }
    const canon=new Map(), multi=[];
    nameCount.forEach((m,code)=>{ const arr=[...m.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
      canon.set(code,arr.length?arr[0][0]:code);
      if(arr.length>1) multi.push({customer_code:code,canonical:arr[0][0],variants:arr.map(x=>x[0]+" ("+x[1]+")").join(" · "),n:arr.length}); });
    /* كمية خارجة من المخزن = كل البنود (البونص يخرج من المخزن أيضًا). */
    const qtyBy=new Map(), lastSale=new Map();
    for(const l of lines){ const c=String(l.item_code);
      if(!qtyBy.has(c)) qtyBy.set(c,[]); qtyBy.get(c).push(l);
      if(!lastSale.get(c)||l.invoice_date>lastSale.get(c)) lastSale.set(c,l.invoice_date); }
    const v={last,canon,multi,qtyBy,lastSale};
    this.__opsB={D,v};
    return v;
  }
  opsDays(a,b){ return this.advDays(a,b); }
  opsAddDays(d,n){ const t=Date.parse(d+"T00:00:00Z")+n*864e5; return new Date(t).toISOString().slice(0,10); }
  /* كمية الصنف في نافذة [from,to] — كل البنود. */
  opsQty(B,code,from,to){
    return (B.qtyBy.get(String(code))||[]).reduce((s,l)=>l.invoice_date>=from&&l.invoice_date<=to?s+(+l.qty||0):s,0);
  }

  /* ======================= 1) المخزون ===================================== */
  opsInventory(D){
    const O=window.DASH_OPS, I=O.inventory, B=this.opsBase(D);
    const jun=I.jun, jul=I.jul, junTot=jun.raw_value+jun.fg_value, julTot=jul.raw_value+jul.fg_value;
    /* القيمة بالموقع = كمية جرد يوليو في الموقع × متوسط تكلفة يوليو للخامة. */
    const wac=new Map(jul.raw.map(r=>[r.name,r.wac]));
    const locV={}, locN={}; I.locations.forEach(l=>{ locV[l]=0; locN[l]=0; });
    let unpriced=0;
    (I.counts["2026-07"].raw||[]).forEach(r=>{ const w=wac.get(r.name);
      if(w==null){ if(r.qty_total>0) unpriced++; return; }
      I.locations.forEach(l=>{ const q=r.qty[l]||0; if(q>0){ locV[l]+=q*w; locN[l]++; } }); });
    const locRows=I.locations.map(l=>({loc:l,value:locV[l],n:locN[l]}));
    const locTot=locRows.reduce((s,r)=>s+r.value,0);
    /* تغطية المنتج التام في 31/8: الكمية ÷ متوسط الخروج اليومي في 30 يومًا حتى آخر فاتورة. */
    const to=B.last, from=this.opsAddDays(to,-29);
    const fgJulPrice=new Map(jul.fg.map(r=>[r.name,r.price]));
    const cov=(I.counts["2026-08"].fg||[]).filter(r=>r.qty>0).map(r=>{
      const price=fgJulPrice.get(r.name);
      const o={name:r.name,qty:r.qty,item_code:r.item_code,match:r.match,price:price==null?null:price,
        value:price==null?null:price*r.qty};
      if(!r.item_code){ o.status="غير مربوط"; return o; }
      const q30=this.opsQty(B,r.item_code,from,to), daily=q30/30, ls=B.lastSale.get(String(r.item_code))||null;
      o.daily=daily; o.cover=daily>0?r.qty/daily:null; o.last_sale=ls; o.since=ls?this.opsDays(ls,to):null;
      o.status=!ls||o.since>60?"بلا بيع ≥60 يومًا":o.cover==null?"بلا بيع في 30 يومًا":o.cover<7?"خطر نفاد":o.cover>45?"تكدّس":"مناسب";
      return o; });
    const risk=cov.filter(r=>r.status==="خطر نفاد").sort((a,b)=>a.cover-b.cover);
    const over=cov.filter(r=>r.status==="تكدّس"||r.status==="بلا بيع ≥60 يومًا"||r.status==="بلا بيع في 30 يومًا")
      .sort((a,b)=>(b.value||0)-(a.value||0));
    const unl=cov.filter(r=>r.status==="غير مربوط").sort((a,b)=>(b.value||0)-(a.value||0));
    const rawTop=jul.raw.filter(r=>r.value>0).sort((a,b)=>b.value-a.value);
    const rawUp=jul.raw.filter(r=>r.chg_vs_jun!=null&&r.value>0).sort((a,b)=>b.chg_vs_jun-a.chg_vs_jun);
    return {junTot,julTot,jun,jul,locRows,locTot,unpriced,cov,risk,over,unl,rawTop,rawUp,from,to};
  }
  opsInventoryBody(X,T,api){
    if(!window.DASH_OPS) return [this.opsMissing("oi0")];
    const V=this.advMemo(api,"opsInv",(X2,D)=>this.opsInventory(D)), C=this.state.C, b=C.ecBase(), out=[];
    const d=V.julTot-V.junTot;
    out.push(this.opsLegend("oil"));
    out.push(this.kpiTiles([
      ["قيمة المخزون 31/7/2026",T.egpK(V.julTot),"خامات "+T.egpK(V.jul.raw_value)+" · تام "+T.egpK(V.jul.fg_value),"#3b82f6"],
      ["التغير عن 30/6/2026",(d<0?"▼ ":"▲ ")+T.egpK(Math.abs(d)),T.pct(Math.abs(d)/V.junTot)+(d<0?" انخفاض":" زيادة"),d<0?"#10b981":"#f59e0b"],
      ["أصناف تام في خطر نفاد",T.int(V.risk.length),"تغطية أقل من 7 أيام في 31/8","#ef4444"],
      ["أصناف تام متكدّسة أو راكدة",T.int(V.over.length),V.over.reduce((s,r)=>s+(r.value||0),0)?"بقيمة ≈ "+T.egpK(V.over.reduce((s,r)=>s+(r.value||0),0))+" بسعر يوليو":"","#f59e0b"]],"oik"));
    out.push(this.card("تقييم المخزون — يونيو مقابل يوليو",[
      React.createElement(EChart,{key:"c",h:C.H.short,title:"تقييم المخزون",option:{...b,
        tooltip:{...b.tooltip,trigger:"axis",valueFormatter:T.egp},legend:{...b.legend,data:["خامات","منتج تام"]},
        grid:{...b.grid,top:32},xAxis:this.fsAx(b,{type:"category",data:["30/6/2026","31/7/2026"]}),
        yAxis:this.fsAx(b,{type:"value",axisLabel:{color:b._muted,fontSize:10,formatter:T.egpK}}),
        series:[{name:"خامات",type:"bar",stack:"s",data:[Math.round(V.jun.raw_value),Math.round(V.jul.raw_value)],itemStyle:{color:T.PAL[0]}},
          {name:"منتج تام",type:"bar",stack:"s",data:[Math.round(V.jun.fg_value),Math.round(V.jul.fg_value)],itemStyle:{color:T.PAL[2]}}]}}),
      this.fsTable("oiv",["البند","30/6/2026","31/7/2026","التغير"],[
        ["خامات",this.fsC(V.jun.raw_value),this.fsC(V.jul.raw_value),this.fsC(V.jul.raw_value-V.jun.raw_value)],
        ["منتج تام (المُسعَّر)",this.fsC(V.jun.fg_value),this.fsC(V.jul.fg_value),this.fsC(V.jul.fg_value-V.jun.fg_value)],
        {cells:["الإجمالي (= المطبوع في ملف المصدر)",this.fsC(V.junTot),this.fsC(V.julTot),this.fsC(d)],bold:true}])],
      {k:"oi1",sub:"مُتحقَّق · ملفا تسعير الجرد · بتكلفة الخامات والتعبئة فقط"}));
    out.push(this.advNote("oin","تقييم المخزون في ملفات المصدر لا يشمل أجورًا مباشرة ولا أعباء صناعية غير مباشرة، "
      +"وبعض أصناف التام بلا وصفة فبقيت بلا سعر. لذلك القيمة هنا أقل من تكلفة الإنتاج الكاملة ولا تُقارن مباشرةً بمخزون الميزانية.","warn"));
    out.push(this.card("أين تقف قيمة الخامات — حسب الموقع",[
      React.createElement(EChart,{key:"c",h:C.H.short,title:"قيمة الخامات حسب الموقع",option:{...b,
        tooltip:{...b.tooltip,trigger:"item",valueFormatter:T.egp},legend:{show:false},
        series:[{type:"pie",radius:["42%","70%"],label:{color:b._muted,fontSize:10,formatter:"{b}\n{d}%"},
          data:V.locRows.filter(r=>r.value>0).map((r,i)=>({name:r.loc,value:Math.round(r.value),itemStyle:{color:T.PAL[i%T.PAL.length]}}))}]}}),
      this.fsTable("oiloc",["الموقع","القيمة التقديرية","الحصة","أصناف لها رصيد"],
        V.locRows.map(r=>[r.loc,this.fsC(r.value),V.locTot?T.pct(r.value/V.locTot):"—",T.int(r.n)]))],
      {k:"oi2",approx:true,sub:"تقدير = كمية جرد 31/7 بالموقع × متوسط تكلفة يوليو"+(V.unpriced?" · "+V.unpriced+" صنف بلا سعر خارج الحساب":"")}));
    const covCols=[["الصنف",r=>r.name],["الحالة",r=>r.status],["الكمية 31/8",r=>T.num(r.qty)],
      ["تغطية (يوم)",r=>r.cover==null?"—":r.cover.toFixed(1)],["خروج يومي",r=>r.daily==null?"—":r.daily.toFixed(1)],
      ["آخر بيع",r=>r.last_sale||"—"],["القيمة بسعر يوليو",r=>r.value==null?"—":T.num(r.value)]];
    out.push(this.card("خطر نفاد — تغطية أقل من 7 أيام",this.pagedList("oir",V.risk,covCols,r=>r.item_code&&this.set("item",r.item_code)),
      {k:"oi3",approx:true,sub:"جرد 31/8 ÷ متوسط الخروج اليومي "+this.ltr(V.from)+" – "+this.ltr(V.to)}));
    out.push(this.card("تكدّس وركود — تغطية أكثر من 45 يومًا أو بلا بيع",this.pagedList("oio",V.over,covCols,r=>r.item_code&&this.set("item",r.item_code)),
      {k:"oi4",approx:true,sub:"مرتبة بالقيمة"}));
    out.push(this.card("كل أصناف التام في جرد 31/8",this.pagedList("oia",V.cov.slice().sort((a,b2)=>(b2.value||0)-(a.value||0)),covCols,
      r=>r.item_code&&this.set("item",r.item_code)),{k:"oi5",sub:V.cov.length+" صنف بكمية · "+V.unl.length+" غير مربوط بكود مبيعات"}));
    out.push(this.advNote("oin2","التغطية تفترض أن وحدة الجرد = وحدة البيع (طبق/كيس). الأيام الناتجة (من أقل من يوم إلى بضعة أسابيع) "
      +"تتسق مع ذلك لكنها لا تُثبته. الصنف غير المربوط بكود مبيعات بتوقيع مطابق لا تُحسب له تغطية ولا يُخمَّن ربطه."));
    out.push(this.card("أعلى الخامات قيمةً وتغيّر متوسط تكلفتها",this.pagedList("oiraw",V.rawTop,[
      ["الخامة",r=>r.name],["القيمة 31/7",r=>T.num(r.value)],["الكمية",r=>T.num(r.qty)],["متوسط التكلفة",r=>r.wac==null?"—":r.wac.toFixed(2)],
      ["التغير عن يونيو",r=>r.chg_vs_jun==null?"—":T.pct(r.chg_vs_jun)],["مشتريات يوليو",r=>T.num(r.purch_value)]]),
      {k:"oi6",sub:"مُتحقَّق · ورقة «جرد الخامات آخر يوليو» بمتوسط التكلفة المرجح"}));
    const ov=V.over.reduce((s,r)=>s+(r.value||0),0), up=V.rawUp.filter(r=>r.chg_vs_jun>0.05).slice(0,3);
    out.push(this.opsDecision("oid",[
      V.risk.length?{t:"جدولة إنتاج فورية لـ "+V.risk.length+" صنف تغطيته أقل من 7 أيام، أولها "+V.risk.slice(0,3).map(r=>r.name+" ("+r.cover.toFixed(1)+" يوم)").join("، ")+".",tag:"e"}:null,
      V.over.length?{t:"إيقاف إنتاج أو تصريف "+V.over.length+" صنف متكدّس/راكد (≈ "+T.egpK(ov)+" بسعر يوليو) قبل أي دفعة جديدة؛ الأولوية "+V.over.slice(0,3).map(r=>r.name).join("، ")+".",tag:"e"}:null,
      up.length?{t:"مراجعة أسعار شراء "+up.map(r=>r.name+" (+"+Math.round(r.chg_vs_jun*100)+"%)").join("، ")+" — ارتفع متوسط تكلفتها عن يونيو.",tag:"v"}:null,
      V.unl.length?{t:"اعتماد ربط "+V.unl.length+" صنف تام بأكواد المبيعات (القائمة في «سجل تنظيف البيانات») حتى تُحسب تغطيته.",tag:"v"}:null]));
    return out;
  }

  /* ======================= 2) المشتريات والموردون ========================== */
  opsPurchases(){
    const O=window.DASH_OPS, P=O.purchases;
    const rows=[].concat((P["2026-07"].rows||[]).map(r=>({...r,month:"2026-07"})),(P["2026-08"].rows||[]).map(r=>({...r,month:"2026-08"})));
    const by=new Map();
    rows.forEach(r=>{ const k=String(r.code); let o=by.get(k);
      if(!o) by.set(k,o={code:k,name:r.name,spend:0,qty:0,n:0,m7:0,m8:0,prices:[],first:null,last:null});
      o.spend+=r.total; o.qty+=r.qty; o.n++; if(r.month==="2026-07") o.m7+=r.total; else o.m8+=r.total;
      if(r.price>0) o.prices.push({p:r.price,q:r.qty,d:r.date});
      if(!o.first||r.date<o.first.d) o.first={d:r.date,p:r.price}; if(!o.last||r.date>=o.last.d) o.last={d:r.date,p:r.price}; });
    const items=[...by.values()].map(o=>{ const ps=o.prices.map(x=>x.p), mn=ps.length?Math.min(...ps):null, mx=ps.length?Math.max(...ps):null;
      const wq=o.prices.reduce((s,x)=>s+x.q,0), wavg=wq?o.prices.reduce((s,x)=>s+x.p*x.q,0)/wq:null;
      return {...o,min:mn,max:mx,wavg,spread:wavg&&mx!=null?(mx-mn)/wavg:null,
        gap:mn==null?0:o.prices.reduce((s,x)=>s+x.q*(x.p-mn),0),
        chg:o.first&&o.last&&o.first.p?(o.last.p-o.first.p)/o.first.p:null,n_prices:new Set(ps).size}; })
      .sort((a,b)=>b.spend-a.spend);
    const tot=items.reduce((s,o)=>s+o.spend,0); let cum=0;
    items.forEach(o=>{ cum+=o.spend; o.cum=tot?cum/tot:0; o.share=tot?o.spend/tot:0; });
    const daily={}; rows.forEach(r=>{ daily[r.date]=(daily[r.date]||0)+r.total; });
    const S=O.suppliers, sup=S.rows.map(r=>({...r,net:r.credit-r.debit})).sort((a,b)=>b.net-a.net);
    const pos=sup.filter(r=>r.net>=50), posTot=pos.reduce((s,r)=>s+r.net,0);
    const adv=sup.filter(r=>r.net<=-50).sort((a,b)=>a.net-b.net);
    const p7=P["2026-07"].total, p8=P["2026-08"].total;
    return {items,tot,p7,p8,daily,sup,pos,posTot,adv,dust:sup.filter(r=>Math.abs(r.net)<50).length,
      net:S.net_credit,asOf:S.as_of,dpo:S.net_credit/((p7+p8)/62),n80:items.filter(o=>o.cum-o.share<0.8).length};
  }
  opsPurchasesBody(X,T,api){
    if(!window.DASH_OPS) return [this.opsMissing("op0")];
    const V=this.advMemo(api,"opsPur",()=>this.opsPurchases()), C=this.state.C, b=C.ecBase(), out=[];
    out.push(this.opsLegend("opl"));
    const top5=V.pos.slice(0,5).reduce((s,r)=>s+r.net,0);
    out.push(this.kpiTiles([
      ["مشتريات يوليو 2026",T.egpK(V.p7),"= إجمالي ورقة المشتريات التفصيلية","#3b82f6"],
      ["مشتريات أغسطس 2026",T.egpK(V.p8),(V.p8>=V.p7?"▲ ":"▼ ")+T.pct(Math.abs(V.p8-V.p7)/V.p7)+" عن يوليو","#8b5cf6"],
      ["أرصدة الموردين "+this.ltr(V.asOf),T.egpK(V.net),"صافي دائن · "+V.sup.length+" مورد","#f59e0b"],
      ["أيام السداد التقديرية",V.dpo.toFixed(1)+" يوم","الرصيد ÷ متوسط المشتريات اليومية يوليو–أغسطس","#10b981"]],"opk"));
    const dates=Object.keys(V.daily).sort();
    out.push(this.card("المشتريات اليومية — يوليو وأغسطس",React.createElement(EChart,{key:"c",h:C.H.short,title:"المشتريات اليومية",option:{...b,
        tooltip:{...b.tooltip,trigger:"axis",valueFormatter:T.egp},grid:{...b.grid,top:14},
        xAxis:this.fsAx(b,{type:"category",data:dates.map(d=>d.slice(8,10)+"/"+d.slice(5,7))}),
        yAxis:this.fsAx(b,{type:"value",axisLabel:{color:b._muted,fontSize:10,formatter:T.egpK}}),
        series:[{name:"المشتريات",type:"bar",data:dates.map(d=>Math.round(V.daily[d])),itemStyle:{color:T.PAL[1],borderRadius:[2,2,0,0]}}]}}),
      {k:"op1",sub:"مُتحقَّق · "+V.items.reduce((s,o)=>s+o.n,0)+" سطر شراء"}));
    out.push(this.card("باريتو الخامات المشتراة",[
      this.kpiTiles([["أصناف تصنع 80% من الإنفاق",T.int(V.n80)+" من "+T.int(V.items.length),"","#3b82f6"],
        ["أكبر صنف",V.items[0]?V.items[0].name:"—",V.items[0]?T.pct(V.items[0].share)+" من الإنفاق":"","#8b5cf6"]],"op2k"),
      this.pagedList("opp",V.items,[["الصنف",r=>r.name],["الإنفاق",r=>T.num(r.spend)],["الحصة / التراكمي",r=>T.pct(r.share)+" / "+T.pct(r.cum)],
        ["يوليو",r=>T.num(r.m7)],["أغسطس",r=>T.num(r.m8)],["الكمية",r=>T.num(r.qty)],["مرات الشراء",r=>T.int(r.n)],["الكود",r=>r.code]])],
      {k:"op2",sub:"يوليو + أغسطس 2026 · مجمّعة بكود الصنف"}));
    const vol=V.items.filter(o=>o.n_prices>1).sort((a,b2)=>b2.gap-a.gap);
    const gapTot=vol.reduce((s,o)=>s+o.gap,0);
    out.push(this.card("تذبذب سعر الشراء",[
      this.advNote("opvn","«الفرق عن أقل سعر» = Σ الكمية × (السعر المدفوع − أقل سعر دُفع للصنف نفسه في الشهرين). "
        +"هو حد أعلى لما كان يمكن توفيره لو اشتُري كل شيء بأفضل سعر تحقق فعلًا — ليس وعدًا بالتوفير: الجودة والكمية والتوقيت قد تختلف."),
      this.kpiTiles([["أصناف بأكثر من سعر",T.int(vol.length),"","#f59e0b"],["الفرق عن أقل سعر (حد أعلى)",T.egpK(gapTot),
        T.pct(V.tot?gapTot/V.tot:0)+" من الإنفاق","#ef4444"]],"opvk"),
      this.pagedList("opv",vol,[["الصنف",r=>r.name],["الفرق عن أقل سعر",r=>T.num(r.gap)],["أقل / أعلى",r=>r.min+" / "+r.max],
        ["المتوسط المرجح",r=>r.wavg==null?"—":r.wavg.toFixed(2)],["المدى ÷ المتوسط",r=>r.spread==null?"—":T.pct(r.spread)],
        ["أول ← آخر سعر",r=>r.chg==null?"—":T.pct(r.chg)],["الإنفاق",r=>T.num(r.spend)]])],
      {k:"op3",approx:true}));
    out.push(this.card("أرصدة الموردين — تركّز الالتزامات",[
      this.kpiTiles([["أكبر 5 موردين",T.pct(V.posTot?top5/V.posTot:0),T.egpK(top5)+" من الأرصدة الدائنة","#ef4444"],
        ["أرصدة مدينة (دفعات مقدمة)",T.int(V.adv.length),V.adv.length?T.egpK(-V.adv.reduce((s,r)=>s+r.net,0)):"","#8b5cf6"]],"opsk"),
      this.opsBars("opsb",V.pos.slice(0,10).map(r=>({name:r.name,value:r.net,color:T.PAL[3]})),T.egpK),
      this.pagedList("ops",V.sup,[["المورد",r=>r.name],["الصافي",r=>T.num(r.net)],["دائن",r=>T.num(r.credit)],["مدين",r=>T.num(r.debit)]])],
      {k:"op4",sub:"مُتحقَّق · "+V.dust+" رصيد أقل من 50 ج.م (فروق تقريب) معروض في الجدول"}));
    const top=vol.slice(0,3);
    out.push(this.opsDecision("opd",[
      top.length?{t:"تفاوض على سعر ثابت شهري لـ "+top.map(o=>o.name).join("، ")+" — أكبر فرق عن أقل سعر محقق ("+T.egpK(top.reduce((s,o)=>s+o.gap,0))+" حد أعلى).",tag:"e"}:null,
      {t:"أيام السداد ≈ "+V.dpo.toFixed(0)+" يومًا مقابل "+((window.DASH_FS&&window.DASH_FS.working_capital)?window.DASH_FS.working_capital.dpo+" يومًا في 31/12/2025":"—")
        +"؛ كل يوم إضافي متفق عليه مع الموردين يحرر ≈ "+T.egpK((V.p7+V.p8)/62)+" نقدًا.",tag:"e"},
      V.posTot&&top5/V.posTot>0.5?{t:"أكثر من نصف الأرصدة الدائنة لدى 5 موردين — جدولة سداد مسبقة معهم تحمي التوريد.",tag:"v"}:null,
      V.adv.length?{t:"تسوية "+V.adv.length+" رصيد مدين لدى موردين (دفعات مقدمة) أو خصمها من الفواتير القادمة.",tag:"v"}:null]));
    return out;
  }

  /* ======================= 3) تمرير التكلفة إلى السعر ====================== */
  opsCostPass(D){
    const O=window.DASH_OPS, B=this.opsBase(D), M=window.DASH_MARGIN;
    const gmBy=new Map(((M&&M.by_item)||[]).map(r=>[String(r.item_code),r]));
    const pm=(code,mon)=>{ let v=0,q=0; (B.qtyBy.get(String(code))||[]).forEach(l=>{
        if(l.month===mon&&!l.is_bonus&&(+l.unit_price||0)>0){ v+=(+l.line_total||0); q+=(+l.qty||0); } });
      return q?{p:v/q,q}:null; };
    const idx=(codes,mon)=>{ let a=0,c=0;
      codes.forEach(code=>{ const b0=pm(code,"2026-06"), b1=pm(code,mon); if(b0&&b1){ a+=b1.p*b0.q; c+=b0.p*b0.q; } });
      return c?a/c-1:null; };
    return O.inventory.recipes.map(r=>{
      let rev=0,gp=0; r.sales_codes.forEach(c=>{ const g=gmBy.get(c); if(g){ rev+=g.revenue_costed||0; gp+=g.gross_profit||0; } });
      const k=rev?1-gp/rev:null, c=(r.kg_jul-r.kg_jun)/r.kg_jun;
      return {...r,cost_chg:c,p_jul:idx(r.sales_codes,"2026-07"),p_aug:idx(r.sales_codes,"2026-08"),cost_share:k,
        room:k==null?null:k*c,names:r.sales_codes.map(cd=>{ const g=gmBy.get(cd); return g?g.item_name:cd; })};
    });
  }
  opsCostPassBody(X,T,api){
    if(!window.DASH_OPS) return [this.opsMissing("oc0")];
    const V=this.advMemo(api,"opsCost",(X2,D)=>this.opsCostPass(D)), C=this.state.C, b=C.ecBase(), out=[];
    out.push(this.opsLegend("ocl"));
    out.push(this.advNote("ocn","تكلفة الكيلو من ورقة «سعر الكجم من الوصفات»: خامات مباشرة فقط لتسع وصفات (بلا تعبئة ولا أجور). "
      +"تغيّر سعر البيع = مؤشر لاسبيرز لأسعار بيع أحجام العائلة نفسها في الفواتير، بأوزان كميات يونيو 2026 (بنود مدفوعة فقط)."));
    out.push(this.card("تكلفة الخامات للكيلو مقابل سعر البيع — يوليو عن يونيو",
      React.createElement(EChart,{key:"c",h:C.H.base,title:"تمرير التكلفة",option:{...b,
        tooltip:{...b.tooltip,trigger:"axis",valueFormatter:v=>v==null?"—":(v*100).toFixed(1)+"%"},
        legend:{...b.legend,data:["تكلفة الكجم","البيع يوليو","البيع أغسطس"]},grid:{...b.grid,top:40},
        xAxis:this.fsAx(b,{type:"category",data:V.map(r=>r.product),axisLabel:{color:b._muted,fontSize:9.5,rotate:30,interval:0}}),
        yAxis:this.fsAx(b,{type:"value",axisLabel:{color:b._muted,fontSize:10,formatter:v=>Math.round(v*100)+"%"}}),
        series:[{name:"تكلفة الكجم",type:"bar",data:V.map(r=>r.cost_chg),itemStyle:{color:T.PAL[3]}},
          {name:"البيع يوليو",type:"bar",data:V.map(r=>r.p_jul),itemStyle:{color:T.PAL[0]}},
          {name:"البيع أغسطس",type:"bar",data:V.map(r=>r.p_aug),itemStyle:{color:T.PAL[2]}}]}}),
      {k:"oc1"}));
    out.push(this.card("الجدول التفصيلي",this.fsTable("oct",["المنتج","كجم يونيو","كجم يوليو","تغير التكلفة","سعر البيع يوليو","سعر البيع أغسطس",
      "حصة التكلفة من السعر","السعر اللازم لحفظ ربح الوحدة"],V.map(r=>[r.product,r.kg_jun.toFixed(2),r.kg_jul.toFixed(2),
        this.fsC(r.cost_chg,"pct"),r.p_jul==null?"—":this.fsC(r.p_jul,"pct"),r.p_aug==null?"—":this.fsC(r.p_aug,"pct"),
        r.cost_share==null?"—":T.pct(r.cost_share),r.room==null?"—":this.fsC(r.room,"pct")])),
      {k:"oc2",approx:true,sub:"«حصة التكلفة» = 1 − هامش المجمل من جدول الربحية لأصناف العائلة"}));
    out.push(this.advNote("ocn2","«السعر اللازم لحفظ ربح الوحدة» = حصة التكلفة × تغيّر تكلفة الخامات، بافتراض أن كل تكلفة الوحدة تتحرك "
      +"بنسبة الخامات. هو حد أعلى للحركة اللازمة: الخامات ليست كل التكلفة. قيمة سالبة = مساحة لخفض السعر دون خسارة ربح الوحدة.","warn"));
    const fell=V.filter(r=>r.cost_chg<0), kept=fell.filter(r=>r.p_jul!=null&&r.p_jul>=0);
    out.push(this.opsDecision("ocd",[
      fell.length?{t:"تكلفة خامات "+fell.length+" من "+V.length+" وصفات انخفضت في يوليو (حتى "+T.pct(Math.min(...fell.map(r=>r.cost_chg)))+")؛ "
        +(kept.length?kept.length+" منها حافظت على سعر البيع أو رفعته، فالفرق يذهب للهامش.":"")+" القرار: الإبقاء على الأسعار الحالية واحتساب الوفر في هامش يوليو–أغسطس، لا خفض السعر قبل التأكد أن الانخفاض مستمر.",tag:"e"}:null,
      {t:"تحديث الوصفات الثلاث غير المرفوعة (مفروم، كبدة، استربس وغيرها) حتى يُحسب سعر كيلو لكل الأصناف — حاليًا 9 وصفات فقط.",tag:"v"}]));
    return out;
  }

  /* ======================= 4) رأس المال العامل ============================= */
  opsWc(D){
    const O=window.DASH_OPS, F=window.DASH_FS, M=window.DASH_MARGIN, R=D.receivables||{};
    const AR=R.total_outstanding||0, INV=O.inventory.jul.raw_value+O.inventory.jul.fg_value, AP=O.suppliers.net_credit;
    const lines=(D.lines||[]).filter(l=>!l.is_bonus&&(+l.line_total||0)>0);
    const months=[...new Set(lines.map(l=>l.month))].sort(), last3=months.slice(-3);
    const s3=lines.filter(l=>last3.includes(l.month)).reduce((s,l)=>s+(+l.line_total),0);
    const dayCount=last3.reduce((s,m)=>s+new Date(Date.UTC(+m.slice(0,4),+m.slice(5,7),0)).getUTCDate(),0);
    const st=((M&&M.statements&&M.statements.by_month)||[]).filter(r=>String(r.period||"").slice(0,4)==="2026");
    const st3=st.slice(-3), cogs3=st3.reduce((s,r)=>s+(r.cogs||0),0);
    const cDays=st3.reduce((s,r)=>{ const m=r.period; return s+new Date(Date.UTC(+m.slice(0,4),+m.slice(5,7),0)).getUTCDate(); },0);
    const P=O.purchases, pDay=(P["2026-07"].total+P["2026-08"].total)/62;
    const salesDay=dayCount?s3/dayCount:0, cogsDay=cDays?cogs3/cDays:0;
    const dso=salesDay?AR/salesDay:null, dio=cogsDay?INV/cogsDay:null, dpo=pDay?AP/pDay:null;
    const bs=F&&F.balance_sheets&&F.balance_sheets["2025-12-31"], wc=F&&F.working_capital;
    return {AR,INV,AP,net:AR+INV-AP,arAsOf:R.as_of,last3,s3,salesDay,cogsDay,pDay,dso,dio,dpo,
      ccc:dso!=null&&dio!=null&&dpo!=null?dso+dio-dpo:null,st3:st3.map(r=>r.period),
      dec:bs?{AR:bs.receivables,INV:bs.inventory,AP:bs.payables,net:bs.receivables+bs.inventory-bs.payables}:null,wc};
  }
  opsWcBody(X,T,api){
    if(!window.DASH_OPS) return [this.opsMissing("ow0")];
    const V=this.advMemo(api,"opsWc",(X2,D)=>this.opsWc(D)), out=[];
    out.push(this.opsLegend("owl"));
    out.push(this.kpiTiles([
      ["رأس المال العامل التجاري",T.egpK(V.net),"عملاء + مخزون − موردون","#3b82f6"],
      ["العملاء "+this.ltr(V.arAsOf||""),T.egpK(V.AR),"مُتحقَّق · لقطة المديونية","#8b5cf6"],
      ["المخزون 31/7/2026",T.egpK(V.INV),"مُتحقَّق · تقييم الجرد","#10b981"],
      ["الموردون 02/09/2026",T.egpK(V.AP),"مُتحقَّق · حسابات الموردين","#f59e0b"]],"owk"));
    const rows=[["العملاء",this.fsC(V.dec&&V.dec.AR),this.fsC(V.AR),this.fsC(V.dec?V.AR-V.dec.AR:null)],
      ["المخزون",this.fsC(V.dec&&V.dec.INV),this.fsC(V.INV),this.fsC(V.dec?V.INV-V.dec.INV:null)],
      ["الموردون (يُطرح)",this.fsC(V.dec&&V.dec.AP),this.fsC(V.AP),this.fsC(V.dec?V.AP-V.dec.AP:null)],
      {cells:["الصافي",this.fsC(V.dec&&V.dec.net),this.fsC(V.net),this.fsC(V.dec?V.net-V.dec.net:null)],bold:true}];
    out.push(this.card("2026 مقابل ميزانية 31/12/2025",this.fsTable("owt",["البند","31/12/2025","2026 (أحدث تاريخ)","التغير"],rows),
      {k:"ow1",approx:true,sub:"تقدير مركّب: ثلاثة تواريخ مختلفة وأسس قياس مختلفة"}));
    out.push(this.advNote("own","المقارنة إرشادية: مخزون 2026 بتكلفة الخامات والتعبئة فقط (بلا أجور ولا أعباء) بينما مخزون الميزانية بأساس المحاسب؛ "
      +"والعملاء من لقطة الفواتير لا من دفتر الأستاذ. لا يُستنتج من الفرق ربح أو خسارة.","warn"));
    const f=v=>v==null?"—":v.toFixed(1)+" يوم", w=V.wc||{};
    out.push(this.card("أيام الدورة النقدية",this.fsTable("owd",["المؤشر","2026 (تقدير)","31/12/2025","الأساس 2026"],[
      ["أيام التحصيل DSO",f(V.dso),w.dso!=null?w.dso+" يوم":"—","العملاء ÷ مبيعات "+V.last3.map(m=>this.fsMon(m).split(" ")[0]).join("–")+" اليومية"],
      ["أيام المخزون DIO",f(V.dio),w.dio!=null?w.dio+" يوم":"—","المخزون ÷ تكلفة مبيعات "+V.st3.map(m=>this.fsMon(m).split(" ")[0]).join("–")+" اليومية"],
      ["أيام السداد DPO",f(V.dpo),w.dpo!=null?w.dpo+" يوم":"—","الموردون ÷ مشتريات يوليو–أغسطس اليومية"],
      {cells:["الدورة النقدية CCC",f(V.ccc),w.ccc!=null?w.ccc+" يوم":"—","DSO + DIO − DPO"],bold:true}]),
      {k:"ow2",approx:true}));
    out.push(this.opsDecision("owd2",[
      V.salesDay?{t:"خفض أيام التحصيل 5 أيام يحرر ≈ "+T.egpK(5*V.salesDay)+" نقدًا (5 × مبيعات يومية "+T.egpK(V.salesDay)+").",tag:"e"}:null,
      V.cogsDay?{t:"خفض المخزون 5 أيام يحرر ≈ "+T.egpK(5*V.cogsDay)+" (5 × تكلفة مبيعات يومية "+T.egpK(V.cogsDay)+") — ابدأ بالأصناف المتكدّسة في قسم «المخزون».",tag:"e"}:null,
      V.pDay?{t:"كل يوم سداد إضافي متفق عليه مع الموردين يساوي ≈ "+T.egpK(V.pDay)+".",tag:"e"}:null]));
    return out;
  }

  /* ======================= 5) قيمة ومخاطر العملاء (RFM + ائتمان) =========== */
  opsRfm(D,f){
    const B=this.opsBase(D), lines=this.advLinesNoMonth(D,f).filter(l=>!l.is_bonus&&(+l.line_total||0)>0), last=B.last;
    const cs=new Map();
    for(const l of lines){ let c=cs.get(l.customer_code);
      if(!c) cs.set(l.customer_code,c={code:l.customer_code,name:B.canon.get(l.customer_code)||l.customer_name,rep:l.rep,
        sales:0,inv:new Set(),last:""});
      c.sales+=+l.line_total; c.inv.add(l.invoice_no); if(l.invoice_date>c.last){ c.last=l.invoice_date; c.rep=l.rep; } }
    const arr=[...cs.values()].map(c=>({...c,freq:c.inv.size,rec:this.opsDays(c.last,last)}));
    const q=(key,asc)=>{ const s=arr.slice().sort((a,b)=>asc?a[key]-b[key]:b[key]-a[key]), n=s.length;
      s.forEach((c,i)=>{ c["s_"+key]=5-Math.floor(5*i/n); }); };
    q("rec",true); q("freq",false); q("sales",false);
    const recv=new Map(((D.receivables||{}).rows||[]).map(r=>[String(r.customer_code),r])), car=D.customer_ar||{};
    const SEG=[
      ["مخاطرة ائتمانية","#ef4444","إيقاف أي ائتمان جديد حتى السداد، وجدولة تحصيل أسبوعية للمتأخر."],
      ["أبطال","#10b981","حماية: أولوية التوريد، لا خصومات إضافية، زيارة شهرية من المندوب."],
      ["في خطر","#f59e0b","زيارة استرجاع خلال أسبوع لمعرفة سبب التوقف قبل خسارة العميل."],
      ["مخلصون","#3b82f6","زيادة السلة بالأصناف التي تُشترى معًا (قسم «سلة المشتريات»)."],
      ["واعدون","#8b5cf6","متابعة الطلب الثاني والثالث لتثبيت العميل."],
      ["خاملون","#64748b","تواصل منخفض التكلفة فقط؛ لا ائتمان جديد دون دفع."],
      ["متوسطون","#94a3b8","متابعة اعتيادية."]];
    arr.forEach(c=>{ const r=recv.get(String(c.code)), a=car[c.code]||{};
      c.outstanding=r?r.outstanding:0; c.overdue=r?r.overdue:0; c.days_overdue=r?r.days_overdue:0;
      c.coll_rate=a.collection_rate==null?null:a.collection_rate;
      c.seg=c.overdue>0&&c.days_overdue>60?"مخاطرة ائتمانية"
        :c.s_rec>=4&&c.s_freq>=4&&c.s_sales>=4?"أبطال"
        :c.s_rec<=2&&(c.s_freq>=3||c.s_sales>=3)?"في خطر"
        :c.s_freq>=3&&c.s_sales>=3?"مخلصون"
        :c.s_rec>=4&&c.s_freq<=2?"واعدون"
        :c.s_rec<=2?"خاملون":"متوسطون"; });
    /* عملاء لهم رصيد ولا مشتريات لهم في اللقطة: لا حداثة ولا تكرار لهم فلا
       يُصنَّفون، لكن يُعدّون ويُذكرون حتى لا يختفي دينهم من القرار. */
    const outside=((D.receivables||{}).rows||[]).filter(r=>(r.outstanding||0)>0&&!cs.has(r.customer_code)&&
      (!f.rep||r.rep===f.rep)&&(!f.customer||r.customer_code===f.customer));
    const tot=arr.reduce((s,c)=>s+c.sales,0);
    const segs=SEG.map(([name,color,action])=>{ const m=arr.filter(c=>c.seg===name);
      return {name,color,action,n:m.length,sales:m.reduce((s,c)=>s+c.sales,0),share:tot?m.reduce((s,c)=>s+c.sales,0)/tot:0,
        outstanding:m.reduce((s,c)=>s+(c.outstanding||0),0),overdue:m.reduce((s,c)=>s+(c.overdue||0),0)}; });
    return {rows:arr.sort((a,b)=>b.sales-a.sales),segs,tot,last,n:arr.length,
      outside:{n:outside.length,outstanding:outside.reduce((s,r)=>s+(r.outstanding||0),0),overdue:outside.reduce((s,r)=>s+(r.overdue||0),0),
        od60:outside.filter(r=>(r.days_overdue||0)>60).length}};
  }
  opsRfmBody(X,T,api){
    const st=this.state, V=this.advMemo(api,"opsRfm",(X2,D,f2)=>this.opsRfm(D,f2)), C=st.C, b=C.ecBase(), out=[];
    if(!V.n) return [this.card("قيمة ومخاطر العملاء",this.empty("لا يوجد عملاء بمبيعات في هذا التقسيم"),{k:"dr0"})];
    out.push(this.opsLegend("drl"));
    const seg=V.segs.find(s=>s.name===st.opsSeg)||V.segs.find(s=>s.n)||V.segs[0];
    const by=n=>V.segs.find(s=>s.name===n)||{n:0,sales:0,overdue:0};
    out.push(this.kpiTiles([["أبطال",T.int(by("أبطال").n),T.pct(by("أبطال").sales/V.tot)+" من المبيعات","#10b981"],
      ["في خطر",T.int(by("في خطر").n),T.egpK(by("في خطر").sales)+" مبيعات سابقة","#f59e0b"],
      ["مخاطرة ائتمانية",T.int(by("مخاطرة ائتمانية").n),T.egpK(by("مخاطرة ائتمانية").overdue)+" متأخر","#ef4444"],
      ["العملاء المصنَّفون",T.int(V.n),"مجموع الشرائح = "+T.int(V.segs.reduce((s,x)=>s+x.n,0)),"#3b82f6"]],"drk"));
    const L=s=>this.ltr(s);
    out.push(this.advNote("drn",["الحداثة "+L("R")+" = أيام منذ آخر شراء حتى "+L(V.last)+"، التكرار "+L("F")+" = عدد الفواتير، القيمة "+L("M")
      +" = المبيعات؛ كل منها خُمسيات من 1 إلى 5 بين العملاء. القواعد بالترتيب: مخاطرة ائتمانية (متأخر وأيام تأخر أكثر من 60) ← أبطال ("
      +L("R, F, M ≥ 4")+") ← في خطر ("+L("R ≤ 2")+" و"+L("F ≥ 3")+" أو "+L("M ≥ 3")+") ← مخلصون ("+L("F, M ≥ 3")+") ← واعدون ("
      +L("R ≥ 4")+" و"+L("F ≤ 2")+") ← خاملون ("+L("R ≤ 2")+") ← متوسطون. الأسماء موحَّدة لكل كود (الأكثر تكرارًا) دون تعديل الأصل."
      +(st.filters&&st.filters.month&&st.filters.month!=="all"?" فلتر الشهر لا ينطبق هنا.":"")].join("")));
    if(V.outside.n) out.push(this.advNote("drn2",V.outside.n+" عميلًا عليهم رصيد "+T.egpK(V.outside.outstanding)+" (متأخر "+T.egpK(V.outside.overdue)
      +"، منهم "+V.outside.od60+" متأخرون أكثر من 60 يومًا) بلا أي شراء في اللقطة، فلا يدخلون الشرائح لأن لا حداثة ولا تكرار لهم. "
      +"ديونهم في «المتأخرات» و«التنبيهات الذكية» — لذلك عدد «مخاطرة ائتمانية» هنا أقل من عدد المتأخرين هناك.","warn"));
    out.push(this.card("الشرائح والإجراء",this.fsTable("drs",["الشريحة","العملاء","المبيعات","الحصة","الرصيد","المتأخر","الإجراء"],
      V.segs.map(s=>[{v:s.name,c:s.color},T.int(s.n),this.fsC(s.sales),T.pct(s.share),this.fsC(s.outstanding),this.fsC(s.overdue),s.action])),
      {k:"dr1",sub:"تقدير بقواعد معلنة"}));
    out.push(this.card("الحداثة مقابل القيمة",React.createElement(EChart,{key:"c",h:C.H.base,title:"خريطة العملاء",option:{...b,
        tooltip:{...b.tooltip,trigger:"item",formatter:p=>{ const r=p.data.r; return r.name+"<br/>"+r.seg+"<br/>المبيعات: "+T.egp(r.sales)
          +"<br/>أيام منذ آخر شراء: "+r.rec+"<br/>الفواتير: "+r.freq+(r.overdue?"<br/>متأخر: "+T.egp(r.overdue):""); }},
        legend:{...b.legend,data:V.segs.filter(s=>s.n).map(s=>s.name),type:"scroll"},grid:{...b.grid,top:40},
        xAxis:this.fsAx(b,{type:"value",name:"أيام منذ آخر شراء",nameLocation:"middle",nameGap:24,nameTextStyle:{color:b._muted,fontSize:10}}),
        yAxis:this.fsAx(b,{type:"log",axisLabel:{color:b._muted,fontSize:10,formatter:T.egpK}}),
        series:V.segs.filter(s=>s.n).map(s=>({name:s.name,type:"scatter",symbolSize:7,itemStyle:{color:s.color},
          data:V.rows.filter(r=>r.seg===s.name).map(r=>({value:[r.rec,Math.max(1,Math.round(r.sales))],r}))}))}}),
      {k:"dr2"}));
    out.push(this.card("عملاء الشريحة",[this.fsPick("drp",V.segs.filter(s=>s.n).map(s=>[s.name,s.name+" ("+s.n+")"]),seg.name,"opsSeg"),
      this.pagedList("drr",V.rows.filter(r=>r.seg===seg.name),[["العميل",r=>r.name],["المبيعات",r=>T.num(r.sales)],["R/F/M",r=>r.s_rec+"/"+r.s_freq+"/"+r.s_sales],
        ["أيام منذ آخر شراء",r=>T.int(r.rec)],["الفواتير",r=>T.int(r.freq)],["الرصيد",r=>T.num(r.outstanding)],["المتأخر",r=>T.num(r.overdue)],
        ["نسبة التحصيل",r=>r.coll_rate==null?"—":T.pct(r.coll_rate)],["المندوب",r=>r.rep]],r=>this.setState({stmt:r.code}))],
      {k:"dr3",sub:seg.action}));
    const risk=by("مخاطرة ائتمانية"), atr=by("في خطر");
    out.push(this.opsDecision("drd",[
      risk.n?{t:"إيقاف الائتمان الجديد لـ "+risk.n+" عميلًا عليهم "+T.egpK(risk.overdue)+" متأخر أكثر من 60 يومًا حتى السداد.",tag:"v"}:null,
      V.outside.od60?{t:"تحويل "+V.outside.od60+" عميلًا متأخرين أكثر من 60 يومًا ولا يشترون منذ بداية اللقطة إلى تحصيل قانوني أو تسوية — لا علاقة بيع قائمة تُحمى.",tag:"v"}:null,
      atr.n?{t:"برنامج استرجاع لـ "+atr.n+" عميلًا «في خطر» كانت مبيعاتهم "+T.egpK(atr.sales)+" — زيارة لكل عميل خلال أسبوع.",tag:"e"}:null,
      by("أبطال").n?{t:by("أبطال").n+" عميلًا «أبطالًا» يصنعون "+T.pct(by("أبطال").sales/V.tot)+" من المبيعات — لا تُعطى لهم خصومات إضافية لأنهم يشترون بالفعل؛ حمايتهم تكون بالخدمة والتوريد.",tag:"e"}:null]));
    return out;
  }

  /* ======================= 6) بطاقة أداء المندوبين ========================= */
  opsReps(D){
    const lines=(D.lines||[]).filter(l=>!l.is_bonus&&(+l.line_total||0)>0), M=window.DASH_MARGIN, Co=D.collections||{};
    const reps=new Map(), months=[...new Set(lines.map(l=>l.month))].sort(), first=new Map();
    const get=r=>{ let o=reps.get(r); if(!o) reps.set(r,o={rep:r,sales:0,cust:new Set()}); return o; };
    for(const l of lines){ const o=get(l.rep); o.sales+=+l.line_total; o.cust.add(l.customer_code);
      const f0=first.get(l.customer_code); if(!f0||l.invoice_date<f0.d) first.set(l.customer_code,{d:l.invoice_date,m:l.month,rep:l.rep}); }
    const newC={}; first.forEach(v=>{ if(v.m!==months[0]) newC[v.rep]=(newC[v.rep]||0)+1; });
    const gm=new Map(((M&&M.by_rep)||[]).map(r=>[r.rep,r])), col=new Map((Co.by_rep||[]).map(r=>[r.rep,r]));
    const rcv={}; ((D.receivables||{}).rows||[]).forEach(r=>{ const o=rcv[r.rep]||(rcv[r.rep]={out:0,od:0}); o.out+=r.outstanding||0; o.od+=r.overdue||0; });
    const ret={}; (Co.returns_rows||[]).forEach(r=>{ ret[r.rep]=(ret[r.rep]||0)+(r.value||0); });
    const zero={}; (D.invoices||[]).forEach(v=>{ if(!v.is_bonus&&!(v.reported_total>0)) zero[v.rep]=(zero[v.rep]||0)+1; });
    const W=[["sales","المبيعات",25,1],["gm","هامش المجمل",20,1],["coll","التحصيل ÷ المبيعات",20,1],
      ["od","المتأخر ÷ الرصيد",15,-1],["ret","المرتجعات ÷ المبيعات",10,-1],["newc","عملاء جدد",10,1]];
    const rows=[...reps.values()].map(o=>{ const g=gm.get(o.rep), c=col.get(o.rep), r=rcv[o.rep];
      return {rep:o.rep,sales:o.sales,n_cust:o.cust.size,gm:g?g.gross_margin_pct/100:null,
        coll:c&&o.sales?c.collected/o.sales:null,od:r&&r.out>0?r.od/r.out:(r?0:null),overdue:r?r.od:0,
        ret:o.sales?(ret[o.rep]||0)/o.sales:null,returns:ret[o.rep]||0,zero:zero[o.rep]||0,newc:newC[o.rep]||0}; });
    const ranked=rows.filter(r=>r.rep!=="غير محدد");
    W.forEach(([k,,,dir])=>{ const vs=ranked.map(r=>r[k]).filter(v=>v!=null), mn=Math.min(...vs), mx=Math.max(...vs);
      ranked.forEach(r=>{ r["n_"+k]=r[k]==null?null:mx===mn?50:100*(dir>0?(r[k]-mn)/(mx-mn):(mx-r[k])/(mx-mn)); }); });
    ranked.forEach(r=>{ let s=0,w=0; W.forEach(([k,,wt])=>{ if(r["n_"+k]!=null){ s+=r["n_"+k]*wt; w+=wt; } });
      r.score=w?s/w:null; r.wcov=w; });
    ranked.sort((a,b)=>b.score-a.score); ranked.forEach((r,i)=>{ r.rank=i+1; });
    const tot=rows.reduce((s,r)=>s+r.sales,0);
    return {rows:ranked.concat(rows.filter(r=>r.rep==="غير محدد")),W,tot,months};
  }
  opsRepsBody(X,T,api){
    const V=this.advMemo(api,"opsReps",(X2,D)=>this.opsReps(D)), C=this.state.C, b=C.ecBase(), out=[];
    out.push(this.opsLegend("dpl"));
    out.push(this.advNote("dpn","الأوزان المعلنة: "+V.W.map(w=>w[1]+" "+w[2]+"%").join(" · ")+". كل مؤشر يُحوَّل إلى 0–100 بين المندوبين "
      +"(الأعلى أفضل؛ المتأخر والمرتجعات بالعكس). مؤشر غير متاح لمندوب يُستبعد وتُعاد معايرة الأوزان. «غير محدد» يُعرض ولا يُرتَّب. "
      +"الهامش من جدول الربحية (تكلفة يونيو 2026)؛ التحصيل والمرتجعات من مستخرج التحصيلات؛ المتأخر من لقطة المديونية."));
    const ranked=V.rows.filter(r=>r.rank);
    out.push(this.card("ترتيب المندوبين",this.opsBars("dpb",ranked.map((r,i)=>({name:r.rank+". "+r.rep,value:r.score,
        color:i<2?"#10b981":i>=ranked.length-2?"#ef4444":"#3b82f6"})),v=>this.ltr(Math.round(v)+" / 100")),
      {k:"dp1",approx:true,sub:"0–100 · مقارنة نسبية بين المندوبين"}));
    out.push(this.card("بطاقة الأداء",this.fsTable("dpt",["المندوب","الدرجة","المبيعات","الحصة","هامش المجمل","التحصيل ÷ المبيعات",
      "المتأخر ÷ الرصيد","المرتجعات ÷ المبيعات","عملاء جدد","فواتير صفرية","العملاء"],
      V.rows.map(r=>[r.rep,r.score==null?"—":Math.round(r.score)+"",this.fsC(r.sales),T.pct(V.tot?r.sales/V.tot:0),
        r.gm==null?"—":T.pct(r.gm),r.coll==null?"—":T.pct(r.coll),r.od==null?"—":T.pct(r.od),r.ret==null?"—":T.pct(r.ret),
        T.int(r.newc),T.int(r.zero),T.int(r.n_cust)]).concat([{cells:["الإجمالي","",this.fsC(V.tot),"100%","","","","","","",""],bold:true}])),
      {k:"dp2",sub:"المبيعات من "+this.fsMon(V.months[0])+" إلى "+this.fsMon(V.months[V.months.length-1])}));
    const lo=ranked.slice(-2), hi=ranked.slice(0,2);
    const weak=r=>{ const w=V.W.filter(x=>r["n_"+x[0]]!=null).sort((a,c)=>r["n_"+a[0]]-r["n_"+c[0]])[0]; return w?w[1]:"—"; };
    out.push(this.opsDecision("dpd",[
      hi.length?{t:"نقل ممارسات "+hi.map(r=>r.rep).join(" و")+" (الأعلى درجة) إلى باقي الفريق.",tag:"e"}:null,
      lo.length?{t:"خطة تحسين شهرية لـ "+lo.map(r=>r.rep+" (أضعف مؤشر: "+weak(r)+")").join("، ")+".",tag:"e"}:null,
      {t:"ربط جزء من الحوافز بالتحصيل والمتأخر وليس المبيعات وحدها — الأوزان أعلاه اقتراح يُعتمد من الإدارة.",tag:"a"}]));
    return out;
  }

  /* ======================= 7) تسرب السعر والبونص ========================== */
  opsLeak(X){
    const L=X.lines||[], byIM={};
    L.forEach(l=>{ const k=l.item_code+"|"+l.month; (byIM[k]=byIM[k]||[]).push(l); });
    const med={}, cv={};
    Object.keys(byIM).forEach(k=>{ const ps=byIM[k].filter(l=>!l.is_bonus&&(+l.unit_price||0)>0).map(l=>+l.unit_price);
      if(ps.length>=5){ med[k]=this.opsMed(ps); const mean=ps.reduce((s,x)=>s+x,0)/ps.length;
        cv[k]=Math.sqrt(ps.reduce((s,x)=>s+(x-mean)*(x-mean),0)/ps.length)/mean; } });
    const leak={rep:{},cust:{},item:{}}, bonus={rep:{},cust:{},item:{}}, add=(o,k,n,v)=>{ const r=o[k]||(o[k]={name:n,key:k,value:0,n:0}); r.value+=v; r.n++; };
    let leakTot=0,bonusTot=0,bonusUnpriced=0,zeroNB=0,zeroNBv=0,sales=0;
    L.forEach(l=>{ const k=l.item_code+"|"+l.month, m=med[k], p=+l.unit_price||0, q=+l.qty||0;
      if(!l.is_bonus&&(+l.line_total||0)>0) sales+=+l.line_total;
      if(l.is_bonus){ if(m){ const v=q*m; bonusTot+=v; add(bonus.rep,l.rep,l.rep,v); add(bonus.cust,l.customer_code,l.customer_name,v); add(bonus.item,l.item_code,l.item_name,v); } else bonusUnpriced++; return; }
      if(!(p>0)){ zeroNB++; if(m) zeroNBv+=q*m; return; }
      if(m&&p<m){ const v=q*(m-p); leakTot+=v; add(leak.rep,l.rep,l.rep,v); add(leak.cust,l.customer_code,l.customer_name,v); add(leak.item,l.item_code,l.item_name,v); } });
    const srt=o=>Object.values(o).sort((a,b)=>b.value-a.value);
    const disp=Object.keys(cv).map(k=>({key:k,item:byIM[k][0].item_name,month:byIM[k][0].month,cv:cv[k],med:med[k],n:byIM[k].length}))
      .sort((a,b)=>b.cv-a.cv);
    return {leakTot,bonusTot,bonusUnpriced,zeroNB,zeroNBv,sales,leakRep:srt(leak.rep),leakCust:srt(leak.cust),leakItem:srt(leak.item),
      bonusRep:srt(bonus.rep),bonusCust:srt(bonus.cust),bonusItem:srt(bonus.item),disp};
  }
  opsLeakBody(X,T,api){
    const V=this.advMemo(api,"opsLeak",X2=>this.opsLeak(X2)), out=[];
    out.push(this.opsLegend("dll"));
    out.push(this.kpiTiles([["فرق البيع تحت السعر الوسيط",T.egpK(V.leakTot),T.pct(V.sales?V.leakTot/V.sales:0)+" من المبيعات","#ef4444"],
      ["البونص بسعر البيع الوسيط",T.egpK(V.bonusTot),T.pct(V.sales?V.bonusTot/V.sales:0)+" من المبيعات","#f59e0b"],
      ["بنود بسعر صفر وليست بونص",T.int(V.zeroNB),V.zeroNBv?"≈ "+T.egpK(V.zeroNBv)+" بالسعر الوسيط":"","#8b5cf6"],
      ["مبيعات الأساس",T.egpK(V.sales),"يتبع الفلاتر","#3b82f6"]],"dlk"));
    out.push(this.advNote("dln","السعر الوسيط = وسيط سعر الوحدة للصنف في الشهر نفسه (بنود مدفوعة، 5 بنود على الأقل). «الفرق تحت الوسيط» = Σ الكمية × (الوسيط − السعر) "
      +"لكل بند أقل من الوسيط: حد أعلى لما يضيع لو كان الوسيط سعرًا قابلًا للتحقيق مع كل العملاء — بعض الخصم مقصود (كميات/عملاء كبار). "
      +"قيمة البونص = كمية البونص × الوسيط؛ "+V.bonusUnpriced+" بند بونص بلا وسيط للصنف في شهره خارج الحساب."));
    const cols=lab=>[[lab,r=>r.name],["القيمة",r=>T.num(r.value)],["البنود",r=>T.int(r.n)]];
    out.push(this.card("الفرق تحت الوسيط — حسب المندوب",this.pagedList("dlr",V.leakRep,cols("المندوب"),r=>this.set("rep",r.key)),{k:"dl1",approx:true}));
    out.push(this.card("الفرق تحت الوسيط — حسب العميل",this.pagedList("dlc",V.leakCust,cols("العميل"),r=>this.setState({stmt:r.key})),{k:"dl2",approx:true}));
    out.push(this.card("الفرق تحت الوسيط — حسب الصنف",this.pagedList("dli",V.leakItem,cols("الصنف"),r=>this.set("item",r.key)),{k:"dl3",approx:true}));
    out.push(this.card("تشتت السعر داخل الشهر",this.pagedList("dld",V.disp,[["الصنف",r=>r.item],["الشهر",r=>this.fsMon(r.month)],
      ["معامل الاختلاف",r=>T.pct(r.cv)],["الوسيط",r=>r.med.toFixed(2)],["البنود",r=>T.int(r.n)]]),
      {k:"dl4",sub:"الانحراف المعياري ÷ المتوسط لسعر الوحدة"}));
    out.push(this.card("البونص — حسب المندوب",this.pagedList("dlb",V.bonusRep,cols("المندوب"),r=>this.set("rep",r.key)),{k:"dl5",approx:true}));
    out.push(this.card("البونص — حسب العميل",this.pagedList("dlbc",V.bonusCust,cols("العميل"),r=>this.setState({stmt:r.key})),{k:"dl6",approx:true}));
    const r0=V.leakRep[0], i0=V.leakItem.slice(0,3);
    out.push(this.opsDecision("dld2",[
      i0.length?{t:"اعتماد حد أدنى لسعر "+i0.map(r=>r.name).join("، ")+" (أكبر فرق تحت الوسيط)، وأي سعر أقل يحتاج موافقة مكتوبة.",tag:"e"}:null,
      r0?{t:"مراجعة خصومات "+r0.name+": "+T.egpK(r0.value)+" تحت الوسيط في "+T.int(r0.n)+" بند.",tag:"e"}:null,
      V.zeroNB?{t:"تصحيح "+V.zeroNB+" بند بسعر صفر غير مسجل كبونص: إما تسجيله بونصًا بقاعدة معلنة أو تسعيره.",tag:"v"}:null,
      V.bonusTot?{t:"البونص يساوي "+T.pct(V.sales?V.bonusTot/V.sales:0)+" من المبيعات بالسعر الوسيط — يُربط بقاعدة الخصم المعلنة في اللقطة ويُراجع شهريًا.",tag:"e"}:null]));
    return out;
  }

  /* ======================= 8) المرتجعات ================================== */
  opsRet(D){
    const O=window.DASH_OPS, B=this.opsBase(D), Co=D.collections||{}, rr=Co.returns_rows||[];
    const lines=(D.lines||[]).filter(l=>!l.is_bonus&&(+l.line_total||0)>0);
    const salesM={}, salesRep={}, salesCust={}, salesItemM={};
    lines.forEach(l=>{ const v=+l.line_total; salesM[l.month]=(salesM[l.month]||0)+v; salesRep[l.rep]=(salesRep[l.rep]||0)+v;
      salesCust[l.customer_code]=(salesCust[l.customer_code]||0)+v;
      const k=l.item_code+"|"+l.month; salesItemM[k]=(salesItemM[k]||0)+v; });
    const months=Object.keys(salesM).sort(), retM={}, byRep={}, byCust={};
    rr.forEach(r=>{ retM[r.month]=(retM[r.month]||0)+(r.value||0);
      const a=byRep[r.rep]||(byRep[r.rep]={name:r.rep,value:0,n:0}); a.value+=r.value||0; a.n++;
      const c=byCust[r.customer_code]||(byCust[r.customer_code]={name:B.canon.get(r.customer_code)||r.customer_name,code:r.customer_code,value:0,n:0}); c.value+=r.value||0; c.n++; });
    const monthly=months.map(m=>({month:m,sales:salesM[m],returns:retM[m]||0,rate:salesM[m]?(retM[m]||0)/salesM[m]:null}));
    const reps=Object.values(byRep).map(r=>({...r,rate:salesRep[r.name]?r.value/salesRep[r.name]:null})).sort((a,b)=>b.value-a.value);
    const cust=Object.values(byCust).map(r=>({...r,rate:salesCust[r.code]?r.value/salesCust[r.code]:null})).sort((a,b)=>b.value-a.value);
    /* بالصنف: يوليو وأغسطس فقط (ملفات المرتجعات بالصنف). */
    const RI=O.returns_items, items={}, regions={}, recon=[];
    Object.keys(RI).sort().forEach(m=>{ const R=RI[m];
      recon.push({month:m,pdf:R.total,snap:retM[m]||0,diff:R.total-(retM[m]||0),n:R.rows.length,zero:R.rows.filter(x=>!(x.value>0)).length});
      R.rows.forEach(x=>{ const k=x.item_code||("~"+x.item);
        const o=items[k]||(items[k]={name:x.item_name_sales||x.item,code:x.item_code,value:0,qty:0,n:0,sales:0,months:new Set()});
        o.value+=x.value; o.qty+=x.qty; o.n++; o.months.add(m);
        const g=regions[x.region]||(regions[x.region]={name:x.region,value:0,n:0}); g.value+=x.value; g.n++; }); });
    Object.values(items).forEach(o=>{ if(o.code) o.months.forEach(m=>{ o.sales+=salesItemM[o.code+"|"+m]||0; });
      o.rate=o.sales?o.value/o.sales:null; o.months=[...o.months].join("، "); });
    return {monthly,reps,cust,items:Object.values(items).sort((a,b)=>b.value-a.value),
      regions:Object.values(regions).sort((a,b)=>b.value-a.value),recon,
      tot:rr.reduce((s,r)=>s+(r.value||0),0),sales:lines.reduce((s,l)=>s+(+l.line_total),0)};
  }
  opsRetBody(X,T,api){
    if(!window.DASH_OPS) return [this.opsMissing("dt0")];
    const V=this.advMemo(api,"opsRet",(X2,D)=>this.opsRet(D)), C=this.state.C, b=C.ecBase(), out=[];
    out.push(this.opsLegend("dtl"));
    const hiI=V.items.filter(o=>o.rate!=null&&o.rate>0.05);
    out.push(this.kpiTiles([["المرتجعات في اللقطة",T.egpK(V.tot),T.pct(V.sales?V.tot/V.sales:0)+" من المبيعات","#ef4444"],
      ["أصناف مرتجعها > 5% (يوليو–أغسطس)",T.int(hiI.length),"","#f59e0b"],
      ["مطابقة ملفات الصنف مع اللقطة",V.recon.every(r=>Math.abs(r.diff)<1)?"مطابقة":"فرق",V.recon.map(r=>this.fsMon(r.month).split(" ")[0]+" "+T.egpK(r.pdf)).join(" · "),
        V.recon.every(r=>Math.abs(r.diff)<1)?"#10b981":"#ef4444"],
      ["مرتجعات بقيمة صفر",T.int(V.recon.reduce((s,r)=>s+r.zero,0)),"كمية بلا قيمة في ملفات الصنف","#8b5cf6"]],"dtk"));
    out.push(this.card("نسبة المرتجعات شهريًا",React.createElement(EChart,{key:"c",h:C.H.short,title:"المرتجعات شهريًا",option:{...b,
        tooltip:{...b.tooltip,trigger:"axis"},legend:{...b.legend,data:["المرتجعات","النسبة من المبيعات"]},grid:{...b.grid,top:32},
        xAxis:this.fsAx(b,{type:"category",data:V.monthly.map(r=>this.fsMon(r.month).split(" ")[0])}),
        yAxis:[this.fsAx(b,{type:"value",axisLabel:{color:b._muted,fontSize:10,formatter:T.egpK}}),
          this.fsAx(b,{type:"value",splitLine:{show:false},axisLabel:{color:b._muted,fontSize:10,formatter:v=>(v*100).toFixed(1)+"%"}})],
        series:[{name:"المرتجعات",type:"bar",data:V.monthly.map(r=>Math.round(r.returns)),itemStyle:{color:T.PAL[3]},tooltip:{valueFormatter:T.egp}},
          {name:"النسبة من المبيعات",type:"line",yAxisIndex:1,data:V.monthly.map(r=>r.rate),itemStyle:{color:T.PAL[4]},
            tooltip:{valueFormatter:v=>v==null?"—":(v*100).toFixed(2)+"%"}}]}}),
      {k:"dt1",sub:"مُتحقَّق · مستخرج المرتجعات في اللقطة ÷ مبيعات البنود"}));
    out.push(this.card("المرتجعات حسب الصنف — يوليو وأغسطس",this.pagedList("dti",V.items,[["الصنف",r=>r.name],["القيمة",r=>T.num(r.value)],
      ["النسبة من مبيعات الصنف",r=>r.rate==null?"—":T.pct(r.rate)],["الكمية",r=>T.num(r.qty)],["البنود",r=>T.int(r.n)],["الشهور",r=>r.months]],
      r=>r.code&&this.set("item",r.code)),{k:"dt2",sub:"مُتحقَّق · ملفا المرتجعات بالصنف · كل الأصناف مربوطة بأكواد المبيعات"}));
    out.push(this.card("حسب المندوب",this.pagedList("dtr",V.reps,[["المندوب",r=>r.name],["القيمة",r=>T.num(r.value)],
      ["النسبة من مبيعاته",r=>r.rate==null?"—":T.pct(r.rate)],["الحركات",r=>T.int(r.n)]],r=>this.set("rep",r.name)),{k:"dt3"}));
    out.push(this.card("حسب العميل",this.pagedList("dtc",V.cust,[["العميل",r=>r.name],["القيمة",r=>T.num(r.value)],
      ["النسبة من مشترياته",r=>r.rate==null?"—":T.pct(r.rate)],["الحركات",r=>T.int(r.n)]],r=>this.setState({stmt:r.code})),{k:"dt4"}));
    out.push(this.card("حسب المحافظة — يوليو وأغسطس",this.fsTable("dtg",["المحافظة","القيمة","الحركات"],
      V.regions.map(r=>[r.name,this.fsC(r.value),T.int(r.n)])),{k:"dt5",sub:"أسماء المحافظات موحَّدة الكتابة · «غير محددة» = مطبوعة «...» في المصدر"}));
    out.push(this.card("المطابقة",this.fsTable("dtm",["الشهر","ملف الصنف (PDF)","اللقطة","الفرق","الحركات"],
      V.recon.map(r=>[this.fsMon(r.month),this.fsC(r.pdf),this.fsC(r.snap),this.fsC(r.diff),T.int(r.n)])),{k:"dt6"}));
    out.push(this.opsDecision("dtd",[
      hiI.length?{t:"فحص جودة/صلاحية "+hiI.slice(0,3).map(o=>o.name+" ("+T.pct(o.rate)+")").join("، ")+" — مرتجعها أعلى من 5% من مبيعاتها في يوليو–أغسطس.",tag:"v"}:null,
      V.cust[0]?{t:"مراجعة "+V.cust.slice(0,3).map(c=>c.name).join("، ")+" (أعلى مرتجعات): هل هي تلف نقل، أم إرجاع لبضاعة راكدة عند العميل؟",tag:"v"}:null,
      {t:"تسجيل سبب المرتجع (تلف / صلاحية / خطأ طلب) في النظام — الملفات الحالية لا تحمل السبب، فلا يمكن فصل مشكلة الجودة عن مشكلة البيع.",tag:"v"}]));
    return out;
  }

  /* ======================= 9) محاكي القرار =============================== */
  /* الأساس = شهور 2026 المقيسة التي لها تفصيل مصروفات (بيع/إدارية/تشغيلية/تمويلية).
     يناير–مارس موزَّعة من قائمة ربعية بإجمالي مصروفات بلا تفصيل، فلا يُعرف منها
     الجزء المتغير مع المبيعات؛ تُستبعد بدل تقسيمها تخمينًا. */
  opsWhatIfBase(){
    const M=window.DASH_MARGIN, all=((M&&M.statements&&M.statements.by_month)||[]).filter(r=>String(r.period||"").slice(0,4)==="2026");
    const st=all.filter(r=>!r.estimated&&r.categories&&Object.keys(r.categories).length);
    const sum=f=>st.reduce((s,r)=>s+(f(r)||0),0), cat=k=>sum(r=>r.categories[k]);
    return {months:st.map(r=>r.period),skipped:all.filter(r=>!st.includes(r)).map(r=>r.period),S:sum(r=>r.net_sales),COGS:sum(r=>r.cogs),
      sell:cat("selling"),fix:cat("admin")+cat("operating")+cat("financing"),net:sum(r=>r.net_profit)};
  }
  opsWhatIfCalc(B0,p,v,c,o){
    const rev=B0.S*(1+p)*(1+v), cogs=B0.COGS*(1+v)*(1+c), sell=B0.sell*(1+p)*(1+v), fix=B0.fix*(1+o);
    const gp=rev-cogs, net=gp-sell-fix;
    const den=B0.S*(1+p)-B0.COGS*(1+c)-B0.sell*(1+p);
    return {rev,cogs,gp,gm:rev?gp/rev:null,sell,fix,net,nm:rev?net/rev:null,be:den>0?(B0.net+fix)/den-1:null};
  }
  opsWhatIfBody(X,T,api){
    const st=this.state, B0=this.opsWhatIfBase(), out=[];
    if(!B0.months.length) return [this.card("محاكي القرار",this.empty("لا توجد قوائم 2026 في جدول الربحية"),{k:"dw0"})];
    const g=(k,d)=>st[k]==null?d:st[k];
    const p=g("wiP",0), v=g("wiV",0), c=g("wiC",0), o=g("wiO",0);
    const base=this.opsWhatIfCalc(B0,0,0,0,0), r=this.opsWhatIfCalc(B0,p,v,c,o);
    const chips=a=>a.map(x=>[x,(x>0?"+":"")+Math.round(x*100)+"%"]);
    out.push(this.opsLegend("dwl"));
    out.push(this.advNote("dwn","الأساس: قوائم 2026 المقيسة "+this.fsMon(B0.months[0])+" – "+this.fsMon(B0.months[B0.months.length-1])
      +" ("+B0.months.length+" شهور"+(B0.skipped.length?"؛ استُبعدت "+B0.skipped.map(m=>this.fsMon(m).split(" ")[0]).join("، ")
        +" لأنها موزَّعة من قائمة ربعية بلا تفصيل للمصروفات":"")+"). "
      +"الافتراضات المعلنة: مصروفات البيع تتحرك مع الإيراد؛ الإدارية والتشغيلية والتمويلية ثابتة إلا بتغيير «المصروفات الثابتة»؛ تغيّر التكلفة يطبَّق على تكلفة الوحدة كلها."));
    out.push(this.card("الروافع",[
      React.createElement("div",{key:"l1",style:{fontSize:11,color:"#94a3b8"}},"تغيير سعر البيع"),this.fsPick("wip",chips([-0.1,-0.05,-0.02,0,0.02,0.05,0.1]),p,"wiP"),
      React.createElement("div",{key:"l2",style:{fontSize:11,color:"#94a3b8"}},"تغيير الكمية المباعة"),this.fsPick("wiv",chips([-0.2,-0.1,-0.05,0,0.05,0.1,0.2]),v,"wiV"),
      React.createElement("div",{key:"l3",style:{fontSize:11,color:"#94a3b8"}},"تغيير تكلفة الوحدة"),this.fsPick("wic",chips([-0.1,-0.05,0,0.05,0.1,0.15,0.2]),c,"wiC"),
      React.createElement("div",{key:"l4",style:{fontSize:11,color:"#94a3b8"}},"تغيير المصروفات الثابتة"),this.fsPick("wio",chips([-0.1,-0.05,0,0.05,0.1]),o,"wiO")],
      {k:"dw1",sub:"افتراض — اختر قيمة لكل رافعة"}));
    const dlt=(a,b2)=>{ const d=a-b2; return (d>=0?"▲ ":"▼ ")+T.egpK(Math.abs(d)); };
    out.push(this.kpiTiles([["صافي المبيعات",T.egpK(r.rev),dlt(r.rev,base.rev),"#3b82f6"],
      ["مجمل الربح",T.egpK(r.gp),"هامش "+T.pct(r.gm)+" ("+(r.gm>=base.gm?"+":"")+((r.gm-base.gm)*100).toFixed(1)+" نقطة)","#10b981"],
      ["صافي الربح قبل الإهلاك",T.egpK(r.net),dlt(r.net,base.net),r.net>=base.net?"#10b981":"#ef4444"],
      ["الكمية اللازمة للحفاظ على صافي الأساس",r.be==null?"—":(r.be>=0?"+":"")+T.pct(r.be),"بالسعر والتكلفة المختارين","#f59e0b"]],"dwk"));
    out.push(this.card("الأساس مقابل السيناريو",this.fsTable("dwt",["البند","الأساس","السيناريو","الفرق"],[
      ["صافي المبيعات",this.fsC(base.rev),this.fsC(r.rev),this.fsC(r.rev-base.rev)],
      ["تكلفة المبيعات",this.fsC(-base.cogs),this.fsC(-r.cogs),this.fsC(base.cogs-r.cogs)],
      {cells:["مجمل الربح",this.fsC(base.gp),this.fsC(r.gp),this.fsC(r.gp-base.gp)],bold:true},
      ["مصروفات البيع",this.fsC(-base.sell),this.fsC(-r.sell),this.fsC(base.sell-r.sell)],
      ["مصروفات ثابتة",this.fsC(-base.fix),this.fsC(-r.fix),this.fsC(base.fix-r.fix)],
      {cells:["صافي الربح قبل الإهلاك",this.fsC(base.net),this.fsC(r.net),this.fsC(r.net-base.net)],bold:true}]),
      {k:"dw2",approx:true,sub:"الأساس = مجموع قوائم 2026 (مُتحقَّق) · السيناريو = تقدير"}));
    const PS=[-0.05,-0.02,0,0.02,0.05], CS=[-0.05,0,0.05,0.1,0.15];
    out.push(this.card("صافي الربح: السعر × التكلفة (الكمية "+((v>=0?"+":"")+Math.round(v*100))+"%)",
      this.fsTable("dwg",["تكلفة الوحدة ↓ / السعر ←"].concat(PS.map(x=>(x>0?"+":"")+Math.round(x*100)+"%")),
        CS.map(cc=>[(cc>0?"+":"")+Math.round(cc*100)+"%"].concat(PS.map(pp=>{ const z=this.opsWhatIfCalc(B0,pp,v,cc,o);
          return {v:T.egpK(z.net),c:z.net<base.net?"#fca5a5":"#6ee7b7"}; })))),
      {k:"dw3",approx:true,sub:"أخضر = أعلى من صافي الأساس"}));
    out.push(this.opsDecision("dwd",[
      {t:"كل 1% في سعر البيع = "+T.egpK(B0.S*0.01*(1-B0.sell/B0.S))+" صافي ربح إضافي على أساس "+B0.months.length+" شهور (بعد مصروفات البيع المتغيرة).",tag:"e"},
      {t:"كل 1% في تكلفة الوحدة = "+T.egpK(B0.COGS*0.01)+" — رفع التكلفة 5% يحتاج رفع السعر ≈ "+T.pct(B0.COGS*0.05/(B0.S-B0.sell))+" لحفظ صافي الربح.",tag:"e"},
      r.be!=null&&p<0?{t:"خفض السعر "+T.pct(-p)+" يحتاج زيادة الكمية "+T.pct(r.be)+" فقط للتعادل مع صافي الأساس — لا يُعتمد خفض قبل التأكد من مرونة الطلب.",tag:"e"}:null]));
    return out;
  }

  /* ======================= 10) التقييم والنسب ============================== */
  opsValBody(X,T,api){
    const VAL=window.DASH_VAL, F=window.DASH_FS, st=this.state, C=st.C, b=C.ecBase(), out=[];
    if(!VAL) return [this.card("التقييم",this.empty("لا توجد نتائج نموذج تقييم (DASH_VAL) في هذا الملف"),{k:"dv0"})];
    const sc=st.valSc||"2", S=VAL.scenarios[sc], A=VAL.axes, NM={"1":"متشائم","2":"أساسي","3":"متفائل"};
    out.push(this.opsLegend("dvl"));
    out.push(this.advNote("dvn","نتائج توضيحية من نموذج Excel المعاد حسابه (3 قوائم + DCF + LBO). معدل الخصم والنمو ومضاعفات الدخول والخروج افتراضات "
      +"منخفضة الثقة وليست من بيانات الشركة — هذه ليست قيمة الشركة ولا رأيًا في القيمة؛ تُقرأ النطاقات لا الرقم الواحد.","warn"));
    out.push(this.card("السيناريو",this.fsPick("dvs",[["1","متشائم"],["2","أساسي"],["3","متفائل"]],sc,"valSc"),{k:"dv1",sub:"افتراض"}));
    const minC=Math.min(...S.cash);
    out.push(this.kpiTiles([["قيمة حقوق الملكية (DCF)",T.egpK(S.eqv),"النطاق "+T.egpK(S.grid_min)+" – "+T.egpK(S.grid_max),"#3b82f6"],
      ["قيمة المنشأة EV",T.egpK(S.ev),"EV ÷ EBITDA 2026 = "+S.evx.toFixed(2)+"x · القيمة النهائية "+T.pct(S.tvpct),"#8b5cf6"],
      ["IRR استحواذ توضيحي",T.pct(S.irr),"MOIC "+S.moic.toFixed(2)+"x","#10b981"],
      ["أدنى نقدية متوقعة",T.egpK(minC),minC<0?"فجوة تمويل في السيناريو":"لا فجوة","#"+(minC<0?"ef4444":"10b981")]],"dvk"));
    const yrs=["2026","2027","2028","2029","2030"];
    out.push(this.card("التوقع — "+NM[sc],React.createElement(EChart,{key:"c",h:C.H.base,title:"التوقع",option:{...b,
        tooltip:{...b.tooltip,trigger:"axis",valueFormatter:T.egp},legend:{...b.legend,data:["الإيراد","EBITDA","صافي الربح","النقدية آخر السنة"]},
        grid:{...b.grid,top:40},xAxis:this.fsAx(b,{type:"category",data:yrs}),
        yAxis:this.fsAx(b,{type:"value",axisLabel:{color:b._muted,fontSize:10,formatter:T.egpK}}),
        series:[{name:"الإيراد",type:"bar",data:S.rev.map(Math.round),itemStyle:{color:T.PAL[0]}},
          {name:"EBITDA",type:"bar",data:S.ebitda.map(Math.round),itemStyle:{color:T.PAL[2]}},
          {name:"صافي الربح",type:"line",data:S.ni.map(Math.round),itemStyle:{color:T.PAL[1]}},
          {name:"النقدية آخر السنة",type:"line",data:S.cash.map(Math.round),itemStyle:{color:T.PAL[3]},lineStyle:{type:"dashed"}}]}}),
      {k:"dv2",approx:true,sub:"FY2026 مرسّى على يناير–يوليو الفعلي"}));
    const pc=x=>(x*100).toFixed(1)+"%";
    const wa=[-2,-1,0,1,2].map(i=>A.wacc+i*A.wacc_step), ga=[-2,-1,0,1,2].map(i=>A.g+i*A.g_step);
    out.push(this.card("حساسية قيمة حقوق الملكية — WACC × النمو النهائي",this.fsTable("dvg",["WACC ↓ / g ←"].concat(ga.map(pc)),
      S.grid.map((row,i)=>[pc(wa[i])].concat(row.map((x,j)=>({v:T.egpK(x),c:i===2&&j===2?"#6ee7b7":null}))))),{k:"dv3",approx:true}));
    const ea=[-2,-1,0,1,2].map(i=>A.em+i*A.m_step), xa=[-2,-1,0,1,2].map(i=>A.xm+i*A.m_step);
    if(S.lbo_grid) out.push(this.card("حساسية IRR — مضاعف الدخول × مضاعف الخروج",this.fsTable("dvi",["الدخول ↓ / الخروج ←"].concat(xa.map(x=>x.toFixed(1)+"x")),
      S.lbo_grid.map((row,i)=>[ea[i].toFixed(1)+"x"].concat(row.map((x,j)=>({v:pc(x),c:i===2&&j===2?"#6ee7b7":x<0.2?"#fca5a5":null}))))),
      {k:"dv4",approx:true,sub:"أحمر = أقل من 20%"}));
    out.push(this.card("فحوص النموذج",this.fsTable("dvc",["الفحص","النتيجة"],S.checks.filter(c=>c[1]!=null).map(c=>[c[0],c[1]])),
      {k:"dv5",sub:"من ورقة Checks بعد إعادة الحساب"}));
    if(F&&F.balance_sheets){
      const ds=Object.keys(F.balance_sheets).sort(), R=[["التداول","current_ratio","x"],["السريعة","quick_ratio","x"],["النقدية","cash_ratio","x"],
        ["الالتزامات ÷ حقوق الملكية","liabilities_to_equity","x"],["الدين ÷ حقوق الملكية","debt_to_equity","x"],["حقوق الملكية ÷ الأصول","equity_ratio","p"],
        ["صافي الدين","net_debt","n"],["رأس المال العامل","working_capital","n"]];
      out.push(this.card("النسب المالية — الميزانيات",this.fsTable("dvr",["النسبة"].concat(ds.map(d=>this.fsDate(d))),
        R.map(([lab,k,t])=>[lab].concat(ds.map(d=>{ const x=F.balance_sheets[d][k]; return x==null?"—":t==="x"?x.toFixed(2)+"x":t==="p"?T.pct(x):this.fsC(x); })))),
        {k:"dv6",sub:"مُتحقَّق · من الميزانيات المتوازنة"}));
    }
    const S1=VAL.scenarios["1"];
    out.push(this.opsDecision("dvd",[
      {t:"لأي نقاش تمويل أو شراكة: استخدم النطاق "+T.egpK(S.grid_min)+" – "+T.egpK(S.grid_max)+" (سيناريو "+NM[sc]+") مع شرط تحقق افتراضاته، لا رقمًا واحدًا.",tag:"a"},
      Math.min(...S1.cash)<0?{t:"السيناريو المتشائم يُظهر نقدية سالبة ("+T.egpK(Math.min(...S1.cash))+") — تجهيز خط تمويل قصير الأجل قبل الحاجة إليه.",tag:"e"}:null,
      {t:"أكبر محرك للقيمة هو معدل الخصم: فرق 2 نقطة في WACC يغيّر القيمة "+T.pct(Math.abs(S.grid[1][2]-S.grid[2][2])/S.grid[2][2])+" — تحديده بدراسة مستقلة قبل أي تفاوض.",tag:"e"}]));
    return out;
  }

  /* ======================= 11) سجل تنظيف البيانات ========================== */
  opsClean(D){
    const B=this.opsBase(D), L=D.lines||[], seen=new Map(), dup=[];
    L.forEach(l=>{ const k=[l.invoice_no,l.item_code,l.qty,l.unit_price,l.line_total,l.is_bonus].join("|");
      if(seen.has(k)) dup.push(l); else seen.set(k,1); });
    const zp=L.filter(l=>!l.is_bonus&&!(+l.unit_price>0));
    const zi=(D.invoices||[]).filter(v=>!(v.reported_total>0));
    return {multi:B.multi.sort((a,b)=>b.n-a.n),dup,zp,zi,ziNB:zi.filter(v=>!v.is_bonus).length,dq:D.data_quality||{}};
  }
  opsCleanBody(X,T,api){
    const O=window.DASH_OPS, V=this.advMemo(api,"opsClean",(X2,D)=>this.opsClean(D)), out=[];
    out.push(this.opsLegend("dql"));
    out.push(this.advNote("dqn","التنظيف هنا طبقة عرض: بيانات اللقطة الأصلية لا تُعدَّل ولا يُحذف منها صف، وكل قاعدة معلنة بعدد ما أثّرت عليه. "
      +"ملفات التشغيل تُقرأ كما هي، وأي إجمالي مستخرج لا يساوي المطبوع في المصدر يوقف البناء."));
    out.push(this.card("مبيعات اللقطة — ما وُجد وما فُعل",this.fsTable("dqs",["القاعدة","العدد","المعالجة"],[
      ["أكواد عملاء بأكثر من اسم",T.int(V.multi.length),"اسم موحَّد = الأكثر تكرارًا للكود، يُستخدم في «قرارات وتشغيل» فقط"],
      ["بنود مكررة تمامًا (نفس الفاتورة والصنف والكمية والسعر)",T.int(V.dup.length),"تُعرض للمراجعة؛ لا تُحذف"],
      ["بنود بسعر صفر وليست بونص",T.int(V.zp.length),"خارج حساب الأسعار الوسيطة، ومقيّمة في «تسرب السعر»"],
      ["فواتير صفرية القيمة",T.int(V.zi.length),T.int(V.ziNB)+" منها غير مسجلة بونص — في «التنبيهات الذكية»"],
      ["قيم ناقصة (من فحص اللقطة)",T.int(V.dq.missing_total||0),"أسماء عملاء فارغة؛ يُستخدم الاسم الموحَّد للكود"],
      ["مطابقة إجمالي الفاتورة مع بنودها",V.dq.reconciliation_rate!=null?T.pct(V.dq.reconciliation_rate):"—","مُتحقَّق في اللقطة"]]),
      {k:"dq1",sub:"مُتحقَّق"}));
    out.push(this.card("أكواد عملاء بأكثر من اسم",this.pagedList("dqm",V.multi,[["الكود",r=>r.customer_code],["الاسم الموحَّد",r=>r.canonical],
      ["الأسماء (مرات الظهور)",r=>r.variants]],r=>this.setState({stmt:r.customer_code})),{k:"dq2"}));
    if(V.dup.length) out.push(this.card("البنود المكررة",this.pagedList("dqd",V.dup,[["الفاتورة",r=>r.invoice_no],["الصنف",r=>r.item_name],
      ["الكمية",r=>T.num(r.qty)],["القيمة",r=>T.num(r.line_total)],["العميل",r=>r.customer_name],["التاريخ",r=>r.invoice_date]]),{k:"dq3"}));
    if(O){
      out.push(this.card("ملفات التشغيل — قواعد التنظيف",this.fsTable("dqo",["القاعدة","العدد","أمثلة"],
        O.cleaning.map(r=>[r.title,T.int(r.count),(r.examples||[]).map(e=>Array.isArray(e)?e.join("، "):String(e)).join(" · ")])),{k:"dq4",sub:"مُتحقَّق · من ops_ingest.py"}));
      const I=O.inventory, P=O.purchases, R=O.returns_items;
      out.push(this.card("مطابقة الإجماليات بالمطبوع في المصدر",this.fsTable("dqr",["الملف","المستخرج","المطبوع","الفرق"],[
        ["جرد 30/6/2026",this.fsC(I.jun.raw_value+I.jun.fg_value),this.fsC(I.jun.total_printed),this.fsC(I.jun.raw_value+I.jun.fg_value-I.jun.total_printed)],
        ["جرد 31/7/2026",this.fsC(I.jul.raw_value+I.jul.fg_value),this.fsC(I.jul.total_printed),this.fsC(I.jul.raw_value+I.jul.fg_value-I.jul.total_printed)],
        ["مشتريات يوليو",this.fsC(P["2026-07"].total),this.fsC(P["2026-07"].total),this.fsC(0)],
        ["مشتريات أغسطس",this.fsC(P["2026-08"].total),this.fsC(P["2026-08"].total_printed),this.fsC(P["2026-08"].total-P["2026-08"].total_printed)],
        ["حسابات الموردين",this.fsC(O.suppliers.net_credit),this.fsC(O.suppliers.total_printed),this.fsC(O.suppliers.net_credit-O.suppliers.total_printed)]]
        .concat(Object.keys(R).sort().map(m=>["مرتجعات "+this.fsMon(m),this.fsC(R[m].total),this.fsC(R[m].total_printed),this.fsC(R[m].total-R[m].total_printed)]))),
        {k:"dq5",sub:"الفروق أقل من 1 ج.م (تقريب) — شرط البناء"}));
      out.push(this.card("أسماء لم تُربط بكود مبيعات",this.pagedList("dqu",O.unlinked_names.map(n=>({n})),[["الاسم كما في المصدر",r=>r.n]]),
        {k:"dq6",sub:O.unlinked_names.length+" اسم · لا ربط تخميني — يحتاج اعتماد الإدارة"}));
      out.push(this.card("المصادر",this.fsTable("dqf",["الملف","المحتوى"],O.meta.sources.map(s=>[s.file,s.kind])),{k:"dq7",sub:"data/raw/ops/"}));
    }
    out.push(this.opsDecision("dqd",[
      V.multi.length?{t:"توحيد أسماء "+V.multi.length+" كود عميل في النظام المصدر (الاسم الموحَّد المقترح في الجدول).",tag:"v"}:null,
      V.dup.length?{t:"مراجعة "+V.dup.length+" بند مكرر مع المحاسب: تكرار إدخال أم بندان حقيقيان؟",tag:"v"}:null,
      O?{t:"اعتماد ربط "+O.unlinked_names.length+" اسم جرد بأكواد المبيعات (مثل «كفته اسبيشيال 350» = «صغير»؟) لتتسع تغطية المخزون.",tag:"v"}:null]));
    return out;
  }

  opsSectionBody(s,X,T,api){
    const m={ops_inventory:"opsInventoryBody",ops_purchases:"opsPurchasesBody",ops_costpass:"opsCostPassBody",ops_wc:"opsWcBody",
      dec_rfm:"opsRfmBody",dec_reps:"opsRepsBody",dec_leakage:"opsLeakBody",dec_returns:"opsRetBody",dec_whatif:"opsWhatIfBody",
      dec_valuation:"opsValBody",dq_clean:"opsCleanBody"}[s];
    return m?this[m](X,T,api):null;
  }

  /* جداول «قرارات وتشغيل» لكتالوج التصدير وملف Excel. */
  opsExport(out,col,num){
    const st=this.state;
    if(!st.api) return;
    const api=st.api, O=window.DASH_OPS;
    const Rf=this.advMemo(api,"opsRfm",(X2,D,f2)=>this.opsRfm(D,f2));
    const Rp=this.advMemo(api,"opsReps",(X2,D)=>this.opsReps(D));
    const Lk=this.advMemo(api,"opsLeak",X2=>this.opsLeak(X2));
    const Cl=this.advMemo(api,"opsClean",(X2,D)=>this.opsClean(D));
    out.push(
      {id:"dec_rfm", label:"قرارات — شرائح العملاء", rows:Rf.rows, columns:[
        col("كود العميل","code"), col("العميل (موحَّد)","name"), col("الشريحة","seg"), col("المندوب","rep"),
        col("المبيعات",null,r=>num(r.sales)), col("الفواتير",null,r=>num(r.freq)), col("أيام منذ آخر شراء",null,r=>num(r.rec)),
        col("R",null,r=>num(r.s_rec)), col("F",null,r=>num(r.s_freq)), col("M",null,r=>num(r.s_sales)),
        col("الرصيد",null,r=>num(r.outstanding)), col("المتأخر",null,r=>num(r.overdue)), col("نسبة التحصيل",null,r=>num(r.coll_rate))]},
      {id:"dec_segments", label:"قرارات — ملخص الشرائح", rows:Rf.segs, columns:[
        col("الشريحة","name"), col("العملاء",null,r=>num(r.n)), col("المبيعات",null,r=>num(r.sales)), col("الحصة",null,r=>num(r.share)),
        col("الرصيد",null,r=>num(r.outstanding)), col("المتأخر",null,r=>num(r.overdue)), col("الإجراء","action")]},
      {id:"dec_reps", label:"قرارات — بطاقة أداء المندوبين", rows:Rp.rows, columns:[
        col("المندوب","rep"), col("الترتيب",null,r=>num(r.rank)), col("الدرجة",null,r=>num(r.score)), col("المبيعات",null,r=>num(r.sales)),
        col("هامش المجمل",null,r=>num(r.gm)), col("التحصيل ÷ المبيعات",null,r=>num(r.coll)), col("المتأخر ÷ الرصيد",null,r=>num(r.od)),
        col("المرتجعات ÷ المبيعات",null,r=>num(r.ret)), col("عملاء جدد",null,r=>num(r.newc)), col("فواتير صفرية",null,r=>num(r.zero))]},
      {id:"dec_leak_items", label:"قرارات — تحت الوسيط حسب الصنف", rows:Lk.leakItem, columns:[
        col("الكود","key"), col("الصنف","name"), col("الفرق",null,r=>num(r.value)), col("البنود",null,r=>num(r.n))]},
      {id:"dec_leak_reps", label:"قرارات — تحت الوسيط حسب المندوب", rows:Lk.leakRep, columns:[
        col("المندوب","name"), col("الفرق",null,r=>num(r.value)), col("البنود",null,r=>num(r.n))]},
      {id:"dq_multi_names", label:"تنظيف — أكواد عملاء بأكثر من اسم", rows:Cl.multi, columns:[
        col("الكود","customer_code"), col("الاسم الموحَّد","canonical"), col("الأسماء","variants")]});
    if(!O) return;
    const Iv=this.advMemo(api,"opsInv",(X2,D)=>this.opsInventory(D));
    const Pu=this.advMemo(api,"opsPur",()=>this.opsPurchases());
    const Cp=this.advMemo(api,"opsCost",(X2,D)=>this.opsCostPass(D));
    const Rt=this.advMemo(api,"opsRet",(X2,D)=>this.opsRet(D));
    out.push(
      {id:"ops_fg_cover", label:"تشغيل — تغطية المنتج التام 31/8", rows:Iv.cov, columns:[
        col("الصنف","name"), col("كود المبيعات","item_code"), col("الحالة","status"), col("الكمية",null,r=>num(r.qty)),
        col("خروج يومي",null,r=>num(r.daily)), col("تغطية (يوم)",null,r=>num(r.cover)), col("آخر بيع","last_sale"),
        col("القيمة بسعر يوليو",null,r=>num(r.value))]},
      {id:"ops_raw_jul", label:"تشغيل — جرد الخامات 31/7", rows:O.inventory.jul.raw, columns:[
        col("الخامة","name"), col("رصيد أول",null,r=>num(r.open_qty)), col("مشتريات",null,r=>num(r.purch_qty)),
        col("متوسط التكلفة",null,r=>num(r.wac)), col("الكمية",null,r=>num(r.qty)), col("القيمة",null,r=>num(r.value)),
        col("التغير عن يونيو",null,r=>num(r.chg_vs_jun))]},
      {id:"ops_fg_jul", label:"تشغيل — جرد المنتج التام 31/7", rows:O.inventory.jul.fg, columns:[
        col("الصنف","name"), col("كود المبيعات","item_code"), col("الربط","match"), col("الكمية",null,r=>num(r.qty)),
        col("السعر",null,r=>num(r.price)), col("القيمة",null,r=>num(r.value)), col("ملاحظة","note")]},
      {id:"ops_inv_loc", label:"تشغيل — قيمة الخامات بالموقع (تقدير)", rows:Iv.locRows, columns:[
        col("الموقع","loc"), col("القيمة",null,r=>num(r.value)), col("أصناف",null,r=>num(r.n))]},
      {id:"ops_purch_items", label:"تشغيل — المشتريات بالصنف", rows:Pu.items, columns:[
        col("الكود","code"), col("الصنف","name"), col("الإنفاق",null,r=>num(r.spend)), col("يوليو",null,r=>num(r.m7)),
        col("أغسطس",null,r=>num(r.m8)), col("الكمية",null,r=>num(r.qty)), col("أقل سعر",null,r=>num(r.min)),
        col("أعلى سعر",null,r=>num(r.max)), col("المتوسط المرجح",null,r=>num(r.wavg)), col("الفرق عن أقل سعر",null,r=>num(r.gap))]},
      {id:"ops_purch_rows", label:"تشغيل — سطور المشتريات", rows:[].concat(O.purchases["2026-07"].rows,O.purchases["2026-08"].rows), columns:[
        col("التاريخ","date"), col("الكود","code"), col("الصنف","name"), col("الكمية",null,r=>num(r.qty)),
        col("السعر",null,r=>num(r.price)), col("الإجمالي",null,r=>num(r.total)), col("الفاتورة","invoice")]},
      {id:"ops_suppliers", label:"تشغيل — أرصدة الموردين", rows:Pu.sup, columns:[
        col("المورد","name"), col("دائن",null,r=>num(r.credit)), col("مدين",null,r=>num(r.debit)), col("الصافي",null,r=>num(r.net))]},
      {id:"ops_costpass", label:"تشغيل — تمرير التكلفة", rows:Cp, columns:[
        col("المنتج","product"), col("كجم يونيو",null,r=>num(r.kg_jun)), col("كجم يوليو",null,r=>num(r.kg_jul)),
        col("تغير التكلفة",null,r=>num(r.cost_chg)), col("سعر البيع يوليو",null,r=>num(r.p_jul)), col("سعر البيع أغسطس",null,r=>num(r.p_aug)),
        col("حصة التكلفة",null,r=>num(r.cost_share)), col("التغير اللازم",null,r=>num(r.room)), col("أكواد العائلة",null,r=>r.sales_codes.join("، "))]},
      {id:"ops_returns_items", label:"تشغيل — المرتجعات بالصنف (يوليو–أغسطس)", rows:Rt.items, columns:[
        col("الصنف","name"), col("الكود","code"), col("القيمة",null,r=>num(r.value)), col("الكمية",null,r=>num(r.qty)),
        col("النسبة من المبيعات",null,r=>num(r.rate))]},
      {id:"ops_returns_rows", label:"تشغيل — سطور المرتجعات بالصنف", rows:[].concat(...Object.keys(O.returns_items).sort().map(m=>O.returns_items[m].rows)), columns:[
        col("التاريخ","date"), col("الصنف","item"), col("كود المبيعات","item_code"), col("الكمية",null,r=>num(r.qty)),
        col("القيمة",null,r=>num(r.value)), col("المحافظة","region"), col("المندوب","rep"), col("العميل","customer"), col("الفاتورة","invoice")]},
      {id:"dq_cleaning", label:"تنظيف — قواعد ملفات التشغيل", rows:O.cleaning, columns:[
        col("القاعدة","id"), col("الوصف","title"), col("العدد",null,r=>num(r.count))]});
  }

