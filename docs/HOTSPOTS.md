# نقاط داغ پروژه (Hotspots)

> سند زنده — با اجرای اسکریپت‌های audit به‌رو نگه داشته می‌شود.
> آخرین به‌روزرسانی: **موج ۳.۲h — برش بدنهٔ متد غول کارت‌های هفتگی `weeklyCardMethods.renderWeeks` (۳۰۴ → ۳۰ خط) با گارد طلایی تازهٔ `test:weekly:cards:body`؛ شمارش متدهای بزرگ‌تر از بودجه ۲۲ → ۲۱** (ادامهٔ برنچ `chore/wave-3.2c-split-halls`).
> گزارش‌های کامل: `docs/REVIEW-WAVE-3.md` (موج ۳.۲d و ۳.۲c و ۳.۲b و ۳.۲a و ۳.۱) · `docs/REVIEW-WAVE-2.md` (موج ۲) · `docs/REVIEW.md` (موج ۰ و ۱)

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
npm run test:weekly:surface     # گارد «سطح زمان اجرا» هفتگی (۴۹ عضو prototype · ۱۵ نام window · ۱ نام اطلاعی)
npm run test:halls:surface      # گارد «سطح زمان اجرا» سالن‌ها (۷۱ عضو prototype · ۳۳ نام window · ۱۷ ویژگی نمونه)
npm run test:halls:body         # گارد طلایی بایت‌به‌بایت بدنهٔ چهار متد همین خوشه (۱۷ کِیس · ۱۳۶ بررسی)
npm run test:weekly:body        # گارد طلایی بایت‌به‌بایت بدنهٔ متد غول هفتگی (renderFullReport · ۱۲ کِیس)
npm run test:hatchery:body      # گارد طلایی بایت‌به‌بایت بدنهٔ دو متد غول پایان دوره (۲۲ کِیس)
npm run test:weekly:history:body # گارد طلایی بایت‌به‌بایت بدنهٔ متد غول تاریخچهٔ هفتگی (۱۲ کِیس)
npm run test:weekly:cards:body  # گارد طلایی بایت‌به‌بایت بدنهٔ متد غول کارت‌های هفتگی (۸ کِیس)
npm run test:dashboard:bookmarks:body # گارد طلایی بایت‌به‌بایت بدنهٔ متد غول بوکمارک‌های داشبورد (۲۰ کِیس)

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
`test:weekly:surface` همین گارد را برای `weekly.service.js` تکرار می‌کند (۲۱ بررسی): ۴۹ عضو
`prototype` (= ۱ سازنده + ۴۸ متد در ۸ mixin دامنه‌ای) · ۱۵ نام `window.*` در `weekly.window-glue.js` ·
۱۵ ویژگی نمونهٔ غیرمتدی · و وجود هر ۸ فایل mixin روی دیسک. دو نکتهٔ خاص هفتگی: کلاس
`WeeklyService` صادر نمی‌شود (فقط نمونهٔ `weeklyService`؛ کلاس از مسیر `window.WeeklyService`
دیده می‌شود) و چسب پنجره با تابع ثبت `registerWeeklyWindowGlue({ weeklyService, WeeklyService })`
**بعد از** ساخته‌شدن نمونه اجرا می‌شود؛ گارد همین ترتیب را هم می‌سنجد.
`test:halls:surface` همین گارد را برای `halls.service.js` تکرار می‌کند (۲۴ بررسی): ۷۱ عضو
`prototype` (= ۱ سازنده + ۷۰ متد در ۸ mixin دامنه‌ای) · ۳۳ نام `window.*` در
`halls.window-glue.js` · ۱۷ ویژگی نمونه (۱۲ مورد در `constructor` + ۴ فیلد تنبل که وجودشان
با `this.X =` در متن اثبات می‌شود + یک شبه‌ویژگی DOM) · وجود هر ۸ فایل mixin روی دیسک.
دو نکتهٔ خاص سالن‌ها: کلاس `HallsService` صادر نمی‌شود (فقط نمونهٔ `hallsService`؛ کلاس از
مسیر `window.HallsService` دیده می‌شود) و گارد دستهٔ باگ «عضو فانتوم» را هم می‌گیرد: نامی که
در سطح عمومی *صدا زده* می‌شود ولی هیچ‌جا ساخته نمی‌شود (همان الگوی `loadCities`) → قرمز.

