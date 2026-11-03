# گزارش موج ۱۲.۳ — پنل «فعالیت کاربران» (UI ردّ فعالیت)

## ۱) ریشهٔ مشکل (چرا این زیرفاز لازم بود)

زیرفاز ۱۲.۲ جدول `activity_logs` و سه اندپوینت `/api/activity*` را ساخت، ولی **هیچ UIای نداشت**.
نتیجه: سؤال اصلی که همان موج برایش شروع شده بود — «چه کسی این رکورد را عوض کرد؟» — عملاً
پاسخ نداشت؛ فقط با `curl` و توکن مدیر می‌شد دید. دادهٔ حسابرسی بدون نمای خواندن، ارزش عملی ندارد.

## ۲) چه ساخته شد

| قابلیت | جزئیات |
|---|---|
| فهرست | جدول زمان/کاربر/عمل/موجودیت/متد/وضعیت/خلاصه/رکورد — زمانِ دقیق + «X دقیقه پیش» |
| فیلترها | نوع عمل · وضعیت (موفق/ناموفق) · شناسهٔ کاربر · موجودیت · شناسهٔ موجودیت · بازهٔ تاریخ |
| صفحه‌بندی | ۲۵/۵۰/۱۰۰ ردیف (سقف سرور ۱۰۰) + نمایش «صفحهٔ X از Y · N ردیف» |
| خلاصه | چهار کارت: کل/موفق/ناموفق/کاربران یکتا + پنجرهٔ نگهداشت + زمان محاسبه |
| جزئیات | مودال هر رویداد: کد وضعیت، مدت پاسخ، مسیر، `route`، آی‌پی، user-agent، فیلدهای تغییرکرده |
| خروجی | CSV سمت کلاینت با **BOM** (`\uFEFF`) — فارسی در اکسل درست باز می‌شود |
| لینک رکورد | فقط برای موجودیت‌هایی که صفحهٔ مقصد دارند (فعلاً `customers`) و **با مجوز مقصد** |
| شفافیت | نشان‌دادن `where_keys` سرور: مدیر می‌بیند سرور کدام فیلترها را واقعاً اعمال کرده است |

## ۳) تغییرات (فایل‌به‌فایل)

### بک‌اند
- `Backend/config/permissions.js` — کلید جدید **`admin.menu.activity`** («منوی فعالیت کاربران»، `D.admin`) در `ADMIN_MENUS`.
  ⚠️ کلید **محتوا** همان `users.activity.view` است (سرور روی `/api/activity` enforce می‌کند)؛ این دو عمداً جدا هستند
  (همان قاعدهٔ گروه ۱۶ کاتالوگ: بستن یک جدول نباید کل منو را ناپدید کند).
- `Backend/permissions-test.mjs` — تعداد کلیدها ۱۶۵ ⇒ **۱۶۶** + بررسی پیش‌فرض‌های `admin.menu.activity`.

### فرانت‌اند
- `Frontend/src/pages/admin-panel.html` — آیتم سایدبار `data-menu="activity-log"` + `data-permission="admin.menu.activity"`،
  سکشن `#activity-log` با کانتینر `#activityLogContainer` و لینک CSS بخش.
- `Frontend/src/features/activity-log/activity-log.view.js` — منطق خالص: `buildQuery` (⭐ `success=false` boolean می‌ماند)،
  `validateFilters`، `activeFilterCount`، `timeAgo` فارسی، `actorLabel`، `fieldsChips`، `buildActionOptions`،
  `buildCsv` (BOM + escape)، `deepLinkFor` (allowlist + مجوز).
- `Frontend/src/features/activity-log/activity-log.renderer.js` — ساخت HTML با `escapeHtml` روی **هر** مقدار سرور.
- `Frontend/src/features/activity-log/activity-log.manager.js` — `init/refresh/loadList/loadSummary/applyFilters/resetFilters/
  goToPage/exportCsv/openDetail/closeDetail/openEntityHistory`؛ لودر سیستمی با fallback؛ **بدون polling**.
- `Frontend/src/features/activity-log/activity-log.css` — فقط کلاس‌های `alp-*` (چیزهای موجود در `admin-panel.css` تکرار نشده).
- `Frontend/src/features/admin-panel/admin-panel.service.js` — `"activity-log": "admin.menu.activity"` در `menuPermissions`،
  `case "activity-log"` و `initActivityLogManager()` با `import()` داینامیک (هم‌الگوی `whats-new`).

### تست و گیت
- `Frontend/activity-panel-guard-test.mjs` (جدید) — `npm run test:activity:panel` (**۶۸ بررسی**).
- `tools/gate.mjs` + `tools/gate.ps1` — گام `test:activity:panel` بعد از `test:activity` (**۳۷ ⇒ ۳۸ گام**).
- `Frontend/package.json` — اسکریپت `test:activity:panel`.

