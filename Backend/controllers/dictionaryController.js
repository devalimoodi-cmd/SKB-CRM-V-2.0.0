// ------------------------------start general option-----------------
const ChickSource = require("../models/ChickSource");
const HallType = require("../models/HallType");
const ChickenBreed = require("../models/ChickenBreed");
const CoolingSystemType = require("../models/CoolingSystemType");
const Disease = require("../models/Disease");
const FeedType = require("../models/FeedType");
const FeederType = require("../models/FeederType");
const FloorType = require("../models/FloorType");
const HeatingSystemType = require("../models/HeatingSystemType");
const LightingSystemType = require("../models/LightingSystemType");
const Medicine = require("../models/Medicine");
const SuggestionType = require("../models/SuggestionType");
const Vaccine = require("../models/Vaccine");
const VentilationType = require("../models/VentilationType");
const WaterInletType = require("../models/WaterInletType");
const WatererType = require("../models/WatererType");
const User = require("../models/User");

// ------------------------------finish-------------------------------

// --------------start  Controller functions of the HallType table--------

// پاسخ موفق استاندارد
const successResponse = (
  res,
  data,
  message = "با موفقیت انجام شد",
  statusCode = 200,
) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
  });
};

// پاسخ خطا استاندارد
const errorResponse = (
  res,
  message = "خطا رخ داده است",
  statusCode = 500,
  errors = null,
) => {
  return res.status(statusCode).json({
    success: false,
    message,
    errors,
    timestamp: new Date().toISOString(),
  });
};

// ============================================
// دریافت همه انواع سالن
// ============================================
const getHallTypes = async (req, res) => {
  try {
    const hallTypes = await HallType.findAll({
      where: { active: true },
      order: [
        ["sort_order", "ASC"],
        ["id", "ASC"],
      ],
      attributes: ["id", "name", "description", "sort_order"],
    });

    successResponse(res, hallTypes, "لیست انواع سالن دریافت شد");
  } catch (error) {
    console.error("خطا:", error);
    errorResponse(res, error.message, 500);
  }
};

// ============================================
// ایجاد نوع سالن جدید (برای ادمین)
// ============================================
const createHallType = async (req, res) => {
  try {
    const { name, description, sort_order } = req.body;

    if (!name) {
      return errorResponse(res, "نام نوع سالن الزامی است", 400);
    }

    const hallType = await HallType.create({
      name,
      description: description || null,
      sort_order: sort_order || 0,
    });

    successResponse(res, hallType, "نوع سالن با موفقیت ایجاد شد", 201);
  } catch (error) {
    console.error("خطا:", error);

    if (error.name === "SequelizeUniqueConstraintError") {
      return errorResponse(res, "این نام قبلاً ثبت شده است", 400);
    }

    errorResponse(res, error.message, 500);
  }
};

// ============================================
// بروزرسانی نوع سالن
// ============================================
const updateHallType = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, sort_order, active } = req.body;

    const hallType = await HallType.findByPk(id);
    if (!hallType) {
      return errorResponse(res, "نوع سالن یافت نشد", 404);
    }

    await hallType.update({
      name: name || hallType.name,
      description:
        description !== undefined ? description : hallType.description,
      sort_order: sort_order !== undefined ? sort_order : hallType.sort_order,
      active: active !== undefined ? active : hallType.active,
    });

    successResponse(res, hallType, "نوع سالن با موفقیت بروزرسانی شد");
  } catch (error) {
    console.error("خطا:", error);
    errorResponse(res, error.message, 500);
  }
};

// ============================================
// حذف نوع سالن
// ============================================
const deleteHallType = async (req, res) => {
  try {
    const { id } = req.params;

    const hallType = await HallType.findByPk(id);
    if (!hallType) {
      return errorResponse(res, "نوع سالن یافت نشد", 404);
    }

    await hallType.destroy();
    successResponse(res, null, "نوع سالن با موفقیت حذف شد");
  } catch (error) {
    console.error("خطا:", error);
    errorResponse(res, error.message, 500);
  }
};

// --------------finish Controller functions of the HallType table--------

// --------------Start Controller functions of the chicken source table--------
// ============================================
// دریافت همه مبداهای جوجه
// ============================================
const getChickSources = async (req, res) => {
  try {
    const sources = await ChickSource.findAll({
      where: { active: true },
      order: [
        ["sort_order", "ASC"],
        ["id", "ASC"],
      ],
      attributes: ["id", "name", "description", "sort_order"],
    });
    successResponse(res, sources, "لیست مبداهای جوجه دریافت شد");
  } catch (error) {
    console.error("خطا:", error);
    errorResponse(res, error.message, 500);
  }
};

// ============================================
// ایجاد مبدا جوجه جدید
// ============================================
const createChickSource = async (req, res) => {
  try {
    const { name, description, sort_order } = req.body;

    if (!name) {
      return errorResponse(res, "نام مبدا جوجه الزامی است", 400);
    }

    const source = await ChickSource.create({
      name,
      description: description || null,
      sort_order: sort_order || 0,
    });

    successResponse(res, source, "مبدا جوجه با موفقیت ایجاد شد", 201);
  } catch (error) {
    console.error("خطا:", error);
    if (error.name === "SequelizeUniqueConstraintError") {
      return errorResponse(res, "این نام قبلاً ثبت شده است", 400);
    }
    errorResponse(res, error.message, 500);
  }
};

// ============================================
// بروزرسانی مبدا جوجه
// ============================================
const updateChickSource = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, sort_order, active } = req.body;

    const source = await ChickSource.findByPk(id);
    if (!source) {
      return errorResponse(res, "مبدا جوجه یافت نشد", 404);
    }

    await source.update({
      name: name || source.name,
      description: description !== undefined ? description : source.description,
      sort_order: sort_order !== undefined ? sort_order : source.sort_order,
      active: active !== undefined ? active : source.active,
    });

    successResponse(res, source, "مبدا جوجه با موفقیت بروزرسانی شد");
  } catch (error) {
    console.error("خطا:", error);
    errorResponse(res, error.message, 500);
  }
};

// ============================================
// حذف مبدا جوجه
// ============================================
const deleteChickSource = async (req, res) => {
  try {
    const { id } = req.params;

    const source = await ChickSource.findByPk(id);
    if (!source) {
      return errorResponse(res, "مبدا جوجه یافت نشد", 404);
    }

    await source.destroy();
    successResponse(res, null, "مبدا جوجه با موفقیت حذف شد");
  } catch (error) {
    console.error("خطا:", error);
    errorResponse(res, error.message, 500);
  }
};

// --------------finish Controller functions of the chicken source table--------

