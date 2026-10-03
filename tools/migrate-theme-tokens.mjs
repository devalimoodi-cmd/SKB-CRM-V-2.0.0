// ============================================================
// tools/migrate-theme-tokens.mjs
// ------------------------------------------------------------
//  مهاجرت امن رنگ‌های hard-code به توکن‌های تم (موج ۴)
//   • الگو: var(--token, #کدرنگ-قدیم)  ⇒ بدون شکستن ظاهر در حالت روشن
//   • نگاشت فقط برای رنگ‌های «تک‌معنا»
//   • پس‌زمینه‌های سفید (background: #fff) → --bg-surface
//     (اما color:#fff روی پس‌زمینهٔ رنگی دست‌نخورده می‌ماند)
//   • بلوک‌های تعریف توکن (:root و html[data-theme="dark"]) دست‌نخورده می‌مانند
//   • idempotent: اجرای دوباره چیزی را دوبار نمی‌پیچد
//
//  اجرا:  node tools/migrate-theme-tokens.mjs [file1 file2 ...]
//         (بدون آرگومان → فهرست «لایهٔ مشترک» موج ۴.۱)
// ============================================================
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

// فهرست پیش‌فرض: لایهٔ مشترک (موج ۴.۱)
const SHARED_FILES = [
  "src/styles/global.css",
  "src/styles/info-pages.css",
  "src/styles/notification.css",
  "src/shared/layouts/Header/header.css",
  "src/shared/layouts/Footer/footer.css",
  "src/shared/layouts/Sidebar/sidebar.css",
  "src/shared/components/Breadcrumb/breadcrumb.css",
  "src/shared/components/Button/button.css",
  "src/shared/components/Card/card.css",
  "src/shared/components/ChartCard/chart-card.css",
  "src/shared/components/Dropdown/dropdown.css",
  "src/shared/components/Form/form.css",
  "src/shared/components/Loader/loader.css",
  "src/shared/components/Modal/modal.css",
  "src/shared/components/Pagination/pagination.css",
  "src/shared/components/Table/table.css",
  "src/shared/components/Tooltip/tooltip.css",
  "src/shared/components/Accordion/accordion.css",
].map((p) => path.join(ROOT, "Frontend", p));

// نگاشت هگز → توکن (مقادیر تک‌معنا)
const HEX_MAP = [
  ["#2c7a6e", "--primary"],
  ["#035552", "--primary-dark"],
  ["#4a9e8f", "--primary-light"],
  ["#1e293b", "--text-dark"],
  ["#64748b", "--text-gray"],
  ["#94a3b8", "--text-light"],
  ["#e2e8f0", "--border-color"],
  ["#eef2f6", "--border-light"],
  ["#cbd5e1", "--border-strong"],
  ["#f8fafc", "--bg-surface-2"],
  ["#f5f7fb", "--bg-body"],
  ["#10b981", "--success"],
  ["#f59e0b", "--warning"],
  ["#dc2626", "--danger"],
  ["#3b82f6", "--info"],
  // ✅ توکن‌های تکمیلی (موج ۵ — استایل‌های inline در JS)
  ["#475569", "--text-slate"],
  ["#334155", "--text-slate-strong"],
  ["#16a34a", "--success-strong"],
  ["#dcfce7", "--success-bg"],
  ["#ef4444", "--danger-strong"],
  ["#fee2e2", "--danger-bg"],
  ["#fef3c7", "--warning-bg"],
  ["#dbeafe", "--info-bg"],
  ["#f1f5f9", "--gray-100"],
  ["#e5e7eb", "--gray-200"],
];

const maskBlocks = (css) => {
  const saved = [];
  const keep = (block) => {
    saved.push(block);
    return `@@KEEP${saved.length - 1}@@`;
  };
  let out = css
    .replace(/:root\s*\{[^}]*\}/g, keep)
    .replace(/html\[data-theme="dark"\]\s*\{[^}]*\}/g, keep);
  // ✅ محافظت از تعریف متغیرهای CSS (اعم از سراسری یا محلی)
  // تا «مقدارِ تعریف» هرگز به var() تبدیل نشود (جلوگیری از خودارجاعی)
  out = out.replace(/^[ \t]*--[a-z0-9-]+\s*:[^;]*;[ \t]*$/gim, keep);
  return { out, saved };
};

const maskExistingVars = (css) => {
  const saved = [];
  const out = css.replace(/var\(--[a-z0-9-]+,\s*#[0-9a-fA-F]{3,8}\)/g, (m) => {
    saved.push(m);
    return `@@VAR${saved.length - 1}@@`;
  });
  return { out, saved };
};

