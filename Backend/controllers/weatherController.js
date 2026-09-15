const { sequelize } = require("../config/database");
const { successResponse, errorResponse } = require("../utils/response");
const axios = require("axios");

// ============================================
// ✅ کش کوتاه‌مدت آب‌وهوا
// شبکهٔ کارخانه ممکن است اینترنت ضعیف/قطعی داشته باشد؛ بدون کش هر بازدید
// داشبورد تا ۱۰ ثانیه منتظر پاسخ api.open-meteo.com می‌ماند.
// با کش: پاسخ فوری + در صورت قطعی، آخرین مقدار شناخته‌شده برگردانده می‌شود.
// ============================================
const WEATHER_CACHE = new Map(); // key → { data, expiresAt }

const cacheMinutes = () => {
  const n = parseInt(process.env.WEATHER_CACHE_MINUTES ?? "20", 10);
  return Number.isFinite(n) && n >= 0 ? n : 20;
};

const cacheTimeoutMs = (value, fallback) => {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const weatherCacheKey = (lat, lon) =>
  `${Number(lat).toFixed(2)},${Number(lon).toFixed(2)}`;

const readWeatherCache = (key) => {
  const entry = WEATHER_CACHE.get(key);
  if (!entry) return { fresh: null, stale: null };
  return {
    fresh: entry.expiresAt > Date.now() ? entry.data : null,
    stale: entry.data,
  };
};

const writeWeatherCache = (key, data) => {
  const minutes = cacheMinutes();
  if (minutes <= 0) return; // کش غیرفعال (WEATHER_CACHE_MINUTES=0)
  WEATHER_CACHE.set(key, {
    data,
    expiresAt: Date.now() + minutes * 60 * 1000,
  });
  // پاک‌سازی ساده (جلوگیری از رشد بی‌پایان حافظه)
  if (WEATHER_CACHE.size > 500) {
    const now = Date.now();
    for (const [k, v] of WEATHER_CACHE) {
      if (v.expiresAt < now) WEATHER_CACHE.delete(k);
    }
  }
};

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

    // 3. دریافت اطلاعات آب و هوا (با کش)
    const cacheKeyValue = weatherCacheKey(latitude, longitude);
    const cacheState = readWeatherCache(cacheKeyValue);

    let weatherData = null;
    let elevation = null;
    let fromCache = false;

    if (cacheState.fresh) {
      weatherData = cacheState.fresh.weather;
      elevation = cacheState.fresh.elevation;
      fromCache = true;
      console.log("⚡ آب‌وهوا از کش خوانده شد (بدون درخواست به اینترنت)");
    } else {
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
            timeout: cacheTimeoutMs(process.env.WEATHER_TIMEOUT_MS, 8000),
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
            timeout: cacheTimeoutMs(process.env.WEATHER_TIMEOUT_MS, 8000),
          },
        );

        if (elevationResponse.data && elevationResponse.data.elevation) {
          elevation = elevationResponse.data.elevation[0] || null;
          console.log("✅ ارتفاع دریافت شد:", elevation);
        }
      } catch (elevationError) {
        console.warn("⚠️ خطا در دریافت ارتفاع:", elevationError.message);
      }

      if (weatherData || elevation !== null) {
        writeWeatherCache(cacheKeyValue, { weather: weatherData, elevation });
      } else if (cacheState.stale) {
        // ✅ اینترنت قطع است → آخرین مقدار شناخته‌شده برگردانده می‌شود
        weatherData = cacheState.stale.weather;
        elevation = cacheState.stale.elevation;
        fromCache = true;
        console.warn("⚠️ آب‌وهوا از کش قدیمی برگردانده شد (اینترنت در دسترس نیست)");
      }
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
        cached: fromCache,
        debug: {
          found: true,
          latitude: latitude,
          longitude: longitude,
          cache_minutes: cacheMinutes(),
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
