const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const {
  createOrUpdateWaterFeed,
  getWaterFeedByHallId,
  deleteWaterFeed,
} = require("../controllers/hallWaterFeedController");

router.use(protect);
router.get("/:hall_id", getWaterFeedByHallId);
router.post(
  "/",
  authorize("expert", "admin", "super_admin"),
  createOrUpdateWaterFeed,
);
router.delete("/:id", authorize("admin", "super_admin"), deleteWaterFeed);

module.exports = router;
