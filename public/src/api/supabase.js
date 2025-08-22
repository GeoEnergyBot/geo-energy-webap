import { SUPABASE_URL, SUPABASE_ANON } from '../env.js';

const REST = SUPABASE_URL.replace(/\/$/,'') + '/rest/v1';

function headers(){
  return {
    'apikey': SUPABASE_ANON,
    'Authorization': 'Bearer ' + SUPABASE_ANON,
    'Content-Type': 'application/json'
  };
}

export function initSupabase(){ /* no-op for REST mode */ }

export async function loadOrCreatePlayer(user){
  const tid = String(user?.id || 'guest');
  if (tid === 'guest'){
    return { level:1, energy:0, energy_max:1000, username:'Гость', dbRow:null };
  }
  // try get
  let r = await fetch(`${REST}/players?telegram_id=eq.${encodeURIComponent(tid)}&select=*`, { headers: headers() });
  if (r.ok){
    const rows = await r.json();
    if (Array.isArray(rows) && rows.length){
      const p = rows[0];
      return {
        level: Number(p.level||1),
        energy: Number(p.energy||0),
        energy_max: Number(p.energy_max||1000),
        username: p.first_name || p.username || 'Игрок',
        dbRow: p
      };
    }
  }
  // insert
  const payload = [{
    telegram_id: tid,
    username: user?.username || null,
    first_name: user?.first_name || null,
    avatar_url: user?.photo_url || null
  }];
  r = await fetch(`${REST}/players?select=*`, { method:'POST', headers: headers(), body: JSON.stringify(payload) });
  if (!r.ok){
    // fallback to readable defaults
    return { level:1, energy:0, energy_max:1000, username: user?.first_name || user?.username || 'Игрок', dbRow:null };
  }
  const rows = await r.json();
  const p = rows[0] || {};
  return {
    level: Number(p.level||1),
    energy: Number(p.energy||0),
    energy_max: Number(p.energy_max||1000),
    username: p.first_name || p.username || 'Игрок',
    dbRow: p
  };
}
