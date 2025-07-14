
let tg = window.Telegram.WebApp;
tg.expand();
const user = tg.initDataUnsafe.user || {};
const username = user.username || (user.first_name + " " + (user.last_name || ""));
document.getElementById("username").innerText = username;

let energy = 0;
let level = 1;
const collectBtn = document.getElementById("collectBtn");

const map = L.map('map').setView([51.1605, 71.4704], 15);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

let marker = L.marker([51.1605, 71.4704]).addTo(map);
marker.bindPopup("Вы здесь!");

function openShop() {
  alert("Магазин в разработке!");
}
function openRanking() {
  alert("Рейтинг в разработке!");
}
function openInventory() {
  alert("Инвентарь в разработке!");
}
function openBestiary() {
  alert("Бестиарий в разработке!");
}
function collectEnergy() {
  const energyAmount = Math.floor(Math.random() * 21) + 10;
  energy += energyAmount;
  document.getElementById("energy").innerText = energy;
  alert(`Собрано ⚡${energyAmount} энергии`);
  updateLevel();
}

function updateLevel() {
  let nextThreshold = 100;
  if (level >= 2 && level <= 10) nextThreshold *= 2 ** (level - 1);
  else if (level >= 11 && level <= 30) nextThreshold *= 2 ** 9 * 3 ** (level - 10);
  else if (level >= 31 && level <= 50) nextThreshold *= 2 ** 9 * 3 ** 20 * 5 ** (level - 30);
  else if (level >= 51 && level <= 80) nextThreshold *= 2 ** 9 * 3 ** 20 * 5 ** 20 * 10 ** (level - 50);
  else if (level >= 81) nextThreshold *= 2 ** 9 * 3 ** 20 * 5 ** 20 * 10 ** 30 * 20 ** (level - 80);
  if (energy >= nextThreshold) {
    level++;
    document.getElementById("level").innerText = level;
    alert("Повышение уровня!");
  }
}
