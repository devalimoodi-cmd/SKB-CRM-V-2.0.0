// Backend/seed-unit-statuses.js
const { sequelize } = require("./config/database");
require("./models/associations");

const UnitStatus = require("./models/UnitStatus");

const statuses = [
  {
    name: "active",
    description: "فعال",
    color: "#16a34a",
    sort_order: 1,
    active: true,
  },
  {
    name: "inactive",
    description: "غیرفعال",
    color: "#dc2626",
    sort_order: 2,
    active: true,
  },
  {
    name: "under_construction",
    description: "در حال ساخت",
    color: "#f59e0b",
    sort_order: 3,
    active: true,
  },
  {
    name: "closed",
    description: "تعطیل",
    color: "#6b7280",
    sort_order: 4,
    active: true,
  },
  {
    name: "temporary_stop",
    description: "توقف موقت",
    color: "#3b82f6",
    sort_order: 5,
    active: true,
  },
];

async function seed() {
  try {
    await sequelize.authenticate();
    console.log("✅ اتصال به دیتابیس برقرار شد");

    for (const status of statuses) {
      const [record, created] = await UnitStatus.findOrCreate({
        where: { name: status.name },
        defaults: status,
      });
      console.log(
        created
          ? `✅ ایجاد: ${status.description}`
          : `⏭️  قبلاً وجود دارد: ${status.description}`,
      );
    }

    console.log("✅ وضعیت‌های واحد با موفقیت درج شدند");
    process.exit(0);
  } catch (error) {
    console.error("❌ خطا:", error.message);
    process.exit(1);
  }
}

seed();
