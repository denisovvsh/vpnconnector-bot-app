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
        const keyboard = ctx.session.price_type.startsWith('card_price_')
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
        text += `Оплата <b>${ctx.session.price}${ctx.session.currency}</b>\n`;

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
        text += `Оплата <b>${ctx.session.price}${ctx.session.currency}</b>\n`;

        text += `\n🟠 #НеПодтверждено`;

        return text;
    }

    async sendMessageAboutChat(chat, chatMeta, admin, ctx) {
        const userTgId = ctx.update?.message?.from.id
            ?? ctx.update?.my_chat_member?.from.id
            ?? ctx.update?.callback_query?.from.id;
        const adminTgId = admin?.user?.id ?? admin.user_tg_id;
        const card_price_1 = chatMeta ? await chatMeta.find(meta => meta.meta_key == 'card_price_1')?.meta_value : 0;
        const card_price_6 = chatMeta ? await chatMeta.find(meta => meta.meta_key == 'card_price_6')?.meta_value : 0;
        const card_price_12 = chatMeta ? await chatMeta.find(meta => meta.meta_key == 'card_price_12')?.meta_value : 0;
        const star_price_1 = chatMeta ? await chatMeta.find(meta => meta.meta_key == 'star_price_1')?.meta_value : 0;
        const star_price_6 = chatMeta ? await chatMeta.find(meta => meta.meta_key == 'star_price_6')?.meta_value : 0;
        const star_price_12 = chatMeta ? await chatMeta.find(meta => meta.meta_key == 'star_price_12')?.meta_value : 0;
        let chatInfo = null;
        try {
            chatInfo = await this._bot.telegram.getChat(chat.chat_tg_id);
        } catch (error) {
            return await ctx.telegram.sendMessage(
                userTgId,
                `🔴 <b>Чат/Канал сервиса VPN не найден!</b>`
                + `<blockquote>Возможно бот исключен из Чата/Канала!</blockquote>`,
                { parse_mode: 'HTML' }
            );
        }
        const title = chatInfo?.title ? `🔰 <b>${chatInfo.title}</b>` : '';
        const description = chatInfo?.description ? `\n<blockquote>${chatInfo.description}</blockquote>` : '';
        let price = '';
        price += card_price_1 ? `\n<blockquote>За 1 месяц: <b>${card_price_1}₽</b></blockquote>` : '';
        price += card_price_6 ? `\n<blockquote>За 6 месяцев: <b>${card_price_6}₽</b></blockquote>` : '';
        price += card_price_12 ? `\n<blockquote>За 12 месяцев: <b>${card_price_12}₽</b></blockquote>` : '';
        price += star_price_1 ? `\n<blockquote>За 1 месяц: <b>${star_price_1}⭐️</b></blockquote>` : '';
        price += star_price_6 ? `\n<blockquote>За 6 месяцев: <b>${star_price_6}⭐️</b></blockquote>` : '';
        price += star_price_12 ? `\n<blockquote>За 12 месяцев: <b>${star_price_12}⭐️</b></blockquote>` : '';
        price = price.length > 0 ? `\n\n<b>Стоимость подписки:</b>${price}` : '';
        const message = `${title}${description}${price}`;

        const keyboard = [];

        if (price.length > 0) {
            keyboard.push([Markup.button.callback('Оплатить доступ к VPN', JSON.stringify({ action: 'subscribe_service', chatId: chat.id }))]);
        }
        if (userTgId == adminTgId) {
            keyboard.push([Markup.button.callback('Настроить стоимость', JSON.stringify({ action: 'settings_up', chatId: chat.id }))]);
        }
        if (chatInfo.photo) {
            const fileId = chatInfo.photo.big_file_id;
            const file = await this._bot.telegram.getFile(fileId);
            const filePath = file.file_path;

            // Получение файла с использованием axios
            const response = await this._axios.get(
                `${this._filePath}/${filePath}`,
                { responseType: 'stream' }
            );

            await ctx.telegram.sendPhoto(
                userTgId,
                { source: response.data },
                {
                    caption: message,
                    parse_mode: 'HTML',
                    ...Markup.inlineKeyboard(keyboard)
                },
            );
        } else {
            await ctx.telegram.sendMessage(
                userTgId,
                message,
                {
                    parse_mode: 'HTML',
                    ...Markup.inlineKeyboard(keyboard)
                }
            );
        }
    }

    async sendMessageMySubscribeChat(chat, userTgId, admin, ctx) {
        let chatInfo = null;
        try {
            chatInfo = await this._bot.telegram.getChat(chat.chat_tg_id);
        } catch (error) {
            return await ctx.telegram.sendMessage(
                userTgId,
                `🔴 <b>Чат/Канал сервиса VPN не найден!</b>`
                + `<blockquote>Возможно бот исключен из Чата/Канала!</blockquote>`,
                { parse_mode: 'HTML' }
            );
        }
        const title = chatInfo?.title ? `🔰 <b>${chatInfo.title}</b>` : '';
        const description = chatInfo?.description ? `\n<blockquote>${chatInfo.description}</blockquote>` : '';
        let statusSubsecibe = `\n<blockquote>Подписка действительна до <b>${chat.billing_date_to}</b></blockquote>`;
        const message = `${title}${description}${statusSubsecibe}`;

        const keyboard = [];
        keyboard.push([Markup.button.callback('Продлить подписку', JSON.stringify({ action: 'update_subscribe', chatId: chat.chat_id }))]);

        if (chatInfo.photo) {
            const fileId = chatInfo.photo.big_file_id;
            const file = await this._bot.telegram.getFile(fileId);
            const filePath = file.file_path;

            // Получение файла с использованием axios
            const response = await this._axios.get(
                `${this._filePath}/${filePath}`,
                { responseType: 'stream' }
            );

            await ctx.telegram.sendPhoto(
                userTgId,
                { source: response.data },
                {
                    caption: message,
                    parse_mode: 'HTML',
                    ...Markup.inlineKeyboard(keyboard)
                },
            );
        } else {
            await ctx.telegram.sendMessage(
                userTgId,
                message,
                {
                    parse_mode: 'HTML',
                    ...Markup.inlineKeyboard(keyboard)
                }
            );
        }
    }
}

module.exports = { SendMessages }