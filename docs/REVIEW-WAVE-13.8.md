# موج ۱۳.۸ — «پروفایل من» + «داشبورد تحلیلی» در پورتال مشتری

> پیش‌نیاز: موج ۱۳.۷.۳ (سوییچ تأیید خودکار ثبت‌نام)
> دامنه: **پورتال مشتری از «فقط خواندنی» به «خواندن + ویرایش محدودِ پروندهٔ خودم»**،
> به‌همراه تب تحلیلی اختصاصی مشتری. صفر تغییر در مسیرهای کارکنان.

---

## ۱) خواستهٔ کارفرما

| # | خواسته | نتیجه در این موج |
|---|---|---|
| ۱ | مشتری بتواند اطلاعات پروفایل خودش را ویرایش کند | `PATCH /api/portal/profile` با **فهرست سفید ۱۵ فیلد** |
| ۲ | شمارهٔ موبایل امن عوض شود (شماره = هویت ورود) | دو مسیر جدا با **کد پیامکی** به شمارهٔ جدید |
| ۳ | مشتری نمودارهای گلهٔ خودش را ببیند | تب «داشبورد تحلیلی» با ۴ مسیر اختصاصی |
| ۴ | «مقایسه» فقط بین گله‌های خودِ مشتری باشد | `flockGroupId`/`flockId` با بررسی مالکیت، غیرخودی ⇒ ۴۰۴ |
| ۵ | مدیر بتواند هر بخش را ببندد | ۱۲ کلید `customer.portal.*` تازه (۱۷۶ ⇒ ۱۸۸) |

## ۲) چرا مسیرهای پورتال و نه باز کردن مسیرهای کارکنان؟

`/api/dashboard/charts` و `/api/dashboard/analysis` مقدار `customerId` را از
**کوئری** می‌خوانند. اگر نقش «مشتری» به آن‌ها اضافه می‌شد، با تغییر یک پارامتر
دادهٔ هر مشتری دیگری قابل خواندن بود. بنابراین:

```
GET  /api/portal/dashboard/options    گله/سالن‌های خودم + کدام نمودار مجاز است
GET  /api/portal/dashboard/summary    شمارنده‌های خودم (بدون آمار سایر مشتریان)
GET  /api/portal/dashboard/charts     سری‌های وزن/تلفات/دان
GET  /api/portal/dashboard/analysis   وزن واقعی vs استاندارد نژاد
```

داخل `portalDashboardController` مقدار مشتری **تحمیل** می‌شود:

```js
query.customerId = String(scopeIdOf(req)); // از توکن، نه از کلاینت
```

سپس کار به همان `dashboardController.getChartsData` واگذار می‌شود (یک منبع
حقیقت برای محاسبات؛ پنل کارشناس و پورتال عدد یکسان می‌دهند).

## ۳) سطح نوشتن (سه مسیر، نه یکی بیشتر)

| متد | مسیر | کلید مجوز | محدودکننده |
|---|---|---|---|
| `PATCH` | `/api/portal/profile` | `customer.portal.profile` + `customer.portal.profile.edit` | `portalWriteLimiter` (۲۰/دقیقه) |
| `POST` | `/api/portal/profile/mobile/request` | همان دو + `requireOwnScope` | `portalWriteLimiter` + `otpLimiter` (۱۰/دقیقه) |
| `POST` | `/api/portal/profile/mobile/confirm` | همان دو | `portalWriteLimiter` + `otpLimiter` |

🔒 `mobile_number`، `customer_type_id`، `customer_code`، `active`، `status`،
`sales_department` و `created_by`/`updated_by` **هرگز** از بدنهٔ PATCH اعمال
نمی‌شوند؛ در `services/portalProfileRules.js` فهرست `PROFILE_LOCKED` هستند و در
صورت ارسال، در `ignored` گزارش می‌شوند (نه خطا — کلاینت قدیمی نمی‌شکند).

## ۴) چرا تغییر موبایل مسیر جدا دارد؟

شمارهٔ موبایل، نام کاربری ورود است. اگر با یک PATCH ساده عوض می‌شد، هر نشست
دزدیده‌شده می‌توانست حساب را به شمارهٔ خودش منتقل کند. پس:

1. مشتری شمارهٔ جدید را وارد می‌کند؛
2. سرور یک `LoginChallenge` با `purpose = "profile_mobile"` می‌سازد و کد را
   **به شمارهٔ جدید** می‌فرستد؛
