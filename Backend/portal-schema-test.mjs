// ============================================================
//  گارد «اسکیمای مشترک پورتال» — موج ۱۳.۱۸
// ------------------------------------------------------------
//  این گارد همان چیزی را اجرا می‌سنجد که پیش از ۱۳.۱۸ در چهار فایل
//  دستی تایپ می‌شد (کلید مجوز، مسیر، پنل، مالکیت ردیف). اگر روزی:
//   ۱) مسیری بی‌کلید یا با کلید دستی به روتر اضافه شود ⇒ FAIL
//   ۲) کلیدی در اسکیما باشد که در کاتالوگ مجوز نیست ⇒ FAIL
//   ۳) مسیر :id بدون مالکیت/اسکوپ ردیف بماند (IDOR) ⇒ FAIL
//   ۴) فیلد «هرگز» (اقتصاد گله/یادداشت/کارشناس) به فهرست سفید برسد ⇒ FAIL
//   ۵) ستون تازه‌ای به جدول‌های پورتال اضافه شود و تصمیم نمایش
//      گرفته نشود ⇒ FAIL (شمارندهٔ ستون‌ها)
//   ۶) پنل/مسیر در portal.html و اسکیما ناهم‌تراز شوند ⇒ FAIL
//
//  اجرا:  npm run test:portal-schema      (در پوشهٔ Backend)
//  ⭐ بخش‌های ۴ و ۶ و ۷ **واقعاً اجرا** می‌شوند (بدون دیتابیس).
// ============================================================
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const BACKEND = import.meta.dirname;
const ROOT = path.join(BACKEND, "..");

