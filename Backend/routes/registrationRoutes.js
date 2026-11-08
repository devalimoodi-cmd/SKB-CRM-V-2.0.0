// ============================================================
// routes/registrationRoutes.js
// «ثبت‌نام عمومی مشتری» + «صف تأیید مدیر» — فاز ۱۳.۶
// ------------------------------------------------------------
// مسیرها (router روی /api/registrations نصب می‌شود):
//   GET  /config                 عمومی  → { enabled, auto_approve, captcha_enabled, ... }
//   GET  /customer-types         عمومی  → [{ id, name }] انواع فعال (موج ۱۳.۷.۲)
//   POST /                       عمومی  → ثبت درخواست (کپچا + rate-limit)
//   GET  /settings               users.registrations.view   → { auto_approve, can_toggle, ... }
//   PUT  /settings               users.registrations.review → روشن/خاموش «تأیید خودکار» (موج ۱۳.۷.۳)
//   GET  /pending-count          users.registrations.view
//   GET  /                       users.registrations.view
//   POST /:id/approve            users.registrations.review (+ users.customer.link در کنترلر)
//   POST /:id/reject             users.registrations.review
// ------------------------------------------------------------
// ⚠️ عمومی فقط `GET /config`، `GET /customer-types` و `POST /` است؛ بقیه پشت protect + مجوز.
// ⚠️ هیچ توکنی در ثبت‌نام صادر نمی‌شود (کاربر تا تأیید مدیر وجود ندارد)؛
//    در حالت «تأیید خودکار» هم کاربر همان لحظه ساخته می‌شود ولی توکن
//    صادر نمی‌شود — ورود از مسیر عادی /login انجام می‌شود.
// ============================================================
const express = require("express");
const router = express.Router();

const controller = require("../controllers/registrationController");
const { protect } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");
const { createRateLimiter } = require("../middleware/rateLimit");

// ضدّ ثبت‌نام انبوه: ۵ درخواست در ساعت برای هر آی‌پی
const registerLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: Number(process.env.REGISTER_RATE_MAX || 5),
  message:
    "تعداد درخواست‌های ثبت‌نام از این دستگاه بیش از حد مجاز است. لطفاً بعداً تلاش کنید.",
});

// لیمیتر سبک برای دیکشنری عمومی فرم (ضدّ اسکرپ — سخاوتمندانه‌تر از ثبت‌نام)
const publicDictLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: Number(process.env.PUBLIC_DICT_RATE_MAX || 120),
  message: "تعداد درخواست‌های شما بیش از حد مجاز است. لطفاً کمی بعد تلاش کنید.",
});

// ===== عمومی =====
router.get("/config", controller.getPublicConfig);
// ✅ موج ۱۳.۷.۲ — دیکشنری «نوع مشتری» برای فرم عمومی (فقط id + name انواع فعال)
router.get("/customer-types", publicDictLimiter, controller.getPublicCustomerTypes);
router.post("/", registerLimiter, controller.publicRegister);

// ===== مدیریت (ترتیب مهم: مسیرهای ثابت پیش از /:id) =====
// ✅ موج ۱۳.۷.۳ — تنظیمات صف (سوییچ «تأیید خودکار»)
router.get(
  "/settings",
  protect,
  requirePermission("users.registrations.view"),
  controller.getReviewSettings,
);

router.put(
  "/settings",
  protect,
  requirePermission("users.registrations.review"),
  controller.updateReviewSettings,
);

router.get(
  "/pending-count",
  protect,
  requirePermission("users.registrations.view"),
  controller.getPendingCount,
);

router.get(
  "/",
  protect,
  requirePermission("users.registrations.view"),
  controller.listRegistrations,
);

router.post(
  "/:id/approve",
  protect,
  requirePermission("users.registrations.review"),
  controller.approveRegistration,
);

router.post(
  "/:id/reject",
  protect,
  requirePermission("users.registrations.review"),
  controller.rejectRegistration,
);

module.exports = router;
