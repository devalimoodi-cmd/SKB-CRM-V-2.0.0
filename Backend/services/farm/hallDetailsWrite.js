// ============================================================
// services/farm/hallDetailsWrite.js
// نوشتن «اطلاعات تکمیلی سالن» — موج ۱۳.۱۲
// ------------------------------------------------------------
//  چهار حوزهٔ مستقل، همه با قاعدهٔ «upsert» (یکی برای هر سالن):
//    ۱) اطلاعات فیزیکی  (hall_physical_info)
//    ۲) سیستم‌ها        (hall_systems + hall_system_items)
//    ۳) آب‌خوری/دان‌خوری (hall_water_feed)
//    ۴) بهداشت          (hall_hygiene)
//  منطق پیش از ۱۳.۱۲ در چهار کنترلر جدا بود
//  (hallPhysicalInfoController, hallSystemController,
//   hallWaterFeedController, hallHygieneController) و پورتال هیچ
//  راهی برای نوشتن آن‌ها نداشت. اکنون هر دو مسیر از همین‌جا می‌گذرند.
//
// 🔒 قواعد تغییرناپذیر:
//   ۱) هر «ذخیره» = یک تراکنش؛ اگر جایگزینی ردیف‌های تجهیزات شکست
//      بخورد، ردیف قبلی هم برنمی‌گردد به حالت نیمه‌کاره.
//   ۲) هیچ فیلدی از بدنه بدون فهرست سفید نوشته نمی‌شود؛ آرایهٔ items
//      با همان قاعدهٔ قبلی (دستهٔ خالی ⇒ حذف ردیف) پاک‌سازی می‌شود.
//   ۳) `created` در خروجی نگه داشته می‌شود تا کد وضعیت (۲۰۱/۲۰۰) مثل
//      قبل ساخته شود.
// ============================================================
"use strict";

const Hall = require("../../models/Hall");
const HallPhysicalInfo = require("../../models/HallPhysicalInfo");
const HallSystem = require("../../models/HallSystem");
const HallSystemItem = require("../../models/HallSystemItem");
const HallWaterFeed = require("../../models/HallWaterFeed");
const HallHygiene = require("../../models/HallHygiene");
const { fail } = require("./writeErrors");
const { runInTransaction } = require("./transaction");

// دسته‌های مجاز تجهیزات (برای اعتبارسنجی پورتال هم استفاده می‌شود)
const SYSTEM_ITEM_CATEGORIES = [
  "heating",
  "cooling",
  "ventilation",
  "fan",
  "sanitary",
  "lighting",
];

const SYSTEM_ITEM_ATTRIBUTES = [
  "id",
  "category",
  "type_id",
  "quantity",
  "spec",
  "size",
  "capacity",
];

// سالن باید وجود داشته باشد (پیام‌های قبلی، بدون تغییر)
const requireHall = async (hallId, transaction = null) => {
  if (!hallId) fail("شناسه سالن الزامی است", 400);
  const hall = await Hall.findByPk(hallId, { transaction });
  if (!hall) fail("سالن یافت نشد", 404);
  return hall;
};

// پاک‌سازی ردیف‌های تجهیزات (همان قاعدهٔ قبلی کنترلر)
const normalizeItems = (items = []) =>
  (Array.isArray(items) ? items : [])
    .map((it) => {
      const category = String((it && it.category) || "").trim();
      if (!category) return null;
      return {
        category,
        type_id: it.type_id ? parseInt(it.type_id) : null,
        quantity: Math.max(1, parseInt(it.quantity) || 1),
        spec: it.spec
          ? String(it.spec).trim()
          : it.size
            ? String(it.size).trim()
            : null,
        size: it.size ? String(it.size).trim() : null,
        capacity: it.capacity ? String(it.capacity).trim() : null,
      };
    })
    .filter(Boolean);

