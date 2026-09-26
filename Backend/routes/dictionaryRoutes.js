const express = require("express");
const router = express.Router();
const dictionaryController = require("../controllers/dictionaryController");
const { protect } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");

// ✅ همهٔ مسیرهای دیکشنری نیاز به ورود دارند
// (قبلاً همهٔ GETها باز بودند و مثلاً /dictionary/experts نام کاربری و موبایل کارشناسان را لو می‌داد)
router.use(protect);

// --------------------Start routes Hall_Tayp dictionary tables-------------

// ============================================
// مسیرهای عمومی (بدون نیاز به احراز هویت)
// ============================================
router.get(
  "/hall-types",
  requirePermission("dictionary.hall-types.view"),
  dictionaryController.getHallTypes,
);

// ============================================
// مسیرهای محافظت شده (فقط ادمین)
// ============================================
router.post(
  "/hall-types",
  protect,
  requirePermission("dictionary.hall-types.edit"),
  dictionaryController.createHallType,
);
router.put(
  "/hall-types/:id",
  protect,
  requirePermission("dictionary.hall-types.edit"),
  dictionaryController.updateHallType,
);
router.delete(
  "/hall-types/:id",
  protect,
  requirePermission("dictionary.hall-types.edit"),
  dictionaryController.deleteHallType,
);
// --------------------finish routes Hall_Tayp dictionary tables-------------

// --------------------Start routes chiken source dictionary tables-------------
// ==================== مسیرهای عمومی ====================
router.get(
  "/chick-sources",
  requirePermission("dictionary.chick-sources.view"),
  dictionaryController.getChickSources,
);

// ==================== مسیرهای محافظت شده (فقط مدیران) ====================
// Chick Sources (جدید)
router.post(
  "/chick-sources",
  protect,
  requirePermission("dictionary.chick-sources.edit"),
  dictionaryController.createChickSource,
);
router.put(
  "/chick-sources/:id",
  protect,
  requirePermission("dictionary.chick-sources.edit"),
  dictionaryController.updateChickSource,
);
router.delete(
  "/chick-sources/:id",
  protect,
  requirePermission("dictionary.chick-sources.edit"),
  dictionaryController.deleteChickSource,
);

// --------------------finish routes chiken source  dictionary tables-------------

// --------------------Start routes chicken-breeds dictionary tables-------------

// ============================مسیر عمومب دریافت لیست همه نژادها =======
// Chicken Breeds
router.get(
  "/chicken-breeds",
  requirePermission("dictionary.chicken-breeds.view"),
  dictionaryController.getChickenBreeds,
);

// Chicken Breeds
router.post(
  "/chicken-breeds",
  protect,
  requirePermission("dictionary.chicken-breeds.edit"),
  dictionaryController.createChickenBreed,
);
router.put(
  "/chicken-breeds/:id",
  protect,
  requirePermission("dictionary.chicken-breeds.edit"),
  dictionaryController.updateChickenBreed,
);
router.delete(
  "/chicken-breeds/:id",
  protect,
  requirePermission("dictionary.chicken-breeds.edit"),
  dictionaryController.deleteChickenBreed,
);

// --------------------finish routes chicken-breeds dictionary tables-------------

// --------------------start routes Cooling Systems dictionary tables-------------
// ====مسیر عمومی
router.get(
  "/cooling-systems",
  requirePermission("dictionary.cooling-systems.view"),
  dictionaryController.getCoolingSystems,
);

//  مسیر هایی ک نیاز ب احراز هویت و تعیین نقش دارد
router.post(
  "/cooling-systems",
  protect,
  requirePermission("dictionary.cooling-systems.edit"),
  dictionaryController.createCoolingSystem,
);
router.put(
  "/cooling-systems/:id",
  protect,
  requirePermission("dictionary.cooling-systems.edit"),
  dictionaryController.updateCoolingSystem,
);
router.delete(
  "/cooling-systems/:id",
  protect,
  requirePermission("dictionary.cooling-systems.edit"),
  dictionaryController.deleteCoolingSystem,
);

// --------------------finish routes Cooling Systems dictionary tables-------------

// --------------------start routes Disease dictionary tables-------------
router.get(
  "/diseases",
  requirePermission("dictionary.diseases.view"),
  dictionaryController.getDiseases,
);
router.post(
  "/diseases",
  protect,
  requirePermission("dictionary.diseases.edit"),
  dictionaryController.createDisease,
);
router.put(
  "/diseases/:id",
  protect,
  requirePermission("dictionary.diseases.edit"),
  dictionaryController.updateDisease,
);
router.delete(
  "/diseases/:id",
  protect,
  requirePermission("dictionary.diseases.edit"),
  dictionaryController.deleteDisease,
);
// --------------------finish routes Disease dictionary tables-------------

