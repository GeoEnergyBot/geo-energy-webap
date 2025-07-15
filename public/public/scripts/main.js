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

// Отображение имени и аватара
document.getElementById("username").textContent = user?.first_name || user?.username || "Гость";
document.getElementById("avatar").src = user?.photo_url || "https://cdn-icons-png.flaticon.com/512/9131/9131529.png";

// Определим иконку игрока по уровню
function getGhostIconByLevel(level) {
  const index = Math.min(Math.floor((level - 1) / 10) + 1, 10);
  return `ghost_icons/ghost_level_${String(index).padStart(2, '0')}.png`;
}

let playerMarker;
let map;

// Получаем игрока и его уровень
(async () => {
  let level = 1;
  if (user) {
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
        avatar_url: user.photo_url
      }]);
    } else {
      level = data.level || 1;
    }
  }

  const ghostIcon = L.icon({
    iconUrl: getGhostIconByLevel(level),
    iconSize: [48, 48],
    iconAnchor: [24, 24],
    popupAnchor: [0, -24]
  });

  navigator.geolocation.getCurrentPosition((pos) => {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;

    console.log("Игрок на позиции:", lat, lng);
    alert("📍 Геопозиция получена: " + lat.toFixed(5) + ", " + lng.toFixed(5));

    if (!map) {
      map = L.map('map').setView([lat, lng], 16);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map);
    }

    if (!playerMarker) {
      playerMarker = L.marker([lat, lng], { icon: ghostIcon }).addTo(map)
        .bindPopup("Вы здесь")
        .openPopup();
    } else {
      playerMarker.setLatLng([lat, lng]);
    }

    loadEnergyPoints(lat, lng);
  }, (error) => {
    alert("Ошибка геолокации: " + error.message);
    console.error("GeoError:", error);
  });
})();

// Загрузка и отображение точек энергии
async function loadEnergyPoints(centerLat, centerLng) {
  alert("Энерготочки загружаются…");
  console.log("Загрузка энерготочек для:", centerLat, centerLng);
  try {
    const response = await fetch('https://ptkzsrlicfhufdnegwjl.functions.supabase.co/generate-points', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0a3pzcmxpY2ZodWZkbmVnd2psIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI0NzA3NjAsImV4cCI6MjA2ODA0Njc2MH0.eI0eF_imdgGWPLiUULTprh52Jo9P69WGpe3RbCg3Afo'
      },
      body: JSON.stringify({ center_lat: centerLat, center_lng: centerLng })
    });

    if (!response.ok) {
      alert("❌ Supabase вернул ошибку: " + response.status);
      return;
    }

    const result = await response.json();
    console.log("Ответ от Supabase функции:", result);

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
              alert('⚡ Энергия собрана!');
              map.removeLayer(marker);
              await supabase
                .from('energy_points')
                .update({
                  collected_by: user.id.toString(),
                  collected_at: new Date().toISOString()
                })
                .eq('id', point.id);
            } else {
              alert("🚫 Подойдите ближе к точке (до 20 м), чтобы собрать энергию.");
            }
          });
        });
    } else {
      console.warn("⚠ Точек нет или формат неверный:", result);
    }
  } catch (error) {
    console.error('❌ Ошибка при загрузке энерготочек:', error);
    alert("Ошибка при запросе точек энергии: " + error.message);
  }
}

function getEnergyIcon(type) {
  switch (type) {
    case 'rare': return 'https://cdn-icons-png.flaticon.com/512/1704/1704425.png';
    case 'advanced': return 'https://cdn-icons-png.flaticon.com/512/4276/4276722.png';
    default: return 'https://cdn-icons-png.flaticon.com/512/414/414927.png';
  }
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
