// ============================================================
//  تست برابری بدنهٔ متد غول کارت‌های هفتگی — گارد موج برش بدنه (۳.۲h)
//  اجرا:  npm run test:weekly:cards:body                  (در پوشهٔ Frontend)
//         npm run test:weekly:cards:body -- --snapshot    (بازتولید اسنپ‌شات طلایی)
// ------------------------------------------------------------
//  چرا؟ `weeklyCardMethods.renderWeeks` (`weekly.cards.js:92` · ۳۰۴ خط) بزرگ‌ترین متد مخزن
//  است و «برش بدنه» می‌خورد. هیچ تستی آن را مستقیم صدا نمی‌زند (فقط از `weekly.flocks.js`).
//  نکتهٔ کلیدی: متد قالب هر آیتم هفته را در `this._weekItemBuilders[flockId]` **ذخیره**
//  می‌کند (برای «نمایش بیشتر»). گارد باید هم رشتهٔ برگشتی و هم خروجی همان builder را
//  قفل کند، وگرنه بخش عمدهٔ بدنهٔ متد پوشش داده نمی‌شود.
//  روش سنجش دو لایه است (هم‌سبک گاردهای ۳.۲d/e/f/g):
//    ۱) «انکر»های رفتاری روی رکورد JSON (خروجی متد + آیتم‌ها + وضعیت نمونه).
//    ۲) «اسنپ‌شات طلایی»: sha256 رکورد در docs/weekly-cards-body-golden.json.
//  ⚠️ ساعت تثبیت و TZ قفل شده است (متد تاریخ شمسی و وضعیت‌ها می‌سازد).
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

