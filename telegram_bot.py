import logging
import os
import sqlite3
import asyncio
import uuid
import json
from datetime import datetime, timedelta
from typing import Optional

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

load_dotenv()
BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN") or os.getenv("BOT_TOKEN")
ADMIN_ID_STR = os.getenv("ADMIN_ID")
ADMIN_IDS = [int(admin_id) for admin_id in ADMIN_ID_STR.split(',')] if ADMIN_ID_STR else []
GROUP_ID_STR = os.getenv("GROUP_ID")
GROUP_ID = int(GROUP_ID_STR) if GROUP_ID_STR else 0
CRYPTO_BOT_TOKEN = os.getenv("CRYPTO_BOT_TOKEN")
MIN_RUB_DEPOSIT = 130
TRIAL_DAYS = 1
TRIAL_GB = 1

DB_PATH = "vpn_platform.db"

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
    
    async def _api_request(self, method, endpoint, **kwargs):
        login_payload = {"username": self.username, "password": self.password}
        login_url = f"{self.base_url}/login"
    
        try:
            async with self._session.post(login_url, data=login_payload, timeout=10) as login_response:
                if login_response.status != 200:
                    logger.error(f"Ошибка авторизации в 3X-UI ({self.base_url}): Статус {login_response.status}")
                    return None
                if not self._session.cookie_jar:
                    logger.error(f"Панель {self.base_url} не вернула cookie после успешного логина.")
                    return None
                logger.info(f"Успешно получен cookie сессии от {self.base_url}")

            url = f"{self.base_url}{endpoint}"
            async with self._session.request(method, url, timeout=15, **kwargs) as response:
                if response.status != 200:
                    logger.error(f"Ошибка в API запросе к {endpoint}: {response.status}, {await response.text()}")
                    return None
                return await response.json()

        except Exception as e:
            logger.error(f"Исключение при выполнении API запроса к {endpoint}: {e}")
            return None

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
            logger.info(f"Успешно создан VLESS клиент {client_uuid} для пользователя {user_id}")
            return {"uuid": client_uuid, "email": email}
        else:
            logger.error(f"Не удалось создать VLESS клиента для {user_id}. Ответ: {response}")
            return None

    async def delete_client(self, inbound_id: int, client_uuid: str):
        endpoint = f"/panel/api/inbounds/{inbound_id}/delClient/{client_uuid}"
        response = await self._api_request("POST", endpoint)

        if response and response.get("success"):
            logger.info(f"Успешно удален клиент {client_uuid}")
            return True
        else:
            logger.error(f"Не удалось удалить клиента {client_uuid}")
            return False


