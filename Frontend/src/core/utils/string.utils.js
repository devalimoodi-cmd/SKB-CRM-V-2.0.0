export function truncateText(text, maxLength = 50) {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
}

export function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function toPersianNumber(num) {
  if (num === null || num === undefined) return "۰";
  const digits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
  return String(num).replace(/\d/g, (d) => digits[parseInt(d)]);
}

export function toEnglishNumber(str) {
  const persianNumbers = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
  const englishNumbers = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
  let result = str;
  persianNumbers.forEach((p, i) => {
    result = result.replace(new RegExp(p, "g"), englishNumbers[i]);
  });
  return result;
}

export function generateSlug(text) {
  if (!text) return "";
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidPhone(phone) {
  return /^09[0-9]{9}$/.test(phone);
}

export function isValidPostalCode(code) {
  return /^[0-9]{10}$/.test(code);
}

// ===== ✅ ایمن‌سازی متن برای قرار دادن در innerHTML =====
// نکته: علاوه بر < و > و &، کوتیشن‌ها هم escape می‌شوند
// تا استفاده در اتریبیوت‌ها (value="...") هم ایمن باشد.
// در مرورگر از DOM استفاده می‌کند و در Node (تست) از جایگزینی رشته‌ای.
export function escapeHtml(text) {
  if (text === null || text === undefined) return "";
  const str = String(text);
  if (typeof document !== "undefined" && document.createElement) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ===== ✅ ایمن‌سازی مقدار برای داخل onclick="...." (رشتهٔ JS داخل اتریبیوت HTML) =====
// مثال: onclick="f(&quot;O'Brien&quot;, 5)"  →  JS:  f("O'Brien", 5)
export function escapeJsAttr(value) {
  const json = JSON.stringify(String(value ?? ""));
  return json
    .replace(/</g, "\\u003C")
    .replace(/>/g, "\\u003E")
    .replace(/&/g, "\\u0026")
    .replace(/"/g, "&quot;");
}

// ===== ✅ پاک‌سازی HTML قبل از document.write در پنجرهٔ چاپ/گزارش =====
// پنجرهٔ چاپ‌شده هم‌مبدأ (same-origin) است؛ اگر دادهٔ دیتابیس اسکریپت یا
// هندلر inline داشته باشد می‌تواند به window.opener و توکن کاربر دسترسی بگیرد.
// نکته: اسکریپتِ «چاپ خودکار» خودِ گزارش‌ها حفظ می‌شود تا چاپ نشکند.
const SAFE_PRINT_SCRIPT =
  /^\s*window\.onload\s*=\s*function\s*\(\s*\)\s*\{\s*window\.print\(\)\s*;?\s*\}\s*$/i;

export function sanitizeHtmlDocument(html) {
  return (
    String(html ?? "")
      // ۱) اسکریپت‌ها: فقط اسکریپت چاپ خودکار مجاز است
      .replace(
        /<script\b[^>]*>([\s\S]*?)<\s*\\?\/\s*script\s*>/gi,
        (match, code) => (SAFE_PRINT_SCRIPT.test(code) ? match : ""),
      )
      .replace(/<\/?script\b[^>]*>/gi, "")
      // ۲) تگ‌های خطرناک
      .replace(/<\/?(iframe|object|embed|applet)\b[^>]*>/gi, "")
      .replace(/\s*<meta[^>]*http-equiv\s*=\s*["']?refresh[\s\S]*?>/gi, "")
      // ۳) هندلرهای inline (onclick، onerror، onload، …)
      .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "")
      .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "")
      .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, "")
      // ۴) آدرس‌های خطرناک
      .replace(
        /\b(href|src|xlink:href|formaction|data|action|background)\s*=\s*(["'])\s*(?:javascript|vbscript|data:text\/html)[\s\S]*?\2/gi,
        "$1=$2#$2",
      )
  );
}

export function getInitials(name) {
  if (!name) return "";
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

// ===== ✅ تابع جدید =====
export function getDefaultAvatar() {
  return "/assets/images/default-avatar.png";
}
