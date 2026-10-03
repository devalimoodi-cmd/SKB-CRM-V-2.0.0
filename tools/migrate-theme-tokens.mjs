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
  // ✅ پالت تکمیلی (موج ۶)
  ["#0f172a", "--ink"],
  ["#0d9488", "--accent-teal"],
  ["#047857", "--success-deep"],
  ["#065f46", "--success-deeper"],
  ["#d1fae5", "--success-mist"],
  ["#ecfdf5", "--success-mist-2"],
  ["#bbf7d0", "--success-mist-3"],
  ["#a7f3d0", "--success-mist-4"],
  ["#f0fdf4", "--success-soft"],
  ["#b91c1c", "--danger-deep"],
  ["#fecaca", "--danger-mist"],
  ["#fca5a5", "--danger-brd"],
  ["#fef2f2", "--danger-soft"],
  ["#fffbeb", "--warning-soft"],
  ["#b45309", "--warning-deep"],
  ["#d97706", "--warning-deep-2"],
  ["#92400e", "--warning-deep-3"],
  ["#fcd34d", "--warning-brd"],
  ["#eff6ff", "--info-soft"],
  ["#2563eb", "--info-strong"],
  ["#1d4ed8", "--info-deep"],
  ["#93c5fd", "--info-brd"],
  ["#8b5cf6", "--violet"],
  ["#7c3aed", "--violet-deep"],
  ["#667eea", "--indigo"],
  ["#fafbfc", "--slate-mist"],
  ["#d8e0e8", "--slate-border"],
];

// ✅ توکن‌های تولیدشده (موج ۷) از فایل نقشه بارگذاری می‌شوند
try {
  const mapPath = path.join(ROOT, "tools", "theme-token-map.json");
  if (fs.existsSync(mapPath)) {
    const genMap = JSON.parse(fs.readFileSync(mapPath, "utf8"));
    for (const [hex, def] of Object.entries(genMap)) {
      if (def && def.token) HEX_MAP.push([hex, def.token]);
    }
  }
} catch {
  /* بی‌صدا */
}

// ✅ نگاشت مؤثر: حذف هگزهای تکراری (نگاشتِ معنایی اولویت دارد تا دوبارپیچ نشود)
const _seenHex = new Set();
const EFFECTIVE_HEX_MAP = [];
for (const [hex, token] of HEX_MAP) {
  const k = String(hex).toLowerCase();
  if (_seenHex.has(k)) continue;
  _seenHex.add(k);
  EFFECTIVE_HEX_MAP.push([hex, token]);
}

// ===== کمک‌کارهای رنگ (موج ۸) =====
const resolveToken = (hex) => {
  const low = String(hex).toLowerCase();
  for (const [h, t] of EFFECTIVE_HEX_MAP) if (h.toLowerCase() === low) return t;
  return null;
};

