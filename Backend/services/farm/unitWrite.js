// ============================================================
// services/farm/unitWrite.js
// نوشتن «واحد مرغداری» — یک منبع برای کارشناس و پورتال (موج ۱۳.۱۲)
// ------------------------------------------------------------
//  این منطق پیش از ۱۳.۱۲ داخل controllers/unitController.js بود.
//  چرا منتقل شد؟ چون پورتال هم باید بتواند (پس از تأیید) واحد
//  بسازد/ویرایش/حذف کند؛ اگر منطق دو نسخه می‌شد، «نام خودکار
//  سالن‌ها» و «حذف آبشاری» در دو مسیر متفاوت عمل می‌کردند.
//
// 🔒 قواعد تغییرناپذیر (همان قواعد قبلی، فقط جای دیگری):
//   ۱) `unit_name` قبل از ذخیره trim می‌شود؛ نام سالن‌ها از روی همین
//      نام ساخته می‌شود: «سالن A - <نام واحد>».
//   ۲) با تغییر نام واحد، نام همهٔ سالن‌های زیرمجموعه بازتولید می‌شود
//      (ترتیب پایدار: شمارهٔ سالن → hall_order → id).
//   ۳) حذف واحد = حذف آبشاری کامل (هفتگی‌ها، گله‌ها، تجهیزات سالن،
//      بازدیدها، نشان‌ها) — بدون تغییر نسبت به نسخهٔ قبلی.
//   ۴) هیچ‌جای این فایل `customer_id` را از بدنهٔ خام نمی‌خواند؛
//      مالکیت ردیف در لایهٔ بالاتر (پورتال) بررسی می‌شود.
// ============================================================
"use strict";

const { Op } = require("sequelize");
const Unit = require("../../models/Unit");
const UnitStatus = require("../../models/UnitStatus");
const UnitExpert = require("../../models/UnitExpert");
const CustomerPersonalInfo = require("../../models/CustomerPersonalInfo");
const Hall = require("../../models/Hall");
const ChickPlacement = require("../../models/ChickPlacement");
const CropTest = require("../../models/CropTest");
const FlockCompletion = require("../../models/FlockCompletion");
const WeeklyManagement = require("../../models/WeeklyManagement");
const WeeklyDisease = require("../../models/WeeklyDisease");
const WeeklyVaccine = require("../../models/WeeklyVaccine");
const WeeklyMedicine = require("../../models/WeeklyMedicine");
const WeeklyFeed = require("../../models/WeeklyFeed");
const WeeklySuggestion = require("../../models/WeeklySuggestion");
const VisitReport = require("../../models/VisitReport");
const VisitReportHall = require("../../models/VisitReportHall");
const VisitReportExpert = require("../../models/VisitReportExpert");
const VisitReportAttachment = require("../../models/VisitReportAttachment");
const Bookmark = require("../../models/Bookmark");
const HallPhysicalInfo = require("../../models/HallPhysicalInfo");
const HallSystem = require("../../models/HallSystem");
const HallWaterFeed = require("../../models/HallWaterFeed");
const HallHygiene = require("../../models/HallHygiene");
const { validateUnitData } = require("../../validations/unitValidation");
const { fail, failValidation, throwIfUnique } = require("./writeErrors");
const { runInTransaction } = require("./transaction");

// فیلدهای قابل ویرایش واحد (فهرست سفید — همان فهرست قبلی کنترلر)
const UNIT_UPDATE_FIELDS = [
  "unit_name",
  "longitude",
  "latitude",
  "address",
  "hall_count",
  "capacity",
  "manager_name",
  "manager_phone",
  "is_active",
  "unit_status_id",
];

// نام خودکار سالن: «سالن A - <نام واحد>»
const autoHallName = (index, unitName) =>
  `سالن ${String.fromCharCode(65 + index)} - ${unitName}`;

