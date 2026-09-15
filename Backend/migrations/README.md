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
npm run db:seed         # اجرای seedها (داده‌های اولیه)
npm run db:schema       # گرفتن اسنپ‌شات ساختار فعلی دیتابیس (db/schema-*.sql)
```

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
