import { DIFFICULTY } from '../env.js';

/** Мини-игра «Поймай призрака»: держи цель в прицеле нужное время */
let _busy = false;

function _difficulty(rarity) {
  const d = DIFFICULTY?.[rarity] || {};
  return {
    sensorYawToPx:   d.sensorYawToPx   ?? 6,
    sensorPitchToPx: d.sensorPitchToPx ?? 6,
    baseSpeed:       d.baseSpeed       ?? ({ common:180, advanced:220, rare:260 }[rarity] || 200),
    nearBoost:       d.nearBoost       ?? ({ common: 80, advanced:110, rare:140 }[rarity] ||  90),
    minSpeed:        d.minSpeed        ?? ({ common: 40, advanced: 60, rare: 80 }[rarity] ||  50),
    maxSpeed:        d.maxSpeed        ?? ({ common:300, advanced:360, rare:420 }[rarity] || 340),
    catchRadius:     d.catchRadius     ?? 70,
    holdMs:          d.holdMs          ?? ({ common:1100, advanced:1300, rare:1500 }[rarity] || 1200),
  };
}

export async function openGhostCatch(rarity = 'common') {
  if (_busy) return { success: false };

  // Ищем DOM до установки _busy, иначе можно залипнуть в busy
  const modal = document.getElementById('ar-modal');
  const stage = document.getElementById('ar-stage');
  const title = document.getElementById('ar-title');
  const close = document.getElementById('ar-close');
  if (!modal || !stage || !close) return { success: false };

  _busy = true;

  let cleanup = () => {};
  try {
    if (title) title.textContent = 'Поймайте призрака в круг';
    modal.classList.remove('hidden');
    window.dispatchEvent(new Event('ar:open'));

    // Сцена
    stage.innerHTML = '';
    const wrap = document.createElement('div');
    Object.assign(wrap.style, { position: 'relative', width: '100%', height: '100%' });
    stage.appendChild(wrap);

    // Canvas
    const canvas = document.createElement('canvas');
    // Фиксированный холст (можно заменить на responsive при желании)
    const W = 360, H = 540;
    canvas.width = W; canvas.height = H;
    Object.assign(canvas.style, {
      display: 'block',
      margin: '12px auto',
      borderRadius: '16px',
      background: 'radial-gradient(circle at 50% 40%, rgba(0,255,153,.18), transparent 60%), #0a0e11'
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
      margin: '8px 12px 0'
    });
    Object.assign(barIn.style, {
      height: '10px',
      width: '0%',
      borderRadius: '8px',
      background: 'linear-gradient(90deg,#22d3ee,#818cf8,#e879f9)'
    });
    bar.appendChild(barIn);
    wrap.appendChild(bar);

    // Подсказка/кнопка разрешения сенсоров
    const perm = document.createElement('div');
    Object.assign(perm.style, {
      position: 'absolute',
      left: '50%',
      bottom: '16px',
      transform: 'translateX(-50%)',
      display: 'flex',
      gap: '10px',
      background: 'rgba(0,0,0,.35)',
      color: '#fff',
      padding: '8px 10px',
      borderRadius: '12px',
      alignItems: 'center',
      fontSize: '14px',
      pointerEvents: 'auto'
    });
    const permMsg = document.createElement('span');
    permMsg.textContent = 'Разрешите датчики для управления или используйте джойстик.';
    const permBtn = document.createElement('button');
    permBtn.textContent = 'Включить управление';
    Object.assign(permBtn.style, {
      border: 'none',
      borderRadius: '999px',
      padding: '6px 10px',
      fontWeight: '800',
      background: 'linear-gradient(90deg,#00ffcc,#00bfff,#0077ff)',
      color: '#00131a',
      cursor: 'pointer'
    });
    perm.appendChild(permMsg);
    perm.appendChild(permBtn);
    wrap.appendChild(perm);

    // Управление (сенсоры + джойстик)
    const conf = _difficulty(rarity);

    let camX = 0, camY = 0;     // мгновенное смещение «камеры»
    let camXS = 0, camYS = 0;   // сглаженное смещение
    let baseAlpha = null, baseBeta = null;
    let firstSensorTick = false;

    const shortest = (a) => (((a + 180) % 360) + 360) % 360 - 180;

    function onOrient(e) {
      if (e.alpha == null || e.beta == null) return;
      if (!firstSensorTick) {
        firstSensorTick = true;
        perm.style.display = 'none'; // скрываем только после первого валидного события
      }
      if (baseAlpha == null) baseAlpha = e.alpha;
      if (baseBeta == null) baseBeta = e.beta;
      const dyaw = shortest(e.alpha - baseAlpha);
      const dpitch = e.beta - baseBeta;
      camX = conf.sensorYawToPx * dyaw;
      camY = -conf.sensorPitchToPx * dpitch;
    }

    async function enableSensorsByGesture() {
      try {
        if (typeof DeviceOrientationEvent !== 'undefined' &&
            typeof DeviceOrientationEvent.requestPermission === 'function') {
          const r = await DeviceOrientationEvent.requestPermission();
          if (r !== 'granted') throw new Error('denied');
        }
        window.addEventListener('deviceorientation', onOrient, true);
        // не скрываем perm, пока не придёт первое валидное событие
      } catch {
        permMsg.textContent = 'Сенсоры недоступны. Используйте джойстик.';
      }
    }
    permBtn.onclick = enableSensorsByGesture;

    // На платформах без requestPermission пробуем сразу подписаться.
    if (!('DeviceOrientationEvent' in window &&
          typeof DeviceOrientationEvent.requestPermission === 'function')) {
      try {
        window.addEventListener('deviceorientation', onOrient, true);
        // скрывать perm будем только по факту первого валидного события
      } catch {
        // игнор
      }
    }

    // Джойстик (тач по холсту двигает камеру)
    let joy = false, jx = 0, jy = 0;
    canvas.addEventListener('pointerdown', (ev) => {
      joy = true; jx = ev.clientX; jy = ev.clientY;
      try { canvas.setPointerCapture(ev.pointerId); } catch {}
    });
    const endJoy = () => { joy = false; };
    canvas.addEventListener('pointerup', endJoy);
    canvas.addEventListener('pointercancel', endJoy);
    canvas.addEventListener('pointermove', (ev) => {
      if (joy) {
        camX = (ev.clientX - jx) * 1.2;
        camY = (ev.clientY - jy) * 1.2;
      }
    });

    // Модель призрака (мировые координаты gx, gy — центр мира совпадает с центром прицела)
    let gx = 0, gy = 0;  // старт строго в центре круга
    let vx = 0, vy = 0;  // мгновенная скорость

    // Задаём начальный толчок, чтобы призрак "побежал" сразу
    {
      const a = Math.random() * Math.PI * 2;
      vx = Math.cos(a) * conf.minSpeed;
      vy = Math.sin(a) * conf.minSpeed;
    }

    let holdMs = 0;
    let last = performance.now();
    const Rcatch = conf.catchRadius;
    const holdNeed = conf.holdMs;
    const centerX = W / 2, centerY = H / 2;

    function draw(aimX, aimY) {
      ctx.clearRect(0, 0, W, H);

      // прицел (фиксирован по центру)
      ctx.beginPath();
      ctx.arc(aimX, aimY, Rcatch, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,.7)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // призрак
      const scrX = gx + centerX - camXS;
      const scrY = gy + centerY - camYS;
      const grd = ctx.createRadialGradient(scrX - 10, scrY - 10, 5, scrX, scrY, 40);
      grd.addColorStop(0, 'rgba(255,255,255,.95)');
      grd.addColorStop(1, 'rgba(0,200,255,.25)');
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(scrX, scrY, 26, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = 'rgba(255,255,255,.9)';
      ctx.font = '32px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('👻', scrX, scrY);
    }

    // Промис завершения
    let resolve;
    const done = new Promise(res => { resolve = res; });

    let raf = 0;
    let finished = false;

    function finish(result) {
      if (finished) return;
      finished = true;
      try { cancelAnimationFrame(raf); } catch {}
      resolve(result);
    }

    function tick(ts) {
      const dt = Math.min(50, ts - last) / 1000; // сек
      last = ts;

      // Сглаживаем сенсоры
      camXS = camXS * 0.85 + camX * 0.15;
      camYS = camYS * 0.85 + camY * 0.15;

      // Прицел фиксирован по центру экрана
      const aimX = centerX;
      const aimY = centerY;

      // Экранные координаты призрака
      const scrX = gx + centerX - camXS;
      const scrY = gy + centerY - camYS;

      // Взаимное положение с прицелом
      const dx = scrX - aimX;
      const dy = scrY - aimY;
      const dist = Math.hypot(dx, dy);

      // Направление "убегания" от прицела в мировых координатах
      const dirx = dist > 0 ? dx / dist : 0;
      const diry = dist > 0 ? dy / dist : 0;

      // "Скорость преследования/избегания" (используем как целевую линейную скорость)
      let speed = conf.baseSpeed + (dist < Rcatch * 1.6 ? conf.nearBoost : 0);
      speed = Math.max(conf.minSpeed, Math.min(conf.maxSpeed, speed));

      // Физика (ускорение + демпфирование, все завязано на dt)
      const friction = Math.exp(-4 * dt); // чем больше константа, тем сильнее демпфирование
      vx = (vx + dirx * speed * dt) * friction;
      vy = (vy + diry * speed * dt) * friction;

      const vmod = Math.hypot(vx, vy);
      if (vmod > conf.maxSpeed) {
        const k = conf.maxSpeed / vmod; vx *= k; vy *= k;
      }
      if (vmod < conf.minSpeed && (dirx || diry)) {
        vx = dirx * conf.minSpeed;
        vy = diry * conf.minSpeed;
      }

      gx += vx * dt;
      gy += vy * dt;

      // Границы мира (слегка меньше, чем пол-экрана)
      const limX = (W / 2) * 0.95;
      const limY = (H / 2) * 0.95;
      if (gx >  limX) { gx =  limX; vx *= -0.8; }
      if (gx < -limX) { gx = -limX; vx *= -0.8; }
      if (gy >  limY) { gy =  limY; vy *= -0.8; }
      if (gy < -limY) { gy = -limY; vy *= -0.8; }

      // Захват
      if (dist <= Rcatch) {
        holdMs += dt * 1000;
      } else {
        holdMs = Math.max(0, holdMs - dt * 600); // постепенное "сползание" прогресса
      }
      const pct = Math.min(100, Math.floor(100 * holdMs / holdNeed));
      barIn.style.width = pct + '%';

      // Рендер кадра
      draw(aimX, aimY);

      if (holdMs >= holdNeed) {
        finish({ success: true });
        return;
      }
      raf = requestAnimationFrame(tick);
    }

    // Очистка ресурсов
    cleanup = () => {
      try { cancelAnimationFrame(raf); } catch {}
      try { window.removeEventListener('deviceorientation', onOrient, true); } catch {}
      close.onclick = null;
      stage.innerHTML = '';
      modal.classList.add('hidden');
      window.dispatchEvent(new Event('ar:close'));
      _busy = false;
    };

    // Кнопка закрытия
    close.onclick = () => finish({ success: false });

    // Старт анимации
    raf = requestAnimationFrame(tick);

    // Ожидаем завершение мини-игры
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
