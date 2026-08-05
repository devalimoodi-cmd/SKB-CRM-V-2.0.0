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
  CACHE_TTL: 300000,
  DEFAULT_PAGE_SIZE: 10,
};

// قرار دادن در window برای دسترسی سراسری
if (typeof window !== "undefined") {
  window.API_CONSTANTS = API_CONSTANTS;
}