// --------------start  Controller functions of the chicken_breeds table--------
// ============================================
// دریافت همه نژادهای جوجه
// ============================================
const getChickenBreeds = async (req, res) => {
  try {
    const breeds = await ChickenBreed.findAll({
      where: { active: true },
      order: [
        ["sort_order", "ASC"],
        ["name", "ASC"],
      ],
      attributes: ["id", "code", "name", "description", "sort_order"],
    });
    successResponse(res, breeds, "لیست نژادهای جوجه دریافت شد");
  } catch (error) {
    console.error("خطا:", error);
    errorResponse(res, error.message, 500);
  }
};

// ============================================
// ایجاد نژاد جوجه جدید
// ============================================
const createChickenBreed = async (req, res) => {
  try {
    const { code, name, description, sort_order } = req.body;

    if (!code || !name) {
      return errorResponse(res, "کد و نام نژاد الزامی است", 400);
    }

    const breed = await ChickenBreed.create({
      code,
      name,
      description: description || null,
      sort_order: sort_order || 0,
    });

    successResponse(res, breed, "نژاد جوجه با موفقیت ایجاد شد", 201);
  } catch (error) {
    console.error("خطا:", error);
    if (error.name === "SequelizeUniqueConstraintError") {
      return errorResponse(res, "این کد یا نام قبلاً ثبت شده است", 400);
    }
    errorResponse(res, error.message, 500);
  }
};

// ============================================
// بروزرسانی نژاد جوجه
// ============================================
const updateChickenBreed = async (req, res) => {
  try {
    const { id } = req.params;
    const { code, name, description, sort_order, active } = req.body;

    const breed = await ChickenBreed.findByPk(id);
    if (!breed) {
      return errorResponse(res, "نژاد جوجه یافت نشد", 404);
    }

    await breed.update({
      code: code || breed.code,
      name: name || breed.name,
      description: description !== undefined ? description : breed.description,
      sort_order: sort_order !== undefined ? sort_order : breed.sort_order,
      active: active !== undefined ? active : breed.active,
    });

    successResponse(res, breed, "نژاد جوجه با موفقیت بروزرسانی شد");
  } catch (error) {
    console.error("خطا:", error);
    if (error.name === "SequelizeUniqueConstraintError") {
      return errorResponse(res, "این کد یا نام قبلاً ثبت شده است", 400);
    }
    errorResponse(res, error.message, 500);
  }
};

// ============================================
// حذف نژاد جوجه
// ============================================
const deleteChickenBreed = async (req, res) => {
  try {
    const { id } = req.params;

    const breed = await ChickenBreed.findByPk(id);
    if (!breed) {
      return errorResponse(res, "نژاد جوجه یافت نشد", 404);
    }

    await breed.destroy();
    successResponse(res, null, "نژاد جوجه با موفقیت حذف شد");
  } catch (error) {
    console.error("خطا:", error);
    errorResponse(res, error.message, 500);
  }
};
// --------------finish  Controller functions of the chicken_breeds table--------

// --------------start  Controller functions of the CoolingSystemType table--------
// ============================================
// دریافت همه سیستم‌های سرمایشی
// ============================================
const getCoolingSystems = async (req, res) => {
  try {
    // دریافت مقدار active از query string (مثل ?active=false یا ?active=all)
    const { active } = req.query;

    // اعتبارسنجی مقدار ورودی
    let whereCondition = {};

    if (active === "false") {
      whereCondition = { active: false };
    } else if (active === "all") {
      whereCondition = {}; // بدون فیلتر، همه رکوردها
    } else {
      // پیش‌فرض: فقط active = true (و هر مقدار نامعتبر دیگر)
      whereCondition = { active: true };
    }

    const systems = await CoolingSystemType.findAll({
      where: whereCondition,
      order: [
        ["sort_order", "ASC"],
        ["name", "ASC"],
      ],
      attributes: ["id", "name", "description", "sort_order", "active"],
    });
    successResponse(res, systems, "لیست سیستم‌های سرمایشی دریافت شد");
  } catch (error) {
    console.error("خطا:", error);
    errorResponse(res, error.message, 500);
  }
};
// ============================================
// ایجاد سیستم سرمایشی جدید
// ============================================
const createCoolingSystem = async (req, res) => {
  try {
    const { name, description, sort_order, active } = req.body;

    if (!name) {
      return errorResponse(res, "نام سیستم سرمایشی الزامی است", 400);
    }

    const system = await CoolingSystemType.create({
      name,
      description: description || null,
      sort_order: sort_order || 0,
      active: active !== undefined ? active : true,
    });

    successResponse(res, system, "سیستم سرمایشی با موفقیت ایجاد شد", 201);
  } catch (error) {
    console.error("خطا:", error);
    if (error.name === "SequelizeUniqueConstraintError") {
      return errorResponse(res, "این نام قبلاً ثبت شده است", 400);
    }
    errorResponse(res, error.message, 500);
  }
};

// ============================================
// بروزرسانی سیستم سرمایشی
// ============================================
const updateCoolingSystem = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, sort_order, active } = req.body;

    const system = await CoolingSystemType.findByPk(id);
    if (!system) {
      return errorResponse(res, "سیستم سرمایشی یافت نشد", 404);
    }

    await system.update({
      name: name || system.name,
      description: description !== undefined ? description : system.description,
      sort_order: sort_order !== undefined ? sort_order : system.sort_order,
      active: active !== undefined ? active : system.active,
    });

    successResponse(res, system, "سیستم سرمایشی با موفقیت بروزرسانی شد");
  } catch (error) {
    console.error("خطا:", error);
    if (error.name === "SequelizeUniqueConstraintError") {
      return errorResponse(res, "این نام قبلاً ثبت شده است", 400);
    }
    errorResponse(res, error.message, 500);
  }
};

// ============================================
// حذف سیستم سرمایشی
// ============================================
const deleteCoolingSystem = async (req, res) => {
  try {
    const { id } = req.params;

    const system = await CoolingSystemType.findByPk(id);
    if (!system) {
      return errorResponse(res, "سیستم سرمایشی یافت نشد", 404);
    }

    await system.destroy();
    successResponse(res, null, "سیستم سرمایشی با موفقیت حذف شد");
  } catch (error) {
    console.error("خطا:", error);
    errorResponse(res, error.message, 500);
  }
};
// --------------finish  Controller functions of the CoolingSystemType table--------

