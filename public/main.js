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

// ======== AR: «Гироскопная погоня» (псевдо-AR) ========
let arMarker = null; // маркер на карте для входа в AR

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
    openGyroChase(); // запуск мини-игры
  });
}

/**
 * Открывает модалку AR и запускает мини-игру «Гироскопная погоня».
 * Требует наличие в index.html:
 *  - #ar-modal, #ar-close, #ar-stage
 */
async function openGyroChase() {
  const modal = document.getElementById('ar-modal');
  const closeBtn = document.getElementById('ar-close');
  const stage = document.getElementById('ar-stage');

  // Очистим сцену
  stage.innerHTML = '';
  modal.classList.remove('hidden');

  // ---------- Создаём видео с камерой ----------
  const video = document.createElement('video');
  video.setAttribute('autoplay', '');
  video.setAttribute('playsinline', '');
  video.muted = true;
  Object.assign(video.style, {
    position: 'absolute', inset: '0', width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' // зеркалим под фронталку, но запрашиваем бэк-камеру
  });
  stage.appendChild(video);

  // ---------- Оверлей-слой для UI (прицел, призрак, стрелки, прогресс, подсказки) ----------
  const overlay = document.createElement('div');
  Object.assign(overlay.style, {
    position: 'absolute', inset: '0', overflow: 'hidden', pointerEvents: 'auto'
  });
  stage.appendChild(overlay);

  // Прицел в центре
  const reticle = document.createElement('div');
  const reticleSize = 140; // px (изменяемо по сложности)
  Object.assign(reticle.style, {
    position: 'absolute',
    left: '50%', top: '50%',
    width: `${reticleSize}px`, height: `${reticleSize}px`,
    marginLeft: `-${reticleSize/2}px`, marginTop: `-${reticleSize/2}px`,
    borderRadius: '50%',
    border: '2px solid rgba(255,255,255,.75)',
    boxShadow: '0 0 0 3px rgba(0,0,0,.25), inset 0 0 30px rgba(0,255,220,.15)',
    backdropFilter: 'blur(1px)',
  });
  overlay.appendChild(reticle);

  // Прогресс-кольцо вокруг прицела (конусный градиент)
  const ring = document.createElement('div');
  Object.assign(ring.style, {
    position: 'absolute',
    left: '50%', top: '50%',
    width: `${reticleSize + 16}px`, height: `${reticleSize + 16}px`,
    marginLeft: `-${(reticleSize+16)/2}px`, marginTop: `-${(reticleSize+16)/2}px`,
    borderRadius: '50%',
    background: 'conic-gradient(#00ffd0 0%, rgba(255,255,255,.15) 0%)',
    boxShadow: '0 0 14px rgba(0,255,220,.35)',
    pointerEvents: 'none',
  });
  overlay.appendChild(ring);

  // Призрак (DOM-элемент)
  const ghost = document.createElement('div');
  Object.assign(ghost.style, {
    position: 'absolute',
    width: '96px', height: '96px',
    left: '50%', top: '50%',
    marginLeft: '-48px', marginTop: '-48px',
    borderRadius: '26%',
    background:
      'radial-gradient(60% 60% at 30% 30%, rgba(255,255,255,.95), rgba(255,255,255,.2)), ' +
      'radial-gradient(55% 55% at 70% 70%, rgba(0,200,255,.5), rgba(0,0,0,0))',
    border: '2px solid rgba(255,255,255,.4)',
    boxShadow: '0 12px 30px rgba(0,0,0,.45), inset 0 0 18px rgba(0,200,255,.35)',
    display: 'grid', placeItems: 'center',
    transition: 'transform .08s linear',
  });
  ghost.textContent = '👻';
  ghost.style.fontSize = '64px';
  ghost.style.filter = 'drop-shadow(0 6px 14px rgba(0,0,0,.45))';
  overlay.appendChild(ghost);

  // Стрелки-подсказки по краям
  const arrowL = document.createElement('div');
  const arrowR = document.createElement('div');
  const arrowT = document.createElement('div');
  const arrowB = document.createElement('div');
  [arrowL, arrowR, arrowT, arrowB].forEach(a => {
    Object.assign(a.style, {
      position: 'absolute', color: '#fff', fontSize: '28px',
      textShadow: '0 2px 8px rgba(0,0,0,.5)', opacity: '0', transition: 'opacity .2s'
    });
    overlay.appendChild(a);
  });
  arrowL.textContent = '⬅'; arrowR.textContent = '➡';
  arrowT.textContent = '⬆'; arrowB.textContent = '⬇';
  arrowL.style.left = '8px'; arrowL.style.top = '50%'; arrowL.style.transform = 'translateY(-50%)';
  arrowR.style.right = '8px'; arrowR.style.top = '50%'; arrowR.style.transform = 'translateY(-50%)';
  arrowT.style.top = '8px'; arrowT.style.left = '50%'; arrowT.style.transform = 'translateX(-50%)';
  arrowB.style.bottom = '8px'; arrowB.style.left = '50%'; arrowB.style.transform = 'translateX(-50%)';

  // Подсказка/кнопка разрешения сенсоров (iOS)
  const permWrap = document.createElement('div');
  Object.assign(permWrap.style, {
    position: 'absolute', left: '50%', bottom: '16px', transform: 'translateX(-50%)',
    background: 'rgba(0,0,0,.35)', color: '#fff', padding: '10px 12px',
    borderRadius: '12px', fontSize: '14px', display: 'flex', gap: '10px', alignItems: 'center'
  });
  const permBtn = document.createElement('button');
  permBtn.textContent = 'Включить управление';
  Object.assign(permBtn.style, {
    appearance: 'none', border: 'none', borderRadius: '999px',
    padding: '8px 12px', fontWeight: '800', cursor: 'pointer',
    background: 'linear-gradient(90deg, #00ffcc, #00bfff, #0077ff)', color: '#00131a'
  });
  const permMsg = document.createElement('span');
  permMsg.textContent = 'Чтобы управлять поворотом, разрешите доступ к гиродатчикам.';
  permWrap.appendChild(permMsg); permWrap.appendChild(permBtn);
  overlay.appendChild(permWrap);

  // Джойстик-эмулятор (если сенсоров нет)
  const joystick = document.createElement('div');
  Object.assign(joystick.style, {
    position: 'absolute', left: '16px', bottom: '16px',
    width: '96px', height: '96px', borderRadius: '50%',
    background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.25)',
    touchAction: 'none', display: 'none'
  });
  overlay.appendChild(joystick);

  // Кнопка закрытия
  const cleanupFns = [];
  const close = () => {
    try {
      cleanupFns.forEach(fn => fn && fn());
    } catch {}
    modal.classList.add('hidden');
    stage.innerHTML = '';
  };
  closeBtn.onclick = close;

  // ---------- Камера ----------
  let stream = null;
  try {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
    } catch {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    }
    video.srcObject = stream; await video.play();
    cleanupFns.push(() => { try { stream.getTracks().forEach(t => t.stop()); } catch {} });
  } catch (err) {
    console.error('Камера не запустилась:', err);
    alert('Не удалось запустить камеру. Проверьте разрешения Telegram на камеру.');
    close();
    return;
  }

  // ---------- Игровая логика ----------
  const W = () => overlay.clientWidth;
  const H = () => overlay.clientHeight;
  const HW = () => W()/2, HH = () => H()/2;

  // Параметры сложности (можно связать с редкостью)
  const Rcatch = reticleSize/2;          // радиус попадания (px)
  const holdMsTarget = 1400;             // нужно удержать в прицеле (мс)
  const baseSpeed = 220;                 // базовая скорость призрака (px/с)
  const nearBoost = 120;                 // бонус скорости, когда близко (px/с)
  const fatigueMs = 700;                 // «усталость» после почти-поимки (замедление)
  const edgeBounce = 0.8;                // «скольжение» по краю
  const feintEveryMs = 2800;             // финт/рывок раз в N мс
  const maxOffscreenArrowsDist = 40;     // порог появления стрелок

  // Состояния
  let calib = { alpha0: null, beta0: null }; // ноль гироскопа
  let useSensors = false;
  let camX = 0, camY = 0;                 // «центр камеры» в мире (px), 0,0 — центр экрана
  const sensorToPxYaw = 6;                // чувствительность (градусы → px)
  const sensorToPxPitch = 6;

  // Джойстик-эмуляция
  let joyActive = false, joyBase = {x:0,y:0};

  // Призрак: мировые координаты относительно центра экрана (px)
  let gx = (Math.random() * 2 - 1) * HW() * 0.7;
  let gy = (Math.random() * 2 - 1) * HH() * 0.7;
  let vx = 0, vy = 0;
  let lastT = performance.now();
  let holdMs = 0;
  let lastNearTs = 0;
  let lastFeintTs = 0;

  // Вибро
  const vib = p => { try { navigator.vibrate && navigator.vibrate(p); } catch {} };

  // Прогресс-кольцо обновление
  function setRingProgress(p) {
    const clamped = Math.max(0, Math.min(1, p));
    const deg = Math.floor(360 * clamped);
    ring.style.background = `conic-gradient(#00ffd0 ${deg}deg, rgba(255,255,255,.15) ${deg}deg)`;
  }
  setRingProgress(0);

  // Показ/скрытие стрелок
  function updateArrows(screenX, screenY) {
    const w = W(), h = H();
    const left = screenX < -maxOffscreenArrowsDist;
    const right = screenX > w + maxOffscreenArrowsDist;
    const top = screenY < -maxOffscreenArrowsDist;
    const bottom = screenY > h + maxOffscreenArrowsDist;

    arrowL.style.opacity = left ? '1' : '0';
    arrowR.style.opacity = right ? '1' : '0';
    arrowT.style.opacity = top ? '1' : '0';
    arrowB.style.opacity = bottom ? '1' : '0';
  }

  // Гиро-обработчик → обновляет camX, camY
  function handleOrientation(e) {
    // alpha: 0..360 (компас/yaw), beta: -180..180 (наклон вперёд-назад/pitch)
    const alpha = e.alpha, beta = e.beta;
    if (alpha == null || beta == null) return;

    if (calib.alpha0 == null) { calib.alpha0 = alpha; }
    if (calib.beta0 == null) { calib.beta0 = beta; }

    const dyaw = shortestAngle(alpha - calib.alpha0); // [-180..180]
    const dpitch = beta - calib.beta0;

    // Простая линейная проекция → пиксели
    camX = dyaw * sensorToPxYaw;
    camY = -dpitch * sensorToPxPitch; // инверсия, чтобы наклон вниз = движение вниз
  }

  function shortestAngle(a) {
    let x = ((a + 180) % 360 + 360) % 360 - 180;
    return x;
  }

  // Разрешение сенсоров (iOS)
  async function tryEnableSensors() {
    try {
      if (typeof DeviceOrientationEvent !== 'undefined' &&
          typeof DeviceOrientationEvent.requestPermission === 'function') {
        const resp = await DeviceOrientationEvent.requestPermission();
        if (resp === 'granted') {
          window.addEventListener('deviceorientation', handleOrientation, true);
          cleanupFns.push(() => window.removeEventListener('deviceorientation', handleOrientation, true));
          useSensors = true;
          permWrap.style.display = 'none';
          joystick.style.display = 'none';
          return true;
        }
      } else if ('ondeviceorientation' in window) {
        window.addEventListener('deviceorientation', handleOrientation, true);
        cleanupFns.push(() => window.removeEventListener('deviceorientation', handleOrientation, true));
        useSensors = true;
        permWrap.style.display = 'none';
        joystick.style.display = 'none';
        return true;
      }
    } catch (err) {
      console.warn('DeviceOrientation permission error:', err);
    }
    // не удалось — включаем джойстик
    useSensors = false;
    permMsg.textContent = 'Сенсоры недоступны. Используйте виртуальный джойстик слева.';
    joystick.style.display = 'block';
    return false;
  }

  permBtn.onclick = () => { tryEnableSensors(); };
  // авто-попытка без кнопки на Android
  tryEnableSensors();

  // Джойстик-управление (тач)
  joystick.addEventListener('pointerdown', (e) => {
    joyActive = true;
    joyBase = { x: e.clientX, y: e.clientY };
    joystick.setPointerCapture(e.pointerId);
  });
  joystick.addEventListener('pointermove', (e) => {
    if (!joyActive) return;
    const dx = e.clientX - joyBase.x;
    const dy = e.clientY - joyBase.y;
    camX = dx * 1.6;  // чувствительность
    camY = dy * 1.6;
  });
  const endJoy = (e) => { joyActive = false; camX *= 0.5; camY *= 0.5; };
  joystick.addEventListener('pointerup', endJoy);
  joystick.addEventListener('pointercancel', endJoy);
  cleanupFns.push(() => { joyActive = false; });

  // Игровой цикл
  function tick() {
    const now = performance.now();
    const dt = Math.min(50, now - lastT) / 1000; // сек
    lastT = now;

    const hw = HW(), hh = HH();
    const centerX = hw, centerY = hh;

    // Где на экране должен быть призрак, исходя из «мира» (gx, gy) и текущего «взгляда» (camX, camY)
    let screenX = (gx - camX) + centerX;
    let screenY = (gy - camY) + centerY;

    // Вектор от центра прицела к призраку (в экранных координатах)
    const dx = screenX - centerX;
    const dy = screenY - centerY;
    const dist = Math.hypot(dx, dy);

    // Скорость ускользания
    const dirX = dx === 0 ? 0 : dx / (dist || 1);
    const dirY = dy === 0 ? 0 : dy / (dist || 1);

    // Близко → поддать газу, но с усталостью
    let speed = baseSpeed + (dist < Rcatch * 1.7 ? nearBoost : 0);

    if (now - lastNearTs < fatigueMs) {
      speed *= 0.35; // усталость — замедление
    }

    // Финт раз в N мс
    if (now - lastFeintTs > feintEveryMs) {
      lastFeintTs = now;
      // мгновенная смена направления на 90° + небольшой рывок
      const perp = Math.random() < 0.5 ? [ -dirY, dirX ] : [ dirY, -dirX ];
      vx += perp[0] * 180;
      vy += perp[1] * 180;
    }

    // Основная динамика: стремится УБЕЖАТЬ от центра прицела
    vx += dirX * speed * dt;
    vy += dirY * speed * dt;

    // Немного трения, чтобы не разгонялся бесконечно
    const friction = 0.92;
    vx *= friction; vy *= friction;

    // Обновляем мировую позицию призрака
    gx += vx * dt;
    gy += vy * dt;

    // Столкновения с «миром»: чуть больше экрана (запас 10%)
    const limitX = hw * 1.1, limitY = hh * 1.1;
    if (gx > limitX) { gx = limitX; vx *= -edgeBounce; }
    if (gx < -limitX) { gx = -limitX; vx *= -edgeBounce; }
    if (gy > limitY) { gy = limitY; vy *= -edgeBounce; }
    if (gy < -limitY) { gy = -limitY; vy *= -edgeBounce; }

    // Пересчёт в экранные координаты после коррекции
    screenX = (gx - camX) + centerX;
    screenY = (gy - camY) + centerY;

    // Позиция и лёгкая пульсация
    const pulse = 1 + Math.sin(now / 220) * 0.03;
    ghost.style.transform = `translate(${Math.round(screenX - 48)}px, ${Math.round(screenY - 48)}px) scale(${pulse})`;

    // Стрелки-подсказки, если вышел далеко
    updateArrows(screenX, screenY);

    // Проверка поимки: в круге?
    if (dist <= Rcatch) {
      holdMs += dt * 1000;
      if (Math.abs(dist - Rcatch) < 6) lastNearTs = now; // почти-поимка → устаёт
      if (holdMs >= holdMsTarget) {
        vib([60, 40, 60]);
        const sound = document.getElementById('energy-sound');
        if (sound) { try { sound.currentTime = 0; sound.play(); } catch {} }
        alert('Покемон пойман');
        close();
        return; // завершаем цикл
      }
    } else {
      // медленный спад прогресса, если вышел
      holdMs = Math.max(0, holdMs - dt * 1000 * 0.55);
    }

    setRingProgress(holdMs / holdMsTarget);
    rafId = requestAnimationFrame(tick);
  }

  // Старт цикла
  let rafId = requestAnimationFrame(tick);
  cleanupFns.push(() => { cancelAnimationFrame(rafId); });

  // Очистить всё при закрытии
  cleanupFns.push(() => { try { stream.getTracks().forEach(t => t.stop()); } catch {} });
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

// 📥 Загрузка точек энергии (как было)
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
          const res = await fetch('https://ptkzsrlicfhufdnegwjl.functions.supabase.co/generate-points', {
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
