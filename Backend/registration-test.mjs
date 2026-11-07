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
