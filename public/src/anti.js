let penaltyUntil = 0;
export const anti = {
  tick(){ /* no-op simple */ },
  getPenalty(){ return { active:false, factor:1.0, reason:null, msLeft:0 }; }
};