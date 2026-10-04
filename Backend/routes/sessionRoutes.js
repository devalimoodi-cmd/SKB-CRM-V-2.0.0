// ============================================================
// routes/sessionRoutes.js
// «نشست‌های کاربران» — کجا وارد شده‌ام و بستنِ یک دستگاه (فاز ۱۲.۱)
// ------------------------------------------------------------
//  • GET  /api/sessions            : فهرست نشست‌ها (مدیر + مجوز مشاهده)
//  • GET  /api/sessions/summary    : خلاصهٔ نشست‌ها (مدیر + مجوز مشاهده)
//  • GET  /api/sessions/mine       : نشست‌های خودم (هر کاربرِ لاگین‌شده)
//  • POST /api/sessions/:id/revoke : بستن یک نشست (مدیر + مجوز بستن)
//  • POST /api/sessions/users/:userId/revoke-all
//                                   بستن همهٔ نشست‌های یک کاربر (مدیر + مجوز بستن)
// ------------------------------------------------------------
// ⚠️ مسیرهای ثابت (/mine و /summary) پیش از مسیرهای پارامتری ثبت
//    می‌شوند تا هیچ‌وقت با /:id تلاقی نکنند.
// ⚠️ «بستن نشست» یعنی توکنِ همان دستگاه در درخواست بعدی ۴۰۱ می‌گیرد
//    (میدل‌ور middleware/auth.js با sid همان ردیف را چک می‌کند).
// ============================================================
const express = require("express");
const router = express.Router();
const { protect, authorize, ADMIN_ROLES } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");
const sessionController = require("../controllers/sessionController");

// مشاهدهٔ نشست‌ها: همان کلیدِ «مشاهدهٔ وضعیت آنلاین» (فاز ۱۲.۰) — کلید تکراری نساختیم
const CAN_VIEW_SESSIONS = requirePermission("users.onlineStatus.view");
// بستن نشست: کلید جدید فاز ۱۲.۱
const CAN_REVOKE_SESSIONS = requirePermission("users.sessions.revoke");
const ADMIN_ONLY = authorize(...ADMIN_ROLES);

router.use(protect);

// ===== نشست‌های خودم (هر کاربر لاگین‌شده) =====
router.get("/mine", sessionController.mine);

// ===== مشاهدهٔ مدیریتی =====
router.get("/summary", ADMIN_ONLY, CAN_VIEW_SESSIONS, sessionController.summary);
router.get("/", ADMIN_ONLY, CAN_VIEW_SESSIONS, sessionController.list);

// ===== بستن نشست‌ها =====
router.post(
  "/users/:userId/revoke-all",
  ADMIN_ONLY,
  CAN_REVOKE_SESSIONS,
  sessionController.revokeAll,
);
router.post(
  "/:id/revoke",
  ADMIN_ONLY,
  CAN_REVOKE_SESSIONS,
  sessionController.revoke,
);

module.exports = router;
