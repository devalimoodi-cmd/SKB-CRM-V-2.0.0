# بازبینی موج ۱۳.۱۵ — رابط کاربری «درخواست‌های فارم» برای ۱۸ نوع

> ادامهٔ مستقیم ۱۳.۱۴: بک‌اند از ۱۳.۱۱ تا ۱۳.۱۴ برای **۱۸ نوع درخواست**
> کامل بود، ولی پورتال فقط ۳ فرم داشت. ۱۳.۱۵ همان ۱۵ فرم باقی‌مانده را
> می‌سازد — با یک منبع قواعد (`portal.farm.rules.js`) که هم رندر، هم
> payload و هم برچسب‌ها را می‌سازد.

---

## ۱) مسئله

پس از ۱۳.۱۴ سرور همهٔ ۱۸ نوع را می‌شناخت (`meta.types` = ۱۸)، اما رندرر
پورتال با `FARM_FORM_SPEC` فقط سه نوع را می‌شناخت و بقیه را **فیلتر
می‌کرد** ⇒ مشتری تب/فرمی برای ویرایش واحد، حذف سالن، جزئیات سالن و
اطلاعات هفتگی نداشت. یعنی تمام قواعد ۱۳.۱۳/۱۳.۱۴ فقط از پنل کارشناس
قابل استفاده بود.

ریسک دوم (دلیل وجود این موج): فهرست کلیدهای payload در `portal.api.js`
**دستی** تکرار می‌شد. با ۱۸ نوع، هر فیلد تازه دو جا باید هم‌راستا می‌شد و
یک اشتباه می‌توانست باعث «درخواست ثبت‌شده با بدنهٔ ناقص» شود.

## ۲) یک منبع قواعد در کلاینت

| فایل | نقش |
|---|---|
| `Frontend/src/features/portal/portal.farm.rules.js` (تازه) | ۵ گروه تب، ۱۸ نوع، `FARM_FORM_SPEC` (فیلدها/نوع/اجباری/دیکشنری/سقف)، `FARM_PAYLOAD_KEYS` **مشتق از spec**، `FARM_DESTRUCTIVE_TYPES`، `farmPayload` تایپ‌آگاه |
| `Frontend/src/features/portal/portal.farm.weeks.js` (تازه) | حساب خالص هفته: `weekPlanFor` (شمارهٔ بعدی + بازهٔ ۷ روزه + سن گله)، `weeklyDateError`، `isoDateOf`، `weekOptionText` |
| `portal.farm.renderer.js` | فقط «چطور رندر شود»: تب‌های گروه‌بندی‌شده، ۱۲ نوع فیلد، بنر حذف، خلاصهٔ payload |
| `portal.farm.js` | رفتار: پیش‌پرکردن، خواندن ورودی‌ها، اعتبارسنجی آینه‌ای، تأیید دوم حذف |
| `portal.api.js` | سه متد خواندن جزئیات + بازصادرات قواعد (بدون فهرست دستی) |

`FARM_PAYLOAD_KEYS` مشتق است:

```js
export const farmPayloadKeysOf = (type) =>
  farmPayloadFieldsOf(type).map((field) => field.key); // payload !== false
export const FARM_PAYLOAD_KEYS = FARM_TYPE_KEYS.reduce((acc, type) => {
  acc[type] = farmPayloadKeysOf(type);
  return acc;
}, {});
```

⇒ اگر روزی فیلدی به spec اضافه شود، payload و رندر **هم‌زمان** عوض می‌شوند.

## ۳) ۱۵ فرم تازه

| گروه | نوع‌ها | پیش‌پرکردن از |
|---|---|---|
| سالن | `hall_update`, `hall_delete` | گزینه‌های `GET /farm/options` |
| جزئیات سالن | `hall_physical_save`, `hall_system_save`, `hall_water_feed_save`, `hall_hygiene_save` | `GET /farm/halls/:id` |
| دوره | `placement_update`, `placement_delete` | `GET /farm/placements/:id` |
| دوره | `placement_activate`, `placement_deactivate` | — (فقط هشدار/انتخاب) |
| هفته | `weekly_create`, `weekly_update`, `weekly_delete` | `GET /farm/placements/:id` (+ `GET /farm/weeklies/:id` برای ویرایش) |

به‌همراه سه نوع موجود ۱۳.۱۱ و دو نوع واحد (`unit_update`, `unit_delete` که
پیش‌پرکردنشان از همان پاسخ گزینه‌ها است) ⇒ **۱۸ فرم**.

### انواع فیلد رندرر

`text` · `tel` · `number` · `date` · `textarea` · `check` · `radio` ·
`unit` · `hall` · `placement` · `week` · `flock` · `dict` · `multi` ·
`items` · `static`

