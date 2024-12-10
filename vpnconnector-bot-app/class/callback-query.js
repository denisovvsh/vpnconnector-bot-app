require('dotenv').config();

class CallbackQuery {
    constructor(
        userRegistration,
    ) {
        this._userRegistration = userRegistration;
    }

    async actionVpnUserRegistration(ctx) {
        const callbackData = JSON.parse(ctx.callbackQuery.data);
        if (callbackData.action === 'service_invoice') {
            return await this._userRegistration.getInvoice(callbackData.priceType, ctx);
        }

        if (callbackData.action === 'update_service_subscribe') {
            return await this._userRegistration.getInvoiceUpdateSubscribe(callbackData.chatId, ctx);
        }

        if (callbackData.action === 'subscribe_service') {
            return await this._userRegistration.subscribe(callbackData.chatId, ctx);
        }

        if (callbackData.action === 'confirm_service_payment') {
            await this._userRegistration.successfulPayment(callbackData.paymentId, ctx);
        }
    }
}

module.exports = { CallbackQuery }