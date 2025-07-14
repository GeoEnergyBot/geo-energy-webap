import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// Supabase
const supabaseUrl = 'https://ptkzsrlicfhufdnegwjl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0a3pzcmxpY2ZodWZkbmVnd2psIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI0NzA3NjAsImV4cCI6MjA2ODA0Njc2MH0.eI0eF_imdgGWPLiUULTprh52Jo9P69WGpe3RbCg3Afo';
const supabase = createClient(supabaseUrl, supabaseKey);

// Telegram
let tg = window.Telegram.WebApp;
tg.expand();

const debugEl = document.createElement('div');
debugEl.style.whiteSpace = 'pre-wrap';
debugEl.style.padding = '10px';
debugEl.style.color = '#0f0';
debugEl.style.background = '#111';
debugEl.style.fontSize = '12px';
debugEl.innerText = '⏳ Получаю Telegram данные...';
document.body.appendChild(debugEl);

const user = tg.initDataUnsafe.user;
debugEl.innerText = 'Telegram initDataUnsafe:
' + JSON.stringify(tg.initDataUnsafe, null, 2);

if (!user) {
    document.getElementById("username").textContent = "Ошибка: нет данных Telegram";
    console.error("❌ Нет доступа к Telegram WebApp. Запусти игру из Telegram.");
} else {
    document.getElementById("username").textContent = user.first_name || user.username;
    document.getElementById("avatar").src = user.photo_url || "https://via.placeholder.com/40";

    (async () => {
        const { data, error } = await supabase
            .from('players')
            .select('*')
            .eq('telegram_id', user.id)
            .single();

        console.log("📦 Получен игрок:", data);
        console.log("⚠️ Ошибка при получении:", error);

        if (!data) {
            const { error: insertError } = await supabase.from('players').insert([{
                telegram_id: user.id,
                username: user.username,
                first_name: user.first_name,
                avatar_url: user.photo_url
            }]);

            if (insertError) {
                console.error("❌ Ошибка при создании игрока:", insertError);
                document.getElementById("username").textContent = "Ошибка базы";
            } else {
                console.log("✅ Создан новый игрок");
            }
        } else {
            console.log("✅ Игрок найден:", data);
        }
    })();
}
