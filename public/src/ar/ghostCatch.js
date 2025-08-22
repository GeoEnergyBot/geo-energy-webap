import { DIFFICULTY, AR_TUNING } from '../env.js';

/** Простая AR-мини-игра «Поймай призрака»: удерживать призрака внутри круга до заполнения шкалы */
let _busy = false;

export async function openGhostCatch(rarity='common'){
  if (_busy) return { success:false };
  _busy = true;
  try{
    const modal = document.getElementById('ar-modal');
    const stage = document.getElementById('ar-stage');
    const title = document.getElementById('ar-title');
    const close = document.getElementById('ar-close');
    if (!modal || !stage) return { success:false };

    title.textContent = 'Поймайте призрака в круг';
    // Очистим и создадим сцену
    stage.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.style.position = 'relative';
    wrap.style.width = '100%';
    wrap.style.height = '100%';
    stage.appendChild(wrap);

    const canvas = document.createElement('canvas');
    // подгоним размер под контейнер (портрет)
    const rect=stage.getBoundingClientRect(); const W=Math.floor(rect.width||window.innerWidth*0.9||360), H=Math.floor(rect.height||window.innerHeight*0.75||540);
    canvas.width = W; canvas.height = H;
    canvas.style.display = 'block';
    canvas.style.margin = '12px auto';
    canvas.style.borderRadius = '16px';
    canvas.style.background = 'radial-gradient(circle at 50% 40%, rgba(0,255,153,.18), transparent 60%), #0a0e11';
    wrap.appendChild(canvas);

    // Прогресс-бар
    const prog = document.createElement('div');
    const progIn = document.createElement('div');
    prog.style.height = '10px'; prog.style.borderRadius='8px';
    prog.style.background='rgba(255,255,255,.12)';
    progIn.style.height = '10px'; progIn.style.width='0%';
    progIn.style.background='linear-gradient(90deg,#22d3ee,#818cf8,#e879f9)';
    progIn.style.borderRadius='8px';
    prog.appendChild(progIn);
    prog.style.margin = '8px 12px 0 12px';
    wrap.appendChild(prog);

    // Таймер
    const timer = document.createElement('div');
    timer.style.position='absolute'; timer.style.top='8px'; timer.style.right='12px';
    timer.style.padding='4px 8px'; timer.style.borderRadius='8px';
    timer.style.background='rgba(0,0,0,.35)'; timer.style.fontSize='12px';
    timer.textContent = '0:00';
    wrap.appendChild(timer);

    // Подсказка скрыта — автозапуск

    // Открываем модалку
    modal.classList.remove('hidden');
    window.dispatchEvent(new Event('ar:open'));

    const diff = DIFFICULTY[rarity] || DIFFICULTY.common;
    const ctx = canvas.getContext('2d');
    const circleR = diff.reticleRadiusPx || 60;
    let ghost = { x: W/2, y: H/2, vx: 0.9*diff.baseSpeed/60, vy: 0.7*diff.baseSpeed/60 };
    let progress = 0; // 0..1
    let heldMs = 0, combo = 1.0;
    let lastFeint = 0, running=false, raf=0, tPrev=0;

    const cleanup = ()=>{
      cancelAnimationFrame(raf);
      modal.classList.add('hidden');
      window.dispatchEvent(new Event('ar:close'));
      stage.innerHTML='';
      close.onclick=null;
      startBtn.onclick=null;
    };
    const closeHandler = ()=>{ cleanup(); resolveFn({ success:false }); };
    close.onclick = closeHandler;

    function drawTarget(){
      ctx.save();
      ctx.strokeStyle = 'rgba(0,255,200,0.85)';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(W/2, H/2, circleR, 0, Math.PI*2); ctx.stroke();
      ctx.restore();
    }
    function drawGhost(){
      ctx.save();
      ctx.shadowColor='rgba(0,255,200,0.5)'; ctx.shadowBlur=12;
      ctx.fillStyle='rgba(190,230,255,0.95)';
      ctx.beginPath(); ctx.arc(ghost.x, ghost.y, 18, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }

    function tick(ts){
      raf = requestAnimationFrame(tick);
      const dt = Math.min(32, ts - (tPrev||ts)); tPrev = ts;
      lastFeint += dt;
      if (lastFeint > (DIFFICULTY[rarity]?.feintEveryMs ?? 1800)){
        lastFeint = 0; ghost.vx *= -1.15; ghost.vy *= 1.12;
      }
      // движение
      ghost.x += ghost.vx * dt;
      ghost.y += ghost.vy * dt;
      // отскоки
      if (ghost.x < circleR || ghost.x > W-circleR) ghost.vx*=-1;
      if (ghost.y < circleR || ghost.y > H-circleR) ghost.vy*=-1;

      
      const reticleX=W/2, reticleY=H/2;
      const inCircle = Math.hypot(ghost.x-reticleX, ghost.y-reticleY) <= circleR;
      if (inCircle){ heldMs += dt; if (heldMs > (AR_TUNING.comboAfterMs||1500)) combo = Math.min(AR_TUNING.comboMax||1.5, combo + 0.003); }
      else { combo = 1.0; }
      const goalMs = (DIFFICULTY[rarity]?.holdMs || 16000);
      if (inCircle) progress = Math.min(1, heldMs/goalMs);
      else progress = Math.max(0, progress - (dt/1000) * (AR_TUNING.decayOutPerSec||0.15));
      ctx.clearRect(0,0,W,H); drawTarget(); drawGhost();
      progIn.style.width = (progress*100).toFixed(1)+'%';
      const remain = Math.max(0, goalMs - heldMs); timer.textContent = inCircle ? ('Осталось: ' + formatMs(remain)) : 'Наведите призрака в круг';

      if (progress >= 1){
        cleanup();
        resolveFn({ success:true, rewardMult: Math.min(1.2, 1 + (combo-1)/2) });
      }
    }

    let resolveFn;
    const promise = new Promise(res=> resolveFn = res);
    running=true; tPrev=performance.now(); raf=requestAnimationFrame(tick);

    return await promise;
  } finally {
    _busy = false;
  }
}

function formatMs(ms){
  const s = Math.max(0, Math.ceil(ms/1000)); const m=(s/60)|0; const ss=String(s%60).padStart(2,'0'); return `${m}:${ss}`;
}
