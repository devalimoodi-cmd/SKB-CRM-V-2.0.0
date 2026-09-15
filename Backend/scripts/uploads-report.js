// ============================================================
// scripts/uploads-report.js
// گزارش وضعیت پوشهٔ uploads (فقط خواندنی — چیزی حذف/تغییر نمی‌کند)
// اجرا:  npm run uploads:report      (یا uploads-report.bat)
// ------------------------------------------------------------
// گزینه‌ها:
//   --json                 خروجی JSON روی stdout (برای اتوماسیون/تست)
//   --no-db                بدون مقایسه با دیتابیس
//   --older-than=<days>    فهرست فایل‌های قدیمی‌تر از N روز (پیش‌فرض: 365)
//   --top=<n>              تعداد فایل‌های بزرگ در گزارش (پیش‌فرض: 10)
// ============================================================
const fs = require("node:fs");
const path = require("node:path");

// quiet: true → dotenv بنر تبلیغاتی خود را چاپ نکند
// (بنر روی stdout چاپ می‌شد و خروجی JSON/لاگ اسکریپت‌ها را خراب می‌کرد)
require("dotenv").config({ path: path.join(__dirname, "..", ".env"), quiet: true });

const {
  uploadsDir,
  walkFiles,
  collectDbReferences,
  findOrphans,
  findMissingReferencedFiles,
  formatBytes,
  diskFree,
  MIN_AGE_HOURS,
} = require("./uploads-tools");

const args = process.argv.slice(2);
const hasFlag = (name) => args.includes(`--${name}`);
const argValue = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  if (!hit) return fallback;
  const value = Number(hit.split("=")[1]);
  return Number.isFinite(value) ? value : fallback;
};

const AS_JSON = hasFlag("json");
const WITH_DB = !hasFlag("no-db");
const OLDER_THAN_DAYS = argValue("older-than", 365);
const TOP = Math.max(1, argValue("top", 10));

const dir = uploadsDir();

const buildReport = async () => {
  const files = walkFiles(dir);
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);

  // تفکیک بر اساس پوشهٔ سطح اول
  const byFolder = {};
  for (const file of files) {
    const top = file.relPath.includes("/") ? file.relPath.split("/")[0] : "(ریشه)";
    if (!byFolder[top]) byFolder[top] = { count: 0, size: 0 };
    byFolder[top].count += 1;
    byFolder[top].size += file.size;
  }

  const largest = [...files].sort((a, b) => b.size - a.size).slice(0, TOP);

  const olderThanMs = OLDER_THAN_DAYS * 24 * 60 * 60 * 1000;
  const oldFiles = files.filter((f) => Date.now() - f.mtimeMs > olderThanMs);
  const oldSize = oldFiles.reduce((sum, f) => sum + f.size, 0);

  const report = {
    uploadsDir: dir,
    exists: fs.existsSync(dir),
    totalFiles: files.length,
    totalSize,
    totalSizeHuman: formatBytes(totalSize),
    byFolder,
    largest: largest.map((f) => ({
      relPath: f.relPath,
      size: f.size,
      sizeHuman: formatBytes(f.size),
      modifiedAt: new Date(f.mtimeMs).toISOString(),
    })),
    olderThanDays: OLDER_THAN_DAYS,
    olderCount: oldFiles.length,
    olderSize: oldSize,
    olderSizeHuman: formatBytes(oldSize),
    disk: diskFree(fs.existsSync(dir) ? dir : path.join(__dirname, "..")),
    orphans: null,
    db: null,
  };

  if (WITH_DB) {
    const { sequelize } = require("../config/database");
    try {
      const refs = await collectDbReferences(sequelize, { quiet: AS_JSON });
      const { orphans, skippedRecent, kept } = findOrphans(files, refs, {
        minAgeHours: MIN_AGE_HOURS(),
      });
      report.db = {
        scannedColumns: refs.scannedColumns,
        referencedPaths: refs.paths.size,
        errors: refs.errors.length,
      };
      report.orphans = {
        count: orphans.length,
        size: orphans.reduce((sum, f) => sum + f.size, 0),
        sizeHuman: formatBytes(orphans.reduce((sum, f) => sum + f.size, 0)),
        minAgeHours: MIN_AGE_HOURS(),
        skippedRecentCount: skippedRecent.length,
        keptCount: kept.length,
        sample: orphans
          .slice()
          .sort((a, b) => b.size - a.size)
          .slice(0, TOP)
          .map((f) => ({ relPath: f.relPath, sizeHuman: formatBytes(f.size) })),
      };

      // ✅ بررسی برعکس: رکورد دیتابیس که فایلش روی دیسک نیست (تصویر/پیوست خراب)
      const missing = findMissingReferencedFiles(refs, files);
      report.missingFiles = {
        count: missing.length,
        sample: missing.slice(0, TOP),
      };
    } finally {
      try {
        await sequelize.close();
      } catch {}
    }
  }

  return report;
};