// --------------start  Controller functions of the Disease table--------
const getDiseases = async (req, res) => {
  try {
    const { active } = req.query;
    let whereCondition = {};
    if (active === "false") whereCondition = { active: false };
    else if (active === "all") whereCondition = {};
    else whereCondition = { active: true };

    const diseases = await Disease.findAll({
      where: whereCondition,
      order: [
        ["sort_order", "ASC"],
        ["name", "ASC"],
      ],
      attributes: [
        "id",
        "name",
        "description",
        "treatment",
        "category",
        "sort_order",
        "active",
      ],
    });
    successResponse(res, diseases, "لیست بیماری‌ها دریافت شد");
  } catch (error) {
    errorResponse(res, error.message, 500);
  }
};

const createDisease = async (req, res) => {
  try {
    const { name, description, treatment, category, sort_order, active } =
      req.body;
    if (!name) return errorResponse(res, "نام بیماری الزامی است", 400);
    const disease = await Disease.create({
      name,
      description: description || null,
      treatment: treatment || null,
      category: category || null,
      sort_order: sort_order || 0,
      active: active !== undefined ? active : true,
    });
    successResponse(res, disease, "بیماری با موفقیت ایجاد شد", 201);
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError")
      return errorResponse(res, "این نام قبلاً ثبت شده است", 400);
    errorResponse(res, error.message, 500);
  }
};

const updateDisease = async (req, res) => {
  try {
    const { id } = req.params;
    const disease = await Disease.findByPk(id);
    if (!disease) return errorResponse(res, "بیماری یافت نشد", 404);
    const { name, description, treatment, category, sort_order, active } =
      req.body;
    await disease.update({
      name: name || disease.name,
      description:
        description !== undefined ? description : disease.description,
      treatment: treatment !== undefined ? treatment : disease.treatment,
      category: category !== undefined ? category : disease.category,
      sort_order: sort_order !== undefined ? sort_order : disease.sort_order,
      active: active !== undefined ? active : disease.active,
    });
    successResponse(res, disease, "بیماری با موفقیت بروزرسانی شد");
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError")
      return errorResponse(res, "این نام قبلاً ثبت شده است", 400);
    errorResponse(res, error.message, 500);
  }
};

const deleteDisease = async (req, res) => {
  try {
    const { id } = req.params;
    const disease = await Disease.findByPk(id);
    if (!disease) return errorResponse(res, "بیماری یافت نشد", 404);
    await disease.destroy();
    successResponse(res, null, "بیماری با موفقیت حذف شد");
  } catch (error) {
    errorResponse(res, error.message, 500);
  }
};
// --------------finish  Controller functions of the FeedType table--------

// --------------start  Controller functions of the FeedType table--------

// #ماژول های نیاز ب احراز

const getFeedTypes = async (req, res) => {
  try {
    const { active } = req.query;
    let where = { active: true };
    if (active === "false") where = { active: false };
    else if (active === "all") where = {};
    const data = await FeedType.findAll({
      where,
      order: [
        ["sort_order", "ASC"],
        ["name", "ASC"],
      ],
      attributes: [
        "id",
        "name",
        "description",
        "feed_stage",
        "protein_percentage",
        "sort_order",
        "active",
      ],
    });
    successResponse(res, data, "لیست انواع خوراک دریافت شد");
  } catch (error) {
    errorResponse(res, error.message);
  }
};

const createFeedType = async (req, res) => {
  try {
    const {
      name,
      description,
      feed_stage,
      protein_percentage,
      sort_order,
      active,
    } = req.body;
    if (!name) return errorResponse(res, "نام خوراک الزامی است", 400);
    const feed = await FeedType.create({
      name,
      description: description || null,
      feed_stage: feed_stage || null,
      protein_percentage: protein_percentage || null,
      sort_order: sort_order || 0,
      active: active !== undefined ? active : true,
    });
    successResponse(res, feed, "نوع خوراک با موفقیت ایجاد شد", 201);
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError")
      return errorResponse(res, "نام تکراری", 400);
    errorResponse(res, error.message);
  }
};

const updateFeedType = async (req, res) => {
  try {
    const feed = await FeedType.findByPk(req.params.id);
    if (!feed) return errorResponse(res, "نوع خوراک یافت نشد", 404);
    const {
      name,
      description,
      feed_stage,
      protein_percentage,
      sort_order,
      active,
    } = req.body;
    await feed.update({
      name: name || feed.name,
      description: description !== undefined ? description : feed.description,
      feed_stage: feed_stage !== undefined ? feed_stage : feed.feed_stage,
      protein_percentage:
        protein_percentage !== undefined
          ? protein_percentage
          : feed.protein_percentage,
      sort_order: sort_order !== undefined ? sort_order : feed.sort_order,
      active: active !== undefined ? active : feed.active,
    });
    successResponse(res, feed, "بروزرسانی شد");
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError")
      return errorResponse(res, "نام تکراری", 400);
    errorResponse(res, error.message);
  }
};

const deleteFeedType = async (req, res) => {
  try {
    const feed = await FeedType.findByPk(req.params.id);
    if (!feed) return errorResponse(res, "نوع خوراک یافت نشد", 404);
    await feed.destroy();
    successResponse(res, null, "نوع خوراک حذف شد");
  } catch (error) {
    errorResponse(res, error.message);
  }
};
// --------------finish  Controller functions of the Disease table--------

// --------------start   Controller functions of the Feeder Type table--------
const getFeederTypes = async (req, res) => {
  try {
    const { active } = req.query;
    let where = { active: true };
    if (active === "false") where = { active: false };
    else if (active === "all") where = {};
    const data = await FeederType.findAll({
      where,
      order: [
        ["sort_order", "ASC"],
        ["name", "ASC"],
      ],
      attributes: ["id", "name", "description", "sort_order", "active"],
    });
    successResponse(res, data, "لیست دستگاه‌های دانخوری دریافت شد");
  } catch (error) {
    errorResponse(res, error.message);
  }
};

const createFeederType = async (req, res) => {
  try {
    const { name, description, sort_order, active } = req.body;
    if (!name) return errorResponse(res, "نام دستگاه دانخوری الزامی است", 400);
    const feeder = await FeederType.create({
      name,
      description: description || null,
      sort_order: sort_order || 0,
      active: active !== undefined ? active : true,
    });
    successResponse(res, feeder, "دستگاه دانخوری با موفقیت ایجاد شد", 201);
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError")
      return errorResponse(res, "نام تکراری", 400);
    errorResponse(res, error.message);
  }
};

