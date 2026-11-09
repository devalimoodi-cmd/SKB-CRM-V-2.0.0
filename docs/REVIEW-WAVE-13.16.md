# بازبینی موج ۱۳.۱۶ — «خوانایی کامل درخواست» و پیگیری نتیجه

> ادامهٔ مستقیم ۱۳.۱۵: پس از آن موج، هر ۱۸ نوع درخواست در پورتال فرم داشت
> و سرور همه را می‌شناخت. ولی **هیچ‌کس مقدارها را نمی‌خواند**: کارشناس
> `breed_id: 3` و «۵ مورد» می‌دید و مشتری هم در کارت خودش همان را.
> ۱۳.۱۶ برای همین ساخته شد — بدون یک نوع درخواست تازه.

---

## ۱) مسئله

| # | شکاف | اثر |
|---|---|---|
| ۱ | مودال بازبینی برای `weekly_create/update` فقط «۵ ردیف — ویرایش فقط از پورتال» چاپ می‌کرد | کارشناس نمی‌دانست کدام بیماری/واکسن/دارو/خوراک/پیشنهاد تأیید می‌کند |
| ۲ | ردیف‌های `items` در `hall_system_save` حتی دیده نمی‌شدند | ثبت تجهیزات سالن بدون بازبینی تأیید می‌شد |
| ۳ | شناسه‌های دیکشنری (`breed_id`, `hall_type_id`, ۸ شناسهٔ تجهیزات) عدد خام بودند | «۳» و «۷» در برابر «راس ۳۰۸» |
| ۴ | برچسب‌ها **دو نسخهٔ مستقل** داشتند: `PAYLOAD_LABELS` (صف) و `FARM_FIELD_LABEL` (پورتال) | یک فیلد تازه باید در دو جا هم‌راستا می‌شد |
| ۵ | فهرست «درخواست‌های من» فیلتر و صفحه‌بندی نداشت (همیشه `page:1, limit:50`) | درخواست ردشدهٔ هفتهٔ پیش پیدا نمی‌شد، با اینکه سرور `status` + `pagination` + `counts` می‌داد |
| ۶ | `applied_at` در کارت مشتری دیده نمی‌شد | مشتری نمی‌دانست درخواستش واقعاً **اعمال** شده یا فقط «تأیید» شده |
| ۷ | شناسهٔ ردیف هدف در صف فقط عدد بود (`hall_id: 12`) | کارشناس نمی‌دانست کدام سالن/دوره/هفته تغییر می‌کند |

## ۲) یک منبع نمایش payload (کلاینت)

| فایل | نقش |
|---|---|
| `Frontend/src/features/portal/portal.payload.js` (تازه) | `PAYLOAD_FIELD_META` (برچسب/نوع/دیکشنری هر کلید)، `payloadRowsOf`، `payloadIdRowsOf`، `equipmentRowsOf`، `payloadContextRowsOf`، `dictionaryNameOf` |
| `portal.farm.rules.js` | دو مشتق تازه: `FARM_FIELD_TYPE` و `FARM_FIELD_DICT` (از همان `FARM_FORM_SPEC`) |
| `portal.farm.renderer.js` | خلاصهٔ نامدار + `<details>` «جزئیات کامل» + جدول تجهیزات + زمان اعمال |
| `portal-requests.renderer.js` | `PAYLOAD_LABELS` **مشتق** شد؛ «زمینهٔ درخواست» + «چکیدهٔ کامل» + «فعلی: …» زیر هر شناسه |
| `Backend/services/portalRequestService.js` | `loadDictionaries()` برای هر دو مسیر + `contextForRequest(row)` |

نکتهٔ کلیدی: **برچسب‌ها ساخته نمی‌شوند، مشتق می‌شوند.** `portal.payload.js`
برچسب را از `FARM_FIELD_LABEL` (که خودش از spec می‌آید) و نوع/دیکشنری را از
`FARM_FIELD_TYPE`/`FARM_FIELD_DICT` می‌گیرد:

```js
export const PAYLOAD_FIELD_META = PAYLOAD_KEY_UNION.reduce((acc, key) => {
  const type = FARM_FIELD_TYPE[key] || "text";
  const kind = KIND_BY_TYPE[type] || "text";
  acc[key] = { key, label: FARM_FIELD_LABEL[key] || key, kind, … };
  return acc;
}, {});
```

⇒ اگر فردا فیلدی به spec اضافه شود، رندر، payload، برچسب و نمایش **هم‌زمان**
عوض می‌شوند. گارد برابری مجموعهٔ کلیدها را می‌سنجد: **۷۲ کلید**
(سرور: `ALLOWED_PAYLOAD_KEYS` · کلاینت: `FARM_PAYLOAD_KEYS` · متادیتا: `PAYLOAD_FIELD_META`).

## ۳) ۱۶ دیکشنری از یک فهرست (سرور)

پیش از این، `optionsFor` شانزده کوئری دیکشنری را دستی فهرست می‌کرد و مسیر
صف هیچ دیکشنری‌ای نداشت. حالا:

```js
const DICTIONARY_MODELS = [["breeds", ChickenBreed], …]; // ۱۶ جفت
const loadDictionaries = async () => …;                   // فعال + {id,name}
const staffDictionariesFor = async () => loadDictionaries();
```

| موضوع | مقدار |
|---|---|
| اندپوینت تازه | `GET /api/portal-requests/dictionaries` |
| مجوز | `portal.requests.view` (همان زنجیرهٔ صف) |
| خروجی | `{ dictionaries: { breeds: [{id,name}], … } }` — فقط ردیف‌های `active` |
| ترتیب مسیر | **قبل از** `/:id` ثبت شده (وگرنه `/:id` مقدار «dictionaries» را شناسه می‌گیرد) |
| آزمون | `Backend/portal-request-test.mjs` — ۶ بررسی تازه (۸۰ در کل) |

