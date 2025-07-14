
let map = L.map('map').setView([43.2394, 76.9453], 16);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OSM'
}).addTo(map);

// Игрок
let ghostIcon = L.icon({
    iconUrl: 'https://i.ibb.co/YX02Z3J/ghost-icon.png',
    iconSize: [48, 48],
    iconAnchor: [24, 24]
});
let player = L.marker([43.2394, 76.9453], { icon: ghostIcon }).addTo(map);

// Энергетические точки
function createEnergyPoint(lat, lng, energyValue) {
    const html = `
    <div style="
        width: 60px;
        height: 60px;
        background: radial-gradient(circle, rgba(255,0,102,0.8), rgba(0,0,255,0));
        border-radius: 50%;
        animation: pulse 2s infinite;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: 12px;
    ">${energyValue}/100</div>`;

    const icon = L.divIcon({
        className: 'energy-point',
        html: html,
        iconSize: [60, 60],
        iconAnchor: [30, 30]
    });

    L.marker([lat, lng], { icon }).addTo(map);
}

// Добавим 3 точки
createEnergyPoint(43.2402, 76.9455, 25);
createEnergyPoint(43.2385, 76.9441, 12);
createEnergyPoint(43.2390, 76.9470, 33);

// Анимация
const style = document.createElement('style');
style.innerHTML = `
@keyframes pulse {
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.2); opacity: 0.6; }
  100% { transform: scale(1); opacity: 1; }
}`;
document.head.appendChild(style);
