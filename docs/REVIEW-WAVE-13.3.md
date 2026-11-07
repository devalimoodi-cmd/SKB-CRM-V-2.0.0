# گزارش موج ۱۳.۳ — دادهٔ کامل پورتال + مقصد ورود مشتری

> زیرفاز ۱۳.۳ پورتالِ فقط‌خواندنیِ ۱۳.۲ را «کاربردی» می‌کند:
> چهار فهرست صفحه‌بندی‌شدهٔ تازه زیر `/api/portal`، مقصد ورود مشتری
> از `/customer-info` (با شناسه در URL) به `/portal`، و تب‌های داده
> در صفحهٔ پورتال.
>
> 🔒 قیدِ محوریِ این موج (همان قید ۱۳.۲):
> **هیچ‌یک از ۳۰ فایل مسیر موجود باز نشد**، **هیچ مایگریشنی** اجرا نشد،
> **هیچ کلید مجوزی** اضافه/تغییر نکرد (کاتالوگ روی **۱۶۸ کلید / ۱۷ گروه**)
> و **صفر** عملیات نوشتنی به پورتال اضافه شد.

## ۱) چرا این موج لازم بود

| ریسک | اثر واقعی پیش از ۱۳.۳ |
|---|---|
| `landingForRole` برای مشتری `/customer-info?id=<id>` می‌داد | شناسهٔ پرونده در **URL** بود (قابل دستکاری/اشتراک) و صفحهٔ مقصد در واقع یک صفحهٔ کارکنان با گیت مجوز بسته بود |
| پورتال فقط «۳ ردیف آخر» را نشان می‌داد | مشتری دادهٔ واقعی و کامل نداشت |
| `enforceSelfCustomer` شناسه را فقط وقتی تزریق می‌کرد که کلاینت فرستاده باشد | اگر مسیری «لیست» باز می‌شد، مشتریِ بدون پارامتر **دادهٔ همهٔ مشتریان** را می‌گرفت (باگ خفته) |
| رد دسترسی، همه را به `/index.html` برمی‌گرداند | مشتری در داشبوردِ بسته گیر می‌کرد (حلقهٔ نیمه‌خراب) |

## ۲) تصمیم‌های قفل‌شده

| تصمیم | مقدار | چرا |
|---|---|---|
| اندپوینت‌های تازه | **۴** (`/api/portal/{halls,flocks,weeks,visits}`) | باز کردن GETهای موجود، بدون روشن‌کردن `weekly.view`/`visit.view` برای مشتری **ممکن نبود** |
| پارامتر مجاز از کلاینت | فقط `page` و `limit` (سقف **۵۰**) | `parsePagination` در `Backend/utils/pagination.js` |
| منبع شناسه | `req.customerScopeId` (از `users.customer_id` توکن) | هیچ `customer_id` ای از query/body/params خوانده نمی‌شود |
| فیلدهای حساس | متن گزارش، مسیر فایل، نام کارشناس، کد ملی، کد پستی، آدرس، شمارهٔ پیام‌رسان **بیرون نمی‌روند** | متن گزارش/پیوست در ۱۳.۴ با کلید مجوز جدا |
| نام سالن در هفته‌ها | کوئری دومِ **اسکوپ‌شده** روی `Hall` (نه `include`) | هیچ ستون ناخواسته‌ای از سالن نشت نمی‌کند |
| کلید مجوز | فقط `customer.portal.view` (بدون کلید تازه) | کلیدهای ریز سطری به ۱۳.۵ (کنسول مجوز) موکول شد |
| مقصد مشتری | `"/portal"` — برای حساب متصل و **بدون پرونده** | پیام «حساب متصل نشده» را خود پورتال نشان می‌دهد |
| میان‌افزار `enforceSelfCustomer` | «تزریق اجباری» شناسه در `query`/`body` | بستن باگ خفتهٔ «فیلتر نبودن» برای آینده |

## ۳) قرارداد API (همه GET، همه پشت زنجیرهٔ مشترک)

```
protect → authorize("customer") → requirePermission("customer.portal.view") → requireCustomerLink → controller

GET /api/portal/me         خلاصه: شمارنده‌ها + ۳ ردیف آخر
GET /api/portal/halls      { items: [{ id, hall_name, hall_number, nominal_capacity, is_active }] }
GET /api/portal/flocks     { items: [{ id, flock_number, placement_date, status, ended_at }] }
GET /api/portal/weeks      { items: [{ id, week_number, week_start_date, week_end_date,
                                       flock_age_days, weekly_weight, weekly_mortality,
                                       weekly_feed_intake, hall_name }] }
GET /api/portal/visits     { items: [{ id, visit_date, status }] }   ← بدون متن گزارش/پیوست
```

```jsonc
// پاسخ همهٔ فهرست‌ها
{
  "success": true,
  "data": {
    "items": [ /* … */ ],
    "pagination": { "page": 1, "limit": 20, "total": 37, "pages": 2 },
    "meta": { "scope": "self", "generated_at": "…" }
  }
}
```

```
?page=abc      → page = 1
?limit=999     → limit = 50  (سقف)
?customer_id=9 → نادیده گرفته می‌شود (منبع شناسه فقط توکن است)
```

## ۴) تغییرات فایل‌به‌فایل

