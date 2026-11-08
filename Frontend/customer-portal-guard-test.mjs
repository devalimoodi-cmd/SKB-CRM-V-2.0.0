// ============================================================
//  گارد «پورتال مشتری» — فاز ۱۳.۲
// ------------------------------------------------------------
//  ریشهٔ خطری که این گارد از بازگشتش جلوگیری می‌کند:
//   ۱) بدون customer_id در protect، اسکوپ سمت سرور ناممکن است و
//      «دادهٔ خودم» فقط به localStorage کلاینت تکیه می‌کرد
//      (یک ?id= کافی بود تا پروندهٔ مشتری دیگری دیده شود).
//   ۲) اگر شناسهٔ درخواستی بر پروندهٔ توکن اولویت بگیرد ⇒ IDOR:
//      مشتری با ?id= همسایه، دادهٔ او را می‌بیند.
//   ۳) اگر حسابی به پرونده متصل نباشد و به‌جای ۴۰۳ «همه‌چیز» را
//      ببیند ⇒ نشت داده؛ و اگر ۵۰۰ بدهد ⇒ پیام نامفهوم.
//   ۴) اگر برای پورتال، کلیدهای موجود (halls.view، weekly.view …)
//      روشن می‌شدند، ۲۰ مسیر موجود هم برای مشتری باز می‌شد؛
//      گزینهٔ الف می‌گوید: حداقل سطح تماس، صفر تغییر در مسیرها.
//   ۵) اگر پورتال دکمهٔ نوشتن داشت، «فقط خواندنی» بودن از دست می‌رفت.
//
//  اجرا:  npm run test:customer-portal      (در پوشهٔ Frontend)
//  ⭐ بخش‌های ۳ و ۴ منطق واقعی را **اجرا** می‌کنند (بدون دیتابیس).
// ============================================================
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
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

