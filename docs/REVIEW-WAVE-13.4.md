# موج ۱۳.۴ — جزئیات هفته/بازدید، پیوست و نمودار پورتال

> پیش‌نیاز: موج ۱۳.۲ (پورتال خواندنی) و ۱۳.۳ (تب‌های دادهٔ کامل)
> دامنه: باز کردن «متن گزارش بازدید + پیوست‌ها» و «جزئیات هفتهٔ مدیریتی» برای
> مشتری متصل، به‌همراه یک نمودار سبک. **صفر مایگریشن، صفر تغییر در مسیرهای
> کارکنان، صفر درخواست نوشتنی.**

---

## ۱) ریشهٔ مسئله

در پایان ۱۳.۳ پورتال فقط «فهرست» نشان می‌داد و سه چیز عمداً بسته مانده بود:

1. **متن گزارش کارشناس** و **پیوست‌های بازدید** (حساس‌ترین دادهٔ پرونده).
2. **جزئیات هفتهٔ مدیریتی**: بیماری‌ها، واکسن‌ها، داروها و نوع دان مصرفی —
   فهرست فقط وزن/تلفات/دان را داشت.
3. **نمای روند**: مشتری عدد خام هفته‌ها را می‌دید، ولی روند را نمی‌دید.

هیچ‌یک از این‌ها با «باز کردن مسیر کارکنان» قابل حل نبود (نقش `customer` به
هیچ GET موجودی اضافه نشده و نمی‌شود). راه‌حل: همان روتر اختصاصی پورتال.

---

## ۲) تصمیم‌های طراحی

| # | تصمیم | دلیل |
|---|---|---|
| ۱ | **کلید مجوز جدا** `customer.portal.visit.report` | متن گزارش و فایل پیوست حساس‌اند؛ مدیر باید بتواند فقط این را ببندد بی‌آنکه کل پورتال بسته شود. کاتالوگ ۱۶۸ → **۱۶۹** کلید (گروه‌ها همان ۱۷). |
| ۲ | شناسهٔ «ردیف خودم» (`:id`) در مسیر مجاز شد | جایگزینش (آوردن همهٔ پیوست‌ها در `/portal/me`) پاسخ را چند برابر می‌کرد. مهار: `WHERE { id, customer_id }` در همان کوئری + پاسخ **۴۰۴** برای ردیف غیرخودی (نه ۴۰۳، تا وجود ردیف لو نرود) + `ROW_ID_PATTERN` در دو طرف. |
| ۳ | جدول‌های فرزند از «والدِ تأییدشده» خوانده می‌شوند | `customer_id` در `weekly_diseases`/`weekly_vaccines`/`weekly_medicines`/`weekly_feeds` و `visit_report_attachments` **null‌پذیر** است و ردیف‌های قدیمی آن را خالی دارند؛ فیلتر روی فرزند باعث گم‌شدن دادهٔ معتبر می‌شد. |
| ۴ | پیوست با **کلید خارجی همان بازدید** خوانده می‌شود | `{ id: attachmentId, visit_report_id: visitId }` ⇒ نمی‌توان پیوست بازدید دیگری را با دستکاری شناسه گرفت. |
| ۵ | مسیر فایل با `path.resolve` + پیشوند `uploads/` مهار می‌شود | ضد `../` (path traversal). بیرون از ریشه ⇒ ۴۰۳ + لاگ. |
| ۶ | نمودار **SVG دست‌ساز**، نه کتابخانه | صفر وابستگی تازه، صفر وزن اضافه، و ورودی همان دادهٔ صفحه (صفر اندپوینت تازه). |
| ۷ | گیت UI متن گزارش با `permissionService.can` | تجربهٔ کاربر؛ **سرور مستقل از آن ۴۰۳ می‌دهد** (fail-open در نبود دادهٔ مجوز). |
| ۸ | عمداً بیرون نرفت: `file_path`, `created_by`, نام/شناسهٔ کارشناس، `additional_notes` هفته، `forward_to`, پیشنهادهای کارشناس | دادهٔ داخلی کارشناس است، نه دادهٔ مشتری. |

---

