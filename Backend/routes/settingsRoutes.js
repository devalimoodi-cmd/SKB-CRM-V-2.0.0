const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const settingsController = require("../controllers/settingsController");

// همه مسیرها نیاز به احراز هویت دارند
router.use(protect);

// دریافت همه تنظیمات (هر کاربر لاگین‌شده)
router.get("/", settingsController.getSettings);

// بروزرسانی یک تنظیم (فقط مدیر میانی / مدیر اصلی / سوپر ادمین)
router.put(
  "/:key",
  authorize("sub_admin", "admin", "super_admin"),
  settingsController.updateSetting,
);

module.exports = router;
