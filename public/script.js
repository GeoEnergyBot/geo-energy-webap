
const supabase = supabase.createClient(
  "https://ptkzsrlicfhufdnegwjl.supabase.co",
  "public-anon-key"
);

let tg = window.Telegram.WebApp;
tg.expand();

const user = tg.initDataUnsafe.user;
const userId = user.id;
const username = user.username || user.first_name + (user.last_name ? " " + user.last_name : "");

document.getElementById("username").innerText = username;
document.getElementById("avatar").src = "ghost_avatar.png";

let energy = 0;
const energyText = document.getElementById("energy");

async function loadOrCreatePlayer() {
  let { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('id', userId)
    .single();

  if (!data) {
    await supabase.from('players').insert([{ id: userId, username, energy: 0 }]);
    energy = 0;
  } else {
    energy = data.energy;
  }
  energyText.innerText = energy;
}

async function addEnergy(amount) {
  energy += amount;
  energyText.innerText = energy;
  await supabase.from('players')
    .update({ energy })
    .eq('id', userId);
}

loadOrCreatePlayer();
