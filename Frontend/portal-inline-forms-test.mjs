// ============================================================
//  گارد «فرم درون‌خطی پورتال» — موج ۱۳.۲۳
// ------------------------------------------------------------
//  چه چیزی را قفل می‌کند؟
//   ۱) شیت مودال ۱۳.۲۱ دیگر وجود ندارد (نه در HTML، نه در CSS،
//      نه در سرویس) — هیچ رگرسیونی به `portal-sheet` ممکن نیست.
//   ۲) میزبان واحد فرم با «جابه‌جایی گره» به جایگاه هر بخش می‌رود و
//      با بستن به پارکینگ برمی‌گردد (**اجرای واقعی** با DOM قلابی).
//   ۳) نگاشت «بخش ← گروه‌های فرم» کامل و بدون نشت است.
//   ۴) هیچ `<form>`/`type="submit"`/`customer_id` در مسیر نوشتن نیست.
//
//  اجرا:  npm run test:portal-inline      (در پوشهٔ Frontend)
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

const HTML = read("Frontend/src/pages/portal.html");
const CSS = read("Frontend/src/features/portal/portal.css");
const INLINE_CSS = read("Frontend/src/features/portal/portal.inline.css");
const FARM = read("Frontend/src/features/portal/portal.farm.js");
const VIEWS = read("Frontend/src/features/portal/portal.views.js");
const SERVICE = read("Frontend/src/features/portal/portal.service.js");
const PKG = read("Frontend/package.json");
const GATE = read("tools/gate.mjs");
const GATE_PS1 = read("tools/gate.ps1");

const rules = await import("../Frontend/src/features/portal/portal.farm.rules.js");
// ⚠️ چند ماژول پورتال در سطح ماژول به window/document نگاه می‌کنند؛ این
//  قلاب‌ها **قبل** از import مشترک باید وجود داشته باشند (گارد بدون مرورگر).
globalThis.window =
  globalThis.window ||
  {
    matchMedia: () => ({ matches: false, addEventListener: () => undefined }),
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    location: { hash: "", pathname: "/portal" },
  };
const farmMod = await import("../Frontend/src/features/portal/portal.farm.js");

// ============================================================
// ۰) فایل‌های موج
// ============================================================
check(
  "۱۳.۲۳ · فایل‌های موج موجود و غیرخالی‌اند",
  INLINE_CSS.trim().length > 400 &&
    FARM.includes("bindInlineForm") &&
    HTML.includes('id="portalRequestForm"'),
);

// ============================================================
// ۱) شیت ۱۳.۲۱ کامل حذف شده
// ============================================================
check(
  "۱۳.۲۳ · هیچ نشانی از شیت مودال نمانده (HTML/CSS/JS)",
  !/portal-sheet/.test(HTML) &&
    !/portalRequestSheet/.test(HTML) &&
    !/data-portal-sheet/.test(HTML) &&
    !/\.portal-sheet/.test(CSS) &&
    !/body\.portal-sheet-open/.test(CSS) &&
    !/portalRequestSheet|data-sheet-close|portal-sheet-open/.test(FARM) &&
    !/openRequestSheet|closeRequestSheet|isRequestSheetOpen|bindRequestSheet/.test(
      FARM,
    ),
);

// حذف توضیحات پیش از سنجش «بدون تگ فرم» (توضیحات فارسی خودشان از
//  `<form>` حرف می‌زنند و نباید گارد را قرمز کنند)
const stripComments = (src) =>
  String(src || "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");

const FARM_CODE = stripComments(FARM);
const VIEWS_CODE = stripComments(VIEWS);

check(
  "۱۳.۲۳ · قرارداد «بدون تگ فرم» در مسیر نوشتن حفظ شده",
  !/(<form[\s>]|type="submit")/i.test(HTML) &&
    !/(<form[\s>]|type="submit")/i.test(FARM_CODE) &&
    !/customer_id/.test(FARM_CODE) &&
    !/customer_id/.test(VIEWS_CODE),
);

