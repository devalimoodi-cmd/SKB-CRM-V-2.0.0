# گزارش بازبینی (Review) — موج ۲: شکستن «کلاس‌های غول»

برنچ: `chore/wave-2-split-god-classes` — تگ نقطهٔ بازگشت: `pre-wave-2` (روی `a6e69e9`)
اصل حاکم مثل موج‌های ۰ و ۱: **بدون تغییر رفتار** (behavior-preserving).
هر تغییری که کاربر در UI حس می‌کند در بخش «تغییرات رفتاری آگاهانه» فهرست می‌شود.

> ⚠️ نتیجهٔ این موج در بخش ۵: **هیچ تغییر رفتاری وجود ندارد** — نه یک نام
> `window.*`، نه یک متد، نه یک ویژگی نمونه کم یا زیاد نشده است.

---

## ۱) مسأله (چرا این موج؟)

پس از موج ۰ و ۱، بزرگ‌ترین فایل پروژه `Frontend/src/features/customer-info/
sections/hatchery/hatchery.service.js` بود:

| شاخص (پیش از موج ۲) | مقدار |
| --- | --- |
| حجم | ۲۰۸٬۸۹۶ بایت (۲۰۴.۰ KB) |
| خطوط | ۴۷۷۲ |
| متدها | ۱۰۰ متد + `constructor` = ۱۰۱ عضو سطح کلاس |
| سهم از کل `src` | ≈ ۸.۶٪ |

سه مشکل واقعی این فایل (نه فقط «زیادی بزرگ بودن»):

1. **خوشهٔ بی‌ربط با دامنه:** ۱۱۷ خط انتهای فایل هیچ منطق دامنه‌ای نداشت و فقط
   نام‌های سراسری `window.*` (هندلرهای inline HTML) را ثبت می‌کرد.
2. **دو نیمهٔ کاملاً جدا در یک فایل:** ۳۹ متد (~۲۳۰۵ خط، ≈۴۸٪ فایل) فقط به
   «پایان دورهٔ گله/ویرایش پایان گله» مربوط بودند و برخلاف بقیهٔ کلاس، به ماژول‌های
   رندر/فرم/تب وابستگی نداشتند.
3. **نبود گارد:** هیچ ابزاری وجود نداشت که تضمین کند حین جابه‌جایی، سطح عمومی
   سرویس (متدها/ویژگی‌های نمونه و سراسری‌های `window`) تغییر نمی‌کند.

---

## ۲) موج ۲.۰ — دروازهٔ «قرارداد سطح سرویس» (ابزار + اسنپ‌شات)

ابزار جدید و فقط‌خواندنی:

```bash
cd Frontend
npm run audit:surface          # مقایسه با اسنپ‌شات؛ کد خروج ۱ اگر عضوی گم شود
npm run audit:surface -- --snapshot   # به‌روزرسانی عمدی اسنپ‌شات
npm run audit:big-methods      # فهرست متدهای بزرگ‌تر از بودجهٔ ۱۵۰ خط
```

فایل‌های جدید:

| فایل | نقش |
| --- | --- |
| `Frontend/scripts/audit-service-surface.mjs` | استخراج سطح عمومی سرویس‌ها + گارد |
| `docs/service-surface.json` | اسنپ‌شات قرارداد (نسخهٔ `pre-wave-2` آن در کامیت `3e1ab35` محفوظ است) |

سه چیزی که این دروازه می‌گیرد:

1. **گم‌شدن عضو** — هر سرویس/نمونه/متد/ویژگی/سراسری `window` که در اسنپ‌شات
   هست و در کد دیگر نیست ⇒ خطا با کد خروج ۱ (مناسب CI).
2. **نقض قرارداد فراخوانی از بیرون فایل** — اگر فایلی `someService.foo()` را
   صدا بزند و `foo` در فایل صاحب سرویس نباشد ⇒ خطا (این‌گونه باگ‌ها فقط در
   زمان اجرا در مرورگر دیده می‌شوند).
3. **متدهای بزرگ‌تر از بودجه** — فهرست اطلاعی برای موج‌های بعدی (پشتیبانی از mixin).

---

## ۳) موج ۲.۱ — استخراج «چسب پنجره» به `hatchery.window-glue.js`

فایل جدید: `Frontend/src/features/customer-info/sections/hatchery/hatchery.window-glue.js`
(۱۳۸ خط = ۱۱۷ خط چسب + سرصفحه/پوشش)

