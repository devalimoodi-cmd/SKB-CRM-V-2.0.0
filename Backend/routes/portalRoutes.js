// ============================================================
// routes/portalRoutes.js
// «پورتال مشتری» — فاز ۱۳.۲، ۱۳.۳، ۱۳.۴ و ۱۳.۵
// ------------------------------------------------------------
// ⚠️ تنها مسیرهای اختصاصی نقش مشتری. هیچ‌یک از ۲۰+ فایل مسیر موجود
//    باز نشده‌اند: نقش «مشتری» به هیچ GET موجودی اضافه نشده است.
//    در ۱۳.۳ دادهٔ بیشتر (سالن/گله/هفته/بازدید) و در ۱۳.۴ جزئیات
//    هفته/بازدید و دانلود پیوست، از همین روتر آمد — نه از باز کردن
//    مسیرهای کارکنان.
//
// زنجیرهٔ دسترسی (به ترتیب و همه اجباری):
//   1) protect                 ⇒ توکن معتبر + کاربر فعال + نشست باز
//   2) authorize("customer")    ⇒ فقط نقش مشتری (کارکنان ۴۰۳ می‌گیرند)
//   3) کلید مجوز customer.portal.view  (قابل بستن از پنل مدیریت)
//      ← ۱۳.۵: هر تب کلید مستقل خودش را دارد (tabChain):
//        customer.portal.halls / .flocks / .weeks / .visits
//      ← مسیرهای جزئیات بازدید/پیوست کلید جدا دارند:
//        customer.portal.visit.report  (۱۳.۴)
//   4) requireCustomerLink      ⇒ مشتری بدون پروندهٔ متصل ⇒ ۴۰۳ روشن
//   5) controller              ⇒ customer_id فقط از req.customerScopeId
//
// 🔒 همهٔ مسیرها GET و بدون شناسهٔ «مشتری» هستند؛ تنها پارامتر مجاز
//    page/limit است (سقف ۵۰ در parsePagination). از ۱۳.۴ شناسهٔ
//    «ردیف خودم» در مسیر مجاز است (:id) و کنترلر مالکیت را با
//    customer_id در همان کوئری می‌سنجد.
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
const { uploadPortalDocumentSingle } = require("../middleware/upload");
const Flock = require("../models/Flock");
const ChickPlacement = require("../models/ChickPlacement");
const PortalDocument = require("../models/PortalDocument");
const PortalRequest = require("../models/PortalRequest");
const Hall = require("../models/Hall");
// ✅ ۱۳.۱۵: مالکیت «هفتهٔ خودم» در مسیر سنجیده می‌شود
const WeeklyManagement = require("../models/WeeklyManagement");

// ✅ همهٔ مسیرهای این روتر پشت احراز هویت هستند
router.use(protect);

// زنجیرهٔ مشترک دسترسی (یک منبع حقیقت — هر مسیر تازه باید از همین بگذرد)
const customerChain = [
  authorize("customer"),
  requirePermission("customer.portal.view"),
  requireCustomerLink,
];

// ✅ ۱۳.۵: زنجیرهٔ «هر تب» = زنجیرهٔ مشترک + کلید همان تب.
//    هر مسیر تازهٔ پورتال باید از tabChain استفاده کند، نه customerChain،
//    تا مدیر بتواند هر بخش را جدا ببندد (کلیدهای customer.portal.*).
const tabChain = (key) => [...customerChain, requirePermission(key)];

// ✅ ۱۳.۴: زنجیرهٔ «محتوای گزارش بازدید» = زنجیرهٔ تب بازدیدها + کلید جدا
//    (متن گزارش، پیوست‌ها و دانلود فایل — حساس‌ترین بخش پرونده)
const visitReportChain = [
  ...customerChain,
  requirePermission("customer.portal.visits"),
  requirePermission("customer.portal.visit.report"),
];

// ✅ ۱۳.۸: زنجیرهٔ «پروفایل من» — مشاهده و ویرایش کلید جدا دارند:
//    • دیدن پروفایل: customer.portal.profile
//    • نوشتن:        همان + customer.portal.profile.edit
const profileChain = [
  ...customerChain,
  requirePermission("customer.portal.profile"),
  requireOwnScope,
];

const profileEditChain = [
  ...profileChain,
  requirePermission("customer.portal.profile.edit"),
];

// ✅ ۱۳.۸: زنجیرهٔ «داشبورد تحلیلی» — هر زیربخش کلید خودش را دارد
//    (تحلیل / مقایسه با گله‌های خودم / خروجی CSV / نمودارها)
const dashboardChain = [
  ...customerChain,
  requirePermission("customer.portal.dashboard"),
];

