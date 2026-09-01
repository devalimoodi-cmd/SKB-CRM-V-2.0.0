// BackEnd/routes/customerHeaderRoutes.js

const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const customerHeaderController = require("../controllers/customerHeaderController");

// ✅ همه مسیرها نیاز به احراز هویت دارند
router.use(protect);

// دریافت اطلاعات کامل هدر مشتری
router.get(
  "/:id/header",
  authorize("expert", "admin", "sub_admin", "super_admin"),
  customerHeaderController.getCustomerHeaderInfo,
);

module.exports = router;
