const supabase = supabase.createClient("https://ptkzsrlicfhufdnegwjl.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...");
let tg = window.Telegram.WebApp;
tg.expand();
const user = tg.initDataUnsafe.user;
const userId = user.id;
const username = user.username || user.first_name;

document.getElementById("username").innerText = username;

let map = L.map('map').setView([51.1605, 71.4704], 15);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

let userMarker = null;
let currentLat = 0, currentLon = 0;
const collectBtn = document.getElementById("collectBtn");

map.locate({ setView: true, watch: true, enableHighAccuracy: true });
map.on("locationfound", (e) => {
  currentLat = e.latitude;
  currentLon = e.longitude;
  if (!userMarker) {
    userMarker = L.marker(e.latlng, {
      icon: L.icon({ iconUrl: "ghost_avatar.png", iconSize: [40, 40] })
    }).addTo(map);
  } else {
    userMarker.setLatLng(e.latlng);
  }
});

let energy = 0, level = 1;
const energyText = document.getElementById("energy");
const levelText = document.getElementById("level");

function getRequiredEnergyForNextLevel(level) {
  if (level <= 10) return 10 * Math.pow(2, level);
  if (level <= 30) return 10 * Math.pow(3, level - 10);
  if (level <= 50) return 10 * Math.pow(5, level - 30);
  if (level <= 80) return 10 * Math.pow(10, level - 50);
  return 10 * Math.pow(20, level - 80);
}

function updateStats() {
  energyText.innerText = energy;
  levelText.innerText = "Ур. " + level;
}

async function addEnergy(amount) {
  energy += amount;
  const nextReq = getRequiredEnergyForNextLevel(level);
  if (energy >= nextReq) {
    level++;
    energy -= nextReq;
  }
  updateStats();
  await supabase.from("players").upsert({ id: userId, username, energy, level });
}

function openMenu(name) {
  const panel = document.getElementById("overlay");
  const content = document.getElementById("panelContent");
  panel.classList.remove("hidden");

  if (name === "shop") {
    content.innerHTML = "<h3>Магазин</h3><p>В будущем — покупка артефактов</p>";
  } else if (name === "ranking") {
    loadRanking(content);
  } else if (name === "inventory") {
    content.innerHTML = "<h3>Инвентарь</h3><img src='ghost_avatar.png' width='80'/><p>Сила, здоровье, артефакты</p>";
  } else if (name === "bestiary") {
    content.innerHTML = "<h3>Бестиарий</h3><p>Здесь будут пойманные призраки</p>";
  }
}

function closeMenu() {
  document.getElementById("overlay").classList.add("hidden");
}

async function loadRanking(container) {
  const { data } = await supabase.from("players").select("*").order("level", { ascending: false }).limit(100);
  container.innerHTML = "<h3>Рейтинг</h3><ol>" + data.map(p => `<li>${p.username} — Ур. ${p.level}, ⚡${p.energy}</li>`).join("") + "</ol>";
}

async function spawnEnergyPoint() {
  const points = await supabase.from("energy_points").select("*").eq("collected", false);
  for (const pt of points.data) {
    const marker = L.circle([pt.lat, pt.lon], {
      radius: 20, color: "green", fillColor: "#0f0", fillOpacity: 0.5
    }).addTo(map);
    marker.on("click", async () => {
      const dist = map.distance(userMarker.getLatLng(), marker.getLatLng());
      if (dist < 50) {
        collectBtn.style.display = "block";
        collectBtn.onclick = async () => {
          await supabase.from("energy_points").update({ collected: true }).eq("id", pt.id);
          addEnergy(pt.amount);
          collectBtn.style.display = "none";
          marker.remove();
        };
      }
    });
  }
}

updateStats();
spawnEnergyPoint();