// ============================================================
// scripts/audit-service-surface.mjs
// «قرارداد سطح سرویس» — محافظِ شکستن کلاس‌های غول (موج ۲)
// اجرا:  npm run audit:surface                  (مقایسه با اسنپ‌شات)
//         npm run audit:surface -- --snapshot   (ساخت/به‌روزرسانی اسنپ‌شات)
//         npm run audit:big-methods             (متدهای بزرگ‌تر از بودجه)
// ------------------------------------------------------------
// چرا؟ هیچ تستی hatchery.service.js و dashboard.service.js را import نمی‌کند
// (به window/document وابسته‌اند)، پس شکستن آن‌ها بدون یک نگهبان استاتیک
// می‌تواند «گم‌شدنِ خاموش» یک متد عمومی را از چشم تست‌ها پنهان کند.
// این ابزار استاتیک (بدون اجرای مرورگر) چهار کار می‌کند:
//   ۱) سطح عمومی هر سرویس را استخراج می‌کند: نمونه‌های صادرشده،
//      متدهای کلاس (شامل mixin های `Object.assign(X.prototype, obj)`)،
//      و نام‌های چسب `window.<name>`.
//   ۲) در حالت پیش‌فرض، سطح فعلی را با docs/service-surface.json مقایسه
//      می‌کند؛ هر عضو گم‌شده (متد/نمونه/سراسری) → کد خروج ۱.
//   ۳) متدهایی که از بیرونِ فایل صدا زده می‌شوند (مثل `hatcheryService.foo`)
//      ولی در سطح کلاس وجود ندارند را گزارش می‌کند → شکار واقعی
//      تغییرنام/حذف در حین ریفکتور.
//   ۴) بودجهٔ اندازهٔ متدها را می‌سنجد (پیش‌فرض: ۱۵۰ خط).
// ⚠️ فقط‌خواندنی است؛ تنها در حالت --snapshot یک فایل JSON می‌نویسد.
// ============================================================
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(SCRIPT_DIR, "..");
const SRC_ROOT = path.join(PROJECT_ROOT, "src");
const SNAPSHOT_PATH = path.join(PROJECT_ROOT, "..", "docs", "service-surface.json");
const SKIP_DIRS = new Set(["node_modules", ".git", "vendor", "dist", "build"]);

const args = process.argv.slice(2);
const hasFlag = (name) => args.some((a) => a === `--${name}` || a.startsWith(`--${name}=`));
const flagValue = (name) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=")[1] : null;
};
const AS_JSON = hasFlag("json");
const WRITE_SNAPSHOT = hasFlag("snapshot");
const LIST_BIG = hasFlag("big-methods");
const FAIL_ON_BIG = hasFlag("fail-on-big");
const BIG_BUDGET = Number(flagValue("big-methods")) || 150;

const walk = (dir, acc = []) => {
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(full, acc);
      continue;
    }
    if (entry.isFile()) acc.push(full);
  }
  return acc;
};

const rel = (file) => path.relative(PROJECT_ROOT, file).replace(/\\/g, "/");
const readText = (file) => {
  try {
    // ⚠️ برخی فایل‌های این پروژه BOM دارند؛ بدون حذف آن، لنگرهای ^class/^export
    // در ابتدای فایل مطابقت نمی‌کنند (باگ واقعیِ کشف‌شده در نسخهٔ اول این ابزار).
    return fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
  } catch {
    return "";
  }
};

