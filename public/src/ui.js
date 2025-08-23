// Unified UI — top bar + bottom bar (design = screenshot #3)
import { resolveGhostUrl } from './utils.js';

let handlers = { onQuests: null, onStore: null, onInventory: null };

function injectStyle(){
  if (document.getElementById('ui-style')) return;
  const css = `
  :root{
    --bg:#0b1116; --panel:#0f1720; --text:#e6f3ff; --muted:#9fb0c3;
    --accent:#22d3ee; --accent2:#7c8cf8; --accent3:#e879f9;
    --glass: rgba(15,23,32,.7);
    --border: rgba(255,255,255,.1);
  }
  #ui-topbar{
    position: fixed; left:0; right:0; top:0; z-index:1000;
    display:flex; align-items:center; gap:12px; padding:10px 12px;
    background: linear-gradient(90deg,#0e1620,#101c28);
    border-bottom: 1px solid var(--border);
    -webkit-user-select: none; user-select: none;
  }
  #ui-avatar{ width:36px; height:36px; border-radius:999px; background:#000; object-fit:cover; border:1px solid var(--border); }
  #ui-level{ width:24px; height:24px; border-radius:999px; display:grid; place-items:center; font-size:12px; font-weight:700; background:#0ea5e9; color:#001018; margin-left:-12px; border:1px solid var(--border); }
  #ui-name{ font-weight:700; text-overflow:ellipsis; white-space:nowrap; overflow:hidden; }
  #ui-topbar .col{ display:flex; flex-direction:column; flex:1; min-width:0; gap:4px; }
  #ui-topbar .row{ display:flex; align-items:center; gap:8px; font-size:13px; color:var(--text); }
  #ui-wallet{ display:flex; align-items:center; gap:12px; opacity:.95; }
  #ui-wallet b{ font-weight:700; }
  #ui-energy-line{ display:flex; align-items:center; gap:10px; }
  #ui-energy-line .count{ font-variant-numeric: tabular-nums; font-size:13px; opacity:.95; }
  #ui-energy{ flex:1; height:8px; background: rgba(255,255,255,.12); border-radius:999px; overflow:hidden; }
  #ui-energy-fill{ height:8px; width:0%; background: linear-gradient(90deg,var(--accent),var(--accent2),var(--accent3)); transition: width .25s ease; }
  #ui-bottombar{
    position: fixed; left:0; right:0; bottom:0; z-index:1000;
    display:flex; gap:10px; justify-content:space-around; padding:8px 10px;
    background: linear-gradient(90deg,#0e1620,#101c28);
    border-top: 1px solid var(--border);
  }
  .ui-btn{
    flex:1; display:flex; align-items:center; justify-content:center; gap:8px;
    background: var(--glass); color:var(--text);
    border: 1px solid var(--border); border-radius:14px; padding:10px 12px;
    cursor:pointer; font-size:14px;
  }
  .ui-btn:active{ transform: translateY(1px); }
  body.with-ui #map{ position:absolute; top:64px; bottom:64px; left:0; right:0; }
  body.with-ui.ar-open #map, body.with-ui.ar-open #ui-topbar, body.with-ui.ar-open #ui-bottombar{ display:none !important; }
  /* Hide legacy scattered UI if present */
  #wallet-panel, #btn-quests, #btn-store, #btn-inventory { display:none !important; }
  `;
  const style = document.createElement('style');
  style.id = 'ui-style'; style.textContent = css;
  document.head.appendChild(style);
}

