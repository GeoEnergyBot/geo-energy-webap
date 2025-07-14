
const supabase = supabase.createClient("https://ptkzsrlicfhufdnegwjl.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...");

const tg = window.Telegram.WebApp;
tg.expand();
const user = tg.initDataUnsafe.user;
const userId = user.id;
const username = user.username || user.first_name;

document.getElementById("username").innerText = username;

let level = 1;
let energy = 0;

document.getElementById("energy").innerText = energy;
document.getElementById("level").innerText = "Уровень: " + level;

async function loadPlayer() {
  let { data, error } = await supabase.from("players").select("*").eq("id", userId);
  if (!data || data.length === 0) {
    await supabase.from("players").insert([{ id: userId, username, energy: 0, level: 1 }]);
  } else {
    energy = data[0].energy;
    level = data[0].level;
    document.getElementById("energy").innerText = energy;
    document.getElementById("level").innerText = "Уровень: " + level;
  }
}
loadPlayer();

document.getElementById("btn-inventory").onclick = () => {
  document.getElementById("popup-inventory").classList.remove("hidden");
};
document.getElementById("close-inventory").onclick = () => {
  document.getElementById("popup-inventory").classList.add("hidden");
};

let sound = document.getElementById("energy-sound");

function collectEnergy(amount) {
  energy += amount;
  sound.play();
  document.getElementById("energy").innerText = energy;
  supabase.from("players").update({ energy }).eq("id", userId);
}
