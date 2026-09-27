برنچ: `chore/wave-3-split-god-classes` — تگ نقطهٔ بازگشت: `pre-wave-3` (روی `8397758`)
اصل حاکم مثل موج‌های ۰، ۱ و ۲: **بدون تغییر رفتار** (behavior-preserving).

> ⚠️ نتیجهٔ این موج در بخش ۵: **هیچ تغییر رفتاری وجود ندارد** — نه یک متد، نه یک نام
> `window.*`، نه یک ویژگی نمونه. متن متدها **کلمه‌به‌کلمه (byte-for-byte)** منتقل شده؛
> حتی یک ویرگول هم تغییر نکرده است.

> 🆕 بخش‌های ۱۱، ۱۲ و ۱۳ به تکمیل‌های همین برنچ می‌پردازند: بخش ۱۱ گارد دائمی سطح
> جوجه‌ریزی، بخش ۱۲ **موج ۳.۲a** (شکستن `dashboard.service.js` به سه mixin دامنه‌ای +
> گارد دائمی سطح داشبورد) و بخش ۱۳ **موج ۳.۲b** (شکستن `weekly.service.js` به ۸ mixin
> دامنه‌ای + چسب پنجره + گارد دائمی سطح هفتگی) — همه با همان اصل «بدون تغییر رفتار».

---

## ۱) مسأله (چرا این موج؟)

موج ۲ خوشهٔ «پایان دوره/ویرایش» را از `hatchery.service.js` بیرون کشید، اما **خودِ خوشه**
دست‌نخورده در یک فایل ماند:

| شاخص (پیش از موج ۳.۱) | مقدار                                                       |
| --------------------- | ----------------------------------------------------------- |
| فایل                  | `hatchery/hatchery.completion.service.js`                   |
| حجم                   | ۱۰۹.۸ KB (۲۳۳۲ خط، CRLF)                                    |
| متدها                 | ۳۹ متد — همه از یک `Object.assign` روی `prototype` می‌آمدند |
| سهم از کل `src` فرانت | ≈ ۴.۵٪ (از ۲.۳۷ MB)                                         |

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

| فایل جدید                          | mixin                             | متد | خط (بدنه) | حجم     | دامنه                           |
| ---------------------------------- | --------------------------------- | --- | --------- | ------- | ------------------------------- |
| `hatchery.completion.age.utils.js` | `hatcheryCompletionAgeMethods`    | ۵   | ۵۷        | ۲.۸ KB  | هستهٔ مشترک عدد/تاریخ/سن        |
| `hatchery.completion.flock.js`     | `hatcheryCompletionFlockMethods`  | ۲۳  | ۱۱۳۰      | ۵۴.۲ KB | مودال و ذخیرهٔ «پایان گله»      |
| `hatchery.completion.period.js`    | `hatcheryCompletionPeriodMethods` | ۱۱  | ۱۱۱۴      | ۵۴.۶ KB | پایان/مشاهده/ویرایش پایان پریود |

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
سرصفحهٔ `hatchery.completion.flock.js` («پایان/ویرایش پایان یک گله (مودال جامع pc\_\*)»)
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

| سطح                           | انتظار                                | نتیجه                    |
| ----------------------------- | ------------------------------------- | ------------------------ |
| متدهای نمونه/کلاس             | ۱۰۱ عضو (۶۲ عضو خودِ کلاس + ۳۹ mixin) | ✅ ۱۰۱ (اسموکتست)        |
| سراسری‌های `window`           | ۵۷ نام چسب، بدون تغییر                | ✅ ۵۷ (اسموکتست)         |
| قرارداد صدا‌زدن از بیرون فایل | ۰ نقض                                 | ✅ `audit:surface`       |
| متن متدها                     | کلمه‌به‌کلمه                          | ✅ گیت‌های ۴ و ۸ اسکریپت |
| نام‌های `pc_*`/`ue_*`/`_pc*`  | بدون تغییر (برای سازگاری)             | ✅ بدون rename           |

> تنها «تغییر ظاهری» در مخزن: یک فایل به سه فایل تقسیم شد و یک کامنت بخش‌بندی به‌همراه
> یک خط خالی (۲ خط غیرمتدی) از داخل آبجکت جابه‌جا شد؛ متن همان کامنت در سرصفحهٔ
> `hatchery.completion.flock.js` بازتاب یافته است.

---

## ۶) نتیجهٔ عددی موج ۳.۱

| شاخص                          | پیش از ۳.۱                 | پس از ۳.۱                                          |
| ----------------------------- | -------------------------- | -------------------------------------------------- |
| فایل خوشهٔ پایان دوره         | یک فایل ۱۰۹.۸ KB / ۲۳۳۲ خط | سه فایل: ۵۴.۶ + ۵۴.۲ + ۲.۸ KB                      |
| متد در بزرگ‌ترین فایل خوشه    | ۳۹                         | ۲۳                                                 |
| `hatchery.service.js`         | ۹۵.۱ KB / ۲۳۵۹ خط          | ۹۵.۴ KB / ۲۳۶۲ خط (+۳ خط: سه import و سه `assign`) |
| فایل‌های ≥۴۰KB فرانت          | ۱۲                         | ۱۳                                                 |
| حجم کل `src` فرانت            | ۲.۳۷ MB                    | ۲.۳۷ MB                                            |
| سرویس/سراسری تحت گارد         | ۴۶ / ۲۴۶                   | ۴۶ / ۲۴۶                                           |
| صادرات بی‌ارجاع / متد >۱۵۰ خط | ۷۱ / ۳۰                    | ۷۱ / ۳۰                                            |

پس از این موج، هیچ فایل خوشهٔ پایان دوره‌ای بیش از ۵۵ KB نیست و بزرگ‌ترین فایل باقی‌ماندهٔ
پروژه، `dashboard.service.js` (۱۵۷.۴ KB) است.

