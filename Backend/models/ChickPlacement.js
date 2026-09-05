const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const ChickPlacement = sequelize.define(
  "ChickPlacement",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    customer_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "customer_personal_information",
        key: "id",
      },
    },
    unit_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "units",
        key: "id",
      },
      comment: "شناسه واحد مرغداری",
    },
    hall_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "halls",
        key: "id",
      },
    },
    flock_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "flocks",
        key: "id",
      },
      comment: "شناسه گله (دوره پرورش) که این جوجه‌ریزی سالن به آن تعلق دارد",
    },
    placement_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      validate: {
        isDate: { msg: "تاریخ جوجه‌ریزی معتبر نیست" },
      },
    },
    flock_number: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        isInt: { msg: "شماره گله باید عدد باشد" },
        min: { args: [1], msg: "شماره گله باید حداقل 1 باشد" },
      },
    },
    chick_source_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "مبدا جوجه (ارجاع به دیکشنری chick_sources)",
    },
    breed_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "نژاد جوجه (ارجاع به دیکشنری chicken_breeds)",
    },
    chick_age_on_arrival: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      comment: "سن جوجه در بدو ورود (روز)",
    },
    avg_initial_weight: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: "میانگین وزن اولیه (گرم)",
    },
    total_chicks_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "تعداد کل جوجه‌ها",
    },
    placement_density: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: "تراکم جوجه‌ریزی",
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
      field: "is_active",
      comment: "فعال بودن جوجه‌ریزی (فقط یک رکورد فعال برای هر سالن)",
    },
  },
  {
    tableName: "chick_placements",
    timestamps: true,
    underscored: true,
    indexes: [{ fields: ["flock_id"] }, { fields: ["customer_id", "is_active"] }],
  },
);

module.exports = ChickPlacement;
