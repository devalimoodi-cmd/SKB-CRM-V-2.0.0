const jwt = require("jsonwebtoken");
const User = require("../models/User");

const protect = async (req, res, next) => {
  let token;

  // ✅ چک کردن هدر Authorization
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  console.log("🔑 توکن دریافتی:", token ? "✅ موجود" : "❌ وجود ندارد");

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "دسترسی غیرمجاز، لطفاً وارد شوید",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("✅ توکن معتبر است:", decoded.id, decoded.role);

    // ✅ دریافت کاربر از دیتابیس برای اطمینان
    const user = await User.findByPk(decoded.id, {
      attributes: [
        "id",
        "first_name",
        "last_name",
        "email",
        "username",
        "role",
        "status",
      ],
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "کاربر یافت نشد",
      });
    }

    if (user.status !== "active") {
      return res.status(403).json({
        success: false,
        message: "حساب کاربری شما فعال نیست",
      });
    }

    // ✅ ذخیره اطلاعات کامل در req.user
    req.user = {
      id: user.id,
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      username: user.username,
      role: user.role,
      status: user.status,
    };

    next();
  } catch (error) {
    console.error("❌ خطا در احراز هویت:", error.message);
    return res.status(401).json({
      success: false,
      message: "توکن نامعتبر یا منقضی شده است",
    });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "احراز هویت نشده است",
      });
    }

    const userRole = req.user.role;
    console.log("👤 نقش کاربر:", userRole);
    console.log("🔐 نقش‌های مجاز:", roles);

    if (!roles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: `شما دسترسی به این بخش را ندارید. نقش شما: ${userRole}`,
      });
    }
    next();
  };
};

module.exports = { protect, authorize };
