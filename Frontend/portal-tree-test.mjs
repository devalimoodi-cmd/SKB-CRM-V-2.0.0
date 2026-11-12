// ============================================================
//  گارد «آکاردئون، شیت و تیکت» پورتال مشتری — موج ۱۳.۲۱
// ------------------------------------------------------------
//  چه چیزی را قفل می‌کند؟
//   ۱) سه ماژول خالص تازه (`portal.tree.js` / `portal.table.js` /
//      `portal.tickets.js`) — هر سه **اجرا** می‌شوند، نه فقط grep.
//   ۲) پرسمان امنیتی: هیچ شناسهٔ ردیفی از URL نمی‌آید و هیچ متن DB
//      بدون escape به HTML نمی‌رسد (درخت، آکاردئون، تیکت).
//   ۳) حذف منوها: «درخواست‌های من»، «ثبت هفته» و چهار مسیر بخش سالن
//      نباید برگردند، و لینک قدیمی باید به مسیر جانشین هدایت شود.
//   ۴) جدول ریسپانسیو: هر `td` برچسب سرستون را می‌گیرد (idempotent).
//   ۵) صفحه: فرم «درون‌خطی» (`#portalRequestForm` + `data-inline-slot`)
//      وجود دارد، شیت ۱۳.۲۱ حذف شده و هیچ `<form>`/`type="submit"`
//      در HTML یا فرم‌ها نیست. (۱۳.۲۳)
//
//  اجرا:  npm run test:portal-tree      (در پوشهٔ Frontend)
// ============================================================
import fs from "node:fs";
import path from "node:path";

const here = import.meta.dirname;
const ROOT = path.join(here, "..");

