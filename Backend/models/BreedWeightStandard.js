// ============================================================
// models/BreedWeightStandard.js
// جدول استانداردهای وزنی نژادها
// ============================================================

const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const BreedWeightStandard = sequelize.define(
  "BreedWeightStandard",
  {
    // ===== شناسه =====
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      comment: "🆔 شناسه یکتا (Primary Key)",
    },

    // ===== ارتباط با نژاد =====
    breed_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "🔗 ارجاع به جدول chicken_breeds (نژاد)",
    },

    // ===== اطلاعات هفتگی =====
    week_number: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "📊 شماره هفته (۱ تا ۱۰)",
      validate: {
        min: { args: 1, msg: "شماره هفته باید حداقل ۱ باشد" },
        max: { args: 12, msg: "شماره هفته نباید بیشتر از ۱۲ باشد" },
      },
    },

    age_days: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "📅 سن بر حسب روز",
      validate: {
        min: { args: 1, msg: "سن باید حداقل ۱ روز باشد" },
        max: { args: 100, msg: "سن نباید بیشتر از ۱۰۰ روز باشد" },
      },
    },

    // ===== استانداردهای وزنی =====
    target_weight: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: false,
      comment: "🎯 وزن هدف (کیلوگرم)",
      validate: {
        min: { args: 0.01, msg: "وزن هدف باید بیشتر از ۰ باشد" },
        max: { args: 10, msg: "وزن هدف نباید بیشتر از ۱۰ کیلوگرم باشد" },
      },
    },

    min_weight: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: true,
      comment: "📉 حداقل وزن قابل قبول (کیلوگرم)",
      validate: {
        min: { args: 0, msg: "حداقل وزن نمی‌تواند منفی باشد" },
      },
    },

    max_weight: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: true,
      comment: "📈 حداکثر وزن قابل قبول (کیلوگرم)",
      validate: {
        min: { args: 0, msg: "حداکثر وزن نمی‌تواند منفی باشد" },
      },
    },

    // ===== استاندارد خوراک و ضریب تبدیل =====
    standard_fcr: {
      type: DataTypes.DECIMAL(6, 3),
      allowNull: true,
      comment: "🍗 ضریب تبدیل غذایی استاندارد (FCR) در این هفته",
      validate: {
        min: { args: 0, msg: "FCR نمی‌تواند منفی باشد" },
      },
    },

    standard_feed_intake: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: "🛒 مصرف خوراک استاندارد تجمعی تا این هفته (کیلوگرم - کل گله)",
      validate: {
        min: { args: 0, msg: "مصرف خوراک نمی‌تواند منفی باشد" },
      },
    },

    // ===== منبع استاندارد =====
    source_type: {
      type: DataTypes.STRING(20),
      allowNull: true,
      defaultValue: "system",
      comment: "📌 منبع استاندارد: system, user, breed_company, custom",
      validate: {
        isIn: {
          args: [["system", "user", "breed_company", "custom"]],
          msg: "منبع استاندارد باید یکی از مقادیر: system, user, breed_company, custom باشد",
        },
      },
    },

    source_description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "📝 توضیحات منبع",
    },

    // ===== وضعیت =====
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: true,
      comment: "✅ فعال/غیرفعال",
    },

    is_default: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
      comment: "⭐ استاندارد پیش‌فرض",
    },

    // ===== ارتباط با کاربران =====
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "👤 کاربر ایجادکننده (ارجاع به users)",
    },

    updated_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "👤 کاربر بروزرسانی‌کننده (ارجاع به users)",
    },

    // ===== زمان =====
    created_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: DataTypes.NOW,
      comment: "⏰ زمان ایجاد",
    },

    updated_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: DataTypes.NOW,
      comment: "⏰ زمان بروزرسانی",
    },
  },
  {
    tableName: "breed_weight_standards",
    timestamps: true,
    underscored: true,
    paranoid: false,
    indexes: [
      {
        // ایندکس برای جستجوی سریع بر اساس نژاد
        fields: ["breed_id"],
      },
      {
        // ایندکس برای جستجوی سریع بر اساس هفته
        fields: ["week_number"],
      },
      {
        // ایندکس ترکیبی برای جستجوی نژاد + هفته
        fields: ["breed_id", "week_number"],
        unique: true,
      },
      {
        // ایندکس برای فیلتر کردن استانداردهای فعال
        fields: ["is_active"],
      },
    ],
    // ===== Hookهای اعتبارسنجی =====
    hooks: {
      beforeCreate: (standard) => {
        // اگر min_weight و max_weight وجود دارند، بررسی کن
        if (standard.min_weight && standard.max_weight) {
          if (standard.min_weight > standard.max_weight) {
            throw new Error("حداقل وزن نمی‌تواند از حداکثر وزن بیشتر باشد");
          }
        }
        if (standard.min_weight && standard.target_weight) {
          if (standard.min_weight > standard.target_weight) {
            throw new Error("حداقل وزن نباید بیشتر از وزن هدف باشد");
          }
        }
        if (standard.max_weight && standard.target_weight) {
          if (standard.max_weight < standard.target_weight) {
            throw new Error("حداکثر وزن نباید کمتر از وزن هدف باشد");
          }
        }
      },
      beforeUpdate: (standard) => {
        // قبل از بروزرسانی، اعتبارسنجی بازه وزنی
        if (standard.min_weight && standard.max_weight) {
          if (standard.min_weight > standard.max_weight) {
            throw new Error("حداقل وزن نمی‌تواند از حداکثر وزن بیشتر باشد");
          }
        }
        if (standard.min_weight && standard.target_weight) {
          if (standard.min_weight > standard.target_weight) {
            throw new Error("حداقل وزن نباید بیشتر از وزن هدف باشد");
          }
        }
        if (standard.max_weight && standard.target_weight) {
          if (standard.max_weight < standard.target_weight) {
            throw new Error("حداکثر وزن نباید کمتر از وزن هدف باشد");
          }
        }
      },
    },
  },
);

module.exports = BreedWeightStandard;
