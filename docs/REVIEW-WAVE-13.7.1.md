# موج ۱۳.۷.۱ — «فرم سه‌ستونهٔ `/register` بدون اسکرول» + «دیکشنری استان/شهرستان در مودال تأیید»

> پیش‌نیاز: موج ۱۳.۷ (بازطراحی صفحهٔ ثبت‌نام + تأیید با پروندهٔ مشتری تازه)
> دامنه: **فقط فرانت‌اند** — ۱ صفحه (HTML) + ۱ فایل CSS + ۲ فایل پنل (HTML/CSS)
> + ۲ فایل JS پنل (api/service) + گارد فرانت (۵۲ → **۶۰**).
> بک‌اند **صفر تغییر** دارد (۶۹ بررسی همان‌طور پاس می‌شود).

---

## ۱) دو مشکل واقعی که این موج حل کرد

| # | مشکل | اثر روی کاربر |
|---|---|---|
| P1 | فرم ثبت‌نام با کارت ۶۲۰px و چیدمان تک‌ستونی/دوتایی، ارتفاعی بیش از ۱۰۰۰px می‌ساخت؛ روی لپ‌تاپ ۱۳۶۶×۷۶۸ دکمهٔ «ارسال درخواست» بیرون از صفحه می‌افتاد و کاربر باید اسکرول می‌کرد | احساس فرم طولانی و نیمه‌کاره؛ افت نرخ تکمیل ثبت‌نام |
| P2 | در مودال تأیید صف، «استان/شهرستان» پروندهٔ تازه **ورودی متنی آزاد** بود، در حالی که فرم مشتری (`customer-list`) این دو را از **دیکشنری** (`cities`) می‌گیرد | دادهٔ ناهمگون: «خراسان جنوبی» / «خراسان جنوبي» / «بیرجند» / «بیرجند مرکز» ⇒ گزارش‌های جغرافیایی ناسازگار |

## ۲) تصمیم‌ها و چرایی

| # | تصمیم | چرا |
|---|---|---|
| D1 | کارت از `620px` به **`980px`** و شبکهٔ **سه‌ستونه** (`.reg-grid`) جای سه `.reg-row` دوتایی | ۶ ردیف فیلد → ۳ ردیف؛ ارتفاع فرم ~۵۰۴px کم می‌شود |
| D2 | `grid-template-columns: repeat(3, minmax(0,1fr))` با `row-gap: 0` و اتکا به `margin-bottom` فیلد | حفظ همان ریتم عمودی قبلی؛ کمترین تغییر در رفتار `.reg-error`/`.reg-hint` |
| D3 | همهٔ `id`ها و `data-field`ها **دست‌نخورده** | `registration.service.js` (پرکردن، اعتبارسنجی، `applyFieldErrors`) و ۶۰ بررسی گارد بدون تغییر رفتار پاس می‌شوند |
| D4 | ۲ ستون در `≤900px` و ۱ ستون در `≤560px` | تبلت/موبایل نباید فیلدهای باریک و ناخوانا ببیند |
| D5 | دو حالت فشرده بر اساس **ارتفاع** (نه عرض): `max-height: 860px` و `max-height: 720px` | مشکل P1 یک مشکل ارتفاعی است؛ عرض ۱۳۶۶px کافی بود، ارتفاع ۷۶۸px نه |
| D6 | جملهٔ دوم زیرعنوان در `.reg-subtitle-extra` بسته شد | در ارتفاع خیلی کم می‌شود پنهانش کرد بدون حذف پیام اصلی |
| D7 | استان/شهرستان مودال تأیید به `<select>` تبدیل شدند ولی **شناسه‌ها حفظ** شد (`regNewCustomerProvince`/`regNewCustomerCounty`) | `buildRegistrationNewCustomer()` با همان `read(id).value` کار می‌کند ⇒ **صفر تغییر در منطق payload** |
| D8 | منبع دیکشنری = همان API فرم مشتری: `GET /api/cities/provinces` و `GET /api/cities/cities-by-province/:state` | یک منبع حقیقت برای همهٔ فرم‌ها؛ مسیرها از قبل در `server.js` mount شده‌اند و مجوز اضافه نمی‌خواهند |
| D9 | شهرستان **وابسته**: تا استان انتخاب نشود `disabled` است و با تغییر استان صفر می‌شود | «شهرستان بی‌استان» دادهٔ بی‌معناست |
| D10 | استان/شهرستان همچنان **اختیاری** | سرور هم همین را می‌پذیرد (`MAX_REGION_LENGTH = 50`، مقدار `null` مجاز) ⇒ سازگاری کامل با ۱۳.۷ |
| D11 | در `buildRegistrationNewCustomer` اگر استان خالی باشد، شهرستان هم `null` می‌شود | حتی اگر DOM دستکاری شود، جفتِ ناسازگار به سرور نمی‌رود |
| D12 | شکست شبکه در دریافت استان/شهرستان ⇒ `console.warn` + گزینهٔ «خطا در …» و **قفل‌نشدن** فرم | فیلد اختیاری است؛ خرابی دیکشنری نباید تأیید درخواست را ببندد |

