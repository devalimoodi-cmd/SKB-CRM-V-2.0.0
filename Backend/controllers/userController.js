const User = require("../models/User");
const { Op } = require("sequelize");
const path = require("path");
const fs = require("fs");
const { ADMIN_ROLES } = require("../middleware/auth");
const { getTokenExpiryDate } = require("../utils/token");
const {
  verifyChallenge,
  isEnabled: isCaptchaEnabled,
} = require("../utils/captcha");

const { successResponse, errorResponse } = require("../utils/response");

// ✅ تبدیل فایل آپلودشده به URL قابل دسترس
// (قبلاً فقط نام فایل ساخته می‌شد و مسیر واقعی داخل uploads از دست می‌رفت)
const fileToPublicUrl = (file) => {
  if (!file) return null;
  const relative = String(file.path || "").replace(/\\/g, "/");
  const index = relative.indexOf("uploads/");
  if (index >= 0) return `/${relative.slice(index)}`;
  return `/uploads/${file.filename}`;
};

// ============================================
// بررسی وجود ادمین
// ============================================
const checkAdminExists = async (req, res) => {
  try {
    const adminCount = await User.count({
      where: { role: "super_admin" },
    });
    successResponse(res, { hasAdmin: adminCount > 0 }, "وضعیت بررسی شد");
  } catch (error) {
    console.error("خطا:", error);
    errorResponse(res, error.message, 500);
  }
};

// ============================================
// ساخت ادمین اولیه
// ============================================
// ============================================
// ساخت ادمین اولیه (بدون آپلود عکس - ساده)
// ============================================
const setupAdmin = async (req, res) => {
  try {
    // برای درخواست‌های JSON یا FormData
    let first_name, last_name, username, email, password, mobile_number;

    if (req.body && Object.keys(req.body).length > 0) {
      // اگر داده به صورت JSON یا URL-encoded آمده
      first_name = req.body.first_name;
      last_name = req.body.last_name;
      username = req.body.username;
      email = req.body.email;
      password = req.body.password;
      mobile_number = req.body.mobile_number;
    }

    // اگر داده با FormData آمده (چون multer نداریم)
    if (req.body && typeof req.body === "object") {
      first_name = first_name || req.body.first_name;
      last_name = last_name || req.body.last_name;
      username = username || req.body.username;
      email = email || req.body.email;
      password = password || req.body.password;
      mobile_number = mobile_number || req.body.mobile_number;
    }

    // ✅ رمز عبور هرگز لاگ نمی‌شود
    console.log("📝 ساخت ادمین اولیه برای:", { username, email, mobile_number });

    // اعتبارسنجی
    if (
      !first_name ||
      !last_name ||
      !username ||
      !email ||
      !password ||
      !mobile_number
    ) {
      return errorResponse(res, "لطفاً تمام فیلدهای الزامی را پر کنید", 400);
    }

    if (password.length < 6) {
      return errorResponse(res, "رمز عبور باید حداقل 6 کاراکتر باشد", 400);
    }

    // بررسی وجود ادمین قبلی
    const existingAdmin = await User.findOne({
      where: { role: "super_admin" },
    });
    if (existingAdmin) {
      return errorResponse(res, "ادمین قبلاً ایجاد شده است", 400);
    }

    // بررسی تکراری نبودن
    const existingUser = await User.findOne({
      where: {
        [Op.or]: [{ username }, { email }, { mobile_number }],
      },
    });

    if (existingUser) {
      if (existingUser.username === username)
        return errorResponse(res, "این نام کاربری قبلاً ثبت شده است", 400);
      if (existingUser.email === email)
        return errorResponse(res, "این ایمیل قبلاً ثبت شده است", 400);
      if (existingUser.mobile_number === mobile_number)
        return errorResponse(res, "این شماره موبایل قبلاً ثبت شده است", 400);
    }

    // ایجاد ادمین
    const newAdmin = await User.create({
      first_name,
      last_name,
      username,
      email,
      password,
      mobile_number,
      role: "super_admin",
      status: "active",
    });

    // تولید توکن
    const token = newAdmin.generateToken();
    await newAdmin.update({
      token,
      token_expires_at: getTokenExpiryDate(),
    });

    const adminData = newAdmin.toJSON();

    successResponse(
      res,
      { user: adminData, token },
      "مدیر اصلی با موفقیت ایجاد شد",
      201,
    );
  } catch (error) {
    console.error("خطا در ساخت ادمین:", error);

    if (error.name === "SequelizeValidationError") {
      return errorResponse(res, error.errors[0].message, 400);
    }

    if (error.name === "SequelizeUniqueConstraintError") {
      return errorResponse(res, "اطلاعات تکراری است", 400);
    }

    errorResponse(res, error.message, 500);
  }
};

