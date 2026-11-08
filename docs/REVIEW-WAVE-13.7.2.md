# موج ۱۳.۷.۲ — «همهٔ فیلدهای پروندهٔ مشتری روی فرم عمومی `/register`»

> پیش‌نیاز: موج ۱۳.۷.۱ (فرم سه‌ستونه + دیکشنری استان/شهرستان در مودال تأیید)
> دامنه: **بک‌اند + فرانت** — ۱ مایگریشن + ۱ مدل + ۲ سرویس + ۱ کنترلر + ۱ روتر +
> ۱ صفحه + ۳ فایل فرانت ثبت‌نام + ۱ سرویس پنل + ۲ تست گارد.
> تست‌ها: بک‌اند ۶۹ → **۹۳**، فرانت ۶۰ → **۷۸**، `gate` **GATE-PASS** (۴۳ گام).

---

## ۱) مشکلی که این موج حل کرد

| # | مشکل | اثر |
|---|---|---|
| P1 | متقاضی در `/register` فقط **حساب کاربری** می‌ساخت؛ «نوع مشتری / کد ملی / نام واحد / استان / شهرستان» را مدیر در مودال تأیید **دستی** وارد می‌کرد | دوباره‌کاری و خطای انسانی؛ کندی صف تأیید؛ دادهٔ پرونده از زبان خود مشتری گرفته نمی‌شد |
| P2 | اگر مدیر هنگام تأیید فراموش می‌کرد «پروندهٔ تازه» را پر کند، یا پرونده ناقص ساخته می‌شد یا تأیید با پروندهٔ موجودِ نامرتبط انجام می‌گرفت | پرونده‌های ناقص/ناسازگار در `customer_personal_information` |

## ۲) تصمیم‌ها و چرایی

| # | تصمیم | چرا |
|---|---|---|
| D1 | پنج فیلد به **`registration_requests`** اضافه شد (نه به `users`) | درخواست «عکس» متقاضی است؛ تا تأیید مدیر هیچ ردیفی در `users`/`customer_personal_information` ساخته نمی‌شود (همان مدل فاز ۱۳.۶) |
| D2 | همهٔ ستون‌ها **NULL-پذیر** | درخواست‌های موجودِ صف و فرم‌های ناقص نباید بشکنند (`db:migrate` بدون backfill) |
| D3 | **بدون FOREIGN KEY** برای `customer_type_id` (هم‌الگو با `created_customer_id`) | حذف/تغییر یک نوع مشتری نباید تاریخچهٔ درخواست‌ها را از بین ببرد؛ درستی مقدار در لایهٔ API سنجیده می‌شود |
| D4 | «نوع مشتری» در فرم عمومی **اجباری**؛ چهار فیلد دیگر اختیاری | پروندهٔ مشتریِ بی‌نوع بی‌معناست؛ کد ملی/نام واحد/استان/شهرستان در فرم مشتری هم اختیاری‌اند |
| D5 | اندپوینت عمومی تازهٔ `GET /api/registrations/customer-types` با خروجی **فقط `id` و `name`** و فقط انواع `active` | مسیر مدیریتی `/api/dictionaries/customer-types` مجوز `dictionary.customer-types.view` دارد و نباید عمومی شود؛ ضمناً `description`/`sort_order`/تاریخ‌ها لو نمی‌رود |
| D6 | استان/شهرستان از همان `GET /api/cities/provinces` و `/api/cities/cities-by-province/:state` (عمومی و موجود) | یک منبع حقیقت برای فرم مشتری، پنل ادمین و فرم عمومی |
| D7 | سرور **جفت استان/شهرستان** را می‌سنجد (`state_name` + `city_name`) | کاربر می‌تواند مقدار کشوها را دستکاری کند؛ «بیرجند در تهران» دادهٔ ناسازگار است |
| D8 | بررسی دیکشنری **fail-open** فقط وقتی جدول `cities` خالی/در دسترس نیست | خرابی یک جدول جانبی نباید ثبت‌نام عمومی را کاملاً قفل کند |
| D9 | «درخواست» منبع پیش‌فرض می‌شود: هنگام تأیید `customer_mode=new`، هر فیلدی که مدیر نفرستد **از درخواست** پر می‌شود | ادمین فقط بازبینی/اصلاح می‌کند؛ صفر تایپ دستی |
| D10 | رشتهٔ خالی از سمت مدیر = «پاک‌کردن فیلد»؛ `null`/`undefined` = «از درخواست پر کن» | بدون این تفکیک، ادمین هرگز نمی‌توانست مقدار اشتباه متقاضی را خالی کند |
| D11 | مجوز ساخت پرونده (`customers.register`) **حفظ شد** | فرم عمومی نباید درِ دور زدن مجوز ساخت مشتری شود؛ فقط داده را آماده می‌کند |
| D12 | هویت (`mobile_number`/`email`) همچنان **فقط از درخواست** خوانده می‌شود | ضدّ جعل هویت در بدنهٔ مدیر (قاعدهٔ ۱۳.۷ دست‌نخورده) |
| D13 | توضیح (`#regNote`) از تمام‌عرض به **سلول سوم ردیف پنجم** منتقل شد | صرفه‌جویی ~۹۰px ارتفاع؛ حفظ «بدون اسکرول عمودی» |

