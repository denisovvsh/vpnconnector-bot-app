const mysql = require('mysql2/promise');
require('dotenv').config();

class DbRequests {
    constructor(botTgId) {
        this._botTgId = botTgId;
        this._db = mysql.createPool({
            host: process.env.MYSQL_ROOT_HOST,
            user: process.env.MYSQL_USER,
            password: process.env.MYSQL_PASSWORD,
            database: process.env.MYSQL_DATABASE,
        });
    }

    async getBotOptions() {
        try {
            const [rows] = await this._db.query(
                'SELECT * FROM bot_options WHERE bot_tg_id = ?',
                [this._botTgId]
            );
            if (rows.length > 0) {
                return rows;
            }

            return false;

        } catch (error) {
            console.error('Error:', error);
        }
    }

    async getAdmins() {
        try {
            const [rows] = await this._db.query(`
                SELECT 
                    a.*,
                    u.id AS user_id
                FROM admins a
                JOIN users u ON a.user_tg_id = u.user_tg_id AND a.bot_tg_id = u.admin_bot_tg_id
                WHERE bot_tg_id = ?;
            `, [this._botTgId]);

            if (rows.length > 0) {
                return rows;
            }

            return false;

        } catch (error) {
            console.error('Error:', error);
        }
    }

    async getAdminListByUserTgId(userTgId) {
        try {
            const [rows] = await this._db.query(`
                SELECT 
                    a.*,
                    u.id AS user_id
                FROM admins a
                JOIN users u ON a.user_tg_id = u.user_tg_id AND a.bot_tg_id = u.admin_bot_tg_id
                WHERE a.bot_tg_id = ? AND a.user_tg_id = ?;
            `, [this._botTgId, userTgId]);

            if (rows.length > 0) {
                return rows;
            }

            return false;

        } catch (error) {
            console.error('Error:', error);
        }
    }

    async getAdminByChatTgId(chatTgId) {
        try {
            const [rows] = await this._db.query(`
                SELECT 
                    a.*,
                    u.id AS user_id
                FROM admins a
                JOIN users u ON a.user_tg_id = u.user_tg_id AND a.bot_tg_id = u.admin_bot_tg_id
                WHERE a.bot_tg_id = ? AND a.channel_id = ? LIMIT 1;
            `, [this._botTgId, chatTgId]);

            if (rows.length > 0) {
                return rows[0];
            }

            return false;

        } catch (error) {
            console.error('Error:', error);
        }
    }

    async addAdmin(userTgId, channelId, role, isActive = 1) {
        try {
            // Добавить запись, если она не существует
            const result = await this._db.query(
                `INSERT INTO admins (user_tg_id, channel_id, role, is_active, bot_tg_id)
                 SELECT ?, ?, ?, ?, ?
                 WHERE NOT EXISTS (SELECT 1 FROM admins WHERE user_tg_id = ? AND bot_tg_id = ? AND channel_id = ?);`,
                [
                    userTgId, channelId, role, isActive, this._botTgId,
                    userTgId, this._botTgId, channelId
                ]
            );

            return result[0].insertId;
        } catch (error) {
            console.error('Error inserting admin', error);
        }
    }

    async deleteAdmin(userTgId) {
        try {
            // Удалить запись, если она существует
            await this._db.query(
                `DELETE FROM admins
                 WHERE user_tg_id = ? AND bot_tg_id = ?;`,
                [userTgId, this._botTgId]
            );

            return;
        } catch (error) {
            console.error('Error deleting admin', error);
        }
    }

