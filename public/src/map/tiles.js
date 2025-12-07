
import { getDistanceKm } from '../utils.js';

/**
 * Базовые слои карты.
 * Используем кастомный стиль (например, MapTiler / другая платформа),
 * чтобы добиться мягких зелёно-золотых тонов как на концепт-арте.
 *
 * Вместо <your-style-id> подставь ID своего стиля, если он отличается от стандартного.
 */
const SPIRIT_MAP_KEY = 'jZemf5twGnSMvA6fdPqM';

export function buildBaseLayers(){
  // Основной «славянский» стиль
  const spiritStyle = L.tileLayer(
    `https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${SPIRIT_MAP_KEY}`,
    {
      maxZoom: 20,
      tileSize: 256,
      attribution:
        '&copy; MapTiler &copy; OpenStreetMap contributors'
    }
  );

  // Резервные слои (на всякий случай оставляем)
  const osm = L.tileLayer(
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    { maxZoom: 19, attribution:'&copy; OpenStreetMap contributors' }
  );

  return { spiritStyle, osm };
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
    if (km > 0.02){
      alert('Подойдите ближе (до 20м), чтобы войти в мир духов.');
      return;
    }
    if (typeof handler==='function') await handler();
  });
}
