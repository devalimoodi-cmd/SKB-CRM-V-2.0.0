# بازبینی موج ۱۳.۲۲ — «گیت واقعیِ ارسال تیکت»

> ادامهٔ مستقیم ۱۳.۲۱. آن موج پنل «ارسال تیکت» را ساخت و کلید
> `customer.portal.tickets` را در کاتالوگ گذاشت، ولی خودش نوشت:
> «گیت سرور در ۱۳.۲۲». این موج همان قول را انجام می‌دهد.
>
> **۰ اندپوینت · ۰ کلید · ۰ مایگریشن · ۱ میان‌افزار کوچک** — ارزش این موج
> «بستن یک ۴۰۳ خاموش» است: کلیدی که در پنل مدیریت بسته می‌شد، هیچ اثری
> روی سرور نداشت.

---

## ۱) مسئله

| # | شکاف | اثر |
|---|---|---|
| ۱ | کلید `customer.portal.tickets` فقط در **مرورگر** خوانده می‌شد | مدیر کلید را می‌بست، دکمه/پنل پنهان می‌شد، ولی `GET /api/suggestions/mine` با همان توکن همچنان همهٔ گفتگوها را برمی‌گرداند — «کنترل دسترسی نمایشی» |
| ۲ | گیت ساده ممکن نبود | همان روت‌ها مودال «پاکت پیام‌ها»ی هدر را برای **کارشناس/ادمین** هم سرو می‌کنند و کلید در کاتالوگ `D.customerOnly` است؛ `requirePermission(key)` مودال کارکنان را می‌بست |
| ۳ | پنل پورتال با `canViewContent` گیت می‌شد | آن تابع از `canPermission` مرورگر می‌آید که **fail-open** است (درس ۱۳.۲۰)؛ با کش کهنه، پنل باز می‌شد و درخواست قطعاً-۴۰۳ خطای شبکه نشان می‌داد |

ریشهٔ مشترک: **«کلید محتوا» بدون مصرف‌کنندهٔ سرور** — دقیقاً همان الگویی که
۱۳.۲۰ برای دو پرچم داشبورد بست.

---

## ۲) دامنه

| مورد | مقدار |
|---|---|
| اندپوینت تازه | **هیچ** — همان ۲۹ اندپوینت اسکیمای ۱۳.۱۸ (۲۲ خواندن + ۷ نوشتن) |
| کلید مجوز تازه | **هیچ** (۲۲۵ ⇒ ۲۲۵ / ۱۸ گروه) |
| مایگریشن | **هیچ** |
| تغییر بک‌اند | `middleware/permissions.js` (+۱ تابع) · `routes/suggestionRoutes.js` (۶ روت) · دو کامنت اسکیما/کاتالوگ |
| تغییر فرانت | `portal.tickets.js` (گیت محتوا سرور-اول + کامنت سرآیند) · کامنت `portal.menu.js` |
| فایل تازه | `Backend/portal-tickets-test.mjs` (۳۳ بررسی) + همین سند |
| نتیجهٔ دروازه | ۵۰ ⇒ **۵۱ گام** |

---

## ۳) میان‌افزار تازه — `requireRolePermission`

```js
// middleware/permissions.js
const requireRolePermission = (role, ...keys) => {
  const inner = requirePermission(...keys);
  const onlyRoles = Object.freeze([String(role || "")].filter(Boolean));

  const guard = async (req, res, next) => {
    if (req.user && !onlyRoles.includes(String(req.user.role))) return next();
    return inner(req, res, next);
  };

  guard.__permissionKeys = inner.__permissionKeys;
  guard.__onlyRoles = onlyRoles;
  return guard;
};
```

سه تصمیم پشت این ده خط:

