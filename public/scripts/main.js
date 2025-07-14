let map = L.map('map').setView([51.1605, 71.4704], 15);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19
}).addTo(map);

navigator.geolocation.getCurrentPosition(function(location) {
  const latlng = new L.LatLng(location.coords.latitude, location.coords.longitude);
  const marker = L.marker(latlng).addTo(map);
  map.setView(latlng, 16);
});

// === Telegram WebApp integration ===
let tg = window.Telegram.WebApp;
tg.expand();
let user = tg.initDataUnsafe?.user;

if (user) {
  const playerName = user.username || user.first_name || "Игрок";
  document.getElementById("player-name").innerText = playerName;

  // === Supabase запись ===
  fetch("https://ptkzsrlicfhufdnegwjl.supabase.co/rest/v1/players", {
    method: "POST",
    headers: {
      "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0a3pzcmxpY2ZodWZkbmVnd2psIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI0NzA3NjAsImV4cCI6MjA2ODA0Njc2MH0.eI0eF_imdgGWPLiUULTprh52Jo9P69WGpe3RbCg3Afo",
      "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0a3pzcmxpY2ZodWZkbmVnd2psIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI0NzA3NjAsImV4cCI6MjA2ODA0Njc2MH0.eI0eF_imdgGWPLiUULTprh52Jo9P69WGpe3RbCg3Afo",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      telegram_id: user.id,
      name: playerName,
      level: 1,
      energy: 0,
      spirit: 0
    })
  }).then(res => {
    if (!res.ok) console.error("Ошибка записи игрока");
  });
} else {
  console.log("Пользователь Telegram не найден");
}
