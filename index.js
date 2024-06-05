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
    { command: 'referral', description: 'Получить реферальную ссылку' },
]);

const startKeyboard = new Keyboard()
    .text('История заказов')
    .webApp('Сделать заказ', webAppUrlForm)
    .resized();

bot.command('start', async (ctx) => {
    const referralId = ctx.message.text.split(' ')[1];
    if (referralId) {
        const db = await connectToDatabase();
        const collection = db.collection('users');
        const referrer = await collection.findOne({ telegramId: parseInt(referralId, 10) });
        if (referrer) {
            await collection.updateOne(
                { telegramId: referrer.telegramId },
                { $push: { friends: ctx.from.id } }
            );
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

            const friendsCount = user.friends ? user.friends.length : 0;
            ordersText += `Вы привели ${friendsCount} друзей`;

            await ctx.reply(ordersText);
        }
    } catch (error) {
        console.error('Error retrieving orders:', error);
        await ctx.reply('Произошла ошибка при получении списка заказов.');
    }
});

// Handle web app data
bot.on('message:web_app_data', async (ctx) => {
    try {
        const data = JSON.parse(ctx.message.web_app_data.data);
        const phone = data.phone;
        const address = data.address;

        // Генерируем уникальный номер заказа
        const orderId = uuidv4().substring(0, 8);

        // Добавляем статус заказа
        const orderStatus = "В обработке";

        await ctx.reply(`Данные получены:\nТелефон: ${phone}\nАдрес: ${address}\nID заказа: ${orderId}\nСтатус заказа: ${orderStatus}`);

        const db = await connectToDatabase();
        const collection = db.collection('users');

        const user = await collection.findOne({ telegramId: ctx.from.id });
        if (user) {
            // Если пользователь уже существует, добавляем новый заказ в массив orders
            await collection.updateOne(
                { telegramId: ctx.from.id },
                { $push: { orders: { orderId: orderId, status: orderStatus } } }
            );
        } else {
            // Если пользователь новый, создаем запись с массивом orders
            const newUser = {
                telegramId: ctx.from.id,
                phone: phone,
                address: address,
                orders: [
                    {
                        orderId: orderId,
                        status: orderStatus
                    }
                ],
                friends: []
            };
            await collection.insertOne(newUser);
        }

        ctx.reply('Ваши данные сохранены в базе данных.');
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