def init_additional_tables():
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        
        cursor.execute("CREATE TABLE IF NOT EXISTS support_tickets (user_id INTEGER PRIMARY KEY, thread_id INTEGER)")
        cursor.execute("CREATE TABLE IF NOT EXISTS payments (invoice_id INTEGER PRIMARY KEY, user_id INTEGER, tariff_key TEXT, amount REAL, currency TEXT, status TEXT DEFAULT 'waiting', payment_type TEXT DEFAULT 'subscription')")
        cursor.execute("CREATE TABLE IF NOT EXISTS bot_texts (key TEXT PRIMARY KEY, value TEXT)")
        
        cursor.execute("ALTER TABLE vpn_profiles ADD COLUMN client_uuid TEXT")
        cursor.execute("ALTER TABLE vpn_profiles ADD COLUMN inbound_id INTEGER")
        
        default_texts = {
            "start_message": "👋 Привет, {first_name}!\nЭто бот для покупки ARMT-VPN.\nУ нас самые выгодные цены, качественные протоколы и огромные скорости.\nПо вопросам обращайтесь в поддержку.\nВыберите действие:",
            "buy_vpn_header": "Выберите тариф:",
            "select_payment_method_header": "Выберите способ оплаты:",
            "sbp_info_text": "Для оплаты по СБП, пожалуйста, нажмите кнопку ниже. Мы создадим для вас тикет, и оператор вышлет реквизиты для оплаты тарифа *{tariff_name}*.",
            "select_currency_header": "Выберите валюту для оплаты:",
            "instructions_main": "Здесь вы найдете инструкции по установке и подключению нашего VPN на различных устройствах. Выберите вашу операционную систему:",
            "instructions_ios": "Инструкция для iOS:\n1. Скачайте приложение v2raytun из App Store.\n2. Скопируйте ключ доступа или отсканируйте QR-код.\n3. Откройте v2raytun и добавьте сервер.\n4. Нажмите 'Подключить'. Готово!",
            "instructions_android": "Инструкция для Android:\n1. Скачайте приложение v2rayNG из Google Play.\n2. Скопируйте ключ доступа или отсканируйте QR-код.\n3. Откройте v2rayNG и добавьте сервер.\n4. Нажмите 'Подключить'. Готово!",
            "instructions_windows": "Инструкция для Windows:\n1. Скачайте клиент v2rayN.\n2. Скопируйте ключ доступа.\n3. Откройте v2rayN и добавьте сервер.\n4. Нажмите 'Подключить'. Готово!",
            "instructions_macos": "Инструкция для macOS:\n1. Скачайте клиент v2rayU или V2Box.\n2. Скопируйте ключ доступа.\n3. Добавьте сервер в клиент.\n4. Нажмите 'Подключить'. Готово!",
            "referral_message": "🤝 **Реферальная система**\n\nПриглашайте друзей и получайте *10%* с каждой их покупки на свой реферальный баланс!\n\n💰 Ваш реферальный баланс: *{balance}* ₽\n👥 Приглашено пользователей: *{count}*\n\n🔗 Ваша реферальная ссылка для приглашения:\n`{link}`",
            "balance_menu_text": "💰 **Ваш баланс**\n\nОсновной баланс: *{main_balance:.2f} ₽*\nРеферальный баланс: *{ref_balance:.2f} ₽*\n\nОбщий доступный баланс для оплаты: **{total_balance:.2f} ₽**",
            "last_used_server_index": "-1"
        }
        for key, value in default_texts.items():
            cursor.execute("INSERT OR IGNORE INTO bot_texts (key, value) VALUES (?, ?)", (key, value))
        
        conn.commit()
    logger.info("Дополнительные таблицы бота инициализированы.")


try:
    init_additional_tables()
except Exception as e:
    logger.warning(f"Ошибка при добавлении столбцов (возможно, уже существуют): {e}")


async def get_text(key: str, context: ContextTypes.DEFAULT_TYPE, **kwargs) -> str:
    if 'texts' not in context.bot_data:
        context.bot_data['texts'] = {}
        with sqlite3.connect(DB_PATH) as conn:
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
    with sqlite3.connect(DB_PATH) as conn:
        conn.cursor().execute("UPDATE bot_texts SET value = ? WHERE key = ?", (value, key))
        conn.commit()
    if 'texts' in context.bot_data:
        del context.bot_data['texts']