const updateFeederType = async (req, res) => {
  try {
    const feeder = await FeederType.findByPk(req.params.id);
    if (!feeder) return errorResponse(res, "دستگاه دانخوری یافت نشد", 404);
    const { name, description, sort_order, active } = req.body;
    await feeder.update({
      name: name || feeder.name,
      description: description !== undefined ? description : feeder.description,
      sort_order: sort_order !== undefined ? sort_order : feeder.sort_order,
      active: active !== undefined ? active : feeder.active,
    });
    successResponse(res, feeder, "دستگاه دانخوری با موفقیت بروزرسانی شد");
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError")
      return errorResponse(res, "نام تکراری", 400);
    errorResponse(res, error.message);
  }
};

const deleteFeederType = async (req, res) => {
  try {
    const feeder = await FeederType.findByPk(req.params.id);
    if (!feeder) return errorResponse(res, "دستگاه دانخوری یافت نشد", 404);
    await feeder.destroy();
    successResponse(res, null, "دستگاه دانخوری با موفقیت حذف شد");
  } catch (error) {
    errorResponse(res, error.message);
  }
};
// --------------finish  Controller functions of the Feeder Type table--------

// --------------start  Controller functions of the Floor Type table--------
const getFloorTypes = async (req, res) => {
  try {
    const { active } = req.query;
    let where = { active: true };
    if (active === "false") where = { active: false };
    else if (active === "all") where = {};
    const data = await FloorType.findAll({
      where,
      order: [
        ["sort_order", "ASC"],
        ["name", "ASC"],
      ],
      attributes: ["id", "name", "description", "sort_order", "active"],
    });
    successResponse(res, data, "لیست انواع کفپوش دریافت شد");
  } catch (error) {
    errorResponse(res, error.message);
  }
};

const createFloorType = async (req, res) => {
  try {
    const { name, description, sort_order, active } = req.body;
    if (!name) return errorResponse(res, "نام کفپوش الزامی است", 400);
    const floor = await FloorType.create({
      name,
      description: description || null,
      sort_order: sort_order || 0,
      active: active !== undefined ? active : true,
    });
    successResponse(res, floor, "نوع کفپوش با موفقیت ایجاد شد", 201);
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError")
      return errorResponse(res, "نام تکراری", 400);
    errorResponse(res, error.message);
  }
};

const updateFloorType = async (req, res) => {
  try {
    const floor = await FloorType.findByPk(req.params.id);
    if (!floor) return errorResponse(res, "نوع کفپوش یافت نشد", 404);
    const { name, description, sort_order, active } = req.body;
    await floor.update({
      name: name || floor.name,
      description: description !== undefined ? description : floor.description,
      sort_order: sort_order !== undefined ? sort_order : floor.sort_order,
      active: active !== undefined ? active : floor.active,
    });
    successResponse(res, floor, "نوع کفپوش با موفقیت بروزرسانی شد");
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError")
      return errorResponse(res, "نام تکراری", 400);
    errorResponse(res, error.message);
  }
};

const deleteFloorType = async (req, res) => {
  try {
    const floor = await FloorType.findByPk(req.params.id);
    if (!floor) return errorResponse(res, "نوع کفپوش یافت نشد", 404);
    await floor.destroy();
    successResponse(res, null, "نوع کفپوش با موفقیت حذف شد");
  } catch (error) {
    errorResponse(res, error.message);
  }
};
// --------------finish  Controller functions of the Floor Type table--------

// --------------start  Controller functions of the HeatingSystemType table--------
const getHeatingSystems = async (req, res) => {
  try {
    const { active } = req.query;
    let where = { active: true };
    if (active === "false") where = { active: false };
    else if (active === "all") where = {};
    const data = await HeatingSystemType.findAll({
      where,
      order: [
        ["sort_order", "ASC"],
        ["name", "ASC"],
      ],
      attributes: ["id", "name", "description", "sort_order", "active"],
    });
    successResponse(res, data, "لیست سیستم‌های گرمایشی دریافت شد");
  } catch (error) {
    errorResponse(res, error.message);
  }
};

const createHeatingSystem = async (req, res) => {
  try {
    const { name, description, sort_order, active } = req.body;
    if (!name) return errorResponse(res, "نام سیستم گرمایشی الزامی است", 400);
    const heating = await HeatingSystemType.create({
      name,
      description: description || null,
      sort_order: sort_order || 0,
      active: active !== undefined ? active : true,
    });
    successResponse(res, heating, "سیستم گرمایشی با موفقیت ایجاد شد", 201);
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError")
      return errorResponse(res, "نام تکراری", 400);
    errorResponse(res, error.message);
  }
};

const updateHeatingSystem = async (req, res) => {
  try {
    const heating = await HeatingSystemType.findByPk(req.params.id);
    if (!heating) return errorResponse(res, "سیستم گرمایشی یافت نشد", 404);
    const { name, description, sort_order, active } = req.body;
    await heating.update({
      name: name || heating.name,
      description:
        description !== undefined ? description : heating.description,
      sort_order: sort_order !== undefined ? sort_order : heating.sort_order,
      active: active !== undefined ? active : heating.active,
    });
    successResponse(res, heating, "سیستم گرمایشی با موفقیت بروزرسانی شد");
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError")
      return errorResponse(res, "نام تکراری", 400);
    errorResponse(res, error.message);
  }
};

const deleteHeatingSystem = async (req, res) => {
  try {
    const heating = await HeatingSystemType.findByPk(req.params.id);
    if (!heating) return errorResponse(res, "سیستم گرمایشی یافت نشد", 404);
    await heating.destroy();
    successResponse(res, null, "سیستم گرمایشی با موفقیت حذف شد");
  } catch (error) {
    errorResponse(res, error.message);
  }
};
// --------------finish  Controller functions of the HeatingSystemType table--------

// --------------start  Controller functions of the Lighting System Type table--------
const getLightingSystems = async (req, res) => {
  try {
    const { active } = req.query;
    let where = { active: true };
    if (active === "false") where = { active: false };
    else if (active === "all") where = {};
    const data = await LightingSystemType.findAll({
      where,
      order: [
        ["sort_order", "ASC"],
        ["name", "ASC"],
      ],
      attributes: ["id", "name", "description", "sort_order", "active"],
    });
    successResponse(res, data, "لیست سیستم‌های روشنایی دریافت شد");
  } catch (error) {
    errorResponse(res, error.message);
  }
};

const createLightingSystem = async (req, res) => {
  try {
    const { name, description, sort_order, active } = req.body;
    if (!name) return errorResponse(res, "نام سیستم روشنایی الزامی است", 400);
    const lighting = await LightingSystemType.create({
      name,
      description: description || null,
      sort_order: sort_order || 0,
      active: active !== undefined ? active : true,
    });
    successResponse(res, lighting, "سیستم روشنایی با موفقیت ایجاد شد", 201);
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError")
      return errorResponse(res, "نام تکراری", 400);
    errorResponse(res, error.message);
  }
};

