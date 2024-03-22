
const TelegramApi = require('node-telegram-bot-api')

const token = '5319638653:AAE1IEol5Eugaydsk8fZxgc0NWyfrpmORpY'


const bot = new TelegramApi(token, {polling: true})

bot.on('message', async msg => {
    const first_name = msg.from.first_name
    const text = msg.text
    const chatId = msg.chat.id 

    await bot.sendMessage(chatId, `Привет, ${first_name}`)
})