async def create_and_assign_vpn_profile_from_panel(user_id: int, username: str, tariff_key: str, context: ContextTypes.DEFAULT_TYPE, payment_amount: Optional[float] = None) -> Optional[str]:
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        servers = conn.cursor().execute("SELECT * FROM servers WHERE is_active = 1").fetchall()
    
    if not servers:
        logger.critical("КРИТИЧЕСКАЯ ОШИБКА: В базе данных нет ни одного активного сервера!")
        for admin_id in ADMIN_IDS:
            try:
                await context.bot.send_message(admin_id, "‼️ **ОШИБКА ВЫДАЧИ КЛЮЧА** ‼️\n\nВ базе нет активных серверов!", parse_mode="Markdown")
            except Exception:
                pass
        return None

    last_index_str = await get_text("last_used_server_index", context)
    next_index = (int(last_index_str) + 1) % len(servers)
    selected_server = servers[next_index]
    await set_text("last_used_server_index", str(next_index), context)

    logger.info(f"Выбран сервер '{selected_server['name']}' для пользователя {user_id}")
    
    with sqlite3.connect(DB_PATH) as conn:
        tariff = conn.cursor().execute("SELECT * FROM tariffs WHERE key = ?", (tariff_key,)).fetchone()
    
    if not tariff:
        logger.error(f"Тариф {tariff_key} не найден!")
        return None
    
    api = XUI_API(selected_server['panel_url'], selected_server['panel_username'], selected_server['panel_password'])
    
    client_data = await api.add_vless_client(
        inbound_id=selected_server['vless_inbound_id'], user_id=user_id,
        days=tariff['days'], gb=tariff['gb'], flow=selected_server['vless_flow']
    )
    await api.close()

    if not client_data:
        logger.critical(f"Не удалось создать профиль для пользователя {user_id}!")
        return None

    client_uuid = client_data['uuid']
    client_email = client_data['email']

    short_id = selected_server['vless_short_id'].split(',')[0]
    remarks = f"ARMT-PREMIUM-{client_email}"

    config_link = (
        f"vless://{client_uuid}@{selected_server['vless_address']}:{selected_server['vless_port']}/"
        f"?type=tcp&security=reality"
        f"&pbk={selected_server['vless_public_key']}"
        f"&fp=chrome&sni={selected_server['vless_sni']}"
        f"&sid={short_id}&spx=%2F"
        f"&flow={selected_server['vless_flow']}#{remarks}"
    )

    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        
        user = cursor.execute("SELECT expires_at FROM users WHERE telegram_id = ?", (user_id,)).fetchone()
        start_date = datetime.now()
        if user and user[0]:
            try:
                current_expiry = datetime.fromisoformat(user[0].replace(' ', 'T'))
                if current_expiry > start_date:
                    start_date = current_expiry
            except (ValueError, TypeError):
                pass
        
        expires_at = start_date + timedelta(days=tariff['days'])
        expires_at_str = expires_at.isoformat()

        cursor.execute(
            "UPDATE users SET expires_at = ?, subscription_type = ? WHERE telegram_id = ?",
            (expires_at_str, tariff_key, user_id)
        )

        cursor.execute(
            "INSERT INTO vpn_profiles (user_id, server_id, config_link, client_uuid, inbound_id) SELECT id, ?, ?, ?, ? FROM users WHERE telegram_id = ?",
            (selected_server['id'], config_link, client_uuid, selected_server['vless_inbound_id'], user_id)
        )
        
        if payment_amount:
            cursor.execute("SELECT referrer_id FROM users WHERE telegram_id = ?", (user_id,))
            referrer_row = cursor.fetchone()
            if referrer_row and referrer_row[0]:
                referrer_id_db = referrer_row[0]
                bonus = payment_amount * 0.10
                cursor.execute("UPDATE users SET referral_balance = referral_balance + ? WHERE id = ?", (bonus, referrer_id_db))
                
                cursor.execute("SELECT telegram_id FROM users WHERE id = ?", (referrer_id_db,))
                ref_tg = cursor.fetchone()
                if ref_tg and ref_tg[0]:
                    try:
                        await context.bot.send_message(ref_tg[0], f"🎉 Вам начислен реферальный бонус *{bonus:.2f} ₽*!", parse_mode="Markdown")
                    except Exception as e:
                        logger.warning(f"Не удалось уведомить {ref_tg[0]} о реферальном бонусе: {e}")

        conn.commit()

    logger.info(f"Пользователю {user_id} выдан профиль. UUID: {client_uuid}.")
    return config_link


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


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    user = update.effective_user
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        
        existing_user = cursor.execute("SELECT id, has_used_trial FROM users WHERE telegram_id = ?", (user.id,)).fetchone()
        if not existing_user:
            cursor.execute(
                "INSERT INTO users (telegram_id, telegram_username) VALUES (?, ?)",
                (user.id, user.username)
            )
            has_used_trial = 0
        else:
            cursor.execute("UPDATE users SET telegram_username = ? WHERE telegram_id = ?", (user.username, user.id))
            has_used_trial = existing_user[1]
        conn.commit()

    keyboard = [
        [InlineKeyboardButton("🛒 Купить VPN", callback_data="buy_vpn")],
    ]
    
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


async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    return await start(update, context)


def main():
    application = ApplicationBuilder().token(BOT_TOKEN).build()
    
    conv_handler = ConversationHandler(
        entry_points=[CommandHandler("start", start)],
        states={
            STATE_MAIN_MENU: [
                CallbackQueryHandler(start, pattern="^main_menu$"),
            ],
        },
        fallbacks=[CommandHandler("cancel", cancel), CommandHandler("start", start)],
    )
    
    application.add_handler(conv_handler)
    application.add_handler(CommandHandler("start", start))
    
    logger.info("Бот запущен!")
    application.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
