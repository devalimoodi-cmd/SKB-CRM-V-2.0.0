# گزارش زیرفاز ۱۲.۲ — «ردّ فعالیت» (`activity_logs`)

> برنچ: `chore/wave-12.2-activity-log` · وضعیت: **انجام‌شده** · پیش‌نیاز: ۱۲.۰/۱۲.۱
> زیرفاز بعدی: ۱۲.۳ پنل «فعالیت کاربران» (UI) — در این فاز عمداً هیچ UIای ساخته نشد.

## ۱) خلأی که این فاز پر می‌کند

پیش از این، پاسخِ «**چه کسی این رکورد را عوض کرد؟**» وجود نداشت:

| شاهد | محدودیت |
|---|---|
| `customers.created_by` / `updated_by` | فقط آخرین نویسنده؛ با ویرایش بعدی **بازنویسی** می‌شود |
| حذف رکورد | با حذف رکورد، **همهٔ** شواهد پاک می‌شود |
| `permission_audit_logs` | فقط تغییرات مجوزها |
| `user_sessions` | فقط «کجا وارد شده‌ام»، نه «چه چیزی عوض شد» |
| لاگ کنسول | نه قابل جست‌وجو، نه قابل نگهداشت، نه فارسی |

⇒ برای «چه کسی کاربر X را حذف کرد؟» یا «چه کسی این مشتری را ویرایش کرد؟» هیچ مرجعی نبود.

## ۲) راه‌حل در یک نگاه

```
هر درخواست POST/PUT/PATCH/DELETE (+ login/logout)
        │
        ▼
middleware/activityLog.js  ← روی res.on("finish")
        │  (بدون await؛ پاسخ کاربر منتظر لاگ نمی‌ماند)
        ▼
services/activityRules.js ← منطق خالص: باید ثبت شود؟ کدام عمل؟ ماسک رمز؟ شرح فارسی
        │
        ▼
services/activityService.js ← بافر حافظه + INSERT دسته‌ای (bulkCreate)
        │
        ▼
activity_logs  ← «چه کسی، چه زمانی، کدام موجودیت، موفق یا ناموفق»
        │
        ▼
GET /api/activity · /api/activity/summary · /api/activity/:id   (کلید users.activity.view)
```

### ۲.۱) چرا میدل‌ور سراسری، نه فراخوانی در هر کنترلر؟
- **پوشش کامل:** ۶۰+ کنترلر نیاز به تغییر نداشتند؛ هر مسیر تازه هم خودکار پوشش می‌گیرد.
- **ناوابسته به رشتهٔ موفقیت:** حتی خطای ۴۰۰/۴۰۱/۴۰۳ هم ثبت می‌شود (تلاش ناموفق هم شاهد است).
- **بدون دست‌کاری کد موجود:** هیچ کنترلری برای لاگ‌کردن تغییر نکرد ⇒ ریسک رگرسیون صفر.

### ۲.۲) سه مرزِ امنیتی/کارایی که رعایت شد
1. **رمز هرگز ذخیره نمی‌شود:** فیلدهای حساس (`password`, `token`, `captcha`, …) همیشه `***` می‌شوند،
   حتی وقتی `ACTIVITY_LOG_VALUES=true` باشد. پیش‌فرض `false` است ⇒ فقط **نام** فیلدها ذخیره می‌شود.
2. **پاسخ کاربر معطل نمی‌شود:** نوشتن روی `res.on("finish")` + بافر + `bulkCreate` دسته‌ای
   (`ACTIVITY_FLUSH_MS`, پیش‌فرض ۷۰۰ms). هیچ `await`ی در مسیر پاسخ نیست.
3. **ضد حلقه/ضد نویز:** `GET`ها پیش‌فرض ثبت نمی‌شوند، خودِ `/api/activity` و
   `presence/heartbeat|offline` در skip list هستند (وگرنه هر مشاهدهٔ لاگ، لاگ تازه می‌ساخت).

## ۳) تغییرات (فایل‌به‌فایل)

