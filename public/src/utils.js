import { GHOST_ICON_BASES } from './env.js';

// Сгенерировать путь "base/ghost_###.png"
function ghostPath(base, level) {
  const lvl = Math.max(1, Math.min(100, Math.floor(level || 1)));
  return `${base}/ghost_${String(lvl).padStart(3, '0')}.png`;
}

// Асинхронно находим первый доступный URL спрайта
export function resolveGhostUrl(level) {
  const bases = Array.isArray(GHOST_ICON_BASES) ? GHOST_ICON_BASES : ['ghost_icons', 'assets/ghosts'];
  return new Promise((resolve) => {
    let i = 0;
    const tryNext = () => {
      if (i >= bases.length) {
        // финальный фолбэк — первый вариант
        return resolve(ghostPath(bases[0], level));
      }
      const url = ghostPath(bases[i++], level);
      const img = new Image();
      img.onload = () => resolve(url);
      img.onerror = tryNext;
      img.src = url;
    };
    tryNext();
  });
}

// Синхронный путь (используется редко, только как быстрый плейсхолдер)
export function getGhostIconByLevel(level) {
  const bases = Array.isArray(GHOST_ICON_BASES) ? GHOST_ICON_BASES : ['ghost_icons', 'assets/ghosts'];
  return ghostPath(bases[0], level);
}

// Асинхронная иконка для Leaflet (надёжно с фолбэком)
export async function makeLeafletGhostIconAsync(level) {
  const url = await resolveGhostUrl(level);
  return L.icon({
    iconUrl: url,
    iconSize: [64, 64],
    iconAnchor: [32, 32],
    popupAnchor: [0, -28]
  });
}

// Остальные утилиты
export function makeLeafletGhostIcon(level) {
  return L.icon({
    iconUrl: getGhostIconByLevel(level),
    iconSize: [64, 64],
    iconAnchor: [32, 32],
    popupAnchor: [0, -28]
  });
}

export function getTileId(lat, lng) {
  return `${Math.floor(lat * 100)}_${Math.floor(lng * 100)}`;
}

export function getEnergyIcon(type) {
  let url = '';
  switch (type) {
    case 'rare': url = 'energy_blobs/rare_blob.png'; break;
    case 'advanced': url = 'energy_blobs/advanced_blob.png'; break;
    default: url = 'energy_blobs/normal_blob.png';
  }
  return L.icon({ iconUrl: url, iconSize: [60, 100], iconAnchor: [30, 50] });
}

export function getDistanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 +
    Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180) *
    Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
