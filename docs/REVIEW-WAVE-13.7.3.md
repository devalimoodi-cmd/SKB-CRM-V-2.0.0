# موج ۱۳.۷.۳ — «تأیید خودکار ثبت‌نام» (سوییچ مدیر)

> **هدف:** مدیر بتواند از داخل کارت «درخواست‌های ثبت‌نام» یک سوییچ روشن کند تا
> ثبت‌نام‌های عمومی **بدون بازبینی** تأیید شوند: پروندهٔ مشتری + حساب کاربری
> همان لحظه ساخته شود و متقاضی بی‌درنگ بتواند وارد شود.
> **پیش‌نیاز:** موج ۱۳.۷.۲ (فیلدهای پروندهٔ مشتری روی فرم عمومی)
> **وضعیت:** پیاده‌سازی‌شده؛ backend `117/117`، فرانت `89/89`، `db:migrate` + `db:verify` سبز.

---

## ۱) مشکلی که این موج حل کرد

پس از ۱۳.۷.۲ متقاضی همهٔ داده‌های پرونده را در `/register` وارد می‌کرد، ولی
هنوز **همهٔ** درخواست‌ها در صف می‌ماندند و مدیر باید تک‌تک آن‌ها را باز و تأیید
می‌کرد. برای مشتریان عادی (که دادهٔ پرونده را خودشان فرستاده‌اند) این تأیید
عملاً یک تأییدِ تشریفاتی بود و ثبت‌نام را ساعت‌ها معلق نگه می‌داشت.

---

## ۲) تصمیم‌ها و چرایی

| # | تصمیم | چرا |
|---|---|---|
| D1 | پرچم در `settingsController.KEY_DEFS` با کلید `registration_auto_approve` (boolean، پیش‌فرض **false**) | همان جدول `app_settings` و همان اعتبارسنجی/نرمال‌سازی موجود؛ **بدون مایگریشن تنظیمات** |
| D2 | کلید در `PUBLIC_KEYS` **نیست** | فقط یک بولین نمایشی از `GET /api/registrations/config` به `/register` می‌رسد؛ درِ عمومی تنظیمات بسته می‌ماند |
| D3 | تأیید خودکار **همان** `approveRequest` را صدا می‌زند (تراکنش اتمیک، `customer_code` زیر قفل، `hooks:false`) | نسخهٔ دومِ مسیر تأیید = دو رفتار واگرا و دو باگ. الان فقط پرچم ممیزی `auto_approved` اضافه شده است |
| D4 | پروندهٔ تازه از **فیلدهای سفید خودِ ردیف درخواست** ساخته می‌شود (`newCustomer = {}` ⇒ `validateNewCustomer` fallback) | هویت متقاضی دستکاری‌شدنی نیست؛ `mobile_number`/`email` همیشه از درخواست می‌آید |
| D5 | **اگر موبایل از قبل در پرونده‌های مشتریان باشد، تأیید خودکار انجام نمی‌شود** (درخواست `pending` می‌ماند + دلیل ثبت می‌شود) | احراز مالکیت موبایل انجام نشده؛ اتصال خودکار به پروندهٔ موجود = تصاحب پروندهٔ دیگران در پورتال. مدیر می‌تواند در دو کلیک با حالت «پروندهٔ موجود» همان پرونده را وصل کند |
| D6 | شکست تأیید خودکار هرگز ثبت‌نام را باطل/حذف نمی‌کند | دادهٔ متقاضی باید بماند؛ ردیف `pending` + `auto_approve_error` برای مدیر کافی است |
| D7 | دو ستون ممیزی `auto_approved` / `auto_approve_error` روی `registration_requests` | در حالت خودکار `reviewed_by` خالی است؛ بدون این ستون‌ها «تأیید خودکار» از «تأیید دستیِ یک مدیر حذف‌شده» قابل تفکیک نیست |
| D8 | سوییچ در بخش ثبت‌نام، با `PUT /api/registrations/settings`؛ نوشتن = `users.registrations.review` و **روشن‌کردن** + `customers.register` | مسیر `PUT /api/settings/:key` مجوز `settings.edit` می‌خواهد که معنایش «تنظیمات سیستم» است؛ اما این پرچم اجازهٔ **ساخت پروندهٔ مشتری بدون بازبینی** می‌دهد |
| D9 | بدون توکن: پاسخ عمومی همچنان شناسه/توکن ندارد، فقط متن موفقیت فرق می‌کند | توکن‌دهی از درِ عمومی سطح حمله را بالا می‌برد؛ ورود از `/login` انجام می‌شود |
| D10 | کپچا و `registerLimiter` (۵/ساعت/IP) دست‌نخورده | با روشن‌بودن سوییچ هر درخواست یک حساب واقعی می‌سازد؛ این دو تنها ترمزهای ضدّ سوءاستفاده‌اند |

