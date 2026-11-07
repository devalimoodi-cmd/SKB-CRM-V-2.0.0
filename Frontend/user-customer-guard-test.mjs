// ============================================================
//  گارد «پیوند حساب کاربر با پروندهٔ مشتری» — فاز ۱۳.۰
// ------------------------------------------------------------
//  ریشهٔ خطری که این گارد از بازگشتش جلوگیری می‌کند:
//   ۱) حسابِ نقش «مشتری» بدون customer_id، پس از ورود به
//      «/customer-info» بدون id می‌رفت ⇒ پیام «شناسه مشتری یافت نشد»
//      ⇒ عملاً هیچ حساب مشتری‌ای قابل استفاده نبود.
//   ۲) اگر customer_id در protectedFields نباشد، یک مشتری می‌تواند با
//      PUT /users/<خودش> پروندهٔ مشتریِ دیگری را به حسابش بچسباند و
//      اطلاعات او را ببیند (ارتقای سطح دسترسی).
//   ۳) اگر پیوند یکتا نباشد، دو حساب روی یک پرونده می‌نشینند و
//      «مالکیت داده» بی‌معنا می‌شود.
//   ۴) اگر ON DELETE SET NULL نباشد، حذف پرونده یا حساب را می‌کشد یا
//      خطای کلید خارجی می‌دهد.
//
//  اجرا:  npm run test:user-customer      (در پوشهٔ Frontend)
// ============================================================
import fs from "node:fs";
import path from "node:path";

const here = import.meta.dirname;
const ROOT = path.join(here, "..");

