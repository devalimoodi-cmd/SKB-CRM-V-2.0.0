// ============================================================
// tools/gen-theme-tokens.mjs   (موج ۷ — یکدست‌سازی پالت)
// ------------------------------------------------------------
//  • رنگ‌های hard-code باقی‌مانده را در CSS و «بلوک‌های style داخل JS»
//    پیدا می‌کند (بدون fallbackهای var و بدون تعریف‌های توکن).
//  • سفیدِ متن و رنگ‌های گرادیانی/تزئینی (allowlist) مستثنا هستند.
//  • برای هر رنگ باقی‌مانده یک توکن می‌سازد و مقدار «تیره» را با قاعدهٔ
//    روشنایی/اشباع محاسبه می‌کند.
//  • خروجی‌ها:
//      - tools/theme-token-map.json   (hex → { token, dark })
//      - بلوک تولیدی داخل Frontend/src/styles/global.css
//  اجرا:  node tools/gen-theme-tokens.mjs
// ============================================================
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC = path.join(ROOT, "Frontend", "src");
const GLOBAL_CSS = path.join(SRC, "styles", "global.css");
const MAP_OUT = path.join(ROOT, "tools", "theme-token-map.json");

// ===== مستثناها =====
const EXCLUDE = new Set([
  "#fff",
  "#ffffff",
  // گرادیان/تزئینی اشباع + رنگ نمودار (در هر دو تم درست دیده می‌شوند)
  "#00f2fe",
  "#4facfe",
  "#43e97b",
  "#38f9d7",
  "#f093fb",
  "#f5576c",
  "#764ba2",
  "#4a90e2",
]);

// ===== ابزار رنگ =====
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const hexToRgb = (hex) => {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const rgbToHsl = ([r, g, b]) => {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  const d = max - min;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return [h, s, l];
};

const hslToHex = ([h, s, l]) => {
  const f = (n) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    const v = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * v)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};

// ===== قاعدهٔ مقدار تیره =====
const darkFor = (hex) => {
  const [h, s, l] = rgbToHsl(hexToRgb(hex));

  // نزدیک‌سفید (سطح/حاشیهٔ خیلی روشن)
  if (l >= 0.9) {
    return s < 0.2 ? "#0f1729" : hslToHex([h, clamp(s, 0, 0.4), 0.18]);
  }
  // خاکستری‌ها
  if (s < 0.15) {
    if (l >= 0.72) return "#334155";
    if (l >= 0.45) return "#94a3b8";
    return "#cbd5e1";
  }
  // رنگی
  if (l >= 0.75) return hslToHex([h, clamp(s, 0, 0.6), 0.22]); // پس‌زمینهٔ ملایم
  if (l >= 0.5) return hslToHex([h, clamp(s, 0, 0.7), 0.62]); // متن متوسط
  return hslToHex([h, clamp(s, 0, 0.8), 0.68]); // عمیق/اشباع
};


// ===== اسکن =====
const strip = (css) =>
  css
    .replace(/var\(--[a-z0-9-]+,\s*#[0-9a-fA-F]{3,8}\)/g, "")
    .replace(/^\s*--[a-z0-9-]+\s*:[^;]*;/gm, "");

const hexesIn = (text) =>
  [...String(text).matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) =>
    m[0].toLowerCase(),
  );

const jsStyleText = (src) => {
  const blocks = src.match(/<style\b[^>]*>[\s\S]*?<\/style>/gi) || [];
  const attrs = src.match(/style="[^"]*"/g) || [];
  return [...blocks, ...attrs].join("\n");
};

const walk = (dir, cb) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(abs, cb);
    else cb(abs);
  }
};

// ===== جمع‌آوری رنگ‌های باقی‌مانده =====
const found = new Set();
walk(SRC, (file) => {
  const text = fs.readFileSync(file, "utf8");
  if (file.endsWith(".css")) {
    hexesIn(strip(text)).forEach((h) => found.add(h));
  } else if (file.endsWith(".js") || file.endsWith(".html")) {
    hexesIn(strip(jsStyleText(text))).forEach((h) => found.add(h));
  }
});

const targets = [...found].filter((h) => !EXCLUDE.has(h)).sort();

