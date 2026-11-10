# بازبینی موج ۱۳.۱۸ — اسکیمای مشترک پورتال و گاردهای هم‌ترازی

> این موج **هیچ قابلیت کاربری تازه‌ای نمی‌سازد** و عمداً همین‌طور است.
> پیش از آن، یک واقعیت واحد (کلید مجوز، مسیر HTTP، پنل، مالکیت ردیف) در
> چهار جا **دستی تایپ** می‌شد؛ هر موج تازه یک کلید را در سه جا اضافه می‌کرد
> و در جای چهارم جا می‌ماند. ۱۳.۱۸ آن چهار جا را به **یک** فایل تبدیل می‌کند
> و دو گارد می‌نویسد که هم‌ترازی را **اجرا** می‌سنجند — نه با کامنت، با
> ایستادن روی همان `router.stack` واقعی.

---

## ۱) مسئله

| # | شکاف | اثر واقعی |
|---|---|---|
| ۱ | کلید مجوز در `routes/portalRoutes.js` تایپ می‌شد و همان رشته در `portal.menu.js` و `portalController.js` هم تکرار می‌شد | یک حرف اضافه ⇒ ۴۰۳ در سرور ولی لینک باز در منو |
| ۲ | مسیر HTTP در `api.const.js` جدا تایپ می‌شد | تغییر مسیر در بک‌اند، ۴۰۴ خاموش در فرانت |
| ۳ | `requireOwnedRow({ model, label })` در روتر دستی ساخته می‌شد | مسیر `:id` تازه می‌توانست بی‌مالکیت بماند و کسی نفهمد |
| ۴ | `sections`/`features` پاسخ `/me` با پرچم‌های دستی (`canHalls`, `canProfile`, …) ساخته می‌شد | پرچم تازه = یک `if` تازه در کنترلر + یک کلید تازه در فرانت |
| ۵ | نمودارها هم فهرست دوم در رندرکننده داشتند | پرچم ناشناس در UI خوانده می‌شد و بی‌صدا `undefined` می‌گرفت |
| ۶ | فیلدهای «هرگز» (اقتصاد گله/یادداشت داخلی/کارشناس) فقط در یک سرویس فهرست شده بودند | سرویس دوم می‌توانست همان فیلد را بدون هیچ هشداری برگرداند |

---

## ۲) دامنه — چه چیزی ساخته شد

| مورد | مقدار |
|---|---|
| اندپوینت تازه | **هیچ** (همان ۲۹ مسیر: ۲۲ خواندن + ۷ نوشتن) |
| مایگریشن / ستون / مدل تازه | **هیچ** |
| کلید مجوز تازه | **هیچ** (همان ۲۲۷ / ۱۸ گروه) — اسکیما همان ۲۶ کلید پورتال را نام می‌برد |
| فایل تازهٔ بک‌اند | `config/portalSchema.js` (۸۹۱ خط، خالص) · `portal-schema-test.mjs` |
| فایل تازهٔ فرانت | `portal-schema-guard-test.mjs` |
| تغییر رفتار کاربر | **هیچ** — تنها تفاوت عمدی: کلید `profile.edit` در `PATCH /profile` پیش از `requireOwnScope` می‌آید (رد زودتر، پاسخ یکسان) |

---

## ۳) ساختار اسکیما

```js
KEYS             // ۲۶ کلید customer.portal.* — تنها جای رشتهٔ کلید
PORTAL_BASE_KEY  // = KEYS.VIEW  ⇒ customer.portal.view
PORTAL_ROLE      // "customer"
PORTAL_PANELS    // ۱۴ پنل: id · route · menuKey · status · content{mode, keys}
PORTAL_ENDPOINTS // ۲۹ اندپوینت: method · path · panel · keys · scope · ownership · write · otp · upload · handler
PORTAL_FEATURES  // ۹ قابلیت درون‌تبی: { key, panel, extra }
PORTAL_SECTION_PANELS // ۹ پنلی که در sections پاسخ /me می‌آیند
PORTAL_CHARTS    // ۶ نمودار داشبورد: { key, permission }
FORBIDDEN_FIELDS // اقتصاد گله + notes + completed_by + customer_id
WHITELIST_MODELS // FlockCompletion(66) · FlockCompletionHall(24) · WeeklyManagement(20)
PORTAL_TOTALS    // panels 14 / live 13 / soon 1 · endpoints 29 / reads 22 / writes 7 · ownedRows 9
panelById · endpointById · endpointKeys · endpointsOfPanel · panelOpen
```

