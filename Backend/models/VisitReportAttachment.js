const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const VisitReportAttachment = sequelize.define(
  "VisitReportAttachment",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    visit_report_id: { type: DataTypes.INTEGER, allowNull: false },
    file_name: { type: DataTypes.STRING(255), allowNull: false },
    file_path: { type: DataTypes.STRING(500), allowNull: false },
    file_size: { type: DataTypes.INTEGER, allowNull: true },
    mime_type: { type: DataTypes.STRING(100), allowNull: true },
  },
  {
    tableName: "visit_report_attachments",
    timestamps: false,
    underscored: true,
  },
);

module.exports = VisitReportAttachment;
