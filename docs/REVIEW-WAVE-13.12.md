# موج ۱۳.۱۲ — هستهٔ نوشتن مشترک فارم (کارشناس + پورتال)

> وضعیت: ✅ پیاده‌سازی‌شده و تست‌شده · پیش‌نیاز: موج ۱۳.۱۱
> گیت: `GATE-PASS` با ۴۵ گام (شامل گام تازهٔ `test:farm-write`)

## ۱) مسئله

تا پایان ۱۳.۱۱، مسیر پورتال فقط **سه** نوع درخواست را می‌شناخت
(`unit_create` · `hall_create` · `placement_create`) و برای همین سه نوع،
منطق نوشتن **دو نسخه** داشت:

| مسیر | کجا |
|---|---|
| کارشناس | `controllers/unitController.js` · `hallController.js` · `chickPlacementController.js` (+ چهار کنترلر جزئیات سالن و `weeklyController`) |
| تأیید درخواست مشتری | `services/portalRequestService.js` (`applyUnitCreate` / `applyHallCreate` / `applyPlacementCreate`) |

برای سه نوع اول، این دو نسخه با تست هم‌تراز نگه داشته می‌شدند؛ ولی قرار است
۱۴ نوع تازه (ویرایش/حذف واحد و سالن، اطلاعات فیزیکی، سیستم‌ها، آب/دان،
بهداشت، مدیریت جوجه‌ریزی و کل چرخهٔ هفتگی) اضافه شود. با نسخهٔ دوم برای
هر نوع، دو خطر جدی می‌شد:

1. **واگرایی قاعده**: مثلاً «شمارهٔ خودکار سالن» یا «قاعدهٔ ترتیب هفته‌ها»
   در یکی از دو مسیر تغییر کند و دیگری عقب بماند.
2. **اختلاف رفتار قابل کشف نبودن**: مشتری چیزی می‌فرستد که کارشناس
   می‌تواند ثبت کند، ولی مسیر تأیید ردش می‌کند (یا برعکس).

## ۲) گزینه‌ها

| گزینه | چه می‌شد | تصمیم |
|---|---|---|
| الف) کپی منطق در لایهٔ پورتال | هر نوع درخواست یک نسخهٔ دوم از قواعد | ❌ دو منبع حقیقت، واگرایی قطعی |
| ب) انتقال منطق نوشتن به `services/farm/*` و نازک‌کردن کنترلرها | یک تابع، دو مصرف‌کننده | ✅ انتخاب شد |
| ج) فقط صدا زدن HTTP کنترلر کارشناس از لایهٔ پورتال | دوباره‌کاری شبکه/احراز هویت، خطاهای تودرتو | ❌ شکننده و غیرقابل تست |

## ۳) فایل‌های تازه

| فایل | نقش |
|---|---|
| `services/farm/writeErrors.js` | `FarmWriteError` + `fail`/`failValidation`/`throwIfUnique`/`httpErrorOf` — **یک** شکل خطا |
| `services/farm/transaction.js` | `runInTransaction(work, existingTx)` + `safeRollback` — «همان تراکنش اگر داده شده، تراکنش تازه اگر نه» |
| `services/farm/httpBridge.js` | `sendFarmError(res, error, fallback)` — نگاشت خطای سرویس به پاسخ HTTP |
| `services/farm/unitWrite.js` | ایجاد/ویرایش/حذف واحد + نام خودکار سالن‌ها + حذف آبشاری |
| `services/farm/hallWrite.js` | ایجاد/ویرایش/حذف سالن + شماره/ترتیب خودکار + همگام‌سازی `units.hall_count` |
| `services/farm/hallDetailsWrite.js` | چهار upsert: فیزیکی · سیستم‌ها (+ردیف تجهیزات) · آب/دان · بهداشت |
| `services/farm/placementWrite.js` | ایجاد/ویرایش/حذف/فعال‌سازی/پایان دوره + حذف گله (گله از `flockResolver`) |
| `services/farm/weeklyWrite.js` | ایجاد/ویرایش/حذف هفته + قواعد تکرار/ترتیب + شش جدول در یک تراکنش |
| `validations/hallDetailValidation.js` | اعتبارسنجی **خالص** چهار حوزهٔ جزئیات سالن + فهرست‌های سفید |

