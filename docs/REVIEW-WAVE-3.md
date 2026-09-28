برنچ: `chore/wave-3-split-god-classes` — تگ نقطهٔ بازگشت: `pre-wave-3` (روی `8397758`)
اصل حاکم مثل موج‌های ۰، ۱ و ۲: **بدون تغییر رفتار** (behavior-preserving).

> ⚠️ نتیجهٔ این موج در بخش ۵: **هیچ تغییر رفتاری وجود ندارد** — نه یک متد، نه یک نام
> `window.*`، نه یک ویژگی نمونه. متن متدها **کلمه‌به‌کلمه (byte-for-byte)** منتقل شده؛
> حتی یک ویرگول هم تغییر نکرده است.

> 🆕 بخش‌های ۱۱ تا ۱۴ به تکمیل‌های همین برنچ می‌پردازند: بخش ۱۱ گارد دائمی سطح
> جوجه‌ریزی، بخش ۱۲ **موج ۳.۲a** (شکستن `dashboard.service.js` به سه mixin دامنه‌ای +
> گارد دائمی سطح داشبورد)، بخش ۱۳ **موج ۳.۲b** (شکستن `weekly.service.js` به ۸ mixin
> دامنه‌ای + چسب پنجره + گارد دائمی سطح هفتگی) و بخش ۱۴ **موج ۳.۲c** (شکستن
> `halls.service.js` به ۸ mixin دامنه‌ای + چسب پنجره + گارد دائمی سطح سالن‌ها، همراه با رفع
> دو باگ قراردادی در همان سرویس) — همه با همان اصل «بدون تغییر رفتار».

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

---

## ۱۴) موج ۳.۲c — شکستن `halls.service.js` به ۸ mixin دامنه‌ای + چسب پنجره (+ دو رفع باگ قراردادی)

`halls.service.js` چاق‌ترین فایل مخزن بود: **۹۷.۶KB / ۲۴۲۴ خط / ۷۱ عضو سطح عمومی**
(۱ سازنده + ۷۰ متد) و **۳۳ نام `window.*`**. همهٔ این ۷۰ متد — از چرخهٔ حیات و تب‌ها تا فهرست
سالن‌ها، واحدها، سیستم‌ها، حالت ویرایش و فرم‌های هر تب — در یک کلاس ۹۷ کیلوبایتی جمع بودند.
در این موج، بدون تغییر رفتار، آن ۷۰ متد به **۸ mixin دامنه‌ای** و ۳۳ نام به یک فایل «چسب پنجره»
منتقل شدند؛ خودِ سرویس فقط **۲.۵KB / ۵۰ خط** ماند.

سه تفاوت مهم با موج ۳.۲b (هفتگی):

۱. **اجرای گام بعدیِ اعلام‌شدهٔ موج ۳.۲b** — همان‌طور که در بخش ۱۳ (بند ح) پیش‌بینی شده بود،
   `halls.service.js` چاق‌ترین فایل مخزن و اولویت بعدی بود.
۲. **این موج فقط جابه‌جایی نبود: دو باگ قراردادی هم در همین سرویس رفع شد** (بند ج) — باگ‌هایی
   که گارد `audit:surface` در همین موج کشف کرد و چون سرویس داشت بازچینی می‌شد، رفع شدند.
۳. **اثبات از «گواهی چشمی» به «گیت خودکار» منتقل شد** — گیت‌های اسکریپت برش، خودشان بلاب تگ
   `pre-wave-3.2c` را از گیت می‌خوانند و ادعا می‌کنند «منبع روی دیسک == همان بلاب + دقیقاً دو
   ناحیهٔ رفع باگِ مستند، بایت‌به‌بایت» (بند ب).

### الف) پارتیشن نهایی (۱۰ فایل، ۷۱ عضو)

| # | فایل | حجم | خطوط | عضو | دامنه |
| --- | --- | --- | --- | --- | --- |
| ۱ | `halls.core.js` | ۶.۴KB | ۱۷۳ | ۹ | بارگذاری و چرخهٔ حیات (`init`, `loadData`, `loadDictionaries`, `loadUnits`, `loadHalls`, `refresh`, `refreshAllDropdowns` + گترها) |
| ۲ | `halls.tabs.js` | ۸.۰KB | ۲۲۳ | ۶ | تب‌ها و رویدادهای صفحه (`setupTabs`, `activateTab`, `loadTabData`, `resetTab`, `checkActivePeriod`, `setupEvents`) |
| ۳ | `halls.basic.js` | ۱۶.۷KB | ۴۱۶ | ۹ | تب «اطلاعات پایه» (`saveBasicInfo`, نام/شمارهٔ خودکار، قفل فیلد، کارشناس پیش‌فرض، ظرفیت، فیلدهای قدیمی) |
| ۴ | `halls.list.js` | ۸.۶KB | ۲۲۶ | ۹ | فهرست سالن‌ها (`renderHallsList`, `getPeriodInfo`, دراپ‌داون‌ها، باز/بسته کردن کارت و تغییر وضعیت) |
| ۵ | `halls.edit-mode.js` | ۱۱.۰KB | ۲۵۷ | ۷ | حالت ویرایش (`editHall`, `cancelEditHall`, بنر، دکمه‌های تب‌ها، پرکردن دراپ‌داون‌ها) |
| ۶ | `halls.units.js` | ۲۷.۲KB | ۵۷۳ | ۱۶ | واحدها (`renderUnitDetailsPanel`, کارشناسان، جزئیات/ویرایش واحد، اطلاعات فیزیکی، حذف رکورد) |
| ۷ | `halls.systems.js` | ۹.۶KB | ۱۸۶ | ۸ | ادیتور اقلام سیستم‌ها (`loadSystemInfo`, `renderSystemItemsEditor`, `createSysRowHtml`, جمع‌ها) |
| ۸ | `halls.forms.js` | ۱۶.۲KB | ۳۷۱ | ۶ | ذخیره/بارگذاری فرم تب‌ها (`savePhysicalInfo`, `saveSystemsInfo`, `saveWaterFeedInfo`, `loadWaterFeedInfo`, `collectSystemItems`, `setupSaveButtons`) |
| ۹ | `halls.window-glue.js` | ۴.۱KB | ۶۳ | — | چسب پنجره: ۳۳ نام `window.*` + `registerHallsWindowGlue({ hallsService, HallsService })` |
| — | `halls.service.js` | ۲.۵KB | ۵۰ | ۷۱ | سازنده + ۸ `Object.assign` + `export const hallsService` + فراخوانی چسب |

(جمع ۹ فایل تازه: **۲۴۸۸ خط** · شمارش‌ها به سبک `wc -l` است، همان سبک بخش ۱۳. در بازبینی
مستقل، هر ۷۰ متد جدول بالا با بلاب پیش از برش کلمه‌به‌کلمه تطبیق داده شد: ۷۰/۷۰ ✓ — یعنی
ستون «عضو» هم تأییدشده است.)

ترکیب نهایی در `halls.service.js` (کل فایل ۵۰ خط است):

```js
import { hallsCoreMethods } from "./halls.core.js";
/* … ۷ ایمپورت mixin دیگر + halls.window-glue.js … */

class HallsService {
  constructor() {
    this.customerId = null;  /* … ۱۱ فیلد دیگر … */
  }
}

Object.assign(HallsService.prototype, hallsCoreMethods);
/* … ۷ assign دیگر … */
export const hallsService = new HallsService();

registerHallsWindowGlue({ hallsService, HallsService });
```

> 🔎 **تفاوت شکل با هفتگی (۳.۲b):** اینجا mixinها هم **شیء سادهٔ متدی** هستند
> (`export const hallsUnitMethods = { renderUnitDetailsPanel() { … } }`) و چسب پنجره هم — مثل
> هفتگی — یک **تابع ثبت** است که **بعد از** ساخته‌شدن نمونه اجرا می‌شود
> (`registerHallsWindowGlue({ hallsService, HallsService })`)، چون نام‌ها به نمونهٔ زنده گره
> خورده‌اند. `HallsService` هم مثل هفتگی **صادر نمی‌شود**؛ فقط از مسیر `window.HallsService`
> دیده می‌شود.

### ب) روش و اثبات (اسکریپت `_3_2c_split_halls.mjs` + سه هارنس سنجش)

مانند موج‌های ۳.۲a/۳.۲b، برش با یک **اسکریپت مهاجرت + گیت اثبات** انجام شد (و پس از تأیید حذف
شد). تفاوت این موج: گیت‌ها **خودسنج** شدند و اثبات را از چشم بازبین گرفتند.

- **گیت ورودی برش:** بلاب `halls.service.js` از خودِ گیت خوانده می‌شود
  (`git show pre-wave-3.2c:…/halls.service.js`) — یعنی «مبنای برش» قابل جعل نیست.
- **گیت ۰۲/۰۳ (تازهٔ این موج):** پیش از هر تغییری، اسکریپت بررسی می‌کند که
  «منبع روی دیسک == همان بلابِ تگ + دقیقاً دو ناحیهٔ رفع باگِ مستند (بند ج)، **بایت‌به‌بایت**»؛
  اگر کسی پس از تگ `pre-wave-3.2c` چیزی جز آن دو ناحیه را دست بزند، برش قرمز می‌شود.
