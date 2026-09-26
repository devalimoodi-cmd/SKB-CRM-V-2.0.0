# نقاط داغ پروژه (Hotspots)

> سند زنده — با اجرای اسکریپت‌های audit به‌رو نگه داشته می‌شود.
> آخرین به‌روزرسانی: **موج ۳.۱ — شکستن mixin «خوشهٔ پایان دوره»** (برنچ `chore/wave-3-split-god-classes`).
> گزارش‌های کامل: `docs/REVIEW-WAVE-3.md` (موج ۳.۱) · `docs/REVIEW-WAVE-2.md` (موج ۲) · `docs/REVIEW.md` (موج ۰ و ۱)

## چطور اندازه‌گیری می‌شود؟

```bash
# Frontend
cd Frontend
npm run audit:size              # فایل‌های بزرگ و صفر‌بایتی
npm run audit:dead-exports      # export های بی‌مصرف + فایل‌های بی‌ارجاع
npm run audit:surface           # گارد «قرارداد سطح سرویس» (exit=1 اگر عضوی گم شود)
npm run audit:big-methods       # متدهای بزرگ‌تر از بودجهٔ ۱۵۰ خط

# Backend
cd Backend
npm run audit:size
npm run audit:dead-exports
```

`audit:surface` علاوه بر گاردِ «گم‌شدن عضو»، **نقض قرارداد فراخوانی** را هم می‌گیرد:
اگر فایلی `someService.foo()` را صدا بزند و `foo` در فایل صاحب سرویس نباشد (باگی که
فقط در زمان اجرا در مرورگر دیده می‌شود)، گزارش می‌دهد. اسنپ‌شات آن در
`docs/service-surface.json` است و فقط با `--snapshot` عمداً به‌روز می‌شود.

اسکریپت‌ها **فقط خواندنی** هستند (جز `--snapshot`) و گزینه‌های `--json`، `--top=`،
`--big=`، `--fail-on-empty` و `--fail-on-dead` را پشتیبانی می‌کنند.

## وضعیت فعلی (پس از موج ۳.۱)

### Frontend

| شاخص | مقدار |
| --- | --- |
| فایل‌های اسکن‌شده | ۱۴۷ |
| حجم کل `src` | ۲.۳۷ MB |
| فایل صفر‌بایتی | ۰ |
| export بدون ارجاع بیرونی | ۷۱ |
| فایل js بی‌ارجاع | ۳ |
| سرویس‌های ثبت‌شده در اسنپ‌شات قرارداد | ۴۶ |
| سراسری‌های `window` تحت گارد | ۲۴۶ |

#### بزرگ‌ترین فایل‌ها (≥ ۴۰KB)

| حجم | فایل |
| --- | --- |
| 157.4 KB | `src/features/dashboard/dashboard.service.js` |
| 118.6 KB | `src/features/customer-info/sections/weekly/weekly.service.js` |
| 97.6 KB | `src/features/customer-info/sections/hall-management/halls.service.js` |
| 95.9 KB | `src/pages/customer-info.html` |
| 95.4 KB | `src/features/customer-info/sections/hatchery/hatchery.service.js` |
| 74.8 KB | `src/features/customer-info/sections/weekly/weekly.renderer.js` |
| 71.4 KB | `src/features/customer-info/sections/chart-dashboard/chart-dashboard.service.js` |
| 68.2 KB | `src/features/dashboard/dashboard.css` |
| 54.6 KB | `src/features/customer-info/sections/hatchery/hatchery.completion.period.js` |
| 54.2 KB | `src/features/customer-info/sections/hatchery/hatchery.completion.flock.js` |
| 50.2 KB | `src/features/admin-panel/admin-panel.service.js` |
| 44.0 KB | `src/pages/admin-panel.html` |
| 40.5 KB | `src/features/customer-info/sections/hatchery/hatchery.report.js` |

> 📉 `hatchery.service.js` پیش از موج ۲ برابر ۲۰۸.۹KB بود؛ پس از استخراج «چسب پنجره»
> (موج ۲.۱) و «خوشهٔ پایان دوره/ویرایش» (موج ۲.۲) به ۹۵.۱KB رسید (−۵۴٪).
> در موج ۳.۱ خودِ خوشه هم از یک فایل ۱۰۹.۸KB به سه mixin دامنه‌ای شکسته شد:
> `hatchery.completion.period.js` (۵۴.۶KB)، `hatchery.completion.flock.js` (۵۴.۲KB) و
> `hatchery.completion.age.utils.js` (۲.۸KB) ⇒ بزرگ‌ترین فایل خوشه **نصف** شد.
> (۳ خط به `hatchery.service.js` اضافه شد: سه `import` و سه `Object.assign`.)

#### بزرگ‌ترین متدهای باقی‌مانده (بودجهٔ ۱۵۰ خط)

۳۰ متد از بودجه بزرگ‌ترند؛ فهرست کامل با `npm run audit:big-methods`. پنج مورد اول:

| خطوط | مکان | نام |
| --- | --- | --- |
| ۵۲۴ | `weekly/weekly.renderer.js:746` | `weeklyRenderer.renderFullReport` |
| ۴۵۰ | `hall-management/halls.report.js:491` | `generateHTML` |
| ۳۶۵ | `hatchery/hatchery.completion.period.js:724` | `hatcheryCompletionPeriodMethods.editPeriodCompletion` |
| ۳۳۶ | `weekly/weekly.service.js:2487` | `buildWeeklyHistoryHTML` |
| ۳۰۴ | `weekly/weekly.service.js:445` | `renderWeeks` |

