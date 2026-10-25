
/* AstroScope competition upgrade — added without replacing the existing visual system. */
let WEATHER_STATE = null;
let FORECAST_STATE = null;
let REMINDERS = JSON.parse(localStorage.getItem('as_reminders') || '[]');

const BRIGHT_STARS = [
  ['Sirius',6.7525,-16.7161,-1.46],['Canopus',6.3992,-52.6957,-0.74],['Arcturus',14.261,19.1825,-0.05],
  ['Vega',18.6156,38.7837,0.03],['Capella',5.2782,45.998,0.08],['Rigel',5.2423,-8.2016,0.13],
  ['Procyon',7.655,5.225,0.34],['Betelgeuse',5.9195,7.4071,0.42],['Altair',19.8464,8.8683,0.77],
  ['Aldebaran',4.5987,16.5093,0.85],['Antares',16.4901,-26.432,0.96],['Spica',13.4199,-11.1614,0.98],
  ['Pollux',7.7553,28.0262,1.14],['Fomalhaut',22.9608,-29.6222,1.16],['Deneb',20.6905,45.2803,1.25],
  ['Regulus',10.1395,11.9672,1.35],['Polaris',2.5303,89.2641,1.98]
].map(([name,rah,dec,mag])=>({name,ra:rah*15*RAD,dec:dec*RAD,mag}));

async function loadEventCatalog(){
  EVENTS_LOAD_STATE='loading';
  let payload=null;
  try{
    const r=await fetch('/api/events',{cache:'no-store'});
    if(!r.ok) throw new Error('event API unavailable');
    payload=await r.json();
  }catch(e){
    try{ const r=await fetch('data/events.json',{cache:'no-store'}); if(!r.ok) throw new Error('event file unavailable'); payload=await r.json(); }catch(_){}
  }
  EVENTS = (payload?.events || []).map(e=>({...e,_date:new Date(e.date+'T00:00:00Z')})).sort((a,b)=>a._date-b._date);
  EVENTS_LOAD_STATE=payload&&Array.isArray(payload.events)?'ready':'error';
  CATEGORIES=[...new Set(EVENTS.map(e=>e.category))];
  const sel=document.getElementById('fCategory');
  if(sel) sel.innerHTML='<option value="">All Categories</option>'+CATEGORIES.map(c=>`<option>${c}</option>`).join('');
}

function clamp(v,a=0,b=100){return Math.max(a,Math.min(b,v));}
function weatherAt(date){
  if(!FORECAST_STATE?.list?.length) return null;
  let best=null,delta=Infinity;
  for(const item of FORECAST_STATE.list){
    const t=new Date((item.dt||0)*1000), d=Math.abs(t-date);
    if(d<delta){delta=d;best=item;}
  }
  return delta<=2.5*3600000?best:null;
}
function eventTargetCoords(e,t){
  const n=(e.name||'').toLowerCase(), st=(e.subtype||'').toLowerCase();
  if(e.category==='Eclipse') return st.includes('solar')?sunCoords(t):moonCoords(t);
  if(e.category==='Planet'){
    const p=PLANETS.find(p=>n.includes(p.name.toLowerCase()));
    return p?planetGeoRaDec(p,t):null;
  }
  return null;
}
function skyForecastForEvent(e){
  if(!USER_LOC || e.category==='Seasonal') return null;
  const t=new Date(e.peak||e.date+'T00:00:00Z');
  const sun=sunCoords(t), moon=moonCoords(t), mi=moonIllumFrac(t);
  const sunAlt=altAz(sun.ra,sun.dec,t,USER_LOC.lat,USER_LOC.lng).alt;
  const moonAlt=altAz(moon.ra,moon.dec,t,USER_LOC.lat,USER_LOC.lng).alt;
  const target=eventTargetCoords(e,t);
  const targetAlt=target?altAz(target.ra,target.dec,t,USER_LOC.lat,USER_LOC.lng).alt:null;
  const wf=weatherAt(t);
  const clouds=wf?.clouds?.all;
  const humidity=wf?.main?.humidity;
  let darkness=e.category==='Meteor Shower' ? clamp((-sunAlt+6)/24*100) : 100;
  let horizon=targetAlt==null?80:clamp((targetAlt+5)/55*100);
  let moonPenalty=(moonAlt>0 ? mi.frac*30 : 0);
  let score=0.52*darkness+0.32*horizon+16-moonPenalty;
  if(clouds!=null) score=score*0.72 + (100-clouds)*0.28;
  score=Math.round(clamp(score));
  const solarEclipse=e.category==='Eclipse'&&(e.subtype||'').toLowerCase().includes('solar');
  const geometryOnly=clouds==null;
  // A numeric verdict overstates the quality of these simplified positions and incomplete local data.
  const verdict=geometryOnly?'Geometry only':score>=82?'Favorable indicators':score>=68?'Some favorable indicators':score>=50?'Mixed indicators':'Unfavorable indicators';
  return {score,verdict,t,sunAlt,moonAlt,moonIllum:Math.round(mi.frac*100),targetAlt,clouds,humidity,weatherKnown:clouds!=null,geometryOnly,solarEclipse};
}

