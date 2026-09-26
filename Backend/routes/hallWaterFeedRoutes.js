const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");
const {
  createOrUpdateWaterFeed,
  getWaterFeedByHallId,
  deleteWaterFeed,
} = require("../controllers/hallWaterFeedController");

// ✅ کنترل دسترسی بر پایهٔ مجوز (آبخوری و دانخوری)
router.use(protect);

router.get("/:hall_id", requirePermission("halls.view"), getWaterFeedByHallId);
router.post(
  "/",
  authorize("expert", "admin", "sub_admin", "super_admin"),
  requirePermission("halls.edit"),
  createOrUpdateWaterFeed,
);
router.delete(
  "/:id",
  authorize("admin", "super_admin", "sub_admin"),
  requirePermission("halls.delete"),
  deleteWaterFeed,
);

module.exports = router;
