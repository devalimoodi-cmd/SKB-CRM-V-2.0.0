# نقاط داغ پروژه (Hotspots)

> سند زنده — با اجرای اسکریپت‌های audit به‌رو نگه داشته می‌شود.
> آخرین به‌روزرسانی: **موج ۳.۲a — شکستن `dashboard.service.js` به سه mixin (پیامک/بوکمارک/چسب پنجره) + گارد دائمی سطح داشبورد** (برنچ `chore/wave-3-split-god-classes`).
> گزارش‌های کامل: `docs/REVIEW-WAVE-3.md` (موج ۳.۲a و ۳.۱) · `docs/REVIEW-WAVE-2.md` (موج ۲) · `docs/REVIEW.md` (موج ۰ و ۱)

## چطور اندازه‌گیری می‌شود؟

```bash
# Frontend
cd Frontend
npm run audit:size              # فایل‌های بزرگ و صفر‌بایتی
npm run audit:dead-exports      # export های بی‌مصرف + فایل‌های بی‌ارجاع
npm run audit:surface           # گارد «قرارداد سطح سرویس» (exit=1 اگر عضوی گم شود)
npm run audit:big-methods       # متدهای بزرگ‌تر از بودجهٔ ۱۵۰ خط
npm run test:hatchery-surface   # گارد «سطح زمان اجرا» جوجه‌ریزی (import واقعی + اسنپ‌شات قرارداد)
npm run test:dashboard-surface  # گارد «سطح زمان اجرا» داشبورد (۷۸ عضو prototype + ۲۴ نام window)

# Backend
cd Backend
npm run audit:size
npm run audit:dead-exports
```

`audit:surface` علاوه بر گاردِ «گم‌شدن عضو»، **نقض قرارداد فراخوانی** را هم می‌گیرد:
اگر فایلی `someService.foo()` را صدا بزند و `foo` در فایل صاحب سرویس نباشد (باگی که
فقط در زمان اجرا در مرورگر دیده می‌شود)، گزارش می‌دهد. اسنپ‌شات آن در
`docs/service-surface.json` است و فقط با `--snapshot` عمداً به‌روز می‌شود.

`test:hatchery-surface` این گاردِ استاتیک را در **زمان اجرا** تکمیل می‌کند:
`hatchery.service.js` را با استاب حداقلی مرورگر (`window`/`document`/`localStorage`) در Node
import می‌کند و همان اعداد اسنپ‌شات را روی نمونهٔ واقعی می‌سنجد
(۱۰۱ عضو `prototype` · ۵۷ نام `window.*` · ویژگی‌های نمونه · وجود فایل سه mixin).
اگر mixin جابه‌جا/گم شود یا اسنپ‌شات به‌روز نشده باشد → `exit=1`.

`test:dashboard-surface` همین گارد را برای `dashboard.service.js` تکرار می‌کند
(۷۸ عضو `prototype` = ۶۳ متد کلاس + ۱۰ پیامک + ۵ بوکمارک · ۲۴ نام `window.*` ·
۳۱ ویژگی نمونه · وجود فایل دو mixin). دو نکتهٔ خاص داشبورد: کلاس `DashboardService`
**صادر نمی‌شود** (فقط نمونهٔ `dashboardService`؛ کلاس تنها از مسیر `window.DashboardService`
دیده می‌شود) و `setDashboardChartLayout` «هنگام نیاز» داخل `setupChartLayoutToggle`
ثبت می‌شود، پس از گارد `window` کنار گذاشته شده و جداگانه بررسی می‌شود.

اسکریپت‌ها **فقط خواندنی** هستند (جز `--snapshot`) و گزینه‌های `--json`، `--top=`،
`--big=`، `--fail-on-empty` و `--fail-on-dead` را پشتیبانی می‌کنند.

## وضعیت فعلی (پس از موج ۳.۲a)

### Frontend

| شاخص | مقدار |
| --- | --- |
| فایل‌های اسکن‌شده | ۱۵۰ |
| حجم کل `src` | ۲.۳۸ MB |
| فایل صفر‌بایتی | ۰ |
| export بدون ارجاع بیرونی | ۷۱ |
| فایل js بی‌ارجاع | ۳ |
| سرویس‌های ثبت‌شده در اسنپ‌شات قرارداد | ۴۷ |
| سراسری‌های `window` تحت گارد | ۲۴۶ |

