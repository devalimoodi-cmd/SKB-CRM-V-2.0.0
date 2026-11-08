// ============================================================
// models/LoginChallenge.js
// «چالش‌های ورود» — کد یک‌بارمصرف ورود دومرحله‌ای (فاز ۱۳.۱)
// ------------------------------------------------------------
// ⚠️ کد خام هرگز در این جدول ذخیره نمی‌شود؛ فقط:
//    code_hash = SHA-256(code + ":" + OTP_PEPPER)
//    ⇒ حتی با دسترسی خواندنی به دیتابیس، کد قابل استفاده نیست.
// ⚠️ بدون FK به users (هم‌الگو با UserSession / ActivityLog) تا
//    تاریخچهٔ چالش‌ها پس از حذف کاربر هم باقی بماند.
// ------------------------------------------------------------
// منطق خالص (تولید/هش/اعتبارسنجی/سقف‌ها) در services/otpService.js
// است؛ این فایل فقط تعریف ستون‌هاست.
// ============================================================
const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const LoginChallenge = sequelize.define(
  "LoginChallenge",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    challenge_id: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
      comment: "شناسهٔ عمومی چالش (به فرانت‌اند داده می‌شود)",
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "کاربر (بدون FK — تاریخچه پس از حذف کاربر می‌ماند)",
    },
    username: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "عکس نام کاربری در لحظهٔ ورود",
    },
    role: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: "عکس نقش کاربر در لحظهٔ ورود",
    },
    purpose: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "login",
      comment: "login | register | reset_password",
    },
    code_hash: {
      type: DataTypes.STRING(64),
      allowNull: false,
      comment: "SHA-256(code + ':' + OTP_PEPPER) — کد خام ذخیره نمی‌شود",
    },
    attempts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "تعداد تلاش‌های ناموفق روی همین چالش",
    },
    max_attempts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 5,
      comment: "سقف تلاش (LOGIN_OTP_MAX_ATTEMPTS)",
    },
    resend_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "چند بار کد دوباره ارسال شد",
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: "انقضای کد (پیش‌فرض: now + 180s)",
    },
    last_sent_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: "کنترل فاصلهٔ ارسال مجدد (LOGIN_OTP_RESEND_SECONDS)",
    },
    mobile_masked: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: "شمارهٔ ماسک‌شده برای نمایش (0912***4567)",
    },
    ip: {
      type: DataTypes.STRING(64),
      allowNull: true,
      comment: "آی‌پی درخواست‌کنندهٔ چالش",
    },
    ua_hash: {
      type: DataTypes.STRING(64),
      allowNull: true,
      comment: "هش User-Agent (بدون ذخیرهٔ متن کامل)",
    },
    status: {
      type: DataTypes.STRING(15),
      allowNull: false,
      defaultValue: "pending",
      comment: "pending | consumed | expired | blocked | failed | cancelled",
    },
    used_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "زمان مصرف موفق چالش (یک‌بارمصرف)",
    },
    // ✅ موج ۱۳.۸ — دادهٔ همراه چالش (فقط برای purpose=profile_mobile)
    //    🔒 هرگز کد خام این‌جا نوشته نمی‌شود؛ فقط «شمارهٔ جدید در انتظار تأیید».
    payload: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment:
        "دادهٔ همراه چالش (تغییر موبایل از پورتال: {mobile_number, requested_at})",
    },
  },
  {
    tableName: "login_challenges",
    timestamps: true,
    underscored: true,
  },
);

module.exports = LoginChallenge;
