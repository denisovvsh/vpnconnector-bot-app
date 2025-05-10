require('dotenv').config();
const { Telegraf } = require('telegraf');
const LocalSession = require('telegraf-session-local');
const { VpnconnectorMain } = require('./class/vpnconnector-main');

const localSession = new LocalSession({ database: 'sessions.json' });
const bot = new Telegraf(process.env.BOT_TOKEN);
bot.use(localSession.middleware());

const vpnconnectorMain = new VpnconnectorMain(bot);
vpnconnectorMain.startVpnconnector();

bot.launch();

process.once('SIGINT', () => {
  console.log('Received SIGINT. Stopping bot...');
  bot.stop('SIGINT');
});

process.once('SIGTERM', () => {
  console.log('Received SIGTERM. Stopping bot...');
  bot.stop('SIGTERM');
});