## ۴) تصمیم‌های فنی (چرا این‌طور، نه آن‌طور)

1. **سکشن داخل پنل ادمین، نه صفحهٔ جدید** — صفحهٔ جدید نیازمند روت در `Frontend/server.js` و لیست `LOADER_PAGES`
   و مسیر مستقل مجوز بود؛ سکشن، هم سایدبار و هم گیت مجوز موجود را رایگان می‌دهد و تجربهٔ مدیر یک‌جا می‌ماند.
2. **CSV سمت کلاینت** — اندپوینت جدید لازم نیست، سرور بار اضافه نمی‌گیرد و خروجی همان چیزی است که مدیر می‌بیند.
   محدودیت آگاهانه: فعلاً فقط ردیف‌های صفحهٔ جاری. (خروجی کل بازه ⇒ ۱۲.۴)
3. **لینک رکورد = allowlist + مجوز** — «لینک مرده» بدترین حالت است (مدیر روی رکورد کلیک می‌کند و ۴۰۴/۴۰۳ می‌گیرد).
   پس فقط موجودیت‌هایی که صفحهٔ مقصد واقعی دارند لینک می‌گیرند و همان لحظه با `permissionService.can` سنجیده می‌شوند.
4. **حذف شکنندگی عدد کاتالوگ** — تا امروز عدد ۱۶۵ در سه فایل تکرار می‌شد و هر موج باید هر سه را bump می‌کرد
   (یک بار در ۱۲.۲ جا ماند). حالا:
   `session-guard-test` و `activity-guard-test` عددِ اعلام‌شده در `permissions-test` را با خودِ کاتالوگ مقایسه می‌کنند
   (`declared === catalog.TOTAL_PERMISSIONS`) و «تعداد = طول فهرست کلیدها» هم assert می‌شود.

## ۵) تست‌ها

| تست | دستور | تعداد |
|---|---|---|
| گارد پنل (جدید) | `npm run test:activity:panel` | **۶۸ بررسی** |
| گارد بک‌اند ۱۲.۲ (رگرسیون) | `npm run test:activity` | ۷۱ بررسی |
| تست دیتابیسی | `$env:ALLOW_DB_TESTS='true'; npm run test:activity:e2e` | ۲۳ بررسی |
| گیت کامل | `node tools/gate.mjs` | **۳۸ گام** |

گارد جدید چه چیزی را قفل می‌کند؟
- `buildQuery`: `success=false` به‌صورت boolean می‌رود (با `if (success)` بی‌سرصدا حذف می‌شد).
- CSV: BOM + escape ویرگول/گیومه + نبود `undefined/null`.
- رندرر: خنثی‌سازی HTML تزریقی (`<img onerror>` / `<script>`)، حالت خالی، صفحه‌بندی، خلاصه، مودال.
- ⭐ نبودِ `session_id` در هیچ فایل UI و در مودال جزئیات.
- سیم‌کشی: `data-permission="admin.menu.activity"`، سکشن واقعی، `case "activity-log"`، لود داینامیک،
  توقف polling نظرات، نبود `setInterval` در مدیر.

## ۶) اعتبارسنجی (اندازه‌گیری‌شده)

- `npm run lint` ⇒ **۰ خطا**
- `npm run test:activity:panel` ⇒ ۶۸/۶۸
- `npm run test:activity` ⇒ ۷۱/۷۱ · `npm run test:sessions` ⇒ ۳۹/۳۹ · `npm run test:permissions` ⇒ سبز
- `audit:size` / `audit:big-methods` / `audit:surface` ⇒ بدون تخلف جدید
- `node tools/gate.mjs` ⇒ **GATE-PASS steps=38**

## ۷) بدهی فنی و ادامه در ۱۲.۴

1. **تب «تاریخچه» در دیالوگ کاربر/رکورد** — نقطهٔ ورود آماده است: `activityLogManager.openEntityHistory(entity, entityId)`
   فیلترها را ست و فهرست را بارگذاری می‌کند؛ فقط UI تب باقی مانده.
2. **بازهٔ تاریخ شمسی** — فعلاً `<input type="date">` میلادی است (سرور `from/to` را میلادی می‌فهمد)؛
   انتخابگر شمسی (persian-datepicker موجود در پروژه) در ۱۲.۴.
3. **خروجی CSV کل بازه** — نیازمند پیمایش صفحه‌به‌صفحه یا اندپوینت استریم سمت سرور.
4. **deep-link بیشتر** — به‌ازای هر موجودیت، مسیر مقصد + کلید مجوزش به `DEEP_LINK_RULES` اضافه شود.
