const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const VisitReportHall = sequelize.define(
  "VisitReportHall",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    visit_report_id: { type: DataTypes.INTEGER, allowNull: false },
    hall_id: { type: DataTypes.INTEGER, allowNull: false },
  },
  {
    tableName: "visit_report_halls",
    timestamps: false,
    underscored: true,
  },
);

module.exports = VisitReportHall;
