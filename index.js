require('dotenv').config()
const { Bot, GrammyError, HttpError, Keyboard, InlineKeyboard, session, InputFile } = require('grammy')
const { Router } = require("@grammyjs/router");
const sharp = require('sharp');

// DaDate
const DaDate_url = "http://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/party";

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
bot.use(session({ initial: () => ({ step: 'default', data: {} }) }));


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

        if (ctx.message.text.length === 10 || inn.length === 12) {

            const options = {
                method: "POST",
                mode: "cors",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "Authorization": "Token " + process.env.DADATE_API_KEY
                },
                body: JSON.stringify({ query: inn })
            }

            const innKeyboard = new InlineKeyboard()
                .text('Да ✅', `yes`)
                .text('Нет, ввести заново', `no`);

            ctx.session.data = {
                inn: '',
                organization: '',
                fio: '',
                email: '',
                phone: '',
                coupon: '',
            };

            ctx.session.data.inn = inn;

            try {
                const response = await fetch(DaDate_url, options);
                const result = await response.json();
                const organization = result.suggestions[0].value;
                ctx.session.organization = organization;
                await ctx.reply(`Ваша организация ${organization} ?`, {
                    reply_markup: innKeyboard
                });

            } catch (error) {
                await ctx.reply(`Организация не найдена, продолжить с введенным ИНН?`, {
                    reply_markup: innKeyboard
                });

            }
        } else {
            await ctx.reply(`ИНН должен содержать 10 или 12 символов. Пожалуйста, введите корректный ИНН. 🚫`);
        }
    } else {
        await ctx.reply('ИНН должен содержать только цифры. Пожалуйста, введите корректный ИНН. 🚫');
    }
})

// Обработка inline кнопок "yes" и "no"
bot.callbackQuery('yes', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply(`🎉 ИНН успешно заполнен: ${ctx.session.data.inn}`);
    ctx.session.data.organization = ctx.session.organization;
    ctx.session.step = 'ask_email';
    await ctx.reply(`Введите Email: 📝`);
});

bot.callbackQuery('no', async (ctx) => {
    await ctx.answerCallbackQuery();
    // Если пользователь отказался от введенного ИНН, переходим к началу
    ctx.session.step = 'ask_inn';
    await ctx.reply(`Введите ИНН: 💼`);
});


const ask_email = router.route("ask_email");

ask_email.on("message:text", async (ctx) => {
    const email = ctx.message.text; // Получаем введенный ФИО
    // Записываем ФИО в объект сессии
    ctx.session.data.email = email;
    await ctx.reply(`🌟 Email успешно заполнен:  ${ctx.session.data.email}`);
    ctx.session.step = 'ask_phone';
    await ctx.reply(`Введите Телефон: 📝`);
})


const ask_phone = router.route("ask_phone");

ask_phone.on("message:text", async (ctx) => {
    const phone = ctx.message.text; // Получаем введенный ФИО

    // Записываем ФИО в объект сессии
    ctx.session.data.phone = phone;
    await ctx.reply(`🌟 Телефон успешно заполнен:  ${ctx.session.data.phone}`);

    ctx.session.step = 'ask_fio';
    await ctx.reply(`Введите ФИО: 📝`);
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
        .text('15000 рублей 💸', `coupon-2`).row()
        .text('Выбрать оба купона 💸', `coupon-3`);

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

    const roundedCorners = Buffer.from(
        `<svg width="575" height="302"><text x="50%" y="50%" font-size="40" text-anchot="middle">${ctx.session.data.couponId}</text></svg>`
    );

    if (coupon == 'coupon-1') {
        const sharpImg =
            sharp('./images/coupon5000.png')
                .composite([{
                    input: roundedCorners,
                }]);
        await ctx.replyWithPhoto(new InputFile(sharpImg));
    } else if (coupon == 'coupon-2') {
        const sharpImg2 =
            sharp('./images/coupon15000.png')
                .composite([{
                    input: roundedCorners,
                }]);
        await ctx.replyWithPhoto(new InputFile(sharpImg2));
    } else if (coupon == 'coupon-3') {

        const sharpImg =
            sharp('./images/coupon5000.png')
                .composite([{
                    input: roundedCorners,
                }]);
        const sharpImg2 =
            sharp('./images/coupon15000.png')
                .composite([{
                    input: roundedCorners,
                }]);
        await ctx.replyWithPhoto(new InputFile(sharpImg));
        await ctx.replyWithPhoto(new InputFile(sharpImg2));
    }

    ctx.session.step = 'final';

    const finalKeyboard = new InlineKeyboard()
        .text('Отправить данные в таблицу 📊📥', `push`).row()
        .text('Отменить и заполнить заново 🔄📝', `again`);


    await ctx.reply(`Данные заполнены ✅ \n \n 💼 ИНН: ${ctx.session.data.inn} \n 📝 ФИО : ${ctx.session.data.fio} \n 🎟️ Купон: ${ctx.session.data.coupon}`, {
        reply_markup: finalKeyboard
    });
});


// Обработка inline кнопок "push" и "again"
bot.callbackQuery('push', async (ctx) => {
    await ctx.answerCallbackQuery();
    await writeToGoogleSheet(ctx.session.data);
    await ctx.reply('Данные успешно отправлены в таблицу! 🚀📊');
    ctx.session.step = 'default';
});

bot.callbackQuery('again', async (ctx) => {
    await ctx.answerCallbackQuery();
    // Сбросить данные из сессии и перейти к первому шагу
    ctx.session.data = {};
    ctx.session.step = 'ask_inn';
    await ctx.reply('Данные сброшены. Пожалуйста, введите ИНН заново. 🔄🔢');
});


const defaultRoute = router.route("default");

defaultRoute.on("message:text", async (ctx) => {
    // Проверяем, является ли сообщение командой
    if (!ctx.message.isCommand && ctx.session.step !== 'ask_inn' && ctx.session.step !== 'ask_fio' && ctx.session.step !== 'coupon') {
        // Если сообщение не является командой и не ожидается ввод данных, отправляем сообщение "Я вас не понимаю"
        await ctx.reply("Я вас не понимаю.");
    }
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