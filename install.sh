#!/bin/bash

# ARMT VPN Platform - Комплексный скрипт установки
# С автоматическим запросом данных и запасными вариантами

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Функция для вывода с цветом
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Функция для проверки команды
check_command() {
    command -v "$1" &> /dev/null
}

# Функция для безопасной генерации секретного ключа
generate_secret() {
    # Пробуем несколько методов генерации, первый доступный будет использован
    if check_command openssl; then
        openssl rand -hex 32 2>/dev/null && return 0
    fi
    
    if check_command head && [ -r /dev/urandom ]; then
        head -c 32 /dev/urandom | base64 2>/dev/null && return 0
    fi
    
    if check_command dd && [ -r /dev/urandom ]; then
        dd if=/dev/urandom bs=32 count=1 2>/dev/null | base64 && return 0
    fi
    
    # Последняя попытка - использовать случайные данные
    if check_command date && check_command md5sum; then
        echo "$(date +%s%N)-$(hostname)-$$-$RANDOM" | md5sum | cut -d' ' -f1 && return 0
    fi
    
    # Если ничего не сработало, генерируем простой ключ
    echo "GENERATED_KEY_$(date +%s)_$(hostname)_$$_$RANDOM"
}

print_info "============================================"
print_info "  ARMT VPN Platform - Установка"
print_info "============================================"
echo ""

# Определяем директорию проекта
PROJECT_DIR=$(pwd)
print_info "Директория проекта: $PROJECT_DIR"
echo ""

# ==========================================
# Шаг 1: Проверка Node.js
# ==========================================
print_info "Шаг 1: Проверка Node.js..."
echo ""

if check_command node; then
    NODE_VERSION=$(node --version)
    print_success "Node.js установлен: $NODE_VERSION"
else
    print_warning "Node.js не найден"
    echo ""
    echo "Установить Node.js 20? (y/n) [рекомендуется: y]"
    read -r install_node
    
    if [ "$install_node" = "y" ] || [ "$install_node" = "Y" ]; then
        print_info "Установка Node.js 20..."
        
        # Определяем ОС
        if [ -f /etc/os-release ]; then
            . /etc/os-release
            OS=$NAME
        fi
        
        if [ -f /etc/debian_version ]; then
            print_info "Обнаружена Debian/Ubuntu система"
            
            # Пробуем установить через NodeSource
            if curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - 2>/dev/null; then
                sudo apt-get install -y nodejs || {
                    print_error "Не удалось установить через NodeSource"
                    print_info "Попытка установки через snap..."
                    
                    if check_command snap; then
                        sudo snap install node --classic --channel=20 || {
                            print_error "Не удалось установить через snap"
                            print_error "Установите Node.js вручную: https://nodejs.org/"
                            exit 1
                        }
                    else
                        print_error "Установите Node.js вручную: https://nodejs.org/"
                        exit 1
                    fi
                }
            else
                print_error "Не удалось загрузить установочный скрипт NodeSource"
                exit 1
            fi
            
            print_success "Node.js успешно установлен"
        elif [ -f /etc/redhat-release ]; then
            print_info "Обнаружена RedHat/CentOS система"
            curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash - || {
                print_error "Ошибка при установке Node.js"
                exit 1
            }
            sudo yum install -y nodejs || sudo dnf install -y nodejs
            print_success "Node.js успешно установлен"
        else
            print_warning "Неизвестная ОС. Установите Node.js 20 вручную"
            print_info "Скачайте с: https://nodejs.org/"
            exit 1
        fi
    else
        print_error "Node.js обязателен для работы. Установка прервана."
        exit 1
    fi
fi

# Проверяем npm
if ! check_command npm; then
    print_error "npm не найден (обычно устанавливается вместе с Node.js)"
    print_info "Переустановите Node.js с https://nodejs.org/"
    exit 1
fi

NPM_VERSION=$(npm --version)
print_success "npm установлен: $NPM_VERSION"
echo ""

# ==========================================
# Шаг 2: Проверка Python (опционально)
# ==========================================
print_info "Шаг 2: Проверка Python (для Telegram бота)..."
echo ""

if check_command python3; then
    PYTHON_VERSION=$(python3 --version)
    print_success "Python установлен: $PYTHON_VERSION"
