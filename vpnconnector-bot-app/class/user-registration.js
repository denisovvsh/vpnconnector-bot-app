require('dotenv').config();
const { Markup } = require('telegraf');
const axios = require('axios');
const sharp = require('sharp');

class UserRegistration {
    constructor(bot, dbRequests, sendMessages, attributes) {
        this._bot = bot;
        this._dbRequests = dbRequests;
        this._attributes = attributes;
        this._sendMessages = sendMessages;
        this._axios = axios;
        this._sharp = sharp;
        this._wireguardClientPath = 'http://88.210.3.140:51821/api/wireguard/client';
        this._appVPNLink = 'https://play.google.com/store/apps/details?id=com.wireguard.android&pli=1';
    }

    async signUp(ctx) {
        try {
            ctx.answerCbQuery('Загрузка...');
        } catch (error) { }
        await ctx.sendChatAction('typing');

        ctx.session = null;
        const adminSubscribePrice = await this._dbRequests.getAdminSubscribePrice();
        const chatsByUserId = await this._dbRequests.getChats();
        const chats = chatsByUserId && adminSubscribePrice?.manager_chat_id
            ? chatsByUserId.filter(item => adminSubscribePrice?.manager_chat_id != item.chat_tg_id && item.type == 'service')
            : false;

        if (!chats || chats.length <= 0) {
            return await ctx.reply(`🔵 <b>Сервис VPN не найден!</b>`, { parse_mode: 'HTML' });
        }

        for (let chatItem of chats) {
            const admin = await this._dbRequests.getAdminByChatTgId(chatItem.chat_tg_id);
            const chatMeta = await this._dbRequests.getChatMeta(chatItem.id);
            if (!chatMeta) continue;
            await this._sendMessages.sendMessageAboutChat(chatItem, chatMeta, admin, ctx);
        }

        return;
    }

    async subscribe(chatId, ctx) {
        try {
            ctx.answerCbQuery('Загрузка...');
        } catch (error) { }
        await ctx.sendChatAction('typing');

        const billingData = await this._dbRequests.getBillingByChatIdAndUserTgId(chatId, ctx.from.id);
        const targetDate = new Date(billingData.date_to);
        const currentDate = new Date();

        if (currentDate < targetDate) {
            const keyboard = [];
            const admin = await this._dbRequests.getAdminByChatTgId(billingData.chat_tg_id)
            const billingAdmin = await this._dbRequests.getBillingAdminsByUserId(admin.user_id);
            if (+billingAdmin.status) {
                keyboard.push([
                    Markup.button.callback(
                        'Продлить подписку',
                        JSON.stringify({ action: 'update_service_subscribe', chatId: chatId })
                    )
                ]);
            }
            return await this._bot.telegram.sendMessage(
                ctx.from.id,
                `🔵 Ваша подписка на VPN\n<blockquote>Действительна до <b>${billingData.billing_date_to}</b></blockquote>`,
                {
                    parse_mode: 'HTML',
                    ...Markup.inlineKeyboard(keyboard)
                }
            );
        }

        if (!ctx.session) ctx.session = {};
        const chat = await this._dbRequests.getChatById(chatId);
        ctx.session.srvice = true;
        ctx.session.chat_id = chat ? chat.id : null;
        ctx.session.username = ctx.from.username || 'no_username';
        ctx.session.surname = ctx.from.last_name;
        ctx.session.name = ctx.from.first_name;

        await this.creaeteChatMetaSession(chat.id, ctx);

        if (!ctx.session.payment_type_star && !ctx.session.payment_type_card) {
            return await ctx.reply(
                `🟠 <b>Данный сервис не имеет настроенных цен за подписку!</b>`,
                { parse_mode: 'HTML' }
            );
        }

        await ctx.reply('🔵 <b>Для регистрации, мне понадобится контактная информация.</b>', { parse_mode: 'HTML' });

        await ctx.reply('✍️ Пожалуйста, отправьте <b>Ваш контакт</b>.<blockquote>С помощью кнопки ниже.</blockquote>',
            {
                parse_mode: 'HTML',
                ...Markup.keyboard([
                    [Markup.button.contactRequest('Отправить контакт')]
                ]).resize().oneTime()
            }
        );

        ctx.session.step = 'contact';
    }

