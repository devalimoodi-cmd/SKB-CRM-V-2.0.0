// ============================================================
// routes/releaseNoteRoutes.js
// «تغییرات جدید / What's New» — همهٔ روت‌ها نیاز به احراز هویت دارند
// ------------------------------------------------------------
// ⚠️ ترتیب مهم است: روت‌های ثابت (/unseen و /history) قبل از :id بیایند
// دسترسی:
//   • خواندن در پنل  → همهٔ ادمین‌ها (admin/sub_admin/super_admin)
//   • نوشتن          → فقط سوپر ادمین
//   • مودال کاربر    → هر کاربر لاگین‌شده (فقط نسخه‌های مجاز خودش)
// ============================================================
const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const releaseNoteController = require("../controllers/releaseNoteController");

// ✅ مشاهدهٔ مدیریتی (خواندن) — همهٔ ادمین‌ها
const ADMIN_READ = authorize("admin", "sub_admin", "super_admin");
// ✅ ساخت/ویرایش/انتشار/آرشیو/حذف — فقط سوپر ادمین
const SUPER_ONLY = authorize("super_admin");

router.use(protect);

// ===== کاربر جاری (قبل از :id) =====
router.get("/unseen", releaseNoteController.getUnseenRelease);
router.get("/history", releaseNoteController.getReleaseHistory);

// ===== مدیریت: فهرست (خواندن) =====
router.get("/", ADMIN_READ, releaseNoteController.listReleases);

// ===== کاربر: ثبت بازدید / «دیگر نشان نده» =====
router.post("/:id/seen", releaseNoteController.markReleaseSeen);

// ===== مدیریت: یک نسخه =====
router.get("/:id/stats", ADMIN_READ, releaseNoteController.getReleaseStats);
router.get("/:id", ADMIN_READ, releaseNoteController.getRelease);

// ===== مدیریت: تغییرات (فقط سوپر ادمین) =====
router.post("/", SUPER_ONLY, releaseNoteController.createRelease);
router.patch("/:id", SUPER_ONLY, releaseNoteController.updateRelease);
router.post("/:id/publish", SUPER_ONLY, releaseNoteController.publishRelease);
router.post("/:id/archive", SUPER_ONLY, releaseNoteController.archiveRelease);
router.delete("/:id", SUPER_ONLY, releaseNoteController.deleteRelease);

module.exports = router;
