require('dotenv').config();
const { CronJob } = require('cron');
const { DbRequests } = require('./db-requests');
const { Attributes } = require('./attributes');
const { SendMessages } = require('./send-messages');
const { UserRegistration } = require('./user-registration');
const { CallbackQuery } = require('./callback-query');
const { Steps } = require('./steps');
const { CronAssistant } = require('./cron-assistant');

class VpnconnectorMain {
    constructor(bot) {
        this._bot = bot;
    }

    async startVpnconnector() {
        const dbRequests = new DbRequests(process.env.BOT_ID);
        const attributes = new Attributes(this._bot);
        const sendMessages = new SendMessages(this._bot, dbRequests, attributes);
        const userRegistration = new UserRegistration(this._bot, dbRequests, sendMessages, attributes);
        const callbackQuery = new CallbackQuery(userRegistration);
        const steps = new Steps(this._bot, dbRequests, userRegistration, sendMessages, attributes);
        const cronAssistant = new CronAssistant(this._bot, dbRequests);

        this._bot.use(async (ctx, next) => {
            if (!ctx.session) ctx.session = {};
            if (
                ctx.session?.timestamp
                && (Math.floor(Date.now() / 1000) - ctx.session.timestamp) > 3600
            ) {
                ctx.session = null;
                console.log(`Очищаем сессию, если прошло больше часа для пользователя ${ctx.from.id}`);
            }
            if (!ctx.session?.timestamp) ctx.session.timestamp = Math.floor(Date.now() / 1000);
            return next();
        });

        this._bot.start(async (ctx, next) => {
            if (ctx.from.id != ctx.chat.id || ctx.from.is_bot) return next();
            userRegistration.signUp(ctx);
            return next();
        });

        this._bot.help(async (ctx, next) => {
            if (ctx.from.id != ctx.chat.id || ctx.from.is_bot) return next();
            userRegistration.signUp(ctx);
            console.log('BotInfo:');
            console.log(ctx.botInfo);
            return next();
        });

        this._bot.command('my_vpn', async (ctx, next) => {
            if (ctx.from.id != ctx.chat.id || ctx.from.is_bot) return next();
            userRegistration.signUp(ctx);
            return;
        });

        this._bot.on('contact', async (ctx, next) => {
            if (ctx.from.id != ctx.chat.id || ctx.from.is_bot) return next();
            if (ctx.session?.srvice) {
                await userRegistration.contact(ctx);
            }
            return next();
        });

        this._bot.on('callback_query', async (ctx, next) => {
            await callbackQuery.actionVpnUserRegistration(ctx);
            return next();
        });

        this._bot.on('message', async (ctx, next) => {
            if (ctx.from.id != ctx.chat.id || ctx.from.is_bot) return next();
            if (ctx.session.step && ctx.session?.srvice) {
                await steps.actionAdminPayment(ctx);
                await steps.actionUserRegistration(ctx);
            }

            if (ctx.update && ctx.update.message.successful_payment != undefined) {
                ctx.session.successful_payment = ctx.update.message.successful_payment;
                await userRegistration.successfulPayment(ctx.session.payment_id, ctx);
                await sendMessages.sendNotificationsAdministrators(ctx);
            }
            return next();
        });

        const botJob = new CronJob('0 */8 * * *', async () => {
            cronAssistant.kickUser();
            cronAssistant.checkUserSubscribe();
            console.log('Проверка актуальности подписки VPN', await attributes.getDateWithMonthsOffset());
        });

        botJob.start();

        process.once('SIGINT', () => {
            botJob.stop();
        });

        process.once('SIGTERM', () => {
            botJob.stop();
        });
    };
}

module.exports = { VpnconnectorMain }