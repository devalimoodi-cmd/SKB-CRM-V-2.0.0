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
  // ✅ موج ۱۳.۱۰ — «مدارک من» (آپلود/دانلود/حذف نرم)
  portalDocuments: "Frontend/src/features/portal/portal.documents.js",
  documentsController: "Backend/controllers/portalDocumentsController.js",
  documentsRules: "Backend/services/portalDocumentRules.js",
  documentsModel: "Backend/models/PortalDocument.js",
  documentsMigration:
    "Backend/migrations/20261109000000-create-portal-documents.js",
  uploadMiddleware: "Backend/middleware/upload.js",
  verifyDb: "Backend/scripts/verify-db.js",
  gitignore: ".gitignore",
  docs1310: "docs/REVIEW-WAVE-13.10.md",
  // ✅ موج ۱۳.۱۰.۱ — رفع باگ ۵۰۰ داشبورد پورتال (Express 5)
  portalDashboardController: "Backend/controllers/portalDashboardController.js",
  dashboardScope: "Backend/services/portalDashboardScope.js",
  docs13101: "docs/REVIEW-WAVE-13.10.1.md",
  // ✅ موج ۱۳.۱۱ — «درخواست‌های فارم» (الگوی ب: درخواست + تأیید کارشناس)
  portalFarm: "Frontend/src/features/portal/portal.farm.js",
  portalFarmRenderer: "Frontend/src/features/portal/portal.farm.renderer.js",
  farmController: "Backend/controllers/portalFarmController.js",
  farmRules: "Backend/services/portalRequestRules.js",
  farmService: "Backend/services/portalRequestService.js",
  // ✅ موج ۱۳.۱۳ — هستهٔ نوشتن + مسیرها + اعتبارسنجی جزئیات سالن
  farmRoutes: "Backend/routes/portalRoutes.js",
  farmUnitWrite: "Backend/services/farm/unitWrite.js",
  farmHallWrite: "Backend/services/farm/hallWrite.js",
  farmHallDetailsWrite: "Backend/services/farm/hallDetailsWrite.js",
  hallDetailValidation: "Backend/validations/hallDetailValidation.js",
  flockResolver: "Backend/services/flockResolver.js",
  requestModel: "Backend/models/PortalRequest.js",
  requestMigration:
    "Backend/migrations/20261110000000-create-portal-requests.js",
  requestRoutes: "Backend/routes/portalRequestRoutes.js",
  requestAdminController: "Backend/controllers/portalRequestAdminController.js",
  adminRequestsApi:
    "Frontend/src/features/portal-requests/portal-requests.api.js",
  adminRequestsManager:
    "Frontend/src/features/portal-requests/portal-requests.manager.js",
  adminRequestsRenderer:
    "Frontend/src/features/portal-requests/portal-requests.renderer.js",
  adminRequestsCss:
    "Frontend/src/features/portal-requests/portal-requests.css",
  adminPanelHtml: "Frontend/src/pages/admin-panel.html",
  adminPanelService: "Frontend/src/features/admin-panel/admin-panel.service.js",
  docs1311: "docs/REVIEW-WAVE-13.11.md",
  docs1313: "docs/REVIEW-WAVE-13.13.md",
  backendRequestTest: "Backend/portal-request-test.mjs",
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
  // ✅ موج ۱۳.۱۰
  portalDocuments: read(FILES.portalDocuments),
  documentsController: read(FILES.documentsController),
  documentsRules: read(FILES.documentsRules),
  documentsModel: read(FILES.documentsModel),
  documentsMigration: read(FILES.documentsMigration),
  uploadMiddleware: read(FILES.uploadMiddleware),
  verifyDb: read(FILES.verifyDb),
  gitignore: read(FILES.gitignore),
  // ✅ موج ۱۳.۱۰.۱
  portalDashboardController: read(FILES.portalDashboardController),
  dashboardScope: read(FILES.dashboardScope),
  // ✅ موج ۱۳.۱۱ — «درخواست‌های فارم» (الگوی ب)
  portalFarm: read(FILES.portalFarm),
  portalFarmRenderer: read(FILES.portalFarmRenderer),
  farmController: read(FILES.farmController),
  farmRules: read(FILES.farmRules),
  farmService: read(FILES.farmService),
  farmRoutes: read(FILES.farmRoutes),
  farmUnitWrite: read(FILES.farmUnitWrite),
  farmHallWrite: read(FILES.farmHallWrite),
  farmHallDetailsWrite: read(FILES.farmHallDetailsWrite),
  hallDetailValidation: read(FILES.hallDetailValidation),
  flockResolver: read(FILES.flockResolver),
  requestModel: read(FILES.requestModel),
  requestMigration: read(FILES.requestMigration),
  requestRoutes: read(FILES.requestRoutes),
  requestAdminController: read(FILES.requestAdminController),
  adminRequestsApi: read(FILES.adminRequestsApi),
  adminRequestsManager: read(FILES.adminRequestsManager),
  adminRequestsRenderer: read(FILES.adminRequestsRenderer),
  adminPanelHtml: read(FILES.adminPanelHtml),
  adminPanelService: read(FILES.adminPanelService),
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
  "مسیر: ۱۸ GET خواندنی + نوشتن‌های محدود (پروفایل ۳ + مدارک ۲ + فارم ۲ · بدون PUT)",
  // ✅ موج ۱۳.۸: ۸ مسیر خواندنی قبلی + پروفایل + چهار مسیر داشبورد = ۱۳
  // ✅ موج ۱۳.۱۰: دو GET مدارک (فهرست + فایل) ⇒ ۱۵
  // ✅ موج ۱۳.۱۱: دو GET درخواست‌های فارم (options + requests) ⇒ ۱۷
  // ✅ موج ۱۳.۱۳: یک GET جزئیات سالن (/farm/halls/:id) ⇒ ۱۸
  (SRC.routes.match(/router\.get\(/g) || []).length === 18 &&
    (SRC.routes.match(/router\.patch\(/g) || []).length === 1 &&
    // ۲ پروفایل/موبایل + ۱ آپلود مدرک + ۲ درخواست فارم (ثبت/لغو)
    (SRC.routes.match(/router\.post\(/g) || []).length === 5 &&
    // ❌ هیچ PUT ای در کل پورتال نیست
    !/router\.put\(/.test(SRC.routes) &&
    // 🔒 تنها DELETE مجاز: حذف نرم مدرک خودم — نه هیچ منبع دیگری
    (SRC.routes.match(/router\.delete\(/g) || []).length === 1 &&
    /router\.delete\(\s*\n\s*"\/documents\/:id",/.test(SRC.routes) &&
    // نوشتن‌های پروفایل فقط روی مسیرهای پروفایل‌اند
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
    // ⚠️ توضیحات حذف می‌شوند: فایل‌هایی مثل portalRequestRoutes.js در
    //    کامنت می‌گویند «authorize(customer) ندارد» و نباید مثبت کاذب بدهند.
    stripComments(fs.readFileSync(path.join(routesDir, name), "utf8")),
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
  // ✅ موج ۱۳.۱۰: ۳ کلید «مدارک من» (۱۸۸ ⇒ ۱۹۱)
  // ✅ موج ۱۳.۱۱: ۶ کلید «درخواست‌های فارم» + یک گروه تازه (۱۹۱ ⇒ ۱۹۷ / ۱۸)
  catalog.TOTAL_PERMISSIONS === 197 &&
    catalog.PERMISSION_GROUPS.length === 18 &&
    /TOTAL_PERMISSIONS === 197 && catalog\.PERMISSION_GROUPS\.length === 18/.test(
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
  "فرانت: نوشتن‌های پورتال محدود و همه از portal.api (سرویس بدون نوشتن)",
  // ✅ موج ۱۳.۸: PATCH پروفایل + دو مرحلهٔ موبایل
  // ✅ موج ۱۳.۱۰: DELETE مدرک (حذف نرم) ⇒ چهار فراخوانی نوشتن
  // ✅ موج ۱۳.۱۱: POST ثبت درخواست + POST لغو ⇒ شش فراخوانی نوشتن
  (SRC.portalApi.match(/apiService\.(post|put|patch|delete)\(/g) || []).length ===
    6 &&
    /apiService\.patch\(\s*\n?\s*API_CONSTANTS\.ENDPOINTS\.PORTAL\.PROFILE,/.test(
      SRC.portalApi,
    ) &&
    /PORTAL\.PROFILE_MOBILE_REQUEST/.test(SRC.portalApi) &&
    /PORTAL\.PROFILE_MOBILE_CONFIRM/.test(SRC.portalApi) &&
    /PORTAL\.DOCUMENT_DELETE/.test(SRC.portalApi) &&
    // ❌ هیچ نوشتن خامی بیرون از لایهٔ api نیست
    !/apiService\.(post|put|patch|delete)\(/.test(SRC.portalService) &&
    !/apiService\.(post|put|patch|delete|uploadFormData)\(/.test(
      SRC.portalDocuments,
    ) &&
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
  // ✅ موج ۱۳.۱۰: DELETE مدرک ⇒ ۴ (پروفایل ۳ + مدارک ۱)
  // ✅ موج ۱۳.۱۱: ثبت/لغو درخواست فارم ⇒ ۶
  (SRC.portalApi.match(/apiService\.(post|put|patch|delete)\(/g) || []).length ===
    6 &&
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
    // ⚠️ ۱۳.۱۰.۱: اسکوپ به services/portalDashboardScope منتقل شد (پروکسی،
    //    چون در Express 5 انتساب به req.query ممنوع است).
    const src = stripComments(
      read("Backend/controllers/portalDashboardController.js"),
    );
    const scopeSrc = stripComments(
      read("Backend/services/portalDashboardScope.js"),
    );
    return (
      /scopeIdOf/.test(src) &&
      /ALLOWED_QUERY_KEYS = \["flockId", "flockGroupId"\]/.test(scopeSrc) &&
      /query\.customerId = String\(customerId\)/.test(scopeSrc) &&
      // هر شناسهٔ مشتری کلاینت (customer_id/customerId) در فهرست سفید نیست
      !/customer_id/.test(scopeSrc) &&
      // واگذاری همیشه با پروکسی اسکوپ‌شده، نه req خام کلاینت
      /dashboardController\.getChartsData\(scopedRequest\(req\), res\)/.test(src) &&
      /dashboardController\.getAnalysisData\(scopedRequest\(req\), res\)/.test(src) &&
      !/getChartsData\(req, res\)/.test(src) &&
      !/getAnalysisData\(req, res\)/.test(src) &&
      !/req\.query\.customerId/.test(src) &&
      !/req\.query\.customer_id/.test(src)
    );
  })(),
);

check(
  "۱۳.۸ · مسیرها: پروفایل/داشبورد پشت زنجیرهٔ مجوز + محدودکنندهٔ نوشتن + مالکیت گله",
  /const profileChain = \[/.test(SRC.routes) &&
    /requirePermission\("customer\.portal\.profile"\)/.test(SRC.routes) &&
    /requirePermission\("customer\.portal\.profile\.edit"\)/.test(SRC.routes) &&
    // ✅ موج ۱۳.۱۰: سه نوشتنِ ۱۳.۸ + آپلود و حذف مدرک ⇒ ۵
    // ✅ موج ۱۳.۱۱: ثبت درخواست فارم + لغو درخواست ⇒ ۷
    (SRC.routes.match(/(^|\r?\n)[ \t]+portalWriteLimiter,[ \t]*\r?\n/g) || [])
      .length === 7 &&
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
// ۱۵) موج ۱۳.۱۰ — «مدارک من»: آپلود/دانلود/حذف نرم
// ------------------------------------------------------------
// خواستهٔ کارفرما: مشتری بتواند مدارکش (کارت ملی، جواز، فاکتور) را
// از پورتال بفرستد، ببیند و «حذف» کند.
// 🔒 ریشهٔ خطری که این بخش سنجیده می‌شود:
//   ۱) اگر فایل زیر uploads/ ذخیره شود، در server.js **بدون احراز
//      هویت** سرو می‌شود ⇒ هر کسی با دانستن نام فایل، کارت ملی
//      مشتری را می‌گیرد. پس پوشه باید خصوصی باشد.
//   ۲) اگر پوشه از req.body ساخته شود (مثل multer بازدیدها)، مشتری
//      می‌تواند با یک فیلد فرم، فایل را در پوشهٔ پروندهٔ دیگری بنویسد.
//   ۳) اگر نوع/حجم فایل سنجیده نشود، آپلود به محل تزریق فایل تبدیل
//      می‌شود (svg/zip/اجرایی).
//   ۴) «حذف» باید نرم بماند: سند هویتی را نمی‌شود قطعی پاک کرد؛
//      هیچ unlink ای نباید در مسیر مدارک وجود داشته باشد.
// ============================================================
const portalUploadSrc = (() => {
  const marker = SRC.uploadMiddleware.indexOf("const portalDocumentStorage");
  return marker === -1 ? "" : SRC.uploadMiddleware.slice(marker);
})();
const docsRulesClean = stripComments(SRC.documentsRules);
const docsControllerClean = stripComments(SRC.documentsController);
// 🎯 الگوی «پاک‌کردن فایل» — دقیق، تا «unlinked» (پیام پروندهٔ متصل‌نشده)
//    با «unlink()» اشتباه گرفته نشود.
const DELETE_CALL_PATTERN =
  /\b(unlink|unlinkSync|rmdir|rmdirSync)\s*\(|\bfs\.rm(Sync)?\s*\(/;

check(
  "۱۳.۱۰ · مسیرها: چهار مسیر مدارک با زنجیرهٔ تب + کلید آپلود/حذف + مالکیت ردیف",
  /const documentsChain = tabChain\("customer\.portal\.documents"\)/.test(
    SRC.routes,
  ) &&
    /requirePermission\("customer\.portal\.documents\.upload"\)/.test(SRC.routes) &&
    /requirePermission\("customer\.portal\.documents\.delete"\)/.test(SRC.routes) &&
    /requireOwnedRow\(\{ model: PortalDocument, label: "مدرک" \}\)/.test(
      SRC.routes,
    ) &&
    /router\.get\(\s*\n\s*"\/documents",/.test(SRC.routes) &&
    /router\.post\(\s*\n\s*"\/documents",/.test(SRC.routes) &&
    /router\.get\(\s*\n\s*"\/documents\/:id\/file",/.test(SRC.routes) &&
    /router\.delete\(\s*\n\s*"\/documents\/:id",/.test(SRC.routes),
);

check(
  "۱۳.۱۰ · پوشهٔ خصوصی: مدارک هرگز زیر uploads/ نمی‌روند و در گیت ignore اند",
  // 🔒 مسیر ذخیره در سرویس قواعد ساخته می‌شود، نه در کنترلر
  /PRIVATE_DIRNAME = "private"/.test(docsRulesClean) &&
    /DOCUMENT_STORAGE_DIRNAME = "portal_documents"/.test(docsRulesClean) &&
    !/uploads/.test(docsRulesClean) &&
    !/uploads/.test(docsControllerClean) &&
    /Backend\/private\//.test(SRC.gitignore) &&
    // هیچ مسیر عمومی/استاتیکی برای مدارک ساخته نشده است
    !/res\.sendFile\(/.test(docsControllerClean) &&
    !/express\.static/.test(docsControllerClean),
);

check(
  "۱۳.۱۰ · multer: مقصد از req.customerScopeId، نام تصادفی، پسوند از mime مجاز",
  /const portalDocumentStorage = multer\.diskStorage\(/.test(portalUploadSrc) &&
    /const scopeId = Number\(req\.customerScopeId \|\| req\.portalScopeId \|\| 0\)/.test(
      portalUploadSrc,
    ) &&
    /documentCustomerDir\(scopeId\)/.test(portalUploadSrc) &&
    // ❌ برخلاف multer بازدیدها: هیچ ساخت مسیر از req.body
    !/req\.body\.customer_id/.test(stripComments(portalUploadSrc)) &&
    // ❌ پسوند از نام اصلی کاربر گرفته نمی‌شود
    !/path\.extname\(file\.originalname\)/.test(portalUploadSrc) &&
    /mimeDecision\(file\.mimetype\)/.test(portalUploadSrc) &&
    /req\.portalDocumentRelativePath = `customer_\$\{scopeId\}\/\$\{fileName\}`;/.test(
      portalUploadSrc,
    ) &&
    /fileSize: DOCUMENT_MAX_FILE_BYTES/.test(portalUploadSrc) &&
    /files: 1/.test(portalUploadSrc) &&
    /uploadPortalDocumentSingle/.test(portalUploadSrc),
);

check(
  "۱۳.۱۰ · سرویس قواعد: فهرست سفید چهارتایی + سقف ۵MB / ۱۰ مدرک / ۲۵MB",
  ["image/jpeg", "image/png", "image/webp", "application/pdf"].every((mime) =>
    docsRulesClean.includes(`"${mime}"`),
  ) &&
    // 🔒 هیچ نوع خطرناکی در فهرست سفید نیست
    !/zip|svg|mp4|x-msdownload|msword|officedocument/i.test(docsRulesClean) &&
    /DOCUMENT_MAX_FILE_BYTES = 5 \* 1024 \* 1024/.test(docsRulesClean) &&
    /DOCUMENT_MAX_COUNT = 10/.test(docsRulesClean) &&
    /DOCUMENT_MAX_TOTAL_BYTES = 25 \* 1024 \* 1024/.test(docsRulesClean) &&
    // سهمیه **پیش** از multer سنجیده می‌شود (هیچ فایل یتیمی نمی‌ماند)
    /const ensureDocumentQuota = async \(req, res, next\)/.test(
      docsControllerClean,
    ) &&
    /if \(safeCount >= DOCUMENT_MAX_COUNT\)/.test(docsRulesClean) &&
    /safeTotal \+ DOCUMENT_MAX_FILE_BYTES > DOCUMENT_MAX_TOTAL_BYTES/.test(
      docsRulesClean,
    ),
);

check(
  "۱۳.۱۰ · کنترلر: customer_id فقط از توکن + خروجی بدون مسیر دیسک",
  /const scopeIdOf = \(req\) =>/.test(docsControllerClean) &&
    /req\.customerScopeId \|\| req\.portalScopeId/.test(docsControllerClean) &&
    // 🔒 در فهرست، آپلود و سهمیه — همه‌جا customer_id از توکن
    /where: \{ customer_id: customerId \}/.test(docsControllerClean) &&
    /customer_id: customerId,/.test(docsControllerClean) &&
    // ❌ هیچ‌گاه شناسهٔ پرونده از ورودی درخواست خوانده نمی‌شود
    !/req\.body\.customer_id|req\.query\.customer_id|req\.params\.customer_id/.test(
      docsControllerClean,
    ) &&
    // ❌ مسیر دیسک در پاسخ نمی‌آید
    (() => {
      const attrs = /attributes: \[([\s\S]*?)\],/.exec(docsControllerClean);
      return Boolean(attrs) && !attrs[1].includes("file_path");
    })(),
);

check(
  "۱۳.۱۰ · حذف نرم: paranoid + deleted_by + destroy و صفر unlink در کل موج",
  /paranoid: true/.test(stripComments(SRC.documentsModel)) &&
    /deleted_by/.test(stripComments(SRC.documentsModel)) &&
    /deleted_at/.test(SRC.documentsMigration) &&
    /await row\.update\(\{ deleted_by:/.test(docsControllerClean) &&
    /await row\.destroy\(\);/.test(docsControllerClean) &&
    // 🔒 فایل هیچ‌جا پاک نمی‌شود (سند هویتی برای ممیزی می‌ماند)
    //    ⚠️ الگو دقیق است: «unlinked» (پیام «پروندهٔ متصل نیست») نباید
    //    با «unlink()» (پاک‌کردن فایل) اشتباه گرفته شود.
    !DELETE_CALL_PATTERN.test(docsControllerClean) &&
    !DELETE_CALL_PATTERN.test(docsRulesClean) &&
    !DELETE_CALL_PATTERN.test(portalUploadSrc),
);

check(
  "۱۳.۱۰ · دانلود: فقط با توکن (res.download) + مرز مسیر ضد path traversal",
  /const resolveStoredPath = \(relativePath\)/.test(docsRulesClean) &&
    /path\.isAbsolute\(raw\)/.test(docsRulesClean) &&
    /raw\.includes\("\.\."\)/.test(docsRulesClean) &&
    /resolved\.startsWith\(rootWithSep\)/.test(docsRulesClean) &&
    /resolveStoredPath\(row\.file_path\)/.test(docsControllerClean) &&
    /res\.download\(resolved, downloadName\)/.test(docsControllerClean) &&
    /fs\.existsSync\(resolved\)/.test(docsControllerClean),
);

check(
  "۱۳.۱۰ · کاتالوگ: سه کلید «مدارک من» با پیش‌فرض فقط مشتری",
  [
    "customer.portal.documents",
    "customer.portal.documents.upload",
    "customer.portal.documents.delete",
  ].every((key) => {
    const entry = catalog.PERMISSIONS[key];
    return (
      Boolean(entry) &&
      entry.group === "portal" &&
      entry.defaults.customer === true &&
      entry.defaults.admin === false &&
      entry.defaults.expert === false
    );
  }),
);


// (شمارش نتیجه‌ها به انتهای فایل منتقل شد تا همهٔ بررسی‌ها شمرده شوند)

check(
  "۱۳.۱۰ · فرانت api: سه اندپوینت + آپلود FormData(file) و دانلود با توکن",
  SRC.apiConst.includes('DOCUMENTS: "/portal/documents"') &&
    /DOCUMENT_FILE: \(id\) => `\/portal\/documents\/\$\{id\}\/file`/.test(
      SRC.apiConst,
    ) &&
    /DOCUMENT_DELETE: \(id\) => `\/portal\/documents\/\$\{id\}`/.test(
      SRC.apiConst,
    ) &&
    /async uploadDocument\(file/.test(SRC.portalApi) &&
    /formData\.append\("file", file\)/.test(SRC.portalApi) &&
    /apiService\.uploadFormData\(/.test(SRC.portalApi) &&
    /apiService\.download\(/.test(SRC.portalApi) &&
    /apiService\.delete\(/.test(SRC.portalApi) &&
    /documentFileError/.test(SRC.portalApi) &&
    // ❌ هیچ درخواست خام fetch در لایهٔ api پورتال نیست
    !/\bfetch\(/.test(stripComments(SRC.portalApi)),
);

check(
  "۱۳.۱۰ · فرانت سرویس: mixin جدا، ثبت در EXTRA_TABS و گیت مجوز آپلود/حذف",
  /export const DOCUMENT_TABS = \{/.test(SRC.portalDocuments) &&
    /export const applyPortalDocuments = \(ServiceClass\) => \{/.test(
      SRC.portalDocuments,
    ) &&
    /Object\.assign\(ServiceClass\.prototype, portalDocumentsMixin\)/.test(
      SRC.portalDocuments,
    ) &&
    /import \{ DOCUMENT_TABS, applyPortalDocuments \} from "\.\/portal\.documents\.js"/.test(
      SRC.portalService,
    ) &&
    // ✅ موج ۱۳.۱۱: رجیستری تب‌های خاص با لایهٔ فارم هم گسترش می‌یابد
    /Object\.assign\(EXTRA_TABS, DOCUMENT_TABS[,)]/.test(SRC.portalService) &&
    /this\.initDocumentsTab\(\);/.test(SRC.portalService) &&
    /this\.bindDocuments\(\);/.test(SRC.portalService) &&
    /applyPortalDocuments\(PortalService\);/.test(SRC.portalService) &&
    // ترتیب اجباری: ثبت تب قبل از ALL_TAB_KEYS و mixin بعد از extra
    SRC.portalService.indexOf("Object.assign(EXTRA_TABS, DOCUMENT_TABS") <
      SRC.portalService.indexOf("const ALL_TAB_KEYS") &&
    SRC.portalService.indexOf("applyPortalDocuments(PortalService)") >
      SRC.portalService.indexOf("applyPortalExtra(PortalService)") &&
    // 🔒 گیت‌ها: بدون مجوز، هیچ درخواستی نمی‌رود
    /if \(!this\.canUploadDocuments\(\)\) return;/.test(SRC.portalDocuments) &&
    /if \(!this\.canDeleteDocuments\(\)\) return;/.test(SRC.portalDocuments) &&
    // ❌ بدون alert/confirm بومی (حذف دو مرحله‌ای درجا)
    !/\balert\(/.test(stripComments(SRC.portalDocuments)) &&
    !/\bwindow\.confirm\(/.test(stripComments(SRC.portalDocuments)) &&
    /pendingDelete/.test(SRC.portalDocuments),
);

check(
  "۱۳.۱۰ · صفحه/رندرر/CSS: تب و پنل بدون تگ فرم + ورودی فایل + کلاس‌های استایل",
  [
    'data-portal-tab="documents"',
    'data-portal-panel="documents"',
    'id="portalDocsStatus"',
    'id="portalDocsBody"',
    'id="portalDocsQuota"',
    'id="portalDocsFormSlot"',
    'id="portalDocsList"',
  ].every((needle) => SRC.portalHtml.includes(needle)) &&
    !/<form|type="submit"|method="post"/i.test(SRC.portalHtml) &&
    /export const renderDocumentList/.test(SRC.portalRenderer) &&
    /export const renderDocumentRow/.test(SRC.portalRenderer) &&
    /export const renderDocumentUploadBox/.test(SRC.portalRenderer) &&
    /export const renderDocumentQuota/.test(SRC.portalRenderer) &&
    /type="file"/.test(SRC.portalRenderer) &&
    /accept="image\/jpeg,image\/png,image\/webp,application\/pdf"/.test(
      SRC.portalRenderer,
    ) &&
    !/<form|type="submit"/i.test(SRC.portalRenderer) &&
    [
      ".portal-docs {",
      ".portal-docs__quota",
      ".portal-docs__item",
      ".portal-btn--danger",
    ].every((needle) => SRC.portalCss.includes(needle)),
);

check(
  "۱۳.۱۰ · مایگریشن/مدل/verify-db + مستندات موج",
  exists(FILES.documentsMigration) &&
    exists(FILES.documentsModel) &&
    exists(FILES.docs1310) &&
    /portal_documents/.test(SRC.documentsMigration) &&
    /deleted_at/.test(SRC.documentsMigration) &&
    /showAllTables/.test(SRC.documentsMigration) &&
    /"portal_documents",/.test(SRC.verifyDb) &&
    /portal_documents_deleted_at/.test(SRC.verifyDb) &&
    /حذف نرم/.test(read(FILES.docs1310)),
);

// ============================================================
// ۱۶) موج ۱۳.۱۰.۱ — رفع ۵۰۰ داشبورد پورتال (Express 5)
// ------------------------------------------------------------
// 🔒 ریشهٔ خطری که این بخش سنجیده می‌شود:
//   ۱) در Express 5، `req.query` فقط getter است (هر بار از req.url
//      از نو ساخته می‌شود، بدون setter). هر انتساب به آن در حالت
//      strict یک TypeError است ⇒ کل اندپوینت ۵۰۰ می‌شود. دقیقاً همین
//      باگ، «نمودارها» و «تحلیل‌ها»ی پورتال را خراب کرده بود.
//   ۲) «تزریق اجباری» اسکوپ اگر روی آبجکتِ دورریز بنویسد، محافظت
//      *ظاهری* است و فیلتر امنیتی واقعاً اعمال نمی‌شود.
//   ۳) اگر مشتری گله‌اش را بسته باشد، درخواست بدون شناسهٔ گله فقط
//      جوجه‌ریزی‌های فعال را می‌گیرد ⇒ نمودار خالی. پس آخرین گله باید
//      پیش‌فرض انتخاب شود — ولی انتخاب دستی کاربر بازنویسی نشود.
// ⭐ این بخش «منطق واقعی» را هم اجرا می‌کند (بدون دیتابیس/HTTP).
// ============================================================
const dashboardScopeService = require(
  path.join(ROOT, "Backend/services/portalDashboardScope.js"),
);
const dashboardControllerClean = stripComments(SRC.portalDashboardController);
const scopeServiceClean = stripComments(SRC.dashboardScope);
const middlewareClean = stripComments(SRC.middleware);
const portalApiClean = stripComments(SRC.portalApi);

// (۱) اسکن کل بک‌اند: هیچ انتسابی به req.query/req.params نمانده باشد
const BACKEND_DIRS = ["controllers", "middleware", "routes", "services"];
const backendJsFiles = BACKEND_DIRS.flatMap((dir) => {
  const full = path.join(ROOT, "Backend", dir);
  if (!fs.existsSync(full)) return [];
  return fs
    .readdirSync(full, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".js"))
    .map((entry) => path.join(full, entry.name));
});
// فقط کوئری و پارامتر مسیر: این دو در Express 5 getter-only هستند
// (`req.body` یک property معمولی است و انتسابش مجاز است).
const READONLY_REQUEST_PROP = /\breq\.(query|params)\s*=(?!=)/;
const offenders = backendJsFiles
  .filter((file) =>
    READONLY_REQUEST_PROP.test(stripComments(fs.readFileSync(file, "utf8"))),
  )
  .map((file) => path.relative(ROOT, file));

check(
  "۱۳.۱۰.۱ · بک‌اند: صفر انتساب به `req.query`/`req.params` (قاعدهٔ Express 5)",
  backendJsFiles.length > 30 && offenders.length === 0,
  offenders.join(", "),
);

// (۲) درخواست شبیه‌سازی‌شده با همان رفتار Express 5 (query فقط getter)
const expressLikeRequest = () => {
  const url =
    "/api/portal/dashboard/charts?customerId=999&customer_id=999&flockGroupId=7&scope=ALL&evil=1&flockId[]=5";
  const req = {
    url,
    method: "GET",
    customerScopeId: 5,
    user: { id: 12, role: "customer", customer_id: 5 },
  };
  Object.defineProperty(req, "query", {
    get: () =>
      Object.fromEntries(new URL(url, "http://localhost").searchParams.entries()),
    enumerable: true,
    configurable: true,
  });
  return req;
};

const getterOnlyRejectsAssignment = (() => {
  const req = expressLikeRequest();
  try {
    req.query = { customerId: "1" };
    return false;
  } catch (error) {
    return error instanceof TypeError;
  }
})();

check(
  "۱۳.۱۰.۱ · شبیه‌سازی Express 5: انتساب به query واقعاً TypeError می‌دهد",
  getterOnlyRejectsAssignment,
);

const forcedQueryResult = (() => {
  try {
    return dashboardScopeService.forcedQuery(expressLikeRequest());
  } catch {
    return null;
  }
})();

check(
  "۱۳.۱۰.۱ · forcedQuery: تحمیل customerId از توکن + دور ریختن customer_id/پارامتر ناشناخته",
  forcedQueryResult !== null &&
    forcedQueryResult.customerId === "5" &&
    forcedQueryResult.flockGroupId === "7" &&
    forcedQueryResult.scope === "all" &&
    forcedQueryResult.customer_id === undefined &&
    forcedQueryResult.evil === undefined &&
    forcedQueryResult["flockId[]"] === undefined,
  forcedQueryResult === null ? "threw" : JSON.stringify(forcedQueryResult),
);

const scopedRequestResult = (() => {
  try {
    const req = expressLikeRequest();
    const proxy = dashboardScopeService.scopedRequest(req);
    return {
      ok: true,
      query: proxy.query,
      method: proxy.method,
      scopeId: proxy.customerScopeId,
      originalQuery: req.query,
    };
  } catch (error) {
    return { ok: false, error: error.message };
  }
})();

check(
  "۱۳.۱۰.۱ · scopedRequest: پروکسی بدون TypeError، وراثت req اصلی، بدون تغییر در req",
  scopedRequestResult.ok === true &&
    scopedRequestResult.query.customerId === "5" &&
    scopedRequestResult.method === "GET" &&
    scopedRequestResult.scopeId === 5 &&
    scopedRequestResult.originalQuery.customerId === "999",
  scopedRequestResult.ok ? "" : scopedRequestResult.error,
);

// (۳) کنترلر پورتال: واگذاری با پروکسی، نه دست‌کاری req
check(
  "۱۳.۱۰.۱ · کنترلر پورتال: getChartsData/getAnalysisData با scopedRequest و صفر انتساب",
  /scopedRequest\(req\)/.test(dashboardControllerClean) &&
    !READONLY_REQUEST_PROP.test(dashboardControllerClean) &&
    /dashboardController\.getChartsData\(scopedRequest\(req\),\s*res\)/.test(
      dashboardControllerClean,
    ) &&
    /dashboardController\.getAnalysisData\(scopedRequest\(req\),\s*res\)/.test(
      dashboardControllerClean,
    ) &&
    /require\("\.\.\/services\/portalDashboardScope"\)/.test(
      dashboardControllerClean,
    ),
);

// (۴) سرویس اسکوپ: فهرست سفید + پروکسی بدون کپی req
check(
  "۱۳.۱۰.۱ · سرویس اسکوپ: فهرست سفید flockId/flockGroupId/scope + defineProperty + Object.create",
  /ALLOWED_QUERY_KEYS = \["flockId", "flockGroupId"\]/.test(scopeServiceClean) &&
    /ALLOWED_SCOPES = \["all"\]/.test(scopeServiceClean) &&
    /Object\.create\(req/.test(scopeServiceClean) &&
    /Object\.defineProperty\(\s*proxy,\s*"query"/.test(scopeServiceClean) &&
    /query\.customerId = String\(customerId\)/.test(scopeServiceClean),
);

// (۵) تزریق اجباری اسکوپ در middleware با defineProperty (نه انتساب)
check(
  "۱۳.۱۰.۱ · customerScope: تزریق اسکوپ با defineProperty روی query",
  /Object\.defineProperty\(req,\s*"query"/.test(middlewareClean) &&
    !READONLY_REQUEST_PROP.test(middlewareClean),
);

// (۶) فرانت: انتخاب پیش‌فرض «آخرین گله» + حفظ انتخاب دستی
check(
  "۱۳.۱۰.۱ · پورتال: پیش‌فرض = آخرین گلهٔ پرونده و انتخاب دستی کاربر محفوظ می‌ماند",
  /applyDefaultDashboardSelection\(\)\s*\{/.test(SRC.portalExtra) &&
    /this\.dashboardUserPicked = false/.test(SRC.portalExtra) &&
    /this\.dashboardUserPicked = true/.test(SRC.portalExtra) &&
    /flocks\[0\]/.test(SRC.portalExtra) &&
    // فراخوانی پیش از رندر فهرست (تا <select> همان گله را نشان دهد)
    SRC.portalExtra.indexOf("this.applyDefaultDashboardSelection();") !== -1 &&
    SRC.portalExtra.indexOf("this.applyDefaultDashboardSelection();") <
      SRC.portalExtra.indexOf("this.renderDashboardOptionsBlock();"),
);

// (۷) scope=all برای گلهٔ بسته: کلاینت فقط "all" می‌فرستد
check(
  "۱۳.۱۰.۱ · scope=all: کلاینت فقط «all» را مجاز می‌داند و استاندارد نژاد آن را می‌خواهد",
  /getDashboardAnalysis\(\{ scope: "all" \}\)/.test(SRC.portalExtra) &&
    /async getDashboardAnalysis\(\{ scope = "" \} = \{\}\)/.test(portalApiClean) &&
    /params\.scope = "all"/.test(portalApiClean) &&
    !/getDashboardAnalysis\(\)/.test(portalApiClean),
);

// (۸) مستندات موج + قاعدهٔ عمومی Express 5
check(
  "۱۳.۱۰.۱ · مستندات موج و قاعدهٔ Express 5 ثبت شده",
  exists(FILES.docs13101) &&
    /Express 5/.test(read(FILES.docs13101)) &&
    /req\.query/.test(read(FILES.docs13101)) &&
    /۱۳\.۱۰\.۱/.test(read(FILES.docs13101)),
);

// ============================================================
// ۱۷) موج ۱۳.۱۱ — «درخواست‌های فارم» (الگوی ب: درخواست + تأیید)
// ------------------------------------------------------------
//  ریشهٔ خطری که این بخش از بازگشتش جلوگیری می‌کند:
//   ۱) اگر مشتری بتواند مستقیم واحد/سالن/جوجه‌ریزی بنویسد، «تأیید
//      کارشناس» بی‌معنا می‌شود (الگوی ب نقض می‌شود).
//   ۲) اگر `customer_id` از بدنه خوانده شود ⇒ IDOR.
//   ۳) اگر payload خام ذخیره شود ⇒ مشتری می‌تواند `status` یا
//      `reviewed_by` را ست کند (تأیید خودکار).
//   ۴) اگر تأیید تراکنشی/قفل‌شده نباشد، دو مدیر هم‌زمان یک رکورد را
//      دو بار می‌سازند.
//   ۵) اگر مسیر تأیید `authorize("customer")` بگیرد، مرز نقش‌ها
//      می‌شکند.
// ============================================================
check(
  "۱۳.۱۱ · فایل‌های موج موجودند (بک‌اند + پورتال + پنل ادمین + مستندات)",
  [
    FILES.portalFarm,
    FILES.portalFarmRenderer,
    FILES.farmController,
    FILES.farmRules,
    FILES.farmService,
    FILES.flockResolver,
    FILES.requestModel,
    FILES.requestMigration,
    FILES.requestRoutes,
    FILES.requestAdminController,
    FILES.adminRequestsApi,
    FILES.adminRequestsManager,
    FILES.adminRequestsRenderer,
    FILES.adminRequestsCss,
    FILES.docs1311,
    FILES.backendRequestTest,
  ].every(exists),
);

check(
  "۱۳.۱۱ · مشتری فقط «درخواست» می‌فرستد: مسیر نوشتن مستقیم وجود ندارد",
  /router\.post\(\s*\n\s*"\/farm\/requests",/.test(SRC.routes) &&
    /router\.post\(\s*\n\s*"\/farm\/requests\/:id\/cancel",/.test(SRC.routes) &&
    !/router\.(put|patch|delete)\(\s*\n\s*"\/farm/.test(SRC.routes) &&
    // کنترلر مشتری هیچ نوشتن مستقیمی روی Unit/Hall/ChickPlacement ندارد
    !/(Unit|Hall|ChickPlacement)\.(create|update|destroy|upsert)\(/.test(
      stripComments(SRC.farmController),
    ),
);

check(
  "۱۳.۱۱ · customer_id فقط از توکن: نه در کنترلر مشتری و نه در payload سفید",
  /req\.customerScopeId/.test(SRC.farmController) &&
    !/req\.(body|query|params)[^\n]{0,40}customer(?:_id|_personal_information_id)/i.test(
      stripComments(SRC.farmController),
    ) &&
    /customer_id: customerId, \/\/ 🔒 فقط از توکن/.test(SRC.farmService),
);

check(
  "۱۳.۱۱ · فهرست سفید payload در سرویس قواعد، منبع واحد است",
  /const ALLOWED_PAYLOAD_KEYS = \{/.test(SRC.farmRules) &&
    /unit_create: \[/.test(SRC.farmRules) &&
    /hall_create: \[/.test(SRC.farmRules) &&
    /placement_create: \[/.test(SRC.farmRules) &&
    /const sanitizePayload = \(type, body\) => \{/.test(SRC.farmRules) &&
    /const validatePayload = \(type, payload\) => \{/.test(SRC.farmRules) &&
    /require\("\.\/portalRequestRules"\)/.test(SRC.farmService) &&
    !/const ALLOWED_PAYLOAD_KEYS/.test(SRC.farmService),
);

check(
  "۱۳.۱۱ · سقف‌ها: ۱۰ درخواست در انتظار · ۸KB payload · دلیل رد اجباری",
  /const MAX_PENDING_REQUESTS = 10;/.test(SRC.farmRules) &&
    /const MAX_PAYLOAD_BYTES = 8192;/.test(SRC.farmRules) &&
    /const MIN_REASON_LENGTH = 3;/.test(SRC.farmRules) &&
    /too_many_pending/.test(SRC.farmService) &&
    /validateReason\(reason\)/.test(SRC.farmService),
);

check(
  "۱۳.۱۱ · تأیید = تراکنش + قفل ردیف + شرط pending (ضد تأیید دوباره)",
  /sequelize\.transaction\(\)/.test(SRC.farmService) &&
    /lock: transaction\.LOCK\.UPDATE/.test(SRC.farmService) &&
    /already_reviewed", 409/.test(SRC.farmService) &&
    /await safeRollback\(transaction\)/.test(SRC.farmService) &&
    /approvalPatch\(/.test(SRC.farmService) &&
    /rejectionPatch\(/.test(SRC.farmService) &&
    /cancelPatch\(/.test(SRC.farmService),
);
check(
  "۱۳.۱۱ · مسیر تأیید/رد فقط کارکنان: مجوز صریح و بدون authorize(customer)",
  /requirePermission\("portal\.requests\.view"\)/.test(SRC.requestRoutes) &&
    /requirePermission\("portal\.requests\.review"\)/.test(SRC.requestRoutes) &&
    !/authorize\(/.test(stripComments(SRC.requestRoutes)) &&
    /router\.post\("\/:id\/approve", \.\.\.reviewChain/.test(SRC.requestRoutes) &&
    /router\.post\("\/:id\/reject", \.\.\.reviewChain/.test(SRC.requestRoutes) &&
    /app\.use\("\/api\/portal-requests",\s*portalRequestRoutes\);/.test(
      SRC.server,
    ),
);

check(
  "۱۳.۱۱ · گله از یک منبع مشترک حل می‌شود (flockResolver)",
  /module\.exports = \{\s*\n\s*getNextFlockNumber,/.test(SRC.flockResolver) &&
    /require\("\.\.\/flockResolver"\)/.test(
      read("Backend/services/farm/placementWrite.js"),
    ) &&
    // ✅ ۱۳.۱۳: پورتال دیگر خودش flockResolver را صدا نمی‌زند؛ از
    // placementWrite می‌گذرد (همان منبع) و نباید نسخهٔ محلی بسازد.
    /require\("\.\/farm\/placementWrite"\)/.test(SRC.farmService) &&
    !/const resolveFlock = async/.test(SRC.farmService) &&
    !/const resolveFlock = async/.test(
      read("Backend/services/farm/placementWrite.js"),
    ),
);

// ✅ ۱۳.۱۲ — هستهٔ نوشتن مشترک: هیچ کنترلر کارشناسی نباید منطق نوشتن
//    مستقل داشته باشد؛ همه از services/farm/* می‌گذرند.
check(
  "۱۳.۱۲ · نوشتن فارم از هستهٔ مشترک services/farm/* می‌گذرد",
  /require\("\.\.\/services\/farm\/placementWrite"\)/.test(
    read("Backend/controllers/chickPlacementController.js"),
  ) &&
    /require\("\.\.\/services\/farm\/weeklyWrite"\)/.test(
      read("Backend/controllers/weeklyController.js"),
    ) &&
    /require\("\.\.\/services\/farm\/unitWrite"\)/.test(
      read("Backend/controllers/unitController.js"),
    ) &&
    /require\("\.\.\/services\/farm\/hallWrite"\)/.test(
      read("Backend/controllers/hallController.js"),
    ) &&
    /require\("\.\.\/services\/farm\/hallDetailsWrite"\)/.test(
      read("Backend/controllers/hallSystemController.js"),
    ) &&
    !/const checkWeekOrder = async/.test(
      read("Backend/controllers/weeklyController.js"),
    ) &&
    !/const saveMultipleItems = async/.test(
      read("Backend/controllers/weeklyController.js"),
    ),
);

check(
  "۱۳.۱۱ · لغو درخواست: مالکیت ردیف + فقط pending + سقف نوشتن",
  /const farmCancelChain = \[/.test(SRC.routes) &&
    /requireOwnedRow\(\{ model: PortalRequest, label: "درخواست" \}\)/.test(
      SRC.routes,
    ) &&
    /portalWriteLimiter,/.test(SRC.routes) &&
    /cancel_only_pending", 409/.test(SRC.farmService),
);

check(
  "۱۳.۱۱ · مهاجرت/مدل/verify-db: جدول portal_requests با سه ایندکس",
  /portal_requests/.test(SRC.requestMigration) &&
    /showAllTables/.test(SRC.requestMigration) &&
    /payload/.test(SRC.requestMigration) &&
    /JSONB/.test(SRC.requestMigration) &&
    /request_type/.test(SRC.requestModel) &&
    /"portal_requests",/.test(SRC.verifyDb) &&
    /portal_requests_status_created/.test(SRC.verifyDb) &&
    /portal_requests_customer_status_created/.test(SRC.verifyDb),
);

check(
  "۱۳.۱۱ · پورتال: تب از رجیستری EXTRA_TABS + mixin + ترتیب بارگذاری",
  /export const FARM_TABS = \{/.test(SRC.portalFarm) &&
    /permission: "customer\.portal\.farm"/.test(SRC.portalFarm) &&
    /export const applyPortalFarm = \(ServiceClass\) => \{/.test(
      SRC.portalFarm,
    ) &&
    /applyPortalFarm\(PortalService\);/.test(SRC.portalService) &&
    /this\.initFarmTab\(\);/.test(SRC.portalService) &&
    /this\.bindFarm\(\);/.test(SRC.portalService) &&
    SRC.portalService.indexOf("Object.assign(EXTRA_TABS, DOCUMENT_TABS, FARM_TABS)") <
      SRC.portalService.indexOf("const ALL_TAB_KEYS") &&
    SRC.portalService.indexOf("applyPortalFarm(PortalService)") >
      SRC.portalService.indexOf("applyPortalDocuments(PortalService)"),
);

check(
  "۱۳.۱۱ · پورتال: گیت دکمه‌ها از features سرور + بدون alert/confirm بومی",
  /if \(!this\.canRequestFarm\(\)\) return;/.test(SRC.portalFarm) &&
    /if \(!this\.canCancelFarmRequest\(\)\) return;/.test(SRC.portalFarm) &&
    /features\.farm_request/.test(SRC.portalFarm) &&
    /features\.farm_cancel/.test(SRC.portalFarm) &&
    !/\balert\(/.test(stripComments(SRC.portalFarm)) &&
    !/\bconfirm\(/.test(stripComments(SRC.portalFarm)),
);

check(
  "۱۳.۱۱ · پورتال: سرور هم features.farm_* و sections.farm را برمی‌گرداند",
  /customer\.portal\.farm\.request/.test(SRC.controller) &&
    /customer\.portal\.farm\.cancel/.test(SRC.controller) &&
    /farm: canFarm,/.test(SRC.controller) &&
    /farm_request: Boolean\(canFarm && canFarmRequest\)/.test(SRC.controller) &&
    /farm_cancel: Boolean\(canFarm && canFarmCancel\)/.test(SRC.controller),
);

check(
  "۱۳.۱۱ · صفحهٔ پورتال: تب/پنل جدید بدون تگ فرم",
  /data-portal-tab="farm"/.test(SRC.portalHtml) &&
    /data-portal-panel="farm"/.test(SRC.portalHtml) &&
    /id="portalFarmBody"/.test(SRC.portalHtml) &&
    /id="portalFarmStatus"/.test(SRC.portalHtml) &&
    !/<form|type="submit"|method="post"/i.test(SRC.portalHtml) &&
    !/<form|type="submit"/i.test(SRC.portalFarmRenderer),
);

check(
  "۱۳.۱۱ · رندرر پورتال: escape خروجی + اعتبارسنجی فرم سمت کلاینت",
  /const esc = \(value\) =>/.test(SRC.portalFarmRenderer) &&
    /export const FARM_FORM_SPEC = \{/.test(SRC.portalFarmRenderer) &&
    /export const renderFarmPanel = \(\{/.test(SRC.portalFarmRenderer) &&
    /farmFormError\(\)\s*\{/.test(SRC.portalFarm) &&
    /&amp;/.test(SRC.portalFarmRenderer),
);

check(
  "۱۳.۱۱ · api.const: اندپوینت‌های مشتری و صف کارکنان ثبت شده‌اند",
  /FARM_OPTIONS: "\/portal\/farm\/options"/.test(SRC.apiConst) &&
    /FARM_REQUESTS: "\/portal\/farm\/requests"/.test(SRC.apiConst) &&
    /FARM_REQUEST_CANCEL: \(id\)/.test(SRC.apiConst) &&
    /PORTAL_REQUESTS: \{/.test(SRC.apiConst) &&
    /PENDING_COUNT: "\/portal-requests\/pending-count"/.test(SRC.apiConst) &&
    /APPROVE: \(id\)/.test(SRC.apiConst) &&
    /REJECT: \(id\)/.test(SRC.apiConst),
);
check(
  "۱۳.۱۱ · پنل ادمین: منو/بخش/مودال + سیم‌کشی دینامیک سرویس",
  /data-menu="portal-requests"/.test(SRC.adminPanelHtml) &&
    /data-permission="admin\.menu\.portalRequests"/.test(SRC.adminPanelHtml) &&
    /id="portal-requests" class="content-section"/.test(SRC.adminPanelHtml) &&
    /id="portalRequestsQueue"/.test(SRC.adminPanelHtml) &&
    /id="portalRequestsMenuBadge"/.test(SRC.adminPanelHtml) &&
    /id="portalRequestsModal"/.test(SRC.adminPanelHtml) &&
    /"portal-requests": "admin\.menu\.portalRequests",/.test(
      SRC.adminPanelService,
    ) &&
    /case "portal-requests":/.test(SRC.adminPanelService) &&
    /await import\("\.\.\/portal-requests\/portal-requests\.manager\.js"\)/.test(
      SRC.adminPanelService,
    ),
);

check(
  "۱۳.۱۱ · ماژول ادمین: مسیرهای API + گیت مجوز تأیید + escape خروجی",
  /portalRequestsApi\.approve\(/.test(SRC.adminRequestsManager) &&
    /portalRequestsApi\.reject\(/.test(SRC.adminRequestsManager) &&
    /portalRequestsApi\.pendingCount\(/.test(SRC.adminRequestsManager) &&
    /portal\.requests\.review/.test(SRC.adminRequestsManager) &&
    /const esc = \(value\) =>/.test(SRC.adminRequestsRenderer) &&
    /data-prq-modal-approve/.test(SRC.adminPanelHtml) &&
    /data-prq-modal-reject/.test(SRC.adminPanelHtml),
);

check(
  "۱۳.۱۱ · تست بک‌اند ثبت شده + مستندات موج موجود است",
  /test:portal-requests/.test(read("Backend/package.json")) &&
    /portal-request-test/.test(read(FILES.backendRequestTest)) &&
    /۱۳\.۱۱/.test(read(FILES.docs1311)) &&
    /الگوی ب/.test(read(FILES.docs1311)),
);

// ============================================================
// ✅ موج ۱۳.۱۳ — هشت نوع تازه روی همان الگوی درخواست/تأیید
// ============================================================

check(
  "۱۳.۱۳ · هشت نوع تازه در قواعد ثبت شده‌اند",
  [
    "unit_update",
    "unit_delete",
    "hall_update",
    "hall_delete",
    "hall_physical_save",
    "hall_system_save",
    "hall_water_feed_save",
    "hall_hygiene_save",
  ].every((type) => SRC.farmRules.includes(`key: "${type}"`)),
);

check(
  "۱۳.۱۳ · فهرست سفید جزئیات سالن از اعتبارسنج کارشناس مشتق می‌شود",
  /HALL_DETAIL_FIELDS/.test(SRC.farmRules) &&
    /hallDetailPayloadKeys\("hall_physical_save"\)/.test(SRC.farmRules) &&
    /hallDetailPayloadKeys\("hall_system_save", \["items"\]\)/.test(
      SRC.farmRules,
    ) &&
    !/"unit_id",\n\s+"length"/.test(SRC.farmRules),
);

check(
  "۱۳.۱۳ · payload آرایه‌ای (تجهیزات) پاک‌سازی و سقف‌دار است",
  /const LIST_FIELDS = \{/.test(SRC.farmRules) &&
    /hall_system_save: \["items"\]/.test(SRC.farmRules) &&
    /const sanitizeListItems = \(value\) => \{/.test(SRC.farmRules) &&
    /LIST_ITEM_ALLOWED_KEYS/.test(SRC.farmRules),
);

check(
  "۱۳.۱۳ · سرویس پورتال نوشتن را به هستهٔ مشترک فارم می‌سپارد",
  /require\("\.\/farm\/unitWrite"\)/.test(SRC.farmService) &&
    /require\("\.\/farm\/hallWrite"\)/.test(SRC.farmService) &&
    /require\("\.\/farm\/hallDetailsWrite"\)/.test(SRC.farmService) &&
    !/const nextHallNumber = async/.test(SRC.farmService) &&
    !/const syncUnitHallCount = async/.test(SRC.farmService),
);

check(
  "۱۳.۱۳ · مالکیت ردیف هدف داخل همان تراکنش سنجیده می‌شود",
  /const requireOwnedUnit = async/.test(SRC.farmService) &&
    /const requireOwnedHall = async/.test(SRC.farmService) &&
    /lock: transaction\.LOCK\.UPDATE/.test(SRC.farmService) &&
    /customer_personal_information_id: customerId/.test(SRC.farmService) &&
    /where: \{ id: hallId, customer_id: customerId \}/.test(SRC.farmService),
);

check(
  "۱۳.۱۳ · حذف واحد بازتایپ نام می‌خواهد و حذف سالن از هشدار رد نمی‌شود",
  /confirm_name/.test(SRC.farmRules) &&
    /confirm_name_mismatch/.test(SRC.farmService) &&
    /DESTRUCTIVE_TYPES/.test(SRC.farmRules) &&
    /unitWrite\.deleteUnit\(/.test(SRC.farmService) &&
    /hallWrite\.deleteHall\(/.test(SRC.farmService),
);

check(
  "۱۳.۱۳ · مسیر «جزئیات سالن خودم» با مالکیت ردیف و بدون سقف نوشتن",
  /"\/farm\/halls\/:id"/.test(SRC.farmRoutes) &&
    /requireOwnedRow\(\{ model: Hall, label: "سالن" \}\)/.test(SRC.farmRoutes) &&
    /hallDetailsFor/.test(SRC.farmService),
);

check(
  "۱۳.۱۳ · گزینه‌های فرم دیکشنری‌های چهار حوزه و پرچم «ثبت‌شده» را دارد",
  /floor_types:/.test(SRC.farmService) &&
    /heating_systems:/.test(SRC.farmService) &&
    /waterer_types:/.test(SRC.farmService) &&
    /feeder_types:/.test(SRC.farmService) &&
    /has_physical:/.test(SRC.farmService) &&
    /has_water_feed:/.test(SRC.farmService),
);

check(
  "۱۳.۱۳ · هستهٔ نوشتن تراکنش بیرونی را می‌پذیرد (تأیید اتمیک)",
  /existingTransaction/.test(SRC.farmUnitWrite) &&
    /existingTransaction/.test(SRC.farmHallWrite) &&
    /existingTransaction/.test(SRC.farmHallDetailsWrite) &&
    /requireHall\(hall_id, existingTransaction\)/.test(
      SRC.farmHallDetailsWrite,
    ),
);

check(
  "۱۳.۱۳ · پنل کارشناس انواع تازه را برچسب‌دار و با هشدار حذف نشان می‌دهد",
  /unit_delete: "حذف واحد مرغداری"/.test(SRC.adminRequestsRenderer) &&
    /hall_hygiene_save: "ثبت بهداشت سالن"/.test(SRC.adminRequestsRenderer) &&
    /DESTRUCTIVE_TYPE_KEYS/.test(SRC.adminRequestsRenderer) &&
    /LIST_PAYLOAD_KEYS/.test(SRC.adminRequestsRenderer) &&
    /prq-warn/.test(read(FILES.adminRequestsCss)),
);

check(
  "۱۳.۱۳ · مستندات موج ۱۳.۱۳ موجود است",
  /۱۳\.۱۳/.test(read(FILES.docs1313)) &&
    /hall_physical_save/.test(read(FILES.docs1313)),
);

check(
  "۱۳.۱۳ · تب‌های پورتال فقط برای انواع دارای فرم ساخته می‌شوند (بدون تب بی‌فرم)",
  /const serverTypes = Array\.isArray\(meta\.types\)/.test(
    SRC.portalFarmRenderer,
  ) &&
    /meta\.types\.filter\(\(item\) => item && FARM_FORM_SPEC\[item\.key\]\)/.test(
      SRC.portalFarmRenderer,
    ) &&
    /if \(!FARM_FORM_SPEC\[key\]\) return;/.test(SRC.portalFarm),
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





