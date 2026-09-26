// ============================================================
//  تست «انتخاب گروه‌های شاخص گزارش‌های هفتگی» (weekly.service)
//  هدف: تضمین پیش‌فرض «همهٔ شاخص‌ها» (سازگاری عقب‌رو)، ذخیره و
//  بازیابی انتخاب کاربر و مقاوم‌بودن در برابر مقدار خراب localStorage.
//  اجرا:  npm run test:weekly:groups      (در پوشهٔ Frontend)
// ============================================================
globalThis.window = globalThis.window || { location: { search: "" } };
globalThis.document = globalThis.document || {
  addEventListener: () => {},
  querySelector: () => null,
  getElementById: () => null,
};
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const results = [];
const check = (name, ok, extra = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}${extra ? " :: " + extra : ""}`);
};

const mod = await import(
  "./src/features/customer-info/sections/weekly/weekly.service.js"
);
const svc = Object.values(mod).find(
  (v) => v && typeof v === "object" && typeof v.pickReportGroups === "function",
);
check("weeklyService قابل بارگذاری است", !!svc, Object.keys(mod).join(","));
if (!svc) {
  console.log("\n❌ FAILED");
  process.exit(1);
}

// ۱) بدون SweetAlert2 → همهٔ گروه‌ها (سازگاری عقب‌رو)
const fallback = await svc.pickReportGroups({});
check(
  "نبود SweetAlert2 → همهٔ ۵ گروه بدون مودال",
  Array.isArray(fallback) && fallback.length === 5,
  fallback.join(","),
);

// ۲) ذخیره و بازیابی انتخاب کاربر
svc.saveReportGroups(["weight", "growth"]);
check(
  "ذخیرهٔ انتخاب کاربر و بازیابی آن (ترتیب کاتالوگ)",
  svc.loadSavedReportGroups().join(",") === "weight,growth",
  svc.loadSavedReportGroups().join(","),
);

// ۳) مقادیر نامعتبر/خالی ذخیره‌شده → همهٔ گروه‌ها
svc.saveReportGroups(["unknown", 12]);
check(
  "انتخاب نامعتبر ذخیره‌شده → پیش‌فرض (همهٔ گروه‌ها)",
  svc.loadSavedReportGroups().length === 5,
);
store.clear();
check(
  "نبود کلید در localStorage → پیش‌فرض (همهٔ گروه‌ها)",
  svc.loadSavedReportGroups().length === 5,
);
store.set("skb_weekly_report_groups", "{not-json");
check(
  "مقدار خراب در localStorage → پیش‌فرض بدون خطا",
  svc.loadSavedReportGroups().length === 5,
);

// ============================================================
//  🎯 مودال انتخاب هفته‌ها (ترکیبی) — منطق ذخیره و fallback
// ============================================================

store.clear();
check(
  "قاعدهٔ ذخیره‌شدهٔ هفته‌ها: پیش‌فرض = «همهٔ هفته‌ها»",
  svc.loadSavedWeekRule().preset === "all" &&
    svc.loadSavedWeekRule().from === null &&
    svc.loadSavedWeekRule().to === null,
);

svc.saveWeekRule({ preset: "range", from: 3, to: 6 });
check(
  "ذخیره و بازیابی قاعدهٔ بازهٔ هفته‌ها",
  svc.loadSavedWeekRule().preset === "range" &&
    svc.loadSavedWeekRule().from === 3 &&
    svc.loadSavedWeekRule().to === 6,
  JSON.stringify(svc.loadSavedWeekRule()),
);

svc.saveWeekRule({ preset: "issues" });
check(
  "قاعدهٔ «فقط مشکل‌دار» ذخیره و بازیابی می‌شود",
  svc.loadSavedWeekRule().preset === "issues",
);

store.set("skb_weekly_report_weeks", "{not-json");
check(
  "مقدار خراب انتخاب هفته‌ها → پیش‌فرض بدون خطا",
  svc.loadSavedWeekRule().preset === "all",
);
store.set("skb_weekly_report_weeks", JSON.stringify({ preset: "WRONG" }));
check(
  "پریست ناشناخته در localStorage → پیش‌فرض «همهٔ هفته‌ها»",
  svc.loadSavedWeekRule().preset === "all",
);

// بدون SweetAlert2 → همهٔ هفته‌ها (null) و بدون خطا
const weekFallback = await svc.pickReportWeeksPerFlock({
  panels: [{ key: "p1", label: "گله ۱", timeline: [{ weekNumber: 1 }] }],
});
check(
  "نبود SweetAlert2 → مودال نمایش داده نمی‌شود و همهٔ هفته‌ها می‌ماند",
  weekFallback === null,
);
const weekEmptyPanels = await svc.pickReportWeeksPerFlock({ panels: [] });
check(
  "بدون گله (پنل خالی) → بدون مودال و همهٔ هفته‌ها",
  weekEmptyPanels === null,
);

const failed = results.filter((x) => !x).length;
console.log(failed === 0 ? "\n✅ SERVICE ALL PASS" : `\n❌ ${failed} FAILED`);
process.exitCode = failed === 0 ? 0 : 1;
