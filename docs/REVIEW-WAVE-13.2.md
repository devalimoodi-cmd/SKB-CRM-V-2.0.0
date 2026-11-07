# گزارش موج ۱۳.۲ — پورتال مشتری (فاز ۱۳.۲، گزینهٔ الف)

> زیرفاز ۱۳.۲ اولین «سطح تماس» واقعی برای نقش `customer` می‌سازد:
> یک صفحهٔ **فقط خواندنی** در `/portal` و **یک** اندپوینت تجمیعی
> `GET /api/portal/me` که همهٔ داده‌اش با **اسکوپ سمت سرور** فیلتر می‌شود.
>
> 🔒 قیدِ محوریِ این موج: **هیچ‌یک از ۳۰ فایل مسیر موجود باز نمی‌شود**
> و **هیچ مایگریشنی** اجرا نمی‌شود. نقش `customer` به هیچ GET موجودی
> اضافه نشد؛ فقط یک روتر تازه (`/api/portal`) با یک مسیر تازه.

## ۱) ریشهٔ مشکل (چرا این زیرفاز لازم بود)

| ریسک | اثر واقعی پیش از ۱۳.۲ |
|---|---|
| `protect` ستون `customer_id` را نمی‌خواند | `req.user.customer_id` هرگز وجود نداشت ⇒ هیچ اسکوپ سمت سروری **ممکن** نبود |
| شناسهٔ مشتری فقط در `localStorage`/`?id=` | مرزِ «دادهٔ خودم» یک ادعای کلاینتی بود؛ هر `?id=` پروندهٔ دیگری را باز می‌کرد |
| نقش `customer` در هیچ `authorize` نبود | مشتری پس از ورود، عملاً هیچ صفحهٔ کاربردی نداشت (`/customer-info` با خطاهای ۴۰۳) |
| کلیدهای موجود (halls/weekly/visit) برای مشتری `false` | روشن‌کردنشان برای پورتال، ۲۰ مسیر موجود را هم باز می‌کرد |

## ۲) تصمیم‌های قفل‌شده (گزینهٔ الف — «حداقل سطح تماس»)

| تصمیم | مقدار | چرا |
|---|---|---|
| تعداد اندپوینت تازه | **۱** (`GET /api/portal/me`) | هر اندپوینت تازه، سطح حملهٔ تازه است |
| شناسهٔ ورودی از کلاینت | **صفر** | کنترلر `req.query`/`req.body`/`req.params` را نمی‌خواند |
| منبع شناسه | `req.user.customer_id` → `req.customerScopeId` | توکن، تنها منبع قابل‌اعتماد است |
| کلید مجوز | `customer.portal.view` (پیش‌فرض **فقط مشتری**) | کلید جدا تا مسیرهای موجود باز نشوند |
| مایگریشن | **ندارد** | `users.customer_id` در ۱۳.۰ ساخته شد و `ON DELETE SET NULL` دارد |
| نوشتن در پورتال | **ممنوع** | صفحه هیچ فرم/دکمهٔ ثبت/ویرایش/حذف ندارد |
| نقش‌های کارکنان | **بی‌تغییر** | `authorize("customer")` ⇒ کارکنان ۴۰۳ می‌گیرند، نه دسترسی |

## ۳) قرارداد API

```
GET /api/portal/me          (Authorization: Bearer <token>)
   ├─ بدون توکن                      → 401
   ├─ نقش غیرمشتری (admin/expert …)  → 403  (authorize)
   ├─ customer.portal.view بسته      → 403  (requirePermission، فقط در حالت enforce)
   ├─ مشتری متصل‌نشده                → 403  CUSTOMER_LINK_MISSING
   └─ مشتری متصل                     → 200  خلاصهٔ پروندهٔ خودش
```

