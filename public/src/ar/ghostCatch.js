// ghostCatch.js
import { DIFFICULTY } from '../env.js';

/** Мини-игра «Поймай призрака»: держи цель в прицеле нужное время */
let _busy = false;

function _difficulty(rarity) {
  const d = DIFFICULTY?.[rarity] || {};
  return {
    sensorYawToPx:   d.sensorYawToPx   ?? 6,
    sensorPitchToPx: d.sensorPitchToPx ?? 6,
    baseSpeed:       d.baseSpeed       ?? ({ common:130, advanced:160, rare:190 }[rarity] || 140),
    minSpeed:        d.minSpeed        ?? ({ common: 20, advanced: 30, rare: 40 }[rarity] || 25),
    maxSpeed:        d.maxSpeed        ?? ({ common:220, advanced:260, rare:300 }[rarity] || 240),
    catchRadius:     d.catchRadius     ?? 70,
    holdMs:          d.holdMs          ?? ({ common:1100, advanced:1300, rare:1500 }[rarity] || 1200),
    accel:           d.accel           ?? ({ common:3.0, advanced:3.5, rare:4.0 }[rarity] || 3.2),
  };
}

export async function openGhostCatch(rarity = 'common') {
  if (_busy) return { success: false };

  // Проверяем DOM до установки _busy
  const modal = document.getElementById('ar-modal');
  const stage = document.getElementById('ar-stage');
  const title = document.getElementById('ar-title');
  const close = document.getElementById('ar-close');
  if (!modal || !stage || !close) return { success:false };

  _busy = true;

  // Промис завершения — создаём сразу
  let resolveDone;
  const done = new Promise(res => { resolveDone = res; });

  let raf = 0;
  let onOrientBound = null;
  let onResizeBound = null;
  let onKeyBound = null;
  let onVisibilityBound = null;

  // камера
  let stopCamera = () => {};
  let cameraReady = false;

  // очистка
  let cleanup = () => {};

  try {
    if (title) title.textContent = 'Поймайте призрака в круг';
    modal.classList.remove('hidden');
    window.dispatchEvent(new Event('ar:open'));

    // Полноэкранная сцена
    stage.innerHTML = '';
    Object.assign(stage.style, {
      position: 'relative',
      width: '100vw',
      height: '100vh',    // базово; ниже поправим на реальный innerHeight
      overflow: 'hidden'
    });

    // Правильный 100vh на мобильных (без перекрытия адресной строки)
    const applyVh = () => {
      const vh = window.innerHeight * 0.01;
      stage.style.setProperty('--vh', `${vh}px`);
      stage.style.height = `calc(var(--vh) * 100)`;
    };
    applyVh();
    onResizeBound = () => applyVh();
    window.addEventListener('resize', onResizeBound, { passive:true });

    // Контейнер сцены
    const wrap = document.createElement('div');
    Object.assign(wrap.style, {
      position: 'relative',
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      background: '#000' // на случай, если камера не включится
    });
    stage.appendChild(wrap);

    // Видео-фон (камера)
    const video = document.createElement('video');
    Object.assign(video, {
      autoplay: true,
      playsInline: true,
      muted: true
    });
    Object.assign(video.style, {
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
      objectFit: 'cover', // заполняем всю сцену без полос
      zIndex: 0,
      background: '#000'
    });
    wrap.appendChild(video);

    // Виньетка/оверлей (для контраста)
    const fx = document.createElement('div');
    Object.assign(fx.style, {
      position: 'absolute',
      inset: 0,
      zIndex: 1,
      pointerEvents: 'none',
      background: 'radial-gradient(120% 120% at 50% 40%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.35) 90%)'
    });
    wrap.appendChild(fx);

    // Canvas поверх видео
    const canvas = document.createElement('canvas');
    Object.assign(canvas.style, {
      position: 'absolute',
      inset: 0,
      display: 'block',
      width: '100%',
      height: '100%',
      touchAction: 'none',
      zIndex: 2,
      background: 'transparent' // важно: видеть камеру
    });
    wrap.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    // HUD (прогресс/кнопки)
    const hud = document.createElement('div');
    Object.assign(hud.style, {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      padding: '16px 14px calc(env(safe-area-inset-bottom,0) + 12px)',
      display: 'flex',
      justifyContent: 'center',
      zIndex: 3,
      pointerEvents: 'none'
    });
    wrap.appendChild(hud);

    // Прогресс-бар
    const bar = document.createElement('div');
    const barIn = document.createElement('div');
    Object.assign(bar.style, {
      height: '12px',
      borderRadius: '10px',
      background: 'rgba(255,255,255,.18)',
      width: 'min(520px, 86vw)',
      boxShadow: '0 2px 10px rgba(0,0,0,.25)',
      pointerEvents: 'auto'
    });
    Object.assign(barIn.style, {
      height: '100%',
      width: '0%',
      borderRadius: '10px',
      background: 'linear-gradient(90deg,#22d3ee,#818cf8,#e879f9)'
    });
    bar.appendChild(barIn);
    hud.appendChild(bar);

    // Кнопка «Сенсоры» (для iOS) — в правом верхнем
    const perm = document.createElement('button');
    perm.textContent = 'Сенсоры';
    Object.assign(perm.style, {
      position: 'absolute',
      top: '16px',
      right: '16px',
      zIndex: 4,
      border: 'none',
      borderRadius: '999px',
      padding: '6px 10px',
      fontWeight: 800,
      fontSize: '12px',
      background: 'linear-gradient(90deg,#00ffcc,#00bfff,#0077ff)',
      color: '#00131a',
      cursor: 'pointer',
      display: 'none'
    });
    wrap.appendChild(perm);

    // Кнопка «Камера» (повторить запрос / переключить)
    const camBtn = document.createElement('button');
    camBtn.textContent = 'Камера';
    Object.assign(camBtn.style, {
      position: 'absolute',
      top: '16px',
      left: '16px',
      zIndex: 4,
      border: 'none',
      borderRadius: '999px',
      padding: '6px 10px',
      fontWeight: 800,
      fontSize: '12px',
      background: 'linear-gradient(90deg,#22c55e,#10b981,#06b6d4)',
      color: '#00131a',
      cursor: 'pointer',
      display: 'none'
    });
    wrap.appendChild(camBtn);

    // Функции камеры
    async function startCamera(preferEnvironment = true) {
      // Останавливаем прошлые треки (если были)
      stopCamera();
      cameraReady = false;
      camBtn.style.display = 'none';

      try {
        const constraints = { video: { facingMode: preferEnvironment ? { ideal: 'environment' } : 'user' }, audio: false };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = stream;
        await video.play().catch(()=>{});
        cameraReady = true;

        // Кнопка «Камера» покажется для переключения только если хотим
        camBtn.style.display = 'inline-block';
        stopCamera = () => {
          try {
            const tr = stream.getTracks?.() || [];
            tr.forEach(t => t.stop?.());
          } catch {}
          video.srcObject = null;
          cameraReady = false;
          camBtn.style.display = 'inline-block'; // оставляем доступной для повторного запроса
        };
      } catch (e) {
        // Фоллбек — показываем кнопку для повторной попытки
        camBtn.style.display = 'inline-block';
        cameraReady = false;
        console.warn('[AR] Camera not available:', e);
      }
    }

    camBtn.onclick = async () => {
      // Тап по кнопке — попробовать другой facingMode, если уже был environment
      const usingEnv = !!(video.srcObject && video.srcObject.getVideoTracks?.()[0]?.getSettings?.().facingMode !== 'user');
      await startCamera(!usingEnv);
    };

    // Запускаем камеру сразу (вызов идёт после юзерского тапа по точке — разрешение возможно)
    if (navigator.mediaDevices?.getUserMedia) {
      await startCamera(true);
    } else {
      camBtn.style.display = 'inline-block';
    }

    // Размеры/ретина канваса по реальному контейнеру
    let W = 300, H = 500;
    function resizeCanvas() {
      const cssW = wrap.clientWidth || window.innerWidth;
      const cssH = wrap.clientHeight || window.innerHeight;
      const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
      canvas.style.width = cssW + 'px';
      canvas.style.height = cssH + 'px';
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // рисуем в CSS-пикселях
      W = cssW; H = cssH;
    }
    resizeCanvas();

    // ---- Управление (сенсоры + джойстик) ----
    const conf = _difficulty(rarity);
    let camX = 0, camY = 0;      // мгновенный сдвиг "камеры"
    let camXS = 0, camYS = 0;    // сглаженный сдвиг
    let baseAlpha = null, baseBeta = null;
    let firstSensorTick = false;

    const shortest = (a) => (((a + 180) % 360) + 360) % 360 - 180;
    const screenAngle = () => {
      const ang = (screen.orientation?.angle ?? window.orientation ?? 0) || 0;
      const n = ((ang % 360) + 360) % 360;
      return n === 0 || n === 90 || n === 180 || n === 270 ? n : 0;
    };

    function recenterSensors() {
      baseAlpha = null;
      baseBeta  = null;
    }

    function onOrient(e) {
      if (e.alpha == null || e.beta == null) return;
      if (!firstSensorTick) {
        firstSensorTick = true;
        perm.style.display = 'none';
      }
      if (baseAlpha == null) baseAlpha = e.alpha;
      if (baseBeta  == null) baseBeta  = e.beta;

      let dyaw = shortest(e.alpha - baseAlpha);
      let dpitch = e.beta - baseBeta;

      // учёт ориентации экрана
      const ang = screenAngle();
      let yaw = dyaw, pitch = dpitch;
      if (ang === 90) { [yaw, pitch] = [dpitch, -dyaw]; }
      else if (ang === 270) { [yaw, pitch] = [-dpitch, dyaw]; }
      else if (ang === 180) { yaw = -dyaw; pitch = -dpitch; }

      camX = conf.sensorYawToPx * yaw;
      camY = -conf.sensorPitchToPx * pitch;
    }

    async function enableSensors() {
      try {
        if (typeof DeviceOrientationEvent !== 'undefined' &&
            typeof DeviceOrientationEvent.requestPermission === 'function') {
          const res = await DeviceOrientationEvent.requestPermission();
          if (res !== 'granted') throw new Error('denied');
        }
        window.addEventListener('deviceorientation', onOrientBound = onOrient, true);
      } catch {
        // останется джойстик
      }
    }

    if ('DeviceOrientationEvent' in window &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
      perm.style.display = 'inline-block';
      perm.onclick = enableSensors;
    } else {
      try { window.addEventListener('deviceorientation', onOrientBound = onOrient, true); } catch {}
    }

    // Джойстик
    let joy = false, jx = 0, jy = 0;
    canvas.addEventListener('pointerdown', (ev) => {
      joy = true; jx = ev.clientX; jy = ev.clientY;
      try { canvas.setPointerCapture(ev.pointerId); } catch {}
    });
    const endJoy = () => { joy = false; };
    canvas.addEventListener('pointerup', endJoy);
    canvas.addEventListener('pointercancel', endJoy);
    canvas.addEventListener('pointermove', (ev) => {
      if (!joy) return;
      camX = (ev.clientX - jx) * 1.1;
      camY = (ev.clientY - jy) * 1.1;
    });

    // Быстрая перекалибровка (dblclick по канвасу или R)
    canvas.addEventListener('dblclick', recenterSensors, { passive:true });
    onKeyBound = (ev) => {
      if (ev.key === 'Escape') finish({ success:false });
      if (ev.key === 'r' || ev.key === 'R') recenterSensors();
    };
    window.addEventListener('keydown', onKeyBound);

    // Игровая модель
    let gx = 0, gy = 0;
    let vx = 0, vy = 0;
    {
      const a = Math.random() * Math.PI * 2;
      vx = Math.cos(a) * conf.minSpeed * 0.8;
      vy = Math.sin(a) * conf.minSpeed * 0.8;
    }

    let holdMs = 0;
    const holdNeed = conf.holdMs;
    const centerX = () => W / 2;
    const centerY = () => H / 2;
    const Rcatch  = () => conf.catchRadius;
    const VMAX    = conf.maxSpeed * 0.65;

    function draw(aimX, aimY) {
      ctx.clearRect(0, 0, W, H);

      // прицел
      ctx.beginPath();
      ctx.arc(aimX, aimY, Rcatch(), 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,.85)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // призрак
      const scrX = gx + centerX() - camXS;
      const scrY = gy + centerY() - camYS;

      const grd = ctx.createRadialGradient(scrX - 10, scrY - 10, 5, scrX, scrY, 40);
      grd.addColorStop(0, 'rgba(255,255,255,.95)');
      grd.addColorStop(1, 'rgba(0,200,255,.25)');
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(scrX, scrY, 26, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = 'rgba(255,255,255,.92)';
      ctx.font = '32px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('👻', scrX, scrY);
    }

    // Завершение
    let finished = false;
    function finish(result) {
      if (finished) return;
      finished = true;
      try { cancelAnimationFrame(raf); } catch {}
      resolveDone && resolveDone(result);
    }

    // Пауза при сворачивании вкладки
    let paused = false;
    onVisibilityBound = () => {
      if (document.hidden) {
        paused = true;
        try { cancelAnimationFrame(raf); } catch {}
      } else {
        if (paused) {
          paused = false;
          last = performance.now();
          raf = requestAnimationFrame(tick);
        }
      }
    };
    document.addEventListener('visibilitychange', onVisibilityBound, { passive:true });

    // Подписки
    window.addEventListener('resize', resizeCanvas, { passive:true });

    // Игровой цикл
    let last = performance.now();
    let wasInCircle = false;

    function tick(ts) {
      const dtMs = Math.min(50, ts - last);
      const dt = dtMs / 1000;
      last = ts;

      // сглаживание камеры
      camXS = camXS * 0.85 + camX * 0.15;
      camYS = camYS * 0.85 + camY * 0.15;

      const aimX = centerX();
      const aimY = centerY();

      // экранные координаты призрака
      const scrX = gx + centerX() - camXS;
      const scrY = gy + centerY() - camYS;

      const dx = scrX - aimX;
      const dy = scrY - aimY;
      const dist = Math.hypot(dx, dy);

      const dirx = dist > 0 ? dx / dist : 0;
      const diry = dist > 0 ? dy / dist : 0;

      // таргет-скорость с "slow zone"
      let t = Math.min(1, dist / (Rcatch() * 2.5));
      let speedTarget = conf.minSpeed + (conf.baseSpeed - conf.minSpeed) * t;
      if (dist < Rcatch())        speedTarget *= 0.20;
      else if (dist < Rcatch()*1.6) speedTarget *= 0.55;
      speedTarget = Math.min(speedTarget, VMAX);

      // приближаем текущую скорость к целевой
      const vdx = dirx * speedTarget;
      const vdy = diry * speedTarget;
      vx += (vdx - vx) * conf.accel * dt;
      vy += (vdy - vy) * conf.accel * dt;

      const friction = Math.exp(-0.5 * dt);
      vx *= friction; vy *= friction;

      gx += vx * dt; gy += vy * dt;

      // границы
      const limX = (W/2) * 0.95, limY = (H/2) * 0.95;
      if (gx >  limX) { gx =  limX; vx *= -0.3; }
      if (gx < -limX) { gx = -limX; vx *= -0.3; }
      if (gy >  limY) { gy =  limY; vy *= -0.3; }
      if (gy < -limY) { gy = -limY; vy *= -0.3; }

      // прогресс удержания
      const inCircle = dist <= Rcatch();
      if (inCircle) {
        if (!wasInCircle) { navigator.vibrate?.(15); }
        holdMs += dt * 1000;
      } else if (dist <= Rcatch() * 1.15) {
        holdMs = Math.max(0, holdMs - dt * 150);
      } else if (dist <= Rcatch() * 1.6) {
        holdMs = Math.max(0, holdMs - dt * 300);
      } else {
        holdMs = Math.max(0, holdMs - dt * 600);
      }
      wasInCircle = inCircle;

      const pct = Math.max(0, Math.min(100, Math.round(100 * holdMs / holdNeed)));
      barIn.style.width = pct + '%';

      // рендер
      draw(aimX, aimY);

      // финиш
      if (holdMs >= holdNeed) {
        finish({ success:true });
        return;
      }
      raf = requestAnimationFrame(tick);
    }

    // Очистка
    cleanup = () => {
      try { cancelAnimationFrame(raf); } catch {}
      if (onOrientBound) { try { window.removeEventListener('deviceorientation', onOrientBound, true); } catch {} onOrientBound = null; }
      if (onResizeBound)  { try { window.removeEventListener('resize', onResizeBound); } catch {} onResizeBound = null; }
      if (onKeyBound)     { try { window.removeEventListener('keydown', onKeyBound); } catch {} onKeyBound = null; }
      if (onVisibilityBound) { try { document.removeEventListener('visibilitychange', onVisibilityBound); } catch {} onVisibilityBound = null; }

      // стоп камера
      try { stopCamera(); } catch {}

      close.onclick = null;
      stage.innerHTML = '';
      modal.classList.add('hidden');
      window.dispatchEvent(new Event('ar:close'));
      _busy = false;
    };

    // Кнопка закрытия
    close.onclick = () => { finish({ success:false }); };

    // Показать «Сенсоры» на iOS
    if ('DeviceOrientationEvent' in window &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
      perm.style.display = 'inline-block';
    }

    // Старт
    raf = requestAnimationFrame(tick);

    const result = await done;
    cleanup();
    return result;

  } catch (err) {
    console.error('AR error:', err);
    cleanup();
    _busy = false;
    return { success:false };
  }
}
