const express = require("express");
const router = express.Router();
const dictionaryController = require("../controllers/dictionaryController");
const { protect, authorize } = require("../middleware/auth");

// --------------------Start routes Hall_Tayp dictionary tables-------------

// ============================================
// مسیرهای عمومی (بدون نیاز به احراز هویت)
// ============================================
router.get("/hall-types", dictionaryController.getHallTypes);

// ============================================
// مسیرهای محافظت شده (فقط ادمین)
// ============================================
router.post(
  "/hall-types",
  protect,
  authorize("admin", "super_admin"),
  dictionaryController.createHallType,
);
router.put(
  "/hall-types/:id",
  protect,
  authorize("admin", "super_admin"),
  dictionaryController.updateHallType,
);
router.delete(
  "/hall-types/:id",
  protect,
  authorize("admin", "super_admin"),
  dictionaryController.deleteHallType,
);
// --------------------finish routes Hall_Tayp dictionary tables-------------

// --------------------Start routes chiken source dictionary tables-------------
// ==================== مسیرهای عمومی ====================
router.get("/chick-sources", dictionaryController.getChickSources);

// ==================== مسیرهای محافظت شده (فقط مدیران) ====================
// Chick Sources (جدید)
router.post(
  "/chick-sources",
  protect,
  authorize("admin", "super_admin"),
  dictionaryController.createChickSource,
);
router.put(
  "/chick-sources/:id",
  protect,
  authorize("admin", "super_admin"),
  dictionaryController.updateChickSource,
);
router.delete(
  "/chick-sources/:id",
  protect,
  authorize("admin", "super_admin"),
  dictionaryController.deleteChickSource,
);

// --------------------finish routes chiken source  dictionary tables-------------

// --------------------Start routes chicken-breeds dictionary tables-------------

// ============================مسیر عمومب دریافت لیست همه نژادها =======
// Chicken Breeds
router.get("/chicken-breeds", dictionaryController.getChickenBreeds);

// Chicken Breeds
router.post(
  "/chicken-breeds",
  protect,
  authorize("admin", "super_admin"),
  dictionaryController.createChickenBreed,
);
router.put(
  "/chicken-breeds/:id",
  protect,
  authorize("admin", "super_admin"),
  dictionaryController.updateChickenBreed,
);
router.delete(
  "/chicken-breeds/:id",
  protect,
  authorize("admin", "super_admin"),
  dictionaryController.deleteChickenBreed,
);

// --------------------finish routes chicken-breeds dictionary tables-------------

// --------------------start routes Cooling Systems dictionary tables-------------
// ====مسیر عمومی
router.get("/cooling-systems", dictionaryController.getCoolingSystems);

//  مسیر هایی ک نیاز ب احراز هویت و تعیین نقش دارد
router.post(
  "/cooling-systems",
  protect,
  authorize("admin", "super_admin"),
  dictionaryController.createCoolingSystem,
);
router.put(
  "/cooling-systems/:id",
  protect,
  authorize("admin", "super_admin"),
  dictionaryController.updateCoolingSystem,
);
router.delete(
  "/cooling-systems/:id",
  protect,
  authorize("admin", "super_admin"),
  dictionaryController.deleteCoolingSystem,
);

// --------------------finish routes Cooling Systems dictionary tables-------------

// --------------------start routes Disease dictionary tables-------------
router.get("/diseases", dictionaryController.getDiseases);
router.post(
  "/diseases",
  protect,
  authorize("admin", "super_admin"),
  dictionaryController.createDisease,
);
router.put(
  "/diseases/:id",
  protect,
  authorize("admin", "super_admin"),
  dictionaryController.updateDisease,
);
router.delete(
  "/diseases/:id",
  protect,
  authorize("admin", "super_admin"),
  dictionaryController.deleteDisease,
);
// --------------------finish routes Disease dictionary tables-------------

// --------------------start routes Feed Types dictionary tables-------------
router.get("/feed-types", dictionaryController.getFeedTypes);
router.post(
  "/feed-types",
  protect,
  authorize("admin", "super_admin"),
  dictionaryController.createFeedType,
);
router.put(
  "/feed-types/:id",
  protect,
  authorize("admin", "super_admin"),
  dictionaryController.updateFeedType,
);
router.delete(
  "/feed-types/:id",
  protect,
  authorize("admin", "super_admin"),
  dictionaryController.deleteFeedType,
);
// --------------------start routes Feed Types dictionary tables-------------

// --------------------start routes Feeder Types (انواع دان خوری) dictionary tables-------------
router.get("/feeder-types", dictionaryController.getFeederTypes);
router.post(
  "/feeder-types",
  protect,
  authorize("admin", "super_admin"),
  dictionaryController.createFeederType,
);
router.put(
  "/feeder-types/:id",
  protect,
  authorize("admin", "super_admin"),
  dictionaryController.updateFeederType,
);
router.delete(
  "/feeder-types/:id",
  protect,
  authorize("admin", "super_admin"),
  dictionaryController.deleteFeederType,
);
// --------------------finish routes Feeder Types dictionary tables-------------

// --------------------start routes Floor Types dictionary tables-------------
router.get("/floor-types", dictionaryController.getFloorTypes);
router.post(
  "/floor-types",
  protect,
  authorize("admin", "super_admin"),
  dictionaryController.createFloorType,
);
router.put(
  "/floor-types/:id",
  protect,
  authorize("admin", "super_admin"),
  dictionaryController.updateFloorType,
);
router.delete(
  "/floor-types/:id",
  protect,
  authorize("admin", "super_admin"),
  dictionaryController.deleteFloorType,
);
// --------------------finish routes Floor Types dictionary tables-------------