- **برش بر اساس آفست بایت** (نه شمارهٔ خط/جست‌وجوی متنی)، سپس اثبات
  `concat(قطعات) === ناحیهٔ اصلی` و پاسخ‌گویی **AST (espree)** به «آیا هر یک از ۷۱ عضو به
  mixin درست منتقل شده؟»، گارد «حذف تصادفی `export`»، هرس ایمپورت سرویس و EOL یکدست (LF).
- **گزارش اجرا:** هر ۷۰ متد با بدنهٔ **بایت‌به‌بایت یکسان** نسبت به بلاب پیش از برش
  (`076b1ad^`) داخل mixin‌ها نشسته است — در بازبینی مستقل هنگام نوشتن همین بخش، ۷۰ از ۷۰ متد
  «بدون اختلاف» تأیید شد (تنها تفاوت نحوی، «ویرگول انتهاییِ» لازم برای «عضو شیء متدی» است).
  هدر فایل‌ها و چسب پنجره تازه‌اند و تنها تفاوت محتوایی چسب پنجره بازنویسیِ یک کامنت است
  (`+۹ بایت`؛ فایل ۴۱۹۳ بایت). خودِ `halls.service.js` از ۲۴۲۴ خط به ۵۰ خط بازنویسی
  (= «سازنده + ترکیب») شد و ۸ فایل mixin از دل آن بیرون آمدند.

سه هارنس مکمل (هر سه سبز و سپس حذف شدند):

| هارنس | آنچه می‌سنجد | نتیجه |
| --- | --- | --- |
| `_3_2c_snapdiff.mjs` | دیف اسنپ‌شات قرارداد پیش/پس از برش | سرویس‌ها ۴۹ → ۵۰ · سراسری‌های `window` ۲۴۶ → ۲۴۶ · «گم‌شده ۰ / افزوده ۰» |
| `_3_2c_verbatim.mjs` | مقایسهٔ **بدنهٔ هر متد** بین بلاب پیش از برش و فایل‌های تازه | ۰ متد گم‌شده · ۰ متد تازه · تنها ۸ دیف که همه «ویرگول انتهایی» (`trailing comma`) در مرز انتقال «متد کلاس» → «عضو شیء متدی» است (۸ mixin، هر کدام یکی) — بایت‌های متد دست‌نخورده |
| `_3_2c_parity.mjs` | import واقعی نمونه **پیش از برش** (`git show`) و **پس از برش** با استاب یکسان مرورگر و مقایسهٔ سطح زمان اجرا | سطح نمونه یکسان (۷۱ عضو `prototype` · ۱۲ فیلد `constructor`) · دو باگِ بند ج پیش از رفع «قرمز/خطا» بودند و پس از رفع «سالم» شدند |

### ج) دو باگ قراردادی که در همین موج کشف و رفع شدند

`audit:surface` (گارد قرارداد) در گام نخست این موج دو ارجاع به متد ناموجود را نشان داد؛ چون
سرویس داشت بازچینی می‌شد، هر دو در **کامیت نخست همین موج** (`d61a8ce`) رفع شدند و اسنپ‌شات
قرارداد بازتولید شد:

۱. **`this.loadCities()` آویزان** — سرویس در یک listener (تغییر استان) متدی را صدا می‌زد که
   **هیچ‌جا تعریف نشده بود**؛ یعنی تغییر استان سالن → `TypeError` در زمان اجرا. ابزار این را به
   شکل «عضو نمونهٔ `loadCities`» در سطح عمومی گزارش می‌کرد (فانتوم) و دیف اسنپ‌شات **۱ خط**
   بود. رفع: حذف صداکننده.
۲. **`window.loadPeriodsDropdown` → متد ناموجود `loadPeriods`** — این نام در چسب پنجره به
   `hallsService.loadPeriods()` وصل بود، در حالی که متد واقعی `loadUnits` است (همان بارگذاری
   دوره‌ها). رفع: اتصال به `loadUnits` — روی شاخهٔ فالبک دیگر `TypeError` نمی‌دهد.
۳. **یافتهٔ عمومی (مهم برای موج‌های بعد):** اسکن «فراخوانی از بیرون» در `audit:surface` دو
   ویژگی دارد که باید شناخت: (الف) **کامنت‌نخوان** است — متن داخل کامنت را هم مثل کد می‌بیند، و
   (ب) فایل **صاحب** سرویس را از اسکن بیرونی کنار می‌گذارد. نتیجه: کامنت‌های
   `halls.window-glue.js` بازنویسی شد تا لفظ `loadPeriods`/`loadCities` در متن اجرایی تکرار
   نشود و اسم متدهای رفته (R.I.P.) در همان دو خط مستند بماند. همین دو شکاف دلیل اصلی
   اضافه‌شدن **گارد زمان اجرا** (بند ز) بود: ابزار استاتیک، به‌تنهایی «عضو فانتوم» را نمی‌گیرد.

### د) تغییرات فایل‌ها

- **۹ فایل تازه** در `src/features/customer-info/sections/hall-management/`: هشت mixin + یک چسب
  پنجره (۲۴۸۸ خط روی‌هم).
- **`halls.service.js`:** دیف `۳۱ خط افزوده / ۲۴۰۵ خط حذف‌شده` — فایل در کامیت `076b1ad`.
- **`package.json`:** یک اسکریپت تازه، `test:halls:surface` (چهاردهمین تست فرانت).
- **`docs/service-surface.json`:** بازتولید **عمدی** برای حالت پس از برش؛ بلوک `HallsService` از
  یک فهرست تخت ۶۸ متدی به «`methods: ["constructor"]` + `mixins` با ۸ فهرست» تبدیل شد
  (۱۶۶ خط دیف) — بدون هیچ عضو گم/افزوده (اثبات: بند ب، هارنس `_3_2c_snapdiff`).
- **مصرف‌کنندهٔ HTML دست‌نخورده است:** `customer-info.html` همان `halls.service.js` را با
  `<script type="module">` بار می‌کند؛ ۹ فایل تازه فقط از مسیر همان ماژول import می‌شوند و هیچ
  فایل HTML/CSS‌ای تغییر نکرد. مسیر راه‌اندازی بیرونی هم دست‌نخورده است:
  `customer-info.service.js:464` (`typeof window.hallsService?.init === "function"`) و
  `:465` (`await window.hallsService.init(this.customerId)`) — همین دو خط در گارد زمان اجرا
  مهر می‌شوند.

### ه) نتیجهٔ عددی

| شاخص | پیش از موج ۳.۲c | پس از موج |
| --- | --- | --- |
| `halls.service.js` | ۹۷.۶KB · ۲۴۲۴ خط (۹۸.۰KB پس از دو رفع باگ) | **۲.۵KB · ۵۰ خط** |
| بزرگ‌ترین فایل تولیدشدهٔ این موج | — | `halls.units.js` ۲۷.۲KB · ۵۷۳ خط · ۱۶ عضو |
| عضو سطح عمومی سرویس | ۷۱ (۱ سازنده + ۷۰ متد) | **۷۱ (بدون تغییر)** |
| نام‌های `window.*` سالن‌ها | ۳۳ (بالای همان فایل) | ۳۳ (در `halls.window-glue.js`) |
| فایل‌های اسکن‌شدهٔ `src` | ۱۵۹ | ۱۶۸ (+۹) |
| حجم کل `src` | ۲.۴۰ MB | ۲.۴۱ MB (+۱۶KB سربار سرصفحه/ایمپورت) |
| سرویس‌های ثبت‌شده در اسنپ‌شات | ۴۹ | ۵۰ |
| سراسری‌های `window` تحت گارد | ۲۴۶ | ۲۴۶ (بدون تغییر) |
| export بی‌ارجاع / فایل js بی‌ارجاع | ۷۱ / ۳ | ۷۱ / ۳ |
| متدهای ≥۱۵۰ خط | ۳۰ | ۳۰ (برش فایل، متدها را کوچک نمی‌کند) |

> ℹ️ قرارداد عددی این جدول‌ها: **KB** = سبک `audit:size` (`bytes/1024`، یک رقم اعشار) و
> **خطوط** = `wc -l` (تعداد newline) — همان قراردادی که بخش‌های ۱۲/۱۳ استفاده کرده‌اند.

### و) شواهد تأیید نهایی (اجرای واقعی روی همین برنچ)

