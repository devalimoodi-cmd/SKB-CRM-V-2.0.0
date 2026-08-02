// BackEnd/models/Bookmark.js
const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Bookmark = sequelize.define(
  "Bookmark",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    // ✅ به جای ENUM، از STRING استفاده کن
    type: {
      type: DataTypes.STRING(20), // ✅ تغییر
      allowNull: false,
      defaultValue: "bookmark",
      validate: {
        isIn: [["bookmark", "reminder"]],
      },
    },
    // ✅ به جای ENUM، از STRING استفاده کن
    priority: {
      type: DataTypes.STRING(20), // ✅ تغییر
      allowNull: false,
      defaultValue: "medium",
      validate: {
        isIn: [["low", "medium", "high", "critical"]],
      },
    },
    // ✅ به جای ENUM، از STRING استفاده کن
    status: {
      type: DataTypes.STRING(20), // ✅ تغییر
      allowNull: false,
      defaultValue: "active",
      validate: {
        isIn: [["active", "read", "completed", "archived", "cancelled"]],
      },
    },
    customer_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    flock_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    period_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    week_number: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    flock_age_days: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    due_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    read_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    completed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    assigned_to: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: "bookmarks",
    timestamps: true,
    underscored: true,
  },
);

module.exports = Bookmark;