## ۳) تغییرات صفحهٔ `/register`

### مارک‌آپ (`Frontend/src/pages/register.html`)

```
سربرگ (لوگو + عنوان + زیرعنوان با .reg-subtitle-extra)
پیام‌ها  → #regMessage
حالت‌ها → #regClosed / #regSuccess
فرم     → #regFormPanel > form#registerForm
          └── .reg-grid (۳ ستون)
              ردیف ۱: نام | نام خانوادگی | شماره همراه
              ردیف ۲: نام کاربری | ایمیل | کد/نام پروندهٔ مشتری
              ردیف ۳: رمز عبور | تکرار رمز | کد امنیتی (#regCaptchaGroup، پیش‌فرض hidden)
          ├── توضیح (#regNote، تمام‌عرض)
          └── دکمهٔ #regSubmitBtn
پاورقی
```

> ترتیب DOM برای تست قفل شده است: `regEmail` پیش از `regPassword` و
> توازن تعداد `<div>`ها (بررسی موجود گارد).

### استایل (`Frontend/src/features/registration/registration.css`)

| مورد | قبل | بعد |
|---|---|---|
| `.reg-shell` | `max-width: 620px` | **`980px`** |
| چیدمان فیلدها | `.reg-row` (۲ ستون، `gap:14px`) | **`.reg-grid`** (۳ ستون، `column-gap:14px`، `row-gap:0`) |
| `.reg-card` | `padding:34px 32px 26px` | `30px 30px 20px` |
| لوگو | `62px` | `54px` (و `44px`/`38px` در حالت فشرده) |
| `.reg-subtitle` | `12.5px / 2` | `12px / 1.85` |
| `.reg-textarea` | `min-height:78px` | `58px` |
| `.reg-hint` | `11.5px / 1.9` | `11px / 1.7` |
| پاورقی | `margin-top:20px; padding-top:16px` | `16px / 12px` |
| واکنش‌گرا | فقط `≤560px` | `≤900px` دو ستون · `≤560px` یک ستون · `max-height: 860px` · `max-height: 720px` |

### برآورد ارتفاع (چرا اسکرول حذف می‌شود)

| بخش | قبل | بعد (۱۹۲۰×۱۰۸۰) | بعد (۱۳۶۶×۷۶۸ → حالت فشرده) |
|---|---|---|---|
| سربرگ | ~۱۷۲px | ~۱۴۵px | ~۱۱۲px |
| فیلدها | ~۵۰۴px (۶ ردیف) | ~۲۵۲px (۳ ردیف) | ~۲۵۲px |
| توضیح | ~۱۶۲px | ~۹۴px | ~۹۴px |
| دکمه | ۵۶px | ۵۶px | ۵۶px |
| پاورقی | ~۱۲۸px | ~۱۱۰px | ~۶۰px |
| padding کارت + صفحه | ۱۴۰px | ۹۸px | ۷۰px |
| **جمع** | **~۱۰۶۰px** ❌ | **~۷۵۵px** ✅ | **~۶۴۴px** ✅ |

