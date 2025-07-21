import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabase = createClient(
  'https://ptkzsrlicfhufdnegwjl.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0a3pzcmxpY2ZodWZkbmVnd2psIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI0NzA3NjAsImV4cCI6MjA2ODA0Njc2MH0.eI0eF_imdgGWPLiUULTprh52Jo9P69WGpe3RbCg3Afo'
);

let tg = window.Telegram.WebApp;
tg.expand();
const user = tg.initDataUnsafe.user;

document.getElementById("username").textContent = user?.first_name || user?.username || "Гость";
document.getElementById("avatar").src = user?.photo_url || "https://cdn-icons-png.flaticon.com/512/9131/9131529.png";

function getGhostIconByLevel(level) {
  const index = Math.min(Math.floor((level - 1) / 10) + 1, 10);
  return `ghost_icons/ghost_level_${String(index).padStart(2, '0')}.png`;
}

function getTileId(lat, lng) {
  return `${Math.floor(lat * 100)}_${Math.floor(lng * 100)}`;
}

function getEnergyIcon(type) {
  let url = '';
  switch (type) {
    case 'rare': url = '/energy_blobs/rare_blob.png'; break;
    case 'advanced': url = '/energy_blobs/advanced_blob.png'; break;
    default: url = '/energy_blobs/normal_blob.png';
  }
  return L.icon({
    iconUrl: url,
    iconSize: [60, 100],
    iconAnchor: [30, 50]
  });
}

function getDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

let map, playerMarker, ghostIcon;
let lastTileId = null;
let initialized = false;
let energyMarkers = [];

(async () => {
  let level = 1;
  if (user) {
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
        avatar_url: user.photo_url,
        level: 1,
        energy: 0,
        energy_max: 1000
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
  }

  ghostIcon = L.icon({
    iconUrl: getGhostIconByLevel(level),
    iconSize: [48, 48],
    iconAnchor: [24, 24],
    popupAnchor: [0, -24]
  });

  if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition((pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      map = L.map('map').setView([lat, lng], 16);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map);

      playerMarker = L.marker([lat, lng], { icon: ghostIcon }).addTo(map).bindPopup("Вы здесь").openPopup();
      lastTileId = getTileId(lat, lng);
      loadEnergyPoints(lat, lng);
      initialized = true;
    });

    navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        if (playerMarker) playerMarker.setLatLng([lat, lng]);
        const tileId = getTileId(lat, lng);
        if (tileId !== lastTileId) {
          lastTileId = tileId;
          loadEnergyPoints(lat, lng);
        }
      },
      (error) => {
        alert("Ошибка геолокации: " + error.message);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 10000,
      }
    );

    setInterval(() => {
      if (initialized && playerMarker) {
        const latlng = playerMarker.getLatLng();
        loadEnergyPoints(latlng.lat, latlng.lng);
      }
    }, 60000);
  }
})();

async function loadEnergyPoints(centerLat, centerLng) {
  try {
    energyMarkers.forEach(marker => map.removeLayer(marker));
    energyMarkers = [];

    const response = await fetch('https://ptkzsrlicfhufdnegwjl.functions.supabase.co/generate-points', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0a3pzcmxpY2ZodWZkbmVnd2psIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI0NzA3NjAsImV4cCI6MjA2ODA0Njc2MH0.eI0eF_imdgGWPLiUULTprh52Jo9P69WGpe3RbCg3Afo'
      },
      body: JSON.stringify({
        center_lat: centerLat,
        center_lng: centerLng,
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
          const distance = getDistance(centerLat, centerLng, point.lat, point.lng);
          
          // 🎵 Звук
          const sound = document.getElementById('energy-sound');
          if (sound) {
            sound.currentTime = 0;
            sound.play();
          }

          // ⚡ Эффект "энергия летит к игроку"
          const animatedCircle = L.circleMarker([point.lat, point.lng], {
            radius: 10,
            color: "#00ff00",
            fillColor: "#00ff00",
            fillOpacity: 0.8
          }).addTo(map);

          const start = L.latLng(point.lat, point.lng);
          const end = playerMarker.getLatLng();

          let progress = 0;
          const duration = 500;
          const startTime = performance.now();

          function animate(timestamp) {
            progress = (timestamp - startTime) / duration;
            if (progress >= 1) {
              map.removeLayer(animatedCircle);

              // ⚡ Вспышка вокруг игрока
              const playerEl = playerMarker.getElement();
              if (playerEl) {
                playerEl.classList.add('flash');
                setTimeout(() => playerEl.classList.remove('flash'), 300);
              }
              return;
            }

            const lat = start.lat + (end.lat - start.lat) * progress;
            const lng = start.lng + (end.lng - start.lng) * progress;
            animatedCircle.setLatLng([lat, lng]);
            requestAnimationFrame(animate);
          if (distance > 0.02) {
            alert("🚫 Подойдите ближе (до 20 м), чтобы собрать энергию.");
            return;
          }

          const energyToAdd = Number(point.energy_value);
          if (!energyToAdd || energyToAdd <= 0) {
            alert("⚠️ Точка энергии некорректна или пуста.");
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
            let energy = player.energy || 0;
            let level = player.level || 1;
            let maxEnergy = player.energy_max || 1000;

            energy += energyToAdd;
            let leveledUp = false;
            const levelUpThreshold = (lvl) => lvl * 1000;

            while (energy >= levelUpThreshold(level)) {
              energy -= levelUpThreshold(level);
              level++;
              leveledUp = true;
            }

            const newMaxEnergy = 1000 + (level - 1) * 200;

            await supabase.from('players').update({
              energy,
              level,
              energy_max: newMaxEnergy
            }).eq('telegram_id', user.id);

            document.getElementById('energy-value').textContent = energy;
            document.getElementById('energy-max').textContent = newMaxEnergy;
            const percent = Math.floor((energy / newMaxEnergy) * 100);
            document.getElementById('energy-bar-fill').style.width = percent + "%";

            const newIcon = getGhostIconByLevel(level);
            playerMarker.setIcon(L.icon({
              iconUrl: newIcon,
              iconSize: [48, 48],
              iconAnchor: [24, 24],
              popupAnchor: [0, -24]
            }));

            if (leveledUp) {
              alert(`🎉 Уровень повышен! Теперь ваш уровень: ${level}`);
            } else {
              alert(`⚡ Вы собрали ${energyToAdd} энергии!`);
            }
          }
        });
      });
  } catch (error) {
    console.error("Ошибка загрузки точек:", error);
  }
}
