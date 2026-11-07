# موج ۱۳.۶ — ثبت‌نام عمومی مشتری + صف تأیید مدیر

> مدل انتخابی: **V3 — جدول مستقل `registration_requests`**؛ کاربر فقط پس از
> تأیید مدیر ساخته می‌شود.
> پیش‌نیاز: موج ۱۳.۵.۱ (پورتال و مودال‌های هدر)
> دامنه: ۱ مایگریشن + ۱ جدول + ۱ مدل + ۲ سرویس + ۱ کنترلر + ۱ روتر + ۳ کلید
> مجوز + ۱ کلید تنظیم + صفحهٔ `/register` + صف پنل + ۲ گارد تست.

---

## ۱) تصمیم‌ها و چرایی

| # | تصمیم | چرا |
|---|---|---|
| D1 | ثبت‌نام عمومی **همیشه** `role:"customer"` می‌سازد و `status:"active"` می‌گذارد؛ هر `role/status/customer_id` در بدنه **دور ریخته** می‌شود | ضدّ mass-assignment: هیچ مهمانی نمی‌تواند کارشناس/فعال بسازد |
| D2 | جدول مستقل صف؛ تا تأیید مدیر **هیچ ردیفی در `users`** ساخته نمی‌شود | پیش‌فرض مدل `User.status` روی `pending` است؛ اگر صف در همان جدول بود، ثبت‌نام عمومی جدول کاربران را با ردیف‌های نیمه‌کاره پر می‌کرد و فیلترهای موجود باید همه تغییر می‌کردند |
| D3 | تأیید = ساخت کاربر **+ پیوند اجباری پروندهٔ مشتری** | پورتال مشتری بدون `customer_id` → ۴۰۳ `CUSTOMER_LINK_MISSING`؛ «مشتری فعالِ بی‌پورتال» بدترین حالت UX بود |
| D4 | تأیید **دو** مجوز می‌خواهد: `users.registrations.review` (روت) و `users.customer.link` (کنترلر) | تفکیک «بازبین صف» از «کسی که مجاز است پرونده را پیوند بزند» |
| D5 | رد = `status:"rejected"` + دلیل اجباری (۳..۳۰۰) + `reviewed_by`/`reviewed_at` | ممیزی؛ دلیل به متقاضی نمایش داده نمی‌شود |
| D6 | پرچم سراسری `registration_enabled` با پیش‌فرض **false** | «امن به‌صورت پیش‌فرض»: تا مدیر روشن نکند، صفحه و اندپوینت هر دو بسته‌اند |
| D7 | کپچا + `registerLimiter` (۵/ساعت/IP) روی `POST /api/registrations` | ضدّ ثبت‌نام انبوه؛ کپچا یک‌بارمصرف است |
| D8 | رمز با bcrypt(10) **پیش از ذخیره** هش می‌شود؛ ساخت کاربر با `hooks:false` | مدل `User` در `beforeCreate` رمز را هش می‌کند؛ اگر همان هشِ ذخیره‌شده دوباره هش می‌شد، حساب ساخته‌شده هرگز قابل ورود نبود |
| D9 | کِلِیم اتمیک `UPDATE … WHERE status='pending'` داخل تراکنش | دو مدیر همزمان هرگز دو حساب از یک درخواست نمی‌سازند |
| D10 | حداقل رمز ۸ کاراکتر (فقط ثبت‌نام عمومی) | مدل `User` روی ۶ می‌ماند تا حساب‌های قدیمی نشکنند |

## ۲) ساختار دیتابیس

`Backend/migrations/20261108000000-create-registration-requests.js` (idempotent):

