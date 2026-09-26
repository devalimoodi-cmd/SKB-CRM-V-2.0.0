// routes/bookmarkRoutes.js
// ✅ کنترل دسترسی بر پایهٔ مجوز (پنل مدیریت ← مدیریت نقش‌ها)
const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");
const bookmarkController = require("../controllers/bookmarkController");

// همه روت‌ها نیاز به احراز هویت دارند
router.use(protect);

// ============================================================
// روت‌های اصلی
// ============================================================

// دریافت لیست بوکمارک‌ها (با فیلتر)
router.get("/", requirePermission("bookmarks.view"), bookmarkController.getBookmarks);

// دریافت آمار بوکمارک‌ها
router.get(
  "/stats",
  requirePermission("bookmarks.view"),
  bookmarkController.getBookmarkStats,
);

// دریافت یک بوکمارک
router.get(
  "/:id",
  requirePermission("bookmarks.view"),
  bookmarkController.getBookmarkById,
);

// ایجاد بوکمارک جدید
router.post("/", requirePermission("bookmarks.create"), bookmarkController.createBookmark);

// بروزرسانی بوکمارک
router.put(
  "/:id",
  requirePermission("bookmarks.edit"),
  bookmarkController.updateBookmark,
);

// تغییر وضعیت بوکمارک
router.patch(
  "/:id/status",
  requirePermission("bookmarks.status"),
  bookmarkController.changeStatus,
);

// حذف بوکمارک
router.delete(
  "/:id",
  requirePermission("bookmarks.delete"),
  bookmarkController.deleteBookmark,
);

module.exports = router;
