import { FUNCTIONS_ENDPOINT, SUPABASE_ANON } from '../env.js';
import { openGhostCatch } from '../ar/ghostCatch.js';
import { getEnergyIcon, getDistanceKm, makeLeafletGhostIconAsync } from '../utils.js';
import { updatePlayerHeader, flashPlayerMarker } from '../ui.js';

let energyMarkers = [];
let isLoadingPoints = false;

function showBackendBanner(msg){
  try{
    let el = document.getElementById('backend-banner');
    if (!el){
      el = document.createElement('div');
      el.id = 'backend-banner';
      Object.assign(el.style, { position:'absolute', left:'50%', top:'88px', transform:'translateX(-50%)', background:'#7f1d1d', color:'#fff', padding:'6px 10px', borderRadius:'10px', border:'1px solid rgba(255,255,255,.2)', zIndex:1800, display:'none' });
      document.body.appendChild(el);
    }
    el.textContent = msg || '';
    el.style.display = msg ? 'block' : 'none';
  } catch {}
}

const __pending = new Set();
function isCooldown(id){ return __pending.has('cd:'+id); }
function setCooldown(id){ __pending.add('cd:'+id); setTimeout(()=>__pending.delete('cd:'+id), 1000); }

async function apiGenerate(telegram_id, lat, lng){
  const resp = await fetch(FUNCTIONS_ENDPOINT, {
    method:'POST',
    headers:{ 'Content-Type':'application/json', 'Authorization': `Bearer ${SUPABASE_ANON}` },
    body: JSON.stringify({ action:'generate', center_lat: lat, center_lng: lng, telegram_id:String(telegram_id) })
  });
  if (!resp.ok) throw new Error('generate HTTP '+resp.status);
  return await resp.json();
}

async function apiCollect(telegram_id, point_id){
  const resp = await fetch(FUNCTIONS_ENDPOINT, {
    method:'POST',
    headers:{ 'Content-Type':'application/json', 'Authorization': `Bearer ${SUPABASE_ANON}` },
    body: JSON.stringify({ action:'collect', telegram_id:String(telegram_id), point_id })
  });
  if (!resp.ok) throw new Error('collect HTTP '+resp.status);
  return await resp.json();
}

export async function loadEnergyPoints(map, playerMarker, user){
  if (isLoadingPoints) return;
  if (!playerMarker || !playerMarker.getLatLng) return;
  isLoadingPoints = true;
  try{
    const pos = playerMarker.getLatLng();
    let result;
    try{
      result = await apiGenerate(user.id, pos.lat, pos.lng);
      showBackendBanner('');
    } catch (err){
      console.error('[generate] error', err);
      showBackendBanner('Нет соединения с бэкендом');
      return;
    }
    if (!result?.success || !Array.isArray(result.points)) return;

    energyMarkers.forEach(m => { try{ map.removeLayer(m.marker); }catch{} });
    energyMarkers = [];

    const uid = String(user.id);
    result.points
      .filter(p => !p.collected_by || String(p.collected_by) !== uid)
      .forEach((p)=>{
        const icon = getEnergyIcon(p.type);
        const marker = L.marker([p.lat, p.lng], { icon }).addTo(map);
        energyMarkers.push({ id: p.id, marker });

        marker.on('click', async () => {
          if (isCooldown(p.id)) { alert('Подождите пару секунд...'); return; }
          if (__pending.has(p.id)) return;
          setCooldown(p.id);

          const playerPos = playerMarker.getLatLng();
          if (getDistanceKm(playerPos.lat, playerPos.lng, p.lat, p.lng) > 0.02){
            alert('🚫 Подойдите ближе (до 20 м), чтобы собрать энергию.');
            return;
          }

          const rarity = (p.type==='rare'?'rare':(p.type==='advanced'?'advanced':'common'));
          const ar = await openGhostCatch(rarity);
          if (!ar || !ar.success) return;

          __pending.add(p.id);
          try{
            const sound = document.getElementById('energy-sound');
            if (sound) { try{ sound.currentTime=0; await sound.play(); }catch{} }

            const anim = L.circleMarker([p.lat, p.lng], { radius: 10, color: '#00ff99', fillColor: '#00ff99', fillOpacity: 0.85 }).addTo(map);
            const start = L.latLng(p.lat, p.lng), end = playerPos; const duration = 500; const t0 = performance.now();
            const step = (ts) => { const t = Math.min(1, (ts - t0) / duration); const lat = start.lat + (end.lat - start.lat) * t; const lng = start.lng + (end.lng - start.lng) * t; anim.setLatLng([lat, lng]); if (t < 1) requestAnimationFrame(step); else map.removeLayer(anim); };
            requestAnimationFrame(step);

            let collect;
            try{
              collect = await apiCollect(user.id, p.id);
              showBackendBanner('');
            } catch (err){
              console.error('[collect] error', err);
              showBackendBanner('Нет соединения с бэкендом');
              alert('🚫 Ошибка сбора энергии: ' + (err?.message || 'network'));
              return;
            }
            if (!collect?.success || !collect.player) { alert('🚫 Ошибка сбора энергии'); return; }

            const idx = energyMarkers.findIndex(x => x.id === p.id);
            if (idx >= 0) { map.removeLayer(energyMarkers[idx].marker); energyMarkers.splice(idx,1); }

            const base = Number(collect.point_energy_value || 0);
            const applied = Number(collect.applied || 0);
            const mult = Number(collect.multiplier || 1);
            const hz = collect.hotzone ? (', зона x' + collect.hotzone.mult) : '';
            alert(`⚡ База: ${base} × ${mult} → начислено: ${applied}${hz}`);

            await updatePlayerHeader(collect.player);
            try{
              const icon = await makeLeafletGhostIconAsync(collect.player.level || 1);
              playerMarker.setIcon(icon);
              flashPlayerMarker(playerMarker);
            }catch{}

            // ask for a fresh generate so new points appear if TTL allows
            try{ window.dispatchEvent(new Event('points:refresh')); }catch{}

          } finally {
            __pending.delete(p.id);
          }
        });
      });

  } finally {
    isLoadingPoints = false;
  }
}