---

## ۷) شواهد تأیید نهایی (اجرای واقعی روی همین برنچ)

### الف) دروازه‌های خودکار — همه سبز ✅

| بررسی                    | فرمان                                     | نتیجه                                                   |
| ------------------------ | ----------------------------------------- | ------------------------------------------------------- |
| ESLint                   | `npm run lint`                            | بدون خطا و بدون هشدار                                   |
| ۱۰ تست فرانت             | `test:cache`…`test:hatchery-utils`        | همه `exit=0` و `ALL PASS`                               |
| قرارداد سطح سرویس        | `npm run audit:surface`                   | گم‌شده ۰ · افزوده ۰ · نقض فراخوانی بیرونی ۰             |
| اندازهٔ فایل‌ها          | `npm run audit:size -- --fail-on-empty`   | فایل صفر‌بایتی ۰                                        |
| صادرات بی‌ارجاع          | `npm run audit:dead-exports`              | ۷۱ (بی‌تغییر)                                           |
| متدهای بزرگ              | `npm run audit:big-methods`               | ۳۰ (بی‌تغییر)                                           |
| اسموک‌تست زمان اجرا      | `node _3_1_smoke.mjs` (فایل موقت، حذف شد) | `SMOKE PASS ✅`                                         |
| گارد دائمی سطح زمان اجرا | `npm run test:hatchery-surface`           | `SMOKE PASS ✅` (جایگزین دائمی همان اسموک‌تست — بخش ۱۱) |

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
- **P2-۳: ارجاع آویزان `savePeriod` (تسویه نشده)** — تعریف `async savePeriod()` در کامیت
  `e250186` («FIX backend and Frontend - step2») حذف شده، ولی دو صداکننده‌اش مانده است:
  `hatchery.service.js:351` (`setupEvents` → کلیک دکمهٔ `.btn-primary` تب `#chickPeriodInfoTab`)
  و `hatchery.window-glue.js:28` (`window.saveChickPeriodInfo`). در کامیت `0458dab` تعریف
  وجود داشت، پس **رگرسیون پیش‌موجود** است (اثر موج‌های ۲/۳ نیست). چون
  `hatcheryApi.createPeriod` و `hatcheryValidation.validatePeriod` هم حذف شده‌اند،
  بازگردانی یک‌به‌یک ممکن نیست. **عمداً دست‌نخورده** ماند؛ گارد زمان اجرا آن را
  «اطلاعی» گزارش می‌کند (بخش ۱۱) و حذف/بازطراحی آن تصمیم موج بعد است.
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

| خطوط | مکان                                         | نام                                                     |
| ---- | -------------------------------------------- | ------------------------------------------------------- |
| ۳۶۵  | `hatchery/hatchery.completion.period.js:724` | `hatcheryCompletionPeriodMethods.editPeriodCompletion`  |
| ۲۷۸  | `hatchery/hatchery.completion.period.js:296` | `hatcheryCompletionPeriodMethods.completePeriod`        |
| ۲۷۷  | `hatchery/hatchery.report.js:579`            | `buildFlockSmsReportHTML`                               |
| ۲۱۰  | `hatchery/hatchery.service.js:463`           | `saveFlock`                                             |
| ۲۰۳  | `hatchery/hatchery.completion.flock.js:856`  | `hatcheryCompletionFlockMethods._collectCompletionSave` |

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
npm run test:hatchery-surface    # گارد زمان اجرا: import واقعی سرویس + پارتیشن‌های اسنپ‌شات
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

| اولویت | هدف                                                                 | چرا                                                                                                                                   |
| ------ | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| ۱      | `dashboard.service.js` (۱۵۷.۴KB) — بزرگ‌ترین فایل باقی‌مانده        | مودال بوکمارک (`showCreateBookmarkModal` ۲۸۴ خط، `showBookmarkDetail` ۱۵۰) و وضعیت پیامک (`refreshSmsStatus` ۲۳۹) با همان الگوی mixin |
| ۲      | `weekly.service.js` (۱۱۸.۶KB)                                       | رندر و محاسبات در یک فایل: `buildWeeklyHistoryHTML` ۳۳۶ خط، `renderWeeks` ۳۰۴ خط                                                      |
| ۳      | شکستن سه متد بزرگ خودِ خوشهٔ پایان دوره                             | `editPeriodCompletion` ۳۶۵ خط، `completePeriod` ۲۷۸، `_collectCompletionSave` ۲۰۳ — با تست رفتاری اختصاصی                             |
| ۴      | `halls.service.js` (۹۷.۶KB) و `chart-dashboard.service.js` (۷۱.۴KB) | `saveBasicInfo` ۱۷۷ خط، `renderUnitDetailsPanel` ۱۶۵، `renderAllCharts` ۲۲۳                                                           |
| ۵      | نازک‌کردن `customer-info.html` (۹۵.۹KB)                             | انتقال هندلرهای inline به «چسب پنجره» — همان الگوی موج ۲.۱                                                                            |
| ۶      | تسویه‌ها                                                            | باگ `viewPeriod` (P2-۱)، ارجاع آویزان `savePeriod` (P2-۳)، تصمیم دربارهٔ ۷۱ export بی‌مصرف، خوشهٔ SMS و روت‌های `/sms`                |

> 🧭 سیاست موج ۳ (همان سیاست موج ۲): اصل «بدون تغییر رفتار» + `npm run audit:surface`
> قبل و بعد از هر گام. اگر «گم‌شده» گزارش داد، جابه‌جایی ناقص است و باید متوقف شود.
> برای برش‌های بایت‌به‌بایت، از الگوی «اسکریپت مهاجرت با گیت اثبات» همین موج استفاده کنید.

---

## ۱۱) گام تکمیلی — تبدیل اسموک‌تست موقت به گارد دائمی (زمان اجرا)

