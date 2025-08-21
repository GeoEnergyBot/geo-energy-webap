import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { SUPABASE_URL, SUPABASE_ANON } from '../env.js';

let supabase = null;

export function initSupabase() {
  if (!supabase) {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON);
  }
  return supabase;
}

export async function loadOrCreatePlayer(user) {
  const sb = initSupabase();
  const tid = String(user.id);
  let level = 1, energy = 0, energy_max = 1000, dbRow = null;

  if (tid !== 'guest') {
    const { data, error } = await sb
      .from('players')
      .select('*')
      .eq('telegram_id', tid)
      .maybeSingle();

    if (!data && !error) {
      const { data: inserted, error: insertErr } = await sb
        .from('players')
        .insert([{
          telegram_id: tid,
          username: user.username,
          first_name: user.first_name,
          avatar_url: user.photo_url
        }]).select().maybeSingle();
      if (!insertErr) dbRow = inserted;
    } else {
      dbRow = data || null;
    }

    level = dbRow?.level ?? 1;
    energy = dbRow?.energy ?? 0;
    energy_max = dbRow?.energy_max ?? 1000;
  }
  return { level, energy, energy_max, dbRow };
}
