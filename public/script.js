
let energy = 0;
let level = 1;
let spirit = 0;

const energyDisplay = document.getElementById("player-energy");
const spiritDisplay = document.getElementById("player-spirit");
const levelDisplay = document.getElementById("player-level");
const collectButton = document.getElementById("collect-button");

collectButton.addEventListener("click", () => {
    let gain = Math.floor(Math.random() * 21) + 10;
    energy += gain;
    energyDisplay.textContent = `⚡ ${energy}`;

    const sound = document.getElementById("energy-sound");
    sound.play();

    // Level-up logic
    let nextLevelRequirement = getNextLevelRequirement(level);
    if (energy >= nextLevelRequirement) {
        level++;
        levelDisplay.textContent = `Ур. ${level}`;
    }

    // Random SPIRIT drop
    if (Math.random() < 0.1) {
        spirit++;
        spiritDisplay.textContent = `💎 ${spirit}`;
    }
});

function getNextLevelRequirement(lvl) {
    if (lvl === 1) return 100;
    if (lvl <= 10) return lvl * 100 * 2;
    if (lvl <= 30) return lvl * 100 * 3;
    if (lvl <= 50) return lvl * 100 * 5;
    if (lvl <= 80) return lvl * 100 * 10;
    return lvl * 100 * 20;
}

function openModule(name) {
    const modal = document.getElementById("modal-container");
    const content = document.getElementById("modal-content");
    modal.style.display = "flex";
    content.innerHTML = `<h2>Загрузка модуля "${name}"...</h2>`;
    import(`./modules/${name}.js`)
        .then(module => {
            content.innerHTML = module.render ? module.render() : `<p>Модуль "${name}" загружен</p>`;
        })
        .catch(() => {
            content.innerHTML = `<p>Не удалось загрузить модуль "${name}"</p>`;
        });
}

function closeModal() {
    document.getElementById("modal-container").style.display = "none";
}

mapboxgl.accessToken = 'YOUR_MAPBOX_ACCESS_TOKEN'; // Замените на свой API-ключ

navigator.geolocation.getCurrentPosition(successLocation, errorLocation, { enableHighAccuracy: true });

function successLocation(position) {
    setupMap([position.coords.longitude, position.coords.latitude]);
}

function errorLocation() {
    setupMap([76.886, 43.238]); // Алматы по умолчанию
}

function setupMap(center) {
    const map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/mapbox/dark-v11',
        center: center,
        zoom: 14
    });

    // Призрак игрока
    const ghostEl = document.createElement('div');
    ghostEl.className = 'mapboxgl-marker-player';
    new mapboxgl.Marker(ghostEl).setLngLat(center).addTo(map);

    // Энергетическая точка (демо)
    const energyEl = document.createElement('div');
    energyEl.className = 'mapboxgl-marker-energy';
    new mapboxgl.Marker(energyEl).setLngLat([
        center[0] + 0.001,
        center[1] + 0.001
    ]).addTo(map);
}

navigator.geolocation.getCurrentPosition(successLeaflet, errorLeaflet, { enableHighAccuracy: true });

function successLeaflet(position) {
    initLeafletMap([position.coords.latitude, position.coords.longitude]);
}

function errorLeaflet() {
    initLeafletMap([43.238, 76.886]); // Алматы
}

function initLeafletMap(centerCoords) {
    const map = L.map('map').setView(centerCoords, 16);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Ghost avatar
    const ghostIcon = L.divIcon({
        className: 'ghost-avatar',
        iconSize: [40, 40]
    });
    L.marker(centerCoords, { icon: ghostIcon }).addTo(map);

    // Energy point
    const energyIcon = L.divIcon({
        className: 'energy-point',
        iconSize: [30, 30]
    });
    const energyCoords = [centerCoords[0] + 0.001, centerCoords[1] + 0.001];
    L.marker(energyCoords, { icon: energyIcon }).addTo(map);
}
