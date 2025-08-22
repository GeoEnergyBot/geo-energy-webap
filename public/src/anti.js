// Простая античит-логика: детекция телепортов/высокой скорости и мягкий штраф к наградам.
const SPEED_MAX_MS = 10.5;      // м/с (≈ 38 км/ч) — пешком/бег/велосипед, выше считаем подозрительным
const TELEPORT_DIST_M = 300;    // телепорт за один тик
const PENALTY_MS = 60_000;      // длительность штрафа после подозрительного события
let last = null;
let penaltyUntil = 0;
let lastReason = '';

function haversine(lat1, lon1, lat2, lon2){
  const R = 6371000;
  const toRad = (d)=>d*Math.PI/180;
  const dLat = toRad(lat2-lat1);
  const dLon = toRad(lon2-lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  const c = 2*Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R*c;
}

export const anti = {
  updatePosition(lat, lng, ts = Date.now()){
    if (last){
      const dt = Math.max(0.001, (ts - last.ts)/1000);
      const dist = haversine(last.lat, last.lng, lat, lng);
      const speed = dist / dt; // м/с
      if (dist >= TELEPORT_DIST_M || speed > SPEED_MAX_MS){
        penaltyUntil = ts + PENALTY_MS;
        lastReason = dist >= TELEPORT_DIST_M ? 'teleport' : 'speed';
        console.warn('[anti] suspicious', { dist, speed, reason:lastReason });
      }
    }
    last = { lat, lng, ts };
  },
  getPenalty(){
    const now = Date.now();
    if (now < penaltyUntil) return { active:true, factor:0.5, reason:lastReason, msLeft: penaltyUntil-now };
    return { active:false, factor:1.0, reason:null, msLeft:0 };
  }
};
