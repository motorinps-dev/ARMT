import crypto from "crypto";
import storage from "./storage";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

export interface TelegramMessage {
  message_id: number;
  from: {
    id: number;
    first_name: string;
    username?: string;
  };
  chat: {
    id: number;
  };
  text?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

export async function sendTelegramMessage(chatId: number, text: string): Promise<boolean> {
  try {
    const response = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
      }),
    });
    
    const data = await response.json();
    return data.ok;
  } catch (error) {
    console.error("Error sending Telegram message:", error);
    return false;
  }
}

export function generateLinkCode(): string {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

export function generate2FACode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function setWebhook(webhookUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${TELEGRAM_API_URL}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: webhookUrl }),
    });
    
    const data = await response.json();
    console.log("Webhook setup:", data);
    return data.ok;
  } catch (error) {
    console.error("Error setting webhook:", error);
    return false;
  }
}

export async function handleTelegramUpdate(update: TelegramUpdate): Promise<void> {
  const message = update.message;
  if (!message || !message.text) return;

  const chatId = message.chat.id;
  const telegramId = message.from.id;
  const text = message.text.trim();

  if (text === "/start") {
    await sendTelegramMessage(
      chatId,
      "👋 Добро пожаловать в ARMT VPN!\n\n" +
      "Этот бот используется для двухфакторной аутентификации.\n\n" +
      "Команды:\n" +
      "/link - Связать аккаунт с Telegram\n" +
      "/help - Справка"
    );
    return;
  }

  if (text === "/help") {
    await sendTelegramMessage(
      chatId,
      "ℹ️ <b>Справка по боту ARMT VPN</b>\n\n" +
      "<b>/start</b> - Начать работу с ботом\n" +
      "<b>/link</b> - Связать аккаунт с Telegram\n" +
      "<b>/help</b> - Показать эту справку\n\n" +
      "Для включения 2FA зайдите в настройки на сайте."
    );
    return;
  }

  if (text === "/link") {
    const linkCode = generateLinkCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const existingUser = storage.users.findByTelegramId(telegramId);
    if (existingUser) {
      storage.users.update(existingUser.id, {
        telegram_link_code: linkCode,
        telegram_link_expires_at: expiresAt,
      });
    } else {
      const tempUser = storage.users.create({
        telegram_id: telegramId,
        telegram_username: message.from.username,
        telegram_link_code: linkCode,
        telegram_link_expires_at: expiresAt,
      });
    }

    await sendTelegramMessage(
      chatId,
      `🔗 <b>Код для связывания аккаунта:</b>\n\n` +
      `<code>${linkCode}</code>\n\n` +
      `Введите этот код в настройках на сайте ARMT VPN.\n` +
      `Код действителен 10 минут.`
    );
    return;
  }

  const user = storage.users.findByTelegramId(telegramId);
  if (user && user.telegram_2fa_enabled) {
    if (user.twofactor_challenge_code && user.twofactor_challenge_expires_at) {
      const expiresAt = new Date(user.twofactor_challenge_expires_at);
      if (expiresAt > new Date()) {
        if (text === user.twofactor_challenge_code) {
          storage.users.update(user.id, {
            twofactor_challenge_code: null,
            twofactor_challenge_expires_at: null,
          });
          await sendTelegramMessage(
            chatId,
            "✅ Код подтвержден! Вы можете войти на сайт."
          );
        } else {
          await sendTelegramMessage(
            chatId,
            "❌ Неверный код. Попробуйте снова или запросите новый код на сайте."
          );
        }
        return;
      }
    }
  }

  await sendTelegramMessage(
    chatId,
    "❓ Неизвестная команда. Используйте /help для справки."
  );
}