```jsonc
{
  "success": true,
  "message": "خلاصهٔ پورتال مشتری",
  "data": {
    "customer": { "id": 12, "customer_code": 1042, "full_name": "…",
                  "farm_name": "…", "province": "…", "county": "…",
                  "mobile_number": "…", "active": true, "status": "active" },
    "link":     { "linked": true, "user_id": 7, "customer_id": 12 },
    "counters": { "halls": 4, "active_halls": 3, "active_flocks": 2,
                  "weeks_recorded": 18, "unread_visits": 1 },
    "latest":   { "flocks": [ "۳ ردیف" ], "weeks": [ "۳ ردیف" ], "visits": [ "۳ ردیف" ] },
    "meta":     { "scope": "self", "generated_at": "…" }
  }
}
```

⚠️ فیلدهای حساس (`national_code`, `postal_code`, `farm_address`,
`messaging_number`, `email`) عمداً در خروجی **نیستند** و گارد ایستا
این را می‌سنجد.

## ۴) لایه‌های امنیتی که این موج اضافه کرد

| لایه | فایل | کار |
|---|---|---|
| خواندن `customer_id` در احراز هویت | `Backend/middleware/auth.js` | `attributes` + `req.user.customer_id` |
| قانون خالص اسکوپ | `Backend/services/customerScopeRules.js` | `resolveScopeCustomerId()` — بدون I/O، قابل اجرا در تست |
| میان‌افزار اسکوپ | `Backend/middleware/customerScope.js` | `requireCustomerLink` · `enforceSelfCustomer` · `attachCustomerScope` · `allowCustomerRead` |
| کنترلر تجمیعی | `Backend/controllers/portalController.js` | ۵ مدل، همه با `where: { customer_id: customerId }` |
| روتر | `Backend/routes/portalRoutes.js` | `protect → authorize("customer") → requirePermission → requireCustomerLink → controller` |
| کاتالوگ | `Backend/config/permissions.js` | `D.customerOnly` + گروه «پورتال مشتری» (۱۶۸ کلید / ۱۷ گروه) |

### جدول حمله/دفاع

| حمله | دفاع |
|---|---|
| مشتری: `?id=۱۳` یا تغییر `localStorage.customerId` | شناسهٔ کلاینت **خوانده نمی‌شود**؛ مقدار از توکن می‌آید |
| مشتری: درخواست مستقیم به `/api/portal/me` برای دیگری | هیچ پارامتری برای «دیگری» وجود ندارد |
| مشتری: تزریق `?id=abc` | `normalizeCustomerId` ⇒ `bad_id` ⇒ ۴۰۳ |
| حساب مشتری بدون پرونده (پیوند فراموش‌شده) | ۴۰۳ با کد ماشین‌خوان `CUSTOMER_LINK_MISSING` + پیام روشن |
| کارمند/ادمین: کنجکاوی روی پروندهٔ یک مشتری | `authorize("customer")` ⇒ ۴۰۳ (پورتال فقط برای مشتری است) |
| مشتریِ فاقد کلید (مدیر آن را بسته) | `requirePermission` (در enforce) + صفحهٔ فرانت گیت‌شده ⇒ ریدایرکت با پیام |
| XSS از نام مزرعه/نام مشتری | تمام متن‌ها از `escapeHtml` عبور می‌کنند (گارد: ≥۸ فراخوانی) |
| «پورتال به‌عنوان درِ پشتی نوشتن» | مسیر `POST/PUT/PATCH/DELETE` ندارد؛ رندرر `<form>`/`submit` تولید نمی‌کند |

## ۵) چیزهایی که عمداً **انجام نشد** (و چرا)

1. **بازکردن GETهای موجود** (`/api/halls`, `/api/weekly`, `/api/visit-reports`):
   هر کدام باید فیلتر `customer_id` می‌گرفتند، وابستگی‌های `include`/`unit_id`
   داشتند و ریسک نشت بالایی می‌گذاشتند. ⇒ به موج بعد موکول شد
   (`allowCustomerRead` همین الان آماده است).
2. **نوشتن از پورتال** (ویرایش اطلاعات، حذف، ثبت درخواست): نیازمند
   اعتبارسنجی و ثبت فعالیت جداست.
3. **تغییر `landingForRole`** و هدایت مشتری به `/portal`: برای پرهیز از
   بازنویسی گارد ۱۳.۰ عمداً دست‌نخورده ماند (بازگشت مشتری فعلاً `/customer-info` است).
