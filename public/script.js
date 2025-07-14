const map = L.map('map').fitWorld();

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

function onLocationFound(e) {
  const radius = e.accuracy / 2;
  const playerIcon = L.icon({
    iconUrl: 'ghost_avatar.png',
    iconSize: [40, 40]
  });

  L.marker(e.latlng, { icon: playerIcon }).addTo(map)
    .bindPopup("Вы здесь").openPopup();

  L.circle(e.latlng, radius).addTo(map);
}

function onLocationError(e) {
  alert("Ошибка геопозиции: " + e.message);
}

map.on('locationfound', onLocationFound);
map.on('locationerror', onLocationError);
map.locate({ setView: true, maxZoom: 17 });

function openInventory() { alert("Инвентарь"); }
function openShop() { alert("Магазин"); }
function openRanking() { alert("Рейтинг"); }
function openBestiary() { alert("Бестиарий"); }
