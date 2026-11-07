# گزارش موج ۱۳.۱ — ورود دومرحله‌ای با کد پیامکی (OTP)

> زیرفاز ۱۳.۱ ورود را برای **همهٔ نقش‌ها** دو مرحله‌ای می‌کند: رمز ⇒ کد ۶ رقمی پیامکی ⇒ نشست/توکن.
> تا پیش از این، هر کسی که رمز عبور را داشت (لو رفتن دیتابیس، فیشینگ، رمز مشترک کارخانه)
> مستقیم وارد می‌شد و **هیچ چیزی** روی گوشیِ کاربر بررسی نمی‌شد.

## ۱) ریشهٔ مشکل (چرا این زیرفاز لازم بود)

| ریسک | اثر واقعی بدون OTP |
|---|---|
| لو رفتن رمز یک کارشناس | دسترسی کامل به پروندهٔ همهٔ مشتریان — بدون هیچ ردی از دستگاه کاربر |
| رمز مشترک بین چند نفر | «چه کسی وارد شد؟» فقط با `username` پاسخ می‌گیرد، نه یک عامل انسانی |
| `users.token` طولانی‌عمر | توکن دزدیده‌شده تا انقضا کار می‌کرد (بدون تایید دوم) |
| SMS به‌عنوان «فقط اطلاع‌رسانی» | هیچ گامی از ورود به گوشی گره نخورده بود |

## ۲) تصمیم‌های قفل‌شده

| تصمیم | مقدار | چرا |
|---|---|---|
| اجباری برای همهٔ نقش‌ها | ✅ بدون استثنا | نقش «مدیر اصلی» هم هدفِ اول حمله است |
| «ذخیرهٔ دستگاه» | ❌ حذف شد | یک تیک، کلِ ۲FA را بی‌اثر می‌کرد |
| شناسهٔ ورود | نام کاربری / ایمیل / **موبایل** | کد به همان شماره می‌رود؛ کاربر لازم نیست نام کاربری را حفظ کند |
| عمر کد | **۱۸۰ ثانیه** (`LOGIN_OTP_TTL_SECONDS`) | شمارش معکوس روی صفحه؛ پنجرهٔ حدس کوچک |
| فاصلهٔ ارسال مجدد | **۶۰ ثانیه** (`LOGIN_OTP_RESEND_SECONDS`) | ضدّ SMS-bombing و کنترل هزینه |
| سقف تلاش روی یک کد | **۵** (`LOGIN_OTP_MAX_ATTEMPTS`) | ۵ حدس از ۹۰۰٬۰۰۰ حالت ⇒ احتمال موفقیت ۰٫۰۰۰۵٪ |
| سقف کد در یک ساعت | **۸** (`LOGIN_OTP_MAX_PER_HOUR`) | سقف هزینه به‌ازای هر کاربر |
| قالب sms.ir | `514103` (سرویس `send/verify`) | پارامترها: `NAME` · `OTP` · `TIME` |
| محل صدور توکن | **فقط** مرحلهٔ ۲ | جانِ معماری: مرحلهٔ ۱ هیچ نشستی نمی‌سازد |

## ۳) جریان دو مرحله‌ای

```
POST /api/users/login            ← شناسه + رمز + کپچا
   ├─ رمز غلط  → 401 (شمارندهٔ قفل حساب مثل قبل)
   └─ رمز درست → چالش ساخته می‌شود + پیامک
                 { requires_otp: true, challenge_id, masked_mobile,
                   expires_in: 180, resend_after: 60 }
                 ⛔ بدون token ⛔ بدون user_session

POST /api/users/login/verify     ← challenge_id + کد ۶ رقمی
   ├─ کد غلط   → 401 { reason: "invalid", attempts_left }
   ├─ منقضی    → 401 { reason: "expired" }
   ├─ مسدود    → 429 { reason: "blocked" }
   └─ کد درست  → نشست + توکن + { user, token, landing }
                 (چالش «consumed» می‌شود ⇒ ضدّ replay)

POST /api/users/login/resend     ← challenge_id  (فاصلهٔ ۶۰ ثانیه اجباری)
POST /api/users/login/cancel     ← challenge_id  (دکمهٔ «بازگشت»)
```

## ۴) چه چیزی در برابر حمله محافظت می‌کند

