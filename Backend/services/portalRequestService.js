// ============================================================
// services/portalRequestService.js
// «درخواست مشتری ⇒ تأیید کارشناس» — لایهٔ دیتابیس   (موج ۱۳.۱۱)
// ------------------------------------------------------------
//  چرا لایهٔ جدا از کنترلر؟
//   همین سرویس هم از کنترلر مشتری (ثبت/لغو) و هم از کنترلر کارشناس
//   (تأیید/رد) صدا زده می‌شود. اگر منطق «اعمال درخواست» در کنترلر
//   می‌نشست، خطر دوباره‌نویسی و واگرایی امنیتی داشتیم.
//
//  🔒 قواعد تغییرناپذیر:
//   ۱) `customerId` همیشه پارامتر صریح است و از توکن می‌آید؛ این
//      سرویس هرگز آن را از بدنهٔ کلاینت نمی‌خواند.
//   ۲) اعتبارسنجی/پاک‌سازی فقط از services/portalRequestRules
//      می‌آید (هیچ اعتبارسنجی محلی دومی وجود ندارد).
//   ۳) تأیید = یک تراکنش: قفل ردیف ← اعتبارسنجی مجدد ← ساخت ردیف
//      واقعی ← به‌روزرسانی وضعیت. اگر هر مرحله شکست بخورد، هیچ
//      ردیفی در units/halls/chick_placements نمی‌ماند.
//   ۴) قفل ردیف (SELECT … FOR UPDATE) + شرط status='pending' مانع
//      «تأیید دوباره» توسط دو کارشناس هم‌زمان است.
//   ۵) گله از services/flockResolver حل می‌شود (همان قاعدهٔ ماژول
//      کارشناسان — بدون نسخهٔ دوم).
// ============================================================
"use strict";

const { Op } = require("sequelize");
const { sequelize } = require("../config/database");
const PortalRequest = require("../models/PortalRequest");
const Unit = require("../models/Unit");
const Hall = require("../models/Hall");
const ChickPlacement = require("../models/ChickPlacement");
const Flock = require("../models/Flock");
const ChickSource = require("../models/ChickSource");
const ChickenBreed = require("../models/ChickenBreed");
const HallType = require("../models/HallType");
const CustomerPersonalInfo = require("../models/CustomerPersonalInfo");
const { resolveFlock } = require("./flockResolver");
const { validateUnitData } = require("../validations/unitValidation");
const {
  MAX_PENDING_REQUESTS,
  MAX_PAYLOAD_BYTES,
  PENDING_STATUS,
  REQUEST_MESSAGES,
  approvalPatch,
  cancelPatch,
  canCancel,
  canReview,
  rejectionPatch,
  sanitizePayload,
  validatePayload,
  validateReason,
  payloadSizeBytes,
  isPayloadEmpty,
  isRequestType,
} = require("./portalRequestRules");

// ============================================
// خطای ساختاریافته (کنترلر code/status را به HTTP نگاشت می‌کند)
// ============================================
const serviceError = (code, status = 400, message = null, errors = null) => {
  const error = new Error(message || REQUEST_MESSAGES[code] || code);
  error.code = code;
  error.status = status;
  if (Array.isArray(errors) && errors.length) error.errors = errors;
  return error;
};

// شمارش درخواست‌های در انتظار یک پرونده (سقف صف)
const pendingCountOf = async (customerId) =>
  PortalRequest.count({
    where: { customer_id: customerId, status: PENDING_STATUS },
  });

// شمارنده‌های صفحهٔ «درخواست‌های من» برای UI
const countsOf = async (customerId) => {
  const rows = await PortalRequest.findAll({
    where: { customer_id: customerId },
    attributes: [
      "status",
      [sequelize.fn("COUNT", sequelize.col("id")), "total"],
    ],
    group: ["status"],
    raw: true,
  });
  const counts = {
    pending: 0,
    approved: 0,
    rejected: 0,
    cancelled: 0,
    total: 0,
  };
  for (const row of rows) {
    const total = Number(row.total) || 0;
    if (Object.prototype.hasOwnProperty.call(counts, row.status)) {
      counts[row.status] = total;
    }
    counts.total += total;
  }
  return counts;
};

