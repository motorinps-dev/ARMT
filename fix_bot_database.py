#!/usr/bin/env python3
"""
Скрипт для автоматического исправления пути к базе данных в боте
Меняет vpn_bot.db на vpn_platform.db для синхронизации с веб-приложением
"""

import re
import shutil
from pathlib import Path

def patch_bot_file():
    bot_file = Path('attached_assets/bot_1761427044553.py')
    
    if not bot_file.exists():
        print("❌ Файл бота не найден!")
        return False
    
    # Создание резервной копии
    backup_file = bot_file.with_suffix('.py.backup')
    shutil.copy2(bot_file, backup_file)
    print(f"✅ Создана резервная копия: {backup_file}")
    
    # Чтение файла
    with open(bot_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Подсчет замен
    count_double = content.count('"vpn_bot.db"')
    count_single = content.count("'vpn_bot.db'")
    total_count = count_double + count_single
    
    if total_count == 0:
        print("✅ База данных уже настроена на vpn_platform.db")
        return True
    
    # Замена путей к базе данных
    content = content.replace('"vpn_bot.db"', '"vpn_platform.db"')
    content = content.replace("'vpn_bot.db'", "'vpn_platform.db'")
    
    # Сохранение изменений
    with open(bot_file, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"✅ Патч применен успешно!")
    print(f"📝 Заменено вхождений: {total_count}")
    print(f"📊 База данных изменена на vpn_platform.db")
    print(f"💾 Резервная копия сохранена в: {backup_file}")
    print("")
    print("⚠️  ВАЖНО: После применения патча бот и веб-приложение используют ОДНУ базу данных")
    print("✨ Теперь все данные синхронизированы между ботом и веб-интерфейсом!")
    
    return True

if __name__ == "__main__":
    print("🔧 Применение патча синхронизации базы данных...")
    print("")
    
    success = patch_bot_file()
    
    if success:
        print("")
        print("✅ Готово! Теперь можно запускать бота.")
    else:
        print("")
        print("❌ Произошла ошибка при применении патча.")
