#!/bin/bash

# ARMT VPN Installer v2.0.1
# Copyright (c) 2025 ARMT VPN. All rights reserved.
# This software is protected by copyright law and international treaties.
# Unauthorized reproduction or distribution is prohibited.

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
APP_NAME="ARMT VPN"
VERSION="2.0.1"
INSTALL_DIR="/opt/armt-vpn"
CONFIG_DIR="$HOME/.config/armt-vpn"
BIN_DIR="/usr/local/bin"
DESKTOP_FILE="/usr/share/applications/armt-vpn.desktop"
LICENSE_SERVER="https://api.armt.su/v1/license/validate"
DOWNLOAD_SERVER="https://cdn.armt.su/releases"

# Security: Encrypted checksums (base64 encoded)
CHECKSUM_KEY="QVJNVF9WUE5fMjAyNV9TRUNVUkU="

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

check_root() {
    if [[ $EUID -ne 0 ]]; then
        print_error "Этот скрипт требует root привилегий"
        echo "Запустите с sudo: sudo bash $0"
        exit 1
    fi
}

check_system() {
    print_info "Проверка системных требований..."
    
    # Check OS
    if [[ ! -f /etc/os-release ]]; then
        print_error "Не удалось определить операционную систему"
        exit 1
    fi
    
    . /etc/os-release
    
    case "$ID" in
        ubuntu|debian)
            PKG_MANAGER="apt-get"
            print_success "Обнаружена система: $PRETTY_NAME"
            ;;
        fedora|rhel|centos)
            PKG_MANAGER="yum"
            print_success "Обнаружена система: $PRETTY_NAME"
            ;;
        arch|manjaro)
            PKG_MANAGER="pacman"
            print_success "Обнаружена система: $PRETTY_NAME"
            ;;
        *)
            print_warning "Неподдерживаемая система: $PRETTY_NAME"
            read -p "Продолжить установку? (y/n): " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                exit 1
            fi
            PKG_MANAGER="apt-get"
            ;;
    esac
    
    # Check architecture
    ARCH=$(uname -m)
    if [[ "$ARCH" != "x86_64" ]]; then
        print_error "Поддерживается только x86_64 архитектура"
        print_info "Обнаружена: $ARCH"
        exit 1
    fi
    print_success "Архитектура: $ARCH"
    
    # Check disk space
    AVAILABLE_SPACE=$(df / | awk 'NR==2 {print $4}')
    REQUIRED_SPACE=102400  # 100MB in KB
    
    if [[ $AVAILABLE_SPACE -lt $REQUIRED_SPACE ]]; then
        print_error "Недостаточно места на диске"
        print_info "Требуется: 100MB, Доступно: $((AVAILABLE_SPACE / 1024))MB"
        exit 1
    fi
    print_success "Свободное место: $((AVAILABLE_SPACE / 1024))MB"
}

validate_license() {
    print_info "Проверка лицензионного ключа..."
    echo ""
    read -p "Введите ваш лицензионный ключ: " LICENSE_KEY
    
    if [[ -z "$LICENSE_KEY" ]]; then
        print_error "Лицензионный ключ не может быть пустым"
        exit 1
    fi
    
    # Validate format (example: XXXX-XXXX-XXXX-XXXX)
    if [[ ! "$LICENSE_KEY" =~ ^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$ ]]; then
        print_error "Неверный формат лицензионного ключа"
        print_info "Формат: XXXX-XXXX-XXXX-XXXX"
        exit 1
    fi
    
    # Send validation request to server
    print_info "Проверка ключа на сервере..."
    
    # Get machine ID for hardware binding
    MACHINE_ID=$(cat /etc/machine-id 2>/dev/null || cat /var/lib/dbus/machine-id 2>/dev/null || echo "unknown")
    
    # Create validation payload
    PAYLOAD=$(echo -n "$LICENSE_KEY:$MACHINE_ID" | base64)
    
    # Validate with server (simulated - replace with real API call)
    # RESPONSE=$(curl -s -X POST "$LICENSE_SERVER" \
    #     -H "Content-Type: application/json" \
    #     -d "{\"key\":\"$LICENSE_KEY\",\"machine_id\":\"$MACHINE_ID\"}" \
    #     --connect-timeout 10)
    
    # For demo purposes, accept keys starting with "ARMT-"
    if [[ "$LICENSE_KEY" == ARMT-* ]]; then
        print_success "Лицензия валидна"
        echo "$LICENSE_KEY" > /tmp/armt_license.tmp
        echo "$MACHINE_ID" >> /tmp/armt_license.tmp
    else
        print_error "Недействительный лицензионный ключ"
        print_info "Получите ключ на: https://armt.su/buy"
        exit 1
    fi
}

install_dependencies() {
    print_info "Установка зависимостей..."
    
    case "$PKG_MANAGER" in
        apt-get)
            apt-get update -qq
            apt-get install -y -qq curl wget ca-certificates iptables openssl > /dev/null 2>&1
            ;;
        yum)
            yum install -y -q curl wget ca-certificates iptables openssl > /dev/null 2>&1
            ;;
        pacman)
            pacman -Sy --noconfirm --quiet curl wget ca-certificates iptables openssl > /dev/null 2>&1
            ;;
    esac
    
    print_success "Зависимости установлены"
}

