# SKB-CRM — Backend (API)

Express 5 + Sequelize 6 + PostgreSQL. سرویس API روی `127.0.0.1:5000` (پیش‌فرض).

> فرانت‌اند در پوشهٔ `Frontend` است و درخواست‌ها را با آدرس هم‌مبدأ `/api` به این سرویس پروکسی می‌کند.

---

## راه‌اندازی سریع

```bash
cp .env.example .env      # سپس مقادیر واقعی را بگذار: DB_*, JWT_SECRET, SMS_*
npm ci                    # یا npm install
npm run db:migrate        # ساخت/به‌روزرسانی ساختار دیتابیس
npm run db:verify         # ✅ تأیید خواندنی ساختار — باید ALL PASS بدهد
npm start                 # یا start-backend.bat در ریشهٔ پروژه
```

- تست سلامت: `http://127.0.0.1:5000/api/ping`
- ساخت ادمین اول: مسیر `/setup-admin` در فرانت (محدود به `SETUP_ADMIN_RATE_MAX` بار در ساعت).

---

## ⛔ قاعدهٔ طلایی: هرگز `sequelize.sync` نزن

- `sequelize.sync` در `config/database.js` **عمداً کامنت شده** است.
- **هر** تغییر ساختار دیتابیس (جدول/ستون/ایندکس) باید با **مایگریشن** انجام شود:

```bash
npx sequelize-cli migration:generate --name describe-your-change
npm run db:migrate        # اعمال
npm run db:verify         # تأیید
```

- `npm run db:sync` (که `{ alter: true }` می‌زند) **مسدود شده** است: بدون `ALLOW_DB_SYNC=true` اجرا
  نمی‌شود و روی production (`NODE_ENV=production`) **هرگز** اجرا نمی‌شود؛ فقط برای دیتابیس‌های خیلی قدیمی
  (legacy) و **فقط بعد از بکاپ**: `ALLOW_DB_SYNC=true npm run db:sync`.
- جزئیات: `migrations/README.md` و `db/README.md`.

---

## دستورهای رایج

| دستور | کار |
|---|---|
| `npm start` / `npm run dev` | اجرای سرویس / اجرا با nodemon |
| `npm run db:migrate` | اعمال مایگریشن‌های جدید |
| `npm run db:status` | وضعیت مایگریشن‌ها |
| `npm run db:rollback` | برگرداندن آخرین مایگریشن |
| `npm run db:verify` | ✅ بررسی خواندنی: جدول‌ها، ستون‌ها، ایندکس‌ها، مایگریشن‌ها، تعداد رکورد |
| `npm run db:schema` | اسنپ‌شات ساختار فعلی → `db/schema-<تاریخ>.sql` |
| `npm run backup` | بکاپ کامل (دیتابیس + uploads) |
| `npm run uploads:report` | گزارش فایل‌های آپلودی و یتیم |
| `npm run uploads:clean` | پاک‌سازی فایل‌های یتیم (dry-run پیش‌فرض) |
| `npm run lint` | ESLint |
| `npm run test:security` | تست‌های امنیتی (unit + api) |
| `npm run test:db` | تست e2e دیتابیسی |
| `npm run test:integrity` | تست یکپارچگی داده |
| `npm run test:uploads` | تست‌های اولویت ۳ و ۴ |
| `npm run test:uploads-maint` | تست نگهداری فایل‌های آپلودی |

> ⚠️ تست‌های دیتابیسی روی دیتابیس واقعیِ `.env` اجرا می‌شوند و تغییرات موقتی می‌سازند،
> بنابراین فقط با اجازهٔ صریح اجرا می‌شوند:
> ```powershell
> $env:ALLOW_DB_TESTS='true'   # در CMD:  set ALLOW_DB_TESTS=true
> npm run test:db
> ```
> بدون این متغیر، تست‌ها پیام `⏭️ SKIPPED` چاپ می‌کنند و با کد ۰ خارج می‌شوند (اجرای واقعی ندارند).
> روی سرور production (`NODE_ENV=production`) هرگز اجرا نمی‌شوند.

---

## استقرار روی لینوکس (PM2)

روی سرور لینوکسی از `deploy.sh` استفاده کن (معادل `deploy.bat`):

```bash
cd ~/projects/SKB-CRM-V-2.0.0
bash deploy.sh              # git pull + npm ci + db:migrate + db:verify + pm2 restart
bash deploy.sh --no-git     # وقتی با کپی فایل به‌روزرسانی می‌کنی
bash deploy.sh --no-npm     # سرور آفلاین (node_modules کپی‌شده)
bash deploy.sh --no-pm2     # فقط مایگریشن/تأیید، بدون ری‌استارت
bash deploy.sh --help
```