## ۳) تغییرات بک‌اند

| فایل | تغییر |
|---|---|
| `Backend/config/permissions.js` | آیتم `customer.portal.visit.report` («مشاهدهٔ متن گزارش بازدید و پیوست‌ها») با `D.customerOnly` در گروه `PORTAL` |
| `Backend/controllers/portalController.js` | کمکی‌های `ROW_ID_PATTERN`/`parseRowId`, `scopedHallNames`, `catalogNames`, `nameList`, `idsOf`, `resolveUploadPath` + نماهای `weekDetailView`/`weekFullView`/`attachmentView`/`visitReportView`/`visitListView` + سه کنترلر تازه |
| `Backend/routes/portalRoutes.js` | `visitReportChain = [...customerChain, requirePermission("customer.portal.visit.report")]` + سه GET |
| `Backend/permissions-test.mjs` | شمارش کاتالوگ ۱۶۸ → **۱۶۹** |

### نقشهٔ مسیرها (همه GET، همه پشت `protect`)

| مسیر | زنجیره | کلید مجوز |
|---|---|---|
| `GET /api/portal/me` | `customerChain` | `customer.portal.view` |
| `GET /api/portal/halls` | `customerChain` | `customer.portal.view` |
| `GET /api/portal/flocks` | `customerChain` | `customer.portal.view` |
| `GET /api/portal/weeks` | `customerChain` | `customer.portal.view` |
| `GET /api/portal/visits` | `customerChain` | `customer.portal.view` |
| `GET /api/portal/weeks/:id` | `customerChain` | `customer.portal.view` |
| `GET /api/portal/visits/:id` | `visitReportChain` | `customer.portal.view` + `customer.portal.visit.report` |
| `GET /api/portal/visits/:id/attachments/:attachmentId` | `visitReportChain` | `customer.portal.view` + `customer.portal.visit.report` |

`customerChain = [authorize("customer"), requirePermission("customer.portal.view"), requireCustomerLink]`
(به‌علاوهٔ `router.use(protect)` در ابتدای روتر)

### قرارداد پاسخ جزئیات هفته

```jsonc
{ "success": true, "data": {
  "week": {
    "id": 42, "week_number": 4,
    "week_start_date": "2025-11-01", "week_end_date": "2025-11-07",
    "flock_age_days": 28, "weekly_weight": 1234.5,
    "weekly_mortality": 12, "weekly_feed_intake": 980,
    "hall_name": "سالن ۲",
    "diseases":  [{ "id": 3, "name": "..." }],
    "vaccines":  [{ "id": 7, "name": "..." }],
    "medicines": [{ "id": 1, "name": "..." }],
    "feeds":     [{ "id": 2, "name": "..." }]
  },
  "meta": { "scope": "self", "generated_at": "..." }
}}
```

### قرارداد پاسخ جزئیات بازدید

```jsonc
{ "success": true, "data": {
  "visit": {
    "id": 5, "visit_date": "2025-10-20", "status": "read",
    "report_text": "…", "hall_names": ["سالن ۲"]
  },
  "attachments": [
    { "id": 9, "file_name": "report.pdf", "file_size": 20480, "mime_type": "application/pdf" }
  ],
  "meta": { "scope": "self", "generated_at": "..." }
}}
```

⚠️ `file_path` هرگز در پاسخ نمی‌آید؛ دانلود از مسیر
`/api/portal/visits/:id/attachments/:attachmentId` با هدر `Authorization` انجام
می‌شود و `Content-Disposition` نام اصلی فایل را برمی‌گرداند.

---

## ۴) تغییرات فرانت‌اند