| ستون | نوع | نکته |
|---|---|---|
| `first_name`/`last_name` | STRING(100) | عکس لحظهٔ ثبت |
| `username`/`email`/`mobile_number` | STRING | سه ایندکس **یکتای جزئی** با `WHERE status='pending'` |
| `password_hash` | STRING(255) | bcrypt(10) — **هیچ ستون رمز خامی وجود ندارد** |
| `requested_customer_code` | STRING(50) | ادعای متقاضی؛ فقط کمک به بازبین |
| `note` | TEXT | اختیاری |
| `status` | STRING(20) | `pending | approved | rejected` |
| `reject_reason` | STRING(300) | اجباری در رد |
| `reviewed_by`/`reviewed_at`/`created_user_id` | INTEGER/INTEGER/DATE | بدون FK (هم‌الگو با `login_challenges`) |
| `ip`/`user_agent` | STRING(45)/(255) | ضد اسپم/ممیزی |

ایندکس‌ها: `registration_requests_pending_{username,email,mobile}_unique` (partial)
و `registration_requests_status_created_at`.

`Backend/scripts/verify-db.js` هم جدول/ستون‌ها/ایندکس‌ها/شمارنده را می‌شناسد
⇒ `npm run db:verify` (و `deploy.bat`) قرمز نمی‌شود.

## ۳) لایه‌های کد

| فایل | نقش |
|---|---|
| `Backend/services/registrationRules.js` | **خالص**: اعتبارسنجی فیلدهای سفید، نرمال‌سازی ارقام فارسی/عربی، `buildRequestRow`، `canReview`، `approvalPatch`/`rejectionPatch`، `adminRequestView`/`publicRequestView`، `isRegistrationEnabled` |
| `Backend/services/registrationService.js` | **داده**: هش رمز، بررسی تکراری‌ها (کاربران + صف)، فهرست/شمارش، تأیید تراکنشی، رد |
| `Backend/controllers/registrationController.js` | پرچم تنظیمات، کپچا، مجوز `users.customer.link`، نگاشت کد خطا → HTTP |
| `Backend/routes/registrationRoutes.js` | ۶ مسیر (۲ عمومی + ۴ مدیریتی) |
| `Backend/controllers/settingsController.js` | `registration_enabled` + `PUBLIC_KEYS` + `readSetting()` |
| `Backend/config/permissions.js` | `users.registrations.view` · `users.registrations.review` · `admin.menu.registrations` (۱۷۳ → **۱۷۶** کلید، همان ۱۷ گروه) |
| `Backend/models/RegistrationRequest.js` | تعریف ستون‌ها (بدون association) |

### مسیرها

| متد | مسیر | دسترسی |
|---|---|---|
| `GET` | `/api/registrations/config` | عمومی — `{ enabled, captcha_enabled, min_password_length }` |
| `POST` | `/api/registrations` | عمومی — `registerLimiter` + کپچا + پرچم |
| `GET` | `/api/registrations/pending-count` | `protect` + `users.registrations.view` |
| `GET` | `/api/registrations?status=` | `protect` + `users.registrations.view` |
| `POST` | `/api/registrations/:id/approve` | `protect` + `users.registrations.review` + `users.customer.link` |

## ۴) فرانت‌اند

| فایل | نقش |
|---|---|
| `Frontend/src/pages/register.html` | صفحهٔ عمومی ثبت‌نام (بدون هدر/فوتر/گارد) — فیلدهای سفید + کپچا + حالت بسته/موفق |
| `Frontend/src/features/registration/registration.css` | تمام کلاس‌ها با پیشوند `.reg-` (هیچ سلکتور سراسری ندارد) |
| `Frontend/src/features/registration/registration.api.js` | `fetch` خام برای دو اندپوینت عمومی (بدون `apiService` ⇒ بدون ریدایرکت ۴۰۱) + کپچا |
| `Frontend/src/features/registration/registration.service.js` | خواندن پرچم، بارگذاری کپچا، اعتبارسنجی سبک کلاینت، نمایش خطای فیلدبه‌فیلد |
| `Frontend/server.js` | روت‌های `/register` و `/register.html` (عمداً **در** `LOADER_PAGES` نیست) |
| `Frontend/src/core/services/app.service.js` | `pageConfigs.register` = `requiresAuth:false` + نگاشت مسیر |
| `Frontend/src/core/constants/api.const.js` | `ENDPOINTS.REGISTRATIONS` (۶ مورد) |
| `Frontend/src/pages/login.html` | لینک «ثبت‌نام مشتری» در فوتر ورود |
| `Frontend/src/pages/admin-panel.html` | آیتم سایدبار `registration-requests` (`admin.menu.registrations`)، سکشن صف، مودال بررسی (تأیید/رد)، سوییچ تنظیمات |
| `Frontend/src/features/admin-panel/admin-panel.service.js` | `setupRegistrationQueue` · `loadRegistrationRequests` · `openRegistrationReview` · `confirmRegistrationApprove/Reject` · بج تعداد · سوییچ `registration_enabled` |
| `Frontend/src/features/admin-panel/admin-panel.renderer.js` | `renderRegistrationRequests` (همهٔ متن‌ها `escapeHtml`) + `renderRegistrationCustomerOptions` |
| `Frontend/src/features/admin-panel/admin-panel.api.js` | ۴ متد صف |
| `Frontend/src/features/admin-panel/admin-panel.css` | استایل `.regq-*` |