// 🔒 داشبورد شناسهٔ «گله» را در کوئری می‌گیرد ⇒ پیش از کنترلر باید ثابت
//    شود که آن گله در پروندهٔ همین مشتری است (وگرنه دادهٔ گلهٔ دیگری
//    از مسیر dashboardController بیرون می‌رفت). ردیف غیرخودی → ۴۰۴.
//    ⚠️ نام‌گذاری گیج‌کنندهٔ ماژول کارشناسان: flockGroupId = Flock.id
//    (دورهٔ گله) ولی flockId = ChickPlacement.id (جوجه‌ریزی/سالن).
const dashboardOwnership = [
  requireOwnedRow({
    model: Flock,
    source: "query",
    key: "flockGroupId",
    store: "ownedFlock",
    label: "گلهٔ داشبورد",
  }),
  requireOwnedRow({
    model: ChickPlacement,
    source: "query",
    key: "flockId",
    store: "ownedFlockById",
    label: "جوجه‌ریزی نمودار",
  }),
];

// خلاصهٔ پروندهٔ خودم (شمارنده‌ها + ۳ ردیف آخر) — محتوای هر بخش در
// کنترلر با همان کلیدهای customer.portal.* فیلتر می‌شود
router.get("/me", ...customerChain, portalController.getPortalSummary);

// فهرست صفحه‌بندی‌شدهٔ سالن‌های خودم
router.get(
  "/halls",
  ...tabChain("customer.portal.halls"),
  portalController.getMyHalls,
);

// فهرست صفحه‌بندی‌شدهٔ گله‌های خودم
router.get(
  "/flocks",
  ...tabChain("customer.portal.flocks"),
  portalController.getMyFlocks,
);

// فهرست صفحه‌بندی‌شدهٔ هفته‌های مدیریتی خودم
router.get(
  "/weeks",
  ...tabChain("customer.portal.weeks"),
  portalController.getMyWeeks,
);

// فهرست صفحه‌بندی‌شدهٔ بازدیدهای خودم (تاریخ/وضعیت + نشانهٔ وجود گزارش)
router.get(
  "/visits",
  ...tabChain("customer.portal.visits"),
  portalController.getMyVisits,
);

// ۱۳.۴ — جزئیات یک هفتهٔ مدیریتی (بیماری/واکسن/دارو/خوراک)
router.get(
  "/weeks/:id",
  ...tabChain("customer.portal.weeks"),
  portalController.getMyWeekDetail,
);

// ۱۳.۴ — جزئیات یک بازدید: متن گزارش + فهرست پیوست‌ها
router.get(
  "/visits/:id",
  ...visitReportChain,
  portalController.getMyVisitDetail,
);

