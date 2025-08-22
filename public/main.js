// Entry point only. Keep index.html unchanged.
import { initSupabase, loadOrCreatePlayer } from './src/api/supabase.js';
import { makeLeafletGhostIconAsync, makeLeafletGhostIcon, getTileId } from './src/utils.js';
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

let map, playerMarker, ghostIcon;
let lastTileId = null;

initSupabase();
quests.init();

(async () => {
  const { level, energy, energy_max, dbRow } = await loadOrCreatePlayer(user);
  await updatePlayerHeader({
    username: dbRow?.first_name || dbRow?.username || user.first_name || user.username || 'Игрок',
    avatar_url: dbRow?.avatar_url || '',
    level, energy, energy_max
  });

  ghostIcon = await makeLeafletGhostIconAsync(level);

  const onPosition = async (pos) => {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    try{ anti.updatePosition(lat, lng, Date.now()); }catch(e){}

    if (!map) {
      const base = buildBaseLayers();
      map = L.map('map', { center: [lat, lng], zoom: 16, layers: [base.cartoDark] });
      L.control.layers(
        { 'Cartо Dark (рекомендовано)': base.cartoDark, 'OSM': base.osm, 'ESRI Спутник': base.esriSat },
        null, { position: 'topright', collapsed: true }
      ).addTo(map);

      playerMarker = L.marker([lat, lng], { icon: ghostIcon }).addTo(map).bindPopup("Вы здесь").openPopup();
      lastTileId = getTileId(lat, lng);

      store.init(map, playerMarker);
hotzones.init(map);
try{ const pos = playerMarker.getLatLng(); hotzones.tickMaybeSpawn(pos.lat, pos.lng); }catch(e){}
    await loadEnergyPoints(map, playerMarker, user);
    // adapt refresh interval on lure
    const target = store.spawnRefreshMs(60000);
    if (target !== __refreshMs){ __refreshMs = target; }

      const arMarker = spawnArEntryNear(map, lat, lng);
      setArEntryHandler(arMarker, playerMarker);

    } else {
      playerMarker.setLatLng([lat, lng]);
      const tileId = getTileId(lat, lng);
      if (tileId !== lastTileId) {
        lastTileId = tileId;
        try{ const pos = playerMarker.getLatLng(); hotzones.tickMaybeSpawn(pos.lat, pos.lng); }catch(e){}
    await loadEnergyPoints(map, playerMarker, user);
    // adapt refresh interval on lure
    const target = store.spawnRefreshMs(60000);
    if (target !== __refreshMs){ __refreshMs = target; }

        const arMarker = spawnArEntryNear(map, lat, lng, true);
        setArEntryHandler(arMarker, playerMarker);
      }
    }
  };

  const onPositionError = async (error) => {
    console.warn("Ошибка геолокации:", error?.message || error);
    const lat = 51.128, lng = 71.431;

    if (!map) {
      const base = buildBaseLayers();
      map = L.map('map', { center: [lat, lng], zoom: 13, layers: [base.cartoDark] });
      L.control.layers(
        { 'Cartо Dark (рекомендовано)': base.cartoDark, 'OSM': base.osm, 'ESRI Спутник': base.esriSat },
        null, { position: 'topright', collapsed: true }
      ).addTo(map);
    }

    playerMarker = L.marker([lat, lng], { icon: ghostIcon }).addTo(map).bindPopup("Вы здесь").openPopup();
    lastTileId = getTileId(lat, lng);

    try{ const pos = playerMarker.getLatLng(); hotzones.tickMaybeSpawn(pos.lat, pos.lng); }catch(e){}
    await loadEnergyPoints(map, playerMarker, user);
    // adapt refresh interval on lure
    const target = store.spawnRefreshMs(60000);
    if (target !== __refreshMs){ __refreshMs = target; }

    const arMarker = spawnArEntryNear(map, lat, lng);
    setArEntryHandler(arMarker, playerMarker);

    alert("Геолокация недоступна. Используются примерные координаты.");
  };

  if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition(onPosition, onPositionError);
    navigator.geolocation.watchPosition(onPosition, (e) => console.warn('watchPosition error', e), {
      enableHighAccuracy: true, maximumAge: 1000, timeout: 10000,
    });
    let __refreshMs = 60000;
setInterval(async () => {
      if (!map || !playerMarker) return;
      try{ const pos = playerMarker.getLatLng(); hotzones.tickMaybeSpawn(pos.lat, pos.lng); }catch(e){}
    await loadEnergyPoints(map, playerMarker, user);
    // adapt refresh interval on lure
    const target = store.spawnRefreshMs(60000);
    if (target !== __refreshMs){ __refreshMs = target; }
    }, 60000);
  } else {
    onPositionError(new Error("Геолокация не поддерживается."));
  }
})();

/* === AR state toggling (inject) === */
window.addEventListener('ar:open', () => {
  try { document.body.classList.add('ar-open'); } catch(e) {}
});
window.addEventListener('ar:close', () => {
  try { document.body.classList.remove('ar-open'); } catch(e) {}
});

window.addEventListener('spawn:refresh:hint', ()=>{ try{ /* No-op for now */ }catch(e){} });
