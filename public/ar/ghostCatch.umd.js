(function(root,factory){
  if (typeof define==='function' && define.amd){ define([], factory); }
  else if (typeof module==='object' && module.exports){ module.exports = factory(); }
  else { root.openGhostCatch = factory(); }
}(typeof self!=='undefined'?self:this, function(){
  let _busy = false;
  function fmt(ms){ const s=Math.max(0,Math.ceil(ms/1000)); const m=(s/60)|0; const ss=String(s%60).padStart(2,'0'); return m+':'+ss; }
  function confFor(r){ 
    const D=(typeof window!=='undefined' && window.DIFFICULTY && window.DIFFICULTY[r])? window.DIFFICULTY[r] : {holdMs:16000, baseSpeed:260, reticleRadiusPx:60};
    return D;
  }
  return async function openGhostCatch(rarity){
    if (_busy) return {success:false};
    _busy = true;
    try{
      const modal = document.getElementById('ar-modal');
      const stage = document.getElementById('ar-stage');
      const title = document.getElementById('ar-title');
      const close = document.getElementById('ar-close');
      if (!modal || !stage){ _busy=false; return {success:false}; }
      if (title) title.textContent = 'Поймайте призрака в круг';
      modal.classList.remove('hidden');
      try{ window.dispatchEvent(new Event('ar:open')); }catch(_){}

      // Build canvas
      stage.innerHTML = '';
      const wrap = document.createElement('div');
      Object.assign(wrap.style,{position:'relative',width:'100%',height:'100%'});
      stage.appendChild(wrap);

      const W = Math.min(380, Math.floor(window.innerWidth*0.95));
      const H = Math.max(520, Math.min(640, Math.floor(window.innerHeight*0.8)));
      const canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      Object.assign(canvas.style,{display:'block',margin:'0 auto',borderRadius:'16px',background:'radial-gradient(circle at 50% 40%, rgba(0,255,153,.18), transparent 60%), #0a0e11'});
      wrap.appendChild(canvas);
      const ctx = canvas.getContext('2d');

      // UI: progress + timer
      const prog = document.createElement('div');
      const progIn = document.createElement('div');
      Object.assign(prog.style,{height:'10px',borderRadius:'8px',background:'rgba(255,255,255,.12)',margin:'8px 12px 0 12px'});
      Object.assign(progIn.style,{height:'10px',width:'0%',borderRadius:'8px',background:'linear-gradient(90deg,#22d3ee,#818cf8,#e879f9)'});
      prog.appendChild(progIn); wrap.appendChild(prog);

      const timer = document.createElement('div');
      Object.assign(timer.style,{position:'absolute',top:'8px',right:'12px',padding:'4px 8px',borderRadius:'8px',background:'rgba(0,0,0,.35)',fontSize:'12px',color:'#fff'});
      timer.textContent = 'Наведите призрака в круг'; wrap.appendChild(timer);

      const diff = confFor(String(rarity||'common'));
      const circleR = diff.reticleRadiusPx || 60;
      let ghost = { x: W/2, y: H/2, vx: 0.9*diff.baseSpeed/60, vy: 0.7*diff.baseSpeed/60 };
      let progress = 0, heldMs=0, combo=1.0, lastFeint=0, tPrev=0, running=true, raf=0;

      function drawTarget(){
        ctx.save();
        ctx.translate(W/2, H/2);
        ctx.beginPath(); ctx.arc(0,0,circleR,0,Math.PI*2); ctx.strokeStyle='rgba(34,211,238,.9)'; ctx.lineWidth=3; ctx.stroke();
        ctx.beginPath(); ctx.arc(0,0,circleR+10,0,Math.PI*2); ctx.strokeStyle='rgba(129,140,248,.35)'; ctx.lineWidth=1.5; ctx.setLineDash([6,6]); ctx.stroke();
        ctx.restore();
      }
      function drawGhost(){
        ctx.save();
        ctx.translate(ghost.x, ghost.y); ctx.scale(1,1);
        ctx.beginPath(); ctx.arc(0,0,16,0,Math.PI*2); ctx.fillStyle='#e879f9'; ctx.fill();
        ctx.restore();
      }
      function cleanup(success){
        cancelAnimationFrame(raf);
        modal.classList.add('hidden');
        try{ window.dispatchEvent(new Event('ar:close')); }catch(_){}
        stage.innerHTML='';
        if (close) close.onclick=null;
        _busy=false;
      }
      if (close) close.onclick = ()=>{ cleanup(false); };

      function tick(ts){
        raf = requestAnimationFrame(tick);
        const dt = Math.min(32, ts - (tPrev||ts)); tPrev = ts;
        lastFeint += dt;
        if (lastFeint > (diff.feintEveryMs||2200)){ lastFeint=0; ghost.vx*=-1.12; ghost.vy*=1.08; }
        // Move
        ghost.x += ghost.vx * dt; ghost.y += ghost.vy * dt;
        if (ghost.x < 18 || ghost.x > W-18) ghost.vx*=-1;
        if (ghost.y < 18 || ghost.y > H-18) ghost.vy*=-1;

        const inCircle = Math.hypot(ghost.x - W/2, ghost.y - H/2) <= circleR;
        if (inCircle){
          heldMs += dt;
          if (heldMs > 1500) combo = Math.min(1.5, combo + 0.003);
        } else {
          combo = 1.0;
        }
        const goalMs = diff.holdMs || 16000;
        if (inCircle){
          progress = Math.min(1, heldMs / goalMs);
        } else {
          progress = Math.max(0, progress - (dt/1000) * 0.15);
        }

        // Render
        ctx.clearRect(0,0,W,H);
        drawTarget(); drawGhost();
        progIn.style.width = (progress*100).toFixed(1)+'%';
        timer.textContent = inCircle ? ('Осталось: '+fmt(Math.max(0, goalMs - heldMs))) : 'Наведите призрака в круг';

        if (progress>=1){
          cleanup(true);
          resolve({success:true, rewardMult: Math.min(1.2, 1 + (combo-1)/2)});
        }
      }
      let resolve; const p = new Promise(res=> resolve=res);
      tPrev = performance.now(); raf = requestAnimationFrame(tick);
      return await p;
    } finally { /* state cleared in cleanup */ }
  };
}));
