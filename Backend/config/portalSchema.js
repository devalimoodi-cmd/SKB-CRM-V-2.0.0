// ============================================================
// config/portalSchema.js
// «اسکیمای مشترک پورتال مشتری» — موج ۱۳.۱۸
// ------------------------------------------------------------
//  چرا این فایل؟ تا موج ۱۳.۱۷ همان یک واقعیت (کلید مجوز، مسیر،
//  پنل، مالکیت ردیف) در چهار جا **دستی تایپ** می‌شد:
//   • routes/portalRoutes.js         (زنجیرهٔ میان‌افزارها)
//   • controllers/portalController.js (sections/features)
//   • features/portal/portal.menu.js  (کلید منو + کلید محتوا)
//   • core/constants/api.const.js     (مسیر HTTP)
//  نتیجه: هر موج تازه یک کلید را در سه جا اضافه می‌کرد و در جای
//  چهارم جا می‌ماند ⇒ ۴۰۳ در سرور ولی لینک باز در منو، یا برعکس.
//  این فایل تنها جای تعریف است؛ سه مصرف‌کنندهٔ بالا از آن می‌خوانند
//  و دو گارد (portal-schema-test / portal-schema-guard-test) هم‌ترازی
//  را **اجرا** می‌سنجند.
//
//  🔒 قواعد سخت (تغییرناپذیر):
//   ۱) فقط GET به‌جز هفت نوشتنِ شناخته‌شده؛ هر نوشتن باید سقف نرخ
//      (portalWriteLimiter) داشته باشد.
//   ۲) هیچ مسیری شناسهٔ «مشتری» نمی‌گیرد؛ شناسهٔ ردیف فقط :id است و
//      مالکیت با requireOwnedRow سنجیده می‌شود — یا اگر کنترلر خودش
//      با customer_id در همان کوئری می‌سنجد، scope: "controller".
//   ۳) کلید پایهٔ احراز دسترسی همیشه customer.portal.view است.
//   ۴) فیلدهای «هرگز» (اقتصاد گله، یادداشت داخلی، کاربر کارشناس،
//      شناسهٔ مشتری) در FORBIDDEN_FIELDS یک‌جا فهرست شده‌اند.
//
//  ⚠️ ترتیب زنجیرهٔ میان‌افزار (canonical — گارد همین را می‌سنجد):
//      protect → authorize("customer") → requirePermission(BASE)
//      → requirePermission(...keys) → requireOwnScope (scope=own)
//      → portalWriteLimiter (write) → requireOwnedRow(‌ownership)
//      → otpLimiter (otp) → ensureDocumentQuota + multer (upload)
//     پیش از ۱۳.۱۸ تنها تفاوت، جای کلید profile.edit در زنجیرهٔ
//     PATCH /profile بود (پیش از requireOwnScope) که بی‌اثر است:
//     requireCustomerLink پیش‌تر اسکوپ را تضمین کرده است.
// ============================================================
"use strict";

// ============================================================
// ۱) کلیدهای مجوز (یک‌جا؛ هیچ رشتهٔ دستی در روتر/کنترلر)
// ============================================================
const KEYS = Object.freeze({
  VIEW: "customer.portal.view",
  HALLS: "customer.portal.halls",
  FLOCKS: "customer.portal.flocks",
  WEEKS: "customer.portal.weeks",
  VISITS: "customer.portal.visits",
  VISIT_REPORT: "customer.portal.visit.report",
  PROFILE: "customer.portal.profile",
  PROFILE_EDIT: "customer.portal.profile.edit",
  DASHBOARD: "customer.portal.dashboard",
  DASHBOARD_ANALYSIS: "customer.portal.dashboard.analysis",
  DASHBOARD_COMPARE: "customer.portal.dashboard.compare",
  DASHBOARD_EXPORT: "customer.portal.dashboard.export",
  DOCUMENTS: "customer.portal.documents",
  DOCUMENTS_UPLOAD: "customer.portal.documents.upload",
  DOCUMENTS_DELETE: "customer.portal.documents.delete",
  FARM: "customer.portal.farm",
  FARM_REQUEST: "customer.portal.farm.request",
  FARM_CANCEL: "customer.portal.farm.cancel",
  // ✅ موج ۱۳.۲۱ — «ارسال تیکت» (گفتگو با پشتیبانی از داخل پورتال).
  //    ✅ ۱۳.۲۲: این کلید حالا هم «دیده‌شدن» را کنترل می‌کند و هم گیتِ
  //    واقعیِ سرور است: شش روت گفتگوی خودِ کاربر در /api/suggestions
  //    با `requireRolePermission("customer", ...)` بسته می‌شوند.
  TICKETS: "customer.portal.tickets",
  COMPLETION: "customer.portal.completion",
  COMPLETION_REPORT: "customer.portal.completion.report",
  // نمودارهای داشبورد — فقط «نمایش کارت نمودار» را کنترل می‌کنند
  CHART_WEIGHT: "customer.portal.chart.weight",
  CHART_GAIN: "customer.portal.chart.gain",
  CHART_MORTALITY: "customer.portal.chart.mortality",
  CHART_FEED: "customer.portal.chart.feed",
  CHART_FCR: "customer.portal.chart.fcr",
  CHART_STANDARDS: "customer.portal.chart.standards",
});

