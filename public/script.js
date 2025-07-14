let map = L.map('map').fitWorld();

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19
}).addTo(map);

map.locate({setView: true, maxZoom: 16});

function onLocationFound(e) {
  let radius = e.accuracy / 2;
  L.marker(e.latlng).addTo(map)
    .bindPopup("Вы здесь").openPopup();
  L.circle(e.latlng, radius).addTo(map);
  spawnEnergyPoints(e.latlng);
}

map.on('locationfound', onLocationFound);

function spawnEnergyPoints(playerLatLng) {
  const typeConfigs = [
    { count: [2, 5], radius: 500, color: "green" },
    { count: [1, 2], radius: 700, color: "blue" },
    { count: [1, 1], radius: 2000, color: "purple" }
  ];

  typeConfigs.forEach(config => {
    const count = Math.floor(Math.random() * (config.count[1] - config.count[0] + 1)) + config.count[0];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * 2 * Math.PI;
      const distance = Math.random() * config.radius;
      const dx = distance * Math.cos(angle) / 111320;
      const dy = distance * Math.sin(angle) / 110540;
      const latlng = [playerLatLng.lat + dy, playerLatLng.lng + dx];
      L.circleMarker(latlng, { color: config.color }).addTo(map).bindPopup("Энергия");
    }
  });
}