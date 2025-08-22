// ghostCatch.js
import { DIFFICULTY } from '../env.js';

/** Мини-игра «Поймай призрака»: держи цель в прицеле нужное время.
 *  Вариант B «Mystic Ember»: камера на фоне, тёплая палитра, заполняемое кольцо прицела.
 *  Механика не изменена.
 */
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

/* =========================
   ВИЗУАЛ: Mystic Ember
   ========================= */
const THEME = {
  name: 'Mystic Ember',
  fg: '#fff8e7',
  ring: ['#fbbf24', '#a78bfa', '#f472b6'],     // градиент заполнения кольца
  aimGlow: 'rgba(255,196,87,0.35)',            // свечение вокруг прицела
  ghostCore: 'rgba(245,250,255,0.98)',         // центр призрака
  ghostAura: 'rgba(120,80,255,0.25)',          // аура призрака
  vignette: 'radial-gradient(120% 120% at 50% 40%, rgba(0,0,0,0) 40%, rgba(20,0,20,0.45) 95%)',
  particles: { count: 28, mode: 'bokeh' },     // мягкие «боке»-частицы
  scanline: false
};

function makeParticles(W, H){
  const n = THEME.particles.count;
  const arr = new Array(n).fill(0).map(()=>({
    x: Math.random()*W, y: Math.random()*H,
    r: 2 + Math.random()*6,
    a: Math.random()*Math.PI*2,
    s: 0.2 + Math.random()*0.8
  }));
  return arr;
}

function updateParticles(p, W, H, dt){
  for (const it of p){
    it.a += 0.3*dt;
    it.x += Math.cos(it.a)*it.s;
    it.y += Math.sin(it.a)*it.s*0.6;
    if (it.x < -10) it.x = W+10;
    if (it.x > W+10) it.x = -10;
    if (it.y < -10) it.y = H+10;
    if (it.y > H+10) it.y = -10;
  }
}

function drawBackground(ctx, W, H, t){
  // лёгкий вертикальный градиент для глубины
  const g = ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,'rgba(0,0,0,0.00)');
  g.addColorStop(1,'rgba(0,0,0,0.10)');
  ctx.fillStyle = g;
  ctx.fillRect(0,0,W,H);
}

function drawDonutProgress(ctx, cx, cy, outerR, width, progress, colors) {
  // Фон-трек кольца
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath();
  ctx.arc(cx, cy, outerR, 0, Math.PI*2, false);
  ctx.arc(cx, cy, outerR - width, Math.PI*2, 0, true);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Заполненная часть (сектор-бублик)
  const clamped = Math.max(0, Math.min(1, progress));
  if (clamped <= 0) return;

  const start = -Math.PI/2;
  const end = start + Math.PI*2*clamped;

  const grd = ctx.createConicGradient(start, cx, cy);
  const steps = colors.length;
  for (let i=0;i<steps;i++){
    grd.addColorStop(i/(steps-1), colors[i]);
  }
  ctx.save();
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(cx, cy, outerR, start, end, false);
  ctx.arc(cx, cy, outerR - width, end, start, true);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawReticle(ctx, cx, cy, radius, t, progress){
  // Внешнее свечение и контур
  ctx.save();
  ctx.shadowColor = THEME.aimGlow;
  ctx.shadowBlur = 18;
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI*2); ctx.stroke();
  ctx.restore();

  // «Зарубки»
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 1.2;
  const seg = 24;
  for (let i=0;i<seg;i++){
    const a0 = (i/seg)*Math.PI*2 + t*0.25;
    const len = (i%2===0? 10:6);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a0)*(radius- len), cy + Math.sin(a0)*(radius- len));
    ctx.lineTo(cx + Math.cos(a0)*(radius),      cy + Math.sin(a0)*(radius));
    ctx.stroke();
  }
  ctx.restore();

  // Заполняемое кольцо прогресса (donut)
  drawDonutProgress(ctx, cx, cy, radius + 12, 8, progress, THEME.ring);
}

