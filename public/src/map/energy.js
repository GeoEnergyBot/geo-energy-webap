
import { FUNCTIONS_ENDPOINT, SUPABASE_ANON } from '../env.js';
import { openGhostCatch } from '../ar/ghostCatch.js';
import { getEnergyIcon, getDistanceKm, makeLeafletGhostIconAsync } from '../utils.js';
import { updatePlayerHeader, flashPlayerMarker } from '../ui.js';
import { quests } from '../quests.js';
import { anti } from '../anti.js';
import { store } from '../store.js';
import { hotzones } from '../hotzones.js';

let energyMarkers = [];
let isLoadingPoints = false;

const __pointCooldown = new Map();
const __pending = new Set();
const now = ()=> Date.now();

function todayKey(){ const d=new Date(); return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`; }
function getDailyCap(level){ return 1200 + 80 * (Number(level)||1); }
function getDailyProgress(){ try{ return Number(localStorage.getItem('daily_energy_'+todayKey())||'0')||0; }catch(e){ return 0; } }
function addDailyProgress(delta){ try{ const k='daily_energy_'+todayKey(); const cur=Number(localStorage.getItem(k)||'0')||0; localStorage.setItem(k, String(cur + Math.max(0,Math.floor(delta)))); }catch(e){} }
function remainingDaily(level){ const cap=getDailyCap(level); const cur=getDailyProgress(); return Math.max(0, cap-cur); }
function isCooldown(id,ms=3000){ const t=__pointCooldown.get(id)||0; return now()-t < ms; }
function setCooldown(id){ __pointCooldown.set(id, now()); }

async function apiGenerate(telegram_id, lat, lng){
  if (!FUNCTIONS_ENDPOINT){
    // offline fallback: generate local points
    const pts=[];
    for (let i=0;i<25;i++){
      const dLat = (Math.random()-0.5)*0.01;
      const dLng = (Math.random()-0.5)*0.01;
      const types = ['normal','normal','advanced','rare'];
      const type = types[(Math.random()*types.length)|0];
      pts.push({ id: 'local_'+(Math.random()*1e9|0)+'_'+i, lat: lat+dLat, lng: lng+dLng, type, energy: (type==='rare'?120:(type==='advanced'?70:35)) });
    }
    return { success:true, points: pts };
  }
  const res = await fetch(FUNCTIONS_ENDPOINT, {
    method:'POST',
    headers:{ 'Content-Type':'application/json', 'Authorization': `Bearer ${SUPABASE_ANON}` },
    body: JSON.stringify({ action:'generate', telegram_id: String(telegram_id) })
  });
  const json = await res.json().catch(()=>({}));
  if (!res.ok) throw new Error(json.error||('HTTP '+res.status));
  return json;
}
async function apiCollect(telegram_id, point_id){
  if (!FUNCTIONS_ENDPOINT){
    return { success:true, point_energy_value: (Math.random()<0.1?120:(Math.random()<0.4?70:35)), player:{ level: (Number(document.getElementById('level-badge')?.textContent)||1), energy_max: (Number(document.getElementById('energy-max')?.textContent)||1000) } };
  }
  const res = await fetch(FUNCTIONS_ENDPOINT, {
    method:'POST',
    headers:{ 'Content-Type':'application/json', 'Authorization': `Bearer ${SUPABASE_ANON}` },
    body: JSON.stringify({ action:'collect', telegram_id: String(telegram_id), point_id })
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
    const pos = playerMarker.getLatLng();
    const data = await apiGenerate(user.id, pos.lat, pos.lng);
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
          alert('🚫 Подойдите ближе (до 20 м), чтобы собрать энергию.'); return;
        }

        // daily cap pre-check
        const lvl = Number(document.getElementById('level-badge')?.textContent||'1')||1;
        if (remainingDaily(lvl) <= 0){ alert('⚠️ Дневной лимит фарма достигнут, попробуйте завтра'); return; }

        const ar = await openGhostCatch(p.type==='rare'?'rare':(p.type==='advanced'?'advanced':'common'));
        if (!ar || !ar.success) return;
        quests.onARWin();

        __pending.add(p.id);
        try{
          const sound = document.getElementById('energy-sound'); if (sound){ try{ sound.currentTime=0; await sound.play(); }catch(_){ } }
          const anim = L.circleMarker([p.lat, p.lng], { radius:10, color:'#00ff99', fillColor:'#00ff99', fillOpacity:0.85 }).addTo(map);
          const start= L.latLng(p.lat,p.lng), end= playerPos; const duration=500; const t0=performance.now();
          const step=(ts)=>{ const t=Math.min(1,(ts-t0)/duration); const lat=start.lat+(end.lat-start.lat)*t; const lng=start.lng+(end.lng-start.lng)*t; anim.setLatLng([lat,lng]); if (t<1) requestAnimationFrame(step); else map.removeLayer(anim); };
          requestAnimationFrame(step);

          let collect = await apiCollect(user.id, p.id);
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
          const rem = remainingDaily(pInfo.level);
          const apply = Math.min(awarded, rem);
          addDailyProgress(apply);

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