// ============================================================
// ۲) HTML: میزبان + پارکینگ + جایگاه هر بخش
// ============================================================
const SLOT_PANELS = ["units", "halls", "placements", "weeks", "flocks"];

check(
  "۱۳.۲۳ · یک میزبان + یک پارکینگ + پنج جایگاه (کلید حرفی)",
  /id="portalInlinePark"/.test(HTML) &&
    /id="portalRequestForm"/.test(HTML) &&
    /id="portalRequestFormTitle"/.test(HTML) &&
    (HTML.match(/id="portalRequestForm"/g) || []).length === 1 &&
    SLOT_PANELS.every((panel) =>
      new RegExp(`data-inline-slot="${panel}"`).test(HTML),
    ) &&
    SLOT_PANELS.every((panel) =>
      new RegExp(`data-inline-open="${panel}"`).test(HTML),
    ),
);

check(
  "۱۳.۲۳ · شناسه‌های داخلی فرم ۱۳.۱۱/۱۳.۱۶ دست‌نخورده‌اند",
  /id="portalFarmStatus"/.test(HTML) &&
    /id="portalFarmBody"/.test(HTML) &&
    (HTML.match(/id="portalFarmBody"/g) || []).length === 1,
);

// ============================================================
// ۳) CSS درون‌خطی: بدون لایهٔ شناور، بدون قفل صفحه
// ============================================================
check(
  "۱۳.۲۳ · portal.inline.css: بلوک درون‌خطی و ردیف هدف",
  /\.portal-inline\[hidden\]/.test(INLINE_CSS) &&
    /\.portal-inline-slot/.test(INLINE_CSS) &&
    /\.portal-inline-bar/.test(INLINE_CSS) &&
    /\.portal-inline__close/.test(INLINE_CSS) &&
    /\.portal-acc__row\.is-target/.test(INLINE_CSS) &&
    /@media \(max-width: 640px\)/.test(INLINE_CSS) &&
    /prefers-reduced-motion/.test(INLINE_CSS),
);

check(
  "۱۳.۲۳ · portal.inline.css: هیچ position:fixed/overflow:hidden ندارد",
  !/position:\s*fixed/.test(INLINE_CSS) &&
    !/overflow:\s*(hidden|clip)/.test(INLINE_CSS) &&
    !/z-index:\s*1[0-9]{3}/.test(INLINE_CSS),
);

check(
  "۱۳.۲۳ · استایل در HTML لینک شده و از portal.css جداست",
  /href="\/features\/portal\/portal\.inline\.css"/.test(HTML) &&
    INLINE_CSS.length > 0 &&
    CSS.length > INLINE_CSS.length,
);
// ============================================================
// ۴) نگاشت «بخش ← گروه» (اجرای واقعی، نه grep)
// ============================================================
check(
  "۱۳.۲۳ · پنج بخش و پوشش کامل پنج گروه",
  rules.FARM_PANEL_KEYS.join(",") === "units,halls,placements,weeks,flocks" &&
    rules.FARM_FORM_GROUPS.every((group) =>
      rules.FARM_PANEL_KEYS.some((panel) =>
        rules.farmGroupsOfPanel(panel).includes(group.key),
      ),
    ),
);

check(
  "۱۳.۲۳ · خانهٔ هر نوع یک بخش معتبر است و نوع پیش‌فرض درست است",
  rules.FARM_TYPE_KEYS.every((type) =>
    rules.FARM_PANEL_KEYS.includes(rules.farmPanelOfType(type)),
  ) &&
    rules.farmDefaultTypeOfPanel("units") === "unit_create" &&
    rules.farmDefaultTypeOfPanel("halls") === "hall_create" &&
    rules.farmDefaultTypeOfPanel("placements") === "placement_create" &&
    rules.farmDefaultTypeOfPanel("weeks") === "weekly_create" &&
    rules.farmDefaultTypeOfPanel("flocks") === "weekly_create" &&
    rules.farmDefaultTypeOfPanel("hack") === rules.FARM_DEFAULT_TYPE,
);

