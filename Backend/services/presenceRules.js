"use strict";

// ============================================================
// services/presenceRules.js
// «قواعد حضور» — منطقِ خالص و بدون وابستگی (قابل تست بدون دیتابیس)
// ------------------------------------------------------------
// چرا جدا از presenceService؟
//   • presenceService به مدل User (و دیتابیس) وابسته است؛ تستِ آن نیاز
//     به دیتابیس دارد. تمام «تصمیم‌گیری» اینجا و بدون هیچ require است:
//         isOnline / secondsSince / shouldTouch / describe / buildSummary
//   • این ماژول «شکار باگ قدیمی» را تضمین می‌کند:
//       باگ قبلی: online_status فقط در ورود/خروج ست می‌شد، پس اگر کاربر
//       مرورگر را می‌بست یا برق/اینترنت قطع می‌شد، تا ابد «آنلاین» می‌ماند.
//       راه‌حل: آنلاین‌بودن = وضعیت صریح AND تازه‌بودنِ last_seen_at.
// ============================================================

const DEFAULT_ONLINE_WINDOW_SECONDS = 120;
const DEFAULT_TOUCH_THROTTLE_SECONDS = 60;

// عددِ مثبت از env (اگر نامعتبر بود → پیش‌فرض)
const readPositiveInt = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
};

const ONLINE_WINDOW_SECONDS = readPositiveInt(
  process.env.PRESENCE_ONLINE_WINDOW_SECONDS,
  DEFAULT_ONLINE_WINDOW_SECONDS,
);
const TOUCH_THROTTLE_SECONDS = readPositiveInt(
  process.env.PRESENCE_TOUCH_THROTTLE_SECONDS,
  DEFAULT_TOUCH_THROTTLE_SECONDS,
);
const ONLINE_WINDOW_MS = ONLINE_WINDOW_SECONDS * 1000;
const TOUCH_THROTTLE_MS = TOUCH_THROTTLE_SECONDS * 1000;

// تبدیل هر شکلِ تاریخ (Date | ISO string | عدد) به میلی‌ثانیه (۰ = نامعتبر)
const toMillis = (value) => {
  if (!value) return 0;
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isFinite(time) ? time : 0;
  }
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
};

// «چند ثانیه از آخرین فعالیت گذشته؟» — null اگر هرگز فعالیتی ثبت نشده باشد
const secondsSince = (value, now = Date.now()) => {
  const ms = toMillis(value);
  if (!ms) return null;
  return Math.max(0, Math.floor((now - ms) / 1000));
};

// ⭐ قلبِ رفع باگ «آنلاین همیشه»:
//   ۱) وضعیت صریحِ آفلاین (خروج کاربر) → آفلاین، هرچقدر هم last_seen_at تازه باشد
//   ۲) اگر آخرین فعالیت قدیمی‌تر از پنجرهٔ آنلاین باشد → آفلاین
//      (بستن ناگهانی مرورگر / قطع اینترنت / قطع برق)
const isOnline = (user, now = Date.now(), windowMs = ONLINE_WINDOW_MS) => {
  if (!user) return false;
  if (user.online_status === false) return false;
  const ms = toMillis(user.last_seen_at);
  if (!ms) return false;
  return now - ms <= windowMs;
};

// آیا وقتِ نوشتنِ «آخرین فعالیت» است؟ (throttle حافظه‌ای)
const shouldTouch = (
  previousMs,
  now = Date.now(),
  throttleMs = TOUCH_THROTTLE_MS,
) => !previousMs || now - previousMs >= throttleMs;

// نمای یک کاربر برای UI («X دقیقه پیش»)
const describe = (user, now = Date.now()) => ({
  online: isOnline(user, now),
  online_status: user?.online_status === true,
  last_seen_at: user?.last_seen_at || null,
  seconds_since_last_seen: secondsSince(user?.last_seen_at, now),
});

// مرتب‌سازی: آنلاین‌ها اول، بعد تازه‌ترین فعالیت، بعد نام کاربری
const compareForSummary = (a, b) => {
  if (a.online !== b.online) return a.online ? -1 : 1;
  const aSeen = a.seconds_since_last_seen ?? Number.MAX_SAFE_INTEGER;
  const bSeen = b.seconds_since_last_seen ?? Number.MAX_SAFE_INTEGER;
  if (aSeen !== bSeen) return aSeen - bSeen;
  return String(a.username || "").localeCompare(String(b.username || ""));
};

// خلاصهٔ حضور (خالص: ورودی = فهرست کاربران، خروجی = payload آمادهٔ پاسخ)
const buildSummary = (users, now = Date.now()) => {
  const items = (users || [])
    .map((user) => ({
      id: user.id,
      first_name: user.first_name,
      last_name: user.last_name,
      username: user.username,
      role: user.role,
      status: user.status,
      ...describe(user, now),
    }))
    .sort(compareForSummary);

  const onlineCount = items.filter((item) => item.online).length;

  return {
    total: items.length,
    online: onlineCount,
    offline: items.length - onlineCount,
    // ⚠️ فرانت برای نمایش «چند دقیقه پیش» استفاده می‌کند؛ مقدار آن باید با
    //    PRESENCE_ONLINE_WINDOW_SECONDS دیتابیس یکی باشد (تستِ نگهبان چک می‌کند)
    window_seconds: ONLINE_WINDOW_SECONDS,
    users: items,
  };
};

module.exports = {
  DEFAULT_ONLINE_WINDOW_SECONDS,
  DEFAULT_TOUCH_THROTTLE_SECONDS,
  ONLINE_WINDOW_SECONDS,
  TOUCH_THROTTLE_SECONDS,
  ONLINE_WINDOW_MS,
  TOUCH_THROTTLE_MS,
  readPositiveInt,
  toMillis,
  secondsSince,
  isOnline,
  shouldTouch,
  describe,
  buildSummary,
};
