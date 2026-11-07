// ============================================================
// routes/portalRoutes.js
// «پورتال مشتری» — فاز ۱۳.۲، ۱۳.۳ و ۱۳.۴
// ------------------------------------------------------------
// ⚠️ تنها مسیرهای اختصاصی نقش مشتری. هیچ‌یک از ۲۰+ فایل مسیر موجود
//    باز نشده‌اند: نقش «مشتری» به هیچ GET موجودی اضافه نشده است.
//    در ۱۳.۳ دادهٔ بیشتر (سالن/گله/هفته/بازدید) و در ۱۳.۴ جزئیات
//    هفته/بازدید و دانلود پیوست، از همین روتر آمد — نه از باز کردن
//    مسیرهای کارکنان.
//
// زنجیرهٔ دسترسی (به ترتیب و همه اجباری):
//   1) protect                 ⇒ توکن معتبر + کاربر فعال + نشست باز
//   2) authorize("customer")    ⇒ فقط نقش مشتری (کارکنان ۴۰۳ می‌گیرند)
//   3) کلید مجوز customer.portal.view  (قابل بستن از پنل مدیریت)
//      ← مسیرهای جزئیات بازدید/پیوست کلید جدا دارند:
//        customer.portal.visit.report  (۱۳.۴)
//   4) requireCustomerLink      ⇒ مشتری بدون پروندهٔ متصل ⇒ ۴۰۳ روشن
//   5) controller              ⇒ customer_id فقط از req.customerScopeId
//
// 🔒 همهٔ مسیرها GET و بدون شناسهٔ «مشتری» هستند؛ تنها پارامتر مجاز
//    page/limit است (سقف ۵۰ در parsePagination). از ۱۳.۴ شناسهٔ
//    «ردیف خودم» در مسیر مجاز است (:id) و کنترلر مالکیت را با
//    customer_id در همان کوئری می‌سنجد.
// ============================================================
"use strict";

const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");
const { requireCustomerLink } = require("../middleware/customerScope");
const portalController = require("../controllers/portalController");

// ✅ همهٔ مسیرهای این روتر پشت احراز هویت هستند
router.use(protect);

// زنجیرهٔ مشترک دسترسی (یک منبع حقیقت — هر مسیر تازه باید از همین بگذرد)
const customerChain = [
  authorize("customer"),
  requirePermission("customer.portal.view"),
  requireCustomerLink,
];

// ✅ ۱۳.۴: زنجیرهٔ «محتوای گزارش بازدید» = همان زنجیره + کلید جدا
//    (متن گزارش، پیوست‌ها و دانلود فایل — حساس‌ترین بخش پرونده)
const visitReportChain = [
  ...customerChain,
  requirePermission("customer.portal.visit.report"),
];

// خلاصهٔ پروندهٔ خودم (شمارنده‌ها + ۳ ردیف آخر)
router.get("/me", ...customerChain, portalController.getPortalSummary);

// فهرست صفحه‌بندی‌شدهٔ سالن‌های خودم
router.get("/halls", ...customerChain, portalController.getMyHalls);

// فهرست صفحه‌بندی‌شدهٔ گله‌های خودم
router.get("/flocks", ...customerChain, portalController.getMyFlocks);

// فهرست صفحه‌بندی‌شدهٔ هفته‌های مدیریتی خودم
router.get("/weeks", ...customerChain, portalController.getMyWeeks);

// فهرست صفحه‌بندی‌شدهٔ بازدیدهای خودم (تاریخ/وضعیت + نشانهٔ وجود گزارش)
router.get("/visits", ...customerChain, portalController.getMyVisits);

// ۱۳.۴ — جزئیات یک هفتهٔ مدیریتی (بیماری/واکسن/دارو/خوراک)
router.get("/weeks/:id", ...customerChain, portalController.getMyWeekDetail);

// ۱۳.۴ — جزئیات یک بازدید: متن گزارش + فهرست پیوست‌ها
router.get(
  "/visits/:id",
  ...visitReportChain,
  portalController.getMyVisitDetail,
);

// ۱۳.۴ — دانلود یک پیوست مشخص (فایل داخل uploads/ و متعلق به همان بازدید)
router.get(
  "/visits/:id/attachments/:attachmentId",
  ...visitReportChain,
  portalController.downloadMyAttachment,
);

module.exports = router;
