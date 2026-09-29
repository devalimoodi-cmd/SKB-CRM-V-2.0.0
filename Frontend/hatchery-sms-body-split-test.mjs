// ============================================================
//  تست برابری بدنهٔ متد غول گزارش پیامک گله — گارد موج برش بدنه (۳.۲j)
//  اجرا:  npm run test:hatchery:sms-body                  (در پوشهٔ Frontend)
//         npm run test:hatchery:sms-body -- --snapshot    (بازتولید اسنپ‌شات طلایی)
// ------------------------------------------------------------
//  چرا؟ متد بزرگ زیر برش بدنه می‌خورد (کد از داخل متد به تابع‌های
//  ماژول‌محلی منتقل می‌شود) بدون تغییر یک بایت از خروجی:
//    hatchery.report.js:579  HatcheryReport#buildFlockSmsReportHTML   ۲۷۷ خط
//  (پس از موج ۳.۲j این متد ۱۲۱ خط است؛ عدد بالا وضعیت «پیش از برش» را ثبت می‌کند.)
//  هیچ تستی این متد را اجرا نمی‌کرد؛ ورودی‌هایش (customer, flock, logs) صریح‌اند
//  و خروجی‌اش یک سند HTML کاملِ قابلِ چاپ است.
//  روش سنجش دو لایه است (هم‌سبک گاردهای هفتگی/سالن/پایان دوره):
//    ۱) «انکر»های رفتاری: زیررشته‌های کلیدی سند HTML زنده (PASS/FAIL).
//    ۲) «اسنپ‌شات طلایی»: sha256 رکورد JSON هر کِیس در
//       docs/hatchery-sms-body-golden.json (پیش از برش) ⇒ هر بایت تغییر، FAIL.
//  ⚠️ ساعت سیستم تثبیت شده است (`new Date()` داخل متد) و TZ روی Asia/Tehran قفل است.
//  ⚠️ خروجی به locale/ICU محیط Node وابسته است (ارقام فارسیِ toLocaleString و
//     Intl.DateTimeFormat("fa-IR") در تاریخ/ساعت گزارش).
//  ⚠️ در مرورگر، persianDate (افزونهٔ تقویم شمسی) سراسری تعریف می‌شود و
//     convertToPersianDate از آن استفاده می‌کند؛ در Node تعریف نشده است، پس
//     مسیر fallback یعنی Intl اجرا می‌شود. هارنس این پیش‌فرض را صریح بررسی می‌کند
//     تا اگر روزی کسی persianDate را سراسری کرد، اسنپ‌شات بی‌صدا عوض نشود.
//  ⚠️ اگر عمداً رفتار تغییر کرد، اول:
//     npm run test:hatchery:sms-body -- --snapshot
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

// ---------- استاب‌های مرورگر (قبل از import ماژول‌ها) ----------
const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => (storage.has(key) ? storage.get(key) : null),
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
  clear: () => storage.clear(),
  key: () => null,
  length: 0,
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
const makeEl = () => ({
  value: "",
  checked: false,
  textContent: "",
  innerHTML: "",
  style: {},
  dataset: {},
  disabled: false,
  classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
  addEventListener() {},
  removeEventListener() {},
  querySelector: () => null,
  querySelectorAll: () => [],
});
globalThis.document = globalThis.document || {
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener() {},
  removeEventListener() {},
  createElement: () => makeEl(),
  body: makeEl(),
};
const $ = () => ({});
$.fn = {};
globalThis.$ = globalThis.$ || $;

// ---------- ضبط console (پیام‌های داخلی متد بخشی از رکورد می‌شوند) ----------
const consoleErrors = [];
const consoleWarns = [];
const consoleLogs = [];
const consoleError = console.error;
const consoleWarn = console.warn;
const consoleLog = console.log;
console.error = (...args) => consoleErrors.push(args.map(String).join(" "));
console.warn = (...args) => consoleWarns.push(args.map(String).join(" "));
console.log = (...args) => consoleLogs.push(args.map(String).join(" "));

const results = [];
// console.log داخل متد ضبط می‌شود، پس چاپ نتیجهٔ بررسی‌ها با نسخهٔ اصلی انجام می‌شود.
const check = (name, ok, extra = "") => {
  results.push(ok);
  consoleLog(`${ok ? "PASS" : "FAIL"} - ${name}${extra ? " :: " + extra : ""}`);
};
const info = (message) => consoleLog(`ℹ️  ${message}`);

