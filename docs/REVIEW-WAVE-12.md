# گزارش موج ۱۲ — «حضور کاربران، نشست‌ها و ردّ فعالیت»

> برنچ: `chore/wave-12.1-sessions` · زیرفازهای انجام‌شده: **۱۲.۰ (Presence)** · **۱۲.۱ (Sessions)** · **۱۲.۲ (`activity_logs` — ردّ فعالیت)**
> زیرفاز بعدی: ۱۲.۳ پنل مدیریت «فعالیت کاربران»

## ۱) ریشهٔ باگ (چرا این موج شروع شد)

`users.online_status` فقط در **ورود** (`true`) و **خروج** (`false`) ست می‌شد و هیچ مرجع زمانی نداشت:

| سناریو | رفتار قبل | نتیجه |
|---|---|---|
| بستن ناگهانی مرورگر | `online_status` روی `true` می‌ماند | «آنلاین همیشه» |
| قطع اینترنت/برق | همان | «آنلاین همیشه» |
| تب رهاشده برای ساعت‌ها | همان | «آنلاین همیشه» |
| نشست منقضی‌شده (۷ روز) | همان | «آنلاین همیشه» |

⇒ فهرست «چه کسی آنلاین است» عملاً **بی‌اعتبار** بود.

دو نکتهٔ جانبی که در بازبینی کشف شد:
- در `userController.updateUser` دو فیلد مرده `is_online` و `last_seen`
  در `protectedFields` نگه داشته می‌شدند که **در دیتابیس وجود ندارند** (محافظِ توهمی).
- هیچ مکانیزم Realtime (SSE/WS) در پروژه نیست؛ برای همین فاز با **Polling** شروع شد
  (زیرساخت فعلی: پروکسی فرانت با استریم واقعی + `API_RATE_MAX=1200/min`، ظرفیت کافی برای heartbeat).

## ۲) راه‌حل — «آنلاین = تازه، نه فقط true»

معیار جدید آنلاین‌بودن (خالص، در `Backend/services/presenceRules.js`):

```
online  ⇔  online_status !== false   AND   (now - last_seen_at) <= PRESENCE_ONLINE_WINDOW_SECONDS
```

- `last_seen_at` با **هر درخواست احراز‌شده** تازه می‌شود (`middleware/auth.js` → `presenceService.touch`)،
  ولی با **throttle حافظه‌ای** (`PRESENCE_TOUCH_THROTTLE_SECONDS`) ⇒ نرخ نوشتن کنترل‌شده.
- فرانت هر `PRESENCE_HEARTBEAT_SECONDS` (۴۵s) و **فقط وقتی تب دیده می‌شود** ضربان می‌فرستد.
- «خروج» و «بستن تب» وضعیت را صریحاً آفلاین می‌کند، ولی `last_seen_at` **پاک نمی‌شود**
  ⇒ UI همچنان «آخرین فعالیت: ۵ دقیقه پیش» را دارد.
- کاربری که heartbeat‌اش قطع شود، خودبه‌خود از پنجره بیرون می‌افتد ⇒ **آفلاین**.

## ۳) تغییرات (فایل‌به‌فایل)

### بک‌اند
| فایل | تغییر |
|---|---|
| `migrations/20261004000000-add-user-presence.js` | ستون `users.last_seen_at` (TIMESTAMPTZ) + ایندکس `users_last_seen_at` — **idempotent** با `describeTable`/`showIndex` |
| `models/User.js` | فیلد `last_seen_at` |
| `services/presenceRules.js` | **منطق خالص و بدون وابستگی:** `isOnline` / `secondsSince` / `shouldTouch` / `describe` / `buildSummary` |
| `services/presenceService.js` | `touch()` (fire-and-forget + throttle + backoff اگر مایگریشن اجرا نشده باشد)، `markOffline()`، `getSummary()` |
| `middleware/auth.js` | بعد از احراز هویت: `presenceService.touch(user.id)` (بدون `await` ⇒ بدون تأخیر) |
| `routes/presenceRoutes.js` | `POST /heartbeat` · `POST /offline` · `GET /summary` (زیر `protect`) |
| `server.js` | mount: `app.use("/api/presence", presenceRoutes)` |
| `controllers/userController.js` | ورود: `last_seen_at` + `online_status:true` · آفلاین‌کردن: `last_seen_at` تازه · حذف فیلدهای مرده `is_online`/`last_seen` و افزودن `online_status`/`last_seen_at` به `protectedFields` |
| `scripts/verify-db.js` | `last_seen_at` جزو ستون‌های موردانتظار `users` |
| `.env.example` | `PRESENCE_ONLINE_WINDOW_SECONDS=120` · `PRESENCE_TOUCH_THROTTLE_SECONDS=60` · `PRESENCE_HEARTBEAT_SECONDS=45` |

