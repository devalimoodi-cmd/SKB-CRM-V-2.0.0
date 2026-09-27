// ============================================================
//  تست سطح سرویس هفتگی در «زمان اجرا» — گارد دائمی موج ۳.۲b
//  اجرا:  npm run test:weekly:surface        (در پوشهٔ Frontend)
// ------------------------------------------------------------
//  چرا؟ weekly.service.js (۲۸۶۷ خط) قرارداد بیرونی مهمی دارد: تنها با
//  <script type="module"> در customer-info.html بار می‌شود، با
//  `window.weeklyService?.init(...)` (customer-info.service.js) راه می‌افتد
//  و HTMLِ رندرشدهٔ خودش `window.weeklyService.showMoreWeeks(...)` را داخل
//  onclick می‌گذارد. هیچ تستی سطح عمومی آن را نمی‌سنجید؛ پس شکستن «کلاس غول»
//  (موج ۳.۲b: ۴۹ متد → ۸ mixin + چسب پنجره) می‌توانست یک متد یا یک نام
//  window.* را بی‌صدا گم کند.
//  این اسکریپت ماژول را با استاب‌های اثبات‌شدهٔ weekly-history-render-test
//  در Node import می‌کند و سطح زمان اجرا را با اسنپ‌شات استاتیک
//  docs/service-surface.json (ساختهٔ audit:surface) می‌سنجد:
//    ۱) متدهای کلاس + mixinها روی prototype (۴۹ عضو) + شمارش دقیق
//    ۲) اعضای نمونه (customerId، _weekItemBuilders، …) ساخته می‌شوند
//    ۳) همهٔ ۱۶ نام window.* مثل قبل ثبت شده‌اند (۱۵ واقعی + onload اطلاعی)
//    ۴) فایل‌های mixinِ اعلام‌شدهٔ اسنپ‌شات روی دیسک هستند و متد شاخصشان
//       روی نمونه کار می‌کند (پس از برش فعال می‌شود)
//    ۵) مصرف‌کنندهٔ بیرونی `window.weeklyService?.init(...)` دست‌نخورده است
//  ⚠️ اعداد از خودِ اسنپ‌شات خوانده می‌شوند؛ اگر عمداً سطح تغییر کرد
//     اول `npm run audit:surface -- --snapshot` را اجرا کن.
// ============================================================
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SERVICE_MODULE =
  "./src/features/customer-info/sections/weekly/weekly.service.js";
const SERVICE_KEY = "src/features/customer-info/sections/weekly/weekly.service.js";
const GLUE_KEY = "src/features/customer-info/sections/weekly/weekly.window-glue.js";

// چند متد شاخص هر mixin (اثبات این‌که Object.assignها واقعاً اجرا شده‌اند)
const MIXIN_SPOT_CHECKS = {
  "weekly.loading.js": "init",
  "weekly.flocks.js": "showMoreWeeks",
  "weekly.cards.js": "updateWeekCards",
  "weekly.form.js": "saveWeek",
  "weekly.report.full.js": "generateFullReport",
  "weekly.report.history.js": "generateWeeklyHistoryReport",
  "weekly.report.pickers.js": "pickReportWeeksPerFlock",
  "weekly.report.history.html.js": "buildWeeklyHistoryHTML",
};
const EXPECTED_MIXIN_FILES = Object.keys(MIXIN_SPOT_CHECKS);

// نام سراسری‌ای که در زمان import ثبت نمی‌شود: `onload` از متن HTMLِ پنجرهٔ
// چاپ گزارش می‌آید (`<script>window.onload = function(){ window.print(); }</script>`
// در weekly.service.js) و یک تخصیص واقعی window نیست.
const ON_DEMAND_WINDOW_GLOBALS = new Set(["onload"]);

// عضو نمونهٔ «شبه‌ویژگی DOM»: ابزار استاتیک از `this.style.x` این نام را
// عضو نمونه دیده، در حالی که API عنصر DOM است.
const DOM_PSEUDO_MEMBERS = new Set(["style"]);

// ---------- استاب‌های حداقلی مرورگر (قبل از import ماژول) ----------
globalThis.window = globalThis.window || { location: { search: "" } };
globalThis.document = globalThis.document || {
  addEventListener: () => {},
  querySelector: () => null,
  getElementById: () => null,
};
const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => (storage.has(key) ? storage.get(key) : null),
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
};

