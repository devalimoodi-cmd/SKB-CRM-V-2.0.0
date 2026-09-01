const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const {
  createOrUpdateHygiene, // تغییر نام
  getHygieneByHallId,
  deleteHygiene,
} = require("../controllers/hallHygieneController");

router.use(protect);
router.get("/:hall_id", getHygieneByHallId);
router.post(
  "/",
  authorize("expert", "admin", "sub_admin", "super_admin"),
  createOrUpdateHygiene,
);
router.delete("/:id", authorize("admin", "super_admin", "sub_admin"), deleteHygiene);

module.exports = router;
