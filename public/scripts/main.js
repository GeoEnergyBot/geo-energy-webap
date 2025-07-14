import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// Supabase подключение
const supabaseUrl = 'https://ptkzsrlicfhufdnegwjl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0a3pzcmxpY2ZodWZkbmVnd2psIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI0NzA3NjAsImV4cCI6MjA2ODA0Njc2MH0.eI0eF_imdgGWPLiUULTprh52Jo9P69WGpe3RbCg3Afo';
const supabase = createClient(supabaseUrl, supabaseKey);

// Получение данных Telegram
let tg = window.Telegram.WebApp;
tg.expand();

const user = tg.initDataUnsafe.user;

document.getElementById("username").textContent = user.first_name || user.username;
document.getElementById("avatar").src = user.photo_url || "https://via.placeholder.com/40";

// Проверка игрока в Supabase
(async () => {
    const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('telegram_id', user.id)
        .single();

    if (!data) {
        // Создаём нового игрока
        const { error: insertError } = await supabase.from('players').insert([{
            telegram_id: user.id,
            username: user.username,
            first_name: user.first_name,
            avatar_url: user.photo_url
        }]);

        if (insertError) console.error("Ошибка при создании игрока:", insertError);
        else console.log("Создан новый игрок");
    } else {
        console.log("Игрок найден:", data);
    }
})();
