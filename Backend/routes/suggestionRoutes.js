// ============================================================
// routes/suggestionRoutes.js
// «نظرات و پیشنهادات» — همهٔ روت‌ها نیاز به احراز هویت دارند
// ⚠️ ترتیب مهم است: روت‌های ثابت قبل از روت‌های :id بیایند
// ✅ کنترل دسترسی مدیریتی بر پایهٔ مجوز (پنل ← مدیریت نقش‌ها)
// ============================================================
const express = require("express");
const router = express.Router();
const { protect, authorize, ADMIN_ROLES } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");
const { createRateLimiter } = require("../middleware/rateLimit");
const suggestionController = require("../controllers/suggestionController");

const CAN_VIEW = requirePermission("suggestions.admin.view");
const CAN_REPLY = requirePermission("suggestions.reply");
const CAN_STATUS = requirePermission("suggestions.status");
const CAN_DELETE = requirePermission("suggestions.delete");
const ADMIN_ONLY = authorize(...ADMIN_ROLES);

// ✅ محدودیت نرخ برای ارسال پیام (هر آی‌پی) — ضد اسپم/فلود
const suggestionLimiter = createRateLimiter({
  windowMs: Number(process.env.SUGGESTION_RATE_WINDOW_MINUTES || 15) * 60 * 1000,
  max: Number(process.env.SUGGESTION_RATE_MAX || 20),
  message:
    "تعداد پیام‌های ارسالی بیش از حد مجاز است. لطفاً چند دقیقه بعد تلاش کنید.",
});

router.use(protect);

// ===== کاربر جاری =====
router.post("/", suggestionLimiter, suggestionController.createSuggestion);
router.get("/mine", suggestionController.getMySuggestions);
router.get("/unread-count", suggestionController.getUnreadCount);

// ===== ادمین‌ها (قبل از :id) =====
router.get("/", CAN_VIEW, suggestionController.listSuggestions);

// ===== گفتگوی خود کاربر =====
router.get("/:id", suggestionController.getMyThread);
router.post("/:id/reply", suggestionLimiter, suggestionController.replyToThread);
router.post("/:id/read", suggestionController.markThreadRead);

// ===== ادمین‌ها روی یک گفتگو =====
router.get("/:id/admin", CAN_VIEW, suggestionController.getThreadAdmin);
router.post("/:id/admin-reply", CAN_REPLY, suggestionController.replyAsAdmin);
router.patch("/:id", CAN_STATUS, suggestionController.updateSuggestion);

// ✅ حذف یک پیام از گفتگو (پیام اول و کل گفتگو: مسیر پایین)
router.delete(
  "/:id/messages/:messageId",
  ADMIN_ONLY,
  CAN_DELETE,
  suggestionController.deleteSuggestionMessage,
);

router.delete(
  "/:id",
  ADMIN_ONLY,
  CAN_DELETE,
  suggestionController.deleteSuggestion,
);

module.exports = router;
