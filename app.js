/* =========================================================
   Parameter rules
   ========================================================= */
const PARAMS = {
  ph: {
    label:'pH', icon:'⚗️', unit:'', dec:1, min:4, max:11, ok:[6.5,8.5], warn:[6.0,9.0],
    idealText:'<b>6.5 – 8.5</b> (neutral to slightly alkaline)',
    advice:{
      good:['pH is in the safe drinking range. No action needed.','Keep testing weekly, and after any tank cleaning.'],
      low:['Water is acidic. It can corrode pipes and leach metals like copper or lead.',
           'Fit a neutralising filter (calcite or magnesium oxide) on the outlet line.',
           'For larger tanks, a soda ash (sodium carbonate) dosing unit raises pH steadily.',
           'Check the source: acidic rain runoff or a new borewell can bring pH down.'],
      high:['Water is too alkaline. It may taste bitter and leave scale on taps and heaters.',
            'Rinse out any cleaning chemical residue (bleach, lime) from the tank.',
            'An RO purifier or acid-injection system will bring pH back down.',
            'If the tank is new concrete, flush it a few times; fresh cement raises pH.']
    }
  },
  temp: {
    label:'Temperature', icon:'🌡️', unit:'°C', dec:1, min:0, max:45, ok:[10,25], warn:[5,30],
    idealText:'<b>10 – 25 °C</b> (cool storage limits bacterial growth)',
    advice:{
      good:['Temperature is in a healthy range for stored water.','Keep the lid closed and the tank shaded in summer.'],
      low:['Water is very cold. This is safe to drink, but pipes may freeze below 4 °C.',
           'Insulate exposed pipes and the tank with foam lagging or a jacket.',
           'Keep water moving: a small daily draw stops it from freezing in the lines.'],
      high:['Warm water lets bacteria and algae grow quickly, especially above 30 °C.',
            'Shade the tank, or move it out of direct sun. A white or light-coloured tank stays cooler.',
            'Insulate the tank and rooftop pipes.',
            'Use water faster or top up more often so it does not sit and heat up.',
            'If it stays warm, disinfect and boil or filter water before drinking.']
    }
  },
  turb: {
    label:'Turbidity', icon:'🔍', unit:'NTU', dec:1, min:0, max:10, ok:[0,1], warn:[0,5],
    idealText:'<b>below 1 NTU</b> (clear). Up to 5 NTU is the upper limit.',
    advice:{
      good:['Water is clear. Turbidity is within the ideal limit.','Clean the tank every 3 to 6 months to keep sediment from building up.'],
      high:['Cloudy water can hide germs and stops disinfection from working properly.',
            'Do not drink it untreated. Filter and boil it, or use an RO/UV purifier.',
            'Drain and clean the tank to remove sludge from the bottom.',
            'Fit a sediment filter (5 to 20 micron) on the inlet.',
            'Check the inlet and lid for gaps where dust, leaves or runoff get in.',
            'For heavy muddiness, let it settle or treat with alum, then filter.']
    }
  },
  level: {
    label:'Water level', icon:'💧', unit:'%', dec:0, min:0, max:100, ok:[30,90], warn:[15,97],
    idealText:'<b>30 – 90 %</b> of capacity',
    advice:{
      good:['Level is comfortable, with room to spare and enough in reserve.','Keep your pump or refill schedule as it is.'],
      low:['Tank is running low. Refill soon so you do not run dry.',
           'Check for leaks: look for damp patches, dripping valves or a running toilet.',
           'Set the pump to run on a timer, or fit an automatic level controller.',
           'Low water warms up faster and sediment gets drawn into the outlet.'],
      high:['Tank is nearly full. There is a risk of overflow and wasted water.',
            'Check that the float valve or auto-cut switch shuts off the inflow.',
            'Make sure the overflow pipe is clear and drains safely.']
    }
  }
};
const ORDER = ['ph','temp','turb','level'];
const NAME_IDEAS = ['Home','Second Home','Office','Farmhouse','Rooftop','Underground sump'];
const SERIES = ['#2a78d6','#eb6834','#1baf7a','#eda100','#e87ba4','#008300','#7b5cd6','#5c6b7a']; // fixed categorical order
const RANK={good:0,warn:1,bad:2};
const LABEL={good:'All good',warn:'Needs attention',bad:'Action needed'};
const STATUS_WORD={good:'Ideal',warn:'Watch',bad:'Out of range'};
const SEV={critical:{ic:'⛔',name:'Critical'},warning:{ic:'⚠️',name:'Warning'},info:{ic:'✅',name:'Info'},wastage:{ic:'🚰',name:'Wastage'}};

function statusOf(key,v){ const p=PARAMS[key]; if(v>=p.ok[0]&&v<=p.ok[1])return'good'; if(v>=p.warn[0]&&v<=p.warn[1])return'warn'; return'bad'; }
function sideOf(key,v){ const p=PARAMS[key]; return v<p.ok[0]?'low':(v>p.ok[1]?'high':'good'); }
function overall(t){ return ORDER.map(k=>statusOf(k,t.r[k])).reduce((a,b)=>RANK[b]>RANK[a]?b:a,'good'); }

/* =========================================================
   State + history generation
   ========================================================= */
const STORE='aquapure.v2';
const HOUR=3600e3, HIST_HOURS=168, LIVE_MAX=90, TICK_MS=4000;
let tanks=[], alerts=[], settings={popCritical:true,popWarning:true,popWastage:true,popInfo:false,desktop:false};
let trendSel={tank:'all',range:'7d'}, alertFilter='all', demoSel=null;

const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const uid=()=>'t'+Math.random().toString(36).slice(2,8);
const rnd=(a,b)=>a+Math.random()*(b-a);

