/* AstroScope — Trip planner
   Dark-sky sites, distance, tonight's dark/moonless hours and a 60-night outlook.
   Uses globals from app.js: USER_LOC, EVENTS, RAD, sunCoords, moonCoords, altAz, moonIllumFrac.
   Re-renders on the custom events 'as:location' and 'as:page' (dispatched by app.js). */
(function(){
'use strict';

const BORTLE_GUIDE=[
  [1,'Excellent dark sky. The Milky Way casts shadows; zodiacal light is easy to see.'],
  [2,'Truly dark. The Milky Way is highly structured; airglow may be visible.'],
  [3,'Rural sky. Some glow on the horizon; the Milky Way is still rich.'],
  [4,'Rural / suburban transition. Light domes in several directions.'],
  [5,'Suburban sky. The Milky Way is weak near the horizon.'],
  [6,'Bright suburban sky. The Milky Way shows only near the zenith.'],
  [7,'Suburban / urban transition. The Milky Way is invisible.'],
  [8,'City sky. Only bright stars and planets are easy to see.'],
  [9,'Inner-city sky. Very few stars beyond the Moon and planets.']
];
const GEAR=[
  'Red-light torch (or a dimmed phone with a red filter)',
  'Warm layers: clear nights get cold fast',
  'Reclining chair or mat',
  'Binoculars (7×50 or 10×50 is plenty)',
  'Water, snacks and a power bank',
  'Tell someone your plan; check road access and the forecast the day before'
];

let SITES=[];
const state={radius:'any',sort:'score'};
const $=id=>document.getElementById(id);

/* ---------- maths helpers ---------- */
function km(a,b){
  const dLat=(b.lat-a.lat)*RAD, dLng=(b.lng-a.lng)*RAD;
  const h=Math.sin(dLat/2)**2+Math.cos(a.lat*RAD)*Math.cos(b.lat*RAD)*Math.sin(dLng/2)**2;
  return 2*6371*Math.asin(Math.sqrt(h));
}
const bMid=s=>(s.bortle[0]+s.bortle[1])/2;
const bLabel=s=>s.bortle[0]===s.bortle[1]?String(s.bortle[0]):s.bortle[0]+'–'+s.bortle[1];
function driveText(d){
  if(d>900) return 'Too far to drive';
  const mins=Math.round(d*1.3/50*60/5)*5; // straight line x1.3 road factor at ~50 km/h
  const h=Math.floor(mins/60), m=mins%60;
  return '~'+(h?h+'h ':'')+(m?m+'m':(h?'':'0m'));
}
function sampleAlts(site,t){
  const s=sunCoords(t), m=moonCoords(t);
  return {
    sun:altAz(s.ra,s.dec,t,site.lat,site.lng).alt,
    moon:altAz(m.ra,m.dec,t,site.lat,site.lng).alt
  };
}
/* hours of astronomical darkness (Sun below -18 deg) with the Moon down / up */
function scanNight(site,startMs,endMs){
  let dark=0, darkMoon=0;
  for(let ms=startMs; ms<endMs; ms+=15*60000){
    const a=sampleAlts(site,new Date(ms));
    if(a.sun<-18){ if(a.moon<0) dark+=0.25; else darkMoon+=0.25; }
  }
  return {dark,darkMoon};
}
function tonight(site){ const now=Date.now(); return scanNight(site,now,now+14*3600000); }
function localYMD(site,ms){
  return new Date(ms).toLocaleDateString('en-CA',{timeZone:site.tz}).split('-').map(Number);
}
function outlook(site,days){
  const [y,m,d]=localYMD(site,Date.now());
  const now=Date.now(), rows=[];
  for(let i=-1;i<days;i++){
    // a "night" runs from local solar noon to the next local solar noon
    const start=Date.UTC(y,m-1,d+i,12)-site.lng/15*3600000, end=start+24*3600000;
    if(end<now) continue;
    const r=scanNight(site,Math.max(start,now),end);
    const evening=new Date(start+6*3600000);
    const wk=evening.toLocaleDateString('en-US',{weekday:'short',timeZone:site.tz});
    const moonFrac=moonIllumFrac(new Date(start+12*3600000)).frac;
    rows.push({
      start, dark:r.dark, darkMoon:r.darkMoon, moonPct:Math.round(moonFrac*100),
      quality:r.dark+0.3*r.darkMoon*(1-moonFrac),
      weekend:wk==='Fri'||wk==='Sat',
      label:evening.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',timeZone:site.tz})
    });
  }
  return rows;
}
function scoreParts(site,dist,t){
  const darkness=Math.round((9-bMid(site))/8*100);
  const hours=Math.round(Math.min(t.dark/6,1)*100);
  const near=dist==null?0:Math.round(100-Math.min(dist/400,1)*100);
  return {darkness,hours,near,total:Math.round(.45*darkness+.30*hours+.25*near)};
}
const mapLink=s=>`https://www.lightpollutionmap.info/#zoom=9&lat=${s.lat}&lon=${s.lng}`;
const dirLink=s=>`https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`;

/* ---------- list ---------- */
function enrich(site){
  const dist=USER_LOC?km(USER_LOC,site):null, t=tonight(site);
  return {site,dist,t,score:scoreParts(site,dist,t)};
}
function cardHTML(x){
  const s=x.site, lit=10-Math.round(bMid(s));
  const meter=Array.from({length:9},(_,i)=>`<i class="${i<lit?'on':''}"></i>`).join('');
  const verdict=x.t.dark>=5?'Great':x.t.dark>=2?'Okay':'Moon-washed';
  return `<div class="card site-card" role="button" tabindex="0" data-site="${s.id}" aria-label="${s.name}, trip score ${x.score.total} out of 100">
    <div class="site-head"><span class="cat">Bortle ${bLabel(s)}</span><div class="trip-score">${x.score.total}<small>/100</small></div></div>
    <h3>${s.name}</h3>
    <div class="region">${s.region}</div>
    <div class="bortle-meter" title="Sky darkness (estimate)">${meter}</div>
    <div class="site-stats">
      <div class="site-stat"><div class="k">Distance</div><div class="v">${Math.round(x.dist).toLocaleString()} km</div></div>
      <div class="site-stat"><div class="k">Drive (est.)</div><div class="v">${driveText(x.dist)}</div></div>
      <div class="site-stat"><div class="k">Dark, moonless</div><div class="v">${x.t.dark.toFixed(1)} h</div></div>
      <div class="site-stat"><div class="k">Tonight</div><div class="v">${verdict}</div></div>
    </div>
  </div>`;
}
function renderTrip(){
  const grid=$('tripGrid'); if(!grid) return;
  const sub=$('tripSub');
  const status=$('tripStatus');
  const count=$('tripSiteCount');if(count)count.textContent=SITES.length;
  if(!SITES.length){
    grid.innerHTML='<div class="trip-empty" role="alert">Couldn\'t load the dark-sky site list. Check that data/sites.json is being served, then reload.</div>';
    if(status) status.textContent='Dark-sky site list failed to load.';
    return;
  }
  if(!USER_LOC){
    if(sub) sub.textContent='Set your location to see distances';
    grid.innerHTML='<div class="trip-empty">Set your location and AstroScope will rank dark-sky sites by darkness, tonight\'s moon and how far you have to travel.<br><br><button class="btn btn-primary" onclick="openLocationModal()">📍 Set location</button></div>';
    if(status) status.textContent='Set your location to see ranked observing sites.';
    return;
  }
  if(sub) sub.textContent=`From ${USER_LOC.name} · ${SITES.length} starter sites`;
  let list=SITES.map(enrich);
  if(state.radius!=='any') list=list.filter(x=>x.dist<=Number(state.radius));
  const by={score:(a,b)=>b.score.total-a.score.total, distance:(a,b)=>a.dist-b.dist, dark:(a,b)=>bMid(a.site)-bMid(b.site)};
  list.sort(by[state.sort]);
  grid.innerHTML=list.length?list.map(cardHTML).join(''):'<div class="trip-empty">No sites in that range. Try a larger distance.</div>';
  if(status) status.textContent=list.length?`${list.length} observing sites found.`:'No sites in that distance range.';
}

/* ---------- detail modal ---------- */
function nightRows(rows){
  return rows.length?rows.map(n=>`<div class="night-row"><span class="d">${n.label}${n.weekend?' <span class="badge badge-good">weekend</span>':''}</span><span class="m">${n.dark.toFixed(1)} h moonless · Moon ${n.moonPct}%</span></div>`).join(''):'<div class="muted" style="font-size:12.5px">No fully dark nights in this window.</div>';
}
function openSite(id){
  const s=SITES.find(x=>x.id===id); if(!s) return;
  const dist=USER_LOC?km(USER_LOC,s):null, t=tonight(s), p=scoreParts(s,dist,t);
  const nights=outlook(s,60);
  const best=[...nights].sort((a,b)=>b.quality-a.quality).slice(0,5).sort((a,b)=>a.start-b.start);
  const weekends=nights.filter(n=>n.weekend).sort((a,b)=>b.quality-a.quality).slice(0,3).sort((a,b)=>a.start-b.start);
  const horizon=Date.now()+60*864e5;
  const evs=(typeof EVENTS!=='undefined'?EVENTS:[]).filter(e=>e._date.getTime()>=Date.now()-864e5&&e._date.getTime()<=horizon).slice(0,5);
  const evHTML=evs.length?evs.map(e=>`<div class="night-row"><span class="d">${e.name}</span><span class="m">${e._date.toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span></div>`).join(''):'<div class="muted" style="font-size:12.5px">No cataloged events in the next 60 days.</div>';
  const alt=s.highAlt?'<li>High altitude: acclimatise first and expect very cold nights.</li>':'';
  $('eventModalBody').innerHTML=`
    <button class="iconbtn modal-close" onclick="closeModal('eventModal')" aria-label="Close">✕</button>
    <span class="cat" style="color:var(--accent)">Bortle ${bLabel(s)} (estimate)</span>
    <h2 style="margin-top:6px">${s.name}</h2>
    <div class="muted" style="font:400 12px/1.5 var(--mono)">${s.region}${dist!=null?' · '+Math.round(dist).toLocaleString()+' km from '+USER_LOC.name+' · '+driveText(dist):''}</div>
    <p style="font-size:14px;line-height:1.6;margin-top:12px">${s.note}</p>
    <div class="intel-metrics" style="margin-top:14px">
      <div class="intel-metric"><div class="k">Trip score</div><div class="v">${p.total}/100</div></div>
      <div class="intel-metric"><div class="k">Sky darkness</div><div class="v">${p.darkness}/100</div></div>
      <div class="intel-metric"><div class="k">Tonight</div><div class="v">${p.hours}/100</div></div>
      <div class="intel-metric"><div class="k">Distance</div><div class="v">${dist==null?'—':p.near+'/100'}</div></div>
    </div>
    <div class="muted" style="font:400 11px/1.5 var(--mono);margin-top:8px">Score = 45% sky darkness + 30% tonight's dark, moonless hours + 25% closeness. It is an estimate, not a forecast.</div>
    <h3 style="font-size:22px;margin-top:22px">Best nights, next 60 days</h3>
    ${nightRows(best)}
    <h3 style="font-size:22px;margin-top:18px">Best weekend nights</h3>
    ${nightRows(weekends)}
    <div class="muted" style="font:400 11px/1.5 var(--mono);margin-top:8px">Based on Sun and Moon position only. Check the weather forecast a few days before you go.</div>
    <h3 style="font-size:22px;margin-top:22px">Sky events coming up</h3>
    ${evHTML}
    <h3 style="font-size:22px;margin-top:22px">Pack and plan</h3>
    <ul class="trip-list">${GEAR.map(g=>`<li>${g}</li>`).join('')}${alt}</ul>
    <div class="trip-actions">
      <a class="btn btn-primary" href="${dirLink(s)}" target="_blank" rel="noopener">Directions</a>
      <a class="btn btn-ghost" href="${mapLink(s)}" target="_blank" rel="noopener">Check real light-pollution map</a>
    </div>`;
  showModal('eventModal');
}

/* ---------- wiring ---------- */
function bind(){
  const radius=$('tripRadius'), sort=$('tripSort'), grid=$('tripGrid'), guide=$('bortleGuide');
  if(radius) radius.addEventListener('change',e=>{state.radius=e.target.value;renderTrip();});
  if(sort) sort.addEventListener('change',e=>{state.sort=e.target.value;renderTrip();});
  if(guide) guide.innerHTML=BORTLE_GUIDE.map(([n,t])=>`<div class="bortle-row"><b>${n}</b><span>${t}</span></div>`).join('');
  if(grid){
    const open=e=>{const el=e.target.closest&&e.target.closest('[data-site]'); if(el) openSite(el.dataset.site);};
    grid.addEventListener('click',open);
    grid.addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); open(e); } });
  }
}
document.addEventListener('as:location',renderTrip);
document.addEventListener('as:page',e=>{ if(e.detail==='trip') renderTrip(); });
(async function init(){
  bind();
  const grid=$('tripGrid');if(grid)grid.innerHTML='<div class="trip-empty" role="status" aria-live="polite">Loading dark-sky sites…</div>';
  try{ const r=await fetch('data/sites.json',{cache:'no-store'});if(!r.ok)throw new Error('site list unavailable');SITES=(await r.json()).sites||[];if(!SITES.length)throw new Error('empty site list'); }
  catch(e){ SITES=[]; }
  renderTrip();
})();
})();
