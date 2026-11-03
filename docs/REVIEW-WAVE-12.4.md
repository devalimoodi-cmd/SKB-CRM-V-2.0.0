# گزارش موج ۱۲.۴ — «تاریخچهٔ رکورد» در بستر (۱۲.۴.۱) + تقویم شمسی و شناسهٔ رکورد (۱۲.۴.۲)

> این سند دو زیرفاز را پوشش می‌دهد: **۱۲.۴.۱** (دیالوگ تاریخچه — بخش‌های ۱ تا ۷) و
> **۱۲.۴.۲** (شناسهٔ رکورد از بدنهٔ پاسخ + تقویم شمسی فیلتر تاریخ — بخش ۸ و ۹).

## ۱) ریشهٔ مشکل (چرا این زیرفاز لازم بود)

زیرفاز ۱۲.۳ پنل «فعالیت کاربران» را ساخت، اما **همهٔ راه‌ها به یک منو ختم می‌شد**. برای پاسخ به
سؤال اصلی («چه کسی این مشتری/کاربر را عوض کرد؟») کاربر باید دستی به سایدبار پنل می‌رفت،
موجودیت و `entity_id` را در فیلتر تایپ می‌کرد و «اعمال» می‌زد. این کار در عمل انجام نمی‌شد.

نتیجه: همان دادهٔ حسابرسی که در ۱۲.۲ ساخته شد و در ۱۲.۳ نمای خواندن گرفت، در نقطهٔ تصمیم
(وسط کارِ روزمرهٔ مدیر/کارشناس) غایب بود. ۱۲.۴.۱ این فاصله را برمی‌دارد: تاریخچه **در همان جایی
که رکورد دیده می‌شود** باز می‌شود.

## ۲) چه ساخته شد

| قابلیت | جزئیات |
|---|---|
| دیالوگ مشترک | `ActivityHistoryDialog` — یک مارک‌آپ، دو نقطهٔ ورود (پنل ادمین + پروندهٔ مشتری) |
| تب ۱ | **«تغییرات این رکورد»** — فیلتر `entity` + `entityId` |
| تب ۲ | **«فعالیت‌های این کاربر»** — فیلتر `userId` (شامل ورود/خروج که `entity_id` ندارند) |
| آمار یک‌خطی | «N رویداد · M ناموفق · آخرین: X دقیقه پیش» از `historyStats` |
| ردیف‌ها | زمان مطلق + نسبی، عمل، بازیگر، وضعیت، خلاصه، تعداد فیلدهای تغییرکرده، لینک گیت‌شدهٔ رکورد |
| خروجی | CSV همان چیزی که دیده می‌شود (با `\uFEFF` برای اکسل فارسی) |
| «مشاهدهٔ کامل» | پل به بخش ۱۲.۳: داخل پنل با صف مدیر، بیرون پنل با `sessionStorage` |
| نقاط ورود | دکمهٔ «تاریخچه» در هر ردیف **هر دو** جدول کاربران/مدیران اصلی + دکمهٔ «تاریخچهٔ تغییرات» در هدر پروندهٔ مشتری |

## ۳) تغییرات (فایل‌به‌فایل)

### فرانت‌اند — منطق و رندر
- `Frontend/src/features/activity-log/activity-log.view.js` — افزودهٔ منطق خالص موج:
  `HISTORY_LIMIT` (۲۰)، `HISTORY_MODES`، `HISTORY_HANDOFF_KEY`، `historyContext` (⭐ `entity`/`entityId`
  اجباری ⇒ زمینهٔ نامعتبر `null`)، `historyQuery` (allowlist کلید)، `historyTitle`، `historyStats`
  (⭐ ناموفق‌ها با `success === false`)، `packHistoryHandoff` / `readHistoryHandoff`
  (allowlist چهار کلیدی + سقف طول + `try/catch` ⇒ ضد prototype pollution).
- `Frontend/src/features/activity-log/activity-log.renderer.js` — `renderHistoryShell`،
  `renderHistoryTabs`، `renderHistoryList` با `escapeHtml` روی **هر** مقدار سرور و `tone` از whitelist.
- `Frontend/src/features/activity-log/activity-log.history.js` (**جدید**) — `ActivityHistoryDialog`:
  mount تنبل در `document.body`، `open/close/switchMode/load/exportCsv/openFull`،
  `mountCustomerTrigger` + `refreshCustomerTrigger` (دکمه فقط با شناسهٔ معتبر و مجوز).