اسکریپت‌ها **فقط خواندنی** هستند (جز `--snapshot`) و گزینه‌های `--json`، `--top=`،
`--big=`، `--fail-on-empty` و `--fail-on-dead` را پشتیبانی می‌کنند.

## وضعیت فعلی (پس از موج ۳.۲c)

### Frontend

| شاخص | مقدار |
| --- | --- |
| فایل‌های اسکن‌شده | ۱۶۸ |
| حجم کل `src` | ۲.۴۱ MB |
| فایل صفر‌بایتی | ۰ |
| export بدون ارجاع بیرونی | ۷۱ |
| فایل js بی‌ارجاع | ۳ |
| سرویس‌های ثبت‌شده در اسنپ‌شات قرارداد | ۵۰ |
| سراسری‌های `window` تحت گارد | ۲۴۶ |

#### بزرگ‌ترین فایل‌ها (≥ ۴۰KB)

| حجم | فایل |
| --- | --- |
| 97.2 KB | `src/pages/customer-info.html` |
| 95.4 KB | `src/features/customer-info/sections/hatchery/hatchery.service.js` |
| 87.1 KB | `src/features/dashboard/dashboard.service.js` |
| 74.8 KB | `src/features/customer-info/sections/weekly/weekly.renderer.js` |
| 71.4 KB | `src/features/customer-info/sections/chart-dashboard/chart-dashboard.service.js` |
| 68.2 KB | `src/features/dashboard/dashboard.css` |
| 54.6 KB | `src/features/customer-info/sections/hatchery/hatchery.completion.period.js` |
| 54.2 KB | `src/features/customer-info/sections/hatchery/hatchery.completion.flock.js` |
| 50.2 KB | `src/features/admin-panel/admin-panel.service.js` |
| 44.7 KB | `src/pages/admin-panel.html` |
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

> 📉 `weekly.service.js` پیش از موج ۳.۲b برابر **۱۱۸.۶KB / ۲۸۶۷ خط / ۴۹ عضو سطح عمومی** (بزرگ‌ترین
> فایل مخزن) بود؛ با بیرون‌کشیدن ۸ دامنه + «چسب پنجره» به **۲.۷KB / ۵۲ خط / همان ۴۹ عضو** رسید
> (−۹۸٪ حجم). بزرگ‌ترین فایل تولیدشده `weekly.cards.js` (۳۴.۵KB / ۶۷۷ خط؛ پس از برش بدنهٔ موج ۳.۲h: ۳۵.۲KB / ۶۸۵ خط) است و هیچ‌کدام از
> ۹ فایل تازه به آستانهٔ ۴۰KB نمی‌رسند. دیف سرویس: **۳۱ خط افزوده / ۲۸۴۶ خط حذف‌شده**؛ ۹ فایل
> جدید روی‌هم ۳۰۰۶ خط. حجم `src` از ۲.۳۸ به ۲.۴۰ MB رفت (+۲۲KB) که سربار سرصفحه/ایمپورت
> ۹ فایل است، نه کد تازه. اسنپ‌شات `docs/service-surface.json` عمداً بازتولید شد: ۴۹ عضو
> `prototype` = ۱ سازنده + ۴۸ متد در ۸ mixin · ۱۵ نام `window.*` در `weekly.window-glue.js` ·
> سراسری‌های کل مخزن ۲۴۶ → ۲۴۶.

