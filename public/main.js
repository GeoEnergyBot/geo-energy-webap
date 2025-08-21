// 🔌 Supabase-клиент
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://ptkzsrlicfhufdnegwjl.supabase.co';
const SUPABASE_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0a3pzcmxpY2ZodWZkbmVnd2psIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI0NzA3NjAsImV4cCI6MjA2ODA0Njc2MH0.eI0eF_imdgGWPLiUULTprh52Jo9P69WGpe3RbCg3Afo';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

// 📦 Telegram WebApp (фолбэк для локального запуска)
const tg = window.Telegram?.WebApp;
if (tg) tg.expand();
const user = tg?.initDataUnsafe?.user ?? { id: 'guest', first_name: 'Гость', username: 'guest' };

// ===== Константы AR =====
const TARGETS_MIND_URL =
  'https://cdn.jsdelivr.net/gh/hiukim/mind-ar-js@1.1.4/examples/image-tracking/assets/card-example/card.mind';

// 🧩 Утилиты
function getGhostIconByLevel(level) {
  const lvl = Math.max(1, Math.min(100, Math.floor(level || 1)));
  return `assets/ghosts/ghost_${String(lvl).padStart(3, '0')}.png`;
}
function makeLeafletGhostIcon(level) {
  return L.icon({
    iconUrl: getGhostIconByLevel(level),
    iconSize: [64, 64],
    iconAnchor: [32, 32],
    popupAnchor: [0, -28]
  });
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
  return L.icon({ iconUrl: url, iconSize: [60, 100], iconAnchor: [30, 50] });
}
function getDistanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 +
    Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180) *
    Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// 🗺️ Состояние
let map, playerMarker, ghostIcon;
let lastTileId = null;
let energyMarkers = [];
let isLoadingPoints = false;

// ======== AR (MindAR image-tracking + фолбэк) ========
let arMarker = null;      // маркер на карте для входа в AR
let mindarThree = null;   // инстанс MindARThree

// Создать AR-точку примерно в 15 м восточнее игрока
function spawnArDemoPointNear(lat, lng) {
  const meters = 15;
  const dLng = (meters / (111_320 * Math.cos(lat * Math.PI / 180)));
  const sLat = lat;
  const sLng = lng + dLng;

  if (arMarker) { map.removeLayer(arMarker); arMarker = null; }
  const icon = L.divIcon({
    html: `<div style="
      width:44px;height:44px;border-radius:50%;
      display:grid;place-items:center;
      background: radial-gradient(circle at 30% 30%, rgba(255,255,255,.9), rgba(0,200,255,.35));
      border:2px solid rgba(255,255,255,.6);
      box-shadow:0 8px 22px rgba(0,0,0,.45);
      font-size:26px;">👾</div>`,
    className: '',
    iconSize: [44, 44],
    iconAnchor: [22, 22]
  });

  arMarker = L.marker([sLat, sLng], { icon })
    .addTo(map)
    .bindPopup('AR-существо: подойдите ближе и нажмите');

  arMarker.on('click', () => {
    if (!playerMarker) return;
    const p = playerMarker.getLatLng();
    const km = getDistanceKm(p.lat, p.lng, sLat, sLng);
    if (km > 0.02) { alert('Подойдите ближе (до 20 м), чтобы включить AR.'); return; }
    openArModalWithMindAR();
  });
}