else
    print_warning "Python3 не найден"
    echo "Установить Python3 для Telegram бота? (y/n) [опционально]"
    read -r install_python
    
    if [ "$install_python" = "y" ] || [ "$install_python" = "Y" ]; then
        print_info "Установка Python3..."
        
        if [ -f /etc/debian_version ]; then
            sudo apt-get update || true
            sudo apt-get install -y python3 python3-pip python3-venv || {
                print_error "Не удалось установить Python3"
                print_warning "Telegram бот не будет доступен"
            }
        elif [ -f /etc/redhat-release ]; then
            sudo yum install -y python3 python3-pip || sudo dnf install -y python3 python3-pip || {
                print_error "Не удалось установить Python3"
                print_warning "Telegram бот не будет доступен"
            }
        else
            print_warning "Автоустановка недоступна для вашей ОС"
            print_warning "Telegram бот не будет доступен без Python3"
        fi
        
        if check_command python3; then
            print_success "Python3 успешно установлен"
        fi
    else
        print_warning "Python3 не установлен. Telegram бот будет недоступен."
    fi
fi
echo ""

# ==========================================
# Шаг 3: Установка SQLite (опционально)
# ==========================================
print_info "Шаг 3: Проверка SQLite..."
echo ""

if check_command sqlite3; then
    print_success "SQLite3 установлен"
else
    print_warning "SQLite3 не найден (база данных всё равно будет работать через библиотеку)"
    echo "Установить SQLite3 для администрирования БД? (y/n) [опционально]"
    read -r install_sqlite
    
    if [ "$install_sqlite" = "y" ] || [ "$install_sqlite" = "Y" ]; then
        if [ -f /etc/debian_version ]; then
            sudo apt-get install -y sqlite3 || print_warning "Не удалось установить SQLite3"
        elif [ -f /etc/redhat-release ]; then
            sudo yum install -y sqlite || sudo dnf install -y sqlite || print_warning "Не удалось установить SQLite3"
        fi
        
        if check_command sqlite3; then
            print_success "SQLite3 успешно установлен"
        fi
    fi
fi
echo ""

# ==========================================
# Шаг 4: Установка зависимостей Node.js
# ==========================================
print_info "Шаг 4: Установка зависимостей Node.js..."
echo ""

install_npm_packages() {
    print_info "Устанавливаем npm пакеты..."
    
    # Пробуем установить несколько раз с разными стратегиями
    if npm install; then
        print_success "npm пакеты успешно установлены"
        return 0
    fi
    
    print_warning "Первая попытка не удалась, пробуем с --legacy-peer-deps..."
    if npm install --legacy-peer-deps; then
        print_success "npm пакеты установлены с --legacy-peer-deps"
        return 0
    fi
    
    print_warning "Пробуем очистить кэш и установить снова..."
    npm cache clean --force
    if npm install; then
        print_success "npm пакеты установлены после очистки кэша"
        return 0
    fi
    
    print_error "Не удалось установить npm пакеты"
    return 1
}

if [ ! -d "node_modules" ]; then
    install_npm_packages || exit 1
else
    print_warning "node_modules уже существует"
    echo "Переустановить зависимости? (y/n) [рекомендуется: n]"
    read -r reinstall_npm
    
    if [ "$reinstall_npm" = "y" ] || [ "$reinstall_npm" = "Y" ]; then
        print_info "Удаляем старые пакеты..."
        rm -rf node_modules package-lock.json
        install_npm_packages || exit 1
    else
        print_info "Пропускаем установку npm пакетов"
    fi
fi
echo ""

# ==========================================
# Шаг 5: Установка Python зависимостей
# ==========================================
if check_command python3; then
    print_info "Шаг 5: Установка зависимостей Python..."
    echo ""
    
    if [ -f "requirements.txt" ]; then
        if [ ! -d "venv" ]; then
            print_info "Создаём виртуальное окружение Python..."
            python3 -m venv venv || {
                print_warning "Не удалось создать виртуальное окружение"
                print_info "Попытка установки пакетов глобально..."
                pip3 install -r requirements.txt --user || print_warning "Не удалось установить Python пакеты"
            }
        fi
        
        if [ -d "venv" ]; then
            print_info "Устанавливаем Python пакеты..."
            source venv/bin/activate
            pip install --upgrade pip || true
            pip install -r requirements.txt || print_warning "Некоторые Python пакеты не установлены"
            deactivate
            print_success "Python пакеты установлены"
        fi
    else
        print_warning "requirements.txt не найден"
    fi
    echo ""