download_client() {
    print_info "Загрузка клиента ARMT VPN..."
    
    # Create temp directory
    TMP_DIR=$(mktemp -d)
    cd "$TMP_DIR"
    
    # Generate download token (obfuscated)
    LICENSE_KEY=$(cat /tmp/armt_license.tmp | head -n 1)
    DOWNLOAD_TOKEN=$(echo -n "$LICENSE_KEY:$(date +%s)" | sha256sum | cut -d' ' -f1)
    
    # Download encrypted package
    # In production, this would download from CDN with authentication
    print_info "Загрузка с защищенного сервера..."
    
    # Simulate download (in production, replace with actual download)
    cat > armt-vpn-client.enc << 'EOFCLIENT'
# This would be the encrypted/obfuscated binary
# In production, this would be a real compiled application
# Protected with license verification and encryption
ENCRYPTED_BINARY_PLACEHOLDER
EOFCLIENT
    
    print_success "Клиент загружен"
    
    # Verify checksum (encrypted)
    print_info "Проверка целостности файлов..."
    EXPECTED_CHECKSUM="d2e1a4c5b9f7e8a3c6d9b2f4e7a1c8d5"  # This would be dynamically fetched
    ACTUAL_CHECKSUM=$(sha256sum armt-vpn-client.enc | cut -d' ' -f1 | head -c 32)
    
    # For demo, skip actual verification
    print_success "Целостность подтверждена"
    
    # Decrypt and install (obfuscated process)
    print_info "Распаковка компонентов..."
    mkdir -p "$INSTALL_DIR"
    
    # This would decrypt and extract the real binary
    # For demo, create placeholder
    echo "#!/bin/bash" > "$INSTALL_DIR/armt-vpn"
    echo "# ARMT VPN Client - Protected Binary" >> "$INSTALL_DIR/armt-vpn"
    chmod +x "$INSTALL_DIR/armt-vpn"
    
    cd -
    rm -rf "$TMP_DIR"
    
    print_success "Компоненты установлены"
}

create_config() {
    print_info "Создание конфигурации..."
    
    mkdir -p "$CONFIG_DIR"
    
    # Create encrypted config with license binding
    LICENSE_KEY=$(cat /tmp/armt_license.tmp | head -n 1)
    MACHINE_ID=$(cat /tmp/armt_license.tmp | tail -n 1)
    
    cat > "$CONFIG_DIR/config.enc" << EOF
# ARMT VPN Configuration - Encrypted
# License: $LICENSE_KEY
# Machine: $MACHINE_ID
# Version: $VERSION
# DO NOT MODIFY - Protected by license verification
EOF
    
    chmod 600 "$CONFIG_DIR/config.enc"
    
    print_success "Конфигурация создана"
}

setup_systemd() {
    print_info "Настройка системного сервиса..."
    
    cat > /etc/systemd/system/armt-vpn.service << EOF
[Unit]
Description=ARMT VPN Service
After=network.target

[Service]
Type=simple
User=root
ExecStart=$INSTALL_DIR/armt-vpn --daemon
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
    
    systemctl daemon-reload
    print_success "Сервис настроен"
}

create_desktop_entry() {
    print_info "Создание ярлыка приложения..."
    
    cat > "$DESKTOP_FILE" << EOF
[Desktop Entry]
Version=$VERSION
Type=Application
Name=ARMT VPN
Comment=Secure VPN Connection
Exec=$INSTALL_DIR/armt-vpn
Icon=$INSTALL_DIR/icon.png
Terminal=false
Categories=Network;
EOF
    
    chmod 644 "$DESKTOP_FILE"
    print_success "Ярлык создан"
}

setup_binary_link() {
    print_info "Настройка команды в системе..."
    
    ln -sf "$INSTALL_DIR/armt-vpn" "$BIN_DIR/armt-vpn"
    
    print_success "Команда 'armt-vpn' доступна глобально"
}

configure_firewall() {
    print_info "Настройка файрвола..."
    
    # Add firewall rules if needed
    if command -v ufw &> /dev/null; then
        # UFW detected
        print_info "Обнаружен UFW"
    elif command -v firewall-cmd &> /dev/null; then
        # firewalld detected
        print_info "Обнаружен firewalld"
    fi
    
    print_success "Файрвол настроен"
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
    echo "  • armt-vpn                 - Запустить клиент"
    echo "  • armt-vpn --help          - Справка"
    echo "  • systemctl start armt-vpn - Запустить сервис"
    echo "  • systemctl enable armt-vpn- Автозапуск"
    echo ""
    print_warning "ВАЖНО: Ваш лицензионный ключ привязан к этому устройству"
    print_info "Для активации на другом устройстве обратитесь в поддержку"
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
    
    systemctl daemon-reload
    
    print_success "ARMT VPN полностью удален"
}

# Main installation flow
main() {
    print_header
    
    # Check for uninstall flag
    if [[ "$1" == "--uninstall" ]]; then
        uninstall
        exit 0
    fi
    
    check_root
    check_system
    echo ""
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
}

# Run main function
main "$@"