```js
export const registerHatcheryWindowGlue = ({ hatcheryService, HatcheryService, hatcheryFormService }) => {
  if (typeof window === "undefined") return;
  window.hatcheryService = hatcheryService;
  // ... ۵۶ تخصیص دیگر window.*
};
```

و در انتهای `hatchery.service.js`:

```js
export const hatcheryService = new HatcheryService();

// ===== چسب پنجره (window.*) — منتقل‌شده به hatchery.window-glue.js (موج ۲) =====
registerHatcheryWindowGlue({ hatcheryService, HatcheryService, hatcheryFormService });
```

**چرا «تابع ثبت» و نه اجرای مستقیم (top-level)؟** چون چسب به نمونهٔ ساخته‌شدهٔ
`hatcheryService` نیاز دارد؛ اگر ماژول چسب در زمان import اجرا می‌شد، ترتیب
evaluation ماژول‌ها می‌توانست قبل از `new HatcheryService()` آن را اجرا کند.
با الگوی «export تابع + فراخوانی صریح بعد از ساخت نمونه»، رفتار قبلی (که همین
تخصیص‌ها در انتهای همان فایل و بعد از ساخت نمونه انجام می‌شد) **عیناً** حفظ می‌شود.

**تضمین بدون تغییر رفتار:**

- تمام ۵۷ تخصیص `window.*` با همان نام و همان بدنه منتقل شد.
- اسکریپت مهاجرت، بدنه را خط‌به‌خط با نسخهٔ قبلی مقایسه کرد:
  `oldBody=117 newBody=117 identical=true` (خروجی همان اجرا در بخش ۷ مستند است).
- وابستگی `notificationService` (برای مسیرهای `print*Report`) هم منتقل شد.
- یک تفاوت آگاهانه در ظرف: `if (typeof window !== "undefined") { ... }` به
  `if (typeof window === "undefined") return;` داخل تابع تبدیل شد — نتیجهٔ اجرایی
  در مرورگر و در محیط بدون `window` یکسان است.

سود جانبی: فایل سرویس از ۲۰۸.۹KB به ۲۰۲.۹KB رسید و دیگر هیچ تخصیص
`window.*` داخل کلاس سرویس نیست (`remainingWindowAssignInService=0`).

---

## ۴) موج ۲.۲ — استخراج خوشهٔ «پایان دوره/ویرایش» به mixin

فایل جدید: `Frontend/src/features/customer-info/sections/hatchery/hatchery.completion.service.js`
(۲۳۳۲ خط، ۱۰۹.۸KB، ۳۹ متد)

```js
// در hatchery.service.js — قبل از ساخت نمونه
Object.assign(HatcheryService.prototype, hatcheryCompletionMethods);
export const hatcheryService = new HatcheryService();
```

**چرا mixin و نه subclass یا کلاس جدید؟**

- کلاس جدید یعنی `class CompletionService { ... }` + تزریق وابستگی؛ ولی این
  ۳۹ متد با `this.*` روی **همان نمونهٔ سرویس** کار می‌کنند (state، `#`-فیلد،
  هالپرهای خصوصی و متدهای کلاس اصلی) — جداسازی واقعی نیازمند بازنویسی صداها بود
  که با اصل «بدون تغییر رفتار» در تضاد است.
- تعدادی از متدها از بیرون با نام سراسری `window.*` صدا زده می‌شوند
  (`window.editPeriodCompletion`, `window.completePeriod`, ...)؛ چون این متدها
  روی `prototype` کلاس اصلی می‌نشینند، همهٔ آن مسیرها بدون تغییر کار می‌کنند.
- mixin مستقیماً **قبل از** `new HatcheryService()` ترکیب می‌شود، پس هیچ نمونه‌ای
  بدون این متدها ساخته نمی‌شود.

**تضمین بدون تغییر رفتار:**

- متن متدها کلمه‌به‌کلمه منتقل شد؛ تنها تغییر، افزودن ویرگولِ لازم برای تبدیل
  «متد کلاس» به «عضو شیء literal» است. اسکریپت مهاجرت این را هم بررسی کرد
  (شمارش ۳۹ متد = ۳۹ پایان‌آکولاد سطح کلاس) و هم تطابق خط‌به‌خط را:
  `cluster=2305 identical=true`.
