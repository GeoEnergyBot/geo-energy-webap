
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabase = createClient(
  'https://ptkzsrlicfhufdnegwjl.supabase.co',
  'ey...'
);

let tg = window.Telegram.WebApp;
tg.expand();
const user = tg.initDataUnsafe.user;

document.getElementById("top-name").textContent = user?.first_name || user?.username || "Гость";
document.getElementById("top-avatar").src = user?.photo_url || "https://cdn-icons-png.flaticon.com/512/9131/9131529.png";
