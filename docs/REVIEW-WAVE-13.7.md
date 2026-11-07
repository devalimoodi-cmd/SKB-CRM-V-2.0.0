# موج ۱۳.۷ — بازطراحی صفحهٔ `/register` + «تأیید با ساخت پروندهٔ مشتری جدید»

> پیش‌نیاز: موج ۱۳.۶ (ثبت‌نام عمومی + صف تأیید)
> دامنه: ۱ مایگریشن + ۲ ستون + ۲ سرویس بک‌اند + ۱ کنترلر + ۱ مدل +
> بازطراحی کامل صفحهٔ ثبت‌نام (HTML/CSS) + سوییچ دوحالته در مودال تأیید پنل
> + ۱۳ بررسی جدید در گارد فرانت (۳۹ → **۵۲**) + ۱۴ بررسی جدید در گارد بک‌اند
> (۵۵ → **۶۹**).

---

## ۱) دو مشکل واقعی که این موج حل کرد

| # | مشکل | اثر روی کاربر |
|---|---|---|
| P1 | صفحهٔ `/register` هیچ لوگو/پس‌زمینه‌ای نداشت و با صفحهٔ ورود و بقیهٔ صفحات هم‌چهر نبود (کارت ساده روی زمینهٔ روشن، ورودی‌های بی‌آیکون) | حس «صفحهٔ جاافتاده/غیررسمی»؛ در تم تاریک هم کارت سفید می‌ماند |
| P2 | تأیید درخواست **فقط** با «انتخاب پروندهٔ مشتری موجود» ممکن بود؛ اگر متقاضی هیچ پرونده‌ای نداشت (مشتری کاملاً جدید)، مدیر نمی‌توانست تأیید کند و باید اول از مسیر جدا پروندهٔ مشتری می‌ساخت | ثبت‌نام‌های واقعیِ مشتری نو در صف گیر می‌کردند |

## ۲) تصمیم‌ها و چرایی

| # | تصمیم | چرا |
|---|---|---|
| D1 | صفحهٔ ثبت‌نام همان **زبان بصری صفحهٔ ورود** را گرفت: لایهٔ `login-bg.jpg` + اورلی تیره + بلور، **لوگوی `skb-logo.png`** بالای کارت، شیشهٔ نیمه‌شفاف، ورودی‌های آیکون‌دار | کاربر از `/login` به `/register` می‌رود؛ پرشِ ناگهانی سبک، حس «سایت دیگر» می‌دهد |
| D2 | همهٔ رنگ‌ها از توکن‌ها (`--primary`، `--surface-rgb`، `--danger-soft`…) با fallback | حالت تاریک بدون قاعدهٔ تازه کار می‌کند |
| D3 | CSS صفحه **هیچ سلکتور سراسری** (`body`/`html`) ندارد؛ همه‌چیز با پیشوند `.reg-` | استایل صفحه نباید بقیهٔ سایت را بشکند (همان قاعدهٔ ۱۳.۶) |
| D4 | حالت پیش‌فرض تأیید = `existing` (پروندهٔ موجود) | سازگاری کامل با رفتار ۱۳.۶؛ هیچ مدیرِ عادت‌کرده غافلگیر نمی‌شود |
| D5 | حالت `new` **مجوز سوم** می‌خواهد: `customers.register` | ساخت پروندهٔ مشتری از درِ صف ثبت‌نام نباید راه دورزدن مجوز «ثبت مشتری جدید» باشد |
| D6 | `mobile_number` و `email` پروندهٔ تازه **فقط از ردیف درخواست** خوانده می‌شوند؛ بدنهٔ مدیر حق تعیینشان را ندارد | هویت متقاضی نباید با یک درخواست دستکاری‌شده عوض شود (anti-spoofing) |
| D7 | موبایل تکراری در `customer_personal_information` ⇒ **۴۰۹** با پیام «همان پرونده را انتخاب کنید» | جلوگیری از دو پروندهٔ مشتری برای یک شخص (دادهٔ تکراری و گزارش‌های غلط) |
| D8 | `customer_code` = `MAX(customer_code)+1` زیر `LOCK TABLE … SHARE ROW EXCLUSIVE MODE` (شروع از ۱۰۰۰) | همان قاعدهٔ `customerRegistrationController`؛ دو مدیر همزمان دو کد یکسان نمی‌گیرند |
| D9 | ساخت پرونده **داخل همان تراکنش تأیید** انجام می‌شود | یا هر سه (درخواست approved + پرونده + کاربر) یا هیچ‌کدام؛ «کاربر بی‌پرونده» ممکن نیست |
| D10 | دو ستون ممیزی `created_customer_id`/`customer_created` روی `registration_requests` | بعداً باید بدانیم این پرونده در جریان تأیید ساخته شد یا از قبل بود |
| D11 | اعتبارسنجی فرم «پروندهٔ تازه» در کلاینت آینهٔ سرور است (نوع مشتری اجباری، کد ملی ۱۰ رقم، طول نام) | پیام فوری بدون رفت‌وبرگشت شبکه؛ سرور هم مستقل همان را می‌سنجد (fail-closed) |

