
import { GHOST_ICON_BASES } from './env.js';

function ghostPath(base, level){
  const lvl = Math.max(1, Math.min(100, Math.floor(level||1)));
  return `${base}/ghost_${String(lvl).padStart(3,'0')}.png`;
}

export function resolveGhostUrl(level){
  const bases = Array.isArray(GHOST_ICON_BASES)&&GHOST_ICON_BASES.length? GHOST_ICON_BASES : ['ghost_icons','assets/ghosts'];
  return new Promise((resolve)=>{
  const fallback = 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 72 72"><defs><radialGradient id="g"><stop offset="0" stop-color="#22d3ee"/><stop offset="1" stop-color="#0ea5e9"/></radialGradient></defs><circle cx="36" cy="36" r="28" fill="url(#g)" /></svg>`);

    let i=0;
    const img = new Image();
    const next = ()=>{
      if (i>=bases.length){
        resolve(fallback);
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
  const palette = {
    normal: { ring:'#f4b857' },
    advanced: { ring:'#60a5fa' },
    rare: { ring:'#f97316' }
  };
  const p = palette[type] || palette.normal;
  const svg = encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
      <defs>
        <radialGradient id="bg" cx="50%" cy="40%" r="55%">
          <stop offset="0%" stop-color="#1f2933"/>
          <stop offset="60%" stop-color="#111827"/>
          <stop offset="100%" stop-color="#020617"/>
        </radialGradient>
      </defs>
      <circle cx="32" cy="32" r="22" fill="url(#bg)" stroke="${p.ring}" stroke-width="3" />
      <circle cx="24" cy="26" r="3" fill="${p.ring}" />
      <circle cx="40" cy="26" r="3" fill="${p.ring}" />
      <path d="M22 36 Q32 42 42 36" fill="none" stroke="${p.ring}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `.trim());
  const url = 'data:image/svg+xml;utf8,' + svg;
  return L.icon({
    iconUrl: url,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    className: 'spirit-icon'
  });
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
