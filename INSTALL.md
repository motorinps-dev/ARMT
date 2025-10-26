# Инструкция по установке ARMT VPN Platform на Ubuntu Server

Эта инструкция описывает полную установку платформы ARMT VPN на чистый сервер Ubuntu 20.04/22.04/24.04.

## Требования

- Ubuntu Server 20.04 или новее
- Root доступ или sudo привилегии
- Минимум 2GB RAM
- 20GB свободного места на диске
- Доменное имя (для production)

## Шаг 1: Обновление системы

```bash
sudo apt update && sudo apt upgrade -y
```

## Шаг 2: Установка Node.js 20

```bash
# Установка NodeSource репозитория
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Установка Node.js
sudo apt install -y nodejs

# Проверка установки
node --version  # должно показать v20.x.x
npm --version
```

## Шаг 3: Установка Python и зависимостей

```bash
# Установка Python 3 и pip
sudo apt install -y python3 python3-pip python3-venv

# Проверка установки
python3 --version
```

## Шаг 4: Установка дополнительных инструментов

```bash
# Установка git, build tools и других зависимостей
sudo apt install -y git build-essential sqlite3 nginx certbot python3-certbot-nginx
```

## Шаг 5: Создание пользователя и директорий

```bash
# Создание директории для приложения
sudo mkdir -p /var/www/armt-vpn
sudo chown -R www-data:www-data /var/www/armt-vpn

# Переход в директорию
cd /var/www/armt-vpn
```

## Шаг 6: Клонирование или загрузка проекта

```bash
# Если используете git
sudo -u www-data git clone https://your-repo-url.git .

# Или загрузите файлы проекта через scp/sftp
# scp -r /path/to/project/* user@server:/var/www/armt-vpn/
```

## Шаг 7: Настройка переменных окружения

```bash
# Копирование примера конфигурации
sudo -u www-data cp .env.example .env

# Редактирование конфигурации
sudo -u www-data nano .env
```

Заполните следующие переменные:

```env
# Получите токен бота у @BotFather в Telegram
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz

# Ваш Telegram ID (узнайте у @userinfobot)
ADMIN_ID=123456789

# ID группы поддержки (опционально)
GROUP_ID=

# Токен CryptoBot для приема платежей (получите на @CryptoBot)
CRYPTO_BOT_TOKEN=your_crypto_bot_token

# Секретный ключ для сессий (сгенерируйте случайную строку)
SESSION_SECRET=$(openssl rand -hex 32)

# Режим работы
NODE_ENV=production
```

## Шаг 8: Установка зависимостей Node.js

```bash
# Установка зависимостей npm
sudo -u www-data npm install

# Сборка frontend
sudo -u www-data npm run build
```

## Шаг 9: Установка зависимостей Python для бота

```bash
# Создание виртуального окружения
sudo -u www-data python3 -m venv venv

# Активация виртуального окружения
sudo -u www-data /var/www/armt-vpn/venv/bin/pip install -r requirements.txt
```

## Шаг 10: Инициализация базы данных

```bash
# База данных создается автоматически при первом запуске
# Но вы можете создать начальные данные:

cd /var/www/armt-vpn
sudo -u www-data node dist/seed.js  # если есть скрипт seed
```

## Шаг 11: Настройка systemd сервисов

```bash
# Копирование файлов сервисов
sudo cp systemd/armt-vpn-web.service /etc/systemd/system/
sudo cp systemd/armt-vpn-bot.service /etc/systemd/system/

# Перезагрузка systemd
sudo systemctl daemon-reload

# Включение автозапуска
sudo systemctl enable armt-vpn-web
sudo systemctl enable armt-vpn-bot

# Запуск сервисов
sudo systemctl start armt-vpn-web
sudo systemctl start armt-vpn-bot

# Проверка статуса
sudo systemctl status armt-vpn-web
sudo systemctl status armt-vpn-bot
```

## Шаг 12: Настройка Nginx

Создайте конфигурацию Nginx:

```bash
sudo nano /etc/nginx/sites-available/armt-vpn
```

