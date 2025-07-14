
let map = L.map('map').fitWorld();

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

function onLocationFound(e) {
  let radius = e.accuracy / 2;

  L.marker(e.latlng).addTo(map)
    .bindPopup("Вы здесь").openPopup();

  L.circle(e.latlng, radius).addTo(map);

  generateEnergyPoints(e.latlng);
}

function generateEnergyPoints(center) {
  const points = 3;
  for (let i = 0; i < points; i++) {
    const offsetLat = (Math.random() - 0.5) * 0.01;
    const offsetLng = (Math.random() - 0.5) * 0.01;
    const lat = center.lat + offsetLat;
    const lng = center.lng + offsetLng;
    let marker = L.circle([lat, lng], {
      radius: 15,
      color: 'green',
      fillColor: 'lime',
      fillOpacity: 0.5
    }).addTo(map).on('click', () => {
      collectEnergy(marker);
    });
  }
}

function collectEnergy(marker) {
  marker.remove();
  const gain = Math.floor(10 + Math.random() * 20);
  let progress = document.getElementById('energyProgress');
  progress.value = Math.min(100, progress.value + gain);
  const sound = new Audio('energy.mp3');
  sound.play();
  alert("Вы собрали " + gain + " ⚡ энергии!");
}

function openTab(tab) {
  alert("Открыт раздел: " + tab);
}

map.on('locationfound', onLocationFound);
map.locate({setView: true, maxZoom: 16});
