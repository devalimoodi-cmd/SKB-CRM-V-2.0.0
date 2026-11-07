// ============================================================
// routes/registrationRoutes.js
// «ثبت‌نام عمومی مشتری» + «صف تأیید مدیر» — فاز ۱۳.۶
// ------------------------------------------------------------
// مسیرها (router روی /api/registrations نصب می‌شود):
//   GET  /config                 عمومی  → { enabled, captcha_enabled, ... }
//   POST /                       عمومی  → ثبت درخواست (کپچا + rate-limit)
//   GET  /pending-count          users.registrations.view
//   GET  /                       users.registrations.view
//   POST /:id/approve            users.registrations.review (+ users.customer.link در کنترلر)
//   POST /:id/reject             users.registrations.review
// ------------------------------------------------------------
// ⚠️ عمومی فقط `GET /config` و `POST /` است؛ بقیه پشت protect + مجوز.
// ⚠️ هیچ توکنی در ثبت‌نام صادر نمی‌شود (کاربر تا تأیید مدیر وجود ندارد).
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

// ===== عمومی =====
router.get("/config", controller.getPublicConfig);
router.post("/", registerLimiter, controller.publicRegister);

// ===== مدیریت (ترتیب مهم: مسیرهای ثابت پیش از /:id) =====
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
