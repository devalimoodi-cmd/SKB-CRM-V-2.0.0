"use strict";

// ============================================================
// services/activityService.js
// «ردّ فعالیت» (Activity Log) — لایهٔ دیتابیس + بافر (فاز ۱۲.۲)
// ------------------------------------------------------------
// ⭐ هدف اصلی: نوشتن لاگ هرگز نباید مسیر درخواست را کند کند.
//   • middleware/activityLog.js فقط یک آبجکت به record() می‌دهد
//     (کاملاً fire-and-forget؛ هیچ await در مسیر پاسخ نیست)
//   • این سرویس ردیف‌ها را در حافظه جمع می‌کند و با یک INSERT دسته‌ای
//     (bulkCreate) در بازه‌های کوتاه خالی می‌کند ⇒ تعداد کوئری‌ها
//     ≈ تعداد درخواست‌ها / اندازهٔ دسته
//   • اگر مایگریشن activity_logs اجرا نشده باشد، یک‌بار هشدار می‌دهد،
//     بافر را دور می‌ریزد و تا پایان بازهٔ backoff ساکت می‌ماند
//     (هم‌الگو با services/sessionService.js و presenceService.js)
// ------------------------------------------------------------
// ⚠️ حریم خصوصی: مقدار فیلدها فقط با ACTIVITY_LOG_VALUES=true ذخیره
//    می‌شود و فیلدهای حساس (رمز/توکن) همیشه *** هستند — آن تصمیم در
//    services/activityRules.js#buildDetails گرفته شده، نه اینجا.
// ============================================================

const { Op } = require("sequelize");
const ActivityLog = require("../models/ActivityLog");
const rules = require("./activityRules");
// ⚠️ وابستگی یک‌طرفه: resolver هم rules را می‌خواند (بدون حلقه)
const activityCustomerResolver = require("./activityCustomerResolver");

// بازهٔ سکوت پس از «جدول وجود ندارد» (میلی‌ثانیه)
const TABLE_MISSING_BACKOFF_MS = 10 * 60 * 1000;

// سقف بافری که در صورت خطای موقت نگه داشته می‌شود (ضد رشد بی‌نهایت حافظه)
const MAX_QUEUE = 2000;

// بافر ردیف‌های آمادهٔ نوشتن
let buffer = [];

// تایمر flush (یک تایمر در هر لحظه — نه یکی به‌ازای هر درخواست)
let flushTimer = null;

// تا این زمان می‌دانیم جدول نیست ⇒ هیچ کوئری‌ای نمی‌زنیم
let tableMissingUntil = 0;
let tableMissingWarned = false;

// تایمرهای نگهداشت (پاک‌سازی ردیف‌های قدیمی‌تر از retention)
let housekeepingTimer = null;
let housekeepingFirstRun = null;

// ============================================
// ابزارها
// ============================================

// آیا خطا یعنی «جدول ساخته نشده»؟ (Postgres: 42P01)
const isTableMissing = (error) => {
  const code = error?.parent?.code || error?.original?.code || error?.code;
  if (code === "42P01") return true;
  const text = String(error?.message || "").toLowerCase();
  return (
    text.includes("does not exist") ||
    text.includes("no such table") ||
    (text.includes("relation") && text.includes("activity_logs"))
  );
};

// لاگ خطای مقاوم: هرگز throw نمی‌کند (لاگ نباید باعث خطای برنامه شود)
const handleError = (message, error) => {
  if (isTableMissing(error)) {
    if (!tableMissingWarned) {
      tableMissingWarned = true;
      console.warn(
        `⚠️ [activity] جدول activity_logs وجود ندارد — ثبت ردّ فعالیت موقتاً خاموش شد.` +
          ` اجرا کن: npm run db:migrate`,
      );
    }
    tableMissingUntil = Date.now() + TABLE_MISSING_BACKOFF_MS;
    return;
  }
  console.warn(`⚠️ [activity] ${message}:`, error?.message || error);
};

// اگر جدول نیست، رفتار «ساکت» (fail-open) — دقیقاً مثل sessionService
const isPaused = (now = Date.now()) => now < tableMissingUntil;

