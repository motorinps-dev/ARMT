import Database from "better-sqlite3";
import type {
  User,
  InsertUser,
  Server,
  InsertServer,
  Tariff,
  InsertTariff,
  Promocode,
  InsertPromocode,
  VpnProfile,
  InsertVpnProfile,
  Referral,
  InsertReferral,
  Transaction,
  InsertTransaction,
  Stats,
  SiteSettings,
  InsertSiteSettings,
  SupportTicket,
  InsertSupportTicket,
  SupportMessage,
  InsertSupportMessage,
  BotSettings,
  InsertBotSettings,
  License,
  InsertLicense,
} from "@shared/schema";

const db = new Database("vpn_platform.db");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    password TEXT,
    nickname TEXT,
    telegram_id INTEGER UNIQUE,
    telegram_username TEXT,
    telegram_2fa_enabled INTEGER DEFAULT 0,
    telegram_link_code TEXT,
    telegram_link_expires_at TEXT,
    twofactor_challenge_code TEXT,
    twofactor_challenge_expires_at TEXT,
    main_balance REAL DEFAULT 0,
    referral_balance REAL DEFAULT 0,
    subscription_type TEXT,
    expires_at TEXT,
    has_used_trial INTEGER DEFAULT 0,
    referrer_id INTEGER,
    is_admin INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS servers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    panel_url TEXT NOT NULL,
    panel_username TEXT NOT NULL,
    panel_password TEXT NOT NULL,
    vless_address TEXT NOT NULL,
    vless_port INTEGER NOT NULL,
    vless_inbound_id INTEGER NOT NULL,
    vless_sni TEXT NOT NULL,
    vless_flow TEXT NOT NULL,
    vless_public_key TEXT NOT NULL,
    vless_short_id TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS tariffs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    days INTEGER NOT NULL,
    gb INTEGER NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS promocodes (
    code TEXT PRIMARY KEY,
    discount_percent INTEGER NOT NULL,
    max_uses INTEGER NOT NULL,
    uses_count INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS vpn_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    server_id INTEGER NOT NULL,
    config_link TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (server_id) REFERENCES servers(id)
  );

  CREATE TABLE IF NOT EXISTS referrals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    referrer_id INTEGER NOT NULL,
    referred_id INTEGER NOT NULL,
    bonus_earned REAL DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (referrer_id) REFERENCES users(id),
    FOREIGN KEY (referred_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    description TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS site_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS support_tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    subject TEXT NOT NULL,
    status TEXT DEFAULT 'open',
    priority TEXT DEFAULT 'medium',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS support_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    is_admin INTEGER NOT NULL DEFAULT 0,
    message TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS bot_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS licenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    license_key TEXT UNIQUE NOT NULL,
    user_id INTEGER NOT NULL,
    machine_id TEXT,
    activation_date TEXT,
    expiration_date TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    max_activations INTEGER DEFAULT 1,
    current_activations INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  CREATE INDEX IF NOT EXISTS idx_vpn_profiles_user_id ON vpn_profiles(user_id);
  CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON referrals(referrer_id);
  CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
  CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON support_tickets(user_id);
  CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
  CREATE INDEX IF NOT EXISTS idx_support_messages_ticket_id ON support_messages(ticket_id);
  CREATE INDEX IF NOT EXISTS idx_licenses_license_key ON licenses(license_key);
  CREATE INDEX IF NOT EXISTS idx_licenses_user_id ON licenses(user_id);
  CREATE INDEX IF NOT EXISTS idx_licenses_machine_id ON licenses(machine_id);
`);

function addColumnIfNotExists(tableName: string, columnName: string, columnDef: string) {
  try {
    const allowedTables = ['users', 'servers', 'tariffs', 'promocodes', 'vpn_profiles', 'referrals', 'transactions', 'site_settings', 'support_tickets'];
    const allowedColumns = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
    
    if (!allowedTables.includes(tableName)) {
      throw new Error(`Invalid table name: ${tableName}`);
    }
    
    if (!allowedColumns.test(columnName)) {
      throw new Error(`Invalid column name: ${columnName}`);
    }
    
    const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as any[];
    const columnExists = columns.some((col: any) => col.name === columnName);
    if (!columnExists) {
      db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`);
      console.log(`Added column ${columnName} to ${tableName}`);
    }
  } catch (error) {
    console.error(`Error adding column ${columnName} to ${tableName}:`, error);
  }
}