const results = [];
const check = (name, ok, extra = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}${extra ? " :: " + extra : ""}`);
};
const info = (message) => console.log(`ℹ️  ${message}`);

// ---------- ۱) اسنپ‌شات قرارداد ----------
const snapshot = JSON.parse(
  fs.readFileSync(new URL("../docs/service-surface.json", import.meta.url), "utf8"),
);
const entry = snapshot.services[SERVICE_KEY];
const glueEntry = snapshot.services[GLUE_KEY] || { windowGlobals: [] };

if (!entry || !entry.classes || !entry.classes.WeeklyService) {
  console.log(`❌ FAIL - اسنپ‌شات قرارداد برای ${SERVICE_KEY} یافت نشد`);
  process.exitCode = 1;
  throw new Error("service-surface.json entry missing");
}

const surface = entry.classes.WeeklyService;
const mixins = surface.mixins || {};
const mixinFiles = Object.keys(mixins);
const baseMethods = surface.methods || [];
const mixinMethods = mixinFiles.flatMap((file) => mixins[file] || []);
const expectedMembers = [...new Set([...baseMethods, ...mixinMethods])];
const expectedProperties = (surface.properties || []).filter(
  (name) => !expectedMembers.includes(name),
);

// ---------- ۲) import واقعی سرویس ----------
const mod = await import(SERVICE_MODULE);
const weeklyService = mod.weeklyService;
check("weeklyService از ماژول صادر می‌شود", !!weeklyService);

const windowClass = globalThis.window.WeeklyService;
check(
  "window.WeeklyService کلاس سازندهٔ همان نمونه است (کلاس صادر نمی‌شود)",
  typeof windowClass === "function" &&
    !!weeklyService &&
    weeklyService instanceof windowClass &&
    weeklyService.constructor === windowClass,
);

// ---------- ۳) سطح prototype: کلاس + mixinها ----------
const proto = weeklyService ? Object.getPrototypeOf(weeklyService) : null;
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
if (mixinFiles.length === 0) {
  info("پیش از برش: اسنپ‌شات هیچ mixin ثبت نکرده (این بخش با گام ۲ فعال می‌شود)");
} else {
  const missingMixinFiles = EXPECTED_MIXIN_FILES.filter(
    (name) => !mixinFiles.some((file) => file.endsWith(`/${name}`)),
  );
  check(
    `اسنپ‌شات همهٔ ${EXPECTED_MIXIN_FILES.length} mixin انتظاری را ثبت کرده است`,
    missingMixinFiles.length === 0,
    missingMixinFiles.length ? `گم‌شده‌ها: ${missingMixinFiles.join(", ")}` : "",
  );
  mixinFiles.forEach((file) => {
    const fileName = file.split("/").pop();
    const exists = fs.existsSync(new URL(file, import.meta.url));
    const names = mixins[file] || [];
    const spot = MIXIN_SPOT_CHECKS[fileName];
    const spotOk =
      !spot || (!!weeklyService && typeof weeklyService[spot] === "function");
    check(
      `mixin ${fileName} → فایل موجود + ${names.length} متد روی نمونه`,
      exists && spotOk,
      exists ? (spot ? `متد شاخص: ${spot}` : "") : "فایل روی دیسک نیست",
    );
  });
}

// ---------- ۵) ویژگی‌های نمونه (constructor/this.x) ----------
const missingProps = expectedProperties.filter(
  (name) => !weeklyService || !(name in weeklyService),
);
const unexpectedMissing = missingProps.filter(
  (name) => !DOM_PSEUDO_MEMBERS.has(name),
);
check(
  `ویژگی‌های نمونهٔ اعلام‌شده موجودند (${expectedProperties.length} مورد)`,
  unexpectedMissing.length === 0,
  unexpectedMissing.length ? `گم‌شده‌ها: ${unexpectedMissing.join(", ")}` : "",
);

// ---------- ۶) چسب پنجره (window.*) ----------
const serviceGlobals = entry.windowGlobals || [];
const glueNames = glueEntry.windowGlobals || [];
const allGlobals = [...new Set([...serviceGlobals, ...glueNames])];
const missingGlobals = allGlobals.filter(
  (name) =>
    !ON_DEMAND_WINDOW_GLOBALS.has(name) && globalThis.window[name] === undefined,
);
check(
  `همهٔ ${allGlobals.length} نام چسب window.* ثبت شده‌اند`,
  missingGlobals.length === 0,
  missingGlobals.length ? `گم‌شده‌ها: ${missingGlobals.join(", ")}` : "",
);
check(
  "window.weeklyService همان نمونهٔ سرویس است",
  globalThis.window.weeklyService === weeklyService,
);
info(
  `نام‌های «متنِ HTML/هنگام‌نیاز» خارج از گارد window: ${[...ON_DEMAND_WINDOW_GLOBALS].join(", ") || "—"}`,
);

if (glueNames.length === 0) {
  info("پیش از برش: هنوز فایل weekly.window-glue.js در اسنپ‌شات نیست");
} else {
  const glueMissing = glueNames.filter(
    (name) =>
      !ON_DEMAND_WINDOW_GLOBALS.has(name) && globalThis.window[name] === undefined,
  );
  check(
    `چسب‌های فایل weekly.window-glue.js در زمان import ثبت شده‌اند (${glueNames.length} نام)`,
    glueMissing.length === 0,
    glueMissing.length ? `گم‌شده‌ها: ${glueMissing.join(", ")}` : "",
  );
}

// ---------- ۷) مصرف‌کنندهٔ بیرونی: window.weeklyService ----------
const SRC_DIR = fileURLToPath(new URL("./src/", import.meta.url));
const SKIP_DIRS = new Set(["node_modules", ".git", "vendor", "dist", "build"]);
const walkFiles = (dir, acc = []) => {
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const item of entries) {
    if (item.isDirectory()) {
      if (SKIP_DIRS.has(item.name)) continue;
      walkFiles(path.join(dir, item.name), acc);
      continue;
    }
    if (item.isFile() && /\.(js|html)$/.test(item.name)) {
      acc.push(path.join(dir, item.name));
    }
  }
  return acc;
};

const externalRefs = [];
walkFiles(SRC_DIR).forEach((file) => {
  let text = "";
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    return;
  }
  if (!text.includes("window.weeklyService")) return;
  const relative = path.relative(SRC_DIR, file).replace(/\\/g, "/");
  text.split(/\r?\n/).forEach((line, index) => {
    if (line.includes("window.weeklyService")) {
      externalRefs.push({ file: relative, line: index + 1, text: line.trim() });
    }
  });
});
check(
  "مصرف‌کنندهٔ بیرونی window.weeklyService دست‌نخورده است",
  externalRefs.length > 0,
  `ارجاع‌ها=${externalRefs.length}`,
);
const initGuards = externalRefs.filter((ref) =>
  /window\.weeklyService\?\.init\b/.test(ref.text),
);
const initCalls = externalRefs.filter((ref) =>
  /window\.weeklyService\.init\s*\(/.test(ref.text),
);
check(
  "مسیر راه‌اندازی `window.weeklyService?.init` + فراخوانی `weeklyService.init(...)` سرِ جایش است",
  initGuards.length > 0 && initCalls.length > 0,
  `${initGuards[0] ? `${initGuards[0].file}:${initGuards[0].line}` : "تایپ‌چک پیدا نشد"} · ${initCalls[0] ? `${initCalls[0].line}` : "فراخوانی پیدا نشد"}`,
);
const domCallers = externalRefs.filter((ref) =>
  /window\.weeklyService\.showMoreWeeks/.test(ref.text),
);
check(
  "فراخوانی درج‌شده در HTML رندرشده (showMoreWeeks) باقی مانده است",
  domCallers.length > 0,
  domCallers[0] ? `${domCallers[0].file}:${domCallers[0].line}` : "پیدا نشد",
);

// ---------- ۸) نبود اسکریپت موقتِ جامانده در پوشهٔ weekly ----------
const WEEKLY_DIR = fileURLToPath(
  new URL("./src/features/customer-info/sections/weekly/", import.meta.url),
);
const tempLeftovers = fs
  .readdirSync(WEEKLY_DIR)
  .filter((name) => name.startsWith("_"));
check(
  "هیچ اسکریپت موقتِ جاماندهٔ `_*` در پوشهٔ weekly نیست",
  tempLeftovers.length === 0,
  tempLeftovers.length ? `پیدا شد: ${tempLeftovers.join(", ")}` : "",
);

// ---------- ۹) گزارش ----------
const failed = results.filter((x) => !x).length;
console.log(
  `\n${failed === 0 ? "✅ SURFACE PASS" : `❌ ${failed} FAILED`} — سطح ثابت: ${expectedMembers.length} عضو prototype · ${allGlobals.length} نام window · ${expectedProperties.length} ویژگی نمونه`,
);
process.exitCode = failed === 0 ? 0 : 1;
