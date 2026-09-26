// ============================================================
// scripts/audit-dead-exports.mjs
// گزارش «export های بدون مصرف‌کننده» و «فایل‌های بی‌ارجاع» — فرانت‌اند
// اجرا:  npm run audit:dead-exports      (در پوشهٔ Frontend)
// ------------------------------------------------------------
// گزینه‌ها:
//   --json             خروجی JSON روی stdout
//   --fail-on-dead     اگر export بی‌مصرف پیدا شد، با کد ۱ خارج شو
//   --fail-on-orphan   اگر فایل بی‌ارجاع پیدا شد، با کد ۱ خارج شو
// ------------------------------------------------------------
// روش کار:
//   ۱) در فایل‌های src/**/*.js نام‌های صادرشده (export const/function/class
//      و export { ... }) استخراج می‌شود.
//   ۲) هر نام در کل src (js و html) جست‌وجو و ارجاع بیرون از فایل تعریف
//      شمرده می‌شود.
//   ۳) هر فایل js که نه با import کشیده می‌شود و نه در HTML با
//      <script src="..."> بارگذاری می‌شود، «بی‌ارجاع» گزارش می‌شود.
// ⚠️ محدودیت: مصرف پویا (import با رشتهٔ متغیر، window[name]) دیده نمی‌شود؛
//    خروجی «کاندید بازبینی» است، نه حکم قطعی.
// ============================================================
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(SCRIPT_DIR, "..");
const SRC_ROOT = path.join(PROJECT_ROOT, "src");
const SKIP_DIRS = new Set(["node_modules", ".git", "vendor", "dist", "build"]);

const args = process.argv.slice(2);
const hasFlag = (name) => args.includes(`--${name}`);
const AS_JSON = hasFlag("json");
const FAIL_ON_DEAD = hasFlag("fail-on-dead");
const FAIL_ON_ORPHAN = hasFlag("fail-on-orphan");

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
    return fs.readFileSync(file, "utf8");
  } catch {
    return "";
  }
};

const allFiles = walk(SRC_ROOT);
const jsFiles = allFiles.filter((f) => f.endsWith(".js"));
const htmlFiles = allFiles.filter((f) => f.endsWith(".html"));
const corpus = [...jsFiles, ...htmlFiles].map((file) => ({
  file,
  rel: rel(file),
  text: readText(file),
}));

// ---------- ۱) استخراج export ها ----------
const EXPORT_DECL =
  /^\s*export\s+(?:async\s+)?(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/gm;
const EXPORT_LIST = /^\s*export\s*\{([^}]*)\}/gm;

const exportsByFile = new Map();
for (const file of jsFiles) {
  const text = readText(file);
  if (!text) continue;
  const names = new Set();

  let match;
  EXPORT_DECL.lastIndex = 0;
  while ((match = EXPORT_DECL.exec(text)) !== null) names.add(match[1]);

  EXPORT_LIST.lastIndex = 0;
  while ((match = EXPORT_LIST.exec(text)) !== null) {
    match[1]
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => item.split(/\s+as\s+/).pop().trim())
      .filter((name) => /^[A-Za-z_$][\w$]*$/.test(name))
      .forEach((name) => names.add(name));
  }

  if (names.size > 0) exportsByFile.set(file, [...names]);
}

const countReferences = (name, ownerFile) => {
  const pattern = new RegExp(`\\b${name}\\b`);
  let outside = 0;
  for (const { file, text } of corpus) {
    if (file === ownerFile) continue;
    if (pattern.test(text)) outside += 1;
  }
  return outside;
};

const deadExportFindings = [];
for (const [file, names] of exportsByFile) {
  const dead = names.filter((name) => countReferences(name, file) === 0);
  if (dead.length > 0) {
    deadExportFindings.push({
      file: rel(file),
      totalExports: names.length,
      dead,
    });
  }
}
deadExportFindings.sort((a, b) => b.dead.length - a.dead.length);

// ---------- ۲) فایل‌های js بی‌ارجاع ----------
const importedByJs = (file) => {
  const base = path.basename(file);
  const pattern = new RegExp(`(import\\s*\\(|from\\s+|import\\s+)[^;\\n]*${base}\\b`);
  return corpus.some((c) => c.file !== file && c.text.includes(base) && pattern.test(c.text));
};
const referencedByScriptTag = (file) => {
  const base = path.basename(file);
  return corpus.some(
    (c) => c.file !== file && c.text.includes("<script") && c.text.includes(base),
  );
};

const orphanFiles = jsFiles
  .filter((file) => !importedByJs(file) && !referencedByScriptTag(file))
  .map((file) => rel(file))
  .sort();

const report = {
  root: PROJECT_ROOT.replace(/\\/g, "/"),
  scannedJsFiles: jsFiles.length,
  filesWithExports: exportsByFile.size,
  deadExportCount: deadExportFindings.reduce((sum, f) => sum + f.dead.length, 0),
  deadExports: deadExportFindings,
  orphanCount: orphanFiles.length,
  orphanFiles,
};

if (AS_JSON) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log("🕵️  گزارش کد مرده/بی‌ارجاع — فرانت‌اند");
  console.log(`   فایل‌های js اسکن‌شده: ${report.scannedJsFiles}`);
  console.log(`   فایل‌های دارای export: ${report.filesWithExports}`);
  console.log("");
  console.log(`🔗 export بدون ارجاع بیرونی: ${report.deadExportCount}`);
  if (deadExportFindings.length === 0) {
    console.log("   ✅ export بدون مصرف‌کننده‌ای پیدا نشد");
  } else {
    deadExportFindings.forEach((f) => {
      console.log(`   📄 ${f.file}  (${f.dead.length}/${f.totalExports})`);
      f.dead.forEach((name) => console.log(`      - ${name}`));
    });
  }
  console.log("");
  console.log(`🧟 فایل‌های js بی‌ارجاع (نه import، نه <script src>): ${report.orphanCount}`);
  if (orphanFiles.length === 0) {
    console.log("   ✅ فایل بی‌ارجاعی پیدا نشد");
  } else {
    orphanFiles.forEach((file) => console.log(`   - ${file}`));
  }
  console.log("");
  console.log(
    "ℹ️  مصرف پویا (import با رشته یا window[name]) دیده نمی‌شود؛ نتایج را بازبینی کن.",
  );
}

if (FAIL_ON_DEAD && report.deadExportCount > 0) {
  console.error(`\n❌ ${report.deadExportCount} export بدون مصرف‌کننده پیدا شد.`);
  process.exitCode = 1;
}
if (FAIL_ON_ORPHAN && report.orphanCount > 0) {
  console.error(`\n❌ ${report.orphanCount} فایل js بی‌ارجاع پیدا شد.`);
  process.exitCode = 1;
}
