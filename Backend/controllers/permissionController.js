// ============================================================
// controllers/permissionController.js
// «سطوح دسترسی» — کاتالوگ، ماتریس نقش‌ها و دسترسی کاربران
// ------------------------------------------------------------
// • کاتالوگ مجوزها: config/permissions.js (منبع حقیقت)
// • منطق محاسبه/ذخیره: services/permissionService.js
// • فقط سوپرادمین مجوز تغییر دارد (routes/permissionRoutes.js)
// • هر تغییر در permission_audit_logs ثبت و کش پاک می‌شود
// ============================================================
"use strict";

const User = require("../models/User");
const { successResponse, errorResponse } = require("../utils/response");
const permissionsConfig = require("../config/permissions");
const permissionService = require("../services/permissionService");
const { isEnforcing } = require("../middleware/permissions");

// ============================================
// مجوزهای کاربر جاری (برای گیت‌های فرانت‌اند)
// GET /api/permissions/me
// ============================================
const getMyPermissions = async (req, res) => {
  try {
    const { permissions } = await permissionService.getEffectivePermissions(
      req.user,
    );
    // ✅ نسخهٔ مجوزها (برای تازه‌سازی هوشمند در فرانت‌اند)
    const version = await permissionService.getPermissionsVersion();

    // ✅ عنوان فارسی کلیدهایی که کاربر «ندارد» — تا فرانت بتواند
    //    پیام قابل‌فهم بسازد («دسترسی «حذف سالن» برای شما بسته است»)
    const deniedTitles = {};
    permissionsConfig.PERMISSION_KEYS.forEach((key) => {
      if (!permissions.has(key)) {
        deniedTitles[key] = permissionsConfig.PERMISSIONS[key]?.title || key;
      }
    });

    return successResponse(
      res,
      {
        role: req.user.role,
        roleTitle:
          permissionsConfig.ROLE_TITLES[req.user.role] || req.user.role,
        enforced: isEnforcing(),
        version,
        total: permissionsConfig.TOTAL_PERMISSIONS,
        permissions: Array.from(permissions),
        deniedTitles,
      },
      "سطوح دسترسی شما دریافت شد",
    );
  } catch (error) {
    console.error("❌ خطا در دریافت سطوح دسترسی کاربر:", error);
    return errorResponse(res, "خطا در دریافت سطوح دسترسی", 500);
  }
};

// ============================================
// فقط نسخهٔ مجوزها (سبک — برای بررسی تازه‌بودن کش)
// GET /api/permissions/version
// ============================================
const getVersion = async (req, res) => {
  try {
    const version = await permissionService.getPermissionsVersion();
    return successResponse(res, { version }, "نسخهٔ سطوح دسترسی");
  } catch (error) {
    console.error("❌ خطا در دریافت نسخهٔ دسترسی:", error);
    return errorResponse(res, "خطا در دریافت نسخهٔ دسترسی", 500);
  }
};

// ============================================
// کاتالوگ (گروه‌ها + آیتم‌ها + ماتریس فعلی نقش‌ها)
// GET /api/permissions/catalog
// ============================================
const getCatalog = async (req, res) => {
  try {
    const catalog = permissionService.getCatalog();
    const matrix = await permissionService.getRoleMatrix();

    return successResponse(
      res,
      { ...catalog, matrix, enforced: isEnforcing() },
      "کاتالوگ سطوح دسترسی دریافت شد",
    );
  } catch (error) {
    console.error("❌ خطا در دریافت کاتالوگ دسترسی:", error);
    return errorResponse(res, "خطا در دریافت کاتالوگ دسترسی", 500);
  }
};

// ============================================
// فقط ماتریس نقش‌ها
// GET /api/permissions/roles
// ============================================
const getRoleMatrix = async (req, res) => {
  try {
    const matrix = await permissionService.getRoleMatrix();
    return successResponse(
      res,
      {
        matrix,
        roles: permissionsConfig.ROLES,
        roleTitles: permissionsConfig.ROLE_TITLES,
        enforced: isEnforcing(),
      },
      "ماتریس سطوح دسترسی دریافت شد",
    );
  } catch (error) {
    console.error("❌ خطا در دریافت ماتریس دسترسی:", error);
    return errorResponse(res, "خطا در دریافت ماتریس دسترسی", 500);
  }
};

// ============================================
// ذخیرهٔ سطح دسترسی یک نقش
// PUT /api/permissions/roles/:role
// body: { updates: [{ key, allowed }], note? }
// ============================================
const updateRolePermissions = async (req, res) => {
  try {
    const result = await permissionService.setRolePermissions({
      role: req.params.role,
      updates: req.body?.updates || [],
      actorId: req.user?.id,
      note: req.body?.note,
    });

    if (result.error) return errorResponse(res, result.error, 400);

    return successResponse(res, result, "سطح دسترسی نقش ذخیره شد");
  } catch (error) {
    console.error("❌ خطا در ذخیرهٔ دسترسی نقش:", error);
    return errorResponse(res, "خطا در ذخیرهٔ سطح دسترسی نقش", 500);
  }
};

