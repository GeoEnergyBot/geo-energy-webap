
const supabase = supabase.createClient("https://ptkzsrlicfhufdnegwjl.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0a3pzcmxpY2ZodWZkbmVnd2psIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI0NzA3NjAsImV4cCI6MjA2ODA0Njc2MH0.eI0eF_imdgGWPLiUULTprh52Jo9P69WGpe3RbCg3Afo");

let tg = window.Telegram.WebApp;
tg.expand();

let username = tg.initDataUnsafe?.user?.username || 'Игрок';
let userId = tg.initDataUnsafe?.user?.id;
document.getElementById("username").innerText = username;

let map = L.map('map').setView([51.1605, 71.4704], 15);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

// Модули
function openInventory() {
  document.getElementById("inventory").style.display = "block";
}
function closeInventory() {
  document.getElementById("inventory").style.display = "none";
}
function openShop() {
  alert("Магазин в разработке");
}
function openRating() {
  alert("Рейтинг в разработке");
}
function openBestiary() {
  alert("Бестиарий в разработке");
}
