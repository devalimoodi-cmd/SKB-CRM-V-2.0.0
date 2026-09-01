const express = require("express");
const router = express.Router();
const weatherController = require("../controllers/weatherController");
const { protect, authorize } = require("../middleware/auth");

// دریافت اطلاعات آب و هوا و کیفیت هوا برای یک مشتری
router.get(
  "/customer/:customerId",
  protect,
  authorize("admin", "super_admin", "sub_admin", "expert"),
  weatherController.getWeatherAndAirQuality,
);

module.exports = router;
