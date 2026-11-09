export const API_CONSTANTS = {
  BASE_URL: window.CONFIG?.API_BASE_URL || "http://localhost:5000/api",
  ENDPOINTS: {
    AUTH: {
      LOGIN: "/users/login",
      // ✅ فاز ۱۳.۱ — مرحلهٔ ۲ ورود (کد پیامکی)
      LOGIN_VERIFY: "/users/login/verify",
      LOGIN_RESEND: "/users/login/resend",
      LOGIN_CANCEL: "/users/login/cancel",
      LOGOUT: "/users/logout",
      CAPTCHA: "/captcha",
      SETUP_ADMIN: "/users/setup-admin",
      CHECK_ADMIN: "/users/check-admin",
      CHANGE_PASSWORD: "/users/:id/change-password",
    },
    USERS: {
      REGISTER: "/users/register",
      LIST: "/users",
      BY_ROLE: "/users/by-role/:role",
      UPDATE: "/users/:id",
      DELETE: "/users/:id",
      RESET_TOKEN: "/users/:id/reset-token",
      ONLINE_STATUS: "/users/:id/online-status",
      // ✅ تنظیمات شخصی کاربر (preferences) — ذخیره‌سازی سمت سرور
      PREFERENCES: "/users/:id/preferences",
    },
    CUSTOMERS: {
      REGISTER: "/customers/register",
      LIST: "/customers",
      DETAIL: "/customers/:id",
      UPDATE: "/customers/:id",
      DELETE: "/customers/:id",
      TOGGLE: "/customers/:id/:action",
      HEADER: "/customer-header/:id/header",
    },
    UNITS: {
      LIST: "/units",
      CREATE: "/units",
      UPDATE: "/units/:id",
      DELETE: "/units/:id",
      EXPERTS: "/units/:unitId/experts",
      STATUSES: "/units/statuses",
    },
    HALLS: {
      LIST: "/halls",
      CREATE: "/halls",
      UPDATE: "/halls/:id",
      DELETE: "/halls/:id",
    },
    HALL_PHYSICAL: {
      GET: "/hall-physical-info/:hallId",
      CREATE: "/hall-physical-info",
      UPDATE: "/hall-physical-info/:id",
    },
    HALL_SYSTEMS: {
      GET: "/hall-systems/:hallId",
      CREATE: "/hall-systems",
    },
    HALL_WATER_FEED: {
      GET: "/hall-water-feed/:hallId",
      CREATE: "/hall-water-feed",
    },
    HALL_HYGIENE: {
      GET: "/hall-hygiene/:hallId",
      CREATE: "/hall-hygiene",
      DELETE: "/hall-hygiene/:id",
    },
    CHICK_PLACEMENTS: {
      LIST: "/chick-placements",
      CREATE: "/chick-placements",
      UPDATE: "/chick-placements/:id",
      DELETE: "/chick-placements/:id",
      TOGGLE: "/chick-placements/:id/toggle-status",
    },
    WEEKLY: {
      LIST: "/weekly",
      CREATE: "/weekly",
      UPDATE: "/weekly/:id",
      DELETE: "/weekly/:id",
    },
    DICTIONARY: {
      BASE: "/dictionary",
      // ✅ انواع مشتری (گوشتی / تخم‌گذار / مرغ مادر / سایر) — جدول دیکشنری
      CUSTOMER_TYPES: "/dictionary/customer-types",
    },
    BOOKMARKS: {
      LIST: "/bookmarks",
      CREATE: "/bookmarks",
      UPDATE: "/bookmarks/:id",
      DELETE: "/bookmarks/:id",
      STATUS: "/bookmarks/:id/status",
      STATS: "/bookmarks/stats",
    },
    SMS: {
      SEND: "/sms/send-to-customer",
      BULK: "/sms/send-bulk-to-customers",
      CREDIT: "/sms/credit",
      LOG: "/sms/log",
      STATUS: "/sms/status/:id",
      CHECK_STATUS: "/sms/check-status/:id",
    },
    VISIT_REPORTS: {
      LIST: "/visit-reports/customer/:customerId",
      CREATE: "/visit-reports",
      UPDATE: "/visit-reports/:id",
      DELETE: "/visit-reports/:id",
      STATUS: "/visit-reports/:id/status",
      DOWNLOAD: "/visit-reports/download/:id",
    },
    DASHBOARD: {
      FLOCKS: "/dashboard/flocks",
      FLOCK_CARDS: "/dashboard/flock-cards",
      SUMMARY: "/dashboard/summary",
      CUSTOMER_DETAILS: "/dashboard/customer/:id/details",
      CUSTOMER_PERFORMANCE: "/dashboard/customer/:id/performance",
      CHARTS: "/dashboard/charts",
      ANALYSIS: "/dashboard/analysis",
    },
    WEATHER: {
      GET: "/weather/customer/:customerId",
    },
    // ===== نظرات و پیشنهادات (گفتگوی کاربر ↔ ادمین) =====
    SUGGESTIONS: {
      CREATE: "/suggestions",
      MINE: "/suggestions/mine",
      UNREAD: "/suggestions/unread-count",
      THREAD: "/suggestions/:id",
      REPLY: "/suggestions/:id/reply",
      READ: "/suggestions/:id/read",
      ADMIN_LIST: "/suggestions",
      ADMIN_THREAD: "/suggestions/:id/admin",
      ADMIN_REPLY: "/suggestions/:id/admin-reply",
      UPDATE: "/suggestions/:id",
      DELETE: "/suggestions/:id",
      // ✅ حذف یک پیام داخل گفتگو (فقط ادمین)
      DELETE_MESSAGE: "/suggestions/:id/messages/:messageId",
    },
    // ===== تغییرات جدید / What's New =====
    RELEASES: {
      // کاربر
      UNSEEN: "/releases/unseen",
      HISTORY: "/releases/history",
      MARK_SEEN: "/releases/:id/seen",
      // مدیریت (خواندن: همهٔ ادمین‌ها)
      ADMIN_LIST: "/releases",
      DETAIL: "/releases/:id",
      STATS: "/releases/:id/stats",
      // مدیریت (نوشتن: فقط سوپر ادمین)
      CREATE: "/releases",
      UPDATE: "/releases/:id",
      PUBLISH: "/releases/:id/publish",
      ARCHIVE: "/releases/:id/archive",
      DELETE: "/releases/:id",
    },
    CITIES: {
      PROVINCES: "/cities/provinces",
      EDUCATION_LEVELS: "/cities/education-levels",
      DEPARTMENTS: "/cities/departments",
      CITIES_BY_PROVINCE: "/cities/cities-by-province/:state",
    },
    // ===== سطوح دسترسی (نقش‌ها و کاربران) =====
    PERMISSIONS: {
      // مجوزهای کاربر جاری (گیت فرانت‌اند)
      ME: "/permissions/me",
      // نسخهٔ مجوزها (بررسی سبک تازه‌بودن کش)
      VERSION: "/permissions/version",
      // کاتالوگ + ماتریس نقش‌ها
      CATALOG: "/permissions/catalog",
      ROLES: "/permissions/roles",
      ROLE_UPDATE: "/permissions/roles/:role",
      ROLE_RESET: "/permissions/roles/:role/reset",
      // سطح دسترسی یک کاربر
      USER: "/permissions/users/:id",
      USER_UPDATE: "/permissions/users/:id",
      USER_RESET: "/permissions/users/:id",
      // گزارش تغییرات
      AUDIT: "/permissions/audit",
    },
    // ===== حضور کاربران (Presence) — «چه کسی آنلاین است» =====
    PRESENCE: {
      // تازه‌کردن حضور خودم (هر چند ثانیه — PRESENCE_HEARTBEAT_SECONDS)
      HEARTBEAT: "/presence/heartbeat",
      // خروج صریح (بستن تب/خروج) — با fetch keepalive فرستاده می‌شود
      OFFLINE: "/presence/offline",
      // فهرست آنلاین‌ها (فقط نقش‌های مدیریتی)
      SUMMARY: "/presence/summary",
    },
    // ===== نشست‌های کاربران (Sessions) — «کجا وارد شده‌ام؟» (فاز ۱۲.۱) =====
    SESSIONS: {
      // نشست‌های خودم (هر کاربر لاگین‌شده) — این دستگاه با current علامت می‌خورد
      MINE: "/sessions/mine",
      // مدیریت: فهرست نشست‌ها (کلید users.onlineStatus.view)
      LIST: "/sessions",
      SUMMARY: "/sessions/summary",
      // مدیریت: بستن یک نشست (کلید users.sessions.revoke)
      REVOKE: "/sessions/:id/revoke",
      // مدیریت: بستن همهٔ نشست‌های یک کاربر
      REVOKE_ALL: "/sessions/users/:userId/revoke-all",
    },
    // ===== ردّ فعالیت (Activity Log) — «چه کسی چه چیزی را تغییر داد» (فاز ۱۲.۲) =====
    ACTIVITY: {
      // فهرست ردّ فعالیت (کلید users.activity.view)
      LIST: "/activity",
      // خلاصهٔ آماری سرِ پنل
      SUMMARY: "/activity/summary",
      // جزئیات یک رویداد
      DETAIL: "/activity/:id",
    },
    // ===== پورتال مشتری (فاز ۱۳.۲، ۱۳.۳ و ۱۳.۴) — دادهٔ پروندهٔ خودِ مشتری =====
    //  🔒 هیچ اندپوینتی شناسهٔ «مشتری» نمی‌گیرد: سرور آن را از توکن
    //     می‌سازد (req.customerScopeId)؛ هیچ ?id= ای فرستاده نمی‌شود.
    //     تنها پارامتر مجاز: page/limit (صفحه‌بندی فهرست‌ها).
    //     ⚠️ از ۱۳.۴ شناسهٔ «ردیف خودم» در مسیر می‌آید (WEEK_DETAIL/
    //     VISIT_DETAIL/VISIT_ATTACHMENT) و فقط از پاسخ فهرست گرفته
    //     می‌شود، نه از ورودی کاربر.
    PORTAL: {
      ME: "/portal/me",
      HALLS: "/portal/halls",
      FLOCKS: "/portal/flocks",
      WEEKS: "/portal/weeks",
      VISITS: "/portal/visits",
      WEEK_DETAIL: (id) => `/portal/weeks/${id}`,
      VISIT_DETAIL: (id) => `/portal/visits/${id}`,
      VISIT_ATTACHMENT: (visitId, attachmentId) =>
        `/portal/visits/${visitId}/attachments/${attachmentId}`,
      // ===== ✅ موج ۱۳.۸ — «پروفایل من» و «داشبورد تحلیلی» =====
      //  🔒 این‌ها تنها مسیرهای نوشتنی پورتال در کل پروژه‌اند:
      //     PROFILE (PATCH) + دو مرحلهٔ تغییر شمارهٔ موبایل با کد پیامکی.
      //     تغییر موبایل مسیر جدا دارد چون شماره = هویت ورود.
      PROFILE: "/portal/profile",
      PROFILE_MOBILE_REQUEST: "/portal/profile/mobile/request",
      PROFILE_MOBILE_CONFIRM: "/portal/profile/mobile/confirm",
      //  ⚠️ شناسهٔ گله فقط از پاسخ همین سرور می‌آید (portal.api اعتبارسنجی
      //     می‌کند) و سرور مالکیتش را با customer_id می‌سنجد.
      DASHBOARD_OPTIONS: "/portal/dashboard/options",
      DASHBOARD_SUMMARY: "/portal/dashboard/summary",
      DASHBOARD_CHARTS: "/portal/dashboard/charts",
      DASHBOARD_ANALYSIS: "/portal/dashboard/analysis",
      // ===== ✅ موج ۱۳.۱۰ — «مدارک من» =====
      //  🔒 تنها بخش پورتال که «فایل» می‌فرستد. فایل با FormData به
      //     همین مسیر می‌رود و با هدر Authorization خوانده می‌شود؛
      //     هیچ لینک عمومی برای این مدارک وجود ندارد.
      DOCUMENTS: "/portal/documents",
      DOCUMENT_FILE: (id) => `/portal/documents/${id}/file`,
      DOCUMENT_DELETE: (id) => `/portal/documents/${id}`,
      // ===== ✅ موج ۱۳.۱۱ — «درخواست‌های فارم» (الگوی ب) =====
      //  🔒 مشتری این‌جا فقط «درخواست» می‌فرستد؛ هیچ مسیری برای
      //     نوشتن مستقیم در units/halls/chick_placements وجود ندارد.
      //     تأیید/رد در PORTAL_REQUESTS (پنل کارکنان) است.
      FARM_OPTIONS: "/portal/farm/options",
      FARM_REQUESTS: "/portal/farm/requests",
      FARM_REQUEST_CANCEL: (id) => `/portal/farm/requests/${id}/cancel`,
      // ✅ ۱۳.۱۳/۱۳.۱۴/۱۳.۱۵ — «جزئیات ردیف خودم» (پیش‌پرکردن فرم).
      //  🔒 فقط خواندن؛ شناسهٔ ردیف خودم و مالکیت در سرور سنجیده می‌شود.
      FARM_HALL_DETAILS: (id) => `/portal/farm/halls/${id}`,
      FARM_PLACEMENT_DETAILS: (id) => `/portal/farm/placements/${id}`,
      FARM_WEEKLY_DETAILS: (id) => `/portal/farm/weeklies/${id}`,
    },
    // ===== ✅ موج ۱۳.۱۱ — صف «درخواست‌های پورتال» (فقط کارکنان) =====
    //  ⚠️ این مسیرها `authorize("customer")` ندارند؛ با کلید مجوز
    //     portal.requests.view / .review محافظت می‌شوند.
    PORTAL_REQUESTS: {
      LIST: "/portal-requests",
      PENDING_COUNT: "/portal-requests/pending-count",
      // ✅ ۱۳.۱۶ — دیکشنری فقط-خواندنی برای نام‌دار کردن payload در صف
      //  🔒 پشت portal.requests.view؛ هیچ دادهٔ مشتری برنمی‌گرداند.
      DICTIONARIES: "/portal-requests/dictionaries",
      DETAIL: (id) => `/portal-requests/${id}`,
      APPROVE: (id) => `/portal-requests/${id}/approve`,
      REJECT: (id) => `/portal-requests/${id}/reject`,
    },
    // ===== ثبت‌نام عمومی مشتری + صف تأیید (فاز ۱۳.۶) =====
    //  ⚠️ CONFIG و CREATE عمومی‌اند (بدون ورود)؛ بقیه پنل مدیریت.
    REGISTRATIONS: {
      CONFIG: "/registrations/config",
      // ✅ موج ۱۳.۷.۲ — دیکشنری عمومی «نوع مشتری» برای فرم ثبت‌نام
      CUSTOMER_TYPES: "/registrations/customer-types",
      CREATE: "/registrations",
      LIST: "/registrations",
      PENDING_COUNT: "/registrations/pending-count",
      // ✅ موج ۱۳.۷.۳ — تنظیمات صف (سوییچ «تأیید خودکار»)
      SETTINGS: "/registrations/settings",
      APPROVE: (id) => `/registrations/${id}/approve`,
      REJECT: (id) => `/registrations/${id}/reject`,
    },
  },
  TIMEOUT: 30000,
  RETRY_COUNT: 3,
  CACHE_TTL: 300000,
  DEFAULT_PAGE_SIZE: 10,
};

// قرار دادن در window برای دسترسی سراسری
if (typeof window !== "undefined") {
  window.API_CONSTANTS = API_CONSTANTS;
}
