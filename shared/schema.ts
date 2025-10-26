import { z } from "zod";

// ============================================
// USER SCHEMAS
// ============================================

export const userSchema = z.object({
  id: z.number(),
  email: z.string().email().nullable(),
  password: z.string().nullable(),
  nickname: z.string().nullable(),
  telegram_id: z.number().nullable(),
  telegram_username: z.string().nullable(),
  telegram_2fa_enabled: z.number().default(0),
  telegram_link_code: z.string().nullable(),
  telegram_link_expires_at: z.string().nullable(),
  twofactor_challenge_code: z.string().nullable(),
  twofactor_challenge_expires_at: z.string().nullable(),
  subscription_type: z.string().nullable(),
  expires_at: z.string().nullable(),
  referrer_id: z.number().nullable(),
  referral_balance: z.number().default(0),
  main_balance: z.number().default(0),
  has_used_trial: z.number().default(0),
  created_at: z.string(),
  is_admin: z.number().default(0),
});

export const insertUserSchema = userSchema.omit({ 
  id: true, 
  created_at: true 
}).partial();

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  telegram_id: z.number().optional(),
});

export type User = z.infer<typeof userSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type LoginData = z.infer<typeof loginSchema>;
export type RegisterData = z.infer<typeof registerSchema>;

// ============================================
// SERVER SCHEMAS
// ============================================

export const serverSchema = z.object({
  id: z.number(),
  name: z.string(),
  panel_url: z.string().url(),
  panel_username: z.string(),
  panel_password: z.string(),
  vless_address: z.string(),
  vless_port: z.number(),
  vless_inbound_id: z.number(),
  vless_sni: z.string(),
  vless_flow: z.string(),
  vless_public_key: z.string(),
  vless_short_id: z.string(),
  is_active: z.number().default(1),
});

export const insertServerSchema = serverSchema.omit({ id: true });

export type Server = z.infer<typeof serverSchema>;
export type InsertServer = z.infer<typeof insertServerSchema>;

// ============================================
// VPN PROFILE SCHEMAS
// ============================================

export const vpnProfileSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  server_id: z.number(),
  config_link: z.string(),
  created_at: z.string(),
});

export const insertVpnProfileSchema = vpnProfileSchema.omit({ 
  id: true, 
  created_at: true 
});

export type VpnProfile = z.infer<typeof vpnProfileSchema>;
export type InsertVpnProfile = z.infer<typeof insertVpnProfileSchema>;

// ============================================
// TARIFF SCHEMAS
// ============================================

export const tariffSchema = z.object({
  id: z.number(),
  key: z.string(),
  name: z.string(),
  price: z.number(),
  days: z.number(),
  gb: z.number(),
  is_active: z.number().default(1),
});

export const insertTariffSchema = tariffSchema.omit({ id: true });

export type Tariff = z.infer<typeof tariffSchema>;
export type InsertTariff = z.infer<typeof insertTariffSchema>;

// ============================================
// PROMOCODE SCHEMAS
// ============================================

export const promocodeSchema = z.object({
  code: z.string(),
  discount_percent: z.number().min(1).max(100),
  max_uses: z.number(),
  uses_count: z.number().default(0),
  is_active: z.number().default(1),
});

export const insertPromocodeSchema = promocodeSchema.omit({ uses_count: true });

export type Promocode = z.infer<typeof promocodeSchema>;
export type InsertPromocode = z.infer<typeof insertPromocodeSchema>;

// ============================================
// TRANSACTION SCHEMAS
// ============================================

export const transactionSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  amount: z.number(),
  description: z.string(),
  created_at: z.string(),
});

export const insertTransactionSchema = transactionSchema.omit({ 
  id: true, 
  created_at: true 
});

export type Transaction = z.infer<typeof transactionSchema>;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;

// ============================================
// REFERRAL SCHEMAS
// ============================================

export const referralSchema = z.object({
  id: z.number(),
  referrer_id: z.number(),
  referred_id: z.number(),
  bonus_earned: z.number().default(0),
  created_at: z.string(),
});

export const insertReferralSchema = referralSchema.omit({ 
  id: true, 
  created_at: true 
});

export type Referral = z.infer<typeof referralSchema>;
export type InsertReferral = z.infer<typeof insertReferralSchema>;

// ============================================
// STATISTICS SCHEMAS
// ============================================

export const statsSchema = z.object({
  total_users: z.number(),
  active_subscriptions: z.number(),
  total_revenue: z.number(),
  active_servers: z.number(),
  new_users_today: z.number(),
  revenue_today: z.number(),
});

export type Stats = z.infer<typeof statsSchema>;

// ============================================
// SITE SETTINGS SCHEMAS
// ============================================

export const siteSettingsSchema = z.object({
  key: z.string(),
  value: z.string(),
  updated_at: z.string(),
});

export const insertSiteSettingsSchema = siteSettingsSchema.omit({ updated_at: true });

export type SiteSettings = z.infer<typeof siteSettingsSchema>;
export type InsertSiteSettings = z.infer<typeof insertSiteSettingsSchema>;

// Available site modes
export const SITE_MODES = {
  DEMO: 'demo',
  MAINTENANCE: 'maintenance',
  PRODUCTION: 'production',
} as const;

export type SiteMode = typeof SITE_MODES[keyof typeof SITE_MODES];

// ============================================
// SUPPORT TICKET SCHEMAS
// ============================================

export const supportTicketSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  subject: z.string(),
  message: z.string(),
  status: z.enum(['open', 'in_progress', 'closed']).default('open'),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  admin_reply: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const insertSupportTicketSchema = supportTicketSchema.omit({ 
  id: true, 
  created_at: true,
  updated_at: true,
  admin_reply: true,
}).extend({
  status: z.enum(['open', 'in_progress', 'closed']).default('open').optional(),
  priority: z.enum(['low', 'medium', 'high']).default('medium').optional(),
});

export type SupportTicket = z.infer<typeof supportTicketSchema>;
export type InsertSupportTicket = z.infer<typeof insertSupportTicketSchema>;