- وابستگی‌ها فقط ۵ نماد هستند: `hatcheryApi`، `notificationService`،
  `convertPersianToGregorian`، `convertToPersianDate`، `formatSlaughterRange`،
  `formatAgeRange` — هیچ وابستگی به `hatcheryRenderer`/`hatcheryFormService`/
  `hatcheryTabsService`/`stateService` وجود ندارد (با شمارش واقعی در خوشه تأیید شد).
- سرآیند import در فایل سرویس حالا متد mixin را می‌آورد:
  `import { hatcheryCompletionMethods } from "./hatchery.completion.service.js";`

### نتیجهٔ عددی موج ۲

| فایل | پیش از موج ۲ | پس از موج ۲ | Δ |
| --- | --- | --- | --- |
| `hatchery.service.js` | ۴۷۷۲ خط · ۲۰۴.۰ KB | ۲۳۵۹ خط · ۹۵.۱ KB | −۵۴٪ حجم، −۲۴۱۳ خط |
| `hatchery.completion.service.js` | — | ۲۳۳۲ خط · ۱۰۹.۸ KB | جدید (۳۹ متد) |
| `hatchery.window-glue.js` | — | ۱۳۸ خط · ۷.۳ KB | جدید (۵۷ تخصیص window) |


نکتهٔ فنی مهم: اسکریپت **mixin** را می‌فهمد. وقتی متدی در فایل سرویس نیست ولی
در شیء mixin که روی `prototype` ترکیب می‌شود وجود دارد، آن را «موجود» می‌شمارد
(و ویژگی‌های mixin را به سطح نمونه اضافه می‌کند) — به همین دلیل تقسیم موج ۲.۲
یک «گم‌شدن متد» ایجاد نکرد.

---

## ۵) تغییرات رفتاری آگاهانه

**هیچ.** این موج صرفاً جابه‌جایی مکانیکی کد است:

| چه چیزی بررسی شد | نتیجه |
| --- | --- |
| متدهای نمونهٔ `hatcheryService` | ۱۰۱ عضو پیش و پس از موج (۶۱ متد کلاس + ۳۹ متد mixin + `constructor`) |
| نام‌های سراسری `window.*` | همهٔ ۵۷ نام چسب پنجره با همان بدنه ثبت می‌شوند |
| مسیرهای صدا زده‌شده با `?.` | فقط یک مورد از قبل موجود (بخش ۶) — دست‌نخورده |
| import/export عمومی ماژول‌ها | دو ماژول جدید اضافه شد؛ هیچ export حذف نشد |
| تعداد متدهای بزرگ‌تر از بودجه | ۳۰ (پیش و پس یکسان — فهرست در بخش ۷) |

تنها «تغییر» قابل مشاهده: دو فایل جدید در پوشهٔ `sections/hatchery/` که هیچ
صفحه‌ای آن‌ها را مستقیم `<script src>` نمی‌کند و فقط با `import` مصرف می‌شوند
(پس دوباره‌سازی singleton رخ نمی‌دهد).

---

## ۶) یافته‌های بازبینی موج ۲

### P2 — باگ منطقی کشف‌شده توسط دروازهٔ جدید (از قبلِ موج ۲ وجود داشت)

**P2-۱. فراخوانی اختیاری به متدی که هرگز وجود نداشته**
`hatchery.window-glue.js:38` → `window.viewPeriod = (id) => hatcheryService.viewPeriod?.(id);`
هیچ متدی با نام `viewPeriod` نه در کلاس `HatcheryService` و نه در mixin جدید وجود
ندارد (پیش از موج ۲ هم نداشت). چون با `?.` صدا زده می‌شود، خطایی رخ نمی‌دهد و
صرفاً «هیچ» اتفاق نمی‌افتد ⇒ دکمهٔ مشاهدهٔ ردیف دوره در جدول مدیریت جوجه‌ریزی
بی‌اثر است. **در این موج عمداً دست‌نخورده ماند** (اصل عدم تغییر رفتار) و به موج ۳
منتقل شد: یا `viewPeriod` پیاده‌سازی شود یا نام تابع در HTML اصلاح/حذف شود.

> 💡 ارزش ابزار: این یافته فقط با تحلیل استاتیک قرارداد سرویس پیدا شد؛ در مرورگر
> هیچ خطای کنسولی تولید نمی‌کند و با تست دستی هم به‌سختی دیده می‌شود.

