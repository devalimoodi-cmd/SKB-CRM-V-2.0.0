// ============================================================
// services/farm/weeklyWrite.js
// نوشتن «اطلاعات هفتگی» — یک منبع برای کارشناس و پورتال (۱۳.۱۲)
// ------------------------------------------------------------
//  منطق پیش از ۱۳.۱۲ داخل controllers/weeklyController.js بود.
//  ثبت یک هفته در شش جدول می‌نشیند (رکورد اصلی + بیماری/واکسن/دارو/
//  خوراک/پیشنهاد)؛ پورتال هم باید همین کار را پس از تأیید انجام دهد،
//  پس منطق به این‌جا منتقل شد و هر دو مسیر از یک تابع می‌گذرند.
//
// 🔒 قواعد تغییرناپذیر:
//   ۱) گلهٔ غیرفعال ⇒ ثبت/ویرایش/حذف هفته ممنوع (همان پیام قبلی).
//   ۲) هفتهٔ تکراری در یک گله ممنوع؛ ترتیب هفته‌ها باید پیوسته باشد
//      (هفته n فقط بعد از n-1).
//   ۳) همهٔ نوشتن‌ها در یک تراکنش‌اند؛ خطا ⇒ هیچ ردیف نیمه‌کاره.
//   ۴) خروجی همان شکل قبلی است: رکورد + آرایه‌های شناسه
//      (disease_ids، vaccine_ids، …) و کلیدهای خام include حذف می‌شوند.
// ============================================================
"use strict";

const WeeklyManagement = require("../../models/WeeklyManagement");
const WeeklyDisease = require("../../models/WeeklyDisease");
const WeeklyVaccine = require("../../models/WeeklyVaccine");
const WeeklyMedicine = require("../../models/WeeklyMedicine");
const WeeklyFeed = require("../../models/WeeklyFeed");
const WeeklySuggestion = require("../../models/WeeklySuggestion");
const ChickPlacement = require("../../models/ChickPlacement");
const Hall = require("../../models/Hall");
const CustomerPersonalInfo = require("../../models/CustomerPersonalInfo");
const Unit = require("../../models/Unit");
const { Op } = require("sequelize");
const { validateWeeklyData } = require("../../validations/weeklyValidation");
const { fail, failValidation } = require("./writeErrors");
const { runInTransaction } = require("./transaction");

// پنج گروه آیتم‌های وابسته — به‌جای پنج بلوک تکراری در کنترلر
const WEEKLY_ITEM_GROUPS = [
  { key: "disease_ids", model: WeeklyDisease, foreignKey: "disease_id", alias: "WeeklyDiseases" },
  { key: "vaccine_ids", model: WeeklyVaccine, foreignKey: "vaccine_id", alias: "WeeklyVaccines" },
  { key: "medicine_ids", model: WeeklyMedicine, foreignKey: "medicine_id", alias: "WeeklyMedicines" },
  { key: "feed_type_ids", model: WeeklyFeed, foreignKey: "feed_type_id", alias: "WeeklyFeeds" },
  { key: "suggestion_ids", model: WeeklySuggestion, foreignKey: "suggestion_id", alias: "WeeklySuggestions" },
];

// فیلدهای قابل ویرایش هفته (همان فهرست قبلی کنترلر)
const WEEKLY_UPDATE_FIELDS = [
  "week_start_date",
  "week_end_date",
  "flock_age_days",
  "service_expert_id",
  "daily_feed_intake",
  "weekly_feed_intake",
  "weekly_weight",
  "weekly_mortality",
  "blackout_hours",
  "additional_notes",
  "status",
  "is_active",
];

// گله باید وجود داشته باشد و فعال باشد
const checkFlockIsActive = async (chickPlacementId, transaction = null) => {
  const flock = await ChickPlacement.findByPk(chickPlacementId, { transaction });
  if (!flock) fail("گله یافت نشد", 400);
  if (!flock.is_active) {
    fail("این گله غیرفعال شده است و نمی‌توان اطلاعات هفتگی ثبت کرد", 400);
  }
  return flock;
};

// هفتهٔ تکراری در همان گله؟
const checkDuplicateWeek = async (
  chickPlacementId,
  weekNumber,
  excludeId = null,
  transaction = null,
) => {
  const where = { chick_placement_id: chickPlacementId, week_number: weekNumber };
  if (excludeId) where.id = { [Op.ne]: excludeId };
  return WeeklyManagement.findOne({ where, transaction });
};

