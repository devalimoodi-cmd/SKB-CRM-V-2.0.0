const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");
const smsController = require("../controllers/smsController");

// ============================================
// همه روت‌ها نیاز به احراز هویت دارند
// ✅ کنترل دسترسی بر پایهٔ مجوز (پنل مدیریت ← مدیریت نقش‌ها)
// ⚠️ authorize قبلی حفظ شده ⇒ مجوز فقط می‌تواند محدودتر کند
// ============================================
router.use(protect);

// ============================================
// مسیرهای عمومی (همه کاربران لاگین‌شده)
// ============================================
router.get("/credit", requirePermission("sms.credit"), smsController.getCredit);
router.get("/status/:messageId", smsController.getMessageStatus);

// ============================================
// ✅ مسیرهای حساس پیامک (فقط ادمین‌ها)
// ============================================
const ADMIN_ONLY = authorize("admin", "super_admin", "sub_admin");

router.get("/lines", ADMIN_ONLY, requirePermission("sms.lines"), smsController.getLines);
router.post(
  "/verify",
  ADMIN_ONLY,
  requirePermission("sms.verify"),
  smsController.sendVerify,
);
router.get(
  "/received",
  ADMIN_ONLY,
  requirePermission("sms.received"),
  smsController.getReceivedMessages,
);

// ============================================
// مسیرهای اختصاصی (فقط ادمین)
// ============================================
router.post(
  "/test",
  authorize("admin", "super_admin", "sub_admin"),
  requirePermission("sms.test"),
  smsController.sendTestSms,
);
router.post(
  "/send",
  authorize("admin", "super_admin", "sub_admin"),
  requirePermission("sms.send"),
  smsController.sendCustomSms,
);

// ============================================
// مسیرهای قالب‌ها
// ============================================
const CAN_TEMPLATE = authorize("admin", "super_admin", "sub_admin", "expert");

router.post(
  "/week-register",
  CAN_TEMPLATE,
  requirePermission("sms.templates"),
  smsController.sendWeekRegister,
);

router.post(
  "/week-reminder",
  CAN_TEMPLATE,
  requirePermission("sms.templates"),
  smsController.sendWeekReminder,
);

// یادآوری هفتگی گله/دوره (per گله یا با سالن اختیاری)
router.post(
  "/flock-reminder",
  CAN_TEMPLATE,
  requirePermission("sms.templates"),
  smsController.sendFlockReminder,
);

// ارسال پیامک به گیرنده دلخواه (کارشناس فارم / مدیر فارم / مرغدار)
router.post(
  "/send-recipient",
  CAN_TEMPLATE,
  requirePermission("sms.sendToRecipient"),
  smsController.sendToRecipient,
);

// ============================================
// مسیرهای صفحه کارشناس
// ============================================
router.post(
  "/send-to-customer",
  authorize("expert", "admin", "sub_admin", "super_admin"),
  requirePermission("sms.send"),
  smsController.sendToCustomer,
);

router.post(
  "/send-bulk-to-customers",
  authorize("expert", "admin", "sub_admin", "super_admin"),
  requirePermission("sms.bulk"),
  smsController.sendBulkToCustomers,
);

// ============================================
// مسیرهای لاگ پیامک
// ============================================
const CAN_LOG = authorize("expert", "admin", "sub_admin", "super_admin");

router.post(
  "/log",
  CAN_LOG,
  requirePermission("sms.history"),
  smsController.saveSmsLog,
);

router.get(
  "/recent",
  CAN_LOG,
  requirePermission("sms.history"),
  smsController.getRecentSmsLogs,
);

router.get(
  "/log/:customerId",
  CAN_LOG,
  requirePermission("sms.history"),
  smsController.getCustomerSmsLogs,
);

// ✅ بررسی وضعیت پیامک از سرویس
router.get(
  "/check-status/:messageId",
  CAN_LOG,
  requirePermission("sms.status.refresh"),
  smsController.checkAndUpdateSmsStatus,
);

// ============================================
// مسیرهای بروزرسانی وضعیت پیامک
// ============================================
router.get(
  "/update-status/:messageId",
  protect,
  requirePermission("sms.status.refresh"),
  smsController.updateSmsStatusFromProvider,
);

router.get(
  "/update-status/flock/:customerId/:flockId",
  protect,
  requirePermission("sms.status.refresh"),
  smsController.updateAllSmsStatusForFlock,
);

router.get(
  "/update-status/customer/:customerId",
  protect,
  requirePermission("sms.status.refresh"),
  smsController.updateAllSmsStatusForFlock,
);

module.exports = router;