addColumnIfNotExists('users', 'nickname', 'TEXT');
addColumnIfNotExists('users', 'telegram_2fa_enabled', 'INTEGER DEFAULT 0');
addColumnIfNotExists('users', 'telegram_link_code', 'TEXT');
addColumnIfNotExists('users', 'telegram_link_expires_at', 'TEXT');
addColumnIfNotExists('users', 'twofactor_challenge_code', 'TEXT');
addColumnIfNotExists('users', 'twofactor_challenge_expires_at', 'TEXT');
addColumnIfNotExists('users', 'has_used_trial', 'INTEGER DEFAULT 0');
addColumnIfNotExists('users', 'referrer_id', 'INTEGER');

const defaultSettings = db.prepare("SELECT COUNT(*) as count FROM site_settings").get() as { count: number };
if (defaultSettings.count === 0) {
  db.prepare("INSERT INTO site_settings (key, value) VALUES (?, ?)").run('site_mode', 'demo');
  db.prepare("INSERT INTO site_settings (key, value) VALUES (?, ?)").run('profiles_per_purchase', '5');
  console.log("Default site settings initialized");
}

const defaultBotSettings = db.prepare("SELECT COUNT(*) as count FROM bot_settings").get() as { count: number };
if (defaultBotSettings.count === 0) {
  db.prepare("INSERT INTO bot_settings (key, value) VALUES (?, ?)").run('bot_token', '');
  db.prepare("INSERT INTO bot_settings (key, value) VALUES (?, ?)").run('admin_ids', '');
  db.prepare("INSERT INTO bot_settings (key, value) VALUES (?, ?)").run('group_id', '');
  db.prepare("INSERT INTO bot_settings (key, value) VALUES (?, ?)").run('crypto_bot_token', '');
  db.prepare("INSERT INTO bot_settings (key, value) VALUES (?, ?)").run('min_rub_deposit', '130');
  db.prepare("INSERT INTO bot_settings (key, value) VALUES (?, ?)").run('referral_bonus_percent', '10');
  db.prepare("INSERT INTO bot_settings (key, value) VALUES (?, ?)").run('trial_days', '1');
  db.prepare("INSERT INTO bot_settings (key, value) VALUES (?, ?)").run('trial_gb', '1');
  db.prepare("INSERT INTO bot_settings (key, value) VALUES (?, ?)").run('webhook_url', '');
  db.prepare("INSERT INTO bot_settings (key, value) VALUES (?, ?)").run('bot_mode', 'active');
  console.log("Default bot settings initialized");
}

