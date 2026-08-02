const express = require("express");
const router = express.Router();
const hallSystemController = require("../controllers/hallSystemController");
const { protect, authorize } = require("../middleware/auth");

// همه مسیرها نیاز به احراز هویت دارند
router.use(protect);

// دریافت اطلاعات سیستم‌های یک سالن
router.get("/:hall_id", hallSystemController.getSystemByHallId);

// ایجاد یا بروزرسانی اطلاعات سیستم‌ها (فقط کارشناسان و مدیران)
router.post(
  "/",
  authorize("expert", "admin", "super_admin"),
  hallSystemController.createOrUpdateSystem,
);

// حذف اطلاعات سیستم‌ها (فقط مدیران)
router.delete(
  "/:id",
  authorize("admin", "super_admin"),
  hallSystemController.deleteSystem,
);

module.exports = router;
