import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

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

  // Инициализируем карту и отслеживаем перемещение
  navigator.geolocation.watchPosition((pos) => {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;

    console.log("Игрок на позиции:", lat, lng);

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

  }, () => {
    alert("Ошибка: не удалось получить геопозицию.");
  });
})();

// === Загрузка и отображение точек энергии ===
async function loadEnergyPoints(centerLat, centerLng) {
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
    const result = await response.json();
    console.log("Ответ от Supabase функции:", result);

    if (result.success && result.points) {
      result.points.forEach(point => {
        const icon = L.divIcon({
          className: 'pulsing-energy',
          html: `<img src="${getEnergyIcon(point.type)}" width="30" height="30">`,
          iconSize: [30, 30],
          iconAnchor: [15, 15]
        });

        const marker = L.marker([point.lat, point.lng], { icon }).addTo(map);
        marker.on('click', () => {
          alert('Энергия собрана!');
          map.removeLayer(marker);
        });
      });
    } else {
      console.warn("Точек нет или формат неверный:", result);
    }
  } catch (error) {
    console.error('Ошибка при загрузке энерготочек:', error);
  }
}

function getEnergyIcon(type) {
  switch (type) {
    case 'rare': return 'https://cdn-icons-png.flaticon.com/512/1704/1704425.png';
    case 'advanced': return 'https://cdn-icons-png.flaticon.com/512/4276/4276722.png';
    default: return 'https://cdn-icons-png.flaticon.com/512/414/414927.png';
  }
}
