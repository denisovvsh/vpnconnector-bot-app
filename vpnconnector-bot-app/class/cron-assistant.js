require('dotenv').config();
const { Markup } = require('telegraf');
const axios = require('axios');

class CronAssistant {
    constructor(bot, dbRequests) {
        this._bot = bot;
        this._dbRequests = dbRequests;
        this._axios = axios;
        this._wireguardClientPath = 'http://88.210.3.140:51821/api/wireguard/client';
    }

    async kickUser() {
        try {
            const billingRows = await this._dbRequests.getBillingByExpired();
            if (!billingRows) return;

            const headers = { 'Content-Type': 'application/json' };
            const clients = await this._axios.get(this._wireguardClientPath, { headers });

            for (let billingRow of billingRows) {
                const serviceMeta = await this._dbRequests.getServiceMeta(billingRow.service_id);
                if (!serviceMeta) continue;
                const notificationChatId = serviceMeta ? await serviceMeta.find(meta => meta.meta_key == 'notification_chat_id')?.meta_value : null;
                if (!notificationChatId) continue;

                let client = clients.data.length > 0
                    ? await clients.data.filter(client => client.name == "tg_client_" + billingRow.user_tg_id)
                    : false;

                if (client.length == 0) continue;

                for (let item of client) {
                    try {
                        await this._axios.delete(`${this._wireguardClientPath}/${item.id}`, { headers });
                        const dataBilling = {
                            user_id: billingRow.user_id,
                            service_id: billingRow.service_id,
                            status: 0,
                            date_from: billingRow.date_from,
                            date_to: billingRow.date_to
                        };
                        await this._dbRequests.updateOrInsertBilling(dataBilling);

                        await this._bot.telegram.sendMessage(
                            billingRow.user_tg_id,
                            `🟠 Ваш аккаунт удален с сервера VPN`
                            + `\n<blockquote><b>Закончилась подписка!</b></blockquote>`
                            + `\n<blockquote><b>Чтобы возобновить подписку на VPN нажмите /my_vpn</b></blockquote>`,
                            { parse_mode: 'HTML' }
                        );

                        await this._bot.telegram.sendMessage(
                            notificationChatId,
                            `🟠 Пользователь @${billingRow.username} удален с сервера VPN`
                            + `\n<blockquote><b>Закончилась подписка!</b></blockquote>`,
                            { parse_mode: 'HTML' }
                        );
                    } catch (error) {
                        console.error('Ошибка при удалении VPN аккаунта:', error);
                    }
                }
            }
        } catch (error) {
            console.error('Ошибка при отключении пользователя от VPN', error);
        }
    }

    async checkUserSubscribe() {
        try {
            const billingRows = await this._dbRequests.getBillingByOneMoreDay();
            if (!billingRows) return;
            for (let billingRow of billingRows) {
                const keyboard = [
                    [
                        Markup.button.callback(
                            'Продлить подписку',
                            JSON.stringify({ action: 'update_service_subscribe', serviceId: billingRow.service_id })
                        )
                    ]
                ];
                await this._bot.telegram.sendMessage(
                    item.user_tg_id,
                    `🟠 Заканчивается подписка на VPN`
                    + `\n<blockquote>Действительна до <b>${billingRow.billing_date_to}</b></blockquote>`,
                    {
                        parse_mode: 'HTML',
                        ...Markup.inlineKeyboard(keyboard)
                    }
                );
            }
        } catch (error) {
            console.error('Ошибка при проверке подписки пользователей на VPN:', error);
        }
    }
}

module.exports = { CronAssistant };