const results = [];
const check = (name, ok, extra = "") => {
  results.push(Boolean(ok));
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}${extra ? " :: " + extra : ""}`);
};

const read = (rel) => {
  try {
    return fs.readFileSync(path.join(ROOT, rel), "utf8").replace(/^\uFEFF/, "");
  } catch {
    return "";
  }
};
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));

// ============================================================
// ۰) فایل‌های موج
// ============================================================
const FILES = {
  tree: "Frontend/src/features/portal/portal.tree.js",
  table: "Frontend/src/features/portal/portal.table.js",
  tickets: "Frontend/src/features/portal/portal.tickets.js",
  views: "Frontend/src/features/portal/portal.views.js",
  farm: "Frontend/src/features/portal/portal.farm.js",
  menu: "Frontend/src/features/portal/portal.menu.js",
  farmRules: "Frontend/src/features/portal/portal.farm.rules.js",
  css: "Frontend/src/features/portal/portal.css",
  // ✅ ۱۳.۲۳ — استایل فرم درون‌خطی (شیت حذف شد)
  inlineCss: "Frontend/src/features/portal/portal.inline.css",
  html: "Frontend/src/pages/portal.html",
  pkg: "Frontend/package.json",
  gate: "tools/gate.mjs",
  gatePs1: "tools/gate.ps1",
};

check(
  "۱۳.۲۱ · هفت فایل موج موجود و غیرخالی‌اند",
  [FILES.tree, FILES.table, FILES.tickets, FILES.views, FILES.menu, FILES.css, FILES.html].every(
    (rel) => exists(rel) && read(rel).trim().length > 400,
  ),
);

const SRC = {
  tree: read(FILES.tree),
  table: read(FILES.table),
  tickets: read(FILES.tickets),
  views: read(FILES.views),
  farm: read(FILES.farm),
  css: read(FILES.css),
  inlineCss: read(FILES.inlineCss),
  html: read(FILES.html),
  pkg: read(FILES.pkg),
};

// ============================================================
// ۱) خلوص ماژول درخت/جدول + بدون شبکه
// ============================================================
check(
  "۱۳.۲۱ · portal.tree.js خالص است (بدون import/DOM/fetch)",
  !/^\s*import\s/m.test(SRC.tree) &&
    !/\bdocument\b|\bwindow\b/.test(SRC.tree) &&
    !/\bfetch\s*\(|XMLHttpRequest/.test(SRC.tree),
);

check(
  "۱۳.۲۱ · portal.table.js هیچ content نمی‌سازد (فقط attribute)",
  !/innerHTML\s*=/.test(SRC.table) && !/\bcreateElement\b/.test(SRC.table) && /setAttribute/.test(SRC.table),
);

check(
  "۱۳.۲۱ · سقف آیتم درخت اعلام شده و با فرم درخواست هم‌قاعده است (۶۰)",
  /export const TREE_MAX_ITEMS = 60/.test(SRC.tree) &&
    /export const FARM_MAX_LIST_ITEMS = 60/.test(read(FILES.farmRules)) &&
    /TREE_MAX_ITEMS/.test(SRC.tree),
);

// ============================================================
// ۲) اجرای واقعی ماژول‌های خالص
// ============================================================
const treeMod = await import("../Frontend/src/features/portal/portal.tree.js");
const tableMod = await import("../Frontend/src/features/portal/portal.table.js");
const menuMod = await import("../Frontend/src/features/portal/portal.menu.js");

const { buildUnitTree, groupPlacementsByFlock, groupWeeksByFlock, treeAccordion, treeEsc, treeTotals, TREE_MAX_ITEMS } =
  treeMod;

const units = [
  { id: 2, unit_name: "دوم" },
  { id: 1, unit_name: "اول" },
];
const halls = [
  { id: 11, unit_id: 1, hall_name: "H1" },
  { id: 12, unit_id: 2, hall_name: "H2" },
  { id: 13, unit_id: 99, hall_name: "بی‌والد" },
];

const tree = buildUnitTree({ units, halls });
const totals = treeTotals(tree);

check(
  "۱۳.۲۱ · درخت واحد ← سالن: ترتیب سرور، سالن بی‌والد نادیده",
  tree.length === 2 &&
    tree[0].id === "2" &&
    tree[0].halls.length === 1 &&
    tree[1].halls.length === 1 &&
    !JSON.stringify(tree).includes("بی‌والد"),
  `units=${totals.units} halls=${totals.halls}`,
);

check(
  "۱۳.۲۱ · سقف درخت: بیش از TREE_MAX_ITEMS واحد رندر نمی‌شود",
  buildUnitTree({
    units: Array.from({ length: TREE_MAX_ITEMS + 5 }, (_, i) => ({ id: i + 1 })),
    halls: [],
  }).length === TREE_MAX_ITEMS,
);

check(
  "۱۳.۲۱ · گروه‌بندی دوره و هفته بر اساس گله (ترتیب حفظ می‌شود)",
  groupPlacementsByFlock([
    { id: 1, flock_number: 3 },
    { id: 2, flock_number: 3 },
    { id: 3, flock_number: 4 },
  ]).length === 2 &&
    groupWeeksByFlock([
      { id: 1, flock_number: 3 },
      { id: 2, flock_number: 3 },
    ])[0].weeks.length === 2,
);

const acc = treeAccordion({
  id: 'x"y',
  title: "<img src=x onerror=alert(1)>",
  badge: "۲",
  subtitle: "s",
  body: "<p>ok</p>",
  level: 2,
  open: true,
});

check(
  "۱۳.۲۱ · آکاردئون: <details> بومی + escape کامل + سطح و وضعیت باز",
  acc.startsWith("<details") &&
    acc.includes('class="portal-acc portal-acc--l2"') &&
    acc.includes(" open") &&
    acc.includes('data-acc-id="x&quot;y"') &&
    !acc.includes("<img") &&
    acc.includes("&lt;img"),
);

check(
  "۱۳.۲۱ · treeEsc همهٔ پنج کاراکتر خطرناک را می‌بندد",
  treeEsc(`&<>"'`) === "&amp;&lt;&gt;&quot;&#39;",
);