> 📉 `halls.service.js` (چاق‌ترین فایل مخزن: **۹۷.۶KB / ۲۴۲۴ خط / ۷۱ عضو سطح عمومی** = ۱ سازنده +
> ۷۰ متد + ۳۳ نام `window.*`) در **موج ۳.۲c** به ۸ mixin دامنه‌ای + «چسب پنجره» شکست و به
> **۲.۵KB / ۵۰ خط** رسید (−۹۷٪ حجم). بزرگ‌ترین فایل تولیدشده `halls.units.js`
> (۲۷.۲KB / ۵۷۳ خط / ۱۶ عضو) است و هیچ‌کدام از ۹ فایل تازه به آستانهٔ ۴۰KB نمی‌رسند؛ از این پس
> **`customer-info.html` (۹۷.۲KB)** بزرگ‌ترین فایل مخزن است. دیف سرویس: **۳۱ خط افزوده /
> ۲۴۰۵ خط حذف‌شده** (حجم فایل درست پیش از کامیت برش، یعنی پس از دو رفع باگ همین موج: ۹۸.۰KB)؛
> ۹ فایل جدید روی‌هم ۲۴۸۸ خط. حجم `src` از ۲.۴۰ به ۲.۴۱ MB رفت (+۱۶KB سربار
> سرصفحه/ایمپورت، نه کد تازه). اسنپ‌شات `docs/service-surface.json` عمداً بازتولید شد: ۷۱ عضو
> `prototype` = ۱ سازنده + ۷۰ متد در ۸ mixin · ۳۳ نام `window.*` در `halls.window-glue.js` ·
> سرویس‌های ثبت‌شده ۴۹ → ۵۰ · سراسری‌های کل مخزن ۲۴۶ → ۲۴۶.

> 📉 **موج ۳.۲d (برش بدنه، بدون تغییر فایل):** بدنِ چهار متد غول همین خوشه بیرون کشیده شد —
> `halls.report.js` (`generateHTML` ۴۵۰ → ۴۶ + ۷ قطعه: ۶ تابع و ثابت `REPORT_STYLE_BLOCK`)،
> `halls.renderer.js` (`renderHallInfo` ۲۵۴ → ۲۰ + ۵ تابع)، `halls.basic.js` (`saveBasicInfo`
> ۱۷۷ → ۶۵ + ۷ تابع) و `halls.units.js` (`renderUnitDetailsPanel` ۱۶۵ → ۲۲ + ۴ تابع).
> روی‌هم **۲۲ تابع کمکی + یک ثابت** ماژول‌محلی با نام صریح؛ هیچ عضو/`export` تازه‌ای ساخته نشد و
> هم سطح عمومی (`npm run test:halls:surface`: ۷۱ عضو · ۳۳ نام · ۱۷ ویژگی) و هم خروجی HTML
> (گارد طلایی `npm run test:halls:body`: ۱۳۶ بررسی · ۱۷ کِیس) بایت‌به‌بایت دست‌نخورده ماند.
> شرح: `docs/REVIEW-WAVE-3.md` بخش ۱۵.

> 📉 **موج ۳.۲e (برش بدنه، بدون تغییر فایل):** متد غول `renderFullReport` (بزرگ‌ترین متد مخزن،
> ۵۲۴ خط شامل چهار closure تودرتو) به ۱۳۹ خط رسید؛ کد بیرون‌کشیده‌شده در **۱۰ کمکی
> ماژول‌محلی** نشست: `buildMetricsTableHtml` · `toPersianDate` · `resolveFlockReportContext` ·
> `buildWeekDetailRows` · `buildFlockSectionHtml` · `buildGroupSectionHtml` ·
> `mergeReportSections` · `resolveReportContext` · `buildGroupsNoteHtml` · `buildGapsSummaryHtml`.
> خروجی HTML بایت‌به‌بایت ثابت است (گارد طلایی `npm run test:weekly:body`: ۶۷ بررسی · ۱۲ کِیس)
> و سطح عمومی هم دست‌نخورده (`audit:surface`: ۰ گم‌شده · ۰ افزوده · ۰ نقض). شمارش
> `audit:big-methods` از ۲۶ به **۲۵** رسید.