(async () => {
  try {
    const report = await buildReport();

    if (AS_JSON) {
      process.stdout.write(JSON.stringify(report, null, 2) + "\n");
      return;
    }

    console.log("============================================");
    console.log("📁 گزارش پوشهٔ uploads");
    console.log("============================================");
    console.log(`مسیر: ${report.uploadsDir} (موجود: ${report.exists})`);
    console.log(`تعداد فایل: ${report.totalFiles}`);
    console.log(`حجم کل: ${report.totalSizeHuman}`);
    if (report.disk) {
      console.log(
        `فضای دیسک: آزاد ${formatBytes(report.disk.free)} از ${formatBytes(report.disk.total)}`,
      );
    }

    console.log("\n--- تفکیک پوشه‌ها ---");
    Object.entries(report.byFolder)
      .sort((a, b) => b[1].size - a[1].size)
      .forEach(([name, info]) =>
        console.log(` • ${name}: ${info.count} فایل — ${formatBytes(info.size)}`),
      );

    console.log(`\n--- ${TOP} فایل بزرگ ---`);
    report.largest.forEach((f) =>
      console.log(` • ${f.sizeHuman} — ${f.relPath}`),
    );

    console.log(`\n--- قدیمی‌تر از ${OLDER_THAN_DAYS} روز ---`);
    console.log(
      ` ${report.olderCount} فایل — ${report.olderSizeHuman} (بازبینی دستی توصیه می‌شود)`,
    );

    if (report.orphans) {
      console.log("\n--- فایل‌های یتیم (بدون ارجاع در دیتابیس) ---");
      console.log(
        ` ${report.orphans.count} فایل — ${report.orphans.sizeHuman}` +
          ` (فایل‌های تازه‌تر از ${report.orphans.minAgeHours} ساعت نادیده گرفته شدند: ${report.orphans.skippedRecentCount})`,
      );
      if (report.orphans.keptCount) {
        console.log(
          ` 🛡️ ${report.orphans.keptCount} فایل «دارایی ثابت» (مثل avatar-*.jpg) نادیده گرفته شد — هرگز حذف نمی‌شوند`,
        );
      }
      report.orphans.sample.forEach((f) =>
        console.log(` • ${f.sizeHuman} — ${f.relPath}`),
      );
      if (report.orphans.count > 0) {
        console.log(
          " برای پاک‌سازی:  npm run uploads:clean   (پیش‌فرض فقط نمایش است؛ برای حذف واقعی --delete)",
        );
      }

      if (report.missingFiles && report.missingFiles.count > 0) {
        console.log("\n--- ⚠️ ارجاع‌های دیتابیس بدون فایل روی دیسک ---");
        console.log(
          ` ${report.missingFiles.count} مورد (تصویر/پیوست در برنامه خراب نمایش داده می‌شود — باید از بکاپ بازگردانی شود)`,
        );
        report.missingFiles.sample.forEach((p) => console.log(` • ${p}`));
      }
    } else {
      console.log("\n(مقایسه با دیتابیس انجام نشد — --no-db)");
    }
  } catch (error) {
    console.error(`❌ خطا در گزارش uploads: ${error.message}`);
    process.exitCode = 1;
  }
})();
