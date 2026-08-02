const express = require("express");
const router = express.Router();
const cityController = require("../controllers/cityController");

// دریافت لیست استان‌ها
router.get("/provinces", cityController.getProvinces);
//

// دریافت شهرستان‌ها بر اساس استان
router.get(
  "/cities-by-province/:stateName",
  cityController.getCitiesByProvince,
);
//

// مسیر فیلد دپارتمان های فروش و فیلد سطح تحصیلات
router.get("/education-levels", cityController.getEducationLevels);
router.get("/departments", cityController.getDepartments);
//

module.exports = router;
