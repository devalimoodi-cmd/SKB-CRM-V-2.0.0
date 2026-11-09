# بازبینی موج ۱۳.۱۳ — نوشتن کامل پورتال مشتری (واحد، سالن، جزئیات سالن)

> این موج، الگوی «درخواست مشتری ← تأیید کارشناس» (موج ۱۳.۱۱) را از سه نوع
> ایجاد به **یازده نوع** گسترش می‌دهد و در همان حال، نوشتن واقعی را از
> نسخهٔ دوم داخل `portalRequestService` به **هستهٔ مشترک فارم** (موج ۱۳.۱۲)
> منتقل می‌کند.

---

## ۱) مسئله

تا ۱۳.۱۲:

- مشتری می‌توانست **واحد/سالن/جوجه‌ریزی بسازد** (درخواست + تأیید).
- ولی **ویرایش/حذف** و **اطلاعات تکمیلی سالن** (فیزیکی، سیستم‌ها، آب/دان،
  بهداشت) فقط در پنل کارشناس ممکن بود ⇒ پروندهٔ مشتری نیمه‌کاره می‌ماند و
  کارشناس باید داده‌ای را وارد می‌کرد که خود مشتری بهتر می‌دانست.
- بدتر: `portalRequestService` هنوز نسخهٔ دومِ منطق نوشتن را داشت
  (`nextHallNumber` / `nextHallOrder` / `syncUnitHallCount` /
  `Hall.create` / `ChickPlacement.create`) ⇒ هدف اصلی ۱۳.۱۲ (یک منبع)
  در مسیر پورتال محقق نشده بود.
- و توابع نوشتن هستهٔ فارم همیشه تراکنش خودشان را باز می‌کردند ⇒ «تأیید
  اتمیک چندجدولی» ممکن نبود.

## ۲) دامنهٔ این موج (هشت نوع تازه)

| نوع | برچسب | کلیدهای سفید payload |
|---|---|---|
| `unit_update` | ویرایش واحد | `unit_id`, `unit_name`, `address`, `hall_count`, `capacity`, `longitude`, `latitude`, `manager_name`, `manager_phone`, `note` |
| `unit_delete` | حذف واحد | `unit_id`, `confirm_name`, `note` |
| `hall_update` | ویرایش سالن | `hall_id`, `hall_name`, `hall_number`, `nominal_capacity`, `altitude_above_sea`, `hall_type_id`, `construction_year`, `operator_name`, `note` |
| `hall_delete` | حذف سالن | `hall_id`, `note` |
| `hall_physical_save` | اطلاعات فیزیکی | `hall_id`, `length`, `width`, `height`, `area`, `floor_type_id`, `notes`, `note` |
| `hall_system_save` | سیستم‌ها | `hall_id`, `fan_count`, `fan_size`, `fan_capacity`, `heater_count`, `heating_system_id`, `cooling_system_id`, `ventilation_system_id`, `water_inlet_system_id`, `lighting_system_id`, `notes`, **`items[]`**, `note` |
| `hall_water_feed_save` | آب‌خوری/دان‌خوری | `hall_id`, `waterer_type_id`, `feeder_type_id`, `water_lines_count`, `feed_lines_count`, `auto_feed_system`, `notes`, `note` |
| `hall_hygiene_save` | بهداشت | `hall_id`, `last_wash_date`, `last_disinfect_date`, `disinfectant_type`, `description`, `note` |

### تفاوت‌های عمدی با «فرم کارشناس»

| مورد | چرا |
|---|---|
| `unit_id` در `hall_update` و چهار حوزهٔ جزئیات **نیست** | انتقال سالن بین واحدها و «چسباندن جزئیات به واحد دیگر» عملیات کارشناس است؛ `unit_id` در لایهٔ اعمال از خود ردیف سالن پر می‌شود |
| `is_active` / `unit_status_id` در `unit_update` نیست | فعال/غیرفعال‌سازی واحد و تغییر وضعیت، تصمیم کارشناس است |
| `confirm_name` فقط در `unit_delete` | حذف واحد **آبشاری و بازگشت‌ناپذیر** است (سالن‌ها، گله‌ها، هفته‌ها، بازدیدها، نشان‌ها)؛ مشتری نام واحد را بازتایپ می‌کند و لایهٔ اعمال آن را با نام **فعلی** می‌سنجد |
| `items[]` در مودال بازبینی کارشناس فقط‌خواندنی است | ورودی متنی برای آرایه معنا ندارد؛ ویرایش ردیف‌ها فقط از فرم پورتال |

## ۳) قواعد (یک منبع: `services/portalRequestRules.js`)

