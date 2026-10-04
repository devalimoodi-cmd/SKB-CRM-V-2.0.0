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

    // ✅ «نشست‌ها» (فاز ۱۲.۱): اگر توکن شناسهٔ نشست (sid) دارد، آن نشست
    //    باید در جدول user_sessions هنوز باز باشد. اگر مدیر آن نشست را
    //    بسته باشد (یا کاربری از دستگاه دیگری خارج شده باشد) ⇒ ۴۰۱ فوری.
    //    ⚠️ توکن‌های قدیمی (بدون sid) دست‌نخورده کار می‌کنند ⇒ استقرار بی‌دردسر.
    req.sessionId = decoded.sid || null;
    if (req.sessionId) {
      try {
        // require داخل تابع تا وابستگی حلقه‌ای ایجاد نشود
        const sessionService = require("../services/sessionService");
        // touch = «زنده است؟» + تازه‌کردن آخرین فعالیت (با throttle)
        const alive = await sessionService.touch(req.sessionId);
        if (!alive) {
          return res.status(401).json({
            success: false,
            message: "نشست شما بسته شده است. لطفاً دوباره وارد شوید.",
          });
        }
      } catch (sessionError) {
        // خطای غیرمنتظره هرگز نباید احراز هویت را بشکند
        console.warn("⚠️ خطا در بررسی نشست:", sessionError.message);
      }
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

    // ✅ «سطوح دسترسی» کاربر (استثنای کاربر ← استثنای نقش ← پیش‌فرض کاتالوگ)
    // با کش ۳۰ ثانیه‌ای در services/permissionService.js؛ پس از هر تغییر
    // در پنل مدیریت، فوراً پاک می‌شود.
    try {
      // require داخل تابع تا وابستگی حلقه‌ای ایجاد نشود
      const { getEffectivePermissions } = require("../services/permissionService");
      const { permissions } = await getEffectivePermissions({
        id: user.id,
        role: user.role,
      });
      req.user.permissions = permissions;
    } catch (permError) {
      console.error("❌ خطا در بارگذاری سطوح دسترسی:", permError.message);
      req.user.permissions = new Set();
    }

    // ✅ «حضور»: ثبت آخرین فعالیت کاربر (Who's online?)
    // • fire-and-forget ⇒ هیچ تأخیری به مسیر درخواست تحمیل نمی‌شود
    // • خودِ سرویس، نوشتن را throttle می‌کند (PRESENCE_TOUCH_THROTTLE_SECONDS)
    // • هر خطایی اینجا نادیده گرفته می‌شود: حضور هرگز نباید احراز هویت را بشکند
    try {
      // require داخل تابع تا وابستگی حلقه‌ای ایجاد نشود
      require("../services/presenceService").touch(user.id);
    } catch (presenceError) {
      console.warn("⚠️ خطا در ثبت حضور:", presenceError.message);
    }

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
