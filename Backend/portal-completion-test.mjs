// ============================================================
//  گارد «پایان دوره» و «گزارش نهایی دوره» — موج ۱۳.۱۹
// ------------------------------------------------------------
//  ریشهٔ خطری که این گارد از بازگشتش جلوگیری می‌کند:
//   ۱) اگر فهرست سفید نباشد، ردیف DB (اقتصاد گله، یادداشت داخلی،
//      کاربر کارشناس) بی‌واسطه به مرورگر مشتری می‌رود.
//   ۲) اگر فرمول دومی برای FCR/تلفات نوشته شود، عدد پورتال با عدد
//      کارشناس یکی نیست ⇒ همه از flockMetrics.
//   ۳) اگر مسیر بدون requireOwnedRow باشد، مشتری با تغییر :id
//      گزارش دورهٔ دیگری را می‌بیند (IDOR).
//   ۴) اگر سرویس کوئری بدون customer_id بزند، اسکوپ از دست می‌رود.
//
//  اجرا:  npm run test:portal-completion      (در پوشهٔ Backend)
//  ⭐ بخش‌های ۲ تا ۶ منطق واقعی را **اجرا** می‌کنند (بدون دیتابیس).
// ============================================================
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

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

const FILES = {
  view: "Backend/services/portalCompletionView.js",
  service: "Backend/services/portalCompletionService.js",
  controller: "Backend/controllers/portalCompletionController.js",
  routes: "Backend/routes/portalRoutes.js",
  portalController: "Backend/controllers/portalController.js",
  permissions: "Backend/config/permissions.js",
  permissionsTest: "Backend/permissions-test.mjs",
  packageJson: "Backend/package.json",
  fePackageJson: "Frontend/package.json",
  metrics: "Backend/services/flockMetrics.js",
  gateMjs: "tools/gate.mjs",
  gatePs1: "tools/gate.ps1",
};

const SRC = {
  view: read(FILES.view),
  service: read(FILES.service),
  controller: read(FILES.controller),
  routes: read(FILES.routes),
  portalController: read(FILES.portalController),
};

const stripComments = (source) =>
  String(source || "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const CODE = {
  view: stripComments(SRC.view),
  service: stripComments(SRC.service),
  controller: stripComments(SRC.controller),
  routes: stripComments(SRC.routes),
};

const view = require(path.join(ROOT, FILES.view));
const catalog = require(path.join(ROOT, FILES.permissions));

// ============================================================
// ۱) فایل‌ها و صادرات
// ============================================================
check(
  "۱۳.۱۹ · سه فایل تازه (view/service/controller) موجود و غیرخالی‌اند",
  ["view", "service", "controller"].every(
    (key) => exists(FILES[key]) && read(FILES[key]).trim().length > 800,
  ),
);

check(
  "۱۳.۱۹ · نمایهٔ view دقیقاً همان قرارداد لازم را صادر می‌کند",
  [
    "COMPLETION_TYPES",
    "METRICS",
    "HALL_METRICS",
    "LIST_KEYS",
    "DETAIL_KEYS",
    "DB_ATTRIBUTES",
    "HALL_DB_ATTRIBUTES",
    "WEEK_ATTRIBUTES",
    "typeLabelOf",
    "completionListRow",
    "completionReportView",
    "summarizeNames",
  ].every((key) => view[key] !== undefined),
);

check(
  "۱۳.۱۹ · view هیچ ستون اقتصادی/یادداشت/کاربر کارشناس را نمی‌خواند",
  !/income_total|net_profit|profit_percent|price_per_kg|chick_cost|feed_cost|medication_cost|fuel_cost|labor_cost|other_cost|total_cost/.test(
    view.DB_ATTRIBUTES.join(","),
  ) &&
    !view.DB_ATTRIBUTES.includes("notes") &&
    !view.DB_ATTRIBUTES.includes("completed_by") &&
    !view.DB_ATTRIBUTES.includes("customer_id"),
  `columns=${view.DB_ATTRIBUTES.length}`,
);

