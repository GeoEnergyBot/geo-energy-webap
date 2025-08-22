import { openGhostCatch } from '../ar/ghostCatch.js';
import { FUNCTIONS_ENDPOINT, SUPABASE_ANON } from '../env.js';
import { getEnergyIcon, getDistanceKm, makeLeafletGhostIconAsync } from '../utils.js';
import { updatePlayerHeader, flashPlayerMarker } from '../ui.js';

let isLoadingPoints = false;
let energyMarkers = [];

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
          const playerPos = playerMarker.getLatLng();
          const distanceKm = getDistanceKm(playerPos.lat, playerPos.lng, point.lat, point.lng);
          if (distanceKm > 0.02) {
            alert("🚫 Подойдите ближе (до 20 м), чтобы собрать энергию.");
            return;
          }

// === Мини-игра перед сбором ===
const arResult = await openGhostCatch(point.type === 'rare' ? 'rare' : (point.type === 'advanced' ? 'advanced' : 'common'));
if (!arResult || !arResult.success) return;
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
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${SUPABASE_ANON}`
            },
            body: JSON.stringify({
              action: "collect",
              telegram_id: String(user.id),
              point_id: point.id
            })
          });

          const collectResult = await res.json();
          if (!res.ok || !collectResult.success) {
            alert("🚫 Ошибка сбора энергии: " + (collectResult.error || res.status));
            return;
          }

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