// Открыть AR-модалку и запустить MindAR (с фолбэком на обычную камеру)
async function openArModalWithMindAR() {
  const modal = document.getElementById('ar-modal');
  const closeBtn = document.getElementById('ar-close');
  const catchBtn = document.getElementById('catch-btn');
  const stage = document.getElementById('ar-stage');

  modal.classList.remove('hidden');
  catchBtn.disabled = true;
  catchBtn.style.opacity = 0.6;

  let cleanup = () => {};

  const close = () => {
    try { cleanup(); } catch (_) {}
    modal.classList.add('hidden');
    stage.innerHTML = ''; // убрать видео/канвасы MindAR или фолбэка
  };
  closeBtn.onclick = close;

  // Попытка MindAR
  try {
    mindarThree = new window.MINDAR.IMAGE.MindARThree({
      container: stage,
      imageTargetSrc: TARGETS_MIND_URL,
      videoSettings: { facingMode: { ideal: 'environment' } },
      uiScanning: true,
      uiLoading: true,
    });

    const { renderer, scene, camera } = mindarThree;

    const hemi = new THREE.HemisphereLight(0xffffff, 0x222222, 1.0);
    scene.add(hemi);

    const anchor = mindarThree.addAnchor(0);

    // «Основание» на маркере (как тень)
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(0.6, 36),
      new THREE.MeshBasicMaterial({ color: 0x00ffd0, transparent: true, opacity: 0.15 })
    );
    ground.rotation.x = -Math.PI/2;
    anchor.group.add(ground);

    // «Покемон» — шарик; можно заменить GLB через GLTFLoader
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 32, 32),
      new THREE.MeshStandardMaterial({ color: 0x66ccff, roughness: 0.35, metalness: 0.15 })
    );
    body.position.y = 0.4;
    anchor.group.add(body);

    let t = 0;
    let anchorVisible = false;
    anchor.onTargetFound = () => { anchorVisible = true; catchBtn.disabled = false; catchBtn.style.opacity = 1; };
    anchor.onTargetLost  = () => { anchorVisible = false; catchBtn.disabled = true;  catchBtn.style.opacity = .6; };

    await mindarThree.start(); // если бросит исключение — фолбэк ниже

    renderer.setAnimationLoop(() => {
      t += 0.02;
      body.position.y = 0.4 + Math.sin(t) * 0.05;
      renderer.render(scene, camera);
    });

    cleanup = () => {
      try {
        mindarThree.stop();
        mindarThree.renderer.setAnimationLoop(null);
        mindarThree.renderer.dispose();
      } catch(_) {}
      mindarThree = null;
    };

    catchBtn.onclick = () => {
      if (!anchorVisible) return;
      alert('Покемон пойман');
      close();
    };

    return; // MindAR успешно запущен
  } catch (err) {
    console.warn('MindAR не стартовал, включаю фолбэк камеры:', err);
  }

  // Фолбэк: обычная камера через getUserMedia (без трекинга)
  try {
    const video = document.createElement('video');
    video.setAttribute('autoplay', '');
    video.setAttribute('playsinline', '');
    video.muted = true;
    Object.assign(video.style, {
      position: 'absolute', inset: '0', width: '100%', height: '100%', objectFit: 'cover'
    });
    stage.appendChild(video);

    // Сначала просим заднюю камеру, при отказе — фронталку
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
    } catch {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    }
    video.srcObject = stream;
    await video.play();

    cleanup = () => { try { stream.getTracks().forEach(t => t.stop()); } catch(_) {} };

    catchBtn.disabled = false;
    catchBtn.style.opacity = 1;
    catchBtn.onclick = () => { alert('Покемон пойман'); close(); };

  } catch (err2) {
    console.error('Камера не запустилась даже в фолбэке:', err2);
    alert('Не удалось получить доступ к камере. Проверьте разрешения Telegram на камеру и HTTPS.');
    close();
  }
}

// 👤 Шапка игрока
function updatePlayerHeader({ username, avatar_url, level, energy, energy_max }) {
  document.getElementById("username").textContent = username || "Гость";
  const headerIcon = getGhostIconByLevel(level ?? 1);
  document.getElementById("avatar").src = headerIcon;
  document.getElementById("level-badge").textContent = level ?? 1;
  if (typeof energy === "number" && typeof energy_max === "number") {
    document.getElementById('energy-value').textContent = energy;
    document.getElementById('energy-max').textContent = energy_max;
    const percent = Math.max(0, Math.min(100, Math.floor((energy / energy_max) * 100)));
    document.getElementById('energy-bar-fill').style.width = percent + "%";
  }
}

