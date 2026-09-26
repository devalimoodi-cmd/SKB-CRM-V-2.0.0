// ================================================================
// routes/flockRoutes.js
// روت‌های «گله» (دوره پرورش)
// ✅ کنترل دسترسی بر پایهٔ مجوز (پنل مدیریت ← مدیریت نقش‌ها)
// ================================================================

const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");
const flockController = require("../controllers/flockController");

const CAN_WRITE = authorize("expert", "admin", "super_admin", "sub_admin");

// مشاهده (لاگین)
router.get("/", protect, requirePermission("hatchery.view"), flockController.getFlocks);
router.get(
  "/:id",
  protect,
  requirePermission("hatchery.view"),
  flockController.getFlockById,
);

// عملیات (کارشناس و مدیران)
router.post(
  "/",
  protect,
  CAN_WRITE,
  requirePermission("hatchery.placement.create"),
  flockController.createFlock,
);
router.put(
  "/:id/end",
  protect,
  CAN_WRITE,
  requirePermission("hatchery.completion.create"),
  flockController.endFlock,
);

// تغییر وضعیت کل گله (فعال / غیرفعال)
router.put(
  "/:id/status",
  protect,
  CAN_WRITE,
  requirePermission("hatchery.placement.toggle"),
  flockController.setFlockStatus,
);

// بروزرسانی اطلاعات مشترک گله
router.put(
  "/:id",
  protect,
  CAN_WRITE,
  requirePermission("hatchery.placement.edit"),
  flockController.updateFlock,
);

module.exports = router;
