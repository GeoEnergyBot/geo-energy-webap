
// Quests & Season Path (client/offchain) — Stage 3
// Stores progress in localStorage. UI is injected dynamically (no index.html edits).

const DAY_KEY = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
const WEEK_KEY = () => {
  const d = new Date();
  // Monday-start week number (ISO-ish)
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7; // 0..6 (Mon..Sun)
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = new Date(target.getFullYear(),0,4);
  const week = 1 + Math.round(((target.getTime() - firstThursday.getTime())/86400000 - 3 + ((firstThursday.getDay()+6)%7))/7);
  return `${d.getFullYear()}-W${String(week).padStart(2,'0')}`;
};

function lsGet(k, def=null){ try{ const v = localStorage.getItem(k); return v? JSON.parse(v): def; }catch(e){ return def; } }
function lsSet(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }

// Wallet (soft values for Dust/Stamina/SP to show in UI)
const WALLET_KEY = 'wallet_v1';
function getWallet(){ return lsGet(WALLET_KEY, { dust:0, stamina:20, sp:0 }); }
function setWallet(w){ lsSet(WALLET_KEY, w); }

// Quest templates (can be A/B in future)
function dailyTemplates(){
  return [
    { id:'d_collect_normal', title:'Собери 5 обычных точек', need:5, reward:{ dust:20, sp:50 } },
    { id:'d_ar_win', title:'Выиграй AR мини-игру 1 раз', need:1, reward:{ stamina:2, sp:30 } },
    { id:'d_collect_advanced', title:'Собери 2 продвинутые точки', need:2, reward:{ dust:30, sp:40 } },
  ];
}
function weeklyTemplates(){
  return [
    { id:'w_collect_total', title:'Собери 50 точек любой редкости', need:50, reward:{ dust:120, sp:200 } },
    { id:'w_ar_wins', title:'Победи в AR 15 раз', need:15, reward:{ stamina:6, sp:200 } },
  ];
}

function ensureDaily(){
  const key = 'quests_daily_'+DAY_KEY();
  let qs = lsGet(key);
  if (!qs){
    qs = dailyTemplates().map(q=>({ ...q, cur:0, done:false, claimed:false }));
    // cleanup old day records (optional)
    lsSet(key, qs);
  }
  return { key, qs };
}
function ensureWeekly(){
  const key = 'quests_weekly_'+WEEK_KEY();
  let qs = lsGet(key);
  if (!qs){
    qs = weeklyTemplates().map(q=>({ ...q, cur:0, done:false, claimed:false }));
    lsSet(key, qs);
  }
  return { key, qs };
}

// Season path is total SP (season points) in wallet; level calc is linear for MVP
function seasonLevel(sp){ return Math.floor(sp / 100); }
function seasonProgress(sp){ const cur = sp % 100; return { cur, need:100 }; }

function addReward(rew){
  const w = getWallet();
  if (rew?.dust) w.dust += rew.dust;
  if (rew?.stamina) w.stamina += rew.stamina;
  if (rew?.sp) w.sp += rew.sp;
  setWallet(w);
  return w;
}

function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }

