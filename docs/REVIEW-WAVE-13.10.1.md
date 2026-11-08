# موج ۱۳.۱۰.۱ — رفع ۵۰۰ داشبورد پورتال + انتخاب خودکار آخرین گله

**تاریخ:** ۱۴۰۵/۰۸/۱۷ · **نوع:** هات‌فیکس (بدون مایگریشن، بدون تغییر کاتالوگ مجوز)

---

## ۱) علامت مشکل

در پورتال مشتری، تب «داشبورد تحلیلی» هیچ نموداری نشان نمی‌داد و کنسول شبکه دو خطای
۵۰۰ داشت:

| اندپوینت | وضعیت |
|---|---|
| `GET /api/portal/dashboard/options` | ۲۰۰ (سالم) |
| `GET /api/portal/dashboard/summary` | ۲۰۰ (سالم) |
| `GET /api/portal/dashboard/charts` | ❌ ۵۰۰ `خطا در دریافت دادهٔ نمودارها` |
| `GET /api/portal/dashboard/analysis` | ❌ ۵۰۰ `خطا در دریافت تحلیل‌ها` |

## ۲) ریشهٔ باگ (Express 5: `req.query` فقط getter است)

پروژه روی **Express 5** است. در `node_modules/express/lib/request.js`، `query` به‌صورت
**getter-only** تعریف می‌شود و هر بار از `req.url` از نو پارس می‌شود (بدون setter).
کنترلر پورتال (موج ۱۳.۸) برای «تحمیل اسکوپ» این کار را می‌کرد:

```js
req.query = forcedQuery(req);                 // ❌ TypeError در حالت strict
return await dashboardController.getChartsData(req, res);
```

و چون فایل `"use strict"` است، انتساب به property بدون setter **TypeError** می‌دهد.
`catch` همان کنترلر هم پیام ۵۰۰ را برمی‌گرداند. یعنی منطق نمودارها سالم بود و فقط
«مرزِ درخواست» شکسته بود؛ به همین دلیل پنل کارشناس (که `req.query` را دست نمی‌زند)
درست کار می‌کرد.

✅ **اثبات:** همان دو تابع با یک «درخواست پروکسی» که `query` واقعی دارد صدا زده شدند و
هر دو `200` برگرداندند.

## ۳) یافتهٔ دوم — بمب ساعتی در `middleware/customerScope.js`

«تزریق اجباری شناسهٔ مشتری» (فاز ۱۳.۳) این‌گونه نوشته شده بود:

```js
if (!req.query) req.query = {};      // هرگز اجرا نمی‌شود (getter همیشه truthy)
req.query[key] = String(result.id);  // روی آبجکتِ دورریز می‌نویسد ⇒ بی‌اثر
```

یعنی محافظتی که کامنتِ کد تضمینش می‌دانست، در Express 5 **واقعاً اعمال نمی‌شد**.
خوشبختانه امروز هیچ مسیری از `enforceSelfCustomer`/`allowCustomerRead` با
`source: "query"` استفاده نمی‌کند؛ ولی اگر موجی در آینده آن را روی یک GET می‌گذاشت،
«امنیت ظاهری» بود. الان با `Object.defineProperty` جایگزین شده و گارد بخش ۱۶ آن را می‌سنجد.

## ۴) راه‌حل — پروکسی درخواست، بدون دست‌زدن به `req`

`Backend/services/portalDashboardScope.js` (خالص، بدون DB/HTTP):

```js
const forcedQuery = (req) => { /* فهرست سفید + customerId تحمیلی */ };

const scopedRequest = (req) => {
  const proxy = Object.create(req || null);          // همه‌چیز به ارث می‌رسد
  Object.defineProperty(proxy, "query", {
    value: forcedQuery(req), writable: true, enumerable: true, configurable: true,
  });
  return proxy;
};
```

- `req` اصلی **دست‌نخورده** می‌ماند ⇒ هیچ `TypeError`ی نیست.
- منطق سنگین `dashboardController` بدون تغییر واگذار می‌شود (تک‌منبعِ حقیقتِ محاسبه).
- **فهرست سفید کوئری:** فقط `flockId` · `flockGroupId` · `scope="all"` از کلاینت عبور می‌کند؛
  هر `customer_id`/`customerId` و هر پارامتر ناشناخته (حتی `?flockId[]=`) دور ریخته می‌شود.
- `customerId` **همیشه** از `req.customerScopeId` (توکن) تحمیل می‌شود.

## ۵) انتخاب خودکار «آخرین گله» (تا گلهٔ بسته هم نمودار داشته باشد)

`dashboardController.getChartsData` در حالت «بدون شناسهٔ گله» فقط جوجه‌ریزی‌های
`is_active = true` را می‌آورد؛ پس مشتری‌ای که گله‌اش را بسته بود، پیام
«داده‌ای برای نمایش وجود ندارد» می‌دید.

- `GET /portal/dashboard/options` فهرست گله‌ها را با `placement_date DESC, id DESC`
  می‌فرستد ⇒ `options.flocks[0]` **آخرین دوره** است (فعال یا بسته).
