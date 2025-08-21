import { resolveGhostUrl } from './utils.js';

export async function updatePlayerHeader({ username, avatar_url, level, energy, energy_max }) {
  document.getElementById("username").textContent = username || "Гость";

  // Надёжно подбираем спрайт (ghost_icons/ или assets/ghosts/)
  const url = await resolveGhostUrl(level ?? 1);
  const img = document.getElementById("avatar");
  img.src = url;

  document.getElementById("level-badge").textContent = level ?? 1;

  if (typeof energy === "number" && typeof energy_max === "number") {
    document.getElementById('energy-value').textContent = energy;
    document.getElementById('energy-max').textContent = energy_max;
    const percent = Math.max(0, Math.min(100, Math.floor((energy / energy_max) * 100)));
    document.getElementById('energy-bar-fill').style.width = percent + "%";
  }
}

// Вспышка маркера игрока
export function flashPlayerMarker(playerMarker) {
  const el = playerMarker?.getElement?.();
  if (!el) return;
  el.classList.add('flash');
  setTimeout(() => el.classList.remove('flash'), 300);
}
