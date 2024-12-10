#!/bin/bash

# Проверка переменной BOT_TOKEN
if [ -z "$BOT_TOKEN" ]; then
  echo "Ошибка: BOT_TOKEN пустая. Контейнер завершает работу."
  exit 1
fi

# Установка дополнительных пакетов
apt-get -y update && apt-get -y upgrade
apt-get -y install curl vim

# Установка зависимостей Node.js и запуск приложения
npm install
node index.js
