// ============================================================
//  گارد «هم‌ترازی پورتال با اسکیمای مشترک» — موج ۱۳.۱۸
// ------------------------------------------------------------
//  پیش از این موج، یک واقعیت (پنل ↔ کلید منو ↔ کلید محتوا ↔ مسیر HTTP)
//  در چهار جا دستی تایپ می‌شد و هیچ‌کدام دیگری را نمی‌دید. این گارد
//  هر چهار طرف را کنار هم می‌گذارد و «اجرا» می‌سنجد:
//
//   ۱) portal.menu.js  (درخت منو)      ⇔ PORTAL_PANELS / menuKeys / content
//   ۲) api.const.js    (مسیرها)        ⇔ PORTAL_ENDPOINTS.path
//   ۳) portal.views.js (requires/All)  ⇔ پنل: mode + keys
//   ۴) features.* در مرورگر            ⇔ PORTAL_FEATURES
//      (✅ ۱۳.۲۰: صفر استثنا — هر قابلیت سرور باید در UI خوانده شود)
//   ۵) charts.* در رندرکننده           ⇔ PORTAL_CHARTS
//   ۶) فیلدهای «هرگز»                  ⇔ هیچ‌جای UI پورتال
//
//  ریشهٔ خطر: پنلی که در منو باز است ولی سرور ۴۰۳ می‌دهد (یا برعکس)،
//  یا دکمه‌ای که با کلید بسته‌شده هم دیده می‌شود — هر دو «ناهم‌ترازی»
//  هستند و از این پس FAIL می‌دهند.
//
//  اجرا:  npm run test:portal-schema-guard   (در پوشهٔ Frontend)
//  ⭐ بخش‌های ۱ و ۴ و ۵ منطق واقعی را اجرا می‌کنند (بدون مرورگر/DB).
// ============================================================
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import {
  PORTAL_MENUS,
  PORTAL_ROUTES,
  PORTAL_ROUTE_LIST,
  PORTAL_MENU_PANELS,
} from "./src/features/portal/portal.menu.js";

const require = createRequire(import.meta.url);
const here = import.meta.dirname;
const ROOT = path.join(here, "..");