> ⚠️ صداقت مهندسی: در ارتفاع‌های بسیار کم (مثلاً ۷۲۰px و پایین‌تر با نوارهای
> مرورگر) ممکن است همچنان چند پیکسل اسکرول باقی بماند؛ کمینهٔ عملی همین است.

## ۴) تغییرات پنل (مودال تأیید/رد)

### مارک‌آپ (`Frontend/src/pages/admin-panel.html` — بلوک `#regNewCustomerBlock`)

```html
<div class="filed-flot-input select-input">
  <i class="fas fa-map float-icon"></i>
  <select id="regNewCustomerProvince" class="float-input float-select">
    <option value="">— انتخاب استان (اختیاری) —</option>
  </select>
  <label class="float-label">استان (اختیاری)</label>
  <i class="fas fa-chevron-down select-arrow"></i>
</div>

<div class="filed-flot-input select-input">
  <i class="fas fa-location-dot float-icon"></i>
  <select id="regNewCustomerCounty" class="float-input float-select" disabled>
    <option value="">— ابتدا استان را انتخاب کنید —</option>
  </select>
  <label class="float-label">شهرستان (اختیاری)</label>
  <i class="fas fa-chevron-down select-arrow"></i>
</div>
```

### API (`Frontend/src/features/admin-panel/admin-panel.api.js`)

| متد | اندپوینت |
|---|---|
| `getProvinces()` | `ENDPOINTS.CITIES.PROVINCES` = `/cities/provinces` |
| `getCitiesByProvince(stateName)` | `ENDPOINTS.CITIES.CITIES_BY_PROVINCE` = `/cities/cities-by-province/:state` (`encodeURIComponent`) |

### سرویس (`Frontend/src/features/admin-panel/admin-panel.service.js`)

| بخش | تغییر |
|---|---|
| `setupRegistrationQueue()` | لیسنر `change` روی `#regNewCustomerProvince` ⇒ `loadRegistrationCounties(value)` |
| `setRegistrationCustomerMode("new")` | علاوه بر `loadRegistrationCustomerTypes()`، `loadRegistrationProvinces()` هم صدا زده می‌شود (تنبل، `dataset.loaded`) |
| `resetRegistrationNewCustomerForm()` | `setValue("regNewCustomerCounty","")` جای خود را به `resetRegistrationCounties()` داد (صفر + `disabled`) |
| `loadRegistrationProvinces()` | **تازه** — `option.value = state_name`؛ خطا ⇒ گزینهٔ «خطا در دریافت استان‌ها» + `console.warn` |
| `resetRegistrationCounties(message)` | **تازه** — بازگشت به یک گزینهٔ پیش‌فرض + `disabled = true` |
| `loadRegistrationCounties(province, selected)` | **تازه** — «در حال بارگذاری…» ⇒ `city_name`ها؛ استان خالی ⇒ بازنشانی؛ خطا ⇒ «خطا در دریافت شهرستان‌ها» |
| `buildRegistrationNewCustomer()` | استان خالی ⇒ `county` هم `null` (جفتِ ناسازگار ارسال نمی‌شود) |

### CSS پنل (`Frontend/src/features/admin-panel/admin-panel.css`)

```css
.regq-grid .float-select:disabled { opacity: .65; cursor: not-allowed; }
```

## ۵) چرا بک‌اند تغییر نکرد

- `/api/cities` از قبل در `Backend/server.js` (خط ۳۴۸) mount شده است و
  `cityRoutes` هیچ `protect`/`permission` ندارد ⇒ ادمین با هر نقشی می‌تواند بخواند.
- `registrationRules.validateNewCustomer` استان/شهرستان را رشتهٔ **اختیاری** با
  سقف `MAX_REGION_LENGTH = 50` می‌پذیرد و نام استان/شهرستان ایران زیر این سقف است.
- بدنهٔ ارسالی همان `{ province, county }` رشته‌ای قبلی است ⇒ مایگریشن لازم نیست.

## ۶) تست‌ها