// One simulated hour of a tank. profile: {ph,temp,turb, leak, overflow}
function stepHour(s,hr,pf,cap){
  let use = (hr>=6&&hr<=8)?rnd(6,8):(hr>=18&&hr<=20)?rnd(4.5,6):(hr>=22||hr<=5)?0:rnd(1,2.2);
  if(pf.leak) use += rnd(0.9,1.3);
  let refilled=false, overflow=false;
  if(s.level<35) s.pump=true;
  if(s.pump){ s.level+=30; refilled=true;
    if(s.level>=90){ if(pf.overflow && Math.random()<0.4){ s.level=100; overflow=true; } else s.level=Math.min(s.level,92); s.pump=false; } }
  s.level=clamp(s.level-use,3,100);
  s.temp = pf.temp + 3.5*Math.sin(2*Math.PI*(hr-9)/24) + rnd(-.6,.6);
  s.ph   = clamp(s.ph + rnd(-.06,.06) + (pf.ph-s.ph)*.15, 5, 10);
  s.turb = clamp(pf.turb + (refilled?rnd(1,2):0) + (s.turbBoost||0)*.6 + rnd(-.2,.2), .1, 9);
  s.turbBoost = refilled?1.5:(s.turbBoost||0)*.6;
  return {overflow};
}
function makeTank(name,cap,slot,pf){
  const s={level:rnd(55,80),pump:false,ph:pf.ph,temp:pf.temp,turb:pf.turb};
  const hist=[], now=Date.now(), start=Math.floor(now/HOUR)*HOUR-(HIST_HOURS-1)*HOUR;
  for(let i=0;i<HIST_HOURS;i++){
    const t=start+i*HOUR, hr=new Date(t).getHours(); const ev=stepHour(s,hr,pf,cap);
    hist.push({t,ph:+s.ph.toFixed(2),temp:+s.temp.toFixed(1),turb:+s.turb.toFixed(2),level:+s.level.toFixed(1),of:ev.overflow?1:0});
  }
  const last=hist[hist.length-1];
  return {id:uid(),name,cap,slot,pf,manual:false,sim:s,
    r:{ph:last.ph,temp:last.temp,turb:last.turb,level:last.level},
    hist, live:[{t:now,ph:last.ph,temp:last.temp,turb:last.turb,level:last.level}], astate:{}};
}
function nextSlot(){ const used=new Set(tanks.map(t=>t.slot)); for(let i=0;i<SERIES.length;i++) if(!used.has(i)) return i; return tanks.length%SERIES.length; }

function load(){
  try{
    const s=JSON.parse(localStorage.getItem(STORE));
    if(s&&Array.isArray(s.tanks)&&s.tanks.length){ tanks=s.tanks; alerts=s.alerts||[]; settings={...settings,...(s.settings||{})}; catchUp(); return; }
  }catch(e){}
  tanks=[
    makeTank('Home',1000,0,{ph:7.3,temp:21.5,turb:.5,leak:false,overflow:false}),
    makeTank('Second Home',2000,1,{ph:6.3,temp:26,turb:2.4,leak:true,overflow:true}),
  ];
}
// Fill in hourly history for time the page was closed
function catchUp(){
  const nowH=Math.floor(Date.now()/HOUR)*HOUR;
  tanks.forEach(t=>{
    let lastT=t.hist.length?t.hist[t.hist.length-1].t:nowH-HOUR;
    let n=Math.min(HIST_HOURS,Math.round((nowH-lastT)/HOUR));
    for(let i=1;i<=n;i++){ const tt=lastT+i*HOUR; const ev=stepHour(t.sim,new Date(tt).getHours(),t.pf,t.cap);
      t.hist.push({t:tt,ph:+t.sim.ph.toFixed(2),temp:+t.sim.temp.toFixed(1),turb:+t.sim.turb.toFixed(2),level:+t.sim.level.toFixed(1),of:ev.overflow?1:0}); }
    if(t.hist.length>HIST_HOURS) t.hist=t.hist.slice(-HIST_HOURS);
    if(n>0 && !t.manual){ const l=t.hist[t.hist.length-1]; t.r={ph:l.ph,temp:l.temp,turb:l.turb,level:l.level}; t.live=[{t:Date.now(),...t.r}]; }
  });
}
function save(){ try{ localStorage.setItem(STORE,JSON.stringify({tanks,alerts:alerts.slice(0,150),settings})); }catch(e){} }

/* =========================================================
   Wastage analysis
   ========================================================= */
function analyzeWaste(t){
  const H=t.hist, cap=t.cap, f=[];
  // Night-time loss (00:00–05:00, nobody using water, pump off)
  let nightDrop=0, nightHrs=0;
  for(let i=1;i<H.length;i++){ const hr=new Date(H[i].t).getHours(); const d=H[i-1].level-H[i].level;
    if(hr>=1&&hr<=5 && d>=-.5){ nightDrop+=Math.max(0,d); nightHrs++; } }
  const nightRate=nightHrs?nightDrop/nightHrs:0;            // % per hour
  const leakLday=nightRate>0.8 ? nightRate*24*cap/100 : 0;  // continuous loss all day
  if(leakLday) f.push({type:'leak',sev:'warning',title:'Possible leak',
    why:`The level keeps dropping overnight (about ${nightRate.toFixed(1)}% an hour between 1 and 5 am) when water is normally not used.`,
    loss:leakLday*7,
    actions:['Close all taps, note the level, and check again after 1 hour. If it still drops, there is a leak.','Check toilet cisterns, float valves and outlet joints for slow drips.','Look for damp walls or ground near underground pipes.']});
  // Overflow events
  const ofs=H.filter(h=>h.of).length;
  if(ofs) f.push({type:'overflow',sev:'warning',title:`Overflowed ${ofs} time${ofs>1?'s':''} this week`,
    why:'The tank reached 100% while the pump was still filling, so water spilled out of the overflow pipe.',
    loss:ofs*cap*0.05,
    actions:['Fit or repair an automatic pump cut-off (water level controller).','Check that the float valve closes fully.','Run the pump on a timer that stops before the tank is full.']});
  // Unusual usage: last 24h vs earlier daily average
  const dailyUse=[]; for(let d=0;d<7;d++){ let u=0; for(let i=Math.max(1,H.length-(d+1)*24);i<H.length-d*24;i++){ const x=H[i-1].level-H[i].level; if(x>0)u+=x; } dailyUse.unshift(u*cap/100); }
  const today=dailyUse[6], prev=dailyUse.slice(0,6), avg=prev.reduce((a,b)=>a+b,0)/(prev.length||1);
  if(avg>0 && today>avg*1.4) f.push({type:'usage',sev:'warning',title:'Unusually high use today',
    why:`About ${Math.round(today).toLocaleString()} L used in the last 24 hours, against a usual ${Math.round(avg).toLocaleString()} L a day.`,
    loss:Math.max(0,today-avg),
    actions:['Check for taps left running, garden hoses or a stuck flush.','Ask whether anyone used extra water today (washing, guests).']});
  // Sudden drop in live readings
  const L=t.live; if(L.length>=4){ const recent=L.slice(-6); const drop=recent[0].level-recent[recent.length-1].level;
    if(drop>=4) f.push({type:'burst',sev:'critical',title:'Sudden drop in water level',
      why:`The level fell ${drop.toFixed(0)}% in under a minute. That is far faster than normal use.`,
      loss:drop*cap/100,
      actions:['Check for a burst pipe or a tap left fully open right away.','Switch off the outlet valve if you cannot find the cause.']}); }
  const weekLoss=f.reduce((a,x)=>a+(x.loss||0),0);
  return {findings:f, weekLoss, dailyUse, avgUse:avg, nightRate};
}

/* =========================================================
   Alerts engine
   ========================================================= */
