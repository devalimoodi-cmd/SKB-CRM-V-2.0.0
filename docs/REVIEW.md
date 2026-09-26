# گزارش بازبینی (Review) — موج ۰ و ۱ پاک‌سازی

برنچ: `chore/wave-0-1-cleanup` — تگ نقطهٔ بازگشت: `pre-wave-0-1` (روی `307188b`)
اصل حاکم بر این موج: **بدون تغییر رفتار** (behavior-preserving). هر تغییری که
کاربر در UI حس می‌کند، در بخش «تغییرات رفتاری آگاهانه» فهرست شده است.

---

## ۱) موج ۰ — چه‌کاری انجام شد؟

### الف) حذف کد مرده (۱۷ فایل)

| فایل/پوشه | چرا مرده بود |
| --- | --- |
| `Frontend/src/features/bookmarks/*` (۷ فایل) | صفحهٔ مستقل بوکمارک وجود ندارد؛ زنجیرهٔ import آن با دو فایل صفر‌بایتی شکسته بود |
| `Frontend/src/shared/layouts/Dashboard/dashboard.service.js` + `dashboard.css` | هر دو صفر‌بایتی؛ import داینامیک آن همیشه در `try/catch` شکست می‌خورد و هیچ صفحه‌ای `.dashboard-layout` نداشت |
| `Frontend/src/features/auth/setup-admin.service.js` | صفر‌بایتی و بی‌ارجاع |
| `Frontend/src/shared/components/ChartCard/chart-card.service.js` | صفر‌بایتی و بی‌ارجاع |
| `Frontend/src/features/customer-info/customer-info.css` | صفر‌بایتی (استایل واقعی در `sections/*` است) |
| `Frontend/src/styles/reset.css` و `variables.css` | صفر‌بایتی؛ از ۱۱ صفحه لینک شده بودند |
| `Frontend/src/styles/pages/*.css` (۳ فایل) | صفر‌بایتی و بی‌ارجاع |
| `frontend/src/features/bookmarks/*.css` | با کل خوشه حذف شد |

لینک‌های `<link>` به فایل‌های صفر‌بایتی از **۱۱ صفحه** (۱۰ صفحهٔ `src/pages` +
`src/features/sms/sms.html`) حذف شد (۲۲ لینک `reset/variables` + ۱ لینک
`customer-info.css`).

### ب) حذف مسیر/صفحهٔ `/bookmarks`

- `Frontend/server.js`: دو روت `/bookmarks` و `/bookmarks.html` و لاگ راه‌اندازی حذف شد.
- `Frontend/src/core/services/app.service.js`: `pageConfigs.bookmarks`، ورودی‌های
  `pageMap` و بلوک import داینامیک Dashboard Layout حذف شد.
- `Frontend/src/shared/layouts/Header/header-bookmarks.service.js`:
  - لینک مردهٔ «مشاهده همه» (که به `/bookmarks` ناموجود می‌رفت) حذف شد.
  - fallback داینامیک به ماژول حذف‌شده با پیام راهنما جایگزین شد.
- ثابت‌های `api.const.js` مربوط به بوکمارک **دست‌نخورده** ماندند (سرویس سالم هدر
  از آن‌ها استفاده می‌کند).

> ✅ نکتهٔ مهم: حتی قبل از این تغییر، روت `/bookmarks` به `pages/bookmarks.html`
> ناموجود اشاره می‌کرد و به لطف wrapper خطای `sendFile` در `server.js` صفحهٔ ۴۰۴
> با کد وضعیت ۴۰۴ نمایش داده می‌شد. پس حذف روت **رفتار یکسانی** دارد.

### ج) یکسان‌سازی پاسخ‌های API (رفع باگ امنیتی)

`Backend/controllers/cityController.js` و `dictionaryController.js` هر یک کپی محلی
`successResponse`/`errorResponse` داشتند که پیام خطای ۵xx را ماسک نمی‌کرد. حالا هر
دو از `Backend/utils/response.js` استفاده می‌کنند ⇒ پیام خطاهای سرور در
`NODE_ENV=production` ماسک می‌شود و جزئیات خطا در سرور لاگ می‌شود.

### د) ابزارهای audit + مستندات

- `Frontend/scripts/audit-size.mjs` / `Backend/scripts/audit-size.js`
- `Frontend/scripts/audit-dead-exports.mjs` / `Backend/scripts/audit-dead-exports.js`
- اسکریپت‌های npm: `audit:size` و `audit:dead-exports` در هر دو پروژه
- `docs/HOTSPOTS.md` و همین فایل

---

## ۲) موج ۱ — استخراج توابع خالص

