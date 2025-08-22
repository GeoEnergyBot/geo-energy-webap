import { resolveGhostUrl } from './utils.js';

function setText(id, value) { const el = document.getElementById(id); if (el) el.textContent = value; }
function el(id) { return document.getElementById(id); }

export async function updatePlayerHeader(p = {}) {
  const username   = p.username || p.first_name || 'Игрок';
  const level      = Number(p.level ?? 1)   || 1;
  const energy     = Number(p.energy ?? 0)  || 0;
  const energyMax  = Number(p.energy_max ?? 1000) || 1000;

  setText('username', username);

  const avatarEl = el('avatar');
  if (avatarEl) {
    try { avatarEl.src = await resolveGhostUrl(level); } catch {}
  }

  setText('level-badge', String(level));

  const val = el('energy-value'); const max = el('energy-max'); const fill = el('energy-bar-fill');
  if (val && max && fill) {
    val.textContent = String(energy);
    max.textContent = String(energyMax);
    const pct = Math.max(0, Math.min(100, Math.floor((energy / Math.max(1, energyMax)) * 100)));
    fill.style.width = pct + '%';
  }

  if ('dust' in p)    setText('dust',    String(p.dust ?? 0));
  if ('stamina' in p) setText('stamina', String(p.stamina ?? 0));
  if ('sp' in p)      setText('sp',      String(p.sp ?? 0));

  const vip = el('vip-badge');
  if (vip) {
    const until = p.vip_until ? new Date(p.vip_until) : null;
    const active = !!until && until.getTime() > Date.now();
    vip.style.display = active ? 'inline-flex' : 'none';
    if (active) vip.title = `VIP активно до ${until.toLocaleString()}`;
  }
}

export function flashPlayerMarker(marker) {
  const node = marker?.getElement?.(); if (!node) return;
  node.classList.add('flash'); setTimeout(() => node.classList.remove('flash'), 300);
}

export function showToast(message, kind = 'info', ms = 1800) {
  try {
    let wrap = el('toast-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'toast-wrap';
      Object.assign(wrap.style, {
        position: 'fixed', left: '50%', bottom: '22px', transform: 'translateX(-50%)',
        zIndex: 2000, display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center',
        pointerEvents: 'none'
      });
      document.body.appendChild(wrap);
    }
    const t = document.createElement('div');
    t.textContent = message;
    Object.assign(t.style, {
      maxWidth: '86vw',
      background: kind === 'error' ? '#7f1d1d' : (kind === 'ok' ? '#065f46' : '#111827'),
      color: '#fff', border: '1px solid rgba(255,255,255,.18)', boxShadow: '0 10px 30px rgba(0,0,0,.45)',
      borderRadius: '12px', padding: '10px 12px', fontSize: '14px', pointerEvents: 'auto'
    });
    wrap.appendChild(t);
    setTimeout(() => { try { wrap.removeChild(t); } catch {} }, ms);
  } catch {}
}

export function setBusy(flag, text = 'Загрузка...') {
  let bar = el('busy-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'busy-bar';
    Object.assign(bar.style, {
      position: 'absolute', left: '50%', top: '56px', transform: 'translateX(-50%)',
      background: '#111827', color: '#fff', border: '1px solid rgba(255,255,255,.18)',
      boxShadow: '0 8px 20px rgba(0,0,0,.35)', borderRadius: '10px', padding: '6px 10px',
      zIndex: 1600, fontSize: '12px', display: 'none'
    });
    document.body.appendChild(bar);
  }
  bar.textContent = text;
  bar.style.display = flag ? 'block' : 'none';
}