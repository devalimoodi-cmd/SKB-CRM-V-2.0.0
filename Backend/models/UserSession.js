// ============================================================
// models/UserSession.js
// «نشست‌های کاربران» — هر ردیف = یک «ورود» به سیستم (فاز ۱۲.۱)
// ------------------------------------------------------------
// چرا این جدول؟
//   «خروج از همهٔ دستگاه‌ها» قبلاً فقط یک دکمهٔ نمایشی بود: توکن کاربر
//   در `users.token` بازنویسی می‌شد، ولی چون هر دستگاه توکن مستقل خودش
//   را دارد، تا وقتی `ENFORCE_SINGLE_SESSION=false` باشد هیچ دستگاهِ
//   دیگری واقعاً بیرون نمی‌افتاد.
//   حالا هر ورود یک ردیف + یک `sid` یکتا دارد که داخل توکن می‌رود؛
//   میدل‌ور احراز هویت هر درخواست را با sid به همین ردیف گره می‌زند
//   ⇒ «بستن یک نشست» = ۴۰۱ شدن فوریِ همان دستگاه.
// ------------------------------------------------------------
// ⚠️ بدون FK به users و با «عکس» username/role ذخیره می‌شود
//    (هم‌الگو با models/PermissionAuditLog.js) تا تاریخچه بعد از
//    حذف کاربر هم معنا داشته باشد.
// ------------------------------------------------------------
// منطق خالص (باز/بسته، تشخیص دستگاه، خلاصه) در
// services/sessionRules.js است — این فایل فقط تعریف ستون‌هاست.
// ============================================================
const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const UserSession = sequelize.define(
  "UserSession",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "کاربر (بدون FK — تاریخچه پس از حذف کاربر می‌ماند)",
    },
    username: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: "عکس نام کاربری در لحظهٔ ورود",
    },
    role: {
      type: DataTypes.STRING(20),
      allowNull: false,
      comment: "عکس نقش کاربر در لحظهٔ ورود",
    },
    sid: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
      comment: "شناسهٔ یکتای نشست (claim داخل JWT)",
    },
    ip: {
      type: DataTypes.STRING(64),
      allowNull: true,
      comment: "آی‌پی دستگاهی که با آن وارد شده",
    },
    user_agent: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: "User-Agent مرورگر/دستگاه (برچسب فارسی در sessionRules)",
    },
    started_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: "زمان شروع نشست",
    },
    last_activity_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: "آخرین فعالیت (throttle در services/sessionService.js)",
    },
    ended_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "زمان پایان نشست (null = نشست فعال)",
    },
    end_reason: {
      type: DataTypes.STRING(30),
      allowNull: true,
      comment:
        "logout | revoked | replaced | password_change | role_change | reset | expired | cleanup",
    },
    ended_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "کاربری که نشست را بست (معمولاً مدیر — بدون FK)",
    },
  },
  {
    tableName: "user_sessions",
    timestamps: true,
    underscored: true,
  },
);

module.exports = UserSession;