// ============================================================
// ۳) decorateTables روی DOM ساختگی (بدون مرورگر)
// ============================================================
const fakeCell = () => {
  const attrs = {};
  return {
    attrs,
    getAttribute: (key) => (key in attrs ? attrs[key] : null),
    setAttribute: (key, value) => {
      attrs[key] = String(value);
    },
  };
};
const fakeTable = (labels = ["#", "دسته"], rows = [["1", "فن"]]) => {
  const table = fakeCell();
  const rowsCells = rows.map((cells) => cells.map(() => fakeCell()));
  table.rowsCells = rowsCells;
  table.querySelectorAll = (selector) => {
    if (selector === "thead th") return labels.map((text) => ({ textContent: text }));
    if (selector === "tbody tr") {
      return rowsCells.map((tds) => ({
        querySelectorAll: (s) => (s === "td" ? tds : []),
      }));
    }
    return [];
  };
  return table;
};

const kvTable = fakeTable([], []);
const cardTable = fakeTable();
const decoratedRoot = {
  querySelectorAll: (selector) =>
    selector === "table.portal-table" ? [kvTable, cardTable] : [],
};

const touchedFirst = tableMod.decorateTables(decoratedRoot);
const touchedAgain = tableMod.decorateTables(decoratedRoot);
const [firstCell, secondCell] = cardTable.rowsCells[0];

check(
  "۱۳.۲۱ · decorateTables: برچسب سرستون روی td + نشانهٔ data-cards",
  touchedFirst === 3 &&
    cardTable.getAttribute("data-cards") === "1" &&
    firstCell.getAttribute("data-label") === "#" &&
    secondCell.getAttribute("data-label") === "دسته",
);

check(
  "۱۳.۲۱ · decorateTables idempotent است (دو بار = یک بار) و ورودی نامعتبر بی‌اثر",
  touchedAgain === 0 &&
    tableMod.decorateTables(null) === 0 &&
    tableMod.decorateTables({}) === 0 &&
    kvTable.getAttribute("data-cards") === null,
);

// ============================================================
// ۴) رندرهای واقعی (ویناژن نمایان + شیت + تیکت)
// ============================================================
globalThis.window = {
  CONFIG: {},
  location: { hash: "#/farm/halls", href: "http://localhost/" },
  addEventListener() {},
  removeEventListener() {},
  setTimeout,
  clearTimeout,
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
};
globalThis.document = {
  addEventListener() {},
  getElementById: () => null,
  querySelectorAll: () => [],
  querySelector: () => null,
  body: { classList: { add() {}, remove() {}, toggle() {} } },
};
globalThis.localStorage = window.localStorage;

const views = await import("../Frontend/src/features/portal/portal.views.js");
const tickets = await import("../Frontend/src/features/portal/portal.tickets.js");
// ✅ ۱۳.۲۳ — نگاشت «بخش ← گروه» در گارد هم **اجرا** می‌شود (نه grep)
const farmRulesMod = await import("../Frontend/src/features/portal/portal.farm.rules.js");

const unitsHtml = views.renderUnitsView(
  [
    { id: 1, unit_name: "واحد <a>", capacity: 1000, is_active: true },
    { id: 2, unit_name: "دوم" },
  ],
  { halls: [], canWrite: true },
);

check(
  "۱۳.۲۱ · واحدها: هر واحد یک آکاردئون + دکمه‌های درخواست (بدون فرم)",
  unitsHtml.includes('data-acc-id="unit-1"') &&
    unitsHtml.includes('data-farm-action="unit_update"') &&
    unitsHtml.includes('data-farm-action="hall_create"') &&
    unitsHtml.includes('data-farm-action="unit_delete"') &&
    !unitsHtml.includes("<a>") &&
    !/<form/i.test(unitsHtml),
);

