# بازبینی موج ۱۳.۱۹ — «پایان دوره» و «گزارش نهایی دوره» در پورتال مشتری

> ادامهٔ مستقیم ۱۳.۱۷: آن موج ناوبری را ساخت و از سه بخش بی‌داده، دو تای آن
> را صادقانه «به‌زودی» گذاشت. ۱۳.۱۹ همان دو بخش را **واقعی** می‌کند:
> `#/hatchery/completion` و `#/reports/final` با **۲ اندپوینت GET**،
> **صفر مایگریشن**، **صفر نوشتن** و **صفر کتابخانهٔ تازه**.
> «ضدعفونی دوره» عمداً «به‌زودی» می‌ماند (دلیل در بخش ۵).

---

## ۱) مسئله

| # | شکاف | اثر |
|---|---|---|
| ۱ | مشتری نه فهرست دوره‌های بسته‌شده را می‌دید و نه شاخص نهایی | برای «ضریب تبدیل/زنده‌مانی دورهٔ قبل» باید به کارشناس زنگ می‌زد |
| ۲ | کارشناس عدد FCR/تلفات را در فرم پایان دوره ثبت می‌کند، ولی مشتری آن را نمی‌دید | اعتماد به گزارش با «دیدن همان عددی که ثبت شده» ساخته می‌شود |
| ۳ | ریز سالن‌ها (تلفات/خوراک/وزن هر سالن) فقط در پنل کارکنان بود | مقایسهٔ سالن‌ها برای مشتری ناممکن بود |
| ۴ | بدون نمودار روند، «بهبود یا افت» دوره دیده نمی‌شد | تصمیم مدیریتی بدون تصویر |
| ۵ | اگر گزارش با یک GET بزرگ می‌آمد، اقتصاد گله (سود/زیان) هم لو می‌رفت | نشت دادهٔ مالی به مرورگر مشتری |

---

## ۲) دامنه — چه چیزی ساخته شد

| مورد | مقدار |
|---|---|
| اندپوینت تازه | `GET /api/portal/completions` · `GET /api/portal/completions/:id` |
| مایگریشن | **هیچ** — از `flock_completions` + `flock_completion_halls` + هفته‌های همان جوجه‌ریزی‌ها |
| نوشتن | **هیچ** — هر دو مسیر GET و بدون سرویس نوشتن |
| کلید مجوز | ۲ کلید تازه (۲۲۵ ⇒ **۲۲۷** / همان ۱۸ گروه) |
| پنل | ۲ پنل واقعی (۱۲ ⇒ **۱۴**)، مسیرهای «به‌زودی» ۳ ⇒ **۱** |
| فایل تازهٔ بک‌اند | `services/portalCompletionView.js` (خالص) · `services/portalCompletionService.js` · `controllers/portalCompletionController.js` · `portal-completion-test.mjs` |
| فایل تازهٔ فرانت | — (همه در `portal.views.js` / `portal.menu.js` / `portal.api.js` / `portal.nav.css` / `portal.html`) |
| کتابخانهٔ تازه | **هیچ** — نمودار SVG دست‌ساز است |

---

## ۳) بک‌اند

### ۳.۱ مسیرها و زنجیرهٔ دسترسی

```js
const completionChain = tabChain("customer.portal.completion");

const completionReportChain = [
  ...completionChain,
  requirePermission("customer.portal.completion.report"),
  requireOwnedRow({ model: FlockCompletion, label: "پایان دوره" }),
];

router.get("/completions",     ...completionChain,       portalCompletionController.listMyCompletions);
router.get("/completions/:id", ...completionReportChain, portalCompletionController.getMyCompletion);
```

- **شناسهٔ پرونده فقط از توکن** (`req.customerScopeId`)؛ کنترلر هیچ فیلد
  `customer_id` از query/body نمی‌خواند.
- `:id` نامعتبر ⇒ ۴۰۰، ردیف مشتری دیگر ⇒ **۴۰۴** (وجود ردیف لو نمی‌رود)،
  و سرویس هم همان `where: { id, customer_id }` را تکرار می‌کند (دفاع دو لایه).
- صفحه‌بندی: `parsePagination(query, { defaultLimit: 20, maxLimit: 50 })` —
  بیشینه ۵۰ ردیف، فقط `page`/`limit`.

### ۳.۲ فهرست سفید — چرا این‌جا امنیت «منفی» است

`services/portalCompletionView.js` فقط کلیدهای اعلام‌شده را با `pick` می‌خواند:

| دسته | نمونه | وضعیت |
|---|---|---|
| جمعیت/شاخص | `initial_chicks_count`، `final_fcr`، `survival_percent`، `epi`، `adg_grams` | ✅ در خروجی |
| کشتار | `slaughter_date`، `slaughterhouse_name`، `total_live_weight` | ✅ فقط در گزارش تفصیلی |
| **اقتصاد گله** | `price_per_kg`، `income_total`، `chick_cost`، `total_cost`، `net_profit`، `profit_percent` | ⛔ حتی از DB خوانده نمی‌شود |
| داخلی | `notes`، `completed_by`، `customer_id` | ⛔ هیچ‌جا |

