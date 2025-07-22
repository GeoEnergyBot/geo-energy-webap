// ✅ НОВАЯ ВЕРСИЯ КЛИЕНТСКОГО КОДА, СОВМЕСТИМАЯ С СЕРВЕРНОЙ ЧАСТЬЮ

// 🔌 Supabase и Telegram WebApp
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
const supabase = createClient(
  'https://ptkzsrlicfhufdnegwjl.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0a3pzcmxpY2ZodWZkbmVnd2psIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI0NzA3NjAsImV4cCI6MjA2ODA0Njc2MH0.eI0eF_imdgGWPLiUULTprh52Jo9P69WGpe3RbCg3Afo'
);

const tg = window.Telegram.WebApp;
tg.expand();
const user = tg.initDataUnsafe.user;

// 📦 UI
const avatarUrl = user?.photo_url || "https://cdn-icons-png.flaticon.com/512/9131/9131529.png";
document.getElementById("username").textContent = user?.first_name || user?.username || "Гость";
document.getElementById("avatar").src = avatarUrl;

// 📍 Карта и состояние
let map, playerMarker, ghostIcon;
let energyMarkers = [];
let lastTileId = null;

// ⚙️ Утилиты
function getTileId(lat, lng) {
  return `${Math.floor(lat * 100)}_${Math.floor(lng * 100)}`;
}

function getGhostIconByLevel(level) {
  const index = Math.min(Math.floor((level - 1) / 10) + 1, 10);
  return `ghost_icons/ghost_level_${String(index).padStart(2, '0')}.png`;
}

function getEnergyIcon(type) {
  const icons = {
    normal: '/energy_blobs/normal_blob.png',
    advanced: '/energy_blobs/advanced_blob.png',
    rare: '/energy_blobs/rare_blob.png'
  };
  return L.icon({
    iconUrl: icons[type] || icons.normal,
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

// 🚀 Инициализация игрока
async function initPlayer() {
  const { data, error } = await supabase.from('players').select('*').eq('telegram_id', user.id.toString()).single();

  if (!data) {
    await supabase.from('players').insert([{
      telegram_id: user.id.toString(),
      username: user.username,
      first_name: user.first_name,
      avatar_url: user.photo_url,
      energy: 0,
      level: 1,
      energy_max: 1000,
      created_at: new Date().toISOString()
    }]);
    return {
      energy: 0,
      energy_max: 1000,
      level: 1
    };
  }

  return data;
}

// 🎮 Обновление UI игрока
function updatePlayerUI(energy, energy_max, level) {
  document.getElementById('energy-value').textContent = energy;
  document.getElementById('energy-max').textContent = energy_max;
  const percent = Math.floor((energy / energy_max) * 100);
  document.getElementById('energy-bar-fill').style.width = percent + "%";

  if (playerMarker) {
    playerMarker.setIcon(L.icon({
      iconUrl: getGhostIconByLevel(level),
      iconSize: [48, 48],
      iconAnchor: [24, 24],
      popupAnchor: [0, -24]
    }));
  }
}

// 🗺️ Загрузка и отображение точек энергии
async function loadEnergyPoints(centerLat, centerLng) {
  const response = await fetch('https://ptkzsrlicfhufdnegwjl.functions.supabase.co/generate-points', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'generate',
      center_lat: centerLat,
      center_lng: centerLng,
      telegram_id: user.id.toString()
    })
  });
  const result = await response.json();
  if (!result.success || !result.points) return;

  energyMarkers.forEach(m => map.removeLayer(m));
  energyMarkers = [];

  result.points.filter(p => !p.collected_by || p.collected_by !== user.id.toString())
    .forEach(point => {
      const marker = L.marker([point.lat, point.lng], { icon: getEnergyIcon(point.type) }).addTo(map);
      energyMarkers.push(marker);

      marker.on('click', () => collectEnergyPoint(point, marker));
    });
}

// ⚡ Сбор энергии
async function collectEnergyPoint(point, marker) {
  const playerPos = playerMarker.getLatLng();
  const distance = getDistance(playerPos.lat, playerPos.lng, point.lat, point.lng);
  if (distance > 0.02) {
    alert("Подойдите ближе к точке");
    return;
  }

  const response = await fetch('https://ptkzsrlicfhufdnegwjl.functions.supabase.co/generate-points', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'collect',
      telegram_id: user.id.toString(),
      point_id: point.id
    })
  });
  const result = await response.json();

  if (!result.success) {
    alert(result.error || "Не удалось собрать точку");
    return;
  }

  map.removeLayer(marker);
  updatePlayerUI(result.energy, result.energy_max, result.level);
  alert(`⚡ Собрано ${result.point_energy_value} энергии. Уровень: ${result.level}`);
}

// 🌍 Запуск карты и логики
(async () => {
  const player = await initPlayer();
  updatePlayerUI(player.energy, player.energy_max, player.level);

  ghostIcon = L.icon({
    iconUrl: getGhostIconByLevel(player.level),
    iconSize: [48, 48],
    iconAnchor: [24, 24],
    popupAnchor: [0, -24]
  });

  if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition(pos => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      map = L.map('map').setView([lat, lng], 16);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
      }).addTo(map);

      playerMarker = L.marker([lat, lng], { icon: ghostIcon }).addTo(map).bindPopup("Вы здесь").openPopup();
      lastTileId = getTileId(lat, lng);
      loadEnergyPoints(lat, lng);
    });

    navigator.geolocation.watchPosition(pos => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      if (playerMarker) playerMarker.setLatLng([lat, lng]);
      const tileId = getTileId(lat, lng);
      if (tileId !== lastTileId) {
        lastTileId = tileId;
        loadEnergyPoints(lat, lng);
      }
    }, err => {
      alert("Ошибка геолокации: " + err.message);
    }, {
      enableHighAccuracy: true,
      maximumAge: 1000,
      timeout: 10000
    });
  } else {
    alert("Геолокация не поддерживается");
  }
})();