## ۳) بک‌اند

### مایگریشن (`Backend/migrations/20261108000002-add-customer-fields-to-registration-requests.js`)

| ستون | نوع | توضیح |
|---|---|---|
| `customer_type_id` | `INTEGER NULL` | نوع مشتری انتخاب‌شده (بدون FK) |
| `national_code` | `VARCHAR(10) NULL` | فقط ۱۰ رقم |
| `farm_name` | `VARCHAR(200) NULL` | نام واحد/مزرعه |
| `province` | `VARCHAR(50) NULL` | `cities.state_name` |
| `county` | `VARCHAR(50) NULL` | `cities.city_name` (وابسته به استان) |

`up/down` هر دو با `describeTable` محافظت شده‌اند ⇒ اجرای دوباره خطا نمی‌دهد
(هم‌الگوی مایگریشن ۱۳.۷).

### مدل (`Backend/models/RegistrationRequest.js`)
همان ۵ ستون با `field:` صریح + اعتبارسنج `isNationalCode` (۱۰ رقم، عیناً همان
قاعدهٔ `CustomerPersonalInfo` تا دادهٔ صف و پرونده هم‌قاعده باشد).

### قواعد خالص (`Backend/services/registrationRules.js`)
- `ALLOWED_FIELDS` += `customer_type_id, national_code, farm_name, province, county`.
- `validateRegistration`: نرمال‌سازی ارقام فارسی/عربی، `customer_type_id` عدد
  صحیح > ۰ (اجباری)، `national_code` ۱۰ رقم، سقف طول‌ها، و **«شهرستان بی‌استان» خطا**.
- `values.county` بدون استان همیشه `null` می‌شود (حتی اگر اعتبارسنجی نادیده گرفته شود).
- `buildRequestRow` / `adminRequestView` پنج فیلد را حمل می‌کنند
  (خروجی عمومی `publicRequestView` دست‌نخورده = بدون هیچ دادهٔ درخواست).
- `validateNewCustomer(input, request)`: تابع `pick(key)` — `null/undefined` ⇒ از
  درخواست، در غیر این صورت مقدار مدیر (شامل رشتهٔ خالی = پاک‌کردن).

### سرویس (`Backend/services/registrationService.js`)
- `assertCustomerTypeActive(id)`: وجود + `active !== false` (خطای فیلدی `customer_type_id`).
- `regionDictionaryUsable()`: آیا جدول `cities` پر است؟ (خطا ⇒ `false` + `console.warn`).
- `assertRegionPair({province, county})`: `state_name` باید باشد و `city_name` در
  همان استان (دو کوئری `LIMIT 1`).
