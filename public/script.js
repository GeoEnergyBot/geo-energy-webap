
const tg = window.Telegram.WebApp;
tg.expand();
const user = tg.initDataUnsafe?.user || {};
const userId = user.id;
const username = user.username || user.first_name || "Игрок";
document.getElementById("username").textContent = username;

let energy = 0;
const energyText = document.getElementById("energyDisplay");
const collectBtn = document.getElementById("collectBtn");

let map = L.map("map").setView([51.1605, 71.4704], 15);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19
}).addTo(map);

const ghostIcon = L.icon({
  iconUrl: "ghost_avatar.png",
  iconSize: [40, 40],
  iconAnchor: [20, 20]
});

let userMarker;
navigator.geolocation.watchPosition(
  (pos) => {
    const latlng = [pos.coords.latitude, pos.coords.longitude];
    if (!userMarker) {
      userMarker = L.marker(latlng, { icon: ghostIcon }).addTo(map);
      map.setView(latlng, 16);
    } else {
      userMarker.setLatLng(latlng);
    }
    checkEnergyProximity(latlng);
  },
  (err) => alert("Ошибка геолокации: " + err.message),
  { enableHighAccuracy: true }
);

const energyPoints = [
  { lat: 51.1609, lon: 71.4695, collected: false },
  { lat: 51.1612, lon: 71.4709, collected: false }
];

energyPoints.forEach(p => {
  p.marker = L.circleMarker([p.lat, p.lon], {
    radius: 20,
    color: "green",
    fillOpacity: 0.4
  }).addTo(map);
});

function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function checkEnergyProximity([lat, lon]) {
  let nearby = false;
  energyPoints.forEach(p => {
    if (!p.collected && getDistance(lat, lon, p.lat, p.lon) < 50) {
      nearby = true;
    }
  });
  collectBtn.style.display = nearby ? "block" : "none";
}

collectBtn.onclick = () => {
  const [lat, lon] = userMarker.getLatLng();
  let collected = false;
  energyPoints.forEach(p => {
    if (!p.collected && getDistance(lat, lon, p.lat, p.lon) < 50) {
      p.collected = true;
      map.removeLayer(p.marker);
      collected = true;
    }
  });
  if (collected) {
    energy += Math.floor(Math.random() * 21) + 10;
    energyText.textContent = `⚡ ${energy}`;
    collectBtn.style.display = "none";
    new Audio("energy.mp3").play();
  }
};