### فرانت‌اند
| فایل | تغییر |
|---|---|
| `core/services/presence.service.js` (جدید) | heartbeat ۴۵ ثانیه‌ای (تب مرئی)، `visibilitychange` ⇒ ضربان فوری، `pagehide` ⇒ `POST /offline` با **fetch `keepalive`**، `stop/logout` |
| `core/constants/api.const.js` | بلوک `PRESENCE: { HEARTBEAT, OFFLINE, SUMMARY }` |
| `core/services/auth.service.js` | ورود ⇒ `presenceService.start()` · خروج ⇒ `presenceService.logout()` (پیش از پاک‌شدن توکن) |
| `core/services/app.service.js` | `presenceService.init()` در `initCoreServices` |

### دلایل دو تصمیم فنی (چرا این‌طور، نه آن‌طور)
- **fetch خام به‌جای `apiService`:** یادآوری حضور نباید توست خطا، ریدایرکت خودکار به صفحهٔ ورود یا لاگ پرحجم تولید کند.
- **`fetch(..., {keepalive:true})` به‌جای `navigator.sendBeacon`:** `sendBeacon` نمی‌تواند هدر
  `Authorization` بفرستد؛ اگر توکن را در query بگذاریم در لاگ سرور/تاریخ مرورگر **لو می‌رود**.
- **بدون کلید مجوز جدید:** کلید `users.onlineStatus.view` از قبل در کاتالوگ بود ولی **هیچ مسیری مصرفش نمی‌کرد**؛
  حالا مسیر `GET /presence/summary` آن را واقعاً اعمال می‌کند (به‌همراه `authorize(...ADMIN_ROLES)`)
  ⇒ نه کلید تکراری در پنل مدیریت، نه تغییر تعداد کاتالوگ (`TOTAL_PERMISSIONS` روی ۱۶۳ می‌ماند).

## ۴) تست‌ها

### الف) گارد گیت: `Frontend/presence-guard-test.mjs` — `npm run test:presence` (۳۲ بررسی)
بدون دیتابیس و بدون مرورگر (سبک بقیهٔ گاردها):
1. **توابع خالص:** تازه‌فعال ⇒ آنلاین · صریحاً آفلاین ⇒ آفلاین · **فعالیت کهنه ⇒ آفلاین (⭐ رفع باگ)**
   · بدون `last_seen_at` ⇒ آفلاین · `secondsSince` (تاریخ/ISO/null) · throttle · خلاصه + مرتب‌سازی.
2. **لایهٔ دیتابیس:** وجود مایگریشن `last_seen_at` + ایندکس + idempotency + `down`
   · فیلد مدل · ثبت در `db:verify` · `protectedFields`.
3. **نگهبان الگو:** هر جای بک‌اند که `online_status: true` نوشته می‌شود، `last_seen_at` هم **همان‌جا** نوشته شود
   (جلوگیری از بازگشت «آنلاینِ بی‌تاریخ») · میدل‌ور `protect` حضور را تازه می‌کند.
4. **مسیرها/امنیت:** هر سه endpoint · `protect` · کلید مجوز + نقش مدیریتی برای `summary` · mount در `server.js`.
5. **فرانت:** ثبت endpointها · heartbeat با fetch خام (بدون apiService) · `keepalive` (و نبود `sendBeacon`)
   · `visibilitychange`/`pagehide` · نبود حلقهٔ وابستگی auth↔presence.
6. **هم‌خوانی مقادیر:** `HEARTBEAT × 2 ≤ ONLINE_WINDOW` (۴۵×۲ ≤ ۱۲۰) و برابری
   `PRESENCE_HEARTBEAT_SECONDS` در `.env.example` با کد فرانت.