const migrate = (src) => {
  const b = maskBlocks(src);
  const v = maskExistingVars(b.out);
  let out = v.out;

  // ۱) پس‌زمینه‌های سفید → --bg-surface
  out = out.replace(
    /(background(?:-color)?\s*:\s*)(#ffffff|#fff|white)\b/gi,
    (_m, prop, color) =>
      `${prop}var(--bg-surface, ${color.toLowerCase() === "white" ? "#fff" : color})`,
  );

  // ۲) نگاشت هگز → توکن
  for (const [hex, token] of HEX_MAP) {
    const re = new RegExp(hex.replace("#", "#"), "gi");
    out = out.replace(re, `var(${token}, ${hex})`);
  }

  // بازگردانی
  out = out.replace(/@@VAR(\d+)@@/g, (_m, i) => v.saved[Number(i)]);
  out = out.replace(/@@KEEP(\d+)@@/g, (_m, i) => b.saved[Number(i)]);
  return out;
};

// ============================================================
//  حالت JS: تبدیل رنگ‌ها فقط داخل اتریبیوت‌های style="..."
// ------------------------------------------------------------
//  • از یک پیمایشگر ساده استفاده می‌کند تا محتوای ${...} (که ممکن است
//    شامل " باشد) درست مدیریت شود.
//  • هرگز به منطق/رنگ‌های Chart.js (خارج از style) دست نمی‌زند.
// ============================================================
const mapInnerStyle = (inner) => {
  let out = inner;
  out = out.replace(
    /(background(?:-color)?\s*:\s*)(#ffffff|#fff|white)\b/gi,
    (_m, prop, color) =>
      `${prop}var(--bg-surface, ${
        color.toLowerCase() === "white" ? "#fff" : color
      })`,
  );
  for (const [hex, token] of HEX_MAP) {
    out = out.replace(new RegExp(hex, "gi"), `var(${token}, ${hex})`);
  }
  return out;
};

const migrateJsInline = (src) => {
  const OPEN = 'style="';
  let out = "";
  let i = 0;

  while (i < src.length) {
    const idx = src.indexOf(OPEN, i);
    if (idx === -1) {
      out += src.slice(i);
      break;
    }
    out += src.slice(i, idx + OPEN.length);

    let j = idx + OPEN.length;
    let depth = 0;
    let inner = "";
    while (j < src.length) {
      const ch = src[j];
      if (ch === "$" && src[j + 1] === "{") {
        depth++;
        inner += "${";
        j += 2;
        continue;
      }
      if (ch === "}" && depth > 0) {
        depth--;
        inner += "}";
        j++;
        continue;
      }
      if (ch === '"' && depth === 0) break;
      inner += ch;
      j++;
    }

    out += mapInnerStyle(inner);
    if (src[j] === '"') {
      out += '"';
      j++;
    }
    i = j;
  }
  return out;
};

const args = process.argv.slice(2);
const jsMode = args.includes("--js-inline");
const fileArgs = args
  .filter((a) => a !== "--js-inline")
  .map((p) => path.resolve(p));
// اسکن فایل‌های JS که اتریبیوت style="..." با رنگ دارند
const scanJs = () => {
  const rootDir = path.join(ROOT, "Frontend", "src");
  const found = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(abs);
      else if (entry.name.endsWith(".js")) {
        const text = fs.readFileSync(abs, "utf8");
        if (text.includes('style="') && /#[0-9a-fA-F]{3,8}\b/.test(text)) {
          found.push(abs);
        }
      }
    }
  };
  walk(rootDir);
  return found;
};

const targets = fileArgs.length ? fileArgs : jsMode ? scanJs() : SHARED_FILES;

let changed = 0;
for (const file of targets) {
  if (!fs.existsSync(file)) {
    console.log(`SKIP (missing): ${path.relative(ROOT, file)}`);
    continue;
  }
  const src = fs.readFileSync(file, "utf8");
  const out = jsMode ? migrateJsInline(src) : migrate(src);
  if (out === src) {
    console.log(`  ok (no change): ${path.relative(ROOT, file)}`);
    continue;
  }
  fs.writeFileSync(file, out, "utf8");
  const tokens = (out.match(/var\(--[a-z0-9-]+,\s*#/g) || []).length;
  console.log(`  ✔ migrated: ${path.relative(ROOT, file)}  (tokens=${tokens})`);
  changed++;
}

console.log(`\nDone. files changed = ${changed}`);
