// routes/bookmarkRoutes.js
const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const bookmarkController = require("../controllers/bookmarkController");

// همه روت‌ها نیاز به احراز هویت دارند
router.use(protect);

// ============================================================
// روت‌های اصلی
// ============================================================

// دریافت لیست بوکمارک‌ها (با فیلتر)
router.get("/", bookmarkController.getBookmarks);

// دریافت آمار بوکمارک‌ها
router.get("/stats", bookmarkController.getBookmarkStats);

// دریافت یک بوکمارک
router.get("/:id", bookmarkController.getBookmarkById);

// ایجاد بوکمارک جدید
router.post("/", bookmarkController.createBookmark);

// بروزرسانی بوکمارک
router.put("/:id", bookmarkController.updateBookmark);

// تغییر وضعیت بوکمارک
router.patch("/:id/status", bookmarkController.changeStatus);

// حذف بوکمارک
router.delete("/:id", bookmarkController.deleteBookmark);

module.exports = router;
