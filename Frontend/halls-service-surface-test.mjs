// ============================================================
//  تست سطح سرویس سالن‌ها در «زمان اجرا» — گارد دائمی موج ۳.۲c
//  اجرا:  npm run test:halls:surface        (در پوشهٔ Frontend)
// ------------------------------------------------------------
//  چرا؟ halls.service.js چاق‌ترین فایل مخزن بود (۲۲۵۹ خط کلاس / ۷۱ عضو) و
//  قرارداد بیرونی مهمی دارد: با <script type="module"> بار می‌شود، با
//  `window.hallsService?.init(...)` (customer-info.service.js:464-465) راه می‌افتد
//  و HTMLِ رندرشدهٔ خودش `window.hallsService?.renderUnitDetailsPanel(...)`
//  (halls.renderer.js:204-205) را داخل onclick می‌گذارد. هیچ تستی سطح عمومی آن را
//  نمی‌سنجید؛ پس شکستن «کلاس غول» (موج ۳.۲c: ۷۰ متد → ۸ mixin + چسب پنجره)
//  می‌توانست یک متد یا یک نام window.* را بی‌صدا گم کند.
//  این اسکریپت ماژول را با همان استاب‌های اثبات‌شدهٔ _3_2c_parity در Node import
//  می‌کند و سطح زمان اجرا را با اسنپ‌شات استاتیک docs/service-surface.json
//  (ساختهٔ audit:surface) می‌سنجد:
//    ۱) متدهای کلاس + mixinها روی prototype (۷۱ عضو) + شمارش دقیق
//    ۲) فایل‌های ۸ mixin روی دیسک + متد شاخص هر کدام روی نمونه
//    ۳) ویژگی‌های نمونه: ساخته‌شده در constructor یا «تنبل» با اثبات `this.X =`
//       (این گارد دستهٔ باگِ `this.loadCities` را می‌گیرد: نامی که فقط صدا زده
//       می‌شود و هیچ‌جا ساخته نمی‌شود)
//    ۴) ۳۳ نام window.* چسب پنجره + درستی نمونهٔ hallsService/HallsService
//    ۵) مصرف‌کننده‌های بیرونی (customer-info.service.js و halls.renderer.js)
//    ۶) رفع باگ موج ۳.۲c: نبود عضو فانتوم و وصلهٔ درست loadPeriodsDropdown
//  ⚠️ اعداد از خودِ اسنپ‌شات خوانده می‌شوند؛ اگر عمداً سطح تغییر کرد
//     اول `npm run audit:surface -- --snapshot` را اجرا کن.
// ============================================================
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SERVICE_MODULE =
  "./src/features/customer-info/sections/hall-management/halls.service.js";
const SERVICE_KEY =
  "src/features/customer-info/sections/hall-management/halls.service.js";
const GLUE_KEY =
  "src/features/customer-info/sections/hall-management/halls.window-glue.js";
const DOMAIN_DIR = fileURLToPath(
  new URL("./src/features/customer-info/sections/hall-management/", import.meta.url),
);

// چند متد شاخص هر mixin (اثبات این‌که Object.assignها واقعاً اجرا شده‌اند)
const MIXIN_SPOT_CHECKS = {
  "halls.core.js": "init",
  "halls.tabs.js": "setupTabs",
  "halls.basic.js": "saveBasicInfo",
  "halls.list.js": "renderHallsList",
  "halls.edit-mode.js": "setupEditModeUI",
  "halls.units.js": "renderUnitDetailsPanel",
  "halls.systems.js": "renderSystemItemsEditor",
  "halls.forms.js": "setupSaveButtons",
};
const EXPECTED_MIXIN_FILES = Object.keys(MIXIN_SPOT_CHECKS);

