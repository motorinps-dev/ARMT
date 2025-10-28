#!/bin/bash

set -e

INSTALL_DIR="/opt/armt-vpn"
GITHUB_REPO="https://github.com/motorinps-dev/ARMT"
BOT_SERVICE="armt-vpn-bot"
WEB_SERVICE="armt-vpn-web"
LOG_FILE="/var/log/armt-vpn-install.log"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
    exit 1
}

warn() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$LOG_FILE"
}

print_header() {
    clear
    echo ""
    echo -e "${CYAN}╔═══════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║                                                   ║${NC}"
    echo -e "${CYAN}║       ${GREEN}ARMT VPN Platform Installer${CYAN}              ║${NC}"
    echo -e "${CYAN}║              ${YELLOW}Ubuntu 22.04 / 24.04${CYAN}                  ║${NC}"
    echo -e "${CYAN}║                                                   ║${NC}"
    echo -e "${CYAN}╚═══════════════════════════════════════════════════╝${NC}"
    echo ""
}

check_root() {
    if [ "$EUID" -ne 0 ]; then
        error "Этот скрипт требует прав суперпользователя. Запустите: sudo bash install.sh"
    fi
}

check_ubuntu() {
    if [ ! -f /etc/os-release ]; then
        error "Невозможно определить операционную систему"
    fi

    . /etc/os-release
    if [ "$ID" != "ubuntu" ]; then
        error "Этот скрипт предназначен только для Ubuntu"
    fi

    VERSION_MAJOR=$(echo "$VERSION_ID" | cut -d. -f1)
    if [ "$VERSION_MAJOR" -lt 22 ]; then
        error "Требуется Ubuntu 22.04 или новее. Обнаружена версия: $VERSION_ID"
    fi

    log "✓ Обнаружена ОС: Ubuntu $VERSION_ID"
}

check_network() {
    info "Проверка интернет-соединения..."
    
    if ! ping -c 1 -W 2 8.8.8.8 &> /dev/null; then
        error "Нет интернет-соединения. Проверьте сеть и попробуйте снова."
    fi
    
    log "✓ Интернет-соединение активно"
}

install_system_dependencies() {
    log "Установка системных зависимостей..."

    export DEBIAN_FRONTEND=noninteractive
    apt-get update -qq
    apt-get install -y -qq \
        curl \
        wget \
        git \
        build-essential \
        python3 \
        python3-pip \
        python3-venv \
        sqlite3 \
        nginx \
        certbot \
        python3-certbot-nginx \
        ufw \
        openssl \
        net-tools \
        ca-certificates \
        gnupg 2>&1 | grep -v "^$" || true

    log "✓ Системные зависимости установлены"
}

