
let tg = window.Telegram.WebApp;
tg.ready();

if (tg.initDataUnsafe.user) {
  const username = tg.initDataUnsafe.user.first_name || 'Игрок';
  document.getElementById('username').textContent = username;
}

// Инициализация карты
let map = L.map('map').setView([51.1605, 71.4704], 16); // временная позиция

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OSM',
  maxZoom: 19
}).addTo(map);

// Геолокация
function onLocationFound(e) {
  let radius = e.accuracy;
  let marker = L.marker(e.latlng).addTo(map)
    .bindPopup("Вы здесь").openPopup();

  L.circle(e.latlng, radius).addTo(map);
  map.setView(e.latlng, 17);
}

function onLocationError(e) {
  alert("Ошибка геолокации: " + e.message);
}

map.on('locationfound', onLocationFound);
map.on('locationerror', onLocationError);

map.locate({setView: true, maxZoom: 16, watch: true});
