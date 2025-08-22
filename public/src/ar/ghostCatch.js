/* UMD-style AR mini-game: no imports, safe to include or import.
   Exposes:
     - window.openGhostCatch
     - window.openGyroChase (alias)
     - CommonJS: module.exports = { openGhostCatch, openGyroChase }
*/

const DEFAULT_DIFF = {
  common:   { sensorYawToPx: 6, sensorPitchToPx: 6, baseSpeed: 180, nearBoost: 80,  minSpeed: 40, maxSpeed: 300, catchRadius: 70, holdMs: 1100 },
  advanced: { sensorYawToPx: 7, sensorPitchToPx: 7, baseSpeed: 220, nearBoost: 110, minSpeed: 60, maxSpeed: 360, catchRadius: 66, holdMs: 1300 },
  rare:     { sensorYawToPx: 8, sensorPitchToPx: 8, baseSpeed: 260, nearBoost: 140, minSpeed: 80, maxSpeed: 420, catchRadius: 62, holdMs: 1500 },
};

function getGlobalDiff(){
  const w = typeof window !== 'undefined' ? window : {};
  // allow override via globals
  return w.GEO_AR_DIFFICULTY || w.DIFFICULTY || DEFAULT_DIFF;
}

function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }
function shortestDeg(a){ return (((a + 180) % 360) + 360) % 360 - 180; }
function lerp(a,b,t){ return a + (b-a)*t; }

function resolvedDifficulty(rarity='common', opts={}){
  const glob = getGlobalDiff();
  const d = (glob && glob[rarity]) || DEFAULT_DIFF.common;

  let baseSpeed = d.baseSpeed;
  if (Number.isFinite(opts.playerLevel)){
    const lv = Math.max(1, Math.floor(opts.playerLevel));
    const inc = Math.min(0.20, Math.floor((lv-1)/10) * 0.04); // +4% каждые 10 уровней, до +20%
    baseSpeed = Math.round(baseSpeed * (1 + inc));
  }
  if (opts.easyMode){
    return {
      sensorYawToPx:  d.sensorYawToPx,
      sensorPitchToPx:d.sensorPitchToPx,
      baseSpeed:      Math.round(baseSpeed * 0.85),
      nearBoost:      Math.round(d.nearBoost * 0.85),
      minSpeed:       d.minSpeed,
      maxSpeed:       Math.round(d.maxSpeed * 0.85),
      catchRadius:    d.catchRadius + 5,
      holdMs:         Math.round(d.holdMs * 0.8),
    };
  }
  return { ...d, baseSpeed };
}

function drawGhost(ctx, x, y){
  const grd = ctx.createRadialGradient(x-10, y-10, 5, x, y, 40);
  grd.addColorStop(0,'rgba(255,255,255,.95)');
  grd.addColorStop(1,'rgba(0,200,255,.25)');
  ctx.fillStyle = grd;
  ctx.beginPath(); ctx.arc(x, y, 26, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.92)';
  ctx.font='32px system-ui';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('👻', x, y);
}

