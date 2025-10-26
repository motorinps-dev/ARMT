#!/bin/bash
# Скрипт запуска Telegram бота

echo "Запуск Telegram бота ARMT VPN..."

# Проверка виртуального окружения
if [ ! -d "venv" ]; then
    echo "Создание виртуального окружения Python..."
    python3 -m venv venv
fi

# Активация виртуального окружения
source venv/bin/activate

# Установка зависимостей
echo "Установка зависимостей Python..."
pip install -r requirements.txt

# Запуск бота (используем оригинальный полнофункциональный бот)
echo "Запуск бота..."
python3 attached_assets/bot_1761427044553.py