### بک‌اند
| فایل | تغییر |
|---|---|
| `migrations/20261004020000-create-activity-logs.js` | جدول `activity_logs` + ۴ ایندکس (`user_id+created_at` · `entity` · `created_at` · `action`) — **idempotent** (`showAllTables`/`showIndex`) · **بدون FK** (تاریخچه بعد از حذف کاربر می‌ماند) · `down` دارد |
| `models/ActivityLog.js` | مدل (`timestamps + underscored`) — بدون تعریف ایندکس (منبع حقیقت = مایگریشن) |
| `models/associations.js` | `User.hasMany(ActivityLog, { constraints:false })` + `belongsTo` — دقیقاً الگوی `PermissionAuditLog`/`UserSession` |
| `services/activityRules.js` (جدید) | **منطق خالص و بدون وابستگی:** `shouldRecord` · `isMutation` · `isAuthEvent` · `parsePath` · `buildDetails` (ماسک) · `buildEntry` · `buildItem` · `buildSummary` · `config/status` |
| `services/activityService.js` (جدید) | `record` (بافر، fire-and-forget) · `flush/flushNow` (`bulkCreate`) · `list` · `getById` · `summary` · `between` · `purgeExpired` · `startHousekeeping/stopHousekeeping` · `status` · `resetForTests` |
| `middleware/activityLog.js` (جدید) | ثبت روی `res.on("finish")` + `shouldSkip` + نام تلاش‌شدهٔ ورود ناموفق + مدت پردازش (`hrtime`) |
| `controllers/activityController.js` (جدید) | `GET /` (فیلترها + صفحه‌بندی) · `GET /summary` · `GET /:id` |
| `routes/activityRoutes.js` (جدید) | `protect` + `authorize(...ADMIN_ROLES)` + `requirePermission("users.activity.view")` |
| `server.js` | `app.use("/api", activityLog)` (پس از rate-limit، پیش از مسیرها) · mount مسیرها · `activity_logs` در `CRITICAL_TABLES` · `startHousekeeping()` در `listen` |
| `config/permissions.js` | کلید جدید `users.activity.view` (پیش‌فرض ادمین‌ها · **بدون قفل**) ⇒ کاتالوگ ۱۶۴ → **۱۶۵** کلید (گروه‌ها همان ۱۶) |
| `permissions-test.mjs` | انتظار تعداد کلیدها ۱۶۴ → ۱۶۵ |
| `scripts/verify-db.js` | جدول/ستون‌ها/۴ ایندکس/شمارندهٔ `activity_logs` |
| `.env.example` | ۸ متغیر `ACTIVITY_*` |

### فرانت‌اند (زیرساخت، بدون UI)
| فایل | تغییر |
|---|---|
| `core/constants/api.const.js` | بلوک `ACTIVITY: { LIST, SUMMARY, DETAIL }` |
| `core/services/activity.service.js` (جدید) | سرویس نازک روی `apiService` با `list/summary/getById` — آمادهٔ ۱۲.۳ |

### گیت و مستندات
| فایل | تغییر |
|---|---|
| `Frontend/activity-guard-test.mjs` (جدید) | گارد ۷۱ بررسی (پایین) |
| `Frontend/package.json` | `test:activity` |
| `tools/gate.mjs` · `tools/gate.ps1` | گام `test:activity` پس از `test:sessions` |
| `Backend/activity-e2e-test.mjs` (جدید) | تست دیتابیسی دستی (`npm run test:activity:e2e`) — ۲۰ بررسی |
| `docs/REVIEW-WAVE-12.md` · `docs/REVIEW-WAVE-12.2.md` | به‌روزرسانی وضعیت موج |
| `Frontend/session-guard-test.mjs` | هم‌ترازی دو فرضِ شکننده با واقعیت ۱۲.۲ (تعداد کلید مجوز ۱۶۴→۱۶۵ · ترتیب جدول‌ها در `db:verify`) — §۵.۴ |
| `.gitignore` | `.slices/` + حذف پوشهٔ موقت `Backend/.slices` از مخزن |

### یک اصلاح جانبی (هم‌راستا با «هم‌خوانی دیکشنری»)
`customer-list.renderer.js`: گزینهٔ «بازاریابی و فروش» در «نحوهٔ آشنایی» جا افتاده بود
(در فرم `basic-info` و HTML بود، در فرم ویرایش لیست مشتری نبود) ⇒ اضافه شد.

## ۴) چهار تصمیم کلیدی

1. **جدول مستقل، بدون FK:** مثل `permission_audit_logs`/`user_sessions` — ردیف لاگ باید بعد از حذف کاربر/رکورد
   باقی بماند؛ به‌جای JOIN، `username`/`role` در لحظهٔ رویداد «عکس» گرفته می‌شود.
2. **`session_id` ستون داخلی است:** برای همبستگی با `user_sessions` ذخیره می‌شود ولی
   `buildItem` آن را **هرگز** در API بیرون نمی‌دهد (تست گارد و e2e هر دو تضمین می‌کنند).
3. **یک ردیف = یک تلاش، نه یک موفقیت:** خطاها هم ثبت می‌شوند (`success=false`, `status_code`)
   ⇒ «چه کسی تلاش کرد رمز کاربر را عوض کند و نشد؟» هم پاسخ دارد.