const hallsHtml = views.renderHallsAccordion({
  halls: [
    { id: 7, hall_name: "سالن <b>" },
    { id: 8, hall_name: "سالن دوم" },
  ],
  details: { 7: { details: { physical: { length: 20 } } } },
  sections: ["physical", "hygiene"],
  canWrite: true,
  pending: { 8: true },
});

check(
  "۱۳.۲۱ · سالن‌ها: آکاردئون تودرتو + گیت بخش‌ها + وضعیت تنبل",
  hallsHtml.includes('data-acc-id="hall-7"') &&
    hallsHtml.includes('data-acc-id="hall-7-physical"') &&
    hallsHtml.includes('data-acc-id="hall-7-hygiene"') &&
    !hallsHtml.includes('data-acc-id="hall-7-system"') &&
    hallsHtml.includes('data-hall-pending="8"') &&
    !hallsHtml.includes("<b>"),
);

check(
  "۱۳.۲۱ · سالن بدون بخش مجاز: پیام قفل (نه درخواست اضافه)",
  views
    .renderHallsAccordion({
      halls: [{ id: 1, hall_name: "x" }],
      details: { 1: { details: {} } },
      sections: [],
    })
    .includes("بسته است") &&
    views.renderHallsAccordion({ halls: [], canWrite: true }).includes("portal-notice"),
);

const weeksHtml = views.renderWeeksTree([
  { id: 1, week_number: 1, flock_number: 2, week_start_date: "2026-01-01", week_end_date: "2026-01-07" },
  { id: 2, week_number: 2, flock_number: 2, week_start_date: "2026-01-08", week_end_date: "2026-01-14" },
]);
const flocksHtml = views.renderFlocksTree([
  { id: 5, flock_number: 2, placement_date: "2026-01-01" },
]);

check(
  "۱۳.۲۱ · هفته/گله: گروه‌بندی گله در <li> (معتبر داخل <ul>)",
  weeksHtml.startsWith('<li class="portal-acc__entry">') &&
    weeksHtml.includes('data-acc-id="weeks-2"') &&
    weeksHtml.includes("data-portal-open=\"week\"") &&
    flocksHtml.startsWith('<li class="portal-acc__entry">') &&
    flocksHtml.includes('data-acc-id="flock-row-5"'),
);

const placementsHtml = views.renderPlacementsView({
  placements: [
    { id: 4, placement_date: "2026-02-02", flock_number: 2, total_chicks_count: 900 },
  ],
});

check(
  "۱۳.۲۱ · دوره‌ها: آکاردئون گله + دکمهٔ جزئیات (رویداد ۱۳.۱۷ حفظ شد)",
  placementsHtml.includes('data-acc-id="flock-2"') &&
    placementsHtml.includes('data-view-placement="4"') &&
    placementsHtml.includes('data-view-placement-card="4"'),
);

// ============================================================
// ۵) پنل تیکت: بدون فرم، سقف‌ها، escape، گفتگو
// ============================================================
const ticketsHtml = tickets.renderTicketsView({
  items: [
    {
      id: 9,
      title: "خطای <script>",
      subject: "bug",
      status: "answered",
      messages_count: 2,
      last_message_at: "2026-01-02",
      user_unread: true,
    },
  ],
  unread: 1,
});

check(
  "۱۳.۲۱ · تیکت: فهرست/فرم تازه بدون <form> و همهٔ دکمه‌ها type=button",
  ticketsHtml.includes("data-ticket-open") &&
    ticketsHtml.includes("data-ticket-send") &&
    ticketsHtml.includes('data-ticket-field="body"') &&
    !/<form/i.test(ticketsHtml) &&
    !/type="submit"/i.test(ticketsHtml) &&
    !ticketsHtml.includes("<script>"),
);

check(
  "۱۳.۲۱ · تیکت: بدون مجوز ارسال، فرم با پیام روشن قفل می‌شود",
  tickets.renderTicketsView({ canCreate: false }).includes("فعال نیست") &&
    !tickets.renderTicketsView({ canCreate: false }).includes("data-ticket-send"),
);