## ۴) چه چیزی از کجا به کجا رفت

| مبدأ (کنترلر) | مقصد | خروجی سرویس |
|---|---|---|
| `unitController.createUnit/updateUnit/deleteUnit` | `unitWrite` | `{ unit, customer }` · `{ unit, renamedHalls, unitNameChanged }` · `{ unitId }` |
| `hallController.createHall/updateHall/deleteHall` (+ `syncUnitHallCount`) | `hallWrite` | `{ hall, unit, customer }` · `{ hall, prevUnitId }` · `{ hall, unitId }` |
| `hallPhysicalInfoController.createOrUpdatePhysicalInfo` | `hallDetailsWrite.savePhysicalInfo` | `{ record, created }` |
| `hallSystemController.createOrUpdateSystem` | `hallDetailsWrite.saveSystem` | `{ record, created }` |
| `hallWaterFeedController.createOrUpdateWaterFeed` | `hallDetailsWrite.saveWaterFeed` | `{ record, created }` |
| `hallHygieneController.createOrUpdateHygiene` | `hallDetailsWrite.saveHygiene` | `{ record, created }` |
| `chickPlacementController.create/update/delete/activate/deactivate/deleteFlockGroup` | `placementWrite` | `{ placement, flock }` · `{ placement }` · `{ flock, removedPlacements }` … |
| `weeklyController.create/update/delete` + چهار تابع کمکی | `weeklyWrite` | `{ record }` (شکل خروجی قبلی: شناسه‌ها به آرایه) |

همهٔ توابع خواندن (لیست/جزئیات/گزارش) **دست‌نخورده** در کنترلرها ماندند.


## ۵) قواعد تغییرناپذیر (رفتار قبلی حفظ شد)

| قاعده | قبل | بعد |
|---|---|---|
| پیام‌های فارسی خطا | در کنترلر | **همان متن**، در سرویس (`FarmWriteError`) |
| کد وضعیت | ۴۰۰/۴۰۴/۵۰۰ | همان (خطای ناشناخته ⇒ ۵۰۰ با `error.message`) |
| تراکنش | کنترلر می‌ساخت | سرویس می‌سازد؛ اگر فراخوان تراکنش بدهد، **مرز مال اوست** |
| `hall_count` واحد | بعد از هر تغییر سالن | همان، با `paranoid: true` (حذف‌شده‌ها شمرده نمی‌شوند) |
| نام سالن‌ها با تغییر نام واحد | `سالن A/B/C - <نام>` | همان (`autoHallName` صادر و تست شده) |
| شماره/ترتیب سالن | `MAX + 1` | همان (`nextHallNumber` / `nextHallOrder`) |
| حذف واحد | آبشاری کامل (بازدید/نشان/هفتگی/گله/تجهیزات) | همان ترتیب و همان جدول‌ها |
| یک جوجه‌ریزی فعال در هر سالن | خطای ۴۰۰ | همان پیام |
| ترتیب هفته‌ها | هفته `n` بعد از `n-1` | همان (`checkWeekOrder`) |
| هفتهٔ تکراری | خطای ۴۰۰ | همان (`checkDuplicateWeek`) |
| خروجی هفته | رکورد + `disease_ids/...` | همان (`formatWeeklyRecord`) |
| قلاب‌های تست | `TEST_FAIL_PLACEMENT` · `TEST_FAIL_WEEKLY` | همان‌ها، در سرویس (فقط خارج از production) |

### تفاوت‌های عمدی و کوچک (بهبود، نه تغییر رفتار کاربر)

1. **نشتی تراکنش رفع شد**: در نسخهٔ قبلی `createUnit` تراکنش را قبل از
   اعتبارسنجی باز می‌کرد و در مسیر «نامعتبر» بدون `rollback` برمی‌گشت
   (اتصال باز می‌ماند). اکنون اعتبارسنجی **قبل** از تراکنش است.