#### فایل‌های js بی‌ارجاع (نه `import`، نه `<script src>`)

- `src/core/types/index.types.js`
- `src/features/sms/sms.modal.service.js`
- `src/shared/components/TaskCard/index.js`

> ⚠️ ممکن است بعضی از این‌ها با `import()` داینامیک مصرف شوند؛ قبل از حذف بررسی شود.

### Backend

| شاخص | مقدار |
| --- | --- |
| فایل‌های اسکن‌شده | ۱۳۹ |
| حجم کل | ۸۸۶ KB |
| فایل صفر‌بایتی | ۰ |
| بزرگ‌ترین کنترلرها | `dictionaryController.js` ۶۳.۶KB، `dashboardController.js` ۵۵.۳KB، `smsController.js` ۴۲.۴KB |

## نقاط داغ بعدی (پیشنهاد موج ۳.۲ و بعد از آن)

> ✅ **انجام‌شده در موج ۳.۱:** خودِ خوشهٔ پایان دوره از یک mixin ۱۰۹.۸KB به سه mixin
> دامنه‌ای شکست — `hatchery.completion.age.utils.js` + `hatchery.completion.flock.js` +
> `hatchery.completion.period.js` (۳۹ متد، بدون تغییر رفتار). شرح: `docs/REVIEW-WAVE-3.md`.

1. **`dashboard.service.js` (۱۵۷.۴KB)** — بزرگ‌ترین فایل باقی‌مانده؛ مودال بوکمارک
   (`showCreateBookmarkModal` ۲۸۴ خط، `showBookmarkDetail` ۱۵۰ خط) و وضعیت پیامک
   (`refreshSmsStatus` ۲۳۹ خط) کاندید جدا‌سازی با همان الگوی mixin موج ۲.
2. **`weekly.service.js` (۱۱۸.۶KB)** — رندر (`buildWeeklyHistoryHTML` ۳۳۶ خط،
   `renderWeeks` ۳۰۴ خط) و محاسبات در یک فایل‌اند؛ تفکیک رندر به mixin جدا.
3. **سه متد بزرگ داخل خوشهٔ پایان دوره** — `editPeriodCompletion` ۳۶۵ خط
   (`hatchery.completion.period.js:724`)، `completePeriod` ۲۷۸ خط و
   `_collectCompletionSave` ۲۰۳ خط (`hatchery.completion.flock.js:856`)؛ نیازمند
   تست رفتاری اختصاصی (شکستن بدنهٔ متد، نه جابه‌جایی متد).
4. **`halls.service.js` (۹۷.۶KB)** و **`chart-dashboard.service.js` (۷۱.۴KB)** —
   `saveBasicInfo` ۱۷۷ خط، `renderUnitDetailsPanel` ۱۶۵ خط، `renderAllCharts` ۲۲۳ خط.
5. **`customer-info.html` (۹۵.۹KB)** — صفحهٔ چاق؛ انتقال هندلرهای inline به «چسب پنجره»
   (همان الگوی موج ۲.۱) تا صفحات نازک شوند.
6. **۷۱ export بی‌مصرف در فرانت** — بیشترشان توابع کمکی عمومی (`dom.utils.js`،
   `number.utils.js`، `form.utils.js`) هستند؛ تصمیم بگیر «نگه‌دار برای آینده» یا «حذف».
7. **خوشهٔ SMS قدیمی** — `src/features/sms/*` (فایل مستقل `sms.html` + سرویس‌های کلاسیک)
   نه در منو است و نه در مسیرها؛ روت‌های `/sms` هم به فایل ناموجود اشاره می‌کنند (۴۰۴).
   شرح کامل: `docs/REVIEW.md` بخش ۴ (`P1-۱` و `P1-۲`).
8. **باگ `viewPeriod` (P2-۱)** — `hatchery.window-glue.js:38` متدی را با `?.` صدا می‌زند که
   هرگز وجود نداشته؛ کشف‌شده توسط `audit:surface` در موج ۲ و در موج ۳.۱ هم عمداً
   تغییر داده نشد.

## قواعد نگه‌داری

- **هرگز** فایل صفر‌بایتی اضافه نکنید؛ `npm run audit:size -- --fail-on-empty` را در CI بگذارید.
- برای فایل جدید `src/features/...`، حتماً مصرف‌کنندهٔ آن (import یا `<script src>`) مشخص باشد.
- فایل‌های بزرگ‌تر از ۴۰KB فقط با برنامهٔ شکستن (issue) بزرگ‌تر شوند.
- **قبل و بعد از هر جابه‌جایی/شکستن، `npm run audit:surface` را اجرا کنید**؛ اگر «گم‌شده»
  گزارش داد، جابه‌جایی ناقص است. متدهای منتقل‌شده به mixin هم توسط همین ابزار شناخته می‌شوند.
- برای برش فایل‌های چاق، **اسکریپت مهاجرت + گیت اثبات** بنویسید (الگو: موج ۳.۱ در
  `docs/REVIEW-WAVE-3.md` بخش ۳): برش بر اساس شمارهٔ خط (نه جست‌وجوی متنی)، اثبات
  `concat(قطعات) === ناحیهٔ اصلی`، گارد «حذف تصادفی `export`»، و EOL یکدست. اسکریپت
  موقت را پس از تأیید حذف کنید تا در `src` نماند.
- پس از هر شکستن mixin، **حجم/متد فایل‌های جدید** را در جدول‌های بالای همین سند به‌روز کنید.