const clone = (value) =>
  value === undefined ? null : JSON.parse(JSON.stringify(value));

// ---------- import ماژول واقعی ----------
const REPORT_MODULE =
  "./src/features/customer-info/sections/hatchery/hatchery.report.js";
const { hatcheryReport } = await import(REPORT_MODULE);

// ---------- فیکسچرها ----------
const makeCustomer = (over = {}) => ({
  id: 5,
  full_name: "مشتری نمونه",
  farm_name: "فارم نمونه",
  mobile_number: "09120000000",
  province: "تهران",
  ...over,
});
const makeFlock = (over = {}) => ({
  id: 71,
  flock_number: 12,
  unit: { unit_name: "واحد شمال" },
  unit_name: null,
  placement_date: "2026-05-01",
  placements: [
    { id: 1, hall_id: 3, hall: { hall_name: "سالن ۳" } },
    { id: 2, hall_id: 3, hall: { hall_name: "سالن ۳" } },
    { id: 3, hall_id: 4, Hall: { hall_name: "سالن ۴" } },
  ],
  ...over,
});
const makeLog = (over = {}) => ({
  id: 1,
  message: "پیامک نمونه",
  status: "delivered",
  delivery_state: 1,
  scope: "flock",
  targetLabel: "گله ۱۲",
  roleLabel: "مدیر",
  sent_at: "2026-06-14T06:00:00.000Z",
  delivered_at: "2026-06-14T06:05:00.000Z",
  sender: { first_name: "علی", last_name: "محمدی", username: "ali" },
  ...over,
});
const FULL_USER = {
  fullName: "مدیر نمونه",
  first_name: "مدیر",
  last_name: "نمونه",
  username: "manager",
  role: "admin",
};
const setUser = (user) => {
  if (user === null || user === undefined) {
    storage.delete("user");
    return;
  }
  storage.set("user", JSON.stringify(user));
};
const resetCapture = () => {
  consoleErrors.length = 0;
  consoleWarns.length = 0;
  consoleLogs.length = 0;
};

// ---------- رکورد یکسان برای همهٔ کِیس‌ها ----------
const buildRecord = ({ customer, flock, logs }) => {
  let html = null;
  let thrown = null;
  try {
    html = hatcheryReport.buildFlockSmsReportHTML(customer, flock, logs);
  } catch (error) {
    // نام کلاس خطا (نه متن پیام) تا اسنپ‌شات به نسخهٔ Node وابسته نشود.
    thrown = error?.constructor?.name ?? "Error";
  }
  return {
    method: "HatcheryReport#buildFlockSmsReportHTML",
    logsLength: Array.isArray(logs) ? logs.length : null,
    html,
    thrown,
    consoleErrors: clone(consoleErrors),
    consoleWarns: clone(consoleWarns),
  };
};
const runCase = (fixture) => {
  resetCapture();
  return buildRecord(fixture);
};

