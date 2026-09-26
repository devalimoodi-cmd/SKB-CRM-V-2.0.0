const express = require("express");
const router = express.Router();
const hallSystemController = require("../controllers/hallSystemController");
const { protect, authorize } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");

// ✅ کنترل دسترسی بر پایهٔ مجوز (سیستم‌های سالن)
// همه مسیرها نیاز به احراز هویت دارند
router.use(protect);

// دریافت اطلاعات سیستم‌های یک سالن
router.get(
  "/:hall_id",
  requirePermission("halls.view"),
  hallSystemController.getSystemByHallId,
);

// ایجاد یا بروزرسانی اطلاعات سیستم‌ها (فقط کارشناسان و مدیران)
router.post(
  "/",
  authorize("expert", "admin", "sub_admin", "super_admin"),
  requirePermission("halls.edit"),
  hallSystemController.createOrUpdateSystem,
);

// حذف اطلاعات سیستم‌ها (فقط مدیران)
router.delete(
  "/:id",
  authorize("admin", "super_admin", "sub_admin"),
  requirePermission("halls.delete"),
  hallSystemController.deleteSystem,
);

module.exports = router;