---

## ۳) بک‌اند

### تنظیمات (`Backend/controllers/settingsController.js`)

```js
registration_auto_approve: {
  type: "boolean",
  default: false,
  title: "تأیید خودکار ثبت‌نام عمومی (ساخت فوری حساب مشتری بدون بازبینی مدیر)",
},
```

تابع تازهٔ `writeSetting(key, raw, userId)` استخراج شد و `updateSetting` هم از
آن استفاده می‌کند ⇒ دو «درِ» نوشتن (تنظیمات و صف) یک اعتبارسنجی دارند.

### قواعد خالص (`Backend/services/registrationRules.js`)

| افزوده | نقش |
|---|---|
| `isAutoApproveEnabled(value)` | هم‌قاعده با `isRegistrationEnabled` (true/1/yes) — هر مقدار دیگر = خاموش |
| `MAX_AUTO_APPROVE_ERROR = 200` | برابر طول ستون `auto_approve_error` |
| `autoApprovalFailurePatch(reason)` | متن را `cleanText` و به ۲۰۰ کاراکتر کوتاه می‌کند؛ خالی ⇒ `null` |
| `approvalPatch({ …, autoApproved })` | `auto_approved` را ست و `auto_approve_error` را پاک می‌کند |
| `publicRequestView(autoApproved)` | دو پیام: `PUBLIC_PENDING_MESSAGE` / `PUBLIC_AUTO_APPROVED_MESSAGE` + `auto_approved` در پاسخ |
| `adminRequestView` | `auto_approved` و `auto_approve_error` هم به مدیر برمی‌گردد |

### سرویس (`Backend/services/registrationService.js`)

```js
autoApproveRequest(request) // هرگز throw نمی‌کند
  ۰) CustomerPersonalInfo.findOne({ mobile_number: request.mobile_number })
     └─ اگر بود ⇒ recordAutoApprovalFailure(...) + { ok:false, code:"AUTO_CUSTOMER_EXISTS" }
  ۱) approveRequest({ id, reviewerId: null, customerMode: "new", newCustomer: {}, autoApproved: true })
     ├─ موفق   ⇒ { ok:true, request, approval }
     └─ ناموفق ⇒ recordAutoApprovalFailure(result.message) + { ok:false, code, message }
  catch ⇒ recordAutoApprovalFailure("…خطای سیستمی") + { ok:false, code:"AUTO_APPROVE_ERROR" }
```

`recordAutoApprovalFailure` همیشه با `where: { id, status: "pending" }` آپدیت
می‌کند تا اگر همان لحظه مدیری درخواست را تأیید کرده باشد، دلیل شکست روی ردیف
`approved` نوشته نشود.

### کنترلر و روتر (`registrationController.js` / `registrationRoutes.js`)

| مسیر | دسترسی | کار |
|---|---|---|
| `GET /api/registrations/config` | عمومی | `auto_approve` هم برمی‌گردد (برای متن فرم و پیام موفقیت) |
| `POST /api/registrations` | عمومی + کپچا + لیمیتر | اگر پرچم روشن باشد `service.autoApproveRequest(created.request)` و سپس `publicRequestView(auto?.ok === true)` با کد ۲۰۱ |
| `GET /api/registrations/settings` | `users.registrations.view` | `{ auto_approve, can_review, can_register_customer, can_toggle }` |
| `PUT /api/registrations/settings` | `users.registrations.review` (+ `customers.register` برای روشن‌کردن) | `{ auto_approve: boolean }` ⇒ `writeSetting` + لاگ ممیزی `console.warn` |

پیام موفقیت برای متقاضی در حالت خودکار:
«ثبت‌نام شما کامل شد و حساب مشتری‌تان فعال است؛ اکنون می‌توانید با همان نام
کاربری و رمز وارد شوید.» — و در حالت شکست همان پیام خنثی «در حال بررسی»
می‌آید (دلیل داخلی به مهمان لو نمی‌رود).

### مایگریشن (`Backend/migrations/20261108000003-add-auto-approval-to-registration-requests.js`)

| ستون | نوع | نکته |
|---|---|---|
| `auto_approved` | `BOOLEAN NOT NULL DEFAULT false` | آیا بدون بازبینی مدیر تأیید شد؟ |
| `auto_approve_error` | `VARCHAR(200) NULL` | دلیل ناموفق‌بودن تأیید خودکار (ردیف `pending` می‌ماند) |

