import { FUNCTIONS_ENDPOINT, SUPABASE_ANON } from '../env.js';
import { getEnergyIcon, getDistanceKm, makeLeafletGhostIconAsync } from '../utils.js';
import { updatePlayerHeader, flashPlayerMarker } from '../ui.js';
import { quests } from '../quests.js';
import { anti } from '../anti.js';
import { store } from '../store.js';
import { hotzones } from '../hotzones.js';

let energyMarkers = [];
const IS_PROD = (typeof location!=='undefined') && (['geo-energy-webap.vercel.app'].includes(location.hostname));
let isLoadingPoints = false;

function showBackendBanner(msg){
  try{
    let el = document.getElementById('backend-banner');
    if (!el){
      el = document.createElement('div'); el.id='backend-banner';
      Object.assign(el.style, { position:'absolute', left:'50%', transform:'translateX(-50%)', top:'56px', zIndex:1200, background:'#7f1d1d', color:'#fff', padding:'6px 10px', borderRadius:'10px', border:'1px solid rgba(255,255,255,.25)', boxShadow:'0 4px 20px rgba(0,0,0,.3)', fontSize:'12px' });
      document.body.appendChild(el);
    }
    el.textContent = msg || '';
    if (!msg) el.style.display='none'; else el.style.display='block';
  }catch(e){}
}

const __pointCooldown = new Map();
const __pending = new Set();
const now = ()=> Date.now();

function pickCenterLatLng(playerMarker){
  try{
    const p = playerMarker?.getLatLng?.();
    let lat = Number(p?.lat);
    let lng = Number(p?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)){
      lat = Number(localStorage.getItem('last_lat'));
      lng = Number(localStorage.getItem('last_lng'));
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lng)){
      lat = 43.238949; lng = 76.889709; // Алматы
    }
    return {lat, lng};
  }catch(_){ return { lat:43.238949, lng:76.889709 }; }
}

function todayKey(){ return ""; }
function getDailyCap(level){ return Infinity; }
function getDailyProgress(){ return 0; }
function addDailyProgress(delta){ /* disabled daily limit */ }
function remainingDaily(level){ return Infinity; }
function isCooldown(id,ms=3000){ const t=__pointCooldown.get(id)||0; return now()-t < ms; }
function setCooldown(id){ __pointCooldown.set(id, now()); }

async function apiGenerate(telegram_id, lat, lng){
  if (!FUNCTIONS_ENDPOINT) throw new Error('FUNCTIONS_ENDPOINT not set');
  const res = await fetch(FUNCTIONS_ENDPOINT, {
    method:'POST',
    headers:{ 'Content-Type':'application/json', 'Authorization': `Bearer ${SUPABASE_ANON}` },
    body: JSON.stringify({ action:'generate', telegram_id:String(telegram_id), center_lat: lat, center_lng: lng })
  });
  const json = await res.json().catch(()=>({}));
  if (!res.ok) throw new Error(json.error||('HTTP '+res.status));
  return json;
}
async function apiCollect(telegram_id, point_id){
  if (!FUNCTIONS_ENDPOINT) throw new Error('FUNCTIONS_ENDPOINT not set');
  const res = await fetch(FUNCTIONS_ENDPOINT, {
    method:'POST',
    headers:{ 'Content-Type':'application/json', 'Authorization': `Bearer ${SUPABASE_ANON}` },
    body: JSON.stringify({ action:'collect', telegram_id:String(telegram_id), point_id })
  });
  const json = await res.json().catch(()=>({}));
  if (!res.ok) throw new Error(json.error||('HTTP '+res.status));
  return json;
}

