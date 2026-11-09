# موج ۱۳.۱۱ — «درخواست‌های فارم»: الگوی ب (درخواست مشتری + تأیید کارشناس)

> وضعیت: ✅ پیاده‌سازی‌شده و تست‌شده · پیش‌نیاز: موج ۱۳.۱۰.۱

## ۱) مسئله

تا موج ۱۳.۱۰، مشتری از پورتال **فقط می‌خواند** (به‌جز پروفایل/موبایل/مدارک).
اگر می‌خواست واحد، سالن یا جوجه‌ریزیِ تازه داشته باشد، باید تلفن می‌زد یا
حضوری می‌گفت و کارشناس برایش ثبت می‌کرد. دو راه ممکن بود:

| گزینه | چه می‌شد | چرا انتخاب/رد شد |
|---|---|---|
| **الف) نوشتن مستقیم** | مشتری خودش واحد/سالن/جوجه‌ریزی می‌ساخت | ❌ یک اشتباه یا سوءاستفاده، دادهٔ عملیاتی (تعداد قطعه، تاریخ جوجه‌ریزی، ظرفیت) را آلوده می‌کرد و قابل ردیابی/بازبینی نبود |
| **ب) درخواست + تأیید کارشناس** ✅ | مشتری «درخواست» می‌فرستد؛ تا تأیید کارشناس **هیچ ردیفی** ساخته نمی‌شود | ✅ دادهٔ عملیاتی فقط با تصمیم انسان وارد می‌شود؛ سابقهٔ تصمیم می‌ماند؛ کارشناس می‌تواند مقادیر را اصلاح کند |

**این موج گزینهٔ «ب» را پیاده کرد** — همان الگویی که در ۱۳.۶ برای
«درخواست‌های ثبت‌نام» استفاده شده بود.

## ۲) سه نوع درخواست

| نوع | جدول مقصد | فیلدهای مجاز (فهرست سفید) |
|---|---|---|
| `unit_create` | `units` | `unit_name, address, hall_count, capacity, longitude, latitude, manager_name, manager_phone, note` |
| `hall_create` | `halls` | `unit_id, hall_name, hall_number, nominal_capacity, altitude_above_sea, hall_type_id, construction_year, operator_name, note` |
| `placement_create` | `chick_placements` (+`flocks`) | `unit_id, hall_id, placement_date, chick_source_id, breed_id, chick_age_on_arrival, avg_initial_weight, total_chicks_count, placement_density, flock_id, start_new_flock, note` |

⚠️ هیچ‌کدام از این فهرست‌ها `customer_id`، `status`، `id`، `reviewed_by`،
`role` یا `unit_status_id` را ندارد. مشتری نمی‌تواند «خودش را تأیید کند».

## ۳) جدول داده — `portal_requests`

مهاجرت: `Backend/migrations/20261110000000-create-portal-requests.js` (idempotent)

| ستون | نوع | توضیح |
|---|---|---|
| `id` | INTEGER PK | — |
| `customer_id` | INTEGER NOT NULL | **فقط از توکن** (`req.customerScopeId`) |
| `request_type` | VARCHAR(30) | `unit_create` · `hall_create` · `placement_create` |
| `status` | VARCHAR(20) | `pending` · `approved` · `rejected` · `cancelled` |
| `payload` | JSONB | فقط کلیدهای سفیدِ همان نوع |
| `submitted_by` / `submitted_ip` / `submitted_user_agent` | — | ممیزی ثبت (در خروجی API نمی‌آید) |
| `reviewed_by` / `reviewed_at` / `reject_reason` | — | تصمیم کارشناس |
| `applied_at` / `result_entity_id` / `result_summary` | — | نتیجهٔ اعمال در جدول اصلی |
| `created_at` / `updated_at` | timestamps | — |

ایندکس‌ها: `portal_requests_customer_status_created` ·
`portal_requests_status_created` · `portal_requests_type_status`.

🔒 حذف نداریم: درخواست لغوشده هم با `status='cancelled'` می‌ماند
(سابقهٔ تصمیم). ستون‌های `submitted_by`/`reviewed_by` بدون FK هستند تا
تاریخچه پس از حذف کاربر/کارشناس باقی بماند.

## ۴) جریان کار

