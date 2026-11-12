// ============================================================
//  گارد «مبدأهای مجاز CORS» — موج ۱۳.۲۴
// ------------------------------------------------------------
//  چه چیزی را قفل می‌کند؟
//   ۱) رفتار قبلی نشکسته باشد: پیش‌فرض‌ها همان شش مبدأ هاردکد قدیمی
//      (localhost:3000/5500، 127.0.0.1:5500 و سرور اختصاصی).
//   ۲) `ALLOWED_ORIGINS` واقعاً خوانده می‌شود و به پیش‌فرض‌ها **اضافه**
//      می‌شود (نه جایگزین) ⇒ افزودن یک مبدأ، مبدأهای فعلی را نمی‌شکند.
//   ۳) ورودی نامرتب تمیز می‌شود: فاصله، اسلش انتهایی، خالی، تکراری.
//   ۴) fail-closed: خروجی هرگز خالی و هرگز `*` نیست؛ مقدار نامعتبر
//      (مثل `*` یا `ftp://…`) دور ریخته می‌شود.
//   ۵) `CORS_ALLOW_LAN=true` ⇒ خودکار `http://<IPv4 محلی>:3000|5000`
//      (تست روی موبایل در شبکهٔ محلی) و با false ⇒ هیچ مبدأ LAN.
//   ۶) خود server.js از همین تابع استفاده می‌کند (فهرست هاردکد حذف شده)
//      و `.env.example` هر دو کلید را مستند کرده است.
//
//  اجرا:  node cors-config-test.mjs        (در پوشهٔ Backend)
//         npm run test:cors                (در پوشهٔ Backend)
//         npm run test:cors-config         (از Frontend — جزو گیت)
// ============================================================
import fs from "node:fs";
import path from "node:path";
import corsOrigins from "./utils/corsOrigins.js";

const here = import.meta.dirname;
const ROOT = path.join(here, "..");

