#!/bin/bash
# Скрипт запуска веб-приложения

echo "Запуск веб-приложения ARMT VPN..."

# Проверка установки Node.js
if ! command -v node &> /dev/null; then
    echo "Node.js не установлен! Пожалуйста, установите Node.js 20 или выше."
    exit 1
fi

# Установка зависимостей
if [ ! -d "node_modules" ]; then
    echo "Установка зависимостей npm..."
    npm install
fi

# Сборка приложения
echo "Сборка приложения..."
npm run build

# Запуск в production режиме
echo "Запуск веб-сервера..."
npm run start
