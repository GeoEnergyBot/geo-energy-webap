
const tg = window.Telegram.WebApp;
let username = tg.initDataUnsafe?.user?.first_name || "Игрок";
document.getElementById("topbar").innerHTML += `<span id="username">${username}</span>`;

// Сохраняем в localStorage и отправим в Supabase
localStorage.setItem("username", username);
// Дополнительно можно отправить на сервер или базу данных

let map = L.map('map').setView([51.1605, 71.4704], 15);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19
}).addTo(map);

navigator.geolocation.getCurrentPosition(function(location) {
  const latlng = new L.LatLng(location.coords.latitude, location.coords.longitude);
  const marker = L.marker(latlng).addTo(map);
  map.setView(latlng, 16);
});