// ============================================================
// ۲) فهرست سفید (اجرای واقعی)
// ============================================================
const listFixture = {
  id: 7,
  flock_id: 3,
  unit_id: 2,
  hall_id: 11,
  customer_id: 99,
  completed_by: 5,
  notes: "یادداشت داخلی کارشناس",
  completion_date: new Date("2026-02-01T00:00:00Z"),
  completion_type: "culled",
  confirmed_by_customer: 1,
  initial_chicks_count: "30000",
  final_chicks_count: 28500,
  slaughter_date: "2026-02-02T00:00:00.000Z",
  slaughter_age_days: "42",
  total_feed_intake: "87000.00",
  final_avg_weight: "2.067",
  total_mortality: 1500,
  mortality_rate: "5.00",
  survival_percent: "95.00",
  final_fcr: "1.90",
  epi: "385.40",
  adg_grams: "49.21",
  total_weight_gain_kg: "57900.00",
  feed_basis: "declared",
  // ⛔ این‌ها باید حذف شوند
  price_per_kg: "78000",
  income_total: "999999999",
  net_profit: "123456789",
  total_cost: "777777",
};

const listRow = view.completionListRow(listFixture);

check(
  "۱۳.۱۹ · فهرست: کلیدهای خروجی دقیقاً همان LIST_KEYS است",
  Object.keys(listRow).sort().join(",") === [...view.LIST_KEYS].sort().join(","),
  `keys=${Object.keys(listRow).length}`,
);

check(
  "۱۳.۱۹ · فهرست: اقتصاد گله و یادداشت داخلی بیرون نمی‌رود",
  [
    "price_per_kg",
    "income_total",
    "net_profit",
    "total_cost",
    "notes",
    "completed_by",
    "customer_id",
  ].every((key) => !(key in listRow)) &&
    !/999999999|123456789|777777/.test(JSON.stringify(listRow)),
);

check(
  "۱۳.۱۹ · فهرست: DECIMALهای رشته‌ای به عدد تبدیل می‌شوند (نه رشته)",
  listRow.total_feed_intake === 87000 &&
    listRow.final_fcr === 1.9 &&
    listRow.mortality_rate === 5 &&
    listRow.survival_percent === 95 &&
    typeof listRow.initial_chicks_count === "number" &&
    listRow.initial_chicks_count === 30000,
  `feed=${typeof listRow.total_feed_intake}`,
);

check(
  "۱۳.۱۹ · فهرست: تاریخ‌ها YYYY-MM-DD و boolean واقعی و برچسب نوع",
  listRow.completion_date === "2026-02-01" &&
    listRow.slaughter_date === "2026-02-02" &&
    listRow.confirmed_by_customer === true &&
    listRow.completion_type_label === "حذف گله" &&
    listRow.feed_basis === "declared",
  `date=${listRow.completion_date}`,
);

check(
  "۱۳.۱۹ · فهرست: مقدار غایب null می‌ماند (۰ ساخته نمی‌شود)",
  (() => {
    const row = view.completionListRow({
      id: 1,
      final_fcr: null,
      total_feed_intake: undefined,
    });
    return row.final_fcr === null && row.total_feed_intake === null;
  })(),
);

// ============================================================
// ۳) گزارش نهایی: تجمیع، روند، دارو/واکسن (اجرای واقعی)
// ============================================================
const hallRows = [
  {
    hall_id: 11,
    chick_placement_id: 101,
    initial_chicks_count: 10000,
    final_chicks_count: 9500,
    total_mortality: 500,
    total_feed_intake: "30000.00",
    final_avg_weight: "2.000",
    slaughter_age_days: 42,
    final_week_number: 6,
    system_fcr: "1.44",
    sent_to_slaughter_count: 9400,
    live_weight_kg: "19000.00",
  },
  {
    hall_id: 12,
    chick_placement_id: 102,
    initial_chicks_count: 20000,
    final_chicks_count: 19000,
    total_mortality: 1000,
    total_feed_intake: "57000.00",
    final_avg_weight: "2.100",
    slaughter_age_days: 42,
    final_week_number: 6,
    system_fcr: "1.50",
    sent_to_slaughter_count: 18800,
    live_weight_kg: "39800.00",
  },
];

