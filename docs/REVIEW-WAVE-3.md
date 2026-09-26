# گزارش بازبینی (Review) — موج ۳.۱: شکستن mixin «خوشهٔ پایان دوره» به سه دامنه

برنچ: `chore/wave-3-split-god-classes` — تگ نقطهٔ بازگشت: `pre-wave-3` (روی `8397758`)
اصل حاکم مثل موج‌های ۰، ۱ و ۲: **بدون تغییر رفتار** (behavior-preserving).

> ⚠️ نتیجهٔ این موج در بخش ۵: **هیچ تغییر رفتاری وجود ندارد** — نه یک متد، نه یک نام
> `window.*`، نه یک ویژگی نمونه. متن متدها **کلمه‌به‌کلمه (byte-for-byte)** منتقل شده؛
> حتی یک ویرگول هم تغییر نکرده است.

---

## ۱) مسأله (چرا این موج؟)

موج ۲ خوشهٔ «پایان دوره/ویرایش» را از `hatchery.service.js` بیرون کشید، اما **خودِ خوشه**
دست‌نخورده در یک فایل ماند:

| شاخص (پیش از موج ۳.۱) | مقدار |
| --- | --- |
| فایل | `hatchery/hatchery.completion.service.js` |
| حجم | ۱۰۹.۸ KB (۲۳۳۲ خط، CRLF) |
| متدها | ۳۹ متد — همه از یک `Object.assign` روی `prototype` می‌آمدند |
| سهم از کل `src` فرانت | ≈ ۴.۵٪ (از ۲.۳۷ MB) |

مشکل «بزرگ بودن» نبود؛ **بی‌ربط بودن دو دامنه در یک فایل** بود:

1. **دو خوشهٔ متفاوت:** خوشهٔ `pc_*` (مودال «پایان گله» + ذخیرهٔ اطلاعات کشتار) و خوشهٔ
   `ue_*` (پایان/مشاهده/ویرایش پایان **پریود** که روی همهٔ گله‌های دوره کار می‌کند).
2. **هستهٔ مشترک پنهان:** ۵ متد کوچک `_toNum` و `_pcDateIso`/`_pcFlockIso`/
   `_pcAgeOfIso`/`_pcIsoFromAge` بین دو خوشه مشترک بودند و همین باعث می‌شد برش
   سادهٔ فایل به دو نیمه، یک وابستگی ضمنی بین دامنه‌ها بسازد.
3. **باگ‌های موج ۲:** دو خطای واقعی (لنگر مبهم و حذف ناخواستهٔ `export`) نشان داد
   جابه‌جایی باید **اثبات‌شده** باشد، نه «چشم‌محور».

---

## ۲) پارتیشن (نقشهٔ سه فایل)

برش بر اساس **دامنه** (و با احترام به هستهٔ مشترک) انجام شد؛ هر فایل یک mixin مستقل است:

| فایل جدید | mixin | متد | خط (بدنه) | حجم | دامنه |
| --- | --- | --- | --- | --- | --- |
| `hatchery.completion.age.utils.js` | `hatcheryCompletionAgeMethods` | ۵ | ۵۷ | ۲.۸ KB | هستهٔ مشترک عدد/تاریخ/سن |
| `hatchery.completion.flock.js` | `hatcheryCompletionFlockMethods` | ۲۳ | ۱۱۳۰ | ۵۴.۲ KB | مودال و ذخیرهٔ «پایان گله» |
| `hatchery.completion.period.js` | `hatcheryCompletionPeriodMethods` | ۱۱ | ۱۱۱۴ | ۵۴.۶ KB | پایان/مشاهده/ویرایش پایان پریود |

- `age.utils` (۵ متد): `_toNum`, `_pcDateIso`, `_pcFlockIso`, `_pcAgeOfIso`, `_pcIsoFromAge`
- `flock` (۲۳ متد): خوشهٔ `pc_*` شامل `completeFlockOf`, `editFlockCompletion`,
  `_collectCompletionSave`, `_openFlockCompletionModal`, `recalcCompletionInputs`,
  `formatTomanInput`, `refreshFlocks` و کل رندر فرم کشتار.
- `period` (۱۱ متد): خوشهٔ `ue_*` شامل `completePeriod`, `viewPeriodCompletion`,
  `editPeriodCompletion`, `recomputeSystemFields` و سری
  `setUeSlaughterMethod`/`addUeShipRow`.

