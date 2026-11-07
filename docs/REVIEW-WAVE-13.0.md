# بازبینی موج ۱۳.۰ — «پیوند حساب کاربر با پروندهٔ مشتری»

> **هدف:** هر حساب کاربری با نقش `customer` بداند صاحب کدام پروندهٔ مشتری است
> (`customer_personal_information.id`)، تا ورود به پرونده و فازهای بعدی
> (پورتال مشتری ۱۳.۲، ثبت‌نام عمومی ۱۳.۳، کنسول مجوز ۱۳.۴) لنگر داشته باشند.

---

## ۱) مشکلی که این موج می‌بندد

| مشکل | شاهد در کد (قبل از این موج) | اثر |
|---|---|---|
| حسابِ مشتری صفحهٔ بی‌شناسه می‌گرفت | `landingForRole` ⇒ `return "/customer-info"` و `customer-info.service.js` ⇒ «شناسه مشتری یافت نشد» | هیچ حساب مشتری‌ای قابل استفاده نبود |
| «مشتری» قابل ساخت نبود | سلکت نقش در `admin-panel.html` فقط `sub_admin` و `expert` داشت | ساخت حساب مشتری فقط با curl |
| «این حساب مال کدام مشتری است؟» بی‌پاسخ | `users` هیچ ستون ارتباطی نداشت | پشتیبانی/گزارش بی‌لنگر؛ نشت داده در آینده |
| ویرایش کاربر، کاربرِ تکراری می‌ساخت | دکمهٔ ذخیره همیشه `registerUser` را صدا می‌زد | ثبت دوباره به‌جای بروزرسانی (باگ جانبی، همین‌جا رفع شد) |

---

## ۲) تصمیم‌های طراحی (قفل‌شده)

| # | تصمیم | دلیل |
|---|---|---|
| ۱ | جدول هدف: `customer_personal_information` | همان شناسه‌ای که `units`, `halls`, `flock`, `bookmarks`, `activity_logs.customer_id` استفاده می‌کنند |
| ۲ | **یکتا**: `users_customer_id_unique` (Postgres چند `NULL` را مجاز می‌داند) | «یک پرونده = یک هویت»؛ پیامک دومرحله‌ای نمی‌تواند به دو حساب برود |
| ۳ | `FK … ON DELETE SET NULL ON UPDATE CASCADE` | حذف پرونده، حساب را نمی‌کشد؛ فقط پیوند پاک می‌شود |
| ۴ | فقط نقش `customer` می‌تواند `customer_id` بگیرد | برای `expert/admin` معنا ندارد ⇒ ۴۰۰ صریح |
| ۵ | `customer_id` در **`protectedFields`** | بدون آن، مشتری با `PUT /users/<خودش>` پروندهٔ دیگری را به حسابش می‌چسباند و **اطلاعات او را می‌بیند** |
| ۶ | کلید مجوز تازهٔ `users.customer.link` (پیش‌فرض `D.admin`) | ۱۳.۴ بتواند «تعیین پرونده» را جدا از «ساخت کاربر» بدهد/بگیرد |
| ۷ | `landing` برای مشتری: `/customer-info?id=<خودش>` | رفع باگ «شناسه مشتری یافت نشد» |
| ۸ | حساب بدون پرونده ⇒ همان `/customer-info` + پیام روشن | حساب قدیمی می‌شکند ولی «چرا» را می‌گوید |

---

## ۳) تغییرات فایل‌به‌فایل

| فایل | تغییر |
|---|---|
| `Backend/migrations/20261007000000-add-users-customer-id.js` (**جدید**) | `addColumn` + ایندکس یکتا + `addConstraint` (FK, SET NULL) — idempotent، `down` به ترتیب معکوس |
| `Backend/models/User.js` | فیلد `customer_id` با `references` |
| `Backend/models/associations.js` | `User.belongsTo(CustomerPersonalInfo, as: "customer")` · `CustomerPersonalInfo.hasMany(User, as: "login_accounts")` |
| `Backend/config/permissions.js` | `users.customer.link` («تعیین پروندهٔ مشتری برای حساب کاربر», `D.admin`) |
| `Backend/controllers/userController.js` | `normalizeCustomerId` · `resolveCustomerLink` · `isCustomerIdConflict` · `CUSTOMER_LINK_INCLUDE` · اعتبارسنجی در `registerUser`/`updateUser` · `customer_id` در `protectedFields` · پاک‌شدن پیوند با تغییر نقش · پیام اختصاصی برای پروندهٔ تکراری |
| `Backend/controllers/loginOtpController.js` | `landingForRole(role, user)` ⇒ `/customer-info?id=<customer_id>` |
| `Backend/scripts/verify-db.js` | `users.customer_id` در `EXPECTED_COLUMNS` · `users_customer_id_unique` در `EXPECTED_INDEXES` |
| `Frontend/src/pages/admin-panel.html` | گزینهٔ «مشتری» در `#role` · بلوک `#customerLinkGroup` (`#customerSearch` + `#customerLink`) |
| `Frontend/src/features/admin-panel/admin-panel.api.js` | `getCustomers({ search, limit })` |
| `Frontend/src/features/admin-panel/admin-panel.service.js` | `loadCustomerOptions` · `syncCustomerLink` · **`updateUser`** (رفع باگ ثبت تکراری) · الزام انتخاب پرونده برای نقش مشتری · جستجوی زندهٔ ۳۰۰ms |
| `Frontend/src/features/admin-panel/admin-panel.renderer.js` | `customer_id` در payload (فقط نقش مشتری) · حفظ مقدار فعلی در ویرایش · نشان «بدون پروندهٔ مشتری» |
| `Frontend/src/features/admin-panel/admin-panel.validation.js` | `validateUser(data, { requirePassword })` + `validateUserUpdate` |
| `Frontend/src/features/customer-info/customer-info.service.js` | پرکردن `id` از `authService.getUser()?.customer_id` + پیام روشنِ «حساب متصل نشده» |
| `Frontend/user-customer-guard-test.mjs` (**جدید**) | ۴۱ بررسی ایستا (پایین‌تر) |
| `Frontend/package.json` · `tools/gate.mjs` · `tools/gate.ps1` | `test:user-customer` به گیت اضافه شد |