| ماژول جدید | توابع | مصرف‌کننده |
| --- | --- | --- |
| `Frontend/src/features/customer-info/sections/hatchery/hatchery.slaughter.utils.js` | `formatSlaughterRange`, `slaughterAgeMethodLabel`, `slaughterShipmentsHtml`, `formatAgeRange` | `hatchery.service.js` و `hatchery.report.js` (کپی تکراری حذف شد) |
| `Backend/services/flockCompletionCalc.js` | `calculateSystemData`, `buildHallDetail`, `aggregateHallDetails`, `toIsoDate`, `addDaysToIso`, `ageDaysBetween`, `SLAUGHTER_METHODS`, `computeSlaughterFields` | `flockCompletionController.js` |

تست‌های جدید (خالص، بدون دیتابیس/مرورگر):

- `Frontend/hatchery-slaughter-utils-test.mjs` → `npm run test:hatchery-utils`
- `Backend/flock-completion-calc-test.mjs` → `npm run test:flock-calc`

⚠️ این فایل‌ها عمداً به‌عنوان `<script type="module">` جدا در HTML اضافه نشدند؛
همه از طریق `import` مصرف می‌شوند تا دوباره‌سازی singleton رخ ندهد.

**`dashboardController.js` بررسی شد:** هیچ تابع خالص سطح‌بالایی ندارد (فقط
`require`های مدل و هندلرهای async)، بنابراین در این موج چیزی از آن استخراج نشد.

---

## ۳) تغییرات رفتاری آگاهانه (شفاف)

۱. **حذف لینک «مشاهده همه» در دراپ‌داون بوکمارک هدر** — این لینک به صفحهٔ ناموجود
   می‌رفت؛ حالا که روت حذف شده، بلوک آن هم حذف شد.
۲. **پیام راهنمای افزودن بوکمارک در صفحات غیر داشبورد** — دکمهٔ «جدید» در
   دراپ‌داون بوکمارک هدر تا امروز هیچ کاری نمی‌کرد (زنجیرهٔ ماژول شکسته بود)؛
   اکنون `notificationService.info("برای ثبت یا ویرایش بوکمارک، از صفحهٔ داشبورد
   استفاده کنید")` نمایش می‌دهد. روی صفحهٔ داشبورد، `window.showCreateBookmarkModal`
   را سرویس داشبورد ثبت می‌کند و مودال واقعی باز می‌شود.
۳. **روت‌های `/bookmarks`** — حذف شدند؛ نتیجه از نظر کاربر همان صفحهٔ ۴۰۴ است
   (قبلاً هم ۴۰۴ بود، چون فایل صفحه وجود نداشت).
۴. **ماسک‌شدن پیام خطاهای ۵xx** در `cityController` و `dictionaryController` در
   محیط production (بهبود امنیتی، جزئیات خطا فقط در لاگ سرور می‌ماند).

---

## ۴) یافته‌های بازبینی (اولویت‌دار)

### P1 — عملکردی/کاربری

**P1-۱. روت `/sms` و `/sms.html` به فایل ناموجود اشاره می‌کنند**
`Frontend/server.js:676-683` فایل `pages/sms.html` را می‌فرستد، در حالی که این فایل
وجود ندارد (فایل واقعی `src/features/sms/sms.html` است و از مسیر
`/features/sms/sms.html` با static سرو می‌شود). نتیجهٔ فعلی: صفحهٔ ۴۰۴.
`app.service.js:61-62` هم صریحاً نوشته «صفحهٔ مستقل SMS وجود ندارد».
⇒ دو گزینه: (الف) حذف روت‌های `/sms` + کل خوشهٔ `src/features/sms/*` (۱۰ فایل،
بی‌ارجاع در منو)، یا (ب) اتصال روت به همان صفحهٔ موجود. **در این موج دست نخورد
تا تصمیم محصولی گرفته شود.**

**P1-۲. خوشهٔ `src/features/sms/*` بی‌مصرف است**
`sms.html` + `sms.service.js` + `sms.renderer.js` + `sms.modal.service.js` +
`sms.history.modal.js` + `sms.api.js` + ... هیچ لینکی در منو/هدر/صفحات به آن‌ها
وجود ندارد (به‌جز یک import در `hatchery.service.js` برای `sms.history.modal.js`).
`sms.modal.service.js` در audit به‌عنوان فایل بی‌ارجاع گزارش می‌شود.

**P1-۳. مودال «افزودن/ویرایش بوکمارک» از سرصفحه در صفحات غیر داشبورد کار نمی‌کند**
علت: `features/bookmarks/bookmarks.service.js` به دو ماژول صفر‌بایتی import می‌کرد
⇒ کل زنجیره در زمان link شکست می‌خورد و `window.bookmarksModalService` هرگز ثبت
نمی‌شد. در این موج ماژول‌های ناتمام حذف و پیام راهنما گذاشته شد؛ اگر می‌خواهید این
قابلیت واقعاً کار کند، منطق مودالِ داشبورد (`dashboard.service.js`
`showCreateBookmarkModal`) را به یک ماژول مشترک منتقل کنید.

