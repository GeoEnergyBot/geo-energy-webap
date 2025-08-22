import { quests } from '../quests.js';
import { anti } from '../anti.js';
import { openGhostCatch } from '../ar/ghostCatch.js';
import { FUNCTIONS_ENDPOINT, SUPABASE_ANON } from '../env.js';
import { getEnergyIcon, getDistanceKm, makeLeafletGhostIconAsync } from '../utils.js';
import { updatePlayerHeader, flashPlayerMarker } from '../ui.js';

let isLoadingPoints = false;
let energyMarkers = [];


// === Stage 2: cooldowns, pending protection, daily caps ===
const __pointCooldown = new Map();   // point_id -> timestamp
const __pending = new Set();         // currently collecting ids
function now(){ return Date.now(); }
function isCooldown(id, ms=3000){ const t = __pointCooldown.get(id)||0; return now()-t < ms; }
function setCooldown(id){ __pointCooldown.set(id, now()); }

function todayKey(){
  const d = new Date(); return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
}
function getDailyCap(level){ return 1200 + 80 * (Number(level)||1); }
function getDailyProgress(){
  try{ return Number(localStorage.getItem('daily_energy_'+todayKey())||'0')||0; }catch(e){ return 0; }
}
function addDailyProgress(delta){
  try{
    const k = 'daily_energy_'+todayKey();
    const cur = Number(localStorage.getItem(k)||'0')||0;
    localStorage.setItem(k, String(cur + Math.max(0, Math.floor(delta))));
  }catch(e){}
}
function remainingDaily(level){
  const cap = getDailyCap(level);
  const cur = getDailyProgress();
  return Math.max(0, cap - cur);
}