fi

# ==========================================
# Шаг 6: Настройка переменных окружения
# ==========================================
print_info "Шаг 6: Настройка переменных окружения..."
echo ""

if [ ! -f ".env" ]; then
    print_info "Файл .env не найден. Создаём конфигурацию..."
    echo ""
    
    # Запрашиваем данные у пользователя
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📱 Настройка Telegram бота (опционально)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Токен Telegram бота (получите у @BotFather):"
    echo "[Нажмите Enter, чтобы пропустить]"
    read -r BOT_TOKEN
    
    if [ -z "$BOT_TOKEN" ]; then
        BOT_TOKEN="your_telegram_bot_token_here"
        print_warning "Telegram бот не настроен"
    else
        print_success "Telegram бот токен сохранён"
    fi
    
    echo ""
    echo "Ваш Telegram ID администратора (узнайте у @userinfobot):"
    echo "[Нажмите Enter для значения по умолчанию: 123456789]"
    read -r ADMIN_ID
    
    if [ -z "$ADMIN_ID" ]; then
        ADMIN_ID="123456789"
    fi
    
    echo ""
    echo "ID группы поддержки в Telegram (опционально):"
    echo "[Нажмите Enter, чтобы пропустить]"
    read -r GROUP_ID
    
    echo ""
    echo "Токен CryptoBot для приёма платежей (опционально):"
    echo "[Нажмите Enter, чтобы пропустить]"
    read -r CRYPTO_BOT_TOKEN
    
    if [ -z "$CRYPTO_BOT_TOKEN" ]; then
        CRYPTO_BOT_TOKEN="your_crypto_bot_token_here"
    fi
    
    echo ""
    print_info "Генерация секретного ключа для сессий..."
    SESSION_SECRET=$(generate_secret)
    
    if [ -z "$SESSION_SECRET" ]; then
        print_error "Не удалось сгенерировать SESSION_SECRET"
        SESSION_SECRET="PLEASE_CHANGE_THIS_SECRET_KEY_$(date +%s)"
        print_warning "Используется временный ключ. ОБЯЗАТЕЛЬНО смените его в .env!"
    else
        print_success "SESSION_SECRET сгенерирован"
    fi
    
    # Создаём .env файл
    cat > .env << EOF
# ==========================================
# ARMT VPN Platform - Конфигурация
# ==========================================

# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=${BOT_TOKEN}
BOT_TOKEN=${BOT_TOKEN}

# Admin Configuration
ADMIN_ID=${ADMIN_ID}

# Telegram Support Group (optional)
GROUP_ID=${GROUP_ID}

# CryptoBot API for payments (optional)
CRYPTO_BOT_TOKEN=${CRYPTO_BOT_TOKEN}

# Session Secret for Web Application (ВАЖНО: сгенерирован автоматически)
SESSION_SECRET=${SESSION_SECRET}

# Database (используется автоматически - vpn_platform.db)
# DATABASE_URL=file:./vpn_platform.db

# Node Environment (development или production)
NODE_ENV=development
EOF
    
    print_success "Файл .env создан"
    echo ""
    
else
    print_success "Файл .env уже существует"
    echo "Просмотреть текущие настройки? (y/n)"
    read -r view_env
    
    if [ "$view_env" = "y" ] || [ "$view_env" = "Y" ]; then
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        grep -v "^#" .env | grep -v "^$" || echo "Пусто"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
    fi
    
    echo "Пересоздать файл .env? (y/n)"
    read -r recreate_env
    
    if [ "$recreate_env" = "y" ] || [ "$recreate_env" = "Y" ]; then
        BACKUP_ENV=".env.backup.$(date +%Y%m%d_%H%M%S)"
        mv .env "$BACKUP_ENV"
        print_success "Старый .env сохранён: $BACKUP_ENV"
        
        # Повторяем создание .env (копируем код выше)
        echo ""
        echo "Токен Telegram бота:"
        read -r BOT_TOKEN
        echo "Telegram ID администратора:"
        read -r ADMIN_ID
        echo "ID группы поддержки (Enter = пропустить):"
        read -r GROUP_ID
        echo "Токен CryptoBot (Enter = пропустить):"
        read -r CRYPTO_BOT_TOKEN
        
        SESSION_SECRET=$(generate_secret)
        
        cat > .env << EOF
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=${BOT_TOKEN:-your_telegram_bot_token_here}
BOT_TOKEN=${BOT_TOKEN:-your_telegram_bot_token_here}

