
import { initSupabase, loadOrCreatePlayer } from './src/api/supabase.js';
import { makeLeafletGhostIconAsync, getTileId } from './src/utils.js';
import { setupUI, updatePlayerHeader, setBottomHandlers } from './src/ui.js';
import { buildBaseLayers, spawnArEntryNear, setArEntryHandler } from './src/map/tiles.js';
import { loadEnergyPoints } from './src/map/energy.js';
import { quests } from './src/quests.js';
import { store } from './src/store.js';
import { hotzones } from './src/hotzones.js';
import { anti } from './src/anti.js';

// expose global fallbacks for UI buttons (works inside Telegram WebApp and if event listeners are intercepted)
try {
  window.__openQuests = () => { try { quests.openUI(); } catch(e){ console.warn('openQuests error', e); } };
  window.__openStore = () => { try { store.openStore(); } catch(e){ console.warn('openStore error', e); } };
  window.__openInventory = () => { try { store.openInventory(); } catch(e){ console.warn('openInventory error', e); } };
} catch(_) {}


function showFatal(msg){ try{ let el=document.getElementById('fatal'); if(!el){ el=document.createElement('div'); el.id='fatal'; Object.assign(el.style,{position:'fixed',left:'50%',top:'50%',transform:'translate(-50%,-50%)',background:'#111827',color:'#fff',padding:'16px 18px',border:'1px solid rgba(255,255,255,.2)',borderRadius:'12px',zIndex:9999,boxShadow:'0 8px 30px rgba(0,0,0,.45)'}); document.body.appendChild(el);} el.textContent=msg;}catch(e){} }

const tg = window.Telegram?.WebApp;
const IS_PROD = (typeof location!=='undefined') && (['geo-energy-webap.vercel.app'].includes(location.hostname));
if (tg) tg.expand();
const user = tg?.initDataUnsafe?.user ?? { id: 'guest', first_name: 'Гость', username: 'guest' };

let map, playerMarker, lastTileId=null;

initSupabase();
quests.init();
setupUI();
setBottomHandlers({ onQuests: ()=>quests.openUI(), onStore: ()=>store.openStore(), onInventory: ()=>store.openInventory() });


(async function start(){
  const ghostIcon = await makeLeafletGhostIconAsync(1);
  const onPosition = async (pos)=>{
    try{ localStorage.setItem('last_lat', String(pos.coords.latitude)); localStorage.setItem('last_lng', String(pos.coords.longitude)); }catch(_){}
    const lat = pos.coords.latitude; const lng = pos.coords.longitude;
    try{ anti.updatePosition(lat, lng, Date.now()); }catch(e){}
    if (!map){
      const base = buildBaseLayers();
      map = L.map('map', { center:[lat,lng], zoom:16, layers:[base.cartoDark] });
      // OSM Buildings 3D overlay (styled + tilted so effect is visible)
      try {
        const __osmb = new OSMBuildings(map);
        __osmb.setStyle({
          wallColor: 'rgba(124,140,248,0.85)',
          roofColor: 'rgba(180,200,255,0.95)',
          fogColor: 'rgba(8,12,16,0.0)'
        });
        __osmb.setTilt(45);
        __osmb.setRotation(-20);
        __osmb.load();
        window.__osmBuildings = __osmb;
      } catch(e) { console.warn('OSM Buildings init failed', e); }
    
      L.control.layers({ 'Carto Dark': base.cartoDark, 'OSM': base.osm, 'ESRI Спутник': base.esriSat }, null, { position:'topright', collapsed:true }).addTo(map);
      playerMarker = L.marker([lat,lng], { icon: ghostIcon }).addTo(map).bindPopup('Вы здесь');
      lastTileId = getTileId(lat,lng);
      store.init(map, playerMarker);
      try{ window.__openQuests = ()=>quests.openUI(); window.__openStore=()=>store.openStore(); window.__openInventory=()=>store.openInventory(); }catch(_){ }
      setBottomHandlers({ onQuests: ()=>quests.openUI(), onStore: ()=>store.openStore(), onInventory: ()=>store.openInventory() });
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
    try{ localStorage.setItem('last_lat', String(43.238949)); localStorage.setItem('last_lng', String(76.889709)); }catch(_){}
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

window.addEventListener('error', (e)=>{ try{ showFatal('Ошибка: '+(e.message||'unknown')); }catch(_){} });