7. **ثبت گارد:** بودن `test:presence` در `Frontend/package.json` + **هر دو** `tools/gate.mjs` و `tools/gate.ps1`.

### ب) تست دیتابیسی (دستی): `Backend/presence-e2e-test.mjs` — `npm run test:presence:e2e` (۱۲ بررسی)
سرور واقعی روی پورت ۵۰۹۵ با پنجرهٔ ۲ ثانیه‌ای بالا می‌آید و روی **دیتابیس واقعی** بررسی می‌کند:
heartbeat ⇒ نوشتن `last_seen_at` در DB · `summary` ⇒ آنلاین · `offline` ⇒ آفلاین با حفظ «آخرین فعالیت»
· **⭐ فعالیت کهنه ⇒ آفلاین (اثبات زندهٔ رفع باگ)** · ۴۰۱ بدون توکن · ۴۰۳ برای نقش `expert`
· heartbeat هر کاربر برای خودش ۲۰۰. وضعیت کاربر مدیر در پایان **بازگردانی** می‌شود.

## ۵) اعتبارسنجی (اندازه‌گیری‌شده)

```
GATE-PASS — همهٔ ۳۵ گام exit=0 و fail=0   (test:presence = ۳۲ بررسی)
Backend: npm run check ✅ · lint صفر خطا ✅ · test:security ALL PASS ✅ · test:permissions ALL PASS ✅
DB: npm run db:migrate ✅ (20261004000000) · npm run db:verify ⇒ ok:true, fail:[]
E2E دستی: test:presence:e2e ⇒ ✅ ALL PASS (۱۲ بررسی روی دیتابیس واقعی)
اسنپ‌شات قرارداد سطح سرویس بازتولید شد (۵۸ فایل سرویس · گم‌شده: ۰)
```

## ۶) یادداشت اجرایی
- بعد از استقرار، **سرور بک‌اند را ری‌استارت** کنید (تغییر `middleware/auth.js` و روت تازه).
- اگر مایگریشن اجرا نشود، سرویس حضور **کرش نمی‌کند**؛ فقط یک‌بار هشدار می‌دهد و از نوشتن صرف‌نظر می‌کند
  (`npm run db:migrate` را اجرا کنید).
- تنظیم پنجره: در نصب‌های پرترافیک می‌توانید `PRESENCE_TOUCH_THROTTLE_SECONDS` را بالا ببرید؛
  مقدار heartbeat فرانت باید همیشه **دست‌کم نصف** پنجرهٔ آنلاین باشد.

## ۷) ادامهٔ موج ۱۲ (زیرفازهای بعدی)
1. **۱۲.۱ `user_sessions`:** جدول نشست‌ها (ورود/خروج/دستگاه/آی‌پی/آخرین فعالیت) + «خروج از نشست» + گزارش.
2. **۱۲.۲ `activity_logs`:** ✅ **انجام شد** — ردّ فعالیت سراسری (چه کسی، چه زمانی، کدام رکورد) + میدل‌ور ثبت + سیاست نگهداری. جزئیات: [`REVIEW-WAVE-12.2.md`](./REVIEW-WAVE-12.2.md)
3. **۱۲.۳ پنل مدیریت:** منوی «فعالیت کاربران» با ۳ تب (آنلاین‌ها / نشست‌ها / ردّ فعالیت)،
   Polling ۱۵ ثانیه‌ای و خروجی CSV.

### بدهی فنی که این فاز کشف کرد (برای ۱۲.۳)
رویدادهای `auth:login` / `auth:logout` **هیچ‌جا `dispatchEvent` نمی‌شوند**؛ پس شنونده‌های موجود در
`app.service.js` و `messages.service.js` (مثل توقف Polling پیام‌ها هنگام خروج) **کد مرده** هستند.
به‌جای تکیه بر آن‌ها، اتصال حضور در این فاز **مستقیم** (auth.service/app.service) انجام شد؛
زنده‌کردن آن رویدادها کار مستقلی است و در ۱۲.۳ بررسی می‌شود.

## ۸) زیرفاز ۱۲.۱ — جدول `user_sessions` («خروج از همهٔ دستگاه‌ها» واقعی شد)

