# Руководство по установке ARMT VPN Platform

## 🚀 Быстрая установка

Для автоматической установки используйте скрипт `install.sh`:

```bash
chmod +x install.sh
./install.sh
```

Скрипт автоматически:
- Проверит и установит Node.js 20 (если не установлен)
- Проверит и установит Python 3 (опционально, для Telegram бота)
- Установит SQLite3 (опционально, для удобства администрирования)
- Установит все npm и Python зависимости
- Создаст файл `.env` с безопасным SESSION_SECRET
- Настроит базу данных
- Предложит собрать production версию

## 📋 Системные требования

### Обязательные:
- **Node.js 20+** (автоматически устанавливается скриптом)
- **npm** (устанавливается вместе с Node.js)

### Опциональные:
- **Python 3.8+** (для Telegram бота)
- **SQLite3** (для администрирования БД)

## 🔧 Ручная установка

Если автоматический скрипт не подходит:

### 1. Установка Node.js

**Ubuntu/Debian:**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

**CentOS/RHEL:**
```bash
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs
```

**Через snap (любая Linux система):**
```bash
sudo snap install node --classic --channel=20
```

### 2. Установка Python (для Telegram бота)

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install -y python3 python3-pip python3-venv
```

**CentOS/RHEL:**
```bash
sudo yum install -y python3 python3-pip
```

### 3. Установка зависимостей

```bash
# npm пакеты
npm install

# Python пакеты (если используете бота)
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
deactivate
```

### 4. Настройка переменных окружения

Создайте файл `.env` (можно скопировать из `.env.example`):

```bash
cp .env.example .env
nano .env
```

**Важные переменные:**

```env
# Секретный ключ для сессий (ОБЯЗАТЕЛЬНО ИЗМЕНИТЕ!)
SESSION_SECRET=сгенерируйте_случайный_ключ_здесь

# Telegram бот (опционально)
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather
ADMIN_ID=your_telegram_id

# Для приёма платежей (опционально)
CRYPTO_BOT_TOKEN=your_crypto_bot_token
```

**Генерация SESSION_SECRET:**

```bash
# Способ 1: через openssl
openssl rand -hex 32

# Способ 2: через urandom
head -c 32 /dev/urandom | base64

# Способ 3: через Python
python3 -c "import secrets; print(secrets.token_hex(32))"
```

### 5. Сборка приложения (опционально)

Для production:
```bash
npm run build
```

Для разработки сборка не нужна.

## 🎯 Запуск приложения

### Режим разработки:
```bash
npm run dev
```

Приложение доступно на: `http://localhost:5000`

### Production режим:
```bash
# Сначала соберите приложение
npm run build

# Затем запустите
npm run start
```

### Запуск Telegram бота:
```bash
./start-bot.sh
```
Или:
```bash
source venv/bin/activate
python3 attached_assets/bot_*.py
```

## 🔐 Создание администратора

После первого запуска создайте администратора:

```bash
node add-admin.js
```

Или используйте существующие учётные данные:
- Email: `owner@armt.su`
- Password: `owner123`

## 🛠️ Решение проблем

### Node.js не устанавливается

**Проблема:** Ошибка при установке через NodeSource

**Решение:**
```bash
# Попробуйте через snap
sudo snap install node --classic --channel=20

# Или скачайте вручную
wget https://nodejs.org/dist/v20.x.x/node-v20.x.x-linux-x64.tar.xz
tar -xf node-v20.x.x-linux-x64.tar.xz
sudo mv node-v20.x.x-linux-x64 /opt/nodejs
echo 'export PATH=/opt/nodejs/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

### npm install выдаёт ошибки

**Проблема:** Конфликты зависимостей

**Решение:**
```bash
# Очистите кэш
npm cache clean --force

# Установите с --legacy-peer-deps
npm install --legacy-peer-deps

# Или удалите и переустановите
rm -rf node_modules package-lock.json
npm install
```

### База данных не создаётся

**Проблема:** Нет прав на запись

**Решение:**
```bash
# Проверьте права на директорию
ls -la vpn_platform.db

# Дайте права, если нужно
chmod 644 vpn_platform.db
```

### Приложение не запускается на порту 5000

**Проблема:** Порт занят

**Решение:**
```bash
# Найдите процесс на порту 5000
sudo lsof -i :5000

# Или используйте другой порт
PORT=3000 npm run dev
```

## 📚 Дополнительные ресурсы

- `README.md` - Общая информация о проекте
- `INSTALL.md` - Подробная инструкция по установке на Ubuntu Server
- `ADMIN_GUIDE.md` - Руководство администратора
- `setup.sh` - Альтернативный скрипт установки

## 🆘 Поддержка

Если у вас возникли проблемы:

1. Проверьте логи: `npm run dev` покажет ошибки
2. Убедитесь, что все зависимости установлены
3. Проверьте файл `.env` на правильность настроек
4. Создайте issue на GitHub с описанием проблемы

## ✨ Что дальше?

После успешной установки:

1. Откройте приложение в браузере: `http://localhost:5000`
2. Создайте администратора (если не создали)
3. Войдите в админ-панель
4. Настройте серверы, тарифы, промокоды
5. Настройте Telegram бота (опционально)
6. Начните использовать платформу!

---

**Версия скрипта:** 1.0  
**Последнее обновление:** 26 октября 2025