// ============================================
// ثبت نام کاربر جدید (با آپلود عکس)
// ============================================
const registerUser = async (req, res) => {
  try {
    const {
      first_name,
      last_name,
      username,
      email,
      password,
      mobile_number,
      role,
      status,
    } = req.body;

    // اعتبارسنجی اولیه
    if (
      !first_name ||
      !last_name ||
      !username ||
      !email ||
      !password ||
      !mobile_number
    ) {
      if (req.file) fs.unlinkSync(req.file.path);
      return errorResponse(res, "لطفاً تمام فیلدهای الزامی را پر کنید", 400);
    }

    if (password.length < 6) {
      if (req.file) fs.unlinkSync(req.file.path);
      return errorResponse(res, "رمز عبور باید حداقل 6 کاراکتر باشد", 400);
    }

    // بررسی تکراری بودن
    const existingUser = await User.findOne({
      where: {
        [Op.or]: [{ email }, { username }, { mobile_number }],
      },
    });

    if (existingUser) {
      if (req.file) fs.unlinkSync(req.file.path);
      if (existingUser.email === email)
        return errorResponse(res, "این ایمیل قبلاً ثبت شده است", 400);
      if (existingUser.username === username)
        return errorResponse(res, "این نام کاربری قبلاً ثبت شده است", 400);
      if (existingUser.mobile_number === mobile_number)
        return errorResponse(res, "این شماره موبایل قبلاً ثبت شده است", 400);
    }

    // آپلود عکس
    let profile_image = null;
    if (req.file) {
      profile_image = fileToPublicUrl(req.file);
    }

    // ✅ کنترل سطح دسترسی: فقط نقش‌های مدیریتی اجازهٔ ساخت کاربر دارند
    const requesterRole = req.user?.role;
    if (!ADMIN_ROLES.includes(requesterRole)) {
      if (req.file) fs.unlinkSync(req.file.path);
      return errorResponse(res, "شما دسترسی به ساخت کاربر را ندارید", 403);
    }

    // ✅ فقط سوپرادمین می‌تواند سوپرادمین بسازد
    const safeRole = role || "customer";
    if (safeRole === "super_admin" && requesterRole !== "super_admin") {
      if (req.file) fs.unlinkSync(req.file.path);
      return errorResponse(
        res,
        "فقط مدیر اصلی می‌تواند مدیر اصلی ایجاد کند",
        403,
      );
    }

    // ایجاد کاربر جدید (توکن کاربر فعلی تغییری نمی‌کند)
    const newUser = await User.create({
      first_name,
      last_name,
      username,
      email,
      password,
      mobile_number,
      role: safeRole,
      status: status || "pending",
      profile_image,
      created_by: req.user?.id || null,
    });

    // ✅ تولید توکن برای کاربر جدید (نه کاربر فعلی)
    let jwtToken = null;
    const rolesThatNeedToken = ["super_admin", "admin", "sub_admin", "expert"];

    if (rolesThatNeedToken.includes(safeRole)) {
      jwtToken = newUser.generateToken();
      await newUser.update({
        token: jwtToken,
        token_expires_at: getTokenExpiryDate(),
      });
    }

    // حذف رمز عبور از خروجی
    const userData = newUser.toJSON();

    successResponse(
      res,
      {
        user: userData,
        token: jwtToken, // توکن کاربر جدید (نه کاربر فعلی)
      },
      "کاربر با موفقیت ثبت شد",
      201,
    );
  } catch (error) {
    if (req.file) fs.unlinkSync(req.file.path);
    console.error("خطا در ثبت نام کاربر:", error);

    if (error.name === "SequelizeValidationError") {
      return errorResponse(res, error.errors[0].message, 400);
    }

    if (error.name === "SequelizeUniqueConstraintError") {
      return errorResponse(res, "اطلاعات تکراری است", 400);
    }

    errorResponse(res, error.message, 500);
  }
};