### ۸.۱) ریشهٔ باگ
«خروج از همهٔ دستگاه‌ها» (`POST /users/:id/reset-token` ← دکمهٔ صفحهٔ تنظیمات) فقط `users.token` را بازنویسی می‌کرد.
چون هر دستگاه توکن مستقل خودش را دارد و (با `ENFORCE_SINGLE_SESSION=false`) توکنِ ذخیره‌شده در `users`
هرگز چک نمی‌شود، عملاً **هیچ دستگاهی بیرون نمی‌افتاد** ⇒ دکمه فقط نمایشی بود.

### ۸.۲) راه‌حل — `sid` داخل توکن
- هر ورود یک ردیف `user_sessions` + یک `sid` یکتا (۳۲ بایت تصادفی = ۶۴ کاراکتر hex) می‌سازد.
- `sid` داخل JWT می‌رود (`User.prototype.generateToken({ sid })`).
- `middleware/auth.js` هر درخواست را با `sid` به همان ردیف گره می‌زند؛ اگر ردیف بسته باشد ⇒ **۴۰۱ فوری**.
- توکن‌های قدیمی (بدون `sid`) دست‌نخورده کار می‌کنند ⇒ استقرار بدون بیرون‌افتادن کاربران.

### ۸.۳) تغییرات (فایل‌به‌فایل)
| فایل | تغییر |
|---|---|
| `migrations/20261004010000-create-user-sessions.js` | جدول `user_sessions` + ۳ ایندکس (`sid` یکتا · `user_id+ended_at` · `last_activity_at`) — **idempotent** (showAllTables/showIndex) · **بدون FK** (تاریخچه بعد از حذف کاربر می‌ماند) |
| `models/UserSession.js` | مدل جدید (با عکسِ `username`/`role` در لحظهٔ ورود) |
| `models/associations.js` | `User.hasMany(UserSession, { constraints: false })` + `belongsTo` |
| `models/User.js` | `generateToken(extra = {})` — پذیرش `sid` |
| `services/sessionRules.js` | **منطق خالص:** `isActive` · `shouldTouch` · `describeDevice` · `statusLabel` · `buildItem` · `buildSummary` |
| `services/sessionService.js` | `start` · `touch` (throttle + بررسی «هنوز باز است؟» در همان UPDATE) · `endBySid` · `endAllForUser` · `revoke` · `list` · `mine` · `summary` · `purgeExpired` |
| `middleware/auth.js` | خواندن `decoded.sid` → `req.sessionId` + بررسی زنده‌بودن نشست (۴۰۱ اگر بسته باشد) |
| `controllers/sessionController.js` · `routes/sessionRoutes.js` | `GET /mine` · `GET /summary` · `GET /` · `POST /:id/revoke` · `POST /users/:userId/revoke-all` |
| `server.js` | mount: `app.use("/api/sessions", sessionRoutes)` + `user_sessions` در `CRITICAL_TABLES` |
| `controllers/userController.js` | ورود: ساخت نشست + `sid` در توکن · خروج: بستن نشست همین دستگاه · تغییر رمز/بازنشانی توکن: بستن **همهٔ** نشست‌ها · تغییر نقش: بستن همهٔ نشست‌ها |
| `config/permissions.js` | کلید جدید `users.sessions.revoke` (پیش‌فرض ادمین‌ها · **بدون قفل**) ⇒ کاتالوگ ۱۶۳ → **۱۶۴** کلید (گروه‌ها همان ۱۶) |
| `scripts/verify-db.js` | جدول/ستون‌ها/۳ ایندکس/شمارندهٔ `user_sessions` |
| `.env.example` | `SESSION_TOUCH_THROTTLE_SECONDS=60` · `SESSION_RETENTION_DAYS=90` |
| `core/constants/api.const.js` · `core/services/session.service.js` (جدید) | بلوک `SESSIONS` + سرویس نازک روی `apiService` (بدون UI — کار پنل، ۱۲.۳) |