const weekFeed = [10000, 19000, 25000];
const weekWeight = [1.2, 1.7, 2.0];
const weekRows = [101, 102].flatMap((placementId) =>
  weekFeed.map((feed, index) => ({
    id: placementId * 10 + index,
    chick_placement_id: placementId,
    week_number: index + 1,
    week_end_date: `2026-01-0${index + 2}`,
    flock_age_days: (index + 1) * 7,
    weekly_feed_intake: feed,
    weekly_weight: weekWeight[index],
    weekly_mortality: 100,
  })),
);

const report = view.completionReportView({
  completion: { ...listFixture, system_fcr: "1.85", system_survival_percent: "95.00" },
  hallRows,
  weekRows,
  hallNameById: { 11: "سالن الف (۱)", 12: "سالن ب (۲)" },
  medicineRows: [{ name: "ویتامین" }, { name: "ویتامین" }, { name: "آنتی‌بیوتیک" }],
  vaccineRows: [{ name: "نیوکاسل" }],
});

check(
  "۱۳.۱۹ · گزارش: تجمیع سالن‌ها با flockMetrics (جمع جمعیت/خوراک/تلفات)",
  report.totals.initialChicks === 30000 &&
    report.totals.finalChicks === 28500 &&
    report.totals.totalMortality === 1500 &&
    report.totals.mortalityRate === 5 &&
    report.totals.survivalRate === 95 &&
    report.totals.totalFeed === 87000 &&
    report.totals.ageDays === 42,
  `feed=${report.totals.totalFeed}`,
);

check(
  "۱۳.۱۹ · گزارش: وزن نهایی میانگین وزنی و FCR از همان موتور (۱.۴۸)",
  report.totals.lastWeight === 2.067 && report.totals.fcr === 1.48,
  `w=${report.totals.lastWeight} fcr=${report.totals.fcr}`,
);

check(
  "۱۳.۱۹ · گزارش: خوراک به‌ازای هر مرغ نهایی و شمارش واقعی هفته‌ها",
  report.totals.feed_per_final_chick === 3.053 &&
    report.totals.weeksCount === 6 &&
    report.weekly.weeks_count === 6,
  `per=${report.totals.feed_per_final_chick}`,
);

check(
  "۱۳.۱۹ · گزارش: «ثبت‌شده» جدا از «محاسبه‌شده» می‌آید (مقایسه ممکن)",
  report.stored.final_fcr === 1.9 &&
    report.stored.system_fcr === 1.85 &&
    report.totals.fcr === 1.48 &&
    report.meta.feed_basis === "declared",
);

check(
  "۱۳.۱۹ · گزارش: ریز سالن‌ها با نام سالن و اعداد عددی",
  report.halls.length === 2 &&
    report.halls[0].hall_name === "سالن الف (۱)" &&
    report.halls[1].total_feed_intake === 57000 &&
    report.halls[0].live_weight_kg === 19000,
  `halls=${report.halls.length}`,
);

check(
  "۱۳.۱۹ · گزارش: سری روند هفتگی از دادهٔ هفته‌ها ساخته می‌شود",
  Boolean(report.trend) &&
    report.trend.weeks.join(",") === "1,2,3" &&
    report.trend.weight.length === 3 &&
    report.trend.fcr.length === 3,
  `weeks=${report.trend ? report.trend.weeks.join(",") : "null"}`,
);

