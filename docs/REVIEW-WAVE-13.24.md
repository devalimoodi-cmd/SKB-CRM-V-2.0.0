# بازبینی موج ۱۳.۲۴ — «ورود روی گوشی + نصب‌پذیری واقعی PWA»

> این موج از یک تست واقعی بیرون آمد: پورتال با `adb reverse` روی گوشی اندروید باز
> می‌شد، ولی **ورود با `Failed to fetch` می‌شکست** و مرورگر **هیچ‌وقت**
> «افزودن به صفحهٔ اصلی» را پیشنهاد نمی‌داد. هر دو شکایت ریشهٔ مشخص و قابل
> اثبات داشتند — نه حدس.

---

## ۱) مسئله

| # | شکاف | شاهد |
|---|---|---|
| ۱ | آدرس API روی localhost **مطلق** بود: `http://localhost:5000/api` | `config.const.js` (شاخهٔ `hostname === "localhost"`) ⇒ لاگین cross-origin به پورت ۵۰۰۰ |
| ۲ | کپچا همان لحظه **کار می‌کرد** | `login.html` از مسیر هم‌مبدأ `/api/captcha` (پروکسی `server.js`) استفاده می‌کند |
| ۳ | روی گوشی، پورت ۵۰۰۰ یا مبدأ `http://<ip>:3000` در دسترس/مجاز نبود | `adb reverse` فقط ۳۰۰۰؛ فهرست CORS هاردکد |
| ۴ | `ALLOWED_ORIGINS` در `.env` **خوانده نمی‌شد** | در کل `Backend/` هیچ ارجاعی به این متغیر نبود |
| ۵ | manifest آیکون ۱۹۲/۵۱۲ نداشت | فقط `skb-logo.png` با `260x109` و `default-avatar.svg` |
| ۶ | صفحهٔ `login` هیچ manifest/آیکونی نداشت | `<link rel="manifest">` فقط در `portal.html` بود |
| ۷ | خطای شبکه به کاربر متن خام مرورگر می‌داد | `api.service.js` خطای `fetch` را بدون ترجمه بالا می‌داد |

نتیجهٔ منطقی: **کپچا از ۳۰۰۰ عبور می‌کرد، لاگین از ۵۰۰۰ نمی‌کرد.**

---

## ۲) دامنه

| مورد | مقدار |
|---|---|
| اندپوینت تازه | **هیچ** (فقط `/api/ping` موجود به‌عنوان probe استفاده می‌شود) |
| کلید مجوز تازه | **هیچ** |
| مایگریشن | **هیچ** |
| تغییر بک‌اند | `utils/corsOrigins.js` (جدید) · `server.js` (CORS از env) · `.env.example` |
| تغییر فرانت | `config.const.js` · `api.service.js` · `pwa.service.js` (جدید) · `login.html` · `portal.html` · `manifest.webmanifest` |
| فایل تازه | `scripts/generate-pwa-icons.ps1` · `src/assets/images/pwa/*.png` (۴ فایل) |
| گارد تازه | `Frontend/api-base-test.mjs` (۱۲) · `Frontend/pwa-install-test.mjs` (۲۱) · `Backend/cors-config-test.mjs` (۱۷) |
| نتیجهٔ دروازه | ۵۳ ⇒ **۵۶ گام** |

---

## ۳) تغییرات کلیدی

### الف) آدرس API: هم‌مبدأ به‌جای پورت ۵۰۰۰

`resolveApiBaseUrl(loc, override)` تابع **خالص** (بدون `window`) شد تا تست‌پذیر باشد:

| مبدأ صفحه | نتیجه |
|---|---|
| `localhost:3000` / `127.0.0.1:3000` / `[::1]:3000` | `/api` (پروکسی) |
| `192.168.x.x:3000` (گوشی در شبکهٔ محلی) | `/api` (پروکسی) |
| دامنهٔ واقعی (با/بدون پورت) | `/api` (پروکسی) |
| `localhost:5500` (Live Server، بدون پروکسی) | `http://localhost:5000/api` |
| `file://` یا بدون location | `http://localhost:5000/api` |
| `window.__API_BASE_URL__` | همان مقدار (override دستی) |

⇒ روی گوشی **فقط پورت ۳۰۰۰** لازم است؛ نه CORS، نه `adb reverse tcp:5000`.
(تصاویر `/uploads` هم خودکار از همان دامنه لود می‌شوند، چون `window.API_URL` خالی می‌شود.)

### ب) CORS قابل تنظیم (fail-closed)

`utils/corsOrigins.js` → `resolveCorsOrigins(process.env)`:
پیش‌فرض‌های قبلی حفظ می‌شوند، `ALLOWED_ORIGINS` **اضافه** می‌شود (نه جایگزین)،
`CORS_ALLOW_LAN=true` همهٔ IPv4های محلی را روی `:3000`/`:5000` مجاز می‌کند،
`*` و مقادیر غیر`http(s)` دور ریخته می‌شوند و خروجی هرگز خالی نمی‌شود.

### ج) خطای شبکه به زبان کاربر

`api.service.js`: `isNetworkError()` (TypeError / `Failed to fetch` / `NetworkError` /
`Load failed`، به‌جز `AbortError`) و `toRequestError()` که پیام فارسی
«ارتباط با سرور برقرار نشد…» + پرچم `isNetworkError` می‌دهد. در `login.html` هم
یک probe سبک روی `/api/ping` (عمومی، بدون توکن) پیام گویا نشان می‌دهد.

