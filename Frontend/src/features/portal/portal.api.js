// ============================================================
// features/portal/portal.api.js
// لایهٔ ارتباط «پورتال مشتری» با سرور — فاز ۱۳.۲
// ------------------------------------------------------------
// 🔒 تنها یک درخواست و بدون هیچ پارامتری:
//    نه پارامتر شناسه در آدرس، نه بدنه، نه هدرِ شناسه.
//    شناسهٔ پرونده را فقط سرور از روی توکن می‌سازد
//    (Backend/middleware/customerScope.js → req.customerScopeId).
//    ⇒ دستکاری localStorage/URL نمی‌تواند پروندهٔ مشتری دیگری را باز کند.
// ============================================================
import { apiService } from "../../core/services/api.service.js";
import { API_CONSTANTS } from "../../core/constants/api.const.js";

export const portalApi = {
  // خلاصهٔ پروندهٔ خودِ کاربر واردشده
  async getSummary() {
    return apiService.get(API_CONSTANTS.ENDPOINTS.PORTAL.ME);
  },
};