// حذف توضیحات تا بررسی‌های «نبود الگو» با متن کامنت گمراه نشوند
const stripComments = (source) =>
  String(source || "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

// ============================================================
// ۰) فایل‌های این فاز
// ============================================================
const FILES = {
  auth: "Backend/middleware/auth.js",
  rules: "Backend/services/customerScopeRules.js",
  middleware: "Backend/middleware/customerScope.js",
  controller: "Backend/controllers/portalController.js",
  routes: "Backend/routes/portalRoutes.js",
  permissions: "Backend/config/permissions.js",
  permissionsTest: "Backend/permissions-test.mjs",
  loginOtp: "Backend/controllers/loginOtpController.js",
  pagination: "Backend/utils/pagination.js",
  server: "Backend/server.js",
  apiConst: "Frontend/src/core/constants/api.const.js",
  portalApi: "Frontend/src/features/portal/portal.api.js",
  portalRenderer: "Frontend/src/features/portal/portal.renderer.js",
  portalService: "Frontend/src/features/portal/portal.service.js",
  // ✅ موج ۱۳.۸ — تب‌های «پروفایل من» و «داشبورد تحلیلی» (mixin)
  portalExtra: "Frontend/src/features/portal/portal.extra.js",
  portalCss: "Frontend/src/features/portal/portal.css",
  portalHtml: "Frontend/src/pages/portal.html",
  appService: "Frontend/src/core/services/app.service.js",
  customerInfo: "Frontend/src/features/customer-info/customer-info.service.js",
  headerBookmarks:
    "Frontend/src/shared/layouts/Header/header-bookmarks.service.js",
  headerHtml: "Frontend/src/shared/layouts/Header/header.html",
  messagesService: "Frontend/src/features/messages/messages.service.js",
  infoPagesCss: "Frontend/src/styles/info-pages.css",
  permissionManager:
    "Frontend/src/features/admin-panel/permission.manager.js",
  adminPanelCss: "Frontend/src/features/admin-panel/admin-panel.css",
  frontendServer: "Frontend/server.js",
  pkg: "Frontend/package.json",
  gateMjs: "tools/gate.mjs",
  gatePs1: "tools/gate.ps1",
  docs: "docs/REVIEW-WAVE-13.2.md",
  docs133: "docs/REVIEW-WAVE-13.3.md",
  docs134: "docs/REVIEW-WAVE-13.4.md",
  docs135: "docs/REVIEW-WAVE-13.5.md",
  docs1351: "docs/REVIEW-WAVE-13.5.1.md",
  // ✅ موج ۱۳.۸ — پروفایل من + داشبورد تحلیلی
  docs138: "docs/REVIEW-WAVE-13.8.md",
  // ✅ موج ۱۳.۹ — تکمیل PWA: پوستهٔ آفلاین + نوار نصب
  docs139: "docs/REVIEW-WAVE-13.9.md",
  pwaManifest: "Frontend/src/public/manifest.webmanifest",
  pwaSw: "Frontend/src/public/sw.js",
  pwaOffline: "Frontend/src/public/offline.html",
};

check(
  "همهٔ فایل‌های فاز ۱۳.۲ موجودند",
  Object.values(FILES).every(exists),
  Object.entries(FILES)
    .filter(([, rel]) => !exists(rel))
    .map(([key]) => key)
    .join(","),
);

const SRC = {
  auth: read(FILES.auth),
  rules: read(FILES.rules),
  middleware: read(FILES.middleware),
  controller: read(FILES.controller),
  routes: read(FILES.routes),
  permissions: read(FILES.permissions),
  permissionsTest: read(FILES.permissionsTest),
  loginOtp: read(FILES.loginOtp),
  pagination: read(FILES.pagination),
  server: read(FILES.server),
  apiConst: read(FILES.apiConst),
  portalApi: read(FILES.portalApi),
  portalRenderer: read(FILES.portalRenderer),
  portalService: read(FILES.portalService),
  portalExtra: read(FILES.portalExtra),
  portalCss: read(FILES.portalCss),
  portalHtml: read(FILES.portalHtml),
  appService: read(FILES.appService),
  customerInfo: read(FILES.customerInfo),
  headerBookmarks: read(FILES.headerBookmarks),
  headerHtml: read(FILES.headerHtml),
  messagesService: read(FILES.messagesService),
  infoPagesCss: read(FILES.infoPagesCss),
  permissionManager: read(FILES.permissionManager),
  adminPanelCss: read(FILES.adminPanelCss),
  frontendServer: read(FILES.frontendServer),
  pkg: read(FILES.pkg),
  gateMjs: read(FILES.gateMjs),
  gatePs1: read(FILES.gatePs1),
};

// ============================================================
// ۱) احراز هویت: customer_id از دیتابیس تا req.user
// ============================================================
check(
  "auth: ستون customer_id در attributes کوئری کاربر خوانده می‌شود",
  /attributes:\s*\[[\s\S]{0,600}?"customer_id",/.test(SRC.auth),
);

check(
  "auth: req.user.customer_id ست می‌شود (منبع اسکوپ سرور)",
  /customer_id:\s*user\.customer_id\s*\?\?\s*null/.test(SRC.auth),
);

// ============================================================
// ۲) منطق خالص (اجرای واقعی — بدون دیتابیس)
// ============================================================
const rulesPath = path.join(ROOT, "Backend", "services", "customerScopeRules.js");
const rules = require(rulesPath);

check(
  "قانون: شناسهٔ معتبر فقط عدد صحیح مثبت است",
  rules.normalizeCustomerId("12") === 12 &&
    rules.normalizeCustomerId(7) === 7 &&
    rules.normalizeCustomerId(" 0042 ") === 42 &&
    rules.normalizeCustomerId("1.5") === null &&
    rules.normalizeCustomerId("-3") === null &&
    rules.normalizeCustomerId("0") === null &&
    rules.normalizeCustomerId("abc") === null &&
    rules.normalizeCustomerId("12abc") === null &&
    rules.normalizeCustomerId("") === null &&
    rules.normalizeCustomerId(null) === null &&
    rules.normalizeCustomerId(undefined) === null &&
    rules.normalizeCustomerId(true) === null &&
    rules.normalizeCustomerId({ id: 1 }) === null,
);

check(
  "قانون: نقش مشتری و نقش‌های کارکنان درست تشخیص داده می‌شوند",
  rules.isCustomerRole("customer") &&
    rules.isCustomerRole(" CUSTOMER ") &&
    !rules.isCustomerRole("admin") &&
    rules.isStaffRole("expert") &&
    rules.isStaffRole("super_admin") &&
    !rules.isStaffRole("customer"),
);

const scopeCase = (input) => rules.resolveScopeCustomerId(input);
const caseNoLink = scopeCase({ role: "customer", ownCustomerId: null });
const caseSelf = scopeCase({ role: "customer", ownCustomerId: 12 });
const caseSelfRequested = scopeCase({
  role: "customer",
  ownCustomerId: 12,
  requested: "12",
});
const caseOther = scopeCase({
  role: "customer",
  ownCustomerId: 12,
  requested: "13",
});
const caseBad = scopeCase({
  role: "customer",
  ownCustomerId: 12,
  requested: "abc",
});
const caseEmptyRequested = scopeCase({
  role: "customer",
  ownCustomerId: 12,
  requested: "",
});
const caseStaff = scopeCase({ role: "admin", requested: "13" });
const caseUnknownRole = scopeCase({ role: undefined, requested: "5" });

check(
  "قانون: مشتری بدون پروندهٔ متصل ⇒ رد با دلیل no_link",
  caseNoLink.ok === false &&
    caseNoLink.reason === "no_link" &&
    caseNoLink.code === "CUSTOMER_LINK_MISSING" &&
    /متصل نشده است/.test(caseNoLink.message),
);

check(
  "قانون: مشتری متصل بدون شناسهٔ درخواستی ⇒ پروندهٔ خودش",
  caseSelf.ok === true && caseSelf.id === 12 && caseSelf.reason === "self",
);

check(
  "قانون: شناسهٔ درخواستی برابر پروندهٔ خودش ⇒ مجاز",
  caseSelfRequested.ok === true && caseSelfRequested.id === 12,
);

check(
  "قانون: شناسهٔ درخواستی مشتری دیگر ⇒ رد با کد CUSTOMER_SCOPE_DENIED",
  caseOther.ok === false &&
    caseOther.reason === "other_customer" &&
    caseOther.code === "CUSTOMER_SCOPE_DENIED" &&
    caseOther.id === null,
);

check(
  "قانون: شناسهٔ نامعتبر ⇒ رد (به «خودش» تفسیر نمی‌شود)",
  caseBad.ok === false &&
    caseBad.reason === "bad_id" &&
    caseBad.code === "CUSTOMER_SCOPE_BAD_ID",
);

check(
  "قانون: شناسهٔ تهی/فاصله ⇒ همان پروندهٔ خودش (نه خطا)",
  caseEmptyRequested.ok === true && caseEmptyRequested.id === 12,
);

check(
  "قانون: نقش کارمند از اسکوپ «فقط خودم» معاف است (سازگاری کامل)",
  caseStaff.ok === true &&
    caseStaff.reason === "role_bypass" &&
    caseStaff.id === 13 &&
    caseUnknownRole.ok === true,
);

check(
  "قانون: خط لاگ تلاش ردشده، بدون دادهٔ حساس ساخته می‌شود",
  (() => {
    const line = rules.scopeAuditLine({
      userId: 7,
      role: "customer",
      reason: "other_customer",
      method: "GET",
      url: "/api/x",
      requestedId: 99,
    });
    return (
      /customer-scope/.test(line) &&
      /other_customer/.test(line) &&
      !/password|token|secret/i.test(line)
    );
  })(),
);

// ============================================================
// ۳) میان‌افزار (اجرای واقعی با req/res ساختگی)
// ============================================================
const scopeMw = require(
  path.join(ROOT, "Backend", "middleware", "customerScope.js"),
);

const fakeReq = (user, extra = {}) => ({
  user,
  query: {},
  params: {},
  body: {},
  method: "GET",
  originalUrl: "/api/portal/me",
  ...extra,
});

const run = (mw, req) => {
  const out = { status: null, body: null, nexted: false };
  const res = {
    status(code) {
      out.status = code;
      return this;
    },
    json(payload) {
      out.body = payload;
      return this;
    },
  };
  mw(req, res, () => {
    out.nexted = true;
  });
  return out;
};

const unlinkResult = run(
  scopeMw.requireCustomerLink,
  fakeReq({ id: 7, role: "customer", customer_id: null }),
);
const linkReq = fakeReq({ id: 7, role: "customer", customer_id: 12 });
const linkResult = run(scopeMw.requireCustomerLink, linkReq);
const staffLinkResult = run(
  scopeMw.requireCustomerLink,
  fakeReq({ id: 1, role: "admin", customer_id: null }),
);
const noUserResult = run(scopeMw.requireCustomerLink, { query: {} });

check(
  "میان‌افزار: مشتری بدون پیوند ⇒ ۴۰۳ با کد CUSTOMER_LINK_MISSING",
  unlinkResult.status === 403 &&
    unlinkResult.body?.code === "CUSTOMER_LINK_MISSING" &&
    unlinkResult.nexted === false,
);

check(
  "میان‌افزار: مشتری متصل ⇒ عبور و ست‌شدن req.customerScopeId",
  linkResult.nexted === true && linkReq.customerScopeId === 12,
);

check(
  "میان‌افزار: کارکنان بی‌تغییر عبور می‌کنند (صفر تغییر رفتاری)",
  staffLinkResult.nexted === true && staffLinkResult.status === null,
);

check(
  "میان‌افزار: درخواست بدون کاربر ⇒ ۴۰۱",
  noUserResult.status === 401 && noUserResult.nexted === false,
);

check(
  "میان‌افزار: شناسهٔ مشتری دیگر برای نقش مشتری ⇒ ۴۰۳ (IDOR بسته است)",
  (() => {
    const req = fakeReq({ id: 7, role: "customer", customer_id: 12 }, {
      query: { id: "99" },
    });
    const out = run(
      scopeMw.enforceSelfCustomer({ source: "query", key: "id" }),
      req,
    );
    return (
      out.status === 403 &&
      out.body?.code === "CUSTOMER_SCOPE_DENIED" &&
      req.customerScopeId === undefined
    );
  })(),
);

check(
  "میان‌افزار: شناسهٔ خودش ⇒ عبور + ست‌شدن اسکوپ",
  (() => {
    const req = fakeReq({ id: 7, role: "customer", customer_id: "12" }, {
      query: { id: "12" },
    });
    const out = run(
      scopeMw.enforceSelfCustomer({ source: "query", key: "id" }),
      req,
    );
    return out.nexted === true && req.customerScopeId === 12;
  })(),
);

check(
  "میان‌افزار: enforceSelfCustomer برای کارمند رد نمی‌کند (params)",
  (() => {
    const req = fakeReq({ id: 1, role: "expert" }, { params: { id: "44" } });
    const out = run(
      scopeMw.enforceSelfCustomer({ source: "params", key: "id" }),
      req,
    );
    return out.nexted === true && out.status === null;
  })(),
);

check(
  "میان‌افزار: attachCustomerScope مشتری بدون پیوند را linked=false می‌کند",
  (() => {
    const req = fakeReq({ id: 7, role: "customer", customer_id: null });
    const out = run(scopeMw.attachCustomerScope, req);
    return (
      out.nexted === true &&
      req.customerScope?.isCustomer === true &&
      req.customerScope?.linked === false &&
      req.customerScope?.customerId === null
    );
  })(),
);

check(
  "میان‌افزار: allowCustomerRead ترکیب authorize + اسکوپ می‌سازد",
  Array.isArray(
    scopeMw.allowCustomerRead({ source: "params", key: "id", roles: ["admin"] }),
  ) &&
    scopeMw.allowCustomerRead({ roles: ["admin"] }).length === 2 &&
    /authorize\(\.\.\.new Set\(\[\.\.\.roles,\s*CUSTOMER_ROLE\]\)\)/.test(
      SRC.middleware,
    ),
);

// ============================================================
// ۴) کنترلر: مرز دادهٔ خودم، بدون پارامتر کلاینت
// ============================================================
check(
  "کنترلر: هیچ شناسهٔ «مشتری» از req.query / req.body / req.params خوانده نمی‌شود",
  // ✅ موج ۱۳.۸: req.body تنها در یک جا مجاز است — PATCH پروفایل خودم،
  //    که ورودی‌اش با فهرست سفید (portalProfileRules) پاک می‌شود و هیچ
  //    شناسهٔ مشتری/ردیف از آن خوانده نمی‌شود.
  !/req\.(query|body|params)(\.|\[\s*["'])(customer_id|customerId)\b/.test(
    SRC.controller,
  ) &&
    (SRC.controller.match(/req\.body/g) || []).length === 1 &&
    // تنها استفادهٔ مجاز از req.query: کل شیء به صفحه‌بندی داده می‌شود
    (SRC.controller.match(/paging\(req\.query\)/g) || []).length === 4 &&
    !/req\.query\./.test(SRC.controller) &&
    !/req\.query\[/.test(SRC.controller),
);

// ۱۳.۴ — استثنای محدود و ممیزی‌شده: فقط شناسهٔ «ردیف خودم» از مسیر
const portalParamReads = (SRC.controller.match(/req\.params\.[A-Za-z_]+/g) || []).sort();
check(
  "کنترلر (۱۳.۴): از req.params فقط id و attachmentId خوانده می‌شود",
  portalParamReads.length > 0 &&
    portalParamReads.every((read) =>
      ["req.params.id", "req.params.attachmentId"].includes(read),
    ),
  [...new Set(portalParamReads)].join(",") || "none",
);

// ۱۳.۴ — مالکیت: هر خواندن ردیف (هفته/بازدید) با customer_id در همان where
const portalOwnershipChecks = (
  SRC.controller.match(
    /(WeeklyManagement|VisitReport)\.(findOne|count)\(\{\s*where:\s*\{\s*id:[^}]*customer_id:\s*customerId/g,
  ) || []
).length;
check(
  "کنترلر (۱۳.۴): مالکیت ردیف با customer_id در همان where سنجیده می‌شود",
  portalOwnershipChecks >= 3,
  `ownership=${portalOwnershipChecks}`,
);

check(
  "کنترلر: اسکوپ فقط از req.customerScopeId ساخته می‌شود",
  /normalizeCustomerId\(req\.customerScopeId\)/.test(SRC.controller) &&
    /normalizeCustomerId\(req\.customerScope\?\.customerId\)/.test(
      SRC.controller,
    ),
);

check(
  "کنترلر: پنجرهٔ هر کوئری با customer_id بسته می‌شود",
  /const scope = \{ customer_id: customerId \};/.test(SRC.controller) &&
    (SRC.controller.match(/\.\.\.scope/g) || []).length >= 8,
);

check(
  "کنترلر: هر پنج مدل لازم کوئری می‌شوند (پرونده، سالن، گله، هفتگی، بازدید)",
  [
    "CustomerPersonalInfo",
    "Hall",
    "Flock",
    "WeeklyManagement",
    "VisitReport",
  ].every((model) => new RegExp(`require\\("\\.\\./models/${model}"\\)`).test(SRC.controller)),
);

check(
  "کنترلر: خروجی «آخرین‌ها» حداکثر ۳ ردیف است (سبک و بی‌ریسک)",
  /const LATEST_LIMIT = 3;/.test(SRC.controller) &&
    (SRC.controller.match(/limit: LATEST_LIMIT/g) || []).length === 3,
);

check(
  "کنترلر: فیلدهای حساس مشتری فقط در پروندهٔ «خودم» دیده می‌شوند",
  // ✅ موج ۱۳.۸: صاحب پرونده این فیلدها را در تب «پروفایل من» می‌بیند،
  //    ولی هیچ‌کدام در «نمایش حداقلی» خلاصه/فهرست‌ها نیستند:
  //    customerView() همچنان بدون کد ملی/کد پستی/آدرس/شمارهٔ پیام‌رسان است.
  (() => {
    const summaryView =
      (SRC.controller.match(/const customerView = \(row\) => \(\{[\s\S]*?\}\);/) ||
        [])[0] || "";
    return (
      summaryView.length > 0 &&
      !/national_code|postal_code|farm_address|messaging_number/.test(summaryView) &&
      // و در فهرست سفید پروفایل (PROFILE_ATTRIBUTES) حاضرند
      ["national_code", "postal_code", "farm_address", "messaging_number"].every(
        (field) => SRC.controller.includes(`"${field}"`),
      )
    );
  })(),
);

// ============================================================
// ۵) مسیر پورتال: زنجیرهٔ دسترسی و بدون هیچ مسیر نوشتنی
// ============================================================
// زنجیرهٔ دسترسی فقط از بدنهٔ router سنجیده می‌شود (نه توضیحات بالای فایل)
const routeBody = SRC.routes.slice(
  SRC.routes.indexOf("router.use(protect)"),
);
const chain = [
  'router.use(protect)',
  'authorize("customer")',
  'requirePermission("customer.portal.view")',
  "requireCustomerLink",
  "portalController.getPortalSummary",
].map((needle) => routeBody.indexOf(needle));

check(
  "مسیر: زنجیرهٔ protect → authorize(customer) → permission → scope → controller",
  chain.every((index) => index >= 0) &&
    chain[0] < chain[1] &&
    chain[1] < chain[2] &&
    chain[2] < chain[3] &&
    chain[3] < chain[4],
  chain.join(","),
);

check(
  "مسیر: ۱۳ GET خواندنی + فقط سه نوشتنِ پروفایل (بدون PUT/DELETE)",
  // ✅ موج ۱۳.۸: ۸ مسیر خواندنی قبلی + pروفایل + چهار مسیر داشبورد = ۱۳
  (SRC.routes.match(/router\.get\(/g) || []).length === 13 &&
    (SRC.routes.match(/router\.patch\(/g) || []).length === 1 &&
    (SRC.routes.match(/router\.post\(/g) || []).length === 2 &&
    !/router\.(put|delete)\(/.test(SRC.routes) &&
    // نوشتن‌ها فقط روی مسیرهای پروفایل‌اند
    /"\/profile",\s*\n\s*\.\.\.profileEditChain/.test(SRC.routes) &&
    /"\/profile\/mobile\/request"/.test(SRC.routes) &&
    /"\/profile\/mobile\/confirm"/.test(SRC.routes),
);

check(
  "مسیر: خلاصه از زنجیرهٔ مشترک و هر تب از زنجیرهٔ خودش (۱۳.۵) عبور می‌کند",
  /const customerChain = \[/.test(SRC.routes) &&
    /router\.get\("\/me", \.\.\.customerChain/.test(SRC.routes) &&
    /const tabChain = \(key\) => \[\.\.\.customerChain, requirePermission\(key\)\]/.test(
      SRC.routes,
    ) &&
    (SRC.routes.match(/\.\.\.tabChain\("customer\.portal\.[a-z]+"\)/g) || [])
      .length === 5,
);

// ✅ ۱۳.۵ — هر تب پورتال کلید مجوز مستقل خودش را دارد
check(
  "مسیر (۱۳.۵): هر تب پورتال کلید مجوز مستقل خودش را دارد",
  ["halls", "flocks", "weeks", "visits"].every((name) =>
    new RegExp(`\\.\\.\\.tabChain\\("customer\\.portal\\.${name}"\\)`).test(
      SRC.routes,
    ),
  ) &&
    /requirePermission\("customer\.portal\.visits"\),\s*requirePermission\("customer\.portal\.visit\.report"\)/.test(
      SRC.routes,
    ),
);

// ۱۳.۴ — مسیرهای محتوای گزارش بازدید، کلید مجوز جدا دارند
check(
  "مسیر (۱۳.۴): بازدید/پیوست از زنجیرهٔ visitReportChain (کلید جدا) عبور می‌کنند",
  /const visitReportChain = \[/.test(SRC.routes) &&
    /requirePermission\("customer\.portal\.visit\.report"\)/.test(SRC.routes) &&
    (SRC.routes.match(/\.\.\.visitReportChain,/g) || []).length === 2,
);

check(
  "سرور: روتر پورتال روی /api/portal سوار شده است",
  /app\.use\("\/api\/portal",\s*portalRoutes\);/.test(SRC.server) &&
    /const portalRoutes = require\("\.\/routes\/portalRoutes"\);/.test(
      SRC.server,
    ),
);

// ============================================================
// ۶) صفر تغییر در مسیرهای موجود (گزینهٔ الف)
// ============================================================
const routesDir = path.join(ROOT, "Backend", "routes");
const routeFiles = fs
  .readdirSync(routesDir)
  .filter((name) => name.endsWith(".js"))
  .sort();
const otherRoutes = routeFiles.filter((name) => name !== "portalRoutes.js");
const openedFiles = otherRoutes.filter((name) =>
  /authorize\([^)]*"customer"/.test(
    fs.readFileSync(path.join(routesDir, name), "utf8"),
  ),
);

check(
  "مسیرهای موجود: هیچ‌یک نقش customer را به authorize اضافه نکرده است",
  routeFiles.length >= 30 && openedFiles.length === 0,
  `files=${routeFiles.length} opened=${openedFiles.join(",") || "none"}`,
);

check(
  "مسیرهای موجود: کلید customer.portal.view فقط در روتر پورتال استفاده شده است",
  otherRoutes.every(
    (name) =>
      !fs
        .readFileSync(path.join(routesDir, name), "utf8")
        .includes("customer.portal.view"),
  ),
);

// ============================================================
// ۷) کاتالوگ مجوزها
// ============================================================
const catalog = require(path.join(ROOT, "Backend", "config", "permissions.js"));
const portalKey = catalog.PERMISSIONS["customer.portal.view"];

check(
  "کاتالوگ: کلید customer.portal.view با پیش‌فرض «فقط مشتری» ثبت شده است",
  Boolean(portalKey) &&
    portalKey.defaults.customer === true &&
    portalKey.defaults.super_admin === false &&
    portalKey.defaults.admin === false &&
    portalKey.defaults.sub_admin === false &&
    portalKey.defaults.expert === false,
);

check(
  "کاتالوگ: گروه «پورتال مشتری» در پنل مدیریت دیده می‌شود",
  portalKey?.group === "portal" &&
    catalog.PERMISSION_GROUPS.some((group) => group.key === "portal"),
);

check(
  "کاتالوگ: کلید پورتال قفل‌نشده است (مدیر می‌تواند ببندد/باز کند)",
  Array.isArray(portalKey?.lockedTo) && portalKey.lockedTo.length === 0,
);

check(
  "کاتالوگ: شمارش کلیدها/گروه‌ها با permissions-test هم‌خوان است",
  // ✅ فاز ۱۳.۶: سه کلید صف ثبت‌نام (۱۷۳ ⇒ ۱۷۶)
  // ✅ موج ۱۳.۸: ۱۲ کلید پروفایل/داشبورد (۱۷۶ ⇒ ۱۸۸)
  catalog.TOTAL_PERMISSIONS === 188 &&
    catalog.PERMISSION_GROUPS.length === 17 &&
    /TOTAL_PERMISSIONS === 188 && catalog\.PERMISSION_GROUPS\.length === 17/.test(
      SRC.permissionsTest,
    ),
  `keys=${catalog.TOTAL_PERMISSIONS} groups=${catalog.PERMISSION_GROUPS.length}`,
);

check(
  "کاتالوگ: ۷ کلید حساس قفل‌شده دست‌نخورده مانده‌اند (سوپرادمین)",
  catalog.LOCKED_PERMISSION_KEYS.length === 7 &&
    catalog.LOCKED_PERMISSION_KEYS.every(
      (key) => catalog.PERMISSIONS[key].lockedTo[0] === "super_admin",
    ),
);

check(
  "کاتالوگ: پیش‌فرض‌های قبلی مشتری برای کلیدهای موجود تغییر نکرده‌اند",
  catalog.defaultFor("customer", "customer.basic.view") === false &&
    catalog.defaultFor("customer", "halls.view") === false &&
    catalog.defaultFor("customer", "weekly.view") === false &&
    catalog.defaultFor("customer", "visit.view") === false,
);

// ============================================================
// ۸) فرانت‌اند: پورتال فقط خواندنی + بدون شناسهٔ کلاینتی
// ============================================================
check(
  "فرانت: اندپوینت PORTAL.ME در ثابت‌های API ثبت شده است",
  /PORTAL:\s*\{\s*ME:\s*"\/portal\/me"/.test(SRC.apiConst),
);

check(
  "فرانت: درخواست پورتال بدون هیچ پارامتر/شناسه‌ای فرستاده می‌شود",
  /apiService\.get\(API_CONSTANTS\.ENDPOINTS\.PORTAL\.ME\)/.test(SRC.portalApi) &&
    !/PORTAL\.ME\s*,/.test(SRC.portalApi) &&
    !/\?id=/.test(SRC.portalApi),
);

check(
  "فرانت: نوشتن‌های پورتال فقط سه مسیر پروفایل‌اند (سرویس بدون نوشتن)",
  // ✅ موج ۱۳.۸: پورتال صاحبِ پرونده شده است، ولی سطح نوشتن بسته است:
  //    PATCH پروفایل + دو مرحلهٔ موبایل — و هیچ نوشتن دیگری.
  (SRC.portalApi.match(/apiService\.(post|put|patch|delete)\(/g) || []).length ===
    3 &&
    /apiService\.patch\(\s*\n?\s*API_CONSTANTS\.ENDPOINTS\.PORTAL\.PROFILE,/.test(
      SRC.portalApi,
    ) &&
    /PORTAL\.PROFILE_MOBILE_REQUEST/.test(SRC.portalApi) &&
    /PORTAL\.PROFILE_MOBILE_CONFIRM/.test(SRC.portalApi) &&
    !/apiService\.(post|put|patch|delete)\(/.test(SRC.portalService) &&
    // 🔒 شمارهٔ موبایل هرگز در بدنهٔ PATCH نمی‌رود
    !/mobile_number:\s*patch/.test(SRC.portalApi),
);

check(
  "فرانت: رندرر تمام متن‌ها را از escapeHtml عبور می‌دهد",
  /import \{[^}]*escapeHtml[^}]*\} from "\.\.\/\.\.\/core\/utils\/string\.utils\.js"/.test(
    SRC.portalRenderer,
  ) && (SRC.portalRenderer.match(/escapeHtml\(/g) || []).length >= 8,
);

check(
  "فرانت: رندرر هیچ دکمه/فرم نوشتنی تولید نمی‌کند",
  !/<form|<button[^>]*type="submit"|contenteditable/.test(SRC.portalRenderer),
);

check(
  "صفحهٔ پورتال: گیت مجوز و fallback دارد",
  /data-permission="customer\.portal\.view"/.test(SRC.portalHtml) &&
    /data-permission-fallback="#portalDenied"/.test(SRC.portalHtml) &&
    /id="portalDenied"/.test(SRC.portalHtml),
);

check(
  "صفحهٔ پورتال: هیچ فرم/ارسال داده‌ای در HTML نیست",
  !/<form|type="submit"|method="post"/i.test(SRC.portalHtml),
);

check(
  "صفحهٔ پورتال: بخش‌های نمایشی (هیرو، شمارنده، گله، هفته، بازدید) موجودند",
  [
    'id="portalRoot"',
    'id="portalStatus"',
    'id="portalContent"',
    'id="portalHero"',
    'id="portalCounters"',
    'id="portalFlocks"',
    'id="portalWeeks"',
    'id="portalVisits"',
  ].every((needle) => SRC.portalHtml.includes(needle)),
);

check(
  "سرویس فرانت: حالت‌های loading/ready/unlinked/error مدیریت می‌شوند",
  ["loading", "ready", "unlinked", "error"].every((state) =>
    SRC.portalService.includes(`"${state}"`),
  ) && /LINK_MISSING/.test(SRC.portalService),
);

check(
  "app.service: صفحهٔ portal ثبت و مسیر آن تشخیص داده می‌شود",
  /portal: \{[\s\S]{0,240}requiresPermission: "customer\.portal\.view"/.test(
    SRC.appService,
  ) &&
    /"\/portal": "portal"/.test(SRC.appService) &&
    /"\/portal\.html": "portal"/.test(SRC.appService),
);

check(
  "app.service: نقش مشتری در صفحهٔ کارکنان معاف نیست و به پورتال می‌رود (۱۳.۵)",
  /isCustomerExemptPage\(\)/.test(SRC.appService) &&
    /redirectCustomerFromStaffPages\(\)/.test(SRC.appService) &&
    /window\.location\.replace\("\/portal\.html"\)/.test(SRC.appService) &&
    !/this\.currentPage === "customer-info"\) return true;/.test(SRC.appService),
);

check(
  "پروندهٔ مشتری: گارد نقش مشتری پیش از هر درخواست به پورتال می‌فرستد (۱۳.۵)",
  /role === "customer"/.test(SRC.customerInfo) &&
    /window\.location\.replace\("\/portal\.html"\)/.test(SRC.customerInfo),
);

check(
  "سرور فرانت: مسیر /portal و لودر سیستمی ثبت شده‌اند",
  /app\.get\(\["\/portal",\s*"\/portal\.html"\]/.test(SRC.frontendServer) &&
    /"portal\.html",/.test(SRC.frontendServer),
);

check(
  "پروفایل مشتری: نقش مشتری فقط پروندهٔ متصل به حساب خودش را می‌گیرد",
  /resolveCustomerId\(\)/.test(SRC.customerInfo) &&
    /if \(authService\.getUser\(\)\?\.role === "customer"\) return linkedId;/.test(
      SRC.customerInfo,
    ),
);

// ============================================================
// ۹) ابزار: اسکریپت تست + گیت‌ها + مستندات
// ============================================================
check(
  "package.json: اسکریپت test:customer-portal ثبت شده است",
  /"test:customer-portal":\s*"node customer-portal-guard-test\.mjs"/.test(
    SRC.pkg,
  ),
);

check(
  "گیت: هر دو اجراکننده (mjs و ps1) گارد پورتال را اجرا می‌کنند",
  SRC.gateMjs.includes("'test:customer-portal'") &&
    SRC.gatePs1.includes("'test:customer-portal'"),
);

check(
  "مستندات: docs/REVIEW-WAVE-13.2.md موجود و کامل است",
  exists(FILES.docs) &&
    /customer\.portal\.view/.test(read(FILES.docs)) &&
    /\/api\/portal\/me/.test(read(FILES.docs)),
);

// ============================================================
// ۱۰) موج ۱۳.۳ — دادهٔ کامل پورتال و مقصد ورود مشتری
// ============================================================
check(
  "۱۳.۳ · مسیرها: چهار اندپوینت خواندنی تازه زیر /api/portal",
  ['"/halls"', '"/flocks"', '"/weeks"', '"/visits"'].every((needle) =>
    SRC.routes.includes(needle),
  ) &&
    [
      "getMyHalls",
      "getMyFlocks",
      "getMyWeeks",
      "getMyVisits",
    ].every((name) => SRC.routes.includes(`portalController.${name}`)),
);

check(
  "۱۳.۳ · کنترلر: هر چهار فهرست اسکوپِ اجباری دارند (بدون skope ⇒ ۴۰۳)",
  // ✅ ۱۳.۸: ۷ مورد قبلی + getMyProfile + updateMyProfile = ۹
  (SRC.controller.match(/const customerId = scopeIdOf\(req\);/g) || []).length ===
    9 &&
    (SRC.controller.match(/if \(!customerId\) return denyUnlinked\(res\);/g) || [])
      .length === 9,
);

check(
  "۱۳.۳ · کنترلر: صفحه‌بندی سقف‌دار است (page/limit فقط، سقف ۵۰)",
  /const PORTAL_PAGE_MAX = 50;/.test(SRC.controller) &&
    /parsePagination\(query, \{/.test(SRC.controller) &&
    /maxLimit: PORTAL_PAGE_MAX/.test(SRC.controller) &&
    /const paging = \(query\) =>/.test(SRC.controller),
);

check(
  "۱۳.۳ · کنترلر: خروجی بازدید بدون متن گزارش و بدون مسیر فایل است",
  !/file_path/.test(
    (SRC.controller.match(/const getMyVisits = async \(req, res\) => \{[\s\S]*?\n\};/) ||
      [""])[0],
  ),
);

check(
  "۱۳.۳ · کنترلر: نام سالن با کوئری دومِ اسکوپ‌شده می‌آید (بدون include)",
  /id: \{ \[Op\.in\]: hallIds \}/.test(SRC.controller) &&
    !/include:\s*\[/.test(SRC.controller),
);

check(
  "۱۳.۳ · کنترلر: هر فهرست فقط ستون‌های حداقلی را انتخاب می‌کند",
  (SRC.controller.match(/attributes: \[/g) || []).length >= 4 &&
    !/attributes:\s*\{\s*exclude/.test(SRC.controller),
);

// ============================================================
// ۱۰-ب) اجرای واقعی: «تزریق اجباری» فیلتر در میان‌افزار
// ------------------------------------------------------------
// ریسکی که ۱۳.۳ می‌بندد: کنترلرِ فهرست، فیلتر را فقط وقتی می‌سازد که
// پارامتر وجود داشته باشد؛ اگر مشتری پارامتر نفرستد باید middleware
// شناسهٔ خودش را تزریق کند، وگرنه دادهٔ همهٔ مشتریان برمی‌گردد.
// ============================================================
check(
  "۱۳.۳ · میان‌افزار: بدون پارامتر کلاینت، شناسهٔ خودِ مشتری تزریق می‌شود (query)",
  (() => {
    const req = fakeReq({ id: 7, role: "customer", customer_id: "12" });
    const out = run(
      scopeMw.enforceSelfCustomer({ source: "query", key: "customer_id" }),
      req,
    );
    return out.nexted === true && req.query.customer_id === "12";
  })(),
);

check(
  "۱۳.۳ · میان‌افزار: تزریق در بدنه (body) هم انجام می‌شود",
  (() => {
    const req = fakeReq(
      { id: 7, role: "customer", customer_id: 12 },
      { body: {} },
    );
    const out = run(
      scopeMw.enforceSelfCustomer({ source: "body", key: "customer_id" }),
      req,
    );
    return out.nexted === true && req.body.customer_id === "12";
  })(),
);

check(
  "۱۳.۳ · میان‌افزار: پارامتر مشتریِ دیگر جایگزین نمی‌شود (۴۰۳، بدون تزریق)",
  (() => {
    const req = fakeReq({ id: 7, role: "customer", customer_id: 12 }, {
      query: { customer_id: "99" },
    });
    const out = run(
      scopeMw.enforceSelfCustomer({ source: "query", key: "customer_id" }),
      req,
    );
    return (
      out.status === 403 &&
      out.nexted === false &&
      req.query.customer_id === "99" &&
      req.customerScopeId === undefined
    );
  })(),
);

// ============================================================
// ۱۰-ج) فرانت‌اند: تب‌های پورتال و مقصد ورود مشتری
// ============================================================
check(
  "۱۳.۳ · فرانت: چهار اندپوینت PORTAL در ثابت‌های API ثبت شده‌اند",
  ["HALLS", "FLOCKS", "WEEKS", "VISITS"].every((key) =>
    new RegExp(`${key}:\\s*"/portal/${key.toLowerCase()}"`).test(SRC.apiConst),
  ),
);

check(
  "۱۳.۳ · فرانت: لایهٔ API چهار متد فهرست دارد و هیچ شناسهٔ مشتری نمی‌فرستد",
  ["getHalls", "getFlocks", "getWeeks", "getVisits"].every((name) =>
    new RegExp(`${name}\\(params = \\{\\}\\)`).test(SRC.portalApi),
  ) &&
    !/customer_id|\?id=|PORTAL\.\w+\s*,\s*\{\s*customer/.test(
      stripComments(SRC.portalApi),
    ),
);

check(
  "۱۳.۳ · فرانت: سرویس تب‌ها را تنبل بارگذاری می‌کند و در unlinked می‌بندد",
  /SECTION_CONF/.test(SRC.portalService) &&
    /async loadSection\(key/.test(SRC.portalService) &&
    /activateTab\(/.test(SRC.portalService) &&
    /setTabsEnabled\(false\)/.test(SRC.portalService),
);

check(
  "۱۳.۳ · صفحهٔ پورتال: تب‌ها و پنل‌های چهارگانه (فقط خواندنی) موجودند",
  [
    'id="portalTabs"',
    'id="portalTabPanels"',
    'data-portal-tab="halls"',
    'data-portal-tab="flocks"',
    'data-portal-tab="weeks"',
    'data-portal-tab="visits"',
    'id="portalHallsList"',
    'id="portalFlocksList"',
    'id="portalWeeksList"',
    'id="portalVisitsList"',
    'id="portalHallsPager"',
  ].every((needle) => SRC.portalHtml.includes(needle)),
);

check(
  "۱۳.۳ · رندرر: صفحه‌بندی فقط «نمایش بیشتر» است (بدون فرم/ثبت)",
  /export const renderPager/.test(SRC.portalRenderer) &&
    /data-portal-more=/.test(SRC.portalRenderer) &&
    !/<form|type="submit"/.test(SRC.portalRenderer),
);

check(
  "۱۳.۳ · ورود: مقصد نقش مشتری «/portal» است (بدون ?id= در URL)",
  /return "\/portal";/.test(SRC.loginOtp) &&
    !/\/customer-info\?id=/.test(SRC.loginOtp),
);

check(
  "۱۳.۳ · app.service: بازگشتِ ردِ دسترسی برای مشتری پورتال است",
  /isCustomerSession\(\)/.test(SRC.appService) &&
    /afterDenyLanding\(\)/.test(SRC.appService) &&
    /this\.isCustomerSession\(\) \? "\/portal" : "\/index\.html"/.test(
      SRC.appService,
    ),
);

check(
  "۱۳.۳ · auth.service: ریدایرکت نقش مشتری از صفحات کارکنان به /portal است",
  (() => {
    const authSrc = read("Frontend/src/core/services/auth.service.js");
    return (
      (authSrc.match(/window\.location\.href = "\/portal";/g) || []).length >= 2 &&
      !/user\?\.role === "customer"\) \{\s*window\.location\.href = "\/customer-info"/.test(
        authSrc,
      )
    );
  })(),
);

check(
  "۱۳.۳ · مستندات: docs/REVIEW-WAVE-13.3.md موجود و کامل است",
  exists(FILES.docs133) &&
    /\/api\/portal\/halls/.test(read(FILES.docs133)) &&
    /landingForRole/.test(read(FILES.docs133)),
);

// ============================================================
// ۱۱) موج ۱۳.۴ — جزئیات هفته/بازدید، پیوست و نمودار
// ============================================================

check(
  "۱۳.۴ · کنترلر: سه کنترلر جزئیات/دانلود صادر شده‌اند",
  /getMyWeekDetail/.test(SRC.controller) &&
    /getMyVisitDetail/.test(SRC.controller) &&
    /downloadMyAttachment/.test(SRC.controller) &&
    /module\.exports\s*=\s*\{[^}]*getMyWeekDetail[^}]*getMyVisitDetail[^}]*downloadMyAttachment/s.test(
      SRC.controller,
    ),
);

check(
  "۱۳.۴ · کنترلر: مسیر فایل با path.resolve و محدود به uploads مهار شده است",
  /const UPLOADS_ROOT = path\.join\(__dirname, "\.\.", "uploads"\)/.test(
    SRC.controller,
  ) &&
    /path\.resolve/.test(SRC.controller) &&
    /startsWith\(rootPrefix\)/.test(SRC.controller) &&
    /fs\.existsSync\(resolved\)/.test(SRC.controller) &&
    /res\.download\(resolved/.test(SRC.controller),
);

check(
  "۱۳.۴ · کنترلر: پیوست با کلید خارجی همان بازدید خوانده می‌شود (نه فقط id)",
  /VisitReportAttachment\.findOne\(\{\s*where:\s*\{\s*id:\s*attachmentId,\s*visit_report_id:\s*visitId/s.test(
    SRC.controller,
  ),
);

check(
  "۱۳.۴ · حریم خصوصی: file_path و هویت کارشناس در خروجی پورتال نیست",
  !/file_path:\s*row\.file_path/.test(SRC.controller) &&
    !/created_by:/.test(SRC.controller) &&
    !/service_expert_id:/.test(SRC.controller) &&
    !/additional_notes:/.test(SRC.controller),
);

check(
  "۱۳.۴ · حریم خصوصی: فهرست بازدید متن گزارش را برنمی‌گرداند",
  (() => {
    const listView = /const visitListView[\s\S]{0,400}?\}\);/;
    const match = SRC.controller.match(listView);
    return Boolean(match) && !/report_text:/.test(match[0]);
  })(),
);

check(
  "۱۳.۴ · مجوز: بازدید/پیوست از زنجیرهٔ کلید جدا و همان requireCustomerLink عبور می‌کنند",
  /const visitReportChain = \[\s*\.\.\.customerChain,\s*requirePermission\("customer\.portal\.visits"\),\s*requirePermission\("customer\.portal\.visit\.report"\),?\s*\]/.test(
    SRC.routes.replace(/\r\n/g, "\n"),
  ) &&
    /const customerChain = \[[\s\S]{0,200}?requireCustomerLink/.test(
      SRC.routes.replace(/\r\n/g, "\n"),
    ),
);

check(
  "۱۳.۴ · کاتالوگ مجوز: کلید customer.portal.visit.report فقط برای مشتری پیش‌فرض دارد",
  (() => {
    const entry = catalog.PERMISSIONS["customer.portal.visit.report"];
    if (!entry || !entry.defaults) return false;
    const roles = Object.keys(entry.defaults);
    return (
      entry.defaults.customer === true &&
      roles.every((role) => (role === "customer" ? true : entry.defaults[role] === false))
    );
  })(),
);

check(
  "۱۳.۴ · فرانت: ثابت‌های API سه مسیر جزئیات/پیوست را دارند",
  /WEEK_DETAIL: \(id\) => `\/portal\/weeks\/\$\{id\}`/.test(SRC.apiConst) &&
    /VISIT_DETAIL: \(id\) => `\/portal\/visits\/\$\{id\}`/.test(SRC.apiConst) &&
    /VISIT_ATTACHMENT: \(visitId, attachmentId\)/.test(SRC.apiConst),
);

check(
  "۱۳.۴ · فرانت: portal.api شناسهٔ ردیف را با الگوی عددی اعتبارسنجی می‌کند",
  /const ROW_ID_PATTERN = \/\^\\d\{1,9\}\$\//.test(SRC.portalApi) &&
    /throw new Error\("شناسهٔ ردیف نامعتبر است"\)/.test(SRC.portalApi) &&
    /getWeekDetail\(id\)/.test(SRC.portalApi) &&
    /getVisitDetail\(id\)/.test(SRC.portalApi) &&
    /apiService\.download\(/.test(SRC.portalApi),
);

check(
  "۱۳.۴ · فرانت: نوشتن در لایهٔ پورتال فقط از portal.api و محدود است",
  (SRC.portalApi.match(/apiService\.(post|put|patch|delete)\(/g) || []).length ===
    3 &&
    !/apiService\.(post|put|patch|delete)\(/.test(SRC.portalService) &&
    !/apiService\.(post|put|patch|delete)\(/.test(SRC.portalExtra),
);

check(
  "۱۳.۴ · فرانت: دانلود با هدر احراز هویت (نه لینک عمومی)",
  /async download\(endpoint, fallbackName = "download"\)/.test(
    read("Frontend/src/core/services/api.service.js"),
  ) &&
    /getFormDataHeaders\(\)/.test(
      read("Frontend/src/core/services/api.service.js"),
    ),
);

check(
  "۱۳.۴ · فرانت: رندرر سه تابع جزئیات/پیوست/نمودار را صادر می‌کند",
  /export const renderWeekDetail/.test(SRC.portalRenderer) &&
    /export const renderVisitDetail/.test(SRC.portalRenderer) &&
    /export const renderAttachments/.test(SRC.portalRenderer) &&
    /export const renderWeeklyChart/.test(SRC.portalRenderer),
);

check(
  "۱۳.۴ · فرانت: نمودار فقط SVG دست‌ساز است (بدون کتابخانهٔ تازه)",
  /<svg class="portal-chart__svg"/.test(SRC.portalRenderer) &&
    !/chart\.js|d3|apexcharts|echarts|highcharts/i.test(SRC.portalRenderer) &&
    !/<script/.test(SRC.portalRenderer),
);

check(
  "۱۳.۴ · فرانت: پنل جزئیات و نمودار در HTML ثبت شده‌اند",
  /id="portalDetail"/.test(SRC.portalHtml) &&
    /id="portalDetailBody"/.test(SRC.portalHtml) &&
    /id="portalChart"/.test(SRC.portalHtml) &&
    /data-portal-close/.test(SRC.portalHtml),
);

check(
  "۱۳.۴ · فرانت: سرویس پنل جزئیات را می‌بندد/باز می‌کند و Esc را می‌شنود",
  /async openDetail\(kind, id\)/.test(SRC.portalService) &&
    /closeDetail\(\)/.test(SRC.portalService) &&
    /event\.key === "Escape"/.test(SRC.portalService) &&
    /bindDetail\(\)/.test(SRC.portalService),
);

check(
  "۱۳.۴ · فرانت: گیت UI متن گزارش به کلید customer.portal.visit.report وصل است",
  /customer\.portal\.visit\.report/.test(SRC.portalService),
);

check(
  "۱۳.۴ · مستندات: docs/REVIEW-WAVE-13.4.md موجود و کامل است",
  exists(FILES.docs134) &&
    /customer\.portal\.visit\.report/.test(read(FILES.docs134)) &&
    /\/api\/portal\/weeks\/:id/.test(read(FILES.docs134)),
);

// ============================================================
// ۱۱) ۱۳.۵ — کنترل دسترسی پورتال (نقش مشتری + تک‌کاربر) + صفر سیل ۴۰۳
// ------------------------------------------------------------
// خواستهٔ کارفرما: «پروفایل مشتری برای کارکنان دست‌نخورده بماند، ولی
// سطح دسترسی پورتال از پنل مدیریت (هم نقش، هم کاربر) قابل تغییر باشد.»
// ============================================================
const portalSectionKeys = ["halls", "flocks", "weeks", "visits"];

check(
  "۱۳.۵ · کاتالوگ: چهار کلید تب پورتال با پیش‌فرض «فقط مشتری» و بی‌قفل",
  portalSectionKeys.every((name) => {
    const entry = catalog.PERMISSIONS[`customer.portal.${name}`];
    return (
      Boolean(entry) &&
      entry.group === "portal" &&
      entry.defaults.customer === true &&
      entry.defaults.super_admin === false &&
      entry.defaults.admin === false &&
      entry.defaults.sub_admin === false &&
      entry.defaults.expert === false &&
      entry.lockedTo.length === 0
    );
  }),
);

check(
  "۱۳.۵ · کنترلر: خلاصهٔ پرونده بخش‌های بسته را لو نمی‌دهد (sections + null)",
  /userHasPermission\(req, "customer\.portal\.halls"\)/.test(SRC.controller) &&
    /userHasPermission\(req, "customer\.portal\.flocks"\)/.test(SRC.controller) &&
    /userHasPermission\(req, "customer\.portal\.weeks"\)/.test(SRC.controller) &&
    /userHasPermission\(req, "customer\.portal\.visits"\)/.test(SRC.controller) &&
    /const sections = \{/.test(SRC.controller) &&
    // ✅ ۱۳.۸: بلوک features بین sections و counters اضافه شد
    /sections,\s*\n\s*\/\/[^\n]*\n\s*features: \{[\s\S]*?\n\s*\},\s*\n\s*counters: \{/.test(
      SRC.controller,
    ) &&
    (SRC.controller.match(/orNull\(can/g) || []).length >= 5 &&
    /latest: \{[\s\S]{0,320}?canFlocks\s*\n?\s*\?[\s\S]{0,200}?: \[\]/.test(
      SRC.controller,
    ),
);

check(
  "۱۳.۵ · فرانت: هر تب پورتال کلید مجوز خودش را دارد (SECTION_CONF.permission)",
  portalSectionKeys.every((name) =>
    new RegExp(`permission: "customer\\.portal\\.${name}"`).test(
      SRC.portalService,
    ),
  ),
);

check(
  "۱۳.۵ · فرانت: تب بسته پنهان می‌شود و هیچ درخواستی نمی‌فرستد",
  /canSee\(key\)/.test(SRC.portalService) &&
    /visibleTabKeys\(\)/.test(SRC.portalService) &&
    /applyTabVisibility\(\)/.test(SRC.portalService) &&
    /if \(!this\.canSee\(key\)\) return;/.test(SRC.portalService) &&
    /button\.hidden = !show;/.test(SRC.portalService) &&
    /block\.hidden = visible\.length === 0;/.test(SRC.portalService),
);

check(
  "۱۳.۵ · صفحهٔ پورتال: جای پیام «بخش بسته است» وجود دارد",
  /id="portalTabsNotice"/.test(SRC.portalHtml) &&
    /id="portalFullData"/.test(SRC.portalHtml),
);

check(
  "۱۳.۵ · فرانت: هدر برای حساب بدون مجوز بوکمارک درخواست نمی‌فرستد",
  /canLoadBookmarks\(\)/.test(SRC.headerBookmarks) &&
    /service\.can\("bookmarks\.view"\)/.test(SRC.headerBookmarks) &&
    /!token \|\| !this\.canLoadBookmarks\(\)/.test(SRC.headerBookmarks),
);

check(
  "۱۳.۵ · پنل: راهنمای «نقش مشتری فقط پورتال دارد» + برچسب «بی‌اثر برای مشتری»",
  /renderCustomerHint\(\)/.test(SRC.permissionManager) &&
    /orderedGroupsFor\(role\)/.test(SRC.permissionManager) &&
    /startsWith\("customer\.portal\."\)/.test(SRC.permissionManager) &&
    /class="perm-inert"/.test(SRC.permissionManager) &&
    /\.perm-hint \{/.test(SRC.adminPanelCss) &&
    /\.perm-inert \{/.test(SRC.adminPanelCss),
);

check(
  "۱۳.۵ · استایل: تبِ بستهٔ پورتال واقعاً پنهان می‌شود (.portal-tab[hidden])",
  /\.portal-tab\[hidden\]\s*\{[^}]*display:\s*none/.test(SRC.portalCss),
);

check(
  "۱۳.۵ · مستندات: docs/REVIEW-WAVE-13.5.md موجود و کامل است",
  exists(FILES.docs135) &&
    /customer\.portal\.halls/.test(read(FILES.docs135)) &&
    /customer\.portal\.visits/.test(read(FILES.docs135)),
);

// ============================================================
// ۱۲) ۱۳.۵.۱ — مودال «نظرات و پیشنهادات» در پورتال مشتری
// ------------------------------------------------------------
//  ریشهٔ خطری که این گارد از بازگشتش جلوگیری می‌کند:
//   مودال پیام‌ها از پارشال هدر تزریق می‌شود و استایلش
//   (.msg-modal-overlay → position:fixed + display:none) در
//   styles/info-pages.css است. اگر صفحهٔ میزبان آن فایل را لود
//   نکند، overlay بدون هیچ CSS به‌صورت بلوک خام داخل <header>
//   چسبان می‌افتد و کل صفحه را به‌هم می‌ریزد (باگ واقعی /portal).
// ============================================================
const hasHeaderCssLink = (html) =>
  /href="[^"]*shared\/layouts\/Header\/header\.css"/.test(html);
const hasInfoPagesCssLink = (html) =>
  /href="[^"]*styles\/info-pages\.css"/.test(html);

check(
  "۱۳.۵.۱ · صفحهٔ پورتال: استایل مودال پیام‌ها (styles/info-pages.css) لود می‌شود",
  hasHeaderCssLink(SRC.portalHtml) &&
    hasInfoPagesCssLink(SRC.portalHtml) &&
    /\.msg-modal-overlay\s*\{[^}]*position:\s*fixed/.test(SRC.infoPagesCss) &&
    /\.msg-modal-overlay\s*\{[^}]*display:\s*none/.test(SRC.infoPagesCss),
);

const portalPagesDir = path.join(ROOT, "Frontend/src/pages");
const pageFiles = fs.existsSync(portalPagesDir)
  ? fs
      .readdirSync(portalPagesDir)
      .filter((file) => file.endsWith(".html"))
      .sort()
  : [];
const pagesMissingInfoCss = pageFiles.filter((file) => {
  const html = read(path.join("Frontend/src/pages", file));
  return hasHeaderCssLink(html) && !hasInfoPagesCssLink(html);
});

check(
  "۱۳.۵.۱ · قاعدهٔ کلی: هر صفحه‌ای که هدر دارد استایل مودال پیام‌ها را هم لود می‌کند",
  pageFiles.length > 0 && pagesMissingInfoCss.length === 0,
  `pages=${pageFiles.length}${
    pagesMissingInfoCss.length ? " missing=" + pagesMissingInfoCss.join(",") : ""
  }`,
);

check(
  "۱۳.۵.۱ · هدر: مودال پیام‌ها پیش‌فرض hidden است (خارج از جریان صفحه)",
  /<div[^>]*id="messageThreadModal"[^>]*\shidden(\s|>)/.test(SRC.headerHtml),
);

const messagesSvcSrc = stripComments(SRC.messagesService);
check(
  "۱۳.۵.۱ · سرویس پیام‌ها: hidden مودال در باز و بستن توگل می‌شود",
  /openModal\([\s\S]{0,1200}?overlay\.hidden\s*=\s*false/.test(messagesSvcSrc) &&
    /closeModal\([\s\S]{0,400}?overlay\.hidden\s*=\s*true/.test(messagesSvcSrc),
);

check(
  "۱۳.۵.۱ · مستندات: docs/REVIEW-WAVE-13.5.1.md موجود و کامل است",
  exists(FILES.docs1351) &&
    /info-pages\.css/.test(read(FILES.docs1351)) &&
    /msg-modal-overlay/.test(read(FILES.docs1351)),
);

// ============================================================
// ۱۳) موج ۱۳.۸ — «پروفایل من» + «داشبورد تحلیلی»
// ------------------------------------------------------------
// خواستهٔ کارفرما: مشتری بتواند اطلاعات خودش را ویرایش کند و نمودارهای
// گلهٔ خودش را ببیند — بدون اینکه دادهٔ مشتری دیگری دیدنی شود.
// ============================================================
const profileRules = require(
  path.join(ROOT, "Backend", "services", "portalProfileRules.js"),
);
const ownershipRules = require(
  path.join(ROOT, "Backend", "services", "portalOwnershipRules.js"),
);

check(
  "۱۳.۸ · قواعد پروفایل: فهرست سفید ۱۵ فیلد دارد و موبایل/نوع مشتری در آن نیست",
  Array.isArray(profileRules.PROFILE_EDITABLE) &&
    profileRules.PROFILE_EDITABLE.length === 15 &&
    !profileRules.PROFILE_EDITABLE.includes("mobile_number") &&
    !profileRules.PROFILE_EDITABLE.includes("customer_type_id") &&
    ["id", "customer_code", "mobile_number", "active", "status", "updated_by"].every(
      (field) => profileRules.PROFILE_LOCKED.includes(field),
    ),
);

check(
  "۱۳.۸ · قواعد پروفایل: PATCH کلید ناشناخته را نادیده می‌گیرد و موبایل را قفل می‌داند",
  (() => {
    const verdict = profileRules.validateProfilePatch({
      full_name: "مشتری تست",
      mobile_number: "09120000000",
      customer_type_id: 9,
      active: false,
    });
    return (
      verdict.ok === true &&
      verdict.values.mobile_number === undefined &&
      verdict.values.customer_type_id === undefined &&
      verdict.values.active === undefined &&
      verdict.ignored.includes("mobile_number") &&
      verdict.mobileAttempted === true
    );
  })(),
);

check(
  "۱۳.۸ · قواعد پروفایل: تغییر شمارهٔ موبایل فقط با قانون ۰۹xxxxxxxxx",
  profileRules.PROFILE_MOBILE_PURPOSE === "profile_mobile" &&
    profileRules.validateMobileChange({ current: "09121111111", next: "09122222222" })
      .ok === true &&
    profileRules.validateMobileChange({ current: "09121111111", next: "09121111111" })
      .ok === false &&
    profileRules.validateMobileChange({ current: "09121111111", next: "12345" }).ok ===
      false,
);

check(
  "۱۳.۸ · مالکیت ردیف: ردیف غیرخودی ⇒ ۴۰۴ و شناسهٔ بد ⇒ ۴۰۰",
  ownershipRules.ownershipStatus("not_owner") === 404 &&
    ownershipRules.ownershipStatus("bad_id") === 400 &&
    ownershipRules.ownershipStatus("missing_scope") === 403 &&
    ownershipRules.ownershipDecision({ row: { customer_id: 5 }, scopeId: 7 }).ok ===
      false &&
    ownershipRules.ownershipDecision({
      row: { get: () => ({ customer_id: 7 }) },
      scopeId: 7,
    }).ok === true &&
    ownershipRules.referenceDecision({ value: "", scopeId: 7 }).id === null,
);

check(
  "۱۳.۸ · کنترلر: ویرایش پروفایل با فهرست سفید + reported تغییرات + بدون mobile",
  /validateProfilePatch\(req\.body\)/.test(SRC.controller) &&
    /changedFields\(before, patch\.values\)/.test(SRC.controller) &&
    /patch\.values\[field\]/.test(SRC.controller) &&
    /patchValues\.updated_by = req\.user\?\.id/.test(SRC.controller) &&
    /mobile_hint/.test(SRC.controller) &&
    // 🔒 نوع مشتری/وضعیت/کد پرونده هیچ‌جا از بدنه اعمال نمی‌شود
    !/patchValues\.(customer_type_id|active|status|customer_code)/.test(
      SRC.controller,
    ),
);

check(
  "۱۳.۸ · داشبورد: customerId از توکن تحمیل می‌شود (نه از کلاینت)",
  (() => {
    const src = read("Backend/controllers/portalDashboardController.js");
    return (
      /query\.customerId = String\(scopeIdOf\(req\)\)/.test(src) &&
      /delete query\.customer_id/.test(src) &&
      /delete query\.customerId/.test(src) &&
      /dashboardController\.getChartsData\(req, res\)/.test(src) &&
      /dashboardController\.getAnalysisData\(req, res\)/.test(src) &&
      !/req\.query\.customerId\s*\)/.test(src)
    );
  })(),
);

check(
  "۱۳.۸ · مسیرها: پروفایل/داشبورد پشت زنجیرهٔ مجوز + محدودکنندهٔ نوشتن + مالکیت گله",
  /const profileChain = \[/.test(SRC.routes) &&
    /requirePermission\("customer\.portal\.profile"\)/.test(SRC.routes) &&
    /requirePermission\("customer\.portal\.profile\.edit"\)/.test(SRC.routes) &&
    (SRC.routes.match(/(^|\r?\n)[ \t]+portalWriteLimiter,[ \t]*\r?\n/g) || [])
      .length === 3 &&
    (SRC.routes.match(/(^|\r?\n)[ \t]+otpLimiter,[ \t]*\r?\n/g) || []).length === 2 &&
    /requireOwnedRow\(\{\s*\n\s*model: Flock/.test(SRC.routes) &&
    /key: "flockGroupId"/.test(SRC.routes) &&
    /key: "flockId"/.test(SRC.routes) &&
    /requirePermission\("customer\.portal\.dashboard\.analysis"\)/.test(SRC.routes),
);

check(
  "۱۳.۸ · api.const: هفت اندپوینت تازه ثبت شده‌اند",
  [
    'PROFILE: "/portal/profile"',
    'PROFILE_MOBILE_REQUEST: "/portal/profile/mobile/request"',
    'PROFILE_MOBILE_CONFIRM: "/portal/profile/mobile/confirm"',
    'DASHBOARD_OPTIONS: "/portal/dashboard/options"',
    'DASHBOARD_SUMMARY: "/portal/dashboard/summary"',
    'DASHBOARD_CHARTS: "/portal/dashboard/charts"',
    'DASHBOARD_ANALYSIS: "/portal/dashboard/analysis"',
  ].every((needle) => SRC.apiConst.includes(needle)),
);

check(
  "۱۳.۸ · فرانت: فهرست سفید آینه‌ای کلاینت هم‌اندازهٔ سرور است",
  (() => {
    const apiSrc = read(FILES.portalApi);
    const list =
      (apiSrc.match(/export const PROFILE_EDITABLE_FIELDS = \[([\s\S]*?)\];/) || [])[1] ||
      "";
    const fields = (list.match(/"[a-z_]+"/g) || []).map((x) => x.replace(/"/g, ""));
    return (
      fields.length === profileRules.PROFILE_EDITABLE.length &&
      fields.every((field) => profileRules.PROFILE_EDITABLE.includes(field))
    );
  })(),
);

check(
  "۱۳.۸ · صفحهٔ پورتال: دو تب تازه + پنل‌هایشان + بارگذاری mixin",
  [
    'data-portal-tab="profile"',
    'data-portal-tab="dashboard"',
    'data-portal-panel="profile"',
    'data-portal-panel="dashboard"',
    'id="portalProfileStatus"',
    'id="portalProfileBody"',
    'id="portalDashboardStatus"',
    'id="portalDashboardSummary"',
    'id="portalDashboardOptions"',
    'id="portalDashboardCharts"',
    'id="portalDashboardStandards"',
    'id="portalDashboardCompare"',
    '/features/portal/portal.extra.js',
  ].every((needle) => SRC.portalHtml.includes(needle)) &&
    // 🔒 صفحه هنوز هیچ فرم HTML/ارسال مستقیمی ندارد
    !/<form|type="submit"|method="post"/i.test(SRC.portalHtml),
);

check(
  "۱۳.۸ · رندرر: توابع پروفایل/داشبورد صادر می‌شوند و هیچ فرمی نمی‌سازند",
  /export const renderProfileCard/.test(SRC.portalRenderer) &&
    /export const renderProfileEditor/.test(SRC.portalRenderer) &&
    /export const renderMobileChangePanel/.test(SRC.portalRenderer) &&
    /export const renderDashboardOptions/.test(SRC.portalRenderer) &&
    /export const renderDashboardSummary/.test(SRC.portalRenderer) &&
    /export const renderDashboardCharts/.test(SRC.portalRenderer) &&
    /export const renderDashboardTable/.test(SRC.portalRenderer) &&
    /export const renderStandardsChart/.test(SRC.portalRenderer) &&
    /export const buildDashboardCsv/.test(SRC.portalRenderer) &&
    !/<form|type="submit"|contenteditable/.test(SRC.portalRenderer) &&
    !/<script/.test(SRC.portalRenderer),
);

check(
  "۱۳.۸ · سرویس: تب‌های تازه در چرخهٔ پنهان‌سازی/فعال‌سازی آمده‌اند",
  /import \{ EXTRA_TABS, applyPortalExtra \} from "\.\/portal\.extra\.js"/.test(
    SRC.portalService,
  ) &&
    /const ALL_TAB_KEYS = \[\.\.\.TAB_KEYS, \.\.\.Object\.keys\(EXTRA_TABS\)\]/.test(
      SRC.portalService,
    ) &&
    /const tabConf = \(key\) => SECTION_CONF\[key\] \|\| EXTRA_TABS\[key\] \|\| null/.test(
      SRC.portalService,
    ) &&
    /if \(EXTRA_TABS\[key\]\) \{/.test(SRC.portalService) &&
    /this\.loadExtraTab\(key\)/.test(SRC.portalService) &&
    /this\.bindExtra\(\)/.test(SRC.portalService) &&
    /applyPortalExtra\(PortalService\)/.test(SRC.portalService),
);

check(
  "۱۳.۸ · mixin: ویرایش پروفایل/موبایل/داشبورد با کلیدهای مجوز گیت شده‌اند",
  /export const EXTRA_TABS = \{/.test(SRC.portalExtra) &&
    /permission: "customer\.portal\.profile"/.test(SRC.portalExtra) &&
    /permission: "customer\.portal\.dashboard"/.test(SRC.portalExtra) &&
    /async loadProfileTab\(\)/.test(SRC.portalExtra) &&
    /async saveProfile\(\)/.test(SRC.portalExtra) &&
    /async submitMobileRequest\(isResend = false\)/.test(SRC.portalExtra) &&
    /async submitMobileConfirm\(\)/.test(SRC.portalExtra) &&
    /MOBILE_PATTERN = \/\^09\\d\{9\}\$\//.test(SRC.portalExtra) &&
    /async loadDashboardCharts\(\)/.test(SRC.portalExtra) &&
    /exportDashboardCsv\(\)/.test(SRC.portalExtra) &&
    /can_edit_profile/.test(SRC.portalExtra) &&
    /customer\.portal\.dashboard\.export/.test(SRC.portalExtra) &&
    /customer\.portal\.dashboard\.compare/.test(SRC.portalExtra),
);

check(
  "۱۳.۸ · استایل: کلاس‌های تازهٔ پروفایل/داشبورد تعریف شده‌اند",
  [".portal-btn", ".portal-field__input", ".portal-form-grid", ".portal-table", ".portal-dash__toolbar"].every(
    (needle) => SRC.portalCss.includes(needle),
  ),
);

check(
  "۱۳.۸ · مستندات: docs/REVIEW-WAVE-13.8.md موجود و کامل است",
  exists(FILES.docs138) &&
    /customer\.portal\.profile\.edit/.test(read(FILES.docs138)) &&
    /\/api\/portal\/profile/.test(read(FILES.docs138)) &&
    /\/api\/portal\/dashboard/.test(read(FILES.docs138)),
);

check(
  "۱۳.۸ · PWA: manifest معتبر + service worker دارای شنوندهٔ fetch",
  (() => {
    const manifest = JSON.parse(read(FILES.pwaManifest));
    const sw = read(FILES.pwaSw);
    return (
      manifest.start_url === "/portal" &&
      manifest.display === "standalone" &&
      manifest.scope === "/" &&
      Array.isArray(manifest.icons) &&
      manifest.icons.length >= 1 &&
      /self\.addEventListener\("fetch"/.test(sw)
    );
  })(),
);

check(
  "۱۳.۸ · PWA: manifest/sw از ریشه سرو می‌شوند و صفحه連結 شده است",
  /"\/manifest\.webmanifest"/.test(read(FILES.frontendServer)) &&
    /"\/sw\.js"/.test(read(FILES.frontendServer)) &&
    /Service-Worker-Allowed/.test(read(FILES.frontendServer)) &&
    /<link rel="manifest" href="\/manifest\.webmanifest">/.test(SRC.portalHtml) &&
    /navigator\.serviceWorker\.register\('\/sw\.js'/.test(SRC.portalHtml),
);


// ============================================================
// ۱۴) موج ۱۳.۹ — تکمیل PWA: پوستهٔ آفلاین + نوار «نصب اپلیکیشن»
// ------------------------------------------------------------
// خواستهٔ کارفرما: پورتال روی گوشی «نصب‌شدنی» باشد و اگر اینترنت
// قطع شد، به‌جای صفحهٔ خطای مرورگر یک پیام فارسی دیده شود — بدون
// اینکه حتی یک بایت از دادهٔ پروندهٔ مشتری روی دستگاه کش شود.
// 🔒 پس گارد این بخش دو طرفه است: هم «پوستهٔ آفلاین هست»، هم
//    «هیچ داده/صفحه‌ای کش نمی‌شود».
// ============================================================
const swSrc = read(FILES.pwaSw);

check(
  "۱۳.۹ · SW: نسخه و کش صریح + precache فقط پوستهٔ آفلاین (یک قلم)",
  (() => {
    const assets = /const SHELL_ASSETS = \[([^\]]*)\]/.exec(swSrc);
    const list = assets
      ? assets[1]
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      : [];
    return (
      /const SW_VERSION = "13\.9\.0"/.test(swSrc) &&
      /const SHELL_CACHE = `skb-shell-\$\{SW_VERSION\}`/.test(swSrc) &&
      /const OFFLINE_URL = "\/offline\.html"/.test(swSrc) &&
      list.length === 1 &&
      list[0] === '"/offline.html"'
    );
  })(),
);

check(
  "۱۳.۹ · SW: پاسخ‌دادن فقط برای ناوبری و فقط وقتی شبکه شکست بخورد",
  (swSrc.match(/event\.respondWith\(/g) || []).length === 1 &&
    /if \(request\.mode !== "navigate"\) return;/.test(swSrc) &&
    /return await fetch\(request\);/.test(swSrc) &&
    /catch \(error\) \{/.test(swSrc) &&
    // 🔒 پوستهٔ آفلاین نباید در پیش‌فرض مسیر بیفتد
    /if \(cached\) return cached;/.test(swSrc),
);

check(
  "۱۳.۹ · SW: API و نوشتن‌ها هرگز از service worker پاسخ نمی‌گیرند",
  /if \(request\.method !== "GET"\) return;/.test(swSrc) &&
    /if \(url\.origin !== self\.location\.origin\) return;/.test(swSrc) &&
    /if \(url\.pathname\.startsWith\("\/api\/"\)\) return;/.test(swSrc) &&
    // 🔒 هیچ write-through/put در کش نیست
    !/caches\.put\(/.test(swSrc) &&
    !/cache\.put\(/.test(swSrc) &&
    // فقط یک caches.match و همان هم با cacheName صریح
    (swSrc.match(/caches\.match\(/g) || []).length === 1 &&
    /caches\.match\(OFFLINE_URL, \{ cacheName: SHELL_CACHE \}\)/.test(swSrc),
);

check(
  "۱۳.۹ · SW: هیچ صفحه/داده‌ای precache نمی‌شود (نه /portal نه API)",
  (swSrc.match(/addAll\(/g) || []).length === 1 &&
    /await cache\.addAll\(SHELL_ASSETS\);/.test(swSrc) &&
    // 🔒 خود فهرست precache هیچ آدرس صفحه/API ندارد
    (() => {
      const assets = /const SHELL_ASSETS = \[([^\]]*)\]/.exec(swSrc);
      const list = assets ? assets[1] : "";
      return !/\/portal/.test(list) && !/\/api/.test(list) && !/\.html"/.test(list.replace("/offline.html", ""));
    })() &&
    // کش نسخه‌های قبل پاک می‌شود (بدون باقی‌ماندن داده)
    /\.filter\(\(key\) => key !== SHELL_CACHE\)/.test(swSrc),
);

check(
  "۱۳.۹ · پوستهٔ آفلاین: خودبسنده، فارسی/RTL و بدون منبع خارجی",
  (() => {
    const html = read(FILES.pwaOffline);
    return (
      /<html lang="fa" dir="rtl">/.test(html) &&
      /id="portalOfflineRetry"/.test(html) &&
      /location\.reload\(\)/.test(html) &&
      /href="\/portal"/.test(html) &&
      // 🔒 اگر به شبکه ارجاع بدهد، در حالت آفلاین همان هم نمی‌آید
      !/src="http/i.test(html) &&
      !/<link[^>]+stylesheet/i.test(html) &&
      !/<script/i.test(html) &&
      !/<form/i.test(html)
    );
  })(),
);

check(
  "۱۳.۹ · سرور: offline.html از ریشه و با no-cache سرو می‌شود",
  /"\/offline\.html": \{/.test(SRC.frontendServer) &&
    /file: "offline\.html"/.test(SRC.frontendServer) &&
    /type: "text\/html; charset=utf-8"/.test(SRC.frontendServer) &&
    /setHeader\("Cache-Control", "no-cache"\)/.test(SRC.frontendServer) &&
    /"\/manifest\.webmanifest"/.test(SRC.frontendServer) &&
    /"\/sw\.js"/.test(SRC.frontendServer),
);

check(
  "۱۳.۹ · نوار نصب: بلوک HTML بدون فرم + دکمه‌های type=button",
  /class="portal-install" id="portalInstall" hidden/.test(SRC.portalHtml) &&
    /id="portalInstallAction"/.test(SRC.portalHtml) &&
    /id="portalInstallHint"/.test(SRC.portalHtml) &&
    /data-portal-install>/.test(SRC.portalHtml) &&
    /data-portal-install-dismiss/.test(SRC.portalHtml) &&
    !/<form|type="submit"|method="post"/i.test(SRC.portalHtml),
);

check(
  "۱۳.۹ · mixin: منطق نصب با گیت نصب‌شدگی/iOS/بستن و بدون alert",
  /this\.initInstallPrompt\(\);/.test(SRC.portalExtra) &&
    /"beforeinstallprompt"/.test(SRC.portalExtra) &&
    /event\.preventDefault\(\)/.test(SRC.portalExtra) &&
    /"appinstalled"/.test(SRC.portalExtra) &&
    /\(display-mode: standalone\)/.test(SRC.portalExtra) &&
    /window\.navigator\.standalone === true/.test(SRC.portalExtra) &&
    /INSTALL_DISMISS_KEY = "skb_portal_install_dismissed"/.test(SRC.portalExtra) &&
    /if \(this\.installDismissed\(\)\) return;/.test(SRC.portalExtra) &&
    /isIosSafari\(\)/.test(SRC.portalExtra) &&
    /installEvent\.prompt\(\)/.test(SRC.portalExtra) &&
    !/\balert\(/.test(SRC.portalExtra),
);

check(
  "۱۳.۹ · استایل و مستندات: کلاس‌های نوار + docs/REVIEW-WAVE-13.9.md",
  [".portal-install {", ".portal-install[hidden]", ".portal-install__actions"].every(
    (needle) => SRC.portalCss.includes(needle),
  ) &&
    exists(FILES.docs139) &&
    /offline\.html/.test(read(FILES.docs139)) &&
    /beforeinstallprompt/.test(read(FILES.docs139)) &&
    /SHELL_ASSETS/.test(read(FILES.docs139)),
);

// ============================================================
// خلاصه
// ============================================================
const failed = results.filter((ok) => !ok).length;
console.log(
  `\n${failed === 0 ? "✅" : "❌"} ${results.length - failed}/${results.length} بررسی موفق`,
);

if (failed > 0) {
  console.log("FAIL - گارد پورتال مشتری شکست خورد");
  process.exit(1);
}
console.log("PASS - گارد پورتال مشتری سالم است");





