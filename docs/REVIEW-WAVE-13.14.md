# بازبینی موج ۱۳.۱۴ — مدیریت دوره و اطلاعات هفتگی از پورتال

> ادامهٔ مستقیم ۱۳.۱۳: پورتال حالا **۱۸ نوع درخواست** دارد و نوشتن همهٔ
> آن‌ها از یک هستهٔ مشترک (`services/farm/*`) داخل تراکنش تأیید انجام می‌شود.

---

## ۱) مسئله

پس از ۱۳.۱۳ مشتری می‌توانست واحد/سالن/جزئیات سالن را ویرایش کند، ولی
**دوره (جوجه‌ریزی)** و **اعداد هفتگی** — که مهم‌ترین دادهٔ عملیاتی مزرعه‌اند —
فقط از پنل کارشناس قابل ثبت بود. نتیجه: دادهٔ هفتگی یا دیر می‌رسید یا هرگز
ثبت نمی‌شد و کارشناس مجبور بود اعداد را از مشتری تلفنی بگیرد.

## ۲) هفت نوع تازه

| نوع | برچسب | کلیدهای سفید payload |
|---|---|---|
| `placement_update` | ویرایش جوجه‌ریزی | `placement_id`, `placement_date`, `flock_number`, `chick_source_id`, `breed_id`, `chick_age_on_arrival`, `avg_initial_weight`, `total_chicks_count`, `placement_density`, `note` |
| `placement_delete` | حذف جوجه‌ریزی | `placement_id`, `note` |
| `placement_activate` | فعال‌سازی دوره | `placement_id`, `note` |
| `placement_deactivate` | پایان دوره | `placement_id`, `note` |
| `weekly_create` | ثبت هفته | `chick_placement_id`, `week_start_date`, `week_end_date`, `week_number`, `flock_age_days`, `daily_feed_intake`, `weekly_feed_intake`, `weekly_weight`, `weekly_mortality`, `blackout_hours`, `additional_notes`, `disease_ids[]`, `vaccine_ids[]`, `medicine_ids[]`, `feed_type_ids[]`, `suggestion_ids[]`, `note` |
| `weekly_update` | ویرایش هفته | `weekly_id` + همان فیلدهای اختیاری هفته + پنج آرایهٔ شناسه |
| `weekly_delete` | حذف هفته | `weekly_id`, `note` |

### تفاوت‌های عمدی با فرم کارشناس

| مورد | چرا |
|---|---|
| `unit_id` / `hall_id` / `customer_id` در payload نیست | از ردیف دوره مشتق می‌شود؛ مشتری نمی‌تواند هفته را به سالن/واحد دیگری بچسباند |
| `service_expert_id` نیست | تخصیص کارشناس تصمیم کارشناس است |
| `status` / `is_active` نیست | فعال/غیرفعال‌کردن هفته و دوره از نوع‌های `placement_activate/deactivate` می‌گذرد |
| `placement_delete` و `weekly_delete` در `DESTRUCTIVE_TYPES` | حذف دوره، هفته‌ها و آیتم‌های وابسته را می‌برد ⇒ هشدار قرمز در مودال بازبینی |
| پایان/فعال‌سازی دوره فقط با نوع اختصاصی | تا کارشناس بداند نتیجه «تعویض دورهٔ فعال» است، نه یک ویرایش ساده |

## ۳) قواعد (یک منبع)

- `placement_update` → همان `validateChickPlacement` با placeholder برای
  فیلدهای اجباریِ نیامده (فقط فیلدهای ارسالی سنجیده می‌شوند) + بازهٔ تراکم.
- `weekly_create` / `weekly_update` → همان `validations/weeklyValidation.validateWeeklyData`
  (قاعدهٔ «دان هفتگی ≈ ۷× روزانه»، بازهٔ وزن، تلفات غیرمنفی و ترتیب تاریخ‌ها
  بدون نسخهٔ دوم).
- آرایه‌های شناسه: `WEEKLY_ID_FIELDS` + `sanitizeIdList` (عدد مثبت، حذف
  تکراری، سقف ۱۰۰) — مجزا از آرایهٔ آبجکتی `items` در ۱۳.۱۳.
- «هیچ تغییری ارسال نشده» برای ویرایش‌ها خطای روشن می‌دهد.
- `duplicateKeyOf`: هفته = (دوره، شمارهٔ هفته)؛ دوره = `placement_id`.

## ۴) لایهٔ اعمال

| نوع | مسیر | یادداشت |
|---|---|---|
| `placement_update` | `placementWrite.updatePlacement` | فقط فیلدهای `PLACEMENT_PORTAL_FIELDS` |
| `placement_delete` | `placementWrite.deletePlacement` | حذف نرم (`deletedAt`) |
| `placement_activate` | `placementWrite.activatePlacement` | اگر از قبل فعال باشد ⇒ ۴۰۹ `placement_already_active` |
| `placement_deactivate` | `placementWrite.deactivatePlacement` | اگر از قبل غیرفعال باشد ⇒ ۴۰۹ |
| `weekly_create` | `weeklyWrite.createWeekly` | `hall_id/unit_id/customer_id` از ردیف دوره |
| `weekly_update` | `weeklyWrite.updateWeekly` | آرایه‌ها فقط اگر کلیدشان ارسال شده جایگزین می‌شوند |
| `weekly_delete` | `weeklyWrite.deleteWeekly` | همراه پنج گروه آیتم |