2. **فهرست سفید ویرایش سالن**: قبلاً `hall.update(req.body)` خام بود؛ اکنون
   فقط ستون‌های مدل `Hall` نوشته می‌شوند (`HALL_UPDATE_FIELDS`). شیءهای
   تودرتوی `unit`/`customer` که از `include` برمی‌گردند دیگر هرگز نوشته نمی‌شوند.
3. **`hall_id` ناموجود در جزئیات سالن**: پیام «شناسه سالن الزامی است» (۴۰۰)
   از سرویس می‌آید؛ قبلاً هم همان بود، ولی اکنون **قبل** از باز شدن تراکنش.
4. **`customer_id` بهداشت سالن**: اگر در بدنه نباشد از خود ردیف سالن
   تکمیل می‌شود (ستون اجباری است و پیش‌تر ممکن بود ۵۰۰ بدهد).

## ۶) سطح عمومی سرویس‌ها

```js
unitWrite.createUnit(body)               // → { unit, customer }
unitWrite.updateUnit(unitId, body)       // → { unit, renamedHalls, unitNameChanged }
unitWrite.deleteUnit(unitId)             // → { unitId }

hallWrite.createHall(body)               // → { hall, unit, customer }
hallWrite.updateHall(hallId, body)       // → { hall, prevUnitId }
hallWrite.deleteHall(hallId)             // → { hall, unitId }
hallWrite.syncUnitHallCount(unitId)      // هرگز پرتاب نمی‌کند (فقط هشدار)

hallDetailsWrite.savePhysicalInfo(body)  // → { record, created }
hallDetailsWrite.saveSystem(body)        // → { record, created }  (record شامل items)
hallDetailsWrite.saveWaterFeed(body)     // → { record, created }
hallDetailsWrite.saveHygiene(body)       // → { record, created }

placementWrite.createPlacement(body)     // → { placement, flock, hall, unit }
placementWrite.updatePlacement(id, body) // → { placement }
placementWrite.deletePlacement(id)       // → { placement }
placementWrite.deleteFlockGroup(id)      // → { flock, removedPlacements }
placementWrite.activatePlacement(id)     // → { placement, deactivatedCount }
placementWrite.deactivatePlacement(id)   // → { placement }

weeklyWrite.createWeekly(body)           // → { record, id }
weeklyWrite.updateWeekly(id, body)       // → { record }
weeklyWrite.deleteWeekly(id)             // → { record }
```

همهٔ توابع نوشتن، پارامتر دوم اختیاری `{ transaction }` می‌پذیرند؛ همین
پارامتر در موج‌های ۱۳.۱۳–۱۳.۱۴ به لایهٔ اعمال درخواست پورتال داده می‌شود تا
«تأیید درخواست» و «نوشتن ردیف واقعی» در **یک** تراکنش بمانند.

> ⚠️ تصحیح (موج ۱۳.۱۳): در پایان ۱۳.۱۲ فقط `weeklyWrite.*` و
> `placementWrite.createPlacement` این پارامتر را می‌پذیرفتند.
> **همهٔ** توابع نوشتن (`unitWrite` / `hallWrite` / `hallDetailsWrite` /
> کل `placementWrite`) در گام ۰ موج ۱۳.۱۳ یکدست شدند و
> `farm-write-test` از آن پس همین را تضمین می‌کند.

## ۷) نمونهٔ نازک‌شدن کنترلر

قبل (خلاصه):

## ۸) تست‌ها

| تست | چه چیزی را قفل می‌کند | نتیجه |
|---|---|---|
| `Backend/farm-write-test.mjs` (**تازه**) | سطح عمومی پنج سرویس · شکل خطا · اعتبارسنجی چهار حوزهٔ سالن · «یک منبع» بودن کنترلرها · فهرست‌های سفید · `autoHallName`/`orderHallsForNaming`/`normalizeItems` · مرز تراکنش · `formatWeeklyRecord` | ۳۵/۳۵ |
| `Backend/portal-request-test.mjs` (به‌روزرسانی‌شده) | زنجیرهٔ `chickPlacementController → placementWrite → flockResolver` | ۳۷/۳۷ |
| `Frontend/customer-portal-guard-test.mjs` (به‌روزرسانی‌شده) | همان زنجیره + «همهٔ کنترلرهای نوشتن از `services/farm/*` می‌گذرند» | ۱۷۹/۱۷۹ |
| `Frontend/portal-requests-admin-guard-test.mjs` | صف ادمین دست‌نخورده | ۲۸/۲۸ |
| `Frontend/*-body-split-test.mjs` و `*-surface-test.mjs` | ساختار سرویس‌های فرانت (پورتال/هفتگی/سالن/جوجه‌ریزی) دست‌نخورده | همه سبز |
| `node tools/gate.mjs` | کل گیت (۴۵ گام) | `GATE-PASS` |

