const mysql = require('mysql2/promise');
require('dotenv').config();

class DbRequests {
    constructor() {
        this._db = mysql.createPool({
            host: process.env.MYSQL_ROOT_HOST,
            user: process.env.MYSQL_USER,
            password: process.env.MYSQL_PASSWORD,
            database: process.env.MYSQL_DATABASE,
        });
    }

    async updateOrInsertUser(user) {
        try {
            let result = await this._db.query(
                `UPDATE users
                 SET user_tg_id = ?, first_name = ?, last_name = ?, username = ?, phone = ?, is_premium = ?, is_active = ?, update_at = NOW()
                 WHERE (user_tg_id = ? OR (user_tg_id IS NULL AND phone LIKE ?))`,
                [
                    user.user_tg_id, user.first_name, user.last_name, user.username,
                    user.phone, user.is_premium, user.is_active,
                    user.user_tg_id, `%${user.phone}%`
                ]
            );

            if (result[0].affectedRows === 0) {
                result = await this._db.query(
                    `INSERT INTO users (user_tg_id, is_bot, first_name, last_name, username, phone, language_code, is_premium, is_active, create_at, update_at)
                     SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW()
                     WHERE NOT EXISTS (SELECT 1 FROM users WHERE (user_tg_id = ? OR (user_tg_id IS NULL AND phone LIKE ?)))`,
                    [
                        user.user_tg_id, user.is_bot, user.first_name, user.last_name, user.username,
                        user.phone, user.language_code, user.is_premium, user.is_active,
                        user.user_tg_id, `%${user.phone}%`
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

    async updateOrInsertServiceMeta(serviceMeta = null) {
        try {
            if (!serviceMeta) return;

            // Обновить значение, если запись существует
            let result = await this._db.query(
                `UPDATE service_meta
                 SET meta_value = ?
                 WHERE service_id = ? AND meta_key = ?`,
                [
                    serviceMeta.meta_value,
                    serviceMeta.service_id, serviceMeta.meta_key
                ]
            );

            // Добавить запись, если она не существует
            if (result[0].affectedRows === 0) {
                result = await this._db.query(
                    `INSERT INTO service_meta (service_id, meta_key, meta_value)
                 SELECT ?, ?, ?
                 WHERE NOT EXISTS (SELECT 1 FROM service_meta WHERE service_id = ? AND meta_key = ?)`,
                    [
                        serviceMeta.service_id, serviceMeta.meta_key, serviceMeta.meta_value,
                        serviceMeta.service_id, serviceMeta.meta_key
                    ]
                );

                return result[0].insertId;
            }

            return;
        } catch (error) {
            console.error('Error updating or inserting post_meta:', error);
        }
    }

    async updateOrInsertTransactions(transaction) {
        try {
            let result = await this._db.query(
                `UPDATE transactions
                 SET price = ?, status = ?, price_type = ?, payment_id = ?, is_update_subscribe = ?, update_at = NOW()
                 WHERE user_id = ? AND service_id = ? AND payment_id = ?`,
                [
                    transaction.price, transaction.status, transaction.price_type, transaction.payment_id, transaction.is_update_subscribe,
                    transaction.user_id, transaction.service_id, transaction.payment_id
                ]
            );

            if (result[0].affectedRows === 0) {
                result = await this._db.query(
                    `INSERT INTO transactions (user_id, service_id, price, status, price_type, payment_id, is_update_subscribe, update_at, create_at)
                 SELECT ?, ?, ?, ?, ?, ?, ?, NOW(), NOW()
                 WHERE NOT EXISTS (SELECT 1 FROM transactions WHERE user_id = ? AND service_id = ? AND payment_id = ?)`,
                    [
                        transaction.user_id, transaction.service_id, transaction.price, transaction.status,
                        transaction.price_type, transaction.payment_id, transaction.is_update_subscribe,
                        transaction.user_id, transaction.service_id, transaction.payment_id
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
                 WHERE service_id = ? AND user_id = ?`,
                [
                    data.status, data.date_from, data.date_to,
                    data.service_id, data.user_id
                ]
            );

            if (result[0].affectedRows === 0) {
                result = await this._db.query(
                    `INSERT INTO billing (service_id, user_id, status, update_at, create_at, date_from, date_to)
                 SELECT ?, ?, ?, NOW(), NOW(), ?, ?
                 WHERE NOT EXISTS (SELECT 1 FROM billing WHERE service_id = ? AND user_id = ?)`,
                    [
                        data.service_id, data.user_id, data.status, data.date_from, data.date_to,
                        data.service_id, data.user_id
                    ]
                );

                return result[0].insertId;
            }

            return;
        } catch (error) {
            console.error('Error updating or inserting billing:', error);
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
                    s.id AS service_id,
                    s.raw AS service_raw
                FROM billing b
                JOIN users u ON b.user_id = u.id
                JOIN service s ON b.service_id = s.id
                WHERE b.status = 1
                AND b.date_to BETWEEN NOW() AND NOW() + INTERVAL 2 DAY;`,
                []
            );
            if (rows.length > 0) {
                return rows;
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
                    s.id AS service_id,
                    s.raw AS service_raw
                FROM billing b
                JOIN users u ON b.user_id = u.id
                JOIN service s ON b.service_id = s.id
                WHERE b.status = 1
                AND b.date_to < NOW();`,
                []
            );
            if (rows.length > 0) {
                return rows;
            }

            return false;

        } catch (error) {
            console.error('Error:', error);
        }
    }

    async getBillingByServiceIdAndUserTgId(serviceId, userTgId) {
        try {
            const [rows] = await this._db.query(
                `SELECT
                    b.*,
                    DATE_FORMAT(b.date_to, '%d.%m.%Y %H:%i') AS billing_date_to,
                    u.user_tg_id AS user_tg_id,
                    u.username AS username,
                    s.id AS service_id,
                    s.raw AS service_raw
                FROM billing b
                JOIN users u ON b.user_id = u.id
                JOIN service s ON b.service_id = s.id
                WHERE b.status = 1
                AND u.user_tg_id = ?
                AND s.id = ? LIMIT 1;`,
                [userTgId, serviceId]
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
                    s.id AS service_id,
                    s.raw AS service_raw
                FROM billing b
                JOIN users u ON b.user_id = u.id
                JOIN service s ON b.service_id = s.id
                WHERE b.status = 1
                AND u.user_tg_id = ?;`,
                [userTgId]
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

    async updateOrInsertService(service) {
        try {
            // Если `service.id` существует, пробуем обновить запись
            if (service.id) {
                const result = await this._db.query(
                    `UPDATE service
                     SET user_id = ?, raw = ?, update_at = NOW()
                     WHERE id = ?`,
                    [
                        service.user_id, JSON.stringify(service.raw),
                        service.id
                    ]
                );
    
                return service.id;
            }
    
            const result = await this._db.query(
                `INSERT INTO service (user_id, raw, create_at, update_at)
                 VALUES (?, ?, NOW(), NOW())`,
                [
                    service.user_id, JSON.stringify(service.raw)
                ]
            );
    
            return result[0].insertId;
        } catch (error) {
            console.error('Error updating or inserting service:', error);
        }
    }    

    async getServices() {
        try {
            const [rows] = await this._db.query(
                `SELECT 
                    s.*,
                    u.user_tg_id AS user_tg_id
                FROM service s
                JOIN users u ON s.user_id = u.id`,
                []
            );
            if (rows.length > 0) {
                return rows;
            }

            return false;

        } catch (error) {
            console.error('Error:', error);
        }
    }

    async getServicesByUserId(userId) {
        try {
            const [rows] = await this._db.query(
                `SELECT 
                    s.*,
                    u.user_tg_id AS user_tg_id
                FROM service s
                JOIN users u ON s.user_id = u.id
                WHERE s.user_id = ?`,
                [userId]
            );
            if (rows.length > 0) {
                return rows;
            }

            return false;

        } catch (error) {
            console.error('Error:', error);
        }
    }

    async getServiceById(id) {
        try {
            const [rows] = await this._db.query(
                `SELECT 
                    s.*,
                    u.user_tg_id AS user_tg_id
                FROM service s
                JOIN users u ON s.user_id = u.id
                WHERE s.id = ? LIMIT 1`,
                [id]
            );
            if (rows.length > 0) {
                return rows[0];
            }

            return false;

        } catch (error) {
            console.error('Error:', error);
        }
    }

    async getServiceMeta(serviceId) {
        try {
            const [rows] = await this._db.query(
                'SELECT * FROM service_meta WHERE service_id = ?',
                [serviceId]
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
                'SELECT * FROM users WHERE is_bot = 0',
                []
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
                LIMIT 1;
            `, [userTgId]);

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
                LIMIT 1;
            `, [userName]);

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
                LIMIT 1;
            `, [`%${phone}%`]);

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
                WHERE is_active = 1 AND is_bot = 0
            `, []);

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