    async updateOrInsertUser(user) {
        try {
            let result = await this._db.query(
                `UPDATE users
                 SET user_tg_id = ?, first_name = ?, last_name = ?, username = ?, phone = ?, is_premium = ?, is_active = ?, update_at = NOW()
                 WHERE (user_tg_id = ? OR (user_tg_id IS NULL AND phone LIKE ?)) AND admin_bot_tg_id = ?`,
                [
                    user.user_tg_id, user.first_name, user.last_name, user.username,
                    user.phone, user.is_premium, user.is_active,
                    user.user_tg_id, `%${user.phone}%`, this._botTgId
                ]
            );

            if (result[0].affectedRows === 0) {
                result = await this._db.query(
                    `INSERT INTO users (user_tg_id, admin_bot_tg_id, is_bot, first_name, last_name, username, phone, language_code, is_premium, is_active, create_at, update_at)
                     SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW()
                     WHERE NOT EXISTS (SELECT 1 FROM users WHERE (user_tg_id = ? OR (user_tg_id IS NULL AND phone LIKE ?)) AND admin_bot_tg_id = ?)`,
                    [
                        user.user_tg_id, this._botTgId, user.is_bot, user.first_name, user.last_name, user.username,
                        user.phone, user.language_code, user.is_premium, user.is_active,
                        user.user_tg_id, `%${user.phone}%`, this._botTgId
                    ]
                );

                return result[0].insertId;
            }

            return;
        } catch (error) {
            console.error('Error updating or inserting user:', error);
        }
    }

    async updateOrInsertUserMeta(userMeta = null) {
        try {
            if (!userMeta) return;

            let result = await this._db.query(
                `UPDATE users_meta
                 SET meta_value = ?
                 WHERE user_id = ? AND meta_key = ?`,
                [
                    userMeta.meta_value,
                    userMeta.user_id, userMeta.meta_key
                ]
            );

            if (result[0].affectedRows === 0) {
                result = await this._db.query(
                    `INSERT INTO users_meta (user_id, meta_key, meta_value)
                 SELECT ?, ?, ?
                 WHERE NOT EXISTS (SELECT 1 FROM users_meta WHERE user_id = ? AND meta_key = ?)`,
                    [
                        userMeta.user_id, userMeta.meta_key, userMeta.meta_value,
                        userMeta.user_id, userMeta.meta_key
                    ]
                );

                return result[0].insertId;
            }

            return;
        } catch (error) {
            console.error('Error updating or inserting users_meta:', error);
        }
    }

    async updateOrInsertChatMeta(chatMeta = null) {
        try {
            if (!chatMeta) return;

            // Обновить значение, если запись существует
            let result = await this._db.query(
                `UPDATE chats_meta
                 SET meta_value = ?
                 WHERE chat_id = ? AND meta_key = ?`,
                [
                    chatMeta.meta_value,
                    chatMeta.chat_id, chatMeta.meta_key
                ]
            );

            // Добавить запись, если она не существует
            if (result[0].affectedRows === 0) {
                result = await this._db.query(
                    `INSERT INTO chats_meta (chat_id, meta_key, meta_value)
                 SELECT ?, ?, ?
                 WHERE NOT EXISTS (SELECT 1 FROM chats_meta WHERE chat_id = ? AND meta_key = ?)`,
                    [
                        chatMeta.chat_id, chatMeta.meta_key, chatMeta.meta_value,
                        chatMeta.chat_id, chatMeta.meta_key
                    ]
                );

                return result[0].insertId;
            }

            return;
        } catch (error) {
            console.error('Error updating or inserting post_meta:', error);
        }
    }

    async insertInviteLinks(data) {
        try {
            let result = await this._db.query(
                `INSERT INTO invite_links (admin_bot_tg_id, chat_tg_id, user_tg_id, link, create_at)
                 SELECT ?, ?, ?, ?, NOW()
                 WHERE NOT EXISTS (SELECT 1 FROM invite_links WHERE admin_bot_tg_id = ? AND chat_tg_id = ? AND user_tg_id = ? AND link = ?)`,
                [
                    this._botTgId, data.chat_tg_id, data.user_tg_id, data.link,
                    this._botTgId, data.chat_tg_id, data.user_tg_id, data.link,
                ]
            );

            return result[0].insertId;
        } catch (error) {
            console.error('Error updating or inserting invite_links:', error);
        }
    }

    async deleteInviteLinks(data) {
        try {
            // Удалить запись, если она существует
            await this._db.query(
                `DELETE FROM invite_links
                 WHERE admin_bot_tg_id = ? AND chat_tg_id = ? AND user_tg_id = ? AND link = ?;`,
                [this._botTgId, data.chat_tg_id, data.user_tg_id, data.link]
            );

            return;
        } catch (error) {
            console.error('Error deleting invite_links', error);
        }
    }