| تست | قبل | بعد |
|---|---|---|
| `Frontend/registration-guard-test.mjs` (بخش ۸: ۱۳.۷.۱) | ۵۲ | **۶۰** |
| `Backend/registration-test.mjs` | ۶۹ | ۶۹ (بدون تغییر) |
| `node tools/gate.mjs` | PASS | **GATE-PASS** (۴۳ گام) |

۸ بررسی تازهٔ بخش ۸:

1. `.reg-grid` جای `.reg-row` را گرفته است (HTML).
2. `.reg-grid` سه‌ستونه + `.reg-shell` با `max-width ≥ 900px` (CSS).
3. وجود `@media (max-height:860px)` و `(max-height:720px)` و `.reg-subtitle-extra`.
4. `#regNewCustomerProvince`/`#regNewCustomerCounty` واقعاً `<select>` هستند
   (و هیچ `<input>` با همان شناسه نمانده).
5. `#regNewCustomerCounty` پیش‌فرض `disabled` + فلش `select-arrow` در همان بلوک.
6. API پنل از `CITIES.PROVINCES` و `CITIES.CITIES_BY_PROVINCE` استفاده می‌کند.
7. سرویس پنل: `loadRegistrationProvinces` + `loadRegistrationCounties(...)` +
   `resetRegistrationCounties` + لیسنر `change` روی استان.
8. `const county = province ? …` (شهرستان بی‌استان ارسال نمی‌شود).

## ۷) سناریوهای دستی (چک‌لیست پذیرش)

1. `/register` در **۱۹۲۰×۱۰۸۰** و **۱۳۶۶×۷۶۸** (تم روشن و تاریک) ⇒ دکمهٔ ارسال
   بدون اسکرول عمودی دیده می‌شود.
2. `/register` در عرض ۸۰۰px ⇒ دو ستون؛ در ۳۹۰px ⇒ یک ستون (بدون سرریز افقی).
3. کپچا وقتی فعال است: در ستون سوم ردیف رمز ظاهر می‌شود و پیام خطایش همان‌جاست.
4. پنل → «درخواست‌های ثبت‌نام» → بررسی → «ثبت پروندهٔ مشتری جدید»:
   استان‌ها از سرور می‌آیند، شهرستان تا انتخاب استان غیرفعال است، با تغییر استان
   فهرست شهرستان‌ها عوض و مقدار قبلی صفر می‌شود.
5. تأیید با استان و بدون شهرستان ⇒ ۲۰۰ (هر دو اختیاری) و در پروندهٔ ساخته‌شده
   `province` پر و `county` خالی است.
6. قطع شبکه/خطای ۵۰۰ روی `/api/cities/*` ⇒ فرم تأیید قفل نمی‌شود و استان/شهرستان
   خالی ارسال می‌شود (فقط `console.warn`).

## ۸) خارج از دامنه (تغییر نکرد)

- منطق تأیید/رد، مجوزها (`customers.register`, `users.registrations.review`) و
  کاتالوگ مجوزها.
- ساختار جدول `registration_requests` و مایگریشن‌های ۱۳.۶/۱۳.۷.
- رفتار فرم مشتری (`customer-list`) و دیکشنری‌های آن.

## ۹) ریسک‌ها و مهارها

| ریسک | مهار |
|---|---|
| بازگشت به چیدمان باریک و اسکرول عمودی | بررسی گارد ۱۳.۷.۱ روی `.reg-grid`/`max-width`/`max-height` |
| بازگشت استان/شهرستان به ورودی متنی آزاد | بررسی «`<select>` است و `<input>` با همان شناسه وجود ندارد» |
| شهرستانِ بی‌استان در payload | `disabled` + `resetRegistrationCounties` + `const county = province ? …` |
| شکستن سرویس صفحهٔ ثبت‌نام با تغییر مارک‌آپ | حفظ `id`/`data-field`ها + بررسی توازن `<div>`ها در گارد |
| کندی/خطای دیکشنری شهرها | فیلدها اختیاری؛ خطا فقط `console.warn` و متن گزینه |
| فیلدهای باریک در تبلت | شکست ۹۰۰px به دو ستون و ۵۶۰px به یک ستون |