    async getInvoiceUpdateSubscribe(chatId, ctx) {
        try {
            ctx.answerCbQuery('Загрузка...');
        } catch (error) { }
        await ctx.sendChatAction('typing');

        const user = await this._dbRequests.getUserByUserTgId(ctx.from.id, ctx);

        ctx.session.srvice = true;
        ctx.session.username = ctx.from.username || 'no_username';
        ctx.session.surname = ctx.from.last_name;
        ctx.session.name = ctx.from.first_name;
        ctx.session.phone = user.phone ?? '';
        ctx.session.chat_id = chatId;
        ctx.session.is_update_subscribe = 1;
        ctx.session.payment_id = new Date().getTime();
        ctx.session.user_id = user.id;

        await this.creaeteChatMetaSession(chatId, ctx);

        if (!ctx.session.payment_type_star && !ctx.session.payment_type_card) {
            return await ctx.reply(
                `🟠 <b>VPN не имеет настроенных цен за подписку!</b>`,
                { parse_mode: 'HTML' }
            );
        }

        let keyboard = await this.getKeyboardTarifs(ctx);
        let sentMessage = await ctx.reply(
            `🔵 Продлить подписку на VPN.\n🔰 <b>Перейти к оплате:</b>`,
            {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard(keyboard)
            }
        );

        ctx.session.lastMessageId = sentMessage.message_id;

        ctx.session.step = 'invoice';

        return;
    }

    async contact(ctx) {
        await ctx.sendChatAction('typing');
        // Если пользователь отправил контакт через кнопку, а не ввел номер телефона сам
        if (ctx.message.contact && ctx.message.contact.phone_number) {
            const cleanPhoneNumber = await this._attributes.formatPhoneNumberWithoutPlus(ctx.message.contact.phone_number);
            ctx.session.phone = cleanPhoneNumber;
        }

        ctx.session.payment_id = new Date().getTime();

        const updateDataUser = {
            user_tg_id: ctx.from.id,
            first_name: ctx.from.first_name ?? '',
            last_name: ctx.from.last_name ?? '',
            username: ctx.from.username ?? 'no_username',
            phone: ctx.session.phone,
            language_code: ctx.from.language_code,
            is_bot: ctx.from.is_bot,
            is_premium: ctx.from.is_premium ?? 0,
            is_active: 1
        };
        await this._dbRequests.updateOrInsertUser(updateDataUser);

        const user = await this._dbRequests.getUserByUserTgId(ctx.from.id, ctx);

        ctx.session.user_id = user.id;

        await ctx.reply(
            `✅ <b>Спасибо, контакт принят!</b>`,
            {
                parse_mode: 'HTML',
                reply_markup: {
                    remove_keyboard: true
                }
            }
        );

        const keyboard = await this.getKeyboardTarifs(ctx);

        let sentMessage = await ctx.reply(
            `👌 <b>Спасибо за регистрацию!</b>\n🔰 <b>Перейти к оплате:</b>`,
            {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard(keyboard)
            }
        );

        ctx.session.lastMessageId = sentMessage.message_id;

        ctx.session.step = 'invoice';

        return;
    }