- `Frontend/src/features/activity-log/activity-log.history.css` (**جدید**) — فقط `alp-hist-*` و
  `customer-history-*`؛ ⚠️ صفحهٔ پروندهٔ مشتری استایل پنل را لود نمی‌کند، پس این فایل **خودبسنده** است.
- `Frontend/src/features/activity-log/activity-log.manager.js` — `queueHistory` / `pendingHistory` /
  `applyPendingHistory`؛ `init` صف را پس از `refresh` اعمال می‌کند. امضای
  `openEntityHistory(entity, entityId)` حفظ شد (گارد ۱۲.۳) و اکنون به صف واگذار می‌کند
  (⭐ باگ قبلی: بدون `root` بی‌صدا هیچ کاری نمی‌کرد).

### فرانت‌اند — سیم‌کشی
- `Frontend/src/features/admin-panel/admin-panel.renderer.js` — `historyButton(user)` در هر دو جدول،
  با گیت `users.activity.view` (fail-open اگر دادهٔ مجوز نرسیده باشد).
- `Frontend/src/features/admin-panel/admin-panel.service.js` — `showUserHistory(id)` (import داینامیک
  دیالوگ)، `window.showUserHistory`، `takePendingHistory()` (خواندن + پاک‌کردن کلید یک‌بارمصرف)
  و `applyPendingHistory(context)`؛ در `init` **قبل از** `setupSidebar()` خوانده می‌شود تا
  `selectedMenu = "activity-log"` و **بعد از** آماده‌شدن پنل اعمال می‌شود (بدون `setTimeout`).
- `Frontend/src/pages/admin-panel.html` — لینک `activity-log.history.css`.
- `Frontend/src/pages/customer-info.html` — لینک CSS + `#customerHistoryBtn` (به‌صورت `hidden`)
  + `<script type="module" src=".../activity-log.history.js">`.

### تست و گیت
- `Frontend/activity-history-guard-test.mjs` (**جدید**) — `npm run test:activity:history`.
- `Frontend/package.json` — اسکریپت `test:activity:history`.
- `tools/gate.mjs` + `tools/gate.ps1` — گام `test:activity:history` بعد از `test:activity:panel`
  (**۳۸ ⇒ ۳۹ گام**).

## ۴) تصمیم‌های فنی (چرا این‌طور، نه آن‌طور)

1. **دیالوگ، نه صفحهٔ جدید** — پرسش «چه کسی عوض کرد؟» وسط کار پیش می‌آید؛ ترک صفحه یعنی از دست
   رفتن فرم/فیلترهای نیمه‌کاره. دیالوگ هزینهٔ ناوبری صفر دارد و همان مارک‌آپ در دو صفحه کار می‌کند.
2. **CSS خودبسنده (`alp-hist-*`)** — پروندهٔ مشتری نه `admin-panel.css` را لود می‌کند و نه
   `activity-log.css` را؛ استفاده از `.data-table`/`.alp-badge` یعنی جدولِ بی‌استایل. بنابراین کلاس‌های
   دیالوگ مستقل تعریف شدند (گارد هم قفلش می‌کند).
3. **پل `sessionStorage` با allowlist** — رفتن به پنل یعنی از دست رفتن زمینه در ناوبری کامل.
   کلید `skb_activity_history` یک‌بار مصرف می‌شود، فقط چهار کلید خوانده می‌شود، طول محدود است و
   `JSON.parse` در `try/catch` است (ضد prototype pollution).
4. **بدون `setTimeout` در handoff پنل** — ترتیب صریح: خواندن پل ⇒ `selectedMenu` ⇒ `setupSidebar()`
   ⇒ `syncMenuVisibility()` ⇒ صف مدیر ⇒ `loadMenuData`. تایمر یعنی رقابت با init و باگ‌های گاه‌به‌گاه.
5. **صف به‌جای فراخوانی مستقیم مدیر** — `openEntityHistory` قبلی اگر بخش init نشده بود بی‌صدا
   هیچ کاری نمی‌کرد؛ حالا زمینه در `pendingHistory` می‌نشیند و `init` خودش اعمالش می‌کند.
6. **تب دوم از `user_id`** — رویدادهای `auth` عمداً `entity_id = null` دارند؛ پس «ورود/خروج این کاربر»
   فقط با فیلتر `userId` دیده می‌شود. بدون این تب، تاریخچهٔ کاربر ناقص بود.

## ۵) محدودیت‌های شناخته‌شده (صادقانه)