// ---------- استخراج متدهای یک «بدنهٔ کلاس» یا «شیء mixin» ----------
// متدها در این پروژه با ۲ فاصله تودرتو نوشته می‌شوند (اعضای کلاس/شیء).
const METHOD_RE =
  /^ {2}(?:async\s+)?(?:get\s+|set\s+)?([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/gm;

// «ویژگی‌های» کلاس/نمونه هم عضو عمومی‌اند (اعتبارسنجی `permissionService.role`
// باید درست کار کند)؛ پس فیلدهای کلاس و ارجاع‌های this.x هم استخراج می‌شوند.
const FIELD_RE =
  /^ {2}(?:static\s+)?(?:async\s+)?(?!const\b|let\b|var\b|return\b|this\b|if\b|for\b|while\b|switch\b|throw\b|new\b|await\b|case\b|else\b|do\b|try\b|typeof\b|delete\b)([A-Za-z_$][\w$]*)\s*=\s*(?!=)/gm;
const THIS_MEMBER_RE = /\bthis\.([A-Za-z_$][\w$]*)/g;

const membersFromText = (text, regex) => {
  const names = [];
  let match;
  regex.lastIndex = 0;
  while ((match = regex.exec(text)) !== null) names.push(match[1]);
  return [...new Set(names)];
};

const sliceRegion = (text, startIndex, closer) => {
  const rest = text.slice(startIndex);
  const close = rest.search(closer);
  return close === -1 ? rest : rest.slice(0, close);
};

const methodsFromRegion = (region) => {
  const names = [];
  let match;
  METHOD_RE.lastIndex = 0;
  while ((match = METHOD_RE.exec(region)) !== null) names.push(match[1]);
  return [...new Set(names)];
};

const bigMethodsFromRegion = (region, file) => {
  const lines = region.split(/\r?\n/);
  const found = [];
  for (let i = 0; i < lines.length; i++) {
    const m = /^ {2}(?:async\s+)?(?:get\s+|set\s+)?([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/.exec(
      lines[i],
    );
    if (!m) continue;
    let depth = 0;
    let started = false;
    let size = 0;
    for (let j = i; j < lines.length; j++) {
      for (const ch of lines[j]) {
        if (ch === "{") {
          depth += 1;
          started = true;
        } else if (ch === "}") {
          depth -= 1;
        }
      }
      size = j - i + 1;
      if (started && depth <= 0) break;
    }
    found.push({ file, name: m[1], line: i + 1, size });
  }
  return found;
};

// ---------- استخراج سطح عمومی یک فایل js ----------
const CLASS_RE = /^(?:export\s+)?(?:default\s+)?class\s+([A-Za-z_$][\w$]*)\s*(?:extends\s+[\w$.]+\s*)?\{/gm;
const EXPORT_INSTANCE_RE =
  /^\s*export\s+const\s+([A-Za-z_$][\w$]*)\s*=\s*new\s+([A-Za-z_$][\w$]*)\s*\(/gm;
const ASSIGN_PROTOTYPE_RE =
  /Object\.assign\(\s*([A-Za-z_$][\w$]*)\s*\.\s*prototype\s*,\s*([A-Za-z_$][\w$]*)\s*\)/g;
const WINDOW_ASSIGN_RE = /(?:window|globalThis)\.([A-Za-z_$][\w$]*)\s*=[^=]/g;
const IMPORT_RE = /import\s+([^;'"]+?)\s+from\s+["']([^"']+)["']/g;

const resolveLocalImport = (file, ident) => {
  const text = readText(file);
  let match;
  IMPORT_RE.lastIndex = 0;
  while ((match = IMPORT_RE.exec(text)) !== null) {
    const specifiers = match[1];
    const matchIdent = new RegExp(`(^|[{,\\s])${ident}($|[,\\s}])`).test(specifiers);
    if (!matchIdent) continue;
    const spec = match[2];
    if (!spec.startsWith(".")) return null;
    return path.resolve(path.dirname(file), spec);
  }
  return null;
};

const mixinSurface = (targetFile, ident) => {
  const text = readText(targetFile);
  if (!text) return null;
  const startRe = new RegExp(`export\\s+const\\s+${ident}\\s*=\\s*\\{`);
  const hit = startRe.exec(text);
  if (!hit) return null;
  const region = sliceRegion(text, hit.index + hit[0].length, /^\};?/m);
  return {
    methods: methodsFromRegion(region),
    properties: [
      ...new Set([
        ...membersFromText(region, FIELD_RE),
        ...membersFromText(region, THIS_MEMBER_RE),
      ]),
    ].sort(),
  };
};

const parseServiceFile = (file) => {
  const text = readText(file);
  if (!text) return null;

  const classes = {};
  let match;
  CLASS_RE.lastIndex = 0;
  while ((match = CLASS_RE.exec(text)) !== null) {
    const className = match[1];
    const region = sliceRegion(text, match.index + match[0].length, /^\}/m);
    classes[className] = {
      methods: methodsFromRegion(region),
      properties: [
        ...new Set([
          ...membersFromText(region, FIELD_RE),
          ...membersFromText(region, THIS_MEMBER_RE),
        ]),
      ].sort(),
      mixins: {},
    };
  }

  ASSIGN_PROTOTYPE_RE.lastIndex = 0;
  while ((match = ASSIGN_PROTOTYPE_RE.exec(text)) !== null) {
    const [, className, ident] = match;
    if (!classes[className]) continue;
    const targetFile = resolveLocalImport(file, ident);
    if (!targetFile || !fs.existsSync(targetFile)) continue;
    const surface = mixinSurface(targetFile, ident);
    if (!surface) continue;
    classes[className].mixins[rel(targetFile)] = surface.methods;
    classes[className].properties = [
      ...new Set([...classes[className].properties, ...surface.properties]),
    ].sort();
  }

  const instances = {};
  EXPORT_INSTANCE_RE.lastIndex = 0;
  while ((match = EXPORT_INSTANCE_RE.exec(text)) !== null) instances[match[1]] = match[2];

  const windowGlobals = [];
  WINDOW_ASSIGN_RE.lastIndex = 0;
  while ((match = WINDOW_ASSIGN_RE.exec(text)) !== null) windowGlobals.push(match[1]);

  return {
    instances,
    classes,
    windowGlobals: [...new Set(windowGlobals)].sort(),
  };
};

const allMethodsOf = (service, className) => {
  const entry = service.classes[className];
  if (!entry) return [];
  const names = new Set(entry.methods);
  for (const names2 of Object.values(entry.mixins)) names2.forEach((n) => names.add(n));
  return [...names];
};

// همهٔ اعضای قابل‌دسترسی از بیرون: متدها + ویژگی‌ها + متدهای mixin
const allMembersOf = (service, className) => {
  const entry = service.classes[className];
  if (!entry) return [];
  return [
    ...new Set([...entry.methods, ...(entry.properties || []), ...Object.values(entry.mixins).flat()]),
  ];
};

// آیا این فایل خودش شناسه را به‌صورت محلی اعلام کرده؟ (سایه‌اندازی مثل
// `const modalService = window.bookmarksModalService;` نباید نقض قرارداد شمرده شود)
const locallyDeclares = (text, ident) =>
  new RegExp(`(?:const|let|var)\\s+${ident}\\b`).test(text) ||
  new RegExp(`\\b${ident}\\s*=\\s*window\\.`).test(text);

// ---------- ۱) سطح عمومی فعلی ----------
const allFiles = walk(SRC_ROOT);
const jsFiles = allFiles.filter((f) => f.endsWith(".js"));
const corpus = allFiles
  .filter((f) => f.endsWith(".js") || f.endsWith(".html"))
  .map((file) => ({ file, rel: rel(file), text: readText(file) }));

const sortObject = (obj) =>
  Object.fromEntries(
    Object.keys(obj)
      .sort()
      .map((key) => [key, obj[key]]),
  );

const current = {};
for (const file of jsFiles) {
  const parsed = parseServiceFile(file);
  if (!parsed) continue;
  const hasSurface =
    Object.keys(parsed.classes).length > 0 ||
    Object.keys(parsed.instances).length > 0 ||
    parsed.windowGlobals.length > 0;
  if (!hasSurface) continue;
  const classes = {};
  for (const [name, entry] of Object.entries(parsed.classes)) {
    classes[name] = {
      methods: [...new Set(entry.methods)].sort(),
      properties: [...new Set(entry.properties || [])].sort(),
      mixins: sortObject(
        Object.fromEntries(
          Object.entries(entry.mixins).map(([f, names]) => [f, [...names].sort()]),
        ),
      ),
    };
  }
  current[rel(file)] = {
    instances: sortObject(parsed.instances),
    classes: sortObject(classes),
    windowGlobals: parsed.windowGlobals,
  };
}
const currentServices = sortObject(current);
const currentGlobals = [
  ...new Set(Object.values(currentServices).flatMap((s) => s.windowGlobals)),
].sort();

// ---------- ۲) قرارداد فراخوانی از بیرون فایل ----------
const contractViolations = [];
const dormantOptionalCalls = [];
for (const [servicePath, service] of Object.entries(currentServices)) {
  for (const [instanceName, className] of Object.entries(service.instances)) {
    const known = new Set(allMembersOf(service, className));
    const usageRe = new RegExp(`\\b${instanceName}\\.([A-Za-z_$][\\w$]*)`, "g");
    const seen = new Set();
    const optionalSeen = new Set();
    for (const entry of corpus) {
      if (entry.rel === servicePath) continue;
      if (locallyDeclares(entry.text, instanceName)) continue;
      const lines = entry.text.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        usageRe.lastIndex = 0;
        let match;
        while ((match = usageRe.exec(lines[i])) !== null) {
          const member = match[1];
          if (known.has(member)) continue;
          // `x.foo?.()` صریحاً «اگر بود» را می‌پذیرد؛ پس نقض قرارداد نیست،
          // بلکه یافتهٔ اطلاعاتی (سیم‌کشی مردهٔ از قبل موجود) است.
          const optional = lines[i].slice(match.index + match[0].length).startsWith("?.");
          const key = `${instanceName}.${member}`;
          const bucket = optional ? optionalSeen : seen;
          if (bucket.has(key)) continue;
          bucket.add(key);
          const record = {
            instance: instanceName,
            member,
            service: servicePath,
            usedIn: entry.rel,
            line: i + 1,
          };
          if (optional) dormantOptionalCalls.push(record);
          else contractViolations.push(record);
        }
      }
    }
  }
}
contractViolations.sort((a, b) =>
  `${a.service}${a.member}`.localeCompare(`${b.service}${b.member}`),
);
dormantOptionalCalls.sort((a, b) =>
  `${a.service}${a.member}`.localeCompare(`${b.service}${b.member}`),
);

// ---------- ۳) بودجهٔ اندازهٔ متدها ----------
const lineNumberAt = (text, index) => text.slice(0, index).split(/\r?\n/).length;

const bigMethodsInFile = (file) => {
  const text = readText(file);
  const out = [];
  let match;
  const classRe = new RegExp(CLASS_RE.source, "gm");
  while ((match = classRe.exec(text)) !== null) {
    const start = match.index + match[0].length;
    const region = sliceRegion(text, start, /^\}/m);
    const offset = lineNumberAt(text, start) - 1;
    bigMethodsFromRegion(region, rel(file)).forEach((f) =>
      out.push({ ...f, line: f.line + offset }),
    );
  }
  const mixinRe = /export\s+const\s+([A-Za-z_$][\w$]*)\s*=\s*\{/gm;
  while ((match = mixinRe.exec(text)) !== null) {
    const start = match.index + match[0].length;
    const region = sliceRegion(text, start, /^\};?/m);
    const offset = lineNumberAt(text, start) - 1;
    bigMethodsFromRegion(region, rel(file)).forEach((f) =>
      out.push({ ...f, name: `${match[1]}.${f.name}`, line: f.line + offset }),
    );
  }
  return out;
};

const bigMethods = jsFiles
  .flatMap((file) => bigMethodsInFile(file))
  .filter((m) => m.size >= BIG_BUDGET)
  .sort((a, b) => b.size - a.size || a.file.localeCompare(b.file));

// ---------- ۴) اسنپ‌شات و مقایسه ----------
const buildSnapshot = () => ({
  version: 1,
  generatedBy: "Frontend/scripts/audit-service-surface.mjs",
  note:
    "قرارداد سطح عمومی سرویس‌ها. برای به‌روزرسانی عمدی: npm run audit:surface -- --snapshot",
  services: currentServices,
  globals: currentGlobals,
});

const loadSnapshot = () => {
  try {
    return JSON.parse(fs.readFileSync(SNAPSHOT_PATH, "utf8"));
  } catch {
    return null;
  }
};

const diffSnapshot = (snapshot) => {
  const result = {
    missingServices: [],
    addedServices: [],
    missingInstances: [],
    addedInstances: [],
    missingMethods: [],
    addedMethods: [],
    missingProperties: [],
    addedProperties: [],
    missingGlobals: [],
    addedGlobals: [],
  };
  const snapServices = snapshot.services || {};
  for (const [servicePath, snapService] of Object.entries(snapServices)) {
    const now = currentServices[servicePath];
    if (!now) {
      result.missingServices.push(servicePath);
      continue;
    }
    for (const inst of Object.keys(snapService.instances || {})) {
      if (!(inst in (now.instances || {})))
        result.missingInstances.push(`${inst} (${servicePath})`);
    }
    for (const inst of Object.keys(now.instances || {})) {
      if (!(inst in (snapService.instances || {})))
        result.addedInstances.push(`${inst} (${servicePath})`);
    }
    for (const [cls, snapEntry] of Object.entries(snapService.classes || {})) {
      const nowEntry = now.classes[cls];
      if (!nowEntry) {
        result.missingServices.push(`${servicePath}#${cls}`);
        continue;
      }
      const nowMethods = new Set(allMethodsOf(now, cls));
      const snapMethods = new Set([
        ...(snapEntry.methods || []),
        ...Object.values(snapEntry.mixins || {}).flat(),
      ]);
      for (const method of snapMethods) {
        if (!nowMethods.has(method))
          result.missingMethods.push(`${cls}.${method} (${servicePath})`);
      }
      for (const method of nowMethods) {
        if (!snapMethods.has(method)) result.addedMethods.push(`${cls}.${method} (${servicePath})`);
      }
      const nowProps = new Set(nowEntry.properties || []);
      const snapProps = new Set(snapEntry.properties || []);
      for (const prop of snapProps) {
        if (!nowProps.has(prop)) result.missingProperties.push(`${cls}.${prop} (${servicePath})`);
      }
      for (const prop of nowProps) {
        if (!snapProps.has(prop)) result.addedProperties.push(`${cls}.${prop} (${servicePath})`);
      }
    }
  }
  for (const servicePath of Object.keys(currentServices)) {
    if (!(servicePath in snapServices)) result.addedServices.push(servicePath);
  }
  const snapGlobals = new Set(snapshot.globals || []);
  const nowGlobals = new Set(currentGlobals);
  for (const name of snapGlobals) if (!nowGlobals.has(name)) result.missingGlobals.push(name);
  for (const name of nowGlobals) if (!snapGlobals.has(name)) result.addedGlobals.push(name);
  return result;
};

// ---------- ۵) گزارش و کد خروج ----------
const snapshot = loadSnapshot();
const diff = snapshot ? diffSnapshot(snapshot) : null;

const report = {
  root: PROJECT_ROOT.replace(/\\/g, "/"),
  scannedJsFiles: jsFiles.length,
  serviceFiles: Object.keys(currentServices).length,
  globals: currentGlobals.length,
  snapshotPath: SNAPSHOT_PATH.replace(/\\/g, "/"),
  snapshotFound: Boolean(snapshot),
  contractViolations,
  dormantOptionalCalls,
  bigMethodBudget: BIG_BUDGET,
  bigMethods,
  diff,
};

if (WRITE_SNAPSHOT) {
  fs.mkdirSync(path.dirname(SNAPSHOT_PATH), { recursive: true });
  fs.writeFileSync(SNAPSHOT_PATH, `${JSON.stringify(buildSnapshot(), null, 2)}\n`, "utf8");
  console.log("💾 اسنپ‌شات قرارداد سطح سرویس نوشته شد");
  console.log(`   ${report.snapshotPath}`);
  console.log(`   فایل‌های سرویس: ${report.serviceFiles}`);
  console.log(`   نام‌های سراسری window: ${report.globals}`);
  console.log(`   نقض قرارداد فراخوانی بیرونی: ${contractViolations.length}`);
  console.log("");
  console.log("ℹ️  از این پس `npm run audit:surface` هر عضو گم‌شده را با کد خروج ۱ گزارش می‌کند.");
  process.exitCode = 0;
} else {
  const listCount = (arr) => (Array.isArray(arr) ? arr.length : 0);
  if (AS_JSON) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log("🛡️  قرارداد سطح سرویس — فرانت‌اند");
    console.log(`   فایل‌های js اسکن‌شده: ${report.scannedJsFiles}`);
    console.log(`   فایل‌های سرویس: ${report.serviceFiles} · سراسری‌های window: ${report.globals}`);
    console.log("");

    if (!snapshot) {
      console.log("⚠️  اسنپ‌شات پیدا نشد؛ ابتدا یک‌بار بساز:");
      console.log("   npm run audit:surface -- --snapshot");
    } else if (diff) {
      const missing =
        listCount(diff.missingServices) +
        listCount(diff.missingInstances) +
        listCount(diff.missingMethods) +
        listCount(diff.missingProperties) +
        listCount(diff.missingGlobals);
      console.log(`📌 مقایسه با اسنپ‌شات (${report.snapshotPath}):`);
      console.log(`   گم‌شده → سرویس ${listCount(diff.missingServices)} · نمونه ${listCount(diff.missingInstances)} · متد ${listCount(diff.missingMethods)} · ویژگی ${listCount(diff.missingProperties)} · سراسری ${listCount(diff.missingGlobals)}`);
      const added =
        listCount(diff.addedServices) +
        listCount(diff.addedInstances) +
        listCount(diff.addedMethods) +
        listCount(diff.addedProperties) +
        listCount(diff.addedGlobals);
      console.log(`   افزوده (اطلاعی) → ${added} عضو`);
      [
        ...diff.missingServices,
        ...diff.missingInstances,
        ...diff.missingMethods,
        ...diff.missingProperties,
        ...diff.missingGlobals,
      ].forEach((item) => console.log(`   ❌ ${item}`));
      if (missing === 0) console.log("   ✅ هیچ عضوی گم نشده");
      [...diff.addedMethods, ...diff.addedProperties, ...diff.addedInstances, ...diff.addedGlobals, ...diff.addedServices].forEach(
        (item) => console.log(`   ➕ ${item}`),
      );
      console.log("");
    }

    console.log(`🔍 نقض قرارداد فراخوانی از بیرون فایل: ${contractViolations.length}`);
    if (contractViolations.length === 0) console.log("   ✅ همهٔ متدهای مصرف‌شده در سطح کلاس موجودند");
    contractViolations.forEach((v) =>
      console.log(`   ❌ ${v.instance}.${v.member}  ←  ${v.usedIn}:${v.line}  (${v.service})`),
    );
    console.log("");

    console.log(`🕳️ فراخوانی اختیاری به متد ناموجود (x.foo?.) — اطلاعی: ${dormantOptionalCalls.length}`);
    dormantOptionalCalls.forEach((v) =>
      console.log(`   ⚠️ ${v.instance}.${v.member}  ←  ${v.usedIn}:${v.line}  (${v.service})`),
    );
    console.log("");

    console.log(`📏 متدهای بزرگ‌تر از بودجهٔ ${BIG_BUDGET} خط: ${bigMethods.length}`);
    if (LIST_BIG || FAIL_ON_BIG) {
      bigMethods.forEach((m) => console.log(`   ${String(m.size).padStart(4)} خط  ${m.file}:${m.line}  ${m.name}`));
    } else if (bigMethods.length > 0) {
      console.log("   (برای فهرست کامل: npm run audit:big-methods)");
      bigMethods.slice(0, 5).forEach((m) => console.log(`   ${String(m.size).padStart(4)} خط  ${m.file}:${m.line}  ${m.name}`));
    } else {
      console.log("   ✅ هیچ متدی از بودجه بزرگ‌تر نیست");
    }
    console.log("");
  }

  const missingCount = diff
    ? listCount(diff.missingServices) +
      listCount(diff.missingInstances) +
      listCount(diff.missingMethods) +
      listCount(diff.missingProperties) +
      listCount(diff.missingGlobals)
    : 0;

  if (!snapshot) {
    console.error("❌ اسنپ‌شات موجود نیست (اول --snapshot را اجرا کن).");
    process.exitCode = 1;
  }
  if (missingCount > 0) {
    console.error(`❌ ${missingCount} عضو از سطح عمومی سرویس‌ها گم شد.`);
    process.exitCode = 1;
  }
  if (contractViolations.length > 0) {
    console.error(`❌ ${contractViolations.length} فراخوانی به متد ناموجود.`);
    process.exitCode = 1;
  }
  if (FAIL_ON_BIG && bigMethods.length > 0) {
    console.error(`❌ ${bigMethods.length} متد بزرگ‌تر از ${BIG_BUDGET} خط.`);
    process.exitCode = 1;
  }
}
