// ============================================================
//  تست «درخواست‌های فارم» — موج ۱۳.۱۱   (بدون دیتابیس)
// ------------------------------------------------------------
//  چه چیزی را ثابت می‌کند؟
//   ۱) فهرست سفید payload: کلیدهای خطرناک (customer_id/status/role…)
//      حتی اگر کلاینت بفرستد، ذخیره نمی‌شوند.
//   ۲) اعتبارسنجی هر سه نوع درخواست (واحد/سالن/جوجه‌ریزی).
//   ۳) سقف‌ها (تعداد در انتظار، حجم payload، طول دلیل رد).
//   ۴) گذارهای وضعیت: فقط pending قابل تأیید/رد/لغو است.
//   ۵) نمای خروجی مشتری ستون‌های ممیزی را لو نمی‌دهد.
//   ۶) استخراج «حل گله»: یک منبع مشترک برای کارشناس و پورتال.
//
//  اجرا:  node portal-request-test.mjs      (در پوشهٔ Backend)
//         یا  npm run test:portal-requests
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

const rules = require("./services/portalRequestRules.js");
const flockResolver = require("./services/flockResolver.js");
// ✅ ۱۳.۱۸ — اسکیمای مشترک پورتال: مالکیت ردیفِ مسیرهای جزئیات از همین‌جا می‌آید
const portalSchema = require("./config/portalSchema.js");

// ============================================================
// ۱) انواع و وضعیت‌ها
// ============================================================
// ✅ موج ۱۳.۱۳: هشت نوع تازه (ویرایش/حذف واحد و سالن + چهار حوزهٔ جزئیات)
const CREATE_TYPES = ["unit_create", "hall_create", "placement_create"];
const WAVE_1313_TYPES = [
  "unit_update",
  "unit_delete",
  "hall_update",
  "hall_delete",
  "hall_physical_save",
  "hall_system_save",
  "hall_water_feed_save",
  "hall_hygiene_save",
];

// ✅ موج ۱۳.۱۴: مدیریت دوره/جوجه‌ریزی + اطلاعات هفتگی
const WAVE_1314_TYPES = [
  "placement_update",
  "placement_delete",
  "placement_activate",
  "placement_deactivate",
  "weekly_create",
  "weekly_update",
  "weekly_delete",
];

check(
  "انواع درخواست طبق طراحی است (۳ ایجاد + ۸ نوع ۱۳.۱۳ + ۷ نوع ۱۳.۱۴)",
  rules.REQUEST_TYPE_KEYS.join(",") ===
    CREATE_TYPES.concat(WAVE_1313_TYPES, WAVE_1314_TYPES).join(","),
  rules.REQUEST_TYPE_KEYS.join(","),
);

check(
  "وضعیت‌ها بسته‌اند (pending/approved/rejected/cancelled)",
  rules.REQUEST_STATUS_KEYS.join(",") === "pending,approved,rejected,cancelled",
  rules.REQUEST_STATUS_KEYS.join(","),
);

check(
  "برچسب فارسی انواع و وضعیت‌ها خالی نیست",
  rules.REQUEST_TYPE_KEYS.every((key) => rules.typeLabel(key).length > 3) &&
    rules.REQUEST_STATUS_KEYS.every((key) => rules.statusLabel(key).length > 3),
);

check(
  "نوع/وضعیت ناشناخته رد می‌شود و فیلتر ناشناخته ⇒ «همه»",
  rules.isRequestType("unit_create") === true &&
    rules.isRequestType("customer_id") === false &&
    rules.isStatus("pending") === true &&
    rules.isStatus("approved_by_self") === false &&
    rules.normalizeStatusFilter("hack") === null &&
    rules.normalizeTypeFilter("hack") === null &&
    rules.normalizeStatusFilter("pending") === "pending",
);

// ============================================================
// ۲) فهرست سفید payload — مهم‌ترین مرز امنیتی
// ============================================================
const ROGUE_KEYS = [
  "customer_id",
  "id",
  "status",
  "reviewed_by",
  "reviewed_at",
  "applied_at",
  "result_entity_id",
  "role",
  "customer_personal_information_id",
];

check(
  "فهرست سفید هیچ نوع درخواستی کلید حساس ندارد",
  Object.entries(rules.ALLOWED_PAYLOAD_KEYS).every(([, keys]) =>
    ROGUE_KEYS.every((rogue) => !keys.includes(rogue)),
  ),
);

const rogueBody = {
  unit_name: "مزرعه نمونه",
  address: "تهران، جاده قدیم، پلاک ۲",
  hall_count: "2",
  capacity: "20000",
  customer_id: 999,
  status: "approved",
  reviewed_by: 1,
  role: "super_admin",
};

const sanitizedUnit = rules.sanitizePayload("unit_create", rogueBody);

check(
  "sanitizePayload کلیدهای حساس را حذف می‌کند",
  !("customer_id" in sanitizedUnit) &&
    !("status" in sanitizedUnit) &&
    !("reviewed_by" in sanitizedUnit) &&
    !("role" in sanitizedUnit),
  JSON.stringify(Object.keys(sanitizedUnit)),
);

check(
  "sanitizePayload ارقام فارسی را در فیلد عددی تبدیل می‌کند",
  rules.sanitizePayload("unit_create", { hall_count: "۱۲", capacity: "۳۰۰۰۰" })
    .hall_count === 12,
);

check(
  "متن آزاد (آدرس) با ارقام فارسی دست‌نخورده می‌ماند",
  rules.sanitizePayload("unit_create", { address: "خیابان ۱۲ پلاک ۳" })
    .address === "خیابان ۱۲ پلاک ۳",
);

