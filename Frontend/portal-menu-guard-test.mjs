// ============================================================
//  گارد «ناوبری پورتال مشتری» — موج ۱۳.۱۷
// ------------------------------------------------------------
//  ریشهٔ خطری که این گارد از بازگشتش جلوگیری می‌کند:
//   ۱) اگر مسیر از URL «آزاد» خوانده شود (مثلاً #/farm/units/۱۲۳)،
//      همان الگوی IDOR برمی‌گردد: شناسهٔ ردیف از آدرس مرورگر.
//      ⇒ مدل مسیر فقط «فهرست سفید» است و حداکثر دو بخش دارد.
//   ۲) اگر درخت منو در HTML و JS جدا تایپ شود، لینکی می‌ماند که
//      پنلی برای باز کردن ندارد (صفحهٔ خالی) یا پنلی می‌ماند که
//      هیچ لینکی به آن نمی‌رسد. ⇒ دو طرف باید یکی باشند.
//   ۳) اگر «دیده‌شدن منو» به کلید محتوا گره نخورد، مشتری لینکی
//      می‌بیند که با کلیک، ۴۰۳ سرور می‌گیرد. ⇒ هر آیتم دو لایه
//      کلید دارد: منو (customer.portal.menu.*) + محتوا.
//   ۴) اگر کاربری صفحه را قبل از دیپلوی باز کرده باشد، کلیدهای
//      منو را در کش ندارد ⇒ «منوی خالی». ⇒ menuFallbackMode.
//   ۵) اگر نماهای تازه POST/PATCH/DELETE داشتند، «فقط خواندنی»
//      بودن پورتال می‌شکست. ⇒ فقط سه GET مجاز است.
//
//  اجرا:  npm run test:portal-menu      (در پوشهٔ Frontend)
//  ⭐ بخش‌های ۱، ۲ و ۴ منطق واقعی را **اجرا** می‌کنند (بدون دیتابیس).
// ============================================================
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import {
  PORTAL_MENUS,
  PORTAL_ROUTES,
  PORTAL_ROUTE_LIST,
  PORTAL_MENU_PANELS,
  DEFAULT_PORTAL_ROUTE,
  normalizeHash,
  parseHash,
  resolveRoute,
  routeTitle,
  firstAllowedRoute,
  firstAllowedOfMenu,
  menuById,
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
// ۰) فایل‌های این موج
// ============================================================
const FILES = {
  menu: "Frontend/src/features/portal/portal.menu.js",
  views: "Frontend/src/features/portal/portal.views.js",
  shell: "Frontend/src/features/portal/portal.shell.js",
  navCss: "Frontend/src/features/portal/portal.nav.css",
  portalCss: "Frontend/src/features/portal/portal.css",
  html: "Frontend/src/pages/portal.html",
  service: "Frontend/src/features/portal/portal.service.js",
  payload: "Frontend/src/features/portal/portal.payload.js",
  permissions: "Backend/config/permissions.js",
  permissionsTest: "Backend/permissions-test.mjs",
  packageJson: "Frontend/package.json",
  gateMjs: "tools/gate.mjs",
  gatePs1: "tools/gate.ps1",
  review: "docs/REVIEW-WAVE-13.17.md",
  readmeFront: "Frontend/README.md",
};

const SRC = {
  menu: read(FILES.menu),
  views: read(FILES.views),
  shell: read(FILES.shell),
  navCss: read(FILES.navCss),
  html: read(FILES.html),
  service: read(FILES.service),
  permissionsTest: read(FILES.permissionsTest),
};
const CODE = {
  menu: stripComments(SRC.menu),
  views: stripComments(SRC.views),
  shell: stripComments(SRC.shell),
  service: stripComments(SRC.service),
};

check(
  "۱۳.۱۷ · سه فایل پوسته (menu/views/shell) موجود و غیرخالی‌اند",
  [FILES.menu, FILES.views, FILES.shell].every(
    (file) => exists(file) && read(file).trim().length > 400,
  ),
);

check(
  "۱۳.۱۷ · استایل ناوبری در فایل جدا است (portal.css رشد نکرد)",
  exists(FILES.navCss) &&
    SRC.navCss.length > 1500 &&
    !/\.portal-nav__panel/.test(read(FILES.portalCss)),
  `nav.css=${SRC.navCss.length}B`,
);

check(
  "۱۳.۱۷ · portal.html استایل ناوبری را لینک می‌کند",
  /<link[^>]+href="\/features\/portal\/portal\.nav\.css"/.test(SRC.html),
);

check(
  "۱۳.۱۷ · CSS ناوبری کلاس‌های پایه و drawer موبایل را دارد",
  /\.portal-shell\b/.test(SRC.navCss) &&
    /\.portal-nav__panel\b/.test(SRC.navCss) &&
    /\.portal-nav__backdrop\b/.test(SRC.navCss) &&
    /@media[^{]*max-width/.test(SRC.navCss),
);

// اگر گارد در gate اجرا شود باید اسکریپت npm هم ثبت شده باشد
const pkg = (() => {
  try {
    return JSON.parse(read(FILES.packageJson));
  } catch {
    return {};
  }
})();

check(
  "۱۳.۱۷ · اسکریپت npm و gate این گارد را می‌شناسند",
  pkg?.scripts?.["test:portal-menu"] === "node portal-menu-guard-test.mjs" &&
    /test:portal-menu/.test(read(FILES.gateMjs)) &&
    /test:portal-menu/.test(read(FILES.gatePs1)),
);

// ============================================================
// ۱) مدل منو: شمارش و قرارداد کلیدها  (اجرای واقعی)
// ============================================================
const subCount = PORTAL_MENUS.reduce((sum, menu) => sum + (menu.items || []).length, 0);

check(
  "۱۳.۱۷ · درخت منو: ۷ منو + ۱۴ زیرمنو = ۲۱ مسیر",
  // ✅ ۱۳.۲۱ — «درخواست‌های من» و «ثبت هفته» و چهار مسیر بخش سالن حذف شدند
  PORTAL_MENUS.length === 7 && subCount === 14 && PORTAL_ROUTE_LIST.length === 21,
  `menus=${PORTAL_MENUS.length} subs=${subCount} routes=${PORTAL_ROUTE_LIST.length}`,
);

check(
  "۱۳.۲۱ · ۱۳ پنل یکتا در مدل تعریف شده است",
  PORTAL_MENU_PANELS.length === 13 &&
    [
      "completion",
      "dashboard",
      "documents",
      "finalReport",
      "flocks",
      "halls",
      "placements",
      "profile",
      "soon",
      "tickets",
      "units",
      "visits",
      "weeks",
    ].every((panel) => PORTAL_MENU_PANELS.includes(panel)),
  `panels=${PORTAL_MENU_PANELS.join(",")}`,
);

check(
  "۱۳.۱۷ · هر مسیر پنل و برچسب دارد و کلید منو در فضای customer.portal.menu است",
  PORTAL_ROUTE_LIST.every((route) => {
    const entry = PORTAL_ROUTES[route];
    return (
      entry.panel &&
      entry.label &&
      /^customer\.portal\.menu\./.test(entry.key) &&
      entry.route === route
    );
  }),
);

check(
  "۱۳.۱۷ · ۲۱ کلید منو یکتاست (هیچ دو آیتمی کلید مشترک ندارند)",
  new Set(PORTAL_ROUTE_LIST.map((route) => PORTAL_ROUTES[route].key)).size === 21,
);

check(
  "۱۳.۱۷ · لایهٔ محتوا فقط برای بخش «به‌زودی» خالی است (بستهٔ صادق)",
  // ✅ ۱۳.۱۹: «پایان دوره» و «گزارش نهایی» کلید محتوا گرفتند ⇒ فقط ۱ soon
  PORTAL_ROUTE_LIST.every((route) => {
    const entry = PORTAL_ROUTES[route];
    if (entry.contentKey) return true;
    return entry.panel === "soon";
  }) &&
    PORTAL_ROUTE_LIST.filter((route) => !PORTAL_ROUTES[route].contentKey).length === 1,
);

check(
  "۱۳.۱۷ · هر لایهٔ محتوای اعلام‌شده، کلید واقعی پورتال است",
  [
    "customer.portal.farm",
    "customer.portal.halls",
    "customer.portal.flocks",
    "customer.portal.weeks",
    "customer.portal.visits",
    "customer.portal.profile",
    "customer.portal.documents",
    "customer.portal.dashboard",
    // ✅ ۱۳.۱۹
    "customer.portal.completion",
    "customer.portal.completion.report",
  ].every((key) =>
    PORTAL_ROUTE_LIST.some((route) => PORTAL_ROUTES[route].contentKey === key),
  ),
);

check(
  "۱۳.۲۱ · پنج منو alias دارند و منوی ریشه‌شان پنل مستقل ندارد",
  // ⚠️ ۱۳.۲۱: «درخواست‌های من» حذف شد و «ارسال تیکت» پنل مستقل دارد
  PORTAL_MENUS.filter((menu) => menu.alias).map((menu) => menu.id).join(",") ===
    "profile,farm,hatchery,weekly,reports" &&
    PORTAL_MENUS.find((menu) => menu.id === "dashboard").alias === false &&
    PORTAL_MENUS.find((menu) => menu.id === "tickets").alias === false,
);

check(
  "۱۳.۱۷ · زیرمنوها همیشه زیر ریشهٔ همان منو می‌نشینند",
  PORTAL_MENUS.every((menu) =>
    (menu.items || []).every((item) => item.route.startsWith(`#/${menu.id}/`)),
  ) && PORTAL_MENUS.every((menu) => new Set((menu.items || []).map((i) => i.id)).size === (menu.items || []).length),
);

check(
  "۱۳.۱۷ · default = #/dashboard و عنوان صفحه از مدل می‌آید",
  DEFAULT_PORTAL_ROUTE === "#/dashboard" && routeTitle(DEFAULT_PORTAL_ROUTE) === "داشبورد",
);

// ============================================================
// ۲) مسیر: نرمال‌سازی، فهرست سفید، ضد IDOR  (اجرای واقعی)
// ============================================================
check(
  "۱۳.۱۷ · normalizeHash فاصله/بزرگی حرف/اسلش تکراری را یکسان می‌کند",
  normalizeHash("  FARM/Units/  ") === "#/farm/units" &&
    normalizeHash("#//farm//halls//") === "#/farm/halls",
);

check(
  "۱۳.۱۷ · مسیرهای معتبر پذیرفته می‌شوند (با # و بدون #)",
  parseHash("#/farm/units") === "#/farm/units" &&
    parseHash("farm/units") === "#/farm/units" &&
    parseHash("#/farm") === "#/farm",
);

check(
  "۱۳.۱۷ · مسیر سه‌بخشی (شناسهٔ ردیف در URL) رد می‌شود — ضد IDOR",
  parseHash("#/farm/units/12") === null &&
    parseHash("#/farm/units/12/edit") === null,
);

check(
  "۱۳.۱۷ · مسیر ناشناخته و پارامتر اضافی رد می‌شوند",
  parseHash("#/nope") === null &&
    parseHash("#/farm/units?customer_id=5") === null &&
    parseHash("#/farm&x=1") === null,
);

check(
  "۱۳.۱۷ · URL خالی/ناشناخته ⇒ مسیر پیش‌فرض",
  resolveRoute("", null) === "#/dashboard" && resolveRoute("#/x/y", null) === "#/dashboard",
);

check(
  "۱۳.۱۷ · ریشهٔ alias به اولین زیرمنوی مجاز می‌رود (صفحهٔ خالی هرگز)",
  resolveRoute("#/farm", null) === "#/farm/units" &&
    resolveRoute("#/profile", null) === "#/profile/me" &&
    resolveRoute("#/reports", null) === "#/reports/visits",
);

check(
  "۱۳.۲۱ · مسیر مجاز دست‌نخورده می‌ماند و لینک قدیمی هدایت می‌شود",
  resolveRoute("#/farm/halls", null) === "#/farm/halls" &&
    // ✅ ۱۳.۲۱: «درخواست‌های من» حذف شد ⇒ مسیر قدیمی به واحدها می‌رود
    resolveRoute("#/requests/list", null) === "#/farm/units" &&
    resolveRoute("#/farm/physical", null) === "#/farm/halls" &&
    resolveRoute("#/weekly/new", null) === "#/weekly/list",
);

const denyFarm = (entry) => entry.contentKey !== "customer.portal.farm";

check(
  "۱۳.۱۷ · بستن لایهٔ محتوا، آیتم‌های وابسته را از دسترس خارج می‌کند",
  resolveRoute("#/farm/units", denyFarm) === "#/farm/halls" &&
    resolveRoute("#/farm", denyFarm) === "#/farm/halls",
);

check(
  "۱۳.۱۷ · اولین مسیر مجازِ کل پورتال با allowed سفارشی درست است",
  firstAllowedRoute(denyFarm) === "#/dashboard/charts" &&
    firstAllowedOfMenu("farm", denyFarm) === "#/farm/halls" &&
    firstAllowedRoute() === "#/dashboard/charts",
);

check(
  "۱۳.۱۷ · اگر هیچ مسیری مجاز نباشد، رشتهٔ خالی برمی‌گردد (پوسته پیام بسته می‌دهد)",
  resolveRoute("", () => false) === "" && resolveRoute("#/farm", () => false) === "",
);

check(
  "۱۳.۲۱ · menuById فقط منوهای واقعی را برمی‌گرداند",
  // ✅ ۱۳.۲۱: «واحدهای من» دو زیرمنو دارد (واحدها/سالن‌ها) و منوی
  //  «درخواست‌های من» دیگر وجود ندارد.
  menuById("farm")?.items.length === 2 &&
    menuById("tickets")?.panel === "tickets" &&
    menuById("requests") === null &&
    menuById("nah") === null,
);

// ============================================================
// ۳) هم‌خوانی HTML ↔ مدل (پنل/لینک/ورودی اسکریپت‌ها)
// ============================================================
const htmlLinks = [...SRC.html.matchAll(/<a\b[^>]*data-portal-route="([^"]+)"[^>]*>/g)].map(
  (match) => ({
    route: match[1],
    tab: (match[0].match(/data-portal-tab="([^"]+)"/) || [])[1] || "",
    href: (match[0].match(/href="([^"]+)"/) || [])[1] || "",
  }),
);
const htmlLinkRoutes = htmlLinks.map((link) => link.route).sort();
const modelRoutes = [...PORTAL_ROUTE_LIST].sort();

check(
  "۱۳.۲۱ · HTML دقیقاً همان ۲۱ مسیر مدل را لینک کرده است",
  htmlLinks.length === 21 &&
    htmlLinkRoutes.length === modelRoutes.length &&
    htmlLinkRoutes.every((route, index) => route === modelRoutes[index]),
  `html=${htmlLinks.length}`,
);

check(
  "۱۳.۱۷ · هر لینک ناوبری tab/pannel درست دارد (کلیک ⇒ پنل موجود)",
  htmlLinks.every((link) => {
    const entry = PORTAL_ROUTES[link.route];
    return Boolean(entry) && entry.panel === link.tab && link.href === link.route;
  }),
);

const htmlPanels = Array.from(
  new Set([...SRC.html.matchAll(/data-portal-panel="([^"]+)"/g)].map((m) => m[1])),
).sort();

check(
  "۱۳.۱۷ · پنل‌های HTML و مدل یکی‌اند (هیچ پنل یتیمی نمی‌ماند)",
  htmlPanels.length === PORTAL_MENU_PANELS.length &&
    htmlPanels.every((panel, index) => panel === PORTAL_MENU_PANELS[index]),
  `html=${htmlPanels.join(",")}`,
);

const htmlMenuIds = [...SRC.html.matchAll(/data-portal-menu="([^"]+)"/g)].map((m) => m[1]);

check(
  "۱۳.۱۷ · هر ۷ منو در HTML یک بلوک data-portal-menu دارد",
  htmlMenuIds.length === 7 &&
    PORTAL_MENUS.every((menu) => htmlMenuIds.includes(menu.id)),
);

check(
  "۱۳.۱۷ · هر زیرمنوی مدل در HTML موجود است (و برعکس)",
  PORTAL_MENUS.every((menu) =>
    (menu.items || []).every((item) => htmlLinks.some((link) => link.route === item.route)),
  ),
);

check(
  "۱۳.۱۷ · اسکلت ناوبری (nav/toggle/panel/backdrop/current/list) کامل است",
  [
    'id="portalNav"',
    'id="portalNavToggle"',
    'id="portalNavPanel"',
    'id="portalNavBackdrop"',
    'id="portalNavCurrent"',
    'id="portalTabs"',
    'id="portalMain"',
  ].every((token) => SRC.html.includes(token)),
);

check(
  "۱۳.۱۷ · پوسته در حالت اولیه پنهان است (hidden) و toggle وضعیت ARIA دارد",
  /<nav[^>]+id="portalNav"[^>]*hidden/.test(SRC.html) &&
    /id="portalNavToggle"[^>]*aria-expanded="false"/.test(SRC.html),
);

const idxMenu = SRC.html.indexOf("portal.menu.js");
const idxViews = SRC.html.indexOf("portal.views.js");
const idxShell = SRC.html.indexOf("portal.shell.js");
const idxService = SRC.html.indexOf("portal.service.js");

check(
  "۱۳.۱۷ · ترتیب بارگذاری اسکریپت‌ها: menu < views < shell < service",
  idxMenu > 0 && idxMenu < idxViews && idxViews < idxShell && idxShell < idxService,
);

check(
  "۱۳.۲۱ · هر پنل تازه بدنهٔ رندر دارد (units/halls/placements/tickets/completion/finalReport/soon)",
  [
    'id="portalUnitsBody"',
    'id="portalHallsBody"',
    'id="portalPlacementsBody"',
    'id="portalTicketsBody"',
    'id="portalCompletionBody"',
    'id="portalFinalBody"',
    'id="portalSoonBody"',
  ].every((token) => SRC.html.includes(token)),
);

// ============================================================
// ۴) نماها: فقط سه GET، بدون نوشتن، رندر واقعی
// ============================================================
check(
  "۱۳.۱۷ · نماها هیچ POST/PATCH/PUT/DELETE ندارند (فقط خواندنی)",
  !/\bmethod:\s*["'](POST|PATCH|PUT|DELETE)["']/i.test(CODE.views) &&
    !/\.(create|update|delete|remove)\w*\s*\(/i.test(CODE.views.replace(/render\w+/g, "")),
);

check(
  "۱۳.۱۷ · نماها fetch خام ندارند — فقط از portalApi",
  !/\bfetch\s*\(/.test(CODE.views) && !/\bXMLHttpRequest\b/.test(CODE.views),
);

const viewCalls = [...CODE.views.matchAll(/portalApi\.(\w+)/g)].map((m) => m[1]);
// ✅ ۱۳.۱۹: هر متد ممکن است چند بار صدا زده شود ⇒ یکتاها سنجیده می‌شوند
const viewCallNames = [...new Set(viewCalls)].sort();

check(
  "۱۳.۱۷ · فقط GETهای مجاز صدا زده می‌شود (options/hall/placement/completion)",
  // ✅ ۱۳.۱۹: دو GET تازهٔ «پایان دوره» — همچنان فقط خواندنی
  viewCallNames.join(",") ===
    [
      "getCompletionReport",
      "getCompletions",
      "getFarmHallDetails",
      "getFarmOptions",
      "getFarmPlacementDetails",
    ].join(","),
  `calls=${viewCallNames.join(",")}`,
);

check(
  "۱۳.۲۱ · شناسهٔ سالن/دوره فقط از پاسخ GET می‌آید (نه از URL)",
  // ✅ ۱۳.۲۱: کش سالن‌ها state.halls است و شناسه با فهرست سرور سنجیده می‌شود
  /state\.halls/.test(CODE.views) &&
    /state\.placements\.find/.test(CODE.views) &&
    !/parseHash|location\.hash|URLSearchParams/.test(CODE.views),
);

check(
  "۱۳.۱۷ · برچسب فیلدها از portal.payload.js می‌آید (بدون فهرست دوم)",
  /PAYLOAD_LABEL/.test(CODE.views) &&
    /farmSpecOf/.test(CODE.views) &&
    /dictionaryNameOf/.test(CODE.views),
);

let views = null;
let shell = null;
let service = null;
try {
  // شبیه‌ساز حداقلی مرورگر — همان الگوی تست‌های موجود پروژه
  globalThis.window = {
    location: { hash: "#/farm/units" },
    addEventListener() {},
    removeEventListener() {},
    setTimeout: (fn) => {
      if (typeof fn === "function") fn();
      return 0;
    },
    history: { replaceState() {} },
    localStorage: { getItem: () => null, setItem: () => {} },
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    navigator: { userAgent: "node-guard" },
  };
  globalThis.document = {
    addEventListener() {},
    getElementById: () => null,
    querySelectorAll: () => [],
    querySelector: () => null,
    body: { classList: { add() {}, remove() {}, toggle() {} } },
    title: "",
  };

  views = await import("./src/features/portal/portal.views.js");
  shell = await import("./src/features/portal/portal.shell.js");
  service = await import("./src/features/portal/portal.service.js");
} catch (error) {
  console.log(`WARN - بارگذاری ماژول‌ها اجرا نشد: ${error?.message || error}`);
}

check(
  "۱۳.۲۱ · پنل‌های تازه در رجیستری VIEW_TABS ثبت شده‌اند (هفت پنل)",
  Boolean(views) &&
    Object.keys(views.VIEW_TABS).sort().join(",") ===
      "completion,finalReport,halls,placements,soon,tickets,units" &&
    Object.values(views.VIEW_TABS).every(
      (conf) => conf.permission?.startsWith("customer.portal.menu.") && conf.bodyId,
    ) &&
    !("hallDetail" in views.VIEW_TABS),
);

check(
  "۱۳.۱۷ · هر بخش جزئیات سالن فیلدهایش را از مشخصات فرم می‌گیرد",
  Boolean(views) &&
    Object.keys(views.HALL_SECTION_TYPES).join(",") === "physical,system,water_feed,hygiene" &&
    Object.values(views.HALL_SECTION_TYPES).every((type) => /^hall_.+_save$/.test(type)) &&
    Object.keys(views.HALL_SECTION_TYPES).every(
      (section) => views.hallSectionKeys(section).length > 0,
    ) &&
    views.hallSectionKeys("physical").slice(0, 4).join(",") === "length,width,height,area",
);

check(
  "۱۳.۱۹ · یک بخش «به‌زودی» با متن صادقانه مانده است (بدون دادهٔ ساختگی)",
  Boolean(views) &&
    Object.keys(views.SOON_VIEWS).sort().join(",") === "#/hatchery/hygiene" &&
    Object.values(views.SOON_VIEWS).every((view) => view.title && view.lead && view.text),
);

check(
  "۱۳.۲۱ · فهرست خالی واحدها ⇒ پیام (نه ردیف جعلی) و ردیف واقعی ⇒ آکاردئون",
  Boolean(views) &&
    views.renderUnitsView([]).includes("portal-notice") &&
    views.renderUnitsView(
      [{ id: 1, unit_name: "واحد یک", hall_count: 2, capacity: 1000, is_active: true }],
      { canWrite: true },
    ).includes('data-acc-id="unit-1"'),
);

check(
  "۱۳.۲۱ · آکاردئون سالن: هر سالن یک <details> با چهار بخش گیت‌شده",
  Boolean(views) &&
    (() => {
      const html = views.renderHallsAccordion({
        halls: [{ id: 7, hall_name: "سالن الف" }],
        details: {
          7: {
            details: {
              physical: { length: 100, width: 12, floor_type_id: 2 },
              system: null,
              water_feed: null,
              hygiene: null,
            },
          },
        },
        sections: ["physical", "system", "water_feed", "hygiene"],
        dictionaries: { floor_types: [{ id: 2, name: "بتن" }] },
      });
      return (
        html.includes('data-acc-id="hall-7"') &&
        html.includes('data-acc-id="hall-7-physical"') &&
        html.includes('data-view-section="physical"') &&
        html.includes("بتن")
      );
    })(),
);

check(
  "۱۳.۲۱ · دادهٔ سالن escape می‌شود (بدون HTML تزریقی)",
  Boolean(views) &&
    (() => {
      const html = views.renderHallsAccordion({
        halls: [{ id: 1, hall_name: "<img src=x onerror=alert(1)>" }],
        details: { 1: { details: { physical: { notes: "<script>alert(1)</script>" } } } },
        sections: ["physical"],
        dictionaries: {},
      });
      return !/<script>/.test(html) && !/<img src=x/.test(html) && html.includes("&lt;");
    })(),
);

check(
  "۱۳.۱۷ · دوره‌ها: دکمهٔ جزئیات + جدول هفته‌ها",
  Boolean(views) &&
    (() => {
      const html = views.renderPlacementsView({
        placements: [{ id: 3, placement_date: "2026-01-01", total_chicks_count: 10000 }],
        detail: {
          placement: { id: 3, placement_date: "2026-01-01", total_chicks_count: 10000 },
          weeklies: [{ week_number: 1, weekly_weight: 180 }],
        },
        dictionaries: {},
      });
      return (
        html.includes('data-view-placement="3"') && html.includes("data-view-placement-weeks")
      );
    })(),
);

check(
  "۱۳.۱۹ · پایان دوره: فهرست خالی ⇒ پیام، ردیف واقعی ⇒ کارت KPI با برچسب سرور",
  Boolean(views) &&
    views.renderCompletionView({ items: [] }).includes("portal-notice") &&
    (() => {
      const html = views.renderCompletionView({
        items: [
          {
            id: 9,
            completion_date: "2026-03-01",
            completion_type_label: "پایان عادی",
            confirmed_by_customer: true,
            final_fcr: 1.9,
            survival_percent: 95,
          },
        ],
        metrics: [
          { key: "final_fcr", label: "ضریب تبدیل نهایی", kind: "decimal", digits: 2 },
          { key: "survival_percent", label: "درصد زنده‌مانی", unit: "٪", kind: "decimal", digits: 2 },
        ],
        canReport: true,
      });
      return (
        html.includes('data-view-completion="9"') &&
        html.includes('data-view-completion-report="9"') &&
        html.includes("ضریب تبدیل نهایی") &&
        html.includes("1.9")
      );
    })(),
);

check(
  "۱۳.۱۹ · گزارش نهایی: بدون دوره ⇒ پیام؛ با گزارش ⇒ سالن/مقایسه/دارو/روند",
  Boolean(views) &&
    views.renderFinalReportView({ items: [] }).includes("portal-notice") &&
    (() => {
      const html = views.renderFinalReportView({
        items: [{ id: 4, completion_date: "2026-03-01", completion_type_label: "پایان عادی" }],
        metrics: [
          { key: "final_fcr", label: "ضریب تبدیل نهایی", kind: "decimal", digits: 2 },
        ],
        hallMetrics: [
          { key: "final_avg_weight", label: "وزن نهایی", unit: "کیلوگرم", kind: "decimal", digits: 3 },
        ],
        report: {
          completion: {
            id: 4,
            completion_date: "2026-03-01",
            completion_type_label: "پایان عادی",
            flock_id: 7,
            feed_basis: "system",
          },
          totals: {
            fcr: 1.48,
            survivalRate: 95,
            mortalityRate: 5,
            totalFeed: 87000,
            lastWeight: 2.067,
            initialChicks: 30000,
            finalChicks: 28500,
            ageDays: 42,
          },
          stored: {
            final_fcr: 1.9,
            survival_percent: 95,
            mortality_rate: 5,
            total_feed_intake: 87000,
            final_avg_weight: 2.067,
          },
          weekly: { weeks_count: 3 },
          halls: [{ hall_id: 11, hall_name: "سالن الف", final_avg_weight: 2.05 }],
          trend: { weeks: [1, 2, 3], weight: [1.2, 1.7, 2.0], fcr: [1.6, 1.5, 1.48] },
          medicines: [{ name: "ویتامین", count: 2 }],
          vaccines: [],
          notices: ["هشدار نمونه"],
          meta: {},
        },
      });
      return (
        html.includes('data-view-final-report="4"') &&
        html.includes("data-view-report-halls") &&
        html.includes("data-view-report-compare") &&
        html.includes("data-view-trend") &&
        html.includes("ویتامین") &&
        html.includes("هشدار نمونه")
      );
    })(),
);

check(
  "۱۳.۱۹ · نمودار روند با کمتر از دو هفته رسم نمی‌شود (بدون دادهٔ جعلی)",
  Boolean(views) &&
    views.renderTrendChart({ weeks: [1], weight: [1.2], fcr: [1.5] }) === "" &&
    views.renderTrendChart(null) === "",
);

check(
  "۱۳.۱۹ · پنل «گزارش نهایی» دو کلید محتوا لازم دارد (فهرست + تفصیل)",
  Boolean(views) &&
    views.VIEW_TABS.finalReport.requiresAll.join(",") ===
      "customer.portal.completion,customer.portal.completion.report" &&
    views.VIEW_TABS.completion.requires === "customer.portal.completion",
);

check(
  "۱۳.۱۷ · پنل «به‌زودی» هیچ درخواستی نمی‌فرستد",
  Boolean(views) &&
    (() => {
      const code = stripComments(SRC.views);
      const start = code.indexOf("export const renderSoonView");
      if (start < 0) return false;
      const rest = code.slice(start + 1);
      const nextExport = rest.indexOf("\nexport ");
      const body = nextExport > 0 ? rest.slice(0, nextExport) : rest;
      return body.includes("data-view-soon") && !/portalApi\./.test(body) && !/fetch\s*\(/.test(body);
    })(),
);

// ============================================================
// ۵) پوسته: دو لایه مجوز، fallback، drawer، hashchange
// ============================================================
check(
  "۱۳.۱۷ · پوسته هیچ درخواست/نوشتنی ندارد (فقط ناوبری)",
  !/portalApi\.|fetch\s*\(|localStorage/.test(CODE.shell),
);

check(
  "۱۳.۱۷ · menuAllowed سه لایه را به همین ترتیب می‌سنجد: contentKey → panel → key",
  (() => {
    const start = CODE.shell.indexOf("menuAllowed(entry)");
    const end = CODE.shell.indexOf("applyMenuVisibility()");
    const body = start >= 0 && end > start ? CODE.shell.slice(start, end) : "";
    const indexContent = body.indexOf("entry.contentKey && !this.canPermissionToken");
    const indexPanel = body.indexOf("this.canSee(entry.panel)");
    const indexKey = body.indexOf("service.can(entry.key)");
    return indexContent > 0 && indexContent < indexPanel && indexPanel < indexKey;
  })(),
);

check(
  "۱۳.۱۷ · حالت fallback (کش قدیمی مجوزها) وجود دارد و منو را خالی نمی‌کند",
  /menuFallbackMode\s*\(/.test(CODE.shell) &&
    /return this\.menuFallbackMode\(\)/.test(CODE.shell),
);

check(
  "۱۳.۱۷ · پوسته hashchange و Escape و backdrop را مدیریت می‌کند",
  /addEventListener\("hashchange"/.test(CODE.shell) &&
    /"Escape"/.test(CODE.shell) &&
    /portalNavBackdrop/.test(CODE.shell),
);

check(
  "۱۳.۱۷ · goToRoute مسیر را با replaceState/hash عوض می‌کند و مسیر ناشناخته را می‌پذیرد",
  /window\.location\.hash\s*=\s*target/.test(CODE.shell) &&
    /parseHash\(route\)\s*\|\|\s*DEFAULT_PORTAL_ROUTE/.test(CODE.shell),
);

check(
  "۱۳.۱۷ · activateRoute پس از resolve، پنل را فعال و ناوبری را sync می‌کند",
  /resolveRoute\(rawRoute,\s*\(entry\)\s*=>\s*this\.menuAllowed\(entry\)\)/.test(CODE.shell) &&
    /this\.activateTab\(entry\.panel\)/.test(CODE.shell) &&
    /this\.syncNav\(resolved\)/.test(CODE.shell),
);

check(
  "۱۳.۱۷ · syncNav از aria-current استفاده می‌کند (دسترس‌پذیری)",
  /setAttribute\("aria-current",\s*"page"\)/.test(CODE.shell),
);

check(
  "۱۳.۱۷ · کلیک روی لینک ناوبری preventDefault می‌شود (بدون ورودی تاریخچهٔ تکراری)",
  /list\.addEventListener\("click"[\s\S]{0,400}?preventDefault\(\)/.test(CODE.shell),
);

const fakeShell = () => {
  const self = {
    state: "ready",
    _tab: "",
    canSee: () => true,
    canPermission: () => true,
    el: () => null,
    all: () => [],
    activateTab(key) {
      self._tab = key;
    },
    applyRouteView() {},
    syncNav() {},
    closeNav() {},
    scrollToRoute() {},
  };
  return Object.assign(self, shell ? shell.portalShellMixin : {});
};

check(
  "۱۳.۱۷ · menuAllowed: کلید محتوای بسته ⇒ آیتم پنهان (حتی اگر منو باز باشد)",
  Boolean(shell) &&
    (() => {
      const fake = fakeShell();
      fake.canPermission = (key) => key !== "customer.portal.farm";
      return fake.menuAllowed(PORTAL_ROUTES["#/farm/units"]) === false;
    })(),
);

check(
  "۱۳.۱۷ · menuAllowed: پنل بسته (canSee=false) ⇒ آیتم پنهان",
  Boolean(shell) &&
    (() => {
      const fake = fakeShell();
      fake.canSee = () => false;
      return fake.menuAllowed(PORTAL_ROUTES["#/farm/units"]) === false;
    })(),
);

check(
  "۱۳.۱۷ · menuAllowed: بدون permissionService ⇒ fail-open (منو خالی نمی‌شود)",
  Boolean(shell) &&
    (() => {
      const fake = fakeShell();
      return (
        fake.menuAllowed(PORTAL_ROUTES["#/farm/units"]) === true &&
        fake.menuAllowed(null) === false
      );
    })(),
);

check(
  "۱۳.۱۷ · activateRoute: مسیر مجاز، پنل درست را فعال می‌کند",
  Boolean(shell) &&
    (() => {
      const fake = fakeShell();
      const resolved = fake.activateRoute("#/farm/units");
      return resolved === "#/farm/units" && fake._tab === "units";
    })(),
);

check(
  "۱۳.۱۷ · activateRoute: ریشهٔ alias ⇒ زیرمنو، و مسیر سه‌بخشی ⇒ پیش‌فرض",
  Boolean(shell) &&
    (() => {
      const fake = fakeShell();
      const alias = fake.activateRoute("#/farm");
      const deep = fake.activateRoute("#/farm/units/12");
      return alias === "#/farm/units" && deep === "#/dashboard";
    })(),
);

check(
  "۱۳.۱۷ · activateRoute در حالت «بدون پروندهٔ متصل» هیچ کاری نمی‌کند",
  Boolean(shell) &&
    (() => {
      const fake = fakeShell();
      fake.state = "unlinked";
      return fake.activateRoute("#/farm/units") === "" && fake._tab === "";
    })(),
);

// ============================================================
// ۶) سیم‌کشی سرویس (mixin ها و ترتیب بارگذاری)
// ============================================================
check(
  "۱۳.۲۱ · سرویس، VIEW_TABS/تیکت و پوسته را import و ثبت می‌کند",
  /import\s*\{[\s\S]{0,200}?VIEW_TABS,[\s\S]{0,120}?applyPortalViews,[\s\S]{0,120}?\}\s*from\s*"\.\/portal\.views\.js"/.test(
    SRC.service,
  ) &&
    /import\s*\{\s*applyPortalTickets\s*\}\s*from\s*"\.\/portal\.tickets\.js"/.test(
      SRC.service,
    ) &&
    /import\s*\{\s*applyPortalShell\s*\}/.test(SRC.service) &&
    /Object\.assign\(EXTRA_TABS,[^)]*VIEW_TABS\)/.test(SRC.service) &&
    /applyPortalTickets\(PortalService\)/.test(SRC.service),
);

check(
  "۱۳.۱۷ · parseHash از مدل منو (یک منبع) خوانده می‌شود",
  /import\s*\{\s*parseHash\s*\}\s*from\s*"\.\/portal\.menu\.js"/.test(SRC.service),
);

check(
  "۱۳.۱۷ · ترتیب mixin: views سپس shell، و هر دو پیش از ساخت نمونه",
  (() => {
    const idxViews = SRC.service.indexOf("applyPortalViews(PortalService)");
    const idxShell = SRC.service.indexOf("applyPortalShell(PortalService)");
    const idxNew = SRC.service.indexOf("new PortalService()");
    return idxViews > 0 && idxViews < idxShell && idxShell < idxNew;
  })(),
);

check(
  "۱۳.۱۷ · پس از بارگذاری: ابتدا منو هم‌راستا، بعد مسیر فعال می‌شود",
  (() => {
    const body = CODE.service;
    const idxMenu = body.indexOf("const hasMenu = this.applyMenuVisibility()");
    const idxRoute = body.indexOf("this.activateRoute(parseHash(hash)");
    return idxMenu > 0 && idxMenu < idxRoute && /if \(hasMenu\)/.test(body);
  })(),
);

check(
  "۱۳.۱۷ · تب‌های کلاسیک، لینک‌های ناوبری را ربوده نمی‌گیرند",
  /data-portal-route/.test(CODE.service) &&
    /if \(button\.hasAttribute && button\.hasAttribute\("data-portal-route"\)\)/.test(CODE.service),
);

check(
  "۱۳.۱۷ · پنهان‌سازی پوسته در حالت غیرفعال (setTabsEnabled) انجام می‌شود",
  /setTabsEnabled\(enabled\)[\s\S]{0,600}?portalNav/.test(CODE.service),
);

check(
  "۱۳.۲۱ · نمونهٔ سرویس همهٔ متدهای پوسته و پنل‌های تازه را دارد",
  Boolean(service) &&
    ["initShell", "bindShell", "activateRoute", "goToRoute", "syncNav", "applyMenuVisibility"]
      .every((name) => typeof service.portalService[name] === "function") &&
    [
      "units",
      "halls",
      "placements",
      "completion",
      "finalReport",
      "tickets",
      "soon",
    ].every((key) => key in service.portalService.extra),
);

check(
  "۱۳.۲۱ · canSee برای پنل‌های تازه پاسخ می‌دهد (بدون مجوز = باز، هم‌الگو با ۱۳.۵)",
  Boolean(service) &&
    [
      "units",
      "halls",
      "placements",
      "completion",
      "finalReport",
      "tickets",
      "soon",
    ].every((key) => service.portalService.canSee(key) === true),
);

// ============================================================
// ۷) مجوزها: ۲۱ کلید «لایهٔ منو»
// ============================================================
const catalog = require(path.join(ROOT, "Backend", "config", "permissions.js"));
const menuKeys = PORTAL_ROUTE_LIST.map((route) => PORTAL_ROUTES[route].key);

check(
  "۱۳.۲۱ · کاتالوگ: همهٔ ۲۱ کلید منوی پورتال ثبت شده‌اند",
  menuKeys.length === 21 && menuKeys.every((key) => Boolean(catalog.PERMISSIONS[key])),
);

check(
  "۱۳.۱۷ · کاتالوگ: هر کلید منو در گروه «portal» و پیش‌فرض «فقط مشتری» است",
  menuKeys.every((key) => {
    const entry = catalog.PERMISSIONS[key];
    return (
      entry.group === "portal" &&
      entry.defaults.customer === true &&
      entry.defaults.admin === false &&
      entry.defaults.expert === false &&
      entry.defaults.super_admin === false
    );
  }),
);

check(
  "۱۳.۱۷ · کاتالوگ: هیچ کلید منویی قفل نشده است (مدیر می‌تواند باز/بسته کند)",
  menuKeys.every((key) => catalog.PERMISSIONS[key].lockedTo.length === 0),
);

check(
  "۱۳.۱۷ · کاتالوگ: کلیدهای «لایهٔ محتوا» هم موجودند",
  [
    "customer.portal.farm",
    "customer.portal.halls",
    "customer.portal.flocks",
    "customer.portal.weeks",
    "customer.portal.visits",
    "customer.portal.profile",
    "customer.portal.documents",
    "customer.portal.dashboard",
  ].every((key) => Boolean(catalog.PERMISSIONS[key])),
);

check(
  "۱۳.۲۱ · کاتالوگ: شمارش کلیدها با permissions-test هم‌خوان است (۲۲۵ / ۱۸)",
  // ⚠️ ۱۳.۲۱: چهار کلید منوی حذف‌شده (requests/requests.new/requests.list/
  //  weekly.create) − دو کلید تازه (menu.tickets + tickets) = ۲۲۵
  catalog.TOTAL_PERMISSIONS === 225 &&
    catalog.PERMISSION_GROUPS.length === 18 &&
    /TOTAL_PERMISSIONS === 225 && catalog\.PERMISSION_GROUPS\.length === 18/.test(
      SRC.permissionsTest,
    ),
);

check(
  "۱۳.۲۱ · کاتالوگ: گروه «portal» کلیدهای ۱۳.۱۶ و ۲۱ کلید منو را با هم دارد",
  (() => {
    const portalGroup = catalog.PERMISSION_GROUPS.find((group) => group.key === "portal");
    const keys = portalGroup ? portalGroup.items.map((item) => item.key) : [];
    return (
      menuKeys.every((key) => keys.includes(key)) &&
      keys.includes("portal.requests.view") === false &&
      keys.includes("customer.portal.menu.requests") === false &&
      keys.includes("customer.portal.tickets") &&
      keys.length >= 26
    );
  })(),
);

// ============================================================
// ۸) مستندات
// ============================================================
check(
  "۱۳.۱۷ · مستند موج ۱۳.۱۷ نوشته شده و فایل‌ها را نام می‌برد",
  exists(FILES.review) &&
    /portal\.menu\.js/.test(read(FILES.review)) &&
    /portal\.shell\.js/.test(read(FILES.review)),
);

check(
  "۱۳.۱۷ · README فرانت به موج ۱۳.۱۷ و ناوبری اشاره می‌کند",
  /۱۳\.۱۷/.test(read(FILES.readmeFront)),
);

// ============================================================
//  جمع‌بندی
// ============================================================
const passed = results.filter(Boolean).length;
const failed = results.length - passed;
console.log(`\n${passed}/${results.length} چک پاس شد${failed ? ` — ${failed} خطا` : ""}`);
if (failed) {
  console.log("FAIL - گارد ناوبری پورتال مشتری شکست خورد");
  process.exitCode = 1;
} else {
  console.log("PASS - گارد ناوبری پورتال مشتری (۱۳.۱۷)");
}