اسموک‌تست موج ۳.۱ (`_3_1_smoke.mjs`) موقت بود و پس از تأیید حذف شد. برای اینکه همان
«اثبات زمان اجرا» به یک گیت دائمی تبدیل شود، در همین برنچ اضافه شد:

- **فایل جدید:** `Frontend/hatchery-service-surface-test.mjs` (فقط‌خواندنی)
- **اسکریپت npm:** `test:hatchery-surface` در `Frontend/package.json`
- **منبع حقیقت:** همان `docs/service-surface.json` — هیچ عددی دستی در تست نیست.

### هشت بررسی این گارد

| #   | بررسی                                                           | مبنای اسنپ‌شات                                       |
| --- | --------------------------------------------------------------- | ---------------------------------------------------- |
| ۱   | import واقعی سرویس با استاب `window`/`document`/`localStorage`  | —                                                    |
| ۲   | همهٔ ۱۰۱ عضو (۶۲ کلاس + ۵+۲۳+۱۱ mixin) روی `prototype` تابع‌اند | `classes.HatcheryService.methods` + `mixins`         |
| ۳   | تعداد اعضای `prototype` دقیقاً ۱۰۱ است                          | اجتماع دو فهرست بالا                                 |
| ۴   | فایل هر سه mixin روی دیسک + یک متد شاخص روی نمونه               | `classes.HatcheryService.mixins`                     |
| ۵   | ویژگی‌های نمونهٔ اعلام‌شده موجودند (۱۷ مورد)                    | `classes.HatcheryService.properties`                 |
| ۶   | همهٔ ۵۷ نام چسب `window.*` ثبت شده‌اند                          | `services[...hatchery.window-glue.js].windowGlobals` |
| ۷   | `window.hatcheryService` همان نمونهٔ سرویس است                  | همان                                                 |
| ۸   | گزارش اطلاعی اعضای اضافه (روی `prototype` و `window`)           | —                                                    |

خروجی واقعی روی همین برنچ `SMOKE PASS` و `exit=0` است. اعضای اضافهٔ `window`
(۸ نام مثل `stateService` و `openSmsHistoryModal`) از ماژول‌های دیگر می‌آیند و اطلاعی‌اند.

### یافتهٔ تازهٔ همین گارد: ارجاع آویزان `savePeriod` (P2-۳)

بررسی ۵ نشان داد `savePeriod` — که در `properties` اسنپ‌شات هست — روی نمونهٔ واقعی
وجود ندارد. ریشه‌یابی با تاریخچه: تعریف `async savePeriod()` در `0458dab` بود و در
`e250186` حذف شد، ولی `hatchery.service.js:351` و `hatchery.window-glue.js:28` هنوز آن را
صدا می‌زنند. پس این یک **رگرسیون پیش‌موجود** است، نه اثر این موج؛ طبق اصل «بدون تغییر
رفتار» دست‌نخورده ماند و در `docs/HOTSPOTS.md` (بند ۹) و بخش ۸ همین سند (`P2-۳`) ثبت شد.
گارد آن را «اطلاعی» گزارش می‌کند (`DANGLING_CALLS`) ولی اگر نام **تازه‌ای** گم شود،
فوراً `exit=1` می‌دهد.

---

## ۱۲) موج ۳.۲a — شکستن `dashboard.service.js` به سه mixin دامنه‌ای (+ گارد زمان اجرا)

بزرگ‌ترین فایل باقی‌ماندهٔ فرانت (`src/features/dashboard/dashboard.service.js` — ۱۵۷.۴KB /
۴۰۶۹ خط / ۷۸ عضو سطح عمومی) با همان سیاست موج ۳.۱ شکسته شد: **بدون تغییر رفتار**، با
اسکریپت مهاجرت و گیت‌های اثبات. تفاوت روش این موج با موج ۳.۱:

1. برش بر پایهٔ **آفست بایت + AST (espree)** است، نه شمارهٔ خطِ دستی؛
2. بلوک **ایمپورت‌های سرویس خودکار هرس می‌شود** (ایمپورت‌هایی که مصرف‌کننده‌شان به mixin
   رفته، بی‌مصرف نمی‌مانند)؛
3. تعداد گیت‌ها از ۱۲ به **۳۴ شناسه (۹۸ خط PASS)** رسید.

### الف) پارتیشن (نقشهٔ سه فایل)

| #   | فایل جدید                  | حجم    | خطوط | نواحی برش‌خورده از مبدأ         | محتوا                                                                              | عضو    |
| --- | -------------------------- | ------ | ---- | ------------------------------- | ---------------------------------------------------------------------------------- | ------ |
| ۱   | `dashboard.sms.js`         | ۴۳.۰KB | ۹۹۰  | ۵۴۶–۶۷۳ · ۲۱۷۵–۲۵۸۶ · ۲۶۹۲–۳۱۲۵ | ارسال پیامک گلّه/سالن، وضعیت تحویل، تاریخچهٔ پیامک، همگام‌سازی خودکار وضعیت تسک‌ها | ۱۰ متد |
| ۲   | `dashboard.bookmarks.js`   | ۲۹.۸KB | ۵۸۶  | ۸۲۵–۹۱۹ · ۳۱۲۶–۳۵۹۷             | بوکمارک‌ها: رندر فهرست، مودال ساخت/ویرایش، جزئیات، حذف                             | ۵ متد  |
| ۳   | `dashboard.window-glue.js` | ۵.۴KB  | ۱۳۸  | ۳۹۴۷–۴۰۶۹                       | ثبت ۲۴ نام `window.*` + راه‌اندازی رویدادهای DOM                                   | ۰ متد  |

در عوض `dashboard.service.js` سه `import` و سه خط ترکیب گرفت:

