const express = require("express");
const router = express.Router();
const unitController = require("../controllers/unitController");
const { protect, authorize } = require("../middleware/auth");

// ============================================
// همه مسیرهای مربوط به واحدهای مرغداری
// ============================================

// مسیرهای عمومی (برای کاربران لاگین شده)
router.get("/", protect, unitController.getUnits);
router.get("/statuses", protect, unitController.getUnitStatuses);
router.get("/:id", protect, unitController.getUnitById);

// مسیرهای مدیریت کارشناسان واحد
router.get("/:unitId/experts", protect, unitController.getUnitExperts);
router.post(
  "/:unitId/experts",
  protect,
  authorize("expert", "admin", "super_admin"),
  unitController.addUnitExpert,
);
router.put(
  "/:unitId/experts/:expertId",
  protect,
  authorize("expert", "admin", "super_admin"),
  unitController.updateUnitExpert,
);
router.delete(
  "/:unitId/experts/:expertId",
  protect,
  authorize("expert", "admin", "super_admin"),
  unitController.deleteUnitExpert,
);

// مسیرهای محافظت شده (فقط کارشناسان و مدیران)
router.post(
  "/",
  protect,
  authorize("expert", "admin", "super_admin"),
  unitController.createUnit,
);
router.put(
  "/:id",
  protect,
  authorize("expert", "admin", "super_admin"),
  unitController.updateUnit,
);
router.delete(
  "/:id",
  protect,
  authorize("expert", "admin", "super_admin"),
  unitController.deleteUnit,
);
router.put(
  "/toggle-status/:id",
  protect,
  authorize("expert", "admin", "super_admin"),
  unitController.toggleUnitStatus,
);

module.exports = router;