نکتهٔ امنیتی: دکمه‌های تأیید/رد فقط وقتی `users.registrations.review` وجود دارد
رندر می‌شوند (fail-open هم‌الگوی پنل) و سرور مستقل از آن، مجوز را می‌سنجد.

## ۵) گاردهای تست (ضد بازگشت)

**`Backend/registration-test.mjs` — ۵۵ بررسی (در موج ۱۳.۷ به ۶۹ رسید)، همه خالص + اسکن فایل:**

| دسته | نمونه |
|---|---|
| اعتبارسنجی | نام/نام‌کاربری/ایمیل/موبایل/رمز/تکرار رمز/طول توضیح، نرمال‌سازی ارقام فارسی و عربی |
| ضدّ ارتقای نقش | `role/status/customer_id` در بدنه ⇒ در `values` بازتولید نمی‌شوند؛ `buildRequestRow` همیشه `pending` |
| گذار وضعیت | `canReview` برای pending/approved/rejected/ناشناخته؛ `approvalPatch`/`rejectionPatch` |
| خروجی امن | `adminRequestView` بدون `password_hash/ip/user_agent`؛ `publicRequestView` بدون شناسه |
| اسکن مسیرها | `registerLimiter` روی POST عمومی، `protect`+کلید روی هر مسیر مدیریتی |
| اسکن سرویس | `hooks:false`، `role:"customer"`، `status:"active"`، کِلِیم اتمیک |
| اسکن تنظیمات/مجوز | `registration_enabled` (پیش‌فرض false + `PUBLIC_KEYS`) و سه کلید کاتالوگ |
| اسکن دیتابیس | ایندکس یکتای جزئی `WHERE status='pending'`، نبود ستون رمز خام، ثبت در `verify-db` |

**`Frontend/registration-guard-test.mjs` — ۳۹ بررسی (در موج ۱۳.۷ به ۵۲ رسید):** صفحه/فیلدها/کپچا/حالت‌ها،
نبود فیلد نقش، ترتیب لود پیکربندی، لایهٔ API، روت‌های فرانت، `pageConfigs`،
لینک ورود، هم‌خوانی `api.const`، صف پنل (منو/سکشن/مودال/گارد کلاینت/بج/escapeHtml)
و هم‌راستایی کلیدهای مجوز بین سرور و پنل.

## ۶) وریفای

```bash
# بک‌اند
cd Backend
node registration-test.mjs         # ✅ ALL PASS — 55/55
npm run test:permissions           # 176 کلید / 17 گروه
npx eslint .                       # بدون خطا

# فرانت‌اند
cd ../Frontend
node registration-guard-test.mjs   # ✅ ALL PASS — 39/39
npx eslint src                     # بدون خطا

# گیت کامل (۴۳ گام)
cd ..
node tools/gate.mjs                # GATE-PASS
```

