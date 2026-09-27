// ============================================================
//  تست سطح سرویس جوجه‌ریزی در «زمان اجرا» — گارد دائمی موج ۳
//  اجرا:  npm run test:hatchery-surface      (در پوشهٔ Frontend)
// ------------------------------------------------------------
//  چرا؟ hatchery.service.js به window/document وابسته است و هیچ تستی
//  آن را import نمی‌کرد؛ پس «کلاس غول» می‌توانست در حین ریفکتور
//  یک متد عمومی را بی‌صدا از دست بدهد بدون آنکه تست‌ها بفهمند.
//  این اسکریپت ماژول را با استاب‌های حداقلی در Node import می‌کند و
//  سطح زمان اجرا را با اسنپ‌شات استاتیک docs/service-surface.json
//  (که audit:surface می‌سازد) مقایسه می‌کند:
//    ۱) متدهای کلاس (۶۲) + سه mixin (۵+۲۳+۱۱ = ۳۹) روی prototype → ۱۰۱ عضو
//    ۲) هر متد mixin روی نمونهٔ ساخته‌شده قابل فراخوانی است
//    ۳) اعضای نمونه (ویژگی‌های constructor/this.x) وجود دارند
//    ۴) همهٔ نام‌های چسب window.* مثل قبل ثبت شده‌اند (۵۷ نام)
//    ۵) فایل‌های mixinِ ثبت‌شده در اسنپ‌شات هنوز روی دیسک هستند
//  ⚠️ اعداد از خودِ اسنپ‌شات خوانده می‌شوند؛ اگر عمداً سطح تغییر کرد
//     اول `npm run audit:surface -- --snapshot` را اجرا کن.
// ============================================================
import fs from "node:fs";

const SERVICE_MODULE =
  "./src/features/customer-info/sections/hatchery/hatchery.service.js";
const SERVICE_KEY =
  "src/features/customer-info/sections/hatchery/hatchery.service.js";
const GLUE_KEY =
  "src/features/customer-info/sections/hatchery/hatchery.window-glue.js";

// چند متد شاخص هر mixin (اثبات این‌که Object.assignها واقعاً اجرا شده‌اند)
const MIXIN_SPOT_CHECKS = {
  "hatchery.completion.age.utils.js": "_pcDateIso",
  "hatchery.completion.flock.js": "completeFlockOf",
  "hatchery.completion.period.js": "recomputeSystemFields",
};

// ---------- استاب‌های حداقلی مرورگر (قبل از import ماژول) ----------
globalThis.window = globalThis.window || { location: { search: "" } };
globalThis.document = globalThis.document || {};
globalThis.localStorage = globalThis.localStorage || {
  getItem: () => null,
  setItem: () => {},
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

if (!entry || !entry.classes || !entry.classes.HatcheryService) {
  console.log(`❌ FAIL - اسنپ‌شات قرارداد برای ${SERVICE_KEY} یافت نشد`);
  process.exitCode = 1;
  throw new Error("service-surface.json entry missing");
}

const classSurface = entry.classes.HatcheryService;
const mixins = classSurface.mixins || {};
const mixinFiles = Object.keys(mixins);
const baseMethods = classSurface.methods || [];
const mixinMethods = mixinFiles.flatMap((file) => mixins[file] || []);
const expectedMembers = [...new Set([...baseMethods, ...mixinMethods])];
const expectedProperties = (classSurface.properties || []).filter(
  (name) => !expectedMembers.includes(name),
);

// ---------- ۲) import واقعی سرویس ----------
const windowKeysBefore = new Set(Object.keys(globalThis.window));
const moduleNamespace = await import(SERVICE_MODULE);
const hatcheryService = moduleNamespace.hatcheryService;
const proto = hatcheryService ? Object.getPrototypeOf(hatcheryService) : null;

check(
  "import سرویس در Node (نمونهٔ hatcheryService ساخته شد)",
  !!hatcheryService && typeof hatcheryService.init === "function",
);

// ---------- ۳) سطح prototype: کلاس + سه mixin ----------
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
    !spot || (!!hatcheryService && typeof hatcheryService[spot] === "function");
  check(
    `mixin ${fileName} → فایل موجود + ${names.length} متد روی نمونه`,
    exists && spotOk,
    exists ? (spot ? `متد شاخص: ${spot}` : "") : "فایل روی دیسک نیست",
  );
});

// ---------- ۵) ویژگی‌های نمونه (constructor/this.x) ----------
// audit:surface این فهرست را از فیلدهای کلاس + ارجاع‌های this.x می‌سازد؛
// بخشی از آن‌ها در این پروژه فقط «پس از اجرای متدها» ساخته می‌شوند
// (نمونهٔ تازه‌ساز آن‌ها را ندارد) و یکی از آن‌ها ارجاع آویزانِ پیش‌موجود است
// (صدا زده می‌شود ولی هیچ‌جا تعریف نشده — ثبت‌شده در docs/HOTSPOTS.md).
const LAZY_INSTANCE_MEMBERS = new Set(["isEditingUnit"]);
const DANGLING_CALLS = new Set(["savePeriod"]);

const missingProps = expectedProperties.filter(
  (name) => !hatcheryService || !(name in hatcheryService),
);
const unexpectedMissing = missingProps.filter(
  (name) => !LAZY_INSTANCE_MEMBERS.has(name) && !DANGLING_CALLS.has(name),
);
check(
  `ویژگی‌های نمونهٔ اعلام‌شده موجودند (${expectedProperties.length} مورد)`,
  unexpectedMissing.length === 0,
  unexpectedMissing.length ? `گم‌شده‌ها: ${unexpectedMissing.join(", ")}` : "",
);

const stillDangling = [...DANGLING_CALLS].filter((name) =>
  missingProps.includes(name),
);
if (stillDangling.length) {
  info(
    `ارجاع آویزانِ پیش‌موجود (فراخوانی بدون تعریف): ${stillDangling.join(", ")}`,
  );
}
const resolvedDangling = [...DANGLING_CALLS].filter(
  (name) => !missingProps.includes(name),
);
if (resolvedDangling.length) {
  info(
    `✅ این نام‌ها حالا تعریف شده‌اند؛ از DANGLING_CALLS حذف و اسنپ‌شات را به‌روز کن: ${resolvedDangling.join(", ")}`,
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
  "window.hatcheryService همان نمونهٔ سرویس است",
  globalThis.window.hatcheryService === hatcheryService,
);

const addedGlobals = Object.keys(globalThis.window).filter(
  (name) => !windowKeysBefore.has(name) && !glueNames.includes(name),
);
if (addedGlobals.length) {
  info(`نام‌های اضافه روی window (اطلاعی): ${addedGlobals.join(", ")}`);
}

// ---------- ۷) گزارش ----------
const failed = results.filter((x) => !x).length;
console.log(
  `\n${failed === 0 ? "✅ SMOKE PASS" : `❌ ${failed} FAILED`} — سطح ثابت: ${expectedMembers.length} عضو prototype · ${glueNames.length} نام window`,
);
process.exitCode = failed === 0 ? 0 : 1;