`panelOpen(panelId, has)` همان قراردادی است که کنترلر و فرانت اجرا می‌کنند:

- `mode: "all"` ⇒ همهٔ کلیدهای محتوا لازم است (مثل `finalReport`).
- `mode: "any"` ⇒ یک کلید کافی است.
- پنل `soon` بدون کلید محتوا ⇒ فقط با کلید منو باز می‌شود (تصمیم UI، نه داده).

---

## ۴) روتر: یک سازنده، صفر رشتهٔ کلید دستی

```js
const chainFor = (endpointId) => {
  const endpoint = endpointById(endpointId);          // ← نام ناشناخته = خطای استارت
  const chain = [
    authorize(PORTAL_ROLE),
    requirePermission(PORTAL_BASE_KEY),               // customer.portal.view
    requireCustomerLink,                              // مشتری بدون پرونده ⇒ ۴۰۳
  ];
  endpoint.keys.forEach((key) => chain.push(requirePermission(key)));
  if (endpoint.scope === "own") chain.push(requireOwnScope);
  if (endpoint.write) chain.push(portalWriteLimiter);
  endpoint.ownership.forEach((row) => chain.push(requireOwnedRow({ … })));
  if (endpoint.otp) chain.push(otpLimiter);
  if (endpoint.upload) chain.push(ensureDocumentQuota, uploadPortalDocumentSingle);
  return chain;
};

router.get("/completions/:id", ...chainFor("PORTAL_COMPLETION_DETAIL"), controller.getMyCompletion);
```

| قرارداد | مقدار |
|---|---|
| تعداد `requirePermission(` در فایل روتر | **۱** (داخل `chainFor`) |
| تعداد `requireOwnedRow(` در فایل روتر | **۱** (داخل `chainFor`) |
| تعداد `chainFor("…")` | **۲۹** = `PORTAL_TOTALS.endpoints` |
| مدل ناشناخته در `ownership` | خطای **استارت** (نه مسیر بی‌مالکیت در زمان اجرا) |

ترتیب زنجیره (همان که گارد می‌سنجد):
`protect` (سطح روتر) → `authorize(customer)` → `requirePermission(BASE)` →
`requireCustomerLink` → کلیدهای اندپوینت → `requireOwnScope` (scope=own) →
`portalWriteLimiter` (write) → `requireOwnedRow` (هر ردیف مالکیت) →
`otpLimiter` (otp) → `ensureDocumentQuota` + multer (upload) → کنترلر.

---

## ۵) نشانه‌های قابل‌سنجش (بدون تغییر رفتار)

| میان‌افزار | نشانه | چرا |
|---|---|---|
| `requirePermission` | `__permissionKeys` | گارد می‌تواند کلیدهای هر لایه را از `router.stack` بخواند |
| `authorize` | `__roles` | نقش مجاز هر مسیر قابل اثبات است (نه regex روی متن) |
| `requireOwnedRow` | `__ownedRow` = `{ model, source, key, store, label }` | مالکیت ردیف ⇔ اسکیما مو‌به‌مو |
| `portalWriteLimiter` / `otpLimiter` | `__rateLimiter` = نام | جای سقف نرخ در زنجیره قابل اثبات است |

هیچ‌کدام در زمان اجرا خوانده نمی‌شوند؛ فقط آزمون‌ها آن‌ها را می‌بینند.


---

## ۶) دو گارد تازه

### ۶.۱ بک‌اند — `Backend/portal-schema-test.mjs` (۴۶ بررسی)

