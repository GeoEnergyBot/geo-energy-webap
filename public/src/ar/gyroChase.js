import { DIFFICULTY, AR_TUNING } from '../env.js';

let __arActive = false;

/**
 * Запуск мини-игры «Гироскопная погоня».
 * @param {'common'|'advanced'|'rare'} rarity
 */
export function openGyroChase(rarity='common') {
  if (__arActive) return Promise.resolve(false);
  __arActive = true;
  window.dispatchEvent(new Event('ar:open'));
  let __resolve;
  let __resolved = false;
  const __promise = new Promise((res)=>{ __resolve = res; });
  const modal = document.getElementById('ar-modal');
  const closeBtn = document.getElementById('ar-close');
  const stage = document.getElementById('ar-stage');

  const diff = DIFFICULTY[rarity] || DIFFICULTY.common;
  const {
    fatigueMs, edgeBounce, feintEveryMs,
    sensorYawToPx, sensorPitchToPx, joystickSensitivity
  } = AR_TUNING;

  stage.innerHTML = '';
  modal.classList.remove('hidden');

  // Камера
  const video = document.createElement('video');
  video.setAttribute('autoplay',''); video.setAttribute('playsinline','');
  video.muted = true;
  Object.assign(video.style, { position:'absolute', inset:'0', width:'100%', height:'100%', objectFit:'cover', zIndex:'0' });
  stage.appendChild(video);

  // Overlay
  const overlay = document.createElement('div');
  Object.assign(overlay.style, { position:'absolute', inset:'0', overflow:'hidden', pointerEvents:'auto', zIndex:'2' });
  stage.appendChild(overlay);
  // Клик по экрану — ре-калибровка базового угла
  let calib = { alpha0:null, beta0:null };
  overlay.addEventListener('click', ()=>{ try{ calib.alpha0=null; calib.beta0=null; }catch(e) {} });

  // Прицел/прогресс
  const reticleSize = diff.reticleRadiusPx * 2;
  const reticle = document.createElement('div');
  Object.assign(reticle.style, {
    position:'absolute', left:'50%', top:'50%',
    width:`${reticleSize}px`, height:`${reticleSize}px`,
    marginLeft:`-${reticleSize/2}px`, marginTop:`-${reticleSize/2}px`,
    borderRadius:'50%', border:'2px solid rgba(255,255,255,.75)`,
    boxShadow:'0 0 0 3px rgba(0,0,0,.25), inset 0 0 30px rgba(0,255,220,.15)`,
    backdropFilter:'blur(1px)'
  });
  const ring = document.createElement('div');
  Object.assign(ring.style, {
    position:'absolute', left:'50%', top:'50%',
    width:`${reticleSize+16}px`, height:`${reticleSize+16}px`,
    marginLeft:`-${(reticleSize+16)/2}px`, marginTop:`-${(reticleSize+16)/2}px`,
    borderRadius:'50%', background:'conic-gradient(#00ffd0 0deg, rgba(255,255,255,.15) 0deg)`,
    boxShadow:'0 0 14px rgba(0,255,220,.35)', pointerEvents:'none'
  });
  overlay.appendChild(ring); overlay.appendChild(reticle);
  const holdLabel = document.createElement('div');
  Object.assign(holdLabel.style, {
    position:'absolute', left:'50%', top:'50%', transform:'translate(-50%,-50%)',
    fontSize:'22px', fontWeight:'800', color:'#eaffff', textShadow:'0 2px 8px rgba(0,0,0,.7)'
  });
  holdLabel.textContent = '';
  overlay.appendChild(holdLabel);

  // Призрак
  const ghost = document.createElement('div');
  Object.assign(ghost.style, {
    position:'absolute', width:'96px', height:'96px',
    left:'50%', top:'50%', marginLeft:'-48px', marginTop:'-48px',
    borderRadius:'26%',
    background:'radial-gradient(60% 60% at 30% 30%, rgba(255,255,255,.95), rgba(255,255,255,.2)), radial-gradient(55% 55% at 70% 70%, rgba(0,200,255,.5), rgba(0,0,0,0))',
    border:'2px solid rgba(255,255,255,.4)',
    boxShadow:'0 12px 30px rgba(0,0,0,.45), inset 0 0 18px rgba(0,200,255,.35)',
    display:'grid', placeItems:'center', transition:'transform .08s linear', zIndex:'3' });
  ghost.textContent = '👻'; ghost.style.fontSize = '64px';
  ghost.style.filter = 'drop-shadow(0 6px 14px rgba(0,0,0,.45))';
  overlay.appendChild(ghost);

  // Стрелки
  const mkArrow = (txt, pos) => {
    const el = document.createElement('div');
    el.textContent = txt;
    Object.assign(el.style, {
      position:'absolute', color:'#fff', fontSize:'28px',
      textShadow:'0 2px 8px rgba(0,0,0,.5)', opacity:'0', transition:'opacity .2s'
    });
    overlay.appendChild(el);
    if (pos==='L') { el.style.left='8px'; el.style.top='50%'; el.style.transform='translateY(-50%)'; }
    if (pos==='R') { el.style.right='8px'; el.style.top='50%'; el.style.transform='translateY(-50%)'; }
    if (pos==='T') { el.style.top='8px'; el.style.left='50%'; el.style.transform='translateX(-50%)'; }
    if (pos==='B') { el.style.bottom='8px'; el.style.left='50%'; el.style.transform='translateX(-50%)'; }
    return el;
  };
  const arrowL = mkArrow('⬅','L'), arrowR = mkArrow('➡','R'),
        arrowT = mkArrow('⬆','T'), arrowB = mkArrow('⬇','B');

  // Разрешение сенсоров
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
    background:'linear-gradient(90deg, #00ffcc, #00bfff, #0077ff)', color:'#00131a'
  });
  const permMsg = document.createElement('span');
  permMsg.textContent = 'Чтобы управлять поворотом, разрешите доступ к гиродатчикам.';
  permWrap.appendChild(permMsg); permWrap.appendChild(permBtn);
  overlay.appendChild(permWrap);

  // Джойстик (если сенсоры недоступны)
  const joystick = document.createElement('div');
  Object.assign(joystick.style, {
    position:'absolute', left:'16px', bottom:'16px',
    width:'96px', height:'96px', borderRadius:'50%',
    background:'rgba(255,255,255,.1)', border:'1px solid rgba(255,255,255,.25)',
    touchAction:'none', display:'none'
  });
  overlay.appendChild(joystick);

  // Закрытие
  const cleanupFns = [];
  const resolveIf = (val)=>{ if(!__resolved){ __resolved=true; try{ __resolve(val); }catch(e) {} } };
  const close = () => {
    try { cleanupFns.forEach(fn => fn && fn()); } catch(e) {}
    modal.classList.add('hidden'); stage.innerHTML='';
    resolveIf(false);
    __arActive = false;
    window.dispatchEvent(new Event('ar:close'));
  };
  closeBtn.onclick = close;

  // Камера
  let stream = null;
  (async () => {
    try {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal:'environment' } }, audio:false });
      } catch(e) {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio:false });
      }
      video.srcObject = stream; await video.play();
      cleanupFns.push(() => { try { stream.getTracks().forEach(t => t.stop()); } catch(e) {} });
    } catch (err) {
      console.error('Camera error', err);
      alert('Не удалось запустить камеру. Проверьте разрешения Telegram на камеру.');
      close(); return;
    }
  })();

  // Хелперы
  const W = () => overlay.clientWidth, H = () => overlay.clientHeight;
  const HW = () => W()/2, HH = () => H()/2;
  const setRingProgress = p => {
    const clamped = Math.max(0, Math.min(1, p));
    const deg = Math.floor(360 * clamped);
    ring.style.background = `conic-gradient(#00ffd0 ${deg}deg, rgba(255,255,255,.15) ${deg}deg)`;
  };
  const updateArrows = (x,y) => {
    const w=W(), h=H(), m=40;
    arrowL.style.opacity = x < -m ? '1':'0';
    arrowR.style.opacity = x > w+m ? '1':'0';
    arrowT.style.opacity = y < -m ? '1':'0';
    arrowB.style.opacity = y > h+m ? '1':'0';
  };

  // Состояние гироскопа/эмуляции
  let useSensors = false;
  let camX=0, camY=0;

  function handleOrientation(e){
    const a=e.alpha, b=e.beta;
    if (a==null || b==null) return;
    if (calib.alpha0==null) calib.alpha0=a;
    if (calib.beta0==null)  calib.beta0=b;
    const dyaw = (((a - calib.alpha0) + 180) % 360 + 360) % 360 - 180;
    const dpitch = b - calib.beta0;
    camX = dyaw * sensorYawToPx;
    camY = -dpitch * sensorPitchToPx;
  }

  async function tryEnableSensors(){
    try{
      if (typeof DeviceOrientationEvent !== 'undefined' &&
          typeof DeviceOrientationEvent.requestPermission === 'function'){
        const resp = await DeviceOrientationEvent.requestPermission();
        if (resp === 'granted'){
          window.addEventListener('deviceorientation', handleOrientation, true);
          cleanupFns.push(()=>window.removeEventListener('deviceorientation', handleOrientation, true));
          useSensors = true; permWrap.style.display='none'; joystick.style.display='none'; return true;
        }
      } else if ('ondeviceorientation' in window){
        window.addEventListener('deviceorientation', handleOrientation, true);
        cleanupFns.push(()=>window.removeEventListener('deviceorientation', handleOrientation, true));
        useSensors = true; permWrap.style.display='none'; joystick.style.display='none'; return true;
      }
    }catch(e){ console.warn('Orientation permission error', e); }
    useSensors = false;
    permMsg.textContent='Сенсоры недоступны. Используйте виртуальный джойстик слева.';
    joystick.style.display='block';
    return false;
  }
  permBtn.onclick = () => { tryEnableSensors(); };
  tryEnableSensors();

  // Джойстик
  let joyActive=false, joyBase={x:0,y:0};
  joystick.addEventListener('pointerdown', e=>{ joyActive=true; joyBase={x:e.clientX,y:e.clientY}; joystick.setPointerCapture(e.pointerId); });
  joystick.addEventListener('pointermove', e=>{
    if(!joyActive) return;
    const dx=e.clientX-joyBase.x, dy=e.clientY-joyBase.y;
    camX = dx*joystickSensitivity; camY = dy*joystickSensitivity;
  });
  const endJoy=()=>{ joyActive=false; camX*=0.5; camY*=0.5; };
  joystick.addEventListener('pointerup', endJoy);
  joystick.addEventListener('pointercancel', endJoy);
  cleanupFns.push(()=>{ joyActive=false; });

  // Параметры сложности
  const Rcatch = diff.reticleRadiusPx;
  const holdTarget = diff.holdMs;
  const baseSpeed = diff.baseSpeed;
  const nearBoost = diff.nearBoost;

  // Динамика
  let gx=(Math.random()*2-1)*HW()*0.7, gy=(Math.random()*2-1)*HH()*0.7;
  let vx=0, vy=0, lastT=performance.now(), holdMs=0, lastNearTs=0, lastFeintTs=0;

  // Флаг между кадрами (исправляет ReferenceError)
  let wasInside = false;

  let rafId=0;
  function tick(){
    const now = performance.now();
    const dt = Math.min(50, now - lastT)/1000; lastT=now;
    const hw=HW(), hh=HH(), cx=hw, cy=hh;

    let screenX = (gx - camX) + cx;
    let screenY = (gy - camY) + cy;

    const dx = screenX - cx, dy = screenY - cy;
    const dist = Math.hypot(dx,dy);
    const dirX = dx===0?0:dx/(dist||1), dirY = dy===0?0:dy/(dist||1);

    let speed = baseSpeed + (dist < Rcatch*1.7 ? nearBoost : 0);
    if (now - lastNearTs < fatigueMs) speed *= 0.35;

    if (now - lastFeintTs > feintEveryMs){
      lastFeintTs = now;
      const perp = Math.random()<0.5 ? [-dirY, dirX] : [dirY, -dirX];
      vx += perp[0]*180; vy += perp[1]*180;
    }

    vx += dirX*speed*dt; vy += dirY*speed*dt;
    const friction=0.92; vx*=friction; vy*=friction;
    gx += vx*dt; gy += vy*dt;

    const limitX=hw*1.1, limitY=hh*1.1;
    if (gx>limitX){ gx=limitX; vx*=-edgeBounce; }
    if (gx<-limitX){ gx=-limitX; vx*=-edgeBounce; }
    if (gy>limitY){ gy=limitY; vy*=-edgeBounce; }
    if (gy<-limitY){ gy=-limitY; vy*=-edgeBounce; }

    screenX = (gx - camX) + cx;
    screenY = (gy - camY) + cy;

    // Recompute distance AFTER physics/limits to match the actual drawn position
    const dx2 = screenX - cx, dy2 = screenY - cy;
    const dist2 = Math.hypot(dx2, dy2);

    const pulse = 1 + Math.sin(now/220)*0.03;
    ghost.style.transform = `translate(${Math.round(screenX-48)}px, ${Math.round(screenY-48)}px) scale(${pulse})`;

    updateArrows(screenX, screenY);

    const nowInside = dist2 <= Rcatch;
    if (nowInside && !wasInside) {
      try{ if (navigator.vibrate) navigator.vibrate(15); }catch(e) {}
    }
    wasInside = nowInside;

    if (nowInside){
      holdMs += dt*1000;
      if (Math.abs(dist2 - Rcatch) < 6) lastNearTs = now;
      if (holdMs >= holdTarget){
        try{
          if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.HapticFeedback) {
            window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
          } else if (navigator.vibrate) {
            navigator.vibrate([60,40,60]);
          }
        }catch(e) {}
        const sound = document.getElementById('energy-sound');
        if (sound){ try{ sound.currentTime=0; sound.play(); } catch(e) {} }
        // здесь можно начислять награду
        resolveIf(true);
        close();
        return;
      }
    } else {
      holdMs = Math.max(0, holdMs - dt*1000*0.55);
    }
    const prog = Math.max(0, Math.min(1, holdMs/holdTarget));
    const deg = Math.floor(360*prog);
    const remain = Math.max(0, holdTarget - holdMs);
    holdLabel.textContent = (remain/1000).toFixed(2) + 's';
    ring.style.background = `conic-gradient(#00ffd0 ${deg}deg, rgba(255,255,255,.15) ${deg}deg)`;

    rafId = requestAnimationFrame(tick);
  }
  rafId = requestAnimationFrame(tick);
  cleanupFns.push(()=>cancelAnimationFrame(rafId));
  const onVis = ()=>{
    try{
      if (document.hidden){ cancelAnimationFrame(rafId); video.pause(); }
      else { video.play().catch(function(){}); rafId = requestAnimationFrame(tick); }
    }catch(e) {}
  };
  document.addEventListener('visibilitychange', onVis);
  cleanupFns.push(()=>document.removeEventListener('visibilitychange', onVis));
  // Возвращаем промис результата
  return __promise;
}
