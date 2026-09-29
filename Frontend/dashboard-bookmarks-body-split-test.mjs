// ============================================================
//  تست برابری بدنهٔ متد غول بوکمارک‌های داشبورد — گارد موج برش بدنه (۳.۲i)
//  اجرا:  npm run test:dashboard:bookmarks:body                (در پوشهٔ Frontend)
//         npm run test:dashboard:bookmarks:body -- --snapshot  (بازتولید اسنپ‌شات طلایی)
// ------------------------------------------------------------
//  چرا؟ `dashboardBookmarkMethods.showCreateBookmarkModal` (`dashboard.bookmarks.js:119` ·
//  ۲۸۴ خط) بزرگ‌ترین متد باقی‌ماندهٔ مخزن است و «برش بدنه» می‌خورد. هیچ تستی آن را مستقیم
//  صدا نمی‌زند (فقط از `dashboard.window-glue.js` با نام `window.showCreateBookmarkModal`).
//  نکتهٔ کلیدی: بیشترین حجم متد یک template literal ~۱۰۸ خطی داخل `Swal.fire({ html })` است،
//  پس گارد باید هم رشتهٔ html، هم نتیجهٔ `preConfirm`، هم فراخوانی‌های API را قفل کند، وگرنه
//  بخش عمدهٔ بدنه بی‌پوشش می‌ماند.
//  روش سنجش دو لایه است (هم‌سبک گاردهای ۳.۲d/e/f/g/h):
//    ۱) «انکر»های رفتاری روی رکورد JSON.
//    ۲) «اسنپ‌شات طلایی»: sha256 رکورد در docs/dashboard-bookmarks-body-golden.json.
//  ⚠️ ساعت تثبیت و TZ قفل شده است (تبدیل تاریخ شمسی داخل قالب مودال).
// ============================================================
import crypto from "node:crypto";
import fs from "node:fs";

process.env.TZ = process.env.TZ || "Asia/Tehran";
const FROZEN_MS = Date.UTC(2026, 5, 15, 6, 30, 0);
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

// ---------- استاب‌های حداقلی مرورگر (قبل از import ماژول) ----------
globalThis.window = globalThis.window || {
  location: { search: "", pathname: "/dashboard", href: "/dashboard" },
  CONFIG: {},
};
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};
globalThis.sessionStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {},
};

// ---------- ابزار ساخت عناصر جعلی DOM ----------
const makeEl = (over = {}) => {
  const el = {
    value: "",
    dataset: {},
    style: {},
    attributes: new Map(),
    handlers: {},
    classList: {
      _set: new Set(),
      add(c) {
        this._set.add(c);
      },
      remove(c) {
        this._set.delete(c);
      },
      contains(c) {
        return this._set.has(c);
      },
    },
    addEventListener(type, handler) {
      (el.handlers[type] = el.handlers[type] || []).push(handler);
    },
    setAttribute(k, v) {
      el.attributes.set(k, String(v));
    },
    getAttribute(k) {
      return el.attributes.has(k) ? el.attributes.get(k) : null;
    },
    hasAttribute(k) {
      return el.attributes.has(k);
    },
    querySelectorAll: () => [],
    closest: () => null,
    focus: () => {},
    ...over,
  };
  return el;
};

// عناصر DOM آزمون؛ هر کِیس با setDom از نو ساخته می‌شوند
let els = {};
const priorityValues = ["critical", "high", "medium", "low"];
const makePriorityGroup = () => {
  const options = priorityValues.map((v) =>
    makeEl({ dataset: { value: v, label: v } }),
  );
  return makeEl({
    _options: options,
    querySelectorAll: (sel) =>
      sel === ".bm-priority-option" ? options : [],
  });
};
const setDom = ({
  title = "",
  customer = "",
  type = "bookmark",
  priority = "medium",
  dueDate = "",
  description = "",
  dueDateInitialized = false,
} = {}) => {
  els = {
    bookmarkTitle: makeEl({ value: title }),
    bookmarkCustomer: makeEl({ value: customer }),
    bookmarkType: makeEl({ value: type }),
    bookmarkPriority: makeEl({ value: priority }),
    bookmarkPriorityGroup: makePriorityGroup(),
    bookmarkDueDate: makeEl({ value: dueDate }),
    bookmarkDescription: makeEl({ value: description }),
  };
  if (dueDateInitialized) {
    els.bookmarkDueDate.setAttribute("data-datepicker-initialized", "true");
  }
};
globalThis.document = {
  addEventListener: () => {},
  querySelector: () => null,
  querySelectorAll: () => [],
  getElementById: (id) => els[id] || null,
};

