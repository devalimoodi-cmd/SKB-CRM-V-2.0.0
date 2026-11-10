// ============================================================
// routes/portalRoutes.js
// «پورتال مشتری» — فاز ۱۳.۲ تا ۱۳.۱۹
// ------------------------------------------------------------
// ⚠️ تنها مسیرهای اختصاصی نقش مشتری. هیچ‌یک از ۲۰+ فایل مسیر موجود
//    باز نشده‌اند: نقش «مشتری» به هیچ GET موجودی اضافه نشده است.
//
// ✅ موج ۱۳.۱۸ — «صفر رشتهٔ کلید دستی»
// ------------------------------------------------------------
//  پیش از این موج، هر مسیر زنجیرهٔ خودش را دستی می‌ساخت: کلید مجوز،
//  کلید محتوا، مدل مالکیت و سقف نرخ، هر کدام یک رشتهٔ تایپ‌شده در
//  همین فایل. سه جای دیگر (کنترلر، منوی فرانت، api.const) هم همان
//  کلیدها را جدا تایپ می‌کردند ⇒ هر موج تازه یک ناهم‌ترازی تازه.
//
//  از ۱۳.۱۸ همه‌چیز از config/portalSchema می‌آید و این فایل فقط
//  «اعلان مسیر» است:
//      router.<method>("<path>", ...chainFor("<ENDPOINT_ID>"), controller.method)
//  دو گارد، هم‌ترازی را اجرا می‌سنجند:
//      Backend/portal-schema-test.mjs        (روتر ⇔ اسکیما)
//      Frontend/portal-schema-guard-test.mjs (منو/پنل/HTML/API ⇔ اسکیما)
//
// زنجیرهٔ دسترسی (به ترتیب و همه اجباری — chainFor همین را می‌سازد):
//   1) protect                       ⇒ توکن معتبر + کاربر فعال + نشست باز
//   2) authorize("customer")          ⇒ فقط نقش مشتری (کارکنان ۴۰۳)
//   3) requirePermission(view)        ⇒ کلید پایه (قابل بستن از پنل)
//   4) requirePermission(...keys)     ⇒ کلید همان تب/محتوا
//   5) requireOwnScope                ⇒ فقط مسیرهای «پروندهٔ خودم»
//   6) portalWriteLimiter             ⇒ فقط نوشتن‌ها
//   7) requireOwnedRow                ⇒ مالکیت ردیف (:id) — ۴۰۴ نه ۴۰۳
//   8) otpLimiter                     ⇒ مسیرهای پیامکی
//   9) quota + multer                 ⇒ تنها آپلود پورتال
//   10) requireCustomerLink (داخل BASE) ⇒ مشتری بدون پرونده ⇒ ۴۰۳ روشن
//
// 🔒 همهٔ مسیرها GET‌اند به‌جز هفت نوشتنِ شناخته‌شده؛ تنها پارامتر
//    مجاز page/limit است (سقف ۵۰ در parsePagination). شناسهٔ «ردیف
//    خودم» در مسیر مجاز است (:id) و مالکیت در سرور سنجیده می‌شود.
// ============================================================
"use strict";

const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");
const { requireCustomerLink } = require("../middleware/customerScope");
const { requireOwnedRow, requireOwnScope } = require("../middleware/portalOwnership");
const { portalWriteLimiter, otpLimiter } = require("../middleware/rateLimit");
const portalController = require("../controllers/portalController");
const portalProfileOtpController = require("../controllers/portalProfileOtpController");
const portalDashboardController = require("../controllers/portalDashboardController");
// ✅ موج ۱۳.۱۰ — «مدارک من» (آپلود/حذف نرم/دانلود)
const portalDocumentsController = require("../controllers/portalDocumentsController");
// ✅ موج ۱۳.۱۱ — «درخواست‌های فارم» (الگوی ب: درخواست مشتری + تأیید کارشناس)
const portalFarmController = require("../controllers/portalFarmController");
// ✅ موج ۱۳.۱۹ — «پایان دوره» و «گزارش نهایی دوره» (فقط خواندن)
const portalCompletionController = require("../controllers/portalCompletionController");

const { uploadPortalDocumentSingle } = require("../middleware/upload");

// ✅ ۱۳.۱۸ — اسکیمای مشترک: تنها منبع کلیدها/مالکیت/سقف‌ها
const {
  PORTAL_BASE_KEY,
  PORTAL_ROLE,
  endpointById,
} = require("../config/portalSchema");

