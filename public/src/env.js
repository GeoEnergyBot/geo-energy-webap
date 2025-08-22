
export const SUPABASE_URL = 'https://ptkzsrlicfhufdnegwjl.supabase.co';
export const SUPABASE_ANON = '';
export const FUNCTIONS_ENDPOINT = 'https://ptkzsrlicfhufdnegwjl.functions.supabase.co/generate-points'; // optional; if blank, будет использоваться локальная генерация точек

export const GHOST_ICON_BASES = ['ghost_icons', 'assets/ghosts'];

export const DIFFICULTY = {
  common:   { reticleRadiusPx: 50,  holdMs: 16000, baseSpeed: 200 },
  advanced: { reticleRadiusPx: 45,  holdMs: 20000, baseSpeed: 240 },
  rare:     { reticleRadiusPx: 38,  holdMs: 24000, baseSpeed: 280 },
};

export const AR_TUNING = {
  comboAfterMs: 1500,
  comboMax: 1.5,
  decayOutPerSec: 0.15,
  feintEveryMs: 2200,
  sensorYawToPx: 6,
  sensorPitchToPx: 6,
};


/** Домены прод-сборки: на них отключаем оффлайн-фолбэк и требуем работающий бэк */
export const PROD_DOMAINS = ['geo-energy-webap.vercel.app'];