| فایل | تغییر |
|---|---|
| `core/constants/api.const.js` | `PORTAL.WEEK_DETAIL(id)`, `PORTAL.VISIT_DETAIL(id)`, `PORTAL.VISIT_ATTACHMENT(visitId, attachmentId)` |
| `core/services/api.service.js` | متد `download(endpoint, fallbackName)` — `fetch` با `getFormDataHeaders()` ⇒ blob ⇒ `<a download>` ⇒ `revokeObjectURL`؛ ۴۰۱/۴۰۳ مثل `request()` مدیریت می‌شوند. `fileNameFromDisposition` برای UTF-8/RFC 5987. |
| `features/portal/portal.api.js` | `getWeekDetail` / `getVisitDetail` / `downloadAttachment` + `rowId()` با `ROW_ID_PATTERN = /^\d{1,9}$/` (شناسه فقط از پاسخ فهرست می‌آید) |
| `features/portal/portal.renderer.js` | `detailButton`, `renderWeekDetail`, `renderVisitDetail`, `renderAttachments`, `renderWeeklyChart` + `detailRow`/`nameChips`/`readableSize`؛ ردیف بازدید `has_report`/`attachment_count` را نشان می‌دهد |
| `features/portal/portal.service.js` | `bindDetail()` (delegation)، `openDetail`/`closeDetail` (Esc + پس‌زمینه + ×)، `downloadAttachment`، `canViewReport()`، `sectionOptions()`، `renderChart()` |
| `pages/portal.html` | `#portalChart` در تب هفته‌ها، پنل `#portalDetail`/`#portalDetailBody`، `<script permission.service.js>` |
| `features/portal/portal.css` | کلاس‌های `portal-row__open`, `portal-chip`, `portal-detail__*`, `portal-attachments__*`, `portal-chart__*` (ریسپانسیو؛ در موبایل تمام‌عرض) |

> **رفع باگ جانبی:** یک آکولاد اضافی (`}`) در انتهای `portal.css` از ویرایش قبلی
> مانده بود و ساختار فایل را نامتوازن می‌کرد — حذف شد.


---

## ۵) تست و اعتبارسنجی

### گارد ایستا — `Frontend/customer-portal-guard-test.mjs`
بخش تازهٔ «۱۱) موج ۱۳.۴» با ۱۷ بررسی:

- سه کنترلر جزئیات/دانلود در `module.exports`
- مهار مسیر فایل (`UPLOADS_ROOT`, `path.resolve`, `startsWith(rootPrefix)`, `fs.existsSync`, `res.download`)
- پیوست با `{ id, visit_report_id }` (نه فقط `id`)
- نبود `file_path`/`created_by`/`service_expert_id`/`additional_notes` در خروجی
- `visitListView` متن گزارش را برنمی‌گرداند
- `visitReportChain` = `[...customerChain, requirePermission("customer.portal.visit.report")]`
- کلید تازه فقط پیش‌فرض مشتری دارد
- ثابت‌های API، `ROW_ID_PATTERN`, `apiService.download`
- نبود هیچ `apiService.post|put|patch|delete` در لایهٔ پورتال
- رندرر: سه تابع صادرشده + نمودار فقط `<svg>` (بدون chart.js/d3/…)
- HTML: `#portalDetail`, `#portalDetailBody`, `#portalChart`, `data-portal-close`
- سرویس: `openDetail`/`closeDetail`/Esc/`bindDetail`
- گیت UI با کلید `customer.portal.visit.report`
- وجود و کامل‌بودن همین سند

به‌روزرسانی‌های اجباری در بررسی‌های قبلی:
`router.get(` از ۵ → **۸** · `...customerChain,` از ۵ → **۶** ·
عبارت «`!req.params`» با «فقط `req.params.id`/`req.params.attachmentId`» جایگزین شد ·
شمارش کاتالوگ **۱۶۹** · بررسی مالکیت (≥۳ کوئری با `id` + `customer_id`).

---

## ۶) نکات باقی‌مانده (موج بعد)

1. **کلیدهای ریز سطری** (`customer.portal.weeks`, `customer.portal.visits`,
   `customer.portal.download`) تا مدیر بتواند هر بخش را جدا ببندد.
2. **ثبت‌نام عمومی و صف تأیید** — بدون آن، حساب مشتری فقط با
   `users.customer.link` دستی ساخته می‌شود.
3. **PWA**: نصب‌پذیری + کش پوستهٔ پورتال (بدون کش دادهٔ شخصی).
4. **backfill** ردیف‌های قدیمی `activity_logs.customer_id` (بدهی موج ۱۲.۵).