```js
import { dashboardSmsMethods } from "./dashboard.sms.js";
import { dashboardBookmarkMethods } from "./dashboard.bookmarks.js";
import { registerDashboardWindowGlue } from "./dashboard.window-glue.js";
// ...
Object.assign(DashboardService.prototype, dashboardSmsMethods);
Object.assign(DashboardService.prototype, dashboardBookmarkMethods);
// ...
registerDashboardWindowGlue({ dashboardService, DashboardService });
```

> ⚠️ چسب پنجره به‌شکل **تابع ثبت** exports شده (نه side-effect در زمان import)، تا ترتیب
> اجرا حفظ شود: ثبت `window.*` باید **بعد از** ساخته‌شدن نمونهٔ `dashboardService` انجام
> شود. این تفاوت با موج ۲.۱ عمدی و در جهت شفافیت است.

### ب) روش — اسکریپت `_3_2a_split.mjs` با ۳۴ گیت (۹۸ خط PASS)

| گروه        | شناسه‌های گیت                                                                                                                                     | چه چیزی را اثبات می‌کند                                                                                                                                                                                           |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| مبدأ        | `01-uniform-eol` · `02-line-count`                                                                                                                | مبدأ یکدست CRLF و دقیقاً ۴۰۶۹ خط است (اگر مبدأ حتی یک بایت عوض شود، گیت می‌شکند)                                                                                                                                  |
| نواحی       | `03-start-*` · `04-end-*` · `05-ranges-ordered`                                                                                                   | مرز هر ۶ ناحیه روی کامنت/خط خالی درست است، صعودی و بدون هم‌پوشانی                                                                                                                                                 |
| اعضا (AST)  | `21-class-found` · `22-member-set-*` · `23-contained-*` · `24-async-flag-*` · `25-glue-no-class-members` · `26-member-end-*`                      | هر ۱۵ عضو با پرچم درست `async`، فقط از «نوع متد»، دقیقاً همان مجموعهٔ مورد انتظار، و پایان هر متد روی `  }`                                                                                                       |
| بایت        | `07-bytes-*` · `08-removed-count` · `09-rebuild-exact` · `10-no-export-in-regions`                                                                | برش بایت‌به‌بایت: `concat(نواحی) === ناحیهٔ مبدأ`، `۲۴۰۵ + ۱۶۶۴ = ۴۰۶۹`، و هیچ `export`ی داخل نواحی بریده نشده                                                                                                    |
| ایمپورت     | `11-import-block` · `12-import-parse` · `30-imports-minimal-*` · `31-dropped-imports-moved` · `33-service-imports-minimal` · `34-import-coverage` | بلوک ایمپورت خطوط ۱–۱۷ درست شناسایی، هر mixin فقط ایمپورت‌های مصرف‌شده را دارد (sms ۳ خط، bookmarks ۶ خط)، تنها نام هرس‌شدهٔ سرویس (`convertPersianToGregorian`) در mixin حاضر است، و هیچ ایمپورت بی‌مصرفی نمانده |
| چسب         | `13-glue-structure` · `14-glue-window-names` · `16-glue-imports`                                                                                  | ساختار تابع چسب، ۲۴ نام `window.*` با همان ترتیب مبدأ، صفر ایمپورت اضافی                                                                                                                                          |
| برگشت‌پذیری | `15-body-*` · `27-comma-only-diff-*`                                                                                                              | تنها تفاوت متن mixin با مبدأ «ویرگول پایان متد» است؛ برگشت‌پذیری بایت‌به‌بایت اثبات می‌شود                                                                                                                        |
| نحو         | `28-parse-draft-*` · `29-parse-*` · `32-service-parses`                                                                                           | هر چهار فایل با espree پارس می‌شوند (هم پیش، هم پس از هرس ایمپورت)                                                                                                                                                |
| شمارش       | `18-uniform-eol` · `19-service-line-count` · `20-written-byte-exact`                                                                              | EOL یکدست، معادلهٔ خط (`۲۴۰۵ + ۸ − ۳ = ۲۴۱۰`) و بازخوانی بایت‌به‌بایت از دیسک                                                                                                                                     |

### ج) تغییرات `dashboard.service.js`

`git diff --numstat`: **۹ خط افزوده / ۱۶۶۸ خط حذف‌شده**

| افزوده‌ها (۹)                                                                                      | حذف‌شده‌ها (۱۶۶۸)                                              |
| -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| ۳ ایمپورت mixin + ۲ کامنت + ۲ `Object.assign` + ۱ فراخوانی چسب + ۱ خط تک‌نامی‌شدهٔ `date.utils.js` | ۱۶۶۴ خط متدهای منتقل‌شده + ۴ خط ایمپورت چندخطی `date.utils.js` |

هیچ متدی، هیچ نام `window.*` و هیچ ویژگی نمونه‌ای تغییر نکرد. همچنین import
`customer-detail.renderer.js`/`TaskCard`/`string.utils.js`/`date.utils.js` سرویس دقیقاً
همان‌هایی هستند که متدهای باقی‌مانده مصرف می‌کنند (گیت `33-service-imports-minimal`).

### د) نتیجهٔ عددی موج ۳.۲a

| شاخص                        | پیش از موج           | پس از موج                               |
| --------------------------- | -------------------- | --------------------------------------- |
| حجم `dashboard.service.js`  | ۱۵۷.۴KB              | **۸۷.۱KB** (−۴۵٪)                       |
| خطوط `dashboard.service.js` | ۴۰۶۹                 | **۲۴۱۰** (−۴۱٪)                         |
| بزرگ‌ترین فایل این خوشه     | ۱۵۷.۴KB (خودِ سرویس) | ۴۳.۰KB (`dashboard.sms.js`)             |
| اعضای `prototype` سرویس     | ۷۸ (۶۳+۱۵)           | **۷۸** (۶۳ کلاس + ۱۰ پیامک + ۵ بوکمارک) |
| نام‌های `window.*` داشبورد  | ۲۴                   | **۲۴**                                  |
| سرویس‌های اسنپ‌شات قرارداد  | ۴۶                   | ۴۷                                      |
| فایل‌های فرانت (اسکن‌شده)   | ۱۴۷                  | ۱۵۰                                     |
| کل حجم `src`                | ۲.۳۷ MB              | ۲.۳۸ MB                                 |