const results = [];
const check = (name, ok, extra = "") => {
  results.push(Boolean(ok));
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
// ۰) فایل‌ها و اسکیمای مشترک (بدون DB — فقط دادهٔ ثابت)
// ============================================================
const FILES = {
  schema: "Backend/config/portalSchema.js",
  catalog: "Backend/config/permissions.js",
  menu: "Frontend/src/features/portal/portal.menu.js",
  views: "Frontend/src/features/portal/portal.views.js",
  api: "Frontend/src/core/constants/api.const.js",
  renderer: "Frontend/src/features/portal/portal.renderer.js",
  payload: "Frontend/src/features/portal/portal.payload.js",
  documents: "Frontend/src/features/portal/portal.documents.js",
  extra: "Frontend/src/features/portal/portal.extra.js",
  farm: "Frontend/src/features/portal/portal.farm.js",
  packageJson: "Frontend/package.json",
  gateMjs: "tools/gate.mjs",
  gatePs1: "tools/gate.ps1",
};

check(
  "۱۳.۱۸ · فایل‌های پایه (اسکیما/منو/نما/API/رندر) موجود و غیرخالی‌اند",
  ["schema", "menu", "views", "api", "renderer"].every(
    (key) => exists(FILES[key]) && read(FILES[key]).trim().length > 500,
  ),
);

const schema = require(path.join(ROOT, FILES.schema));
const catalog = require(path.join(ROOT, FILES.catalog));

const panelIds = schema.PORTAL_PANELS.map((panel) => panel.id);
const allKeys = Object.values(schema.KEYS);

// ============================================================
// ۱) درخت منو ⇔ پنل‌ها و کلیدها (اجرایی: مدل واقعی import شد)
// ============================================================
const routePanels = [...new Set(PORTAL_ROUTE_LIST.map((route) => PORTAL_ROUTES[route].panel))];
const menuPanels = [...PORTAL_MENU_PANELS];

check(
  "۱۳.۱۸ · درخت منو ۷ منو و ۲۸ مسیر دارد",
  PORTAL_MENUS.length === 7 && PORTAL_ROUTE_LIST.length === 28,
  `menus=${PORTAL_MENUS.length} routes=${PORTAL_ROUTE_LIST.length}`,
);

check(
  "۱۳.۱۸ · هر مسیر منو به یک پنل موجود در اسکیما می‌رود",
  routePanels.every((panel) => panelIds.includes(panel)),
  routePanels.filter((panel) => !panelIds.includes(panel)).join(", "),
);

check(
  "۱۳.۱۸ · پنل‌های منو دقیقاً همان ۱۴ پنل اسکیما هستند",
  routePanels.length === panelIds.length &&
    panelIds.every((panel) => routePanels.includes(panel)) &&
    menuPanels.length === 14,
  `menu=${menuPanels.length} schema=${panelIds.length}`,
);

const contentKeyProblems = [];

PORTAL_ROUTE_LIST.forEach((route) => {
  const row = PORTAL_ROUTES[route];
  const panel = schema.panelById(row.panel);

  if (!panel) {
    contentKeyProblems.push(`${route}: پنل ناشناس`);
    return;
  }

  if (panel.content.keys.length === 0) {
    if (row.contentKey !== "") {
      contentKeyProblems.push(`${route}: کلید محتوا برای پنل بدون کلید`);
    }
    return;
  }

  if (!panel.content.keys.includes(row.contentKey)) {
    contentKeyProblems.push(`${route}: ${row.contentKey}`);
  }
});

check(
  "۱۳.۱۸ · کلید محتوای هر مسیر همان کلید محتوای پنل در اسکیما است",
  contentKeyProblems.length === 0,
  contentKeyProblems.slice(0, 4).join(" | "),
);

const menuKeyProblems = [];
const rowByMenuKey = new Map(
  PORTAL_ROUTE_LIST.map((route) => [PORTAL_ROUTES[route].key, PORTAL_ROUTES[route]]),
);

schema.PORTAL_PANELS.forEach((panel) => {
  panel.menuKeys.forEach((menuKey) => {
    const row = rowByMenuKey.get(menuKey);
    if (!row) {
      menuKeyProblems.push(`${panel.id}: ${menuKey} در منو نیست`);
      return;
    }
    if (row.panel !== panel.id) {
      menuKeyProblems.push(`${panel.id}: ${menuKey} به پنل ${row.panel} می‌رود`);
    }
  });
});

check(
  "۱۳.۱۸ · هر کلید منوی اسکیما واقعاً به همان پنل می‌رسد",
  menuKeyProblems.length === 0,
  menuKeyProblems.slice(0, 4).join(" | "),
);

check(
  "۱۳.۱۸ · همهٔ کلیدهای منو با customer.portal.menu. شروع می‌شوند",
  PORTAL_ROUTE_LIST.every((route) =>
    PORTAL_ROUTES[route].key.startsWith("customer.portal.menu."),
  ),
);

const soonRoute = PORTAL_ROUTES["#/hatchery/hygiene"];

check(
  "۱۳.۱۸ · تنها مسیر «به‌زودی» کلید محتوا ندارد و پنل soon هم بی‌کلید است",
  Boolean(soonRoute) &&
    soonRoute.contentKey === "" &&
    schema.panelById("soon").content.keys.length === 0 &&
    schema.PORTAL_PANELS.filter((panel) => panel.status === "soon").length === 1,
);

check(
  "۱۳.۱۸ · «گزارش نهایی» در منو کلید گزارش تفصیلی را حمل می‌کند",
  PORTAL_ROUTES["#/reports/final"].contentKey === schema.KEYS.COMPLETION_REPORT,
);

// ============================================================
// ۲) api.const.js ⇔ مسیرهای اسکیما
// ============================================================
const apiSrc = read(FILES.api);
const apiStart = apiSrc.indexOf("PORTAL: {");
const apiEnd = apiSrc.indexOf("PORTAL_REQUESTS: {");
const apiBlock = apiSrc.slice(apiStart, apiEnd);

const normalizePath = (value) =>
  String(value)
    .replace(/\$\{[^}]*\}/g, ":id")
    .replace(/:[A-Za-z0-9_]+/g, ":id")
    .replace(/\s+/g, "");