- `createRequest`: این دو بررسی **پیش از** هش bcrypt انجام می‌شوند.

### کنترلر و روتر
```js
GET /api/registrations/customer-types   ← عمومی + publicDictLimiter (۱۲۰/ساعت)
   CustomerType.findAll({ where:{active:true}, attributes:["id","name"], limit:100 })
   → [{ id, name }]  +  Cache-Control: public, max-age=300
```

### `Backend/scripts/verify-db.js`
پنج ستون تازه به لیست صریح `registration_requests` اضافه شد
(بدون این کار `npm run db:verify` می‌شکست).


## ۴) فرانت — صفحهٔ `/register`

### چیدمان نهایی (۵ ردیف)

```
.reg-grid                ردیف ۱: نام | نام خانوادگی | شماره همراه
                         ردیف ۲: نام کاربری | ایمیل | کد/نام پروندهٔ مشتری
                         ردیف ۳: رمز عبور | تکرار رمز | کد امنیتی (#regCaptchaGroup)
.reg-grid--profile       ردیف ۴: نوع مشتری | کد ملی | نام واحد/مزرعه
                         ردیف ۵: استان | شهرستان | توضیح (#regNote)
#regSubmitBtn            دکمهٔ تمام‌عرض ارسال
```

- `#regCustomerType` (`<select>` اجباری) — از `/api/registrations/customer-types`.
- `#regNationalCode` (`maxlength=10`, `inputmode=numeric`) — فیلتر ارقام فارسی در `input`.
- `#regFarmName` (`maxlength=200`).
- `#regProvince` (`<select>`) — از `/api/cities/provinces`.
- `#regCounty` (`<select disabled>` تا انتخاب استان) — از `/api/cities/cities-by-province/:state`.
- همهٔ فیلدها `data-field` + `.reg-error` مخصوص خود دارند (هم‌قاعده با `applyFieldErrors`).

### استایل (`registration.css`)

| افزوده | نقش |
|---|---|
| `.reg-select` (+ `:focus`/`:disabled`/`.invalid`) | کشو هم‌ظاهر ورودی‌های متنی؛ فلش `fas fa-chevron-down` در `.reg-control > i` |
| `.reg-grid--profile` | جداکنندهٔ نازک بین «حساب» و «پرونده» |
| `.reg-grid .reg-textarea { min-height: 46px }` | توضیح در یک سلول شبکه (نه تمام‌عرض) |
| `@media (max-height:860px)` | padding عمودی ورودی/کشو ۹px و textarea ۴۲px |
| `@media (max-height:720px)` | پاورقی کامل پنهان، لوگو ۳۴px، عنوان ۱۷px |

> برآورد ارتفاع (بدون کپچا): ~۸۰۰px عادی و ~۶۱۰px در `≤720px` ⇒ در ۱۳۶۶×۷۶۸
> دکمهٔ ارسال بدون اسکرول دیده می‌شود.

### منطق (`registration.service.js`)

| تابع | نقش |
|---|---|
| `loadCustomerTypes()` | فقط انواع فعال؛ خطا ⇒ پیام زیر همان فیلد (فرم قفل نمی‌شود) |
| `loadProvinces()` | `state_name`ها؛ خطا ⇒ پیام «می‌توانید خالی بگذارید» |
| `resetCountyOptions(message)` | یک گزینهٔ پیش‌فرض + `disabled = true` |
| `loadCounties(province, selected)` | «در حال بارگذاری…» ⇒ `city_name`ها؛ استان خالی ⇒ بازنشانی |
| `readForm()` | پنج فیلد با **همان نام ستون‌های سرور** |
| `validate()` | نوع مشتری اجباری، کد ملی ۱۰ رقم، شهرستان بی‌استان |
| `clearFieldErrors/applyFieldErrors` | حالا `.reg-select` و `.reg-textarea` را هم پوشش می‌دهد |