async function loadForecast(){
  if(!USER_LOC) return;
  try{
    const r=await fetch(`/api/forecast?lat=${encodeURIComponent(USER_LOC.lat)}&lon=${encodeURIComponent(USER_LOC.lng)}`);
    if(r.ok) FORECAST_STATE=await r.json();
  }catch(e){ FORECAST_STATE=null; }
}

async function renderWeather(){
  const body=document.getElementById('weatherBody');
  if(!USER_LOC||!body) return;
  body.textContent='Loading astronomy conditions…';
  try{
    const [r]=await Promise.all([
      fetch(`/api/weather?lat=${encodeURIComponent(USER_LOC.lat)}&lon=${encodeURIComponent(USER_LOC.lng)}`),
      loadForecast()
    ]);
    if(!r.ok) throw new Error('weather fetch failed');
    const d=await r.json(); WEATHER_STATE=d;
    const clouds=d.clouds?.all??null, humidity=d.main?.humidity??null, visKm=d.visibility!=null?d.visibility/1000:null;
    const now=new Date(), moon=moonCoords(now), mi=moonIllumFrac(now), moonAlt=altAz(moon.ra,moon.dec,now,USER_LOC.lat,USER_LOC.lng).alt;
    const transparency=clouds==null?'—':clouds<15&&humidity<70?'Excellent':clouds<35&&humidity<82?'Good':clouds<65?'Fair':'Poor';
    const wind=d.wind?.speed??0;
    const seeing=(clouds!=null && clouds>70)?'Poor':wind<3?'Good (est.)':wind<7?'Fair (est.)':'Poor (est.)';
    const moonInterference=moonAlt<=0?'None':mi.frac<.25?'Low':mi.frac<.65?'Moderate':'High';
    const score=astronomyConditionScore(now,d);
    body.innerHTML=`<div class="condrow" style="margin-bottom:0;">
      <div class="card c"><div class="l">Astronomy Score</div><div class="v">${score}/100</div></div>
      <div class="card c"><div class="l">Cloud Cover</div><div class="v">${clouds!=null?clouds+'%':'—'}</div></div>
      <div class="card c"><div class="l">Humidity</div><div class="v">${humidity!=null?humidity+'%':'—'}</div></div>
      <div class="card c"><div class="l">Atmos. Visibility</div><div class="v">${visKm!=null?visKm.toFixed(1)+' km':'—'}</div></div>
      <div class="card c"><div class="l">Moon Brightness</div><div class="v">${Math.round(mi.frac*100)}%</div></div>
      <div class="card c"><div class="l">Moon Interference</div><div class="v" style="font-size:13px">${moonInterference}</div></div>
      <div class="card c"><div class="l">Transparency</div><div class="v" style="font-size:13px">${transparency}</div></div>
      <div class="card c"><div class="l">Seeing</div><div class="v" style="font-size:13px">${seeing}</div></div>
    </div><div class="muted" style="font-size:11px;margin-top:9px;line-height:1.5">Transparency and seeing are heuristic estimates from available weather fields, not dedicated observatory measurements.</div>`;
    renderSkyIntelligence(); renderVisibleNow(); renderSkyMap(); checkReminders();
  }catch(e){ WEATHER_STATE=null; body.textContent='Weather conditions unavailable. Astronomical geometry will still be calculated.'; renderSkyIntelligence(); }
}