3. شمارهٔ جدید در ستون تازهٔ `login_challenges.payload` (JSONB) نگه داشته می‌شود
   — هرگز در حافظهٔ سرور (با ری‌استارت گم می‌شود) و هرگز کد خام؛
4. پس از تأیید، `customers.mobile_number` و `users.mobile_number` در یک
   `transaction` به‌روزرسانی می‌شوند (اگر شماره قبلاً برای حساب دیگری ثبت شده
   باشد ⇒ `409`).

> مایگریشن: `Backend/migrations/20261108000004-add-payload-to-login-challenges.js`
> (idempotent · `npm run db:migrate` سپس `npm run db:verify`).

## ۵) مرز داده در پورتال (لایه‌بندی)

| لایه | نقش |
|---|---|
| `middleware/customerScope.js` | ساخت `req.customerScopeId` فقط از توکن |
| `middleware/portalOwnership.js` | `requireOwnedRow` برای `flockGroupId`/`flockId` (غیرخودی ⇒ ۴۰۴) و `requireOwnScope` برای نوشتن‌های «پروندهٔ خودم» |
| `services/portalOwnershipRules.js` | تصمیم خالص مالکیت + کد/پیام/وضعیت هر رد (بدون دیتابیس، تست‌پذیر) |
| `services/portalProfileRules.js` | فهرست سفید، نرمال‌سازی، اعتبارسنجی، `changedFields` (بدون I/O) |

`GET /api/portal/profile` شمارهٔ موبایل را **ماسک‌شده** برمی‌گرداند
(`0912***4567`) و هیچ ستون داخلی (`created_by`/`updated_by`/`sales_department`)
در خروجی نیست. پاسخ «ویرایش پروفایل» فهرست `changed` را هم می‌دهد تا UI بتواند
دقیقاً بگوید چه چیزی ذخیره شد.

## ۶) فرانت‌اند

| فایل | نقش |
|---|---|
| `pages/portal.html` | دو تب تازه (`profile`/`dashboard`)، پنل‌ها و شناسه‌های `portalProfile*`/`portalDashboard*` — **بدون هیچ `<form>`** |
| `features/portal/portal.extra.js` (تازه) | mixin روی `PortalService`: بارگذاری/ویرایش پروفایل، دو مرحلهٔ موبایل، داشبورد و خروجی CSV |
| `features/portal/portal.api.js` | ۷ اندپوینت تازه + آینهٔ فهرست سفید (`PROFILE_EDITABLE_FIELDS`) و `profilePatch()` |
| `features/portal/portal.renderer.js` | `renderProfileCard/Editor`، `renderMobileChangePanel`، `renderDashboard*`، `renderStandardsChart`، `buildDashboardCsv` — همه SVG دست‌ساز، صفر کتابخانهٔ تازه |
| `features/portal/portal.service.js` | `ALL_TAB_KEYS`/`tabConf()` و اتصال mixin؛ تب تازه هم مثل بقیه پنهان/فعال می‌شود |
| `features/portal/portal.css` | `.portal-btn`, `.portal-field*`, `.portal-form-grid`, `.portal-table`, `.portal-dash__*` |

🔒 گاردهای قدیمی دست‌نخورده مانده‌اند: صفحهٔ پورتال هنوز **هیچ فرم HTML** و
**هیچ دکمهٔ ارسالِ فرمی** ندارد (ویرایش با دکمهٔ `type="button"` و
`data-profile-*` انجام می‌شود) و `portalService` هیچ نوشتنی ندارد؛ تنها لایهٔ
نوشتار `portal.api.js` است با **دقیقاً سه فراخوانی**.

## ۷) دسترسی‌ها (۱۲ کلید تازه: ۱۷۶ ⇒ ۱۸۸)

```
customer.portal.profile
customer.portal.profile.edit
customer.portal.dashboard
customer.portal.dashboard.analysis
customer.portal.dashboard.compare
customer.portal.dashboard.export
customer.portal.chart.weight
customer.portal.chart.gain
customer.portal.chart.mortality
customer.portal.chart.feed
customer.portal.chart.fcr
customer.portal.chart.standards
```

- همه در گروه `portal` با پیش‌فرض «فقط مشتری» و **بی‌قفل** (مدیر می‌تواند ببندد).
- `customer.portal.chart.*` علاوه بر گیت UI، در پاسخ `options.charts` هم
  برمی‌گردد؛ نمودارِ بسته اصلاً رندر نمی‌شود.
- `customer.portal.dashboard.export` دکمهٔ «خروجی CSV» را کنترل می‌کند
  (خروجی کلاینتی از همان دادهٔ صفحه ساخته می‌شود؛ هیچ فایلی در سرور ساخته
  نمی‌شود).