> 📉 **موج ۳.۲f (برش بدنه، بدون تغییر فایل):** دو متد غول خوشهٔ پایان دوره بیرون کشیده شدند:
> `completePeriod` (۲۷۸ → **۲۳** خط) و `editPeriodCompletion` (۳۶۵ → **۵۷** خط). ثابت‌ها و
> کمکی‌های ماژول‌محلی تازه (**۱۵** مورد): `UE_FORM_STYLE_BLOCK` · `CF_FORM_STYLE_BLOCK` ·
> `buildCompletionEditFormHtml` · `collectCompletionEditPayload` · `buildEditCompletionSwalOptions`
> · `applyCompletionEditResult` · `resolvePeriodForCompletion` · `buildCompletionFlockOptions` ·
> `buildPeriodCompletionInfoHtml` · `buildPeriodCompletionFormHtml` · `readSelectedPeriodFlocks` ·
> `validatePeriodCompletionSelection` · `collectPeriodCompletionPayload` ·
> `createCompletionSwalOptions` · `applyPeriodCompletionResult`. خروجی/رکورد بایت‌به‌بایت ثابت
> (گارد طلایی `npm run test:hatchery:body`: ۹۶ بررسی · ۲۲ کِیس · هش `sha256`) و سطح عمومی
> دست‌نخورده (`audit:surface`: ۰ گم‌شده · ۰ افزوده · ۰ نقض). شمارش `audit:big-methods` از ۲۵ به
> **۲۳** رسید.

> 📉 **موج ۳.۲g (برش بدنه، بدون تغییر فایل):** متد غول تاریخچهٔ هفتگی `buildWeeklyHistoryHTML`
> (۳۳۶ خط) به **۱۳۱** خط رسید. هفت کمکی/ثابت ماژول‌محلی تازه: `resolveHistoryReportContext` ·
> `fmtCountFa` · `toPersianShortDate` · `HISTORY_REPORT_STYLE_BLOCK` · `resolveHistoryFlockContext` ·
> `buildHistoryHallHtml` · `buildHistoryFlockSectionHtml`. خروجی HTML بایت‌به‌بایت ثابت است
> (گارد طلایی `npm run test:weekly:history:body`: ۵۷ بررسی · ۱۲ کِیس · هش `sha256`) و سطح عمومی
> دست‌نخورده (`audit:surface`: ۰ گم‌شده · ۰ افزوده · ۰ نقض). شمارش `audit:big-methods` از ۲۳ به
> **۲۲** رسید.

در **موج ۳.۲h** نوبت متد غول کارت‌های هفتگی رسید: `weeklyCardMethods.renderWeeks`
(`weekly.cards.js:92`) از **۳۰۴ به ۳۰ خط** رسید. کل سازندهٔ آیتم هفته — همان بلوک ~۲۷۳ خطی که در
`this._weekItemBuilders[flockId]` ذخیره و برای «نمایش بیشتر» هم استفاده می‌شود — به کمکی
ماژول‌محلی `buildWeekAccordionItemHtml(flockId, week)` منتقل شد (پارامترهای صریح، بدون `this`)
و در متد فقط یک پوستهٔ دو خطی ماند:
`this._weekItemBuilders[flockId] = (week) => buildWeekAccordionItemHtml(flockId, week);`
⇒ صفر تغییر بایت در خروجی HTML (گارد طلایی `npm run test:weekly:cards:body`: ۳۷ بررسی · ۸ کِیس
با هش `sha256` روی `{ html, items[], weeksShown, builderStored }`) و سطح عمومی دست‌نخورده
(`audit:surface`: ۰ گم‌شده · ۰ افزوده · ۰ نقض). شمارش `audit:big-methods` از ۲۲ به **۲۱** رسید.

#### بزرگ‌ترین متدهای باقی‌مانده (بودجهٔ ۱۵۰ خط)

