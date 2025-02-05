require('dotenv').config();
const { CronJob } = require('cron');
const { DbRequests } = require('./db-requests');
const { Attributes } = require('./attributes');
const { SendMessages } = require('./send-messages');
const { UserRegistration } = require('./user-registration');
const { SettingsService } = require('./settings-service');
const { CallbackQuery } = require('./callback-query');
const { Steps } = require('./steps');
const { CronAssistant } = require('./cron-assistant');
const { XRay } = require('./x-ray');
const { Referral } = require('./referral');
const { Reports } = require('./reports');

class VpnconnectorMain {
    constructor(bot) {
        this._bot = bot;
    }

    async startVpnconnector() {
        const dbRequests = new DbRequests(process.env.BOT_ID);
        const attributes = new Attributes(this._bot);
        const xRay = new XRay();
        const referral = new Referral(this._bot, dbRequests);
        const reports = new Reports(dbRequests);
        const sendMessages = new SendMessages(this._bot, dbRequests, attributes);
        const userRegistration = new UserRegistration(this._bot, dbRequests, sendMessages, xRay, attributes);
        const settingsService = new SettingsService(this._bot, dbRequests, sendMessages);
        const callbackQuery = new CallbackQuery(userRegistration, settingsService);
        const steps = new Steps(this._bot, dbRequests, userRegistration, sendMessages, settingsService, attributes);
        const cronAssistant = new CronAssistant(this._bot, xRay, dbRequests);

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
            ctx.session = null;
            await ctx.reply(
                `👋 <b>Привет!</b>`,
                {
                    parse_mode: 'HTML',
                    reply_markup: {
                        remove_keyboard: true
                    }
                }
            );
            userRegistration.signUp(ctx);
            return next();
        });

        this._bot.help(async (ctx, next) => {
            if (ctx.from.id != ctx.chat.id || ctx.from.is_bot) return next();
            ctx.session = null;
            userRegistration.signUp(ctx);
            console.log('BotInfo:', ctx.botInfo);
            return next();
        });

        this._bot.command('my_vpn', async (ctx, next) => {
            if (ctx.from.id != ctx.chat.id || ctx.from.is_bot) return next();
            ctx.session = null;
            userRegistration.signUp(ctx);
            return;
        });

        this._bot.command('referral', async (ctx, next) => {
            if (ctx.from.id != ctx.chat.id || ctx.from.is_bot) return next();
            await referral.getReferralLink(ctx);
            return;
        });

        this._bot.command('users', async (ctx) => {
            if (ctx.from.id != ctx.chat.id || ctx.from.is_bot) return;
            if (ctx.from.id != process.env.BOT_OWNER_ID) {
                return await ctx.reply('🟠 У вас нет прав для получения отчета!');
            }

            try {
                const filePath = await reports.generateUsers(ctx);
                if (!filePath) {
                    return await ctx.reply('🟠 Записей не обнаружено!');
                } else {
                    return await ctx.replyWithDocument({ source: filePath });
                }
            } catch (error) {
                console.error('Error generating report:', error);
            }
        });

        this._bot.command('report', async (ctx) => {
            if (ctx.from.id != ctx.chat.id || ctx.from.is_bot) return;
            try {
                let filePath = null;
                if (ctx.from.id == process.env.BOT_OWNER_ID) {
                    filePath = await reports.generateListReferralLeadsByAdmin(ctx);
                } else {
                    filePath = await reports.generateListReferralLeadsByReferal(ctx);
                }

                if (!filePath) {
                    return await ctx.reply('🟠 Записей не обнаружено!');
                } else {
                    return await ctx.replyWithDocument({ source: filePath });
                }
            } catch (error) {
                console.error('Error generating report:', error);
            }
        });

        this._bot.on('contact', async (ctx, next) => {
            if (ctx.from.id != ctx.chat.id || ctx.from.is_bot) return next();
            await userRegistration.contact(ctx);
            return next();
        });

        this._bot.on('callback_query', async (ctx, next) => {
            await callbackQuery.actionSettingsService(ctx);
            await callbackQuery.actionVpnUserRegistration(ctx);
            return next();
        });

        this._bot.on('message', async (ctx, next) => {
            if (ctx.from.id != ctx.chat.id || ctx.from.is_bot) return next();
            if (ctx.session.step) {
                await steps.actionSettingsService(ctx);
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
            cronAssistant.kickXrayUser();
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