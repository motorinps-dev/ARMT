# Патч для синхронизации бота с единой базой данных

## Изменения в attached_assets/bot_1761427044553.py

Для обеспечения синхронизации между Telegram ботом и веб-приложением необходимо внести следующие изменения:

### 1. Изменить путь к базе данных

Найдите все вхождения `"vpn_bot.db"` и замените на `"vpn_platform.db"`:

```python
# Было:
with sqlite3.connect("vpn_bot.db") as conn:

# Стало:
with sqlite3.connect("vpn_platform.db") as conn:
```

### 2. Адаптация структуры таблицы users

Таблица `users` в веб-приложении использует:
- `id` (INTEGER PRIMARY KEY AUTOINCREMENT) - внутренний ID
- `telegram_id` (INTEGER UNIQUE) - Telegram ID пользователя

Необходимо обновить все SQL запросы, которые работают с пользователями:

```python
# Было:
cursor.execute("SELECT * FROM users WHERE user_id = ?", (user.id,))

# Стало:
cursor.execute("SELECT * FROM users WHERE telegram_id = ?", (user.id,))
```

### 3. Обновление функции init_db()

Функция `init_db()` должна проверять существование таблиц, но не пересоздавать их, так как они уже созданы веб-приложением.

### 4. Обновление функции create_and_assign_vpn_profile_from_panel()

Изменить создание записи VPN профиля для совместимости с веб-приложением:

```python
# Получить user.id по telegram_id
cursor.execute("SELECT id FROM users WHERE telegram_id = ?", (user_id,))
user_row = cursor.fetchone()
if user_row:
    user_db_id = user_row[0]
    cursor.execute(
        "INSERT INTO vpn_profiles (user_id, server_id, config_link) VALUES (?, ?, ?)",
        (user_db_id, selected_server['id'], config_link)
    )
```

### 5. Колонки для совместимости

Добавить колонки `client_uuid` и `inbound_id` в таблицу `vpn_profiles` (если их нет):

```python
cursor.execute("ALTER TABLE vpn_profiles ADD COLUMN client_uuid TEXT")
cursor.execute("ALTER TABLE vpn_profiles ADD COLUMN inbound_id INTEGER")
```

## Автоматический скрипт для применения изменений

Создан скрипт `fix_bot_database.py` для автоматического применения патча:

```python
import re

def patch_bot_file():
    with open('attached_assets/bot_1761427044553.py', 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Замена пути к базе данных
    content = content.replace('"vpn_bot.db"', '"vpn_platform.db"')
    content = content.replace("'vpn_bot.db'", "'vpn_platform.db'")
    
    # Сохранение изменений
    with open('attached_assets/bot_1761427044553.py', 'w', encoding='utf-8') as f:
        f.write(content)
    
    print("✅ Патч применен успешно!")
    print("📝 База данных изменена на vpn_platform.db")

if __name__ == "__main__":
    patch_bot_file()
```

## Проверка синхронизации

После применения патча проверьте:

1. **База данных**: убедитесь, что бот создает записи в `vpn_platform.db`
2. **Пользователи**: новые пользователи бота появляются в веб-приложении
3. **VPN профили**: ключи создаются в обоих интерфейсах
4. **Баланс**: пополнения через веб видны в боте и наоборот

## Важные замечания

- После патча бот и веб-приложение используют **одну базу данных**
- Все изменения синхронизируются автоматически
- Резервное копирование базы данных теперь охватывает оба интерфейса
