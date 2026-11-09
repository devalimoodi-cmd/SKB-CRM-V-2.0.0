// ============================================================
//  تست «هستهٔ نوشتن فارم» — موج ۱۳.۱۲   (بدون دیتابیس)
// ------------------------------------------------------------
//  چه چیزی را ثابت می‌کند؟
//   ۱) پنج سرویس نوشتن (واحد/سالن/جزئیات سالن/جوجه‌ریزی/هفتگی)
//      با سطح عمومی مورد انتظار موجودند.
//   ۲) خطای نوشتن یک شکل دارد (پیام فارسی + status + errors + code).
//   ۳) اعتبارسنجی اطلاعات تکمیلی سالن خالص و بدون دیتابیس اجرا می‌شود.
//   ۴) «یک منبع»: هیچ کنترلر کارشناسی منطق نوشتن محلی ندارد و همه از
//      services/farm/* می‌گذرند.
//   ۵) فهرست‌های سفید ویرایش، ستون‌های خطرناک (customer_id/id) را
//      راه نمی‌دهند.
//   ۶) قواعد خالص نام‌گذاری سالن و پاک‌سازی تجهیزات درست کار می‌کنند.
//   ۷) runInTransaction با تراکنشِ داده‌شده، commit/rollback نمی‌کند.
//
//  اجرا:  node farm-write-test.mjs      (در پوشهٔ Backend)
//         یا  npm run test:farm-write
// ============================================================
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const here = import.meta.dirname;

