const supabase = supabase.createClient(
  "https://ptkzsrlicfhufdnegwjl.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0a3pzcmxpY2ZodWZkbmVnd2psIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI0NzA3NjAsImV4cCI6MjA2ODA0Njc2MH0.eI0eF_imdgGWPLiUULTprh52Jo9P69WGpe3RbCg3Afo"
);

let tg = window.Telegram.WebApp;
tg.expand();
const username = tg.initDataUnsafe.user?.username || "Игрок";
document.getElementById("username").innerText = username;

// Карта
let map = L.map('map').setView([51.1605, 71.4704], 15);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

// Точки энергии
const energyPoints = [
  {lat: 51.1607, lon: 71.4700},
  {lat: 51.1610, lon: 71.4712}
];

energyPoints.forEach(pt => {
  const icon = L.divIcon({
    className: 'energy-blob',
    html: '<div style="width:30px;height:30px;border-radius:50%;background:rgba(0,255,0,0.4);box-shadow:0 0 10px #0f0;"></div>',
    iconSize: [30, 30]
  });
  L.marker([pt.lat, pt.lon], {icon}).addTo(map);
});

function openTab(name) {
  document.getElementById("modal").style.display = "flex";
  let content = document.getElementById("modal-content");

  if (name === "shop") content.innerHTML = "<h2>Магазин</h2><ul><li>Эликсир ⚡ (5 энергии)</li><li>Шлем призрака 🎭</li></ul>";
  if (name === "leaderboard") {
    content.innerHTML = "<h2>Загрузка рейтинга...</h2>";
    loadLeaderboard();
  }
  if (name === "inventory") {
    content.innerHTML = "<h2>Инвентарь</h2><p>Сила: 10<br>Энергия: 15<br>Здоровье: 20</p><p>🎖️ Артефакты: Амулет духа</p>";
  }
  if (name === "bestiary") {
    content.innerHTML = "<h2>Бестиарий</h2><p>👻 Малый дух<br>👻 Туманник</p>";
  }
}

async function loadLeaderboard() {
  const { data, error } = await supabase.from('players').select('*').order('energy', {ascending: false}).limit(100);
  const content = document.getElementById("modal-content");
  if (error) return content.innerHTML = "<p>Ошибка загрузки рейтинга</p>";
  let html = "<h2>ТОП 100 игроков</h2><ol>";
  data.forEach(p => html += `<li>${p.username || "Игрок"} — ${p.energy}⚡</li>`);
  html += "</ol>";
  content.innerHTML = html;
}

function closeModal() {
  document.getElementById("modal").style.display = "none";
}