# Admin Configuration
ADMIN_ID=${ADMIN_ID:-123456789}

# Telegram Support Group
GROUP_ID=${GROUP_ID}

# CryptoBot API for payments
CRYPTO_BOT_TOKEN=${CRYPTO_BOT_TOKEN:-your_crypto_bot_token_here}

# Session Secret for Web Application
SESSION_SECRET=${SESSION_SECRET}

# Node Environment
NODE_ENV=development
EOF
        
        print_success "Файл .env пересоздан"
    fi
fi
echo ""

# ==========================================
# Шаг 7: База данных
# ==========================================
print_info "Шаг 7: Проверка базы данных..."
echo ""

if [ -f "vpn_platform.db" ]; then
    DB_SIZE=$(du -h vpn_platform.db | cut -f1)
    print_success "База данных существует (размер: $DB_SIZE)"
    
    echo "Создать резервную копию базы данных? (y/n) [рекомендуется: y]"
    read -r backup_db
    
    if [ "$backup_db" = "y" ] || [ "$backup_db" = "Y" ]; then
        BACKUP_NAME="backups/vpn_platform_backup_$(date +%Y%m%d_%H%M%S).db"
        mkdir -p backups
        cp vpn_platform.db "$BACKUP_NAME" || {
            print_warning "Не удалось создать резервную копию"
        }
        
        if [ -f "$BACKUP_NAME" ]; then
            print_success "Резервная копия: $BACKUP_NAME"
        fi
    fi
else
    print_info "База данных будет создана при первом запуске"
fi
echo ""

# ==========================================
# Шаг 8: Сборка (опционально)
# ==========================================
print_info "Шаг 8: Сборка приложения..."
echo ""

echo "Собрать production версию? (y/n) [для разработки: n]"
read -r build_app

if [ "$build_app" = "y" ] || [ "$build_app" = "Y" ]; then
    print_info "Запускаем сборку..."
    
    if npm run build; then
        print_success "Сборка завершена: dist/"
    else
        print_error "Ошибка при сборке"
        print_warning "Используйте режим разработки: npm run dev"
    fi
else
    print_info "Пропускаем сборку (используйте npm run dev)"
fi
echo ""

# ==========================================
# Завершение
# ==========================================
echo ""
print_success "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
print_success "     УСТАНОВКА УСПЕШНО ЗАВЕРШЕНА!"
print_success "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "📝 Доступные команды:"
echo ""
echo "  1. Запуск в режиме разработки:"
echo "     npm run dev"
echo ""
echo "  2. Запуск в production режиме:"
echo "     npm run start"
echo ""
echo "  3. Запуск Telegram бота:"
echo "     ./start-bot.sh"
echo ""
echo "  4. Создание администратора:"
echo "     node add-admin.js"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "🚀 Запустить приложение сейчас? (y/n)"
read -r start_now

if [ "$start_now" = "y" ] || [ "$start_now" = "Y" ]; then
    echo ""
    print_info "Запускаем веб-приложение..."
    print_info "Нажмите Ctrl+C для остановки"
    echo ""
    print_info "Приложение будет доступно: http://localhost:5000"
    echo ""
    sleep 2
    npm run dev
else
    echo ""
    print_info "Для запуска используйте: npm run dev"
    echo ""
    echo "📚 Документация:"
    echo "   - README.md - общая информация"
    echo "   - INSTALL.md - подробная инструкция"
    echo "   - ADMIN_GUIDE.md - руководство администратора"
    echo ""
    print_success "Готово к работе!"
    echo ""
fi
