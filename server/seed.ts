import bcrypt from "bcrypt";
import storage from "./storage";

async function seed() {
  console.log("Seeding database...");

  try {
    const ownerEmail = "owner@armt.su";
    const oldOwnerEmail = "owner@armt.ru";
    
    const existingNewOwner = storage.users.findByEmail(ownerEmail);
    const existingOldOwner = storage.users.findByEmail(oldOwnerEmail);
    
    if (existingOldOwner && existingNewOwner) {
      storage.users.delete(existingOldOwner.id);
      console.log(`✓ Removed legacy owner account: ${oldOwnerEmail}`);
    } else if (existingOldOwner && !existingNewOwner) {
      storage.users.update(existingOldOwner.id, { email: ownerEmail });
      console.log(`✓ Migrated owner admin user: ${oldOwnerEmail} → ${ownerEmail}`);
    } else if (!existingNewOwner) {
      const hashedPassword = await bcrypt.hash("owner123", 10);
      storage.users.create({
        email: ownerEmail,
        password: hashedPassword,
        is_admin: 1,
      });
      console.log(`✓ Created owner admin user: ${ownerEmail} / owner123`);
    } else {
      console.log("✓ Owner admin user already exists");
    }

    const adminEmail = "admin@armt.su";
    const oldAdminEmail = "admin@armt.vpn";
    
    const existingNewAdmin = storage.users.findByEmail(adminEmail);
    const existingOldAdmin = storage.users.findByEmail(oldAdminEmail);
    
    if (existingOldAdmin && existingNewAdmin) {
      storage.users.delete(existingOldAdmin.id);
      console.log(`✓ Removed legacy admin account: ${oldAdminEmail}`);
    } else if (existingOldAdmin && !existingNewAdmin) {
      storage.users.update(existingOldAdmin.id, { email: adminEmail });
      console.log(`✓ Migrated admin user: ${oldAdminEmail} → ${adminEmail}`);
    } else if (!existingNewAdmin) {
      const hashedPassword = await bcrypt.hash("admin123", 10);
      storage.users.create({
        email: adminEmail,
        password: hashedPassword,
        is_admin: 1,
      });
      console.log(`✓ Created admin user: ${adminEmail} / admin123`);
    } else {
      console.log("✓ Admin user already exists");
    }

    const tariffs = [
      { key: "1_month", name: "1 Месяц", price: 130, days: 30, gb: 1000, is_active: 1 },
      { key: "3_months", name: "3 Месяца", price: 390, days: 90, gb: 3000, is_active: 1 },
      { key: "12_months", name: "1 Год", price: 1000, days: 365, gb: 12000, is_active: 1 },
    ];

    for (const tariff of tariffs) {
      const existing = storage.tariffs.findByKey(tariff.key);
      if (!existing) {
        storage.tariffs.create(tariff);
        console.log(`✓ Created tariff: ${tariff.name}`);
      }
    }

    const promo = storage.promocodes.findByCode("WELCOME2025");
    if (!promo) {
      storage.promocodes.create({
        code: "WELCOME2025",
        discount_percent: 20,
        max_uses: 100,
        is_active: 1,
      });
      console.log("✓ Created welcome promocode: WELCOME2025");
    }

    console.log("\n✅ Database seeded successfully!");
    console.log("\n📝 Admin credentials:");
    console.log("   Owner: owner@armt.su / owner123");
    console.log("   Admin: admin@armt.su / admin123");
  } catch (error) {
    console.error("❌ Error seeding database:", error);
  }
}

seed();
