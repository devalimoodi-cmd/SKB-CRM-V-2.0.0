// ============================================================
// scripts/pg-tools.js
// ابزارهای مشترک کار با pg_dump (برای dump-schema و backup)
// ============================================================
const { execFileSync } = require("node:child_process");
const path = require("node:path");

require("dotenv").config({ path: path.join(__dirname, "..", ".env"), quiet: true });

const PG_DUMP_CANDIDATES = [
  process.env.PG_DUMP_PATH,
  "pg_dump",
  "C:\\Program Files\\PostgreSQL\\18\\bin\\pg_dump.exe",
  "C:\\Program Files\\PostgreSQL\\17\\bin\\pg_dump.exe",
  "C:\\Program Files\\PostgreSQL\\16\\bin\\pg_dump.exe",
  "C:\\Program Files\\PostgreSQL\\15\\bin\\pg_dump.exe",
  "/usr/bin/pg_dump",
  "/usr/local/bin/pg_dump",
  "/opt/homebrew/bin/pg_dump",
].filter(Boolean);

const dbConfig = () => ({
  host: process.env.DB_HOST || "localhost",
  port: String(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || "postgres",
  password: String(process.env.DB_PASSWORD || "").replace(/"/g, ""),
  database: process.env.DB_NAME || "SKB-CRM",
});

// اجرای pg_dump با آرگومان‌های دلخواه؛ اولین مسیرِ موجود که کار کند برگردانده می‌شود
const runPgDump = (extraArgs = []) => {
  const cfg = dbConfig();
  const args = [
    "-h",
    cfg.host,
    "-p",
    cfg.port,
    "-U",
    cfg.user,
    "-d",
    cfg.database,
    ...extraArgs,
  ];

  let lastError = null;
  for (const bin of PG_DUMP_CANDIDATES) {
    try {
      const output = execFileSync(bin, args, {
        env: { ...process.env, PGPASSWORD: cfg.password },
        encoding: "utf8",
        maxBuffer: 512 * 1024 * 1024,
      });
      return { output, bin, args };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("pg_dump پیدا نشد");
};

module.exports = { PG_DUMP_CANDIDATES, dbConfig, runPgDump };