> ✅ دو محدودیت این جدول در **۱۲.۴.۲** بسته شد: «شناسهٔ رکورد برای `POST`» و «تقویم شمسی فیلترها»
> — جزئیات در بخش ۸. آنچه می‌ماند:

1. **تغییرات سالن/گله به نام مشتری ثبت نمی‌شوند** — آن رویدادها `entity`/`entity_id` خودشان را دارند،
   نه شناسهٔ مشتری. برای «همهٔ تغییرات مرتبط با این مشتری» ستون `customer_id` در `activity_logs`
   لازم است (موج ۱۲.۵).
2. **deep-link فقط برای `customers`** — افزودن موجودیت جدید یعنی یک سطر در `DEEP_LINK_RULES`
   با مسیر مقصد + کلید مجوزش (پس از ۱۲.۴.۲).
3. **ورودی تاریخ، متن است نه تقویم اجباری** — اگر کتابخانهٔ تقویم لود نشود (خطای شبکه/CDN محلی)،
   کاربر می‌تواند تاریخ شمسی را دستی تایپ کند؛ اعتبارسنجی همان‌جا جلوی بازهٔ غلط را می‌گیرد.

## ۶) تست‌ها

| تست | دستور | تعداد |
|---|---|---|
| گارد تاریخچهٔ رکورد (۱۲.۴.۱) | `npm run test:activity:history` | ۶۸ بررسی |
| گارد پنل ۱۲.۳ + تقویم ۱۲.۴.۲ | `npm run test:activity:panel` | ۸۲ بررسی |
| گارد بک‌اند ۱۲.۲ (رگرسیون) | `npm run test:activity` | ۷۱ بررسی |
| E2E دیتابیس (۱۲.۲ + ۱۲.۴.۲) | `npm run test:activity:e2e` (با `ALLOW_DB_TESTS=true`) | ۳۴ بررسی |
| گیت کامل | `node tools/gate.mjs` | **۳۹ گام** |

گارد جدید چه چیزی را قفل می‌کند؟
- `historyContext`: زمینهٔ بدون `entity_id` ⇒ `null` (وگرنه فیلتر خالی کل تاریخچه را می‌آورد).
- `historyStats`: ناموفق‌ها با `success === false` شمرده می‌شوند (همان باگ کلاسیک `if (success)`).
- `readHistoryHandoff`: کلید اضافه و `__proto__` نادیده گرفته می‌شوند؛ ورودی خراب/بلند ⇒ `null`.
- رندرر: escape دادهٔ تزریقی، `tone` از whitelist، لینک فقط با مجوز مقصد، ⭐ نبودِ `session_id`.
- دیالوگ: mount در `document.body`، مجوز `users.activity.view` با fail-open، صف مدیر (نه تایمر)،
  پل `sessionStorage` با `try/catch`، دکمهٔ مشتری فقط با شناسه + مجوز.
- سیم‌کشی: دکمه در هر دو جدول، `showUserHistory`، ترتیب `takePendingHistory` پیش از `setupSidebar`،
  و `applyPendingHistory` بعد از آن.

## ۷) اعتبارسنجی (اندازه‌گیری‌شده)

- `npm run lint` (`eslint src`) ⇒ **۰ خطا / ۰ اخطار** (`LINT=0`)
- `npm run test:activity:history` ⇒ **۶۸/۶۸** (`HIST=0`)
- `npm run test:activity:panel` ⇒ **۸۲/۸۲** (۶۸ رگرسیون ۱۲.۳ + ۱۴ بررسی ۱۲.۴.۲)
- `npm run test:activity` ⇒ **۷۱/۷۱** (بدون رگرسیون)
- `npm run test:activity:e2e` ⇒ **۳۴/۳۴** (۲۶ رگرسیون + ۸ بررسی ۱۲.۴.۲)
- `audit:size` / `audit:dead-exports` / `audit:surface` / `audit:big-methods` ⇒ **بدون تخلف جدید**
- `test:hatchery:body` ⇒ **۹۶/۹۶** و `test:dashboard:bookmarks:body` ⇒ **۹۳/۹۳**
  (دو اسنپ‌شات طلایی که باگِ «سال ۷۸۴» را افشا کردند؛ فقط فیلدهای تاریخ/سن بازتولید شدند — بخش ۹.۱)
- `frontend-server-test.mjs` ⇒ **ALL PASS**
- `node tools/gate.mjs` ⇒ **GATE-PASS steps=39 of 39** (`GATE_EXIT=0`)