اجرای مستقیم:

```bash
# در Backend
npm run test:farm-write
npm run test:portal-requests
npm run lint

# در ریشه
node tools/gate.mjs
```

## ۹) ریسک‌ها و کاهش آن‌ها

| ریسک | کاهش |
|---|---|
| تغییر رفتار نامحسوس در ماژول کارشناس (پیام/کد وضعیت) | منطق **عیناً** منتقل شد (نه بازنویسی)؛ گاردهای ۴۳ تست فرانت + ۳۷ تست بک‌اند سبز ماندند |
| وابستگی کنترلر به سرویس و شکستن بارگذاری ماژول | `node --check` روی ۸ کنترلر + `eslint` (۰ خطا) + گام `lint` گیت |
| شکستن الگوی «گله از یک منبع» | گارد پورتال و تست بک‌اند به زنجیرهٔ جدید به‌روزرسانی شدند (نسخهٔ ضعیف‌تر نشد: هر سه حلقه بررسی می‌شود) |
| تفاوت تراکنش در مسیر پورتال | `runInTransaction(work, existingTx)` صریحاً تست شده که با تراکنش داده‌شده commit/rollback نمی‌کند |
| خالی شدن فایل‌ها هنگام ویرایش بزرگ | همهٔ پرونده‌ها پیش و پس از تغییر با `node --check`/`eslint` بررسی شدند؛ ابزار موقت پچ پس از پایان حذف شد |

### برنامهٔ بازگشت (اگر لازم شد)

این موج هیچ مهاجرت و هیچ تغییر داده‌ای ندارد. بازگشت = `git revert` کامیت
موج؛ تنها اثر آن بازگشت منطق نوشتن به کنترلرها است و **دادهٔ کاربران
تغییر نمی‌کند**.

## ۱۰) گام بعدی

**موج ۱۳.۱۳** — انواع تازهٔ درخواست روی همین هسته:
`hall_physical_save` · `hall_system_save` · `hall_water_feed_save` ·
`hall_hygiene_save` (با استفاده از `validations/hallDetailValidation.js` و
`hallDetailsWrite`) و سپس `unit_update`/`unit_delete`/`hall_update`/`hall_delete`.

نکتهٔ کلیدی برای ۱۳.۱۳: امضای `apply*(payload, { transaction })` سرویس‌ها
(در گام ۰ موج ۱۳.۱۳ یکدست شد) آماده است، پس لایهٔ اعمال درخواست پورتال فقط
باید `customer_id` را از رکورد درخواست بگذارد و مالکیت ردیف هدف را بررسی کند.


```js
const createHall = async (req, res) => {
  try {
    const { customer_id, unit_id, hall_name /* … */ } = req.body;
    if (!customer_id) return errorResponse(res, "شناسه مشتری الزامی است", 400);
    const customer = await CustomerPersonalInfo.findOne({ /* … */ });
    if (!customer) return errorResponse(res, "مشتری یافت نشد یا غیرفعال است", 404);
    let finalHallNumber = hall_number;
    if (!finalHallNumber) { /* MAX + 1 */ }
    const hall = await Hall.create({ /* … */ });
    await syncUnitHallCount(unit_id);
    successResponse(res, hall, "سالن با موفقیت ایجاد شد", 201);
  } catch (error) { /* … */ }
};
```

بعد:

```js
const createHall = async (req, res) => {
  try {
    const { hall } = await hallWrite.createHall(req.body);
    return successResponse(res, hall, "سالن با موفقیت ایجاد شد", 201);
  } catch (error) {
    console.error("خطا در ایجاد سالن:", error);
    return sendFarmError(res, error, "خطا در ایجاد سالن");
  }
};
```
