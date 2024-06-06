require('dotenv').config();
const { v4: uuidv4 } = require('uuid');
const connectToDatabase = require('./db');
const { Bot, GrammyError, HttpError, Keyboard, InlineKeyboard, session, InputFile } = require('grammy');
const { Router } = require("@grammyjs/router");

const bot = new Bot(process.env.BOT_API_KEY);

const router = new Router((ctx) => ctx.session.step);

const webAppUrlForm = 'https://munoucuchol.beget.app/';
const webAppUrlManager = 'https://munoucuchol.beget.app/manager';

// Количество заказов до подарка
const ORDERS_FOR_GIFT = 5;

bot.use(session({ initial: () => ({ step: 'default', data: {} }) }));

bot.api.setMyCommands([
    { command: 'start', description: 'Запуск бота' },
]);

const startKeyboard = new Keyboard()
    .text('История заказов')
    .webApp('Сделать заказ', webAppUrlForm).row()
    .text('Скидки за друзей')
    .resized();

    bot.command('start', async (ctx) => {
        const referralId = ctx.message.text.split(' ')[1];
        const db = await connectToDatabase();
        const collection = db.collection('users');
    
        if (referralId && referralId !== ctx.from.id.toString()) {
            const referrer = await collection.findOne({ telegramId: parseInt(referralId, 10) });
            const user = await collection.findOne({ telegramId: ctx.from.id });
    
            if (referrer && (!user || !user.referrerId)) {
                if (user) {
                    await collection.updateOne(
                        { telegramId: ctx.from.id },
                        { $set: { referrerId: referrer.telegramId } }
                    );
                } else {
                    await collection.insertOne({
                        telegramId: ctx.from.id,
                        referrerId: referrer.telegramId,
                        orders: [],
                        friends: [],
                    });
                }
            }
        }


    await ctx.reply(`💥💥💥РЕФЕРАЛЬНАЯ ПРОГРАММА💥💥💥
    Всем подписчикам мы предлагаем участие в реферальной программе
    - Первый вызов скидка 15%
    - Каждый пятый вызов бесплатно!
    - Каждый шестой вызов скидка 15%
     
    Уважаемые подписчики и посетители канала - мы создали данный ресурс для удобства заказа наркологических услуг на дом
    - Нарколог на дом приедет к вам за 40 минут вы можете написать нам в чат или же позвонить по номеру 
    
    ☎️ 8 918 677-64-93
    💬 Чат с наркологом @telegramchatr
    
    Условие - нужно быть подписанным на канал и обратиться в чат с заказом. Все обращения фиксируются и вы получаете свои скидки и бонусы.
    
    Пригласи друга - если человек подпишется на канал и закажет у нас услугу то вы получите 25% скидку на следующий вызов! Приходите, будет интересно
    
    📌`, {
        reply_markup: startKeyboard
    });
});

bot.command('referral', async (ctx) => {
    const referralLink = `https://t.me/narkologKrasnodar_bot?start=${ctx.from.id}`;
    await ctx.reply(`Ваша реферальная ссылка: ${referralLink}`);
});

bot.command('manager', async (ctx) => {
    await ctx.reply('Добро пожаловать в меню управления заказами!', {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: 'Управлять заказами',
                web_app: { url: webAppUrlManager }
              }
            ]
          ]
        }
      });
});

bot.hears('Скидки за друзей', async (ctx) => {
    try {
        const db = await connectToDatabase();
        const collection = db.collection('users');
        const user = await collection.findOne({ telegramId: ctx.from.id });

        const referralLink = `https://t.me/narkologKrasnodar_bot?start=${ctx.from.id}`;
        const friendsCount = user && user.friends ? user.friends.length : 0;

        await ctx.reply(`Ваша реферальная ссылка: ${referralLink}\n\nВы привели друзей: ${friendsCount}`);
    } catch (error) {
        console.error('Error retrieving referral data:', error);
        await ctx.reply('Произошла ошибка при получении данных реферальной программы.');
    }
})

bot.hears('История заказов', async (ctx) => {
    try {
        const db = await connectToDatabase();
        const collection = db.collection('users');
        const user = await collection.findOne({ telegramId: ctx.from.id });

        if (!user || !user.orders || user.orders.length === 0) {
            await ctx.reply("У вас пока нет заказов.");
        } else {
            let ordersText = "Ваши заказы:\n\n";
            user.orders.forEach((order, index) => {
                let statusSymbol;
                if (order.status === "В обработке") {
                    statusSymbol = '🟡';
                } else if (order.status === "Отменен") {
                    statusSymbol = '🔴';
                } else {
                    statusSymbol = '🟢';
                }
                ordersText += `${index + 1}. Заказ №: ${order.orderId},\n    Статус: ${statusSymbol} ${order.status}\n\n`;
            });
            const remainingOrders = ORDERS_FOR_GIFT - user.orders.filter(order => order.status === "Выполнен").length;
            if (remainingOrders > 0) {
                ordersText += `Заказов до подарка: ${remainingOrders}\n`;
            } else {
                ordersText += `Поздравляем! Вы получили подарок!\n`;
            }

            await ctx.reply(ordersText);
        }
    } catch (error) {
        console.error('Error retrieving orders:', error);
        await ctx.reply('Произошла ошибка при получении списка заказов.');
    }
});

bot.on('message:web_app_data', async (ctx) => {
    try {
        const data = JSON.parse(ctx.message.web_app_data.data);
        const phone = data.phone;
        const address = data.address;

        // Генерация уникального номера заказа
        const orderId = uuidv4().substring(0, 8);
        const orderStatus = "В обработке";

        const message = `
<b>Данные получены:</b>
📞 <b>Телефон:</b> ${phone}
📍 <b>Адрес:</b> ${address}
🆔 <b>ID заказа:</b> ${orderId}
📦 <b>Статус заказа:</b> ${orderStatus === 'В обработке' ? '🟡 В обработке' : orderStatus === 'Отменен' ? '🔴 Отменен' : '🟢 Выполнен'}
`;

        await ctx.reply(message, { parse_mode: 'HTML' });

        const db = await connectToDatabase();
        const collection = db.collection('users');

        const user = await collection.findOne({ telegramId: ctx.from.id });
        if (user) {
            await collection.updateOne(
                { telegramId: ctx.from.id },
                { $push: { orders: { orderId: orderId, status: orderStatus } } }
            );
        } else {
            const newUser = {
                telegramId: ctx.from.id,
                userName: ctx.from.username, 
                phone: phone,
                address: address,
                orders: [
                    { orderId: orderId, status: orderStatus }
                ],
                friends: [],
                referrerId: referrerId ? parseInt(referrerId, 10) : null // Сохраняем ID реферера
            };
            await collection.insertOne(newUser);
        }
    } catch (error) {
        console.error('Error parsing web app data:', error);
        await ctx.reply('Произошла ошибка при обработке данных.');
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