جمع: ۵ + ۲۳ + ۱۱ = **۳۹ متد** و ۵۷ + ۱۱۳۰ + ۱۱۱۴ = **۲۳۰۱ خط بدنه**؛ به‌علاوهٔ
۲ خط جداکنندهٔ خالی (پایان دو گروه) و ۲ خط پیش‌گفتار = **۲۳۰۵ خط ناحیهٔ آبجکت مبدأ**
(خطوط `export const ... = {` و `};` جدا از این شمارش‌اند). تفصیل در بخش ۳.

**چرا سه فایل و نه دو؟** چون اگر `age.utils` جدا نمی‌شد، `period` به `flock` وابستهٔ
ضمنی می‌شد و شکستن بعدی هر یک از این دو، دیگری را می‌شکست. با این تفکیک، هر سه فایل
مستقل‌اند و تنها ارتباط‌شان، روش‌های `this._pc*` است که روی همان `prototype` می‌نشینند.

---

## ۳) روش اجرا — اسکریپت مهاجرت با ۱۲ گیت اثبات

`Frontend/_3_1_split.mjs` (ابزار موقت؛ پس از تأیید حذف شد) جای «جابه‌جایی دستی» را گرفت.
هیچ فایلی **قبل از پاس‌شدن همهٔ گیت‌ها** نوشته یا حذف نمی‌شود:

1. مرزهای متدها از روی **شمارهٔ خط** پیدا می‌شود (نه جست‌وجوی متنی) → بی‌اثر بودن
   کامنت‌های مشابه (باگ لنگر تکراری در موج ۲).
2. پوشش کامل ناحیهٔ آبجکت: `Σ قطعات + پیش‌گفتار = خطوط ناحیه`.
3. «پیش‌گفتار» (خطوط قبل از اولین متد) فقط **کامنت یا خالی** باشد (نه کد).
4. `concat(قطعات) === متن اصلی ناحیه` — اثبات انتقال **بایت‌به‌بایت**.
5. یکتا بودن ۳۹ نام متد در مبدأ.
6. فهرست گروه‌ها = دقیقاً همان ۳۹ نام یکتای مبدأ (بدون کم/زیاد).
7. هر متد در خروجی‌ها **دقیقاً یک‌بار** ظاهر شود.
8. `body هر فایل === concat کلمه‌به‌کلمهٔ قطعات همان فایل`.
9. هیچ فایل تولیدی `\n` بدون `\r` نداشته باشد (EOL یکدست CRLF، مطابق بقیهٔ مخزن).
10. هر لنگر در `hatchery.service.js` **دقیقاً یک‌بار** وجود داشته باشد (هم import قدیم،
    هم `Object.assign` قدیم به‌همراه دو خط کامنت بالای آن).
11. گارد «حذف تصادفی»: پس از جای‌گذاری، `export const hatcheryService = new HatcheryService();`
    و `registerHatcheryWindowGlue({` موجود باشند (باگ موج ۲) و delta خطوط `+۳` باشد.
12. حذف فایل قدیم **فقط** بعد از پاس‌شدن ۱۱ گیت بالا.

خروجی اجرا (شاهد واقعی):

```text
preamble = 2 خط غیرمتدی (کامنت/خالی) که به هدر فایل‌ها منتقل می‌شود:
   |  // ===== مودال جامع «پایان گله» =====
   |
EOL=CRLF
regionLines=2305  methods=39
hatchery.completion.age.utils.js        methods=  5  lines=   74  bytes=   2906
hatchery.completion.flock.js            methods= 23  lines= 1150  bytes=  55513
hatchery.completion.period.js           methods= 11  lines= 1138  bytes=  55896
serviceLines=2362  sourceRemoved=true
ALL GATES PASSED ✅
```

`preamble` تنها دو خط ناحیه است که متد نیستند: یک کامنت بخش‌بندی
(`// ===== مودال جامع «پایان گله» =====`) و یک خط خالی. محتوای معنایی همین کامنت در
سرصفحهٔ `hatchery.completion.flock.js` («پایان/ویرایش پایان یک گله (مودال جامع pc_*)»)
حفظ شده است؛ هیچ کد یا متدی در این دو خط نبود.

---

## ۴) تغییرات فایل‌ها

