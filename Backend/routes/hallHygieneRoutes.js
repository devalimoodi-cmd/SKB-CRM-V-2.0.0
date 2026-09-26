const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");
const {
  createOrUpdateHygiene, // تغییر نام
  getHygieneByHallId,
  deleteHygiene,
} = require("../controllers/hallHygieneController");

// ✅ کنترل دسترسی بر پایهٔ مجوز (بهداشت و ضدعفونی)
router.use(protect);

router.get(
  "/:hall_id",
  requirePermission("hatchery.hygiene.list"),
  getHygieneByHallId,
);
router.post(
  "/",
  authorize("expert", "admin", "sub_admin", "super_admin"),
  requirePermission("hatchery.hygiene.schedule"),
  createOrUpdateHygiene,
);
router.delete(
  "/:id",
  authorize("admin", "super_admin", "sub_admin"),
  requirePermission("halls.delete"),
  deleteHygiene,
);

module.exports = router;