const results = [];
const check = (name, ok, extra = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}${extra ? " :: " + extra : ""}`);
};

const writeErrors = require("./services/farm/writeErrors.js");
const transaction = require("./services/farm/transaction.js");
const unitWrite = require("./services/farm/unitWrite.js");
const hallWrite = require("./services/farm/hallWrite.js");
const hallDetailsWrite = require("./services/farm/hallDetailsWrite.js");
const placementWrite = require("./services/farm/placementWrite.js");
const weeklyWrite = require("./services/farm/weeklyWrite.js");
const hallDetailValidation = require("./validations/hallDetailValidation.js");

const readSource = (relative) =>
  fs.readFileSync(path.join(here, relative), "utf8");

// ============================================================
// ۱) سطح عمومی سرویس‌ها
// ============================================================
const expectFunctions = (module, names) =>
  names.every((name) => typeof module[name] === "function");

check(
  "unitWrite: ایجاد/ویرایش/حذف واحد",
  expectFunctions(unitWrite, ["createUnit", "updateUnit", "deleteUnit"]),
);

check(
  "hallWrite: ایجاد/ویرایش/حذف سالن + همگام‌سازی تعداد",
  expectFunctions(hallWrite, [
    "createHall",
    "updateHall",
    "deleteHall",
    "syncUnitHallCount",
    "nextHallNumber",
    "nextHallOrder",
  ]),
);

check(
  "hallDetailsWrite: چهار حوزهٔ اطلاعات تکمیلی سالن",
  expectFunctions(hallDetailsWrite, [
    "savePhysicalInfo",
    "saveSystem",
    "saveWaterFeed",
    "saveHygiene",
    "requireHall",
    "normalizeItems",
  ]),
);

check(
  "placementWrite: چرخهٔ کامل جوجه‌ریزی و گله",
  expectFunctions(placementWrite, [
    "createPlacement",
    "updatePlacement",
    "deletePlacement",
    "deleteFlockGroup",
    "activatePlacement",
    "deactivatePlacement",
  ]),
);

check(
  "weeklyWrite: چرخهٔ هفته + قواعد ترتیب/تکرار",
  expectFunctions(weeklyWrite, [
    "createWeekly",
    "updateWeekly",
    "deleteWeekly",
    "checkFlockIsActive",
    "checkDuplicateWeek",
    "checkWeekOrder",
    "saveMultipleItems",
    "formatWeeklyRecord",
  ]),
);

// ============================================================
// ۲) خطای یکدست نوشتن
// ============================================================
const err = new writeErrors.FarmWriteError("پیام تست", 409, ["e1"], "dup");
check(
  "FarmWriteError: پیام/کد وضعیت/خطاها/کد را نگه می‌دارد",
  err instanceof Error &&
    err.message === "پیام تست" &&
    err.status === 409 &&
    Array.isArray(err.errors) &&
    err.errors[0] === "e1" &&
    err.code === "dup" &&
    err.name === "FarmWriteError",
);

check(
  "isFarmWriteError فقط خطای خودمان را تأیید می‌کند",
  writeErrors.isFarmWriteError(err) === true &&
    writeErrors.isFarmWriteError(new Error("x")) === false,
);

check(
  "httpErrorOf: خطای شناخته‌شده ⇒ همان پیام، ناشناخته ⇒ ۵۰۰",
  (() => {
    const known = writeErrors.httpErrorOf(err, "fallback");
    const unknown = writeErrors.httpErrorOf(new Error("boom"), "fallback");
    return (
      known.status === 409 &&
      known.message === "پیام تست" &&
      unknown.status === 500 &&
      unknown.errors === null
    );
  })(),
);

check(
  "failValidation: اولین پیام اعتبارسنجی و فهرست کامل را برمی‌گرداند",
  (() => {
    try {
      writeErrors.failValidation(
        { isValid: false, errors: ["خطای اول", "خطای دوم"] },
        "fallback",
      );
      return false;
    } catch (error) {
      return (
        error.status === 400 &&
        error.message === "خطای اول" &&
        error.errors.length === 2 &&
        error.code === "validation_failed"
      );
    }
  })(),
);

check(
  "throwIfUnique: خطای یونیک ⇒ پیام فارسی؛ بقیه خطاها رد می‌شوند",
  (() => {
    let uniqueStatus = null;
    try {
      writeErrors.throwIfUnique(
        { name: "SequelizeUniqueConstraintError" },
        "تکراری است",
        409,
      );
    } catch (error) {
      uniqueStatus = error.status;
    }
    let otherPassed = true;
    try {
      writeErrors.throwIfUnique(new Error("other"), "تکراری است", 409);
    } catch {
      otherPassed = false;
    }
    return uniqueStatus === 409 && otherPassed === true;
  })(),
);

// ============================================================
// ۳) اعتبارسنجی اطلاعات تکمیلی سالن (خالص)
// ============================================================
check(
  "فهرست دستهٔ تجهیزات یک منبع است (اعتبارسنجی = نوشتن)",
  hallDetailValidation.SYSTEM_ITEM_CATEGORIES.join(",") ===
    hallDetailsWrite.SYSTEM_ITEM_CATEGORIES.join(",") &&
    hallDetailValidation.SYSTEM_ITEM_CATEGORIES.length === 6,
  hallDetailValidation.SYSTEM_ITEM_CATEGORIES.join(","),
);

check(
  "اطلاعات فیزیکی: بدون شناسهٔ سالن رد، با مقادیر درست پذیرفته می‌شود",
  hallDetailValidation.validateHallPhysical({}).isValid === false &&
    hallDetailValidation.validateHallPhysical({
      hall_id: 5,
      length: 120,
      width: 14,
      height: 3,
    }).isValid === true,
);

check(
  "اطلاعات فیزیکی: طول منفی/متنی رد می‌شود",
  hallDetailValidation.validateHallPhysical({ hall_id: 5, length: -3 })
    .isValid === false &&
    hallDetailValidation.validateHallPhysical({ hall_id: 5, length: "abc" })
      .isValid === false,
);

check(
  "سیستم‌ها: دستهٔ ناشناخته در تجهیزات رد، دستهٔ مجاز پذیرفته می‌شود",
  hallDetailValidation.validateHallSystem({
    hall_id: 2,
    items: [{ category: "rocket", quantity: 1 }],
  }).isValid === false &&
    hallDetailValidation.validateHallSystem({
      hall_id: 2,
      items: [{ category: "fan", quantity: 4, size: "36" }],
    }).isValid === true,
);

check(
  "سیستم‌ها: تعداد فن/هیتر در بازهٔ مجاز است",
  hallDetailValidation.validateHallSystem({ hall_id: 2, fan_count: 501 })
    .isValid === false &&
    hallDetailValidation.validateHallSystem({ hall_id: 2, fan_count: 12 })
      .isValid === true,
);

check(
  "آب و دان: تعداد خطوط در بازهٔ ۰..۲۰۰",
  hallDetailValidation.validateHallWaterFeed({
    hall_id: 3,
    water_lines_count: 201,
  }).isValid === false &&
    hallDetailValidation.validateHallWaterFeed({
      hall_id: 3,
      water_lines_count: 6,
      auto_feed_system: true,
    }).isValid === true,
);

check(
  "بهداشت: تاریخ فقط YYYY-MM-DD",
  hallDetailValidation.validateHallHygiene({
    hall_id: 4,
    last_wash_date: "۱۴۰۴/۰۹/۱۲",
  }).isValid === false &&
    hallDetailValidation.validateHallHygiene({
      hall_id: 4,
      last_wash_date: "2026-01-01",
      disinfectant_type: "ویرکون",
    }).isValid === true,
);

check(
  "نگاشت نوع درخواست ⇒ اعتبارسنج/فهرست سفید برای چهار حوزه",
  Object.keys(hallDetailValidation.HALL_DETAIL_VALIDATORS).join(",") ===
    "hall_physical_save,hall_system_save,hall_water_feed_save,hall_hygiene_save" &&
    Object.keys(hallDetailValidation.HALL_DETAIL_FIELDS).length === 4,
);

// ============================================================
// ۴) «یک منبع»: کنترلرها منطق نوشتن محلی ندارند
// ============================================================
const controllerSources = {
  unit: readSource("controllers/unitController.js"),
  hall: readSource("controllers/hallController.js"),
  hallSystem: readSource("controllers/hallSystemController.js"),
  hallPhysical: readSource("controllers/hallPhysicalInfoController.js"),
  hallWaterFeed: readSource("controllers/hallWaterFeedController.js"),
  hallHygiene: readSource("controllers/hallHygieneController.js"),
  placement: readSource("controllers/chickPlacementController.js"),
  weekly: readSource("controllers/weeklyController.js"),
};

check(
  "همهٔ کنترلرهای نوشتن از services/farm/* استفاده می‌کنند",
  /services\/farm\/unitWrite/.test(controllerSources.unit) &&
    /services\/farm\/hallWrite/.test(controllerSources.hall) &&
    /services\/farm\/hallDetailsWrite/.test(controllerSources.hallSystem) &&
    /services\/farm\/hallDetailsWrite/.test(controllerSources.hallPhysical) &&
    /services\/farm\/hallDetailsWrite/.test(controllerSources.hallWaterFeed) &&
    /services\/farm\/hallDetailsWrite/.test(controllerSources.hallHygiene) &&
    /services\/farm\/placementWrite/.test(controllerSources.placement) &&
    /services\/farm\/weeklyWrite/.test(controllerSources.weekly),
);

check(
  "هیچ کنترلری تراکنش دستی نمی‌سازد (مرز تراکنش در سرویس است)",
  Object.values(controllerSources).every(
    (source) =>
      !/sequelize\.transaction\(/.test(source) &&
      !/require\("\.\.\/config\/database"\)/.test(source),
  ),
);

check(
  "اعتبارسنجی از validations/* می‌آید (نه نسخهٔ محلی در کنترلر)",
  /validations\/chickPlacementValidation/.test(
    readSource("services/farm/placementWrite.js"),
  ) &&
    /validations\/weeklyValidation/.test(
      readSource("services/farm/weeklyWrite.js"),
    ) &&
    /validations\/unitValidation/.test(
      readSource("services/farm/unitWrite.js"),
    ) &&
    !/const validateWeeklyData = /.test(controllerSources.weekly),
);

check(
  "حذف آبشاری واحد فقط در unitWrite است (نه کپی دوم)",
  /VisitReportAttachment\.destroy/.test(readSource("services/farm/unitWrite.js")) &&
    !/VisitReportAttachment/.test(controllerSources.unit),
);

// ============================================================
// ۵) فهرست سفید ویرایش (ستون‌های خطرناک راه ندارند)
// ============================================================
const forbidden = ["id", "customer_id", "customer_personal_information_id", "created_at", "updated_at"];

check(
  "فهرست سفید واحد: کلیدهای هویتی/مالکیت در آن نیست",
  unitWrite.UNIT_UPDATE_FIELDS.every((field) => !forbidden.includes(field)) &&
    unitWrite.UNIT_UPDATE_FIELDS.includes("manager_phone"),
);

check(
  "فهرست سفید سالن: customer_id و id در آن نیست",
  hallWrite.HALL_UPDATE_FIELDS.every((field) => !forbidden.includes(field)) &&
    hallWrite.HALL_UPDATE_FIELDS.includes("hall_name"),
);

check(
  "فهرست سفید جوجه‌ریزی: customer_id/id در آن نیست",
  placementWrite.PLACEMENT_UPDATE_FIELDS.every(
    (field) => !forbidden.includes(field),
  ) && placementWrite.PLACEMENT_UPDATE_FIELDS.includes("total_chicks_count"),
);

check(
  "فهرست سفید هفته: chick_placement_id (مالکیت ردیف) قابل تغییر نیست",
  weeklyWrite.WEEKLY_UPDATE_FIELDS.every(
    (field) => !forbidden.includes(field) && field !== "chick_placement_id",
  ) && weeklyWrite.WEEKLY_UPDATE_FIELDS.includes("weekly_weight"),
);

check(
  "پنج گروه آیتم هفتگی با کلید و مدل درست تعریف شده‌اند",
  weeklyWrite.WEEKLY_ITEM_GROUPS.map((group) => group.key).join(",") ===
    "disease_ids,vaccine_ids,medicine_ids,feed_type_ids,suggestion_ids" &&
    weeklyWrite.WEEKLY_ITEM_GROUPS.every(
      (group) => Boolean(group.model && group.foreignKey && group.alias),
    ),
);

// ============================================================
// ۶) قواعد خالص: نام خودکار سالن و ترتیب پایدار
// ============================================================
check(
  "نام خودکار سالن: «سالن A - نام واحد»",
  unitWrite.autoHallName(0, "مرغداری نمونه") === "سالن A - مرغداری نمونه" &&
    unitWrite.autoHallName(2, "مرغداری نمونه") === "سالن C - مرغداری نمونه",
);

check(
  "ترتیب نام‌گذاری: شمارهٔ عددی → hall_order → id",
  unitWrite
    .orderHallsForNaming([
      { id: 9, hall_number: "10", hall_order: 10 },
      { id: 3, hall_number: "2", hall_order: 2 },
      { id: 7, hall_number: null, hall_order: 1 },
    ])
    .map((hall) => hall.id)
    .join(",") === "3,9,7",
);

// ============================================================
// ۷) پاک‌سازی ردیف‌های تجهیزات (خالص)
// ============================================================
check(
  "normalizeItems: دستهٔ خالی حذف، تعداد حداقل ۱، spec از size پر می‌شود",
  (() => {
    const rows = hallDetailsWrite.normalizeItems([
      { category: "", quantity: 3 },
      { category: "fan", quantity: 0, size: "36" },
      { category: "heating", type_id: "4", quantity: "2" },
    ]);
    return (
      rows.length === 2 &&
      rows[0].category === "fan" &&
      rows[0].quantity === 1 &&
      rows[0].spec === "36" &&
      rows[1].type_id === 4 &&
      rows[1].quantity === 2
    );
  })(),
);

check(
  "normalizeItems: ورودی غیرآرایه ⇒ فهرست خالی (بدون خطا)",
  hallDetailsWrite.normalizeItems(null).length === 0 &&
    hallDetailsWrite.normalizeItems("x").length === 0,
);

// ============================================================
// ۸) تراکنش: با تراکنشِ داده‌شده commit/rollback نمی‌کند
// ============================================================
const fakeTransaction = {
  committed: false,
  rolledBack: false,
  commit() {
    this.committed = true;
  },
  rollback() {
    this.rolledBack = true;
  },
};

const txResult = await transaction.runInTransaction(
  async (trx) => {
    check("runInTransaction: همان تراکنشِ فراخوان را پاس می‌دهد", trx === fakeTransaction);
    return "done";
  },
  fakeTransaction,
);

check(
  "runInTransaction: با تراکنش موجود، مرز تراکنش مال فراخوان است",
  txResult === "done" &&
    fakeTransaction.committed === false &&
    fakeTransaction.rolledBack === false,
);

await transaction.safeRollback(null);
check("safeRollback: تراکنش null را بی‌خطا نادیده می‌گیرد", true);

// ============================================================
// ۹) شکل خروجی هفته (formatWeeklyRecord)
// ============================================================
check(
  "formatWeeklyRecord: شناسه‌ها به آرایه تبدیل و کلید خام حذف می‌شود",
  (() => {
    const row = {
      toJSON: () => ({
        id: 12,
        week_number: 3,
        WeeklyDiseases: [{ disease_id: 2 }, { disease_id: 5 }],
        WeeklyVaccines: [{ vaccine_id: 1 }],
        WeeklyMedicines: [],
        WeeklyFeeds: [{ feed_type_id: 7 }],
        WeeklySuggestions: [],
      }),
    };
    const out = weeklyWrite.formatWeeklyRecord(row);
    return (
      out.id === 12 &&
      out.week_number === 3 &&
      out.disease_ids.join(",") === "2,5" &&
      out.vaccine_ids.join(",") === "1" &&
      out.medicine_ids.length === 0 &&
      out.feed_type_ids.join(",") === "7" &&
      out.suggestion_ids.length === 0 &&
      out.WeeklyDiseases === undefined
    );
  })(),
);

// ============================================================
// ۱۰) آمادگی تراکنشِ بیرونی — موج ۱۳.۱۳
// ------------------------------------------------------------
//  تأیید درخواست پورتال یک تراکنش واحد دارد و باید بتواند همین
//  توابع را داخل آن صدا بزند. اگر تابعی مرز تراکنش خودش را باز کند،
//  «تأیید اتمیک» شکسته می‌شود؛ پس این بخش تضمین می‌کند همهٔ
//  توابع نوشتن پارامتر `{ transaction }` را می‌پذیرند و آن را
//  به `runInTransaction` می‌دهند.
// ============================================================
const writerSources = {
  unitWrite: fs.readFileSync(
    path.join(here, "services/farm/unitWrite.js"),
    "utf8",
  ),
  hallWrite: fs.readFileSync(
    path.join(here, "services/farm/hallWrite.js"),
    "utf8",
  ),
  hallDetailsWrite: fs.readFileSync(
    path.join(here, "services/farm/hallDetailsWrite.js"),
    "utf8",
  ),
  placementWrite: fs.readFileSync(
    path.join(here, "services/farm/placementWrite.js"),
    "utf8",
  ),
};

const countOf = (source, pattern) =>
  (source.match(pattern) || []).length;

check(
  "۱۳.۱۳ · همهٔ سرویس‌های نوشتن پارامتر { transaction } را می‌پذیرند",
  countOf(writerSources.unitWrite, /\{ transaction: existingTransaction = null \} = \{\}/g) === 3 &&
    countOf(writerSources.hallWrite, /\{ transaction: existingTransaction = null \} = \{\}/g) === 3 &&
    countOf(writerSources.hallDetailsWrite, /\{ transaction: existingTransaction = null \} = \{\}/g) === 4 &&
    countOf(writerSources.placementWrite, /\{ transaction: existingTransaction = null \} = \{\}/g) === 5,
  [
    countOf(writerSources.unitWrite, /existingTransaction = null/g),
    countOf(writerSources.hallWrite, /existingTransaction = null/g),
    countOf(writerSources.hallDetailsWrite, /existingTransaction = null/g),
    countOf(writerSources.placementWrite, /existingTransaction = null/g),
  ].join(","),
);

check(
  "۱۳.۱۳ · هیچ تراکنشی بدون عبور تراکنش بیرونی باقی نمانده",
  countOf(writerSources.unitWrite, /runInTransaction\(async/g) ===
    countOf(writerSources.unitWrite, /\}, existingTransaction\);/g) &&
    countOf(writerSources.hallWrite, /runInTransaction\(async/g) ===
      countOf(writerSources.hallWrite, /\}, existingTransaction\);/g) &&
    countOf(writerSources.hallDetailsWrite, /runInTransaction\(async/g) ===
      countOf(writerSources.hallDetailsWrite, /\}, existingTransaction\);/g) &&
    countOf(writerSources.placementWrite, /runInTransaction\(async/g) >=
      countOf(writerSources.placementWrite, /\}, existingTransaction\);/g),
);

check(
  "۱۳.۱۳ · خواندن ردیف هدف هم داخل همان تراکنش است (قفل ردیف بی‌اثر نباشد)",
  /const unit = await Unit\.findByPk\(unitId, \{ transaction \}\);/.test(
    writerSources.unitWrite,
  ) &&
    /const flock = await Flock\.findByPk\(id, \{ transaction: existingTransaction \}\);/.test(
      writerSources.placementWrite,
    ) &&
    /const hall = await requireHall\(hall_id, existingTransaction\);/.test(
      writerSources.hallDetailsWrite,
    ),
);

check(
  "۱۳.۱۳ · رفتار پیش‌فرض (بدون تراکنش بیرونی) دست‌نخورده است",
  // پیش‌فرض `null` ⇒ همان commit/rollback قبلی در runInTransaction
  /if \(existing\) return work\(existing\);/.test(
    fs.readFileSync(path.join(here, "services/farm/transaction.js"), "utf8"),
  ) &&
    /await transaction\.commit\(\);/.test(
      fs.readFileSync(path.join(here, "services/farm/transaction.js"), "utf8"),
    ),
);

// ============================================================
// جمع‌بندی
// ============================================================
const failed = results.filter((ok) => !ok).length;
console.log("");
console.log(`farm-write-test: ${results.length - failed}/${results.length} بررسی موفق`);
if (failed > 0) {
  console.error(`❌ ${failed} بررسی ناموفق`);
  process.exit(1);
}
console.log("✅ همهٔ بررسی‌های هستهٔ نوشتن فارم موفق بودند");


