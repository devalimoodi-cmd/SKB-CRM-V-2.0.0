const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = sequelize.define(
  "User",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    first_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: { msg: "نام الزامی است" },
        len: { args: [2, 100], msg: "نام باید بین 2 تا 100 کاراکتر باشد" },
      },
    },
    last_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: { msg: "نام خانوادگی الزامی است" },
        len: {
          args: [2, 100],
          msg: "نام خانوادگی باید بین 2 تا 100 کاراکتر باشد",
        },
      },
    },
    username: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: { msg: "این نام کاربری قبلاً ثبت شده است" },
      validate: {
        notEmpty: { msg: "نام کاربری الزامی است" },
        len: { args: [3, 100], msg: "نام کاربری باید حداقل 3 کاراکتر باشد" },
      },
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: { msg: "این ایمیل قبلاً ثبت شده است" },
      validate: {
        isEmail: { msg: "ایمیل معتبر نیست" },
        notEmpty: { msg: "ایمیل الزامی است" },
      },
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: "password",
      validate: {
        notEmpty: { msg: "رمز عبور الزامی است" },
        len: { args: [6, 255], msg: "رمز عبور باید حداقل 6 کاراکتر باشد" },
      },
    },
    mobile_number: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: { msg: "این شماره موبایل قبلاً ثبت شده است" },
      validate: {
        notEmpty: { msg: "شماره موبایل الزامی است" },
        is: { args: /^09[0-9]{9}$/, msg: "شماره موبایل معتبر نیست" },
      },
    },
    role: {
      type: DataTypes.STRING(20), // ✅ به جای ENUM
      defaultValue: "customer",
      validate: {
        isIn: {
          args: [["super_admin", "admin", "sub_admin", "expert", "customer"]],
          msg: "نقش کاربر معتبر نیست",
        },
      },
    },
    status: {
      type: DataTypes.STRING(20), // ✅ تغییر
      defaultValue: "pending",
      validate: {
        isIn: {
          args: [["active", "inactive", "pending", "blocked"]],
          msg: "وضعیت کاربر معتبر نیست",
        },
      },
    },
    token: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: "token",
    },
    token_expires_at: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "token_expires_at",
    },
    profile_image: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "profile_image",
    },
    phone_number: {
      type: DataTypes.STRING(20),
      allowNull: true,
      field: "phone_number",
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    bio: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    last_login: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "last_login",
    },
    last_login_ip: {
      type: DataTypes.STRING(45),
      allowNull: true,
      field: "last_login_ip",
    },
    failed_login_attempts: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: "failed_login_attempts",
    },
    locked_until: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "locked_until",
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "created_by",
      references: {
        model: "users",
        key: "id",
      },
    },
    updated_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "updated_by",
      references: {
        model: "users",
        key: "id",
      },
    },
    online_status: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: "online_status",
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: "isActive",
    },
  },

  {
    tableName: "users",
    timestamps: true,
    underscored: true,
    hooks: {
      beforeCreate: async (user) => {
        if (user.password) {
          user.password = await bcrypt.hash(user.password, 10);
        }
      },
      beforeUpdate: async (user) => {
        if (user.changed("password")) {
          user.password = await bcrypt.hash(user.password, 10);
        }
      },
    },
    indexes: [
      {
        unique: true,
        fields: ["email"],
      },
      {
        unique: true,
        fields: ["username"],
      },
      {
        unique: true,
        fields: ["mobile_number"],
      },
      {
        fields: ["role"],
      },
      {
        fields: ["status"],
      },
      {
        fields: ["created_at"],
      },
    ],
  },
);

// ============================================
// متدهای نمونه (Instance Methods)
// ============================================

// مقایسه رمز عبور
User.prototype.comparePassword = async function (password) {
  return await bcrypt.compare(password, this.password);
};

// تولید توکن JWT
User.prototype.generateToken = function () {
  const token = jwt.sign(
    {
      id: this.id,
      username: this.username,
      email: this.email,
      role: this.role,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || "7d" },
  );
  return token;
};

// بررسی انقضای توکن
User.prototype.isTokenExpired = function () {
  if (!this.token_expires_at) return true;
  return new Date() > new Date(this.token_expires_at);
};

// بررسی قفل بودن حساب
User.prototype.isLocked = function () {
  if (!this.locked_until) return false;
  return new Date() < new Date(this.locked_until);
};

// افزایش تعداد تلاش‌های ناموفق
User.prototype.incrementFailedAttempts = async function () {
  const newAttempts = (this.failed_login_attempts || 0) + 1;

  // بعد از 5 تلاش ناموفق، حساب را به مدت 30 دقیقه قفل کن
  if (newAttempts >= 5) {
    await this.update({
      failed_login_attempts: newAttempts,
      locked_until: new Date(Date.now() + 30 * 60 * 1000), // 30 دقیقه
    });
  } else {
    await this.update({ failed_login_attempts: newAttempts });
  }
};

// ریست تلاش‌های ناموفق
User.prototype.resetFailedAttempts = async function () {
  await this.update({
    failed_login_attempts: 0,
    locked_until: null,
  });
};

// حذف فیلدهای حساس هنگام تبدیل به JSON
User.prototype.toJSON = function () {
  const values = { ...this.get() };
  delete values.password;
  delete values.token;
  delete values.failed_login_attempts;
  delete values.locked_until;
  return values;
};

// ============================================
// متدهای کلاس (Static Methods)
// ============================================

// پیدا کردن کاربر با ایمیل یا نام کاربری
User.findByCredential = async function (username) {
  return await this.findOne({
    where: {
      [sequelize.Op.or]: [{ email: username }, { username: username }],
    },
  });
};

// بررسی وجود ایمیل
User.isEmailExists = async function (email, excludeId = null) {
  const where = { email };
  if (excludeId) {
    where.id = { [sequelize.Op.ne]: excludeId };
  }
  const user = await this.findOne({ where });
  return !!user;
};

// بررسی وجود نام کاربری
User.isUsernameExists = async function (username, excludeId = null) {
  const where = { username };
  if (excludeId) {
    where.id = { [sequelize.Op.ne]: excludeId };
  }
  const user = await this.findOne({ where });
  return !!user;
};

// دریافت کاربران فعال
User.getActiveUsers = async function () {
  return await this.findAll({
    where: { status: "active" },
    order: [["created_at", "DESC"]],
    attributes: { exclude: ["password", "token"] },
  });
};

// دریافت کاربران بر اساس نقش
User.getUsersByRole = async function (role) {
  return await this.findAll({
    where: { role },
    order: [["created_at", "DESC"]],
    attributes: { exclude: ["password", "token"] },
  });
};

module.exports = User;
