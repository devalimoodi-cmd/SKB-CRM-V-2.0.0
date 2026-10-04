"use strict";

// ============================================================
// services/presenceService.js
// «حضور کاربران» — لایهٔ نوشتن/خواندن روی دیتابیس
// ------------------------------------------------------------
// • touch(userId)       : ثبت «آخرین فعالیت» (online_status=true + last_seen_at)
//                         با throttle حافظه‌ای → جلوی سیل UPDATE را می‌گیرد
// • markOffline(userId) : خروج صریح (online_status=false، last_seen_at حفظ می‌شود
//                         تا UI همچنان «آخرین فعالیت: ۲ دقیقه پیش» را نشان دهد)
// • قواعد خالص در ./presenceRules.js است (بدون دیتابیس، قابل تست در گیت)
// ------------------------------------------------------------
// ⚠️ touch هرگز نباید مسیر درخواست را کند یا خطادار کند:
//    fire-and-forget است (await نمی‌شود) و همهٔ خطاها را خودش می‌بلعد.
// ============================================================

const User = require("../models/User");
const rules = require("./presenceRules");

// userId → آخرین لحظهٔ نوشتن (ms) — فقط در حافظهٔ همین پروسه
const lastTouchAt = new Map();

// اگر ستون last_seen_at وجود نداشت (مایگریشن اجرا نشده)، لاگ اسپم نکنیم
let columnMissingUntil = 0;
const COLUMN_MISSING_BACKOFF_MS = 60 * 1000;

const isMissingColumnError = (error) =>
  error?.name === "SequelizeDatabaseError" &&
  /column .*last_seen_at.* does not exist/i.test(String(error?.message || ""));

// ============================================
// نوشتن: «همین حالا فعال بود»
//   خروجی true = نوشته شد | false = throttle/بدون‌کاربر/ستون غایب
// ============================================
const touch = (userId) => {
  if (!userId) return false;

  const now = Date.now();
  if (now < columnMissingUntil) return false;
  if (!rules.shouldTouch(lastTouchAt.get(userId), now)) return false;

  lastTouchAt.set(userId, now);

  User.update(
    { last_seen_at: new Date(now), online_status: true },
    // silent: true ⇒ updated_at کاربر با هر heartbeat عوض نشود
    // («آخرین ویرایش رکورد کاربر» چیز دیگری است و نباید آلوده شود)
    { where: { id: userId }, silent: true },
  ).catch((error) => {
    if (isMissingColumnError(error)) {
      columnMissingUntil = Date.now() + COLUMN_MISSING_BACKOFF_MS;
      console.warn(
        "⚠️ [presence] ستون users.last_seen_at وجود ندارد؛ مایگریشن را اجرا کنید: npm run db:migrate",
      );
      return;
    }
    console.warn("⚠️ [presence] ثبت آخرین فعالیت ناموفق بود:", error.message);
  });

  return true;
};

// ============================================
// نوشتن: «خروج صریح» (دکمهٔ خروج یا بستن تب)
// ============================================
const markOffline = async (userId) => {
  if (!userId) return null;

  const user = await User.findByPk(userId, { attributes: ["id"] });
  if (!user) return null;

  await user.update({ online_status: false }, { silent: true });

  // throttle پاک می‌شود تا ورود بعدی بلافاصله ثبت شود
  lastTouchAt.delete(userId);

  return { online: false };
};

// ============================================
// خواندن: فهرست کاربران برای /presence/summary
// ============================================
const SUMMARY_ATTRIBUTES = [
  "id",
  "first_name",
  "last_name",
  "username",
  "role",
  "status",
  "online_status",
  "last_seen_at",
];

const getSummary = async (now = Date.now()) => {
  const users = await User.findAll({
    where: { status: "active" },
    attributes: SUMMARY_ATTRIBUTES,
  });
  return rules.buildSummary(users, now);
};

module.exports = {
  touch,
  markOffline,
  getSummary,
  SUMMARY_ATTRIBUTES,
  // نگهبان تست: ریست وضعیت داخلی (فقط برای تست‌ها)
  _resetThrottle: () => lastTouchAt.clear(),
  // قواعد خالص، دوباره صادر می‌شوند تا مصرف‌کننده یک import داشته باشد
  ...rules,
};
