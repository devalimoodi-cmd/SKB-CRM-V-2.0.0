# گزارش موج ۱۲.۵ — «همهٔ تغییرات این مشتری»

> زیرفاز ۱۲.۵ ستون `customer_id` را از میدل‌ور تا دیالوگ تاریخچه و فیلتر پنل می‌برد،
> تا سؤال «این مشتری در کل پرونده‌اش چه تغییراتی داشته؟» با یک کلیک پاسخ بگیرد —
> نه با تایپ دستی `entity` و `entity_id` در فیلترها.

## ۱) ریشهٔ مشکل (چرا این زیرفاز لازم بود)

۱۲.۴.۱ دیالوگ تاریخچه را ساخت، اما دو تب آن هر دو **به یک رکورد یا یک کاربر** قفل بودند:

| تب | فیلتر | پاسخ چه سؤالی را می‌داد | چه سؤالی بی‌پاسخ می‌ماند |
|---|---|---|---|
| «تغییرات این رکورد» | `entity` + `entity_id` | «چه کسی **این سالن** را عوض کرد؟» | «چه کسی **این مشتری** را عوض کرد؟» |
| «فعالیت‌های این کاربر» | `user_id` | «این کاربر امروز چه کرد؟» | همان بالا |

مشتری در این سیستم یک **درخت** است: `customers` → `halls` → (`hall_systems`, `hall_water_feed`,
`hall_physical_info`, `hall_hygiene`) و `flocks` → `weekly_management` / `visit_reports` /
`chick_placements` / `flock_completions` / `bookmarks`. یعنی «تغییرات این مشتری» در واقع
«تغییرات ۱۱ جدول» است. و ردیف‌های لاگ (۱۲.۲) هیچ ستون مشتری نداشتند: نه
`entity=customers&entity_id=۱۲` کافی بود، نه می‌شد روی جدول‌های فرزند فیلتر زد.

دو تلهٔ واقعی که این موج بست:

1. **`POST /api/halls` شناسهٔ مشتری را در URL ندارد** — تنها جای `customer_id` بدنهٔ درخواست است.
   و رکوردِ تازه‌ساخته‌شده هم پس از ۱۲.۴.۲ فقط `entity_id` خودش را دارد. بدون ستون مشتری،
   هر ردیف زیرمجموعه در تب سوم **غایب** می‌شد.
2. **زیرمنابع سالن فقط `hall_id` می‌فرستند** (`POST /api/hall-systems` با `hall_id`)، پس حتی
   بدنه هم `customer_id` ندارد ⇒ باید از سالن به مشتری رسید.

## ۲) چه ساخته شد

| قابلیت | جزئیات |
|---|---|
| ستون `activity_logs.customer_id` | مایگریشن idempotent + ایندکس `activity_logs_customer` · **nullable و بدون FK** (تاریخچه باید از حذف مشتری جان سالم ببرد) |
| ثبت در مسیر پاسخ | میدل‌ور از `body.customer_id` / `params.customerId` / `query.customer_id` / **بدنهٔ پاسخ** می‌خواند؛ صفر کوئری اضافه |
| استنتاج در `flush()` | `services/activityCustomerResolver.js` — ردیف‌هایی که `customer_id` ندارند، دسته‌ای (یک کوئری به‌ازای هر جدول) پر می‌شوند |
| فیلتر سرور | `GET /api/activity?customer_id=۱۲` |
| تب سوم دیالوگ | «همهٔ تغییرات این مشتری» — از هر رکورد (سالن/گله/هفته‌نامه/بازدید) با `customerId` |
| تب پیش‌فرض | روی پروندهٔ مشتری ⇒ «مشتری» · روی جدول کاربران ⇒ «تغییرات» (رفتار قبلی) |
| فیلتر پنل | ورودی «شناسهٔ مشتری» (`#alpCustomerId`) در نوار فیلترها |
| نشان ردیف | `مشتری #N` در جدول پنل و در فهرست دیالوگ + ردیف «شناسهٔ مشتری» در مودال جزئیات |
| پل بین صفحه‌ها | `customerId` به بستهٔ `sessionStorage` و صف مدیر اضافه شد |