// ============================================
// ۱) اطلاعات فیزیکی سالن (upsert)
// ------------------------------------------------------------
//  خروجی: { record, created }
// ============================================
//  ✅ ۱۳.۱۳: `{ transaction }` اختیاری — تأیید درخواست پورتال یک تراکنش
//  واحد دارد و این توابع نباید مرز تراکنش بسازند. `requireHall` هم با
//  همان تراکنش می‌خواند تا قفل/دیدِ یکسان بماند.
const savePhysicalInfo = async (
  body = {},
  { transaction: existingTransaction = null } = {},
) => {
  const {
    hall_id,
    unit_id,
    length,
    width,
    height,
    area,
    floor_type_id,
    notes,
  } = body;

  const hall = await requireHall(hall_id, existingTransaction);

  return runInTransaction(async (transaction) => {
    const existing = await HallPhysicalInfo.findOne({
      where: { hall_id },
      transaction,
    });

    if (existing) {
      await existing.update(
        {
          unit_id: unit_id !== undefined ? unit_id : existing.unit_id,
          length: length !== undefined ? length : existing.length,
          width: width !== undefined ? width : existing.width,
          height: height !== undefined ? height : existing.height,
          area: area !== undefined ? area : existing.area,
          floor_type_id:
            floor_type_id !== undefined ? floor_type_id : existing.floor_type_id,
          notes: notes !== undefined ? notes : existing.notes,
        },
        { transaction },
      );
      return { record: existing, created: false, hall };
    }

    const created = await HallPhysicalInfo.create(
      {
        hall_id,
        unit_id: unit_id || hall.unit_id || null,
        length: length || null,
        width: width || null,
        height: height || null,
        area: area || null,
        floor_type_id: floor_type_id || null,
        notes: notes || null,
      },
      { transaction },
    );

    return { record: created, created: true, hall };
  }, existingTransaction);
};

// ============================================
// ۲) سیستم‌های سالن (+ ردیف‌های تجهیزات)
// ------------------------------------------------------------
//  خروجی: { record, created } — record با items همراه است
// ============================================
const saveSystem = async (
  body = {},
  { transaction: existingTransaction = null } = {},
) => {
  const {
    hall_id,
    unit_id,
    fan_count,
    fan_size,
    fan_capacity,
    heater_count,
    heating_system_id,
    cooling_system_id,
    ventilation_system_id,
    water_inlet_system_id,
    lighting_system_id,
    notes,
    items,
  } = body;

  const hall = await requireHall(hall_id, existingTransaction);

  return runInTransaction(async (transaction) => {
    let system = await HallSystem.findOne({ where: { hall_id }, transaction });
    const created = !system;

    if (!system) {
      system = await HallSystem.create(
        { hall_id, unit_id: unit_id || hall.unit_id || null },
        { transaction },
      );
    }

    await system.update(
      {
        unit_id: unit_id !== undefined ? unit_id : system.unit_id,
        fan_count: fan_count !== undefined ? fan_count : system.fan_count,
        fan_size: fan_size !== undefined ? fan_size : system.fan_size,
        fan_capacity:
          fan_capacity !== undefined ? fan_capacity : system.fan_capacity,
        heater_count:
          heater_count !== undefined ? heater_count : system.heater_count,
        heating_system_id:
          heating_system_id !== undefined
            ? heating_system_id
            : system.heating_system_id,
        cooling_system_id:
          cooling_system_id !== undefined
            ? cooling_system_id
            : system.cooling_system_id,
        ventilation_system_id:
          ventilation_system_id !== undefined
            ? ventilation_system_id
            : system.ventilation_system_id,
        water_inlet_system_id:
          water_inlet_system_id !== undefined
            ? water_inlet_system_id
            : system.water_inlet_system_id,
        lighting_system_id:
          lighting_system_id !== undefined
            ? lighting_system_id
            : system.lighting_system_id,
        notes: notes !== undefined ? notes : system.notes,
      },
      { transaction },
    );

    // ردیف‌های تجهیزات: جایگزینی کامل (فقط اگر آرایه ارسال شده باشد)
    if (Array.isArray(items)) {
      await HallSystemItem.destroy({
        where: { system_id: system.id },
        transaction,
      });
      const rows = normalizeItems(items).map((row) => ({
        ...row,
        system_id: system.id,
      }));
      if (rows.length) await HallSystemItem.bulkCreate(rows, { transaction });
    }

    const record = await HallSystem.findOne({
      where: { id: system.id },
      include: [
        {
          model: HallSystemItem,
          attributes: SYSTEM_ITEM_ATTRIBUTES,
          required: false,
        },
      ],
      transaction,
    });

    return { record, created, hall };
  }, existingTransaction);
};

