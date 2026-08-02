export const API_CONSTANTS = {
  BASE_URL: window.CONFIG?.API_BASE_URL || "http://localhost:5000/api",
  ENDPOINTS: {
    AUTH: {
      LOGIN: "/users/login",
      LOGOUT: "/users/logout",
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
    PERIODS: {
      LIST: "/periods",
      CREATE: "/periods",
      UPDATE: "/periods/:id",
      DELETE: "/periods/:id",
      NEXT_NUMBER: "/periods/next-number/:customerId",
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
      SUMMARY: "/dashboard/summary",
      CUSTOMER_DETAILS: "/dashboard/customer/:id/details",
      CHARTS: "/dashboard/charts",
    },
    WEATHER: {
      GET: "/weather/customer/:customerId",
    },
    CHAT: {
      MESSAGES: "/chat/messages",
    },
    CITIES: {
      PROVINCES: "/cities/provinces",
      EDUCATION_LEVELS: "/cities/education-levels",
      DEPARTMENTS: "/cities/departments",
      CITIES_BY_PROVINCE: "/cities/cities-by-province/:state",
    },
  },
  TIMEOUT: 30000,
  RETRY_COUNT: 3,
  CACHE_TTL: 300000, // 5 دقیقه
  DEFAULT_PAGE_SIZE: 10,
};

// core/constants/config.const.js
export const CONFIG = {
  APP_NAME: "SKB-CRM",
  VERSION: "2.0.0",
  ENV: localStorage.getItem("app_env") || "development",
  THEME: "light",
  TOKEN_KEY: "adminToken",
  USER_KEY: "user",
  LANGUAGE: "fa",
  DIRECTION: "rtl",
};

// core/constants/sms.const.js
export const SMS_TEMPLATES = {
  weekly_reminder: {
    id: 491456,
    name: "یادآوری هفتگی",
    description: "یادآوری ثبت اطلاعات هفتگی",
    template: `#FULLNAME# گرامی!
با توجه به اینکه گله شما در هفته #WEEKNUMBER# قرار دارد، لطفاً اطلاعات ذیل را آماده کنید تا همکاران ما طی ۴۸ ساعت آینده با شما تماس گرفته و اطلاعات مربوطه را اخذ نمایند:
- مصرف خوراک هفتگی
- میانگین وزن هفتگی
- تعداد تلفات گله
- مقدار ساعت خاموشی سالن
- برنامه واکسیناسیون گله

با تشکر
واحد خدمات مشتریان
کارخانه تولید خوراک طیور ستاره کیان بیرجند
SKB-CRM.IR`,
    variables: ["FULLNAME", "WEEKNUMBER", "FLOCKNUMBER"],
  },
  thanks_cooperation: {
    id: 378874,
    name: "تشکر از همکاری",
    description: "تشکر از ارائه اطلاعات هفتگی",
    template: `#FULLNAME# عزیز!
از همکاری شما در ارائه اطلاعات هفته #WEEKNUMBER# سپاسگزاریم.اطلاعات دریافتی از شما با موفقیت در سامانه ثبت شد.همکاران ما در هفته آینده مجدداً با شما تماس خواهند گرفت.

با تشکر
واحد خدمات مشتریان
کارخانه تولید خوراک طیور ستاره کیان بیرجند
SKB-CRM.IR`,
    variables: ["FULLNAME", "WEEKNUMBER"],
  },
  welcome: {
    id: 926311,
    name: "خوش آمد گویی",
    description: "ثبت نام اولیه مشتری",
    template: `#FULLNAME# عزیز!
مفتخریم از همکاری با شما؛ثبت‌نام اولیه شما در سامانه مدیریت ارتباط با مشتریان ستاره کیان بیرجند با موفقیت انجام شد.در ادامه، همکاران واحد خدمات مشتریان به‌صورت هفتگی با شما ارتباط گرفته و وضعیت گله شما را مورد پایش قرار خواهند داد.

با تشکر
واحد خدمات مشتریان
کارخانه تولید خوراک طیور ستاره کیان بیرجند
SKB-CRM.IR`,
    variables: ["FULLNAME"],
  },
};

export const SMS_STATUS = {
  PENDING: "pending",
  SENT: "sent",
  DELIVERED: "delivered",
  FAILED: "failed",
  CANCELLED: "cancelled",
};

export const SMS_STATUS_TEXT = {
  pending: "در انتظار",
  sent: "ارسال شده",
  delivered: "تحویل داده شده",
  failed: "ناموفق",
  cancelled: "لغو شده",
};
