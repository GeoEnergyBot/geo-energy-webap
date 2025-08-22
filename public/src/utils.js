
import { GHOST_ICON_BASES } from './env.js';

function ghostPath(base, level){
  const lvl = Math.max(1, Math.min(100, Math.floor(level||1)));
  return `${base}/ghost_${String(lvl).padStart(3,'0')}.png`;
}

export function resolveGhostUrl(level){
  const bases = Array.isArray(GHOST_ICON_BASES)&&GHOST_ICON_BASES.length? GHOST_ICON_BASES : ['ghost_icons','assets/ghosts'];
  return new Promise((resolve)=>{
    let i=0;
    const img = new Image();
    const next = ()=>{
      if (i>=bases.length){
        resolve(ghostPath(bases[0], level||1));
        return;
      }
      const url = ghostPath(bases[i++], level||1);
      img.onload = ()=> resolve(url);
      img.onerror = next;
      img.src = url;
    };
    next();
  });
}

export async function makeLeafletGhostIconAsync(level){
  const url = await resolveGhostUrl(level);
  return L.icon({ iconUrl: url, iconSize:[36,36], iconAnchor:[18,18] });
}
export function makeLeafletGhostIcon(level){
  const base = Array.isArray(GHOST_ICON_BASES)&&GHOST_ICON_BASES.length? GHOST_ICON_BASES[0] : 'ghost_icons';
  const url = ghostPath(base, level);
  return L.icon({ iconUrl: url, iconSize:[36,36], iconAnchor:[18,18] });
}

export function getEnergyIcon(type='normal'){
  let url;
  switch(type){
    case 'advanced': url='energy_blobs/advanced_blob.png'; break;
    case 'rare': url='energy_blobs/rare_blob.png'; break;
    default: url='energy_blobs/normal_blob.png';
  }
  return L.icon({ iconUrl:url, iconSize:[30,30], iconAnchor:[15,15] });
}

export function getTileId(lat,lng){
  const z=15; const n=1<<z;
  const xt = Math.floor((lng+180)/360*n);
  const yt = Math.floor((1 - Math.log(Math.tan(lat*Math.PI/180)+1/Math.cos(lat*Math.PI/180))/Math.PI)/2*n);
  return `${z}:${xt}:${yt}`;
}

export function getDistanceKm(lat1, lng1, lat2, lng2){
  const R=6371;
  const dLat=(lat2-lat1)*Math.PI/180;
  const dLng=(lng2-lng1)*Math.PI/180;
  const a=Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R*2*Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
