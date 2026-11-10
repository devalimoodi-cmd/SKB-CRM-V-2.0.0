# بازبینی موج ۱۳.۲۰ — «دو پرچم بی‌صاحب و یک ۴۰۳ خاموش»

> ادامهٔ مستقیم ۱۳.۱۸. آن موج اسکیمای مشترک را ساخت و دو پرچم را که
> «سرور می‌فرستد ولی UI نمی‌خواند» صادقانه در فهرست استثنا
> (`SERVER_ONLY_FEATURES`) مستند کرد. ۱۳.۲۰ همان دو مورد را **واقعی**
> می‌کند و فهرست استثنا را به صفر می‌رساند.
>
> **۰ اندپوینت · ۰ کلید · ۰ مایگریشن · ۰ تغییر بک‌اند** — تنها ارزش این
> موج «بستن دو ناهم‌ترازی» است که یکی‌شان خطای واقعی تولید می‌کرد.

---

## ۱) مسئله

| # | شکاف | اثر |
|---|---|---|
| ۱ | بلوک «استاندارد نژاد» فقط با `charts.standards` گیت شده بود، ولی دادهٔ آن از `GET /portal/dashboard/analysis` می‌آید که در اسکیما **دو** کلید می‌خواهد (`dashboard` + `dashboard.analysis`) | اگر مدیر فقط `dashboard.analysis` را می‌بست، کلاینت درخواستی می‌فرستاد که **قطعاً ۴۰۳** بود و UI پیام «دریافت استاندارد نژاد ناموفق بود» نشان می‌داد — «خطا» جای «داده ندارید» |
| ۲ | دکمهٔ «گزارش نهایی» در پنل «پایان دوره» با کلید **دستی‌تایپ‌شده** `canPermission("customer.portal.completion.report")` گیت شده بود | `canPermission` در فرانت **fail-open** است؛ با کلید بسته، دکمه دیده می‌شد و کلیکش ۴۰۳ می‌گرفت. سرور همین را در `features.completion_report` می‌فرستاد و کسی نمی‌خواند |
| ۳ | گارد فرانت دو پرچم را در فهرست استثنا نگه می‌داشت | هر پرچم «فقط-سرور» بعدی هم می‌توانست بی‌صدا اضافه شود |

ریشهٔ مشترک: **گیت UI با «پرچم نمایش» ساخته می‌شد، نه با «کلید داده»** —
همان چیزی که اسکیمای ۱۳.۱۸ برای دیدنش ساخته شد.

---

## ۲) دامنه

| مورد | مقدار |
|---|---|
| اندپوینت تازه | **هیچ** |
| کلید مجوز تازه | **هیچ** (۲۲۷ ⇒ ۲۲۷ / ۱۸ گروه) |
| مایگریشن | **هیچ** |
| تغییر بک‌اند | **هیچ** — اسکیما فقط خوانده می‌شود |
| فایل تغییریافته | ۲ فایل `src` + ۱ گارد + ۲ README + همین سند |
| نتیجهٔ گارد | ۲۸ ⇒ **۳۰** بررسی · `SERVER_ONLY_FEATURES` حذف شد |

---

## ۳) تغییرات فرانت

### ۳.۱) گیت «تحلیل داشبورد» — سرور اول، کلاینت fallback

`src/features/portal/portal.extra.js` — همان الگوی `canEditProfile()` (۱۳.۸):

```js
canOpenDashboardAnalysis() {
  const features = this.data && this.data.features;
  if (features && typeof features.dashboard_analysis === "boolean") {
    return features.dashboard_analysis; // ← منبع اول: پاسخ /me
  }
  return this.canPermission("customer.portal.dashboard.analysis");
}
```

و شرط بلوک استاندارد نژاد، حالا **دو** شرط دارد:

```js
if (
  standardsBox &&
  allowed.standards !== false &&        // نمایش نمودار (کلید chart.standards)
  this.canOpenDashboardAnalysis()       // دادهٔ تحلیل (dashboard + dashboard.analysis)
) {
```

