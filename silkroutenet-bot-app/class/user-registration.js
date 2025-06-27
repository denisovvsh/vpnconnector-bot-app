require('dotenv').config();
const { Markup } = require('telegraf');
const axios = require('axios');
const sharp = require('sharp');
const QRCode = require('qrcode');
const md5 = require('md5');

class UserRegistration {
    constructor(bot, dbRequests, sendMessages, xRay, attributes) {
        this._bot = bot;
        this._dbRequests = dbRequests;
        this._attributes = attributes;
        this._sendMessages = sendMessages;
        this._axios = axios;
        this._sharp = sharp;
        this._xRay = xRay;
        this._qRCode = QRCode;
        this._md5 = md5;
        this._wireguardClientPath = `http://${process.env.WIREGUARD_HOST}/api/wireguard/client`;
        this._appVPNLink = 'https://play.google.com/store/apps/details?id=com.wireguard.android&pli=1';
        this._instructionXRayLink = 'https://telegra.ph/Kak-podklyuchit-VPN-cherez-QR-CODE-12-22';
    }

    async signUp(ctx) {
        try {
            ctx.answerCbQuery('Загрузка...');
        } catch (error) { }
        await ctx.sendChatAction('typing');

        let user = await this._dbRequests.getUserByUserTgId(ctx.from.id);
        const userData = {
            user_tg_id: user?.user_tg_id ?? ctx.from.id,
            first_name: user?.first_name ?? ctx.from.first_name ?? '',
            last_name: user?.last_name ?? ctx.from.last_name ?? '',
            username: user?.username ?? ctx.from.username ?? '',
            phone: user?.phone ?? '',
            language_code: user?.language_code ?? ctx.from.language_code,
            is_bot: user?.is_bot ?? ctx.from.is_bot,
            is_premium: ctx.from.is_premium ?? 0,
            is_active: user?.is_active ?? 1
        };
        await this._dbRequests.updateOrInsertUser(userData);

        const services = await this._dbRequests.getServices();
        if (!services) {
            const keyboard = [];
            if (ctx.from.id == process.env.BOT_OWNER_ID) {
                keyboard.push([Markup.button.callback('Добавить сервис VPN', JSON.stringify({ action: 'add_service_vpn' }))]);
            }
            return await ctx.reply(
                `🔵 <b>Сервис VPN не найден!</b>`,
                {
                    parse_mode: 'HTML',
                    ...Markup.inlineKeyboard(keyboard)
                }
            );
        }

        for (let serviceItem of services) {
            await this._sendMessages.sendMessageAboutService(serviceItem, ctx);
        }

        if (ctx.from.id == process.env.BOT_OWNER_ID) return;

        const query = ctx.message.text;
        const [_, textUtm] = query.split(' ');
        const validUtm = textUtm && /^[a-zA-Z0-9_]+$/.test(textUtm) ? textUtm.trim() : null;
        if (validUtm) {
            const link = await this._dbRequests.getReferralLinkByUtm(validUtm);
            if (link) {
                const userLead = await this._dbRequests.getUserByUserTgId(ctx.from.id);
                const addLead = await this._dbRequests.addLead(link.user_id, userLead.id, validUtm);
                if (!addLead) return;
                let notification = `🔗 <b>Зарегистрирован новый лид</b>`;
                notification += `\n\n<blockquote>`;
                notification += `<b>Лид:</b>\nТГ ID: <b>${ctx.from.id}</b>\nUsername: <b>@${ctx.from.username ?? ''}</b>\nИмя: <b>${ctx.from.first_name}</b>\nФамилия: <b>${ctx.from.last_name ?? ''}</b>`;
                notification += `\n\n<b>Реферал:</b>\nТГ ID: <b>${link.user_tg_id}</b>\nUsername: <b>@${link.username ?? ''}</b>\nИмя: <b>${link.first_name}</b>\nФамилия: <b>${link.last_name ?? ''}</b>`;
                notification += `\n\nБот: ${process.env.BOT_LINK}`;
                notification += `</blockquote>`
                await this._bot.telegram.sendMessage(
                    process.env.BOT_OWNER_ID,
                    notification,
                    { parse_mode: 'HTML' }
                );
            }
        }

        return;
    }

