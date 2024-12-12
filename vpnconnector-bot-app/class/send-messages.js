const { Markup } = require('telegraf');
const axios = require('axios');
require('dotenv').config();

class SendMessages {
    constructor(bot, dbRequests, attributes) {
        this._bot = bot;
        this._dbRequests = dbRequests;
        this._attributes = attributes;
        this._axios = axios;
        this._filePath = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}`;
    }

    async sendNotificationsAdministrators(ctx) {
        const action = ctx.session.admin_subscribe ? 'confirm_admin_payment' : 'confirm_service_payment';
        const keyboard = ctx.session.price_type.startsWith('card_price_') || ctx.session.price_type.startsWith('crypto_price_')
            ? [[Markup.button.callback(
                'Подтвердить оплату',
                JSON.stringify({ action: action, paymentId: ctx.session.payment_id })
            )]]
            : [];

        try {
            await this._bot.telegram.sendMessage(
                ctx.session.notification_chat_id,
                await this.formatMessageNewUser(ctx),
                {
                    parse_mode: 'HTML',
                    ...Markup.inlineKeyboard(keyboard)
                }
            );
        } catch (error) {
            await this._bot.telegram.sendMessage(
                process.env.BOT_OWNER_ID,
                await this.formatMessageNewUser(ctx),
                {
                    parse_mode: 'HTML',
                    ...Markup.inlineKeyboard(keyboard)
                }
            );
        }

        if (
            (ctx.session.step == 'confirm_payment_transfer' || ctx.session.step == 'confirm_admin_payment_transfer')
            && ctx.session.confirm_payment_transfer
        ) {
            const messageConfirmPayment = ctx.session.confirm_payment_transfer_message;
            const messageId = messageConfirmPayment.message_id; // ID сообщения, которое нужно переслать
            const chatId = messageConfirmPayment.chat.id; // ID текущего чата

            // Пересылаем сообщение
            try {
                await ctx.forwardMessage(ctx.session.notification_chat_id, chatId, messageId);
            } catch (error) {
                await ctx.forwardMessage(process.env.BOT_OWNER_ID, chatId, messageId)
                    .catch((err) => {
                        console.error('Ошибка при пересылке сообщения:', err);
                    });
            }
        }

        ctx.session = null;
    }

    async formatMessageNewUser(ctx) {
        let phone = await this._attributes.formatPhoneNumber(ctx.session.phone);
        phone = phone
            ? `<a href="tel:${phone}">${phone}</a>`
            : ctx.session.phone;
        let text = '✅ <b>Пользователь завершил формление подписки на VPN!</b>\n\n';
        text += `<b>Имя пользователя:</b> @${ctx.session.username}\n`;
        text += `<b>Имя:</b> ${ctx.session.name}\n`;
        text += `<b>Фамилия:</b> ${ctx.session.surname}\n`;
        text += `<b>Телефон:</b> ${phone}\n`;
        text += `Оплата <b>${ctx.session.price} ${ctx.session.currency}</b>\n`;

        if (ctx.session.price_type.startsWith('card_price_')) {
            text += `\n🔵 Пользователь должен подтвердить оплату скриншотом квитанции - как только он это сделает, я перешлю его вам!\n`;    
        }

        if (ctx.session.price_type.startsWith('crypto_price_')) {
            text += `\n🔵 Пользователь должен подтвердить оплату - нажав на кнопку подтеврждения и вы получите сообщение!\n`;    
        }

        text += `\n🟢 #Подтверждено`;

