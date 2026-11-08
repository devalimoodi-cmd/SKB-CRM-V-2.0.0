"use strict";

// ============================================================
//  پنج ستون «اطلاعات پروندهٔ مشتری» روی registration_requests — موج ۱۳.۷.۲
// ------------------------------------------------------------
//  چه چیزی اضافه می‌شود؟
//    • customer_type_id : نوع مشتری انتخاب‌شدهٔ متقاضی (کلید customer_types)
//    • national_code    : کد ملی ۱۰ رقمی (اختیاری)
//    • farm_name        : نام واحد/مزرعه (اختیاری)
//    • province         : استان از دیکشنری cities.state_name (اختیاری)
//    • county           : شهرستان از دیکشنری cities.city_name (اختیاری، وابسته به استان)
// ------------------------------------------------------------
//  چرا لازم است؟
//    • تا پیش از این موج، متقاضی فقط حساب می‌ساخت و مدیر هنگام تأیید مجبور بود
//      نوع مشتری/کد ملی/نام واحد/استان/شهرستان را **دستی** وارد کند.
//    • از این موج، خود متقاضی این داده‌ها را در صفحهٔ /register می‌فرستد و در
//      همان ردیف درخواست ذخیره می‌شود؛ تأیید مدیر این مقادیر را (در صورت خالی
//      بودن فرم مدیر) به پروندهٔ مشتری منتقل می‌کند.
//    • همهٔ ستون‌ها NULL-پذیر هستند تا درخواست‌های قدیمی و فرم‌های ناقص نشکنند.
//    • بدون FOREIGN KEY (هم‌الگو با created_customer_id) تا حذف یک نوع مشتری
//      تاریخچهٔ درخواست را از بین نبرد؛ درستی مقدار در لایهٔ API سنجیده می‌شود.
// ------------------------------------------------------------
//  idempotent است: اگر ستون‌ها موجود باشند کاری نمی‌کند.
//  اجرا:   npm run db:migrate     سپس  npm run db:verify
//  برگشت:  npm run db:rollback
//  ⛔ هرگز sequelize.sync نزن — رجوع: Backend/migrations/README.md
// ============================================================

const TABLE = "registration_requests";

// آخرین ستون حذف می‌شود، اولین ستون اول اضافه می‌شود (ترتیب برگشت مهم است)
const COLUMNS = [
  {
    name: "customer_type_id",
    definition: (Sequelize) => ({
      type: Sequelize.INTEGER,
      allowNull: true,
      comment:
        "نوع مشتری انتخاب‌شده در فرم ثبت‌نام عمومی (بدون FK؛ درستی در لایهٔ API سنجیده می‌شود)",
    }),
  },
  {
    name: "national_code",
    definition: (Sequelize) => ({
      type: Sequelize.STRING(10),
      allowNull: true,
      comment: "کد ملی ۱۰ رقمی متقاضی (اختیاری) — به پروندهٔ مشتری منتقل می‌شود",
    }),
  },
  {
    name: "farm_name",
    definition: (Sequelize) => ({
      type: Sequelize.STRING(200),
      allowNull: true,
      comment: "نام واحد/مزرعهٔ متقاضی (اختیاری)",
    }),
  },
  {
    name: "province",
    definition: (Sequelize) => ({
      type: Sequelize.STRING(50),
      allowNull: true,
      comment: "استان متقاضی از دیکشنری cities.state_name (اختیاری)",
    }),
  },
  {
    name: "county",
    definition: (Sequelize) => ({
      type: Sequelize.STRING(50),
      allowNull: true,
      comment: "شهرستان متقاضی از دیکشنری cities.city_name (اختیاری، وابسته به استان)",
    }),
  },
];

const columnNames = async (queryInterface) => {
  try {
    const description = await queryInterface.describeTable(TABLE);
    return Object.keys(description || {});
  } catch {
    // جدول هنوز ساخته نشده است (مایگریشن ۱۳.۶ اجرا نشده) ⇒ کاری برای انجام نیست
    return [];
  }
};

module.exports = {
  async up(queryInterface, Sequelize) {
    const columns = await columnNames(queryInterface);
    if (columns.length === 0) return;

    for (const column of COLUMNS) {
      if (columns.includes(column.name)) continue;
      await queryInterface.addColumn(TABLE, column.name, column.definition(Sequelize));
    }
  },

  async down(queryInterface) {
    const columns = await columnNames(queryInterface);
    for (const column of [...COLUMNS].reverse()) {
      if (!columns.includes(column.name)) continue;
      await queryInterface.removeColumn(TABLE, column.name);
    }
  },
};