#### بزرگ‌ترین فایل‌ها (≥ ۴۰KB)

| حجم | فایل |
| --- | --- |
| 118.6 KB | `src/features/customer-info/sections/weekly/weekly.service.js` |
| 97.6 KB | `src/features/customer-info/sections/hall-management/halls.service.js` |
| 95.9 KB | `src/pages/customer-info.html` |
| 95.4 KB | `src/features/customer-info/sections/hatchery/hatchery.service.js` |
| 87.1 KB | `src/features/dashboard/dashboard.service.js` |
| 74.8 KB | `src/features/customer-info/sections/weekly/weekly.renderer.js` |
| 71.4 KB | `src/features/customer-info/sections/chart-dashboard/chart-dashboard.service.js` |
| 68.2 KB | `src/features/dashboard/dashboard.css` |
| 54.6 KB | `src/features/customer-info/sections/hatchery/hatchery.completion.period.js` |
| 54.2 KB | `src/features/customer-info/sections/hatchery/hatchery.completion.flock.js` |
| 50.2 KB | `src/features/admin-panel/admin-panel.service.js` |
| 44.0 KB | `src/pages/admin-panel.html` |
| 43.0 KB | `src/features/dashboard/dashboard.sms.js` |
| 40.5 KB | `src/features/customer-info/sections/hatchery/hatchery.report.js` |

> 📉 `hatchery.service.js` پیش از موج ۲ برابر ۲۰۸.۹KB بود؛ پس از استخراج «چسب پنجره»
> (موج ۲.۱) و «خوشهٔ پایان دوره/ویرایش» (موج ۲.۲) به ۹۵.۱KB رسید (−۵۴٪).
> در موج ۳.۱ خودِ خوشه هم از یک فایل ۱۰۹.۸KB به سه mixin دامنه‌ای شکسته شد:
> `hatchery.completion.period.js` (۵۴.۶KB)، `hatchery.completion.flock.js` (۵۴.۲KB) و
> `hatchery.completion.age.utils.js` (۲.۸KB) ⇒ بزرگ‌ترین فایل خوشه **نصف** شد.
> (۳ خط به `hatchery.service.js` اضافه شد: سه `import` و سه `Object.assign`.)

> 📉 `dashboard.service.js` پیش از موج ۳.۲a برابر **۱۵۷.۴KB / ۴۰۶۹ خط** بود؛ با بیرون‌کشیدن سه
> دامنهٔ مستقل به ۸۷.۱KB / ۲۴۱۰ خط رسید (−۴۵٪ حجم، −۴۱٪ خط):
> `dashboard.sms.js` (۴۳.۰KB، ۱۰ متد)، `dashboard.bookmarks.js` (۲۹.۸KB، ۵ متد) و
> `dashboard.window-glue.js` (۵.۴KB، ۲۴ نام `window.*` + راه‌اندازی DOM).
> دیف سرویس: **۹ خط افزوده / ۱۶۶۸ خط حذف‌شده** — ۱۶۶۴ خط متدهای منتقل‌شده + ۴ خط
> ایمپورت چندخطی `date.utils.js` که به یک خط تک‌نامی (`convertToPersianDate`) تبدیل شد
> (`convertPersianToGregorian` فقط در mixin بوکمارک مصرف می‌شود). هیچ متد، نام `window.*`
> یا رفتاری تغییر نکرد و اسنپ‌شات `docs/service-surface.json` دوباره تولید شد
> (۷۸ عضو `prototype` = ۶۳ متد کلاس + ۱۰ پیامک + ۵ بوکمارک).

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

1. ✅ **`dashboard.service.js`** — در **موج ۳.۲a** به سه mixin شکست: `dashboard.sms.js`
   (۴۳.۰KB، ۱۰ متد)، `dashboard.bookmarks.js` (۲۹.۸KB، ۵ متد از جمله `showCreateBookmarkModal`
   ۲۸۴ خط و `showBookmarkDetail` ۱۵۰ خط) و `dashboard.window-glue.js` (۵.۴KB، ۲۴ نام `window.*`)
   ⇒ ۱۵۷.۴KB → ۸۷.۱KB. گارد زمان اجرا `npm run test:dashboard-surface` اضافه شد.
   شرح: `docs/REVIEW-WAVE-3.md` بخش ۱۲.
