import { getDistanceKm } from '../utils.js';
import { openGyroChase } from '../ar/gyroChase.js';

let __arBusy = false;

export function buildBaseLayers() {
  const cartoDark = L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    { attribution: '&copy; OpenStreetMap &copy; CARTO', subdomains: 'abcd', maxZoom: 20 }
  );
  const osm = L.tileLayer(
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }
  );
  const esriSat = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { maxZoom: 19, attribution: 'Tiles &copy; Esri' }
  );
  return { cartoDark, osm, esriSat };
}

let currentArMarker = null;

export function spawnArEntryNear(map, lat, lng, replace=false) {
  const meters = 15;
  const dLng = (meters / (111320 * Math.cos(lat * Math.PI / 180)));
  const sLat = lat, sLng = lng + dLng;

  if (replace && currentArMarker) {
    map.removeLayer(currentArMarker);
    currentArMarker = null;
  }

  const icon = L.divIcon({
    html: `<div style="
      width:44px;height:44px;border-radius:50%;
      display:grid;place-items:center;
      background: radial-gradient(circle at 30% 30%, rgba(255,255,255,.9), rgba(0,200,255,.35));
      border:2px solid rgba(255,255,255,.6);
      box-shadow:0 8px 22px rgba(0,0,0,.45);
      font-size:26px;">👾</div>`,
    className: '',
    iconSize: [44, 44],
    iconAnchor: [22, 22]
  });

  currentArMarker = L.marker([sLat, sLng], { icon })
    .addTo(map)
    .bindPopup('AR-существо: подойдите ближе и нажмите');

  return currentArMarker;
}

export function setArEntryHandler(arMarker, playerMarker) {
  if (!arMarker) return;
  arMarker.off('click');
  arMarker.on('click', async () => {
    if (!playerMarker) return;
    const p = playerMarker.getLatLng();
    const m = arMarker.getLatLng();
    const km = getDistanceKm(p.lat, p.lng, m.lat, m.lng);
    if (km > 0.02) { alert('Подойдите ближе (до 20 м), чтобы включить AR.'); return; }
    if (__arBusy) return; __arBusy = true
    try {
      await openGyroChase('common'); // можно подставлять 'advanced'/'rare' по логике игры
    } finally {
      __arBusy = false
    }
  });
}