// ===== جمع‌آوری توکن‌های موجود از ارجاع‌های var(--c-xxxxxx, #hex) =====
// (خودترمیمی: توکن‌هایی که قبلاً ساخته و در کد ارجاع شده‌اند، حفظ می‌شوند)
const refs = new Map(); // hex → token
walk(SRC, (file) => {
  if (!/\.(css|js|html)$/i.test(file)) return;
  const text = fs.readFileSync(file, "utf8");
  for (const m of text.matchAll(
    /var\(--[a-z0-9-]+,\s*(#[0-9a-fA-F]{3,8})\)/gi,
  )) {
    const hex = m[1].toLowerCase();
    refs.set(hex, `--c-${hex.replace("#", "")}`);
  }
});

// ===== ساخت نقشه (ادغام: موجود + ارجاع‌ها + جدیدها) =====
let existing = {};
try {
  if (fs.existsSync(MAP_OUT)) {
    existing = JSON.parse(fs.readFileSync(MAP_OUT, "utf8"));
  }
} catch {
  existing = {};
}

const map = { ...existing };
const ensure = (hex, token) => {
  const h = hex.toLowerCase();
  if (!map[h]) map[h] = { token };
  if (!map[h].dark) map[h].dark = darkFor(h);
};
refs.forEach((token, hex) => ensure(hex, token));
targets.forEach((hex) => ensure(hex, `--c-${hex.replace("#", "")}`));

const allHexes = Object.keys(map).sort();
fs.writeFileSync(MAP_OUT, JSON.stringify(map, null, 2) + "\n", "utf8");
console.log(
  `✅ ${allHexes.length} توکن در نقشه (${refs.size} از ارجاع‌ها، ${targets.length} یافت‌شده)`,
);

// ===== نوشتن بلوک‌ها در global.css (همهٔ توکن‌های نقشه) =====
const START = "/* @@WAVE7-TOKENS-START@@ */";
const END = "/* @@WAVE7-TOKENS-END@@ */";

const lightLines = allHexes.map((hex) => `  ${map[hex].token}: ${hex};`);
const darkLines = allHexes.map(
  (hex) => `  ${map[hex].token}: ${map[hex].dark};`,
);

// ===== توکن‌های «مقیمِ تیره» برای پس‌زمینه‌های تیره (موج ۹) =====
// رنگ‌هایی که در حالت روشن «تیره» هستند و در پس‌زمینه استفاده می‌شوند نباید
// در تم تیره به رنگ روشن بپرند؛ برایشان توکن `-s` می‌سازیم که تیره می‌ماند.
const luminanceOf = (hex) => {
  const [r, g, b] = hexToRgb(hex);
  return 0.299 * r + 0.587 * g + 0.114 * b;
};
const darkSources = allHexes.filter((h) => luminanceOf(h) < 110);
const stayLight = darkSources.map((h) => `  --c-${h.replace("#", "")}-s: ${h};`);
const stayDark = darkSources.map((h) => {
  const [hh, ss, ll] = rgbToHsl(hexToRgb(h));
  const shade = hslToHex([hh, clamp(ss, 0, 0.7), Math.min(0.34, ll + 0.1)]);
  return `  --c-${h.replace("#", "")}-s: ${shade};`;
});

const block = [
  START,
  "/* ===== توکن‌های تولیدشده (موج ۷) + «مقیمِ تیره» (موج ۹) ===== */",
  ":root {",
  ...lightLines,
  ...stayLight,
  "}",
  "",
  'html[data-theme="dark"] {',
  ...darkLines,
  ...stayDark,
  "}",
  END,
].join("\n");

let css = fs.readFileSync(GLOBAL_CSS, "utf8");
const si = css.indexOf(START);
const ei = css.indexOf(END);
if (si !== -1 && ei !== -1 && ei > si) {
  css = css.slice(0, si) + block + css.slice(ei + END.length);
} else {
  css = css.trimEnd() + "\n\n" + block + "\n";
}
fs.writeFileSync(GLOBAL_CSS, css, "utf8");
console.log("✅ بلوک توکن‌ها در global.css نوشته شد");
