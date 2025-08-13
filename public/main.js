// 🔌 Supabase-клиент
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabase = createClient(
  'https://ptkzsrlicfhufdnegwjl.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0a3pzcmxpY2ZodWZkbmVnd2psIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI0NzA3NjAsImV4cCI6MjA2ODA0Njc2MH0.eI0eF_imdgGWPLiUULTprh52Jo9P69WGpe3RbCg3Afo'
);

// 📦 Telegram WebApp (фолбэк для локального запуска)
const tg = window.Telegram?.WebApp;
if (tg) tg.expand();
const user = tg?.initDataUnsafe?.user ?? { id: 'guest', first_name: 'Гость', username: 'guest' };

// 🧩 Утилиты
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
    case 'rare': url = 'energy_blobs/rare_blob.png'; break;
    case 'advanced': url = 'energy_blobs/advanced_blob.png'; break;
    default: url = 'energy_blobs/normal_blob.png';
  }
  return L.icon({
    iconUrl: url,
    iconSize: [60, 100],
    iconAnchor: [30, 50]
  });
}

// Возвращает расстояние в КИЛОМЕТРАХ
function getDistanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// 🗺️ Состояние
let map, playerMarker, ghostIcon;
let lastTileId = null;
let energyMarkers = [];
let isLoadingPoints = false;

// 👤 Инициализация UI игрока
function updatePlayerHeader({ username, avatar_url, level, energy, energy_max }) {
  document.getElementById("username").textContent = username || "Гость";
  document.getElementById("avatar").src = avatar_url || "https://cdn-icons-png.flaticon.com/512/9131/9131529.png";
  document.getElementById("level-badge").textContent = level ?? 1;
  if (typeof energy === "number" && typeof energy_max === "number") {
    document.getElementById('energy-value').textContent = energy;
    document.getElementById('energy-max').textContent = energy_max;
    const percent = Math.max(0, Math.min(100, Math.floor((energy / energy_max) * 100)));
    document.getElementById('energy-bar-fill').style.width = percent + "%";
  }
}

// 🚀 Основной запуск
(async () => {
  // 1) Получаем игрока из БД / создаём при отсутствии
  let level = 1, energy = 0, energy_max = 1000;
  const tid = String(user.id);

  if (tid !== 'guest') {
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('telegram_id', tid)
      .maybeSingle();

    if (error) console.warn('Ошибка загрузки игрока:', error);

    if (!data) {
      const { error: insertErr } = await supabase.from('players').insert([{
        telegram_id: tid,
        username: user.username,
        first_name: user.first_name,
        avatar_url: user.photo_url
      }]);
      if (insertErr) console.warn('Ошибка создания игрока:', insertErr);
    } else {
      level = data.level ?? 1;
      energy = data.energy ?? 0;
      energy_max = data.energy_max ?? 1000;
      updatePlayerHeader({
        username: data.first_name || data.username,
        avatar_url: data.avatar_url,
        level,
        energy,
        energy_max
      });
    }
  } else {
    updatePlayerHeader({
      username: 'Гость',
      avatar_url: '',
      level,
      energy,
      energy_max
    });
  }

  // 2) Иконка призрака по уровню
  ghostIcon = L.icon({
    iconUrl: getGhostIconByLevel(level),
    iconSize: [48, 48],
    iconAnchor: [24, 24],
    popupAnchor: [0, -24]
  });

  // 3) Инициализация карты и геолокации
  const onPosition = (pos) => {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;

    if (!map) {
      map = L.map('map').setView([lat, lng], 16);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
      playerMarker = L.marker([lat, lng], { icon: ghostIcon }).addTo(map).bindPopup("Вы здесь").openPopup();
      lastTileId = getTileId(lat, lng);
      loadEnergyPoints(lat, lng);
    } else {
      playerMarker.setLatLng([lat, lng]);
      const tileId = getTileId(lat, lng);
      if (tileId !== lastTileId) {
        lastTileId = tileId;
        loadEnergyPoints(lat, lng);
      }
    }
  };

  const onPositionError = (error) => {
    console.warn("Ошибка геолокации:", error?.message || error);
    // Фолбэк на фиксированные координаты (центр Астаны)
    const lat = 51.128, lng = 71.431;
    map = L.map('map').setView([lat, lng], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
    playerMarker = L.marker([lat, lng], { icon: ghostIcon }).addTo(map).bindPopup("Вы здесь").openPopup();
    lastTileId = getTileId(lat, lng);
    loadEnergyPoints(lat, lng);
    alert("Геолокация недоступна. Используются примерные координаты.");
  };

  if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition(onPosition, onPositionError);
    navigator.geolocation.watchPosition(onPosition, (e) => console.warn('watchPosition error', e), {
      enableHighAccuracy: true,
      maximumAge: 1000,
      timeout: 10000,
    });
    // Периодический рефреш актуального тайла (дебаунс)
    setInterval(() => {
      if (!map || !playerMarker) return;
      const { lat, lng } = playerMarker.getLatLng();
      loadEnergyPoints(lat, lng);
    }, 60000);
  } else {
    onPositionError(new Error("Геолокация не поддерживается."));
  }
})();

