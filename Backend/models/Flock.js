// ================================================================
// models/Flock.js
// «گله» (دوره پرورش) در سطح واحد مرغداری
// طبق تعریف بازار: مجموع جوجه‌ریزی‌های هم‌نوبت در سالن‌های یک واحد = یک گله
// ================================================================

const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Flock = sequelize.define(
  "Flock",
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
      allowNull: false,
      references: {
        model: "units",
        key: "id",
      },
      comment: "واحد مرغداری (یک گله زیر یک واحد)",
    },
    flock_number: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "شماره گله — یکتا به ازای هر (مشتری + واحد)",
    },
    placement_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      comment: "تاریخ شروع گله (جوجه‌ریزی)",
    },
    status: {
      type: DataTypes.STRING(20),
      defaultValue: "active",
      comment: "وضعیت: pending | active | completed | cancelled",
    },
    ended_at: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: "تاریخ پایان گله",
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "flocks",
    timestamps: true,
    underscored: true,
    paranoid: false,
    indexes: [
      {
        unique: true,
        fields: ["customer_id", "unit_id", "flock_number"],
        name: "unique_flock_per_unit",
      },
      {
        fields: ["unit_id", "status"],
      },
    ],
  },
);

module.exports = Flock;
