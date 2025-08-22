
import { DIFFICULTY, AR_TUNING } from '../env.js';

/** Мини-игра «Поймай призрака» — удерживай призрака внутри круга до заполнения шкалы */
let _busy = false;

export async function openGhostCatch(rarity='common'){
  if (_busy) return { success:false };
  _busy = true;
  let resolved = false;

  const modal = document.getElementById('ar-modal');
  const stage = document.getElementById('ar-stage');
  const title = document.getElementById('ar-title');
  const close = document.getElementById('ar-close');
  if (!modal || !stage || !title || !close){ _busy=false; return { success:false }; }

  // UI
  title.textContent = 'Поймайте призрака в круг';
  stage.innerHTML = '';
  modal.classList.remove('hidden');
  window.dispatchEvent(new Event('ar:open'));

  // Wrap
  const wrap = document.createElement('div');
  wrap.style.position='relative';
  stage.appendChild(wrap);

  // Canvas
  const W = Math.min(380, Math.floor(window.innerWidth*0.95));
  const H = Math.max(260, Math.floor(W*0.8));
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  Object.assign(canvas.style, {
    width: W+'px', height: H+'px', display:'block', margin:'0 auto',
    borderRadius:'16px',
    background: 'radial-gradient(circle at 50% 40%, rgba(0,255,153,.18), transparent 60%), #0a0e11',
  });
  wrap.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  // HUD
  const hint = document.createElement('div');
  hint.textContent = 'Держите призрака в круге!';
  Object.assign(hint.style, {
    position:'absolute', left:'12px', top:'8px', padding:'2px 8px',
    borderRadius:'10px', fontWeight:'600', opacity:'.9', background:'rgba(0,0,0,.25)'
  });
  wrap.appendChild(hint);

  const timer = document.createElement('div');
  Object.assign(timer.style, {
    position:'absolute', right:'12px', top:'8px', padding:'2px 6px',
    borderRadius:'8px', fontWeight:'700', opacity:'.6', background:'rgba(0,0,0,.25)'
  });
  timer.textContent = '0:00';
  wrap.appendChild(timer);

  const prog = document.createElement('div');
  const progIn = document.createElement('div');
  Object.assign(prog.style, { height:'10px', background:'rgba(255,255,255,.12)', borderRadius:'8px', margin:'8px 12px 0 12px' });
  Object.assign(progIn.style, { height:'10px', width:'0%', borderRadius:'8px', background:'linear-gradient(90deg,#22d3ee,#818cf8,#e879f9)' });
  prog.appendChild(progIn);
  wrap.appendChild(prog);

  // Logic
  const diff = DIFFICULTY[rarity] || DIFFICULTY.common;
  const circleR = diff.reticleRadiusPx || 60;
  let ghost = { x: W/2, y: H/2, vx: (diff.baseSpeed||200)/60, vy: (diff.baseSpeed||200)/90 };
  let progress = 0, heldMs = 0, combo = 1.0;
  let lastFeint = 0, raf = 0, tPrev = 0, running = true;

  function cleanup(){
    cancelAnimationFrame(raf);
    modal.classList.add('hidden');
    window.dispatchEvent(new Event('ar:close'));
    stage.innerHTML='';
    close.onclick=null;
    _busy=false;
  }
  const resolve = (res)=>{ if (resolved) return; resolved = true; cleanup(); _busy=false; try{pResolve(res);}catch(_){}};

  close.onclick = ()=> resolve({ success:false });

  const p = new Promise((res)=>{ window.pResolve = res; });

  function draw(){
    // bg
    ctx.clearRect(0,0,W,H);
    // target
    ctx.save();
    ctx.strokeStyle = 'rgba(0,255,200,.85)';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(W/2, H/2, circleR, 0, Math.PI*2); ctx.stroke();
    ctx.restore();
    // ghost
    ctx.save();
    const grd = ctx.createRadialGradient(ghost.x-4, ghost.y-6, 6, ghost.x, ghost.y, 22);
    grd.addColorStop(0, 'rgba(255,255,255,.95)');
    grd.addColorStop(1, 'rgba(70,200,255,.45)');
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(ghost.x, ghost.y, 18, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }

  function tick(ts){
    if (!running) return;
    raf = requestAnimationFrame(tick);
    const dt = Math.min(32, ts - (tPrev||ts)); tPrev = ts;
    lastFeint += dt;
    if (lastFeint > (diff.feintEveryMs ?? AR_TUNING.feintEveryMs ?? 2000)){
      lastFeint = 0; ghost.vx *= -1.12; ghost.vy *= 1.08;
    }
    // move + bounce
    ghost.x += ghost.vx*dt; ghost.y += ghost.vy*dt;
    if (ghost.x < 18 || ghost.x > W-18) ghost.vx *= -1;
    if (ghost.y < 18 || ghost.y > H-18) ghost.vy *= -1;

    // aim = center + шум (для MVP без датчиков)
    const aimX = W/2 + (Math.random()-0.5) * (AR_TUNING.sensorYawToPx ?? 6);
    const aimY = H/2 + (Math.random()-0.5) * (AR_TUNING.sensorPitchToPx ?? 6);
    const inCircle = Math.hypot(ghost.x-aimX, ghost.y-aimY) <= circleR;

    if (inCircle){
      timer.style.opacity = '1';
      heldMs += dt;
      if (heldMs > (AR_TUNING.comboAfterMs ?? 1500)){
        combo = Math.min(AR_TUNING.comboMax ?? 1.5, combo + 0.005);
      }
      progress += (dt / (diff.holdMs || 18000)) * 6 * combo;
    } else {
      timer.style.opacity = '.6';
      heldMs = 0; combo = 1.0;
      progress -= (dt/1000) * (AR_TUNING.decayOutPerSec ?? 0.15);
    }
    progress = Math.max(0, Math.min(1, progress));
    progIn.style.width = (progress*100).toFixed(1) + '%';
    timer.textContent = formatMs(Math.max(0, Math.round((1-progress) * (diff.holdMs || 18000))));

    draw();

    if (progress >= 1){
      running = false;
      resolve({ success:true });
    }
  }

  // run
  tPrev = performance.now();
  raf = requestAnimationFrame(tick);

  return await p;
}

function formatMs(ms){
  const s = Math.max(0, Math.ceil(ms/1000));
  const m = (s/60)|0;
  const ss = String(s%60).padStart(2,'0');
  return `${m}:${ss}`;
}