// زمان‌بندی یک flush (فقط یک تایمر فعال در هر لحظه)
const scheduleFlush = () => {
  if (flushTimer) return;

  const delay = Math.max(50, rules.flushMs());

  flushTimer = setTimeout(() => {
    flushTimer = null;
    // عمداً catch می‌شود: خطای نوشتن لاگ نباید unhandled rejection بسازد
    flush().catch((error) =>
      handleError("نوشتن دسته‌ای ردّ فعالیت ناموفق بود", error),
    );
  }, delay);

  // اگر تنها تایمر فعال پروسه باشد، خروج سرور را معطل نکند
  if (typeof flushTimer.unref === "function") flushTimer.unref();
};

// ============================================
// ثبت (فراخوانی از middleware — همیشه sync و بی‌خطر)
// ============================================
const record = (entry) => {
  try {
    if (!entry || !entry.action) return false;
    if (!rules.isEnabled()) return false;
    if (isPaused()) return false;

    // نگه‌داشتن یک کپی تخت (bulkCreate بعداً همان آبجکت را دست نمی‌زند)
    buffer.push({ ...entry });

    if (buffer.length >= rules.bufferMax()) {
      // بافر پر شد ⇒ بدون انتظار، همان لحظه خالی کن
      flush().catch((error) => handleError("flush فوری ناموفق بود", error));
      return true;
    }

    scheduleFlush();
    return true;
  } catch (error) {
    // هرگز نباید مسیر درخواست را بشکند
    console.warn("⚠️ [activity] خطا در صف‌گذاری ردیف:", error.message);
    return false;
  }
};

// ============================================
// خالی‌کردن بافر (INSERT دسته‌ای)
// ============================================
const flush = async () => {
  if (buffer.length === 0) {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    return 0;
  }

  // مایگریشن اجرا نشده ⇒ نگه‌داشتن بافر بی‌فایده است (حافظه پر می‌شود)
  if (isPaused()) {
    const dropped = buffer.length;
    buffer = [];
    return dropped;
  }

  const batch = buffer.splice(0, Math.max(1, rules.bufferMax()));

  try {
    // ⭐ موج ۱۲.۵: پر کردن customer_id ردیف‌هایی که در بدنهٔ درخواست
    //    نبود (مثل زیرمنابع سالن) — خارج از مسیر پاسخ و دسته‌ای.
    //    ⚠️ هر خطا در resolver بلعیده می‌شود؛ نوشتن لاگ هرگز شکست نمی‌خورد.
    try {
      await activityCustomerResolver.resolveCustomerIds(batch);
    } catch (error) {
      console.warn(
        "⚠️ [activity] استنتاج مشتری ناموفق بود:",
        error?.message || error,
      );
    }

    await ActivityLog.bulkCreate(batch, { validate: false });
    return batch.length;
  } catch (error) {
    handleError("درج دستهٔ ردّ فعالیت ناموفق بود", error);

    // خطای موقت (قطعی کوتاه دیتابیس) ⇒ برگرداندن به صف، با سقف
    if (!isTableMissing(error) && buffer.length < MAX_QUEUE) {
      buffer = batch.concat(buffer).slice(-MAX_QUEUE);
    }
    return 0;
  } finally {
    // اگر ردیف دیگری در صف ماند، دوباره زمان‌بندی کن
    if (buffer.length > 0 && !isPaused()) scheduleFlush();
  }
};

// برای تست/خروج تمیز
const flushNow = () => flush();

// ============================================
// خواندن (پنل مدیریت — فاز ۱۲.۳ روی همین‌ها سوار می‌شود)
// ============================================
const list = async ({ where = {}, limit = 25, offset = 0 } = {}) => {
  try {
    const result = await ActivityLog.findAndCountAll({
      where,
      order: [
        ["created_at", "DESC"],
        ["id", "DESC"],
      ],
      limit,
      offset,
    });
    return { count: result.count, rows: result.rows };
  } catch (error) {
    handleError("خواندن فهرست ردّ فعالیت ناموفق بود", error);
    return { count: 0, rows: [] };
  }
};

const getById = async (id) => {
  try {
    return await ActivityLog.findByPk(id);
  } catch (error) {
    handleError("خواندن یک ردیف ردّ فعالیت ناموفق بود", error);
    return null;
  }
};

