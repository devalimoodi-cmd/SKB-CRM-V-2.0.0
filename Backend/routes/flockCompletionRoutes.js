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

// دریافت لیست اطلاعات پایان دوره
router.get("/", protect, flockCompletionController.getFlockCompletions);

// دریافت اطلاعات پایان دوره های یک واحد
router.get(
  "/unit/:unitId",
  protect,
  flockCompletionController.getCompletionsByUnit,
);

// دریافت اطلاعات پایان دوره یک گله
router.get("/:id", protect, flockCompletionController.getFlockCompletionById);

// حذف (بازگردانی) یک پایان دوره
router.delete(
  "/:id",
  protect,
  authorize("expert", "admin", "sub_admin", "super_admin"),
  flockCompletionController.deleteFlockCompletion,
);

module.exports = router;
