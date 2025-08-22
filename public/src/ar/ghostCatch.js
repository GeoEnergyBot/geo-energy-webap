import { DIFFICULTY, AR_TUNING } from '../env.js';

function el(id){ return document.getElementById(id); }

function ensureModal(){
  const modal = el('ar-modal');
  const stage = el('ar-stage');
  const btn   = el('catch-btn');
  const hint  = el('catch-hint');
  const close = el('ar-close');
  if (!modal || !stage || !btn || !close) throw new Error('AR modal elements missing');
  modal.classList.remove('hidden');
  window.dispatchEvent(new Event('ar:open'));
  close.onclick = () => { modal.classList.add('hidden'); window.dispatchEvent(new Event('ar:close')); };
  stage.innerHTML='';
  btn.style.opacity=.6; btn.disabled=true;
  hint.textContent='Держите цель в прицеле';
  return {modal, stage, btn, hint, close};
}

export async function openGhostCatch(rarity='common'){
  const { modal, stage, btn, hint } = ensureModal();

  // video (best-effort)
  const video = document.createElement('video'); video.autoplay=true; video.playsInline=true; video.muted=true;
  Object.assign(video.style, { position:'absolute', inset:'0', width:'100%', height:'100%', objectFit:'cover', transform:'scaleX(-1)' });
  stage.appendChild(video);
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:{ ideal:'environment' } }, audio:false });
    video.srcObject=stream;
  } catch {}

  // overlay
  const overlay = document.createElement('div');
  Object.assign(overlay.style,{ position:'absolute', inset:'0', overflow:'hidden' });
  stage.appendChild(overlay);

  // reticle
  const R = (DIFFICULTY[rarity]?.reticleRadiusPx ?? 56);
  const ret = document.createElement('div');
  Object.assign(ret.style,{ position:'absolute', left:'50%', top:'50%', width:`${R*2}px`, height:`${R*2}px`, marginLeft:`-${R}px`, marginTop:`-${R}px`, borderRadius:'50%', border:'2px solid rgba(255,255,255,.75)', boxShadow:'0 0 0 3px rgba(0,0,0,.25), inset 0 0 30px rgba(0,255,220,.15)' });
  overlay.appendChild(ret);

  // progress ring
  const ring = document.createElement('div');
  Object.assign(ring.style,{ position:'absolute', left:'50%', top:'50%', width:`${R*2+18}px`, height:`${R*2+18}px`, marginLeft:`-${R+9}px`, marginTop:`-${R+9}px`, borderRadius:'50%', background:'conic-gradient(#00ffd0 0deg, rgba(255,255,255,.15) 0deg)' });
  overlay.appendChild(ring);
  const setProg = p => { const deg = Math.floor(360*Math.max(0,Math.min(1,p))); ring.style.background = `conic-gradient(#00ffd0 ${deg}deg, rgba(255,255,255,.15) ${deg}deg)`; };

  // ghost
  const g = document.createElement('div');
  Object.assign(g.style,{ position:'absolute', width:'96px', height:'96px', left:'50%', top:'50%', marginLeft:'-48px', marginTop:'-48px', borderRadius:'24%', background:'radial-gradient(60% 60% at 30% 30%, rgba(255,255,255,.95), rgba(255,255,255,.2)), radial-gradient(55% 55% at 70% 70%, rgba(0,200,255,.5), rgba(0,0,0,0))', border:'2px solid rgba(255,255,255,.4)', display:'grid', placeItems:'center', filter:'drop-shadow(0 8px 16px rgba(0,0,0,.45))' });
  g.textContent='👻'; g.style.fontSize='64px';
  overlay.appendChild(g);

  // arrows
  const arr = ['⬅','➡','⬆','⬇'].map(txt=>{ const d = document.createElement('div'); d.textContent=txt; Object.assign(d.style,{ position:'absolute', color:'#fff', fontSize:'28px', textShadow:'0 2px 8px rgba(0,0,0,.5)', opacity:'0', transition:'opacity .2s' }); overlay.appendChild(d); return d; });
  arr[0].style.left='8px'; arr[0].style.top='50%'; arr[0].style.transform='translateY(-50%)';
  arr[1].style.right='8px'; arr[1].style.top='50%'; arr[1].style.transform='translateY(-50%)';
  arr[2].style.top='8px'; arr[2].style.left='50%'; arr[2].style.transform='translateX(-50%)';
  arr[3].style.bottom='8px'; arr[3].style.left='50%'; arr[3].style.transform='translateX(-50%)';

  // sensor
  let camX=0, camY=0; let a0=null, b0=null;
  const yaw2px = AR_TUNING.sensorYawToPx ?? 6;
  const pitch2px = AR_TUNING.sensorPitchToPx ?? 6;
  function ori(e){
    const a=e.alpha, b=e.beta;
    if (a==null || b==null) return;
    if (a0==null) a0=a; if (b0==null) b0=b;
    const dyaw = (((a-a0+180)%360)+360)%360 - 180;
    const dpitch = b-b0;
    camX = dyaw*yaw2px; camY = -dpitch*pitch2px;
  }
  let useSensors=false;
  async function enableSensors(){
    try{
      if (typeof DeviceOrientationEvent!=='undefined' && typeof DeviceOrientationEvent.requestPermission==='function'){
        const r = await DeviceOrientationEvent.requestPermission();
        if (r==='granted'){ window.addEventListener('deviceorientation', ori, true); useSensors=true; }
      } else if ('ondeviceorientation' in window){
        window.addEventListener('deviceorientation', ori, true); useSensors=true;
      }
    }catch{}
  }
  await enableSensors();

  // joystick fallback
  const joy = document.createElement('div');
  Object.assign(joy.style,{ position:'absolute', left:'16px', bottom:'16px', width:'96px', height:'96px', borderRadius:'50%', background:'rgba(255,255,255,.1)', border:'1px solid rgba(255,255,255,.25)', touchAction:'none', display: useSensors?'none':'block' });
  overlay.appendChild(joy);
  let jActive=false, jBase={x:0,y:0};
  joy.addEventListener('pointerdown',e=>{ jActive=true; jBase={x:e.clientX,y:e.clientY}; joy.setPointerCapture(e.pointerId); });
  const joyMove = e=>{ if(!jActive) return; camX=(e.clientX-jBase.x)*1.6; camY=(e.clientY-jBase.y)*1.6; };
  joy.addEventListener('pointermove',joyMove);
  const joyEnd=()=>{ jActive=false; camX*=.5; camY*=.5; };
  joy.addEventListener('pointerup',joyEnd); joy.addEventListener('pointercancel',joyEnd);

  // game loop
  const W=()=>overlay.clientWidth, H=()=>overlay.clientHeight, HW=()=>W()/2, HH=()=>H()/2;
  let gx=(Math.random()*2-1)*HW()*0.6, gy=(Math.random()*2-1)*HH()*0.6;
  let vx=0, vy=0; let last=performance.now(); let hold=0; const need=DIFFICULTY[rarity]?.holdMs ?? 1800;
  const base = DIFFICULTY[rarity]?.baseSpeed ?? 200;
  const feintEvery = AR_TUNING.feintEveryMs ?? 2200;
  let lastFeint=0;

  function arrows(x,y){
    const w=W(), h=H();
    arr[0].style.opacity = x < -40 ? '1':'0';
    arr[1].style.opacity = x > w+40 ? '1':'0';
    arr[2].style.opacity = y < -40 ? '1':'0';
    arr[3].style.opacity = y > h+40 ? '1':'0';
  }

  const done = (ok)=>{ el('ar-modal').classList.add('hidden'); window.dispatchEvent(new Event('ar:close')); resolve({success:ok}); };
  let resolve; const result = new Promise(res=>resolve=res);

  function tick(){
    const now=performance.now(); const dt=Math.min(50, now-last)/1000; last=now;
    const cx=HW(), cy=HH();

    let sx = (gx - camX) + cx;
    let sy = (gy - camY) + cy;
    const dx = sx - cx, dy = sy - cy;
    const dist = Math.hypot(dx,dy);
    const dirX = dx/(dist||1), dirY = dy/(dist||1);

    let speed = base + (dist < R*1.7 ? 100 : 0);
    vx += dirX*speed*dt; vy += dirY*speed*dt;
    vx *= 0.92; vy *= 0.92;
    gx += vx*dt; gy += vy*dt;

    const limX = cx*1.1, limY = cy*1.1;
    if (gx>limX){ gx=limX; vx*=-0.8; }
    if (gx<-limX){ gx=-limX; vx*=-0.8; }
    if (gy>limY){ gy=limY; vy*=-0.8; }
    if (gy<-limY){ gy=-limY; vy*=-0.8; }

    sx = (gx - camX) + cx; sy = (gy - camY) + cy;
    g.style.transform = `translate(${Math.round(sx-48)}px, ${Math.round(sy-48)}px)`;

    arrows(sx,sy);

    if (dist <= R){
      hold += dt*1000;
      if (hold>=need){
        btn.style.opacity=1; btn.disabled=false; hint.textContent='Нажмите, чтобы забрать энергию';
        return; // замораживаем цикл, ждём кнопку
      }
    } else {
      hold = Math.max(0, hold - dt*1000*0.5);
    }
    setProg(hold/need);

    if (now-lastFeint>feintEvery){
      lastFeint=now;
      const perp = Math.random()<0.5 ? [-dirY, dirX] : [dirY, -dirX];
      vx += perp[0]*150; vy += perp[1]*150;
    }

    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  btn.onclick = ()=>{ try{ navigator.vibrate && navigator.vibrate([60,40,60]); }catch{} resolve({success:true}); el('ar-modal').classList.add('hidden'); window.dispatchEvent(new Event('ar:close')); };

  return result;
}