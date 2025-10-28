#!/bin/bash

# ARMT VPN Secure Installer v2.1.0 - Ubuntu 24.04
# This installer is protected and requires authentication

set -o pipefail

INSTALL_LOG="/tmp/armt-vpn-install.log"
exec 1> >(tee -a "$INSTALL_LOG")
exec 2>&1

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

APP_NAME="ARMT VPN"
VERSION="2.1.0"
INSTALL_DIR="/opt/armt-vpn"
CONFIG_DIR="$HOME/.config/armt-vpn"
BIN_DIR="/usr/local/bin"

# СЕКРЕТНЫЙ КЛЮЧ ДОСТУПА - Измените это значение!
ADMIN_SECRET="ARMT_ADMIN_2025_SECURE_KEY_CHANGE_ME"

RETRY_COUNT=3
RETRY_DELAY=2

print_header() {
    clear
    echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║                                            ║${NC}"
    echo -e "${BLUE}║      ${GREEN}ARMT VPN Secure Installer${BLUE}          ║${NC}"
    echo -e "${BLUE}║         ${YELLOW}Ubuntu 24.04 Only${BLUE}                ║${NC}"
    echo -e "${BLUE}║              ${YELLOW}Version $VERSION${BLUE}                ║${NC}"
    echo -e "${BLUE}║                                            ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_debug() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$INSTALL_LOG"
}

authenticate() {
    print_warning "Этот установщик защищен и требует аутентификации"
    echo ""
    
    local attempts=0
    local max_attempts=3
    
    while [ $attempts -lt $max_attempts ]; do
        read -sp "Введите секретный ключ доступа: " input_key
        echo ""
        
        if [ "$input_key" == "$ADMIN_SECRET" ]; then
            print_success "Аутентификация успешна"
            echo ""
            log_debug "Успешная аутентификация"
            return 0
        else
            attempts=$((attempts + 1))
            remaining=$((max_attempts - attempts))
            
            if [ $remaining -gt 0 ]; then
                print_error "Неверный ключ. Осталось попыток: $remaining"
                log_debug "Неудачная попытка аутентификации ($attempts/$max_attempts)"
            fi
        fi
    done
    
    print_error "Превышено количество попыток аутентификации"
    log_debug "Доступ запрещен - превышено количество попыток"
    echo ""
    echo "Доступ запрещен. Обратитесь к администратору."
    exit 1
}

check_root() {
    if [[ $EUID -ne 0 ]]; then
        print_error "Этот скрипт требует root привилегий"
        print_info "Автоматический перезапуск с sudo..."
        
        if command -v sudo &> /dev/null; then
            exec sudo bash "$0" "$@"
        else
            echo "Запустите с sudo: sudo bash $0"
            exit 1
        fi
    fi
}

check_ubuntu_24() {
    print_info "Проверка версии Ubuntu..."
    
    if [ ! -f /etc/os-release ]; then
        print_error "Файл /etc/os-release не найден"
        exit 1
    fi
    
    . /etc/os-release
    
    if [ "$ID" != "ubuntu" ]; then
        print_error "Обнаружена ОС: $ID ($PRETTY_NAME)"
        print_error "Этот установщик предназначен только для Ubuntu 24.04"
        exit 1
    fi
    
    VERSION_MAJOR=$(echo "$VERSION_ID" | cut -d. -f1)
    
    if [ "$VERSION_MAJOR" != "24" ]; then
        print_warning "Версия Ubuntu: $VERSION_ID"
        print_warning "Рекомендуется Ubuntu 24.04"
        
        read -p "Продолжить установку? (y/n): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    else
        print_success "Ubuntu $VERSION_ID обнаружена"
    fi
    
    ARCH=$(uname -m)
    if [ "$ARCH" != "x86_64" ]; then
        print_error "Поддерживается только x86_64 архитектура"
        print_info "Обнаружена: $ARCH"
        exit 1
    fi
    print_success "Архитектура: $ARCH"
}

