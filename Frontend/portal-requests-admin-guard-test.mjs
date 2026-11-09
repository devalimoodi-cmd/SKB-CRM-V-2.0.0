// ============================================================
//  گارد «صف درخواست‌های پورتال» (پنل مدیریت) — موج ۱۳.۱۱
// ------------------------------------------------------------
//  ریشهٔ خطری که این گارد از بازگشتش جلوگیری می‌کند:
//   ۱) اگر کارشناس بدون مجوز، دکمهٔ «تأیید» ببیند و سرور هم
//      نسنجد ⇒ هر بیننده‌ای می‌تواند دادهٔ عملیاتی بسازد.
//   ۲) اگر ماژول ادمین داده را بدون escape چاپ کند ⇒ مقادیر
//      «متن آزاد مشتری» (نام واحد/سالن/توضیح) می‌تواند HTML تزریق
//      کند (XSS در پنل کارکنان = بدترین حالت).
//   ۳) اگر فرم/مودال با تگ فرم و submit ساخته شود، الگوی «بدون فرم»
//      پروژه (۱۳.۸/۱۳.۱۰) می‌شکند و دکمهٔ تأیید ناخواسته submit
//      می‌شود.
//   ۴) اگر مسیرهای صف از لایهٔ API عبور نکنند (fetch خام)، هدر
//      احراز هویت و مدیریت خطا دور زده می‌شود.
//
//  اجرا:  npm run test:portal-requests   (در پوشهٔ Frontend)
// ============================================================
import fs from "node:fs";
import path from "node:path";

const here = import.meta.dirname;
const ROOT = path.join(here, "..");