| نوع | چرا این‌طور رندر می‌شود |
|---|---|
| `multi` (پنج گروه شناسهٔ هفتگی) | لیست چک‌باکس اسکرول‌دار، نه `<select multiple>` (روی موبایل قابل استفاده نیست) |
| `items` (ردیف تجهیزات) | repeater با «افزودن/حذف»، `type_id` به‌صورت `hidden` تا در ویرایش گم نشود |
| `placement` | گزینه‌ها از `options.placements` با فیلتر `active`/`inactive` |
| `week` | گزینه‌ها از هفته‌های همان دوره (`/farm/placements/:id`) |

## ۴) پیش‌پرکردن (بدون بازنویسی کورکورانه)

| نوع | منبع | چرا |
|---|---|---|
| `unit_update` / `unit_delete` | همان `options.units` | نیازی به درخواست دوم نیست |
| `hall_update` | همان `options.halls` | همان |
| چهار حوزهٔ جزئیات سالن | `GET /farm/halls/:id` | ستون‌های هر حوزه فقط با ردیف همان حوزه پر می‌شود (تداخل `notes` حل شد) |
| `placement_update` | `GET /farm/placements/:id` | `chick_source_id`/`breed_id`/وزن/تراکم در گزینه‌ها نیست |
| `weekly_create` | `GET /farm/placements/:id` + `weekPlanFor` | شمارهٔ هفته/تاریخ‌ها/سن گله خودکار پر می‌شود |
| `weekly_update` | `GET /farm/weeklies/:id` | اعداد + پنج آرایهٔ شناسه |

- همهٔ درخواست‌های جزئیات با **cache** (`Map`) و کلید `hall:<id>` /
  `placement:<id>` / `weekly:<id>` یک‌بار انجام می‌شوند.
- انتخاب فعلی کاربر در طول «در حال بارگذاری» حفظ می‌شود.

## ۵) اندپوینت تازهٔ سرور (تنها تغییر بک‌اند این موج)

`GET /api/portal/farm/weeklies/:id` — پیش‌پرکردن فرم «ویرایش اطلاعات هفتگی».

| موضوع | مقدار |
|---|---|
| چرا لازم شد | `placementDetailsFor` عمداً فقط ستون‌های سبک هفته را برمی‌گرداند؛ ویرایش هفته به دان/خاموشی/توضیحات و پنج آرایهٔ شناسه نیاز دارد و `validateWeeklyData` هم شمارهٔ هفته/تاریخ‌ها/تلفات/وزن را اجباری می‌داند |
| خواندن | `weeklyWrite.loadWeeklyRecord` + `formatWeeklyRecord` (بدون نسخهٔ دوم) |
| مالکیت | `requireOwnedRow({ model: WeeklyManagement })` در مسیر + `where: { id, customer_id }` در سرویس ⇒ ۴۰۴ برای هفتهٔ غیرخودی |
| شمارش GET پورتال | ۱۹ ⇒ **۲۰** |

## ۶) اعتبارسنجی سمت کلاینت (آینهٔ سرور، فقط برای تجربهٔ بهتر)

| قاعده | پیام |
|---|---|
| فیلدهای اجباری spec | ««عنوان» را کامل کنید» |
| عدد معتبر + بازهٔ `min/max` | ««عنوان» باید بین … و … باشد» |
| تلفن مدیر ۱۱ رقم | همان قاعدهٔ ۱۳.۱۱ |
| پایان هفته پیش از شروع | «پایان هفته نمی‌تواند پیش از شروع آن باشد» |
| `confirm_name` = نام واحد | «نام واحد را عیناً بنویسید: …» (سرور: `confirm_name_mismatch`) |
| «هیچ تغییری» در ۸ نوع ویرایش/ثبت جزئیات | مقایسه با مقادیر پیش‌پر (`sameFarmValue`) — سرور: `nothing_to_change` |
| سقف ۶۰ ردیف تجهیزات | «حداکثر ۶۰ ردیف…» |

⚠️ هیچ‌کدام امنیتی نیست: سرور مستقل همان فهرست سفید/سقف‌ها/اعتبارسنج
کارشناس را اجرا می‌کند.

## ۷) تأیید دوم حذف (بدون `confirm` بومی)

چهار نوع حذفی (`unit_delete`, `hall_delete`, `placement_delete`,
`weekly_delete`):

1. بنر قرمز با متن دقیق «چه چیزی حذف می‌شود» (`portal-farm__danger`).
2. دکمهٔ `btn-danger` با برچسب «ثبت درخواست حذف برای بررسی کارشناس».
3. کلیک اول ⇒ پنل تأیید (`portal-farm__confirm--danger`) با «بله، ثبت کن» /
   «بستن»؛ ارسال فقط با کلیک دوم.
4. `unit_delete` علاوه بر این، **نام واحد** را برای تأیید می‌خواهد.

## ۸) ردیف‌های تجهیزات: «دست‌نخورده = پاک نشود»

`hallDetailsWrite` فقط وقتی ردیف‌ها را جایگزین می‌کند که `Array.isArray(items)`
باشد. کلاینت هم:

- تا کاربر «افزودن/حذف ردیف» نزده باشد (`itemsTouched=false`) کلید `items`
  را **از payload حذف** می‌کند ⇒ ردیف‌های قبلی سالن دست‌نخورده می‌مانند.