// ترتیب هفته‌ها: هفته n فقط بعد از n-1
const checkWeekOrder = async (chickPlacementId, weekNumber, transaction = null) => {
  if (weekNumber === 1) return true;

  const previousWeek = await WeeklyManagement.findOne({
    where: {
      chick_placement_id: chickPlacementId,
      week_number: weekNumber - 1,
    },
    transaction,
  });

  if (!previousWeek) {
    fail(
      `قبل از ثبت هفته ${weekNumber}، باید هفته ${weekNumber - 1} ثبت شود`,
      400,
    );
  }
  return true;
};

// ذخیرهٔ آیتم‌های چندگانه (شناسه‌های نامعتبر نادیده گرفته می‌شوند)
const saveMultipleItems = async (
  Model,
  foreignKey,
  items,
  baseData,
  transaction = null,
) => {
  if (!items || !Array.isArray(items) || items.length === 0) return [];

  const records = [];
  for (const itemId of items) {
    if (itemId && !isNaN(parseInt(itemId))) {
      records.push({
        weekly_management_id: baseData.weekly_management_id,
        [foreignKey]: parseInt(itemId),
        customer_id: baseData.customer_id || null,
        unit_id: baseData.unit_id || null,
        hall_id: baseData.hall_id || null,
        chick_placement_id: baseData.chick_placement_id || null,
      });
    }
  }

  if (records.length === 0) return [];
  return Model.bulkCreate(records, { transaction });
};

// ============================================
// خواندن رکورد کامل هفته (با آیتم‌های وابسته) + شکل خروجی
// ------------------------------------------------------------
//  خروجی: رکورد + disease_ids/vaccine_ids/… و حذف کلیدهای خام
// ============================================
const loadWeeklyRecord = async (id, transaction = null) => {
  const row = await WeeklyManagement.findByPk(id, {
    include: WEEKLY_ITEM_GROUPS.map((group) => ({
      model: group.model,
      as: group.alias,
      attributes: [group.foreignKey],
    })),
    transaction,
  });
  return row;
};

const formatWeeklyRecord = (row) => {
  if (!row) return null;
  const json = row.toJSON ? row.toJSON() : { ...row };
  const formatted = { ...json };

  for (const group of WEEKLY_ITEM_GROUPS) {
    const list = json[group.alias] || [];
    formatted[group.key] = list
      .map((item) => item[group.foreignKey])
      .filter(Boolean);
    formatted[group.alias] = undefined;
  }

  return formatted;
};

// ============================================
// ثبت اطلاعات هفتگی
// ------------------------------------------------------------
//  خروجی: { record } — record شکل فرمت‌شده دارد
// ============================================
const createWeekly = async (body = {}, { transaction = null } = {}) => {
  const validation = validateWeeklyData(body);
  if (!validation.isValid) {
    failValidation(validation, "اطلاعات هفتگی معتبر نیست");
  }

  const {
    customer_id,
    unit_id,
    hall_id,
    chick_placement_id,
    week_start_date,
    week_end_date,
    week_number,
    flock_age_days,
    service_expert_id,
    daily_feed_intake,
    weekly_feed_intake,
    weekly_weight,
    weekly_mortality,
    blackout_hours,
    additional_notes,
  } = body;

  // گلهٔ فعال (پیام‌های قبلی)
  await checkFlockIsActive(chick_placement_id, transaction);

  const customer = await CustomerPersonalInfo.findOne({
    where: { id: customer_id, active: true },
    transaction,
  });
  if (!customer) fail("مشتری یافت نشد یا غیرفعال است", 404);

  const hall = await Hall.findByPk(hall_id, { transaction });
  if (!hall) fail("سالن یافت نشد", 404);

  if (unit_id) {
    const unit = await Unit.findByPk(unit_id, { transaction });
    if (!unit) fail("واحد یافت نشد", 404);
  }

  const duplicate = await checkDuplicateWeek(
    chick_placement_id,
    week_number,
    null,
    transaction,
  );
  if (duplicate) {
    fail(`هفته ${week_number} برای این گله قبلاً ثبت شده است`, 400);
  }

  await checkWeekOrder(chick_placement_id, week_number, transaction);

  return runInTransaction(async (trx) => {
    const weeklyRecord = await WeeklyManagement.create(
      {
        customer_id,
        unit_id: unit_id || null,
        hall_id,
        chick_placement_id,
        week_start_date,
        week_end_date,
        week_number,
        flock_age_days,
        service_expert_id: service_expert_id || null,
        daily_feed_intake: daily_feed_intake || null,
        weekly_feed_intake: weekly_feed_intake || null,
        weekly_weight: weekly_weight || null,
        weekly_mortality: weekly_mortality || 0,
        blackout_hours: blackout_hours || 0,
        additional_notes: additional_notes || null,
      },
      { transaction: trx },
    );

    const baseData = {
      weekly_management_id: weeklyRecord.id,
      customer_id,
      unit_id: unit_id || null,
      hall_id,
      chick_placement_id,
    };

    for (const group of WEEKLY_ITEM_GROUPS) {
      await saveMultipleItems(
        group.model,
        group.foreignKey,
        body[group.key],
        baseData,
        trx,
      );
    }

    // ✅ قلاب تست (فقط خارج از production): اثبات rollback تراکنش
    if (
      process.env.NODE_ENV !== "production" &&
      process.env.TEST_FAIL_WEEKLY === "true"
    ) {
      throw new Error("TEST_FAIL_WEEKLY (fault injection)");
    }

    const complete = await loadWeeklyRecord(weeklyRecord.id, trx);
    return { record: formatWeeklyRecord(complete), id: weeklyRecord.id };
  }, transaction);
};

