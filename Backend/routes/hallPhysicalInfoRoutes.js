const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");
const {
  createOrUpdatePhysicalInfo,
  getPhysicalInfoByHallId,
  deletePhysicalInfo,
} = require("../controllers/hallPhysicalInfoController");

// ✅ کنترل دسترسی بر پایهٔ مجوز (اطلاعات فیزیکی سالن)
router.use(protect);

router.get(
  "/:hall_id",
  requirePermission("halls.view"),
  getPhysicalInfoByHallId,
);
router.post(
  "/",
  authorize("expert", "admin", "sub_admin", "super_admin"),
  requirePermission("halls.edit"),
  createOrUpdatePhysicalInfo,
);
router.delete(
  "/:id",
  authorize("admin", "super_admin", "sub_admin"),
  requirePermission("halls.delete"),
  deletePhysicalInfo,
);

module.exports = router;