let toastQueueOnLoad=[];
function pushAlert(tank,sev,title,msg,quiet){
  const a={id:'a'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),t:Date.now(),tank:tank.id,tankName:tank.name,sev,title,msg,read:false};
  alerts.unshift(a); if(alerts.length>150) alerts.length=150;
  if(quiet) toastQueueOnLoad.push(a); else notify(a);
}
function evaluate(t,quiet){
  const st=t.astate;
  ORDER.forEach(k=>{
    const v=t.r[k], s=statusOf(k,v), prev=st[k]||'good', side=sideOf(k,v), p=PARAMS[k];
    const val=`${fmt(k,v)}${p.unit?' '+p.unit:''}`;
    if(s!==prev){
      if(s==='bad') pushAlert(t,'critical',`${p.label} out of safe range`,`${p.label} is ${side} at ${val}. ${p.advice[side][0]}`,quiet);
      else if(s==='warn' && prev==='good') pushAlert(t,'warning',`${p.label} drifting ${side}`,`${p.label} is ${val}, outside the ideal range. Keep an eye on it.`,quiet);
      else if(s==='good') pushAlert(t,'info',`${p.label} back to normal`,`${p.label} is ${val} again, within the ideal range.`,quiet);
    }
    st[k]=s;
  });
  const w=analyzeWaste(t); st.waste=st.waste||{};
  const types=new Set(w.findings.map(x=>x.type));
  w.findings.forEach(x=>{ if(!st.waste[x.type]) pushAlert(t,x.type==='burst'?'critical':'wastage',x.title,x.why,quiet); });
  st.waste=Object.fromEntries([...types].map(k=>[k,true]));
}
function notify(a){
  const allow={critical:settings.popCritical,warning:settings.popWarning,wastage:settings.popWastage,info:settings.popInfo}[a.sev];
  if(allow) toast(a);
  if(settings.desktop && a.sev!=='info'){ try{ if(window.Notification && Notification.permission==='granted') new Notification(`Aquapure · ${a.tankName}`,{body:a.title+' — '+a.msg}); }catch(e){} }
  updateCount();
}
function toast(a,custom){
  const el=document.createElement('div'); el.className='toast '+(a.sev||'info');
  el.innerHTML=custom||`<span>${SEV[a.sev].ic}</span><div><b>${esc(a.tankName)}: ${esc(a.title)}</b><p>${esc(a.msg)}</p></div><button aria-label="Dismiss">×</button>`;
  el.querySelector('button').onclick=()=>el.remove();
  if(a.tank) el.querySelector('div').style.cursor='pointer', el.querySelector('div').onclick=()=>{ location.hash='alerts'; el.remove(); };
  $('#toasts').appendChild(el);
  while($('#toasts').children.length>3) $('#toasts').firstChild.remove();
  setTimeout(()=>el.remove(),7000);
}
function unread(){ return alerts.filter(a=>!a.read && a.sev!=='info').length; }
function updateCount(){ const n=unread(); $('#navCount').textContent=n?(n>99?'99+':n):''; }

/* =========================================================
   Live simulation tick
   ========================================================= */
function tick(){
  const now=Date.now();
  tanks.forEach(t=>{
    if(!t.manual){
      const hr=new Date(now).getHours()+new Date(now).getMinutes()/60, tTarget=t.pf.temp+3.5*Math.sin(2*Math.PI*(hr-9)/24);
      t.r.ph   = clamp(t.r.ph   + rnd(-.03,.03) + (t.pf.ph-t.r.ph)*.02, 5.2, 9.6);
      t.r.temp = clamp(t.r.temp + rnd(-.08,.08) + (tTarget-t.r.temp)*.02, 4, 38);
      t.r.turb = clamp(t.r.turb + rnd(-.05,.05) + (t.pf.turb-t.r.turb)*.02, .1, 9);
      t.r.level= clamp(t.r.level+ rnd(-.12,.12) - (t.pf.leak?.004:0) + (t.r.level<25?.6:0), 3, 100);
    }
    t.live.push({t:now,...t.r}); if(t.live.length>LIVE_MAX) t.live.shift();
    // roll into hourly history when a new hour starts
    const last=t.hist[t.hist.length-1], h=Math.floor(now/HOUR)*HOUR;
    if(h>last.t){ t.hist.push({t:h,ph:+t.r.ph.toFixed(2),temp:+t.r.temp.toFixed(1),turb:+t.r.turb.toFixed(2),level:+t.r.level.toFixed(1),of:t.r.level>=99.5?1:0}); if(t.hist.length>HIST_HOURS)t.hist.shift(); }
    evaluate(t,false);
  });
  save(); render(true);
}

/* =========================================================
   Helpers
   ========================================================= */
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=(k,v)=>Number(v).toFixed(PARAMS[k].dec);
const L=n=>Math.round(n).toLocaleString()+' L';
function ago(t){ const s=Math.round((Date.now()-t)/1000); if(s<60)return'just now'; const m=Math.round(s/60); if(m<60)return m+' min ago'; const h=Math.round(m/60); if(h<24)return h+' h ago'; return Math.round(h/24)+' d ago'; }
const color=t=>SERIES[t.slot%SERIES.length];

