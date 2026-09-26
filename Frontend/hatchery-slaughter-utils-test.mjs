// ============================================================
//  تست توابع خالص «اطلاعات کشتار» بخش جوجه‌کشی
//  اجرا:  npm run test:hatchery-utils      (در پوشهٔ Frontend)
// ------------------------------------------------------------
//  چرا؟ این توابع قبلاً هم در hatchery.service.js و هم در
//  hatchery.report.js کپی شده بودند؛ اکنون فقط در
//  hatchery.slaughter.utils.js هستند. این تست تضمین می‌کند
//  خروجی هر دو بخش (نمای گله و گزارش گله) همان قبل بماند.
//  نکته: انتظار تاریخ‌ها با همان Intl محیط ساخته می‌شود تا
//  تست نسبت به منطقهٔ زمانی/ICU مقاوم باشد.
// ============================================================
import {
  formatSlaughterRange,
  slaughterAgeMethodLabel,
  slaughterShipmentsHtml,
  formatAgeRange,
} from "./src/features/customer-info/sections/hatchery/hatchery.slaughter.utils.js";

const results = [];
const check = (name, ok, extra = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}${extra ? " :: " + extra : ""}`);
};

// همان مسیر تبدیل تاریخ که خود سرویس استفاده می‌کند
const faDate = (iso) =>
  new Intl.DateTimeFormat("fa-IR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
const faNum = (n) => Number(n).toLocaleString("fa-IR");
const persianDigits = /^[۰-۹]+(\/[۰-۹]+)*$/;

// ============================================================
// ۱) formatSlaughterRange — تاریخ کشتار (شروع/پایان)
// ============================================================
check("تاریخ کشتار: بدون رکورد پایان دوره → خط تیره", formatSlaughterRange(null) === "-" && formatSlaughterRange(undefined) === "-");
check("تاریخ کشتار: رکورد بدون تاریخ → خط تیره", formatSlaughterRange({}) === "-");
check(
  "تاریخ کشتار: تک‌تاریخی (رکوردهای قدیمی) → همان یک تاریخ",
  formatSlaughterRange({ slaughter_date: "2024-01-29" }) === faDate("2024-01-29"),
  formatSlaughterRange({ slaughter_date: "2024-01-29" }),
);
check(
  "تاریخ کشتار: تاریخ شروع و پایان یکسان → یک تاریخ (بدون «تا»)",
  formatSlaughterRange({
    slaughter_date: "2024-01-29",
    slaughter_end_date: "2024-01-29",
  }) === faDate("2024-01-29"),
);
check(
  "تاریخ کشتار: بازه → «شروع تا پایان»",
  formatSlaughterRange({
    slaughter_date: "2024-01-29",
    slaughter_end_date: "2024-02-08",
  }) === `${faDate("2024-01-29")} تا ${faDate("2024-02-08")}`,
  formatSlaughterRange({
    slaughter_date: "2024-01-29",
    slaughter_end_date: "2024-02-08",
  }),
);
check(
  // ⚠️ رفتار فعلی (golden): اگر فقط تاریخ پایان ثبت شده باشد، سمت start خالی می‌ماند
  // و خروجی با «تا » شروع می‌شود: « تا ۱۴۰۲/۱۱/۱۹». این باگ در docs/REVIEW.md ثبت شده است.
  "تاریخ کشتار: فقط تاریخ پایان → « تا تاریخ‌پایان» (رفتار فعلی، باگ ثبت‌شده)",
  formatSlaughterRange({ slaughter_end_date: "2024-02-08" }) ===
    ` تا ${faDate("2024-02-08")}`,
  formatSlaughterRange({ slaughter_end_date: "2024-02-08" }),
);
check(
  "تاریخ کشتار: خروجی واقعاً به تاریخ شمسی تبدیل می‌شود (نه متن خام)",
  (() => {
    const out = formatSlaughterRange({ slaughter_date: "2024-01-29" });
    return persianDigits.test(out) && out !== "2024-01-29";
  })(),
  formatSlaughterRange({ slaughter_date: "2024-01-29" }),
);

// ============================================================
// ۲) slaughterAgeMethodLabel — برچسب روش ثبت سن
// ============================================================
check(
  "برچسب روش: بازهٔ تاریخی",
  slaughterAgeMethodLabel({ slaughter_age_method: "range" }) === "روش بازهٔ تاریخی",
);
check(
  "برچسب روش: ورود مستقیم سن",
  slaughterAgeMethodLabel({ slaughter_age_method: "direct" }) === "روش ورود مستقیم سن",
);
check(
  "برچسب روش: ارسال چندمرحله‌ای",
  slaughterAgeMethodLabel({ slaughter_age_method: "weighted" }) ===
    "روش ارسال چندمرحله‌ای",
);
check(
  "برچسب روش: رکورد قدیمی با سن پایان → «بازهٔ سن (قدیمی)»",
  slaughterAgeMethodLabel({ slaughter_age_end_days: 30 }) === "بازهٔ سن (قدیمی)",
);
check(
  "برچسب روش: رکورد قدیمی بدون سن پایان → خالی",
  slaughterAgeMethodLabel({ slaughter_age_days: 30 }) === "",
);
check(
  "برچسب روش: روش ناشناخته → خالی (بدون خطا)",
  slaughterAgeMethodLabel({ slaughter_age_method: "other" }) === "" &&
    slaughterAgeMethodLabel(null) === "" &&
    slaughterAgeMethodLabel(undefined) === "",
);

// ============================================================
// ۳) slaughterShipmentsHtml — جدول ارسال‌های چندمرحله‌ای
// ============================================================
check(
  "ارسال چندمرحله‌ای: بدون ارسال → رشتهٔ خالی",
  slaughterShipmentsHtml(null) === "" &&
    slaughterShipmentsHtml({}) === "" &&
    slaughterShipmentsHtml({ slaughter_shipments: [] }) === "" &&
    slaughterShipmentsHtml({ slaughter_shipments: "bad" }) === "",
);
const shipmentsHtml = slaughterShipmentsHtml({
  slaughter_shipments: [
    { age_days: 30, quantity: 1200, date: "2024-02-01" },
    { age_days: 40, quantity: null, date: null },
  ],
});
check(
  "ارسال چندمرحله‌ای: هر ردیف شامل سن/تعداد/تاریخ است",
  shipmentsHtml.includes(">30<") &&
    shipmentsHtml.includes(">" + faNum(1200) + "<") &&
    shipmentsHtml.includes(">" + faDate("2024-02-01") + "<"),
);
check(
  "ارسال چندمرحله‌ای: مقادیر نامعلوم → خط تیره (بدون NaN)",
  shipmentsHtml.includes(">40<") &&
    shipmentsHtml.includes(">-<") &&
    !shipmentsHtml.includes("NaN") &&
    !shipmentsHtml.includes("undefined"),
);
check(
  "ارسال چندمرحله‌ای: ساختار جدول و سرستون‌ها ساخته می‌شود",
  shipmentsHtml.includes("<table") &&
    shipmentsHtml.includes("جزئیات ارسال‌ها به کشتارگاه:") &&
    shipmentsHtml.includes("سن (روز)") &&
    shipmentsHtml.includes("تعداد (قطعه)") &&
    shipmentsHtml.includes("تاریخ"),
);
check(
  "ارسال چندمرحله‌ای: به‌ازای هر ارسال یک ردیف (tbody)",
  (shipmentsHtml.match(/<tr>/g) || []).length ===
    1 + 2 && // یک ردیف سرستون + دو ردیف داده
  (shipmentsHtml.match(/<tbody>/g) || []).length === 1,
);

// ============================================================
// ۴) formatAgeRange — نمایش سن کشتار
// ============================================================
check(
  "سن کشتار: بدون رکورد → خط تیره",
  formatAgeRange(null) === "-" && formatAgeRange(undefined) === "-",
);
check(
  "سن کشتار: روش بازهٔ تاریخی → سن نهایی به فارسی + «روز»",
  formatAgeRange({ slaughter_age_method: "range", slaughter_age_days: 42 }) ===
    `${faNum(42)} روز`,
  formatAgeRange({ slaughter_age_method: "range", slaughter_age_days: 42 }),
);
check(
  "سن کشتار: روش ورود مستقیم → همان قالب",
  formatAgeRange({ slaughter_age_method: "direct", slaughter_age_days: 45 }) ===
    `${faNum(45)} روز`,
);
check(
  "سن کشتار: روش چندمرحله‌ای → «(میانگین وزنی)»",
  formatAgeRange({ slaughter_age_method: "weighted", slaughter_age_days: 38 }) ===
    `${faNum(38)} روز (میانگین وزنی)`,
  formatAgeRange({ slaughter_age_method: "weighted", slaughter_age_days: 38 }),
);
check(
  "سن کشتار: روش مشخص ولی سن خالی → خط تیره",
  formatAgeRange({ slaughter_age_method: "range", slaughter_age_days: null }) ===
    "-" &&
    formatAgeRange({ slaughter_age_method: "weighted" }) === "-",
);
check(
  "سن کشتار: رکورد قدیمی تک‌سنتی → عدد بدون تبدیل محلی + «روز»",
  formatAgeRange({ slaughter_age_days: 30 }) === "30 روز",
  formatAgeRange({ slaughter_age_days: 30 }),
);
check(
  "سن کشتار: رکورد قدیمی بازهٔ سنی → «شروع-پایان روز»",
  formatAgeRange({ slaughter_age_days: 30, slaughter_age_end_days: 40 }) ===
    "30-40 روز",
  formatAgeRange({ slaughter_age_days: 30, slaughter_age_end_days: 40 }),
);
check(
  "سن کشتار: رکورد قدیمی با شروع=پایان → یک عدد",
  formatAgeRange({ slaughter_age_days: 30, slaughter_age_end_days: 30 }) === "30 روز",
);
check(
  // ⚠️ رفتار فعلی (golden): در رکورد قدیمی که فقط سن پایانی دارد، start=null
  // در متن می‌آید → «null-25 روز». این باگ در docs/REVIEW.md ثبت شده است.
  "سن کشتار: رکورد قدیمی فقط با سن پایان → «null-25 روز» (رفتار فعلی، باگ ثبت‌شده)",
  formatAgeRange({ slaughter_age_days: null, slaughter_age_end_days: 25 }) ===
    "null-25 روز",
  formatAgeRange({ slaughter_age_days: null, slaughter_age_end_days: 25 }),
);
check(
  "سن کشتار: بدون هیچ سنی → خط تیره",
  formatAgeRange({}) === "-" && formatAgeRange({ slaughter_age_days: null }) === "-",
);

const failed = results.filter((x) => !x).length;
console.log(failed === 0 ? "\n✅ ALL PASS" : `\n❌ ${failed} FAILED`);
process.exitCode = failed === 0 ? 0 : 1;