- `portal.extra.js` متد `applyDefaultDashboardSelection()` را **پیش از** رندر فهرست
  صدا می‌زند؛ اگر کاربر خودش انتخاب نکرده باشد (`dashboardUserPicked === false`)،
  همان گله انتخاب و در `<select>` هم نمایش داده می‌شود.
- شاخهٔ `flockGroupId` در سرور برای گلهٔ **پایان‌یافته** هم از همهٔ سالن‌های همان دوره
  استفاده می‌کند ⇒ نمودار وزن/تلفات/دان پر می‌شود.
- انتخاب دستی کاربر (از جمله «همهٔ گله‌های من») با پرچم `dashboardUserPicked` محفوظ است.
- نمودار «استاندارد نژاد» با `scope=all` درخواست می‌شود تا دوره‌های بسته هم بیایند
  (کلاینت تنها مقدار مجاز `"all"` را می‌فرستد؛ `customerId` همچنان از توکن است).


## ۶) فایل‌های تغییریافته

### بک‌اند (۳)

| فایل | تغییر |
|---|---|
| `Backend/services/portalDashboardScope.js` | **جدید** — `forcedQuery` + `scopedRequest` + `scopeIdOf` (خالص) |
| `Backend/controllers/portalDashboardController.js` | حذف `req.query = …`؛ واگذاری با `scopedRequest(req)`؛ `scopeIdOf` از سرویس |
| `Backend/middleware/customerScope.js` | تزریق اسکوپ با `Object.defineProperty` (نه انتساب) |

### فرانت‌اند (۲)

| فایل | تغییر |
|---|---|
| `Frontend/src/features/portal/portal.extra.js` | `applyDefaultDashboardSelection()` + `dashboardUserPicked` + `scope: "all"` برای تحلیل |
| `Frontend/src/features/portal/portal.api.js` | `getDashboardAnalysis({ scope })` با فهرست سفید `"all"` |

### تست و مستندات (۳)

| فایل | تغییر |
|---|---|
| `Frontend/customer-portal-guard-test.mjs` | بخش **۱۶** (۸ بررسی؛ ۲ مورد **اجرایی** روی درخواست شبیه‌سازی‌شدهٔ Express 5) |
| `Backend/README.md` | قاعدهٔ دوم: هرگز به `req.query`/`req.params` انتساب نده |
| `Frontend/README.md` + همین سند | به‌روزرسانی جدول پورتال و گزارش موج |

## ۷) گارد تست — بخش ۱۶ (۸ بررسی)

1. اسکن **کل** `Backend/{controllers,middleware,routes,services}` ⇒ صفر مورد `req.query =` / `req.params =` (پس از حذف کامنت‌ها).
2. شبیه‌سازی Express 5: انتساب به `query` واقعاً `TypeError` می‌دهد (اثبات اینکه تست همان باگ را مدل می‌کند).
3. `forcedQuery`: `customerId` تحمیلی + دور ریختن `customer_id`/`evil`/`flockId[]` (اجرایی).
4. `scopedRequest`: بدون TypeError، وراثت `method`/`customerScopeId`، و `req` اصلی تغییر نمی‌کند (اجرایی).
5. کنترلر پورتال: واگذاری با `scopedRequest` و صفر انتساب.
6. سرویس اسکوپ: فهرست سفید (`flockId`/`flockGroupId`/`all`) + `Object.create` + `defineProperty`.
7. `customerScope`: تزریق با `defineProperty` روی `query`.
8. فرانت: پیش‌فرض «آخرین گله» (+ ترتیب اجرا پیش از رندر) و `scope=all` با فهرست سفید کلاینتی.

> 💡 درسِ گارد: تست‌های **استاتیک** این باگ را نگرفته بودند چون `req.query = …` در متن
> کد «درست» به نظر می‌رسید. از این موج به بعد، الگوی خطرناک **اسکن می‌شود** و رفتار
> Express 5 با یک شیء شبیه‌سازی‌شده **اجرا** می‌شود.

## ۸) اجرا و اعتبارسنجی

```powershell
cd Backend;  node permissions-test.mjs               # ۱۹۱ کلید (بدون تغییر)
cd Frontend; node customer-portal-guard-test.mjs     # ۱۵۸ بررسی (بخش‌های ۱–۱۶)
cd Frontend; npm run lint
node tools/gate.mjs                                  # GATE-PASS
```

## ۹) آنچه انجام **نشد** (شفاف)

- ❌ هیچ مایگریشن/تغییر ساختار دیتابیس.
- ❌ هیچ کلید مجوز تازه (کاتالوگ همان ۱۹۱ می‌ماند) و هیچ نقشی عوض نشد.
- ❌ هیچ مسیر جدیدی باز نشد؛ قرارداد پاسخ `/dashboard/*` بدون تغییر است.
- ❌ نوشتن واحد/سالن/جوجه‌ریزی از پورتال همچنان ممکن **نیست** (موکول به موج ۱۳.۱۱،
  چون مسیرهای فعلی با `authorize(...)` نقش `customer` را رد می‌کنند).