install_nodejs() {
    log "Установка Node.js 20..."

    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        info "Node.js уже установлен: $NODE_VERSION"
        
        if [[ "$NODE_VERSION" == v20* ]]; then
            log "✓ Node.js 20 уже установлен"
            return
        fi
        
        warn "Обнаружена старая версия Node.js: $NODE_VERSION"
        info "Автоматическое обновление до Node.js 20..."
    fi

    info "Полное удаление старых версий Node.js и связанных пакетов..."
    export DEBIAN_FRONTEND=noninteractive
    
    apt-get remove -y --purge nodejs npm libnode-dev libnode72 node-* 2>/dev/null || true
    apt-get autoremove -y 2>/dev/null || true
    apt-get autoclean -y 2>/dev/null || true
    
    rm -rf /usr/local/bin/node* 2>/dev/null || true
    rm -rf /usr/local/lib/node* 2>/dev/null || true
    rm -rf /usr/local/include/node* 2>/dev/null || true
    rm -rf /usr/share/man/*/node* 2>/dev/null || true
    rm -rf /etc/apt/sources.list.d/nodesource.list* 2>/dev/null || true
    rm -rf /usr/share/keyrings/nodesource.gpg 2>/dev/null || true

    info "Загрузка и установка Node.js 20 из NodeSource..."
    
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /usr/share/keyrings/nodesource.gpg
    
    echo "deb [signed-by=/usr/share/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list
    
    apt-get update -qq
    apt-get install -y nodejs 2>&1 | tee -a "$LOG_FILE"

    if ! command -v node &> /dev/null; then
        error "Не удалось установить Node.js. Проверьте логи: $LOG_FILE"
    fi

    NODE_VERSION=$(node --version)
    NPM_VERSION=$(npm --version)
    
    if [[ "$NODE_VERSION" != v20* ]]; then
        error "Установлена неправильная версия Node.js: $NODE_VERSION (требуется v20.x)"
    fi
    
    log "✓ Node.js установлен: $NODE_VERSION"
    log "✓ NPM установлен: $NPM_VERSION"
}

collect_env_variables() {
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}  Настройка переменных окружения${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
    echo ""
    
    while true; do
        read -p "$(echo -e ${BLUE}→${NC}) Введите домен (например, vip.armt.su): " DOMAIN
        if [ -n "$DOMAIN" ]; then
            break
        fi
        warn "Домен обязателен!"
    done
    log "Домен: $DOMAIN"
    
    echo ""
    info "Для стандартной установки используйте порт 443"
    info "Для vip.armt.su используйте порт 4443"
    read -p "$(echo -e ${BLUE}→${NC}) HTTPS порт [443]: " HTTPS_PORT
    HTTPS_PORT=${HTTPS_PORT:-443}
    log "HTTPS порт: $HTTPS_PORT"
    
    echo ""
    read -p "$(echo -e ${BLUE}→${NC}) Установить SSL сертификаты Let's Encrypt? (y/n): " USE_SSL
    
    if [[ $USE_SSL =~ ^[Yy]$ ]]; then
        read -p "$(echo -e ${BLUE}→${NC}) Email для Let's Encrypt: " SSL_EMAIL
        if [ -z "$SSL_EMAIL" ]; then
            warn "Email не указан. Будет использован самоподписанный сертификат"
            USE_SSL="n"
        else
            log "SSL Email: $SSL_EMAIL"
        fi
    fi
    
    echo ""
    echo -e "${YELLOW}Telegram Bot Configuration${NC}"
    info "Создайте бота через @BotFather в Telegram"
    while true; do
        read -p "$(echo -e ${BLUE}→${NC}) Telegram Bot Token: " TELEGRAM_BOT_TOKEN
        if [ -n "$TELEGRAM_BOT_TOKEN" ]; then
            break
        fi
        warn "Bot Token обязателен!"
    done
    
    echo ""
    info "Получите ваш Telegram ID через @userinfobot"
    while true; do
        read -p "$(echo -e ${BLUE}→${NC}) Admin Telegram ID (можно несколько через запятую): " ADMIN_IDS
        if [ -n "$ADMIN_IDS" ]; then
            break
        fi
        warn "Хотя бы один Admin ID обязателен!"
    done
    
    echo ""
    read -p "$(echo -e ${BLUE}→${NC}) Group ID для поддержки [пусто = пропустить]: " GROUP_ID
    GROUP_ID=${GROUP_ID:-}
    
    echo ""
    info "CryptoBot используется для приёма платежей в криптовалюте"
    read -p "$(echo -e ${BLUE}→${NC}) CryptoBot Token [пусто = пропустить]: " CRYPTO_BOT_TOKEN
    CRYPTO_BOT_TOKEN=${CRYPTO_BOT_TOKEN:-}
    
    echo ""
    read -p "$(echo -e ${BLUE}→${NC}) SESSION_SECRET [Enter = автогенерация]: " SESSION_SECRET
    if [ -z "$SESSION_SECRET" ]; then
        SESSION_SECRET=$(openssl rand -hex 32)
        log "✓ Сгенерирован SESSION_SECRET"
    fi
    
    echo ""
    read -p "$(echo -e ${BLUE}→${NC}) Внутренний порт для Node.js [5000]: " WEB_PORT
    WEB_PORT=${WEB_PORT:-5000}
    
    echo ""
    log "✓ Все переменные окружения собраны"
}

clone_repository() {
    log "Клонирование репозитория с GitHub..."

    if [ -d "$INSTALL_DIR" ]; then
        warn "Директория $INSTALL_DIR уже существует"
        
        if systemctl is-active --quiet $WEB_SERVICE 2>/dev/null || systemctl is-active --quiet $BOT_SERVICE 2>/dev/null; then
            info "Остановка запущенных сервисов..."
            systemctl stop $BOT_SERVICE 2>/dev/null || true
            systemctl stop $WEB_SERVICE 2>/dev/null || true
        fi
        
        BACKUP_DIR="${INSTALL_DIR}_backup_$(date +%Y%m%d_%H%M%S)"
        info "Создание резервной копии в $BACKUP_DIR..."
        mv "$INSTALL_DIR" "$BACKUP_DIR"
        log "✓ Резервная копия создана"
    fi

    if ! git clone -q "$GITHUB_REPO" "$INSTALL_DIR" 2>&1; then
        error "Не удалось склонировать репозиторий. Проверьте доступ к GitHub."
    fi
    
    cd "$INSTALL_DIR"

    log "✓ Репозиторий склонирован в $INSTALL_DIR"
}

create_env_file() {
    log "Создание .env файла..."

    cat > "$INSTALL_DIR/.env" <<EOF
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=$TELEGRAM_BOT_TOKEN
BOT_TOKEN=$TELEGRAM_BOT_TOKEN

# Admin Configuration
ADMIN_ID=$ADMIN_IDS

# Telegram Support Group
GROUP_ID=$GROUP_ID

# CryptoBot API for payments
CRYPTO_BOT_TOKEN=$CRYPTO_BOT_TOKEN

# Session Secret for Web Application
SESSION_SECRET=$SESSION_SECRET

# Database
DATABASE_URL=file:./vpn_platform.db

# Node Environment
NODE_ENV=production

# Web Server Port
PORT=$WEB_PORT

# Domain
DOMAIN=$DOMAIN

# HTTPS Port
HTTPS_PORT=$HTTPS_PORT
EOF

    chmod 600 "$INSTALL_DIR/.env"
    log "✓ .env файл создан и защищён"
}

install_python_dependencies() {
    log "Установка Python зависимостей для Telegram бота..."

    cd "$INSTALL_DIR"

    if [ ! -f "requirements.txt" ]; then
        warn "Файл requirements.txt не найден, создание..."
        cat > requirements.txt <<EOF
python-telegram-bot==20.8
python-dotenv==1.0.0
aiohttp==3.9.1
qrcode==7.4.2
pillow==10.1.0
EOF
    fi

    python3 -m venv venv
    source venv/bin/activate
    pip install --upgrade pip -q
    pip install -r requirements.txt -q
    deactivate

    log "✓ Python зависимости установлены"
}

install_nodejs_dependencies() {
    log "Установка Node.js зависимостей..."

    cd "$INSTALL_DIR"
    
    info "Это может занять несколько минут..."
    
    if ! npm install --loglevel=error 2>&1 | tee -a "$LOG_FILE"; then
        error "Не удалось установить Node.js зависимости. Проверьте логи."
    fi

    log "✓ Node.js зависимости установлены"
}

initialize_database() {
    log "Инициализация базы данных..."

    cd "$INSTALL_DIR"

    if [ -f "vpn_platform.db" ]; then
        warn "База данных уже существует"
        BACKUP_NAME="vpn_platform_backup_$(date +%Y%m%d_%H%M%S).db"
        cp vpn_platform.db "$BACKUP_NAME"
        log "✓ Резервная копия БД создана: $BACKUP_NAME"
    fi

    touch vpn_platform.db
    chmod 666 vpn_platform.db

    log "✓ База данных готова"
}

build_application() {
    log "Сборка приложения..."

    cd "$INSTALL_DIR"
    
    info "Компиляция TypeScript и сборка фронтенда..."
    
    if ! npm run build 2>&1 | tee -a "$LOG_FILE"; then
        error "Не удалось собрать приложение. Проверьте логи."
    fi

    log "✓ Приложение собрано"
}

create_systemd_services() {
    log "Создание systemd сервисов..."

    cat > "/etc/systemd/system/${BOT_SERVICE}.service" <<EOF
[Unit]
Description=ARMT VPN Telegram Bot
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_DIR
EnvironmentFile=$INSTALL_DIR/.env
ExecStart=$INSTALL_DIR/venv/bin/python $INSTALL_DIR/telegram_bot.py
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

    cat > "/etc/systemd/system/${WEB_SERVICE}.service" <<EOF
[Unit]
Description=ARMT VPN Web Application
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_DIR
EnvironmentFile=$INSTALL_DIR/.env
ExecStart=/usr/bin/node $INSTALL_DIR/dist/index.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    log "✓ Systemd сервисы созданы"
}

configure_nginx() {
    log "Настройка Nginx..."

    rm -f /etc/nginx/sites-enabled/default
    rm -f /etc/nginx/sites-enabled/armt-vpn

    if [ "$HTTPS_PORT" == "443" ]; then
        cat > "/etc/nginx/sites-available/armt-vpn" <<'EOF'
server {
    listen 80;
    server_name DOMAIN_PLACEHOLDER;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name DOMAIN_PLACEHOLDER;
    
    location / {
        proxy_pass http://localhost:PORT_PLACEHOLDER;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}
EOF
        sed -i "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" /etc/nginx/sites-available/armt-vpn
        sed -i "s/PORT_PLACEHOLDER/$WEB_PORT/g" /etc/nginx/sites-available/armt-vpn
    else
        mkdir -p /etc/nginx/ssl/$DOMAIN
        
        cat > "/etc/nginx/sites-available/armt-vpn" <<'EOF'
server {
    listen 80;
    server_name DOMAIN_PLACEHOLDER;
    return 301 https://$server_name:HTTPS_PORT_PLACEHOLDER$request_uri;
}

server {
    listen HTTPS_PORT_PLACEHOLDER ssl http2;
    server_name DOMAIN_PLACEHOLDER;

    ssl_certificate /etc/nginx/ssl/DOMAIN_PLACEHOLDER/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/DOMAIN_PLACEHOLDER/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    location / {
        proxy_pass http://localhost:PORT_PLACEHOLDER;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}
EOF
        sed -i "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" /etc/nginx/sites-available/armt-vpn
        sed -i "s/PORT_PLACEHOLDER/$WEB_PORT/g" /etc/nginx/sites-available/armt-vpn
        sed -i "s/HTTPS_PORT_PLACEHOLDER/$HTTPS_PORT/g" /etc/nginx/sites-available/armt-vpn
    fi

    log "✓ Nginx конфигурация создана"
}

setup_ssl() {
    if [[ $USE_SSL =~ ^[Yy]$ ]] && [ "$HTTPS_PORT" == "443" ]; then
        log "Установка SSL сертификатов через Let's Encrypt..."
        
        systemctl restart nginx
        
        certbot --nginx -d $DOMAIN --non-interactive --agree-tos -m $SSL_EMAIL
        
        log "✓ SSL сертификаты от Let's Encrypt установлены"
        
    elif [ "$HTTPS_PORT" != "443" ]; then
        log "Создание SSL сертификатов для порта $HTTPS_PORT..."
        
        if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
            info "Найдены существующие сертификаты Let's Encrypt"
            ln -sf /etc/letsencrypt/live/$DOMAIN/fullchain.pem /etc/nginx/ssl/$DOMAIN/fullchain.pem
            ln -sf /etc/letsencrypt/live/$DOMAIN/privkey.pem /etc/nginx/ssl/$DOMAIN/privkey.pem
            log "✓ Используются сертификаты Let's Encrypt"
        else
            info "Создание самоподписанного сертификата..."
            openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
                -keyout /etc/nginx/ssl/$DOMAIN/privkey.pem \
                -out /etc/nginx/ssl/$DOMAIN/fullchain.pem \
                -subj "/C=RU/ST=Moscow/L=Moscow/O=ARMT/OU=VPN/CN=$DOMAIN" 2>/dev/null
            
            warn "Используется самоподписанный сертификат!"
            log "✓ Самоподписанный сертификат создан"
        fi
        
        ln -sf /etc/nginx/sites-available/armt-vpn /etc/nginx/sites-enabled/
        
        if nginx -t 2>&1; then
            systemctl restart nginx
            log "✓ Nginx перезапущен с новой конфигурацией"
        else
            error "Ошибка в конфигурации Nginx. Проверьте файл: /etc/nginx/sites-available/armt-vpn"
        fi
    else
        warn "SSL сертификаты не установлены. Сайт будет работать по HTTP"
        
        ln -sf /etc/nginx/sites-available/armt-vpn /etc/nginx/sites-enabled/
        
        if nginx -t 2>&1; then
            systemctl restart nginx
            log "✓ Nginx перезапущен"
        else
            error "Ошибка в конфигурации Nginx"
        fi
    fi
}

configure_firewall() {
    log "Настройка файрвола (UFW)..."

    ufw --force reset > /dev/null 2>&1
    
    ufw default deny incoming > /dev/null 2>&1
    ufw default allow outgoing > /dev/null 2>&1
    
    ufw allow 22/tcp > /dev/null 2>&1
    ufw allow 80/tcp > /dev/null 2>&1
    ufw allow 443/tcp > /dev/null 2>&1

    if [ "$HTTPS_PORT" != "443" ]; then
        ufw allow $HTTPS_PORT/tcp > /dev/null 2>&1
        log "Открыт порт $HTTPS_PORT для HTTPS"
    fi

    ufw --force enable > /dev/null 2>&1

    log "✓ Файрвол настроен"
}

start_services() {
    log "Запуск сервисов..."

    systemctl enable $WEB_SERVICE > /dev/null 2>&1
    systemctl enable $BOT_SERVICE > /dev/null 2>&1
    
    systemctl start $WEB_SERVICE
    systemctl start $BOT_SERVICE

    sleep 3

    if systemctl is-active --quiet $WEB_SERVICE; then
        log "✓ Веб-приложение запущено"
    else
        warn "✗ Веб-приложение не запустилось"
        warn "Проверьте логи: journalctl -u $WEB_SERVICE -n 50"
    fi

    if systemctl is-active --quiet $BOT_SERVICE; then
        log "✓ Telegram бот запущен"
    else
        warn "✗ Telegram бот не запустился"
        warn "Проверьте логи: journalctl -u $BOT_SERVICE -n 50"
    fi
}

print_summary() {
    echo ""
    echo -e "${GREEN}╔═══════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                                                   ║${NC}"
    echo -e "${GREEN}║         Установка завершена успешно! ✓           ║${NC}"
    echo -e "${GREEN}║                                                   ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${CYAN}📍 Информация о установке:${NC}"
    echo ""
    echo -e "   Домен:          https://$DOMAIN:$HTTPS_PORT"
    echo -e "   Директория:     $INSTALL_DIR"
    echo -e "   База данных:    $INSTALL_DIR/vpn_platform.db"
    echo ""
    echo -e "${CYAN}🔧 Управление сервисами:${NC}"
    echo ""
    echo -e "   Веб-приложение:"
    echo -e "   • systemctl status $WEB_SERVICE"
    echo -e "   • systemctl restart $WEB_SERVICE"
    echo -e "   • journalctl -u $WEB_SERVICE -f"
    echo ""
    echo -e "   Telegram бот:"
    echo -e "   • systemctl status $BOT_SERVICE"
    echo -e "   • systemctl restart $BOT_SERVICE"
    echo -e "   • journalctl -u $BOT_SERVICE -f"
    echo ""
    echo -e "${CYAN}📝 Логи установки:${NC}"
    echo -e "   $LOG_FILE"
    echo ""
    echo -e "${CYAN}🔐 Следующие шаги:${NC}"
    echo ""
    echo -e "   1. Откройте https://$DOMAIN:$HTTPS_PORT в браузере"
    echo -e "   2. Зарегистрируйте аккаунт администратора"
    echo -e "   3. Настройте тарифы и серверы в панели управления"
    echo -e "   4. Протестируйте Telegram бота"
    echo ""
    echo -e "${YELLOW}⚠️  Важно:${NC}"
    echo -e "   • Сохраните файл $INSTALL_DIR/.env"
    echo -e "   • Настройте регулярные бэкапы базы данных"
    echo -e "   • Установите мониторинг сервисов"
    echo ""
    
    if [ "$HTTPS_PORT" != "443" ]; then
        echo -e "${YELLOW}⚠️  SSL сертификат:${NC}"
        if [[ $USE_SSL =~ ^[Nn]$ ]]; then
            echo -e "   Используется самоподписанный сертификат"
            echo -e "   Для продакшена получите настоящий SSL"
        fi
        echo ""
    fi
}

cleanup_on_error() {
    warn "Произошла ошибка во время установки"
    warn "Логи сохранены в: $LOG_FILE"
    
    if [ -d "$INSTALL_DIR" ]; then
        warn "Директория установки: $INSTALL_DIR"
        warn "Вы можете удалить её и попробовать снова"
    fi
}

main() {
    trap cleanup_on_error ERR
    
    print_header
    
    check_root
    check_ubuntu
    check_network
    
    echo ""
    log "Начало установки ARMT VPN Platform"
    echo ""
    
    install_system_dependencies
    install_nodejs
    collect_env_variables
    clone_repository
    create_env_file
    install_python_dependencies
    install_nodejs_dependencies
    initialize_database
    build_application
    create_systemd_services
    configure_nginx
    setup_ssl
    configure_firewall
    start_services
    
    print_summary
}

main "$@"
