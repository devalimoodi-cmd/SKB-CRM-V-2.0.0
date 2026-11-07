# موج ۱۳.۵.۱ — استایل مودال «نظرات و پیشنهادات» در پورتال مشتری

> پیش‌نیاز: موج ۱۳.۵ (کنترل دسترسی پورتال)
> دامنه: **فقط CSS یک صفحه + یک ویژگی پیش‌فرض در پارشال هدر + یک گارد تست**.
> صفر تغییر در بک‌اند، صفر تغییر در منطق مجوزها، صفر تغییر در مسیرها.

---

## ۱) نشانه (آنچه کاربر دید)

در `/portal` مودال گفتگو **بیرون از جای خود** رندر می‌شد: محتوای آن (فرم ارسال،
فهرست پیام‌ها، فوتر) به‌صورت یک بلوک خام بالای صفحه دیده می‌شد و هدر و بدنهٔ
صفحه را به‌هم می‌ریخت؛ باز و بسته کردن مودال هم ظاهراً اثری نداشت.

## ۲) ریشهٔ مسئله (شاهد از کد)

| # | مشاهده | معنی |
|---|---|---|
| ۱ | `#messageThreadModal` با کلاس `msg-modal-overlay` در `shared/layouts/Header/header.html` است | مودال متعلق به **هدر** است، نه پورتال |
| ۲ | `header.service.js` پارشال را با `container.innerHTML` داخل `<header id="main-header">` می‌گذارد | مودال فرزند همان `<header>` چسبان (`position: sticky`) است |
| ۳ | `.msg-modal-overlay { position: fixed; inset: 0; display: none; z-index: 3000 }` در `styles/info-pages.css` | تنها منبع استایل این مودال |
| ۴ | `pages/portal.html` تنها صفحهٔ هدراداری بود که `styles/info-pages.css` را لود **نمی‌کرد** (پیمایش ۱۳ صفحه) | overlay بدون CSS ⇒ `display: block` درون جریان ⇒ بلوک عظیم داخل هدر |
| ۵ | `.wn-overlay`/`.wn-modal` (مودال «تغییرات جدید») در `header.css` هستند | چرا آن یکی سالم بود و این یکی نه |
| ۶ | `.info-form`, `.info-error`, `.btn-primary-info`, `.msg-thread`, `.msg-row`, `.msg-bubble`, `.badge-status*` فقط در `info-pages.css` | حتی با باز شدن، بدنهٔ مودال بی‌استایل می‌ماند |

نکتهٔ مهم: این مودال **باید** در پورتال کار کند؛ روت‌های «گفتگوی خود کاربر» در
`Backend/routes/suggestionRoutes.js` (`/mine`، `/:id`، `/:id/reply`) فقط
`protect` دارند و گیت نقش ندارند و `portal.html` هم `messages.api.js` و
`messages.service.js` را لود می‌کند. پس راه‌حل «پنهان‌کردن دائمی» نبود؛
**استایل‌دادن** بود.

## ۳) اصلاح انجام‌شده

| فایل | تغییر |
|---|---|
| `Frontend/src/pages/portal.html` | `<link rel="stylesheet" href="/styles/info-pages.css">` پیش از `portal.css` (تا override پورتال همیشه آخر بماند) |
| `Frontend/src/shared/layouts/Header/header.html` | `#messageThreadModal` حالا `hidden` دارد؛ اگر صفحه‌ای استایل را لود نکند، مودال با قاعدهٔ مرورگر `[hidden] { display: none }` بیرون از جریان می‌ماند |
| `Frontend/src/features/messages/messages.service.js` | `openModal()` → `overlay.hidden = false` و `closeModal()` → `overlay.hidden = true` (هر دو مسیر باز/بستن از همین دو تابع می‌گذرند) |
| `Frontend/customer-portal-guard-test.mjs` | بخش **۱۲)** با ۵ بررسی جدید (۱۳.۵.۱) |

ایمنی افزودن `info-pages.css` به پورتال: تمام سلکتورهای آن namespaced هستند
(`.info-*`، `.msg-*`، `.btn-*-info`، `.contact-*`، `.badge-status*`) و هیچ
سلکتور سراسری (`body`/`html`/`*`) ندارد ⇒ تداخلی با `.portal-*`،
`.header-*` یا `portal.css` ندارد.

## ۴) گارد تست (ضد بازگشت)

| بررسی | چه چیزی را قفل می‌کند |
|---|---|
| `۱۳.۵.۱ · صفحهٔ پورتال: استایل مودال پیام‌ها …` | `portal.html` هم `header.css` و هم `info-pages.css` را دارد + خود فایل CSS هنوز `position: fixed` و `display: none` روی `.msg-modal-overlay` دارد |
| `۱۳.۵.۱ · قاعدهٔ کلی: هر صفحه‌ای که هدر دارد …` | پیمایش همهٔ `Frontend/src/pages/*.html`: هر صفحه‌ای که `Header/header.css` دارد باید `styles/info-pages.css` هم داشته باشد ⇒ صفحهٔ جدید نمی‌تواند همین باگ را تکرار کند |
| `۱۳.۵.۱ · هدر: مودال پیام‌ها پیش‌فرض hidden است …` | ویژگی `hidden` روی `#messageThreadModal` |
| `۱۳.۵.۱ · سرویس پیام‌ها: hidden … توگل می‌شود` | `overlay.hidden = false` در `openModal` و `= true` در `closeModal` |
| `۱۳.۵.۱ · مستندات: docs/REVIEW-WAVE-13.5.1.md …` | وجود و کامل بودن همین سند |

## ۵) وریفای

```
cd Frontend && node customer-portal-guard-test.mjs   # همه PASS
node tools/gate.mjs                                  # GATE-PASS
```

چشمی (حساب مشتری): `/portal` هدر تمیز و بدون بلوک مودال؛ کلیک «نظرات و
پیشنهادات» → overlay وسط‌چین با بک‌دراپ، فرم استایل‌دار، Esc و کلیک بیرون =
بستن، اسکرول `body` قفل می‌شود؛ عرض ۳۶۰px بدون سرریز.
