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
  } else if (file.endsWith(".js")) {
    hexesIn(strip(jsStyleText(text))).forEach((h) => found.add(h));
  }
});

const targets = [...found].filter((h) => !EXCLUDE.has(h)).sort();

// ===== ساخت نقشه =====
const map = {};
targets.forEach((hex) => {
  map[hex] = { token: `--c-${hex.replace("#", "")}`, dark: darkFor(hex) };
});
fs.writeFileSync(MAP_OUT, JSON.stringify(map, null, 2) + "\n", "utf8");
console.log(`✅ ${targets.length} توکن ساخته شد → tools/theme-token-map.json`);

// ===== نوشتن بلوک‌ها در global.css =====
const START = "/* @@WAVE7-TOKENS-START@@ */";
const END = "/* @@WAVE7-TOKENS-END@@ */";

const lightLines = targets.map((hex) => `  ${map[hex].token}: ${hex};`);
const darkLines = targets.map((hex) => `  ${map[hex].token}: ${map[hex].dark};`);

const block = [
  START,
  "/* ===== توکن‌های تولیدشده (موج ۷) — رنگ‌های باقی‌مانده ===== */",
  ":root {",
  ...lightLines,
  "}",
  "",
  'html[data-theme="dark"] {',
  ...darkLines,
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
