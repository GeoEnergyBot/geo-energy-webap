
const map = L.map('map').setView([51.505, -0.09], 15);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19
}).addTo(map);

const points = [
  { lat: 51.505, lon: -0.09, type: 'basic' },
  { lat: 51.506, lon: -0.0915, type: 'advanced' },
  { lat: 51.507, lon: -0.088, type: 'rare' }
];

for (const point of points) {
  const icon = L.divIcon({
    className: `energy-blob energy-${point.type}`,
    html: `<div class="energy-inner"></div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18]
  });

  L.marker([point.lat, point.lon], { icon }).addTo(map);
}
