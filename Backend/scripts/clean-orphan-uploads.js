// ============================================================
// scripts/clean-orphan-uploads.js
// پاک‌سازی فایل‌های یتیم پوشهٔ uploads
// ------------------------------------------------------------
// «یتیم» = فایلی که در uploads هست ولی مسیر/نامش در هیچ ستون متنی/JSON
// دیتابیس وجود ندارد (معمولاً پیوست/عکسی که رکوردش حذف شده).
//
// ⚠️ به‌صورت پیش‌فرض فقط «نمایش» می‌دهد و چیزی حذف نمی‌کند.
//     برای حذف واقعی:  --delete
//
// گزینه‌ها:
//   --delete               حذف واقعی فایل‌های یتیم
//   --min-age-hours=<n>    فقط فایل‌های قدیمی‌تر از n ساعت (پیش‌فرض: 24)
//   --json                 خروجی JSON روی stdout
//   --no-db                بدون مقایسه با دیتابیس (خطرناک!)
//   --no-prune-empty-dirs  پوشه‌های خالی باقی بمانند
// ============================================================
const fs = require("node:fs");
const path = require("node:path");

// quiet: true → dotenv بنر تبلیغاتی خود را چاپ نکند
// (بنر روی stdout چاپ می‌شد و خروجی JSON اسکریپت را خراب می‌کرد)
require("dotenv").config({ path: path.join(__dirname, "..", ".env"), quiet: true });

const {
  ROOT,
  uploadsDir,
  walkFiles,
  collectDbReferences,
  findOrphans,
  formatBytes,
} = require("./uploads-tools");

const args = process.argv.slice(2);
const hasFlag = (name) => args.includes(`--${name}`);
const argValue = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  if (!hit) return fallback;
  const value = Number(hit.split("=")[1]);
  return Number.isFinite(value) ? value : fallback;
};

const DELETE = hasFlag("delete");
const AS_JSON = hasFlag("json");
const WITH_DB = !hasFlag("no-db");
const MIN_AGE_HOURS = argValue("min-age-hours", null);
const PRUNE_EMPTY_DIRS = !hasFlag("no-prune-empty-dirs");

const log = AS_JSON ? (m) => console.error(m) : (m) => console.log(m);

const dir = uploadsDir();
const dirResolved = path.resolve(dir);

const stamp = new Date()
  .toISOString()
  .slice(0, 16)
  .replace("T", "_")
  .replace(":", "-");
const REPORT_DIR = process.env.UPLOADS_REPORT_DIR || path.join(ROOT, "logs");
const REPORT_FILE = path.join(REPORT_DIR, `orphan-uploads-${stamp}.txt`);

const writeReportFile = (lines) => {
  try {
    fs.mkdirSync(path.dirname(REPORT_FILE), { recursive: true });
    fs.writeFileSync(REPORT_FILE, lines.join("\n") + "\n");
    return REPORT_FILE;
  } catch (error) {
    console.error(`⚠️ نوشتن فایل گزارش ناموفق بود: ${error.message}`);
    return null;
  }
};

const pruneEmptyDirs = () => {
  const stack = [];
  const collect = (current) => {
    let entries = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const abs = path.join(current, entry.name);
        collect(abs);
        stack.push(abs);
      }
    }
  };
  collect(dirResolved);
  let removed = 0;
  for (const abs of stack) {
    try {
      if (fs.readdirSync(abs).length === 0) {
        fs.rmdirSync(abs);
        removed += 1;
      }
    } catch {
      /* پوشهٔ خالی‌نشده یا در حال استفاده */
    }
  }
  return removed;
};