## ۳) دیتابیس

`Backend/migrations/20261108000001-add-customer-link-to-registration-requests.js`
(idempotent — با `describeTable`):

| ستون | نوع | نکته |
|---|---|---|
| `created_customer_id` | `INTEGER NULL` | پروندهٔ مشتری‌ای که در تأیید به حساب متصل شد (بدون FK — هم‌الگو با `created_user_id`) |
| `customer_created` | `BOOLEAN NOT NULL DEFAULT false` | آیا پرونده در همین تأیید **تازه ساخته شد**؟ |

`Backend/scripts/verify-db.js` هم این دو ستون را در اسکن `registration_requests`
می‌شناسد ⇒ `npm run db:verify` و `deploy.bat` قرمز نمی‌شوند.

## ۴) لایه‌های کد — بک‌اند

| فایل | تغییر |
|---|---|
| `Backend/services/registrationRules.js` | `CUSTOMER_MODE`/`CUSTOMER_MODES`/`normalizeCustomerMode` (ناشناخته ⇒ `null` ⇒ ۴۰۰)، `validateNewCustomer(input, request)` با **فیلد سفید** و پیش‌فرض نام از درخواست، ثابت‌های طول تازه، `approvalPatch` با `created_customer_id`/`customer_created`، فیلدهای جدید در `adminRequestView` |
| `Backend/services/registrationService.js` | `nextCustomerCode(transaction)` (LOCK TABLE + MAX+1)، `pickCustomerEmail` (ایمیل درخواست → `temp…@temp.skb-crm.ir` → `reg<id>@…`)، `createCustomerForRequest(values, request, reviewerId, transaction)`، بازنویسی `approveRequest({ customerMode, newCustomer })` با کدهای خطای تازه |
| `Backend/controllers/registrationController.js` | `customer_mode` + **شرط سوم** `userHasPermission(req, "customers.register")`، نگاشت ۷ کد خطای جدید به HTTP، پیام موفقیت متمایز، بازگرداندن `customer: { id, created }` |
| `Backend/models/RegistrationRequest.js` | دو ستون تازه در تعریف مدل |
| `Backend/migrations/20261108000001-…js` | مایگریشن idempotent دو ستون ممیزی |
| `Backend/scripts/verify-db.js` | اسکن ستون‌های تازه |
| `Backend/registration-test.mjs` | بخش ۷: ۱۴ بررسی تازه (۵۵ → **۶۹**) |

### مسیر تأیید (بدنهٔ درخواست و پاسخ)

```http
POST /api/registrations/:id/approve
Authorization: Bearer <adminToken>

# حالت ۱ — پروندهٔ موجود (رفتار ۱۳.۶)
{ "customer_mode": "existing", "customer_id": 42 }

# حالت ۲ — ساخت پروندهٔ تازه (موج ۱۳.۷)
{
  "customer_mode": "new",
  "customer": {
    "customer_type_id": 1,
    "full_name": "علی محمدی",       // خالی ⇒ نام از خود درخواست
    "national_code": "1234567890",   // اختیاری — فقط ۱۰ رقم
    "farm_name": "مرغداری نمونه",     // اختیاری
    "province": "خراسان جنوبی",        // اختیاری
    "county": "بیرجند"                // اختیاری
  }
}
```