// مدل‌ها فقط برای requireOwnedRow (نامشان در اسکیما آمده است)
const Flock = require("../models/Flock");
const ChickPlacement = require("../models/ChickPlacement");
const PortalDocument = require("../models/PortalDocument");
const PortalRequest = require("../models/PortalRequest");
const Hall = require("../models/Hall");
const FlockCompletion = require("../models/FlockCompletion");
const WeeklyManagement = require("../models/WeeklyManagement");

// ✅ همهٔ مسیرهای این روتر پشت احراز هویت هستند
router.use(protect);

// نامِ مدل در اسکیما ⇐ مدل واقعی Sequelize
const MODEL_BY_NAME = {
  Flock,
  ChickPlacement,
  PortalDocument,
  PortalRequest,
  Hall,
  FlockCompletion,
  WeeklyManagement,
};

// ============================================================
// ✅ ۱۳.۱۸ — تنها سازندهٔ زنجیره
// ------------------------------------------------------------
//  ترتیب میان‌افزارها «قرارداد» است و گارد هم همین ترتیب را می‌سنجد
//  (پیش از ۱۳.۱۸ کلید profile.edit در PATCH /profile پیش از
//  requireOwnScope بود؛ حالا همهٔ کلیدها یک‌جا و پیش از اسکوپ
//  می‌آیند — چون requireCustomerLink پیش‌تر اسکوپ را تضمین کرده،
//  رفتار پاسخ عوض نمی‌شود و «رد زودتر» امن‌تر است).
//
//  اگر مدلی در MODEL_BY_NAME نباشد، همان لحظهٔ استارت خطا می‌دهد
//  (به‌جای مسیرِ بی‌مالکیت در زمان اجرا).
// ============================================================
const chainFor = (endpointId) => {
  const endpoint = endpointById(endpointId);
  // 🔒 «BASE» = نقش مشتری + کلید پایه + وجود پروندهٔ مشتری.
  //    requireCustomerLink پیش از هر کوئری اجرا می‌شود تا مشتری بدون
  //    پرونده پاسخ ۴۰۳ روشن بگیرد (نه فهرست خالی یا ۵۰۰).
  const chain = [
    authorize(PORTAL_ROLE),
    requirePermission(PORTAL_BASE_KEY),
    requireCustomerLink,
  ];

  endpoint.keys.forEach((key) => chain.push(requirePermission(key)));

  if (endpoint.scope === "own") chain.push(requireOwnScope);
  if (endpoint.write) chain.push(portalWriteLimiter);

  endpoint.ownership.forEach((row) => {
    const model = MODEL_BY_NAME[row.model];
    if (!model) {
      throw new Error(`پورتال: مدل مالکیت ناشناخته در اسکیما «${row.model}»`);
    }
    chain.push(
      requireOwnedRow({
        model,
        source: row.source,
        key: row.key,
        store: row.store,
        label: row.label,
      }),
    );
  });

  if (endpoint.otp) chain.push(otpLimiter);

  // آپلود: سهمیه **پیش از** multer سنجیده می‌شود (هیچ فایل یتیمی نمی‌ماند)
  if (endpoint.upload) {
    chain.push(
      portalDocumentsController.ensureDocumentQuota,
      uploadPortalDocumentSingle,
    );
  }

  return chain;
};

// ============================================================
// خلاصهٔ پروندهٔ خودم (شمارنده‌ها + ۳ ردیف آخر)
//  محتوای هر بخش در کنترلر با همان کلیدهای customer.portal.* فیلتر می‌شود
// ============================================================
router.get("/me", ...chainFor("PORTAL_ME"), portalController.getPortalSummary);

// ============================================================
// ۱۳.۳ — «دادهٔ بیشتر»: سالن / گله / هفته / بازدید
//  هر تب کلید مستقل خودش را دارد (قابل بستن جدا توسط مدیر)
// ============================================================
router.get("/halls", ...chainFor("PORTAL_HALLS"), portalController.getMyHalls);

router.get("/flocks", ...chainFor("PORTAL_FLOCKS"), portalController.getMyFlocks);

router.get("/weeks", ...chainFor("PORTAL_WEEKS"), portalController.getMyWeeks);

router.get("/visits", ...chainFor("PORTAL_VISITS"), portalController.getMyVisits);

// ۱۳.۴ — جزئیات یک هفتهٔ مدیریتی (بیماری/واکسن/دارو/خوراک)
router.get(
  "/weeks/:id",
  ...chainFor("PORTAL_WEEK_DETAIL"),
  portalController.getMyWeekDetail,
);