نکتهٔ مهم: این‌ها «در UI پنهان» نشده‌اند؛ در **فهرست `attributes` سکوئلایز**
هم نیستند ⇒ ممکن است روزی کسی کامپوننت را عوض کند و باز هم لو نرود.

### ۳.۳ موتور محاسبه — یک منبع، عدد قابل بازتولید

| خروجی | منبع |
|---|---|
| `totals` (جمع سالن‌ها، وزن میانگین وزنی، FCR گله) | `flockMetrics.aggregateFlock` |
| `weekly` (جمع خوراک/تلفات، آخرین وزن) | `flockMetrics.summarizeWeeks` |
| `trend` (سری هفتگی وزن/FCR تجمعی) | `flockMetrics.buildFlockTrend` |
| `stored` (عدد ثبت‌شدهٔ کارشناس) | همان ردیف `flock_completions` |

نمونهٔ قطعیِ آزمون (دو سالن، ۳ هفته، خوراک ۳۰٬۰۰۰ + ۵۷٬۰۰۰):

| شاخص | مقدار انتظاری |
|---|---|
| جوجهٔ اولیه / نهایی | ۳۰٬۰۰۰ / ۲۸٬۵۰۰ |
| تلفات / درصد | ۱٬۵۰۰ / ۵٪ (زنده‌مانی ۹۵٪) |
| وزن نهایی (میانگین وزنی) | ۲٫۰۶۷ کیلوگرم |
| FCR محاسبه‌شده | **۱٫۴۸** (ثبت‌شده: ۱٫۹ ⇒ هشدار اختلاف) |
| خوراک به‌ازای هر مرغ نهایی | ۳٫۰۵۳ کیلوگرم |
| هفته‌ها | ۶ ردیف (۲ سالن × ۳ هفته) |

### ۳.۴ هشدارهای صادقانه (`notices`)

گزارش هرگز «۰» یا «میانگین ساختگی» نشان نمی‌دهد؛ به‌جایش می‌گوید چرا:

| شرط | متن |
|---|---|
| ریز سالن خالی | «اعداد این صفحه فقط از ردیف کلی پایان دوره می‌آید» |
| هفته‌ای ثبت نشده | «روند وزن و ضریب تبدیل تجمعی محاسبه نمی‌شود» |
| `totals.fcr === null` | «وزن نهایی/جوجهٔ نهایی/خوراک لازم است» |
| اختلاف ≥ ۰٫۰۵ با عدد ثبت‌شده | «هر دو عدد نمایش داده می‌شود؛ تصمیم با کارشناس» |

### ۳.۵ کلیدهای مجوز

| کلید | نقش | پیش‌فرض |
|---|---|---|
| `customer.portal.completion` | فهرست + شاخص‌های هر دوره | فقط مشتری |
| `customer.portal.completion.report` | گزارش تفصیلی (سالن‌ها، روند، دارو/واکسن) | فقط مشتری |

`/api/portal/me` دو بخش تازه برمی‌گرداند: `sections.completion` و
`sections.finalReport` (دومی فقط اگر **هر دو** کلید باز باشد) و
`features.completion_report` برای گیت دکمهٔ پرش.

---

## ۴) فرانت‌اند

### ۴.۱ منو و مسیر

| مسیر | پنل | کلید منو | کلید محتوا |
|---|---|---|---|
| `#/hatchery/completion` | `completion` | `customer.portal.menu.hatchery.completion` | `customer.portal.completion` |
| `#/reports/final` | `finalReport` | `customer.portal.menu.reports.final` | `customer.portal.completion.report` |
| `#/hatchery/hygiene` | `soon` | `customer.portal.menu.hatchery.hygiene` | — (بدون داده) |

### ۴.۲ `VIEW_TABS` و نیاز به دو کلید

`canViewContent` یک قابلیت کوچک گرفت: اگر پنل `requiresAll` داشته باشد،
**همهٔ** کلیدها لازم است (رفتار بقیهٔ پنل‌ها دست‌نخورده):

```js
finalReport: {
  permission: "customer.portal.menu.reports.final",
  requiresAll: ["customer.portal.completion", "customer.portal.completion.report"],
  bodyId: "portalFinalBody",
  statusId: "portalFinalStatus",
}
```

### ۴.۳ جریان داده (بدون شناسهٔ آزاد)

```
#/hatchery/completion
  └─ GET /portal/completions            → کارت‌ها + meta.metrics (برچسب/یکا از سرور)
        └─ «گزارش نهایی این دوره» (فقط اگر completion.report باز باشد)
              └─ #/reports/final  → GET /portal/completions (انتخاب‌گر)
                                  → GET /portal/completions/:id  (rowId اعتبارسنجی)
```

