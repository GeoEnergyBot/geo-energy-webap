
// Store & Inventory & Effects (offchain) — Stage 4
// All data in localStorage. Effects influence client-side reward display only (server remains authoritative).

const LS_INV = 'inv_v1';
const LS_EFF = 'effects_v1';
const LS_WAL = 'wallet_v1'; // share Dust/Stamina with quests wallet

function lsGet(k, def=null){ try{ const v = localStorage.getItem(k); return v? JSON.parse(v): def; }catch(e){ return def; } }
function lsSet(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }

const catalog = [
  { sku:'boost_xp_30',  title:'Бустер Энергии 30м', desc:'+25% энергии с точек',  price: 100, grant:{ item:'boost_xp_30', qty:1 } },
  { sku:'lure_10',      title:'Люр 10м',            desc:'Локальный буст лута и частоты обновления точек', price: 120, grant:{ item:'lure_10', qty:1 } },
  { sku:'vip_30',       title:'VIP 30 дней',        desc:'+30% Dust, расширенные квесты', price: 900, grant:{ effect:'vip_30', days:30 } },
];

function getWallet(){ return lsGet(LS_WAL, { dust:0, stamina:20, sp:0 }); }
function setWallet(w){ lsSet(LS_WAL, w); }

function getInv(){ return lsGet(LS_INV, {}); }
function setInv(inv){ lsSet(LS_INV, inv); }
function addItem(item, qty){
  const inv = getInv(); inv[item] = (inv[item]||0) + qty; setInv(inv); return inv;
}
function decItem(item, qty){
  const inv = getInv(); const cur = inv[item]||0; inv[item] = Math.max(0, cur-qty); setInv(inv); return inv;
}

function getEffects(){ return lsGet(LS_EFF, []); }
function setEffects(e){ lsSet(LS_EFF, e); }

function now(){ return Date.now(); }

function addTimedEffect(kind, ms){
  const e = getEffects().filter(x => (x.expiresAt||0) > now()); // drop expired
  e.push({ kind, startedAt: now(), expiresAt: now()+ms });
  setEffects(e);
}
function addVipDays(days){
  const e = getEffects().filter(x => (x.expiresAt||0) > now());
  // accumulate VIP by extending if exists
  const vip = e.find(x => x.kind==='vip');
  const addMs = days*24*3600*1000;
  if (vip){ vip.expiresAt = Math.max(vip.expiresAt, now()) + addMs; }
  else { e.push({ kind:'vip', startedAt: now(), expiresAt: now()+addMs }); }
  setEffects(e);
}

function hasEffect(kind){
  return getEffects().some(x => x.kind===kind && x.expiresAt>now());
}

// Energy multiplier from active effects
function energyMultiplier(){
  let m = 1.0;
  if (hasEffect('boost_xp_30')) m *= 1.25;
  if (hasEffect('lure_10')) m *= 1.10; // lure provides slight reward boost as MVP
  return m;
}

// Dust multiplier
function dustMultiplier(){
  let m = 1.0;
  if (hasEffect('vip')) m *= 1.30;
  return m;
}

// Spawn refresh ms (used by main to refresh points more often under lure)
function spawnRefreshMs(defaultMs){
  return hasEffect('lure_10') ? Math.floor(defaultMs/2) : defaultMs;
}

let _map = null, _playerMarker = null, _lureCircle = null;

function bindMap(map, playerMarker){
  _map = map; _playerMarker = playerMarker;
  drawOverlays();
}

function drawOverlays(){
  // Lure circle
  try{
    if (_lureCircle){ _map.removeLayer(_lureCircle); _lureCircle = null; }
    if (hasEffect('lure_10') && _map && _playerMarker){
      const pos = _playerMarker.getLatLng();
      _lureCircle = L.circle([pos.lat, pos.lng], { radius: 90, color:'#7c3aed', weight:2, opacity:0.8, fillOpacity:0.08 });
      _lureCircle.addTo(_map);
    }
  }catch(e){}
}

function effectTicker(){
  drawOverlays();
}

setInterval(effectTicker, 5000);