export async function loadEnergyPoints(map, playerMarker, user){
  if (isLoadingPoints) return;
  isLoadingPoints = true;
  try{
    // cleanup previous markers
    for (const m of energyMarkers){ try{ map.removeLayer(m.marker);}catch(e){} }
    energyMarkers = [];

    const pos = pickCenterLatLng(playerMarker);
    console.debug('[generate] send lat/lng:', pos.lat, pos.lng);
    let data; 
    try{ 
      data = await apiGenerate(user.id, pos.lat, pos.lng); 
      showBackendBanner(''); 
    } catch(err){ 
      console.error('generate error', err); 
      showBackendBanner('Нет соединения с бэкендом'); 
      throw err; 
    }

    const points = data.points||[];
    for (const p of points){
      const marker = L.marker([p.lat, p.lng], { icon: getEnergyIcon(p.type) });
      marker.addTo(map);
      energyMarkers.push({ id: p.id, marker, data: p });
      marker.on('click', async ()=>{
        if (isCooldown(p.id)) { alert('Подождите пару секунд...'); return; }
        if (__pending.has(p.id)) return;
        setCooldown(p.id);

        const playerPos = playerMarker.getLatLng();
        if (getDistanceKm(playerPos.lat, playerPos.lng, p.lat, p.lng) > 0.02){
          alert('🚫 Подойдите ближе (до 20 м), чтобы собрать энергию.'); return; }

        
        const ar = await window.openGhostCatch(p.type==='rare'?'rare':(p.type==='advanced'?'advanced':'common'));
        if (!ar || !ar.success) return;
        quests.onARWin();

        __pending.add(p.id);
        try{
          const sound = document.getElementById('energy-sound'); if (sound){ try{ sound.currentTime=0; await sound.play(); }catch(_){ } }
          const anim = L.circleMarker([p.lat, p.lng], { radius:10, color:'#00ff99', fillColor:'#00ff99', fillOpacity:0.85 }).addTo(map);
          const start= L.latLng(p.lat,p.lng), end= playerPos; const duration=500; const t0=performance.now();
          const step=(ts)=>{ const t=Math.min(1,(ts-t0)/duration); const lat=start.lat+(end.lat-start.lat)*t; const lng=start.lng+(end.lng-start.lng)*t; anim.setLatLng([lat,lng]); if (t<1) requestAnimationFrame(step); else map.removeLayer(anim); };
          requestAnimationFrame(step);

          let collect; 
          try{ 
            collect = await apiCollect(user.id, p.id); 
            showBackendBanner(''); 
          } catch(err){ 
            console.error('collect error', err); 
            showBackendBanner('Нет соединения с бэкендом'); 
            throw err; 
          }
          if (!collect?.success){ alert('🚫 Ошибка сбора энергии'); return; }
          quests.onCollect(p.type);

          // remove marker on success
          const idx = energyMarkers.findIndex(x=>x.id===p.id);
          if (idx>=0){ map.removeLayer(energyMarkers[idx].marker); energyMarkers.splice(idx,1); }

          // awarded calc with buffs/penalty/cap
          const base = collect.point_energy_value|0;
          const penalty = anti.getPenalty();
          const mult = (store.energyMultiplier()||1) * (hotzones.getBuffAt(playerPos.lat, playerPos.lng) || 1);
          let awarded = Math.floor(base * mult);
          if (penalty.active){ awarded = Math.floor(awarded * penalty.factor); alert('⚠️ Подозрительное перемещение — награда снижена.'); }

          const pInfo = collect.player || { level: lvl, energy_max: Number(document.getElementById('energy-max')?.textContent||'1000')||1000 };
          const apply = awarded; /* daily limit removed */

          // display HUD energy locally (simple UX level-up)
          const cur = Number(document.getElementById('energy-value')?.textContent||'0')||0;
          let displayEnergy = cur + apply;
          let newLevel = pInfo.level, newMax = pInfo.energy_max, levelUp=false;
          if (displayEnergy >= newMax){
            const overflow = displayEnergy - newMax;
            newLevel += 1;
            const inc = (newLevel<=9?1000:(newLevel<=29?2000:(newLevel<=49?3000:4000)));
            newMax += inc; displayEnergy = overflow; levelUp=true;
          }

          await updatePlayerHeader({ username: user.first_name||user.username||'Игрок', level: newLevel, energy: displayEnergy, energy_max: newMax });
          if (playerMarker){ const icon = await makeLeafletGhostIconAsync(newLevel); playerMarker.setIcon(icon); flashPlayerMarker(playerMarker); }

          alert(`⚡ База: ${base} → с бустами/штрафами и лимитами: ${apply}`);
        } finally {
          __pending.delete(p.id);
        }
      });
    }
  } catch (err){
    console.error('loadEnergyPoints error', err);
  } finally {
    isLoadingPoints = false;
  }
}
