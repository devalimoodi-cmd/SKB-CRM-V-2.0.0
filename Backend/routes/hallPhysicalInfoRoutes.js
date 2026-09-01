const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const {
  createOrUpdatePhysicalInfo,
  getPhysicalInfoByHallId,
  deletePhysicalInfo,
} = require("../controllers/hallPhysicalInfoController");

router.use(protect);
router.get("/:hall_id", getPhysicalInfoByHallId);
router.post(
  "/",
  authorize("expert", "admin", "sub_admin", "super_admin"),
  createOrUpdatePhysicalInfo,
);
router.delete("/:id", authorize("admin", "super_admin", "sub_admin"), deletePhysicalInfo);

module.exports = router;