function vessel(level,st){
  const col={good:'#2b9be0',warn:'#e3a43a',bad:'#e0574f'}[st]; const h=Math.round(43*level/100), y=52-h, cid='c'+Math.random().toString(36).slice(2,7);
  return `<svg class="vessel" viewBox="0 0 46 58" aria-hidden="true"><rect x="4" y="2" width="38" height="4" rx="2" fill="#9db6c9"/>
    <rect x="5" y="7" width="36" height="47" rx="6" fill="#eef4f9" stroke="#9db6c9" stroke-width="2"/>
    <clipPath id="${cid}"><rect x="7" y="9" width="32" height="43" rx="4"/></clipPath>
    <rect x="7" y="${y}" width="32" height="${h+2}" fill="${col}" opacity=".85" clip-path="url(#${cid})"/></svg>`;
}
function spark(arr,key){
  const p=PARAMS[key], lo=Math.min(...arr,p.ok[0]), hi=Math.max(...arr,p.ok[1]), rng=(hi-lo)||1;
  const pts=arr.map((v,i)=>`${(i/(Math.max(1,arr.length-1))*126+2).toFixed(1)},${(38-((v-lo)/rng)*34).toFixed(1)}`).join(' ');
  const y1=38-((p.ok[1]-lo)/rng)*34, y0=38-((p.ok[0]-lo)/rng)*34;
  return `<svg class="spark" viewBox="0 0 130 40" aria-hidden="true"><rect x="0" y="${y1}" width="130" height="${Math.max(1,y0-y1)}" fill="#e2f5ec"/>
    <polyline points="${pts}" fill="none" stroke="#2a78d6" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}
function scale(key,v){
  const p=PARAMS[key], span=p.max-p.min, pc=x=>clamp((x-p.min)/span*100,0,100);
  return `<div class="scale"><div class="scale-track"></div><div class="scale-ok" style="left:${pc(p.ok[0])}%;width:${pc(p.ok[1])-pc(p.ok[0])}%"></div>
    <div class="scale-pin" style="left:${pc(v)}%"></div></div><div class="scale-labels"><span>${p.min}${p.unit?' '+p.unit:''}</span><span>${p.max}${p.unit?' '+p.unit:''}</span></div>`;
}

/* =========================================================
   Line chart (SVG) with crosshair tooltip
   ========================================================= */
const CHARTS={};
function seriesFor(t,range){
  if(range==='live') return t.live;
  const n=range==='24h'?24:HIST_HOURS; const pts=t.hist.slice(-n);
  return t.manual||range==='live'?pts:[...pts,{t:Date.now(),...t.r}];
}
function lineChart(id,key,list,range){
  const p=PARAMS[key], W=520, H=210, m={l:40,r:12,t:10,b:26}, iw=W-m.l-m.r, ih=H-m.t-m.b;
  const all=list.flatMap(s=>s.pts.map(d=>d[key]));
  if(!all.length) return '<div class="empty">No data yet</div>';
  let lo=Math.min(...all,p.ok[0]), hi=Math.max(...all,p.ok[1]); const pad=(hi-lo)*.08||1; lo=Math.max(p.min,lo-pad); hi=Math.min(p.max===100?100:hi+pad,hi+pad);
  const t0=Math.min(...list.map(s=>s.pts[0].t)), t1=Math.max(...list.map(s=>s.pts[s.pts.length-1].t)), tr=(t1-t0)||1;
  const X=t=>m.l+(t-t0)/tr*iw, Y=v=>m.t+ih-(v-lo)/(hi-lo)*ih;
  // y ticks
  const step=niceStep((hi-lo)/4); let yt=''; for(let v=Math.ceil(lo/step)*step; v<=hi+1e-9; v+=step){ const y=Y(v);
    yt+=`<line x1="${m.l}" x2="${W-m.r}" y1="${y}" y2="${y}" stroke="var(--grid)"/><text x="${m.l-8}" y="${y+4}" text-anchor="end">${+v.toFixed(2)}</text>`; }
  // x ticks
  let xt=''; const ticks=xTicks(t0,t1,range);
  ticks.forEach(t=>{ const x=X(t.t); xt+=`<text x="${x}" y="${H-6}" text-anchor="middle">${t.l}</text>`; });
  const band=`<rect x="${m.l}" y="${Y(Math.min(hi,p.ok[1]))}" width="${iw}" height="${Math.max(0,Y(Math.max(lo,p.ok[0]))-Y(Math.min(hi,p.ok[1])))}" fill="#d9f1e5" opacity=".75"/>`;
  const lines=list.map(s=>`<polyline points="${s.pts.map(d=>X(d.t).toFixed(1)+','+Y(d[key]).toFixed(1)).join(' ')}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`).join('');
  // overflow markers on level chart
  let marks=''; if(key==='level' && range!=='live') list.forEach(s=>s.pts.forEach(d=>{ if(d.of) marks+=`<circle cx="${X(d.t)}" cy="${Y(d.level)}" r="5" fill="#fff" stroke="${s.color}" stroke-width="2.5"><title>Overflow</title></circle>`; }));
  CHARTS[id]={key,list,X,Y,t0,t1,m,W,H,iw,range};
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${p.label} over time">
    ${band}${yt}<line x1="${m.l}" x2="${W-m.r}" y1="${m.t+ih}" y2="${m.t+ih}" stroke="#c9d6e2"/>${xt}${lines}${marks}
    <g class="hov" style="display:none"><line class="hx" y1="${m.t}" y2="${m.t+ih}" stroke="#8aa0b4" stroke-dasharray="3 3"/>${list.map((s,i)=>`<circle class="hd${i}" r="5" fill="${s.color}" stroke="#fff" stroke-width="2"/>`).join('')}</g>
    <rect class="hit" x="${m.l}" y="${m.t}" width="${iw}" height="${ih}" fill="transparent"/></svg><div class="tip"></div>`;
}
function niceStep(x){ const e=Math.pow(10,Math.floor(Math.log10(x||1))), f=x/e; return (f<1.5?1:f<3?2:f<7?5:10)*e; }
function xTicks(t0,t1,range){
  const out=[];
  if(range==='7d'){ const d=new Date(t0); d.setHours(0,0,0,0); for(let t=d.getTime()+86400e3;t<=t1;t+=86400e3) out.push({t,l:new Date(t).toLocaleDateString([], {weekday:'short'})}); }
  else if(range==='24h'){ const d=Math.ceil(t0/(6*HOUR))*6*HOUR; for(let t=d;t<=t1;t+=6*HOUR) out.push({t,l:new Date(t).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}); }
  else { const n=4; for(let i=0;i<=n;i++){ const t=t0+(t1-t0)*i/n; out.push({t,l:new Date(t).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'})}); } }
  return out;
}
function wireCharts(){
  document.querySelectorAll('.chart[data-chart]').forEach(box=>{
    const c=CHARTS[box.dataset.chart]; if(!c) return; const svg=box.querySelector('svg'), hit=box.querySelector('.hit'), hov=box.querySelector('.hov'), tip=box.querySelector('.tip'); if(!hit) return;
    const p=PARAMS[c.key];
    const move=e=>{
      const r=svg.getBoundingClientRect(), sx=(e.clientX-r.left)/r.width*c.W; const t=c.t0+(sx-c.m.l)/c.iw*(c.t1-c.t0);
      let html='', xx=null;
      c.list.forEach((s,i)=>{ let best=s.pts[0]; for(const d of s.pts) if(Math.abs(d.t-t)<Math.abs(best.t-t)) best=d;
        const dot=hov.querySelector('.hd'+i); dot.setAttribute('cx',c.X(best.t)); dot.setAttribute('cy',c.Y(best[c.key])); if(xx===null) xx=best;
        const s2=statusOf(c.key,best[c.key]);
        html+=`<div><span><i style="background:${s.color}"></i>${esc(s.name)}</span><b>${fmt(c.key,best[c.key])}${p.unit?' '+p.unit:''}${s2!=='good'?' ⚠':''}</b></div>`; });
      hov.style.display=''; hov.querySelector('.hx').setAttribute('x1',c.X(xx.t)); hov.querySelector('.hx').setAttribute('x2',c.X(xx.t));
      const when=c.range==='live'?new Date(xx.t).toLocaleTimeString():new Date(xx.t).toLocaleString([], {weekday:'short',hour:'2-digit',minute:'2-digit'});
      tip.innerHTML=`<div class="tt">${when}</div>${html}`; tip.style.display='block';
      const bx=box.getBoundingClientRect(); let left=e.clientX-bx.left+14; if(left+tip.offsetWidth>bx.width-6) left=e.clientX-bx.left-tip.offsetWidth-14;
      tip.style.left=left+'px'; tip.style.top=(e.clientY-bx.top-10)+'px';
    };
    hit.addEventListener('mousemove',move); hit.addEventListener('touchmove',e=>{ move(e.touches[0]); },{passive:true});
    hit.addEventListener('mouseleave',()=>{ hov.style.display='none'; tip.style.display='none'; });
  });
}

/* =========================================================
   Views
   ========================================================= */
function route(){ const h=location.hash.slice(1); if(h==='alerts'||h==='trends') return h; return tanks.some(t=>t.id===h)?'tank':'home'; }
function currentTank(){ return tanks.find(t=>t.id===location.hash.slice(1)); }
let hovering=false;

function render(isTick){
  const r=route();
  document.querySelectorAll('nav a').forEach(a=>a.classList.toggle('on',a.dataset.nav===(r==='tank'?'home':r)));
  const hero=$('#hero');
  hero.style.display = r==='tank'?'none':'';
  const H={home:['Clean water, always in view.','Pick a tank to see its pH, temperature, turbidity and water level, how each compares to the safe range, and what to do if something is off.'],
           alerts:['Alerts & water wastage','Warnings when readings go out of range, plus checks that spot leaks, overflows and unusual use.'],
           trends:['Trends over time','See how each reading has changed over the last day or week, or watch it live.']}[r]||['',''];
  $('#heroTitle').textContent=H[0]; $('#heroText').textContent=H[1];
  if(isTick && r==='trends' && (trendSel.range!=='live' || hovering)) { stamp(); return; } // keep charts still while reading
  if(r==='home') renderHome(); else if(r==='tank') renderDetail(currentTank()); else if(r==='alerts') { if(!(isTick&&document.activeElement&&document.activeElement.closest('#view select'))) renderAlerts(); } else renderTrends();
  updateCount(); stamp();
}
function stamp(){ $('#clock').textContent='Live · updated '+new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'}); }

function renderHome(){
  const crit=tanks.filter(t=>overall(t)==='bad').length;
  const wasted=tanks.reduce((a,t)=>a+analyzeWaste(t).weekLoss,0);
  const stored=tanks.reduce((a,t)=>a+t.cap*t.r.level/100,0);
  const cards=tanks.map(t=>{
    const st=overall(t), w=analyzeWaste(t), open=alerts.filter(a=>a.tank===t.id&&!a.read&&a.sev!=='info').length;
    const mini=ORDER.map(k=>{ const s=statusOf(k,t.r[k]); return `<div>${PARAMS[k].label}<b class="${s==='warn'?'w':s==='bad'?'x':''}">${fmt(k,t.r[k])}${PARAMS[k].unit?' '+PARAMS[k].unit:''}</b></div>`; }).join('');
    const foot = (open?`<span class="flag alerts">🔔 ${open} new alert${open>1?'s':''}</span>`:'') + (w.findings.length?`<span class="flag waste">🚰 ${w.findings[0].title}</span>`:'<span class="flag ok">No wastage found</span>');
    return `<button class="tank" data-open="${t.id}" aria-label="Open ${esc(t.name)}">
      <span class="badge b-${st}">${LABEL[st]}</span>
      <div class="tank-top">${vessel(t.r.level,st)}<div><div class="tank-name"><span class="swatch" style="background:${color(t)}"></span>${esc(t.name)}</div><div class="tank-cap">${t.cap.toLocaleString()} L · ${t.manual?'manual readings':'live'}</div></div></div>
      <div class="mini">${mini}</div><div class="tank-foot">${foot}</div></button>`;
  }).join('');
  $('#view').innerHTML=`<section class="panel">
    <div class="stats">
      <div class="stat"><div class="k">Tanks</div><div class="v">${tanks.length}</div></div>
      <div class="stat"><div class="k">Water stored</div><div class="v">${L(stored)}</div></div>
      <div class="stat"><div class="k">Need action</div><div class="v" style="color:${crit?'var(--bad)':'inherit'}">${crit}<small> tank${crit===1?'':'s'}</small></div></div>
      <div class="stat"><div class="k">Est. wasted, 7 days</div><div class="v" style="color:${wasted?'var(--warn)':'inherit'}">${L(wasted)}</div></div>
    </div>
    <div class="head"><div><h2>Your water tanks</h2><div class="sub">${tanks.length} tank${tanks.length===1?'':'s'} · tap one to see details</div></div>
      <button class="btn btn-primary" data-add>＋ Add tank</button></div>
    ${tanks.length?'':'<div class="empty">No tanks yet. Add your first one to start monitoring.</div>'}
    <div class="grid">${cards}<button class="tank add" data-add><span>＋</span>Add another tank</button></div></section>`;
}

function wasteCard(t,w,compact){
  const flagged=w.findings.length;
  const body = flagged ? w.findings.map(x=>`<div class="finding"><b>${x.sev==='critical'?'⛔':'🚰'} ${x.title}${x.loss?` · about ${L(x.loss)} lost`:''}</b><span class="why">${x.why}</span>${compact?'':`<ul>${x.actions.map(a=>`<li>${a}</li>`).join('')}</ul>`}</div>`).join('')
    : `<div class="finding"><b>✅ No signs of wastage</b><span class="why">No overnight loss, overflows or unusual use in the last 7 days.</span></div>`;
  return `<div class="wcard ${flagged?'flagged':''}">
    <div class="m-top"><div class="tank-name"><span class="swatch" style="background:${color(t)}"></span>${esc(t.name)}</div><span class="badge ${flagged?'b-warn':'b-good'}">${flagged?flagged+' issue'+(flagged>1?'s':''):'Efficient'}</span></div>
    <div style="display:flex;gap:24px;flex-wrap:wrap">
      <div><div class="wnum">${L(w.weekLoss)}</div><div class="sub">est. wasted, 7 days</div></div>
      <div><div class="wnum">${L(w.avgUse)}<small>/day</small></div><div class="sub">usual daily use</div></div>
    </div>${body}</div>`;
}

function renderDetail(t){
  const st=overall(t), w=analyzeWaste(t);
  const issues=ORDER.filter(k=>statusOf(k,t.r[k])!=='good').map(k=>PARAMS[k].label.toLowerCase());
  const summary = st==='good' ? `✅ <div><b>All readings are in the ideal range.</b> This water is in good condition.</div>`
    : `${st==='bad'?'⛔':'⚠️'} <div><b>${issues.length} reading${issues.length>1?'s':''} outside the ideal range:</b> ${issues.join(', ')}. See the steps under each card below.</div>`;
  const metrics=ORDER.map(k=>{
    const p=PARAMS[k], v=t.r[k], s=statusOf(k,v), side=sideOf(k,v), tips=p.advice[side]||p.advice.good;
    return `<article class="metric st-${s}">
      <div class="m-top"><div class="m-label"><span class="m-icon">${p.icon}</span>${p.label}</div><span class="badge b-${s}">${STATUS_WORD[s]}${side!=='good'?' · '+side:''}</span></div>
      <div class="m-row"><div class="m-value">${fmt(k,v)}<small>${p.unit}</small></div>${spark(t.live.map(d=>d[k]),k)}</div>
      <div>${scale(k,v)}</div><div class="ideal">Should be: ${p.idealText}</div>
      <div class="advice"><h4>${side==='good'?'Status':'What you can do'}</h4><ul>${tips.map(x=>`<li>${x}</li>`).join('')}</ul></div></article>`;
  }).join('');
  const my=alerts.filter(a=>a.tank===t.id).slice(0,5);
  $('#view').innerHTML=`<section class="panel">
    <button class="back" data-home>← All tanks</button>
    <div class="detail-head">
      <div><h2><span class="swatch" style="background:${color(t)};width:14px;height:14px"></span>${esc(t.name)} <span class="badge b-${st}">${LABEL[st]}</span></h2>
        <div class="sub" style="margin-top:4px">${t.cap.toLocaleString()} L capacity · about ${L(t.cap*t.r.level/100)} in the tank now · ${t.manual?'manual readings':'live simulated readings'}</div></div>
      <div class="actions">
        <button class="btn btn-ghost" data-trend="${t.id}">📈 Trends</button>
        <button class="btn btn-ghost" data-read>✎ Enter readings</button>
        ${t.manual?'<button class="btn btn-ghost" data-live>▶ Resume live</button>':''}
        <button class="btn btn-ghost" data-rename>Rename</button>
        <button class="btn btn-danger" data-del>Remove</button>
      </div></div>
    <div class="summary ${st}">${summary}</div>
    <div class="metrics">${metrics}</div>
    <div class="two-col">
      <div><h3 class="sec">Water wastage watch</h3>${wasteCard(t,w,false)}</div>
      <div><h3 class="sec" style="display:flex;justify-content:space-between">Recent alerts <a class="al-meta" style="font-size:13px" href="#alerts">View all →</a></h3>
        <div class="alist">${my.length?my.map(alertRow).join(''):'<div class="empty box">No alerts for this tank yet.</div>'}</div></div>
    </div>
    <div class="ref" style="margin-top:26px"><h3 class="sec">Quick reference</h3><div class="wrap"><table>
      <thead><tr><th>Parameter</th><th>Ideal</th><th>Acceptable limit</th><th>Why it matters</th></tr></thead><tbody>
        <tr><td>pH</td><td>6.5 – 8.5</td><td>6.0 – 9.0</td><td>Low pH corrodes pipes; high pH causes scale and a bitter taste</td></tr>
        <tr><td>Temperature</td><td>10 – 25 °C</td><td>5 – 30 °C</td><td>Warm water speeds up bacteria and algae growth</td></tr>
        <tr><td>Turbidity</td><td>&lt; 1 NTU</td><td>≤ 5 NTU</td><td>Cloudiness shields germs from disinfection</td></tr>
        <tr><td>Water level</td><td>30 – 90 %</td><td>15 – 97 %</td><td>Avoids running dry and overflow waste</td></tr>
      </tbody></table></div></div></section>`;
}

function alertRow(a){
  return `<div class="al ${a.read?'':'unread'}">
    <div class="al-ic ${a.sev}">${SEV[a.sev].ic}</div>
    <div class="al-body"><div class="al-t">${esc(a.title)} <span class="tag ${a.sev}">${SEV[a.sev].name}</span></div>
      <div class="al-m">${esc(a.msg)}</div>
      <div class="al-meta"><span>${esc(a.tankName)}</span><span>${ago(a.t)}</span>${tanks.some(t=>t.id===a.tank)?`<a data-open="${a.tank}">View tank</a>`:''}${a.read?'':`<a data-readone="${a.id}">Mark read</a>`}</div></div>
    ${a.read?'':'<span class="unread-dot" aria-label="Unread"></span>'}</div>`;
}

function renderAlerts(){
  const counts={all:alerts.length}; ['critical','warning','wastage','info'].forEach(s=>counts[s]=alerts.filter(a=>a.sev===s).length);
  const list=alerts.filter(a=>alertFilter==='all'||a.sev===alertFilter);
  const seg=[['all','All'],['critical','Critical'],['warning','Warnings'],['wastage','Wastage'],['info','Resolved']].map(([k,l])=>`<button class="${alertFilter===k?'on':''}" data-filter="${k}">${l} ${counts[k]?`(${counts[k]})`:''}</button>`).join('');
  const sw=(k,label,help)=>`<div class="setrow"><div>${label}<small>${help}</small></div><label class="switch"><input type="checkbox" data-set="${k}" ${settings[k]?'checked':''}><span></span></label></div>`;
  const opts=tanks.map(t=>`<option value="${t.id}" ${demoSel===t.id?'selected':''}>${esc(t.name)}</option>`).join('');
  $('#view').innerHTML=`
  <section class="panel">
    <div class="head"><div><h2>Notifications</h2><div class="sub">${unread()} unread · newest first</div></div>
      <div class="actions"><button class="btn btn-ghost btn-sm" data-readall>Mark all read</button><button class="btn btn-ghost btn-sm" data-clear>Clear all</button></div></div>
    <div class="toolbar"><div class="seg" role="tablist">${seg}</div></div>
    <div class="alist">${list.length?list.slice(0,40).map(alertRow).join(''):'<div class="empty">Nothing here. You\'re all caught up.</div>'}</div>
  </section>
  <section class="panel">
    <div class="head"><div><h2>Water wastage watch</h2><div class="sub">Checks each tank's last 7 days for overnight loss (leaks), overflows, unusual use and sudden drops</div></div></div>
    <div class="wgrid">${tanks.map(t=>wasteCard(t,analyzeWaste(t),false)).join('')||'<div class="empty">Add a tank to start checking for wastage.</div>'}</div>
  </section>
  <section class="panel">
    <div class="two-col" style="margin-top:0">
      <div><h3 class="sec">Alert settings</h3><div class="setlist">
        ${sw('popCritical','Critical alerts','Unsafe water or a sudden drop in level')}
        ${sw('popWarning','Warnings','A reading drifting out of the ideal range')}
        ${sw('popWastage','Wastage alerts','Possible leaks, overflows and unusual use')}
        ${sw('popInfo','Back-to-normal updates','When a reading returns to the ideal range')}
        ${sw('desktop','Desktop notifications','Also notify outside this page, if your browser allows it')}
      </div><p class="note" id="deskNote"></p></div>
      <div><h3 class="sec">Try it out</h3><p class="sub" style="margin-bottom:12px">Simulate an event on a tank to see how alerts appear.</p>
        <div class="demo"><select id="demoTank" aria-label="Tank">${opts}</select>
          <button class="btn btn-ghost btn-sm" data-demo="burst">Burst pipe</button>
          <button class="btn btn-ghost btn-sm" data-demo="overflow">Overflow</button>
          <button class="btn btn-ghost btn-sm" data-demo="dirty">Dirty water</button>
          <button class="btn btn-ghost btn-sm" data-demo="acid">Low pH</button></div>
      </div>
    </div>
  </section>`;
}

function renderTrends(){
  const sel = trendSel.tank==='all'?tanks:tanks.filter(t=>t.id===trendSel.tank);
  if(trendSel.tank!=='all' && !sel.length) trendSel.tank='all';
  const list=(trendSel.tank==='all'?tanks:sel).map(t=>({name:t.name,color:color(t),pts:seriesFor(t,trendSel.range),tank:t}));
  const rangeName={'24h':'last 24 hours','7d':'last 7 days','live':'live, last few minutes'}[trendSel.range];
  const legend = (list.length>1?list.map(s=>`<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join(''):'') + `<span><i class="band"></i>Ideal range</span>` + (trendSel.range!=='live'?`<span>◯ Overflow</span>`:'');
  const charts=ORDER.map(k=>{ const id='ch-'+k; const cur=list.map(s=>`${fmt(k,s.tank.r[k])}${PARAMS[k].unit?' '+PARAMS[k].unit:''}`).join(' · ');
    return `<div class="chart" data-chart="${id}"><h4>${PARAMS[k].icon} ${PARAMS[k].label}<span>now: ${cur}</span></h4>${lineChart(id,k,list,trendSel.range)}</div>`; }).join('');
  // daily water use bars (last 7 days) per tank
  const uses=list.map(s=>({s,w:analyzeWaste(s.tank)}));
  const maxU=Math.max(1,...uses.flatMap(u=>u.w.dailyUse));
  const days=[...Array(7)].map((_,i)=>new Date(Date.now()-(6-i)*86400e3).toLocaleDateString([], {weekday:'short'}));
  const useTable=`<div class="wrap"><table class="dtable"><thead><tr><th>Tank</th>${days.map(d=>`<th class="n">${d}</th>`).join('')}<th class="n">Avg / day</th></tr></thead><tbody>
    ${uses.map(u=>`<tr><td><span class="swatch" style="background:${u.s.color};display:inline-block;margin-right:6px"></span>${esc(u.s.name)}</td>${u.w.dailyUse.map(v=>`<td class="n">${Math.round(v).toLocaleString()}</td>`).join('')}<td class="n"><b>${Math.round(u.w.dailyUse.reduce((a,b)=>a+b,0)/7).toLocaleString()}</b></td></tr>`).join('')}</tbody></table></div>`;
  const bars=uses.map(u=>{ const W=520,H=150,m={l:40,r:8,t:8,b:22}, bw=(W-m.l-m.r)/7;
    const ys=niceStep(maxU/3); let g=''; for(let v=0;v<=maxU+1e-9;v+=ys){ const y=m.t+(H-m.t-m.b)*(1-v/maxU); g+=`<line x1="${m.l}" x2="${W-m.r}" y1="${y}" y2="${y}" stroke="var(--grid)"/><text x="${m.l-6}" y="${y+4}" text-anchor="end">${v>=1000?(v/1000)+'k':v}</text>`; }
    const b=u.w.dailyUse.map((v,i)=>{ const h=(H-m.t-m.b)*v/maxU, x=m.l+i*bw+bw*.22, y=m.t+(H-m.t-m.b)-h, high=u.w.avgUse&&v>u.w.avgUse*1.4&&i===6;
      return `<path d="M${x},${y+h} V${y+4} q0,-4 4,-4 h${bw*.56-8} q4,0 4,4 V${y+h}Z" fill="${u.s.color}" opacity="${high?1:.85}"><title>${days[i]}: ${Math.round(v).toLocaleString()} L${high?' (unusually high)':''}</title></path><text x="${x+bw*.28}" y="${H-6}" text-anchor="middle">${days[i]}</text>`; }).join('');
    return `<div class="chart"><h4><span style="display:flex;align-items:center;gap:6px;color:var(--ink);font-size:14px;font-weight:700"><span class="swatch" style="background:${u.s.color}"></span>${esc(u.s.name)}</span><span>usual ${L(u.w.avgUse)}/day</span></h4><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Daily water use for ${esc(u.s.name)}">${g}${b}</svg></div>`; }).join('');

  $('#view').innerHTML=`<section class="panel">
    <div class="controls">
      <label for="trTank">Tank</label><select id="trTank"><option value="all">All tanks</option>${tanks.map(t=>`<option value="${t.id}" ${trendSel.tank===t.id?'selected':''}>${esc(t.name)}</option>`).join('')}</select>
      <div class="seg" style="margin-left:auto">${[['live','Live'],['24h','24 hours'],['7d','7 days']].map(([k,l])=>`<button class="${trendSel.range===k?'on':''}" data-range="${k}">${l}</button>`).join('')}</div>
    </div>
    <div class="head" style="margin-bottom:8px"><div><h2>Water quality and level</h2><div class="sub">Showing ${rangeName}. Hover a chart to see exact values.</div></div></div>
    <div class="legend">${legend}</div>
    ${tanks.length?`<div class="charts">${charts}</div>`:'<div class="empty">Add a tank to see trends.</div>'}
  </section>
  <section class="panel">
    <div class="head"><div><h2>Daily water use</h2><div class="sub">Litres drawn from each tank per day, last 7 days. Spot unusual spikes that may mean wastage.</div></div></div>
    <div class="charts">${bars}</div>
    <h3 class="sec" style="margin-top:20px">As a table (litres)</h3>${useTable}
  </section>`;
  wireCharts();
  document.querySelectorAll('.chart .hit').forEach(h=>{ h.addEventListener('mouseenter',()=>hovering=true); h.addEventListener('mouseleave',()=>hovering=false); });
}

