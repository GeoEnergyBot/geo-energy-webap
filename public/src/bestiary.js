// bestiary.js
// Клиентский бестиарий: коллекция открытых духов

import { CREATURES, getCreatureById } from './data/creatures.js';

const LS_KEY = 'geoenergy_bestiary_v1';

function lsGet(k, def=null){
  try{
    const v = localStorage.getItem(k);
    return v ? JSON.parse(v) : def;
  } catch(e){ return def; }
}
function lsSet(k,v){
  try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){}
}

function loadState(){
  const raw = lsGet(LS_KEY, { discovered: [], seen: [] });
  const validIds = new Set(CREATURES.map(c => c.id));
  const uniq = (arr)=> Array.from(new Set((arr||[]).filter(id => validIds.has(id))));
  return {
    discovered: uniq(raw.discovered),
    seen: uniq(raw.seen),
  };
}

function saveState(st){
  lsSet(LS_KEY, st);
}

function rarityLabel(r){
  if (r === 'rare') return 'Редкий дух';
  if (r === 'advanced') return 'Сильный дух';
  return 'Обычный дух';
}

function rarityColor(r){
  if (r === 'rare') return '#fbbf24';
  if (r === 'advanced') return '#a855f7';
  return '#22c55e';
}

function renderList(state){
  const cont = document.getElementById('best-list');
  if (!cont) return;
  const disc = new Set(state.discovered);
  const items = CREATURES.map(c => {
    const opened = disc.has(c.id);
    const name = opened ? c.name : '???';
    const title = opened ? c.title : 'Неизвестный дух';
    const short = opened ? c.short : 'Вы ещё не приручили этого духа.';
    const opacity = opened ? 1.0 : 0.55;
    const blur = opened ? 'none' : 'blur(1px)';
    const badge = rarityLabel(c.rarity);
    const col = rarityColor(c.rarity);
    return `
      <div style="padding:8px 10px;border-radius:12px;border:1px solid rgba(148,163,184,.4);margin-bottom:8px;background:rgba(15,23,42,.9);backdrop-filter:blur(6px);opacity:${opacity}">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <div style="font-weight:600;font-size:14px;filter:${blur}">${name}</div>
          <span style="font-size:11px;padding:2px 8px;border-radius:999px;border:1px solid ${col};color:${col};background:rgba(15,23,42,.9)">${badge}</span>
        </div>
        <div style="font-size:12px;color:#cbd5f5;filter:${blur};margin-bottom:4px;">${title}</div>
        <div style="font-size:12px;color:#9ca3af;filter:${blur};">${short}</div>
      </div>
    `;
  }).join('');
  cont.innerHTML = items;
}

function ensureModal(){
  let m = document.getElementById('bestiary-modal');
  if (!m){
    m = document.createElement('div');
    m.id = 'bestiary-modal';
    m.innerHTML = `
    <div style="position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:2200;display:flex;align-items:center;justify-content:center">
      <div style="width:520px;max-width:95vw;background:#020617;border-radius:18px;border:1px solid rgba(148,163,184,.4);box-shadow:0 18px 60px rgba(0,0,0,.7);overflow:hidden">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-bottom:1px solid rgba(148,163,184,.35);background:radial-gradient(circle at 0 0,rgba(56,189,248,.3),transparent 55%)">
          <div style="font-weight:600;font-size:15px;">Бестиарий духов</div>
          <button id="best_close" style="background:transparent;border:0;color:#e5e7eb;font-size:18px;cursor:pointer">✕</button>
        </div>
        <div id="best-list" style="padding:10px 12px;max-height:70vh;overflow:auto;"></div>
      </div>
    </div>`;
    document.body.appendChild(m);
    m.querySelector('#best_close').onclick = ()=> m.remove();
  }
  return m;
}

function refreshBadgeLabel(state){
  const btn = document.getElementById('btn-bestiary');
  if (!btn) return;
  const total = CREATURES.length;
  const cur = state.discovered.length;
  btn.textContent = `Бестиарий ${cur}/${total}`;
}

const _state = loadState();

export const bestiary = {
  init(){
    // кнопка
    if (!document.getElementById('btn-bestiary')){
      const btn = document.createElement('button');
      btn.id = 'btn-bestiary';
      btn.textContent = 'Бестиарий';
      Object.assign(btn.style, {
        position:'absolute',
        right:'8px',
        bottom:'76px',
        zIndex:1100,
        background:'#020617',
        color:'#e5e7eb',
        border:'1px solid rgba(148,163,184,.6)',
        borderRadius:'14px',
        padding:'10px 14px',
        cursor:'pointer',
        fontSize:'13px'
      });
      btn.onclick = ()=> this.openUI();
      document.body.appendChild(btn);
    }
    refreshBadgeLabel(_state);
  },
  openUI(){
    const m = ensureModal();
    renderList(_state);
    return m;
  },
  onEncounter(id){
    if (!id) return;
    const c = getCreatureById(id);
    if (!c) return;
    if (!_state.seen.includes(id)){
      _state.seen.push(id);
      saveState(_state);
    }
  },
  onCapture(id){
    if (!id) return;
    const c = getCreatureById(id);
    if (!c) return;
    if (!_state.discovered.includes(id)){
      _state.discovered.push(id);
      saveState(_state);
      refreshBadgeLabel(_state);
      // если модалка открыта — перерисуем список
      const cont = document.getElementById('best-list');
      if (cont) renderList(_state);
    }
  },
  getState(){
    return { discovered:[..._state.discovered], seen:[..._state.seen] };
  }
};
