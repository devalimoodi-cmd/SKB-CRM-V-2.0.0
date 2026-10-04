// ============================================================
// core/utils/avatar.utils.js
// ابزار مشترک «عکس پروفایل / آواتار»
// ------------------------------------------------------------
//  ⚠️ باگ واقعی که این ماژول رفع می‌کند:
//     ۱) کد به فایلی برای آواتار پیش‌فرض با پسوند «png» اشاره می‌کرد
//        که موجود نیست (تنها نسخهٔ SVG روی دیسک هست) → ۴۰۴ برای کاربران.
//     ۲) هندلر onerror هم دوباره «همان آدرس خراب» را ست می‌کرد →
//        مرورگر در حلقهٔ بی‌پایانِ درخواست GET می‌افتاد؛ بدترین حالت
//        دقیقاً برای کاربرانی که عکس پروفایل ندارند.
//
//  ✅ قاعدهٔ این ماژول:
//     • fallback باید ۱۰۰٪ بی‌خطا باشد → data: URL (بدون درخواست شبکه،
//       بدون ۴۰۴، بدون وابستگی به فایل روی دیسک).
//     • هندلر onerror باید «یک‌بارمصرف» باشد (بعد از اجرا پاک شود)
//       تا هیچ‌گاه حلقهٔ بی‌پایان رخ ندهد.
// ============================================================

// پالت رنگ ثابت برای آواتار حرف‌اول (هم‌رنگ با تم برند)
const AVATAR_PALETTE = [
  "#2c7a6e",
  "#667eea",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
];

const toDataUrl = (svg) => `data:image/svg+xml,${encodeURIComponent(svg)}`;

const escapeXml = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

// ✅ آواتار پیش‌فرضِ سراسری (تصویر انسان) — هرگز ۴۰۴ نمی‌دهد
export const DEFAULT_AVATAR = toDataUrl(
  `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">` +
    `<circle cx="50" cy="50" r="50" fill="#2c7a6e"/>` +
    `<circle cx="50" cy="38" r="17" fill="#ffffff" opacity="0.92"/>` +
    `<path d="M50 62c-16.5 0-30 10.5-30 23.5V100h60V85.5C80 72.5 66.5 62 50 62z" fill="#ffffff" opacity="0.92"/>` +
    `</svg>`,
);

// ✅ نام نمایشی کاربر (برای حرف‌اول و alt)
export function avatarDisplayName(user) {
  if (!user) return "";
  if (user.fullName) return String(user.fullName);
  const full = `${user.first_name || ""} ${user.last_name || ""}`.trim();
  return full || String(user.username || "");
}

// ✅ آواتار حرف‌اول با رنگ ثابت بر اساس نام (بدون درخواست شبکه)
export function initialAvatarDataUrl(name) {
  const raw = String(name === null || name === undefined ? "" : name).trim();
  const letter = raw ? raw.charAt(0).toUpperCase() : "؟";
  const color = AVATAR_PALETTE[raw.length % AVATAR_PALETTE.length];
  return toDataUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">` +
      `<rect width="100" height="100" fill="${color}"/>` +
      `<text x="50" y="55" text-anchor="middle" dy=".35em" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="44" font-weight="bold">${escapeXml(letter)}</text>` +
      `</svg>`,
  );
}

// ✅ آدرس عکس پروفایل؛ اگر کاربر عکسی نداشت → آواتار پیش‌فرضِ بی‌خطا
export function resolveAvatarUrl(user, fallbackName) {
  const raw = user && user.profile_image;
  const src = raw === null || raw === undefined ? "" : String(raw).trim();

  if (src) {
    if (/^(?:https?:|data:|blob:)/i.test(src)) return src;
    // مسیرهای نسبی بک‌اند (‎/uploads/...‎) از همان میزبان فرانت پروکسی می‌شوند
    return src.startsWith("/") ? src : `/${src}`;
  }

  return initialAvatarDataUrl(fallbackName || avatarDisplayName(user));
}

// ✅ اعمال «حلقه‌ناپذیر» آواتار روی یک <img>
export function applyAvatar(img, user, fallbackName) {
  if (!img) return;

  const safeFallback = initialAvatarDataUrl(
    fallbackName || avatarDisplayName(user),
  );

  // پاک کردن هندلر قبلی تا هیچ هندلر کهنه‌ای باقی نماند
  img.onerror = null;
  img.src = resolveAvatarUrl(user, fallbackName);

  img.onerror = () => {
    // 🛡️ یک‌بارمصرف: بعد از اولین خطا پاک می‌شود → حلقهٔ GET غیرممکن است
    img.onerror = null;
    if (img.src !== safeFallback) img.src = safeFallback;
  };
}
