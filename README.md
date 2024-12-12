# Telegram бот для продажи подписок на VPN

## Развернуть бота на сервере

* Клонировать репу в корень сервера на котором должно быть установлено окружение для Docker

* Перейти в директорию ```vpnconnector-bot-app``` и добавить файл ```.env``` пример содержимого файла
* Внутри будут необходимые сервисы для работы бота + директория самого бота ```vpnconnector-bot-app```

```bash
BOT_TOKEN=''
BOT_ID='7373081855'
BOT_USERNAME='@VpnConnectorBot'
BOT_LINK='http://t.me/VpnConnectorBot'
BOT_LINK_SUPPORT='https://t.me/sblk777'
BOT_SUPPORT_ID='793494085'
BOT_OWNER_ID='793494085'
NOTIFICATION_CHAT_ID='793494085'
MANAGER_SUPPORT='@sblk777'
MYSQL_ROOT_HOST='mysql-server'
MYSQL_DATABASE=''
MYSQL_USER=''
MYSQL_PASSWORD=''
```

* Перейти в директорию с файлом ```docker-compose.yml``` 

* Создать файл ```.env``` пример содержимого
    * Пример сожержимого файла ```.env``` для конфигурации phpMyAdmin:

```bash
MYSQL_ROOT_PASSWORD='secret'
PMA_HOST='mysql-server'
PMA_USER='root'
PMA_PASSWORD='secret'
```

* Выполнить команду ```deocker compose up --build -d```

## Доступ к базе данных

* Через phpMyAdmin http://localhost:40081/ 
* Настройки доступа задаются в файле .env
* Создать новую БД и импортировать дамп из файла ```bot_vpnconnector.sql```
* Не забыть добавить пользователя через phpMyAdmin