// ============================================
// بازگردانی سطح دسترسی نقش به پیش‌فرض کاتالوگ
// POST /api/permissions/roles/:role/reset
// ============================================
const resetRolePermissions = async (req, res) => {
  try {
    const result = await permissionService.resetRolePermissions({
      role: req.params.role,
      actorId: req.user?.id,
      note: req.body?.note,
    });

    if (result.error) return errorResponse(res, result.error, 400);
    return successResponse(res, result, "سطح دسترسی نقش بازگردانی شد");
  } catch (error) {
    console.error("❌ خطا در بازگردانی دسترسی نقش:", error);
    return errorResponse(res, "خطا در بازگردانی سطح دسترسی نقش", 500);
  }
};

// ============================================
// وضعیت دسترسی یک کاربر
// GET /api/permissions/users/:id
// ============================================
const getUserPermissions = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: [
        "id",
        "first_name",
        "last_name",
        "username",
        "role",
        "status",
      ],
    });

    if (!user) return errorResponse(res, "کاربر یافت نشد", 404);

    const state = await permissionService.getUserPermissionState({
      id: user.id,
      role: user.role,
    });
    const roleMatrix = await permissionService.getRoleMatrix();

    return successResponse(
      res,
      {
        ...state,
        user: {
          id: user.id,
          role: user.role,
          fullName: [user.first_name, user.last_name].filter(Boolean).join(" "),
          username: user.username,
          status: user.status,
        },
        roleValues: roleMatrix[user.role] || {},
        enforced: isEnforcing(),
      },
      "دسترسی‌های کاربر دریافت شد",
    );
  } catch (error) {
    console.error("❌ خطا در دریافت دسترسی کاربر:", error);
    return errorResponse(res, "خطا در دریافت دسترسی کاربر", 500);
  }
};

// ============================================
// ذخیرهٔ دسترسی اختصاصی کاربر
// PUT /api/permissions/users/:id
// body: { updates: [{ key, allowed: true|false|null }], note? }
//        allowed = null ⇒ «ارثی از نقش» (ردیف حذف می‌شود)
// ============================================
const updateUserPermissions = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: ["id", "role", "first_name", "last_name", "username"],
    });

    if (!user) return errorResponse(res, "کاربر یافت نشد", 404);

    const result = await permissionService.setUserPermissions({
      user: { id: user.id, role: user.role },
      updates: req.body?.updates || [],
      actorId: req.user?.id,
      note: req.body?.note,
    });

    if (result.error) return errorResponse(res, result.error, 400);

    return successResponse(res, result, "دسترسی‌های کاربر ذخیره شد");
  } catch (error) {
    console.error("❌ خطا در ذخیرهٔ دسترسی کاربر:", error);
    return errorResponse(res, "خطا در ذخیرهٔ دسترسی کاربر", 500);
  }
};

// ============================================
// بازگردانی دسترسی کاربر به سطح نقش
// DELETE /api/permissions/users/:id
// ============================================
const resetUserPermissions = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: ["id", "role"],
    });

    if (!user) return errorResponse(res, "کاربر یافت نشد", 404);

    const result = await permissionService.resetUserPermissions({
      user: { id: user.id, role: user.role },
      actorId: req.user?.id,
      note: req.body?.note,
    });

    return successResponse(res, result, "دسترسی‌های کاربر بازگردانی شد");
  } catch (error) {
    console.error("❌ خطا در بازگردانی دسترسی کاربر:", error);
    return errorResponse(res, "خطا در بازگردانی دسترسی کاربر", 500);
  }
};

// ============================================
// گزارش تغییرات سطوح دسترسی
// GET /api/permissions/audit
// ============================================
const getAuditLogs = async (req, res) => {
  try {
    const result = await permissionService.getAuditLogs({
      page: req.query.page,
      limit: req.query.limit,
      targetType: req.query.targetType,
      targetId: req.query.targetId,
    });

    return successResponse(res, result, "گزارش تغییرات دسترسی دریافت شد");
  } catch (error) {
    console.error("❌ خطا در دریافت گزارش دسترسی:", error);
    return errorResponse(res, "خطا در دریافت گزارش دسترسی", 500);
  }
};

module.exports = {
  getMyPermissions,
  getVersion,
  getCatalog,
  getRoleMatrix,
  updateRolePermissions,
  resetRolePermissions,
  getUserPermissions,
  updateUserPermissions,
  resetUserPermissions,
  getAuditLogs,
};
