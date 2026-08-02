const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const VisitReport = sequelize.define(
  "VisitReport",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    customer_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    period_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    visit_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    forward_to: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    report_text: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING(20), // ✅ ENUM رو به STRING تغییر بده
      defaultValue: "unread",
      validate: {
        isIn: [["unread", "read", "archived"]],
      },
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: "visit_reports",
    timestamps: true,
    underscored: true,
  },
);

module.exports = VisitReport;