### ۸.۴) سه تصمیم کلیدی
1. **مشاهدهٔ نشست‌ها بدون کلید جدید:** فهرست/خلاصه با کلید موجود `users.onlineStatus.view` کنترل می‌شود؛ فقط «بستن نشست» کلید تازه گرفت (`users.sessions.revoke`) ⇒ تعداد کلیدهای قفل‌شده همان **۷** می‌ماند (تست `permissions-test` تضمینش می‌کند).
2. **سبک ماندن مسیر درخواست:** بررسی «زنده‌بودن نشست» حداکثر هر `SESSION_TOUCH_THROTTLE_SECONDS` (پیش‌فرض ۶۰s) با یک `UPDATE ... WHERE sid = ? AND ended_at IS NULL` انجام می‌شود و همان لحظه «آخرین فعالیت» هم می‌نویسد؛ داخل همان بازه فقط یک `Map` در حافظه چک می‌شود. `sid`های بسته‌شده با TTL پنج‌دقیقه‌ای نگه داشته می‌شوند تا ۴۰۱ روی همان پروسه آنی باشد.
3. **تاریخچه بعد از حذف کاربر:** بدون FOREIGN KEY + عکس `username`/`role` (هم‌الگو با `permission_audit_logs.actor_id`).

### ۸.۵) تست‌ها
- **گارد گیت:** `Frontend/session-guard-test.mjs` — `npm run test:sessions` (**۳۹ بررسی**): قواعد خالص (شامل ترتیب تشخیص Edge/iPhone در `User-Agent` و نبودِ لو رفتن `sid`) · مایگریشن/مدل/`db:verify`/`CRITICAL_TABLES` · میدل‌ور `sid` · پنج مسیر + کلیدهای مجوز + ترتیب مسیرهای ثابت · سیم‌کشی ورود/خروج/تغییر رمز/بازنشانی/تغییر نقش · فرانت (`SESSIONS` + سرویس نازک) · ثبت در هر دو gate runner.
- **تست دیتابیسی (دستی):** `Backend/session-e2e-test.mjs` — `$env:ALLOW_DB_TESTS='true'; npm run test:sessions:e2e` (**۱۵ بررسی** روی دیتابیس واقعی، پورت ۵۰۹۶): دو ورود = دو نشست مستقل (بدون `ENFORCE_SINGLE_SESSION`) · `/mine` با علامت «همین دستگاه» · فهرست/خلاصه · **⭐ بستن یک نشست ⇒ همان دستگاه ۴۰۱ و دستگاه دیگر ۲۰۰** · پایان/دلیل/بستن‌کننده در DB · خروج · `revoke-all` · ۴۰۱ بدون توکن · ۴۰۳ برای نقش غیرِمدیریتی · `/mine` هر کاربر برای خودش. کاربران و نشست‌های آزمایشی در پایان پاک می‌شوند.

### ۸.۶) اعتبارسنجی (اندازه‌گیری‌شده)
```
Backend: node --check همهٔ فایل‌های تغییریافته ✅ · lint صفر خطا ✅ · test:permissions ALL PASS ✅
DB: npm run db:migrate ✅ (20261004010000) · npm run db:verify ⇒ ✅ ALL PASS
E2E دستی: test:sessions:e2e ⇒ ✅ ALL PASS (۱۵ بررسی روی دیتابیس واقعی)
Frontend: lint صفر خطا ✅ · test:sessions ⇒ ✅ ALL PASS (۳۹ بررسی)
اسنپ‌شات قرارداد سطح سرویس بازتولید شد (۵۹ فایل سرویس · گم‌شده: ۰)
```

### ۸.۷) یادداشت اجرایی
- بعد از استقرار، بک‌اند را **ری‌استارت** کنید و `npm run db:migrate` را بزنید (ستون/جدول تازه + بررسی `sid`).
- اگر مایگریشن اجرا نشود، سرویس نشست کرش نمی‌کند: یک‌بار هشدار می‌دهد، با backoff از کوئری صرف‌نظر می‌کند و درخواست‌ها مثل قبل کار می‌کنند.
- توکن‌هایی که سرور برای «کاربرِ دیگری» صادر می‌کند (`setup-admin` · `register` · `reset-token` توسط ادمین روی کاربر دیگر · تغییر نقش) عمداً ردیف نشست نمی‌سازند؛ آن کاربر با اولین ورود خودش نشست می‌گیرد. در «خودِ کاربر» (تغییر رمز/بازنشانی توکن از صفحهٔ تنظیمات) همان دستگاه نشست تازه می‌گیرد تا بی‌دلیل بیرون نیفتد.
- `purgeExpired()` آماده است ولی در این فاز زمان‌بندی خودکار ندارد (سیاست نگهداری: `SESSION_RETENTION_DAYS` — کار ۱۲.۳).

