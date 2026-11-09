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
//   ۵) از ۱۳.۱۳ نوشتن واقعی از `services/farm/*` می‌آید (واحد، سالن،
//      جزئیات سالن، جوجه‌ریزی) — همان کدی که ماژول کارشناس اجرا می‌کند؛
//      این سرویس فقط مالکیت/تراکنش/خلاصه را اضافه می‌کند و گله همچنان
//      داخل همان هسته با flockResolver حل می‌شود.
// ============================================================
"use strict";

const { Op } = require("sequelize");
const { sequelize } = require("../config/database");
const PortalRequest = require("../models/PortalRequest");
const Unit = require("../models/Unit");
const Hall = require("../models/Hall");
const ChickPlacement = require("../models/ChickPlacement");
const WeeklyManagement = require("../models/WeeklyManagement");
const Flock = require("../models/Flock");
const ChickSource = require("../models/ChickSource");
const ChickenBreed = require("../models/ChickenBreed");
const HallType = require("../models/HallType");
const CustomerPersonalInfo = require("../models/CustomerPersonalInfo");
// ✅ ۱۳.۱۳: دیکشنری‌های چهار حوزهٔ جزئیات سالن + خود جدول‌ها
// (فقط برای پیش‌پرکردن فرم مشتری و پرچم «قبلاً ثبت شده»)
const FloorType = require("../models/FloorType");
const HeatingSystemType = require("../models/HeatingSystemType");
const CoolingSystemType = require("../models/CoolingSystemType");
const VentilationType = require("../models/VentilationType");
const WaterInletType = require("../models/WaterInletType");
const LightingSystemType = require("../models/LightingSystemType");
const WatererType = require("../models/WatererType");
const FeederType = require("../models/FeederType");
// ✅ ۱۳.۱۴: دیکشنری‌های آیتم‌های هفتگی
const Disease = require("../models/Disease");
const Vaccine = require("../models/Vaccine");
const Medicine = require("../models/Medicine");
const FeedType = require("../models/FeedType");
const SuggestionType = require("../models/SuggestionType");
const HallPhysicalInfo = require("../models/HallPhysicalInfo");
const HallSystem = require("../models/HallSystem");
const HallSystemItem = require("../models/HallSystemItem");
const HallWaterFeed = require("../models/HallWaterFeed");
const HallHygiene = require("../models/HallHygiene");
const { validateUnitData } = require("../validations/unitValidation");
// ✅ ۱۳.۱۳: نوشتن واقعی از هستهٔ مشترک فارم (همان کدی که کارشناس اجرا
// می‌کند). این سرویس فقط «مالکیت + تراکنش + خلاصهٔ فارسی» را اضافه می‌کند.
const unitWrite = require("./farm/unitWrite");
const hallWrite = require("./farm/hallWrite");
const hallDetailsWrite = require("./farm/hallDetailsWrite");
const placementWrite = require("./farm/placementWrite");
const weeklyWrite = require("./farm/weeklyWrite");
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
// ✅ ۱۳.۱۳: انواع تازه هم کلید طبیعی دارند تا مشتری نتواند ده درخواست
// روی همان ردیف باز کند.
const duplicateKeyOf = (type, payload = {}) => {
  if (type === "unit_create") return [payload.unit_name];
  if (type === "hall_create") return [payload.unit_id, payload.hall_name];
  if (type === "placement_create") return [payload.hall_id];
  if (type === "unit_update" || type === "unit_delete") return [payload.unit_id];
  if (type === "hall_update" || type === "hall_delete") return [payload.hall_id];
  if (type === "hall_physical_save") return [payload.hall_id, "physical"];
  if (type === "hall_system_save") return [payload.hall_id, "system"];
  if (type === "hall_water_feed_save") return [payload.hall_id, "water_feed"];
  if (type === "hall_hygiene_save") return [payload.hall_id, "hygiene"];
  // ✅ ۱۳.۱۴
  if (
    type === "placement_update" ||
    type === "placement_delete" ||
    type === "placement_activate" ||
    type === "placement_deactivate"
  ) {
    return [payload.placement_id];
  }
  if (type === "weekly_create") {
    return [payload.chick_placement_id, payload.week_number];
  }
  if (type === "weekly_update" || type === "weekly_delete") {
    return [payload.weekly_id];
  }
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
//
//  ✅ ۱۳.۱۳: نوشتن واقعی از `services/farm/*` می‌آید (یک منبع برای
//  کارشناس و پورتال). این لایه فقط سه کار دارد:
//    ۱) اثبات مالکیت ردیف هدف **داخل همان تراکنش** (FOR UPDATE)
//    ۲) عبور همان تراکنش به هستهٔ فارم
//    ۳) ساخت خلاصهٔ فارسی نتیجه برای مشتری/کارشناس
//  🔒 قاعده: هرگز `customer_id` یا `unit_id` از payload گرفته نمی‌شود؛
//  مالکیت از توکن و اتصال ردیف‌ها می‌آید.
// ============================================

// ردیف واحد در پروندهٔ همین مشتری (قفل ردیف تا دو تأیید هم‌زمان نسازد)
const requireOwnedUnit = async ({ customerId, unitId, transaction }) => {
  const unit = await Unit.findOne({
    where: {
      id: unitId,
      customer_personal_information_id: customerId,
    },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  if (!unit) throw serviceError("unit_not_found", 404);
  return unit;
};

// ردیف سالن در پروندهٔ همین مشتری (قفل ردیف؛ سالن حذف‌شده دیده نمی‌شود)
const requireOwnedHall = async ({ customerId, hallId, transaction }) => {
  const hall = await Hall.findOne({
    where: { id: hallId, customer_id: customerId },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  if (!hall) throw serviceError("hall_not_found", 404);
  return hall;
};

const applyRequest = async ({ type, customerId, payload, transaction }) => {
  if (HALL_DETAIL_APPLIERS[type]) {
    return applyHallDetailSave({ type, customerId, payload, transaction });
  }
  const apply = APPLIERS[type];
  if (!apply) throw serviceError("invalid_type", 400);
  return apply({ customerId, payload, transaction });
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

  // ✅ ۱۳.۱۳: ردیف واقعی با هستهٔ مشترک ساخته می‌شود (نام سالن‌ها،
  // وضعیت پیش‌فرض واحد و قاعدهٔ نام واحد یک منبع دارد).
  const { unit } = await unitWrite.createUnit(data, { transaction });
  return {
    entityId: unit.id,
    summary: `واحد «${unit.unit_name}» ثبت شد`,
  };
};

// --------------------------------------------
// ۸.۱.۱) ویرایش واحد  (✅ ۱۳.۱۳)
// --------------------------------------------
const UNIT_PORTAL_UPDATE_FIELDS = [
  "unit_name",
  "address",
  "hall_count",
  "capacity",
  "longitude",
  "latitude",
  "manager_name",
  "manager_phone",
];

const applyUnitUpdate = async ({ customerId, payload, transaction }) => {
  const unit = await requireOwnedUnit({
    customerId,
    unitId: payload.unit_id,
    transaction,
  });

  // نام تکراری در همان پرونده (فقط اگر نام واقعاً عوض شده باشد)
  if (payload.unit_name && payload.unit_name !== unit.unit_name) {
    const duplicate = await Unit.findOne({
      where: {
        customer_personal_information_id: customerId,
        unit_name: payload.unit_name,
      },
      transaction,
    });
    if (duplicate && Number(duplicate.id) !== Number(unit.id)) {
      throw serviceError("unit_name_taken", 409);
    }
  }

  const data = {};
  for (const field of UNIT_PORTAL_UPDATE_FIELDS) {
    if (payload[field] !== undefined) data[field] = payload[field];
  }

  const result = await unitWrite.updateUnit(unit.id, data, { transaction });
  const renamedHalls = Number(result.renamedHalls) || 0;

  return {
    entityId: result.unit.id,
    summary:
      renamedHalls > 0
        ? `واحد «${result.unit.unit_name}» ویرایش شد (نام ${renamedHalls} سالن بازتولید شد)`
        : `واحد «${result.unit.unit_name}» ویرایش شد`,
  };
};

// --------------------------------------------
// ۸.۱.۲) حذف واحد  (✅ ۱۳.۱۳)
// ------------------------------------------------------------
//  ⚠️ حذف آبشاری است (هفته‌ها/گله‌ها/بازدیدها/سالن‌ها). به همین دلیل
//  مشتری باید نام واحد را بازتایپ کند و همین‌جا با نام فعلی سنجیده
//  می‌شود — اگر بین ثبت و تأیید نام عوض شده باشد، تأیید نمی‌شود.
// --------------------------------------------
const applyUnitDelete = async ({ customerId, payload, transaction }) => {
  const unit = await requireOwnedUnit({
    customerId,
    unitId: payload.unit_id,
    transaction,
  });

  const typedName = String(payload.confirm_name || "").trim();
  const currentName = String(unit.unit_name || "").trim();
  if (typedName.toLowerCase() !== currentName.toLowerCase()) {
    throw serviceError("confirm_name_mismatch", 400);
  }

  await unitWrite.deleteUnit(unit.id, { transaction });

  return {
    entityId: unit.id,
    summary: `واحد «${currentName}» با همهٔ سوابق وابسته حذف شد`,
  };
};

// --------------------------------------------
// ۸.۲) ثبت سالن
// ------------------------------------------------------------
//  ✅ ۱۳.۱۳: شماره/ترتیب خودکار و همگام‌سازی `hall_count` از
//  `services/farm/hallWrite` می‌آید — همان کدی که ماژول کارشناس
//  اجرا می‌کند. نسخهٔ محلیِ این سرویس (nextHallNumber/nextHallOrder/
//  syncUnitHallCount) حذف شد تا شماره‌گذاری دو پیاده‌سازی نداشته باشد.
// --------------------------------------------
const applyHallCreate = async ({ customerId, payload, transaction }) => {
  const unit = await requireOwnedUnit({
    customerId,
    unitId: payload.unit_id,
    transaction,
  });

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

  const { hall } = await hallWrite.createHall(
    {
      customer_id: customerId,
      unit_id: unit.id,
      hall_name: payload.hall_name,
      hall_number: payload.hall_number,
      nominal_capacity: payload.nominal_capacity,
      altitude_above_sea: payload.altitude_above_sea,
      hall_type_id: payload.hall_type_id,
      construction_year: payload.construction_year,
      operator_name: payload.operator_name,
    },
    { transaction },
  );

  return {
    entityId: hall.id,
    summary: `سالن «${hall.hall_name}» در واحد «${unit.unit_name}» ثبت شد`,
  };
};

// --------------------------------------------
// ۸.۲.۱) ویرایش سالن  (✅ ۱۳.۱۳)
// ------------------------------------------------------------
//  ⚠️ `unit_id` عمداً در فهرست نیست ⇒ انتقال سالن بین واحدها از
//  پورتال ممکن نیست (عملیات کارشناس می‌ماند) و شمارش سالن‌های دو
//  واحد از دو مسیر مختلف تغییر نمی‌کند.
// --------------------------------------------
const HALL_PORTAL_UPDATE_FIELDS = [
  "hall_name",
  "hall_number",
  "nominal_capacity",
  "altitude_above_sea",
  "hall_type_id",
  "construction_year",
  "operator_name",
];

const applyHallUpdate = async ({ customerId, payload, transaction }) => {
  const hall = await requireOwnedHall({
    customerId,
    hallId: payload.hall_id,
    transaction,
  });

  if (
    payload.hall_number &&
    String(payload.hall_number) !== String(hall.hall_number || "")
  ) {
    const duplicate = await Hall.findOne({
      where: {
        customer_id: customerId,
        unit_id: hall.unit_id,
        hall_number: String(payload.hall_number),
      },
      transaction,
    });
    if (duplicate && Number(duplicate.id) !== Number(hall.id)) {
      throw serviceError("hall_number_taken", 409);
    }
  }

  const data = {};
  for (const field of HALL_PORTAL_UPDATE_FIELDS) {
    if (payload[field] !== undefined) data[field] = payload[field];
  }

  const result = await hallWrite.updateHall(hall.id, data, { transaction });

  return {
    entityId: result.hall.id,
    summary: `سالن «${result.hall.hall_name}» ویرایش شد`,
  };
};

// --------------------------------------------
// ۸.۲.۲) حذف سالن  (✅ ۱۳.۱۳)
// ------------------------------------------------------------
//  حذف «منطقی» است (deletedAt) و `hall_count` واحد همگام می‌شود؛
//  سوابق بازدید/هفته‌ها همان‌جا می‌مانند (رفتار ماژول کارشناس).
// --------------------------------------------
const applyHallDelete = async ({ customerId, payload, transaction }) => {
  const hall = await requireOwnedHall({
    customerId,
    hallId: payload.hall_id,
    transaction,
  });

  const hallName = hall.hall_name;
  await hallWrite.deleteHall(hall.id, { transaction });

  return {
    entityId: hall.id,
    summary: `سالن «${hallName}» حذف شد`,
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
  const unit = await requireOwnedUnit({
    customerId,
    unitId: payload.unit_id,
    transaction,
  });

  const hall = await requireOwnedHall({
    customerId,
    hallId: payload.hall_id,
    transaction,
  });

  if (hall.unit_id && Number(hall.unit_id) !== Number(unit.id)) {
    throw serviceError("hall_unit_mismatch", 400);
  }

  // ✅ ۱۳.۱۳: ساخت ردیف واقعی با هستهٔ مشترک انجام می‌شود؛ همان‌جا
  // «تک‌فعال‌بودن جوجه‌ریزی سالن» و حل گله (flockResolver) اجرا می‌شود.
  let result;
  try {
    result = await placementWrite.createPlacement(
      {
        customer_id: customerId,
        unit_id: unit.id,
        hall_id: hall.id,
        placement_date: payload.placement_date,
        flock_id: payload.flock_id || null,
        start_new_flock: Boolean(payload.start_new_flock),
        chick_source_id: payload.chick_source_id,
        breed_id: payload.breed_id,
        chick_age_on_arrival: payload.chick_age_on_arrival || 1,
        avg_initial_weight: payload.avg_initial_weight,
        total_chicks_count: payload.total_chicks_count,
        placement_density: payload.placement_density,
      },
      { transaction },
    );
  } catch (error) {
    // نگاشت خطاهای هستهٔ فارم به کدهای همین سرویس (پیام فارسی یکدست)
    const code = FLOCK_ERROR_CODES[error.message];
    if (code) {
      throw serviceError(code, error.status === 404 ? 404 : 400, error.message);
    }
    if (String(error.message || "").includes("جوجه‌ریزی فعال")) {
      throw serviceError("hall_busy", 409);
    }
    if (String(error.message || "").includes("متعلق به این واحد نیست")) {
      throw serviceError("hall_unit_mismatch", 400);
    }
    throw error;
  }

  const { placement, flock } = result;

  return {
    entityId: placement.id,
    summary: `جوجه‌ریزی در «${hall.hall_name}» با ${
      placement.total_chicks_count ?? "-"
    } قطعه ثبت شد (گله ${flock.flock_number})`,
  };
};

// --------------------------------------------
// ۸.۳.۱) ذخیرهٔ اطلاعات تکمیلی سالن  (✅ ۱۳.۱۳)
// ------------------------------------------------------------
//  چهار حوزه، همه با هستهٔ مشترک `hallDetailsWrite` (upsert + جایگزینی
//  ردیف‌های تجهیزات در همان تراکنش). مالکیت از راه خود سالن اثبات
//  می‌شود، چون `hall_physical_info` / `hall_systems` / `hall_water_feed`
//  ستون `customer_id` ندارند.
// --------------------------------------------
const HALL_DETAIL_APPLIERS = {
  hall_physical_save: hallDetailsWrite.savePhysicalInfo,
  hall_system_save: hallDetailsWrite.saveSystem,
  hall_water_feed_save: hallDetailsWrite.saveWaterFeed,
  hall_hygiene_save: hallDetailsWrite.saveHygiene,
};

const HALL_DETAIL_SUMMARIES = {
  hall_physical_save: "اطلاعات فیزیکی سالن ثبت شد",
  hall_system_save: "سیستم‌های سالن ثبت شد",
  hall_water_feed_save: "اطلاعات آب‌خوری/دان‌خوری ثبت شد",
  hall_hygiene_save: "اطلاعات بهداشت سالن ثبت شد",
};

const applyHallDetailSave = async ({
  type,
  customerId,
  payload,
  transaction,
}) => {
  const hall = await requireOwnedHall({
    customerId,
    hallId: payload.hall_id,
    transaction,
  });

  const save = HALL_DETAIL_APPLIERS[type];
  if (!save) throw serviceError("invalid_type", 400);

  // 🔒 `unit_id` هرگز از payload نمی‌آید؛ از خود ردیف سالن
  const body = {
    ...payload,
    hall_id: hall.id,
    unit_id: hall.unit_id || null,
  };
  // ستون customer_id فقط در جدول بهداشت وجود دارد و اجباری است
  if (type === "hall_hygiene_save") body.customer_id = customerId;

  const { created } = await save(body, { transaction });

  return {
    entityId: hall.id,
    summary: `${HALL_DETAIL_SUMMARIES[type]} «${hall.hall_name}»${
      created ? " (ثبت تازه)" : ""
    }`,
  };
};

// --------------------------------------------
// ۸.۵) مدیریت دوره/جوجه‌ریزی  (✅ ۱۳.۱۴)
// ------------------------------------------------------------
//  🔒 مالکیت از `ChickPlacement.customer_id` (همان کوئری + قفل ردیف).
//  `unit_id`/`hall_id` عمداً از payload خوانده نمی‌شوند (از ردیف دوره).
// --------------------------------------------
const requireOwnedPlacement = async ({
  customerId,
  placementId,
  transaction,
}) => {
  const placement = await ChickPlacement.findOne({
    where: { id: placementId, customer_id: customerId },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  if (!placement) throw serviceError("placement_not_found", 404);
  return placement;
};

const PLACEMENT_PORTAL_FIELDS = [
  "placement_date",
  "flock_number",
  "chick_source_id",
  "breed_id",
  "chick_age_on_arrival",
  "avg_initial_weight",
  "total_chicks_count",
  "placement_density",
];

const placementLabel = (placement) =>
  `دورهٔ ${placement.placement_date || "-"}${
    placement.flock_number ? ` (گله ${placement.flock_number})` : ""
  }`;

const applyPlacementUpdate = async ({ customerId, payload, transaction }) => {
  const placement = await requireOwnedPlacement({
    customerId,
    placementId: payload.placement_id,
    transaction,
  });

  const data = {};
  for (const field of PLACEMENT_PORTAL_FIELDS) {
    if (payload[field] !== undefined) data[field] = payload[field];
  }

  const result = await placementWrite.updatePlacement(placement.id, data, {
    transaction,
  });

  return {
    entityId: result.placement.id,
    summary: `${placementLabel(result.placement)} ویرایش شد`,
  };
};

const applyPlacementDelete = async ({ customerId, payload, transaction }) => {
  const placement = await requireOwnedPlacement({
    customerId,
    placementId: payload.placement_id,
    transaction,
  });

  await placementWrite.deletePlacement(placement.id, { transaction });

  return {
    entityId: placement.id,
    summary: `${placementLabel(placement)} حذف شد`,
  };
};

const applyPlacementActivate = async ({ customerId, payload, transaction }) => {
  const placement = await requireOwnedPlacement({
    customerId,
    placementId: payload.placement_id,
    transaction,
  });

  if (placement.is_active) throw serviceError("placement_already_active", 409);

  const result = await placementWrite.activatePlacement(placement.id, {
    transaction,
  });

  return {
    entityId: result.placement.id,
    summary: `${placementLabel(result.placement)} فعال شد${
      result.deactivatedCount > 0
        ? ` (${result.deactivatedCount} دورهٔ فعال قبلی غیرفعال شد)`
        : ""
    }`,
  };
};

const applyPlacementDeactivate = async ({
  customerId,
  payload,
  transaction,
}) => {
  const placement = await requireOwnedPlacement({
    customerId,
    placementId: payload.placement_id,
    transaction,
  });

  if (!placement.is_active) {
    throw serviceError("placement_already_inactive", 409);
  }

  const result = await placementWrite.deactivatePlacement(placement.id, {
    transaction,
  });

  return {
    entityId: result.placement.id,
    summary: `${placementLabel(result.placement)} پایان یافت`,
  };
};

// --------------------------------------------
// ۸.۶) اطلاعات هفتگی  (✅ ۱۳.۱۴)
// ------------------------------------------------------------
//  🔒 مالکیت: `WeeklyManagement.customer_id` برای ویرایش/حذف و
//  `ChickPlacement.customer_id` برای ثبت (هفته هنوز وجود ندارد).
//  `hall_id`/`unit_id`/`customer_id` از ردیف دوره می‌آیند، نه payload.
// --------------------------------------------
const requireOwnedWeekly = async ({ customerId, weeklyId, transaction }) => {
  const weekly = await WeeklyManagement.findOne({
    where: { id: weeklyId, customer_id: customerId },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  if (!weekly) throw serviceError("weekly_not_found", 404);
  return weekly;
};

const requireActivePlacement = async ({
  customerId,
  placementId,
  transaction,
}) => {
  const placement = await requireOwnedPlacement({
    customerId,
    placementId,
    transaction,
  });
  if (!placement.is_active) throw serviceError("flock_inactive", 400);
  return placement;
};

const WEEKLY_ID_LIST_KEYS = [
  "disease_ids",
  "vaccine_ids",
  "medicine_ids",
  "feed_type_ids",
  "suggestion_ids",
];

const WEEKLY_PORTAL_UPDATE_FIELDS = [
  "week_start_date",
  "week_end_date",
  "week_number",
  "flock_age_days",
  "daily_feed_intake",
  "weekly_feed_intake",
  "weekly_weight",
  "weekly_mortality",
  "blackout_hours",
  "additional_notes",
];

// فقط کلیدهایی که واقعاً ارسال شده‌اند (آرایه‌های شناسه هم شامل)
const weeklyWriteDataOf = (payload) => {
  const data = {};
  for (const field of WEEKLY_PORTAL_UPDATE_FIELDS) {
    if (payload[field] !== undefined) data[field] = payload[field];
  }
  for (const key of WEEKLY_ID_LIST_KEYS) {
    if (payload[key] !== undefined) data[key] = payload[key];
  }
  return data;
};

// نگاشت خطاهای فارسی هستهٔ هفتگی به کدهای همین سرویس
const mapWeeklyError = (error) => {
  if (error && error.code) return error;
  const message = String((error && error.message) || "");
  if (message.includes("قبلاً ثبت شده")) {
    return serviceError("week_duplicate", 409, message);
  }
  if (message.includes("باید هفته")) {
    return serviceError("week_order", 400, message);
  }
  if (message.includes("غیرفعال")) {
    return serviceError("flock_inactive", 400, message);
  }
  return error;
};

const applyWeeklyCreate = async ({ customerId, payload, transaction }) => {
  const placement = await requireActivePlacement({
    customerId,
    placementId: payload.chick_placement_id,
    transaction,
  });

  let result;
  try {
    result = await weeklyWrite.createWeekly(
      {
        // 🔒 شناسه‌ها از ردیف دوره — نه از payload
        customer_id: customerId,
        unit_id: placement.unit_id || null,
        hall_id: placement.hall_id,
        chick_placement_id: placement.id,
        ...weeklyWriteDataOf(payload),
      },
      { transaction },
    );
  } catch (error) {
    throw mapWeeklyError(error);
  }

  return {
    entityId: result.id,
    summary: `هفتهٔ ${payload.week_number} برای ${placementLabel(
      placement,
    )} ثبت شد`,
  };
};

const applyWeeklyUpdate = async ({ customerId, payload, transaction }) => {
  const weekly = await requireOwnedWeekly({
    customerId,
    weeklyId: payload.weekly_id,
    transaction,
  });

  await requireActivePlacement({
    customerId,
    placementId: weekly.chick_placement_id,
    transaction,
  });

  let result;
  try {
    result = await weeklyWrite.updateWeekly(
      weekly.id,
      weeklyWriteDataOf(payload),
      { transaction },
    );
  } catch (error) {
    throw mapWeeklyError(error);
  }

  return {
    entityId: weekly.id,
    summary: `اطلاعات هفتهٔ ${result.record.week_number} ویرایش شد`,
  };
};

const applyWeeklyDelete = async ({ customerId, payload, transaction }) => {
  const weekly = await requireOwnedWeekly({
    customerId,
    weeklyId: payload.weekly_id,
    transaction,
  });

  await requireActivePlacement({
    customerId,
    placementId: weekly.chick_placement_id,
    transaction,
  });

  await weeklyWrite.deleteWeekly(weekly.id, { transaction });

  return {
    entityId: weekly.id,
    summary: `اطلاعات هفتهٔ ${weekly.week_number} حذف شد`,
  };
};

// ============================================
// ۸.۴) نقشهٔ اعمال (یک منبع — هر نوع تازه باید این‌جا بیاید)
// ------------------------------------------------------------
//  ⚠️ `portal-request-test.mjs` بررسی می‌کند که هر کلید
//  `REQUEST_TYPE_KEYS` یک applier داشته باشد؛ پس فراموش‌کردن یک نوع
//  در تست شکست می‌خورد، نه در زمان اجرا.
// ============================================
const APPLIERS = {
  unit_create: applyUnitCreate,
  unit_update: applyUnitUpdate,
  unit_delete: applyUnitDelete,
  hall_create: applyHallCreate,
  hall_update: applyHallUpdate,
  hall_delete: applyHallDelete,
  placement_create: applyPlacementCreate,
  // ✅ ۱۳.۱۴
  placement_update: applyPlacementUpdate,
  placement_delete: applyPlacementDelete,
  placement_activate: applyPlacementActivate,
  placement_deactivate: applyPlacementDeactivate,
  weekly_create: applyWeeklyCreate,
  weekly_update: applyWeeklyUpdate,
  weekly_delete: applyWeeklyDelete,
};

// ============================================
// ۹) گزینه‌های فرم درخواست (فقط دادهٔ خودِ مشتری + دیکشنری حداقلی)
// ------------------------------------------------------------
//  🔒 برخلاف مسیرهای کارکنان، این‌جا هیچ لیست مشتری/کارشناسی
//  نمی‌آید: واحد/سالن/گله با customer_id فیلتر می‌شوند و دیکشنری‌ها
//  فقط id+name فعال‌ها را برمی‌گردانند.
// ============================================
const optionsFor = async (customerId) => {
  const [
    units,
    halls,
    flocks,
    chickSources,
    breeds,
    hallTypes,
    floorTypes,
    heatingSystems,
    coolingSystems,
    ventilationTypes,
    waterInletTypes,
    lightingSystems,
    watererTypes,
    feederTypes,
    placements,
    diseases,
    vaccines,
    medicines,
    feedTypes,
    suggestionTypes,
  ] = await Promise.all([
    Unit.findAll({
      where: { customer_personal_information_id: customerId },
      // ✅ ۱۳.۱۳: فیلدهای لازم برای پیش‌پرکردن فرم «ویرایش واحد»
      attributes: [
        "id",
        "unit_name",
        "hall_count",
        "is_active",
        "address",
        "capacity",
        "manager_name",
        "manager_phone",
        "longitude",
        "latitude",
      ],
      order: [["unit_name", "ASC"]],
    }),
    Hall.findAll({
      where: { customer_id: customerId },
      // ✅ ۱۳.۱۳: فیلدهای لازم برای فرم «ویرایش سالن»
      attributes: [
        "id",
        "unit_id",
        "hall_name",
        "hall_number",
        "is_active",
        "nominal_capacity",
        "altitude_above_sea",
        "hall_type_id",
        "construction_year",
        "operator_name",
      ],
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
      // ✅ ۱۳.۱۳: هشت دیکشنری چهار حوزهٔ جزئیات سالن (همان‌هایی که
      // ماژول کارشناس از /api/dictionary می‌گیرد)
      FloorType.findAll({
        where: { active: true },
        attributes: ["id", "name"],
        order: [["name", "ASC"]],
      }),
      HeatingSystemType.findAll({
        where: { active: true },
        attributes: ["id", "name"],
        order: [["name", "ASC"]],
      }),
      CoolingSystemType.findAll({
        where: { active: true },
        attributes: ["id", "name"],
        order: [["name", "ASC"]],
      }),
      VentilationType.findAll({
        where: { active: true },
        attributes: ["id", "name"],
        order: [["name", "ASC"]],
      }),
      WaterInletType.findAll({
        where: { active: true },
        attributes: ["id", "name"],
        order: [["name", "ASC"]],
      }),
      LightingSystemType.findAll({
        where: { active: true },
        attributes: ["id", "name"],
        order: [["name", "ASC"]],
      }),
      WatererType.findAll({
        where: { active: true },
        attributes: ["id", "name"],
        order: [["name", "ASC"]],
      }),
      FeederType.findAll({
        where: { active: true },
        attributes: ["id", "name"],
        order: [["name", "ASC"]],
      }),
      // ✅ ۱۳.۱۴: دوره‌های خودم (برای ثبت هفته/ویرایش دوره)
      ChickPlacement.findAll({
        where: { customer_id: customerId },
        attributes: [
          "id",
          "unit_id",
          "hall_id",
          "placement_date",
          "flock_number",
          "total_chicks_count",
          "is_active",
        ],
        order: [
          ["is_active", "DESC"],
          ["placement_date", "DESC"],
        ],
      }),
      // ✅ ۱۳.۱۴: پنج دیکشنری آیتم‌های هفتگی (همان‌هایی که کارشناس دارد)
      Disease.findAll({
        where: { active: true },
        attributes: ["id", "name"],
        order: [["name", "ASC"]],
      }),
      Vaccine.findAll({
        where: { active: true },
        attributes: ["id", "name"],
        order: [["name", "ASC"]],
      }),
      Medicine.findAll({
        where: { active: true },
        attributes: ["id", "name"],
        order: [["name", "ASC"]],
      }),
      FeedType.findAll({
        where: { active: true },
        attributes: ["id", "name"],
        order: [["name", "ASC"]],
      }),
      SuggestionType.findAll({
        where: { active: true },
        attributes: ["id", "name"],
        order: [["name", "ASC"]],
      }),
    ]);

  // ✅ ۱۳.۱۳: پرچم «کدام بخش جزئیات قبلاً ثبت شده» (چهار کوئری گروهی،
  // نه N+1). فرم پورتال با همین پرچم «ثبت» یا «ویرایش» نشان می‌دهد.
  const hallIds = halls.map((row) => Number(row.id));
  const [physicalRows, systemRows, waterFeedRows, hygieneRows] = hallIds.length
    ? await Promise.all([
        HallPhysicalInfo.findAll({
          where: { hall_id: { [Op.in]: hallIds } },
          attributes: ["hall_id"],
          raw: true,
        }),
        HallSystem.findAll({
          where: { hall_id: { [Op.in]: hallIds } },
          attributes: ["hall_id"],
          raw: true,
        }),
        HallWaterFeed.findAll({
          where: { hall_id: { [Op.in]: hallIds } },
          attributes: ["hall_id"],
          raw: true,
        }),
        HallHygiene.findAll({
          where: { hall_id: { [Op.in]: hallIds } },
          attributes: ["hall_id"],
          raw: true,
        }),
      ])
    : [[], [], [], []];

  const hallIdSet = (rows) => new Set(rows.map((row) => Number(row.hall_id)));
  const physicalSet = hallIdSet(physicalRows);
  const systemSet = hallIdSet(systemRows);
  const waterFeedSet = hallIdSet(waterFeedRows);
  const hygieneSet = hallIdSet(hygieneRows);

  const dictionaryOf = (rows) =>
    rows.map((row) => ({ id: Number(row.id), name: row.name }));

  const numberOrNull = (value) =>
    value === null || value === undefined || value === ""
      ? null
      : Number(value);

  return {
    units: units.map((row) => ({
      id: Number(row.id),
      unit_name: row.unit_name,
      hall_count: Number(row.hall_count) || 0,
      is_active: Boolean(row.is_active),
      address: row.address || null,
      capacity: numberOrNull(row.capacity),
      manager_name: row.manager_name || null,
      manager_phone: row.manager_phone || null,
      longitude: numberOrNull(row.longitude),
      latitude: numberOrNull(row.latitude),
    })),
    halls: halls.map((row) => ({
      id: Number(row.id),
      unit_id: row.unit_id == null ? null : Number(row.unit_id),
      hall_name: row.hall_name,
      hall_number: row.hall_number || null,
      is_active: Boolean(row.is_active),
      nominal_capacity: numberOrNull(row.nominal_capacity),
      altitude_above_sea: numberOrNull(row.altitude_above_sea),
      hall_type_id: numberOrNull(row.hall_type_id),
      construction_year: numberOrNull(row.construction_year),
      operator_name: row.operator_name || null,
      has_physical: physicalSet.has(Number(row.id)),
      has_system: systemSet.has(Number(row.id)),
      has_water_feed: waterFeedSet.has(Number(row.id)),
      has_hygiene: hygieneSet.has(Number(row.id)),
    })),
    flocks: flocks.map((row) => ({
      id: Number(row.id),
      unit_id: row.unit_id == null ? null : Number(row.unit_id),
      flock_number: row.flock_number,
      placement_date: row.placement_date || null,
    })),
    dictionaries: {
      chick_sources: dictionaryOf(chickSources),
      breeds: dictionaryOf(breeds),
      hall_types: dictionaryOf(hallTypes),
      floor_types: dictionaryOf(floorTypes),
      heating_systems: dictionaryOf(heatingSystems),
      cooling_systems: dictionaryOf(coolingSystems),
      ventilation_types: dictionaryOf(ventilationTypes),
      water_inlet_types: dictionaryOf(waterInletTypes),
      lighting_systems: dictionaryOf(lightingSystems),
      waterer_types: dictionaryOf(watererTypes),
      feeder_types: dictionaryOf(feederTypes),
      // ✅ ۱۳.۱۴
      diseases: dictionaryOf(diseases),
      vaccines: dictionaryOf(vaccines),
      medicines: dictionaryOf(medicines),
      feed_types: dictionaryOf(feedTypes),
      suggestion_types: dictionaryOf(suggestionTypes),
    },
    // ✅ ۱۳.۱۴: دوره‌های خودم (پیش‌پرکردن فرم هفته/ویرایش دوره)
    placements: placements.map((row) => ({
      id: Number(row.id),
      unit_id: row.unit_id == null ? null : Number(row.unit_id),
      hall_id: row.hall_id == null ? null : Number(row.hall_id),
      placement_date: row.placement_date || null,
      flock_number: row.flock_number == null ? null : Number(row.flock_number),
      total_chicks_count: numberOrNull(row.total_chicks_count),
      is_active: Boolean(row.is_active),
    })),
  };
};

// ============================================
// ۱۰) جزئیات یک سالن (پیش‌پرکردن فرم ویرایش)  — ✅ ۱۳.۱۳
// ------------------------------------------------------------
//  🔒 مالکیت در همان کوئری سنجیده می‌شود (`customer_id`)؛ ردیف غیرخودی
//  ۴۰۴ می‌گیرد تا وجودش لو نرود و `customer_id` هرگز پارامتر نمی‌شود.
// ============================================
const plainRow = (row) =>
  row && typeof row.get === "function" ? row.get({ plain: true }) : row || null;

const hallDetailsFor = async ({ customerId, hallId }) => {
  const hall = await Hall.findOne({
    where: { id: hallId, customer_id: customerId },
    attributes: [
      "id",
      "unit_id",
      "hall_name",
      "hall_number",
      "nominal_capacity",
      "altitude_above_sea",
      "hall_type_id",
      "construction_year",
      "operator_name",
      "is_active",
    ],
  });
  if (!hall) throw serviceError("hall_not_found", 404);

  const [physical, system, waterFeed, hygiene] = await Promise.all([
    HallPhysicalInfo.findOne({ where: { hall_id: hall.id } }),
    HallSystem.findOne({
      where: { hall_id: hall.id },
      include: [
        {
          model: HallSystemItem,
          attributes: hallDetailsWrite.SYSTEM_ITEM_ATTRIBUTES,
          required: false,
        },
      ],
    }),
    HallWaterFeed.findOne({ where: { hall_id: hall.id } }),
    HallHygiene.findOne({ where: { hall_id: hall.id } }),
  ]);

  const hallPlain = plainRow(hall);

  return {
    hall: {
      ...hallPlain,
      id: Number(hallPlain.id),
      unit_id: hallPlain.unit_id == null ? null : Number(hallPlain.unit_id),
    },
    details: {
      physical: plainRow(physical),
      system: plainRow(system),
      water_feed: plainRow(waterFeed),
      hygiene: plainRow(hygiene),
    },
    flags: {
      has_physical: Boolean(physical),
      has_system: Boolean(system),
      has_water_feed: Boolean(waterFeed),
      has_hygiene: Boolean(hygiene),
    },
  };
};

// ============================================
// ۱۱) جزئیات یک دوره (پیش‌پرکردن فرم هفته/ویرایش)  — ✅ ۱۳.۱۴
// ------------------------------------------------------------
//  🔒 مالکیت در همان کوئری (`customer_id`)؛ دورهٔ غیرخودی ⇒ ۴۰۴.
// ============================================
const placementDetailsFor = async ({ customerId, placementId }) => {
  const placement = await ChickPlacement.findOne({
    where: { id: placementId, customer_id: customerId },
    attributes: [
      "id",
      "unit_id",
      "hall_id",
      "placement_date",
      "flock_number",
      "chick_source_id",
      "breed_id",
      "chick_age_on_arrival",
      "avg_initial_weight",
      "total_chicks_count",
      "placement_density",
      "is_active",
    ],
  });
  if (!placement) throw serviceError("placement_not_found", 404);

  const weeklies = await WeeklyManagement.findAll({
    where: { chick_placement_id: placement.id },
    attributes: [
      "id",
      "week_number",
      "week_start_date",
      "week_end_date",
      "flock_age_days",
      "weekly_mortality",
      "weekly_weight",
      "is_active",
    ],
    order: [["week_number", "ASC"]],
  });

  const placementPlain = plainRow(placement);

  return {
    placement: {
      ...placementPlain,
      id: Number(placementPlain.id),
      unit_id:
        placementPlain.unit_id == null ? null : Number(placementPlain.unit_id),
      hall_id:
        placementPlain.hall_id == null ? null : Number(placementPlain.hall_id),
    },
    weeklies: weeklies.map((row) => {
      const plain = plainRow(row);
      return { ...plain, id: Number(plain.id) };
    }),
  };
};

// ============================================
// ۱۲) جزئیات یک هفتهٔ خودم (پیش‌پرکردن فرم ویرایش)  — ✅ ۱۳.۱۵
// ------------------------------------------------------------
//  چرا لازم شد؟
//   `placementDetailsFor` عمداً فقط ستون‌های سبک هفته را برمی‌گرداند
//   (فهرست هفته‌ها برای انتخاب). فرم «ویرایش هفته» به اعداد دان/خاموشی/
//   توضیحات و **پنج آرایهٔ شناسه** نیاز دارد؛ بدون این مسیر، مشتری باید
//   همهٔ مقادیر را دستی دوباره وارد کند (و `validateWeeklyData` هم
//   شمارهٔ هفته/تاریخ‌ها/تلفات/وزن را اجباری می‌داند).
//
//  🔒 مالکیت در همان کوئری (`customer_id`) سنجیده می‌شود ⇒ هفتهٔ
//  غیرخودی ۴۰۴ می‌گیرد و `customer_id` هرگز پارامتر نمی‌شود.
//  ✅ خواندن و شکل‌دهی از `services/farm/weeklyWrite` می‌آید
//  (`loadWeeklyRecord`/`formatWeeklyRecord`) — نسخهٔ دوم ساخته نشد.
// ============================================
const weeklyDetailsFor = async ({ customerId, weeklyId }) => {
  const row = await WeeklyManagement.findOne({
    where: { id: weeklyId, customer_id: customerId },
    include: weeklyWrite.WEEKLY_ITEM_GROUPS.map((group) => ({
      model: group.model,
      as: group.alias,
      attributes: [group.foreignKey],
    })),
  });
  if (!row) throw serviceError("weekly_not_found", 404);

  const record = weeklyWrite.formatWeeklyRecord(row);

  return {
    weekly: {
      ...record,
      id: Number(record.id),
      chick_placement_id:
        record.chick_placement_id == null
          ? null
          : Number(record.chick_placement_id),
    },
  };
};

module.exports = {
  approveRequest,
  cancelMyRequest,
  countsOf,
  createRequest,
  getRequest,
  hallDetailsFor,
  placementDetailsFor,
  // ✅ ۱۳.۱۵: جزئیات یک هفته (پیش‌پرکردن فرم ویرایش)
  weeklyDetailsFor,
  listMyRequests,
  listQueue,
  optionsFor,
  pendingCountOf,
  pendingQueueCount,
  rejectRequest,
};
