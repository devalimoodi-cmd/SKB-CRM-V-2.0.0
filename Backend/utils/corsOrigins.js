// ============================================================
// utils/corsOrigins.js — فهرست مبدأهای مجاز CORS (موج ۱۳.۲۴)
// ------------------------------------------------------------
// چرا این فایل؟
//   پیش از این، فهرست مبدأها **هاردکد** داخل server.js بود؛ نتیجه:
//   • هر IP تازهٔ لپ‌تاپ/شبکه یعنی ویرایش کد،
//   • و متغیر ALLOWED_ORIGINS در .env **هیچ اثری نداشت** (خوانده نمی‌شد).
//
// قواعد (fail-closed — هرگز «*» برنمی‌گردد):
//   ۱) پیش‌فرض‌های همین فایل همیشه مجازند (رفتار قبلی دست‌نخورده).
//   ۲) `ALLOWED_ORIGINS` (با کاما جدا) به پیش‌فرض‌ها **اضافه** می‌شود،
//      جایگزین نمی‌کند؛ پس افزودن یک مبدأ هرگز مبدأهای فعلی را نمی‌شکند.
//   ۳) `CORS_ALLOW_LAN=true` ⇒ مبدأهای `http://<IPv4 محلی>:3000` و
//      `http://<IPv4 محلی>:5000` خودکار اضافه می‌شوند (تست روی موبایل
//      در شبکهٔ محلی، بدون ویرایش دستی فهرست).
//   ۴) ورودی خالی/تکراری/دارای اسلش انتهایی تمیز می‌شود؛ `*` نادیده
//      گرفته می‌شود (با credentials:true مرورگر آن را رد می‌کند و
//      معنایش «همه مجاز» است — ممنوع).
// ============================================================
"use strict";

const os = require("os");

// 🔒 پیش‌فرض‌ها: همان فهرست هاردکد قبلی server.js (بدون تغییر رفتار)
const DEFAULT_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  // سرور اختصاصی
  "http://192.168.168.72:3000",
  "http://192.168.168.72",
  "http://192.168.168.72:5000",
];

// پورت‌هایی که «سرور فرانت» و «خود بک‌اند» روی آن بالا می‌آیند
const LAN_PORTS = [3000, 5000];

// «http://a:3000/» ⇒ «http://a:3000»
const normalizeOrigin = (value) => {
  const raw = String(value == null ? "" : value).trim();
  if (!raw) return "";
  const trimmed = raw.replace(/\/+$/, "");
  // فقط مبدأ http(s) معتبر است؛ چیزهای دیگر (مثل "*") دور ریخته می‌شوند
  return /^https?:\/\/[^/]+$/i.test(trimmed) ? trimmed : "";
};

// «a, b , c» ⇒ ["a","b","c"]
const parseOriginList = (raw) => {
  if (Array.isArray(raw)) return raw;
  return String(raw == null ? "" : raw).split(",");
};

// همهٔ IPv4های غیرداخلی این دستگاه (مثلاً 192.168.1.50)
const collectLanOrigins = (ports = LAN_PORTS) => {
  const origins = [];
  const nets = os.networkInterfaces() || {};

  Object.keys(nets).forEach((name) => {
    (nets[name] || []).forEach((net) => {
      if (!net) return;
      // IPv6 و آدرس‌های داخلی (127.0.0.1) مبدأ مرورگر نیستند
      if (net.family !== "IPv4" && net.family !== 4) return;
      if (net.internal === true) return;
      ports.forEach((port) => {
        origins.push(`http://${net.address}:${port}`);
      });
    });
  });

  return origins;
};

/**
 * فهرست نهایی مبدأهای مجاز برای cors({ origin })
 * @param {object} [env] - پیش‌فرض: process.env
 * @param {string[]} [defaults] - پیش‌فرض: DEFAULT_ORIGINS
 * @returns {string[]} همیشه دست‌کم یک مبدأ (هرگز خالی/هرگز "*")
 */
const resolveCorsOrigins = (env = {}, defaults = DEFAULT_ORIGINS) => {
  const safeDefaults = (Array.isArray(defaults) ? defaults : DEFAULT_ORIGINS)
    .map(normalizeOrigin)
    .filter(Boolean);

  const extra = parseOriginList(env.ALLOWED_ORIGINS)
    .map(normalizeOrigin)
    .filter(Boolean);

  const allowLan = String(env.CORS_ALLOW_LAN || "").trim().toLowerCase() === "true";
  const lan = allowLan ? collectLanOrigins().map(normalizeOrigin).filter(Boolean) : [];

  // حذف تکراری‌ها با حفظ ترتیب (پیش‌فرض ← env ← LAN)
  const seen = new Set();
  const result = [];
  [...safeDefaults, ...extra, ...lan].forEach((origin) => {
    if (seen.has(origin)) return;
    seen.add(origin);
    result.push(origin);
  });

  return result.length > 0 ? result : [...DEFAULT_ORIGINS];
};

module.exports = {
  DEFAULT_ORIGINS,
  LAN_PORTS,
  normalizeOrigin,
  parseOriginList,
  collectLanOrigins,
  resolveCorsOrigins,
};