پاسخ موفق: `{ request, customer: { id, created }, user: { … , customer_id } }`
با پیام «… پروندهٔ مشتری تازه ساخته و حساب کاربر به آن متصل شد».

| کد خطا | HTTP | معنی |
|---|---|---|
| `INVALID_MODE` | 400 | `customer_mode` ناشناخته |
| `INVALID_NEW_CUSTOMER` | 400 | فیلد سفید نامعتبر (`errors` فیلدبه‌فیلد هم برمی‌گردد) |
| `CUSTOMER_TYPE_NOT_FOUND` / `CUSTOMER_TYPE_INACTIVE` | 400 | نوع مشتری ناموجود/غیرفعال |
| `CUSTOMER_MOBILE_TAKEN` | 409 | موبایل متقاضی از قبل پرونده دارد ⇒ همان پرونده را انتخاب کنید |
| `CUSTOMER_EMAIL_TAKEN` | 409 | تداخل ایمیل یکتا (پس از چند fallback) |
| `CUSTOMER_INVALID` | 400 | خطای اعتبارسنجی مدل `CustomerPersonalInfo` |
| ۴۰۳ | 403 | نداشتن `users.customer.link` یا `customers.register` |

## ۵) لایه‌های کد — فرانت‌اند

| فایل | تغییر |
|---|---|
| `Frontend/src/pages/register.html` | بازنویسی کامل: `<a class="reg-brand">` با `/assets/images/skb-logo.png`، لایهٔ `reg-bg`، کارت `reg-shell` ۶۲۰px، ورودی‌های `.reg-control` آیکون‌دار، چیدمان دو ستونی (نام/نام‌خانوادگی، نام‌کاربری/موبایل، ایمیل تمام‌عرض، رمز/تکرار رمز)، کپچا در کادر استاندارد، پاورقی `reg-footer` با «درباره ما / راهنما / تماس با ما» + کپی‌رایت |
| `Frontend/src/features/registration/registration.css` | بازنویسی کامل؛ صفر بازنویسی `body`، همهٔ رنگ‌ها از توکن، واکنش‌گرای ۵۶۰px، `reg-bg` با `login-bg.jpg` + اورلی/بلور |
| `Frontend/src/features/registration/registration.service.js` | پنهان‌کردن `#regFormPanel` در حالت «بسته» و پس از «ثبت موفق» (قبلاً فرم خالی می‌ماند) |
| `Frontend/src/pages/admin-panel.html` | مودال بررسی: سوییچ `.regq-mode` (`regModeExistingBtn`/`regModeNewBtn`)، `#regExistingCustomerBlock`، `#regNewCustomerBlock` با `regNewCustomerType` + کد ملی + نام + واحد/مزرعه + استان + شهرستان، `#regNewCustomerError` |
| `Frontend/src/features/admin-panel/admin-panel.api.js` | `approveRegistration(id, payload = {})` (بدنهٔ چندحالته) + `getCustomerTypes()` روی `DICTIONARY.CUSTOMER_TYPES` |
| `…/admin-panel.service.js` | `canRegisterCustomers` · `canReadCustomerTypes` · `setRegistrationCustomerMode` · `resetRegistrationNewCustomerForm` · `loadRegistrationCustomerTypes` (تنبل) · `buildRegistrationNewCustomer` · `showRegistrationNewCustomerError`؛ بازنویسی `confirmRegistrationApprove` برای ساخت payload دوحالته و نمایش خطای سرور همان‌جای فرم |
| `…/admin-panel.renderer.js` | `linkedCustomer`: نمایش «پروندهٔ متصل: #id (تازه ساخته شد)» در ردیف صف |
| `…/admin-panel.css` | `.regq-mode`، `.regq-mode-btn(.active)`، `.regq-grid` (۲ ستون → ۱ ستون زیر ۶۴۰px)، `.regq-new-error` و قاعدهٔ `[hidden]` برای همان idها |

> ⚠️ نکتهٔ ظریف CSS: `[hidden]` روی `.regq-mode-btn` بی‌اثر است چون آن کلاس
> `display:inline-flex` دارد؛ برای همین قاعدهٔ صریح
> `#regModeNewBtn[hidden] { display: none !important; }` اضافه شد.

### جریان کاربری مودال تأیید

