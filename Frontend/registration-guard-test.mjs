// ============================================================
//  گارد «ثبت‌نام عمومی + صف تأیید» — فاز ۱۳.۶
// ------------------------------------------------------------
//  ریشهٔ خطری که این گارد از بازگشتش جلوگیری می‌کند:
//   ۱) اگر صفحهٔ /register روت نداشته باشد، لینک صفحهٔ ورود ۴۰۴ می‌دهد.
//   ۲) اگر فرم، role/status/customer_id بفرستد یا صفحه فیلد نقش داشته
//      باشد ⇒ ارتقای سطح دسترسی از درِ عمومی.
//   ۳) اگر صف در پنل با کلید منوی اشتباه گیت شود ⇒ یا ناپدید می‌شود
//      یا برای نقش‌های بی‌مجوز دیده می‌شود.
//   ۴) اگر تأیید بدون «پروندهٔ مشتری» ارسال شود ⇒ مشتری فعالِ بی‌پورتال.
//   ۵) اگر نام کلیدها بین کاتالوگ سرور و پنل فرق کند ⇒ گیت بی‌اثر.
//
//  اجرا:  npm run test:registration      (در پوشهٔ Frontend)
// ============================================================
import fs from "node:fs";
import path from "node:path";

const here = import.meta.dirname;
const ROOT = path.join(here, "..");

