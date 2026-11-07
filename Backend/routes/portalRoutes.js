// ============================================================
// routes/portalRoutes.js
// «پورتال مشتری» — فاز ۱۳.۲
// ------------------------------------------------------------
// ⚠️ این تنها مسیر تازهٔ فاز ۱۳.۲ است. هیچ‌یک از ۲۰ فایل مسیر موجود
//    باز نشده‌اند: نقش «مشتری» به هیچ GET موجودی اضافه نشده است.
//
// زنجیرهٔ دسترسی (به ترتیب و همه اجباری):
//   1) protect                 ⇒ توکن معتبر + کاربر فعال + نشست باز
//   2) authorize("customer")    ⇒ فقط نقش مشتری (کارکنان ۴۰۳ می‌گیرند)
//   3) کلید مجوز customer.portal.view  (قابل بستن از پنل مدیریت)
//   4) requireCustomerLink      ⇒ مشتری بدون پروندهٔ متصل ⇒ ۴۰۳ روشن
//   5) controller              ⇒ فقط req.customerScopeId (از توکن)
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

// خلاصهٔ پورتال مشتری (خواندنی — هیچ پارامتری از کلاینت نمی‌گیرد)
router.get(
  "/me",
  authorize("customer"),
  requirePermission("customer.portal.view"),
  requireCustomerLink,
  portalController.getPortalSummary,
);

module.exports = router;