| بررسی | فرمان | نتیجه |
| --- | --- | --- |
| گارد زمان اجرای سطح سالن‌ها | `npm run test:halls:surface` | ۲۴ بررسی PASS · `SURFACE PASS` · `exit=0` |
| گاردهای موج‌های قبل | `test:hatchery-surface` · `test:dashboard-surface` · `test:weekly:surface` | بدون افت (`exit=0`) |
| تست‌های رفتاری فرانت | ۱۴ اسکریپت `test:*` | همه سبز (`exit=0`) |
| قرارداد فراخوانی از بیرون | `npm run audit:surface` | گم‌شده → سرویس ۰ · نمونه ۰ · متد ۰ · ویژگی ۰ · سراسری ۰ · افزوده ۰ · «نقض قرارداد: ۰» · `exit=0` |
| اندازه‌ها | `npm run audit:size` | ۱۶۸ فایل · ۲.۴۱ MB · ۰ فایل صفر‌بایتی |
| exportهای مرده | `npm run audit:dead-exports` | ۷۱ export بی‌ارجاع · ۳ فایل js بی‌ارجاع |
| بزرگ‌ترین متدها | `npm run audit:big-methods` | ۳۰ متد ≥۱۵۰ خط (بدون تغییر) |
| لینت | `npm run lint` | تمیز |
| **آزمون جهشِ خودِ نگهبان** (اسکریپت موقت) | سه سناریو | (۱) حذف یک متد mixin (`setupTabs`) → **۲ FAIL / `exit=1`** · (۲) بازگرداندن باگ قدیمی (`loadUnits` → `loadPeriods`) → **۲ FAIL / `exit=1`** با پیام دقیق `hallsService.loadPeriods is not a function` · (۳) بازیابی کامل → `SURFACE PASS` |

### ز) گارد دائمی جدید: `npm run test:halls:surface`

`Frontend/halls-service-surface-test.mjs` (چهاردهمین تست فرانت) با همان استاب‌های اثبات‌شدهٔ
`window`/`document`/`localStorage` ماژول را **واقعاً** `import` می‌کند و ۲۴ بررسی انجام می‌دهد:

| گروه | بررسی‌ها |
| --- | --- |
| صادرات و کلاس | `hallsService` صادر می‌شود · `window.HallsService` کلاس «همان نمونه» است (خودِ کلاس صادر نمی‌شود) |
| سطح `prototype` | تابع‌بودن هر ۷۱ عضو · شمارش دقیق ۷۱ عضو |
| mixinها | ثبت هر ۸ mixin در اسنپ‌شات · برای هر mixin: وجود فایل روی دیسک + متد شاخص روی نمونه (۹ بررسی) |
| ویژگی‌های نمونه | ۱۷ ویژگی اعلام‌شده: ۱۲ مورد در `constructor` + ۴ فیلد **تنبل** با اثبات «اولین محل نوشتن» (`_capOverflowDebounce`، `_capOverflowNotified`، `_loadedSystemsHallId`، `capacitySummary`) + یک شبه‌ویژگی DOM (`value`) — هر ویژگیِ بی‌اثبات = قرمز |
| باگ‌های همین موج | نبود عضو فانتوم `loadCities` · نبود فراخوانی آویزان `this.loadCities(` در دامنهٔ سالن‌ها · اتصال `window.loadPeriodsDropdown` به `loadUnits` (بررسی متن) · **اثبات رفتاری:** با استاب‌کردن `loadUnits` روی نمونه، `window.loadPeriodsDropdown()` دقیقاً یک بار آن را صدا می‌زند و `TypeError` نمی‌دهد |
| چسب پنجره | ثبت هر ۳۳ نام `window.*` · `window.hallsService === hallsService` |
| مصرف‌کننده‌های بیرونی | ۵ ارجاع `window.hallsService` · مسیر `window.hallsService?.init` + فراخوانی `init` (`customer-info.service.js:464`/`465`) · فراخوانی درج‌شده در HTML رندرشده (`halls.renderer.js:204`: `window.hallsService?.renderUnitDetailsPanel(...)` داخل `onclick`) |
| پاکیزگی | نبود اسکریپت موقت `_*` در پوشهٔ `hall-management` |

سه نکتهٔ ظریف که گارد آگاهانه مدیریت می‌کند:

- **`HallsService` صادر نمی‌شود** (فقط نمونهٔ `hallsService`)، پس گارد کلاس را از مسیر
  `window.HallsService` می‌گیرد — همان کاری که چسب پنجره می‌کند.
- **`value` یک «شبه‌ویژگی» است:** ابزار استاتیک از متن قالب HTML
  (`oninput="this.value=this.value.replace(…)"` در `halls.units.js:60`) نام `value` را عضو نمونهٔ
  سرویس دیده، در حالی که `this` آن‌جا عنصر `<input>` است؛ گارد آن را از بررسی ویژگی‌ها کنار
  می‌گذارد (همان الگوی `style` در گارد هفتگی).
- **تفکیک «فیلد تنبل» از «عضو فانتوم»** قلب این گارد است: هر نام غیرمتدی که در زمان import روی
  نمونه نباشد، فقط وقتی پذیرفته می‌شود که در متن یکی از فایل‌های دامنه یک `this.<name> =` برایش
  پیدا شود؛ وگرنه «بدون اثبات (فانتوم؟)» گزارش و قرمز می‌شود — یعنی همان دستهٔ باگی که
  `loadCities` بود.

### ح) یادداشت نگه‌داری و گام بعدی

- اسکریپت‌های موقت این موج (اسکریپت برش + سه هارنس سنجش + آزمون جهش) **موقت** بودند و پس از
  تأیید حذف شدند؛ خودِ گارد هم بررسی می‌کند که در پوشهٔ `hall-management` هیچ فایل `_*`
  جامانده نباشد. (بازبینی `git status` پس از کامیت: هیچ فایل موقتی رهاشده نیست.)
- `package.json` اسکریپت `test:halls:surface` را ثبت کرد؛ برای سرویس بعدی همین الگو تکرار
  می‌شود: استاب حداقلی + اسنپ‌شات قرارداد + یک اسکریپت npm.
- **ورودی این موج «رفع باگ» هم داشت** (بند ج): تنها موجی از زنجیرهٔ ۳.۲ که سطح قرارداد را
  تغییر داد — اما فقط به شکل «حذف یک فانتوم و اتصال درست یک نام»، با بازتولید عمدی اسنپ‌شات.
- دو یافتهٔ شناخته‌شدهٔ **پیش‌موج** در خوشهٔ جوجه‌ریزی همچنان باز است و خارج از دامنهٔ این موج
  بود (اصل «بدون تغییر رفتار»): `hatcheryService.viewPeriod` که `audit:surface` به‌عنوان
  «۱ اطلاعی» (فراخوانی اختیاری به متد ناموجود) گزارش می‌کند و `savePeriod` که در گارد زمان
  اجرای جوجه‌ریزی به‌صورت `DANGLING_CALLS` مستثنا شده است. هیچ‌کدام مربوط به سالن‌ها نیستند و
  در `docs/HOTSPOTS.md` بندهای ۸ و ۹ ثبت شده‌اند.
- گام بعدی پیشنهادی، بر اساس `docs/HOTSPOTS.md`:
  ۱. **`customer-info.html` (۹۷.۲KB)** — بزرگ‌ترین فایل مخزن پس از این موج؛ انتقال هندلرهای
     inline به «چسب پنجره» (همان الگوی موج ۲.۱/۳.۲b) + گارد زمان اجرا برای تابع‌های منتقل‌شده.
  ۲. **`chart-dashboard.service.js` (۷۱.۴KB)** — آخرین «گادکلاس» سرویس‌های فرانت
     (`renderAllCharts` ۲۲۳ خط · `chartDashboardRenderer.renderContainer` ۲۴۹ خط).
  ۳. **برش بدنهٔ متدهای غول** (نه جابه‌جایی فایل): `halls.report.js:491 generateHTML` ۴۵۰ خط ·
     `halls.renderer.js:281 renderHallInfo` ۲۵۴ خط · `halls.basic.js:235 saveBasicInfo` ۱۷۷ خط ·
     `halls.units.js:292 renderUnitDetailsPanel` ۱۶۵ خط — نیازمند تست رفتاری اختصاصی، مثل چهار
     تست رفتاری موجود هفتگی.

## ۱۵) موج ۳.۲d — برش بدنهٔ چهار متد غول خوشهٔ سالن‌ها (بدون تغییر یک بایت خروجی)

> این موج ادامهٔ مستقیم بخش ۱۴ است. بخش ۱۴ «فایل» چاق را شکست؛ این موج سراغ چیزی رفت که با
> شکستن فایل کوچک **نمی‌شود**: بدنهٔ چهار متد غول که پس از ۳.۲c در فایل‌های مستقل خوشهٔ سالن‌ها
> باقی مانده بودند. تفاوت صریح با موج‌های ۳.۲a/۳.۲b/۳.۲c: **هیچ فایلی جابه‌جا نمی‌شود، هیچ عضوی
> از سطح عمومی عوض نمی‌شود و هیچ بایتی از خروجی HTML تغییر نمی‌کند.**

### الف) قیدها (چرا این موج ریسک‌دار بود)

| قید | چرا | اثبات |
| --- | --- | --- |
| سطح عمومی ثابت | چهار متد از مسیر `window.hallsService` و `onclick`های HTML رندرشده صدا زده می‌شوند | `npm run test:halls:surface` (۷۱ عضو `prototype` · ۳۳ نام `window.*` · ۱۷ ویژگی نمونه) + `npm run audit:surface` (۰ گم‌شده · ۰ افزوده · ۰ نقض) |
| خروجی بایت‌به‌بایت ثابت | بدنهٔ هر چهار متد HTML می‌سازد؛ «فاصلهٔ اضافه» یعنی تغییر DOM | گارد طلایی `npm run test:halls:body` (۱۳۶ بررسی · ۱۷ کِیس · هش `sha256` خروجی) |
| بدون عضو جدید در ماژول | توابع کمکی باید «ماژول‌محلی» بمانند، نه سطح تازه | بازبینی اسکریپت برش (شمارش نام‌های کمکی) + `audit:size` و `audit:dead-exports` |

