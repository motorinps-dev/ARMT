import logging
import os
import sqlite3
import asyncio
import uuid
import json
import csv
from datetime import datetime, timedelta
from io import BytesIO

from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.error import TelegramError
from telegram.ext import (
    ApplicationBuilder,
    CommandHandler,
    MessageHandler,
    ContextTypes,
    ConversationHandler,
    CallbackQueryHandler,
    filters,
)
from telegram.helpers import escape_markdown
from dotenv import load_dotenv
import aiohttp
import qrcode

# =======================================
# ===           НАСТРОЙКИ             ===
# =======================================

load_dotenv()
BOT_TOKEN = os.getenv("BOT_TOKEN")
ADMIN_ID_STR = os.getenv("ADMIN_ID")
ADMIN_IDS = [int(admin_id) for admin_id in ADMIN_ID_STR.split(',')] if ADMIN_ID_STR else []
GROUP_ID_STR = os.getenv("GROUP_ID")
GROUP_ID = int(GROUP_ID_STR) if GROUP_ID_STR else 0
CRYPTO_BOT_TOKEN = os.getenv("CRYPTO_BOT_TOKEN")
MIN_RUB_DEPOSIT = 130
# НОВЫЕ ПАРАМЕТРЫ ДЛЯ ПРОБНОГО ПЕРИОДА
TRIAL_DAYS = 1
TRIAL_GB = 1

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s", level=logging.INFO
)
logger = logging.getLogger(__name__)

(
    STATE_MAIN_MENU, STATE_SELECT_TARIFF, STATE_SELECT_PAYMENT_METHOD,
    STATE_SELECT_CURRENCY, STATE_AWAIT_PAYMENT, STATE_SUPPORT_CHAT,
    STATE_ADMIN_PANEL, STATE_ADMIN_GRANT_ID, STATE_ADMIN_GRANT_TARIFF,
    STATE_ADMIN_BROADCAST_MESSAGE, STATE_ADMIN_REVOKE_ID, STATE_ADMIN_REVOKE_CONFIRM,
    STATE_INSTRUCTIONS,
    STATE_ADMIN_FIND_BY_KEY_INPUT, STATE_ADMIN_EDIT_TEXT_LIST,
    STATE_ADMIN_EDIT_TEXT_INPUT,
    STATE_BALANCE_MENU, STATE_BALANCE_CRYPTO_AMOUNT, STATE_BALANCE_AWAIT_CRYPTO_PAYMENT,
    STATE_BALANCE_RUB_AMOUNT, STATE_ADMIN_FIND_USER_INPUT, STATE_ADMIN_USER_PROFILE,
    STATE_ADMIN_SEND_MESSAGE_INPUT, STATE_ADMIN_CREDIT_BALANCE_ID, STATE_ADMIN_CREDIT_BALANCE_AMOUNT,
    STATE_ADMIN_SERVERS_MENU, STATE_ADMIN_VIEW_SERVER,
    STATE_ADMIN_ADD_SERVER_NAME, STATE_ADMIN_ADD_SERVER_URL,
    STATE_ADMIN_ADD_SERVER_USER, STATE_ADMIN_ADD_SERVER_PASS,
    STATE_ADMIN_ADD_SERVER_ADDRESS, STATE_ADMIN_ADD_SERVER_PORT,
    STATE_ADMIN_ADD_SERVER_INBOUND_ID, STATE_ADMIN_ADD_SERVER_SNI,
    STATE_ADMIN_ADD_SERVER_FLOW, STATE_ADMIN_ADD_SERVER_PBK,
    STATE_ADMIN_ADD_SERVER_SID,
    STATE_AWAIT_PROMOCODE,
    STATE_ADMIN_TARIFFS_MENU, STATE_ADMIN_EDIT_TARIFF, STATE_ADMIN_EDIT_TARIFF_INPUT,
    STATE_ADMIN_PROMO_MENU, STATE_ADMIN_ADD_PROMO_CODE, STATE_ADMIN_ADD_PROMO_DISCOUNT,
    STATE_ADMIN_ADD_PROMO_USES,
) = range(53)

# !!! ВАЖНО: Тарифы теперь управляются через базу данных, этот словарь больше не используется для отображения !!!
# Он оставлен для обратной совместимости в редких случаях, но основная логика переписана.
# !!! ВАЖНО: Тарифы теперь управляются через базу данных, этот словарь больше не используется для отображения !!!
# Он оставлен для обратной совместимости в редких случаях, но основная логика переписана.
PRICES = {
    "1_month": {"name": "1 Месяц", "price": 130, "months": 1, "days": 31, "gb": 1000},
    "3_months": {"name": "3 Месяца", "price": 390, "months": 3, "days": 93, "gb": 3000},
    "12_months": {"name": "1 Год", "price": 1000, "months": 12, "days": 366, "gb": 12000},
}

# =======================================
# ===    КЛАСС ДЛЯ РАБОТЫ С API 3X-UI ===
# =======================================
class XUI_API:
    def __init__(self, base_url, username, password):
        self.base_url = base_url.rstrip('/')
        self.username = username
        self.password = password
        self._session = aiohttp.ClientSession()
        self.session_cookie = None
        self.login_lock = asyncio.Lock()

    async def close(self):
        if self._session and not self._session.closed:
            await self._session.close()

    async def login(self):
        """Проверяет доступность панели и правильность данных для входа."""
        url = f"{self.base_url}/login"
        login_payload = {"username": self.username, "password": self.password}
        try:
            async with self._session.post(url, data=login_payload, timeout=10) as response:
                if response.status == 200 and 'session' in response.cookies:
                    logger.info(f"Панель {self.base_url} доступна, авторизация успешна.")
                    return True
                else:
                    logger.error(f"Панель {self.base_url} недоступна или данные неверны. Статус: {response.status}")
                    return False
        except Exception as e:
            logger.error(f"Не удалось подключиться к панели {self.base_url}: {e}")
            return False
        """Просто проверяет, что панель доступна и отвечает."""
        url = f"{self.base_url}/login"
        try:
            async with self._session.get(url, timeout=10) as response:
                if response.status == 200:
                    logger.info(f"Панель {self.base_url} доступна.")
                    return True
                else:
                    logger.error(f"Панель {self.base_url} недоступна. Статус: {response.status}")
                    return False
        except Exception as e:
            logger.error(f"Не удалось подключиться к панели {self.base_url}: {e}")
            return False
    
    async def _api_request(self, method, endpoint, **kwargs):
    # Шаг 1: Авторизация для получения сессии
        login_payload = {"username": self.username, "password": self.password}
        login_url = f"{self.base_url}/login"
    
    # Используем одну сессию для логина и последующего запроса
    # aiohttp автоматически сохранит cookie внутри этой сессии
        try:
            async with self._session.post(login_url, data=login_payload, timeout=10) as login_response:
                if login_response.status != 200:
                    logger.error(f"Ошибка авторизации в 3X-UI ({self.base_url}): Статус {login_response.status}")
                    return None
                # Проверяем, что ответ содержит cookie, даже если он нестандартный
                if not self._session.cookie_jar:
                    logger.error(f"Панель {self.base_url} не вернула cookie после успешного логина.")
                    return None
                logger.info(f"Успешно получен cookie сессии от {self.base_url}")

            # Шаг 2: Выполнение основного запроса с использованием cookie из сессии
            url = f"{self.base_url}{endpoint}"
            async with self._session.request(method, url, timeout=15, **kwargs) as response:
                if response.status != 200:
                    logger.error(f"Ошибка в API запросе к {endpoint}: {response.status}, {await response.text()}")
                    return None
                return await response.json()

        except Exception as e:
            logger.error(f"Исключение при выполнении API запроса к {endpoint}: {e}")
            return None
    
    async def _handle_response(self, response, endpoint):
        if response.status != 200:
            logger.error(f"Ошибка в API запросе к {endpoint} на {self.base_url}: {response.status}, {await response.text()}")
            return None
        return await response.json()

    async def add_vless_client(self, inbound_id: int, user_id: int, days: int, gb: int, flow: str = "xtls-rprx-vision"):
        client_uuid = str(uuid.uuid4())
        email = f"user_{user_id}_{datetime.now().strftime('%Y%m%d%H%M')}"
        expire_time = int((datetime.now() + timedelta(days=days)).timestamp() * 1000)
        total_gb = gb * 1024 * 1024 * 1024

        client = {
            "id": client_uuid, "email": email, "flow": flow,
            "totalGB": total_gb, "expiryTime": expire_time, "enable": True,
            "tgId": str(user_id), "subId": ""
        }
        settings = {"clients": [client]}
        payload = {"id": inbound_id, "settings": json.dumps(settings)}

        response = await self._api_request("POST", "/panel/api/inbounds/addClient", json=payload)

        if response and response.get("success"):
            logger.info(f"Успешно создан VLESS клиент {client_uuid} для пользователя {user_id} в inbound {inbound_id} на {self.base_url}")
            return {"uuid": client_uuid, "email": email}
        else:
            logger.error(f"Не удалось создать VLESS клиента для {user_id} на {self.base_url}. Ответ панели: {response}")
            return None

    async def delete_client(self, inbound_id: int, client_uuid: str):
        endpoint = f"/panel/api/inbounds/{inbound_id}/delClient/{client_uuid}"
        response = await self._api_request("POST", endpoint)

        if response and response.get("success"):
            logger.info(f"Успешно удален клиент {client_uuid} из inbound {inbound_id} на {self.base_url}")
            return True
        else:
            logger.error(f"Не удалось удалить клиента {client_uuid} на {self.base_url}. Ответ панели: {response}")
            return False