- مالکیت با `requireOwnedPlacement` / `requireOwnedWeekly` و **قفل ردیف**
  داخل همان تراکنش تأیید؛ ردیف غیرخودی ⇒ ۴۰۴.
- دورهٔ غیرفعال ⇒ خطای `flock_inactive` با پیام روشن (هم‌راستا با قاعدهٔ
  `checkFlockIsActive` خود ماژول هفتگی).
- خطاهای فارسی هستهٔ هفتگی به کدهای `week_duplicate` (۴۰۹) و `week_order`
  و `flock_inactive` نگاشت می‌شوند.

## ۵) خواندن برای فرم‌ها

- `GET /api/portal/farm/options`:
  - `placements[]`: `id`, `unit_id`, `hall_id`, `placement_date`,
    `flock_number`, `total_chicks_count`, `is_active` (فعال‌ها اول).
  - `dictionaries`: افزودن `diseases`, `vaccines`, `medicines`,
    `feed_types`, `suggestion_types`.
- اندپوینت تازه: `GET /api/portal/farm/placements/:id`
  = دوره + فهرست هفته‌های ثبت‌شده، با
  `requireOwnedRow({ model: ChickPlacement, label: "دوره" })` ⇒ ۴۰۴ برای غیرخودی.

## ۶) پنل کارشناس

برچسب هفت نوع تازه، برچسب کلیدهای هفتگی/آیتم‌ها، و افزودن چهار نوع حذفی به
`DESTRUCTIVE_TYPE_KEYS`. پنج آرایهٔ شناسه به `LIST_PAYLOAD_KEYS` اضافه شدند
تا در گرید ویرایش پیش از تأیید به‌صورت «N مورد» نمایش داده شوند (نه ورودی
متنی که آرایه را خراب کند).

## ۷) مجوزها

**بدون کلید تازه**: همهٔ نوشتن‌ها زیر `customer.portal.farm.request` و
خواندن‌ها زیر `customer.portal.farm` ⇒ شمارش ۱۹۷ کلید / ۱۸ گروه دست‌نخورده.

## ۸) تست‌ها

| فایل | قبل | بعد | چه چیزی اضافه شد |
|---|---|---|---|
| `Backend/portal-request-test.mjs` | ۵۶ | **۷۰** | فهرست ۱۸ نوع، اعتبارسنج دوره/هفته، آرایهٔ شناسه (تکرار/نامعتبر/سقف)، نبود کلیدهای کارشناسی در فهرست سفید، نگاشت کدهای خطا، مالکیت داخل تراکنش، applier هر نوع، گزینه‌های فرم، مسیر تازه، هم‌خوانی با `validateWeeklyData` |
| `Frontend/customer-portal-guard-test.mjs` | ۱۹۰ | **۱۹۹** | بخش ۱۳.۱۴ (۹ بررسی): قواعد، آیتم‌های آرایه‌ای، یک منبع نوشتن، مالکیت، مسیر `/farm/placements/:id`، دیکشنری‌ها، برچسب‌های صف، مستندات |
| `Frontend/portal-requests-admin-guard-test.mjs` | ۳۰ | ۳۰ | بررسی هشدار حذف به حالت فهرست چهارتایی به‌روزرسانی شد |

## ۹) ریسک‌ها

| ریسک | کاهش |
|---|---|
| ثبت هفته برای دورهٔ غیرفعال | `flock_inactive` پیش از نوشتن (داخل تراکنش) |
| هفته/دورهٔ مشتری دیگر | `requireOwnedPlacement`/`requireOwnedWeekly` با `FOR UPDATE` ⇒ ۴۰۴ |
| ترتیب/تکرار هفته | همان قاعدهٔ کارشناس (`checkWeekOrder`/`checkDuplicateWeek`) با پیام فارسی |
| حذف دوره با هفته‌های ثبت‌شده | هشدار قرمز در مودال بازبینی + خلاصهٔ فارسی در تاریخچه |
| بزرگ‌شدن payload با آرایه‌ها | `sanitizeIdList` (سقف ۱۰۰ شناسه در هر گروه) + سقف ۸KB |

**بازگشت:** حذف هفت نوع از `REQUEST_TYPES` کافی است؛ هیچ مهاجرت یا ستون
تازه‌ای لازم نیست.

## ۱۰) گام بعدی

- رابط کاربری پورتال برای ۱۵ نوع تازهٔ ۱۳.۱۳ و ۱۳.۱۴ (فرم‌ها با همان
  ترتیب/برچسب پنل کارشناس) + آینهٔ `portal.api.js`.
- در صورت نیاز: «حذف کل گله/دوره» (`flock_delete`) و پیوست‌های هفتگی.
