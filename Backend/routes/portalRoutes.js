// ============================================================
// routes/portalRoutes.js
// «پورتال مشتری» — فاز ۱۳.۲ و ۱۳.۳
// ------------------------------------------------------------
// ⚠️ تنها مسیرهای اختصاصی نقش مشتری. هیچ‌یک از ۲۰+ فایل مسیر موجود
//    باز نشده‌اند: نقش «مشتری» به هیچ GET موجودی اضافه نشده است.
//    در ۱۳.۳ دادهٔ بیشتر (سالن/گله/هفته/بازدید) از همین روتر آمد،
//    نه از باز کردن مسیرهای کارکنان.
//
// زنجیرهٔ دسترسی (به ترتیب و همه اجباری):
//   1) protect                 ⇒ توکن معتبر + کاربر فعال + نشست باز
//   2) authorize("customer")    ⇒ فقط نقش مشتری (کارکنان ۴۰۳ می‌گیرند)
//   3) کلید مجوز customer.portal.view  (قابل بستن از پنل مدیریت)
//   4) requireCustomerLink      ⇒ مشتری بدون پروندهٔ متصل ⇒ ۴۰۳ روشن
//   5) controller              ⇒ فقط req.customerScopeId (از توکن)
//
// 🔒 همهٔ مسیرها GET و بدون شناسهٔ کلاینتی هستند؛ تنها پارامتر مجاز
//    page/limit است (سقف ۵۰ در parsePagination).
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

// خلاصهٔ پروندهٔ خودم (شمارنده‌ها + ۳ ردیف آخر)
router.get("/me", ...customerChain, portalController.getPortalSummary);

// فهرست صفحه‌بندی‌شدهٔ سالن‌های خودم
router.get("/halls", ...customerChain, portalController.getMyHalls);

// فهرست صفحه‌بندی‌شدهٔ گله‌های خودم
router.get("/flocks", ...customerChain, portalController.getMyFlocks);

// فهرست صفحه‌بندی‌شدهٔ هفته‌های مدیریتی خودم
router.get("/weeks", ...customerChain, portalController.getMyWeeks);

// فهرست صفحه‌بندی‌شدهٔ بازدیدهای خودم (فقط تاریخ/وضعیت)
router.get("/visits", ...customerChain, portalController.getMyVisits);

module.exports = router;