`ENDPOINTS.REGISTRATIONS.CUSTOMER_TYPES` به `api.const.js` اضافه شد
(`registration.api.js` هنوز `fetch` خام دارد ⇒ بدون `apiService` و بدون ریدایرکت ۴۰۱).

## ۵) پنل — مودال تأیید بدون تایپ دستی

| تغییر | جزئیات |
|---|---|
| `this.newCustomerPrefill` | نگه‌داشتن دادهٔ پروندهٔ همان درخواست |
| `resetRegistrationNewCustomerForm(item)` | نام کامل/کد ملی/نام واحد از `item` پر می‌شود؛ نوع مشتری و استان پس از بارگذاری دیکشنری‌ها نشانده می‌شوند |
| `setRegistrationCustomerMode()` | **async** شد؛ در حالت `new` اول `loadRegistrationCustomerTypes` + `loadRegistrationProvinces` و سپس `applyRegistrationNewCustomerPrefill()` |
| `applyRegistrationNewCustomerPrefill()` | نوع مشتری/استان را فقط اگر گزینه‌اش موجود باشد انتخاب می‌کند و شهرستان‌ها را با `selected` می‌آورد |
| پیش‌فرض حالت | اگر `item.customer_type_id` باشد **و** ادمین `customers.register` داشته باشد ⇒ «ثبت پروندهٔ تازه»؛ وگرنه «پروندهٔ موجود» (درخواست‌های قدیمی) |
| خلاصهٔ مودال | نام واحد/استان/شهرستان/کد ملی متقاضی نمایش داده می‌شود |
| `buildRegistrationNewCustomer()` | مقادیر خالی به‌صورت رشتهٔ خالی ارسال می‌شوند (سرور آن را «پاک‌کردن» می‌فهمد) |

> 🔒 پرکردن فرم هرگز `customer_mode` را تغییر نمی‌دهد و مجوزها را دور نمی‌زند؛

## ۶) تست‌ها

| تست | قبل | بعد |
|---|---|---|
| `Backend/registration-test.mjs` | ۶۹ | **۹۳** (بخش ۸) |
| `Frontend/registration-guard-test.mjs` | ۶۰ | **۷۸** (بخش ۹) |
| `node tools/gate.mjs` | PASS | **GATE-PASS** (۴۳ گام) |
| `npm run db:migrate` / `db:verify` | PASS | PASS (۱۶ مایگریشن) |

پوشش تازه (نمونه):
- فیلدهای سفید جدید و رد شدن `role/status/customer_id` (بدون تغییر).
- «نوع مشتری» اجباری/غیرعددی/عددی، کد ملی با ارقام فارسی و ۹ رقمی، سقف `farm_name`/`province`.
- «شهرستان بی‌استان» ⇒ خطا و `values.county === null`.
- `buildRequestRow`/`adminRequestView` حامل پنج فیلد، بدون `password_hash`.
- `validateNewCustomer({}, request)` ⇒ همه‌چیز از درخواست؛ اولویت مقدار مدیر؛ `""` ⇒ پاک‌کردن.
- `assertCustomerTypeActive`/`assertRegionPair` پیش از `bcrypt.hash`.
- اندپوینت عمومی: فقط `id`/`name`، فقط `active:true`، بدون `protect`، با لیمیتر.
- گارد فرانت: `<select>` بودن سه فیلد، `disabled` شهرستان، `.reg-grid--profile`،
  `.reg-select.invalid`، سیم‌کشی `init`/`loadCounties` و payload، پیش‌پر شدن پنل.

**تست دودی زمان اجرا (روی دیتابیس محلی، سپس حذف شد):**
`assertCustomerTypeActive(1)` → `{ok:true}` · `(999999)` → خطای `customer_type_id` ·
`regionDictionaryUsable()` → `true` · استان واقعی → `{ok:true}` · استان جعلی → خطای
`province` · جفت واقعی → `{ok:true}` · شهرستان جعلی/بی‌استان → خطای `county` ·
`getPublicCustomerTypes` → **۲۰۰** با `Cache-Control: public, max-age=300` و
`[{ id, name }]` (۴ نوع فعال؛ بدون هیچ ستون داخلی).