Вставьте следующую конфигурацию:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Активируйте конфигурацию:

```bash
# Создание символической ссылки
sudo ln -s /etc/nginx/sites-available/armt-vpn /etc/nginx/sites-enabled/

# Проверка конфигурации
sudo nginx -t

# Перезапуск Nginx
sudo systemctl restart nginx
```

## Шаг 13: Настройка SSL (HTTPS)

```bash
# Получение SSL сертификата от Let's Encrypt
sudo certbot --nginx -d your-domain.com

# Certbot автоматически настроит SSL и перенаправление с HTTP на HTTPS
```

## Шаг 14: Настройка Telegram Webhook (опционально)

Если вы хотите использовать webhook вместо polling для бота:

```bash
# Установите webhook через API
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
     -d "url=https://your-domain.com/api/telegram/webhook"
```

## Шаг 15: Настройка 3X-UI сервера (для VPN)

Вам нужен работающий 3X-UI сервер для создания VPN профилей:

1. Установите 3X-UI на отдельном сервере
2. Создайте inbound с протоколом VLESS + Reality
3. Запишите параметры подключения к панели
4. Добавьте сервер через админ-панель веб-приложения

## Синхронизация между ботом и веб-приложением

### Важно: Единая база данных

Оба компонента (веб-приложение и Telegram бот) используют **одну базу данных** `vpn_platform.db`, что обеспечивает полную синхронизацию:

- **Регистрация через бот** → пользователь видит аккаунт в веб-приложении
- **Покупка через бот** → баланс и подписка обновляются в веб-приложении
- **Пополнение через веб** → баланс доступен в боте
- **VPN профили** → создаются в обоих интерфейсах

### Как это работает:

1. **Telegram ID как ключ**: Бот использует `telegram_id` для идентификации пользователей
2. **Общие таблицы**: 
   - `users` - пользователи с балансами и подписками
   - `vpn_profiles` - VPN ключи пользователей
   - `tariffs` - тарифные планы
   - `transactions` - история транзакций
   - `servers` - настройки VPN серверов

3. **Автоматическая синхронизация**: Изменения в БД моментально видны в обоих интерфейсах

### Связывание Telegram с веб-аккаунтом:

Если пользователь регистрируется через веб-приложение:
1. Зайти в настройки веб-приложения
2. Включить Telegram 2FA
3. Получить код связывания
4. Отправить код боту командой `/link <код>`

## Управление сервисами

### Просмотр логов

```bash
# Логи веб-приложения
sudo journalctl -u armt-vpn-web -f

# Логи бота
sudo journalctl -u armt-vpn-bot -f

# Логи Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Перезапуск сервисов

```bash
# Перезапуск веб-приложения
sudo systemctl restart armt-vpn-web

# Перезапуск бота
sudo systemctl restart armt-vpn-bot

# Перезапуск Nginx
sudo systemctl restart nginx
```

### Обновление приложения

```bash
cd /var/www/armt-vpn

# Остановка сервисов
sudo systemctl stop armt-vpn-web armt-vpn-bot

# Обновление кода (если через git)
sudo -u www-data git pull

# Установка зависимостей
sudo -u www-data npm install
sudo -u www-data /var/www/armt-vpn/venv/bin/pip install -r requirements.txt

# Сборка
sudo -u www-data npm run build

# Запуск сервисов
sudo systemctl start armt-vpn-web armt-vpn-bot
```

## Резервное копирование

### Бэкап базы данных

```bash
# Создание бэкапа
sudo -u www-data sqlite3 /var/www/armt-vpn/vpn_platform.db ".backup /var/backups/vpn_platform_$(date +%Y%m%d).db"

# Автоматический бэкап через cron
sudo crontab -e

# Добавьте строку (бэкап каждый день в 3 утра):
0 3 * * * sqlite3 /var/www/armt-vpn/vpn_platform.db ".backup /var/backups/vpn_platform_$(date +\%Y\%m\%d).db"
```

### Восстановление из бэкапа

```bash
# Остановка сервисов
sudo systemctl stop armt-vpn-web armt-vpn-bot

