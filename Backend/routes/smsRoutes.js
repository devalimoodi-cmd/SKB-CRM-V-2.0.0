const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const smsController = require("../controllers/smsController");

// ============================================
// همه روت‌ها نیاز به احراز هویت دارند
// ============================================
router.use(protect);

// ============================================
// مسیرهای عمومی (همه کاربران)
// ============================================
router.get("/credit", smsController.getCredit);
router.get("/lines", smsController.getLines);
router.post("/verify", smsController.sendVerify);
router.get("/status/:messageId", smsController.getMessageStatus);
router.get("/received", smsController.getReceivedMessages);

// ============================================
// مسیرهای اختصاصی (فقط ادمین)
// ============================================
router.post(
  "/test",
  authorize("admin", "super_admin"),
  smsController.sendTestSms,
);
router.post(
  "/send",
  authorize("admin", "super_admin"),
  smsController.sendCustomSms,
);

// ============================================
// مسیرهای قالب‌ها (فقط ادمین)
// ============================================
router.post(
  "/week-register",
  authorize("admin", "super_admin", "expert"),
  smsController.sendWeekRegister,
);

router.post(
  "/week-reminder",
  authorize("admin", "super_admin", "expert"),
  smsController.sendWeekReminder,
);

// ============================================
// مسیرهای صفحه کارشناس
// ============================================
router.post(
  "/send-to-customer",
  authorize("expert", "admin", "super_admin"),
  smsController.sendToCustomer,
);

router.post(
  "/send-bulk-to-customers",
  authorize("expert", "admin", "super_admin"),
  smsController.sendBulkToCustomers,
);

// ============================================
// مسیرهای لاگ پیامک
// ============================================
router.post(
  "/log",
  authorize("expert", "admin", "super_admin"),
  smsController.saveSmsLog,
);

router.get(
  "/recent",
  authorize("expert", "admin", "super_admin"),
  smsController.getRecentSmsLogs,
);

router.get(
  "/log/:customerId",
  authorize("expert", "admin", "super_admin"),
  smsController.getCustomerSmsLogs,
);

// ✅ مسیر جدید برای بررسی وضعیت پیامک از سرویس
router.get(
  "/check-status/:messageId",
  authorize("expert", "admin", "super_admin"),
  smsController.checkAndUpdateSmsStatus,
);

// ============================================
// مسیرهای جدید برای مدیریت وضعیت پیامک
// ============================================

// بروزرسانی وضعیت یک پیامک با استعلام از سرویس
router.get(
  "/update-status/:messageId",
  protect,
  smsController.updateSmsStatusFromProvider,
);

// بروزرسانی وضعیت همه پیامک‌های یک گله
router.get(
  "/update-status/flock/:customerId/:flockId",
  protect,
  smsController.updateAllSmsStatusForFlock,
);

// بروزرسانی وضعیت همه پیامک‌های یک مشتری
router.get(
  "/update-status/customer/:customerId",
  protect,
  smsController.updateAllSmsStatusForFlock,
);

module.exports = router;
