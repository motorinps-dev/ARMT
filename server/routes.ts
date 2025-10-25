import type { Express } from "express";
import { createServer, type Server } from "http";
import bcrypt from "bcrypt";
import storage from "./storage";
import {
  insertUserSchema,
  loginSchema,
  registerSchema,
  insertServerSchema,
  insertTariffSchema,
  insertPromocodeSchema,
} from "@shared/schema";

declare module "express-session" {
  interface SessionData {
    userId?: number;
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

      req.session.userId = user.id;
      
      const { password, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword });
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

  app.get("/api/vpn/profiles", requireAuth, (req, res) => {
    const profiles = storage.vpnProfiles.findByUserId(req.session.userId!);
    res.json(profiles);
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

  const httpServer = createServer(app);
  return httpServer;
}
