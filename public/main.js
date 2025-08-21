// 🔌 Supabase-клиент
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// ⛳ ВСТАВЬТЕ СВОИ ДАННЫЕ:
const SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';          // <-- замените
const SUPABASE_ANON_KEY = 'YOUR_PUBLIC_ANON_KEY';                  // <-- замените

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 📦 Telegram WebApp (фолбэк для локального запуска)
const tg = window.Telegram?.WebApp;
if (tg) tg.expand();
const user = tg?.initDataUnsafe?.user ?? { id: 'guest', first_name: 'Гость', username: 'guest' };

// 🧩 Утилиты
function getGhostIconByLevel(level) {
  const lvl = Math.max(1, Math.min(100, Math.floor(level || 1)));
  return `assets/ghosts/ghost_${String(lvl).padStart(3, '0')}.png`;
}

// Leaflet-иконка для игрока (призрак)
function makeLeafletGhostIcon(level) {
  return L.icon({
    iconUrl: getGhostIconByLevel(level),
    iconSize: [64, 64],
    iconAnchor: [32, 32],
    popupAnchor: [0, -28],
  });
}

// ID «тайла» для триггера перезагрузки точек
function getTileId(lat, lng) {
  return `${Math.floor(lat * 100)}_${Math.floor(lng * 100)}`; // ~100м грид
}

