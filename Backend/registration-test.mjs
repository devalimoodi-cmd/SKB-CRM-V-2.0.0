// ============================================================
//  تست «ثبت‌نام عمومی + صف تأیید» — فاز ۱۳.۶
//  اجرا:  node registration-test.mjs   (یا: npm run test:registration)
// ------------------------------------------------------------
//  پوشش:
//   ۱) اعتبارسنجی فیلدهای سفید (نام/نام‌کاربری/ایمیل/موبایل/رمز)
//   ۲) رد شدن role/status/customer_id ارسالی از سمت کاربر (mass-assignment)
//   ۳) گذارهای وضعیت: فقط pending → approved | rejected
//   ۴) خروجی‌های API: هرگز password_hash
//   ۵) اسکن ایستای امنیتی مسیرها/سرویس (کپچا، rate-limit، مجوزها، hooks:false)
//   ۶) هم‌راستایی سند ساختار دیتابیس (verify-db) با جدول جدید
// ------------------------------------------------------------
//  ⚠️ هیچ اتصال دیتابیسی برقرار نمی‌شود (تست خالص + اسکن فایل).
// ============================================================
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const rules = require("./services/registrationRules.js");

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

const controller = read("controllers/registrationController.js");
const service = read("services/registrationService.js");
const routes = read("routes/registrationRoutes.js");
const settings = read("controllers/settingsController.js");
const permissions = read("config/permissions.js");
const verifyDb = read("scripts/verify-db.js");
const serverJs = read("server.js");
const migration = read(
  "migrations/20261108000000-create-registration-requests.js",
);
const customerMigration = read(
  "migrations/20261108000001-add-customer-link-to-registration-requests.js",
);
// ✅ موج ۱۳.۷.۲ — پنج ستون اطلاعات پروندهٔ مشتری روی صف ثبت‌نام
const customerProfileMigration = read(
  "migrations/20261108000002-add-customer-fields-to-registration-requests.js",
);
const registrationModel = read("models/RegistrationRequest.js");
// ✅ موج ۱۳.۷.۳ — دو ستون «تأیید خودکار» روی صف ثبت‌نام
const autoApproveMigration = read(
  "migrations/20261108000003-add-auto-approval-to-registration-requests.js",
);

