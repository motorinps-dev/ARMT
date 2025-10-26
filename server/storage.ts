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

  CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  CREATE INDEX IF NOT EXISTS idx_vpn_profiles_user_id ON vpn_profiles(user_id);
  CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON referrals(referrer_id);
  CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
`);

function addColumnIfNotExists(tableName: string, columnName: string, columnDef: string) {
  try {
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

export interface IStorage {
  users: {
    create(user: InsertUser): User;
    findById(id: number): User | undefined;
    findByEmail(email: string): User | undefined;
    findByTelegramId(telegramId: number): User | undefined;
    update(id: number, data: Partial<User>): User | undefined;
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
};

export default storage;