    async getInviteLinksByUserTgIdAndChatTgId(userTgId, chatTgId) {
        try {
            const [rows] = await this._db.query(`
                SELECT *
                FROM invite_links
                WHERE admin_bot_tg_id = ? AND user_tg_id = ? AND chat_tg_id = ?;
            `, [this._botTgId, userTgId, chatTgId]);

            if (rows.length > 0) {
                return rows;
            }

            return false;

        } catch (error) {
            console.error('Error:', error);
        }
    }

    async updateOrInsertTransactions(transaction) {
        try {
            let result = await this._db.query(
                `UPDATE transactions
                 SET price = ?, status = ?, price_type = ?, payment_id = ?, is_update_subscribe = ?, update_at = NOW()
                 WHERE user_id = ? AND chat_id = ? AND payment_id = ?`,
                [
                    transaction.price, transaction.status, transaction.price_type, transaction.payment_id, transaction.is_update_subscribe,
                    transaction.user_id, transaction.chat_id, transaction.payment_id
                ]
            );

            if (result[0].affectedRows === 0) {
                result = await this._db.query(
                    `INSERT INTO transactions (user_id, chat_id, price, status, price_type, payment_id, is_update_subscribe, update_at, create_at)
                 SELECT ?, ?, ?, ?, ?, ?, ?, NOW(), NOW()
                 WHERE NOT EXISTS (SELECT 1 FROM transactions WHERE user_id = ? AND chat_id = ? AND payment_id = ?)`,
                    [
                        transaction.user_id, transaction.chat_id, transaction.price, transaction.status,
                        transaction.price_type, transaction.payment_id, transaction.is_update_subscribe,
                        transaction.user_id, transaction.chat_id, transaction.payment_id
                    ]
                );

                return result[0].insertId;
            }

            return;
        } catch (error) {
            console.error('Error updating or inserting transactions:', error);
        }
    }

    async updateOrInsertAdminTransactions(transaction) {
        try {
            let result = await this._db.query(
                `UPDATE admin_transactions
                 SET price = ?, status = ?, price_type = ?, payment_id = ?, is_update_subscribe = ?, update_at = NOW()
                 WHERE user_id = ? AND payment_id = ?`,
                [
                    transaction.price, transaction.status, transaction.price_type, transaction.payment_id, transaction.is_update_subscribe,
                    transaction.user_id, transaction.payment_id
                ]
            );

            if (result[0].affectedRows === 0) {
                result = await this._db.query(
                    `INSERT INTO admin_transactions (user_id, price, status, price_type, payment_id, is_update_subscribe, update_at, create_at)
                 SELECT ?, ?, ?, ?, ?, ?, NOW(), NOW()
                 WHERE NOT EXISTS (SELECT 1 FROM admin_transactions WHERE user_id = ? AND payment_id = ?)`,
                    [
                        transaction.user_id, transaction.price, transaction.status,
                        transaction.price_type, transaction.payment_id, transaction.is_update_subscribe,
                        transaction.user_id, transaction.payment_id
                    ]
                );

                return result[0].insertId;
            }

            return;
        } catch (error) {
            console.error('Error updating or inserting transactions:', error);
        }
    }

    async updateOrInsertBilling(data) {
        try {
            let result = await this._db.query(
                `UPDATE billing
                 SET status = ?, update_at = NOW(), date_from = ?, date_to = ?
                 WHERE admin_bot_tg_id = ? AND chat_id = ? AND user_id = ?`,
                [
                    data.status, data.date_from, data.date_to,
                    this._botTgId, data.chat_id, data.user_id
                ]
            );

            if (result[0].affectedRows === 0) {
                result = await this._db.query(
                    `INSERT INTO billing (admin_bot_tg_id, chat_id, user_id, status, update_at, create_at, date_from, date_to)
                 SELECT ?, ?, ?, ?, NOW(), NOW(), ?, ?
                 WHERE NOT EXISTS (SELECT 1 FROM billing WHERE admin_bot_tg_id = ? AND chat_id = ? AND user_id = ?)`,
                    [
                        this._botTgId, data.chat_id, data.user_id, data.status, data.date_from, data.date_to,
                        this._botTgId, data.chat_id, data.user_id
                    ]
                );

                return result[0].insertId;
            }

            return;
        } catch (error) {
            console.error('Error updating or inserting billing:', error);
        }
    }