// ============================================
// دریافت همه کاربران (با فیلتر نقش)
// ============================================
const getAllUsers = async (req, res) => {
  try {
    const { role, exclude_role } = req.query;
    let where = {};

    if (role) where.role = role;
    if (exclude_role) where.role = { [Op.ne]: exclude_role };

    const users = await User.findAll({
      where,
      order: [["created_at", "DESC"]],
      attributes: { exclude: ["password"] },
    });

    successResponse(res, users, "لیست کاربران دریافت شد");
  } catch (error) {
    console.error("خطا:", error);
    errorResponse(res, error.message, 500);
  }
};

// ============================================
// دریافت کاربران بر اساس نقش
// ============================================
const getUsersByRole = async (req, res) => {
  try {
    const { role } = req.params;
    const users = await User.findAll({
      where: { role },
      order: [["created_at", "DESC"]],
      attributes: { exclude: ["password"] },
    });
    successResponse(res, users, `لیست کاربران با نقش ${role} دریافت شد`);
  } catch (error) {
    console.error("خطا:", error);
    errorResponse(res, error.message, 500);
  }
};

// ============================================
// دریافت اطلاعات یک کاربر
// ============================================
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id, {
      attributes: { exclude: ["password"] },
    });
    if (!user) return errorResponse(res, "کاربر یافت نشد", 404);
    successResponse(res, user, "اطلاعات کاربر دریافت شد");
  } catch (error) {
    console.error("خطا:", error);
    errorResponse(res, error.message, 500);
  }
};

// ============================================
// بروزرسانی کاربر
// ============================================
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const user = await User.findByPk(id);

    if (!user) return errorResponse(res, "کاربر یافت نشد", 404);

    // ✅ کنترل سطح دسترسی روی فیلدهای حساس
    const requesterRole = req.user?.role;
    const isAdmin = ADMIN_ROLES.includes(requesterRole);

    // فیلدهایی که کاربر عادی هرگز نمی‌تواند تغییر دهد (جلوگیری از ارتقای سطح دسترسی)
    const protectedFields = [
      "role",
      "status",
      "token",
      "token_expires_at",
      "password",
      "created_by",
      "is_online",
      "last_seen",
    ];

    if (!isAdmin) {
      protectedFields.forEach((field) => delete updateData[field]);
    } else if (requesterRole !== "super_admin") {
      if (updateData.role === "super_admin") {
        if (req.file) fs.unlinkSync(req.file.path);
        return errorResponse(
          res,
          "فقط مدیر اصلی می‌تواند نقش مدیر اصلی بدهد",
          403,
        );
      }
      if (user.role === "super_admin") {
        if (req.file) fs.unlinkSync(req.file.path);
        return errorResponse(
          res,
          "تغییر اطلاعات مدیر اصلی فقط توسط خودِ مدیر اصلی امکان‌پذیر است",
          403,
        );
      }
    }

    // بررسی تکراری
    if (updateData.email || updateData.username || updateData.mobile_number) {
      const whereConditions = [];
      if (updateData.email) whereConditions.push({ email: updateData.email });
      if (updateData.username)
        whereConditions.push({ username: updateData.username });
      if (updateData.mobile_number)
        whereConditions.push({ mobile_number: updateData.mobile_number });

      if (whereConditions.length > 0) {
        const existingUser = await User.findOne({
          where: { [Op.or]: whereConditions, id: { [Op.ne]: id } },
        });
        if (existingUser) {
          if (existingUser.email === updateData.email)
            return errorResponse(res, "این ایمیل قبلاً ثبت شده است", 400);
          if (existingUser.username === updateData.username)
            return errorResponse(res, "این نام کاربری قبلاً ثبت شده است", 400);
          if (existingUser.mobile_number === updateData.mobile_number)
            return errorResponse(
              res,
              "این شماره موبایل قبلاً ثبت شده است",
              400,
            );
        }
      }
    }

    // آپلود عکس جدید
    if (req.file) {
      if (user.profile_image) {
        const oldPath = path.join(__dirname, "..", user.profile_image);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      updateData.profile_image = fileToPublicUrl(req.file);
    }

    await user.update(updateData);

    // تولید توکن جدید اگر نقش تغییر کرد
    if (
      updateData.role &&
      (updateData.role === "sub_admin" || updateData.role === "expert")
    ) {
      const newToken = user.generateToken();
      await user.update({
        token: newToken,
        token_expires_at: getTokenExpiryDate(),
      });
    }

    successResponse(res, user.toJSON(), "اطلاعات کاربر با موفقیت بروزرسانی شد");
  } catch (error) {
    if (req.file) fs.unlinkSync(req.file.path);
    console.error("خطا:", error);
    errorResponse(res, error.message, 500);
  }
};

