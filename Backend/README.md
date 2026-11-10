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

## ⛔ قاعدهٔ دوم (Express 5): هرگز به `req.query` / `req.params` انتساب نده

در Express 5 این دو property **فقط getter** هستند و از `req.url` از نو ساخته می‌شوند؛
`req.query = ...` در حالت strict یک `TypeError` است و همان لحظه کل اندپوینت ۵۰۰ می‌شود
(باگ موج ۱۳.۱۰.۱ در «داشبورد پورتال» دقیقاً همین بود: نمودارها و تحلیل‌ها ۵۰۰ می‌دادند).

- برای «تحمیل اسکوپ» هرگز `req` را تغییر نده؛ یکی از این دو:
  - `services/portalDashboardScope.scopedRequest(req)` (پروکسی با query سفیدشده — الگوی پورتال)،
  - یا `Object.defineProperty(req, "query", { value, writable: true, configurable: true })`
    (الگوی `middleware/customerScope.js`).
- `req.body` یک property معمولی است و انتسابش مجاز است.
- گارد: بخش **۱۶** در `Frontend/customer-portal-guard-test.mjs` کل
  `controllers/middleware/routes/services` را اسکن می‌کند و رفتار Express 5 را با یک
  درخواست شبیه‌سازی‌شده **اجرا** می‌کند.

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

### روی چه مسیرهایی اعمال می‌شود؟ (وضعیت فعلی)

| ماژول | کلیدهای مجوز متصل‌شده |
|---|---|
| مشتریان (`/api/customers`) | `customers.list.view` · `search` · `register` · `profile.view` · `edit` · `toggle` · `delete` |
| واحدها (`/api/units`) | `units.view` · `create` · `edit` · `delete` · `toggle` · `experts` |
| سالن‌ها (`/api/halls`, `hall-*`) | `halls.view` · `create` · `edit` · `delete` · `toggle` · `hatchery.hygiene.*` |
| جوجه‌ریزی (`/api/chick-placements`, `/api/flocks`, `/api/flock-completions`) | `hatchery.view` · `hatchery.placement.*` · `hatchery.completion.*` |
| هفتگی (`/api/weekly`) | `weekly.view` · `create` · `edit` · `delete` |
| بازدید (`/api/visit-reports`) | `visit.view` · `create` · `edit` · `delete` · `status` · `visit.attachment.*` |
| داشبورد (`/api/dashboard`) | `dashboard.*` (کارت‌ها، آمار، نمودار، تحلیل، تقویم، پیامک گروهی، مخفی‌کردن گله) · «خلاصهٔ عملکرد مشتری» با `dashboard.customerDetails` |
| پیامک (`/api/sms`) | `sms.send` · `bulk` · `templates` · `sendToRecipient` · `history` · `status.refresh` · `lines` · `received` · `credit` · `verify` · `test` |
| بوکمارک (`/api/bookmarks`) | `bookmarks.view` · `create` · `edit` · `delete` · `status` |
| هدر پروفایل مشتری | `customer.basic.view` |
| تنظیمات (`/api/settings`) | `settings.view` · `settings.edit` |
| تغییرات جدید (`/api/releases`) | `releases.view` · `releases.manage` |
| نظرات و پیشنهادات (`/api/suggestions`) | `suggestions.admin.view` · `reply` · `status` · `delete` |
| دیکشنری‌ها (`/api/dictionary`, `/api/breed-standards`) | `dictionary.<جدول>.view` · `dictionary.<جدول>.edit` (۱۹ جدول) · `charts.standards` |
| نقش‌ها (`/api/permissions`) | `roles.matrix.view` · `roles.permissions.edit` · `users.permissions.edit` · `roles.audit.view` |
| نشست‌ها (`/api/sessions`) | `users.onlineStatus.view` (فهرست/خلاصه) · `users.sessions.revoke` (بستن یک نشست یا همهٔ نشست‌های یک کاربر) |

> در بیشتر این مسیرها `authorize(...)` قبلی هم باقی مانده است؛ یعنی مجوز فقط می‌تواند
> **محدودتر** کند (تا وقتی بخواهید مجوزی را به نقشی بدهید که قبلاً در `authorize` نبود،
> باید همان خط `authorize` را به `requirePermission` تبدیل کنیم).

### وضعیت اجرا در این نصب
در `Backend/.env` مقدار **`PERMISSIONS_ENFORCE=true`** فعال شده است (کنترل واقعی).
برای برگشت به حالت آزمایشی: مقدار را `false` کنید و بک‌اند را ری‌استارت کنید.
هنگام تغییر هر سطح دسترسی در پنل، کش سرور همان لحظه پاک می‌شود؛ در سمت کاربر
برای دیدن اثر در منوها یک‌بار رفرش کافی است.

### زمان اعمال تغییرات (کش‌ها)
| لایه | مقدار | توضیح |
|---|---|---|
| کش سرور (`PERMISSIONS_CACHE_TTL_MS`) | ۳۰ ثانیه | پس از هر ذخیره در پنل **بلافاصله** پاک می‌شود ⇒ کنترل سرور آنی است |
| کش مرورگر کاربر | **۶۰ ثانیه** | با `GET /permissions/version` بررسی می‌شود؛ روی برگشت به تب/فوکوس پنجره هم تازه‌سازی می‌شود |

⇒ تغییرات با **اولین رفرش صفحه یا برگشت به تب** روی مرورگر همان کاربر اعمال می‌شود (سرور از همان لحظه اعمال می‌کند).

### تأیید سریع پس از استقرار
```bash
npm run db:verify     # باید release_notes / release_note_items / release_note_views را ALL PASS بدهد
npm run test:security # ۴۰۱ بدون توکن برای /api/releases/*
ALLOW_DB_TESTS=true npm run test:db   # چرخهٔ کامل ساخت→انتشار→دیدن→«دیگر نشان نده»
```

