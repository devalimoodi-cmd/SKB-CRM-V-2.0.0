// ============================================================
// routes/suggestionRoutes.js
// «نظرات و پیشنهادات» — همهٔ روت‌ها نیاز به احراز هویت دارند
// ⚠️ ترتیب مهم است: روت‌های ثابت قبل از روت‌های :id بیایند
// ============================================================
const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const { createRateLimiter } = require("../middleware/rateLimit");
const suggestionController = require("../controllers/suggestionController");

const ADMIN_ONLY = authorize("admin", "super_admin", "sub_admin");

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
router.get("/", ADMIN_ONLY, suggestionController.listSuggestions);

// ===== گفتگوی خود کاربر =====
router.get("/:id", suggestionController.getMyThread);
router.post("/:id/reply", suggestionLimiter, suggestionController.replyToThread);
router.post("/:id/read", suggestionController.markThreadRead);

// ===== ادمین‌ها روی یک گفتگو =====
router.get("/:id/admin", ADMIN_ONLY, suggestionController.getThreadAdmin);
router.post("/:id/admin-reply", ADMIN_ONLY, suggestionController.replyAsAdmin);
router.patch("/:id", ADMIN_ONLY, suggestionController.updateSuggestion);

// ✅ حذف یک پیام از گفتگو (پیام اول و کل گفتگو: مسیر پایین)
router.delete(
  "/:id/messages/:messageId",
  ADMIN_ONLY,
  suggestionController.deleteSuggestionMessage,
);

router.delete("/:id", ADMIN_ONLY, suggestionController.deleteSuggestion);

module.exports = router;
