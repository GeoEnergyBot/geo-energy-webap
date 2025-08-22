
// Hot Zones — Stage 5 (client-side overlay & reward buff).
// Every ~40 minutes spawn a zone near player for ~20 minutes.

let _map=null;
let _zones=[]; // { lat,lng,radius,buff,expiresAt,layer }
function now(){ return Date.now(); }

function spawnNear(lat,lng){
  const r = 250 + Math.random()*250; // meters
  const dLat = (Math.random()-0.5) * (r/110540);
  const dLng = (Math.random()-0.5) * (r/111320);
  const zone = { lat: lat+dLat, lng: lng+dLng, radius: 180+Math.random()*120, buff: 1.25, expiresAt: now()+20*60*1000, layer:null };
  if (_map){
    zone.layer = L.circle([zone.lat, zone.lng], { radius: zone.radius, color:'#22d3ee', weight:2, opacity:0.9, fillOpacity:0.08 });
    zone.layer.addTo(_map);
  }
  _zones.push(zone);
}

function cleanup(){
  const t = now();
  for (const z of _zones){
    if (z.expiresAt <= t && z.layer){ try{ _map.removeLayer(z.layer);}catch(e){} z.layer=null; }
  }
  _zones = _zones.filter(z=>z.expiresAt>t);
}

function distanceMeters(lat1,lon1,lat2,lon2){
  const R = 6371000, toRad = (d)=>d*Math.PI/180;
  const dLat = toRad(lat2-lat1), dLon = toRad(lon2-lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return 2*R*Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

export const hotzones = {
  init(map){
    _map = map;
    setInterval(()=>{ cleanup(); }, 10_000);
  },
  tickMaybeSpawn(playerLat, playerLng){
    // 1 in ~120 chance per minute to spawn (avg once in 2 hours) — but if no zones, raise chance
    if (_zones.length===0 && Math.random()<0.25){ spawnNear(playerLat, playerLng); return; }
    if (Math.random()<0.01){ spawnNear(playerLat, playerLng); }
  },
  getBuffAt(lat, lng){
    cleanup();
    for (const z of _zones){
      const d = distanceMeters(lat,lng,z.lat,z.lng);
      if (d <= z.radius) return z.buff;
    }
    return 1.0;
  }
};

