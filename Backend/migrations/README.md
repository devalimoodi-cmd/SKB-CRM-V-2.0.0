# مایگریشن‌های دیتابیس (Sequelize Migrations)

از این پس هر تغییری در **ساختار دیتابیس** (اضافه/حذف ستون، جدول، ایندکس…)
باید به‌صورت «مایگریشن» ثبت شود؛ نه دستی روی دیتابیس.

## چرا؟
- روی سرور، دیتابیس با یک دستور هم‌سطح کد می‌شود: `npm run db:migrate`
- تاریخچهٔ تغییرات ساختار مشخص است و روی چند محیط (تست/اصلی) قابل تکرار است.
- `sequelize.sync` در این پروژه **غیرفعال** است تا دستی/تصادفی جدول‌ها تغییر نکنند.

## دستورها

```bash
npm run db:migrate      # اعمال مایگریشن‌های جدید
npm run db:status       # دیدن وضعیت (کدام‌ها اجرا شده‌اند)
npm run db:rollback     # برگرداندن آخرین مایگریشن
npm run db:verify       # ✅ تأیید خواندنی ساختار: جدول‌ها، ستون‌ها، ایندکس‌ها، مایگریشن‌ها
npm run db:seed         # اجرای seedها (داده‌های اولیه)
npm run db:schema       # گرفتن اسنپ‌شات ساختار فعلی دیتابیس (db/schema-*.sql)
```

## ⛔ هرگز `sequelize.sync` نزنید
`sync({ alter: true })` می‌تواند ستون/ایندکس را حذف یا نوع را عوض کند.
هر تغییر ساختار **فقط** با مایگریشن انجام می‌شود. (توضیح کامل در `db/README.md`)

## چک‌لیست استقرار روی سرور
```bat
:: ویندوز
backup.bat          :: ۱) بکاپ
deploy.bat          :: ۲) کد + پکیج‌ها + db:migrate + db:verify
                    ::    (روی سرور آفلاین:  deploy.bat --no-git --no-npm)
npm run db:verify   :: ۳) تأیید ساختار دیتابیس
:: ۴) ری‌استارت بک‌اند و فرانت
```

```bash
# لینوکس / PM2 (توصیه‌شده)
bash deploy.sh      # git pull + npm ci + db:migrate + db:verify + pm2 restart
npm run db:verify   # فقط تأیید ساختار
```

## مایگریشن‌های فعال (خلاصه)

| فایل | ساختار |
|---|---|
| `20260915120000-create-suggestions.js` | `suggestions` + `suggestion_messages` (گفتگوی کاربر ↔ ادمین) |
| `20260916130000-create-release-notes.js` | `release_notes` + `release_note_items` + `release_note_views` («تغییرات جدید / What's New») |
| `20260919120000-customer-type-and-national-code.js` | `customer_types` (دیکشنری «انواع مشتری» + ۴ آیتم پیش‌فرض: گوشتی/تخم‌گذار/مرغ مادر/سایر) و افزودن `national_code` و `customer_type_id` به `customer_personal_information` |

هر سه مایگریشن **idempotent** هستند (اگر جدول/ستون موجود باشد، دست نمی‌زنند) تا اجرای دوباره روی سرور خطا ندهد.

## ساخت مایگریشن جدید

```bash
npx sequelize-cli migration:generate --name add-some-column-to-halls
```
سپس فایل ساخته‌شده در همین پوشه را باز کن و `up`/`down` را کامل کن، مثلاً:

```js
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("halls", "new_field", {
      type: Sequelize.STRING(50),
      allowNull: true,
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn("halls", "new_field");
  },
};
```
و در آخر روی سرور: `npm run db:migrate`

## وضعیت فعلی پروژه

- جدول `SequelizeMeta` فقط برای ثبت «کدام مایگریشن اجرا شده» ساخته می‌شود.
- اسکیما فعلی (baseline) به‌صورت فایل SQL در `Backend/db/` نگه‌داری می‌شود
  (برای نصب روی سرور جدید یا مقایسهٔ تغییرات). راهنمای بازیابی در `db/README.md`.
- برای سرور جدید: ابتدا اسنپ‌شات را restore کن (`db/schema-*.sql`) و بعد
  `npm run db:migrate` را بزن تا مایگریشن‌های بعدی هم اعمال شوند.