۲۱ متد از بودجه بزرگ‌ترند؛ فهرست کامل با `npm run audit:big-methods`. پنج مورد اول:

| خطوط | مکان | نام |
| خطوط | مکان | نام |
| خطوط | مکان | نام |
| --- | --- | --- |
| ۲۳۹ | `dashboard/dashboard.sms.js:750` | `dashboardSmsMethods.refreshSmsStatus` |
| ۲۸۴ | `dashboard/dashboard.bookmarks.js:119` | `dashboardBookmarkMethods.showCreateBookmarkModal` |
| ۲۷۷ | `hatchery/hatchery.report.js:579` | `buildFlockSmsReportHTML` |
| ۲۴۹ | `chart-dashboard/chart-dashboard.renderer.js:8` | `chartDashboardRenderer.renderContainer` |
| ۲۴۲ | `weekly/weekly.renderer.js:889` | `weeklyRenderer.renderFlockReport` |
از `weekly.service.js` به `weekly.report.history.html.js` منتقل شد؛ `renderWeeks` (۳۰۴ خط) هم
برش فایل این دو «غول» را کوچک **نکرد**: `buildWeeklyHistoryHTML` همان ۳۳۶ خط است و فقط خانه‌اش
از `weekly.service.js` به `weekly.report.history.html.js` منتقل شد؛ `renderWeeks` (۳۰۴ خط) هم
به `weekly.cards.js` رفت. بزرگ‌ترین متد مخزن پس از موج ۳.۲h اکنون
`dashboardBookmarkMethods.showCreateBookmarkModal` (۲۸۴ خط) است —
چهار متد غول هفتگی/پایان دوره در موج‌های ۳.۲e/۳.۲f/۳.۲g/۳.۲h از فهرست بودجه بیرون رفتند.

در موج ۳.۲d چهار متد غول خوشهٔ سالن‌ها **برش بدنه** خوردند (نه جابه‌جایی فایل): `generateHTML`
۴۵۰ → ۴۶، `renderHallInfo` ۲۵۴ → ۲۰، `saveBasicInfo` ۱۷۷ → ۶۵ و `renderUnitDetailsPanel`
۱۶۵ → ۲۲ خط — ۲۲ تابع کمکی ماژول‌محلی، با گارد بایت‌به‌بایت `npm run test:halls:body` و بدون
تغییر یک عضو سطح عمومی. بهترین نامزد بعدی برای همین الگو: `weeklyRenderer.renderFullReport`
(۵۲۴ خط) و `hatcheryCompletionPeriodMethods.editPeriodCompletion` (۳۶۵ خط).

در موج ۳.۲e همین الگوی «برش بدنه» روی بزرگ‌ترین متد مخزن اجرا شد:
`weeklyRenderer.renderFullReport` (۵۲۴ → ۱۳۹ خط) با **۱۰ تابع کمکی ماژول‌محلی** و گارد طلایی
تازهٔ `npm run test:weekly:body` (۶۷ بررسی · ۱۲ کِیس · هش `sha256` خروجی). همین الگو در موج‌های
بعدی روی `buildWeeklyHistoryHTML` (موج ۳.۲g) و `weeklyCardMethods.renderWeeks` (موج ۳.۲h) هم
اجرا شد و هر سه از فهرست بودجه بیرون رفتند. نامزدهای باقی‌مانده:
`dashboardBookmarkMethods.showCreateBookmarkModal` (۲۸۴) · `buildFlockSmsReportHTML` (۲۷۷) ·
`chartDashboardRenderer.renderContainer` (۲۴۹). شرح: `docs/REVIEW-WAVE-3.md` بخش ۱۶ و ۱۸ و ۱۹.

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
2. ✅ **`weekly.service.js`** — در **موج ۳.۲b** به ۸ mixin دامنه‌ای شکست: `weekly.loading.js` (۸ عضو)،
   `weekly.flocks.js` (۱۳)، `weekly.cards.js` (۱۰)، `weekly.form.js` (۳)، `weekly.report.full.js` (۴)،
   `weekly.report.history.js` (۲)، `weekly.report.history.html.js` (۲)، `weekly.report.pickers.js` (۶)
   + `weekly.window-glue.js` (۱۵ نام `window.*`) ⇒ ۱۱۸.۶KB → ۲.۷KB با همان ۴۹ عضو سطح عمومی.
   گارد زمان اجرا `npm run test:weekly:surface` (۲۱ بررسی) اضافه شد. شرح: `docs/REVIEW-WAVE-3.md` بخش ۱۳.