---

## سطوح دسترسی (نقش‌ها و کاربران)

از این پس «دسترسی هر بخش» با **مجوز (permission)** کنترل می‌شود، نه با نقش هاردکد.
ادمین از پنل مدیریت ← **«مدیریت نقش‌ها»** هر مجوز را برای هر نقش (و در صورت نیاز برای
هر کاربر خاص) روشن یا خاموش می‌کند.

### فایل‌های کلیدی
| فایل | کار |
|---|---|
| `config/permissions.js` | **کاتالوگ مجوزها** (۱۷۶ کلید در ۱۷ گروه) + پیش‌فرض هر ۵ نقش + کلیدهای قفل‌شده |
| `services/permissionService.js` | محاسبهٔ مجوز مؤثر + کش ۳۰ ثانیه‌ای + ذخیره + گزارش تغییرات |
| `middleware/permissions.js` | `requirePermission("customers.edit")` (دارای حالت dry-run) |
| `middleware/auth.js` | پس از احراز هویت، `req.user.permissions` را پر می‌کند |
| `models/{RolePermission,UserPermission,PermissionAuditLog}.js` | سه جدول جدید (مایگریشن `20260920120000-permissions.js`) |
| `controllers/permissionController.js` · `routes/permissionRoutes.js` | APIهای `/api/permissions/*` |

### قواعد
- **مجوز مؤثر** = استثنای کاربر ← استثنای نقش ← پیش‌فرض کاتالوگ.
  (جدول‌ها فقط *استثناها* را نگه می‌دارند؛ پس افزودن قابلیت جدید در آینده مایگریشن لازم ندارد.)
- ۷ کلید حساس **فقط برای سوپرادمین** قابل فعال‌سازی‌اند:
  `customers.delete` · `users.superadmin.manage` · `users.delete` · `users.token.view` ·
  `roles.permissions.edit` · `users.permissions.edit` · `releases.manage`
- `admin.panel.access` و `roles.matrix.view` برای سوپرادمین **همیشه فعال** است (ضدقفل‌شدگی).
- سوپرادمین همیشه از همهٔ بررسی‌ها عبور می‌کند (کنترل نهایی سیستم).
- هر تغییر در `permission_audit_logs` ثبت می‌شود و کش همان لحظه پاک می‌شود.

### حالت اجرا (مهم)
```bash
PERMISSIONS_ENFORCE=false   # پیش‌فرض: فقط لاگ (هیچ ۴۰۳ای برگردانده نمی‌شود)
PERMISSIONS_ENFORCE=true    # کنترل واقعی (۴۰۳ برای درخواست بدون مجوز)
```
در حالت `false` هر درخواستی که ۴۰۳ می‌گرفت، در لاگ به این شکل ثبت می‌شود:
`🛡️ [permissions:dry-run] POST /api/customers — نقش «expert» (12) فاقد مجوز [customers.register] است`
⇒ چند روز اجرا کنید، لاگ‌ها را ببینید، سپس `true` کنید.

### API (`/api/permissions`)
| روت | کار | دسترسی |
|---|---|---|
| `GET /me` | مجوزهای کاربر جاری (+ `version` و `deniedTitles`) | هر کاربر لاگین‌شده |
| `GET /version` | فقط نسخهٔ مجوزها (بررسی سبک تازه‌بودن کش) | هر کاربر لاگین‌شده |
| `GET /catalog` · `GET /roles` | کاتالوگ + ماتریس نقش‌ها | `roles.matrix.view` |
| `PUT /roles/:role` | ذخیرهٔ تغییرات یک نقش (`{ updates: [{key, allowed}] }`) | `roles.permissions.edit` |
| `POST /roles/:role/reset` | بازگردانی نقش به پیش‌فرض | `roles.permissions.edit` |
| `GET /users/:id` | مجوز مؤثر + استثناهای یک کاربر | `roles.matrix.view` |
| `PUT /users/:id` | سطح دسترسی اختصاصی کاربر (`allowed: true/false/null`) | `users.permissions.edit` |
| `DELETE /users/:id` | بازگردانی کاربر به سطح نقش | `users.permissions.edit` |
| `GET /audit` | گزارش تغییرات (صفحه‌بندی‌شده) | `roles.audit.view` |

### پاسخ ۴۰۳ (مجوز بسته)
وقتی `PERMISSIONS_ENFORCE=true` باشد و کاربر مجوز لازم را نداشته باشد:
```json
{
  "success": false,
  "permissionDenied": true,
  "message": "دسترسی شما به این عملیات بسته شده است",
  "required": ["halls.create"],
  "requiredTitles": ["ثبت سالن جدید"],
  "role": "expert"
}
```
- `permissionDenied` ⇒ فرانت می‌فهمد «۴۰۳ = نبود مجوز» است (نه چیز دیگر) و پیام قابل‌فهم می‌سازد.
- `requiredTitles` از کاتالوگ (`PERMISSIONS[key].title`) ساخته می‌شود تا کاربر بداند **چه چیزی** بسته است.
- در `GET /permissions/me` فیلد `deniedTitles` (key → عنوان فارسی) فقط برای کلیدهایی که کاربر **ندارد**
  فرستاده می‌شود؛ فرانت از آن برای پیام‌ها و کارت «این بخش برای نقش شما بسته است» استفاده می‌کند.

### تأیید سریع
```bash
npm run db:verify                    # باید role_permissions / user_permissions / permission_audit_logs را ALL PASS بدهد
npm run test:permissions             # کاتالوگ + میدل‌ور (شامل بدنهٔ ۴۰۳ و عنوان فارسی) + نگهبان مسیرها
ALLOW_DB_TESTS=true npm run test:permissions   # + ۱۰ بررسی واقعی روی دیتابیس
```