// کلید پایه — هر مسیر پورتال از آن می‌گذرد (قابل بستن توسط مدیر)
const PORTAL_BASE_KEY = KEYS.VIEW;

// تنها نقش مجاز روی این روتر
const PORTAL_ROLE = "customer";

// ============================================================
// ۲) پنل‌ها (۱۳ = تعداد data-portal-panel در portal.html)
//    ➕ ۱۳.۲۱: «شیت‌ها» جدا شمرده می‌شوند (بخش ۲.۱) — فرم شناور بدون مسیر.
// ------------------------------------------------------------
//  content.keys + content.mode  → «لایهٔ محتوا» (همان چیزی که سرور
//  اجرا می‌کند). mode: "any" یعنی یکی کافی است، "all" یعنی همه.
//  menuKeys[0] = کلید «لایهٔ منو»؛ بقیه برای پنل‌های چندمنویه
//  (مثل جزئیات سالن که از چهار زیرمنو باز می‌شود).
// ============================================================
const PORTAL_PANELS = [
  {
    id: "dashboard",
    title: "داشبورد",
    route: "#/dashboard",
    menuKeys: ["customer.portal.menu.dashboard"],
    content: { keys: [KEYS.DASHBOARD], mode: "any" },
    status: "live",
    note: "شمارنده‌ها + نمودارها + تحلیل (خروجی /me و /dashboard/*)",
  },
  {
    id: "profile",
    title: "پروفایل من",
    route: "#/profile",
    menuKeys: ["customer.portal.menu.profile"],
    content: { keys: [KEYS.PROFILE], mode: "any" },
    status: "live",
    note: "تغییر شمارهٔ موبایل مسیر جدا با کد پیامکی دارد",
  },
  {
    id: "documents",
    title: "مدارک من",
    route: "#/profile/documents",
    menuKeys: ["customer.portal.menu.profile.documents"],
    content: { keys: [KEYS.DOCUMENTS], mode: "any" },
    status: "live",
    note: "تنها بخش آپلود فایل؛ فایل در private/portal_documents",
  },
  {
    // ✅ موج ۱۳.۲۱ — «ارسال تیکت» جای منوی «درخواست‌های من» را گرفت.
    id: "tickets",
    title: "ارسال تیکت",
    route: "#/tickets",
    menuKeys: ["customer.portal.menu.tickets"],
    content: { keys: [KEYS.TICKETS], mode: "any" },
    status: "live",
    note: "گفتگو با پشتیبانی؛ همان مدل Suggestion/SuggestionMessage",
  },
  {
    id: "halls",
    title: "سالن‌های من",
    route: "#/farm/halls",
    menuKeys: ["customer.portal.menu.farm.halls"],
    content: { keys: [KEYS.HALLS], mode: "any" },
    status: "live",
    note: "",
  },
  {
    id: "flocks",
    title: "گله‌های من",
    route: "#/hatchery/flocks",
    menuKeys: ["customer.portal.menu.hatchery.flocks"],
    content: { keys: [KEYS.FLOCKS], mode: "any" },
    status: "live",
    note: "",
  },
  {
    id: "weeks",
    title: "مدیریت هفتگی",
    route: "#/weekly/list",
    menuKeys: ["customer.portal.menu.weekly.list"],
    content: { keys: [KEYS.WEEKS], mode: "any" },
    status: "live",
    note: "جزئیات هفته و پیش‌پرکردن فرم ویرایش",
  },
  {
    id: "visits",
    title: "بازدیدهای کارشناس",
    route: "#/reports/visits",
    menuKeys: ["customer.portal.menu.reports.visits"],
    content: { keys: [KEYS.VISITS], mode: "any" },
    status: "live",
    note: "متن گزارش + پیوست‌ها کلید جدا دارند (visit.report)",
  },
  {
    id: "units",
    title: "واحدها",
    route: "#/farm/units",
    menuKeys: ["customer.portal.menu.farm.units"],
    content: { keys: [KEYS.FARM], mode: "any" },
    status: "live",
    note: "خروجی /farm/options (واحد/سالن/جوجه‌ریزی)",
  },
  // ⚠️ موج ۱۳.۲۱ — پنل «hallDetail» حذف شد: چهار بخش سالن حالا
  //    آکاردئون تودرتو در همان پنل «halls» است (همان چهار کلید منو
  //    بدون تغییر، به‌عنوان گیت هر بخش).
  {
    id: "placements",
    title: "دوره‌های جوجه‌ریزی",
    route: "#/hatchery/placements",
    menuKeys: ["customer.portal.menu.hatchery.placements"],
    content: { keys: [KEYS.FARM], mode: "any" },
    status: "live",
    note: "خروجی /farm/placements/:id",
  },
  {
    id: "completion",
    title: "پایان دوره",
    route: "#/hatchery/completion",
    menuKeys: ["customer.portal.menu.hatchery.completion"],
    content: { keys: [KEYS.COMPLETION], mode: "any" },
    status: "live",
    note: "فقط خواندن؛ منبع: flock_completions",
  },
  {
    id: "finalReport",
    title: "گزارش نهایی دوره",
    route: "#/reports/final",
    menuKeys: ["customer.portal.menu.reports.final"],
    // 🔒 دو کلید: فهرست (انتخاب‌گر دوره) + گزارش تفصیلی
    content: { keys: [KEYS.COMPLETION, KEYS.COMPLETION_REPORT], mode: "all" },
    status: "live",
    note: "بدون فهرست، گزارش هرگز نمایش داده نمی‌شود",
  },
  {
    id: "soon",
    title: "به‌زودی",
    route: "#/hatchery/hygiene",
    menuKeys: ["customer.portal.menu.hatchery.hygiene"],
    content: { keys: [], mode: "any" },
    status: "soon",
    note: "تاریخچهٔ ضدعفونی در DB نیست ⇒ دادهٔ ساختگی نشان نمی‌دهیم",
  },
];

