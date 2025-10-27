#!/bin/bash
# Скрипт запуска Telegram бота ARMT VPN

set -e

echo "============================================"
echo "  Запуск ARMT VPN Telegram Bot"
echo "============================================"
echo ""

# Проверка установки Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 не установлен!"
    exit 1
fi

PYTHON_VERSION=$(python3 --version)
echo "✅ Python: $PYTHON_VERSION"

# Проверка виртуального окружения
if [ ! -d "venv" ]; then
    echo ""
    echo "📦 Создание виртуального окружения Python..."
    python3 -m venv venv
    echo "✅ Виртуальное окружение создано"
fi

# Активация виртуального окружения
echo "🔧 Активация виртуального окружения..."
source venv/bin/activate

# Проверка requirements.txt
if [ ! -f "requirements.txt" ]; then
    echo "⚠️  requirements.txt не найден! Создание базового файла..."
    cat > requirements.txt <<EOF
python-telegram-bot==20.8
python-dotenv==1.0.0
aiohttp==3.9.1
qrcode==7.4.2
pillow==10.1.0
EOF
fi

# Проверка установки зависимостей
INSTALLED_CHECK=$(pip list 2>/dev/null | grep "python-telegram-bot" || echo "")
if [ -z "$INSTALLED_CHECK" ]; then
    echo ""
    echo "📦 Установка Python зависимостей..."
    pip install --upgrade pip
    pip install -r requirements.txt
    echo "✅ Python зависимости установлены"
else
    echo "✅ Python зависимости уже установлены"
fi

# Загрузка переменных окружения
if [ -f ".env" ]; then
    echo "✅ Загрузка переменных окружения из .env"
    export $(grep -v '^#' .env | xargs)
else
    echo "⚠️  Файл .env не найден!"
    echo "   Создайте .env файл с необходимыми переменными:"
    echo "   - TELEGRAM_BOT_TOKEN"
    echo "   - ADMIN_ID"
    echo "   - GROUP_ID (опционально)"
    echo "   - CRYPTO_BOT_TOKEN (опционально)"
    exit 1
fi

# Проверка наличия токена бота
if [ -z "$TELEGRAM_BOT_TOKEN" ] && [ -z "$BOT_TOKEN" ]; then
    echo "❌ TELEGRAM_BOT_TOKEN не установлен в .env файле!"
    exit 1
fi

echo ""
echo "⚙️  Конфигурация:"
echo "   Bot Token: ${TELEGRAM_BOT_TOKEN:0:10}..."
echo "   Admin ID: ${ADMIN_ID:-не установлен}"
echo ""

# Определение какой файл бота использовать
BOT_FILE=""
if [ -f "telegram_bot.py" ]; then
    BOT_FILE="telegram_bot.py"
    echo "✅ Найден telegram_bot.py"
elif [ -f "attached_assets/bot_1761427044553.py" ]; then
    BOT_FILE="attached_assets/bot_1761427044553.py"
    echo "✅ Найден attached_assets/bot_1761427044553.py"
else
    echo "❌ Не найден файл бота!"
    echo "   Ожидается: telegram_bot.py или attached_assets/bot_*.py"
    exit 1
fi

echo ""
echo "🚀 Запуск Telegram бота..."
echo "   Файл: $BOT_FILE"
echo "   Для остановки нажмите Ctrl+C"
echo ""

# Запуск бота
python3 "$BOT_FILE"
