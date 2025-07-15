
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const supabaseUrl = 'https://ptkzsrlicfhufdnegwjl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0a3pzcmxpY2ZodWZkbmVnd2psIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI0NzA3NjAsImV4cCI6MjA2ODA0Njc2MH0.eI0eF_imdgGWPLiUULTprh52Jo9P69WGpe3RbCg3Afo';
const supabase = createClient(supabaseUrl, supabaseKey);

let tg = window.Telegram.WebApp;
tg.expand();
const user = tg.initDataUnsafe.user;
document.getElementById("username").textContent = user?.first_name || user?.username;
document.getElementById("avatar").src = user?.photo_url || "https://via.placeholder.com/40";

// Leaflet init
const map = L.map('map').setView([51.1605, 71.4704], 15);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

// Игрок
let playerMarker = null;
let playerLevel = 1;
let energyMarkers = [];

const ghostIcon = (level) => {
  const set = Math.floor((level - 1) / 10) + 1;
  return L.icon({
    iconUrl: `/ghost_icons/ghost_level_${set.toString().padStart(2, '0')}.png`,
    iconSize: [48, 48],
    iconAnchor: [24, 24]
  });
};

// Энергетические точки
const energyIcons = {
  normal: '/energy_blobs/normal_blob.png',
  advanced: '/energy_blobs/advanced_blob.png',
  rare: '/energy_blobs/rare_blob.png'
};

// Кнопка сбора
const collectButton = document.getElementById("collect-button");
let currentNearbyEnergy = null;

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
    alert("Энергия собрана! 🔋");
  }
};

// Загрузка точек энергии
async function loadEnergyPoints() {
  const { data } = await supabase
    .from('energy_points')
    .select('*')
    .is('collected_by', null);

  data.forEach(point => {
    const icon = L.icon({
      iconUrl: energyIcons[point.type],
      iconSize: [48, 48],
      iconAnchor: [24, 24]
    });
    const marker = L.marker([point.lat, point.lng], { icon }).addTo(map);
    point.marker = marker;
    energyMarkers.push(point);
  });
}

// Геолокация игрока
navigator.geolocation.watchPosition(async (pos) => {
  const lat = pos.coords.latitude;
  const lng = pos.coords.longitude;

  if (!playerMarker) {
    playerMarker = L.marker([lat, lng], { icon: ghostIcon(playerLevel) }).addTo(map);
  } else {
    playerMarker.setLatLng([lat, lng]);
  }

  // Проверка близости к точкам
  currentNearbyEnergy = null;
  energyMarkers.forEach(point => {
    const dist = map.distance([lat, lng], [point.lat, point.lng]);
    if (dist < 20) {
      currentNearbyEnergy = point;
    }
  });

  collectButton.style.display = currentNearbyEnergy ? "block" : "none";
});

// Загрузка данных
(async () => {
  await loadEnergyPoints();
})();