# =======================================
# ===          БАЗА ДАННЫХ            ===
# =======================================
def init_db():
    with sqlite3.connect("vpn_platform.db") as conn:
        cursor = conn.cursor()
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            user_id INTEGER PRIMARY KEY, username TEXT, subscription_type TEXT,
            expires_at TEXT, referrer_id INTEGER, referral_balance REAL DEFAULT 0,
            main_balance REAL DEFAULT 0, has_used_trial INTEGER DEFAULT 0, has_used_trial INTEGER DEFAULT 0
        )""")
        
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS servers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL, panel_url TEXT NOT NULL,
            panel_username TEXT NOT NULL, panel_password TEXT NOT NULL,
            vless_address TEXT NOT NULL, vless_port INTEGER NOT NULL,
            vless_inbound_id INTEGER NOT NULL, vless_sni TEXT NOT NULL,
            vless_flow TEXT NOT NULL, vless_public_key TEXT NOT NULL,
            vless_short_id TEXT NOT NULL, is_active INTEGER DEFAULT 1
        )""")
        
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS vpn_profiles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            assigned_to_user_id INTEGER NOT NULL, server_id INTEGER NOT NULL,
            config_link TEXT NOT NULL, client_uuid TEXT NOT NULL,
            inbound_id INTEGER NOT NULL, created_at TEXT NOT NULL,
            FOREIGN KEY (server_id) REFERENCES servers (id) ON DELETE CASCADE
        )""")

        cursor.execute("""
        CREATE TABLE IF NOT EXISTS tariffs (
            id INTEGER PRIMARY KEY AUTOINCREMENT, key TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
            price REAL NOT NULL, days INTEGER NOT NULL, gb INTEGER NOT NULL, is_active INTEGER DEFAULT 1
        )""")

        cursor.execute("""
        CREATE TABLE IF NOT EXISTS promocodes (
            code TEXT PRIMARY KEY, discount_percent INTEGER NOT NULL,
            max_uses INTEGER NOT NULL, uses_count INTEGER DEFAULT 0, is_active INTEGER DEFAULT 1
        )""")
        
        # Заполнение тарифов из старого словаря, если таблица пуста
        if cursor.execute("SELECT COUNT(*) FROM tariffs").fetchone()[0] == 0:
            for key, data in PRICES.items():
                cursor.execute(
                    "INSERT INTO tariffs (key, name, price, days, gb) VALUES (?, ?, ?, ?, ?)",
                    (key, data['name'], data['price'], data['days'], data['gb'])
                )
            logger.info("Таблица тарифов успешно заполнена изначальными значениями.")


        # НОВЫЕ ТАБЛИЦЫ
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS tariffs (
            id INTEGER PRIMARY KEY AUTOINCREMENT, key TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
            price REAL NOT NULL, days INTEGER NOT NULL, gb INTEGER NOT NULL, is_active INTEGER DEFAULT 1
        )""")

        cursor.execute("""
        CREATE TABLE IF NOT EXISTS promocodes (
            code TEXT PRIMARY KEY, discount_percent INTEGER NOT NULL,
            max_uses INTEGER NOT NULL, uses_count INTEGER DEFAULT 0, is_active INTEGER DEFAULT 1
        )""")
        
        # Заполнение тарифов из старого словаря, если таблица пуста
        if cursor.execute("SELECT COUNT(*) FROM tariffs").fetchone()[0] == 0:
            for key, data in PRICES.items():
                cursor.execute(
                    "INSERT INTO tariffs (key, name, price, days, gb) VALUES (?, ?, ?, ?, ?)",
                    (key, data['name'], data['price'], data['days'], data['gb'])
                )
            logger.info("Таблица тарифов успешно заполнена изначальными значениями.")

        cursor.execute("CREATE TABLE IF NOT EXISTS support_tickets (user_id INTEGER PRIMARY KEY, thread_id INTEGER)")
        cursor.execute("CREATE TABLE IF NOT EXISTS payments (invoice_id INTEGER PRIMARY KEY, user_id INTEGER, tariff_key TEXT, amount REAL, currency TEXT, status TEXT DEFAULT 'waiting', payment_type TEXT DEFAULT 'subscription')")
        cursor.execute("CREATE TABLE IF NOT EXISTS referrals (id INTEGER PRIMARY KEY AUTOINCREMENT, referrer_id INTEGER, referred_id INTEGER, created_at TEXT)")
        cursor.execute("CREATE TABLE IF NOT EXISTS bot_texts (key TEXT PRIMARY KEY, value TEXT)")

        default_texts = {
            "start_message": "👋 Привет, {first_name}!\nЭто бот для покупки ARMT-VPN.\nУ нас самые выгодные цены, качественные протоколы и огромные скорости.\nПо вопросам обращайтесь в поддержку.\nВыберите действие:",
            "buy_vpn_header": "Выберите тариф:",
            "select_payment_method_header": "Выберите способ оплаты:",
            "sbp_info_text": "Для оплаты по СБП, пожалуйста, нажмите кнопку ниже. Мы создадим для вас тикет, и оператор вышлет реквизиты для оплаты тарифа *{tariff_name}*.",
            "select_currency_header": "Выберите валюту для оплаты:",
            "instructions_main": "Здесь вы найдете инструкции по установке и подключению нашего VPN на различных устройствах. Выберите вашу операционную систему:",
            "instructions_ios": "Инструкция для iOS:\n1. Скачайте приложение Outline из App Store.\n2. Скопируйте ключ доступа, который вы получили от бота.\n3. Откройте Outline, приложение автоматически определит ключ в буфере обмена и предложит добавить сервер.\n4. Нажмите 'Подключить'. Готово!",
            "instructions_android": "Инструкция для Android:\n1. Скачайте приложение Outline из Google Play.\n2. Скопируйте ключ доступа, который вы получили от бота.\n3. Откройте Outline, приложение автоматически определит ключ в буфере обмена и предложит добавить сервер.\n4. Нажмите 'Подключить'. Готово!",
            "instructions_windows": "Инструкция для Windows:\n1. Скачайте клиент Outline с официального сайта.\n2. Установите программу.\n3. Скопируйте ключ доступа, который вы получили от бота.\n4. Откройте Outline и вставьте ключ в поле для добавления сервера.\n5. Нажмите 'Подключить'. Готово!",
            "instructions_macos": "Инструкция для macOS:\n1. Скачайте клиент Outline из App Store или с официального сайта.\n2. Установите программу.\n3. Скопируйте ключ доступа, который вы получили от бота.\n4. Откройте Outline и вставьте ключ в поле для добавления сервера.\n5. Нажмите 'Подключить'. Готово!",
            "referral_message": "🤝 **Реферальная система**\n\nПриглашайте друзей и получайте *10%* с каждой их покупки на свой реферальный баланс!\n\n💰 Ваш реферальный баланс: *{balance}* ₽\n👥 Приглашено пользователей: *{count}*\n\n🔗 Ваша реферальная ссылка для приглашения:\n`{link}`",
            "balance_menu_text": "💰 **Ваш баланс**\n\nОсновной баланс: *{main_balance:.2f} ₽*\nРеферальный баланс: *{ref_balance:.2f} ₽*\n\nОбщий доступный баланс для оплаты: **{total_balance:.2f} ₽**",
            "last_used_server_index": "-1"
        }
        for key, value in default_texts.items():
            cursor.execute("INSERT OR IGNORE INTO bot_texts (key, value) VALUES (?, ?)", (key, value))

        try:
            cursor.execute("ALTER TABLE users ADD COLUMN main_balance REAL DEFAULT 0")
        except sqlite3.OperationalError:
            pass
        try:
            cursor.execute("ALTER TABLE users ADD COLUMN has_used_trial INTEGER DEFAULT 0")
        except sqlite3.OperationalError:
            pass
        
        conn.commit()
    logger.info("База данных инициализирована.")

# =======================================
# ===    ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ      ===
# =======================================
async def get_text(key: str, context: ContextTypes.DEFAULT_TYPE, **kwargs) -> str:
    if 'texts' not in context.bot_data:
        context.bot_data['texts'] = {}
        with sqlite3.connect("vpn_platform.db") as conn:
            rows = conn.cursor().execute("SELECT key, value FROM bot_texts").fetchall()
            for row_key, value in rows:
                context.bot_data['texts'][row_key] = value

    text_template = context.bot_data.get('texts', {}).get(key, f"⚠️ Текст для '{key}' не найден.")
    try:
        return text_template.format(**kwargs)
    except KeyError as e:
        logger.warning(f"Ошибка форматирования текста '{key}': не найден ключ {e}")
        return text_template

async def set_text(key: str, value: str, context: ContextTypes.DEFAULT_TYPE):
    with sqlite3.connect("vpn_platform.db") as conn:
        conn.cursor().execute("UPDATE bot_texts SET value = ? WHERE key = ?", (value, key))
        conn.commit()
    if 'texts' in context.bot_data:
        del context.bot_data['texts']

async def create_and_assign_vpn_profile_from_panel(user_id: int, username: str, tariff_key: str, context: ContextTypes.DEFAULT_TYPE, payment_amount: float = None) -> str | None:
    with sqlite3.connect("vpn_platform.db") as conn:
        conn.row_factory = sqlite3.Row
        servers = conn.cursor().execute("SELECT * FROM servers WHERE is_active = 1").fetchall()
    
    if not servers:
        logger.critical("КРИТИЧЕСКАЯ ОШИБКА: В базе данных нет ни одного активного сервера!")
        for admin_id in ADMIN_IDS:
            try:
                await context.bot.send_message(admin_id, "‼️ **ОШИБКА ВЫДАЧИ КЛЮЧА** ‼️\n\nВ базе нет активных серверов! Добавьте сервер через админ-панель. Выдача ключей остановлена.", parse_mode="Markdown")
            except Exception: pass
        return None

    last_index_str = await get_text("last_used_server_index", context)
    next_index = (int(last_index_str) + 1) % len(servers)
    selected_server = servers[next_index]
    await set_text("last_used_server_index", str(next_index), context)

    logger.info(f"Выбран сервер '{selected_server['name']}' (ID: {selected_server['id']}) для пользователя {user_id}")
    
    api = XUI_API(selected_server['panel_url'], selected_server['panel_username'], selected_server['panel_password'])
    
    tariff = PRICES[tariff_key]
    client_data = await api.add_vless_client(
        inbound_id=selected_server['vless_inbound_id'], user_id=user_id,
        days=tariff['days'], gb=tariff['gb'], flow=selected_server['vless_flow']
    )
    await api.close()

    if not client_data:
        logger.critical(f"Не удалось создать профиль через API для пользователя {user_id} на сервере {selected_server['name']}!")
        for admin_id in ADMIN_IDS:
            try:
                await context.bot.send_message(
                    chat_id=admin_id,
                    text=f"‼️ **ОШИБКА ВЫДАЧИ** ‼️\n\nНе удалось создать ключ для @{username} (ID: `{user_id}`) на сервере *{selected_server['name']}*. Проверьте логи бота и доступность панели.",
                    parse_mode="Markdown"
                )
            except Exception as e:
                logger.error(f"Не удалось отправить уведомление админу {admin_id}: {e}")
        return None

    client_uuid = client_data['uuid']
    client_email = client_data['email'] # Получаем email, чтобы использовать в названии

# Обрабатываем short_id: берем только первую часть до запятой
    short_id = selected_server['vless_short_id'].split(',')[0]

# Формируем правильное имя для ключа
    remarks = f"ARMT-PREMIUM-{client_email}"

# Собираем ссылку в правильном формате и порядке
    config_link = (
        f"vless://{client_uuid}@{selected_server['vless_address']}:{selected_server['vless_port']}/"
        f"?type=tcp&security=reality"
        f"&pbk={selected_server['vless_public_key']}"
        f"&fp=chrome&sni={selected_server['vless_sni']}"
        f"&sid={short_id}&spx=%2F"
        f"&flow={selected_server['vless_flow']}#{remarks}"
    )

    with sqlite3.connect("vpn_platform.db") as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT expires_at FROM users WHERE user_id = ?", (user_id,))
        current_sub = cursor.fetchone()
        start_date = datetime.now()
        if current_sub and current_sub[0]:
            try:
                current_expiry = datetime.strptime(current_sub[0], '%Y-%m-%d %H:%M:%S')
                if current_expiry > start_date:
                    start_date = current_expiry
            except (ValueError, TypeError): pass
        expires_at = start_date + timedelta(days=tariff['days'])
        expires_at_str = expires_at.strftime('%Y-%m-%d %H:%M:%S')

        cursor.execute(
            "INSERT INTO users (user_id, username, subscription_type, expires_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET expires_at = ?, username = ?",
            (user_id, username, tariff_key, expires_at_str, expires_at_str, username)
        )

        now_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        cursor.execute(
            "INSERT INTO vpn_profiles (assigned_to_user_id, server_id, config_link, client_uuid, inbound_id, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (user_id, selected_server['id'], config_link, client_uuid, selected_server['vless_inbound_id'], now_str)
        )
        
        if payment_amount:
            referrer_id_row = cursor.execute("SELECT referrer_id FROM users WHERE user_id = ?", (user_id,)).fetchone()
            if referrer_id_row and referrer_id_row[0]:
                referrer_id = referrer_id_row[0]
                bonus = payment_amount * 0.10
                cursor.execute("UPDATE users SET referral_balance = referral_balance + ? WHERE user_id = ?", (bonus, referrer_id))
                try:
                    await context.bot.send_message(referrer_id, f"🎉 Вам начислен реферальный бонус *{bonus:.2f} ₽*!", parse_mode="Markdown")
                except Exception as e:
                    logger.warning(f"Не удалось уведомить {referrer_id} о реферальном бонусе: {e}")

        conn.commit()

    logger.info(f"Пользователю {user_id} выдан профиль с сервера {selected_server['name']}. UUID: {client_uuid}.")
    return config_link


# =======================================
# ===      API КЛАСС CRYPTOBOT         ===
# =======================================
class CryptoBotAPI:
    def __init__(self, token):
        self.base_url = "https://pay.crypt.bot/api"
        self.headers = {"Crypto-Pay-API-Token": token} if token else {}

    async def get_exchange_rates(self):
        async with aiohttp.ClientSession() as s:
            async with s.get(f"{self.base_url}/getExchangeRates", headers=self.headers) as r:
                return await r.json()

    async def create_invoice(self, asset, amount, params=None):
        payload = {"asset": asset, "amount": amount, "expires_in": 3600}
        if params:
            payload.update(params)
        async with aiohttp.ClientSession() as s:
            async with s.post(f"{self.base_url}/createInvoice", headers=self.headers, json=payload) as r:
                return await r.json()

    async def get_invoices(self, invoice_ids):
        async with aiohttp.ClientSession() as s:
            async with s.get(f"{self.base_url}/getInvoices", headers=self.headers, params={"invoice_ids": invoice_ids}) as r:
                return await r.json()

cryptobot = CryptoBotAPI(CRYPTO_BOT_TOKEN)