// Пульсирующие кляксы через L.divIcon (под ваши CSS в style.css)
function makeEnergyDivIcon(type) {
  const cls =
    type === 'rare' ? 'rare' :
    type === 'advanced' ? 'advanced' : 'basic';
  const html =
    `<div class="custom-energy-icon ${cls}">
       <div class="energy-pulse"></div>
     </div>`;
  return L.divIcon({
    html,
    className: '',   // чтобы не было дефолтного класса leaflet-div-icon
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

// Расстояние (км) — для проверки 20 м (0.02 км)
function getDistanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 +
    Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
    Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Тосты
function showToast(message, type='info', ms=2500) {
  const container = document.getElementById('toast-container');
  if (!container) return alert(message);
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => {
    el.style.animation = 'toast-out 220ms ease forwards';
    setTimeout(() => container.removeChild(el), 220);
  }, ms);
}

// 🗺️ Состояние
let map, playerMarker, ghostIcon;
let lastTileId = null;

// Карта маркеров: id → { marker, lock }
const energyMarkers = new Map();
let isLoadingPoints = false;

// 👤 Хедер игрока
function updatePlayerHeader({ username, avatar_url, level, energy, energy_max }) {
  document.getElementById("username").textContent = username || "Гость";
  document.getElementById("level-badge").textContent = level ?? 1;

  // Скин по уровню
  const headerIcon = getGhostIconByLevel(level ?? 1);
  document.getElementById("avatar").src = headerIcon;

  if (typeof energy === "number" && typeof energy_max === "number") {
    document.getElementById('energy-value').textContent = energy;
    document.getElementById('energy-max').textContent = energy_max;
    const percent = Math.max(0, Math.min(100, Math.floor((energy / energy_max) * 100)));
    document.getElementById('energy-bar-fill').style.width = percent + "%";
  }

  // Обновляем иконку на карте (игрок)
  if (typeof level === "number" && playerMarker) {
    ghostIcon = makeLeafletGhostIcon(level);
    playerMarker.setIcon(ghostIcon);
  }
}

// 🚀 Основной запуск
(async () => {
  // 1) Получаем/создаём игрока
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
      const { data: ins, error: insertErr } = await supabase.from('players').insert([{
        telegram_id: tid,
        username: user.username,
        first_name: user.first_name,
        avatar_url: user.photo_url
      }]).select().maybeSingle();

      if (insertErr) {
        console.warn('Ошибка создания игрока:', insertErr);
      } else if (ins) {
        level = ins.level ?? 1;
        energy = ins.energy ?? 0;
        energy_max = ins.energy_max ?? 1000;
      }
      updatePlayerHeader({
        username: user.first_name || user.username || 'Игрок',
        avatar_url: '',
        level,
        energy,
        energy_max
      });
    } else {
      level = data.level ?? 1;
      energy = data.energy ?? 0;
      energy_max = data.energy_max ?? 1000;
      updatePlayerHeader({
        username: data.first_name || data.username || 'Игрок',
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

  // 2) Иконка призрака на карте
  ghostIcon = makeLeafletGhostIcon(level);

  // 3) Геолокация
  const onPosition = (pos) => {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;

    if (!map) {
      map = L.map('map').setView([lat, lng], 16);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

      playerMarker = L.marker([lat, lng], { icon: ghostIcon })
        .addTo(map)
        .bindPopup("Вы здесь")
        .openPopup();

      lastTileId = getTileId(lat, lng);
      loadEnergyPoints(lat, lng, /*force*/ true);
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
    // Фолбэк: центр Астаны
    const lat = 51.128, lng = 71.431;
    map = L.map('map').setView([lat, lng], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
    playerMarker = L.marker([lat, lng], { icon: ghostIcon }).addTo(map).bindPopup("Вы здесь").openPopup();
    lastTileId = getTileId(lat, lng);
    loadEnergyPoints(lat, lng, /*force*/ true);
    showToast("Геолокация недоступна. Используются примерные координаты.", "error", 3500);
  };

  if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition(onPosition, onPositionError);
    navigator.geolocation.watchPosition(onPosition, (e) => console.warn('watchPosition error', e), {
      enableHighAccuracy: true,
      maximumAge: 1000,
      timeout: 10000,
    });
    // Периодический рефреш текущего тайла (на всякий случай)
    setInterval(() => {
      if (!map || !playerMarker) return;
      const p = playerMarker.getLatLng();
      loadEnergyPoints(p.lat, p.lng);
    }, 60000);
  } else {
    onPositionError(new Error('Геолокация не поддерживается'));
  }
})();

// ⚡ Загрузка точек: дифф-обновление и клик-лок
async function loadEnergyPoints(lat, lng, force=false) {
  if (isLoadingPoints && !force) return;
  isLoadingPoints = true;

  try {
    const url = `${SUPABASE_URL}/functions/v1/generate-points`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'GeoEnergyBot' },
      body: JSON.stringify({
        action: 'generate',
        lat, lng,
        telegram_id: String(user.id),
      })
    });

    if (!res.ok) {
      console.warn('generate-points HTTP', res.status);
      isLoadingPoints = false;
      return;
    }

    const result = await res.json();
    if (!result.success || !Array.isArray(result.points)) {
      isLoadingPoints = false;
      return;
    }

    const uid = String(user.id);
    // Формируем Set актуальных id
    const nextIds = new Set();

    result.points
      .filter(p => !p.collected_by || String(p.collected_by) !== uid)
      .forEach((point) => {
        nextIds.add(point.id);
        const exists = energyMarkers.get(point.id);

        if (exists) {
          // можно обновить позицию/тип, если изменилось
          const pos = exists.marker.getLatLng();
          if (pos.lat !== point.lat || pos.lng !== point.lng) {
            exists.marker.setLatLng([point.lat, point.lng]);
          }
          // тип можно игнорировать или заменить иконку при необходимости
          return;
        }

        const icon = makeEnergyDivIcon(point.type);
        const marker = L.marker([point.lat, point.lng], { icon }).addTo(map);

        // сохраняем
        energyMarkers.set(point.id, { marker, lock: false });

        // обработчик клика
        marker.on('click', async () => {
          if (!playerMarker) return;

          const record = energyMarkers.get(point.id);
          if (!record || record.lock) return; // анти-двойной клик
          record.lock = true;

          const playerPos = playerMarker.getLatLng();
          const distanceKm = getDistanceKm(playerPos.lat, playerPos.lng, point.lat, point.lng);
          if (distanceKm > 0.02) { // 20 м
            showToast("Подойдите ближе (до 20 м), чтобы собрать энергию.", "info");
            record.lock = false;
            return;
          }

          // Анимация поглощения
          const sound = document.getElementById('energy-sound');
          if (sound) { try { sound.currentTime = 0; await sound.play(); } catch (_) {} }

          const animatedCircle = L.circleMarker([point.lat, point.lng], {
            radius: 10, color: "#00ff00", fillColor: "#00ff00", fillOpacity: 0.85
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
          try {
            const collectRes = await fetch(`${SUPABASE_URL}/functions/v1/generate-points`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'GeoEnergyBot' },
              body: JSON.stringify({
                action: 'collect',
                point_id: point.id,
                telegram_id: String(user.id),
                lat: playerPos.lat,
                lng: playerPos.lng
              })
            });

            const collectResult = await collectRes.json();
            if (!collectRes.ok || !collectResult.success) {
              showToast("Ошибка сбора энергии: " + (collectResult.error || collectRes.status), "error", 3500);
              record.lock = false;
              return;
            }

            // Удаляем маркер с карты и из Map
            if (energyMarkers.has(point.id)) {
              map.removeLayer(record.marker);
              energyMarkers.delete(point.id);
            }

            // Обновляем игрока из ответа сервера
            const p = collectResult.player;
            if (p) {
              updatePlayerHeader({
                username: p.first_name || p.username,
                avatar_url: getGhostIconByLevel(p.level),
                level: p.level,
                energy: p.energy,
                energy_max: p.energy_max
              });

              // Вспышка вокруг игрока
              const playerEl = playerMarker._icon;
              if (playerEl) {
                playerEl.classList.add('flash');
                setTimeout(() => playerEl.classList.remove('flash'), 300);
              }

              showToast(`⚡ +${collectResult.point_energy_value} энергии. Уровень: ${p.level}`, "success");
            } else {
              showToast("Энергия собрана, но нет данных игрока.", "info");
            }

          } catch (err) {
            console.error('collect error', err);
            showToast("Сбой запроса сбора", "error");

          } finally {
            // снятие лок-флага не требуется, т.к. маркер удалён;
            // если не удалён — снимаем
            const rec = energyMarkers.get(point.id);
            if (rec) rec.lock = false;
          }
        });
      });

    // Удаляем отсутствующие в nextIds
    for (const [id, rec] of energyMarkers.entries()) {
      if (!nextIds.has(id)) {
        map.removeLayer(rec.marker);
        energyMarkers.delete(id);
      }
    }

  } catch (error) {
    console.error("Ошибка загрузки точек:", error);
  } finally {
    isLoadingPoints = false;
  }
}