check(
  "start_new_flock فقط boolean می‌شود",
  rules.sanitizePayload("placement_create", { start_new_flock: "on" })
    .start_new_flock === true &&
    rules.sanitizePayload("placement_create", { start_new_flock: "false" })
      .start_new_flock === false,
);

check(
  "نوع ناشناخته ⇒ payload خالی (بدون استثنا)",
  Object.keys(rules.sanitizePayload("drop_table", { unit_name: "x" })).length ===
    0,
);

check(
  "payload خالی تشخیص داده می‌شود",
  rules.isPayloadEmpty({}) === true && rules.isPayloadEmpty({ a: 1 }) === false,
);

check(
  "حجم payload محاسبه و سقف ۸KB اعمال می‌شود",
  rules.MAX_PAYLOAD_BYTES === 8192 &&
    rules.payloadSizeBytes({ note: "x".repeat(9000) }) >
      rules.MAX_PAYLOAD_BYTES,
  `size=${rules.payloadSizeBytes({ note: "x".repeat(9000) })}`,
);
// ============================================================
// ۳) اعتبارسنجی هر سه نوع
// ============================================================
const validUnit = rules.validatePayload("unit_create", {
  unit_name: "مرغداری نمونه",
  address: "تهران، کیلومتر ۲۰",
  hall_count: 2,
  capacity: 20000,
});

check(
  "درخواست واحد معتبر پذیرفته می‌شود",
  validUnit.isValid === true,
  validUnit.errors.join(" | "),
);

const badUnit = rules.validatePayload("unit_create", { unit_name: "ا" });

check(
  "درخواست واحد ناقص رد می‌شود (نام/آدرس/تعداد سالن/ظرفیت)",
  badUnit.isValid === false && badUnit.errors.length >= 3,
  badUnit.errors.join(" | "),
);

check(
  "شمارهٔ مدیر در درخواست واحد اختیاری است ولی اگر بیاید باید ۱۱ رقم باشد",
  rules.validatePayload("unit_create", {
    unit_name: "مرغداری نمونه",
    address: "تهران، کیلومتر ۲۰",
    hall_count: 2,
    capacity: 20000,
    manager_phone: "0912",
  }).isValid === false,
);

check(
  "درخواست سالن معتبر پذیرفته می‌شود",
  rules.validatePayload("hall_create", { unit_id: 3, hall_name: "سالن یک" })
    .isValid === true,
);

check(
  "درخواست سالن بدون واحد رد می‌شود",
  rules.validatePayload("hall_create", { hall_name: "سالن یک" }).isValid ===
    false,
);

check(
  "ظرفیت اسمی/سال ساخت/شمارهٔ سالن در بازهٔ مجاز سنجیده می‌شوند",
  rules.validatePayload("hall_create", {
    unit_id: 3,
    hall_name: "سالن یک",
    nominal_capacity: 500000,
  }).isValid === false &&
    rules.validatePayload("hall_create", {
      unit_id: 3,
      hall_name: "سالن یک",
      construction_year: 1200,
    }).isValid === false &&
    rules.validatePayload("hall_create", {
      unit_id: 3,
      hall_name: "سالن یک",
      hall_number: "12345",
    }).isValid === false,
);

const validPlacement = rules.validatePayload("placement_create", {
  unit_id: 1,
  hall_id: 2,
  placement_date: "2026-02-01",
  chick_source_id: 1,
  breed_id: 2,
  avg_initial_weight: 42,
  total_chicks_count: 12000,
});

check(
  "درخواست جوجه‌ریزی معتبر پذیرفته می‌شود",
  validPlacement.isValid === true,
  validPlacement.errors.join(" | "),
);

check(
  "جوجه‌ریزی بدون تاریخ/نژاد/مبدا/وزن/تعداد رد می‌شود",
  rules.validatePayload("placement_create", { unit_id: 1, hall_id: 2 })
    .isValid === false,
);

check(
  "تراکم جوجه‌ریزی خارج از بازه رد می‌شود",
  rules
    .validatePayload("placement_create", {
      unit_id: 1,
      hall_id: 2,
      placement_date: "2026-02-01",
      chick_source_id: 1,
      breed_id: 2,
      avg_initial_weight: 42,
      total_chicks_count: 12000,
      placement_density: 500,
    })
    .errors.some((message) => message.includes("تراکم")) === true,
);

check(
  "validatePayload برای نوع ناشناخته خطای روشن می‌دهد",
  rules.validatePayload("nope", {}).isValid === false,
);
// ============================================================
// ۴) دلیل رد و گذارهای وضعیت
// ============================================================
check(
  "دلیل رد کوتاه/خالی نامعتبر است و دلیل درست trim می‌شود",
  rules.validateReason("  ").isValid === false &&
    rules.validateReason("ab").isValid === false &&
    rules.validateReason("  اطلاعات ناقص است  ").value === "اطلاعات ناقص است",
);

check(
  "فقط pending قابل بازبینی و لغو است",
  rules.canReview("pending") === true &&
    rules.canReview("approved") === false &&
    rules.canCancel("pending") === true &&
    rules.canCancel("rejected") === false,
);

const approved = rules.approvalPatch({
  reviewerId: 7,
  now: new Date("2026-02-02T10:00:00Z"),
  entityId: 55,
  summary: "واحد «نمونه» ثبت شد",
});

