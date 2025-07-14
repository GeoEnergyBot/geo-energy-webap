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

// Supabase: проверка игрока
(async () => {
  if (!user) return;
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
  }
})();

// Инициализация карты
let map;
navigator.geolocation.getCurrentPosition((pos) => {
  const lat = pos.coords.latitude;
  const lng = pos.coords.longitude;

  map = L.map('map').setView([lat, lng], 16);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
  }).addTo(map);

  const marker = L.marker([lat, lng]).addTo(map)
    .bindPopup("Вы здесь!")
    .openPopup();
}, () => {
  alert("Не удалось получить геопозицию.");
});
