require('dotenv').config();
const express = require('express');
const connectToDatabase = require('./db');
const cors = require('cors'); 
const { Bot } = require('grammy');


const app = express();
const PORT = process.env.PORT || 5001;

const bot = new Bot(process.env.BOT_API_KEY);

app.use(cors());
app.use(express.json());

app.get('/api/orders', async (req, res) => {
    try {
        const db = await connectToDatabase();
        const collection = db.collection('users');
        const orders = await collection.find({}).toArray();
        res.json(orders);
    } catch (error) {
        console.error('Error retrieving orders:', error);
        res.status(500).json({ error: 'Failed to retrieve orders' });
    }
});

app.post('/api/orders/update-status', async (req, res) => {
    const { telegramId, orderId, newStatus } = req.body;
    try {
        const db = await connectToDatabase();
        const collection = db.collection('users');

        const user = await collection.findOne({ telegramId: telegramId });

        if (!user) {
            return res.status(404).send('Пользователь не найден');
        }

        // Обновляем статус заказа
        const updateResult = await collection.updateOne(
            { telegramId: telegramId, 'orders.orderId': orderId },
            { $set: { 'orders.$.status': newStatus } }
        );

        if (updateResult.modifiedCount === 0) {
            return res.status(404).send('Заказ не найден');
        }

        if (newStatus === 'Выполнен' && user.referrerId) {
            const referrer = await collection.findOne({ telegramId: user.referrerId });

            if (referrer && !referrer.friends.includes(telegramId)) {
                await collection.updateOne(
                    { telegramId: user.referrerId },
                    { $push: { friends: telegramId } }
                );

                // Отправляем уведомление через Telegram API
                const message = `По вашей реферальной ссылке ${user.userName || 'пользователь'} сделал заказ, который был выполнен!`;
                await bot.api.sendMessage(referrer.telegramId, message);
            }
        }

        res.status(200).send('Статус заказа обновлен');
    } catch (error) {
        console.error('Ошибка при обновлении статуса заказа:', error);
        res.status(500).send('Ошибка при обновлении статуса заказа');
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});