3. ✅ **انجام‌شده در موج ۳.۲f:** سه متد بزرگ خوشهٔ پایان دوره برش بدنه خوردند —
   (`hatchery.completion.period.js:724`)، `completePeriod` ۲۷۸ خط و
   `_collectCompletionSave` ۲۰۳ خط (`hatchery.completion.flock.js:856`)؛ نیازمند
   تست رفتاری اختصاصی (شکستن بدنهٔ متد، نه جابه‌جایی متد).
4. ✅ **`halls.service.js`** — در **موج ۳.۲c** به ۸ mixin دامنه‌ای شکست: `halls.core.js` (۹ عضو)،
   `halls.tabs.js` (۶)، `halls.basic.js` (۹)، `halls.list.js` (۹)، `halls.edit-mode.js` (۷)،
   `halls.units.js` (۱۶)، `halls.systems.js` (۸)، `halls.forms.js` (۶) + `halls.window-glue.js`
   (۳۳ نام `window.*`) ⇒ ۹۷.۶KB → ۲.۵KB با همان ۷۱ عضو سطح عمومی. گارد زمان اجرا
   `npm run test:halls:surface` (۲۴ بررسی) اضافه شد. شرح: `docs/REVIEW-WAVE-3.md` بخش ۱۴.
   ✅ باقی‌ماندهٔ همین خوشه هم در **موج ۳.۲d** تمام شد (برش **بدنهٔ متد**، نه فایل):
   `generateHTML` ۴۵۰ → ۴۶ (`halls.report.js`)، `renderHallInfo` ۲۵۴ → ۲۰ (`halls.renderer.js`)،
   `saveBasicInfo` ۱۷۷ → ۶۵ (`halls.basic.js`) و `renderUnitDetailsPanel` ۱۶۵ → ۲۲
   (`halls.units.js`) — ۲۲ تابع کمکی ماژول‌محلی، صفر تغییر در سطح عمومی و صفر تغییر بایت در
   خروجی (گارد `npm run test:halls:body`). شرح: `docs/REVIEW-WAVE-3.md` بخش ۱۵.
   **`chart-dashboard.service.js` (۷۱.۴KB)** همچنان دست‌نخورده است: `renderAllCharts` ۲۲۳ خط
   (`chart-dashboard.service.js:1385`) و `renderContainer` ۲۴۹ خط (`chart-dashboard.renderer.js:8`).
5. **`customer-info.html` (۹۷.۲KB)** — بزرگ‌ترین فایل مخزن پس از موج ۳.۲c؛ صفحهٔ چاق؛ انتقال هندلرهای inline به «چسب پنجره»
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

10. **برش بدنهٔ متدهای غول (فاز بعد از برش فایل)** — سه نامزد اول این فهرست تمام شدند:
    `weeklyRenderer.renderFullReport` ۵۲۴ → ۱۳۹ (`weekly.renderer.js`، موج ۳.۲e) ·
    `buildWeeklyHistoryHTML` ۳۳۶ → ۱۳۱ (`weekly.report.history.html.js`، موج ۳.۲g) ·
    `weeklyCardMethods.renderWeeks` ۳۰۴ → ۳۰ (`weekly.cards.js`، موج ۳.۲h). هر سه برش **بدنهٔ
    متد** (نه جابه‌جایی فایل) بودند و هر سه گارد طلایی بایت‌به‌بایت گرفتند: `test:weekly:body` ·
    `test:weekly:history:body` · `test:weekly:cards:body`. نامزدهای باقی‌مانده با
    `npm run audit:big-methods`: `dashboardBookmarkMethods.showCreateBookmarkModal` (۲۸۴) ·
    `buildFlockSmsReportHTML` (۲۷۷) · `chartDashboardRenderer.renderContainer` (۲۴۹).

