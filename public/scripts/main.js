
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabase = createClient(
  'https://ptkzsrlicfhufdnegwjl.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0a3pzcmxpY2ZodWZkbmVnd2psIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI0NzA3NjAsImV4cCI6MjA2ODA0Njc2MH0.eI0eF_imdgGWPLiUULTprh52Jo9P69WGpe3RbCg3Afo'
);

let tg = window.Telegram.WebApp;
tg.expand();
const user = tg.initDataUnsafe.user;

document.getElementById("top-name").textContent = user?.first_name || user?.username || "Гость";
document.getElementById("top-avatar").src = user?.photo_url || "https://cdn-icons-png.flaticon.com/512/9131/9131529.png";

let map, playerMarker;

(async () => {
  let level = 1;
  let energy = 0;
  let energyMax = 1000;

  if (user) {
    const { data } = await supabase
      .from('players')
      .select('*')
      .eq('telegram_id', user.id)
      .single();

    if (data) {
      level = data.level || 1;
      energy = data.energy || 0;
      energyMax = data.energy_max || 1000;
    }

    document.getElementById("top-level").textContent = level;
    const percent = Math.min((energy / energyMax) * 100, 100);
    document.getElementById("top-energy-fill").style.width = percent + "%";
    document.getElementById("top-energy-text").textContent = `${energy} / ${energyMax}`;
  }

  navigator.geolocation.getCurrentPosition((pos) => {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;

    map = L.map('map').setView([lat, lng], 16);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    playerMarker = L.marker([lat, lng]).addTo(map)
      .bindPopup("Вы здесь")
      .openPopup();
  }, (err) => {
    alert("Ошибка геолокации: " + err.message);
    console.error(err);
  });
})();
