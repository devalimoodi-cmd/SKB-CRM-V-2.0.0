// ============================================================
//  تست برابری بدنهٔ متدهای خوشهٔ سالن‌ها — گارد موج برش بدنه
//  اجرا:  npm run test:halls:body                  (در پوشهٔ Frontend)
//         npm run test:halls:body -- --snapshot    (بازتولید اسنپ‌شات طلایی)
// ------------------------------------------------------------
//  چرا؟ چهار متد غول این خوشه «برش بدنه» می‌خورند (کد از داخل متد به
//  تابع‌های ماژول‌محلی منتقل می‌شود) بدون هیچ تغییر در فایل، سطح عمومی،
//  یا رفتار. هیچ تستی این چهار متد را اجرا نمی‌کرد؛ پس برش می‌توانست
//  بی‌صدا یک شاخهٔ رندر یا ترتیب فراخوانی را عوض کند:
//    halls.report.js:491   generateHTML            ۴۵۰ خط
//    halls.renderer.js:281 renderHallInfo          ۲۵۴ خط
//    halls.basic.js:235    saveBasicInfo           ۱۷۷ خط
//    halls.units.js:292    renderUnitDetailsPanel  ۱۶۵ خط
//  روش سنجش دو لایه است (هم‌سبک موج ۳.۲c):
//    ۱) «انکر»های رفتاری: چند زیررشتهٔ کلیدی در خروجی زنده (PASS/FAIL).
//    ۲) «اسنپ‌شات طلایی»: sha256 خروجی هر کِیس در docs/halls-body-golden.json
//       که **پیش از برش** از همین منبع گرفته شده است ⇒ هر بایت تغییر، FAIL.
//  ⚠️ اگر عمداً رفتار خروجی تغییر کرد، اول `npm run test:halls:body -- --snapshot`.
//  ⚠️ این گارد عمداً «رفتار فعلی» را قفل می‌کند، حتی جاهایی که رفتار
//     مشکوک است (مثل «undefined» وقتی دیکشنری آیتم بدون name دارد).
// ============================================================
import fs from "node:fs";
import crypto from "node:crypto";

const GOLDEN_URL = new URL("../docs/halls-body-golden.json", import.meta.url);
const SNAPSHOT = process.argv.includes("--snapshot");
const DOMAIN = "./src/features/customer-info/sections/hall-management/";

// ---------- استاب‌های حداقلی مرورگر (قبل از import ماژول‌ها) ----------
globalThis.window = globalThis.window || {
  location: { search: "", href: "http://localhost/", pathname: "/" },
  addEventListener: () => {},
  removeEventListener: () => {},
  matchMedia: () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }),
  open: () => null,
};
const el = (value = "") => ({
  value,
  disabled: false,
  innerHTML: "",
  style: {},
  dataset: {},
  checked: false,
});
const dom = { els: new Map(), saveBtn: null, autoFood: null };
globalThis.document = {
  getElementById: (id) => dom.els.get(id) ?? null,
  querySelector: (selector) =>
    selector === "#basicTab .btn-primary"
      ? dom.saveBtn
      : selector.includes("autoFood")
        ? dom.autoFood
        : null,
  querySelectorAll: () => [],
  addEventListener: () => {},
  removeEventListener: () => {},
};
const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => (storage.has(key) ? storage.get(key) : null),
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
};


globalThis.Swal = { fire: (options) => calls.swal.push(clone(options)) };

// ---------- دفتر ثبت فراخوانی‌ها (هر کِیس بازنشانی می‌شود) ----------
const clone = (value) =>
  value === undefined ? null : JSON.parse(JSON.stringify(value));
const calls = {
  createHall: [],
  updateHall: [],
  validation: [],
  notifications: [],
  swal: [],
  steps: [],
  consoleErrors: [],
  earlyReturn: null,
};
const resetCalls = () => {
  for (const key of Object.keys(calls)) {
    calls[key] = Array.isArray(calls[key]) ? [] : null;
  }
};

