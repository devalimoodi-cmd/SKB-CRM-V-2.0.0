const { sequelize } = require("../config/database");
const { successResponse, errorResponse } = require("../utils/response");
const axios = require("axios");

// ============================================
// دریافت اطلاعات آب و هوا (با دیباگ کامل)
// ============================================
const getWeatherAndAirQuality = async (req, res) => {
  try {
    const { customerId } = req.params;

    console.log("📥 دریافت درخواست برای مشتری:", customerId);

    if (!customerId) {
      return errorResponse(res, "شناسه مشتری الزامی است", 400);
    }

    // 1. دریافت اطلاعات مشتری
    console.log("🔍 جستجوی مشتری...");
    const [customer] = await sequelize.query(
      `
      SELECT id, full_name, province, county, farm_name 
      FROM customer_personal_information 
      WHERE id = :customerId AND active = true
      `,
      {
        replacements: { customerId },
        type: sequelize.QueryTypes.SELECT,
      },
    );

    if (!customer) {
      console.log("❌ مشتری یافت نشد");
      return errorResponse(res, "مشتری یافت نشد", 404);
    }

    console.log("✅ مشتری یافت شد:", customer.full_name);
    console.log("📍 استان:", customer.province, "شهرستان:", customer.county);

    // 2. دریافت مختصات از جدول cities
    console.log("🔍 جستجوی مختصات برای:", customer.county);

    const [city] = await sequelize.query(
      `
      SELECT 
        city_name,
        state_name,
        latitude_deg,
        longitude_deg
      FROM cities 
      WHERE city_name ILIKE :county 
        AND state_name ILIKE :province
      LIMIT 1
      `,
      {
        replacements: {
          county: `%${customer.county || ""}%`,
          province: `%${customer.province || ""}%`,
        },
        type: sequelize.QueryTypes.SELECT,
      },
    );

    console.log("📍 نتیجه جستجوی شهر:", city);

    // اگر شهر پیدا نشد
    if (!city) {
      console.log("❌ شهرستان در جدول cities یافت نشد");
      return successResponse(
        res,
        {
          customer,
          location: null,
          weather: null,
          message: `شهرستان "${customer.county}" در پایگاه داده یافت نشد`,
          debug: {
            province: customer.province,
            county: customer.county,
            found: false,
          },
        },
        "شهرستان یافت نشد",
      );
    }

    // اگر مختصات نداشت
    if (!city.latitude_deg || !city.longitude_deg) {
      console.log("❌ مختصات برای این شهرستان ثبت نشده است");
      return successResponse(
        res,
        {
          customer,
          location: {
            city: city.city_name,
            state: city.state_name,
          },
          weather: null,
          message: `مختصات برای "${city.city_name}" ثبت نشده است`,
          debug: {
            latitude: city.latitude_deg,
            longitude: city.longitude_deg,
            found: true,
          },
        },
        "مختصات ثبت نشده است",
      );
    }

    const latitude = city.latitude_deg;
    const longitude = city.longitude_deg;

    console.log(`✅ مختصات یافت شد: لات: ${latitude}, لانگ: ${longitude}`);

    // 3. دریافت اطلاعات آب و هوا
    let weatherData = null;
    let elevation = null;

    try {
      console.log("🌤️ درخواست به Open-Meteo...");

      const weatherResponse = await axios.get(
        "https://api.open-meteo.com/v1/forecast",
        {
          params: {
            latitude: latitude,
            longitude: longitude,
            current:
              "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m",
            timezone: "Asia/Tehran",
            forecast_days: 1,
          },
          timeout: 10000,
        },
      );

      if (weatherResponse.data) {
        weatherData = {
          current: {
            temperature: weatherResponse.data.current?.temperature_2m,
            apparent_temperature:
              weatherResponse.data.current?.apparent_temperature,
            humidity: weatherResponse.data.current?.relative_humidity_2m,
            windSpeed: weatherResponse.data.current?.wind_speed_10m,
            weatherCode: weatherResponse.data.current?.weather_code,
          },
        };
        console.log("✅ اطلاعات آب و هوا دریافت شد");
      }
    } catch (weatherError) {
      console.error("❌ خطا در دریافت آب و هوا:", weatherError.message);
    }

    // 4. دریافت ارتفاع
    try {
      const elevationResponse = await axios.get(
        "https://api.open-meteo.com/v1/elevation",
        {
          params: {
            latitude: latitude,
            longitude: longitude,
          },
          timeout: 5000,
        },
      );

      if (elevationResponse.data && elevationResponse.data.elevation) {
        elevation = elevationResponse.data.elevation[0] || null;
        console.log("✅ ارتفاع دریافت شد:", elevation);
      }
    } catch (elevationError) {
      console.warn("⚠️ خطا در دریافت ارتفاع:", elevationError.message);
    }

    // 5. ارسال پاسخ موفق
    successResponse(
      res,
      {
        customer: {
          id: customer.id,
          full_name: customer.full_name,
          farm_name: customer.farm_name,
          province: customer.province,
          county: customer.county,
        },
        location: {
          city: city.city_name,
          state: city.state_name,
          latitude: latitude,
          longitude: longitude,
        },
        elevation: elevation,
        weather: weatherData,
        debug: {
          found: true,
          latitude: latitude,
          longitude: longitude,
        },
      },
      "اطلاعات آب و هوا دریافت شد",
    );
  } catch (error) {
    console.error("❌ خطا:", error);
    errorResponse(res, error.message || "خطا در دریافت اطلاعات", 500);
  }
};

module.exports = {
  getWeatherAndAirQuality,
};
