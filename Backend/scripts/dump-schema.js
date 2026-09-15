// ============================================================
// scripts/dump-schema.js
// گرفتن اسنپ‌شات ساختار دیتابیس (بدون داده) با pg_dump
// اجرا: npm run db:schema
// ============================================================
const fs = require("node:fs");
const path = require("node:path");
const { runPgDump } = require("./pg-tools");

const outDir = path.join(__dirname, "..", "db");
const stamp = new Date().toISOString().slice(0, 10);
const outFile = path.join(outDir, `schema-${stamp}.sql`);

fs.mkdirSync(outDir, { recursive: true });

let result;
try {
  result = runPgDump(["--schema-only", "--no-owner", "--no-privileges"]);
} catch (error) {
  console.error(
    "❌ pg_dump پیدا نشد یا اجرا نشد. مسیر آن را در .env با PG_DUMP_PATH ست کنید.",
  );
  console.error("   جزئیات:", error.message);
  process.exit(1);
}

fs.writeFileSync(outFile, result.output, "utf8");

console.log(`✅ pg_dump: ${result.bin}`);
console.log(`✅ اسنپ‌شات ساخته شد: ${outFile}`);
console.log(`   حجم: ${(result.output.length / 1024).toFixed(1)} کیلوبایت`);
