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

## تغییرات جدید / What's New (اطلاع‌رسانی نسخه‌ها)

وقتی نسخهٔ جدیدی از سیستم را تحویل می‌دهید، سوپر ادمین از پنل مدیریت یک «نسخه»
با چند «آیتم» (ویژگی جدید / بهبود / رفع باگ / امنیت) ثبت و منتشر می‌کند؛
کاربران لاگین‌شده یک‌بار مودال تغییرات را می‌بینند.

### دسترسی
| عملیات | super_admin | admin / sub_admin | expert / customer |
|---|---|---|---|
| دیدن مودال + ثبت «دیدم» | ✔ | ✔ | ✔ |
| فهرست/جزئیات/آمار در پنل | ✔ | ✔ (فقط خواندن) | ✗ (۴۰۳) |
| ساخت/ویرایش/انتشار/آرشیو/حذف | ✔ | ✗ (۴۰۳) | ✗ (۴۰۳) |

### API (`/api/releases`)
| روت | کار |
|---|---|
| `GET /unseen` | آخرین نسخهٔ منتشرشده‌ای که کاربر **ندیده** (یا `null`) — با فیلتر مخاطب |
| `POST /:id/seen` | ثبت دیدن، بدنه: `{ dont_show_again?: true }` |
| `GET /history` | تاریخچهٔ نسخه‌های منتشرشده + `seen` هر کدام + `unseen_count` (بج هدر) |
| `GET /` | فهرست مدیریتی (فیلتر `status`/`audience`/`search` + `counts`) |
| `GET /:id` · `GET /:id/stats` | یک نسخه + آیتم‌ها · آمار دیدن (تعداد + ۱۰ کاربر آخر) |
| `POST /` · `PATCH /:id` · `DELETE /:id` | ساخت/ویرایش/حذف (فقط سوپر ادمین) |
| `POST /:id/publish` · `POST /:id/archive` | انتشار (با `published_at` = زمان‌بندی، `resend: true` = پاک‌کردن رسیدهای دیدن) و آرشیو |

### قواعد مهم
- فقط نسخه‌های `published` و `published_at <= now` به کاربران نمایش داده می‌شوند.
- مخاطب (`audience`): `all` | `customers` | `experts` | `admins` — فیلتر بر اساس نقش کاربر.
- هر کاربر هر نسخه را **یک‌بار** می‌بیند؛ «متوجه شدم» = ثبت در `release_note_views`.
- تیک «دیگر نشان نده» برای همان نسخه ذخیره می‌شود (`dont_show_again`).
- بستن با ESC/کلیک بیرون فقط در همان نشست پنهان می‌کند (پیام هدر می‌ماند تا واقعاً دیده شود).
- حداکثر آیتم در هر نسخه: `RELEASE_NOTE_MAX_ITEMS` (پیش‌فرض ۵۰).

### تأیید سریع پس از استقرار
```bash
npm run db:verify     # باید release_notes / release_note_items / release_note_views را ALL PASS بدهد
npm run test:security # ۴۰۱ بدون توکن برای /api/releases/*
ALLOW_DB_TESTS=true npm run test:db   # چرخهٔ کامل ساخت→انتشار→دیدن→«دیگر نشان نده»
```

---

## شمارهٔ مشتری (`customer_code`)

- **سیاست:** شماره از `1000` شروع می‌شود و **ترتیبی** است (`بزرگ‌ترین شمارهٔ موجود + ۱`).
  شمارهٔ شروع با `CUSTOMER_CODE_START` در `.env` قابل تغییر است.
- **چرا قبلاً غیرترتیبی بود؟** کد با `SELECT nextval('customer_code_seq')` و **بیرون از تراکنش**
  و قبل از درج گرفته می‌شد؛ سکانس Postgres هرگز rollback نمی‌شود، پس هر ثبت ناموفق یا مشتری
  حذف‌شده یک شماره را برای همیشه می‌سوزاند (مثال واقعی: ۱۰۰۰، ۱۰۰۳، ۱۰۰۵).
- **اکنون:** گرفتن شماره داخل یک **تراکنش** و همراه با `LOCK TABLE … IN SHARE ROW EXCLUSIVE MODE`
  انجام می‌شود؛ پس اگر ثبت خطا بخورد **هیچ شماره‌ای مصرف نمی‌شود**. تداخل همزمانی با
  ایندکس یکتا + ۳ بار تلاش مجدد مدیریت می‌شود.
