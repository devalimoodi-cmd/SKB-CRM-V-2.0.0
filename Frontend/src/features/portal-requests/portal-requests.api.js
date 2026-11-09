// ============================================================
// features/portal-requests/portal-requests.api.js
// لایهٔ ارتباط «صف درخواست‌های پورتال» با سرور — موج ۱۳.۱۱
// ------------------------------------------------------------
// 🔒 این مسیرها فقط برای کارکنان است (protect + portal.requests.*)
//    و هیچ‌کدام شناسهٔ «مشتری» به‌عنوان ورودی نمی‌گیرند؛ فقط
//    شناسهٔ درخواست (که از پاسخ فهرست می‌آید و این‌جا اعتبارسنجی
//    می‌شود) در آدرس می‌نشیند.
// ============================================================
import { apiService } from "../../core/services/api.service.js";
import { API_CONSTANTS } from "../../core/constants/api.const.js";

const ROW_ID_PATTERN = /^\d{1,9}$/;

const rowId = (value) => {
  const raw = String(value === null || value === undefined ? "" : value).trim();
  const parsed = Number(raw);
  if (!ROW_ID_PATTERN.test(raw) || !Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("شناسهٔ درخواست نامعتبر است");
  }
  return parsed;
};

export const portalRequestsApi = {
  async list({ status = "", type = "", search = "", page = 1, limit = 20 } = {}) {
    const params = {
      page: Math.max(1, parseInt(page, 10) || 1),
      limit: Math.min(Math.max(1, parseInt(limit, 10) || 20), 50),
    };
    if (status) params.status = String(status);
    if (type) params.type = String(type);
    const term = String(search ?? "").trim();
    if (term) params.search = term.slice(0, 60);
    return apiService.get(API_CONSTANTS.ENDPOINTS.PORTAL_REQUESTS.LIST, params);
  },

  async pendingCount() {
    return apiService.get(
      API_CONSTANTS.ENDPOINTS.PORTAL_REQUESTS.PENDING_COUNT,
    );
  },

  // ✅ ۱۳.۱۶ — دیکشنری فقط-خواندنی ({id,name} ردیف‌های فعال).
  //  🔒 هیچ ورودی نمی‌گیرد؛ پاسخ برای همهٔ درخواست‌ها یکسان است و
  //     مدیر صف یک‌بار در هر نشست آن را نگه می‌دارد.
  async dictionaries() {
    return apiService.get(API_CONSTANTS.ENDPOINTS.PORTAL_REQUESTS.DICTIONARIES);
  },

  async detail(id) {
    return apiService.get(
      API_CONSTANTS.ENDPOINTS.PORTAL_REQUESTS.DETAIL(rowId(id)),
    );
  },

  // تأیید: بدنهٔ اختیاری payload = مقادیر اصلاح‌شدهٔ کارشناس
  async approve(id, payload = null) {
    const body = payload && typeof payload === "object" ? { payload } : {};
    return apiService.post(
      API_CONSTANTS.ENDPOINTS.PORTAL_REQUESTS.APPROVE(rowId(id)),
      body,
    );
  },

  async reject(id, reason) {
    return apiService.post(
      API_CONSTANTS.ENDPOINTS.PORTAL_REQUESTS.REJECT(rowId(id)),
      { reason: String(reason ?? "").trim().slice(0, 300) },
    );
  },
};
