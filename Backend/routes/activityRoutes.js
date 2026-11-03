// ============================================================
// routes/activityRoutes.js
// «ردّ فعالیت» — چه کسی چه چیزی را تغییر داد (فاز ۱۲.۲)
// ------------------------------------------------------------
//  • GET /api/activity          : فهرست (مدیر + مجوز مشاهده)
//  • GET /api/activity/summary  : خلاصهٔ آماری (مدیر + مجوز مشاهده)
//  • GET /api/activity/:id      : جزئیات یک ردیف (مدیر + مجوز مشاهده)
// ------------------------------------------------------------
// ⚠️ مسیر ثابت (/summary) پیش از مسیر پارامتری (/:id) ثبت می‌شود تا
//    هیچ‌وقت با آن تلاقی نکند (همان قاعدهٔ routes/sessionRoutes.js).
// ⚠️ کلید مجوز: users.activity.view (فاز ۱۲.۲ — کلید جدید)
//    پیش‌فرض: super_admin / admin / sub_admin روشن · expert / customer خاموش
//    (قفل‌شده نیست ⇒ سوپرادمین می‌تواند از ماتریس به کارشناس هم بدهد)
// ============================================================
const express = require("express");
const router = express.Router();
const { protect, authorize, ADMIN_ROLES } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");
const activityController = require("../controllers/activityController");

const ADMIN_ONLY = authorize(...ADMIN_ROLES);
const CAN_VIEW_ACTIVITY = requirePermission("users.activity.view");

router.use(protect);

// ===== مشاهدهٔ مدیریتی =====
router.get("/summary", ADMIN_ONLY, CAN_VIEW_ACTIVITY, activityController.summary);
router.get("/", ADMIN_ONLY, CAN_VIEW_ACTIVITY, activityController.list);
router.get("/:id", ADMIN_ONLY, CAN_VIEW_ACTIVITY, activityController.detail);

module.exports = router;
