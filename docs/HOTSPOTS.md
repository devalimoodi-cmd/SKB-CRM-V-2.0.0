# نقاط داغ پروژه (Hotspots)

> سند زنده — با اجرای اسکریپت‌های audit به‌روز نگه داشته می‌شود.
> آخرین به‌روزرسانی: موج ۰ و ۱ پاک‌سازی (برنچ `chore/wave-0-1-cleanup`).

## چطور اندازه‌گیری می‌شود؟

```bash
# Frontend
cd Frontend
npm run audit:size              # فایل‌های بزرگ و صفر‌بایتی
npm run audit:dead-exports      # export های بی‌مصرف + فایل‌های بی‌ارجاع

# Backend
cd Backend
npm run audit:size
npm run audit:dead-exports
```

هر دو اسکریپت **فقط خواندنی** هستند (هیچ فایلی را تغییر نمی‌دهند) و گزینه‌های
`--json`، `--top=`، `--big=` و `--fail-on-empty` / `--fail-on-dead` را پشتیبانی می‌کنند.

## وضعیت فعلی (پس از موج ۰ و ۱)

### Frontend

| شاخص | مقدار |
| --- | --- |
| فایل‌های اسکن‌شده | ۱۴۳ |
| حجم کل `src` | ۲.۳۶ MB |
| فایل صفر‌بایتی | ۰ (۱۲ فایل حذف شد) |
| export بدون ارجاع بیرونی | ۷۱ |
| فایل js بی‌ارجاع | ۳ |

#### بزرگ‌ترین فایل‌ها (≥ ۴۰KB)

| حجم | فایل |
| --- | --- |
| 208.7 KB | `src/features/customer-info/sections/hatchery/hatchery.service.js` |
| 157.4 KB | `src/features/dashboard/dashboard.service.js` |
| 118.6 KB | `src/features/customer-info/sections/weekly/weekly.service.js` |
| 97.6 KB | `src/features/customer-info/sections/hall-management/halls.service.js` |
| 95.9 KB | `src/pages/customer-info.html` |
| 74.8 KB | `src/features/customer-info/sections/weekly/weekly.renderer.js` |
| 71.4 KB | `src/features/customer-info/sections/chart-dashboard/chart-dashboard.service.js` |
| 68.2 KB | `src/features/dashboard/dashboard.css` |
| 50.2 KB | `src/features/admin-panel/admin-panel.service.js` |
| 44.0 KB | `src/pages/admin-panel.html` |
| 40.5 KB | `src/features/customer-info/sections/hatchery/hatchery.report.js` |

#### فایل‌های js بی‌ارجاع (نه `import`، نه `<script src>`)

- `src/core/types/index.types.js`
- `src/features/sms/sms.modal.service.js`
- `src/shared/components/TaskCard/index.js`

> ⚠️ ممکن است بعضی از این‌ها با `import()` داینامیک مصرف شوند؛ قبل از حذف بررسی شود.

### Backend

| شاخص | مقدار |
| --- | --- |
| فایل‌های اسکن‌شده | ۱۳۹ |
| حجم کل | ۸۸۶ KB |
| فایل صفر‌بایتی | ۰ |
| بزرگ‌ترین کنترلرها | `dictionaryController.js` ۶۳.۶KB، `dashboardController.js` ۵۵.۳KB، `smsController.js` ۴۲.۴KB |

## نقاط داغ بعدی (پیشنهاد موج ۲)

1. **`hatchery.service.js` (۲۰۹KB)** — بعد از استخراج توابع کشتار، بزرگ‌ترین فایل پروژه است؛
   کاندید شکستن به: `hatchery.view.js` (رندر)، `hatchery.data.js` (فراخوانی API/نرمال‌سازی).
2. **`dashboard.service.js` (۱۵۷KB)** — شامل منطق مودال بوکمارک، کارت‌های گله و نمودارها
   در یک کلاس؛ کاندید جدا‌سازی مودال‌ها.
3. **`dictionaryController.js` و `dashboardController.js`** — بزرگ‌ترین فایل‌های بک‌اند؛
   در پاک‌سازی موج ۰ پاسخ‌های استاندارد از آن‌ها خارج شد. گام بعدی: انتقال کوئری‌های
   تکراری CRUD به یک لایهٔ سرویس عمومی.
4. **۷۱ export بی‌مصرف در فرانت** — بیشترشان توابع کمکی عمومی (`dom.utils.js`،
   `number.utils.js`، `form.utils.js`) هستند؛ تصمیم بگیر «نگه‌دار برای آینده» یا «حذف».
5. **خوشهٔ SMS قدیمی** — `src/features/sms/*` (فایل مستقل `sms.html` + سرویس‌های
   کلاسیک) نه در منو است و نه در مسیرها؛ در `docs/REVIEW.md` شرح داده شده است.

## قواعد نگه‌داری

- **هرگز** فایل صفر‌بایتی اضافه نکنید؛ `npm run audit:size -- --fail-on-empty` را در CI بگذارید.
- برای فایل جدید `src/features/...`، حتماً مصرف‌کنندهٔ آن (import یا `<script src>`) مشخص باشد.
- فایل‌های بزرگ‌تر از ۴۰KB فقط با برنامهٔ شکستن (issue) بزرگ‌تر شوند.