export interface IStorage {
  users: {
    create(user: InsertUser): User;
    findById(id: number): User | undefined;
    findByEmail(email: string): User | undefined;
    findByTelegramId(telegramId: number): User | undefined;
    findByNickname(nickname: string): User | undefined;
    update(id: number, data: Partial<User>): User | undefined;
    delete(id: number): boolean;
    list(): User[];
  };
  servers: {
    create(server: InsertServer): Server;
    findById(id: number): Server | undefined;
    list(): Server[];
    update(id: number, data: Partial<Server>): Server | undefined;
    delete(id: number): boolean;
  };
  tariffs: {
    create(tariff: InsertTariff): Tariff;
    findById(id: number): Tariff | undefined;
    findByKey(key: string): Tariff | undefined;
    list(): Tariff[];
    update(id: number, data: Partial<Tariff>): Tariff | undefined;
  };
  promocodes: {
    create(promo: InsertPromocode): Promocode;
    findByCode(code: string): Promocode | undefined;
    list(): Promocode[];
    incrementUses(code: string): boolean;
    update(code: string, data: Partial<Promocode>): Promocode | undefined;
  };
  vpnProfiles: {
    create(profile: InsertVpnProfile): VpnProfile;
    findByUserId(userId: number): VpnProfile[];
    delete(id: number): boolean;
  };
  referrals: {
    create(referral: InsertReferral): Referral;
    findByReferrerId(referrerId: number): Referral[];
  };
  transactions: {
    create(transaction: InsertTransaction): Transaction;
    findByUserId(userId: number): Transaction[];
  };
  stats: {
    getStats(): Stats;
  };
  settings: {
    get(key: string): string | undefined;
    set(key: string, value: string): void;
    getAll(): Record<string, string>;
  };
  supportTickets: {
    create(ticket: InsertSupportTicket): SupportTicket;
    findById(id: number): SupportTicket | undefined;
    findByUserId(userId: number): SupportTicket[];
    list(): SupportTicket[];
    update(id: number, data: Partial<SupportTicket>): SupportTicket | undefined;
  };
  supportMessages: {
    create(message: InsertSupportMessage): SupportMessage;
    findByTicketId(ticketId: number): SupportMessage[];
    list(): SupportMessage[];
  };
  botSettings: {
    get(key: string): string | undefined;
    set(key: string, value: string): void;
    getAll(): Record<string, string>;
  };
  licenses: {
    create(license: InsertLicense): License;
    findById(id: number): License | undefined;
    findByKey(key: string): License | undefined;
    findByUserId(userId: number): License[];
    list(): License[];
    activate(key: string, machineId: string): License | undefined;
    update(id: number, data: Partial<License>): License | undefined;
  };
}