function astronomyConditionScore(t,weather=WEATHER_STATE){
  if(!USER_LOC) return 0;
  const s=sunCoords(t), m=moonCoords(t), mi=moonIllumFrac(t);
  const sunAlt=altAz(s.ra,s.dec,t,USER_LOC.lat,USER_LOC.lng).alt;
  const moonAlt=altAz(m.ra,m.dec,t,USER_LOC.lat,USER_LOC.lng).alt;
  const dark=sunAlt<=-18?100:sunAlt<=-6?70:sunAlt<=0?35:8;
  const clouds=weather?.clouds?.all??35, humidity=weather?.main?.humidity??65, vis=weather?.visibility??8000;
  const cloudScore=100-clouds, humidScore=clamp(115-humidity), visScore=clamp(vis/100);
  const moonPenalty=moonAlt>0?mi.frac*18:0;
  return Math.round(clamp(.44*dark+.30*cloudScore+.10*humidScore+.16*visScore-moonPenalty));
}
function findBestWindow(){
  if(!USER_LOC) return null;
  const now=new Date(); let best={score:-1,t:now};
  for(let i=0;i<=48;i++){
    const t=new Date(now.getTime()+i*15*60000), score=astronomyConditionScore(t);
    if(score>best.score) best={score,t};
  }
  const threshold=Math.max(45,best.score-7); let start=best.t,end=best.t;
  for(let i=1;i<=12;i++){const t=new Date(best.t.getTime()-i*15*60000);if(t<now||astronomyConditionScore(t)<threshold)break;start=t;}
  for(let i=1;i<=12;i++){const t=new Date(best.t.getTime()+i*15*60000);if(astronomyConditionScore(t)<threshold)break;end=t;}
  return {...best,start,end};
}
function renderSkyIntelligence(){
  const body=document.getElementById('intelBody'), ring=document.getElementById('astroScore'); if(!body||!ring)return;
  if(!USER_LOC){body.textContent='Select a location to calculate your observing window.';ring.textContent='—';return;}
  const w=findBestWindow(); ring.textContent=w.score;
  const m=moonIllumFrac(w.t), mc=moonCoords(w.t), ma=altAz(mc.ra,mc.dec,w.t,USER_LOC.lat,USER_LOC.lng).alt;
  const visible=countVisibleBodies(w.t); const clouds=WEATHER_STATE?.clouds?.all;
  const verdict=w.score>=80?'Excellent':w.score>=65?'Good':w.score>=48?'Fair':'Challenging';
  body.innerHTML=`<div style="font-size:14px;line-height:1.65"><strong>${fmtTimeTz(w.start,USER_LOC.tz)} – ${fmtTimeTz(w.end,USER_LOC.tz)}</strong> is your strongest window over the next 12 hours. <span class="muted">${verdict} observing conditions for ${USER_LOC.name}.</span></div>
  <div class="intel-metrics"><div class="intel-metric"><div class="k">Cloud cover</div><div class="v">${clouds!=null?clouds+'%':'Pending'}</div></div><div class="intel-metric"><div class="k">Moon interference</div><div class="v">${ma<=0?'None':Math.round(m.frac*100)+'%'}</div></div><div class="intel-metric"><div class="k">Visible targets</div><div class="v">${visible}</div></div><div class="intel-metric"><div class="k">Recommendation</div><div class="v">${verdict}</div></div></div>`;
}
function bodyNowList(t=new Date()){
  if(!USER_LOC) return [];
  const out=[]; const moon=moonCoords(t), ma=altAz(moon.ra,moon.dec,t,USER_LOC.lat,USER_LOC.lng);
  if(ma.alt>0) out.push({name:'Moon',icon:'🌙',alt:ma.alt,az:ma.az,score:clamp(55+ma.alt/2)});
  PLANETS.forEach(p=>{const c=planetGeoRaDec(p,t),h=altAz(c.ra,c.dec,t,USER_LOC.lat,USER_LOC.lng);if(h.alt>2)out.push({name:p.name,icon:'🪐',alt:h.alt,az:h.az,score:clamp(45+h.alt*.7)});});
  BRIGHT_STARS.forEach(s=>{const h=altAz(s.ra,s.dec,t,USER_LOC.lat,USER_LOC.lng);if(h.alt>8)out.push({name:s.name,icon:'⭐',alt:h.alt,az:h.az,score:clamp(72+h.alt*.25-s.mag*3)});});
  return out.sort((a,b)=>b.score-a.score);
}
function countVisibleBodies(t){return bodyNowList(t).length;}
function renderVisibleNow(){
  const el=document.getElementById('visibleNowGrid'); if(!el)return;
  if(!USER_LOC){el.innerHTML='<div class="muted">Select a location first.</div>';return;}
  const list=bodyNowList(new Date()).slice(0,8);
  el.innerHTML=list.length?list.map(o=>{const stars='★'.repeat(Math.max(1,Math.min(5,Math.round(o.score/20))))+'☆'.repeat(5-Math.max(1,Math.min(5,Math.round(o.score/20))));return `<div class="visible-object"><div class="name">${o.icon} ${o.name}</div><div class="rating">${stars}</div><div class="meta">Altitude ${Math.round(o.alt)}° · ${azLabel(o.az)}</div></div>`;}).join(''):'<div class="muted">No major catalog targets are above the horizon right now.</div>';
}
function azLabel(az){const a=((az%360)+360)%360;return ['N','NE','E','SE','S','SW','W','NW'][Math.round(a/45)%8];}