| دسته | چه چیزی اثبات می‌شود |
|---|---|
| کاتالوگ | ۲۶ کلید یکتا، همه با `customer.portal.` و همه در `config/permissions.js` |
| پنل ⇔ HTML | ۱۴ پنل اسکیما = `data-portal-panel` در `portal.html` (نه کم، نه زیاد) |
| اندپوینت | ۲۹ مسیر یکتا؛ `scope`/`ownership`/`write`/`otp`/`upload` سازگار؛ خواندن ۲۲ + نوشتن ۷ |
| روتر واقعی | `require` روتر و پیمایش `router.stack`: طول زنجیره، نقش، ترتیب کلیدها، جای سقف‌ها، مالکیت هر ردیف، آخرین لایه = همان کنترلر |
| کلید دستی | هیچ رشتهٔ `customer.portal.` در کدِ فایل‌های پورتال (توضیحات حذف‌شده) |
| فیلد «هرگز» | هیچ فیلد ممنوعی در هیچ فهرست سفیدی نیست؛ شمارندهٔ ستون‌های مدل‌ها با DB یکی است |
| `/me` | `sections`/`features` فقط از `PORTAL_SECTION_PANELS`/`PORTAL_FEATURES`/`panelOpen` |
| ثبت | `test:portal-schema` در `Backend/package.json` و هر دو در دروازه |

### ۶.۲ فرانت — `Frontend/portal-schema-guard-test.mjs` (۲۸ بررسی)

| دسته | چه چیزی اثبات می‌شود |
|---|---|
| منو ⇔ اسکیما | ۷ منو / ۲۸ مسیر / ۱۴ پنل؛ `menuKey` و `contentKey` هر مسیر همان اسکیماست؛ تنها یک `soon` و بی‌کلید |
| API ⇔ اسکیما | هر مسیر `api.const.js` در اندپوینت‌های اسکیما هست و هر مسیر یکتای اسکیما در فرانت (بدون اندپوینت یتیم) — ۲۶ |
| `VIEW_TABS` ⇔ پنل | شش تب؛ `mode`/`keys` و کلید منو هر تب از اسکیما می‌آید (نرمال‌سازی `\r\n` پیش از regex) |
| قابلیت‌ها | هر `features.*` که مرورگر می‌خواند در اسکیما هست؛ `SERVER_ONLY_FEATURES` مستند است |
| نمودارها | رندرکننده هیچ پرچم ناشناسی نمی‌خواند؛ هر ۶ نمودار هم در اسکیما و هم در UI |
| فیلد «هرگز» | هیچ فیلد ممنوعی در UI نیست (`notes` عمداً استثناست: یادداشت خودِ مشتری) |
| ثبت | اسکریپت‌ها در `Frontend/package.json` و هر دو گارد در `gate.mjs`/`gate.ps1` |

---

## ۷) تثبیت گاردهای قبلی روی اسکیما

گاردهای موج‌های قبل، **متن** روتر را regex می‌کردند (`const customerChain = [`،
`tabChain("customer.portal.halls")`، `requireOwnedRow({ model: Hall … })`). با
حذف آن رشته‌ها این بررسی‌ها به‌درستی شکستند؛ هر کدام **همان قصد** را حفظ کرد و
به اسکیما وصل شد:

| گارد | بررسی‌های به‌روزشده |
|---|---|
| `customer-portal-guard-test.mjs` | ۱۲ بررسی (ترتیب زنجیره، شمارش مسیر، کلید هر تب، کلید گزارش بازدید، پروفایل/داشبورد، مدارک، لغو درخواست، سه مسیر جزئیات) — ۲۲۱ بررسی |
| `portal-request-test.mjs` | ۳ بررسی مالکیت ردیف (سالن/دوره/هفته) — ۸۰ بررسی |
| `portal-completion-test.mjs` | ۲ بررسی مسیرها (زنجیرهٔ تب + کلید تفصیلی) — ۳۱ بررسی |
| `permissions-test.mjs` | نگهبان «کلید پویا فقط از سازندهٔ مجاز»: نام‌های مجاز `key` و `PORTAL_BASE_KEY`؛ توضیحات پیش از اسکن حذف می‌شود — ۳۴ بررسی |

---

## ۸) نکات اجرا و ریسک‌ها