// 📥 Загрузка точек энергии (с защитой от повторных запросов)
async function loadEnergyPoints(centerLat, centerLng) {
  if (isLoadingPoints) return;
  isLoadingPoints = true;
  try {
    // Очищаем старые маркеры
    energyMarkers.forEach(m => map && map.removeLayer(m.marker));
    energyMarkers = [];

    const response = await fetch('https://ptkzsrlicfhufdnegwjl.functions.supabase.co/generate-points', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0a3pzcmxpY2ZodWZkbmVnd2psIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI0NzA3NjAsImV4cCI6MjA2ODA0Njc2MH0.eI0eF_imdgGWPLiUULTprh52Jo9P69WGpe3RbCg3Afo'
      },
      body: JSON.stringify({
        action: "generate",
        center_lat: centerLat,
        center_lng: centerLng,
        telegram_id: String(user.id)
      })
    });

    if (!response.ok) throw new Error('generate-points HTTP ' + response.status);
    const result = await response.json();
    if (!result.success || !Array.isArray(result.points)) return;

    const uid = String(user.id);

    result.points
      .filter(p => !p.collected_by || String(p.collected_by) !== uid)
      .forEach((point) => {
        const icon = getEnergyIcon(point.type);
        const marker = L.marker([point.lat, point.lng], { icon }).addTo(map);
        energyMarkers.push({ id: point.id, marker });

        marker.on('click', async () => {
          if (!playerMarker) return;
          const playerPos = playerMarker.getLatLng();
          const distanceKm = getDistanceKm(playerPos.lat, playerPos.lng, point.lat, point.lng);
          if (distanceKm > 0.02) { // 0.02 км = 20 м
            alert("🚫 Подойдите ближе (до 20 м), чтобы собрать энергию.");
            return;
          }

          // Анимация поглощения
          const sound = document.getElementById('energy-sound');
          if (sound) { try { sound.currentTime = 0; await sound.play(); } catch (_) {} }

          const animatedCircle = L.circleMarker([point.lat, point.lng], {
            radius: 10, color: "#00ff00", fillColor: "#00ff00", fillOpacity: 0.8
          }).addTo(map);

          const start = L.latLng(point.lat, point.lng);
          const end = playerPos;
          const duration = 500;
          const startTime = performance.now();

          function animate(ts) {
            const progress = Math.min(1, (ts - startTime) / duration);
            const lat = start.lat + (end.lat - start.lat) * progress;
            const lng = start.lng + (end.lng - start.lng) * progress;
            animatedCircle.setLatLng([lat, lng]);
            if (progress < 1) requestAnimationFrame(animate);
            else map.removeLayer(animatedCircle);
          }
          requestAnimationFrame(animate);

          // Запрос на сбор
          const res = await fetch('https://ptkzsrlicfhufdnegwjl.functions.supabase.co/generate-points', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0a3pzcmxpY2ZodWZkbmVnd2psIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI0NzA3NjAsImV4cCI6MjA2ODA0Njc2MH0.eI0eF_imdgGWPLiUULTprh52Jo9P69WGpe3RbCg3Afo'
            },
            body: JSON.stringify({
              action: "collect",
              telegram_id: String(user.id),
              point_id: point.id
            })
          });

          const collectResult = await res.json();
          if (!collectResult.success) {
            alert("🚫 Ошибка сбора энергии: " + (collectResult.error || "Неизвестно"));
            return;
          }

          // Удаляем маркер и из массива
          const idx = energyMarkers.findIndex(x => x.id === point.id);
          if (idx >= 0) {
            map.removeLayer(energyMarkers[idx].marker);
            energyMarkers.splice(idx, 1);
          }

          // ⬇️ Берём актуальные данные игрока ПРЯМО из ответа сервера
          const p = collectResult.player;
          if (!p) {
            // Фолбэк: если по какой-то причине сервер не вернул player
            alert("ℹ️ Энергия собрана, но не удалось получить данные игрока.");
            return;
          }

          // UI обновление
          updatePlayerHeader({
            username: p.first_name || p.username,
            avatar_url: p.avatar_url,
            level: p.level,
            energy: p.energy,
            energy_max: p.energy_max
          });

          // Обновляем иконку призрака по новому уровню
          if (playerMarker) {
            playerMarker.setIcon(L.icon({
              iconUrl: getGhostIconByLevel(p.level),
              iconSize: [48, 48],
              iconAnchor: [24, 24],
              popupAnchor: [0, -24]
            }));
          }

          // Небольшой визуальный фидбек
          const playerEl = playerMarker?.getElement?.();
          if (playerEl) {
            playerEl.classList.add('flash');
            setTimeout(() => playerEl.classList.remove('flash'), 300);
          }

          alert(`⚡ Собрано: ${collectResult.point_energy_value} энергии. Уровень: ${p.level}`);
        });
      });

  } catch (error) {
    console.error("Ошибка загрузки точек:", error);
  } finally {
    isLoadingPoints = false;
  }
}
