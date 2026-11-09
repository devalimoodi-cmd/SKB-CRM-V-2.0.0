// ============================================================
// services/farm/placementWrite.js
// نوشتن «جوجه‌ریزی» — یک منبع برای کارشناس و پورتال (موج ۱۳.۱۲)
// ------------------------------------------------------------
//  منطق پیش از ۱۳.۱۲ داخل controllers/chickPlacementController.js
//  بود (به‌جز «کدام گله؟» که در ۱۳.۱۱ به services/flockResolver رفت).
//  اکنون نوشتن هم اینجاست تا مسیر تأیید پورتال دقیقاً همان قواعد
//  کارشناس را اجرا کند: یک جوجه‌ریزی فعال در هر سالن، تطابق سالن/واحد،
//  و حل گله از flockResolver.
//
// 🔒 قواعد تغییرناپذیر:
//   ۱) بدون `unit_id` هیچ جوجه‌ریزی ثبت نمی‌شود (گله در سطح واحد است).
//   ۲) اگر سالن جوجه‌ریزی فعال دارد ⇒ خطای ۴۰۰ با همان پیام قبلی.
//   ۳) قلاب تست TEST_FAIL_PLACEMENT (فقط خارج از production) حفظ شده؛
//      تستِ rollback به آن تکیه دارد.
//   ۴) فعال‌سازی یک دوره، دورهٔ فعالِ قبلی همان سالن را غیرفعال می‌کند.
// ============================================================
"use strict";

const ChickPlacement = require("../../models/ChickPlacement");
const CustomerPersonalInfo = require("../../models/CustomerPersonalInfo");
const Hall = require("../../models/Hall");
const Flock = require("../../models/Flock");
const Unit = require("../../models/Unit");
const {
  validateChickPlacement,
} = require("../../validations/chickPlacementValidation");
const { resolveFlock } = require("../flockResolver");
const { fail, failValidation } = require("./writeErrors");
const { runInTransaction } = require("./transaction");

// فیلدهای قابل ویرایش جوجه‌ریزی (همان فهرست قبلی کنترلر)
const PLACEMENT_UPDATE_FIELDS = [
  "unit_id",
  "placement_date",
  "flock_number",
  "chick_source_id",
  "breed_id",
  "chick_age_on_arrival",
  "avg_initial_weight",
  "total_chicks_count",
  "placement_density",
];

// ============================================
// ایجاد جوجه‌ریزی (+ یافتن/ساخت گله در همان تراکنش)
// ------------------------------------------------------------
//  خروجی: { placement, flock, hall, unit }
// ============================================
const createPlacement = async (body = {}, { transaction = null } = {}) => {
  const validation = validateChickPlacement(body);
  if (!validation.isValid) {
    failValidation(validation, "اطلاعات جوجه‌ریزی معتبر نیست");
  }

  const {
    customer_id,
    unit_id,
    hall_id,
    placement_date,
    flock_id,
    start_new_flock,
    chick_source_id,
    breed_id,
    chick_age_on_arrival,
    avg_initial_weight,
    total_chicks_count,
    placement_density,
  } = body;

  const customer = await CustomerPersonalInfo.findOne({
    where: { id: customer_id, active: true },
    transaction,
  });
  if (!customer) fail("مشتری یافت نشد یا غیرفعال است", 404);

  const hall = await Hall.findByPk(hall_id, { transaction });
  if (!hall) fail("سالن یافت نشد", 404);

  if (!unit_id) fail("شناسه واحد الزامی است", 400);
  const unit = await Unit.findByPk(unit_id, { transaction });
  if (!unit) fail("واحد یافت نشد", 404);
  if (hall.unit_id && parseInt(hall.unit_id) !== parseInt(unit_id)) {
    fail("سالن متعلق به این واحد نیست", 400);
  }

  // فقط یک جوجه‌ریزی فعال در هر سالن
  const activeInHall = await ChickPlacement.findOne({
    where: { hall_id, is_active: true },
    transaction,
  });
  if (activeInHall) {
    fail(
      "سالن در حال حاضر دارای جوجه‌ریزی فعال است؛ ابتدا دوره فعلی را پایان دهید",
      400,
    );
  }

  return runInTransaction(async (trx) => {
    let flock;
    try {
      flock = await resolveFlock({
        customer_id,
        unit_id,
        placement_date,
        flock_id,
        start_new_flock: !!start_new_flock,
        transaction: trx,
      });
    } catch (resolveError) {
      fail(resolveError.message, resolveError.status || 400);
    }

    const placement = await ChickPlacement.create(
      {
        customer_id,
        unit_id,
        hall_id,
        placement_date,
        flock_id: flock.id,
        // شمارهٔ گله در سطح گله است؛ اینجا فقط برای سازگاری ذخیره می‌شود
        flock_number: flock.flock_number,
        chick_source_id: chick_source_id || null,
        breed_id: breed_id || null,
        chick_age_on_arrival: chick_age_on_arrival || 1,
        avg_initial_weight: avg_initial_weight || null,
        total_chicks_count: total_chicks_count || null,
        placement_density: placement_density || null,
      },
      { transaction: trx },
    );

    // ✅ قلاب تست (فقط خارج از production): اثبات rollback تراکنش
    if (
      process.env.NODE_ENV !== "production" &&
      process.env.TEST_FAIL_PLACEMENT === "true"
    ) {
      throw new Error("TEST_FAIL_PLACEMENT (fault injection)");
    }

    return { placement, flock, hall, unit };
  }, transaction);
};

