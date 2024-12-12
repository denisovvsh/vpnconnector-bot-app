require('dotenv').config();

class Attributes {
    constructor(bot) {
        this._bot = bot;
        this._TELEGRAM_API_URL = `https://api.telegram.org/bot${process.env.BOT_TOKEN}`;
        this._TELEGRAM_API_URL_FILE = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}`;
    }

    async getTelegramApiUrl() {
        return this._TELEGRAM_API_URL;
    }

    async getTelegramApiUrlFile() {
        return this._TELEGRAM_API_URL_FILE;
    }

    async convertUnixTimestampToDate(unixTimestamp) {
        const date = new Date(unixTimestamp * 1000); // Умножаем на 1000, чтобы получить миллисекунды
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0'); // Месяц начинается с 0
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');

        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }

    async convertDate(dateString) {
        // Проверка на соответствие формату dd.mm.yyyy
        const regex = /^(\d{2})\.(\d{2})\.(\d{4})$/;
        const match = dateString.match(regex);

        if (!match) {
            return false;
        }

        // Извлечение дня, месяца и года из строки
        const day = match[1];
        const month = match[2];
        const year = match[3];

        return `${year}-${month}-${day} 23:59:59`;
    }

    async convertDateFormat(dateString) {
        const date = new Date(dateString);

        // Получаем день, месяц и год
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0'); // Месяцы начинаются с 0
        const year = date.getFullYear();

        // Форматируем в dd.mm.yyyy
        return `${day}.${month}.${year}`;
    }

    async formatPhoneNumber(phoneNumber) {
        if (!phoneNumber || phoneNumber == '') return false;
        // Удалим все лишние символы, оставив только цифры
        let cleaned = phoneNumber.replace(/\D/g, '');

        // Если номер начинается с 8, заменяем на +7
        if (cleaned.startsWith('8')) {
            cleaned = '+7' + cleaned.slice(1);
        }
        // Если начинается с 7 без плюса, добавляем +
        else if (cleaned.startsWith('7') && !phoneNumber.startsWith('+')) {
            cleaned = '+7' + cleaned.slice(1);
        }
        // Если уже начинается с +7, оставляем как есть
        else if (phoneNumber.startsWith('+7')) {
            cleaned = phoneNumber;
        }

        return cleaned;
    }

    async formatPhoneNumberWithoutPlus(phone) {
        // Удаляем все символы, кроме цифр
        let cleanedPhone = phone.replace(/\D/g, '');

        // Проверяем, начинается ли номер с 8 или +7 (после удаления + останется 7)
        if (cleanedPhone.startsWith('8')) {
            cleanedPhone = '7' + cleanedPhone.slice(1);  // Заменяем 8 на 7
        } else if (cleanedPhone.startsWith('7')) {
            cleanedPhone = '7' + cleanedPhone.slice(1);  // Оставляем 7 без изменений
        } else if (cleanedPhone.startsWith('9') && cleanedPhone.length === 10) {
            cleanedPhone = '7' + cleanedPhone;  // Добавляем 7 в начало, если номер начинается с 9 и содержит 10 цифр
        }

        // Проверка: номер должен содержать не менее 11 цифр
        const phoneRegex = /^\d{11,}$/;
        if (phoneRegex.test(cleanedPhone)) {
            return cleanedPhone;
        } else {
            return false;
        }
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

    async getDateWithOffset(months = 0, days = 0, date = new Date()) {
        const now = new Date(date);
        now.setMonth(now.getMonth() + months);
        now.setDate(now.getDate() + days);

        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');

        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');

        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }
}

module.exports = { Attributes }