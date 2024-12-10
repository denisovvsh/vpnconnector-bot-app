# Telegram бот для продажи подписок на VPN

## Развернуть бота на сервере

* Клонировать репу в корень сервера на котором должно быть установлено окружение для Docker

* Перейти в директорию ```vpnconnector-bot-app``` и добавить файл ```.env``` пример содержимого файла в файле ```exapmle.env```

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
