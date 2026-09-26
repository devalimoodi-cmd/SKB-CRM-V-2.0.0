// ================================================================
// routes/weeklyRoutes.js - مدیریت هفتگی
// ✅ کنترل دسترسی بر پایهٔ مجوز (پنل مدیریت ← مدیریت نقش‌ها)
// ⚠️ authorize قبلی حفظ شده ⇒ مجوز فقط می‌تواند محدودتر کند
// ================================================================

const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");
const {
  createWeeklyRecord,
  getWeeklyRecords,
  getWeeklyRecordById,
  getWeeklyRecordsByFlock,
  updateWeeklyRecord,
  deleteWeeklyRecord,
} = require("../controllers/weeklyController");

const CAN_WRITE = authorize("expert", "admin", "sub_admin", "super_admin");
const CAN_MANAGE = authorize("admin", "super_admin", "sub_admin");

router.use(protect);

// ✅ روت‌های خاص (بدون پارامتر یا با پارامتر ثابت) اول بیایند
router.get("/", requirePermission("weekly.view"), getWeeklyRecords);

// ✅ روت‌های با پارامتر مشخص (مانند flock) قبل از روت‌های عمومی با :id
router.get(
  "/flock/:chick_placement_id",
  requirePermission("weekly.view"),
  getWeeklyRecordsByFlock,
);

// ✅ روت‌های عمومی با :id آخر بیایند
router.get("/:id", requirePermission("weekly.view"), getWeeklyRecordById);

// ✅ روت‌های POST و PUT
router.post(
  "/",
  CAN_WRITE,
  requirePermission("weekly.create"),
  createWeeklyRecord,
);

router.put("/:id", CAN_WRITE, requirePermission("weekly.edit"), updateWeeklyRecord);

router.delete(
  "/:id",
  CAN_MANAGE,
  requirePermission("weekly.delete"),
  deleteWeeklyRecord,
);

module.exports = router;