// ۱۳.۴ — جزئیات یک بازدید: متن گزارش + فهرست پیوست‌ها
//  🔒 کلید جدا: customer.portal.visit.report (حساس‌ترین بخش پرونده)
router.get(
  "/visits/:id",
  ...chainFor("PORTAL_VISIT_DETAIL"),
  portalController.getMyVisitDetail,
);

// ۱۳.۴ — دانلود یک پیوست مشخص (فایل داخل uploads/ و متعلق به همان بازدید)
router.get(
  "/visits/:id/attachments/:attachmentId",
  ...chainFor("PORTAL_VISIT_ATTACHMENT"),
  portalController.downloadMyAttachment,
);

// ============================================================
// ۱۳.۸ — «پروفایل من»
// ------------------------------------------------------------
// GET   /profile                 مشاهدهٔ پروندهٔ خودم (+ فیلدهای قابل ویرایش)
// PATCH /profile                  ویرایش با فهرست سفید (بی‌درنگ فعال)
// POST  /profile/mobile/request   درخواست کد پیامکی برای شمارهٔ جدید
// POST  /profile/mobile/confirm   تأیید کد و تغییر شماره (اتمیک)
//
// 🔒 چرا شمارهٔ موبایل مسیر جدا دارد؟ شمارهٔ ورود = هویت حساب؛ با
//    ویرایش ساده، هر نشست دزدیده‌شده می‌توانست حساب را بردارد.
//    مسیر PATCH عمداً mobile_number را نادیده می‌گیرد
//    (services/portalProfileRules → PROFILE_LOCKED).
// ============================================================
router.get("/profile", ...chainFor("PORTAL_PROFILE"), portalController.getMyProfile);

router.patch(
  "/profile",
  ...chainFor("PORTAL_PROFILE_UPDATE"),
  portalController.updateMyProfile,
);

// درخواست کد: سقف نوشتن + سقف سخت‌گیرانهٔ کد (هر پیامک هزینه دارد)
router.post(
  "/profile/mobile/request",
  ...chainFor("PORTAL_PROFILE_MOBILE_REQUEST"),
  portalProfileOtpController.requestMobileChange,
);

// تأیید کد: فقط سقف نوشتن (هر حدس، یک verify است ⇒ otpLimiter هم می‌آید)
router.post(
  "/profile/mobile/confirm",
  ...chainFor("PORTAL_PROFILE_MOBILE_CONFIRM"),
  portalProfileOtpController.confirmMobileChange,
);

// ============================================================
// ۱۳.۸ — «داشبورد تحلیلی من»
// ------------------------------------------------------------
// به‌جای باز کردن /api/dashboard/* برای نقش مشتری (که با customerId
// در کوئری، کل داده‌های شرکت را لو می‌داد) این چهار مسیر اضافه شد.
// 🔒 نمودارها شناسهٔ گله/جوجه‌ریزی را در کوئری می‌گیرند ⇒ مالکیت
//    پیش از کنترلر با requireOwnedRow سنجیده می‌شود (۴۰۴).
// ============================================================
router.get(
  "/dashboard/options",
  ...chainFor("DASHBOARD_OPTIONS"),
  portalDashboardController.getMyDashboardOptions,
);

router.get(
  "/dashboard/summary",
  ...chainFor("DASHBOARD_SUMMARY"),
  portalDashboardController.getMyDashboardSummary,
);

router.get(
  "/dashboard/charts",
  ...chainFor("DASHBOARD_CHARTS"),
  portalDashboardController.getMyCharts,
);

router.get(
  "/dashboard/analysis",
  ...chainFor("DASHBOARD_ANALYSIS"),
  portalDashboardController.getMyAnalysis,
);

// ============================================================
// ✅ ۱۳.۱۰ — «مدارک من»
// ------------------------------------------------------------
//  مشتری می‌تواند مدرک (تصویر/PDF) بفرستد، فهرست را ببیند، فایل را
//  با توکن دانلود کند و مدرک را «حذف نرم» کند.
//
// 🔒 چرا این بخش با بقیهٔ پورتال متفاوت است؟
//   • تنها مسیر آپلود فایل در پورتال است ⇒ سهمیه **پیش از** multer
//     سنجیده می‌شود (هیچ فایل یتیمی ساخته نمی‌شود).
//   • فایل در پوشهٔ خصوصی (private/portal_documents) می‌نشیند، نه
//     زیر /uploads که در server.js بدون احراز هویت سرو می‌شود.
//   • حذف نرم است (paranoid) ⇒ فایل برای بازبینی کارشناس می‌ماند.
//   • مالکیت ردیف با requireOwnedRow سنجیده می‌شود؛ مدرک مشتری دیگر
//     ⇒ ۴۰۴ (نه ۴۰۳) تا وجود ردیف لو نرود.
// ============================================================
router.get(
  "/documents",
  ...chainFor("PORTAL_DOCUMENTS"),
  portalDocumentsController.listMyDocuments,
);