    async getInvoice(priceType, ctx) {
        try {
            ctx.answerCbQuery('Загрузка...');
        } catch (error) { }

        if (ctx.session.lastMessageId) {
            ctx.deleteMessage(ctx.session.lastMessageId)
                .catch((err) => console.log('Ошибка при удалении сообщения'));
        }
        await ctx.sendChatAction('typing');

        ctx.session.srvice = true;
        ctx.session.price_type = priceType;
        let price = 0;
        price = priceType == 'card_price_1' ? ctx.session.card_price_1 : price;
        price = priceType == 'card_price_6' ? ctx.session.card_price_6 : price;
        price = priceType == 'card_price_12' ? ctx.session.card_price_12 : price;
        price = priceType == 'star_price_1' ? ctx.session.star_price_1 : price;
        price = priceType == 'star_price_6' ? ctx.session.star_price_6 : price;
        price = priceType == 'star_price_12' ? ctx.session.star_price_12 : price;
        ctx.session.price = price;
        let period = priceType == 'card_price_1' || priceType == 'star_price_1' ? '1 месяц' : '';
        period = priceType == 'card_price_6' || priceType == 'star_price_6' ? '6 месяцев' : period;
        period = priceType == 'card_price_12' || priceType == 'star_price_12' ? '12 месяцев' : period;

        const dataTransaction = {
            user_id: ctx.session.user_id,
            chat_id: ctx.session.chat_id,
            price: price,
            status: 0,
            price_type: priceType,
            payment_id: ctx.session.payment_id,
            is_update_subscribe: ctx.session.is_update_subscribe ?? 0
        };
        await this._dbRequests.updateOrInsertTransactions(dataTransaction);

        const chat = await this._dbRequests.getChatById(ctx.session.chat_id);

        if (ctx.session.payment_type_card == 1 && priceType.startsWith('card_price_')) {
            ctx.session.currency = '₽';
            const phoneNumberRegex = /^[0-9]{11}$/;

            let payment_number = ctx.session.payment_number;
            let card_number_title = 'Номер карты';
            if (phoneNumberRegex.test(payment_number)) {
                card_number_title = 'Номер телефона';
                const phone = await this._attributes.formatPhoneNumber(payment_number);
                payment_number = phone
                    ? `<a href="tel:${phone}">${phone}</a>`
                    : payment_number;
            }

            ctx.session.step = 'confirm_payment_transfer';

            let message = `<b>Оплата подписки</b>\n`;
            message = `Оплата сервиса: <b>${chat.title}</b>\nСрок подписки: <b>${period}</b>\n\n`;
            message += `🔵 <b>Оплатите по реквизитам карты:</b>\n\n`;
            message += `<b>Сумма к оплате:</b> ${ctx.session.price}${ctx.session.currency}\n`;
            message += `<b>${card_number_title}:</b> <pre>${payment_number}</pre> (нажмите на номер, чтобы скопировать)\n`;
            if (card_number_title == 'Номер телефона') {
                message += `<b>Банк получателя:</b> ${ctx.session.bank_name}\n`;
                message += `<b>Имя получателя:</b> ${ctx.session.receiver_name}\n`;
            }
            message += `<blockquote>☝️<b>После оплаты отправьте скриншот квитанции.</b></blockquote>`;

            await ctx.replyWithHTML(message);

            await ctx.reply(
                `🔵 <b>После проверки платежа менеджер подтвердит оплату и Вы получите уведомление.</b>`,
                { parse_mode: 'HTML' }
            );
        } else if (ctx.session.payment_type_star == 1 && priceType.startsWith('star_price_')) {
            ctx.session.currency = '⭐️';
            const invoice = {
                title: `Оплата подписки`,
                description: `Оплата сервиса: ${chat.title}. Срок подписки: ${period}.`,
                payload: 'successful_' + ctx.chat.id,
                provider_token: '',
                start_parameter: 'purchase_' + ctx.chat.id,
                currency: 'XTR',
                prices: [{ label: 'Subscribe', amount: price }],
            };

            await ctx.telegram.sendInvoice(ctx.chat.id, invoice);
        } else {
            await ctx.reply(
                `🟠 <b>Не настроена система оплаты!</b>`,
                { parse_mode: 'HTML' }
            );
        }

        await this._sendMessages.sendNotificationsAdministratorsFromUserRegistrationRequest(ctx)

        return;
    }