- هشت نوع تازه در `REQUEST_TYPES` (با `destructive` و `target`).
- فهرست سفید چهار حوزهٔ جزئیات **از همان ماژول کارشناس** می‌آید
  (`validations/hallDetailValidation.HALL_DETAIL_FIELDS`) و فقط دو تغییر
  دارد: حذف `unit_id` و افزودن `note` (و `items` برای سیستم‌ها).
- اعتبارسنج‌ها:
  - `unit_update` → همان `validateUnitData` با پرکردن فیلدهای اجباریِ
    نیامده با مقدار خنثی ⇒ فقط فیلدهای ارسالی بررسی می‌شوند.
  - `hall_update` → `validateHallFields(payload, { requireUnit: false, requireName: false })`
    (همان تابعی که «ثبت سالن» را اعتبارسنجی می‌کند).
  - چهار حوزهٔ جزئیات → `HALL_DETAIL_VALIDATORS[type]` بدون نسخهٔ دوم.
  - «هیچ تغییری ارسال نشده» → خطای روشن (`nothing_to_change`).
- **آرایه‌ها**: `LIST_FIELDS = { hall_system_save: ["items"] }` با کلیدهای
  سفید `category/type_id/quantity/spec/size/capacity`؛ ردیف بدون دسته حذف
  می‌شود و ردیف با دستهٔ ناشناخته **به اعتبارسنج سپرده** می‌شود تا پیام
  روشن بدهد (نه برش بی‌صدا). سقف ۶۰ ردیف = همان سقف اعتبارسنج کارشناس.
- **ارقام فارسی** برای `hall_number` و `manager_phone` به لاتین نرمال
  می‌شوند (بقیهٔ متن‌های آزاد دست‌نخورده).
- سقف payload از ۴KB به **۸KB** رفت؛ چون یک `hall_system_save` با ۶۰ ردیف
  تجهیزات در ۴KB جا نمی‌شد (سقف همچنان کران‌دار است).

## ۴) لایهٔ اعمال (`services/portalRequestService.js`)

- `applyRequest` به **نقشهٔ اعمال** تبدیل شد (`APPLIERS` + `HALL_DETAIL_APPLIERS`)
  ⇒ هر نوع تازه یک applier دارد و تست بررسی می‌کند هیچ نوعی جا نیفتاده باشد.
- **مالکیت در همان تراکنش**: `requireOwnedUnit` / `requireOwnedHall` با
  `SELECT … FOR UPDATE` روی ردیف هدف؛ ردیف غیرخودی ⇒ **۴۰۴** (نه ۴۰۳).
- نوشتن واقعی از `services/farm/*` می‌آید:
  `unitWrite` (ثبت/ویرایش/حذف)، `hallWrite` (ثبت/ویرایش/حذف + شماره/ترتیب
  خودکار + همگام‌سازی `hall_count`)، `hallDetailsWrite` (چهار upsert)،
  `placementWrite` (ثبت جوجه‌ریزی + حل گله).
- کد محلیِ تکراری (`nextHallNumber`/`nextHallOrder`/`syncUnitHallCount` و
  ساخت دستی ردیف‌ها) **حذف شد**.
- خلاصهٔ فارسی نتیجه برای هر نوع نوشته می‌شود (`result_summary`) و
  `result_entity_id` = شناسهٔ واحد/سالن هدف.
- `duplicateKeyOf` برای انواع تازه هم کلید طبیعی دارد ⇒ مشتری نمی‌تواند
  چند درخواست باز روی همان ردیف بسازد.

## ۵) هستهٔ فارم: پذیرش تراکنش بیرونی (گام ۰ این موج)

همهٔ توابع نوشتن حالا پارامتر دوم/سوم `{ transaction }` را می‌پذیرند:

```
createUnit/updateUnit/deleteUnit        (unitWrite)
createHall/updateHall/deleteHall        (hallWrite)
savePhysicalInfo/saveSystem/
saveWaterFeed/saveHygiene               (hallDetailsWrite)
updatePlacement/deletePlacement/
deleteFlockGroup/activate/deactivate    (placementWrite)
```

- پیش‌فرض `null` ⇒ رفتار قبلی کنترلرهای کارشناس **بدون تغییر**.
- دو اصلاح جانبی در همین مسیر:
  - `deleteUnit` ردیف واحد را **با تراکنش** می‌خواند (قبلاً بدون تراکنش ⇒
    قفل ردیف در تراکنش بیرونی بی‌اثر بود).
  - `deleteFlockGroup` خواندن گله/جوجه‌ریزی‌ها را با همان تراکنش انجام می‌دهد.

## ۶) خواندن برای فرم‌ها