// عضو نمونهٔ «شبه‌ویژگی DOM»: ابزار استاتیک از متن HTMLِ داخل قالب
// (`oninput="this.value=this.value.replace(...)"` در halls.units.js:60) نام
// `value` را عضو نمونهٔ سرویس دیده، در حالی که `this` آن‌جا عنصر <input> است.
const DOM_PSEUDO_MEMBERS = new Set(["value"]);
// ---------- استاب‌های حداقلی مرورگر (قبل از import ماژول) ----------
globalThis.window = globalThis.window || {
  location: { search: "", href: "http://localhost/", pathname: "/" },
  addEventListener: () => {},
  removeEventListener: () => {},
  matchMedia: () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }),
};
globalThis.document = globalThis.document || {
  getElementById: () => null,
  querySelector: () => null,
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

if (!entry || !entry.classes || !entry.classes.HallsService) {
  console.log(`❌ FAIL - اسنپ‌شات قرارداد برای ${SERVICE_KEY} یافت نشد`);
  process.exitCode = 1;
  throw new Error("service-surface.json entry missing");
}

const surface = entry.classes.HallsService;
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
const hallsService = mod.hallsService;
check("hallsService از ماژول صادر می‌شود", !!hallsService);

const windowClass = globalThis.window.HallsService;
check(
  "window.HallsService کلاس سازندهٔ همان نمونه است (کلاس صادر نمی‌شود)",
  typeof windowClass === "function" &&
    !!hallsService &&
    hallsService instanceof windowClass &&
    hallsService.constructor === windowClass,
  `صادرشده: ${Object.keys(mod).join(", ")}`,
);

// ---------- ۳) سطح prototype: کلاس + mixinها ----------
const proto = hallsService ? Object.getPrototypeOf(hallsService) : null;
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
      !spot || (!!hallsService && typeof hallsService[spot] === "function");
    check(
      `mixin ${fileName} → فایل موجود + ${names.length} متد روی نمونه`,
      exists && spotOk,
      exists ? (spot ? `متد شاخص: ${spot}` : "") : "فایل روی دیسک نیست",
    );
  });
}
// ---------- ۵) ویژگی‌های نمونه: constructor + فیلدهای «تنبل» ----------
// ابزار استاتیک هر `this.X` را عضو نمونه می‌بیند (چه بخواند چه بنویسد). این گارد
// بین سه دسته فرق می‌گذارد: (الف) در constructor ساخته می‌شود، (ب) تنبل است و
// جای دیگری با `this.X =` نوشته می‌شود (اثبات متن)، (ج) شبه‌ویژگی DOM.
// دستهٔ چهارمی که این گارد رد می‌کند، همان باگ موج ۳.۲c است: `this.loadCities`
// که فقط *صدا زده* می‌شد و هیچ‌جا ساخته نمی‌شد.
const domainFiles = fs
  .readdirSync(DOMAIN_DIR)
  .filter((name) => /^halls\..*\.js$/.test(name));
const domainText = {};
const lazyAssigned = new Map();
for (const file of domainFiles) {
  const text = fs.readFileSync(path.join(DOMAIN_DIR, file), "utf8");
  domainText[file] = text;
  text.split("\n").forEach((line, index) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("//")) return;
    const match = trimmed.match(/(?:^|[^\w$.])this\.([A-Za-z_$][\w$]*)\s*=(?!=)/);
    if (match && !lazyAssigned.has(match[1])) {
      lazyAssigned.set(match[1], `${file}:${index + 1}`);
    }
  });
}
const missingProps = expectedProperties.filter(
  (name) => !hallsService || !(name in hallsService),
);
const lazyProps = missingProps.filter((name) => lazyAssigned.has(name));
const unexplainedProps = missingProps.filter(
  (name) => !lazyAssigned.has(name) && !DOM_PSEUDO_MEMBERS.has(name),
);
check(
  `ویژگی‌های نمونهٔ اعلام‌شده (${expectedProperties.length} مورد): ${
    expectedProperties.length - missingProps.length
  } در constructor + ${lazyProps.length} تنبل (اثبات‌شده)`,
  unexplainedProps.length === 0,
  unexplainedProps.length
    ? `بدون اثبات (فانتوم؟): ${unexplainedProps.join(", ")}`
    : `شبه‌ویژگی DOM: ${[...DOM_PSEUDO_MEMBERS].join(", ") || "—"}`,
);
if (lazyProps.length) {
  info(
    `فیلدهای تنبل (اولین محل نوشتن): ${lazyProps
      .map((name) => `${name} ← ${lazyAssigned.get(name)}`)
      .join(" · ")}`,
  );
}

