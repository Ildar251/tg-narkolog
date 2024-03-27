require('dotenv').config()
const { Bot, GrammyError, HttpError, Keyboard, InlineKeyboard, session, InputFile } = require('grammy')
const { Router } = require("@grammyjs/router");

const { google } = require('googleapis');
const keys = require('./winter-jet-375911-dd7563b7f443.json');
// Аутентификация с помощью учетных данных
const client = new google.auth.JWT(
    keys.client_email,
    null,
    keys.private_key,
    ['https://www.googleapis.com/auth/spreadsheets']
);

// Установка клиента Google Sheets API
const sheets = google.sheets({ version: 'v4', auth: client });

// Отправка данных в Google Таблицу
async function writeToGoogleSheet(data) {
    const spreadsheetId = '19HKhxN7iopzzBNBljroBBcLlX_yzw2DCeSZHgEokf24';
    const range = 'Sheet1!A1';

    const valueInputOption = 'RAW';
    const insertDataOption = 'INSERT_ROWS';

    const requestBody = {
        values: [Object.values(data)]
    };

    try {
        const response = await sheets.spreadsheets.values.append({
            spreadsheetId,
            range,
            valueInputOption,
            insertDataOption,
            requestBody
        });

        console.log('Data successfully written to Google Sheets:', response.data);
    } catch (err) {
        console.error('Error writing data to Google Sheets:', err);
    }
}


const bot = new Bot(process.env.BOT_API_KEY);

const router = new Router((ctx) => ctx.session.step);

// Use session.
bot.use(session({ initial: () => ({ step: "", data: {} }) }));


bot.api.setMyCommands([
    {
        command: 'start', description: 'Запуск бота'
    },
    {
        command: 'generate', description: 'Сгенерировать купон'
    }
])

bot.command('start', async (ctx) => {
    await ctx.reply(`Привет!`)
})

bot.command('generate', async (ctx) => {
    ctx.session.step = 'ask_inn';
    await ctx.reply(`Введите ИНН: 💼`);
});

const ask_inn = router.route("ask_inn");

ask_inn.on("message:text", async (ctx) => {
    const inn = ctx.message.text; // Получаем введенный ИНН

    // Проверяем, что введенный ИНН содержит только цифры
    if (/^\d+$/.test(inn)) {

        // Записываем ИНН в объект сессии
        ctx.session.data.inn = inn;
        await ctx.reply(`🎉 ИНН успешно заполнен: ${ctx.session.data.inn} `);

        ctx.session.step = 'ask_fio';
        await ctx.reply(`Введите ФИО: 📝`);


    } else {
        await ctx.reply('ИНН должен содержать только цифры. Пожалуйста, введите корректный ИНН. 🚫');
    }
})


const ask_fio = router.route("ask_fio");

ask_fio.on("message:text", async (ctx) => {
    const fio = ctx.message.text; // Получаем введенный ФИО

    // Записываем ФИО в объект сессии
    ctx.session.data.fio = fio;
    await ctx.reply(`🌟 ФИО успешно заполнен:  ${ctx.session.data.fio}`);

    ctx.session.step = 'coupon';

    // Генерируем уникальный идентификатор купона
    const couponId = generateCouponId();

    const couponKeyboard = new InlineKeyboard()
        .text('5000 рублей 💸', `coupon-1`)
        .text('15000 рубелй 💸', `coupon-2`);

    ctx.session.data.couponId = couponId;

    // Отправляем сообщение с клавиатурой для выбора купона
    await ctx.reply(`Давайте выберем купон 🎟️`, {
        reply_markup: couponKeyboard
    });



})

// Метод для генерации уникального идентификатора купона
function generateCouponId() {
    return Math.random().toString(36).substring(7);
}


// Обработка выбора купона
router.route("coupon", async (ctx) => {
    await ctx.answerCallbackQuery();
    // Получаем выбранный купон из контекста сообщения
    const coupon = ctx.callbackQuery.data;

    // Записываем выбранный купон в объект сессии
    ctx.session.data.coupon = coupon;

    if(coupon == 'coupon-1'  ) {
        await ctx.replyWithPhoto(new InputFile("./images/coupon5000.png"));
    } else if(coupon == 'coupon-2') {
        await ctx.replyWithPhoto(new InputFile("./images/coupon15000.png"));
    }
    writeToGoogleSheet(ctx.session.data);
    await ctx.reply(`Данные заполнены и отправлены в таблицу 📊✉️. \n \n 💼 ИНН: ${ctx.session.data.inn} \n 📝 ФИО : ${ctx.session.data.fio} \n 🎟️ Купон: ${ctx.session.data.coupon}` );
});


bot.catch((err) => {
    const ctx = err.ctx;
    console.error(`Error while handling update ${ctx.update.update_id}:`);
    const e = err.error;

    if (e instanceof GrammyError) {
        console.error("Error in request:", e.description);
    } else if (e instanceof HttpError) {
        console.error("Could not contact Telegram:", e);
    } else {
        console.error("Unknown error:", e);
    }
});

bot.use(router);
bot.start();