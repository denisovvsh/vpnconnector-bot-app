require('dotenv').config();
const { Markup } = require('telegraf');
const axios = require('axios');

class SettingsService {
    constructor(bot, dbRequests, sendMessages) {
        this._bot = bot;
        this._dbRequests = dbRequests;
        this._sendMessages = sendMessages;
        this._axios = axios;
        this._filePath = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}`;
        this._apiBotPath = `https://api.telegram.org/bot${process.env.BOT_TOKEN}`;
    }

    async addServiceVpn(ctx) {
        try {
            ctx.answerCbQuery('Загрузка...');
        } catch (error) { }

        ctx.session = !ctx.session ? {} : null;
        ctx.session.step = 'add_service_vpn';

        return await ctx.reply(
            '✍️ Пожалуйста, отправьте новый пост c описанием сервиса'
            + `<blockquote>Это может быть, простое текстовое сообщение или сообщение с фото, или видео</blockquote>`
            + `<blockquote>В посте может быть, только одно фото или одно видео</blockquote>`,
            { parse_mode: 'HTML' }
        );
    }

    async editServiceVpn(serviceId, ctx) {
        try {
            ctx.answerCbQuery('Загрузка...');
        } catch (error) { }

        ctx.session = !ctx.session ? {} : null;
        ctx.session.step = 'edit_service_vpn';
        ctx.session.service_id = serviceId;

        return await ctx.reply(
            '✍️ Пожалуйста, отправьте новый пост c описанием сервиса'
            + `<blockquote>Это может быть, простое текстовое сообщение или сообщение с фото, или видео</blockquote>`
            + `<blockquote>В посте может быть, только одно фото или одно видео</blockquote>`,
            { parse_mode: 'HTML' }
        );
    }

    async sendService(ctx, serviceId = null) {
        const adminTgId = process.env.BOT_OWNER_ID;
        const message = ctx.update?.message ?? ctx.message;
        const keyboard = [];
        const entities = message?.caption_entities ?? message?.entities ?? [];
        const sourceText = message?.caption ?? message?.text ?? '';
        const user = await this._dbRequests.getUserByUserTgId(adminTgId);
        const oldServiceId = serviceId;
        const srvice = {
            id: serviceId,
            user_id: user.id,
            raw: message,
        };
        serviceId = await this._dbRequests.updateOrInsertService(srvice);
        let price = await this._sendMessages.getPriceService(serviceId);
        if (price.length > 0) {
            keyboard.push(
                [Markup.button.callback('Оплатить доступ к VPN', JSON.stringify({ action: 'subscribe_service', serviceId: serviceId }))]
            );
        }
        keyboard.push(
            [Markup.button.callback('⚙️ Настроить стоимость подписки', JSON.stringify({ action: 'settings_up', serviceId: serviceId }))]
        );
        keyboard.push(
            [Markup.button.callback('📋 Изменить пост сервиса', JSON.stringify({ action: 'edit_service_vpn', serviceId: serviceId }))]
        );
        price = price.length > 0 ? `\n\nСтоимость подписки:${price}` : '\n\n🔴 Не настроена стоимость подписки!'
        const postText = `${sourceText}${price}`;
        try {
            const fileId = message.video?.file_id ?? message.photo?.pop().file_id ?? null;
            if (message.photo) {
                await this._bot.telegram.sendPhoto(
                    adminTgId,
                    fileId,
                    {
                        caption: postText,
                        caption_entities: entities,
                        disable_web_page_preview: true,
                        ...Markup.inlineKeyboard(keyboard)
                    }
                );
            }
            if (message.video) {
                await this._bot.telegram.sendVideo(
                    adminTgId,
                    fileId,
                    {
                        caption: postText,
                        caption_entities: entities,
                        disable_web_page_preview: true,
                        ...Markup.inlineKeyboard(keyboard)
                    }
                );
            }
            if (!message.photo && !message.video) {
                await this._bot.telegram.sendMessage(
                    adminTgId,
                    postText,
                    {
                        entities: entities,
                        disable_web_page_preview: true,
                        ...Markup.inlineKeyboard(keyboard)
                    }
                );
            }

            if (oldServiceId) {
                await this._bot.telegram.sendMessage(
                    adminTgId,
                    '✅ <b>Пост сервиса успешно обновлен!</b>',
                    { parse_mode: 'HTML' }
                );
            } else {
                await this._bot.telegram.sendMessage(
                    adminTgId,
                    '✅ <b>Сервис VPN успешно добавлен!</b>',
                    { parse_mode: 'HTML' }
                );
            }
        } catch (error) {
            console.error(`Ошибка отправки сообщения пользователю с ID: ${adminTgId}`, error);
        }

        return;
    }

    async settingsUp(serviceId, ctx) {
        try {
            ctx.answerCbQuery('Загрузка...');
        } catch (error) { }

        ctx.session = null;
        const serviceMeta = await this._dbRequests.getServiceMeta(serviceId);
        ctx.session.notification_chat_id = process.env.NOTIFICATION_CHAT_ID.length > 0 ? process.env.NOTIFICATION_CHAT_ID : process.env.BOT_OWNER_ID;
        ctx.session.payment_type_card = serviceMeta ? +await serviceMeta.find(meta => meta.meta_key == 'payment_type_card')?.meta_value : 0;
        ctx.session.payment_type_star = serviceMeta ? +await serviceMeta.find(meta => meta.meta_key == 'payment_type_star')?.meta_value : 0;
        ctx.session.payment_type_crypto = serviceMeta ? +await serviceMeta.find(meta => meta.meta_key == 'payment_type_crypto')?.meta_value : 0;
        ctx.session.service_id = serviceId;

        let message = `✍️ Выбирите <b>Способ оплаты</b>, который нужно настроить в первую очередь:`;
        const keyboard = [
            [
                Markup.button.callback('💳 На карту', JSON.stringify({ action: 'settings_payment_card' })),
                Markup.button.callback('💳 Удалить способ', JSON.stringify({ action: 'remove_settings_payment_card' }))
            ]
        ];
        keyboard.push([
            Markup.button.callback('⭐️ Звезды Telegram', JSON.stringify({ action: 'settings_payment_stars' })),
            Markup.button.callback('⭐️ Удалить способ', JSON.stringify({ action: 'remove_settings_payment_stars' }))
        ]);
        keyboard.push([
            Markup.button.callback('💰 Крипто кошелек', JSON.stringify({ action: 'settings_payment_crypto' })),
            Markup.button.callback('💰 Удалить способ', JSON.stringify({ action: 'remove_settings_payment_crypto' }))
        ]);

        let sentMessage = await ctx.reply(
            message,
            {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard(keyboard)
            }
        );

        ctx.session.lastMessageId = sentMessage.message_id;
        return;
    }

    async settingsAskPaymentCard(ctx) {
        try {
            if (ctx.session.lastMessageId) {
                ctx.deleteMessage(ctx.session.lastMessageId)
                    .catch((err) => console.log('Ошибка при удалении сообщения'));
            }
            ctx.answerCbQuery('Загрузка...');
        } catch (error) { }

        ctx.session.step = 'settings_ask_payment_card';
        let sentMessage = await ctx.reply(
            '✍️ Пожалуйста, укажите нужна ли настройка оплаты - 💳 перевод на карту физ. лица.',
            {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([
                    [
                        Markup.button.callback('Да', JSON.stringify({ action: 'settings_payment_card_yes' })),
                        Markup.button.callback('Нет', JSON.stringify({ action: 'settings_payment_card_no' }))
                    ],
                ])
            }
        );

        ctx.session.lastMessageId = sentMessage.message_id;
        return;
    }

    async settingsPaymentCard(ctx) {
        try {
            if (ctx.session.lastMessageId) {
                ctx.deleteMessage(ctx.session.lastMessageId)
                    .catch((err) => console.log('Ошибка при удалении сообщения'));
            }
            ctx.answerCbQuery('Загрузка...');
        } catch (error) { }

        ctx.session.step = 'settings_card_number';
        ctx.session.payment_type_card = 1;

        const keyboard = [];
        if (ctx.update?.callback_query?.from.id == process.env.BOT_OWNER_ID) {
            keyboard.push([
                Markup.button.callback('⬅️ Назад', JSON.stringify({ action: 'settings_back', step: 'settings_ask_payment_card' }))
            ]);
        }

        let sentMessage = await ctx.reply(
            '✍️ Пожалуйста, введите <b>Номер карты</b> или <b>Номер телефона.</b>'
            + '<blockquote>Телефон в формате 79001231212\nНомер карты в формате 1234123412341234</blockquote>',
            {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard(keyboard)
            }
        );

        ctx.session.lastMessageId = sentMessage.message_id;
        return;
    }

    async settingsBankName(ctx) {
        try {
            if (ctx.session.lastMessageId) {
                ctx.deleteMessage(ctx.session.lastMessageId)
                    .catch((err) => console.log('Ошибка при удалении сообщения'));
            }
            ctx.answerCbQuery('Загрузка...');
        } catch (error) { }

        ctx.session.step = 'settings_bank_name';
        let sentMessage = await ctx.reply(
            '✍️ Пожалуйста, введите <b>Название банка.</b>',
            {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('⬅️ Назад', JSON.stringify({ action: 'settings_back', step: 'settings_payment_card' }))]
                ])
            }
        );

        ctx.session.lastMessageId = sentMessage.message_id;
        return;
    }

    async settingsReceiverName(ctx) {
        try {
            if (ctx.session.lastMessageId) {
                ctx.deleteMessage(ctx.session.lastMessageId)
                    .catch((err) => console.log('Ошибка при удалении сообщения'));
            }
            ctx.answerCbQuery('Загрузка...');
        } catch (error) { }

        ctx.session.step = 'settings_receiver_name';
        let sentMessage = await ctx.reply(
            '✍️ Пожалуйста, введите <b>Имя получателя.</b>',
            {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('⬅️ Назад', JSON.stringify({ action: 'settings_back', step: 'settings_bank_name' }))]
                ])
            }
        );

        ctx.session.lastMessageId = sentMessage.message_id;
        return;
    }

    async settingsCardPrice1(ctx) {
        try {
            if (ctx.session.lastMessageId) {
                ctx.deleteMessage(ctx.session.lastMessageId)
                    .catch((err) => console.log('Ошибка при удалении сообщения'));
            }
            ctx.answerCbQuery('Загрузка...');
        } catch (error) { }

        ctx.session.step = 'settings_card_price_1';
        let sentMessage = await ctx.reply(
            '✍️ Пожалуйста, введите <b>стоимость подписки за 1 месяц.</b>'
            + `<blockquote>Вводите только целые числа, стоимость указывается в рублях.</blockquote>`,
            {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('⬅️ Назад', JSON.stringify({ action: 'settings_back', step: 'settings_receiver_name' }))]
                ])
            }
        );

        ctx.session.lastMessageId = sentMessage.message_id;
        return;
    }

    async settingsCardPrice6(ctx) {
        try {
            if (ctx.session.lastMessageId) {
                ctx.deleteMessage(ctx.session.lastMessageId)
                    .catch((err) => console.log('Ошибка при удалении сообщения'));
            }
            ctx.answerCbQuery('Загрузка...');
        } catch (error) { }

        ctx.session.step = 'settings_card_price_6';
        let sentMessage = await ctx.reply(
            '✍️ Пожалуйста, введите <b>стоимость подписки за 6 месяцев.</b>'
            + `<blockquote>Вводите только целые числа, стоимость указывается в рублях.</blockquote>`,
            {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('⬅️ Назад', JSON.stringify({ action: 'settings_back', step: 'settings_card_price_1' }))]
                ])
            }
        );

        ctx.session.lastMessageId = sentMessage.message_id;
        return;
    }

    async settingsCardPrice12(ctx) {
        try {
            if (ctx.session.lastMessageId) {
                ctx.deleteMessage(ctx.session.lastMessageId)
                    .catch((err) => console.log('Ошибка при удалении сообщения'));
            }
            ctx.answerCbQuery('Загрузка...');
        } catch (error) { }

        ctx.session.step = 'settings_card_price_12';
        let sentMessage = await ctx.reply(
            '✍️ Пожалуйста, введите <b>стоимость подписки за 12 месяцев.</b>'
            + `<blockquote>Вводите только целые числа, стоимость указывается в рублях.</blockquote>`,
            {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('⬅️ Назад', JSON.stringify({ action: 'settings_back', step: 'settings_card_price_6' }))]
                ])
            }
        );

        ctx.session.lastMessageId = sentMessage.message_id;
        return;
    }

    async settingsAskPaymentStars(ctx) {
        try {
            if (ctx.session.lastMessageId) {
                ctx.deleteMessage(ctx.session.lastMessageId)
                    .catch((err) => console.log('Ошибка при удалении сообщения'));
            }
            ctx.answerCbQuery('Загрузка...');
        } catch (error) { }

        ctx.session.step = 'settings_ask_payment_stars';
        let sentMessage = await ctx.reply(
            '✍️ Пожалуйста, укажите нужна ли настройка оплаты ⭐️ звездами Telegram.',
            {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([
                    [
                        Markup.button.callback('Да', JSON.stringify({ action: 'settings_payment_stars_yes' })),
                        Markup.button.callback('Нет', JSON.stringify({ action: 'settings_payment_stars_no' }))
                    ],
                ])
            }
        );

        ctx.session.lastMessageId = sentMessage.message_id;
        return;
    }

    async settingsPaymentStars(ctx) {
        try {
            if (ctx.session.lastMessageId) {
                ctx.deleteMessage(ctx.session.lastMessageId)
                    .catch((err) => console.log('Ошибка при удалении сообщения'));
            }
            ctx.answerCbQuery('Загрузка...');
        } catch (error) { }

        ctx.session.step = 'settings_star_price_1';
        ctx.session.payment_type_star = 1;
        let sentMessage = await ctx.reply(
            '✍️ Пожалуйста, введите <b>⭐️ стоимость подписки за 1 месяц.</b>'
            + `<blockquote>Вводите только целые числа, стоимость указывается в количестве ⭐️ звезд Telegram.</blockquote>`,
            {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('⬅️ Назад', JSON.stringify({ action: 'settings_back', step: 'settings_ask_payment_stars' }))]
                ])
            }
        );

        ctx.session.lastMessageId = sentMessage.message_id;
        return;
    }

    async settingsStarPrice6(ctx) {
        try {
            if (ctx.session.lastMessageId) {
                ctx.deleteMessage(ctx.session.lastMessageId)
                    .catch((err) => console.log('Ошибка при удалении сообщения'));
            }
            ctx.answerCbQuery('Загрузка...');
        } catch (error) { }

        ctx.session.step = 'settings_star_price_6';
        let sentMessage = await ctx.reply(
            '✍️ Пожалуйста, введите <b>⭐️ стоимость подписки за 6 месяцев.</b>'
            + `<blockquote>Вводите только целые числа, стоимость указывается в количестве ⭐️ звезд Telegram.</blockquote>`,
            {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('⬅️ Назад', JSON.stringify({ action: 'settings_back', step: 'settings_payment_star' }))]
                ])
            }
        );

        ctx.session.lastMessageId = sentMessage.message_id;
        return;
    }

    async settingsStarPrice12(ctx) {
        try {
            if (ctx.session.lastMessageId) {
                ctx.deleteMessage(ctx.session.lastMessageId)
                    .catch((err) => console.log('Ошибка при удалении сообщения'));
            }
            ctx.answerCbQuery('Загрузка...');
        } catch (error) { }

        ctx.session.step = 'settings_star_price_12';
        let sentMessage = await ctx.reply(
            '✍️ Пожалуйста, введите <b>⭐️ стоимость подписки за 12 месяцев.</b>'
            + `<blockquote>Вводите только целые числа, стоимость указывается в количестве ⭐️ звезд Telegram.</blockquote>`,
            {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('⬅️ Назад', JSON.stringify({ action: 'settings_back', step: 'settings_star_price_6' }))]
                ])
            }
        );

        ctx.session.lastMessageId = sentMessage.message_id;
        return;
    }

    async settingsAskPaymentCrypto(ctx) {
        try {
            if (ctx.session.lastMessageId) {
                ctx.deleteMessage(ctx.session.lastMessageId)
                    .catch((err) => console.log('Ошибка при удалении сообщения'));
            }
            ctx.answerCbQuery('Загрузка...');
        } catch (error) { }

        ctx.session.step = 'settings_ask_payment_crypto';
        let sentMessage = await ctx.reply(
            '✍️ Пожалуйста, укажите нужна ли настройка оплаты - 💰 перевод на крипто кошелек',
            {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([
                    [
                        Markup.button.callback('Да', JSON.stringify({ action: 'settings_payment_crypto_yes' })),
                        Markup.button.callback('Нет', JSON.stringify({ action: 'settings_payment_crypto_no' }))
                    ],
                ])
            }
        );

        ctx.session.lastMessageId = sentMessage.message_id;
        return;
    }

    async settingsWalletCrypto(ctx) {
        try {
            if (ctx.session.lastMessageId) {
                ctx.deleteMessage(ctx.session.lastMessageId)
                    .catch((err) => console.log('Ошибка при удалении сообщения'));
            }
            ctx.answerCbQuery('Загрузка...');
        } catch (error) { }

        ctx.session.step = 'settings_crypto_wallet';
        ctx.session.payment_type_crypto = 1;

        const keyboard = [];
        if (ctx.update?.callback_query?.from.id == process.env.BOT_OWNER_ID) {
            keyboard.push([
                Markup.button.callback('⬅️ Назад', JSON.stringify({ action: 'settings_back', step: 'settings_ask_payment_crypto' }))
            ]);
        }

        let sentMessage = await ctx.reply(
            '✍️ Пожалуйста, введите <b>Адрес крипто кошелька</b>',
            {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard(keyboard)
            }
        );

        ctx.session.lastMessageId = sentMessage.message_id;
        return;
    }

    async settingsСurrencyCrypto(ctx) {
        try {
            if (ctx.session.lastMessageId) {
                ctx.deleteMessage(ctx.session.lastMessageId)
                    .catch((err) => console.log('Ошибка при удалении сообщения'));
            }
            ctx.answerCbQuery('Загрузка...');
        } catch (error) { }

        ctx.session.step = 'settings_crypto_currency';
        let sentMessage = await ctx.reply(
            '✍️ Пожалуйста, введите <b>Название крипто валюты</b>'
            + '<blockquote>Например USDT или BTC</blockquote>',
            {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('⬅️ Назад', JSON.stringify({ action: 'settings_back', step: 'settings_crypto_wallet' }))]
                ])
            }
        );

        ctx.session.lastMessageId = sentMessage.message_id;
        return;
    }

    async settingsNetworkCrypto(ctx) {
        try {
            if (ctx.session.lastMessageId) {
                ctx.deleteMessage(ctx.session.lastMessageId)
                    .catch((err) => console.log('Ошибка при удалении сообщения'));
            }
            ctx.answerCbQuery('Загрузка...');
        } catch (error) { }

        ctx.session.step = 'settings_crypto_network';
        let sentMessage = await ctx.reply(
            '✍️ Пожалуйста, введите <b>Идентификатор сети</b>'
            + '<blockquote>Например TRC20 или ERC20</blockquote>',
            {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('⬅️ Назад', JSON.stringify({ action: 'settings_back', step: 'settings_crypto_currency' }))]
                ])
            }
        );

        ctx.session.lastMessageId = sentMessage.message_id;
        return;
    }

    async settingsCryptoPrice1(ctx) {
        try {
            if (ctx.session.lastMessageId) {
                ctx.deleteMessage(ctx.session.lastMessageId)
                    .catch((err) => console.log('Ошибка при удалении сообщения'));
            }
            ctx.answerCbQuery('Загрузка...');
        } catch (error) { }

        ctx.session.step = 'settings_crypto_price_1';
        let sentMessage = await ctx.reply(
            '✍️ Пожалуйста, введите <b>стоимость подписки за 1 месяц.</b>'
            + `<blockquote>Вводите только целые числа, стоимость указывается в рублях.</blockquote>`,
            {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('⬅️ Назад', JSON.stringify({ action: 'settings_back', step: 'settings_crypto_network' }))]
                ])
            }
        );

        ctx.session.lastMessageId = sentMessage.message_id;
        return;
    }

    async settingsCryptoPrice6(ctx) {
        try {
            if (ctx.session.lastMessageId) {
                ctx.deleteMessage(ctx.session.lastMessageId)
                    .catch((err) => console.log('Ошибка при удалении сообщения'));
            }
            ctx.answerCbQuery('Загрузка...');
        } catch (error) { }

        ctx.session.step = 'settings_crypto_price_6';
        let sentMessage = await ctx.reply(
            '✍️ Пожалуйста, введите <b>стоимость подписки за 6 месяцев.</b>'
            + `<blockquote>Вводите только целые числа, стоимость указывается в рублях.</blockquote>`,
            {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('⬅️ Назад', JSON.stringify({ action: 'settings_back', step: 'settings_crypto_price_1' }))]
                ])
            }
        );

        ctx.session.lastMessageId = sentMessage.message_id;
        return;
    }

    async settingsCryptoPrice12(ctx) {
        try {
            if (ctx.session.lastMessageId) {
                ctx.deleteMessage(ctx.session.lastMessageId)
                    .catch((err) => console.log('Ошибка при удалении сообщения'));
            }
            ctx.answerCbQuery('Загрузка...');
        } catch (error) { }

        ctx.session.step = 'settings_crypto_price_12';
        let sentMessage = await ctx.reply(
            '✍️ Пожалуйста, введите <b>стоимость подписки за 12 месяцев.</b>'
            + `<blockquote>Вводите только целые числа, стоимость указывается в рублях.</blockquote>`,
            {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('⬅️ Назад', JSON.stringify({ action: 'settings_back', step: 'settings_crypto_price_12' }))]
                ])
            }
        );

        ctx.session.lastMessageId = sentMessage.message_id;
        return;
    }

    async saveServiceSettings(ctx) {
        for (let key in ctx.session) {
            if (
                key == 'notification_chat_id'
                || key == 'payment_type_card'
                || key == 'payment_number'
                || key == 'bank_name'
                || key == 'receiver_name'
                || key == 'card_price_1'
                || key == 'card_price_6'
                || key == 'card_price_12'
                || key == 'payment_type_star'
                || key == 'star_price_1'
                || key == 'star_price_6'
                || key == 'star_price_12'
                || key == 'payment_type_crypto'
                || key == 'crypto_wallet'
                || key == 'crypto_currency'
                || key == 'crypto_network'
                || key == 'crypto_price_1'
                || key == 'crypto_price_6'
                || key == 'crypto_price_12'
            ) {
                const serviceMeta = {
                    service_id: ctx.session.service_id,
                    meta_key: key,
                    meta_value: ctx.session[key],
                };
                await this._dbRequests.updateOrInsertServiceMeta(serviceMeta);
            }
        }
    }

    async settingsNoSettings(ctx) {
        if (ctx.session.lastMessageId) {
            ctx.deleteMessage(ctx.session.lastMessageId)
                .catch((err) => console.log('Ошибка при удалении сообщения'));
        }

        await ctx.reply(
            '✅ <b>Настройка завершена!</b>'
            + `\n<blockquote>Для настройки дполнительного спосба оплаты нажмите "Настроить стоимость"</blockquote>`,
            { parse_mode: 'HTML' }
        );

        await this.saveServiceSettings(ctx);
        const service = await this._dbRequests.getServiceById(ctx.session.service_id);
        await this._sendMessages.sendMessageAboutService(service, ctx);
        ctx.session = null;
        if (ctx.update?.message?.text) {
            ctx.update.message.text = null;
        }
        return;
    }

    async settingsBack(step, ctx) {
        try {
            if (ctx.session.lastMessageId) {
                ctx.deleteMessage(ctx.session.lastMessageId)
                    .catch((err) => console.log('Ошибка при удалении сообщения'));
            }
            ctx.answerCbQuery('Загрузка...');
        } catch (error) { }

        ctx.session.step = step;

        if (ctx.session.step == 'settings_ask_payment_card') {
            return this.settingsAskPaymentCard(ctx);
        }
        if (ctx.session.step == 'settings_payment_card') {
            return this.settingsPaymentCard(ctx);
        }
        if (ctx.session.step == 'settings_bank_name') {
            return this.settingsBankName(ctx);
        }
        if (ctx.session.step == 'settings_receiver_name') {
            return this.settingsReceiverName(ctx);
        }
        if (ctx.session.step == 'settings_card_price_1') {
            return this.settingsCardPrice1(ctx);
        }
        if (ctx.session.step == 'settings_card_price_6') {
            return this.settingsCardPrice6(ctx);
        }
        if (ctx.session.step == 'settings_ask_payment_stars') {
            return this.settingsAskPaymentStars(ctx);
        }
        if (ctx.session.step == 'settings_payment_star') {
            return this.settingsPaymentStars(ctx);
        }
        if (ctx.session.step == 'settings_star_price_6') {
            return this.settingsStarPrice6(ctx);
        }
        if (ctx.session.step == 'settings_ask_payment_crypto') {
            return this.settingsAskPaymentCrypto(ctx);
        }
        if (ctx.session.step == 'settings_crypto_wallet') {
            return this.settingsWalletCrypto(ctx);
        }
        if (ctx.session.step == 'settings_crypto_currency') {
            return this.settingsСurrencyCrypto(ctx);
        }
        if (ctx.session.step == 'settings_crypto_network') {
            return this.settingsNetworkCrypto(ctx);
        }
        if (ctx.session.step == 'settings_crypto_price_1') {
            return this.settingsCryptoPrice1(ctx);
        }
        if (ctx.session.step == 'settings_crypto_price_6') {
            return this.settingsCryptoPrice6(ctx);
        }
    }
}

module.exports = { SettingsService }