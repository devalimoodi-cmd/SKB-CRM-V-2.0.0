// ================================================================
// routes/dashboardRoutes.js
// ✅ کنترل دسترسی بر پایهٔ مجوز (پنل مدیریت ← مدیریت نقش‌ها)
// ⚠️ authorize قبلی حفظ شده ⇒ مجوز فقط می‌تواند محدودتر کند
// ================================================================

const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");
const dashboardController = require("../controllers/dashboardController");

// ================================================================
// همه روت‌ها نیاز به احراز هویت و نقش کارشناس دارند
// ================================================================
router.use(protect);
router.use(authorize("expert", "admin", "sub_admin", "super_admin"));

// ================================================================
// روت‌های اصلی داشبورد
// ================================================================

// دریافت لیست گله‌های فعال با وضعیت سررسید
router.get(
  "/flocks",
  requirePermission("dashboard.flockCards"),
  dashboardController.getActiveFlocks,
);

// دریافت کارت‌های گله (دوره پرورش) با سالن‌های عضو
router.get(
  "/flock-cards",
  requirePermission("dashboard.flockCards"),
  dashboardController.getActiveFlockCards,
);

// دریافت اطلاعات کامل مشتری برای مودال
router.get(
  "/customer/:id/details",
  requirePermission("dashboard.customerDetails"),
  dashboardController.getCustomerDetails,
);

// دریافت «خلاصهٔ عملکرد مشتری» برای مودال جزئیات (دوره‌ها/سالن‌ها/KPI)
router.get(
  "/customer/:id/performance",
  requirePermission("dashboard.customerDetails"),
  dashboardController.getCustomerPerformance,
);

// دریافت خلاصه آماری
router.get(
  "/summary",
  requirePermission("dashboard.summary"),
  dashboardController.getSummary,
);

// دریافت داده‌های نمودارها
router.get(
  "/charts",
  requirePermission("dashboard.charts"),
  dashboardController.getChartsData,
);

// دریافت داده‌های تحلیلی نمودارهای داینامیک
router.get(
  "/analysis",
  requirePermission("dashboard.analysis"),
  dashboardController.getAnalysisData,
);

// ================================================================
// ✅ روت‌های اضافی (با بررسی وجود توابع)
// ================================================================

// بوکمارک‌ها
if (typeof dashboardController.getBookmarks === "function") {
  router.get(
    "/bookmarks",
    requirePermission("bookmarks.view"),
    dashboardController.getBookmarks,
  );
}

// پیام‌ها
if (typeof dashboardController.getMessages === "function") {
  router.get(
    "/messages",
    requirePermission("dashboard.messages"),
    dashboardController.getMessages,
  );
}

// تقویم
if (typeof dashboardController.getCalendarEvents === "function") {
  router.get(
    "/calendar",
    requirePermission("dashboard.calendar"),
    dashboardController.getCalendarEvents,
  );
}

// ارسال پیامک گروهی
if (typeof dashboardController.sendBulkSms === "function") {
  router.post(
    "/send-bulk-sms",
    requirePermission("dashboard.bulkSms"),
    dashboardController.sendBulkSms,
  );
}

// حذف گله از لیست (مخفی کردن موقت)
if (typeof dashboardController.hideFlockFromDashboard === "function") {
  router.delete(
    "/flock/:flockId/hide",
    requirePermission("dashboard.flock.hide"),
    dashboardController.hideFlockFromDashboard,
  );
}

module.exports = router;