        return text;
    }

    async sendNotificationsAdministratorsFromUserRegistrationRequest(ctx) {
        try {
            await this._bot.telegram.sendMessage(
                ctx.session.notification_chat_id,
                await this.formatMessageUserRegistrationRequest(ctx),
                { parse_mode: 'HTML' }
            );
        } catch (error) {
            await this._bot.telegram.sendMessage(
                process.env.BOT_OWNER_ID,
                await this.formatMessageUserRegistrationRequest(ctx),
                { parse_mode: 'HTML' }
            );
        }
    }

    async formatMessageUserRegistrationRequest(ctx) {
        let phone = await this._attributes.formatPhoneNumber(ctx.session.phone);
        phone = phone
            ? `<a href="tel:${phone}">${phone}</a>`
            : ctx.session.phone;
        let text = '🟠 <b>Пользователь оформляет подписку на VPN, но еще не подтвердил!</b>\n\n';
        text += `<b>Имя пользователя:</b> @${ctx.session.username}\n`;
        text += `<b>Имя:</b> ${ctx.session.name}\n`;
        text += `<b>Фамилия:</b> ${ctx.session.surname}\n`;
        text += `<b>Телефон:</b> ${phone}\n`;
        text += `Оплата <b>${ctx.session.price} ${ctx.session.currency}</b>\n`;

        text += `\n🟠 #НеПодтверждено`;

        return text;
    }

    async getPriceService(serviceId) {
        let price = '';
        const serviceMeta = await this._dbRequests.getServiceMeta(serviceId);
        if (serviceMeta) {
            const payment_type_card = await serviceMeta.find(meta => meta.meta_key == 'payment_type_card')?.meta_value;
            const payment_type_star = await serviceMeta.find(meta => meta.meta_key == 'payment_type_star')?.meta_value;
            const payment_type_crypto = await serviceMeta.find(meta => meta.meta_key == 'payment_type_crypto')?.meta_value;
            const crypto_currency = await serviceMeta.find(meta => meta.meta_key == 'crypto_currency')?.meta_value;
            const card_price_1 = await serviceMeta.find(meta => meta.meta_key == 'card_price_1')?.meta_value;
            const card_price_6 = await serviceMeta.find(meta => meta.meta_key == 'card_price_6')?.meta_value;
            const card_price_12 = await serviceMeta.find(meta => meta.meta_key == 'card_price_12')?.meta_value;
            const star_price_1 = await serviceMeta.find(meta => meta.meta_key == 'star_price_1')?.meta_value;
            const star_price_6 = await serviceMeta.find(meta => meta.meta_key == 'star_price_6')?.meta_value;
            const star_price_12 = await serviceMeta.find(meta => meta.meta_key == 'star_price_12')?.meta_value;
            const crypto_price_1 = await serviceMeta.find(meta => meta.meta_key == 'crypto_price_1')?.meta_value;
            const crypto_price_6 = await serviceMeta.find(meta => meta.meta_key == 'crypto_price_6')?.meta_value;
            const crypto_price_12 = await serviceMeta.find(meta => meta.meta_key == 'crypto_price_12')?.meta_value;
            if (+payment_type_card) {
                price += `\n💰 Стоимость подписки - переводом на карту:`;
                price += card_price_1 ? `\n🔰 За 1 месяц: ${card_price_1}₽` : '';
                price += card_price_6 ? `\n🔰 За 6 месяцев: ${card_price_6}₽` : '';
                price += card_price_12 ? `\n🔰 За 12 месяцев: ${card_price_12}₽` : '';
            }
            if (+payment_type_star) {
                price += `\n💰 Стоимость подписки - звездами Telegram:`;
                price += star_price_1 ? `\n🔰 За 1 месяц: ${star_price_1}⭐️` : '';
                price += star_price_6 ? `\n🔰 За 6 месяцев: ${star_price_6}⭐️` : '';
                price += star_price_12 ? `\n🔰 За 12 месяцев: ${star_price_12}⭐️` : '';
            }
            if (+payment_type_crypto) {
                price += `\n💰 Стоимость подписки - крипто валютой ${crypto_currency}:`;
                price += crypto_price_1 ? `\n🔰 За 1 месяц: ${crypto_price_1} ${crypto_currency}` : '';
                price += crypto_price_6 ? `\n🔰 За 6 месяцев: ${crypto_price_6} ${crypto_currency}` : '';
                price += crypto_price_12 ? `\n🔰 За 12 месяцев: ${crypto_price_12} ${crypto_currency}` : '';
            }
        }
        return price;
    }

    async sendMessageAboutService(service, ctx) {
        const userTgId = ctx.update?.message?.from.id
            ?? ctx.update?.my_chat_member?.from.id
            ?? ctx.update?.callback_query?.from.id;
        const adminTgId = process.env.BOT_OWNER_ID;
        const entities = service.raw?.caption_entities ?? service.raw?.entities ?? [];
        const sourceText = service.raw?.caption ?? service.raw?.text ?? '';
        const keyboard = [];
        let price = await this.getPriceService(service.id);
        if (price.length > 0) {
            keyboard.push(
                [Markup.button.callback('Оплатить доступ к VPN', JSON.stringify({ action: 'subscribe_service', serviceId: service.id }))]
            );
        }
        if (userTgId == adminTgId) {
            keyboard.push(
                [Markup.button.callback('Настроить стоимость', JSON.stringify({ action: 'settings_up', serviceId: service.id }))]
            );
            keyboard.push(
                [Markup.button.callback('📋 Изменить пост сервиса', JSON.stringify({ action: 'edit_service_vpn', serviceId: service.id }))]
            );
        }

        price = price.length > 0 ? `\n\n${price}` : '\n\n🔴 Не настроена стоимость подписки!'
        const message = `${sourceText}${price}`;
        try {
            const fileId = service.raw.video?.file_id ?? service.raw.photo?.pop().file_id ?? null;
            if (service.raw.photo) {
                await this._bot.telegram.sendPhoto(
                    userTgId,
                    fileId,
                    {
                        caption: message,
                        caption_entities: entities,
                        disable_web_page_preview: true,
                        ...Markup.inlineKeyboard(keyboard)
                    }
                );
            }
            if (service.raw.video) {
                await this._bot.telegram.sendVideo(
                    userTgId,
                    fileId,
                    {
                        caption: message,
                        caption_entities: entities,
                        disable_web_page_preview: true,
                        ...Markup.inlineKeyboard(keyboard)
                    }
                );
            }
            if (!service.raw.photo && !service.raw.video) {
                await this._bot.telegram.sendMessage(
                    userTgId,
                    message,
                    {
                        entities: entities,
                        disable_web_page_preview: true,
                        ...Markup.inlineKeyboard(keyboard)
                    }
                );
            }
        } catch (error) {
            console.error(`Ошибка отправки сообщения пользователю с ID: ${adminTgId}`, error);
        }
    }
}

module.exports = { SendMessages }