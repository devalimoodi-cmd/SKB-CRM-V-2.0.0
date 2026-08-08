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
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: { msg: "نام کارشناس الزامی است" },
        len: {
          args: [3, 100],
          msg: "نام کارشناس باید بین 3 تا 100 کاراکتر باشد",
        },
      },
    },
    expert_phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
      validate: {
        is: { args: /^[0-9]+$/, msg: "شماره تماس کارشناس باید عدد باشد" },
        len: { args: [10, 15], msg: "شماره تماس باید بین 10 تا 15 رقم باشد" },
      },
    },
    expert_role: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "نقش یا تخصص کارشناس",
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