// کلید طبیعی هر نوع برای تشخیص «درخواست تکراری باز»
const duplicateKeyOf = (type, payload = {}) => {
  if (type === "unit_create") return [payload.unit_name];
  if (type === "hall_create") return [payload.unit_id, payload.hall_name];
  if (type === "placement_create") return [payload.hall_id];
  return null;
};

const sameNaturalKey = (type, payloadA = {}, payloadB = {}) => {
  const keyA = duplicateKeyOf(type, payloadA);
  const keyB = duplicateKeyOf(type, payloadB);
  if (!keyA || !keyB) return false;
  return keyA.every(
    (value, index) => String(value ?? "") === String(keyB[index] ?? ""),
  );
};

// ============================================
// ۲) ثبت درخواست (سمت مشتری)
// ------------------------------------------------------------
//  ترتیب بررسی‌ها عمدی است: نوع ← پاک‌سازی ← اعتبارسنجی ← حجم ←
//  سقف صف ← تکرار. کم‌هزینه‌ترین بررسی‌ها اول‌اند تا با درخواست
//  نامعتبر به دیتابیس فشار نیاید.
// ============================================
const createRequest = async ({
  customerId,
  userId = null,
  type,
  body = {},
  ip = null,
  userAgent = null,
}) => {
  if (!customerId) throw serviceError("unlinked", 403);
  if (!isRequestType(type)) throw serviceError("invalid_type", 400);

  const payload = sanitizePayload(type, body);
  if (isPayloadEmpty(payload)) throw serviceError("payload_empty", 400);

  if (payloadSizeBytes(payload) > MAX_PAYLOAD_BYTES) {
    throw serviceError("payload_too_large", 400);
  }

  const validation = validatePayload(type, payload);
  if (!validation.isValid) {
    throw serviceError(
      "validation_failed",
      400,
      validation.errors[0],
      validation.errors,
    );
  }

  const pending = await pendingCountOf(customerId);
  if (pending >= MAX_PENDING_REQUESTS) {
    throw serviceError("too_many_pending", 429);
  }

  // تکرار: همان نوع + همان کلید طبیعی، هنوز در انتظار
  if (duplicateKeyOf(type, payload)) {
    const openRows = await PortalRequest.findAll({
      where: {
        customer_id: customerId,
        request_type: type,
        status: PENDING_STATUS,
      },
      attributes: ["id", "payload"],
    });
    const clash = openRows.find((row) =>
      sameNaturalKey(type, row.payload || {}, payload),
    );
    if (clash) throw serviceError("duplicate_pending", 409);
  }

  const request = await PortalRequest.create({
    customer_id: customerId, // 🔒 فقط از توکن
    request_type: type,
    status: PENDING_STATUS,
    payload,
    submitted_by: userId,
    submitted_ip: ip ? String(ip).slice(0, 45) : null,
    submitted_user_agent: userAgent ? String(userAgent).slice(0, 255) : null,
  });

  console.info(
    `📝 [portal-requests] درخواست ${request.id} (${type}) پرونده ${customerId} ثبت شد`,
  );

  return request;
};

// ============================================
// ۳) فهرست درخواست‌های خودم
// ============================================
const listMyRequests = async ({ customerId, status = null, limit = 20, offset = 0 }) => {
  const where = { customer_id: customerId };
  if (status) where.status = status;

  const { rows, count } = await PortalRequest.findAndCountAll({
    where,
    order: [
      ["created_at", "DESC"],
      ["id", "DESC"],
    ],
    limit,
    offset,
  });

  return { rows, count: Number(count) || 0, counts: await countsOf(customerId) };
};

// ============================================
// ۴) لغو درخواست توسط خود مشتری
// ------------------------------------------------------------
//  🔒 فقط pending و فقط ردیف خودم. ردیف مشتری دیگر یا ناموجود ⇒
//  ۴۰۴ یکسان (با requireOwnedRow در مسیر هم سنجیده می‌شود).
// ============================================
const cancelMyRequest = async ({ customerId, requestId }) => {
  const row = await PortalRequest.findOne({
    where: { id: requestId, customer_id: customerId },
  });
  if (!row) throw serviceError("not_found", 404);
  if (!canCancel(row.status)) throw serviceError("cancel_only_pending", 409);

  await row.update(cancelPatch());
  console.info(
    `🚫 [portal-requests] درخواست ${row.id} پرونده ${customerId} توسط مشتری لغو شد`,
  );
  return row;
};