// خلاصهٔ آماری: روی «پنجرهٔ اخیر» محاسبه می‌شود (سبک و بدون GROUP BY پیچیده)
const summary = async ({ limit = 1000 } = {}) => {
  const retentionDaysValue = rules.retentionDays();
  const safeLimit = Math.min(Math.max(1, Number(limit) || 1000), 5000);

  try {
    const rows = await ActivityLog.findAll({
      order: [
        ["created_at", "DESC"],
        ["id", "DESC"],
      ],
      limit: safeLimit,
    });
    return rules.buildSummary(rows, { retentionDaysValue });
  } catch (error) {
    handleError("خواندن خلاصهٔ ردّ فعالیت ناموفق بود", error);
    return rules.buildSummary([], { retentionDaysValue });
  }
};

// فیلتر بازهٔ زمانی (کمکی برای کنترلر)
const between = (from, to) => {
  const range = {};
  const fromDate = from ? new Date(from) : null;
  const toDate = to ? new Date(to) : null;
  if (fromDate && !Number.isNaN(fromDate.getTime())) range[Op.gte] = fromDate;
  if (toDate && !Number.isNaN(toDate.getTime())) range[Op.lte] = toDate;
  return Object.keys(range).length > 0 ||
    Object.getOwnPropertySymbols(range).length > 0
    ? range
    : null;
};

// ============================================
// نگهداشت: پاک‌سازی ردیف‌های قدیمی‌تر از ACTIVITY_RETENTION_DAYS
// ============================================
const purgeExpired = async ({
  retentionDaysValue = rules.retentionDays(),
  now = Date.now(),
} = {}) => {
  if (isPaused(now)) return 0;

  const days = Number(retentionDaysValue);
  if (!Number.isFinite(days) || days <= 0) return 0;

  const cutoff = new Date(now - days * 24 * 60 * 60 * 1000);

  try {
    return await ActivityLog.destroy({
      where: { created_at: { [Op.lt]: cutoff } },
    });
  } catch (error) {
    handleError("پاک‌سازی ردیف‌های قدیمی ناموفق بود", error);
    return 0;
  }
};

// ============================================
// زمان‌بند نگهداشت (اختیاری — ACTIVITY_PURGE_INTERVAL_HOURS=0 خاموش می‌کند)
// ============================================
const startHousekeeping = () => {
  const hours = rules.purgeIntervalHours();
  if (!Number.isFinite(hours) || hours <= 0) return null;
  if (housekeepingTimer) return housekeepingTimer;

  const intervalMs = hours * 60 * 60 * 1000;
  const run = () => {
    purgeExpired().catch((error) =>
      handleError("اجرای زمان‌بند پاک‌سازی ناموفق بود", error),
    );
  };

  // اولین اجرا با تأخیر کوتاه تا راه‌اندازی سرور سنگین نشود
  housekeepingFirstRun = setTimeout(run, Math.min(intervalMs, 5 * 60 * 1000));
  housekeepingTimer = setInterval(run, intervalMs);

  if (typeof housekeepingFirstRun.unref === "function") {
    housekeepingFirstRun.unref();
  }
  if (typeof housekeepingTimer.unref === "function") {
    housekeepingTimer.unref();
  }

  return housekeepingTimer;
};

const stopHousekeeping = () => {
  if (housekeepingFirstRun) {
    clearTimeout(housekeepingFirstRun);
    housekeepingFirstRun = null;
  }
  if (housekeepingTimer) {
    clearInterval(housekeepingTimer);
    housekeepingTimer = null;
  }
};

// ============================================
// وضعیت (برای /api/server-status و تست‌ها)
// ============================================
const status = (now = Date.now()) => ({
  buffered: buffer.length,
  paused: isPaused(now),
  paused_until:
    tableMissingUntil > now ? new Date(tableMissingUntil).toISOString() : null,
  housekeeping: Boolean(housekeepingTimer),
  // ⭐ موج ۱۲.۵: وضعیت استنتاج مشتری (خاموشی موقت جدول‌های خطادار)
  customer_resolver: activityCustomerResolver.status(now),
  ...rules.config(),
});

// فقط برای تست: بازگرداندن سرویس به حالت اولیه (بدون لمس دیتابیس)
const resetForTests = () => {
  buffer = [];
  tableMissingUntil = 0;
  tableMissingWarned = false;
  activityCustomerResolver.resetForTests();
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  stopHousekeeping();
};

module.exports = {
  record,
  flush,
  flushNow,
  list,
  summary,
  getById,
  between,
  purgeExpired,
  startHousekeeping,
  stopHousekeeping,
  status,
  isTableMissing,
  resetForTests,
};