اندازهٔ فایل‌های ماژول (پس از این موج) — هیچ‌کدام به سقف ۴۰KB «فایل بزرگ» در `audit:size` نمی‌رسد:

| فایل | خط | اندازه |
|---|---|---|
| `activity-log.history.js` (جدید ۱۲.۴.۱) | ۳۴۸ | ۱۲٫۳ KB |
| `activity-log.history.css` (جدید ۱۲.۴.۱) | ۲۹۱ | ۷٫۴ KB |
| `activity-log.renderer.js` | ۴۹۰ | ۱۹٫۷ KB |
| `activity-log.manager.js` | ۴۴۱ | ۱۶٫۸ KB |
| `activity-log.view.js` | ۴۰۹ | ۱۶٫۰ KB |
| `core/utils/date.utils.js` | ۲۶۸ | ۹٫۰ KB |

## ۸) موج ۱۲.۴.۲ — شناسهٔ رکورد از بدنهٔ پاسخ (بک‌اند)

**ریشهٔ مشکل:** `parsePath` شناسهٔ رکورد را فقط از URL می‌خواند. برای `POST /api/users` پایانی
با شناسه وجود ندارد ⇒ ردیف با `entity_id = null` ذخیره می‌شد و تب «تغییرات این رکورد» برای رکورد
تازه‌ساخته‌شده **همیشه خالی** بود (تنها راه، تب دوم با `userId` بود).

**راه‌حل — همان الگویی که برای `login` وجود داشت، تعمیم‌داده‌شده:**

| فایل | تغییر |
|---|---|
| `Backend/services/activityRules.js` | `entityIdFromPayload(body)` (منطق خالص) + `normalizeEntityId` + `entityIdHint` در `buildEntry` |
| `Backend/middleware/activityLog.js` | پیچیدن `res.json` برای **همهٔ** درخواست‌های تغییردهنده (نه فقط `login`) و برداشتن اولین شناسهٔ معتبر |
| `Backend/activity-e2e-test.mjs` | ۸ بررسی تازه (۵ خالص + ۳ E2E واقعی روی API و دیتابیس) |

قواعد امنیتی که گارد قفل می‌کند:
1. **allowlist کلید** — فقط `id`، `entity_id`، `user_id`، `customer_id`، `hall_id`، `flock_id`
   و شناسهٔ درونیِ `user/customer/hall/flock/unit`. بدنهٔ بزرگ/تصادفی ستون را آلوده نمی‌کند.
2. **اعتبارسنجی مقدار** — فقط عدد صحیح مثبت یا UUID کامل؛ آبجکت/آرایه/رشتهٔ بلند/صفر/منفی ⇒ `null`.
3. **اولویت URL** — `PUT/DELETE` همان رفتار قبلی را دارند؛ بدنه فقط وقتی استفاده می‌شود که مسیر
   شناسه ندارد (بدون رگرسیون).
4. **ورود/خروج مستثنی** — `entity_id` رویدادهای `auth` دست‌نخورده می‌ماند (تب دوم روی `user_id` است).
5. **صفر تأخیر** — استخراج در همان `res.json` انجام می‌شود، نه یک هوک اضافی؛ و `try/catch` تضمین
   می‌کند خطای لاگ هرگز پاسخ کاربر را خراب نکند.

## ۹) موج ۱۲.۴.۲ — تقویم شمسی فیلتر تاریخ (فرانت‌اند)

**دو تلهٔ واقعی که بسته شد:**

1. **`convertPersianToGregorian` بی‌سرصدا تقریبی بود** — اگر `persianDate` در صفحه نبود،
   `new Date(year - 621, month - 1, day)` اجرا می‌شد: خطای تا یک روز، بدون هیچ خطایی.
   و `admin-panel.html` این کتابخانه را **لود نمی‌کرد** ⇒ فیلتر تاریخ پنل همیشه تقریبی بود.
2. **`<input type="date">` تقویم شمسی ندارد** — مرورگر تقویم گریگوری نشان می‌داد؛ تایپ دستی
   تاریخ شمسی در آن اصلاً ممکن نبود.

**راه‌حل:**