## قواعد نگه‌داری

- **هرگز** فایل صفر‌بایتی اضافه نکنید؛ `npm run audit:size -- --fail-on-empty` را در CI بگذارید.
- برای فایل جدید `src/features/...`، حتماً مصرف‌کنندهٔ آن (import یا `<script src>`) مشخص باشد.
- فایل‌های بزرگ‌تر از ۴۰KB فقط با برنامهٔ شکستن (issue) بزرگ‌تر شوند.
- **قبل و بعد از هر جابه‌جایی/شکستن، `npm run audit:surface` را اجرا کنید**؛ اگر «گم‌شده»
  گزارش داد، جابه‌جایی ناقص است. متدهای منتقل‌شده به mixin هم توسط همین ابزار شناخته می‌شوند.
- برای برش فایل‌های چاق، **اسکریپت مهاجرت + گیت اثبات** بنویسید (الگو: موج‌های ۳.۲a/۳.۲b/۳.۲c در
  `docs/REVIEW-WAVE-3.md` بخش‌های ۱۲/۱۳/۱۴ — نسخهٔ تکامل‌یافتهٔ الگوی بخش ۳): برش بر اساس **آفست
  بایت** (نه شمارهٔ خط/جست‌وجوی متنی)، اثبات `concat(قطعات) === ناحیهٔ اصلی`، گارد «حذف
  تصادفی `export`»، پاسخ‌گویی **AST (espree)** به «آیا هر عضو به mixin درست منتقل شده؟»،
  هرس ایمپورت‌های بی‌مصرف سرویس، و EOL یکدست. اگر mixinها **شیء سادهٔ متدی** باشند
  (الگوی هفتگی)، سرویس فقط `Object.assign` می‌کند و اثبات باید `git show pre-wave-3.2b:<file>`
  را کلمه‌به‌کلمه با دیسک مقایسه کند. در موج ۳.۲c این اثبات سخت‌تر شد: گیت‌های خودِ اسکریپت
  بررسی می‌کنند که «منبع روی دیسک == بلاب تگ `pre-wave-3.2c` + دو ناحیهٔ رفع باگ مستند،
  بایت‌به‌بایت» و «concat(قطعات) == ناحیهٔ برش‌شده» — یعنی اثبات به خود ابزار منتقل شد، نه به
  چشم بازبین. اسکریپت موقت را پس از تأیید حذف کنید تا در `src` نماند
  (وگرنه `audit:dead-exports`/`audit:size` را آلوده می‌کند).
- پس از هر شکستن mixin، **حجم/متد فایل‌های جدید** را در جدول‌های بالای همین سند به‌روز کنید.
- برای سرویس‌های وابسته به DOM، **گارد زمان اجرا** را هم اجرا کنید
  (`npm run test:hatchery-surface` · `npm run test:dashboard-surface` · `npm run test:weekly:surface` ·
  `npm run test:halls:surface`)؛
  این تست‌ها ماژول را واقعاً با استاب `window`/`document`/`localStorage` import می‌کنند و سطح
  عمومی را با `docs/service-surface.json` مقایسه می‌کنند، پس هم «گم‌شدن بی‌صدای عضو» را
  می‌گیرند و هم «بزرگ‌شدن ناخواستهٔ سطح عمومی» را. برای سرویس بعدی همین الگو را تکرار کنید:
  استاب حداقلی + مقایسه با همان اسنپ‌شات قرارداد + یک اسکریپت npm.