## ۹) زیرفاز ۱۲.۲ — جدول `activity_logs` («چه کسی چه چیزی را تغییر داد»)

خلاصهٔ یک‌خطی: هر `POST/PUT/PATCH/DELETE` (+ ورود/خروج) با یک میدل‌ور سراسری روی `res.on("finish")`
در جدول `activity_logs` ثبت می‌شود — با بافر و `bulkCreate` (بدون تأخیر در پاسخ)، ماسک اجباری رمز/توکن،
بدون FOREIGN KEY (تاریخچه بعد از حذف کاربر می‌ماند) و پاک‌سازی خودکار طبق `ACTIVITY_RETENTION_DAYS`.

| مورد | مقدار |
|---|---|
| جدول | `activity_logs` (۴ ایندکس · بدون FK · `down` دارد) |
| کلید مجوز | `users.activity.view` (پیش‌فرض ادمین‌ها · بدون قفل) ⇒ کاتالوگ **۱۶۵** کلید / ۱۶ گروه |
| مسیرها | `GET /api/activity` · `GET /api/activity/summary` · `GET /api/activity/:id` |
| میدل‌ور | `middleware/activityLog.js` (skip: `/api/activity`, `presence/heartbeat|offline`, `/health`) |
| سرویس | `services/activityService.js` (+ منطق خالص در `services/activityRules.js`) |
| گارد | `Frontend/activity-guard-test.mjs` — `npm run test:activity` (**۷۱ بررسی**) |
| تست دیتابیسی | `Backend/activity-e2e-test.mjs` — `npm run test:activity:e2e` (**۲۰ بررسی**) |
| env | `ACTIVITY_LOG_ENABLED` · `ACTIVITY_RECORD_METHODS` · `ACTIVITY_LOG_VALUES` · `ACTIVITY_LOG_READS` · `ACTIVITY_FLUSH_MS` · `ACTIVITY_BUFFER_MAX` · `ACTIVITY_RETENTION_DAYS` · `ACTIVITY_PURGE_INTERVAL_HOURS` |

📄 جزئیات کامل (تصمیم‌ها، مرزهای امنیتی، فایل‌به‌فایل): [`REVIEW-WAVE-12.2.md`](./REVIEW-WAVE-12.2.md)

## ۱۰) زیرفاز ۱۲.۳ — پنل «فعالیت کاربران» (نمای خواندنِ ردّ فعالیت)

خلاصهٔ یک‌خطی: ردّ فعالیت از API به **UI** رسید — سکشنی در پنل ادمین با فیلتر/صفحه‌بندی/کارت خلاصه،
مودال جزئیات هر رویداد، خروجی CSV (با BOM برای اکسل فارسی) و لینک گیت‌شدهٔ رکورد هدف.

| مورد | مقدار |
|---|---|
| جای UI | سکشن `#activity-log` داخل `admin-panel.html` (بدون صفحه/روت جدید) |
| کلید منو | **`admin.menu.activity`** (جدید، `D.admin`) ⇒ کاتالوگ **۱۶۶** کلید / ۱۶ گروه |
| کلید محتوا | همان `users.activity.view` (سرور روی `/api/activity` اعمال می‌کند) |
| فایل‌ها | `Frontend/src/features/activity-log/{activity-log.view,activity-log.renderer,activity-log.manager}.js` + `activity-log.css` |
| سیم‌کشی | `admin-panel.service.js`: `menuPermissions` + `case "activity-log"` + `initActivityLogManager()` (import داینامیک) |
| گارد | `Frontend/activity-panel-guard-test.mjs` — `npm run test:activity:panel` (**۶۸ بررسی**) |
| گیت | `test:activity:panel` در هر دو runner ⇒ **۳۷ ⇒ ۳۸ گام** |
| ضد شکنندگی | عدد کاتالوگ دیگر در سه فایل تکرار نمی‌شود؛ `declared === catalog.TOTAL_PERMISSIONS` |

📄 جزئیات کامل: [`REVIEW-WAVE-12.3.md`](./REVIEW-WAVE-12.3.md)


## ۱۱) زیرفاز ۱۲.۴.۱ — دیالوگ «تاریخچهٔ رکورد» (ردّ فعالیت در بستر)