check(
  "۱۳.۲۱ · تیکت: سقف‌های سرور در کلاینت هم اعمال شده‌اند (۱۵۰/۲۰۰۰)",
  /const TITLE_MAX = 150/.test(SRC.tickets) &&
    /const BODY_MAX = 2000/.test(SRC.tickets) &&
    /maxlength="\$\{TITLE_MAX\}"/.test(SRC.tickets) &&
    /maxlength="\$\{BODY_MAX\}"/.test(SRC.tickets),
);

const threadHtml = tickets.renderTicketThread({
  suggestion: { id: 9, title: "خطا", status: "answered" },
  messages: [
    { sender_type: "user", body: "سلام", created_at: "2026-01-02" },
    { sender_type: "admin", body: "بررسی شد", sender_name: "پشتیبانی" },
  ],
});

check(
  "۱۳.۲۱ · تیکت: گفتگو پیام‌ها را با مالکیت درست و پاسخ‌نامه نشان می‌دهد",
  threadHtml.includes("is-mine") &&
    threadHtml.includes("is-admin") &&
    threadHtml.includes("data-ticket-reply=\"9\"") &&
    threadHtml.includes("data-ticket-back") &&
    !/<form/i.test(threadHtml),
);

check(
  "۱۳.۲۱ · تیکت: پنج موضوع مجاز سرور و کلید محتوای خودش",
  tickets.TICKET_SUBJECTS.length === 5 &&
    tickets.TICKET_SUBJECTS.map((row) => row.key).join(",") ===
      "suggestion,question,complaint,bug,other" &&
    tickets.TICKETS_TAB.requires === "customer.portal.tickets" &&
    tickets.TICKETS_TAB.permission === "customer.portal.menu.tickets" &&
    /export const applyPortalTickets/.test(SRC.tickets),
);

check(
  "۱۳.۲۱ · تیکت: شناسهٔ گفتگو فقط از فهرست خودِ سرور پذیرفته می‌شود",
  /state\.items\.some/.test(SRC.tickets) &&
    /String\(state\.threadId\) !== id/.test(SRC.tickets) &&
    !/parseHash|location\.hash|URLSearchParams/.test(SRC.tickets),
);

// ============================================================
// ۶) منو: حذف‌ها برنگشته‌اند و لینک قدیمی هدایت می‌شود
// ============================================================
const { PORTAL_ROUTE_LIST, PORTAL_MENUS, PORTAL_MENU_PANELS, PORTAL_LEGACY_HASH, resolveRoute, legacyRoute } =
  menuMod;

check(
  "۱۳.۲۱ · منو: ۷ منو / ۲۱ مسیر / ۱۳ پنل (بدون requests/weekly.create)",
  PORTAL_MENUS.length === 7 &&
    PORTAL_ROUTE_LIST.length === 21 &&
    PORTAL_MENU_PANELS.length === 13 &&
    !PORTAL_ROUTE_LIST.some((route) => route.startsWith("#/requests")) &&
    !PORTAL_ROUTE_LIST.some((route) => route === "#/weekly/new") &&
    !PORTAL_ROUTE_LIST.some((route) => route.startsWith("#/farm/physical")) &&
    PORTAL_ROUTE_LIST.includes("#/tickets") &&
    PORTAL_ROUTE_LIST.includes("#/farm/units") &&
    PORTAL_ROUTE_LIST.includes("#/farm/halls"),
);

check(
  "۱۳.۲۱ · منو: هشت لینک قدیمی به مسیر جانشین هدایت می‌شوند",
  Object.keys(PORTAL_LEGACY_HASH).length === 8 &&
    legacyRoute("#/requests") === "#/farm/units" &&
    legacyRoute("#/requests/new") === "#/farm/units" &&
    legacyRoute("#/requests/list") === "#/farm/units" &&
    legacyRoute("#/weekly/new") === "#/weekly/list" &&
    legacyRoute("#/farm/physical") === "#/farm/halls" &&
    legacyRoute("#/farm/hygiene") === "#/farm/halls" &&
    resolveRoute("#/requests", null) === "#/farm/units" &&
    resolveRoute("#/farm/systems", null) === "#/farm/halls" &&
    resolveRoute("#/tickets", null) === "#/tickets",
);