- `GET /api/portal/farm/options` گسترش یافت:
  - `units[]`: `address`, `capacity`, `manager_name`, `manager_phone`,
    `longitude`, `latitude` (پیش‌پرکردن فرم ویرایش واحد).
  - `halls[]`: `nominal_capacity`, `altitude_above_sea`, `hall_type_id`,
    `construction_year`, `operator_name` + چهار پرچم
    `has_physical/has_system/has_water_feed/has_hygiene`
    (چهار کوئری گروهی، نه N+1).
  - `dictionaries`: افزودن `floor_types`, `heating_systems`, `cooling_systems`,
    `ventilation_types`, `water_inlet_types`, `lighting_systems`,
    `waterer_types`, `feeder_types`.
- اندپوینت تازه: `GET /api/portal/farm/halls/:id`
  (سالن + چهار رکورد جزئیات + پرچم‌ها) با
  `requireOwnedRow({ model: Hall, label: "سالن" })` ⇒ سالن غیرخودی ۴۰۴.
  فقط خواندن است، پس سقف نوشتن ندارد.

## ۷) پنل کارشناس (حداقلی، ولی لازم)

بدون این بخش، انواع تازه در صف با **کلید خام** نمایش داده می‌شدند:

- `portal-requests.renderer.js`: هشت برچسب نوع + برچسب کلیدهای تازه +
  `DESTRUCTIVE_TYPE_KEYS` (هشدار قرمز در مودال بازبینی) +
  `LIST_PAYLOAD_KEYS` (آرایه‌ها ورودی متنی نمی‌گیرند و به‌جای
  `[object Object]` تعداد ردیف نمایش داده می‌شود).
- `portal-requests.css`: کلاس `.prq-warn`.
- `portalRequestAdminController.filtersMeta()` و `portalFarmController.uiMeta()`
  پرچم `destructive`/`target` را هم برمی‌گردانند.

## ۸) کلیدهای مجوز

**بدون کلید تازه**: همهٔ نوشتن‌ها زیر `customer.portal.farm.request` و
خواندن‌ها زیر `customer.portal.farm` می‌مانند ⇒ شمارش کلیدها دست‌نخورده
(۱۹۷ کلید / ۱۸ گروه) و `permissions-test` نیاز به تغییر نداشت.

## ۹) تست‌ها

| فایل | قبل | بعد | چه چیزی اضافه شد |
|---|---|---|---|
| `Backend/portal-request-test.mjs` | ۳۷ | **۵۶** | فهرست ۱۱ نوع، اعتبارسنج هر نوع، آرایه/`items`، ارقام فارسی، انواع حذف، هم‌خوانی با `HALL_DETAIL_FIELDS`، «هر نوع یک applier»، حذف کد تکراری، مالکیت/مسیر تازه، سقف ۸KB |
| `Backend/farm-write-test.mjs` | ۳۵ | **۳۹** | پذیرش `{ transaction }` در چهار سرویس، عبور آن به `runInTransaction`، خواندن ردیف هدف با تراکنش، دست‌نخورده‌ماندن رفتار پیش‌فرض |
| `Frontend/customer-portal-guard-test.mjs` | ۱۷۹ | **۱۹۰** | بخش «۱۳.۱۳» با یازده بررسی (قواعد، آرایه‌ها، یک منبع نوشتن، مالکیت، مسیر تازه، دیکشنری‌ها، برچسب‌های پنل کارشناس، تب‌های پورتال بدون فرم، مستندات) |

## ۱۰) ریسک‌ها و بازگشت

| ریسک | کاهش |
|---|---|
| شکستن مسیر کارشناس با تغییر امضای سرویس‌ها | پارامتر تراکنش **اختیاری** با پیش‌فرض `null`؛ تست ضدرفتار در `farm-write-test` |
| دو تأیید هم‌زمان روی یک ردیف | `FOR UPDATE` روی ردیف هدف + شرط `status='pending'` روی درخواست |
| حذف واحد توسط خود مشتری | `confirm_name` + هشدار قرمز در مودال + خلاصهٔ حذف در تاریخچهٔ درخواست |
| نمایش خام کلیدها به کارشناس | بخش ۷ (برچسب‌ها) بخشی از همین موج است، نه موج UI |
| بزرگ‌شدن payload | سقف ۸KB + سقف ۶۰ ردیف + فهرست سفید کلیدهای ردیف |

**بازگشت:** حذف هشت نوع از `REQUEST_TYPES` کافی است؛ درخواست‌های `pending`
قدیمی (سه نوع اول) با همان مسیر قبلی کار می‌کنند و هیچ مهاجرتی لازم نیست
(payload از قبل JSONB است).

## ۱۱) گام بعدی

- انواع «مدیریت هفته/جوجه‌ریزی» (`placement_update`, `placement_delete`,
  `placement_activate`, `placement_deactivate`, `weekly_*`).
- رابط کاربری پورتال برای هشت نوع همین موج (فرم‌ها با همان ترتیب/برچسب
  پنل کارشناس، در پوستهٔ پورتال).

