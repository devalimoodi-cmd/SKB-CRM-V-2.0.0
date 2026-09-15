// ------------------------------------------------------------
// تنظیمات sequelize-cli
// از همان فایل .env خودِ بک‌اند استفاده می‌کند تا دو جا تنظیم نکنیم.
// ------------------------------------------------------------
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const base = {
  username: process.env.DB_USER || "postgres",
  password: String(process.env.DB_PASSWORD || "").replace(/"/g, ""),
  database: process.env.DB_NAME || "SKB-CRM",
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 5432),
  dialect: "postgres",
  timezone: "+03:30",
  logging: false,
};

module.exports = {
  development: base,
  test: { ...base, database: process.env.DB_NAME_TEST || base.database },
  production: base,
};
