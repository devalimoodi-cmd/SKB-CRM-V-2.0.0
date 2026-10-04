# گزارش موج ۱۲ — «حضور کاربران، نشست‌ها و ردّ فعالیت»

> برنچ: `chore/wave-12-presence` · زیرفاز انجام‌شده: **۱۲.۰ (Presence)**
> زیرفازهای بعدی: ۱۲.۱ `user_sessions` · ۱۲.۲ `activity_logs` · ۱۲.۳ پنل مدیریت «فعالیت کاربران»

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
2. **۱۲.۲ `activity_logs`:** ردّ فعالیت سراسری (چه کسی، چه زمانی، کدام رکورد) + میدل‌ور ثبت + سیاست نگهداری.
3. **۱۲.۳ پنل مدیریت:** منوی «فعالیت کاربران» با ۳ تب (آنلاین‌ها / نشست‌ها / ردّ فعالیت)،
   Polling ۱۵ ثانیه‌ای و خروجی CSV.

### بدهی فنی که این فاز کشف کرد (برای ۱۲.۳)
رویدادهای `auth:login` / `auth:logout` **هیچ‌جا `dispatchEvent` نمی‌شوند**؛ پس شنونده‌های موجود در
`app.service.js` و `messages.service.js` (مثل توقف Polling پیام‌ها هنگام خروج) **کد مرده** هستند.
به‌جای تکیه بر آن‌ها، اتصال حضور در این فاز **مستقیم** (auth.service/app.service) انجام شد؛
زنده‌کردن آن رویدادها کار مستقلی است و در ۱۲.۳ بررسی می‌شود.