- **پرش فقط با حذف مشتری** رخ می‌دهد (شمارهٔ صادرشده بازاستفاده نمی‌شود).
- مایگریشن `20260916140000-customer-code-sequential` شماره‌ها را بر اساس `id` بازشماره‌گذاری
  می‌کند، ستون را `NOT NULL` می‌کند و سکانس قدیمی را با max همگام می‌کند (idempotent).
- **تأیید:** `npm run db:verify` — گزینهٔ «شمارهٔ مشتری: هر N مشتری شمارهٔ یکتا دارد».
- **UI:** ستون اول جدول مشتریان «شماره مشتری» است (نه آیدی داخلی) و با «شماره مشتری»
  در `searchColumn=0` هم می‌توان جستجو کرد.

---

## جستجوی زندهٔ لیست مشتریان (`GET /api/customers`)

پارامترهای جستجو (قبلاً در بک‌اند نادیده گرفته می‌شدند و جدول فیلتر نمی‌شد):

| پارامتر | مقدار | توضیح |
|---|---|---|
| `search` | متن (حداکثر ۱۰۰ کاراکتر) | عبارت جستجو |
| `searchColumn` | `all` (پیش‌فرض) یا `0..12` | 0=ID · 1=نام مجموعه · 2=نام مشتری · 3=نام فارم · 4=تماس · 5=پیامرسان · 6=تحصیلات · 7=جنسیت · 8=استان · 9=شهر · 10=تاریخ ثبت · 11=وضعیت |
| `customer_type_id` | عدد | فیلتر مستقل «نوع مشتری» (فیلتر کنار نوار جستجو در UI) — ستون ۱۲ = نوع مشتری |

| `page` / `limit` | عدد | صفحه‌بندی (سقف `limit` = ۱۰۰) |

نکات پیاده‌سازی (`Backend/utils/search.js`):
- **نرمال‌سازی فارسی:** ارقام فارسی/عربی → لاتین، `ي/ك/ة` → `ی/ک/ه`، یکسان‌سازی فاصله‌ها.
- **نام‌ها بدون فاصله/نیم‌فاصله** هم پیدا می‌شوند («می‌رود» ↔ «می رود»).
- **امنیت:** کاراکترهای `%` و `_` escape می‌شوند تا ورودی کاربر wildcard نشود.
- **تاریخ:** ورودی شمسی (`۱۴۰۳/۰۱/۰۱`) یا میلادی (`2026-03-21`) به بازهٔ همان روز تبدیل می‌شود.
- **وضعیت:** «فعال/غیرفعال» و `true/false/1/0` پذیرفته می‌شود.
- تست‌ها: `security-unit-test.mjs` (نرمال‌سازی/تاریخ/شرط‌ها) و `security-e2e-test.mjs` (فیلتر واقعی روی دیتابیس).
- **نوع مشتری:** نام آن در جدول دیکشنری `customer_types` است؛ جستجو با **زیرپرس‌وجو** انجام می‌شود (`customer_type_id IN (SELECT id FROM customer_types WHERE name ILIKE …)`) تا `distinct` و صفحه‌بندی سالم بمانند (بدون join). `national_code` هم در حالت «همه ستون‌ها» جستجو می‌شود.
- **تست‌ها:** `security-unit-test.mjs` و `security-e2e-test.mjs` (شامل «نوع مشتری» و «کد ملی») و `customer-validation-test.mjs` (`npm run test:customer-validation`).

### دیکشنری «انواع مشتری» (`/api/dictionary/customer-types`)

| متد | مسیر | دسترسی |
|---|---|---|
| GET | `/api/dictionary/customer-types` | هر کاربر وارد‌شده (`protect`) |
| POST | `/api/dictionary/customer-types` | `admin` / `super_admin` |
| PUT | `/api/dictionary/customer-types/:id` | `admin` / `super_admin` |
| DELETE | `/api/dictionary/customer-types/:id` | `admin` / `super_admin` |

- چهار آیتم پیش‌فرض در مایگریشن `20260919120000` ساخته می‌شود: **گوشتی · تخم‌گذار · مرغ مادر · سایر** (مدیریت از پنل: «مدیریت دیکشنری» ← «انواع مشتری»).
- ⛔ حذف نوعی که برای مشتری‌ها استفاده شده **ممنوع** است (۴۰۰ با پیام فارسی) تا نوع مشتریان بی‌مرجع نشود؛ برای حذف از فرم‌ها آن را «غیرفعال» کنید.
- «نوع مشتری» در ثبت‌نام **اجباری** است و در ویرایش هم اگر مشتری قدیمی نوعی نداشته باشد تعیین آن الزامی است. «کد ملی» اختیاری است (۱۰ رقم + رقم کنترلی؛ ارقام فارسی هم پذیرفته و نرمال‌سازی می‌شود).



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

