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
  server: "Backend/server.js",
  apiConst: "Frontend/src/core/constants/api.const.js",
  portalApi: "Frontend/src/features/portal/portal.api.js",
  portalRenderer: "Frontend/src/features/portal/portal.renderer.js",
  portalService: "Frontend/src/features/portal/portal.service.js",
  portalCss: "Frontend/src/features/portal/portal.css",
  portalHtml: "Frontend/src/pages/portal.html",
  appService: "Frontend/src/core/services/app.service.js",
  customerInfo: "Frontend/src/features/customer-info/customer-info.service.js",
  frontendServer: "Frontend/server.js",
  pkg: "Frontend/package.json",
  gateMjs: "tools/gate.mjs",
  gatePs1: "tools/gate.ps1",
  docs: "docs/REVIEW-WAVE-13.2.md",
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
  server: read(FILES.server),
  apiConst: read(FILES.apiConst),
  portalApi: read(FILES.portalApi),
  portalRenderer: read(FILES.portalRenderer),
  portalService: read(FILES.portalService),
  portalHtml: read(FILES.portalHtml),
  appService: read(FILES.appService),
  customerInfo: read(FILES.customerInfo),
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
  "کنترلر: هیچ شناسه‌ای از req.query / req.body / req.params خوانده نمی‌شود",
  !/req\.(query|body|params)\b/.test(SRC.controller),
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
  "کنترلر: فیلدهای حساس مشتری (کد ملی، کد پستی، آدرس، شماره پیام‌رسان) بیرون نمی‌رود",
  !/national_code|postal_code|farm_address|messaging_number/.test(
    SRC.controller,
  ),
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
  "مسیر: فقط یک GET و بدون هیچ POST/PUT/PATCH/DELETE",
  (SRC.routes.match(/router\.get\(/g) || []).length === 1 &&
    !/router\.(post|put|patch|delete)\(/.test(SRC.routes),
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
  catalog.TOTAL_PERMISSIONS === 168 &&
    catalog.PERMISSION_GROUPS.length === 17 &&
    /TOTAL_PERMISSIONS === 168 && catalog\.PERMISSION_GROUPS\.length === 17/.test(
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
  "فرانت: هیچ درخواست نوشتنی در لایهٔ پورتال وجود ندارد",
  !/apiService\.(post|put|patch|delete)\(/.test(SRC.portalApi) &&
    !/apiService\.(post|put|patch|delete)\(/.test(SRC.portalService),
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
  "app.service: استثنای مشتری به صفحهٔ مشخص محدود شده است",
  /isCustomerExemptPage\(\)/.test(SRC.appService) &&
    /this\.currentPage === "customer-info"/.test(SRC.appService),
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