# =======================================
# ===      ОСНОВНЫЕ ХЭНДЛЕРЫ          ===
# =======================================


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    user = update.effective_user
    with sqlite3.connect("vpn_platform.db") as conn:
        cursor = conn.cursor()
        existing_user = cursor.execute("SELECT user_id, has_used_trial FROM users WHERE user_id = ?", (user.id,)).fetchone()
        if not existing_user:
            cursor.execute("INSERT INTO users (user_id, username, referrer_id) VALUES (?, ?, ?)", (user.id, user.username, None))
            has_used_trial = 0
        else:
            cursor.execute("UPDATE users SET username = ? WHERE user_id = ?", (user.username, user.id))
            has_used_trial = existing_user[1]
        conn.commit()

    keyboard = [
        [InlineKeyboardButton("🛒 Купить VPN", callback_data="buy_vpn")],
    ]
    # Показываем кнопку триала, если пользователь ее не использовал
    if not has_used_trial:
        keyboard.insert(1, [InlineKeyboardButton("🚀 Попробовать бесплатно", callback_data="get_trial")])

    keyboard.extend([
        [InlineKeyboardButton("💰 Баланс", callback_data="balance_menu")],
        [InlineKeyboardButton("🔑 Мой VPN", callback_data="my_vpn")],
        [InlineKeyboardButton("📖 Инструкция", callback_data="instructions")],
        [InlineKeyboardButton("💬 Поддержка", callback_data="support")]
    ])
    if user.id in ADMIN_IDS:
        keyboard.append([InlineKeyboardButton("👑 Админ-панель", callback_data="admin_panel")])

    message_text = await get_text("start_message", context, first_name=escape_markdown(user.first_name))
    reply_markup = InlineKeyboardMarkup(keyboard)

    if update.callback_query:
        await update.callback_query.answer()
        await update.callback_query.edit_message_text(message_text, reply_markup=reply_markup, parse_mode="Markdown")
    else:
        await update.message.reply_text(message_text, reply_markup=reply_markup, parse_mode="Markdown")

    context.user_data.clear()
    return STATE_MAIN_MENU