    async updateOrInsertBillingAdmin(data) {
        try {
            let result = await this._db.query(
                `UPDATE billing_admins
                 SET status = ?, update_at = NOW(), date_from = ?, date_to = ?
                 WHERE admin_bot_tg_id = ? AND user_id = ?`,
                [
                    data.status, data.date_from, data.date_to,
                    this._botTgId, data.user_id
                ]
            );

            if (result[0].affectedRows === 0) {
                result = await this._db.query(
                    `INSERT INTO billing_admins (admin_bot_tg_id, user_id, status, update_at, create_at, date_from, date_to)
                 SELECT ?, ?, ?, NOW(), NOW(), ?, ?
                 WHERE NOT EXISTS (SELECT 1 FROM billing_admins WHERE admin_bot_tg_id = ? AND user_id = ?)`,
                    [
                        this._botTgId, data.user_id, data.status, data.date_from, data.date_to,
                        this._botTgId, data.user_id
                    ]
                );

                return result[0].insertId;
            }

            return;
        } catch (error) {
            console.error('Error updating or inserting billing_admins:', error);
        }
    }

    async getBillingByOneMoreDay() {
        try {
            const [rows] = await this._db.query(
                `SELECT
                    b.*,
                    DATE_FORMAT(b.date_to, '%d.%m.%Y %H:%i') AS billing_date_to,
                    u.user_tg_id AS user_tg_id,
                    u.username AS username,
                    ch.id AS chat_id,
                    ch.chat_text_id AS chat_text_id,
                    ch.chat_tg_id AS chat_tg_id,
                    ch.type AS chat_type,
                    ch.title AS chat_title
                FROM billing b
                JOIN users u ON b.user_id = u.id AND b.admin_bot_tg_id = u.admin_bot_tg_id
                JOIN chats ch ON b.chat_id = ch.id
                WHERE b.admin_bot_tg_id = ?
                AND b.status = 1
                AND b.date_to BETWEEN NOW() AND NOW() + INTERVAL 2 DAY;`,
                [this._botTgId]
            );
            if (rows.length > 0) {
                return rows;
            }

            return false;

        } catch (error) {
            console.error('Error:', error);
        }
    }

    async getBillingAdminsByUserId(userId) {
        try {
            const [rows] = await this._db.query(
                `SELECT
                    b.*,
                    DATE_FORMAT(b.date_to, '%d.%m.%Y %H:%i') AS billing_date_to,
                    u.user_tg_id AS user_tg_id,
                    u.username AS username
                FROM billing_admins b
                JOIN users u ON b.user_id = u.id AND b.admin_bot_tg_id = u.admin_bot_tg_id
                WHERE b.admin_bot_tg_id = ?
                AND b.user_id = ?
                LIMIT 1;`,
                [this._botTgId, userId]
            );
            if (rows.length > 0) {
                return rows[0];
            }

            return false;

        } catch (error) {
            console.error('Error:', error);
        }
    }

    async getBillingAdminsByOneMoreDay() {
        try {
            const [rows] = await this._db.query(
                `SELECT
                    b.*,
                    DATE_FORMAT(b.date_to, '%d.%m.%Y %H:%i') AS billing_date_to,
                    u.user_tg_id AS user_tg_id,
                    u.username AS username
                FROM billing_admins b
                JOIN users u ON b.user_id = u.id AND b.admin_bot_tg_id = u.admin_bot_tg_id
                WHERE b.admin_bot_tg_id = ?
                AND b.status = 1
                AND b.date_to BETWEEN NOW() AND NOW() + INTERVAL 2 DAY;`,
                [this._botTgId]
            );
            if (rows.length > 0) {
                return rows;
            }

            return false;

        } catch (error) {
            console.error('Error:', error);
        }
    }