# Восстановление базы
sudo -u www-data cp /var/backups/vpn_platform_20240101.db /var/www/armt-vpn/vpn_platform.db

# Запуск сервисов
sudo systemctl start armt-vpn-web armt-vpn-bot
```

## Мониторинг

### Проверка работоспособности

```bash
# Проверка веб-приложения
curl http://localhost:5000

# Проверка процессов
ps aux | grep node
ps aux | grep python

# Проверка портов
sudo netstat -tlnp | grep 5000
```

## Troubleshooting (Решение проблем)

### Проблема: Бот не отвечает

```bash
# Проверьте логи бота
sudo journalctl -u armt-vpn-bot -n 100

# Проверьте токен бота в .env
cat /var/www/armt-vpn/.env | grep TELEGRAM_BOT_TOKEN

# Перезапустите бота
sudo systemctl restart armt-vpn-bot
```

### Проблема: Веб-приложение не открывается

```bash
# Проверьте статус сервиса
sudo systemctl status armt-vpn-web

# Проверьте порт
sudo netstat -tlnp | grep 5000

# Проверьте Nginx
sudo nginx -t
sudo systemctl status nginx
```

### Проблема: База данных заблокирована

```bash
# SQLite иногда блокируется, перезапустите оба сервиса
sudo systemctl restart armt-vpn-web armt-vpn-bot
```

### Проблема: Не создаются VPN ключи

```bash
# Проверьте настройки серверов в базе данных
sqlite3 /var/www/armt-vpn/vpn_platform.db "SELECT * FROM servers WHERE is_active = 1;"

# Проверьте доступность 3X-UI панели
curl -I https://your-3xui-panel.com
```

## Безопасность

### Рекомендации:

1. **Firewall**: Настройте UFW
   ```bash
   sudo ufw allow 22/tcp
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw enable
   ```

2. **SSH**: Отключите вход по паролю, используйте только ключи

3. **Обновления**: Регулярно обновляйте систему
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

4. **Ограничение доступа**: Смените владельца файлов
   ```bash
   sudo chown -R www-data:www-data /var/www/armt-vpn
   sudo chmod 600 /var/www/armt-vpn/.env
   ```

## Полезные команды

```bash
# Просмотр активных пользователей
sqlite3 /var/www/armt-vpn/vpn_platform.db "SELECT COUNT(*) FROM users WHERE expires_at > datetime('now');"

# Просмотр всех VPN профилей
sqlite3 /var/www/armt-vpn/vpn_platform.db "SELECT * FROM vpn_profiles;"

# Добавление админа (замените ID на ваш Telegram ID)
sqlite3 /var/www/armt-vpn/vpn_platform.db "UPDATE users SET is_admin = 1 WHERE telegram_id = 123456789;"
```

## Поддержка

При возникновении проблем:
1. Проверьте логи сервисов
2. Убедитесь, что все переменные окружения настроены правильно
3. Проверьте доступность внешних сервисов (Telegram API, 3X-UI панель)
4. Проверьте права доступа к файлам и базе данных

## Итоговая структура проекта

```
/var/www/armt-vpn/
├── attached_assets/
│   └── bot_1761427044553.py    # Telegram бот
├── client/                      # Frontend (React)
├── server/                      # Backend (Express)
├── shared/                      # Общие типы
├── systemd/                     # Systemd сервисы
├── dist/                        # Собранное приложение
├── venv/                        # Python виртуальное окружение
├── node_modules/                # Node.js зависимости
├── vpn_platform.db             # База данных (ОБЩАЯ для бота и веб-приложения)
├── .env                         # Переменные окружения
├── package.json                 # Node.js конфигурация
├── requirements.txt             # Python зависимости
├── start-bot.sh                 # Скрипт запуска бота
└── start-web.sh                 # Скрипт запуска веб-приложения
```

## Готово!

После выполнения всех шагов:
- Веб-приложение доступно по адресу: `https://your-domain.com`
- Telegram бот работает и отвечает на команды
- База данных синхронизирована между ботом и веб-приложением
- Сервисы настроены на автозапуск при перезагрузке сервера