**تست دودی زمان اجرا (روی سرور محلی، سپس حذف شد):** ۹/۹ —
`GET /api/registrations/config` با `enabled:false` · `POST` بسته → ۴۰۳ ·
با پرچم روشن → ۲۰۱ و ردیف `pending` با `password_hash` bcrypt ·
`created_user_id` تهی (کاربر ساخته نشده) · `POST` تکراری → ۴۰۰ ·
`GET` فهرست/شمارش بدون توکن → ۴۰۱ · پاک‌سازی ردیف تست و بازگرداندن پرچم.

> نکتهٔ واقعی که همین تست دودی گرفت: در نسخهٔ اول، `module.exports` سرویس پیش از
> تعریف `pendingCount`/`findRequest` بود ⇒ خطای TDZ هنگام `require` و بالا نیامدن سرور.
> ترتیب اصلاح شد و یک بررسی جدید («بارگذاری واقعی بدون خطا») به گارد بک‌اند اضافه شد.

```bash
# دیتابیس (تنها گام تغییردهنده — روی سرور/محیط مجاز)
cd Backend
npm run db:migrate                 # ساخت registration_requests
npm run db:verify                  # تأیید جدول/ستون‌ها/ایندکس‌ها
```

## ۷) چشمی (سناریوی پذیرش)

1. مدیر: تنظیمات سیستم → «ثبت‌نام عمومی مشتریان» را روشن کند.
2. مهمان: `/login` → «ثبت‌نام مشتری» → فرم را پر کند (کپچا) → پیام «ثبت شد،
   پس از تأیید وارد شوید». هیچ حسابی ساخته نشده است (`users` بدون ردیف تازه).
3. مهمان دوباره همان موبایل را بفرستد → «درخواست شما در حال بررسی است».
4. مدیر: «درخواست‌های ثبت‌نام» → بج ۱ → «تأیید» → انتخاب پروندهٔ مشتری (الزامی)
   → حساب `customer` فعال با همان `customer_id` ساخته می‌شود و کاربر می‌تواند
   وارد شود و `/portal` را کامل ببیند.
5. حالت رد: دلیل ۳+ کاراکتر → درخواست `rejected`؛ همان متقاضی می‌تواند دوباره
   ثبت‌نام کند (ایندکس یکتا فقط روی `pending` است).
6. مدیر سوییچ را خاموش کند → `/register` پیام «غیرفعال است» و `POST` هم ۴۰۳.

## ۸) خارج از دامنه (تغییر نکرد)

- `POST /api/users/register` (ثبت‌نام کارکنان) و کنترل دسترسی‌اش: صفر خط.
- هیچ GET موجودی به نقش `customer` باز نشد؛ هیچ توکنی در ثبت‌نام صادر نمی‌شود.
- پورتال مشتری و کلیدهای ۱۳.۵ دست‌نخورده‌اند.
- ارسال پیامک خوش‌آمدگویی هنگام تأیید **انجام نمی‌شود** (تنظیم `auto_welcome_sms`
  فقط به مسیر ثبت مشتری وصل است) — اگر لازم شد، موج بعدی.

## ۹) ریسک‌ها و مهارها

| ریسک | مهار |
|---|---|
| ثبت‌نام انبوه/اسپم | کپچا + ۵ درخواست در ساعت برای هر IP + تأیید دستی |
| ارتقای خودکار نقش | فیلد سفید سخت در `registrationRules` + تست اختصاصی |
| مشتری فعالِ بی‌پرونده | `customer_id` اجباری در UI و سرور |
| دو مدیر همزمان | کِلِیم اتمیک در تراکنش + `ALREADY_REVIEWED` |
| هشِ دوبارهٔ رمز | `hooks:false` + `isBcryptHash` + تست |
| شکستن `deploy.bat` | به‌روزرسانی `scripts/verify-db.js` |
| افشای وجود حساب (enumeration) | پیام تکراری صریح ولی پشت کپچا + لیمیت (trade-off آگاهانه) |

| `POST` | `/api/registrations/:id/reject` | `protect` + `users.registrations.review` |
