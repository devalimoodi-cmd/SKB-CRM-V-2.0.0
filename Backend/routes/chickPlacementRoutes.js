const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");
const {
  createChickPlacement,
  getChickPlacements,
  getChickPlacementById,
  getChickPlacementByHallId,
  getActiveChickPlacementByHallId,
  updateChickPlacement,
  deleteChickPlacement,
  activateChickPlacement,
  deactivateChickPlacement,
  toggleChickPlacementStatus,
  deleteFlockGroup,
} = require("../controllers/chickPlacementController");

// ✅ کنترل دسترسی بر پایهٔ مجوز (جوجه‌ریزی)
router.use(protect);

// =========== روت‌های خاص (بدون پارامتر متغیر) اول ===========
router.get(
  "/",
  requirePermission("hatchery.placement.list"),
  getChickPlacements,
);
router.get(
  "/by-hall/:hall_id",
  requirePermission("hatchery.placement.list"),
  getChickPlacementByHallId,
);
router.get(
  "/active/by-hall/:hall_id",
  requirePermission("hatchery.placement.list"),
  getActiveChickPlacementByHallId,
);

// =========== روت‌های PUT خاص ===========
const CAN_WRITE = authorize("expert", "admin", "sub_admin", "super_admin");
const CAN_MANAGE = authorize("admin", "super_admin", "sub_admin");

router.put(
  "/activate/:id",
  CAN_WRITE,
  requirePermission("hatchery.placement.edit"),
  activateChickPlacement,
);
router.put(
  "/deactivate/:id",
  CAN_WRITE,
  requirePermission("hatchery.placement.edit"),
  deactivateChickPlacement,
);

// =========== حذف کل «گله/دوره» به همراه سالن‌های عضو ===========
router.delete(
  "/group/:flockId",
  CAN_MANAGE,
  requirePermission("hatchery.placement.delete"),
  deleteFlockGroup,
);

// =========== روت‌های عمومی با پارامتر :id (آخر) ===========
router.get(
  "/:id",
  requirePermission("hatchery.placement.list"),
  getChickPlacementById,
);
router.put(
  "/:id",
  CAN_WRITE,
  requirePermission("hatchery.placement.edit"),
  updateChickPlacement,
);
router.delete(
  "/:id",
  CAN_MANAGE,
  requirePermission("hatchery.placement.delete"),
  deleteChickPlacement,
);
router.post(
  "/",
  CAN_WRITE,
  requirePermission("hatchery.placement.create"),
  createChickPlacement,
);

// فعال/غیرفعال کردن گله (یک روت یکپارچه)
router.put(
  "/:id/toggle-status",
  protect,
  authorize("admin", "super_admin", "sub_admin", "expert"),
  requirePermission("hatchery.placement.toggle"),
  toggleChickPlacementStatus,
);

module.exports = router;