سه نکتهٔ فنی که مسیر این موج را تعیین کرد:

1. **`audit:surface` فقط `this.X` داخل بدنهٔ کلاس را می‌خواند.** پس هر ارجاعی که از بدنهٔ متد
   بیرون می‌رود باید یا پارامتر بگیرد (`service`) یا داخل همان ماژول بماند — وگرنه «عضو فانتوم»
   یا «نقض قرارداد» گزارش می‌شود.
2. **تورفتگی template-literal بخشی از خروجی است.** برای HTML، جای‌گذاری توابع کمکی فقط وقتی
   بایت‌به‌بایت امن است که «تورفتگی خط اسلات + مقدار برگشتی» دقیقاً همان بایت‌های قبلی باشد
   (بند د، مورد ۱).
3. **`halls.renderer.js` و `halls.basic.js` و `halls.units.js` در `docs/service-surface.json`
   نیستند** (فقط فهرست متدهای mixin آن‌ها آنجا آمده)، پس محدودیت اصلی این موج «سطح زمان اجرا»
   است، نه اسنپ‌شات استاتیک.

### ب) گارد پیش از برش — هارنس طلایی `test:halls:body`

پیش از هر تغییر، خروجی «زمان اجرا»ی هر چهار متد با استاب حداقلی مرورگر در Node گرفته و
**پیش از برش** به اسنپ‌شات طلایی تبدیل شد (`docs/halls-body-golden.json`، تگ `pre-body-split`):

- ۱۷ کِیس: `A1..A4` گزارش کامل/خالی/کاربر ناشناس/مشتری ناقص · `B1..B3` سالن کامل/مینیمال/سقوط
  نام‌ها · `C1..C6` ثبت جدید/ویرایش موفق/خطای اعتبارسنجی/پاسخ ناموفق/استثنا/دکمهٔ غیرفعال ·
  `D1..D4` واحد کامل/ظرفیت صفر/مازاد/ورودی `null`.
- سنجش دو لایه است: «انکر»های رفتاری (زیررشته‌های کلیدی) + برابری `sha256` خروجی کامل.
- `saveBasicInfo` به‌جای رشتهٔ HTML، «رکورد فراخوانی‌ها» را می‌سنجد (payloadهای `updateHall`/
  `createHall`، فراخوانی‌های اعتبارسنجی، اعلان‌ها، `Swal`، وضعیت دکمهٔ ذخیره).
- گارد عمداً «رفتار فعلی» را قفل می‌کند، حتی جاهایی که مشکوک است (مثل «undefined» وقتی آیتم
  دیکشنری بی‌نام است) — چون هدف این موج اثبات «عدم تغییر» است، نه اصلاح رفتار.
- سخت‌سازی پس از کامیت اول (`c16baf0`): `normalizeNewlines` برای پایان خط، چون مخزن
  `core.autocrlf=true` دارد ولی blobها LF هستند.

### ج) پارتیشن برش‌ها (هر برش = یک کامیت)

| # | متد | فایل | قبل → بعد | توابع کمکی ماژول‌محلی |
| --- | --- | --- | --- | --- |
| A | `generateHTML` | `halls.report.js` | ۴۵۰ → ۴۶ | `resolveReportContext`, `buildUnitSectionsHtml`, `computeReportTotals`, `buildCustomerInfoHtml`, `buildSummaryStatsHtml`, `buildReportFooterHtml` + ثابت `REPORT_STYLE_BLOCK` |
| B | `renderHallInfo` | `halls.renderer.js` | ۲۵۴ → ۲۰ | `resolveHallDetailNames`, `buildHallBasicSection`, `buildHallPhysicalSection`, `buildHallSystemsSection`, `buildHallWaterFeedSection` |
| C | `saveBasicInfo` | `halls.basic.js` | ۱۷۷ → ۶۵ | `markBasicSaveBusy`, `restoreBasicSaveButton`, `readBasicInfoFormPayload`, `collectBasicInfoErrors`, `buildBasicUpdateSummaryItems`, `showBasicUpdateSuccess`, `exitBasicEditMode` |
| D | `renderUnitDetailsPanel` | `halls.units.js` | ۱۶۵ → ۲۲ | `computeUnitCapacityView`, `buildUnitExpertChips`, `buildUnitDetailsViewHtml`, `buildUnitEditFormHtml` |

روی‌هم: **۲۲ تابع کمکی + یک ثابت ماژول‌محلی**، همه در انتهای همان فایل و بدون هیچ `export` تازه.


### د) تکنیک‌های برش (و چرا هر کدام لازم بود)

1. **ساخت اسلات با آفست دقیق، نه بازتایپ.** بدنهٔ هر تابع کمکی از خودِ فایل با آفست دقیق بریده
   می‌شود. دو حالت امتحان‌شده:
   - **مقدار با خط اول بی‌فاصله (برش B):** ۱۴ فاصلهٔ خط اول از بدنه برداشته می‌شود و همان ۱۴
     فاصله در خط `${…}` متد تأمین می‌شود ⇒ `concat` بایت‌به‌بایت برابر اصل.
   - **مقدار با خط اول ۸-فاصله (برش D):** فقط ۸ فاصلهٔ خط اول بلوک برداشته می‌شود (بقیهٔ خطوط
     دست‌نخورده‌اند، چون template تودرتو هم داخلشان است) و خط اسلات همان ۸ فاصله را دارد.
2. **شرط محافظ هم «بخشی از بدنه» است.** در برش B نسخهٔ اول فقط template درونی منتقل شد و شرط
   `hall.physicalInfo ? … : ""` جا ماند ⇒ گارد طلایی در همان اجرا FAIL داد
   (`TypeError: Cannot read properties of undefined (reading 'length')`). اصلاح شد و در کامیت
   نهایی صفر بایت تفاوت ماند.
3. **`return` زودهنگام داخل helper معنا ندارد.** در برش C، شرط «خطای اعتبارسنجی» نمی‌تواند داخل
   تابع برود؛ پس `collectBasicInfoErrors` فقط آرایهٔ خطا را برمی‌گرداند و نمایش خطا + `return` در
   متد ماند (ترتیب عیناً حفظ شد).
4. **یکسان‌سازی تکرارها «با شمارش» انجام شد.** چهار نقطهٔ بازگردانی دکمهٔ ذخیره در برش C دو سطح
   تورفتگی مختلف داشتند (۶ و ۸ فاصله) ⇒ دو الگوی جدا با شمارش دقیق (۲+۲). اگر یک الگو با
   `expected=4` نوشته می‌شد، اسکریپت با خطای صریح متوقف می‌شد — و شد.
5. **گارد «یکتایی نشانگر» دو بار نجات داد.** نشانگر یکتا *پیش از برش* ممکن است پس از برش‌های
   قبلی دیگر یکتا نباشد؛ در برش C نشانگر پایانی `          }` و در برش D نشانگر `        </div>`
   تکراری بودند و به نشانگر چندخطی گسترده شدند. در هر دو مورد اسکریپت **پیش از نوشتن فایل**
   متوقف شد (نوشتن فقط در انتهای اسکریپت انجام می‌شود).
6. **نرمال‌سازی تورفتگی فقط برای کد JS.** توابع ساخته‌شده از کد ۱۰-فاصله‌ای با یک مرحلهٔ
   `shiftLeft(…, 6)` به کنوانسیون ۲ فاصله برگشتند؛ اما روی بلوک‌های HTML **هیچ** نرمال‌سازی
   اعمال نشد (فاصلهٔ HTML یعنی خروجی).
7. **CRLF هم باید یکدست شود.** فایل‌های این خوشه با `core.autocrlf=true` ممکن است روی دیسک CRLF
   باشند؛ هر اسکریپت برش اول LF می‌کند (blob مخزن LF است)، بعد برش می‌زند و گارد هم پیش از هش
   `normalizeNewlines` می‌کند.

### ه) تغییرات فایل‌ها (شش کامیت)

| کامیت | محتوا |
| --- | --- |
| `343c02a` | گارد طلایی `Frontend/halls-body-split-test.mjs` + اسنپ‌شات `docs/halls-body-golden.json` (۱۷ کِیس) + ثبت `npm run test:halls:body` در `Frontend/package.json` |
| `c16baf0` | مقاوم‌سازی گارد در برابر تفاوت پایان خط (`normalizeNewlines`) |
| `2a657c6` | برش A — بدنهٔ `generateHTML` → ۶ تابع + ثابت `REPORT_STYLE_BLOCK` |
| `046f57d` | برش B — بدنهٔ `renderHallInfo` → ۵ تابع (`resolveHallDetailNames` + چهار `buildHall*Section`) |
| `65e9564` | برش C — بدنهٔ `saveBasicInfo` → ۷ تابع (شامل دو تابع وضعیت دکمهٔ ذخیره) |
| `c7747f1` | برش D — بدنهٔ `renderUnitDetailsPanel` → ۴ تابع |