## ۳) تغییرات (فایل‌به‌فایل)

### بک‌اند

| فایل | تغییر |
|---|---|
| `Backend/migrations/20261005000000-add-activity-logs-customer-id.js` (**جدید**) | `addColumn` + ایندکس، هر دو idempotent (`hasColumn`/`showIndex`) — قابل اجرا روی دیتابیسِ نیمه‌مهاجرت |
| `Backend/models/ActivityLog.js` | ستون `customer_id` (`INTEGER`, nullable, بدون `references`) |
| `Backend/services/activityRules.js` | `normalizeCustomerId` (فقط عدد صحیح مثبت؛ UUID/اعشار/۰ ⇒ `null`)، `customerIdFromRequest({ body, params, query, responseBody, entity, entityId })` با اولویت بدنه ← پارامتر ← کوئری ← پاسخ، و **خودانتسابی** `entity=customers ⇒ customer_id = entity_id`؛ `buildEntry` کلید `customerId` و `buildItem` کلید `customer_id` را عبور می‌دهند |
| `Backend/services/activityCustomerResolver.js` (**جدید**) | `CUSTOMER_SOURCES` (۱۱ منبع: ۷ مستقیم + ۴ از راه سالن)، `collectIds` (فقط شناسه‌های عددیِ فاقد مشتری)، `buildSql`, `applyResults`, `resolveCustomerIds` با `MAX_IDS_PER_QUERY=100` و `FAILURE_BACKOFF_MS=۱۰ دقیقه` به‌ازای هر منبع · `status()` · `resetForTests()` |
| `Backend/services/activityService.js` | صدا زدن resolver داخل `flush()` **پیش از** `bulkCreate` + بلعیدن خطا + `status().customer_resolver` |
| `Backend/middleware/activityLog.js` | استخراج `customerId` از دادهٔ همان درخواست (+ بدنهٔ پاسخ در `res.json`) و گذاشتنش روی ردیف بافر |
| `Backend/controllers/activityController.js` | فیلتر `?customer_id=` (مقدار نامعتبر ⇒ نادیده، بدون ۵۰۰) |
| `Backend/scripts/verify-db.js` | انتظار ستون `activity_logs.customer_id` و ایندکس `activity_logs_customer` |
| `Backend/activity-e2e-test.mjs` | بررسی‌های تازهٔ ۱۲.۵ (منطق خالص + میدل‌ور + resolver واقعی + فیلتر API) |

### فرانت‌اند

| فایل | تغییر |
|---|---|
| `activity-log.view.js` | `EMPTY_FILTERS.customerId` · `buildQuery` · `validateFilters` («باید عددی بزرگ‌تر از صفر باشد») · `activeFilterCount` · **`toIdInt`** (پارسر سخت: `1.5`/`1,2`/`-3`/`0` ⇒ `null`) · `HISTORY_MODES.customer` · `historyContext` (زمینهٔ «فقط مشتری» معتبر است) · `historyQuery(..., "customer")` · `historyTitle` · کلید `customerId` در allowlist پل |
| `activity-log.renderer.js` | ورودی `#alpCustomerId` · نشان `alp-customer-id` در ردیف‌های جدول · ردیف «شناسهٔ مشتری» در مودال جزئیات · `renderHistoryTabs` (تب سوم فقط با `customerId`) · نشان `alp-hist-customer` در فهرست دیالوگ |
| `activity-log.manager.js` | `readFilters`/`syncFilterInputs` برای مشتری · ست‌کردن `filters.customerId` از زمینهٔ تاریخچه (deep link) · پاس‌دادن `customerId` به تریگرها |
| `activity-log.history.js` | پارامتر چهارم `open(...)`، `defaultMode(ctx)` (پروندهٔ مشتری ⇒ تب مشتری) · گارد «تب بدون فیلتر ⇒ هیچ درخواستی» · `window.showEntityHistory(entity, entityId, title, customerId)` · `refreshCustomerTrigger` از `window.CURRENT_CUSTOMER_ID` |
| `activity-log.css` / `activity-log.history.css` | `.alp-customer-id` · `.alp-hist-customer` |