// ---------- ۶) گاردهای باگ موج ۳.۲c ----------
check(
  "عضو فانتوم `loadCities` در سطح عمومی نیست (رفع باگ موج ۳.۲c)",
  !expectedMembers.includes("loadCities") &&
    !expectedProperties.includes("loadCities"),
);
const danglingCallers = Object.entries(domainText)
  .filter(([, text]) => /this\.loadCities\s*\(/.test(text))
  .map(([file]) => file);
check(
  "هیچ فراخوانی آویزان `this.loadCities(` در دامنهٔ سالن‌ها نمانده است",
  danglingCallers.length === 0,
  danglingCallers.length ? `فایل‌ها: ${danglingCallers.join(", ")}` : "",
);

const glueSource = fs.readFileSync(
  path.join(DOMAIN_DIR, "halls.window-glue.js"),
  "utf8",
);
const glueCode = glueSource
  .split("\n")
  .filter((line) => !line.trim().startsWith("//"))
  .join("\n");
check(
  "`window.loadPeriodsDropdown` به متد موجود `hallsService.loadUnits` وصل است",
  /window\.loadPeriodsDropdown\s*=\s*\(\)\s*=>\s*hallsService\.loadUnits\(\)/.test(
    glueCode,
  ) && !/\bhallsService\.(loadPeriods|loadCities)\b/.test(glueCode),
);
const originalLoadUnits = hallsService.loadUnits;
let loadUnitsCalls = 0;
let glueThrew = "";
hallsService.loadUnits = () => {
  loadUnitsCalls += 1;
};
try {
  globalThis.window.loadPeriodsDropdown();
} catch (error) {
  glueThrew = String(error.message).slice(0, 60);
} finally {
  delete hallsService.loadUnits;
}
check(
  "`window.loadPeriodsDropdown()` واقعاً `loadUnits` را صدا می‌زند (بدون TypeError)",
  loadUnitsCalls === 1 &&
    glueThrew === "" &&
    hallsService.loadUnits === originalLoadUnits,
  glueThrew ? `خطا: ${glueThrew}` : `فراخوانی=${loadUnitsCalls}`,
);

// ---------- ۷) چسب پنجره (window.*) ----------
const serviceGlobals = entry.windowGlobals || [];
const glueNames = glueEntry.windowGlobals || [];
const allGlobals = [...new Set([...serviceGlobals, ...glueNames])];
const missingGlobals = allGlobals.filter(
  (name) => globalThis.window[name] === undefined,
);
check(
  `همهٔ ${allGlobals.length} نام چسب window.* ثبت شده‌اند` +
    (glueNames.length ? ` (${glueNames.length} مورد از halls.window-glue.js)` : ""),
  missingGlobals.length === 0,
  missingGlobals.length ? `گم‌شده‌ها: ${missingGlobals.join(", ")}` : "",
);
check(
  "window.hallsService همان نمونهٔ سرویس است",
  globalThis.window.hallsService === hallsService,
);
if (glueNames.length === 0) {
  info("پیش از برش: هنوز فایل halls.window-glue.js در اسنپ‌شات نیست");
}

// ---------- ۸) مصرف‌کننده‌های بیرونی: window.hallsService ----------
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
  if (!text.includes("window.hallsService")) return;
  const relative = path.relative(SRC_DIR, file).replace(/\\/g, "/");
  text.split(/\r?\n/).forEach((line, index) => {
    if (line.includes("window.hallsService")) {
      externalRefs.push({ file: relative, line: index + 1, text: line.trim() });
    }
  });
});
check(
  "مصرف‌کننده‌های بیرونی window.hallsService دست‌نخورده‌اند",
  externalRefs.length > 0,
  `ارجاع‌ها=${externalRefs.length}`,
);
const initGuards = externalRefs.filter((ref) =>
  /window\.hallsService\?\.init\b/.test(ref.text),
);
const initCalls = externalRefs.filter((ref) =>
  /window\.hallsService\.init\s*\(/.test(ref.text),
);
check(
  "مسیر راه‌اندازی `window.hallsService?.init` + فراخوانی `hallsService.init(...)` سرِ جایش است",
  initGuards.length > 0 && initCalls.length > 0,
  `${initGuards[0] ? `${initGuards[0].file}:${initGuards[0].line}` : "تایپ‌چک پیدا نشد"} · ${
    initCalls[0] ? `${initCalls[0].file}:${initCalls[0].line}` : "فراخوانی پیدا نشد"
  }`,
);
const domCallers = externalRefs.filter((ref) =>
  /window\.hallsService\?\.renderUnitDetailsPanel/.test(ref.text),
);
check(
  "فراخوانی درج‌شده در HTML رندرشده (renderUnitDetailsPanel) باقی مانده است",
  domCallers.length > 0,
  domCallers[0] ? `${domCallers[0].file}:${domCallers[0].line}` : "پیدا نشد",
);

// ---------- ۹) نبود اسکریپت موقتِ جامانده در پوشهٔ سالن‌ها ----------
const tempLeftovers = fs
  .readdirSync(DOMAIN_DIR)
  .filter((name) => name.startsWith("_"));
check(
  "هیچ اسکریپت موقتِ جاماندهٔ `_*` در پوشهٔ hall-management نیست",
  tempLeftovers.length === 0,
  tempLeftovers.length ? `پیدا شد: ${tempLeftovers.join(", ")}` : "",
);

// ---------- ۱۰) گزارش ----------
const failed = results.filter((x) => !x).length;
console.log(
  `\n${failed === 0 ? "✅ SURFACE PASS" : `❌ ${failed} FAILED`} — سطح ثابت: ${
    expectedMembers.length
  } عضو prototype · ${allGlobals.length} نام window · ${
    expectedProperties.length
  } ویژگی نمونه`,
);
process.exitCode = failed === 0 ? 0 : 1;