// ============================================================
// ۲.۱) شیت‌ها (فرم شناور بدون مسیر و بدون آیتم منو) — موج ۱۳.۲۱
// ------------------------------------------------------------
//  «درخواست‌های من» از درخت منو حذف شد؛ فرم‌های ثبت/ویرایش/حذف واحد،
//  سالن، دوره و هفته از داخل همان پنلی باز می‌شوند که داده در آن است
//  (`data-portal-sheet="requests"`). بنابراین:
//   • هیچ مسیر/آیتم منویی به این شناسه اشاره نمی‌کند (menuKeys خالی)،
//   • کلید محتوا و کلیدهای نوشتن **بدون تغییر** همان KEYS.FARM،
//     KEYS.FARM_REQUEST و KEYS.FARM_CANCEL هستند،
//   • اندپوینت‌هایش همان چهار مسیر /farm/* است (panel: "farm").
// ============================================================
const PORTAL_SHEETS = [
  {
    id: "farm",
    title: "ثبت درخواست",
    route: "",
    menuKeys: [],
    content: { keys: [KEYS.FARM], mode: "any" },
    status: "live",
    note: "شیت contextual: نوع/هدف از دکمهٔ همان ردیف می‌آید، نه از URL",
  },
];

// ============================================================
// ۳) اندپوینت‌ها (۲۹ = ۲۲ خواندن + ۷ نوشتن)
// ------------------------------------------------------------
//  keys      → کلیدهای افزون بر PORTAL_BASE_KEY (به همین ترتیب)
//  scope     → none | own | controller | row
//              controller: کنترلر خودش با customer_id در همان کوئری
//              row: مالکیت با requireOwnedRow (ownership پر است)
//  ownership → یک ردیف برای هر requireOwnedRow در زنجیره
//  write     → نوشتن است ⇒ portalWriteLimiter اجباری
//  otp       → otpLimiter هم می‌آید (هر پیامک هزینه دارد)
//  upload    → سهمیه + multer هم می‌آید
//  panel     → پنلی که این پاسخ را مصرف می‌کند (null = خلاصهٔ پرونده)
// ============================================================
const PORTAL_ENDPOINTS = [
  {
    id: "PORTAL_ME",
    method: "get",
    path: "/me",
    panel: null,
    keys: [],
    scope: "none",
    ownership: [],
    write: false,
    otp: false,
    upload: false,
    handler: { module: "portalController", method: "getPortalSummary" },
    note: "خلاصهٔ پرونده؛ هر بخش در کنترلر با کلید خودش فیلتر می‌شود",
  },
  {
    id: "PORTAL_HALLS",
    method: "get",
    path: "/halls",
    panel: "halls",
    keys: [KEYS.HALLS],
    scope: "none",
    ownership: [],
    write: false,
    otp: false,
    upload: false,
    handler: { module: "portalController", method: "getMyHalls" },
    note: "",
  },
  {
    id: "PORTAL_FLOCKS",
    method: "get",
    path: "/flocks",
    panel: "flocks",
    keys: [KEYS.FLOCKS],
    scope: "none",
    ownership: [],
    write: false,
    otp: false,
    upload: false,
    handler: { module: "portalController", method: "getMyFlocks" },
    note: "",
  },
  {
    id: "PORTAL_WEEKS",
    method: "get",
    path: "/weeks",
    panel: "weeks",
    keys: [KEYS.WEEKS],
    scope: "none",
    ownership: [],
    write: false,
    otp: false,
    upload: false,
    handler: { module: "portalController", method: "getMyWeeks" },
    note: "",
  },
  {
    id: "PORTAL_VISITS",
    method: "get",
    path: "/visits",
    panel: "visits",
    keys: [KEYS.VISITS],
    scope: "none",
    ownership: [],
    write: false,
    otp: false,
    upload: false,
    handler: { module: "portalController", method: "getMyVisits" },
    note: "",
  },
  {
    id: "PORTAL_WEEK_DETAIL",
    method: "get",
    path: "/weeks/:id",
    panel: "weeks",
    keys: [KEYS.WEEKS],
    // ⚠️ ۱۳.۴: این مسیر میان‌افزار مالکیت ندارد؛ خودِ کنترلر با
    //    customer_id در همان findOne می‌سنجد (گارد سورس را می‌خواند).
    scope: "controller",
    ownership: [],
    write: false,
    otp: false,
    upload: false,
    handler: { module: "portalController", method: "getMyWeekDetail" },
    note: "اسکوپ در کنترلر (customer_id)",
  },
  {
    id: "PORTAL_VISIT_DETAIL",
    method: "get",
    path: "/visits/:id",
    panel: "visits",
    keys: [KEYS.VISITS, KEYS.VISIT_REPORT],
    scope: "controller",
    ownership: [],
    write: false,
    otp: false,
    upload: false,
    handler: { module: "portalController", method: "getMyVisitDetail" },
    note: "اسکوپ در کنترلر (customer_id) + کلید محتوای گزارش",
  },
  {
    id: "PORTAL_VISIT_ATTACHMENT",
    method: "get",
    path: "/visits/:id/attachments/:attachmentId",
    panel: "visits",
    keys: [KEYS.VISITS, KEYS.VISIT_REPORT],
    scope: "controller",
    ownership: [],
    write: false,
    otp: false,
    upload: false,
    handler: { module: "portalController", method: "downloadMyAttachment" },
    note: "اسکوپ در کنترلر (customer_id + visit_id)",
  },
  {
    id: "PORTAL_PROFILE",
    method: "get",
    path: "/profile",
    panel: "profile",
    keys: [KEYS.PROFILE],
    scope: "own",
    ownership: [],
    write: false,
    otp: false,
    upload: false,
    handler: { module: "portalController", method: "getMyProfile" },
    note: "",
  },
  {
    id: "PORTAL_PROFILE_UPDATE",
    method: "patch",
    path: "/profile",
    panel: "profile",
    keys: [KEYS.PROFILE, KEYS.PROFILE_EDIT],
    scope: "own",
    ownership: [],
    write: true,
    otp: false,
    upload: false,
    handler: { module: "portalController", method: "updateMyProfile" },
    note: "mobile_number عمداً نادیده گرفته می‌شود (PROFILE_LOCKED)",
  },
  {
    id: "PORTAL_PROFILE_MOBILE_REQUEST",
    method: "post",
    path: "/profile/mobile/request",
    panel: "profile",
    keys: [KEYS.PROFILE, KEYS.PROFILE_EDIT],
    scope: "own",
    ownership: [],
    write: true,
    otp: true,
    upload: false,
    handler: {
      module: "portalProfileOtpController",
      method: "requestMobileChange",
    },
    note: "هر پیامک هزینه دارد ⇒ otpLimiter",
  },
  {
    id: "PORTAL_PROFILE_MOBILE_CONFIRM",
    method: "post",
    path: "/profile/mobile/confirm",
    panel: "profile",
    keys: [KEYS.PROFILE, KEYS.PROFILE_EDIT],
    scope: "own",
    ownership: [],
    write: true,
    otp: true,
    upload: false,
    handler: {
      module: "portalProfileOtpController",
      method: "confirmMobileChange",
    },
    note: "هر حدس، یک verify است ⇒ otpLimiter",
  },
  {
    id: "DASHBOARD_OPTIONS",
    method: "get",
    path: "/dashboard/options",
    panel: "dashboard",
    keys: [KEYS.DASHBOARD],
    scope: "none",
    ownership: [],
    write: false,
    otp: false,
    upload: false,
    handler: {
      module: "portalDashboardController",
      method: "getMyDashboardOptions",
    },
    note: "گله‌ها/سالن‌های خودم + کدام نمودار مجاز است",
  },
  {
    id: "DASHBOARD_SUMMARY",
    method: "get",
    path: "/dashboard/summary",
    panel: "dashboard",
    keys: [KEYS.DASHBOARD, KEYS.DASHBOARD_ANALYSIS],
    scope: "none",
    ownership: [],
    write: false,
    otp: false,
    upload: false,
    handler: {
      module: "portalDashboardController",
      method: "getMyDashboardSummary",
    },
    note: "شمارنده‌های خودم (بدون آمار سایر مشتریان)",
  },
  {
    id: "DASHBOARD_CHARTS",
    method: "get",
    path: "/dashboard/charts",
    panel: "dashboard",
    keys: [KEYS.DASHBOARD],
    scope: "row",
    // ⚠️ نام‌گذاری گیج‌کنندهٔ ماژول کارشناسان:
    //    flockGroupId = Flock.id (دورهٔ گله) ولی flockId = ChickPlacement.id
    ownership: [
      {
        model: "Flock",
        source: "query",
        key: "flockGroupId",
        store: "ownedFlock",
        label: "گلهٔ داشبورد",
      },
      {
        model: "ChickPlacement",
        source: "query",
        key: "flockId",
        store: "ownedFlockById",
        label: "جوجه‌ریزی نمودار",
      },
    ],
    write: false,
    otp: false,
    upload: false,
    handler: { module: "portalDashboardController", method: "getMyCharts" },
    note: "شناسه از کوئری ⇒ مالکیت پیش از کنترلر سنجیده می‌شود",
  },
  {
    id: "DASHBOARD_ANALYSIS",
    method: "get",
    path: "/dashboard/analysis",
    panel: "dashboard",
    keys: [KEYS.DASHBOARD, KEYS.DASHBOARD_ANALYSIS],
    scope: "none",
    ownership: [],
    write: false,
    otp: false,
    upload: false,
    handler: {
      module: "portalDashboardController",
      method: "getMyAnalysis",
    },
    note: "تحلیل فقط روی گله‌های خودم",
  },
  {
    id: "PORTAL_DOCUMENTS",
    method: "get",
    path: "/documents",
    panel: "documents",
    keys: [KEYS.DOCUMENTS],
    scope: "none",
    ownership: [],
    write: false,
    otp: false,
    upload: false,
    handler: {
      module: "portalDocumentsController",
      method: "listMyDocuments",
    },
    note: "",
  },
  {
    id: "PORTAL_DOCUMENT_UPLOAD",
    method: "post",
    path: "/documents",
    panel: "documents",
    keys: [KEYS.DOCUMENTS, KEYS.DOCUMENTS_UPLOAD],
    scope: "none",
    ownership: [],
    write: true,
    otp: false,
    // 🔒 سهمیه **پیش از** multer سنجیده می‌شود (هیچ فایل یتیمی نمی‌ماند)
    upload: true,
    handler: {
      module: "portalDocumentsController",
      method: "uploadMyDocument",
    },
    note: "limiter → quota → multer",
  },
  {
    id: "PORTAL_DOCUMENT_FILE",
    method: "get",
    path: "/documents/:id/file",
    panel: "documents",
    keys: [KEYS.DOCUMENTS],
    scope: "row",
    ownership: [
      { model: "PortalDocument", source: "params", key: "id", store: "ownedRow", label: "مدرک" },
    ],
    write: false,
    otp: false,
    upload: false,
    handler: {
      module: "portalDocumentsController",
      method: "downloadMyDocument",
    },
    note: "فقط خواندن ⇒ بدون سقف نوشتن",
  },
  {
    id: "PORTAL_DOCUMENT_DELETE",
    method: "delete",
    path: "/documents/:id",
    panel: "documents",
    keys: [KEYS.DOCUMENTS, KEYS.DOCUMENTS_DELETE],
    scope: "row",
    ownership: [
      { model: "PortalDocument", source: "params", key: "id", store: "ownedRow", label: "مدرک" },
    ],
    write: true,
    otp: false,
    upload: false,
    handler: {
      module: "portalDocumentsController",
      method: "deleteMyDocument",
    },
    note: "حذف نرم (paranoid) ⇒ فایل برای بازبینی می‌ماند",
  },
  {
    id: "FARM_OPTIONS",
    method: "get",
    path: "/farm/options",
    panel: "farm",
    keys: [KEYS.FARM],
    scope: "none",
    ownership: [],
    write: false,
    otp: false,
    upload: false,
    handler: { module: "portalFarmController", method: "getFarmOptions" },
    note: "واحد/سالن/جوجه‌ریزی خودم برای فرم درخواست",
  },
  {
    id: "FARM_HALL_DETAIL",
    method: "get",
    path: "/farm/halls/:id",
    // ✅ ۱۳.۲۱ — پنل «hallDetail» حذف شد؛ این پاسخ را آکاردئون همان
    //    پنل «سالن‌ها» مصرف می‌کند (تنبل، فقط سالنِ باز‌شده).
    panel: "halls",
    keys: [KEYS.FARM],
    scope: "row",
    ownership: [
      { model: "Hall", source: "params", key: "id", store: "ownedRow", label: "سالن" },
    ],
    write: false,
    otp: false,
    upload: false,
    handler: { module: "portalFarmController", method: "getMyHall" },
    note: "پیش‌پرکردن فرم ویرایش سالن + چهار بخش آکاردئون",
  },
  {
    id: "FARM_PLACEMENT_DETAIL",
    method: "get",
    path: "/farm/placements/:id",
    panel: "placements",
    keys: [KEYS.FARM],
    scope: "row",
    ownership: [
      {
        model: "ChickPlacement",
        source: "params",
        key: "id",
        store: "ownedRow",
        label: "دوره",
      },
    ],
    write: false,
    otp: false,
    upload: false,
    handler: { module: "portalFarmController", method: "getMyPlacement" },
    note: "",
  },
  {
    id: "FARM_WEEKLY_DETAIL",
    method: "get",
    path: "/farm/weeklies/:id",
    panel: "weeks",
    keys: [KEYS.FARM],
    scope: "row",
    ownership: [
      {
        model: "WeeklyManagement",
        source: "params",
        key: "id",
        store: "ownedRow",
        label: "هفته",
      },
    ],
    write: false,
    otp: false,
    upload: false,
    handler: { module: "portalFarmController", method: "getMyWeekly" },
    note: "پیش‌پرکردن فرم ویرایش هفته",
  },
  {
    id: "FARM_REQUESTS",
    method: "get",
    path: "/farm/requests",
    panel: "farm",
    keys: [KEYS.FARM],
    scope: "none",
    ownership: [],
    write: false,
    otp: false,
    upload: false,
    handler: { module: "portalFarmController", method: "listMyRequests" },
    note: "",
  },
  {
    id: "FARM_REQUEST_CREATE",
    method: "post",
    path: "/farm/requests",
    panel: "farm",
    keys: [KEYS.FARM, KEYS.FARM_REQUEST],
    scope: "none",
    ownership: [],
    write: true,
    otp: false,
    upload: false,
    handler: { module: "portalFarmController", method: "createMyRequest" },
    note: "payload فقط با فهرست سفید (services/portalRequestRules)",
  },
  {
    id: "FARM_REQUEST_CANCEL",
    method: "post",
    path: "/farm/requests/:id/cancel",
    panel: "farm",
    keys: [KEYS.FARM, KEYS.FARM_CANCEL],
    scope: "row",
    ownership: [
      {
        model: "PortalRequest",
        source: "params",
        key: "id",
        store: "ownedRow",
        label: "درخواست",
      },
    ],
    write: true,
    otp: false,
    upload: false,
    handler: { module: "portalFarmController", method: "cancelMyRequest" },
    note: "لغو فقط روی ردیف خودم (۴۰۴ برای ردیف غیرخودی)",
  },
  {
    id: "PORTAL_COMPLETIONS",
    method: "get",
    path: "/completions",
    panel: "completion",
    keys: [KEYS.COMPLETION],
    scope: "none",
    ownership: [],
    write: false,
    otp: false,
    upload: false,
    handler: {
      module: "portalCompletionController",
      method: "listMyCompletions",
    },
    note: "فهرست دوره‌های بسته‌شده + شاخص‌های نهایی",
  },
  {
    id: "PORTAL_COMPLETION_DETAIL",
    method: "get",
    path: "/completions/:id",
    panel: "finalReport",
    keys: [KEYS.COMPLETION, KEYS.COMPLETION_REPORT],
    scope: "row",
    ownership: [
      {
        model: "FlockCompletion",
        source: "params",
        key: "id",
        store: "ownedRow",
        label: "پایان دوره",
      },
    ],
    write: false,
    otp: false,
    upload: false,
    handler: {
      module: "portalCompletionController",
      method: "getMyCompletion",
    },
    note: "گزارش تفصیلی: ریز سالن‌ها + روند هفتگی + جمع دارو/واکسن",
  },
];