### چرا از `/api/dictionary` استفاده نشد؟

آن ۱۶ مسیر کلید مجوز `dictionary.*.view` (**مدیریتی**) می‌خواهند؛ بازبین صف
نباید برای دیدن نام نژاد، مجوز مدیریت دیکشنری بگیرد. مسیر تازه فقط
`{id,name}` ردیف‌های فعال را پشت همان کلید صف می‌دهد و **هیچ مدل دادهٔ
مشتری** را لمس نمی‌کند (`Unit/Hall/ChickPlacement/WeeklyManagement/CustomerPersonalInfo`
در `DICTIONARY_MODELS` نیستند — گارد این را با regex منفی می‌سنجد).

## ۴) «زمینهٔ درخواست» — کدام سالن؟

`GET /api/portal-requests/:id` حالا `{ request, context }` برمی‌گرداند:

```js
context = { units: {12:"واحد نمونه"}, halls: {5:"سالن ۲"},
            placements: {"9":"دورهٔ ۱۴۰۴/۰۳/۱۲ (گله ۳)"},
            weeklies: {"4":"هفتهٔ ۴"}, flocks: {"3":"گلهٔ ۳"} }
```

🔒 سه محدودیت عمدی:

1. فقط ردیف‌هایی که شناسه‌شان در **payload همان درخواست** است.
2. اسکوپ با `customer_id` **همان درخواست** (شناسهٔ مشتری هرگز پارامتر نمی‌شود).
3. فقط برچسب کوتاه: نام واحد/سالن، تاریخ دوره، شمارهٔ گله/هفته —
   بدون تلفن، کد ملی یا آدرس (گارد PII را منفی می‌سنجد).

## ۵) سمت مشتری: پیگیری و فیلتر

| موضوع | مقدار |
|---|---|
| وضعیت فهرست | `farm.list = { status, page, limit: 20, total, pages, counts }` |
| فیلتر | `setFarmStatus()` — فقط `FARM_LIST_STATUS_KEYS` (پنج مقدار) به کوئری می‌رود؛ هر چیز دیگر «همه» |
| صفحه‌بندی | `loadFarm({ append })` — «نمایش بیشتر» فقط فهرست را اضافه می‌کند و ۱۶ کوئری دیکشنری را تکرار نمی‌کند (`options` کش می‌شود) |
| شمارنده‌ها | چیپ‌های وضعیت از `meta.counts` سرور (نه شمارش کلاینت) |
| کارت | خلاصهٔ ۶ ردیف نامدار + `<details>` کامل (همهٔ ردیف‌ها + جدول تجهیزات + پنج فهرست شناسه با نام) + `applied_at` |
| بعد از ثبت | فیلتر برداشته و صفحه ۱ می‌شود تا مشتری نتیجه را ببیند |
| صفحهٔ خالی‌شده | اگر `page > pages` (بعد از لغو)، یک‌بار به آخرین صفحه برمی‌گردد |

## ۶) آزمون‌ها

| آزمون | قبل | بعد |
|---|---|---|
| `Frontend/customer-portal-guard-test.mjs` | ۲۱۰ | **۲۲۰** (بخش ۱۸ · ۱۰ بررسی) |
| `Frontend/portal-requests-admin-guard-test.mjs` | ۳۰ | **۳۵** (بخش ۱۳.۱۶ · ۵ بررسی) |
| `Backend/portal-request-test.mjs` | ۷۴ | **۸۰** (بخش ۱۴ · ۶ بررسی) |

آزمون‌های «اجرای واقعی» تابع‌های خالص `portal.payload.js` را صدا می‌زنند
(بدون مرورگر): نام دیکشنری، تاریخ شمسی، بولین، حذف کلید ناشناخته،
`ids → نام`، `items` بدون دسته، و «زمینهٔ درخواست» با نگاشت `{id: label}`.

## ۷) عمداً در این موج نیست

| مورد | چرا |
|---|---|
| پیوست عکس/فایل برای درخواست | نیازمند جدول/مسیر آپلود و سهمیهٔ جدا — موج مستقل |
| `flock_delete` / ادغام گله | حذف گله آبشاری است؛ تصمیم کارشناس |
| «پاک‌کردن همهٔ ردیف‌های تجهیزات» از پورتال | ریسک از دست رفتن داده؛ نیازمند تصمیم جداگانه |
| ویرایش آرایه‌های شناسه از مودال کارشناس | بازنویسی آرایه بدون UI قابل‌اعتماد، دادهٔ هفتگی را خراب می‌کند (فقط نمایش + نام) |

## ۸) فهرست فایل‌های تغییر‌یافته

**تازه:** `Frontend/src/features/portal/portal.payload.js` · `docs/REVIEW-WAVE-13.16.md`

**بک‌اند:** `services/portalRequestService.js` · `controllers/portalRequestAdminController.js` ·
`routes/portalRequestRoutes.js` · `portal-request-test.mjs` · `README.md`

**فرانت:** `features/portal/portal.farm.rules.js` · `portal.farm.renderer.js` ·
`portal.farm.js` · `portal.css` · `features/portal-requests/portal-requests.renderer.js` ·
`portal-requests.manager.js` · `portal-requests.api.js` · `portal-requests.css` ·
`core/constants/api.const.js` · `customer-portal-guard-test.mjs` ·
`portal-requests-admin-guard-test.mjs` · `README.md`
