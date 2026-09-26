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
  catalog.TOTAL_PERMISSIONS === 163 && catalog.PERMISSION_GROUPS.length === 16,
  `keys=${catalog.TOTAL_PERMISSIONS} groups=${catalog.PERMISSION_GROUPS.length}`,
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
  files.forEach((file) => {
    const source = fs.readFileSync(path.join(routesDir, file), "utf8");
    const matches = source.matchAll(/requirePermission\(([^)]*)\)/g);
    for (const match of matches) {
      match[1]
        .split(",")
        .map((part) => part.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean)
        .forEach((key) => used.add(key));
    }
  });

  const unknown = Array.from(used).filter(
    (key) => !catalog.isValidPermission(key),
  );

  check(
    "نگهبان مسیرها: همهٔ مجوزهای استفاده‌شده در routes در کاتالوگ تعریف شده‌اند",
    unknown.length === 0,
    `used=${used.size} unknown=${unknown.join("|") || "-"}`,
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

