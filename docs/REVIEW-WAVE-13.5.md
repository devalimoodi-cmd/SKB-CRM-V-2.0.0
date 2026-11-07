# موج ۱۳.۵ — کنترل دسترسی پورتال + قطع سیل ۴۰۳ مشتری

> پیش‌نیاز: موج‌های ۱۳.۰ تا ۱۳.۴ (لینک کاربر↔مشتری، پورتال خواندنی، تب‌ها،
> جزئیات و پیوست)
> دامنه: **پروفایل مشتری برای کارکنان دست‌نخورده**؛ اما دسترسی مشتری حالا
> از پنل «کنترل سطوح دسترسی» — هم روی **نقش** مشتری و هم روی **تک‌کاربر** —
> ریزدانه قابل تنظیم است. **صفر مایگریشن، صفر تغییر در مسیر/صفحهٔ کارکنان.**

---

## ۱) ریشهٔ مسئله (شاهد از دیتابیس)

| مشاهده | معنی |
|---|---|
| `role_permissions(role='customer')` دقیقاً **۴۵ ردیف**، همه `allowed = true` | مدیر برای مشتری کلیدهایی مثل `charts.view`، `customer.basic.view`، `halls.view`، `weekly.view` را روشن کرده بود |
| همان کاربر در `/customer-info` با سیل ۴۰۳ روبه‌رو بود | هیچ‌یک از آن ۴۵ کلید «اثر» نداشت |
| `authorize(...)` در ۳۰+ فایل مسیر | هر مسیر کارکنان `customer` را **قبل از** `requirePermission` رد می‌کند |
| صفحهٔ `/customer-info` با `customer.basic.view` گیت شده بود و برای مشتری معاف بود | صفحه بالا می‌آمد، ولی ۱۵ سرویس سکشن هر یک ۴۰۳ می‌گرفتند |
| `bookmarks.view` برای مشتری `false` بود و هدر در **هر صفحه** آن را صدا می‌زد | منبع ۴۰۳ تکرارشوندهٔ سراسری |

نتیجه: «روشن‌کردن کلید ماژول کارکنان» هرگز برای مشتری کار نمی‌کند. راه درست
دو چیز است: (الف) پورتال با **کلیدهای اختصاصی خودش**، (ب) پنل باید این را
صادقانه نشان دهد.

---

## ۲) تصمیم‌های طراحی

| # | تصمیم | دلیل |
|---|---|---|
| ۱ | **۴ کلید تازه** در گروه «پورتال مشتری»: `customer.portal.halls`، `customer.portal.flocks`، `customer.portal.weeks`، `customer.portal.visits` | مدیر باید بتواند «هر بخش» را جدا ببندد/باز کند. کاتالوگ ۱۶۹ → **۱۷۳** کلید، گروه‌ها همان **۱۷** |
| ۲ | هر چهار کلید با `D.customerOnly` (پیش‌فرض: مشتری **روشن**، کارکنان خاموش) | افزودن کلید هیچ چیز را برای مشتریِ موجود قطع نمی‌کند (بدون مایگریشن) |
| ۳ | هیچ کلیدی `lockedTo` ندارد | کنترل کامل مدیر؛ `super_admin` هرگز قفل نمی‌شود |
| ۴ | اجرای واقعی در `tabChain(key)` روی هر مسیر `/api/portal/*` | پنهان‌کردن دکمه کافی نیست؛ **سرور** هم ۴۰۳ می‌دهد |
| ۵ | `getPortalSummary` هم با همین کلیدها فیلتر می‌شود | وگرنه بستن یک تب، «شمارنده» و «۳ ردیف آخر» را از راه خلاصه لو می‌داد. بخش بسته ⇒ شمارنده `null` (کارت حذف می‌شود) و آرایه خالی |
| ۶ | پاسخ خلاصه فیلد `sections` می‌دهد | کلاینت «حقیقتِ سرور» را می‌گیرد؛ اگر دادهٔ مجوز کلاینت ناقص بود، تب بسته باز نمی‌شود |
| ۷ | `/customer-info` دیگر برای مشتری معاف نیست | صفحهٔ کارکنان است؛ مشتری با `location.replace` به `/portal.html` می‌رود (گارد دوم داخل `customerInfoService.init`) |
| ۸ | هدر بوکمارک با `canLoadBookmarks()` گیت شد | صفر ۴۰۳ تکراری برای حساب بدون `bookmarks.view` |
| ۹ | پنل مدیریت: نوار راهنما + برچسب «بی‌اثر برای مشتری» | جلوی تکرار همان اشتباه (روشن‌کردن کلید بی‌اثر) را می‌گیرد |
| ۱۰ | گروه «پورتال مشتری» برای نقش/کاربر مشتری **اول و باز** | مدیر بدون جستجو دقیقاً همان‌جا را می‌بیند |

---

## ۳) تغییرات بک‌اند

| فایل | تغییر |
|---|---|
| `Backend/config/permissions.js` | چهار `item(...)` تازه در گروه `PORTAL` با `D.customerOnly`؛ هیچ `lockedTo` |
| `Backend/routes/portalRoutes.js` | `const tabChain = (key) => [...customerChain, requirePermission(key)]` + اعمال روی `/halls`، `/flocks`، `/weeks`، `/weeks/:id`، `/visits`؛ `visitReportChain` = مشترک + `customer.portal.visits` + `customer.portal.visit.report` |
| `Backend/controllers/portalController.js` | `userHasPermission` + `sections` + `orNull()`؛ فیلتر `counters` و `latest` بر پایهٔ چهار کلید |
| `Backend/permissions-test.mjs` | ۱۷۳/۱۷ + بررسی پیش‌فرض/قفل چهار کلید تازه |