4. **پیش‌فرض حریم‌خصوصی‌محور:** `ACTIVITY_LOG_VALUES=false` (فقط نام فیلدها) و
   `ACTIVITY_LOG_READS=false` (فقط نوشتن‌ها) — روشن‌کردن هر دو آگاهانه و مستند است.

## ۵) تست و اعتبارسنجی

### ۵.۱) گارد فرانت‌اند — `npm run test:activity` (**۷۱ بررسی**)
`Frontend/activity-guard-test.mjs` بدون نیاز به سرور/دیتابیس اجرا می‌شود و این لایه‌ها را می‌سنجد:

| گروه | نمونهٔ بررسی |
|---|---|
| قواعد خالص (`activityRules`) | `shouldRecord` برای متدها · `isAuthEvent` · `parsePath` (query/id) · `buildDetails` (ماسک رمز/توکن) · `buildEntry` · `buildItem` (بدون `session_id`) · `buildSummary` · `actorFromPayload` |
| مدل و مایگریشن | نام جدول/ستون‌ها · ۴ ایندکس · نبود FK · وجود `down` · `timestamps/underscored` |
| میدل‌ور | `res.on("finish")` · بدون `await`/`async` · skip list · نام تلاش‌شدهٔ ورود ناموفق · `req.user || capturedActor` |
| سرویس | بافر و `bulkCreate` · fail-open (هرگز throw) · backoff `42P01` · `purgeExpired` با `Op.lt` · `startHousekeeping` |
| کنترلر/روت | `parsePagination` · `rules.buildItem` · `protect` + `authorize` + `requirePermission` |
| مجوزها | وجود `users.activity.view` در کاتالوگ · تعداد ۱۶۵ کلید · ۱۶ گروه |
| فرانت سرویس | `ENDPOINTS.ACTIVITY` · متدهای `list/summary/getById` روی `apiService` |
| گیت | `test:activity` در `package.json` و در هر دو گام `tools/gate.mjs`/`gate.ps1` |

### ۵.۲) تست دیتابیسی — `npm run test:activity:e2e` (**۲۰ بررسی**)
`Backend/activity-e2e-test.mjs` سرور را روی پورت ۵۰۹۷ بالا می‌آورد، دو کاربر موقت می‌سازد و
«معیار اثبات کار» را می‌سنجد: یک تغییر واقعی ⇒ یک ردیف واقعی.

1. ورود ناموفق ۴۰۱ · 2. ورود موفق · 3. نوشتنِ نامعتبر ۴۰۰ · 4. ورود کارشناس
5. ردیف `login` موفق (آی‌پی/مرورگر/نقش) · 6. ردیف `login` ناموفق (نام تلاش‌شده، `user_id` تهی)
7. ⭐ رمز در `fields` نیست (`***`) · 8. تلاش ناموفق `POST` با `success=false`
9. ⭐ فهرست API + `config` + **زمان واقعی (`at`/`seconds_ago`)** · 10. فیلتر `action` · 11. فیلتر `success=false` · 12. فیلتر `user_id`
13. خلاصهٔ آماری · 14. ⭐ جزئیات + نبودِ `session_id` در پاسخ · 15. بدون توکن ۴۰۱ · 16. نقش `expert` ⇒ ۴۰۳
17. ⭐ ضد حلقه (`/api/activity` ثبت نمی‌شود) · 18. ضد نویز (heartbeat) · 19. ⭐ نگهداشت (حذف قدیمی‌تر از retention) · 20. ⭐ خروج ⇒ ردیف `logout`

### ۵.۳) خروجی اجرا (شواهد این فاز)
| دستور | نتیجه |
|---|---|
| `node activity-guard-test.mjs` (Frontend) | ✅ `ACTIVITY-GUARD-PASS — 71/71` |
| `ALLOW_DB_TESTS=true node activity-e2e-test.mjs` (Backend) | ✅ `ACTIVITY-E2E-PASS — 20/20` |
| `node permissions-test.mjs` | ✅ ALL PASS (کاتالوگ ۱۶۵ کلید) |
| `node scripts/verify-db.js` | ✅ ALL PASS (۴۴ جدول کلیدی · `activity_logs` موجود) |
| `npx eslint` روی ۹ فایل تغییرکردهٔ بک‌اند | ✅ ۰ خطا |
| `npm run audit:surface` (+ `--snapshot` بازتولید شد) | ✅ ۰ عضو گم‌شده · ۶۰ فایل سرویس |
| `npm run audit:dead-exports` | ℹ️ فقط «فایل بی‌ارجاع» — همان دستهٔ `session.service.js` (۱۲.۱) |
| `node session-guard-test.mjs` (گارد ۱۲.۱، پس از هم‌ترازی) | ✅ `ALL PASS — 39` |
| `node tools/gate.mjs` (کل گیت، ۳۷ گام) | ✅ `GATE-PASS` |

