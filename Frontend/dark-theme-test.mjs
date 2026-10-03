// ============================================================
//  گارد «موج ۴ — تم روشن/تیره» (بدون نیاز به بک‌اند)
// ------------------------------------------------------------
//  موارد بررسی‌شده:
//   ۱) توکن‌های سراسری در global.css  (:root + html[data-theme="dark"])
//   ۲) سرویس تم (theme.service.js): کلید skb_theme + متدهای کلیدی
//   ۳) تزریق بوت‌استرپ تم بدون فلاش در server.js
//   ۴) بوت‌استرپ در HTML سروشده و **قبل از** CSS قرار دارد
//   ۵) صفحه‌های پروفایل/تنظیمات سالم (۲۰۰) و دارای بوت‌استرپ
//   ۶) صفحهٔ ۴۰۴ هم بوت‌استرپ دارد
//  اجرا:  npm run test:theme      (در پوشهٔ Frontend)
// ============================================================
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const PORT = 3997;
const results = [];
const check = (name, ok, extra = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}${extra ? " :: " + extra : ""}`);
};

const here = import.meta.dirname;
const read = (rel) => fs.readFileSync(path.join(here, rel), "utf8");

// ============================================================
//  بخش ۱) بررسی‌های استاتیک فایل‌ها
// ============================================================
let globalCss = "";
let themeServiceSrc = "";
let serverSrc = "";
let settingsServiceSrc = "";
let chartDashSrc = "";
let hatcherySrc = "";

try {
  globalCss = read("src/styles/global.css");
  themeServiceSrc = read("src/core/services/theme.service.js");
  serverSrc = read("server.js");
  settingsServiceSrc = read("src/features/settings/settings.service.js");
  chartDashSrc = read(
    "src/features/customer-info/sections/chart-dashboard/chart-dashboard.service.js",
  );
  hatcherySrc = read(
    "src/features/customer-info/sections/hatchery/hatchery.service.js",
  );
} catch (error) {
  check("فایل‌های تم قابل خواندن هستند", false, error.message);
}

check("global.css: بلوک توکن‌های روشن (:root)", /:root\s*\{/.test(globalCss));
check(
  'global.css: بلوک توکن‌های تیره (html[data-theme="dark"])',
  /html\[data-theme="dark"\]\s*\{/.test(globalCss),
);
check(
  "global.css: توکن‌های هستهٔ لازم موجودند",
  ["--primary", "--bg-body", "--bg-surface", "--text-dark", "--border-color"].every(
    (t) => globalCss.includes(t),
  ),
);

check(
  "theme.service.js: نمونهٔ themeService صادر شده",
  /export\s+const\s+themeService\s*=/.test(themeServiceSrc),
);
check(
  "theme.service.js: کلید skb_theme و متدهای کلیدی",
  themeServiceSrc.includes("skb_theme") &&
    /setTheme\s*\(/.test(themeServiceSrc) &&
    /resolve\s*\(/.test(themeServiceSrc) &&
    /apply\s*\(/.test(themeServiceSrc),
);

check(
  "server.js: بوت‌استرپ تم تعریف شده (THEME_BOOTSTRAP)",
  serverSrc.includes("THEME_BOOTSTRAP") &&
    serverSrc.includes("injectThemeBootstrap"),
);
check(
  "server.js: renderPageHtml بوت‌استرپ را زنجیره می‌کند",
  /renderPageHtml[\s\S]{0,200}injectThemeBootstrap/.test(serverSrc) ||
    /injectThemeBootstrap\([\s\S]{0,200}injectPageLoader/.test(serverSrc),
);

check(
  "settings.service.js: از themeService استفاده می‌کند (تک‌منبع حقیقت)",
  /import\s*\{\s*themeService\s*\}/.test(settingsServiceSrc) &&
    /themeService\.apply\(/.test(settingsServiceSrc),
);

// ===== موج ۵: توکن‌های تکمیلی + استایل‌های inline داخل JS + تم نمودار =====
check(
  "global.css: توکن‌های تکمیلی موج ۵ موجودند",
  [
    "--text-slate",
    "--success-bg",
    "--danger-bg",
    "--info-bg",
    "--gray-100",
  ].every((t) => globalCss.includes(t)),
);
check(
  "JS inline: استایل‌های رنگی داخل JS به توکن تبدیل شده‌اند (نمونهٔ hatchery)",
  hatcherySrc.includes('style="') && hatcherySrc.includes("var(--"),
);
check(
  "chart-dashboard: رنگ grid از توکن خوانده می‌شود",
  chartDashSrc.includes("chartThemeService.tokens().grid"),
);

// ===== موج ۷: هیچ رنگ «حساس به تمِ» باقی‌مانده‌ای نباشد =====
// (به‌جز سفیدِ متن و رنگ‌های گرادیانی/تزئینیِ allowlist)
const THEME_EXCLUDE = new Set([
  "#fff",
  "#ffffff",
  "#00f2fe",
  "#4facfe",
  "#43e97b",
  "#38f9d7",
  "#f093fb",
  "#f5576c",
  "#764ba2",
  "#4a90e2",
]);

const stripForGuard = (text) =>
  String(text)
    .replace(/var\(--[a-z0-9-]+,\s*#[0-9a-fA-F]{3,8}\)/g, "")
    .replace(/^\s*--[a-z0-9-]+\s*:[^;]*;/gm, "");

const hexesOf = (text) =>
  [...stripForGuard(text).matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) =>
    m[0].toLowerCase(),
  );

const collectRemaining = () => {
  const out = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(abs);
      } else if (entry.name.endsWith(".css")) {
        hexesOf(fs.readFileSync(abs, "utf8")).forEach((h) => out.push(h));
      } else if (entry.name.endsWith(".js") || entry.name.endsWith(".html")) {
        const src = fs.readFileSync(abs, "utf8");
        const parts =
          src.match(/<style\b[^>]*>[\s\S]*?<\/style>|style="[^"]*"/gi) || [];
        parts.forEach((p) => hexesOf(p).forEach((h) => out.push(h)));
      }
    }
  };
  walk(path.join(here, "src"));
  return out.filter((h) => !THEME_EXCLUDE.has(h));
};

const remainingHex = collectRemaining();
check(
  "موج ۷: هیچ رنگ حساسِ باقی‌مانده‌ای در CSS/JS نیست",
  remainingHex.length === 0,
  `remaining=${remainingHex.length}${
    remainingHex.length ? " → " + [...new Set(remainingHex)].slice(0, 8).join(",") : ""
  }`,
);

// ============================================================
//  بخش ۲) بررسی زمان اجرا: تزریق بوت‌استرپ در HTML سروشده
// ============================================================
const child = spawn(process.execPath, ["server.js"], {
  cwd: here,
  env: {
    ...process.env,
    PORT: String(PORT),
    API_URL: "http://127.0.0.1:5999/api", // بک‌اند لازم نیست
    PROXY_STRICT: "true",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
let log = "";
child.stdout.on("data", (d) => (log += d.toString()));
child.stderr.on("data", (d) => (log += d.toString()));

const base = `http://127.0.0.1:${PORT}`;
const waitFor = async (url) => {
  for (let i = 0; i < 80; i++) {
    try {
      return await fetch(url);
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  throw new Error("frontend not ready: " + url);
};

const styleIdx = (html) => html.search(/<link[^>]+rel=["']stylesheet["']/i);

try {
  // صفحهٔ داشبورد (بدون ورود هم HTML سرو می‌شود)
  const dashRes = await waitFor(`${base}/dashboard.html`);
  const dashHtml = await dashRes.text();
  check("داشبورد سرو می‌شود (۲۰۰)", dashRes.status === 200, `status=${dashRes.status}`);
  check(
    "بوت‌استرپ تم در HTML داشبورد تزریق شده",
    dashHtml.includes("skb_theme") && dashHtml.includes("data-theme"),
  );
  const sDash = dashHtml.indexOf("skb_theme");
  const cDash = styleIdx(dashHtml);
  check(
    "بوت‌استرپ تم قبل از CSS است (بدون فلاش)",
    sDash > -1 && (cDash === -1 || sDash < cDash),
    `script=${sDash} css=${cDash}`,
  );

  // صفحهٔ پروفایل
  const profRes = await fetch(`${base}/profile`);
  const profHtml = await profRes.text();
  check("صفحهٔ پروفایل سالم است (۲۰۰)", profRes.status === 200, `status=${profRes.status}`);
  check("بوت‌استرپ در صفحهٔ پروفایل موجود است", profHtml.includes("skb_theme"));

  // صفحهٔ تنظیمات
  const setRes = await fetch(`${base}/settings`);
  const setHtml = await setRes.text();
  check("صفحهٔ تنظیمات سالم است (۲۰۰)", setRes.status === 200, `status=${setRes.status}`);
  check("بوت‌استرپ در صفحهٔ تنظیمات موجود است", setHtml.includes("skb_theme"));

  // صفحهٔ ۴۰۴ (مسیر ناشناخته)
  const nfRes = await fetch(`${base}/this-route-does-not-exist-xyz`);
  const nfHtml = await nfRes.text();
  check("صفحهٔ ۴۰۴ بوت‌استرپ تم دارد", nfHtml.includes("skb_theme"));
} catch (error) {
  check("اجرای سرور آزمایشی و درخواست‌ها", false, error.message);
} finally {
  // ✅ اطمینان از بسته‌شدن کامل سرور آزمایشی پیش از خروج
  // (جلوگیری از assertion ویندوزی libuv در async.c هنگام بستن هندل‌ها)
  await new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      resolve();
      return;
    }
    child.once("exit", resolve);
    child.kill();
    setTimeout(resolve, 2000);
  });
}

// ============================================================
const failed = results.filter((r) => !r).length;
console.log(
  `\n${failed === 0 ? "✅ ALL PASS" : `❌ ${failed} FAILED`} — تم روشن/تیره (موج ۴)`,
);
if (failed > 0) console.log("\n--- server log ---\n" + log.slice(-1500));
process.exitCode = failed === 0 ? 0 : 1;