idempotent با `describeTable` و `down` کامل (برگشت هر دو ستون).
`Backend/models/RegistrationRequest.js` و `Backend/scripts/verify-db.js` هم دو
ستون تازه را می‌شناسند ⇒ `npm run db:verify` و `deploy.bat` قرمز نمی‌شوند.

---

## ۴) فرانت — پنل ادمین

### `Frontend/src/pages/admin-panel.html`

نوار `.regq-auto` بالای صف، داخل همان کارت:

| عنصر | نقش |
|---|---|
| `#regAutoApproveBar` | کلاس `is-on`/`is-disabled` با وضعیت سرور |
| `#regAutoApproveHint` | توضیح دائمی: «بی‌درنگ تأیید می‌شود … بدون بازبینی شما» |
| `#autoApproveRegistrationToggle` | چک‌باکس سوییچ (با `aria-describedby` به متن هشدار) |
| `#autoApproveRegistrationState` | «در حال بارگذاری… / روشن / خاموش / بدون مجوز / نامشخص» |

### `admin-panel.css`

`.regq-auto`، `.regq-auto.is-on` (سبز)، `.regq-auto.is-disabled`،
`.regq-switch` + `.regq-switch-track` (بدون تصویر؛ knob با
`inset-inline-start` ⇒ RTL/LTR-safe)، `.regq-badge.auto` و `.regq-auto-error`.
همهٔ رنگ‌ها از توکن‌های موجود ⇒ تم تاریک هم درست است.

### `admin-panel.service.js`

| تابع | کار |
|---|---|
| `setupAutoApproveRegistration()` | bind رویداد `change` (یک‌بار در `setupRegistrationQueue`) |
| `loadRegistrationReviewSettings()` | `GET /registrations/settings` ⇒ `autoApproveRegistration` + `autoApproveCanToggle` |
| `renderAutoApproveRegistration()` | رندر سوییچ/برچسب/کلاس نوار + tooltip دلیل قفل‌بودن |
| `saveAutoApproveRegistration(toggle)` | `PUT`؛ در خطا مقدار سرور بازگردانده و `loadRegistrationReviewSettings()` دوباره اجرا می‌شود |

- سوییچ وقتی `can_toggle !== true` باشد **غیرفعال** است (نبود
  `users.registrations.review` یا `customers.register`).
- در باز شدن بخش «درخواست‌های ثبت‌نام» مقدار از سرور تازه می‌شود (دو مدیر
  همزمان واگرا نمی‌مانند).
- **بدون مودال تأیید:** روشن‌کردن با یک کلیک + توست `warning` انجام می‌شود
  (پنل الگوی مودال تأییدیه ندارد و افزودنش برای یک چک‌باکس توجیه نداشت)؛
  خاموش‌کردن هم یک کلیک است ⇒ بازگشت‌پذیری کامل.
- هر روشن/خاموش‌شدن صف را دوباره می‌خواند تا ردیف‌های «تأیید خودکار» فوراً
  دیده شوند.

### `admin-panel.renderer.js`

- بج `.regq-badge.auto` («⚡ تأیید خودکار») روی ردیف‌های `auto_approved`.
- `.regq-auto-error` روی ردیف‌های `pending` که `auto_approve_error` دارند ⇒
  مدیر می‌بیند چرا این ردیف با اینکه سوییچ روشن بود تأیید نشد.
- همهٔ متن‌ها با `escapeHtml` (دادهٔ مدیر-محور/سرور).

---

## ۵) فرانت — صفحهٔ `/register`

- `GET /config` حالا `auto_approve` هم می‌دهد؛ اگر `true` باشد یادداشت
  `#regAutoApproveNote` بالای دکمهٔ ارسال دیده می‌شود («ثبت‌نام این سامانه
  خودکار تأیید می‌شود …»). در حالت بسته (`applyClosedState`) مخفی می‌شود.
- پیام موفقیت: اول `result.data.message` از سرور (منبع حقیقت)، بعد
  `result.data.auto_approved === true` یا پرچم زمان بارگذاری ⇒ متن
  «اکنون می‌توانید وارد شوید» به‌جای «پس از تأیید مدیر».
- هیچ توکن/شناسه‌ای ذخیره نمی‌شود؛ لینک «رفتن به صفحهٔ ورود» همان قبلی است.

---

## ۶) تست‌ها

| مجموعه | قبل | بعد |
|---|---|---|
| `Backend/registration-test.mjs` | ۹۳ | **۱۱۷** (بخش تازهٔ «۱۳.۷.۳»: ۲۴ بررسی) |
| `Frontend/registration-guard-test.mjs` | ۷۸ | **۸۹** (بخش تازهٔ «۱۳.۷.۳»: ۱۱ بررسی) |
| `npm run db:migrate` / `db:verify` | — | PASS (دو ستون تازه) |
| `node tools/gate.mjs` | — | GATE-PASS |

