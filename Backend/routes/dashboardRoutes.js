// ================================================================
// routes/dashboardRoutes.js
// ================================================================

const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const dashboardController = require("../controllers/dashboardController");

// ================================================================
// همه روت‌ها نیاز به احراز هویت و نقش کارشناس دارند
// ================================================================
router.use(protect);
router.use(authorize("expert", "admin", "sub_admin", "super_admin"));

// ================================================================
// روت‌های اصلی داشبورد (✅ همه در کنترلر وجود دارند)
// ================================================================

// دریافت لیست گله‌های فعال با وضعیت سررسید
router.get("/flocks", dashboardController.getActiveFlocks);

// دریافت اطلاعات کامل مشتری برای مودال
router.get("/customer/:id/details", dashboardController.getCustomerDetails);

// دریافت خلاصه آماری
router.get("/summary", dashboardController.getSummary);

// دریافت داده‌های نمودارها
router.get("/charts", dashboardController.getChartsData);

// ================================================================
// ✅ روت‌های اضافی (با بررسی وجود توابع)
// ================================================================

// بوکمارک‌ها
if (typeof dashboardController.getBookmarks === "function") {
  router.get("/bookmarks", dashboardController.getBookmarks);
}

// پیام‌ها
if (typeof dashboardController.getMessages === "function") {
  router.get("/messages", dashboardController.getMessages);
}

// تقویم
if (typeof dashboardController.getCalendarEvents === "function") {
  router.get("/calendar", dashboardController.getCalendarEvents);
}

// ارسال پیامک گروهی
if (typeof dashboardController.sendBulkSms === "function") {
  router.post("/send-bulk-sms", dashboardController.sendBulkSms);
}

// حذف گله از لیست (مخفی کردن موقت)
if (typeof dashboardController.hideFlockFromDashboard === "function") {
  router.delete(
    "/flock/:flockId/hide",
    dashboardController.hideFlockFromDashboard,
  );
}

// ================================================================
// صادر کردن روت‌ها
// ================================================================
module.exports = router;
