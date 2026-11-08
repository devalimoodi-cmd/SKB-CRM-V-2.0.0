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

// ============================================================
// ✅ موج ۱۳.۸ — آینهٔ کلاینتیِ فهرست سفید پروفایل
// ------------------------------------------------------------
//  منبع حقیقت سرور: Backend/services/portalProfileRules.js
//  ⚠️ این آینه فقط برای «تجربهٔ بهتر» است (خطای فوری پیش از ارسال)؛
//     امنیت با همان فهرست سفیدِ سرور تأمین می‌شود. اگر روزی فیلدی در
//     سرور اضافه شد و این‌جا نه، فقط آن فیلد از فرم ارسال نمی‌شود —
//     هرگز برعکس (فیلد غیرمجاز به سرور نمی‌رسد).
//  🔒 عمداً غایب: id · customer_code · customer_type_id · mobile_number ·
//     active · status · sales_department · created_by · updated_by
// ============================================================
export const PROFILE_EDITABLE_FIELDS = [
  "full_name",
  "farm_name",
  "collection_name",
  "national_code",
  "email",
  "date_of_birth",
  "experience_years",
  "education_level",
  "gender",
  "province",
  "county",
  "postal_code",
  "farm_address",
  "messaging_number",
  "skb_how_know",
];

const PROFILE_MAX_LENGTH = 1000; // سقف سخت (سرور هم طول هر فیلد را می‌سنجد)

// بدنهٔ PATCH: فقط کلیدهای سفید + رشتهٔ تمیزشده (بدون کلید ناشناخته)
export const profilePatch = (input = {}) => {
  const source = input && typeof input === "object" ? input : {};
  const patch = {};
  PROFILE_EDITABLE_FIELDS.forEach((field) => {
    if (!Object.prototype.hasOwnProperty.call(source, field)) return;
    const raw = source[field];
    patch[field] =
      raw === null || raw === undefined
        ? ""
        : String(raw).trim().slice(0, PROFILE_MAX_LENGTH);
  });
  return patch;
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

  // ============================================================
  // ✅ موج ۱۳.۸ — «پروفایل من»
  // ------------------------------------------------------------
  //  🔒 سه نوشتنِ مجاز پورتال و نه یکی بیشتر:
  //     ۱) PATCH  /portal/profile                (فهرست سفید فیلدها)
  //     ۲) POST   /portal/profile/mobile/request (کد پیامکی)
  //     ۳) POST   /portal/profile/mobile/confirm (تأیید کد)
  //  چرا موبایل مسیر جدا دارد؟ شمارهٔ ورود = هویت حساب؛ تغییرش باید با
  //  «مالکیت شمارهٔ جدید» (کد پیامکی) ثابت شود.
  //  ⚠️ هرگز mobile_number در بدنهٔ PATCH فرستاده نمی‌شود (سرور هم
  //     نادیده می‌گیرد؛ کلاینت هم اصلاً نمی‌فرستد).
  // ============================================================
  async getProfile() {
    return apiService.get(API_CONSTANTS.ENDPOINTS.PORTAL.PROFILE);
  },

  async updateProfile(patch = {}) {
    // فقط کلیدهای سفید و فقط مقادیر متنی — هیچ کلید ناشناخته‌ای
    // حتی به بدنهٔ درخواست راه نمی‌یابد.
    return apiService.patch(
      API_CONSTANTS.ENDPOINTS.PORTAL.PROFILE,
      profilePatch(patch),
    );
  },

  async requestMobileChange(mobileNumber) {
    return apiService.post(
      API_CONSTANTS.ENDPOINTS.PORTAL.PROFILE_MOBILE_REQUEST,
      { mobile_number: String(mobileNumber ?? "").trim() },
    );
  },

  async confirmMobileChange({ challengeId, code } = {}) {
    return apiService.post(
      API_CONSTANTS.ENDPOINTS.PORTAL.PROFILE_MOBILE_CONFIRM,
      {
        challenge_id: String(challengeId ?? "").trim(),
        code: String(code ?? "").replace(/\D/g, "").slice(0, 6),
      },
    );
  },

  // ============================================================
  // ✅ موج ۱۳.۸ — داشبورد تحلیلی (فقط خواندن)
  // ------------------------------------------------------------
  //  🔒 هیچ شناسهٔ مشتری فرستاده نمی‌شود. تنها شناسهٔ مجاز: گلهٔ خودم
  //     (flockGroupId = دورهٔ گله، flockId = جوجه‌ریزی/سالن) که فقط از
  //     پاسخ /dashboard/options گرفته می‌شود و این‌جا اعتبارسنجی می‌شود.
  // ============================================================
  async getDashboardOptions() {
    return apiService.get(API_CONSTANTS.ENDPOINTS.PORTAL.DASHBOARD_OPTIONS);
  },

  async getDashboardSummary() {
    return apiService.get(API_CONSTANTS.ENDPOINTS.PORTAL.DASHBOARD_SUMMARY);
  },

  async getDashboardCharts({ flockGroupId = null, flockId = null } = {}) {
    const params = {};
    if (flockGroupId) params.flockGroupId = rowId(flockGroupId);
    if (flockId) params.flockId = rowId(flockId);
    return apiService.get(
      API_CONSTANTS.ENDPOINTS.PORTAL.DASHBOARD_CHARTS,
      params,
    );
  },

  async getDashboardAnalysis() {
    return apiService.get(API_CONSTANTS.ENDPOINTS.PORTAL.DASHBOARD_ANALYSIS);
  },
};