const results = [];
const check = (name, ok, extra = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}${extra ? " :: " + extra : ""}`);
};

// ===== دادهٔ پایهٔ معتبر =====
const baseForm = {
  first_name: "علی",
  last_name: "محمدی",
  username: "ali.test",
  email: "ali@example.com",
  mobile_number: "09151234567",
  password: "Secret@123",
  confirm_password: "Secret@123",
  // ✅ موج ۱۳.۷.۲ — نوع مشتری در فرم عمومی اجباری شد
  customer_type_id: "1",
};

const validate = (overrides = {}) =>
  rules.validateRegistration({ ...baseForm, ...overrides });

// ============================================================
// ۱) اعتبارسنجی فرم
// ============================================================
check("فرم کامل و معتبر → ok", validate().ok === true);
check(
  "نام کوتاه (۱ کاراکتر) → خطای first_name",
  Boolean(validate({ first_name: "ع" }).errors.first_name),
);
check(
  "نام کاربری با فاصله → خطای username",
  Boolean(validate({ username: "ali test" }).errors.username),
);
check(
  "نام کاربری با حروف فارسی → خطای username",
  Boolean(validate({ username: "علی" }).errors.username),
);
check(
  "ایمیل بدون @ → خطای email",
  Boolean(validate({ email: "ali.example.com" }).errors.email),
);
check(
  "موبایل بدون ۰۹ → خطای mobile_number",
  Boolean(validate({ mobile_number: "08151234567" }).errors.mobile_number),
);
check(
  "موبایل ۱۰ رقمی → خطای mobile_number",
  Boolean(validate({ mobile_number: "0915123456" }).errors.mobile_number),
);
check(
  "رمز ۷ کاراکتری → خطای حداقل طول",
  Boolean(validate({ password: "1234567", confirm_password: "1234567" }).errors.password),
);
check(
  "تکرار رمز متفاوت → خطای confirm_password",
  Boolean(validate({ confirm_password: "Other@123" }).errors.confirm_password),
);
check(
  "توضیح بیش از ۵۰۰ کاراکتر → خطای note",
  Boolean(validate({ note: "x".repeat(501) }).errors.note),
);

// ===== ارقام فارسی/عربی =====
check(
  "ارقام فارسی موبایل به لاتین نرمال می‌شوند",
  validate({ mobile_number: "۰۹۱۵۱۲۳۴۵۶۷" }).values.mobile_number === "09151234567",
);
check(
  "ارقام عربی موبایل به لاتین نرمال می‌شوند",
  validate({ mobile_number: "٠٩١٥١٢٣٤٥٦٧" }).values.mobile_number === "09151234567",
);
check(
  "ایمیل و نام کاربری به حروف کوچک نرمال می‌شوند",
  validate({ email: "ALI@Example.COM", username: "ALI.Test" }).values.email ===
    "ali@example.com" &&
    validate({ username: "ALI.Test" }).values.username === "ali.test",
);

// ============================================================
// ۲) ضدّ mass-assignment (ارتقای نقش)
// ============================================================
const withEscalation = rules.validateRegistration({
  ...baseForm,
  role: "super_admin",
  status: "active",
  customer_id: 1,
  created_by: 1,
});
check(
  "بدنهٔ حاوی role/status/customer_id → فرم را خراب نمی‌کند",
  withEscalation.ok === true,
);
check(
  "role/status/customer_id در values بازتولید نمی‌شوند",
  !("role" in withEscalation.values) &&
    !("status" in withEscalation.values) &&
    !("customer_id" in withEscalation.values) &&
    !("created_by" in withEscalation.values),
);
check(
  "forbiddenFieldsIn فیلدهای ممنوع را تشخیص می‌دهد",
  rules
    .forbiddenFieldsIn({ role: "admin", status: "active", customer_id: 2 })
    .join(",") === "role,status,customer_id",
);

const row = rules.buildRequestRow(withEscalation.values, { ip: "1.2.3.4" });
check("ردیف ساخته‌شده همیشه status=pending است", row.status === "pending");
check(
  "ردیف ساخته‌شده هیچ ستون نقش/وضعیت کاربر ندارد",
  !("role" in row) && !("customer_id" in row) && !("password" in row),
);

// ============================================================
// ۳) گذارهای وضعیت
// ============================================================
check("canReview: pending → مجاز", rules.canReview({ status: "pending" }).ok === true);
check(
  "canReview: approved → رد (تأیید دوباره)",
  rules.canReview({ status: "approved" }).ok === false,
);
check(
  "canReview: rejected → رد (رد دوباره)",
  rules.canReview({ status: "rejected" }).ok === false,
);
check(
  "canReview: وضعیت ناشناخته → رد",
  rules.canReview({ status: "weird" }).ok === false,
);
check(
  "approvalPatch: approved + reviewer + created_user_id",
  (() => {
    const patch = rules.approvalPatch({ reviewerId: 7, userId: 42 });
    return (
      patch.status === "approved" &&
      patch.reviewed_by === 7 &&
      patch.created_user_id === 42 &&
      patch.reject_reason === null &&
      patch.reviewed_at instanceof Date
    );
  })(),
);
check(
  "rejectionPatch: rejected + دلیل",
  (() => {
    const patch = rules.rejectionPatch({ reviewerId: 9, reason: "مدارک ناقص" });
    return (
      patch.status === "rejected" &&
      patch.reviewed_by === 9 &&
      patch.reject_reason === "مدارک ناقص"
    );
  })(),
);
check("دلیل رد کوتاه (۲ کاراکتر) → خطا", rules.validateRejectReason("اب").ok === false);
check(
  "دلیل رد بیش از ۳۰۰ کاراکتر → خطا",
  rules.validateRejectReason("x".repeat(301)).ok === false,
);
check(
  "دلیل رد معتبر → trimmed",
  (() => {
    const result = rules.validateRejectReason("  مدارک ناقص  ");
    return result.ok && result.value === "مدارک ناقص";
  })(),
);

// ============================================================
// ۴) خروجی‌های API (بدون دادهٔ حساس)
// ============================================================
const sampleRow = {
  id: 5,
  first_name: "علی",
  last_name: "محمدی",
  username: "ali.test",
  email: "ali@example.com",
  mobile_number: "09151234567",
  password_hash: "$2a$10$abcdefghijklmnopqrstuv",
  ip: "1.2.3.4",
  user_agent: "UA",
  status: "pending",
  created_at: new Date(),
  updated_at: new Date(),
};
const adminView = rules.adminRequestView(sampleRow);
check(
  "adminRequestView: password_hash/ip/user_agent حذف شده‌اند",
  !("password_hash" in adminView) && !("ip" in adminView) && !("user_agent" in adminView),
);
check(
  "adminRequestView: موبایل ماسک‌شده هم ارائه می‌شود",
  adminView.mobile_masked === "0915***567",
);
check(
  "publicRequestView: بدون شناسهٔ داخلی و بدون رمز",
  (() => {
    const view = rules.publicRequestView();
    return (
      !("id" in view) &&
      !("password_hash" in view) &&
      typeof view.message === "string" &&
      view.status === "pending"
    );
  })(),
);
check(
  "isBcryptHash: هش معتبر را می‌شناسد (محافظ هشِ دوباره)",
  rules.isBcryptHash("$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy") === true &&
    rules.isBcryptHash("Secret@123") === false,
);

// ============================================================
// ۵) پرچم ثبت‌نام و فیلتر وضعیت
// ============================================================
check(
  "isRegistrationEnabled: پیش‌فرض/خالی → false (امن)",
  rules.isRegistrationEnabled() === false,
);
check(
  "isRegistrationEnabled: true/1/yes → true",
  rules.isRegistrationEnabled(true) &&
    rules.isRegistrationEnabled("1") &&
    rules.isRegistrationEnabled("yes"),
);
check(
  "isRegistrationEnabled: رشتهٔ نامعتبر → false",
  rules.isRegistrationEnabled("maybe") === false,
);
check(
  "normalizeStatusFilter: pending معتبر",
  rules.normalizeStatusFilter("pending") === "pending",
);
check(
  "normalizeStatusFilter: نامعتبر → null (همه)",
  rules.normalizeStatusFilter("x") === null,
);

check(
  "ردیف ساخته‌شده IP و User-Agent را کوتاه/ذخیره می‌کند",
  row.ip === "1.2.3.4" &&
    row.user_agent === null &&
    rules.buildRequestRow({}, { userAgent: "x".repeat(400) }).user_agent.length === 255,
);


// ============================================================
// ۶) اسکن ایستای امنیتی
// ============================================================
check(
  "routes: مسیر عمومی POST با registerLimiter محافظت شده است",
  /router\.post\(\s*"\/"\s*,\s*registerLimiter/.test(routes),
);
check(
  "routes: فهرست/شمارش پشت protect + users.registrations.view است",
  /router\.get\(\s*"\/pending-count"[\s\S]*?protect[\s\S]*?users\.registrations\.view/.test(
    routes,
  ) &&
    /router\.get\(\s*"\/"[\s\S]*?protect[\s\S]*?users\.registrations\.view/.test(routes),
);
check(
  "routes: تأیید/رد پشت protect + users.registrations.review است",
  /:id\/approve[\s\S]*?protect[\s\S]*?users\.registrations\.review/.test(routes) &&
    /:id\/reject[\s\S]*?protect[\s\S]*?users\.registrations\.review/.test(routes),
);
check(
  "controller: کپچا فقط وقتی فعال است بررسی می‌شود (verifyChallenge)",
  /isCaptchaEnabled\(\)/.test(controller) && /verifyChallenge\(/.test(controller),
);
check(
  "controller: پرچم بسته‌بودن ثبت‌نام → ۴۰۳ با پیام روشن",
  /registration_enabled/.test(controller) &&
    /REGISTRATION_CLOSED_MESSAGE/.test(controller) &&
    /403/.test(controller),
);
check(
  "controller: تأیید، مجوز users.customer.link را هم می‌سنجد",
  /userHasPermission\(req,\s*"users\.customer\.link"\)/.test(controller),
);
check(
  "service: ساخت کاربر با hooks:false (جلوگیری از هش دوبارهٔ رمز)",
  /hooks:\s*false/.test(service),
);
check(
  "service: نقش و وضعیت کاربر ساخته‌شده ثابت است (customer/active)",
  /role:\s*"customer"/.test(service) && /status:\s*"active"/.test(service),
);
check(
  "service: کِلِیم اتمیک روی status=pending + بررسی claimed",
  /status:\s*rules\.STATUS\.PENDING/.test(service) && /\[claimed\]/.test(service),
);
check(
  "service: رمز با bcrypt هش می‌شود (نه متن خام)",
  /bcrypt\.hash\(/.test(service),
);
check(
  "settings: registration_enabled در KEY_DEFS با پیش‌فرض false",
  /registration_enabled:\s*\{[\s\S]{0,140}default:\s*false/.test(settings),
);
check(
  "settings: registration_enabled در PUBLIC_KEYS است",
  /PUBLIC_KEYS\s*=\s*\[[^\]]*"registration_enabled"/.test(settings),
);
check(
  "permissions: سه کلید جدید در کاتالوگ تعریف شده‌اند",
  /users\.registrations\.view/.test(permissions) &&
    /users\.registrations\.review/.test(permissions) &&
    /admin\.menu\.registrations/.test(permissions),
);
check(
  "server: مسیر /api/registrations نصب شده است",
  /app\.use\("\/api\/registrations"/.test(serverJs),
);
check(
  "verify-db: جدول و ستون‌های صف ثبت‌نام ثبت شده‌اند",
  /registration_requests/.test(verifyDb) && /password_hash/.test(verifyDb),
);
check(
  "migration: ایندکس یکتای جزئی WHERE status='pending' دارد",
  /registration_requests_pending_mobile_unique/.test(migration) &&
    /WHERE status = 'pending'/.test(migration),
);
check(
  "migration: ستون رمز خام وجود ندارد (فقط password_hash)",
  /password_hash/.test(migration) && !/^\s{8}password:/m.test(migration),
);
check(
  "بارگذاری واقعی: سرویس/کنترلر/روتر بدون خطا require می‌شوند (TDZ/ترتیب تعریف)",
  (() => {
    try {
      require("./services/registrationService.js");
      require("./controllers/registrationController.js");
      require("./routes/registrationRoutes.js");
      return true;
    } catch (error) {
      console.error("   ↳ require failed:", error.message);
      return false;
    }
  })(),
);

// ============================================================
// ۷) «پروندهٔ مشتری تازه» در تأیید (موج ۱۳.۷)
// ------------------------------------------------------------
//  ریسکی که این بخش از بازگشتش جلوگیری می‌کند:
//    • مشتری بدون پرونده → تأیید بدون customer_id ⇒ کاربر فعالِ بی‌پورتال
//    • پذیرش mobile/email/role از بدنهٔ مدیر ⇒ جعل هویت مشتری
//    • ساخت پرونده بدون کنترل «نوع مشتری» یا بدون تراکنش
// ============================================================
check(
  "normalizeCustomerMode: خالی/نامشخص → existing",
  rules.normalizeCustomerMode() === "existing" &&
    rules.normalizeCustomerMode("  ") === "existing",
);
check(
  "normalizeCustomerMode: new/existing معتبرند و مقدار ناشناخته → null",
  rules.normalizeCustomerMode("new") === "new" &&
    rules.normalizeCustomerMode("EXISTING") === "existing" &&
    rules.normalizeCustomerMode("other") === null,
);

const pendingRequest = { first_name: "علی", last_name: "محمدی" };
check(
  "validateNewCustomer: بدون نوع مشتری → خطای customer_type_id",
  Boolean(rules.validateNewCustomer({}, pendingRequest).errors.customer_type_id),
);
check(
  "validateNewCustomer: نوع معتبر + نام از درخواست → ok",
  (() => {
    const result = rules.validateNewCustomer(
      { customer_type_id: "3" },
      pendingRequest,
    );
    return result.ok && result.values.full_name === "علی محمدی";
  })(),
);
check(
  "validateNewCustomer: کد ملی ناقص → خطا (۱۰ رقم)",
  Boolean(
    rules
      .validateNewCustomer({ customer_type_id: 1, national_code: "12345" }, pendingRequest)
      .errors.national_code,
  ),
);
check(
  "validateNewCustomer: موبایل/ایمیل/نقش از بدنهٔ مدیر پذیرفته نمی‌شود",
  (() => {
    const result = rules.validateNewCustomer(
      {
        customer_type_id: 2,
        mobile_number: "09999999999",
        email: "hacker@example.com",
        role: "admin",
        customer_id: 5,
      },
      pendingRequest,
    );
    return (
      result.ok &&
      !("mobile_number" in result.values) &&
      !("email" in result.values) &&
      !("role" in result.values) &&
      !("customer_id" in result.values)
    );
  })(),
);
check(
  "approvalPatch: created_customer_id و customer_created ثبت می‌شوند",
  (() => {
    const patch = rules.approvalPatch({
      reviewerId: 4,
      userId: 11,
      customerId: 77,
      customerCreated: true,
    });
    return (
      patch.created_customer_id === 77 &&
      patch.customer_created === true &&
      rules.approvalPatch({ reviewerId: 4, userId: 11 }).customer_created === false
    );
  })(),
);
check(
  "adminRequestView: created_customer_id/customer_created در خروجی هستند",
  (() => {
    const view = rules.adminRequestView({ ...sampleRow, created_customer_id: 9, customer_created: true });
    return view.created_customer_id === 9 && view.customer_created === true;
  })(),
);
check(
  "service: شمارهٔ مشتری MAX(customer_code)+1 زیر قفل جدول",
  /LOCK TABLE customer_personal_information/.test(service) &&
    /MAX\(customer_code\)/.test(service),
);
check(
  "service: ساخت پروندهٔ مشتری داخل همان تراکنش تأیید است (fail-closed)",
  /createCustomerForRequest\(/.test(service) &&
    /customer_id: customer,/.test(service) &&
    /await transaction\.rollback\(\)/.test(service),
);
check(
  "service: موبایل تکراری مشتری → انتخاب پروندهٔ موجود (نه پروندهٔ تکراری)",
  /CUSTOMER_MOBILE_TAKEN/.test(service) &&
    /sameMobile/.test(service),
);
check(
  "controller: حالت new مجوز customers.register هم می‌خواهد",
  /userHasPermission\(req,\s*"customers\.register"\)/.test(controller) &&
    /CUSTOMER_MODE\.NEW/.test(controller),
);
check(
  "migration: ستون‌های created_customer_id و customer_created (idempotent)",
  /created_customer_id/.test(customerMigration) &&
    /customer_created/.test(customerMigration) &&
    /describeTable/.test(customerMigration),
);
check(
  "verify-db: ستون‌های جدید در اسکن registration_requests هستند",
  /created_customer_id/.test(verifyDb) && /customer_created/.test(verifyDb),
);

// ============================================================
// ۸) اطلاعات پروندهٔ مشتری در فرم عمومی (موج ۱۳.۷.۲)
// ------------------------------------------------------------
//  ریسکی که این بخش از بازگشتش جلوگیری می‌کند:
//    • فرم عمومی بدون «نوع مشتری» ⇒ پروندهٔ مشتریِ بی‌نوع
//    • کد ملی نامعتبر/کمتر از ۱۰ رقم در صف ثبت شود
//    • شهرستان بدون استان (دادهٔ ناسازگار) ذخیره شود
//    • فرم عمومی به دیکشنری مدیریتی (پشت مجوز) وابسته شود
//    • فیلدهای تازه در buildRequestRow/adminRequestView جا بیفتند
// ============================================================
const PROFILE_FIELDS = ["customer_type_id", "national_code", "farm_name", "province", "county"];

check(
  "ALLOWED_FIELDS: پنج فیلد پروندهٔ مشتری در فیلدهای سفید هستند",
  PROFILE_FIELDS.every((field) => rules.ALLOWED_FIELDS.includes(field)),
);
check(
  "فرم بدون نوع مشتری → خطای customer_type_id",
  Boolean(validate({ customer_type_id: "" }).errors.customer_type_id),
);
check(
  'نوع مشتری غیرعددی ("abc") → خطای customer_type_id',
  Boolean(validate({ customer_type_id: "abc" }).errors.customer_type_id),
);
check(
  "نوع مشتری عددی → values.customer_type_id عدد صحیح است",
  validate({ customer_type_id: "3" }).values.customer_type_id === 3 &&
    validate().values.customer_type_id === 1,
);
check(
  "فیلدهای اختیاری خالی → null (نه رشتهٔ خالی)",
  (() => {
    const values = validate().values;
    return (
      values.national_code === null &&
      values.farm_name === null &&
      values.province === null &&
      values.county === null
    );
  })(),
);
check(
  "کد ملی با ارقام فارسی نرمال می‌شود",
  validate({ national_code: "۰۰۱۲۳۴۵۶۷۸" }).values.national_code === "0012345678",
);
check(
  "کد ملی ۹ رقمی → خطای national_code",
  Boolean(validate({ national_code: "123456789" }).errors.national_code),
);
check(
  "نام واحد/مزرعه بیش از ۲۰۰ کاراکتر → خطای farm_name",
  Boolean(validate({ farm_name: "x".repeat(201) }).errors.farm_name),
);
check(
  "استان بیش از ۵۰ کاراکتر → خطای province",
  Boolean(validate({ province: "x".repeat(51) }).errors.province),
);
check(
  "شهرستان بدون استان → خطای county و مقدار null",
  Boolean(validate({ province: "", county: "بیرجند" }).errors.county) &&
    validate({ province: "", county: "بیرجند" }).values.county === null,
);
check(
  "استان + شهرستان معتبر → هر دو در values",
  validate({ province: "خراسان جنوبی", county: "بیرجند" }).values.province ===
    "خراسان جنوبی" &&
    validate({ province: "خراسان جنوبی", county: "بیرجند" }).values.county === "بیرجند",
);

const profileRow = rules.buildRequestRow(
  validate({
    national_code: "0012345678",
    farm_name: "مرغداری نمونه",
    province: "خراسان جنوبی",
    county: "بیرجند",
  }).values,
  { ip: "1.2.3.4" },
);
check(
  "buildRequestRow: پنج فیلد پرونده به ردیف اضافه می‌شوند",
  profileRow.customer_type_id === 1 &&
    profileRow.national_code === "0012345678" &&
    profileRow.farm_name === "مرغداری نمونه" &&
    profileRow.province === "خراسان جنوبی" &&
    profileRow.county === "بیرجند",
);
check(
  "buildRequestRow: فیلدهای خالی پرونده null می‌شوند",
  rules.buildRequestRow(validate().values, {}).national_code === null &&
    rules.buildRequestRow(validate().values, {}).province === null,
);
check(
  "adminRequestView: پنج فیلد پرونده برای پیش‌پرکردن مودال برمی‌گردند",
  (() => {
    const view = rules.adminRequestView({
      ...sampleRow,
      customer_type_id: 4,
      national_code: "0012345678",
      farm_name: "مرغداری نمونه",
      province: "خراسان جنوبی",
      county: "بیرجند",
    });
    return (
      view.customer_type_id === 4 &&
      view.national_code === "0012345678" &&
      view.farm_name === "مرغداری نمونه" &&
      view.province === "خراسان جنوبی" &&
      view.county === "بیرجند" &&
      !("password_hash" in view)
    );
  })(),
);

const requestWithProfile = {
  first_name: "علی",
  last_name: "محمدی",
  customer_type_id: 5,
  national_code: "1122334455",
  farm_name: "واحد مرغداری",
  province: "خراسان جنوبی",
  county: "بیرجند",
};
check(
  "validateNewCustomer: با بدنهٔ خالی همه‌چیز از درخواست خوانده می‌شود",
  (() => {
    const result = rules.validateNewCustomer({}, requestWithProfile);
    return (
      result.ok &&
      result.values.customer_type_id === 5 &&
      result.values.national_code === "1122334455" &&
      result.values.farm_name === "واحد مرغداری" &&
      result.values.province === "خراسان جنوبی" &&
      result.values.county === "بیرجند"
    );
  })(),
);
check(
  "validateNewCustomer: مقدار ارسالی مدیر بر درخواست اولویت دارد",
  (() => {
    const result = rules.validateNewCustomer(
      { customer_type_id: 9, farm_name: "واحد مدیر", province: "تهران", county: "" },
      requestWithProfile,
    );
    return (
      result.ok &&
      result.values.customer_type_id === 9 &&
      result.values.farm_name === "واحد مدیر" &&
      result.values.province === "تهران" &&
      result.values.county === null
    );
  })(),
);

check(
  "service: نوع مشتری در ثبت عمومی وجود/فعال بودنش سنجیده می‌شود",
  /assertCustomerTypeActive/.test(service) &&
    /findByPk\(typeId/.test(service) &&
    /active === false/.test(service),
);
check(
  "service: جفت استان/شهرستان در دیکشنری cities سنجیده می‌شود (با fail-open)",
  /assertRegionPair/.test(service) &&
    /regionDictionaryUsable/.test(service) &&
    /state_name = :province/.test(service) &&
    /city_name = :county/.test(service),
);
check(
  "service: بررسی دیکشنری پیش از هش رمز انجام می‌شود",
  service.indexOf("assertCustomerTypeActive(values.customer_type_id)") <
    service.indexOf("bcrypt.hash("),
);
check(
  "controller: اندپوینت عمومی انواع مشتری فقط id/name انواع فعال را می‌دهد",
  /getPublicCustomerTypes/.test(controller) &&
    /attributes:\s*\["id",\s*"name"\]/.test(controller) &&
    /where:\s*\{\s*active:\s*true\s*\}/.test(controller),
);
check(
  "routes: مسیر customer-types عمومی است (بدون protect) و لیمیتر سبک دارد",
  (() => {
    const line = routes.split("\n").find((row) => row.includes('"/customer-types"')) || "";
    return (
      /publicDictLimiter/.test(line) &&
      /controller\.getPublicCustomerTypes/.test(line) &&
      !/protect/.test(line)
    );
  })(),
);
check(
  "migration: پنج ستون پرونده با describeTable (idempotent) اضافه می‌شوند",
  PROFILE_FIELDS.every((field) => customerProfileMigration.includes(`"${field}"`)) &&
    /describeTable/.test(customerProfileMigration) &&
    /addColumn/.test(customerProfileMigration) &&
    /removeColumn/.test(customerProfileMigration),
);
check(
  "model: پنج ستون در RegistrationRequest تعریف شده‌اند (هم‌نام مایگریشن)",
  PROFILE_FIELDS.every((field) => new RegExp(`\\b${field}:\\s*\\{`).test(registrationModel)),
);
check(
  "verify-db: پنج ستون پرونده در اسکن registration_requests هستند",
  PROFILE_FIELDS.every((field) => verifyDb.includes(`"${field}"`)),
);

// ============================================================
// ✅ موج ۱۳.۷.۳ — «تأیید خودکار ثبت‌نام»
// ============================================================
const AUTO_APPROVE_FIELDS = ["auto_approved", "auto_approve_error"];
const publicKeysDeclaration =
  settings.split("\n").find((row) => row.includes("const PUBLIC_KEYS")) || "";

check(
  "۱۳.۷.۳ · settings: کلید registration_auto_approve با نوع boolean تعریف شده است",
  /registration_auto_approve:\s*\{[\s\S]{0,200}?type:\s*"boolean"/.test(settings),
);
check(
  "۱۳.۷.۳ · settings: پیش‌فرض «تأیید خودکار» خاموش است (امن به‌صورت پیش‌فرض)",
  /registration_auto_approve:\s*\{[\s\S]{0,300}?default:\s*false/.test(settings),
);
check(
  "۱۳.۷.۳ · settings: کلید در PUBLIC_KEYS نیست (فقط از config عمومی می‌آید)",
  Boolean(publicKeysDeclaration) &&
    !publicKeysDeclaration.includes("registration_auto_approve"),
);
check(
  "۱۳.۷.۳ · settings: writeSetting استخراج شد و updateSetting از آن استفاده می‌کند",
  /const writeSetting = async \(key, rawValue, userId = null\)/.test(settings) &&
    /writeSetting\(key, req\.body\?\.value/.test(settings) &&
    /writeSetting,/.test(settings),
);
check(
  "۱۳.۷.۳ · rules: isAutoApproveEnabled فقط مقادیر صریح true/1/yes را روشن می‌داند",
  rules.isAutoApproveEnabled(true) === true &&
    rules.isAutoApproveEnabled(1) === true &&
    rules.isAutoApproveEnabled("true") === true &&
    rules.isAutoApproveEnabled("yes") === true &&
    rules.isAutoApproveEnabled(false) === false &&
    rules.isAutoApproveEnabled("0") === false &&
    rules.isAutoApproveEnabled(null) === false &&
    rules.isAutoApproveEnabled(undefined) === false,
);
check(
  "۱۳.۷.۳ · rules: approvalPatch(autoApproved) پرچم ممیزی را ست و دلیل شکست را پاک می‌کند",
  (() => {
    const patch = rules.approvalPatch({
      reviewerId: null,
      userId: 12,
      customerId: 34,
      customerCreated: true,
      autoApproved: true,
    });
    return (
      patch.auto_approved === true &&
      patch.auto_approve_error === null &&
      patch.reviewed_by === null &&
      patch.status === rules.STATUS.APPROVED
    );
  })(),
);
check(
  "۱۳.۷.۳ · rules: تأیید دستی (بدون autoApproved) پرچم auto_approved را true نمی‌کند",
  rules.approvalPatch({ reviewerId: 5 }).auto_approved === false,
);
check(
  "۱۳.۷.۳ · rules: autoApprovalFailurePatch متن را به ۲۰۰ کاراکتر کوتاه می‌کند",
  (() => {
    const patch = rules.autoApprovalFailurePatch("x".repeat(500));
    return (
      typeof patch.auto_approve_error === "string" &&
      patch.auto_approve_error.length === rules.MAX_AUTO_APPROVE_ERROR
    );
  })(),
);
check(
  "۱۳.۷.۳ · rules: autoApprovalFailurePatch با متن خالی ⇒ null (نه رشتهٔ خالی)",
  rules.autoApprovalFailurePatch("   ").auto_approve_error === null,
);
check(
  "۱۳.۷.۳ · rules: publicRequestView(false) همان پیام «در انتظار تأیید» قبلی است",
  (() => {
    const view = rules.publicRequestView(false);
    return (
      view.status === rules.STATUS.PENDING &&
      view.auto_approved === false &&
      view.message === rules.PUBLIC_PENDING_MESSAGE
    );
  })(),
);
check(
  "۱۳.۷.۳ · rules: publicRequestView(true) پیام «اکنون وارد شوید» می‌دهد و شناسه‌ای افشا نمی‌کند",
  (() => {
    const view = rules.publicRequestView(true);
    const keys = Object.keys(view);
    return (
      view.status === rules.STATUS.APPROVED &&
      view.auto_approved === true &&
      view.message === rules.PUBLIC_AUTO_APPROVED_MESSAGE &&
      view.message !== rules.PUBLIC_PENDING_MESSAGE &&
      keys.every((key) => ["status", "auto_approved", "message"].includes(key)) &&
      !JSON.stringify(view).includes("password_hash")
    );
  })(),
);
check(
  "۱۳.۷.۳ · rules: adminRequestView دو ستون ممیزی «تأیید خودکار» را برمی‌گرداند",
  (() => {
    const view = rules.adminRequestView({
      status: "approved",
      auto_approved: true,
      auto_approve_error: "دلیل",
    });
    return view.auto_approved === true && view.auto_approve_error === "دلیل";
  })(),
);

check(
  "۱۳.۷.۳ · service: autoApproveRequest از همان مسیر approveRequest با پرچم خودکار استفاده می‌کند",
  /const autoApproveRequest = async/.test(service) &&
    /reviewerId: null/.test(service) &&
    /customerMode: rules\.CUSTOMER_MODE\.NEW/.test(service) &&
    /autoApproved: true/.test(service) &&
    /autoApproveRequest,/.test(service),
);
check(
  "۱۳.۷.۳ · service: شکست تأیید خودکار ردیف pending را با دلیل ثبت می‌کند (نه حذف/تأیید)",
  /const recordAutoApprovalFailure = async/.test(service) &&
    /autoApprovalFailurePatch\(reason\)/.test(service) &&
    /where: \{ id: requestId, status: rules\.STATUS\.PENDING \}/.test(service),
);
check(
  "۱۳.۷.۳ · service: محافظ «موبایل از قبل پرونده دارد» پیش از تراکنش تأیید بررسی می‌شود",
  /AUTO_CUSTOMER_EXISTS_MESSAGE/.test(service) &&
    service.indexOf("AUTO_CUSTOMER_EXISTS_MESSAGE") <
      service.indexOf("const result = await approveRequest({"),
);
check(
  "۱۳.۷.۳ · service: autoApproveRequest هرگز throw نمی‌کند (catch + خروجی ok:false)",
  /code: "AUTO_APPROVE_ERROR"/.test(service) &&
    /تأیید خودکار انجام نشد؛ درخواست در صف بررسی می‌ماند/.test(service),
);
check(
  "۱۳.۷.۳ · controller: config عمومی پرچم auto_approve را برای صفحهٔ /register می‌دهد",
  /auto_approve: rules\.isAutoApproveEnabled\(autoFlag\)/.test(controller) &&
    /readSetting\("registration_auto_approve"\)/.test(controller),
);
check(
  "۱۳.۷.۳ · controller: ثبت عمومی پس از ساخت درخواست، تأیید خودکار را اجرا می‌کند",
  /const autoApprove = rules\.isAutoApproveEnabled\(autoFlag\)/.test(controller) &&
    /service\.autoApproveRequest\(created\.request\)/.test(controller) &&
    /publicRequestView\(auto\?\.ok === true\)/.test(controller),
);
check(
  "۱۳.۷.۳ · controller: روشن‌کردن سوییچ مجوز customers.register را هم می‌سنجد",
  /const getReviewSettings = async/.test(controller) &&
    /const updateReviewSettings = async/.test(controller) &&
    /if \(desired\) \{[\s\S]{0,240}?customers\.register/.test(controller),
);
check(
  "۱۳.۷.۳ · controller: مقدار نامعتبر/غایب برای auto_approve ⇒ ۴۰۰ (fail-closed)",
  /raw === undefined \|\| raw === null/.test(controller) &&
    /مقدار «تأیید خودکار» ارسال نشده است/.test(controller),
);

check(
  "۱۳.۷.۳ · routes: GET /settings با users.registrations.view و PUT /settings با users.registrations.review",
  (() => {
    const lines = routes.split("\n");
    const getIdx = lines.findIndex((row) => row.includes('"/settings"'));
    const putIdx = lines.findIndex(
      (row, index) => index > getIdx && row.includes('"/settings"'),
    );
    if (getIdx < 0 || putIdx < 0) return false;
    const getBlock = lines.slice(getIdx, getIdx + 6).join("\n");
    const putBlock = lines.slice(putIdx, putIdx + 6).join("\n");
    return (
      getBlock.includes("users.registrations.view") &&
      getBlock.includes("controller.getReviewSettings") &&
      putBlock.includes("users.registrations.review") &&
      putBlock.includes("controller.updateReviewSettings")
    );
  })(),
);
check(
  "۱۳.۷.۳ · migration: دو ستون تأیید خودکار با describeTable (idempotent) اضافه می‌شوند",
  AUTO_APPROVE_FIELDS.every((field) => autoApproveMigration.includes(`"${field}"`)) &&
    /describeTable/.test(autoApproveMigration) &&
    /addColumn/.test(autoApproveMigration) &&
    /removeColumn/.test(autoApproveMigration) &&
    /defaultValue: false/.test(autoApproveMigration),
);
check(
  "۱۳.۷.۳ · model: دو ستون در RegistrationRequest تعریف شده‌اند (هم‌نام مایگریشن)",
  AUTO_APPROVE_FIELDS.every((field) =>
    new RegExp(`\\b${field}:\\s*\\{`).test(registrationModel),
  ),
);
check(
  "۱۳.۷.۳ · verify-db: دو ستون تأیید خودکار در اسکن registration_requests هستند",
  AUTO_APPROVE_FIELDS.every((field) => verifyDb.includes(`"${field}"`)),
);

// ============================================================
// جمع‌بندی
// ============================================================
const failed = results.filter((r) => !r.ok);
console.log(
  `\n${failed.length === 0 ? "✅ ALL PASS" : "❌ FAILED"} — ${results.length - failed.length}/${results.length}`,
);
if (failed.length) {
  console.log("FAILED CHECKS:\n" + failed.map((f) => ` - ${f.name}`).join("\n"));
  process.exit(1);
}