// ---------- کِیس‌ها ----------
// هر کِیس: fixture ورودی + انکرهای اجباری سند HTML + انکرهای «باید نباشد»
const cases = [
  {
    name: "J1.گزارش-کامل-تک‌پیامک",
    setup: () => setUser(FULL_USER),
    fixture: () => ({ customer: makeCustomer(), flock: makeFlock(), logs: [makeLog()] }),
    anchors: [
      "📱 گزارش پیامک‌های ارسالی گله 12",
      "<strong>نام مشتری:</strong> مشتری نمونه",
      "<strong>نام فارم:</strong> فارم نمونه",
      "<strong>سالن‌های عضو:</strong> سالن ۳، سالن ۴",
      "<strong>واحد:</strong> واحد شمال",
      '<span class="sms-chip chip-flock">کل گله</span>',
      "✅ رسیده به گوشی",
      "status-delivered",
      "علی محمدی",
      "📌 دریافت گزارش توسط: <strong>مدیر نمونه</strong> (مدیر)",
      '"logsLength": 1',
      '"thrown": null',
      'class="stat-value">۱</div>',
    ],
  },
  {
    name: "J2.بدون-پیامک-آرایهٔ-خالی",
    setup: () => setUser(FULL_USER),
    fixture: () => ({ customer: makeCustomer(), flock: makeFlock(), logs: [] }),
    anchors: [
      'پیامکی برای این گله ثبت نشده است',
      'colspan="10" class="sms-empty"',
      '"logsLength": 0',
      'class="stat-value">۰</div>',
    ],
    absent: ["sms-chip chip-flock"],
  },
  {
    name: "J3.logs-null-پرتاب-خطا",
    setup: () => setUser(FULL_USER),
    fixture: () => ({ customer: makeCustomer(), flock: makeFlock(), logs: null }),
    anchors: ['"thrown": "TypeError"', '"html": null', '"logsLength": null'],
  },
  {
    name: "J4.چهار-پیامک-با-وضعیت‌های-مختلف",
    setup: () => setUser(FULL_USER),
    fixture: () => ({
      customer: makeCustomer(),
      flock: makeFlock(),
      logs: [
        makeLog({ id: 1, status: "delivered", delivery_state: 1 }),
        makeLog({ id: 2, status: "sent", delivery_state: 5 }),
        makeLog({ id: 3, status: "pending", delivery_state: 0 }),
        makeLog({ id: 4, status: "failed", delivery_state: 6 }),
      ],
    }),
    anchors: [
      "status-delivered",
      "status-sent",
      "status-pending",
      "status-failed",
      "✅ رسیده به گوشی",
      "📡 رسیده به مخابرات",
      "⏳ در صف ارسال",
      "❌ خطا",
      '"logsLength": 4',
      'class="stat-value">۴</div>',
    ],
  },
  {
    name: "J5.delivery_state-نامعتبر",
    setup: () => setUser(FULL_USER),
    fixture: () => ({
      customer: makeCustomer(),
      flock: makeFlock(),
      logs: [
        makeLog({ id: 1, delivery_state: 99 }),
        makeLog({ id: 2, delivery_state: null }),
        makeLog({ id: 3, delivery_state: "" }),
        makeLog({ id: 4, delivery_state: "abc" }),
        makeLog({ id: 5, delivery_state: 7 }),
      ],
    }),
    anchors: [
      "نامشخص",
      "لیست سیاه",
      'class="sms-delivery">-</td>',
      '"logsLength": 5',
    ],
  },
  {
    name: "J6.scope-سالن-و-ناشناخته",
    setup: () => setUser(FULL_USER),
    fixture: () => ({
      customer: makeCustomer(),
      flock: makeFlock(),
      logs: [
        makeLog({ id: 1, scope: "hall" }),
        makeLog({ id: 2, scope: "other" }),
      ],
    }),
    anchors: [
      '<span class="sms-chip chip-hall">سالن</span>',
      '<span class="sms-chip chip-flock">کل گله</span>',
    ],
  },
  {
    name: "J7.تاریخ-ارسال-نامعتبر-شاخهٔ-catch",
    setup: () => setUser(FULL_USER),
    fixture: () => ({
      customer: makeCustomer(),
      flock: makeFlock(),
      logs: [makeLog({ sent_at: "not-a-date" })],
    }),
    anchors: [
      '<span class="dt-d">—</span><span class="dt-t"></span>',
      '"consoleErrors": []',
    ],
  },
  {
    name: "J8.تاریخ-تحویل-خالی",
    setup: () => setUser(FULL_USER),
    fixture: () => ({
      customer: makeCustomer(),
      flock: makeFlock(),
      logs: [makeLog({ delivered_at: null })],
    }),
    anchors: ['<span class="dt-d">—</span><span class="dt-t"></span>'],
  },
  {
    name: "J9.اسکیپ-HTML-در-پیام-و-هدف",
    setup: () => setUser(FULL_USER),
    fixture: () => ({
      customer: makeCustomer(),
      flock: makeFlock(),
      logs: [makeLog({ message: '<b>x</b> & "y"', targetLabel: "a<b>" })],
    }),
    anchors: [
      "&lt;b&gt;x&lt;/b&gt; &amp; &quot;y&quot;",
      'class="sms-target">a&lt;b&gt;</td>',
    ],
  },
  {
    name: "J10.فرستندهٔ-غایب",
    setup: () => setUser(FULL_USER),
    fixture: () => ({
      customer: makeCustomer(),
      flock: makeFlock(),
      logs: [makeLog({ sender: null })],
    }),
    anchors: ["کاربر سیستم", 'class="sms-sender">کاربر سیستم</td>'],
  },
  {
    name: "J11.فرستنده-بدون-نام-با-یوزرنیم",
    setup: () => setUser(FULL_USER),
    fixture: () => ({
      customer: makeCustomer(),
      flock: makeFlock(),
      logs: [
        makeLog({ sender: { first_name: "", last_name: "", username: "u1" } }),
      ],
    }),
    anchors: ['class="sms-sender">u1</td>'],
  },
  {
    name: "J12.کاربر-بدون-localStorage-کاربر-ناشناس",
    setup: () => setUser(null),
    fixture: () => ({ customer: makeCustomer(), flock: makeFlock(), logs: [makeLog()] }),
    anchors: [
      "دریافت گزارش توسط: <strong>کاربر ناشناس</strong> (کاربر)",
    ],
  },
  {
    name: "J13.کاربر-با-fullName-نقش-کارشناس",
    setup: () =>
      setUser({ fullName: "فارغ‌التحصیل نمونه", username: "e1", role: "expert" }),
    fixture: () => ({ customer: makeCustomer(), flock: makeFlock(), logs: [makeLog()] }),
    anchors: ["<strong>فارغ‌التحصیل نمونه</strong> (کارشناس)"],
  },
  {
    name: "J14.کاربر-با-نام-و-فامیل",
    setup: () =>
      setUser({ first_name: "مریم", last_name: "رضایی", role: "sub_admin" }),
    fixture: () => ({ customer: makeCustomer(), flock: makeFlock(), logs: [makeLog()] }),
    anchors: ["<strong>مریم رضایی</strong> (مدیر میانی)"],
  },
  {
    name: "J15.کاربر-فقط-یوزرنیم-نقش-ناشناس",
    setup: () => setUser({ username: "u9", role: "ghost" }),
    fixture: () => ({ customer: makeCustomer(), flock: makeFlock(), logs: [makeLog()] }),
    anchors: ["<strong>u9</strong> (کاربر)"],
  },
  {
    name: "J16.شماره-گله-غایب",
    setup: () => setUser(FULL_USER),
    fixture: () => ({
      customer: makeCustomer(),
      flock: makeFlock({ flock_number: null }),
      logs: [makeLog()],
    }),
    anchors: [
      "📱 گزارش پیامک‌های ارسالی گله ",
      "<strong>شماره گله:</strong> -",
    ],
  },
  {
    name: "J17.واحد-از-unit_name",
    setup: () => setUser(FULL_USER),
    fixture: () => ({
      customer: makeCustomer(),
      flock: makeFlock({ unit: null, unit_name: "واحد ۷" }),
      logs: [makeLog()],
    }),
    anchors: ["<strong>واحد:</strong> واحد ۷"],
  },
  {
    name: "J18.سالن-فقط-با-hall_id",
    setup: () => setUser(FULL_USER),
    fixture: () => ({
      customer: makeCustomer(),
      flock: makeFlock({
        placements: [{ id: 1, hall_id: 9, hall: null, Hall: null }],
      }),
      logs: [makeLog()],
    }),
    anchors: ["<strong>سالن‌های عضو:</strong> سالن 9"],
  },
  {
    name: "J19.بدون-سالن-عضو",
    setup: () => setUser(FULL_USER),
    fixture: () => ({
      customer: makeCustomer(),
      flock: makeFlock({ placements: [] }),
      logs: [makeLog()],
    }),
    anchors: ["<strong>سالن‌های عضو:</strong> -"],
  },
  {
    name: "J20.بدون-تاریخ-جوجه‌ریزی",
    setup: () => setUser(FULL_USER),
    fixture: () => ({
      customer: makeCustomer(),
      flock: makeFlock({ placement_date: null }),
      logs: [makeLog()],
    }),
    anchors: ["<strong>تاریخ جوجه‌ریزی:</strong> -"],
  },
  {
    name: "J21.مشتری-null",
    setup: () => setUser(FULL_USER),
    fixture: () => ({ customer: null, flock: makeFlock(), logs: [makeLog()] }),
    anchors: [
      "<strong>نام مشتری:</strong> -",
      "<strong>نام فارم:</strong> -",
      "<strong>موبایل:</strong> -",
      "<strong>استان:</strong> -",
    ],
  },
  {
    name: "J22.وضعیت-ناشناخته-در-ردیف",
    setup: () => setUser(FULL_USER),
    fixture: () => ({
      customer: makeCustomer(),
      flock: makeFlock(),
      logs: [makeLog({ status: "weird" })],
    }),
    anchors: ["status-pending", ">در انتظار</span>"],
  },
];

