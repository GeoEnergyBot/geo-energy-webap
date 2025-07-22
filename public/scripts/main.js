import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabase = createClient(
  'https://ptkzsrlicfhufdnegwjl.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
);

let tg = window.Telegram.WebApp;
tg.expand();
const user = tg.initDataUnsafe.user;

document.getElementById("username").textContent = user?.first_name || user?.username || "Гость";
document.getElementById("avatar").src = user?.photo_url || "https://cdn-icons-png.flaticon.com/512/9131/9131529.png";

function getGhostIconByLevel(level) {
  const index = Math.min(Math.floor((level - 1) / 10) + 1, 10);
  return `ghost_icons/ghost_level_${String(index).padStart(2, '0')}.png`;
}

function getTileId(lat, lng) {
  return `${Math.floor(lat * 100)}_${Math.floor(lng * 100)}`;
}

function getEnergyIcon(type) {
  let url = '';
  switch (type) {
    case 'rare': url = '/energy_blobs/rare_blob.png'; break;
    case 'advanced': url = '/energy_blobs/advanced_blob.png'; break;
    default: url = '/energy_blobs/normal_blob.png';
  }
  return L.icon({
    iconUrl: url,
    iconSize: [60, 100],
    iconAnchor: [30, 50]
  });
}

function getDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

let map, playerMarker, ghostIcon;
let lastTileId = null;
let initialized = false;
let energyMarkers = [];

async function loadEnergyPoints(centerLat, centerLng) {
  try {
    energyMarkers.forEach(marker => map.removeLayer(marker));
    energyMarkers = [];

    const response = await fetch('https://ptkzsrlicfhufdnegwjl.functions.supabase.co/generate-points', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ...'
      },
      body: JSON.stringify({
        center_lat: centerLat,
        center_lng: centerLng,
        telegram_id: user.id
      })
    });

    const result = await response.json();
    if (!result.success || !result.points) return;

    result.points
      .filter(p => !p.collected_by || p.collected_by !== user.id.toString())
      .forEach(point => {
        console.log("Точка:", point); // лог
        const icon = getEnergyIcon(point.type);
        const marker = L.marker([point.lat, point.lng], { icon }).addTo(map);
        energyMarkers.push(marker);

        marker.on('click', async () => {
          const distance = getDistance(centerLat, centerLng, point.lat, point.lng);
          if (distance > 0.02) {
            alert("🚫 Подойдите ближе (до 20 м), чтобы собрать энергию.");
            return;
          }

          const { error } = await supabase
            .from('energy_points')
            .update({
              collected_by: user.id.toString(),
              collected_at: new Date().toISOString()
            })
            .eq('id', point.id)
            .is('collected_by', null);

          if (error) {
            alert("🚫 Энергия уже собрана другим игроком.");
            return;
          }

          map.removeLayer(marker);

          const { data: player } = await supabase
            .from('players')
            .select('*')
            .eq('telegram_id', user.id)
            .single();

          if (player) {
            const energyToAdd = Number(point.energy_value);
            if (isNaN(energyToAdd)) {
              alert("⚠️ Ошибка: значение энергии отсутствует!");
              return;
            }

            const currentEnergy = Number(player.energy) || 0;
            const maxEnergy = Number(player.energy_max) || 1000;
            const newEnergy = Math.min(currentEnergy + energyToAdd, maxEnergy);

            await supabase
              .from('players')
              .update({ energy: newEnergy })
              .eq('telegram_id', user.id);

            document.getElementById('energy-value').textContent = newEnergy;
            document.getElementById('energy-max').textContent = maxEnergy;
            const percent = Math.floor((newEnergy / maxEnergy) * 100);
            document.getElementById('energy-bar-fill').style.width = percent + "%";

            alert(`⚡ Вы собрали ${energyToAdd} энергии!`);
          }
        });
      });
  } catch (error) {
    console.error("Ошибка загрузки энерготочек:", error);
  }
}

const init = async () => { /* инициализация карты, игрока и вызов loadEnergyPoints */ };
init();