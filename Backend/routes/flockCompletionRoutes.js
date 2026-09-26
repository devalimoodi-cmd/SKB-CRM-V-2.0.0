const express = require("express");
const router = express.Router();
const flockCompletionController = require("../controllers/flockCompletionController");
const { protect, authorize } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");

// ============================================
// مسیرهای اطلاعات پایان دوره ها (Flock Completion)
// ✅ کنترل دسترسی بر پایهٔ مجوز (پنل مدیریت ← مدیریت نقش‌ها)
// ============================================

// ثبت اطلاعات پایان دوره برای یک یا چند واحد/گله
router.post(
  "/complete-periods",
  protect,
  authorize("expert", "admin", "sub_admin", "super_admin"),
  requirePermission("hatchery.completion.create"),
  flockCompletionController.completePeriods,
);

// ثبت پایان دوره مستقیم با شناسه گله (سرگروه + ریز تفکیکی per سالن)
router.post(
  "/complete-flock",
  protect,
  authorize("expert", "admin", "sub_admin", "super_admin"),
  requirePermission("hatchery.completion.create"),
  flockCompletionController.completeFlockPeriods,
);

// دریافت لیست اطلاعات پایان دوره
router.get(
  "/",
  protect,
  requirePermission("hatchery.view"),
  flockCompletionController.getFlockCompletions,
);

// پیش‌نمایش اطلاعات سیستمی پایان یک گله
router.get(
  "/preview/:flockId",
  protect,
  requirePermission("hatchery.view"),
  flockCompletionController.getFlockCompletionPreview,
);

// دریافت اطلاعات پایان دوره های یک واحد
router.get(
  "/unit/:unitId",
  protect,
  requirePermission("hatchery.view"),
  flockCompletionController.getCompletionsByUnit,
);

// دریافت پایان دوره یک گله (سرگروه + ریز سالن‌ها)
router.get(
  "/flock/:flockId",
  protect,
  requirePermission("hatchery.view"),
  flockCompletionController.getFlockCompletionByFlockId,
);

// دریافت اطلاعات پایان دوره یک گله
router.get(
  "/:id",
  protect,
  requirePermission("hatchery.view"),
  flockCompletionController.getFlockCompletionById,
);

// ویرایش/بروزرسانی اطلاعات پایان دوره
router.put(
  "/:id",
  protect,
  authorize("expert", "admin", "sub_admin", "super_admin"),
  requirePermission("hatchery.completion.edit"),
  flockCompletionController.updateFlockCompletion,
);

// حذف (بازگردانی) یک پایان دوره
router.delete(
  "/:id",
  protect,
  authorize("expert", "admin", "sub_admin", "super_admin"),
  requirePermission("hatchery.completion.delete"),
  flockCompletionController.deleteFlockCompletion,
);

module.exports = router;
