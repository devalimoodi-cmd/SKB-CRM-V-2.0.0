"use strict";

// ============================================================
// services/sessionRules.js
// «قواعد نشست‌ها» — منطقِ خالص و بدون وابستگی (قابل تست بدون دیتابیس)
// ------------------------------------------------------------
// چرا جدا از sessionService؟
//   • sessionService به مدل UserSession (و دیتابیس) وابسته است؛ تستِ آن
//     نیاز به دیتابیس دارد. تمام «تصمیم‌گیری» اینجاست و بدون هیچ require:
//         isActive / shouldTouch / describeDevice / statusLabel
//         buildItem / buildSummary
//   • این ماژول «شکار باگ قدیمی» را تضمین می‌کند:
//       باگ قبلی: «خروج از همهٔ دستگاه‌ها» فقط `users.token` را عوض
//       می‌کرد؛ چون هر دستگاه توکن خودش را دارد، نشستِ هیچ دستگاهِ
//       دیگری واقعاً بسته نمی‌شد.
// ============================================================

const DEFAULT_TOUCH_THROTTLE_SECONDS = 60;
const DEFAULT_RETENTION_DAYS = 90;

// عددِ مثبت از env (اگر نامعتبر بود → پیش‌فرض)
const readPositiveInt = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
};

// حداکثر یک‌بار در این بازه (ثانیه) «آخرین فعالیت» یک نشست نوشته می‌شود
const TOUCH_THROTTLE_SECONDS = readPositiveInt(
  process.env.SESSION_TOUCH_THROTTLE_SECONDS,
  DEFAULT_TOUCH_THROTTLE_SECONDS,
);
const TOUCH_THROTTLE_MS = TOUCH_THROTTLE_SECONDS * 1000;

// چند روز تاریخچهٔ نشست‌های بسته‌شده نگه داشته شود (پاک‌سازی نگهداری)
const RETENTION_DAYS = readPositiveInt(
  process.env.SESSION_RETENTION_DAYS,
  DEFAULT_RETENTION_DAYS,
);

// ============================================
// «چرا نشست بسته شد؟» → متن فارسی برای UI
// ============================================
const END_REASON_TITLES = {
  logout: "خروج توسط کاربر",
  revoked: "باطل‌شده توسط مدیر",
  replaced: "جایگزین‌شده با ورود جدید",
  password_change: "تغییر رمز عبور",
  role_change: "تغییر نقش",
  reset: "بازنشانی توکن",
  expired: "منقضی‌شده",
  cleanup: "پاک‌سازی نگهداری",
};

const END_REASONS = Object.keys(END_REASON_TITLES);
const DEFAULT_END_REASON_TITLE = "بسته‌شده";

// ============================================
// ابزارهای زمان
// ============================================
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

// «چند ثانیه از آخرین فعالیت گذشته؟» — null اگر هرگز ثبت نشده باشد
const secondsSince = (value, now = Date.now()) => {
  const ms = toMillis(value);
  if (!ms) return null;
  return Math.max(0, Math.floor((now - ms) / 1000));
};

// ============================================
// ⭐ قلبِ رفع باگ «خروج از همهٔ دستگاه‌ها»
//    نشست فعال = هنوز `ended_at` نگرفته است.
//    بستنِ ردیف نشست (با هر دلیل) ⇒ همان توکن بی‌اعتبار می‌شود.
// ============================================
const isActive = (session) => !!session && !session.ended_at;

// آیا وقتِ نوشتنِ «آخرین فعالیت» است؟ (throttle حافظه‌ای، مثل presence)
const shouldTouch = (
  previousMs,
  now = Date.now(),
  throttleMs = TOUCH_THROTTLE_MS,
) => !previousMs || now - previousMs >= throttleMs;

// ============================================
// تشخیص مرورگر/سیستم‌عامل از User-Agent (خالص و قطعی)
// ------------------------------------------------------------
// ⚠️ ترتیب مهم است: Edge/Opera هم «Chrome» در UA دارند و آیفون هم
//    «like Mac OS X» ⇒ موارد خاص‌تر باید اول بیایند.
// ============================================
const BROWSERS = [
  ["Edg/", "Edge"],
  ["OPR/", "Opera"],
  ["YaBrowser/", "Yandex"],
  ["Chrome/", "کروم"],
  ["Firefox/", "فایرفاکس"],
  ["Safari/", "سافاری"],
  ["MSIE", "اینترنت اکسپلورر"],
];