    async successfulPayment(paymentId, ctx) {
        try {
            ctx.answerCbQuery('Загрузка...');
        } catch (error) { }
        await ctx.sendChatAction('typing');

        const transactionData = await this._dbRequests.getTransactionByPaymentId(paymentId);
        const dataTransaction = {
            user_id: transactionData.user_id,
            chat_id: transactionData.chat_id,
            price: transactionData.price,
            status: 1,
            price_type: transactionData.price_type,
            payment_id: transactionData.payment_id,
            is_update_subscribe: transactionData.is_update_subscribe
        };
        await this._dbRequests.updateOrInsertTransactions(dataTransaction);

        const user = await this._dbRequests.getUserById(transactionData.user_id);
        const chatMeta = await this._dbRequests.getChatMeta(transactionData.chat_id);
        const notificationChatId = chatMeta ? await chatMeta.find(meta => meta.meta_key == 'notification_chat_id')?.meta_value : null;
        if (+transactionData.status) {
            return await this._bot.telegram.sendMessage(
                notificationChatId,
                `✅ <b>Транзакция уже успешно подтверждена!</b>`,
                { parse_mode: 'HTML' }
            );
        }

        let dateFrom = await this.getDateWithMonthsOffset();
        let periodnumMonth = transactionData.price_type == 'card_price_1' || transactionData.price_type == 'star_price_1'
            ? 1 : 0;
        periodnumMonth = transactionData.price_type == 'card_price_6' || transactionData.price_type == 'star_price_6'
            ? 6 : periodnumMonth;
        periodnumMonth = transactionData.price_type == 'card_price_12' || transactionData.price_type == 'star_price_12'
            ? 12 : periodnumMonth;
        let dateTo = await this.getDateWithMonthsOffset(periodnumMonth);

        const billingByUser = await this._dbRequests.getBillingByChatIdAndUserTgId(transactionData.chat_id, user.user_tg_id);
        if (transactionData.is_update_subscribe && +billingByUser.status) {
            dateFrom = billingByUser.date_from;
            dateTo = await this.getDateWithMonthsOffset(periodnumMonth, billingByUser.date_to);
        }

        const dataBilling = {
            user_id: transactionData.user_id,
            chat_id: transactionData.chat_id,
            status: 1,
            date_from: dateFrom,
            date_to: dateTo
        };
        await this._dbRequests.updateOrInsertBilling(dataBilling);

        const inviteLink = transactionData.is_update_subscribe && +billingByUser.status
            ? true
            : await this.createVpnClient(user, transactionData);

        if (inviteLink) {
            await this._bot.telegram.sendMessage(
                user.user_tg_id,
                `✅ <b>Оплата успешно завершена!</b>`,
                { parse_mode: 'HTML' }
            );

            const newBillingByUser = await this._dbRequests.getBillingByChatIdAndUserTgId(transactionData.chat_id, user.user_tg_id);
            const keyboard = [];
            const admin = await this._dbRequests.getAdminByChatTgId(newBillingByUser.chat_tg_id)
            const billingAdmin = await this._dbRequests.getBillingAdminsByUserId(admin.user_id);
            if (+billingAdmin.status) {
                keyboard.push([
                    Markup.button.callback(
                        'Продлить подписку',
                        JSON.stringify({ action: 'update_service_subscribe', chatId: transactionData.chat_id })
                    )
                ]);
            }

            await this._bot.telegram.sendMessage(
                user.user_tg_id,
                `🔵 Ваша подписка на VPN`
                + `\n<blockquote>Действительна до <b>${newBillingByUser.billing_date_to}</b></blockquote>`,
                {
                    parse_mode: 'HTML',
                    ...Markup.inlineKeyboard(keyboard)
                }
            );

            await this._bot.telegram.sendMessage(
                notificationChatId,
                `✅ <b>Подтверждение доставлено!</b>`,
                { parse_mode: 'HTML' }
            );
        } else {
            await this._bot.telegram.sendMessage(
                notificationChatId,
                '🟠 Не удалось получить настройки VPN.',
                { parse_mode: 'HTML' }
            );
        }

        return;
    }