```
مشتری (پورتال)                     کارشناس/مدیر (پنل)
─────────────────                  ────────────────────
POST /api/portal/farm/requests
   → sanitizePayload (فهرست سفید)
   → validatePayload (اعتبارسنجی)
   → سقف ۱۰ درخواست باز
   → درخواست تکراری باز؟
   ⇒ ردیف pending
                                   GET  /api/portal-requests?status=pending
                                   GET  /api/portal-requests/:id
POST /api/portal/farm/requests/:id/cancel   (فقط pending)
                                   POST /api/portal-requests/:id/approve
                                     → تراکنش + قفل ردیف
                                     → (اصلاح اختیاری payload)
                                     → اعتبارسنجی مجدد
                                     → ساخت ردیف واقعی
                                     → status=approved + نتیجه
                                   POST /api/portal-requests/:id/reject
                                     → دلیل اجباری → status=rejected
```

بعد از تأیید، مشتری در همان تب «درخواست‌های من» نتیجه را می‌بیند
(`result_summary` مثل «سالن «سالن ۳» در واحد «مرغداری نمونه» ثبت شد»).

## ۵) امنیت — چهار مرز

1. **`customer_id` فقط از توکن.** هیچ فیلدی از بدنه/کوئری خوانده نمی‌شود؛
   لغو هم روی ردیف خودم است (`requireOwnedRow` + دوباره در سرویس) ⇒ ردیف
   مشتری دیگر = ۴۰۴ (وجودش لو نمی‌رود).
2. **payload خام ذخیره نمی‌شود.** `sanitizePayload` همهٔ کلیدهای ناشناخته را
   می‌اندازد؛ `validatePayload` همان اعتبارسنجی‌های موجود
   (`validations/unitValidation`، `validations/chickPlacementValidation`) را
   اجرا می‌کند تا قاعده دو نسخه نشود.
3. **تأیید = تراکنش.** `sequelize.transaction()` + `lock: LOCK.UPDATE` +
   شرط `status='pending'` ⇒ دو مدیر هم‌زمان نمی‌توانند یک درخواست را دو بار
   اعمال کنند (۴۰۹ `already_reviewed`). شکست هر مرحله ⇒ `rollback` کامل،
   هیچ ردیفی در `units/halls/chick_placements` نمی‌ماند.
4. **مرز نقش‌ها.** مسیرهای مشتری از `authorize("customer")` + کلید
   `customer.portal.farm[.request|.cancel]` می‌گذرند؛ مسیرهای صف با
   `portal.requests.view` / `portal.requests.review` و **بدون**
   `authorize("customer")`. هیچ مسیر موجود کارکنان باز نشده است.

## ۶) کلیدهای مجوز (۶ کلید تازه ⇒ ۱۹۷ کلید / ۱۸ گروه)

| کلید | گروه | پیش‌فرض |
|---|---|---|
| `customer.portal.farm` | `portal` | `D.customerOnly` |
| `customer.portal.farm.request` | `portal` | `D.customerOnly` |
| `customer.portal.farm.cancel` | `portal` | `D.customerOnly` |
| `portal.requests.view` | `portalRequests` (گروه تازه) | `D.all` (کارشناس هم می‌بیند) |
| `portal.requests.review` | `portalRequests` | `D.admin` |
| `admin.menu.portalRequests` | `adminMenus` | `D.admin` |

💡 «تأیید توسط کارشناس»: `review` پیش‌فرض روی مدیران است ولی از ماتریس
نقش‌ها می‌توان به نقش `expert` هم داد — بدون دادن هیچ کلید مدیریتی دیگری.

## ۷) اعتبارسنجی و سقف‌ها

- سقف **۱۰ درخواست در انتظار** برای هر پرونده (`too_many_pending`, ۴۲۹).
- سقف **۴KB** برای payload (`payload_too_large`).
- دلیل رد: **۳ تا ۳۰۰** کاراکتر (اجباری).
- «درخواست تکراری باز»: همان نوع + همان کلید طبیعی
  (نام واحد / واحد+نام سالن / سالن) ⇒ ۴۰۹ `duplicate_pending`.
- اعتبارسنجی‌های نوع‌محور: واحد (نام≥۳، آدرس≥۵، تعداد سالن ۱..۹۹،
  ظرفیت ۰..۱٬۰۰۰٬۰۰۰)، سالن (واحد الزامی، ظرفیت≤۲۰۰٬۰۰۰، سال ساخت ۱۳۰۰..۲۱۰۰)،
  جوجه‌ریزی (تاریخ/نژاد/مبدأ/وزن>۰/تعداد>۰، تراکم ۱..۱۰۰).
- ارقام فارسی در فیلدهای عددی تبدیل می‌شوند؛ در متن آزاد (آدرس/توضیح)
  دست‌نخورده می‌مانند.

## ۸) اعمال درخواست — قواعد هر نوع

- **واحد**: یکتایی `(customer_id, unit_name)` ⇒ ۴۰۹؛ `address`/`manager_name`/
  `manager_phone` اگر در درخواست نبود از پروندهٔ مشتری پر می‌شود؛ سپس
  `validateUnitData` روی دادهٔ نهایی (دفاع لایه‌دوم).