2. **`weekly.service.js` (۱۱۸.۶KB)** — رندر (`buildWeeklyHistoryHTML` ۳۳۶ خط،
   `renderWeeks` ۳۰۴ خط) و محاسبات در یک فایل‌اند؛ تفکیک رندر به mixin جدا.
   🔜 **کاندید اصلی موج ۳.۲b** (بزرگ‌ترین فایل باقی‌مانده).
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
9. **ارجاع آویزان `savePeriod` (P2-۳، کشف تازهٔ گارد زمان اجرا)** — تعریف
   `async savePeriod()` در کامیت `e250186` حذف شده ولی هر دو صداکننده‌اش مانده‌اند:
   `hatchery.service.js:351` (کلیک دکمهٔ ذخیرهٔ تب «اطلاعات دوره») و
   `hatchery.window-glue.js:28` (`window.saveChickPeriodInfo`). چون
   `hatcheryApi.createPeriod` و `hatcheryValidation.validatePeriod` هم دیگر وجود ندارند،
   بازگردانی یک‌به‌یک ممکن نیست؛ تصمیم لازم است: حذف دو صداکننده (که سطح `window` را از
   ۵۷ به ۵۶ می‌آورد و به‌روزرسانی عمدی اسنپ‌شات می‌خواهد) یا بازطراحی مسیر ثبت دوره.
   تا آن زمان گارد زمان اجرا این نام را «اطلاعی» گزارش می‌کند و همچنان هر «گم‌شدن نام
   جدید» را می‌گیرد.

## قواعد نگه‌داری

- **هرگز** فایل صفر‌بایتی اضافه نکنید؛ `npm run audit:size -- --fail-on-empty` را در CI بگذارید.
- برای فایل جدید `src/features/...`، حتماً مصرف‌کنندهٔ آن (import یا `<script src>`) مشخص باشد.
- فایل‌های بزرگ‌تر از ۴۰KB فقط با برنامهٔ شکستن (issue) بزرگ‌تر شوند.
- **قبل و بعد از هر جابه‌جایی/شکستن، `npm run audit:surface` را اجرا کنید**؛ اگر «گم‌شده»
  گزارش داد، جابه‌جایی ناقص است. متدهای منتقل‌شده به mixin هم توسط همین ابزار شناخته می‌شوند.
- برای برش فایل‌های چاق، **اسکریپت مهاجرت + گیت اثبات** بنویسید (الگو: موج ۳.۲a در
  `docs/REVIEW-WAVE-3.md` بخش ۱۲ — نسخهٔ تکامل‌یافتهٔ الگوی بخش ۳): برش بر اساس **آفست
  بایت** (نه شمارهٔ خط/جست‌وجوی متنی)، اثبات `concat(قطعات) === ناحیهٔ اصلی`، گارد «حذف
  تصادفی `export`»، پاسخ‌گویی **AST (espree)** به «آیا هر ۱۵ عضو به mixin منتقل شده؟»،
  هرس ایمپورت‌های بی‌مصرف سرویس، و EOL یکدست. اسکریپت موقت را پس از تأیید حذف کنید تا
  در `src` نماند (وگرنه `audit:dead-exports`/`audit:size` را آلوده می‌کند).
- پس از هر شکستن mixin، **حجم/متد فایل‌های جدید** را در جدول‌های بالای همین سند به‌روز کنید.
- برای سرویس‌های وابسته به DOM، **گارد زمان اجرا** را هم اجرا کنید
  (`npm run test:hatchery-surface` و `npm run test:dashboard-surface`)؛ این تست‌ها ماژول را
  واقعاً با استاب `window`/`document`/`localStorage` import می‌کنند و سطح عمومی را با
  `docs/service-surface.json` مقایسه می‌کنند، پس هم «گم‌شدن بی‌صدای عضو» را می‌گیرند و هم
  «بزرگ‌شدن ناخواستهٔ سطح عمومی» را. برای سرویس بعدی همین الگو را تکرار کنید: استاب حداقلی
  + مقایسه با همان اسنپ‌شات قرارداد + یک اسکریپت npm.