// ============================================
// ۵) صف کارشناس
// ------------------------------------------------------------
//  ⚠️ این توابع عمداً اسکوپ مشتری ندارند: فقط با کلید مجوز
//  portal.requests.view/review از روتر کارکنان صدا زده می‌شوند.
// ============================================
const listQueue = async ({
  status = null,
  type = null,
  search = "",
  limit = 20,
  offset = 0,
}) => {
  const where = {};
  if (status) where.status = status;
  if (type) where.request_type = type;

  // جست‌وجو: فقط اگر ورودی عددی باشد، شناسهٔ پرونده؛ وگرنه کد/نام
  // مشتری با یک کوئری محدود حل می‌شود (بدون join سنگین).
  const term = String(search || "").trim();
  if (term) {
    if (/^[0-9]+$/.test(term)) {
      where.customer_id = Number(term);
    } else {
      const customers = await CustomerPersonalInfo.findAll({
        where: {
          [Op.or]: [
            { full_name: { [Op.iLike]: `%${term}%` } },
            { customer_code: { [Op.iLike]: `%${term}%` } },
            { farm_name: { [Op.iLike]: `%${term}%` } },
          ],
        },
        attributes: ["id"],
        limit: 50,
      });
      const ids = customers.map((row) => Number(row.id)).filter(Boolean);
      where.customer_id = ids.length ? { [Op.in]: ids } : -1;
    }
  }

  const { rows, count } = await PortalRequest.findAndCountAll({
    where,
    order: [
      ["created_at", "DESC"],
      ["id", "DESC"],
    ],
    limit,
    offset,
  });

  return {
    rows,
    count: Number(count) || 0,
    pending: await pendingQueueCount(),
  };
};

// تعداد کل در انتظار (نشان صف در منوی پنل ادمین)
const pendingQueueCount = async () =>
  PortalRequest.count({ where: { status: PENDING_STATUS } });

// یک درخواست برای صفحهٔ بازبینی
const getRequest = async (requestId) => {
  const row = await PortalRequest.findByPk(requestId);
  if (!row) throw serviceError("not_found", 404);
  return row;
};

// ============================================
// ۶) تأیید درخواست (کارشناس/مدیر)
// ------------------------------------------------------------
//  🔒 ترتیب: قفل ردیف ← وضعیت pending؟ ← (اصلاح payload اختیاری) ←
//  اعتبارسنجی ← اعمال در جدول اصلی ← نوشتن نتیجه.
//  هر خطای اعمال ⇒ rollback کامل (تراکنش) + پیام روشن به کارشناس.
// ============================================
const approveRequest = async ({ requestId, reviewerId = null, payloadOverride = null }) => {
  const transaction = await sequelize.transaction();
  try {
    const row = await PortalRequest.findOne({
      where: { id: requestId },
      lock: transaction.LOCK.UPDATE,
      transaction,
    });
    if (!row) throw serviceError("not_found", 404);
    if (!canReview(row.status)) throw serviceError("already_reviewed", 409);

    // اصلاح پیش از تأیید: فقط با همان فیلتر سفید و همان اعتبارسنجی
    let payload = row.payload || {};
    if (payloadOverride && typeof payloadOverride === "object") {
      payload = {
        ...payload,
        ...sanitizePayload(row.request_type, payloadOverride),
      };
    }

    const validation = validatePayload(row.request_type, payload);
    if (!validation.isValid) {
      throw serviceError(
        "validation_failed",
        400,
        validation.errors[0],
        validation.errors,
      );
    }

    const applied = await applyRequest({
      type: row.request_type,
      customerId: row.customer_id,
      payload,
      transaction,
    });

    await row.update(
      {
        ...approvalPatch({
          reviewerId,
          now: new Date(),
          entityId: applied.entityId,
          summary: applied.summary,
        }),
        payload, // اگر کارشناس اصلاح کرد، همان نسخهٔ اصلاح‌شده می‌ماند
      },
      { transaction },
    );

    await transaction.commit();
    console.info(
      `✅ [portal-requests] درخواست ${row.id} (${row.request_type}) تأیید و اعمال شد (entity=${applied.entityId})`,
    );
    return row;
  } catch (error) {
    await safeRollback(transaction);
    throw error;
  }
};