- `openFinalReport(id)` ابتدا `goToRoute("#/reports/final")` می‌کند؛ اگر مسیر
  مجاز نبود (لایهٔ منو بسته) `activateTab("finalReport")` جایگزین می‌شود.
- اگر پنل از قبل بار شده باشد، همان انتخاب مستقیم بارگذاری می‌شود (بدون
  درخواست اضافی و بدون بارگذاری دوبارهٔ فهرست).
- «نمایش دوره‌های قدیمی‌تر» صفحهٔ بعد همان فهرست را append می‌کند.

### ۴.۴ نمودار و چاپ

| مورد | جزئیات |
|---|---|
| نمودار | SVG دست‌ساز (`renderTrendChart`): دو `polyline` — وزن (پررنگ) و FCR (خط‌چین)؛ با کمتر از ۲ هفته چیزی رسم نمی‌شود |
| جدول مقایسه | «محاسبه از هفته‌ها» در برابر «ثبت‌شده در پایان دوره» برای FCR/زنده‌مانی/تلفات/خوراک/وزن |
| ریز سالن‌ها | ستون‌ها از `meta.hall_metrics` (برچسب + یکا از سرور) |
| دارو/واکسن | «نام × تعداد» — شناسهٔ دارو/واکسن هرگز به مرورگر نمی‌رود |
| چاپ | `@media print` ناوبری/دکمه‌ها/ابزارها را حذف می‌کند تا گزارش یک‌صفحه‌ای چاپ شود |

---

## ۵) آنچه آگاهانه انجام نشد

| مورد | چرا |
|---|---|
| «ضدعفونی دوره» (`#/hatchery/hygiene`) | `hall_hygiene` فقط **وضعیت فعلی** هر سالن است، نه تاریخچه؛ ساختن نمودار تاریخچه یعنی جدول/ستون تازه (مایگریشن) و دادهٔ ساختگی. متن پنل هم بازنویسی شد تا همین را صادقانه بگوید و مشتری را به «مزرعهٔ من → بهداشت» بفرستد |
| اقتصاد گله (سود/زیان) | تصمیم مالی با کارشناس است؛ نمایش عدد خام بدون بافت، گمراه‌کننده و پرخطر است |
| `notes` پایان دوره | یادداشت داخلی کارشناس است (همان قاعدهٔ «متن گزارش بازدید» در ۱۳.۴) |
| ویرایش/تأیید پایان دوره از پورتال | دامنهٔ این موج فقط خواندن بود؛ نوشتن نیاز به نوع درخواست تازه دارد |
| CSV/Excel خروجی گزارش | فعلاً چاپ مرورگر کافی است؛ خروجی فایل یک مسیر و کلید جدا می‌خواهد |

---

## ۶) آزمون‌ها

| فرمان | نتیجه |
|---|---|
| `cd Backend && npm run test:portal-completion` | **۳۱/۳۱ PASS** |
| `cd Backend && npm run test:permissions` | PASS (۲۲۷ کلید / ۱۸ گروه + ۲ بررسی تازه) |
| `cd Frontend && npm run test:portal-menu` | **۸۱/۸۱ PASS** (۷۷ ⇒ ۸۱) |
| `cd Frontend && npm run test:customer-portal` | **۲۲۰/۲۲۰ PASS** |
| `node tools/gate.mjs` | GATE-PASS (گام تازهٔ `test:portal-completion` در هر دو گیت) |

`portal-completion-test.mjs` چه چیزی را **اجرا** می‌کند (نه فقط regex):

| گروه | نمونهٔ بررسی |
|---|---|
| فهرست سفید | ردیف حاوی `income_total`/`net_profit`/`notes`/`completed_by` ⇒ هیچ‌کدام در خروجی نیست و رشتهٔ `999999999` در JSON پیدا نمی‌شود |
| عددسازی | `"87000.00"` ⇒ `87000` (number)، `"5.00"` ⇒ `5`، مقدار غایب ⇒ `null` (نه ۰) |
| تاریخ | `Date` و `"2026-02-02T00:00:00Z"` هر دو ⇒ `2026-02-02` |
| تجمیع | ۳۰٬۰۰۰ / ۲۸٬۵۰۰ / ۵٪ / ۲٫۰۶۷ / `fcr=1.48` / `3.053` |
| روند | `weeks = 1,2,3` و طول هر سری ۳ |
| دارو/واکسن | جمع بر اساس نام («ویتامین × ۲») و بدون `medicine_id` |
| هشدار | اختلاف FCR ⇒ متن «اختلاف دارد» |
| امنیت مسیر | `requireOwnedRow({ model: FlockCompletion` · `tabChain("customer.portal.completion")` · هیچ POST/PATCH/DELETE |
| اسکوپ سرویس | شمارش `customer_id: customerId` ≥ ۶ و نبود `create/update/destroy` |
| یک‌منبعی موتور | `require("./flockMetrics")` + استفاده از `aggregateFlock`/`summarizeWeeks`/`buildFlockTrend` |

