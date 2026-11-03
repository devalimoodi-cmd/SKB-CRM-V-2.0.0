// ============================================================
// models/ActivityLog.js
// «ردّ فعالیت» (Activity Log) — هر تغییر وضعیت = یک ردیف (فاز ۱۲.۲)
// ------------------------------------------------------------
// چرا این جدول؟
//   سؤال «چه کسی، چه زمانی، کدام رکورد را عوض کرد؟» تا امروز بی‌جواب
//   بود: فقط created_by/updated_by روی خودِ رکورد مانده بود و اگر همان
//   ردیف بعداً حذف می‌شد، هیچ نشانه‌ای باقی نمی‌ماند.
//   با activity_logs هر POST/PUT/PATCH/DELETE (+ ورود/خروج) یک ردیف
//   می‌سازد ⇒ تاریخچهٔ مستقل از موجودیت.
// ------------------------------------------------------------
// ⚠️ بدون FK به users و با «عکس» username/role (مثل UserSession و
//    PermissionAuditLog) تا تاریخچه بعد از حذف کاربر هم معنا بماند.
// ⚠️ ایندکس‌ها در مایگریشن ساخته می‌شوند (نه اینجا) تا تعریف ستون‌ها
//    تنها یک منبع حقیقت داشته باشد: migrations/20261004020000-*.
//    ستون customer_id و ایندکس آن در migrations/20261005000000-* می‌آید
//    (موج ۱۲.۵ — «همهٔ تغییرات یک مشتری»).
// ⚠️ `session_id` فقط برای همبستگی با user_sessions است و در
//    services/activityRules.js#buildItem هرگز به بیرون برنمی‌گردد.
// ------------------------------------------------------------
// منطق خالص (چه چیزی ثبت شود، ماسک کردن رمز، شرح فارسی) در
// services/activityRules.js است — این فایل فقط تعریف ستون‌هاست.
// ============================================================
const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const ActivityLog = sequelize.define(
  "ActivityLog",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "کاربر (بدون FK — تاریخچه پس از حذف کاربر می‌ماند)",
    },
    username: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "عکس نام کاربری در لحظهٔ رویداد (یا نام تلاش‌شده در ورود ناموفق)",
    },
    role: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: "عکس نقش کاربر در لحظهٔ رویداد",
    },
    action: {
      type: DataTypes.STRING(20),
      allowNull: false,
      comment: "create | update | delete | read | login | logout",
    },
    method: {
      type: DataTypes.STRING(10),
      allowNull: false,
      comment: "متد HTTP",
    },
    path: {
      type: DataTypes.STRING(300),
      allowNull: false,
      comment: "مسیر واقعی درخواست (بدون query)",
    },
    route: {
      type: DataTypes.STRING(300),
      allowNull: true,
      comment: "الگوی مسیر Express (مثل /:id) برای الگوکاوی",
    },
    entity: {
      type: DataTypes.STRING(80),
      allowNull: true,
      comment: "موجودیت هدف (customers / halls / users ...)",
    },
    entity_id: {
      type: DataTypes.STRING(64),
      allowNull: true,
      comment: "شناسهٔ رکورد هدف (رشته: عدد یا UUID)",
    },
    customer_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment:
        "مشتریِ مرتبط (موج ۱۲.۵ — بدون FK مثل user_id؛ از بدنهٔ درخواست یا استنتاج زمان flush)",
    },
    status_code: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "کد پاسخ HTTP",
    },
    success: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "آیا عملیات موفق بود؟ (۲xx/۳xx)",
    },
    ip: {
      type: DataTypes.STRING(64),
      allowNull: true,
      comment: "آی‌پی درخواست‌کننده",
    },
    user_agent: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: "User-Agent مرورگر/دستگاه",
    },
    session_id: {
      type: DataTypes.STRING(64),
      allowNull: true,
      comment: "sid نشست (همبستگی با user_sessions — هرگز در API بیرون نمی‌رود)",
    },
    fields: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment:
        "نام فیلدهای بدنه (مقدار فقط با ACTIVITY_LOG_VALUES=true · فیلدهای حساس همیشه ***)",
    },
    summary: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: "شرح فارسی رویداد برای نمایش سریع در پنل",
    },
    duration_ms: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "مدت پردازش درخواست (میلی‌ثانیه)",
    },
  },
  {
    tableName: "activity_logs",
    timestamps: true,
    underscored: true,
  },
);

module.exports = ActivityLog;
