const express = require("express");
const router = express.Router();
const customerController = require("../controllers/customerRegistrationController");
const { protect } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");

// ==============================================================
// ✅ کنترل دسترسی بر پایهٔ «مجوز» (قابل تنظیم در پنل مدیریت ← مدیریت نقش‌ها)
// --------------------------------------------------------------
// مجوزها از کاتالوگ config/permissions.js می‌آیند و ادمین می‌تواند هرکدام
// را برای هر نقش (و هر کاربر) روشن/خاموش کند.
// ⚠️ در حالت آزمایشی (PERMISSIONS_ENFORCE=false — پیش‌فرض) هیچ درخواستی
//     بلاک نمی‌شود و فقط «چه کسی فاقد چه مجوزی بود» در لاگ ثبت می‌شود.
//     قبلاً دو مسیر enable/disable و ویرایش مشتری فقط protect داشتند
//     (هر کاربر لاگین‌شده می‌توانست) که با این تغییر بسته می‌شود.
// ==============================================================

// ------------------------ثبت مشتری جدید-----------------
router.post(
  "/register",
  protect,
  requirePermission("customers.register"),
  customerController.registerCustomer,
);

// ------------------------لیست مشتریان-----------------
router.get(
  "/",
  protect,
  requirePermission("customers.list.view"),
  customerController.getAllCustomers,
);

// ------------------------حذف مشتری (فقط مدیر اصلی)-----------------
router.delete(
  "/:id",
  protect,
  requirePermission("customers.delete"),
  customerController.deleteCustomer,
);

// ------------------------فعال/غیرفعال کردن مشتری-----------------
router.put(
  "/:id/disable",
  protect,
  requirePermission("customers.toggle"),
  customerController.toggleCustomerStatus,
);
router.put(
  "/:id/enable",
  protect,
  requirePermission("customers.toggle"),
  customerController.toggleCustomerStatus,
);

// ------------------------مشاهدهٔ یک مشتری-----------------
router.get(
  "/:id",
  protect,
  requirePermission("customers.profile.view"),
  customerController.getCustomerById,
);

// ------------------------ویرایش مشتری-----------------
router.put(
  "/:id",
  protect,
  requirePermission("customers.edit"),
  customerController.updateCustomer,
);

module.exports = router;