check(
  "۱۳.۲۳ · گیت «نوع مجاز در بخش» درست عمل می‌کند",
  rules.farmTypeAllowedInPanel("unit_update", "units") === true &&
    rules.farmTypeAllowedInPanel("hall_create", "units") === true &&
    rules.farmTypeAllowedInPanel("hall_physical_save", "halls") === true &&
    rules.farmTypeAllowedInPanel("hall_physical_save", "units") === false &&
    rules.farmTypeAllowedInPanel("weekly_update", "weeks") === true &&
    rules.farmTypeAllowedInPanel("weekly_update", "units") === false &&
    rules.farmTypeAllowedInPanel("nope", "units") === false &&
    rules.farmGroupsOfPanel("hack").length === 0 &&
    rules.farmGroupsOfPanel("halls").join(",") === "hall,hall_details",
);

check(
  "۱۳.۲۳ · farmPanelOfType: گروه‌های هم‌نام به بخش درست می‌روند",
  rules.farmPanelOfType("unit_create") === "units" &&
    rules.farmPanelOfType("hall_delete") === "halls" &&
    rules.farmPanelOfType("hall_hygiene_save") === "halls" &&
    rules.farmPanelOfType("placement_activate") === "placements" &&
    rules.farmPanelOfType("weekly_delete") === "weeks" &&
    rules.farmPanelOfType("hack") === "",
);


// ============================================================
// ۵) اجرای واقعی mount/unmount با DOM قلابی
// ============================================================
const makeNode = (attrs = {}, tag = "DIV") => {
  const attrMap = new Map(Object.entries(attrs));
  const classes = new Set();
  return {
    tagName: tag,
    hidden: false,
    children: [],
    parentNode: null,
    classList: {
      add: (name) => classes.add(name),
      remove: (name) => classes.delete(name),
      contains: (name) => classes.has(name),
    },
    getAttribute: (name) => (attrMap.has(name) ? attrMap.get(name) : null),
    setAttribute: (name, value) => attrMap.set(name, String(value)),
    removeAttribute: (name) => attrMap.delete(name),
    appendChild(child) {
      if (child.parentNode && child.parentNode.children) {
        child.parentNode.children = child.parentNode.children.filter(
          (item) => item !== child,
        );
      }
      this.children.push(child);
      child.parentNode = this;
      return child;
    },
    querySelector: () => null,
    querySelectorAll: () => [],
    focus: () => undefined,
    isConnected: true,
  };
};

const formNode = makeNode({ id: "portalRequestForm" });
const park = makeNode({ id: "portalInlinePark" });
park.appendChild(formNode);
park.hidden = true;

const slots = new Map(SLOT_PANELS.map((panel) => [panel, makeNode({})]));
const byId = new Map([
  ["portalRequestForm", formNode],
  ["portalInlinePark", park],
  ["portalFarmBody", makeNode({ id: "portalFarmBody" })],
]);

globalThis.document = {
  querySelector: (selector) => {
    const found = /^\[data-inline-slot="([a-zA-Z]+)"\]$/.exec(selector);
    return found ? slots.get(found[1]) || null : null;
  },
  querySelectorAll: () => [],
  getElementById: (id) => byId.get(String(id)) || null,
  body: makeNode({}),
};

const host = {
  ...farmMod.portalFarmMixin,
  el: (id) => byId.get(String(id)) || null,
  farm: { ui: { panel: "", accId: "", origin: null } },
  renderFarm: () => undefined,
  resetFarmForm: () => undefined,
};

