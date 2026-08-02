const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const { protect, authorize } = require("../middleware/auth");
const upload = require("../middleware/upload");

// ============================================
// مسیرهای عمومی (بدون نیاز به احراز هویت)
// ============================================
router.get("/check-admin", userController.checkAdminExists);
router.post("/setup-admin", userController.setupAdmin);
router.post("/login", userController.loginUser);

// ============================================
// مسیرهای محافظت شده (نیاز به احراز هویت)
// ============================================

// سایر مسیرهای محافظت شده
router.use(protect);

// وضعیت آنلاین
router.put("/:id/online-status", userController.updateOnlineStatus);

// بازنشانی توکن
router.post("/:id/reset-token", userController.resetUserToken);

// دریافت کاربران بر اساس نقش
router.get("/by-role/:role", userController.getUsersByRole);
router.get("/", userController.getAllUsers);

// دریافت، بروزرسانی و حذف کاربر (با :id)
router.get("/:id", userController.getUserById);
router.put("/:id", upload.single("profile_image"), userController.updateUser);
router.delete("/:id", userController.deleteUser);

// ثبت نام کاربر جدید
router.post(
  "/register",
  upload.single("profile_image"),
  userController.registerUser,
);

module.exports = router;
