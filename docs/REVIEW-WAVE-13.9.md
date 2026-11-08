# موج ۱۳.۹ — تکمیل PWA: پوستهٔ آفلاین + نوار «نصب اپلیکیشن»

> پیش‌نیاز: موج ۱۳.۸ (پروفایل من + داشبورد تحلیلی + زیرساخت PWA)
> دامنه: **فقط فرانت‌اند پورتال** (service worker، یک صفحهٔ آفلاین، نوار نصب).
> صفر تغییر در بک‌اند، صفر مایگریشن، صفر کلید مجوز تازه.

---

## ۱) خواستهٔ کارفرما

| # | خواسته | نتیجه در این موج |
|---|---|---|
| ۱ | مشتری پورتال را روی صفحهٔ اصلی گوشی نصب کند | نوار «نصب اپلیکیشن» با دکمهٔ واقعی `prompt()` + راهنمای دستی iOS |
| ۲ | اگر اینترنت قطع شد، پیام فارسی دیده شود (نه صفحهٔ خطای مرورگر) | `offline.html` به‌عنوان تنها قلم precache؛ فقط برای ناوبری |
| ۳ | هیچ دادهٔ پرونده روی گوشی نماند (دستگاه مشترک) | همچنان **صفر** کش داده/HTML/API — قاعدهٔ ۱۳.۸ دست‌نخورده |
| ۴ | رفتار مزاحم نباشد | نوار یک‌بار بسته شود ⇒ تا پاک‌شدن `localStorage` برنمی‌گردد |

## ۲) چرا در ۱۳.۸ چیزی کش نمی‌شد و حالا چه عوض شد؟

۱۳.۸ یک service worker **عبوری** ساخت: شنوندهٔ `fetch` داشت (شرط نصب‌پذیری) ولی
هیچ `respondWith`/`addAll`/`caches.put` نداشت. نتیجه: نصب‌پذیری ✅، آفلاین ❌
(مرورگر در حالت آفلاین صفحهٔ خطای خودش را نشان می‌داد).

۱۳.۹ همان قاعدهٔ داده را نگه می‌دارد و **دقیقاً یک** پاسخ آفلاین اضافه می‌کند:

```js
const SW_VERSION   = "13.9.0";
const SHELL_CACHE  = `skb-shell-${SW_VERSION}`;   // ⇒ skb-shell-13.9.0
const SHELL_ASSETS = ["/offline.html"];           // 🔒 فقط یک قلم
const OFFLINE_URL  = "/offline.html";
```

## ۳) رفتار service worker (فهرست سفید، پیش‌فرض «عبور»)

| # | شرط در `fetch` | رفتار | چرا |
|---|---|---|---|
| ۱ | `request.method !== "GET"` | `return` | هیچ نوشتنی (POST/PATCH/PUT/DELETE) از SW نمی‌گذرد |
| ۲ | `url.origin !== self.location.origin` | `return` | API ممکن است روی پورت/دامنهٔ دیگر باشد |
| ۳ | `url.pathname.startsWith("/api/")` | `return` | پاسخ API **هرگز** کش یا بازپخش نمی‌شود |
| ۴ | `request.mode !== "navigate"` | `return` | JS/CSS/تصویر/فونت کامل به شبکه |
| ۵ | ناوبری | شبکه اول؛ در شکست شبکه `caches.match(OFFLINE_URL, { cacheName: SHELL_CACHE })` | تنها استثنای این فایل |

`install` فقط `addAll(SHELL_ASSETS)` را انجام می‌دهد (اتمیک: اگر همان یک فایل
نیاید نصب شکست می‌خورد و نسخهٔ سالم قبلی می‌ماند). `activate` هر کش دیگری جز
`SHELL_CACHE` را پاک می‌کند و `clients.claim()` می‌زند.

## ۴) ⛔ چرا دارایی‌های ثابت (CSS/JS/تصویر) کش نمی‌شوند؟

| دلیل | توضیح |
|---|---|
| نسخه‌دهی خودکار HTTP | `Frontend/server.js` هنگام سرو صفحه‌ها به CSS و اسکریپت‌های کلاسیک `?v=<ASSET_VERSION>` می‌افزاید ⇒ کش یک‌ساله، بدون کهنگی |
| ماژول‌های ES نسخه‌دار نمی‌شوند | آدرس ماژول را (طبق README فرانت) نباید تغییر داد؛ کش‌کردنشان یعنی «کد کهنه» بعد از استقرار |
| هزینه/فایده | کش SW برای این پروژه سود محسوسی ندارد ولی ریسک کهنگی و باگ کش دارد |
| سادگی بازبینی | هر کسی این فایل را بخواند می‌فهمد هیچ داده‌ای روی دستگاه نمی‌ماند |

> اگر روزی cache-first برای دارایی‌ها لازم شد، باید همراه با هش محتوا در نام
> فایل باشد — وگرنه همین بحث کهنگی برمی‌گردد. تصمیم آگاهانه: **انجام نشد**.

## ۵) `offline.html` — چرا خودبسنده؟

| قاعده | دلیل |
|---|---|
| بدون `<link rel="stylesheet">` | در حالت آفلاین فایل CSS هم نمی‌آید |
| بدون `<script src>` | هیچ منبع شبکه‌ای لازم نیست (فقط `onclick="location.reload()"` inline) |
| آیکون SVG inline | بدون فونت‌آیکون و بدون درخواست اضافه |
| `lang="fa"` + `dir="rtl"` | هم‌خوان با بقیهٔ صفحات |
| `noindex` | صفحهٔ خطا نباید در نتایج جستجو بیاید |
| مسیر `/offline.html` در ریشه | آدرس کش ثابت و ساده + هدر `no-cache` (اگر زیر `/public` بود، کش `immutable` یک‌روزه می‌گرفت و SW ممکن بود نسخهٔ کهنه را precache کند) |