// ۱۳.۴ — دانلود یک پیوست مشخص (فایل داخل uploads/ و متعلق به همان بازدید)
router.get(
  "/visits/:id/attachments/:attachmentId",
  ...visitReportChain,
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
router.get("/profile", ...profileChain, portalController.getMyProfile);

router.patch(
  "/profile",
  ...profileEditChain,
  portalWriteLimiter,
  portalController.updateMyProfile,
);

// درخواست کد: سقف نوشتن + سقف سخت‌گیرانهٔ کد (هر پیامک هزینه دارد)
router.post(
  "/profile/mobile/request",
  ...profileEditChain,
  portalWriteLimiter,
  otpLimiter,
  portalProfileOtpController.requestMobileChange,
);

// تأیید کد: فقط سقف نوشتن (هر حدس، یک verify است ⇒ otpLimiter هم می‌آید)
router.post(
  "/profile/mobile/confirm",
  ...profileEditChain,
  portalWriteLimiter,
  otpLimiter,
  portalProfileOtpController.confirmMobileChange,
);

// ============================================================
// ۱۳.۸ — «داشبورد تحلیلی من»
// ------------------------------------------------------------
// به‌جای باز کردن /api/dashboard/* برای نقش مشتری (که با customerId
// در کوئری، کل داده‌های شرکت را لو می‌داد) این چهار مسیر اضافه شد:
//   GET /dashboard/options   گله‌ها/سالن‌های خودم + کدام نمودار مجاز است
//   GET /dashboard/summary   شمارنده‌های خودم (بدون آمار سایر مشتریان)
//   GET /dashboard/charts    دادهٔ نمودارها (customerId تحمیل می‌شود)
//   GET /dashboard/analysis  تحلیل‌ها (فقط گله‌های خودم)
// ============================================================
router.get(
  "/dashboard/options",
  ...dashboardChain,
  portalDashboardController.getMyDashboardOptions,
);

router.get(
  "/dashboard/summary",
  ...dashboardChain,
  requirePermission("customer.portal.dashboard.analysis"),
  portalDashboardController.getMyDashboardSummary,
);

// نمودارها: کلید پایهٔ تب + مالکیت ردیف. کدام نمودار رسم شود با
// کلیدهای customer.portal.chart.* کنترل می‌شود (options.charts).
router.get(
  "/dashboard/charts",
  ...dashboardChain,
  ...dashboardOwnership,
  portalDashboardController.getMyCharts,
);

router.get(
  "/dashboard/analysis",
  ...dashboardChain,
  requirePermission("customer.portal.dashboard.analysis"),
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
//     ⇒ ۴۰۴ (نه ۴۰۳) تا وجود ردیف لو نرود. مدرک حذف‌شده هم چون
//     paranoid است در همان findOne دیده نمی‌شود ⇒ ۴۰۴.
// ============================================================
const documentsChain = tabChain("customer.portal.documents");

// آپلود: مجوز نوشتن + سقف نوشتن + سهمیه + multer (به همین ترتیب)
const documentsUploadChain = [
  ...documentsChain,
  requirePermission("customer.portal.documents.upload"),
  portalWriteLimiter,
  portalDocumentsController.ensureDocumentQuota,
  uploadPortalDocumentSingle,
];

// حذف: مجوز حذف + سقف نوشتن + مالکیت ردیف
const documentsDeleteChain = [
  ...documentsChain,
  requirePermission("customer.portal.documents.delete"),
  portalWriteLimiter,
  requireOwnedRow({ model: PortalDocument, label: "مدرک" }),
];

// دانلود: فقط مالکیت ردیف (نوشتن نیست، پس بدون سقف نوشتن)
const documentsFileChain = [
  ...documentsChain,
  requireOwnedRow({ model: PortalDocument, label: "مدرک" }),
];

router.get(
  "/documents",
  ...documentsChain,
  portalDocumentsController.listMyDocuments,
);

router.post(
  "/documents",
  ...documentsUploadChain,
  portalDocumentsController.uploadMyDocument,
);

router.get(
  "/documents/:id/file",
  ...documentsFileChain,
  portalDocumentsController.downloadMyDocument,
);

router.delete(
  "/documents/:id",
  ...documentsDeleteChain,
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
//   • سقف نوشتن پورتال (portalWriteLimiter) روی هر دو نوشتن فعال است
//   • لغو فقط روی ردیف خودم: requireOwnedRow ⇒ ردیف غیرخودی ۴۰۴
// ============================================================
const farmChain = tabChain("customer.portal.farm");

const farmRequestChain = [
  ...farmChain,
  requirePermission("customer.portal.farm.request"),
  portalWriteLimiter,
];

const farmCancelChain = [
  ...farmChain,
  requirePermission("customer.portal.farm.cancel"),
  portalWriteLimiter,
  requireOwnedRow({ model: PortalRequest, label: "درخواست" }),
];

router.get("/farm/options", ...farmChain, portalFarmController.getFarmOptions);

// ✅ ۱۳.۱۳: جزئیات یک سالن خودم (پیش‌پرکردن فرم ویرایش/جزئیات).
// فقط خواندن است ⇒ بدون سقف نوشتن؛ مالکیت ردیف با requireOwnedRow.
router.get(
  "/farm/halls/:id",
  ...farmChain,
  requireOwnedRow({ model: Hall, label: "سالن" }),
  portalFarmController.getMyHall,
);

// ✅ ۱۳.۱۴: جزئیات یک دورهٔ خودم (پیش‌پرکردن فرم هفته/ویرایش دوره).
// فقط خواندن ⇒ بدون سقف نوشتن؛ مالکیت ردیف با requireOwnedRow.
router.get(
  "/farm/placements/:id",
  ...farmChain,
  requireOwnedRow({ model: ChickPlacement, label: "دوره" }),
  portalFarmController.getMyPlacement,
);

// ✅ ۱۳.۱۵: جزئیات یک هفتهٔ خودم (پیش‌پرکردن فرم ویرایش هفته).
// فقط خواندن ⇒ بدون سقف نوشتن؛ مالکیت ردیف با requireOwnedRow.
router.get(
  "/farm/weeklies/:id",
  ...farmChain,
  requireOwnedRow({ model: WeeklyManagement, label: "هفته" }),
  portalFarmController.getMyWeekly,
);

router.get(
  "/farm/requests",
  ...farmChain,
  portalFarmController.listMyRequests,
);

router.post(
  "/farm/requests",
  ...farmRequestChain,
  portalFarmController.createMyRequest,
);

router.post(
  "/farm/requests/:id/cancel",
  ...farmCancelChain,
  portalFarmController.cancelMyRequest,
);

module.exports = router;