- نام سرویس‌های PM2 قابل تغییر است:
  `PM2_BACKEND=skb-backend PM2_FRONTEND=skb-frontend bash deploy.sh`
- لاگ: `logs/deploy.log` — و در صورت هر خطا، اسکریپت با کد `1` متوقف می‌شود
  (هیچ خطایی بی‌صدا رد نمی‌شود).
- ⛔ `deploy.sh` **هرگز** `sequelize.sync` اجرا نمی‌کند؛ فقط `db:migrate` + `db:verify`.

### عیب‌یابی روی سرور
- `pm2 logs skb-backend --lines 100` → خطای واقعی (پیام‌های ۵xx در production ماسک می‌شوند).
- `cd Backend && npm run db:verify` → اگر `FAIL` داد: `npm run db:migrate` و دوباره verify.
- با توکن ادمین: `GET /api/server-status` → بلوک `schema` می‌گوید کدام جدول/مایگریشن غایب است.
- ⚠️ اسکریپت‌های قدیمی که `node sync-db.js` (در ریشهٔ `Backend`) را صدا می‌زدند **دیگر کار نمی‌کنند**؛
  مسیر درست `Backend/scripts/sync-db.js` است و آن هم فقط با `ALLOW_DB_SYNC=true` و نه روی production اجرا می‌شود.

---

## چک‌لیست استقرار روی سرور

```bat
backup.bat        :: ۱) بکاپ دیتابیس + فایل‌ها
deploy.bat        :: ۲) git pull + npm ci + db:migrate + db:verify
                  ::    بدون گیت / بدون اینترنت:  deploy.bat --no-git --no-npm
                  ::    لاگ: logs\deploy.log   (با --pause برای اجرای دستی)
start-backend.bat :: ۳) ری‌استارت بک‌اند
start-frontend.bat:: ۴) ری‌استارت فرانت
```

- اگر در `.env` مقدار `BACKUP_BEFORE_MIGRATE=1` باشد، `deploy.bat` قبل از مایگریشن خودش بکاپ می‌گیرد.
- `deploy.bat` در صورت خطا با کد خروجی غیرصفر تمام می‌شود (قابل استفاده در Task Scheduler).
- بعد از استقرار، این دو آدرس باید پاسخ بدهند:
  `http://127.0.0.1:5000/api/ping` و `http://127.0.0.1:3000/api/ping`

---

## ساختار پوشه‌ها

| پوشه/فایل | توضیح |
|---|---|
| `config/` | تنظیمات دیتابیس و `.sequelizerc` |
| `models/` | مدل‌های Sequelize (+ `associations.js`) |
| `controllers/` `routes/` | منطق API |
| `middleware/` | احراز هویت، محدودیت نرخ، امنیت |
| `migrations/` `seeders/` | تغییرات ساختار و دادهٔ اولیه |
| `scripts/` | بکاپ، مایگریشن‌های دستی، `verify-db.js`، ابزار uploads |
| `db/` | مستندات دیتابیس + اسنپ‌شات schema |
| `uploads/` | فایل‌های آپلودی کاربران (بکاپ می‌شوند) |
| `security-*.mjs`, `priority34-test.mjs`, `data-integrity-test.mjs`, `uploads-maintenance-test.mjs` | تست‌های سرتاسری |

---

## نکته‌های امنیتی (خلاصه)

- مسیرهای حساس با `protect` (JWT) و بررسی نقش محافظت می‌شوند.
- قفل حساب بعد از تلاش‌های ناموفق (`failed_login_attempts` / `locked_until`).
- محدودیت نرخ درخواست برای همهٔ APIها + مسیر ورود + ارسال «نظرات».
- سرو فایل‌های `/uploads` با `nosniff`، بلاک پسوندهای اسکریپتی و `attachment` برای غیرتصویری‌ها.
- `JWT_SECRET` و کلیدهای پیامک فقط در `.env` (و هرگز در گیت) — `.env.example` الگو است.
- «نظرات و پیشنهادات»: همهٔ روت‌ها نیاز به ورود دارند، پاسخ/حذف فقط برای ادمین (`authorize`) است و
  هر کاربر فقط گفتگوهای خودش را می‌بیند؛ ارسال پیام محدودیت نرخ دارد و پیام کاملاً تکراری
  (تا ۳۰ ثانیه) دوباره ثبت نمی‌شود.
- **تنظیمات نمایشی (عمومی)**: `GET /api/public/ui-settings` بدون ورود در دسترس است و فقط
  کلیدهای نمایشی (`loader_style`) را برمی‌گرداند تا سرور فرانت‌اند بتواند لودر سیستمی را در
  HTML تزریق کند. ⚠️ هیچ دادهٔ حساسی نباید به این اندپوینت اضافه شود.