---

## خلاصهٔ عملکرد مشتری (مودال «جزئیات مشتری» داشبورد کارشناس)

کلید «جزئیات مشتری» روی کارت‌های تسک داشبورد، مودالی باز می‌کند که **پروندهٔ کوتاه**
مرغدار است: KPI کل + دوره‌های پرورش + سابقهٔ سالن‌ها + شاخص‌های پایان دوره.

### API
```
GET /api/dashboard/customer/:id/performance?flockId=<شناسهٔ جوجه‌ریزی یا گله>
دسترسی: dashboard.customerDetails
```
پاسخ:
```jsonc
{ "customer": { … }, 
  "summary":  { "flocksTotal","flocksActive","flocksCompleted","totalChicks","totalMortality",
                "mortalityRate","survivalRate","totalFeed","lastWeight","avgFcr","totalWeeks","lastPlacementDate","hallsCount","unitsCount" },
  "flocks":  [ { "key","flockId","singleHall","flockNumber","unitName","startDate","endDate","status",
                  "trend": { "weeks":[1,2,3], "dates":[…], "weight":[…], "fcr":[…], "mortality":[…] },
                  "halls":[ { "hallName","chicks","finalChicks","mortalityRate","feed","lastWeight","fcr","weeksCount",
                              "economics": { "income","chickCost","feedCost","otherCost","totalCost","profit","profitPercent",
                                             "liveWeight","declaredWeight","estimated" } | null } ],
                  "kpi":{ … },
                  "economics": { "income","chickCost","feedCost","otherCost","totalCost","profit","profitPercent",
                                 "basis":{…}, "hallCount" } | null,
                  "completion": { "fcr","epi","adgGrams","survivalPercent","slaughterAgeDays", … } | null } ],
  "halls":    [ { "hallName","capacity","flocksCount","completedFlocks","lastPlacementDate",
                  "avgMortalityRate","avgFcr",
                  "economics": { "income","totalCost","profit","profitPercent","flocksCount" } | null,
                  "flocks":[ … ] } ],
  "economics":{ "totalIncome","totalCost","totalProfit","avgProfitPercent","fcrTrend",
                "byHall":[ { "hallName","income","totalCost","profit","profitPercent","flocksCount","shareOfTotalProfit" } ] } | null,
  "focus":    { "flockKey","flockId","placementId","hallId" } | null }
```

> ⚠️ **تغییر شکننده (breaking):** کلیدهای قبلی `periods / periodId / periodNumber` **حذف** و به
> `flocks / flockId / flockNumber` تغییر یافته‌اند (طبق تصمیم پروژه: «گله» واژهٔ رسمی است).
> مصرف‌کنندهٔ این endpoint فقط فرانت‌اند همین پروژه است (`dashboard.service.js`).

### فایل‌ها
| فایل | کار |
|---|---|
| `services/flockMetrics.js` | **منبع یکتای فرمول‌ها**: `summarizeWeeks` · `aggregateFlock` · `weightedAverage` · **`allocateEconomics`** · **`buildFlockTrend`** (بدون دیتابیس، قابل تست) |
| `services/customerPerformanceService.js` | ساخت `summary/flocks/halls/economics/focus` با ۴–۵ کوئری موازی (بدون N+1) |
| `controllers/dashboardController.js` → `getCustomerPerformance` | لایهٔ نازک + تعیین دسترسی مالی |
| `routes/dashboardRoutes.js` | `GET /customer/:id/performance` با `dashboard.customerDetails` |

### قواعد مهم
- **تعریف گله** = رکورد جدول `flocks`؛ جوجه‌ریزی‌های بدون `flock_id` (دادهٔ قدیمی)
  هر کدام یک **«گلهٔ تک‌سالنه»** در نظر گرفته می‌شوند تا سابقه گم نشود.
- **واژگان:** در API و مستندات این بخش، واژهٔ رسمی **«گله»** است (به‌جای «دوره»)؛
  نام فیلدها هم `flock*` شد. تنها جایی که «پایان دوره» مانده، نام همان قابلیت موجود
  (`flock_completions` / اطلاعات پایان دوره) است.
- **FCR** = `خوراک کل ÷ (آخرین وزن × جوجهٔ نهایی)` — همان فرمول `flockCompletionController`
  و `weekly.calculations.js → fcrUpToWeek` (قبلاً مودال داشبورد `خوراک ÷ آخرین وزن` حساب می‌کرد و
  عددش با «پایان دوره» نمی‌خواند).
- **وزن** در گله‌های چندسالنه = **میانگین وزنی بر اساس جوجهٔ نهایی هر سالن**.
- «آخرین وزن» = آخرین هفتهٔ دارای `weekly_weight > 0` (نه بیشترین وزن).
- `economics` و `completion` فقط وقتی برگردانده می‌شوند که کاربر مجوز **`hatchery.view`**
  داشته باشد (`userHasPermission` در کنترلر) — اطلاعات سود/هزینه در مودال برای نقش بدون این مجوز
  نمایش داده نمی‌شود.
- مسیر `/customer/:id/details` دست‌نخورده مانده و هم‌زمان پارامتر `flockId`/`flock_id` را می‌پذیرد
  (پیش‌تر فرانت `flock_id` می‌فرستاد و بک‌اند `flockId` می‌خواند ⇒ فیلتر بی‌اثر بود).

### 📈 کارت‌های نمودار روند هفتگی (مودال)
- `flocks[].trend` = تجمیع هفتگی همان گله: `weeks` / `dates` / `weight` / `fcr` / `mortality` / `feed`.
- قواعد تجمیع **عیناً** همان `weekly.aggregation.js` است:
  وزن = میانگین وزنی بر اساس **مرغ زندهٔ همان هفته** · خوراک و تلفات = مجموع سالن‌ها ·
  `FCR تجمعی = مجموع خوراک تا این هفته ÷ (وزن × مرغ زندهٔ همان هفته)`.