### تست‌ها و گیت

- `Frontend/activity-panel-guard-test.mjs` — بررسی‌های ⭐ ۱۲.۵ (جمعاً **۹۷** بررسی).
- `Frontend/activity-history-guard-test.mjs` — بررسی‌های ⭐ ۱۲.۵ (جمعاً **۸۵** بررسی).
- `Backend/activity-e2e-test.mjs` — **۴۸/۴۸** (شامل بلوک ۱۲.۵).
- `Frontend/activity-guard-test.mjs` — **۷۱/۷۱** (بدون تغییر، برای اطمینان از عدم رگرسیون).
- `Backend/scripts/verify-db.js` — `ALL PASS` (ستون + ایندکس جدید).

## ۴) تصمیم‌های طراحی (و دلیلشان)

1. **`customer_id` nullable و بدون کلید خارجی.** تاریخچه باید بعد از حذف مشتری هم باقی بماند
   (همان دلیلی که ۱۲.۲ برای نبودِ FK روی `user_id` داشت). نتیجهٔ جانبی: ردیف‌های قدیمی
   `NULL` می‌مانند و تب مشتری فقط ردیف‌های تازه را نشان می‌دهد — پذیرفتنی و مستند.
2. **استنتاج در `flush()`، هرگز در مسیر پاسخ.** قاعدهٔ ۱۲.۲ دست‌نخورده ماند: هیچ کوئری‌ای
   به‌خاطر لاگ به پاسخ کاربر اضافه نمی‌شود. resolver یک کوئری به‌ازای هر **جدول** می‌زند
   (نه هر ردیف) و ردیف‌ها را درجا، پیش از `bulkCreate`، جهش می‌دهد.
3. **هر خطای resolver فقط «پرش» است.** جدول/ستون غایب ⇒ همان منبع ۱۰ دقیقه خاموش می‌شود
   (`ACTIVITY_RESOLVE_CUSTOMER=false` هم کل قابلیت را خاموش می‌کند) و نوشتن لاگ هرگز
   شکست نمی‌خورد.
4. **زمینهٔ «فقط مشتری» مجاز شد، ولی تب «تغییرات» با آن `null` می‌دهد.** پیش‌تر
   `historyContext` بدون `entityId` ⇒ `null` بود؛ حالا `{ customerId }` زمینهٔ معتبر است
   تا دیالوگ بدون رکورد هم مشتری را نشان دهد. برای اینکه این انعطاف به «نمایش کل تاریخچهٔ
   سیستم» تبدیل نشود، `historyQuery(ctx, "changes")` روی زمینهٔ فقط‌مشتری **`null`**
   برمی‌گرداند و `load()` با `if (!filter) return` هیچ درخواستی نمی‌فرستد.
5. **allowlist پل ثابت ماند.** `customerId` به همان مکانیزم ۱۲.۴ (پنج کلید + سقف طول +
   `try/catch`) اضافه شد، نه یک مکانیزم موازی.

## ۵) قواعد قفل‌شده در گاردها

**بک‌اند (E2E):**

- `normalizeCustomerId`: `"12"`/`12` ⇒ `12`؛ `"0"`, `"12.5"`, `"abc"`, UUID ⇒ `null`.
- اولویت منبع: بدنه (`5`) بر پارامتر (`"6"`) بر کوئری (`"7"`).
- `entity=customers&entityId=77` ⇒ `customer_id=77` (خودانتسابی).
- ردیف ناموفق (`404`) هم `customer_id` را نگه می‌دارد (حسابرسی ≠ فقط موفق‌ها).
- resolver ردیف `bookmarks` را از جدول خودش و ردیف `hall-systems` را از
  `INNER JOIN halls` پر می‌کند؛ ردیفِ دارای `customer_id` دست‌نخورده می‌ماند.
