# موج ۱۳.۱۰ — «مدارک من»: آپلود/دانلود/حذف نرم مدارک مشتری از پورتال

> پیش‌نیاز: موج ۱۳.۹ (PWA) و زیرساخت پورتال ۱۳.۲–۱۳.۸
> دامنه: **بک‌اند + فرانت‌اند پورتال** — یک مایگریشن، ۴ مسیر تازه، ۳ کلید مجوز، ۱ تب تازه.
> تصمیم کارفرما: **حذف نرم** (Soft Delete) — فایل هیچ‌گاه از دیسک پاک نمی‌شود.

---

## ۱) خواسته و نتیجه

| # | خواسته | نتیجه در این موج |
|---|---|---|
| ۱ | مشتری بتواند مدارکش (کارت ملی، جواز، فاکتور) را از پورتال بفرستد | `POST /api/portal/documents` با multer اختصاصی (JPG/PNG/WEBP/PDF · ۵MB) |
| ۲ | مدارک ارسالی را ببیند و دوباره دانلود کند | `GET /api/portal/documents` + `GET /api/portal/documents/:id/file` (فقط با توکن) |
| ۳ | اشتباه را جبران کند | `DELETE /api/portal/documents/:id` = **حذف نرم** (ردیف پنهان، فایل بایگانی) |
| ۴ | فایل‌ها در مسیر عمومی لو نروند | پوشهٔ **خصوصی** `Backend/private/portal_documents/` — نه زیر `uploads/` |
| ۵ | حجم/تعداد مهار شود | ۵MB هر فایل · ۱۰ مدرک و ۲۵MB مجموع هر پرونده · `portalWriteLimiter` |

## ۲) مهم‌ترین یافتهٔ این موج

`Backend/server.js` مسیر `/uploads` را **بدون احراز هویت** سرو می‌کند
(فقط پسوندهای خطرناک بلاک شده‌اند). اگر مدارک مشتری آن‌جا ذخیره می‌شد،
هر کسی با دانستن نام فایل به کارت ملی دسترسی داشت — بدون هیچ لاگین.

⇒ مسیر ذخیره عمداً بیرون از `uploads/` انتخاب شد:

```
Backend/private/portal_documents/customer_<scopeId>/doc_<ts>_<rand>.<ext>
```

و سرو فقط از یک مسیر با توکن انجام می‌شود:

```js
res.download(resolved, downloadName); // ⇒ Content-Disposition: attachment
```

`Backend/private/` هم به `.gitignore` اضافه شد (دادهٔ شخصی نباید در گیت برود).

## ۳) جدول داده — `portal_documents`

| ستون | نوع | توضیح |
|---|---|---|
| `id` | INTEGER PK | |
| `customer_id` | INTEGER NOT NULL | 🔒 فقط از `req.customerScopeId` (توکن) · ایندکس |
| `uploaded_by` | INTEGER NULL | کاربر آپلودکننده (بدون FK — تاریخچه می‌ماند) |
| `title` | STRING(120) | برچسب پاک‌سازی‌شده؛ خالی ⇒ «مدرک بدون عنوان» |
| `kind` | STRING(20) | `id_card` · `license` · `invoice` · `other` |
| `file_name` | STRING(255) | نام اصلی — **فقط نمایش** |
| `file_path` | STRING(500) | مسیر نسبی داخل پوشهٔ خصوصی — هرگز در API نمی‌آید |
| `file_size` | INTEGER | بایت |
| `mime_type` | STRING(100) | یکی از چهار نوع مجاز |
| `deleted_by` | INTEGER NULL | چه کسی حذف نرم کرد |
| `created_at` / `updated_at` / `deleted_at` | timestamps | `deleted_at` = پارانوید |

ایندکس‌ها: `portal_documents_customer_created` · `portal_documents_customer_kind` ·
`portal_documents_deleted_at`.

## ۴) حذف نرم — چرا و چگونه

پروژه از قبل قرارداد پارانوید دارد (`Hall`، `Unit`، `UnitExpert`).
همان الگو برای مدارک به‌کار رفت:

```js
await row.update({ deleted_by: req.user.id }); // ممیزی «چه کسی حذف کرد»
await row.destroy();                           // ← فقط deleted_at پر می‌شود
```

پیامدهای مهم:

| موضوع | رفتار |
|---|---|
| فهرست مشتری | ردیف حذف‌شده خودکار فیلتر می‌شود (`paranoid`) |
| سهمیه (۱۰/۲۵MB) | `count`/`sum` هم خودکار ردیف حذف‌شده را نمی‌شمارد |
| دانلود توسط مشتری | `findOne` پارانوید ⇒ **۴۰۴** (حتی با دانستن `id`) |
| فایل روی دیسک | **می‌ماند** — برای بازبینی/اختلاف احتمالی |
| `fs.unlink` در کل موج | **صفر** (گارد تست مکانیکی همین را می‌سنجد) |

## ۵) مسیرها و کلیدهای مجوز

| متد | مسیر | کلید مجوز | محدودکننده |
|---|---|---|---|
| `GET` | `/api/portal/documents` | `customer.portal.documents` | — |
| `POST` | `/api/portal/documents` | `.documents` + `.documents.upload` | `portalWriteLimiter` + سهمیه + multer |
| `GET` | `/api/portal/documents/:id/file` | `.documents` + مالکیت ردیف | — |
| `DELETE` | `/api/portal/documents/:id` | `.documents` + `.documents.delete` | `portalWriteLimiter` + مالکیت ردیف |

کاتالوگ مجوزها: **۱۸۸ → ۱۹۱** (گروه‌ها ثابت ۱۷). هر سه کلید
`D.customerOnly` هستند (پیش‌فرض برای مشتری روشن، برای کارکنان خاموش).

🔒 مالکیت: `requireOwnedRow({ model: PortalDocument })` — ردیف مشتری دیگر ⇒ **۴۰۴**
(نه ۴۰۳) تا وجود ردیف لو نرود.

## ۶) سهمیه: چرا **پیش** از multer؟

ترتیب زنجیرهٔ آپلود:

```
tabChain → requirePermission(.upload) → portalWriteLimiter
        → ensureDocumentQuota → uploadPortalDocumentSingle → controller
```

اگر سهمیه پس از نوشتن فایل سنجیده می‌شد، هر درخواست رد‌شده یک فایل یتیم روی
دیسک باقی می‌گذاشت و برای پاک‌کردنش `unlink` لازم می‌شد (که با تصمیم «حذف نرم»
و گارد «صفر unlink» در تضاد است).

قاعدهٔ رزرو: اگر `totalBytes + 5MB > 25MB` ⇒ رد. نتیجه: حجم مجموع هرگز از
۲۵ مگابایت رد نمی‌شود و هیچ فایلی بیهوده نوشته نمی‌شود.

## ۷) فایل‌های تغییریافته

### بک‌اند (۱۰)

| فایل | تغییر |
|---|---|
| `migrations/20261109000000-create-portal-documents.js` (**جدید**) | جدول + ۳ ایندکس، idempotent (`showAllTables`/`showIndex`)، `down` دارد |
| `models/PortalDocument.js` (**جدید**) | مدل با `paranoid: true` + `underscored` |
| `services/portalDocumentRules.js` (**جدید**) | منطق خالص: kinds، سقف‌ها، `sanitizeTitle`، `mimeDecision`، `quotaDecision`، `documentView`، `resolveStoredPath` |
| `middleware/upload.js` | `uploadPortalDocument` + `uploadPortalDocumentSingle` (پوشه از اسکوپ توکن، نام تصادفی، خطای multer ⇒ JSON فارسی) |
| `controllers/portalDocumentsController.js` (**جدید**) | `ensureDocumentQuota` · `listMyDocuments` · `uploadMyDocument` · `deleteMyDocument` · `downloadMyDocument` |
| `routes/portalRoutes.js` | `documentsChain` + ۳ زنجیرهٔ تخصصی + ۴ مسیر |
| `config/permissions.js` | ۳ کلید تازه در گروه «پورتال مشتری» |
| `permissions-test.mjs` | عدد اعلامی ۱۸۸ ⇒ ۱۹۱ |
| `scripts/verify-db.js` | `portal_documents` + ستون‌ها + ۳ ایندکس |
| `.gitignore` | `Backend/private/` |

⚠️ `models/associations.js` **تغییر نکرد**: هیچ `include` ای لازم نیست و
`customer_id` بدون FK است (هم‌الگو با `login_challenges`/`registration_requests`)
تا حذف پرونده، تاریخچهٔ مدارک را نشکند.

### فرانت‌اند (۷)

