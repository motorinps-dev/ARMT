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
    echo ""
    echo -e "${BLUE}╔═══════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║       ARMT VPN Platform Installation Script      ║${NC}"
    echo -e "${BLUE}║                  Ubuntu 22.04+                    ║${NC}"
    echo -e "${BLUE}╚═══════════════════════════════════════════════════╝${NC}"
    echo ""
}

check_root() {
    if [ "$EUID" -ne 0 ]; then
        error "Этот скрипт требует прав суперпользователя. Пожалуйста, запустите с sudo."
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
    
    log "Обнаружена ОС: Ubuntu $VERSION_ID"
}

install_system_dependencies() {
    log "Установка системных зависимостей..."
    
    apt-get update
    apt-get install -y \
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
        openssl
    
    log "Системные зависимости установлены"
}

install_nodejs() {
    log "Установка Node.js 20..."
    
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        log "Node.js уже установлен: $NODE_VERSION"
        read -p "Переустановить Node.js? (y/n): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            return
        fi
    fi
    
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
    
    NODE_VERSION=$(node --version)
    NPM_VERSION=$(npm --version)
    log "Node.js установлен: $NODE_VERSION"
    log "NPM установлен: $NPM_VERSION"
}

collect_env_variables() {
    log "Сбор переменных окружения..."
    
    read -p "Введите домен для установки (например, vip.armt.su): " DOMAIN
    if [ -z "$DOMAIN" ]; then
        error "Домен обязателен для установки"
    fi
    
    read -p "Использовать SSL сертификаты Let's Encrypt? (y/n): " -n 1 -r USE_SSL
    echo
    
    if [[ $USE_SSL =~ ^[Yy]$ ]]; then
        read -p "Введите email для Let's Encrypt: " SSL_EMAIL
        if [ -z "$SSL_EMAIL" ]; then
            warn "Email не указан. Сертификаты не будут установлены."
            USE_SSL="n"
        fi
    fi
    
    read -p "HTTPS порт (по умолчанию 443, для vip.armt.su используйте 4443): " HTTPS_PORT
    HTTPS_PORT=${HTTPS_PORT:-443}
    
    read -p "Telegram Bot Token: " TELEGRAM_BOT_TOKEN
    if [ -z "$TELEGRAM_BOT_TOKEN" ]; then
        warn "Telegram Bot Token не указан. Бот не будет работать без токена."
    fi
    
    read -p "Admin Telegram IDs (через запятую): " ADMIN_IDS
    if [ -z "$ADMIN_IDS" ]; then
        warn "Admin IDs не указаны. Укажите хотя бы один ID администратора."
    fi
    
    read -p "Group ID для поддержки (опционально, Enter чтобы пропустить): " GROUP_ID
    read -p "CryptoBot Token (опционально, Enter чтобы пропустить): " CRYPTO_BOT_TOKEN
    
    read -p "SESSION_SECRET (оставьте пустым для автогенерации): " SESSION_SECRET
    if [ -z "$SESSION_SECRET" ]; then
        SESSION_SECRET=$(openssl rand -hex 32)
        log "Сгенерирован SESSION_SECRET: ${SESSION_SECRET:0:16}..."
    fi
    
    read -p "Порт для Node.js приложения (по умолчанию 5000): " WEB_PORT
    WEB_PORT=${WEB_PORT:-5000}
    
    log "Переменные окружения собраны"
}

clone_repository() {
    log "Клонирование репозитория из $GITHUB_REPO..."
    
    if [ -d "$INSTALL_DIR" ]; then
        warn "Директория $INSTALL_DIR уже существует"
        read -p "Удалить существующую установку? (y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            systemctl stop $BOT_SERVICE 2>/dev/null || true
            systemctl stop $WEB_SERVICE 2>/dev/null || true
            rm -rf "$INSTALL_DIR"
            log "Существующая установка удалена"
        else
            error "Установка прервана"
        fi
    fi
    
    git clone "$GITHUB_REPO" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
    
    log "Репозиторий склонирован в $INSTALL_DIR"
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
EOF
    
    chmod 600 "$INSTALL_DIR/.env"
    log ".env файл создан"
}

