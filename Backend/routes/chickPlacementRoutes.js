const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
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
} = require("../controllers/chickPlacementController");

router.use(protect);

// =========== روت‌های خاص (بدون پارامتر متغیر) اول ===========
router.get("/", getChickPlacements);
router.get("/by-hall/:hall_id", getChickPlacementByHallId);
router.get("/active/by-hall/:hall_id", getActiveChickPlacementByHallId);

// =========== روت‌های PUT خاص ===========
router.put(
  "/activate/:id",
  authorize("expert", "admin", "sub_admin", "super_admin"),
  activateChickPlacement,
);
router.put(
  "/deactivate/:id",
  authorize("expert", "admin", "sub_admin", "super_admin"),
  deactivateChickPlacement,
);

// =========== روت‌های عمومی با پارامتر :id (آخر) ===========
router.get("/:id", getChickPlacementById);
router.put(
  "/:id",
  authorize("expert", "admin", "sub_admin", "super_admin"),
  updateChickPlacement,
);
router.delete("/:id", authorize("admin", "super_admin", "sub_admin"), deleteChickPlacement);
router.post(
  "/",
  authorize("expert", "admin", "sub_admin", "super_admin"),
  createChickPlacement,
);

// فعال/غیرفعال کردن گله (یک روت یکپارچه)
router.put(
  "/:id/toggle-status",
  protect,
  authorize("admin", "super_admin", "sub_admin", "expert"),
  toggleChickPlacementStatus,
);

module.exports = router;
