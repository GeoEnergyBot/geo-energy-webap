(function(root,factory){
  if (typeof define==='function' && define.amd){ define([], factory); }
  else if (typeof module==='object' && module.exports){ module.exports = factory(); }
  else { root.openGhostCatch = factory(); }
}(typeof self!=='undefined'?self:this, function(){
  let _busy = false;

  // Default tuning; can be overridden via window.AR_TUNING / window.DIFFICULTY
  const DIFFICULTY = (typeof window!=='undefined' && window.DIFFICULTY) ? window.DIFFICULTY : 'normal';
  const preset = {
    easy:   { holdMs: 1200, baseSpeed: 180, nearBoost: 60,  feintEveryMs: 3400, reticle: 160 },
    normal: { holdMs: 1500, baseSpeed: 220, nearBoost: 110, feintEveryMs: 3000, reticle: 140 },
    hard:   { holdMs: 1800, baseSpeed: 260, nearBoost: 145, feintEveryMs: 2600, reticle: 120 }
  }[DIFFICULTY] || { holdMs: 1500, baseSpeed: 220, nearBoost: 110, feintEveryMs: 3000, reticle: 140 };

  function speedFor(rarity){
    switch(String(rarity||'normal')){
      case 'rare': return 1.35;
      case 'advanced': return 1.15;
      default: return 1.0;
    }
  }

  // Public API
  async function openGhostCatch(rarity){
    if (_busy) return { success:false };
    _busy = true;
    const modal = document.getElementById('ar-modal');
    const closeBtn = document.getElementById('ar-close');
    const stage = document.getElementById('ar-stage');
    const title = document.getElementById('ar-title');
    /* TELEGRAM SIZE FIX */
    modal.style.width='100vw'; modal.style.height='100vh';
    stage.style.width='100%'; stage.style.height='100%';
    if (!modal || !stage){ _busy = false; return { success:false, error:'no-stage' }; }

    // Reset DOM
    stage.innerHTML = '';
    modal.classList.remove('hidden');
    title && (title.textContent = 'Поймайте призрака в круг');

    // Backdrop close
    const cleanupFns = [];
    const close = () => {
      try{ cleanupFns.forEach(fn => fn && fn()); }catch(_){}
      modal.classList.add('hidden');
      stage.innerHTML='';
      _busy = false;
    };
    if (closeBtn) closeBtn.onclick = close;

    // Camera background (optional)
    let stream=null;
    try{
      const video=document.createElement('video');
      video.setAttribute('playsinline',''); video.muted=true; video.autoplay=true;
      Object.assign(video.style,{position:'absolute',inset:'0',width:'100%',height:'100%',objectFit:'cover',transform:'scaleX(-1)'});
      stage.appendChild(video);
      try{
        stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}}, audio:false});
      }catch(_){
        stream = await navigator.mediaDevices.getUserMedia({video:true, audio:false});
      }
      video.srcObject = stream; await video.play();
      cleanupFns.push(()=>{ try{stream.getTracks().forEach(t=>t.stop());}catch(_){}});
    }catch(_){ /* camera optional */ }

    // Overlay canvas
    const overlay = document.createElement('div');
    Object.assign(overlay.style,{position:'absolute',inset:'0',pointerEvents:'auto'});
    stage.appendChild(overlay);

    const W = ()=>overlay.clientWidth || 360;
    const H = ()=>overlay.clientHeight || 560;

    // Reticle + ring
    const Rcatch = preset.reticle/2;
    const reticle = document.createElement('div');
    Object.assign(reticle.style,{
      position:'absolute',left:'50%',top:'50%',width:`${preset.reticle}px`,height:`${preset.reticle}px`,
      marginLeft:`-${preset.reticle/2}px`,marginTop:`-${preset.reticle/2}px`,borderRadius:'50%',
      border:'2px solid rgba(255,255,255,.8)', boxShadow:'0 0 0 3px rgba(0,0,0,.25), inset 0 0 30px rgba(0,255,220,.2)'
    });
    overlay.appendChild(reticle);

    const ring = document.createElement('div');
    Object.assign(ring.style,{
      position:'absolute',left:'50%',top:'50%',width:`${preset.reticle+16}px`,height:`${preset.reticle+16}px`,
      marginLeft:`-${(preset.reticle+16)/2}px`,marginTop:`-${(preset.reticle+16)/2}px`,borderRadius:'50%',
      background:'conic-gradient(#00ffd0 0deg, rgba(255,255,255,.2) 0deg)'
    });
    overlay.appendChild(ring);
    function setProgress(p){
      const clamped = Math.max(0, Math.min(1, p));
      const deg = Math.floor(clamped*360);
      ring.style.background = `conic-gradient(#00ffd0 ${deg}deg, rgba(255,255,255,.2) ${deg}deg)`;
    }

    // Ghost
    const ghost = document.createElement('div');
    Object.assign(ghost.style,{
      position:'absolute', width:'96px', height:'96px', left:'50%', top:'50%',
      marginLeft:'-48px', marginTop:'-48px', borderRadius:'26%',
      background:'radial-gradient(60% 60% at 30% 30%, rgba(255,255,255,.95), rgba(255,255,255,.2)), radial-gradient(55% 55% at 70% 70%, rgba(0,200,255,.5), rgba(0,0,0,0))',
      border:'2px solid rgba(255,255,255,.4)', display:'grid', placeItems:'center',
      boxShadow:'0 12px 30px rgba(0,0,0,.45), inset 0 0 18px rgba(0,200,255,.35)', transition:'transform .08s linear', fontSize:'64px'
    });
    ghost.textContent = '👻';
    overlay.appendChild(ghost);

    // Motion control
    let camX=0, camY=0;
    let useSensors=false;
    function handleOrientation(e){
      const alpha=e.alpha, beta=e.beta;
      if (alpha==null || beta==null) return;
      if (base.alpha0==null) base.alpha0 = alpha;
      if (base.beta0==null)  base.beta0 = beta;
      const dyaw  = ((alpha-base.alpha0+540)%360)-180;
      const dpitch = beta-base.beta0;
      camX = dyaw  * base.sensorToPxYaw;
      camY = -dpitch* base.sensorToPxPitch;
    }
    const base = { alpha0:null, beta0:null, sensorToPxYaw:6, sensorToPxPitch:6 };
    try{
      if (typeof DeviceOrientationEvent!=='undefined' && typeof DeviceOrientationEvent.requestPermission==='function'){
        const btn=document.createElement('button');
        btn.textContent='Включить управление'; btn.style.position='absolute'; btn.style.left='50%'; btn.style.bottom='16px'; btn.style.transform='translateX(-50%)';
        btn.style.background='linear-gradient(90deg,#00ffcc,#00bfff,#0077ff)'; btn.style.color='#00131a'; btn.style.border='0'; btn.style.borderRadius='999px'; btn.style.padding='10px 14px'; btn.style.fontWeight='800';
        overlay.appendChild(btn);
        btn.onclick = async()=>{
          try{
            const r=await DeviceOrientationEvent.requestPermission();
            if (r==='granted'){
              window.addEventListener('deviceorientation', handleOrientation, true);
              useSensors=true; btn.remove();
            }
          }catch(_){}
        };
        cleanupFns.push(()=>{ try{btn.remove();}catch(_){}});
      }else if ('ondeviceorientation' in window){
        window.addEventListener('deviceorientation', handleOrientation, true);
        useSensors=true;
      }
      cleanupFns.push(()=>window.removeEventListener('deviceorientation', handleOrientation, true));
    }catch(_){}

    // Game loop
    const speedScale = speedFor(rarity);
    let gx=(Math.random()*2-1)*(W()/2*0.6), gy=(Math.random()*2-1)*(H()/2*0.6);
    let vx=0, vy=0; let lastT=performance.now(); let holdMs=0; let lastFeintTs=0;
    const fatigueMs = 700, edgeBounce=0.8;

    function tick(){
      const now=performance.now();
      const dt=Math.min(50, now-lastT)/1000; lastT=now;
      const hw=W()/2, hh=H()/2;
      let screenX=(gx-camX)+hw, screenY=(gy-camY)+hh;

      const dx=screenX-hw, dy=screenY-hh; const dist=Math.hypot(dx,dy);
      const dirX = dx===0?0:dx/(dist||1), dirY=dy===0?0:dy/(dist||1);
      let speed = (preset.baseSpeed*speedScale) + (dist < Rcatch*1.7 ? preset.nearBoost : 0);
      if (now-lastFeintTs>preset.feintEveryMs){ lastFeintTs=now; const perp = Math.random()<.5?[-dirY, dirX]:[dirY,-dirX]; vx+=perp[0]*180; vy+=perp[1]*180; }
      // Flee logic (away from center)
      vx += dirX*speed*dt; vy += dirY*speed*dt;
      vx *= 0.92; vy *= 0.92; // friction
      gx += vx*dt; gy += vy*dt;

      const limitX = hw*1.1, limitY = hh*1.1;
      if (gx>limitX){ gx=limitX; vx*=-edgeBounce; }
      if (gx<-limitX){ gx=-limitX; vx*=-edgeBounce; }
      if (gy>limitY){ gy=limitY; vy*=-edgeBounce; }
      if (gy<-limitY){ gy=-limitY; vy*=-edgeBounce; }

      screenX=(gx-camX)+hw; screenY=(gy-camY)+hh;
      ghost.style.transform = `translate(${Math.round(screenX-48)}px, ${Math.round(screenY-48)}px)`;

      if (dist<=Rcatch){ holdMs += dt*1000; } else { holdMs = Math.max(0, holdMs - dt*1000*0.6); }
      setProgress(holdMs / preset.holdMs);
      if (holdMs >= preset.holdMs){
        try{ navigator.vibrate && navigator.vibrate([60,40,60]); }catch(_){}
        close();
        resolve({ success:true, rarity:String(rarity||'normal'), holdMs: preset.holdMs });
        return;
      }
      raf = requestAnimationFrame(tick);
    }

    let resolve; const p = new Promise(res=>resolve=res);
    let raf = requestAnimationFrame(tick);
    cleanupFns.push(()=>cancelAnimationFrame(raf));
    return p;
  }

  return openGhostCatch;
}));