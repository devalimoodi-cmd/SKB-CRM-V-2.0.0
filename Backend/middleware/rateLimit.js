// ============================================================
// middleware/rateLimit.js
// ۱) هدرهای امنیتی  ۲) محدودیت نرخ درخواست
// ------------------------------------------------------------
// این ماژول عمداً «بدون هیچ پکیج خارجی» نوشته شده تا روی سرور
// نیازی به npm install اضافه نباشد (دیپلوی با git pull ساده بماند).
//
// نکته: چون درخواست‌ها از پروکسی فرانت‌اند می‌آید، آی‌پی واقعی کاربر
// از هدر X-Forwarded-For و با app.set("trust proxy", "loopback") خوانده می‌شود.
// برای غیرفعال‌سازی در تست: RATE_LIMIT_DISABLED=true
// ============================================================

// ============================================================
// ۱) هدرهای امنیتی
// ============================================================
const applySecurityHeaders = (req, res, next) => {
  res.removeHeader("X-Powered-By"); // نسخهٔ Express را لو نمی‌دهیم
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-DNS-Prefetch-Control", "off");
  // تصاویر/فایل‌های /uploads باید از دامنهٔ سایت هم قابل استفاده باشند
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.setHeader(
    "Permissions-Policy",
    "geolocation=(), microphone=(), camera=()",
  );

  // ✅ HSTS فقط وقتی HTTPS واقعاً فعال است (ENABLE_HSTS=true)
  // قبل از راه‌اندازی SSL این را فعال نکنید تا مرورگر کاربران را مجبور به HTTPS نکند.
  if (
    process.env.ENABLE_HSTS === "true" &&
    (req.secure || req.headers["x-forwarded-proto"] === "https")
  ) {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains",
    );
  }

  next();
};

// ============================================================
// ۲) محدودکنندهٔ نرخ (پنجرهٔ زمانی ثابت، در حافظه)
// ============================================================
const createRateLimiter = ({
  windowMs = 60 * 1000,
  max = 100,
  message = "تعداد درخواست‌ها بیش از حد مجاز است. لطفاً کمی بعد تلاش کنید.",
  decrementOnSuccess = false,
} = {}) => {
  const buckets = new Map(); // key → { count, resetAt }

  // پاک‌سازی دوره‌ای حافظه (هر ۵ دقیقه)
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, value] of buckets) {
      if (value.resetAt <= now) buckets.delete(key);
    }
  }, 5 * 60 * 1000);
  if (typeof cleanup.unref === "function") cleanup.unref();

  return (req, res, next) => {
    if (process.env.RATE_LIMIT_DISABLED === "true") return next();

    const key = req.ip || "unknown";
    const now = Date.now();
    let entry = buckets.get(key);

    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      buckets.set(key, entry);
    }

    entry.count += 1;
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);

    res.setHeader("RateLimit-Limit", max);
    res.setHeader("RateLimit-Remaining", Math.max(0, max - entry.count));
    res.setHeader("RateLimit-Reset", retryAfter);

    // درخواست‌های موفق از شمارش کم می‌شوند (مخصوص ورود موفق)
    if (decrementOnSuccess) {
      res.on("finish", () => {
        if (res.statusCode < 400 && entry.count > 0) entry.count -= 1;
      });
    }

    if (entry.count > max) {
      res.setHeader("Retry-After", retryAfter);
      return res.status(429).json({ success: false, message });
    }

    return next();
  };
};

// ===== محدودیت کلی API (هر دقیقه برای هر آی‌پی) =====
const apiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: Number(process.env.API_RATE_MAX || 1200),
  message: "تعداد درخواست‌ها بیش از حد مجاز است. لطفاً کمی بعد تلاش کنید.",
});

// ===== محدودیت ورود: فقط تلاش‌های ناموفق شمرده می‌شوند =====
const loginLimiter = createRateLimiter({
  windowMs: Number(process.env.LOGIN_RATE_WINDOW_MINUTES || 15) * 60 * 1000,
  max: Number(process.env.LOGIN_RATE_MAX || 30),
  message:
    "تلاش‌های ورود ناموفق بیش از حد مجاز بوده است. لطفاً ۱۵ دقیقه دیگر تلاش کنید.",
  decrementOnSuccess: true,
});

// ===== ساخت ادمین اولیه: فقط چند بار در ساعت =====
const setupAdminLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: Number(process.env.SETUP_ADMIN_RATE_MAX || 5),
  message: "تعداد تلاش‌ها بیش از حد مجاز است. لطفاً بعداً تلاش کنید.",
});

module.exports = {
  applySecurityHeaders,
  createRateLimiter,
  apiLimiter,
  loginLimiter,
  setupAdminLimiter,
};