const results = [];
const check = (name, ok, extra = "") => {
  results.push(Boolean(ok));
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}${extra ? " :: " + extra : ""}`);
};

const read = (rel) => {
  try {
    return fs.readFileSync(path.join(ROOT, rel), "utf8").replace(/^\uFEFF/, "");
  } catch {
    return "";
  }
};

const {
  DEFAULT_ORIGINS,
  resolveCorsOrigins,
  normalizeOrigin,
  parseOriginList,
  collectLanOrigins,
} = corsOrigins;

const SERVER = read("Backend/server.js");
const ENV_EXAMPLE = read("Backend/.env.example");

// ============================================================
// ۱) پیش‌فرض‌ها دقیقاً همان فهرست قبلی
// ============================================================
const bare = resolveCorsOrigins({});

check(
  "۱۳.۲۴ · CORS: بدون هیچ متغیری، همان شش مبدأ پیش‌فرض قبلی برمی‌گردد",
  DEFAULT_ORIGINS.length === 6 &&
    DEFAULT_ORIGINS.includes("http://localhost:3000") &&
    DEFAULT_ORIGINS.includes("http://localhost:5500") &&
    DEFAULT_ORIGINS.includes("http://127.0.0.1:5500") &&
    DEFAULT_ORIGINS.includes("http://192.168.168.72:3000") &&
    DEFAULT_ORIGINS.every((origin) => bare.includes(origin)) &&
    bare.length === DEFAULT_ORIGINS.length,
  `count=${bare.length}`,
);

check(
  "۱۳.۲۴ · CORS: خروجی هرگز خالی و هرگز «*» نیست (fail-closed)",
  bare.length > 0 &&
    bare.every((origin) => origin !== "*") &&
    resolveCorsOrigins({ ALLOWED_ORIGINS: "" }).length === bare.length &&
    resolveCorsOrigins({ ALLOWED_ORIGINS: "   ,  ," }).length === bare.length,
);

// ============================================================
// ۲) ALLOWED_ORIGINS افزودنی است، نه جایگزین
// ============================================================
const withExtra = resolveCorsOrigins({
  ALLOWED_ORIGINS: "http://192.168.1.50:3000",
});

check(
  "۱۳.۲۴ · CORS: ALLOWED_ORIGINS به پیش‌فرض‌ها اضافه می‌شود (جایگزین نمی‌کند)",
  withExtra.length === bare.length + 1 &&
    withExtra.includes("http://192.168.1.50:3000") &&
    DEFAULT_ORIGINS.every((origin) => withExtra.includes(origin)),
  `count=${withExtra.length}`,
);

check(
  "۱۳.۲۴ · CORS: فاصله/اسلش انتهایی/تکراری/«*» در ALLOWED_ORIGINS تمیز می‌شود",
  (() => {
    const list = resolveCorsOrigins({
      ALLOWED_ORIGINS:
        "  http://192.168.1.50:3000/ , http://192.168.1.50:3000 ,*,ftp://x , http://phone.local:3000 ",
    });
    const added = list.filter((origin) => !bare.includes(origin));
    return (
      added.length === 2 &&
      added.includes("http://192.168.1.50:3000") &&
      added.includes("http://phone.local:3000") &&
      !list.includes("*") &&
      !list.some((origin) => origin.startsWith("ftp://"))
    );
  })(),
);

check(
  "۱۳.۲۴ · CORS: چند مبدأ با کاما (چند IP/موبایل) پشتیبانی می‌شود",
  (() => {
    const list = resolveCorsOrigins({
      ALLOWED_ORIGINS: "http://192.168.1.50:3000,http://192.168.1.51:3000,http://10.0.0.7",
    });
    return (
      list.includes("http://192.168.1.50:3000") &&
      list.includes("http://192.168.1.51:3000") &&
      list.includes("http://10.0.0.7")
    );
  })(),
);

check(
  "۱۳.۲۴ · CORS: مبدأی که از قبل در پیش‌فرض‌ها هست، دوباره اضافه نمی‌شود",
  (() => {
    const list = resolveCorsOrigins({ ALLOWED_ORIGINS: "http://localhost:3000" });
    return (
      list.filter((origin) => origin === "http://localhost:3000").length === 1 &&
      list.length === bare.length
    );
  })(),
);

// ============================================================
// ۳) CORS_ALLOW_LAN — آدرس‌های محلی دستگاه
// ============================================================
const lanOrigins = collectLanOrigins();

check(
  "۱۳.۲۴ · CORS: بدون CORS_ALLOW_LAN هیچ مبدأ LAN اضافه نمی‌شود",
  resolveCorsOrigins({ CORS_ALLOW_LAN: "false" }).length === bare.length &&
    resolveCorsOrigins({ CORS_ALLOW_LAN: "no" }).length === bare.length &&
    lanOrigins.every((origin) => !bare.includes(origin)),
);

check(
  "۱۳.۲۴ · CORS: CORS_ALLOW_LAN=true آدرس‌های IPv4 محلی را روی ۳۰۰۰ و ۵۰۰۰ مجاز می‌کند",
  (() => {
    const list = resolveCorsOrigins({ CORS_ALLOW_LAN: "true" });
    const expected = lanOrigins.filter((origin) => !bare.includes(origin));
    // روی ماشینی که فقط loopback دارد، چیزی برای اضافه‌شدن وجود ندارد
    if (expected.length === 0) return list.length === bare.length;
    return expected.every((origin) => list.includes(origin)) && list.length > bare.length;
  })(),
  `lan=${lanOrigins.length}`,
);

check(
  "۱۳.۲۴ · CORS: collectLanOrigins فقط IPv4 غیرداخلی و پورت‌های ۳۰۰۰/۵۰۰۰ را برمی‌گرداند",
  lanOrigins.every(
    (origin) =>
      /^http:\/\/\d{1,3}(\.\d{1,3}){3}:(3000|5000)$/.test(origin) &&
      !origin.includes("127.0.0.1"),
  ),
);

// ============================================================
// ۴) توابع خالص کمکی
// ============================================================
check(
  "۱۳.۲۴ · CORS: normalizeOrigin اسلش انتهایی را می‌گیرد و مقدار نامعتبر را رد می‌کند",
  normalizeOrigin(" http://a.com:3000/ ") === "http://a.com:3000" &&
    normalizeOrigin("https://a.com") === "https://a.com" &&
    normalizeOrigin("*") === "" &&
    normalizeOrigin("") === "" &&
    normalizeOrigin(null) === "" &&
    normalizeOrigin("http://a.com:3000/path") === "",
);

check(
  "۱۳.۲۴ · CORS: parseOriginList رشته و آرایه را می‌پذیرد",
  JSON.stringify(parseOriginList("a, b")) === JSON.stringify(["a", " b"]) &&
    JSON.stringify(parseOriginList(["a"])) === JSON.stringify(["a"]) &&
    JSON.stringify(parseOriginList(null)) === JSON.stringify([""]),
);

check(
  "۱۳.۲۴ · CORS: defaults سفارشی هم پشتیبانی می‌شود (برای تست/استقرار خاص)",
  (() => {
    const list = resolveCorsOrigins(
      { ALLOWED_ORIGINS: "http://extra.example" },
      ["http://only.example"],
    );
    return (
      list.length === 2 &&
      list[0] === "http://only.example" &&
      list.includes("http://extra.example")
    );
  })(),
);

check(
  "۱۳.۲۴ · CORS: اگر defaults خالی/نامعتبر بدهند، باز هم فهرست پیش‌فرض برمی‌گردد",
  resolveCorsOrigins({}, []).length === DEFAULT_ORIGINS.length &&
    resolveCorsOrigins({}, null).length === DEFAULT_ORIGINS.length,
);

// ============================================================
// ۵) سیم‌کشی واقعی: server.js و .env.example
// ============================================================
check(
  "۱۳.۲۴ · server.js: مبدأها از resolveCorsOrigins می‌آید (فهرست هاردکد حذف شد)",
  /require\("\.\/utils\/corsOrigins"\)/.test(SERVER) &&
    /origin:\s*resolveCorsOrigins\(process\.env\)/.test(SERVER) &&
    !/origin:\s*\[\s*\r?\n\s*"http:\/\/localhost:3000"/.test(SERVER),
);

check(
  "۱۳.۲۴ · server.js: credentials و هدرها دست‌نخورده مانده‌اند",
  /credentials:\s*true/.test(SERVER) &&
    /allowedHeaders:\s*\[\s*"Content-Type",\s*"Authorization"\s*\]/.test(SERVER),
);

check(
  "۱۳.۲۴ · .env.example: هر دو کلید CORS مستند شده‌اند",
  /ALLOWED_ORIGINS=/.test(ENV_EXAMPLE) && /CORS_ALLOW_LAN=/.test(ENV_EXAMPLE),
);

check(
  "۱۳.۲۴ · .env.example: مقدار پیش‌فرض CORS_ALLOW_LAN روی سرور false است",
  /^CORS_ALLOW_LAN=false\s*$/m.test(ENV_EXAMPLE),
);

// ============================================================
// جمع‌بندی
// ============================================================
const passed = results.filter(Boolean).length;
const failed = results.length - passed;

console.log("");
console.log(`📊 CORS config guard: ${passed}/${results.length} PASS`);

if (failed > 0) {
  console.error(`❌ ${failed} بررسی ناموفق بود.`);
  process.exitCode = 1;
}