// ============================================================
// ۴) «قابلیت‌های درون‌تبی» (features در پاسخ /me)
// ------------------------------------------------------------
//  هر قابلیت = پنل باز + یک کلید افزون. دکمه‌ای که کلیدش بسته است
//  نباید دیده شود (همان قاعدهٔ دو لایه در ۱۳.۵).
// ============================================================
const PORTAL_FEATURES = [
  { key: "can_edit_profile", panel: "profile", extra: KEYS.PROFILE_EDIT },
  { key: "dashboard_analysis", panel: "dashboard", extra: KEYS.DASHBOARD_ANALYSIS },
  { key: "dashboard_compare", panel: "dashboard", extra: KEYS.DASHBOARD_COMPARE },
  { key: "dashboard_export", panel: "dashboard", extra: KEYS.DASHBOARD_EXPORT },
  { key: "farm_request", panel: "farm", extra: KEYS.FARM_REQUEST },
  { key: "farm_cancel", panel: "farm", extra: KEYS.FARM_CANCEL },
  // ✅ ۱۳.۱۸: گیت دکمه‌های «مدارک من» هم از سرور می‌آید (پیش از این فقط
  //    در مرورگر با همان کلید سنجیده می‌شد؛ حالا یک منبع دارد)
  { key: "documents_upload", panel: "documents", extra: KEYS.DOCUMENTS_UPLOAD },
  { key: "documents_delete", panel: "documents", extra: KEYS.DOCUMENTS_DELETE },
  { key: "completion_report", panel: "completion", extra: KEYS.COMPLETION_REPORT },
  // ✅ ۱۳.۲۱ — دکمه/فرم «ارسال تیکت». ۱۳.۲۲: سرور هم همین کلید را
  //    می‌خواند (requireRolePermission روی شش روت گفتگوی مشتری) ⇒ پرچم
  //    `features.tickets` دقیقاً همان چیزی است که سرور اجازه می‌دهد.
  { key: "tickets", panel: "tickets", extra: KEYS.TICKETS },
];