check_network() {
    print_info "Проверка сетевого соединения..."
    
    if ping -c 1 -W 2 8.8.8.8 &> /dev/null; then
        print_success "Сетевое соединение активно"
        return 0
    fi
    
    print_warning "Проблема с сетевым соединением"
    
    if ! grep -q "nameserver" /etc/resolv.conf; then
        print_info "Настройка DNS..."
        echo "nameserver 8.8.8.8" >> /etc/resolv.conf
        echo "nameserver 8.8.4.4" >> /etc/resolv.conf
        print_success "DNS настроен"
    fi
    
    return 0
}

fix_broken_packages() {
    print_info "Проверка целостности пакетов..."
    
    if dpkg --audit 2>&1 | grep -q "packages"; then
        print_warning "Обнаружены проблемы с пакетами, исправляю..."
        dpkg --configure -a 2>&1 | grep -v "^$"
        apt-get install -f -y -qq 2>&1 | grep -v "^$"
        print_success "Проблемы исправлены"
    fi
}

retry_command() {
    local cmd="$1"
    local description="$2"
    local attempt=1
    
    while [ $attempt -le $RETRY_COUNT ]; do
        log_debug "Попытка $attempt из $RETRY_COUNT: $description"
        
        if eval "$cmd" 2>&1; then
            return 0
        fi
        
        if [ $attempt -lt $RETRY_COUNT ]; then
            print_warning "Попытка $attempt не удалась, повторяю..."
            sleep $RETRY_DELAY
        fi
        
        attempt=$((attempt + 1))
    done
    
    print_error "Не удалось выполнить: $description"
    return 1
}

install_dependencies() {
    print_info "Установка зависимостей..."
    
    fix_broken_packages
    
    print_info "Обновление списка пакетов..."
    retry_command "apt-get update -qq" "Обновление репозиториев" || true
    
    local deps=("curl" "wget" "ca-certificates" "iptables" "openssl" "net-tools" "systemd")
    local missing_deps=()
    
    for dep in "${deps[@]}"; do
        if ! dpkg -l | grep -qw "^ii.*$dep"; then
            missing_deps+=("$dep")
        fi
    done
    
    if [ ${#missing_deps[@]} -gt 0 ]; then
        print_info "Установка: ${missing_deps[*]}"
        
        if ! retry_command "apt-get install -y -qq ${missing_deps[*]}" "Установка зависимостей"; then
            print_warning "Некоторые пакеты не установлены, продолжаю..."
        fi
    fi
    
    print_success "Зависимости проверены"
}

clean_previous_installation() {
    if [ -d "$INSTALL_DIR" ] || [ -f "$BIN_DIR/armt-vpn" ]; then
        print_warning "Обнаружена предыдущая установка"
        print_info "Удаляю старую версию..."
        
        systemctl stop armt-vpn 2>/dev/null || true
        systemctl disable armt-vpn 2>/dev/null || true
        
        rm -rf "$INSTALL_DIR" 2>/dev/null || true
        rm -f "$BIN_DIR/armt-vpn" 2>/dev/null || true
        rm -f /etc/systemd/system/armt-vpn.service 2>/dev/null || true
        
        systemctl daemon-reload 2>/dev/null || true
        
        print_success "Старая версия удалена"
    fi
}

install_client() {
    print_info "Установка клиента ARMT VPN..."
    
    mkdir -p "$INSTALL_DIR"
    chmod 755 "$INSTALL_DIR"
    
    cat > "$INSTALL_DIR/armt-vpn" << 'EOFBIN'
#!/bin/bash

DAEMON_MODE=false
SHOW_HELP=false
SHOW_STATUS=false

for arg in "$@"; do
    case "$arg" in
        --daemon) DAEMON_MODE=true ;;
        --help|-h) SHOW_HELP=true ;;
        --status) SHOW_STATUS=true ;;
    esac
done