```
«درخواست‌های ثبت‌نام» → آیکون ✔ → مودال
   ├─ سوییچ: [اتصال به پروندهٔ موجود]  |  [ثبت پروندهٔ مشتری جدید]
   │                                        ↑ فقط با مجوز customers.register دیده می‌شود
   ├─ حالت موجود: جستجو + انتخاب پرونده (الزامی)  → { customer_mode:"existing", customer_id }
   └─ حالت تازه : نوع مشتری* + نام* + کد ملی + واحد/مزرعه + استان + شهرستان
                  (نام از خود درخواست پیش‌پر می‌شود)
                  → { customer_mode:"new", customer: { … } }
        خطای فیلد/سرور همان‌جا زیر فرم (#regNewCustomerError) + توست
```

## ۶) گاردهای تست (ضد بازگشت)

**`Frontend/registration-guard-test.mjs` — ۳۹ → ۵۲ بررسی**
(بخش ۷ تازه: «۱۳.۷»):

| بررسی | چه چیزی را قفل می‌کند |
|---|---|
| لوگو/`reg-bg`/پاورقی در صفحه | صفحه دیگر بی‌هویت نشود |
| `.reg-bg` + `login-bg.jpg` + `.reg-shell` + `.reg-control` و نبود `body{` | هم‌چشمی با صفحهٔ ورود + عدم نشت استایل سراسری |
| idهای سوییچ/بلوک‌ها/فرم تازه در HTML | حذف تصادفی UI در بازسازی‌های بعدی |
| `setRegistrationCustomerMode`/`buildRegistrationNewCustomer`/`payload.customer` | سیم‌کشی واقعی سرویس |
| `canRegisterCustomers` + `permissionService.can("customers.register")` | دور زدن مجوز از UI |
| پیش‌پر نام از درخواست + `digitsOnlyValue` | نرمال‌سازی کد ملی و تجربهٔ فرم |
| `approveRegistration(id, payload = {})` + `getCustomerTypes()` | قرارداد API پنل |
| `linkedCustomer` در رندرر | نمایش پروندهٔ متصل/تازه‌ساخته |
| `.regq-mode-btn.active`/`.regq-grid`/`.regq-new-error`/`[hidden]` | استایل و پنهان‌سازی صحیح |
| `CUSTOMER_MODE.NEW` + `customers.register` در کنترلر | مجوز سوم در سرور |
| `validateNewCustomer` + `request.first_name` + `errors.customer_type_id` | اعتبارسنجی خالص با پیش‌فرض نام |
| `createCustomerForRequest` + `mobile_number: request.mobile_number` + `CUSTOMER_MOBILE_TAKEN` | هویت از درخواست + ضدا تکرار |
| ستون‌های ممیزی در مایگریشن | فراموش‌نشدن مایگریشن |

هم‌چنین بررسی قدیمی «تأیید بدون `customer_id` ارسال نمی‌شود» به نسخهٔ دوحالته
به‌روزرسانی شد: `customerId <= 0` **و** `approveRegistration(item.id, payload)`
**و** `customer_mode: this.registrationCustomerMode`.

**`Backend/registration-test.mjs` — ۵۵ → ۶۹ بررسی**
(بخش ۷ تازه): `normalizeCustomerMode`، `validateNewCustomer` (نوع اجباری/کد ملی/نام از
درخواست/طول‌ها)، `approvalPatch` با ستون‌های ممیزی، `createCustomerForRequest` داخل
تراکنش، `nextCustomerCode` زیر قفل، `pickCustomerEmail` با fallback، شرط
`customers.register` در کنترلر، و ثبت ستون‌ها در مایگریشن و `verify-db`.

## ۷) وریفای

```bash
# بک‌اند
cd Backend
npm run test:registration     # ✅ ALL PASS — 69/69
npx eslint .                  # 0 error (۱ warning قدیمیِ otpService)

# فرانت‌اند
cd ../Frontend
node registration-guard-test.mjs   # ✅ ALL PASS — 52/52
npx eslint src                     # 0 error

# گیت کامل (۴۳ گام)
cd ..
node tools/gate.mjs                # GATE-PASS
```

```bash
# دیتابیس (تنها گام تغییردهنده — روی سرور/محیط مجاز)
cd Backend
npm run db:migrate       # افزودن created_customer_id + customer_created
npm run db:verify        # تأیید ستون‌های تازه
```