install_python_dependencies() {
    log "Установка Python зависимостей для бота..."
    
    cd "$INSTALL_DIR"
    
    if [ ! -f "requirements.txt" ]; then
        log "Файл requirements.txt не найден, создание базового списка зависимостей..."
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
    pip install --upgrade pip
    pip install -r requirements.txt
    deactivate
    
    log "Python зависимости установлены"
}

install_nodejs_dependencies() {
    log "Установка Node.js зависимостей..."
    
    cd "$INSTALL_DIR"
    npm install --production=false
    
    log "Node.js зависимости установлены"
}

initialize_database() {
    log "Инициализация базы данных..."
    
    cd "$INSTALL_DIR"
    
    if [ -f "vpn_platform.db" ]; then
        warn "База данных уже существует"
        read -p "Создать резервную копию? (y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            BACKUP_NAME="vpn_platform_backup_$(date +%Y%m%d_%H%M%S).db"
            cp vpn_platform.db "$BACKUP_NAME"
            log "Резервная копия создана: $BACKUP_NAME"
        fi
    fi
    
    touch vpn_platform.db
    chmod 666 vpn_platform.db
    
    log "База данных инициализирована"
}

build_application() {
    log "Сборка приложения..."
    
    cd "$INSTALL_DIR"
    npm run build
    
    log "Приложение собрано"
}

create_systemd_services() {
    log "Создание systemd сервисов..."
    
    cat > "/etc/systemd/system/${BOT_SERVICE}.service" <<EOF
[Unit]
Description=ARMT VPN Telegram Bot
After=network.target

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
After=network.target

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
    log "Systemd сервисы созданы"
}