export function setupUI(){
  injectStyle();
  document.body.classList.add('with-ui');

  // mount top bar
  let tb = document.getElementById('ui-topbar');
  if (!tb){
    tb = document.createElement('div');
    tb.id = 'ui-topbar';
    tb.innerHTML = `
      <img id="ui-avatar" src="https://via.placeholder.com/48" alt="avatar">
      <div id="ui-level">1</div>
      <div class="col">
        <div class="row">
          <div id="ui-name">Загрузка...</div>
          <div id="ui-wallet">
            <span title="Dust">🧪 <b id="ui-dust">0</b></span>
            <span title="Stamina">⚡ <b id="ui-stamina">0</b></span>
            <span title="SP">🏅 <b id="ui-sp">0</b> (LV <b id="ui-sp-lvl">0</b>)</span>
          </div>
        </div>
        <div id="ui-energy-line">
          <div class="count" id="ui-energy-text">0 / 0</div>
          <div id="ui-energy"><div id="ui-energy-fill"></div></div>
        </div>
      </div>
    `;
    document.body.appendChild(tb);
  }

  // mount bottom bar
  let bb = document.getElementById('ui-bottombar');
  if (!bb){
    bb = document.createElement('div');
    bb.id = 'ui-bottombar';
    bb.innerHTML = `
      <button id="ui-btn-quests" class="ui-btn">🧩 Квесты</button>
      <button id="ui-btn-store" class="ui-btn">🛒 Магазин</button>
      <button id="ui-btn-inventory" class="ui-btn">🎒 Инвентарь</button>
    `;
    document.body.appendChild(bb);
  }

  // wire default handlers
  const $ = (id)=> document.getElementById(id);
  $('#ui-btn-quests')?.addEventListener('click', ()=> handlers.onQuests && handlers.onQuests());
  $('#ui-btn-store')?.addEventListener('click', ()=> handlers.onStore && handlers.onStore());
  $('#ui-btn-inventory')?.addEventListener('click', ()=> handlers.onInventory && handlers.onInventory());

  // initial wallet refresh
  refreshWalletIntoTopbar();
  setInterval(refreshWalletIntoTopbar, 3000);

  // also bind directly with stopPropagation (in case other handlers swallow events)
  const bind = (id, fn)=>{
    const el = document.getElementById(id);
    if (!el || !fn) return;
    const handler = (ev)=>{ try{ ev.preventDefault(); ev.stopPropagation(); }catch(_){} fn(); };
    el.onclick = handler;
    el.addEventListener('touchstart', handler, { passive:false });
    el.addEventListener('pointerdown', handler);
  };
  bind('ui-btn-quests', handlers.onQuests);
  bind('ui-btn-store', handlers.onStore);
  bind('ui-btn-inventory', handlers.onInventory);

}

export function setBottomHandlers({ onQuests, onStore, onInventory }){
  handlers.onQuests = onQuests;
  handlers.onStore = onStore;
  handlers.onInventory = onInventory;
}

// Wallet comes from localStorage('wallet_v1'), shared with quests/store
function getWallet(){
  try{ return JSON.parse(localStorage.getItem('wallet_v1')||'null') || { dust:0, stamina:20, sp:0 }; }catch(e){ return { dust:0, stamina:20, sp:0 }; }
}
function seasonLevel(sp){
  // same linear calc as in quests.js (visual only)
  const lv = Math.floor((sp||0) / 200); return lv>=0 ? lv : 0;
}

function refreshWalletIntoTopbar(){
  const w = getWallet();
  const dust = document.getElementById('ui-dust'); if (dust) dust.textContent = String(w.dust ?? 0);
  const st = document.getElementById('ui-stamina'); if (st) st.textContent = String(w.stamina ?? 0);
  const sp = document.getElementById('ui-sp'); if (sp) sp.textContent = String(w.sp ?? 0);
  const spl = document.getElementById('ui-sp-lvl'); if (spl) spl.textContent = String(seasonLevel(w.sp));
}

export async function updatePlayerHeader({ username, avatar_url, level, energy, energy_max }){
  const nameEl = document.getElementById('ui-name'); if (nameEl) nameEl.textContent = username || 'Гость';
  const url = avatar_url || await resolveGhostUrl(level||1);
  const img = document.getElementById('ui-avatar'); if (img) img.src = url;
  const lvl = document.getElementById('ui-level'); if (lvl) lvl.textContent = String(level||1);

  if (typeof energy==='number' && typeof energy_max==='number'){
    const text = document.getElementById('ui-energy-text');
    const fill = document.getElementById('ui-energy-fill');
    if (text) text.textContent = `${energy} / ${energy_max}`;
    if (fill){
      const pct = Math.max(0, Math.min(100, Math.floor(energy/Math.max(1,energy_max)*100)));
      fill.style.width = pct + '%';
    }
  }
}

export function flashPlayerMarker(marker){
  const el = marker?.getElement?.(); if (!el) return;
  el.classList.add('flash');
  setTimeout(()=> el.classList.remove('flash'), 300);
}