// ============================================
// حذف کاربر
// ============================================
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id);
    if (!user) return errorResponse(res, "کاربر یافت نشد", 404);

    // ✅ محافظت‌ها: حذف حساب خود و حذف مدیر اصلی توسط غیرِ مدیر اصلی ممنوع
    if (String(req.user?.id) === String(id)) {
      return errorResponse(res, "حذف حساب کاربری خودتان امکان‌پذیر نیست", 400);
    }
    if (user.role === "super_admin" && req.user?.role !== "super_admin") {
      return errorResponse(
        res,
        "حذف مدیر اصلی فقط توسط خودِ مدیر اصلی امکان‌پذیر است",
        403,
      );
    }

    if (user.profile_image) {
      const imagePath = path.join(__dirname, "..", user.profile_image);
      if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
    }

    await user.destroy();
    successResponse(res, null, "کاربر با موفقیت حذف شد");
  } catch (error) {
    console.error("خطا:", error);
    errorResponse(res, error.message, 500);
  }
};

// ============================================
// بازنشانی توکن
// ============================================
const resetUserToken = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id);
    if (!user) return errorResponse(res, "کاربر یافت نشد", 404);

    const newToken = user.generateToken();
    await user.update({
      token: newToken,
      token_expires_at: getTokenExpiryDate(),
    });
    successResponse(res, { token: newToken }, "توکن با موفقیت بازنشانی شد");
  } catch (error) {
    console.error("خطا:", error);
    errorResponse(res, error.message, 500);
  }
};