const SYSTEMS = [
  ["Windows", "ویندوز"],
  ["Android", "اندروید"],
  ["iPhone", "آیفون"],
  ["iPad", "آی‌پد"],
  ["Mac OS X", "مک"],
  ["Linux", "لینوکس"],
];

const UNKNOWN_DEVICE = "دستگاه نامشخص";

const describeDevice = (userAgent) => {
  const ua = String(userAgent || "").trim();
  if (!ua) return UNKNOWN_DEVICE;

  const browser = (BROWSERS.find(([token]) => ua.includes(token)) || [])[1];
  const system = (SYSTEMS.find(([token]) => ua.includes(token)) || [])[1];

  if (browser && system) return `${browser} · ${system}`;
  return browser || system || UNKNOWN_DEVICE;
};

// وضعیت خوانا برای نمایش در پنل
const statusLabel = (session) =>
  isActive(session)
    ? "فعال"
    : END_REASON_TITLES[session?.end_reason] || DEFAULT_END_REASON_TITLE;

// ============================================
// نمای یک نشست برای UI (بدون لو دادن sid)
// ============================================
const buildItem = (session, now = Date.now(), options = {}) => {
  if (!session) return null;

  const active = isActive(session);
  const endReason = session.end_reason || null;

  return {
    id: session.id,
    user_id: session.user_id,
    username: session.username || null,
    role: session.role || null,
    ip: session.ip || null,
    // ⚠️ sid هرگز به فرانت نمی‌رود؛ فقط «آیا همین نشستِ من است؟»
    device: describeDevice(session.user_agent),
    user_agent: session.user_agent || null,
    started_at: session.started_at || null,
    last_activity_at: session.last_activity_at || null,
    seconds_since_activity: secondsSince(session.last_activity_at, now),
    ended_at: session.ended_at || null,
    end_reason: endReason,
    end_reason_title: endReason
      ? END_REASON_TITLES[endReason] || DEFAULT_END_REASON_TITLE
      : null,
    ended_by: session.ended_by || null,
    active,
    status: active ? "active" : "ended",
    status_label: statusLabel(session),
    current: !!options.currentSid && session.sid === options.currentSid,
  };
};

// مرتب‌سازی: نشست‌های فعال اول، سپس تازه‌ترین فعالیت، سپس بزرگ‌ترین id
const compareForList = (a, b) => {
  if (a.active !== b.active) return a.active ? -1 : 1;
  const aSeen = a.seconds_since_activity ?? Number.MAX_SAFE_INTEGER;
  const bSeen = b.seconds_since_activity ?? Number.MAX_SAFE_INTEGER;
  if (aSeen !== bSeen) return aSeen - bSeen;
  return Number(b.id || 0) - Number(a.id || 0);
};

// خلاصهٔ نشست‌ها (خالص: ورودی = ردیف‌های دیتابیس، خروجی = payload پاسخ)
const buildSummary = (sessions, now = Date.now(), options = {}) => {
  const items = (sessions || [])
    .map((session) => buildItem(session, now, options))
    .filter(Boolean)
    .sort(compareForList);

  const activeCount = items.filter((item) => item.active).length;

  return {
    total: items.length,
    active: activeCount,
    ended: items.length - activeCount,
    unique_users: new Set(items.map((item) => item.user_id)).size,
    // مقادیر مؤثر سرور (فرانت نیازی به دانستن env ندارد)
    touch_throttle_seconds: TOUCH_THROTTLE_SECONDS,
    retention_days: RETENTION_DAYS,
    sessions: items,
  };
};

module.exports = {
  DEFAULT_TOUCH_THROTTLE_SECONDS,
  DEFAULT_RETENTION_DAYS,
  TOUCH_THROTTLE_SECONDS,
  TOUCH_THROTTLE_MS,
  RETENTION_DAYS,
  END_REASON_TITLES,
  END_REASONS,
  DEFAULT_END_REASON_TITLE,
  UNKNOWN_DEVICE,
  readPositiveInt,
  toMillis,
  secondsSince,
  isActive,
  shouldTouch,
  describeDevice,
  statusLabel,
  buildItem,
  buildSummary,
};