| حمله | دفاع |
|---|---|
| کرک کد ۶ رقمی | سقف ۵ تلاش روی هر چالش + محدودیت نرخ ۱۰ درخواست در دقیقه (`otpLimiter`) |
| Replay کد پس از ورود | چالش **یک‌بارمصرف** است (`status='consumed'` + `used_at`) |
| خواندن کد از دیتابیس | فقط `code_hash = SHA-256(code + ":" + OTP_PEPPER)` — کد خام جایی نیست |
| خواندن کد از لاگ پیامک | `sms_logs.message` عمداً کد را ندارد (گارد ایستا این را می‌سنجد) |
| حملهٔ زمان‌سنجی روی مقایسه | `crypto.timingSafeEqual` با اعتبارسنجی قالب hex |
| SMS-bombing / هزینه | سقف ساعتی + فاصلهٔ ارسال مجدد + سقف ارسال مجدد در هر چالش |
| دورزدن قفل حساب با OTP | پس از تایید کد هم `status` و `isLocked()` دوباره بررسی می‌شود |
| حدس کد با `Math.random` قابل‌پیش‌بینی | تولید کد فقط با `crypto.randomInt` (گارد ایستا: نبودِ `Math.random`) |
| پاک‌نشدن چالش‌ها | `purgeExpired` + پاک‌سازی دوره‌ای هر ۶ ساعت (`startHousekeeping`) |

## ۵) تغییرات (فایل‌به‌فایل)

### بک‌اند

| فایل | تغییر |
|---|---|
| `Backend/migrations/20261006000000-create-login-challenges.js` (**جدید**) | جدول `login_challenges` + ۳ ایندکس (`challenge_id` یکتا · `(user_id, status)` · `expires_at`) — idempotent |
| `Backend/models/LoginChallenge.js` (**جدید**) | مدل بدون FK به `users` (تاریخچه پس از حذف کاربر می‌ماند) — هم‌الگو با `UserSession`/`ActivityLog` |
| `Backend/services/otpRules.js` (**جدید**) | منطق **خالص** و بدون I/O: تنظیمات (TTL/سقف‌ها) · `hashCode` · `safeEqualHex` · `newCode` · `maskMobile` · `templateIdFor` · `challengeProblem` · `canResend` · `normalizeCode` |
| `Backend/services/otpService.js` (**جدید**) | گردش‌کار: `createChallenge` · `verifyChallenge` · `resend` · `cancel` · `purgeExpired` · `startHousekeeping` · `sendCode` |
| `Backend/controllers/loginOtpController.js` (**جدید**) | `verifyLogin` (نشست+توکن) · `resendLoginCode` · `cancelLogin` · `landingForRole` |
| `Backend/controllers/userController.js` | شاخهٔ OTP پس از رمز صحیح (بدون توکن) + پذیرش `mobile_number` به‌عنوان شناسهٔ ورود |
| `Backend/routes/userRoutes.js` | سه مسیر عمومی OTP با `otpLimiter` (قبل از `protect`) |
| `Backend/middleware/rateLimit.js` | `otpLimiter` (۶۰ ثانیه · ۱۰ درخواست · `LOGIN_OTP_RATE_MAX`) |
| `Backend/services/activityRules.js` | مسیر `users/login/verify` هم رویداد `login` حساب می‌شود (ردّ فعالیت موج ۱۲.۲) |
| `Backend/server.js` | راه‌اندازی پاک‌سازی چالش‌ها + هشدار در نبودِ `OTP_PEPPER` |
| `Backend/scripts/verify-db.js` | انتظار جدول `login_challenges` + ۳ ایندکس + ۱۸ ستون (بدون ستون کد خام) |
| `Backend/.env.example` | ۱۲ کلید تازهٔ OTP (اجبار · فلفل · قالب‌ها · TTL · سقف‌ها · تست) |

### فرانت‌اند

| فایل | تغییر |
|---|---|
| `Frontend/src/pages/login.html` | مرحلهٔ دوم روی **همان صفحه** (`#otpForm`: ورودی کد، شمارش معکوس `03:00`، ارسال مجدد، بازگشت) + حذف گزینهٔ ذخیرهٔ دستگاه + برچسب ورودی «نام کاربری، ایمیل یا شمارهٔ موبایل» |
| `Frontend/src/core/services/auth.service.js` | `login()` در صورت `requires_otp` فقط `{ challengeId, maskedMobile, expiresIn, resendAfter }` برمی‌گرداند · `verifyLoginOtp()` · `resendLoginOtp()` · `cancelLoginOtp()` · `_finishLogin()` تنها جای ذخیرهٔ توکن |
| `Frontend/src/core/constants/api.const.js` | `LOGIN_VERIFY` · `LOGIN_RESEND` · `LOGIN_CANCEL` |
| `Frontend/login-otp-guard-test.mjs` (**جدید**) | گارد فاز ۱۳.۱ — **۵۶** بررسی (منطق خالص + امنیت + ترتیب دو مرحله + مسیرها + فرانت + دیتابیس) |
| `Frontend/package.json` + `tools/gate.mjs` + `tools/gate.ps1` | `test:login-otp` به گیت اضافه شد |