| فایل | تغییر |
|---|---|
| `Frontend/src/core/utils/date.utils.js` | الگوریتم دقیق جلالی (`jalaliToGregorian`, `isLeapJalaliYear`, `jalaliMonthLength`) — بدون وابستگی؛ حذف `year - 621`؛ اعتبارسنجی «تاریخ ناموجود ⇒ `null`» (مثل `۱۴۰۴/۱۲/۳۰`) |
| `Frontend/src/features/activity-log/activity-log.renderer.js` | ورودی‌های `#alpFrom`/`#alpTo` از `type="date"` به متنِ شمسی با `placeholder="۱۴۰۴/۰۱/۰۱"` |
| `Frontend/src/features/activity-log/activity-log.manager.js` | `setupDatepickers()` (fail-soft + idempotent) · `readFilters` با `persianDateFilterToIso` · `syncFilterInputs` با `convertGregorianToPersian` |
| `Frontend/src/features/activity-log/activity-log.view.js` | `persianDateFilterToIso` (منطق خالص) + `validateFilters` که فقط ISO میلادی را می‌پذیرد |
| `Frontend/src/pages/admin-panel.html` | `persian-date` + `persian-datepicker` (js + css) با ترتیب درست بعد از jQuery |

**قواعد قفل‌شده در گارد (۱۴ بررسی تازه):**
- «۱۴۰۴/۰۸/۱۲» ⇒ `2025-11-03` (تبدیل دقیق) · «۱۴۰۳/۱۲/۳۰» معتبر (کبیسه) · «۱۴۰۴/۱۲/۳۰» ⇒ `null`.
- ISO میلادی (با خط تیره) دست‌نخورده عبور می‌کند؛ ورودی نامعتبر خام می‌ماند تا `validateFilters`
  **خطای فارسی روشن** بدهد (هرگز بازهٔ خالیِ بی‌توضیح).
- نبودِ jQuery/`persianDatepicker` ⇒ فقط ورودی متنی (بدون کرش) · راه‌اندازی دوبارهٔ بخش، تقویم را
  دوباره نمی‌سازد (`data-datepicker-initialized`).
- ترتیب اسکریپت‌ها در `admin-panel.html`: jQuery ⇒ `persian-date` ⇒ `persian-datepicker`.
- بازهٔ ۲۹ ساله (۱۹۹۰..۲۰۳۵) به‌صورت brute-force با `Intl` مقایسه شد: **۱۶٫۸۰۱ روز، ۰ اختلاف**.

### ۹.۱) باگی که این تبدیل لو داد (اثر واقعی، نه تئوری)

دو اسنپ‌شات طلاییِ گیت (`test:hatchery:body` و `test:dashboard:bookmarks:body`) وقتی این
تبدیل دقیق شد، **شکستند** — و شکستنشان پرده از یک باگ تولیدی برداشت:

| مقدار | قبل (`year - 621`) | بعد (دقیق) |
|---|---|---|
| `slaughter_date` برای «۱۴۰۵/۰۳/۲۵» | `"784-03-25"` (سال ۷۸۴ میلادی!) | `"2026-06-15"` |
| `slaughter_age_days` | `null` (سن قابل محاسبه نبود) | `25` |
| `due_date` بوکمارک برای «۱۴۰۴/۰۳/۰۱» | `"783-03-01"` | `"2025-05-22"` |

دلیل: `new Date(year - 621, …)` با سالِ کمتر از ۱۰۰ به‌جای سالِ میلادی، سالِ ۱۹۰۰+ را می‌سازد
(قاعدهٔ خود JS برای سال‌های دورقمی) و برای ۱۴۰۵ ⇒ `new Date(784, …)` ⇒ سال ۷۸۴؛ در نتیجه هر تبدیلی
که از fallback می‌گذشت (یعنی هر صفحه‌ای که `persian-date` را لود نمی‌کرد، مثل پروندهٔ مشتری/پایان دوره)
تاریخِ **کاملاً غلط** ذخیره می‌کرد، بدون هیچ خطایی.

اقدام لازم و انجام‌شده:
1. دو اسنپ‌شات طلایی بازتولید شد (`--snapshot`). **diff فقط** در فیلدهای تاریخ/سن است
   (۳۴ مسیر، همه `slaughter_date` / `slaughter_age_days` / `slaughter_dates`)، هیچ تغییر
   نامرتبط دیگری در رکوردها نیست.
2. انکرِ `dashboard-bookmarks-body-split-test.mjs` از `"783-03-01"` به `"2025-05-22"` اصلاح شد
   (آن انکر رفتار باگ‌دار را قفل کرده بود).
3. جداکنندهٔ «-» عمداً پشتیبانی **نمی‌شود**: ورودی ISO (`2025-11-03`) باید `null` بدهد
   (قرارداد قبلی). فیلتر تاریخ پنل خودش ISO را پیش از تبدیل تشخیص می‌دهد.



