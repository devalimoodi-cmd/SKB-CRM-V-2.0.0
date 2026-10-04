// ============================================================
// routes/presenceRoutes.js
// «حضور کاربران» — چه کسی آنلاین است و آخرین فعالیتش کِی بوده
// ------------------------------------------------------------
//  • POST /api/presence/heartbeat : تازه‌کردن حضور «خودِ کاربر» (هر کاربری)
//  • POST /api/presence/offline   : خروج صریح (دکمهٔ خروج / بستن تب، keepalive)
//  • GET  /api/presence/summary   : فهرست آنلاین‌ها (فقط نقش‌های مدیریتی)
// ------------------------------------------------------------
// ⚠️ heartbeat هویت را از توکن می‌گیرد (req.user.id) و هیچ شناسه‌ای از
//    بدنهٔ درخواست نمی‌پذیرد ⇒ کاربر نمی‌تواند حضور دیگری را دست‌کاری کند.
// ============================================================
const express = require("express");
const router = express.Router();
const { protect, authorize, ADMIN_ROLES } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");
const presenceService = require("../services/presenceService");
const { successResponse, errorResponse } = require("../utils/response");

// سطح دسترسی مدیریتی (کلید از قبل در کاتالوگ موجود بود: users.onlineStatus.view)
const CAN_VIEW_PRESENCE = requirePermission("users.onlineStatus.view");
const ADMIN_ONLY = authorize(...ADMIN_ROLES);

router.use(protect);

// ===== تازه‌کردن حضور خودم =====
router.post("/heartbeat", (req, res) => {
  presenceService.touch(req.user.id);
  return successResponse(
    res,
    {
      online: true,
      window_seconds: presenceService.ONLINE_WINDOW_SECONDS,
      throttle_seconds: presenceService.TOUCH_THROTTLE_SECONDS,
    },
    "حضور ثبت شد",
  );
});

// ===== خروج صریح (بدون باطل‌کردن توکن — «خروج» واقعی در /api/users/logout است) =====
router.post("/offline", async (req, res) => {
  try {
    await presenceService.markOffline(req.user.id);
    return successResponse(res, { online: false }, "وضعیت آفلاین ثبت شد");
  } catch (error) {
    console.error("❌ خطا در ثبت وضعیت آفلاین:", error.message);
    return errorResponse(res, "ثبت وضعیت آفلاین ناموفق بود", 500);
  }
});

// ===== فهرست کاربران و وضعیت حضورشان (پنل مدیریت) =====
router.get("/summary", ADMIN_ONLY, CAN_VIEW_PRESENCE, async (req, res) => {
  try {
    const summary = await presenceService.getSummary();
    return successResponse(res, summary, "وضعیت حضور کاربران");
  } catch (error) {
    console.error("❌ خطا در دریافت وضعیت حضور:", error.message);
    return errorResponse(res, "خطا در دریافت وضعیت حضور کاربران", 500);
  }
});

module.exports = router;