const updateLightingSystem = async (req, res) => {
  try {
    const lighting = await LightingSystemType.findByPk(req.params.id);
    if (!lighting) return errorResponse(res, "سیستم روشنایی یافت نشد", 404);
    const { name, description, sort_order, active } = req.body;
    await lighting.update({
      name: name || lighting.name,
      description:
        description !== undefined ? description : lighting.description,
      sort_order: sort_order !== undefined ? sort_order : lighting.sort_order,
      active: active !== undefined ? active : lighting.active,
    });
    successResponse(res, lighting, "سیستم روشنایی با موفقیت بروزرسانی شد");
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError")
      return errorResponse(res, "نام تکراری", 400);
    errorResponse(res, error.message);
  }
};

const deleteLightingSystem = async (req, res) => {
  try {
    const lighting = await LightingSystemType.findByPk(req.params.id);
    if (!lighting) return errorResponse(res, "سیستم روشنایی یافت نشد", 404);
    await lighting.destroy();
    successResponse(res, null, "سیستم روشنایی با موفقیت حذف شد");
  } catch (error) {
    errorResponse(res, error.message);
  }
};
// --------------finish  Controller functions of the Lighting System Type table--------

// --------------start  Controller functions of the Medicine table--------
const getMedicines = async (req, res) => {
  try {
    const { active, category } = req.query;
    let where = { active: true };
    if (active === "false") where = { active: false };
    else if (active === "all") where = {};
    if (category) where.category = category;

    const data = await Medicine.findAll({
      where,
      order: [
        ["sort_order", "ASC"],
        ["name", "ASC"],
      ],
    });
    successResponse(res, data, "لیست داروها دریافت شد");
  } catch (error) {
    errorResponse(res, error.message);
  }
};

const createMedicine = async (req, res) => {
  try {
    const {
      name,
      generic_name,
      category,
      manufacturer,
      dosage_form,
      unit,
      concentration,
      description,
      indication,
      contraindication,
      side_effects,
      withdrawal_time,
      storage_condition,
      sort_order,
      active,
    } = req.body;

    if (!name) return errorResponse(res, "نام دارو الزامی است", 400);

    const medicine = await Medicine.create({
      name,
      generic_name,
      category,
      manufacturer,
      dosage_form,
      unit,
      concentration,
      description,
      indication,
      contraindication,
      side_effects,
      withdrawal_time,
      storage_condition,
      sort_order: sort_order || 0,
      active: active !== undefined ? active : true,
    });
    successResponse(res, medicine, "دارو با موفقیت ایجاد شد", 201);
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError")
      return errorResponse(res, "نام تکراری", 400);
    errorResponse(res, error.message);
  }
};

const updateMedicine = async (req, res) => {
  try {
    const medicine = await Medicine.findByPk(req.params.id);
    if (!medicine) return errorResponse(res, "دارو یافت نشد", 404);

    const {
      name,
      generic_name,
      category,
      manufacturer,
      dosage_form,
      unit,
      concentration,
      description,
      indication,
      contraindication,
      side_effects,
      withdrawal_time,
      storage_condition,
      sort_order,
      active,
    } = req.body;

    await medicine.update({
      name: name || medicine.name,
      generic_name:
        generic_name !== undefined ? generic_name : medicine.generic_name,
      category: category !== undefined ? category : medicine.category,
      manufacturer:
        manufacturer !== undefined ? manufacturer : medicine.manufacturer,
      dosage_form:
        dosage_form !== undefined ? dosage_form : medicine.dosage_form,
      unit: unit !== undefined ? unit : medicine.unit,
      concentration:
        concentration !== undefined ? concentration : medicine.concentration,
      description:
        description !== undefined ? description : medicine.description,
      indication: indication !== undefined ? indication : medicine.indication,
      contraindication:
        contraindication !== undefined
          ? contraindication
          : medicine.contraindication,
      side_effects:
        side_effects !== undefined ? side_effects : medicine.side_effects,
      withdrawal_time:
        withdrawal_time !== undefined
          ? withdrawal_time
          : medicine.withdrawal_time,
      storage_condition:
        storage_condition !== undefined
          ? storage_condition
          : medicine.storage_condition,
      sort_order: sort_order !== undefined ? sort_order : medicine.sort_order,
      active: active !== undefined ? active : medicine.active,
    });
    successResponse(res, medicine, "دارو با موفقیت بروزرسانی شد");
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError")
      return errorResponse(res, "نام تکراری", 400);
    errorResponse(res, error.message);
  }
};

const deleteMedicine = async (req, res) => {
  try {
    const medicine = await Medicine.findByPk(req.params.id);
    if (!medicine) return errorResponse(res, "دارو یافت نشد", 404);
    await medicine.destroy();
    successResponse(res, null, "دارو با موفقیت حذف شد");
  } catch (error) {
    errorResponse(res, error.message);
  }
};

// --------------finish  Controller functions of the Medicine table--------

// --------------start  Controller functions of the Suggestion Type table--------
const getSuggestionTypes = async (req, res) => {
  try {
    const { active } = req.query;
    let where = { active: true };
    if (active === "false") where = { active: false };
    else if (active === "all") where = {};
    const data = await SuggestionType.findAll({
      where,
      order: [
        ["sort_order", "ASC"],
        ["name", "ASC"],
      ],
      attributes: [
        "id",
        "name",
        "description",
        "icon",
        "color",
        "sort_order",
        "active",
      ],
    });
    successResponse(res, data, "لیست انواع پیشنهاد دریافت شد");
  } catch (error) {
    errorResponse(res, error.message);
  }
};

const createSuggestionType = async (req, res) => {
  try {
    const { name, description, icon, color, sort_order, active } = req.body;
    if (!name) return errorResponse(res, "نام نوع پیشنهاد الزامی است", 400);
    const suggestion = await SuggestionType.create({
      name,
      description: description || null,
      icon: icon || null,
      color: color || null,
      sort_order: sort_order || 0,
      active: active !== undefined ? active : true,
    });
    successResponse(res, suggestion, "نوع پیشنهاد با موفقیت ایجاد شد", 201);
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError")
      return errorResponse(res, "نام تکراری", 400);
    errorResponse(res, error.message);
  }
};

