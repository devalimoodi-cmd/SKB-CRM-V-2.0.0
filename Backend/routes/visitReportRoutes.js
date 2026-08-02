// ============================================
// routes/visitReportRoutes.js
// ============================================
const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload");
const visitReportController = require("../controllers/visitReportController");
const { protect, authorize } = require("../middleware/auth");

// ========== مسیرهای گزارش بازدید ==========

// ایجاد گزارش جدید
router.post(
  "/",
  protect,
  authorize("admin", "expert", "super_admin"),
  upload.any(),
  visitReportController.createVisitReport,
);

// ویرایش گزارش
router.put(
  "/:id",
  protect,
  authorize("admin", "expert", "super_admin"),
  upload.any(),
  visitReportController.updateVisitReport,
);

// دریافت گزارش با ID
router.get(
  "/:id",
  protect,
  authorize("admin", "expert", "super_admin"),
  visitReportController.getVisitReportById,
);

// دریافت همه گزارش‌های یک مشتری
router.get(
  "/customer/:customerId",
  protect,
  authorize("admin", "expert", "super_admin"),
  visitReportController.getReportsByCustomer,
);

// تغییر وضعیت گزارش (خوانده/نخوانده)
router.put(
  "/:id/status",
  protect,
  authorize("admin", "expert", "super_admin"),
  visitReportController.updateReportStatus,
);

// دانلود فایل پیوست
router.get(
  "/download/:id",
  protect,
  authorize("admin", "expert", "super_admin"),
  visitReportController.downloadAttachment,
);

// حذف فایل پیوست
router.delete(
  "/attachment/:id",
  protect,
  authorize("admin", "super_admin"),
  visitReportController.deleteAttachment,
);

// حذف گزارش
router.delete(
  "/:id",
  protect,
  authorize("admin", "super_admin"),
  visitReportController.deleteVisitReport,
);

module.exports = router;
