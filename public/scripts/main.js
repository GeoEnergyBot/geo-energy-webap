import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// Supabase
const supabase = createClient(
  'https://ptkzsrlicfhufdnegwjl.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0a3pzcmxpY2ZodWZkbmVnd2psIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI0NzA3NjAsImV4cCI6MjA2ODA0Njc2MH0.eI0eF_imdgGWPLiUULTprh52Jo9P69WGpe3RbCg3Afo'
);

// Telegram SDK
let tg = window.Telegram.WebApp;
tg.expand();
const user = tg.initDataUnsafe.user;

document.getElementById("username").textContent = user?.first_name || user?.username || "Гость";
document.getElementById("avatar").src = user?.photo_url || "https://via.placeholder.com/40";

// Иконка призрака по уровню
function getGhostIconByLevel(level) {
  const index = Math.min(Math.floor((level - 1) / 10) + 1, 10);
  return `ghost_icons/ghost_level_${String(index).padStart(2, '0')}.png`;
}

let playerMarker;
let map;
let playerLevel = 1;
let energyMarkers = [];
let currentNearbyEnergy = null;

// Иконки энергии
const energyIcons = {
  normal: 'energy_blobs/normal_blob.png',
  advanced: 'energy_blobs/advanced_blob.png',
  rare: 'energy_blobs/rare_blob.png'
};

// Кнопка сбора
const collectButton = document.getElementById("collect-button");
collectButton.onclick = async () => {
  if (!currentNearbyEnergy) return;
  const { id } = currentNearbyEnergy;

  const { error } = await supabase.from('energy_points').update({
    collected_by: user.id,
    collected_at: new Date().toISOString()
  }).eq('id', id);

  if (!error) {
    map.removeLayer(currentNearbyEnergy.marker);
    collectButton.style.display = "none";
    currentNearbyEnergy = null;
    alert("Энергия собрана! ⚡");
  } else {
    console.error("❌ Ошибка при сборе:", error);
  }
};

// Загрузка точек энергии
async function loadEnergyPoints() {
  const { data, error } = await supabase
    .from('energy_points')
    .select('*')
    .is('collected_by', null);

  if (error) {
    console.error("❌ Ошибка при загрузке точек:", error);
    return;
  }

  if (!data || data.length === 0) {
    console.warn("⚠️ Нет доступных точек энергии");
    return;
  }

  console.log("✅ Загружено точек:", data.length);

  data.forEach(point => {
    const icon = L.icon({
      iconUrl: energyIcons[point.type] || energyIcons.normal,
      iconSize: [48, 48],
      iconAnchor: [24, 24]
    });
    const marker = L.marker([point.lat, point.lng], { icon }).addTo(map);
    point.marker = marker;
    energyMarkers.push(point);
  });
}

// Основной поток: создание игрока, карта, позиция, энергия
(async () => {
  if (user) {
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('telegram_id', user.id)
      .single();

    if (!data) {
      const { error: insertError } = await supabase.from('players').insert([{
        telegram_id: user.id,
        username: user.username,
        first_name: user.first_name,
        avatar_url: user.photo_url
      }]);

      if (insertError) {
        console.error("❌ Ошибка при создании игрока:", insertError);
      }
    } else {
      playerLevel = data.level || 1;
    }
  }

  const ghostIcon = L.icon({
    iconUrl: getGhostIconByLevel(playerLevel),
    iconSize: [48, 48],
    iconAnchor: [24, 24],
    popupAnchor: [0, -24]
  });

  navigator.geolocation.watchPosition((pos) => {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;

    // Карта
    if (!map) {
      map = L.map('map').setView([lat, lng], 16);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map);

      // После инициализации карты — загружаем точки
      loadEnergyPoints();
    }

    // Призрак игрока
    if (!playerMarker) {
      playerMarker = L.marker([lat, lng], { icon: ghostIcon }).addTo(map)
        .bindPopup("Вы здесь")
        .openPopup();
    } else {
      playerMarker.setLatLng([lat, lng]);
    }

    // Проверка близости к точке
    currentNearbyEnergy = null;
    energyMarkers.forEach(point => {
      const dist = map.distance([lat, lng], [point.lat, point.lng]);
      if (dist < 25) {
        currentNearbyEnergy = point;
      }
    });

    collectButton.style.display = currentNearbyEnergy ? "block" : "none";
  }, (err) => {
    alert("Ошибка геопозиции.");
    console.error("Геолокация недоступна:", err);
  });
})();