## ۸) تست‌ها

| دستور | پوشش |
|---|---|
| `Frontend › npm run test:customer-portal` | گاردهای ۱۳.۲–۱۳.۵ + بخش **۱۳)** با بررسی‌های تازهٔ ۱۳.۸ |
| `Backend › npm run test:permissions` | شمارش ۱۸۸ کلید + زنجیره‌های مجوز مسیرها |
| `Backend › npm run db:verify` | ستون `payload` روی `login_challenges` و ۴۶ جدول |

بررسی‌های تازهٔ ۱۳.۸ (خلاصه):

1. فهرست سفید ۱۵ فیلد و «موبایل/نوع مشتری قفل»؛
2. `validateProfilePatch` کلید ناشناخته را نادیده می‌گیرد و `mobileAttempted` را گزارش می‌کند؛
3. قانون موبایل (۱۱ رقم، شروع ۰۹، تفاوت با شمارهٔ فعلی)؛
4. مالکیت ردیف: غیرخودی ⇒ ۴۰۴، شناسهٔ بد ⇒ ۴۰۰، بدون اسکوپ ⇒ ۴۰۳؛
5. کنترلر: `validateProfilePatch` + `changedFields` + `updated_by` و **بدون** اعمال فیلدهای قفل؛
6. داشبورد: تحمیل `customerId` از توکن و حذف مقدار کلاینت؛
7. مسیرها: زنجیرهٔ مجوز + `portalWriteLimiter`×۳ + `otpLimiter`×۲ + مالکیت گله؛
8. `api.const`؛ ۹) هم‌اندازه‌بودن فهرست سفید کلاینت و سرور؛ ۱۰) HTML دو تب؛
11. رندرر (بدون فرم)؛ 12) سرویس (`ALL_TAB_KEYS`/`tabConf`)؛ 13) mixin؛
14. استایل؛ 15) مستندات همین فایل.

## ۹) PWA — نصب‌پذیری (زیرساخت ۱۳.۸)

| فایل | نقش |
|---|---|
| `Frontend/src/public/manifest.webmanifest` | نام/شورت‌نیم فارسی، `start_url=/portal`، `scope=/`، `display=standalone`، `dir=rtl`، دو میان‌بر (پروفایل/داشبورد) |
| `Frontend/src/public/sw.js` | service worker **عبوری**: نصب/فعال‌سازی فوری، **هیچ کشی** |
| `Frontend/server.js` | سرو `/manifest.webmanifest` (با `application/manifest+json`) و `/sw.js` (با `Service-Worker-Allowed: /`) از ریشه |
| `Frontend/src/pages/portal.html` | `<link rel="manifest">`، `theme-color`، `apple-mobile-web-app-*` و ثبت بی‌صدای service worker |

🔒 چرا service worker کش نمی‌کند؟ پورتال دادهٔ پروندهٔ مشتری است؛ کش‌شدن HTML
یا پاسخ API یعنی دیدن دادهٔ قدیمی (یا دادهٔ کاربر قبلی روی دستگاه مشترک). پس
`caches.put`/`addAll`/`respondWith` عمداً وجود ندارد و گارد تست هم همین را
می‌سنجد. «کش آفلاین دارایی‌های ثابت» کار موج بعدی است.

## ۱۰) آنچه در این موج انجام نشد (آگاهانه)

| مورد | دلیل |
|---|---|
| پیشنهاد تغییر توسط مشتری با صف تأیید | تصمیم کارفرما: تغییر «بی‌درنگ فعال» باشد |
| پیوند خودکار مشتری تکراری در ثبت‌نام | در ۱۳.۷.۳ هم رد شد؛ پروندهٔ تکراری با `auto_approve_error` در صف می‌ماند |
| آپلود عکس/مدارک از پورتال | مسیر نوشتنِ فایل نیاز به اسکن و سهمیهٔ جدا دارد — موج بعدی |
| کش آفلاین دارایی‌های ثابت (PWA) | نیاز به نسخه‌بندی و استراتژی cache-first دارد؛ عمداً به موج بعدی موکول شد |

## ۱۱) بررسی سریع

```bash
# بک‌اند
cd Backend && npm run db:migrate && npm run db:verify && node permissions-test.mjs

# فرانت + گاردهای سربه‌سر
cd ../Frontend && npm run test:customer-portal && npm run test:registration

# گیت کامل
cd .. && node tools/gate.mjs
```
