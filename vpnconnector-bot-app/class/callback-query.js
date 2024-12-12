require('dotenv').config();

class CallbackQuery {
    constructor(
        userRegistration,
        settingsService
    ) {
        this._userRegistration = userRegistration;
        this._settingsService = settingsService;
    }

    async actionVpnUserRegistration(ctx) {
        const callbackData = JSON.parse(ctx.callbackQuery.data);
        if (callbackData.action === 'service_invoice') {
            return await this._userRegistration.getInvoice(callbackData.priceType, ctx);
        }

        if (callbackData.action === 'update_service_subscribe') {
            return await this._userRegistration.getInvoiceUpdateSubscribe(callbackData.serviceId, ctx);
        }

        if (callbackData.action === 'subscribe_service') {
            return await this._userRegistration.subscribe(callbackData.serviceId, ctx);
        }

        if (callbackData.action === 'confirm_service_payment') {
            await this._userRegistration.successfulPayment(callbackData.paymentId, ctx);
        }

        if (callbackData.action === 'apply_crypto_transaction') {
            await this._userRegistration.applyCryptoTransaction(callbackData.paymentId, ctx);
        }
    }

    async actionSettingsService(ctx) {
        const callbackData = JSON.parse(ctx.callbackQuery.data);

        if (callbackData.action === 'add_service_vpn') {
            return await this._settingsService.addServiceVpn(ctx);
        }

        if (callbackData.action === 'edit_service_vpn') {
            return await this._settingsService.editServiceVpn(callbackData.serviceId, ctx);
        }

        if (callbackData.action === 'settings_up') {
            return await this._settingsService.settingsUp(callbackData.serviceId, ctx);
        }

        if (callbackData.action === 'settings_payment_card') {
            return await this._settingsService.settingsPaymentCard(ctx);
        }

        if (callbackData.action === 'settings_payment_card_yes') {
            return await this._settingsService.settingsPaymentCard(ctx);
        }

        if (callbackData.action === 'settings_payment_card_no') {
            ctx.session.payment_type_card = 0;
            if (ctx.session?.payment_type_star || ctx.session?.payment_type_crypto) {
                return await this._settingsService.settingsNoSettings(ctx);
            } else {
                await ctx.reply(
                    `🟠 <b>Один из способов, обязательно должен быть настроен!</b>`,
                    { parse_mode: 'HTML' }
                );
                return await this._settingsService.settingsUp(ctx.session.service_id, ctx);
            }
        }

        if (callbackData.action === 'settings_payment_stars') {
            return await this._settingsService.settingsPaymentStars(ctx);
        }

        if (callbackData.action === 'settings_payment_stars_yes') {
            return await this._settingsService.settingsPaymentStars(ctx);
        }

        if (callbackData.action === 'settings_payment_stars_no') {
            ctx.session.payment_type_star = 0;
            if (ctx.session?.payment_type_card || ctx.session?.payment_type_crypto) {
                return await this._settingsService.settingsNoSettings(ctx);
            } else {
                await ctx.reply(
                    `🟠 <b>Один из способов, обязательно должен быть настроен!</b>`,
                    { parse_mode: 'HTML' }
                );
                return await this._settingsService.settingsUp(ctx.session.service_id, ctx);
            }
        }

        if (callbackData.action === 'settings_payment_crypto') {
            return await this._settingsService.settingsWalletCrypto(ctx);
        }

        if (callbackData.action === 'settings_payment_crypto_yes') {
            return await this._settingsService.settingsWalletCrypto(ctx);
        }

        if (callbackData.action === 'settings_payment_crypto_no') {
            ctx.session.payment_type_crypto = 0;
            if (ctx.session?.payment_type_card || ctx.session?.payment_type_star) {
                return await this._settingsService.settingsNoSettings(ctx);
            } else {
                await ctx.reply(
                    `🟠 <b>Один из способов, обязательно должен быть настроен!</b>`,
                    { parse_mode: 'HTML' }
                );
                return await this._settingsService.settingsUp(ctx.session.service_id, ctx);
            }
        }

        if (callbackData.action === 'settings_back') {
            return await this._settingsService.settingsBack(callbackData.step, ctx);
        }
    }
}

module.exports = { CallbackQuery }