// ============================================================
//  تست برابری بدنهٔ دو متد غول خوشهٔ پایان دوره — گارد موج برش بدنه (۳.۲f)
//  اجرا:  npm run test:hatchery:body                  (در پوشهٔ Frontend)
//         npm run test:hatchery:body -- --snapshot    (بازتولید اسنپ‌شات طلایی)
// ------------------------------------------------------------
//  چرا؟ دو متد بزرگ این خوشه برش بدنه می‌خورند (کد از داخل متد به تابع‌های
//  ماژول‌محلی منتقل می‌شود) بدون تغییر رفتار:
//    hatchery.completion.period.js:296  completePeriod        ۲۷۸ خط
//    hatchery.completion.period.js:724  editPeriodCompletion  ۳۶۵ خط
//  هیچ تستی این دو متد را اجرا نمی‌کرد؛ هر دو به Swal/document/jQuery وابسته‌اند و
//  رکورد ساختاری (فرم HTML + payload + فراخوانی‌های API + اعلان‌ها) می‌سازند.
//  روش سنجش دو لایه است (هم‌سبک گارد سالن‌ها/هفتگی):
//    ۱) «انکر»های رفتاری: زیررشته‌های کلیدی رکورد زنده (PASS/FAIL).
//    ۲) «اسنپ‌شات طلایی»: sha256 رکورد JSON هر کِیس در
//       docs/hatchery-completion-body-golden.json (پیش از برش) ⇒ هر بایت تغییر، FAIL.
//  ⚠️ ساعت سیستم تثبیت شده است (متد از `new Date().toISOString()` استفاده می‌کند).
//  ⚠️ اگر عمداً رفتار تغییر کرد، اول:
//     npm run test:hatchery:body -- --snapshot
// ============================================================
import crypto from "node:crypto";
import fs from "node:fs";

// ---------- تثبیت منطقهٔ زمانی + ساعت ----------
process.env.TZ = process.env.TZ || "Asia/Tehran";
const FROZEN_MS = Date.UTC(2026, 5, 15, 6, 30, 0); // 2026-06-15 06:30 UTC
const RealDate = Date;
class FrozenDate extends RealDate {
  constructor(...args) {
    super(...(args.length ? args : [FROZEN_MS]));
  }

  static now() {
    return FROZEN_MS;
  }
}
globalThis.Date = FrozenDate;

// ---------- استاب‌های مرورگر (قبل از import سرویس) ----------
const makeEl = (value = "") => ({
  value,
  checked: false,
  textContent: "",
  innerHTML: "",
  style: {},
  dataset: {},
  disabled: false,
  classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
  addEventListener(type, fn) {
    this.__listeners = this.__listeners || {};
    this.__listeners[type] = fn;
  },
  removeEventListener() {},
  querySelector: () => null,
  querySelectorAll: () => [],
});
const dom = {
  els: new Map(),
  checkedFlocks: [],
  shipRows: [],
  datepickerCalls: [],
};
globalThis.window = globalThis.window || {
  location: { search: "", href: "http://localhost/", pathname: "/" },
  addEventListener() {},
  removeEventListener() {},
  matchMedia: () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }),
  open: () => null,
};
globalThis.document = globalThis.document || {
  getElementById: (id) => {
    if (!dom.els.has(id)) dom.els.set(id, makeEl());
    const el = dom.els.get(id);
    if (!el.id) el.id = id;
    return el;
  },
  querySelector: () => null,
  querySelectorAll: (selector) =>
    selector === ".completion-flock-check:checked"
      ? dom.checkedFlocks
      : selector === "#ue_ship_rows .ue-ship-row"
        ? dom.shipRows
        : [],
  addEventListener() {},
  removeEventListener() {},
  createElement: () => makeEl(),
};
globalThis.localStorage = globalThis.localStorage || {
  getItem: () => null,
  setItem() {},
  removeItem() {},
};
const $ = (target) => ({
  persianDatepicker: (options) => {
    dom.datepickerCalls.push({ target: target?.id ?? null, options });
    return { data: () => ({}) };
  },
});
$.fn = {};
globalThis.$ = $;

