// ============================================================
// routes/publicRoutes.js
// مسیرهای عمومی (بدون احراز هویت)
// ------------------------------------------------------------
// ⚠️ فقط تنظیمات «نمایشی» اینجا سرو می‌شوند (لودر سیستمی و …)
//    هیچ دادهٔ کاربری/حساسی نباید به این مسیرها اضافه شود.
// دلیل وجود: سرور فرانت‌اند باید پیش از اجرای هر JS و برای کاربر
// واردنشده هم بداند کدام لودر انتخاب شده است.
// ============================================================
const express = require("express");
const router = express.Router();
const settingsController = require("../controllers/settingsController");

// تنظیمات نمایشی UI: { loader_style: "classic" | "logo" }
router.get("/ui-settings", settingsController.getPublicSettings);

module.exports = router;
