const express = require("express");
const router = express.Router();
const periodController = require("../controllers/periodController");
const { protect, authorize } = require("../middleware/auth");

// ============================================
// همه مسیرهای مربوط به دوره‌ها
// ============================================

// مسیرهای عمومی (برای کاربران لاگین شده - سطح دسترسی در کنترلر بررسی می‌شود)
router.get("/", protect, periodController.getPeriods);
router.get("/:id", protect, periodController.getPeriodById);

//   دریافت شماره دوره بعدی برای یک مشتری
router.get(
  "/next-number/:customerId",
  protect,
  authorize("expert", "admin", "super_admin"),
  periodController.getNextPeriodNumber,
);

// مسیرهای محافظت شده (فقط کارشناسان و مدیران)
router.post(
  "/",
  protect,
  authorize("expert", "admin", "super_admin"),
  periodController.createPeriod,
);
router.put(
  "/:id",
  protect,
  authorize("expert", "admin", "super_admin"),
  periodController.updatePeriod,
);
router.delete(
  "/:id",
  protect,
  authorize("expert", "admin", "super_admin"),
  periodController.deletePeriod,
);

module.exports = router;
