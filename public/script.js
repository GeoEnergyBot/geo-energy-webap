const supabase = supabase.createClient(
  "https://ptkzsrlicfhufdnegwjl.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
);

let tg = window.Telegram.WebApp;
tg.expand();
const user = tg.initDataUnsafe.user;
const userId = user.id;
const username = user.username || (user.first_name + ' ' + (user.last_name || ''));

const collectBtn = document.getElementById("collectBtn");
let map = L.map('map').setView([51.1605, 71.4704], 15);
let userMarker = null;

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19
}).addTo(map);

// Функция загрузки точек энергии из базы
async function loadEnergyPoints() {
  const { data: points } = await supabase.from("energy_points").select("*");
  for (let pt of points) {
    if (!pt.collected) {
      const marker = L.circle([pt.lat, pt.lon], {
        radius: 20,
        color: "green",
        fillColor: "#7f7",
        fillOpacity: 0.6
      }).addTo(map);
      marker.on("click", async () => {
        const distance = map.distance(userMarker.getLatLng(), marker.getLatLng());
        if (distance < 50) {
          collectBtn.style.display = "block";
          collectBtn.onclick = async () => {
            await supabase.from("energy_points").update({ collected: true }).eq("id", pt.id);
            await supabase.from("players").upsert({ id: userId, username, energy: pt.amount }, { onConflict: ['id'] });
            alert("Энергия собрана!");
            collectBtn.style.display = "none";
            location.reload();
          };
        }
      });
    }
  }
}

// Геолокация
map.locate({ setView: true, watch: true, enableHighAccuracy: true });
map.on("locationfound", (e) => {
  if (userMarker) {
    userMarker.setLatLng(e.latlng);
  } else {
    userMarker = L.marker(e.latlng).addTo(map);
  }
});
map.on("locationerror", () => alert("Геолокация недоступна. Пожалуйста, включите GPS."));

loadEnergyPoints();