// UI
function openStore(){
  let m = document.getElementById('store-modal');
  if (!m){
    m = document.createElement('div'); m.id='store-modal';
    m.innerHTML = `<div style="position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:2100;display:flex;align-items:center;justify-content:center">
      <div style="width:520px;max-width:95vw;background:#0e1317;border:1px solid rgba(255,255,255,.08);border-radius:18px;box-shadow:0 10px 40px rgba(0,0,0,.5)">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.06)">
          <div style="font-weight:600">Магазин</div>
          <button id="st_close" style="background:transparent;border:0;color:#fff;font-size:18px;cursor:pointer">✕</button>
        </div>
        <div id="st_body" style="padding:12px;max-height:70vh;overflow:auto"></div>
      </div>
    </div>`;
    document.body.appendChild(m);
    m.querySelector('#st_close').onclick = ()=> m.remove();
  }
  renderStore();
}

function renderStore(){
  const body = document.querySelector('#st_body'); if (!body) return;
  const w = getWallet();
  body.innerHTML = `<div style="margin-bottom:8px;opacity:.9">Баланс Dust: <b>${w.dust}</b></div>`;
  for (const item of catalog){
    const div = document.createElement('div');
    div.style.border='1px solid rgba(255,255,255,.08)'; div.style.borderRadius='12px'; div.style.padding='10px'; div.style.margin='6px 0';
    div.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div><div style="font-weight:600">${item.title}</div><div style="opacity:.85;font-size:13px">${item.desc}</div></div>
        <div><b>${item.price}</b> Dust</div>
      </div>
      <div style="display:flex;justify-content:flex-end;margin-top:6px"><button class="st_buy" style="background:#171f27;border:1px solid rgba(255,255,255,.12);color:#e9f1f7;padding:6px 10px;border-radius:12px;cursor:pointer">Купить</button></div>`;
    div.querySelector('.st_buy').onclick = ()=> {
      const w = getWallet();
      if (w.dust < item.price){ alert('Недостаточно Dust'); return; }
      w.dust -= item.price; setWallet(w);
      if (item.grant.item) addItem(item.grant.item, item.grant.qty||1);
      if (item.grant.effect === 'vip_30') addVipDays(item.grant.days||30);
      alert('Покупка успешна!'); renderStore(); renderInventory(); refreshWalletBadge();
    };
    body.appendChild(div);
  }
}

function openInventory(){
  let m = document.getElementById('inv-modal');
  if (!m){
    m = document.createElement('div'); m.id='inv-modal';
    m.innerHTML = `<div style="position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:2100;display:flex;align-items:center;justify-content:center">
      <div style="width:520px;max-width:95vw;background:#0e1317;border:1px solid rgba(255,255,255,.08);border-radius:18px;box-shadow:0 10px 40px rgba(0,0,0,.5)">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.06)">
          <div style="font-weight:600">Инвентарь</div>
          <button id="inv_close" style="background:transparent;border:0;color:#fff;font-size:18px;cursor:pointer">✕</button>
        </div>
        <div id="inv_body" style="padding:12px;max-height:70vh;overflow:auto"></div>
      </div>
    </div>`;
    document.body.appendChild(m);
    m.querySelector('#inv_close').onclick = ()=> m.remove();
  }
  renderInventory();
}

function renderInventory(){
  const body = document.querySelector('#inv_body'); if (!body) return;
  const inv = getInv();
  const effects = getEffects().filter(x=>x.expiresAt>now());
  const vipRemain = effects.find(x=>x.kind==='vip')?.expiresAt - now();

  const items = [
    { key:'boost_xp_30', title:'Бустер Энергии 30м', use: ()=>{ if ((inv['boost_xp_30']||0)<=0) return alert('Нет предмета'); decItem('boost_xp_30',1); addTimedEffect('boost_xp_30', 30*60*1000); alert('Бустер активирован на 30 минут'); drawOverlays(); renderInventory(); refreshWalletBadge(); } },
    { key:'lure_10', title:'Люр 10м', use: ()=>{ if ((inv['lure_10']||0)<=0) return alert('Нет предмета'); decItem('lure_10',1); addTimedEffect('lure_10', 10*60*1000); alert('Люр активирован на 10 минут'); drawOverlays(); renderInventory(); refreshWalletBadge(); window.dispatchEvent(new CustomEvent('spawn:refresh:hint')); } },
  ];

  body.innerHTML = '';

  const row = (k,title)=>{
    const qty = inv[k]||0;
    const wrap = document.createElement('div');
    wrap.style.border='1px solid rgba(255,255,255,.08)'; wrap.style.borderRadius='12px'; wrap.style.padding='10px'; wrap.style.margin='6px 0';
    wrap.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center"><div><div style="font-weight:600">${title}</div><div style="opacity:.75;font-size:12px">В наличии: <b>${qty}</b></div></div><div><button class="use_btn" style="background:#171f27;border:1px solid rgba(255,255,255,.12);color:#e9f1f7;padding:6px 10px;border-radius:12px;cursor:pointer" ${qty<=0?'disabled':''}>Использовать</button></div></div>`;
    wrap.querySelector('.use_btn').onclick = ()=> items.find(x=>x.key===k)?.use();
    return wrap;
  };

  body.appendChild(row('boost_xp_30','Бустер Энергии 30м'));
  body.appendChild(row('lure_10','Люр 10м'));

  // Effects section
  const eff = document.createElement('div');
  const e = getEffects().filter(x=>x.expiresAt>now());
  const effLines = e.map(x=>{
    const left = Math.max(0, x.expiresAt - now());
    const m = Math.floor(left/60000), s = Math.floor((left%60000)/1000);
    const label = x.kind==='boost_xp_30'? 'Бустер Энергии' : (x.kind==='lure_10' ? 'Люр' : (x.kind==='vip'?'VIP':''));
    return `<div>⏳ ${label}: ещё ${m}м ${s}с</div>`;
  }).join('') || '<div style="opacity:.75">Нет активных эффектов</div>';
  eff.innerHTML = `<div style="opacity:.9;margin-top:8px;margin-bottom:6px;font-weight:600">Активные эффекты</div>${effLines}`;
  body.appendChild(eff);
}