(async () => {
  let sequelize = null;
  try {
    if (!WITH_DB) {
      log("⚠️  --no-db فعال است: همهٔ فایل‌ها یتیم در نظر گرفته می‌شوند!");
    }

    const files = walkFiles(dir);
    log(`📁 ${dir}: ${files.length} فایل`);

    let refs = {
      paths: new Set(),
      names: new Set(),
      scannedColumns: 0,
      errors: [],
    };
    if (WITH_DB) {
      const db = require("../config/database");
      sequelize = db.sequelize;
      refs = await collectDbReferences(sequelize, { quiet: AS_JSON });
    }

    const ageHours = MIN_AGE_HOURS === null ? undefined : MIN_AGE_HOURS;
    const { orphans, skippedRecent, kept } = findOrphans(files, refs, {
      ...(ageHours === undefined ? {} : { minAgeHours: ageHours }),
    });

    const totalSize = orphans.reduce((sum, f) => sum + f.size, 0);

    if (kept.length) {
      log(
        `🛡️ ${kept.length} فایل «دارایی ثابت» نادیده گرفته شد (مثل avatar-01.jpg) — هرگز حذف نمی‌شوند`,
      );
    }

    if (orphans.length === 0) {
      log("✅ فایل یتیمی پیدا نشد (همهٔ فایل‌ها در دیتابیس ارجاع دارند).");
    } else {
      log("");
      log(
        `${DELETE ? "🗑️ حذف" : "ℹ️ یافت‌شده"}: ${orphans.length} فایل — ${formatBytes(totalSize)}`,
      );
      orphans
        .slice()
        .sort((a, b) => b.size - a.size)
        .slice(0, 20)
        .forEach((f) => log(` • ${formatBytes(f.size)} — ${f.relPath}`));
      if (orphans.length > 20) {
        log(` … و ${orphans.length - 20} فایل دیگر (در فایل گزارش)`);
      }
    }

    let deleted = 0;
    let freedBytes = 0;
    const failedDeletes = [];

    if (DELETE && orphans.length > 0) {
      for (const file of orphans) {
        const abs = path.resolve(file.absPath);
        // 🛡️ محافظ: هرگز بیرون از پوشهٔ uploads حذف نکن
        if (!abs.startsWith(dirResolved + path.sep)) {
          failedDeletes.push(`${file.relPath} (خارج از پوشهٔ uploads)`);
          continue;
        }
        try {
          fs.unlinkSync(abs);
          deleted += 1;
          freedBytes += file.size;
        } catch (error) {
          failedDeletes.push(`${file.relPath} (${error.message})`);
        }
      }
      log("");
      log(`🗑️ ${deleted} فایل حذف شد — ${formatBytes(freedBytes)} آزاد شد`);
      if (failedDeletes.length) {
        log(`⚠️ ${failedDeletes.length} فایل حذف نشد`);
      }
      if (PRUNE_EMPTY_DIRS) {
        const removedDirs = pruneEmptyDirs();
        if (removedDirs) log(`🧹 ${removedDirs} پوشهٔ خالی حذف شد`);
      }
    } else if (orphans.length > 0) {
      log("");
      log("ℹ️ حالت نمایش است؛ برای حذف واقعی:  npm run uploads:clean -- --delete");
    }

    const reportFile = writeReportFile([
      "SKB-CRM — گزارش فایل‌های یتیم uploads",
      `تاریخ: ${new Date().toISOString()}`,
      `پوشه: ${dir}`,
      `حالت: ${DELETE ? "حذف واقعی (--delete)" : "فقط نمایش (dry-run)"}`,
      `سن حداقل: ${MIN_AGE_HOURS === null ? "پیش‌فرض" : MIN_AGE_HOURS} ساعت`,
      `فایل بررسی‌شده: ${files.length}`,
      `فایل یتیم: ${orphans.length} (${formatBytes(totalSize)})`,
      `نادیده‌گرفته‌شده (تازه): ${skippedRecent.length}`,
      `دارایی ثابت (نادیده): ${kept.length}`,
      "",
      "--- فهرست ---",
      ...orphans.map((f) => `${formatBytes(f.size)}\t${f.relPath}`),
      "",
      `حذف‌شده: ${deleted} (${formatBytes(freedBytes)})`,
      ...failedDeletes.map((f) => `ناموفق: ${f}`),
    ]);
    if (reportFile) log(`📝 فایل گزارش: ${reportFile}`);

    if (AS_JSON) {
      process.stdout.write(
        JSON.stringify(
          {
            uploadsDir: dir,
            dryRun: !DELETE,
            scannedFiles: files.length,
            orphanCount: orphans.length,
            orphanSize: totalSize,
            orphanSizeHuman: formatBytes(totalSize),
            skippedRecentCount: skippedRecent.length,
            keptCount: kept.length,
            deleted,
            freedBytes,
            freedHuman: formatBytes(freedBytes),
            failedDeletes,
            reportFile,
            orphans: orphans.map((f) => ({ relPath: f.relPath, size: f.size })),
          },
          null,
          2,
        ) + "\n",
      );
    }

    if (sequelize) await sequelize.close();
    // ✅ exitCode به‌جای process.exit تا خروجی JSON (piped) بریده نشود
    process.exitCode = failedDeletes.length ? 1 : 0;
  } catch (error) {
    console.error(`❌ خطا: ${error.message}`);
    if (sequelize) {
      try {
        await sequelize.close();
      } catch {}
    }
    process.exitCode = 1;
  }
})();