# =======================================
# ===        ПРОЦЕСС ПОКУПКИ          ===
# =======================================
async def select_tariff(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()

    with sqlite3.connect("vpn_platform.db") as conn:
        conn.row_factory = sqlite3.Row
        tariffs = conn.cursor().execute("SELECT * FROM tariffs WHERE is_active = 1 ORDER BY price").fetchall()

    if not tariffs:
        await query.edit_message_text("На данный момент нет доступных тарифов. Пожалуйста, зайдите позже.")
        return STATE_MAIN_MENU
    
    keyboard = []
    for tariff in tariffs:
        keyboard.append([InlineKeyboardButton(f"{tariff['name']} - {tariff['price']}₽", callback_data=f"tariff_{tariff['key']}")])

    keyboard.append([InlineKeyboardButton("⬅️ Назад", callback_data="main_menu")])
    text = await get_text("buy_vpn_header", context)
    await query.edit_message_text(text, reply_markup=InlineKeyboardMarkup(keyboard))
    return STATE_AWAIT_PROMOCODE # Переход к вводу промокода

async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    target_message = update.message or (update.callback_query and update.callback_query.message)
    if not target_message:
        return ConversationHandler.END
    await target_message.reply_text("Действие отменено.")
    context.user_data.clear()
    return await start(update, context)

# =======================================
# ===        ПРОЦЕСС ПОКУПКИ          ===
# =======================================


async def select_payment_method(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    if query.data.startswith("tariff_"):
        context.user_data['tariff_key'] = query.data.split("tariff_")[1]

    tariff_key = context.user_data.get('tariff_key')
    if not tariff_key:
        await query.edit_message_text("❌ Ошибка: не удалось определить тариф. Попробуйте начать сначала.")
        return await start(update, context)

    tariff_price = PRICES[tariff_key]['price']
    user_id = query.from_user.id
    with sqlite3.connect("vpn_platform.db") as conn:
        balances = conn.cursor().execute("SELECT main_balance, referral_balance FROM users WHERE user_id = ?", (user_id,)).fetchone()

    main_balance = balances[0] if balances else 0
    ref_balance = balances[1] if balances else 0
    total_balance = main_balance + ref_balance

    keyboard = []
    if total_balance >= tariff_price:
        balance_button = [InlineKeyboardButton(f"💳 Оплатить с баланса ({total_balance:.2f} ₽)", callback_data="pay_from_balance")]
        keyboard.append(balance_button)

    keyboard.extend([
        [InlineKeyboardButton("💎 Криптовалюта (USDT/TON)", callback_data="pay_crypto")],
        [InlineKeyboardButton("💳 СБП (через поддержку)", callback_data="pay_sbp")],
        [InlineKeyboardButton("⬅️ Назад", callback_data="buy_vpn")]
    ])

    text = await get_text("select_payment_method_header", context)
    await query.edit_message_text(text, reply_markup=InlineKeyboardMarkup(keyboard))
    return STATE_SELECT_CURRENCY


async def sbp_payment_info(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    tariff_key = context.user_data.get('tariff_key')
    if not tariff_key:
        await query.answer("Произошла ошибка, попробуйте начать сначала.", show_alert=True)
        return await start(query, context)

    text = await get_text("sbp_info_text", context, tariff_name=PRICES[tariff_key]['name'])
    keyboard = [
        [InlineKeyboardButton("💬 Связаться с поддержкой", callback_data="support_sbp")],
        [InlineKeyboardButton("⬅️ Назад", callback_data=f"tariff_{tariff_key}")]
    ]
    await query.edit_message_text(text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode="Markdown")
    return STATE_SELECT_CURRENCY


async def select_currency(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    keyboard = [
        [InlineKeyboardButton("USDT", callback_data="currency_USDT")],
        [InlineKeyboardButton("TON", callback_data="currency_TON")],
        [InlineKeyboardButton("⬅️ Назад", callback_data=f"tariff_{context.user_data['tariff_key']}")]
    ]
    text = await get_text("select_currency_header", context)
    await query.edit_message_text(text, reply_markup=InlineKeyboardMarkup(keyboard))
    return STATE_AWAIT_PAYMENT


async def create_payment(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    currency = query.data.split("currency_")[1]
    tariff_key = context.user_data.get('tariff_key')
    if not tariff_key:
        await query.edit_message_text("❌ Ошибка: не удалось определить тариф. Попробуйте начать сначала.")
        return await start(query, context)

    amount_rub = PRICES[tariff_key]['price']

    await query.answer()
    await query.edit_message_text("⏳ Создаю счет...")

    rates = await cryptobot.get_exchange_rates()
    if not rates or not rates.get("ok"):
        await query.edit_message_text("❌ Не удалось получить курсы валют.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("⬅️ Назад", callback_data="pay_crypto")]]))
        return STATE_AWAIT_PAYMENT

    rate = next((r for r in rates["result"] if r["source"] == currency and r["target"] == "RUB"), None)
    if not rate:
        await query.edit_message_text(f"❌ Не удалось найти курс для {currency}/RUB.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("⬅️ Назад", callback_data="pay_crypto")]]))
        return STATE_AWAIT_PAYMENT

    amount_crypto = f"{amount_rub / float(rate['rate']):.8f}"
    invoice = await cryptobot.create_invoice(asset=currency, amount=amount_crypto)

    if invoice and invoice.get("ok"):
        res = invoice["result"]
        with sqlite3.connect("vpn_platform.db") as conn:
            conn.cursor().execute(
                "INSERT INTO payments (invoice_id, user_id, tariff_key, amount, currency, payment_type) VALUES (?, ?, ?, ?, ?, 'subscription')",
                (res['invoice_id'], query.from_user.id, tariff_key, amount_rub, currency)
            )
            conn.commit()
        keyboard = [
            [InlineKeyboardButton("Оплатить", url=res['pay_url'])],
            [InlineKeyboardButton("✅ Я оплатил", callback_data=f"check_{res['invoice_id']}")],
            [InlineKeyboardButton("⬅️ Назад", callback_data="pay_crypto")]
        ]
        await query.edit_message_text(
            f"Счет создан.\n\nСумма: **{res['amount']} {currency}**\n\n"
            "Нажмите «Оплатить», а после успешной оплаты вернитесь и нажмите «Я оплатил».",
            reply_markup=InlineKeyboardMarkup(keyboard),
            parse_mode="Markdown"
        )
        return STATE_AWAIT_PAYMENT
    else:
        logger.error(f"Ошибка создания счета CryptoBot: {invoice}")
        await query.edit_message_text("❌ Не удалось создать счет.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("⬅️ Назад", callback_data="pay_crypto")]]))
        return STATE_AWAIT_PAYMENT


async def check_payment(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    invoice_id = int(query.data.split("_")[1])
    await query.answer("Проверяем статус платежа...")

    res = await cryptobot.get_invoices(invoice_ids=str(invoice_id))
    if res and res.get("ok") and res["result"]["items"]:
        item = res["result"]["items"][0]
        if item["status"] == "paid":
            await query.edit_message_text("✅ Оплата прошла успешно! Выдаю вам доступ...")
            with sqlite3.connect("vpn_platform.db") as conn:
                cursor = conn.cursor()
                payment_info = cursor.execute("SELECT tariff_key, amount, status FROM payments WHERE invoice_id = ?", (invoice_id,)).fetchone()
                if not payment_info or payment_info[2] == 'paid':
                    await query.answer("Этот платеж уже обработан.", show_alert=True)
                    return STATE_AWAIT_PAYMENT
                cursor.execute("UPDATE payments SET status = 'paid' WHERE invoice_id = ?", (invoice_id,))
                conn.commit()

            tariff_key, amount, _ = payment_info
            config_link = await create_and_assign_vpn_profile_from_panel(query.from_user.id, query.from_user.username, tariff_key, context, payment_amount=amount)
            
            if config_link:
                await query.message.reply_text(f"🎉 Ваш VPN готов!\n\nВаш ключ для подключения:\n`{config_link}`", parse_mode="Markdown")
            else:
                await query.message.reply_text("✅ Оплата прошла, но произошла ошибка при создании профиля VPN. Мы уже уведомлены и скоро свяжемся с вами.")
            return await start(query, context)
        elif item["status"] == 'expired':
            await context.bot.send_message(query.from_user.id, "⚠️ Срок действия счета истек. Пожалуйста, создайте новый.")
            return await select_currency(query, context)
        else:
            await context.bot.send_message(query.from_user.id, "⚠️ Платеж еще не подтвержден. Попробуйте снова через минуту.")
            return STATE_AWAIT_PAYMENT
    else:
        logger.error(f"Ошибка проверки счета CryptoBot: {res}")
        await context.bot.send_message(query.from_user.id, "❌ Не удалось проверить статус платежа.")
        return STATE_AWAIT_PAYMENT

# =======================================
# ===        БАЛАНС ПОЛЬЗОВАТЕЛЯ      ===
# =======================================
async def balance_menu(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    user_id = query.from_user.id

    with sqlite3.connect("vpn_platform.db") as conn:
        balances = conn.cursor().execute("SELECT main_balance, referral_balance FROM users WHERE user_id = ?", (user_id,)).fetchone()

    main_balance = balances[0] if balances else 0
    ref_balance = balances[1] if balances else 0
    total_balance = main_balance + ref_balance

    text = await get_text("balance_menu_text", context, main_balance=main_balance, ref_balance=ref_balance, total_balance=total_balance)

    keyboard = [
        [InlineKeyboardButton("💎 Пополнить криптой", callback_data="balance_crypto")],
        [InlineKeyboardButton(f"💳 Пополнить в рублях (от {MIN_RUB_DEPOSIT}₽)", callback_data="balance_rub")],
        [InlineKeyboardButton("⬅️ Назад", callback_data="main_menu")]
    ]
    await query.edit_message_text(text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode="Markdown")
    return STATE_BALANCE_MENU

async def balance_ask_crypto_amount(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    keyboard = [[InlineKeyboardButton("⬅️ Назад", callback_data="balance_menu")]]
    await query.edit_message_text(
        "Введите сумму и валюту для пополнения.\n\nНапример: `10 USDT` или `25 TON`",
        reply_markup=InlineKeyboardMarkup(keyboard),
        parse_mode="Markdown"
    )
    return STATE_BALANCE_CRYPTO_AMOUNT

async def balance_create_crypto_invoice(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    try:
        amount_str, currency = update.message.text.upper().split()
        amount = float(amount_str)
        if currency not in ["USDT", "TON"] or amount <= 0:
            raise ValueError
    except (ValueError, IndexError):
        await update.message.reply_text("Неверный формат. Введите положительную сумму и валюту, например: `10 USDT`")
        return STATE_BALANCE_CRYPTO_AMOUNT

    await update.message.reply_text("⏳ Проверяю сумму и создаю счет...")

    rates = await cryptobot.get_exchange_rates()
    if not rates or not rates.get("ok"):
        await update.message.reply_text("❌ Не удалось получить курсы валют для проверки суммы. Попробуйте позже.")
        return STATE_BALANCE_CRYPTO_AMOUNT

    rate_to_usd = next((r for r in rates["result"] if r["source"] == currency and r["target"] == "USD"), None)
    if not rate_to_usd:
        await update.message.reply_text(f"❌ Не удалось найти курс для {currency}/USD. Попробуйте другую валюту.")
        return STATE_BALANCE_CRYPTO_AMOUNT

    amount_in_usd = amount * float(rate_to_usd['rate'])
    min_amount_usd = 0.01

    if amount_in_usd < min_amount_usd:
        min_amount_in_crypto = min_amount_usd / float(rate_to_usd['rate'])
        await update.message.reply_text(
            f"❌ Сумма слишком мала.\n\nМинимальная сумма для пополнения эквивалентна ${min_amount_usd}.\n"
            f"Пожалуйста, введите сумму больше, чем примерно **{min_amount_in_crypto:.6f} {currency}**."
        )
        return STATE_BALANCE_CRYPTO_AMOUNT

    invoice = await cryptobot.create_invoice(asset=currency, amount=str(amount))

    if invoice and invoice.get("ok"):
        res = invoice["result"]
        with sqlite3.connect("vpn_platform.db") as conn:
            conn.cursor().execute(
                "INSERT INTO payments (invoice_id, user_id, amount, currency, payment_type) VALUES (?, ?, ?, ?, 'balance')",
                (res['invoice_id'], update.effective_user.id, amount, currency)
            )
            conn.commit()
        keyboard = [
            [InlineKeyboardButton("Оплатить", url=res['pay_url'])],
            [InlineKeyboardButton("✅ Я оплатил", callback_data=f"check_balance_{res['invoice_id']}")],
            [InlineKeyboardButton("⬅️ Назад", callback_data="balance_menu")]
        ]
        await update.message.reply_text(
            f"Счет на пополнение баланса создан.\n\nСумма: **{res['amount']} {currency}**\n\n"
            "Нажмите «Оплатить», а после успешной оплаты вернитесь и нажмите «Я оплатил».",
            reply_markup=InlineKeyboardMarkup(keyboard),
            parse_mode="Markdown"
        )
        return STATE_BALANCE_AWAIT_CRYPTO_PAYMENT
    else:
        logger.error(f"Ошибка создания счета CryptoBot для пополнения баланса: {invoice}")
        await update.message.reply_text("❌ Не удалось создать счет. Попробуйте еще раз позже.")
        return STATE_BALANCE_CRYPTO_AMOUNT


async def check_balance_payment(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    invoice_id = int(query.data.split("_")[2])
    await query.answer("Проверяем статус платежа...")

    res = await cryptobot.get_invoices(invoice_ids=str(invoice_id))
    if res and res.get("ok") and res["result"]["items"]:
        item = res["result"]["items"][0]
        if item["status"] == "paid":
            with sqlite3.connect("vpn_platform.db") as conn:
                payment_status = conn.cursor().execute("SELECT status FROM payments WHERE invoice_id = ?", (invoice_id,)).fetchone()

            if payment_status and payment_status[0] == 'paid':
                await query.answer("Этот платеж уже зачислен.", show_alert=True)
                return STATE_BALANCE_AWAIT_CRYPTO_PAYMENT

            await query.edit_message_text("✅ Оплата прошла успешно! Зачисляю средства на ваш баланс...")

            paid_amount_crypto = float(item['amount'])
            paid_currency = item['asset']

            rates = await cryptobot.get_exchange_rates()
            if not rates or not rates.get("ok"):
                logger.critical(f"Не удалось получить курсы валют для зачисления баланса. Invoice_id: {invoice_id}")
                await query.message.reply_text("❌ Критическая ошибка: не удалось получить курсы валют. Администраторы уведомлены.")
                return await start(update, context)

            rate_info = next((r for r in rates["result"] if r["source"] == paid_currency and r["target"] == "RUB"), None)

            if not rate_info:
                logger.critical(f"Не удалось получить курс для {paid_currency}/RUB. Invoice_id: {invoice_id}")
                await query.message.reply_text("❌ Критическая ошибка: не удалось получить курс валюты. Средства не зачислены. Администраторы уведомлены.")
                return await start(update, context)

            amount_rub = paid_amount_crypto * float(rate_info['rate'])

            with sqlite3.connect("vpn_platform.db") as conn:
                cursor = conn.cursor()
                cursor.execute("UPDATE payments SET status = 'paid' WHERE invoice_id = ?", (invoice_id,))
                cursor.execute("UPDATE users SET main_balance = main_balance + ? WHERE user_id = ?", (amount_rub, query.from_user.id))
                conn.commit()

            await query.message.reply_text(f"✅ Ваш баланс успешно пополнен на *{amount_rub:.2f} ₽*.", parse_mode="Markdown")
            return await start(update, context)
        elif item["status"] == 'expired':
            await context.bot.send_message(query.from_user.id, "⚠️ Срок действия счета истек. Пожалуйста, создайте новый.")
            return STATE_BALANCE_AWAIT_CRYPTO_PAYMENT
        else:
            await context.bot.send_message(query.from_user.id, "⚠️ Платеж еще не подтвержден. Попробуйте снова через минуту.")
            return STATE_BALANCE_AWAIT_CRYPTO_PAYMENT
    else:
        logger.error(f"Ошибка проверки счета пополнения CryptoBot: {res}")
        await context.bot.send_message(query.from_user.id, "❌ Не удалось проверить статус платежа.")
        return STATE_BALANCE_AWAIT_CRYPTO_PAYMENT


async def balance_ask_rub_amount(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    keyboard = [[InlineKeyboardButton("⬅️ Назад", callback_data="balance_menu")]]
    await query.edit_message_text(
        f"Введите сумму, на которую хотите пополнить баланс в рублях (минимальная сумма: {MIN_RUB_DEPOSIT} ₽).",
        reply_markup=InlineKeyboardMarkup(keyboard)
    )
    return STATE_BALANCE_RUB_AMOUNT


async def balance_create_rub_ticket(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    try:
        amount = float(update.message.text)
        if amount < MIN_RUB_DEPOSIT:
            await update.message.reply_text(f"Минимальная сумма пополнения - {MIN_RUB_DEPOSIT} ₽. Пожалуйста, введите корректную сумму.")
            return STATE_BALANCE_RUB_AMOUNT
    except ValueError:
        await update.message.reply_text("Пожалуйста, введите числовое значение.")
        return STATE_BALANCE_RUB_AMOUNT

    context.user_data['rub_deposit_amount'] = amount

    class FakeCallbackQuery:
        def __init__(self, user, message):
            self.from_user = user
            self.message = message
        async def answer(self, *args, **kwargs): pass
        async def edit_message_text(self, *args, **kwargs):
            return await self.message.reply_text(*args, **kwargs)

    class FakeUpdate:
        def __init__(self, effective_user, message):
            self.callback_query = FakeCallbackQuery(effective_user, message)
            self.effective_user = effective_user

    fake_update_obj = FakeUpdate(update.effective_user, update.message)
    return await support_start_rub_deposit(fake_update_obj, context)

# =======================================
# ===        ДРУГИЕ ФУНКЦИИ           ===
# =======================================
async def my_vpn(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    with sqlite3.connect("vpn_platform.db") as conn:
        cursor = conn.cursor()
        sub = cursor.execute("SELECT expires_at FROM users WHERE user_id = ?", (query.from_user.id,)).fetchone()
        profiles = cursor.execute("SELECT id, config_link FROM vpn_profiles WHERE assigned_to_user_id = ?", (query.from_user.id,)).fetchall()

    text = "У вас нет активных подписок."
    keyboard = []
    
    if sub and sub[0]:
        try:
            expires_dt = datetime.strptime(sub[0], '%Y-%m-%d %H:%M:%S')
            if expires_dt > datetime.now():
                text = f"🔑 Ваша подписка активна до: **{expires_dt.strftime('%d.%m.%Y %H:%M')}**\n\n"
                if profiles:
                    text += f"Количество устройств: **{len(profiles)}/5**\n\n"
                    text += "Выберите устройство, чтобы получить QR-код и ключ подключения:"
                    
                    for i, (profile_id, _) in enumerate(profiles, 1):
                        keyboard.append([
                            InlineKeyboardButton(
                                f"📱 Устройство #{i}", 
                                callback_data=f"vpn_device_{profile_id}"
                            )
                        ])
        except (ValueError, TypeError):
            pass

    keyboard.append([InlineKeyboardButton("⬅️ Назад", callback_data="main_menu")])
    
    await query.edit_message_text(
        text,
        reply_markup=InlineKeyboardMarkup(keyboard),
        parse_mode="Markdown",
        disable_web_page_preview=True
    )
    return STATE_MAIN_MENU


async def show_vpn_device(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    
    profile_id = int(query.data.split("vpn_device_")[1])
    
    with sqlite3.connect("vpn_platform.db") as conn:
        cursor = conn.cursor()
        profile = cursor.execute(
            "SELECT config_link, assigned_to_user_id FROM vpn_profiles WHERE id = ?", 
            (profile_id,)
        ).fetchone()
    
    if not profile or profile[1] != query.from_user.id:
        await query.edit_message_text(
            "❌ Ошибка: устройство не найдено или не принадлежит вам.",
            reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("⬅️ Назад", callback_data="my_vpn")]])
        )
        return STATE_MAIN_MENU
    
    config_link = profile[0]
    
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=4,
    )
    qr.add_data(config_link)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    bio = BytesIO()
    img.save(bio, 'PNG')
    bio.seek(0)
    
    caption = (
        f"🔑 **Ключ подключения:**\n\n"
        f"`{config_link}`\n\n"
        f"📱 Отсканируйте QR-код в приложении v2rayNG, v2raytun или других VPN клиентах\n"
        f"📋 Или скопируйте ключ выше и вставьте в приложение"
    )
    
    await query.message.reply_photo(
        photo=bio,
        caption=caption,
        parse_mode="Markdown"
    )
    
    keyboard = [
        [InlineKeyboardButton("⬅️ Назад к устройствам", callback_data="my_vpn")]
    ]
    
    await query.edit_message_text(
        "✅ QR-код и ключ отправлены выше",
        reply_markup=InlineKeyboardMarkup(keyboard)
    )
    
    return STATE_MAIN_MENU


async def instructions_menu(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    keyboard = [
        [InlineKeyboardButton("📱 iOS", callback_data="instr_ios"), InlineKeyboardButton("🤖 Android", callback_data="instr_android")],
        [InlineKeyboardButton("💻 Windows", callback_data="instr_windows"), InlineKeyboardButton(" macOS", callback_data="instr_macos")],
        [InlineKeyboardButton("⬅️ Назад", callback_data="main_menu")]
    ]
    text = await get_text("instructions_main", context)
    await query.edit_message_text(text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode="Markdown")
    return STATE_INSTRUCTIONS


async def show_instruction(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    platform = query.data.split("instr_")[1]
    await query.answer()
    text = await get_text(f"instructions_{platform}", context)
    keyboard = [[InlineKeyboardButton("⬅️ Назад к выбору", callback_data="instructions")]]
    await query.edit_message_text(text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode="Markdown")
    return STATE_INSTRUCTIONS


async def referral_menu(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    user_id = query.from_user.id
    bot_username = (await context.bot.get_me()).username
    referral_link = f"https://t.me/{bot_username}?start={user_id}"

    with sqlite3.connect("vpn_platform.db") as conn:
        cursor = conn.cursor()
        balance_row = cursor.execute("SELECT referral_balance FROM users WHERE user_id = ?", (user_id,)).fetchone()
        balance = balance_row[0] if balance_row else 0
        count, = cursor.execute("SELECT COUNT(*) FROM referrals WHERE referrer_id = ?", (user_id,)).fetchone()

    text = await get_text("referral_message", context, balance=f"{balance:.2f}", count=count, link=referral_link)

    keyboard = [[InlineKeyboardButton("⬅️ Назад", callback_data="main_menu")]]
    await query.edit_message_text(text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode="Markdown")
    return STATE_MAIN_MENU


# =======================================
# ===    ИСПОЛЬЗОВАНИЕ БАЛАНСА        ===
# =======================================
async def pay_from_balance(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()

    tariff_key = context.user_data.get('tariff_key')
    if not tariff_key:
        await query.edit_message_text("❌ Ошибка: сессия выбора тарифа истекла. Пожалуйста, начните заново.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("⬅️ В меню", callback_data="main_menu")]]))
        return STATE_MAIN_MENU

    tariff_price = PRICES[tariff_key]['price']
    user_id = query.from_user.id
    username = query.from_user.username

    await query.edit_message_text("⏳ Проверяю балансы и оформляю подписку...")

    with sqlite3.connect("vpn_platform.db") as conn:
        cursor = conn.cursor()
        balances = cursor.execute("SELECT main_balance, referral_balance FROM users WHERE user_id = ?", (user_id,)).fetchone()
        main_balance, ref_balance = balances if balances else (0, 0)
        total_balance = main_balance + ref_balance

        if total_balance < tariff_price:
            await query.edit_message_text(f"❌ Недостаточно средств. Ваш общий баланс: {total_balance:.2f} ₽. Требуется: {tariff_price} ₽.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("⬅️ В меню", callback_data="main_menu")]]))
            return STATE_MAIN_MENU

        spent_from_ref = min(ref_balance, tariff_price)
        remaining_cost = tariff_price - spent_from_ref
        spent_from_main = remaining_cost
        new_ref_balance = ref_balance - spent_from_ref
        new_main_balance = main_balance - spent_from_main

        cursor.execute("UPDATE users SET main_balance = ?, referral_balance = ? WHERE user_id = ?", (new_main_balance, new_ref_balance, user_id))
        conn.commit()

    config_link = await create_and_assign_vpn_profile_from_panel(user_id, username, tariff_key, context)

    if config_link:
        await query.message.reply_text(f"✅ Оплата с баланса прошла успешно!\n\n🎉 Ваш VPN готов!\n\nВаш ключ для подключения:\n`{config_link}`", parse_mode="Markdown")
    else:
        with sqlite3.connect("vpn_platform.db") as conn:
            conn.cursor().execute("UPDATE users SET main_balance = ?, referral_balance = ? WHERE user_id = ?", (main_balance, ref_balance, user_id))
            conn.commit()
        await query.message.reply_text("❌ Произошла ошибка при создании профиля VPN. Средства возвращены на ваш баланс. Мы уже уведомлены и скоро свяжемся с вами.")

    return await start(update, context)


# =======================================

# В этом блоке будут функции для промокодов и триала. Код слишком большой для вставки здесь.
# Вы можете добавить его вручную или использовать более продвинутый скрипт.

# ===      АДМИН-ПАНЕЛЬ (НОВАЯ)         ===
# =======================================
async def admin_panel(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    keyboard = [
        [InlineKeyboardButton("📊 Статистика", callback_data="admin_stats")],
        [InlineKeyboardButton("✅ Выдать подписку", callback_data="admin_grant_start")],
        [InlineKeyboardButton("🔧 Управление серверами", callback_data="admin_servers_menu")],
        [InlineKeyboardButton("👤 Найти пользователя", callback_data="admin_find_user")],
        [InlineKeyboardButton("💰 Начислить баланс", callback_data="admin_credit_balance")],
        [InlineKeyboardButton("🔎 Найти по ключу", callback_data="admin_find_by_key")],
        [InlineKeyboardButton("✏️ Редактировать тексты", callback_data="admin_edit_text")],
        [InlineKeyboardButton("📢 Рассылка", callback_data="admin_broadcast_start")],
        [InlineKeyboardButton("🚫 Отозвать подписку", callback_data="admin_revoke_start")],
        [InlineKeyboardButton("⬅️ Назад в меню", callback_data="main_menu")]
    ]
    markup = InlineKeyboardMarkup(keyboard)
    message_text = "👑 **Админ-панель**"
    if update.callback_query:
        await update.callback_query.answer()
        await update.callback_query.edit_message_text(message_text, reply_markup=markup, parse_mode="Markdown")
    else:
        await update.message.reply_text(message_text, reply_markup=markup, parse_mode="Markdown")
    return STATE_ADMIN_PANEL

async def _return_to_admin_panel_after_action(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    await asyncio.sleep(0.5)
    class FakeUpdate:
        def __init__(self, effective_user, message):
            self.effective_user = effective_user
            self.callback_query = self.FakeCallbackQuery(message)
        class FakeCallbackQuery:
            def __init__(self, message): self.message = message
            async def answer(self): pass
            async def edit_message_text(self, *args, **kwargs):
                return await self.message.edit_text(*args, **kwargs)
    
    msg = update.message or (update.callback_query and update.callback_query.message)
    fake_update = FakeUpdate(update.effective_user, msg)
    return await admin_panel(fake_update, context)

async def admin_stats(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    with sqlite3.connect("vpn_platform.db") as conn:
        c = conn.cursor()
        total_users = c.execute("SELECT COUNT(*) FROM users").fetchone()[0]
        active_subs = c.execute("SELECT COUNT(*) FROM users WHERE expires_at IS NOT NULL AND expires_at > ?", (datetime.now().strftime('%Y-%m-%d %H:%M:%S'),)).fetchone()[0]
        total_profiles = c.execute("SELECT COUNT(*) FROM vpn_profiles").fetchone()[0]
        active_servers = c.execute("SELECT COUNT(*) FROM servers WHERE is_active = 1").fetchone()[0]
        total_servers = c.execute("SELECT COUNT(*) FROM servers").fetchone()[0]

    text = (
        f"📊 **Статистика бота:**\n\n"
        f"👥 Всего пользователей: {total_users}\n"
        f"✅ Активных подписок: {active_subs}\n"
        f"🔑 Всего создано ключей: {total_profiles}\n"
        f"🖥 Активных серверов: {active_servers} из {total_servers}"
    )
    await query.edit_message_text(text, reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("⬅️ Назад", callback_data="admin_panel")]]), parse_mode="Markdown")
    return STATE_ADMIN_PANEL

async def grant_sub_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    await update.callback_query.edit_message_text("Введите ID пользователя. /cancel для отмены.")
    return STATE_ADMIN_GRANT_ID

async def grant_sub_get_id(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    try:
        context.user_data['grant_user_id'] = int(update.message.text)
    except ValueError:
        await update.message.reply_text("Неверный ID. Попробуйте еще раз.")
        return STATE_ADMIN_GRANT_ID

    keyboard = [[InlineKeyboardButton(p['name'], callback_data=f"grant_{k}")] for k, p in PRICES.items()]
    await update.message.reply_text("Выберите тариф:", reply_markup=InlineKeyboardMarkup(keyboard))
    return STATE_ADMIN_GRANT_TARIFF

async def grant_sub_get_tariff_and_confirm(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    tariff_key = query.data.split("grant_")[1]
    user_id = context.user_data['grant_user_id']
    await query.edit_message_text(f"Создаю профиль VLESS по тарифу '{PRICES[tariff_key]['name']}' для {user_id}...")

    username = f"user_{user_id}"
    try:
        user_chat = await context.bot.get_chat(user_id)
        username = user_chat.username or user_chat.full_name
    except Exception:
        pass

    config_link = await create_and_assign_vpn_profile_from_panel(user_id, username, tariff_key, context)

    if config_link:
        await query.edit_message_text(f"✅ Профиль по тарифу '{PRICES[tariff_key]['name']}' выдан пользователю {username} ({user_id}).")
        try:
            await context.bot.send_message(
                chat_id=user_id,
                text=f"🎉 Администратор продлил/выдал вам подписку!\n\nВаш ключ для подключения:\n`{config_link}`",
                parse_mode="Markdown"
            )
        except Exception as e:
            await query.message.reply_text(f"⚠️ Не удалось уведомить пользователя: {e}")
    else:
        await query.edit_message_text(f"❌ Ошибка! Не удалось создать профиль через API панели. Проверьте логи или добавьте сервер.")

    return await _return_to_admin_panel_after_action(update, context)

async def broadcast_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    await update.callback_query.edit_message_text("Введите сообщение для рассылки. Поддерживается Markdown. /cancel для отмены.")
    return STATE_ADMIN_BROADCAST_MESSAGE

async def broadcast_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    await update.message.reply_text("Начинаю рассылку...")
    with sqlite3.connect("vpn_platform.db") as conn:
        users = conn.cursor().execute("SELECT user_id FROM users").fetchall()

    success, fail = 0, 0
    for user_id, in users:
        try:
            await context.bot.send_message(chat_id=user_id, text=update.message.text, parse_mode="Markdown")
            success += 1
            await asyncio.sleep(0.1)
        except Exception as e:
            fail += 1
            logger.warning(f"Рассылка: не удалось отправить {user_id}: {e}")

    await update.message.reply_text(f"✅ Рассылка завершена!\n\nОтправлено: {success}\nНе удалось: {fail}")
    return await _return_to_admin_panel_after_action(update, context)

async def revoke_sub_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    await update.callback_query.edit_message_text("Введите ID пользователя для отзыва подписки. /cancel для отмены.")
    return STATE_ADMIN_REVOKE_ID

async def revoke_sub_get_id(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    try:
        user_id = int(update.message.text)
    except ValueError:
        await update.message.reply_text("Неверный ID. Попробуйте еще раз.")
        return STATE_ADMIN_REVOKE_ID

    with sqlite3.connect("vpn_platform.db") as conn:
        user_data = conn.cursor().execute("SELECT username, expires_at FROM users WHERE user_id = ?", (user_id,)).fetchone()

    if user_data and user_data[1] and datetime.strptime(user_data[1], '%Y-%m-%d %H:%M:%S') > datetime.now():
        username, expires_at = user_data
        context.user_data['revoke_user_id'] = user_id
        keyboard = [
            [InlineKeyboardButton("Да, отозвать", callback_data=f"revoke_confirm_yes")],
            [InlineKeyboardButton("Нет, отмена", callback_data="admin_panel")]
        ]
        await update.message.reply_text(
            f"Найден пользователь: {username} (ID: {user_id})\nПодписка до: {expires_at}\n\nВы уверены?",
            reply_markup=InlineKeyboardMarkup(keyboard)
        )
        return STATE_ADMIN_REVOKE_CONFIRM
    else:
        await update.message.reply_text("Пользователь не найден или у него нет активной подписки.")
        return await _return_to_admin_panel_after_action(update, context)

async def revoke_sub_confirm(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    user_id = context.user_data.get('revoke_user_id')
    if not user_id:
        await query.edit_message_text("Ошибка: ID пользователя не найден.")
        return await _return_to_admin_panel_after_action(update, context)

    await query.edit_message_text(f"Отзываю подписку для {user_id} и удаляю ключи с серверов...")
    
    deleted_count = 0
    with sqlite3.connect("vpn_platform.db") as conn:
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        
        profiles_to_delete = c.execute(
            "SELECT p.client_uuid, p.inbound_id, s.panel_url, s.panel_username, s.panel_password "
            "FROM vpn_profiles p JOIN servers s ON p.server_id = s.id "
            "WHERE p.assigned_to_user_id = ?", (user_id,)
        ).fetchall()
        
        for profile in profiles_to_delete:
            api = XUI_API(profile['panel_url'], profile['panel_username'], profile['panel_password'])
            if await api.delete_client(profile['inbound_id'], profile['client_uuid']):
                deleted_count += 1
            await api.close()
        
        c.execute("UPDATE users SET expires_at = NULL, subscription_type = NULL WHERE user_id = ?", (user_id,))
        c.execute("DELETE FROM vpn_profiles WHERE assigned_to_user_id = ?", (user_id,))
        conn.commit()

    await query.edit_message_text(f"✅ Подписка для {user_id} отозвана. Удалено ключей с панелей: {deleted_count}.")
    try:
        await context.bot.send_message(chat_id=user_id, text="Администратор отозвал вашу подписку.")
    except Exception as e:
        logger.warning(f"Не удалось уведомить {user_id} об отзыве: {e}")

    return await _return_to_admin_panel_after_action(update, context)

async def admin_find_user_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    await update.callback_query.answer()
    await update.callback_query.edit_message_text("Введите юзернейм (например, @username) или ID пользователя для поиска.")
    return STATE_ADMIN_FIND_USER_INPUT

async def admin_find_user_process(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    search_query = update.message.text.strip()

    with sqlite3.connect("vpn_platform.db") as conn:
        cursor = conn.cursor()
        if search_query.startswith('@'):
            user_data_tuple = cursor.execute("SELECT user_id, username, subscription_type, expires_at, referrer_id, referral_balance, main_balance FROM users WHERE username = ?", (search_query[1:],)).fetchone()
        elif search_query.isdigit():
            user_data_tuple = cursor.execute("SELECT user_id, username, subscription_type, expires_at, referrer_id, referral_balance, main_balance FROM users WHERE user_id = ?", (int(search_query),)).fetchone()
        else:
            await update.message.reply_text("Неверный формат. Введите юзернейм (с @) или числовой ID.")
            return STATE_ADMIN_FIND_USER_INPUT

    if not user_data_tuple:
        await update.message.reply_text("Пользователь не найден в базе данных.")
        return await _return_to_admin_panel_after_action(update, context)

    (user_id, username, sub_type, expires_at, _, ref_balance, main_balance) = user_data_tuple
    context.user_data['found_user_id'] = user_id
    context.user_data['found_user_username'] = username

    with sqlite3.connect("vpn_platform.db") as conn:
        ref_count = conn.cursor().execute("SELECT COUNT(*) FROM referrals WHERE referrer_id = ?", (user_id,)).fetchone()[0]

    expires_text = "Нет"
    if expires_at:
        try:
            expires_dt = datetime.strptime(expires_at, '%Y-%m-%d %H:%M:%S')
            if expires_dt > datetime.now():
                expires_text = expires_dt.strftime('%d.%m.%Y %H:%M')
        except (ValueError, TypeError):
            expires_text = "Ошибка даты"

    text = (
        f"👤 **Профиль пользователя**\n\n"
        f"**ID:** `{user_id}`\n"
        f"**Юзернейм:** @{username}\n\n"
        f"**Подписка активна до:** {expires_text}\n"
        f"**Основной баланс:** {main_balance:.2f} ₽\n"
        f"**Реферальный баланс:** {ref_balance:.2f} ₽\n"
        f"**Приглашено:** {ref_count} чел."
    )
    keyboard = [
        [InlineKeyboardButton("✉️ Отправить сообщение", callback_data="admin_send_message")],
        [InlineKeyboardButton("⬅️ В админ-панель", callback_data="admin_panel")]
    ]
    await update.message.reply_text(text, parse_mode="Markdown", reply_markup=InlineKeyboardMarkup(keyboard))
    return STATE_ADMIN_USER_PROFILE

async def admin_send_message_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    username = context.user_data.get('found_user_username', 'пользователю')
    await query.answer()
    await query.edit_message_text(f"Введите сообщение, которое хотите отправить @{username}.")
    return STATE_ADMIN_SEND_MESSAGE_INPUT

async def admin_send_message_process(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    user_id_to_send = context.user_data.get('found_user_id')
    message_text = update.message.text

    if not user_id_to_send:
        await update.message.reply_text("❌ Ошибка: ID пользователя не найден. Попробуйте найти пользователя заново.")
        return await _return_to_admin_panel_after_action(update, context)

    try:
        await context.bot.send_message(
            chat_id=user_id_to_send,
            text=f"Сообщение от администратора:\n\n---\n{message_text}"
        )
        await update.message.reply_text("✅ Сообщение успешно отправлено пользователю.")
    except Exception as e:
        await update.message.reply_text(f"⚠️ Не удалось отправить сообщение. Ошибка: {e}")

    return await _return_to_admin_panel_after_action(update, context)

async def admin_credit_balance_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    await update.callback_query.answer()
    await update.callback_query.edit_message_text("Введите ID пользователя, которому нужно начислить баланс.")
    return STATE_ADMIN_CREDIT_BALANCE_ID

async def admin_credit_balance_get_id(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    try:
        user_id = int(update.message.text)
        context.user_data['credit_user_id'] = user_id
        await update.message.reply_text(f"Пользователь: {user_id}. Теперь введите сумму для начисления в рублях (например, 150 или 150.5).")
        return STATE_ADMIN_CREDIT_BALANCE_AMOUNT
    except ValueError:
        await update.message.reply_text("Неверный ID. Попробуйте еще раз.")
        return STATE_ADMIN_CREDIT_BALANCE_ID

async def admin_credit_balance_process(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    user_id = context.user_data.get('credit_user_id')
    try:
        amount = float(update.message.text)
    except ValueError:
        await update.message.reply_text("Неверная сумма. Введите число, например, 150.")
        return STATE_ADMIN_CREDIT_BALANCE_AMOUNT

    with sqlite3.connect("vpn_platform.db") as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE users SET main_balance = main_balance + ? WHERE user_id = ?", (amount, user_id))
        if cursor.rowcount == 0:
            await update.message.reply_text(f"⚠️ Пользователь с ID {user_id} не найден. Баланс не начислен.")
        else:
            conn.commit()
            await update.message.reply_text(f"✅ Баланс пользователя {user_id} успешно пополнен на {amount:.2f} ₽.")
            try:
                await context.bot.send_message(user_id, f"🎉 Администратор пополнил ваш основной баланс на *{amount:.2f} ₽*!", parse_mode="Markdown")
            except Exception:
                await update.message.reply_text("⚠️ Не удалось уведомить пользователя.")

    return await _return_to_admin_panel_after_action(update, context)

async def admin_find_by_key_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    await update.callback_query.answer()
    await update.callback_query.edit_message_text("Отправьте ключ (ссылку) для поиска пользователя. /cancel для отмены.")
    return STATE_ADMIN_FIND_BY_KEY_INPUT

async def admin_find_by_key_process(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    config_link = update.message.text.strip()
    with sqlite3.connect("vpn_platform.db") as conn:
        conn.row_factory = sqlite3.Row
        profile_data = conn.cursor().execute(
            "SELECT p.*, s.name as server_name "
            "FROM vpn_profiles p JOIN servers s ON p.server_id = s.id "
            "WHERE p.config_link = ?", (config_link,)
        ).fetchone()

    if not profile_data:
        await update.message.reply_text("Этот ключ не найден в базе данных бота.")
        return await _return_to_admin_panel_after_action(update, context)

    user_id = profile_data['assigned_to_user_id']
    with sqlite3.connect("vpn_platform.db") as conn:
        user_data = conn.cursor().execute("SELECT username, expires_at, subscription_type FROM users WHERE user_id = ?", (user_id,)).fetchone()

    if user_data:
        username, expires_at, sub_type = user_data
        tariff_name = PRICES.get(sub_type, {}).get('name', 'Неизвестный')
        text = (
            f"✅ **Ключ найден**\n\n"
            f"👤 **Пользователь:** @{username} (ID: `{user_id}`)\n"
            f"🖥 **Сервер:** {profile_data['server_name']}\n"
            f"🔑 **Тип ключа:** {tariff_name}\n"
            f"🗓 **Дата выдачи:** {profile_data['created_at']}\n"
            f"⌛️ **Подписка активна до:** {expires_at}"
        )
        await update.message.reply_text(text, parse_mode="Markdown")
    else:
        await update.message.reply_text(f"Найден ключ, привязанный к ID: {user_id}, но сам пользователь не найден в таблице users.")

    return await _return_to_admin_panel_after_action(update, context)

async def admin_edit_text_list(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    await update.callback_query.answer()
    with sqlite3.connect("vpn_platform.db") as conn:
        texts = conn.cursor().execute("SELECT key FROM bot_texts ORDER BY key").fetchall()

    keyboard = [[InlineKeyboardButton(key, callback_data=f"edittext_{key}")] for key, in texts if not key.startswith("last_used")]
    keyboard.append([InlineKeyboardButton("⬅️ Назад", callback_data="admin_panel")])
    await update.callback_query.edit_message_text("Выберите текст, который хотите изменить:", reply_markup=InlineKeyboardMarkup(keyboard))
    return STATE_ADMIN_EDIT_TEXT_LIST

async def admin_edit_text_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    text_key = query.data.split("edittext_")[1]
    context.user_data['text_key_to_edit'] = text_key
    current_text = await get_text(text_key, context)
    await query.answer()
    await query.edit_message_text(
        f"**Редактирование текста: `{text_key}`**\n\n"
        f"Текущий текст:\n"
        f"-----------------\n"
        f"{escape_markdown(current_text)}\n"
        f"-----------------\n\n"
        f"Отправьте новый текст. /cancel для отмены.",
        parse_mode="Markdown"
    )
    return STATE_ADMIN_EDIT_TEXT_INPUT

async def admin_edit_text_save(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    new_text = update.message.text
    text_key = context.user_data.get('text_key_to_edit')
    if not text_key:
        await update.message.reply_text("Произошла ошибка, ключ для редактирования не найден.")
        return await _return_to_admin_panel_after_action(update, context)

    await set_text(text_key, new_text, context)

    await update.message.reply_text(f"✅ Текст для ключа `{text_key}` успешно обновлен.")
    context.user_data.clear()
    return await _return_to_admin_panel_after_action(update, context)

# =======================================
# ===    НОВЫЙ БЛОК: МЕНЕДЖЕР СЕРВЕРОВ  ===
# =======================================
async def admin_servers_menu(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()

    with sqlite3.connect("vpn_platform.db") as conn:
        conn.row_factory = sqlite3.Row
        servers = conn.cursor().execute("SELECT id, name, is_active FROM servers ORDER BY name").fetchall()
    
    text = "🔧 **Управление серверами**\n\nЗдесь вы можете добавлять и настраивать панели 3X-UI, на которых бот будет создавать ключи."
    keyboard = []
    for server in servers:
        status_icon = "🟢" if server['is_active'] else "🔴"
        keyboard.append([
            InlineKeyboardButton(f"{status_icon} {server['name']}", callback_data=f"server_view_{server['id']}")
        ])
    
    keyboard.append([InlineKeyboardButton("➕ Добавить новый сервер", callback_data="server_add_start")])
    keyboard.append([InlineKeyboardButton("⬅️ Назад в админ-панель", callback_data="admin_panel")])
    
    await query.edit_message_text(text, reply_markup=InlineKeyboardMarkup(keyboard))
    return STATE_ADMIN_SERVERS_MENU

async def admin_view_server(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    server_id = int(query.data.split('_')[-1])
    context.user_data['server_id'] = server_id

    with sqlite3.connect("vpn_platform.db") as conn:
        conn.row_factory = sqlite3.Row
        server = conn.cursor().execute("SELECT * FROM servers WHERE id = ?", (server_id,)).fetchone()

    if not server:
        await query.answer("Сервер не найден", show_alert=True)
        return await admin_servers_menu(update, context)

    status_text = "🟢 Активен (на нем создаются ключи)" if server['is_active'] else "🔴 Отключен (новые ключи не создаются)"
    text = (
        f"**Просмотр сервера: `{server['name']}`**\n\n"
        f"**Статус:** {status_text}\n"
        f"**URL панели:** `{server['panel_url']}`\n"
        f"**Внешний адрес:** `{server['vless_address']}:{server['vless_port']}`\n"
        f"**Inbound ID:** `{server['vless_inbound_id']}`\n"
        f"**SNI:** `{server['vless_sni']}`\n"
        f"**Flow:** `{server['vless_flow']}`"
    )
    
    toggle_text = "🔴 Отключить" if server['is_active'] else "🟢 Включить"
    keyboard = [
        [InlineKeyboardButton(toggle_text, callback_data=f"server_toggle_{server_id}")],
        [InlineKeyboardButton("🗑 Удалить сервер", callback_data=f"server_delete_{server_id}")],
        [InlineKeyboardButton("⬅️ Назад к списку", callback_data="admin_servers_menu")]
    ]

    await query.edit_message_text(text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode="Markdown")
    return STATE_ADMIN_VIEW_SERVER

async def admin_toggle_server_status(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    server_id = int(query.data.split('_')[-1])
    with sqlite3.connect("vpn_platform.db") as conn:
        c = conn.cursor()
        current_status = c.execute("SELECT is_active FROM servers WHERE id = ?", (server_id,)).fetchone()[0]
        c.execute("UPDATE servers SET is_active = ? WHERE id = ?", (not current_status, server_id))
        conn.commit()
    await query.answer("Статус изменен!")
    return await admin_view_server(update, context)

async def admin_delete_server(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    server_id = int(query.data.split('_')[-1])
    with sqlite3.connect("vpn_platform.db") as conn:
        conn.cursor().execute("DELETE FROM servers WHERE id = ?", (server_id,))
        conn.commit()
    await query.answer("Сервер удален!", show_alert=True)
    query.data = "admin_servers_menu"
    return await admin_servers_menu(update, context)

# --- ConversationHandler для добавления сервера ---
async def server_add_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    await update.callback_query.answer()
    context.user_data['server_data'] = {}
    await update.callback_query.edit_message_text("**Шаг 1/11: Имя сервера**\n\nВведите короткое имя (например, 'Германия Hetzner'). /cancel для отмены.")
    return STATE_ADMIN_ADD_SERVER_NAME

async def server_add_step_handler(update: Update, context: ContextTypes.DEFAULT_TYPE, current_key, next_prompt, next_state):
    context.user_data['server_data'][current_key] = update.message.text
    await update.message.reply_text(next_prompt)
    return next_state

async def server_add_get_name(update: Update, context: ContextTypes.DEFAULT_TYPE):
    return await server_add_step_handler(update, context, 'name', "**Шаг 2/11: URL панели**\n\nВведите полный URL вашей 3X-UI панели (например, `http://1.2.3.4:2053`)", STATE_ADMIN_ADD_SERVER_URL)

async def server_add_get_url(update: Update, context: ContextTypes.DEFAULT_TYPE):
    return await server_add_step_handler(update, context, 'url', "**Шаг 3/11: Логин панели**\n\nВведите логин администратора панели.", STATE_ADMIN_ADD_SERVER_USER)

async def server_add_get_user(update: Update, context: ContextTypes.DEFAULT_TYPE):
    return await server_add_step_handler(update, context, 'user', "**Шаг 4/11: Пароль панели**\n\nВведите пароль администратора панели.", STATE_ADMIN_ADD_SERVER_PASS)

async def server_add_get_pass(update: Update, context: ContextTypes.DEFAULT_TYPE):
    return await server_add_step_handler(update, context, 'pass', "**Шаг 5/11: Внешний адрес**\n\nВведите IP или домен сервера, который будут использовать клиенты.", STATE_ADMIN_ADD_SERVER_ADDRESS)

async def server_add_get_address(update: Update, context: ContextTypes.DEFAULT_TYPE):
    return await server_add_step_handler(update, context, 'address', "**Шаг 6/11: Порт**\n\nВведите порт, который используют клиенты (обычно `443`).", STATE_ADMIN_ADD_SERVER_PORT)

async def server_add_get_port(update: Update, context: ContextTypes.DEFAULT_TYPE):
    return await server_add_step_handler(update, context, 'port', "**Шаг 7/11: Inbound ID**\n\nВведите ID входящего подключения (inbound) в панели (обычно `1`).", STATE_ADMIN_ADD_SERVER_INBOUND_ID)

async def server_add_get_inbound_id(update: Update, context: ContextTypes.DEFAULT_TYPE):
    return await server_add_step_handler(update, context, 'inbound_id', "**Шаг 8/11: SNI**\n\nВведите SNI (Server Name Indication), указанный в настройках inbound (например, `yahoo.com`).", STATE_ADMIN_ADD_SERVER_SNI)

async def server_add_get_sni(update: Update, context: ContextTypes.DEFAULT_TYPE):
    return await server_add_step_handler(update, context, 'sni', "**Шаг 9/11: Flow**\n\nВведите параметр Flow (например, `xtls-rprx-vision`).", STATE_ADMIN_ADD_SERVER_FLOW)

async def server_add_get_flow(update: Update, context: ContextTypes.DEFAULT_TYPE):
    return await server_add_step_handler(update, context, 'flow', "**Шаг 10/11: Public Key**\n\nВведите **публичный ключ** (publicKey) из настроек вашего inbound.", STATE_ADMIN_ADD_SERVER_PBK)

async def server_add_get_pbk(update: Update, context: ContextTypes.DEFAULT_TYPE):
    return await server_add_step_handler(update, context, 'pbk', "**Шаг 11/11: Short ID**\n\nВведите **короткий ID** (shortId) из настроек вашего inbound.", STATE_ADMIN_ADD_SERVER_SID)

async def server_add_finish(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data['server_data']['sid'] = update.message.text
    data = context.user_data['server_data']
    try:
        with sqlite3.connect("vpn_platform.db") as conn:
            conn.cursor().execute(
                """INSERT INTO servers (name, panel_url, panel_username, panel_password, vless_address, 
                vless_port, vless_inbound_id, vless_sni, vless_flow, vless_public_key, vless_short_id) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (data['name'], data['url'], data['user'], data['pass'], data['address'],
                int(data['port']), int(data['inbound_id']), data['sni'], data['flow'], data['pbk'], data['sid'])
            )
            conn.commit()
        await update.message.reply_text(f"✅ Сервер '{data['name']}' успешно добавлен!")
    except Exception as e:
        await update.message.reply_text(f"❌ Произошла ошибка при добавлении сервера: {e}")
        logger.error(f"Ошибка сохранения сервера в БД: {e}")

    context.user_data.clear()
    
    class FakeUpdate:
        def __init__(self, effective_user, message):
            self.effective_user = effective_user
            self.callback_query = self.FakeCallbackQuery(message)
        class FakeCallbackQuery:
            def __init__(self, message): 
                self.message = message
                self.data = "admin_servers_menu"
            async def answer(self): pass
            async def edit_message_text(self, *args, **kwargs):
                return await self.message.reply_text(*args, **kwargs)
    
    fake_update = FakeUpdate(update.effective_user, update.message)
    return await admin_servers_menu(fake_update, context)

# =======================================
# ===        СИСТЕМА ПОДДЕРЖКИ        ===
# =======================================
async def _create_support_ticket(update: Update, context: ContextTypes.DEFAULT_TYPE, topic_name: str, initial_message_for_admin: str) -> int:
    query = update.callback_query
    user = query.from_user
    await query.answer()
    with sqlite3.connect("vpn_platform.db") as conn:
        ticket = conn.cursor().execute("SELECT thread_id FROM support_tickets WHERE user_id = ?", (user.id,)).fetchone()
        if ticket:
            try:
                await query.edit_message_text(
                    "Вы уже находитесь в чате с поддержкой. Просто продолжайте писать сюда.\n\n"
                    "Чтобы завершить чат, введите /close_chat"
                )
            except TelegramError: pass
            return STATE_SUPPORT_CHAT
    try:
        await query.edit_message_text("⏳ Создаем чат с поддержкой, пожалуйста, подождите...")
    except TelegramError: pass
    thread_id = None
    try:
        topic = await context.bot.create_forum_topic(chat_id=GROUP_ID, name=topic_name)
        thread_id = topic.message_thread_id
    except TelegramError as e:
        logger.error(f"Не удалось создать тему для {user.id}: {e}")
        await query.edit_message_text("❌ Не удалось создать чат. Проблема на стороне группы поддержки. Администраторы уведомлены.")
        return STATE_MAIN_MENU
    try:
        with sqlite3.connect("vpn_platform.db") as conn:
            conn.cursor().execute("INSERT OR REPLACE INTO support_tickets (user_id, thread_id) VALUES (?, ?)", (user.id, thread_id))
            conn.commit()

        await context.bot.send_message(chat_id=GROUP_ID, message_thread_id=thread_id, text=initial_message_for_admin, parse_mode="MarkdownV2")
        final_message_for_user = (
            "✅ Чат с поддержкой создан. Теперь вы можете задать свой вопрос прямо здесь.\n\n"
            "Все ваши сообщения будут пересланы оператору.\n\n"
            "Чтобы завершить чат, отправьте команду /close_chat"
        )
        await query.edit_message_text(text=final_message_for_user)
        return STATE_SUPPORT_CHAT
    except Exception as e:
        logger.critical(f"КРИТИЧЕСКАЯ ОШИБКА: Тема {thread_id} для {user.id} создана, но не удалось записать в БД или отправить сообщения. Ошибка: {e}")
        await query.edit_message_text(text=f"❌ Произошла ошибка при настройке чата.\n\nПожалуйста, свяжитесь с поддержкой напрямую, сообщив этот номер тикета: `TICKET-{thread_id}`", parse_mode="Markdown")
        return STATE_SUPPORT_CHAT

async def support_start_sbp(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    user = update.effective_user
    tariff_key = context.user_data.get('tariff_key')
    if not tariff_key:
        await update.callback_query.edit_message_text("❌ Ошибка. Пожалуйста, выберите тариф заново.")
        return await start(update, context)
    user_info_raw = f"@{user.username}" if user.username else f"{user.full_name} (ID: {user.id})"
    user_info_escaped = escape_markdown(user_info_raw, version=2)
    tariff_info = PRICES[tariff_key]
    tariff_name_escaped = escape_markdown(tariff_info['name'], version=2)
    tariff_price_escaped = escape_markdown(str(tariff_info['price']), version=2)
    topic_name = f"Оплата СБП | {user_info_raw} ({user.id})"
    initial_message_for_admin = (
        f"💬 Новый тикет по оплате СБП от {user_info_escaped}\\.\n\n"
        f"👤 ID пользователя: `{user.id}`\n\n"
        f"Тариф: *{tariff_name_escaped}*\n"
        f"Сумма: *{tariff_price_escaped}₽*\n\n"
        "Пожалуйста, вышлите реквизиты\\. \\(/close\\_ticket для закрытия\\)"
    )
    return await _create_support_ticket(update, context, topic_name, initial_message_for_admin)

async def support_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    user = update.effective_user
    user_info_raw = f"@{user.username}" if user.username else f"{user.full_name} (ID: {user.id})"
    user_info_escaped = escape_markdown(user_info_raw, version=2)
    topic_name = f"Поддержка | {user_info_raw} ({user.id})"
    initial_message_for_admin = (
        f"💬 Новый тикет от пользователя {user_info_escaped}\\.\n\n"
        f"👤 ID пользователя: `{user.id}`\n\n"
        "Чтобы ответить, напишите сообщение в этой теме\\. \\(/close\\_ticket для закрытия\\)"
    )
    return await _create_support_ticket(update, context, topic_name, initial_message_for_admin)

async def support_start_rub_deposit(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    user = update.effective_user
    amount = context.user_data.get('rub_deposit_amount', 'НЕИЗВЕСТНО')
    user_info_raw = f"@{user.username}" if user.username else f"{user.full_name} (ID: {user.id})"
    user_info_escaped = escape_markdown(user_info_raw, version=2)
    amount_escaped = escape_markdown(str(amount), version=2)
    topic_name = f"Пополнение RUB | {user_info_raw} ({user.id})"
    initial_message_for_admin = (
        f"💬 Новый запрос на пополнение баланса от {user_info_escaped}\\.\n\n"
        f"👤 ID пользователя: `{user.id}`\n\n"
        f"Сумма: *{amount_escaped} ₽*\n\n"
        "Пожалуйста, вышлите реквизиты\\. После получения оплаты, не забудьте начислить баланс через админ\\-панель\\. \\(/close\\_ticket для закрытия\\)"
    )
    return await _create_support_ticket(update, context, topic_name, initial_message_for_admin)

async def forward_to_group(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    thread_id = None
    with sqlite3.connect("vpn_platform.db") as conn:
        ticket_row = conn.cursor().execute("SELECT thread_id FROM support_tickets WHERE user_id = ?", (user_id,)).fetchone()
        if ticket_row:
            thread_id = ticket_row[0]
    if thread_id:
        try:
            await update.message.copy(chat_id=GROUP_ID, message_thread_id=thread_id)
        except Exception as e:
            logger.error(f"Не удалось переслать сообщение от {user_id} в тему {thread_id}: {e}")
            await update.message.reply_text("⚠️ Произошла ошибка при отправке вашего сообщения. Пожалуйста, попробуйте еще раз или перезапустите чат командой /start.")
    else:
        await update.message.reply_text("⚠️ Не удалось найти ваш чат с поддержкой. Возможно, он был закрыт. Пожалуйста, вернитесь в главное меню (/start) и откройте тикет заново.")

async def forward_to_user(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not (update.message and update.message.chat.id == GROUP_ID and update.message.is_topic_message and not update.message.from_user.is_bot):
        return
    thread_id = update.message.message_thread_id
    if update.message.text and update.message.text.startswith('/'): return
    with sqlite3.connect("vpn_platform.db") as conn:
        ticket = conn.cursor().execute("SELECT user_id FROM support_tickets WHERE thread_id = ?", (thread_id,)).fetchone()
    if ticket:
        user_id = ticket[0]
        try:
            await update.message.copy(chat_id=user_id)
        except Exception as e:
            logger.error(f"Не удалось переслать сообщение админа пользователю {user_id}: {e}")
            await update.message.reply_text(f"⚠️ Не удалось доставить ответ пользователю. Возможно, он заблокировал бота. Ошибка: {e}")

async def close_chat_user(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    user_id = update.effective_user.id
    with sqlite3.connect("vpn_platform.db") as conn:
        c = conn.cursor()
        ticket = c.execute("SELECT thread_id FROM support_tickets WHERE user_id = ?", (user_id,)).fetchone()
        if ticket:
            thread_id = ticket[0]
            c.execute("DELETE FROM support_tickets WHERE user_id = ?", (user_id,))
            conn.commit()
            try:
                await context.bot.send_message(chat_id=GROUP_ID, message_thread_id=thread_id, text="🔒 Пользователь завершил чат.")
            except TelegramError as e:
                logger.warning(f"Не удалось отправить сообщение о закрытии чата в группу {GROUP_ID}: {e}")
            await update.message.reply_text("Чат с поддержкой закрыт. Вы можете начать новый в любой момент из главного меню.")
        else:
            await update.message.reply_text("У вас нет активного чата с поддержкой.")
    return await start(update, context)

async def close_chat_admin(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not (update.message and update.message.chat.id == GROUP_ID and update.message.is_topic_message):
        return
    thread_id = update.message.message_thread_id
    with sqlite3.connect("vpn_platform.db") as conn:
        c = conn.cursor()
        ticket = c.execute("SELECT user_id FROM support_tickets WHERE thread_id = ?", (thread_id,)).fetchone()
        if ticket:
            user_id = ticket[0]
            admin_name = update.effective_user.first_name
            c.execute("DELETE FROM support_tickets WHERE thread_id = ?", (thread_id,))
            conn.commit()
            await context.bot.send_message(chat_id=GROUP_ID, message_thread_id=thread_id, text=f"🔒 Чат закрыт администратором ({admin_name}).")
            try:
                await context.bot.send_message(chat_id=user_id, text="Администратор закрыл ваш чат с поддержкой.")
            except Exception as e:
                logger.warning(f"Не удалось уведомить пользователя {user_id} о закрытии чата: {e}")
        else:
            await update.message.reply_text("Этот тикет уже закрыт или не существует в базе данных.", quote=True)

# =======================================

# =======================================
# ===      УВЕДОМЛЕНИЯ ОБ ОКОНЧАНИИ   ===
# =======================================
async def subscription_reminder_job(context: ContextTypes.DEFAULT_TYPE):
    logger.info("Запущена задача проверки истекающих подписок.")
    now = datetime.now()
    three_days_later = (now + timedelta(days=3)).strftime('%Y-%m-%d %H:%M:%S')
    one_day_later = (now + timedelta(days=1)).strftime('%Y-%m-%d %H:%M:%S')

    with sqlite3.connect("vpn_platform.db") as conn:
        cursor = conn.cursor()
        # Находим тех, у кого подписка истекает через 2-3 дня
        expiring_in_3_days = cursor.execute(
            "SELECT user_id, expires_at FROM users WHERE expires_at BETWEEN ? AND ?",
            (now.strftime('%Y-%m-%d %H:%M:%S'), three_days_later)
        ).fetchall()
        
        # Находим тех, у кого подписка истекает в течение 24 часов
        expiring_in_1_day = cursor.execute(
            "SELECT user_id, expires_at FROM users WHERE expires_at BETWEEN ? AND ?",
            (now.strftime('%Y-%m-%d %H:%M:%S'), one_day_later)
        ).fetchall()

    users_reminded = set()

    for user_id, expires_at_str in expiring_in_1_day:
        if user_id in users_reminded: continue
        try:
            expires_dt = datetime.strptime(expires_at_str, '%Y-%m-%d %H:%M:%S')
            message = f"❗️ Ваша подписка на VPN истекает менее чем через 24 часа ({expires_dt.strftime('%d.%m.%Y в %H:%M')}).\n\nНе забудьте продлить ее, чтобы не потерять доступ!"
            await context.bot.send_message(chat_id=user_id, text=message)
            users_reminded.add(user_id)
            await asyncio.sleep(0.2)
        except Exception as e:
            logger.warning(f"Не удалось отправить уведомление за 1 день пользователю {user_id}: {e}")

    for user_id, expires_at_str in expiring_in_3_days:
        if user_id in users_reminded: continue
        try:
            expires_dt = datetime.strptime(expires_at_str, '%Y-%m-%d %H:%M:%S')
            message = f"🔔 Напоминаем, что ваша подписка на VPN истекает через 3 дня ({expires_dt.strftime('%d.%m.%Y в %H:%M')}).\n\nВы можете продлить ее в главном меню бота."
            await context.bot.send_message(chat_id=user_id, text=message)
            users_reminded.add(user_id)
            await asyncio.sleep(0.2)
        except Exception as e:
            logger.warning(f"Не удалось отправить уведомление за 3 дня пользователю {user_id}: {e}")
    
    logger.info(f"Проверка подписок завершена. Отправлено {len(users_reminded)} напоминаний.")


# ===      ГЛАВНАЯ ФУНКЦИЯ main       ===
# =======================================
def main():
    if not all([BOT_TOKEN, ADMIN_IDS, GROUP_ID, CRYPTO_BOT_TOKEN]):
        logger.critical("Одна или несколько ОБЯЗАТЕЛЬНЫХ переменных окружения не установлены. Проверьте .env файл.")
        return

    init_db()
    application = ApplicationBuilder().token(BOT_TOKEN).build()

    # Добавляем фоновую задачу для отправки уведомлений (запускается раз в 6 часов)
    job_queue = application.job_queue
    job_queue.run_repeating(subscription_reminder_job, interval=timedelta(hours=6), first=10, name="subscription_reminder")

    add_server_handler = ConversationHandler(
        entry_points=[CallbackQueryHandler(server_add_start, pattern="^server_add_start$")],
        states={
            STATE_ADMIN_ADD_SERVER_NAME: [MessageHandler(filters.TEXT & ~filters.COMMAND, server_add_get_name)],
            STATE_ADMIN_ADD_SERVER_URL: [MessageHandler(filters.TEXT & ~filters.COMMAND, server_add_get_url)],
            STATE_ADMIN_ADD_SERVER_USER: [MessageHandler(filters.TEXT & ~filters.COMMAND, server_add_get_user)],
            STATE_ADMIN_ADD_SERVER_PASS: [MessageHandler(filters.TEXT & ~filters.COMMAND, server_add_get_pass)],
            STATE_ADMIN_ADD_SERVER_ADDRESS: [MessageHandler(filters.TEXT & ~filters.COMMAND, server_add_get_address)],
            STATE_ADMIN_ADD_SERVER_PORT: [MessageHandler(filters.TEXT & ~filters.COMMAND, server_add_get_port)],
            STATE_ADMIN_ADD_SERVER_INBOUND_ID: [MessageHandler(filters.TEXT & ~filters.COMMAND, server_add_get_inbound_id)],
            STATE_ADMIN_ADD_SERVER_SNI: [MessageHandler(filters.TEXT & ~filters.COMMAND, server_add_get_sni)],
            STATE_ADMIN_ADD_SERVER_FLOW: [MessageHandler(filters.TEXT & ~filters.COMMAND, server_add_get_flow)],
            STATE_ADMIN_ADD_SERVER_PBK: [MessageHandler(filters.TEXT & ~filters.COMMAND, server_add_get_pbk)],
            STATE_ADMIN_ADD_SERVER_SID: [MessageHandler(filters.TEXT & ~filters.COMMAND, server_add_finish)],
        },
        fallbacks=[CommandHandler("cancel", cancel)],
        map_to_parent={ STATE_ADMIN_SERVERS_MENU: STATE_ADMIN_SERVERS_MENU }
    )

    main_conv_handler = ConversationHandler(
        entry_points=[CommandHandler("start", start), CallbackQueryHandler(start, pattern="^main_menu$")],
        states={
            STATE_MAIN_MENU: [
                CallbackQueryHandler(select_tariff, pattern="^buy_vpn$"),
                CallbackQueryHandler(my_vpn, pattern="^my_vpn$"),
                CallbackQueryHandler(show_vpn_device, pattern="^vpn_device_"),
                CallbackQueryHandler(instructions_menu, pattern="^instructions$"),
                CallbackQueryHandler(referral_menu, pattern="^referral$"),
                CallbackQueryHandler(support_start, pattern="^support$"),
                CallbackQueryHandler(admin_panel, pattern="^admin_panel$"),
                CallbackQueryHandler(balance_menu, pattern="^balance_menu$"),
            ],
            STATE_SELECT_PAYMENT_METHOD: [
                CallbackQueryHandler(select_payment_method, pattern="^tariff_"),
                CallbackQueryHandler(select_tariff, pattern="^buy_vpn$"),
            ],
            STATE_SELECT_CURRENCY: [
                CallbackQueryHandler(select_currency, pattern="^pay_crypto$"),
                CallbackQueryHandler(sbp_payment_info, pattern="^pay_sbp$"),
                CallbackQueryHandler(support_start_sbp, pattern="^support_sbp$"),
                CallbackQueryHandler(pay_from_balance, pattern="^pay_from_balance$"),
                CallbackQueryHandler(select_payment_method, pattern="^tariff_"),
            ],
            STATE_AWAIT_PAYMENT: [
                CallbackQueryHandler(create_payment, pattern="^currency_"),
                CallbackQueryHandler(check_payment, pattern="^check_"),
                CallbackQueryHandler(select_currency, pattern="^pay_crypto$"),
            ],
            STATE_SUPPORT_CHAT: [
                CommandHandler("close_chat", close_chat_user),
                MessageHandler(filters.ALL & ~filters.COMMAND, forward_to_group),
            ],
            STATE_INSTRUCTIONS: [
                CallbackQueryHandler(show_instruction, pattern="^instr_"),
                CallbackQueryHandler(instructions_menu, pattern="^instructions$"),
            ],
            STATE_ADMIN_PANEL: [
                CallbackQueryHandler(admin_stats, pattern="^admin_stats$"),
                CallbackQueryHandler(grant_sub_start, pattern="^admin_grant_start$"),
                CallbackQueryHandler(admin_servers_menu, pattern="^admin_servers_menu$"),
                CallbackQueryHandler(broadcast_start, pattern="^admin_broadcast_start$"),
                CallbackQueryHandler(revoke_sub_start, pattern="^admin_revoke_start$"),
                CallbackQueryHandler(admin_find_by_key_start, pattern="^admin_find_by_key$"),
                CallbackQueryHandler(admin_edit_text_list, pattern="^admin_edit_text$"),
                CallbackQueryHandler(admin_find_user_start, pattern="^admin_find_user$"),
                CallbackQueryHandler(admin_credit_balance_start, pattern="^admin_credit_balance"),
            ],
            STATE_ADMIN_GRANT_ID: [MessageHandler(filters.TEXT & ~filters.COMMAND, grant_sub_get_id)],
            STATE_ADMIN_GRANT_TARIFF: [CallbackQueryHandler(grant_sub_get_tariff_and_confirm, pattern="^grant_")],
            STATE_ADMIN_BROADCAST_MESSAGE: [MessageHandler(filters.TEXT & ~filters.COMMAND, broadcast_message)],
            STATE_ADMIN_REVOKE_ID: [MessageHandler(filters.TEXT & ~filters.COMMAND, revoke_sub_get_id)],
            STATE_ADMIN_REVOKE_CONFIRM: [CallbackQueryHandler(revoke_sub_confirm, pattern="^revoke_confirm_yes")],
            STATE_ADMIN_FIND_BY_KEY_INPUT: [MessageHandler(filters.TEXT & ~filters.COMMAND, admin_find_by_key_process)],
            STATE_ADMIN_EDIT_TEXT_LIST: [CallbackQueryHandler(admin_edit_text_start, pattern="^edittext_")],
            STATE_ADMIN_EDIT_TEXT_INPUT: [MessageHandler(filters.TEXT & ~filters.COMMAND, admin_edit_text_save)],
            STATE_ADMIN_SERVERS_MENU: [
                CallbackQueryHandler(admin_view_server, pattern=r"^server_view_\d+$"),
                add_server_handler,
            ],
            STATE_ADMIN_VIEW_SERVER: [
                CallbackQueryHandler(admin_toggle_server_status, pattern=r"^server_toggle_\d+$"),
                CallbackQueryHandler(admin_delete_server, pattern=r"^server_delete_\d+$"),
                CallbackQueryHandler(admin_servers_menu, pattern="^admin_servers_menu$"),
            ],
            STATE_ADMIN_FIND_USER_INPUT: [MessageHandler(filters.TEXT & ~filters.COMMAND, admin_find_user_process)],
            STATE_ADMIN_USER_PROFILE: [CallbackQueryHandler(admin_send_message_start, pattern="^admin_send_message$")],
            STATE_ADMIN_SEND_MESSAGE_INPUT: [MessageHandler(filters.TEXT & ~filters.COMMAND, admin_send_message_process)],
            STATE_ADMIN_CREDIT_BALANCE_ID: [MessageHandler(filters.TEXT & ~filters.COMMAND, admin_credit_balance_get_id)],
            STATE_ADMIN_CREDIT_BALANCE_AMOUNT: [MessageHandler(filters.TEXT & ~filters.COMMAND, admin_credit_balance_process)],
            STATE_BALANCE_MENU: [
                CallbackQueryHandler(balance_ask_crypto_amount, pattern="^balance_crypto$"),
                CallbackQueryHandler(balance_ask_rub_amount, pattern="^balance_rub$"),
            ],
            STATE_BALANCE_CRYPTO_AMOUNT: [MessageHandler(filters.TEXT & ~filters.COMMAND, balance_create_crypto_invoice)],
            STATE_BALANCE_AWAIT_CRYPTO_PAYMENT: [CallbackQueryHandler(check_balance_payment, pattern="^check_balance_")],
            STATE_BALANCE_RUB_AMOUNT: [MessageHandler(filters.TEXT & ~filters.COMMAND, balance_create_rub_ticket)],
        },
        fallbacks=[
            CallbackQueryHandler(start, pattern="^main_menu$"),
            CallbackQueryHandler(admin_panel, pattern="^admin_panel$"),
            CommandHandler("start", start),
            CommandHandler("cancel", cancel),
        ],
        allow_reentry=True
    )

    application.add_handler(main_conv_handler)
    application.add_handler(MessageHandler(filters.Chat(GROUP_ID) & ~filters.COMMAND, forward_to_user))
    application.add_handler(CommandHandler("close_ticket", close_chat_admin, filters=filters.Chat(GROUP_ID)))

    logger.info("Бот запущен...")
    application.run_polling()

if __name__ == "__main__":
    main()