// ===== اجرا: انکرهای رفتاری + هش sha256 هر کِیس =====
const GOLDEN_URL = new URL("../docs/hatchery-sms-body-golden.json", import.meta.url);
const SNAPSHOT = process.argv.includes("--snapshot");
const sha256 = (text) =>
  crypto.createHash("sha256").update(text, "utf8").digest("hex");
// رکورد با تورفتگی می‌شود تا انکرها خوانا باشند؛ برای انکرهای درون‌HTML
// (که در JSON با \" فرار می‌کنند) نسخهٔ «رمزگشایی‌شده» هم در نظر گرفته می‌شود.
const recordText = (record) => JSON.stringify(record, null, 2);
const anchorView = (text) =>
  text + "\n" + text.replace(/\\"/g, '"').replace(/\\n/g, "\n");

check(
  "متد هدف hatcheryReport.buildFlockSmsReportHTML موجود است",
  typeof hatcheryReport?.buildFlockSmsReportHTML === "function",
);
check(
  "persianDate سراسری تعریف نشده است (مسیر fallback یعنی Intl قفل می‌شود)",
  typeof globalThis.persianDate === "undefined",
  typeof globalThis.persianDate,
);

// ⚠️ هشدار آسنکرون Node (MODULE_TYPELESS_PACKAGE_JSON) بیرون از ضبط بماند تا
// رکورد کِیس اول با هشدار نخست آلوده نشود (تلهٔ موج ۳.۲i).
await new Promise((resolve) => setImmediate(resolve));

const captured = {};
for (const testCase of cases) {
  testCase.setup?.();
  const record = runCase(testCase.fixture());
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
firstCase.setup?.();
const firstAgain = recordText(runCase(firstCase.fixture()));
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
        note: "اسنپ‌شات رکورد ساختاری متد غول گزارش پیامک گله (HatcheryReport#buildFlockSmsReportHTML)، گرفته‌شده پیش از موج برش بدنه (۳.۲j). هر کِیس = رکورد JSON شامل سند HTML کامل ({ html, thrown, logsLength, consoleErrors, consoleWarns }). بازتولید: npm run test:hatchery:sms-body -- --snapshot",
        node: process.version,
        locale: Intl.NumberFormat().resolvedOptions().locale,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        frozenClockUtc: new Date(FROZEN_MS).toISOString(),
        source: "HEAD پیش از برش بدنه — git tag pre-hatchery-sms-body-split",
        note2:
          "خروجی به locale/ICU و منطقهٔ زمانی محیط Node وابسته است (ارقام فارسی و تاریخ/ساعت شمسی در سند)؛ هارنس ساعت را تثبیت و TZ را روی Asia/Tehran قفل می‌کند، پس مقایسه فقط در همان محیطی معنا دارد که اسنپ‌شات گرفته شده است.",
        cases: captured,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  info(
    `اسنپ‌شات طلایی نوشته شد: docs/hatchery-sms-body-golden.json (${Object.keys(captured).length} کِیس)`,
  );
} else if (!fs.existsSync(GOLDEN_URL)) {
  check(
    "اسنپ‌شات طلایی docs/hatchery-sms-body-golden.json موجود است",
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

const failed = results.filter((ok) => !ok).length;
if (failed) {
  consoleLog(
    `\n❌ ${failed} بررسی از ${results.length} ناموفق — گارد برش بدنهٔ گزارش پیامک گله`,
  );
  process.exitCode = 1;
} else {
  consoleLog(
    `\n✅ هر ${results.length} بررسی موفق — رکورد متد بایت‌به‌بایت پایدار است`,
  );
}
