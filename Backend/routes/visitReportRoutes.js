// ============================================
// routes/visitReportRoutes.js
// ✅ کنترل دسترسی بر پایهٔ مجوز (پنل مدیریت ← مدیریت نقش‌ها)
// ⚠️ authorize قبلی حفظ شده ⇒ مجوز فقط می‌تواند محدودتر کند
// ============================================
const express = require("express");
const router = express.Router();
const { upload } = require("../middleware/upload");
const visitReportController = require("../controllers/visitReportController");
const { protect, authorize } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");

const CAN_WRITE = authorize("admin", "expert", "sub_admin", "super_admin");
const CAN_MANAGE = authorize("admin", "super_admin", "sub_admin");

// ========== مسیرهای گزارش بازدید ==========

// ایجاد گزارش جدید
router.post(
  "/",
  protect,
  CAN_WRITE,
  requirePermission("visit.create"),
  upload.array("files", 10),
  visitReportController.createVisitReport,
);
// ویرایش گزارش
router.put(
  "/:id",
  protect,
  CAN_WRITE,
  requirePermission("visit.edit"),
  upload.array("files", 10),
  visitReportController.updateVisitReport,
);

// دریافت گزارش با ID
router.get(
  "/:id",
  protect,
  CAN_WRITE,
  requirePermission("visit.view"),
  visitReportController.getVisitReportById,
);

// دریافت همه گزارش‌های یک مشتری
router.get(
  "/customer/:customerId",
  protect,
  CAN_WRITE,
  requirePermission("visit.view"),
  visitReportController.getReportsByCustomer,
);

// تغییر وضعیت گزارش (خوانده/نخوانده)
router.put(
  "/:id/status",
  protect,
  CAN_WRITE,
  requirePermission("visit.status"),
  visitReportController.updateReportStatus,
);

// دانلود فایل پیوست
router.get(
  "/download/:id",
  protect,
  CAN_WRITE,
  requirePermission("visit.attachment.download"),
  visitReportController.downloadAttachment,
);

// حذف فایل پیوست
router.delete(
  "/attachment/:id",
  protect,
  CAN_MANAGE,
  requirePermission("visit.attachment.delete"),
  visitReportController.deleteAttachment,
);

// حذف گزارش
router.delete(
  "/:id",
  protect,
  CAN_MANAGE,
  requirePermission("visit.delete"),
  visitReportController.deleteVisitReport,
);

module.exports = router;
