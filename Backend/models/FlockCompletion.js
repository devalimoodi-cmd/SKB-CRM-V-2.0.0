// ============================================================
// models/FlockCompletion.js
// ============================================================

const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const FlockCompletion = sequelize.define(
  "FlockCompletion",
  {
    // ==========================================================
    // 🆔 شناسه و ارتباطات (6 فیلد)
    // ==========================================================
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      comment: "🆔 شناسه یکتا (Primary Key)",
    },
    chick_placement_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment:
        "🆔 جوجه‌ریزی نماینده گله (اولین سالن) — برای سازگاری با نمایش‌های قدیمی",
    },
    flock_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "flocks",
        key: "id",
      },
      comment: "🆔 شناسه گله/دوره پرورش (ارجاع به جدول flocks) — یک پایان دوره per گله",
    },
    customer_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "🆔 شناسه مشتری (ارجاع به جدول customer_personal_information)",
    },
    unit_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "units",
        key: "id",
      },
      comment: "🆔 شناسه واحد مرغداری (ارجاع به جدول units)",
    },
    hall_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "🆔 سالن نماینده گله (اولین سالن) — ریز هر سالن در flock_completion_halls",
    },
    completed_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "🆔 کاربر تکمیل‌کننده (ارجاع به جدول users)",
    },

    // ==========================================================
    // 📋 اطلاعات مدیریتی (3 فیلد)
    // ==========================================================
    completion_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      comment: "📋 تاریخ تکمیل اطلاعات در سیستم",
    },
    completion_type: {
      type: DataTypes.STRING(50),
      defaultValue: "completed",
      comment:
        "📋 نوع پایان دوره: completed(تکمیل), culled(حذف), emergency(اضطراری)",
    },
    confirmed_by_customer: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: "📋 تأیید صحت اطلاعات توسط مرغدار (TRUE/FALSE)",
    },

    // ==========================================================
    // 🐣 اطلاعات جوجه‌ریزی و جمعیت (3 فیلد)
    // ==========================================================
    initial_chicks_count: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "🐣 تعداد جوجه‌ریزی اولیه (قطعه)",
    },
    final_chicks_count: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "🐣 تعداد جوجه مانده تا آخرین هفته (قطعه)",
    },
    initial_avg_weight: {
      type: DataTypes.DECIMAL(10, 4),
      defaultValue: 0.04,
      comment:
        "🐣 وزن اولیه هر جوجه در جوجه‌ریزی (کیلوگرم) - معمولاً ۰.۰۴۰ (۴۰ گرم)",
    },

    // ==========================================================
    // 📅 اطلاعات سن و دوره (1 فیلد)
    // ==========================================================
    slaughter_age_days: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "📅 سن کشتار (روز) — سن در تاریخ شروع کشتار",
    },
    slaughter_age_end_days: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "📅 سن پایان کشتار (روز) — وقتی کشتار چند روز طول بکشد",
    },

    // ==========================================================
    // 🏭 اطلاعات کشتارگاه (6 فیلد)
    // ==========================================================
    slaughter_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: "🏭 تاریخ شروع کشتار در کشتارگاه",
    },
    slaughter_end_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment:
        "🏭 تاریخ پایان کشتار (برای گله‌های بزرگ که فرایند کشتار چند روز طول می‌کشد)",
    },
    slaughterhouse_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "🏭 نام کشتارگاه",
    },
    transport_mortality: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: "🏭 تلفات حین حمل و نقل به کشتارگاه",
    },
    total_sent: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "🏭 تعداد قطعه ارسالی به کشتارگاه",
    },
    total_live_weight: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      comment: "🏭 وزن کل زنده گله در کشتارگاه (کیلوگرم)",
    },
    avg_live_weight: {
      type: DataTypes.DECIMAL(12, 3),
      allowNull: true,
      comment: "🏭 میانگین وزن زنده هر قطعه (کیلوگرم) - از کشتارگاه",
    },

    // ==========================================================
    // 📊 شاخص‌های فنی (5 فیلد)
    // ==========================================================
    final_week_number: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "📊 شماره هفته آخر پرورش",
    },
    total_feed_intake: {
      type: DataTypes.DECIMAL(16, 2),
      allowNull: true,
      comment: "📊 کل خوراک مصرفی (از داده‌های سیستم)",
    },
    final_avg_weight: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: "📊 میانگین وزن نهایی هر قطعه (کیلوگرم)",
    },
    total_mortality: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "📊 تلفات کل (تلفات سیستم + تلفات حمل)",
    },
    mortality_rate: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: true,
      comment: "📊 درصد تلفات: (تلفات کل / تعداد اولیه) × ۱۰۰",
    },

    // ==========================================================
    // 👨‍🌾 اطلاعات اعلامی مرغدار (4 فیلد)
    // ==========================================================
    farmer_fcr: {
      type: DataTypes.DECIMAL(10, 3),
      allowNull: true,
      comment: "👨‍🌾 ضریب تبدیل نهایی اعلامی مرغدار",
    },
    farmer_total_meat: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      comment: "👨‍🌾 کل گوشت بدست آمده اعلامی مرغدار (کیلوگرم)",
    },
    farmer_total_feed: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      comment: "👨‍🌾 کل خوراک مصرفی نهایی اعلامی مرغدار (کیلوگرم)",
    },
    farmer_total_weight: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      comment: "👨‍🌾 وزن کل اعلامی از سمت مرغدار (کیلوگرم)",
    },

    // ==========================================================
    // 💻 اطلاعات محاسبه‌شده توسط سیستم (3 فیلد)
    // ==========================================================
    system_last_weight: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment:
        "💻 آخرین وزن گله در آخرین هفته (کیلوگرم) - محاسبه‌شده از داده‌های هفتگی",
    },
    system_total_feed: {
      type: DataTypes.DECIMAL(16, 2),
      allowNull: true,
      comment:
        "💻 مجموع مصرفی خوراک در طول دوره (کیلوگرم) - جمع داده‌های هفتگی",
    },
    system_fcr: {
      type: DataTypes.DECIMAL(10, 3),
      allowNull: true,
      comment:
        "💻 ضریب تبدیل سیستمی: (کل خوراک / افزایش وزن کل) - بر اساس داده‌های ثبت شده",
    },

    // ==========================================================
    // 📝 توضیحات و زمان (3 فیلد)
    // ==========================================================
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "📝 توضیحات تکمیلی",
    },
    // ==========================================================
    // 💰 اطلاعات اقتصادی پایان دوره
    // ==========================================================
    price_per_kg: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: true,
      comment: "💰 قیمت هر کیلوگرم وزن زنده فروش به کشتارگاه",
    },
    income_total: {
      type: DataTypes.DECIMAL(20, 2),
      allowNull: true,
      comment: "💰 درآمد کل = وزن کل زنده × قیمت هر کیلو",
    },
    chick_cost: {
      type: DataTypes.DECIMAL(20, 2),
      allowNull: true,
      comment: "💰 هزینه جوجه (قیمت هر جوجه × تعداد اولیه)",
    },
    feed_cost: {
      type: DataTypes.DECIMAL(20, 2),
      allowNull: true,
      comment: "💰 هزینه خوراک (کل خوراک × قیمت هر کیلو)",
    },
    medication_cost: {
      type: DataTypes.DECIMAL(20, 2),
      allowNull: true,
      comment: "💰 هزینه دارو و واکسن",
    },
    fuel_cost: {
      type: DataTypes.DECIMAL(20, 2),
      allowNull: true,
      comment: "💰 هزینه سوخت (گاز، برق، آب)",
    },
    labor_cost: {
      type: DataTypes.DECIMAL(20, 2),
      allowNull: true,
      comment: "💰 هزینه نیروی انسانی",
    },
    other_cost: {
      type: DataTypes.DECIMAL(20, 2),
      allowNull: true,
      comment: "💰 سایر هزینه‌ها (بستر، حمل، تعمیرات)",
    },
    total_cost: {
      type: DataTypes.DECIMAL(20, 2),
      allowNull: true,
      comment: "💰 جمع کل هزینه‌ها",
    },
    net_profit: {
      type: DataTypes.DECIMAL(20, 2),
      allowNull: true,
      comment: "💰 سود خالص = درآمد کل − جمع کل هزینه‌ها",
    },
    profit_percent: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: true,
      comment: "💰 درصد سود = (سود خالص ÷ درآمد کل) × ۱۰۰",
    },

    // ==========================================================
    // 🍗 اطلاعات لاشه
    // ==========================================================
    carcass_weight_kg: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: true,
      comment: "🍗 وزن لاشه بعد از پرکنی (کیلوگرم)",
    },
    carcass_yield_percent: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: true,
      comment: "🍗 درصد راندمان لاشه = (وزن لاشه ÷ وزن زنده) × ۱۰۰",
    },

    // ==========================================================
    // 📈 شاخص‌های عملکردی محاسبه‌شده
    // ==========================================================
    feed_basis: {
      type: DataTypes.STRING(20),
      defaultValue: "system",
      allowNull: false,
      comment: "📈 مبنای محاسبه خوراک در FCR نهایی: system | declared",
    },
    epi: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: "📈 شاخص اروپایی EPI",
    },
    adg_grams: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: "📈 نرخ رشد روزانه (گرم در روز)",
    },
    total_weight_gain_kg: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: true,
      comment: "📈 افزایش وزن کل گله (کیلوگرم)",
    },
    survival_percent: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: true,
      comment: "📈 درصد زنده‌مانی گله",
    },
    final_fcr: {
      type: DataTypes.DECIMAL(10, 3),
      allowNull: true,
      comment: "📈 ضریب تبدیل نهایی (بر اساس مبنای خوراک انتخابی)",
    },
    // ==========================================================
    // 🖥 شاخص‌های محاسبه‌شده از داده‌های سیستم (هفتگی)
    // ==========================================================
    system_epi: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: "EPI بر اساس داده‌های سیستم",
    },
    system_adg_grams: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: "ADG (گرم/روز) بر اساس داده‌های سیستم",
    },
    system_weight_gain_kg: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: true,
      comment: "افزایش وزن کل بر اساس داده‌های سیستم",
    },
    system_survival_percent: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: true,
      comment: "درصد زنده‌مانی بر اساس داده‌های سیستم",
    },

    // ==========================================================
    // 👨‍🌾 شاخص‌های محاسبه‌شده از اطلاعات اعلامی مرغدار
    // ==========================================================
    farmer_epi: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: "EPI بر اساس اطلاعات اعلامی مرغدار",
    },
    farmer_adg_grams: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: "ADG (گرم/روز) بر اساس اطلاعات اعلامی مرغدار",
    },
    farmer_weight_gain_kg: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: true,
      comment: "افزایش وزن کل بر اساس اطلاعات اعلامی مرغدار",
    },
    farmer_survival_percent: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: true,
      comment: "درصد زنده‌مانی بر اساس اطلاعات اعلامی مرغدار",
    },
  },
  {
    tableName: "flock_completions",
    timestamps: true,
    underscored: true,
    paranoid: false,
    indexes: [
      { fields: ["flock_id"], unique: true },
      { fields: ["customer_id"] },
      { fields: ["unit_id"] },
      { fields: ["completion_date"] },
      { fields: ["slaughter_date"] },
    ],
  },
);

module.exports = FlockCompletion;