check(
  "۱۳.۱۹ · گزارش: دارو/واکسن از نام جمع می‌شود (شناسه نمی‌آید)",
  report.medicines.length === 2 &&
    report.medicines[0].name === "ویتامین" &&
    report.medicines[0].count === 2 &&
    report.vaccines[0].name === "نیوکاسل" &&
    !("medicine_id" in report.medicines[0]),
);

check(
  "۱۳.۱۹ · گزارش: اختلاف FCR ثبت‌شده با محاسبه ⇒ هشدار صادقانه",
  report.notices.some((text) => text.includes("اختلاف دارد")),
  `notices=${report.notices.length}`,
);

check(
  "۱۳.۱۹ · گزارش: خروجی کامل (JSON) هیچ کلید اقتصادی/شخصی ندارد",
  (() => {
    const json = JSON.stringify(report);
    return !/price_per_kg|income_total|net_profit|profit_percent|total_cost|completed_by|customer_id|یادداشت داخلی/.test(
      json,
    );
  })(),
);

check(
  "۱۳.۱۹ · گزارش: دورهٔ بدون سالن/هفته ⇒ اعداد خالی + هشدار (نه دادهٔ جعلی)",
  (() => {
    const empty = view.completionReportView({ completion: { id: 5 } });
    return (
      empty.halls.length === 0 &&
      empty.trend === null &&
      empty.totals.fcr === null &&
      empty.totals.weeksCount === 0 &&
      empty.notices.length >= 2 &&
      empty.medicines.length === 0
    );
  })(),
);

