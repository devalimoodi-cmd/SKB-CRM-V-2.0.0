// ============================================================
// scripts/backup.js
// بکاپ کامل: دیتابیس (pg_dump -Fc) + فایل‌های uploads
// اجرا: npm run backup   (یا backup.bat / Task Scheduler)
// ------------------------------------------------------------
// تنظیمات:
//   BACKUP_DIR      → مسیر پوشهٔ بکاپ (پیش‌فرض: <ریشهٔ پروژه>\backups)
//   BACKUP_KEEP     → تعداد نسخه‌های نگه‌داشته‌شده (پیش‌فرض: 7)
//   BACKUP_COPY_TO  → (اختیاری ولی مهم) مسیر دیسک دوم/شبکه برای کپی بکاپ
//                     اگر تنظیم شود، هر بکاپ بعد از ساخت به آنجا هم کپی و
//                     صحت کپی بررسی می‌شود (اگر بکاپ فقط روی همان دیسک باشد،
//                     خرابی دیسک = از دست رفتن هم دیتابیس و هم بکاپ‌ها).
// ============================================================
const fs = require("node:fs");
const path = require("node:path");
const { dbConfig, runPgDump } = require("./pg-tools");

const ROOT = path.join(__dirname, "..", "..");
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(ROOT, "backups");
const KEEP = Math.max(1, Number(process.env.BACKUP_KEEP || 7));

const stamp = new Date()
  .toISOString()
  .slice(0, 16)
  .replace("T", "_")
  .replace(":", "-");
const dest = path.join(BACKUP_DIR, stamp);

const log = (msg) => console.log(`[backup] ${msg}`);

fs.mkdirSync(dest, { recursive: true });

let failed = false;

// ===== ۱) بکاپ دیتابیس =====
const dumpFile = path.join(dest, "db.dump");
try {
  const { bin } = runPgDump(["-Fc", "-f", dumpFile]);
  const sizeMb = (fs.statSync(dumpFile).size / 1024 / 1024).toFixed(2);
  log(`✅ دیتابیس: ${dumpFile} (${sizeMb} MB) — pg_dump: ${bin}`);
} catch (error) {
  failed = true;
  log(`❌ بکاپ دیتابیس ناموفق بود: ${error.message}`);
}

// ===== ۲) بکاپ فایل‌های آپلودی =====
// UPLOADS_DIR برای چیدمان غیرمعمول یا تست؛ پیش‌فرض: Backend/uploads
const uploadsDir = process.env.UPLOADS_DIR || path.join(__dirname, "..", "uploads");
if (fs.existsSync(uploadsDir)) {
  const target = path.join(dest, "uploads");
  try {
    fs.cpSync(uploadsDir, target, { recursive: true });
    const count = fs.readdirSync(target, { recursive: true }).length;
    log(`✅ فایل‌های آپلودی: ${target} (${count} مورد)`);
  } catch (error) {
    failed = true;
    log(`❌ کپی فایل‌ها ناموفق بود: ${error.message}`);
  }
} else {
  log("ℹ️ پوشهٔ uploads وجود ندارد (چیزی برای کپی نیست)");
}

// ===== ۳) توضیحات بکاپ =====
const cfg = dbConfig();
fs.writeFileSync(
  path.join(dest, "info.json"),
  JSON.stringify(
    {
      createdAt: new Date().toISOString(),
      database: cfg.database,
      host: cfg.host,
      keep: KEEP,
      files: ["db.dump", "uploads/", "info.json"],
    },
    null,
    2,
  ),
);

// ===== ۴) کپی بکاپ روی مسیر دوم (دیسک دوم یا درایو شبکه) =====
const STAMP_PATTERN = /^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}$/;
const copyTo = process.env.BACKUP_COPY_TO;

if (copyTo) {
  const copyRoot = path.resolve(copyTo);
  const copyDest = path.join(copyRoot, path.basename(dest));

  if (copyRoot === path.resolve(BACKUP_DIR)) {
    log("⚠️ BACKUP_COPY_TO با BACKUP_DIR یکی است → کپی انجام نشد");
  } else {
    try {
      fs.mkdirSync(copyRoot, { recursive: true });
      fs.cpSync(dest, copyDest, { recursive: true });

      // ✅ بررسی صحت کپی (حجم db.dump + تعداد فایل‌ها)
      const srcDump = path.join(dest, "db.dump");
      const dstDump = path.join(copyDest, "db.dump");
      const dumpMatch =
        fs.existsSync(srcDump) &&
        fs.existsSync(dstDump) &&
        fs.statSync(srcDump).size === fs.statSync(dstDump).size;
      const srcCount = fs.readdirSync(dest, { recursive: true }).length;
      const dstCount = fs.readdirSync(copyDest, { recursive: true }).length;

      if (!dumpMatch || dstCount < srcCount) {
        failed = true;
        log(
          `❌ کپی مسیر دوم ناقص است (src=${srcCount} dst=${dstCount}, dumpMatch=${dumpMatch})`,
        );
      } else {
        log(`✅ کپی مسیر دوم: ${copyDest} (${dstCount} مورد — تأیید شد)`);
      }

      // 🧹 فقط پوشه‌هایی که خودمان ساخته‌ایم (الگوی تاریخ) در مسیر دوم پاک می‌شوند
      const copyDirs = fs
        .readdirSync(copyRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && STAMP_PATTERN.test(entry.name))
        .map((entry) => entry.name)
        .sort()
        .reverse();

      copyDirs.slice(KEEP).forEach((name) => {
        fs.rmSync(path.join(copyRoot, name), { recursive: true, force: true });
        log(`🧹 حذف کپی قدیمی: ${name}`);
      });
    } catch (error) {
      failed = true;
      log(`❌ کپی روی مسیر دوم ناموفق بود: ${error.message}`);
    }
  }
} else {
  log(
    "ℹ️ BACKUP_COPY_TO تنظیم نشده → کپی روی مسیر دوم انجام نشد (توصیه: دیسک دوم/درایو شبکه)",
  );
}

// ===== ۵) حذف بکاپ‌های قدیمی =====
try {
  const allDirs = fs
    .readdirSync(BACKUP_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  // 🛡️ فقط پوشه‌هایی که خودِ این اسکریپت ساخته (الگوی تاریخ) پاک می‌شوند
  // تا پوشه/فایل دیگری که کاربر داخل backups گذاشته، حذف نشود.
  const dirs = allDirs
    .filter((name) => STAMP_PATTERN.test(name))
    .sort()
    .reverse();
  const skipped = allDirs.filter((name) => !STAMP_PATTERN.test(name));
  if (skipped.length) {
    log(`ℹ️ پوشه‌های غیربکاپ دست‌نخورده ماندند: ${skipped.join(", ")}`);
  }

  dirs.slice(KEEP).forEach((name) => {
    fs.rmSync(path.join(BACKUP_DIR, name), { recursive: true, force: true });
    log(`🧹 حذف بکاپ قدیمی: ${name}`);
  });
} catch (error) {
  log(`⚠️ خطا در پاکسازی بکاپ‌های قدیمی: ${error.message}`);
}

const DUMP_SIZE_MB = (() => {
  try {
    return (fs.statSync(dumpFile).size / 1024 / 1024).toFixed(2);
  } catch {
    return null;
  }
})();

log(`تمام. مسیر این بکاپ: ${dest}`);
if (DUMP_SIZE_MB) log(`حجم دیتابیس دامپ: ${DUMP_SIZE_MB} MB`);
// ✅ exitCode به‌جای process.exit تا لاگ‌های piped (مثل Task Scheduler) بریده نشوند
process.exitCode = failed ? 1 : 0;