// پنل‌هایی که در sections پاسخ /me می‌آیند (به همین ترتیب)
const PORTAL_SECTION_PANELS = [
  "halls",
  "flocks",
  "weeks",
  "visits",
  "profile",
  "dashboard",
  "farm",
  "completion",
  "finalReport",
];

// ============================================================
// ۴.۱) نمودارهای داشبورد (پاسخ /dashboard/options.charts)
// ------------------------------------------------------------
//  نام محلی هر نمودار + کلید مجوزش. این فهرست تنها جای تعریف است؛
//  کنترلر پرچم charts.<key> را از همین می‌سازد و گارد می‌سنجد که
//  رندرکنندهٔ فرانت هیچ پرچم ناشناسی نخواند.
// ============================================================
const PORTAL_CHARTS = Object.freeze([
  { key: "weight", permission: KEYS.CHART_WEIGHT },
  { key: "gain", permission: KEYS.CHART_GAIN },
  { key: "mortality", permission: KEYS.CHART_MORTALITY },
  { key: "feed", permission: KEYS.CHART_FEED },
  { key: "fcr", permission: KEYS.CHART_FCR },
  { key: "standards", permission: KEYS.CHART_STANDARDS },
]);

// ============================================================
// ۵) فیلدهای «هرگز» — اقتصاد گله، یادداشت داخلی، کاربر کارشناس
// ------------------------------------------------------------
//  ⚠️ این فهرست «سلیقه» نیست؛ قرارداد است: هیچ‌کدام نباید در
//     فهرست سفید خروجی پورتال دیده شوند. گارد و خودِ
//     services/portalCompletionView (هنگام بارگذاری) آن را می‌سنجند.
// ============================================================
const FORBIDDEN_FIELDS = Object.freeze([
  // اقتصاد گله — تصمیم مالی با کارشناس است، نه با شمارنده‌های پورتال
  "price_per_kg",
  "income_total",
  "chick_cost",
  "feed_cost",
  "medication_cost",
  "fuel_cost",
  "labor_cost",
  "other_cost",
  "total_cost",
  "net_profit",
  "profit_percent",
  // یادداشت داخلی و هویت کارشناس
  "notes",
  "completed_by",
  // شناسهٔ مشتری (اسکوپ با توکن سنجیده شده؛ نیازی به بازگشتش نیست)
  "customer_id",
]);