### الف) سه فایل جدید (mixin دامنه‌ای)

هر فایل: سرصفحهٔ توضیحی (دامنه/حجم/وابستگی‌ها) + ایمپورت‌های **حداقلی** + یک
`export const ... = { ... }`. ایمپورت‌ها به‌صورت خودکار از متن خودِ متدها استخراج شد،
پس هیچ ایمپورت بی‌مصرفی (خطای lint) اضافه نشد.

### ب) `hatchery.service.js` — یک import به سه import

```diff
-import { hatcheryCompletionMethods } from "./hatchery.completion.service.js";
+import { hatcheryCompletionAgeMethods } from "./hatchery.completion.age.utils.js";
+import { hatcheryCompletionFlockMethods } from "./hatchery.completion.flock.js";
+import { hatcheryCompletionPeriodMethods } from "./hatchery.completion.period.js";
```

### ج) `hatchery.service.js` — یک `Object.assign` به سه `Object.assign`

```diff
-// ===== ترکیب mixin خوشهٔ پایان دوره/ویرایش (موج ۲ — منتقل‌شده به
-// hatchery.completion.service.js) =====
-Object.assign(HatcheryService.prototype, hatcheryCompletionMethods);
+// ===== ترکیب mixin های خوشهٔ پایان دوره/ویرایش (موج ۳.۱ — سه دامنهٔ مستقل) =====
+Object.assign(HatcheryService.prototype, hatcheryCompletionAgeMethods);
+Object.assign(HatcheryService.prototype, hatcheryCompletionFlockMethods);
+Object.assign(HatcheryService.prototype, hatcheryCompletionPeriodMethods);
```

ترتیب ترکیب مهم است و رعایت شده: `age.utils` اول (هستهٔ مشترک)، سپس `flock`، سپس `period`.

### د) حذف یک فایل و به‌روزرسانی اسنپ‌شات

- `hatchery.completion.service.js` **حذف** شد (۱۰۹.۸ KB، ۲۳۳۲ خط).
- `docs/service-surface.json` با `--snapshot` **عمدی** به‌روز شد (۱۷+/۱۳−): کلید mixin از
  یک فایل به سه فایل تغییر کرد؛ **مجموعهٔ ۳۹ نام دقیقاً همان قبلی است** (بخش ۷-ج).

> نکتهٔ ابزار: `audit-service-surface.mjs` هر `Object.assign(X.prototype, ident)` را
> جداگانه resolve می‌کند، پس برای سه mixin در سه فایل **هیچ تغییری در ابزار لازم نبود**
> — فقط سه `Object.assign` جدا نوشته شد.

---

## ۵) تغییرات رفتاری آگاهانه

**هیچ.** خروجی این موج از دید کاربر و از دید بقیهٔ کد یکسان است:

| سطح | انتظار | نتیجه |
| --- | --- | --- |
| متدهای نمونه/کلاس | ۱۰۱ عضو (۶۲ عضو خودِ کلاس + ۳۹ mixin) | ✅ ۱۰۱ (اسموکتست) |
| سراسری‌های `window` | ۵۷ نام چسب، بدون تغییر | ✅ ۵۷ (اسموکتست) |
| قرارداد صدا‌زدن از بیرون فایل | ۰ نقض | ✅ `audit:surface` |
| متن متدها | کلمه‌به‌کلمه | ✅ گیت‌های ۴ و ۸ اسکریپت |
| نام‌های `pc_*`/`ue_*`/`_pc*` | بدون تغییر (برای سازگاری) | ✅ بدون rename |

> تنها «تغییر ظاهری» در مخزن: یک فایل به سه فایل تقسیم شد و یک کامنت بخش‌بندی به‌همراه
> یک خط خالی (۲ خط غیرمتدی) از داخل آبجکت جابه‌جا شد؛ متن همان کامنت در سرصفحهٔ
> `hatchery.completion.flock.js` بازتاب یافته است.

---

## ۶) نتیجهٔ عددی موج ۳.۱

