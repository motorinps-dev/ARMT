#!/bin/bash
# Скрипт запуска веб-приложения ARMT VPN

set -e

echo "============================================"
echo "  Запуск ARMT VPN Web Application"
echo "============================================"
echo ""

# Проверка установки Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js не установлен! Пожалуйста, установите Node.js 20 или выше."
    exit 1
fi

NODE_VERSION=$(node --version)
echo "✅ Node.js: $NODE_VERSION"

# Проверка зависимостей
if [ ! -d "node_modules" ]; then
    echo ""
    echo "📦 Зависимости не установлены. Установка..."
    npm install
    echo "✅ Зависимости установлены"
fi

# Загрузка переменных окружения
if [ -f ".env" ]; then
    echo "✅ Загрузка переменных окружения из .env"
    export $(grep -v '^#' .env | xargs)
else
    echo "⚠️  Файл .env не найден. Используются значения по умолчанию."
fi

# Установка значений по умолчанию
export NODE_ENV=${NODE_ENV:-production}
export PORT=${PORT:-5000}

echo ""
echo "⚙️  Конфигурация:"
echo "   NODE_ENV: $NODE_ENV"
echo "   PORT: $PORT"
echo ""

# Проверка наличия собранного приложения
if [ ! -d "dist" ] || [ ! -f "dist/index.js" ]; then
    echo "📦 Сборка приложения..."
    npm run build
    echo "✅ Приложение собрано"
else
    echo "✅ Приложение уже собрано (используется dist/index.js)"
    echo "   Для пересборки удалите директорию dist или запустите: npm run build"
fi

echo ""
echo "🚀 Запуск веб-сервера..."
echo "   Приложение будет доступно на порту $PORT"
echo "   Для остановки нажмите Ctrl+C"
echo ""

# Запуск приложения
npm run start
