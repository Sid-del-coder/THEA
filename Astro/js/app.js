
/* ============ STAR FIELD BACKGROUND ============ */
(function(){
  const c=document.getElementById('starcanvas'), ctx=c.getContext('2d');
  let stars=[];
  function resize(){ c.width=innerWidth; c.height=innerHeight;
    stars=Array.from({length:Math.min(400,Math.floor(innerWidth*innerHeight/4000))},()=>({
      x:Math.random()*c.width, y:Math.random()*c.height, r:Math.random()*1.3+0.2,
      p:Math.random()*Math.PI*2, s:Math.random()*0.015+0.005
    }));
  }
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function draw(t){
    ctx.clearRect(0,0,c.width,c.height);
    stars.forEach(s=>{
      const a = reduce?0.6:(0.5+0.5*Math.sin(s.p + t*s.s*0.06));
      ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,7);
      ctx.fillStyle=`rgba(230,230,230,${0.3+0.6*a})`; ctx.fill();
    });
    if(!reduce) requestAnimationFrame(draw); else requestAnimationFrame(()=>{});
  }
  addEventListener('resize',resize); resize(); requestAnimationFrame(draw);
})();

/* ============ ASTRONOMY MATH (Meeus low-precision formulas) ============ */
const RAD=Math.PI/180;
function toJulian(date){ return date.getTime()/86400000 - 0.5 + 2440588; }
function fromJulian(j){ return new Date((j+0.5-2440588)*86400000); }
function daysSinceJ2000(date){ return toJulian(date)-2451545.0; }

