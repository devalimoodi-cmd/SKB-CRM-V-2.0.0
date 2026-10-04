// ============================================================
//  گارد «آواتار پیش‌فرض + جلوگیری از حلقهٔ GET»
// ------------------------------------------------------------
//  ریشهٔ باگی که این گارد از بازگشتش جلوگیری می‌کند:
//    ۱) کد به /assets/images/default-avatar.png اشاره می‌کرد که
//       وجود نداشت (فقط .svg موجود است) → ۴۰۴.
//    ۲) هندلر onerror دوباره «همان آدرس شکست‌خورده» را ست می‌کرد →
//       درخواست‌های GET بی‌پایان؛ بدترین حالت برای کاربران بدون عکس پروفایل.
//
//  اجرا:  npm run test:avatar        (در پوشهٔ Frontend)
// ============================================================
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const here = import.meta.dirname;
const SRC = path.join(here, "src");
const results = [];

const check = (name, ok, extra = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}${extra ? " :: " + extra : ""}`);
};

const walk = (dir, out = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "vendor" || entry.name === "node_modules") continue;
      walk(full, out);
    } else {
      out.push(full);
    }
  }
  return out;
};

const rel = (p) => path.relative(here, p).replace(/\\/g, "/");
const read = (p) => fs.readFileSync(p, "utf8");

const allFiles = walk(SRC);
const codeFiles = allFiles.filter((f) => /\.(js|mjs)$/.test(f));
const refFiles = allFiles.filter((f) => /\.(js|html|css)$/.test(f));

const IMAGE_EXT = /\.(?:png|jpe?g|svg|gif|webp)/i;
const ASSET_RX =
  /\/assets\/[\w./-]+\.(?:png|jpe?g|svg|gif|webp|ico|woff2?|ttf|otf)/gi;

// ===== ۱) هیچ ارجاعی به دارایی ناموجود =====
const missing = new Set();
for (const f of refFiles) {
  for (const m of read(f).matchAll(ASSET_RX)) {
    const urlPath = m[0];
    const diskPath = path.join(SRC, urlPath.replace(/^\/assets\//, "assets/"));
    if (!fs.existsSync(diskPath)) missing.add(`${rel(f)} → ${urlPath}`);
  }
}
check(
  "هر /assets/... ارجاع‌شده روی دیسک موجود است (بدون ۴۰۴)",
  missing.size === 0,
  [...missing].slice(0, 5).join(" | "),
);

// ===== ۲) به default-avatar.png (ناموجود) ارجاع نشود =====
const pngRefs = [];
for (const f of refFiles) {
  if (/default-avatar\.png/i.test(read(f))) pngRefs.push(rel(f));
}
check(
  "هیچ ارجاعی به default-avatar.png نیست (فقط .svg موجود است)",
  pngRefs.length === 0,
  pngRefs.join(", "),
);

// ===== ۳) onerror نباید همان آدرسِ شکست‌خورده را دوباره ست کند =====
const loops = [];
for (const f of codeFiles) {
  const src = read(f);
  if (!src.includes("onerror")) continue;

  const fallbackUrls = new Set();
  let idx = src.indexOf("onerror");
  while (idx !== -1) {
    const window300 = src.slice(idx, idx + 300);
    for (const m of window300.matchAll(/\.src\s*=\s*(["'`])([^"'`]+)\1/g)) {
      if (IMAGE_EXT.test(m[2])) fallbackUrls.add(m[2]);
    }
    idx = src.indexOf("onerror", idx + 1);
  }

  if (fallbackUrls.size === 0) continue;

  const primaryUrls = new Set();
  for (const m of src.matchAll(/\.src\s*=\s*(["'`])([^"'`]+)\1/g)) {
    if (IMAGE_EXT.test(m[2])) primaryUrls.add(m[2]);
  }

  for (const url of fallbackUrls) {
    if (primaryUrls.has(url)) loops.push(`${rel(f)} → ${url}`);
  }
}
check(
  "onerror هیچ‌جا همان آدرس اصلی را بازست نمی‌کند (ضدحلقه)",
  loops.length === 0,
  loops.join(" | "),
);

// ===== ۴) هیچ onerror اینلاینِ شکننده‌ای که src را عوض کند =====
const inlineSrc = codeFiles
  .concat(allFiles.filter((f) => /\.html$/.test(f)))
  .filter((f) => /onerror\s*=\s*["']this\.src\s*=/.test(read(f)))
  .map(rel);
check(
  "onerror اینلاینِ «this.src=» وجود ندارد (باگ کوتیشن/حلقه)",
  inlineSrc.length === 0,
  inlineSrc.join(", "),
);

// ===== ۵) ماژول مشترک آواتار کامل است =====
const avatarUtilPath = path.join(SRC, "core", "utils", "avatar.utils.js");
let avatarSrc = "";
try {
  avatarSrc = read(avatarUtilPath);
} catch {
  avatarSrc = "";
}
const requiredExports = [
  "DEFAULT_AVATAR",
  "avatarDisplayName",
  "initialAvatarDataUrl",
  "resolveAvatarUrl",
  "applyAvatar",
];
const missingExports = requiredExports.filter(
  (name) => !new RegExp(`export (?:const|function) ${name}\\b`).test(avatarSrc),
);
check(
  "ماژول core/utils/avatar.utils.js با خروجی‌های لازم موجود است",
  missingExports.length === 0,
  missingExports.join(", "),
);

// ===== ۶) applyAvatar هندلر را یک‌بارمصرف می‌کند (قطع قطعیِ حلقه) =====
check(
  "applyAvatar هندلر onerror را یک‌بارمصرف می‌کند",
  (avatarSrc.match(/img\.onerror = null/g) || []).length >= 2,
);

// ===== ۷) fallback آواتار هرگز یک آدرس شبکه‌ای نیست (فقط data: URL) =====
const avatarConsumers = [
  "src/features/profile/profile.renderer.js",
  "src/shared/layouts/Header/header.service.js",
  "src/core/utils/string.utils.js",
];
const networkFallbacks = avatarConsumers.filter((p) => {
  const src = read(path.join(here, p));
  return /onerror/.test(src) && /\.src\s*=\s*["'`]\/assets\//.test(src);
});
check(
  "fallback آواتار آدرس شبکه‌ای (/assets/...) نیست",
  networkFallbacks.length === 0,
  networkFallbacks.join(", "),
);

// ===== ۸) بررسی رفتاری واقعی (اجرای ماژول) =====
// ماژول در Node به‌صورت ESM کپی موقت (.mjs) لود می‌شود تا warning ندهد
let mod = null;
if (avatarSrc) {
  const tmp = path.join(os.tmpdir(), `skb-avatar-utils-${process.pid}.mjs`);
  try {
    fs.copyFileSync(avatarUtilPath, tmp);
    mod = await import(pathToFileURL(tmp).href);
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

check(
  "DEFAULT_AVATAR یک data: URL است (بدون درخواست شبکه)",
  !!mod && mod.DEFAULT_AVATAR.startsWith("data:image/svg+xml,"),
);

check(
  "کاربر بدون عکس پروفایل → آواتار پیش‌فرض (بدون ۴۰۴)",
  !!mod &&
    mod.resolveAvatarUrl({}, "علی").startsWith("data:image/svg+xml,"),
);

check(
  "کاربر دارای عکس → همان مسیر بک‌اند حفظ می‌شود",
  !!mod &&
    mod.resolveAvatarUrl({ profile_image: "/uploads/a.png" }) ===
      "/uploads/a.png",
);

check(
  "مسیر بدون اسلش ابتدایی اصلاح می‌شود",
  !!mod &&
    mod.resolveAvatarUrl({ profile_image: "uploads/a.png" }) ===
      "/uploads/a.png",
);

check(
  "آواتار حرف‌اول، حرف نام کاربر را دارد",
  !!mod && decodeURIComponent(mod.initialAvatarDataUrl("Ali")).includes(">A<"),
);

// ===== نتیجه =====
const failed = results.filter((r) => !r).length;
console.log(
  `\n${failed === 0 ? "✅ ALL PASS" : `❌ ${failed} FAILED`} — آواتار پیش‌فرض/ضدحلقه`,
);
process.exitCode = failed === 0 ? 0 : 1;