configure_nginx() {
    log "Настройка Nginx..."
    
    if [ "$HTTPS_PORT" == "443" ]; then
        cat > "/etc/nginx/sites-available/armt-vpn" <<EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    location / {
        proxy_pass http://localhost:$WEB_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF
    else
        cat > "/etc/nginx/sites-available/armt-vpn" <<EOF
server {
    listen 80;
    server_name $DOMAIN;
    return 301 https://\$server_name:$HTTPS_PORT\$request_uri;
}

server {
    listen $HTTPS_PORT ssl http2;
    server_name $DOMAIN;

    ssl_certificate /etc/nginx/ssl/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/$DOMAIN/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    location / {
        proxy_pass http://localhost:$WEB_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}
EOF
    fi
    
    ln -sf /etc/nginx/sites-available/armt-vpn /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
    
    nginx -t
    systemctl restart nginx
    
    log "Nginx настроен"
}

setup_ssl() {
    if [[ $USE_SSL =~ ^[Yy]$ ]]; then
        log "Установка SSL сертификатов..."
        
        if [ "$HTTPS_PORT" == "443" ]; then
            log "Конфигурация nginx уже создана, запуск certbot..."
            certbot --nginx -d $DOMAIN --non-interactive --agree-tos -m $SSL_EMAIL
            log "SSL сертификаты установлены через Let's Encrypt"
        else
            mkdir -p /etc/nginx/ssl/$DOMAIN
            
            if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
                log "Найдены существующие сертификаты Let's Encrypt"
                ln -sf /etc/letsencrypt/live/$DOMAIN/fullchain.pem /etc/nginx/ssl/$DOMAIN/fullchain.pem
                ln -sf /etc/letsencrypt/live/$DOMAIN/privkey.pem /etc/nginx/ssl/$DOMAIN/privkey.pem
            else
                log "Создание самоподписанного сертификата для порта $HTTPS_PORT..."
                openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
                    -keyout /etc/nginx/ssl/$DOMAIN/privkey.pem \
                    -out /etc/nginx/ssl/$DOMAIN/fullchain.pem \
                    -subj "/C=RU/ST=Moscow/L=Moscow/O=ARMT/OU=VPN/CN=$DOMAIN"
                
                warn "Используется самоподписанный сертификат. Для продакшена получите настоящий SSL сертификат."
            fi
            
            log "SSL сертификаты настроены для порта $HTTPS_PORT"
        fi
    else
        log "SSL сертификаты не установлены. Сайт будет работать по HTTP"
    fi
}

configure_firewall() {
    log "Настройка файрвола (UFW)..."
    
    ufw --force enable
    ufw allow 22/tcp
    ufw allow 80/tcp
    ufw allow 443/tcp
    
    if [ "$HTTPS_PORT" != "443" ]; then
        ufw allow $HTTPS_PORT/tcp
        log "Открыт порт $HTTPS_PORT для HTTPS"
    fi
    
    log "Файрвол настроен"
}

start_services() {
    log "Запуск сервисов..."
    
    systemctl enable $BOT_SERVICE
    systemctl enable $WEB_SERVICE
    systemctl start $WEB_SERVICE
    systemctl start $BOT_SERVICE
    
    sleep 5
    
    if systemctl is-active --quiet $WEB_SERVICE; then
        log "✓ Веб-приложение запущено успешно"
    else
        warn "✗ Веб-приложение не запустилось. Проверьте: journalctl -u $WEB_SERVICE -n 50"
    fi
    
    if systemctl is-active --quiet $BOT_SERVICE; then
        log "✓ Telegram бот запущен успешно"
    else
        warn "✗ Telegram бот не запустился. Проверьте: journalctl -u $BOT_SERVICE -n 50"
    fi
}

print_summary() {
    echo ""
    echo -e "${GREEN}╔═══════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║           Установка завершена успешно!           ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${BLUE}Информация об установке:${NC}"
    echo -e "  Директория: ${GREEN}$INSTALL_DIR${NC}"
    echo -e "  Домен: ${GREEN}$DOMAIN${NC}"
    echo -e "  Backend порт: ${GREEN}$WEB_PORT${NC}"
    echo -e "  HTTPS порт: ${GREEN}$HTTPS_PORT${NC}"
    if [[ $USE_SSL =~ ^[Yy]$ ]]; then
        echo -e "  URL: ${GREEN}https://$DOMAIN:$HTTPS_PORT${NC}"
    else
        echo -e "  URL: ${GREEN}http://$DOMAIN${NC}"
    fi
    echo ""
    echo -e "${BLUE}Сервисы:${NC}"
    echo -e "  Статус бота: ${GREEN}systemctl status $BOT_SERVICE${NC}"
    echo -e "  Статус веб-сервера: ${GREEN}systemctl status $WEB_SERVICE${NC}"
    echo ""
    echo -e "${BLUE}Управление:${NC}"
    echo -e "  Логи бота: ${GREEN}journalctl -u $BOT_SERVICE -f${NC}"
    echo -e "  Логи веб-сервера: ${GREEN}journalctl -u $WEB_SERVICE -f${NC}"
    echo -e "  Перезапуск: ${GREEN}systemctl restart $WEB_SERVICE${NC}"
    echo ""
    echo -e "${BLUE}База данных:${NC}"
    echo -e "  Путь: ${GREEN}$INSTALL_DIR/vpn_platform.db${NC}"
    echo ""
    echo -e "${YELLOW}⚠  Для создания первого администратора используйте:${NC}"
    echo -e "${GREEN}  node $INSTALL_DIR/add-admin.js${NC}"
    echo ""
    echo -e "${BLUE}Логи установки: ${GREEN}$LOG_FILE${NC}"
    echo ""
}

main() {
    print_header
    
    log "Начало установки ARMT VPN Platform..."
    
    check_root
    check_ubuntu
    
    log "Создание лог-файла: $LOG_FILE"
    touch "$LOG_FILE"
    
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
    
    if [ "$HTTPS_PORT" == "443" ]; then
        configure_nginx
        setup_ssl
    else
        setup_ssl
        configure_nginx
    fi
    
    configure_firewall
    start_services
    
    print_summary
    
    log "Установка завершена успешно!"
}

main "$@"
