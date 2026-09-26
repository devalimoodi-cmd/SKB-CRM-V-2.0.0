// ============================================================
// scripts/audit-size.js
// گزارش اندازهٔ فایل‌های بک‌اند (فقط خواندنی — چیزی تغییر نمی‌کند)
// اجرا:  npm run audit:size      (در پوشهٔ Backend)
// ------------------------------------------------------------
// گزینه‌ها:
//   --json            خروجی JSON روی stdout (برای اتوماسیون)
//   --big=<kb>        آستانهٔ «فایل بزرگ» (پیش‌فرض: 40 کیلوبایت)
//   --top=<n>         تعداد فایل‌های بزرگ در گزارش (پیش‌فرض: 15)
//   --fail-on-empty   اگر فایل صفربایتی پیدا شد، با کد ۱ خارج شو
// ------------------------------------------------------------
// چرا؟ فایل صفر‌بایتی نشانهٔ کد مرده/نصفه‌کاره است و فایل بزرگ نشانهٔ
// نقطهٔ داغ نگه‌داری (کاندید شکستن به ماژول‌های کوچک‌تر).
// ============================================================
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const PROJECT_ROOT = path.join(__dirname, "..");
const ROOTS = [
  "controllers",
  "routes",
  "services",
  "utils",
  "middleware",
  "validations",
  "models",
  "scripts",
];
const SKIP_DIRS = new Set(["node_modules", ".git", "uploads", "logs"]);
const TEXT_EXT = new Set([".js", ".mjs", ".json", ".sql"]);

const args = process.argv.slice(2);
const hasFlag = (name) => args.includes(`--${name}`);
const argValue = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  if (!hit) return fallback;
  const value = Number(hit.split("=")[1]);
  return Number.isFinite(value) ? value : fallback;
};

const AS_JSON = hasFlag("json");
const FAIL_ON_EMPTY = hasFlag("fail-on-empty");
const BIG_LIMIT = Math.max(1, argValue("big", 40)) * 1024;
const TOP = Math.max(1, argValue("top", 15));

const formatBytes = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
};

const walk = (dir, acc = []) => {
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(full, acc);
      continue;
    }
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (!TEXT_EXT.has(ext)) continue;
    const rel = path.relative(PROJECT_ROOT, full).replace(/\\/g, "/");
    let bytes = 0;
    try {
      bytes = fs.statSync(full).size;
    } catch {
      bytes = 0;
    }
    acc.push({ file: rel, bytes });
  }
  return acc;
};

const files = ROOTS.flatMap((root) => walk(path.join(PROJECT_ROOT, root)));
files.sort((a, b) => b.bytes - a.bytes);

const emptyFiles = files.filter((f) => f.bytes === 0).map((f) => f.file);
const bigFiles = files.filter((f) => f.bytes >= BIG_LIMIT).slice(0, TOP);
const totalBytes = files.reduce((sum, f) => sum + f.bytes, 0);

const report = {
  root: PROJECT_ROOT.replace(/\\/g, "/"),
  scannedFiles: files.length,
  totalBytes,
  totalHuman: formatBytes(totalBytes),
  bigLimitKB: BIG_LIMIT / 1024,
  emptyCount: emptyFiles.length,
  emptyFiles,
  bigFiles: bigFiles.map((f) => ({
    file: f.file,
    bytes: f.bytes,
    human: formatBytes(f.bytes),
  })),
};

if (AS_JSON) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log("📦 گزارش اندازهٔ بک‌اند");
  console.log(`   فایل‌های اسکن‌شده: ${report.scannedFiles}`);
  console.log(`   حجم کل: ${report.totalHuman}`);
  console.log("");
  console.log(`🚫 فایل‌های صفر‌بایتی (${emptyFiles.length}):`);
  if (emptyFiles.length === 0) {
    console.log("   ✅ هیچ فایل صفر‌بایتی وجود ندارد");
  } else {
    emptyFiles.forEach((file) => console.log(`   - ${file}`));
  }
  console.log("");
  console.log(`🐘 فایل‌های بزرگ (≥ ${BIG_LIMIT / 1024} KB) — ${bigFiles.length} مورد:`);
  if (bigFiles.length === 0) {
    console.log("   ✅ فایل بزرگی در محدودهٔ آستانه نیست");
  } else {
    bigFiles.forEach((f) =>
      console.log(`   - ${formatBytes(f.bytes).padStart(10)}  ${f.file}`),
    );
  }
}

if (FAIL_ON_EMPTY && emptyFiles.length > 0) {
  console.error(`\n❌ ${emptyFiles.length} فایل صفر‌بایتی پیدا شد.`);
  process.exitCode = 1;
}