### P2 — باگ‌های منطقی (کشف‌شده هنگام نوشتن تست‌های golden)

**P2-۱. `formatSlaughterRange` وقتی فقط تاریخ پایان ثبت شده باشد**
خروجی می‌شود `" تا ۱۴۰۲/۱۱/۱۹"` (سمت شروع خالی است، چون `convertGregorianToPersian(null)`
رشتهٔ خالی برمی‌گرداند).
پچ پیشنهادی:
```js
if (!start || !end || start === end) return convertToPersianDate(start || end);
```

**P2-۲. `formatAgeRange` برای رکورد قدیمی که فقط سن پایانی دارد**
خروجی می‌شود `"null-25 روز"` (چون `start === null` داخل template string چاپ می‌شود).
پچ پیشنهادی:
```js
if (!hasStart && !hasEnd) return "-";
if (!hasStart) return `${end} روز`;
if (!hasEnd || Number(end) === Number(start)) return `${start} روز`;
return `${start}-${end} روز`;
```

**P2-۳. `convertGregorianToPersian` نسبت به منطقهٔ زمانی حساس است**
`new Date("2024-01-29")` به‌عنوان UTC تفسیر می‌شود و سپس با `Intl` به وقت محلی
فرمت می‌شود؛ در منطقه‌های زمانی با انحراف منفی، احتمال یک روز عقب‌بودن وجود دارد.
پیشنهاد: پارس دستی `YYYY-MM-DD` و ساخت `Date(y, m-1, d)`.

**P2-۴. `aggregateHallDetails([])` مقادیر `-Infinity` برمی‌گرداند**
`Math.max(...[])` برابر `-Infinity` است و چون در حالت truthy است، از fallback عبور
می‌کند: `final_week_number: -Infinity` و `slaughter_age_days: -Infinity`.
پیشنهاد:
```js
const maxWeek = details.length ? Math.max(...details.map((d) => d.final_week_number || 1)) : 1;
const maxAge = details.length ? Math.max(...details.map((d) => d.slaughter_age_days || 0)) : 0;
```
(در مسیرهای فعلی، پیش از فراخوانی همیشه گارد وجود دارد، پس اثر عملی ندارد.)

### P3 — تمیزی و نگه‌داری

**P3-۱. export های بی‌مصرف:** ۷۱ مورد در فرانت (بیشتر در `dom.utils.js`,
`number.utils.js`, `form.utils.js`, `string.utils.js`, `weekly.audit.js`) و ۳۰ مورد در
بک‌اند (`utils/search.js`, `utils/token.js`, `utils/captcha.js`, ...).
فهرست کامل با `npm run audit:dead-exports`.
⚠️ `toIsoDate`/`addDaysToIso`/`ageDaysBetween` در `services/flockCompletionCalc.js`
به‌صورت false-positive گزارش می‌شوند: آن‌ها برای «تست‌پذیری» export شده‌اند و مصرفشان
در `flock-completion-calc-test.mjs` (بیرون از ریشه‌های اسکن) است.

**P3-۲. فایل‌های js بی‌ارجاع در فرانت:** `src/core/types/index.types.js`,
`src/features/sms/sms.modal.service.js`, `src/shared/components/TaskCard/index.js`.

**P3-۳. فایل‌های بزرگ (hotspot):** جزئیات در `docs/HOTSPOTS.md` — بزرگ‌ترین‌ها:
`hatchery.service.js` (۲۰۹KB)، `dashboard.service.js` (۱۵۷KB)،
`weekly.service.js` (۱۱۹KB)، `dictionaryController.js` (۶۴KB).

**P3-۴. بارگذاری Feature با «حدس نام سراسری» شکننده است**
`app.service.js::loadFeature` تا ۱۰ بار با تأخیر ۱۵۰ms دنبال
`window.<feature>Service` می‌گردد و اگر پیدا نکند فقط `console.warn` می‌دهد. با حذف
`pageConfigs.bookmarks` یکی از منابع این هشدارها حذف شد، اما الگو همچنان شکننده است.
پیشنهاد موج بعد: یک رجیستری صریح (`featureName → init()`) به‌جای پروب نام‌ها.

**P3-۵. الگوی مسیرهای CSS/JS در HTML ناهمگون است** (مخلوط `/styles/...` مطلق و
`./../styles/...` نسبی). این باعث شد لینک‌های صفر‌بایتی در دو قالب مختلف باشند؛
پیشنهاد یکسان‌سازی روی مسیر مطلق از ریشهٔ سایت.

---

## ۵) چک‌لیست بازبینی برای PR های این موج

