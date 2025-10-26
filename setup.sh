#!/bin/bash

set -e

echo "============================================"
echo "  ARMT VPN Platform - Автоматическая установка"
echo "============================================"
echo ""

PROJECT_DIR=$(pwd)

check_command() {
    if ! command -v $1 &> /dev/null; then
        return 1
    fi
    return 0
}

echo "📋 Шаг 1: Проверка системных требований..."
echo ""

if check_command node; then
    NODE_VERSION=$(node --version)
    echo "✅ Node.js установлен: $NODE_VERSION"
else
    echo "❌ Node.js не найден"
    echo ""
    echo "Установить Node.js 20? (y/n)"
    read -r install_node
    if [ "$install_node" = "y" ]; then
        echo "📦 Установка Node.js 20..."
        if [ -f /etc/debian_version ]; then
            curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
            sudo apt install -y nodejs
        else
            echo "⚠️  Автоматическая установка доступна только для Debian/Ubuntu"
            echo "Пожалуйста, установите Node.js 20 вручную с https://nodejs.org/"
            exit 1
        fi
    else
        echo "Установка прервана. Установите Node.js 20 и запустите скрипт снова."
        exit 1
    fi
fi

if check_command python3; then
    PYTHON_VERSION=$(python3 --version)
    echo "✅ Python установлен: $PYTHON_VERSION"
else
    echo "❌ Python3 не найден"
    echo ""
    echo "Установить Python3? (y/n)"
    read -r install_python
    if [ "$install_python" = "y" ]; then
        echo "📦 Установка Python3..."
        if [ -f /etc/debian_version ]; then
            sudo apt update
            sudo apt install -y python3 python3-pip python3-venv
        else
            echo "⚠️  Автоматическая установка доступна только для Debian/Ubuntu"
            echo "Пожалуйста, установите Python3 вручную"
            exit 1
        fi
    else
        echo "Установка прервана. Установите Python3 и запустите скрипт снова."
        exit 1
    fi
fi

if check_command npm; then
    NPM_VERSION=$(npm --version)
    echo "✅ npm установлен: $NPM_VERSION"
else
    echo "❌ npm не найден (обычно устанавливается вместе с Node.js)"
    exit 1
fi

if check_command sqlite3; then
    echo "✅ SQLite3 установлен"
else
    echo "⚠️  SQLite3 не найден, но база данных всё равно будет работать"
    echo "Установить SQLite3 для удобства администрирования? (y/n)"
    read -r install_sqlite
    if [ "$install_sqlite" = "y" ]; then
        if [ -f /etc/debian_version ]; then
            sudo apt install -y sqlite3
        fi
    fi
fi

echo ""
echo "============================================"
echo "📦 Шаг 2: Установка зависимостей Node.js..."
echo "============================================"
echo ""

if [ ! -d "node_modules" ]; then
    echo "Установка npm пакетов..."
    npm install
    echo "✅ npm пакеты установлены"
else
    echo "⚠️  node_modules уже существует"
    echo "Переустановить зависимости? (y/n)"
    read -r reinstall_npm
    if [ "$reinstall_npm" = "y" ]; then
        echo "Переустановка npm пакетов..."
        rm -rf node_modules package-lock.json
        npm install
        echo "✅ npm пакеты переустановлены"
    else
        echo "↪️  Пропускаем установку npm пакетов"
    fi
fi

echo ""
echo "============================================"
echo "🐍 Шаг 3: Установка зависимостей Python..."
echo "============================================"
echo ""

if [ -f "requirements.txt" ]; then
    if [ ! -d "venv" ]; then
        echo "Создание виртуального окружения Python..."
        python3 -m venv venv
        echo "✅ Виртуальное окружение создано"
    fi
    
    echo "Установка Python пакетов..."
    source venv/bin/activate
    pip install --upgrade pip
    pip install -r requirements.txt
    deactivate
    echo "✅ Python пакеты установлены"
else
    echo "⚠️  requirements.txt не найден, пропускаем установку Python пакетов"
fi

echo ""
echo "============================================"
echo "⚙️  Шаг 4: Настройка переменных окружения..."
echo "============================================"
echo ""

if [ ! -f ".env" ]; then
    echo "Файл .env не найден. Создаём новый..."
    echo ""
    
    echo "Введите токен Telegram бота (получите у @BotFather):"
    read -r BOT_TOKEN
    
    echo ""
    echo "Введите ваш Telegram ID администратора (узнайте у @userinfobot):"
    read -r ADMIN_ID
    
    echo ""
    echo "Введите ID группы поддержки (или нажмите Enter, чтобы пропустить):"
    read -r GROUP_ID
    
    echo ""
    echo "Введите токен CryptoBot для приема платежей (или нажмите Enter, чтобы пропустить):"
    read -r CRYPTO_BOT_TOKEN
    
    echo ""
    echo "Генерация секретного ключа для сессий..."
    SESSION_SECRET=$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | base64)
    
    cat > .env << EOF
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=${BOT_TOKEN}
BOT_TOKEN=${BOT_TOKEN}

# Admin Configuration
ADMIN_ID=${ADMIN_ID}

# Telegram Support Group
GROUP_ID=${GROUP_ID}

