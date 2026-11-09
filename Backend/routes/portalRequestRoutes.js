// ============================================================
// routes/portalRequestRoutes.js
// صف «درخواست‌های پورتال» — مسیرهای کارکنان (موج ۱۳.۱۱)
// ------------------------------------------------------------
//  ⚠️ این روتر **`authorize("customer")` ندارد**: نقش مشتری از راه
//  پورتال درخواست می‌فرستد، نه از راه صف بازبینی. برعکس، هر مسیر
//  این‌جا با کلید مجوز کارکنان محافظت می‌شود:
//     GET  /                → portal.requests.view
//     GET  /pending-count   → portal.requests.view
//     GET  /:id             → portal.requests.view
//     POST /:id/approve     → portal.requests.review
//     POST /:id/reject      → portal.requests.review
//
//  🔒 چرا مسیر approve/reject در همین روتر است و نه در
//  /api/units یا /api/halls؟ چون «تأیید درخواست» عملیات مختص همین
//  صف است؛ گذاشتنش زیر روتر موجود، آن مسیرها را برای نقش‌های دیگر
//  باز می‌کرد (چیزی که کل پروژه عمداً از آن پرهیز کرده).
// ============================================================
"use strict";

const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");
const controller = require("../controllers/portalRequestAdminController");

// ✅ همهٔ مسیرها پشت احراز هویت
router.use(protect);

// ✅ کل صف: دیدن (فهرست/جزئیات/شمارنده)
const viewChain = [requirePermission("portal.requests.view")];

// ✅ تصمیم‌گیری: تأیید → اعمال واقعی در داده‌ها
const reviewChain = [requirePermission("portal.requests.review")];

router.get("/pending-count", ...viewChain, controller.getPendingCount);

router.get("/", ...viewChain, controller.listRequests);

router.get("/:id", ...viewChain, controller.getRequest);

router.post("/:id/approve", ...reviewChain, controller.approveRequest);

router.post("/:id/reject", ...reviewChain, controller.rejectRequest);

module.exports = router;