export async function loadEnergyPoints(map, playerMarker, user) {
  if (isLoadingPoints) return;
  isLoadingPoints = true;
  try {
    energyMarkers.forEach(m => map && map.removeLayer(m.marker));
    energyMarkers = [];

    const center = playerMarker.getLatLng();
    const response = await fetch(FUNCTIONS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON}`
      },
      body: JSON.stringify({
        action: "generate",
        center_lat: center.lat,
        center_lng: center.lng,
        telegram_id: String(user.id)
      })
    });

    if (!response.ok) throw new Error('generate-points HTTP ' + response.status);
    const result = await response.json();
    if (!result.success || !Array.isArray(result.points)) return;

    const uid = String(user.id);

    result.points
      .filter(p => !p.collected_by || String(p.collected_by) !== uid)
      .forEach((point) => {
        const icon = getEnergyIcon(point.type);
        const marker = L.marker([point.lat, point.lng], { icon }).addTo(map);
        energyMarkers.push({ id: point.id, marker });

        
marker.on('click', async () => {
  // Cooldown & pending guard
  if (isCooldown(point.id)) { alert('Подождите пару секунд...'); return; }
  if (__pending.has(point.id)) return;
  setCooldown(point.id);

  const playerPos = playerMarker.getLatLng();
  const distanceKm = getDistanceKm(playerPos.lat, playerPos.lng, point.lat, point.lng);
  if (distanceKm > 0.02) { alert("🚫 Подойдите ближе (до 20 м), чтобы собрать энергию."); return; }

  // Soft daily cap pre-check
  const levelEl = document.getElementById('level-badge');
  const level = Number(levelEl?.textContent||'1')||1;
  const remain = remainingDaily(level);
  if (remain <= 0){
    alert("⚠️ Дневной лимит фарма энергии достигнут. Попробуйте завтра!"); 
    return;
  }

  // Mini-game before collect
  const arResult = await openGhostCatch(point.type === 'rare' ? 'rare' : (point.type === 'advanced' ? 'advanced' : 'common'));
  if (!arResult || !arResult.success) return;
  quests.onARWin();

  __pending.add(point.id);
  try{
    const sound = document.getElementById('energy-sound');
    if (sound) { try { sound.currentTime = 0; await sound.play(); } catch (_) {} }
    const animatedCircle = L.circleMarker([point.lat, point.lng], {
      radius: 10, color: "#00ff00", fillColor: "#00ff00", fillOpacity: 0.8
    }).addTo(map);
    const start = L.latLng(point.lat, point.lng);
    const end = playerPos;
    const duration = 500;
    const startTime = performance.now();
    function animate(ts) {
      const progress = Math.min(1, (ts - startTime) / duration);
      const lat = start.lat + (end.lat - start.lat) * progress;
      const lng = start.lng + (end.lng - start.lng) * progress;
      animatedCircle.setLatLng([lat, lng]);
      if (progress < 1) requestAnimationFrame(animate);
      else map.removeLayer(animatedCircle);
    }
    requestAnimationFrame(animate);

    const res = await fetch(FUNCTIONS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON}` },
      body: JSON.stringify({ action: "collect", telegram_id: String(user.id), point_id: point.id })
    });
    const collectResult = await res.json();
    if (!res.ok || !collectResult.success) {
      alert(\"🚫 Ошибка сбора энергии: \" + (collectResult.error || res.status));
      return;
    }

    quests.onCollect(point.type);

    // Remove marker locally
    const idx = energyMarkers.findIndex(x => x.id === point.id);
    if (idx >= 0) { map.removeLayer(energyMarkers[idx].marker); energyMarkers.splice(idx, 1); }

    // Apply soft daily cap & anti penalty to displayed energy (not server authoritative)
    const p = collectResult.player;
    if (!p) { alert("ℹ️ Энергия собрана, но нет данных игрока."); return; }

    const penalty = anti.getPenalty();
    let awarded = collectResult.point_energy_value|0;
    if (penalty.active){
      awarded = Math.floor(awarded * penalty.factor);
      alert('⚠️ Обнаружено подозрительное перемещение (' + penalty.reason + '). Награда временно уменьшена.');
    }

    const rem = remainingDaily(p.level ?? 1);
    const apply = Math.min(awarded, rem);
    addDailyProgress(apply);

    // Use current UI energy to compute effective new display value
    const curEnergy = Number(document.getElementById('energy-value')?.textContent||'0')||0;
    let displayEnergy = curEnergy + apply;
    let levelUp = false;
    let newLevel = p.level, newEnergyMax = p.energy_max;
    if (displayEnergy >= p.energy_max){
      // replicate level-up UX locally (only if under cap)
      const overflow = displayEnergy - p.energy_max;
      newLevel = (p.level||1) + 1;
      const inc = (newLevel<=9?1000:(newLevel<=29?2000:(newLevel<=49?3000:4000)));
      newEnergyMax = p.energy_max + inc;
      displayEnergy = overflow;
      levelUp = true;
    }

    await updatePlayerHeader({
      username: p.first_name || p.username,
      avatar_url: '',
      level: newLevel,
      energy: displayEnergy,
      energy_max: newEnergyMax
    });

    if (playerMarker) {
      const newIcon = await makeLeafletGhostIconAsync(newLevel);
      playerMarker.setIcon(newIcon);
      flashPlayerMarker(playerMarker);
    }

    let msg = `⚡ Собрано: ${collectResult.point_energy_value} энергии.`;
    if (penalty.active) msg += ` (Штраф ${Math.round((1-penalty.factor)*100)}%)`;
    const used = apply;
    if (used < awarded) msg += ` Зачтено: ${used} (лимит на сегодня).`;
    if (levelUp) msg += ` Новый уровень: ${newLevel}`;
    alert(msg);
  } finally {
    __pending.delete(point.id);
  }
});


          const collectResult = await res.json();
          if (!res.ok || !collectResult.success) {
      alert(\"🚫 Ошибка сбора энергии: \" + (collectResult.error || res.status));
      return;
    }

    quests.onCollect(point.type);

          const idx = energyMarkers.findIndex(x => x.id === point.id);
          if (idx >= 0) {
            map.removeLayer(energyMarkers[idx].marker);
            energyMarkers.splice(idx, 1);
          }

          const p = collectResult.player;
          if (!p) { alert("ℹ️ Энергия собрана, но нет данных игрока."); return; }

          await updatePlayerHeader({
            username: p.first_name || p.username,
            avatar_url: '',
            level: p.level,
            energy: p.energy,
            energy_max: p.energy_max
          });

          if (playerMarker) {
            const newIcon = await makeLeafletGhostIconAsync(p.level);
            playerMarker.setIcon(newIcon);
            flashPlayerMarker(playerMarker);
          }

          alert(`⚡ Собрано: ${collectResult.point_energy_value} энергии. Уровень: ${p.level}`);
        });
      });

  } catch (error) {
    console.error("Ошибка загрузки точек:", error);
  } finally {
    isLoadingPoints = false;
  }
}