## ۶) چرا کد به `otpRules.js` منتقل شد؟

`otpService` به مدل‌ها، دیتابیس و سرویس پیامک وابسته است؛ اگر قانون‌ها همان‌جا می‌ماندند،
گارد مجبور بود برای سنجش یک هش، به دیتابیس وصل شود. با جدا کردن منطق خالص:

- گارد **بدون دیتابیس** اجرا می‌شود (سریع و قطعی؛ ۳۰۰ نمونهٔ کد، پنجره‌های زمانی ثابت)
- قاعده‌ها یک‌جا دیده می‌شوند و `otpService` فقط I/O می‌کند
- هم‌الگو با `sessionRules.js` (موج ۱۲.۱) و `activityRules.js` (موج ۱۲.۲)

## ۷) نکتهٔ مهم برای استقرار (production)

```env
NODE_ENV=production
LOGIN_OTP_ENFORCE=true          # اگر تنظیم نشود، در production پیش‌فرض روشن است
OTP_PEPPER=<۶۴ کاراکتر تصادفی>   # بدون آن، سرور هشدار می‌دهد
SMS_API_KEY=<کلید sms.ir>
SMS_TEMPLATE_OTP_LOGIN=514103
```

- ⛔ `LOGIN_OTP_TEST_CODE` را در production خالی بگذارید (کد تست در production **نادیده** گرفته می‌شود).
- هر کاربر باید `mobile_number` معتبر (`09xxxxxxxxx`) داشته باشد؛ در غیر این صورت پیام
  «شمارهٔ موبایل معتبری برای این کاربر ثبت نشده است» و ورود انجام نمی‌شود (fail-closed).
- تغییر `OTP_PEPPER` چالش‌های موجود را بی‌اعتبار می‌کند (کدهای در جریان)، ولی چالش‌ها عمری
  ۳ دقیقه‌ای دارند؛ بی‌خطر است.

## ۸) گاردها و اعتبارسنجی

| ابزار | نتیجه |
|---|---|
| `npm run db:migrate` | مایگریشن `20261006000000-create-login-challenges` اجرا شد |
| `npm run db:verify` | **ALL PASS** — ۴۵ جدول · ۱۸ ستون `login_challenges` · ۳ ایندکس |
| `node tools/gate.mjs` | **GATE-PASS** — ۴۰ گام، ۰ خطا (`test:login-otp` = ۵۶/۵۶) |
| تست دودی دیتابیس (موقت، حذف شد) | ۱۲/۱۲ — چالش ساخته/هش‌شده · کد خام در لاگ نیست · کد غلط رد · یک‌بارمصرف · فاصلهٔ ارسال مجدد · لغو |

## ۹) کارهای باقی‌مانده (فازهای بعدی موج ۱۳)

| فاز | کار |
|---|---|
| ۱۳.۰ | `users.customer_id` (پیوند کاربر به پروندهٔ مشتری) |
| ۱۳.۲ | پورتال مشتری (`/portal`) |
| ۱۳.۳ | ثبت‌نام عمومی + صف تایید مدیر (قالب `SMS_TEMPLATE_OTP_REGISTER`) |
| ۱۳.۴ | کنسول مجوز مشتری |
| ۱۳.۵ | PWA (manifest · آیکون مربع از `skb-logo.png` · `sw.js` · پوستهٔ آفلاین) |
| ۱۲.۵-ب | backfill ردیف‌های تاریخی `activity_logs.customer_id` |

> ⚠️ محدودیت شناخته‌شده: `resend` کد **جدید** می‌سازد و `attempts` را صفر می‌کند؛ سقف ارسال
> مجدد (۵) جلوی سوءاستفاده از این «ریست» را می‌گیرد. سقف ساعتی (۸ کد) هم независиم‌اند.
