const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");
const settingsController = require("../controllers/settingsController");

// همه مسیرها نیاز به احراز هویت دارند
router.use(protect);

// دریافت همه تنظیمات (هر کاربر لاگین‌شده)
// ✅ مجوز settings.view (پیش‌فرض: کارشناس و بالاتر)
router.get("/", requirePermission("settings.view"), settingsController.getSettings);

// بروزرسانی یک تنظیم (فقط مدیر میانی / مدیر اصلی / سوپر ادمین)
router.put(
  "/:key",
  authorize("sub_admin", "admin", "super_admin"),
  requirePermission("settings.edit"),
  settingsController.updateSetting,
);

module.exports = router;
