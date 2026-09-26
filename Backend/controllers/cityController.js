const { sequelize } = require("../config/database");
const { successResponse, errorResponse } = require("../utils/response");

// -----------------------Start City And State Filed filer------------

// دریافت لیست استان‌های unique
const getProvinces = async (req, res) => {
  try {
    const [provinces] = await sequelize.query(`
            SELECT DISTINCT state_code, state_name 
            FROM cities 
            WHERE state_code IS NOT NULL AND state_name IS NOT NULL
            ORDER BY state_name
        `);

    successResponse(res, provinces, "لیست استان‌ها دریافت شد");
  } catch (error) {
    console.error("خطا در دریافت استان‌ها:", error);
    errorResponse(res, error.message, 500);
  }
};

// دریافت شهرستان‌ها بر اساس نام استان
const getCitiesByProvince = async (req, res) => {
  try {
    // ✅ استفاده از stateName به جای stateCode
    const { stateName } = req.params;

    console.log(`🔍 جستجوی شهرستان‌های استان: ${stateName}`);

    const [cities] = await sequelize.query(
      `
            SELECT DISTINCT city_name 
            FROM cities 
            WHERE state_name ILIKE :stateName
            ORDER BY city_name
        `,
      {
        replacements: { stateName: `%${stateName}%` },
      },
    );

    successResponse(res, cities, "لیست شهرستان‌ها دریافت شد");
  } catch (error) {
    console.error("خطا در دریافت شهرستان‌ها:", error);
    errorResponse(res, error.message, 500);
  }
};
// -----------------------finish City And State Filed filer---------------------------

// ------------------------------------------Start Load Education Levels Data ---------------------------------

// ============================================
// دریافت لیست سطح تحصیلات از دیتابیس
// ============================================
const getEducationLevels = async (req, res) => {
  try {
    const [educationLevels] = await sequelize.query(`
            SELECT id, title, display_order 
            FROM education_levels 
            ORDER BY display_order ASC
        `);

    successResponse(res, educationLevels, "لیست سطح تحصیلات دریافت شد");
  } catch (error) {
    console.error("خطا در دریافت سطح تحصیلات:", error);
    errorResponse(res, error.message, 500);
  }
};

// ============================================
// دریافت لیست دپارتمان‌ها از دیتابیس
// ============================================
const getDepartments = async (req, res) => {
  try {
    const [departments] = await sequelize.query(`
            SELECT id, title, display_order 
            FROM departments 
            ORDER BY display_order ASC
        `);

    successResponse(res, departments, "لیست دپارتمان‌ها دریافت شد");
  } catch (error) {
    console.error("خطا در دریافت دپارتمان‌ها:", error);
    errorResponse(res, error.message, 500);
  }
};

// ------------------------------------------finish Load Education Levels Data ---------------------------------

module.exports = {
  getProvinces,
  getCitiesByProvince,
  getEducationLevels,
  getDepartments,
};