هیچ فایل دیگری تغییر نکرد: نه `halls.service.js`، نه چسب پنجره، نه `docs/service-surface.json`.

کامیت‌های مستندات این موج جدای از این شش‌تایند: `21efcfe` (همین گزارش + به‌روزرسانی `HOTSPOTS.md`،
شامل اصلاح عیب پایان‌خط همان فایل) و یک کامیت پیگیری «تکمیل پیگیری» (همین بند مبنای شمارش + ردیف
گارد طلایی در فهرست فرمان‌های `HOTSPOTS.md`). برنچ با تگ `post-body-split` بسته می‌شود — تگ روی
آخرین کامیت موج (مستندات) می‌نشیند، نه روی کامیت کد.

### و) نتیجهٔ عددی

| سنجه | پیش از موج ۳.۲d | پس از موج ۳.۲d |
| --- | --- | --- |
| متدهای بزرگ‌تر از بودجهٔ ۱۵۰ خط (`audit:big-methods`) | ۳۰ | **۲۶** |
| `generateHTML` / `renderHallInfo` / `saveBasicInfo` / `renderUnitDetailsPanel` | ۴۵۰ / ۲۵۴ / ۱۷۷ / ۱۶۵ | **۴۶ / ۲۰ / ۶۵ / ۲۲** |
| توابع کمکی ماژول‌محلی تازه | ۰ | **۲۲ تابع + ۱ ثابت** |
| سطح عمومی خوشه (`test:halls:surface`) | ۷۱ عضو · ۳۳ نام · ۱۷ ویژگی | همان (بدون تغییر) |
| گارد بایت‌به‌بایت بدنهٔ متدها | وجود نداشت | ۱۳۶ بررسی · ۱۷ کِیس |

> مبنای شمارش اعداد ستون «پیش از موج»: خروجی خودِ `npm run audit:big-methods` است (شامل خط امضا).
> در پیام کامیت‌های B/C/D عدد «پیش» با مبنای «ناحیهٔ بدنهٔ جدا‌شده» نوشته شد که یک خط کمتر می‌دهد
> (`۲۵۳` / `۱۷۶` / `۱۶۴`). اعداد «پس از موج» در هر دو مبنا یکی است (`۴۶ / ۲۰ / ۶۵ / ۲۲`) و با
> شمارش مستقیم روی دیسک هم تأیید شد.

### ز) شواهد تأیید نهایی (اجرای واقعی روی همین برنچ)

دروازهٔ کامل پس از آخرین کامیت — ۲۰ گام، همه `exit=0` و `fail=0`:

```text
lint :: exit=0                    test:halls:surface    :: pass=24    audit:size :: exit=0
test:cache :: pass=86             test:halls:body       :: pass=136   audit:dead-exports :: exit=0
test:denied :: pass=19            test:customer-fields  :: pass=22    audit:surface :: exit=0
test:toast :: pass=9              test:customer-detail  :: pass=60    audit:big-methods :: exit=0
test:weekly :: pass=118           test:hatchery-utils   :: pass=28
test:weekly:report :: pass=33     test:hatchery-surface :: pass=9
test:weekly:groups :: pass=13     test:dashboard-surface :: pass=11
test:weekly:history :: pass=9
test:weekly:surface :: pass=21
```

نکات شفافیت:

- گارد طلایی در برش B **یک رگرسیون واقعی گرفت** (حذف شرط محافظ) و همان اجرا FAIL داد؛ بدون این
  گارد، شاخهٔ «نبود داده» هر سه بخش رندر را می‌شکست.
- در برش‌های C و D، دو خطای اسکریپت (شمارش رخداد ۴ در برابر ۲ · نشانگر پایان تکراری) پیش از
  نوشتن فایل متوقف شدند؛ هیچ کامیت نیمه‌کاره ساخته نشد.
- شبه‌ویژگی موجود (`this.value` دورن‌خطی در HTML فرم ویرایش واحد) عمداً دست‌نخورده ماند؛ گارد زمان
  اجرا آن را به‌عنوان «شبه‌ویژگی DOM» می‌شناسد.

### ح) یادداشت نگه‌داری و گام بعدی

- **گارد دائمی این موج `npm run test:halls:body` است.** اگر روزی رفتار خروجی عمداً تغییر کرد،
  ابتدا `npm run test:halls:body -- --snapshot` و بعد توضیح تغییر در پیام کامیت (مثل موج ۳.۲c).
- **الگوی «برش بدنه» اکنون آماده است:** اسکریپت برش با نشانگرهای خط‌محور + گارد طلایی پیش از برش
  + گارد یکتایی نشانگر + نرمال‌سازی LF. بهترین نامزدهای بعدی: `weeklyRenderer.renderFullReport`
  (۵۲۴ خط)، `hatcheryCompletionPeriodMethods.editPeriodCompletion` (۳۶۵ خط) و
  `weeklyHistoryHtmlMethods.buildWeeklyHistoryHTML` (۳۳۶ خط).
- ابزارهای موقت این موج (اسکریپت‌های `CUT_*.mjs` و تحلیل‌گرها) در پوشهٔ `.git/` ماندند؛ **بخشی از
  درخت کاری نیستند** (نه کامیت می‌شوند، نه `git status` را آلوده می‌کنند).

## ۱۶) موج ۳.۲e — برش بدنهٔ بزرگ‌ترین متد مخزن: `weeklyRenderer.renderFullReport`

> ادامهٔ مستقیم بخش ۱۵ با همان الگو (گارد اول، بعد برش)، این‌بار روی متدی که چهار closure
> تودرتو دارد و به «ساعت سیستم» وابسته است.

### الف) هدف و معیار موفقیت

| مورد | پیش از موج | پس از موج |
| --- | --- | --- |
| `weeklyRenderer.renderFullReport` (`weekly.renderer.js:746`) | ۵۲۴ خط (بزرگ‌ترین متد مخزن) | **۱۳۹ خط** |
| متدهای بزرگ‌تر از بودجهٔ ۱۵۰ خط (`audit:big-methods`) | ۲۶ | **۲۵** |
| توابع کمکی ماژول‌محلی تازه | ۰ | **۱۰** |
| سطح عمومی (`audit:surface`) | ۰ گم‌شده · ۰ افزوده · ۰ نقض | همان (بی‌تغییر) |
| خروجی HTML | فاقد گارد بایت‌به‌بایت | گارد `npm run test:weekly:body` (۶۷ بررسی · ۱۲ کِیس) |

### ب) گارد پیش از برش — هارنس طلایی `test:weekly:body`

- `Frontend/weekly-body-split-test.mjs` با استاب حداقلی مرورگر (هم‌سان با
  `weekly-report-render-smoke.mjs` موجود) و ⚠️ **تثبیت ساعت**: کلاس `Date` استاب می‌شود و
  `process.env.TZ` روی `Asia/Tehran` قفل می‌گردد — چون متد `now`/`nowTime` را از
  `new Date().toLocaleDateString/TimeString("fa-IR")` می‌سازد و بدون تثبیت، هیچ اسنپ‌شاتی
  پایدار نیست. خودآزمون «دو اجرای متوالی کِیس اصلی هش یکسان می‌دهند» همین را اثبات می‌کند.
- ۱۲ کِیس از فیکسچرهای موجود چهار تست هفتگی: گزارش کامل دو سالن + جدول «کل گله» · بدون
  آرگومان گروه · گپ و هفتهٔ ناقص · فقط وزن · همهٔ گروه‌ها صریح · بازهٔ هفته · گلهٔ بدون هفتهٔ
  انتخابی · انتخاب هرگله · ترتیب معکوس سالن‌ها · حالت خالی · کاربر ناشناس · مشتری ناقص.
- اسنپ‌شات `docs/weekly-body-golden.json` (sha256 + bytes هر کِیس) پیش از برش، با تگ
  `pre-weekly-body-split`. وابستگی locale/ICU/TZ در `note2` سند ثبت شده است.

### پ) برش‌ها (شش کامیت)

| کامیت | محتوا |
| --- | --- |
| `becb797` | گارد طلایی `weekly-body-split-test.mjs` + اسنپ‌شات (۱۲ کِیس) + ثبت `npm run test:weekly:body` (تگ `pre-weekly-body-split`) |
| `08acd97` | برش A — `renderMetricsTable` → `buildMetricsTableHtml` (۸۰ خط) |
| `1def99b` | برش B1 — `toPersian` → `toPersianDate` (۱۲ خط) |
| `dce26bf` | برش B2 — حلقهٔ هر گله (۱۵۲ → ۱۹ خط) → `resolveFlockReportContext` · `buildWeekDetailRows` · `buildFlockSectionHtml` |
| `26ba07a` | برش C — بخش «کل گله» + مونتاژ (۱۲۸ → ۱۳ خط) → `buildGroupSectionHtml` · `mergeReportSections` |
| `cfc8007` | برش D — مقدمه (۳۰ → ۱۲) و یادداشت‌های پای گزارش (۳۳ → ۸) → `resolveReportContext` · `buildGroupsNoteHtml` · `buildGapsSummaryHtml` |

