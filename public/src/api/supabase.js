export function initSupabase(){ return null; }
export async function loadOrCreatePlayer(user){
  return { level:1, energy:0, energy_max:1000, username: user?.first_name || user?.username || 'Игрок' };
}