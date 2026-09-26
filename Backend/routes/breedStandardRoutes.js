// ================================================================
// routes/breedStandardRoutes.js
// روت‌های استانداردهای وزنی نژادها
// ✅ کنترل دسترسی بر پایهٔ مجوز (پنل مدیریت ← مدیریت نقش‌ها)
// ================================================================

const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");
const {
  getBreedStandards,
  getBreedStandardById,
  createBreedStandard,
  updateBreedStandard,
  deleteBreedStandard,
} = require("../controllers/breedStandardController");

// =========== روت‌های خواندنی (نیازمند لاگین) ===========
router.get("/", protect, requirePermission("charts.standards"), getBreedStandards);
router.get(
  "/:id",
  protect,
  requirePermission("charts.standards"),
  getBreedStandardById,
);

// =========== روت‌های مدیریتی (فقط مدیران) ===========
router.post(
  "/",
  protect,
  authorize("admin", "super_admin"),
  requirePermission("dictionary.breed-standards.edit"),
  createBreedStandard,
);
router.put(
  "/:id",
  protect,
  authorize("admin", "super_admin"),
  requirePermission("dictionary.breed-standards.edit"),
  updateBreedStandard,
);
router.delete(
  "/:id",
  protect,
  authorize("admin", "super_admin"),
  requirePermission("dictionary.breed-standards.edit"),
  deleteBreedStandard,
);

module.exports = router;
