require('dotenv').config();

class Steps {
    constructor(
        bot,
        dbRequests,
        userRegistration,
        sendMessages,
        attributes
    ) {
        this._bot = bot;
        this._dbRequests = dbRequests;
        this._userRegistration = userRegistration;
        this._sendMessages = sendMessages;
        this._attributes = attributes;
    }

    async actionAdminPayment(ctx) {
        const step = ctx.session.step;

        if (!step) return;

        if (step == 'confirm_admin_payment_transfer') {
            if (ctx.update.message.photo || ctx.update.message.document) {
                ctx.session.fromId = ctx.update.message.from.id;
                ctx.session.confirm_payment_transfer = true;
                ctx.session.confirm_payment_transfer_message = ctx.update.message;
                await this._sendMessages.sendNotificationsAdministrators(ctx);
            } else {
                return await ctx.reply(
                    '🟠 <b>Ожидается картинка или документ подтверждающий оплату!</b>',
                    { parse_mode: 'HTML' }
                );
            }
        }
    }

    async actionUserRegistration(ctx) {
        const step = ctx.session.step;

        if (!step) return;

        // если пользователь сам отправит номер телефона без кнопки
        if (step == 'contact') {
            const cleanPhoneNumber = await this._attributes.formatPhoneNumberWithoutPlus(ctx.message.text);
            if (!cleanPhoneNumber) {
                return await ctx.reply(
                    `🟠 <b>Неправильный формат номера телефона!</b><blockquote>Пример <b>79001231212</b></blockquote>`,
                    { parse_mode: 'HTML' }
                );
            }

            ctx.session.phone = cleanPhoneNumber;

            await this._userRegistration.contact(ctx);
        }

        if (step == 'confirm_payment_transfer') {
            if (ctx.update.message.photo || ctx.update.message.document) {
                ctx.session.fromId = ctx.update.message.from.id;
                ctx.session.confirm_payment_transfer = true;
                ctx.session.confirm_payment_transfer_message = ctx.update.message;
                await this._sendMessages.sendNotificationsAdministrators(ctx);
            } else {
                return await ctx.reply(
                    '🟠 <b>Ожидается картинка или документ подтверждающий оплату!</b>',
                    { parse_mode: 'HTML' }
                );
            }
        }

        return;
    }
}

module.exports = { Steps }