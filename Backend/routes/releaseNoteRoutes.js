// ============================================================
// routes/releaseNoteRoutes.js
// «تغییرات جدید / What's New» — همهٔ روت‌ها نیاز به احراز هویت دارند
// ------------------------------------------------------------
// ⚠️ ترتیب مهم است: روت‌های ثابت (/unseen و /history) قبل از :id بیایند
// دسترسی (قابل تنظیم از پنل مدیریت ← مدیریت نقش‌ها):
//   • خواندن در پنل  → مجوز releases.view
//   • نوشتن          → مجوز releases.manage (پیش‌فرض: فقط سوپرادمین)
//   • مودال کاربر    → هر کاربر لاگین‌شده (فقط نسخه‌های مجاز خودش)
// ============================================================
const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");
const releaseNoteController = require("../controllers/releaseNoteController");

// ✅ مشاهدهٔ مدیریتی (خواندن)
const CAN_READ = requirePermission("releases.view");
// ✅ ساخت/ویرایش/انتشار/آرشیو/حذف
const CAN_MANAGE = requirePermission("releases.manage");

router.use(protect);

// ===== کاربر جاری (قبل از :id) =====
router.get("/unseen", releaseNoteController.getUnseenRelease);
router.get("/history", releaseNoteController.getReleaseHistory);

// ===== مدیریت: فهرست (خواندن) =====
router.get("/", CAN_READ, releaseNoteController.listReleases);

// ===== کاربر: ثبت بازدید / «دیگر نشان نده» =====
router.post("/:id/seen", releaseNoteController.markReleaseSeen);

// ===== مدیریت: یک نسخه =====
router.get("/:id/stats", CAN_READ, releaseNoteController.getReleaseStats);
router.get("/:id", CAN_READ, releaseNoteController.getRelease);

// ===== مدیریت: تغییرات =====
router.post("/", CAN_MANAGE, releaseNoteController.createRelease);
router.patch("/:id", CAN_MANAGE, releaseNoteController.updateRelease);
router.post("/:id/publish", CAN_MANAGE, releaseNoteController.publishRelease);
router.post("/:id/archive", CAN_MANAGE, releaseNoteController.archiveRelease);
router.delete("/:id", CAN_MANAGE, releaseNoteController.deleteRelease);

module.exports = router;