// Sun position (geocentric ecliptic -> equatorial), Meeus low precision
function sunCoords(d){
  const n=daysSinceJ2000(d);
  const L=(280.460+0.9856474*n)%360;
  const g=((357.528+0.9856003*n)%360)*RAD;
  const lambda=(L+1.915*Math.sin(g)+0.020*Math.sin(2*g))*RAD;
  const eps=(23.439-0.0000004*n)*RAD;
  const ra=Math.atan2(Math.cos(eps)*Math.sin(lambda),Math.cos(lambda));
  const dec=Math.asin(Math.sin(eps)*Math.sin(lambda));
  return {ra,dec,lambda,eps};
}
function moonCoords(d){
  const T=(toJulian(d)-2451545)/36525, T2=T*T, T3=T2*T, T4=T3*T;
  const deg=x=>((x%360)+360)%360;
  const L=deg(218.3164477+481267.88123421*T-0.0015786*T2+T3/538841-T4/65194000);
  const D=deg(297.8501921+445267.1114034*T-0.0018819*T2+T3/545868-T4/113065000)*RAD;
  const Ms=deg(357.5291092+35999.0502909*T-0.0001536*T2+T3/24490000)*RAD;
  const Mp=deg(134.9633964+477198.8675055*T+0.0087414*T2+T3/69699-T4/14712000)*RAD;
  const F=deg(93.2720950+483202.0175233*T-0.0036539*T2-T3/3526000+T4/863310000)*RAD;
  const E=1-0.002516*T-0.0000074*T2;
  const lon=L+6.289*Math.sin(Mp)+1.274*Math.sin(2*D-Mp)+0.658*Math.sin(2*D)+0.214*Math.sin(2*Mp)-0.186*E*Math.sin(Ms)-0.114*Math.sin(2*F)+0.059*Math.sin(2*D-2*Mp)+0.057*E*Math.sin(2*D-Ms-Mp)+0.053*Math.sin(2*D+Mp)+0.046*E*Math.sin(2*D-Ms)+0.041*E*Math.sin(Mp-Ms)-0.035*Math.sin(D)-0.031*E*Math.sin(Mp+Ms)-0.015*Math.sin(2*F-2*D)+0.011*Math.sin(2*D-4*Mp);
  const lat=5.128*Math.sin(F)+0.280*Math.sin(Mp+F)+0.277*Math.sin(Mp-F)+0.173*Math.sin(2*D-F)+0.055*Math.sin(2*D+F-Mp)+0.046*Math.sin(2*D-F-Mp)+0.033*Math.sin(2*D+F)+0.017*Math.sin(2*Mp+F)+0.009*Math.sin(2*D+Mp-F)+0.009*Math.sin(2*Mp-F)+0.008*Math.sin(2*D-Mp-F)+0.008*Math.sin(2*D+Ms-F)+0.007*Math.sin(2*D+Ms-Mp+F);
  const dist=385000.56-20905.355*Math.cos(Mp)-3699.111*Math.cos(2*D-Mp)-2955.968*Math.cos(2*D)-569.925*Math.cos(2*Mp)+48.888*E*Math.cos(Ms)-3.149*Math.cos(2*F)+246.158*Math.cos(2*D-2*Mp)-152.138*E*Math.cos(2*D-Ms-Mp)-170.733*Math.cos(2*D+Mp)-204.586*E*Math.cos(2*D-Ms)-129.620*E*Math.cos(Mp-Ms)+108.743*Math.cos(D)+104.755*E*Math.cos(Mp+Ms)+10.321*Math.cos(2*D+2*Mp);
  const lonRad=deg(lon)*RAD, latRad=lat*RAD;
  const eps=(23.439291-0.0130042*T)*RAD;
  const ra=Math.atan2(Math.sin(lonRad)*Math.cos(eps)-Math.tan(latRad)*Math.sin(eps),Math.cos(lonRad));
  const dec=Math.asin(Math.sin(latRad)*Math.cos(eps)+Math.cos(latRad)*Math.sin(eps)*Math.sin(lonRad));
  return {ra,dec,dist,lon:lonRad};
}
function siderealTime(d,lng){
  const n=daysSinceJ2000(d);
  const gmst=(280.46061837+360.98564736629*n)%360;
  return ((gmst+lng)%360+360)%360*RAD;
}
function altAz(ra,dec,d,lat,lng){
  const H=siderealTime(d,lng)-ra;
  const phi=lat*RAD;
  const alt=Math.asin(Math.sin(phi)*Math.sin(dec)+Math.cos(phi)*Math.cos(dec)*Math.cos(H));
  const az=Math.atan2(Math.sin(H),Math.cos(H)*Math.sin(phi)-Math.tan(dec)*Math.cos(phi));
  return {alt:alt/RAD, az:(az/RAD+180)%360};
}
function moonIllumFrac(d){
  const s=sunCoords(d), m=moonCoords(d);
  const phi=Math.acos(Math.sin(s.dec)*Math.sin(m.dec)+Math.cos(s.dec)*Math.cos(m.dec)*Math.cos(m.ra-s.ra));
  const incl=Math.atan2(Math.cos(s.dec)*Math.sin(s.ra-m.ra),Math.sin(s.dec)*Math.cos(m.dec)-Math.cos(s.dec)*Math.sin(m.dec)*Math.cos(s.ra-m.ra));
  const phaseAngle=Math.atan2(Math.sin(phi),incl<0? -1:1) ; // not used precisely
  const k=(1+Math.cos(Math.PI-phi))/2;
  // waxing/waning via ecliptic longitude difference
  const diff=((m.lon/RAD - (s.lambda/RAD))%360+360)%360;
  return {frac:k, waxing: diff<180, age: diff/360*29.53059};
}
function moonPhaseName(age){
  if(age<1.84566) return "New Moon";
  if(age<5.53699) return "Waxing Crescent";
  if(age<9.22831) return "First Quarter";
  if(age<12.91963) return "Waxing Gibbous";
  if(age<16.61096) return "Full Moon";
  if(age<20.30228) return "Waning Gibbous";
  if(age<23.99361) return "Last Quarter";
  if(age<27.68493) return "Waning Crescent";
  return "New Moon";
}
// rise/set/transit search by altitude crossing, generic for any body coord function
function riseSetTransit(coordFn, date, lat, lng, targetAlt){
  targetAlt = targetAlt||0;
  const base=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate(),0,0,0));
  let prevAlt=null, rise=null, set=null, best=-999, transit=null;
  for(let m=0;m<=24*60;m+=5){
    const t=new Date(base.getTime()+m*60000);
    const c=coordFn(t);
    const {alt}=altAz(c.ra,c.dec,t,lat,lng);
    if(alt>best){best=alt; transit=t;}
    if(prevAlt!==null){
      if(prevAlt<targetAlt && alt>=targetAlt && !rise) rise=t;
      if(prevAlt>=targetAlt && alt<targetAlt && !set && rise) set=t;
    }
    prevAlt=alt;
  }
  return {rise,set,transit,maxAlt:best};
}
function fmtTime(d){ if(!d) return "—"; return d.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}); }
function fmtTimeTz(d,tz){ if(!d) return "—"; try{ return d.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',timeZone:tz}); }catch(e){return fmtTime(d);} }
function fmtDate(d,tz){ try{return d.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',timeZone:tz});}catch(e){return d.toDateString();} }

// JPL approximate Keplerian elements/rates, valid 1800–2050. These are still not a full numerical ephemeris.
// JPL approximate Keplerian elements/rates, valid 1800–2050.
const PLANETS = [
  {
    name: "Mercury",
    emoji: '<img class="planet-pic" src="https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Mercury_in_true_color.jpg/120px-Mercury_in_true_color.jpg" alt="Mercury">',
    a0: 0.38709927,
    ad: 0.00000037,
    e0: 0.20563593,
    ed: 0.00001906,
    i0: 7.00497902,
    id: -0.00594749,
    L0: 252.25032350,
    Ld: 149472.67411175,
    varpi0: 77.45779628,
    vd: 0.16047689,
    node0: 48.33076593,
    nd: -0.12534081
  },
  {
    name: "Venus",
    emoji: '<img class="planet-pic" src="https://upload.wikimedia.org/wikipedia/commons/thumb/b/b2/Venus_2_Approach_Image.jpg/120px-Venus_2_Approach_Image.jpg" alt="Venus">',
    a0: 0.72333566,
    ad: 0.00000390,
    e0: 0.00677672,
    ed: -0.00004107,
    i0: 3.39467605,
    id: -0.00078890,
    L0: 181.97909950,
    Ld: 58517.81538729,
    varpi0: 131.60246718,
    vd: 0.00268329,
    node0: 76.67984255,
    nd: -0.27769418
  },
  {
    name: "Mars",
    emoji: '<img class="planet-pic" src="https://upload.wikimedia.org/wikipedia/commons/thumb/0/02/OSIRIS_Mars_true_color.jpg/120px-OSIRIS_Mars_true_color.jpg" alt="Mars">',
    a0: 1.52371034,
    ad: 0.00001847,
    e0: 0.09339410,
    ed: 0.00007882,
    i0: 1.84969142,
    id: -0.00813131,
    L0: -4.55343205,
    Ld: 19140.30268499,
    varpi0: -23.94362959,
    vd: 0.44441088,
    node0: 49.55953891,
    nd: -0.29257343
  },
  {
    name: "Jupiter",
    emoji: '<img class="planet-pic" src="https://upload.wikimedia.org/wikipedia/commons/thumb/e/e2/Jupiter.jpg/120px-Jupiter.jpg" alt="Jupiter">',
    a0: 5.20288700,
    ad: -0.00011607,
    e0: 0.04838624,
    ed: -0.00013253,
    i0: 1.30439695,
    id: -0.00183714,
    L0: 34.39644051,
    Ld: 3034.74612775,
    varpi0: 14.72847983,
    vd: 0.21252668,
    node0: 100.47390909,
    nd: 0.20469106
  },
  {
    name: "Saturn",
    emoji: '<img class="planet-pic" src="https://upload.wikimedia.org/wikipedia/commons/thumb/c/c7/Saturn_during_Equinox.jpg/120px-Saturn_during_Equinox.jpg" style="border-radius:0; width:1.8em; height:auto; box-shadow:none;" alt="Saturn">',
    a0: 9.53667594,
    ad: -0.00125060,
    e0: 0.05386179,
    ed: -0.00050991,
    i0: 2.48599187,
    id: 0.00193609,
    L0: 49.95424423,
    Ld: 1222.49362201,
    varpi0: 92.59887831,
    vd: -0.41897216,
    node0: 113.66242448,
    nd: -0.28867794
  },
  {
    name: "Uranus",
    emoji: '<img class="planet-pic" src="https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/Uranus2.jpg/120px-Uranus2.jpg" alt="Uranus">',
    a0: 19.18916464,
    ad: -0.00196176,
    e0: 0.04725744,
    ed: -0.00004397,
    i0: 0.77263783,
    id: -0.00242939,
    L0: 313.23810451,
    Ld: 428.48202785,
    varpi0: 170.95427630,
    vd: 0.40805281,
    node0: 74.01692503,
    nd: 0.04240589
  },
  {
    name: "Neptune",
    emoji: '<img class="planet-pic" src="https://upload.wikimedia.org/wikipedia/commons/thumb/0/06/Neptune.jpg/120px-Neptune.jpg" alt="Neptune">',
    a0: 30.06992276,
    ad: 0.00026291,
    e0: 0.00860619,
    ed: 0.00005105,
    i0: 1.77004347,
    id: 0.00035372,
    L0: -55.12002969,
    Ld: 218.45945325,
    varpi0: 44.96476227,
    vd: -0.32241464,
    node0: 131.78422574,
    nd: -0.00508664
  }
];
 /* ============ HELIOCENTRIC ORBIT MATH ============ */
function heliocentric(o, d){
  const T = (toJulian(d) - 2451545) / 36525;
  const rad = RAD;
  const wrap = x => ((x % 360) + 360) % 360;

  const a = o.a0 + (o.ad || 0) * T;
  const e = o.e0 + (o.ed || 0) * T;
  const I = (o.i0 + (o.id || 0) * T) * rad;
  const L = o.L0 + o.Ld * T;
  const varpi = o.varpi0 + (o.vd || 0) * T;
  const nodeDeg = o.node0 + (o.nd || 0) * T;

  const node = nodeDeg * rad;
  const omega = (varpi - nodeDeg) * rad;
  const M = wrap(L - varpi) * rad;

  let E = M + e * Math.sin(M);
  for(let k = 0; k < 8; k++){
    const delta = (M - (E - e * Math.sin(E))) / (1 - e * Math.cos(E));
    E += delta;
    if(Math.abs(delta) < 1e-12) break;
  }

  const xp = a * (Math.cos(E) - e);
  const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const co = Math.cos(omega), so = Math.sin(omega);
  const cn = Math.cos(node),  sn = Math.sin(node);
  const ci = Math.cos(I),     si = Math.sin(I);

  return {
    x: (co * cn - so * sn * ci) * xp + (-so * cn - co * sn * ci) * yp,
    y: (co * sn + so * cn * ci) * xp + (-so * sn + co * sn * ci) * yp,
    z: so * si * xp + co * si * yp
  };
}

function planetGeoRaDec(p, d){
  const T = (toJulian(d) - 2451545) / 36525, rad = RAD;
  const earth = heliocentric({
    a0: 1.00000261, ad: 0.00000562, e0: 0.01671123, ed: -0.00004392,
    i0: -0.00001531, id: -0.01294668, L0: 100.46457166, Ld: 35999.37244981,
    varpi0: 102.93768193, vd: 0.32327364, node0: 0, nd: 0
  }, d);

  const body = heliocentric(p, d);
  const x = body.x - earth.x, y = body.y - earth.y, z = body.z - earth.z;
  const eps = 23.43928 * rad;
  const xeq = x, yeq = y * Math.cos(eps) - z * Math.sin(eps), zeq = y * Math.sin(eps) + z * Math.cos(eps);
  let ra = Math.atan2(yeq, xeq), dec = Math.atan2(zeq, Math.hypot(xeq, yeq));

  const zeta = (2306.2181 * T + 0.30188 * T * T + 0.017998 * T * T * T) / 3600 * rad;
  const zAngle = (2306.2181 * T + 1.09468 * T * T + 0.018203 * T * T * T) / 3600 * rad;
  const theta = (2004.3109 * T - 0.42665 * T * T - 0.041833 * T * T * T) / 3600 * rad;
  const A = Math.cos(dec) * Math.sin(ra + zeta);
  const B = Math.cos(theta) * Math.cos(dec) * Math.cos(ra + zeta) - Math.sin(theta) * Math.sin(dec);
  const C = Math.sin(theta) * Math.cos(dec) * Math.cos(ra + zeta) + Math.cos(theta) * Math.sin(dec);
  ra = ((Math.atan2(A, B) + zAngle) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
  dec = Math.asin(Math.max(-1, Math.min(1, C)));
  return { ra, dec };
}

/* ============ LOCATION ============ */
const CITIES=[
 {name:"Pune, India", lat:18.5204, lng:73.8567, tz:"Asia/Kolkata"},
 {name:"Mumbai, India", lat:19.0760, lng:72.8777, tz:"Asia/Kolkata"},
 {name:"Delhi, India", lat:28.6139, lng:77.2090, tz:"Asia/Kolkata"},
 {name:"Bengaluru, India", lat:12.9716, lng:77.5946, tz:"Asia/Kolkata"},
 {name:"Hyderabad, India", lat:17.3850, lng:78.4867, tz:"Asia/Kolkata"},
 {name:"Chennai, India", lat:13.0827, lng:80.2707, tz:"Asia/Kolkata"},
 {name:"Kolkata, India", lat:22.5726, lng:88.3639, tz:"Asia/Kolkata"},
 {name:"Ahmedabad, India", lat:23.0225, lng:72.5714, tz:"Asia/Kolkata"},
 {name:"Jaipur, India", lat:26.9124, lng:75.7873, tz:"Asia/Kolkata"},
 {name:"Nashik, India", lat:19.9975, lng:73.7898, tz:"Asia/Kolkata"},
 {name:"New York, USA", lat:40.7128, lng:-74.0060, tz:"America/New_York"},
 {name:"Los Angeles, USA", lat:34.0522, lng:-118.2437, tz:"America/Los_Angeles"},
 {name:"London, UK", lat:51.5074, lng:-0.1278, tz:"Europe/London"},
 {name:"Tokyo, Japan", lat:35.6762, lng:139.6503, tz:"Asia/Tokyo"},
 {name:"Sydney, Australia", lat:-33.8688, lng:151.2093, tz:"Australia/Sydney"},
 {name:"Singapore", lat:1.3521, lng:103.8198, tz:"Asia/Singapore"},
 {name:"Dubai, UAE", lat:25.2048, lng:55.2708, tz:"Asia/Dubai"},
 {name:"Cape Town, South Africa", lat:-33.9249, lng:18.4241, tz:"Africa/Johannesburg"},
];
let USER_LOC = JSON.parse(localStorage.getItem('as_loc')||'null');

let modalOpener=null;
function showModal(id){const modal=document.getElementById(id);if(!modal)return;if(!document.querySelector('.modal-bg:not(.hidden)'))modalOpener=document.activeElement;modal.classList.remove('hidden');requestAnimationFrame(()=>modal.querySelector('.modal-close, input, button')?.focus());}
function openLocationModal(){ showModal('locModal'); renderCityResults(''); }
function closeModal(id){const modal=document.getElementById(id);if(!modal)return;modal.classList.add('hidden');if(modalOpener?.focus)modalOpener.focus();modalOpener=null;}
document.addEventListener('keydown',e=>{const modal=document.querySelector('.modal-bg:not(.hidden)');if(!modal){if(e.key==='Escape')closePlanetPanel();return;}if(e.key==='Escape'){closeModal(modal.id);return;}if(e.key!=='Tab')return;const items=[...modal.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),a[href],[tabindex="0"]')].filter(el=>el.offsetParent!==null);if(!items.length)return;if(e.shiftKey&&document.activeElement===items[0]){e.preventDefault();items.at(-1).focus();}else if(!e.shiftKey&&document.activeElement===items.at(-1)){e.preventDefault();items[0].focus();}});
document.querySelectorAll('.modal-bg').forEach(modal=>modal.addEventListener('click',e=>{if(e.target===modal)closeModal(modal.id);}));
let mapboxSearchTimer = null;
function tzFromLng(lng){
  let off = Math.round(lng/15);
  off = Math.max(-12, Math.min(14, off));
  if(off===0) return 'Etc/UTC';
  return off>0 ? `Etc/GMT-${off}` : `Etc/GMT+${Math.abs(off)}`;
}
async function mapboxSearch(q){
  try{
    const url = `/api/mapbox?q=${encodeURIComponent(q)}`;
    const res = await fetch(url);
    if(!res.ok) throw new Error('mapbox geocoding fetch failed');
    const data = await res.json();
    return (data.features||[]).map(f=>({ name:f.place_name, lat:f.center[1], lng:f.center[0], tz:f.tz || tzFromLng(f.center[0]) }));
  }catch(e){ return []; }
}
function renderCityResults(q){
  q=(q||'').toLowerCase();
  const list=CITIES.filter(c=>c.name.toLowerCase().includes(q));
  document.getElementById('cityResults').innerHTML = list.map(c=>
    `<button type="button" class="cityopt" onclick='setLocation(${JSON.stringify(c)})'>📍 ${c.name}</button>`).join('') || '<div class="muted" style="padding:8px;">No matches</div>';
  clearTimeout(mapboxSearchTimer);
  if(q.trim().length<2) return;
  mapboxSearchTimer = setTimeout(async ()=>{
    const results = await mapboxSearch(q);
    if(!results.length) return;
    const container = document.getElementById('cityResults');
    if(!container) return;
    const extra = results.map(c=>
      `<button type="button" class="cityopt" onclick='setLocation(${JSON.stringify(c)})'>🌍 ${c.name}</button>`).join('');
    container.innerHTML += `<div class="muted" style="font-size:11px; text-transform:uppercase; letter-spacing:.5px; margin:10px 0 4px;">More results</div>${extra}`;
  }, 350);
}
function useMyLocation(){
  if(!navigator.geolocation){ alert("Geolocation not supported — please choose a city."); return; }
  navigator.geolocation.getCurrentPosition(pos=>{
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setLocation({name:"My Location", lat:pos.coords.latitude, lng:pos.coords.longitude, tz});
  }, ()=> alert("Couldn't get your location — please choose a city instead."));
}
function setLocation(loc){
  USER_LOC=loc; localStorage.setItem('as_loc', JSON.stringify(loc));
  document.getElementById('watchingFrom').textContent = `📍 Watching from ${loc.name}`;
  document.getElementById('locPill').textContent = `📍 ${loc.name}`;
  closeModal('locModal');
  renderAll();
  document.dispatchEvent(new CustomEvent('as:location',{detail:loc}));
}
if(USER_LOC){ } // will render on load

/* ============ EVENTS DATABASE (real dates) ============ */
let EVENTS = [];
let CATEGORIES = [];
let EVENTS_LOAD_STATE = 'loading';

let FAVORITES = JSON.parse(localStorage.getItem('as_favs')||'[]');
function toggleFav(id){
  if(FAVORITES.includes(id)) FAVORITES=FAVORITES.filter(x=>x!==id); else FAVORITES.push(id);
  localStorage.setItem('as_favs', JSON.stringify(FAVORITES));
  renderEvents(); renderFavorites(); renderNextEvent();
  if(typeof renderReminderList==='function') renderReminderList();
}

/* ============ RENDER: TONIGHT ============ */
async function renderAPOD(){
  const body = document.getElementById('apodBody');
  if(!body) return;
  body.textContent = 'Loading…';
  try{
    const res = await fetch('/api/apod');
    if(!res.ok) throw new Error('apod fetch failed');
    const data = await res.json();
    const mediaHtml = data.media_type==='image'
      ? `<img src="${data.url}" alt="${(data.title||'').replace(/"/g,'')}" style="width:100%; border-radius:12px; margin-bottom:12px; display:block;">`
      : (data.media_type==='video' ? `<div style="margin-bottom:12px;"><a href="${data.url}" target="_blank" rel="noopener" class="pill">▶ Watch today's video</a></div>` : '');
    body.innerHTML = `
      ${mediaHtml}
      <div style="font-weight:700; font-size:15px; color:var(--ink); margin-bottom:4px;">${data.title||''}</div>
      <div class="muted" style="font-size:11.5px; margin-bottom:8px;">${data.date||''}${data.copyright?' · © '+data.copyright.trim():''}</div>
      <div style="font-size:13px; line-height:1.6;">${data.explanation||''}</div>
    `;
  }catch(e){
    body.textContent = 'NASA picture of the day unavailable.';
  }
}
async function renderSpaceWeather(){
  const body = document.getElementById('spaceWeatherBody');
  if(!body) return;
  body.textContent = 'Loading space weather…';
  try{
    const params=USER_LOC?`?lat=${encodeURIComponent(USER_LOC.lat)}&lon=${encodeURIComponent(USER_LOC.lng)}`:'';
    const res=await fetch(`/api/space-weather${params}`,{cache:'no-store'});
    if(!res.ok) throw new Error('NOAA space weather unavailable');
    const data=await res.json();
    const k=data.kp?.value;
    const level=data.kp?.stormLevel||'Unavailable';
    const chance=data.localAuroraProbability;
    const auroraChance=chance==null?'Location unavailable':`${chance}% model probability`;
    const updated=data.kp?.time?new Date(data.kp.time).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'}):'—';
    body.innerHTML = `
      <div class="condrow" style="margin-bottom:0;">
        <div class="card c"><div class="l">Planetary Kp · ${k==null?'—':k}</div><div class="v" style="font-size:13px;">${level}</div></div>
        <div class="card c"><div class="l">Aurora model near ${USER_LOC?.name||'your location'}</div><div class="v" style="font-size:13px;">${auroraChance}</div></div>
        <div class="card c"><div class="l">Kp updated</div><div class="v" style="font-size:13px;">${updated}</div></div>
      </div>
      <div class="muted" style="font-size:11px;margin-top:9px;line-height:1.5">NOAA SWPC global geomagnetic index and OVATION aurora model. Model probability is not a sighting forecast; darkness, clouds, horizon, and local light pollution matter.</div>
    `;
  }catch(e){
    body.textContent = 'NOAA global space-weather data is temporarily unavailable. Other sky and event features are unaffected.';
  }
}
function renderTonight(){
  if(!USER_LOC) return;
  const now=new Date();
  const {lat,lng,tz}=USER_LOC;
  document.getElementById('tonightDate').textContent = fmtDate(now,tz)+' · '+ (USER_LOC.name);

  const sunRS = riseSetTransit(sunCoords, now, lat, lng, -0.83);
  const twilightRS = riseSetTransit(sunCoords, now, lat, lng, -18);
  const moonRS = riseSetTransit(moonCoords, now, lat, lng, 0);
  const moonI = moonIllumFrac(now);

  document.getElementById('condRow').innerHTML = [
    ['Sunrise', fmtTimeTz(sunRS.rise,tz)],
    ['Sunset', fmtTimeTz(sunRS.set,tz)],
    ['Astro Twilight Ends', fmtTimeTz(twilightRS.set,tz)],
    ['Moonrise', fmtTimeTz(moonRS.rise,tz)],
    ['Moonset', fmtTimeTz(moonRS.set,tz)],
    ['Moon Illum.', Math.round(moonI.frac*100)+'%'],
  ].map(([l,v])=>`<div class="card c"><div class="l">${l}</div><div class="v">${v}</div></div>`).join('');
let cards=`<div class="card obj-card"><div class="emoji"><img class="planet-pic" src="https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/FullMoon2010.jpg/120px-FullMoon2010.jpg" alt="Moon"></div><div class="name">Moon</div>
  <div class="stat">${moonPhaseName(moonI.age)} · ${Math.round(moonI.frac*100)}% lit</div>
  <div class="stat">Rise ${fmtTimeTz(moonRS.rise,tz)} · Set ${fmtTimeTz(moonRS.set,tz)}</div></div>`;

  PLANETS.forEach(p=>{
    const rs = riseSetTransit(t=>planetGeoRaDec(p,t), now, lat, lng, 0);
    const visible = rs.maxAlt>10;
    cards += `<div class="card obj-card"><div class="emoji">${p.emoji}</div><div class="name">${p.name}</div>
      <div class="stat"><span class="status-dot" style="background:${visible?'var(--good)':'var(--ink-dim2)'}"></span>${visible?'Visible':'Below horizon'}</div>
      <div class="stat">${fmtTimeTz(rs.rise,tz)} → ${fmtTimeTz(rs.set,tz)}</div>
      <div class="stat">Peak altitude ${Math.round(rs.maxAlt)}°</div></div>`;
  });
cards += `<div class="card obj-card"><div class="emoji" style="display:inline-flex; align-items:center; justify-content:center; width:34px; height:34px; background:radial-gradient(circle at 70% 30%, #2a1b38, #0a0515); border-radius:50%; box-shadow:0 0 8px rgba(255, 140, 50, 0.3);"><svg viewBox="0 0 32 32" width="22" height="22" style="transform:rotate(-15deg); filter:drop-shadow(0 0 3px #ffaa44);"><defs><linearGradient id="meteorTail" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stop-color="#ff4500" stop-opacity="0"/><stop offset="50%" stop-color="#ff8c00" stop-opacity="0.6"/><stop offset="90%" stop-color="#ffe066" stop-opacity="0.9"/><stop offset="100%" stop-color="#ffffff" stop-opacity="1"/></linearGradient></defs><path d="M4 28 C 12 20, 18 14, 26 6" stroke="url(#meteorTail)" stroke-width="2.5" stroke-linecap="round"/><circle cx="26" cy="6" r="3.2" fill="#ffffff" style="filter:drop-shadow(0 0 4px #ffaa33);"/></svg></div><div class="name">Meteor Activity</div>
    <div class="stat">${meteorActivityTonight()}</div></div>`;
  document.getElementById('objGrid').innerHTML = cards;
}
function meteorActivityTonight(){
  const now=new Date();
  const showers=EVENTS.filter(e=>e.category==='Meteor Shower');
  let closest=null, minDiff=999;
  showers.forEach(e=>{ const diff=Math.abs((e._date-now)/86400000); if(diff<minDiff){minDiff=diff; closest=e;} });
  if(minDiff<3) return `Elevated — ${closest.subtype} peak nearby`;
  if(minDiff<10) return `Moderate — ${closest.subtype} approaching`;
  return 'Low — background rate only';
}

/* ============ RENDER: NEXT EVENT ============ */
function renderNextEvent(){
  const now=new Date();
  const upcoming = EVENTS.filter(e=>e._date>now).sort((a,b)=>a._date-b._date)[0];
  if(!upcoming){ document.getElementById('nextEventCard').innerHTML='<div class="muted">No upcoming events in database.</div>'; return; }
  const diff = upcoming._date-now;
  const days=Math.floor(diff/86400000), hours=Math.floor((diff%86400000)/3600000), mins=Math.floor((diff%3600000)/60000);
  const tz = USER_LOC? USER_LOC.tz : undefined;
  document.getElementById('nextEventCard').innerHTML = `
    <div class="thumb">${categoryEmoji(upcoming.category)}</div>
    <div style="flex:1; min-width:220px;">
      <div class="muted" style="font-size:11px; text-transform:uppercase; letter-spacing:.5px;">Next Event ${USER_LOC?'Visible From Your Location':''}</div>
      <h3 style="font-size:20px; margin-top:4px;">${upcoming.name}</h3>
      <div class="muted" style="font-size:13.5px; margin-top:2px;">${fmtDate(upcoming._date,tz)} · ${USER_LOC?USER_LOC.name:'Set your location'}</div>
      <div class="countdown">
        <div class="c"><div class="n">${days}</div><div class="u">days</div></div>
        <div class="c"><div class="n">${hours}</div><div class="u">hrs</div></div>
        <div class="c"><div class="n">${mins}</div><div class="u">min</div></div>
      </div>
    </div>
    <button class="btn btn-primary" onclick="openEvent('${upcoming.id}')">View Observation Guide</button>
  `;
}
function categoryEmoji(cat){
  const imgStyle = 'width:1.25em; height:1.25em; object-fit:cover; border-radius:50%; vertical-align:-0.22em; display:inline-block;';
  
  const map = {
    'Eclipse': `<img src="https://images-assets.nasa.gov/image/GSFC_20171208_Archive_e000880/GSFC_20171208_Archive_e000880~thumb.jpg" alt="Eclipse" style="${imgStyle} box-shadow:0 0 4px rgba(255,255,255,0.4);" referrerpolicy="no-referrer">`,
    
    // Official NASA photograph of a Perseid meteor streak
    'Meteor Shower': `<img src="https://images-assets.nasa.gov/image/PIA23348/PIA23348~thumb.jpg" alt="Meteor Shower" style="width:1.25em; height:1.25em; object-fit:cover; border-radius:4px; vertical-align:-0.22em; display:inline-block; box-shadow:0 0 4px rgba(255,140,50,0.5);" referrerpolicy="no-referrer">`,
    
    'Seasonal': `<img src="https://images-assets.nasa.gov/image/GSFC_20171208_Archive_e001435/GSFC_20171208_Archive_e001435~thumb.jpg" alt="Seasonal Sun" style="${imgStyle} box-shadow:0 0 5px rgba(255,175,45,0.6);" referrerpolicy="no-referrer">`,
    
    'Planet': `<img src="https://images-assets.nasa.gov/image/PIA02873/PIA02873~thumb.jpg" alt="Planet" style="${imgStyle} box-shadow:0 0 4px rgba(255,255,255,0.25);" referrerpolicy="no-referrer">`,
    
    'Moon': `<img src="https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/FullMoon2010.jpg/120px-FullMoon2010.jpg" alt="Moon" style="${imgStyle} box-shadow:0 0 4px rgba(255,255,255,0.3);" referrerpolicy="no-referrer">`
  };

  const defaultSparkle = `<img src="https://images-assets.nasa.gov/image/hubble-captures-a-celestial-firework-display_28038753232_o/hubble-captures-a-celestial-firework-display_28038753232_o~thumb.jpg" alt="Event" style="${imgStyle}" referrerpolicy="no-referrer">`;

  return map[cat] || defaultSparkle;
}
/* ============ RENDER: EVENTS GRID ============ */
function renderEvents(){
  const grid=document.getElementById('evGrid');
  if(EVENTS_LOAD_STATE==='loading'){grid.innerHTML='<div class="muted empty-state" role="status" aria-live="polite">Loading astronomy events…</div>';return;}
  if(EVENTS_LOAD_STATE==='error'){grid.innerHTML='<div class="muted empty-state" role="alert">The event catalog could not be loaded. Check your connection and reload the page.</div>';return;}
  const cat=document.getElementById('fCategory').value;
  const vis=document.getElementById('fVisibility').value;
  const range=parseInt(document.getElementById('fRange').value);
  const now=new Date();
  let list=EVENTS.filter(e=> e._date>now && (e._date-now)/86400000<=range);
  if(cat) list=list.filter(e=>e.category===cat);
  if(vis==='visible') list=list.filter(e=>eventVisibility(e).status==='visible');
  grid.innerHTML = list.length? list.map(e=>eventCardHTML(e)).join('') : '<div class="muted empty-state" role="status">No cataloged events match these filters. Try another date range or category.</div>';
}
function eventVisibility(e){
  if(e.category!=='Eclipse') return e.worldwide
    ? {status:'visible',label:'🌐 Broadly observable'}
    : {status:'unknown',label:'📍 Regional visibility varies'};
  const solar=(e.subtype||'').toLowerCase().includes('solar');
  if(!USER_LOC) return {status:'unknown',label:solar?'📍 Regional path — location needed':'📍 Location needed'};
  const peak=new Date(e.peak||`${e.date}T00:00:00Z`);
  const body=solar?sunCoords(peak):moonCoords(peak);
  const alt=altAz(body.ra,body.dec,peak,USER_LOC.lat,USER_LOC.lng).alt;
  // Altitude at maximum is only a necessary condition. The catalog has no local contact/path data.
  if(alt<=0) return {status:'not-visible',label:'Below horizon at catalog peak'};
  if(solar) return {status:'unknown',label:'Sun up at peak · eclipse path unverified'};
  return {status:'unknown',label:'Moon up at peak · eclipse visibility unverified'};
}
function renderFavorites(){
  const list=EVENTS.filter(e=>FAVORITES.includes(e.id));
  document.getElementById('favGrid').innerHTML = list.length? list.map(e=>eventCardHTML(e)).join('') : '<div class="muted" style="padding:20px;">No saved events yet — tap ☆ on any event to save it here.</div>';
}

/* ============ TIMELINE ============ */
/* ============ CALENDAR ============ */
let calCursor = new Date();
function calShift(dir){ calCursor.setMonth(calCursor.getMonth()+dir); renderCalendar(); }
function renderCalendar(){
  const y=calCursor.getFullYear(), m=calCursor.getMonth();
  document.getElementById('calLabel').textContent = calCursor.toLocaleDateString('en-US',{month:'long',year:'numeric'});
  const first=new Date(y,m,1);
  const startDay=(first.getDay()+6)%7; // Monday first
  const daysInMonth=new Date(y,m+1,0).getDate();
  const evByDay={};
  EVENTS.forEach(e=>{ if(e._date.getFullYear()===y && e._date.getMonth()===m) (evByDay[e._date.getDate()]??=[]).push(e); });
  let html='<div style="display:grid; grid-template-columns:repeat(7,1fr); gap:6px; font-size:11px; color:var(--ink-dim2); text-transform:uppercase; margin-bottom:8px;">'+
    ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d=>`<div style="text-align:center;">${d}</div>`).join('')+'</div>';
  html+='<div style="display:grid; grid-template-columns:repeat(7,1fr); gap:6px;">';
  for(let i=0;i<startDay;i++) html+='<div></div>';
  for(let d=1;d<=daysInMonth;d++){
    const dayEvents=evByDay[d]||[];
    html+=`<div class="card" style="min-height:64px; padding:6px; font-size:12px; ${dayEvents.length?'border-color:var(--accent);':''}">
      <div class="muted">${d}</div>
      ${dayEvents.map(ev=>`<button class="calendar-event" onclick="openEvent('${ev.id}')" aria-label="Open ${ev.name}" style="display:block;border:0;background:none;text-align:left;font:400 10.5px/1.3 var(--sans);color:var(--cyan);margin-top:4px;cursor:pointer;">${categoryEmoji(ev.category)} ${ev.name.length>16?ev.subtype||ev.name.slice(0,14)+'…':ev.name}</button>`).join('')}
    </div>`;
  }
  html+='</div>';
  document.getElementById('calGrid').innerHTML=html;
}

/* ============ MOON MODULE ============ */
function getMoonPhotoByAge(age) {
  if (age < 1.84 || age >= 27.69) {
    // New Moon
    return 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b1/Moon_symbol_decrescent.svg/240px-Moon_symbol_decrescent.svg.png';
  } else if (age < 5.53) {
    // Waxing Crescent
    return 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/Waxing_crescent_moon_2013-11-06.jpg/240px-Waxing_crescent_moon_2013-11-06.jpg';
  } else if (age < 9.23) {
    // First Quarter
    return 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d2/First_quarter_moon_2013-11-10.jpg/240px-First_quarter_moon_2013-11-10.jpg';
  } else if (age < 12.92) {
    // Waxing Gibbous
    return 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/Waxing_gibbous_moon_2013-11-14.jpg/240px-Waxing_gibbous_moon_2013-11-14.jpg';
  } else if (age < 16.61) {
    // Full Moon
    return 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/FullMoon2010.jpg/240px-FullMoon2010.jpg';
  } else if (age < 20.30) {
    // Waning Gibbous
    return 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Waning_gibbous_moon_2013-11-20.jpg/240px-Waning_gibbous_moon_2013-11-20.jpg';
  } else if (age < 23.99) {
    // Last Quarter
    return 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Third_quarter_moon_2013-11-25.jpg/240px-Third_quarter_moon_2013-11-25.jpg';
  } else {
    // Waning Crescent
    return 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Waning_crescent_moon_2013-11-29.jpg/240px-Waning_crescent_moon_2013-11-29.jpg';
  }
}
function renderMoon(){
  try {
    const now = new Date();
    const m = moonIllumFrac(now);
    const md = moonCoords(now);

    const subEl = document.getElementById('moonSub');
    if (subEl) subEl.textContent = USER_LOC ? ('As seen from ' + USER_LOC.name) : 'Set your location for rise/set times';

    const phaseEl = document.getElementById('moonPhaseName');
    if (phaseEl) phaseEl.textContent = moonPhaseName(m.age);

    const illumEl = document.getElementById('moonIllum');
    if (illumEl) illumEl.textContent = Math.round(m.frac * 100) + '%';

    const ageEl = document.getElementById('moonAge');
    if (ageEl) ageEl.textContent = m.age.toFixed(1) + ' days';

    const distEl = document.getElementById('moonDist');
    if (distEl) distEl.textContent = Math.round(md.dist).toLocaleString() + ' km';

    // Scan next full/new moon
    let nf = null, nn = null;
    for(let d = 1; d < 40; d++){
      const t = new Date(now.getTime() + d * 86400000);
      const mi = moonIllumFrac(t);
      const name = moonPhaseName(mi.age);
      if(!nf && name === 'Full Moon') nf = t;
      if(!nn && name === 'New Moon') nn = t;
      if(nf && nn) break;
    }

    const nextFullEl = document.getElementById('nextFull');
    if (nextFullEl) nextFullEl.textContent = nf ? nf.toLocaleDateString('en-US', {month:'long', day:'numeric'}) : '—';

    const nextNewEl = document.getElementById('nextNew');
    if (nextNewEl) nextNewEl.textContent = nn ? nn.toLocaleDateString('en-US', {month:'long', day:'numeric'}) : '—';

    // Realistic Photographic Lunar Disc
    const visEl = document.getElementById('moonVis');
    if (visEl) {
      const R = 50;
      const k = m.frac; // e.g. 0.76 for 76% illuminated
      const waxing = m.waxing;

      // Semi-minor axis of the elliptical terminator
      const b = Math.abs(R * (2 * k - 1));

      // Correct astronomical shadow sweeps:
      // Dark outer limb: left half (0) when waxing, right half (1) when waning
      const darkOuterSweep = waxing ? 0 : 1;
      
      // Terminator arc:
      // When k >= 0.5 (gibbous), terminator curves towards the shadow side
      // When k < 0.5 (crescent), terminator curves into the lit side
      const terminatorSweep = (k >= 0.5) ? (waxing ? 1 : 0) : (waxing ? 0 : 1);

      let shadowPath = '';
      if (k <= 0.015) {
        // New Moon: 100% shadow
        shadowPath = `M 50,0 A ${R},${R} 0 1,1 49.99,0 Z`;
      } else if (k < 0.985) {
        // Exact shadow sliver/crescent path
        shadowPath = `M 50,0 A ${R},${R} 0 0,${darkOuterSweep} 50,100 A ${b},${R} 0 0,${terminatorSweep} 50,0 Z`;
      }

      // Reliable NASA open-access Galileo photographic lunar texture
      const moonPhoto = 'https://images-assets.nasa.gov/image/PIA00405/PIA00405~medium.jpg';

      visEl.innerHTML = `
        <div style="position:relative; width:130px; height:130px; margin:0 auto; border-radius:50%; overflow:hidden; background:#000; box-shadow:0 0 24px rgba(180, 210, 255, 0.2);">
          
          <!-- NASA High-Res Photographic Moon Disc -->
          <img src="${moonPhoto}" 
               alt="" 
               referrerpolicy="no-referrer"
               style="position:absolute; inset:0; width:100%; height:100%; object-fit:cover; display:block; filter:contrast(1.12) brightness(1.04);">

          <!-- Real-Time Astronomical Shadow Overlay -->
          <svg viewBox="0 0 100 100" style="position:absolute; inset:0; width:100%; height:100%; pointer-events:none;">
            ${shadowPath ? `<path d="${shadowPath}" fill="rgba(6, 8, 14, 0.92)" />` : ''}
          </svg>

          <!-- 3D Spherical Rim Light & Depth -->
          <div style="position:absolute; inset:0; border-radius:50%; box-shadow:inset -4px -4px 10px rgba(0,0,0,0.85), inset 1px 1px 3px rgba(255,255,255,0.3); pointer-events:none;"></div>
        </div>`;
    }
  } catch(err) {
    console.error("renderMoon error:", err);
  }
}
async function renderMoonImage(){
  const body = document.getElementById('moonRenderBody');
  if(!body) return;
  if(!USER_LOC){ body.textContent = "Select a location to render tonight's Moon."; return; }
  body.textContent = 'Loading render…';
  try{
    const dateStr = new Date().toISOString().slice(0,10);
    const res = await fetch('/api/moon-phase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ latitude: USER_LOC.lat, longitude: USER_LOC.lng, date: dateStr })
    });
    if(!res.ok) throw new Error('astronomyapi fetch failed');
    const data = await res.json();
    const url = data?.data?.imageUrl;
    if(!url) throw new Error('no image url returned');
    body.innerHTML = `<img src="${url}" alt="Rendered Moon phase" style="max-width:220px; width:100%; border-radius:12px; display:block; margin:0 auto;">`;
  }catch(e){
    body.textContent = 'Live render unavailable.';
  }
}

/* ============ LEARN ============ */
const LEARN_TOPICS=[
 {t:'Why do eclipses happen?', d:'The Sun, Earth and Moon must align near the Moon\'s orbital nodes — otherwise the Moon\'s shadow misses Earth (or vice versa) most months.'},
 {t:'What causes meteor showers?', d:'Earth passes through a stream of dust left by a comet\'s orbit; the debris burns up in our atmosphere as meteors.'},
 {t:'What is a planetary conjunction?', d:'Two planets appear close together in our sky due to perspective — they are usually still hundreds of millions of km apart in reality.'},
 {t:'Why does the Moon have phases?', d:'As the Moon orbits Earth every 29.5 days, we see varying amounts of its sunlit half, from New Moon to Full Moon and back.'},
 {t:'What is a supermoon?', d:'A Full Moon that coincides with the Moon\'s closest approach to Earth (perigee), appearing slightly larger and brighter.'},
 {t:'Astronomical vs actual visibility', d:'An object can be mathematically above the horizon yet invisible due to clouds, haze, light pollution or obstructions.'},
];
document.getElementById('learnGrid').innerHTML = LEARN_TOPICS.map(x=>`<div class="card" style="padding:18px;"><h3 style="font-size:15px;">${x.t}</h3><p class="muted" style="font-size:13px; margin-top:6px; line-height:1.5;">${x.d}</p></div>`).join('');

/* ============ SEARCH ============ */
function openSearch(){ showModal('searchModal'); document.getElementById('globalSearch').value=''; renderSearch(''); setTimeout(()=>document.getElementById('globalSearch').focus(),50); }
function renderSearch(q){
  q=(q||'').toLowerCase().trim();
  let results;
  if(!q) results=EVENTS.filter(e=>e._date>new Date()).slice(0,6);
  else if(q.includes('eclipse')) results=EVENTS.filter(e=>e.category==='Eclipse');
  else if(q.includes('meteor')||q.includes('shower')) results=EVENTS.filter(e=>e.category==='Meteor Shower');
  else if(q.includes('full moon')) results=EVENTS.filter(e=>false); // handled specially below
  else if(q.includes('tonight')) results=[];
  else results=EVENTS.filter(e=> e.name.toLowerCase().includes(q) || (e.subtype||'').toLowerCase().includes(q) || e.category.toLowerCase().includes(q));
  if(q.includes('next') && results.length){ results=[results.filter(e=>e._date>new Date()).sort((a,b)=>a._date-b._date)[0]].filter(Boolean); }
  document.getElementById('searchResults').innerHTML = results.length? results.map(e=>`
    <button type="button" class="cityopt" onclick="closeModal('searchModal'); openEvent('${e.id}')">
      <b>${e.name}</b> <span class="muted" style="font-size:12px;">— ${e._date.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</span>
    </button>`).join('') : '<div class="muted" style="padding:10px;">No matches. Try "eclipse", "meteor shower", or "next event".</div>';
}

/* ============ INIT ============ */
function scrollToId(id){ document.getElementById(id).scrollIntoView({behavior:'smooth'}); }
document.getElementById('fCategory').onchange=renderEvents;
document.getElementById('fVisibility').onchange=renderEvents;
document.getElementById('fRange').onchange=renderEvents;
function getTargetIcon(name, type) {
  const imgStyle = 'width:1.25em; height:1.25em; object-fit:cover; border-radius:50%; vertical-align:-0.2em; display:inline-block; margin-right:6px;';
  
  const map = {
    'Mercury': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Mercury_in_true_color.jpg/120px-Mercury_in_true_color.jpg',
    'Venus':   'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b2/Venus_2_Approach_Image.jpg/120px-Venus_2_Approach_Image.jpg',
    'Mars':    'https://upload.wikimedia.org/wikipedia/commons/thumb/0/02/OSIRIS_Mars_true_color.jpg/120px-OSIRIS_Mars_true_color.jpg',
    'Jupiter': 'https://images-assets.nasa.gov/image/PIA02873/PIA02873~thumb.jpg',
    'Saturn':  'https://images-assets.nasa.gov/image/PIA01364/PIA01364~thumb.jpg',
    'Uranus':  'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/Uranus2.jpg/120px-Uranus2.jpg',
    'Neptune': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/06/Neptune.jpg/120px-Neptune.jpg',
    'Moon':    'https://images-assets.nasa.gov/image/PIA00405/PIA00405~thumb.jpg',
    // Verified NASA fireball capture
    'Meteor':  'https://cdn.mos.cms.futurecdn.net/4czEUp6bukNZcXeGZKKpRH-620-80.jpg',
    // Verified NASA star cluster capture
    // High-resolution Hubble telescope capture of a true point star with diffraction spikes
  'Star': 'https://assets.science.nasa.gov/content/dam/science/astro/universe/internal_resources/496/Sun_Emits_Flare.jpeg'
  };

  let src = map[name];
  if (!src) {
    const lower = (name + ' ' + (type || '')).toLowerCase();
    if (lower.includes('meteor') || lower.includes('shower')) {
      src = map['Meteor'];
    } else {
      src = map['Star'];
    }
  }

  const isSaturn = name === 'Saturn';
  const radius = isSaturn ? '0' : '50%';
  const blend = isSaturn ? 'mix-blend-mode: screen;' : '';

  return `<img src="${src}" alt="" referrerpolicy="no-referrer" style="${imgStyle} border-radius:${radius}; ${blend}">`;
}
function renderAll(){
  renderTonight(); renderNextEvent(); renderEvents(); renderCalendar(); renderMoon(); renderFavorites(); renderWeather(); renderSpaceWeather(); renderMoonImage(); renderAPOD();
  if(typeof renderEnhancements==='function') renderEnhancements();
}

if(USER_LOC){
  document.getElementById('watchingFrom').textContent = `📍 Watching from ${USER_LOC.name}`;
  document.getElementById('locPill').textContent = `📍 ${USER_LOC.name}`;
} else {
  setTimeout(openLocationModal, 600);
}
window.__ASTROSCOPE_BOOT_PENDING__ = true;

// PAGE ROUTING (sideways page-switching nav instead of scrolling)
const PAGE_MAP = {
  home: ['hero'],
  tonight: ['nextEventSection','tonight','whySection'],
  events: ['events'],
  calendar: ['calendar'],
  moon: ['moon'],
  facts: ['facts'],
  learn: ['learn'],
  mysky: ['mysky'],
  trip: ['trip'],
};
const ALL_PAGE_SECTION_IDS = [...new Set(Object.values(PAGE_MAP).flat())];
function showPage(key){
  if(!PAGE_MAP[key]) return;
  ALL_PAGE_SECTION_IDS.forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.classList.add('hidden');
  });
  PAGE_MAP[key].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.classList.remove('hidden');
  });
  [...document.querySelectorAll('.navlinks a')].forEach(a=> a.classList.toggle('active', a.dataset.nav===key));
  [...document.querySelectorAll('.mobilenav a')].forEach(a=>{
    const href=a.getAttribute('href').slice(1);
    const match = (key==='home' && href==='hero') || href===key;
    a.classList.toggle('active', match);
  });
  window.scrollTo({top:0, behavior:'instant' in window? 'instant':'auto'});
  document.dispatchEvent(new CustomEvent('as:page',{detail:key}));
}
function gotoPage(evt, key){ if(evt) evt.preventDefault(); showPage(key); return false; }
showPage('home');

/* ============ INTERACTIVE SOLAR SYSTEM (homepage) ============ */
const PLANET_DATA = [
  {name:'Mercury', size:15, rx:70, period:13.9, 
   img:'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Mercury_in_true_color.jpg/120px-Mercury_in_true_color.jpg',
   facts:[
    'Mercury is the smallest planet in our solar system and the closest to the Sun.',
    'A year on Mercury takes just 88 Earth days.',
    'Despite being closest to the Sun, Mercury is not the hottest planet — Venus is.',
    'Mercury has almost no atmosphere, so temperatures swing wildly between day and night.']},
  {name:'Venus', size:21, rx:100, period:20.8, 
   img:'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b2/Venus_2_Approach_Image.jpg/120px-Venus_2_Approach_Image.jpg',
   facts:[
    'Venus spins backwards compared to most planets, a motion called retrograde rotation.',
    'A day on Venus is longer than its year.',
    'Venus is the hottest planet in the solar system due to a runaway greenhouse effect.',
    'Venus is often called Earth\'s "twin" because of its similar size and mass.']},
  {name:'Earth', size:22, rx:132, period:30, 
   img:'https://upload.wikimedia.org/wikipedia/commons/thumb/9/97/The_Earth_seen_from_Apollo_17.jpg/120px-The_Earth_seen_from_Apollo_17.jpg',
   facts:[
    'Earth is the only known planet with liquid water on its surface.',
    'Earth\'s atmosphere is about 78% nitrogen and 21% oxygen.',
    'A day on Earth is slowly getting longer due to the Moon\'s gravitational pull.',
    'Earth is the only planet not named after a Greek or Roman deity.']},
  {name:'Mars', size:18, rx:166, period:42, 
   img:'https://upload.wikimedia.org/wikipedia/commons/thumb/0/02/OSIRIS_Mars_true_color.jpg/120px-OSIRIS_Mars_true_color.jpg',
   facts:[
    'Mars is home to Olympus Mons, the tallest volcano in the solar system.',
    'Mars has two small moons, Phobos and Deimos.',
    'A year on Mars lasts about 687 Earth days.',
    'Mars\' red color comes from iron oxide — essentially rust — covering its surface.']},
  {name:'Jupiter', size:40, rx:224, period:66, 
   img:'https://images-assets.nasa.gov/image/PIA02873/PIA02873~thumb.jpg',
   facts:[
    'Jupiter is the largest planet in our solar system — over 1,300 Earths could fit inside it.',
    'Jupiter\'s Great Red Spot is a giant storm that has raged for centuries.',
    'Jupiter has at least 95 known moons.',
    'Jupiter has the shortest day of any planet, rotating once in about 10 hours.']},
  {name:'Saturn', size:44, rx:276, period: 90, 
   img:'https://images-assets.nasa.gov/image/PIA01364/PIA01364~thumb.jpg',
   facts:[
    'Saturn\'s rings are made mostly of ice particles, with some rock and dust.',
    'Saturn is the least dense planet — it would float in water if you had a big enough bathtub.',
    'Saturn has 146 confirmed moons, the most of any planet.',
    'A year on Saturn lasts about 29 Earth years.']},
  {name:'Uranus', size:29, rx:322, period:115, 
   img:'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/Uranus2.jpg/120px-Uranus2.jpg',
   facts:[
    'Uranus rotates on its side, with an axial tilt of about 98 degrees.',
    'Uranus was the first planet discovered using a telescope, in 1781.',
    'Uranus has faint rings, discovered in 1977.',
    'Uranus appears pale blue-green due to methane in its atmosphere.']},
  {name:'Neptune', size:28, rx:366, period:140, 
   img:'https://upload.wikimedia.org/wikipedia/commons/thumb/0/06/Neptune.jpg/120px-Neptune.jpg',
   facts:[
    'Neptune has the strongest winds in the solar system, reaching up to 2,100 km/h.',
    'Neptune was the first planet located through mathematical prediction rather than direct observation.',
    'A year on Neptune lasts about 165 Earth years.',
    'Neptune has 16 known moons, the largest being Triton.']},
];
// visual texture add-ons (kept separate so orbit/period/fact data above stays untouched)
PLANET_DATA[0].hi='#d8d0c6'; PLANET_DATA[0].lo='#6b645c';
PLANET_DATA[1].hi='#f3dfb0'; PLANET_DATA[1].lo='#8a6a2e';
PLANET_DATA[2].hi='#bcd9ef'; PLANET_DATA[2].lo='#1f3a5f';
PLANET_DATA[3].hi='#e2a184'; PLANET_DATA[3].lo='#5c2a18';
PLANET_DATA[4].bands=['#e7c9a0 0 8%','#c9a06a 8% 16%','#a97f4c 16% 24%','#dbb98a 24% 32%','#c9a06a 32% 42%','#b58c5c 42% 50%','#e7c9a0 50% 58%','#c9a06a 58% 68%','#a97f4c 68% 78%','#dbb98a 78% 88%','#c9a06a 88% 100%'];
PLANET_DATA[5].bands=['#f2e6c4 0 12%','#d9c79a 12% 24%','#e8dcb2 24% 36%','#d0bd8c 36% 50%','#f2e6c4 50% 62%','#d9c79a 62% 76%','#e8dcb2 76% 88%','#d0bd8c 88% 100%'];
PLANET_DATA[5].ring=false;
PLANET_DATA[6].hi='#c9edf0'; PLANET_DATA[6].lo='#356266';
PLANET_DATA[6].ring=false;
PLANET_DATA[7].hi='#a9c1f2'; PLANET_DATA[7].lo='#22336b';
const RY_RATIO = 0.42; // flatten factor for tilted-orbit look

function planetGradient(p){
  // richer, more "textured" sphere look per planet, banded for gas giants
  if(p.bands){
    return `radial-gradient(circle at 32% 28%, rgba(255,255,255,.35), transparent 40%),
      repeating-linear-gradient(4deg, ${p.bands.join(',')})`;
  }
  return `radial-gradient(circle at 32% 28%, ${p.hi||'#fff'}, ${p.color} 45%, ${p.lo||'#000'} 115%)`;
}
function buildSolarSystem(){
  const sys = document.getElementById('solarSystem');
  if(!sys || sys.dataset.built) return;
  sys.dataset.built = '1';
  PLANET_DATA.forEach((p,i)=>{
    const ring = document.createElement('div');
    ring.className = 'orbit-ring';
    ring.style.width = (p.rx*2)+'px';
    ring.style.height = (p.rx*2*RY_RATIO)+'px';
    sys.appendChild(ring);

    const btn = document.createElement('button');
    btn.className = 'planet-btn';
    const hitSize = Math.max(p.size, 44);
    btn.style.width = hitSize+'px';
    btn.style.height = hitSize+'px';
    btn.title = p.name;
    btn.setAttribute('aria-label', p.name);
    btn.dataset.index = i;
    btn.onclick = ()=> showPlanetFact(i);

    const sphere = document.createElement('span');
    sphere.className = 'planet-sphere' + (p.name === 'Saturn' ? ' is-saturn' : '');
    sphere.style.width = p.size+'px';
    sphere.style.height = p.size+'px';
    sphere.style.display = 'block';
    sphere.style.position = 'relative';

    if (p.name === 'Saturn') {
      sphere.style.borderRadius = '0';
      sphere.style.backgroundImage = `url("${p.img}")`;
      sphere.style.backgroundSize = 'contain';
      sphere.style.backgroundPosition = 'center';
      sphere.style.backgroundRepeat = 'no-repeat';
      sphere.style.mixBlendMode = 'screen';
    } else {
      sphere.style.borderRadius = '50%';
      sphere.style.background = planetGradient(p);
      sphere.style.boxShadow = 'inset -3px -3px 5px rgba(0,0,0,0.65), 0 0 6px rgba(255,255,255,0.2)';

      if(p.img){
        const img = new Image();
        img.referrerPolicy = 'no-referrer';
        img.src = p.img;
        img.onload = () => {
          sphere.style.backgroundImage = `url("${p.img}")`;
          sphere.style.backgroundSize = 'cover';
          sphere.style.backgroundPosition = 'center';
        };
      }
    }

    btn.appendChild(sphere);

    const label = document.createElement('span');
    label.className = 'planet-label';
    label.textContent = p.name;
    sphere.appendChild(label);
    sys.appendChild(btn);
    p._el = btn;
  });
}
// Mean longitude rates (deg/century) to find each planet's real angular position today
const REAL_PLANET_ANGLES = {
  Mercury: { L0: 252.25, Ld: 149472.67 },
  Venus:   { L0: 181.98, Ld: 58517.82 },
  Earth:   { L0: 100.46, Ld: 35999.37 },
  Mars:    { L0: -4.55,  Ld: 19140.30 },
  Jupiter: { L0: 34.40,  Ld: 3034.75 },
  Saturn:  { L0: 49.95,  Ld: 1222.49 },
  Uranus:  { L0: 313.24, Ld: 428.48 },
  Neptune: { L0: -55.12, Ld: 218.46 }
};

function getTruePlanetAngle(name) {
  const d = new Date();
  const T = (toJulian(d) - 2451545) / 36525; // centuries since J2000
  const el = REAL_PLANET_ANGLES[name];
  if (!el) return 0;
  const deg = ((el.L0 + el.Ld * T) % 360 + 360) % 360;
  return deg * (Math.PI / 180); // radians
}
const reduceMotionSolar = matchMedia('(prefers-reduced-motion: reduce)').matches;
const EARTH_ORBIT = {
  a0: 1.00000261, ad: 0.00000562, e0: 0.01671123, ed: -0.00004392,
  i0: -0.00001531, id: -0.01294668, L0: 100.46457166, Ld: 35999.37244981,
  varpi0: 102.93768193, vd: 0.32327364, node0: 0, nd: 0
};

function getTrueOrbitalAngle(planetName) {
  const now = new Date();
  const params = planetName === 'Earth' 
    ? EARTH_ORBIT 
    : PLANETS.find(p => p.name === planetName);

  if (!params) return 0;
  const pos = heliocentric(params, now);
  return Math.atan2(pos.y, pos.x); // Ecliptic heliocentric angle in radians
}

function animateSolarSystem(t){
  PLANET_DATA.forEach(p => {
    // Compute true astronomical position on initialization
    if (p._initialAngle === undefined) {
      p._initialAngle = getTrueOrbitalAngle(p.name);
    }

    const angle = reduceMotionSolar 
      ? p._initialAngle 
      : p._initialAngle + (t / 1000) * (2 * Math.PI / p.period);

    const x = Math.cos(angle) * p.rx;
    const y = Math.sin(angle) * p.rx * RY_RATIO;
    if(p._el){
      p._el.style.setProperty('--orbit-x', `${x}px`);
      p._el.style.setProperty('--orbit-y', `${y}px`);
      p._el.style.zIndex = y > 0 ? '4' : '3';
    }
  });
  requestAnimationFrame(animateSolarSystem);
}
const SUN_FACTS=[
  'The Sun accounts for about 99.86% of the total mass of the solar system.',
  'The Sun is a middle-aged star, about 4.6 billion years old.',
  'Light from the Sun takes about 8 minutes and 20 seconds to reach Earth.',
  'The Sun\'s core reaches temperatures of about 15 million °C.'];
function openPlanetPanel(){
  document.getElementById('planetPanel').classList.add('open');
  document.getElementById('planetPanelScrim').classList.add('open');
}
function closePlanetPanel(){
  document.getElementById('planetPanel').classList.remove('open');
  document.getElementById('planetPanelScrim').classList.remove('open');
}
function showPlanetFact(i){
  const p = PLANET_DATA[i];
  const fact = p.facts[Math.floor(Math.random()*p.facts.length)];
  const visualThumb = p.img 
    ? `<div style="width:56px; height:56px; border-radius:50%; background:url('${p.img}') center/cover no-repeat; box-shadow:inset -4px -4px 6px rgba(0,0,0,.6), 0 0 10px rgba(255,255,255,0.25); margin-bottom:16px;"></div>`
    : `<div style="width:56px; height:56px; border-radius:50%; background:${planetGradient(p)}; box-shadow:inset -4px -4px 6px rgba(0,0,0,.5), inset 3px 3px 4px rgba(255,255,255,.25); margin-bottom:16px;"></div>`;

  document.getElementById('planetModalBody').innerHTML = `
    ${visualThumb}
    <div class="pp-name">${p.name}</div>
    <div class="pp-sub">Planet</div>
    <p style="font-size:14.5px; line-height:1.6; margin-top:18px; color:var(--ink-dim);">${fact}</p>
    <button class="btn btn-ghost" style="margin-top:18px;" onclick="showPlanetFact(${i})">Another fact</button>
  `;
  openPlanetPanel();
}
function showSunFact(){
  const fact = SUN_FACTS[Math.floor(Math.random()*SUN_FACTS.length)];
  document.getElementById('planetModalBody').innerHTML = `
    <div style="width:56px; height:56px; border-radius:50%; background:radial-gradient(circle at 35% 30%, #fff8e6, #ffcf6b 35%, #ff9d3d 65%, #d9611a 100%); box-shadow:0 0 16px 4px rgba(255,180,90,.5); margin-bottom:16px;"></div>
    <div class="pp-name">The Sun</div>
    <div class="pp-sub">Star</div>
    <p style="font-size:14.5px; line-height:1.6; margin-top:18px; color:var(--ink-dim);">${fact}</p>
    <button class="btn btn-ghost" style="margin-top:18px;" onclick="showSunFact()">Another fact</button>
  `;
  openPlanetPanel();
}
buildSolarSystem();
requestAnimationFrame(animateSolarSystem);

/* Quick-fact flashcard (Facts page) */
const QUICK_FACTS=[
  'The Moon is slowly moving away from Earth by about 3.8 centimeters every year.',
  'The Moon takes about 27.3 Earth days to orbit our planet.',
  'We usually see the same side of the Moon because its rotation period matches its orbital period.',
  'The Moon has an extremely thin atmosphere called an exosphere.',
  'Mercury completes one trip around the Sun in about 88 Earth days.',
  'Venus rotates more slowly than it travels around the Sun.',
  'Mars is approximately half the diameter of Earth.',
  'Jupiter is more massive than all the other planets combined.',
  'Saturn is the second-largest planet in the solar system.',
  'Neptune is the farthest recognized planet from the Sun.',
  'The solar system is located in the Milky Way\u2019s Orion Arm.',
  'Pluto takes about 248 Earth years to orbit the Sun.',
  'The solar system includes eight planets, dwarf planets, moons, asteroids, and comets.',
  'Earth\u2019s Moon helps influence the tides in Earth\u2019s oceans.',
  'The Moon\u2019s surface contains craters formed by impacts from space rocks.',
  'Sagittarius A* is the supermassive black hole at the center of the Milky Way.',
  'A black hole is not an ordinary empty hole; it is an object with extremely strong gravity.',
  'Light cannot escape from inside a black hole\u2019s event horizon.',
  'The solar system takes roughly 230 million years to orbit the center of the Milky Way.',
  'The universe includes space, time, matter, and energy.'
];
let ffFlipped=false, ffLastIndex=-1;
const ffSeen=new Set();
function ffPickFact(){
  if(QUICK_FACTS.length<2) return 0;
  let idx;
  do{ idx=Math.floor(Math.random()*QUICK_FACTS.length); }while(idx===ffLastIndex);
  ffLastIndex=idx;
  return idx;
}
function ffCategory(text){
  const t=text.toLowerCase();
  if(t.includes('moon')) return 'Moon';
  if(t.includes('black hole')||t.includes('sagittarius')) return 'Black Holes';
  if(t.includes('mercury')||t.includes('venus')||t.includes('mars')||t.includes('jupiter')||t.includes('saturn')||t.includes('neptune')||t.includes('pluto')) return 'Planets';
  return 'Cosmos';
}
function flipFact(){
  const inner=document.getElementById('flipInner');
  const front=document.getElementById('flipFront');
  const back=document.getElementById('flipBack');
  const counter=document.getElementById('ffCounter');
  if(!inner||!front||!back) return;
  const target = ffFlipped ? front : back;
  const idx=ffPickFact();
  const text=QUICK_FACTS[idx];
  target.innerHTML = `<div class="ff-tag">${ffCategory(text)}</div><div class="ff-text">${text}</div>`;
  ffFlipped=!ffFlipped;
  inner.classList.toggle('flipped');
  ffSeen.add(idx);
  if(counter) counter.textContent = `${ffSeen.size} of ${QUICK_FACTS.length} cosmic curiosities explored`;
}