| تصمیم | چرا |
|---|---|
| بازاستفاده از `requirePermission` و نه بازنویسی | سوپرادمین، حالت dry-run (`PERMISSIONS_ENFORCE`)، پیام فارسی، `requiredTitles` و پرچم `permissionDenied` همه یک‌جا می‌مانند؛ دو نسخه از منطق ۴۰۳ نمی‌سازیم |
| `req.user &&` قبل از بررسی نقش | بدون احراز هویت باید همان **۴۰۱** قبلی برگردد، نه عبور خاموش |
| کپی `__permissionKeys` + تازه `__onlyRoles` | گاردهای هم‌ترازی همان نشانه‌های ۱۳.۱۸ را می‌خوانند؛ رفتار عوض نمی‌شود، فقط خوانا می‌ماند |

معنای دقیق: «اگر نقش کاربر مشتری است، این کلید لازم است» — نه «فقط مشتری
اجازه دارد». یعنی کارشناس/ادمین بدون کلید عبور می‌کند (مودال هدرش می‌شکند

---

## ۴) روتر — چه بسته شد، چه نشد

```js
// routes/suggestionRoutes.js
const { KEYS: PORTAL_KEYS } = require("../config/portalSchema");
const CUSTOMER_TICKETS = requireRolePermission("customer", PORTAL_KEYS.TICKETS);
```

| مسیر | کلید لازم | نقش |
|---|---|---|
| `POST /` | `customer.portal.tickets` (فقط مشتری) | + `suggestionLimiter` |
| `GET /mine` · `GET /unread-count` | همان | مشتری |
| `GET /:id` · `POST /:id/read` | همان | مشتری |
| `POST /:id/reply` | همان | + `suggestionLimiter` |
| `GET /` | `suggestions.admin.view` | ادمین |
| `GET /:id/admin` | `suggestions.admin.view` | ادمین |
| `POST /:id/admin-reply` | `suggestions.reply` | ادمین |
| `PATCH /:id` | `suggestions.status` | ادمین |
| `DELETE /:id` · `DELETE /:id/messages/:messageId` | `authorize(ADMIN_ROLES)` + `suggestions.delete` | ادمین |

سه نکتهٔ ریز که گارد جدا می‌سنجد:

| تصمیم | چرا |
|---|---|
| گیت **قبل** از `suggestionLimiter` | کاربر بدون کلید نباید سهم ارسالش را با درخواست‌های ردشده بسوزاند (۴۰۳ ≠ تلاش برای ارسال) |
| گیت **بعد** از `protect` (که روی `router.use` است) | بدون توکن باید ۴۰۱ بماند؛ تست امنیتی قدیمی هم همین را انتظار دارد |
| کلید از `PORTAL_KEYS.TICKETS` | اگر روزی کلید در اسکیما عوض شود، روتر خودکار همان را می‌خواند؛ رشتهٔ `customer.portal.tickets` در فایل روتر تایپ نمی‌شود (گارد می‌سنجد) |

---

## ۵) فرانت — همان کلید، حالا سرور-اول

```js
// portal.tickets.js — loadTicketsView
const conf = this.ticketTabConf();
if (conf && !this.canCreateTicket()) {
  state.loaded = true;
  this.setExtraStatus("tickets", "ready");
  this.renderViewDenied("tickets");
  return;
}
```

`canCreateTicket()` از ۱۳.۲۱ هست و منبع اولش `features.tickets` پاسخ
`GET /portal/me` است؛ فقط اگر پاسخ قدیمی بود به `canPermission` مرورگر
برمی‌گردد. با این تغییر، «دیده‌شدن پنل» و «اجازهٔ واقعی سرور» یک چیز شدند.

رفتار ۴۰۳ (اگر باز هم رخ دهد، مثلاً کلید وسط نشست بسته شود): سرور
`permissionDenied: true` می‌فرستد ⇒ `permissionService.handleForbidden` با
`notifyOnce({ key: "perm-denied:customer.portal.tickets" })` **یک‌بار** توست
می‌دهد و مجوزها را تازه می‌کند. چون بج هدر هر ۶۰ ثانیه `/unread-count` را
poll می‌کند، همین `notifyOnce` جلوی سیل توست را می‌گیرد (بدون آن، هر دقیقه
یک توست بود).


---

## ۶) گارد تازه — `Backend/portal-tickets-test.mjs` (۳۳ بررسی)

| بخش | چه می‌سنجد |
|---|---|
| ۰ | همهٔ فایل‌های کلیدی موجود و غیرخالی‌اند (میان‌افزار، روتر، اسکیما، کاتالوگ، پنل، `api.const`, `portal.service`, دو `package.json`, دو دروازه) |
| ۱ (اجرایی) | خودِ گیت با درخواست جعلی: مشتری بدون کلید ⇒ ۴۰۳ + `permissionDenied` + `required`؛ مشتری با کلید ⇒ عبور؛ `expert`/`sub_admin`/`admin`/`super_admin` ⇒ عبور؛ بدون کاربر ⇒ ۴۰۱؛ حالت dry-run ⇒ عبور؛ نشانه‌های `__permissionKeys`/`__onlyRoles` |
| ۲ (اجرایی) | پشتهٔ واقعی روتر: ۱۲ مسیر، `protect` سطح روتر، گیت روی هر شش روت مشتری و در **اولین** خانه، محدودیت نرخ **بعد** از گیت، هیچ روت ادمینی کلید تیکت را نمی‌خواهد، کلیدهای ادمین/`authorize` حذف/کنترلر نهایی سر جای خود |
| ۳ | یک منبع بودن کلید: اسکیما + کاتالوگ + پنل `tickets` + پرچم `features.tickets`؛ پیش‌فرض فقط-مشتری و بدون قفل |
| ۴ | هم‌ترازی فرانت: `TICKETS_TAB.requires`، پنج متد مجاز `messagesApi` (و نبود متدهای ادمین)، گیت سرور-اول `canCreateTicket`، شش مسیر در `api.const`، سوارشدن mixin |
| ۵ | ثبت در `Backend/package.json` + `Frontend/package.json` + `gate.mjs` + `gate.ps1` |

دو نکتهٔ طراحی گارد:

- بخش‌های ۱ و ۲ **اجرا** می‌شوند، نه grep: `requireRolePermission` صدا زده
  می‌شود و پشتهٔ `router.stack` پیمایش می‌شود. اگر روزی کسی گیت را از روتر
  بردارد یا ترتیبش را جابه‌جا کند، گارد قرمز می‌شود — حتی اگر رشتهٔ کلید
  هنوز در فایل باشد.
- کنترلر با **هویت تابع** سنجیده می‌شود (`controller.createSuggestion`)،
  نه با شمارش آرگومان‌ها؛ پس رفکتور کنترلر گارد را نمی‌شکند.

---

## ۷) آزمون‌ها

| مجموعه | نتیجه |
|---|---|
| `portal-tickets` (تازه) | ۳۳/۳۳ |
| `portal-schema` (بک‌اند) | ۴۷/۴۷ |
| `permissions` (بک‌اند) | ۳۴/۳۴ (۲۲۵/۱۸ — بی‌تغییر) |
| `portal-completion` | ۳۱/۳۱ |
| `portal-schema-guard` | ۳۰/۳۰ |
| `portal-menu` | ۸۲/۸۲ |
| `customer-portal` | ۲۲۱/۲۲۱ |
| `portal-tree` | ۳۱/۳۱ |
| `farm-write` · `portal-requests` | ۳۹/۳۹ · ۳۵/۳۵ |
| `lint` (فرانت/بک‌اند) · `lint:guards` · چهار `audit:*` | exit=0 |
| دروازهٔ کامل | **GATE-PASS — ۵۱ گام** |

---

## ۸) نکات و ریسک‌ها

| # | نکته | چرا مهم است |
|---|---|---|
| ۱ | گیت در پیش‌فرض سرور **dry-run** است | تا `PERMISSIONS_ENFORCE=true` نشود فقط `console.warn` می‌شود؛ این عمدی است (۱۳.۹: اول ببین، بعد ببند) |
| ۲ | بستن کلید، مودال هدر **مشتری** را هم می‌بندد | `/mine` و `/unread-count` همان گفتگوی خود کاربرند؛ اگر مدیر تیکت را ببندد، بج پاکت مشتری هم خالی می‌شود. این «هم‌راستایی» است، نه نقص |
| ۳ | یک توست در اولین ۴۰۳ | `notifyOnce` با کلید کلید؛ اگر مدیر انتظار «سکوت کامل» دارد، `permissionService` جای تغییر آن است، نه این گیت |
| ۴ | کارشناس/ادمین همچنان بی‌کلید | اگر روزی خواستید برای کارکنان هم ببندید، `requireRolePermission("customer", …)` را به `requirePermission` تغییر ندهید — اول باید کلید `customer.portal.tickets` از `D.customerOnly` خارج شود |
| ۵ | `security-e2e-test.mjs` (خارج دروازه) | با کاربر `customer` این مسیرها را صدا می‌زند؛ چون پیش‌فرض `customer` روی `true` است و enforcement خاموش، رفتار عوض نمی‌شود |


---

## ۹) فایل‌های این موج

| فایل | تغییر |
|---|---|
| `Backend/middleware/permissions.js` | تابع تازهٔ `requireRolePermission` + export (بدون تغییر در `requirePermission`) |
| `Backend/routes/suggestionRoutes.js` | گیت `CUSTOMER_TICKETS` روی ۶ روت + کلید از `PORTAL_KEYS.TICKETS` |
| `Backend/config/portalSchema.js` | کامنت `KEYS.TICKETS` و ردیف `features.tickets` به‌روزرسانی شد (کد بدون تغییر) |
| `Backend/config/permissions.js` | کامنت `customer.portal.tickets` به‌روزرسانی شد (کد بدون تغییر) |
| `Backend/portal-tickets-test.mjs` | **تازه** — ۳۳ بررسی (اجرای گیت + پیمایش روتر + هم‌ترازی فرانت) |
| `Backend/package.json` · `Frontend/package.json` | `test:portal-tickets` |
| `Frontend/src/features/portal/portal.tickets.js` | گیت محتوا سرور-اول (`canCreateTicket`) + کامنت سرآیند |
| `Frontend/src/features/portal/portal.menu.js` | کامنت کلید `TICKETS` (کد بدون تغییر) |
| `tools/gate.mjs` · `tools/gate.ps1` | گام `test:portal-tickets` |
| `Backend/README.md` · `Frontend/README.md` | بخش ۱۳.۲۲ + اصلاح اشارهٔ «گیت سرور در ۱۳.۲۲» در بخش ۱۳.۲۱ |
| `docs/REVIEW-WAVE-13.21.md` | دو اشارهٔ «به تعویق افتاد» با ✅ «انجام شد» علامت خورد |

---

## ۱۰) جمع‌بندی

- کلیدی که تا دیروز فقط یک **دکمه** را پنهان می‌کرد، حالا یک **۴۰۳ واقعی** است.
- این کار با یک تابع ده‌خطی و بدون دست‌زدن به مودال کارکنان انجام شد؛
  اگر گیت را با `requirePermission` می‌زدیم، بستن تیکت مودال پاکت هدر
  کارشناس/ادمین را هم می‌بست.
- هیچ اندپوینت، کلید یا مایگریشنی اضافه نشد؛ کل کار «مصرف‌کردن» کلید
  ۱۳.۲۱ است.
- گارد تازه به‌جای grep، **کد را اجرا می‌کند**: گیت با درخواست جعلی و
  روتر با پیمایش پشتهٔ واقعی سنجیده می‌شود.
- دروازه: **۵۱ گام، GATE-PASS**.

اگر غیر از این بود).
