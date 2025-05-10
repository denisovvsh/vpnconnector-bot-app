require('dotenv').config();
const Excel = require('exceljs');

class Reports {
    constructor(dbRequests) {
        this._dbRequests = dbRequests;
        this._dir = './reports/';
    }

    async generateUsers(ctx) {
        const users = await this._dbRequests.getUsers(ctx);
        if (!users) return false;
        const workbook = new Excel.Workbook();
        const worksheet = workbook.addWorksheet('Users');

        worksheet.columns = [
            { header: 'ID пользователя', key: 'user_tg_id', width: 20 },
            { header: 'Имя', key: 'first_name', width: 20 },
            { header: 'Фамилия', key: 'last_name', width: 20 },
            { header: 'Имя пользователя', key: 'username', width: 20 },
            { header: 'Телефон', key: 'phone', width: 20 },
            { header: 'Язык', key: 'language_code', width: 10 },
            { header: 'Премиум', key: 'is_premium', width: 10 },
            { header: 'Дата добавления', key: 'create_at', width: 20 }
        ];

        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

        for (let user of users) {
            user.is_premium = (user.is_premium == 1) ? 'Да' : 'Нет';

            if (user.username) {
                user.username = '@' + user.username;
            }

            worksheet.addRow(user);
        }

        const filePath = this._dir + process.env.BOT_ID + '_users.xlsx';
        await workbook.xlsx.writeFile(filePath);

        return filePath;
    }

    async generateListReferralLeadsByAdmin(ctx) {
        if (ctx.from.id != process.env.BOT_OWNER_ID) return false;
        const leads = await this._dbRequests.getTransactionsWithReferralForAdmin();
        if (!leads) return false;

        const workbook = new Excel.Workbook();
        const worksheet = workbook.addWorksheet('Leads');

        worksheet.columns = [
            { header: 'Статус Транзакции', key: 'status', width: 20 },
            { header: 'Дата создания записи', key: 'create_at', width: 30 },
            { header: 'Сумма оплаты', key: 'price_type', width: 30 },
            { header: 'Лид Имя', key: 'first_name', width: 20 },
            { header: 'Лид Фамилия', key: 'last_name', width: 20 },
            { header: 'Лид Имя пользователя', key: 'username', width: 20 },
            { header: 'Лид Телефон', key: 'phone', width: 20 },
            { header: 'Реферал Имя', key: 'referral_first_name', width: 20 },
            { header: 'Реферал Фамилия', key: 'referral_last_name', width: 20 },
            { header: 'Реферал Имя пользователя', key: 'referral_username', width: 20 },
            { header: 'Реферал Телефон', key: 'referral_phone', width: 20 },
            { header: 'UTM метка', key: 'referral_utm', width: 20 },
            { header: 'Дата записи метки', key: 'referral_utm_create_at', width: 20 },
        ];

        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

        for (let lead of leads) {
            // if (
            //     botAdmin == lead.user_tg_id
            // ) continue;

            const serviceMeta = await this._dbRequests.getServiceMeta(lead.service_id);
            const pricePayment = serviceMeta ? await serviceMeta.find(meta => meta.meta_key == lead.price_type)?.meta_value : 0;
            let priceType = '';
            if (lead.price_type.startsWith('card_price_')) {
                priceType = `${pricePayment} Перевод на карту`;
            }
            if (lead.price_type.startsWith('crypto_price_')) {
                priceType = `${pricePayment} Перевод на криптокошелек`;
            }
            if (lead.price_type.startsWith('star_price_')) {
                priceType = `${pricePayment} Перевод на звезды Telegram`;
            }
            lead.price_type = priceType
            lead.status = (lead.status == 1) ? 'Оплачено' : 'Не оплачено';
            if (lead.username) lead.username = '@' + lead.username;
            if (lead.referral_username) lead.referral_username = '@' + lead.referral_username;

            const date = new Date(lead.create_at);
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0'); // Месяцы начинаются с 0
            const year = date.getFullYear();

            lead.create_at = `${day}.${month}.${year}`;

            worksheet.addRow(lead);
        }

        const filePath = this._dir + process.env.BOT_ID + '_leads.xlsx';
        await workbook.xlsx.writeFile(filePath);

        return filePath;
    }

    async generateListReferralLeadsByReferal(ctx) {
        const user = await this._dbRequests.getUserByUserTgId(ctx.from.id);
        const leads = await this._dbRequests.getTransactionsWithReferralByUserId(user.id);
        if (!leads) return false;

        const workbook = new Excel.Workbook();
        const worksheet = workbook.addWorksheet('Leads');

        worksheet.columns = [
            { header: 'Статус Транзакции', key: 'status', width: 20 },
            { header: 'Дата создания записи', key: 'create_at', width: 30 },
            { header: 'Сумма оплаты', key: 'price_type', width: 30 },
            { header: 'Спосб оплаты оплаты', key: 'price_type', width: 30 },
            { header: 'Лид Имя', key: 'first_name', width: 20 },
            { header: 'Лид Фамилия', key: 'last_name', width: 20 },
            { header: 'Лид Имя пользователя', key: 'username', width: 20 },
            { header: 'Лид Телефон', key: 'phone', width: 20 },
            { header: 'UTM метка', key: 'referral_utm', width: 20 },
            { header: 'Дата записи метки', key: 'referral_utm_create_at', width: 20 },
        ];

        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

        for (let lead of leads) {
            const serviceMeta = await this._dbRequests.getServiceMeta(lead.service_id);
            const pricePayment = serviceMeta ? await serviceMeta.find(meta => meta.meta_key == lead.price_type)?.meta_value : 0;
            let priceType = '';
            if (lead.price_type.startsWith('card_price_')) {
                priceType = `${pricePayment} Перевод на карту`;
            }
            if (lead.price_type.startsWith('crypto_price_')) {
                priceType = `${pricePayment} Перевод на криптокошелек`;
            }
            if (lead.price_type.startsWith('star_price_')) {
                priceType = `${pricePayment} Перевод на звезды Telegram`;
            }
            lead.price_type = priceType
            lead.status = (lead.status == 1) ? 'Оплачено' : 'Не оплачено';
            if (lead.username) lead.username = '@' + lead.username;

            const date = new Date(lead.create_at);
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0'); // Месяцы начинаются с 0
            const year = date.getFullYear();

            lead.create_at = `${day}.${month}.${year}`;

            worksheet.addRow(lead);
        }

        const filePath = this._dir + ctx.from.id + '_leads.xlsx';
        await workbook.xlsx.writeFile(filePath);

        return filePath;
    }
}

module.exports = { Reports };