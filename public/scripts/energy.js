import { supabase } from './supabase.js';
import { getEnergyIcon, getDistance } from './helpers.js';

let energyMarkers = [];

export async function loadEnergyPoints(lat, lng, user, map, playerMarker) {
  try {
    energyMarkers.forEach(marker => map.removeLayer(marker));
    energyMarkers = [];

    const response = await fetch('https://ptkzsrlicfhufdnegwjl.functions.supabase.co/generate-points', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9....'
      },
      body: JSON.stringify({
        center_lat: lat,
        center_lng: lng,
        telegram_id: user.id
      })
    });

    const result = await response.json();
    if (!result.success || !result.points) return;

    result.points
      .filter(p => !p.collected_by || p.collected_by !== user.id.toString())
      .forEach(point => {
        const icon = getEnergyIcon(point.type);

        const marker = L.marker([point.lat, point.lng], { icon }).addTo(map);
        energyMarkers.push(marker);

        marker.on('click', async () => {
          const distance = getDistance(lat, lng, point.lat, point.lng);

          const sound = document.getElementById('energy-sound');
          if (sound) {
            sound.currentTime = 0;
            sound.play();
          }

          if (distance > 0.02) {
            alert("🚫 Подойдите ближе (до 20 м), чтобы собрать энергию.");
            return;
          }

          const { error } = await supabase
            .from('energy_points')
            .update({
              collected_by: user.id.toString(),
              collected_at: new Date().toISOString()
            })
            .eq('id', point.id)
            .is('collected_by', null);

          if (error) {
            alert("🚫 Энергия уже собрана другим игроком.");
            return;
          }

          map.removeLayer(marker);

          const { data: player } = await supabase
            .from('players')
            .select('*')
            .eq('telegram_id', user.id)
            .single();

          if (player) {
            const energyToAdd = Number(point.energy_value) || 0;
            const currentEnergy = Number(player.energy) || 0;
            const maxEnergy = Number(player.energy_max) || 1000;
            const newEnergy = Math.min(currentEnergy + energyToAdd, maxEnergy);

            await supabase
              .from('players')
              .update({ energy: newEnergy })
              .eq('telegram_id', user.id);

            document.getElementById('energy-value').textContent = newEnergy;
            document.getElementById('energy-max').textContent = maxEnergy;
            const percent = Math.floor((newEnergy / maxEnergy) * 100);
            document.getElementById('energy-bar-fill').style.width = percent + "%";

            alert(`⚡ Вы собрали ${energyToAdd} энергии!`);
          }
        });
      });
  } catch (err) {
    console.error("Ошибка загрузки энерготочек:", err);
  }
}
