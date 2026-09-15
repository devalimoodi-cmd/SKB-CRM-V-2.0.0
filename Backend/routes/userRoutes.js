const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const { protect, authorize, authorizeSelfOr, ADMIN_ROLES } = require("../middleware/auth");
const { uploadProfile } = require("../middleware/upload");
const {
  loginLimiter,
  setupAdminLimiter,
} = require("../middleware/rateLimit");

// ============================================
// مسیرهای عمومی (بدون نیاز به احراز هویت)
// ============================================
router.get("/check-admin", userController.checkAdminExists);
router.post("/setup-admin", setupAdminLimiter, userController.setupAdmin);
router.post("/login", loginLimiter, userController.loginUser);

// ============================================
// مسیرهای محافظت شده (نیاز به احراز هویت)
// ============================================
router.use(protect);

// ===== وضعیت آنلاین =====
// هر کاربر فقط وضعیت خودش را می‌تواند تغییر دهد (ادمین‌ها برای همه)
router.put(
  "/:id/online-status",
  authorizeSelfOr(...ADMIN_ROLES),
  userController.updateOnlineStatus,
);
router.patch(
  "/:id/online-status",
  authorizeSelfOr(...ADMIN_ROLES),
  userController.updateOnlineStatus,
);

// ===== مدیریت کاربران (فقط نقش‌های مدیریتی) =====
router.get("/by-role/:role", authorize(...ADMIN_ROLES), userController.getUsersByRole);
router.get("/", authorize(...ADMIN_ROLES), userController.getAllUsers);

// ثبت نام کاربر جدید (فقط ادمین‌ها)
router.post(
  "/register",
  authorize(...ADMIN_ROLES),
  uploadProfile.single("profile_image"),
  userController.registerUser,
);

// بازنشانی توکن کاربر (فقط ادمین‌ها)
router.post(
  "/:id/reset-token",
  authorize(...ADMIN_ROLES),
  userController.resetUserToken,
);

// بازکردن قفل حساب کاربر (فقط ادمین‌ها)
router.post(
  "/:id/unlock",
  authorize(...ADMIN_ROLES),
  userController.unlockUser,
);

// ===== مشاهده/ویرایش (خودِ کاربر یا ادمین‌ها) =====
router.get("/:id", authorizeSelfOr(...ADMIN_ROLES), userController.getUserById);
router.put(
  "/:id",
  authorizeSelfOr(...ADMIN_ROLES),
  uploadProfile.single("profile_image"),
  userController.updateUser,
);
router.patch(
  "/:id",
  authorizeSelfOr(...ADMIN_ROLES),
  userController.updateUser,
);

// ===== خروج (باطل کردن نشست سمت سرور) =====
router.post("/logout", userController.logoutUser);

// حذف کاربر (فقط ادمین‌ها)
router.delete("/:id", authorize(...ADMIN_ROLES), userController.deleteUser);

module.exports = router;