    async getKeyboardTarifs(ctx) {
        const keyboard = [];

        if (ctx.session.card_price_1) {
            keyboard.push([
                Markup.button.callback(
                    `➡️ За 1 месяц ${ctx.session.card_price_1}₽`,
                    JSON.stringify({ action: 'service_invoice', priceType: 'card_price_1' })
                )
            ]);
        }

        if (ctx.session.card_price_6) {
            keyboard.push([
                Markup.button.callback(
                    `➡️ За 6 месяцев ${ctx.session.card_price_6}₽`,
                    JSON.stringify({ action: 'service_invoice', priceType: 'card_price_6' })
                )
            ]);
        }

        if (ctx.session.card_price_12) {
            keyboard.push([
                Markup.button.callback(
                    `➡️ За 12 месяцев ${ctx.session.card_price_12}₽`,
                    JSON.stringify({ action: 'service_invoice', priceType: 'card_price_12' })
                )
            ]);
        }

        if (ctx.session.star_price_1) {
            keyboard.push([
                Markup.button.callback(
                    `➡️ За 1 месяц ${ctx.session.star_price_1}⭐️`,
                    JSON.stringify({ action: 'service_invoice', priceType: 'star_price_1' })
                )
            ]);
        }

        if (ctx.session.star_price_6) {
            keyboard.push([
                Markup.button.callback(
                    `➡️ За 6 месяцев ${ctx.session.star_price_6}⭐️`,
                    JSON.stringify({ action: 'service_invoice', priceType: 'star_price_6' })
                )
            ]);
        }

        if (ctx.session.star_price_12) {
            keyboard.push([
                Markup.button.callback(
                    `➡️ За 12 месяцев ${ctx.session.star_price_12}⭐️`,
                    JSON.stringify({ action: 'service_invoice', priceType: 'star_price_12' })
                )
            ]);
        }

        return keyboard;
    }

    async creaeteChatMetaSession(chatId, ctx) {
        const chatMeta = await this._dbRequests.getChatMeta(chatId);
        ctx.session.payment_type_card = chatMeta ? await chatMeta.find(meta => meta.meta_key == 'payment_type_card')?.meta_value : null;
        ctx.session.payment_number = chatMeta ? await chatMeta.find(meta => meta.meta_key == 'payment_number')?.meta_value : null;
        ctx.session.bank_name = chatMeta ? await chatMeta.find(meta => meta.meta_key == 'bank_name')?.meta_value : null;
        ctx.session.receiver_name = chatMeta ? await chatMeta.find(meta => meta.meta_key == 'receiver_name')?.meta_value : null;
        ctx.session.card_price_1 = chatMeta ? await chatMeta.find(meta => meta.meta_key == 'card_price_1')?.meta_value : 0;
        ctx.session.card_price_6 = chatMeta ? await chatMeta.find(meta => meta.meta_key == 'card_price_6')?.meta_value : 0;
        ctx.session.card_price_12 = chatMeta ? await chatMeta.find(meta => meta.meta_key == 'card_price_12')?.meta_value : 0;
        ctx.session.payment_type_star = chatMeta ? await chatMeta.find(meta => meta.meta_key == 'payment_type_star')?.meta_value : null;
        ctx.session.star_price_1 = chatMeta ? await chatMeta.find(meta => meta.meta_key == 'star_price_1')?.meta_value : 0;
        ctx.session.star_price_6 = chatMeta ? await chatMeta.find(meta => meta.meta_key == 'star_price_6')?.meta_value : 0;
        ctx.session.star_price_12 = chatMeta ? await chatMeta.find(meta => meta.meta_key == 'star_price_12')?.meta_value : 0;
        ctx.session.notification_chat_id = chatMeta ? await chatMeta.find(meta => meta.meta_key == 'notification_chat_id')?.meta_value : null;
    }

