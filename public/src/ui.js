
import { resolveGhostUrl } from './utils.js';

export async function updatePlayerHeader({ username, avatar_url, level, energy, energy_max }){
  const un = document.getElementById('username');
  if (un) un.textContent = username||'Гость';
  const url = await resolveGhostUrl(level||1);
  const img = document.getElementById('avatar'); if (img) img.src = url;
  const lvl = document.getElementById('level-badge'); if (lvl) lvl.textContent = level||1;
  if (typeof energy==='number' && typeof energy_max==='number'){
    const ev=document.getElementById('energy-value'), em=document.getElementById('energy-max');
    const fill=document.getElementById('energy-bar-fill');
    ev.textContent = energy; em.textContent = energy_max;
    const pct = Math.max(0, Math.min(100, Math.floor(energy/energy_max*100)));
    fill.style.width = pct+'%';
  }
}

export function flashPlayerMarker(marker){
  const el = marker?.getElement?.(); if (!el) return;
  el.classList.add('flash');
  setTimeout(()=> el.classList.remove('flash'), 300);
}