    async getBillingAdminsByExpired() {
        try {
            const [rows] = await this._db.query(
                `SELECT
                    b.*,
                    DATE_FORMAT(b.date_to, '%d.%m.%Y %H:%i') AS billing_date_to,
                    u.user_tg_id AS user_tg_id,
                    u.username AS username
                FROM billing_admins b
                JOIN users u ON b.user_id = u.id AND b.admin_bot_tg_id = u.admin_bot_tg_id
                WHERE b.admin_bot_tg_id = ?
                AND b.status = 1
                AND b.date_to < NOW();`,
                [this._botTgId]
            );
            if (rows.length > 0) {
                return rows;
            }

            return false;

        } catch (error) {
            console.error('Error:', error);
        }
    }

    async getAdminSubscribePrice() {
        try {
            const [rows] = await this._db.query(`
                    SELECT * FROM admin_subscribe_price WHERE admin_bot_tg_id = ? LIMIT 1;
                `,
                [this._botTgId]
            );

            if (rows.length > 0) {
                return rows[0];
            }

            return false;

        } catch (error) {
            console.error('Error:', error);
        }
    }

    async getBillingByExpired() {
        try {
            const [rows] = await this._db.query(
                `SELECT
                    b.*,
                    DATE_FORMAT(b.date_to, '%d.%m.%Y %H:%i') AS billing_date_to,
                    u.user_tg_id AS user_tg_id,
                    u.username AS username,
                    ch.id AS chat_id,
                    ch.chat_text_id AS chat_text_id,
                    ch.chat_tg_id AS chat_tg_id,
                    ch.type AS chat_type,
                    ch.title AS chat_title
                FROM billing b
                JOIN users u ON b.user_id = u.id AND b.admin_bot_tg_id = u.admin_bot_tg_id
                JOIN chats ch ON b.chat_id = ch.id
                WHERE b.admin_bot_tg_id = ?
                AND b.status = 1
                AND b.date_to < NOW();`,
                [this._botTgId]
            );
            if (rows.length > 0) {
                return rows;
            }

            return false;

        } catch (error) {
            console.error('Error:', error);
        }
    }

    async getBillingByChatIdAndUserTgId(chatId, userTgId) {
        try {
            const [rows] = await this._db.query(
                `SELECT
                    b.*,
                    DATE_FORMAT(b.date_to, '%d.%m.%Y %H:%i') AS billing_date_to,
                    u.user_tg_id AS user_tg_id,
                    u.username AS username,
                    ch.id AS chat_id,
                    ch.chat_text_id AS chat_text_id,
                    ch.chat_tg_id AS chat_tg_id,
                    ch.type AS chat_type,
                    ch.title AS chat_title
                FROM billing b
                JOIN users u ON b.user_id = u.id AND b.admin_bot_tg_id = u.admin_bot_tg_id
                JOIN chats ch ON b.chat_id = ch.id
                WHERE b.admin_bot_tg_id = ?
                AND b.status = 1
                AND u.user_tg_id = ?
                AND ch.id = ? LIMIT 1;`,
                [this._botTgId, userTgId, chatId]
            );
            if (rows.length > 0) {
                return rows[0];
            }

            return false;

        } catch (error) {
            console.error('Error:', error);
        }
    }

    async getBillingByUserTgId(userTgId) {
        try {
            const [rows] = await this._db.query(
                `SELECT
                    b.*,
                    DATE_FORMAT(b.date_to, '%d.%m.%Y %H:%i') AS billing_date_to,
                    u.user_tg_id AS user_tg_id,
                    u.username AS username,
                    ch.id AS chat_id,
                    ch.chat_text_id AS chat_text_id,
                    ch.chat_tg_id AS chat_tg_id,
                    ch.type AS chat_type,
                    ch.title AS chat_title
                FROM billing b
                JOIN users u ON b.user_id = u.id AND b.admin_bot_tg_id = u.admin_bot_tg_id
                JOIN chats ch ON b.chat_id = ch.id
                WHERE b.admin_bot_tg_id = ?
                AND b.status = 1
                AND u.user_tg_id = ?;`,
                [this._botTgId, userTgId]
            );
            if (rows.length > 0) {
                return rows;
            }

            return false;

        } catch (error) {
            console.error('Error:', error);
        }
    }

