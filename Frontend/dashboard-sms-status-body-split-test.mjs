// ============================================================
//  تست برابری بدنهٔ متد غول بروزرسانی وضعیت پیامک — گارد موج برش بدنه (۳.۲m)
//  اجرا:  npm run test:dashboard:sms-status:body                  (در پوشهٔ Frontend)
//         npm run test:dashboard:sms-status:body -- --snapshot    (بازتولید اسنپ‌شات طلایی)
// ------------------------------------------------------------
//  چرا؟ متد بزرگ زیر برش بدنه می‌خورد (کد از داخل متد به تابع‌های
//  ماژول‌محلی منتقل می‌شود) بدون تغییر یک بایت از خروجی:
//    dashboard.sms.js:750  dashboardSmsMethods.refreshSmsStatus   ۲۳۹ خط
//  (پس از موج ۳.۲m این متد ۸۸ خط است؛ عدد بالای این بلوک وضعیت «پیش از برش» را ثبت می‌کند.)
//  ⚠️ درس موج ۳.۲m: در نسخهٔ اول برش B، محتوای backtick تا «ابتدای خط بک‌تیک بستن» بریده شده بود
//     و ۱۰ فاصلهٔ تورفتگیِ بخشی-از-رشته حذف شد ⇒ خروجی ۱۰ بایت کوچک‌تر و ۱۶ بررسی قرمز شد.
//  (پیش از موج ۳.۲m) این متد بزرگ‌ترین متد مخزن بود و هیچ گارد بدنه‌ای نداشت؛
//  فقط `test:dashboard-surface` سطح ۷۸ عضو prototype را می‌سنجد.
//  متد در چهار حالت مختلف رفتار می‌کند و دو `return` زودهنگام دارد:
//    • بی‌صدا (`openModal=false`) ⇒ فقط بروزرسانی کارت‌ها
//    • «هیچ پیامکی برای بروزرسانی نیست» ⇒ اعلان info و بازگشت
//    • مسیر مودال (`Swal.fire` با قالب ~۴۴ خطی) + اعلان موفقیت
//    • مسیر خطا ⇒ بستن لودر + console.error + اعلان خطا
//  روش سنجش دو لایه است (هم‌سبک گارد بوکمارک‌های داشبورد/گزارش پیامک گله):
//    ۱) «انکر»های رفتاری: زیررشته‌های کلیدی رکورد زنده (PASS/FAIL).
//    ۲) «اسنپ‌شات طلایی»: sha256 رکورد JSON هر کِیس در
//       docs/dashboard-sms-status-body-golden.json (پیش از برش) ⇒ هر بایت تغییر، FAIL.
//  ⚠️ ساعت سیستم تثبیت شده است (کلوژر `formatDateTime` از `new Date` + `Intl fa-IR`
//     استفاده می‌کند) و TZ روی Asia/Tehran قفل است.
//  ⚠️ اگر عمداً رفتار تغییر کرد، اول:
//     npm run test:dashboard:sms-status:body -- --snapshot
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

// ---------- استاب مرورگر ----------
const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => (storage.has(key) ? storage.get(key) : null),
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
  clear: () => storage.clear(),
};
globalThis.window = globalThis.window || {
  location: { search: "", href: "http://localhost/", pathname: "/" },
  addEventListener() {},
  removeEventListener() {},
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  open: () => null,
};
globalThis.document = globalThis.document || {
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener() {},
  removeEventListener() {},
  createElement: () => ({
    style: {},
    classList: { add() {}, remove() {}, toggle() {} },
    appendChild() {},
    addEventListener() {},
  }),
  body: { appendChild() {}, style: {} },
};

// ---------- ضبط console ----------
const consoleErrors = [];
const consoleWarns = [];
const consoleError = console.error;
const consoleWarn = console.warn;
console.error = (...args) => consoleErrors.push(args.map(String).join(" "));
console.warn = (...args) => consoleWarns.push(args.map(String).join(" "));