// ============================================================
// ۶) مدل‌هایی که فهرست سفیدشان باید با ستون‌های DB هم‌خوان بماند
// ------------------------------------------------------------
//  🔎 اگر ستون تازه‌ای به یکی از این جدول‌ها اضافه شود، شمارندهٔ
//     گارد می‌شکند ⇒ توسعه‌دهنده مجبور می‌شود دربارهٔ نمایش/عدم
//     نمایش آن در پورتال تصمیم بگیرد (به‌جای لو رفتن خودکار).
// ============================================================
const WHITELIST_MODELS = Object.freeze([
  { name: "FlockCompletion", columns: 66, whitelist: "DB_ATTRIBUTES" },
  { name: "FlockCompletionHall", columns: 24, whitelist: "HALL_DB_ATTRIBUTES" },
  { name: "WeeklyManagement", columns: 20, whitelist: "WEEK_ATTRIBUTES" },
]);

// ============================================================
// ۷) ایندکس‌ها و کمکی‌های خالص (بدون DB — قابل اجرا در گارد)
// ============================================================
const indexBy = (rows) =>
  rows.reduce((map, row) => {
    map[row.id] = row;
    return map;
  }, {});

const PANELS_BY_ID = indexBy([...PORTAL_PANELS, ...PORTAL_SHEETS]);
const ENDPOINTS_BY_ID = indexBy(PORTAL_ENDPOINTS);

