import { GHOST_ICON_BASES } from './env.js';

function ghostPath(base, level){
  const lvl = Math.max(1, Math.min(100, Math.floor(level||1)));
  return `${base}/ghost_${String(lvl).padStart(3,'0')}.png`;
}

export function resolveGhostUrl(level){
  return new Promise((resolve)=>{
    const bases = Array.isArray(GHOST_ICON_BASES) && GHOST_ICON_BASES.length ? GHOST_ICON_BASES : ['assets/ghosts'];
    const fallback = 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#88f"/><stop offset="1" stop-color="#0ff"/></linearGradient></defs><circle cx="32" cy="32" r="28" fill="url(#g)" /></svg>`);
    let i = 0;
    const img = new Image();
    const tryNext = () => {
      if (i >= bases.length){ resolve(fallback); return; }
      img.onload = () => resolve(img.src);
      img.onerror = () => { i++; tryNext(); };
      img.src = ghostPath(bases[i], level);
    };
    tryNext();
  });
}

export async function makeLeafletGhostIconAsync(level){
  const url = await resolveGhostUrl(level);
  return L.icon({ iconUrl: url, iconSize: [64,64], iconAnchor: [32,32], popupAnchor: [0,-28] });
}

export function getEnergyIcon(type){
  let url = 'energy_blobs/normal_blob.png';
  if (type === 'advanced') url = 'energy_blobs/advanced_blob.png';
  if (type === 'rare') url = 'energy_blobs/rare_blob.png';
  return L.icon({ iconUrl: url, iconSize: [60,100], iconAnchor: [30,50] });
}

export function getTileId(lat,lng){
  return `${Math.floor(lat*100)}_${Math.floor(lng*100)}`;
}

export function getDistanceKm(lat1, lng1, lat2, lng2){
  const R=6371;
  const dLat=(lat2-lat1)*Math.PI/180;
  const dLng=(lng2-lng1)*Math.PI/180;
  const a=Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R*2*Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}