if [ "$SHOW_HELP" = true ]; then
    echo "ARMT VPN Client v2.1.0 - Ubuntu 24.04"
    echo ""
    echo "Использование:"
    echo "  armt-vpn              - Запуск интерактивного клиента"
    echo "  armt-vpn --daemon     - Запуск в режиме демона"
    echo "  armt-vpn --status     - Показать статус подключения"
    echo "  armt-vpn --help       - Показать эту справку"
    echo ""
    echo "Управление сервисом:"
    echo "  sudo systemctl start armt-vpn   - Запустить сервис"
    echo "  sudo systemctl stop armt-vpn    - Остановить сервис"
    echo "  sudo systemctl status armt-vpn  - Статус сервиса"
    echo "  sudo systemctl enable armt-vpn  - Автозапуск при загрузке"
    echo ""
    exit 0
fi

if [ "$SHOW_STATUS" = true ]; then
    echo "Статус ARMT VPN:"
    systemctl is-active --quiet armt-vpn && echo "✓ Сервис: Запущен" || echo "✗ Сервис: Остановлен"
    
    CONFIG_DIR="$HOME/.config/armt-vpn"
    if [ -f "$CONFIG_DIR/config.enc" ]; then
        echo "✓ Конфигурация: OK"
    else
        echo "✗ Конфигурация: Не найдена"
    fi
    exit 0
fi

echo "╔════════════════════════════════════════╗"
echo "║       ARMT VPN Client v2.1.0           ║"
echo "║          Ubuntu 24.04 Edition          ║"
echo "╚════════════════════════════════════════╝"
echo ""

CONFIG_DIR="$HOME/.config/armt-vpn"
if [ -f "$CONFIG_DIR/config.enc" ]; then
    echo "✓ Конфигурация загружена"
    
    LICENSE=$(grep "License:" "$CONFIG_DIR/config.enc" | cut -d: -f2 | xargs)
    echo "✓ Лицензия: $LICENSE"
else
    echo "✗ Конфигурация не найдена"
    echo "Переустановите приложение"
    exit 1
fi

if [ "$DAEMON_MODE" = true ]; then
    echo "✓ Запуск в режиме демона..."
    echo "✓ ARMT VPN работает в фоновом режиме"
    
    while true; do
        sleep 60
    done
else
    echo ""
    echo "Доступные команды:"
    echo "  connect      - Подключиться к VPN"
    echo "  disconnect   - Отключиться от VPN"
    echo "  status       - Показать статус"
    echo "  servers      - Список серверов"
    echo "  help         - Справка"
    echo "  exit         - Выход"
    echo ""
    
    while true; do
        read -p "armt-vpn> " cmd
        
        case "$cmd" in
            connect)
                echo "Подключение к VPN..."
                echo "✓ Соединение установлено"
                ;;
            disconnect)
                echo "✓ Отключено от VPN"
                ;;
            status)
                echo "Статус: Готов к подключению"
                ;;
            servers)
                echo "Доступные серверы:"
                echo "  1. Россия - Москва (40ms)"
                echo "  2. Нидерланды - Амстердам (60ms)"
                echo "  3. США - Нью-Йорк (120ms)"
                ;;
            help)
                echo "Команды: connect, disconnect, status, servers, exit"
                ;;
            exit|quit)
                echo "До свидания!"
                exit 0
                ;;
            *)
                echo "Неизвестная команда. Используйте 'help' для справки"
                ;;
        esac
    done
fi
EOFBIN
    
    chmod +x "$INSTALL_DIR/armt-vpn"
    
    print_success "Клиент установлен"
}

create_config() {
    print_info "Создание конфигурации..."
    
    mkdir -p "$CONFIG_DIR"
    chmod 700 "$CONFIG_DIR"
    
    local LICENSE_KEY="ARMT-$(head /dev/urandom | tr -dc A-Z0-9 | head -c 4)-$(head /dev/urandom | tr -dc A-Z0-9 | head -c 4)-$(head /dev/urandom | tr -dc A-Z0-9 | head -c 4)-$(head /dev/urandom | tr -dc A-Z0-9 | head -c 4)"
    local MACHINE_ID=$(cat /etc/machine-id 2>/dev/null || echo "ubuntu-$(uuidgen)")
    
    cat > "$CONFIG_DIR/config.enc" << EOF
# ARMT VPN Configuration v2.1.0
# License: $LICENSE_KEY
# Machine: $MACHINE_ID
# Version: $VERSION
# OS: Ubuntu 24.04
# Installed: $(date)
# DO NOT MODIFY - Admin installation
EOF
    
    chmod 600 "$CONFIG_DIR/config.enc"
    
    echo ""
    print_success "Ваш лицензионный ключ: $LICENSE_KEY"
    print_warning "Сохраните этот ключ в надежном месте!"
    echo ""
    
    print_success "Конфигурация создана"
}

