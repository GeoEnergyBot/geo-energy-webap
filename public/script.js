
let tg = window.Telegram.WebApp;
tg.expand();

document.getElementById("username").innerText = tg.initDataUnsafe.user?.first_name || "Игрок";

// Инициализация карты
const map = L.map('map').setView([0, 0], 15);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OSM',
}).addTo(map);

// Определение и отображение геопозиции
function locateUser() {
  if (!navigator.geolocation) {
    alert("Геолокация не поддерживается вашим устройством.");
    return;
  }

  navigator.geolocation.getCurrentPosition(position => {
    const lat = position.coords.latitude;
    const lon = position.coords.longitude;

    map.setView([lat, lon], 17);
    const marker = L.marker([lat, lon]).addTo(map).bindPopup("Вы здесь").openPopup();
    L.circle([lat, lon], { radius: 25, color: "blue", fillOpacity: 0.2 }).addTo(map);
  }, () => {
    alert("Не удалось определить местоположение.");
  });
}

locateUser();

function openInventory() { alert("Инвентарь откроется"); }
function openShop() { alert("Магазин откроется"); }
function openRating() { alert("Рейтинг откроется"); }
function openBestiary() { alert("Бестиарий откроется"); }