- **سالن**: واحد باید مال خودم باشد؛ شماره/ترتیب مثل `hallController`
  خودکار می‌شود (یا `hall_number` می‌آید و تکراری نباشد)؛ `units.hall_count`
  همگام می‌شود.
- **جوجه‌ریزی**: سالن مال خودم و متعلق به همان واحد؛ سالن نباید جوجه‌ریزی
  فعال داشته باشد (`hall_busy`، ۴۰۹)؛ گله از `services/flockResolver` حل
  می‌شود — **همان** منبعی که ماژول کارشناسان استفاده می‌کند (استخراج‌شده در
  همین موج تا دو نسخه نشود).

## ۹) فایل‌های این موج

**بک‌اند (تازه):** `models/PortalRequest.js` ·
`migrations/20261110000000-create-portal-requests.js` ·
`services/portalRequestRules.js` · `services/portalRequestService.js` ·
`services/flockResolver.js` · `controllers/portalFarmController.js` ·
`controllers/portalRequestAdminController.js` · `routes/portalRequestRoutes.js` ·
`portal-request-test.mjs`

**بک‌اند (تغییر):** `routes/portalRoutes.js` (چهار مسیر `/farm/*`) ·
`server.js` (mount `/api/portal-requests`) · `config/permissions.js`
(۶ کلید + ۱ گروه) · `permissions-test.mjs` (۱۹۱⇒۱۹۷ / ۱۷⇒۱۸) ·
`scripts/verify-db.js` (جدول/ستون/۳ ایندکس) · `controllers/portalController.js`
(`sections.farm` + `features.farm_*`) · `controllers/chickPlacementController.js`
(حذف نسخهٔ محلی حل گله) · `package.json`

**فرانت (تازه):** `features/portal/portal.farm.js` ·
`features/portal/portal.farm.renderer.js` · `features/portal-requests/`
(`portal-requests.api.js` · `portal-requests.manager.js` ·
`portal-requests.renderer.js` · `portal-requests.css`)

**فرانت (تغییر):** `features/portal/portal.api.js` (۴ متد + آینهٔ کلاینتی) ·
`features/portal/portal.service.js` (ثبت تب + دو mixin) ·
`pages/portal.html` (تب/پنل) · `features/portal/portal.css` ·
`core/constants/api.const.js` (۹ اندپوینت) · `pages/admin-panel.html`
(منو/بخش/مودال) · `features/admin-panel/admin-panel.service.js`
(سابقهٔ منو + سیم‌کشی دینامیک)

## ۱۰) تست و گیت

| تست | چه چیزی را می‌سنجد |
|---|---|
| `Backend/portal-request-test.mjs` (`npm run test:portal-requests`) — **۳۷ بررسی** | فهرست سفید، اعتبارسنجی سه نوع، سقف‌ها، گذارهای وضعیت، نمای خروجی، استخراج `flockResolver` |
| `Frontend/customer-portal-guard-test.mjs` — بخش **۱۷** | نبود نوشتن مستقیم، `customer_id` فقط از توکن، تراکنش/قفل، مرز نقش‌ها، سیم‌کشی UI، مستندات |
| `Backend/permissions-test.mjs` | ۱۹۷ کلید / ۱۸ گروه + پیش‌فرض کلیدهای تازه |

## ۱۱) نکات پیاده‌سازی (برای موج‌های بعد)

1. **Express 5**: هرگز `req.query = …` ننویس (فقط getter) — قاعدهٔ ۱۳.۱۰.۱
   همچنان با گارد سنجیده می‌شود.
2. **بدون تگ فرم** در HTML پورتال: ثبت با دکمهٔ `type="button"` و JS
   (گارد هم HTML و هم رندرر را می‌سنجد).
3. اگر روزی «ویرایش/حذف» هم لازم شد، **نوع تازه** اضافه کنید
   (`unit_update`…) و همان مسیر اعمال تراکنشی را گسترش دهید؛ مسیر نوشتن
   مستقیم برای مشتری باز نکنید.
4. اگر سقف‌ها عوض شد: فقط `services/portalRequestRules.js` و
   `portal.api.js` (آینهٔ کلاینتی) + این سند را به‌روز کنید.
5. **الگوی تکرارشدنی**: برای هر قابلیت «مشتری می‌خواهد، کارشناس تأیید
   می‌کند» فقط یک نوع تازه در `REQUEST_TYPES` + یک `apply*Create` اضافه
   کنید؛ مسیرها، مجوزها و UI صف بدون تغییر باقی می‌مانند.