// سفیدِ داخل گرادیان‌ها → --bg-surface
const mapGradientWhite = (str) =>
  str.replace(/((?:linear|radial)-gradient\s*\([^)]*\))/gi, (grad) =>
    grad.replace(/(#ffffff|#fff)\b/gi, (c) => `var(--bg-surface, ${c})`),
  );

// rgba(r,g,b,α) → rgba(var(--x-rgb), α)
const RGBA_MAP = {
  "255,255,255": "--surface-rgb",
  "15,23,42": "--ink-rgb",
  "44,122,110": "--primary-rgb",
  "16,185,129": "--success-rgb",
  "52,211,153": "--success-rgb",
  "245,158,11": "--warning-rgb",
  "251,191,36": "--warning-rgb",
  "220,38,38": "--danger-rgb",
  "239,68,68": "--danger-rgb",
  "248,113,113": "--danger-rgb",
  "59,130,246": "--info-rgb",
  "96,165,250": "--info-rgb",
  "37,99,235": "--info-rgb",
  "139,92,246": "--violet-rgb",
  "102,126,234": "--violet-rgb",
};

const mapRgba = (str) =>
  str.replace(
    /rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,/g,
    (m, r, g, b) => {
      const token = RGBA_MAP[`${r},${g},${b}`];
      return token ? `rgba(var(${token}),` : m;
    },
  );

// ✅ «پس‌زمینهٔ تیره»: توکن‌های فلیپ‌شونده‌ی رنگ‌های تیره در پس‌زمینه → توکن «مقیمِ تیره» (-s)
const luminanceOfHex = (hex) => {
  let h = String(hex).replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b;
};

const DARK_SOURCE = new Set(
  EFFECTIVE_HEX_MAP.filter(([hex]) => luminanceOfHex(hex) < 110).map(([hex]) =>
    hex.toLowerCase(),
  ),
);

const mapDarkBackgrounds = (str) =>
  str.replace(
    /(background(?:-color)?\s*:\s*)([^;}]+)/gi,
    (_m, prop, value) => {
      // ۱) شکل var() فقط برای توکن‌های تولیدشدهٔ --c-* → توکن «مقیمِ تیره»
      //    (توکن‌های معنایی مثل --primary/--success مقدار تیرهٔ «طراحی‌شده» دارند و نباید عوض شوند)
      let fixed = value.replace(
        /var\(--c-[0-9a-f]{3,8},\s*(#[0-9a-fA-F]{3,8})\)/g,
        (mm, hex) =>
          DARK_SOURCE.has(hex.toLowerCase())
            ? `var(--c-${hex.replace("#", "")}-s, ${hex})`
            : mm,
      );

      // ۲) هگزهای خام (بیرون از var) → توکن «مقیمِ تیره»
      const savedVars = [];
      fixed = fixed.replace(/var\([^)]*\)/g, (m) => {
        savedVars.push(m);
        return `@@V${savedVars.length - 1}@@`;
      });
      for (const hex of DARK_SOURCE) {
        fixed = fixed.replace(
          new RegExp(hex, "gi"),
          `var(--c-${hex.replace("#", "")}-s, ${hex})`,
        );
      }
      fixed = fixed.replace(/@@V(\d+)@@/g, (_m, i) => savedVars[Number(i)]);

      return `${prop}${fixed}`;
    },
  );

const maskBlocks = (css, protectTokenDefs) => {
  const saved = [];
  const keep = (block) => {
    saved.push(block);
    return `@@KEEP${saved.length - 1}@@`;
  };
  let out = css
    .replace(/:root\s*\{[^}]*\}/g, keep)
    .replace(/[^{}]*\[data-theme="dark"\][^{}]*\{[^}]*\}/g, keep);
  // ✅ محافظت از تعریف توکن‌ها فقط در فایل مرکزی (global.css)
  // در بقیهٔ فایل‌ها، توکن‌های محلی هم مهاجرت می‌شوند (تم‌آگاه می‌شوند).
  if (protectTokenDefs) {
    out = out.replace(/^[ \t]*--[a-z0-9-]+\s*:[^;]*;[ \t]*$/gim, keep);
  }
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

