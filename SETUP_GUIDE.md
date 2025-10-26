# 🚀 Быстрая установка ARMT VPN Platform

## Автоматическая установка через setup.sh

Скрипт `setup.sh` автоматически выполнит все необходимые шаги для установки и настройки платформы.

### Как использовать:

```bash
chmod +x setup.sh
./setup.sh
```

### Что делает скрипт:

1. **Проверяет системные требования**
   - Node.js 20+
   - Python 3.x
   - npm
   - SQLite3 (опционально)

2. **Устанавливает зависимости**
   - npm пакеты для веб-приложения
   - Python пакеты для Telegram бота

3. **Настраивает окружение**
   - Создаёт файл `.env` с необходимыми переменными
   - Запрашивает у вас:
     - Токен Telegram бота
     - ID администратора
     - ID группы поддержки (опционально)
     - Токен CryptoBot (опционально)

4. **Инициализирует базу данных**
   - Создаёт резервную копию (если БД уже существует)
   - Проверяет целостность данных

5. **Собирает приложение** (опционально)
   - Компилирует TypeScript
   - Собирает frontend с Vite
   - Подготавливает production build

6. **Готовит к запуску**
   - Даёт инструкции по запуску
   - Предлагает немедленный запуск

### Необходимые данные для установки:

Перед запуском скрипта подготовьте:

1. **Токен Telegram бота**
   - Создайте бота через [@BotFather](https://t.me/BotFather)
   - Используйте команду `/newbot`
   - Скопируйте полученный токен

2. **Ваш Telegram ID**
   - Узнайте свой ID у [@userinfobot](https://t.me/userinfobot)
   - Просто отправьте ему любое сообщение

3. **Токен CryptoBot** (опционально, для приёма платежей)
   - Создайте приложение на [@CryptoBot](https://t.me/CryptoBot)
   - Получите API токен

### После установки:

#### Запуск в режиме разработки:
```bash
npm run dev
```
Приложение будет доступно на `http://localhost:5000`

#### Запуск в production:
```bash
npm run build
npm run start
```

#### Запуск Telegram бота:
```bash
./start-bot.sh
```
или
```bash
source venv/bin/activate
python3 attached_assets/bot_*.py
```

### Troubleshooting (Решение проблем):

#### Скрипт не запускается
```bash
# Убедитесь, что файл исполняемый
chmod +x setup.sh

# Запустите с bash явно
bash setup.sh
```

#### Ошибка "command not found"
```bash
# Установите недостающие зависимости
# Для Ubuntu/Debian:
sudo apt update
sudo apt install -y nodejs python3 python3-pip npm
```

#### Node.js старой версии
```bash
# Удалите старую версию и установите Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

#### Ошибки при установке npm пакетов
```bash
# Очистите кеш и переустановите
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

#### База данных заблокирована
```bash
# Остановите все процессы и перезапустите
pkill -f "node.*index"
pkill -f "python.*bot"
npm run dev
```

### Ручная установка (если скрипт не работает):

1. Установите зависимости:
```bash
npm install
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

2. Создайте `.env` из `.env.example`:
```bash
cp .env.example .env
nano .env  # отредактируйте файл
```

3. Соберите приложение:
```bash
npm run build
```

4. Запустите:
```bash
npm run dev  # или npm run start для production
```

### Полезные команды:

```bash
# Просмотр логов
npm run dev  # Логи выводятся в консоль

# Проверка типов TypeScript
npm run check

# Обновление зависимостей
npm update

# Очистка и переустановка
rm -rf node_modules
npm install

# Создание резервной копии БД
cp vpn_platform.db vpn_platform_backup_$(date +%Y%m%d).db
```

### Системные требования:

- **ОС**: Linux (Ubuntu 20.04+), macOS, или Windows с WSL
- **Node.js**: версия 20 или выше
- **Python**: версия 3.8 или выше
- **RAM**: минимум 2GB
- **Диск**: минимум 10GB свободного места

### Дополнительная документация:

- **README.md** - общее описание проекта
- **INSTALL.md** - подробная инструкция для production
- **ADMIN_GUIDE.md** - руководство администратора
- **QUICK_START.md** - быстрый старт

---

## 🔒 Безопасность

⚠️ **Важно!** После установки:

1. Измените права доступа к `.env`:
```bash
chmod 600 .env
```

2. Не публикуйте файл `.env` в git
3. Используйте сложные пароли и токены
4. Регулярно обновляйте зависимости

---

## 📞 Поддержка

Если возникли проблемы:
1. Проверьте логи приложения
2. Убедитесь, что все переменные в `.env` заполнены
3. Проверьте версии Node.js и Python
4. Просмотрите раздел Troubleshooting выше