### ه) شواهد تأیید نهایی (اجرای واقعی روی همین برنچ)

| #   | شاهد                                                                  | نتیجه                                                                                                                                                       |
| --- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ۱   | `node _3_2a_split.mjs`                                                | `✅ SPLIT 3.2a PASS` — ۳۴ شناسه / ۹۸ خط PASS، `exit=0`                                                                                                      |
| ۲   | **اجرای دوبارهٔ مهاجرت از مبدأ دست‌نخوردهٔ `HEAD`** و مقایسهٔ SHA-256 | هر چهار فایل **بایت‌به‌بایت یکسان** ⇒ نتیجه قطعی و بازتولیدپذیر است                                                                                         |
| ۳   | `npx eslint` روی هر چهار فایل تولیدی                                  | `exit=0`                                                                                                                                                    |
| ۴   | ۱۲ تست فرانت (`npm run test:*`)                                       | همه `exit=0`                                                                                                                                                |
| ۵   | `npm run lint`                                                        | `exit=0`                                                                                                                                                    |
| ۶   | `npm run audit:size` · `audit:dead-exports` · `audit:surface`         | همه `exit=0` (بدون «گم‌شده»)                                                                                                                                |
| ۷   | `npm run audit:surface -- --snapshot`                                 | `docs/service-surface.json` بازتولید شد: `DashboardService` دارای `mixins` (sms ۱۰ + bookmarks ۵)، `dashboard.window-glue.js` با ۲۴ نام، ۷۸ عضو `prototype` |

### و) گارد دائمی جدید — `npm run test:dashboard-surface`

فایل جدید: `Frontend/dashboard-service-surface-test.mjs` (فقط‌خواندنی، منبع حقیقت:
همان `docs/service-surface.json`؛ هیچ عددی دستی در تست نیست). ۱۱ بررسی:

| #   | بررسی                                                                               | مبنای اسنپ‌شات                                        |
| --- | ----------------------------------------------------------------------------------- | ----------------------------------------------------- |
| ۱   | import واقعی سرویس در Node با استاب `window`/`document`/`localStorage` و ساخت نمونه | —                                                     |
| ۲   | نمونه واقعاً از کلاس چسب‌خورده ساخته شده (هر دو `Object.assign` اجرا شده‌اند)       | `classes.DashboardService.mixins`                     |
| ۳   | همهٔ ۷۸ عضو روی `prototype` تابع‌اند                                                | `classes.DashboardService.methods` + `mixins`         |
| ۴   | تعداد اعضای `prototype` دقیقاً ۷۸ است                                               | اجتماع دو فهرست بالا                                  |
| ۵   | فایل `dashboard.bookmarks.js` روی دیسک + ۵ متد شاخص روی نمونه                       | `classes.DashboardService.mixins`                     |
| ۶   | فایل `dashboard.sms.js` روی دیسک + ۱۰ متد شاخص روی نمونه                            | همان                                                  |
| ۷   | ویژگی‌های نمونهٔ اعلام‌شده موجودند (۳۱ مورد)                                        | `classes.DashboardService.properties`                 |
| ۸   | همهٔ ۲۴ نام چسب `window.*` ثبت شده‌اند                                              | `services[...dashboard.window-glue.js].windowGlobals` |
| ۹   | `window.dashboardService` همان نمونهٔ سرویس است                                     | همان                                                  |
| ۱۰  | `window.DashboardService` کلاس سازندهٔ همان نمونه است                               | —                                                     |
| ۱۱  | گزارش اطلاعی «اعضای تنبل» و «ثبت هنگام‌نیاز» (۸ مورد)                               | —                                                     |

خروجی واقعی روی همین برنچ `SURFACE PASS` و `exit=0` است.

> 🔎 سه نکتهٔ ظریف که همین گارد و اسکریپت آشکار کردند:
>
> 1. **کلاس `DashboardService` صادر (export) نمی‌شود** — فقط نمونهٔ `dashboardService`
>    صادر می‌شود؛ کلاس تنها از مسیر `window.DashboardService` قابل دسترسی است. اولین
>    نسخهٔ گارد فرض کرده بود کلاس صادر می‌شود و شکست خورد (شفافیت: همان‌جا اصلاح شد).
> 2. **`setDashboardChartLayout` «هنگام نیاز» ثبت می‌شود** — داخل `setupChartLayoutToggle()`
>    و نه در زمان import؛ پس در گارد `window` کنار گذاشته و جداگانه گزارش می‌شود.
> 3. هفت عضو «تنبل» (`_chartLoadingTimer`، `_chartRequestSeq`، `_cardsSignature`،
>    `_valueLabelPlugin`، `refreshInterval`، `selectedFlockGroupId`، `smsHistoryCtx`) در
>    اسنپ‌شات اعلام شده‌اند ولی فقط پس از اجرای واقعی ساخته می‌شوند؛ گارد آن‌ها را اطلاعی
>    گزارش می‌کند (نه خطا).

### ز) یادداشت نگه‌داری

- اسکریپت مهاجرت (`_3_2a_split.mjs` و ابزارهای کمکی `_3_2a_scan.mjs`/`_3_2a_probe.mjs`)
  **موقت** بود و پس از تأیید حذف شد؛ فقط ۴ فایل `src` + گارد دائمی + اسنپ‌شات می‌مانند.
