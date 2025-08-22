import { DIFFICULTY, AR_TUNING } from '../env.js';

/**
 * Мини‑игра AR «Поймай призрака»
 * Управление: поворачиваем телефон; прицел (центр экрана) должен удерживать призрака,
 * пока кольцо прогресса не заполнится.
 * - Скорость зависит от редкости точки (DIFFICULTY.baseSpeed)
 * - Если сенсоры недоступны (или не выданы права iOS) — появляется джойстик.
 */
let _busy = false;

export async function openGhostCatch(rarity = 'common') {
  if (_busy) return { success: false };
  _busy = true;
  try {
    const modal = document.getElementById('ar-modal');
    const stage = document.getElementById('ar-stage');
    const closeBtn = document.getElementById('ar-close');
    if (!modal || !stage) return { success: false };

    // Очистим сцену и откроем модалку
    stage.innerHTML = '';
    modal.classList.remove('hidden');

    /* -------------------- Камера (фон) -------------------- */
    const video = document.createElement('video');
    video.setAttribute('autoplay', '');
    video.setAttribute('playsinline', '');
    video.muted = true;
    Object.assign(video.style, {
      position: 'absolute', inset: '0', width: '100%', height: '100%',
      objectFit: 'cover', transform: 'scaleX(-1)' // зеркалим, но просим back
    });
    stage.appendChild(video);

    // Запуск камеры с graceful fallback
    let stream = null;
    try {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
      video.srcObject = stream;
      await video.play();
    } catch (err) {
      console.warn('[AR] camera error:', err);
      // не критично — можно играть и без камеры
    }

    /* -------------------- Overlay UI -------------------- */
    const overlay = document.createElement('div');
    Object.assign(overlay.style, { position: 'absolute', inset: '0', overflow: 'hidden' });
    stage.appendChild(overlay);

    const centerX = () => overlay.clientWidth / 2;
    const centerY = () => overlay.clientHeight / 2;

    // Прицел и прогресс-кольцо
    const Rcatch = Math.max(18, Number(DIFFICULTY[rarity]?.reticleRadiusPx ?? 50));
    const holdMsTarget = Math.max(1200, Number(DIFFICULTY[rarity]?.holdMs ?? 1600));
    const baseSpeed = Math.max(60, Number(DIFFICULTY[rarity]?.baseSpeed ?? 200));

    const reticle = document.createElement('div');
    Object.assign(reticle.style, {
      position: 'absolute',
      left: '50%', top: '50%',
      width: `${Rcatch*2}px`, height: `${Rcatch*2}px`,
      marginLeft: `-${Rcatch}px`, marginTop: `-${Rcatch}px`,
      borderRadius: '50%',
      border: '2px solid rgba(255,255,255,.75)',
      boxShadow: '0 0 0 3px rgba(0,0,0,.25), inset 0 0 24px rgba(0,255,220,.15)',
      backdropFilter: 'blur(1px)',
      pointerEvents: 'none'
    });
    overlay.appendChild(reticle);

    const ring = document.createElement('div');
    const ringSize = Rcatch * 2 + 16;
    Object.assign(ring.style, {
      position: 'absolute', left: '50%', top: '50%',
      width: `${ringSize}px`, height: `${ringSize}px`,
      marginLeft: `-${ringSize/2}px`, marginTop: `-${ringSize/2}px`,
      borderRadius: '50%',
      background: 'conic-gradient(#00ffd0 0deg, rgba(255,255,255,.15) 0deg)',
      boxShadow: '0 0 14px rgba(0,255,220,.35)',
      pointerEvents: 'none'
    });
    overlay.appendChild(ring);
    const setRing = (p) => {
      const clamped = Math.max(0, Math.min(1, p || 0));
      const deg = Math.floor(360 * clamped);
      ring.style.background = `conic-gradient(#00ffd0 ${deg}deg, rgba(255,255,255,.15) ${deg}deg)`;
    };
    setRing(0);

    // Призрак
    const ghost = document.createElement('div');
    Object.assign(ghost.style, {
      position: 'absolute',
      width: '96px', height: '96px',
      left: '50%', top: '50%', marginLeft: '-48px', marginTop: '-48px',
      borderRadius: '26%',
      background: 'radial-gradient(60% 60% at 30% 30%, rgba(255,255,255,.95), rgba(255,255,255,.2)), radial-gradient(55% 55% at 70% 70%, rgba(0,200,255,.5), rgba(0,0,0,0))',
      border: '2px solid rgba(255,255,255,.4)',
      boxShadow: '0 12px 30px rgba(0,0,0,.45), inset 0 0 18px rgba(0,200,255,.35)',
      display: 'grid', placeItems: 'center',
      fontSize: '64px', userSelect: 'none'
    });
    ghost.textContent = '👻';
    overlay.appendChild(ghost);

    // Подсказки-стрелки по краям
    const arrow = (chr) => {
      const a = document.createElement('div');
      a.textContent = chr;
      Object.assign(a.style, { position:'absolute', color:'#fff', fontSize:'28px', textShadow:'0 2px 8px rgba(0,0,0,.5)', opacity:'0', transition:'opacity .2s' });
      overlay.appendChild(a); return a;
    };
    const arrowL = arrow('⬅'), arrowR = arrow('➡'), arrowT = arrow('⬆'), arrowB = arrow('⬇');
    arrowL.style.left='8px';  arrowL.style.top='50%';  arrowL.style.transform='translateY(-50%)';
    arrowR.style.right='8px'; arrowR.style.top='50%';  arrowR.style.transform='translateY(-50%)';
    arrowT.style.top='8px';   arrowT.style.left='50%'; arrowT.style.transform='translateX(-50%)';
    arrowB.style.bottom='8px';arrowB.style.left='50%'; arrowB.style.transform='translateX(-50%)';

    const updateArrows = (sx,sy) => {
      const w = overlay.clientWidth, h = overlay.clientHeight;
      const pad = 40;
      const left = sx < -pad, right = sx > w + pad, top = sy < -pad, bottom = sy > h + pad;
      arrowL.style.opacity = left   ? '1' : '0';
      arrowR.style.opacity = right  ? '1' : '0';
      arrowT.style.opacity = top    ? '1' : '0';
      arrowB.style.opacity = bottom ? '1' : '0';
    };

    /* -------------------- Управление -------------------- */
    let useSensors = false;
    let camX = 0, camY = 0; // смещение «камеры» в пикселях
    const yawToPx   = Number(AR_TUNING?.sensorYawToPx   ?? 6);
    const pitchToPx = Number(AR_TUNING?.sensorPitchToPx ?? 6);

    const calib = { alpha0: null as null | number, beta0: null as null | number };
    function shortestAngle(a:number){ return ((a + 180) % 360 + 360) % 360 - 180; }

    function handleOrientation(e: DeviceOrientationEvent){
      const alpha = (e as any).alpha, beta = (e as any).beta;
      if (alpha == null || beta == null) return;
      if (calib.alpha0 == null) calib.alpha0 = alpha;
      if (calib.beta0  == null) calib.beta0  = beta;
      const dyaw   = shortestAngle(alpha - (calib.alpha0 as number));
      const dpitch = beta - (calib.beta0 as number);
      camX = dyaw * yawToPx;
      camY = -dpitch * pitchToPx; // инверсия: наклон вниз → движение вниз
    }

    // Кнопка разрешения (iOS)
    const permWrap = document.createElement('div');
    Object.assign(permWrap.style, {
      position:'absolute', left:'50%', bottom:'16px', transform:'translateX(-50%)',
      background:'rgba(0,0,0,.35)', color:'#fff', padding:'10px 12px',
      borderRadius:'12px', fontSize:'14px', display:'flex', gap:'10px', alignItems:'center'
    });
    const permBtn = document.createElement('button');
    permBtn.textContent = 'Включить управление';
    Object.assign(permBtn.style, {
      appearance:'none', border:'none', borderRadius:'999px',
      padding:'8px 12px', fontWeight:'800', cursor:'pointer',
      background:'linear-gradient(90deg,#00ffcc,#00bfff,#0077ff)', color:'#00131a'
    });
    const permMsg = document.createElement('span');
    permMsg.textContent = 'Чтобы управлять поворотом, разрешите доступ к гиродатчикам.';
    permWrap.appendChild(permMsg); permWrap.appendChild(permBtn);
    overlay.appendChild(permWrap);

    // Виртуальный джойстик — fallback
    const joystick = document.createElement('div');
    Object.assign(joystick.style, {
      position:'absolute', left:'16px', bottom:'16px',
      width:'96px', height:'96px', borderRadius:'50%',
      background:'rgba(255,255,255,.1)', border:'1px solid rgba(255,255,255,.25)',
      touchAction:'none', display:'none'
    });
    overlay.appendChild(joystick);
    let joyActive=false, joyBase={x:0,y:0};
    joystick.addEventListener('pointerdown', (e)=>{ joyActive=true; joyBase={x:e.clientX,y:e.clientY}; joystick.setPointerCapture(e.pointerId); });
    joystick.addEventListener('pointermove', (e)=>{ if(!joyActive) return; camX = (e.clientX-joyBase.x)*1.6; camY=(e.clientY-joyBase.y)*1.6; });
    const endJoy = ()=>{ joyActive=false; camX*=0.5; camY*=0.5; };
    joystick.addEventListener('pointerup', endJoy);
    joystick.addEventListener('pointercancel', endJoy);

    async function tryEnableSensors(){
      try {
        if (typeof DeviceOrientationEvent !== 'undefined' && typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
          const resp = await (DeviceOrientationEvent as any).requestPermission();
          if (resp === 'granted') {
            window.addEventListener('deviceorientation', handleOrientation as any, true);
            useSensors = true; permWrap.style.display='none'; joystick.style.display='none'; return true;
          }
        } else if ('ondeviceorientation' in window) {
          window.addEventListener('deviceorientation', handleOrientation as any, true);
          useSensors = true; permWrap.style.display='none'; joystick.style.display='none'; return true;
        }
      } catch (err) {
        console.warn('[AR] orientation permission error:', err);
      }
      // не удалось — включаем джойстик
      useSensors = false;
      permMsg.textContent = 'Сенсоры недоступны. Используйте виртуальный джойстик слева.';
      joystick.style.display = 'block';
      return false;
    }
    permBtn.onclick = () => { tryEnableSensors(); };
    // авто‑попытка на Android
    tryEnableSensors();

    /* -------------------- Игровая динамика -------------------- */
    // Позиция призрака в «мире» (px), 0,0 — центр экрана
    let gx = (Math.random()*2-1) * centerX() * 0.6;
    let gy = (Math.random()*2-1) * centerY() * 0.6;
    let vx = 0, vy = 0;
    let lastT = performance.now(), holdMs = 0, lastNearTs = 0, lastFeintTs = 0;

    const nearBoost = 90 + (rarity==='advanced'?40:0) + (rarity==='rare'?90:0);
    const fatigueMs = 650;
    const edgeBounce = 0.85;
    const feintEveryMs = Number(AR_TUNING?.feintEveryMs ?? 2200);

    const vib = (p:any)=>{ try{ navigator.vibrate && navigator.vibrate(p); }catch{} };

    function tick(){
      const now = performance.now();
      const dt = Math.min(50, now - lastT) / 1000;
      lastT = now;

      const w = overlay.clientWidth, h = overlay.clientHeight;
      const cx = centerX(), cy = centerY();

      // Экранные координаты с учётом «взгляда»
      let sx = (gx - camX) + cx;
      let sy = (gy - camY) + cy;

      // Вектор от центра прицела
      const dx = sx - cx;
      const dy = sy - cy;
      const dist = Math.hypot(dx, dy);

      // направление «убегать от центра»
      const dirX = dx === 0 ? 0 : dx / (dist || 1);
      const dirY = dy === 0 ? 0 : dy / (dist || 1);

      // скорость: базовая + бонус если близко
      let speed = baseSpeed + (dist < Rcatch*1.7 ? nearBoost : 0);
      if (now - lastNearTs < fatigueMs) speed *= 0.45; // «усталость» после почти‑поимки

      // финт раз в N мс: мгновенная смена направления
      if (now - lastFeintTs > feintEveryMs) {
        lastFeintTs = now;
        const perp = Math.random() < 0.5 ? [ -dirY, dirX ] : [ dirY, -dirX ];
        vx += perp[0] * (60 + baseSpeed*0.6);
        vy += perp[1] * (60 + baseSpeed*0.6);
      }

      // убегаем
      vx += dirX * speed * dt;
      vy += dirY * speed * dt;

      // трение
      const friction = 0.92;
      vx *= friction; vy *= friction;

      // обновляем мировые координаты
      gx += vx * dt;
      gy += vy * dt;

      // границы мира (чуть шире экрана)
      const limitX = w * 0.55, limitY = h * 0.55;
      if (gx > limitX)  { gx = limitX;  vx *= -edgeBounce; }
      if (gx < -limitX) { gx = -limitX; vx *= -edgeBounce; }
      if (gy > limitY)  { gy = limitY;  vy *= -edgeBounce; }
      if (gy < -limitY) { gy = -limitY; vy *= -edgeBounce; }

      // пересчёт в экран
      sx = (gx - camX) + cx;
      sy = (gy - camY) + cy;

      // позиция и лёгкая пульсация
      const pulse = 1 + Math.sin(now / 220) * 0.03;
      ghost.style.transform = `translate(${Math.round(sx - 48)}px, ${Math.round(sy - 48)}px) scale(${pulse})`;

      // стрелки
      updateArrows(sx, sy);

      // проверка поимки
      if (dist <= Rcatch) {
        holdMs += dt * 1000;
        if (Math.abs(dist - Rcatch) < 6) lastNearTs = now;
        if (holdMs >= holdMsTarget) {
          vib([60,40,60]);
          const sound = document.getElementById('energy-sound');
          if (sound) { try { sound.currentTime = 0; sound.play(); } catch{} }
          cleanup(true);
          return;
        }
      } else {
        holdMs = Math.max(0, holdMs - dt * 1000 * 0.55);
      }
      setRing(holdMs / holdMsTarget);

      rafId = requestAnimationFrame(tick);
    }

    // запуск цикла
    let rafId = requestAnimationFrame(tick);

    function cleanup(success=false){
      cancelAnimationFrame(rafId);
      try{ stream && stream.getTracks().forEach(t => t.stop()); }catch{}
      try{ window.removeEventListener('deviceorientation', handleOrientation as any, true); }catch{}
      modal.classList.add('hidden');
      stage.innerHTML = '';
      _busy = false;
      resultResolve({ success });
    }

    closeBtn.onclick = () => cleanup(false);

    // промис-ответ
    let resultResolve: (x:{success:boolean})=>void;
    const result = new Promise<{success:boolean}>(res => (resultResolve = res));
    return await result;

  } catch (err) {
    console.error('[AR] openGhostCatch error:', err);
    _busy = false;
    return { success:false };
  }
}