const updateSuggestionType = async (req, res) => {
  try {
    const suggestion = await SuggestionType.findByPk(req.params.id);
    if (!suggestion) return errorResponse(res, "نوع پیشنهاد یافت نشد", 404);
    const { name, description, icon, color, sort_order, active } = req.body;
    await suggestion.update({
      name: name || suggestion.name,
      description:
        description !== undefined ? description : suggestion.description,
      icon: icon !== undefined ? icon : suggestion.icon,
      color: color !== undefined ? color : suggestion.color,
      sort_order: sort_order !== undefined ? sort_order : suggestion.sort_order,
      active: active !== undefined ? active : suggestion.active,
    });
    successResponse(res, suggestion, "نوع پیشنهاد با موفقیت بروزرسانی شد");
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError")
      return errorResponse(res, "نام تکراری", 400);
    errorResponse(res, error.message);
  }
};

const deleteSuggestionType = async (req, res) => {
  try {
    const suggestion = await SuggestionType.findByPk(req.params.id);
    if (!suggestion) return errorResponse(res, "نوع پیشنهاد یافت نشد", 404);
    await suggestion.destroy();
    successResponse(res, null, "نوع پیشنهاد با موفقیت حذف شد");
  } catch (error) {
    errorResponse(res, error.message);
  }
};
// --------------finish  Controller functions of the Suggestion Type table--------

// --------------start  Controller functions of the vaccines table--------

const getVaccines = async (req, res) => {
  try {
    const { active, vaccine_type, target_disease } = req.query;
    let where = { active: true };
    if (active === "false") where = { active: false };
    else if (active === "all") where = {};
    if (vaccine_type) where.vaccine_type = vaccine_type;
    if (target_disease) where.target_disease = target_disease;

    const data = await Vaccine.findAll({
      where,
      order: [
        ["sort_order", "ASC"],
        ["name", "ASC"],
      ],
    });
    successResponse(res, data, "لیست واکسن‌ها دریافت شد");
  } catch (error) {
    errorResponse(res, error.message);
  }
};

const createVaccine = async (req, res) => {
  try {
    const {
      name,
      trade_name,
      manufacturer,
      vaccine_type,
      administration_method,
      target_disease,
      age_days,
      booster_needed,
      booster_days,
      immunity_duration,
      storage_temp,
      dilution_ratio,
      description,
      precautions,
      sort_order,
      active,
    } = req.body;

    if (!name) return errorResponse(res, "نام واکسن الزامی است", 400);

    const vaccine = await Vaccine.create({
      name,
      trade_name,
      manufacturer,
      vaccine_type,
      administration_method,
      target_disease,
      age_days,
      booster_needed: booster_needed || false,
      booster_days,
      immunity_duration,
      storage_temp,
      dilution_ratio,
      description,
      precautions,
      sort_order: sort_order || 0,
      active: active !== undefined ? active : true,
    });
    successResponse(res, vaccine, "واکسن با موفقیت ایجاد شد", 201);
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError")
      return errorResponse(res, "نام تکراری", 400);
    errorResponse(res, error.message);
  }
};

const updateVaccine = async (req, res) => {
  try {
    const vaccine = await Vaccine.findByPk(req.params.id);
    if (!vaccine) return errorResponse(res, "واکسن یافت نشد", 404);

    const {
      name,
      trade_name,
      manufacturer,
      vaccine_type,
      administration_method,
      target_disease,
      age_days,
      booster_needed,
      booster_days,
      immunity_duration,
      storage_temp,
      dilution_ratio,
      description,
      precautions,
      sort_order,
      active,
    } = req.body;

    await vaccine.update({
      name: name || vaccine.name,
      trade_name: trade_name !== undefined ? trade_name : vaccine.trade_name,
      manufacturer:
        manufacturer !== undefined ? manufacturer : vaccine.manufacturer,
      vaccine_type:
        vaccine_type !== undefined ? vaccine_type : vaccine.vaccine_type,
      administration_method:
        administration_method !== undefined
          ? administration_method
          : vaccine.administration_method,
      target_disease:
        target_disease !== undefined ? target_disease : vaccine.target_disease,
      age_days: age_days !== undefined ? age_days : vaccine.age_days,
      booster_needed:
        booster_needed !== undefined ? booster_needed : vaccine.booster_needed,
      booster_days:
        booster_days !== undefined ? booster_days : vaccine.booster_days,
      immunity_duration:
        immunity_duration !== undefined
          ? immunity_duration
          : vaccine.immunity_duration,
      storage_temp:
        storage_temp !== undefined ? storage_temp : vaccine.storage_temp,
      dilution_ratio:
        dilution_ratio !== undefined ? dilution_ratio : vaccine.dilution_ratio,
      description:
        description !== undefined ? description : vaccine.description,
      precautions:
        precautions !== undefined ? precautions : vaccine.precautions,
      sort_order: sort_order !== undefined ? sort_order : vaccine.sort_order,
      active: active !== undefined ? active : vaccine.active,
    });
    successResponse(res, vaccine, "واکسن با موفقیت بروزرسانی شد");
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError")
      return errorResponse(res, "نام تکراری", 400);
    errorResponse(res, error.message);
  }
};

const deleteVaccine = async (req, res) => {
  try {
    const vaccine = await Vaccine.findByPk(req.params.id);
    if (!vaccine) return errorResponse(res, "واکسن یافت نشد", 404);
    await vaccine.destroy();
    successResponse(res, null, "واکسن با موفقیت حذف شد");
  } catch (error) {
    errorResponse(res, error.message);
  }
};
// --------------finish  Controller functions of the vaccines table--------

// --------------start  Controller functions of the Ventilation Type table--------
const getVentilationTypes = async (req, res) => {
  try {
    const { active, ventilation_method } = req.query;
    let where = { active: true };
    if (active === "false") where = { active: false };
    else if (active === "all") where = {};
    if (ventilation_method) where.ventilation_method = ventilation_method;

    const data = await VentilationType.findAll({
      where,
      order: [
        ["sort_order", "ASC"],
        ["name", "ASC"],
      ],
      attributes: [
        "id",
        "name",
        "description",
        "ventilation_method",
        "fan_type",
        "air_flow_direction",
        "automatic_control",
        "sort_order",
        "active",
      ],
    });
    successResponse(res, data, "لیست سیستم‌های تهویه دریافت شد");
  } catch (error) {
    errorResponse(res, error.message);
  }
};

const createVentilationType = async (req, res) => {
  try {
    const {
      name,
      description,
      ventilation_method,
      fan_type,
      air_flow_direction,
      automatic_control,
      sort_order,
      active,
    } = req.body;
    if (!name) return errorResponse(res, "نام سیستم تهویه الزامی است", 400);

    const ventilation = await VentilationType.create({
      name,
      description: description || null,
      ventilation_method: ventilation_method || null,
      fan_type: fan_type || null,
      air_flow_direction: air_flow_direction || null,
      automatic_control: automatic_control || false,
      sort_order: sort_order || 0,
      active: active !== undefined ? active : true,
    });
    successResponse(res, ventilation, "سیستم تهویه با موفقیت ایجاد شد", 201);
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError")
      return errorResponse(res, "نام تکراری", 400);
    errorResponse(res, error.message);
  }
};