## ۷) سناریوهای دستی (چک‌لیست پذیرش)

1. `/register` با ثبت‌نام باز: کشوی «نوع مشتری» پر است؛ استان‌ها از سرور می‌آیند؛
   شهرستان تا انتخاب استان غیرفعال است و با تغییر استان صفر می‌شود.
2. ارسال بدون نوع مشتری ⇒ خطای فیلدی زیر همان کشو و هیچ درخواستی ثبت نمی‌شود.
3. کد ملی ۹ رقمی ⇒ خطای فیلدی؛ کد ملی ۱۰ رقمی ⇒ درخواست ثبت می‌شود.
4. درخواست با استان «خراسان جنوبی» و شهرستان «بیرجند» ⇒ در صف، خلاصهٔ مودال همان
   استان/شهرستان/کد ملی/نام واحد را نشان می‌دهد.
5. تأیید با «ثبت پروندهٔ مشتری جدید» **بدون تایپ** ⇒ پروندهٔ ساخته‌شده همان پنج مقدار را
   دارد و `mobile_number`/`email` از درخواست آمده است.
6. تأیید درخواست قدیمی (بدون نوع مشتری) ⇒ پیش‌فرض «پروندهٔ موجود» است (رفتار ۱۳.۶).
7. `POST /api/registrations` با `role:"admin"` ⇒ فقط لاگ هشدار، بدون اثر.
8. قطع شبکه روی `/api/registrations/customer-types` ⇒ پیام زیر کشو، فرم باز می‌ماند.

## ۸) خارج از دامنه (تغییر نکرد)

- منطق تأیید/رد، مجوزها و کاتالوگ مجوزها (۱۷۶ کلید / ۱۷ گروه).
- جدول‌های `users`، `customer_personal_information`، `cities` و `customer_types`.
- فرم مشتری (`customer-list`) و دیکشنری‌هایش.
- `publicRequestView` (پاسخ ثبت‌نام همچنان بدون هیچ دادهٔ درخواست).

## ۹) ریسک‌ها و مهارها

| ریسک | مهار |
|---|---|
| بازگشت «کار دستی ادمین» | پیش‌پر شدن اجباری مودال از درخواست + بررسی گارد پنل |
| عمومی‌شدن دیکشنری مدیریتی | اندپوینت جداگانه با خروجی `id`/`name` و فقط انواع فعال |
| دورزدن مجوز ساخت مشتری از درِ عمومی | `customers.register` در تأیید حفظ شد؛ فرم فقط داده جمع می‌کند |
| استان/شهرستان جعلی یا ناسازگار | `assertRegionPair` روی `state_name`+`city_name` + سقف طول |
| قفل شدن ثبت‌نام با خرابی دیکشنری شهرها | `regionDictionaryUsable` (fail-open) + پیام فیلدی در فرانت |
| ذخیرهٔ کد ملی در صف (دادهٔ شخصی) | دسترسی صف محدود به `users.registrations.view`؛ خروجی عمومی هیچ فیلدی ندارد. **پیشنهاد آینده:** بی‌اثرکردن دادهٔ درخواست‌های ردشده پس از N روز |
| جا افتادن ستون‌ها در اسکیمای سرور | `db:verify` لیست صریح ستون دارد + گام مایگریشن در استقرار |
| اسکرول عمودی با ۵ ردیف | `.reg-grid--profile` + توضیح در سلول + دو حالت فشردهٔ ارتفاعی |

## ۱۰) استقرار

```bash
cd Backend
npm run db:migrate     # 20261108000002-add-customer-fields-to-registration-requests
npm run db:verify      # باید ALL PASS بدهد
```

⚠️ بدون مایگریشن، `POST /api/registrations` با پیام ۵۰۰ (`column ... does not exist`)
شکست می‌خورد.

> سرور همچنان `customers.register` + `users.registrations.review` می‌خواهد.
