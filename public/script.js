
let map = L.map('map').fitWorld();
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 18
}).addTo(map);

let userMarker = null;

function onLocationFound(e) {
  const radius = e.accuracy / 2;
  if (userMarker) {
    userMarker.setLatLng(e.latlng);
  } else {
    userMarker = L.marker(e.latlng).addTo(map)
      .bindPopup("Ты здесь").openPopup();
  }
  L.circle(e.latlng, radius).addTo(map);
}

function onLocationError(e) {
  alert("Ошибка определения местоположения: " + e.message);
}

map.on('locationfound', onLocationFound);
map.on('locationerror', onLocationError);

map.locate({setView: true, maxZoom: 16, watch: true});
