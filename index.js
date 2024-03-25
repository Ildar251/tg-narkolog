require('dotenv').config()
const {Bot} = require('grammy')

const bot = new Bot(process.env.BOT_API_KEY);

bot.command('start', async (ctx) => {
    await ctx.reply(`Привет!`)
})

bot.on('massage', async (ctx) => {
    await ctx.reply('Надо подумать')
})

bot.start();