// --------------------start routes Feed Types dictionary tables-------------
router.get(
  "/feed-types",
  requirePermission("dictionary.feed-types.view"),
  dictionaryController.getFeedTypes,
);
router.post(
  "/feed-types",
  protect,
  requirePermission("dictionary.feed-types.edit"),
  dictionaryController.createFeedType,
);
router.put(
  "/feed-types/:id",
  protect,
  requirePermission("dictionary.feed-types.edit"),
  dictionaryController.updateFeedType,
);
router.delete(
  "/feed-types/:id",
  protect,
  requirePermission("dictionary.feed-types.edit"),
  dictionaryController.deleteFeedType,
);
// --------------------start routes Feed Types dictionary tables-------------

// --------------------start routes Feeder Types (انواع دان خوری) dictionary tables-------------
router.get(
  "/feeder-types",
  requirePermission("dictionary.feeder-types.view"),
  dictionaryController.getFeederTypes,
);
router.post(
  "/feeder-types",
  protect,
  requirePermission("dictionary.feeder-types.edit"),
  dictionaryController.createFeederType,
);
router.put(
  "/feeder-types/:id",
  protect,
  requirePermission("dictionary.feeder-types.edit"),
  dictionaryController.updateFeederType,
);
router.delete(
  "/feeder-types/:id",
  protect,
  requirePermission("dictionary.feeder-types.edit"),
  dictionaryController.deleteFeederType,
);
// --------------------finish routes Feeder Types dictionary tables-------------

// --------------------start routes Floor Types dictionary tables-------------
router.get(
  "/floor-types",
  requirePermission("dictionary.floor-types.view"),
  dictionaryController.getFloorTypes,
);
router.post(
  "/floor-types",
  protect,
  requirePermission("dictionary.floor-types.edit"),
  dictionaryController.createFloorType,
);
router.put(
  "/floor-types/:id",
  protect,
  requirePermission("dictionary.floor-types.edit"),
  dictionaryController.updateFloorType,
);
router.delete(
  "/floor-types/:id",
  protect,
  requirePermission("dictionary.floor-types.edit"),
  dictionaryController.deleteFloorType,
);
// --------------------finish routes Floor Types dictionary tables-------------

// --------------------start routes Heating Systems dictionary tables-------------
router.get(
  "/heating-systems",
  requirePermission("dictionary.heating-systems.view"),
  dictionaryController.getHeatingSystems,
);
router.post(
  "/heating-systems",
  protect,
  requirePermission("dictionary.heating-systems.edit"),
  dictionaryController.createHeatingSystem,
);
router.put(
  "/heating-systems/:id",
  protect,
  requirePermission("dictionary.heating-systems.edit"),
  dictionaryController.updateHeatingSystem,
);
router.delete(
  "/heating-systems/:id",
  protect,
  requirePermission("dictionary.heating-systems.edit"),
  dictionaryController.deleteHeatingSystem,
);
// --------------------finish routes Heating Systems dictionary tables-------------

// --------------------start routes Lighting Systems dictionary tables-------------

router.get(
  "/lighting-systems",
  requirePermission("dictionary.lighting-systems.view"),
  dictionaryController.getLightingSystems,
);
router.post(
  "/lighting-systems",
  protect,
  requirePermission("dictionary.lighting-systems.edit"),
  dictionaryController.createLightingSystem,
);
router.put(
  "/lighting-systems/:id",
  protect,
  requirePermission("dictionary.lighting-systems.edit"),
  dictionaryController.updateLightingSystem,
);
router.delete(
  "/lighting-systems/:id",
  protect,
  requirePermission("dictionary.lighting-systems.edit"),
  dictionaryController.deleteLightingSystem,
);
// --------------------finish routes Lighting Systems dictionary tables-------------

// --------------------start routes Medicines dictionary tables-------------
router.get(
  "/medicines",
  requirePermission("dictionary.medicines.view"),
  dictionaryController.getMedicines,
);
router.post(
  "/medicines",
  protect,
  requirePermission("dictionary.medicines.edit"),
  dictionaryController.createMedicine,
);
router.put(
  "/medicines/:id",
  protect,
  requirePermission("dictionary.medicines.edit"),
  dictionaryController.updateMedicine,
);
router.delete(
  "/medicines/:id",
  protect,
  requirePermission("dictionary.medicines.edit"),
  dictionaryController.deleteMedicine,
);
// --------------------finish routes Medicines dictionary tables-------------

// --------------------start routes Suggestion Types dictionary tables-------------
router.get(
  "/suggestion-types",
  requirePermission("dictionary.suggestion-types.view"),
  dictionaryController.getSuggestionTypes,
);
router.post(
  "/suggestion-types",
  protect,
  requirePermission("dictionary.suggestion-types.edit"),
  dictionaryController.createSuggestionType,
);
router.put(
  "/suggestion-types/:id",
  protect,
  requirePermission("dictionary.suggestion-types.edit"),
  dictionaryController.updateSuggestionType,
);
router.delete(
  "/suggestion-types/:id",
  protect,
  requirePermission("dictionary.suggestion-types.edit"),
  dictionaryController.deleteSuggestionType,
);
// --------------------finish routes Suggestion Types dictionary tables-------------