const apiPaths = [...apiBlock.matchAll(/\/portal\/[^"'`\r\n]*/g)]
  .map((match) => normalizePath(match[0]))
  .filter(Boolean);

const schemaPaths = schema.PORTAL_ENDPOINTS.map((row) => normalizePath(`/portal${row.path}`));

check(
  "۱۳.۱۸ · بلوک PORTAL در api.const پیدا شد (پیش‌شرط بقیهٔ بررسی‌ها)",
  apiStart !== -1 && apiEnd > apiStart && apiPaths.length >= 20,
  `api=${apiPaths.length}`,
);

check(
  "۱۳.۱۸ · هر مسیر فرانت در اندپوینت‌های اسکیما وجود دارد",
  apiPaths.every((route) => schemaPaths.includes(route)),
  apiPaths.filter((route) => !schemaPaths.includes(route)).join(", "),
);

check(
  "۱۳.۱۸ · هر مسیر یکتای اسکیما در api.const هست (بدون اندپوینت یتیم)",
  [...new Set(schemaPaths)].every((route) => apiPaths.includes(route)),
  [...new Set(schemaPaths)].filter((route) => !apiPaths.includes(route)).join(", "),
);

check(
  "۱۳.۱۸ · تعداد اندپوینت‌های فرانت = تعداد مسیرهای یکتای اسکیما (۲۶)",
  apiPaths.length === 26 && new Set(schemaPaths).size === 26,
  `api=${apiPaths.length} schemaUnique=${new Set(schemaPaths).size}`,
);

// ============================================================
// ۳) portal.views.js (VIEW_TABS) ⇔ پنل‌های اسکیما
// ============================================================
const viewsSrc = read(FILES.views).replace(/\r\n/g, "\n");
const tabsStart = viewsSrc.indexOf("export const VIEW_TABS = {");
const tabsBody = viewsSrc.slice(tabsStart, viewsSrc.indexOf("\n};", tabsStart) + 1);

const tabs = {};
const tabEntry = /\n  (\w+): \{\n([\s\S]*?)\n  \},/g;

for (const match of tabsBody.matchAll(tabEntry)) {
  const body = match[2];
  const requires = /requires: "([^"]*)"/.exec(body);
  const requiresAll = /requiresAll: \[([\s\S]*?)\]/.exec(body);
  const permission = /permission: "([^"]*)"/.exec(body);

  tabs[match[1]] = {
    requires: requires ? requires[1] : "",
    requiresAll: requiresAll
      ? [...requiresAll[1].matchAll(/"([^"]+)"/g)].map((row) => row[1])
      : [],
    permission: permission ? permission[1] : "",
  };
}

check(
  "۱۳.۱۸ · VIEW_TABS شش پنل را می‌شناسد (units/hallDetail/placements/soon/completion/finalReport)",
  Object.keys(tabs).length === 6 && tabs.finalReport && tabs.completion,
  Object.keys(tabs).join(","),
);

check(
  "۱۳.۱۸ · هر VIEW_TABS به پنلی در اسکیما اشاره می‌کند",
  Object.keys(tabs).every((key) => panelIds.includes(key)),
  Object.keys(tabs).filter((key) => !panelIds.includes(key)).join(", "),
);

const viewLayerProblems = [];

Object.entries(tabs).forEach(([key, tab]) => {
  const panel = schema.panelById(key);
  if (!panel) {
    viewLayerProblems.push(`${key}: پنل ناشناس`);
    return;
  }

  if (panel.content.mode === "all") {
    const same =
      tab.requiresAll.length === panel.content.keys.length &&
      panel.content.keys.every((contentKey) => tab.requiresAll.includes(contentKey));
    if (!same) viewLayerProblems.push(`${key}: requiresAll ≠ content.keys`);
    return;
  }

  if (panel.content.keys.length === 0) {
    if (tab.requires !== "" || tab.requiresAll.length) {
      viewLayerProblems.push(`${key}: پنل بی‌کلید ولی requires دارد`);
    }
    return;
  }

  if (!panel.content.keys.includes(tab.requires)) {
    viewLayerProblems.push(`${key}: requires=${tab.requires}`);
  }
});

check(
  "۱۳.۱۸ · لایهٔ محتوای هر VIEW_TABS با mode/keys اسکیما یکی است",
  viewLayerProblems.length === 0,
  viewLayerProblems.slice(0, 4).join(" | "),
);

check(
  "۱۳.۱۸ · کلید منوی هر VIEW_TABS = اولین menuKey پنل در اسکیما",
  Object.entries(tabs).every(
    ([key, tab]) => schema.panelById(key).menuKeys[0] === tab.permission,
  ),
);

