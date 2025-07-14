let map = L.map('map').setView([51.1605, 71.4704], 15);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
}).addTo(map);

let tg = window.Telegram.WebApp;
tg.expand();

const user = tg.initDataUnsafe.user;
if (user && user.username) {
  document.getElementById("username").innerText = user.username;
}

// Симуляция точки энергии
L.circle([51.1605, 71.4704], {
  color: 'green',
  fillColor: '#0f0',
  fillOpacity: 0.4,
  radius: 25
}).addTo(map);