const results = [];
const check = (name, ok, extra = "") => {
  results.push(ok);
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
const stripComments = (source) =>
  String(source || "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

// ============================================================
// ۰) فایل‌های این بخش
// ============================================================
const FILES = {
  api: "Frontend/src/features/portal-requests/portal-requests.api.js",
  manager: "Frontend/src/features/portal-requests/portal-requests.manager.js",
  renderer: "Frontend/src/features/portal-requests/portal-requests.renderer.js",
  css: "Frontend/src/features/portal-requests/portal-requests.css",
  adminHtml: "Frontend/src/pages/admin-panel.html",
  adminService: "Frontend/src/features/admin-panel/admin-panel.service.js",
  apiConst: "Frontend/src/core/constants/api.const.js",
  permissions: "Backend/config/permissions.js",
  backendRoutes: "Backend/routes/portalRequestRoutes.js",
  backendController: "Backend/controllers/portalRequestAdminController.js",
  backendService: "Backend/services/portalRequestService.js",
  pkg: "Frontend/package.json",
  gateMjs: "tools/gate.mjs",
  gatePs1: "tools/gate.ps1",
  docs: "docs/REVIEW-WAVE-13.11.md",
};

check(
  "همهٔ فایل‌های بخش صف موجودند",
  Object.values(FILES).every(exists),
  Object.entries(FILES)
    .filter(([, rel]) => !exists(rel))
    .map(([key]) => key)
    .join(","),
);

const SRC = {
  api: read(FILES.api),
  manager: read(FILES.manager),
  renderer: read(FILES.renderer),
  css: read(FILES.css),
  adminHtml: read(FILES.adminHtml),
  adminService: read(FILES.adminService),
  apiConst: read(FILES.apiConst),
  permissions: read(FILES.permissions),
  backendRoutes: read(FILES.backendRoutes),
  backendController: read(FILES.backendController),
  backendService: read(FILES.backendService),
  pkg: read(FILES.pkg),
  gateMjs: read(FILES.gateMjs),
  gatePs1: read(FILES.gatePs1),
  docs: read(FILES.docs),
};

// ============================================================
// ۱) لایهٔ API: مسیرها درست و از apiService (هدر احراز هویت)
// ============================================================
check(
  "API: همهٔ فراخوانی‌ها از apiService و روی اندپوینت‌های PORTAL_REQUESTS",
  /import \{ apiService \}/.test(SRC.api) &&
    /API_CONSTANTS\.ENDPOINTS\.PORTAL_REQUESTS\.LIST/.test(SRC.api) &&
    /PORTAL_REQUESTS\.PENDING_COUNT/.test(SRC.api) &&
    /PORTAL_REQUESTS\.DETAIL\(rowId\(id\)\)/.test(SRC.api) &&
    /PORTAL_REQUESTS\.APPROVE\(rowId\(id\)\)/.test(SRC.api) &&
    /PORTAL_REQUESTS\.REJECT\(rowId\(id\)\)/.test(SRC.api) &&
    // ❌ هیچ fetch/axios خامی در این لایه نیست
    !/\bfetch\(/.test(stripComments(SRC.api)) &&
    !/axios/.test(SRC.api),
);

check(
  "API: شناسهٔ درخواست اعتبارسنجی می‌شود (ضد تزریق در URL)",
  /const ROW_ID_PATTERN = \/\^\\d\{1,9\}\$\//.test(SRC.api) &&
    /const rowId = \(value\) => \{/.test(SRC.api) &&
    /شناسهٔ درخواست نامعتبر است/.test(SRC.api) &&
    (SRC.api.match(/rowId\(id\)/g) || []).length >= 3,
);

check(
  "API: فهرست با صفحه‌بندی محدود و فیلترهای بسته فرستاده می‌شود",
  /limit: Math\.min\(Math\.max\(1, parseInt\(limit, 10\) \|\| 20\), 50\)/.test(
    SRC.api,
  ) &&
    /if \(status\) params\.status = String\(status\)/.test(SRC.api) &&
    /if \(term\) params\.search = term\.slice\(0, 60\)/.test(SRC.api),
);

check(
  "API: تأیید/رد بدنهٔ مینیمال دارند (payload اختیاری، دلیل بریده‌شده)",
  /payload && typeof payload === "object" \? \{ payload \} : \{\}/.test(SRC.api) &&
    /reason: String\(reason \?\? ""\)\.trim\(\)\.slice\(0, 300\)/.test(SRC.api),
);

// ============================================================
// ۲) رندرر: escape کامل و برچسب‌های ثابت
// ============================================================
check(
  "رندرر: تابع escape همهٔ کاراکترهای خطرناک را می‌پوشاند",
  /const esc = \(value\) =>/.test(SRC.renderer) &&
    /\.replace\(\/&\/g, "&amp;"\)/.test(SRC.renderer) &&
    /\.replace\(\/<\/g, "&lt;"\)/.test(SRC.renderer) &&
    /\.replace\(\/>\/g, "&gt;"\)/.test(SRC.renderer) &&
    /\.replace\(\/"\/g, "&quot;"\)/.test(SRC.renderer) &&
    /\.replace\(\/'\/g, "&#39;"\)/.test(SRC.renderer),
);

check(
  "رندرر: هر مقدار سرور از esc عبور می‌کند (پرهیز از innerHTML خام)",
  // شناسه/نام/وضعیت/دلیل/مقادیر payload همه esc شده‌اند
  /\$\{esc\(item\.id\)\}/.test(SRC.renderer) &&
    /\$\{esc\(item\.customer_id\)\}/.test(SRC.renderer) &&
    /\$\{esc\(value\)\}/.test(SRC.renderer) &&
    /\$\{esc\(badge/.test(SRC.renderer) === false &&
    /\$\{badge\(item\.status\)\}/.test(SRC.renderer) &&
    /\$\{esc\(item\.reject_reason\)\}/.test(SRC.renderer),
);

check(
  "رندرر: برچسب نوع/وضعیت از نقشهٔ ثابت می‌آید (نه کلید خام)",
  /export const REQUEST_TYPE_LABELS = \{/.test(SRC.renderer) &&
    /unit_create: "ثبت واحد مرغداری"/.test(SRC.renderer) &&
    /hall_create: "ثبت سالن"/.test(SRC.renderer) &&
    /placement_create: "ثبت جوجه‌ریزی"/.test(SRC.renderer) &&
    /export const REQUEST_STATUS_LABELS = \{/.test(SRC.renderer),
);

check(
  "رندرر: ویرایش payload پیش از تأیید همان کلیدهای شناخته‌شده را دارد",
  /export const PAYLOAD_LABELS = \{/.test(SRC.renderer) &&
    /export const renderPayloadEditor = \(payload = \{\}\) =>/.test(SRC.renderer) &&
    /data-prq-key="\$\{esc\(key\)\}"/.test(SRC.renderer) &&
    /data-prq-type="\$\{inputType === "number" \? "number" : "text"\}"/.test(
      SRC.renderer,
    ),
);

check(
  "رندرر: هیچ تگ فرم/submit ساخته نمی‌شود",
  !/<form/i.test(stripComments(SRC.renderer)) &&
    !/type="submit"/i.test(SRC.renderer) &&
    !/method="post"/i.test(SRC.renderer),
);

// ============================================================
// ۳) مدیر: گیت مجوز، مسیرهای تصمیم، بدون confirm بومی
// ============================================================
check(
  "مدیر: تصمیم‌گیری فقط با مجوز portal.requests.review",
  /permissionService\.can\("portal\.requests\.review"\)/.test(SRC.manager) &&
    /const canReviewRequests = \(\) => \{/.test(SRC.manager) &&
    /portalRequestsApi\.approve\(/.test(SRC.manager) &&
    /portalRequestsApi\.reject\(/.test(SRC.manager),
);

check(
  "مدیر: دلیل رد پیش از ارسال سنجیده می‌شود (≥۳ کاراکتر)",
  /if \(reason\.length < 3\) \{/.test(SRC.manager) &&
    /دلیل رد را بنویسید/.test(SRC.manager),
);

check(
  "مدیر: مقادیر اصلاح‌شده فقط از فیلدهای داده‌شده خوانده می‌شوند",
  /container\.querySelectorAll\("\[data-prq-key\]"\)/.test(SRC.manager) &&
    /data-prq-type/.test(SRC.manager) &&
    /if \(!key\) return;/.test(SRC.manager),
);

check(
  "مدیر: بدون alert/confirm بومی و بدون نوشتن مستقیم در localStorage",
  !/\balert\(/.test(stripComments(SRC.manager)) &&
    !/\bconfirm\(/.test(stripComments(SRC.manager)) &&
    !/localStorage\.setItem/.test(SRC.manager),
);

check(
  "مدیر: نشان صف از سرور و بی‌صدا در صورت خطا (best-effort)",
  /async refreshBadge\(fallback = null\)/.test(SRC.manager) &&
    /await portalRequestsApi\.pendingCount\(\)/.test(SRC.manager) &&
    /badge\.style\.display = count > 0 \? "inline-block" : "none"/.test(
      SRC.manager,
    ),
);

check(
  "مدیر: ماژول روی window نصب می‌شود (بارگذاری دینامیک سرویس پنل)",
  /window\.portalRequestsManager = portalRequestsManager;/.test(SRC.manager) &&
    /export const portalRequestsManager = \{/.test(SRC.manager),
);

// ============================================================
// ۴) صفحهٔ پنل: منو/بخش/مودال با شناسه‌های یکتا
// ============================================================
check(
  "صفحه: آیتم سایدبار با کلید منو و نشان شمارنده",
  /data-menu="portal-requests"/.test(SRC.adminHtml) &&
    /data-permission="admin\.menu\.portalRequests"/.test(SRC.adminHtml) &&
    /id="portalRequestsMenuBadge"/.test(SRC.adminHtml),
);

check(
  "صفحه: بخش صف با فیلترها و ظرف فهرست",
  /id="portal-requests" class="content-section"/.test(SRC.adminHtml) &&
    /id="prqStatusFilter"/.test(SRC.adminHtml) &&
    /id="prqTypeFilter"/.test(SRC.adminHtml) &&
    /id="prqSearchInput"/.test(SRC.adminHtml) &&
    /id="prqRefreshBtn"/.test(SRC.adminHtml) &&
    /id="portalRequestsQueue"/.test(SRC.adminHtml),
);

check(
  "صفحه: مودال بازبینی با دکمه‌های type=button (بدون submit)",
  /id="portalRequestsModal"/.test(SRC.adminHtml) &&
    /id="portalRequestsModalBody"/.test(SRC.adminHtml) &&
    /data-prq-modal-approve/.test(SRC.adminHtml) &&
    /data-prq-modal-reject/.test(SRC.adminHtml) &&
    /data-prq-modal-close/.test(SRC.adminHtml) &&
    !/type="submit"/i.test(SRC.adminHtml),
);

check(
  "صفحه: استایل صف به صفحه لینک شده است",
  /features\/portal-requests\/portal-requests\.css/.test(SRC.adminHtml) &&
    /\.prq-table/.test(SRC.css) &&
    /\.prq-modal\.is-open/.test(SRC.css),
);

// ============================================================
// ۵) سیم‌کشی سرویس پنل
// ============================================================
check(
  "سرویس پنل: کلید منو ثبت شده و به ماژول واگذار می‌شود",
  /"portal-requests": "admin\.menu\.portalRequests",/.test(SRC.adminService) &&
    /case "portal-requests":/.test(SRC.adminService) &&
    /await this\.initPortalRequestsManager\(\);/.test(SRC.adminService) &&
    /await import\("\.\.\/portal-requests\/portal-requests\.manager\.js"\)/.test(
      SRC.adminService,
    ),
);

check(
  "سرویس پنل: ماژول یافت‌نشده به پیام کاربر تبدیل می‌شود (fail-safe)",
  /اگر ماژول درخواست‌های پورتال یافت نشد|ماژول درخواست‌های پورتال یافت نشد/.test(
    SRC.adminService,
  ) &&
    /console\.warn\("⚠️ portalRequestsManager در دسترس نیست"\)/.test(
      SRC.adminService,
    ),
);

// ============================================================
// ۶) سرور: مرز نقش‌ها و اعمال تراکنشی
// ============================================================
check(
  "سرور: مسیر صف مجوز صریح دارد و authorize(customer) ندارد",
  /requirePermission\("portal\.requests\.view"\)/.test(SRC.backendRoutes) &&
    /requirePermission\("portal\.requests\.review"\)/.test(SRC.backendRoutes) &&
    /router\.use\(protect\);/.test(SRC.backendRoutes) &&
    !/authorize\(/.test(stripComments(SRC.backendRoutes)),
);

check(
  "سرور: تأیید/رد با شناسه و از کنترلر اختصاصی صف",
  /router\.post\("\/:id\/approve", \.\.\.reviewChain, controller\.approveRequest\);/.test(
    SRC.backendRoutes,
  ) &&
    /router\.post\("\/:id\/reject", \.\.\.reviewChain, controller\.rejectRequest\);/.test(
      SRC.backendRoutes,
    ) &&
    /module\.exports = \{/.test(SRC.backendController) &&
    /approveRequest,/.test(SRC.backendController) &&
    /rejectRequest,/.test(SRC.backendController),
);

check(
  "سرور: اعمال درخواست تراکنشی و با قفل ردیف است",
  /const transaction = await sequelize\.transaction\(\);/.test(
    SRC.backendService,
  ) &&
    /lock: transaction\.LOCK\.UPDATE/.test(SRC.backendService) &&
    /await transaction\.commit\(\);/.test(SRC.backendService) &&
    /const safeRollback = async \(transaction\) => \{/.test(SRC.backendService),
);

check(
  "کاتالوگ: کلیدهای صف در گروه اختصاصی و منو در گروه منوها",
  /"portal\.requests\.view"/.test(SRC.permissions) &&
    /"portal\.requests\.review"/.test(SRC.permissions) &&
    /key: "portalRequests"/.test(SRC.permissions) &&
    /admin\.menu\.portalRequests/.test(SRC.permissions),
);

// ============================================================
// ۷) تست/گیت/مستندات
// ============================================================
check(
  "گیت: تست این بخش در package.json و gate ثبت شده است",
  /"test:portal-requests": "node portal-requests-admin-guard-test\.mjs"/.test(
    SRC.pkg,
  ) &&
    /test:portal-requests/.test(SRC.gateMjs) &&
    /test:portal-requests/.test(SRC.gatePs1),
);

check(
  "مستندات: موج ۱۳.۱۱ صف/تأیید/تراکنش را توضیح می‌دهد",
  /۱۳\.۱۱/.test(SRC.docs) &&
    /الگوی ب/.test(SRC.docs) &&
    /تراکنش/.test(SRC.docs) &&
    /portal\.requests\.review/.test(SRC.docs),
);

// ============================================================
// خلاصه
// ============================================================
const failed = results.filter((ok) => !ok).length;
console.log(
  `\n${failed === 0 ? "✅" : "❌"} ${results.length - failed}/${results.length} بررسی موفق`,
);

if (failed > 0) {
  console.log("FAIL - گارد صف درخواست‌های پورتال شکست خورد");
  process.exit(1);
}
