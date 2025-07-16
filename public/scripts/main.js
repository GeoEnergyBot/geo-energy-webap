import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// Supabase client
const supabase = createClient(
  'https://ptkzsrlicfhufdnegwjl.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0a3pzcmxpY2ZodWZkbmVnd2psIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI0NzA3NjAsImV4cCI6MjA2ODA0Njc2MH0.eI0eF_imdgGWPLiUULTprh52Jo9P69WGpe3RbCg3Afo'
);

// Telegram SDK
let tg = window.Telegram.WebApp;
tg.expand();
const user = tg.initDataUnsafe.user;

// Обновление UI: имя, аватар
document.getElementById("username").textContent = user?.first_name || user?.username || "Гость";
document.getElementById("avatar").src = user?.photo_url || "https://cdn-icons-png.flaticon.com/512/9131/9131529.png";

// Получение иконки игрока
function getGhostIconByLevel(level) {
  const index = Math.min(Math.floor((level - 1) / 10) + 1, 10);
  return `ghost_icons/ghost_level_${String(index).padStart(2, '0')}.png`;
}

let playerMarker, map, playerLat = 0, playerLng = 0;

// Главный блок
(async () => {
  let player = {
    level: 1,
    energy: 0
  };

  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('telegram_id', user.id)
    .single();

  if (!data) {
    await supabase.from('players').insert([{
      telegram_id: user.id,
      username: user.username,
      first_name: user.first_name,
      avatar_url: user.photo_url,
      level: 1,
      energy: 0
    }]);
  } else {
    player.level = data.level || 1;
    player.energy = data.energy || 0;
  }

  updateUI(player.level, player.energy);

  const ghostIcon = L.icon({
    iconUrl: getGhostIconByLevel(player.level),
    iconSize: [48, 48],
    iconAnchor: [24, 24],
    popupAnchor: [0, -24]
  });

  navigator.geolocation.getCurrentPosition((pos) => {
    playerLat = pos.coords.latitude;
    playerLng = pos.coords.longitude;

    if (!map) {
      map = L.map('map').setView([playerLat, playerLng], 16);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map);
    }

    if (!playerMarker) {
      playerMarker = L.marker([playerLat, playerLng], { icon: ghostIcon }).addTo(map)
        .bindPopup("Вы здесь")
        .openPopup();
    } else {
      playerMarker.setLatLng([playerLat, playerLng]);
    }

    loadEnergyPoints(playerLat, playerLng, player);
  }, (error) => {
    alert("Ошибка геолокации: " + error.message);
  });
})();

// Загрузка и отображение точек энергии
async function loadEnergyPoints(centerLat, centerLng, player) {
  try {
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
    if (result.success && result.points) {
      result.points
        .filter(point => !point.collected_by || point.collected_by !== user.id.toString())
        .forEach(point => {
          const icon = L.icon({
            iconUrl: getEnergyIcon(point.type),
            iconSize: [30, 30],
            iconAnchor: [15, 15]
          });

          const marker = L.marker([point.lat, point.lng], { icon }).addTo(map);
          marker.on('click', async () => {
            const distance = getDistance(centerLat, centerLng, point.lat, point.lng);
            if (distance <= 0.02) {
              map.removeLayer(marker);
              await supabase
                .from('energy_points')
                .update({
                  collected_by: user.id.toString(),
                  collected_at: new Date().toISOString()
                })
                .eq('id', point.id);

              const earnedEnergy = getEnergyReward(point.type);
              const newEnergy = player.energy + earnedEnergy;
              const newLevel = calculateLevel(newEnergy);
              await supabase.from('players').update({
                energy: newEnergy,
                level: newLevel
              }).eq('telegram_id', user.id);

              player.energy = newEnergy;
              player.level = newLevel;

              updateUI(player.level, player.energy);
              alert(`⚡ Получено ${earnedEnergy} энергии!`);
            } else {
              alert("🚫 Подойдите ближе к точке (до 20 м), чтобы собрать энергию.");
            }
          });
        });
    }
  } catch (error) {
    alert("Ошибка при загрузке точек: " + error.message);
  }
}

// Тип иконки
function getEnergyIcon(type) {
  switch (type) {
    case 'rare': return 'https://cdn-icons-png.flaticon.com/512/1704/1704425.png';
    case 'advanced': return 'https://cdn-icons-png.flaticon.com/512/4276/4276722.png';
    default: return 'https://cdn-icons-png.flaticon.com/512/414/414927.png';
  }
}

// Энергия от типа точки
function getEnergyReward(type) {
  switch (type) {
    case 'rare': return Math.floor(Math.random() * 150) + 350;
    case 'advanced': return Math.floor(Math.random() * 200) + 150;
    default: return Math.floor(Math.random() * 70) + 80;
  }
}

// Прогресс и уровень
function calculateLevel(energy) {
  let level = 1;
  while (energy >= getXpForLevel(level + 1)) level++;
  return level;
}

function getXpForLevel(level) {
  const step = Math.floor((level - 1) / 10);
  return level * (1000 + step * 1000);
}

// UI: прогресс-бар, значения
function updateUI(level, energy) {
  const nextLevelXp = getXpForLevel(level + 1);
  const percent = Math.min(100, Math.floor((energy / nextLevelXp) * 100));

  document.getElementById("level-value").textContent = level;
  document.getElementById("energy-value").textContent = energy;
  document.getElementById("energy-max").textContent = nextLevelXp;
  document.getElementById("energy-bar-fill").style.width = percent + "%";
}

// Расстояние
function getDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