// ============================================
// ۷) رد درخواست
// ------------------------------------------------------------
//  دلیل رد اجباری است و همان‌جا (در سرویس قواعد) پاک‌سازی می‌شود.
// ============================================
const rejectRequest = async ({ requestId, reviewerId = null, reason }) => {
  const decision = validateReason(reason);
  if (!decision.isValid) throw serviceError("reason_required", 400);

  const transaction = await sequelize.transaction();
  try {
    const row = await PortalRequest.findOne({
      where: { id: requestId },
      lock: transaction.LOCK.UPDATE,
      transaction,
    });
    if (!row) throw serviceError("not_found", 404);
    if (!canReview(row.status)) throw serviceError("already_reviewed", 409);

    await row.update(
      rejectionPatch({ reviewerId, now: new Date(), reason: decision.value }),
      { transaction },
    );
    await transaction.commit();
    console.info(
      `⛔ [portal-requests] درخواست ${row.id} رد شد (بازبین=${reviewerId ?? "-"})`,
    );
    return row;
  } catch (error) {
    await safeRollback(transaction);
    throw error;
  }
};

// rollback ایمن (اگر تراکنش قبلاً بسته شده باشد خطا ندهد)
const safeRollback = async (transaction) => {
  if (!transaction) return;
  try {
    await transaction.rollback();
  } catch {
    /* تراکنش قبلاً بسته شده — کاری لازم نیست */
  }
};

// ============================================
// ۸) اعمال درخواست در جدول اصلی
// ------------------------------------------------------------
//  ⚠️ این توابع فقط داخل تراکنش approveRequest اجرا می‌شوند؛
//  هیچ‌کدام خودشان commit نمی‌کنند.
// ============================================
const applyRequest = async ({ type, customerId, payload, transaction }) => {
  if (type === "unit_create") {
    return applyUnitCreate({ customerId, payload, transaction });
  }
  if (type === "hall_create") {
    return applyHallCreate({ customerId, payload, transaction });
  }
  if (type === "placement_create") {
    return applyPlacementCreate({ customerId, payload, transaction });
  }
  throw serviceError("invalid_type", 400);
};

// --------------------------------------------
// ۸.۱) ثبت واحد
// --------------------------------------------
const applyUnitCreate = async ({ customerId, payload, transaction }) => {
  const customer = await CustomerPersonalInfo.findByPk(customerId, {
    transaction,
  });

  const duplicate = await Unit.findOne({
    where: {
      customer_personal_information_id: customerId,
      unit_name: payload.unit_name,
    },
    transaction,
  });
  if (duplicate) throw serviceError("unit_name_taken", 409);

  // فیلدهایی که مشتری پر نکرده از پروندهٔ خودش تکمیل می‌شود
  const data = {
    customer_personal_information_id: customerId,
    unit_name: payload.unit_name,
    address: payload.address || (customer && customer.farm_address) || null,
    hall_count: payload.hall_count,
    capacity: payload.capacity,
    longitude: payload.longitude ?? null,
    latitude: payload.latitude ?? null,
    manager_name:
      payload.manager_name || (customer && customer.full_name) || null,
    manager_phone:
      payload.manager_phone || (customer && customer.mobile_number) || null,
  };

  if (!data.manager_name || !data.manager_phone) {
    throw serviceError("manager_info_missing", 400);
  }

  // ✅ دفاع لایه‌دوم: همان اعتبارسنجی رسمی واحد روی دادهٔ نهایی
  const validation = validateUnitData(data);
  if (!validation.isValid) {
    throw serviceError(
      "validation_failed",
      400,
      validation.errors[0],
      validation.errors,
    );
  }

  const unit = await Unit.create(data, { transaction });
  return {
    entityId: unit.id,
    summary: `واحد «${unit.unit_name}» ثبت شد`,
  };
};

