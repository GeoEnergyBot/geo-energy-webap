export const SUPABASE_URL = 'https://ptkzsrlicfhufdnegwjl.supabase.co';
export const SUPABASE_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0a3pzcmxpY2ZodWZkbmVnd2psIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI0NzA3NjAsImV4cCI6MjA2ODA0Njc2MH0.eI0eF_imdgGWPLiUULTprh52Jo9P69WGpe3RbCg3Afo';

// Edge Function для точек энергии
export const FUNCTIONS_ENDPOINT = 'https://ptkzsrlicfhufdnegwjl.functions.supabase.co/generate-points';

// Где искать спрайты призраков (код попробует по очереди)
export const GHOST_ICON_BASES = ['ghost_icons', 'assets/ghosts'];

// ===== Параметры сложности «погони» =====
export const DIFFICULTY = {
  common:   { reticleRadiusPx: 50,  holdMs: 1200, baseSpeed: 200, nearBoost: 100 },
  advanced: { reticleRadiusPx: 45,  holdMs: 1600, baseSpeed: 240, nearBoost: 120 },
  rare:     { reticleRadiusPx: 38,  holdMs: 2200, baseSpeed: 280, nearBoost: 140 },
};

// Глобальные настройки AR/гиро
export const AR_TUNING = {
  fatigueMs: 700,
  edgeBounce: 0.8,
  feintEveryMs: 2800,
  sensorYawToPx: 6,
  sensorPitchToPx: 6,
  joystickSensitivity: 1.6
};