const results = [];
const check = (name, ok, extra = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}${extra ? " :: " + extra : ""}`);
};
const info = (message) => console.log(`ℹ️  ${message}`);
const clone = (value) =>
  value === undefined ? null : JSON.parse(JSON.stringify(value));

// ---------- import ماژول واقعی ----------
const DOMAIN = "./src/features/dashboard/";
const { dashboardSmsMethods } = await import(`${DOMAIN}dashboard.sms.js`);
const { dashboardApi } = await import(`${DOMAIN}dashboard.api.js`);
const { notificationService } = await import("./src/core/services/notification.service.js");

// ---------- استاب Swal ----------
const calls = {
  api: {},
  swal: [],
  notifications: [],
  loader: { shown: 0, closed: 0 },
  host: { loadFlocks: 0, refreshAll: 0, getSmsStatusInfo: [] },
};
globalThis.Swal = {
  fire: (options) => {
    calls.swal.push({
      icon: options.icon ?? null,
      title: options.title ?? null,
      html: options.html ?? null,
      confirmButtonText: options.confirmButtonText ?? null,
      confirmButtonColor: options.confirmButtonColor ?? null,
      width: options.width ?? null,
    });
    return Promise.resolve({ isConfirmed: true });
  },
};

// ---------- میزبان سرویس (به‌جای DashboardService) ----------
const makeHost = (behavior = {}) => {
  const host = {
    ...dashboardSmsMethods,
    showSmsLoader: () => {
      calls.loader.shown++;
      return behavior.showSmsLoader === undefined ? true : behavior.showSmsLoader;
    },
    closeSmsLoader: () => {
      calls.loader.closed++;
    },
    loadFlocks: async () => {
      calls.host.loadFlocks++;
      if (behavior.loadFlocksThrows) throw new Error("loadFlocks failed");
    },
    refreshAllTaskSmsStatus: async () => {
      calls.host.refreshAll++;
      if (behavior.refreshThrows) throw new Error("refresh failed");
    },
    getSmsStatusInfo: (status) => {
      calls.host.getSmsStatusInfo.push(String(status));
      const map = {
        delivered: { text: "تحویل داده شده", color: "#16a34a" },
        failed: { text: "ناموفق", color: "#dc2626" },
        sent: { text: "ارسال شده", color: "#2563eb" },
        pending: { text: "در انتظار", color: "#d97706" },
      };
      return map[status] || { text: "نامشخص", color: "#64748b" };
    },
  };
  return host;
};

// ---------- فیکسچرها ----------
const makeRecord = (over = {}) => ({
  id: 1,
  message: "پیامک نمونه",
  status: "delivered",
  delivery_state: 1,
  scope: "flock",
  targetLabel: "گله ۱۲",
  roleLabel: "مدیر",
  flock_number: 12,
  week_number: 3,
  sent_at: "2026-06-14T06:00:00.000Z",
  delivered_at: "2026-06-14T06:05:00.000Z",
  sender: { first_name: "علی", last_name: "محمدی", username: "ali" },
  ...over,
});
const BODY_KEYS = [
  "showSmsLoader",
  "closeSmsLoader",
  "loadFlocks",
  "refreshAllTaskSmsStatus",
  "getSmsStatusInfo",
];

// ---------- رانر ----------
const runCase = async (testCase) => {
  calls.api = {};
  calls.swal = [];
  calls.notifications = [];
  calls.loader = { shown: 0, closed: 0 };
  calls.host = { loadFlocks: 0, refreshAll: 0, getSmsStatusInfo: [] };
  consoleErrors.length = 0;
  consoleWarns.length = 0;

  // پچ API
  const apiHandlers = testCase.api?.() ?? {};
  for (const name of ["updateSmsStatusForFlock", "getSmsHistory"]) {
    dashboardApi[name] = async (...args) => {
      const handler = apiHandlers[name];
      if (!calls.api[name]) calls.api[name] = [];
      calls.api[name].push({ args: clone(args) });
      if (!handler) return { success: true, data: [] };
      return await handler(...args);
    };
  }
  // پچ اعلان‌ها
  const notificationLog = (level) => (message) =>
    calls.notifications.push({ level, message: String(message) });
  notificationService.info = notificationLog("info");
  notificationService.success = notificationLog("success");
  notificationService.error = notificationLog("error");
  notificationService.warning = notificationLog("warning");

  const host = makeHost(testCase.behavior ?? {});
  const args = testCase.args();
  let returned = null;
  let thrown = null;
  try {
    returned = testCase.omitOpenModal
      ? await host.refreshSmsStatus(args.customerId, args.flockId, args.flockPeriodId)
      : await host.refreshSmsStatus(
          args.customerId,
          args.flockId,
          args.flockPeriodId,
          args.openModal,
        );
  } catch (error) {
    thrown = error?.constructor?.name ?? "Error";
  }
  return {
    method: "dashboardSmsMethods.refreshSmsStatus",
    api: calls.api,
    swal: calls.swal,
    notifications: calls.notifications,
    loader: calls.loader,
    host: calls.host,
    returned: returned === undefined ? null : clone(returned),
    thrown,
    consoleErrors: clone(consoleErrors),
    consoleWarns: clone(consoleWarns),
    bodyKeys: BODY_KEYS.join(","),
  };
};

// ---------- کِیس‌ها ----------
const cases = [
  {
    name: "M1.مودال-پایه-با-سه-پیامک",
    args: () => ({ customerId: 5, flockId: 71, flockPeriodId: 71, openModal: true }),
    api: () => ({
      updateSmsStatusForFlock: async () => ({ success: true, data: { total: 3, updated: 1 } }),
      getSmsHistory: async () => ({
        success: true,
        data: {
          messages: [
            makeRecord({ id: 1, status: "delivered", delivery_state: 1 }),
            makeRecord({ id: 2, status: "failed", delivery_state: 6 }),
            makeRecord({ id: 3, status: "pending", delivery_state: 0 }),
          ],
        },
      }),
    }),
    anchors: [
      "📱 بروزرسانی وضعیت پیامک‌ها",
      '"width": 1120',
      '"confirmButtonText": "باشه"',
      "3 پیامک بررسی شد",
      "1 پیامک به‌روزرسانی شد",
      "✅ وضعیت 3 پیامک بررسی و در دیتابیس ذخیره شد",
      '"shown": 1',
      '"closed": 1',
      '"loadFlocks": 1',
      '"refreshAll": 1',
      "ردیف",
      "متن پیام",
    ],
    extraChecks: [
      ["دقیقاً یک مودال", (r) => r.swal.length === 1],
      ["یک اعلان info و یک اعلان موفقیت", (r) =>
        r.notifications.length === 2 &&
        r.notifications.filter((n) => n.level === "success").length === 1 &&
        r.notifications.filter((n) => n.level === "info").length === 1],
      ["آرگومان‌های API درست", (r) =>
        JSON.stringify(r.api.updateSmsStatusForFlock[0].args) === "[5,71,71]" &&
        JSON.stringify(r.api.getSmsHistory[0].args) === "[5,71,71]"],
    ],
  },
  {
    name: "M2.بی‌صدا-بدون-مودال",
    args: () => ({ customerId: 5, flockId: 71, flockPeriodId: null, openModal: false }),
    api: () => ({
      updateSmsStatusForFlock: async () => ({ success: true, data: { total: 2, updated: 2 } }),
    }),
    anchors: ['"swal": []', '"notifications": []', '"shown": 0', '"closed": 0', '"loadFlocks": 1'],
    extraChecks: [["تاریخچه واکشی نمی‌شود", (r) => !r.api.getSmsHistory]],
  },
  {
    name: "M3.هیچ-پیامکی-برای-بروزرسانی-نیست",
    args: () => ({ customerId: 5, flockId: 71, flockPeriodId: 71, openModal: true }),
    api: () => ({
      updateSmsStatusForFlock: async () => ({ success: true, data: { total: 0, updated: 0 } }),
      getSmsHistory: async () => ({ success: true, data: { messages: [] } }),
    }),
    anchors: [
      "هیچ پیامکی برای بروزرسانی وضعیت وجود ندارد",
      '"swal": []',
      '"closed": 1',
    ],
    extraChecks: [["اعلان info", (r) => r.notifications.some((n) => n.level === "info")]],
  },
  {
    name: "M4.خطای-بروزرسانی-سمت-سرور",
    args: () => ({ customerId: 5, flockId: 71, flockPeriodId: 71, openModal: true }),
    api: () => ({
      updateSmsStatusForFlock: async () => {
        throw new Error("update failed");
      },
      getSmsHistory: async () => ({ success: true, data: [makeRecord()] }),
    }),
    anchors: ["✅ وضعیت پیامک‌ها بروزرسانی شد", "ردیف"],
    extraChecks: [
      ["هیچ خطایی بیرون نمی‌زند", (r) => r.thrown === null],
      ["تعداد از رکوردها گرفته می‌شود", (r) => r.swal[0].html.includes("1 پیامک بررسی شد")],
    ],
  },
  {
    name: "M5.خطای-واکشی-تاریخچه",
    args: () => ({ customerId: 5, flockId: 71, flockPeriodId: 71, openModal: true }),
    api: () => ({
      updateSmsStatusForFlock: async () => ({ success: true, data: { total: 4, updated: 2 } }),
      getSmsHistory: async () => {
        throw new Error("history failed");
      },
    }),
    anchors: ["4 پیامک بررسی شد", "2 پیامک به‌روزرسانی شد", "<tbody></tbody>"],
  },
  {
    name: "M6.history-success-false",
    args: () => ({ customerId: 5, flockId: 71, flockPeriodId: 71, openModal: true }),
    api: () => ({
      updateSmsStatusForFlock: async () => ({ success: false, data: { total: 1 } }),
      getSmsHistory: async () => ({ success: false, data: [makeRecord()] }),
    }),
    anchors: ["1 پیامک بررسی شد", "<tbody></tbody>"],
  },
  {
    name: "M7.data-آرایهٔ-مستقیم",
    args: () => ({ customerId: 5, flockId: 71, flockPeriodId: 71, openModal: true }),
    api: () => ({
      updateSmsStatusForFlock: async () => ({ success: true, data: { total: 1, updated: 0 } }),
      getSmsHistory: async () => ({ success: true, data: [makeRecord({ message: "پیام مستقیم" })] }),
    }),
    anchors: ["پیام مستقیم", "ردیف"],
  },
  {
    name: "M8.Swal-غایب",
    args: () => ({ customerId: 5, flockId: 71, flockPeriodId: 71, openModal: true }),
    removeSwal: true,
    api: () => ({
      updateSmsStatusForFlock: async () => ({ success: true, data: { total: 2, updated: 1 } }),
      getSmsHistory: async () => ({ success: true, data: { messages: [makeRecord()] } }),
    }),
    anchors: ['"swal": []', "✅ وضعیت 2 پیامک بررسی و در دیتابیس ذخیره شد", '"closed": 1'],
  },
  {
    name: "M9.لودر-نشان-داده-نشده",
    behavior: { showSmsLoader: false },
    args: () => ({ customerId: 5, flockId: 71, flockPeriodId: 71, openModal: true }),
    api: () => ({
      updateSmsStatusForFlock: async () => ({ success: true, data: { total: 1, updated: 0 } }),
      getSmsHistory: async () => ({ success: true, data: { messages: [makeRecord()] } }),
    }),
    anchors: ['"shown": 1', '"closed": 0', '"width": 1120'],
  },
  {
    name: "M10.وضعیت‌های-تحویل-مرزی",
    args: () => ({ customerId: 5, flockId: 71, flockPeriodId: 71, openModal: true }),
    api: () => ({
      updateSmsStatusForFlock: async () => ({ success: true, data: { total: 8, updated: 0 } }),
      getSmsHistory: async () => ({
        success: true,
        data: {
          messages: [
            makeRecord({ id: 1, delivery_state: 0 }),
            makeRecord({ id: 2, delivery_state: 2 }),
            makeRecord({ id: 3, delivery_state: 3 }),
            makeRecord({ id: 4, delivery_state: 4 }),
            makeRecord({ id: 5, delivery_state: 5 }),
            makeRecord({ id: 6, delivery_state: 7 }),
            makeRecord({ id: 7, delivery_state: 8 }),
            makeRecord({ id: 8, delivery_state: null }),
          ],
        },
      }),
    }),
    anchors: [
      "در صف ارسال",
      "نرسیده به گوشی",
      "پردازش در مخابرات",
      "نرسیده به مخابرات",
      "لیست سیاه",
      "</span>\n              </td>",
    ],
  },
  {
    name: "M11.وضعیت-ناشناخته-در-ردیف",
    args: () => ({ customerId: 5, flockId: 71, flockPeriodId: 71, openModal: true }),
    api: () => ({
      updateSmsStatusForFlock: async () => ({ success: true, data: { total: 1, updated: 0 } }),
      getSmsHistory: async () => ({
        success: true,
        data: { messages: [makeRecord({ status: "weird", delivery_state: 99 })] },
      }),
    }),
    anchors: ["نامشخص", "در انتظار"],
    extraChecks: [
      ["getSmsStatusInfo با وضعیت خام صدا زده می‌شود", (r) =>
        JSON.stringify(r.host.getSmsStatusInfo) === '["weird"]'],
    ],
  },
  {
    name: "M12.دامنهٔ-سالن-و-گله",
    args: () => ({ customerId: 5, flockId: 71, flockPeriodId: 71, openModal: true }),
    api: () => ({
      updateSmsStatusForFlock: async () => ({ success: true, data: { total: 2, updated: 0 } }),
      getSmsHistory: async () => ({
        success: true,
        data: {
          messages: [
            makeRecord({ id: 1, scope: "hall" }),
            makeRecord({ id: 2, scope: "other" }),
          ],
        },
      }),
    }),
    anchors: [">سالن</span>", ">کل گله</span>", "#eff6ff", "#ecfdf5"],
  },
  {
    name: "M13.شمارهٔ-گله-و-هفته-تودرتو",
    args: () => ({ customerId: 5, flockId: 71, flockPeriodId: 71, openModal: true }),
    api: () => ({
      updateSmsStatusForFlock: async () => ({ success: true, data: { total: 2, updated: 0 } }),
      getSmsHistory: async () => ({
        success: true,
        data: {
          messages: [
            makeRecord({ id: 1, flock_number: 12, week_number: 3 }),
            makeRecord({ id: 2, flock_number: null, week_number: null }),
          ],
        },
      }),
    }),
    anchors: ["گله 12 | هفته 3"],
    extraChecks: [
      ["ردیف بدون گله، بلوک تودرتو ندارد", (r) =>
        (r.swal[0].html.match(/گله 12/g) || []).length === 1],
    ],
  },
  {
    name: "M14.تاریخ‌های-نامعتبر",
    args: () => ({ customerId: 5, flockId: 71, flockPeriodId: 71, openModal: true }),
    api: () => ({
      updateSmsStatusForFlock: async () => ({ success: true, data: { total: 1, updated: 0 } }),
      getSmsHistory: async () => ({
        success: true,
        data: {
          messages: [
            makeRecord({
              id: 1,
              sent_at: "not-a-date",
              delivered_at: "2026-06-14T06:05:00.000Z",
            }),
          ],
        },
      }),
    }),
    anchors: ["-</td>"],
    extraChecks: [
      // شاخهٔ معتبر با Intl در کِیس M1 هش‌قفل است؛ اینجا فقط «تاریخ نامعتبر ⇒ خط تیره»
      // و «شاخهٔ catch نباید خطا پرت کند» بررسی می‌شود.
      ["تاریخ نامعتبر خط تیره می‌شود و خطایی پرت نمی‌شود", (r) =>
        r.thrown === null && (r.swal[0].html.match(/>-<\/td>/g) || []).length === 1],
    ],
  },
  {
    name: "M15.پیام-خالی-و-برچسپ‌های-جایگزین",
    args: () => ({ customerId: 5, flockId: 71, flockPeriodId: 71, openModal: true }),
    api: () => ({
      updateSmsStatusForFlock: async () => ({ success: true, data: { total: 1, updated: 0 } }),
      getSmsHistory: async () => ({
        success: true,
        data: {
          messages: [
            makeRecord({
              message: null,
              targetLabel: null,
              target_title: "عنوان جایگزین",
              roleLabel: null,
            }),
          ],
        },
      }),
    }),
    anchors: ["عنوان جایگزین", ">—</div>"],
  },
  {
    name: "M16.شمارنده‌های-خلاصه",
    args: () => ({ customerId: 5, flockId: 71, flockPeriodId: 71, openModal: true }),
    api: () => ({
      updateSmsStatusForFlock: async () => ({ success: true, data: { total: 4, updated: 0 } }),
      getSmsHistory: async () => ({
        success: true,
        data: {
          messages: [
            makeRecord({ id: 1, status: "delivered", delivery_state: 1 }),
            makeRecord({ id: 2, status: "delivered", delivery_state: 1 }),
            makeRecord({ id: 3, status: "failed", delivery_state: 6 }),
            makeRecord({ id: 4, status: "pending", delivery_state: null }),
          ],
        },
      }),
    }),
    anchors: [
      "color:var(--success-strong, #16a34a);\">2</div>",
      "color:var(--danger, #dc2626);\">1</div>",
      "color:var(--warning-deep-2, #d97706);\">1</div>",
    ],
  },
  {
    name: "M17.فرستنده‌های-مختلف",
    args: () => ({ customerId: 5, flockId: 71, flockPeriodId: 71, openModal: true }),
    api: () => ({
      updateSmsStatusForFlock: async () => ({ success: true, data: { total: 3, updated: 0 } }),
      getSmsHistory: async () => ({
        success: true,
        data: {
          messages: [
            makeRecord({ id: 1, sender: null }),
            makeRecord({ id: 2, sender: { first_name: "", last_name: "", username: "u1" } }),
            makeRecord({ id: 3, sender: { first_name: "علی", last_name: "محمدی" } }),
          ],
        },
      }),
    }),
    anchors: [
      ">کاربر سیستم</td>",
      ">u1</td>",
      ">علی محمدی</td>",
    ],
  },
  {
    name: "M18.خطای-میزبان-مسیر-catch",
    behavior: { loadFlocksThrows: true },
    args: () => ({ customerId: 5, flockId: 71, flockPeriodId: 71, openModal: true }),
    api: () => ({
      updateSmsStatusForFlock: async () => ({ success: true, data: { total: 1, updated: 0 } }),
      getSmsHistory: async () => ({ success: true, data: { messages: [makeRecord()] } }),
    }),
    anchors: [
      '"level": "error"',
      "❌ Error refreshing SMS status:",
      '"closed": 1',
      '\"swal\": []',
    ],
    extraChecks: [
      ["خطا بیرون نمی‌زند", (r) => r.thrown === null],
      ["console.error ثبت شد", (r) => r.consoleErrors.length === 1],
    ],
  },
  {
    name: "M19.حالت-بی‌صدا-با-خطای-refresh",
    behavior: { refreshThrows: true },
    args: () => ({ customerId: 5, flockId: 71, flockPeriodId: null, openModal: false }),
    api: () => ({
      updateSmsStatusForFlock: async () => ({ success: true, data: { total: 1, updated: 1 } }),
    }),
    anchors: ['"level": "error"', '"loadFlocks": 1', '"swal": []'],
  },
  {
    name: "M20.openModal-پیش‌فرض",
    omitOpenModal: true,
    args: () => ({ customerId: 5, flockId: 71, flockPeriodId: null }),
    api: () => ({
      updateSmsStatusForFlock: async () => ({ success: true, data: { total: 1, updated: 0 } }),
      getSmsHistory: async () => ({ success: true, data: { messages: [makeRecord()] } }),
    }),
    anchors: ['"width": 1120', '"shown": 1'],
    extraChecks: [
      ["آرگومان‌ها با null پر می‌شوند", (r) =>
        JSON.stringify(r.api.updateSmsStatusForFlock[0].args) === "[5,71,null]"],
    ],
  },
  {
    name: "M21.delivery_state-خالی-رشته‌ای",
    args: () => ({ customerId: 5, flockId: 71, flockPeriodId: 71, openModal: true }),
    api: () => ({
      updateSmsStatusForFlock: async () => ({ success: true, data: { total: 2, updated: 0 } }),
      getSmsHistory: async () => ({
        success: true,
        data: {
          messages: [
            makeRecord({ id: 1, delivery_state: "" }),
            makeRecord({ id: 2, delivery_state: "5" }),
          ],
        },
      }),
    }),
    anchors: ["رسیده به مخابرات", ">-</span>"],
  },
  {
    name: "M22.بدون-هیچ-آرگومانی-خطای-مرزی",
    args: () => ({ customerId: undefined, flockId: undefined, flockPeriodId: undefined, openModal: true }),
    api: () => ({
      updateSmsStatusForFlock: async () => ({ success: true, data: { total: 0, updated: 0 } }),
      getSmsHistory: async () => ({ success: true, data: { messages: [] } }),
    }),
    anchors: ["هیچ پیامکی برای بروزرسانی وضعیت وجود ندارد", '"thrown": null'],
  },
];

// ===== اجرا: انکرهای رفتاری + هش sha256 هر کِیس =====
const GOLDEN_URL = new URL("../docs/dashboard-sms-status-body-golden.json", import.meta.url);
const SNAPSHOT = process.argv.includes("--snapshot");
const sha256 = (text) =>
  crypto.createHash("sha256").update(text, "utf8").digest("hex");
const recordText = (record) => JSON.stringify(record, null, 2);
const anchorView = (text) =>
  text + "\n" + text.replace(/\\"/g, '"').replace(/\\n/g, "\n");

check(
  "متد هدف dashboardSmsMethods.refreshSmsStatus موجود است",
  typeof dashboardSmsMethods?.refreshSmsStatus === "function",
);
check(
  "میزبان جعلی همهٔ ۵ متد سرویس مصرفی متد را دارد",
  BODY_KEYS.every((name) => typeof makeHost()[name] === "function"),
);

// ⚠️ هشدار آسنکرون Node بیرون از ضبط بماند (تلهٔ موج ۳.۲i).
await new Promise((resolve) => setImmediate(resolve));

const captured = {};
const caseRecords = [];
const realSwal = globalThis.Swal;
for (const testCase of cases) {
  if (testCase.removeSwal) delete globalThis.Swal;
  const record = await runCase(testCase);
  if (testCase.removeSwal) globalThis.Swal = realSwal;
  caseRecords.push({ name: testCase.name, thrown: record.thrown, swal: record.swal.length });
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
  for (const [label, predicate] of testCase.extraChecks ?? []) {
    check(`${testCase.name} → ${label}`, Boolean(predicate(record)));
  }
}

check(
  "هیچ کِیسی خطای بیرون‌زده ندارد (همه در try/catch متد مهار شده‌اند)",
  caseRecords.every((r) => r.thrown === null),
  caseRecords
    .filter((r) => r.thrown !== null)
    .map((r) => r.name)
    .join(","),
);

// ===== پایداری: دو اجرای متوالی کِیس اول =====
const firstCase = cases[0];
const firstAgain = recordText(await runCase(firstCase));
check(
  "دو اجرای متوالی کِیس اول رکورد یکسان می‌دهند (تثبیت ساعت)",
  sha256(firstAgain) === captured[firstCase.name].sha256,
);

// ===== اسنپ‌شات طلایی =====
if (SNAPSHOT) {
  fs.writeFileSync(
    GOLDEN_URL,
    `${JSON.stringify(
      {
        note: "اسنپ‌شات رکورد ساختاری متد غول بروزرسانی وضعیت پیامک (dashboardSmsMethods.refreshSmsStatus)، گرفته‌شده پیش از موج برش بدنه (۳.۲m). هر کِیس = رکورد JSON شامل فراخوانی‌های API (با آرگومان‌ها)، گزینه‌های Swal.fire (با html قالب ~۴۴ خطی)، اعلان‌ها، وضعیت لودر و فراخوانی‌های میزبان سرویس. بازتولید: npm run test:dashboard:sms-status:body -- --snapshot",
        node: process.version,
        locale: Intl.NumberFormat().resolvedOptions().locale,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        frozenClockUtc: new Date(FROZEN_MS).toISOString(),
        source: "HEAD پیش از برش بدنه — git tag pre-sms-status-body-split",
        note2:
          "خروجی به locale/ICU و منطقهٔ زمانی محیط Node وابسته است (کلوژر formatDateTime از Intl fa-IR استفاده می‌کند)؛ هارنس ساعت را تثبیت و TZ را روی Asia/Tehran قفل می‌کند.",
        cases: captured,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  info(
    `اسنپ‌شات طلایی نوشته شد: docs/dashboard-sms-status-body-golden.json (${Object.keys(captured).length} کِیس)`,
  );
} else if (!fs.existsSync(GOLDEN_URL)) {
  check("اسنپ‌شات طلایی docs/dashboard-sms-status-body-golden.json موجود است", false, "با --snapshot بساز");
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
      !!expected && expected.sha256 === digest.sha256 && expected.bytes === digest.bytes,
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
  console.log(`\n❌ ${failed} بررسی از ${results.length} ناموفق — گارد برش بدنهٔ بروزرسانی وضعیت پیامک`);
  process.exitCode = 1;
} else {
  console.log(`\n✅ هر ${results.length} بررسی موفق — رفتار متد بایت‌به‌بایت پایدار است`);
}