/* =========================================================
   Modals
   ========================================================= */
let editingId=null;
function openModal(id){ const m=$(id); m.classList.add('open'); const f=m.querySelector('input'); if(f) setTimeout(()=>f.focus(),30); }
function closeModals(){ document.querySelectorAll('.overlay.open').forEach(m=>m.classList.remove('open')); }
function openTankModal(t){
  editingId=t?t.id:null;
  $('#tmTitle').textContent=t?'Rename tank':'Add a water tank';
  $('#tmSub').textContent=t?'Change the name or capacity.':'Give it a name you\'ll recognise, like Home or Second Home.';
  $('#tSubmit').textContent=t?'Save':'Add tank';
  $('#tName').value=t?t.name:''; $('#tCap').value=t?t.cap:1000; $('#tErr').textContent='';
  const used=new Set(tanks.map(x=>x.name.toLowerCase()));
  $('#chips').innerHTML=NAME_IDEAS.filter(n=>!used.has(n.toLowerCase())).map(n=>`<button type="button" class="chip" data-chip="${n}">${n}</button>`).join('');
  openModal('#tankModal');
}
$('#tankForm').addEventListener('submit',e=>{
  e.preventDefault();
  const name=$('#tName').value.trim(), cap=Math.round(+$('#tCap').value);
  if(!name){ $('#tErr').textContent='Please enter a name.'; return; }
  if(tanks.some(t=>t.name.toLowerCase()===name.toLowerCase()&&t.id!==editingId)){ $('#tErr').textContent='You already have a tank with that name.'; return; }
  if(!(cap>=50)){ $('#tErr').textContent='Capacity should be at least 50 litres.'; return; }
  if(editingId){ const t=tanks.find(x=>x.id===editingId); t.name=name; t.cap=cap; alerts.forEach(a=>{ if(a.tank===t.id) a.tankName=name; }); }
  else{ const t=makeTank(name,cap,nextSlot(),{ph:+rnd(6.9,7.8).toFixed(1),temp:+rnd(18,23).toFixed(1),turb:+rnd(.3,.8).toFixed(1),leak:false,overflow:false}); evaluate(t,true); toastQueueOnLoad=[]; tanks.push(t); }
  save(); closeModals(); render();
});
const RID={ph:'#rPh',temp:'#rTemp',turb:'#rTurb',level:'#rLevel'};
$('#readForm').addEventListener('submit',e=>{
  e.preventDefault();
  const t=currentTank(); if(!t) return;
  const bounds={ph:[0,14],temp:[-5,60],turb:[0,100],level:[0,100]}, vals={};
  for(const k of ORDER){ const raw=$(RID[k]).value, v=+raw;
    if(raw===''||isNaN(v)||v<bounds[k][0]||v>bounds[k][1]){ $('#rErr').textContent=`Check the ${PARAMS[k].label.toLowerCase()} value (${bounds[k][0]} to ${bounds[k][1]}).`; return; } vals[k]=v; }
  t.r=vals; t.manual=true; t.live.push({t:Date.now(),...vals}); if(t.live.length>LIVE_MAX)t.live.shift();
  evaluate(t,false); save(); closeModals(); render();
});
$('#delYes').addEventListener('click',()=>{ const id=location.hash.slice(1); tanks=tanks.filter(t=>t.id!==id); save(); closeModals(); location.hash=''; });

