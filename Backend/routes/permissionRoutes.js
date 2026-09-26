// ============================================================
// routes/permissionRoutes.js
// «سطوح دسترسی» (نقش‌ها و کاربران)
// ------------------------------------------------------------
// • /me برای همهٔ کاربران لاگین‌شده (گیت فرانت‌اند)
// • بقیه نیاز به مجوز دارند؛ تغییرات فقط سوپرادمین
//   (users.permissions.edit و roles.permissions.edit در کاتالوگ
//    به super_admin قفل شده‌اند)
// ⚠️ ترتیب مهم است: روت‌های ثابت قبل از روت‌های :id
// ============================================================
"use strict";

const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");
const permissionController = require("../controllers/permissionController");

router.use(protect);

// ===== کاربر جاری (قبل از مسیرهای :id) =====
router.get("/me", permissionController.getMyPermissions);
// ✅ نسخهٔ مجوزها (سبک، برای بررسی تازه‌بودن کش در فرانت‌اند)
router.get("/version", permissionController.getVersion);

// ===== مشاهده (کاتالوگ/ماتریس/گزارش) =====
const CAN_VIEW = requirePermission("roles.matrix.view");
const CAN_VIEW_AUDIT = requirePermission("roles.audit.view");
const CAN_EDIT_ROLES = requirePermission("roles.permissions.edit");
const CAN_EDIT_USERS = requirePermission("users.permissions.edit");

router.get("/catalog", CAN_VIEW, permissionController.getCatalog);
router.get("/roles", CAN_VIEW, permissionController.getRoleMatrix);
router.get("/audit", CAN_VIEW_AUDIT, permissionController.getAuditLogs);

// ===== تغییر سطح دسترسی نقش‌ها =====
router.put("/roles/:role", CAN_EDIT_ROLES, permissionController.updateRolePermissions);
router.post(
  "/roles/:role/reset",
  CAN_EDIT_ROLES,
  permissionController.resetRolePermissions,
);

// ===== سطح دسترسی یک کاربر =====
router.get(
  "/users/:id",
  requirePermission("roles.matrix.view", "users.permissions.edit"),
  permissionController.getUserPermissions,
);
router.put("/users/:id", CAN_EDIT_USERS, permissionController.updateUserPermissions);
router.delete(
  "/users/:id",
  CAN_EDIT_USERS,
  permissionController.resetUserPermissions,
);

module.exports = router;