check(
  "۱۳.۲۱ · منو: هیچ مسیر سه‌بخشی/شناسه‌دار پذیرفته نمی‌شود (ضد IDOR)",
  menuMod.parseHash("#/farm/units/12") === null &&
    menuMod.parseHash("#/tickets/9") === null &&
    menuMod.parseHash("#/farm/halls/7") === null,
);

// ============================================================
// ۷) صفحه و استایل: فرم درون‌خطی + آکاردئون + جدول ریسپانسیو
// ============================================================
check(
  "۱۳.۲۳ · portal.html: شیت حذف شد و جایگاه درون‌خطی هر بخش هست",
  !/data-portal-sheet/.test(SRC.html) &&
    !/portalRequestSheet/.test(SRC.html) &&
    !/class="portal-sheet/.test(SRC.html) &&
    /id="portalRequestForm"/.test(SRC.html) &&
    /id="portalRequestFormTitle"/.test(SRC.html) &&
    /id="portalInlinePark"/.test(SRC.html) &&
    /data-inline-close/.test(SRC.html) &&
    /data-inline-slot="units"/.test(SRC.html) &&
    /data-inline-slot="halls"/.test(SRC.html) &&
    /data-inline-slot="placements"/.test(SRC.html) &&
    /data-inline-slot="weeks"/.test(SRC.html) &&
    /data-inline-slot="flocks"/.test(SRC.html) &&
    /id="portalFarmBody"/.test(SRC.html) &&
    /data-portal-panel="tickets"/.test(SRC.html) &&
    /data-portal-panel="halls"/.test(SRC.html) &&
    !/data-portal-panel="farm"/.test(SRC.html) &&
    !/data-portal-panel="hallDetail"/.test(SRC.html) &&
    !/<form|type="submit"/i.test(SRC.html),
);

check(
  "۱۳.۲۳ · portal.css: کلاس‌های آکاردئون/تیکت/جدول ماند و شیت پاک شد",
  /\.portal-acc__sum/.test(SRC.css) &&
    /\.portal-acc__row/.test(SRC.css) &&
    !/\.portal-sheet/.test(SRC.css) &&
    !/body\.portal-sheet-open/.test(SRC.css) &&
    /\.portal-tk__msg/.test(SRC.css) &&
    /table\.portal-table\[data-cards="1"\] td::before/.test(SRC.css) &&
    /content: attr\(data-label\)/.test(SRC.css),
);

check(
  "۱۳.۲۳ · portal.inline.css: بلوک درون‌خطی، بدون position:fixed و بدون قفل صفحه",
  /\.portal-inline\[hidden\]/.test(SRC.inlineCss) &&
    /\.portal-inline-slot/.test(SRC.inlineCss) &&
    /\.portal-inline-bar/.test(SRC.inlineCss) &&
    /\.portal-inline__close/.test(SRC.inlineCss) &&
    /\.portal-acc__row\.is-target/.test(SRC.inlineCss) &&
    !/position:\s*fixed/.test(SRC.inlineCss) &&
    !/overflow:\s*hidden/.test(SRC.inlineCss) &&
    /@media \(max-width: 640px\)/.test(SRC.inlineCss) &&
    /prefers-reduced-motion/.test(SRC.inlineCss),
);

