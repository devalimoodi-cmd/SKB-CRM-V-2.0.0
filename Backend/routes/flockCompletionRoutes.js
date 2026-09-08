const express = require("express");
const router = express.Router();
const flockCompletionController = require("../controllers/flockCompletionController");
const { protect, authorize } = require("../middleware/auth");

// ============================================
// مسیرهای اطلاعات پایان دوره ها (Flock Completion)
// ============================================

// ثبت اطلاعات پایان دوره برای یک یا چند واحد/گله
router.post(
  "/complete-periods",
  protect,
  authorize("expert", "admin", "sub_admin", "super_admin"),
  flockCompletionController.completePeriods,
);

// ثبت پایان دوره مستقیم با شناسه گله (سرگروه + ریز تفکیکی per سالن)
router.post(
  "/complete-flock",
  protect,
  authorize("expert", "admin", "sub_admin", "super_admin"),
  flockCompletionController.completeFlockPeriods,
);

// دریافت لیست اطلاعات پایان دوره
router.get("/", protect, flockCompletionController.getFlockCompletions);

// پیش‌نمایش اطلاعات سیستمی پایان یک گله
router.get(
  "/preview/:flockId",
  protect,
  flockCompletionController.getFlockCompletionPreview,
);

// دریافت اطلاعات پایان دوره های یک واحد
router.get(
  "/unit/:unitId",
  protect,
  flockCompletionController.getCompletionsByUnit,
);

// دریافت پایان دوره یک گله (سرگروه + ریز سالن‌ها)
router.get(
  "/flock/:flockId",
  protect,
  flockCompletionController.getFlockCompletionByFlockId,
);

// دریافت اطلاعات پایان دوره یک گله
router.get("/:id", protect, flockCompletionController.getFlockCompletionById);

// ویرایش/بروزرسانی اطلاعات پایان دوره
router.put(
  "/:id",
  protect,
  authorize("expert", "admin", "sub_admin", "super_admin"),
  flockCompletionController.updateFlockCompletion,
);

// حذف (بازگردانی) یک پایان دوره
router.delete(
  "/:id",
  protect,
  authorize("expert", "admin", "sub_admin", "super_admin"),
  flockCompletionController.deleteFlockCompletion,
);

module.exports = router;