    async getTransactionByPaymentId(paymentId) {
        try {
            const [rows] = await this._db.query(
                'SELECT * FROM transactions WHERE payment_id = ? LIMIT 1;',
                [paymentId]
            );

            if (rows.length == 1) {
                return rows[0];
            }

            return false;

        } catch (error) {
            console.error('Error:', error);
        }
    }

    async getAdminTransactionByPaymentId(paymentId) {
        try {
            const [rows] = await this._db.query(
                'SELECT * FROM admin_transactions WHERE payment_id = ? LIMIT 1;',
                [paymentId]
            );

            if (rows.length == 1) {
                return rows[0];
            }

            return false;

        } catch (error) {
            console.error('Error:', error);
        }
    }

    async updateOrInsertChats(chat) {
        try {
            let result = await this._db.query(
                `UPDATE chats
                 SET user_id = ?, title = ?, description = ?, type = ?, is_active = ?
                 WHERE admin_bot_tg_id = ? AND chat_tg_id = ?`,
                [
                    chat.user_id, chat.title, chat.description, chat.type, chat.is_active,
                    this._botTgId, chat.chat_tg_id
                ]
            );

            if (result[0].affectedRows === 0) {
                result = await this._db.query(
                    `INSERT INTO chats (chat_text_id, admin_bot_tg_id, user_id, chat_tg_id, title, description, type, is_active, create_at)
                 SELECT UNIX_TIMESTAMP(), ?, ?, ?, ?, ?, ?, ?, NOW()
                 WHERE NOT EXISTS (SELECT 1 FROM chats WHERE admin_bot_tg_id = ? AND chat_tg_id = ?)`,
                    [
                        this._botTgId, chat.user_id, chat.chat_tg_id, chat.title, chat.description, chat.type, chat.is_active,
                        this._botTgId, chat.chat_tg_id
                    ]
                );

                return result[0].insertId;
            }

            return;
        } catch (error) {
            console.error('Error updating or inserting chats:', error);
        }
    }

    async getChats() {
        try {
            const [rows] = await this._db.query(
                `SELECT 
                    ch.*,
                    u.user_tg_id AS user_tg_id
                FROM chats ch
                JOIN users u ON ch.user_id = u.id AND ch.admin_bot_tg_id = u.admin_bot_tg_id
                WHERE ch.admin_bot_tg_id = ? AND ch.is_active = 1`,
                [this._botTgId]
            );
            if (rows.length > 0) {
                return rows;
            }

            return false;

        } catch (error) {
            console.error('Error:', error);
        }
    }

    async getChatsByUserId(userId) {
        try {
            const [rows] = await this._db.query(
                `SELECT 
                    ch.*,
                    u.user_tg_id AS user_tg_id
                FROM chats ch
                JOIN users u ON ch.user_id = u.id AND ch.admin_bot_tg_id = u.admin_bot_tg_id
                WHERE ch.admin_bot_tg_id = ? AND ch.user_id = ? AND ch.is_active = 1`,
                [this._botTgId, userId]
            );
            if (rows.length > 0) {
                return rows;
            }

            return false;

        } catch (error) {
            console.error('Error:', error);
        }
    }

    async getChatById(chatId) {
        try {
            const [rows] = await this._db.query(
                `SELECT 
                    ch.*,
                    u.user_tg_id AS user_tg_id
                FROM chats ch
                JOIN users u ON ch.user_id = u.id AND ch.admin_bot_tg_id = u.admin_bot_tg_id
                WHERE ch.admin_bot_tg_id = ? AND ch.id = ? LIMIT 1`,
                [this._botTgId, chatId]
            );
            if (rows.length > 0) {
                return rows[0];
            }

            return false;

        } catch (error) {
            console.error('Error:', error);
        }
    }