- این سری **از همان کوئری هفتگیِ موجود** ساخته می‌شود (بدون کوئری اضافه) و جدول کامل هفتگی
  همچنان در فرانت‌اند تنبل (lazy) لود می‌شود.

### 💰 سود و زیان به تفکیک سالن (تخصیص)
اقتصاد فقط در سطح گله ثبت می‌شود (`flock_completions`) و در سطح سالن داده‌های فیزیکی
(`flock_completion_halls`) وجود دارد؛ پس `allocateEconomics` این تخصیص را انجام می‌دهد:

| جزء | مبنا | دقت |
|---|---|---|
| درآمد | `price_per_kg × live_weight_kg` هر سالن (fallback: سهم وزن) | دقیق |
| هزینهٔ خوراک | سهم خوراک همان سالن (`declared_feed_intake` ∨ `total_feed_intake`) | دقیق |
| هزینهٔ جوجه | سهم `initial_chicks_count` همان سالن | دقیق |
| دارو/سوخت/کارگر/سایر | سهم وزن زنده | **تخصیصی** |

- زنجیرهٔ fallback وقتی مبنا صفر است: **وزن ⇒ جوجهٔ نهایی ⇒ جوجهٔ اولیه ⇒ مساوی**.
- ✅ **تضمین:** باقی‌ماندهٔ گردکردن به ردیف آخر اضافه می‌شود ⇒ **جمع هر ستون دقیقاً برابر عدد
  ثبت‌شدهٔ همان گله** (اگر `total_cost` با جمع ریزها اختلاف داشته باشد، همان معیار می‌شود).
- سالنی که وزن کشتارگاهی/خوراک ندارد با `estimated: true` علامت می‌خورد (در UI: «تقریبی» + ستاره).
- `halls[].economics` = جمع گله‌های تمام‌شدهٔ همان سالن · `economics.byHall` = فهرست سهم سالن‌ها از سود کل
  (`shareOfTotalProfit` فقط در پروندهٔ **سودده** مقدار می‌گیرد؛ در زیان کل `null` است).