// ============================================
// بروزرسانی اطلاعات هفتگی
// ------------------------------------------------------------
//  خروجی: { record }
//  ⚠️ هر گروه آیتم فقط اگر کلیدش در بدنه باشد جایگزین می‌شود
//     (نبودن کلید = دست‌نزدن به داده‌های قبلی).
// ============================================
const updateWeekly = async (weeklyId, body = {}, { transaction = null } = {}) => {
  const record = await WeeklyManagement.findByPk(weeklyId, { transaction });
  if (!record) fail("اطلاعات هفتگی یافت نشد", 404);

  await checkFlockIsActive(record.chick_placement_id, transaction);

  const updateData = {};
  for (const field of WEEKLY_UPDATE_FIELDS) {
    if (body[field] !== undefined) updateData[field] = body[field];
  }

  // اعتبارسنجی دادهٔ ترکیبی (رکورد فعلی + تغییرات جدید)
  const merged = { ...record.toJSON(), ...updateData };
  const validation = validateWeeklyData(merged);
  if (!validation.isValid) {
    failValidation(validation, "اطلاعات هفتگی معتبر نیست");
  }

  return runInTransaction(async (trx) => {
    await record.update(updateData, { transaction: trx });

    const baseData = {
      weekly_management_id: record.id,
      customer_id: record.customer_id,
      unit_id: record.unit_id,
      hall_id: record.hall_id,
      chick_placement_id: record.chick_placement_id,
    };

    for (const group of WEEKLY_ITEM_GROUPS) {
      if (body[group.key] === undefined) continue;
      await group.model.destroy({
        where: { weekly_management_id: record.id },
        transaction: trx,
      });
      await saveMultipleItems(
        group.model,
        group.foreignKey,
        body[group.key],
        baseData,
        trx,
      );
    }

    const updated = await loadWeeklyRecord(record.id, trx);
    return { record: formatWeeklyRecord(updated) };
  }, transaction);
};

// ============================================
// حذف اطلاعات هفتگی (+ آیتم‌های وابسته)
// ------------------------------------------------------------
//  خروجی: { record }
// ============================================
const deleteWeekly = async (weeklyId, { transaction = null } = {}) => {
  const record = await WeeklyManagement.findByPk(weeklyId, { transaction });
  if (!record) fail("اطلاعات هفتگی یافت نشد", 404);

  await checkFlockIsActive(record.chick_placement_id, transaction);

  return runInTransaction(async (trx) => {
    for (const group of WEEKLY_ITEM_GROUPS) {
      await group.model.destroy({
        where: { weekly_management_id: record.id },
        transaction: trx,
      });
    }
    await record.destroy({ transaction: trx });
    return { record };
  }, transaction);
};

// ============================================
// صادرات
// ============================================
module.exports = {
  WEEKLY_ITEM_GROUPS,
  WEEKLY_UPDATE_FIELDS,
  checkFlockIsActive,
  checkDuplicateWeek,
  checkWeekOrder,
  saveMultipleItems,
  loadWeeklyRecord,
  formatWeeklyRecord,
  createWeekly,
  updateWeekly,
  deleteWeekly,
};