### د) نصب‌پذیری PWA

| قلم | وضعیت |
|---|---|
| آیکون‌ها | `icon-192.png` · `icon-512.png` · `icon-maskable-512.png` · `apple-touch-icon-180.png` (ساخته‌شده با `System.Drawing`، بدون وابستگی npm) |
| manifest | آیکون‌های مربع + `prefer_related_applications: false` + `start_url=/portal` |
| صفحهٔ ورود | manifest + `theme-color` + آیکون اپل + `pwa.service.js` |
| `pwa.service.js` | تزریق idempotent تگ‌ها · ثبت `/sw.js` با `scope: "/"` · نگه‌داشتن `beforeinstallprompt` در `window.__skbInstallPrompt` + رویداد `skb:install-available` |
| `sw.js` | **بدون تغییر** — همان قاعدهٔ ۱۳.۹: فقط `/offline.html`، هیچ دادهٔ مشتری کش نمی‌شود |

> ℹ️ از Chrome ۱۰۸ به بعد service worker شرط نصب نیست، اما برای پوستهٔ آفلاین
> و «تجربهٔ اپ‌مانند» لازم است؛ ثبت آن در صفحهٔ ورود هم اضافه شد.


---

## ۴) گاردها و دروازهٔ کیفیت

| گارد | تعداد بررسی | چه چیزی را قفل می‌کند |
|---|---|---|
| `Frontend/api-base-test.mjs` | ۱۲ | `:3000`/دامنه ⇒ `/api`؛ `file://`/`:5500` ⇒ مطلق؛ override؛ سیم‌کشی `config.const.js`/`api.service.js`/`login.html` |
| `Frontend/pwa-install-test.mjs` | ۲۱ | فیلدهای manifest؛ وجود **و ابعاد واقعی** آیکون‌های ۱۹۲/۵۱۲/۱۸۰ (هدر IHDR)؛ maskable؛ لینک‌های `login.html`/`portal.html`؛ قرارداد `pwa.service.js`؛ قاعدهٔ دادهٔ `sw.js` |
| `Backend/cors-config-test.mjs` | ۱۷ | پیش‌فرض‌ها، افزودنی بودن `ALLOWED_ORIGINS`، trim/dedupe، fail-closed، `CORS_ALLOW_LAN`، سیم‌کشی `server.js` و `.env.example` |

هر سه در `Frontend/package.json` و `tools/gate.mjs` + `tools/gate.ps1` ثبت شده‌اند:

```
test:api-base     → node api-base-test.mjs
test:pwa          → node pwa-install-test.mjs
test:cors-config  → node ../Backend/cors-config-test.mjs     (Backend: test:cors)
```

---

## ۵) تست دستی روی گوشی (چک‌لیست)

```powershell
adb reverse tcp:3000 tcp:3000        # فقط ۳۰۰۰ لازم است
adb reverse --list                   # باید ۳۰۰۰ را ببینی
# در مرورگر گوشی:
#   http://localhost:3000/login
```

| # | انتظار |
|---|---|
| ۱ | کپچا می‌آید (هم‌مبدأ `/api/captcha`) |
| ۲ | در DevTools (chrome://inspect) درخواست لاگین به `http://localhost:3000/api/users/login` می‌رود — **نه** پورت ۵۰۰۰ |
| ۳ | ورود بدون `Failed to fetch` انجام می‌شود |
| ۴ | اگر بک‌اند خاموش باشد، پیام فارسی «ارتباط با سرور برقرار نشد…» دیده می‌شود (نه متن خام مرورگر) |
| ۵ | `Application → Manifest` بدون خطا؛ آیکون ۱۹۲ و ۵۱۲ بارگذاری می‌شوند |
| ۶ | `Application → Service Workers` نصب `sw.js` با scope `/` را نشان می‌دهد |
| ۷ | پس از یک tap + ~۳۰ ثانیه حضور، نصب پیشنهاد می‌شود (نوار پورتال یا منوی مرورگر) |

> ⚠️ اگر سایت با `http://<LAN-IP>:3000` باز شود، service worker ثبت نمی‌شود
> (secure context لازم است) اما ورود کار می‌کند؛ برای تست کامل PWA از
> `http://localhost:3000` استفاده کن.

---

## ۶) ریسک‌ها و محدودیت‌ها (مستند، نه باگ)

| # | مورد | چرا پذیرفتنی است |
|---|---|---|
| ۱ | درخواست‌ها حالا از پروکسی `Frontend/server.js` عبور می‌کنند (حجم/آپلود) | همان مسیری است که کپچا و همهٔ صفحات قبلاً استفاده می‌کردند؛ پروکسی بدنهٔ خام را با `duplex: "half"` پاس می‌دهد |
| ۲ | تصاویر `profile_image` هم از `/uploads` هم‌مبدأ لود می‌شوند | مسیر `/uploads` از قبل در پروکسی فرانت تعریف شده است |
| ۳ | `SW_VERSION` عمداً روی `13.9.0` ماند | گارد ۱۳.۹ این مقدار را قفل کرده و منطق کش تغییری نکرده است |
| ۴ | آیکون‌ها از لوگوی افقی ساخته شده‌اند (پلیت روشن روی رنگ برند) | تنها منبع موجود `skb-logo.png` است؛ طراحی رسمی می‌تواند بعداً فقط فایل‌ها را جایگزین کند |
| ۵ | `CORS_ALLOW_LAN` روی سرور production باید `false` بماند | در `.env.example` صریح مستند شده است |