- گارد `test:dashboard-surface` در `package.json` ثبت شد؛ برای سرویس بعدی همین الگو
  (استاب حداقلی + اسنپ‌شات قرارداد + اسکریپت npm) تکرار می‌شود.
- در بازبینی این موج **نقص تازهای** پیدا نشد؛ دو نقص شناختهشدهٔ پیش‌موج (`viewPeriod` و
  `savePeriod`) مربوط به سرویس‌های جوجه‌ریزی‌اند (نه داشبورد) و طبق اصل «بدون تغییر رفتار»
  دست‌نخورده ماندند (بخش ۸ و بندهای ۸ و ۹ سند `docs/HOTSPOTS.md`).

### ح) گام بعدی

`weekly.service.js` (۱۱۸.۶KB) بزرگ‌ترین فایل باقی‌ماندهٔ فرانت است؛ پیش‌شرط برش آن، یک
تست رفتاری برای محاسبات هفته است (چون سرویس محاسباتی است، نه فقط چسب DOM). پس از آن
`halls.service.js` و `chart-dashboard.service.js`.

> ✅ انجام شد در موج ۳.۲b (بخش ۱۳ همین سند).

---

## ۱۳) موج ۳.۲b — شکستن `weekly.service.js` به ۸ mixin دامنه‌ای + چسب پنجره

`weekly.service.js` آخرین «گادکلاس» فرانت بود: **۱۱۸.۶KB / ۲۸۶۷ خط / ۴۹ عضو سطح عمومی**
(۱ سازنده + ۴۸ متد) و ۱۶ نام `window.*` (۱۵ نام واقعی + `onload` که فقط داخل متن HTMLِ پنجرهٔ
چاپ است). همهٔ این ۴۹ متد از «بارگذاری داده» تا «ساخت HTML گزارش» و «محاسبات هفته» در یک
کلاس جمع بودند. در این موج، بدون تغییر رفتار، ۴۸ متد به **۸ mixin دامنه‌ای** و ۱۵ نام
`window.*` به یک فایل «چسب پنجره» منتقل شدند؛ خودِ فایل فقط **۲.۷KB / ۵۲ خط** ماند.

سه تفاوت مهم با موج ۳.۲a (داشبورد):

۱. **شکل mixinها** — در داشبورد هر mixin یک **کلاس** بود (`class DashboardSmsMethods { … }`) و
   سرویس `extends` می‌کرد؛ در هفتگی mixinها **شیء سادهٔ متدی** هستند
   (`export const weeklyCardsMethods = { renderWeeks() { … }, … }`) و سرویس با
   `Object.assign(WeeklyService.prototype, …)` آن‌ها را می‌چسباند.
۲. **چسب پنجره** — در داشبورد یک کار کلاس‌محور بود (۲۴ نام در `dashboard.window-glue.js`)؛ در
   هفتگی به یک **تابع ثبت** تبدیل شد: `registerWeeklyWindowGlue({ weeklyService, WeeklyService })`
   که **بعد از** ساخته‌شدن نمونه فراخوانی می‌شود، چون نام‌ها به نمونهٔ زنده گره خورده‌اند.
۳. **سنجش سه‌لایه** — اسنپ‌شات استاتیک (`docs/service-surface.json`) + گارد زمان اجرا
   (`weekly-service-surface-test.mjs`) + چهار تست رفتاری موجود هفتگی (`test:weekly` و سه خواهرش).

### الف) پارتیشن نهایی (۹ فایل، ۴۹ عضو)

| # | فایل | حجم | خطوط | عضو | دامنه | اعضای شاخص |
| --- | --- | --- | --- | --- | --- | --- |
| ۱ | `weekly.loading.js` | ۵.۲KB | ۱۵۱ | ۸ | بارگذاری داده و چرخهٔ عمر | `init`, `loadData`, `refresh`, `resetCache`, `loadFlocks`, `loadHalls`, `loadUnits`, `loadDictionaries` |
| ۲ | `weekly.flocks.js` | ۱۴.۴KB | ۳۹۲ | ۱۳ | کارت گله‌ها، فیلترها، باز/بسته کردن هفته‌ها | `setupEvents`, `setupFilters`, `renderFlocks`, `toggleFlock`, `toggleFlockGroup`, `groupFlockCards`, `showMoreWeeks`, `toggleWeek`, `getWeeksForFlock`, `loadFlocksFilter`, `loadStandardsForFlock`, `openAllWeeks`, `closeAllWeeks` |
| ۳ | `weekly.cards.js` | ۳۴.۵KB | ۶۷۷ | ۱۰ | کارت هفته، جدول و محاسبات نمایشی | `renderWeeks`, `updateWeekCards`, `updateAllWeekCards`, `mergeWeeks`, `calculateWeeks`, `handleFeedAutoCalc`, `weightStatusText`, `fcrStatusText`, `gainStatusText`, `dailyGainStatusText` |
| ۴ | `weekly.form.js` | ۹.۶KB | ۲۵۸ | ۳ | فرم ثبت/ویرایش هفته | `saveWeek`, `resetWeekForm`, `deleteWeek` |
| ۵ | `weekly.report.full.js` | ۹.۹KB | ۲۳۸ | ۴ | گزارش کامل و گزارش گله | `generateFullReport`, `generateFlockReport`, `buildFlockReportData`, `openReportWindow` |
| ۶ | `weekly.report.history.js` | ۱۵.۵KB | ۳۶۷ | ۲ | گردآوری داده‌های تاریخچه | `generateWeeklyHistoryReport`, `pickHistoryFlocks` |
| ۷ | `weekly.report.history.html.js` | ۱۸.۹KB | ۳۸۴ | ۲ | ساخت HTML پنجرهٔ چاپ | `buildWeeklyHistoryHTML`, `calculateAge` |
| ۸ | `weekly.report.pickers.js` | ۲۱.۴KB | ۵۰۴ | ۶ | انتخابگرها و قواعد ذخیره‌شدهٔ گزارش | `pickReportGroups`, `pickReportWeeksPerFlock`, `loadSavedReportGroups`, `saveReportGroups`, `loadSavedWeekRule`, `saveWeekRule` |
| ۹ | `weekly.window-glue.js` | ۲.۱KB | ۳۵ | — | چسب پنجره (فقط `window.*`) | ۱۵ نام: `weeklyService`، `WeeklyService`، `refreshWeeksDisplay`، `resetWeeksCache`، `openAllWeeks`، `closeAllWeeks`، `generateFullWeeklyReport`، `generateWeeklyHistoryReport`، `generateFlockReport`، `saveWeekFromForm`، `resetWeekForm`، `deleteWeekFromForm`، `toggleWeekAccordion`، `toggleFlockCard`، `showMoreWeeks` |
| — | `weekly.service.js` | ۲.۷KB | ۵۲ | ۴۹ | سازنده + `Object.assign` + `export` | `constructor` + زنجیرهٔ ترکیب و فراخوانی چسب |

