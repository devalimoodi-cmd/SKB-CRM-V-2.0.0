const express = require("express");
const router = express.Router();
const {
  createHall,
  getHallsByCustomer,
  getHallById,
  updateHall,
  deleteHall,
  toggleHallStatus,
  getHallFullInfo,
  getUnitCapacitySummary,
} = require("../controllers/hallController");

const { protect, authorize } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");

// ============================================
// مسیرهای مدیریت سالن
// ✅ کنترل دسترسی بر پایهٔ «مجوز» (پنل مدیریت ← مدیریت نقش‌ها)
// ⚠️ authorize قبلی حفظ شده ⇒ مجوز فقط می‌تواند محدودتر کند (بی‌خطر)
// ============================================

const CAN_WRITE = authorize("admin", "super_admin", "sub_admin", "expert");
const CAN_MANAGE = authorize("admin", "super_admin", "sub_admin");

// ایجاد سالن جدید
router.post(
  "/",
  protect,
  CAN_WRITE,
  requirePermission("halls.create"),
  createHall,
);

// دریافت لیست سالن‌های مشتری و دوره
router.get("/", protect, CAN_WRITE, requirePermission("halls.view"), getHallsByCustomer);

// خلاصه ظرفیت واحدهای مرغداری مشتری (باید قبل از GET /:id باشد)
router.get(
  "/capacity-summary/:customerId",
  protect,
  CAN_WRITE,
  requirePermission("halls.view"),
  getUnitCapacitySummary,
);

// دریافت یک سالن با ID
router.get("/:id", protect, CAN_WRITE, requirePermission("halls.view"), getHallById);

// بروزرسانی سالن
router.put("/:id", protect, CAN_WRITE, requirePermission("halls.edit"), updateHall);

// حذف منطقی سالن
router.delete(
  "/:id",
  protect,
  CAN_MANAGE,
  requirePermission("halls.delete"),
  deleteHall,
);

// فعال/غیرفعال کردن سالن
router.put(
  "/toggle-status/:id",
  protect,
  CAN_MANAGE,
  requirePermission("halls.toggle"),
  toggleHallStatus,
);

// دریافت اطلاعات کامل سالن (فهمراه با فیزیکی، سیستم‌ها، آبخوری، بهداشت)
router.get(
  "/full-info/:id",
  protect,
  CAN_WRITE,
  requirePermission("halls.view"),
  getHallFullInfo,
);

module.exports = router;