### ۵.۴) دو هم‌ترازی لازم در گاردِ فاز ۱۲.۱ (کشف‌شده توسط گیت کامل)
گارد ۱۲.۱ دو فرضِ شکننده داشت که با آمدن ۱۲.۲ شکست — هر دو **در تست** اصلاح شد، نه با عقب‌نشینی از کد:

| بررسی | فرض قدیم | اصلاح |
|---|---|---|
| `db:verify` جدول `user_sessions` را می‌شناسد | `"user_sessions"` باید **بی‌درنگ** پیش از `"SequelizeMeta"` بیاید ⇒ با اضافه‌شدن `activity_logs` بین آن‌ها شکست | به «حضور در آرایه» تغییر کرد (هر موج جدول‌هایش را به همان آرایه اضافه می‌کند) |
| کاتالوگ مجوزها (`permissions-test`) | عدد ثابت `TOTAL_PERMISSIONS === 164` | به `165` به‌روز شد (عدد با هر موج رشد می‌کند؛ منبع حقیقت همان تست است) |

### ۵.۵) سه باگ واقعی که همین تست دیتابیسی گرفت
تست گارد (بدون دیتابیس) هر سه را سبز می‌دید؛ فقط اجرای واقعی روی PG لو داد:

1. **ورود موفق با `action="create"` ثبت می‌شد** — `buildEntry` رویداد ورود را از مسیر حساب نمی‌کرد و
   به `authEvent` پاس‌شده تکیه داشت ⇒ حالا خودش `isAuthEvent(path)` را می‌گیرد (یک منبع حقیقت).
2. **ردیف ورود موفق `user_id`/`role` تهی داشت** — روت ورود عمومی است و `req.user` خالی می‌ماند
   ⇒ `actorFromPayload` + قلاب `res.json` بازیگر را از بدنهٔ پاسخ می‌خواند (توکن هرگز برداشته نمی‌شود).
3. **`at`/`seconds_ago` در API تهی بود** — نمونهٔ Sequelize کلید `createdAt` می‌دهد نه `created_at`
   ⇒ `buildItem` هر دو شکل را می‌خواند و e2e هم اکنون «زمان واقعی» را assert می‌کند.

## ۶) محدودیت‌های آگاهانه

- **هیچ UIای** ساخته نشد (کار ۱۲.۳)؛ فقط سرویس و مسیرهای خواندن.
- `ACTIVITY_LOG_VALUES=false` پیش‌فرض است ⇒ در تولید فقط **نام** فیلدها ذخیره می‌شود.
- `ACTIVITY_LOG_READS=false` پیش‌فرض است ⇒ `GET`ها ثبت نمی‌شوند (ضد نویز و ضد حجم).
- نوشتن **fail-open** است: اگر دیتابیس در دسترس نباشد، ردیف‌های بافر از دست می‌روند
  (عمدی — پاسخ کاربر هرگز به‌خاطر لاگ خراب/کند نمی‌شود). با قطعی کوتاه، `42P01` هم backoff دارد.
- بدون FK ⇒ اگر رکورد هدف حذف شود، ردیف لاگ می‌ماند و `entity_id` فقط یک اشاره است (نه JOIN).
- زمان‌بند نگهداشت درون‌فرایندی است (`ACTIVITY_PURGE_INTERVAL_HOURS`)؛ اگر چند نمونه اجرا شود،
  هر نمونه پاک‌سازی خودش را دارد (حذف تکراری بی‌خطر است).

## ۷) گام بعدی — ۱۲.۳ «فعالیت کاربران» (UI)
1. صفحهٔ فهرست با فیلترهای `action`/`success`/`user_id`/`entity`/`entity_id`/بازهٔ زمانی + صفحه‌بندی.
   (سرور از قبل همه را می‌پذیرد و `config` هم برمی‌گرداند.)
2. کارت خلاصه بالای صفحه با `GET /api/activity/summary` (کل/موفق/ناموفق/بازیگران یکتا).
3. لینک هر ردیف به رکورد هدف (`entity` + `entity_id`) با guard مجوز همان ماژول.
4. خروجی CSV (سمت سرور یا کلاینت) + نمایش «X دقیقه پیش» با `seconds_ago`.
5. اتصال به دیالوگ «جزئیات کاربر/رکورد»: تب «تاریخچه» با فیلتر `entity`/`entity_id`.
