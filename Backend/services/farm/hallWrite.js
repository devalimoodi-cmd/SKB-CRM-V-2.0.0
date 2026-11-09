// ============================================================
// services/farm/hallWrite.js
// نوشتن «سالن» — یک منبع برای کارشناس و پورتال (موج ۱۳.۱۲)
// ------------------------------------------------------------
//  منطق پیش از ۱۳.۱۲ داخل controllers/hallController.js بود.
//  نکات حفظ‌شده (همان رفتار قبلی):
//   • شمارهٔ سالن خودکار = بیشترین شمارهٔ همان (مشتری، واحد) + ۱
//   • hall_order خودکار = بیشترین ترتیب + ۱
//   • units.hall_count بعد از هر تغییر همگام می‌شود
//   • حذف سالن «منطقی» است (deletedAt) و شمارش واحد کم می‌شود
//
// 🔒 قواعد:
//   ۱) `syncUnitHallCount` هرگز خطا پرتاب نمی‌کند (فقط هشدار) — تا
//      شکست در شمارش، ثبت سالن را خراب نکند (رفتار قبلی).
//   ۲) فهرست سفید بروزرسانی فقط ستون‌های خود مدل Hall است؛ rدیف‌های
//      تودرتوی include (unit/customer) هرگز نوشته نمی‌شوند.
//   ۳) خطای «شمارهٔ تکراری» به پیام فارسی روشن نگاشت می‌شود.
// ============================================================
"use strict";

const Hall = require("../../models/Hall");
const Unit = require("../../models/Unit");
const CustomerPersonalInfo = require("../../models/CustomerPersonalInfo");
const { fail, throwIfUnique } = require("./writeErrors");
const { runInTransaction } = require("./transaction");

// ستون‌های قابل ویرایش سالن (customer_id عمداً نیست)
const HALL_UPDATE_FIELDS = [
  "unit_id",
  "hall_name",
  "hall_number",
  "nominal_capacity",
  "altitude_above_sea",
  "hall_type_id",
  "construction_year",
  "service_expert_id",
  "operator_name",
  "hall_order",
  "is_active",
];

// ============================================
// همگام‌سازی تعداد واقعی سالن‌های یک واحد (units.hall_count)
// ------------------------------------------------------------
//  ⚠️ خطا را می‌بلعد (فقط هشدار) — همان رفتار پیش از ۱۳.۱۲.
// ============================================
const syncUnitHallCount = async (unitId, transaction = null) => {
  if (!unitId) return;
  try {
    // paranoid=true ⇒ سالن‌های حذف‌شده (deletedAt) شمرده نمی‌شوند
    const count = await Hall.count({ where: { unit_id: unitId }, transaction });
    await Unit.update(
      { hall_count: count },
      { where: { id: unitId }, transaction },
    );
  } catch (err) {
    console.warn("⚠️ خطا در همگام‌سازی تعداد سالن‌های واحد:", err.message);
  }
};

// شمارهٔ بعدی سالن در همان (مشتری، واحد)
const nextHallNumber = async ({ customerId, unitId, transaction = null }) => {
  const last = await Hall.findOne({
    where: { customer_id: customerId, unit_id: unitId },
    order: [["hall_number", "DESC"]],
    attributes: ["hall_number"],
    transaction,
  });
  return (last ? parseInt(last.hall_number || 0) : 0) + 1;
};

// ترتیب بعدی سالن در همان (مشتری، واحد)
const nextHallOrder = async ({ customerId, unitId, transaction = null }) => {
  const last = await Hall.findOne({
    where: { customer_id: customerId, unit_id: unitId },
    order: [["hall_order", "DESC"]],
    attributes: ["hall_order"],
    transaction,
  });
  return (last ? Number(last.hall_order || 0) : 0) + 1;
};

