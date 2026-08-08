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
    unit_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "units",
        key: "id",
      },
      comment: "شناسه واحد مرغداری",
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
      type: DataTypes.STRING(20),
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
