export const store = {
  init(){ /* no-op */ },
  bindMap(){ /* no-op */ },
  energyMultiplier(){ return 1.0; },
  dustMultiplier(){ return 1.0; },
  spawnRefreshMs(d){ return d; },
  getEffects(){ return []; },
  hasEffect(){ return false; }
};