
document.addEventListener("DOMContentLoaded", async () => {
  const backButton = document.getElementById("back-btn");
  const ghostAvatar = document.getElementById("ghost-avatar");
  const stats = document.getElementById("ghost-stats");
  const artifactsContainer = document.getElementById("artifacts");

  const tg = window.Telegram.WebApp;
  tg.expand();
  const user = tg.initDataUnsafe.user;
  const userId = user.id;

  const supabase = window.supabase;

  async function loadPlayerData() {
    const { data, error } = await supabase
      .from("players")
      .select("*")
      .eq("id", userId)
      .single();

    if (data) {
      stats.innerHTML = `
        <p><strong>Имя:</strong> ${data.username}</p>
        <p><strong>Уровень:</strong> ${data.level}</p>
        <p><strong>Энергия:</strong> ${data.energy}</p>
        <p><strong>Сила:</strong> ${data.strength || 0}</p>
        <p><strong>Здоровье:</strong> ${data.health || 0}</p>
      `;

      if (data.artifacts) {
        data.artifacts.forEach((artifact) => {
          const slot = document.createElement("div");
          slot.className = "artifact-slot";
          slot.textContent = artifact.name;
          artifactsContainer.appendChild(slot);
        });
      }
    } else {
      stats.innerHTML = "<p>Ошибка загрузки данных игрока</p>";
    }
  }

  backButton.addEventListener("click", () => {
    window.location.href = "index.html";
  });

  loadPlayerData();
});