// ============================================
// ورود کاربر
// ============================================
const loginUser = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return errorResponse(res, "نام کاربری و رمز عبور الزامی است", 400);

    // ✅ بررسی کپچا (ضد حملهٔ خودکار) — قبل از هر کار دیگری
    // توجه: خطای کپچا شمارندهٔ قفل حساب را بالا نمی‌برد (تا کسی نتواند
    // با پاسخ اشتباه، حساب کاربران را قفل کند).
    if (isCaptchaEnabled()) {
      const { captcha_id, captcha_answer } = req.body;
      const captchaResult = verifyChallenge(captcha_id, captcha_answer);

      if (!captchaResult.ok) {
        const captchaMessages = {
          missing: "کد امنیتی تصویر را وارد کنید",
          expired: "کد امنیتی منقضی شده است؛ تصویر جدید را دریافت کنید",
          invalid: "کد امنیتی نامعتبر است؛ تصویر جدید را دریافت کنید",
          wrong: "کد امنیتی تصویر اشتباه است",
        };

        return errorResponse(
          res,
          captchaMessages[captchaResult.reason] || "کد امنیتی نامعتبر است",
          400,
        );
      }
    }

    const user = await User.findOne({
      where: { [Op.or]: [{ username }, { email: username }] },
    });
    if (!user)
      return errorResponse(res, "نام کاربری یا رمز عبور اشتباه است", 401);

    if (user.status !== "active")
      return errorResponse(res, "حساب کاربری شما فعال نیست", 403);

    // ✅ قفل حساب پس از تلاش‌های ناموفق (ضد Brute-force در سطح هر کاربر)
    if (user.isLocked()) {
      const minutesLeft = Math.max(
        1,
        Math.ceil(
          (new Date(user.locked_until).getTime() - Date.now()) / 60000,
        ),
      );
      return errorResponse(
        res,
        `حساب کاربری شما به دلیل تلاش‌های ناموفق تا ${minutesLeft} دقیقهٔ دیگر قفل است`,
        423,
      );
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      await user.incrementFailedAttempts();

      const maxAttempts = Number(process.env.LOGIN_MAX_ATTEMPTS || 5);
      const lockMinutes = Number(process.env.LOGIN_LOCK_MINUTES || 30);

      if (user.isLocked()) {
        return errorResponse(
          res,
          `رمز عبور اشتباه است. حساب شما به دلیل ${maxAttempts} تلاش ناموفق، ${lockMinutes} دقیقه قفل شد`,
          423,
        );
      }

      const attemptsLeft = Math.max(
        0,
        maxAttempts - (user.failed_login_attempts || 0),
      );
      return errorResponse(
        res,
        `نام کاربری یا رمز عبور اشتباه است (${attemptsLeft} تلاش باقی مانده)`,
        401,
      );
    }

    // ✅ ورود موفق: شمارندهٔ تلاش‌های ناموفق و قفل پاک می‌شود
    if (user.failed_login_attempts > 0 || user.locked_until) {
      await user.resetFailedAttempts();
    }

    const token = user.generateToken();
    // ✅ توکن جاری در دیتابیس ذخیره می‌شود تا «خروج» بتواند نشست را واقعاً ببندد
    // (و با ENFORCE_SINGLE_SESSION=true، هر کاربر یک نشست فعال داشته باشد)
    await user.update({
      last_login: new Date(),
      token,
      token_expires_at: getTokenExpiryDate(),
    });

    successResponse(
      res,
      { user: user.toJSON(), token },
      "ورود با موفقیت انجام شد",
    );
  } catch (error) {
    console.error("خطا:", error);
    errorResponse(res, error.message, 500);
  }
};

// ============================================
// بروزرسانی وضعیت آنلاین کاربر
// ============================================
const updateOnlineStatus = async (req, res) => {
  try {
    const { id } = req.params;
    // ✅ پذیرش هر دو نام: online_status (auth.service) و status (login.service)
    const online_status = req.body.online_status ?? req.body.status;

    if (typeof online_status !== "boolean") {
      return errorResponse(res, "وضعیت آنلاین باید true یا false باشد", 400);
    }

    const user = await User.findByPk(id);
    if (!user) {
      return errorResponse(res, "کاربر یافت نشد", 404);
    }

    await user.update({ online_status });
    successResponse(res, { online_status }, "وضعیت آنلاین بروزرسانی شد");
  } catch (error) {
    console.error("خطا:", error);
    errorResponse(res, error.message, 500);
  }
};

// ============================================
// خروج کاربر (باطل کردن توکن ذخیرهشده در سرور)
// ============================================
const logoutUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return errorResponse(res, "کاربر یافت نشد", 404);

    await user.update({ token: null, token_expires_at: null, online_status: false });
    successResponse(res, null, "با موفقیت خارج شدید");
  } catch (error) {
    console.error("خطا در خروج:", error);
    errorResponse(res, error.message, 500);
  }
};

// ============================================
// بازکردن قفل حساب کاربر (فقط نقش‌های مدیریتی)
// ============================================
const unlockUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return errorResponse(res, "کاربر یافت نشد", 404);

    await user.resetFailedAttempts();
    successResponse(
      res,
      { id: user.id, username: user.username },
      `حساب «${user.username}» از قفل خارج شد`,
    );
  } catch (error) {
    console.error("خطا در بازکردن قفل حساب:", error);
    errorResponse(res, error.message, 500);
  }
};

module.exports = {
  checkAdminExists,
  setupAdmin,
  registerUser,
  getAllUsers,
  getUsersByRole,
  getUserById,
  updateUser,
  deleteUser,
  resetUserToken,
  loginUser,
  updateOnlineStatus,
  logoutUser,
  unlockUser,
};