const results = [];
const check = (name, ok, extra = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}${extra ? " :: " + extra : ""}`);
};

const read = (relPath) => {
  try {
    return fs
      .readFileSync(path.join(ROOT, relPath), "utf8")
      .replace(/^\uFEFF/, "");
  } catch {
    return "";
  }
};
const exists = (relPath) => fs.existsSync(path.join(ROOT, relPath));

// ============================================================
// ۰) فایل‌های این فاز
// ============================================================
const FILES = {
  registerHtml: "Frontend/src/pages/register.html",
  registerCss: "Frontend/src/features/registration/registration.css",
  registerApi: "Frontend/src/features/registration/registration.api.js",
  registerService: "Frontend/src/features/registration/registration.service.js",
  apiConst: "Frontend/src/core/constants/api.const.js",
  appService: "Frontend/src/core/services/app.service.js",
  frontendServer: "Frontend/server.js",
  loginHtml: "Frontend/src/pages/login.html",
  adminHtml: "Frontend/src/pages/admin-panel.html",
  adminService: "Frontend/src/features/admin-panel/admin-panel.service.js",
  adminRenderer: "Frontend/src/features/admin-panel/admin-panel.renderer.js",
  adminApi: "Frontend/src/features/admin-panel/admin-panel.api.js",
  adminCss: "Frontend/src/features/admin-panel/admin-panel.css",
  permissions: "Backend/config/permissions.js",
};

const missing = Object.entries(FILES)
  .filter(([, rel]) => !exists(rel))
  .map(([key]) => key);
check("همهٔ فایل‌های فاز ۱۳.۶ موجودند", missing.length === 0, missing.join(","));

const registerHtml = read(FILES.registerHtml);
const registerCss = read(FILES.registerCss);
const registerApi = read(FILES.registerApi);
const registerService = read(FILES.registerService);
const apiConst = read(FILES.apiConst);
const appService = read(FILES.appService);
const frontendServer = read(FILES.frontendServer);
const loginHtml = read(FILES.loginHtml);
const adminHtml = read(FILES.adminHtml);
const adminService = read(FILES.adminService);
const adminRenderer = read(FILES.adminRenderer);
const adminApi = read(FILES.adminApi);
const adminCss = read(FILES.adminCss);
const apiConstSource = apiConst;
const permissions = read(FILES.permissions);


// ============================================================
// ۱) صفحهٔ ثبت‌نام عمومی
// ============================================================
check(
  "صفحه: فرم و سرویس به هم متصل‌اند",
  /id="registerForm"/.test(registerHtml) &&
    /registration\.service\.js/.test(registerHtml),
);
check(
  "صفحه: همهٔ فیلدهای سفید فرم وجود دارند",
  [
    "regFirstName",
    "regLastName",
    "regUsername",
    "regEmail",
    "regMobile",
    "regPassword",
    "regConfirmPassword",
    "regCustomerCode",
    "regNote",
  ].every((id) => registerHtml.includes(`id="${id}"`)),
);
check(
  "صفحه: کپچا (تصویر + تازه‌سازی + پاسخ) وجود دارد",
  /id="regCaptchaGroup"/.test(registerHtml) &&
    /id="regCaptchaImage"/.test(registerHtml) &&
    /id="regCaptchaRefresh"/.test(registerHtml) &&
    /id="regCaptchaAnswer"/.test(registerHtml),
);
check(
  "صفحه: حالت‌های «بسته» و «موفق» وجود دارند",
  /id="regClosed"/.test(registerHtml) && /id="regSuccess"/.test(registerHtml),
);
check(
  "صفحه: هیچ فیلد role/status/customer_id در فرم نیست",
  !/id="role"|id="status"|id="customer_id"|id="userStatus"/.test(registerHtml),
);
check(
  "صفحه: پیکربندی پیش از سرویس لود می‌شود (window.CONFIG)",
  registerHtml.indexOf("config.const.js") > 0 &&
    registerHtml.indexOf("config.const.js") <
      registerHtml.indexOf("registration.service.js"),
);
check(
  "صفحه: سبک اختصاصی بارگذاری می‌شود و همهٔ کلاس‌ها .reg- هستند",
  /registration\.css/.test(registerHtml) &&
    /\.reg-page/.test(registerCss) &&
    !/(^|\n)\s*body\s*\{/.test(registerCss),
);
check(
  "صفحه: هیچ محتوایی بعد از </html> نیست (مارک‌آپ سالم و کامل)",
  registerHtml.trimEnd().toLowerCase().endsWith("</html>") &&
    (registerHtml.toLowerCase().match(/<\/html>/g) || []).length === 1,
);
check(
  "صفحه: ترتیب فیلدها درست است (ایمیل پیش از رمز عبور) و divها متوازن‌اند",
  registerHtml.indexOf('id="regEmail"') > 0 &&
    registerHtml.indexOf('id="regEmail"') < registerHtml.indexOf('id="regPassword"') &&
    (registerHtml.match(/<div\b/g) || []).length ===
      (registerHtml.match(/<\/div>/g) || []).length,
  `divs=${(registerHtml.match(/<div\b/g) || []).length}/${(registerHtml.match(/<\/div>/g) || []).length}`,
);

// ============================================================
// ۲) لایهٔ API و سرویس ثبت‌نام
// ============================================================
check(
  "API: اندپوینت‌ها از api.const می‌آیند (نه رشتهٔ پراکنده)",
  /ENDPOINTS\.REGISTRATIONS/.test(registerApi),
);
check(
  "API: درخواست عمومی با fetch است (بدون apiService ⇒ بدون ریدایرکت ۴۰۱)",
  /fetch\(/.test(registerApi) && !/from\s+"[^"]*api\.service\.js"/.test(registerApi),
);
check("سرویس: حداقل طول رمز ۸ است", /MIN_PASSWORD_LENGTH\s*=\s*8/.test(registerService));
check(
  "سرویس: پیام «ثبت‌نام بسته است» با پرچم سرور کنترل می‌شود",
  /getConfig\(/.test(registerService) && /applyClosedState/.test(registerService),
);
check(
  "سرویس: هیچ role/status/customer_id در بدنهٔ ارسالی نیست",
  !/role:/.test(registerService) &&
    !/status:\s*"active"/.test(registerService) &&
    !/customer_id:/.test(registerService),
);
check(
  "سرویس: خطاهای فیلدبه‌فیلد سرور نمایش داده می‌شوند",
  /applyFieldErrors/.test(registerService) && /data-field/.test(registerHtml),
);

// ============================================================
// ۳) مسیرها و گارد صفحه در فرانت
// ============================================================
check(
  "سرور فرانت: روت /register و /register.html وجود دارد",
  /app\.get\("\/register"/.test(frontendServer) &&
    /app\.get\("\/register\.html"/.test(frontendServer),
);
check(
  "app.service: صفحهٔ register بدون نیاز به ورود/مجوز تعریف شده است",
  /register:\s*\{[\s\S]{0,160}requiresAuth:\s*false/.test(appService) &&
    !/register:\s*\{[\s\S]{0,160}requiresPermission/.test(appService),
);
check(
  "app.service: مسیر /register به صفحهٔ register نگاشت شده است",
  /"\/register":\s*"register"/.test(appService) &&
    /"\/register\.html":\s*"register"/.test(appService),
);
check("صفحهٔ ورود: پیوند ثبت‌نام مشتری دارد", /href="\/register"/.test(loginHtml));

// ============================================================
// ۴) api.const: اندپوینت‌های صف
// ============================================================
check(
  "api.const: بلوک REGISTRATIONS کامل است",
  /REGISTRATIONS:\s*\{[\s\S]*?CONFIG:[\s\S]*?CREATE:[\s\S]*?LIST:[\s\S]*?PENDING_COUNT:[\s\S]*?APPROVE:[\s\S]*?REJECT:/.test(
    apiConstSource,
  ),
);
check(
  "api.const: مسیرهای صف با مسیر سرور مطابق است",
  /CONFIG:\s*"\/registrations\/config"/.test(apiConstSource) &&
    /PENDING_COUNT:\s*"\/registrations\/pending-count"/.test(apiConstSource),
);

// ============================================================
// ۵) صف تأیید در پنل مدیریت
// ============================================================
check(
  "پنل: آیتم سایدبار با کلید منوی درست تعریف شده است",
  /data-menu="registration-requests"[\s\S]{0,160}data-permission="admin\.menu\.registrations"/.test(
    adminHtml,
  ),
);
check(
  "پنل: سکشن محتوا + جدول/فهرست صف وجود دارد",
  /id="registration-requests"[\s\S]{0,200}class="content-section"/.test(adminHtml) &&
    /id="registrationQueueContainer"/.test(adminHtml) &&
    /id="regStatusFilter"/.test(adminHtml),
);
check(
  "پنل: مودال بررسی (تأیید/رد) با انتخاب پروندهٔ مشتری وجود دارد",
  /id="regReviewModal"/.test(adminHtml) &&
    /id="regCustomerSelect"/.test(adminHtml) &&
    /id="regRejectReason"/.test(adminHtml) &&
    /id="regApproveBtn"/.test(adminHtml),
);
check(
  "سرویس پنل: کلید منو در menuPermissions ثبت شده است",
  /"registration-requests":\s*"admin\.menu\.registrations"/.test(adminService),
);
check(
  "سرویس پنل: loadMenuData برای بخش صف داده بارگذاری می‌کند",
  /case "registration-requests":[\s\S]{0,200}loadRegistrationRequests\(\)/.test(adminService),
);
check(
  "سرویس پنل: تأیید بدون customer_id ارسال نمی‌شود (گارد کلاینت)",
  /customerId <= 0/.test(adminService) &&
    /approveRegistration\(item\.id, customerId\)/.test(adminService),
);
check(
  "سرویس پنل: دلیل رد اجباری است (حداقل ۳ کاراکتر)",
  /reason\.length < 3/.test(adminService),
);
check(
  "سرویس پنل: بج «در انتظار تأیید» با مجوز view کنترل می‌شود",
  /registrationsMenuBadge/.test(adminHtml) &&
    /users\.registrations\.view/.test(adminService) &&
    /getRegistrationPendingCount/.test(adminService),
);
check(
  "رندرر: تمام فیلدهای مهمان با escapeHtml نمایش داده می‌شوند",
  /renderRegistrationRequests/.test(adminRenderer) &&
    /escapeHtml\(fullName/.test(adminRenderer) &&
    /escapeHtml\(item\.email/.test(adminRenderer) &&
    /escapeHtml\(item\.note\)/.test(adminRenderer),
);
check(
  "رندرر: دکمه‌های تأیید/رد فقط با مجوز review نمایش داده می‌شوند",
  /canReviewRegistrations/.test(adminRenderer) &&
    /users\.registrations\.review/.test(adminRenderer),
);
check(
  "API پنل: چهار متد صف با اندپوینت‌های REGISTRATIONS وجود دارد",
  /getRegistrations\(/.test(adminApi) &&
    /getRegistrationPendingCount\(/.test(adminApi) &&
    /approveRegistration\(/.test(adminApi) &&
    /rejectRegistration\(/.test(adminApi) &&
    /ENDPOINTS\.REGISTRATIONS/.test(adminApi),
);
check(
  "CSS پنل: استایل صف با پیشوند .regq- تعریف شده است",
  /\.regq-card/.test(adminCss) && /\.regq-row/.test(adminCss),
);
check(
  "پنل: سوییچ «ثبت‌نام عمومی» در تنظیمات سیستم وجود دارد",
  /id="publicRegisterToggle"/.test(adminHtml) &&
    /registration_enabled/.test(adminService),
);

// ============================================================
// ۶) هم‌راستایی کلیدهای مجوز (سرور ↔ پنل ↔ اندپوینت‌ها)
// ============================================================
const permissionKeys = [
  "admin.menu.registrations",
  "users.registrations.view",
  "users.registrations.review",
];
check(
  "کاتالوگ سرور: هر سه کلید تعریف شده‌اند",
  permissionKeys.every((key) => permissions.includes(`"${key}"`)),
  permissionKeys.join(","),
);
check(
  "کاتالوگ سرور: کلید تأیید/رد از کلید مشاهده جداست",
  permissions.includes('"users.registrations.view"') &&
    permissions.includes('"users.registrations.review"'),
);
check(
  "پنل: هر کلید کاتالوگ در سرویس/رندرر استفاده می‌شود",
  permissionKeys.every(
    (key) => adminService.includes(key) || adminRenderer.includes(key) || adminHtml.includes(key),
  ),
);
check(
  "پنل: خطای سرور (از جمله ۴۰۳ نداشتن users.customer.link) به کاربر نمایش داده می‌شود",
  /notificationService\.error\(response\?\.message \|\| "تأیید درخواست ناموفق بود"\)/.test(
    adminService,
  ),
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
