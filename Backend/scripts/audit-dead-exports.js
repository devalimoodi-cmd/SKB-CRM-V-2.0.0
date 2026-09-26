// ============================================================
// scripts/audit-dead-exports.js
// گزارش «export های بدون مصرف‌کننده» در بک‌اند (فقط خواندنی)
// اجرا:  npm run audit:dead-exports      (در پوشهٔ Backend)
// ------------------------------------------------------------
// گزینه‌ها:
//   --json          خروجی JSON روی stdout
//   --fail-on-dead  اگر export بی‌مصرف پیدا شد، با کد ۱ خارج شو
// ------------------------------------------------------------
// روش کار:
//   ۱) در فایل‌های .js پروژه، نام‌های صادرشده را استخراج می‌کند
//      (module.exports = { ... }  و  exports.NAME = ...)
//   ۲) هر نام را در کل کد (فایل‌های .js/.mjs) جست‌وجو می‌کند و
//      ارجاع‌های بیرون از فایل تعریف را می‌شمارد.
//   ۳) نام بدون ارجاع بیرونی = کاندید کد مرده (نه اثبات قطعی!)
// ⚠️ محدودیت‌ها: صادر‌های پویا (بازتاب/رشته)، مصرف از طریق مسیر
//    فایل (require داینامیک) و مصرف در مستندات شمرده نمی‌شوند؛
//    خروجی این اسکریپت «کاندید بازبینی» است، نه حکم قطعی.
// ============================================================
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const PROJECT_ROOT = path.join(__dirname, "..");
const SCAN_ROOTS = [
  "controllers",
  "routes",
  "services",
  "utils",
  "middleware",
  "validations",
  "models",
];
const SKIP_DIRS = new Set(["node_modules", ".git", "uploads", "logs"]);
const CODE_EXT = new Set([".js", ".mjs"]);

const args = process.argv.slice(2);
const hasFlag = (name) => args.includes(`--${name}`);
const AS_JSON = hasFlag("json");
const FAIL_ON_DEAD = hasFlag("fail-on-dead");

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
    if (!entry.isFile()) continue;
    acc.push(full);
  }
  return acc;
};

const rel = (file) => path.relative(PROJECT_ROOT, file).replace(/\\/g, "/");

const allFiles = SCAN_ROOTS.flatMap((root) => walk(path.join(PROJECT_ROOT, root)));
const codeFiles = allFiles.filter((f) => CODE_EXT.has(path.extname(f).toLowerCase()));

const corpus = codeFiles.map((file) => {
  let text = "";
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    text = "";
  }
  return { file, text };
});

// ---------- استخراج نام‌های صادرشده ----------
const OBJECT_EXPORTS = /module\.exports\s*=\s*\{([^}]*)\}/g;
const MEMBER_EXPORTS = /^\s*(?:module\.exports|exports)\.([A-Za-z_$][\w$]*)\s*=/gm;

const parseNames = (body) =>
  body
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.split(":")[0].trim())
    .map((item) => item.replace(/^\.\.\./, "").trim())
    .filter((name) => /^[A-Za-z_$][\w$]*$/.test(name));

const exportsByFile = new Map();
const filesToScan = codeFiles.filter((f) => !/^scripts\//.test(rel(f)));

for (const file of filesToScan) {
  const text = corpus.find((c) => c.file === file)?.text || "";
  const names = new Set();

  let match;
  OBJECT_EXPORTS.lastIndex = 0;
  while ((match = OBJECT_EXPORTS.exec(text)) !== null) {
    // فقط بلوک آخر (module.exports نهایی) معمولاً کامل است؛ همه را می‌خوانیم
    parseNames(match[1]).forEach((name) => names.add(name));
  }

  MEMBER_EXPORTS.lastIndex = 0;
  while ((match = MEMBER_EXPORTS.exec(text)) !== null) {
    names.add(match[1]);
  }

  if (names.size > 0) exportsByFile.set(file, [...names]);
}

// ---------- شمارش ارجاع‌ها ----------
const countReferences = (name, ownerFile) => {
  const pattern = new RegExp(`\\b${name}\\b`);
  let outside = 0;
  for (const { file, text } of corpus) {
    if (file === ownerFile) continue;
    if (pattern.test(text)) outside += 1;
  }
  return outside;
};

const findings = [];
for (const [file, names] of exportsByFile) {
  const dead = names.filter((name) => countReferences(name, file) === 0);
  if (dead.length > 0) {
    findings.push({ file: rel(file), totalExports: names.length, dead });
  }
}
findings.sort((a, b) => b.dead.length - a.dead.length);

const deadCount = findings.reduce((sum, f) => sum + f.dead.length, 0);
const report = {
  root: PROJECT_ROOT.replace(/\\/g, "/"),
  scannedFiles: filesToScan.length,
  filesWithExports: exportsByFile.size,
  deadExportCount: deadCount,
  findings,
};

if (AS_JSON) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log("🕵️  گزارش export های بدون مصرف‌کننده — بک‌اند");
  console.log(`   فایل‌های اسکن‌شده: ${report.scannedFiles}`);
  console.log(`   فایل‌های دارای export: ${report.filesWithExports}`);
  console.log(`   export بدون ارجاع بیرونی: ${deadCount}`);
  console.log("");
  if (findings.length === 0) {
    console.log("   ✅ export بدون مصرف‌کننده‌ای پیدا نشد");
  } else {
    findings.forEach((f) => {
      console.log(`   📄 ${f.file}  (${f.dead.length}/${f.totalExports})`);
      f.dead.forEach((name) => console.log(`      - ${name}`));
    });
  }
  console.log("");
  console.log(
    "ℹ️  این فهرست «کاندید بازبینی» است: مصرف پویا (رشته/require داینامیک) دیده نمی‌شود.",
  );
}

if (FAIL_ON_DEAD && deadCount > 0) {
  console.error(`\n❌ ${deadCount} export بدون مصرف‌کننده پیدا شد.`);
  process.exitCode = 1;
}