| فایل | تغییر |
|---|---|
| `core/constants/api.const.js` | `PORTAL.DOCUMENTS` · `DOCUMENT_FILE(id)` · `DOCUMENT_DELETE(id)` |
| `features/portal/portal.api.js` | آینهٔ قواعد (kinds/سقف‌ها/`documentFileError`) + `getDocuments`/`uploadDocument`/`deleteDocument`/`downloadDocument` |
| `features/portal/portal.documents.js` (**جدید**) | mixin: `DOCUMENT_TABS`، `initDocumentsTab`، `bindDocuments`، `loadDocumentsTab`، `renderDocuments`، `uploadDocument`، حذف دو مرحله‌ای، `downloadDocument` |
| `features/portal/portal.renderer.js` | `renderDocumentQuota` · `renderDocumentUploadBox` · `renderDocumentRow` · `renderDocumentList` · `formatFileSize` |
| `features/portal/portal.service.js` | `Object.assign(EXTRA_TABS, DOCUMENT_TABS)` + `initDocumentsTab`/`bindDocuments` + `applyPortalDocuments` |
| `pages/portal.html` | تب + پنل `documents` (بدون تگ فرم) |
| `features/portal/portal.css` | `.portal-docs*` + `.portal-btn--danger/--ghost/--muted` (موبایل‌پسند) |

### تست و مستندات (۴)

`customer-portal-guard-test.mjs` (بخش ۱۵) · `docs/REVIEW-WAVE-13.10.md` ·
`Backend/migrations/README.md` · `Backend/README.md` / `Frontend/README.md`

## ۸) گارد تست — بخش ۱۵ (۱۲ بررسی)

۱. چهار مسیر با زنجیرهٔ تب و کلید آپلود/حذف و مالکیت ردیف
۲. پوشهٔ خصوصی: نه `uploads/`، نه `express.static`، نه `res.sendFile` + `.gitignore`
۳. multer: مقصد از `req.customerScopeId` (**نه** `req.body.customer_id`)، نام تصادفی، پسوند از mime، `files: 1`
۴. سرویس قواعد: چهار mime مجاز، **صفر** zip/svg/mp4/msword، سقف‌های ۵MB/۱۰/۲۵MB، سهمیه پیش از multer
۵. کنترلر: `customer_id` از توکن در همهٔ کوئری‌ها و نبود `file_path` در خروجی
۶. حذف نرم: `paranoid: true` + `deleted_by` + `destroy()` + **صفر unlink**
۷. دانلود: `res.download` + مرز مسیر (`isAbsolute`/`..`/`startsWith(root)`)
۸. کاتالوگ: سه کلید با پیش‌فرض فقط مشتری
۹. فرانت api: سه اندپوینت + `uploadFormData`/`FormData('file')`/`download` و نبود `fetch` خام
۱۰. فرانت سرویس: ثبت در `EXTRA_TABS` **قبل** از `ALL_TAB_KEYS`، mixin **بعد** از `applyPortalExtra`، گیت مجوز، بدون `alert`/`window.confirm`
۱۱. HTML/رندرر/CSS + مایگریشن/`verify-db`/مستندات
۱۲. صفحه و رندرر بدون تگ فرم + ورودی `type="file"` با `accept` چهار mime

به‌روزرسانی‌های اجباری در گاردهای موجود: `TOTAL_PERMISSIONS` ۱۸۸ ⇒ ۱۹۱ و
شمارش `portalWriteLimiter` از ۳ به **۵** (آپلود + حذف).

## ۹) اجرا

```bash
cd Backend  && npm run db:migrate && npm run db:verify
cd Backend  && node permissions-test.mjs
cd Frontend && npm run lint && npm run test:customer-portal
node tools/gate.mjs
```

## ۱۰) آنچه انجام **نشد** (شفاف)

| مورد | چرا |
|---|---|
| پیش‌نمایش تصویر مدرک در پورتال | برای جلوگیری از رندر محتوای آپلودی در دامنهٔ پورتال، دانلود همیشه `attachment` است |
| حذف قطعی/پاک‌سازی فایل توسط مشتری | تصمیم کارفرما: حذف نرم است؛ پاک‌سازی فیزیکی در آینده فقط با اسکریپت مدیر |
| صفحهٔ «مدارک مشتریان» برای کارشناس | موج بعدی؛ زیرساخت (مدل + پوشهٔ خصوصی) آماده است |
| اسکن آنتی‌ویروس فایل | خارج از دامنهٔ این موج؛ کاهش ریسک با فهرست سفید mime + حجم + عدم اجرای inline انجام شد |
| انتقال خودکار مدارک به پرونده پس از تأیید | نیازی نیست: مدارک مستقیماً با `customer_id` به پرونده بسته‌اند |