const migrate = (src, { protectTokenDefs = false } = {}) => {
  const b = maskBlocks(src, protectTokenDefs);

  // ۰) توکن‌های محلیِ تم‌آگاه:  --name: #hex  ⇒  --name: var(--token, #hex)
  //    (فقط اگر نام توکن با توکن هدف یکسان نباشد تا خودارجاع نشود)
  if (!protectTokenDefs) {
    b.out = b.out.replace(
      /^([ \t]*)(--[a-z0-9-]+)(\s*:\s*)(#[0-9a-fA-F]{3,8})(\s*;)/gim,
      (m, ind, name, sep, hex, semi) => {
        const token = resolveToken(hex);
        if (!token || token === name) return m;
        return `${ind}${name}${sep}var(${token}, ${hex})${semi}`;
      },
    );
  }

  const v = maskExistingVars(mapDarkBackgrounds(b.out));
  let out = v.out;

  // ۱) پس‌زمینه‌های سفید → --bg-surface
  out = out.replace(
    /(background(?:-color)?\s*:\s*)(#ffffff|#fff|white)\b/gi,
    (_m, prop, color) =>
      `${prop}var(--bg-surface, ${color.toLowerCase() === "white" ? "#fff" : color})`,
  );

  // ۲) نگاشت هگز → توکن
  for (const [hex, token] of EFFECTIVE_HEX_MAP) {
    const re = new RegExp(hex.replace("#", "#"), "gi");
    out = out.replace(re, `var(${token}, ${hex})`);
  }

  // ۳) سفیدِ گرادیان‌ها + rgba → RGB token
  out = mapGradientWhite(out);
  out = mapRgba(out);

  // بازگردانی
  out = out.replace(/@@VAR(\d+)@@/g, (_m, i) => v.saved[Number(i)]);
  out = out.replace(/@@KEEP(\d+)@@/g, (_m, i) => b.saved[Number(i)]);
  return collapseNestedVars(out);
};

// ============================================================
//  حالت JS: تبدیل رنگ‌ها فقط داخل اتریبیوت‌های style="..."
// ------------------------------------------------------------
//  • از یک پیمایشگر ساده استفاده می‌کند تا محتوای ${...} (که ممکن است
//    شامل " باشد) درست مدیریت شود.
//  • هرگز به منطق/رنگ‌های Chart.js (خارج از style) دست نمی‌زند.
// ============================================================
const VAR_RX = /var\(--[a-z0-9-]+,\s*#[0-9a-fA-F]{3,8}\)/g;

// ✅ جمع‌کردن پیچش‌های تکراری: var(--x, var(--x, #hex)) → var(--x, #hex)
const collapseNestedVars = (str) => {
  let prev;
  let out = str;
  do {
    prev = out;
    // پیچش هم‌نام: var(--x, var(--x, #hex)) → var(--x, #hex)
    out = out.replace(
      /var\((--[a-z0-9-]+),\s*var\(\1,\s*(#[0-9a-fA-F]{3,8})\)\)/g,
      "var($1, $2)",
    );
    // پیچش نام‌متفاوت ولی هم‌منبع: var(--a, var(--b, #hex)) → var(--a, #hex)
    out = out.replace(
      /var\((--[a-z0-9-]+),\s*var\(--[a-z0-9-]+,\s*(#[0-9a-fA-F]{3,8})\)\)/g,
      "var($1, $2)",
    );
  } while (out !== prev);
  return out;
};

const mapInnerStyle = (inner) => {
  // ✅ اول پس‌زمینه‌های تیره (باید پیش از پنهان‌کردن var()ها اجرا شود)
  const darkFixed = mapDarkBackgrounds(inner);

  // محافظت از var(...)های موجود تا دوباره پیچیده نشوند
  const savedVars = [];
  let out = darkFixed.replace(VAR_RX, (m) => {
    savedVars.push(m);
    return `@@IV${savedVars.length - 1}@@`;
  });

  out = out.replace(
    /(background(?:-color)?\s*:\s*)(#ffffff|#fff|white)\b/gi,
    (_m, prop, color) =>
      `${prop}var(--bg-surface, ${
        color.toLowerCase() === "white" ? "#fff" : color
      })`,
  );
  for (const [hex, token] of EFFECTIVE_HEX_MAP) {
    out = out.replace(new RegExp(hex, "gi"), `var(${token}, ${hex})`);
  }

  // سفیدِ گرادیان‌ها + rgba → RGB token
  out = mapGradientWhite(out);
  out = mapRgba(out);

  out = out.replace(/@@IV(\d+)@@/g, (_m, i) => savedVars[Number(i)]);
  return collapseNestedVars(out);
};

const migrateJsInline = (src) => {
  // (۱) بلوک‌های <style>...</style> داخل رشته‌های JS = CSS واقعی → با منطق CSS مهاجرت می‌شوند
  let withStyles = src.replace(
    /(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi,
    (_m, open, css, close) => `${open}${migrate(css)}${close}`,
  );

  // (۲) اتریبیوت‌های style="..." (با پیمایشگر برای مدیریت ${...})
  const OPEN = 'style="';
  let out = "";
  let i = 0;

  while (i < withStyles.length) {
    const idx = withStyles.indexOf(OPEN, i);
    if (idx === -1) {
      out += withStyles.slice(i);
      break;
    }
    out += withStyles.slice(i, idx + OPEN.length);

    let j = idx + OPEN.length;
    let depth = 0;
    let inner = "";
    while (j < withStyles.length) {
      const ch = withStyles[j];
      if (ch === "$" && withStyles[j + 1] === "{") {
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
    if (withStyles[j] === '"') {
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
      else if (
        entry.name.endsWith(".js") ||
        entry.name.endsWith(".html")
      ) {
        const text = fs.readFileSync(abs, "utf8");
        const hasStyle = text.includes('style="') || /<style\b/i.test(text);
        if (hasStyle && /#[0-9a-fA-F]{3,8}\b/.test(text)) {
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
  // ⛔ global.css توسط gen-theme-tokens.mjs مدیریت میشود (پر از تعریف توکن) → مهاجرت نمیشود
  if (/[\\/]styles[\\/]global\.css$/i.test(file)) {
    console.log(`  skip (managed by gen): ${path.relative(ROOT, file)}`);
    continue;
  }
  const src = fs.readFileSync(file, "utf8");
  const isCss = file.toLowerCase().endsWith(".css");
  const out = isCss
    ? migrate(src, { protectTokenDefs: false })
    : migrateJsInline(src);
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
