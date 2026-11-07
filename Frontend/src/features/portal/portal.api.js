// ============================================================
// features/portal/portal.api.js
// لایهٔ ارتباط «پورتال مشتری» با سرور — فاز ۱۳.۲ و ۱۳.۳
// ------------------------------------------------------------
// 🔒 هیچ درخواستی پارامتر شناسه ندارد:
//    نه در آدرسی که ساخته می‌شود، نه در بدنه، نه در هدر.
//    شناسهٔ پرونده را فقط سرور از روی توکن می‌سازد
//    (Backend/middleware/customerScope.js → req.customerScopeId).
//    ⇒ دستکاری localStorage/URL نمی‌تواند پروندهٔ مشتری دیگری را باز کند.
//
// ⭐ تنها پارامتر مجاز در ۱۳.۳: page/limit (صفحه‌بندی فهرست‌ها).
//    سرور این دو را با parsePagination می‌خواند و سقف ۵۰ می‌گذارد.
// ============================================================
import { apiService } from "../../core/services/api.service.js";
import { API_CONSTANTS } from "../../core/constants/api.const.js";

// ساخت پارامتر صفحه‌بندی — فقط عدد مثبت؛ هیچ شناسه‌ای اینجا نیست
const pageParams = ({ page = 1, limit = 20 } = {}) => {
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(Math.max(1, parseInt(limit, 10) || 20), 50);
  return { page: safePage, limit: safeLimit };
};

export const portalApi = {
  // خلاصهٔ پروندهٔ خودِ کاربر واردشده
  async getSummary() {
    return apiService.get(API_CONSTANTS.ENDPOINTS.PORTAL.ME);
  },

  // فهرست سالن‌های خودم (صفحه‌بندی‌شده)
  async getHalls(params = {}) {
    return apiService.get(
      API_CONSTANTS.ENDPOINTS.PORTAL.HALLS,
      pageParams(params),
    );
  },

  // فهرست گله‌های خودم (صفحه‌بندی‌شده)
  async getFlocks(params = {}) {
    return apiService.get(
      API_CONSTANTS.ENDPOINTS.PORTAL.FLOCKS,
      pageParams(params),
    );
  },

  // فهرست هفته‌های مدیریتی خودم (صفحه‌بندی‌شده)
  async getWeeks(params = {}) {
    return apiService.get(
      API_CONSTANTS.ENDPOINTS.PORTAL.WEEKS,
      pageParams(params),
    );
  },

  // فهرست بازدیدهای خودم (صفحه‌بندی‌شده)
  async getVisits(params = {}) {
    return apiService.get(
      API_CONSTANTS.ENDPOINTS.PORTAL.VISITS,
      pageParams(params),
    );
  },
};