// ترتیب پایدار سالن‌ها برای بازتولید نام (شمارهٔ عددی → hall_order → id)
const orderHallsForNaming = (halls = []) =>
  halls.slice().sort((a, b) => {
    const aNum = parseInt(a.hall_number, 10);
    const bNum = parseInt(b.hall_number, 10);
    const aHasNum = !Number.isNaN(aNum);
    const bHasNum = !Number.isNaN(bNum);
    if (aHasNum && bHasNum && aNum !== bNum) return aNum - bNum;
    if (aHasNum !== bHasNum) return aHasNum ? -1 : 1;
    const aOrder = a.hall_order || 0;
    const bOrder = b.hall_order || 0;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.id - b.id;
  });

// ============================================
// ایجاد واحد مرغداری
// ------------------------------------------------------------
//  خروجی: { unit, customer } — کنترلر پیام/شکل پاسخ را می‌سازد.
// ============================================
//  ✅ ۱۳.۱۳: پارامتر دوم `{ transaction }` است؛ اگر لایهٔ بالاتر تراکنش
//  بدهد (تأیید درخواست پورتال)، مرز تراکنش مال اوست و این‌جا commit
//  نمی‌شود. پیش‌فرض `null` ⇒ رفتار قبلی کنترلرها بدون تغییر.
const createUnit = async (body = {}, { transaction: existingTransaction = null } = {}) => {
  const validation = validateUnitData(body);
  if (!validation.isValid) {
    failValidation(validation, "اطلاعات واحد معتبر نیست");
  }

  const {
    customer_personal_information_id,
    unit_name,
    longitude,
    latitude,
    address,
    hall_count,
    capacity,
    manager_name,
    manager_phone,
    is_active,
    unit_status_id,
    experts = [],
  } = body;

  const customer = await CustomerPersonalInfo.findOne({
    where: { id: customer_personal_information_id, active: true },
  });
  if (!customer) fail("مشتری معتبر یافت نشد", 404);

  return runInTransaction(async (transaction) => {
    // وضعیت پیش‌فرض واحد: active (اگر ارسال نشده باشد)
    let finalStatusId = unit_status_id;
    if (!finalStatusId) {
      const activeStatus = await UnitStatus.findOne({
        where: { name: "active", active: true },
        transaction,
      });
      finalStatusId = activeStatus ? activeStatus.id : null;
    }

    const unit = await Unit.create(
      {
        customer_personal_information_id,
        unit_name,
        longitude: longitude || null,
        latitude: latitude || null,
        address: address || null,
        hall_count: hall_count || null,
        capacity: capacity !== undefined ? capacity : 0,
        manager_name: manager_name || null,
        manager_phone: manager_phone || null,
        is_active: is_active !== undefined ? is_active : true,
        unit_status_id: finalStatusId,
      },
      { transaction },
    );

    // کارشناسان واحد (اختیاری)
    if (Array.isArray(experts) && experts.length > 0) {
      const expertRecords = experts.map((expert) => ({
        unit_id: unit.id,
        expert_name: expert.expert_name,
        expert_phone: expert.expert_phone || null,
        expert_role: expert.expert_role || null,
        is_active: expert.is_active !== undefined ? expert.is_active : true,
      }));
      await UnitExpert.bulkCreate(expertRecords, { transaction });
    }

    return { unit, customer };
  }, existingTransaction);
};

