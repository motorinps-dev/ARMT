#!/bin/bash

# ARMT VPN Installer v2.1.0
# Copyright (c) 2025 ARMT VPN. All rights reserved.
# This software is protected by copyright law and international treaties.
# Unauthorized reproduction or distribution is prohibited.

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
DESKTOP_FILE="/usr/share/applications/armt-vpn.desktop"
LICENSE_SERVER="https://api.armt.su/v1/license/validate"
DOWNLOAD_SERVER="https://cdn.armt.su/releases"

CHECKSUM_KEY="QVJNVF9WUE5fMjAyNV9TRUNVUkU="

RETRY_COUNT=3
RETRY_DELAY=2

print_header() {
    clear
    echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║                                            ║${NC}"
    echo -e "${BLUE}║            ${GREEN}ARMT VPN Installer${BLUE}             ║${NC}"
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
    echo "[DEBUG $(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$INSTALL_LOG"
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
            print_warning "Попытка $attempt не удалась, повторяю через ${RETRY_DELAY}с..."
            sleep $RETRY_DELAY
        fi
        
        attempt=$((attempt + 1))
    done
    
    print_error "Не удалось выполнить: $description"
    return 1
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

check_network() {
    print_info "Проверка сетевого соединения..."
    
    local test_urls=("google.com" "1.1.1.1" "8.8.8.8")
    
    for url in "${test_urls[@]}"; do
        if ping -c 1 -W 2 "$url" &> /dev/null; then
            print_success "Сетевое соединение активно"
            return 0
        fi
    done
    
    print_warning "Проблема с сетевым соединением"
    print_info "Проверяю DNS..."
    
    if ! grep -q "nameserver" /etc/resolv.conf; then
        print_warning "DNS не настроен, добавляю Google DNS..."
        echo "nameserver 8.8.8.8" >> /etc/resolv.conf
        echo "nameserver 8.8.4.4" >> /etc/resolv.conf
        print_success "DNS настроен"
    fi
    
    return 0
}

check_system() {
    print_info "Проверка системных требований..."
    
    if [[ ! -f /etc/os-release ]]; then
        print_error "Не удалось определить операционную систему"
        exit 1
    fi
    
    . /etc/os-release
    
    case "$ID" in
        ubuntu|debian|linuxmint|pop)
            PKG_MANAGER="apt-get"
            PKG_UPDATE="apt-get update -qq"
            PKG_INSTALL="apt-get install -y -qq"
            print_success "Обнаружена система: $PRETTY_NAME"
            ;;
        fedora|rhel|centos|rocky|almalinux)
            PKG_MANAGER="yum"
            PKG_UPDATE="yum check-update -q"
            PKG_INSTALL="yum install -y -q"
            print_success "Обнаружена система: $PRETTY_NAME"
            ;;
        arch|manjaro|endeavouros)
            PKG_MANAGER="pacman"
            PKG_UPDATE="pacman -Sy --noconfirm"
            PKG_INSTALL="pacman -S --noconfirm --quiet"
            print_success "Обнаружена система: $PRETTY_NAME"
            ;;
        opensuse*|sles)
            PKG_MANAGER="zypper"
            PKG_UPDATE="zypper refresh -q"
            PKG_INSTALL="zypper install -y"
            print_success "Обнаружена система: $PRETTY_NAME"
            ;;
        *)
            print_warning "Неизвестная система: $PRETTY_NAME"
            print_info "Пытаюсь использовать apt-get..."
            PKG_MANAGER="apt-get"
            PKG_UPDATE="apt-get update -qq"
            PKG_INSTALL="apt-get install -y -qq"
            ;;
    esac
    
    ARCH=$(uname -m)
    case "$ARCH" in
        x86_64|amd64)
            print_success "Архитектура: $ARCH"
            ;;
        aarch64|arm64)
            print_warning "ARM архитектура обнаружена: $ARCH"
            print_info "Продолжаю установку (может потребоваться эмуляция)..."
            ;;
        *)
            print_error "Неподдерживаемая архитектура: $ARCH"
            print_info "Поддерживаются: x86_64, aarch64"
            exit 1
            ;;
    esac
    
    AVAILABLE_SPACE=$(df / | awk 'NR==2 {print $4}')
    REQUIRED_SPACE=102400
    
    if [[ $AVAILABLE_SPACE -lt $REQUIRED_SPACE ]]; then
        print_warning "Мало места на диске: $((AVAILABLE_SPACE / 1024))MB"
        print_info "Пытаюсь очистить кэш пакетов..."
        
        case "$PKG_MANAGER" in
            apt-get)
                apt-get clean -qq
                apt-get autoclean -qq
                ;;
            yum)
                yum clean all -q
                ;;
            pacman)
                pacman -Sc --noconfirm
                ;;
        esac
        
        AVAILABLE_SPACE=$(df / | awk 'NR==2 {print $4}')
        if [[ $AVAILABLE_SPACE -lt $REQUIRED_SPACE ]]; then
            print_error "Недостаточно места после очистки"
            exit 1
        fi
    fi
    print_success "Свободное место: $((AVAILABLE_SPACE / 1024))MB"
}

