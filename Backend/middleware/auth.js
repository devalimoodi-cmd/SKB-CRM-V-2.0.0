const jwt = require("jsonwebtoken");
const User = require("../models/User");

// ✅ نقش‌های مدیریتی (دسترسی به مدیریت کاربران و تنظیمات)
const ADMIN_ROLES = ["super_admin", "admin", "sub_admin"];

// ✅ نقش‌هایی که دسترسی عملیاتی (کارشناس/مدیر) دارند
const PRIVILEGED_ROLES = ["super_admin", "admin", "sub_admin", "expert"];

const protect = async (req, res, next) => {
  let token;

  // ✅ چک کردن هدر Authorization
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "دسترسی غیرمجاز، لطفاً وارد شوید",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

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
        "token",
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

    // ✅ (اختیاری) فقط یک نشست فعال برای هر کاربر
    // با ENFORCE_SINGLE_SESSION=true فعال می‌شود؛ در این حالت ورود جدید
    // نشست قبلی را باطل می‌کند و «خروج» فوراً توکن را بی‌اعتبار می‌کند.
    if (process.env.ENFORCE_SINGLE_SESSION === "true") {
      if (!user.token || user.token !== token) {
        return res.status(401).json({
          success: false,
          message:
            "نشست شما در دستگاه دیگری باز شده است. لطفاً دوباره وارد شوید.",
        });
      }
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

    if (!roles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: `شما دسترسی به این بخش را ندارید. نقش شما: ${userRole}`,
      });
    }
    next();
  };
};

// ✅ دسترسی به «منبع خودِ کاربر» یا نقش‌های مجاز
// مثال: هر کاربر بتواند وضعیت آنلاین خودش را بفرستد، ولی دیگران را فقط ادمین‌ها
const authorizeSelfOr = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "احراز هویت نشده است",
      });
    }

    const targetId = req.params.id || req.params.userId;
    const isSelf = targetId && String(targetId) === String(req.user.id);

    if (isSelf || roles.includes(req.user.role)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: "شما دسترسی به این بخش را ندارید",
    });
  };
};

module.exports = {
  protect,
  authorize,
  authorizeSelfOr,
  ADMIN_ROLES,
  PRIVILEGED_ROLES,
};