check(
  "۱۳.۲۳ · سرویس: فرم درون‌خطی با متد مستقل باز/بسته می‌شود (بدون پنل جدید)",
  /bindInlineForm\(\)/.test(SRC.farm) &&
    /openRequestForm\(\s*rawType/.test(SRC.farm) &&
    /closeRequestForm\(/.test(SRC.farm) &&
    /mountRequestForm\(/.test(SRC.farm) &&
    /unmountRequestForm\(/.test(SRC.farm) &&
    /isRequestFormOpen\(\)/.test(SRC.farm) &&
    /data-inline-close/.test(SRC.farm) &&
    /farmSpecOf\(type\)/.test(SRC.farm) &&
    !/portalRequestSheet|data-sheet-close|portal-sheet-open/.test(SRC.farm),
);

// ✅ ۱۳.۲۳ — نگاشت «بخش ← گروه‌های فرم» یک منبع دارد و کامل است
check(
  "۱۳.۲۳ · نگاشت بخش ← گروه (۵ بخش، ۱۸ نوع، خانهٔ هر نوع یکتا)",
  (() => {
    try {
      const rules = farmRulesMod;
      const panels = rules.FARM_PANEL_KEYS;
      const covered = new Set(
        panels.flatMap((panel) => rules.farmGroupsOfPanel(panel)),
      );
      const allGroups = rules.FARM_FORM_GROUPS.map((group) => group.key);
      const homes = rules.FARM_TYPE_KEYS.map((type) => rules.farmPanelOfType(type));
      return (
        panels.length === 5 &&
        panels.every((panel) => /^[a-z]+$/.test(panel)) &&
        allGroups.every((group) => covered.has(group)) &&
        homes.every((panel) => panels.includes(panel)) &&
        homes.includes("units") &&
        homes.includes("halls") &&
        homes.includes("placements") &&
        homes.includes("weeks") &&
        rules.farmDefaultTypeOfPanel("units") === "unit_create" &&
        rules.farmDefaultTypeOfPanel("weeks") === "weekly_create" &&
        rules.farmTypeAllowedInPanel("weekly_create", "weeks") === true &&
        rules.farmTypeAllowedInPanel("unit_delete", "weeks") === false
      );
    } catch {
      return false;
    }
  })(),
);

check(
  "۱۳.۲۱ · سرویس: «سالن‌ها» از فهرست صفحه‌بندی‌شده به نمای آکاردئونی رفت",
  !/\n  halls: \{\n    permission: "customer\.portal\.halls"/.test(read(FILES.views.replace("views", "service"))) &&
    /loadHallsView\(\)/.test(SRC.views) &&
    /ensureHallDetail\(rawId\)/.test(SRC.views) &&
    /hallSectionsAllowed\(\)/.test(SRC.views) &&
    /getFarmHallDetails/.test(SRC.views),
);

check(
  "۱۳.۲۱ · گیت‌های سرور اول (۱۳.۲۰) در مسیرهای تازه هم رعایت شده",
  /features\.tickets/.test(SRC.tickets) &&
    /canRequestFarm/.test(SRC.farm) &&
    /canRequestFarm/.test(SRC.views) &&
    /canViewContent\(VIEW_TABS\.halls\)/.test(SRC.views),
);

// ============================================================
// ۸) ثبت در npm و دروازهٔ کیفیت
// ============================================================
check(
  "۱۳.۲۱ · اسکریپت npm و gate این گارد را می‌شناسند",
  (() => {
    try {
      const pkg = JSON.parse(SRC.pkg);
      return (
        pkg.scripts?.["test:portal-tree"] === "node portal-tree-test.mjs" &&
        /test:portal-tree/.test(read(FILES.gate)) &&
        /test:portal-tree/.test(read(FILES.gatePs1))
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
console.log("");
console.log("============================================================");
console.log(`  آکاردئون/فرم درون‌خطی/تیکت پورتال — ${passed}/${results.length} بررسی`);
console.log("============================================================");

if (passed !== results.length) {
  console.log(`\n❌ ${results.length - passed} بررسی ناموفق`);
  process.exitCode = 1;
  console.log("FAIL - گارد آکاردئون/شیت پورتال شکست خورد");
} else {
  console.log("\nGATE-PASS - آکاردئون، شیت درخواست و پنل تیکت سالم‌اند");
}