    async createVpnClient(user, transactionData) {
        try {
            let period = transactionData.price_type == 'card_price_1' || transactionData.price_type == 'star_price_1'
                ? '1 месяц' : '';
            period = transactionData.price_type == 'card_price_6' || transactionData.price_type == 'star_price_6'
                ? '6 месяцев' : period;
            period = transactionData.price_type == 'card_price_12' || transactionData.price_type == 'star_price_12'
                ? '12 месяцев' : period;

            const chat = await this._dbRequests.getChatById(transactionData.chat_id);
            const chatInfo = await this._bot.telegram.getChat(chat.chat_tg_id);
            const headers = { 'Content-Type': 'application/json' };
            let clients = await this._axios.get(this._wireguardClientPath, { headers });

            let client = clients.data.length > 0
                ? await clients.data.filter(client => client.name == "tg_client_" + user.user_tg_id)
                : false;

            if (client.length == 0) {
                await this._axios.post(
                    this._wireguardClientPath,
                    { name: "tg_client_" + user.user_tg_id }
                );
                clients = await this._axios.get(this._wireguardClientPath, { headers });
                client = clients.data.length > 0
                    ? await clients.data.filter(client => client.name == "tg_client_" + user.user_tg_id)
                    : false;
            }

            const svgResponse = await this._axios.get(
                `${this._wireguardClientPath}/${client[0].id}/qrcode.svg`,
                { responseType: 'arraybuffer' }
            );

            // Конвертируем SVG в PNG с помощью sharp
            const pngBuffer = await this._sharp(svgResponse.data).png().toBuffer();

            const chatTitle = chatInfo.title ? `🔰<b>${chatInfo.title}</b>` : '';
            const chatDescription = chatInfo.description ? `\n<b>${chatInfo.description}</b>` : '';
            const periodSubscribe = `\n<blockquote>Подпсика на VPN оформлена на <b>${period}</b></blockquote>`;
            const qrVpnInstall = `\n<blockquote>Установите приложение ${this._appVPNLink}\nПосле чего используйте QR-код для подключения - сканируйте камерой через приложение.</blockquote>`;
            await this._bot.telegram.sendPhoto(
                user.user_tg_id,
                { source: pngBuffer },
                {
                    caption: `${chatTitle}${chatDescription}${periodSubscribe}${qrVpnInstall}`,
                    parse_mode: 'HTML',
                    disable_web_page_preview: true
                }
            );

            const configResponse = await this._axios.get(
                `${this._wireguardClientPath}/${client[0].id}/configuration`,
                { responseType: 'stream' }
            );

            await this._bot.telegram.sendDocument(
                user.user_tg_id,
                { source: configResponse.data, filename: `vpn_${user.user_tg_id}.conf` },
                {
                    caption: `🔰<b>А так же можно использовать файл конфигурации для настройки любого устройства!</b>`
                        + `\n<blockquote>Инструкция для установки\nhttps://www.wireguard.com/install/</blockquote>`,
                    parse_mode: 'HTML'
                }
            );

            return true;
        } catch (error) {
            console.error('Ошибка при получении настроек VPN', error);
            await this._bot.telegram.sendMessage(
                user.user_tg_id,
                '🟠 Не удалось получить настройки VPN.',
                { parse_mode: 'HTML' }
            );
            return false;
        }
    }

    async preCheckoutQuery(ctx) {
        return await ctx.answerPreCheckoutQuery(true).catch((err) => {
            console.error('Error answering pre_checkout_query:', err);
        });
    }

    async formatDate(date) {
        const expireDate = new Date(date * 1000);
        const day = String(expireDate.getDate()).padStart(2, '0');
        const month = String(expireDate.getMonth() + 1).padStart(2, '0');
        const year = expireDate.getFullYear();
        const hours = String(expireDate.getHours()).padStart(2, '0');
        const minutes = String(expireDate.getMinutes()).padStart(2, '0');
        return `${day}.${month}.${year} ${hours}:${minutes}`;
    }

    async getDateWithMonthsOffset(months = 0, date = new Date()) {
        const now = new Date(date);
        now.setMonth(now.getMonth() + months);
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');

        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');

        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }
}

module.exports = { UserRegistration }