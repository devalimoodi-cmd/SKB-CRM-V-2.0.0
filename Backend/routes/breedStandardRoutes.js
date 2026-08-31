// ================================================================
// routes/breedStandardRoutes.js
// روت‌های استانداردهای وزنی نژادها
// ================================================================

const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const {
  getBreedStandards,
  getBreedStandardById,
  createBreedStandard,
  updateBreedStandard,
  deleteBreedStandard,
} = require("../controllers/breedStandardController");

// =========== روت‌های خواندنی (نیازمند لاگین) ===========
router.get("/", protect, getBreedStandards);
router.get("/:id", protect, getBreedStandardById);

// =========== روت‌های مدیریتی (فقط مدیران) ===========
router.post(
  "/",
  protect,
  authorize("admin", "super_admin"),
  createBreedStandard,
);
router.put(
  "/:id",
  protect,
  authorize("admin", "super_admin"),
  updateBreedStandard,
);
router.delete(
  "/:id",
  protect,
  authorize("admin", "super_admin"),
  deleteBreedStandard,
);

module.exports = router;
