// ghostCatch.js
import { DIFFICULTY } from '../env.js';

/** Мини-игра «Поймай призрака»: держи цель в прицеле нужное время */
let _busy = false;

function _difficulty(rarity) {
  const d = DIFFICULTY?.[rarity] || {};
  // Мягкое, более медленное движение по умолчанию
  return {
    sensorYawToPx:   d.sensorYawToPx   ?? 6,
    sensorPitchToPx: d.sensorPitchToPx ?? 6,
    baseSpeed:       d.baseSpeed       ?? ({ common:130, advanced:160, rare:190 }[rarity] || 140),
    minSpeed:        d.minSpeed        ?? ({ common: 20, advanced: 30, rare: 40 }[rarity] || 25),
    maxSpeed:        d.maxSpeed        ?? ({ common:220, advanced:260, rare:300 }[rarity] || 240),
    catchRadius:     d.catchRadius     ?? 70,
    holdMs:          d.holdMs          ?? ({ common:1100, advanced:1300, rare:1500 }[rarity] || 1200),
    // чем меньше accel — тем плавнее тяготение к целевой скорости
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
  if (!modal || !stage || !close) return { success: false };

  _busy = true;

  // ---- Создаём промис СРАЗУ (fix гонки) ----
  let resolveDone;
  const done = new Promise(res => { resolveDone = res; });

  let raf = 0;
  let onOrientBound = null;
  let onResizeBound = null;
  let onKeyBound = null;
  let onVisibilityBound = null;

  let cleanup = () => {};

  try {
    if (title) title.textContent = 'Поймайте призрака в круг';
    modal.classList.remove('hidden');
    window.dispatchEvent(new Event('ar:open'));

    // Сцена
    stage.innerHTML = '';
    const wrap = document.createElement('div');
    Object.assign(wrap.style, {
      position: 'relative',
      width: '100%',
      height: '100%',
      paddingTop: '4px',
      boxSizing: 'border-box'
    });
    stage.appendChild(wrap);

    // Canvas (ретина + адаптив 2:3)
    const canvas = document.createElement('canvas');
    Object.assign(canvas.style, {
      display: 'block',
      margin: '8px auto 0',
      borderRadius: '16px',
      background: 'radial-gradient(circle at 50% 40%, rgba(0,255,153,.18), transparent 60%), #0a0e11',
      maxWidth: '480px',
      width: '100%',
      height: 'auto',
      touchAction: 'none'
    });
    wrap.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    // Прогресс-бар
    const bar = document.createElement('div');
    const barIn = document.createElement('div');
    Object.assign(bar.style, {
      height: '10px',
      borderRadius: '8px',
      background: 'rgba(255,255,255,.12)',
      margin: '10px auto 0',
      maxWidth: '480px',
      width: '100%'
    });
    Object.assign(barIn.style, {
      height: '10px',
      width: '0%',
      borderRadius: '8px',
      background: 'linear-gradient(90deg,#22d3ee,#818cf8,#e879f9)'
    });
    bar.appendChild(barIn);
    wrap.appendChild(bar);

    // Кнопка включения сенсоров (для iOS)
    const perm = document.createElement('button');
    perm.textContent = 'Сенсоры';
    Object.assign(perm.style, {
      position: 'absolute',
      top: '12px',
      right: '18px',
      zIndex: 2,
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

    // Размеры холста
    let W = 360, H = 540; // исходное соотношение 2:3
    function resizeCanvas() {
      const host = bar;
      const cssW = Math.min(host.clientWidth || 360, 480);
      const cssH = Math.round(cssW * 3 / 2);
      const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
      canvas.style.width = cssW + 'px';
      canvas.style.height = cssH + 'px';
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // работаем в CSS-пикселях
      W = cssW; H = cssH;
    }
    resizeCanvas();
    onResizeBound = () => resizeCanvas();
    window.addEventListener('resize', onResizeBound, { passive: true });

    // ---- Управление (сенсоры + джойстик) ----
    const conf = _difficulty(rarity);
    let camX = 0, camY = 0;      // мгновенный сдвиг камеры
    let camXS = 0, camYS = 0;    // сглаженный сдвиг
    let baseAlpha = null, baseBeta = null;
    let firstSensorTick = false;

    const shortest = (a) => (((a + 180) % 360) + 360) % 360 - 180;
    const screenAngle = () => {
      const ang = (screen.orientation?.angle ?? window.orientation ?? 0) || 0;
      // нормализуем к [0,90,180,270]
      const n = ((ang % 360) + 360) % 360;
      return n === 0 || n === 90 || n === 180 || n === 270 ? n : 0;
    };

    function recenterSensors() {
      baseAlpha = null;
      baseBeta = null;
      // следующая валидная посылка сделает новую базу
    }

    function onOrient(e) {
      if (e.alpha == null || e.beta == null) return;
      if (!firstSensorTick) {
        firstSensorTick = true;
        perm.style.display = 'none'; // прячем только после первого валидного события
      }
      if (baseAlpha == null) baseAlpha = e.alpha;
      if (baseBeta == null) baseBeta = e.beta;

      // Расчёт yaw/pitch относительно базовых значений
      let dyaw = shortest(e.alpha - baseAlpha);
      let dpitch = e.beta - baseBeta;

      // Коррекция под ориентацию экрана
      // 0: портрет, 90: ландшафт (слева), 270: ландшафт (справа)
      const ang = screenAngle();
      let yaw = dyaw, pitch = dpitch;
      if (ang === 90) {        // поворот экрана влево
        [yaw, pitch] = [dpitch, -dyaw];
      } else if (ang === 270) {// поворот экрана вправо
        [yaw, pitch] = [-dpitch, dyaw];
      } else if (ang === 180) {// вверх ногами
        yaw = -dyaw; pitch = -dpitch;
      }
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
        // остаётся управление джойстиком
      }
    }

    if ('DeviceOrientationEvent' in window &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
      perm.style.display = 'inline-block';
      perm.onclick = enableSensors;
    } else {
      try {
        window.addEventListener('deviceorientation', onOrientBound = onOrient, true);
      } catch { /* no-op */ }
    }

    // Джойстик (pointer по холсту двигает камеру)
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
      camX = (ev.clientX - jx) * 1.1; // мягкий коэффициент
      camY = (ev.clientY - jy) * 1.1;
    });

    // Быстрая перекалибровка (dblclick по холсту или R)
    canvas.addEventListener('dblclick', recenterSensors, { passive: true });
    onKeyBound = (ev) => {
      if (ev.key === 'Escape') finish({ success: false });
      if (ev.key === 'r' || ev.key === 'R') recenterSensors();
    };
    window.addEventListener('keydown', onKeyBound);

    // ---- Модель призрака: старт из центра и сразу "плывёт" ----
    let gx = 0, gy = 0; // мир = центр прицела
    let vx = 0, vy = 0; // текущая скорость (px/s)
    {
      const a = Math.random() * Math.PI * 2;
      vx = Math.cos(a) * conf.minSpeed * 0.8;
      vy = Math.sin(a) * conf.minSpeed * 0.8;
    }

    // ---- Игровые параметры ----
    let holdMs = 0;
    const holdNeed = conf.holdMs;
    const centerX = () => W / 2;
    const centerY = () => H / 2;
    const Rcatch = () => conf.catchRadius;

    // Предел скорости помягче
    const VMAX = conf.maxSpeed * 0.65;

    // Рисование
    function draw(aimX, aimY) {
      ctx.clearRect(0, 0, W, H);

      // Прицел
      ctx.beginPath();
      ctx.arc(aimX, aimY, Rcatch(), 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,.75)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Координаты призрака на экране
      const scrX = gx + centerX() - camXS;
      const scrY = gy + centerY() - camYS;

      // Свечение
      const grd = ctx.createRadialGradient(scrX - 10, scrY - 10, 5, scrX, scrY, 40);
      grd.addColorStop(0, 'rgba(255,255,255,.95)');
      grd.addColorStop(1, 'rgba(0,200,255,.25)');
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(scrX, scrY, 26, 0, Math.PI * 2); ctx.fill();

      // Эмодзи
      ctx.fillStyle = 'rgba(255,255,255,.92)';
      ctx.font = '32px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('👻', scrX, scrY);
    }

    // Завершение мини-игры
    let finished = false;
    function finish(result) {
      if (finished) return;
      finished = true;
      try { cancelAnimationFrame(raf); } catch {}
      resolveDone && resolveDone(result);
    }

    // Пауза по видимости вкладки
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
    document.addEventListener('visibilitychange', onVisibilityBound, { passive: true });

    // Игровой цикл
    let last = performance.now();
    let wasInCircle = false;

    function tick(ts) {
      const dtMs = Math.min(50, ts - last);
      const dt = dtMs / 1000; // сек
      last = ts;

      // Сглаживаем камеру
      camXS = camXS * 0.85 + camX * 0.15;
      camYS = camYS * 0.85 + camY * 0.15;

      const aimX = centerX();
      const aimY = centerY();

      // Экранные координаты призрака
      const scrX = gx + centerX() - camXS;
      const scrY = gy + centerY() - camYS;

      // Вектор от прицела к призраку (в экранных координатах)
      const dx = scrX - aimX;
      const dy = scrY - aimY;
      const dist = Math.hypot(dx, dy);

      const dirx = dist > 0 ? dx / dist : 0;
      const diry = dist > 0 ? dy / dist : 0;

      // --- ПЛАВНОЕ ДВИЖЕНИЕ ---
      // t=0 рядом с центром, t=1 далеко (~за 2.5R)
      let t = Math.min(1, dist / (Rcatch() * 2.5));
      let speedTarget = conf.minSpeed + (conf.baseSpeed - conf.minSpeed) * t;

      // "Slow zone" возле круга — упрощаем поимку
      if (dist < Rcatch()) {
        speedTarget *= 0.20;
      } else if (dist < Rcatch() * 1.6) {
        speedTarget *= 0.55;
      }

      // ограничим верхнюю границу
      speedTarget = Math.min(speedTarget, VMAX);

      // желаемая скорость как вектор
      const vdx = dirx * speedTarget;
      const vdy = diry * speedTarget;

      // Плавное приближение текущей скорости к желаемой
      vx += (vdx - vx) * conf.accel * dt;
      vy += (vdy - vy) * conf.accel * dt;

      // Лёгкое трение
      const friction = Math.exp(-0.5 * dt);
      vx *= friction;
      vy *= friction;

      // Обновляем мировые координаты
      gx += vx * dt;
      gy += vy * dt;

      // Границы мира (мягкий отскок)
      const limX = (W / 2) * 0.95;
      const limY = (H / 2) * 0.95;
      if (gx >  limX) { gx =  limX; vx *= -0.3; }
      if (gx < -limX) { gx = -limX; vx *= -0.3; }
      if (gy >  limY) { gy =  limY; vy *= -0.3; }
      if (gy < -limY) { gy = -limY; vy *= -0.3; }

      // Захват / спад прогресса — щадящий рядом с кругом
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

      // Рисуем кадр
      draw(aimX, aimY);

      // Победа
      if (holdMs >= holdNeed) {
        finish({ success: true });
        return;
      }
      raf = requestAnimationFrame(tick);
    }

    // Очистка ресурсов
    cleanup = () => {
      try { cancelAnimationFrame(raf); } catch {}
      if (onOrientBound) {
        try { window.removeEventListener('deviceorientation', onOrientBound, true); } catch {}
        onOrientBound = null;
      }
      if (onResizeBound) {
        try { window.removeEventListener('resize', onResizeBound); } catch {}
        onResizeBound = null;
      }
      if (onKeyBound) {
        try { window.removeEventListener('keydown', onKeyBound); } catch {}
        onKeyBound = null;
      }
      if (onVisibilityBound) {
        try { document.removeEventListener('visibilitychange', onVisibilityBound); } catch {}
        onVisibilityBound = null;
      }
      close.onclick = null;
      stage.innerHTML = '';
      modal.classList.add('hidden');
      window.dispatchEvent(new Event('ar:close'));
      _busy = false;
    };

    // Кнопка закрытия
    close.onclick = () => {
      finish({ success: false });
    };

    // Старт цикла
    raf = requestAnimationFrame(tick);

    // Ждём завершения
    const result = await done;
    cleanup();
    return result;

  } catch (err) {
    console.error('AR error:', err);
    cleanup();
    _busy = false;
    return { success: false };
  }
}