ترکیب نهایی در `weekly.service.js`:

```js
import { weeklyLoadingMethods } from "./weekly.loading.js";
/* … ۷ ایمپورت mixin دیگر + weekly.window-glue.js … */

class WeeklyService {
  constructor() { /* … بدنهٔ دست‌نخوردهٔ قبلی … */ }
}

Object.assign(
  WeeklyService.prototype,
  weeklyLoadingMethods, /* …×۸ … */
);

export const weeklyService = new WeeklyService();
registerWeeklyWindowGlue({ weeklyService, WeeklyService });
```

⚠️ ترتیب مهم است: چسب پنجره **باید بعد از** `new WeeklyService()` اجرا شود (نام‌ها به نمونهٔ
زنده اشاره می‌کنند) و گارد زمان اجرا همین ترتیب را هم می‌سنجد.

### ب) روش و اثبات (اسکریپت‌های موقت، حذف‌شده پس از تأیید)

مثل موج‌های ۳.۱ و ۳.۲a، هیچ متدی «بازنویسی» نشد؛ فقط جابه‌جایی + ترکیب. دو هارنس موقت
نوشته و پس از PASS حذف شد:

- **سنجش استاتیک پیش/پس** — اجتماع نام‌های `window.*` هفتگی (۱۶ نام: ۱۵ چسب + `onload`) ·
  سراسری‌های کل مخزن **۲۴۶ → ۲۴۶** (بدون تغییر) · هیچ سرویس دیگری در `docs/service-surface.json`
  عوض نشده · «نقض قرارداد فراخوانی از بیرون» در `audit:surface` = ۰ · مجموعهٔ متدهای سطح
  عمومی هفتگی همان ۴۹ عضو.
- **اثبات کلمه‌به‌کلمه با blob گیت** — مقایسهٔ `git show pre-wave-3.2b:<file>` با فایل‌های روی
  دیسک: هر ۴۸ متد در ۸ فایل جدید با متن قبلی یکی است، بدنهٔ چسب با فهرست ۱۵ نام می‌خواند، و
  ترتیب `import` → `Object.assign` → `new WeeklyService()` → `registerWeeklyWindowGlue` درست است.

توزیع اعضا: `constructor` (۱) + loading ۸ + flocks ۱۳ + cards ۱۰ + form ۳ + report.full ۴ +
report.history ۲ + report.history.html ۲ + report.pickers ۶ = **۴۹** (دقیقاً برابر سطح قبلی).

### ج) تغییرات فایل‌ها

| بخش | افزوده | حذف‌شده |
| --- | --- | --- |
| `weekly.service.js` | ۳۱ خط | ۲۸۴۶ خط |
| ۹ فایل جدید (`weekly.*.js`) | ۳۰۰۶ خط | — |
| `docs/service-surface.json` (بازتولید عمدی) | ۷۹ خط | ۵۱ خط |
| **جمع کامیت refactor (`c4a382f`)** | **۳۱۱۶** | **۲۸۹۷** |

۳۱ خط افزودهٔ سرویس = ۹ `import` + زنجیرهٔ `Object.assign` + فراخوانی چسب + `export` — یعنی
کلاس دیگر هیچ منطقی ندارد: فقط «سازنده + ترکیب». هیچ خطی از بدنهٔ متدها تغییر نکرد (اثبات blob
بالا) و مصرف‌کنندهٔ HTML هم دست‌نخورده است.

### د) نتیجهٔ عددی

| شاخص | پیش از ۳.۲b | پس از ۳.۲b |
| --- | --- | --- |
| `weekly.service.js` | ۱۱۸.۶KB / ۲۸۶۷ خط | **۲.۷KB / ۵۲ خط** |
| بزرگ‌ترین فایل مخزن | `weekly.service.js` (۱۱۸.۶KB) | `halls.service.js` (۹۷.۶KB) |
| سطح عمومی هفتگی | ۴۹ عضو / ۱۶ نام `window.*` | **همان ۴۹ عضو** / ۱۵ چسب + `onload` |
| بزرگ‌ترین فایل تولیدشده | — | `weekly.cards.js` (۳۴.۵KB / ۶۷۷ خط) |
| فایل‌های ≥۴۰KB فرانت | ۱۴ | **۱۳** (هیچ فایل هفتگی تازه‌ای وارد نشد) |
| فایل‌های اسکن‌شده / حجم `src` | ۱۵۰ / ۲.۳۸ MB | **۱۵۹ / ۲.۴۰ MB** |
| ورودی‌های اسنپ‌شات قرارداد | ۴۷ | **۴۹** (چسب هفتگی + سازندهٔ HTML گزارش) |
| سراسری‌های `window` تحت گارد | ۲۴۶ | **۲۴۶** (بدون تغییر) |
| export بی‌ارجاع / فایل js بی‌ارجاع | ۷۱ / ۳ | **۷۱ / ۳** |