> شناسهٔ فنی زیرفاز: `12.4.1` (اولین بخش از موج ۱۲.۴) و `12.4.2` (بستن دو محدودیت آن)

خلاصهٔ یک‌خطی: تاریخچه از «یک منو در پنل» به **دیالوگ مشترک روی خودِ رکورد** رسید —
دکمهٔ «تاریخچه» در ردیف هر کاربر/مدیر اصلی و دکمهٔ «تاریخچهٔ تغییرات» در هدر پروندهٔ مشتری.

| مورد | مقدار |
|---|---|
| جای UI | دیالوگ سراسری در `document.body` (بدون صفحه/روت جدید) |
| تب‌ها | «تغییرات این رکورد» (`entity` + `entityId`) · «فعالیت‌های این کاربر» (`userId`، شامل ورود/خروج) |
| فایل‌ها | `Frontend/src/features/activity-log/{activity-log.view,activity-log.renderer,activity-log.manager}.js` + **`activity-log.history.js`** + **`activity-log.history.css`** |
| نقاط ورود | `admin-panel.renderer.js` (هر دو جدول) · `customer-info.html` (`#customerHistoryBtn`) |
| پل به بخش ۱۲.۳ | داخل پنل: صف مدیر (`queueHistory` + `applyPendingHistory`) · بیرون پنل: `sessionStorage` (`skb_activity_history`) |
| کلید محتوا | همان `users.activity.view` (fail-open اگر دادهٔ مجوز نرسیده باشد) |
| گارد | `Frontend/activity-history-guard-test.mjs` — `npm run test:activity:history` (**۶۸ بررسی**) |
| گیت | `test:activity:history` در هر دو runner ⇒ **۳۸ ⇒ ۳۹ گام** |
| محدودیت آگاهانه | رویدادهای ایجاد کاربر `entity_id` نداشتند ⇒ ✅ در **۱۲.۴.۲** رفع شد |

📄 جزئیات کامل: [`REVIEW-WAVE-12.4.md`](./REVIEW-WAVE-12.4.md)

## ۱۱.۲) زیرفاز ۱۲.۴.۲ — شناسهٔ رکورد از بدنهٔ پاسخ + تقویم شمسی فیلتر تاریخ

> دو محدودیتِ باقی‌ماندهٔ ۱۲.۴.۱ در همین زیرفاز بسته شد (گیت همان **۳۹ گام** می‌ماند:
> بررسی‌ها داخل گاردهای موجود اضافه شدند، نه گام تازه).

| مورد | مقدار |
|---|---|
| رکورد تازه‌ساخته‌شده | `entityIdFromPayload(body)` در `Backend/services/activityRules.js` + `entityIdHint` در `buildEntry`؛ میدل‌ور `activityLog.js` پاسخ `res.json` را برای هر درخواست تغییردهنده می‌بیند و اولین شناسهٔ معتبر را برمی‌دارد |
| قاعدهٔ امنیتی | allowlist کلید (`id`/`entity_id`/`user_id`/`customer_id`/`hall_id`/`flock_id` + درونیِ `user/customer/hall/flock/unit`) · فقط عدد صحیح مثبت یا UUID · **اولویت با شناسهٔ URL** · ورود/خروج مستثنی |
| تاریخ شمسی | `core/utils/date.utils.js`: الگوریتم دقیق جلالی (`jalaliToGregorian`/`isLeapJalaliYear`/`jalaliMonthLength`) — fallback تقریبیِ `year - 621` **حذف شد**؛ تاریخ ناموجود ⇒ `null` |
| تقویم پنل | `setupDatepickers()` (fail-soft اگر `$.fn.persianDatepicker` نبود · idempotent با `data-datepicker-initialized`) + `persianDateFilterToIso` در `readFilters` + نمایش شمسی در `syncFilterInputs` |
| صفحه | `admin-panel.html`: `persian-date` و `persian-datepicker` (js + css) بعد از jQuery و با ترتیب درست |
| اعتبارسنجی | `validateFilters` فقط ISO میلادی را می‌پذیرد ⇒ پیام فارسی روشن به‌جای بازهٔ خالیِ بی‌توضیح |
| ⭐ باگ کشف‌شده | fallback قبلی (`new Date(year - 621, …)`) تاریخ را با **سال ۷۸۴** ذخیره می‌کرد (مثل `slaughter_date: "784-03-25"`) ⇒ دو اسنپ‌شات گیت (`test:hatchery:body`, `test:dashboard:bookmarks:body`) بازتولید و انکر بوکمارک اصلاح شد |
| گاردها | `test:activity:panel` **۶۸ ⇒ ۸۲** (۱۴ بررسی تازه) · `test:activity:e2e` **۲۶ ⇒ ۳۴** (۸ بررسی تازه) · `test:activity` بدون تغییر (**۷۱**) |
| باقی‌مانده | ستون `customer_id` (انتساب سالن/گله به مشتری) ⇒ موج ۱۲.۵ · deep-link برای موجودیت‌های بیشتر |

