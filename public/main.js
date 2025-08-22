import { loadOrCreatePlayer } from './src/api/supabase.js';
import { makeLeafletGhostIconAsync } from './src/utils.js';
import { updatePlayerHeader } from './src/ui.js';
import { buildBaseLayers, spawnArEntryNear, setArEntryHandler } from './src/map/tiles.js';
import { loadEnergyPoints } from './src/map/energy.js';
import { quests } from './src/quests.js';
import { store } from './src/store.js';
import { hotzones } from './src/hotzones.js';
import { anti } from './src/anti.js';

function showFatal(msg){
  try{
    let el = document.getElementById('fatal');
    if (!el){ el = document.createElement('div'); el.id='fatal'; el.style.cssText='position:fixed;left:50%;top:70px;transform:translateX(-50%);background:#7f1d1d;color:#fff;padding:8px 12px;border-radius:10px;z-index:2000'; document.body.appendChild(el); }
    el.textContent = msg;
  }catch{}
}

const tg = window.Telegram?.WebApp;
if (tg) tg.expand();

(async () => {
  // Telegram user or guest
  const user = tg?.initDataUnsafe?.user ?? { id: 'guest', first_name: 'Гость', username: 'guest' };

  // Header initial
  await updatePlayerHeader({ username: user.first_name || user.username || 'Игрок', level:1, energy:0, energy_max:1000 });

  // Geolocation and map
  let map = null;
  let playerMarker = null;

  function initMap(lat, lng){
    const { cartoDark, osm, esriSat } = buildBaseLayers();
    map = L.map('map', { center:[lat,lng], zoom:16, layers:[cartoDark] });
    L.control.layers({ 'Carto Dark (рекомендовано)':cartoDark, 'OSM':osm, 'ESRI Спутник':esriSat }, null, { position:'topright', collapsed:true }).addTo(map);
  }

  function setPlayer(lat, lng, lvl=1){
    if (!playerMarker){
      makeLeafletGhostIconAsync(lvl).then(icon => {
        playerMarker = L.marker([lat,lng], { icon }).addTo(map).bindPopup('Вы здесь').openPopup();
      });
    } else {
      playerMarker.setLatLng([lat,lng]);
    }
  }

  const onPos = async (pos) => {
    try{
      const lat = pos.coords.latitude, lng = pos.coords.longitude;
      if (!map) initMap(lat,lng);
      setPlayer(lat,lng,1);
      quests.init(); store.init(); hotzones.init(map); quests.bindMap(map, playerMarker); store.bindMap(map, playerMarker);
      spawnArEntryNear(map, lat, lng);
      setArEntryHandler(spawnArEntryNear(map, lat, lng), playerMarker, async ()=>{
        const { openGhostCatch } = await import('./src/ar/ghostCatch.js');
        await openGhostCatch('common');
      });
      const profile = await loadOrCreatePlayer(user);
      await updatePlayerHeader({ username: user.first_name || user.username || 'Игрок', ...profile });
      await loadEnergyPoints(map, playerMarker, user);
    } catch (e){
      console.error(e);
      showFatal('Ошибка инициализации: ' + (e.message||e));
    }
  };

  const onPosErr = async (e) => {
    console.warn('geolocation error', e);
    const lat=51.128, lng=71.431;
    if (!map) initMap(lat,lng);
    setPlayer(lat,lng,1);
    const profile = await loadOrCreatePlayer(user);
    await updatePlayerHeader({ username: user.first_name || user.username || 'Игрок', ...profile });
    await loadEnergyPoints(map, playerMarker, user);
  };

  if ('geolocation' in navigator){
    navigator.geolocation.getCurrentPosition(onPos, onPosErr);
    navigator.geolocation.watchPosition((p)=>{
      try{ anti.tick(p.coords.latitude, p.coords.longitude); if (playerMarker){ playerMarker.setLatLng([p.coords.latitude,p.coords.longitude]); } }catch{}
    }, (e)=>console.warn('watchPosition error', e), { enableHighAccuracy:true, maximumAge:1000, timeout:10000 });
  } else {
    onPosErr(new Error('Геолокация недоступна'));
  }

  // periodic refresh
  let intervalMs = 60000;
  setInterval(async ()=>{
    try{
      if (map && playerMarker){
        const pos = playerMarker.getLatLng();
        hotzones.tickMaybeSpawn(pos.lat, pos.lng);
        await loadEnergyPoints(map, playerMarker, user);
        const target = store.spawnRefreshMs(60000);
        if (target !== intervalMs) intervalMs = target;
      }
    } catch(e){ console.warn(e); }
  }, intervalMs);
})();

window.addEventListener('ar:open', ()=>{ try{ document.body.classList.add('ar-open'); }catch{} });
window.addEventListener('ar:close', ()=>{ try{ document.body.classList.remove('ar-open'); }catch{} });
window.addEventListener('error', (e)=>{ try{ showFatal('Ошибка: '+(e.message||'unknown')); }catch{} });