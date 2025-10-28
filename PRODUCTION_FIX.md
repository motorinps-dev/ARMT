# Инструкции по исправлению проблем на продакшен сервере vip.armt.su

## Проблема 1: Telegram бот не запускается

**Ошибка:** `ValueError: too many values to unpack (expected 46)`

**Решение:**

```bash
# На сервере vip.armt.su выполните:

# 1. Остановить бот
sudo systemctl stop armt-vpn-bot

# 2. Обновить файл telegram_bot.py
cd /opt/armt-vpn
sudo sed -i 's/range(53)/range(46)/' telegram_bot.py

# 3. Проверить исправление
grep "range(46)" telegram_bot.py

# 4. Запустить бот
sudo systemctl start armt-vpn-bot

# 5. Проверить статус
sudo systemctl status armt-vpn-bot
```

## Проблема 2: Сайт недоступен на https://vip.armt.su:4443

### Шаг 1: Проверка веб-сервера

```bash
# Проверить что веб-приложение работает
sudo systemctl status armt-vpn-web
curl http://localhost:5000
```

### Шаг 2: Проверка nginx

```bash
# Проверить статус nginx
sudo systemctl status nginx

# Проверить конфигурацию nginx
sudo nginx -t

# Проверить что порт 4443 слушается
sudo netstat -tlnp | grep 4443

# Проверить логи nginx
sudo tail -50 /var/log/nginx/error.log
```

### Шаг 3: Проверка firewall (UFW)

```bash
# Проверить статус firewall
sudo ufw status

# Если порт 4443 не открыт, добавить правило:
sudo ufw allow 4443/tcp
sudo ufw reload
```

### Шаг 4: Проверка SSL сертификатов

```bash
# Проверить наличие SSL сертификатов
ls -la /etc/nginx/ssl/vip.armt.su/

# Должны быть файлы:
# - fullchain.pem
# - privkey.pem

# Проверить конфигурацию nginx для SSL
cat /etc/nginx/sites-available/armt-vpn
```

### Шаг 5: Перезапуск сервисов

```bash
# Перезапустить nginx
sudo systemctl restart nginx

# Проверить что все работает
curl -k https://vip.armt.su:4443

# Если нужно - перезапустить веб-приложение
sudo systemctl restart armt-vpn-web
```

## Полная проверка системы

```bash
# Выполните все команды последовательно:

echo "=== Проверка портов ==="
sudo netstat -tlnp | grep -E ":(5000|4443|443|80) "

echo "=== Статус сервисов ==="
sudo systemctl status armt-vpn-web --no-pager
sudo systemctl status armt-vpn-bot --no-pager
sudo systemctl status nginx --no-pager

echo "=== Firewall ==="
sudo ufw status numbered

echo "=== SSL сертификаты ==="
ls -la /etc/nginx/ssl/vip.armt.su/

echo "=== Тест доступности ==="
curl -k https://vip.armt.su:4443
```

## Возможные проблемы и решения

### 1. Nginx не слушает порт 4443

**Причина:** Конфигурация не загружена

**Решение:**
```bash
sudo ln -sf /etc/nginx/sites-available/armt-vpn /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 2. SSL сертификаты не найдены

**Причина:** Самоподписанные сертификаты не были созданы

**Решение:**
```bash
sudo mkdir -p /etc/nginx/ssl/vip.armt.su
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/vip.armt.su/privkey.pem \
    -out /etc/nginx/ssl/vip.armt.su/fullchain.pem \
    -subj "/C=RU/ST=Moscow/L=Moscow/O=ARMT/OU=VPN/CN=vip.armt.su"
sudo systemctl restart nginx
```

### 3. Firewall блокирует порт

**Решение:**
```bash
sudo ufw allow 4443/tcp
sudo ufw allow 443/tcp
sudo ufw allow 80/tcp
sudo ufw reload
```

### 4. Браузер блокирует самоподписанный сертификат

**Решение:** В Chrome/Firefox нажмите "Продолжить на небезопасный сайт" (Advanced -> Proceed)

## После исправления

Проверьте доступность:
- Веб-сайт: https://vip.armt.su:4443
- Telegram бот: отправьте команду `/start` боту

Все логи:
```bash
# Логи веб-приложения
journalctl -u armt-vpn-web -f

# Логи бота
journalctl -u armt-vpn-bot -f

# Логи nginx
tail -f /var/log/nginx/error.log
```
