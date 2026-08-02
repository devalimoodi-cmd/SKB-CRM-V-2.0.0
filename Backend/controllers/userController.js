const User = require("../models/User");
const { Op } = require("sequelize");
const path = require("path");
const fs = require("fs");

const { successResponse, errorResponse } = require("../utils/response");

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

    console.log("📝 داده دریافتی:", {
      first_name,
      last_name,
      username,
      email,
      password,
      mobile_number,
    });

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
      token_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
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
      profile_image = `/uploads/${req.file.filename}`;
    }

    // ایجاد کاربر جدید (توکن کاربر فعلی تغییری نمی‌کند)
    const newUser = await User.create({
      first_name,
      last_name,
      username,
      email,
      password,
      mobile_number,
      role: role || "customer",
      status: status || "pending",
      profile_image,
      created_by: req.user?.id || null,
    });

    // ✅ تولید توکن برای کاربر جدید (نه کاربر فعلی)
    let jwtToken = null;
    const rolesThatNeedToken = ["super_admin", "admin", "sub_admin", "expert"];

    if (rolesThatNeedToken.includes(role)) {
      jwtToken = newUser.generateToken();
      await newUser.update({
        token: jwtToken,
        token_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
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
      updateData.profile_image = `/uploads/${req.file.filename}`;
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
        token_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
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
      token_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
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

    const user = await User.findOne({
      where: { [Op.or]: [{ username }, { email: username }] },
    });
    if (!user)
      return errorResponse(res, "نام کاربری یا رمز عبور اشتباه است", 401);

    if (user.status !== "active")
      return errorResponse(res, "حساب کاربری شما فعال نیست", 403);

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid)
      return errorResponse(res, "نام کاربری یا رمز عبور اشتباه است", 401);

    const token = user.generateToken();
    await user.update({ last_login: new Date() });

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
    const { online_status } = req.body;

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
};
