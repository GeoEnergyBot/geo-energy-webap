// 🔌 Supabase-клиент
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabase = createClient(
  'https://ptkzsrlicfhufdnegwjl.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0a3pzcmxpY2ZodWZkbmVnd2psIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI0NzA3NjAsImV4cCI6MjA2ODA0Njc2MH0.eI0eF_imdgGWPLiUULTprh52Jo9P69WGpe3RbCg3Afo'
);

// 📦 Telegram WebApp
const tg = window.Telegram.WebApp;
tg.expand();
const user = tg.initDataUnsafe.user;

// 🌍 Карта и глобальные переменные
let map, playerMarker, ghostIcon;
let lastTileId = null;
let initialized = false;
let energyMarkers = [];

// 🔧 Утилиты
function getTileId(lat, lng) {
  return `${Math.floor(lat * 100)}_${Math.floor(lng * 100)}`;
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

// 👻 Иконки
function getGhostIconByLevel(level) {
  const index = Math.min(Math.floor((level - 1) / 10) + 1, 10);
  return `ghost_icons/ghost_level_${String(index).padStart(2, '0')}.png`;
}

function getEnergyIcon(type) {
  const icons = {
    rare: '/energy_blobs/rare_blob.png',
    advanced: '/energy_blobs/advanced_blob.png',
    normal: '/energy_blobs/normal_blob.png'
  };
  return L.icon({
    iconUrl: icons[type] || icons.normal,
    iconSize: [60, 100],
    iconAnchor: [30, 50]
  });
}

// 🎮 Обновление UI игрока
function updatePlayerUI(energy, energy_max, level) {
  document.getElementById('energy-value').textContent = energy;
  document.getElementById('energy-max').textContent = energy_max;
  const percent = Math.floor((energy / energy_max) * 100);
  document.getElementById('energy-bar-fill').style.width = percent + "%";

  playerMarker?.setIcon(L.icon({
    iconUrl: getGhostIconByLevel(level),
    iconSize: [48, 48],
    iconAnchor: [24, 24]
  }));
}

// 🛰️ Сбор энергии
async function collectEnergy(point, playerLat, playerLng, marker) {
  const distance = getDistance(playerLat, playerLng, point.lat, point.lng);
  if (distance > 0.02) {
    alert("🚫 Подойдите ближе (до 20 м), чтобы собрать энергию.");
    return;
  }

  tg.sendData(`🎯 Попытка сбора энергии: point_id=${point.id}, user_id=${user.id}`);
  console.log(`📤 Отправка запроса на сбор точки ${point.id}`);

  const response = await fetch('https://ptkzsrlicfhufdnegwjl.functions.supabase.co/generate-points', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      action: "collect",
      telegram_id: user.id,
      point_id: point.id
    })
  });

  const result = await response.json();
  if (!result.success) {
    alert("🚫 Энергия уже собрана другим игроком.");
    console.warn("⚠️ Ошибка сбора:", result.error);
    return;
  }

  map.removeLayer(marker);
  updatePlayerUI(result.energy, result.energy_max, result.level);
  new Audio('/sounds/collect.mp3').play().catch(() => {});
  alert(`⚡ Вы собрали ${result.point_energy_value} энергии! Уровень: ${result.level}`);

  tg.sendData(`✅ Энергия собрана: +${result.point_energy_value}, now=${result.energy}/${result.energy_max}, lvl=${result.level}`);
}

// 🌍 Загрузка точек энергии
async function loadEnergyPoints(centerLat, centerLng) {
  energyMarkers.forEach(marker => map.removeLayer(marker));
  energyMarkers = [];

  const response = await fetch('https://ptkzsrlicfhufdnegwjl.functions.supabase.co/generate-points', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: "generate",
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
      const marker = L.marker([point.lat, point.lng], { icon: getEnergyIcon(point.type) }).addTo(map);
      energyMarkers.push(marker);
      marker.on('click', () => collectEnergy(point, centerLat, centerLng, marker));
    });
}

// 🧠 Инициализация игрока и загрузка карты
(async () => {
  document.getElementById("username").textContent = user?.first_name || user?.username || "Гость";
  document.getElementById("avatar").src = user?.photo_url || "https://cdn-icons-png.flaticon.com/512/9131/9131529.png";

  // 🔍 Проверка существующего игрока
  let { data: player } = await supabase
    .from('players')
    .select('*')
    .eq('telegram_id', user.id)
    .single();

  if (!player) {
    await supabase.from('players').insert([{
      telegram_id: user.id,
      username: user.username,
      first_name: user.first_name,
      avatar_url: user.photo_url,
      energy: 0,
      level: 1,
      energy_max: 1000,
      created_at: new Date().toISOString()
    }]);

    const { data: newPlayer } = await supabase
      .from('players')
      .select('*')
      .eq('telegram_id', user.id)
      .single();

    player = newPlayer;
    if (!player) {
      alert("Ошибка создания игрока. Повторите позже.");
      return;
    }
  }

  updatePlayerUI(player.energy ?? 0, player.energy_max ?? 1000, player.level ?? 1);

  ghostIcon = L.icon({
    iconUrl: getGhostIconByLevel(player.level),
    iconSize: [48, 48],
    iconAnchor: [24, 24],
    popupAnchor: [0, -24]
  });

  if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition((pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      map = L.map('map').setView([lat, lng], 16);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map);

      playerMarker = L.marker([lat, lng], { icon: ghostIcon }).addTo(map).bindPopup("Вы здесь").openPopup();
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

    // 🔄 Обновление состояния каждую минуту
    setInterval(async () => {
      if (initialized && playerMarker) {
        const latlng = playerMarker.getLatLng();
        loadEnergyPoints(latlng.lat, latlng.lng);

        const { data: updatedPlayer } = await supabase
          .from('players')
          .select('*')
          .eq('telegram_id', user.id)
          .single();

        if (updatedPlayer) {
          updatePlayerUI(updatedPlayer.energy, updatedPlayer.energy_max, updatedPlayer.level);
        }
      }
    }, 60000);
  } else {
    alert("Геолокация не поддерживается на этом устройстве.");
  }
})();
