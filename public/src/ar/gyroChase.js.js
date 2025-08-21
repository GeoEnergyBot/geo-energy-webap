import { DIFFICULTY, AR_TUNING } from '../env.js';

/**
 * Запуск мини-игры «Гироскопная погоня».
 * Возвращает Promise с результатом для интеграции с основной игрой.
 * @param {'common'|'advanced'|'rare'} rarity
 * @returns {Promise<{status:'caught'|'cancel'|'error', ms:number, rarity:string}>}
 */
export function openGyroChase(rarity = 'common') {
  const modal = document.getElementById('ar-modal');
  const closeBtn = document.getElementById('ar-close');
  const stage = document.getElementById('ar-stage');

  const diff = DIFFICULTY[rarity] || DIFFICULTY.common;
  const { fatigueMs, edgeBounce, feintEveryMs, sensorYawToPx, sensorPitchToPx, joystickSensitivity } = AR_TUNING;

  // Если модал уже открыт — перезапустим чисто
  stage.innerHTML = '';
  modal.classList.remove('hidden');

  const ac = new AbortController(); // общий контроллер слушателей
  const on = (t, n, f, opt) => t.addEventListener(n, f, { ...opt, signal: ac.signal });

  const startTs = performance.now();
  let resolved = false;
  const finish = (payload) => {
    if (resolved) return;
    resolved = true;
    try { ac.abort(); } catch {}
    try { cleanup.forEach(fn => fn && fn()); } catch {}
    modal.classList.add('hidden');
    stage.innerHTML = '';
    const detail = { ...payload, rarity };
    window.dispatchEvent(new CustomEvent('gyro-chase:done', { detail }));
    return payload;
  };

  const cleanup = [];

  // ───────── Камера
  const video = document.createElement('video');
  video.autoplay = true; video.playsInline = true; video.muted = true;
  Object.assign(video.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', objectFit: 'cover' });
  stage.appendChild(video);

  // ───────── Overlay
  const overlay = document.createElement('div');
  Object.assign(overlay.style, { position: 'absolute', inset: '0', overflow: 'hidden' });
  stage.appendChild(overlay);

  // Верхняя подсказка + мини-таймер
  const tip = document.createElement('div');
  const tipTime = document.createElement('span');
  tip.textContent = 'Поймайте призрака в круг ';
  tip.appendChild(tipTime);
  Object.assign(tip.style, { position: 'absolute', left: '12px', top: '10px', zIndex: 5, color: '#fff',
    background: 'rgba(0,0,0,.5)', padding: '8px 12px', borderRadius: '12px', fontWeight: 700, fontSize: '14px' });
  overlay.appendChild(tip);

  // Прицел и кольцо
  const Rcatch = diff.reticleRadiusPx;
  const reticleSize = Rcatch * 2;
  const reticle = document.createElement('div');
  Object.assign(reticle.style, {
    position: 'absolute', left: '50%', top: '50%',
    width: `${reticleSize}px`, height: `${reticleSize}px`,
    marginLeft: `-${Rcatch}px`, marginTop: `-${Rcatch}px`,
    borderRadius: '50%', border: '2px solid rgba(255,255,255,.75)',
    boxShadow: '0 0 0 3px rgba(0,0,0,.25), inset 0 0 30px rgba(0,255,220,.15)',
    backdropFilter: 'blur(1px)', zIndex: 1
  });
  const ring = document.createElement('div');
  const ringSize = reticleSize + 16;
  Object.assign(ring.style, {
    position: 'absolute', left: '50%', top: '50%',
    width: `${ringSize}px`, height: `${ringSize}px`,
    marginLeft: `-${ringSize / 2}px`, marginTop: `-${ringSize / 2}px`,
    borderRadius: '50%',
    background: 'conic-gradient(#00ffd0 0deg, rgba(255,255,255,.15) 0deg)',
    boxShadow: '0 0 14px rgba(0,255,220,.35)', pointerEvents: 'none', zIndex: 0
  });
  overlay.appendChild(ring);
  overlay.appendChild(reticle);

  // Призрак
  const ghost = document.createElement('div');
  Object.assign(ghost.style, {
    position: 'absolute', width: '96px', height: '96px',
    left: '50%', top: '50%', marginLeft: '-48px', marginTop: '-48px',
    borderRadius: '26%',
    background:
      'radial-gradient(60% 60% at 30% 30%, rgba(255,255,255,.95), rgba(255,255,255,.2)), ' +
      'radial-gradient(55% 55% at 70% 70%, rgba(0,200,255,.5), rgba(0,0,0,0))',
    border: '2px solid rgba(255,255,255,.4)', boxShadow: '0 12px 30px rgba(0,0,0,.45), inset 0 0 18px rgba(0,200,255,.35)',
    display: 'grid', placeItems: 'center', transition: 'transform .08s linear', zIndex: 2,
    filter: 'drop-shadow(0 6px 14px rgba(0,0,0,.45))'
  });
  ghost.textContent = '👻';
  ghost.style.fontSize = '64px';
  overlay.appendChild(ghost);

  // Полоска-таймер под прицелом
  const barWrap = document.createElement('div');
  Object.assign(barWrap.style, {
    position: 'absolute', width: '140px', height: '10px',
    left: '50%', top: '50%', marginLeft: '-70px', marginTop: `${Rcatch + 18}px`,
    background: 'rgba(255,255,255,.25)', borderRadius: '6px', boxShadow: '0 0 6px rgba(0,0,0,.4)', zIndex: 3
  });
  const barFill = document.createElement('div');
  Object.assign(barFill.style, {
    width: '0%', height: '100%', borderRadius: '6px',
    background: 'linear-gradient(90deg,#ffd000,#fff176)', boxShadow: '0 0 8px rgba(255,208,0,.9) inset'
  });
  barWrap.appendChild(barFill);
  overlay.appendChild(barWrap);

  // Кнопка «Поймать»
  const catchBtn = document.createElement('button');
  catchBtn.textContent = 'Поймать';
  Object.assign(catchBtn.style, {
    position: 'absolute', left: '50%', bottom: '16px', transform: 'translateX(-50%)',
    padding: '14px 24px', borderRadius: '999px', fontWeight: 800, border: 'none',
    cursor: 'not-allowed', color: '#00131a',
    background: 'linear-gradient(90deg,#7a8a93,#8f9aa1)', boxShadow: '0 10px 20px rgba(0,0,0,.35)', zIndex: 5
  });
  catchBtn.disabled = true;
  overlay.appendChild(catchBtn);

  // Стрелки-подсказки
  const mkArrow = (txt, pos) => {
    const el = document.createElement('div');
    el.textContent = txt;
    Object.assign(el.style, { position: 'absolute', color: '#fff', fontSize: '28px',
      textShadow: '0 2px 8px rgba(0,0,0,.5)', opacity: '0', transition: 'opacity .15s', zIndex: 4 });
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

  // Разрешения для сенсоров
  const permWrap = document.createElement('div');
  Object.assign(permWrap.style, {
    position: 'absolute', left: '50%', bottom: '80px', transform: 'translateX(-50%)',
    background: 'rgba(0,0,0,.4)', color: '#fff', padding: '8px 10px',
    borderRadius: '10px', fontSize: '13px', display: 'flex', gap: '8px', alignItems: 'center', zIndex: 5
  });
  const permMsg = document.createElement('span');
  permMsg.textContent = 'Разрешите доступ к гиродатчикам';
  const permBtn = document.createElement('button');
  permBtn.textContent = 'Включить';
  Object.assign(permBtn.style, { appearance: 'none', border: 'none', borderRadius: '999px',
    padding: '6px 10px', fontWeight: 800, cursor: 'pointer',
    background: 'linear-gradient(90deg,#00ffcc,#00bfff,#0077ff)', color: '#00131a' });
  permWrap.appendChild(permMsg); permWrap.appendChild(permBtn);
  overlay.appendChild(permWrap);

  // Виртуальный джойстик
  const joystick = document.createElement('div');
  Object.assign(joystick.style, {
    position: 'absolute', left: '16px', bottom: '16px', width: '96px', height: '96px', borderRadius: '50%',
    background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.25)', touchAction: 'none',
    display: 'none', zIndex: 5
  });
  overlay.appendChild(joystick);

  // Закрытие (крестик)
  on(closeBtn, 'click', () => finish({ status: 'cancel', ms: performance.now() - startTs }));

  // Камера
  let stream = null;
  (async () => {
    try {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { exact: 'environment' } }, audio: false });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      }
      video.srcObject = stream; await video.play();
      cleanup.push(() => { try { stream.getTracks().forEach(t => t.stop()); } catch {} });
    } catch (err) {
      console.error('Camera error', err);
      finish({ status: 'error', ms: performance.now() - startTs });
    }
  })();

  // Хелперы
  const W = () => overlay.clientWidth;
  const H = () => overlay.clientHeight;
  const HW = () => W() / 2, HH = () => H() / 2;
  const setRingProgress = (p) => {
    const clamped = Math.max(0, Math.min(1, p));
    const deg = (360 * clamped) | 0;
    ring.style.background = `conic-gradient(#00ffd0 ${deg}deg, rgba(255,255,255,.15) ${deg}deg)`;
    tipTime.textContent = clamped < 1 ? ` · ${((1 - clamped) * (diff.holdMs / 1000)).toFixed(1)}s` : ' · Готово';
  };
  const updateArrows = (x, y) => {
    const w = W(), h = H(), pad = 12;
    const left = x < pad, right = x > w - pad, top = y < pad, bottom = y > h - pad;
    arrowL.style.opacity = left ? '1' : '0';
    arrowR.style.opacity = right ? '1' : '0';
    arrowT.style.opacity = top ? '1' : '0';
    arrowB.style.opacity = bottom ? '1' : '0';
  };
  const vib = (p) => { try { navigator.vibrate && navigator.vibrate(p); } catch {} };

  // Сенсоры/джойстик
  let sensorsOn = false;
  let calib = { alpha0: null, beta0: null };
  let camX = 0, camY = 0;

  const handleOrientation = (e) => {
    const a = e.alpha, b = e.beta;
    if (a == null || b == null) return;
    if (calib.alpha0 == null) calib.alpha0 = a;
    if (calib.beta0 == null)  calib.beta0 = b;
    // нормализуем в -180..180
    const dyaw = (((a - calib.alpha0) + 540) % 360) - 180;
    const dpitch = b - calib.beta0;
    camX = dyaw * sensorYawToPx;
    camY = -dpitch * sensorPitchToPx;
  };

  let enabling = false;
  async function tryEnableSensors() {
    if (sensorsOn || enabling) return true;
    enabling = true;
    try {
      if (typeof DeviceOrientationEvent !== 'undefined' &&
          typeof DeviceOrientationEvent.requestPermission === 'function') {
        const resp = await DeviceOrientationEvent.requestPermission();
        if (resp === 'granted') {
          window.addEventListener('deviceorientation', handleOrientation, { capture: true, signal: ac.signal });
          sensorsOn = true; permWrap.style.display = 'none'; joystick.style.display = 'none';
          return true;
        }
      } else if ('ondeviceorientation' in window) {
        window.addEventListener('deviceorientation', handleOrientation, { capture: true, signal: ac.signal });
        sensorsOn = true; permWrap.style.display = 'none'; joystick.style.display = 'none';
        return true;
      }
    } catch (e) {
      console.warn('Orientation permission error', e);
    } finally {
      enabling = false;
    }
    permMsg.textContent = 'Сенсоры недоступны — используйте джойстик';
    joystick.style.display = 'block';
    return false;
  }
  on(permBtn, 'click', () => { tryEnableSensors(); });
  tryEnableSensors();

  // Джойстик
  let joyActive = false, joyBase = { x: 0, y: 0 };
  on(joystick, 'pointerdown', e => {
    joyActive = true; joyBase = { x: e.clientX, y: e.clientY };
    joystick.setPointerCapture(e.pointerId);
  });
  on(joystick, 'pointermove', e => {
    if (!joyActive) return;
    const dx = e.clientX - joyBase.x, dy = e.clientY - joyBase.y;
    camX = dx * joystickSensitivity; camY = dy * joystickSensitivity;
  });
  const endJoy = () => { joyActive = false; camX *= 0.5; camY *= 0.5; };
  on(joystick, 'pointerup', endJoy);
  on(joystick, 'pointercancel', endJoy);

  // Параметры «погони»
  const holdTarget = diff.holdMs;
  const baseSpeed = diff.baseSpeed;
  const nearBoost = diff.nearBoost;

  // Динамика
  let gx = (Math.random() * 2 - 1) * HW() * 0.7;
  let gy = (Math.random() * 2 - 1) * HH() * 0.7;
  let vx = 0, vy = 0, lastT = performance.now();
  let holdMs = 0, lastNearTs = 0, lastFeintTs = 0;
  let canCatch = false, paused = false;

  function setCatchEnabled(enabled) {
    canCatch = !!enabled;
    catchBtn.disabled = !enabled;
    if (enabled) {
      catchBtn.style.background = 'linear-gradient(90deg,#00ffcc,#00bfff,#0077ff)';
      catchBtn.style.cursor = 'pointer';
      catchBtn.textContent = 'Поймать!';
    } else {
      catchBtn.style.background = 'linear-gradient(90deg,#7a8a93,#8f9aa1)';
      catchBtn.style.cursor = 'not-allowed';
      catchBtn.textContent = 'Поймать';
    }
  }
  setCatchEnabled(false);

  // Аудио-подготовка (iOS)
  let audioReady = false, audioEl = document.getElementById('energy-sound');
  const primeAudio = () => {
    if (audioReady || !audioEl) return;
    try {
      audioEl.muted = false;
      audioEl.play().then(() => {
        audioEl.pause(); audioEl.currentTime = 0; audioReady = true;
      }).catch(() => {});
    } catch {}
  };
  on(catchBtn, 'pointerdown', primeAudio, { passive: true });

  // Нажатие «Поймать»
  on(catchBtn, 'click', () => {
    if (!canCatch) return;
    vib([60, 40, 60]);
    if (audioEl) { try { audioEl.currentTime = 0; audioEl.play(); } catch {} }
    finish({ status: 'caught', ms: performance.now() - startTs });
  });

  // Пауза при скрытии вкладки/модалки
  on(document, 'visibilitychange', () => { paused = document.hidden; });

  // Игровой цикл
  let rafId = 0;
  const tick = () => {
    if (paused) { rafId = requestAnimationFrame(tick); return; }

    const now = performance.now();
    const dt = Math.min(50, now - lastT) / 1000;
    lastT = now;

    const hw = HW(), hh = HH();
    const cx = hw, cy = hh;

    // позиция призрака в экранных координатах (с учётом "камеры")
    let screenX = (gx - camX) + cx;
    let screenY = (gy - camY) + cy;

    const dx = screenX - cx;
    const dy = screenY - cy;
    const dist = Math.hypot(dx, dy) || 0.0001;

    const dirX = dx / dist;
    const dirY = dy / dist;

    let speed = baseSpeed + (dist < Rcatch * 1.7 ? nearBoost : 0);
    if (now - lastNearTs < fatigueMs) speed *= 0.35;

    // Ложные манёвры — не дёргаем в самом кольце
    const canFeint = dist > Rcatch * 0.6;
    if (canFeint && (now - lastFeintTs > feintEveryMs)) {
      lastFeintTs = now;
      const perp = Math.random() < 0.5 ? [-dirY, dirX] : [dirY, -dirX];
      vx += perp[0] * 180; vy += perp[1] * 180;
    }

    vx += dirX * speed * dt;
    vy += dirY * speed * dt;

    const friction = 0.92;
    vx *= friction; vy *= friction;

    gx += vx * dt; gy += vy * dt;

    // Границы с отскоком
    const limitX = hw * 1.1, limitY = hh * 1.1;
    if (gx > limitX) { gx = limitX; vx *= -edgeBounce; }
    if (gx < -limitX) { gx = -limitX; vx *= -edgeBounce; }
    if (gy > limitY) { gy = limitY; vy *= -edgeBounce; }
    if (gy < -limitY) { gy = -limitY; vy *= -edgeBounce; }

    // Пересчёт экранных координат и отрисовка
    screenX = (gx - camX) + cx;
    screenY = (gy - camY) + cy;

    const pulse = 1 + Math.sin(now / 220) * 0.03;
    ghost.style.transform = `translate(${(screenX - 48) | 0}px, ${(screenY - 48) | 0}px) scale(${pulse})`;

    // Наводящие стрелки
    updateArrows(screenX, screenY);

    // Прогресс
    let edgeZone = Math.abs(dist - Rcatch) < 6;
    if (dist <= Rcatch) {
      holdMs += dt * 1000;
      if (edgeZone) lastNearTs = now;
    } else {
      holdMs = Math.max(0, holdMs - dt * 1000 * 0.55);
    }
    const prog = Math.max(0, Math.min(1, holdMs / holdTarget));
    setRingProgress(prog);
    barFill.style.width = `${(prog * 100) | 0}%`;

    if (prog >= 1 && !canCatch) setCatchEnabled(true);
    if (prog < 1 && canCatch) setCatchEnabled(false);

    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);
  cleanup.push(() => cancelAnimationFrame(rafId));

  // Закрыть по Esc
  on(window, 'keydown', (e) => { if (e.key === 'Escape') finish({ status: 'cancel', ms: performance.now() - startTs }); });

  // Возврат промиса с результатом
  return new Promise((resolve) => {
    const done = (e) => resolve(e.detail);
    const handler = (e) => { window.removeEventListener('gyro-chase:done', done); resolve(e.detail); };
    window.addEventListener('gyro-chase:done', done, { once: true });
  });
}