| شاخص | پیش از ۳.۱ | پس از ۳.۱ |
| --- | --- | --- |
| فایل خوشهٔ پایان دوره | یک فایل ۱۰۹.۸ KB / ۲۳۳۲ خط | سه فایل: ۵۴.۶ + ۵۴.۲ + ۲.۸ KB |
| متد در بزرگ‌ترین فایل خوشه | ۳۹ | ۲۳ |
| `hatchery.service.js` | ۹۵.۱ KB / ۲۳۵۹ خط | ۹۵.۴ KB / ۲۳۶۲ خط (+۳ خط: سه import و سه `assign`) |
| فایل‌های ≥۴۰KB فرانت | ۱۲ | ۱۳ |
| حجم کل `src` فرانت | ۲.۳۷ MB | ۲.۳۷ MB |
| سرویس/سراسری تحت گارد | ۴۶ / ۲۴۶ | ۴۶ / ۲۴۶ |
| صادرات بی‌ارجاع / متد >۱۵۰ خط | ۷۱ / ۳۰ | ۷۱ / ۳۰ |

پس از این موج، هیچ فایل خوشهٔ پایان دوره‌ای بیش از ۵۵ KB نیست و بزرگ‌ترین فایل باقی‌ماندهٔ
پروژه، `dashboard.service.js` (۱۵۷.۴ KB) است.

---

## ۷) شواهد تأیید نهایی (اجرای واقعی روی همین برنچ)

### الف) دروازه‌های خودکار — همه سبز ✅

| بررسی | فرمان | نتیجه |
| --- | --- | --- |
| ESLint | `npm run lint` | بدون خطا و بدون هشدار |
| ۱۰ تست فرانت | `test:cache`…`test:hatchery-utils` | همه `exit=0` و `ALL PASS` |
| قرارداد سطح سرویس | `npm run audit:surface` | گم‌شده ۰ · افزوده ۰ · نقض فراخوانی بیرونی ۰ |
| اندازهٔ فایل‌ها | `npm run audit:size -- --fail-on-empty` | فایل صفر‌بایتی ۰ |
| صادرات بی‌ارجاع | `npm run audit:dead-exports` | ۷۱ (بی‌تغییر) |
| متدهای بزرگ | `npm run audit:big-methods` | ۳۰ (بی‌تغییر) |
| اسموک‌تست زمان اجرا | `node _3_1_smoke.mjs` | `SMOKE PASS ✅` |

### ب) شاهد «انتقال کلمه‌به‌کلمه»

دو گیت مستقل در اسکریپت مهاجرت این را اثبات کردند (بخش ۳، گیت‌های ۴ و ۸):

```text
Σ قطعات = ۲۳۰۳ خط · ناحیه = ۲۳۰۵ خط · Σ قطعات + پیش‌گفتار(۲) = ناحیه  ✅
concat(قطعات) === متن اصلی ناحیهٔ آبجکت (بایت‌به‌بایت)                 ✅
body هر فایل === concat کلمه‌به‌کلمهٔ قطعات همان فایل                   ✅
```

### ج) اسموک‌تست زمان اجرا (Node + DOM استاب حداقلی)

```text
hatchery.completion.age.utils.js       methods=  5  missingOnProto=[]
hatchery.completion.flock.js           methods= 23  missingOnProto=[]
hatchery.completion.period.js          methods= 11  missingOnProto=[]
protoOwnNames=101
protoFunctions=101
contractOwnMethods=62  contractMixinMethods=39  contractProperties(informational)=83
expectedProtoMembers=101  missingMembers=[]
glueNames=57  missingWindowGlue=[]
instanceOk=true
SMOKE PASS ✅
```

- `protoOwnNames=101` یعنی کلاس `HatcheryService` پس از سه `Object.assign` دقیقاً همان
  ۱۰۱ عضو پیش از موج را دارد (۶۲ عضو خودش + ۳۹ متد خوشه).
- `missingMembers=[]` بر پایهٔ **اسنپ‌شات قرارداد پیش از موج** محاسبه می‌شود؛ پس این
  ادعا با «قرارداد یخ‌زدهٔ موج ۲» سنجیده شده، نه با فهرست دستی.
- `missingWindowGlue=[]` ⇒ هر ۵۷ سراسری چسب پنجره هنوز ثبت می‌شوند.
- `hatcheryCompletionPeriodMethods.editPeriodCompletion` با ۳۶۵ خط در گزارش
  `audit:big-methods` سر جای خود است ⇒ ابزار، mixin جدید را شناسایی کرده است.

### د) دو نقص که خودِ گیت‌ها کشف کردند (شفافیت)