const updateVentilationType = async (req, res) => {
  try {
    const ventilation = await VentilationType.findByPk(req.params.id);
    if (!ventilation) return errorResponse(res, "سیستم تهویه یافت نشد", 404);

    const {
      name,
      description,
      ventilation_method,
      fan_type,
      air_flow_direction,
      automatic_control,
      sort_order,
      active,
    } = req.body;

    await ventilation.update({
      name: name || ventilation.name,
      description:
        description !== undefined ? description : ventilation.description,
      ventilation_method:
        ventilation_method !== undefined
          ? ventilation_method
          : ventilation.ventilation_method,
      fan_type: fan_type !== undefined ? fan_type : ventilation.fan_type,
      air_flow_direction:
        air_flow_direction !== undefined
          ? air_flow_direction
          : ventilation.air_flow_direction,
      automatic_control:
        automatic_control !== undefined
          ? automatic_control
          : ventilation.automatic_control,
      sort_order:
        sort_order !== undefined ? sort_order : ventilation.sort_order,
      active: active !== undefined ? active : ventilation.active,
    });
    successResponse(res, ventilation, "سیستم تهویه با موفقیت بروزرسانی شد");
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError")
      return errorResponse(res, "نام تکراری", 400);
    errorResponse(res, error.message);
  }
};

const deleteVentilationType = async (req, res) => {
  try {
    const ventilation = await VentilationType.findByPk(req.params.id);
    if (!ventilation) return errorResponse(res, "سیستم تهویه یافت نشد", 404);
    await ventilation.destroy();
    successResponse(res, null, "سیستم تهویه با موفقیت حذف شد");
  } catch (error) {
    errorResponse(res, error.message);
  }
};

// --------------finish  Controller functions of the Ventilation Type table--------

// --------------start Controller functions of the WaterInlet Type table--------
const getWaterInletTypes = async (req, res) => {
  try {
    const { active } = req.query;
    let where = { active: true };
    if (active === "false") where = { active: false };
    else if (active === "all") where = {};

    const data = await WaterInletType.findAll({
      where,
      order: [
        ["sort_order", "ASC"],
        ["name", "ASC"],
      ],
      attributes: ["id", "name", "description", "sort_order", "active"],
    });
    successResponse(res, data, "لیست سیستم‌های ورودی بهداشتی دریافت شد");
  } catch (error) {
    errorResponse(res, error.message);
  }
};

const createWaterInletType = async (req, res) => {
  try {
    const { name, description, sort_order, active } = req.body;
    if (!name)
      return errorResponse(res, "نام سیستم ورودی بهداشتی الزامی است", 400);

    const waterInlet = await WaterInletType.create({
      name,
      description: description || null,
      sort_order: sort_order || 0,
      active: active !== undefined ? active : true,
    });
    successResponse(
      res,
      waterInlet,
      "سیستم ورودی بهداشتی با موفقیت ایجاد شد",
      201,
    );
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError")
      return errorResponse(res, "نام تکراری", 400);
    errorResponse(res, error.message);
  }
};

const updateWaterInletType = async (req, res) => {
  try {
    const waterInlet = await WaterInletType.findByPk(req.params.id);
    if (!waterInlet)
      return errorResponse(res, "سیستم ورودی بهداشتی یافت نشد", 404);

    const { name, description, sort_order, active } = req.body;

    await waterInlet.update({
      name: name || waterInlet.name,
      description:
        description !== undefined ? description : waterInlet.description,
      sort_order: sort_order !== undefined ? sort_order : waterInlet.sort_order,
      active: active !== undefined ? active : waterInlet.active,
    });
    successResponse(
      res,
      waterInlet,
      "سیستم ورودی بهداشتی با موفقیت بروزرسانی شد",
    );
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError")
      return errorResponse(res, "نام تکراری", 400);
    errorResponse(res, error.message);
  }
};

const deleteWaterInletType = async (req, res) => {
  try {
    const waterInlet = await WaterInletType.findByPk(req.params.id);
    if (!waterInlet)
      return errorResponse(res, "سیستم ورودی بهداشتی یافت نشد", 404);
    await waterInlet.destroy();
    successResponse(res, null, "سیستم ورودی بهداشتی با موفقیت حذف شد");
  } catch (error) {
    errorResponse(res, error.message);
  }
};
// --------------finish Controller functions of the WaterInlet Type table--------
const getWatererTypes = async (req, res) => {
  try {
    const { active, waterer_category } = req.query;
    let where = { active: true };
    if (active === "false") where = { active: false };
    else if (active === "all") where = {};
    if (waterer_category) where.waterer_category = waterer_category;

    const data = await WatererType.findAll({
      where,
      order: [
        ["sort_order", "ASC"],
        ["name", "ASC"],
      ],
      attributes: [
        "id",
        "name",
        "description",
        "waterer_category",
        "material",
        "capacity",
        "bird_count",
        "automatic",
        "sort_order",
        "active",
      ],
    });
    successResponse(res, data, "لیست انواع آبخوری دریافت شد");
  } catch (error) {
    errorResponse(res, error.message);
  }
};

const createWatererType = async (req, res) => {
  try {
    const {
      name,
      description,
      waterer_category,
      material,
      capacity,
      bird_count,
      automatic,
      sort_order,
      active,
    } = req.body;
    if (!name) return errorResponse(res, "نام آبخوری الزامی است", 400);

    const waterer = await WatererType.create({
      name,
      description: description || null,
      waterer_category: waterer_category || null,
      material: material || null,
      capacity: capacity || null,
      bird_count: bird_count || null,
      automatic: automatic || false,
      sort_order: sort_order || 0,
      active: active !== undefined ? active : true,
    });
    successResponse(res, waterer, "نوع آبخوری با موفقیت ایجاد شد", 201);
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError")
      return errorResponse(res, "نام تکراری", 400);
    errorResponse(res, error.message);
  }
};