| # | نکته | چرا مهم است |
|---|---|---|
| ۱ | `endpointById` برای نام ناشناخته **throw** می‌کند | غلط تایپی در مسیر ⇒ خطای استارت، نه مسیر بی‌احراز |
| ۲ | ترتیب کلیدها در `endpointKeys` «پایه اول» است | گارد ترتیب را با `join("|")` می‌سنجد؛ جابه‌جایی = FAIL |
| ۳ | مالکیت ردیف ⇔ `scope` | `scope: "row"` بدون `ownership` (و برعکس) در گارد رد می‌شود |
| ۴ | ستون تازه در سه مدل پورتال ⇒ FAIL | توسعه‌دهنده مجبور می‌شود دربارهٔ نمایش/عدم نمایش تصمیم بگیرد (به‌جای لو رفتن خودکار) |
| ۵ | `notes` در اسکن UI استثناست | یادداشت خودِ مشتری در فرم درخواست مجاز است؛ هم‌نامی با یادداشت داخلی هفته |
| ۶ | گارد فرانت `\r\n` را نرمال می‌کند | پارس `VIEW_TABS` روی Windows نباید بشکند |
| ۷ | `requireCustomerLink` در «BASE» ماند | مشتری بدون پرونده ۴۰۳ روشن می‌گیرد، پیش از هر کوئری |

---

## ۹) فایل‌های این موج

**بک‌اند**

| فایل | تغییر |
|---|---|
| `config/portalSchema.js` | تازه — تنها منبع کلید/مسیر/پنل/مالکیت/نمودار/فیلد ممنوع |
| `routes/portalRoutes.js` | بازنویسی — تنها `chainFor`؛ صفر رشتهٔ کلید دستی |
| `controllers/portalController.js` | `sections`/`features` از `PORTAL_SECTION_PANELS`/`PORTAL_FEATURES`/`panelOpen` |
| `controllers/portalDashboardController.js` | پرچم نمودارها از `PORTAL_CHARTS` |
| `middleware/permissions.js` · `auth.js` · `portalOwnership.js` · `rateLimit.js` | نشانه‌های `__permissionKeys`/`__roles`/`__ownedRow`/`__rateLimiter` (بدون تغییر رفتار) |
| `services/portalCompletionView.js` | `FORBIDDEN_FIELDS` از اسکیما + assert هنگام بارگذاری |
| `portal-schema-test.mjs` | تازه — ۴۶ بررسی (پیمایش واقعی `router.stack`) |
| `permissions-test.mjs` · `portal-request-test.mjs` · `portal-completion-test.mjs` | تثبیت روی اسکیما |
| `package.json` | `test:portal-schema` |

**فرانت**

| فایل | تغییر |
|---|---|
| `portal-schema-guard-test.mjs` | تازه — ۲۸ بررسی (منو/API/`VIEW_TABS`/قابلیت/نمودار/فیلد ممنوع) |
| `customer-portal-guard-test.mjs` | ۱۲ بررسی به اسکیما وصل شد — ۲۲۱ بررسی |
| `package.json` | `test:portal-schema` (آینهٔ بک‌اند) · `test:portal-schema-guard` |

**ابزار و مستند**

| فایل | تغییر |
|---|---|
| `tools/gate.mjs` · `tools/gate.ps1` | دو گام تازه |
| `Frontend/README.md` · `Backend/README.md` | بخش موج ۱۳.۱۸ |
| `docs/REVIEW-WAVE-13.18.md` | همین سند |

---

## ۱۰) جمع‌بندی

- **صفر اندپوینت، صفر کلید، صفر مایگریشن** — ارزش این موج «جلوگیری از
  شکافِ بعدی» است، نه قابلیت تازه.
- **یک فایل، چهار مصرف‌کننده**: روتر، کنترلر، منو/نما و `api.const` دیگر
  هیچ کلیدی را از خودشان نمی‌سازند.
- **دو گارد، دو جهت**: بک‌اند روتر واقعی را پیمایش می‌کند، فرانت منو/پنل/HTML
  را. هر دو در دروازهٔ کیفیت اجرا می‌شوند.
- **تغییر ستون = FAIL**: مدل‌های پورتال شمارندهٔ ستون دارند تا تصمیم نمایش
  آگاهانه گرفته شود.