## ۸) سناریوی پذیرش چشمی

1. **صفحه:** `/register` → همان پس‌زمینه و لوگوی `/login`؛ کارت شیشه‌ای،
   ورودی‌های آیکون‌دار، پاورقی با لینک‌ها. با روشن/خاموش‌کردن تم، متن‌ها خوانا
   می‌مانند (هیچ رنگ ثابتی جز تصویر پس‌زمینه وجود ندارد).
2. **ثبت:** فرم را پر کن (کپچا) → پیام موفقیت، فرم پنهان و کارت «ثبت شد» نمایش
   داده می‌شود.
3. **تأیید با پروندهٔ موجود:** حالت پیش‌فرض → انتخاب پرونده → تأیید → حساب
   `customer` فعال با همان `customer_id` (رفتار ۱۳.۶).
4. **تأیید با پروندهٔ تازه:** سوییچ «ثبت پروندهٔ مشتری جدید» → نوع مشتری و کد ملی
   → تأیید → پیام «پروندهٔ مشتری تازه ساخته شد…»؛ در فهرست مشتریان یک ردیف با
   `customer_code` بعدی و همان موبایل/ایمیل درخواست دیده می‌شود و ردیف صف
   «پروندهٔ متصل: #id (تازه ساخته شد)» را نشان می‌دهد.
5. **موبایل تکراری:** همان موبایل قبلاً پرونده دارد → ۴۰۹ و پیام «همان پرونده را
   انتخاب کنید» (پروندهٔ دومی ساخته نمی‌شود؛ تراکنش برگشت).
6. **بدون مجوز ثبت مشتری:** کاربر فقط مجوز «مشاهده/بازبینی صف» دارد → دکمهٔ حالت
   «تازه» دیده نمی‌شود و اگر تلاش مستقیم API هم بشود، سرور ۴۰۳ می‌دهد.

## ۹) خارج از دامنه (تغییر نکرد)

- رفتار حالت `existing` عیناً همان ۱۳.۶ است (پیش‌فرض مودال).
- `POST /api/users/register` (ثبت‌نام کارکنان) و مسیر ثبت مشتری
  (`customerRegistrationController`) دست‌نخورده‌اند؛ فقط **قاعدهٔ شمارهٔ مشتری**
  از آن‌ها الگو گرفته شده است.
- پورتال مشتری، کلیدهای مجوز ۱۳.۵/۱۳.۶ و کاتالوگ مجوزها (**۱۷۶ کلید / ۱۷ گروه**)
  تغییر نکردند — مجوزهای استفاده‌شده از قبل وجود داشتند.
- ارسال پیامک خوش‌آمدگویی در حالت `new` **انجام نمی‌شود** (همان محدودیت ۱۳.۶).

## ۱۰) ریسک‌ها و مهارها

| ریسک | مهار |
|---|---|
| دو پروندهٔ مشتری برای یک شخص | بررسی موبایل + ایندکس یکتا (`CUSTOMER_MOBILE_TAKEN`) |
| جعل هویت متقاضی توسط مدیر | `mobile_number`/`email` فقط از ردیف درخواست |
| دو مدیر همزمان ⇒ دو `customer_code` یکسان | `LOCK TABLE … SHARE ROW EXCLUSIVE MODE` + `MAX+1` در تراکنش |
| نیمه‌کاره‌ماندن (پرونده ساخته شد، کاربر نه) | همه‌چیز در یک تراکنش با `rollback` |
| دور زدن مجوز ثبت مشتری | شرط سوم `customers.register` در کنترلر + پنهان‌شدن دکمه |
| ثبت‌نام تکراری با همان موبایل/ایمیل در پروندهٔ تازه | `pickCustomerEmail` با fallback امن و خطای صریح در بدترین حالت |
| شکستن ظاهر بقیهٔ صفحات با CSS تازه | صفر سلکتور سراسری؛ همه‌چیز `.reg-*` |
| بی‌اثر شدن `hidden` روی دکمه | قاعدهٔ صریح `#regModeNewBtn[hidden] { display:none !important }` |
| فراموشی مایگریشن روی سرور | `verify-db.js` + گام `db:migrate` در `deploy.bat`/`deploy.sh` |