check(
  "۱۳.۱۸ · canViewContent همان قرارداد دو کلیدی را اجرا می‌کند",
  /canViewContent\(conf\)/.test(viewsSrc) &&
    /Array\.isArray\(conf\.requiresAll\)/.test(viewsSrc) &&
    /requiresAll\.every\(/.test(viewsSrc),
);

// ============================================================
// ۴) features.* در مرورگر ⇔ PORTAL_FEATURES
// ============================================================
const declaredFeatures = schema.PORTAL_FEATURES.map((feature) => feature.key);
const portalDir = path.join(ROOT, "Frontend/src/features/portal");
const portalFiles = fs
  .readdirSync(portalDir)
  .filter((name) => name.endsWith(".js"))
  .map((name) => path.join(portalDir, name));

const featureReads = new Set();
portalFiles.forEach((file) => {
  const source = stripComments(fs.readFileSync(file, "utf8"));
  for (const match of source.matchAll(/features\.([a-z_]+)/g)) {
    featureReads.add(match[1]);
  }
});

check(
  "۱۳.۱۸ · هر features.*ی که مرورگر می‌خواند در اسکیما اعلام شده است",
  [...featureReads].every((name) => declaredFeatures.includes(name)),
  [...featureReads].filter((name) => !declaredFeatures.includes(name)).join(", "),
);

// ✅ موج ۱۳.۲۰ — فهرست استثنای «فقط-سرور» حذف شد. در ۱۳.۱۸ دو پرچم
//    (`dashboard_analysis` و `completion_report`) صرفاً «مستند» بودند؛
//    اکنون هر دو گیت واقعی UI هستند، پس گارد سخت‌گیرانه است: هر قابلیتی
//    که سرور اعلام می‌کند باید در مرورگر هم خوانده شود.
check(
  "۱۳.۲۰ · هر قابلیت اعلام‌شده در سرور، در مرورگر هم خوانده می‌شود (صفر استثنا)",
  declaredFeatures.every((name) => featureReads.has(name)),
  declaredFeatures.filter((name) => !featureReads.has(name)).join(", "),
);

// ------------------------------------------------------------
// ۴.۱) دو گیت تازهٔ ۱۳.۲۰ — «سرور اول، کلاینت fallback»
// ------------------------------------------------------------
const extraClean = stripComments(read(FILES.extra));
const viewsClean = stripComments(read(FILES.views));
const ANALYSIS_CALL = 'getDashboardAnalysis({ scope: "all" })';
const analysisGateAt = extraClean.indexOf("this.canOpenDashboardAnalysis()");
const analysisCallAt = extraClean.indexOf(ANALYSIS_CALL);

check(
  "۱۳.۲۰ · درخواست /dashboard/analysis داخل گیت features.dashboard_analysis است",
  // (۱) helper سرور-اول وجود دارد
  /canOpenDashboardAnalysis\(\) \{/.test(extraClean) &&
    /if \(features && typeof features\.dashboard_analysis === "boolean"\)/.test(
      extraClean,
    ) &&
    // (۲) همان helper در شرط بلوک استاندارد نژاد است (همراه با پرچم نمودار)
    /if \(\s*standardsBox &&\s*allowed\.standards !== false &&\s*this\.canOpenDashboardAnalysis\(\),?\s*\)/.test(
      extraClean,
    ) &&
    // (۳) و فراخوانی اندپوینت *بعد* از گیت می‌آید (نه قبلش)
    analysisGateAt > -1 &&
    analysisCallAt > analysisGateAt,
  `gate=${analysisGateAt} call=${analysisCallAt}`,
);

const reportGateStart = viewsClean.indexOf("completionCanReport() {");
const reportGate = viewsClean.slice(
  reportGateStart,
  viewsClean.indexOf("},", reportGateStart),
);

check(
  "۱۳.۲۰ · دکمهٔ «گزارش نهایی» اول از features.completion_report می‌پرسد",
  reportGateStart > -1 &&
    /typeof features\.completion_report === "boolean"/.test(reportGate) &&
    reportGate.indexOf("features.completion_report") > -1 &&
    reportGate.indexOf("features.completion_report") <
      reportGate.indexOf('canPermission("customer.portal.completion.report")'),
);

check(
  "۱۳.۱۸ · کلید افزون هر قابلیت در کاتالوگ مجوز موجود است",
  schema.PORTAL_FEATURES.every((feature) =>
    catalog.PERMISSION_KEYS.includes(feature.extra),
  ),
);

// ============================================================
// ۵) charts.* در رندرکننده ⇔ PORTAL_CHARTS
// ============================================================
const rendererCode = stripComments(read(FILES.renderer));
const chartReads = new Set(
  [...rendererCode.matchAll(/charts\.([a-z_]+)/g)].map((match) => match[1]),
);
const schemaCharts = schema.PORTAL_CHARTS.map((chart) => chart.key);

check(
  "۱۳.۱۸ · رندرکننده هیچ پرچم نمودارِ ناشناسی نمی‌خواند",
  chartReads.size === 6 && [...chartReads].every((name) => schemaCharts.includes(name)),
  [...chartReads].join(","),
);

check(
  "۱۳.۱۸ · کلید مجوز هر نمودار در کاتالوگ مجوز موجود است",
  schema.PORTAL_CHARTS.every((chart) =>
    catalog.PERMISSION_KEYS.includes(chart.permission),
  ),
);

check(
  "۱۳.۱۸ · هر شش نمودار اسکیما در رابط کاربری هم رندر می‌شوند",
  schemaCharts.every((name) => chartReads.has(name)),
  schemaCharts.filter((name) => !chartReads.has(name)).join(", "),
);

// ============================================================
// ۶) فیلدهای «هرگز» در هیچ فایل UI پورتال نمی‌آیند
// ------------------------------------------------------------
//  ⚠️ «notes» عمداً بیرون گذاشته شده: یادداشتِ خودِ مشتری روی
//     «درخواست فارم» یک فیلد مشروع است و با یادداشت داخلی هفته
//     (که در FORBIDDEN_FIELDS است) هم‌نام شده است. بقیهٔ فیلدها
//     هیچ معنای مشروعی در UI پورتال ندارند.
// ============================================================
const UI_FORBIDDEN = schema.FORBIDDEN_FIELDS.filter((field) => field !== "notes");
const forbiddenInUi = [];

portalFiles.forEach((file) => {
  const source = stripComments(fs.readFileSync(file, "utf8"));
  UI_FORBIDDEN.forEach((field) => {
    if (new RegExp(`\\b${field}\\b`).test(source)) {
      forbiddenInUi.push(`${path.basename(file)}:${field}`);
    }
  });
});

check(
  "۱۳.۱۸ · هیچ فیلد «هرگز» (اقتصاد/یادداشت/کارشناس/مشتری) در UI پورتال نیست",
  forbiddenInUi.length === 0,
  forbiddenInUi.slice(0, 4).join(" | "),
);

check(
  "۱۳.۱۸ · همهٔ کلیدهای اسکیما در کاتالوگ مجوز ثبت شده‌اند",
  allKeys.every((key) => catalog.PERMISSION_KEYS.includes(key)),
  allKeys.filter((key) => !catalog.PERMISSION_KEYS.includes(key)).join(", "),
);

// ============================================================
// ۷) ثبت در npm و دروازهٔ کیفیت
// ============================================================
const pkg = JSON.parse(read(FILES.packageJson) || "{}");

check(
  "۱۳.۱۸ · اسکریپت‌های test:portal-schema(-guard) در Frontend ثبت شده‌اند",
  pkg.scripts?.["test:portal-schema"] === "node ../Backend/portal-schema-test.mjs" &&
    pkg.scripts?.["test:portal-schema-guard"] === "node portal-schema-guard-test.mjs",
);

check(
  "۱۳.۱۸ · دروازهٔ کیفیت هر دو گارد را اجرا می‌کند (gate.mjs و gate.ps1)",
  ["gateMjs", "gatePs1"].every(
    (key) =>
      read(FILES[key]).includes("'test:portal-schema'") &&
      read(FILES[key]).includes("'test:portal-schema-guard'"),
  ),
);

// ============================================================
// جمع‌بندی
// ============================================================
const passed = results.filter(Boolean).length;

console.log("");
console.log("============================================================");
console.log(`  هم‌ترازی پورتال با اسکیما — ${passed}/${results.length} بررسی`);
console.log(`  مسیر منو: ${PORTAL_ROUTE_LIST.length} · اندپوینت: ${schema.PORTAL_ENDPOINTS.length}`);
console.log("============================================================");

if (passed !== results.length) {
  console.error(`❌ ${results.length - passed} بررسی ناموفق`);
  process.exit(1);
}

console.log("✅ پورتال (منو/نما/API/قابلیت‌ها) با اسکیمای مشترک هم‌تراز است");
process.exit(0);