// ============================================
// بروزرسانی واحد
// ------------------------------------------------------------
//  خروجی: { unit, renamedHalls, unitNameChanged }
//  ⚠️ این تابع (مثل قبل) اعتبارسنجی کامل واحد را اجرا نمی‌کند؛ فقط
//     وجود وضعیت ارسالی را بررسی می‌کند — رفتار قبلی حفظ می‌شود.
// ============================================
const updateUnit = async (
  unitId,
  body = {},
  { transaction: existingTransaction = null } = {},
) => {
  try {
    return await runInTransaction(async (transaction) => {
      const unit = await Unit.findByPk(unitId, { transaction });
      if (!unit) fail("واحد یافت نشد", 404);

      const updateData = {};
      for (const field of UNIT_UPDATE_FIELDS) {
        if (body[field] !== undefined) updateData[field] = body[field];
      }

      // نام واحد همیشه trim می‌شود (منبع نام خودکار سالن‌ها)
      const trimmedName =
        updateData.unit_name !== undefined
          ? String(updateData.unit_name).trim()
          : null;
      if (trimmedName !== null) updateData.unit_name = trimmedName;

      if (updateData.unit_status_id) {
        const status = await UnitStatus.findByPk(updateData.unit_status_id, {
          transaction,
        });
        if (!status) fail("وضعیت واحد معتبر نیست", 400);
      }

      const unitNameChanged =
        trimmedName !== null &&
        trimmedName !== "" &&
        trimmedName !== unit.unit_name;

      await unit.update(updateData, { transaction });

      // بازتولید نام سالن‌ها با نام جدید واحد
      let renamedHalls = 0;
      if (unitNameChanged) {
        const halls = await Hall.findAll({
          where: { unit_id: unit.id },
          transaction,
        });

        const orderedHalls = orderHallsForNaming(halls);
        for (let i = 0; i < orderedHalls.length; i++) {
          const newHallName = autoHallName(i, trimmedName);
          if (orderedHalls[i].hall_name !== newHallName) {
            await orderedHalls[i].update(
              { hall_name: newHallName },
              { transaction },
            );
            renamedHalls += 1;
          }
        }
      }

      return { unit, renamedHalls, unitNameChanged };
    }, existingTransaction);
  } catch (error) {
    throwIfUnique(
      error,
      "این نام واحد برای این مشتری قبلاً ثبت شده است",
      400,
    );
    throw error;
  }
};