هیچ فایل دیگری تغییر نکرد: نه `weekly.service.js`، نه چسب پنجره، نه `docs/service-surface.json`.

### ت) درس تازهٔ این موج: «dedent ممنوع» (وقتی خط اسلات وجود ندارد)

در موج ۳.۲d (برش بدنهٔ خوشهٔ سالن‌ها) هر بلوک در «خط اسلات» با تورفتگی بیشتر می‌نشست و همان
فاصله‌ها را برمی‌گرداند؛ پس `dedent` بی‌خطر بود. اینجا کل یک تابع منتقل می‌شود و فاصله‌های
داخل رشته‌های template **بخشی از خروجی HTML**اند: انتقال با `dedent 4`، ۱۰ بررسی گارد را
قرمز کرد (کاهش ۹۶ تا ۳۳۶ بایت در خروجی کِیس‌ها). قاعدهٔ ثابت‌شده: **انتقال verbatim بدون
dedent**؛ و همین هشدار در سرصفحهٔ بخش کمکی فایل ثبت شد.

### ث) تله‌هایی که گیت‌های خودِ اسکریپت گرفتند (شفافیت)

1. برش A (dedent) → ۱۰ بررسی گارد قرمز ⇒ بازگردانی از بکاپ و انتقال verbatim.
2. برش B1: بررسی «یکتایی» بدنهٔ منتقل‌شده بی‌معنا بود (همان بدنه در متد `renderFlockReport` هم
   هست) ⇒ با «تغییر نسبی شمارش» جایگزین شد؛ همچنین شمارش صداکننده‌ها ۴ بود نه ۳.
3. برش C: (الف) نشانگر مقایسهٔ payload با خط `html: ""` شاخهٔ حذف هم تطبیق می‌کرد ⇒ نشانگر
   یکتا شد. (ب) خط `      }` بستن شرط در جایگزینی جا افتاد ⇒ خطای نحوی؛ گارد ساختاری پیش از
   نوشتن فایل آن را گرفت.
4. برش D: خط اعلان `const selected = normalizeGroups(...)` (خط ۷۴۷) از بازهٔ انتقال جا افتاد ⇒
   `ReferenceError: selected is not defined` در گارد زمان اجرا؛ اصلاح و بازاجرا.

هیچ کامیت نیمه‌کاره‌ای ساخته نشد و همهٔ برش‌ها با «بازسازی معکوس == اصل» بایت‌به‌بایت اثبات شدند.

### ج) شواهد تأیید نهایی (دروازهٔ ۲۱ گامی پس از آخرین کامیت)

```text
lint :: exit=0                    test:weekly:surface   :: pass=21    audit:size :: exit=0
test:cache :: pass=86             test:weekly:body      :: pass=67    audit:dead-exports :: exit=0
test:denied :: pass=19            test:halls:surface    :: pass=24    audit:surface :: exit=0
test:toast :: pass=9              test:halls:body       :: pass=136   audit:big-methods :: exit=0
test:weekly :: pass=118           test:customer-fields  :: pass=22
test:weekly:report :: pass=33     test:customer-detail  :: pass=60
test:weekly:groups :: pass=13     test:hatchery-utils   :: pass=28
test:weekly:history :: pass=9     test:hatchery-surface :: pass=9
                                  test:dashboard-surface :: pass=11
```

### ح) یادداشت نگه‌داری و گام بعدی

- **گارد دائمی این موج `npm run test:weekly:body` است.** اگر رفتار خروجی عمداً تغییر کرد،
  ابتدا `npm run test:weekly:body -- --snapshot` و بعد توضیح تغییر در پیام کامیت.
- ⚠️ اسنپ‌شات این گارد به locale/ICU و منطقهٔ زمانی محیط Node وابسته است (تاریخ شمسی و ارقام
  فارسی)، پس مقایسه فقط در همان محیطی معنا دارد که اسنپ‌شات گرفته شده است.
- نامزدهای بعدی همین الگو: `hatcheryCompletionPeriodMethods.editPeriodCompletion` (۳۶۵ خط)،
  `weeklyHistoryHtmlMethods.buildWeeklyHistoryHTML` (۳۳۶) و `weeklyCardMethods.renderWeeks` (۳۰۴).
- ابزارهای این موج (اسکریپت‌های `CUT_W*.mjs` و `DOCS_WE.mjs`) در پوشهٔ `.git/` ماندند و بخشی از
  درخت کاری نیستند.

## ۱۷) موج ۳.۲f — برش بدنهٔ دو متد غول خوشهٔ پایان دوره (`completePeriod` + `editPeriodCompletion`)

> ادامهٔ مستقیم بخش ۱۶ با همان الگو (گارد اول، بعد برش)، این‌بار روی متدهایی که به Swal،
> `document`، jQuery و دو API وابسته‌اند و «رکورد ساختاری» می‌سازند (نه یک رشتهٔ ساده).

### الف) هدف و اعداد

| متد | پیش | پس |
| --- | --- | --- |
| `hatcheryCompletionPeriodMethods.completePeriod` | ۲۷۸ | **۲۳** |
| `hatcheryCompletionPeriodMethods.editPeriodCompletion` | ۳۶۵ | **۵۷** |
| متدهای بزرگ‌تر از بودجهٔ ۱۵۰ (`audit:big-methods`) | ۲۵ | **۲۳** |
| ثابت/کمکی ماژول‌محلی تازه | ۰ | **۱۵** |
| سطح عمومی (`audit:surface`) | ۰ گم‌شده · ۰ افزوده · ۰ نقض | همان (بی‌تغییر) |
| خروجی/رکورد | فاقد گارد | `npm run test:hatchery:body` (۹۶ بررسی · ۲۲ کِیس) |

### ب) گارد قبل از برش — رکورد بایت‌به‌بایت `test:hatchery:body`

- `Frontend/hatchery-completion-body-split-test.mjs`: استاب `window/document/localStorage` +
  **DOM فیلد‌محور** (هر کِیس مقادیر `ue*`/`cf*` را می‌چیند) + استاب **`Swal.fire`** که `options` را
  ثبت می‌کند و `didOpen`/`preConfirm` را واقعاً اجرا می‌کند + استاب `$`/`persianDatepicker`
  (روشن/خاموش در هر کِیس) + **تثبیت ساعت** و قفل `process.env.TZ = "Asia/Tehran"`.
- ۲۲ کِیس: ۱۴ برای `editPeriodCompletion` (رکورد کامل/قدیمی/چندگله/بدون داده · شش مسیر
  اعتبارسنجی · ذخیرهٔ موفق/ناموفق/استثنا · کلیک محاسبهٔ مجدد) و ۸ برای `completePeriod`
  (موفق دو گله · دورهٔ ناموجود · بدون گلهٔ فعال · بدون انتخاب · تاریخ معکوس · ناموفق · استثنا · انصراف).
- رکورد هر کِیس = JSON (فرم HTML + خروجی `preConfirm` + فراخوانی‌های API + اعلان‌ها +
  پیام‌های اعتبارسنجی + console) ⇒ `sha256` در `docs/hatchery-completion-body-golden.json`.

### پ) برش‌ها (شش کامیت)

| کامیت | محتوا |
| --- | --- |
| `a85fd77` | گارد طلایی + اسنپ‌شات ۲۲ کِیس + `npm run test:hatchery:body` + گام دروازه (تگ `pre-completion-body-split`) |
| `35deea5` | برش A — دو بلوک `<style>` ثابتِ فرم‌ها → `UE_FORM_STYLE_BLOCK` · `CF_FORM_STYLE_BLOCK` |
| `3e34e2a` | برش B — قالب ۱۳۸ خطی فرم ویرایش → `buildCompletionEditFormHtml` |
| `25e1061` | برش C — Swal/payload/ذخیرهٔ ویرایش → سه کمکی (`editPeriodCompletion` از بودجه بیرون آمد) |
| `bf86a84` | برش D — حل دوره + `flockOptions` + `periodInfo` + قالب اتمام دوره → چهار کمکی |
| `0372d2b` | برش E — Swal/payload/ذخیرهٔ اتمام دوره → پنج کمکی (`completePeriod` بیرون از بودجه) |

### ت) چهار تلهٔ واقعی که گیت‌ها گرفتند (شفافیت)

1. **مرز «محتوا» و «تگ» در CSS درون‌خطی:** نسخهٔ اول برش A کل `<style>…</style>` را جایگزین
   می‌کرد ولی ثابت فقط «محتوا» را داشت ⇒ اثبات رفت‌وبرگشت `false` شد؛ با جایگزینی ناحیهٔ درونی
   (و ثابت‌ماندن تگ‌ها) درست شد.
2. **تلهٔ سطح سرویس در برش B:** `_ueSlaughterSectionHtml` با `service.…` صدا زده شد و
   `audit:surface` «گم‌شده → ویژگی ۱» داد (این ابزار ویژگی‌ها را از متن `this.X` می‌خواند).
   راه‌حل: همان **الگوی wrapper** موج ۳.۲d — `(a, b) => this._ueSlaughterSectionHtml(a, b)`.
