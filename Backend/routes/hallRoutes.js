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
} = require("../controllers/hallController");

const { protect, authorize } = require("../middleware/auth");

// ============================================
// مسیرهای مدیریت سالن
// ============================================

// ایجاد سالن جدید
router.post(
  "/",
  protect,
  authorize("admin", "super_admin", "sub_admin", "expert"),
  createHall,
);

// دریافت لیست سالن‌های مشتری و دوره
router.get(
  "/",
  protect,
  authorize("admin", "super_admin", "sub_admin", "expert"),
  getHallsByCustomer,
);

// دریافت یک سالن با ID
router.get(
  "/:id",
  protect,
  authorize("admin", "super_admin", "sub_admin", "expert"),
  getHallById,
);

// بروزرسانی سالن
router.put(
  "/:id",
  protect,
  authorize("admin", "super_admin", "sub_admin", "expert"),
  updateHall,
);

// حذف منطقی سالن
router.delete("/:id", protect, authorize("admin", "super_admin", "sub_admin"), deleteHall);

// فعال/غیرفعال کردن سالن
router.put(
  "/toggle-status/:id",
  protect,
  authorize("admin", "super_admin", "sub_admin"),
  toggleHallStatus,
);

// دریافت اطلاعات کامل سالن (همراه با فیزیکی، سیستم‌ها، آبخوری، بهداشت)
router.get(
  "/full-info/:id",
  protect,
  authorize("admin", "super_admin", "sub_admin", "expert"),
  getHallFullInfo,
);

module.exports = router;