check(
  "approvalPatch همهٔ ستون‌های تأیید را پر می‌کند",
  approved.status === "approved" &&
    approved.reviewed_by === 7 &&
    approved.result_entity_id === 55 &&
    approved.applied_at instanceof Date &&
    approved.reject_reason === null,
);

const rejected = rules.rejectionPatch({
  reviewerId: 7,
  now: new Date("2026-02-02T10:00:00Z"),
  reason: "ظرفیت اعلام‌شده با سند هم‌خوان نیست",
});

check(
  "rejectionPatch دلیل را ذخیره و applied_at را خالی می‌گذارد",
  rejected.status === "rejected" &&
    rejected.reject_reason === "ظرفیت اعلام‌شده با سند هم‌خوان نیست" &&
    rejected.applied_at === null &&
    rejected.result_entity_id === null,
);

check(
  "cancelPatch وضعیت را cancelled می‌کند و بازبین نمی‌نویسد",
  rules.cancelPatch({ now: new Date("2026-02-02T10:00:00Z") }).status ===
    "cancelled" && !("reviewed_by" in rules.cancelPatch()),
);

// ============================================================
// ۵) نمای خروجی
// ============================================================
const fakeRow = {
  id: 12,
  customer_id: 4,
  request_type: "hall_create",
  status: "pending",
  payload: { unit_id: 1, hall_name: "سالن ۲", note: "لطفاً سریع" },
  submitted_by: 30,
  submitted_ip: "10.0.0.5",
  submitted_user_agent: "jest",
  reviewed_by: null,
  created_at: new Date("2026-02-01T08:00:00Z"),
};

const customerView = rules.customerRequestView(fakeRow);
const adminView = rules.adminRequestView(fakeRow);

check(
  "نمای مشتری ستون‌های ممیزی را ندارد",
  !("submitted_ip" in customerView) &&
    !("submitted_user_agent" in customerView) &&
    !("reviewed_by" in customerView) &&
    !("customer_id" in customerView),
  JSON.stringify(Object.keys(customerView)),
);

check(
  "نمای مشتری برچسب نوع/وضعیت و یادداشت را دارد",
  customerView.type_label === "ثبت سالن" &&
    customerView.status_label.length > 3 &&
    customerView.note === "لطفاً سریع",
);

check(
  "نمای کارشناس شناسهٔ پرونده و بازبین را دارد",
  adminView.customer_id === 4 && "reviewed_by" in adminView,
);

check(
  "نما با آبجکت سکوئلایز (get) هم کار می‌کند",
  rules.customerRequestView({
    get: () => ({ ...fakeRow, request_type: "unit_create" }),
  }).type_label === "ثبت واحد مرغداری",
);
// ============================================================
// ۶) استخراج «حل گله» — یک منبع برای کارشناس و پورتال
// ============================================================
check(
  "services/flockResolver سه تابع مشترک را صادر می‌کند",
  typeof flockResolver.getNextFlockNumber === "function" &&
    typeof flockResolver.createFlockRecord === "function" &&
    typeof flockResolver.resolveFlock === "function",
);

const writerController = fs.readFileSync(
  path.join(here, "controllers/chickPlacementController.js"),
  "utf8",
);
const serviceSource = fs.readFileSync(
  path.join(here, "services/portalRequestService.js"),
  "utf8",
);
// ✅ موج ۱۳.۱۲: نوشتن جوجه‌ریزی از کنترلر به services/farm/placementWrite
//    منتقل شد؛ زنجیرهٔ «یک منبع» اکنون کنترلر ← placementWrite ← flockResolver است.
const placementWriter = fs.readFileSync(
  path.join(here, "services/farm/placementWrite.js"),
  "utf8",
);