const panelById = (id) => PANELS_BY_ID[id] || null;

const endpointById = (id) => {
  const found = ENDPOINTS_BY_ID[id];
  if (!found) throw new Error(`پورتال: اندپوینت ناشناخته «${id}»`);
  return found;
};

// همهٔ کلیدهای یک اندپوینت، به ترتیب زنجیره (پایه اول)
const endpointKeys = (id) => [PORTAL_BASE_KEY, ...endpointById(id).keys];

// اندپوینت‌های یک پنل (به ترتیب تعریف)
const endpointsOfPanel = (panelId) =>
  PORTAL_ENDPOINTS.filter((row) => row.panel === panelId);

// آیا پنل با این «مجموعهٔ کلیدهای باز» نمایش داده می‌شود؟ (همان
// منطقی که کنترلر و فرانت اجرا می‌کنند؛ گارد همین را می‌سنجد)
const panelOpen = (panelId, has) => {
  const panel = panelById(panelId);
  if (!panel) return false;
  const flags = panel.content.keys.map((key) => has(key) === true);
  if (panel.content.mode === "all") return flags.every(Boolean);
  // پنل بدون کلید محتوا (soon) فقط با کلید منو باز است — تصمیم UI
  if (flags.length === 0) return true;
  return flags.some(Boolean);
};