3. **متغیرهای scope متد در برش C:** `slaughterDate`/`slaughterEndDate` که در `preConfirm` اعلان
   می‌شدند در کمکی payload نبودند ⇒ ۱۸ بررسی گارد قرمز + دو خطای `lint` (`no-undef`).
4. **return فراموش‌شده در برش E:** کمکی `readSelectedPeriodFlocks` بدون `return` ساخته شد ⇒
   ۱۷ بررسی گارد قرمز + یک warning؛ با `return` صریح، گارد ۹۶/۹۶ و lint تمیز شد.

هیچ کامیت نیمه‌کاره‌ای ساخته نشد؛ هر برش با «بازسازی معکوس == اصل» و «سطرهای verbatim» اثبات شد.

### ث) شواهد تأیید نهایی (دروازهٔ ۲۲ گامی پس از آخرین کامیت کد)

```text
lint :: exit=0                    test:weekly:body     :: pass=67    audit:size :: exit=0
test:cache :: pass=86             test:halls:surface   :: pass=24    audit:dead-exports :: exit=0
test:denied :: pass=19            test:halls:body      :: pass=136   audit:surface :: exit=0
test:toast :: pass=9              test:hatchery:body   :: pass=96    audit:big-methods :: exit=0 (۲۳ متد)
test:weekly :: pass=118           test:customer-fields :: pass=22
test:weekly:report :: pass=33     test:customer-detail :: pass=60
test:weekly:groups :: pass=13     test:hatchery-utils  :: pass=28
test:weekly:history :: pass=9     test:hatchery-surface :: pass=9
test:weekly:surface :: pass=21    test:dashboard-surface :: pass=11
```

### ج) یادداشت نگه‌داری و گام بعدی

- **گارد دائمی این موج `npm run test:hatchery:body` است.** اگر رفتار عمداً تغییر کرد، ابتدا
  `npm run test:hatchery:body -- --snapshot` و بعد توضیح تغییر در پیام کامیت.
- ⚠️ اسنپ‌شات به locale/ICU/TZ و ساختار DOM محیط Node وابسته است؛ مقایسه فقط در همان محیطی
  معنا دارد که اسنپ‌شات گرفته شده است.
- نامزدهای بعدی همین الگو: `buildWeeklyHistoryHTML` (۳۳۶) · `renderWeeks` (۳۰۴) ·
  `showCreateBookmarkModal` (۲۸۴) · `buildFlockSmsReportHTML` (۲۷۷).

## ۱۸) موج ۳.۲g — برش بدنهٔ متد غول تاریخچهٔ هفتگی (`buildWeeklyHistoryHTML`)

> ادامهٔ مستقیم بخش ۱۷ با همان الگو (گارد اول، بعد برش) — این‌بار روی متدی که یک رشتهٔ
> بزرگ HTML می‌سازد، دوباره «مبنا/چیپ/ماتریس» دارد و به `new Date()` وابسته است.

### الف) هدف و اعداد

| مورد | پیش از موج | پس از موج |
| --- | --- | --- |
| `weeklyHistoryHtmlMethods.buildWeeklyHistoryHTML` (`weekly.report.history.html.js:36`) | ۳۳۶ خط (بزرگ‌ترین متد مخزن) | **۱۳۱ خط** |
| متدهای بزرگ‌تر از بودجهٔ ۱۵۰ (`audit:big-methods`) | ۲۳ | **۲۲** |
| کمکی/ثابت ماژول‌محلی تازه | ۰ | **۷** |
| سطح عمومی (`audit:surface`) | ۰ گم‌شده · ۰ افزوده · ۰ نقض | همان (بی‌تغییر) |
| خروجی HTML | فاقد گارد بایت‌به‌بایت | `npm run test:weekly:history:body` (۵۷ بررسی · ۱۲ کِیس) |

### ب) گارد پیش از برش — `test:weekly:history:body`

- `Frontend/weekly-history-body-split-test.mjs`: هارنس روی `weeklyService` با استاب حداقلی مرورگر
  (هم‌سان با `weekly-history-render-test.mjs`) + **تثبیت ساعت** (`Date` استاب) + قفل
  `process.env.TZ = "Asia/Tehran"` — چون متد `new Date()` و `Intl.DateTimeFormat("fa-IR")`
  (تاریخ/ساعت شمسی) می‌سازد؛ خودآزمون «دو اجرای متوالی هش یکسان» همین را اثبات می‌کند.
- ۱۲ کِیس: حالت پایه · کاربر لاگین‌شده · انتخاب هفته + گروه · گلهٔ بدون انتخاب · ترتیب سالن‌ها ·
  دو گله · رکورد حداقلی/تهی · بلوک خالی · مشتری ناقص · همهٔ گروه‌ها صریح · انتخاب مشترک + سفارشی ·
  دو گله با انتخاب مجزا ⇒ اسنپ‌شات `docs/weekly-history-body-golden.json` (sha256 + bytes کل HTML).

### پ) برش‌ها (سه کامیت)

| کامیت | محتوا |
| --- | --- |
| `ed823fc` | گارد طلایی + اسنپ‌شات ۱۲ کِیس + `npm run test:weekly:history:body` + گام دروازه (تگ `pre-history-body-split`) |
| `88b40e7` | برش A — مقدمه (۹۰ خط) → `resolveHistoryReportContext` + `fmtCountFa` + `toPersianShortDate` + `HISTORY_REPORT_STYLE_BLOCK` |
| `0fc2e34` | برش B — حلقهٔ گله/سالن (۱۶۳ → ۴۳ خط) → `resolveHistoryFlockContext` · `buildHistoryHallHtml` · `buildHistoryFlockSectionHtml` |

### ت) تله‌های واقعی که گیت‌ها گرفتند (شفافیت)

1. **ناحیهٔ جاافتاده:** بلوک `weekSelectionSummary`/`weekSelectionNote` از بازهٔ انتقال برش A بیرون
   مانده بود ⇒ `ReferenceError` در گارد ⇒ بازاجرا با سه‌ناحیه‌ای‌کردن مقدمه.
2. **آفست‌های بی‌اعتبار پس از تغییر نام:** `fmtCount`→`fmtCountFa` و `toPersianShort`→`toPersianShortDate`
   **طول متن** را عوض می‌کنند ⇒ آفست‌های خطی محاسبه‌شده روی متن اصلی غلط شدند؛ اثباتِ خودِ اسکریپت
   («بازسازی معکوس == اصل») آن را پیش از نوشتن فایل گرفت.
3. **متغیر بلااستفاده در destructuring** (`weekSelectionSummary`) ⇒ warning از lint ⇒ حذف شد.
4. **برش ناحیهٔ callback** یک خط جابه‌جا (۱۱۷..۱۸۳ در برابر ۱۱۸..۱۸۲) ⇒ assert پایان ناحیه آن را گرفت.
5. **`{ html: ` جاافتاده در `return` قالب سالن** ⇒ خطای نحوی (پارسر lint) و توقف گارد.
6. **رشتهٔ نام گلهٔ حذف‌شده از متن اصلی (با `b.`)** ساخته می‌شد ⇒ `ReferenceError` ⇒ اعمال همان تغییر نام.

هیچ کامیت نیمه‌کاره‌ای ساخته نشد؛ هر برش با «بازسازی معکوس == اصل» + قطعات کلیدی + گارد ۵۷/۵۷ اثبات شد.

### ث) شواهد تأیید نهایی (دروازهٔ ۲۳ گامی)

```text
lint :: exit=0                    test:weekly:history:body :: pass=57    audit:size :: exit=0
test:cache :: pass=86             test:weekly:surface  :: pass=21        audit:dead-exports :: exit=0
test:denied :: pass=19            test:weekly:body     :: pass=67        audit:surface :: exit=0
test:toast :: pass=9              test:halls:surface   :: pass=24        audit:big-methods :: exit=0 (۲۲ متد)
test:weekly :: pass=118           test:halls:body      :: pass=136
test:weekly:report :: pass=33     test:hatchery:body   :: pass=96
test:weekly:groups :: pass=13     test:customer-fields :: pass=22
test:weekly:history :: pass=9     test:customer-detail :: pass=60
                                  test:hatchery-utils  :: pass=28
                                  test:hatchery-surface :: pass=9
                                  test:dashboard-surface :: pass=11
```

### ج) یادداشت نگه‌داری و گام بعدی

- **گارد دائمی این موج `npm run test:weekly:history:body` است.** اگر رفتار عمداً تغییر کرد، ابتدا
  `npm run test:weekly:history:body -- --snapshot` و بعد توضیح تغییر در پیام کامیت.
- ⚠️ اسنپ‌شات به locale/ICU/TZ محیط Node وابسته است؛ مقایسه فقط در همان محیطی معنا دارد که
  اسنپ‌شات گرفته شده است.