// ============================================================
// ۴) مسیر، کنترلر و سرویس (سیم‌کشی و قواعد امنیتی)
// ============================================================
check(
  "۱۳.۱۹ · مسیرها: دو GET تازه در زنجیرهٔ تب «پایان دوره»",
  /router\.get\(\s*"\/completions"/.test(CODE.routes) &&
    /router\.get\(\s*"\/completions\/:id"/.test(CODE.routes) &&
    /const completionChain = tabChain\("customer\.portal\.completion"\)/.test(
      CODE.routes,
    ),
);

check(
  "۱۳.۱۹ · مسیرها: گزارش تفصیلی کلید جدا + مالکیت ردیف (۴۰۴ غیرخودی)",
  /customer\.portal\.completion\.report/.test(CODE.routes) &&
    /requireOwnedRow\(\{\s*model:\s*FlockCompletion/.test(CODE.routes) &&
    /label:\s*"پایان دوره"/.test(CODE.routes),
);

check(
  "۱۳.۱۹ · مسیرها: هیچ POST/PATCH/PUT/DELETE برای completions نیست",
  !/router\.(post|patch|put|delete)\(\s*["']\/completions/.test(CODE.routes),
);

check(
  "۱۳.۱۹ · کنترلر: شناسهٔ پرونده فقط از توکن (نه query/body کلاینت)",
  /req\.customerScopeId/.test(CODE.controller) &&
    !/req\.(body|query)\.customer_id/.test(CODE.controller) &&
    !/req\.params\.customer/.test(CODE.controller) &&
    !/Number\(req\.query/.test(CODE.controller),
);

check(
  "۱۳.۱۹ · کنترلر: صفحه‌بندی از parsePagination با سقف ۵۰",
  /parsePagination\(query,\s*\{\s*defaultLimit:\s*PAGE_DEFAULT,\s*maxLimit:\s*PAGE_MAX/.test(
    CODE.controller,
  ) &&
    /const PAGE_MAX = 50;/.test(CODE.controller),
);

check(
  "۱۳.۱۹ · سرویس: همهٔ کوئری‌ها با customer_id اسکوپ‌اند و فقط خواندن",
  (CODE.service.match(/customer_id: customerId/g) || []).length >= 6 &&
    !/\.(create|bulkCreate|update|destroy|upsert)\(/.test(CODE.service),
  `scoped=${(CODE.service.match(/customer_id: customerId/g) || []).length}`,
);

check(
  "۱۳.۱۹ · سرویس: فقط findOne/findAll/findAndCountAll (هیچ نوشتنی)",
  (CODE.service.match(/findAll\(|findOne\(|findAndCountAll\(/g) || []).length >= 6 &&
    !/\.save\(|\.increment\(|\.decrement\(/.test(CODE.service),
);

check(
  "۱۳.۱۹ · view: موتور محاسبه همان flockMetrics است (فرمول دوم ندارد)",
  /require\("\.\/flockMetrics"\)/.test(CODE.view) &&
    /aggregateFlock\(/.test(CODE.view) &&
    /summarizeWeeks\(/.test(CODE.view) &&
    /buildFlockTrend\(/.test(CODE.view),
);

// ============================================================
// ۵) پورتال: بخش‌های خلاصه + کلیدها
// ============================================================
check(
  "۱۳.۱۹ · portalController: sections دو پنل تازه را برمی‌گرداند",
  /completion:\s*canCompletion,/.test(SRC.portalController) &&
    /finalReport:\s*Boolean\(canCompletion && canCompletionReport\)/.test(
      SRC.portalController,
    ) &&
    /completion_report:\s*Boolean\(canCompletion && canCompletionReport\)/.test(
      SRC.portalController,
    ),
);

check(
  "۱۳.۱۹ · کاتالوگ: ۲۲۷ کلید و ۱۸ گروه (۲ کلید تازه در گروه portal)",
  catalog.TOTAL_PERMISSIONS === 227 &&
    catalog.PERMISSION_GROUPS.length === 18 &&
    catalog.PERMISSIONS["customer.portal.completion"].group === "portal" &&
    catalog.PERMISSIONS["customer.portal.completion.report"].group === "portal",
  `keys=${catalog.TOTAL_PERMISSIONS}`,
);

check(
  "۱۳.۱۹ · کاتالوگ: پیش‌فرض هر دو کلید دقیقاً «فقط مشتری» و بدون قفل",
  ["customer.portal.completion", "customer.portal.completion.report"].every(
    (key) => {
      const entry = catalog.PERMISSIONS[key];
      return (
        entry.defaults.customer === true &&
        entry.defaults.admin === false &&
        entry.defaults.super_admin === false &&
        entry.defaults.sub_admin === false &&
        entry.defaults.expert === false &&
        (entry.lockedTo || []).length === 0
      );
    },
  ),
);

check(
  "۱۳.۱۹ · permissions-test: انتظار ۲۲۷ کلید به‌روز شده است",
  /TOTAL_PERMISSIONS === 227 && catalog\.PERMISSION_GROUPS\.length === 18/.test(
    read(FILES.permissionsTest),
  ),
);

// ============================================================
// ۶) اجرا و گیت
// ============================================================
check(
  "۱۳.۱۹ · اسکریپت npm (بک‌اند + فرانت) و گیت این گارد را می‌شناسند",
  (() => {
    try {
      const backend = JSON.parse(read(FILES.packageJson));
      const frontend = JSON.parse(read(FILES.fePackageJson));
      return (
        backend?.scripts?.["test:portal-completion"] ===
          "node portal-completion-test.mjs" &&
        frontend?.scripts?.["test:portal-completion"] ===
          "node ../Backend/portal-completion-test.mjs" &&
        /test:portal-completion/.test(read(FILES.gateMjs)) &&
        /test:portal-completion/.test(read(FILES.gatePs1))
      );
    } catch {
      return false;
    }
  })(),
);

// ============================================================
// جمع‌بندی
// ============================================================
const passed = results.filter(Boolean).length;
const failed = results.length - passed;
console.log("");
console.log(`portal-completion-guard: ${passed}/${results.length} PASS`);
if (failed) {
  console.log(`❌ ${failed} بررسی ناموفق`);
  process.exitCode = 1;
} else {
  console.log("✅ همهٔ بررسی‌های «پایان دوره» سبز است");
}
