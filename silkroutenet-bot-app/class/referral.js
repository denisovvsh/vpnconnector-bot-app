require('dotenv').config();
const { link } = require('fs');
const { Markup } = require('telegraf');

class Referral {
    constructor(bot, dbRequests) {
        this._bot = bot;
        this._dbRequests = dbRequests;
    }

    async getReferralLink(ctx) {
        const user = await this._dbRequests.getUserByUserTgId(ctx.from.id);
        const utm = ctx.from.id;
        const link = `${process.env.BOT_LINK}?start=${utm}`;
        const dataReferralLink = {
            user_id: user.id,
            link: link,
            utm: utm
        };
        await this._dbRequests.updateOrInsertListReferralLinks(dataReferralLink);
        await this._bot.telegram.sendMessage(
            ctx.from.id,
            `🔰 Распространяйте свою реферальную ссылку 🔗 и получайте бонус за приведенных клиентов.`
            + `\n<b>Ваша ссылка:</b>`
            + `\n<pre>${link}</pre>`,
            {
                parse_mode: 'HTML',
                disable_web_page_preview: true,
                ...Markup.inlineKeyboard([
                    [Markup.button.url('Обсудить условия', process.env.BOT_LINK_SUPPORT)]
                ])
            }
        );
        return;
    }
}

module.exports = { Referral };