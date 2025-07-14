
let energy = 0;
let level = 1;
let spirit = 0;

const energyDisplay = document.getElementById("player-energy");
const spiritDisplay = document.getElementById("player-spirit");
const levelDisplay = document.getElementById("player-level");
const collectButton = document.getElementById("collect-button");

collectButton.addEventListener("click", () => {
    let gain = Math.floor(Math.random() * 21) + 10;
    energy += gain;
    energyDisplay.textContent = `⚡ ${energy}`;

    const sound = document.getElementById("energy-sound");
    sound.play();

    // Level-up logic
    let nextLevelRequirement = getNextLevelRequirement(level);
    if (energy >= nextLevelRequirement) {
        level++;
        levelDisplay.textContent = `Ур. ${level}`;
    }

    // Random SPIRIT drop
    if (Math.random() < 0.1) {
        spirit++;
        spiritDisplay.textContent = `💎 ${spirit}`;
    }
});

function getNextLevelRequirement(lvl) {
    if (lvl === 1) return 100;
    if (lvl <= 10) return lvl * 100 * 2;
    if (lvl <= 30) return lvl * 100 * 3;
    if (lvl <= 50) return lvl * 100 * 5;
    if (lvl <= 80) return lvl * 100 * 10;
    return lvl * 100 * 20;
}

function openModule(name) {
    const modal = document.getElementById("modal-container");
    const content = document.getElementById("modal-content");
    modal.style.display = "flex";
    content.innerHTML = `<h2>Загрузка модуля "${name}"...</h2>`;
    import(`./modules/${name}.js`)
        .then(module => {
            content.innerHTML = module.render ? module.render() : `<p>Модуль "${name}" загружен</p>`;
        })
        .catch(() => {
            content.innerHTML = `<p>Не удалось загрузить модуль "${name}"</p>`;
        });
}

function closeModal() {
    document.getElementById("modal-container").style.display = "none";
}
