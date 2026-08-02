const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const VisitReportExpert = sequelize.define(
  "VisitReportExpert",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    visit_report_id: { type: DataTypes.INTEGER, allowNull: false },
    expert_id: { type: DataTypes.INTEGER, allowNull: false },
  },
  {
    tableName: "visit_report_experts",
    timestamps: false,
    underscored: true,
  },
);

module.exports = VisitReportExpert;
