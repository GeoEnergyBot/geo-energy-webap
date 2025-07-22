import { setupPlayer } from './player.js';
import { setupMapAndTracking } from './geolocation.js';

let tg = window.Telegram.WebApp;
tg.expand();
const user = tg.initDataUnsafe.user;

(async () => {
  const level = await setupPlayer(user);
  setupMapAndTracking(user, level);
})();
