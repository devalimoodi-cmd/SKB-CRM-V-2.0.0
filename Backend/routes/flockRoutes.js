// ================================================================
// routes/flockRoutes.js
// روت‌های «گله» (دوره پرورش)
// ================================================================

const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const flockController = require("../controllers/flockController");

// مشاهده (لاگین)
router.get("/", protect, flockController.getFlocks);
router.get("/:id", protect, flockController.getFlockById);

// عملیات (کارشناس و مدیران)
router.post(
  "/",
  protect,
  authorize("expert", "admin", "super_admin", "sub_admin"),
  flockController.createFlock,
);
router.put(
  "/:id/end",
  protect,
  authorize("expert", "admin", "super_admin", "sub_admin"),
  flockController.endFlock,
);

module.exports = router;