# CryptoBot API for payments
CRYPTO_BOT_TOKEN=${CRYPTO_BOT_TOKEN}

# Session Secret for Web Application
SESSION_SECRET=${SESSION_SECRET}

# Database (используется автоматически - vpn_platform.db)
# DATABASE_URL=file:./vpn_platform.db

# Node Environment
NODE_ENV=development
EOF
    
    echo "✅ Файл .env создан"
else
    echo "✅ Файл .env уже существует"
    echo "Просмотреть текущие настройки? (y/n)"
    read -r view_env
    if [ "$view_env" = "y" ]; then
        echo ""
        echo "--- Текущие настройки .env ---"
        grep -v "^#" .env | grep -v "^$"
        echo "-------------------------------"
        echo ""
    fi
    
    echo "Пересоздать файл .env? (y/n)"
    read -r recreate_env
    if [ "$recreate_env" = "y" ]; then
        mv .env .env.backup
        echo "⚠️  Старый .env сохранён как .env.backup"
        
        echo ""
        echo "Введите токен Telegram бота:"
        read -r BOT_TOKEN
        
        echo ""
        echo "Введите ваш Telegram ID администратора:"
        read -r ADMIN_ID
        
        echo ""
        echo "Введите ID группы поддержки (или нажмите Enter):"
        read -r GROUP_ID
        
        echo ""
        echo "Введите токен CryptoBot (или нажмите Enter):"
        read -r CRYPTO_BOT_TOKEN
        
        echo ""
        echo "Генерация нового секретного ключа..."
        SESSION_SECRET=$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | base64)
        
        cat > .env << EOF
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=${BOT_TOKEN}
BOT_TOKEN=${BOT_TOKEN}

# Admin Configuration
ADMIN_ID=${ADMIN_ID}

# Telegram Support Group
GROUP_ID=${GROUP_ID}

# CryptoBot API for payments
CRYPTO_BOT_TOKEN=${CRYPTO_BOT_TOKEN}

# Session Secret for Web Application
SESSION_SECRET=${SESSION_SECRET}

# Database (используется автоматически - vpn_platform.db)
# DATABASE_URL=file:./vpn_platform.db

# Node Environment
NODE_ENV=development
EOF
        
        echo "✅ Файл .env пересоздан"
    fi
fi

echo ""
echo "============================================"
echo "🗄️  Шаг 5: Инициализация базы данных..."
echo "============================================"
echo ""

if [ -f "vpn_platform.db" ]; then
    echo "⚠️  База данных vpn_platform.db уже существует"
    echo "Размер базы: $(du -h vpn_platform.db | cut -f1)"
    echo ""
    echo "Создать резервную копию базы данных? (y/n)"
    read -r backup_db
    if [ "$backup_db" = "y" ]; then
        BACKUP_NAME="vpn_platform_backup_$(date +%Y%m%d_%H%M%S).db"
        cp vpn_platform.db "$BACKUP_NAME"
        echo "✅ Резервная копия создана: $BACKUP_NAME"
    fi
else
    echo "База данных будет создана автоматически при первом запуске"
fi

echo ""
echo "============================================"
echo "🔨 Шаг 6: Сборка приложения..."
echo "============================================"
echo ""

echo "Собрать production версию приложения? (y/n)"
read -r build_app
if [ "$build_app" = "y" ]; then
    echo "Сборка frontend и backend..."
    npm run build
    echo "✅ Приложение собрано в директории dist/"
else
    echo "↪️  Пропускаем сборку (будет использоваться режим разработки)"
fi

echo ""
echo "============================================"
echo "✅ УСТАНОВКА ЗАВЕРШЕНА!"
echo "============================================"
echo ""
echo "📝 Доступные команды для запуска:"
echo ""
echo "1. Режим разработки (веб-приложение):"
echo "   npm run dev"
echo ""
echo "2. Production режим (веб-приложение):"
echo "   npm run start"
echo ""
echo "3. Запуск Telegram бота:"
echo "   ./start-bot.sh"
echo "   или:"
echo "   source venv/bin/activate && python3 attached_assets/bot_*.py"
echo ""
echo "4. Запуск веб-приложения (альтернативный способ):"
echo "   ./start-web.sh"
echo ""
echo "============================================"
echo "🚀 Быстрый старт:"
echo "============================================"
echo ""
echo "Для немедленного запуска в режиме разработки выполните:"
echo ""
echo "   npm run dev"
echo ""
echo "Приложение будет доступно по адресу: http://localhost:5000"
echo ""

echo "Запустить приложение сейчас в режиме разработки? (y/n)"
read -r start_now
if [ "$start_now" = "y" ]; then
    echo ""
    echo "🚀 Запускаем веб-приложение..."
    echo "Нажмите Ctrl+C для остановки"
    echo ""
    sleep 2
    npm run dev
else
    echo ""
    echo "Для запуска используйте: npm run dev"
    echo ""
    echo "📚 Дополнительная документация:"
    echo "   - README.md - общая информация"
    echo "   - INSTALL.md - подробная инструкция по установке"
    echo "   - ADMIN_GUIDE.md - руководство администратора"
    echo ""
fi
