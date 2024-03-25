require('dotenv').config()
const { Bot, GrammyError, HttpError, Keyboard } = require('grammy')

const bot = new Bot(process.env.BOT_API_KEY);



bot.api.setMyCommands([
    {
        command: 'start', description: "Стартуем"
    },
    {
        command: 'generate', description: "Сгенерировать купон"
    },
    {
        command: 'mood', description: "asfasf"
    }
])

bot.command('start', async (ctx) => {
    await ctx.reply(`Привет!`)
})

bot.command('generate', async (ctx) => {
    const moodKeyboard = new Keyboard().text(
        'Ввести ИНН',
        JSON.stringify({
            type: ctx.message.text,
            queId: 1,
        })
    ).text(
        'Ввести ФИО',
        JSON.stringify({
            type: ctx.message.text,
            queId: 2,
        })
    ).resized()
    await ctx.reply(`Давай сгенерируем купон`, {
        reply_markup: moodKeyboard
    })
})


bot.on('message', async (ctx) => {
    await ctx.reply('Надо подумать')
})


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

bot.start();