1. **۲ خط خارج از پوشش:** اجرای اول با خطای
   `segments do not tile the region (2303 vs 2305)` متوقف شد و **هیچ فایلی ننوشت** —
   همان رفتاری که گیت برای آن طراحی شده بود. ریشه: کامنت بخش‌بندی
   `// ===== مودال جامع «پایان گله» =====` و یک خط خالی پیش از اولین متد، در «قطعه‌ها»
   نبودند. اصلاح: گیت صریح «پیش‌گفتار فقط کامنت/خالی» اضافه شد و پوشش کامل اثبات شد.
2. **EOL ناهمگون:** در تلاش دوم، بلوک `import` سه فایل تازه با `\n` ساخته می‌شد در حالی
   که بقیهٔ فایل و کل مخزن CRLF است. (ابزار ماژول‌ها به این حساس نیست، ولی diff و
   ابزارهای اندازه‌گیری را آلوده می‌کرد.) وضعیت با `git restore` بازگردانی شد،
   بلوک ایمپورت با EOL محیط ساخته شد و گیت نهم
   (`no bare LF in generated file`) به اسکریپت اضافه شد.

هر دو مورد **پیش از هر کامیتی** کشف و رفع شدند؛ بازهٔ کاری این موج با تگ `pre-wave-3`
قابل بازگشت است.

---

## ۸) یافته‌های بازبینی (هیچ‌کدام در این موج تغییر نکرد)

### P2 — باقی‌مانده‌های شناخته‌شده

- **P2-۱: فراخوانی اختیاری به متدی که هرگز وجود نداشته** —
  `hatchery.window-glue.js:38` ⇒ `hatcheryService.viewPeriod?.(id)`. هیچ متدی با نام
  `viewPeriod` نه در کلاس و نه در هیچ mixin وجود ندارد (پیش از موج ۲ هم نداشت)؛ چون با
  `?.` صدا زده می‌شود خطایی رخ نمی‌دهد و دکمهٔ «مشاهدهٔ ردیف دوره» بی‌اثر است.
  `audit:surface` این مورد را به‌عنوان «۱ اطلاعی» گزارش می‌کند. **عمداً دست‌نخورده** ماند
  (اصل عدم تغییر رفتار) — تسویه در موج بعد.
- **P2-۲: سه متد بزرگ، همه در همین خوشه** — `editPeriodCompletion` (۳۶۵ خط)،
  `completePeriod` (۲۷۸ خط)، `_collectCompletionSave` (۲۰۳ خط). برش این موج بر اساس
  **دامنه** بود، نه اندازه؛ شکستن این سه تابع، تغییر ساختار داخلی است و در موج بعد
  با تست اختصاصی انجام می‌شود.

### P1 — باقی‌مانده از موج‌های قبل (بدون تغییر نسبت به موج ۲)

- خوشهٔ SMS بی‌مصرف + روت‌های `/sms` که به فایل ناموجود اشاره می‌کنند (`docs/REVIEW.md` بخش ۴).
- ۷۱ export بدون ارجاع بیرونی در فرانت و ۳ فایل js بی‌ارجاع.

### متدهای بزرگ باقی‌مانده (بودجهٔ ۱۵۰ خط)

۳۰ متد از بودجه بزرگ‌ترند (بی‌تغییر نسبت به موج ۲). موارد مربوط به جوجه‌ریزی
(فهرست کامل: `npm run audit:big-methods`):

| خطوط | مکان | نام |
| --- | --- | --- |
| ۳۶۵ | `hatchery/hatchery.completion.period.js:724` | `hatcheryCompletionPeriodMethods.editPeriodCompletion` |
| ۲۷۸ | `hatchery/hatchery.completion.period.js:296` | `hatcheryCompletionPeriodMethods.completePeriod` |
| ۲۷۷ | `hatchery/hatchery.report.js:579` | `buildFlockSmsReportHTML` |
| ۲۱۰ | `hatchery/hatchery.service.js:463` | `saveFlock` |
| ۲۰۳ | `hatchery/hatchery.completion.flock.js:856` | `hatcheryCompletionFlockMethods._collectCompletionSave` |

> 📌 مقایسه: در موج ۲ بزرگ‌ترین متد در یک فایل ۱۰۹.۸KB بود؛ اکنون بزرگ‌ترین متد جوجه‌ریزی
> در فایلی ۵۴.۶KB زندگی می‌کند و شعاع تأثیرش نصف شده است.