پوشش تست backend در این موج: کلید تنظیم + پیش‌فرض false + نبودن در
`PUBLIC_KEYS`، استخراج `writeSetting`، `isAutoApproveEnabled`،
`approvalPatch`/`autoApprovalFailurePatch`، دو پیام `publicRequestView`،
`adminRequestView`، وجود `autoApproveRequest` و مسیر/پرچم‌هایش، محافظ
پروندهٔ موجود، عدم throw، `config`/`register` کنترلر، گارد `customers.register`،
۴۰۰ برای مقدار غایب، دو مسیر `/settings`، مایگریشن/مدل/`verify-db`.

---

## ۷) سناریوهای دستی (چک‌لیست پذیرش)

1. سوییچ روشن، موبایل تازه ⇒ `POST /api/registrations` کد ۲۰۱ با پیام
   «اکنون می‌توانید وارد شوید»؛ در `/login` ورود موفق؛ ردیف با
   `status=approved`, `auto_approved=true`, `reviewed_by=null`,
   `customer_created=true`؛ پروندهٔ مشتری و `customer_code` ساخته شده.
2. سوییچ روشن، موبایل موجود در پرونده‌ها ⇒ همان ۲۰۱ با پیام «در حال بررسی»؛
   ردیف `pending` + `auto_approve_error`؛ پنل دلیل را نشان می‌دهد؛ مدیر با
   «پروندهٔ موجود» تأیید می‌کند.
3. سوییچ خاموش ⇒ رفتار قبلی (صف) بدون هیچ تغییری.
4. کاربر بدون `customers.register` ⇒ سوییچ غیرفعال + tooltip؛
   `PUT` مستقیم ⇒ ۴۰۳.
5. `PUT` با بدنهٔ `{}` ⇒ ۴۰۰.
6. سوییچ روشن + `registration_enabled` خاموش ⇒ ۴۰۳ «ثبت‌نام بسته است»
   (پرچم مادر مقدم است).

---

## ۸) خارج از دامنه (تغییر نکرد)

- منطق تأیید/رد دستی، مودال بررسی، مجوزها و کاتالوگ ۱۷۶ کلیدی.
- فرم `/register` از نظر فیلدها و اعتبارسنجی (فقط یک یادداشت اضافه شد).
- کپچا، لیمیترها، `PUBLIC_KEYS` و مسیرهای عمومی دیگر.
- پیامک خوش‌آمدگویی: در مسیر تأیید (دستی یا خودکار) ارسال نمی‌شود؛
  `smsService` بک‌اند موجود است و اگر لازم شد، موج بعدی با احترام به
  `auto_welcome_sms` آن را اضافه می‌کند.
- «اتصال خودکار به پروندهٔ موجود» به‌عنوان قابلیت آیندهٔ **اختیاری** مستند
  شد، نه در این موج (دلیل امنیتی در D5).

---

## ۹) ریسک‌ها و مهارها

| ریسک | مهار |
|---|---|
| ساخت انبوه حساب توسط ربات | کپچا + `registerLimiter` ۵/ساعت/IP + یکتایی `users`/`customer_personal_information` |
| تصاحب پروندهٔ مشتری موجود با دانستن موبایل | D5: تأیید خودکار فقط پروندهٔ **تازه** می‌سازد؛ موبایل تکراری ⇒ صف |
| حساب نیمه‌کاره (کاربر بدون پرونده یا برعکس) | همان تراکنش `approveRequest`؛ هر خطا ⇒ rollback کامل |
| دو مدیر/دو درخواست همزمان روی یک پرونده | کِلِیم اتمیک `UPDATE … WHERE status='pending'` + `LOCK TABLE` در شماره‌دهی |
| فراموش‌کردن روشن‌بودن سوییچ | بج «تأیید خودکار» روی ردیف‌ها + متن هشدار دائمی نوار + لاگ سرور با شناسهٔ کاربر تغییردهنده |
| لو رفتن دلیل شکست به مهمان | دلیل فقط در `auto_approve_error`/پاسخ مدیر؛ پاسخ عمومی همیشه خنثی |

---

## ۱۰) استقرار

```bash
cd Backend
npm run db:migrate      # auto_approved + auto_approve_error
npm run db:verify       # تأیید ستون‌ها
npm run test:registration
cd ../Frontend
npm run test:registration
cd ..
node tools/gate.mjs
```

سپس در پنل: «کاربران ← درخواست‌های ثبت‌نام» ⇒ سوییچ **تأیید خودکار**.
پیش‌فرض خاموش است؛ تا روشن نشود هیچ رفتاری تغییر نمی‌کند (zero-touch rollout).
