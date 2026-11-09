// ============================================================
// services/flockResolver.js
// «کدام گله؟» — یک منبع حقیقت برای ثبت جوجه‌ریزی   (موج ۱۳.۱۱)
// ------------------------------------------------------------
//  چرا استخراج شد؟
//   تا ۱۳.۱۰ سه تابع (شمارهٔ گله بعدی، ساخت گله، حل گله) **داخل**
//   controllers/chickPlacementController.js بودند. موج ۱۳.۱۱ دو
//   مسیر نوشتن دارد:
//     ۱) کارشناس از ماژول جوجه‌ریزی (chickPlacementController)
//     ۲) تأیید درخواست مشتری در پورتال (portalRequestService)
//   اگر منطق «گلهٔ فعال / گلهٔ جدید / گلهٔ انتخابی» دو نسخه می‌شد،
//   دو مسیر می‌توانستند جوجه‌ریزی را به دو گلهٔ متفاوت بچسبانند.
//   اکنون هر دو از همین فایل استفاده می‌کنند.
//
//  🔒 قواعد (بدون تغییر نسبت به نسخهٔ قبلی در کنترلر):
//   ۱) شمارهٔ گله = بیشترین شمارهٔ همان (مشتری، واحد) + ۱
//   ۲) گلهٔ انتخابی باید مالِ همان مشتری، همان واحد و فعال باشد
//   ۳) بدون انتخاب صریح: جدیدترین گلهٔ فعالِ دارای حداقل یک سالن
//      فعال؛ وگرنه گلهٔ تازه ساخته می‌شود
//   ۴) همهٔ کوئری‌ها تراکنش را پاس می‌دهند (فراخوان تعیین می‌کند)
// ============================================================
"use strict";

const Flock = require("../models/Flock");
const ChickPlacement = require("../models/ChickPlacement");

// ============================================
// محاسبه شماره بعدی گله برای (مشتری + واحد)
// ============================================
const getNextFlockNumber = async (customer_id, unit_id, transaction = null) => {
  const last = await Flock.findOne({
    where: { customer_id, unit_id },
    order: [["flock_number", "DESC"]],
    attributes: ["flock_number"],
    transaction,
  });
  return (last ? parseInt(last.flock_number) : 0) + 1;
};

// ============================================
// ساخت رکورد گله جدید
// ============================================
const createFlockRecord = async (
  customer_id,
  unit_id,
  placement_date,
  transaction = null,
) => {
  const nextNumber = await getNextFlockNumber(customer_id, unit_id, transaction);
  return Flock.create(
    {
      customer_id,
      unit_id,
      flock_number: nextNumber,
      placement_date,
      status: "active",
    },
    { transaction },
  );
};

// ============================================
// تعیین گله برای یک جوجه‌ریزی
// (انتخاب صریح: پیوستن به گله مشخص / شروع گله جدید / پیش‌فرض امن)
// ============================================
const resolveFlock = async ({
  customer_id,
  unit_id,
  placement_date,
  flock_id,
  start_new_flock,
  transaction = null,
}) => {
  // ۱) شروع صریح گله جدید (کنار گله‌های فعال موجود)
  if (start_new_flock) {
    return createFlockRecord(customer_id, unit_id, placement_date, transaction);
  }

  // ۲) اگر گله مشخص شده، بررسی اعتبار آن
  if (flock_id) {
    const flock = await Flock.findOne({
      where: { id: flock_id, customer_id },
      transaction,
    });
    if (!flock) {
      const err = new Error("گله یافت نشد");
      err.status = 404;
      throw err;
    }
    if (parseInt(flock.unit_id) !== parseInt(unit_id)) {
      const err = new Error("گله متعلق به این واحد نیست");
      err.status = 400;
      throw err;
    }
    if (flock.status !== "active") {
      const err = new Error("گله مورد نظر فعال نیست");
      err.status = 400;
      throw err;
    }
    return flock;
  }

  // ۳) بدون انتخاب صریح: پیوستن به جدیدترین گله فعالِ دارای حداقل یک سالن فعال؛
  //    وگرنه ساخت گله جدید. (گله‌های فعالِ بی‌سالن بسته نمی‌شوند — پایان صریح دارند)
  const activeFlocks = await Flock.findAll({
    where: { customer_id, unit_id, status: "active" },
    order: [["placement_date", "DESC"]],
    transaction,
  });
  for (const f of activeFlocks) {
    const activeCnt = await ChickPlacement.count({
      where: { flock_id: f.id, is_active: true },
      transaction,
    });
    if (activeCnt > 0) return f;
  }

  // ۴) ساخت گله جدید
  return createFlockRecord(customer_id, unit_id, placement_date, transaction);
};

module.exports = {
  getNextFlockNumber,
  createFlockRecord,
  resolveFlock,
};