// ---------- import ماژول هدف (بعد از استاب‌ها) ----------
const { dashboardBookmarkMethods } = await import(
  "./src/features/dashboard/dashboard.bookmarks.js"
);
const { apiService } = await import("./src/core/services/api.service.js");
const { notificationService } = await import(
  "./src/core/services/notification.service.js"
);

const results = [];
const check = (name, ok, extra = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}${extra ? " :: " + extra : ""}`);
};
const info = (message) => console.log(`ℹ️  ${message}`);

// ---------- حالت هر کِیس ----------
const state = {};
const CALLS = () => ({
  get: 0,
  getUrl: null,
  post: 0,
  postUrl: null,
  postBody: null,
  put: 0,
  putUrl: null,
  putBody: null,
  loadBookmarks: 0,
  renderBookmarks: 0,
});
const resetState = (over = {}) => {
  for (const key of Object.keys(state)) delete state[key];
  Object.assign(state, {
    customers: "success",
    customerRows: [
      { id: 5, full_name: "علی رضایی" },
      { id: 6, company_name: "مرغداری نمونه" },
    ],
    swal: "confirm",
    datepicker: "available",
    datepickerSelect: false,
    priorityClick: null,
    api: "success",
    postMessage: "خطای شبیه‌سازی‌شده",
    throwSave: false,
    notifications: [],
    validation: [],
    calls: CALLS(),
    swalOpts: null,
    swalCalls: [],
    dp: { called: false },
    priorityEffect: null,
    console: [],
    ...over,
  });
};

// ---------- خفه‌کردن خروجی کنسول (قطعی‌سازی رکورد) ----------
const fmtArgs = (args) =>
  args
    .map((a) =>
      typeof a === "string"
        ? a
        : a instanceof Error
          ? `${a.name}: ${a.message}`
          : JSON.stringify(a),
    )
    .join(" ");
const silenceConsole = () => {
  const originals = { log: console.log, warn: console.warn, error: console.error };
  console.log = (...a) => state.console.push(`log: ${fmtArgs(a)}`);
  console.warn = (...a) => state.console.push(`warn: ${fmtArgs(a)}`);
  console.error = (...a) => state.console.push(`error: ${fmtArgs(a)}`);
  return () => {
    console.log = originals.log;
    console.warn = originals.warn;
    console.error = originals.error;
  };
};

// ---------- نمونهٔ جعلی میزبان (ctx) ----------
const makeCtx = (bookmarks = []) => ({
  bookmarks,
  loadBookmarks: async () => {
    state.calls.loadBookmarks += 1;
  },
  renderBookmarks: () => {
    state.calls.renderBookmarks += 1;
  },
});

// ---------- نصب استاب‌های $ · Swal · apiService · notificationService ----------
const installStubs = () => {
  // jQuery + تقویم شمسی
  globalThis.$ = (el) => ({
    persianDatepicker(cfg) {
      state.dp.called = true;
      state.dp.cfg = cfg;
      if (state.datepicker === "throws") {
        throw new Error("datepicker init failed");
      }
      if (state.datepickerSelect) cfg.onSelect.call(el);
    },
    val: () => el?.value ?? "",
  });
  globalThis.$.fn = state.datepicker === "missing" ? {} : { persianDatepicker: () => {} };

  // SweetAlert2
  if (state.swal === "absent") {
    delete globalThis.Swal;
  } else {
    globalThis.Swal = {
      fire: (opts) => {
        state.swalOpts = opts;
        state.swalCalls.push({
          title: opts.title ?? null,
          icon: opts.icon ?? null,
          html: opts.html ?? null,
          showCancelButton: opts.showCancelButton ?? null,
          confirmButtonText: opts.confirmButtonText ?? null,
          cancelButtonText: opts.cancelButtonText ?? null,
          confirmButtonColor: opts.confirmButtonColor ?? null,
          cancelButtonColor: opts.cancelButtonColor ?? null,
          reverseButtons: opts.reverseButtons ?? null,
          width: opts.width ?? null,
          padding: opts.padding ?? null,
          background: opts.background ?? null,
          customClass: opts.customClass ?? null,
          hasDidOpen: typeof opts.didOpen === "function",
          hasPreConfirm: typeof opts.preConfirm === "function",
        });
        if (typeof opts.didOpen === "function") opts.didOpen();
        if (state.priorityClick !== null) {
          const options = els.bookmarkPriorityGroup?._options ?? [];
          const option = options[state.priorityClick];
          const handler = option?.handlers?.click?.[0];
          if (handler) handler.call(option);
          state.priorityEffect = {
            activeCount: options.filter((o) => o.classList.contains("active"))
              .length,
            clickOptionActive: option?.classList.contains("active") ?? null,
            inputValue: els.bookmarkPriority?.value ?? null,
          };
        }
        if (state.swal === "cancel") {
          return Promise.resolve({ isConfirmed: false });
        }
        const value =
          typeof opts.preConfirm === "function" ? opts.preConfirm() : undefined;
        // در SweetAlert2 وقتی preConfirm مقدار false بدهد کاربر «تأیید» نشده است
        return Promise.resolve({ isConfirmed: value !== false, value });
      },
      showValidationMessage: (message) => state.validation.push(message),
    };
  }

  // apiService
  apiService.get = async (url) => {
    state.calls.get += 1;
    state.calls.getUrl = url;
    if (state.customers === "throws") throw new Error("network down");
    if (state.customers === "fail") return { success: false, message: "خطای سرور" };
    if (state.customers === "empty") return { success: true, data: { customers: [] } };
    if (state.customers === "noCustomersKey") {
      return { success: true, data: { total: 3 } };
    }
    return { success: true, data: { customers: state.customerRows } };
  };
  const saveStub = (kind) => async (url, body) => {
    state.calls[kind] += 1;
    state.calls[`${kind}Url`] = url;
    state.calls[`${kind}Body`] = body;
    if (state.throwSave) throw new Error("save exploded");
    if (state.api === "fail") return { success: false, message: state.postMessage };
    return { success: true };
  };
  apiService.post = saveStub("post");
  apiService.put = saveStub("put");

  // notificationService
  notificationService.error = (message) =>
    state.notifications.push(`error:${message}`);
  notificationService.success = (message) =>
    state.notifications.push(`success:${message}`);
};

// ---------- اجرای یک کِیس + ساخت رکورد قطعی ----------
const FLUSH = () => new Promise((resolve) => setImmediate(resolve));

const buildRecord = (thrown) => {
  const due = els.bookmarkDueDate;
  const dp = state.dp.cfg ?? null;
  return {
    swalCalls: state.swalCalls.map((call) => ({ ...call })),
    validation: [...state.validation],
    priority: state.priorityEffect,
    datepicker: {
      available: state.datepicker !== "missing",
      called: state.dp.called,
      cfgFormat: dp?.format ?? null,
      cfgAutoClose: dp?.autoClose ?? null,
      cfgInitialValue: dp?.initialValue ?? null,
      cfgObserver: dp?.observer ?? null,
      cfgLocale: dp?.calendar?.persian?.locale ?? null,
      cfgHasOnSelect: typeof dp?.onSelect === "function",
      value: due?.value ?? null,
      selectedDateAttr: due?.dataset?.selectedDate ?? null,
      initializedAttr: due?.getAttribute("data-datepicker-initialized") ?? null,
    },
    calls: { ...state.calls },
    notifications: [...state.notifications],
    console: [...state.console],
    thrown,
  };
};

const runCase = async (testCase) => {
  resetState(testCase.state);
  setDom(testCase.dom);
  installStubs();
  const restore = silenceConsole();
  let thrown = null;
  try {
    await dashboardBookmarkMethods.showCreateBookmarkModal.apply(
      makeCtx(testCase.bookmarks ?? []),
      testCase.args ?? [],
    );
    await FLUSH();
  } catch (error) {
    thrown = `${error?.name}: ${error?.message}`;
  }
  const record = buildRecord(thrown);
  restore();
  return record;
};

const recordText = (record) => JSON.stringify(record, null, 2);
const anchorView = (text) =>
  text + "\n" + text.replace(/\\"/g, '"').replace(/\\n/g, "\n");

// ---------- فیکسچرها ----------
const makeBookmark = (over = {}) => ({
  id: 11,
  title: "تماس با مشتری",
  type: "reminder",
  customer_id: 5,
  priority: "high",
  due_date: "2026-06-20",
  description: "یادآوری سفارش",
  status: "read",
  ...over,
});
const bookmarkList = [
  makeBookmark(),
  makeBookmark({ id: 12, title: "بازدید سالن", priority: null, due_date: null }),
];
const FILLED = {
  title: "تماس با مشتری",
  customer: "5",
  priority: "high",
  dueDate: "1404/03/01",
  description: "یادآوری سفارش",
};

const cases = [
  {
    // K1 — مسیر ایجاد: تأیید کاربر ⇒ POST و بازخوانی/رندر مجدد
    name: "K1.showCreateBookmarkModal-ایجاد",
    dom: FILLED,
    args: [],
    anchors: [
      "📌 بوکمارک جدید",
      "bm-field",
      '"confirmButtonText": "✅ ایجاد بوکمارک"',
      '<option value="5"',
      '"post": 1',
      '"loadBookmarks": 1',
      '"renderBookmarks": 1',
    ],
  },
  {
    // K2 — مسیر ویرایش: PUT روی شناسهٔ موجود + پیش‌پرکردن فیلدها
    name: "K2.showCreateBookmarkModal-ویرایش",
    dom: FILLED,
    bookmarks: bookmarkList,
    args: [11],
    anchors: [
      "✏️ ویرایش بوکمارک",
      '"confirmButtonText": "💾 ذخیره تغییرات"',
      "value=\"5\" selected",
      'class="bm-priority-option active" data-value="high"',
      '"put": 1',
      '"/bookmarks/11"',
      // خروجی convertPersianToGregorian روی «1404/03/01» همین است؛ گارد بایت‌ها را قفل می‌کند
      '"due_date": "783-03-01"',
    ],
  },
  {
    // K3 — ویرایش با شناسهٔ ناموجود در this.bookmarks ⇒ bookmark = {} و اعتبارسنجی می‌گیرد
    name: "K3.showCreateBookmarkModal-شناسه-ناموجود",
    dom: {},
    bookmarks: bookmarkList,
    args: [99],
    anchors: [
      "✏️ ویرایش بوکمارک",
      "لطفاً عنوان بوکمارک را وارد کنید",
      '"put": 0',
      '"post": 0',
    ],
  },
  {
    // K4 — درخواست مشتریان با success:false ⇒ بدون گزینه، ولی مودال ساخته می‌شود
    name: "K4.showCreateBookmarkModal-مشتریان-ناموفق",
    state: { customers: "fail" },
    dom: {},
    args: [],
    anchors: ['"get": 1', '"/customers?limit=100&page=1"', '"hasDidOpen": true'],
    absent: ["علی رضایی"],
  },
  {
    // K5 — پرتاب خطا در واکشی مشتریان ⇒ فقط لاگ، مودال ادامه می‌دهد
    name: "K5.showCreateBookmarkModal-مشتریان-پرتاب",
    state: { customers: "throws" },
    dom: {},
    args: [],
    anchors: [
      "log: Could not load customers: Error: network down",
      '"hasDidOpen": true',
    ],
  },
  {
    // K6 — data بدون کلید customers ⇒ customers.map خطا می‌دهد (شاخهٔ catch بیرونی)
    name: "K6.showCreateBookmarkModal-داده-بی‌کلید",
    state: { customers: "noCustomersKey" },
    dom: {},
    args: [],
    anchors: [
      "error: ❌ Error showing bookmark modal: TypeError: customers.map is not a function",
      "error:خطا در نمایش فرم",
      '"swalCalls": []',
    ],
  },
  {
    // K7 — کلیک روی گزینهٔ اولویت (بحرانی) در didOpen
    name: "K7.showCreateBookmarkModal-کلیک-اولویت",
    state: { priorityClick: 0 },
    dom: {},
    args: [],
    anchors: [
      '"activeCount": 1',
      '"clickOptionActive": true',
      '"inputValue": "critical"',
    ],
  },
  {
    // K8 — تقویم شمسی در دسترس ⇒ پیکربندی کامل + تنظیم پرچم مقداردهی
    name: "K8.showCreateBookmarkModal-تقویم-موجود",
    dom: {},
    args: [],
    anchors: [
      '"called": true',
      '"cfgFormat": "YYYY/MM/DD"',
      '"cfgLocale": "fa"',
      '"cfgHasOnSelect": true',
      '"initializedAttr": "true"',
    ],
  },
  {
    // K9 — تقویم شمسی در دسترس نیست ⇒ بدون فراخوانی، ولی پرچم مقداردهی می‌خورد
    name: "K9.showCreateBookmarkModal-تقویم-غایب",
    state: { datepicker: "missing" },
    dom: {},
    args: [],
    anchors: ['"available": false', '"called": false', '"initializedAttr": "true"'],
  },
  {
    // K10 — پرتاب خطا در مقداردهی تقویم ⇒ هشدار، ولی پرچم مقداردهی می‌خورد
    name: "K10.showCreateBookmarkModal-تقویم-پرتاب",
    state: { datepicker: "throws" },
    dom: {},
    args: [],
    anchors: [
      "warn: ⚠️ Error initializing datepicker: Error: datepicker init failed",
      '"called": true',
      '"initializedAttr": "true"',
    ],
  },
  {
    // K11 — فیلد تاریخ قبلاً مقداردهی شده ⇒ تقویم دوباره ساخته نمی‌شود
    name: "K11.showCreateBookmarkModal-تقویم-قبلاً-مقداردهی",
    dom: { dueDateInitialized: true },
    args: [],
    anchors: ['"called": false', '"initializedAttr": "true"'],
  },
  {
    // K12 — انتخاب تاریخ در تقویم ⇒ onSelect مقدار را در فیلد و dataset می‌نویسد
    name: "K12.showCreateBookmarkModal-انتخاب-تاریخ",
    state: { datepickerSelect: true },
    dom: { dueDate: "1404/03/01" },
    args: [],
    anchors: [
      '"selectedDateAttr": "1404/03/01"',
      '"value": "1404/03/01"',
      '"cfgHasOnSelect": true',
    ],
  },
  {
    // K13 — preConfirm بدون عنوان ⇒ پیام اعتبارسنجی و بدون درخواست ذخیره
    name: "K13.showCreateBookmarkModal-بدون-عنوان",
    dom: { customer: "5" },
    args: [],
    anchors: ["لطفاً عنوان بوکمارک را وارد کنید", '"post": 0', '"validation": ['],
  },
  {
    // K14 — preConfirm بدون مشتری ⇒ پیام اعتبارسنجی و بدون درخواست ذخیره
    name: "K14.showCreateBookmarkModal-بدون-مشتری",
    dom: { title: "تماس" },
    args: [],
    anchors: [
      "لطفاً یک مشتری را انتخاب کنید",
      '"post": 0',
      '"validation": [',
    ],
  },
  {
    // K15 — انصراف کاربر ⇒ نه preConfirm صدا زده می‌شود نه ذخیره‌ای رخ می‌دهد
    name: "K15.showCreateBookmarkModal-انصراف",
    state: { swal: "cancel" },
    dom: FILLED,
    args: [],
    anchors: [
      '"post": 0',
      '"put": 0',
      '"validation": []',
      '"notifications": []',
      '"loadBookmarks": 0',
    ],
  },
  {
    // K16 — ذخیره با success:false ⇒ پیام خطای سرور و بدون بازخوانی
    name: "K16.showCreateBookmarkModal-ذخیره-ناموفق",
    state: { api: "fail" },
    dom: FILLED,
    args: [],
    anchors: ['"post": 1', "error:خطای شبیه‌سازی‌شده", '"loadBookmarks": 0'],
  },
  {
    // K17 — ذخیره با پرتاب خطا ⇒ لاگ + پیام «خطا در ارتباط با سرور»
    name: "K17.showCreateBookmarkModal-ذخیره-پرتاب",
    state: { throwSave: true },
    dom: FILLED,
    args: [],
    anchors: [
      "error: ❌ Error saving bookmark: Error: save exploded",
      "error:خطا در ارتباط با سرور",
      '"loadBookmarks": 0',
    ],
  },
  {
    // K18 — SweetAlert2 در دسترس نیست ⇒ شاخهٔ else
    name: "K18.showCreateBookmarkModal-بدون-Swal",
    state: { swal: "absent" },
    dom: FILLED,
    args: [],
    anchors: ["error:SweetAlert2 در دسترس نیست", '"swalCalls": []'],
  },
  {
    // K19 — تاریخ شمسی فیلد در preConfirm به میلادی تبدیل و در payload گذاشته می‌شود
    name: "K19.showCreateBookmarkModal-تبدیل-تاریخ",
    dom: FILLED,
    args: [],
    anchors: ['"due_date": "', '"post": 1', '"description": "یادآوری سفارش"'],
  },
  {
    // K20 — مشتری بدون نام ⇒ گزینهٔ «-»
    name: "K20.showCreateBookmarkModal-مشتری-بی‌نام",
    state: { customerRows: [{ id: 9 }] },
    dom: {},
    args: [],
    anchors: ['value="9" >-</option>', '"get": 1'],
  },
];

// ===== اجرا + اسنپ‌شات =====
const GOLDEN_URL = new URL(
  "../docs/dashboard-bookmarks-body-golden.json",
  import.meta.url,
);
const SNAPSHOT = process.argv.includes("--snapshot");
const DUMP = process.argv.includes("--dump");
const DUMP_URL = new URL("../.git/i-records.json", import.meta.url);
const dumpRecords = {};

const sha256 = (text) =>
  crypto.createHash("sha256").update(text, "utf8").digest("hex");

check(
  "متد هدف dashboardBookmarkMethods.showCreateBookmarkModal موجود است",
  typeof dashboardBookmarkMethods?.showCreateBookmarkModal === "function",
);

const captured = {};
// هشدارهای زمان‌بندی‌شدهٔ نود (مثل MODULE_TYPELESS_PACKAGE_JSON) پیش از ضبط بیرون بیایند
await new Promise((resolve) => setImmediate(resolve));
for (const testCase of cases) {
  store.clear();
  const record = await runCase(testCase);
  const text = recordText(record);
  const view = anchorView(text);
  captured[testCase.name] = {
    bytes: Buffer.byteLength(text, "utf8"),
    sha256: sha256(text),
  };
  if (DUMP) dumpRecords[testCase.name] = record;
  for (const anchor of testCase.anchors ?? []) {
    check(`${testCase.name} → انکر «${anchor}»`, view.includes(anchor));
  }
  for (const anchor of testCase.absent ?? []) {
    check(`${testCase.name} → غیبت «${anchor}»`, !view.includes(anchor));
  }
}

// ===== پیش‌نیاز پایداری: دو اجرای متوالی کِیس اول =====
const firstCase = cases[0];
store.clear();
const firstAgain = recordText(await runCase(firstCase));
check(
  "دو اجرای متوالی کِیس اول رکورد یکسان می‌دهند (تثبیت ساعت و استاب‌ها)",
  sha256(firstAgain) === captured[firstCase.name].sha256,
);

// ===== اسنپ‌شات طلایی =====
if (SNAPSHOT) {
  fs.writeFileSync(
    GOLDEN_URL,
    `${JSON.stringify(
      {
        note: "اسنپ‌شات رکورد متد غول بوکمارک‌های داشبورد (showCreateBookmarkModal)، گرفته‌شده پیش از موج برش بدنه (۳.۲i). هر کِیس = گزینه‌های Swal.fire (شامل html) + نتیجهٔ preConfirm + اثر didOpen + فراخوانی‌های API/اعلان/کنسول. بازتولید: npm run test:dashboard:bookmarks:body -- --snapshot",
        node: process.version,
        locale: Intl.NumberFormat().resolvedOptions().locale,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        frozenClockUtc: new Date(FROZEN_MS).toISOString(),
        source: "HEAD پیش از برش بدنه — git tag pre-bookmarks-body-split",
        note2:
          "خروجی به locale/ICU و منطقهٔ زمانی محیط Node وابسته است (تبدیل تاریخ شمسی در قالب مودال و payload)؛ هارنس ساعت را تثبیت و TZ را روی Asia/Tehran قفل می‌کند، پس مقایسه در همان محیطی معنا دارد که اسنپ‌شات گرفته شده است.",
        cases: captured,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  info(
    `اسنپ‌شات طلایی نوشته شد: docs/dashboard-bookmarks-body-golden.json (${Object.keys(captured).length} کِیس)`,
  );
} else if (!fs.existsSync(GOLDEN_URL)) {
  check(
    "اسنپ‌شات طلایی docs/dashboard-bookmarks-body-golden.json موجود است",
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

if (DUMP) {
  dumpRecords["ZZ-K1-rerun"] = JSON.parse(firstAgain);
  fs.writeFileSync(DUMP_URL, `${JSON.stringify(dumpRecords, null, 2)}\n`, "utf8");
  info(`رکورد کامل کِیس‌ها نوشته شد: .git/i-records.json (${Object.keys(dumpRecords).length} کِیس)`);
}

const failed = results.filter((ok) => !ok).length;
if (failed) {
  console.log(
    `\n❌ ${failed} بررسی از ${results.length} ناموفق — گارد برش بدنهٔ بوکمارک‌های داشبورد`,
  );
  process.exitCode = 1;
} else {
  console.log(
    `\n✅ هر ${results.length} بررسی موفق — خروجی showCreateBookmarkModal بایت‌به‌بایت پایدار است`,
  );
}