// ============================================
// ایجاد سالن
// ------------------------------------------------------------
//  خروجی: { hall, unit, customer }
// ============================================
const createHall = async (body = {}) => {
  const {
    customer_id,
    unit_id,
    hall_name,
    hall_number,
    nominal_capacity,
    altitude_above_sea,
    hall_type_id,
    construction_year,
    service_expert_id,
    operator_name,
    hall_order,
  } = body;

  if (!customer_id) fail("شناسه مشتری الزامی است", 400);
  if (!unit_id) fail("شناسه واحد الزامی است", 400);
  if (!hall_name) fail("نام سالن الزامی است", 400);

  const customer = await CustomerPersonalInfo.findOne({
    where: { id: customer_id, active: true },
  });
  if (!customer) fail("مشتری یافت نشد یا غیرفعال است", 404);

  const unit = await Unit.findByPk(unit_id);
  if (!unit) fail("واحد یافت نشد", 404);

  return runInTransaction(async (transaction) => {
    // شمارهٔ سالن خودکار (اگر ارسال نشده باشد)
    const finalHallNumber =
      hall_number ||
      (await nextHallNumber({ customerId: customer_id, unitId: unit_id, transaction }));

    // ترتیب خودکار (اگر ارسال نشده باشد)
    const finalHallOrder =
      hall_order ||
      (await nextHallOrder({ customerId: customer_id, unitId: unit_id, transaction }));

    const hall = await Hall.create(
      {
        customer_id,
        unit_id,
        hall_name,
        hall_number: finalHallNumber.toString(),
        hall_order: finalHallOrder,
        nominal_capacity,
        altitude_above_sea,
        hall_type_id,
        construction_year,
        service_expert_id: service_expert_id || null,
        operator_name,
        is_active: true,
      },
      { transaction },
    );

    await syncUnitHallCount(unit_id, transaction);

    return { hall, unit, customer };
  });
};

// ============================================
// بروزرسانی سالن
// ------------------------------------------------------------
//  خروجی: { hall, prevUnitId }
//  اگر سالن به واحد دیگری منتقل شود، تعداد سالن هر دو واحد بازمحاسبه
//  می‌شود (همان منطق قبلی).
// ============================================
const updateHall = async (hallId, body = {}) =>
  runInTransaction(async (transaction) => {
    const hall = await Hall.findByPk(hallId, { transaction });
    if (!hall) fail("سالن یافت نشد", 404);

    const updateData = {};
    for (const field of HALL_UPDATE_FIELDS) {
      if (body[field] !== undefined) updateData[field] = body[field];
    }
    if (updateData.hall_number !== undefined && updateData.hall_number !== null) {
      updateData.hall_number = String(updateData.hall_number);
    }

    const prevUnitId = hall.unit_id;
    try {
      await hall.update(updateData, { transaction });
    } catch (error) {
      throwIfUnique(error, "سالنی با این شماره در این واحد وجود دارد", 409);
      throw error;
    }

    await syncUnitHallCount(prevUnitId, transaction);
    if (hall.unit_id && hall.unit_id !== prevUnitId) {
      await syncUnitHallCount(hall.unit_id, transaction);
    }

    return { hall, prevUnitId };
  });

// ============================================
// حذف منطقی سالن (+ همگام‌سازی تعداد واحد)
// ------------------------------------------------------------
//  خروجی: { hall, unitId }
// ============================================
const deleteHall = async (hallId) =>
  runInTransaction(async (transaction) => {
    const hall = await Hall.findByPk(hallId, { transaction });
    if (!hall) fail("سالن یافت نشد", 404);

    const unitId = hall.unit_id;
    await hall.destroy({ transaction }); // حذف منطقی (deletedAt)
    await syncUnitHallCount(unitId, transaction);

    return { hall, unitId };
  });

// ============================================
// صادرات
// ============================================
module.exports = {
  HALL_UPDATE_FIELDS,
  syncUnitHallCount,
  nextHallNumber,
  nextHallOrder,
  createHall,
  updateHall,
  deleteHall,
};