    async getChatByTextId(chatTextId) {
        try {
            const [rows] = await this._db.query(
                `SELECT 
                    ch.*,
                    u.user_tg_id AS user_tg_id
                FROM chats ch
                JOIN users u ON ch.user_id = u.id AND ch.admin_bot_tg_id = u.admin_bot_tg_id
                WHERE ch.admin_bot_tg_id = ? AND ch.chat_text_id = ? LIMIT 1`,
                [this._botTgId, chatTextId]
            );
            if (rows.length > 0) {
                return rows[0];
            }

            return false;

        } catch (error) {
            console.error('Error:', error);
        }
    }

    async getChatByTgId(chatTgId) {
        try {
            const [rows] = await this._db.query(
                `SELECT 
                    ch.*,
                    u.user_tg_id AS user_tg_id
                FROM chats ch
                JOIN users u ON ch.user_id = u.id AND ch.admin_bot_tg_id = u.admin_bot_tg_id
                WHERE ch.admin_bot_tg_id = ? AND ch.chat_tg_id = ? LIMIT 1`,
                [this._botTgId, chatTgId]
            );
            if (rows.length > 0) {
                return rows[0];
            }

            return false;

        } catch (error) {
            console.error('Error:', error);
        }
    }

    async getChatMeta(chatId) {
        try {
            const [rows] = await this._db.query(
                'SELECT * FROM chats_meta WHERE chat_id = ?',
                [chatId]
            );
            if (rows.length > 0) {
                return rows;
            }

            return false;

        } catch (error) {
            console.error('Error:', error);
        }
    }

    async getUsers() {
        try {
            const [rows] = await this._db.query(
                'SELECT * FROM users WHERE is_bot = 0 AND admin_bot_tg_id = ?',
                [this._botTgId]
            );
            if (rows.length > 0) {
                return rows;
            }

            return false;

        } catch (error) {
            console.error('Error:', error);
        }
    }

    async getUserById(userId) {
        try {
            const [rows] = await this._db.query(`
                SELECT *
                FROM users
                WHERE id = ?
                LIMIT 1;
            `, [userId]);

            if (rows.length == 1) {
                return rows[0];
            }

            return false;

        } catch (error) {
            console.error('Error:', error);
        }
    }

    async getUserByUserTgId(userTgId) {
        try {
            const [rows] = await this._db.query(`
                SELECT u.*
                FROM users u
                WHERE u.user_tg_id = ?
                AND u.admin_bot_tg_id = ?
                LIMIT 1;
            `, [userTgId, this._botTgId]);

            if (rows.length == 1) {
                return rows[0];
            }

            return false;

        } catch (error) {
            console.error('Error:', error);
        }
    }

    async getUserByUsername(userName) {
        try {
            const [rows] = await this._db.query(`
                SELECT u.*
                FROM users u
                WHERE u.username = ?
                AND u.admin_bot_tg_id = ?
                LIMIT 1;
            `, [userName, this._botTgId]);

            if (rows.length == 1) {
                return rows[0];
            }

            return false;

        } catch (error) {
            console.error('Error:', error);
        }
    }

    async getUserByPhone(phone) {
        try {
            const [rows] = await this._db.query(`
                SELECT u.*
                FROM users u
                WHERE u.phone LIKE ?
                AND u.admin_bot_tg_id = ?
                LIMIT 1;
            `, [`%${phone}%`, this._botTgId]);

            if (rows.length == 1) {
                return rows[0];
            }

            return false;

        } catch (error) {
            console.error('Error:', error);
        }
    }

    async getActiveTgUsersIds() {
        try {
            const [rows] = await this._db.query(`
                SELECT user_tg_id 
                FROM users
                WHERE is_active = 1 AND is_bot = 0 AND admin_bot_tg_id = ?
            `, [this._botTgId]);

            if (rows.length > 0) {
                return rows.map(row => row.user_tg_id);
            }

            return false;

        } catch (error) {
            console.error('Error:', error);
        }
    }
}

module.exports = { DbRequests }