### تأیید
```bash
ALLOW_DB_TESTS=true npm run test:db     # ۱۰ بررسی: ساختار (flocks) · صحت اعداد سالن با محاسبهٔ دستی ·
                                        # مجموع مشتری · گیت مجوز · ۴۰۱ · هم‌اندازی سری روند (با تاریخ‌ها) ·
                                        # جمع سود سالن‌ها = گله · درآمد vs DB · نبود کلید periods
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
- «نوع مشتری» در ثبت‌نام **اجباری** است و در ویرایش هم اگر مشتری قدیمی نوعی نداشته باشد تعیین آن الزامی است. «کد ملی» اختیاری است (**فقط ۱۰ رقم عددی**، بدون رقم کنترلی؛ ارقام فارسی/عربی هم پذیرفته و نرمال‌سازی می‌شود؛ فیلد فرم فقط عدد می‌پذیرد) ✅.

### ثبت‌نام عمومی + صف تأیید (`/api/registrations`)

| متد | مسیر | دسترسی |
|---|---|---|
| GET | `/api/registrations/config` | عمومی — `{ enabled, auto_approve, captcha_enabled, min_password_length }` |
| GET | `/api/registrations/customer-types` | عمومی — `[{ id, name }]` فقط انواع **فعال** (موج ۱۳.۷.۲؛ `publicDictLimiter` ۱۲۰/ساعت + `Cache-Control: max-age=300`) |
| POST | `/api/registrations` | عمومی — کپچا + `registerLimiter` (۵/ساعت/IP) + پرچم `registration_enabled` (+ تأیید خودکار اگر `registration_auto_approve` روشن باشد) |
| GET | `/api/registrations` | `protect` + `users.registrations.view` |
| GET | `/api/registrations/pending-count` | `protect` + `users.registrations.view` |
| GET | `/api/registrations/settings` | `protect` + `users.registrations.view` — `{ auto_approve, can_review, can_register_customer, can_toggle }` (موج ۱۳.۷.۳) |
| PUT | `/api/registrations/settings` | `protect` + `users.registrations.review` — بدنه `{ auto_approve: boolean }` (روشن‌کردن: **+** `customers.register`) |
| POST | `/api/registrations/:id/approve` | `protect` + `users.registrations.review` + `users.customer.link` |
| POST | `/api/registrations/:id/reject` | `protect` + `users.registrations.review` |

- بدنهٔ تأیید دو حالته است (موج ۱۳.۷):
  `{ customer_mode:"existing", customer_id }` یا
  `{ customer_mode:"new", customer: { customer_type_id, full_name?, national_code?, farm_name?, province?, county? } }`.
- حالت `new` **مجوز سوم** `customers.register` هم می‌خواهد؛ پرونده داخل **همان تراکنش تأیید**
  ساخته می‌شود (`MAX(customer_code)+1` زیر `LOCK TABLE`) و `mobile_number`/`email` همیشه از
  ردیف درخواست برداشته می‌شوند (بدنهٔ مدیر حق تغییرشان را ندارد).
- موبایل تکراری در `customer_personal_information` ⇒ **۴۰۹** `CUSTOMER_MOBILE_TAKEN`
  («همان پرونده را انتخاب کنید»). ممیزی: `created_customer_id` + `customer_created`.
- **موج ۱۳.۷.۲:** فرم عمومی حالا پنج فیلد پرونده را هم می‌فرستد
  (`customer_type_id` اجباری + `national_code`/`farm_name`/`province`/`county` اختیاری) و
  در همان ردیف `registration_requests` ذخیره می‌شود (مایگریشن
  `20261108000002-add-customer-fields-to-registration-requests`).
  در ثبت عمومی: نوع مشتری باید **وجود داشته و فعال** باشد و جفت استان/شهرستان در دیکشنری
  `cities` سنجیده می‌شود (fail-open فقط اگر جدول خالی/در دسترس نباشد).
  در تأیید: هر فیلدی که مدیر نفرستد **از درخواست** پر می‌شود (ارسال رشتهٔ خالی = پاک‌کردن).
- تست: `node registration-test.mjs` (`npm run test:registration` — **۱۱۷** بررسی) و
  `Frontend/registration-guard-test.mjs` (**۸۹** بررسی). مستند: `docs/REVIEW-WAVE-13.7.2.md`.

#### موج ۱۳.۷.۳ — «تأیید خودکار ثبت‌نام»

- کلید تنظیم تازه: **`registration_auto_approve`** (boolean، پیش‌فرض `false`) در
  `controllers/settingsController.js` — **در `PUBLIC_KEYS` نیست**؛ فقط به‌صورت
  `auto_approve` در `GET /api/registrations/config` به صفحهٔ `/register` می‌رسد.
- اگر روشن باشد، `POST /api/registrations` پس از ساخت ردیف،
  `services/registrationService.autoApproveRequest(request)` را اجرا می‌کند:
  همان مسیر `approveRequest` (تراکنش اتمیک + پروندهٔ مشتری + کاربر `customer`)
  با `reviewerId: null` و پرچم ممیزی `auto_approved = true`. توکنی صادر نمی‌شود.
- 🔒 اگر موبایل متقاضی از قبل در `customer_personal_information` باشد، تأیید
  خودکار **انجام نمی‌شود** (اتصال خودکار = تصاحب پروندهٔ دیگران)؛ ردیف
  `pending` می‌ماند و دلیلش در ستون `auto_approve_error` ثبت می‌شود.
- مایگریشن `20261108000003-add-auto-approval-to-registration-requests` دو ستون
  `auto_approved` (BOOLEAN NOT NULL DEFAULT false) و `auto_approve_error`
  (VARCHAR(200) NULL) را اضافه می‌کند؛ `verify-db` هم می‌شناسد.
- منبع نوشتن تنظیم: `settingsController.writeSetting(key, raw, userId)` (هم
  `PUT /api/settings/:key` و هم `PUT /api/registrations/settings`).
- مستند کامل: `docs/REVIEW-WAVE-13.7.3.md`.




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

---

## مدارک مشتری در پورتال (موج ۱۳.۱۰)

مشتری می‌تواند از `/portal` مدرک بفرستد (کارت ملی، جواز، فاکتور) — تصویر یا PDF.
این تنها مسیر **آپلود فایل** در کل پورتال است.

### 🔒 چرا پوشهٔ خصوصی و نه `uploads/`؟

`/uploads` در `server.js` **بدون احراز هویت** سرو می‌شود (فقط پسوندهای
اسکریپتی بلاک شده‌اند). مدارک هویتی مشتری هرگز نباید آن‌جا بنشیند. پس:

```
Backend/private/portal_documents/customer_<customerId>/doc_<ts>_<rand>.<ext>
```

- `Backend/private/` در `.gitignore` است (دادهٔ شخصی وارد گیت نمی‌شود).
- فایل فقط از `GET /api/portal/documents/:id/file` و با هدر `Authorization` بیرون می‌آید
  (`res.download` ⇒ همیشه `attachment`).
- نام فایل روی دیسک **تصادفی** است و پسوند از نگاشت mime مجاز ساخته می‌شود، نه از نام کاربر.

### API (`/api/portal/documents`)

| متد | مسیر | کلید مجوز | نکته |
|---|---|---|---|
| `GET` | `/api/portal/documents` | `customer.portal.documents` | فهرست + سهمیه (`meta`) |
| `POST` | `/api/portal/documents` | `.documents` + `.documents.upload` | `FormData`: `file`/`title`/`kind` · `portalWriteLimiter` · سهمیه پیش از multer |
| `GET` | `/api/portal/documents/:id/file` | `.documents` + `requireOwnedRow` | `res.download` با مرز مسیر |
| `DELETE` | `/api/portal/documents/:id` | `.documents` + `.documents.delete` | **حذف نرم** (فایل می‌ماند) |

### سقف‌ها (منبع واحد: `services/portalDocumentRules.js`)

| مورد | مقدار |
|---|---|
| هر فایل | ۵ مگابایت · فقط `image/jpeg`/`image/png`/`image/webp`/`application/pdf` |
| هر پرونده | ۱۰ مدرک و ۲۵ مگابایت مجموع |
| سنجش سهمیه | **پیش از** multer ⇒ هیچ فایل یتیمی ساخته نمی‌شود |

### حذف نرم

مدل `PortalDocument` با `paranoid: true` است (هم‌الگو با `Hall`/`Unit`).
`DELETE` فقط `deleted_by` را می‌نویسد و `destroy()` می‌کند: ردیف از دید مشتری
پنهان می‌شود، سهمیه آزاد می‌گردد، دانلود با همان `id` **۴۰۴** می‌دهد، ولی
**فایل روی دیسک می‌ماند** برای بازبینی کارشناس (هیچ `unlink` ای در این موج نیست).

### مایگریشن

`20261109000000-create-portal-documents.js` — جدول `portal_documents` + سه ایندکس
(`customer_created` · `customer_kind` · `deleted_at`)، idempotent، با `down`.
پس از استقرار: `npm run db:migrate && npm run db:verify`.

---

## درخواست‌های فارم: درخواست مشتری + تأیید کارشناس (موج ۱۳.۱۱)

مشتری از پورتال **درخواست** ثبت واحد/سالن/جوجه‌ریزی می‌فرستد. تا تأیید کارشناس
هیچ ردیفی در `units`/`halls`/`chick_placements` ساخته نمی‌شود (الگوی ب).

### 🔒 چهار مرز امنیتی

1. **`customer_id` فقط از توکن** (`req.customerScopeId`) — هیچ فیلدی از بدنه/کوئری خوانده نمی‌شود.
2. **فهرست سفید payload** در `services/portalRequestRules.js` (یک منبع): `customer_id`/`status`/`reviewed_by`/`role` هرگز ذخیره نمی‌شوند.
3. **تأیید = تراکنش**: `sequelize.transaction()` + `lock: LOCK.UPDATE` + شرط `status='pending'` ⇒ تأیید دوباره ۴۰۹ (`already_reviewed`) و شکست هر مرحله ⇒ `rollback` کامل.
4. **مرز نقش‌ها**: مسیرهای مشتری `authorize("customer")` دارند؛ مسیرهای صف (`/api/portal-requests`) ندارند و با `portal.requests.view`/`.review` محافظت می‌شوند.

### API مشتری (`/api/portal/farm/*`)

| متد | مسیر | کلید مجوز | نکته |
|---|---|---|---|
| `GET` | `/api/portal/farm/options` | `customer.portal.farm` | واحد/سالن/گلهٔ خودم + دیکشنری فعال + سقف‌ها |
| `GET` | `/api/portal/farm/requests` | `customer.portal.farm` | فهرست درخواست‌های خودم + شمارنده‌ها |
| `POST` | `/api/portal/farm/requests` | `.farm` + `.farm.request` + `portalWriteLimiter` | `{ request_type, payload }` — پاک‌سازی + اعتبارسنجی + سقف |
| `POST` | `/api/portal/farm/requests/:id/cancel` | `.farm` + `.farm.cancel` + `requireOwnedRow` | فقط `pending` |

### API صف کارکنان (`/api/portal-requests`)

| متد | مسیر | کلید مجوز |
|---|---|---|
| `GET` | `/api/portal-requests` | `portal.requests.view` (فیلتر status/type/search + صفحه‌بندی) |
| `GET` | `/api/portal-requests/pending-count` | `portal.requests.view` |
| `GET` | `/api/portal-requests/:id` | `portal.requests.view` |
| `POST` | `/api/portal-requests/:id/approve` | `portal.requests.review` (`payload` اختیاری = اصلاح پیش از تأیید) |
| `POST` | `/api/portal-requests/:id/reject` | `portal.requests.review` (دلیل ۳..۳۰۰ اجباری) |

### قواعد اعمال

| نوع | قاعده |
|---|---|
| `unit_create` | یکتایی `(customer_id, unit_name)` ⇒ ۴۰۹ · `address`/`manager_*` از پروندهٔ مشتری تکمیل · `validateUnitData` روی دادهٔ نهایی |
| `hall_create` | واحد باید مال خودم · شماره/ترتیب خودکار مثل `hallController` · `units.hall_count` همگام |
| `placement_create` | سالن مال خودم و متعلق به همان واحد · سالن بدون جوجه‌ریزی فعال (`hall_busy`) · گله از `services/flockResolver` (مشترک با ماژول کارشناسان) |

### سقف‌ها (منبع واحد: `services/portalRequestRules.js`)

| مورد | مقدار |
|---|---|
| در انتظار | ۱۰ درخواست باز برای هر پرونده (`too_many_pending`, ۴۲۹) |
| payload | ۴ کیلوبایت (`payload_too_large`) |
| دلیل رد | ۳ تا ۳۰۰ کاراکتر |
| تکرار | همان نوع + همان کلید طبیعی، تا تعیین تکلیف ⇒ ۴۰۹ `duplicate_pending` |

### مایگریشن و تست

`20261110000000-create-portal-requests.js` — جدول `portal_requests` + سه ایندکس
(`customer_status_created` · `status_created` · `type_status`)، idempotent، با `down`.

```bash
npm run db:migrate && npm run db:verify
npm run test:portal-requests     # ۳۷ بررسی خالص (بدون دیتابیس)
npm run test:permissions         # ۲۲۵ کلید / ۱۸ گروه
```

📄 گزارش کامل: `docs/REVIEW-WAVE-13.11.md`.




## هستهٔ نوشتن فارم: یک منبع برای کارشناس و پورتال (موج ۱۳.۱۲)

تا ۱۳.۱۱ منطق نوشتن واحد/سالن/جوجه‌ریزی/هفتگی **داخل کنترلرهای کارشناس** بود
و مسیر «تأیید درخواست مشتری» نسخهٔ دومِ همان منطق را داشت. با تازه‌شدن دامنهٔ
درخواست‌ها (جزئیات سالن، مدیریت جوجه‌ریزی و کل چرخهٔ هفتگی)، هر دو مسیر اکنون
از **یک** هسته استفاده می‌کنند:

```
Backend/services/farm/
  writeErrors.js        FarmWriteError + fail/failValidation/throwIfUnique/httpErrorOf
  transaction.js        runInTransaction(work, existingTx) + safeRollback
  httpBridge.js         sendFarmError(res, error, fallback)
  unitWrite.js          createUnit / updateUnit / deleteUnit  (+ نام خودکار سالن، حذف آبشاری)
  hallWrite.js          createHall / updateHall / deleteHall  (+ شماره/ترتیب، hall_count)
  hallDetailsWrite.js   savePhysicalInfo / saveSystem / saveWaterFeed / saveHygiene
  placementWrite.js     create/update/delete/activate/deactivate + deleteFlockGroup
  weeklyWrite.js        createWeekly / updateWeekly / deleteWeekly (+ ترتیب/تکرار هفته)
Backend/validations/hallDetailValidation.js   قاعدهٔ خالص چهار حوزهٔ جزئیات سالن
```

### 🔒 چهار قاعدهٔ تغییرناپذیر

1. **کنترلر = پوسته**: هیچ کنترلر نوشتنی منطق محلی ندارد؛ فقط
   `service.*(...)` را صدا می‌زند و با `sendFarmError` خطا را به HTTP نگاشت می‌کند.
   (گارد: `customer-portal-guard-test` بخش ۱۳.۱۲ و `farm-write-test`.)
2. **مرز تراکنش در سرویس**: `runInTransaction(work, existingTx)` — اگر تراکنش
   داده شود، **هیچ** commit/rollback نمی‌کند؛ پس تأیید درخواست پورتال می‌تواند
   نوشتن ردیف واقعی را داخل تراکنش خودش انجام دهد.
3. **اعتبارسنجی یک نسخه**: `validations/unitValidation` · `chickPlacementValidation` ·
   `weeklyValidation` · `hallDetailValidation` — همهٔ پیام‌های فارسی از همین‌ها می‌آیند.
4. **فهرست سفید ویرایش**: `UNIT_UPDATE_FIELDS` · `HALL_UPDATE_FIELDS` ·
   `PLACEMENT_UPDATE_FIELDS` · `WEEKLY_UPDATE_FIELDS` — `customer_id`/`id` هرگز
   از بدنهٔ کلاینت نوشته نمی‌شود.

### پیام‌ها و رفتار حفظ‌شده

همهٔ پیام‌های فارسی، کدهای وضعیت (۴۰۰/۴۰۴/۴۰۹)، نام خودکار سالن‌ها
(«سالن A - نام واحد»)، شماره/ترتیب خودکار سالن، همگام‌سازی `units.hall_count`،
قاعدهٔ «یک جوجه‌ریزی فعال در هر سالن»، ترتیب/تکرار هفته و شکل خروجی هفتگی
**بدون تغییر** ماندند. تنها سه بهبود کوچک: اعتبارسنجی واحد پیش از باز شدن
تراکنش (رفع نشتی)، فهرست سفید ویرایش سالن (به‌جای `hall.update(req.body)`)
و تکمیل `customer_id` بهداشت سالن از خود ردیف سالن.

### تست

```bash
npm run test:farm-write       # ۳۹ بررسی خالص (بدون دیتابیس)
npm run test:portal-requests  # ۷۰ بررسی
npm run lint                  # ۰ خطا
```

📄 گزارش کامل: `docs/REVIEW-WAVE-13.12.md`.

## نوشتن کامل پورتال مشتری — ۸ نوع تازهٔ درخواست (موج ۱۳.۱۳)

خریدار/مشتری از پورتال می‌تواند **ویرایش/حذف واحد و سالن** و **ثبت چهار حوزهٔ
اطلاعات تکمیلی سالن** را درخواست کند؛ نوشتن واقعی همچنان فقط پس از تأیید
کارشناس و **در همان تراکنش تأیید** انجام می‌شود.

| موضوع | مقدار |
|---|---|
| انواع تازه | `unit_update` · `unit_delete` · `hall_update` · `hall_delete` · `hall_physical_save` · `hall_system_save` · `hall_water_feed_save` · `hall_hygiene_save` |
| قواعد | `services/portalRequestRules.js` — فهرست سفید چهار حوزه از `validations/hallDetailValidation.FIELDS` مشتق می‌شود (بدون `unit_id`) |
| اعمال | `services/portalRequestService.js` → `APPLIERS` / `HALL_DETAIL_APPLIERS` → `services/farm/*` با `{ transaction }` |
| مالکیت | `requireOwnedUnit` / `requireOwnedHall` با `SELECT … FOR UPDATE` داخل تراکنش؛ ردیف غیرخودی ⇒ ۴۰۴ |
| حذف واحد | بازتایپ `confirm_name` (حذف آبشاری: سالن‌ها، گله‌ها، هفته‌ها، بازدیدها، نشان‌ها) |
| آرایهٔ تجهیزات | `hall_system_save.items[]` با فهرست سفید ردیف و سقف ۶۰ ردیف |
| سقف payload | **۸KB** (از ۴KB؛ برای جا شدن ۶۰ ردیف تجهیزات) |
| اندپوینت تازه | `GET /api/portal/farm/halls/:id` (پیش‌پرکردن فرم ویرایش + پرچم‌های `has_*`) |
| مجوزها | بدون کلید تازه (همان `customer.portal.farm` + `.request`) |
| مهاجرت | ندارد (payload از قبل JSONB است) |

📄 گزارش کامل: `docs/REVIEW-WAVE-13.13.md`.

## مدیریت دوره و اطلاعات هفتگی از پورتال — ۷ نوع تازه (موج ۱۳.۱۴)

| موضوع | مقدار |
|---|---|
| انواع تازه | `placement_update` · `placement_delete` · `placement_activate` · `placement_deactivate` · `weekly_create` · `weekly_update` · `weekly_delete` |
| قواعد | `services/portalRequestRules.js` — دوره با `validateChickPlacement`، هفته با `validations/weeklyValidation.validateWeeklyData` (بدون نسخهٔ دوم) |
| آیتم‌های هفته | `disease_ids` · `vaccine_ids` · `medicine_ids` · `feed_type_ids` · `suggestion_ids` — آرایهٔ شناسه با سقف ۱۰۰ و حذف تکراری |
| اعمال | `placementWrite.*` و `weeklyWrite.*` با `{ transaction }` داخل تراکنش تأیید |
| مالکیت | `requireOwnedPlacement` / `requireOwnedWeekly` با `SELECT … FOR UPDATE`؛ ردیف غیرخودی ⇒ ۴۰۴ |
| دورهٔ غیرفعال | ثبت/ویرایش هفته ⇒ خطای `flock_inactive` با پیام روشن |
| اندپوینت تازه | `GET /api/portal/farm/placements/:id` (دوره + هفته‌های ثبت‌شده) |
| گزینه‌ها | `optionsFor`: `placements[]` + پنج دیکشنری هفتگی |
| مجوزها | بدون کلید تازه (۱۹۷ کلید / ۱۸ گروه دست‌نخورده) |

📄 گزارش کامل: `docs/REVIEW-WAVE-13.14.md`.

## جزئیات یک هفته از نگاه مشتری — پیش‌نیاز رابط کاربری ۱۳.۱۵ (موج ۱۳.۱۵)

فرم «ویرایش اطلاعات هفتگی» در پورتال به اعداد دان/خاموشی/توضیحات و
**پنج آرایهٔ شناسه** نیاز دارد، ولی `placementDetailsFor` عمداً فقط
ستون‌های سبک هفته را برای فهرست انتخاب برمی‌گرداند. یک اندپوینت تازه
این شکاف را می‌بندد:

| موضوع | مقدار |
|---|---|
| اندپوینت | `GET /api/portal/farm/weeklies/:id` |
| خروجی | `{ weekly: { id, week_number, تاریخ‌ها, تلفات, وزن, دان روزانه/هفتگی, خاموشی, توضیحات, disease_ids[], vaccine_ids[], medicine_ids[], feed_type_ids[], suggestion_ids[] } }` |
| خواندن | `weeklyWrite.loadWeeklyRecord` + `weeklyWrite.formatWeeklyRecord` (بدون نسخهٔ دوم) |
| مالکیت | `requireOwnedRow({ model: WeeklyManagement, label: "هفته" })` + `where: { id, customer_id }` ⇒ ۴۰۴ برای هفتهٔ غیرخودی |
| سقف نوشتن | ندارد (فقط خواندن) |
| شمارش GET پورتال | ۱۹ ⇒ **۲۰** |
| آزمون | `Backend/portal-request-test.mjs` — ۴ بررسی تازه (۷۴ در کل) |

📄 گزارش کامل: `docs/REVIEW-WAVE-13.15.md`.

## «نمایش نامدار» درخواست‌ها در صف کارشناس (موج ۱۳.۱۶)

کارشناس پیش از تأیید `breed_id: 3` و «۵ ردیف» می‌دید؛ یعنی ده نوع هفتگی و
چهار نوع جزئیات سالن **بدون دانستن محتوا** تأیید می‌شد. این موج مقدارها را
خوانا می‌کند و برایش هیچ نوع درخواست تازه‌ای اضافه نمی‌کند.

| موضوع | مقدار |
|---|---|
| دیکشنری‌ها | `DICTIONARY_MODELS` — **یک** فهرست ۱۶تایی (`loadDictionaries`) که هم `optionsFor` پورتال و هم صف از آن می‌خوانند |
| اندپوینت تازه | `GET /api/portal-requests/dictionaries` — `{ dictionaries: { breeds:[{id,name}], … } }`، فقط ردیف‌های `active` |
| مجوز | `portal.requests.view` (نه `dictionary.*.view` که مدیریتی است) — بازبین صف مجوز مدیریت دیکشنری نمی‌خواهد |
| ترتیب مسیر | قبل از `/:id` ثبت شده؛ وگرنه `/:id` مقدار «dictionaries» را شناسهٔ درخواست می‌گیرد |
| زمینهٔ درخواست | `GET /api/portal-requests/:id` ⇒ `{ request, context }`؛ `context = { units, halls, placements, weeklies, flocks }` با برچسب کوتاه |
| اسکوپ زمینه | با `customer_id` **همان درخواست**؛ شناسهٔ مشتری هرگز پارامتر نمی‌شود و هیچ PII (تلفن/کد ملی/آدرس) برنمی‌گردد |
| بدون مدل مشتری | `Unit/Hall/ChickPlacement/WeeklyManagement/CustomerPersonalInfo` در `DICTIONARY_MODELS` نیستند (گارد regex منفی) |
| آزمون | `Backend/portal-request-test.mjs` — ۶ بررسی تازه (۸۰ در کل) |

📄 گزارش کامل: `docs/REVIEW-WAVE-13.16.md`.

## ۲۸ کلید «لایهٔ منو» برای پوستهٔ ناوبری پورتال (موج ۱۳.۱۷)

موج ۱۳.۱۷ خودش سمت سرور هیچ اندپوینت یا نوع درخواست تازه‌ای ندارد؛ تنها
تغییر بک‌اند، بازکردن ۲۸ کلید مجوز است تا مدیر بتواند دیده‌شدن هر آیتم
منوی پورتال را جدا کنترل کند.

| موضوع | مقدار |
|---|---|
| کلیدهای تازه | ۲۸ کلید `customer.portal.menu.*` (۷ منو + ۲۱ زیرمنو) در همان گروه «portal» |
| شمارش کلید | ۱۹۷ ⇒ **۲۲۵** کلید / ۱۸ گروه (بدون گروه تازه) |
| پیش‌فرض | `customer: true` و سایر نقش‌ها `false` (هم‌الگو با `customer.portal.view`) |
| قفل‌شدگی | بدون `lockedTo` ⇒ هر آیتم از پنل مدیریت باز/بسته می‌شود |
| دو لایه | کلید منو = دیده‌شدن؛ کلید محتوا (`customer.portal.farm/…`) = دسترسی داده که سرور اجرا می‌کند |
| اندپوینت تازه | ندارد — همان ۲۱ GET قبلی پورتال |
| آزمون | `permissions-test.mjs` — انتظار ۲۲۵ کلید / ۱۸ گروه + آینگی نسخهٔ فرانت |

📄 گزارش کامل: `docs/REVIEW-WAVE-13.17.md`.

