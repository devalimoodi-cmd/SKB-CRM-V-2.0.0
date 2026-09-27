// ============================================================
//  تست سطح سرویس داشبورد در «زمان اجرا» — گارد دائمی موج ۳.۲
//  اجرا:  npm run test:dashboard-surface      (در پوشهٔ Frontend)
// ------------------------------------------------------------
//  چرا؟ dashboard.service.js به window/document وابسته است و هیچ تستی
//  آن را import نمی‌کرد؛ پس شکستن «کلاس غول» (موج ۳.۲a: بیرون‌کشیدن
//  دامنه‌های پیامک/بوکمارک/چسب پنجره به سه mixin) می‌توانست یک متد
//  عمومی را بی‌صدا گم کند بدون آنکه تست‌ها بفهمند.
//  این اسکریپت ماژول را با استاب‌های حداقلی در Node import می‌کند و
//  سطح زمان اجرا را با اسنپ‌شات استاتیک docs/service-surface.json
//  (که audit:surface می‌سازد) مقایسه می‌کند:
//    ۱) متدهای کلاس (۶۳) + دو mixin (۱۰+۵) روی prototype → ۷۸ عضو
//    ۲) هر متد mixin روی نمونهٔ ساخته‌شده قابل فراخوانی است
//    ۳) اعضای نمونه (ویژگی‌های constructor/this.x) وجود دارند
//    ۴) همهٔ ۲۴ نام چسب window.* مثل قبل ثبت شده‌اند
//    ۵) فایل‌های mixinِ ثبت‌شده در اسنپ‌شات هنوز روی دیسک هستند
//  ⚠️ اعداد از خودِ اسنپ‌شات خوانده می‌شوند؛ اگر عمداً سطح تغییر کرد
//     اول `npm run audit:surface -- --snapshot` را اجرا کن.
// ============================================================
import fs from "node:fs";

const SERVICE_MODULE = "./src/features/dashboard/dashboard.service.js";
const SERVICE_KEY = "src/features/dashboard/dashboard.service.js";
const GLUE_KEY = "src/features/dashboard/dashboard.window-glue.js";

// چند متد شاخص هر mixin (اثبات این‌که Object.assignها واقعاً اجرا شده‌اند)
const MIXIN_SPOT_CHECKS = {
  "dashboard.sms.js": "refreshSmsStatus",
  "dashboard.bookmarks.js": "showBookmarkDetail",
};

// چسب `window.*` که در خودِ سرویس ثبت می‌شود ولی **در زمان import نه**؛
// `setDashboardChartLayout` داخل `setupChartLayoutToggle()` و هنگام کلیک
// کاربر روی دکمه‌های چیدمان نمودار ساخته می‌شود (dashboard.service.js:482).
const ON_DEMAND_WINDOW_GLOBALS = new Set(["setDashboardChartLayout"]);

// اعضای نمونهٔ اعلام‌شده در اسنپ‌شات که این تفکیک‌ها را دارند:
//  • «تنبل»: فقط با اجرای متدها ساخته می‌شوند (نمونهٔ تازه‌ساز آن‌ها را ندارد).
//  • «شبه‌ویژگی DOM»: ابزار استاتیک از `this.style.x` / `this.closest(...)`
//    این نام‌ها را عضو نمونه دیده، در حالی که همان API عنصر DOM است.
const LAZY_INSTANCE_MEMBERS = new Set([
  "_cardsSignature",
  "_chartLoadingTimer",
  "_chartRequestSeq",
  "_valueLabelPlugin",
  "refreshInterval",
  "selectedFlockGroupId",
  "smsHistoryCtx",
]);
const DOM_PSEUDO_MEMBERS = new Set([
  "checked",
  "classList",
  "closest",
  "dataset",
  "querySelector",
  "style",
]);