// ============================================
// حذف واحد با حذف آبشاری کامل
// ------------------------------------------------------------
//  همهٔ سالن‌ها، گله‌ها، اطلاعات هفتگی، تجهیزات سالن، بازدیدها و
//  نشان‌های مرتبط حذف می‌شوند. ترتیب حذف مهم است (وابستگی‌ها اول).
//  خروجی: { unitId }
// ============================================
const deleteUnit = async (
  unitId,
  { transaction: existingTransaction = null } = {},
) =>
  runInTransaction(async (transaction) => {
    // ⚠️ ۱۳.۱۳: findByPk حتماً با تراکنش جاری (قبلاً بدون تراکنش بود ⇒
    // وقتی این تابع داخل تراکنش تأیید پورتال اجرا می‌شد، ردیف بیرون از
    // تراکنش خوانده می‌شد و قفل ردیف بی‌اثر بود).
    const unit = await Unit.findByPk(unitId, { transaction });
    if (!unit) fail("واحد یافت نشد", 404);

    // 1️⃣ سالن‌های واحد (شامل حذف‌شده‌ها)
    const halls = await Hall.findAll({
      where: { unit_id: unitId },
      attributes: ["id"],
      paranoid: false,
      transaction,
    });
    const hallIds = halls.map((h) => h.id);

    // 2️⃣ گله‌های واحد (از طریق سالن‌ها یا unit_id)
    const flocks = await ChickPlacement.findAll({
      where: {
        [Op.or]: [
          { unit_id: unitId },
          ...(hallIds.length > 0 ? [{ hall_id: { [Op.in]: hallIds } }] : []),
        ],
      },
      attributes: ["id"],
      transaction,
    });
    const flockIds = flocks.map((f) => f.id);

    // 3️⃣ گزارش‌های بازدید (همراه وابستگی‌ها)
    const visitIds = await VisitReport.findAll({
      where: { unit_id: unitId },
      attributes: ["id"],
      transaction,
    });
    const visitIdList = visitIds.map((v) => v.id);

    if (visitIdList.length > 0) {
      await VisitReportAttachment.destroy({
        where: { visit_report_id: { [Op.in]: visitIdList } },
        transaction,
      });
      await VisitReportHall.destroy({
        where: { visit_report_id: { [Op.in]: visitIdList } },
        transaction,
      });
      await VisitReportExpert.destroy({
        where: { visit_report_id: { [Op.in]: visitIdList } },
        transaction,
      });
      await VisitReport.destroy({
        where: { id: { [Op.in]: visitIdList } },
        transaction,
      });
    }

    // 4️⃣ نشان‌ها (واحد + گله‌ها)
    if (flockIds.length > 0) {
      await Bookmark.destroy({
        where: {
          [Op.or]: [{ unit_id: unitId }, { flock_id: { [Op.in]: flockIds } }],
        },
        transaction,
      });
    } else {
      await Bookmark.destroy({ where: { unit_id: unitId }, transaction });
    }

    // 5️⃣ اطلاعات هفتگی هر گله (مدیریت + زیرمجموعه‌ها)
    if (flockIds.length > 0) {
      const weeklyIds = await WeeklyManagement.findAll({
        where: { chick_placement_id: { [Op.in]: flockIds } },
        attributes: ["id"],
        transaction,
      });
      const weeklyIdList = weeklyIds.map((w) => w.id);

      if (weeklyIdList.length > 0) {
        await WeeklyDisease.destroy({
          where: { weekly_management_id: { [Op.in]: weeklyIdList } },
          transaction,
        });
        await WeeklyVaccine.destroy({
          where: { weekly_management_id: { [Op.in]: weeklyIdList } },
          transaction,
        });
        await WeeklyMedicine.destroy({
          where: { weekly_management_id: { [Op.in]: weeklyIdList } },
          transaction,
        });
        await WeeklyFeed.destroy({
          where: { weekly_management_id: { [Op.in]: weeklyIdList } },
          transaction,
        });
        await WeeklySuggestion.destroy({
          where: { weekly_management_id: { [Op.in]: weeklyIdList } },
          transaction,
        });
        await WeeklyManagement.destroy({
          where: { id: { [Op.in]: weeklyIdList } },
          transaction,
        });
      }
    }

    // 6️⃣ تکمیل گله و تست چین‌دان
    if (flockIds.length > 0) {
      await FlockCompletion.destroy({
        where: { chick_placement_id: { [Op.in]: flockIds } },
        transaction,
      });
      await CropTest.destroy({
        where: { chick_placement_id: { [Op.in]: flockIds } },
        transaction,
      });
    }
    if (hallIds.length > 0) {
      await CropTest.destroy({
        where: { hall_id: { [Op.in]: hallIds } },
        transaction,
      });
    }
    await CropTest.destroy({ where: { unit_id: unitId }, transaction });

    // 7️⃣ گله‌ها
    if (flockIds.length > 0) {
      await ChickPlacement.destroy({
        where: { id: { [Op.in]: flockIds } },
        transaction,
      });
    }

    // 8️⃣ تجهیزات و اطلاعات تکمیلی سالن‌ها
    if (hallIds.length > 0) {
      await HallPhysicalInfo.destroy({
        where: { hall_id: { [Op.in]: hallIds } },
        transaction,
      });
      await HallSystem.destroy({
        where: { hall_id: { [Op.in]: hallIds } },
        transaction,
      });
      await HallWaterFeed.destroy({
        where: { hall_id: { [Op.in]: hallIds } },
        transaction,
      });
      await HallHygiene.destroy({
        where: { hall_id: { [Op.in]: hallIds } },
        transaction,
      });

      // 9️⃣ سالن‌ها (حذف فیزیکی)
      await Hall.destroy({
        where: { id: { [Op.in]: hallIds } },
        force: true,
        transaction,
      });
    }

    // 🔟 کارشناسان واحد
    await UnitExpert.destroy({
      where: { unit_id: unitId },
      force: true,
      transaction,
    });

    // 1️⃣1️⃣ خود واحد (حذف فیزیکی)
    await unit.destroy({ force: true, transaction });

    return { unitId: unit.id };
  }, existingTransaction);

// ============================================
// صادرات
// ------------------------------------------------------------
//  `autoHallName` و `UNIT_UPDATE_FIELDS` صادر می‌شوند تا لایهٔ پورتال
//  و تست‌ها همان قاعدهٔ نام‌گذاری/فهرست سفید را بدون نسخهٔ دوم ببینند.
// ============================================
module.exports = {
  UNIT_UPDATE_FIELDS,
  autoHallName,
  orderHallsForNaming,
  createUnit,
  updateUnit,
  deleteUnit,
};