زنجیرهٔ هر مسیر پورتال (بدون استثنا):

```
protect → authorize("customer") → requirePermission("customer.portal.view")
        → requirePermission("customer.portal.<tab>") → requireCustomerLink → controller
```

---

## ۴) تغییرات فرانت‌اند

| فایل | تغییر |
|---|---|
| `features/portal/portal.service.js` | `SECTION_CONF[key].permission`، `canSee(key)` (اول `data.sections` سرور، بعد `permissionService`)، `visibleTabKeys()`، `applyTabVisibility()`، گارد در `activateTab`/`loadSection`، شنوندهٔ `permissions:applied` |
| `features/portal/portal.renderer.js` | `counterCards` مقدار `null` را «بسته» می‌فهمد و `renderCounters` کارت آن را حذف می‌کند |
| `pages/portal.html` | `#portalTabsNotice` برای پیام «این بخش بسته شده است» |
| `core/services/app.service.js` | `isCustomerExemptPage()` فقط «صفحهٔ مقصد»؛ `redirectCustomerFromStaffPages()` در ابتدای `checkAccess` |
| `features/customer-info/customer-info.service.js` | گارد نقش مشتری در `init()` پیش از هر درخواست |
| `shared/layouts/Header/header-bookmarks.service.js` | `canLoadBookmarks()` + `!token || !canLoadBookmarks()` |
| `features/admin-panel/permission.manager.js` | `renderCustomerHint()`، `orderedGroupsFor(role)`، باز شدن خودکار گروه پورتال، برچسب `perm-inert` |
| `features/admin-panel/admin-panel.css` | `.perm-hint` و `.perm-inert` |
| `customer-portal-guard-test.mjs` | بخش ۱۱ (۸ بررسی تازه) + به‌روزرسانی شمارش ۱۷۳ و زنجیرهٔ `tabChain` |
| `frontend-server-test.mjs` | متن بررسی «ضدحلقه» به ۱۳.۵ به‌روز شد |

---

## ۵) دسته‌بندی دسترسی‌ها (چه چیزی واقعاً کار می‌کند)

| گروه کلید | برای مشتری اثر دارد؟ |
|---|---|
| `customer.portal.view` / `.halls` / `.flocks` / `.weeks` / `.visits` / `.visit.report` | ✅ بله — مسیرهای `/api/portal/*` و خلاصهٔ پرونده |
| `customer.basic.view`، `halls.*`، `weekly.*`، `charts.view`، `dictionary.*`، `users.*` … | ❌ نه — مسیرهایشان `authorize(کارکنان)` دارند و مشتری به آن‌ها نمی‌رسد |
| `users.customer.link` | ✅ بله — اتصال کاربر به پرونده (پنل مدیریت) |

پنل مدیریت از ۱۳.۵ همین را با برچسب «بی‌اثر برای مشتری» نشان می‌دهد.

---

## ۶) اثر تغییر تنظیمات

- کش سرور: `PERMISSIONS_CACHE_TTL_MS` (۳۰ ثانیه) — با ذخیره از پنل هم پاک می‌شود.
- کش کلاینت: بررسی نسخه هر ۳۰ ثانیه و انقضای ۶۰ ثانیه؛ با رویداد
  `permissions:applied` تب‌های پورتال در همان تب باز هم‌راستا می‌شوند.
- عملاً: **ذخیره در پنل ⇒ حداکثر چند ده ثانیه بعد، اثر در پورتال مشتری**.

---

## ۷) نقش مشتری و کاربر مشتری — هر دو

| مسیر API | کاربرد |
|---|---|
| `PUT /api/permissions/roles/customer` | تغییر سطح **نقش** (تأثیر روی همهٔ مشتریان) |
| `PUT /api/permissions/users/:id` | تغییر سطح **یک کاربر** (سه‌حالته: ارثی/فعال/غیرفعال) |
| `POST /api/permissions/users/:id/reset` | بازگردانی کاربر به سطح نقش |

ترتیب حاکمیت: **override کاربر → override نقش → پیش‌فرض کاتالوگ**
(`permissionService.getEffectivePermissions`).

> پیشنهاد پاک‌سازی: آن ۴۵ ردیف بی‌اثر نقش `customer` را می‌توان با
> «بازگردانی این نقش» حذف کرد؛ کلیدهای `customer.portal.*` پیش‌فرض روشن‌اند،
> پس پورتال سالم می‌ماند.

---

## ۸) آنچه تغییر نکرد

- `Backend/controllers/customerRegistrationController.js` و روترهای کارکنان:
  **۰ خط**.
- `Frontend/src/pages/customer-info.html` و همهٔ سرویس‌های سکشن آن: **۰ خط**.
- هیچ `authorize`ای حذف/باز نشد؛ هیچ مسیری به `customer` اضافه نشد.
- هیچ ردیف `role_permissions`/`user_permissions`ای خودکار حذف نشد.

---

## ۹) اعتبارسنجی

```
cd Frontend && node customer-portal-guard-test.mjs
cd Backend  && node permissions-test.mjs
node tools/gate.mjs
```

انتظار: گارد پورتال سبز، کاتالوگ **۱۷۳ کلید / ۱۷ گروه**، گیت `GATE-PASS`.

