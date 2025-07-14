
const tg = window.Telegram.WebApp;
tg.expand();
const user = tg.initDataUnsafe.user;
document.getElementById("username").innerText = user.username || user.first_name;

let map = L.map('map').setView([51.16, 71.47], 15);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19
}).addTo(map);

navigator.geolocation.watchPosition((pos) => {
  const { latitude, longitude } = pos.coords;
  L.marker([latitude, longitude]).addTo(map);
}, (err) => alert("Ошибка геолокации: " + err.message));
