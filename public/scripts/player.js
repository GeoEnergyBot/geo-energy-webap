import { supabase } from './supabase.js';

export async function setupPlayer(user) {
  const usernameEl = document.getElementById("username");
  const avatarEl = document.getElementById("avatar");

  if (usernameEl) {
    usernameEl.textContent = user?.first_name || user?.username || "Гость";
  }
  if (avatarEl) {
    avatarEl.src = user?.photo_url || "https://cdn-icons-png.flaticon.com/512/9131/9131529.png";
  }

  let level = 1;
  const { data } = await supabase
    .from('players')
    .select('*')
    .eq('telegram_id', user.id)
    .single();

  if (!data) {
    await supabase.from('players').insert([{
      telegram_id: user.id,
      username: user.username,
      first_name: user.first_name,
      avatar_url: user.photo_url
    }]);
  } else {
    level = data.level || 1;
    const currentEnergy = data.energy ?? 0;
    const maxEnergy = data.energy_max ?? 1000;

    document.getElementById('energy-value').textContent = currentEnergy;
    document.getElementById('energy-max').textContent = maxEnergy;

    const percent = Math.floor((currentEnergy / maxEnergy) * 100);
    document.getElementById('energy-bar-fill').style.width = percent + "%";
  }

  return level;
}