- نامزدهای بعدی همین الگو: `weeklyCardMethods.renderWeeks` (۳۰۴) ·
  `dashboardBookmarkMethods.showCreateBookmarkModal` (۲۸۴) · `buildFlockSmsReportHTML` (۲۷۷) ·
  `chartDashboardRenderer.renderContainer` (۲۴۹) · `weeklyRenderer.renderFlockReport` (۲۴۲).

---

## ۱۹) موج ۳.۲h — برش بدنهٔ متد غول کارت‌های هفتگی (`weeklyCardMethods.renderWeeks`)

### الف) هدف و اعداد

`weeklyCardMethods.renderWeeks` در `weekly.cards.js:92` با **۳۰۴ خط** بزرگ‌ترین متد مخزن بود و
عضو خوشهٔ «کارت‌های هفتگی» محسوب می‌شد. ساختار داخلی‌اش یک ویژگی کم‌نظیر داشت: به‌جای آنکه قالب هر
هفته را مستقیماً در حلقه بسازد، سازندهٔ آیتم را در `this._weekItemBuilders[flockId]` ذخیره می‌کرد
تا `showMoreWeeks` هم بتواند از همان استفاده کند — یعنی ~۲۷۳ خط از بدنهٔ متد «در سکوت» زندگی
می‌کرد و هر گاردی که فقط `return` متد را می‌دید، بخش عمدهٔ رفتار را پوشش نمی‌داد.

| سنجه | پیش | پس |
| --- | --- | --- |
| `renderWeeks` | ۳۰۴ خط | **۳۰ خط** (−۹۰٪) |
| خطوط جابه‌جاشده به کمکی | — | ۲۷۳ خط / ۲۰٬۸۷۲ بایت |
| توابع کمکی ماژول‌محلی تازه | — | ۱ (`buildWeekAccordionItemHtml`) |
| `audit:big-methods` | ۲۲ متد | **۲۱ متد** (بزرگ‌ترین: `showCreateBookmarkModal` ۲۸۴) |
| `weekly.cards.js` | ۳۴.۵KB / ۶۷۷ خط | ۳۵.۲KB / ۶۸۵ خط |

### ب) گارد پیش از برش — `test:weekly:cards:body`

پیش از هر تغییر، گارد طلایی بایت‌به‌بایت نوشته شد (کامیت `d864d8e`، تگ `pre-cards-body-split`):

- `Frontend/weekly-cards-body-split-test.mjs` با **۸ کِیس** و **۳۷ بررسی**، اسنپ‌شات
  `docs/weekly-cards-body-golden.json` (هش `sha256`).
- **کشف کلیدی:** ضبط خروجی فقط با `renderWeeks(...)` کافی نبود (چون قالب آیتم در
  `_weekItemBuilders` است). هارنس هر کِیس را به‌شکل
  `{ html, items[], weeksShown, builderStored }` ضبط می‌کند: `html` خروجی متد · `items` با
  صدا زدن سازندهٔ ذخیره‌شده برای هر هفته (پوشش ~۲۵۰ خط قالب) · `weeksShown` وضعیت بوک‌کیپینگ ·
  `builderStored` وجود سازنده.
- محیط قطعی‌سازی‌شده: `Date` فریز روی `2026-06-15T06:30Z` · `TZ=Asia/Tehran` ·
  استاب `authService.getUserRole`/`getUserId` برای شاخهٔ کارشناس.
- ۸ کِیس: ۳ هفته (نقش admin) · «نمایش بیشتر» (۱۲ هفته در برابر پیش‌فرض ۱۰) · صفر هفته · نقش
  کارشناس · ثبت‌شده روی یک هفته (`data-selected`) · پیش‌فرض ۳ · مقادیر خالی · دو گلهٔ همزمان
  (اثبات جدایی وضعیت `weeksShown`/`_weekItemBuilders` بین گله‌ها).

### پ) برش A (یک کامیت اتمی)

- کل بدنهٔ سازنده (خطوط ۱۰۴..۳۷۶) به کمکی ماژول‌محلی زیر منتقل شد:
  `const buildWeekAccordionItemHtml = (flockId, week) => { … };`
  با **پارامترهای صریح** و بدون هیچ ارجاعی به `this` (پیش‌بررسی اسکریپت: اگر `this.` پیدا
  می‌شد، برش متوقف می‌شد).
- در متد فقط پوسته‌ای دو خطی ماند:
  `this._weekItemBuilders[flockId] = (week) => buildWeekAccordionItemHtml(flockId, week);`
  ⇒ ارجاع‌های `this._weekItemBuilders` (خط ۱۰۲ برای مقداردهی اولیه + پوسته + `.map(...)` در
  حلقهٔ رندر) عیناً در متد باقی ماندند و `audit:surface` صفر/صفر/صفر ماند.
- **قاعدهٔ verbatim:** متن قالب با تورفتگی اصلی (۶ فاصله) و بدون هیچ dedent منتقل شد؛ فاصله‌های
  داخل template literal بخشی از خروجی HTML‌اند و کوتاه‌کردنشان گارد بایت‌به‌بایت را می‌شکست.
- اثبات اسکریپت برش: «جایگزینی پوستهٔ جدید با ناحیهٔ اصلی، متن فایل را بایت‌به‌بایت بازمی‌سازد»
  ✓ · «بدنهٔ قالب در متن کمکی verbatim حاضر است» ✓ · «دقیقاً یک اعلان و یک فراخوانی» ✓ ·
  «شمارش `this._weekItemBuilders` در متد = ۴» ✓ · «فایل بدون CR» ✓.
- چون متد با ۳۰ خط از بودجهٔ ۱۵۰ بیرون رفت، برش B (جدا کردن سر/دم متد) لازم نشد.

### ت) تله‌های واقعی که گیت‌ها گرفتند (شفافیت)

1. **شمارش ارجاع‌ها:** اسکریپت انتظار ۳ ارجاع `this._weekItemBuilders` در متد داشت (مقداردهی
   اولیه + پوسته + حلقه)، اما خط ۱۰۲ دو ارجاع در **یک خط** دارد
   (`this._weekItemBuilders = this._weekItemBuilders || {};`) ⇒ واقعیت ۴ بود. assert پیش از
   نوشتن فایل متوقف شد (به‌جای کامیت خراب) و انتظار اصلاح شد.
2. **هاردکد نکردن نتیجهٔ «قبل»:** همان درس موج ۳.۲g — آفست‌ها روی متنِ پس از «جایگزینی‌های
   هم‌زمان» محاسبه می‌شوند؛ اینجا چون هیچ تغییر نامی نداشتیم، ناحیهٔ انتقال تک‌تکه و مستقل بود و
   همین تله تکرار نشد.

### ث) شواهد تأیید نهایی (دروازهٔ ۲۴ گامی — اولین موج با گارد `test:weekly:cards:body`)

```text
lint :: exit=0                    test:weekly:history:body :: pass=57   audit:size :: exit=0
test:cache :: pass=86             test:weekly:cards:body   :: pass=37   audit:dead-exports :: exit=0
test:denied :: pass=19            test:weekly:surface      :: pass=21   audit:surface :: exit=0
test:toast :: pass=9              test:weekly:body         :: pass=67   audit:big-methods :: exit=0 (۲۱ متد)
test:weekly :: pass=118           test:halls:surface       :: pass=24
test:weekly:report :: pass=33     test:halls:body          :: pass=136
test:weekly:groups :: pass=13     test:hatchery:body       :: pass=96
test:weekly:history :: pass=9     test:customer-fields     :: pass=22
                                  test:customer-detail     :: pass=60
                                  test:hatchery-utils      :: pass=28
                                  test:hatchery-surface    :: pass=9
                                  test:dashboard-surface   :: pass=11
```

`audit:surface` در این موج ۰ گم‌شده · ۰ افزوده · ۰ نقض داد. رویداد ضبط گارد
`{ html, items[], weeksShown, builderStored }` تنها رویداد گارد مخزن است که خروجی یک **کلوژر
ذخیره‌شده روی نمونه** را هم بایت‌به‌بایت قفل می‌کند.

### ج) یادداشت نگه‌داری و گام بعدی

- **گارد دائمی این موج `npm run test:weekly:cards:body` است.** اگر رفتار عمداً تغییر کرد، ابتدا
  `npm run test:weekly:cards:body -- --snapshot` و بعد توضیح تغییر در پیام کامیت.
- ⚠️ مثل گاردهای قبلی، اسنپ‌شات به locale/ICU/TZ محیط Node وابسته است؛ مقایسه فقط در همان
  محیطی معنا دارد که اسنپ‌شات گرفته شده است.
- نکتهٔ الگو برای برش‌های بعدی: اگر متد «قالب را در نمونه/کلوژر ذخیره» می‌کند، گارد باید **هم
  خروجی متد و هم خروجی سازندهٔ ذخیره‌شده** را ضبط کند؛ در غیر این صورت بیشترین حجم بدنه
  پوشش‌داده‌نشده می‌ماند.
- نامزدهای بعدی: `dashboardBookmarkMethods.showCreateBookmarkModal` (۲۸۴) ·
  `buildFlockSmsReportHTML` (۲۷۷) · `chartDashboardRenderer.renderContainer` (۲۴۹) ·
  `weeklyRenderer.renderFlockReport` (۲۴۲).


