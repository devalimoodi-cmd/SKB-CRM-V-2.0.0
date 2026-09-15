// ============================================================
// scripts/uploads-tools.js
// ابزارهای مشترک «گزارش و نگهداری پوشهٔ uploads»
// ------------------------------------------------------------
// از این ماژول استفاده می‌کنند:
//   • scripts/uploads-report.js        → گزارش حجم و وضعیت
//   • scripts/clean-orphan-uploads.js  → حذف فایل‌های یتیم
// ------------------------------------------------------------
// نکتهٔ مهم: فایل «یتیم» = فایلی که در پوشهٔ uploads هست ولی مسیر/نام آن
// در هیچ ستون متنی/JSON دیتابیس پیدا نمی‌شود (مثلاً پیوستی که رکوردش حذف شده).
// ============================================================
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..", "..");

// پوشهٔ uploads (قابل تغییر با UPLOADS_DIR — برای تست یا چیدمان غیرمعمول)
const uploadsDir = () =>
  process.env.UPLOADS_DIR || path.join(__dirname, "..", "uploads");

const MIN_AGE_HOURS = () => {
  const n = Number(process.env.ORPHAN_MIN_AGE_HOURS ?? 24);
  return Number.isFinite(n) && n >= 0 ? n : 24;
};

// ===== فایل‌های «دارایی ثابت» که هرگز یتیم حساب نمی‌شوند =====
// این فایل‌ها در دیتابیس ارجاع ندارند ولی بخشی از خود برنامه‌اند
// (مثل تصاویر پیش‌فرض آواتار) و حذفشان برنامه را خراب می‌کند.
// با UPLOADS_KEEP_PATTERNS می‌توان الگوی دلخواه (regex، جدا با کاما) اضافه کرد.
const DEFAULT_KEEP_PATTERNS = [
  /^avatar-\d+\.(jpe?g|png|webp|gif)$/i,
  /^default-avatar\.(jpe?g|png|webp|gif)$/i,
  /^\.gitkeep$/i,
  /^\.gitignore$/i,
  /^README(\.[a-z]+)?$/i,
];

const keepPatterns = () => {
  const extra = String(process.env.UPLOADS_KEEP_PATTERNS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      try {
        return new RegExp(s, "i");
      } catch {
        return null; // الگوی نامعتبر نادیده گرفته می‌شود
      }
    })
    .filter(Boolean);
  return [...DEFAULT_KEEP_PATTERNS, ...extra];
};

const isKeepFile = (name) => {
  const base = path.posix.basename(String(name).replace(/\\/g, "/"));
  return keepPatterns().some((re) => re.test(base));
};

// ===== پیمایش بازگشتی فایل‌ها =====
const walkFiles = (dir) => {
  const out = [];
  if (!fs.existsSync(dir)) return out;

  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const abs = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(abs);
      } else if (entry.isFile()) {
        let stat = null;
        try {
          stat = fs.statSync(abs);
        } catch {
          continue;
        }
        out.push({
          absPath: abs,
          relPath: path.relative(dir, abs).replace(/\\/g, "/"),
          name: entry.name,
          size: stat.size,
          mtimeMs: stat.mtimeMs,
        });
      }
    }
  }
  return out;
};

// ===== جمع‌آوری مسیرهای ارجاع‌شده در دیتابیس =====
// همهٔ ستون‌های متنی/JSON همهٔ جداول اسکن می‌شوند و هر مقداری که
// «uploads/» یا «uploads\» داشته باشد استخراج می‌شود.
const collectDbReferences = async (sequelize, { quiet = false } = {}) => {
  const refs = {
    paths: new Set(),
    names: new Set(),
    scannedColumns: 0,
    scannedValues: 0,
    errors: [],
  };

  const [columns] = await sequelize.query(`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND data_type IN ('character varying','text','character','json','jsonb')
    ORDER BY table_name, column_name
  `);

  for (const col of columns) {
    const table = `"${col.table_name}"`;
    const column = `"${col.column_name}"`;
    refs.scannedColumns += 1;
    try {
      const [rows] = await sequelize.query(
        `SELECT DISTINCT ${column}::text AS value FROM ${table} WHERE ${column}::text LIKE '%uploads%'`,
      );
      for (const row of rows) {
        const value = row.value;
        if (typeof value !== "string") continue;
        refs.scannedValues += 1;
        const matches = value.match(/uploads[\\/][^\s"'\][,;)]+/g) || [];
        for (const raw of matches) {
          const normalized = raw.replace(/\\/g, "/").replace(/^\/+/, "");
          refs.paths.add(normalized);
          refs.names.add(path.posix.basename(normalized));
        }
      }
    } catch (error) {
      refs.errors.push(`${col.table_name}.${col.column_name}: ${error.message}`);
    }
  }

  if (!quiet) {
    console.error(
      `[uploads] اسکن دیتابیس: ${refs.scannedColumns} ستون، ${refs.scannedValues} مقدار ارجاع‌دار، ${refs.paths.size} مسیر`,
    );
    if (refs.errors.length) {
      console.error(`[uploads] ⚠️ ${refs.errors.length} ستون اسکن نشد`);
    }
  }

  return refs;
};

// ===== تشخیص فایل‌های یتیم =====
const findOrphans = (
  files,
  refs,
  { minAgeHours = MIN_AGE_HOURS(), now = Date.now() } = {},
) => {
  const minAgeMs = minAgeHours * 60 * 60 * 1000;
  const orphans = [];
  const skippedRecent = [];
  const kept = [];

  for (const file of files) {
    // 🛡️ دارایی ثابت برنامه (مثل avatar-01.jpg) هرگز یتیم حساب نمی‌شود
    if (isKeepFile(file.name)) {
      kept.push(file);
      continue;
    }

    const referenced =
      refs.paths.has(file.relPath) || refs.names.has(file.name);
    if (referenced) continue;

    if (minAgeMs > 0 && now - file.mtimeMs < minAgeMs) {
      skippedRecent.push(file);
      continue;
    }
    orphans.push(file);
  }

  return { orphans, skippedRecent, kept };
};

// ===== ارجاع‌های دیتابیس که فایلشان روی دیسک نیست =====
// (برعکس فایل یتیم: رکوردی در دیتابیس هست ولی فایل گم شده →
//  یعنی تصویر/پیوست در برنامه «خراب» نمایش داده می‌شود و باید بازگردانی شود)
const findMissingReferencedFiles = (refs, files) => {
  const diskNames = new Set(files.map((f) => f.name));
  const diskPaths = new Set(files.map((f) => f.relPath));
  const missing = [];

  for (const refPath of refs.paths) {
    const name = path.posix.basename(refPath);
    if (!name || !name.includes(".")) continue; // مسیر بدون نام فایل → نادیده
    if (diskNames.has(name) || diskPaths.has(refPath)) continue;
    missing.push(refPath);
  }
  return missing;
};

const formatBytes = (bytes) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : 2)} ${units[unit]}`;
};

const diskFree = (dir) => {
  try {
    const stat = fs.statfsSync(dir);
    return { free: stat.bavail * stat.bsize, total: stat.blocks * stat.bsize };
  } catch {
    return null;
  }
};

module.exports = {
  ROOT,
  uploadsDir,
  MIN_AGE_HOURS,
  walkFiles,
  collectDbReferences,
  findOrphans,
  findMissingReferencedFiles,
  isKeepFile,
  formatBytes,
  diskFree,
};
