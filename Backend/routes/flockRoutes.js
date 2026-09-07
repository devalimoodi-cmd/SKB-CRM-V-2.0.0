// ================================================================
// routes/flockRoutes.js
// روت‌های «گله» (دوره پرورش)
// ================================================================

const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const flockController = require("../controllers/flockController");

// مشاهده (لاگین)
router.get("/", protect, flockController.getFlocks);
router.get("/:id", protect, flockController.getFlockById);

// عملیات (کارشناس و مدیران)
router.post(
  "/",
  protect,
  authorize("expert", "admin", "super_admin", "sub_admin"),
  flockController.createFlock,
);
router.put(
  "/:id/end",
  protect,
  authorize("expert", "admin", "super_admin", "sub_admin"),
  flockController.endFlock,
);

// تغییر وضعیت کل گله (فعال / غیرفعال)
router.put(
  "/:id/status",
  protect,
  authorize("expert", "admin", "super_admin", "sub_admin"),
  flockController.setFlockStatus,
);

// بروزرسانی اطلاعات مشترک گله
router.put(
  "/:id",
  protect,
  authorize("expert", "admin", "super_admin", "sub_admin"),
  flockController.updateFlock,
);

module.exports = router;