let SKY_ROT=0, SKY_ZOOM=1, skyPoints=[], dragStart=null, activePointers=new Map(), pinchStart=null, keyboardSkyIndex=-1;
function renderSkyMap(){
  const c=document.getElementById('skyMapCanvas'); if(!c||!USER_LOC)return;
  const r=c.getBoundingClientRect(), dpr=Math.min(2,devicePixelRatio||1); c.width=Math.max(1,r.width*dpr);c.height=Math.max(1,r.height*dpr);
  const ctx=c.getContext('2d');ctx.scale(dpr,dpr);const w=r.width,h=r.height;ctx.clearRect(0,0,w,h);
  ctx.strokeStyle='rgba(255,255,255,.10)';ctx.fillStyle='rgba(255,255,255,.55)';ctx.font='11px Inter, sans-serif';
  for(let alt=0;alt<=90;alt+=30){const y=h-(alt/90)*(h*.88);ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();ctx.fillText(alt+'°',6,y-4);}
  const t=new Date(); document.getElementById('skyMapTime').textContent=fmtDate(t,USER_LOC.tz)+' · '+fmtTimeTz(t,USER_LOC.tz);
  skyPoints=[];
  const objects=[...BRIGHT_STARS.map(s=>({name:s.name,coords:s,mag:s.mag,type:'star'}))];
  const moon=moonCoords(t);objects.push({name:'Moon',coords:moon,type:'moon'});
  PLANETS.forEach(p=>objects.push({name:p.name,coords:planetGeoRaDec(p,t),type:'planet'}));
  for(const o of objects){const a=altAz(o.coords.ra,o.coords.dec,t,USER_LOC.lat,USER_LOC.lng);if(a.alt<-8)continue;const rel=((((a.az-SKY_ROT)+540)%360)-180);const x=w/2+(rel/180)*(w/2)*SKY_ZOOM;const y=h-(Math.max(0,a.alt)/90)*(h*.88);if(x<-20||x>w+20)continue;const size=o.type==='moon'?7:o.type==='planet'?5:Math.max(2,4-(o.mag||1));ctx.beginPath();ctx.arc(x,y,size,0,Math.PI*2);ctx.fillStyle=o.type==='moon'?'#e8e8e8':o.type==='planet'?'#ffcf88':'rgba(255,255,255,.9)';ctx.fill();if(o.type!=='star'||(o.mag||9)<.9){ctx.fillStyle='rgba(255,255,255,.78)';ctx.fillText(o.name,x+7,y-5);}skyPoints.push({x,y,name:o.name,alt:a.alt,az:a.az});}
  const textList=document.getElementById('skyMapTextList');if(textList)textList.innerHTML=skyPoints.map(p=>`<li>${p.name}: altitude ${Math.round(p.alt)} degrees, azimuth ${Math.round(p.az)} degrees (${azLabel(p.az)})</li>`).join('');
  ctx.fillStyle='rgba(255,255,255,.7)';ctx.textAlign='center';ctx.fillText(`${azLabel(SKY_ROT+270)}    ←    ${azLabel(SKY_ROT)}    →    ${azLabel(SKY_ROT+90)}`,w/2,h-9);ctx.textAlign='left';
}
function setupSkyMapInteractions(){
  const c=document.getElementById('skyMapCanvas');if(!c||c.dataset.ready)return;c.dataset.ready='1';
  c.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Enter',' '].includes(e.key)||!skyPoints.length)return;e.preventDefault();if(e.key==='ArrowRight')keyboardSkyIndex=(keyboardSkyIndex+1)%skyPoints.length;else if(e.key==='ArrowLeft')keyboardSkyIndex=(keyboardSkyIndex-1+skyPoints.length)%skyPoints.length;else if(keyboardSkyIndex<0)keyboardSkyIndex=0;const p=skyPoints[keyboardSkyIndex];document.getElementById('skyMapSelected').textContent=`${p.name} · altitude ${Math.round(p.alt)}° · azimuth ${Math.round(p.az)}° (${azLabel(p.az)})`;});
  c.addEventListener('wheel',e=>{e.preventDefault();SKY_ZOOM=clamp(SKY_ZOOM*(e.deltaY<0?1.12:.9),.65,2.2);renderSkyMap();},{passive:false});
  c.addEventListener('pointerdown',e=>{c.setPointerCapture(e.pointerId);activePointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(activePointers.size===1)dragStart={x:e.clientX,rot:SKY_ROT};if(activePointers.size===2){const p=[...activePointers.values()];pinchStart={d:Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y),z:SKY_ZOOM};}});
  c.addEventListener('pointermove',e=>{if(!activePointers.has(e.pointerId))return;activePointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(activePointers.size===1&&dragStart){SKY_ROT=(dragStart.rot-(e.clientX-dragStart.x)*.35+360)%360;renderSkyMap();}else if(activePointers.size===2&&pinchStart){const p=[...activePointers.values()],d=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);SKY_ZOOM=clamp(pinchStart.z*d/pinchStart.d,.65,2.2);renderSkyMap();}});
  c.addEventListener('pointerup',e=>{const wasDrag=dragStart&&Math.abs(e.clientX-dragStart.x)>5;activePointers.delete(e.pointerId);if(!wasDrag&&activePointers.size===0){const r=c.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;let best=null,d=18;for(const p of skyPoints){const q=Math.hypot(p.x-x,p.y-y);if(q<d){d=q;best=p;}}document.getElementById('skyMapSelected').textContent=best?`${best.name} · altitude ${Math.round(best.alt)}° · azimuth ${Math.round(best.az)}° (${azLabel(best.az)})`:'';}if(activePointers.size===0){dragStart=null;pinchStart=null;}});
  c.addEventListener('pointercancel',()=>{activePointers.clear();dragStart=null;pinchStart=null;});
}