check(
  "۱۳.۲۳ · mount: میزبان به جایگاه بخش منتقل و نمایان می‌شود",
  (() => {
    const mounted = host.mountRequestForm("units");
    return (
      mounted === formNode &&
      formNode.parentNode === slots.get("units") &&
      formNode.hidden === false &&
      formNode.getAttribute("data-inline-panel") === "units" &&
      host.isRequestFormOpen() === true
    );
  })(),
);

check(
  "۱۳.۲۳ · unmount: میزبان به پارکینگ برمی‌گردد و پنهان می‌شود",
  (() => {
    const ok = host.unmountRequestForm();
    return (
      ok === true &&
      formNode.parentNode === park &&
      formNode.hidden === true &&
      formNode.getAttribute("data-inline-panel") === null &&
      host.isRequestFormOpen() === false
    );
  })(),
);

check(
  "۱۳.۲۳ · جایگاه نامعتبر ⇒ پارکینگ (هیچ سلکتور آزادی ساخته نمی‌شود)",
  (() => {
    const mounted = host.mountRequestForm("units;drop");
    return (
      mounted === formNode &&
      host.requestFormSlot("units;drop") === null &&
      formNode.parentNode === park &&
      formNode.hidden === false &&
      host.requestFormSlot("") === null &&
      host.requestFormSlot("units") === slots.get("units")
    );
  })(),
);

check(
  "۱۳.۲۳ · markFarmTarget: کلاس ردیف + باز شدن <details> والد",
  (() => {
    const details = makeNode({}, "DETAILS");
    details.open = false;
    const row = makeNode({});
    row.parentElement = details;
    const button = {
      closest: (selector) => (selector === ".portal-acc__row" ? row : null),
    };
    const count = host.markFarmTarget(button);
    return count === 1 && details.open === true;
  })(),
);

check(
  "۱۳.۲۳ · markFarmTarget بدون مبدأ ⇒ صفر (بدون استثنا)",
  host.markFarmTarget(null) === 0,
);

// ============================================================
// ۶) سرویس: فرم به بخش خودش قفل است
// ============================================================
check(
  "۱۳.۲۳ · تغییر بخش، فرم باز را می‌بندد (منطق activateTab)",
  /isRequestFormOpen\(\)/.test(SERVICE) &&
    /closeRequestForm\(\{ focusBack: false \}\)/.test(SERVICE) &&
    /resizeCharts\(\)/.test(SERVICE),
);

check(
  "۱۳.۲۳ · init فقط bindInlineForm را صدا می‌زند (نه bindRequestSheet)",
  /this\.bindInlineForm\(\)/.test(SERVICE) && !/this\.bindRequestSheet\(\)/.test(SERVICE),
);

check(
  "۱۳.۲۳ · نمای ردیف‌ها پنل و accId را از خود دکمه می‌خواند",
  /action\.closest\("\[data-portal-panel\]"\)/.test(VIEWS) &&
    /action\.closest\("\[data-acc-id\]"\)/.test(VIEWS) &&
    /origin: action/.test(VIEWS) &&
    /openRequestForm\(/.test(VIEWS) &&
    !/openRequestSheet/.test(VIEWS),
);

// ============================================================
// ۷) ثبت در npm و دروازهٔ کیفیت
// ============================================================
check(
  "۱۳.۲۳ · اسکریپت npm و gate این گارد را می‌شناسند",
  (() => {
    try {
      const pkg = JSON.parse(PKG);
      return (
        pkg.scripts?.["test:portal-inline"] === "node portal-inline-forms-test.mjs" &&
        /test:portal-inline/.test(GATE) &&
        /test:portal-inline/.test(GATE_PS1)
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
console.log(`  فرم درون‌خطی پورتال — ${passed}/${results.length} بررسی`);
console.log("============================================================");

if (passed !== results.length) {
  console.log(`\n❌ ${results.length - passed} بررسی ناموفق`);
  process.exitCode = 1;
  console.log("FAIL - گارد فرم درون‌خطی پورتال شکست خورد");
} else {
  console.log("GATE-PASS - فرم درون‌خطی پورتال سالم است");
}