// ---------- استاب‌های حداقلی مرورگر (قبل از import ماژول) ----------
globalThis.window = globalThis.window || { location: { search: "" } };
globalThis.document = globalThis.document || {};
globalThis.localStorage = globalThis.localStorage || {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

const results = [];
const check = (name, ok, extra = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}${extra ? " :: " + extra : ""}`);
};
const info = (message) => console.log(`ℹ️  ${message}`);

// ---------- ۱) اسنپ‌شات قرارداد ----------
const snapshot = JSON.parse(
  fs.readFileSync(
    new URL("../docs/service-surface.json", import.meta.url),
    "utf8",
  ),
);
const entry = snapshot.services[SERVICE_KEY];
const glueEntry = snapshot.services[GLUE_KEY] || { windowGlobals: [] };

if (!entry || !entry.classes || !entry.classes.DashboardService) {
  console.log(`❌ FAIL - اسنپ‌شات قرارداد برای ${SERVICE_KEY} یافت نشد`);
  process.exitCode = 1;
  throw new Error("service-surface.json entry missing");
}

const classSurface = entry.classes.DashboardService;
const mixins = classSurface.mixins || {};
const mixinFiles = Object.keys(mixins);
const baseMethods = classSurface.methods || [];
const mixinMethods = mixinFiles.flatMap((file) => mixins[file] || []);
const expectedMembers = [...new Set([...baseMethods, ...mixinMethods])];
const expectedProperties = (classSurface.properties || []).filter(
  (name) => !expectedMembers.includes(name),
);

// ---------- ۲) import واقعی سرویس ----------
const moduleNamespace = await import(SERVICE_MODULE);
const dashboardService = moduleNamespace.dashboardService;
const proto = dashboardService ? Object.getPrototypeOf(dashboardService) : null;
// توجه: خودِ کلاس `DashboardService` صادر نمی‌شود (فقط نمونه)؛ تنها مسیر
// دیدن کلاس در زمان اجرا، همان `window.DashboardService` است که چسب ثبت می‌کند.
const windowClass = globalThis.window.DashboardService;

check(
  "import سرویس در Node (نمونهٔ dashboardService ساخته شد)",
  !!dashboardService && typeof dashboardService.init === "function",
);
check(
  "نمونه واقعاً از کلاس چسب‌خورده ساخته شده (دو Object.assign اجرا شده‌اند)",
  typeof windowClass === "function" && dashboardService instanceof windowClass,
);

// ---------- ۳) سطح prototype: کلاس + دو mixin ----------
const missingOnProto = expectedMembers.filter(
  (name) => !proto || typeof proto[name] !== "function",
);
check(
  `همهٔ ${expectedMembers.length} عضو سطح کلاس/mixin روی prototype تابع‌اند`,
  missingOnProto.length === 0,
  missingOnProto.length ? `گم‌شده‌ها: ${missingOnProto.join(", ")}` : "",
);

const ownNames = proto ? Object.getOwnPropertyNames(proto) : [];
check(
  `تعداد اعضای prototype دقیقاً ${expectedMembers.length} است`,
  ownNames.length === expectedMembers.length,
  `واقعی=${ownNames.length}`,
);

const protoExtras = ownNames.filter((name) => !expectedMembers.includes(name));
if (protoExtras.length) {
  info(
    `اعضای اضافه روی prototype (اطلاعی، اسنپ‌شات را به‌روز کن): ${protoExtras.join(", ")}`,
  );
}

// ---------- ۴) mixinها: وجود فایل + یک متد شاخص روی نمونه ----------
mixinFiles.forEach((file) => {
  const fileName = file.split("/").pop();
  const exists = fs.existsSync(new URL(file, import.meta.url));
  const names = mixins[file] || [];
  const spot = MIXIN_SPOT_CHECKS[fileName];
  const spotOk =
    !spot ||
    (!!dashboardService && typeof dashboardService[spot] === "function");
  check(
    `mixin ${fileName} → فایل موجود + ${names.length} متد روی نمونه`,
    exists && spotOk,
    exists ? (spot ? `متد شاخص: ${spot}` : "") : "فایل روی دیسک نیست",
  );
});

// ---------- ۵) ویژگی‌های نمونه (constructor/this.x) ----------
const skippedProperties = [...LAZY_INSTANCE_MEMBERS, ...DOM_PSEUDO_MEMBERS];
const missingProps = expectedProperties.filter(
  (name) => !dashboardService || !(name in dashboardService),
);
const unexpectedMissing = missingProps.filter(
  (name) => !skippedProperties.includes(name),
);
check(
  `ویژگی‌های نمونهٔ اعلام‌شده موجودند (${expectedProperties.length} مورد)`,
  unexpectedMissing.length === 0,
  unexpectedMissing.length ? `گم‌شده‌ها: ${unexpectedMissing.join(", ")}` : "",
);

const stillLazy = [...LAZY_INSTANCE_MEMBERS].filter((name) =>
  missingProps.includes(name),
);
if (stillLazy.length) {
  info(
    `عضوهای «تنبل» که هنوز ساخته نشده‌اند (مورد انتظار): ${stillLazy.join(", ")}`,
  );
}
const resolvedLazy = [...LAZY_INSTANCE_MEMBERS].filter(
  (name) => !missingProps.includes(name),
);
if (resolvedLazy.length) {
  info(
    `✅ این نام‌ها حالا در سازنده ساخته می‌شوند؛ از LAZY_INSTANCE_MEMBERS حذف کن: ${resolvedLazy.join(", ")}`,
  );
}

// ---------- ۶) چسب پنجره (window.*) ----------
const glueNames = glueEntry.windowGlobals || [];
const missingGlobals = glueNames.filter(
  (name) => globalThis.window[name] === undefined,
);
check(
  `همهٔ ${glueNames.length} نام چسب window.* ثبت شده‌اند`,
  missingGlobals.length === 0,
  missingGlobals.length ? `گم‌شده‌ها: ${missingGlobals.join(", ")}` : "",
);
check(
  "window.dashboardService همان نمونهٔ سرویس است",
  globalThis.window.dashboardService === dashboardService,
);
check(
  "window.DashboardService کلاس سازندهٔ همان نمونه است",
  typeof windowClass === "function" && dashboardService instanceof windowClass,
);

const onDemandNames = (entry.windowGlobals || []).filter(
  (name) => !ON_DEMAND_WINDOW_GLOBALS.has(name),
);
const onDemandMissing = onDemandNames.filter(
  (name) => globalThis.window[name] === undefined,
);
check(
  "چسب‌های ثبت‌شدهٔ داخل خود سرویس هم در زمان import موجودند",
  onDemandMissing.length === 0,
  onDemandMissing.length ? `گم‌شده‌ها: ${onDemandMissing.join(", ")}` : "",
);
info(
  `ثبت «هنگام‌نیاز» خارج از گارد window: ${[...ON_DEMAND_WINDOW_GLOBALS].join(", ") || "—"}`,
);

// ---------- ۷) گزارش ----------
const failed = results.filter((x) => !x).length;
console.log(
  `\n${failed === 0 ? "✅ SURFACE PASS" : `❌ ${failed} FAILED`} — سطح ثابت: ${expectedMembers.length} عضو prototype · ${glueNames.length} نام window`,
);
process.exitCode = failed === 0 ? 0 : 1;