    async subscribe(serviceId, ctx) {
        try {
            ctx.answerCbQuery('Загрузка...');
        } catch (error) { }
        await ctx.sendChatAction('typing');

        const billingData = await this._dbRequests.getBillingByServiceIdAndUserTgId(serviceId, ctx.from.id);
        const targetDate = new Date(billingData.date_to);
        const currentDate = new Date();
        if (currentDate < targetDate) {
            const keyboard = [];
            keyboard.push([
                Markup.button.callback(
                    'Продлить подписку',
                    JSON.stringify({ action: 'update_service_subscribe', serviceId: serviceId })
                )
            ]);
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
        const service = await this._dbRequests.getServiceById(serviceId);
        ctx.session.service_id = service ? service.id : null;
        ctx.session.username = ctx.from.username || '';
        ctx.session.surname = ctx.from.last_name;
        ctx.session.name = ctx.from.first_name;

        await this.creaeteServiceMetaSession(service.id, ctx);

        if (!ctx.session.payment_type_star && !ctx.session.payment_type_card && !ctx.session.payment_type_crypto) {
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

    async getInvoiceUpdateSubscribe(serviceId, ctx) {
        try {
            ctx.answerCbQuery('Загрузка...');
        } catch (error) { }
        await ctx.sendChatAction('typing');

        const user = await this._dbRequests.getUserByUserTgId(ctx.from.id, ctx);

        ctx.session.username = ctx.from.username || '';
        ctx.session.surname = ctx.from.last_name;
        ctx.session.name = ctx.from.first_name;
        ctx.session.phone = user.phone ?? '';
        ctx.session.service_id = serviceId;
        ctx.session.is_update_subscribe = 1;
        ctx.session.payment_id = new Date().getTime();
        ctx.session.user_id = user.id;

        await this.creaeteServiceMetaSession(serviceId, ctx);

        if (!ctx.session.payment_type_star && !ctx.session.payment_type_card && !ctx.session.payment_type_crypto) {
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
            username: ctx.from.username ?? '',
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

        if (!ctx.session?.user_id) {
            return await ctx.reply(
                `🟠 <b>Сессия оплаты устарела, начните регистрацию повторно - нажимте /my_vpn здесь или в меню бота.</b>`,
                { parse_mode: 'HTML' }
            );
        }

        ctx.session.price_type = priceType;
        const randomInt = await this.getRandomInt(10, 50);
        let price = 0;
        price = priceType == 'card_price_1' ? ctx.session.card_price_1 : price;
        price = priceType == 'card_price_6' ? ctx.session.card_price_6 : price;
        price = priceType == 'card_price_12' ? ctx.session.card_price_12 : price;
        price = priceType == 'star_price_1' ? ctx.session.star_price_1 : price;
        price = priceType == 'star_price_6' ? ctx.session.star_price_6 : price;
        price = priceType == 'star_price_12' ? ctx.session.star_price_12 : price;
        price = priceType == 'crypto_price_1' ? ctx.session.crypto_price_1 + '.' + randomInt : price;
        price = priceType == 'crypto_price_6' ? ctx.session.crypto_price_6 + '.' + randomInt : price;
        price = priceType == 'crypto_price_12' ? ctx.session.crypto_price_12 + '.' + randomInt : price;
        ctx.session.price = price;
        let period = priceType == 'card_price_1' || priceType == 'star_price_1' || priceType == 'crypto_price_1'
            ? '1 месяц' : '';
        period = priceType == 'card_price_6' || priceType == 'star_price_6' || priceType == 'crypto_price_6'
            ? '6 месяцев' : period;
        period = priceType == 'card_price_12' || priceType == 'star_price_12' || priceType == 'crypto_price_12'
            ? '12 месяцев' : period;

        const dataTransaction = {
            user_id: ctx.session.user_id,
            service_id: ctx.session.service_id,
            price: price,
            status: 0,
            price_type: priceType,
            payment_id: ctx.session.payment_id,
            is_update_subscribe: ctx.session.is_update_subscribe ?? 0
        };
        await this._dbRequests.updateOrInsertTransactions(dataTransaction);

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
            message = `Оплата сервиса VPN\nСрок подписки: <b>${period}</b>\n\n`;
            message += `🔵 <b>Оплатите по реквизитам карты:</b>\n\n`;
            message += `<b>Сумма к оплате:</b> ${ctx.session.price}${ctx.session.currency}\n`;
            message += `<b>${card_number_title}:</b> <pre>${payment_number}</pre> (нажмите на номер, чтобы скопировать)\n`;
            if (card_number_title == 'Номер телефона') {
                message += `<b>Банк получателя:</b> ${ctx.session.bank_name}\n`;
                message += `<b>Имя получателя:</b> ${ctx.session.receiver_name}\n`;
            }
            message += `<blockquote>⚠️<b>Внимание! Сессия оплаты длится 30 минут.</b>\nПосле истечения сесси необходимо повторно выбрать тариф.</blockquote>`;
            message += `<blockquote>❗️<b>После оплаты отправьте скриншот квитанции.</b></blockquote>`;

            await ctx.reply(message, { parse_mode: 'HTML' });
            await ctx.reply(
                `🔵 <b>После проверки платежа менеджер подтвердит оплату и Вы получите уведомление.</b>`,
                { parse_mode: 'HTML' }
            );
        } else if (ctx.session.payment_type_crypto == 1 && priceType.startsWith('crypto_price_')) {
            ctx.session.currency = ctx.session.crypto_currency;
            ctx.session.step = 'confirm_payment_transfer';

            let message = `<b>Оплата подписки</b>\n`;
            message = `Оплата сервиса VPN\nСрок подписки: <b>${period}</b>\n\n`;
            message += `🔵 <b>Оплатите по реквизитам:</b>\n\n`;
            message += `<b>Сумма к оплате:</b> ${ctx.session.price} ${ctx.session.currency}\n`;
            message += `<b>Адрес крипто кошелька получателя:</b> <pre>${ctx.session.crypto_wallet}</pre> (нажмите на адрес, чтобы скопировать)\n`;
            message += `<b>Идентификатор сети:</b> ${ctx.session.crypto_network}\n`;
            message += `<blockquote>❗️<b>После оплаты нажмите кнопку подтвердить.</b></blockquote>`;

            await ctx.reply(
                message,
                {
                    parse_mode: 'HTML',
                    ...Markup.inlineKeyboard([
                        [Markup.button.callback('Подтвердить оплату', JSON.stringify({ action: 'apply_crypto_transaction', paymentId: ctx.session.payment_id }))]
                    ])
                }
            );
            await ctx.reply(
                `🔵 <b>После проверки платежа менеджер подтвердит оплату и Вы получите уведомление.</b>`,
                { parse_mode: 'HTML' }
            );
        } else if (ctx.session.payment_type_star == 1 && priceType.startsWith('star_price_')) {
            ctx.session.currency = '⭐️';
            const invoice = {
                title: `Оплата подписки`,
                description: `Оплата сервиса VPN. Срок подписки: ${period}.`,
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

    async getRandomInt(min, max) {
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    async successfulPayment(paymentId, ctx) {
        try {
            ctx.answerCbQuery('Загрузка...');
        } catch (error) { }
        await ctx.sendChatAction('typing');

        const transactionData = await this._dbRequests.getTransactionByPaymentId(paymentId);
        const dataTransaction = {
            user_id: transactionData.user_id,
            service_id: transactionData.service_id,
            price: transactionData.price,
            status: 1,
            price_type: transactionData.price_type,
            payment_id: transactionData.payment_id,
            is_update_subscribe: transactionData.is_update_subscribe
        };
        await this._dbRequests.updateOrInsertTransactions(dataTransaction);

        const user = await this._dbRequests.getUserById(transactionData.user_id);
        const serviceMeta = await this._dbRequests.getServiceMeta(transactionData.service_id);
        const notificationChatId = serviceMeta ? await serviceMeta.find(meta => meta.meta_key == 'notification_chat_id')?.meta_value : null;
        if (+transactionData.status) {
            return await this._bot.telegram.sendMessage(
                notificationChatId,
                `✅ <b>Транзакция уже успешно подтверждена!</b>`,
                { parse_mode: 'HTML' }
            );
        }

        let dateFrom = await this._attributes.getDateWithMonthsOffset();
        let periodnumMonth = transactionData.price_type == 'card_price_1' || transactionData.price_type == 'star_price_1' || transactionData.price_type == 'crypto_price_1'
            ? 1 : 0;
        periodnumMonth = transactionData.price_type == 'card_price_6' || transactionData.price_type == 'star_price_6' || transactionData.price_type == 'crypto_price_6'
            ? 6 : periodnumMonth;
        periodnumMonth = transactionData.price_type == 'card_price_12' || transactionData.price_type == 'star_price_12' || transactionData.price_type == 'crypto_price_12'
            ? 12 : periodnumMonth;
        let dateTo = await this._attributes.getDateWithMonthsOffset(periodnumMonth);

        const billingByUser = await this._dbRequests.getBillingByServiceIdAndUserTgId(transactionData.service_id, user.user_tg_id);
        if (transactionData.is_update_subscribe && +billingByUser.status) {
            dateFrom = billingByUser.date_from;
            dateTo = await this._attributes.getDateWithMonthsOffset(periodnumMonth, billingByUser.date_to);
        }

        const dataBilling = {
            user_id: transactionData.user_id,
            service_id: transactionData.service_id,
            status: 1,
            date_from: dateFrom,
            date_to: dateTo
        };
        await this._dbRequests.updateOrInsertBilling(dataBilling);

        const vpnClient = transactionData.is_update_subscribe && +billingByUser.status
            ? true
            : await this.createVpnClient(user, transactionData);
        if (vpnClient) {
            await this._bot.telegram.sendMessage(
                user.user_tg_id,
                `✅ <b>Оплата успешно завершена!</b>`,
                { parse_mode: 'HTML' }
            );
            const newBillingByUser = await this._dbRequests.getBillingByServiceIdAndUserTgId(transactionData.service_id, user.user_tg_id);
            const keyboard = [];
            keyboard.push([
                Markup.button.callback(
                    'Продлить подписку',
                    JSON.stringify({ action: 'update_service_subscribe', serviceId: transactionData.service_id })
                )
            ]);
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

            await this._sendMessages.sendReferralNotificationsToAdministrator({
                transaction: dataTransaction
            });
        } else {
            dataTransaction.status = 0;
            await this._dbRequests.updateOrInsertTransactions(dataTransaction);
            dataBilling.status = 0;
            await this._dbRequests.updateOrInsertBilling(dataBilling);
            await this._bot.telegram.sendMessage(
                notificationChatId,
                '🟠 Не удалось получить настройки VPN.\n<blockquote>Нажмите кнопку "Подтвердить" повторно!</blockquote>',
                { parse_mode: 'HTML' }
            );
        }

        return;
    }

    async applyCryptoTransaction(paymentId, ctx) {
        try {
            ctx.answerCbQuery('Загрузка...');
        } catch (error) { }
        await ctx.sendChatAction('typing');

        const transactionData = await this._dbRequests.getTransactionByPaymentId(paymentId);
        const user = await this._dbRequests.getUserById(transactionData.user_id);
        const serviceMeta = await this._dbRequests.getServiceMeta(transactionData.service_id);
        const notificationChatId = serviceMeta ? await serviceMeta.find(meta => meta.meta_key == 'notification_chat_id')?.meta_value : null;
        const cryptoWallet = serviceMeta ? await serviceMeta.find(meta => meta.meta_key == 'crypto_wallet')?.meta_value : null;
        const cryptoCurrency = serviceMeta ? await serviceMeta.find(meta => meta.meta_key == 'crypto_currency')?.meta_value : null;
        if (!+transactionData.status) {
            let text = '✅ <b>Пользователь перевел и подтвердил оплату за VPN!</b>\n\n';
            text += `<b>Имя пользователя:</b> @${user.username}\n`;
            text += `<b>Имя:</b> ${user.first_name}\n`;
            text += `<b>Фамилия:</b> ${user.last_name}\n`;
            text += `<b>Телефон:</b> ${user.phone}\n`;
            text += `Оплата <b>${transactionData.price} ${cryptoCurrency}</b>\n`;
            text += `<b>Кошелек:</b> ${cryptoWallet}\n`;
            text += `<b>ID транзакции:</b> ${transactionData.payment_id}\n`;
            const keyboard = [
                [Markup.button.callback('Подтвердить оплату', JSON.stringify({ action: 'confirm_service_payment', paymentId: transactionData.payment_id }))]
            ];

            await this._bot.telegram.sendMessage(
                user.user_tg_id,
                '✅ <b>Подтверждение отправлено! Ожидайте подтверждение от получателя.</b>\n\n',
                { parse_mode: 'HTML' }
            );

            return await this._bot.telegram.sendMessage(
                notificationChatId,
                text,
                {
                    parse_mode: 'HTML',
                    ...Markup.inlineKeyboard(keyboard)
                }
            );
        } else {
            await this._bot.telegram.sendMessage(
                user.user_tg_id,
                '✅ <b>Транзакция уже завершена!</b>\n\n',
                { parse_mode: 'HTML' }
            );
        }

        return;
    }

    async getKeyboardTarifs(ctx) {
        const keyboard = [];

        if (+ctx.session.payment_type_card && ctx.session.card_price_1) {
            keyboard.push([
                Markup.button.callback(
                    `➡️ За 1 месяц ${ctx.session.card_price_1}₽`,
                    JSON.stringify({ action: 'service_invoice', priceType: 'card_price_1' })
                )
            ]);
        }

        if (+ctx.session.payment_type_card && ctx.session.card_price_6) {
            keyboard.push([
                Markup.button.callback(
                    `➡️ За 6 месяцев ${ctx.session.card_price_6}₽`,
                    JSON.stringify({ action: 'service_invoice', priceType: 'card_price_6' })
                )
            ]);
        }

        if (+ctx.session.payment_type_card && ctx.session.card_price_12) {
            keyboard.push([
                Markup.button.callback(
                    `➡️ За 12 месяцев ${ctx.session.card_price_12}₽`,
                    JSON.stringify({ action: 'service_invoice', priceType: 'card_price_12' })
                )
            ]);
        }

        if (+ctx.session.payment_type_star && ctx.session.star_price_1) {
            keyboard.push([
                Markup.button.callback(
                    `➡️ За 1 месяц ${ctx.session.star_price_1}⭐️`,
                    JSON.stringify({ action: 'service_invoice', priceType: 'star_price_1' })
                )
            ]);
        }

        if (+ctx.session.payment_type_star && ctx.session.star_price_6) {
            keyboard.push([
                Markup.button.callback(
                    `➡️ За 6 месяцев ${ctx.session.star_price_6}⭐️`,
                    JSON.stringify({ action: 'service_invoice', priceType: 'star_price_6' })
                )
            ]);
        }

        if (+ctx.session.payment_type_star && ctx.session.star_price_12) {
            keyboard.push([
                Markup.button.callback(
                    `➡️ За 12 месяцев ${ctx.session.star_price_12}⭐️`,
                    JSON.stringify({ action: 'service_invoice', priceType: 'star_price_12' })
                )
            ]);
        }

        if (+ctx.session.payment_type_crypto && ctx.session.crypto_price_1) {
            keyboard.push([
                Markup.button.callback(
                    `➡️ За 1 месяц ${ctx.session.crypto_price_1} ${ctx.session.crypto_currency}`,
                    JSON.stringify({ action: 'service_invoice', priceType: 'crypto_price_1' })
                )
            ]);
        }

        if (+ctx.session.payment_type_crypto && ctx.session.crypto_price_6) {
            keyboard.push([
                Markup.button.callback(
                    `➡️ За 6 месяцев ${ctx.session.crypto_price_6} ${ctx.session.crypto_currency}`,
                    JSON.stringify({ action: 'service_invoice', priceType: 'crypto_price_6' })
                )
            ]);
        }

        if (+ctx.session.payment_type_crypto && ctx.session.crypto_price_12) {
            keyboard.push([
                Markup.button.callback(
                    `➡️ За 12 месяцев ${ctx.session.crypto_price_12} ${ctx.session.crypto_currency}`,
                    JSON.stringify({ action: 'service_invoice', priceType: 'crypto_price_12' })
                )
            ]);
        }

        return keyboard;
    }

    async creaeteServiceMetaSession(serviceId, ctx) {
        const serviceMeta = await this._dbRequests.getServiceMeta(serviceId);
        ctx.session.payment_type_card = serviceMeta ? +await serviceMeta.find(meta => meta.meta_key == 'payment_type_card')?.meta_value : null;
        ctx.session.payment_number = serviceMeta ? await serviceMeta.find(meta => meta.meta_key == 'payment_number')?.meta_value : null;
        ctx.session.bank_name = serviceMeta ? await serviceMeta.find(meta => meta.meta_key == 'bank_name')?.meta_value : null;
        ctx.session.receiver_name = serviceMeta ? await serviceMeta.find(meta => meta.meta_key == 'receiver_name')?.meta_value : null;
        ctx.session.card_price_1 = serviceMeta ? +await serviceMeta.find(meta => meta.meta_key == 'card_price_1')?.meta_value : 0;
        ctx.session.card_price_6 = serviceMeta ? +await serviceMeta.find(meta => meta.meta_key == 'card_price_6')?.meta_value : 0;
        ctx.session.card_price_12 = serviceMeta ? +await serviceMeta.find(meta => meta.meta_key == 'card_price_12')?.meta_value : 0;

        ctx.session.payment_type_star = serviceMeta ? +await serviceMeta.find(meta => meta.meta_key == 'payment_type_star')?.meta_value : null;
        ctx.session.star_price_1 = serviceMeta ? +await serviceMeta.find(meta => meta.meta_key == 'star_price_1')?.meta_value : 0;
        ctx.session.star_price_6 = serviceMeta ? +await serviceMeta.find(meta => meta.meta_key == 'star_price_6')?.meta_value : 0;
        ctx.session.star_price_12 = serviceMeta ? +await serviceMeta.find(meta => meta.meta_key == 'star_price_12')?.meta_value : 0;

        ctx.session.payment_type_crypto = serviceMeta ? +await serviceMeta.find(meta => meta.meta_key == 'payment_type_crypto')?.meta_value : null;
        ctx.session.crypto_wallet = serviceMeta ? await serviceMeta.find(meta => meta.meta_key == 'crypto_wallet')?.meta_value : null;
        ctx.session.crypto_currency = serviceMeta ? await serviceMeta.find(meta => meta.meta_key == 'crypto_currency')?.meta_value : null;
        ctx.session.crypto_network = serviceMeta ? await serviceMeta.find(meta => meta.meta_key == 'crypto_network')?.meta_value : null;
        ctx.session.crypto_price_1 = serviceMeta ? +await serviceMeta.find(meta => meta.meta_key == 'crypto_price_1')?.meta_value : 0;
        ctx.session.crypto_price_6 = serviceMeta ? +await serviceMeta.find(meta => meta.meta_key == 'crypto_price_6')?.meta_value : 0;
        ctx.session.crypto_price_12 = serviceMeta ? +await serviceMeta.find(meta => meta.meta_key == 'crypto_price_12')?.meta_value : 0;

        ctx.session.notification_chat_id = serviceMeta ? await serviceMeta.find(meta => meta.meta_key == 'notification_chat_id')?.meta_value : null;
    }

    async createVpnClient(user, transactionData) {
        try {
            let period = transactionData.price_type == 'card_price_1' || transactionData.price_type == 'star_price_1' || transactionData.price_type == 'crypto_price_1'
                ? '1 месяц' : '';
            period = transactionData.price_type == 'card_price_6' || transactionData.price_type == 'star_price_6' || transactionData.price_type == 'crypto_price_6'
                ? '6 месяцев' : period;
            period = transactionData.price_type == 'card_price_12' || transactionData.price_type == 'star_price_12' || transactionData.price_type == 'crypto_price_12'
                ? '12 месяцев' : period;

            return await this.createXRayVpnClient(user, period);            
        } catch (error) {
            console.error('Ошибка при получении настроек VPN', error.response.data.error);
            await this._bot.telegram.sendMessage(
                user.user_tg_id,
                '🟠 Не удалось получить настройки VPN.\n<blockquote>Менеджер уже получил уведомление, скоро произведет повторное подтверждение!</blockquote>',
                { parse_mode: 'HTML' }
            );
            return false;
        }
    }

    async createXRayVpnClient(user, period) {
        const cookies = await this._xRay.loginUser();
        if (!cookies) {
            await this._bot.telegram.sendMessage(
                process.env.BOT_OWNER_ID,
                `🔴 Ошибка получения куки на сервере ВПН!`,
                { parse_mode: 'HTML' }
            );
            return false;
        }
        const usersList = await this._xRay.getUsersList(cookies);
        const clientId = this._md5(user.user_tg_id);
        const client = usersList.length > 0
            ? await usersList.filter(client => client.id == clientId)
            : false;
        if (!client || client.length == 0) {
            const userAddResult = await this._xRay.addUser(cookies, user);
            if (!userAddResult) return false;
        }
        const userName = user.username ? user.username : user.user_tg_id;
        const linkVpnConnect = `vless://${clientId}@${process.env.XRAY_VLESS_HOST}?type=tcp&security=reality&pbk=${process.env.XRAY_PBK}&fp=chrome&sni=yahoo.com&sid=${process.env.XRAY_SID}&spx=%2F#${userName}`;
        const subscribe = `🔰 Подпсика на сервис VPN\n<blockquote>Оформлена на <b>${period}</b></blockquote>`;
        const instruction = `\nСсылка на инструкцию: ${this._instructionXRayLink}`;
        const qrVpnQrInstall = `QR-код для подключения`;
        const qrVpnLinkInstall = `Прямая ссылка для подключения:\n<pre>${linkVpnConnect}</pre>`;

        await this._bot.telegram.sendMessage(
            user.user_tg_id,
            subscribe + instruction,
            {
                parse_mode: 'HTML',
                disable_web_page_preview: true
            }
        );

        await this._qRCode.toBuffer(
            linkVpnConnect,
            { width: 400, margin: 2 },
            async (err, buffer) => {
                await this._bot.telegram.sendPhoto(
                    user.user_tg_id,
                    { source: buffer },
                    {
                        caption: qrVpnQrInstall,
                        parse_mode: 'HTML',
                        disable_web_page_preview: true
                    },
                )
                    .then(() => buffer = null)
                    .catch(error => console.error('Ошибка при отправке QR-кода', error));
            }
        );

        await this._bot.telegram.sendMessage(
            user.user_tg_id,
            qrVpnLinkInstall,
            {
                parse_mode: 'HTML',
                disable_web_page_preview: true
            }
        );

        return true;
    }

    async createWgVpnClient(user, period) {
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
        const subscribe = `🔰 Подпсика на сервис VPN\n<blockquote>Оформлена на <b>${period}</b></blockquote>`;
        const qrVpnInstall = `\n<blockquote>Установите приложение ${this._appVPNLink}\nПосле чего используйте QR-код для подключения - сканируйте камерой через приложение.</blockquote>`;
        await this._bot.telegram.sendPhoto(
            user.user_tg_id,
            { source: pngBuffer },
            {
                caption: `${subscribe}${qrVpnInstall}`,
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
    }

    async preCheckoutQuery(ctx) {
        return await ctx.answerPreCheckoutQuery(true).catch((err) => {
            console.error('Error answering pre_checkout_query:', err);
        });
    }
}

module.exports = { UserRegistration }