---

## ۹) دروازهٔ PR این موج

```bash
cd Frontend
npm run lint
npm run test:cache && npm run test:denied && npm run test:toast
npm run test:weekly && npm run test:weekly:report && npm run test:weekly:groups
npm run test:weekly:history && npm run test:customer-fields && npm run test:customer-detail
npm run test:hatchery-utils
npm run audit:surface            # اگر عضو گم شود یا قرارداد فراخوانی نقض شود، exit=1
npm run audit:size -- --fail-on-empty
npm run audit:big-methods
npm run audit:dead-exports
```

> 🔁 چون هیچ قرارداد بیرونی تغییر نکرده، `docs/service-surface.json` **نباید** در PRهای
> دیگر به‌روز شود مگر با `--snapshot` عمدی (همین کار در این موج انجام شد).

آزمون دستی دود (نقاطی که این موج دست زده است):

- `/customer-info` → تب **مدیریت جوجه‌ریزی** → مودال جامع «پایان گله»:
  باز شدن، محاسبهٔ مجدد (`recalcCompletionInputs`)، روش کشتار و محموله‌ها
  (`setPcSlaughterMethod`/`addPcShipRow`)، ذخیره (`_collectCompletionSave`)،
  `formatTomanInput` روی مبلغ، و `refreshFlocks` پس از ذخیره.
- `/customer-info` → تب **پریودها** → `completePeriod` (پایان دوره با همهٔ گله‌ها)،
  `viewPeriodCompletion`، `editPeriodCompletion` و «محاسبهٔ مجدد فیلدهای سیستمی»
  (`recomputeSystemFields`) + رندر مقطع کشتار پریود (`_ueSlaughterSectionHtml`).
- محاسبات سن/تاریخ: تاریخ کشتار شمسی ⇒ سن خودکار (`_pcSlaughterAge`) و بلعکس
  (`_pcIsoFromAge`) — این مسیر اکنون از `hatchery.completion.age.utils.js` می‌آید.

انتظار: بدون خطای کنسول و با **همان** رفتار پیش از موج.

---

## ۱۰) گام بعدی (پیشنهاد موج ۳.۲ و بعد از آن)

| اولویت | هدف | چرا |
| --- | --- | --- |
| ۱ | `dashboard.service.js` (۱۵۷.۴KB) — بزرگ‌ترین فایل باقی‌مانده | مودال بوکمارک (`showCreateBookmarkModal` ۲۸۴ خط، `showBookmarkDetail` ۱۵۰) و وضعیت پیامک (`refreshSmsStatus` ۲۳۹) با همان الگوی mixin |
| ۲ | `weekly.service.js` (۱۱۸.۶KB) | رندر و محاسبات در یک فایل: `buildWeeklyHistoryHTML` ۳۳۶ خط، `renderWeeks` ۳۰۴ خط |
| ۳ | شکستن سه متد بزرگ خودِ خوشهٔ پایان دوره | `editPeriodCompletion` ۳۶۵ خط، `completePeriod` ۲۷۸، `_collectCompletionSave` ۲۰۳ — با تست رفتاری اختصاصی |
| ۴ | `halls.service.js` (۹۷.۶KB) و `chart-dashboard.service.js` (۷۱.۴KB) | `saveBasicInfo` ۱۷۷ خط، `renderUnitDetailsPanel` ۱۶۵، `renderAllCharts` ۲۲۳ |
| ۵ | نازک‌کردن `customer-info.html` (۹۵.۹KB) | انتقال هندلرهای inline به «چسب پنجره» — همان الگوی موج ۲.۱ |
| ۶ | تسویه‌ها | باگ `viewPeriod` (P2-۱)، تصمیم دربارهٔ ۷۱ export بی‌مصرف، خوشهٔ SMS و روت‌های `/sms` |

> 🧭 سیاست موج ۳ (همان سیاست موج ۲): اصل «بدون تغییر رفتار» + `npm run audit:surface`
> قبل و بعد از هر گام. اگر «گم‌شده» گزارش داد، جابه‌جایی ناقص است و باید متوقف شود.
> برای برش‌های بایت‌به‌بایت، از الگوی «اسکریپت مهاجرت با گیت اثبات» همین موج استفاده کنید.
