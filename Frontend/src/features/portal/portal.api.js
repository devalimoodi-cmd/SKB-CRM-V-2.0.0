// ============================================================
// features/portal/portal.api.js
// لایهٔ ارتباط «پورتال مشتری» با سرور — فاز ۱۳.۲، ۱۳.۳ و ۱۳.۴
// ------------------------------------------------------------
// 🔒 هیچ درخواستی شناسهٔ «مشتری» ندارد:
//    نه در آدرسی که ساخته می‌شود، نه در بدنه، نه در هدر.
//    شناسهٔ پرونده را فقط سرور از روی توکن می‌سازد
//    (Backend/middleware/customerScope.js → req.customerScopeId).
//    ⇒ دستکاری localStorage/URL نمی‌تواند پروندهٔ مشتری دیگری را باز کند.
//
// ⭐ تنها پارامتر مجاز در فهرست‌ها: page/limit (سقف ۵۰ در سرور).
// ⭐ از ۱۳.۴: «شناسهٔ ردیف خودم» (هفته/بازدید/پیوست) در مسیر می‌آید؛
//    این شناسه فقط از پاسخِ فهرست گرفته می‌شود و پیش از ساخت آدرس با
//    rowId() اعتبارسنجی می‌شود (هیچ ورودی آزاد کاربر به URL نمی‌رود).
//    سرور هم مالکیت را با customer_id در همان کوئری می‌سنجد.
// ============================================================
import { apiService } from "../../core/services/api.service.js";
import { API_CONSTANTS } from "../../core/constants/api.const.js";

// ساخت پارامتر صفحه‌بندی — فقط عدد مثبت؛ هیچ شناسه‌ای اینجا نیست
const pageParams = ({ page = 1, limit = 20 } = {}) => {
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(Math.max(1, parseInt(limit, 10) || 20), 50);
  return { page: safePage, limit: safeLimit };
};

// شناسهٔ ردیف: فقط عدد صحیح مثبت و کوتاه (هم‌قاعده با کنترلر سرور)
const ROW_ID_PATTERN = /^\d{1,9}$/;

const rowId = (value) => {
  const raw = String(value === null || value === undefined ? "" : value).trim();
  const parsed = Number(raw);
  if (!ROW_ID_PATTERN.test(raw) || !Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("شناسهٔ ردیف نامعتبر است");
  }
  return parsed;
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

  // ۱۳.۴ — جزئیات یک هفتهٔ مدیریتی خودم (بیماری/واکسن/دارو/خوراک)
  async getWeekDetail(id) {
    return apiService.get(
      API_CONSTANTS.ENDPOINTS.PORTAL.WEEK_DETAIL(rowId(id)),
    );
  },

  // ۱۳.۴ — جزئیات یک بازدید: متن گزارش + فهرست پیوست‌ها
  // (سرور کلید مجوز جدا می‌سنجد: customer.portal.visit.report)
  async getVisitDetail(id) {
    return apiService.get(
      API_CONSTANTS.ENDPOINTS.PORTAL.VISIT_DETAIL(rowId(id)),
    );
  },

  // ۱۳.۴ — دانلود پیوست با هدر احراز هویت (هیچ لینک عمومی وجود ندارد)
  async downloadAttachment(visitId, attachmentId, fileName = "attachment") {
    return apiService.download(
      API_CONSTANTS.ENDPOINTS.PORTAL.VISIT_ATTACHMENT(
        rowId(visitId),
        rowId(attachmentId),
      ),
      fileName,
    );
  },
};