## ۶) نوار «نصب اپلیکیشن» (Add to Home Screen)

| فایل | نقش |
|---|---|
| `Frontend/src/pages/portal.html` | بلوک `#portalInstall` (پیش‌فرض `hidden`)، متن راهنما، `#portalInstallHint`، دکمهٔ `#portalInstallAction` با `data-portal-install` و دکمهٔ بستن با `data-portal-install-dismiss` — **بدون هیچ فرم HTML** |
| `Frontend/src/features/portal/portal.extra.js` | `initInstallPrompt()` · `bindInstallPrompt()` · `isInstalledApp()` · `isIosSafari()` · `showInstallBox()` · `hideInstallBox()` · `promptInstall()` · `dismissInstall()` |
| `Frontend/src/features/portal/portal.css` | `.portal-install`، `.portal-install[hidden]`، `__text`، `__hint`، `__actions` |

منطق (چهار حالت):

1. **نصب‌شده** (`display-mode: standalone` یا `navigator.standalone`) ⇒ نوار هرگز ساخته نمی‌شود؛
2. **قبلاً بسته شده** (`localStorage["skb_portal_install_dismissed"]`) ⇒ هرگز؛
3. **مرورگر پشتیبان** (`beforeinstallprompt`) ⇒ نوار با دکمهٔ نصب باز می‌شود؛ با `event.preventDefault()` نوار پیش‌فرض مرورگر نمایش داده نمی‌شود و تصمیم با کاربر است. دکمه فقط یک‌بار کار می‌کند (محدودیت مرورگر) و پس از `userChoice` نوار بسته می‌شود؛
4. **iOS/Safari** (رویداد نصب ندارد) ⇒ فقط متن راهنما: «دکمهٔ اشتراک‌گذاری ← افزودن به صفحهٔ اصلی»؛ دکمهٔ نصب مخفی می‌شود.

`appinstalled` ⇒ نوار بسته و رویداد پاک می‌شود. هیچ دیالوگ بومی مرورگر
(`alert`/`confirm`/`prompt`) استفاده نشده — قانون `no-alert` در ESLint و گارد تست.

## ۷) فایل‌های تغییر‌یافته

| فایل | نوع | خلاصه |
|---|---|---|
| `Frontend/src/public/offline.html` | **تازه** | پوستهٔ آفلاین خودبسنده فارسی/RTL |
| `Frontend/src/public/sw.js` | بازنویسی | نسخه‌دار، precache فقط `SHELL_ASSETS`، فهرست سفید `fetch` |
| `Frontend/src/pages/portal.html` | ویرایش | نوار نصب + به‌روزرسانی توضیح بالای صفحه |
| `Frontend/src/features/portal/portal.extra.js` | ویرایش | ۸ متد نصب‌پذیری + ۴ ثابت شناسه |
| `Frontend/src/features/portal/portal.css` | ویرایش | استایل نوار نصب |
| `Frontend/server.js` | ویرایش | سرو `/offline.html` از ریشه با `no-cache` |
| `Frontend/customer-portal-guard-test.mjs` | ویرایش | بازنویسی گارد PWA بخش ۱۳ + بخش تازهٔ **۱۴** (۹ بررسی) |

## ۸) گارد تست (بخش ۱۴ — ۹ بررسی)

1. `SW_VERSION`/`SHELL_CACHE` روی `13.9` و `SHELL_ASSETS` **دقیقاً یک قلم** (`/offline.html`)؛
2. `respondWith` فقط **یک بار** و داخل شاخهٔ ناوبری؛ شبکه اول و پوسته فقط در `catch`؛
3. غیر-GET، origin بیگانه و `/api/` همه رد می‌شوند؛ `caches.put` صفر؛ `caches.match` فقط یک بار با `cacheName`؛
4. `addAll` فقط با `SHELL_ASSETS` و فهرست precache بدون آدرس صفحه/API؛
5. `offline.html` خودبسنده (بدون CSS/JS خارجی، بدون فرم) با دکمهٔ تلاش دوباره؛
6. `/offline.html` در `PWA_FILES` با `text/html` و `no-cache`؛
7. بلوک HTML نوار نصب + همچنان بدون فرم؛
8. mixin: `beforeinstallprompt`/`appinstalled`/`preventDefault`/standalone/localStorage/iOS/`prompt()` و بدون `alert`؛
9. کلاس‌های CSS و وجود همین سند.

## ۹) آنچه در این موج انجام نشد (آگاهانه)

| مورد | دلیل |
|---|---|
| cache-first برای CSS/JS/فونت | نسخه‌دهی `?v=` در HTTP کافی است؛ کش SW = ریسک کهنگی (بند ۴) |
| کش پاسخ‌های API برای «مشاهدهٔ آفلاین پرونده» | نقض مستقیم قاعدهٔ داده (دستگاه مشترک/دادهٔ کهنه) — هرگز |
| آپلود عکس/مدارک از پورتال | نیاز به مایگریشن، سهمیه و مسیر نوشتن فایل — موج بعدی |
| Web Push (اعلان) | نیاز به کلید VAPID و زیرساخت ارسال؛ خارج از دامنهٔ این موج |

## ۱۰) بررسی سریع

```bash
cd Frontend && npm run lint && npm run test:customer-portal

# سرو محلی: هدرها و محتوای فایل‌های PWA
# GET /offline.html  ⇒ 200 + text/html; charset=utf-8 + Cache-Control: no-cache
# GET /sw.js         ⇒ 200 + Service-Worker-Allowed: /

cd .. && node tools/gate.mjs
```