globalThis.window = globalThis.window || { location: { search: "" } };
globalThis.document = globalThis.document || {
  addEventListener: () => {},
  querySelector: () => null,
  querySelectorAll: () => [],
  getElementById: () => null,
};
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const results = [];
const check = (name, ok, extra = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}${extra ? " :: " + extra : ""}`);
};
const info = (message) => console.log(`ℹ️  ${message}`);

const { weeklyService: svc } = await import(
  "./src/features/customer-info/sections/weekly/weekly.service.js"
);
const { authService } = await import(
  "./src/core/services/auth.service.js"
);

// نقش کاربر (شاخهٔ «کارشناس خدمات» در سازندهٔ آیتم هفته)
let role = "admin";
let userId = 5;
authService.getUserRole = () => role;
authService.getUserId = () => userId;

// ---------- فیکسچرها ----------
const makeWeek = (n, over = {}) => ({
  id: 100 + n,
  week_number: n,
  existsInDb: true,
  week_start_date: `2026-01-${String((n - 1) * 7 + 1).padStart(2, "0")}`,
  week_end_date: `2026-01-${String(n * 7).padStart(2, "0")}`,
  flock_age_days: n * 7,
  weekly_weight: 0.2 * n,
  weekly_feed_intake: 100 * n,
  weekly_mortality: 5,
  service_expert_id: null,
  ...over,
});
const weeks3 = [
  makeWeek(1),
  makeWeek(2, { existsInDb: false, id: null }),
  makeWeek(3),
];
const weeks10 = Array.from({ length: 10 }, (_, i) => makeWeek(i + 1));
const weeks12 = Array.from({ length: 12 }, (_, i) => makeWeek(i + 1));
const makeFlock = (over = {}) => ({
  id: 7,
  flock_number: 12,
  hall_name: "سالن A",
  placement_date: "2026-01-01",
  total_chicks_count: 10000,
  standards: [],
  ...over,
});

// ---------- ابزار اجرا و رکورد ----------
const setState = ({ maxDefault = 10, roleName = "admin", uid = 5 } = {}) => {
  svc.MAX_DEFAULT_WEEKS = maxDefault;
  svc.weeksShown = {};
  svc._weekItemBuilders = {};
  role = roleName;
  userId = uid;
};
const runCase = (flock, weeks) => {
  const html = svc.renderWeeks(flock, weeks);
  const builder = svc._weekItemBuilders?.[flock.id];
  const items = (weeks || []).map((w) =>
    typeof builder === "function" ? builder(w) : null,
  );
  return {
    html,
    items,
    weeksShown: svc.weeksShown ?? null,
    builderStored: typeof builder === "function",
  };
};
const recordText = (record) => JSON.stringify(record, null, 2);
const anchorView = (text) =>
  text + "\n" + text.replace(/\\"/g, '"').replace(/\\n/g, "\n");

const cases = [
  {
    // K1 — سه هفته (بدون «نمایش بیشتر») + نقش مدیر
    name: "K1.renderWeeks-سه-هفته-مدیر",
    setup: () => setState({}),
    anchors: [
      '"builderStored": true',
      "week-accordion-item",
      "هفته 1",
      "هفته 3",
      "✅ ثبت شده",
      "⏳ تکمیل نشده",
    ],
    run: () => runCase(makeFlock(), weeks3),
  },
  {
    // K2 — ۱۲ هفته با پیش‌فرض ۱۰ ⇒ دکمهٔ «نمایش بیشتر» و weeksShown
    name: "K2.renderWeeks-نمایش-بیشتر",
    setup: () => setState({ maxDefault: 10 }),
    anchors: ['"builderStored": true', '"weeksShown"', '"7": 10', "هفته 10"],
    run: () => runCase(makeFlock(), weeks12),
  },
  {
    // K3 — بدون هفته
    name: "K3.renderWeeks-بدون-هفته",
    setup: () => setState({}),
    anchors: ['"builderStored": true', '"weeksShown"', '"7": 0'],
    run: () => runCase(makeFlock(), []),
  },
  {
    // K4 — نقش کارشناس خدمات (پیش‌فرض کارشناس = کاربر جاری)
    name: "K4.renderWeeks-کارشناس-خدمات",
    setup: () => setState({ roleName: "expert", uid: 5 }),
    anchors: ['"builderStored": true', "expert-select", "کارشناس"],
    run: () => runCase(makeFlock(), weeks3),
  },
  {
    // K5 — کارشناس ثبت‌شده روی هفته اولویت دارد
    name: "K5.renderWeeks-کارشناس-ثبت‌شده",
    setup: () => setState({ roleName: "expert", uid: 5 }),
    anchors: ['"builderStored": true', 'data-selected="9"'],
    run: () =>
      runCase(makeFlock(), [
        makeWeek(1, { service_expert_id: 9 }),
        makeWeek(2),
        makeWeek(3),
      ]),
  },
  {
    // K6 — پیش‌فرض کمتر از تعداد هفته‌ها (سه)
    name: "K6.renderWeeks-پیش‌فرض-سه",
    setup: () => setState({ maxDefault: 3 }),
    anchors: ['"weeksShown"', '"7": 3', "هفته 3"],
    run: () => runCase(makeFlock(), weeks10),
  },
  {
    // K7 — هفته‌های با مقادیر خالی
    name: "K7.renderWeeks-مقادیر-خالی",
    setup: () => setState({}),
    anchors: ['"builderStored": true', "week-accordion-item", "هفته 1"],
    run: () =>
      runCase(makeFlock(), [
        makeWeek(1, {
          weekly_weight: null,
          weekly_feed_intake: null,
          weekly_mortality: null,
          flock_age_days: null,
        }),
      ]),
  },
  {
    // K8 — دو گله پشت‌سرهم (جداسازی وضعیت نمونه بر اساس flockId)
    name: "K8.renderWeeks-دو-گله",
    setup: () => setState({}),
    anchors: ['"builderStored": true', '"weeksShown"'],
    run: () => {
      const first = runCase(makeFlock(), weeks3);
      const second = runCase(makeFlock({ id: 8, flock_number: 13 }), weeks10);
      return { first, second, weeksShown: svc.weeksShown };
    },
  },
];

// ===== اجرا + اسنپ‌شات =====
const GOLDEN_URL = new URL(
  "../docs/weekly-cards-body-golden.json",
  import.meta.url,
);
const SNAPSHOT = process.argv.includes("--snapshot");
const sha256 = (text) =>
  crypto.createHash("sha256").update(text, "utf8").digest("hex");

check(
  "متد هدف weeklyService.renderWeeks موجود است",
  typeof svc?.renderWeeks === "function",
);

const captured = {};
for (const testCase of cases) {
  store.clear();
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

// ===== پیش‌نیاز پایداری: تثبیت ساعت =====
const firstCase = cases[0];
store.clear();
firstCase.setup?.();
const firstAgain = recordText(await firstCase.run());
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
        note: "اسنپ‌شات رکورد متد غول کارت‌های هفتگی (renderWeeks)، گرفته‌شده پیش از موج برش بدنه (۳.۲h). هر کِیس = خروجی متد + خروجی سازندهٔ آیتم هفته (this._weekItemBuilders) + وضعیت نمونه (weeksShown). بازتولید: npm run test:weekly:cards:body -- --snapshot",
        node: process.version,
        locale: Intl.NumberFormat().resolvedOptions().locale,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        frozenClockUtc: new Date(FROZEN_MS).toISOString(),
        source: "HEAD پیش از برش بدنه — git tag pre-cards-body-split",
        note2:
          "خروجی به locale/ICU و منطقهٔ زمانی محیط Node وابسته است (تاریخ شمسی در کارت‌ها)؛ هارنس ساعت را تثبیت و TZ را روی Asia/Tehran قفل می‌کند، پس مقایسه در همان محیطی معنا دارد که اسنپ‌شات گرفته شده است.",
        cases: captured,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  info(
    `اسنپ‌شات طلایی نوشته شد: docs/weekly-cards-body-golden.json (${Object.keys(captured).length} کِیس)`,
  );
} else if (!fs.existsSync(GOLDEN_URL)) {
  check(
    "اسنپ‌شات طلایی docs/weekly-cards-body-golden.json موجود است",
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
  console.log(
    `\n❌ ${failed} بررسی از ${results.length} ناموفق — گارد برش بدنهٔ کارت‌های هفتگی`,
  );
  process.exitCode = 1;
} else {
  console.log(
    `\n✅ هر ${results.length} بررسی موفق — خروجی renderWeeks بایت‌به‌بایت پایدار است`,
  );
}