// --------------------start routes vaccines dictionary tables-------------
router.get(
  "/vaccines",
  requirePermission("dictionary.vaccines.view"),
  dictionaryController.getVaccines,
);
router.post(
  "/vaccines",
  protect,
  requirePermission("dictionary.vaccines.edit"),
  dictionaryController.createVaccine,
);
router.put(
  "/vaccines/:id",
  protect,
  requirePermission("dictionary.vaccines.edit"),
  dictionaryController.updateVaccine,
);
router.delete(
  "/vaccines/:id",
  protect,
  requirePermission("dictionary.vaccines.edit"),
  dictionaryController.deleteVaccine,
);

// --------------------finish routes vaccines dictionary tables-------------

// --------------------start routes VentilationTypes dictionary tables-------------
router.get(
  "/ventilation-types",
  requirePermission("dictionary.ventilation-types.view"),
  dictionaryController.getVentilationTypes,
);
router.post(
  "/ventilation-types",
  protect,
  requirePermission("dictionary.ventilation-types.edit"),
  dictionaryController.createVentilationType,
);
router.put(
  "/ventilation-types/:id",
  protect,
  requirePermission("dictionary.ventilation-types.edit"),
  dictionaryController.updateVentilationType,
);
router.delete(
  "/ventilation-types/:id",
  protect,
  requirePermission("dictionary.ventilation-types.edit"),
  dictionaryController.deleteVentilationType,
);
// --------------------finish routes VentilationTypes dictionary tables-------------

// --------------------start routes WaterInletTypes dictionary tables-------------

router.get(
  "/water-inlet-types",
  requirePermission("dictionary.water-inlet-types.view"),
  dictionaryController.getWaterInletTypes,
);
router.post(
  "/water-inlet-types",
  protect,
  requirePermission("dictionary.water-inlet-types.edit"),
  dictionaryController.createWaterInletType,
);
router.put(
  "/water-inlet-types/:id",
  protect,
  requirePermission("dictionary.water-inlet-types.edit"),
  dictionaryController.updateWaterInletType,
);
router.delete(
  "/water-inlet-types/:id",
  protect,
  requirePermission("dictionary.water-inlet-types.edit"),
  dictionaryController.deleteWaterInletType,
);
// --------------------finish routes WaterInletTypes dictionary tables-------------

// --------------------start routes getWatererTypes dictionary tables-------------
router.get(
  "/waterer-types",
  requirePermission("dictionary.waterer-types.view"),
  dictionaryController.getWatererTypes,
);
router.post(
  "/waterer-types",
  protect,
  requirePermission("dictionary.waterer-types.edit"),
  dictionaryController.createWatererType,
);
router.put(
  "/waterer-types/:id",
  protect,
  requirePermission("dictionary.waterer-types.edit"),
  dictionaryController.updateWatererType,
);
router.delete(
  "/waterer-types/:id",
  protect,
  requirePermission("dictionary.waterer-types.edit"),
  dictionaryController.deleteWatererType,
);

// --------------------finish routes getWatererTypes dictionary tables-------------

// --------------------start routes Experts (کارشناسان) dictionary tables-------------
router.get(
  "/experts",
  requirePermission("users.list.view"),
  dictionaryController.getExperts,
);

// --------------------finish routes Experts dictionary tables-------------

// --------------------start routes Unit Statuses dictionary tables-------------
router.get(
  "/unit-statuses",
  requirePermission("dictionary.unit-statuses.view"),
  dictionaryController.getUnitStatuses,
);
router.post(
  "/unit-statuses",
  protect,
  requirePermission("dictionary.unit-statuses.edit"),
  dictionaryController.createUnitStatus,
);
router.put(
  "/unit-statuses/:id",
  protect,
  requirePermission("dictionary.unit-statuses.edit"),
  dictionaryController.updateUnitStatus,
);
router.delete(
  "/unit-statuses/:id",
  protect,
  requirePermission("dictionary.unit-statuses.edit"),
  dictionaryController.deleteUnitStatus,
);
// --------------------finish routes Unit Statuses dictionary tables-------------

// --------------------start routes Customer Types (نوع مشتری) dictionary tables-------------
// ==================== مسیرهای عمومی (با ورود کاربر) ====================
router.get(
  "/customer-types",
  requirePermission("dictionary.customer-types.view"),
  dictionaryController.getCustomerTypes,
);

// ==================== مسیرهای محافظت شده (فقط مدیران) ====================
router.post(
  "/customer-types",
  protect,
  requirePermission("dictionary.customer-types.edit"),
  dictionaryController.createCustomerType,
);
router.put(
  "/customer-types/:id",
  protect,
  requirePermission("dictionary.customer-types.edit"),
  dictionaryController.updateCustomerType,
);
router.delete(
  "/customer-types/:id",
  protect,
  requirePermission("dictionary.customer-types.edit"),
  dictionaryController.deleteCustomerType,
);
// --------------------finish routes Customer Types (نوع مشتری) dictionary tables-------------

module.exports = router;
