const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const UnitExpert = sequelize.define(
  "UnitExpert",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    unit_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "units",
        key: "id",
      },
    },
    expert_name: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        notEmpty: { msg: "نام کارشناس الزامی است" },
        len: {
          args: [3, 50],
          msg: "نام کارشناس باید بین 3 تا 50 کاراکتر باشد",
        },
      },
    },
    expert_phone: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        is: { args: /^[0-9]{11}$/, msg: "شماره تماس کارشناس باید 11 رقم باشد" },
      },
    },
    expert_role: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        notEmpty: { msg: "نقش کارشناس الزامی است" },
        len: {
          args: [1, 50],
          msg: "نقش کارشناس حداکثر 50 کاراکتر باشد",
        },
      },
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
      comment: "فعال یا غیرفعال بودن کارشناس",
    },
  },
  {
    tableName: "unit_experts",
    timestamps: true,
    underscored: true,
    paranoid: true,
  },
);

module.exports = UnitExpert;
