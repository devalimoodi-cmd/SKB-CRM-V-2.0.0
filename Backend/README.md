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
| `config/permissions.js` | **کاتالوگ مجوزها** (۱۵۶ کلید در ۱۵ گروه) + پیش‌فرض هر ۵ نقش + کلیدهای قفل‌شده |
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