| قبل | بعد |
|---|---|
| کلید `dashboard.analysis` بسته ⇒ درخواست ۴۰۳ + پیام خطا | همان حالت ⇒ **هیچ درخواستی** و بلوک خالی (هم‌رفتار با «نمودار بسته») |
| پرچم `charts.standards` بسته، کلید تحلیل باز ⇒ بلوک خالی | بدون تغییر |

🔒 عبارت فراخوانی `getDashboardAnalysis({ scope: "all" })` عیناً دست‌نخورده
ماند، چون گارد `۱۳.۱۰.۱` همین متن را می‌سنجد (فقط داخل `if` رفت).

### ۳.۲) گیت «گزارش نهایی» — همان پرچم سرور

`src/features/portal/portal.views.js`:

```js
completionCanReport() {
  const features = this.data && this.data.features;
  if (features && typeof features.completion_report === "boolean") {
    return features.completion_report;
  }
  return Boolean(this.canPermission("customer.portal.completion.report"));
}
```

`features.completion_report` در `PORTAL_FEATURES` از «پنل باز + کلید
افزون» ساخته می‌شود (کنترلر `/me`)، پس حالا **یک** منبع برای سه چیز است:
آیتم منو (`contentKey`)، `sections.finalReport` و دکمهٔ پرش.

---

## ۴) گارد — از «مستند» به «سخت‌گیرانه»

`Frontend/portal-schema-guard-test.mjs` (۲۸ ⇒ **۳۰**):

| بررسی | چه می‌سنجد |
|---|---|
| ۱۳.۲۰ · هر قابلیت سرور در مرورگر خوانده می‌شود (صفر استثنا) | `SERVER_ONLY_FEATURES` حذف شد؛ هر `features.<key>` اعلام‌شده در `PORTAL_FEATURES` باید در `src/features/portal/*.js` خوانده شود |
| ۱۳.۲۰ · درخواست `/dashboard/analysis` داخل گیت است | وجود helper سرور-اول + قرار گرفتن `this.canOpenDashboardAnalysis()` در شرط + **ترتیب**: ایندکس گیت < ایندکس فراخوانی اندپوینت |
| ۱۳.۲۰ · دکمهٔ «گزارش نهایی» اول از `features.completion_report` می‌پرسد | در بدنهٔ `completionCanReport`، خواندن features **قبل** از `canPermission` می‌آید |

خروجی واقعی گام ترتیبی (از اجرای همین موج):

```
PASS - ۱۳.۲۰ · درخواست /dashboard/analysis داخل گیت features.dashboard_analysis است :: gate=19648 call=19766
```

یعنی «قرار گرفتن در گیت» نه با توضیح، بلکه با موقعیت در سورس سنجیده می‌شود.

---

## ۵) آنچه آگاهانه انجام نشد

| مورد | چرا |
|---|---|
| بررسی «هر کلید دستی‌تایپ‌شده در فرانت باید در کاتالوگ باشد» | پیش‌نیازش یک اسکن کامل `canPermission("...")` در همهٔ فایل‌های پورتال است؛ در این موج عمداً وارد نشد تا گارد جدید **قابل اتکا** بماند. نامزد موج بعد (با فهرست سفید و پیام خطای دقیق) |
| حذف `fallback` کلاینت از دو گیت | تب‌های پورتال باید با پاسخ `/me` قدیمی/کش‌شده هم کار کنند؛ ترتیب «سرور اول، کلاینت دوم» ریسک را صفر می‌کند بدون حذف سازگاری |
| تغییر در `renderStandardsChart` | ورودی خالی همان رفتار قبلی را دارد؛ گارد `test:portal-menu` دست‌نخورده می‌ماند |
| `Backend` | هیچ کلید/مسیر/فیلدی عوض نشد؛ اسکیما فقط **خوانده** شد |

---

## ۶) آزمون‌ها

