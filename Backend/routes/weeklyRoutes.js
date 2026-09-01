// ================================================================
// routes/weeklyRoutes.js - اصلاح ترتیب روت‌ها
// ================================================================

const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const {
  createWeeklyRecord,
  getWeeklyRecords,
  getWeeklyRecordById,
  getWeeklyRecordsByFlock,
  updateWeeklyRecord,
  deleteWeeklyRecord,
} = require("../controllers/weeklyController");

router.use(protect);

// ✅ روت‌های خاص (بدون پارامتر یا با پارامتر ثابت) اول بیایند
router.get("/", getWeeklyRecords);

// ✅ روت‌های با پارامتر مشخص (مانند flock) قبل از روت‌های عمومی با :id
router.get("/flock/:chick_placement_id", getWeeklyRecordsByFlock);

// ✅ روت‌های عمومی با :id آخر بیایند
router.get("/:id", getWeeklyRecordById);

// ✅ روت‌های POST و PUT
router.post(
  "/",
  authorize("expert", "admin", "sub_admin", "super_admin"),
  createWeeklyRecord,
);

router.put(
  "/:id",
  authorize("expert", "admin", "sub_admin", "super_admin"),
  updateWeeklyRecord,
);

router.delete("/:id", authorize("admin", "super_admin", "sub_admin"), deleteWeeklyRecord);

module.exports = router;