// ---------- import ماژول‌های واقعی ----------
const results = [];
const check = (name, ok, extra = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}${extra ? " :: " + extra : ""}`);
};
const info = (message) => console.log(`ℹ️  ${message}`);

const { hallsService } = await import(`${DOMAIN}halls.service.js`);
const { hallsRenderer } = await import(`${DOMAIN}halls.renderer.js`);
const { hallsReport } = await import(`${DOMAIN}halls.report.js`);
const { hallsApi } = await import(`${DOMAIN}halls.api.js`);
const { notificationService } = await import(
  "./src/core/services/notification.service.js"
);

// ---------- وصلهٔ وابستگی‌ها: ثبت فراخوانی + پاسخ قابل‌تعیین ----------
const apiHandlers = {
  createHall: async () => ({ success: true, data: { hall_name: "سالن تست" } }),
  updateHall: async () => ({ success: true }),
};
const patchApi = (name) => {
  hallsApi[name] = async (...args) => {
    calls[name].push(clone(args));
    return apiHandlers[name](...args);
  };
};
patchApi("createHall");
patchApi("updateHall");
notificationService.showValidationErrors = (errors) =>
  calls.validation.push(clone(errors));
notificationService.success = (message) =>
  calls.notifications.push({ type: "success", message });
notificationService.error = (message) =>
  calls.notifications.push({ type: "error", message });
notificationService.warning = (message) =>
  calls.notifications.push({ type: "warning", message });
const consoleError = console.error;
console.error = (...args) => calls.consoleErrors.push(args.map(String));

// ---------- ابزار ساخت فرم تب‌های مختلف برای saveBasicInfo ----------
const setForm = ({ values = {}, autoFood = null, saveBtn } = {}) => {
  dom.els = new Map();
  for (const [id, value] of Object.entries(values)) dom.els.set(id, el(value));
  dom.saveBtn =
    saveBtn ?? {
      disabled: false,
      innerHTML: '<i class="fas fa-save"></i> ذخیره اطلاعات پایه',
      style: { background: "rgb(44,122,110)" },
      dataset: { mode: "edit" },
    };
  dom.autoFood = autoFood;
  dom.els.set("cancelEditHall", { style: { display: "block" }, dataset: {} });
};
const setServiceState = ({
  customerId = "42",
  editingHallId = null,
  halls = [],
} = {}) => {
  hallsService.customerId = customerId;
  hallsService.editingHallId = editingHallId;
  hallsService.halls = halls;
  hallsService.setEditModeBanner = (visible) =>
    calls.steps.push(`setEditModeBanner:${visible}`);
  hallsService.restoreTabButtonsToDefault = () =>
    calls.steps.push("restoreTabButtonsToDefault");
  hallsService.loadData = async () => calls.steps.push("loadData");
  hallsService.resetTab = (id) => calls.steps.push(`resetTab:${id}`);
  hallsService.refreshAllDropdowns = () =>
    calls.steps.push("refreshAllDropdowns");
};

// مقادیر معتبر تب «اطلاعات پایه» (طبق halls.validation.validateHall)
const VALID_BASIC = {
  UnitNumber: "12",
  hallName: "سالن تست آ",
  hallNumber: "3",
  capacity: "20000",
  altitude: "1200",
  hallType: "2",
  buildYear: "1400",
  expert: "5",
  operator: "علی رضایی",
};
// مقادیر خالی هر سه تب (واحد/فیزیکی/سیستم/آبخوری-دانخوری) — برای شاخهٔ «ویرایش»
const EMPTY_TABS = {
  length: "",
  width: "",
  height: "",
  area: "",
  floorMaterial: "",
  "Hall-Physical-Description": "",
  fanCount: "",
  fanSize: "",
  fanCapacity: "",
  heaterCount: "",
  heatingType: "",
  coolingType: "",
  ventilationType: "",
  sanitarySystem: "",
  lighthingSystem: "",
  "Hall-System-Description": "",
  waterType: "",
  foodType: "",
  waterLines: "",
  foodLines: "",
  "Hall-water-feed-Description": "",
};

// ---------- فیکسچرهای دیکشنری ----------
const dicts = {
  hallTypes: [{ id: 2, name: "سالن گوشتی" }, { id: 77 }],
  floorTypes: [{ id: 1, name: "بتنی" }],
  heatingSystems: [{ id: 3, name: "هیتر گازی" }],
  coolingSystems: [{ id: 4, name: "پد سلولزی" }],
  ventilationTypes: [{ id: 5, name: "تونلی" }],
  waterInletTypes: [{ id: 6, name: "ضدعفونی" }],
  lightingSystems: [{ id: 7, name: "LED" }],
  watererTypes: [{ id: 8, name: "نیپل" }],
  feederTypes: [{ id: 9, name: "دیسکی" }],
  experts: [
    { id: 5, name: "دکتر کارشناس" },
    { id: 6, first_name: "رضا", last_name: "محمدی" },
    { id: 7, first_name: "", last_name: "", username: "expert7" },
    { id: 8 },
  ],
};

// ---------- فیکسچرهای renderHallInfo (B) ----------
const hallFull = {
  id: 31,
  hall_number: "3",
  nominal_capacity: 20000,
  altitude_above_sea: 1200,
  hall_type_id: 2,
  construction_year: "1400",
  operator_name: "علی رضایی",
  service_expert_id: 5,
  periodInfo: { period_name: "دورهٔ اول" },
  physicalInfo: {
    length: "100",
    width: "12",
    height: "3",
    area: "1200",
    floor_type_id: 1,
    notes: "کف بتنی با شیب ۲٪",
  },
  systemInfo: {
    fan_count: 8,
    fan_size: 50,
    fan_capacity: "50000",
    heater_count: 4,
    heating_system_id: 3,
    cooling_system_id: 4,
    ventilation_system_id: 5,
    water_inlet_system_id: 6,
    lighting_system_id: 7,
    notes: "نیاز به سرویس دوره‌ای فن‌ها",
  },
  waterFeedInfo: {
    waterer_type_id: 8,
    feeder_type_id: 9,
    water_lines_count: 10,
    feed_lines_count: 11,
    auto_feed_system: true,
    notes: "خطوط سالم",
  },
};
const hallMinimalFixture = { id: 32 };
const hallNameFallbacks = [
  { id: 41, hall_number: "4", service_expert_id: 6, hall_type_id: 77 },
  { id: 42, hall_number: "5", service_expert_id: 7, hall_type_id: 99 },
  {
    id: 43,
    hall_number: "6",
    service_expert_id: 8,
    systemInfo: {
      fan_count: 2,
      fan_size: 40,
      fan_capacity: "9000",
      heater_count: 1,
      heating_system_name: "بخاری نفتی",
      cooling_system_name: "کولر آبی",
      ventilation_system_name: "تهویه طبیعی",
      water_inlet_system_name: "حوضچه",
      lighting_system_name: "مهتابی",
    },
    waterFeedInfo: {
      waterer_type_name: "سطل",
      feeder_type_name: "مکانیکی",
      water_lines_count: 0,
      feed_lines_count: 0,
      auto_feed_system: false,
    },
  },
];

// ---------- فیکسچرهای renderUnitDetailsPanel (D) ----------
const unitFull = {
  id: 12,
  unit_name: "واحد ۱۲",
  address: "جادهٔ قدیم، کیلومتر ۵",
  longitude: "51.389",
  latitude: "35.689",
  capacity: 30000,
  hall_count: 2,
  manager_name: "محمد مدیر",
  manager_phone: "09121234567",
  experts: [
    {
      id: 1,
      expert_name: "کارشناس الف",
      expert_phone: "09120000001",
      expert_role: "دامپزشک",
    },
    { id: 2, expert_name: "کارشناس ب" },
  ],
};
const unitHallsA = [
  { id: 31, unit_id: 12, is_active: true, nominal_capacity: 20000 },
  { id: 32, unit_id: 12, is_active: false, nominal_capacity: 8000 },
];
const unitHallsOverflow = [
  { id: 33, unit_id: 12, nominal_capacity: 12000 },
  { id: 34, unit_id: 99, nominal_capacity: 4000 },
];

// ---------- فیکسچرهای generateHTML (A) ----------
// سالن‌های گزارش، همان شکل «تزئین‌شده»‌ای را دارند که loadHallsDetails می‌سازد
// (نام‌های آماده + physical/system/waterFeed + chickInfo).
const buildReportHall = (overrides = {}) => ({
  id: 31,
  unit_id: 12,
  hall_name: "سالن A",
  hall_number: "1",
  is_active: true,
  nominal_capacity: 20000,
  altitude_above_sea: 1200,
  construction_year: "1400",
  operator_name: "علی رضایی",
  area: "1200",
  unitName: "واحد ۱۲",
  activeFlockUnitName: "واحد ۱۳",
  hallTypeName: "سالن گوشتی",
  floorTypeName: "بتنی",
  heatingName: "هیتر گازی",
  coolingName: "پد سلولزی",
  ventilationName: "تونلی",
  lightingName: "LED",
  heatingItemsText: "هیتر گازی ×۲",
  coolingItemsText: "پد سلولزی ×۴",
  fanItemsText: "۵۰ اینچ ×۸",
  watererName: "نیپل",
  feederName: "دیسکی",
  physical: { length: "100", width: "12", height: "3", notes: "کف بتنی" },
  system: { fan_count: 8, fan_size: 50, fan_capacity: "50000", heater_count: 4 },
  waterFeed: {
    water_lines_count: 10,
    feed_lines_count: 11,
    auto_feed_system: true,
  },
  chickInfo: {
    hall_id: 31,
    unit_id: 12,
    is_active: true,
    total_chicks_count: 18000,
  },
  ...overrides,
});
const hallReportA = buildReportHall();
const hallReportC = buildReportHall({
  id: 32,
  hall_name: "سالن B",
  hall_number: "2",
  is_active: false,
  nominal_capacity: 15000,
  altitude_above_sea: 1150,
  construction_year: "1399",
  operator_name: null,
  area: "900",
  heatingItemsText: "",
  coolingItemsText: "",
  fanItemsText: "",
  chickInfo: { total_chicks_count: 12000 },
});
const hallReportB = buildReportHall({
  id: 33,
  unit_id: null,
  hall_name: "سالن بدون واحد",
  hall_number: null,
  is_active: false,
  nominal_capacity: 0,
  altitude_above_sea: null,
  construction_year: null,
  operator_name: "",
  area: null,
  hallTypeName: "سالن مادر",
  floorTypeName: "-",
  physical: null,
  system: null,
  waterFeed: null,
  heatingItemsText: "",
  coolingItemsText: "",
  fanItemsText: "",
  chickInfo: null,
});
const reportUnits = [
  {
    id: 12,
    unit_name: "واحد ۱۲",
    is_active: true,
    capacity: 30000,
    hall_count: 2,
    manager_name: "محمد مدیر",
    manager_phone: "09121234567",
    latitude: "35.689",
    longitude: "51.389",
    address: "جادهٔ قدیم، کیلومتر ۵",
    status: { name: "فعال", color: "#16a34a" },
    experts: [
      {
        id: 1,
        expert_name: "کارشناس الف",
        expert_role: "دامپزشک",
        expert_phone: "09120000001",
      },
      { id: 2, expert_name: "کارشناس ب", is_active: false },
    ],
  },
  // واحد بدون سالن: در حلقهٔ گروه‌بندی رد می‌شود ولی در آمار «تعداد واحدها» می‌آید
  { id: 13, unit_name: "واحد ۱۳", is_active: false, capacity: 10000 },
];
const generatedAt = "2026-09-27T08:30:00.000Z";
const customerFull = {
  full_name: "شرکت مرغداری تست",
  farm_name: "فارم نمونه",
  mobile_number: "09121111111",
  province: "تهران",
  county: "ری",
  farm_address: "جادهٔ قدیم، کیلومتر ۵",
};

// ===== وضعیت و خروجی هر saveBasicInfo به‌صورت یک «پیلود» قابل‌هش =====
const savePayload = () =>
  JSON.stringify(
    {
      calls,
      button: {
        disabled: dom.saveBtn?.disabled ?? null,
        innerHTML: dom.saveBtn?.innerHTML ?? null,
        background: dom.saveBtn?.style?.background ?? null,
        mode: dom.saveBtn?.dataset?.mode ?? null,
      },
      cancelDisplay: dom.els.get("cancelEditHall")?.style?.display ?? null,
      editingHallId: hallsService.editingHallId,
    },
    null,
    2,
  );
const existingHall = [{ id: 7, period_id: 3, hall_name: "سالن قدیمی" }];

// ===== کِیس‌ها =====
const cases = [
  {
    // A1 — گزارش کامل: واحد با سالن + واحد بدون سالن + سالن بدون واحد (سقوط fallback)
    name: "A1.generateHTML-گزارش-کامل",
    anchors: [
      "<!DOCTYPE html>",
      "گزارش کامل واحدها و سالن",
      "بدون واحد",
      "دریافت گزارش توسط",
      "@media print",
      "جوجه",
      "واحد ۱۲",
    ],
    run: () => {
      localStorage.setItem(
        "user",
        JSON.stringify({ first_name: "سارا", last_name: "مدیری", role: "admin" }),
      );
      return hallsReport.generateHTML({
        customer: customerFull,
        units: reportUnits,
        halls: [hallReportA, hallReportC, hallReportB],
        generatedAt,
      });
    },
  },
  {
    // A2 — حالت خالی: بدون واحد/سالن/مشتری (سقوط «همهٔ سالن‌ها مستقیم»)
    name: "A2.generateHTML-حالت-خالی",
    anchors: ["<!DOCTYPE html>", "تعداد واحدها", "دریافت گزارش توسط"],
    run: () => {
      localStorage.setItem(
        "user",
        JSON.stringify({ username: "expert1", role: "expert" }),
      );
      return hallsReport.generateHTML({
        customer: null,
        units: [],
        halls: [],
        generatedAt,
      });
    },
  },
  {
    // A3 — کاربر بدون نام و نقش ناشناس
    name: "A3.generateHTML-کاربر-ناشناس",
    anchors: ["کاربر ناشناس", "(کاربر)", "بدون واحد", "گزارش کامل واحدها و سالن"],
    run: () => {
      localStorage.setItem("user", JSON.stringify({}));
      return hallsReport.generateHTML({
        customer: null,
        units: [],
        halls: [hallReportB],
        generatedAt,
      });
    },
  },
  {
    // A4 — مشتری با فیلدهای ناقص + نقش مشتری
    name: "A4.generateHTML-مشتری-ناقص",
    anchors: ["(مشتری)", "مشتری تست", "نام فارم", "تعداد سالن"],
    run: () => {
      localStorage.setItem(
        "user",
        JSON.stringify({ fullName: "حسین مشتری", role: "customer" }),
      );
      return hallsReport.generateHTML({
        customer: { full_name: "مشتری تست" },
        units: reportUnits,
        halls: [hallReportA],
        generatedAt,
      });
    },
  },
  {
    // B1 — سالن کامل: هر چهار بخش + یادداشت‌ها + کارشناس با name
    name: "B1.renderHallInfo-سالن-کامل",
    anchors: [
      '<div class="hall-detail-grid">',
      "دکتر کارشناس",
      "کف بتنی با شیب ۲٪",
      "نیاز به سرویس",
      "خطوط سالم",
      "هیتر گازی",
      "پد سلولزی",
      "fa-info-circle",
      "fa-ruler-combined",
      "fa-microchip",
      "fa-tint",
    ],
    run: () => hallsRenderer.renderHallInfo(hallFull, dicts),
  },
  {
    // B2 — سالن مینیمال: سه بخش خالی (شاخه‌های false)
    // (کامنت‌های HTML قالب همیشه در خروجی‌اند؛ پس برای «غیبت بخش» از آیکن
    //  عنوانِ همان بخش استفاده می‌کنیم، نه از متن کامنت.)
    name: "B2.renderHallInfo-سالن-مینیمال",
    anchors: ["اطلاعات پایه", "شماره سالن", "fa-info-circle"],
    absent: ["fa-ruler-combined", "fa-microchip", "fa-tint"],
    run: () => hallsRenderer.renderHallInfo(hallMinimalFixture, dicts),
  },
  {
    // B3 — سقوط نام‌ها: نام سیستمی مستقیم، کارشناس first/last و username و بدون نام،
    //      و آیتم دیکشنری بدون name (رفتار فعلی: «undefined»)
    name: "B3.renderHallInfo-سقوط-نام‌ها",
    anchors: [
      "رضا محمدی",
      "expert7",
      "بخاری نفتی",
      "کولر آبی",
      "حوضچه",
      "مهتابی",
      "سطل",
      "مکانیکی",
      "undefined",
    ],
    run: () =>
      hallNameFallbacks
        .map(
          (hall, index) =>
            `<!-- fallback-${index + 1} -->\n${hallsRenderer.renderHallInfo(hall, dicts)}`,
        )
        .join(""),
  },
  {
    // D1 — واحد کامل: کارشناس‌ها + ظرفیت خالی مثبت
    name: "D1.renderUnitDetailsPanel-واحد-کامل",
    anchors: [
      "unit-details-panel",
      "کارشناس الف",
      "دامپزشک",
      "09120000001",
      "10,000 قطعه",
      "مدیر واحد",
      "محمد مدیر",
    ],
    absent: ["مازاد", "کارشناسی ثبت نشده است"],
    run: () => {
      hallsService.halls = unitHallsA;
      return hallsService.renderUnitDetailsPanel(unitFull);
    },
  },
  {
    // D2 — ظرفیت صفر: freeHtml = «—» و بدون کارشناس
    name: "D2.renderUnitDetailsPanel-ظرفیت-صفر",
    anchors: ["unit-details-panel", "کارشناسی ثبت نشده است", ">—</span>"],
    absent: ["مازاد"],
    run: () => {
      hallsService.halls = unitHallsA;
      return hallsService.renderUnitDetailsPanel({
        ...unitFull,
        capacity: 0,
        experts: [],
      });
    },
  },
  {
    // D3 — ظرفیت منفی (مازاد) + سالن‌های واحدهای دیگر نباید شمرده شوند
    name: "D3.renderUnitDetailsPanel-مازاد",
    anchors: ["مازاد 7,000 قطعه", "کارشناسی ثبت نشده است"],
    run: () => {
      hallsService.halls = unitHallsOverflow;
      return hallsService.renderUnitDetailsPanel({
        ...unitFull,
        capacity: 5000,
        experts: [],
      });
    },
  },
  {
    // D4 — ورودی null: خروجی تهی
    name: "D4.renderUnitDetailsPanel-ورودی-null",
    exact: "",
    run: () => {
      hallsService.halls = [];
      return hallsService.renderUnitDetailsPanel(null);
    },
  },
  {
    // C1 — ثبت سالن جدید: مسیر کامل createHall + پاک‌سازی دکمه
    name: "C1.saveBasicInfo-ثبت-سالن-جدید",
    anchors: [
      '"createHall"',
      '"hall_name": "سالن تست آ"',
      '"hall_number": "3"',
      '"hall_type_id": "2"',
      "با موفقیت ثبت شد",
      '"loadData"',
      '"refreshAllDropdowns"',
      '"resetTab:basicTab"',
      '"disabled": false',
      '"updateHall": []',
    ],
    absent: ['"type": "error"'],
    run: async () => {
      setForm({
        values: { ...VALID_BASIC, ...EMPTY_TABS },
        autoFood: { value: "دارد" },
      });
      setServiceState({ halls: [] });
      await hallsService.saveBasicInfo();
      return savePayload();
    },
  },
  {
    // C2 — ویرایش: به‌روزرسانی + خروج از حالت ویرایش + بارگذاری مجدد
    name: "C2.saveBasicInfo-ویرایش-موفق",
    anchors: [
      '"updateHall"',
      '"setEditModeBanner:false"',
      '"restoreTabButtonsToDefault"',
      '"resetTab:basicTab"',
      "اطلاعات پایه بروزرسانی شد",
      '"mode": ""',
      '"background": ""',
      '"editingHallId": null',
      '"cancelDisplay": "none"',
      '"createHall": []',
    ],
    absent: ['"type": "error"'],
    run: async () => {
      setForm({ values: { ...VALID_BASIC, ...EMPTY_TABS } });
      setServiceState({ editingHallId: 7, halls: existingHall });
      await hallsService.saveBasicInfo();
      return savePayload();
    },
  },
  {
    // C3 — اعتبارسنجی: خطاها + بازگشت دکمه + صفر فراخوانی API
    name: "C3.saveBasicInfo-خطای-اعتبارسنجی",
    anchors: [
      "لطفاً یک واحد انتخاب کنید",
      "نام سالن باید حداقل 2 کاراکتر باشد",
      "ظرفیت اسمی سالن الزامی است",
      "ارتفاع از سطح دریا الزامی است",
      "نوع سالن الزامی است",
      "انتخاب کارشناس خدمات الزامی است",
      '"disabled": false',
      "ذخیره اطلاعات پایه",
      '"createHall": []',
      '"updateHall": []',
      '"steps": []',
    ],
    absent: ['"type": "success"', '"loadData"'],
    run: async () => {
      setForm({ values: { ...EMPTY_TABS } });
      setServiceState({ halls: [] });
      await hallsService.saveBasicInfo();
      return savePayload();
    },
  },
  {
    // C4 — پاسخ ناموفق API در حالت ویرایش: پیام خطا و ماندن در حالت ویرایش
    name: "C4.saveBasicInfo-پاسخ-ناموفق",
    anchors: ['"updateHall"', "خطای تست", '"type": "error"'],
    absent: ['"loadData"', '"type": "success"'],
    run: async () => {
      apiHandlers.updateHall = async () => ({
        success: false,
        message: "خطای تست",
      });
      setForm({ values: { ...VALID_BASIC, ...EMPTY_TABS } });
      setServiceState({ editingHallId: 7, halls: existingHall });
      await hallsService.saveBasicInfo();
      const payload = savePayload();
      apiHandlers.updateHall = async () => ({ success: true });
      return payload;
    },
  },
  {
    // C5 — استثنای شبکه در ثبت سالن: شاخهٔ catch
    name: "C5.saveBasicInfo-استثنا",
    anchors: [
      '"createHall"',
      "شبکه قطع است",
      '"type": "error"',
      "Error saving hall",
      '"disabled": false',
    ],
    absent: ['"loadData"'],
    run: async () => {
      apiHandlers.createHall = async () => {
        throw new Error("شبکه قطع است");
      };
      setForm({ values: { ...VALID_BASIC, ...EMPTY_TABS } });
      setServiceState({ halls: [] });
      await hallsService.saveBasicInfo();
      const payload = savePayload();
      apiHandlers.createHall = async () => ({
        success: true,
        data: { hall_name: "سالن تست" },
      });
      return payload;
    },
  },
  {
    // C6 — دکمه در حال ذخیره: خروج زودهنگام بدون هیچ تغییری
    name: "C6.saveBasicInfo-دکمه-غیرفعال",
    anchors: ['"disabled": true', '"createHall": []', '"updateHall": []', '"steps": []'],
    absent: ["با موفقیت ثبت شد"],
    run: async () => {
      setForm({
        values: { ...VALID_BASIC, ...EMPTY_TABS },
        saveBtn: {
          disabled: true,
          innerHTML: '<i class="fas fa-spinner fa-spin"></i> در حال ذخیره...',
          style: { background: "rgb(44,122,110)" },
          dataset: { mode: "edit" },
        },
      });
      setServiceState({ halls: [] });
      await hallsService.saveBasicInfo();
      return savePayload();
    },
  },
];

// ===== اجرا: انکرهای رفتاری + هش sha256 هر کِیس =====
const sha256 = (text) =>
  crypto.createHash("sha256").update(text, "utf8").digest("hex");
const allConsoleErrors = [];

const surface = [
  ["hallsReport.generateHTML", hallsReport, "generateHTML"],
  ["hallsRenderer.renderHallInfo", hallsRenderer, "renderHallInfo"],
  ["hallsService.saveBasicInfo", hallsService, "saveBasicInfo"],
  [
    "hallsService.renderUnitDetailsPanel",
    hallsService,
    "renderUnitDetailsPanel",
  ],
];
surface.forEach(([label, target, name]) =>
  check(`متد هدف ${label} موجود است`, typeof target?.[name] === "function"),
);

const captured = {};
const a1 = { html: "" };
for (const testCase of cases) {
  resetCalls();
  const payload = await testCase.run();
  captured[testCase.name] = {
    bytes: Buffer.byteLength(payload, "utf8"),
    sha256: sha256(payload),
  };
  if (testCase.name.startsWith("A1.")) a1.html = payload;
  allConsoleErrors.push(...calls.consoleErrors);
  for (const anchor of testCase.anchors ?? []) {
    check(`${testCase.name} → انکر «${anchor}»`, payload.includes(anchor));
  }
  for (const anchor of testCase.absent ?? []) {
    check(`${testCase.name} → غیبت «${anchor}»`, !payload.includes(anchor));
  }
  if ("exact" in testCase) {
    check(
      `${testCase.name} → خروجی دقیقاً «${testCase.exact}»`,
      payload === testCase.exact,
    );
  }
}

// ===== بلوک CSS گزارش: اثبات «ثابت‌بودن» پیش از برش =====
const styleBlock = a1.html.slice(
  a1.html.indexOf("<style>") + "<style>".length,
  a1.html.indexOf("</style>"),
);
check("بلوک <style> گزارش در خروجی هست", styleBlock.includes("@font-face"));
check(
  "بلوک <style> هیچ درج ${} ندارد (قابل تبدیل به ثابت ماژول)",
  !styleBlock.includes("${"),
);
check(
  `بلوک <style> با @font-face شروع می‌شود (${styleBlock.split("\n").length} خط)`,
  styleBlock.trimStart().startsWith("@font-face {") &&
    styleBlock.split("\n").length >= 200,
);

// ===== اسنپ‌شات طلایی: برابری بایت‌به‌بایت =====
if (SNAPSHOT) {
  fs.writeFileSync(
    GOLDEN_URL,
    `${
      JSON.stringify(
        {
          note: "اسنپ‌شات خروجی چهار متد خوشهٔ سالن‌ها، گرفته‌شده پیش از موج برش بدنه (۳.۲d). هر کِیس = خروجی کامل متد (یا رکورد فراخوانی‌ها برای saveBasicInfo). بازتولید: npm run test:halls:body -- --snapshot",
          node: process.version,
          locale: Intl.NumberFormat().resolvedOptions().locale,
          source: "HEAD پیش از برش بدنه — git tag pre-body-split",
          note2:
            "برخی خروجی‌ها به locale پیش‌فرض Node و نسخهٔ ICU وابسته‌اند (ارقام فارسی/جداکنندهٔ هزارگان)؛ پس مقایسه روی همان محیطی معنا دارد که اسنپ‌شات گرفته شده است.",
          cases: captured,
        },
        null,
        2,
      )
    }\n`,
    "utf8",
  );
  info(
    `اسنپ‌شات طلایی نوشته شد: docs/halls-body-golden.json (${Object.keys(captured).length} کِیس)`,
  );
} else if (!fs.existsSync(GOLDEN_URL)) {
  check("اسنپ‌شات طلایی docs/halls-body-golden.json موجود است", false, "با --snapshot بساز");
} else {
  const golden = JSON.parse(fs.readFileSync(GOLDEN_URL, "utf8"));
  const goldenNames = Object.keys(golden.cases ?? {});
  check(
    `اسنپ‌شات طلایی هر ${Object.keys(captured).length} کِیس را پوشش می‌دهد`,
    goldenNames.length === Object.keys(captured).length,
    `اسنپ‌شات=${goldenNames.length}`,
  );
  for (const [name, digest] of Object.entries(captured)) {
    const expected = golden.cases?.[name];
    check(
      `${name} → برابری بایت‌به‌بایت با اسنپ‌شات`,
      !!expected &&
        expected.sha256 === digest.sha256 &&
        expected.bytes === digest.bytes,
      expected
        ? `انتظار ${expected.sha256.slice(0, 10)}/${expected.bytes}B · دریافت ${digest.sha256.slice(0, 10)}/${digest.bytes}B`
        : "این کِیس در اسنپ‌شات نیست",
    );
  }
}

console.error = consoleError;
if (allConsoleErrors.length) {
  info(`console.error در مسیرهای خطای مورد انتظار: ${allConsoleErrors.length} بار`);
}
const failed = results.filter((ok) => !ok).length;
if (failed) {
  console.log(
    `\n❌ ${failed} بررسی از ${results.length} ناموفق — گارد برش بدنهٔ خوشهٔ سالن‌ها`,
  );
  process.exitCode = 1;
} else {
  console.log(
    `\n✅ هر ${results.length} بررسی موفق — خروجی چهار متد بایت‌به‌بایت پایدار است`,
  );
}
