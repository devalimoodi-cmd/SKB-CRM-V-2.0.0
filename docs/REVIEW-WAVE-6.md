# گزارش موج ۶ — «صیقل نهایی تم: پالت تکمیلی + بلوک‌های style در JS + نمودار داشبورد»

> برنچ کاری: `chore/wave-6-theme-polish`
> هدف: بستن شکاف‌های باقی‌ماندهٔ موج‌های ۴ و ۵.

## ۱) سه کارِ این موج

### الف) پالت تکمیلی توکن‌ها (≈۲۴ توکن جدید)
به `global.css` (روشن/تیره) اضافه شد: `--ink`, `--accent-teal`, `--success-deep`,
`--success-deeper`, `--success-mist(-2/3/4)`, `--danger-deep`, `--danger-mist`,
`--danger-brd`, `--warning-mist`, `--warning-deep(-2/3)`, `--warning-brd`,
`--info-strong`, `--info-deep`, `--info-brd`, `--violet`, `--violet-deep`,
`--indigo`, `--slate-mist`, `--slate-border`.
مقدار هر توکن در حالت روشن **دقیقاً برابر رنگ قبلی** است ⇒ ظاهر روشن بی‌تغییر.

### ب) مهاجرت بلوک‌های `<style>` داخل JS + رفع یک باگ ابزار
- ابزار حالا بلوک‌های `<style>…</style>` داخل رشته‌های JS را هم به‌عنوان CSS مهاجرت می‌کند
  (مثل `dashboard.bookmarks.js` و `hatchery.completion.*.js`).
- **باگ رفع‌شده:** مسیر JS متغیرهای موجود را محافظت نمی‌کرد و اجرای دوباره
  `var(--primary, var(--primary, #2c7a6e))` تولید می‌کرد. اکنون:
  محافظت از `var(...)`های موجود + تابع `collapseNestedVars` برای جمع‌کردن پیچش‌های تکراری.

### ج) بازسازی نمودارهای داشبورد روی تغییر تم
- `dashboard.service.js`: آخرین دادهٔ نمودار نگه داشته می‌شود و با رویداد `theme:changed`
  نمودارها از نو ساخته می‌شوند (Chart.js مقدار `var()` را نمی‌فهمد).
- گارد `window.addEventListener` برای محیط‌های تست (window جعلی) اضافه شد.

## ۲) نتیجهٔ اعتبارسنجی

```
GATE-PASS — همهٔ ۳۲ گام exit=0 و fail=0
test:theme=19 · test:dashboard-surface=11 · test:dashboard:sms-status:body=110 · …
```
- ۸ گارد «برش بدنه» اسنپ‌شات‌شان بازتولید شد (تغییر عمدی محتوا) + anchor `M16` به‌روزرسانی شد.
- باگ `test:dashboard-surface` (نبود گارد برای `addEventListener`) کشف و رفع شد.

## ۳) مرج

```bash
git checkout main
git merge --no-ff chore/wave-6-theme-polish
git tag merge-stage-6
git push <remote> main
git push <remote> merge-stage-6
```