// --------------------------------------------
// ۸.۲) ثبت سالن
// ------------------------------------------------------------
//  شماره/ترتیب سالن دقیقاً مثل hallController محاسبه می‌شود تا
//  شماره‌گذاری پورتال و ماژول کارشناس یکی باشد.
// --------------------------------------------
const nextHallNumber = async ({ customerId, unitId, transaction }) => {
  const last = await Hall.findOne({
    where: { customer_id: customerId, unit_id: unitId },
    order: [["hall_number", "DESC"]],
    attributes: ["hall_number"],
    transaction,
  });
  return (last ? parseInt(last.hall_number || 0) : 0) + 1;
};

const nextHallOrder = async ({ customerId, unitId, transaction }) => {
  const last = await Hall.findOne({
    where: { customer_id: customerId, unit_id: unitId },
    order: [["hall_order", "DESC"]],
    attributes: ["hall_order"],
    transaction,
  });
  return (last ? Number(last.hall_order || 0) : 0) + 1;
};

// همگام‌سازی تعداد سالن‌های واحد (همان قاعدهٔ hallController)
const syncUnitHallCount = async (unitId, transaction) => {
  const count = await Hall.count({ where: { unit_id: unitId }, transaction });
  await Unit.update(
    { hall_count: count },
    { where: { id: unitId }, transaction },
  );
};

const applyHallCreate = async ({ customerId, payload, transaction }) => {
  const unit = await Unit.findOne({
    where: { id: payload.unit_id, customer_personal_information_id: customerId },
    transaction,
  });
  if (!unit) throw serviceError("unit_not_found", 404);

  if (payload.hall_number) {
    const duplicate = await Hall.findOne({
      where: {
        customer_id: customerId,
        unit_id: unit.id,
        hall_number: String(payload.hall_number),
      },
      transaction,
    });
    if (duplicate) throw serviceError("hall_number_taken", 409);
  }

  const hallNumber =
    payload.hall_number ||
    (await nextHallNumber({ customerId, unitId: unit.id, transaction }));

  const hall = await Hall.create(
    {
      customer_id: customerId,
      unit_id: unit.id,
      hall_name: payload.hall_name || `سالن ${hallNumber}`,
      hall_number: String(hallNumber),
      hall_order: await nextHallOrder({
        customerId,
        unitId: unit.id,
        transaction,
      }),
      nominal_capacity: payload.nominal_capacity ?? null,
      altitude_above_sea: payload.altitude_above_sea ?? null,
      hall_type_id: payload.hall_type_id ?? null,
      construction_year: payload.construction_year ?? null,
      operator_name: payload.operator_name ?? null,
      is_active: true,
    },
    { transaction },
  );

  await syncUnitHallCount(unit.id, transaction);

  return {
    entityId: hall.id,
    summary: `سالن «${hall.hall_name}» در واحد «${unit.unit_name}» ثبت شد`,
  };
};

// --------------------------------------------
// ۸.۳) ثبت جوجه‌ریزی
// ------------------------------------------------------------
//  گله از flockResolver حل می‌شود (همان قاعدهٔ ماژول کارشناسان)؛
//  خطاهای آن به کدهای این سرویس نگاشت می‌شوند تا پیام فارسی یکدست
//  بماند.
// --------------------------------------------
const FLOCK_ERROR_CODES = {
  "گله یافت نشد": "flock_not_found",
  "گله متعلق به این واحد نیست": "flock_unit_mismatch",
  "گله مورد نظر فعال نیست": "flock_not_active",
};

