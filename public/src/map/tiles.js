import { getDistanceKm } from '../utils.js';

export function buildBaseLayers(){
  const cartoDark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { attribution: '&copy; OpenStreetMap &copy; CARTO', subdomains: 'abcd', maxZoom: 20 });
  const osm      = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',            { attribution: '&copy; OpenStreetMap contributors', maxZoom: 19 });
  const esriSat  = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Tiles &copy; Esri' });
  return { cartoDark, osm, esriSat };
}

export function spawnArEntryNear(map, lat, lng){
  const meters = 15;
  const dLng = (meters / (111_320 * Math.cos(lat * Math.PI / 180)));
  const icon = L.divIcon({ html:'<div style="width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background: radial-gradient(circle at 30% 30%, rgba(255,255,255,.9), rgba(0,200,255,.35));border:2px solid rgba(255,255,255,.6);box-shadow:0 8px 22px rgba(0,0,0,.45);font-size:26px;">👾</div>', className:'', iconSize:[44,44], iconAnchor:[22,22] });
  const m = L.marker([lat, lng + dLng], { icon }).addTo(map).bindPopup('AR-существо: подойдите ближе и нажмите');
  return m;
}

export function setArEntryHandler(marker, playerMarker, handler){
  marker.on('click', async ()=>{
    const p = playerMarker.getLatLng();
    const m = marker.getLatLng();
    const km = getDistanceKm(p.lat,p.lng,m.lat,m.lng);
    if (km > 0.02){ alert('Подойдите ближе (до 20м), чтобы включить AR.'); return; }
    if (typeof handler==='function') await handler();
  });
}