const results = [];
const check = (name, ok, extra = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}${extra ? " :: " + extra : ""}`);
};

const read = (relPath) => {
  try {
    return fs
      .readFileSync(path.join(ROOT, relPath), "utf8")
      .replace(/^\uFEFF/, "");
  } catch {
    return "";
  }
};
const exists = (relPath) => fs.existsSync(path.join(ROOT, relPath));

// ============================================================
// ۰) فایل‌های این فاز
// ============================================================
const FILES = {
  migration: "Backend/migrations/20261007000000-add-users-customer-id.js",
  userModel: "Backend/models/User.js",
  associations: "Backend/models/associations.js",
  permissions: "Backend/config/permissions.js",
  userController: "Backend/controllers/userController.js",
  otpController: "Backend/controllers/loginOtpController.js",
  verifyDb: "Backend/scripts/verify-db.js",
  adminHtml: "Frontend/src/pages/admin-panel.html",
  adminApi: "Frontend/src/features/admin-panel/admin-panel.api.js",
  adminService: "Frontend/src/features/admin-panel/admin-panel.service.js",
  adminRenderer: "Frontend/src/features/admin-panel/admin-panel.renderer.js",
  adminValidation: "Frontend/src/features/admin-panel/admin-panel.validation.js",
  customerInfo: "Frontend/src/features/customer-info/customer-info.service.js",
};

check("همهٔ فایل‌های فاز ۱۳.۰ موجودند", Object.values(FILES).every(exists));

const migration = read(FILES.migration);
const userModel = read(FILES.userModel);
const associations = read(FILES.associations);
const permissions = read(FILES.permissions);
const userController = read(FILES.userController);
const otpController = read(FILES.otpController);
const verifyDb = read(FILES.verifyDb);
const adminHtml = read(FILES.adminHtml);
const adminApi = read(FILES.adminApi);
const adminService = read(FILES.adminService);
const adminRenderer = read(FILES.adminRenderer);
const adminValidation = read(FILES.adminValidation);
const customerInfo = read(FILES.customerInfo);

// ============================================================
// ۱) دیتابیس: ستون، ایندکس یکتا، کلید خارجی SET NULL
// ============================================================
check(
  "مایگریشن: ستون users.customer_id از نوع INTEGER و nullable است",
  /const COLUMN = "customer_id"/.test(migration) &&
    /type: Sequelize\.INTEGER/.test(migration) &&
    /allowNull: true/.test(migration),
);

check(
  "مایگریشن: ایندکس یکتا با نام users_customer_id_unique ساخته می‌شود",
  /users_customer_id_unique/.test(migration) && /unique: true/.test(migration),
);

check(
  "مایگریشن: کلید خارجی به customer_personal_information(id) اشاره می‌کند",
  /customer_personal_information/.test(migration) &&
    /field: "id"/.test(migration) &&
    /type: "foreign key"/.test(migration),
);

check(
  "مایگریشن: ON DELETE SET NULL (حذف پرونده، حساب را حذف نمی‌کند)",
  /onDelete: "SET NULL"/.test(migration),
);

check(
  "مایگریشن: idempotent است (describeTable + showIndex + وجود کلید در pg_constraint)",
  /describeTable/.test(migration) &&
    /showIndex/.test(migration) &&
    /pg_constraint/.test(migration),
);

check(
  "مایگریشن: برگشت (down) اول کلید خارجی، بعد ایندکس، بعد ستون را برمی‌دارد",
  migration.indexOf("removeConstraint") > 0 &&
    migration.indexOf("removeConstraint") < migration.indexOf("removeIndex") &&
    migration.indexOf("removeIndex") < migration.indexOf("removeColumn"),
);

check(
  "مدل User: فیلد customer_id با ارجاع به پروندهٔ مشتری تعریف شده است",
  /customer_id: \{/.test(userModel) &&
    /customer_personal_information/.test(userModel),
);

check(
  "associations: User.belongsTo با نام «customer» و hasMany با «login_accounts»",
  /User\.belongsTo\(CustomerPersonalInfo, \{[^}]{0,120}as: "customer"/.test(
    associations,
  ) &&
    /CustomerPersonalInfo\.hasMany\(User, \{[^}]{0,120}as: "login_accounts"/.test(
      associations,
    ),
);

check(
  "db:verify: ستون users.customer_id در EXPECTED_COLUMNS هست",
  /"last_seen_at",[\s\S]{0,160}"customer_id"/.test(verifyDb),
);

check(
  "db:verify: ایندکس users_customer_id_unique در EXPECTED_INDEXES هست",
  /"users_customer_id_unique"/.test(verifyDb),
);

// ============================================================
// ۲) امنیت: دامنهٔ نقش، مجوز اختصاصی و protectedFields
// ============================================================
check(
  "کنترلر: نرمال‌سازی/اعتبارسنجی شناسهٔ پرونده وجود دارد",
  /const normalizeCustomerId =/.test(userController) &&
    /const resolveCustomerLink = /.test(userController),
);

check(
  "کنترلر: نقش غیرمشتری نمی‌تواند پرونده داشته باشد (پیام فارسی)",
  /role !== "customer"/.test(userController) &&
    /پروندهٔ مشتری فقط برای نقش/.test(userController),
);

check(
  "کنترلر: وجود پرونده در دیتابیس بررسی می‌شود (CustomerPersonalInfo.findByPk)",
  /CustomerPersonalInfo\.findByPk\(normalized\.value/.test(userController),
);

check(
  "کنترلر: مجوز اختصاصی users.customer.link اعمال می‌شود",
  /userHasPermission\(req, "users\.customer\.link"\)/.test(userController),
);

check(
  "مجوزها: کلید users.customer.link در کاتالوگ تعریف شده است",
  /item\("users\.customer\.link"/.test(permissions),
);

check(
  "کنترلر: customer_id در protectedFields است (جلوگیری از ارتقای سطح دسترسی)",
  /const protectedFields = \[[\s\S]{0,400}\n      "customer_id",/.test(
    userController,
  ),
);

check(
  "کنترلر: تغییر نقش به غیرمشتری، پیوند را پاک می‌کند",
  /updateData\.role !== "customer"[\s\S]{0,160}updateData\.customer_id = null/.test(
    userController,
  ),
);

check(
  "کنترلر: خطای پروندهٔ تکراری پیام اختصاصی می‌گیرد (isCustomerIdConflict)",
  /const isCustomerIdConflict =/.test(userController) &&
    /این پروندهٔ مشتری قبلاً به حساب کاربری دیگری متصل شده است/.test(
      userController,
    ),
);

check(
  "کنترلر: ثبت کاربر، customer_id را ذخیره می‌کند",
  /customer_id: customerLink\.customerId/.test(userController),
);

check(
  "کنترلر: فهرست و جزئیات کاربر، پروندهٔ مشتری را include می‌کند",
  (userController.match(/include: CUSTOMER_LINK_INCLUDE/g) || []).length >= 2,
);

check(
  "کنترلر: بررسی پیوند پیش از User.create انجام می‌شود",
  userController.indexOf("const customerLink = await resolveCustomerLink") >
    0 &&
    userController.indexOf("const customerLink = await resolveCustomerLink") <
      userController.indexOf("const newUser = await User.create"),
);

// ============================================================
// ۳) پس از ورود: مشتری به پروندهٔ خودش هدایت می‌شود
// ============================================================
check(
  "ورود: landingForRole امضای (role, user) دارد",
  /const landingForRole = \(role, user = null\) =>/.test(otpController),
);

check(
  "ورود: حساب مشتری به «/customer-info?id=<customer_id>» می‌رود",
  /\/customer-info\?id=\$\{customerId\}/.test(otpController),
);

check(
  "ورود: verifyLogin اطلاعات کاربر را به landingForRole می‌دهد",
  /landing: landingForRole\(user\.role, user\)/.test(otpController),
);

check(
  "ورود: مقصد پیش‌فرض «/customer-info» برای حساب بدون پرونده حفظ شده است",
  /return "\/customer-info";/.test(otpController),
);

check(
  "صفحهٔ مشتری: نبود id در URL با پروندهٔ حسابِ واردشده پر می‌شود",
  /authService\.getUser\(\)\?\.customer_id/.test(customerInfo),
);

check(
  "صفحهٔ مشتری: پیام روشنِ «حساب متصل نشده» به‌جای خطای خشک",
  /به پروندهٔ مشتری متصل نشده است/.test(customerInfo),
);

// ============================================================
// ۴) پنل مدیریت: انتخاب پرونده برای نقش مشتری
// ============================================================
check(
  "HTML: نقش «مشتری» در انتخاب نقش کاربر هست",
  /<option value="customer">/.test(adminHtml),
);

check(
  "HTML: بلوک پروندهٔ مشتری (#customerLinkGroup) با انتخاب و جستجو",
  /id="customerLinkGroup"/.test(adminHtml) &&
    /id="customerLink"/.test(adminHtml) &&
    /id="customerSearch"/.test(adminHtml),
);

check(
  "API: getCustomers از مسیر لیست مشتریان استفاده می‌کند",
  /async getCustomers\(params = \{\}\)/.test(adminApi) &&
    /API_CONSTANTS\.ENDPOINTS\.CUSTOMERS\.LIST/.test(adminApi),
);

check(
  "سرویس: بارگذاری گزینه‌های مشتری و هم‌گام‌سازی با نقش",
  /async loadCustomerOptions\(/.test(adminService) &&
    /syncCustomerLink\(role\)/.test(adminService),
);

check(
  "سرویس: ثبت کاربر با نقش مشتری بدون پرونده رد می‌شود",
  /data\.role === "customer" && !data\.customer_id/.test(adminService),
);

check(
  "سرویس: ویرایش کاربر با نقش مشتری بدون پرونده رد می‌شود",
  /payload\.role === "customer" && !payload\.customer_id/.test(adminService),
);

check(
  "سرویس: حالت ویرایش واقعاً PUT می‌زند (نه ساخت کاربر تکراری)",
  /if \(this\.isEditing && this\.editingUserId\) \{[\s\S]{0,120}this\.updateUser\(/.test(
    adminService,
  ) && /async updateUser\(id, data, role = null\)/.test(adminService),
);

check(
  "سرویس: فهرست مشتریان با جستجوی زنده (debounce) بارگذاری می‌شود",
  /this\.customerSearchTimer = setTimeout/.test(adminService),
);

check(
  "رندر: customer_id فقط برای نقش مشتری در payload می‌رود",
  /customer_id: role === "customer" \? customerValue \|\| null : null/.test(
    adminRenderer,
  ),
);

check(
  "رندر: مقدار پروندهٔ فعلی در حالت ویرایش از دست نمی‌رود",
  /const previous = select\.value;/.test(adminRenderer) &&
    /select\.value = previous;/.test(adminRenderer),
);

check(
  "رندر: نشان «بدون پروندهٔ مشتری» در جدول کاربران",
  /بدون پروندهٔ مشتری/.test(adminRenderer),
);

check(
  "اعتبارسنجی: در ویرایش، رمز عبور اجباری نیست",
  /validateUserUpdate\(data\)[\s\S]{0,80}requirePassword: false/.test(
    adminValidation,
  ),
);

// ============================================================
// ۵) رگرسیون: مسیر عمومی تازه‌ای اضافه نشده است
// ============================================================
const userRoutes = read("Backend/routes/userRoutes.js");
check(
  "مسیرها: customer_id از طریق مسیر عمومی/بی‌احراز هویت قابل نوشتن نیست",
  !/customer_id/.test(userRoutes),
);

// ============================================================
// خلاصه
// ============================================================
const failed = results.filter((ok) => !ok).length;
console.log(
  `\n${failed === 0 ? "✅" : "❌"} ${results.length - failed}/${results.length} بررسی موفق`,
);

if (failed > 0) {
  console.log("FAIL - گارد پیوند کاربر و پروندهٔ مشتری شکست خورد");
  process.exit(1);
}
console.log("PASS - گارد پیوند کاربر و پروندهٔ مشتری سالم است");