// 🔁 Базовые слои карты (Carto Dark + переключатель)
function buildBaseLayers() {
  const cartoDark = L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    { attribution: '&copy; OpenStreetMap &copy; CARTO', subdomains: 'abcd', maxZoom: 20 }
  );
  const osm = L.tileLayer(
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }
  );
  const esriSat = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { maxZoom: 19, attribution: 'Tiles &copy; Esri' }
  );
  return { cartoDark, osm, esriSat };
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
      if (insertErr) console.warn('Ошибка создания игрока:', insertErr);
      if (ins) {
        level = ins.level ?? 1;
        energy = ins.energy ?? 0;
        energy_max = ins.energy_max ?? 1000;
      }
      updatePlayerHeader({
        username: user.first_name || user.username || 'Игрок',
        avatar_url: '',
        level, energy, energy_max
      });
    } else {
      level = data.level ?? 1;
      energy = data.energy ?? 0;
      energy_max = data.energy_max ?? 1000;
      updatePlayerHeader({
        username: data.first_name || data.username || 'Игрок',
        avatar_url: data.avatar_url,
        level, energy, energy_max
      });
    }
  } else {
    updatePlayerHeader({ username: 'Гость', avatar_url: '', level, energy, energy_max });
  }

  // 2) Иконка призрака
  ghostIcon = makeLeafletGhostIcon(level);

  // 3) Геолокация/карта
  const onPosition = (pos) => {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;

    if (!map) {
      const { cartoDark, osm, esriSat } = buildBaseLayers();
      map = L.map('map', { center: [lat, lng], zoom: 16, layers: [cartoDark] });
      L.control.layers(
        { 'Carto Dark (рекомендовано)': cartoDark, 'OSM': osm, 'ESRI Спутник': esriSat },
        null, { position: 'topright', collapsed: true }
      ).addTo(map);

      playerMarker = L.marker([lat, lng], { icon: ghostIcon }).addTo(map).bindPopup("Вы здесь").openPopup();
      lastTileId = getTileId(lat, lng);

      loadEnergyPoints(lat, lng);
      spawnArDemoPointNear(lat, lng); // AR-точка рядом

    } else {
      playerMarker.setLatLng([lat, lng]);
      const tileId = getTileId(lat, lng);
      if (tileId !== lastTileId) {
        lastTileId = tileId;
        loadEnergyPoints(lat, lng);
        spawnArDemoPointNear(lat, lng);
      }
    }
  };

  const onPositionError = (error) => {
    console.warn("Ошибка геолокации:", error?.message || error);
    const lat = 51.128, lng = 71.431;
    if (!map) {
      const { cartoDark, osm, esriSat } = buildBaseLayers();
      map = L.map('map', { center: [lat, lng], zoom: 13, layers: [cartoDark] });
      L.control.layers(
        { 'Carto Dark (рекомендовано)': cartoDark, 'OSM': osm, 'ESRI Спутник': esriSat },
        null, { position: 'topright', collapsed: true }
      ).addTo(map);
    }
    playerMarker = L.marker([lat, lng], { icon: ghostIcon }).addTo(map).bindPopup("Вы здесь").openPopup();
    lastTileId = getTileId(lat, lng);
    loadEnergyPoints(lat, lng);
    spawnArDemoPointNear(lat, lng);
    alert("Геолокация недоступна. Используются примерные координаты.");
  };

  if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition(onPosition, onPositionError);
    navigator.geolocation.watchPosition(onPosition, (e) => console.warn('watchPosition error', e), {
      enableHighAccuracy: true, maximumAge: 1000, timeout: 10000,
    });
    setInterval(() => {
      if (!map || !playerMarker) return;
      const { lat, lng } = playerMarker.getLatLng();
      loadEnergyPoints(lat, lng);
    }, 60000);
  } else {
    onPositionError(new Error("Геолокация не поддерживается."));
  }
})();

// 📥 Загрузка точек энергии
async function loadEnergyPoints(centerLat, centerLng) {
  if (isLoadingPoints) return;
  isLoadingPoints = true;
  try {
    energyMarkers.forEach(m => map && map.removeLayer(m.marker));
    energyMarkers = [];

    const response = await fetch(`${SUPABASE_URL.replace('.supabase.co','')}.functions.supabase.co/generate-points`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON}`
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
          if (distanceKm > 0.02) { alert("🚫 Подойдите ближе (до 20 м), чтобы собрать энергию."); return; }

          // Анимация «всасывания»
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
          const res = await fetch(`${SUPABASE_URL.replace('.supabase.co','')}.functions.supabase.co/generate-points`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${SUPABASE_ANON}`
            },
            body: JSON.stringify({
              action: "collect",
              telegram_id: String(user.id),
              point_id: point.id
            })
          });

          const collectResult = await res.json();
          if (!res.ok || !collectResult.success) {
            alert("🚫 Ошибка сбора энергии: " + (collectResult.error || res.status));
            return;
          }

          // Удаляем маркер
          const idx = energyMarkers.findIndex(x => x.id === point.id);
          if (idx >= 0) {
            map.removeLayer(energyMarkers[idx].marker);
            energyMarkers.splice(idx, 1);
          }

          const p = collectResult.player;
          if (!p) { alert("ℹ️ Энергия собрана, но нет данных игрока."); return; }

          updatePlayerHeader({
            username: p.first_name || p.username,
            avatar_url: getGhostIconByLevel(p.level),
            level: p.level,
            energy: p.energy,
            energy_max: p.energy_max
          });

          if (playerMarker) playerMarker.setIcon(makeLeafletGhostIcon(p.level));
          const playerEl = playerMarker?.getElement?.();
          if (playerEl) { playerEl.classList.add('flash'); setTimeout(() => playerEl.classList.remove('flash'), 300); }

          alert(`⚡ Собрано: ${collectResult.point_energy_value} энергии. Уровень: ${p.level}`);
        });
      });

  } catch (error) {
    console.error("Ошибка загрузки точек:", error);
  } finally {
    isLoadingPoints = false;
  }
}
