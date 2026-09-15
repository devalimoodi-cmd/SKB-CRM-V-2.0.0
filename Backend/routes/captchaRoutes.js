// ============================================================
// routes/captchaRoutes.js
// مسیر عمومی دریافت کپچا برای صفحهٔ ورود
//   GET /api/captcha  →  { enabled, id, svg, expiresInSeconds }
// ------------------------------------------------------------
// • بدون احراز هویت (لازم پیش از ورود)
// • محدودیت نرخ دارد تا کسی بی‌نهایت تصویر نگیرد
// • اگر CAPTCHA_DEBUG=true و NODE_ENV !== production باشد،
//   پاسخ درست در فیلد debugAnswer هم برمی‌گردد (فقط برای تست)
// ============================================================
const express = require("express");
const router = express.Router();

const { createChallenge, isEnabled } = require("../utils/captcha");
const { createRateLimiter } = require("../middleware/rateLimit");
const { successResponse } = require("../utils/response");

// حداکثر ۹۰ چالش در دقیقه برای هر آی‌پی
const captchaLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: Number(process.env.CAPTCHA_RATE_MAX || 90),
  message: "تعداد درخواست کپچا بیش از حد مجاز است. کمی بعد تلاش کنید.",
});

router.get("/", captchaLimiter, (req, res) => {
  if (!isEnabled()) {
    return successResponse(res, { enabled: false }, "کپچا غیرفعال است");
  }

  const { id, svg, expiresInSeconds, code } = createChallenge();

  const data = { enabled: true, id, svg, expiresInSeconds };

  const debugAllowed =
    process.env.CAPTCHA_DEBUG === "true" && process.env.NODE_ENV !== "production";
  if (debugAllowed) data.debugAnswer = code;

  return successResponse(res, data, "کد امنیتی ساخته شد");
});

module.exports = router;