### P1 — باقی‌مانده از موج‌های قبل (بدون تغییر)

- **خوشهٔ SMS بی‌مصرف + روت‌های `/sms`** که به فایل ناموجود اشاره می‌کنند
  (شرح کامل در `docs/REVIEW.md` بخش ۴ — `P1-۱` و `P1-۲`).
- **۷۱ export بدون ارجاع بیرونی** در فرانت (بیشترشان توابع کمکی `dom/number/form/
  string.utils.js`) و **۳ فایل js بی‌ارجاع** — بدون تغییر نسبت به موج ۰ و ۱.

### متدهای باقی‌ماندهٔ بزرگ (بودجهٔ ۱۵۰ خط)

۳۰ متد از بودجه بزرگ‌ترند و بزرگ‌ترین‌شان این‌هاست (فهرست کامل:
`npm run audit:big-methods`):

| خطوط | مکان | نام |
| --- | --- | --- |
| ۵۲۴ | `weekly/weekly.renderer.js:746` | `weeklyRenderer.renderFullReport` |
| ۴۵۰ | `hall-management/halls.report.js:491` | `generateHTML` |
| ۳۶۵ | `hatchery/hatchery.completion.service.js:1918` | `hatcheryCompletionMethods.editPeriodCompletion` |
| ۳۳۶ | `weekly/weekly.service.js:2487` | `buildWeeklyHistoryHTML` |
| ۲۷۸ | `hatchery/hatchery.completion.service.js:1490` | `hatcheryCompletionMethods.completePeriod` |

---

## ۷) شواهد تأیید نهایی (اجرای واقعی روی همین برنچ)

### الف) دروازه‌های خودکار — همه سبز ✅

| بررسی | فرمان | نتیجه |
| --- | --- | --- |
| ESLint | `cd Frontend; npm run lint` | exit=0، بدون خطا و هشدار |
| ۱۰ تست فرانت | `npm run test:cache` … `npm run test:hatchery-utils` | همه exit=0 (`ALL PASS`) |
| گارد قرارداد سطح سرویس | `npm run audit:surface` | گم‌شده ۰ · افزوده ۰ · نقض قرارداد ۰ · اطلاعی ۱ |
| فایل‌های صفر‌بایتی و بزرگ | `npm run audit:size -- --fail-on-empty` | ۰ فایل صفر‌بایتی (۱۴۵ فایل اسکن‌شده · ۲.۳۷ MB) |
| متدهای بزرگ‌تر از بودجه | `npm run audit:big-methods` | exit=0 (۳۰ متد — فقط اطلاعی) |
| کد مرده | `npm run audit:dead-exports` | ۷۱ export بی‌ارجاع · ۳ فایل بی‌ارجاع (بدون تغییر) |

### ب) شاهد «انتقال کلمه‌به‌کلمه» (خروجی اسکریپت‌های مهاجرت)

```text
موج ۲.۱ → oldBody=117 newBody=117 identical=true closing=};  remainingWindowAssignInService=0
موج ۲.۲ → methods=39 commas=39 cluster=2305 mixin=2333 identical=true
          serviceBefore=4661 serviceAfter=2361
```

### ج) اسموک‌تست زمان اجرا (Node + DOM استاب حداقلی)

```text
imported=ok instanceProto=ok missingMethods=[]
protoMethodCount=101
missingWindowGlue=[]
hasRefresh=true hasLoadData=true
```

- `protoMethodCount=101` یعنی نمونهٔ نهایی پس از ترکیب mixin دقیقاً همان ۱۰۱ عضو
  پیش از موج ۲ را دارد ⇒ نه متدی گم شده، نه متدی اضافه شده است.
- `missingMethods=[]` برای متدهای کلیدی خوشه (`_toNum`, `viewPeriodCompletion`,
  `editPeriodCompletion`, `recomputeSystemFields`, `completePeriod`,
  `loadAllPeriodsList`) ⇒ mixin واقعاً روی prototype نشسته است.
- `missingWindowGlue=[]` یعنی نام‌های سراسری مورد انتظار (`hatcheryService`,
  `refreshHatcheryManagement`, `editPeriodCompletion`, `printFlockCompletionReport`,
  `deleteHygieneRecord`) روی `window` ثبت شده‌اند.

### د) دو اصلاح لازم که خودِ دروازه‌ها کشف کردند (شفافیت)