// ============================================
// بروزرسانی جوجه‌ریزی
// ------------------------------------------------------------
//  خروجی: { placement }
//  ⚠️ شمارهٔ گله فقط اگر عدد مثبت باشد نوشته می‌شود (0 ⇒ نادیده).
// ============================================
const updatePlacement = async (
  placementId,
  body = {},
  { transaction: existingTransaction = null } = {},
) =>
  runInTransaction(async (transaction) => {
    const placement = await ChickPlacement.findByPk(placementId, { transaction });
    if (!placement) fail("جوجه‌ریزی یافت نشد", 404);

    const updateData = {};
    for (const field of PLACEMENT_UPDATE_FIELDS) {
      if (body[field] === undefined) continue;
      if (field === "flock_number") {
        const num = parseInt(body[field], 10);
        if (!Number.isNaN(num) && num > 0) updateData[field] = num;
        continue;
      }
      updateData[field] = body[field];
    }

    await placement.update(updateData, { transaction });
    return { placement };
  }, existingTransaction);

// ============================================
// حذف جوجه‌ریزی
// ------------------------------------------------------------
//  خروجی: { placement }
// ============================================
const deletePlacement = async (
  placementId,
  { transaction: existingTransaction = null } = {},
) =>
  runInTransaction(async (transaction) => {
    const placement = await ChickPlacement.findByPk(placementId, { transaction });
    if (!placement) fail("جوجه‌ریزی یافت نشد", 404);

    await placement.destroy({ transaction });
    return { placement };
  }, existingTransaction);

// ============================================
// حذف کل «گله/دوره» (همهٔ جوجه‌ریزی‌های سالن‌های عضو)
// ------------------------------------------------------------
//  خروجی: { flock, removedPlacements }
// ============================================
const deleteFlockGroup = async (
  flockId,
  { transaction: existingTransaction = null } = {},
) => {
  const id = parseInt(flockId, 10);
  if (!id) fail("شناسه گله الزامی است", 400);

  const flock = await Flock.findByPk(id, { transaction: existingTransaction });
  if (!flock) fail("گله یافت نشد", 404);

  const placements = await ChickPlacement.findAll({
    where: { flock_id: id },
    attributes: ["id"],
    transaction: existingTransaction,
  });

  return runInTransaction(async (transaction) => {
    for (const placement of placements) {
      const row = await ChickPlacement.findByPk(placement.id, { transaction });
      if (row) await row.destroy({ transaction });
    }
    await flock.destroy({ transaction });

    return { flock, removedPlacements: placements.length };
  }, existingTransaction);
};

// ============================================
// فعال‌سازی دوره (و غیرفعال‌کردن دورهٔ فعال قبلی همان سالن)
// ------------------------------------------------------------
//  خروجی: { placement, deactivatedCount }
// ============================================
const activatePlacement = async (
  placementId,
  { transaction: existingTransaction = null } = {},
) =>
  runInTransaction(async (transaction) => {
    const placement = await ChickPlacement.findByPk(placementId, { transaction });
    if (!placement) fail("جوجه‌ریزی یافت نشد", 404);
    if (placement.is_active) fail("این جوجه‌ریزی قبلاً فعال شده است", 400);

    const [deactivatedCount] = await ChickPlacement.update(
      { is_active: false },
      {
        where: { hall_id: placement.hall_id, is_active: true },
        transaction,
      },
    );

    await placement.update({ is_active: true }, { transaction });
    return { placement, deactivatedCount: Number(deactivatedCount) || 0 };
  }, existingTransaction);

// ============================================
// پایان دوره (غیرفعال‌سازی بدون جایگزین)
// ------------------------------------------------------------
//  خروجی: { placement }
// ============================================
const deactivatePlacement = async (
  placementId,
  { transaction: existingTransaction = null } = {},
) =>
  runInTransaction(async (transaction) => {
    const placement = await ChickPlacement.findByPk(placementId, { transaction });
    if (!placement) fail("جوجه‌ریزی یافت نشد", 404);
    if (!placement.is_active) {
      fail("این جوجه‌ریزی قبلاً غیرفعال شده است", 400);
    }

    await placement.update({ is_active: false }, { transaction });
    return { placement };
  }, existingTransaction);

// ============================================
// صادرات
// ============================================
module.exports = {
  PLACEMENT_UPDATE_FIELDS,
  createPlacement,
  updatePlacement,
  deletePlacement,
  deleteFlockGroup,
  activatePlacement,
  deactivatePlacement,
};