/* =========================================================
   Events
   ========================================================= */
document.addEventListener('click',e=>{
  if(e.target.classList.contains('overlay')){ closeModals(); return; }
  const el=e.target.closest('[data-open],[data-add],[data-home],[data-rename],[data-del],[data-read],[data-live],[data-close],[data-chip],[data-trend],[data-filter],[data-readall],[data-clear],[data-readone],[data-range],[data-demo]');
  if(!el) return;
  const d=el.dataset, t=currentTank();
  if(d.open){ location.hash=d.open; window.scrollTo({top:0,behavior:'smooth'}); }
  else if('add' in d) openTankModal(null);
  else if('home' in d) location.hash='';
  else if('rename' in d) openTankModal(t);
  else if('del' in d){ $('#delText').textContent=`"${t.name}" and its readings will be removed from your dashboard.`; openModal('#delModal'); }
  else if('read' in d){ ORDER.forEach(k=>$(RID[k]).value=fmt(k,t.r[k])); $('#rErr').textContent=''; openModal('#readModal'); }
  else if('live' in d){ t.manual=false; save(); render(); }
  else if('close' in d) closeModals();
  else if(d.chip){ $('#tName').value=d.chip; $('#tName').focus(); }
  else if(d.trend){ trendSel.tank=d.trend; location.hash='trends'; }
  else if(d.filter){ alertFilter=d.filter; renderAlerts(); }
  else if('readall' in d){ alerts.forEach(a=>a.read=true); save(); render(); }
  else if('clear' in d){ alerts=[]; save(); render(); }
  else if(d.readone){ const a=alerts.find(x=>x.id===d.readone); if(a)a.read=true; save(); render(); }
  else if(d.range){ trendSel.range=d.range; renderTrends(); }
  else if(d.demo){
    const tk=tanks.find(x=>x.id===$('#demoTank').value); if(!tk) return; tk.manual=false;
    if(d.demo==='burst'){ const lv=tk.r.level; for(let i=1;i<=4;i++) tk.live.push({t:Date.now()+i,...tk.r,level:clamp(lv-i*3,3,100)}); tk.r.level=clamp(lv-12,3,100); }
    if(d.demo==='overflow'){ tk.r.level=100; tk.hist[tk.hist.length-1].of=1; tk.hist[tk.hist.length-1].level=100; }
    if(d.demo==='dirty'){ tk.r.turb=6.5; }
    if(d.demo==='acid'){ tk.r.ph=5.6; }
    evaluate(tk,false); save(); render();
  }
});
document.addEventListener('change',e=>{
  if(e.target.id==='demoTank'){ demoSel=e.target.value; }
  if(e.target.id==='trTank'){ trendSel.tank=e.target.value; renderTrends(); }
  if(e.target.dataset.set){ const k=e.target.dataset.set; settings[k]=e.target.checked;
    if(k==='desktop' && settings.desktop){
      const note=$('#deskNote');
      try{
        if(!('Notification' in window)) throw 0;
        Notification.requestPermission().then(p=>{ if(p!=='granted'){ settings.desktop=false; e.target.checked=false; note.textContent='Your browser blocked desktop notifications on this page. In-page alerts will still pop up.'; save(); } else note.textContent='Desktop notifications are on.'; }).catch(()=>{ settings.desktop=false; e.target.checked=false; note.textContent='Desktop notifications are not available here. In-page alerts will still pop up.'; save(); });
      }catch(_){ settings.desktop=false; e.target.checked=false; note.textContent='Desktop notifications are not available here. In-page alerts will still pop up.'; }
    }
    save(); }
});
document.addEventListener('keydown',e=>{ if(e.key==='Escape') closeModals(); });
$('#logo').addEventListener('click',()=>location.hash='');
$('#logo').addEventListener('keydown',e=>{ if(e.key==='Enter') location.hash=''; });
window.addEventListener('hashchange',()=>{ hovering=false; render(); });

/* =========================================================
   Start
   ========================================================= */
load();
tanks.forEach(t=>evaluate(t,true));
save(); render();
if(toastQueueOnLoad.length){
  const n=toastQueueOnLoad.filter(a=>a.sev!=='info').length;
  if(n) toast({sev:toastQueueOnLoad.some(a=>a.sev==='critical')?'critical':'warning'},
    `<span>🔔</span><div style="cursor:pointer" onclick="location.hash='alerts'"><b>${n} new alert${n>1?'s':''}</b><p>Open Alerts to see what needs attention.</p></div><button aria-label="Dismiss">×</button>`);
  toastQueueOnLoad=[];
}
setInterval(tick,TICK_MS);
