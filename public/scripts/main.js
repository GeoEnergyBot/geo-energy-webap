let map = L.map('map').setView([51.1605, 71.4704], 15);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19
}).addTo(map);

navigator.geolocation.getCurrentPosition(function(location) {
  const latlng = new L.LatLng(location.coords.latitude, location.coords.longitude);
  const marker = L.marker(latlng).addTo(map);
  map.setView(latlng, 16);
});