### بک‌اند
| فایل | تغییر |
|---|---|
| `middleware/customerScope.js` | `enforceSelfCustomer` شناسهٔ تأییدشده را **همیشه** در `req.query[key]`/`req.body[key]` می‌نویسد (حتی بدون پارامتر کلاینت) |
| `controllers/portalController.js` | ۴ کنترلر تازه + `paging()`/`pagedPayload()` + نگاشت امن `hallView`/`weekDetailView` |
| `routes/portalRoutes.js` | `customerChain` مشترک + ۴ مسیر GET تازه (بدون هیچ `:id`) |
| `controllers/loginOtpController.js` | `landingForRole` برای مشتری **همیشه** `"/portal"` (امضا `(role, user)` حفظ شد) |
| `config/permissions.js` | **بدون تغییر** (۱۶۸ کلید / ۱۷ گروه) |

### فرانت‌اند
| فایل | تغییر |
|---|---|
| `core/constants/api.const.js` | `PORTAL.HALLS/FLOCKS/WEEKS/VISITS` |
| `features/portal/portal.api.js` | ۴ متد + `pageParams()` (فقط صفحه/سقف ۵۰، بدون شناسه) |
| `features/portal/portal.renderer.js` | `renderHallList`/`renderFlockList`/`renderWeekList`/`renderVisitList`/`renderPager` (همه با `escapeHtml`) |
| `features/portal/portal.service.js` | `SECTION_CONF`، تب‌بندی، بارگذاری تنبل، «نمایش بیشتر»، خطای مستقل هر تب، بستن تب‌ها در حالت `unlinked` |
| `pages/portal.html` | نوار تب + چهار پنل (`portalHallsList` … `portalVisitsPager`) |
| `features/portal/portal.css` | استایل تب/پنل/«نمایش بیشتر» |
| `core/services/app.service.js` | `isCustomerSession()` + `afterDenyLanding()` ⇒ بازگشتِ ردِ دسترسی برای مشتری `"/portal"` (رفع حلقهٔ داشبورد) |
| `core/services/auth.service.js` | دو ریدایرکت نقش مشتری از صفحات کارکنان به `"/portal"` |

### گاردها و مستندات
| فایل | تغییر |
|---|---|
| `Frontend/customer-portal-guard-test.mjs` | بخش «۱۰» تازه + ۳ بررسی به‌روزشده + اجرای واقعی «تزریق اجباری» |
| `Frontend/user-customer-guard-test.mjs` | سه بررسی لندینگ مشتری به `"/portal"` |
| `Frontend/login-otp-guard-test.mjs` | بررسی مقصد نقش‌ها به `"/portal"` |
| `docs/REVIEW-WAVE-13.3.md` | همین سند |

## ۵) آنچه عمداً **انجام نشد**

- ❌ باز کردن `weeklyRoutes` / `visitReportRoutes` / `customerHeaderRoutes` برای نقش مشتری
  (نیازمند روشن‌کردن `weekly.view`/`visit.view` برای مشتری ⇒ بازشدن ۲۰ مسیر).
- ❌ کلیدهای مجوز ریز (`customer.portal.weeks` …) — به ۱۳.۵ موکول شد.
- ❌ نمایش متن گزارش بازدید، پیوست‌ها و نام کارشناس — به ۱۳.۴ موکول شد.
- ❌ هرگونه مسیر نوشتنی (POST/PUT/PATCH/DELETE) در پورتال.
- ❌ هرگونه مایگریشن یا تغییر شِما.

## ۶) اعتبارسنجی

```powershell
# Frontend
npm run test:customer-portal
npm run test:user-customer
npm run test:login-otp
npm run test:permissions
npm run test:frontend-server
npm run test:cache
npm run lint

# Backend
npm run test:permissions
npm run db:verify
npm run lint

# گیت کامل
node tools/gate.mjs
```

### تست دودی زنده (خلاصهٔ نتیجه)
| سناریو | انتظار |
|---|---|
| توکن مشتری متصل ⇒ ۴ اندپوینت | ۲۰۰ و **فقط** ردیف‌های همان `customer_id` |
| `?limit=999` | `limit = 50` |
| `?page=abc` | `page = 1` |
| مشتری بدون پروندهٔ متصل | ۴۰۳ `CUSTOMER_LINK_MISSING` (هر چهار مسیر) |
| توکن کارمند | ۴۰۳ (`authorize`) |
| بدون توکن | ۴۰۱ |
| کاربر تستی پس از اجرا | حذف شد (۰ باقی‌مانده) |

## ۷) گام بعدی (۱۳.۴)

- متن گزارش بازدید + پیوست‌ها با کلید مجوز جدا (`customer.portal.visit.report`).
- جزئیات هفته (بیماری/واکسن/دارو/دان) با اسکوپ و فقط خواندنی.
- جمع‌بندی نموداری در پورتال (بدون کتابخانهٔ تازه).

## ۸) قیدهای موج‌های قبل که دست‌نخورده می‌مانند

| موج | قید | وضعیت در ۱۳.۳ |
|---|---|---|
| ۱۳.۰ | `users.customer_id` (مایگریشن) + `landingForRole` | مایگریشن دست‌نخورده؛ `landingForRole` فقط مقصد مشتری را عوض کرد (امضا ثابت) |
| ۱۳.۱ | ورود دومرحله‌ای OTP | دست‌نخورده |
| ۱۳.۲ | `/api/portal/me` + `customer.portal.view` + اسکوپ سمت سرور | گسترش یافت، نه تغییر |
| ۱۲.۵ | کاتالوگ ۱۶۸ کلید / ۱۷ گروه | بدون تغییر |
| گاردها | `test:customer-portal`, `test:user-customer`, `test:login-otp` | به‌روزرسانی شدند و در گیت هستند |