// زنجیرهٔ «مشترک» همهٔ مسیرها — کنترلر/گارد برای مستندسازی
const PORTAL_TOTALS = Object.freeze({
  panels: PORTAL_PANELS.length,
  sheets: PORTAL_SHEETS.length,
  panelsLive: PORTAL_PANELS.filter((panel) => panel.status === "live").length,
  panelsSoon: PORTAL_PANELS.filter((panel) => panel.status === "soon").length,
  endpoints: PORTAL_ENDPOINTS.length,
  reads: PORTAL_ENDPOINTS.filter((row) => !row.write).length,
  writes: PORTAL_ENDPOINTS.filter((row) => row.write).length,
  ownedRows: PORTAL_ENDPOINTS.reduce((sum, row) => sum + row.ownership.length, 0),
});

module.exports = {
  KEYS,
  PORTAL_BASE_KEY,
  PORTAL_ROLE,
  PORTAL_PANELS,
  PORTAL_SHEETS,
  PORTAL_ENDPOINTS,
  PORTAL_FEATURES,
  PORTAL_SECTION_PANELS,
  PORTAL_CHARTS,
  FORBIDDEN_FIELDS,
  WHITELIST_MODELS,
  PORTAL_TOTALS,
  PANELS_BY_ID,
  ENDPOINTS_BY_ID,
  panelById,
  endpointById,
  endpointKeys,
  endpointsOfPanel,
  panelOpen,
};
