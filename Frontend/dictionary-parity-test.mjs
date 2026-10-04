// ============================================================
//  گارد «همخوانی فهرست دیکشنری‌ها»
// ------------------------------------------------------------
//  دو فهرست موازی باید همیشه هم‌خوان باشند:
//    ۱) Frontend/src/features/admin-panel/dictionary.schemas.js  (رابط کاربری)
//    ۲) Backend/config/permissions.js → DICTIONARY_TABLES         (مجوزها)
//  بررسی:
//    • یکسان بودن مجموعهٔ کلیدها
//    • یکسان بودن عنوان‌ها (پس از نرمال‌سازی فاصله‌ها)
//  اجرا:  npm run test:dictionary      (در پوشهٔ Frontend)
// ============================================================
import fs from "node:fs";
import path from "node:path";

const results = [];
const check = (name, ok, extra = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}${extra ? " :: " + extra : ""}`);
};

const here = import.meta.dirname;
const norm = (s) => String(s).replace(/\s+/g, " ").trim();
const read = (p) => fs.readFileSync(p, "utf8");

// ===== ۱) فهرست پنل ادمین (UI) =====
const ui = {};
try {
  const src = read(
    path.join(here, "src", "features", "admin-panel", "dictionary.schemas.js"),
  );
  const block = src.slice(src.indexOf("DICTIONARY_SCHEMAS"));
  // کلیدهای سطح-بالا (با/بدون کوتیشن) که ۲ فاصله تورفتگی دارند
  const keyRx = /^ {2}(?:"([a-z0-9-]+)"|([a-z0-9-]+))\s*:\s*\{/gm;
  const matches = [...block.matchAll(keyRx)];
  matches.forEach((m, i) => {
    const key = m[1] || m[2];
    const start = m.index + m[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : block.length;
    const seg = block.slice(start, end);
    const t = seg.match(/title:\s*"([^"]+)"/);
    if (key && t) ui[key] = norm(t[1]);
  });
} catch (error) {
  check("خواندن dictionary.schemas.js", false, error.message);
}

// ===== ۲) فهرست مجوزها (Backend) =====
const be = {};
try {
  const src = read(
    path.join(here, "..", "Backend", "config", "permissions.js"),
  );
  const block = src.match(/const DICTIONARY_TABLES = \[([\s\S]*?)\];/);
  const body = block ? block[1] : "";
  for (const m of body.matchAll(/\["([a-z0-9-]+)",\s*"([^"]+)"\]/g)) {
    be[m[1]] = norm(m[2]);
  }
} catch (error) {
  check("خواندن Backend/config/permissions.js", false, error.message);
}

const uiKeys = Object.keys(ui).sort();
const beKeys = Object.keys(be).sort();

check(
  "هر دو فهرست دیکشنری خوانده شدند",
  uiKeys.length > 0 && beKeys.length > 0,
  `ui=${uiKeys.length} be=${beKeys.length}`,
);

const onlyUi = uiKeys.filter((k) => !be[k]);
const onlyBe = beKeys.filter((k) => !ui[k]);
check(
  "کلیدهای دیکشنری در دو فهرست یکسان‌اند",
  onlyUi.length === 0 && onlyBe.length === 0,
  `فقط-UI=[${onlyUi.join(",")}] فقط-Backend=[${onlyBe.join(",")}]`,
);

const titleMismatch = uiKeys
  .filter((k) => be[k])
  .filter((k) => ui[k] !== be[k])
  .map((k) => `${k}: UI="${ui[k]}" ≠ BE="${be[k]}"`);
check(
  "عنوان‌های دیکشنری در دو فهرست یکسان‌اند",
  titleMismatch.length === 0,
  titleMismatch.slice(0, 6).join(" | "),
);

// ===== نتیجه =====
const failed = results.filter((r) => !r).length;
console.log(
  `\n${failed === 0 ? "✅ ALL PASS" : `❌ ${failed} FAILED`} — هم‌خوانی فهرست دیکشنری‌ها`,
);
process.exitCode = failed === 0 ? 0 : 1;