// ============================================
// ۳) آب‌خوری و دان‌خوری سالن (upsert)
// ------------------------------------------------------------
//  خروجی: { record, created }
// ============================================
const saveWaterFeed = async (
  body = {},
  { transaction: existingTransaction = null } = {},
) => {
  const {
    hall_id,
    unit_id,
    waterer_type_id,
    feeder_type_id,
    water_lines_count,
    feed_lines_count,
    auto_feed_system,
    notes,
  } = body;

  const hall = await requireHall(hall_id, existingTransaction);

  return runInTransaction(async (transaction) => {
    const existing = await HallWaterFeed.findOne({
      where: { hall_id },
      transaction,
    });

    if (existing) {
      await existing.update(
        {
          unit_id: unit_id !== undefined ? unit_id : existing.unit_id,
          waterer_type_id:
            waterer_type_id !== undefined
              ? waterer_type_id
              : existing.waterer_type_id,
          feeder_type_id:
            feeder_type_id !== undefined
              ? feeder_type_id
              : existing.feeder_type_id,
          water_lines_count:
            water_lines_count !== undefined
              ? water_lines_count
              : existing.water_lines_count,
          feed_lines_count:
            feed_lines_count !== undefined
              ? feed_lines_count
              : existing.feed_lines_count,
          auto_feed_system:
            auto_feed_system !== undefined
              ? auto_feed_system
              : existing.auto_feed_system,
          notes: notes !== undefined ? notes : existing.notes,
        },
        { transaction },
      );
      return { record: existing, created: false, hall };
    }

    const created = await HallWaterFeed.create(
      {
        hall_id,
        unit_id: unit_id || hall.unit_id || null,
        waterer_type_id: waterer_type_id || null,
        feeder_type_id: feeder_type_id || null,
        water_lines_count: water_lines_count || null,
        feed_lines_count: feed_lines_count || null,
        auto_feed_system: auto_feed_system || false,
        notes: notes || null,
      },
      { transaction },
    );

    return { record: created, created: true, hall };
  }, existingTransaction);
};

// ============================================
// ۴) بهداشت و ضدعفونی سالن (upsert)
// ------------------------------------------------------------
//  خروجی: { record, created }
//  ⚠️ `customer_id` از خود ردیف سالن تکمیل می‌شود (ستون اجباری است).
// ============================================
const saveHygiene = async (
  body = {},
  { transaction: existingTransaction = null } = {},
) => {
  const {
    hall_id,
    customer_id,
    unit_id,
    last_wash_date,
    last_disinfect_date,
    disinfectant_type,
    description,
  } = body;

  const hall = await requireHall(hall_id, existingTransaction);

  return runInTransaction(async (transaction) => {
    const existing = await HallHygiene.findOne({
      where: { hall_id },
      transaction,
    });

    if (existing) {
      await existing.update(
        {
          unit_id: unit_id !== undefined ? unit_id : existing.unit_id,
          last_wash_date:
            last_wash_date !== undefined
              ? last_wash_date
              : existing.last_wash_date,
          last_disinfect_date:
            last_disinfect_date !== undefined
              ? last_disinfect_date
              : existing.last_disinfect_date,
          disinfectant_type:
            disinfectant_type !== undefined
              ? disinfectant_type
              : existing.disinfectant_type,
          description:
            description !== undefined ? description : existing.description,
          updated_at: new Date(),
        },
        { transaction },
      );
      return { record: existing, created: false, hall };
    }

    const created = await HallHygiene.create(
      {
        hall_id,
        customer_id: customer_id || hall.customer_id,
        unit_id: unit_id || hall.unit_id || null,
        last_wash_date: last_wash_date || null,
        last_disinfect_date: last_disinfect_date || null,
        disinfectant_type: disinfectant_type || null,
        description: description || null,
      },
      { transaction },
    );

    return { record: created, created: true, hall };
  }, existingTransaction);
};

// ============================================
// صادرات
// ============================================
module.exports = {
  SYSTEM_ITEM_CATEGORIES,
  SYSTEM_ITEM_ATTRIBUTES,
  requireHall,
  normalizeItems,
  savePhysicalInfo,
  saveSystem,
  saveWaterFeed,
  saveHygiene,
};