let _busy = false;
async function openGhostCatch(rarity='common', opts={}){
  if (_busy) return { success:false };
  _busy = true;

  let cleanup = ()=>{};
  const tStart = performance.now();

  try{
    const modal = document.getElementById('ar-modal');
    const stage = document.getElementById('ar-stage');
    const title = document.getElementById('ar-title');
    const close = document.getElementById('ar-close');
    if (!modal || !stage) { _busy=false; return { success:false }; }

    title && (title.textContent = 'Поймайте призрака в круг');
    modal.classList.remove('hidden');
    window.dispatchEvent(new Event('ar:open'));

    // Scene
    stage.innerHTML = '';
    const wrap = document.createElement('div');
    Object.assign(wrap.style, { position:'relative', width:'100%', height:'100%' });
    stage.appendChild(wrap);

    const canvas = document.createElement('canvas');
    const rect = stage.getBoundingClientRect();
    const H = Math.floor(Math.max(420, Math.min(680, rect.height || 540)));
    const W = Math.floor(Math.max(300, Math.min(480, Math.round(H*0.666))));
    canvas.width = W; canvas.height = H;
    Object.assign(canvas.style, { display:'block', margin:'12px auto', borderRadius:'16px',
      background:'radial-gradient(circle at 50% 40%, rgba(0,255,153,.18), transparent 60%), #0a0e11' });
    wrap.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    // Progress bar
    const bar = document.createElement('div');
    const barIn = document.createElement('div');
    Object.assign(bar.style, { height:'10px', borderRadius:'8px', background:'rgba(255,255,255,.12)', margin:'8px 12px 0' });
    Object.assign(barIn.style,{ height:'10px', width:'0%', borderRadius:'8px', background:'linear-gradient(90deg,#22d3ee,#818cf8,#e879f9)' });
    bar.appendChild(barIn); wrap.appendChild(bar);

    // Permission UI (iOS/Android)
    const conf = resolvedDifficulty(rarity, opts);
    const perm = document.createElement('div');
    Object.assign(perm.style, {
      position:'absolute', left:'50%', bottom:'16px', transform:'translateX(-50%)',
      display:'flex', gap:'10px', background:'rgba(0,0,0,.35)', color:'#fff',
      padding:'8px 10px', borderRadius:'12px', alignItems:'center', fontSize:'14px', zIndex:'10'
    });
    const permMsg = document.createElement('span');
    permMsg.textContent = 'Разрешите датчики для управления или используйте джойстик.';
    const permBtn = document.createElement('button');
    permBtn.textContent = 'Включить управление';
    Object.assign(permBtn.style, { border:'none', borderRadius:'999px', padding:'6px 10px',
      fontWeight:'800', background:'linear-gradient(90deg,#00ffcc,#00bfff,#0077ff)', color:'#00131a', cursor:'pointer' });
    perm.appendChild(permMsg); perm.appendChild(permBtn); wrap.appendChild(perm);

    // Controls
    let camX=0, camY=0, camXS=0, camYS=0;
    let baseAlpha=null, baseBeta=null, sensorsOn=false;

    function onOrient(e){
      if (e.alpha==null || e.beta==null) return;
      if (baseAlpha==null) baseAlpha=e.alpha;
      if (baseBeta==null) baseBeta=e.beta;
      const dyaw = shortestDeg(e.alpha - baseAlpha);
      const dpitch = e.beta - baseBeta;
      camX = (conf.sensorYawToPx ?? 6) * dyaw;
      camY = -(conf.sensorPitchToPx ?? 6) * dpitch;
    }

    async function enableSensorsByGesture(){
      try{
        if (typeof DeviceOrientationEvent!=='undefined' && typeof DeviceOrientationEvent.requestPermission==='function'){
          const r = await DeviceOrientationEvent.requestPermission();
          if (r!=='granted') throw new Error('denied');
        }
        window.addEventListener('deviceorientation', onOrient, true);
        sensorsOn = true; perm.style.display='none';
        window.dispatchEvent(new Event('ar:perm_granted'));
      }catch(_){
        sensorsOn = false;
        permMsg.textContent = 'Сенсоры недоступны. Используйте джойстик.';
        window.dispatchEvent(new Event('ar:perm_denied'));
      }
    }
    permBtn.onclick = enableSensorsByGesture;
    if (!('DeviceOrientationEvent' in window && typeof DeviceOrientationEvent.requestPermission==='function')){
      try { window.addEventListener('deviceorientation', onOrient, true); sensorsOn=true; perm.style.display='none'; } catch {}
    }

    // Joystick fallback
    let joy=false, jx=0, jy=0;
    canvas.addEventListener('pointerdown', ev=>{ joy=true; jx=ev.clientX; jy=ev.clientY; try{ canvas.setPointerCapture(ev.pointerId); }catch{} });
    const endJoy = ()=>{ joy=false; };
    canvas.addEventListener('pointerup', endJoy); canvas.addEventListener('pointercancel', endJoy);
    canvas.addEventListener('pointermove', ev=>{ if(joy){ camX = (ev.clientX-jx)*1.2; camY = (ev.clientY-jy)*1.2; }});
    if (!sensorsOn) window.dispatchEvent(new Event('ar:joystick_fallback'));

    // World / ghost
    let gx = (Math.random()*2-1)*(W*0.25);
    let gy = (Math.random()*2-1)*(H*0.25);
    let vx = 0, vy=0;
    let holdMs=0, last=performance.now();
    const centerX = W/2, centerY = H/2;
    const Rcatch = conf.catchRadius, holdNeed = conf.holdMs;

    // Telemetry
    let samples=0, insideSamples=0;

    function render(aimX, aimY){
      ctx.clearRect(0,0,W,H);
      ctx.beginPath();
      ctx.arc(aimX, aimY, Rcatch, 0, Math.PI*2);
      ctx.strokeStyle='rgba(255,255,255,.7)'; ctx.lineWidth=2; ctx.stroke();

      const scrX = gx + centerX - camXS;
      const scrY = gy + centerY - camYS;
      drawGhost(ctx, scrX, scrY);
    }

    function tick(ts){
      const dt = Math.min(50, ts-last)/1000; last=ts;
      camXS = lerp(camXS, camX, 0.15);
      camYS = lerp(camYS, camY, 0.15);

      const aimX = clamp(centerX + camXS, W*0.15, W*0.85);
      const aimY = clamp(centerY + camYS, H*0.15, H*0.85);

      const scrX = gx + centerX - camXS;
      const scrY = gy + centerY - camYS;
      const dx = scrX - aimX, dy = scrY - aimY;
      const dist = Math.hypot(dx, dy);
      const dirx = dist>0 ? dx/dist : 0;
      const diry = dist>0 ? dy/dist : 0;

      let speed = conf.baseSpeed + (dist < Rcatch*1.6 ? conf.nearBoost : 0);
      speed = clamp(speed, conf.minSpeed, conf.maxSpeed);

      vx += dirx * speed * dt;
      vy += diry * speed * dt;
      vx *= 0.90; vy *= 0.90;
      gx += vx * dt; gy += vy * dt;

      const limX = (W/2)*0.95, limY = (H/2)*0.95;
      if (gx >  limX){ gx= limX; vx*=-0.8; }
      if (gx < -limX){ gx=-limX; vx*=-0.8; }
      if (gy >  limY){ gy= limY; vy*=-0.8; }
      if (gy < -limY){ gy=-limY; vy*=-0.8; }

      samples++;
      if (dist <= Rcatch){ insideSamples++; holdMs += dt*1000; }
      else { holdMs = Math.max(0, holdMs - dt*600); }
      barIn.style.width = Math.min(100, Math.floor(100*holdMs/holdNeed)) + '%';

      render(aimX, aimY);

      if (holdMs >= holdNeed){
        cancelAnimationFrame(raf);
        absorbAnimation().then(()=>{
          const durationMs = Math.round(performance.now() - tStart);
          const inCirclePercent = samples>0 ? Math.round(100*insideSamples/samples) : 0;
          const result = { success:true, durationMs, inCirclePercent, samples };
          window.dispatchEvent(new CustomEvent('ar:success', { detail: { rarity, ...result } }));
          resolve(result);
        });
        return;
      }
      raf = requestAnimationFrame(tick);
    }

    async function absorbAnimation(){
      try { navigator.vibrate && navigator.vibrate([40,40,40]); } catch {}
      const aCtx = canvas.getContext('2d');
      const start = performance.now(); const dur = 500;
      while (true){
        const t = performance.now(); const p = clamp((t-start)/dur, 0, 1);
        aCtx.clearRect(0,0,W,H);
        aCtx.fillStyle = 'rgba(0,0,0,' + (0.1 + 0.2*p) + ')';
        aCtx.fillRect(0,0,W,H);
        const r = lerp(26, 8, p);
        const x = centerX, y = centerY;
        const grd = aCtx.createRadialGradient(x-6,y-6,3, x,y, r*2);
        grd.addColorStop(0,'rgba(255,255,255,0.95)'); grd.addColorStop(1,'rgba(0,200,255,' + (0.25*(1-p)) + ')');
        aCtx.fillStyle = grd;
        aCtx.beginPath(); aCtx.arc(x, y, r, 0, Math.PI*2); aCtx.fill();
        if (p>=1) break;
        await new Promise(r=>requestAnimationFrame(r));
      }
      try { navigator.vibrate && navigator.vibrate(60); } catch {}
      await new Promise(r=>setTimeout(r, 150));
    }

    let resolve = ()=>{};
    const promise = new Promise(res=> resolve=res);

    let raf = requestAnimationFrame(tick);

    function cleanup(){
      try{ cancelAnimationFrame(raf); }catch{}
      try{ window.removeEventListener('deviceorientation', onOrient, true); }catch{}
      try{ stage && (stage.innerHTML=''); }catch{}
      try{ modal.classList.add('hidden'); }catch{}
      window.dispatchEvent(new Event('ar:close'));
      _busy=false;
    }

    const onClose = ()=>{
      const result = { success:false };
      window.dispatchEvent(new CustomEvent('ar:fail', { detail: { rarity, reason:'closed' } }));
      resolve(result);
    };
    if (close) close.onclick = onClose;

    const result = await promise;
    cleanup();
    return result;

  } catch (err){
    console.error('AR error:', err);
    _busy=false;
    return { success:false };
  }
}

function openGyroChase(rarity='common', opts={}){ return openGhostCatch(rarity, opts); }

// expose to window
if (typeof window !== 'undefined'){
  window.openGhostCatch = openGhostCatch;
  window.openGyroChase = openGyroChase;
}

// CommonJS (optional)
if (typeof module !== 'undefined' && module.exports){
  module.exports = { openGhostCatch, openGyroChase };
}
