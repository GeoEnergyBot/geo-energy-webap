
import { getDistanceKm } from '../utils.js';

export function buildBaseLayers(){
  const cartoDark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{ attribution:'&copy; OpenStreetMap &copy; CARTO', subdomains:'abcd', maxZoom:20 });
  const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{ maxZoom:19, attribution:'&copy; OpenStreetMap contributors' });
  const esriSat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{ maxZoom:20 });
  return { cartoDark, osm, esriSat };
}

export function spawnArEntryNear(map, lat, lng){
  const dLat = (Math.random()-0.5)*0.002;
  const dLng = (Math.random()-0.5)*0.002;
  const m = L.marker([lat+dLat, lng+dLng], { title:'AR точка' }).addTo(map);
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
