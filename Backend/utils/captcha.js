// ============================================================
// utils/captcha.js
// کپچای ساده و کامل داخلی (بدون هیچ پکیج خارجی و بدون اینترنت)
// ------------------------------------------------------------
// • تصویر SVG تولید می‌شود و در پاسخ API به‌صورت متن برگردانده می‌شود
// • پاسخ کپچا فقط در حافظهٔ سرور نگه داشته می‌شود (۵ دقیقه، یک‌بارمصرف)
// • متغیرهای محیطی:
//     CAPTCHA_ENABLED=true|false   (پیش‌فرض: true)
//     CAPTCHA_LENGTH=5             (۴ تا ۸ کاراکتر)
//     CAPTCHA_TTL_MINUTES=5        (مدت اعتبار)
// ============================================================
const crypto = require("node:crypto");

// id → { answer, expiresAt }
const store = new Map();

// حروف/اعداد گیج‌کننده (O/0 و I/1/L) حذف شده‌اند تا برای کاربر واضح باشد
const CHARACTERS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

const getConfig = () => ({
  enabled: process.env.CAPTCHA_ENABLED !== "false",
  length: Math.min(Math.max(Number(process.env.CAPTCHA_LENGTH || 5), 4), 8),
  ttlMs: Math.max(1, Number(process.env.CAPTCHA_TTL_MINUTES || 5)) * 60 * 1000,
});

const isEnabled = () => getConfig().enabled;

const randomInt = (min, max) => crypto.randomInt(min, max + 1);

const randomCode = (length) => {
  let code = "";
  for (let i = 0; i < length; i += 1) {
    code += CHARACTERS[randomInt(0, CHARACTERS.length - 1)];
  }
  return code;
};

const randomColor = (min, max) =>
  `rgb(${randomInt(min, max)},${randomInt(min, max)},${randomInt(min, max)})`;

const escapeXml = (value) =>
  String(value).replace(
    /[<>&"']/g,
    (char) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[char],
  );

// پاک‌سازی چالش‌های منقضی
const cleanup = () => {
  const now = Date.now();
  for (const [id, item] of store) {
    if (item.expiresAt <= now) store.delete(id);
  }
};

const cleanupTimer = setInterval(cleanup, 60 * 1000);
if (typeof cleanupTimer.unref === "function") cleanupTimer.unref();

// ============================================================
// ساخت تصویر SVG
// ============================================================
const renderSvg = (code) => {
  const charWidth = 42;
  const width = code.length * charWidth + 26;
  const height = 72;
  const parts = [];

  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="captcha">`,
  );
  parts.push(`<rect width="100%" height="100%" rx="10" fill="#f3f6f4"/>`);

  // خطوط نویز
  for (let i = 0; i < 6; i += 1) {
    parts.push(
      `<line x1="${randomInt(0, width)}" y1="${randomInt(0, height)}" x2="${randomInt(0, width)}" y2="${randomInt(0, height)}" stroke="${randomColor(130, 195)}" stroke-width="${randomInt(1, 2)}"/>`,
    );
  }

  // نقطه‌های نویز
  for (let i = 0; i < 45; i += 1) {
    parts.push(
      `<circle cx="${randomInt(0, width)}" cy="${randomInt(0, height)}" r="${randomInt(1, 2)}" fill="${randomColor(130, 195)}"/>`,
    );
  }

  // کاراکترها با چرخش و جابه‌جایی تصادفی
  code.split("").forEach((char, index) => {
    const x = 24 + index * charWidth + randomInt(-4, 4);
    const y = 48 + randomInt(-6, 6);
    const rotate = randomInt(-26, 26);
    parts.push(
      `<text x="${x}" y="${y}" text-anchor="middle" font-family="Verdana,DejaVu Sans,Tahoma,sans-serif" font-size="${randomInt(30, 38)}" font-weight="bold" fill="${randomColor(10, 95)}" transform="rotate(${rotate} ${x} ${y})">${escapeXml(char)}</text>`,
    );
  });

  parts.push("</svg>");
  return parts.join("");
};

// ============================================================
// ساخت چالش جدید
// ============================================================
const createChallenge = () => {
  cleanup();
  const { length, ttlMs } = getConfig();

  const code = randomCode(length);
  const id = crypto.randomBytes(16).toString("hex");

  store.set(id, { answer: code.toUpperCase(), expiresAt: Date.now() + ttlMs });

  return {
    id,
    svg: renderSvg(code),
    expiresInSeconds: Math.floor(ttlMs / 1000),
    // ⚠️ فقط برای تست/دیباگ محلی استفاده می‌شود (در route کنترل می‌شود)
    code,
  };
};

// ============================================================
// بررسی پاسخ کاربر (یک‌بارمصرف)
// ============================================================
const verifyChallenge = (id, answer) => {
  if (!id || !answer) return { ok: false, reason: "missing" };

  const key = String(id);
  const item = store.get(key);

  if (!item) return { ok: false, reason: "invalid" };

  // در هر حالت یک‌بارمصرف است (جلوگیری از تلاش مجدد روی همان تصویر)
  store.delete(key);

  if (item.expiresAt <= Date.now()) return { ok: false, reason: "expired" };
  if (item.answer !== String(answer).trim().toUpperCase()) {
    return { ok: false, reason: "wrong" };
  }

  return { ok: true };
};

const pendingCount = () => store.size;

module.exports = {
  getConfig,
  isEnabled,
  createChallenge,
  verifyChallenge,
  pendingCount,
};