## ۱۲) زیرفاز ۱۲.۵ — «همهٔ تغییرات این مشتری» (ستون `customer_id`)

> زیرفاز مکمل ۱۲.۴: قفلِ «یک رکورد / یک کاربر» را باز می‌کند و دو تب دیالوگ را
> به **سه تب** می‌رساند.

خلاصهٔ یک‌خطی: هر ردیف ردّ فعالیت حالا می‌تواند به **مشتریِ مالکش** وصل شود، پس
«این مشتری در کل پرونده‌اش چه تغییراتی داشته؟» (سالن‌ها + گله‌ها + هفته‌نامه + بازدیدها)
با یک کلیک از هر رکورد پاسخ می‌گیرد.

| مورد | مقدار |
|---|---|
| ستون | `activity_logs.customer_id` (`INTEGER`, nullable, **بدون FK** — تاریخچه باید از حذف مشتری جان سالم ببرد) · ایندکس `activity_logs_customer` روی `(customer_id, created_at)` |
| مایگریشن | `20261005000000-add-activity-logs-customer-id.js` — idempotent (`describeTable`/`showIndex`)؛ `db:verify` ستون و ایندکس را می‌سنجد |
| ثبت در مسیر پاسخ | `rules.customerIdFromRequest` — اولویت: بدنه ← پارامتر ← کوئری ← **بدنهٔ پاسخ**؛ خودانتسابی `entity=customers ⇒ customer_id = entity_id` · صفر کوئری اضافه |
| استنتاج در flush | `Backend/services/activityCustomerResolver.js` — ۱۱ منبع (۷ مستقیم + ۴ با `INNER JOIN halls`)؛ یک کوئری به‌ازای هر جدول، سقف ۱۰۰ شناسه، خطا ⇒ خاموشی موقت ۱۰ دقیقه‌ای همان منبع (`ACTIVITY_RESOLVE_CUSTOMER=false` کل قابلیت را خاموش می‌کند) |
| API | `GET /api/activity?customer_id=۱۲` (مقدار نامعتبر ⇒ نادیده، بدون ۵۰۰) |
| فرانت | فیلتر «شناسهٔ مشتری» (`#alpCustomerId`) · `HISTORY_MODES.customer` · `defaultMode` روی پروندهٔ مشتری · نشان `مشتری #N` در جدول/دیالوگ/مودال · `window.showEntityHistory(entity, entityId, title, customerId)` |
| گارد ضد باگ | `toIdInt` سخت‌گیر (اعشار/کاما/منفی ⇒ خطا، نه فیلتر بی‌صدا) · تب بدون فیلتر ⇒ هیچ درخواستی (جلوگیری از نمایش کل تاریخچهٔ سیستم) |
| گاردها | `test:activity:panel` **۹۷** · `test:activity:history` **۸۵** · `test:activity:e2e` **۳۴ ⇒ ۴۸** · `test:activity` بدون تغییر (**۷۱**) |
| ⭐ باگ کشف‌شده | `toInt` مقدار `1.5` را به `1` می‌بُرید ⇒ فیلتر روی مشتری اشتباه · زمینهٔ «فقط مشتری» تب «تغییرات» را بی‌فیلتر می‌کرد |
| باقی‌مانده | `backfill` گذشته‌نگر ستون (اسکریپت یک‌بارمصرف خارج از مسیر درخواست) · تب مستقل «واحد/گله» |

📄 جزئیات کامل: [`REVIEW-WAVE-12.5.md`](./REVIEW-WAVE-12.5.md)