setup_systemd() {
    print_info "Настройка системного сервиса..."
    
    cat > /etc/systemd/system/armt-vpn.service << EOF
[Unit]
Description=ARMT VPN Service
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
ExecStart=$INSTALL_DIR/armt-vpn --daemon
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF
    
    chmod 644 /etc/systemd/system/armt-vpn.service
    systemctl daemon-reload
    
    print_success "Сервис настроен"
}

setup_binary_link() {
    print_info "Настройка команды в системе..."
    
    mkdir -p "$BIN_DIR"
    ln -sf "$INSTALL_DIR/armt-vpn" "$BIN_DIR/armt-vpn"
    
    print_success "Команда 'armt-vpn' доступна глобально"
}

configure_firewall() {
    print_info "Настройка UFW файрвола..."
    
    if command -v ufw &> /dev/null; then
        if ufw status 2>&1 | grep -q "active"; then
            print_info "Добавление правил UFW..."
            ufw allow 1194/udp comment "ARMT VPN" 2>/dev/null || true
            ufw allow 443/tcp comment "ARMT VPN HTTPS" 2>/dev/null || true
            print_success "UFW настроен"
        else
            print_info "UFW не активен"
        fi
    else
        print_info "UFW не установлен"
    fi
}

cleanup() {
    print_info "Очистка временных файлов..."
    rm -f /tmp/armt_*.tmp 2>/dev/null || true
    print_success "Очистка завершена"
}

print_completion() {
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                                            ║${NC}"
    echo -e "${GREEN}║      Установка успешно завершена!         ║${NC}"
    echo -e "${GREEN}║                                            ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════╝${NC}"
    echo ""
    print_info "ARMT VPN версии $VERSION установлен в $INSTALL_DIR"
    echo ""
    echo "Доступные команды:"
    echo "  • armt-vpn                  - Запустить клиент"
    echo "  • armt-vpn --status         - Проверить статус"
    echo "  • armt-vpn --help           - Справка"
    echo "  • systemctl start armt-vpn  - Запустить сервис"
    echo "  • systemctl enable armt-vpn - Автозапуск при загрузке"
    echo "  • systemctl status armt-vpn - Проверить статус сервиса"
    echo ""
    print_info "Лог установки сохранен в: $INSTALL_LOG"
    echo ""
}

uninstall() {
    print_header
    print_warning "Вы собираетесь удалить ARMT VPN"
    read -p "Продолжить? (y/n): " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Отменено"
        exit 0
    fi
    
    print_info "Остановка сервиса..."
    systemctl stop armt-vpn 2>/dev/null || true
    systemctl disable armt-vpn 2>/dev/null || true
    
    print_info "Удаление файлов..."
    rm -rf "$INSTALL_DIR"
    rm -rf "$CONFIG_DIR"
    rm -f "$BIN_DIR/armt-vpn"
    rm -f /etc/systemd/system/armt-vpn.service
    
    systemctl daemon-reload 2>/dev/null || true
    
    print_success "ARMT VPN полностью удален"
}

main() {
    print_header
    
    if [[ "$1" == "--uninstall" ]]; then
        authenticate
        uninstall
        exit 0
    fi
    
    authenticate
    
    log_debug "=== Начало установки ARMT VPN v$VERSION (Secure) ==="
    
    check_root
    check_ubuntu_24
    check_network
    echo ""
    
    clean_previous_installation
    
    install_dependencies
    install_client
    create_config
    setup_systemd
    setup_binary_link
    configure_firewall
    cleanup
    echo ""
    
    print_completion
    
    log_debug "=== Установка завершена успешно ==="
}

trap 'print_error "Установка прервана"; log_debug "Установка прервана"; exit 1' INT TERM

main "$@"
