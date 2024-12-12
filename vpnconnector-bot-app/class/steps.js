require('dotenv').config();

class Steps {
    constructor(
        bot,
        dbRequests,
        userRegistration,
        sendMessages,
        settingsService,
        attributes
    ) {
        this._bot = bot;
        this._dbRequests = dbRequests;
        this._userRegistration = userRegistration;
        this._sendMessages = sendMessages;
        this._settingsService = settingsService;
        this._attributes = attributes;
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

    async actionSettingsService(ctx) {
        const step = ctx.session.step;

        if (!step) return;

        if (step == 'add_service_vpn') {
            await this._settingsService.sendService(ctx);
            ctx.session = null;
        }

        if (step == 'edit_service_vpn') {
            const serviceId = ctx.session.service_id ?? null;
            await this._settingsService.sendService(ctx, serviceId);
            ctx.session = null;
        }

        if (step == 'settings_card_number') {
            const inputText = ctx.message.text.trim();
            const cardNumberRegex = /^[0-9]{13,19}$/;
            const phoneNumberRegex = /^[0-9]{11}$/;

            if (phoneNumberRegex.test(inputText) || cardNumberRegex.test(inputText)) {
                ctx.session.payment_number = +inputText;
            } else {
                return await ctx.reply(
                    '🟠 <b>Пожалуйста, введите корректный номер банковской карты или номер телефона без +, начиная с 7.</b>',
                    { parse_mode: 'HTML' }
                );
            }

            return await this._settingsService.settingsBankName(ctx);
        }

        if (step == 'settings_bank_name') {
            ctx.session.bank_name = ctx.message.text.trim();
            return await this._settingsService.settingsReceiverName(ctx);
        }

        if (step == 'settings_receiver_name') {
            ctx.session.receiver_name = ctx.message.text.trim();
            return await this._settingsService.settingsCardPrice1(ctx);
        }

        if (step == 'settings_card_price_1') {
            const inputText = ctx.message.text.trim();
            if (isNaN(inputText) || +inputText == 0) return await ctx.reply(
                '🟠 <b>Настройка параметров оплаты за подписку:</b>\n<blockquote><b>Пожалуйста, введите число больше 0.</b></blockquote>',
                { parse_mode: 'HTML' }
            );
            ctx.session.card_price_1 = +inputText;
            return await this._settingsService.settingsCardPrice6(ctx);
        }

        if (step == 'settings_card_price_6') {
            const inputText = ctx.message.text.trim();
            if (isNaN(inputText) || +inputText == 0) return await ctx.reply(
                '🟠 <b>Настройка параметров оплаты за подписку:</b>\n<blockquote><b>Пожалуйста, введите число больше 0.</b></blockquote>',
                { parse_mode: 'HTML' }
            );
            ctx.session.card_price_6 = +inputText;
            return await this._settingsService.settingsCardPrice12(ctx);
        }

        if (step == 'settings_card_price_12') {
            const inputText = ctx.message.text.trim();
            if (isNaN(inputText) || +inputText == 0) return await ctx.reply(
                '🟠 <b>Настройка параметров оплаты за подписку:</b>\n<blockquote><b>Пожалуйста, введите число больше 0.</b></blockquote>',
                { parse_mode: 'HTML' }
            );
            ctx.session.card_price_12 = +inputText;
            if (!+ctx.session?.payment_type_star) {
                return await this._settingsService.settingsAskPaymentStars(ctx);
            } else if (!+ctx.session?.payment_type_crypto) {
                return await this._settingsService.settingsAskPaymentCrypto(ctx);
            } else {
                return await this._settingsService.settingsNoSettings(ctx);
            }
        }

        if (step == 'settings_star_price_1') {
            const inputText = ctx.message.text.trim();
            if (isNaN(inputText) || +inputText == 0) return await ctx.reply(
                '🟠 <b>Настройка параметров оплаты за подписку:</b>\n<blockquote><b>Пожалуйста, введите число больше 0.</b></blockquote>',
                { parse_mode: 'HTML' }
            );
            ctx.session.star_price_1 = +inputText;
            return await this._settingsService.settingsStarPrice6(ctx);
        }

        if (step == 'settings_star_price_6') {
            const inputText = ctx.message.text.trim();
            if (isNaN(inputText) || +inputText == 0) return await ctx.reply(
                '🟠 <b>Настройка параметров оплаты за подписку:</b>\n<blockquote><b>Пожалуйста, введите число больше 0.</b></blockquote>',
                { parse_mode: 'HTML' }
            );
            ctx.session.star_price_6 = +inputText;
            return await this._settingsService.settingsStarPrice12(ctx);
        }

        if (step == 'settings_star_price_12') {
            const inputText = ctx.message.text.trim();
            if (isNaN(inputText) || +inputText == 0) return await ctx.reply(
                '🟠 <b>Настройка параметров оплаты за подписку:</b>\n<blockquote><b>Пожалуйста, введите число больше 0.</b></blockquote>',
                { parse_mode: 'HTML' }
            );
            ctx.session.star_price_12 = +inputText;
            if (!+ctx.session?.payment_type_card) {
                return await this._settingsService.settingsAskPaymentCard(ctx);
            } else if (!+ctx.session?.payment_type_crypto) {
                return await this._settingsService.settingsAskPaymentCrypto(ctx);
            } else {
                return await this._settingsService.settingsNoSettings(ctx);
            }
        }

        if (step == 'settings_crypto_wallet') {
            ctx.session.crypto_wallet = ctx.message.text.trim();
            return await this._settingsService.settingsСurrencyCrypto(ctx);
        }

        if (step == 'settings_crypto_currency') {
            ctx.session.crypto_currency = ctx.message.text.trim();
            return await this._settingsService.settingsNetworkCrypto(ctx);
        }

        if (step == 'settings_crypto_network') {
            ctx.session.crypto_network = ctx.message.text.trim();
            return await this._settingsService.settingsCryptoPrice1(ctx);
        }

        if (step == 'settings_crypto_price_1') {
            const inputText = ctx.message.text.trim();
            if (isNaN(inputText) || +inputText == 0) return await ctx.reply(
                '🟠 <b>Настройка параметров оплаты за подписку:</b>\n<blockquote><b>Пожалуйста, введите число больше 0.</b></blockquote>',
                { parse_mode: 'HTML' }
            );
            ctx.session.crypto_price_1 = +inputText;
            return await this._settingsService.settingsCryptoPrice6(ctx);
        }

        if (step == 'settings_crypto_price_6') {
            const inputText = ctx.message.text.trim();
            if (isNaN(inputText) || +inputText == 0) return await ctx.reply(
                '🟠 <b>Настройка параметров оплаты за подписку:</b>\n<blockquote><b>Пожалуйста, введите число больше 0.</b></blockquote>',
                { parse_mode: 'HTML' }
            );
            ctx.session.crypto_price_6 = +inputText;
            return await this._settingsService.settingsCryptoPrice12(ctx);
        }

        if (step == 'settings_crypto_price_12') {
            const inputText = ctx.message.text.trim();
            if (isNaN(inputText) || +inputText == 0) return await ctx.reply(
                '🟠 <b>Настройка параметров оплаты за подписку:</b>\n<blockquote><b>Пожалуйста, введите число больше 0.</b></blockquote>',
                { parse_mode: 'HTML' }
            );
            ctx.session.crypto_price_12 = +inputText;
            if (!+ctx.session?.payment_type_star) {
                return await this._settingsService.settingsAskPaymentStars(ctx);
            } else if (!+ctx.session?.payment_type_card) {
                return await this._settingsService.settingsAskPaymentCard(ctx);
            } else {
                return await this._settingsService.settingsNoSettings(ctx);
            }
        }

        return;
    }
}

module.exports = { Steps }