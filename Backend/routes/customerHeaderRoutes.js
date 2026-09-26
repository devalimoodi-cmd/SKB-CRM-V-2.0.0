// BackEnd/routes/customerHeaderRoutes.js

const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");
const customerHeaderController = require("../controllers/customerHeaderController");

// ✅ همه مسیرها نیاز به احراز هویت دارند
router.use(protect);

// دریافت اطلاعات کامل هدر مشتری
// ✅ مجوز: مشاهدهٔ اطلاعات پایهٔ مشتری
router.get(
  "/:id/header",
  authorize("expert", "admin", "sub_admin", "super_admin"),
  requirePermission("customer.basic.view"),
  customerHeaderController.getCustomerHeaderInfo,
);

module.exports = router;