const results = [];
const check = (name, ok, extra = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}${extra ? " :: " + extra : ""}`);
};
const info = (message) => console.log(`ℹ️  ${message}`);

const clone = (value) =>
  value === undefined ? null : JSON.parse(JSON.stringify(value));

// ---------- دفتر ثبت فراخوانی‌ها (هر کِیس بازنشانی می‌شود) ----------
const calls = {
  api: {},
  notifications: [],
  validation: [],
  swal: [],
  loadData: 0,
  recompute: [],
  consoleErrors: [],
  consoleWarns: [],
};
const resetCalls = () => {
  calls.api = {};
  calls.notifications = [];
  calls.validation = [];
  calls.swal = [];
  calls.loadData = 0;
  calls.recompute = [];
  calls.consoleErrors = [];
  calls.consoleWarns = [];
  dom.els = new Map();
  dom.checkedFlocks = [];
  dom.shipRows = [];
  dom.datepickerCalls = [];
};

// ---------- استاب Swal: ثبت options + اجرای didOpen/preConfirm ----------
let swalBehavior = { isConfirmed: true };
globalThis.Swal = {
  fire: async (options) => {
    const record = {
      title: options.title ?? null,
      html: options.html ?? null,
      showCancelButton: options.showCancelButton ?? null,
      confirmButtonText: options.confirmButtonText ?? null,
      cancelButtonText: options.cancelButtonText ?? null,
      confirmButtonColor: options.confirmButtonColor ?? null,
      cancelButtonColor: options.cancelButtonColor ?? null,
      width: options.width ?? null,
      padding: options.padding ?? null,
      hasDidOpen: typeof options.didOpen === "function",
      hasPreConfirm: typeof options.preConfirm === "function",
      didOpenRan: false,
      preConfirmResult: null,
    };
    calls.swal.push(record);
    if (record.hasDidOpen && swalBehavior.runDidOpen !== false) {
      options.didOpen();
      record.didOpenRan = true;
      if (typeof swalBehavior.afterDidOpen === "function") {
        swalBehavior.afterDidOpen();
      }
    }
    let value;
    if (record.hasPreConfirm && swalBehavior.runPreConfirm !== false) {
      value = await options.preConfirm();
      record.preConfirmResult = clone(value);
    }
    if (swalBehavior.isConfirmed === false) {
      return { isConfirmed: false, value: undefined };
    }
    return {
      isConfirmed: true,
      value:
        swalBehavior.forceValue !== undefined ? swalBehavior.forceValue : value,
    };
  },
  showValidationMessage: (message) => calls.validation.push(String(message)),
  close: () => {},
};

// ---------- import ماژول‌های واقعی ----------
const SERVICE_MODULE =
  "./src/features/customer-info/sections/hatchery/hatchery.service.js";
const { hatcheryService } = await import(SERVICE_MODULE);
const { hatcheryApi } = await import(
  "./src/features/customer-info/sections/hatchery/hatchery.api.js"
);
const { notificationService } = await import(
  "./src/core/services/notification.service.js"
);

// ---------- وصلهٔ API: ثبت فراخوانی + پاسخ قابل‌تعیین ----------
const apiHandlers = {
  getPeriodCompletions: async () => ({ success: true, data: [] }),
  updateCompletion: async () => ({ success: true }),
  completePeriods: async () => ({ success: true, message: null }),
};
for (const name of Object.keys(apiHandlers)) {
  hatcheryApi[name] = async (...args) => {
    const entry = { args: clone(args), result: null };
    if (!calls.api[name]) calls.api[name] = [];
    calls.api[name].push(entry);
    const out = await apiHandlers[name](...args);
    entry.result = clone(out);
    return out;
  };
}

notificationService.showLoading = (message) =>
  calls.notifications.push({ type: "loading", message: String(message) });
notificationService.hideLoading = () =>
  calls.notifications.push({ type: "hideLoading", message: null });
for (const type of ["success", "error", "warning", "info"]) {
  notificationService[type] = (message) =>
    calls.notifications.push({ type, message: String(message) });
}
hatcheryService.loadData = async () => {
  calls.loadData += 1;
};
hatcheryService.recomputeSystemFields = (completionId, completions) => {
  calls.recompute.push([
    completionId,
    Array.isArray(completions) ? completions.length : null,
  ]);
  return Promise.resolve();
};
const consoleError = console.error;
const consoleWarn = console.warn;
console.error = (...args) => calls.consoleErrors.push(args.map(String));
console.warn = (...args) => calls.consoleWarns.push(args.map(String));

// ---------- ابزار ساخت حالت DOM هر کِیس ----------
const setFields = (values = {}) => {
  for (const [id, value] of Object.entries(values)) {
    const el = makeEl(typeof value === "string" ? value : "");
    if (value && typeof value === "object") Object.assign(el, value);
    el.id = id;
    dom.els.set(id, el);
  }
};
const setShipRows = (rows = []) => {
  dom.shipRows = rows.map((row) => ({
    querySelector: (selector) =>
      selector === ".ue-ship-age"
        ? makeEl(String(row.age ?? ""))
        : selector === ".ue-ship-qty"
          ? makeEl(String(row.qty ?? ""))
          : null,
  }));
};
const setCheckedFlocks = (ids = []) => {
  dom.checkedFlocks = ids.map((id) => ({ value: String(id) }));
};
const setSwal = (behavior = {}) => {
  swalBehavior = { isConfirmed: true, ...behavior };
};
const setApi = (name, handler) => {
  apiHandlers[name] = handler;
};
const setDatepicker = (enabled) => {
  if (enabled) {
    $.fn.persianDatepicker = function () {
      return { data: () => ({}) };
    };
  } else {
    delete $.fn.persianDatepicker;
  }
};

// ---------- فیکسچرها ----------
const makeCompletion = (over = {}) => ({
  id: 501,
  initial_chicks_count: 10000,
  total_mortality: 350,
  transport_mortality: 20,
  final_chicks_count: 9650,
  final_week_number: 6,
  total_feed_intake: 24500,
  system_total_feed: 24400,
  system_last_weight: 2.35,
  final_avg_weight: 2.35,
  system_fcr: 1.72,
  mortality_rate: 3.5,
  slaughter_age_method: "range",
  slaughter_age_days: 42,
  slaughter_age_end_days: null,
  slaughter_date: "2026-06-10",
  slaughter_end_date: null,
  slaughter_shipments: null,
  slaughterhouse_name: "کشتارگاه نمونه",
  total_sent: 9600,
  total_live_weight: 22560,
  avg_live_weight: 2.35,
  farmer_fcr: 1.68,
  farmer_total_meat: 14900,
  farmer_total_feed: 23800,
  farmer_total_weight: 22400,
  completion_type: "completed",
  confirmed_by_customer: true,
  notes: "یادداشت تست",
  ...over,
});
const makePeriod = (over = {}) => ({
  id: 7,
  period_number: 3,
  period_name: "دورهٔ تست",
  is_active: true,
  ...over,
});
const makeFlock = (over = {}) => ({
  id: 71,
  period_id: 7,
  flock_number: 12,
  total_chicks_count: 10000,
  is_active: true,
  placement_date: "2026-05-01",
  ...over,
});
const setServiceState = ({
  periods = [makePeriod()],
  flocks = [makeFlock()],
} = {}) => {
  hatcheryService.periods = periods;
  hatcheryService.flocks = flocks;
};

// فرم ویرایش: همهٔ فیلدهای پر
const EDIT_FIELDS = {
  ueCompletionId: "501",
  ueInitialChicks: "10000",
  ueFinalChicks: "9650",
  ueFinalWeek: "6",
  ueTotalFeed: "24500",
  ueLastWeight: "2.35",
  ueSystemFcr: "1.72",
  ueTotalMortality: "350",
  ueMortalityRate: "3.5",
  ueSlaughterhouse: "کشتارگاه نمونه",
  ueTransportMortality: "20",
  ueTotalSent: "9600",
  ueTotalLiveWeight: "22560",
  ueAvgLiveWeight: "2.35",
  ueFarmerFcr: "1.68",
  ueFarmerMeat: "14900",
  ueFarmerFeed: "23800",
  ueFarmerWeight: "22400",
  ueCompletionType: "completed",
  ueNotes: "یادداشت تست",
  ueFlockIso: "1405/03/01",
  ue_age_method: "range",
  ueSlaughterDate: "1405/03/25",
  ueSlaughterEndDate: "",
};
const editSetup = ({ fields = EDIT_FIELDS, behavior = {}, api = {} } = {}) => {
  setServiceState();
  setFields(fields);
  setCheckedFlocks([]);
  setShipRows([]);
  setDatepicker(false);
  setSwal({ isConfirmed: behavior.isConfirmed ?? true, ...behavior });
  setApi(
    "getPeriodCompletions",
    api.getPeriodCompletions ??
      (async () => ({ success: true, data: [makeCompletion()] })),
  );
  setApi(
    "updateCompletion",
    api.updateCompletion ?? (async () => ({ success: true })),
  );
};
const buildRecord = (method) => ({
  method,
  swal: calls.swal,
  validation: calls.validation,
  api: calls.api,
  notifications: calls.notifications,
  loadData: calls.loadData,
  recompute: calls.recompute,
  datepicker: dom.datepickerCalls,
  consoleErrors: calls.consoleErrors,
  consoleWarns: calls.consoleWarns,
});
const runEdit = async (periodId = 501) => {
  await hatcheryService.editPeriodCompletion(periodId);
  return buildRecord("editPeriodCompletion");
};

const cases = [];
cases.push(
  {
    name: "E1.editPeriodCompletion-رکورد-کامل-ذخیرهٔ-موفق",
    setup: () => editSetup({}),
    anchors: [
      '"width": 720',
      "💾 ذخیره تغییرات",
      'id="ueCompletionId" value="501"',
      "اطلاعات پایان دوره بروزرسانی شد",
      '"loadData": 1',
      '"hideLoading"',
    ],
    run: () => runEdit(501),
  },
  {
    name: "E2.editPeriodCompletion-رکورد-قدیمی-انصراف",
    setup: () =>
      editSetup({
        fields: {
          ...EDIT_FIELDS,
          ueSlaughterhouse: "",
          ueTransportMortality: "",
          ueTotalSent: "",
          ueFarmerFcr: "",
          ueNotes: "",
        },
        behavior: { isConfirmed: false, runPreConfirm: false },
        api: {
          getPeriodCompletions: async () => ({
            success: true,
            data: [
              makeCompletion({
                id: 502,
                slaughterhouse_name: null,
                transport_mortality: null,
                total_sent: null,
                farmer_fcr: null,
                notes: null,
                completion_type: null,
                confirmed_by_customer: false,
                slaughter_date: null,
              }),
            ],
          }),
        },
      }),
    anchors: ['"loadData": 0', '"preConfirmResult": null', 'id="ueCompletionId" value="502"'],
    absent: ["اطلاعات پایان دوره بروزرسانی شد"],
    run: () => runEdit(502),
  },
  {
    name: "E3.editPeriodCompletion-چندگله-اولی-پیش‌فرض",
    setup: () =>
      editSetup({
        api: {
          getPeriodCompletions: async () => ({
            success: true,
            data: [
              makeCompletion(),
              makeCompletion({ id: 999, notes: "یادداشت گلهٔ دوم" }),
            ],
          }),
        },
      }),
    anchors: ['value="501"', "یادداشت تست", '"id": 501'],
    absent: [],
    run: () => runEdit(501),
  },
  {
    name: "E4.editPeriodCompletion-بدون-داده",
    setup: () =>
      editSetup({
        api: {
          getPeriodCompletions: async () => ({ success: true, data: [] }),
        },
      }),
    anchors: ["اطلاعات پایان دوره یافت نشد", '"swal": []'],
    run: () => runEdit(501),
  },
  {
    name: "E5.editPeriodCompletion-پاسخ-ناموفق-واکشی",
    setup: () =>
      editSetup({
        api: {
          getPeriodCompletions: async () => ({ success: false, data: null }),
        },
      }),
    anchors: ["اطلاعات پایان دوره یافت نشد", '"swal": []'],
    run: () => runEdit(501),
  },
  {
    name: "E6.editPeriodCompletion-بدون-شناسه",
    setup: () => editSetup({ fields: { ...EDIT_FIELDS, ueCompletionId: "" } }),
    anchors: [
      "شناسه پایان دوره یافت نشد",
      '"preConfirmResult": false',
      '"loadData": 0',
    ],
    run: () => runEdit(501),
  },
  {
    name: "E7.editPeriodCompletion-پایان-قبل-از-شروع",
    setup: () =>
      editSetup({
        fields: {
          ...EDIT_FIELDS,
          ueSlaughterDate: "1405/03/25",
          ueSlaughterEndDate: "1405/03/20",
        },
      }),
    anchors: [
      "تاریخ پایان کشتار نمی‌تواند قبل از تاریخ شروع باشد",
      '"loadData": 0',
    ],
    run: () => runEdit(501),
  },
  {
    name: "E8.editPeriodCompletion-روش-بازه-بدون-تاریخ",
    setup: () =>
      editSetup({ fields: { ...EDIT_FIELDS, ueSlaughterDate: "", ueSlaughterEndDate: "" } }),
    anchors: ["تاریخ شروع کشتار را وارد کنید", '"loadData": 0'],
    run: () => runEdit(501),
  },
  {
    name: "E9.editPeriodCompletion-روش-مستقیم-سن-صفر",
    setup: () =>
      editSetup({
        fields: { ...EDIT_FIELDS, ue_age_method: "direct", ueAgeDirect: "0" },
      }),
    anchors: ["سن کشتار را وارد کنید (عدد مثبت)", '"loadData": 0'],
    run: () => runEdit(501),
  },
  {
    name: "E10.editPeriodCompletion-روش-چندمرحله‌ای-بدون-ارسال",
    setup: () => {
      editSetup({ fields: { ...EDIT_FIELDS, ue_age_method: "weighted" } });
      setShipRows([]);
    },
    anchors: [
      "در روش چندمرحله‌ای حداقل یک ارسال با سن و تعداد معتبر اضافه کنید",
      '"loadData": 0',
    ],
    run: () => runEdit(501),
  },
  {
    name: "E11.editPeriodCompletion-روش-چندمرحله‌ای-با-دو-ارسال",
    setup: () => {
      editSetup({ fields: { ...EDIT_FIELDS, ue_age_method: "weighted" } });
      setShipRows([
        { age: 30, qty: 5000 },
        { age: 45, qty: 4000 },
      ]);
    },
    anchors: [
      '"slaughter_age_method": "weighted"',
      '"slaughter_age_days": 37',
      '"quantity": 5000',
      '"quantity": 4000',
      '"loadData": 1',
    ],
    run: () => runEdit(501),
  },
  {
    name: "E12.editPeriodCompletion-ذخیره-ناموفق",
    setup: () =>
      editSetup({
        api: {
          updateCompletion: async () => ({ success: false, message: "خطای سرور" }),
        },
      }),
    anchors: ["خطای سرور", '"type": "error"', '"loadData": 0'],
    absent: ["اطلاعات پایان دوره بروزرسانی شد"],
    run: () => runEdit(501),
  },
  {
    name: "E13.editPeriodCompletion-استثنا-در-ذخیره",
    setup: () =>
      editSetup({
        api: {
          updateCompletion: async () => {
            throw new Error("شبکه قطع است");
          },
        },
      }),
    anchors: ["خطا در ارتباط با سرور", "Error updating completion", "شبکه قطع است"],
    run: () => runEdit(501),
  },
  {
    name: "E14.editPeriodCompletion-کلیک-محاسبهٔ-مجدد",
    setup: () => {
      editSetup({
        behavior: {
          afterDidOpen: () => {
            const btn = dom.els.get("ueRecomputeBtn");
            if (btn?.__listeners?.click) btn.__listeners.click();
          },
        },
      });
      setDatepicker(true);
    },
    anchors: [
      '"recompute": [',
      '"didOpenRan": true',
      '"target": "ueSlaughterDate"',
      '"target": "ueSlaughterEndDate"',
    ],
    run: () => runEdit(501),
  },
);

// ---------- کِیس‌های completePeriod ----------
const CF_FIELDS = {
  cfSlaughterDate: "1405/03/25",
  cfSlaughterEndDate: "",
  cfSlaughterhouseName: "کشتارگاه دوره",
  cfTransportMortality: "15",
  cfTotalSent: "14900",
  cfTotalLiveWeight: "35100",
  cfFarmerFcr: "1.7",
  cfFarmerTotalMeat: "23200",
  cfFarmerTotalFeed: "37000",
  cfFarmerTotalWeight: "34900",
  cfCompletionType: "completed",
  cfNotes: "یادداشت دوره",
};
const periodSetup = ({
  periods,
  flocks,
  selected = [71, 72],
  fields = CF_FIELDS,
  behavior = {},
  api = {},
} = {}) => {
  setServiceState({
    periods: periods ?? [makePeriod()],
    flocks: flocks ?? [
      makeFlock(),
      makeFlock({ id: 72, flock_number: 13, total_chicks_count: 8000 }),
    ],
  });
  setFields(fields);
  setCheckedFlocks(selected);
  setShipRows([]);
  setDatepicker(false);
  setSwal({ isConfirmed: behavior.isConfirmed ?? true, ...behavior });
  setApi("getPeriodCompletions", async () => ({ success: true, data: [] }));
  setApi(
    "completePeriods",
    api.completePeriods ?? (async () => ({ success: true, message: null })),
  );
};
const runPeriod = async (periodId = 7) => {
  await hatcheryService.completePeriod(periodId);
  return buildRecord("completePeriod");
};

cases.push(
  {
    name: "C1.completePeriod-ذخیرهٔ-موفق-دو-گله",
    setup: () => periodSetup({}),
    anchors: [
      '"width": 650',
      "🏁 ثبت و پایان دوره",
      '"period_ids": [',
      '"flock_ids": [',
      '"completion_date": "2026-06-15"',
      "دوره با موفقیت پایان یافت",
      '"loadData": 1',
    ],
    run: () => runPeriod(7),
  },
  {
    name: "C2.completePeriod-دوره-ناموجود",
    setup: () => periodSetup({ periods: [] }),
    anchors: ["دوره یافت نشد", '"swal": []'],
    run: () => runPeriod(7),
  },
  {
    name: "C3.completePeriod-بدون-گلهٔ-فعال",
    setup: () => periodSetup({ flocks: [makeFlock({ is_active: false })] }),
    anchors: ["این دوره گله فعالی ندارد", '"swal": []'],
    run: () => runPeriod(7),
  },
  {
    name: "C4.completePeriod-بدون-انتخاب-گله",
    setup: () => periodSetup({ selected: [] }),
    anchors: [
      "حداقل یک گله را انتخاب کنید",
      '"preConfirmResult": false',
      '"loadData": 0',
    ],
    run: () => runPeriod(7),
  },
  {
    name: "C5.completePeriod-پایان-قبل-از-شروع",
    setup: () =>
      periodSetup({
        fields: {
          ...CF_FIELDS,
          cfSlaughterDate: "1405/03/25",
          cfSlaughterEndDate: "1405/03/20",
        },
      }),
    anchors: [
      "تاریخ پایان کشتار نمی‌تواند قبل از تاریخ شروع باشد",
      '"loadData": 0',
    ],
    run: () => runPeriod(7),
  },
  {
    name: "C6.completePeriod-ذخیره-ناموفق",
    setup: () =>
      periodSetup({
        api: {
          completePeriods: async () => ({ success: false, message: "خطای دوره" }),
        },
      }),
    anchors: ["خطای دوره", '"type": "error"', '"loadData": 0'],
    run: () => runPeriod(7),
  },
  {
    name: "C7.completePeriod-استثنا-در-ذخیره",
    setup: () =>
      periodSetup({
        api: {
          completePeriods: async () => {
            throw new Error("شبکه قطع است");
          },
        },
      }),
    anchors: ["خطا در ارتباط با سرور", "Error completing period", "شبکه قطع است"],
    run: () => runPeriod(7),
  },
  {
    name: "C8.completePeriod-انصراف",
    setup: () =>
      periodSetup({ behavior: { isConfirmed: false, runPreConfirm: false } }),
    anchors: ['"loadData": 0', "cfCompletionType", '"preConfirmResult": null'],
    absent: ["دوره با موفقیت پایان یافت"],
    run: () => runPeriod(7),
  },
);

// ===== اجرا: انکرهای رفتاری + هش sha256 هر کِیس =====
const GOLDEN_URL = new URL(
  "../docs/hatchery-completion-body-golden.json",
  import.meta.url,
);
const SNAPSHOT = process.argv.includes("--snapshot");
const sha256 = (text) =>
  crypto.createHash("sha256").update(text, "utf8").digest("hex");
// رکورد با تورفتگی می‌شود تا انکرها خوانا باشند؛ برای انکرهای درون‌HTML
// (که در JSON با \" فرار می‌کنند) نسخهٔ «رمزگشایی‌شده» هم در نظر گرفته می‌شود.
const recordText = (record) => JSON.stringify(record, null, 2);
const anchorView = (text) =>
  text + "\n" + text.replace(/\\"/g, '"').replace(/\\n/g, "\n");

check(
  "متد هدف hatcheryService.completePeriod موجود است",
  typeof hatcheryService?.completePeriod === "function",
);
check(
  "متد هدف hatcheryService.editPeriodCompletion موجود است",
  typeof hatcheryService?.editPeriodCompletion === "function",
);

const captured = {};
for (const testCase of cases) {
  resetCalls();
  setDatepicker(false);
  testCase.setup?.();
  const record = await testCase.run();
  const text = recordText(record);
  const view = anchorView(text);
  captured[testCase.name] = {
    bytes: Buffer.byteLength(text, "utf8"),
    sha256: sha256(text),
  };
  for (const anchor of testCase.anchors ?? []) {
    check(`${testCase.name} → انکر «${anchor}»`, view.includes(anchor));
  }
  for (const anchor of testCase.absent ?? []) {
    check(`${testCase.name} → غیبت «${anchor}»`, !view.includes(anchor));
  }
}

// ===== پیش‌نیاز پایداری اسنپ‌شات: ساعت تثبیت‌شده باشد =====
const firstCase = cases[0];
resetCalls();
setDatepicker(false);
firstCase.setup?.();
const firstAgain = recordText(await firstCase.run());
check(
  "دو اجرای متوالی کِیس اول رکورد یکسان می‌دهند (تثبیت ساعت)",
  sha256(firstAgain) === captured[firstCase.name].sha256,
);

// ===== اسنپ‌شات طلایی: برابری بایت‌به‌بایت =====
if (SNAPSHOT) {
  fs.writeFileSync(
    GOLDEN_URL,
    `${JSON.stringify(
      {
        note: "اسنپ‌شات رکورد ساختاری دو متد غول خوشهٔ پایان دوره (completePeriod و editPeriodCompletion)، گرفته‌شده پیش از موج برش بدنه (۳.۲f). هر کِیس = رکورد JSON شامل فرم HTML (Swal)، خروجی preConfirm، فراخوانی‌های API، اعلان‌ها، پیام‌های اعتبارسنجی و console. بازتولید: npm run test:hatchery:body -- --snapshot",
        node: process.version,
        locale: Intl.NumberFormat().resolvedOptions().locale,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        frozenClockUtc: new Date(FROZEN_MS).toISOString(),
        source: "HEAD پیش از برش بدنه — git tag pre-completion-body-split",
        note2:
          "خروجی به locale/ICU و منطقهٔ زمانی محیط Node وابسته است (ارقام/تاریخ شمسی در فرم و اعلان‌ها)؛ هارنس ساعت را تثبیت و TZ را روی Asia/Tehran قفل می‌کند، پس مقایسه در همان محیطی معنا دارد که اسنپ‌شات گرفته شده است.",
        cases: captured,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  info(
    `اسنپ‌شات طلایی نوشته شد: docs/hatchery-completion-body-golden.json (${Object.keys(captured).length} کِیس)`,
  );
} else if (!fs.existsSync(GOLDEN_URL)) {
  check(
    "اسنپ‌شات طلایی docs/hatchery-completion-body-golden.json موجود است",
    false,
    "با --snapshot بساز",
  );
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
console.warn = consoleWarn;
const failed = results.filter((ok) => !ok).length;
if (failed) {
  console.log(
    `\n❌ ${failed} بررسی از ${results.length} ناموفق — گارد برش بدنهٔ خوشهٔ پایان دوره`,
  );
  process.exitCode = 1;
} else {
  console.log(
    `\n✅ هر ${results.length} بررسی موفق — رکورد دو متد بایت‌به‌بایت پایدار است`,
  );
}
