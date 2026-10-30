require('dotenv').config();
const fetch = require('node-fetch');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// ⚠️ СЮДА ВПИШИ СВОЙ ID И ID ВТОРОГО ЧЕЛОВЕКА
const TELEGRAM_USER_IDS = [
    process.env.TELEGRAM_USER_ID, // Твой ID из файла .env
    '1242880325'                  // ⚠️ ВСТАВЬ СЮДА ID ВТОРОГО ЧЕЛОВЕКА
];

// ⚠️ ВСТАВЬ СЮДА СВОЙ ТОКЕН APIFY
const APIFY_TOKEN = process.env.APIFY_TOKEN; 
const ACTOR_ID = 'serp.cheap.ofc~cheapest-rabota-by-scraper';

const seenVacancies = new Set();

// Функция теперь отправляет всем ID из списка
async function sendTelegramMessage(message) {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    
    for (const chatId of TELEGRAM_USER_IDS) {
        try {
            await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: chatId, text: message, disable_web_page_preview: true })
            });
        } catch (error) {
            console.error(`Ошибка отправки (${chatId}):`, error.message);
        }
    }
}

async function checkRabota() {
    console.log('Запускаем парсер Apify...');
    
    const url = `https://api.apify.com/v2/acts/${ACTOR_ID}/run-sync-get-dataset-items?token=${APIFY_TOKEN}`;
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                keyword: "", 
                maxItems: 100, 
                openEveryJobPage: false 
            })
        });
        
        const data = await response.json();
        
        if (!Array.isArray(data)) {
            console.error('Ошибка Apify:', data);
            return;
        }

        // Фильтруем: только Гродно + зарплата от 1600
        const vacancies = data.filter(v => {
            const city = (v.location && v.location.city) ? v.location.city.toLowerCase() : '';
            if (!city.includes('гродно')) return false;
            if (!v.salary || !v.salary.min) return false;
            return v.salary.min >= 1600;
        });

        for (const vacancy of vacancies) {
            const vid = vacancy.url;
            if (!seenVacancies.has(vid)) {
                seenVacancies.add(vid);
                
                let salaryText = 'не указана';
                if (vacancy.salary) {
                    const from = vacancy.salary.min ? `от ${vacancy.salary.min} ` : '';
                    const to = vacancy.salary.max ? `до ${vacancy.salary.max} ` : '';
                    const curr = vacancy.salary.currency || 'BYN';
                    salaryText = `${from}${to}${curr}`.trim();
                }

                const message = `Новая вакансия (Гродно)!\n${vacancy.title}\nКомпания: ${vacancy.company?.name || 'не указана'}\nЗарплата: ${salaryText}\n${vacancy.url}`;
                
                console.log(`Найдена новая в Гродно: ${vacancy.title}`);
                await sendTelegramMessage(message);
            }
        }
        console.log('Проверка завершена.');
    } catch (error) {
        console.error('Ошибка при работе с Apify:', error.message);
    }
}

setTimeout(() => {
    checkRabota();
    setInterval(checkRabota, 900000); // 15 минут
}, 5000);

console.log('Бот для вакансий (Apify, только Гродно) запущен.');
sendTelegramMessage('Бот для вакансий (только Гродно) запущен!');