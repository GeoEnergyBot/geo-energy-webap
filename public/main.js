
import { initSupabase, loadOrCreatePlayer } from './src/api/supabase.js';
import { makeLeafletGhostIconAsync, getTileId } from './src/utils.js';
import { updatePlayerHeader } from './src/ui.js';
import { buildBaseLayers, spawnArEntryNear, setArEntryHandler } from './src/map/tiles.js';
import { loadEnergyPoints } from './src/map/energy.js';
import { quests } from './src/quests.js';
import { store } from './src/store.js';
import { hotzones } from './src/hotzones.js';
import { anti } from './src/anti.js';

const tg = window.Telegram?.WebApp;
if (tg) tg.expand();
const user = tg?.initDataUnsafe?.user ?? { id: 'guest', first_name: 'Гость', username: 'guest' };

let map, playerMarker, lastTileId=null;

initSupabase();
quests.init();

(async function start(){
  const ghostIcon = await makeLeafletGhostIconAsync(1);
  const onPosition = async (pos)=>{
    const lat = pos.coords.latitude; const lng = pos.coords.longitude;
    try{ anti.updatePosition(lat, lng, Date.now()); }catch(e){}
    if (!map){
      const base = buildBaseLayers();
      map = L.map('map', { center:[lat,lng], zoom:16, layers:[base.cartoDark] });
      L.control.layers({ 'Carto Dark': base.cartoDark, 'OSM': base.osm, 'ESRI Спутник': base.esriSat }, null, { position:'topright', collapsed:true }).addTo(map);
      playerMarker = L.marker([lat,lng], { icon: ghostIcon }).addTo(map).bindPopup('Вы здесь');
      lastTileId = getTileId(lat,lng);
      store.init(map, playerMarker);
      hotzones.init(map);
      const p = await loadOrCreatePlayer(user);
      await updatePlayerHeader({ username: user.first_name||user.username||'Игрок', level: p.level, energy: p.energy, energy_max: p.energy_max });
      await loadEnergyPoints(map, playerMarker, user);
    } else {
      playerMarker.setLatLng([lat,lng]);
      const tile = getTileId(lat,lng);
      if (tile !== lastTileId){ lastTileId = tile; await loadEnergyPoints(map, playerMarker, user); }
    }
  };
  const onError = async (err)=>{
    console.warn('geo error', err);
    const lat=43.238949, lng=76.889709;
    try{ anti.updatePosition(lat,lng, Date.now()); }catch(e){}
    onPosition({ coords:{ latitude:lat, longitude:lng } });
  };
  if (navigator.geolocation){
    navigator.geolocation.getCurrentPosition(onPosition, onError, { enableHighAccuracy:true, timeout:6000, maximumAge:2000 });
    navigator.geolocation.watchPosition(onPosition, onError, { enableHighAccuracy:true, timeout:6000, maximumAge:2000 });
  } else { onError(new Error('no geolocation')); }

  // periodic refresh (adapt to lure)
  let intervalMs = 60000;
  setInterval(async ()=>{
    try {
      const pos = playerMarker.getLatLng();
      hotzones.tickMaybeSpawn(pos.lat, pos.lng);
      await loadEnergyPoints(map, playerMarker, user);
      const target = store.spawnRefreshMs(60000);
      if (target !== intervalMs) intervalMs = target;
    } catch(e){ console.warn(e); }
  }, intervalMs);
})();

/* AR state toggling */
window.addEventListener('ar:open', ()=>{ try{ document.body.classList.add('ar-open'); }catch(e){} });
window.addEventListener('ar:close', ()=>{ try{ document.body.classList.remove('ar-open'); }catch(e){} });