const updateWatererType = async (req, res) => {
  try {
    const waterer = await WatererType.findByPk(req.params.id);
    if (!waterer) return errorResponse(res, "نوع آبخوری یافت نشد", 404);

    const {
      name,
      description,
      waterer_category,
      material,
      capacity,
      bird_count,
      automatic,
      sort_order,
      active,
    } = req.body;

    await waterer.update({
      name: name || waterer.name,
      description:
        description !== undefined ? description : waterer.description,
      waterer_category:
        waterer_category !== undefined
          ? waterer_category
          : waterer.waterer_category,
      material: material !== undefined ? material : waterer.material,
      capacity: capacity !== undefined ? capacity : waterer.capacity,
      bird_count: bird_count !== undefined ? bird_count : waterer.bird_count,
      automatic: automatic !== undefined ? automatic : waterer.automatic,
      sort_order: sort_order !== undefined ? sort_order : waterer.sort_order,
      active: active !== undefined ? active : waterer.active,
    });
    successResponse(res, waterer, "نوع آبخوری با موفقیت بروزرسانی شد");
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError")
      return errorResponse(res, "نام تکراری", 400);
    errorResponse(res, error.message);
  }
};

const deleteWatererType = async (req, res) => {
  try {
    const waterer = await WatererType.findByPk(req.params.id);
    if (!waterer) return errorResponse(res, "نوع آبخوری یافت نشد", 404);
    await waterer.destroy();
    successResponse(res, null, "نوع آبخوری با موفقیت حذف شد");
  } catch (error) {
    errorResponse(res, error.message);
  }
};
// --------------finish  Controller functions of the WatererType Type table--------

// --------------------start routes Experts (کارشناسان) dictionary tables-------------
// ============================================
// دریافت لیست کارشناسان (از جدول users)
// ============================================
const getExperts = async (req, res) => {
  try {
    const experts = await User.findAll({
      where: {
        role: "expert",
        status: "active", // فقط کارشناسان فعال
      },
      attributes: [
        "id",
        "first_name",
        "last_name",
        "username",
        "mobile_number",
      ],
      order: [["first_name", "ASC"]],
    });

    // فرمت کردن خروجی
    const formattedExperts = experts.map((expert) => ({
      id: expert.id,
      name: `${expert.first_name} ${expert.last_name}`,
      username: expert.username,
      mobile: expert.mobile_number,
    }));

    successResponse(res, formattedExperts, "لیست کارشناسان دریافت شد");
  } catch (error) {
    console.error("خطا:", error);
    errorResponse(res, error.message, 500);
  }
};

// --------------------START routes Unit Status DropDown dictionary tables-------------
const UnitStatus = require("../models/UnitStatus");

// دریافت همه وضعیت‌های واحد
const getUnitStatuses = async (req, res) => {
  try {
    const { active } = req.query;
    let where = { active: true };
    if (active === "false") where = { active: false };
    else if (active === "all") where = {};

    const data = await UnitStatus.findAll({
      where,
      order: [
        ["sort_order", "ASC"],
        ["name", "ASC"],
      ],
      attributes: [
        "id",
        "name",
        "description",
        "color",
        "sort_order",
        "active",
      ],
    });
    successResponse(res, data, "لیست وضعیت‌های واحد دریافت شد");
  } catch (error) {
    errorResponse(res, error.message);
  }
};

// ایجاد وضعیت واحد جدید
const createUnitStatus = async (req, res) => {
  try {
    const { name, description, color, sort_order, active } = req.body;
    if (!name) return errorResponse(res, "نام وضعیت الزامی است", 400);
    const status = await UnitStatus.create({
      name,
      description: description || null,
      color: color || "#6c757d",
      sort_order: sort_order || 0,
      active: active !== undefined ? active : true,
    });
    successResponse(res, status, "وضعیت واحد با موفقیت ایجاد شد", 201);
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError")
      return errorResponse(res, "این نام قبلاً ثبت شده است", 400);
    errorResponse(res, error.message);
  }
};

// بروزرسانی وضعیت واحد
const updateUnitStatus = async (req, res) => {
  try {
    const status = await UnitStatus.findByPk(req.params.id);
    if (!status) return errorResponse(res, "وضعیت واحد یافت نشد", 404);
    const { name, description, color, sort_order, active } = req.body;
    await status.update({
      name: name || status.name,
      description: description !== undefined ? description : status.description,
      color: color || status.color,
      sort_order: sort_order !== undefined ? sort_order : status.sort_order,
      active: active !== undefined ? active : status.active,
    });
    successResponse(res, status, "وضعیت واحد با موفقیت بروزرسانی شد");
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError")
      return errorResponse(res, "این نام قبلاً ثبت شده است", 400);
    errorResponse(res, error.message);
  }
};

// حذف وضعیت واحد
const deleteUnitStatus = async (req, res) => {
  try {
    const status = await UnitStatus.findByPk(req.params.id);
    if (!status) return errorResponse(res, "وضعیت واحد یافت نشد", 404);
    await status.destroy();
    successResponse(res, null, "وضعیت واحد با موفقیت حذف شد");
  } catch (error) {
    errorResponse(res, error.message);
  }
};
// --------------------FINISH routes Unit Status DropDown dictionary tables-------------

module.exports = {
  getHallTypes,
  createHallType,
  updateHallType,
  deleteHallType,
  getChickSources,
  createChickSource,
  updateChickSource,
  deleteChickSource,
  getChickenBreeds,
  createChickenBreed,
  updateChickenBreed,
  deleteChickenBreed,
  getCoolingSystems,
  createCoolingSystem,
  updateCoolingSystem,
  deleteCoolingSystem,
  getDiseases,
  createDisease,
  updateDisease,
  deleteDisease,
  getFeedTypes,
  createFeedType,
  updateFeedType,
  deleteFeedType,
  getFeederTypes,
  createFeederType,
  updateFeederType,
  deleteFeederType,
  getFloorTypes,
  createFloorType,
  updateFloorType,
  deleteFloorType,
  getHeatingSystems,
  createHeatingSystem,
  updateHeatingSystem,
  deleteHeatingSystem,
  getLightingSystems,
  createLightingSystem,
  updateLightingSystem,
  deleteLightingSystem,
  getMedicines,
  createMedicine,
  updateMedicine,
  deleteMedicine,
  getSuggestionTypes,
  createSuggestionType,
  updateSuggestionType,
  deleteSuggestionType,
  getVaccines,
  createVaccine,
  updateVaccine,
  deleteVaccine,
  getVentilationTypes,
  createVentilationType,
  updateVentilationType,
  deleteVentilationType,
  getWaterInletTypes,
  createWaterInletType,
  updateWaterInletType,
  deleteWaterInletType,
  getWatererTypes,
  createWatererType,
  updateWatererType,
  deleteWatererType,
  getExperts,
  getUnitStatuses,
  createUnitStatus,
  updateUnitStatus,
  deleteUnitStatus,
};