// Public API
export const quests = {
  init(){
    ensureDaily(); ensureWeekly(); /* UI disabled */
  },
  mountButton(){ /* disabled */ });
    btn.onclick = ()=> this.openUI();
    document.body.appendChild(btn);
  },
  mountWallet(){ /* disabled */ }</b></span>
      <span>⚡ Stamina: <b id="w_stamina">${w.stamina}</b></span>
      <span>🎖️ SP: <b id="w_sp">${w.sp}</b> (LV <b id="w_sp_lvl">${seasonLevel(w.sp)}</b>)</span>
    </div>`;
    Object.assign(panel.style, {
      position:'absolute', right:'8px', top:'8px', zIndex: 1100,
      background:'rgba(0,0,0,.35)', backdropFilter:'blur(6px)',
      border:'1px solid rgba(255,255,255,.12)', borderRadius:'12px',
      padding:'6px 10px', color:'#e9f1f7', fontSize:'13px'
    });
    document.body.appendChild(panel);
  },
  refreshWalletUI(){
    const w = getWallet();
    const ids = ['w_dust','w_stamina','w_sp','w_sp_lvl'];
    const vals = [w.dust, w.stamina, w.sp, seasonLevel(w.sp)];
    ids.forEach((id,i)=>{ const el = document.getElementById(id); if (el) el.textContent = vals[i]; });
  },
  openUI(){
    let m = document.getElementById('quests-modal');
    if (!m){
      m = document.createElement('div');
      m.id = 'quests-modal';
      m.innerHTML = `
      <div style="position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:2000;display:flex;align-items:center;justify-content:center">
        <div style="width:520px;max-width:95vw;background:#0e1317;border:1px solid rgba(255,255,255,.08);border-radius:18px;box-shadow:0 10px 40px rgba(0,0,0,.5)">
          <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.06)">
            <div style="font-weight:600">Квесты и Сезон</div>
            <button id="q_close" style="background:transparent;border:0;color:#fff;font-size:18px;cursor:pointer">✕</button>
          </div>
          <div id="q_body" style="padding:12px;max-height:70vh;overflow:auto"></div>
        </div>
      </div>`;
      document.body.appendChild(m);
      m.querySelector('#q_close').onclick = ()=> m.remove();
    }
    this.renderList();
  },
  renderList(){
    const { key:dk, qs:dqs } = ensureDaily();
    const { key:wk, qs:wqs } = ensureWeekly();
    const w = getWallet();
    const body = document.querySelector('#q_body');
    if (!body) return;
    body.innerHTML = '';

    const sec = (title)=>{
      const div = document.createElement('div');
      div.innerHTML = `<div style="opacity:.9;margin:6px 0 8px 0;font-weight:600">${title}</div>`;
      body.appendChild(div);
      return div;
    };

    const makeItem = (q, storageKey)=>{
      const wrap = document.createElement('div');
      wrap.style.border = '1px solid rgba(255,255,255,.08)';
      wrap.style.borderRadius = '12px';
      wrap.style.padding = '10px';
      wrap.style.margin = '6px 0';
      const pct = clamp(Math.floor((q.cur/q.need)*100),0,100);
      wrap.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div style="font-weight:600">${q.title}</div>
          <div style="font-size:12px;opacity:.85">${q.cur}/${q.need}</div>
        </div>
        <div style="height:8px;background:rgba(255,255,255,.12);border-radius:6px;overflow:hidden;margin:6px 0"><div style="height:8px;width:${pct}%;background:linear-gradient(90deg,#22d3ee,#818cf8,#e879f9)"></div></div>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div style="font-size:13px;opacity:.9">Награда: ${q.reward?.dust?('🧪 '+q.reward.dust):''} ${q.reward?.stamina?('⚡ '+q.reward.stamina):''} ${q.reward?.sp?('🎖️ '+q.reward.sp):''}</div>
          <div>
            ${q.done && !q.claimed ? '<button class="q_claim_btn" style="background:#171f27;border:1px solid rgba(255,255,255,.12);color:#e9f1f7;padding:6px 10px;border-radius:12px;cursor:pointer">Забрать</button>' : q.claimed ? '<span style="opacity:.7">Забрано</span>' : ''}
          </div>
        </div>`;

      const btn = wrap.querySelector('.q_claim_btn');
      if (btn){
        btn.onclick = ()=>{
          q.claimed = true;
          addReward(q.reward);
          const arr = lsGet(storageKey, []);
          const idx = arr.findIndex(x=>x.id===q.id);
          if (idx>=0) { arr[idx] = q; lsSet(storageKey, arr); }
          alert('Награда получена!');
          quests.refreshWalletUI();
          quests.renderList();
        };
      }
      body.appendChild(wrap);
    };

    sec('Ежедневные');
    const dkKey = 'quests_daily_'+DAY_KEY(); dqs.forEach(q=> makeItem(q, dkKey));
    sec('Недельные');
    const wkKey = 'quests_weekly_'+WEEK_KEY(); wqs.forEach(q=> makeItem(q, wkKey));

    // Season
    const s = document.createElement('div');
    const prog = seasonProgress(w.sp);
    s.style.marginTop = '8px';
    s.innerHTML = `<div style="opacity:.9;margin:6px 0 8px 0;font-weight:600">Путь сезона</div>
      <div style="font-size:13px;opacity:.9;margin-bottom:6px">Уровень: <b>${seasonLevel(w.sp)}</b> | Очки: <b>${w.sp}</b></div>
      <div style="height:10px;background:rgba(255,255,255,.12);border-radius:8px;overflow:hidden"><div style="height:10px;width:${(prog.cur/prog.need*100)|0}%;background:linear-gradient(90deg,#4ade80,#a3e635,#facc15)"></div></div>`;
    body.appendChild(s);
  },
  // Tracking hooks
  onCollect(type){
    const dkKey = 'quests_daily_'+DAY_KEY();
    const wkKey = 'quests_weekly_'+WEEK_KEY();
    let d = lsGet(dkKey, []); let w = lsGet(wkKey, []);

    // daily
    for (const q of d){
      if (q.id==='d_collect_normal' && type==='normal' && !q.done){ q.cur++; }
      if (q.id==='d_collect_advanced' && type==='advanced' && !q.done){ q.cur++; }
      if (q.id==='d_ar_win'){ /* no op here */ }
      if (q.cur >= q.need){ q.done = true; }
    }
    // weekly
    for (const q of w){
      if (q.id==='w_collect_total' && !q.done){ q.cur++; }
      if (q.cur >= q.need){ q.done = true; }
    }
    lsSet(dkKey, d); lsSet(wkKey, w);
  },
  onARWin(){
    const dkKey = 'quests_daily_'+DAY_KEY();
    const wkKey = 'quests_weekly_'+WEEK_KEY();
    let d = lsGet(dkKey, []); let w = lsGet(wkKey, []);

    for (const q of d){
      if (q.id==='d_ar_win' && !q.done){ q.cur++; if (q.cur >= q.need) q.done = true; }
    }
    for (const q of w){
      if (q.id==='w_ar_wins' && !q.done){ q.cur++; if (q.cur >= q.need) q.done = true; }
    }
    lsSet(dkKey, d); lsSet(wkKey, w);
  }
};