router.post(
  "/documents",
  ...chainFor("PORTAL_DOCUMENT_UPLOAD"),
  portalDocumentsController.uploadMyDocument,
);

router.get(
  "/documents/:id/file",
  ...chainFor("PORTAL_DOCUMENT_FILE"),
  portalDocumentsController.downloadMyDocument,
);

router.delete(
  "/documents/:id",
  ...chainFor("PORTAL_DOCUMENT_DELETE"),
  portalDocumentsController.deleteMyDocument,
);

// ============================================================
// ✅ ۱۳.۱۱ — «درخواست‌های فارم» (الگوی ب)
// ------------------------------------------------------------
//  مشتری واحد/سالن/جوجه‌ریزی را **درخواست** می‌کند؛ تا تأیید کارشناس
//  هیچ ردیفی در جداول اصلی ساخته نمی‌شود. مسیرهای تأیید/رد در روتر
//  جداگانهٔ /api/portal-requests (فقط کارکنان) است.
//
// 🔒 قواعد این بخش:
//   • customer_id فقط از توکن (req.customerScopeId)
//   • payload فقط با فهرست سفید ذخیره می‌شود (services/portalRequestRules)
//   • لغو فقط روی ردیف خودم: requireOwnedRow ⇒ ردیف غیرخودی ۴۰۴
// ============================================================
router.get(
  "/farm/options",
  ...chainFor("FARM_OPTIONS"),
  portalFarmController.getFarmOptions,
);

// ✅ ۱۳.۱۳: جزئیات یک سالن خودم (پیش‌پرکردن فرم ویرایش/جزئیات).
router.get(
  "/farm/halls/:id",
  ...chainFor("FARM_HALL_DETAIL"),
  portalFarmController.getMyHall,
);

// ✅ ۱۳.۱۴: جزئیات یک دورهٔ خودم (پیش‌پرکردن فرم هفته/ویرایش دوره).
router.get(
  "/farm/placements/:id",
  ...chainFor("FARM_PLACEMENT_DETAIL"),
  portalFarmController.getMyPlacement,
);

// ✅ ۱۳.۱۵: جزئیات یک هفتهٔ خودم (پیش‌پرکردن فرم ویرایش هفته).
router.get(
  "/farm/weeklies/:id",
  ...chainFor("FARM_WEEKLY_DETAIL"),
  portalFarmController.getMyWeekly,
);

router.get(
  "/farm/requests",
  ...chainFor("FARM_REQUESTS"),
  portalFarmController.listMyRequests,
);

router.post(
  "/farm/requests",
  ...chainFor("FARM_REQUEST_CREATE"),
  portalFarmController.createMyRequest,
);

router.post(
  "/farm/requests/:id/cancel",
  ...chainFor("FARM_REQUEST_CANCEL"),
  portalFarmController.cancelMyRequest,
);

// ============================================================
// ✅ ۱۳.۱۹ — «پایان دوره» و «گزارش نهایی دوره» (فقط خواندن)
// ------------------------------------------------------------
//  منبع داده: flock_completions (+ flock_completion_halls) و
//  هفته‌های همان جوجه‌ریزی‌ها. **هیچ مایگریشن و هیچ ستون تازه‌ای
//  لازم نشد** — فقط خواندنِ همان چیزی که کارشناس ثبت کرده است.
//
// 🔒 دو کلید محتوا (قابل بستن جدا توسط مدیر):
//   • customer.portal.completion        → فهرست + شاخص‌های هر دوره
//   • customer.portal.completion.report → گزارش نهایی (ریز سالن‌ها،
//     روند هفتگی، جمع دارو/واکسن)
// ============================================================
router.get(
  "/completions",
  ...chainFor("PORTAL_COMPLETIONS"),
  portalCompletionController.listMyCompletions,
);

router.get(
  "/completions/:id",
  ...chainFor("PORTAL_COMPLETION_DETAIL"),
  portalCompletionController.getMyCompletion,
);

module.exports = router;
