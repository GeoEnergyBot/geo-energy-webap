
import { DIFFICULTY, AR_TUNING } from '../env.js';

/** Мини-игра «Поймай призрака»: держи цель в прицеле нужное время */
let _busy = false;

function _difficulty(rarity){
  const d = DIFFICULTY?.[rarity] || {};
  return {
    sensorYawToPx:  d.sensorYawToPx  ?? 6,
    sensorPitchToPx:d.sensorPitchToPx?? 6,
    baseSpeed:      d.baseSpeed      ?? ({common:180, advanced:220, rare:260}[rarity] || 200),
    nearBoost:      d.nearBoost      ?? ({common: 80, advanced:110, rare:140}[rarity] || 90),
    minSpeed:       d.minSpeed       ?? ({common: 40, advanced: 60, rare: 80}[rarity] || 50),
    maxSpeed:       d.maxSpeed       ?? ({common:300, advanced:360, rare:420}[rarity] || 340),
    catchRadius:    d.catchRadius    ?? 70,
    holdMs:         d.holdMs         ?? ({common:1100, advanced:1300, rare:1500}[rarity] || 1200),
  };
}

export async function openGhostCatch(rarity='common'){
  if (_busy) return { success:false };
  _busy = true;
  let cleanup=()=>{};
  try {
    const modal = document.getElementById('ar-modal');
    const stage = document.getElementById('ar-stage');
    const title = document.getElementById('ar-title');
    const close = document.getElementById('ar-close');
    if (!modal || !stage) return { success:false };
    title.textContent = 'Поймайте призрака в круг';
    modal.classList.remove('hidden');
    window.dispatchEvent(new Event('ar:open'));

    // Canvas сцена
    stage.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.style.position='relative'; wrap.style.width='100%'; wrap.style.height='100%';
    stage.appendChild(wrap);

    const canvas = document.createElement('canvas');
    const W = 360, H = 540;
    canvas.width=W; canvas.height=H;
    canvas.style.display='block'; canvas.style.margin='12px auto';
    canvas.style.borderRadius='16px';
    canvas.style.background='radial-gradient(circle at 50% 40%, rgba(0,255,153,.18), transparent 60%), #0a0e11';
    wrap.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    // Прогресс
    const bar = document.createElement('div');
    const barIn = document.createElement('div');
    Object.assign(bar.style, {height:'10px', borderRadius:'8px', background:'rgba(255,255,255,.12)', margin:'8px 12px 0'});
    Object.assign(barIn.style,{height:'10px', width:'0%', borderRadius:'8px', background:'linear-gradient(90deg,#22d3ee,#818cf8,#e879f9)'});
    bar.appendChild(barIn); wrap.appendChild(bar);

    // Подсказка/кнопка разрешения сенсоров
    const perm = document.createElement('div');
    Object.assign(perm.style, {
      position:'absolute', left:'50%', bottom:'16px', transform:'translateX(-50%)',
      display:'flex', gap:'10px', background:'rgba(0,0,0,.35)', color:'#fff',
      padding:'8px 10px', borderRadius:'12px', alignItems:'center', fontSize:'14px'
    });
    const permMsg = document.createElement('span');
    permMsg.textContent = 'Разрешите датчики для управления или используйте джойстик.';
    const permBtn = document.createElement('button');
    permBtn.textContent = 'Включить управление';
    Object.assign(permBtn.style, {border:'none', borderRadius:'999px', padding:'6px 10px',
      fontWeight:'800', background:'linear-gradient(90deg,#00ffcc,#00bfff,#0077ff)', color:'#00131a', cursor:'pointer'});
    perm.appendChild(permMsg); perm.appendChild(permBtn); wrap.appendChild(perm);

    // Управление
    const conf = _difficulty(rarity);
    let camX=0, camY=0, camXS=0, camYS=0;
    let baseAlpha=null, baseBeta=null, sensorsOn=false;
    const shortest = (a)=>(((a+180)%360)+360)%360-180;
    function onOrient(e){
      if (e.alpha==null || e.beta==null) return;
      if (baseAlpha==null) baseAlpha=e.alpha;
      if (baseBeta==null) baseBeta=e.beta;
      const dyaw = shortest(e.alpha-baseAlpha);
      const dpitch = e.beta-baseBeta;
      camX = conf.sensorYawToPx * dyaw;
      camY = -conf.sensorPitchToPx * dpitch;
    }
    async function enableSensorsByGesture(){
      try{
        if (typeof DeviceOrientationEvent!=='undefined' && typeof DeviceOrientationEvent.requestPermission==='function'){
          const r = await DeviceOrientationEvent.requestPermission();
          if (r!=='granted') throw new Error('denied');
        }
        window.addEventListener('deviceorientation', onOrient, true);
        sensorsOn = true; perm.style.display='none';
      }catch(_){
        sensorsOn = false;
        permMsg.textContent = 'Сенсоры недоступны. Используйте джойстик.';
      }
    }
    permBtn.onclick = enableSensorsByGesture;
    // На Android обычно разрешение не нужно — пробуем подключиться сразу
    if (!('DeviceOrientationEvent' in window && typeof DeviceOrientationEvent.requestPermission==='function')){
      window.addEventListener('deviceorientation', onOrient, true);
      sensorsOn = true; perm.style.display='none';
    }

    // Джойстик
    let joy=false, jx=0, jy=0;
    canvas.addEventListener('pointerdown', ev=>{ joy=true; jx=ev.clientX; jy=ev.clientY; try{canvas.setPointerCapture(ev.pointerId);}catch{} });
    const endJoy=()=>{ joy=false; };
    canvas.addEventListener('pointerup', endJoy); canvas.addEventListener('pointercancel', endJoy);
    canvas.addEventListener('pointermove', ev=>{ if(joy){ camX=(ev.clientX-jx)*1.2; camY=(ev.clientY-jy)*1.2; }});

    // Модель призрака
    let gx = (Math.random()*2-1)*(W*0.25);
    let gy = (Math.random()*2-1)*(H*0.25);
    let vx = 0, vy=0;
    let holdMs=0, last=performance.now();
    const Rcatch = conf.catchRadius, holdNeed = conf.holdMs;
    const centerX = W/2, centerY = H/2;

    function draw(aimX, aimY){
      ctx.clearRect(0,0,W,H);

      // фоновые «частицы» по желанию (минимально)
      // прицел
      ctx.beginPath();
      ctx.arc(aimX, aimY, Rcatch, 0, Math.PI*2);
      ctx.strokeStyle='rgba(255,255,255,.7)'; ctx.lineWidth=2; ctx.stroke();

      // призрак
      const scrX = gx + centerX - camXS;
      const scrY = gy + centerY - camYS;
      const grd = ctx.createRadialGradient(scrX-10, scrY-10, 5, scrX, scrY, 40);
      grd.addColorStop(0,'rgba(255,255,255,.95)'); grd.addColorStop(1,'rgba(0,200,255,.25)');
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(scrX, scrY, 26, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle='rgba(255,255,255,.9)'; ctx.font='32px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('👻', scrX, scrY);
    }

    let raf=0;
    function tick(ts){
      const dt = Math.min(50, ts-last)/1000; last=ts;

      // сглаживаем датчики
      camXS = camXS*0.85 + camX*0.15;
      camYS = camYS*0.85 + camY*0.15;
      const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
      const aimX = clamp(centerX + camXS, W*0.15, W*0.85);
      const aimY = clamp(centerY + camYS, H*0.15, H*0.85);

      // экранные координаты призрака
      const scrX = gx + centerX - camXS;
      const scrY = gy + centerY - camYS;
      const dx = scrX - aimX, dy = scrY - aimY;
      const dist = Math.hypot(dx, dy);

      // скорость (убегает от прицела)
      const dirx = dist>0 ? dx/dist : 0;
      const diry = dist>0 ? dy/dist : 0;
      let speed = conf.baseSpeed + (dist < Rcatch*1.6 ? conf.nearBoost : 0);
      speed = Math.max(conf.minSpeed, Math.min(conf.maxSpeed, speed));

      // физика в мировых координатах (gx,gy)
      vx += dirx * speed * dt;
      vy += diry * speed * dt;
      // трение
      vx *= 0.90; vy *= 0.90;
      gx += vx * dt; gy += vy * dt;

      // границы (мировые ≈ экран ± небольшой буфер)
      const limX = (W/2)*0.95, limY = (H/2)*0.95;
      if (gx >  limX){ gx= limX; vx*=-0.8; }
      if (gx < -limX){ gx=-limX; vx*=-0.8; }
      if (gy >  limY){ gy= limY; vy*=-0.8; }
      if (gy < -limY){ gy=-limY; vy*=-0.8; }

      // захват
      if (dist <= Rcatch){
        holdMs += dt*1000;
      } else {
        holdMs = Math.max(0, holdMs - dt*600);
      }
      barIn.style.width = Math.min(100, Math.floor(100*holdMs/holdNeed)) + '%';

      draw(aimX, aimY);

      if (holdMs >= holdNeed){
        cancelAnimationFrame(raf);
        resolve({success:true});
        return;
      }
      raf = requestAnimationFrame(tick);
    }

    // Закрытие/очистка
    let resolve=()=>{};
    const promise = new Promise(res=> resolve=res);
    cleanup = ()=>{
      try{ cancelAnimationFrame(raf); }catch{}
      try{ window.removeEventListener('deviceorientation', onOrient, true);}catch{}
      stage.innerHTML='';
      modal.classList.add('hidden');
      window.dispatchEvent(new Event('ar:close'));
      _busy=false;
    };
    close.onclick = ()=>{ resolve({success:false}); };

    // старт
    raf = requestAnimationFrame(tick);
    const result = await promise;
    cleanup();
    return result;
  } catch(err){
    console.error('AR error:', err);
    cleanup();
    _busy=false;
    return { success:false };
  }
}
