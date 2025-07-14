
const tg = window.Telegram.WebApp;
tg.expand();

let map = L.map('map').setView([51.1605, 71.4704], 15);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19
}).addTo(map);

const user = tg.initDataUnsafe.user;
document.getElementById('username').innerText = user.username || user.first_name;

const collectBtn = document.getElementById("collectBtn");
let energy = 0;
let userLat = 0, userLon = 0;

const energySpan = document.getElementById("energy");

let sound = new Audio("assets/sounds/energy.mp3");

function distance(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

const energyPoints = [
    { lat: 51.1607, lon: 71.4700 },
    { lat: 51.1612, lon: 71.4715 }
];

energyPoints.forEach(pt => {
    const el = L.divIcon({
        className: 'custom-div-icon',
        html: "<div class='energy-blob'></div>",
        iconSize: [30, 30],
        iconAnchor: [15, 15]
    });
    L.marker([pt.lat, pt.lon], { icon: el }).addTo(map);
});

let playerMarker = null;

map.locate({ watch: true, setView: true, maxZoom: 17 });
map.on('locationfound', e => {
    userLat = e.latitude;
    userLon = e.longitude;
    if (!playerMarker) {
        playerMarker = L.marker(e.latlng).addTo(map);
    } else {
        playerMarker.setLatLng(e.latlng);
    }
    checkNearby();
});

function checkNearby() {
    for (let pt of energyPoints) {
        const d = distance(userLat, userLon, pt.lat, pt.lon);
        if (d < 50) {
            collectBtn.style.display = 'block';
            return;
        }
    }
    collectBtn.style.display = 'none';
}

collectBtn.onclick = () => {
    energy += Math.floor(Math.random() * 20) + 10;
    energySpan.innerText = energy;
    sound.play();
    collectBtn.style.display = 'none';
};

function openInventory() { alert("Открыт инвентарь"); }
function openShop() { alert("Открыт магазин"); }
function openRanking() { alert("Открыт рейтинг"); }
function openBestiary() { alert("Открыт бестиарий"); }