| فرمان | نتیجه |
|---|---|
| `node tools/gate.mjs` | **GATE-PASS** — ۴۹ گام، همه `exit=0` |
| `cd Backend && npm run test:portal-schema` | **۴۶/۴۶** |
| `cd Frontend && npm run test:portal-schema-guard` | **۳۰/۳۰** (۲۸ ⇒ ۳۰) |
| `cd Frontend && npm run test:customer-portal` | **۲۲۱/۲۲۱** (بدون تغییر) |
| `cd Frontend && npm run test:portal-menu` | **۸۲/۸۲** |
| `cd Frontend && npm run test:portal-requests` | **۳۵/۳۵** |
| `cd Backend && npm run test:portal-requests` | **۸۰/۸۰** |
| `cd Backend && npm run test:portal-completion` | **۳۱/۳۱** |
| `cd Backend && npm run test:permissions` | **۳۴/۳۴** (۲۲۷ کلید / ۱۸ گروه) |
| `cd Frontend && npm run lint:guards` | **exit=0** — ۰ خطا (۶ هشدار قدیمیِ `no-unused-vars`/`no-useless-escape` در گاردهای body-split) |
| `cd Frontend && npm run lint` | **exit=0** — همان `eslint src` بدون تغییر |

هیچ آزمونی «کم» نشد و هیچ بررسی‌ای شل نشد: بررسی ۱۳.۱۸ که استثنا را مجاز
می‌دانست، با نسخهٔ سخت‌گیرانه **جایگزین** شد.

---

## ۷) نکات و ریسک‌ها

| # | نکته | چرا مهم است |
|---|---|---|
| ۱ | `canPermission` فرانت **fail-open** است | هر گیتی که فقط به آن تکیه کند، با کلید بسته هم دکمه می‌سازد — دو گیت این موج دقیقاً همین‌جا بودند |
| ۲ | `allowed.standards !== false` با `undefined` هم باز است | این behavior عمدی است (سازگاری با پاسخ قدیمی `options`)؛ شرط دوم (کلید داده) ریسک را می‌بندد |
| ۳ | `featureReads` با الگوی `features.<name>` پیدا می‌شود | خواندن با براکت (`features["x"]`) یا destructuring دیده نمی‌شود؛ در کد پورتال فقط دسترسی نقطه‌ای استفاده می‌شود و گارد همین را تضمین می‌کند |
| ۴ | `SERVER_ONLY_FEATURES` حذف شد | اگر موجی در آینده پرچمی «فقط-سرور» بسازد، گارد **FAIL** می‌دهد تا تصمیم صریح گرفته شود |
| ۵ | هیچ تغییر بک‌اند | `Backend/config/portalSchema.js` تنها منبع حقیقت ماند؛ این موج فقط مصرف‌کننده را همراستا کرد |

---

## ۸) فایل‌های این موج

| فایل | تغییر |
|---|---|
| `Frontend/src/features/portal/portal.extra.js` | `canOpenDashboardAnalysis()` + شرط دوگانهٔ بلوک استاندارد نژاد |
| `Frontend/src/features/portal/portal.views.js` | `completionCanReport()` سرور-اول |
| `Frontend/portal-schema-guard-test.mjs` | حذف `SERVER_ONLY_FEATURES` + ۲ بررسی تازه + به‌روزرسانی سرصفحه (۲۸ ⇒ ۳۰) |
| `Frontend/eslint.config.js` | بلوک `*.mjs` با Node globals (`process`/`Buffer`/`setImmediate`) — پیش از این، `eslint *.mjs` برای ۸ گارد «process/setImmediate is not defined» می‌داد |
| `Frontend/package.json` | اسکریپت تازهٔ `lint:guards` (`eslint *.mjs`) — ابزار کیفیت، عمداً **نه** گام دروازه |
| `Frontend/README.md` · `Backend/README.md` | بخش موج ۱۳.۲۰ |
| `docs/REVIEW-WAVE-13.20.md` | همین سند |

---

## ۹) جمع‌بندی

- **دو پرچم، حالا دو گیت واقعی**: `dashboard_analysis` جلوی ۴۰۳ بی‌مورد را
  می‌گیرد و `completion_report` دکمهٔ گزارش را با کلید سرور هم‌تراز می‌کند.
- **صفر استثنا**: گارد فرانت دیگر «فهرست استثنا» ندارد؛ هر قابلیتی که سرور
  اعلام کند باید در UI خوانده شود.
- **هیچ چیز در بک‌اند تغییر نکرد** — این موج فقط ثابت کرد اسکیمای ۱۳.۱۸
  همان کاری را می‌کند که برایش ساخته شد: نشان‌دادن ناهم‌ترازی.