function renderOrbitLab(){
  const c=document.getElementById('orbitLabCanvas'),slider=document.getElementById('moonOrbitSlider'),v=document.getElementById('orbitVerdict');if(!c||!slider||!v)return;
  const r=c.getBoundingClientRect(),dpr=Math.min(2,devicePixelRatio||1);c.width=r.width*dpr;c.height=r.height*dpr;const ctx=c.getContext('2d');ctx.scale(dpr,dpr);const w=r.width,h=r.height,a=Number(slider.value)*RAD;
  // Angle 0 points the Moon toward the Sun (solar alignment); 180 places Earth between the Sun and Moon (lunar alignment).
  ctx.clearRect(0,0,w,h);const sun={x:w*.13,y:h*.5},earth={x:w*.62,y:h*.5},rad=Math.min(w,h)*.28,moon={x:earth.x-Math.cos(a)*rad,y:earth.y+Math.sin(a)*rad*.55};
  ctx.strokeStyle='rgba(255,255,255,.13)';ctx.beginPath();ctx.ellipse(earth.x,earth.y,rad,rad*.55,0,0,Math.PI*2);ctx.stroke();ctx.strokeStyle='rgba(255,208,108,.25)';ctx.beginPath();ctx.moveTo(sun.x,sun.y);ctx.lineTo(earth.x,earth.y);ctx.stroke();
  for(const [p,r0,color,label] of [[sun,22,'#ffc76a','SUN'],[earth,13,'#5d98d7','EARTH'],[moon,8,'#ddd','MOON']]){ctx.beginPath();ctx.arc(p.x,p.y,r0,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();ctx.fillStyle='rgba(255,255,255,.75)';ctx.font='10px Inter';ctx.fillText(label,p.x-r0,p.y+r0+15);}
  const deg=((Number(slider.value)%360)+360)%360,solar=Math.min(deg,360-deg)<11,lunar=Math.abs(deg-180)<11;
  v.textContent=solar?'🌑 Solar-eclipse geometry — Moon is between the Sun and Earth.':lunar?'🌕 Lunar-eclipse geometry — Earth is between the Sun and Moon.':'No eclipse — the three bodies are not aligned closely enough in this simplified orbital view.';
}

function eventCardHTML(e){
  const fav=FAVORITES.includes(e.id),f=skyForecastForEvent(e);
  const visibility=eventVisibility(e);
  const visBadge=`<span class="badge ${visibility.status==='visible'?'badge-good':'badge-warn'}">${visibility.label}</span>`;
  const forecast=f?`<div class="forecast-strip"><span class="forecast-score">${f.geometryOnly?'Geometry indicators':'Near-term indicators'} · ${f.verdict}</span><br>${f.targetAlt!=null?`Peak altitude ${Math.round(f.targetAlt)}° · `:''}Moon ${f.moonIllum}%${f.weatherKnown?` · Clouds ${f.clouds}%`:''}<br><span class="muted">${f.geometryOnly?'No matching forecast weather; position model is approximate.':''}</span></div>`:'';
  return `<article class="card evcard"><div style="display:flex;justify-content:space-between;"><span class="cat">${e.category}</span><button class="star-fav ${fav?'active':''}" aria-label="${fav?'Remove':'Save'} ${e.name}" aria-pressed="${fav}" onclick="toggleFav('${e.id}')">${fav?'★':'☆'}</button></div><h3><button type="button" class="event-title-button" aria-label="Open ${e.name} details" onclick="openEvent('${e.id}')">${e.name}</button></h3><div class="date">${e._date.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</div><div class="vis">${visBadge}</div>${forecast}</article>`;
}
function openEvent(id){
  const e=EVENTS.find(x=>x.id===id);if(!e)return;
  const peak=new Date(e.peak||`${e.date}T00:00:00Z`),forecastData=skyForecastForEvent(e);
  const solar=(e.subtype||'').toLowerCase().includes('solar');
  const eclipseBody=USER_LOC&&e.category==='Eclipse'?(solar?sunCoords(peak):moonCoords(peak)):null;
  const altitude=eclipseBody?altAz(eclipseBody.ra,eclipseBody.dec,peak,USER_LOC.lat,USER_LOC.lng).alt:null;
  const visibilityText=e.category==='Eclipse'
    ? (altitude<=0?`🔴 ${solar?'Sun':'Moon'} below horizon at catalog peak · not observable at that instant`:`🟡 ${solar?'Sun':'Moon'} above horizon at catalog peak · local eclipse circumstances are not in this catalog`)
    : (e.worldwide?'🌐 Broadly observable event (weather and local conditions vary)':'🟡 Regional visibility; this catalog does not identify the local viewing region');
  const visibility=USER_LOC?`<div class="card" style="padding:16px;margin-top:12px"><div class="muted" style="font-size:11px;text-transform:uppercase">Your Visibility — ${USER_LOC.name}</div><div style="margin-top:6px">${visibilityText}${altitude!==null?` · altitude ${Math.round(altitude)}°`:''}</div><div class="muted" style="font-size:12px;margin-top:6px">Horizon check at catalog peak only; local eclipse-path circumstances are not included. Weather and light pollution vary by site.</div></div>`:'';
  let forecast='';
  if(forecastData){
    const f=forecastData;
    forecast=`<div class="card" style="padding:16px;margin-top:12px"><div class="muted" style="font-size:11px;text-transform:uppercase">${f.geometryOnly?'Geometry indicators':'Near-term indicators'} · ${USER_LOC.name}</div><div style="font-size:19px;font-weight:600;margin-top:6px">${f.verdict}</div><div class="intel-metrics"><div class="intel-metric"><div class="k">Target altitude</div><div class="v">${f.targetAlt==null?'N/A':Math.round(f.targetAlt)+'°'}</div></div><div class="intel-metric"><div class="k">Sun altitude</div><div class="v">${Math.round(f.sunAlt)}°</div></div><div class="intel-metric"><div class="k">Moon</div><div class="v">${f.moonIllum}%</div></div><div class="intel-metric"><div class="k">Forecast clouds</div><div class="v">${f.weatherKnown?f.clouds+'%':'Unavailable for this date'}</div></div></div><div class="muted" style="font-size:11px;margin-top:9px">${f.geometryOnly?'No 0–100 score is shown because matching weather is unavailable. Positions use simplified calculations and do not establish a local solar eclipse path.':'Weather is a forecast near the event time. Geometry is simplified; this is not a guarantee of visibility.'}</div></div>`;
  }
  const rem=REMINDERS.includes(id),fav=FAVORITES.includes(id);
  document.getElementById('eventModalBody').innerHTML=`<button class="iconbtn modal-close" onclick="closeModal('eventModal')" aria-label="Close">✕</button><span class="cat" style="color:var(--cyan)">${e.category} · ${e.subtype||''}</span><h2 style="margin-top:6px">${e.name}</h2><div class="muted" style="font-size:13.5px;margin:6px 0 14px">${e._date.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'})}</div><p style="font-size:14px;line-height:1.6">${e.desc}</p><div class="condrow" style="margin-top:16px"><div class="card c"><div class="l">Peak (UTC)</div><div class="v" style="font-size:13px">${peak.toUTCString().slice(17,22)}</div></div><div class="card c"><div class="l">Naked Eye</div><div class="v" style="font-size:13px">${e.naked?'Yes':'No'}</div></div><div class="card c"><div class="l">Telescope</div><div class="v" style="font-size:13px">${e.telescope?'Recommended':'Optional'}</div></div><div class="card c"><div class="l">Photography</div><div class="v" style="font-size:13px">${e.photo?'Recommended':'—'}</div></div></div>${visibility}${forecast}${e.safety?'<div class="card" style="padding:14px;margin-top:12px;border-color:#704b2a">⚠️ Never look directly at the Sun without certified eclipse eye protection.</div>':''}<div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap"><button class="btn btn-ghost" onclick="toggleFav('${e.id}');openEvent('${e.id}')">${fav?'★ Saved':'☆ Save to My Sky'}</button><button class="btn btn-ghost" onclick="toggleReminder('${e.id}')">${rem?'🔔 Reminder on':'🔕 Remind me'}</button><button class="btn btn-ghost" onclick="downloadCalendarReminder('${e.id}')">Add calendar alert</button></div>`;
  showModal('eventModal');
}

function toggleReminder(id){
  if(REMINDERS.includes(id))REMINDERS=REMINDERS.filter(x=>x!==id);else REMINDERS.push(id);localStorage.setItem('as_reminders',JSON.stringify(REMINDERS));renderReminderList();openEvent(id);if(REMINDERS.includes(id))requestNotificationAccess();
}
async function requestNotificationAccess(){if(!('Notification'in window))return;try{await Notification.requestPermission();}catch(e){}}
function renderReminderList(){
  const el=document.getElementById('reminderList');if(!el)return;const list=EVENTS.filter(e=>FAVORITES.includes(e.id));el.innerHTML=list.length?list.map(e=>`<div class="reminder-row"><div><strong>${e.name}</strong><div class="muted" style="font-size:11px">${e._date.toLocaleDateString()}</div></div><div class="reminder-actions"><button class="mini-toggle ${REMINDERS.includes(e.id)?'active':''}" onclick="toggleReminder('${e.id}')" aria-pressed="${REMINDERS.includes(e.id)}">${REMINDERS.includes(e.id)?'🔔 On':'🔕 Off'}</button><button class="mini-toggle" onclick="downloadCalendarReminder('${e.id}')">Add calendar alert</button></div></div>`).join(''):'<div class="muted" style="font-size:12px">Save an event first to add a reminder.</div>';
}
function calendarText(value){return String(value||'').replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');}
function downloadCalendarReminder(id){
  const e=EVENTS.find(item=>item.id===id);if(!e)return;
  const dateOnly=!e.peak, start=dateOnly?e.date.replace(/-/g,''):new Date(e.peak).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
  const nextDay=new Date(`${e.date}T00:00:00Z`);nextDay.setUTCDate(nextDay.getUTCDate()+1);
  const end=dateOnly?nextDay.toISOString().slice(0,10).replace(/-/g,''):new Date(new Date(e.peak).getTime()+60*60000).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
  const dateLine=dateOnly?`DTSTART;VALUE=DATE:${start}\r\nDTEND;VALUE=DATE:${end}`:`DTSTART:${start}\r\nDTEND:${end}`;
  const ics=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//AstroScope//Observer reminders//EN','CALSCALE:GREGORIAN','BEGIN:VEVENT',`UID:${calendarText(id)}@astroscope.local`,`DTSTAMP:${new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'')}`,dateLine,`SUMMARY:${calendarText(e.name)}`,`DESCRIPTION:${calendarText(`${e.category}${e.subtype?` · ${e.subtype}`:''}. ${e.desc||''}`)}`,'BEGIN:VALARM','ACTION:DISPLAY','DESCRIPTION:AstroScope observing reminder','TRIGGER:-PT24H','END:VALARM','END:VEVENT','END:VCALENDAR'].join('\r\n');
  const url=URL.createObjectURL(new Blob([ics],{type:'text/calendar;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=`astroscope-${id}.ics`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function checkReminders(){
  if(!('Notification'in window)||Notification.permission!=='granted')return;const now=Date.now(),sent=JSON.parse(localStorage.getItem('as_notified')||'{}');
  for(const id of REMINDERS){const e=EVENTS.find(x=>x.id===id);if(!e)continue;const eventTime=e.peak?new Date(e.peak).getTime():new Date(`${e.date}T09:00:00`).getTime(),dt=eventTime-now;if(dt>0&&dt<=24*3600000&&!sent[id]){new Notification(`AstroScope · ${e.name}`,{body:'Your event is within 24 hours. Check local visibility, weather, and observing safety before heading out.'});sent[id]=Date.now();}}
  localStorage.setItem('as_notified',JSON.stringify(sent));
}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')checkReminders();});
window.addEventListener('focus',checkReminders);
setInterval(checkReminders,60*1000);

function renderEnhancements(){
  renderSkyIntelligence();
  renderVisibleNow();
  renderSkyMap();
  renderOrbitLab();
  renderReminderList();
  setupSkyMapInteractions();
}

(async function bootCompetitionUpgrade(){
  await loadEventCatalog();
  renderAll();
  setInterval(()=>{renderTonight();renderNextEvent();renderSkyIntelligence();renderVisibleNow();renderSkyMap();checkReminders();},60000);
})();