### ه) شواهد تأیید نهایی

| بررسی | فرمان | نتیجه |
| --- | --- | --- |
| گارد زمان اجرای سطح هفتگی | `npm run test:weekly:surface` | ۲۱ بررسی PASS · `SURFACE PASS` · `exit=0` |
| تست‌های رفتاری هفتگی | `npm run test:weekly` · `test:weekly:report` · `test:weekly:history` · `test:weekly:groups` | همه سبز |
| گاردهای موج‌های قبل | `npm run test:hatchery-surface` · `npm run test:dashboard-surface` | بدون افت |
| قرارداد فراخوانی از بیرون | `npm run audit:surface` | «نقض قرارداد: ۰» · `exit=0` |
| اندازه‌ها | `npm run audit:size` | ۱۵۹ فایل · ۲.۴۰ MB · ۰ فایل صفر‌بایتی |
| exportهای مرده | `npm run audit:dead-exports` | ۷۱ export بی‌ارجاع · ۳ فایل js بی‌ارجاع |
| بزرگ‌ترین متدها | `npm run audit:big-methods` | ۳۰ متد با ≥۱۵۰ خط (بدون تغییر) |
| لینت | `npm run lint` | تمیز |

### و) گارد دائمی جدید: `npm run test:weekly:surface`

`Frontend/weekly-service-surface-test.mjs` (سیزدهمین تست فرانت) ماژول را با استاب‌های
`window`/`document`/`localStorage` واقعاً import می‌کند و ۲۱ بررسی انجام می‌دهد:

| گروه | بررسی‌ها |
| --- | --- |
| صادرات و کلاس | `weeklyService` صادر می‌شود · `window.WeeklyService` کلاس همان نمونه است (کلاس صادر نمی‌شود) |
| سطح `prototype` | تابع‌بودن هر ۴۹ عضو · شمارش دقیق ۴۹ عضو |
| mixinها | ثبت هر ۸ mixin در اسنپ‌شات · وجود فایل + متد شاخص روی نمونه (۸ بررسی) |
| ویژگی‌های نمونه | ۱۵ ویژگی غیرمتدی اعلام‌شده موجودند |
| چسب پنجره | ثبت هر ۱۵ نام `window.*` · `window.weeklyService === weeklyService` · ثبت ۱۵ نام فایل چسب |
| مصرف‌کنندهٔ بیرونی | ۴ ارجاع `window.weeklyService` · مسیر `window.weeklyService?.init` (`customer-info.service.js:500`/`501`) · فراخوانی `showMoreWeeks` در HTML رندرشده (`weekly.cards.js:387`) |
| پاکیزگی | نبود اسکریپت موقت `_*` در پوشهٔ weekly |

سه نکتهٔ ظریف که گارد آگاهانه مدیریت می‌کند:

- **`WeeklyService` صادر نمی‌شود** (فقط `window.WeeklyService`)، پس گارد کلاس را از مسیر
  `window` می‌گیرد — همان کاری که چسب پنجره می‌کند.
- **`style`** یک «شبه‌ویژگی» است: ابزار استاتیک از `this.style.x` آن را عضو نمونه دیده، ولی API
  عنصر DOM است؛ گارد آن را از بررسی ویژگی‌ها کنار می‌گذارد.
- **`onload`** نام شانزدهم هفتگی است، اما «متنِ HTML/هنگام‌نیاز» است (داخل
  `<script>window.onload = function(){ window.print(); }</script>` پنجرهٔ چاپ)، نه تخصیص واقعی
  `window`؛ گارد آن را «اطلاعی» گزارش می‌کند و در شمارش `window` نمی‌آورد.

### ز) یادداشت نگه‌داری

- اسکریپت‌های موقت این موج (برش + دو هارنس سنجش) **موقت** بودند و پس از تأیید حذف شدند؛ خود
  گارد هم بررسی می‌کند که در پوشهٔ weekly هیچ فایل `_*` جامانده نباشد.
- `package.json` اسکریپت `test:weekly:surface` را ثبت کرد؛ برای سرویس بعدی همین الگو
  (استاب حداقلی + اسنپ‌شات قرارداد + یک اسکریپت npm) تکرار می‌شود.
- مصرف‌کنندهٔ HTML دست‌نخورده است: `customer-info.html` همان `weekly.service.js` را با
  `<script type="module">` بار می‌کند و ۹ فایل تازه فقط از مسیر همان ماژول دیده می‌شوند.
- در بازبینی این موج **نقص تازه‌ای** پیدا نشد؛ دو نقص شناخته‌شدهٔ پیش‌موج (`viewPeriod` و
  `savePeriod`) مربوط به سرویس جوجه‌ریزی‌اند (نه هفتگی) و طبق اصل «بدون تغییر رفتار»
  دست‌نخورده ماندند (بخش ۸ و بندهای ۸ و ۹ سند `docs/HOTSPOTS.md`).

### ح) گام بعدی

`halls.service.js` (۹۷.۶KB) بزرگ‌ترین فایل مخزن است؛ پس از آن `customer-info.html` (۹۷.۲KB)،
`hatchery.service.js` (۹۵.۴KB)، `weekly.renderer.js` (۷۴.۸KB) و `chart-dashboard.service.js`
(۷۱.۴KB). در کنار برش فایل، سه «متد غول» کاندید برش **بدنهٔ متد** هستند:
`buildWeeklyHistoryHTML` ۳۳۶ خط، `renderWeeks` ۳۰۴ خط و `renderFullReport` ۵۲۴ خط (بزرگ‌ترین
متد مخزن) — با تکیه بر چهار تست رفتاری موجود هفتگی.
