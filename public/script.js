
let tg = window.Telegram.WebApp;
tg.expand();
const user = tg.initDataUnsafe.user;
document.getElementById("username").innerText = user.username || user.first_name;

let map = L.map('map').setView([51.1605, 71.4704], 15);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19
}).addTo(map);

// Energy points with glowing green blob markers
const energyPoints = [
  {lat: 51.1607, lon: 71.4700},
  {lat: 51.1610, lon: 71.4712}
];

energyPoints.forEach(pt => {
  let divIcon = L.divIcon({
    className: 'energy-point',
    html: '<div style="width:30px;height:30px;border-radius:50%;background:radial-gradient(circle, rgba(0,255,0,0.6) 0%, rgba(0,255,0,0) 70%);"></div>',
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  });
  L.marker([pt.lat, pt.lon], {icon: divIcon}).addTo(map);
});

function home() {
  alert("Домашняя страница");
}
function inventory() {
  alert("Инвентарь");
}
function settings() {
  alert("Настройки");
}