- بعد از پیش‌پرکردن (`itemsTouched=true`) اگر همه را حذف کند، `items: []`
  نمی‌فرستد (طبق قاعدهٔ `farmPayload`، آرایهٔ خالی کلید را حذف می‌کند) ⇒
  برای «پاک‌کردن همه»، کارشناس باید ردیف‌ها را در پنل خودش حذف کند.
  این محدودیت آگاهانه است تا یک فرم نیمه‌پر، دادهٔ موجود را نبرد.

## ۹) فایل‌های این موج

| فایل | تغییر |
|---|---|
| `Frontend/src/features/portal/portal.farm.rules.js` | 🆕 ۶۰۹ خط — قواعد، spec، payload |
| `Frontend/src/features/portal/portal.farm.weeks.js` | 🆕 ۱۰۸ خط — حساب هفته |
| `Frontend/src/features/portal/portal.farm.renderer.js` | بازنویسی (۷۳۶ خط) — تب گروهی + ۱۶ نوع فیلد |
| `Frontend/src/features/portal/portal.farm.js` | بازنویسی (۱۰۱۶ خط) — پیش‌پرکردن/اعتبارسنجی/تأیید |
| `Frontend/src/features/portal/portal.api.js` | حذف فهرست دستی payload + سه متد جزئیات |
| `Frontend/src/core/constants/api.const.js` | `FARM_HALL_DETAILS` · `FARM_PLACEMENT_DETAILS` · `FARM_WEEKLY_DETAILS` |
| `Frontend/src/features/portal/portal.css` | ۱۵ کلاس تازه (گروه، multi، items، danger…) |
| `Backend/services/portalRequestService.js` | `weeklyDetailsFor` |
| `Backend/controllers/portalFarmController.js` | `getMyWeekly` |
| `Backend/routes/portalRoutes.js` | `GET /farm/weeklies/:id` |
| `Backend/portal-request-test.mjs` | ۴ بررسی تازه |
| `Frontend/customer-portal-guard-test.mjs` | بخش ۱۳.۱۵ + به‌روزرسانی سه بررسی قبلی |

## ۱۰) آزمون‌ها

| آزمون | نتیجه |
|---|---|
| `npm run test:customer-portal` | ۲۱۰ بررسی (۱۱ بررسی تازهٔ ۱۳.۱۵) |
| `npm --prefix Backend run` → `node portal-request-test.mjs` | ۷۴ بررسی (۴ بررسی تازه) |
| `node farm-write-test.mjs` | ۳۹ بررسی (بدون تغییر) |
| `npm run test:portal-requests` | ۳۰ بررسی (بدون تغییر) |
| `node tools/gate.mjs` | PASS |

### بررسی‌های کلیدی ۱۳.۱۵ در گارد

1. ۱۸ نوع در `FARM_FORM_SPEC` و پوشش کامل گروه‌ها.
2. برابری `REQUEST_TYPE_KEYS` کلاینت/سرور + برابری `DESTRUCTIVE_TYPES`.
3. کلیدهای payload کلاینت **زیرمجموعهٔ** فهرست سفید سرور، با تنها
   تنگ‌کردن عمدی `weekly_update: chick_placement_id` (فیلد انتخاب UI).
4. `farmPayload` واقعاً اجرا می‌شود: ارقام فارسی ⇒ عدد، حذف تکراری‌های
   شناسه، دور ریختن ردیف بی‌دسته، حذف `customer_id`/`status`.
5. سه اندپوینت جزئیات + cache + `weeklyDetailsFor` + `requireOwnedRow`.
6. هشدار حذف + تأیید دوم + `confirm_name`.
7. `weekPlanFor` واقعاً اجرا می‌شود (شماره/تاریخ/سن) و بازهٔ معکوس رد می‌شود.
8. ردیف تجهیزات: `type_id` مخفی + گیت `itemsTouched`.
9. CSS/مستندات/README.

## ۱۱) محدودیت‌های شناخته‌شده

| مورد | توضیح |
|---|---|
| گرید ۱۸ تب | تب‌ها در ۵ گروه با تیتر گروه نشان داده می‌شوند؛ در موبایل به‌صورت لیست عمودی می‌پیچند |
| عکس/پیوست هفتگی | در پورتال نیست (نیازمند مسیر آپلود اختصاصی؛ موج بعد) |
| `flock_delete` / ادغام گله | در نوع‌های پورتال نیست (تصمیم کارشناس) |
| «پاک‌کردن همهٔ ردیف‌های تجهیزات» از پورتال | آگاهانه ممکن نیست (بند ۸) |
| آزمون دیتابیسی | مثل بقیهٔ موج‌ها، تست‌ها بدون DB اجرا می‌شوند؛ سناریوی دستی در README |

📄 موج‌های مرتبط: `docs/REVIEW-WAVE-13.11.md` · `13.12` (در ۱۳.۱۳) ·
`13.13` · `13.14`.