// --------------------start routes Heating Systems dictionary tables-------------
router.get("/heating-systems", dictionaryController.getHeatingSystems);
router.post(
  "/heating-systems",
  protect,
  authorize("admin", "super_admin"),
  dictionaryController.createHeatingSystem,
);
router.put(
  "/heating-systems/:id",
  protect,
  authorize("admin", "super_admin"),
  dictionaryController.updateHeatingSystem,
);
router.delete(
  "/heating-systems/:id",
  protect,
  authorize("admin", "super_admin"),
  dictionaryController.deleteHeatingSystem,
);
// --------------------finish routes Heating Systems dictionary tables-------------

// --------------------start routes Lighting Systems dictionary tables-------------

router.get("/lighting-systems", dictionaryController.getLightingSystems);
router.post(
  "/lighting-systems",
  protect,
  authorize("admin", "super_admin"),
  dictionaryController.createLightingSystem,
);
router.put(
  "/lighting-systems/:id",
  protect,
  authorize("admin", "super_admin"),
  dictionaryController.updateLightingSystem,
);
router.delete(
  "/lighting-systems/:id",
  protect,
  authorize("admin", "super_admin"),
  dictionaryController.deleteLightingSystem,
);
// --------------------finish routes Lighting Systems dictionary tables-------------

// --------------------start routes Medicines dictionary tables-------------
router.get("/medicines", dictionaryController.getMedicines);
router.post(
  "/medicines",
  protect,
  authorize("admin", "super_admin"),
  dictionaryController.createMedicine,
);
router.put(
  "/medicines/:id",
  protect,
  authorize("admin", "super_admin"),
  dictionaryController.updateMedicine,
);
router.delete(
  "/medicines/:id",
  protect,
  authorize("admin", "super_admin"),
  dictionaryController.deleteMedicine,
);
// --------------------finish routes Medicines dictionary tables-------------

// --------------------start routes Suggestion Types dictionary tables-------------
router.get("/suggestion-types", dictionaryController.getSuggestionTypes);
router.post(
  "/suggestion-types",
  protect,
  authorize("admin", "super_admin"),
  dictionaryController.createSuggestionType,
);
router.put(
  "/suggestion-types/:id",
  protect,
  authorize("admin", "super_admin"),
  dictionaryController.updateSuggestionType,
);
router.delete(
  "/suggestion-types/:id",
  protect,
  authorize("admin", "super_admin"),
  dictionaryController.deleteSuggestionType,
);
// --------------------finish routes Suggestion Types dictionary tables-------------

// --------------------start routes vaccines dictionary tables-------------
router.get("/vaccines", dictionaryController.getVaccines);
router.post(
  "/vaccines",
  protect,
  authorize("admin", "super_admin"),
  dictionaryController.createVaccine,
);
router.put(
  "/vaccines/:id",
  protect,
  authorize("admin", "super_admin"),
  dictionaryController.updateVaccine,
);
router.delete(
  "/vaccines/:id",
  protect,
  authorize("admin", "super_admin"),
  dictionaryController.deleteVaccine,
);

// --------------------finish routes vaccines dictionary tables-------------

// --------------------start routes VentilationTypes dictionary tables-------------
router.get("/ventilation-types", dictionaryController.getVentilationTypes);
router.post(
  "/ventilation-types",
  protect,
  authorize("admin", "super_admin"),
  dictionaryController.createVentilationType,
);
router.put(
  "/ventilation-types/:id",
  protect,
  authorize("admin", "super_admin"),
  dictionaryController.updateVentilationType,
);
router.delete(
  "/ventilation-types/:id",
  protect,
  authorize("admin", "super_admin"),
  dictionaryController.deleteVentilationType,
);
// --------------------finish routes VentilationTypes dictionary tables-------------

// --------------------start routes WaterInletTypes dictionary tables-------------

router.get("/water-inlet-types", dictionaryController.getWaterInletTypes);
router.post(
  "/water-inlet-types",
  protect,
  authorize("admin", "super_admin"),
  dictionaryController.createWaterInletType,
);
router.put(
  "/water-inlet-types/:id",
  protect,
  authorize("admin", "super_admin"),
  dictionaryController.updateWaterInletType,
);
router.delete(
  "/water-inlet-types/:id",
  protect,
  authorize("admin", "super_admin"),
  dictionaryController.deleteWaterInletType,
);
// --------------------finish routes WaterInletTypes dictionary tables-------------

// --------------------start routes getWatererTypes dictionary tables-------------
router.get("/waterer-types", dictionaryController.getWatererTypes);
router.post(
  "/waterer-types",
  protect,
  authorize("admin", "super_admin"),
  dictionaryController.createWatererType,
);
router.put(
  "/waterer-types/:id",
  protect,
  authorize("admin", "super_admin"),
  dictionaryController.updateWatererType,
);
router.delete(
  "/waterer-types/:id",
  protect,
  authorize("admin", "super_admin"),
  dictionaryController.deleteWatererType,
);

// --------------------finish routes getWatererTypes dictionary tables-------------

// --------------------start routes Experts (کارشناسان) dictionary tables-------------
router.get("/experts", dictionaryController.getExperts);

// --------------------finish routes Experts dictionary tables-------------

// --------------------start routes Unit Statuses dictionary tables-------------
router.get("/unit-statuses", dictionaryController.getUnitStatuses);
router.post(
  "/unit-statuses",
  protect,
  authorize("admin", "super_admin"),
  dictionaryController.createUnitStatus,
);
router.put(
  "/unit-statuses/:id",
  protect,
  authorize("admin", "super_admin"),
  dictionaryController.updateUnitStatus,
);
router.delete(
  "/unit-statuses/:id",
  protect,
  authorize("admin", "super_admin"),
  dictionaryController.deleteUnitStatus,
);
// --------------------finish routes Unit Statuses dictionary tables-------------

module.exports = router;