- `?customer_id=` خالی/نامعتبر ⇒ فیلتر اعمال نمی‌شود و پاسخ `200` است.

**فرانت‌اند (گارد پنل + تاریخچه):**

- «مشتری #N» فقط با `customer_id` معتبر رندر می‌شود (هرگز `#NaN`/`#null`) و همیشه escape می‌شود.
- فیلتر مشتری با `toIdInt` سنجیده می‌شود: `1.5`, `1,2`, `-3`, `0` ⇒ خطای فارسی، نه فیلتر بی‌صدا.
- سه تب فقط با `customerId` ساخته می‌شوند؛ بدون آن، دیالوگ دو تبی می‌ماند (رفتار ۱۲.۴).
- روی پروندهٔ مشتری، تب پیش‌فرض «مشتری» است؛ روی جدول کاربران «تغییرات».
- `packHistoryHandoff`/`readHistoryHandoff` مقدار `customerId` را حفظ می‌کنند و
  فیلدهای ناشناخته/آبجکتی را دور می‌ریزند.

## ۶) باگ‌هایی که این موج لو داد

| # | باگ | اثر واقعی | بسته شد با |
|---|---|---|---|
| ۱ | `toInt` اعشار را می‌بُرید (`1.5 ⇒ 1`) | فیلتر مشتری روی **مشتری اشتباه** اعمال می‌شد، بی‌هیچ پیامی | `toIdInt` سخت‌گیر + پیام اعتبارسنجی |
| ۲ | زمینهٔ تاریخچه بدون `entityId` نامعتبر بود | دیالوگِ «تغییرات این مشتری» برای پرونده‌ای که رکورد مشخصی ندارد اصلاً باز نمی‌شد | `customerId` به‌عنوان شرط معتبر دوم |
| ۳ | تب بدون فیلتر ⇒ درخواست بی‌فیلتر | با تب «تغییرات» روی زمینهٔ فقط‌مشتری، **کل تاریخچهٔ سیستم** به کاربر نشان داده می‌شد | `historyQuery` ⇒ `null` + گارد `if (!filter)` |
| ۴ | (تست) ساخت بوکمارک با شناسهٔ مشتری جعلی | `bookmarks.customer_id` کلید خارجی دارد ⇒ `INSERT` می‌شکست | E2E برای رکورد از مشتری واقعی استفاده می‌کند؛ شناسهٔ جعلی فقط روی ستون لاگ (بدون FK) آزمایش می‌شود |

## ۷) اجرا و بازبینی

```powershell
# بک‌اند
cd Backend
npx sequelize-cli db:migrate          # 20261005000000-add-activity-logs-customer-id
npm run db:verify                     # ستون + ایندکس ⇒ ALL PASS
$env:ALLOW_DB_TESTS='true'; npm run test:activity:e2e    # ۴۸/۴۸

# فرانت‌اند
cd ..\Frontend
npm run test:activity                 # گارد پایه
npm run test:activity:panel           # ۹۷ بررسی
npm run test:activity:history         # ۸۵ بررسی
```

**نتیجه:** `db:verify` = `ALL PASS` · `test:activity:e2e` = ۴۸/۴۸ · گاردهای پنل/تاریخچه
بدون `FAIL` · `eslint` روی فایل‌های بک‌اند ۰ خطا · `audit:surface` و `audit:dead-exports`
(هر دو سمت) کد خروج ۰.

## ۸) آنچه در موج بعدی می‌ماند

- پر کردن گذشته‌نگر (`backfill`) ستون `customer_id` برای ردیف‌های قدیمی از راه همان resolver
  (اسکریپت یک‌بارمصرف، خارج از مسیر درخواست).
- تب سوم برای «واحد» و «گله» به‌صورت مستقل از مشتری (اگر محصول خواست).

