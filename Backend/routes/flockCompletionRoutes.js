const express = require("express");
const router = express.Router();
const flockCompletionController = require("../controllers/flockCompletionController");
const { protect, authorize } = require("../middleware/auth");

// ============================================
// مسیرهای اطلاعات پایان دوره ها (Flock Completion)
// ============================================

// ثبت اطلاعات پایان دوره برای یک یا چند دوره/گله
router.post(
  "/complete-periods",
  protect,
  authorize("expert", "admin", "super_admin"),
  flockCompletionController.completePeriods,
);

// دریافت اطلاعات پایان دوره های یک دوره
router.get(
  "/period/:periodId",
  protect,
  flockCompletionController.getPeriodCompletions,
);

// دریافت اطلاعات پایان دوره یک گله
router.get(
  "/flock/:flockId",
  protect,
  flockCompletionController.getFlockCompletion,
);

// بروزرسانی (ویرایش) اطلاعات پایان دوره
router.put(
  "/:id",
  protect,
  authorize("expert", "admin", "super_admin"),
  flockCompletionController.updateCompletion,
);

// برگرداندن (لغو) یک تکمیل دوره
router.delete(
  "/:id",
  protect,
  authorize("expert", "admin", "super_admin"),
  flockCompletionController.revertCompletion,
);

module.exports = router;