function drawGhost(ctx, x, y, t){
  // аура
  const grd = ctx.createRadialGradient(x-10, y-10, 5, x, y, 42);
  grd.addColorStop(0, THEME.ghostCore);
  grd.addColorStop(1, THEME.ghostAura);
  ctx.fillStyle = grd;
  ctx.beginPath(); ctx.arc(x, y, 26, 0, Math.PI*2); ctx.fill();

  // лёгкий хвост
  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.beginPath(); ctx.arc(x - Math.cos(t*2)*8, y - Math.sin(t*2)*8, 20, 0, Math.PI*2); ctx.fill();
  ctx.restore();

  // эмодзи
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.font = '32px system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('👻', x, y);
}

/* =========================
   ИГРА
   ========================= */
export async function openGhostCatch(rarity = 'common') {
  if (_busy) return { success: false };

  const modal = document.getElementById('ar-modal');
  const stage = document.getElementById('ar-stage');
  const title = document.getElementById('ar-title');
  const close = document.getElementById('ar-close');
  if (!modal || !stage || !close) return { success:false };

  _busy = true;

  let resolveDone; const done = new Promise(res => { resolveDone = res; });

  let raf = 0;
  let onOrientBound = null;
  let onResizeBound = null;
  let onKeyBound = null;
  let onVisibilityBound = null;

  // камера
  let stopCamera = () => {};
  let cameraReady = false;

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
      height: '100vh',
      overflow: 'hidden'
    });

    // Правильный 100vh на мобильных
    const applyVh = () => {
      const vh = window.innerHeight * 0.01;
      stage.style.setProperty('--vh', `${vh}px`);
      stage.style.height = `calc(var(--vh) * 100)`;
    };
    applyVh();

    // Контейнер
    const wrap = document.createElement('div');
    Object.assign(wrap.style, {
      position: 'relative',
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      background: '#000'
    });
    stage.appendChild(wrap);

    // Видео-фон (камера)
    const video = document.createElement('video');
    Object.assign(video, { autoplay:true, playsInline:true, muted:true });
    Object.assign(video.style, {
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      zIndex: 0,
      background: '#000'
    });
    wrap.appendChild(video);

    // Виньетка
    const fx = document.createElement('div');
    Object.assign(fx.style, {
      position: 'absolute',
      inset: 0,
      zIndex: 1,
      pointerEvents: 'none',
      background: THEME.vignette
    });
    wrap.appendChild(fx);

    // Canvas
    const canvas = document.createElement('canvas');
    Object.assign(canvas.style, {
      position: 'absolute',
      inset: 0,
      display: 'block',
      width: '100%',
      height: '100%',
      touchAction: 'none',
      zIndex: 2,
      background: 'transparent'
    });
    wrap.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    // HUD (верхний прогресс)
    const hud = document.createElement('div');
    Object.assign(hud.style, {
      position: 'absolute',
      left: 0, right: 0, top: 0,
      padding: '16px 14px calc(env(safe-area-inset-bottom,0) + 12px)',
      display: 'flex',
      justifyContent: 'center',
      zIndex: 3,
      pointerEvents: 'none'
    });
    wrap.appendChild(hud);

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
      background: 'linear-gradient(90deg,#fbbf24,#a78bfa,#f472b6)'
    });
    bar.appendChild(barIn);
    hud.appendChild(bar);

    // Кнопка «Сенсоры» (iOS)
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
      background: 'linear-gradient(90deg,#fbbf24,#a78bfa,#f472b6)',
      color: '#00131a',
      cursor: 'pointer',
      display: 'none'
    });
    wrap.appendChild(perm);

    // Авто-камера (без кнопки «Камера»)
    async function startCamera(preferEnvironment = true) {
      stopCamera();
      cameraReady = false;
      try {
        const constraints = { video: { facingMode: preferEnvironment ? { ideal: 'environment' } : 'user' }, audio: false };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = stream;
        await video.play().catch(()=>{});
        cameraReady = true;
        stopCamera = () => {
          try {
            const tr = stream.getTracks?.() || [];
            tr.forEach(t => t.stop?.());
          } catch {}
          video.srcObject = null;
          cameraReady = false;
        };
      } catch (e) {
        // фоллбек — чёрный фон + виньетка
        console.warn('[AR] Camera not available:', e);
      }
    }
    if (navigator.mediaDevices?.getUserMedia) {
      await startCamera(true);
    }

    // Размеры/ретина
    let W = 300, H = 500;
    function resizeCanvasOnly() {
      const cssW = wrap.clientWidth || window.innerWidth;
      const cssH = wrap.clientHeight || window.innerHeight;
      const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
      canvas.style.width = cssW + 'px';
      canvas.style.height = cssH + 'px';
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      W = cssW; H = cssH;
      particles = makeParticles(W, H);
    }
    resizeCanvasOnly();

    // Управление (сенсоры + джойстик)
    const conf = _difficulty(rarity);
    let camX = 0, camY = 0;
    let camXS = 0, camYS = 0;
    let baseAlpha = null, baseBeta = null;
    let firstSensorTick = false;

    const shortest = (a) => (((a + 180) % 360) + 360) % 360 - 180;
    const screenAngle = () => {
      const ang = (screen.orientation?.angle ?? window.orientation ?? 0) || 0;
      const n = ((ang % 360) + 360) % 360;
      return n === 0 || n === 90 || n === 180 || n === 270 ? n : 0;
    };
    function recenterSensors(){ baseAlpha = null; baseBeta = null; }

    function onOrient(e) {
      if (e.alpha == null || e.beta == null) return;
      if (!firstSensorTick) { firstSensorTick = true; perm.style.display = 'none'; }
      if (baseAlpha == null) baseAlpha = e.alpha;
      if (baseBeta  == null) baseBeta  = e.beta;

      let dyaw = shortest(e.alpha - baseAlpha);
      let dpitch = e.beta - baseBeta;

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
      } catch { /* остаётся джойстик */ }
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

    // Быстрая перекалибровка
    canvas.addEventListener('dblclick', recenterSensors, { passive:true });
    onKeyBound = (ev) => {
      if (ev.key === 'Escape') finish({ success:false });
      if (ev.key === 'r' || ev.key === 'R') recenterSensors();
    };
    window.addEventListener('keydown', onKeyBound);

    // Игровая модель
    let gx = 0, gy = 0, vx = 0, vy = 0;
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

    // Частицы и тайминг
    let tAnim = 0;
    let particles = makeParticles(W, H);

    function drawFrame(aimX, aimY, scrX, scrY, progress) {
      drawBackground(ctx, W, H, tAnim);

      // частицы (bokeh)
      ctx.save();
      for (const it of particles) {
        ctx.globalAlpha = 0.12 + 0.10*Math.sin(tAnim*2 + it.a);
        ctx.fillStyle = 'rgba(255,255,255,1)';
        ctx.beginPath(); ctx.arc(it.x, it.y, it.r, 0, Math.PI*2); ctx.fill();
      }
      ctx.restore();

      drawReticle(ctx, aimX, aimY, Rcatch(), tAnim, progress);
      drawGhost(ctx, scrX, scrY, tAnim);
    }

    // Завершение
    let finished = false;
    function finish(result) {
      if (finished) return;
      finished = true;
      try { cancelAnimationFrame(raf); } catch {}
      resolveDone && resolveDone(result);
    }

    // Пауза при сворачивании
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

    // Resize обработчик: и высота, и канвас
    onResizeBound = () => { applyVh(); resizeCanvasOnly(); };
    window.addEventListener('resize', onResizeBound, { passive:true });

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

      // таргет-скорость с «slow zone»
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
      tAnim += dt;
      updateParticles(particles, W, H, dt);
      const progress = Math.max(0, Math.min(1, holdMs/holdNeed));
      ctx.clearRect(0,0,W,H);
      drawFrame(aimX, aimY, scrX, scrY, progress);

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

    // Показать «Сенсоры» на iOS (камера-кнопка удалена по запросу)
    if ('DeviceOrientationEvent' in window &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
      perm.style.display = 'inline-block';
    }

    // Старт
    let last = performance.now();
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