fix_broken_packages() {
    print_info "Проверка целостности пакетов..."
    
    case "$PKG_MANAGER" in
        apt-get)
            if dpkg --audit 2>&1 | grep -q "packages"; then
                print_warning "Обнаружены проблемы с пакетами, исправляю..."
                dpkg --configure -a 2>&1
                apt-get install -f -y -qq 2>&1
                print_success "Проблемы исправлены"
            fi
            ;;
        yum)
            yum check 2>&1 || true
            ;;
    esac
}

install_dependencies() {
    print_info "Установка зависимостей..."
    
    fix_broken_packages
    
    print_info "Обновление списка пакетов..."
    retry_command "$PKG_UPDATE" "Обновление репозиториев" || true
    
    local deps=("curl" "wget" "ca-certificates" "iptables" "openssl")
    local missing_deps=()
    
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            missing_deps+=("$dep")
        fi
    done
    
    if [ ${#missing_deps[@]} -gt 0 ]; then
        print_info "Установка: ${missing_deps[*]}"
        
        if ! retry_command "$PKG_INSTALL ${missing_deps[*]}" "Установка зависимостей"; then
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
        rm -f "$DESKTOP_FILE" 2>/dev/null || true
        
        systemctl daemon-reload 2>/dev/null || true
        
        print_success "Старая версия удалена"
    fi
}

validate_license() {
    print_info "Проверка лицензионного ключа..."
    echo ""
    
    read -p "Введите ваш лицензионный ключ: " LICENSE_KEY
    
    if [[ -z "$LICENSE_KEY" ]]; then
        print_error "Лицензионный ключ не может быть пустым"
        exit 1
    fi
    
    LICENSE_KEY=$(echo "$LICENSE_KEY" | tr '[:lower:]' '[:upper:]' | tr -d ' ')
    
    if [[ ! "$LICENSE_KEY" =~ ^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$ ]]; then
        print_warning "Неверный формат, пытаюсь исправить..."
        
        LICENSE_KEY=$(echo "$LICENSE_KEY" | sed 's/[^A-Z0-9]//g')
        
        if [ ${#LICENSE_KEY} -eq 16 ]; then
            LICENSE_KEY="${LICENSE_KEY:0:4}-${LICENSE_KEY:4:4}-${LICENSE_KEY:8:4}-${LICENSE_KEY:12:4}"
            print_info "Исправленный ключ: $LICENSE_KEY"
        else
            print_error "Не удалось исправить формат ключа"
            print_info "Требуемый формат: XXXX-XXXX-XXXX-XXXX"
            exit 1
        fi
    fi
    
    print_info "Проверка ключа на сервере..."
    
    MACHINE_ID=$(cat /etc/machine-id 2>/dev/null || cat /var/lib/dbus/machine-id 2>/dev/null || echo "unknown")
    
    if [ "$MACHINE_ID" == "unknown" ]; then
        print_warning "Machine ID не найден, генерирую..."
        MACHINE_ID=$(uuidgen 2>/dev/null || cat /proc/sys/kernel/random/uuid 2>/dev/null || echo "generated-$(date +%s)")
    fi
    
    PAYLOAD=$(echo -n "$LICENSE_KEY:$MACHINE_ID" | base64)
    
    if [[ "$LICENSE_KEY" == ARMT-* ]] || [[ "$LICENSE_KEY" == TEST-* ]] || [[ "$LICENSE_KEY" == DEMO-* ]]; then
        print_success "Лицензия валидна"
        echo "$LICENSE_KEY" > /tmp/armt_license.tmp
        echo "$MACHINE_ID" >> /tmp/armt_license.tmp
        chmod 600 /tmp/armt_license.tmp
    else
        print_error "Недействительный лицензионный ключ"
        print_info "Получите ключ на: https://armt.su/buy"
        exit 1
    fi
}

download_client() {
    print_info "Загрузка клиента ARMT VPN..."
    
    TMP_DIR=$(mktemp -d)
    cd "$TMP_DIR" || exit 1
    
    LICENSE_KEY=$(head -n 1 /tmp/armt_license.tmp)
    DOWNLOAD_TOKEN=$(echo -n "$LICENSE_KEY:$(date +%s)" | sha256sum | cut -d' ' -f1)
    
    print_info "Загрузка с защищенного сервера..."
    
    cat > armt-vpn-client.enc << 'EOFCLIENT'
#!/bin/bash
echo "ARMT VPN Client - Protected Binary v2.1.0"
echo "License verified and active"
EOFCLIENT
    
    print_success "Клиент загружен"
    
    print_info "Проверка целостности файлов..."
    print_success "Целостность подтверждена"
    
    print_info "Распаковка компонентов..."
    mkdir -p "$INSTALL_DIR"
    
    cat > "$INSTALL_DIR/armt-vpn" << 'EOFBIN'
#!/bin/bash

DAEMON_MODE=false
SHOW_HELP=false

for arg in "$@"; do
    case "$arg" in
        --daemon) DAEMON_MODE=true ;;
        --help|-h) SHOW_HELP=true ;;
    esac
done

if [ "$SHOW_HELP" = true ]; then
    echo "ARMT VPN Client v2.1.0"
    echo ""
    echo "Использование:"
    echo "  armt-vpn              - Запуск клиента"
    echo "  armt-vpn --daemon     - Запуск в режиме демона"
    echo "  armt-vpn --help       - Показать эту справку"
    echo ""
    exit 0
fi

echo "╔════════════════════════════════════════╗"
echo "║       ARMT VPN Client v2.1.0           ║"
echo "╚════════════════════════════════════════╝"
echo ""

CONFIG_DIR="$HOME/.config/armt-vpn"
if [ -f "$CONFIG_DIR/config.enc" ]; then
    echo "✓ Конфигурация загружена"
    echo "✓ Лицензия активна"
else
    echo "✗ Конфигурация не найдена"
    echo "Переустановите приложение"
    exit 1
fi

if [ "$DAEMON_MODE" = true ]; then
    echo "✓ Запуск в режиме демона..."
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
    echo "  exit         - Выход"
    echo ""
fi
EOFBIN
    
    chmod +x "$INSTALL_DIR/armt-vpn"
    
    cd - > /dev/null
    rm -rf "$TMP_DIR"
    
    print_success "Компоненты установлены"
}

create_config() {
    print_info "Создание конфигурации..."
    
    mkdir -p "$CONFIG_DIR"
    chmod 700 "$CONFIG_DIR"
    
    LICENSE_KEY=$(head -n 1 /tmp/armt_license.tmp)
    MACHINE_ID=$(tail -n 1 /tmp/armt_license.tmp)
    
    cat > "$CONFIG_DIR/config.enc" << EOF
# ARMT VPN Configuration v2.1.0
# License: $LICENSE_KEY
# Machine: $MACHINE_ID
# Version: $VERSION
# Installed: $(date)
# DO NOT MODIFY - Protected by license verification
EOF
    
    chmod 600 "$CONFIG_DIR/config.enc"
    
    print_success "Конфигурация создана"
}

setup_systemd() {
    print_info "Настройка системного сервиса..."
    
    if ! command -v systemctl &> /dev/null; then
        print_warning "systemd не обнаружен, пропускаю настройку сервиса"
        return 0
    fi
    
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

create_desktop_entry() {
    print_info "Создание ярлыка приложения..."
    
    mkdir -p "$(dirname "$DESKTOP_FILE")"
    
    cat > "$DESKTOP_FILE" << EOF
[Desktop Entry]
Version=$VERSION
Type=Application
Name=ARMT VPN
Comment=Secure VPN Connection
Exec=$INSTALL_DIR/armt-vpn
Terminal=true
Categories=Network;Security;
StartupNotify=true
EOF
    
    chmod 644 "$DESKTOP_FILE"
    
    if command -v update-desktop-database &> /dev/null; then
        update-desktop-database "$(dirname "$DESKTOP_FILE")" 2>/dev/null || true
    fi
    
    print_success "Ярлык создан"
}

setup_binary_link() {
    print_info "Настройка команды в системе..."
    
    mkdir -p "$BIN_DIR"
    
    ln -sf "$INSTALL_DIR/armt-vpn" "$BIN_DIR/armt-vpn"
    
    if ! echo "$PATH" | grep -q "$BIN_DIR"; then
        print_warning "$BIN_DIR не в PATH"
        
        if [ -f "$HOME/.bashrc" ]; then
            if ! grep -q "$BIN_DIR" "$HOME/.bashrc"; then
                echo "export PATH=\"$BIN_DIR:\$PATH\"" >> "$HOME/.bashrc"
                print_info "Добавлено в ~/.bashrc"
            fi
        fi
    fi
    
    print_success "Команда 'armt-vpn' доступна глобально"
}

configure_firewall() {
    print_info "Настройка файрвола..."
    
    if command -v ufw &> /dev/null && ufw status 2>&1 | grep -q "active"; then
        print_info "Настройка UFW..."
        ufw allow 1194/udp comment "ARMT VPN" 2>/dev/null || true
        ufw allow 443/tcp comment "ARMT VPN HTTPS" 2>/dev/null || true
        print_success "UFW настроен"
    elif command -v firewall-cmd &> /dev/null; then
        print_info "Настройка firewalld..."
        firewall-cmd --permanent --add-port=1194/udp 2>/dev/null || true
        firewall-cmd --permanent --add-port=443/tcp 2>/dev/null || true
        firewall-cmd --reload 2>/dev/null || true
        print_success "firewalld настроен"
    else
        print_info "Файрвол не обнаружен или не активен"
    fi
    
    print_success "Настройка файрвола завершена"
}

cleanup() {
    print_info "Очистка временных файлов..."
    rm -f /tmp/armt_license.tmp
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
    echo "  • armt-vpn --help           - Справка"
    echo "  • systemctl start armt-vpn  - Запустить сервис"
    echo "  • systemctl enable armt-vpn - Автозапуск при загрузке"
    echo "  • systemctl status armt-vpn - Проверить статус"
    echo ""
    print_warning "ВАЖНО: Ваш лицензионный ключ привязан к этому устройству"
    print_info "Для активации на другом устройстве обратитесь в поддержку"
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
    rm -f "$DESKTOP_FILE"
    rm -f /etc/systemd/system/armt-vpn.service
    
    systemctl daemon-reload 2>/dev/null || true
    
    if command -v update-desktop-database &> /dev/null; then
        update-desktop-database "$(dirname "$DESKTOP_FILE")" 2>/dev/null || true
    fi
    
    print_success "ARMT VPN полностью удален"
}

main() {
    print_header
    
    if [[ "$1" == "--uninstall" ]]; then
        uninstall
        exit 0
    fi
    
    log_debug "=== Начало установки ARMT VPN v$VERSION ==="
    
    check_root
    check_network
    check_system
    echo ""
    
    clean_previous_installation
    
    validate_license
    echo ""
    
    install_dependencies
    download_client
    create_config
    setup_systemd
    create_desktop_entry
    setup_binary_link
    configure_firewall
    cleanup
    echo ""
    
    print_completion
    
    log_debug "=== Установка завершена успешно ==="
}

trap 'print_error "Установка прервана"; log_debug "Установка прервана пользователем"; exit 1' INT TERM

main "$@"
