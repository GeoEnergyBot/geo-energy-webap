import { DIFFICULTY, AR_TUNING } from '../env.js';

/**
 * Запуск мини-игры «Гироскопная погоня».
 * @param {'common'|'advanced'|'rare'} rarity
 */
export function openGyroChase(rarity = 'common') {
  const modal = document.getElementById('ar-modal');
  const closeBtn = document.getElementById('ar-close');
  const stage = document.getElementById('ar-stage');

  // ───── Защита от повторного запуска (дубли UI/камеры/RAF)
  if (modal.dataset.active === '1') {
    // Если вдруг висит предыдущий инстанс — мягко закрываем его
    const prevClose = modal.__closeFn__;
    if (typeof prevClose === 'function') prevClose();
  }
  modal.dataset.active = '1';

  const diff = DIFFICULTY[rarity] || DIFFICULTY.common;
  const {
    fatigueMs = 900, edgeBounce = 0.55, feintEveryMs = 800,
    sensorYawToPx = 3.0, sensorPitchToPx = 2.5, joystickSensitivity = 0.9
  } = AR_TUNING || {};

  stage.innerHTML = '';
  modal.classList.remove('hidden');

  // ───────── Камера (фон)
  const video = document.createElement('video');
  video.setAttribute('autoplay', '');
  video.setAttribute('playsinline', '');
  video.playsInline = true;
  video.muted = true;
  Object.assign(video.style, {
    position: 'absolute', inset: '0',
    width: '100%', height: '100%',
    objectFit: 'cover'
  });
  stage.appendChild(video);

  // ───────── Overlay-слой
  const overlay = document.createElement('div');
  Object.assign(overlay.style, { position: 'absolute', inset: '0', overflow: 'hidden' });
  stage.appendChild(overlay);

  // Верхняя подсказка
  const tip = document.createElement('div');
  tip.textContent = 'Поймайте призрака в круг';
  Object.assign(tip.style, {
    position: 'absolute', left: '12px', top: '10px',
    zIndex: 5, color: '#fff', background: 'rgba(0,0,0,.5)',
    padding: '8px 12px', borderRadius: '12px',
    fontWeight: 700, fontSize: '14px'
  });
  overlay.appendChild(tip);

  // Прицел и прогресс-кольцо
  const Rcatch = diff.reticleRadiusPx;
  const reticleSize = Rcatch * 2;
  const reticle = document.createElement('div');
  Object.assign(reticle.style, {
    position: 'absolute', left: '50%', top: '50%',
    width: `${reticleSize}px`, height: `${reticleSize}px`,
    marginLeft: `-${reticleSize / 2}px`, marginTop: `-${reticleSize / 2}px`,
    borderRadius: '50%', border: '2px solid rgba(255,255,255,.75)`,
    boxShadow: '0 0 0 3px rgba(0,0,0,.25), inset 0 0 30px rgba(0,255,220,.15)',
    backdropFilter: 'blur(1px)', zIndex: 1
  });
  const ring = document.createElement('div');
  Object.assign(ring.style, {
    position: 'absolute', left: '50%', top: '50%',
    width: `${reticleSize + 16}px`, height: `${reticleSize + 16}px`,
    marginLeft: `-${(reticleSize + 16) / 2}px`, marginTop: `-${(reticleSize + 16) / 2}px`,
    borderRadius: '50%',
    background: 'conic-gradient(#00ffd0 0deg, rgba(255,255,255,.15) 0deg)',
    boxShadow: '0 0 14px rgba(0,255,220,.35)', pointerEvents: 'none',
    zIndex: 0
  });
  overlay.appendChild(ring);
  overlay.appendChild(reticle);

  // Призрак (эмодзи-заглушка)
  const ghost = document.createElement('div');
  Object.assign(ghost.style, {
    position: 'absolute', width: '96px', height: '96px',
    left: '50%', top: '50%', marginLeft: '-48px', marginTop: '-48px',
    borderRadius: '26%',
    background:
      'radial-gradient(60% 60% at 30% 30%, rgba(255,255,255,.95), rgba(255,255,255,.2)), ' +
      'radial-gradient(55% 55% at 70% 70%, rgba(0,200,255,.5), rgba(0,0,0,0))',
    border: '2px solid rgba(255,255,255,.4)',
    boxShadow: '0 12px 30px rgba(0,0,0,.45), inset 0 0 18px rgba(0,200,255,.35)',
    display: 'grid', placeItems: 'center', transition: 'transform .08s linear',
    zIndex: 2
  });
  ghost.textContent = '👻';
  ghost.style.fontSize = '64px';
  ghost.style.filter = 'drop-shadow(0 6px 14px rgba(0,0,0,.45))';
  overlay.appendChild(ghost);

  // Таймер-бар + лейбл времени
  const barWrap = document.createElement('div');
  Object.assign(barWrap.style, {
    position: 'absolute', width: '160px', height: '10px',
    left: '50%', top: '50%', marginLeft: '-80px', marginTop: `${reticleSize / 2 + 18}px`,
    background: 'rgba(255,255,255,.25)', borderRadius: '6px',
    boxShadow: '0 0 6px rgba(0,0,0,.4)', zIndex: 3
  });
  const barFill = document.createElement('div');
  Object.assign(barFill.style, {
    width: '0%', height: '100%', borderRadius: '6px',
    background: 'linear-gradient(90deg,#ffd000,#fff176)',
    boxShadow: '0 0 8px rgba(255,208,0,.9) inset'
  });
  barWrap.appendChild(barFill);
  overlay.appendChild(barWrap);

  const timeLabel = document.createElement('div');
  timeLabel.textContent = '';
  Object.assign(timeLabel.style, {
    position: 'absolute', left: '50%', top: '50%',
    transform: 'translateX(-50%)',
    marginTop: `${reticleSize / 2 + 32}px`,
    color: '#fff', fontWeight: 700, fontSize: '12px',
    textShadow: '0 1px 6px rgba(0,0,0,.6)', zIndex: 3, opacity: '0',
    transition: 'opacity .15s'
  });
  overlay.appendChild(timeLabel);

  // Кнопка «Поймать»
  const catchBtn = document.createElement('button');
  catchBtn.textContent = 'Поймать';
  Object.assign(catchBtn.style, {
    position: 'absolute', left: '50%', bottom: '16px', transform: 'translateX(-50%)',
    padding: '14px 24px', borderRadius: '999px', fontWeight: 800,
    border: 'none', cursor: 'not-allowed',
    color: '#00131a',
    background: 'linear-gradient(90deg,#7a8a93,#8f9aa1)', // серый (disabled)
    boxShadow: '0 10px 20px rgba(0,0,0,.35)',
    zIndex: 5
  });
  catchBtn.disabled = true;
  overlay.appendChild(catchBtn);

  // Стрелки-наводки
  const mkArrow = (txt, pos) => {
    const el = document.createElement('div');
    el.textContent = txt;
    Object.assign(el.style, {
      position: 'absolute', color: '#fff', fontSize: '28px',
      textShadow: '0 2px 8px rgba(0,0,0,.5)', opacity: '0', transition: 'opacity .2s',
      zIndex: 4
    });
    overlay.appendChild(el);
    if (pos === 'L') { el.style.left = '8px'; el.style.top = '50%'; el.style.transform = 'translateY(-50%)'; }
    if (pos === 'R') { el.style.right = '8px'; el.style.top = '50%'; el.style.transform = 'translateY(-50%)'; }
    if (pos === 'T') { el.style.top = '8px'; el.style.left = '50%'; el.style.transform = 'translateX(-50%)'; }
    if (pos === 'B') { el.style.bottom = '72px'; el.style.left = '50%'; el.style.transform = 'translateX(-50%)'; }
    return el;
  };
  const arrowL = mkArrow('⬅', 'L');
  const arrowR = mkArrow('➡', 'R');
  const arrowT = mkArrow('⬆', 'T');
  const arrowB = mkArrow('⬇', 'B');

  // Панель разрешений для гиродатчиков
  const permWrap = document.createElement('div');
  Object.assign(permWrap.style, {
    position: 'absolute', left: '50%', bottom: '80px', transform: 'translateX(-50%)',
    background: 'rgba(0,0,0,.4)', color: '#fff', padding: '8px 10px',
    borderRadius: '10px', fontSize: '13px', display: 'flex', gap: '8px', alignItems: 'center',
    zIndex: 5
  });
  const permMsg = document.createElement('span');
  permMsg.textContent = 'Разрешите доступ к гиродатчикам';
  const permBtn = document.createElement('button');
  permBtn.textContent = 'Включить';
  Object.assign(permBtn.style, {
    appearance: 'none', border: 'none', borderRadius: '999px',
    padding: '6px 10px', fontWeight: 800, cursor: 'pointer',
    background: 'linear-gradient(90deg,#00ffcc,#00bfff,#0077ff)', color: '#00131a'
  });
  permWrap.appendChild(permMsg);
  permWrap.appendChild(permBtn);
  overlay.appendChild(permWrap);

  // Виртуальный джойстик
  const joystick = document.createElement('div');
  Object.assign(joystick.style, {
    position: 'absolute', left: '16px', bottom: '16px',
    width: '96px', height: '96px', borderRadius: '50%',
    background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.25)',
    touchAction: 'none', display: 'none', zIndex: 5
  });
  overlay.appendChild(joystick);

  // ───────── Закрытие и очистка
  const cleanupFns = [];
  let stream = null;
  let rafId = 0;
  let canCatch = false;

  const setCatchEnabled = (enabled) => {
    canCatch = !!enabled;
    catchBtn.disabled = !enabled;
    catchBtn.style.background = enabled
      ? 'linear-gradient(90deg,#00ffcc,#00bfff,#0077ff)'
      : 'linear-gradient(90deg,#7a8a93,#8f9aa1)';
    catchBtn.style.cursor = enabled ? 'pointer' : 'not-allowed';
  };

  const close = () => {
    try { cleanupFns.forEach(fn => fn && fn()); } catch {}
    if (rafId) cancelAnimationFrame(rafId);
    try {
      if (stream) stream.getTracks().forEach(t => t.stop());
      if (video) video.srcObject = null;
    } catch {}
    setCatchEnabled(false);
    modal.classList.add('hidden');
    stage.innerHTML = '';
    modal.dataset.active = '0';
    modal.__closeFn__ = null;
  };
  modal.__closeFn__ = close;
  closeBtn.onclick = close;

  // ───────── Камера
  (async () => {
    try {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } }, audio: false
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
      video.srcObject = stream;
      await video.play();
      cleanupFns.push(() => {
        try { stream.getTracks().forEach(t => t.stop()); } catch {}
        try { video.srcObject = null; } catch {}
      });
    } catch (err) {
      console.error('Camera error', err);
      alert('Не удалось запустить камеру. Проверьте разрешения Telegram на камеру.');
      close(); return;
    }
  })();

  // ───────── Хелперы
  const W = () => overlay.clientWidth;
  const H = () => overlay.clientHeight;
  const HW = () => W() / 2;
  const HH = () => H() / 2;

  const setRingProgress = (p) => {
    const clamped = Math.max(0, Math.min(1, p));
    const deg = Math.floor(360 * clamped);
    ring.style.background = `conic-gradient(#00ffd0 ${deg}deg, rgba(255,255,255,.15) ${deg}deg)`;
  };
  const updateArrows = (x, y) => {
    const w = W(), h = H(), m = 40;
    arrowL.style.opacity = x < -m ? '1' : '0';
    arrowR.style.opacity = x > w + m ? '1' : '0';
    arrowT.style.opacity = y < -m ? '1' : '0';
    arrowB.style.opacity = y > h + m ? '1' : '0';
  };
  const vib = (p) => { try { navigator.vibrate && navigator.vibrate(p); } catch {} };

  // ───────── Сенсоры/джойстик
  let calib = { alpha0: null, beta0: null };
  let camX = 0, camY = 0;

  function handleOrientation(e) {
    const a = e.alpha, b = e.beta;
    if (a == null || b == null) return;
    if (calib.alpha0 == null) calib.alpha0 = a;
    if (calib.beta0 == null)  calib.beta0 = b;

    // Нормализация dyaw в диапазон [-180; 180]
    const raw = a - calib.alpha0;
    const dyaw = ((raw + 540) % 360) - 180;

    const dpitch = b - calib.beta0;
    camX = dyaw * sensorYawToPx;
    camY = -dpitch * sensorPitchToPx;
  }

  async function tryEnableSensors() {
    try {
      if (typeof DeviceOrientationEvent !== 'undefined' &&
          typeof DeviceOrientationEvent.requestPermission === 'function') {
        // iOS — нужен жест
        const resp = await DeviceOrientationEvent.requestPermission();
        if (resp === 'granted') {
          window.addEventListener('deviceorientation', handleOrientation, true);
          cleanupFns.push(() => window.removeEventListener('deviceorientation', handleOrientation, true));
          permWrap.style.display = 'none';
          joystick.style.display = 'none';
          return true;
        }
      } else if ('ondeviceorientation' in window) {
        window.addEventListener('deviceorientation', handleOrientation, true);
        cleanupFns.push(() => window.removeEventListener('deviceorientation', handleOrientation, true));
        permWrap.style.display = 'none';
        joystick.style.display = 'none';
        return true;
      }
    } catch (e) { console.warn('Orientation permission error', e); }
    // Фолбэк
    permMsg.textContent = 'Сенсоры недоступны — используйте джойстик';
    joystick.style.display = 'block';
    return false;
  }
  permBtn.onclick = () => { tryEnableSensors(); };
  // Не вызываем насильно на старте (на iOS требуется пользовательский жест),
  // покажем панель и ждём нажатия.
  // tryEnableSensors();

  // Джойстик
  let joyActive = false, joyBase = { x: 0, y: 0 };
  joystick.addEventListener('pointerdown', e => {
    joyActive = true; joyBase = { x: e.clientX, y: e.clientY };
    joystick.setPointerCapture(e.pointerId);
  });
  joystick.addEventListener('pointermove', e => {
    if (!joyActive) return;
    const dx = e.clientX - joyBase.x, dy = e.clientY - joyBase.y;
    camX = dx * joystickSensitivity; camY = dy * joystickSensitivity;
  });
  const endJoy = () => { joyActive = false; camX *= 0.5; camY *= 0.5; };
  joystick.addEventListener('pointerup', endJoy);
  joystick.addEventListener('pointercancel', endJoy);
  cleanupFns.push(() => { joyActive = false; });

  // ───────── Параметры «погони»
  const holdTarget = diff.holdMs;
  const baseSpeed = diff.baseSpeed;
  const nearBoost = diff.nearBoost;

  // Динамика
  let gx = (Math.random() * 2 - 1) * HW() * 0.7, gy = (Math.random() * 2 - 1) * HH() * 0.7;
  let vx = 0, vy = 0, lastT = performance.now();
  let holdMs = 0, lastNearTs = 0, lastFeintTs = 0;

  function handleCatch() {
    if (!canCatch) return;
    vib([60, 40, 60]);
    const sound = document.getElementById('energy-sound');
    if (sound) { try { sound.currentTime = 0; sound.play(); } catch {} }
    alert('Призрак пойман');
    close();
  }
  catchBtn.addEventListener('click', handleCatch);
  setCatchEnabled(false);

  // ───────── Игровой цикл
  function tick() {
    const now = performance.now();
    const dt = Math.min(50, now - lastT) / 1000;
    lastT = now;

    const hw = HW(), hh = HH();
    const cx = hw, cy = hh;

    // экранные координаты с учётом «камеры»
    let screenX = (gx - camX) + cx;
    let screenY = (gy - camY) + cy;

    const dx = screenX - cx;
    const dy = screenY - cy;
    const dist = Math.hypot(dx, dy);

    const dirX = dist === 0 ? 0 : dx / dist;
    const dirY = dist === 0 ? 0 : dy / dist;

    let speed = baseSpeed + (dist < Rcatch * 1.7 ? nearBoost : 0);
    if (now - lastNearTs < fatigueMs) speed *= 0.35;

    // Безопасность: финт не чаще заданного интервала
    if (feintEveryMs > 0 && now - lastFeintTs > feintEveryMs) {
      lastFeintTs = now;
      const perp = Math.random() < 0.5 ? [-dirY, dirX] : [dirY, -dirX];
      vx += perp[0] * 180; vy += perp[1] * 180;
    }

    vx += dirX * speed * dt;
    vy += dirY * speed * dt;

    const friction = 0.92;
    vx *= friction; vy *= friction;

    gx += vx * dt; gy += vy * dt;

    // Границы
    const limitX = hw * 1.1, limitY = hh * 1.1;
    if (gx > limitX) { gx = limitX; vx *= -edgeBounce; }
    if (gx < -limitX) { gx = -limitX; vx *= -edgeBounce; }
    if (gy > limitY) { gy = limitY; vy *= -edgeBounce; }
    if (gy < -limitY) { gy = -limitY; vy *= -edgeBounce; }

    // Пересчёт экранных координат после движения
    screenX = (gx - camX) + cx;
    screenY = (gy - camY) + cy;

    const pulse = 1 + Math.sin(now / 220) * 0.03;
    ghost.style.transform = `translate(${Math.round(screenX - 48)}px, ${Math.round(screenY - 48)}px) scale(${pulse})`;

    // Стрелки-наводки
    updateArrows(screenX, screenY);

    // Прогресс ловли
    const distNow = Math.hypot(screenX - cx, screenY - cy);
    const inside = distNow <= Rcatch;
    if (inside) {
      holdMs += dt * 1000;
      if (Math.abs(distNow - Rcatch) < 6) lastNearTs = now;
    } else {
      holdMs = Math.max(0, holdMs - dt * 1000 * 0.55);
    }
    const prog = Math.max(0, Math.min(1, holdMs / holdTarget));
    setRingProgress(prog);
    barFill.style.width = `${Math.round(prog * 100)}%`;

    // Текстовый таймер
    if (inside) {
      const remain = Math.max(0, holdTarget - holdMs) / 1000;
      timeLabel.textContent = `осталось ${remain.toFixed(2)} c`;
      timeLabel.style.opacity = '1';
    } else {
      timeLabel.textContent = '';
      timeLabel.style.opacity = '0';
    }

    // Кнопка «Поймать»
    if (prog >= 1 && !canCatch) setCatchEnabled(true);
    if (prog < 1 && canCatch) setCatchEnabled(false);

    rafId = requestAnimationFrame(tick);
  }
  rafId = requestAnimationFrame(tick);
  cleanupFns.push(() => cancelAnimationFrame(rafId));
}
