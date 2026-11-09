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

// ============================================================
// ۱) انواع و وضعیت‌ها
// ============================================================
check(
  "انواع درخواست طبق طراحی است (۳ نوع ایجاد)",
  rules.REQUEST_TYPE_KEYS.join(",") ===
    "unit_create,hall_create,placement_create",
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
  "حجم payload محاسبه و سقف ۴KB اعمال می‌شود",
  rules.MAX_PAYLOAD_BYTES === 4096 &&
    rules.payloadSizeBytes({ note: "x".repeat(5000) }) > rules.MAX_PAYLOAD_BYTES,
  `size=${rules.payloadSizeBytes({ note: "x".repeat(5000) })}`,
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

check(
  "کنترلر کارشناس و سرویس پورتال هر دو از flockResolver استفاده می‌کنند",
  /require\("\.\.\/services\/flockResolver"\)/.test(writerController) &&
    /require\("\.\/flockResolver"\)/.test(serviceSource),
);

check(
  "منطق ساخت گله در کنترلر تکرار نشده (تعریف محلی حذف شده)",
  !/const createFlockRecord = async/.test(writerController) &&
    !/const resolveFlock = async/.test(writerController),
);

// ============================================================
// ۷) سقف‌ها و پیام‌ها
// ============================================================
check(
  "سقف ۱۰ درخواست در انتظار و ۴KB payload اعلام شده است",
  rules.MAX_PENDING_REQUESTS === 10 &&
    rules.LIMITS.max_pending === 10 &&
    rules.LIMITS.max_payload_bytes === 4096,
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
// ۸) سیم‌کشی فایل‌های موج ۱۳.۱۱ موجودند
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
// خلاصه
// ============================================================
const passed = results.filter(Boolean).length;
const failed = results.length - passed;
console.log(
  `\n${failed === 0 ? "✅" : "❌"} portal-request-test: ${passed}/${results.length} بررسی موفق`,
);
process.exit(failed === 0 ? 0 : 1);