const applyPlacementCreate = async ({ customerId, payload, transaction }) => {
  const unit = await Unit.findOne({
    where: { id: payload.unit_id, customer_personal_information_id: customerId },
    transaction,
  });
  if (!unit) throw serviceError("unit_not_found", 404);

  const hall = await Hall.findOne({
    where: { id: payload.hall_id, customer_id: customerId },
    transaction,
  });
  if (!hall) throw serviceError("hall_not_found", 404);

  if (hall.unit_id && Number(hall.unit_id) !== Number(unit.id)) {
    throw serviceError("hall_unit_mismatch", 400);
  }

  // فقط یک جوجه‌ریزی فعال در هر سالن
  const activeInHall = await ChickPlacement.findOne({
    where: { hall_id: hall.id, is_active: true },
    transaction,
  });
  if (activeInHall) throw serviceError("hall_busy", 409);

  let flock;
  try {
    flock = await resolveFlock({
      customer_id: customerId,
      unit_id: unit.id,
      placement_date: payload.placement_date,
      flock_id: payload.flock_id || null,
      start_new_flock: Boolean(payload.start_new_flock),
      transaction,
    });
  } catch (error) {
    const code = FLOCK_ERROR_CODES[error.message] || "apply_failed";
    throw serviceError(code, error.status === 404 ? 404 : 400, error.message);
  }

  const placement = await ChickPlacement.create(
    {
      customer_id: customerId,
      unit_id: unit.id,
      hall_id: hall.id,
      placement_date: payload.placement_date,
      flock_id: flock.id,
      // شمارهٔ گله در سطح گله است؛ اینجا فقط برای سازگاری ذخیره می‌شود
      flock_number: flock.flock_number,
      chick_source_id: payload.chick_source_id || null,
      breed_id: payload.breed_id || null,
      chick_age_on_arrival: payload.chick_age_on_arrival || 1,
      avg_initial_weight: payload.avg_initial_weight || null,
      total_chicks_count: payload.total_chicks_count || null,
      placement_density: payload.placement_density || null,
    },
    { transaction },
  );

  return {
    entityId: placement.id,
    summary: `جوجه‌ریزی در «${hall.hall_name}» با ${
      placement.total_chicks_count ?? "-"
    } قطعه ثبت شد (گله ${flock.flock_number})`,
  };
};

// ============================================
// ۹) گزینه‌های فرم درخواست (فقط دادهٔ خودِ مشتری + دیکشنری حداقلی)
// ------------------------------------------------------------
//  🔒 برخلاف مسیرهای کارکنان، این‌جا هیچ لیست مشتری/کارشناسی
//  نمی‌آید: واحد/سالن/گله با customer_id فیلتر می‌شوند و دیکشنری‌ها
//  فقط id+name فعال‌ها را برمی‌گردانند.
// ============================================
const optionsFor = async (customerId) => {
  const [units, halls, flocks, chickSources, breeds, hallTypes] =
    await Promise.all([
      Unit.findAll({
        where: { customer_personal_information_id: customerId },
        attributes: ["id", "unit_name", "hall_count", "is_active"],
        order: [["unit_name", "ASC"]],
      }),
      Hall.findAll({
        where: { customer_id: customerId },
        attributes: ["id", "unit_id", "hall_name", "hall_number", "is_active"],
        order: [["hall_order", "ASC"]],
      }),
      Flock.findAll({
        where: { customer_id: customerId, status: "active" },
        attributes: ["id", "unit_id", "flock_number", "placement_date"],
        order: [["placement_date", "DESC"]],
      }),
      ChickSource.findAll({
        where: { active: true },
        attributes: ["id", "name"],
        order: [["name", "ASC"]],
      }),
      ChickenBreed.findAll({
        where: { active: true },
        attributes: ["id", "name"],
        order: [["name", "ASC"]],
      }),
      HallType.findAll({
        where: { active: true },
        attributes: ["id", "name"],
        order: [["name", "ASC"]],
      }),
    ]);

  return {
    units: units.map((row) => ({
      id: Number(row.id),
      unit_name: row.unit_name,
      hall_count: Number(row.hall_count) || 0,
      is_active: Boolean(row.is_active),
    })),
    halls: halls.map((row) => ({
      id: Number(row.id),
      unit_id: row.unit_id == null ? null : Number(row.unit_id),
      hall_name: row.hall_name,
      hall_number: row.hall_number || null,
      is_active: Boolean(row.is_active),
    })),
    flocks: flocks.map((row) => ({
      id: Number(row.id),
      unit_id: row.unit_id == null ? null : Number(row.unit_id),
      flock_number: row.flock_number,
      placement_date: row.placement_date || null,
    })),
    dictionaries: {
      chick_sources: chickSources.map((row) => ({
        id: Number(row.id),
        name: row.name,
      })),
      breeds: breeds.map((row) => ({ id: Number(row.id), name: row.name })),
      hall_types: hallTypes.map((row) => ({ id: Number(row.id), name: row.name })),
    },
  };
};

module.exports = {
  approveRequest,
  cancelMyRequest,
  countsOf,
  createRequest,
  getRequest,
  listMyRequests,
  listQueue,
  optionsFor,
  pendingCountOf,
  pendingQueueCount,
  rejectRequest,
};