const results = [];
const check = (name, ok, extra = "") => {
  results.push(Boolean(ok));
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}${extra ? " :: " + extra : ""}`);
};

const read = (relPath) => {
  try {
    return fs.readFileSync(path.join(ROOT, relPath), "utf8").replace(/^\uFEFF/, "");
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
// ۰) فایل‌ها و ماژول‌های واقعی (بارگذاری ⇒ خودِ کد اجرا می‌شود)
// ============================================================
const FILES = {
  schema: "Backend/config/portalSchema.js",
  routes: "Backend/routes/portalRoutes.js",
  controller: "Backend/controllers/portalController.js",
  dashboard: "Backend/controllers/portalDashboardController.js",
  view: "Backend/services/portalCompletionView.js",
  permissionsCatalog: "Backend/config/permissions.js",
  packageJson: "Backend/package.json",
  gateMjs: "tools/gate.mjs",
  gatePs1: "tools/gate.ps1",
  portalHtml: "Frontend/src/pages/portal.html",
};

check(
  "۱۳.۱۸ · هفت فایل کلیدی موجود و غیرخالی‌اند",
  [
    "schema",
    "routes",
    "controller",
    "dashboard",
    "view",
    "permissionsCatalog",
    "portalHtml",
  ].every((key) => exists(FILES[key]) && read(FILES[key]).trim().length > 500),
);

const schema = require(path.join(BACKEND, "config/portalSchema.js"));
const catalog = require(path.join(BACKEND, "config/permissions.js"));
// ⭐ بارگذاری این ماژول خودش «سنجش زمان بارگذاری» فیلدهای ممنوع را اجرا می‌کند
const view = require(path.join(BACKEND, "services/portalCompletionView.js"));
const router = require(path.join(BACKEND, "routes/portalRoutes.js"));
const { protect } = require(path.join(BACKEND, "middleware/auth.js"));

const CODE = {
  routes: stripComments(read(FILES.routes)),
  controller: stripComments(read(FILES.controller)),
  dashboard: stripComments(read(FILES.dashboard)),
};

// ============================================================
// ۱) کلیدهای مجوز — یک منبع، همه در کاتالوگ
// ============================================================
const keyValues = Object.values(schema.KEYS);

check(
  "۱۳.۱۸ · اسکیما دقیقاً ۲۶ کلید مجوز دارد",
  keyValues.length === 26,
  String(keyValues.length),
);

check(
  "۱۳.۱۸ · کلیدها یکتا و همه با customer.portal. شروع می‌شوند",
  new Set(keyValues).size === keyValues.length &&
    keyValues.every((key) => key.startsWith("customer.portal.")),
);

check(
  "۱۳.۱۸ · کلید پایه همان customer.portal.view است",
  schema.PORTAL_BASE_KEY === "customer.portal.view" &&
    schema.PORTAL_BASE_KEY === schema.KEYS.VIEW,
  schema.PORTAL_BASE_KEY,
);

const catalogKeys = new Set(catalog.PERMISSION_KEYS);
const missingInCatalog = keyValues.filter((key) => !catalogKeys.has(key));

check(
  "۱۳.۱۸ · همهٔ کلیدهای اسکیما در کاتالوگ مجوز ثبت شده‌اند",
  missingInCatalog.length === 0,
  missingInCatalog.join(", "),
);

check(
  "۱۳.۱۸ · نقش پورتال فقط customer است",
  schema.PORTAL_ROLE === "customer",
  schema.PORTAL_ROLE,
);

// ============================================================
// ۲) پنل‌ها ⇔ portal.html
// ============================================================
const panels = schema.PORTAL_PANELS;
const panelIds = panels.map((panel) => panel.id);
const htmlPanels = [
  ...read(FILES.portalHtml).matchAll(/data-portal-panel="([^"]+)"/g),
].map((match) => match[1]);

check(
  "۱۳.۱۸ · اسکیما ۱۴ پنل دارد",
  panels.length === 14,
  String(panels.length),
);

check(
  "۱۳.۱۸ · شناسهٔ پنل‌ها یکتاست",
  new Set(panelIds).size === panelIds.length,
  panelIds.filter((id, i) => panelIds.indexOf(id) !== i).join(", "),
);

check(
  "۱۳.۱۸ · پنل‌های اسکیما = data-portal-panel در portal.html",
  htmlPanels.length === panels.length &&
    panelIds.every((id) => htmlPanels.includes(id)),
  `html=${htmlPanels.length} schema=${panels.length}`,
);

check(
  "۱۳.۱۸ · هر پنل: مسیر #/، منو، وضعیت و مدل محتوای معتبر",
  panels.every(
    (panel) =>
      typeof panel.route === "string" &&
      panel.route.startsWith("#/") &&
      Array.isArray(panel.menuKeys) &&
      panel.menuKeys.length >= 1 &&
      panel.menuKeys.every((key) => key.startsWith("customer.portal.menu.")) &&
      ["live", "soon"].includes(panel.status) &&
      ["any", "all"].includes(panel.content.mode),
  ),
);

const foreignContentKeys = panels.flatMap((panel) =>
  panel.content.keys.filter((key) => !keyValues.includes(key)),
);

check(
  "۱۳.۱۸ · کلید محتوای هر پنل در KEYS تعریف شده است",
  foreignContentKeys.length === 0,
  foreignContentKeys.join(", "),
);

const duplicateMenuKeys = panels
  .flatMap((panel) => panel.menuKeys)
  .filter((key, index, all) => all.indexOf(key) !== index);

check(
  "۱۳.۱۸ · کلیدهای منو بین پنل‌ها تکرار نشده‌اند",
  duplicateMenuKeys.length === 0,
  duplicateMenuKeys.join(", "),
);

const soonPanels = panels.filter((panel) => panel.status === "soon");

check(
  "۱۳.۱۸ · تنها یک پنل «به‌زودی» است و هیچ کلید محتوایی ندارد",
  soonPanels.length === 1 && soonPanels[0].content.keys.length === 0,
  soonPanels.map((panel) => panel.id).join(", "),
);

const finalReport = schema.panelById("finalReport");

check(
  "۱۳.۱۸ · «گزارش نهایی» هر دو کلید (فهرست + تفصیل) را با هم می‌خواهد",
  Boolean(finalReport) &&
    finalReport.content.mode === "all" &&
    finalReport.content.keys.length === 2 &&
    finalReport.content.keys.includes(schema.KEYS.COMPLETION) &&
    finalReport.content.keys.includes(schema.KEYS.COMPLETION_REPORT),
);

// ============================================================
// ۳) اندپوینت‌ها — ۲۲ خواندن + ۷ نوشتن، بدون کلید ناشناس
// ============================================================
const endpoints = schema.PORTAL_ENDPOINTS;
const endpointIds = endpoints.map((row) => row.id);
const ALLOWED_SCOPES = ["none", "own", "controller", "row"];
const ALLOWED_SOURCES = ["params", "query", "body"];
// «انبار» نتیجهٔ مالکیت در req (همان چیزی که کنترلر می‌خواند)
const ALLOWED_STORES = ["ownedRow", "ownedFlock", "ownedFlockById"];

check(
  "۱۳.۱۸ · اسکیما ۲۹ اندپوینت دارد (۲۲ خواندن + ۷ نوشتن)",
  endpoints.length === 29 &&
    schema.PORTAL_TOTALS.reads === 22 &&
    schema.PORTAL_TOTALS.writes === 7,
  `${endpoints.length} / ${schema.PORTAL_TOTALS.reads}+${schema.PORTAL_TOTALS.writes}`,
);

check(
  "۱۳.۱۸ · شناسهٔ اندپوینت‌ها یکتاست",
  new Set(endpointIds).size === endpointIds.length,
);

check(
  "۱۳.۱۸ · متد/مسیر معتبر و یکتا (بدون مسیر تکراری)",
  endpoints.every(
    (row) =>
      ["get", "post", "patch", "delete"].includes(row.method) &&
      /^\/[A-Za-z0-9\-/:_]*$/.test(row.path),
  ) &&
    new Set(endpoints.map((row) => `${row.method}:${row.path}`)).size ===
      endpoints.length,
);

const unknownKeys = endpoints.flatMap((row) =>
  row.keys.filter((key) => !keyValues.includes(key)),
);

check(
  "۱۳.۱۸ · کلید هر اندپوینت در KEYS تعریف شده است",
  unknownKeys.length === 0,
  unknownKeys.join(", "),
);

check(
  "۱۳.۱۸ · پنل هر اندپوینت یا null است یا پنل موجود",
  endpoints.every((row) => row.panel === null || Boolean(schema.panelById(row.panel))),
);

check(
  "۱۳.۱۸ · scope معتبر است و row ⇔ ownership پر",
  endpoints.every(
    (row) =>
      ALLOWED_SCOPES.includes(row.scope) &&
      (row.scope === "row") === (row.ownership.length > 0),
  ),
);

const MODEL_NAMES = [
  "Flock",
  "ChickPlacement",
  "PortalDocument",
  "PortalRequest",
  "Hall",
  "FlockCompletion",
  "WeeklyManagement",
];

check(
  "۱۳.۱۸ · ردیف‌های مالکیت: مدل/منبع/انبار معتبر و برچسب دارند",
  endpoints.every((row) =>
    row.ownership.every(
      (owned) =>
        MODEL_NAMES.includes(owned.model) &&
        ALLOWED_SOURCES.includes(owned.source) &&
        ALLOWED_STORES.includes(owned.store) &&
        typeof owned.key === "string" &&
        owned.key.length > 0 &&
        typeof owned.label === "string" &&
        owned.label.length > 0,
    ),
  ),
);

check(
  "۱۳.۱۸ · هر نوشتن متد غیر GET دارد و هر GET نوشتن نیست",
  endpoints.every((row) => row.write === (row.method !== "get")),
);

check(
  "۱۳.۱۸ · otp فقط روی مسیرهای شمارهٔ موبایل و همیشه نوشتن است",
  endpoints
    .filter((row) => row.otp)
    .every((row) => row.write && row.path.startsWith("/profile/mobile/")) &&
    endpoints.filter((row) => row.otp).length === 2,
);

check(
  "۱۳.۱۸ · upload فقط روی POST /documents است",
  endpoints.filter((row) => row.upload).length === 1 &&
    endpoints.find((row) => row.upload).path === "/documents",
);

check(
  "۱۳.۱۸ · شمارندهٔ ردیف‌های مالکیت با واقعیت می‌خواند",
  schema.PORTAL_TOTALS.ownedRows ===
    endpoints.reduce((sum, row) => sum + row.ownership.length, 0) &&
    schema.PORTAL_TOTALS.ownedRows === 9,
  String(schema.PORTAL_TOTALS.ownedRows),
);

check(
  "۱۳.۱۸ · پنل‌های بخش‌های /me در اسکیما هستند و کلید محتوا دارند",
  schema.PORTAL_SECTION_PANELS.every((id) => {
    const panel = schema.panelById(id);
    return Boolean(panel) && panel.content.keys.length > 0;
  }) &&
    schema.PORTAL_SECTION_PANELS.length === new Set(schema.PORTAL_SECTION_PANELS).size,
);

check(
  "۱۳.۱۸ · هر قابلیت درون‌تبی به پنل موجود و کلید موجود اشاره می‌کند",
  schema.PORTAL_FEATURES.every(
    (feature) =>
      Boolean(schema.panelById(feature.panel)) && keyValues.includes(feature.extra),
  ) &&
    new Set(schema.PORTAL_FEATURES.map((feature) => feature.key)).size ===
      schema.PORTAL_FEATURES.length,
);

// ============================================================
// ۴) روتر ⇒ واقعاً از اسکیما ساخته شده است (اجرایی)
// ============================================================
const HANDLER_MODULES = {
  portalController: require(path.join(BACKEND, "controllers/portalController.js")),
  portalProfileOtpController: require(
    path.join(BACKEND, "controllers/portalProfileOtpController.js"),
  ),
  portalDashboardController: require(
    path.join(BACKEND, "controllers/portalDashboardController.js"),
  ),
  portalDocumentsController: require(
    path.join(BACKEND, "controllers/portalDocumentsController.js"),
  ),
  portalFarmController: require(
    path.join(BACKEND, "controllers/portalFarmController.js"),
  ),
  portalCompletionController: require(
    path.join(BACKEND, "controllers/portalCompletionController.js"),
  ),
};

const { uploadPortalDocumentSingle } = require(
  path.join(BACKEND, "middleware/upload.js"),
);

const routes = router.stack
  .filter((layer) => layer.route)
  .map((layer) => ({
    method: Object.keys(layer.route.methods)[0],
    path: layer.route.path,
    stack: layer.route.stack.map((entry) => entry.handle),
  }));

check(
  "۱۳.۱۸ · روتر دقیقاً همان ۲۹ مسیر اسکیما را ثبت کرده است",
  routes.length === endpoints.length,
  `${routes.length} vs ${endpoints.length}`,
);

check(
  "۱۳.۱۸ · protect در سطح روتر است (هیچ مسیری بی‌احراز هویت نیست)",
  router.stack[0]?.handle === protect &&
    routes.every((route) => !route.stack.includes(protect)),
);

const chainProblems = [];

endpoints.forEach((endpoint) => {
  const route = routes.find(
    (row) => row.method === endpoint.method && row.path === endpoint.path,
  );

  if (!route) {
    chainProblems.push(`${endpoint.id}: مسیر در روتر نیست`);
    return;
  }

  const handlerModule = HANDLER_MODULES[endpoint.handler.module];
  const handler = handlerModule && handlerModule[endpoint.handler.method];
  const lastHandle = route.stack[route.stack.length - 1];

  if (typeof handler !== "function" || lastHandle !== handler) {
    chainProblems.push(`${endpoint.id}: کنترلر ناهم‌خوان`);
  }

  const expectedLength =
    1 + // authorize("customer")
    1 + // requirePermission(BASE)
    1 + // requireCustomerLink (پروندهٔ مشتری)
    endpoint.keys.length +
    (endpoint.scope === "own" ? 1 : 0) +
    (endpoint.write ? 1 : 0) +
    endpoint.ownership.length +
    (endpoint.otp ? 1 : 0) +
    (endpoint.upload ? 2 : 0) +
    1; // کنترلر

  if (route.stack.length !== expectedLength) {
    chainProblems.push(
      `${endpoint.id}: طول زنجیره ${route.stack.length} ≠ ${expectedLength}`,
    );
    return;
  }

  // ۱) authorize("customer") با همان نقش اسکیما
  const roles = route.stack[0]?.__roles;
  if (!Array.isArray(roles) || roles.length !== 1 || roles[0] !== schema.PORTAL_ROLE) {
    chainProblems.push(`${endpoint.id}: نقش مجاز ≠ ${schema.PORTAL_ROLE}`);
  }

  // ۲) کلید پایه، سپس کلیدهای اندپوینت به همان ترتیب
  const guardKeys = route.stack.flatMap((entry) => entry.__permissionKeys || []);
  const expectedKeys = [schema.PORTAL_BASE_KEY, ...endpoint.keys];

  if (guardKeys.join("|") !== expectedKeys.join("|")) {
    chainProblems.push(
      `${endpoint.id}: کلیدها ${guardKeys.join(",")} ≠ ${expectedKeys.join(",")}`,
    );
  }

  // ۳) نوشتن ⇒ سقف نرخ، و «پیش از» مالکیت ردیف
  const limiterAt = route.stack.findIndex(
    (entry) => entry.__rateLimiter === "portalWriteLimiter",
  );
  if (endpoint.write && limiterAt === -1) {
    chainProblems.push(`${endpoint.id}: بدون portalWriteLimiter`);
  }

  const ownedRows = route.stack
    .map((entry, index) => ({ owned: entry.__ownedRow, index }))
    .filter((row) => row.owned);

  if (ownedRows.length !== endpoint.ownership.length) {
    chainProblems.push(
      `${endpoint.id}: ${ownedRows.length} requireOwnedRow ≠ ${endpoint.ownership.length}`,
    );
  }

  ownedRows.forEach((row, index) => {
    const expected = endpoint.ownership[index];
    if (
      !expected ||
      row.owned.model !== expected.model ||
      row.owned.source !== expected.source ||
      row.owned.key !== expected.key ||
      row.owned.store !== expected.store
    ) {
      chainProblems.push(`${endpoint.id}: مالکیت ردیف ${index + 1} ناهم‌خوان`);
    }
    if (limiterAt !== -1 && row.index < limiterAt) {
      chainProblems.push(`${endpoint.id}: سقف نرخ پس از مالکیت ردیف آمد`);
    }
  });

  // ۴) مسیر :id بدون مالکیت ردیف ممنوع (مگر کنترلر خودش با customer_id بسنجد)
  if (route.path.includes(":id") && endpoint.scope !== "controller" && ownedRows.length === 0) {
    chainProblems.push(`${endpoint.id}: :id بدون requireOwnedRow`);
  }

  // ۵) otp و سهمیهٔ آپلود سر جایشان
  const otpAt = route.stack.findIndex((entry) => entry.__rateLimiter === "otpLimiter");
  if (endpoint.otp && otpAt === -1) chainProblems.push(`${endpoint.id}: بدون otpLimiter`);

  if (endpoint.upload) {
    const quotaAt = route.stack.indexOf(
      HANDLER_MODULES.portalDocumentsController.ensureDocumentQuota,
    );
    const uploadAt = route.stack.indexOf(uploadPortalDocumentSingle);

    if (quotaAt === -1 || uploadAt === -1 || quotaAt > uploadAt) {
      chainProblems.push(`${endpoint.id}: سهمیه/مولتر ناهم‌خوان`);
    }
  }
});

check(
  "۱۳.۱۸ · زنجیرهٔ هر مسیر مو‌به‌مو از اسکیما ساخته شده است",
  chainProblems.length === 0,
  chainProblems.slice(0, 4).join(" | "),
);

check(
  "۱۳.۱۸ · هیچ کلید مجوز دستی در فایل‌های پورتال تایپ نشده است",
  !/"customer\.portal\./.test(CODE.routes) &&
    !/"customer\.portal\./.test(CODE.controller) &&
    !/"customer\.portal\./.test(CODE.dashboard),
);

check(
  "۱۳.۱۸ · روتر تنها از chainFor می‌سازد (هیچ کلید دستی، هر مسیر یک chainFor)",
  (CODE.routes.match(/requirePermission\(/g) || []).length === 2 &&
    (CODE.routes.match(/requireOwnedRow\(/g) || []).length === 1 &&
    (CODE.routes.match(/\.\.\.chainFor\("/g) || []).length === endpoints.length,
  String((CODE.routes.match(/\.\.\.chainFor\("/g) || []).length),
);

// ============================================================
// ۵) فیلدهای «هرگز» + فهرست سفید
// ============================================================
const CRITICAL_FORBIDDEN = [
  "price_per_kg",
  "net_profit",
  "notes",
  "completed_by",
  "customer_id",
];

check(
  "۱۳.۱۸ · فیلدهای «هرگز» از اسکیما می‌آیند (نه نسخهٔ دوم در سرویس)",
  Array.isArray(view.FORBIDDEN_KEYS) &&
    view.FORBIDDEN_KEYS.length === schema.FORBIDDEN_FIELDS.length &&
    view.FORBIDDEN_KEYS.every((key) => schema.FORBIDDEN_FIELDS.includes(key)),
);

check(
  "۱۳.۱۸ · پنج فیلد حیاتی (اقتصاد/یادداشت/کارشناس/مشتری) در فهرست ممنوع‌اند",
  CRITICAL_FORBIDDEN.every((key) => schema.FORBIDDEN_FIELDS.includes(key)),
  CRITICAL_FORBIDDEN.filter((key) => !schema.FORBIDDEN_FIELDS.includes(key)).join(", "),
);

const WHITELISTS = {
  DB_ATTRIBUTES: view.DB_ATTRIBUTES,
  HALL_DB_ATTRIBUTES: view.HALL_DB_ATTRIBUTES,
  WEEK_ATTRIBUTES: view.WEEK_ATTRIBUTES,
};

const leakedWhitelist = Object.entries(WHITELISTS).flatMap(([name, list]) =>
  list
    .filter((key) => schema.FORBIDDEN_FIELDS.includes(key))
    .map((key) => `${name}.${key}`),
);

check(
  "۱۳.۱۸ · هیچ فیلد ممنوعی در فهرست سفید view نیست",
  leakedWhitelist.length === 0,
  leakedWhitelist.join(", "),
);

const modelColumns = schema.WHITELIST_MODELS.map((row) => {
  const model = require(path.join(BACKEND, `models/${row.name}.js`));
  return {
    name: row.name,
    declared: row.columns,
    actual: Object.keys(model.rawAttributes).length,
    whitelist: WHITELISTS[row.whitelist].length,
  };
});

check(
  "۱۳.۱۸ · شمارندهٔ ستون‌های مدل‌های پورتال با DB یکی است (تغییر ستون ⇒ FAIL)",
  modelColumns.every((row) => row.declared === row.actual),
  modelColumns.map((row) => `${row.name}:${row.actual}`).join(" "),
);

check(
  "۱۳.۱۸ · فهرست سفید از ستون‌ها بزرگ‌تر نیست",
  modelColumns.every((row) => row.whitelist <= row.actual),
  modelColumns.map((row) => `${row.name}:${row.whitelist}/${row.actual}`).join(" "),
);

// ============================================================
// ۶) قرارداد /me — sections و features از اسکیما (اجرایی)
// ============================================================
check(
  "۱۳.۱۸ · کنترلر /me از PORTAL_SECTION_PANELS/PORTAL_FEATURES/panelOpen می‌سازد",
  CODE.controller.includes("PORTAL_SECTION_PANELS") &&
    CODE.controller.includes("PORTAL_FEATURES") &&
    /sections\[panelId\] = panelOpen\(panelId, has\)/.test(CODE.controller) &&
    /features\[feature\.key\] =/.test(CODE.controller),
);

check(
  "۱۳.۱۸ · دیگر هیچ پرچم دستی (canHalls/canProfile/canDashboard) در کنترلر نیست",
  !/\bcan(Halls|Flocks|Weeks|Visits|Profile|Dashboard|Farm|Completion)/.test(
    CODE.controller,
  ),
);

const hasOf = (...granted) => (key) => granted.includes(key);

check(
  "۱۳.۱۸ · panelOpen: حالت any با یک کلید باز می‌شود",
  schema.panelOpen("halls", hasOf()) === false &&
    schema.panelOpen("halls", hasOf(schema.KEYS.HALLS)) === true,
);

check(
  "۱۳.۱۸ · panelOpen: حالت all فقط با همهٔ کلیدها باز می‌شود",
  schema.panelOpen("finalReport", hasOf(schema.KEYS.COMPLETION)) === false &&
    schema.panelOpen(
      "finalReport",
      hasOf(schema.KEYS.COMPLETION, schema.KEYS.COMPLETION_REPORT),
    ) === true,
);

check(
  "۱۳.۱۸ · هر پنل بخش‌های /me با کلید محتوایش باز/بسته می‌شود",
  schema.PORTAL_SECTION_PANELS.every((id) => {
    const keys = schema.panelById(id).content.keys;
    return (
      schema.panelOpen(id, hasOf()) === false &&
      schema.panelOpen(id, hasOf(...keys)) === true
    );
  }),
);

check(
  "۱۳.۱۸ · قابلیت = پنل باز + کلید افزون (نمونه: ویرایش پروفایل)",
  ["profile"].every((panelId) => {
    const feature = schema.PORTAL_FEATURES.find((row) => row.key === "can_edit_profile");
    const keys = schema.panelById(panelId).content.keys;
    const compute = (has) =>
      keys.every((key) => has(key)) && has(feature.extra);
    return (
      compute(hasOf(...keys)) === false &&
      compute(hasOf(...keys, feature.extra)) === true &&
      schema.panelOpen(panelId, hasOf(...keys)) === true
    );
  }),
);

// ============================================================
// ۷) ثبت در npm و دروازه
// ============================================================
const backendPkg = JSON.parse(read(FILES.packageJson) || "{}");

check(
  "۱۳.۱۸ · اسکریپت test:portal-schema در Backend/package.json ثبت شده است",
  backendPkg.scripts?.["test:portal-schema"] === "node portal-schema-test.mjs",
  String(backendPkg.scripts?.["test:portal-schema"]),
);

check(
  "۱۳.۱۸ · دروازهٔ کیفیت (gate.mjs و gate.ps1) این گارد را اجرا می‌کند",
  read(FILES.gateMjs).includes("'test:portal-schema'") &&
    read(FILES.gatePs1).includes("'test:portal-schema'"),
);

check(
  "۱۳.۱۸ · گارد فرانت (portal-schema-guard-test) هم ثبت شده است",
  read(FILES.gateMjs).includes("'test:portal-schema-guard'") &&
    read(FILES.gatePs1).includes("'test:portal-schema-guard'") &&
    (JSON.parse(read("Frontend/package.json") || "{}").scripts || {})[
      "test:portal-schema-guard"
    ] === "node portal-schema-guard-test.mjs",
);

// ============================================================
// جمع‌بندی
// ============================================================
const passed = results.filter(Boolean).length;
const failed = results.length - passed;

console.log("");
console.log("============================================================");
console.log(`  اسکیمای مشترک پورتال — ${passed}/${results.length} بررسی`);
console.log(`  پنل: ${panels.length} · اندپوینت: ${endpoints.length} · کلید: ${keyValues.length}`);
console.log("============================================================");

if (failed > 0) {
  console.error(`❌ ${failed} بررسی ناموفق`);
  process.exit(1);
}

console.log("✅ همهٔ بررسی‌های اسکیمای مشترک پورتال موفق بود");
process.exit(0);