---

## ۷) نکات اجرا و ریسک‌ها

| # | نکته | چرا مهم است |
|---|---|---|
| ۱ | DECIMALهای سکوئلایز **رشته** برمی‌گردند | بدون `numberOrNull`، عدد `"87000.00"` در UI غلط فرمت/مقایسه می‌شد |
| ۲ | `flock_completion_halls` هفته ندارد | شمارش هفته‌ها از `weekly_management` می‌آید و در `totals.weeksCount` بازنویسی می‌شود |
| ۳ | دیکشنری دارو/واکسن سراسری است | فقط با شناسه‌های استخراج‌شده از ردیف‌های هفتگی **همین مشتری** خوانده می‌شود |
| ۴ | نام سالن از `Hall` با همان `customer_id` | حتی در ناسازگاری داده، نام سالن مشتری دیگر نمایش داده نمی‌شود |
| ۵ | `fcr` می‌تواند `null` باشد | UI «—» نشان می‌دهد و هشدار می‌دهد؛ هیچ عدد ساختگی ساخته نمی‌شود |
| ۶ | نمودار بدون کتابخانه | ۰ وابستگی تازه، حجم کم، و قابل تست در Node (`renderTrendChart` خالص) |

---

## ۸) فایل‌های این موج

**بک‌اند**

| فایل | تغییر |
|---|---|
| `services/portalCompletionView.js` | تازه — فهرست سفید/عددسازی/تجمیع/هشدار (خالص) |
| `services/portalCompletionService.js` | تازه — دو تابع خواندنِ اسکوپ‌شده |
| `controllers/portalCompletionController.js` | تازه — دو کنترلر GET |
| `routes/portalRoutes.js` | دو مسیر + `requireOwnedRow` + زنجیرهٔ کلیدها |
| `controllers/portalController.js` | `sections.completion` / `sections.finalReport` / `features.completion_report` |
| `config/permissions.js` | ۲ کلید تازه |
| `permissions-test.mjs` | انتظار ۲۲۷ + دو بررسی تازه |
| `portal-completion-test.mjs` | گارد تازه (۳۱ بررسی) |
| `package.json` | اسکریپت `test:portal-completion` |

**فرانت**

| فایل | تغییر |
|---|---|
| `features/portal/portal.menu.js` | دو آیتم از `soon` به پنل واقعی + دو `contentKey` |
| `features/portal/portal.views.js` | `VIEW_TABS` + دو رندرر + نمودار + لودرها (`requiresAll`) |
| `features/portal/portal.api.js` | `getCompletions` / `getCompletionReport` |
| `core/constants/api.const.js` | `PORTAL.COMPLETIONS` / `PORTAL.COMPLETION_DETAIL` |
| `pages/portal.html` | دو پنل تازه + دو لینک بدون بج «به‌زودی» |
| `features/portal/portal.nav.css` | KPI/چیپ/نمودار/گزارش + `@media print` |
| `portal-menu-guard-test.mjs` | پنل‌ها ۱۴، soon ۱، GETها ۵، ۴ بررسی تازه |
| `customer-portal-guard-test.mjs` | شمارش کلید ۲۲۷ و GETها ۲۲ |

**ابزار و مستند**

| فایل | تغییر |
|---|---|
| `tools/gate.mjs` · `tools/gate.ps1` | گام `test:portal-completion` |
| `Frontend/package.json` | اسکریپت آینهٔ بک‌اند برای گیت |
| `Frontend/README.md` · `Backend/README.md` | بخش موج ۱۳.۱۹ |
| `docs/REVIEW-WAVE-13.19.md` | همین سند |

---

## ۹) جمع‌بندی

- **۲ اندپوینت · ۰ مایگریشن · ۰ نوشتن** — تمام ارزش از داده‌ای که کارشناس
  ثبت کرده بیرون کشیده شد.
- **امنیت «منفی»**: اقتصاد گله/یادداشت داخلی/کاربر کارشناس نه در UI پنهان،
  بلکه از فهرست `attributes` هم حذف شده‌اند.
- **یک موتور، دو روایت**: هر شاخص هم «محاسبه از هفته‌ها» دارد و هم «عدد
  ثبت‌شده»؛ اختلاف صریح نمایش داده می‌شود — نه پنهان.
- **پورتال دیگر وعدهٔ مبهم ندارد**: تنها «به‌زودی» باقی‌مانده دقیقاً می‌گوید
  چه چیزی در پایگاه داده نیست و جایش کجاست.
