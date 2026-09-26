const express = require("express");
const router = express.Router();
const unitController = require("../controllers/unitController");
const { protect } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");

// ============================================================
// واحدهای مرغداری
// ✅ کنترل دسترسی بر پایهٔ «مجوز» (پنل مدیریت ← مدیریت نقش‌ها)
// ⚠️ در حالت آزمایشی (PERMISSIONS_ENFORCE=false) فقط لاگ می‌شود.
// ============================================================

// -------- مشاهده (قبلاً فقط protect بود؛ الان با مجوز) --------
router.get("/", protect, requirePermission("units.view"), unitController.getUnits);
router.get(
  "/statuses",
  protect,
  requirePermission("units.view"),
  unitController.getUnitStatuses,
);
router.get("/:id", protect, requirePermission("units.view"), unitController.getUnitById);

// -------- کارشناسان واحد --------
router.get(
  "/:unitId/experts",
  protect,
  requirePermission("units.view"),
  unitController.getUnitExperts,
);
router.post(
  "/:unitId/experts",
  protect,
  requirePermission("units.experts"),
  unitController.addUnitExpert,
);
router.put(
  "/:unitId/experts/:expertId",
  protect,
  requirePermission("units.experts"),
  unitController.updateUnitExpert,
);
router.delete(
  "/:unitId/experts/:expertId",
  protect,
  requirePermission("units.experts"),
  unitController.deleteUnitExpert,
);

// -------- ثبت/ویرایش/حذف واحد --------
router.post(
  "/",
  protect,
  requirePermission("units.create"),
  unitController.createUnit,
);
router.put(
  "/:id",
  protect,
  requirePermission("units.edit"),
  unitController.updateUnit,
);
router.delete(
  "/:id",
  protect,
  requirePermission("units.delete"),
  unitController.deleteUnit,
);
router.put(
  "/toggle-status/:id",
  protect,
  requirePermission("units.toggle"),
  unitController.toggleUnitStatus,
);

module.exports = router;

