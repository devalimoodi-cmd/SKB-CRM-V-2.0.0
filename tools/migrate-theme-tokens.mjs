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

const files = process.argv.slice(2).map((p) => path.resolve(p));
const targets = files.length ? files : SHARED_FILES;

let changed = 0;
for (const file of targets) {
  if (!fs.existsSync(file)) {
    console.log(`SKIP (missing): ${path.relative(ROOT, file)}`);
    continue;
  }
  const src = fs.readFileSync(file, "utf8");
  const out = migrate(src);
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