---

## ۴) قرارداد API

| مسیر | نقش | تغییر |
|---|---|---|
| `POST /api/users/register` | `users.create` + (برای پرونده) `users.customer.link` | بدنه: `customer_id` (اختیاری، فقط با `role: "customer"`) |
| `PUT /api/users/:id` | `users.edit` + (برای پرونده) `users.customer.link` | همان؛ برای کاربر عادی **حذف می‌شود** |
| `GET /api/users` · `GET /api/users/:id` | `users.list.view` | `customer: { id, customer_code, full_name }` در خروجی |

**پیام‌های خطای فارسی:**

| وضعیت | پیام |
|---|---|
| نقش غیرمشتری + `customer_id` | «پروندهٔ مشتری فقط برای نقش «مشتری» قابل تعیین است» |
| شناسهٔ نامعتبر | «شناسهٔ پروندهٔ مشتری معتبر نیست» |
| پروندهٔ ناموجود | «پروندهٔ مشتری با این شناسه یافت نشد» |
| پروندهٔ تکراری | «این پروندهٔ مشتری قبلاً به حساب کاربری دیگری متصل شده است» |
| بدون مجوز | «دسترسی به تعیین پروندهٔ مشتری برای حساب کاربر را ندارید» |

> پاک‌کردن پیوند: ارسال `customer_id: null` یا `""` (فقط ادمین). تغییر نقش از `customer`
> به نقش دیگر **به‌صورت خودکار** پیوند را پاک می‌کند.

---

## ۵) اعتبارسنجی انجام‌شده

| ابزار | نتیجه |
|---|---|
| `npm run db:migrate` | `20261007000000-add-users-customer-id` اعمال شد (یک‌بار rollback + اجرای مجدد برای آزمون `down`) |
| `npm run db:verify` | **ALL PASS** — ۴۵ جدول، ۱۲ مایگریشن، ستون و ایندکس تازه |
| آزمون دودی دیتابیس (موقت) | ۶/۶ — ساخت کاربر با پرونده · رد شدن حساب دوم روی همان پرونده (یکتایی) · **حذف پرونده ⇒ `customer_id = NULL`** (اثبات SET NULL) |
| بررسی `pg_constraint` | `users_customer_id_fk … ON UPDATE CASCADE ON DELETE SET NULL` (`confdeltype = n`) |
| `npm run lint` (Frontend) | پاک |
| `npm run test:user-customer` | **41/41 PASS** |
| `npm run test:login-otp` | PASS (بدون رگرسیون) |
| `db:verify` + گیت کامل | **GATE-PASS** (۴۱ گام) |

---

## ۶) باگ‌هایی که سر راه پیدا و رفع شدند

1. **`showConstraint` گمراه‌کننده بود:** در Sequelize 6 برای کلیدِ ناموجود خطا نمی‌دهد و مقدار
   خالی برمی‌گرداند ⇒ مایگریشن «کلید خارجی هست» تصور می‌کرد و FK ساخته نمی‌شد
   (`db:verify` هم چون FK را چک نمی‌کند سبز می‌ماند). حالا وجود کلید از `pg_constraint` پرسیده می‌شود.
2. **ویرایش کاربر، کاربر تکراری می‌ساخت:** هندلر `#saveUserBtn` همیشه `registerUser` را صدا می‌زد.
   اکنون در حالت ویرایش `updateUser` (PUT) اجرا می‌شود.

---

## ۷) گام بعدی

- **۱۳.۲** پورتال مشتری (`/portal`) — روی همین `users.customer_id` سوار می‌شود.
- **۱۳.۳** ثبت‌نام عمومی + OTP + صف تأیید ادمین.
- **۱۳.۴** کنسول مجوز مشتری (کلید `users.customer.link` از الان آماده است).
- **۱۳.۵** PWA (manifest · `sw.js` · آیکون مربع · پوستهٔ آفلاین).
