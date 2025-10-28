import type { Express } from "express";
import { createServer, type Server } from "http";
import licenseRoutes from "./routes/licenses";
import bcrypt from "bcrypt";
import storage from "./storage";
import {
  insertUserSchema,
  loginSchema,
  registerSchema,
  changePasswordSchema,
  changeEmailSchema,
  insertServerSchema,
  insertTariffSchema,
  insertPromocodeSchema,
  insertSupportTicketSchema,
  updateSupportTicketSchema,
  insertSupportMessageSchema,
  updateSiteSettingSchema,
  updateBotSettingSchema,
} from "@shared/schema";
import {
  handleTelegramUpdate,
  sendTelegramMessage,
  generateLinkCode,
  generate2FACode,
  type TelegramUpdate,
} from "./telegram-bot";

declare module "express-session" {
  interface SessionData {
    userId?: number;
    requires2FA?: boolean;
    pendingUserId?: number;
  }
}

const requireAuth = (req: any, res: any, next: any) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
};

const requireAdmin = (req: any, res: any, next: any) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const user = storage.users.findById(req.session.userId);
  if (!user || user.is_admin !== 1) {
    return res.status(403).json({ message: "Forbidden" });
  }
  next();
};

export function registerRoutes(app: Express): Server {
  app.post("/api/auth/register", async (req, res) => {
    try {
      const validatedData = registerSchema.parse(req.body);
      
      const existingUser = storage.users.findByEmail(validatedData.email);
      if (existingUser) {
        return res.status(400).json({ message: "Email уже используется" });
      }

      const hashedPassword = await bcrypt.hash(validatedData.password, 10);

      const user = storage.users.create({
        email: validatedData.email,
        password: hashedPassword,
        telegram_id: validatedData.telegram_id,
        is_admin: 0,
      });

      const referrerId = req.query.ref ? parseInt(req.query.ref as string) : null;
      if (referrerId) {
        const referrer = storage.users.findById(referrerId);
        if (referrer) {
          const bonusAmount = 50;
          storage.referrals.create({
            referrer_id: referrerId,
            referred_id: user.id,
            bonus_earned: bonusAmount,
          });
          
          storage.users.update(referrerId, {
            referral_balance: (referrer.referral_balance || 0) + bonusAmount,
          });

          storage.transactions.create({
            user_id: referrerId,
            amount: bonusAmount,
            description: `Реферальный бонус за приглашение пользователя #${user.id}`,
          });
        }
      }

      res.json({ message: "Регистрация успешна" });
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Ошибка регистрации" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const validatedData = loginSchema.parse(req.body);

      const user = storage.users.findByEmail(validatedData.email);
      if (!user || !user.password) {
        return res.status(401).json({ message: "Неверный email или пароль" });
      }

      const isValidPassword = await bcrypt.compare(validatedData.password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Неверный email или пароль" });
      }

      if (user.telegram_2fa_enabled === 1 && user.telegram_id) {
        const code = generate2FACode();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

        storage.users.update(user.id, {
          twofactor_challenge_code: code,
          twofactor_challenge_expires_at: expiresAt,
        });

        await sendTelegramMessage(
          user.telegram_id,
          `🔐 <b>Код для входа в ARMT VPN:</b>\n\n` +
          `<code>${code}</code>\n\n` +
          `Код действителен 5 минут.`
        );

        req.session.requires2FA = true;
        req.session.pendingUserId = user.id;

        return res.json({
          requires2FA: true,
          message: "Код отправлен в Telegram",
        });
      }

      req.session.userId = user.id;
      
      // Явно сохраняем сессию для надежности
      req.session.save((err) => {
        if (err) {
          console.error('Session save error:', err);
          return res.status(500).json({ message: "Ошибка сохранения сессии" });
        }
        
        const { password, ...userWithoutPassword } = user;
        res.json({ user: userWithoutPassword });
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Ошибка входа" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Ошибка выхода" });
      }
      res.json({ message: "Выход выполнен" });
    });
  });

  app.get("/api/user/me", requireAuth, (req, res) => {
    const user = storage.users.findById(req.session.userId!);
    if (!user) {
      return res.status(404).json({ message: "Пользователь не найден" });
    }
    const { password, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  });

  app.patch("/api/user/profile", requireAuth, async (req, res) => {
    try {
      let { nickname } = req.body;
      const userId = req.session.userId!;

      if (typeof nickname !== 'string') {
        return res.status(400).json({ message: "Никнейм должен быть строкой" });
      }

      nickname = nickname.trim();

      if (nickname.length < 3) {
        return res.status(400).json({ message: "Никнейм должен содержать минимум 3 символа" });
      }

      if (nickname.length > 20) {
        return res.status(400).json({ message: "Никнейм не должен превышать 20 символов" });
      }

      const existingUser = storage.users.list().find(u => 
        u.nickname === nickname && u.id !== userId
      );
      if (existingUser) {
        return res.status(400).json({ message: "Никнейм уже занят" });
      }

      const updatedUser = storage.users.update(userId, { nickname });
      
      if (!updatedUser) {
        return res.status(404).json({ message: "Пользователь не найден" });
      }

      const { password, ...userWithoutPassword } = updatedUser;
      res.json({
        message: "Профиль успешно обновлен",
        user: userWithoutPassword,
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Ошибка обновления профиля" });
    }
  });

  app.post("/api/user/change-password", requireAuth, async (req, res) => {
    try {
      const validatedData = changePasswordSchema.parse(req.body);
      const userId = req.session.userId!;
      const user = storage.users.findById(userId);

      if (!user || !user.password) {
        return res.status(404).json({ message: "Пользователь не найден" });
      }

      const isValidPassword = await bcrypt.compare(validatedData.current_password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Неверный текущий пароль" });
      }

      const hashedPassword = await bcrypt.hash(validatedData.new_password, 10);
      storage.users.update(userId, { password: hashedPassword });

      res.json({ message: "Пароль успешно изменен" });
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Ошибка смены пароля" });
    }
  });

  app.post("/api/user/change-email", requireAuth, async (req, res) => {
    try {
      const validatedData = changeEmailSchema.parse(req.body);
      const userId = req.session.userId!;
      const user = storage.users.findById(userId);

      if (!user || !user.password) {
        return res.status(404).json({ message: "Пользователь не найден" });
      }

      const isValidPassword = await bcrypt.compare(validatedData.password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Неверный пароль" });
      }

      const existingUser = storage.users.findByEmail(validatedData.new_email);
      if (existingUser) {
        return res.status(400).json({ message: "Email уже используется" });
      }

      storage.users.update(userId, { email: validatedData.new_email });
      res.json({ message: "Email успешно изменен" });
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Ошибка смены email" });
    }
  });

  app.get("/api/vpn/profiles", requireAuth, (req, res) => {
    const profiles = storage.vpnProfiles.findByUserId(req.session.userId!);
    res.json(profiles);
  });

  app.delete("/api/vpn/profiles/:id", requireAuth, (req, res) => {
    const profileId = parseInt(req.params.id);
    const profiles = storage.vpnProfiles.findByUserId(req.session.userId!);
    const profile = profiles.find(p => p.id === profileId);
    
    if (!profile) {
      return res.status(404).json({ message: "Профиль не найден" });
    }

    const success = storage.vpnProfiles.delete(profileId);
    if (success) {
      res.json({ message: "Устройство успешно удалено" });
    } else {
      res.status(500).json({ message: "Не удалось удалить устройство" });
    }
  });

  app.get("/api/referrals", requireAuth, (req, res) => {
    const referrals = storage.referrals.findByReferrerId(req.session.userId!);
    res.json(referrals);
  });

  app.get("/api/transactions", requireAuth, (req, res) => {
    const transactions = storage.transactions.findByUserId(req.session.userId!);
    res.json(transactions);
  });

  app.post("/api/balance/deposit", requireAuth, async (req, res) => {
    try {
      const { amount } = req.body;
      const userId = req.session.userId!;

      if (!amount || amount <= 0) {
        return res.status(400).json({ message: "Укажите корректную сумму пополнения" });
      }

      const user = storage.users.findById(userId);
      if (!user) {
        return res.status(404).json({ message: "Пользователь не найден" });
      }

      const updatedUser = storage.users.update(userId, {
        main_balance: (user.main_balance || 0) + amount,
      });

      storage.transactions.create({
        user_id: userId,
        amount: amount,
        description: `Пополнение баланса`,
      });

      const { password, ...userWithoutPassword } = updatedUser!;
      res.json({ 
        message: "Баланс успешно пополнен",
        user: userWithoutPassword,
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Ошибка пополнения баланса" });
    }
  });

  app.get("/api/admin/stats", requireAdmin, (req, res) => {
    const stats = storage.stats.getStats();
    res.json(stats);
  });

  app.get("/api/admin/users", requireAdmin, (req, res) => {
    const users = storage.users.list().map(u => {
      const { password, ...userWithoutPassword } = u;
      return userWithoutPassword;
    });
    res.json(users);
  });

  app.get("/api/admin/servers", requireAdmin, (req, res) => {
    const servers = storage.servers.list();
    res.json(servers);
  });

  app.post("/api/admin/servers", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertServerSchema.parse(req.body);
      const server = storage.servers.create(validatedData);
      res.json(server);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Ошибка создания сервера" });
    }
  });

  app.patch("/api/admin/servers/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const server = storage.servers.update(id, req.body);
      if (!server) {
        return res.status(404).json({ message: "Сервер не найден" });
      }
      res.json(server);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Ошибка обновления сервера" });
    }
  });

  app.delete("/api/admin/servers/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = storage.servers.delete(id);
      if (!deleted) {
        return res.status(404).json({ message: "Сервер не найден" });
      }
      res.json({ message: "Сервер удален" });
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Ошибка удаления сервера" });
    }
  });

  app.get("/api/tariffs", requireAuth, (req, res) => {
    const tariffs = storage.tariffs.list().filter(t => t.is_active === 1);
    res.json(tariffs);
  });

  app.post("/api/subscription/purchase", requireAuth, async (req, res) => {
    try {
      const { tariffId, promoCode } = req.body;
      
      if (!tariffId) {
        return res.status(400).json({ message: "Не указан тариф" });
      }
      
      const tariff = storage.tariffs.findById(tariffId);
      if (!tariff) {
        return res.status(404).json({ message: "Тариф не найден" });
      }
      
      const user = storage.users.findById(req.session.userId!);
      if (!user) {
        return res.status(404).json({ message: "Пользователь не найден" });
      }
      
      let finalPrice = tariff.price;
      let discountApplied = 0;
      let promoToIncrement: string | null = null;
      
      if (promoCode) {
        const promo = storage.promocodes.findByCode(promoCode.toUpperCase());
        
        if (!promo) {
          return res.status(400).json({ message: "Промокод не найден" });
        }
        
        if (promo.is_active !== 1) {
          return res.status(400).json({ message: "Промокод неактивен" });
        }
        
        if (promo.uses_count >= promo.max_uses) {
          return res.status(400).json({ message: "Промокод исчерпан" });
        }
        
        discountApplied = Math.round(tariff.price * (promo.discount_percent / 100) * 100) / 100;
        finalPrice = tariff.price - discountApplied;
        
        promoToIncrement = promoCode.toUpperCase();
      }
      
      if (user.main_balance < finalPrice) {
        return res.status(400).json({ message: "Недостаточно средств на балансе" });
      }
      
      const newBalance = (user.main_balance || 0) - finalPrice;
      const currentExpires = user.expires_at && new Date(user.expires_at) > new Date() 
        ? new Date(user.expires_at) 
        : new Date();
      
      const newExpires = new Date(currentExpires.getTime() + tariff.days * 24 * 60 * 60 * 1000);
      
      storage.users.update(req.session.userId!, {
        main_balance: newBalance,
        subscription_type: tariff.key,
        expires_at: newExpires.toISOString(),
      });
      
      const description = promoCode 
        ? `Покупка подписки "${tariff.name}" (промокод ${promoCode}, скидка ${discountApplied}₽)`
        : `Покупка подписки "${tariff.name}"`;
      
      storage.transactions.create({
        user_id: req.session.userId!,
        amount: -finalPrice,
        description,
      });
      
      if (promoToIncrement) {
        storage.promocodes.incrementUses(promoToIncrement);
      }
      
      res.json({ 
        message: promoCode 
          ? `Подписка успешно активирована! Скидка ${discountApplied}₽` 
          : "Подписка успешно активирована",
        expires_at: newExpires.toISOString(),
        discount: discountApplied,
        final_price: finalPrice,
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Ошибка покупки подписки" });
    }
  });

  app.get("/api/admin/tariffs", requireAdmin, (req, res) => {
    const tariffs = storage.tariffs.list();
    res.json(tariffs);
  });

  app.post("/api/admin/tariffs", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertTariffSchema.parse(req.body);
      const tariff = storage.tariffs.create(validatedData);
      res.json(tariff);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Ошибка создания тарифа" });
    }
  });

  app.patch("/api/admin/tariffs/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const tariff = storage.tariffs.update(id, req.body);
      if (!tariff) {
        return res.status(404).json({ message: "Тариф не найден" });
      }
      res.json(tariff);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Ошибка обновления тарифа" });
    }
  });

  app.get("/api/admin/promocodes", requireAdmin, (req, res) => {
    const promocodes = storage.promocodes.list();
    res.json(promocodes);
  });

  app.post("/api/admin/promocodes", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertPromocodeSchema.parse(req.body);
      const promocode = storage.promocodes.create(validatedData);
      res.json(promocode);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Ошибка создания промокода" });
    }
  });

  app.patch("/api/admin/promocodes/:code", requireAdmin, async (req, res) => {
    try {
      const code = req.params.code;
      const promocode = storage.promocodes.update(code, req.body);
      if (!promocode) {
        return res.status(404).json({ message: "Промокод не найден" });
      }
      res.json(promocode);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Ошибка обновления промокода" });
    }
  });

  app.patch("/api/admin/users/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const user = storage.users.update(id, req.body);
      if (!user) {
        return res.status(404).json({ message: "Пользователь не найден" });
      }
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Ошибка обновления пользователя" });
    }
  });

  app.get("/api/support-tickets", requireAuth, (req, res) => {
    try {
      const tickets = storage.supportTickets.findByUserId(req.session.userId!);
      res.json(tickets);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Ошибка загрузки тикетов" });
    }
  });

  app.post("/api/support-tickets", requireAuth, async (req, res) => {
    try {
      const validatedData = insertSupportTicketSchema.parse({
        ...req.body,
        user_id: req.session.userId!,
      });
      const ticket = storage.supportTickets.create(validatedData);
      res.json(ticket);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Ошибка создания тикета" });
    }
  });

  app.get("/api/admin/support-tickets", requireAdmin, (req, res) => {
    try {
      const tickets = storage.supportTickets.list();
      res.json(tickets);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Ошибка загрузки тикетов" });
    }
  });

  app.patch("/api/admin/support-tickets/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = updateSupportTicketSchema.parse(req.body);
      const ticket = storage.supportTickets.update(id, validatedData);
      if (!ticket) {
        return res.status(404).json({ message: "Тикет не найден" });
      }
      res.json(ticket);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Ошибка обновления тикета" });
    }
  });

  app.get("/api/support-tickets/:id/messages", requireAuth, (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const ticket = storage.supportTickets.findById(id);
      if (!ticket) {
        return res.status(404).json({ message: "Тикет не найден" });
      }
      if (ticket.user_id !== req.session.userId) {
        const user = storage.users.findById(req.session.userId!);
        if (!user || user.is_admin !== 1) {
          return res.status(403).json({ message: "Доступ запрещен" });
        }
      }
      const messages = storage.supportMessages.findByTicketId(id);
      res.json(messages);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Ошибка загрузки сообщений" });
    }
  });

  app.post("/api/support-tickets/:id/messages", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const ticket = storage.supportTickets.findById(id);
      if (!ticket) {
        return res.status(404).json({ message: "Тикет не найден" });
      }
      
      const user = storage.users.findById(req.session.userId!);
      const isAdmin = user?.is_admin === 1;
      
      if (!isAdmin && ticket.user_id !== req.session.userId) {
        return res.status(403).json({ message: "Доступ запрещен" });
      }
      
      const validatedData = insertSupportMessageSchema.parse({
        ticket_id: id,
        is_admin: isAdmin ? 1 : 0,
        message: req.body.message,
      });
      
      const message = storage.supportMessages.create(validatedData);
      res.json(message);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Ошибка создания сообщения" });
    }
  });

  app.post("/api/telegram/verify-2fa", async (req, res) => {
    try {
      const { code } = req.body;

      if (!req.session.requires2FA || !req.session.pendingUserId) {
        return res.status(400).json({ message: "Сессия 2FA не найдена" });
      }

      const user = storage.users.findById(req.session.pendingUserId);
      if (!user) {
        return res.status(404).json({ message: "Пользователь не найден" });
      }

      if (!user.twofactor_challenge_code || !user.twofactor_challenge_expires_at) {
        return res.status(400).json({ message: "Код не найден" });
      }

      const expiresAt = new Date(user.twofactor_challenge_expires_at);
      if (expiresAt < new Date()) {
        return res.status(400).json({ message: "Код истек" });
      }

      if (code !== user.twofactor_challenge_code) {
        return res.status(401).json({ message: "Неверный код" });
      }

      storage.users.update(user.id, {
        twofactor_challenge_code: null,
        twofactor_challenge_expires_at: null,
      });

      req.session.userId = user.id;
      req.session.requires2FA = undefined;
      req.session.pendingUserId = undefined;

      const { password, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword });
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Ошибка верификации" });
    }
  });

  app.post("/api/telegram/send-code", async (req, res) => {
    try {
      if (!req.session.requires2FA || !req.session.pendingUserId) {
        return res.status(400).json({ message: "Сессия 2FA не найдена" });
      }

      const user = storage.users.findById(req.session.pendingUserId);
      if (!user || !user.telegram_id) {
        return res.status(404).json({ message: "Пользователь не найден" });
      }

      const code = generate2FACode();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

      storage.users.update(user.id, {
        twofactor_challenge_code: code,
        twofactor_challenge_expires_at: expiresAt,
      });

      await sendTelegramMessage(
        user.telegram_id,
        `🔐 <b>Код для входа в ARMT VPN:</b>\n\n` +
        `<code>${code}</code>\n\n` +
        `Код действителен 5 минут.`
      );

      res.json({ message: "Код отправлен в Telegram" });
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Ошибка отправки кода" });
    }
  });

  app.post("/api/telegram/link", requireAuth, async (req, res) => {
    try {
      const { linkCode } = req.body;
      const userId = req.session.userId!;

      if (!linkCode || linkCode.length !== 8) {
        return res.status(400).json({ message: "Неверный формат кода" });
      }

      const user = storage.users.findById(userId);
      if (!user) {
        return res.status(404).json({ message: "Пользователь не найден" });
      }

      const telegramUser = storage.users.list().find(
        u => u.telegram_link_code === linkCode.toUpperCase() && 
             u.telegram_id && 
             u.id !== userId
      );

      if (!telegramUser || !telegramUser.telegram_link_expires_at) {
        return res.status(404).json({ message: "Код не найден или истек" });
      }

      const expiresAt = new Date(telegramUser.telegram_link_expires_at);
      if (expiresAt < new Date()) {
        return res.status(400).json({ message: "Код истек" });
      }

      storage.users.update(userId, {
        telegram_id: telegramUser.telegram_id,
        telegram_username: telegramUser.telegram_username,
        telegram_link_code: null,
        telegram_link_expires_at: null,
      });

      if (telegramUser.email === null && telegramUser.password === null) {
        storage.users.update(telegramUser.id, {
          telegram_link_code: null,
          telegram_link_expires_at: null,
        });
      }

      if (telegramUser.telegram_id) {
        await sendTelegramMessage(
          telegramUser.telegram_id,
          "✅ Ваш аккаунт успешно связан с ARMT VPN!"
        );
      }

      res.json({ message: "Аккаунт успешно связан с Telegram" });
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Ошибка связывания" });
    }
  });

  app.post("/api/telegram/enable-2fa", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const user = storage.users.findById(userId);

      if (!user) {
        return res.status(404).json({ message: "Пользователь не найден" });
      }

      if (!user.telegram_id) {
        return res.status(400).json({ message: "Сначала свяжите аккаунт с Telegram" });
      }

      storage.users.update(userId, {
        telegram_2fa_enabled: 1,
      });

      await sendTelegramMessage(
        user.telegram_id,
        "🔐 Двухфакторная аутентификация включена для вашего аккаунта ARMT VPN."
      );

      res.json({ message: "2FA успешно включена" });
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Ошибка включения 2FA" });
    }
  });

  app.post("/api/telegram/disable-2fa", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const user = storage.users.findById(userId);

      if (!user) {
        return res.status(404).json({ message: "Пользователь не найден" });
      }

      storage.users.update(userId, {
        telegram_2fa_enabled: 0,
      });

      if (user.telegram_id) {
        await sendTelegramMessage(
          user.telegram_id,
          "🔓 Двухфакторная аутентификация отключена для вашего аккаунта ARMT VPN."
        );
      }

      res.json({ message: "2FA успешно отключена" });
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Ошибка отключения 2FA" });
    }
  });

  app.post("/api/telegram/webhook", async (req, res) => {
    try {
      const update: TelegramUpdate = req.body;
      await handleTelegramUpdate(update);
      res.json({ ok: true });
    } catch (error: any) {
      console.error("Webhook error:", error);
      res.status(500).json({ ok: false });
    }
  });

  app.get("/api/admin/settings", requireAdmin, (req, res) => {
    try {
      const settings = storage.settings.getAll();
      res.json(settings);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Ошибка получения настроек" });
    }
  });

  app.put("/api/admin/settings", requireAdmin, (req, res) => {
    try {
      const validatedData = updateSiteSettingSchema.parse(req.body);
      storage.settings.set(validatedData.key, validatedData.value);
      res.json({ message: "Настройка успешно обновлена" });
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Ошибка обновления настройки" });
    }
  });

  app.get("/api/admin/bot-settings", requireAdmin, (req, res) => {
    try {
      const settings = storage.botSettings.getAll();
      res.json(settings);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Ошибка получения настроек бота" });
    }
  });

  app.put("/api/admin/bot-settings", requireAdmin, (req, res) => {
    try {
      const validatedData = updateBotSettingSchema.parse(req.body);
      storage.botSettings.set(validatedData.key, validatedData.value);
      res.json({ message: "Настройка бота успешно обновлена" });
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Ошибка обновления настройки бота" });
    }
  });

  // License routes
  app.use(licenseRoutes);

  const httpServer = createServer(app);
  return httpServer;
}