4. **مایگریشن / seed**: کلید تازه از پیش‌فرض کاتالوگ می‌آید؛ `db:verify` بی‌تغییر است.

## ۶) تغییر یک رفتار قدیمی (در جهت بستنِ حفره)

`app.service.js` پیش‌تر **همهٔ** صفحات را برای نقش مشتری از گیت مجوز
معاف می‌کرد. از ۱۳.۲ این استثنا به `isCustomerExemptPage()` تبدیل شد:

* معاف: `/customer-info` (و صفحهٔ مقصد، ضدحلقه)
* گیت‌دار: `/portal` (تا بستن `customer.portal.view` واقعاً کار کند)،
  `/customers`، `/admin` …

⇒ اثر جانبی مطلوب: مشتری دیگر با آدرس دستی به صفحه‌های کارکنان نمی‌رسد.

## ۷) آزمون‌ها

```
npm run test:customer-portal     → گارد جدید (۴۰+ بررسی؛ دو بخش اجرای واقعی)
npm run test:user-customer       → ۴۱/۴۱ (بدون تغییر)
npm run test:login-otp           → بدون تغییر
npm run test:cache               → یک بررسی به‌روزرسانی شد (isCustomerExemptPage)
npm run test:permissions (Backend) → شمارش ۱۶۸ کلید / ۱۷ گروه
node tools/gate.mjs              → GATE-PASS
```

نکتهٔ مهم: بخش‌های ۲ و ۳ گارد، **منطق واقعی** را اجرا می‌کنند
(`customerScopeRules` و `customerScope`) و ۱۵ سناریو را بدون دیتابیس می‌سنجند؛
بقیهٔ بررسی‌ها ایستا هستند (ساختار مسیر، کاتالوگ، فرانت، ابزارها).

## ۸) فایل‌های این موج

**بک‌اند**

| فایل | نوع |
|---|---|
| `Backend/middleware/auth.js` | تغییر (خواندن `customer_id`) |
| `Backend/services/customerScopeRules.js` | 🆕 منطق خالص |
| `Backend/middleware/customerScope.js` | 🆕 میان‌افزار |
| `Backend/controllers/portalController.js` | 🆕 کنترلر |
| `Backend/routes/portalRoutes.js` | 🆕 روتر |
| `Backend/config/permissions.js` | تغییر (کلید + گروه) |
| `Backend/permissions-test.mjs` | تغییر (شمارش) |
| `Backend/server.js` | تغییر (mount) |

**فرانت‌اند**

| فایل | نوع |
|---|---|
| `Frontend/src/pages/portal.html` | 🆕 صفحه |
| `Frontend/src/features/portal/{portal.api,portal.renderer,portal.service}.js` | 🆕 |
| `Frontend/src/features/portal/portal.css` | 🆕 |
| `Frontend/src/core/constants/api.const.js` | تغییر (`PORTAL.ME`) |
| `Frontend/src/core/services/app.service.js` | تغییر (صفحه + استثنای دقیق) |
| `Frontend/src/features/customer-info/customer-info.service.js` | تغییر (اولویت پروندهٔ حساب برای مشتری) |
| `Frontend/server.js` | تغییر (مسیر `/portal` + لودر) |

**گارد و ابزار:** `Frontend/customer-portal-guard-test.mjs` 🆕 ·
`Frontend/package.json` · `Frontend/frontend-server-test.mjs` ·
`tools/gate.mjs` · `tools/gate.ps1`

## ۹) قدم بعدی پیشنهادی (۱۳.۳)

1. افزودن `...allowCustomerRead({ source: "query", key: "customerId" })` به
   GETهای **خواندنی** و کم‌ریسک: `weekly` و `visit-reports`.
2. در همان موج: `landingForRole` برای مشتری ⇒ `/portal` و نمایش
   «پروفایل کامل من» با لینک صریح.
3. سپس نوشتنِ کنترل‌شده (ثبت درخواست بازدید) با `activityLog` و گارد مستقل.

