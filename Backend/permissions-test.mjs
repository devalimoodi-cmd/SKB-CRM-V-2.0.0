// ============================================================
//  تست «سطوح دسترسی» (Roles & Permissions)
// ------------------------------------------------------------
//  سه بخش:
//   ۱) کاتالوگ (بدون دیتابیس): یکتایی کلیدها، پیش‌فرض هر ۵ نقش
//   ۲) میدل‌ور requirePermission (بدون دیتابیس): ۴۰۳ در حالت فعال،
//      عبور در حالت dry-run، عبور همیشگی سوپرادمین
//   ۳) سرویس + دیتابیس (فقط با ALLOW_DB_TESTS=true): تغییر سطح
//      دسترسی نقش/کاربر، ثبت گزارش، بازگردانی، رد کلیدهای قفل‌شده
//
//  اجرا:
//    npm run test:permissions
//    $env:ALLOW_DB_TESTS='true'; npm run test:permissions   (با بخش ۳)
// ============================================================
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const results = [];
const check = (name, ok, extra = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}${extra ? " :: " + extra : ""}`);
};

const catalog = require("./config/permissions.js");
const { requirePermission } = require("./middleware/permissions.js");

// ============================================================
// ۱) کاتالوگ
// ============================================================
check(
  "کاتالوگ: تعداد کلیدها و گروه‌ها طبق طراحی است",
  // ✅ فاز ۱۳.۲: گروه «پورتال مشتری» + کلید customer.portal.view
  // ✅ فاز ۱۳.۴: کلید customer.portal.visit.report (متن گزارش + پیوست‌ها)
  // ✅ فاز ۱۳.۵: چهار کلید تب پورتال (halls/flocks/weeks/visits)
  // ✅ موج ۱۳.۸: ۱۲ کلید تازه (profile و ویرایشش، dashboard و زیربخش‌ها،
  //    ۶ نمودار) ⇒ ۱۷۶ + ۱۲ = ۱۸۸
  // ✅ موج ۱۳.۱۰: ۳ کلید تازه («مدارک من»: تب/آپلود/حذف نرم)
  //    ⇒ ۱۸۸ + ۳ = ۱۹۱
  // ✅ موج ۱۳.۱۱: ۶ کلید تازه («درخواست‌های فارم»: تب/ثبت/لغو برای
  //    مشتری + view/review برای کارشناس + منوی پنل ادمین) و یک گروه
  //    تازه («پنل مدیریت — درخواست‌های پورتال»)
  //    ⇒ ۱۹۱ + ۶ = ۱۹۷ کلید و ۱۷ + ۱ = ۱۸ گروه
  // ✅ موج ۱۳.۱۷: ۲۸ کلید «لایهٔ منو»ی پورتال (۷ منو + ۲۱ زیرمنو)
  //    ⇒ ۱۹۷ + ۲۸ = ۲۲۵ کلید؛ گروه تازه‌ای اضافه نشد (همان گروه
  //    «پورتال مشتری» = ۲۴ + ۲۸ = ۵۲ کلید)
  // ✅ موج ۱۳.۱۹: ۲ کلید «پایان دوره» (فهرست) و «گزارش تفصیلی پایان
  //    دوره» ⇒ ۲۲۵ + ۲ = ۲۲۷ کلید؛ همان ۱۸ گروه (پورتال = ۵۴ کلید)
  // ⚠️ موج ۱۳.۲۱: چهار کلید منوی حذف‌شده (requests/requests.new/
  //    requests.list/weekly.create) − دو کلید تازه (menu.tickets +
  //    customer.portal.tickets) ⇒ ۲۲۷ − ۴ + ۲ = ۲۲۵ کلید؛ ۱۸ گروه
  catalog.TOTAL_PERMISSIONS === 225 && catalog.PERMISSION_GROUPS.length === 18,
  `keys=${catalog.TOTAL_PERMISSIONS} groups=${catalog.PERMISSION_GROUPS.length}`,
);

// ============================================================
// ✅ موج ۱۳.۱۷ — کلیدهای «منو/زیرمنوی» پورتال (ناوبری دو لایه)
// ------------------------------------------------------------
//  این ۲۱ کلید فقط ناوبری را کنترل می‌کنند، نه داده را. تست سه چیز
//  را می‌سنجد: (۱) همه در گروه portal هستند، (۲) پیش‌فرضشان دقیقاً
//  «فقط مشتری» است، (۳) هیچ‌کدام قفل‌شده نیستند (مدیر می‌تواند
//  با ماتریس نقش‌ها باز/بسته کند).
//  ⚠️ موج ۱۳.۲۱: چهار کلید حذف شد (منوی «درخواست‌های من» + «ثبت هفته»)
//     و چهار کلید بخش سالن باقی ماند — ولی دیگر «مسیر» نیستند؛ گیت
//     نمایش هر بخش آکاردئون‌اند. «ارسال تیکت» کلید منوی تازه گرفت.
// ============================================================
const PORTAL_MENU_KEYS = [
  "customer.portal.menu.dashboard",
  "customer.portal.menu.dashboard.charts",
  "customer.portal.menu.dashboard.compare",
  "customer.portal.menu.profile",
  "customer.portal.menu.profile.me",
  "customer.portal.menu.profile.documents",
  "customer.portal.menu.farm",
  "customer.portal.menu.farm.units",
  "customer.portal.menu.farm.halls",
  // ⚠️ گیت بخش‌های آکاردئون سالن (بدون مسیر/آیتم منو)
  "customer.portal.menu.farm.physical",
  "customer.portal.menu.farm.systems",
  "customer.portal.menu.farm.waterFeed",
  "customer.portal.menu.farm.hygiene",
  "customer.portal.menu.hatchery",
  "customer.portal.menu.hatchery.flocks",
  "customer.portal.menu.hatchery.placements",
  "customer.portal.menu.hatchery.hygiene",
  "customer.portal.menu.hatchery.completion",
  "customer.portal.menu.weekly",
  "customer.portal.menu.weekly.list",
  "customer.portal.menu.weekly.trend",
  "customer.portal.menu.tickets",
  "customer.portal.menu.reports",
  "customer.portal.menu.reports.visits",
  "customer.portal.menu.reports.final",
];

check(
  "۱۳.۲۱ · کاتالوگ: ۲۵ کلید منو/زیرمنو/گیت‌بخش پورتال با پیش‌فرض «فقط مشتری»",
  PORTAL_MENU_KEYS.length === 25 &&
    PORTAL_MENU_KEYS.every((key) => {
      const entry = catalog.PERMISSIONS[key];
      return (
        Boolean(entry) &&
        entry.group === "portal" &&
        entry.defaults.customer === true &&
        entry.defaults.super_admin === false &&
        entry.defaults.admin === false &&
        entry.defaults.sub_admin === false &&
        entry.defaults.expert === false &&
        (entry.lockedTo || []).length === 0
      );
    }),
  `menus=${PORTAL_MENU_KEYS.length} portalKeys=${
    catalog.PERMISSION_GROUPS.find((g) => g.key === "portal")?.items.length
  }`,
);

// ============================================================
// ✅ موج ۱۳.۱۹ — کلیدهای «پایان دوره» (دو کلید محتوا)
// ------------------------------------------------------------
//  این دو کلید مثل customer.portal.visit.report «محتوا» را کنترل
//  می‌کنند (سرور هم اجرا می‌کند): فهرست پایان دوره‌ها + گزارش تفصیلی.
// ============================================================
const COMPLETION_KEYS = [
  "customer.portal.completion",
  "customer.portal.completion.report",
];

check(
  "۱۳.۱۹ · کاتالوگ: ۲ کلید «پایان دوره» با پیش‌فرض «فقط مشتری» و بدون قفل",
  COMPLETION_KEYS.length === 2 &&
    COMPLETION_KEYS.every((key) => {
      const entry = catalog.PERMISSIONS[key];
      return (
        Boolean(entry) &&
        entry.group === "portal" &&
        entry.defaults.customer === true &&
        entry.defaults.super_admin === false &&
        entry.defaults.admin === false &&
        entry.defaults.sub_admin === false &&
        entry.defaults.expert === false &&
        (entry.lockedTo || []).length === 0
      );
    }),
  `completion=${COMPLETION_KEYS.length}`,
);

check(
  "۱۳.۱۹ · کاتالوگ: کلید «گزارش تفصیلی» جدا از کلید «فهرست» است",
  Boolean(catalog.PERMISSIONS["customer.portal.completion"]) &&
    Boolean(catalog.PERMISSIONS["customer.portal.completion.report"]) &&
    catalog.PERMISSIONS["customer.portal.completion"].title !==
      catalog.PERMISSIONS["customer.portal.completion.report"].title,
);

check(
  "۱۳.۱۷ · کاتالوگ: ۷ منوی اصلی پورتال (تعداد منوها = ۷)",
  PORTAL_MENU_KEYS.filter((key) => key.split(".").length === 4).length === 7,
);

check(
  "۱۳.۲۱ · کاتالوگ: هر منوی اصلی حداقل یک زیرمنو دارد",
  // ⚠️ ۱۳.۲۱: «درخواست‌های من» حذف شد؛ «ارسال تیکت» عمداً بدون زیرمنو
  //  است (یک پنل تک‌صفحه‌ای) ⇒ در این فهرست نیست.
  ["dashboard", "profile", "farm", "hatchery", "weekly", "reports"].every((menu) => {
    const prefix = `customer.portal.menu.${menu}.`;
    return PORTAL_MENU_KEYS.some(
      (key) => key.startsWith(prefix) && key !== `customer.portal.menu.${menu}`,
    );
  }) &&
    Boolean(catalog.PERMISSIONS["customer.portal.menu.tickets"]),
);

check(
  "کاتالوگ: کلیدهای تب پورتال مشتری (۱۳.۵) با پیش‌فرض «فقط مشتری» ثبت شده‌اند",
  ["halls", "flocks", "weeks", "visits"].every((name) => {
    const key = `customer.portal.${name}`;
    const entry = catalog.PERMISSIONS[key];
    return (
      Boolean(entry) &&
      entry.group === "portal" &&
      entry.defaults.customer === true &&
      entry.defaults.super_admin === false &&
      entry.defaults.admin === false &&
      entry.defaults.sub_admin === false &&
      entry.defaults.expert === false &&
      entry.lockedTo.length === 0
    );
  }),
);

check(
  "کاتالوگ: کلیدهای «درخواست‌های فارم» (۱۳.۱۱) فقط برای مشتری روشن‌اند",
  ["customer.portal.farm", "customer.portal.farm.request", "customer.portal.farm.cancel"].every(
    (key) => {
      const entry = catalog.PERMISSIONS[key];
      return (
        Boolean(entry) &&
        entry.group === "portal" &&
        entry.defaults.customer === true &&
        entry.defaults.super_admin === false &&
        entry.defaults.admin === false &&
        entry.defaults.sub_admin === false &&
        entry.defaults.expert === false &&
        entry.lockedTo.length === 0
      );
    },
  ),
);

check(
  "کاتالوگ: صف درخواست‌های پورتال — view برای کارکنان و review فقط برای مدیران",
  Boolean(catalog.PERMISSIONS["portal.requests.view"]) &&
    Boolean(catalog.PERMISSIONS["portal.requests.review"]) &&
    catalog.PERMISSIONS["portal.requests.view"].group === "portalRequests" &&
    catalog.PERMISSIONS["portal.requests.review"].group === "portalRequests" &&
    catalog.defaultFor("expert", "portal.requests.view") === true &&
    catalog.defaultFor("expert", "portal.requests.review") === false &&
    catalog.defaultFor("sub_admin", "portal.requests.review") === true &&
    catalog.defaultFor("customer", "portal.requests.view") === false &&
    catalog.defaultFor("customer", "portal.requests.review") === false,
  `expert.view=${catalog.defaultFor("expert", "portal.requests.view")} expert.review=${catalog.defaultFor("expert", "portal.requests.review")}`,
);

check(
  "کاتالوگ: منوی «درخواست‌های پورتال» فقط برای مدیران و در گروه منوها است",
  Boolean(catalog.PERMISSIONS["admin.menu.portalRequests"]) &&
    catalog.PERMISSIONS["admin.menu.portalRequests"].group === "adminMenus" &&
    catalog.defaultFor("admin", "admin.menu.portalRequests") === true &&
    catalog.defaultFor("expert", "admin.menu.portalRequests") === false &&
    catalog.defaultFor("customer", "admin.menu.portalRequests") === false,
);

check(
  "کاتالوگ: «بستن نشست کاربران» (users.sessions.revoke) برای ادمین‌ها روشن و قفل‌نشده است",
  Boolean(catalog.PERMISSIONS["users.sessions.revoke"]) &&
    catalog.defaultFor("super_admin", "users.sessions.revoke") === true &&
    catalog.defaultFor("admin", "users.sessions.revoke") === true &&
    catalog.defaultFor("sub_admin", "users.sessions.revoke") === true &&
    catalog.defaultFor("expert", "users.sessions.revoke") === false &&
    catalog.defaultFor("customer", "users.sessions.revoke") === false &&
    catalog.PERMISSIONS["users.sessions.revoke"].lockedTo.length === 0,
  `locked=${catalog.PERMISSIONS["users.sessions.revoke"]?.lockedTo?.length}`,
);

check(
  "کاتالوگ: منوی «فعالیت کاربران» (admin.menu.activity) فقط برای مدیران روشن است",
  Boolean(catalog.PERMISSIONS["admin.menu.activity"]) &&
    catalog.defaultFor("super_admin", "admin.menu.activity") === true &&
    catalog.defaultFor("admin", "admin.menu.activity") === true &&
    catalog.defaultFor("sub_admin", "admin.menu.activity") === true &&
    catalog.defaultFor("expert", "admin.menu.activity") === false &&
    catalog.defaultFor("customer", "admin.menu.activity") === false &&
    catalog.PERMISSIONS["admin.menu.activity"].lockedTo.length === 0,
);

check(
  "کاتالوگ: همهٔ کلیدها یکتا هستند",
  new Set(catalog.PERMISSION_KEYS).size === catalog.PERMISSION_KEYS.length,
);

check(
  "کاتالوگ: برای هر کلید پیش‌فرض هر ۵ نقش تعیین شده است",
  catalog.PERMISSION_KEYS.every((key) =>
    catalog.ROLES.every(
      (role) => typeof catalog.PERMISSIONS[key].defaults[role] === "boolean",
    ),
  ),
);

const dictionaryKeys = catalog.PERMISSION_KEYS.filter((k) =>
  k.startsWith("dictionary."),
).length;
check(
  "کاتالوگ: هر ۱۹ جدول دیکشنری دو کلید (مشاهده + مدیریت) دارند",
  dictionaryKeys === 38,
  `dictionaryKeys=${dictionaryKeys}`,
);

check(
  "کاتالوگ: ۷ کلید حساس قفل‌شده به سوپرادمین هستند",
  catalog.LOCKED_PERMISSION_KEYS.length === 7 &&
    catalog.LOCKED_PERMISSION_KEYS.every((key) => {
      const lockedTo = catalog.PERMISSIONS[key].lockedTo;
      return lockedTo.length === 1 && lockedTo[0] === "super_admin";
    }),
  `locked=${catalog.LOCKED_PERMISSION_KEYS.length}`,
);

check(
  "کاتالوگ: کلیدهای قفل‌شده برای نقش‌های دیگر قابل فعال‌سازی نیستند",
  ["admin", "sub_admin", "expert", "customer"].every((role) =>
    catalog.LOCKED_PERMISSION_KEYS.every((key) => catalog.isLockedFor(role, key)),
  ) &&
    catalog.LOCKED_PERMISSION_KEYS.every(
      (key) => !catalog.isLockedFor("super_admin", key),
    ),
);

check(
  "کاتالوگ: دو کلید «همیشه فعال» برای سوپرادمین تعریف شده (ضدقفل‌شدگی)",
  ["admin.panel.access", "roles.matrix.view"].every((key) =>
    catalog.isAlwaysOnFor("super_admin", key),
  ),
);

// ✅ کلیدهای منوی سایدبار (جدا از کلیدهای محتوایی)
const menuKeys = [
  "admin.menu.superAdmins",
  "admin.menu.users",
  "admin.menu.dictionary",
  "admin.menu.roles",
  "admin.menu.settings",
  "admin.menu.suggestions",
  "admin.menu.releases",
];
check(
  "کاتالوگ: ۷ کلید منوی سایدبار پنل ادمین وجود دارد",
  menuKeys.every((key) => catalog.isValidPermission(key)),
  `menuKeys=${menuKeys.filter((key) => catalog.isValidPermission(key)).length}/7`,
);
check(
  "کاتالوگ: منوی دیکشنری مستقل از کلید یک جدول است (رفع باگ ناپدیدشدن)",
  catalog.isValidPermission("admin.menu.dictionary") &&
    catalog.defaultFor("admin", "admin.menu.dictionary") === true &&
    catalog.PERMISSIONS["admin.menu.dictionary"].key !==
      "dictionary.hall-types.view",
);

check(
  "کاتالوگ: پیش‌فرض‌ها مطابق رفتار فعلی سیستم است (نمونه‌ها)",
  catalog.defaultFor("expert", "customers.register") === true &&
    catalog.defaultFor("expert", "customers.delete") === false &&
    catalog.defaultFor("admin", "users.list.view") === true &&
    catalog.defaultFor("sub_admin", "admin.panel.access") === false &&
    catalog.defaultFor("customer", "customers.list.view") === false &&
    catalog.defaultFor("admin", "releases.manage") === false,
);

// ============================================================
// ۱-ب) نگهبان: هر requirePermission در مسیرها باید در کاتالوگ باشد
// ============================================================
{
  const fs = require("node:fs");
  const path = require("node:path");
  const routesDir = path.join(import.meta.dirname, "routes");
  const files = fs
    .readdirSync(routesDir)
    .filter((file) => file.endsWith(".js"));

  const used = new Set();
  const dynamicArgs = [];

  files.forEach((file) => {
    const source = fs
      .readFileSync(path.join(routesDir, file), "utf8")
      // ✅ ۱۳.۱۸: توضیحات حذف می‌شوند تا نام‌های نمونه در کامنت
      //    (مثل «requirePermission(view)» یا «...keys») «کلید پویا» شمرده نشوند.
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");

    const collect = (raw) =>
      raw
        .split(",")
        .map((part) => part.trim())
        .forEach((part) => {
          const literal = /^["']([^"']+)["']$/.exec(part);
          if (literal) used.add(literal[1]);
          else if (part) dynamicArgs.push(`${file}:${part}`);
        });

    // ۱) requirePermission("a.b", "c.d")
    source.matchAll(/requirePermission\(([^)]*)\)/g).forEach((match) => {
      collect(match[1]);
    });

    // ۲) ✅ ۱۳.۵: کلیدهایی که به زنجیره‌ساز داده می‌شوند
    //    (tabChain("customer.portal.halls")) — بدون این، کلیدهای پویا
    //    از نگهبان قلم می‌افتادند.
    source.matchAll(/tabChain\(([^)]*)\)/g).forEach((match) => {
      collect(match[1]);
    });
  });

  // ✅ ۱۳.۱۸: پورتال هیچ کلید مجوز دستی ندارد — کلید پایه و کلیدهای هر
  //    اندپوینت از config/portalSchema می‌آیند، پس تنها دو نامِ پویای مجاز
  //    باقی می‌ماند: پارامتر حلقهٔ اندپوینت و کلید پایه.
  const allowedDynamic = new Set([
    "portalRoutes.js:key",
    "portalRoutes.js:PORTAL_BASE_KEY",
  ]);

  const unknown = Array.from(used).filter(
    (key) => !catalog.isValidPermission(key),
  );

  check(
    "نگهبان مسیرها: همهٔ مجوزهای استفاده‌شده در routes در کاتالوگ تعریف شده‌اند",
    unknown.length === 0,
    `used=${used.size} unknown=${unknown.join("|") || "-"}`,
  );

  check(
    "نگهبان مسیرها: کلیدهای پویا فقط از زنجیره‌سازِ مجاز (chainFor) می‌آیند",
    dynamicArgs.every((item) => allowedDynamic.has(item)),
    dynamicArgs.join("|") || "-",
  );

  const customerRoutes = fs.readFileSync(
    path.join(routesDir, "customerRegistrationRoutes.js"),
    "utf8",
  );
  check(
    "نگهبان امنیتی: enable/disable مشتری دیگر فقط protect نیست",
    /requirePermission\("customers\.toggle"\)/.test(customerRoutes),
  );
}

// ===== ۱-ج) سرویس نسخه (برای تازه‌سازی سبک کلاینت) =====
check(
  "سرویس: تابع getPermissionsVersion صادر شده است",
  (() => {
    const service = require("./services/permissionService.js");
    return typeof service.getPermissionsVersion === "function";
  })(),
);

// ============================================================
// ۲) میدل‌ور requirePermission (بدون دیتابیس)
// ============================================================
const runMiddleware = async (middleware, req) => {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  let nextCalled = false;
  await middleware(req, res, () => {
    nextCalled = true;
  });
  return { res, nextCalled };
};

const originalEnforce = process.env.PERMISSIONS_ENFORCE;

// --- حالت فعال (Enforce) ---
process.env.PERMISSIONS_ENFORCE = "true";

let out = await runMiddleware(requirePermission("halls.delete"), {
  method: "POST",
  originalUrl: "/api/test",
  user: { id: 10, role: "expert", permissions: new Set(["halls.view"]) },
});
check(
  "میدل‌ور: بدون مجوز → ۴۰۳ (در حالت فعال)",
  out.res.statusCode === 403 && out.nextCalled === false,
  `status=${out.res.statusCode}`,
);

// ✅ بدنهٔ ۴۰۳ باید «قابل‌فهم برای کاربر» باشد (فرانت پیام می‌سازد)
const deniedBody = out.res.body || {};
check(
  "میدل‌ور: بدنهٔ ۴۰۳ پرچم permissionDenied و کلیدهای لازم را دارد",
  deniedBody.permissionDenied === true &&
    Array.isArray(deniedBody.required) &&
    deniedBody.required.includes("halls.delete") &&
    deniedBody.role === "expert",
  `keys=${(deniedBody.required || []).join(",")}`,
);
check(
  "میدل‌ور: بدنهٔ ۴۰۳ عنوان فارسی مجوزها را می‌فرستد (برای پیام «دسترسی بسته است»)",
  Array.isArray(deniedBody.requiredTitles) &&
    deniedBody.requiredTitles.length === 1 &&
    deniedBody.requiredTitles[0] === catalog.PERMISSIONS["halls.delete"].title &&
    deniedBody.requiredTitles[0] !== "halls.delete",
  `titles=${(deniedBody.requiredTitles || []).join(" | ")}`,
);
check(
  "میدل‌ور: پیام ۴۰۳ قابل‌فهم است (نه پیام خالی/فنی)",
  typeof deniedBody.message === "string" && deniedBody.message.length > 10,
  `message=${deniedBody.message}`,
);

out = await runMiddleware(requirePermission("halls.delete"), {
  method: "POST",
  originalUrl: "/api/test",
  user: { id: 10, role: "expert", permissions: new Set(["halls.delete"]) },
});
check(
  "میدل‌ور: با مجوز → عبور می‌کند",
  out.nextCalled === true && out.res.statusCode === 200,
);

out = await runMiddleware(requirePermission("a.first", "b.second"), {
  method: "POST",
  originalUrl: "/api/test",
  user: { id: 11, role: "admin", permissions: new Set(["b.second"]) },
});
check("میدل‌ور: با یکی از چند کلید → عبور می‌کند", out.nextCalled === true);

out = await runMiddleware(requirePermission("roles.permissions.edit"), {
  method: "PUT",
  originalUrl: "/api/test",
  user: { id: 1, role: "super_admin", permissions: new Set() },
});
check(
  "میدل‌ور: سوپرادمین همیشه عبور می‌کند (کنترل نهایی سیستم)",
  out.nextCalled === true,
);

out = await runMiddleware(requirePermission("halls.view"), {
  method: "GET",
  originalUrl: "/api/test",
  user: undefined,
});
check(
  "میدل‌ور: بدون احراز هویت → ۴۰۱",
  out.res.statusCode === 401,
  `status=${out.res.statusCode}`,
);

// --- حالت dry-run (پیش‌فرض پروژه) ---
process.env.PERMISSIONS_ENFORCE = "false";
out = await runMiddleware(requirePermission("halls.delete"), {
  method: "POST",
  originalUrl: "/api/test",
  user: { id: 10, role: "expert", permissions: new Set() },
});
check(
  "میدل‌ور: در حالت dry-run هیچ ۴۰۳ای برگردانده نمی‌شود (فقط لاگ)",
  out.nextCalled === true && out.res.statusCode === 200,
);

if (originalEnforce === undefined) delete process.env.PERMISSIONS_ENFORCE;
else process.env.PERMISSIONS_ENFORCE = originalEnforce;

// ============================================================
// ۳) سرویس + دیتابیس (اختیاری — با ALLOW_DB_TESTS=true)
// ============================================================
const DB_ENABLED =
  process.env.ALLOW_DB_TESTS === "true" &&
  process.env.NODE_ENV !== "production";

if (!DB_ENABLED) {
  console.log(
    "⏭️  بخش دیتابیس رد شد (برای اجرا:  $env:ALLOW_DB_TESTS='true'; npm run test:permissions)",
  );
} else {
  const { sequelize } = require("./config/database.js");
  const User = require("./models/User.js");
  const RolePermission = require("./models/RolePermission.js");
  const UserPermission = require("./models/UserPermission.js");
  const PermissionAuditLog = require("./models/PermissionAuditLog.js");
  const permissionService = require("./services/permissionService.js");

  let dbReady = false;
  let testUser = null;

  try {
    await Promise.race([
      sequelize.authenticate(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("db timeout")), 8000),
      ),
    ]);
    dbReady = true;
  } catch (error) {
    console.log(`⚠️  دیتابیس در دسترس نیست (${error.message}) → بخش ۳ رد شد`);
  }

  if (dbReady) {
    try {
      // ===== پاک‌سازی وضعیت قبلی =====
      await RolePermission.destroy({ where: {} });
      permissionService.clearPermissionsCache();

      // ===== ۱) پیش‌فرض‌ها بدون هیچ ردیف =====
      let effective = await permissionService.getEffectivePermissions({
        id: 0,
        role: "expert",
      });
      check(
        "دیتابیس: بدون استثنا، مجوز کارشناس = پیش‌فرض کاتالوگ",
        effective.permissions.has("customers.register") &&
          !effective.permissions.has("halls.delete"),
      );

      // ===== ۲) تغییر سطح دسترسی نقش =====
      const auditBefore = await PermissionAuditLog.count();
      const roleResult = await permissionService.setRolePermissions({
        role: "expert",
        updates: [{ key: "halls.delete", allowed: true }],
        actorId: null,
        note: "تست خودکار",
      });
      const roleRow = await RolePermission.findOne({
        where: { role: "expert", permission_key: "halls.delete" },
      });
      effective = await permissionService.getEffectivePermissions({
        id: 0,
        role: "expert",
      });
      check(
        "دیتابیس: فعال‌کردن مجوز نقش → ردیف استثنا + اثر فوری",
        !roleResult.error &&
          roleResult.applied.includes("halls.delete") &&
          !!roleRow &&
          roleRow.allowed === true &&
          effective.permissions.has("halls.delete"),
      );

      const auditAfter = await PermissionAuditLog.count();
      check(
        "دیتابیس: هر تغییر در permission_audit_logs ثبت می‌شود",
        auditAfter > auditBefore,
        `before=${auditBefore} after=${auditAfter}`,
      );

      // ===== ۳) بازگشت به پیش‌فرض ⇒ ردیف حذف می‌شود (جدول تمیز) =====
      const backResult = await permissionService.setRolePermissions({
        role: "expert",
        updates: [{ key: "halls.delete", allowed: false }],
        actorId: null,
      });
      const roleRowAfter = await RolePermission.findOne({
        where: { role: "expert", permission_key: "halls.delete" },
      });
      effective = await permissionService.getEffectivePermissions({
        id: 0,
        role: "expert",
      });
      check(
        "دیتابیس: مقدار مساوی پیش‌فرض ⇒ ردیف حذف و مجوز خاموش می‌شود",
        backResult.removed.includes("halls.delete") &&
          roleRowAfter === null &&
          !effective.permissions.has("halls.delete"),
      );

      // ===== ۴) کلیدهای قفل‌شده قابل تغییر نیستند =====
      const lockedResult = await permissionService.setRolePermissions({
        role: "admin",
        updates: [{ key: "customers.delete", allowed: true }],
        actorId: null,
      });
      const lockedRow = await RolePermission.findOne({
        where: { role: "admin", permission_key: "customers.delete" },
      });
      check(
        "دیتابیس: کلید قفل‌شده (حذف مشتری) برای نقش مدیر رد می‌شود",
        !!lockedResult.error && lockedRow === null,
        lockedResult.error || "",
      );

      // ===== ۵) کلیدهای «همیشه فعال» قابل خاموش‌شدن نیستند =====
      const alwaysOnResult = await permissionService.setRolePermissions({
        role: "super_admin",
        updates: [{ key: "admin.panel.access", allowed: false }],
        actorId: null,
      });
      check(
        "دیتابیس: خاموش‌کردن کلید «همیشه فعال» سوپرادمین رد می‌شود",
        !!alwaysOnResult.error,
        alwaysOnResult.error || "",
      );

      // ===== ۶) سطح دسترسی اختصاصی کاربر =====
      const stamp = Date.now();
      testUser = await User.create({
        first_name: "تست",
        last_name: "دسترسی",
        username: `perm_test_${stamp}`,
        email: `perm_test_${stamp}@example.com`,
        password: "test1234",
        mobile_number: `09${String(stamp).slice(-9)}`,
        role: "expert",
        status: "active",
      });

      const userResult = await permissionService.setUserPermissions({
        user: { id: testUser.id, role: "expert" },
        updates: [{ key: "admin.panel.access", allowed: true }],
        actorId: null,
        note: "تست خودکار",
      });
      const userRow = await UserPermission.findOne({
        where: { user_id: testUser.id, permission_key: "admin.panel.access" },
      });
      const userEffective = await permissionService.getEffectivePermissions({
        id: testUser.id,
        role: "expert",
      });
      const roleEffective = await permissionService.getEffectivePermissions({
        id: 0,
        role: "expert",
      });
      check(
        "دیتابیس: مجوز اختصاصی کاربر مستقل از نقش اعمال می‌شود",
        !userResult.error &&
          userRow?.allowed === true &&
          userEffective.permissions.has("admin.panel.access") &&
          !roleEffective.permissions.has("admin.panel.access"),
      );

      const userAudit = await PermissionAuditLog.findOne({
        where: { target_type: "user", target_id: String(testUser.id) },
        order: [["id", "DESC"]],
      });
      check(
        "دیتابیس: تغییر دسترسی کاربر در گزارش با نوع user ثبت می‌شود",
        !!userAudit && userAudit.new_value === "true",
      );

      // ===== ۷) بازگردانی کاربر به سطح نقش =====
      const resetResult = await permissionService.resetUserPermissions({
        user: { id: testUser.id, role: "expert" },
        actorId: null,
      });
      const userRowAfter = await UserPermission.findOne({
        where: { user_id: testUser.id, permission_key: "admin.panel.access" },
      });
      check(
        "دیتابیس: بازگردانی کاربر ⇒ استثنا حذف و به سطح نقش برمی‌گردد",
        !resetResult.error && userRowAfter === null,
      );

      // ===== ۸) گزارش تغییرات =====
      const audit = await permissionService.getAuditLogs({ page: 1, limit: 5 });
      check(
        "دیتابیس: گزارش تغییرات با عنوان فارسی مجوز برگردانده می‌شود",
        Array.isArray(audit.items) &&
          audit.items.length > 0 &&
          typeof audit.items[0].permissionTitle === "string",
        `items=${audit.items.length}`,
      );
    } finally {
      // ===== پاک‌سازی کامل (تست نباید اثری روی داده‌ها بگذارد) =====
      try {
        if (testUser) {
          await UserPermission.destroy({ where: { user_id: testUser.id } });
          await testUser.destroy();
        }
        await RolePermission.destroy({ where: {} });
        await PermissionAuditLog.destroy({ where: { note: "تست خودکار" } });
        permissionService.clearPermissionsCache();
      } catch (cleanupError) {
        console.error("⚠️ خطا در پاک‌سازی تست:", cleanupError.message);
      }
      try {
        await sequelize.close();
      } catch {
        /* بی‌صدا */
      }
    }
  }
}

const failed = results.filter((x) => !x).length;
console.log(failed === 0 ? "\n✅ ALL PASS" : `\n❌ ${failed} FAILED`);
process.exitCode = failed === 0 ? 0 : 1;