// ✅ موج ۱۳.۱۳: نوشتن جوجه‌ریزی پورتال هم از مسیر مشترک می‌گذرد؛
//    زنجیرهٔ کامل: portalRequestService ← placementWrite ← flockResolver
check(
  "نوشتن جوجه‌ریزی از یک منبع مشترک استفاده می‌کند (placementWrite ← flockResolver)",
  /require\("\.\.\/flockResolver"\)/.test(placementWriter) &&
    /require\("\.\.\/services\/farm\/placementWrite"\)/.test(writerController) &&
    /require\("\.\/farm\/placementWrite"\)/.test(serviceSource) &&
    /placementWrite\.createPlacement\(/.test(serviceSource),
);

check(
  "منطق ساخت گله در هیچ‌کدام تکرار نشده (تعریف محلی حذف شده)",
  !/const createFlockRecord = async/.test(writerController) &&
    !/const resolveFlock = async/.test(writerController) &&
    !/const resolveFlock = async/.test(placementWriter),
);

// ============================================================
// ۷) سقف‌ها و پیام‌ها
// ============================================================
check(
  "سقف ۱۰ درخواست در انتظار و ۸KB payload اعلام شده است",
  rules.MAX_PENDING_REQUESTS === 10 &&
    rules.LIMITS.max_pending === 10 &&
    rules.LIMITS.max_payload_bytes === 8192,
);

check(
  "پیام‌های کلیدی فارسی و غیرخالی‌اند",
  [
    "unlinked",
    "invalid_type",
    "validation_failed",
    "too_many_pending",
    "duplicate_pending",
    "not_found",
    "already_reviewed",
    "reason_required",
    "cancel_only_pending",
    "apply_failed",
    "hall_busy",
    "unit_name_taken",
  ].every(
    (key) =>
      typeof rules.REQUEST_MESSAGES[key] === "string" &&
      rules.REQUEST_MESSAGES[key].length > 10,
  ),
);

// ============================================================
// ۹) موج ۱۳.۱۳ — هشت نوع تازه (ویرایش/حذف + جزئیات سالن)
// ============================================================
const hallDetailValidation = require("./validations/hallDetailValidation.js");
const farmRoutesSource = fs.readFileSync(
  path.join(here, "routes/portalRoutes.js"),
  "utf8",
);
const unitWriter = fs.readFileSync(
  path.join(here, "services/farm/unitWrite.js"),
  "utf8",
);
const hallWriter = fs.readFileSync(
  path.join(here, "services/farm/hallWrite.js"),
  "utf8",
);
const hallDetailWriter = fs.readFileSync(
  path.join(here, "services/farm/hallDetailsWrite.js"),
  "utf8",
);

check(
  "۱۳.۱۳ · هر نوع درخواست اعتبارسنج payload دارد (بدون نوع بدون قاعده)",
  rules.REQUEST_TYPE_KEYS.every((type) => rules.hasPayloadValidator(type)),
);

check(
  "۱۳.۱۳ · هیچ فهرست سفیدی کلید حساس ندارد (customer_id/status/reviewed_by/is_active)",
  rules.REQUEST_TYPE_KEYS.every((type) => {
    const keys = rules.ALLOWED_PAYLOAD_KEYS[type] || [];
    return (
      !keys.includes("customer_id") &&
      !keys.includes("status") &&
      !keys.includes("reviewed_by") &&
      !keys.includes("is_active") &&
      !keys.includes("unit_status_id") &&
      !keys.includes("customer_personal_information_id")
    );
  }),
);

check(
  "۱۳.۱۳ · حذف واحد بدون بازتایپ نام واحد رد می‌شود",
  rules.validatePayload("unit_delete", { unit_id: 7 }).isValid === false &&
    rules.validatePayload("unit_delete", {
      unit_id: 7,
      confirm_name: "واحد الف",
    }).isValid === true,
);

check(
  "۱۳.۱۳ · ویرایش واحد بدون هیچ تغییری رد می‌شود",
  rules.validatePayload("unit_update", { unit_id: 7 }).isValid === false &&
    rules.validatePayload("unit_update", { unit_id: 7, capacity: 5000 })
      .isValid === true,
);

const hallUpdatePayload = rules.sanitizePayload("hall_update", {
  hall_id: "۳",
  hall_number: "۱۲",
});

check(
  "۱۳.۱۳ · ویرایش سالن بدون unit_id معتبر است و ارقام فارسی نرمال می‌شوند",
  hallUpdatePayload.hall_id === 3 &&
    hallUpdatePayload.hall_number === "12" &&
    rules.validatePayload("hall_update", hallUpdatePayload).isValid === true &&
    !rules.ALLOWED_PAYLOAD_KEYS.hall_update.includes("unit_id"),
  JSON.stringify(hallUpdatePayload),
);

// ============================================================
const physicalPayload = rules.sanitizePayload("hall_physical_save", {
  hall_id: "۵",
  length: "12.5",
  width: 6,
  floor_type_id: 2,
  unit_id: 99,
  customer_id: 1,
});

check(
  "۱۳.۱۳ · جزئیات فیزیکی: عددی‌ها تبدیل و unit_id/customer_id حذف می‌شوند",
  physicalPayload.hall_id === 5 &&
    physicalPayload.length === 12.5 &&
    !("unit_id" in physicalPayload) &&
    !("customer_id" in physicalPayload) &&
    rules.validatePayload("hall_physical_save", physicalPayload).isValid === true,
  JSON.stringify(physicalPayload),
);

check(
  "۱۳.۱۳ · جزئیات فیزیکی: طول منفی رد می‌شود",
  rules.validatePayload("hall_physical_save", { hall_id: 5, length: -2 })
    .isValid === false,
);

const systemPayload = rules.sanitizePayload("hall_system_save", {
  hall_id: 5,
  fan_count: "4",
  items: [
    { category: "fan", quantity: "2", type_id: "3", evil: "x" },
    { category: "", quantity: 1 },
    "not-an-object",
  ],
});

check(
  "۱۳.۱۳ · سیستم‌ها: ردیف‌های تجهیزات پاک‌سازی می‌شوند (بدون کلید اضافه/ردیف بی‌دسته)",
  Array.isArray(systemPayload.items) &&
    systemPayload.items.length === 1 &&
    systemPayload.items[0].quantity === 2 &&
    systemPayload.items[0].type_id === 3 &&
    !("evil" in systemPayload.items[0]) &&
    rules.validatePayload("hall_system_save", systemPayload).isValid === true,
  JSON.stringify(systemPayload),
);

check(
  "۱۳.۱۳ · سیستم‌ها: دستهٔ ناشناختهٔ تجهیزات رد می‌شود",
  rules.validatePayload("hall_system_save", {
    hall_id: 5,
    items: [{ category: "spaceship", quantity: 1 }],
  }).isValid === false,
);

check(
  "۱۳.۱۳ · آب/دان: auto_feed_system بولین می‌شود",
  rules.sanitizePayload("hall_water_feed_save", {
    hall_id: 5,
    auto_feed_system: "on",
    water_lines_count: "3",
  }).auto_feed_system === true,
);

check(
  "۱۳.۱۳ · بهداشت: فقط تاریخ ISO پذیرفته می‌شود",
  rules.validatePayload("hall_hygiene_save", {
    hall_id: 5,
    last_wash_date: "2026-01-05",
  }).isValid === true &&
    rules.validatePayload("hall_hygiene_save", {
      hall_id: 5,
      last_wash_date: "05/01/2026",
    }).isValid === false,
);

check(
  "۱۳.۱۳ · انواع حذف و ستون هدف در قواعد تعریف شده‌اند",
  rules.DESTRUCTIVE_TYPES.includes("unit_delete") &&
    rules.DESTRUCTIVE_TYPES.includes("hall_delete") &&
    rules.isDestructiveType("unit_delete") === true &&
    rules.isDestructiveType("hall_update") === false &&
    rules.targetFieldOf("hall_physical_save") === "hall_id" &&
    rules.targetFieldOf("unit_delete") === "unit_id",
);

check(
  "۱۳.۱۳ · فهرست سفید جزئیات سالن از همان ماژول کارشناس می‌آید",
  Object.keys(hallDetailValidation.HALL_DETAIL_VALIDATORS).every(
    (type) =>
      rules.ALLOWED_PAYLOAD_KEYS[type].includes("hall_id") &&
      !rules.ALLOWED_PAYLOAD_KEYS[type].includes("unit_id"),
  ),
);

// ============================================================
// ۱۰) موج ۱۳.۱۳ — یک منبع نوشتن (بدون نسخهٔ دوم در سرویس پورتال)
// ============================================================
check(
  "۱۳.۱۳ · سرویس پورتال منطق محلی سالن/واحد ندارد (نسخهٔ دوم حذف شده)",
  !/const nextHallNumber = async/.test(serviceSource) &&
    !/const nextHallOrder = async/.test(serviceSource) &&
    !/const syncUnitHallCount = async/.test(serviceSource) &&
    !/Hall\.create\(/.test(serviceSource),
);

check(
  "۱۳.۱۳ · سرویس پورتال از هستهٔ مشترک فارم استفاده می‌کند",
  /require\("\.\/farm\/unitWrite"\)/.test(serviceSource) &&
    /require\("\.\/farm\/hallWrite"\)/.test(serviceSource) &&
    /require\("\.\/farm\/hallDetailsWrite"\)/.test(serviceSource) &&
    /hallWrite\.createHall\(/.test(serviceSource) &&
    /hallWrite\.updateHall\(/.test(serviceSource) &&
    /hallDetailsWrite\.savePhysicalInfo/.test(serviceSource) &&
    /unitWrite\.deleteUnit\(/.test(serviceSource),
);

check(
  "۱۳.۱۳ · هر نوع تازه یک applier دارد (نقشهٔ اعمال کامل است)",
  WAVE_1313_TYPES.every((type) => serviceSource.includes(`${type}:`)),
);

check(
  "۱۳.۱۳ · هستهٔ فارم تراکنش بیرونی را می‌پذیرد (یک تراکنش برای تأیید)",
  [unitWriter, hallWriter, hallDetailWriter].every(
    (src) => src.split("existingTransaction").length > 4,
  ),
);

check(
  "۱۳.۱۳ · مسیر «جزئیات سالن خودم» با مالکیت ردیف ثبت شده است",
  /"\/farm\/halls\/:id"/.test(farmRoutesSource) &&
    // ✅ ۱۳.۱۸: مالکیت ردیف در اسکیما اعلان می‌شود و chainFor آن را می‌سازد
    portalSchema
      .endpointById("FARM_HALL_DETAIL")
      .ownership.some((row) => row.model === "Hall" && row.label === "سالن") &&
    /hallDetailsFor/.test(serviceSource),
);

check(
  "۱۳.۱۳ · گزینه‌های فرم شامل دیکشنری‌های چهار حوزهٔ جزئیات و پرچم «ثبت‌شده» است",
  // ✅ ۱۳.۱۶: دیکشنری‌ها از فهرست مشترک `DICTIONARY_MODELS` می‌آیند
  /\["floor_types", FloorType\]/.test(serviceSource) &&
    /\["waterer_types", WatererType\]/.test(serviceSource) &&
    /\["feeder_types", FeederType\]/.test(serviceSource) &&
    /has_physical:/.test(serviceSource) &&
    /has_hygiene:/.test(serviceSource),
);

// ============================================================
// ۱۱) سیم‌کشی فایل‌های موج ۱۳.۱۱ موجودند
// ============================================================
const REQUIRED_FILES = [
  "models/PortalRequest.js",
  "migrations/20261110000000-create-portal-requests.js",
  "services/portalRequestRules.js",
  "services/portalRequestService.js",
  "services/flockResolver.js",
  "controllers/portalFarmController.js",
  "controllers/portalRequestAdminController.js",
  "routes/portalRequestRoutes.js",
];

check(
  "همهٔ فایل‌های بک‌اند موج ۱۳.۱۱ موجودند",
  REQUIRED_FILES.every((rel) => fs.existsSync(path.join(here, rel))),
  REQUIRED_FILES.filter((rel) => !fs.existsSync(path.join(here, rel))).join(","),
);

// ============================================================
// ۱۲) موج ۱۳.۱۴ — دوره/جوجه‌ریزی و اطلاعات هفتگی
// ============================================================
const weeklyValidation = require("./validations/weeklyValidation.js");
const weeklyWriter = fs.readFileSync(
  path.join(here, "services/farm/weeklyWrite.js"),
  "utf8",
);

check(
  "۱۳.۱۴ · هر هفت نوع تازه اعتبارسنج و فهرست سفید دارند",
  WAVE_1314_TYPES.every(
    (type) =>
      rules.hasPayloadValidator(type) && !!rules.ALLOWED_PAYLOAD_KEYS[type],
  ),
);

check(
  "۱۳.۱۴ · ویرایش دوره بدون تغییرات و با تراکم نامعتبر رد می‌شود",
  rules.validatePayload("placement_update", { placement_id: 5 }).isValid ===
    false &&
    rules.validatePayload("placement_update", {
      placement_id: 5,
      placement_density: 400,
    }).isValid === false &&
    rules.validatePayload("placement_update", {
      placement_id: 5,
      total_chicks_count: 12000,
      placement_density: 18,
    }).isValid === true,
);

check(
  "۱۳.۱۴ · حذف/فعال‌سازی/پایان دوره فقط شناسهٔ مثبت می‌خواهند",
  ["placement_delete", "placement_activate", "placement_deactivate"].every(
    (type) =>
      rules.validatePayload(type, {}).isValid === false &&
      rules.validatePayload(type, { placement_id: 3 }).isValid === true,
  ),
);

check(
  "۱۳.۱۴ · فهرست سفید هفتگی کلیدهای کارشناسی را راه نمی‌دهد",
  !rules.ALLOWED_PAYLOAD_KEYS.weekly_create.includes("customer_id") &&
    !rules.ALLOWED_PAYLOAD_KEYS.weekly_create.includes("unit_id") &&
    !rules.ALLOWED_PAYLOAD_KEYS.weekly_create.includes("hall_id") &&
    !rules.ALLOWED_PAYLOAD_KEYS.weekly_create.includes("service_expert_id") &&
    !rules.ALLOWED_PAYLOAD_KEYS.weekly_create.includes("is_active") &&
    !rules.ALLOWED_PAYLOAD_KEYS.weekly_create.includes("status"),
);

check(
  "۱۳.۱۴ · انواع حذف دوره/هفته در فهرست هشدار و ستون هدف آمده‌اند",
  rules.DESTRUCTIVE_TYPES.join(",") ===
    "unit_delete,hall_delete,placement_delete,weekly_delete" &&
    rules.targetFieldOf("placement_activate") === "placement_id" &&
    rules.targetFieldOf("weekly_create") === "chick_placement_id" &&
    rules.targetFieldOf("weekly_delete") === "weekly_id",
);

const weeklyPayload = rules.sanitizePayload("weekly_create", {
  chick_placement_id: "5",
  week_number: "2",
  week_start_date: "2026-01-05",
  week_end_date: "2026-01-11",
  flock_age_days: "14",
  weekly_mortality: "3",
  weekly_weight: "0.45",
  daily_feed_intake: "20",
  weekly_feed_intake: "140",
  disease_ids: ["1", 2, 2, 0, "x"],
  vaccine_ids: "not-an-array",
});

check(
  "۱۳.۱۴ · ثبت هفته معتبر پذیرفته و آیتم‌ها نرمال می‌شوند (تکراری/نامعتبر حذف)",
  weeklyPayload.chick_placement_id === 5 &&
    weeklyPayload.week_number === 2 &&
    weeklyPayload.disease_ids.join(",") === "1,2" &&
    Array.isArray(weeklyPayload.vaccine_ids) &&
    rules.validatePayload("weekly_create", weeklyPayload).isValid === true,
  JSON.stringify(weeklyPayload),
);

check(
  "۱۳.۱۴ · ثبت هفته: نبود شمارهٔ هفته/وزن و ناسازگاری دان رد می‌شود",
  rules.validatePayload("weekly_create", { chick_placement_id: 5 }).isValid ===
    false &&
    rules.validatePayload("weekly_create", {
      chick_placement_id: 5,
      week_number: 2,
      week_start_date: "2026-01-05",
      week_end_date: "2026-01-11",
      flock_age_days: 14,
      weekly_mortality: 3,
      weekly_weight: 0.45,
      daily_feed_intake: 20,
      weekly_feed_intake: 999,
    }).isValid === false,
);

check(
  "۱۳.۱۴ · قاعدهٔ دان روزانه/هفتگی از همان اعتبارسنج کارشناس می‌آید",
  /validateWeeklyData/.test(
    fs.readFileSync(path.join(here, "services/portalRequestRules.js"), "utf8"),
  ) &&
    rules.validatePayload("weekly_create", {
      chick_placement_id: 5,
      week_number: 2,
      week_start_date: "2026-01-05",
      week_end_date: "2026-01-11",
      flock_age_days: 14,
      weekly_mortality: 3,
      weekly_weight: 0.45,
      daily_feed_intake: 20,
      weekly_feed_intake: 140,
    }).isValid ===
      weeklyValidation.validateWeeklyData({
        customer_id: 1,
        hall_id: 1,
        chick_placement_id: 5,
        week_number: 2,
        week_start_date: "2026-01-05",
        week_end_date: "2026-01-11",
        flock_age_days: 14,
        weekly_mortality: 3,
        weekly_weight: 0.45,
        daily_feed_intake: 20,
        weekly_feed_intake: 140,
      }).isValid,
);

check(
  "۱۳.۱۴ · ویرایش/حذف هفته شناسهٔ هفته می‌خواهد و «بدون تغییر» رد می‌شود",
  rules.validatePayload("weekly_update", { weekly_id: 9 }).isValid === false &&
    rules.validatePayload("weekly_update", {
      weekly_id: 9,
      weekly_mortality: 4,
    }).isValid === true &&
    rules.validatePayload("weekly_delete", { weekly_id: 9 }).isValid === true &&
    rules.validatePayload("weekly_delete", {}).isValid === false,
);

check(
  "۱۳.۱۴ · معماری: نوشتن دوره/هفته از هستهٔ مشترک فارم می‌گذرد",
  /require\("\.\/farm\/weeklyWrite"\)/.test(serviceSource) &&
    /weeklyWrite\.createWeekly\(/.test(serviceSource) &&
    /weeklyWrite\.updateWeekly\(/.test(serviceSource) &&
    /weeklyWrite\.deleteWeekly\(/.test(serviceSource) &&
    /placementWrite\.activatePlacement\(/.test(serviceSource) &&
    /placementWrite\.deactivatePlacement\(/.test(serviceSource) &&
    /placementWrite\.deletePlacement\(/.test(serviceSource) &&
    /runInTransaction\(async \(trx\)/.test(weeklyWriter),
);

check(
  "۱۳.۱۴ · مالکیت دوره/هفته داخل همان تراکنش سنجیده می‌شود",
  /const requireOwnedPlacement = async/.test(serviceSource) &&
    /const requireOwnedWeekly = async/.test(serviceSource) &&
    /where: \{ id: placementId, customer_id: customerId \}/.test(
      serviceSource,
    ) &&
    /where: \{ id: weeklyId, customer_id: customerId \}/.test(serviceSource),
);

check(
  "۱۳.۱۴ · هر نوع تازه یک applier و یک کلید تکرار دارد",
  WAVE_1314_TYPES.every((type) => serviceSource.includes(`${type}:`)) &&
    WAVE_1314_TYPES.every((type) =>
      serviceSource.includes(`type === "${type}"`),
    ),
);

check(
  "۱۳.۱۴ · گزینه‌های فرم: دوره‌های خودم + پنج دیکشنری هفتگی",
  /placements: placements\.map/.test(serviceSource) &&
    // ✅ ۱۳.۱۶: پنج دیکشنری هفتگی در فهرست مشترک `DICTIONARY_MODELS`
    /\["diseases", Disease\]/.test(serviceSource) &&
    /\["vaccines", Vaccine\]/.test(serviceSource) &&
    /\["medicines", Medicine\]/.test(serviceSource) &&
    /\["feed_types", FeedType\]/.test(serviceSource) &&
    /\["suggestion_types", SuggestionType\]/.test(serviceSource),
);

check(
  "۱۳.۱۴ · مسیر «جزئیات دورهٔ خودم» با مالکیت ردیف ثبت شده است",
  /"\/farm\/placements\/:id"/.test(farmRoutesSource) &&
    portalSchema
      .endpointById("FARM_PLACEMENT_DETAIL")
      .ownership.some(
        (row) => row.model === "ChickPlacement" && row.label === "دوره",
      ) &&
    /placementDetailsFor/.test(serviceSource) &&
    /weeklies: weeklies\.map/.test(serviceSource),
);

// ============================================================
// ۱۳) موج ۱۳.۱۵ — جزئیات یک هفته (پیش‌پرکردن فرم ویرایش در پورتال)
// ------------------------------------------------------------
//  ریسک: بدون این مسیر، فرم «ویرایش هفته» مجبور بود اعداد دان/خاموشی/
//  توضیحات و پنج آرایهٔ شناسه را دستی دوباره بگیرد — و `validateWeeklyData`
//  هم شمارهٔ هفته/تاریخ‌ها/تلفات/وزن را اجباری می‌داند ⇒ یا داده گم می‌شد
//  یا مشتری همه‌چیز را از نو تایپ می‌کرد.
// ============================================================
const farmControllerSource = fs.readFileSync(
  path.join(here, "controllers/portalFarmController.js"),
  "utf8",
);

check(
  "۱۳.۱۵ · سرویس: جزئیات هفته از همان خواندن هستهٔ weeklyWrite می‌آید",
  /const weeklyDetailsFor = async \(\{ customerId, weeklyId \}\)/.test(
    serviceSource,
  ) &&
    /requireOwnedWeekly|weeklyWrite\.formatWeeklyRecord\(row\)/.test(serviceSource) &&
    /weeklyWrite\.formatWeeklyRecord\(row\)/.test(serviceSource) &&
    /WEEKLY_ITEM_GROUPS\.map/.test(serviceSource) &&
    !/WeeklyManagement\.findByPk/.test(serviceSource),
);

check(
  "۱۳.۱۵ · مالکیت هفته در همان کوئری سنجیده می‌شود (۴۰۴ برای غیرخودی)",
  /where: \{ id: weeklyId, customer_id: customerId \}/.test(serviceSource) &&
    /if \(!row\) throw serviceError\("weekly_not_found", 404\)/.test(
      serviceSource,
    ) &&
    /weeklyDetailsFor,/.test(serviceSource),
);

check(
  "۱۳.۱۵ · مسیر /farm/weeklies/:id فقط خواندنی و با requireOwnedRow",
  /"\/farm\/weeklies\/:id"/.test(farmRoutesSource) &&
    portalSchema
      .endpointById("FARM_WEEKLY_DETAIL")
      .ownership.some(
        (row) => row.model === "WeeklyManagement" && row.label === "هفته",
      ) &&
    /getMyWeekly/.test(farmControllerSource) &&
    /weeklyDetailsFor\(\{/.test(farmControllerSource) &&
    /REQUEST_MESSAGES\.weekly_not_found/.test(farmControllerSource),
);

check(
  "۱۳.۱۵ · خروجی شکل یافته دارد (id عددی + chick_placement_id عددی)",
  /id: Number\(record\.id\)/.test(serviceSource) &&
    /chick_placement_id:/.test(serviceSource) &&
    /return \{\s*weekly: \{/.test(serviceSource),
);

// ============================================================
// ۱۴) موج ۱۳.۱۶ — «نمایش نامدار» payload در صف کارشناس
// ------------------------------------------------------------
//  ریسک: کارشناس پیش از تأیید فقط `breed_id: 3` و «۵ مورد» می‌دید؛
//  یعنی ده نوع هفتگی/جزئیات سالن بدون دانستن محتوا تأیید می‌شد.
//
//  سه چیز باید ثابت شود:
//   ۱) دیکشنری‌ها از **یک** فهرست می‌آیند و هیچ مدل دادهٔ مشتری در آن
//      نیست (صف نباید از این راه به دادهٔ عملیاتی مشتری برسد).
//   ۲) «زمینهٔ درخواست» با `customer_id` همان درخواست اسکوپ می‌شود،
//      نه با ورودی کلاینت، و فقط `{id,label}` می‌دهد.
//   ۳) مسیر `/dictionaries` پیش از `/:id` ثبت شده و همان کلید مجوز
//      `portal.requests.view` را دارد.
// ============================================================
const adminControllerSource = fs.readFileSync(
  path.join(here, "controllers/portalRequestAdminController.js"),
  "utf8",
);
const requestRoutesSource = fs.readFileSync(
  path.join(here, "routes/portalRequestRoutes.js"),
  "utf8",
);

const dictionaryBlock = (serviceSource.match(
  /const DICTIONARY_MODELS = \[([\s\S]*?)\n\];/,
) || [])[1] || "";

check(
  "۱۳.۱۶ · دیکشنری‌ها یک فهرست مشترک دارند (۱۶ کلید، بدون مدل دادهٔ مشتری)",
  dictionaryBlock.length > 0 &&
    (dictionaryBlock.match(/\["[a-z_]+", /g) || []).length === 16 &&
    /\["breeds", ChickenBreed\]/.test(dictionaryBlock) &&
    /\["suggestion_types", SuggestionType\]/.test(dictionaryBlock) &&
    // 🔒 هیچ مدل دادهٔ عملیاتی/شخصی در فهرست دیکشنری نیست
    !/Unit|Hall\b|ChickPlacement|WeeklyManagement|CustomerPersonalInfo|PortalRequest/.test(
      dictionaryBlock,
    ),
);

check(
  "۱۳.۱۶ · همان فهرست هم در پورتال و هم در صف استفاده می‌شود",
  /const staffDictionariesFor = async \(\) => loadDictionaries\(\);/.test(
    serviceSource,
  ) &&
    /loadDictionaries\(\),/.test(serviceSource) &&
    /dictionaries,/.test(serviceSource) &&
    !/diseases: dictionaryOf\(diseases\)/.test(serviceSource) &&
    /staffDictionariesFor,/.test(serviceSource) &&
    /contextForRequest,/.test(serviceSource),
);

check(
  "۱۳.۱۶ · زمینهٔ درخواست با customer_id همان درخواست اسکوپ می‌شود",
  /const customerId = Number\(row && row\.customer_id\);/.test(serviceSource) &&
    /customer_personal_information_id: customerId/.test(serviceSource) &&
    /where: \{ id: \{ \[Op\.in\]: hallIds \}, customer_id: customerId \}/.test(
      serviceSource,
    ) &&
    /where: \{ id: \{ \[Op\.in\]: weeklyIds \}, customer_id: customerId \}/.test(
      serviceSource,
    ) &&
    // 🔒 هیچ ورودی درخواست (body/query/params) در تابع خوانده نمی‌شود
    !/req\.(body|query|params)/.test(
      serviceSource.slice(
        serviceSource.indexOf("const contextForRequest"),
        serviceSource.indexOf("module.exports"),
      ),
    ),
);

check(
  "۱۳.۱۶ · زمینهٔ درخواست هیچ PII (تلفن/کد ملی/آدرس) برنمی‌گرداند",
  !/manager_phone|national_code|mobile|address|postal_code/.test(
    serviceSource.slice(
      serviceSource.indexOf("const contextForRequest"),
      serviceSource.indexOf("module.exports"),
    ),
  ),
);

check(
  "۱۳.۱۶ · مسیر دیکشنری‌ها پیش از /:id و پشت portal.requests.view",
  requestRoutesSource.indexOf('router.get("/dictionaries"') > 0 &&
    requestRoutesSource.indexOf('router.get("/dictionaries"') <
      requestRoutesSource.indexOf('router.get("/:id"') &&
    /router\.get\("\/dictionaries", \.\.\.viewChain, controller\.getDictionaries\);/.test(
      requestRoutesSource,
    ) &&
    /getDictionaries,/.test(adminControllerSource) &&
    /service\.staffDictionariesFor\(\)/.test(adminControllerSource),
);

check(
  "۱۳.۱۶ · جزئیات درخواست، زمینه را هم برمی‌گرداند (پاسخ {request, context})",
  /const context = await service\.contextForRequest\(row\);/.test(
    adminControllerSource,
  ) &&
    /\{ request: adminRequestView\(row\), context \}/.test(adminControllerSource) &&
    /getDictionaries/.test(adminControllerSource),
);

// ============================================================
// خلاصه
// ============================================================
const passed = results.filter(Boolean).length;
const failed = results.length - passed;
console.log(
  `\n${failed === 0 ? "✅" : "❌"} portal-request-test: ${passed}/${results.length} بررسی موفق`,
);
process.exit(failed === 0 ? 0 : 1);