const storage: IStorage = {
  users: {
    create(user: InsertUser): User {
      const stmt = db.prepare(`
        INSERT INTO users (email, password, telegram_id, telegram_username, is_admin)
        VALUES (@email, @password, @telegram_id, @telegram_username, @is_admin)
      `);
      const result = stmt.run({
        email: user.email || null,
        password: user.password || null,
        telegram_id: user.telegram_id || null,
        telegram_username: user.telegram_username || null,
        is_admin: user.is_admin || 0,
      });
      return storage.users.findById(result.lastInsertRowid as number)!;
    },

    findById(id: number): User | undefined {
      const stmt = db.prepare("SELECT * FROM users WHERE id = ?");
      return stmt.get(id) as User | undefined;
    },

    findByEmail(email: string): User | undefined {
      const stmt = db.prepare("SELECT * FROM users WHERE email = ?");
      return stmt.get(email) as User | undefined;
    },

    findByTelegramId(telegramId: number): User | undefined {
      const stmt = db.prepare("SELECT * FROM users WHERE telegram_id = ?");
      return stmt.get(telegramId) as User | undefined;
    },

    findByNickname(nickname: string): User | undefined {
      const stmt = db.prepare("SELECT * FROM users WHERE nickname = ?");
      return stmt.get(nickname) as User | undefined;
    },

    update(id: number, data: Partial<User>): User | undefined {
      const fields = Object.keys(data)
        .filter(key => data[key as keyof User] !== undefined)
        .map(key => `${key} = @${key}`)
        .join(", ");
      
      if (!fields) return storage.users.findById(id);

      const stmt = db.prepare(`UPDATE users SET ${fields} WHERE id = @id`);
      stmt.run({ ...data, id });
      return storage.users.findById(id);
    },

    delete(id: number): boolean {
      const stmt = db.prepare("DELETE FROM users WHERE id = ?");
      const result = stmt.run(id);
      return result.changes > 0;
    },

    list(): User[] {
      const stmt = db.prepare("SELECT * FROM users ORDER BY created_at DESC");
      return stmt.all() as User[];
    },
  },

  servers: {
    create(server: InsertServer): Server {
      const stmt = db.prepare(`
        INSERT INTO servers (
          name, panel_url, panel_username, panel_password,
          vless_address, vless_port, vless_inbound_id, vless_sni,
          vless_flow, vless_public_key, vless_short_id
        ) VALUES (
          @name, @panel_url, @panel_username, @panel_password,
          @vless_address, @vless_port, @vless_inbound_id, @vless_sni,
          @vless_flow, @vless_public_key, @vless_short_id
        )
      `);
      const result = stmt.run(server);
      return storage.servers.findById(result.lastInsertRowid as number)!;
    },

    findById(id: number): Server | undefined {
      const stmt = db.prepare("SELECT * FROM servers WHERE id = ?");
      return stmt.get(id) as Server | undefined;
    },

    list(): Server[] {
      const stmt = db.prepare("SELECT * FROM servers ORDER BY created_at DESC");
      return stmt.all() as Server[];
    },

    update(id: number, data: Partial<Server>): Server | undefined {
      const fields = Object.keys(data)
        .filter(key => data[key as keyof Server] !== undefined)
        .map(key => `${key} = @${key}`)
        .join(", ");
      
      if (!fields) return storage.servers.findById(id);

      const stmt = db.prepare(`UPDATE servers SET ${fields} WHERE id = @id`);
      stmt.run({ ...data, id });
      return storage.servers.findById(id);
    },

    delete(id: number): boolean {
      const stmt = db.prepare("DELETE FROM servers WHERE id = ?");
      const result = stmt.run(id);
      return result.changes > 0;
    },
  },

  tariffs: {
    create(tariff: InsertTariff): Tariff {
      const stmt = db.prepare(`
        INSERT INTO tariffs (key, name, price, days, gb)
        VALUES (@key, @name, @price, @days, @gb)
      `);
      const result = stmt.run(tariff);
      return storage.tariffs.findByKey(tariff.key)!;
    },

    findById(id: number): Tariff | undefined {
      const stmt = db.prepare("SELECT * FROM tariffs WHERE id = ?");
      return stmt.get(id) as Tariff | undefined;
    },

    findByKey(key: string): Tariff | undefined {
      const stmt = db.prepare("SELECT * FROM tariffs WHERE key = ?");
      return stmt.get(key) as Tariff | undefined;
    },

    list(): Tariff[] {
      const stmt = db.prepare("SELECT * FROM tariffs ORDER BY price");
      return stmt.all() as Tariff[];
    },

    update(id: number, data: Partial<Tariff>): Tariff | undefined {
      const fields = Object.keys(data)
        .filter(key => data[key as keyof Tariff] !== undefined)
        .map(key => `${key} = @${key}`)
        .join(", ");
      
      if (!fields) {
        const stmt = db.prepare("SELECT * FROM tariffs WHERE id = ?");
        return stmt.get(id) as Tariff | undefined;
      }

      const stmt = db.prepare(`UPDATE tariffs SET ${fields} WHERE id = @id`);
      stmt.run({ ...data, id });
      
      const getStmt = db.prepare("SELECT * FROM tariffs WHERE id = ?");
      return getStmt.get(id) as Tariff | undefined;
    },
  },

  promocodes: {
    create(promo: InsertPromocode): Promocode {
      const stmt = db.prepare(`
        INSERT INTO promocodes (code, discount_percent, max_uses)
        VALUES (@code, @discount_percent, @max_uses)
      `);
      stmt.run(promo);
      return storage.promocodes.findByCode(promo.code)!;
    },

    findByCode(code: string): Promocode | undefined {
      const stmt = db.prepare("SELECT * FROM promocodes WHERE code = ?");
      return stmt.get(code) as Promocode | undefined;
    },

    list(): Promocode[] {
      const stmt = db.prepare("SELECT * FROM promocodes ORDER BY created_at DESC");
      return stmt.all() as Promocode[];
    },

    incrementUses(code: string): boolean {
      const stmt = db.prepare("UPDATE promocodes SET uses_count = uses_count + 1 WHERE code = ?");
      const result = stmt.run(code);
      return result.changes > 0;
    },

    update(code: string, data: Partial<Promocode>): Promocode | undefined {
      const fields = Object.keys(data)
        .filter(key => data[key as keyof Promocode] !== undefined)
        .map(key => `${key} = @${key}`)
        .join(", ");
      
      if (!fields) return storage.promocodes.findByCode(code);

      const stmt = db.prepare(`UPDATE promocodes SET ${fields} WHERE code = @code`);
      stmt.run({ ...data, code });
      return storage.promocodes.findByCode(code);
    },
  },

  vpnProfiles: {
    create(profile: InsertVpnProfile): VpnProfile {
      const stmt = db.prepare(`
        INSERT INTO vpn_profiles (user_id, server_id, config_link)
        VALUES (@user_id, @server_id, @config_link)
      `);
      const result = stmt.run(profile);
      const getStmt = db.prepare("SELECT * FROM vpn_profiles WHERE id = ?");
      return getStmt.get(result.lastInsertRowid) as VpnProfile;
    },

    findByUserId(userId: number): VpnProfile[] {
      const stmt = db.prepare("SELECT * FROM vpn_profiles WHERE user_id = ? ORDER BY created_at DESC");
      return stmt.all(userId) as VpnProfile[];
    },

    delete(id: number): boolean {
      const stmt = db.prepare("DELETE FROM vpn_profiles WHERE id = ?");
      const result = stmt.run(id);
      return result.changes > 0;
    },
  },

  referrals: {
    create(referral: InsertReferral): Referral {
      const stmt = db.prepare(`
        INSERT INTO referrals (referrer_id, referred_id, bonus_earned)
        VALUES (@referrer_id, @referred_id, @bonus_earned)
      `);
      const result = stmt.run(referral);
      const getStmt = db.prepare("SELECT * FROM referrals WHERE id = ?");
      return getStmt.get(result.lastInsertRowid) as Referral;
    },

    findByReferrerId(referrerId: number): Referral[] {
      const stmt = db.prepare("SELECT * FROM referrals WHERE referrer_id = ? ORDER BY created_at DESC");
      return stmt.all(referrerId) as Referral[];
    },
  },

  transactions: {
    create(transaction: InsertTransaction): Transaction {
      const stmt = db.prepare(`
        INSERT INTO transactions (user_id, amount, description)
        VALUES (@user_id, @amount, @description)
      `);
      const result = stmt.run(transaction);
      const getStmt = db.prepare("SELECT * FROM transactions WHERE id = ?");
      return getStmt.get(result.lastInsertRowid) as Transaction;
    },

    findByUserId(userId: number): Transaction[] {
      const stmt = db.prepare("SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50");
      return stmt.all(userId) as Transaction[];
    },
  },

  stats: {
    getStats(): Stats {
      const totalUsers = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
      const activeSubscriptions = db.prepare("SELECT COUNT(*) as count FROM users WHERE expires_at > datetime('now')").get() as { count: number };
      const totalRevenue = db.prepare("SELECT COALESCE(SUM(amount), 0) as sum FROM transactions WHERE amount > 0").get() as { sum: number };
      const activeServers = db.prepare("SELECT COUNT(*) as count FROM servers WHERE is_active = 1").get() as { count: number };
      
      const newUsersToday = db.prepare("SELECT COUNT(*) as count FROM users WHERE DATE(created_at) = DATE('now')").get() as { count: number };
      const revenueToday = db.prepare("SELECT COALESCE(SUM(amount), 0) as sum FROM transactions WHERE DATE(created_at) = DATE('now') AND amount > 0").get() as { sum: number };

      return {
        total_users: totalUsers.count,
        active_subscriptions: activeSubscriptions.count,
        total_revenue: totalRevenue.sum,
        active_servers: activeServers.count,
        new_users_today: newUsersToday.count,
        revenue_today: revenueToday.sum,
      };
    },
  },

  settings: {
    get(key: string): string | undefined {
      const stmt = db.prepare("SELECT value FROM site_settings WHERE key = ?");
      const result = stmt.get(key) as { value: string } | undefined;
      return result?.value;
    },

    set(key: string, value: string): void {
      const stmt = db.prepare("INSERT OR REPLACE INTO site_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))");
      stmt.run(key, value);
    },

    getAll(): Record<string, string> {
      const stmt = db.prepare("SELECT key, value FROM site_settings");
      const rows = stmt.all() as { key: string; value: string }[];
      return rows.reduce((acc, row) => {
        acc[row.key] = row.value;
        return acc;
      }, {} as Record<string, string>);
    },
  },

  supportTickets: {
    create(ticket: InsertSupportTicket): SupportTicket {
      const stmt = db.prepare(`
        INSERT INTO support_tickets (user_id, subject, status, priority)
        VALUES (@user_id, @subject, @status, @priority)
      `);
      const result = stmt.run({
        user_id: ticket.user_id,
        subject: ticket.subject,
        status: ticket.status || 'open',
        priority: ticket.priority || 'medium',
      });
      
      const ticketId = result.lastInsertRowid as number;
      
      if ((ticket as any).message) {
        storage.supportMessages.create({
          ticket_id: ticketId,
          is_admin: 0,
          message: (ticket as any).message,
        });
      }
      
      return storage.supportTickets.findById(ticketId)!;
    },

    findById(id: number): SupportTicket | undefined {
      const stmt = db.prepare("SELECT * FROM support_tickets WHERE id = ?");
      return stmt.get(id) as SupportTicket | undefined;
    },

    findByUserId(userId: number): SupportTicket[] {
      const stmt = db.prepare("SELECT * FROM support_tickets WHERE user_id = ? ORDER BY created_at DESC");
      return stmt.all(userId) as SupportTicket[];
    },

    list(): SupportTicket[] {
      const stmt = db.prepare("SELECT * FROM support_tickets ORDER BY created_at DESC");
      return stmt.all() as SupportTicket[];
    },

    update(id: number, data: Partial<SupportTicket>): SupportTicket | undefined {
      const updates: string[] = [];
      const values: any = {};

      if (data.subject !== undefined) {
        updates.push("subject = @subject");
        values.subject = data.subject;
      }
      if (data.status !== undefined) {
        updates.push("status = @status");
        values.status = data.status;
      }
      if (data.priority !== undefined) {
        updates.push("priority = @priority");
        values.priority = data.priority;
      }

      if (updates.length === 0) {
        return storage.supportTickets.findById(id);
      }

      updates.push("updated_at = datetime('now')");
      values.id = id;

      const stmt = db.prepare(`UPDATE support_tickets SET ${updates.join(", ")} WHERE id = @id`);
      stmt.run(values);

      return storage.supportTickets.findById(id);
    },
  },

  supportMessages: {
    create(message: InsertSupportMessage): SupportMessage {
      const stmt = db.prepare(`
        INSERT INTO support_messages (ticket_id, is_admin, message)
        VALUES (@ticket_id, @is_admin, @message)
      `);
      const result = stmt.run({
        ticket_id: message.ticket_id,
        is_admin: message.is_admin,
        message: message.message,
      });
      const stmt2 = db.prepare("SELECT * FROM support_messages WHERE id = ?");
      return stmt2.get(result.lastInsertRowid) as SupportMessage;
    },

    findByTicketId(ticketId: number): SupportMessage[] {
      const stmt = db.prepare("SELECT * FROM support_messages WHERE ticket_id = ? ORDER BY created_at ASC");
      return stmt.all(ticketId) as SupportMessage[];
    },

    list(): SupportMessage[] {
      const stmt = db.prepare("SELECT * FROM support_messages ORDER BY created_at DESC");
      return stmt.all() as SupportMessage[];
    },
  },

  botSettings: {
    get(key: string): string | undefined {
      const stmt = db.prepare("SELECT value FROM bot_settings WHERE key = ?");
      const result = stmt.get(key) as { value: string } | undefined;
      return result?.value;
    },

    set(key: string, value: string): void {
      const stmt = db.prepare(`
        INSERT INTO bot_settings (key, value, updated_at) 
        VALUES (?, ?, datetime('now'))
        ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now')
      `);
      stmt.run(key, value, value);
    },

    getAll(): Record<string, string> {
      const stmt = db.prepare("SELECT key, value FROM bot_settings");
      const rows = stmt.all() as { key: string; value: string }[];
      return Object.fromEntries(rows.map(row => [row.key, row.value]));
    },
  },

  licenses: {
    create(license: InsertLicense): License {
      const stmt = db.prepare(`
        INSERT INTO licenses (license_key, user_id, expiration_date, is_active, max_activations)
        VALUES (@license_key, @user_id, @expiration_date, @is_active, @max_activations)
      `);
      const result = stmt.run({
        license_key: license.license_key,
        user_id: license.user_id,
        expiration_date: license.expiration_date,
        is_active: license.is_active ?? 1,
        max_activations: license.max_activations ?? 1,
      });
      const stmt2 = db.prepare("SELECT * FROM licenses WHERE id = ?");
      return stmt2.get(result.lastInsertRowid) as License;
    },

    findById(id: number): License | undefined {
      const stmt = db.prepare("SELECT * FROM licenses WHERE id = ?");
      return stmt.get(id) as License | undefined;
    },

    findByKey(key: string): License | undefined {
      const stmt = db.prepare("SELECT * FROM licenses WHERE license_key = ?");
      return stmt.get(key) as License | undefined;
    },

    findByUserId(userId: number): License[] {
      const stmt = db.prepare("SELECT * FROM licenses WHERE user_id = ? ORDER BY created_at DESC");
      return stmt.all(userId) as License[];
    },

    list(): License[] {
      const stmt = db.prepare("SELECT * FROM licenses ORDER BY created_at DESC");
      return stmt.all() as License[];
    },

    activate(key: string, machineId: string): License | undefined {
      const license = this.findByKey(key);
      if (!license) return undefined;

      const stmt = db.prepare(`
        UPDATE licenses 
        SET machine_id = ?, 
            activation_date = datetime('now'),
            current_activations = current_activations + 1
        WHERE license_key = ? AND machine_id IS NULL
      `);
      stmt.run(machineId, key);

      return this.findByKey(key);
    },

    update(id: number, data: Partial<License>): License | undefined {
      const license = this.findById(id);
      if (!license) return undefined;

      const updateFields: string[] = [];
      const values: any = {};

      if (data.is_active !== undefined) {
        updateFields.push("is_active = @is_active");
        values.is_active = data.is_active;
      }
      if (data.max_activations !== undefined) {
        updateFields.push("max_activations = @max_activations");
        values.max_activations = data.max_activations;
      }
      if (data.expiration_date !== undefined) {
        updateFields.push("expiration_date = @expiration_date");
        values.expiration_date = data.expiration_date;
      }
      if (data.machine_id !== undefined) {
        updateFields.push("machine_id = @machine_id");
        values.machine_id = data.machine_id;
      }

      if (updateFields.length === 0) return license;

      values.id = id;
      const stmt = db.prepare(`UPDATE licenses SET ${updateFields.join(", ")} WHERE id = @id`);
      stmt.run(values);

      return this.findById(id);
    },
  },
};

export default storage;