۱. **حذف ناخواستهٔ خط export نمونه:** در اجرای اول ۲.۲، عملیات جایگذاری، خط
   `export const hatcheryService = new HatcheryService();` را بلعید. ESLint
   (`no-undef` روی `hatcheryService`) و گارد قرارداد (`گم‌شده → نمونه ۱`) هر دو
   بلافاصله خطا دادند. اصلاح: لنگر، در خروجی هم بازنویسی می‌شود + `assert` جدید
   در اسکریپت مهاجرت.
۲. **لنگر مبهم خوشه:** سرآیند انتخابی با خط مشابه `// ===== پایان گله فعال =====`
   (خط ۱۲۸۵) اشتباه گرفته شد و برش غلط رخ داد. با `git checkout --` بازگردانی شد و
   لنگر یکتا (`مودال جامع`) + `assert` یکتایی جایگزین گردید.

هر دو خطا **پیش از هر کامیتی** کشف و رفع شدند؛ وضعیت نهایی در بخش‌های (ب) و (ج)
مستند است. (به همین دلیل این موج ۴ کامیت کوچک دارد، نه یک کامیت غول.)

---

## ۸) دروازهٔ PR این موج

```bash
cd Frontend
npm run lint
npm run test:cache && npm run test:denied && npm run test:toast
npm run test:weekly && npm run test:weekly:report && npm run test:weekly:groups
npm run test:weekly:history && npm run test:customer-fields && npm run test:customer-detail
npm run test:hatchery-utils
npm run audit:surface            # اگر عضو گم شود، exit=1
npm run audit:size -- --fail-on-empty
npm run audit:big-methods
npm run audit:dead-exports
```

آزمون دستی دود (نقاطی که این موج دست زده است):

- `/customer-info` → تب **مدیریت جوجه‌ریزی** → مودال جامع «پایان گله»:
  باز شدن، ذخیره، «محاسبهٔ مجدد فیلدهای سیستمی»، کشتار (روش/محموله‌ها)، چاپ گزارش.
- `/customer-info` → تب **پریودها**: باز کردن، ویرایش پایان دوره، تکمیل دوره.
- `/customer-info` → تب **بهداشت**: مشاهده/ویرایش/حذف رکورد (مسیر چسب پنجره).

انتظار: بدون خطای کنسول و با **همان** رفتار پیش از موج.

---

## ۹) گام بعدی (پیشنهاد موج ۳)

| اولویت | هدف | چرا |
| --- | --- | --- |
| ۱ | شکستن `hatchery.completion.service.js` (۱۰۹.۸KB) به سه mixin بر اساس دامنه | خودِ خوشه هنوز بزرگ است: `editPeriodCompletion` ۳۶۵ خط · `_collectCompletionSave` ۲۰۳ خط · `completePeriod` ۲۷۸ خط |
| ۲ | `dashboard.service.js` (۱۵۷.۴KB) — بزرگ‌ترین فایل باقی‌مانده | مودال بوکمارک (`showCreateBookmarkModal` ۲۸۴ خط، `showBookmarkDetail` ۱۵۰) و پیامک (`refreshSmsStatus` ۲۳۹) با همان الگوی mixin |
| ۳ | `weekly.service.js` (۱۱۸.۶KB) | رندر و محاسبات در یک فایل: `buildWeeklyHistoryHTML` ۳۳۶ خط، `renderWeeks` ۳۰۴ خط |
| ۴ | `halls.service.js` (۹۷.۶KB) و `chart-dashboard.service.js` (۷۱.۴KB) | `saveBasicInfo` ۱۷۷ خط، `renderUnitDetailsPanel` ۱۶۵ خط، `renderAllCharts` ۲۲۳ خط |
| ۵ | نازک‌کردن `customer-info.html` (۹۵.۹KB) | انتقال هندلرهای inline به «چسب پنجره» — همان الگوی موج ۲.۱ |
| ۶ | تسویه‌ها | باگ `viewPeriod` (P2-۱)، تصمیم دربارهٔ ۷۱ export بی‌مصرف، خوشهٔ SMS و روت‌های `/sms` |

> 🧭 سیاست موج ۳: همان اصل «بدون تغییر رفتار» + اجرای `npm run audit:surface`
> قبل و بعد از هر گام. اگر اسنپ‌شات فعلی «گم‌شده» گزارش داد، یعنی جابه‌جایی
> ناقص بوده و باید متوقف شود.