function mountButtonsDisabled(){
  // Store button
  if (!document.getElementById('btn-store')){
    const btn = document.createElement('button');
    btn.id = 'btn-store'; btn.textContent = 'Магазин';
    Object.assign(btn.style, { position:'absolute', left:'8px', bottom:'116px', zIndex:1100, background:'#121a21', color:'#e9f1f7', border:'1px solid rgba(255,255,255,.12)', borderRadius:'14px', padding:'10px 14px', cursor:'pointer' });
    btn.onclick = openStore;
    document.body.appendChild(btn);
  }
  // Inventory button
  if (!document.getElementById('btn-inventory')){
    const btn = document.createElement('button');
    btn.id = 'btn-inventory'; btn.textContent = 'Инвентарь';
    Object.assign(btn.style, { position:'absolute', left:'8px', bottom:'156px', zIndex:1100, background:'#121a21', color:'#e9f1f7', border:'1px solid rgba(255,255,255,.12)', borderRadius:'14px', padding:'10px 14px', cursor:'pointer' });
    btn.onclick = openInventory;
    document.body.appendChild(btn);
  }
}

function refreshWalletBadge(){
  // refresh Dust number in quests wallet panel if exists
  try{
    const w = getWallet();
    const el = document.getElementById('w_dust'); if (el) el.textContent = w.dust;
  }catch(e){}
}

export const store = {
  init(map, playerMarker){
    // grant some starter Dust/items for demo if empty
    const w = getWallet(); if (w.dust===0) { w.dust = 200; setWallet(w); }
    const inv = getInv(); if (!inv['boost_xp_30']) { inv['boost_xp_30'] = 1; } if (!inv['lure_10']) { inv['lure_10'] = 1; } setInv(inv);
    /* mountButtons disabled: using bottom bar */
    bindMap(map, playerMarker);
    refreshWalletBadge();
  },
  bindMap,
  energyMultiplier,
  dustMultiplier,
  spawnRefreshMs,
  getEffects,
  hasEffect,
};

