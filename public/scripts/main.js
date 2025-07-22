import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabase = createClient(
  'https://ptkzsrlicfhufdnegwjl.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0a3pzcmxpY2ZodWZkbmVnd2psIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI0NzA3NjAsImV4cCI6MjA2ODA0Njc2MH0.eI0eF_imdgGWPLiUULTprh52Jo9P69WGpe3RbCg3Afo'
);

let tg = window.Telegram.WebApp;
tg.expand();
const user = tg.initDataUnsafe.user;

document.getElementById("username").textContent = user?.first_name || user?.username || "Гость";
document.getElementById("avatar").src = user?.photo_url || "https://cdn-icons-png.flaticon.com/512/9131/9131529.png";
const collectSound = new Audio('/sounds/collect.mp3');

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

function getEnergyIncrementByLevel(level) {
  if (level < 10) return 1000;
  if (level < 30) return 2000;
  if (level < 50) return 3000;
  return 4000;
}

let map, playerMarker, ghostIcon;
let lastTileId = null;
let initialized = false;
let energyMarkers = [];
let syncInterval;

async function syncPlayerState() {
  const { data } = await supabase
    .from('players')
    .select('*')
    .eq('telegram_id', user.id)
    .single();

  if (data) {
    document.getElementById('energy-value').textContent = data.energy;
    document.getElementById('energy-max').textContent = data.energy_max;
    document.getElementById('level-badge').textContent = data.level;
    const percent = Math.floor((data.energy / data.energy_max) * 100);
    document.getElementById('energy-bar-fill').style.width = percent + "%";
    ghostIcon = L.icon({
      iconUrl: getGhostIconByLevel(data.level),
      iconSize: [48, 48],
      iconAnchor: [24, 24],
      popupAnchor: [0, -24]
    });
    if (playerMarker) playerMarker.setIcon(ghostIcon);
  }
}

(async () => {
  await syncPlayerState();

  if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition((pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      map = L.map('map').setView([lat, lng], 16);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map);

      playerMarker = L.marker([lat, lng], { icon: ghostIcon }).addTo(map);
      lastTileId = getTileId(lat, lng);
      loadEnergyPoints(lat, lng);
      initialized = true;
    });

    navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        if (playerMarker) playerMarker.setLatLng([lat, lng]);

        const tileId = getTileId(lat, lng);
        if (tileId !== lastTileId) {
          lastTileId = tileId;
          loadEnergyPoints(lat, lng);
        }
      },
      (error) => {
        alert("Ошибка геолокации: " + error.message);
        console.error("GeoError:", error);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 10000,
      }
    );

    syncInterval = setInterval(syncPlayerState, 30000);
  } else {
    alert("Геолокация не поддерживается на этом устройстве.");
  }
})();

async function loadEnergyPoints(centerLat, centerLng) {
  try {
    energyMarkers.forEach(marker => map.removeLayer(marker));
    energyMarkers = [];

    const response = await fetch('https://ptkzsrlicfhufdnegwjl.functions.supabase.co/generate-points', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0a3pzcmxpY2ZodWZkbmVnd2psIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI0NzA3NjAsImV4cCI6MjA2ODA0Njc2MH0.eI0eF_imdgGWPLiUULTprh52Jo9P69WGpe3RbCg3Afo'
      },
      body: JSON.stringify({
        center_lat: centerLat,
        center_lng: centerLng,
        telegram_id: user.id
      })
    });

    const result = await response.json();
    if (!result.success || !result.points) return;

    for (const point of result.points) {
      if (!point.energy_value || isNaN(point.energy_value)) {
        await supabase.from('energy_points').delete().eq('id', point.id);
        continue;
      }

      if (point.collected_by && point.collected_by === user.id.toString()) continue;

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
          let oldLevel = parseInt(player.level ?? 1);
          let energy = parseInt(player.energy ?? 0) + point.energy_value;
          let level = oldLevel;
          let energyMax = parseInt(player.energy_max ?? 1000);

          while (energy >= energyMax) {
            energy -= energyMax;
            level += 1;
            energyMax += getEnergyIncrementByLevel(level);
          }

          await supabase
            .from('players')
            .update({ energy, level, energy_max: energyMax })
            .eq('telegram_id', user.id);

          document.getElementById('energy-value').textContent = energy;
          document.getElementById('energy-max').textContent = energyMax;
          document.getElementById('level-badge').textContent = level;
          const percent = Math.floor((energy / energyMax) * 100);
          document.getElementById('energy-bar-fill').style.width = percent + "%";

          ghostIcon = L.icon({
            iconUrl: getGhostIconByLevel(level),
            iconSize: [48, 48],
            iconAnchor: [24, 24],
            popupAnchor: [0, -24]
          });
          playerMarker.setIcon(ghostIcon);

          collectSound.play();
          alert(`⚡ Вы собрали ${point.energy_value} энергии!`);
        }
      });
    }

  } catch (error) {
    console.error("Ошибка загрузки энерготочек:", error);
  }
}
