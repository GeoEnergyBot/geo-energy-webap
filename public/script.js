
let player = {
    name: "Игрок",
    energy: 0,
    level: 1,
    spirit: 0
};

const energyDisplay = document.getElementById("energy");
const levelDisplay = document.getElementById("level");

function updateUI() {
    const nextEnergy = getNextEnergy(player.level);
    energyDisplay.textContent = `⚡ ${player.energy} / ${nextEnergy}`;
    levelDisplay.textContent = `Lvl ${player.level}`;
}

function getNextEnergy(level) {
    if (level === 1) return 100;
    if (level >= 2 && level <= 10) return level * 2 * 100;
    if (level >= 11 && level <= 30) return level * 3 * 100;
    if (level >= 31 && level <= 50) return level * 5 * 100;
    if (level >= 51 && level <= 80) return level * 10 * 100;
    return level * 20 * 100;
}

function gainEnergy(amount) {
    player.energy += amount;
    while (player.energy >= getNextEnergy(player.level)) {
        player.energy -= getNextEnergy(player.level);
        player.level++;
    }
    updateUI();
}

setInterval(() => {
    gainEnergy(Math.floor(Math.random() * 10));
}, 3000);

updateUI();