```bash
# Frontend
cd Frontend
npm run lint
npm run test:cache && npm run test:denied && npm run test:toast
npm run test:weekly && npm run test:weekly:report && npm run test:weekly:groups
npm run test:weekly:history && npm run test:customer-fields && npm run test:customer-detail
npm run test:hatchery-utils
npm run audit:size -- --fail-on-empty

# Backend
cd Backend
npm run check && npm run lint
npm run test:security && npm run test:permissions
npm run test:customer-validation && npm run test:flock-calc
npm run audit:size -- --fail-on-empty
```

آزمون دستی دود (smoke): `/` (داشبورد)، `/customer-info`، `/admin`، `/customers`
→ بارگذاری بدون خطای کنسول؛ `/bookmarks` → صفحهٔ ۴۰۴ تمیز (بدون خطای سرور).

---

## ۶) شواهد تأیید نهایی (اجرای واقعی روی همین برنچ)

### الف) دروازه‌های خودکار — همه سبز ✅

| بررسی | نتیجه |
| --- | --- |
| `Frontend` → `npm run lint` (`eslint src`) | exit=0، بدون خطا/هشدار |
| `Frontend` → ۱۰ تست | همه `ALL PASS` (شامل `hatchery-slaughter-utils-test.mjs`) |
| `Backend` → `npm run check` | exit=0 |
| `Backend` → `npm run lint` (`eslint .`) | exit=0، بدون خطا/هشدار |
| `Backend` → ۶ تست (security ×۲، permissions، customer-validation، data-integrity، flock-calc) | همه `ALL PASS` |
| `audit:size` در هر دو پروژه | ۰ فایل صفر‌بایتی |

### ب) آزمون دود مسیرها (سرور واقعی، خروجی خام HTTP)

| مسیر | کد وضعیت | حجم بدنه |
| --- | --- | --- |
| `/` | ۲۰۰ | ۳۲۴۴۸ |
| `/login` | ۲۰۰ | ۲۳۴۲۳ |
| `/admin` | ۲۰۰ | ۵۹۸۱۴ |
| `/customer-info` | ۲۰۰ | ۱۱۰۲۷۰ |
| `/customers` | ۲۰۰ | ۴۵۸۵۳ |
| `/bookmarks` و `/bookmarks.html` | ۴۰۴ | ۴۱۳۲ (همان صفحهٔ `404.html`) |
| `/this-page-does-not-exist` | ۴۰۴ | ۴۱۳۲ |
| `/sms` و `/sms.html` | ۴۰۴ | ۴۱۳۲ (باگ از قبل موجود — بخش P1-۱) |
| `/styles/global.css` | ۲۰۰ | ۱۸۲۵۱ |
| `/styles/reset.css` و `/styles/variables.css` | ۴۰۴ | ۴۱۳۲ (فایل حذف‌شده و بی‌ارجاع) |

**نتیجهٔ کلیدی:** پیش از این موج، روت `/bookmarks` به `pages/bookmarks.html`
ناموجود اشاره می‌کرد و wrapper خطای `res.sendFile` در `server.js:356-386` همان
صفحهٔ ۴۰۴ را با کد ۴۰۴ برمی‌گرداند. حالا که روت حذف شده، درخواست به catch-all
`server.js:688` می‌رسد و **همان** پاسخ ۴۰۴ با همان بدنه تولید می‌شود ⇒ صفر تفاوت
رفتاری برای کاربر.

### ج) دو اصلاح لازم که همین دروازه کشف کرد (شفافیت)

۱. **`Backend/controllers/flockCompletionController.js`** — در استخراج موج ۱،
`SLAUGHTER_METHODS` از فایل حذف شده بود ولی در خط ۷۱۳ هنوز استفاده می‌شد
(ESLint: `no-undef`) و `calculateSystemData` بی‌استفاده import شده بود. حالا
`SLAUGHTER_METHODS` از `services/flockCompletionCalc` import می‌شود و
`calculateSystemData` از import حذف شد (این تابع هنوز از ماژول export می‌شود و
تست `flock-completion-calc-test.mjs` آن را پوشش می‌دهد).
۲. **`Frontend/frontend-server-test.mjs`** — بررسی «آدرس JS/CSSهای محلی نسخه‌دار
شده‌اند (`?v=`)» روی صفحهٔ لاگین انتظار **≥۳** دارایی محلی داشت؛ این عدد تنها به
لطف دو فایل صفر‌بایتی `reset.css`/`variables.css` تأمین می‌شد (تنها دارایی محلی
واقعی صفحه، `/styles/global.css` است). شرط به «`/styles/global.css` نسخه‌دار شده
باشد» تغییر کرد — دقیق‌تر، پایدارتر و بدون وابستگی به آستانهٔ عددی.

هیچ‌کدام از این دو، تغییری در رفتار محصول نیست: اولی رفع خطای lint/ReferenceError
بالقوه در مسیر ویرایش پایان دوره است و دومی فقط سنجهٔ تست را واقعی‌تر می‌کند.

