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
// ✅ موج ۱۳.۱۵: قواعد فرم/payload در یک فایل مشترک (آینهٔ سرور)
import {
  FARM_MAX_NOTE_LENGTH,
  FARM_MAX_PENDING,
  farmPayload,
  farmTypeKey,
} from "./portal.farm.rules.js";

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

// ============================================================
// ✅ موج ۱۳.۱۰ — آینهٔ کلاینتیِ قواعد «مدارک من»
// ------------------------------------------------------------
//  منبع حقیقت سرور: Backend/services/portalDocumentRules.js
//  ⚠️ این آینه فقط برای «تجربهٔ بهتر» است (خطای فوری پیش از آپلود
//     ۵ مگابایتی)؛ امنیت با همان سقف‌ها/فهرست سفید سرور تأمین می‌شود.
//  🔒 پسوند/mime هرگز از نام فایل کاربر پذیرفته نمی‌شود؛ فقط همین
//     چهار نوع و سرور هم مستقل همان را می‌سنجد.
// ============================================================
export const DOCUMENT_KINDS = [
  { key: "id_card", label: "کارت ملی / مدارک هویتی" },
  { key: "license", label: "جواز / پروانه بهره‌برداری" },
  { key: "invoice", label: "فاکتور / مدارک مالی" },
  { key: "other", label: "سایر مدارک" },
];

export const DOCUMENT_ALLOWED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];

export const DOCUMENT_MAX_FILE_BYTES = 5 * 1024 * 1024; // ۵ مگابایت
export const DOCUMENT_MAX_COUNT = 10;
export const DOCUMENT_MAX_TOTAL_BYTES = 25 * 1024 * 1024;
export const DOCUMENT_MAX_TITLE_LENGTH = 120;

// برچسب پیش‌فرض وقتی مشتری عنوانی نمی‌نویسد (هم‌نام با سرور)
export const DOCUMENT_DEFAULT_TITLE = "مدرک بدون عنوان";

// عنوان: حذف کاراکترهای کنترلی/`<>` + فاصله‌سازی + سقف ۱۲۰
export const documentTitle = (raw) => {
  const clean = String(raw === null || raw === undefined ? "" : raw)
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return clean ? clean.slice(0, DOCUMENT_MAX_TITLE_LENGTH) : DOCUMENT_DEFAULT_TITLE;
};

// نوع مدرک: نامعتبر ⇒ other (هم‌رفتار با سرور)
export const documentKind = (raw) => {
  const key = String(raw === null || raw === undefined ? "" : raw)
    .trim()
    .toLowerCase();
  return DOCUMENT_KINDS.some((item) => item.key === key) ? key : "other";
};

// بررسی فایل پیش از ارسال — پیام فارسی یا رشتهٔ خالی (یعنی «مشکلی نیست»)
export const documentFileError = (file) => {
  if (!file) return "فایلی برای آپلود انتخاب نشده است";
  const size = Number(file.size) || 0;
  if (size <= 0) return "فایل انتخاب‌شده خالی است";
  if (size > DOCUMENT_MAX_FILE_BYTES) return "حجم فایل بیشتر از ۵ مگابایت است";
  const type = String(file.type || "").toLowerCase();
  if (!DOCUMENT_ALLOWED_MIME.includes(type)) {
    return "فقط تصویر (JPG/PNG/WEBP) یا PDF مجاز است";
  }
  return "";
};

// ============================================================
// ✅ موج ۱۳.۱۱ — آینهٔ کلاینتیِ قواعد «درخواست‌های فارم»
// ------------------------------------------------------------
//  منبع حقیقت سرور: Backend/services/portalRequestRules.js
//  ⚠️ این آینه فقط برای «تجربهٔ بهتر» است (خطای فوری پیش از ارسال و
//     بدنهٔ تمیز). امنیت با همان فهرست سفیدِ سرور تأمین می‌شود.
//  🔒 عمداً غایب: customer_id · status · id · reviewed_by · role
// ============================================================
// ✅ موج ۱۳.۱۵: ۱۸ نوع، کلیدهای سفید payload و `farmPayload` از یک
// منبع مشترک می‌آیند (`portal.farm.rules.js`) ⇒ دیگر فهرست دستی دوم
// وجود ندارد؛ فرم، payload و برچسب‌ها همیشه هم‌راستا می‌مانند.
export {
  FARM_REQUEST_TYPES,
  FARM_TYPE_KEYS,
  FARM_DESTRUCTIVE_TYPES,
  FARM_PAYLOAD_KEYS,
  farmTypeKey,
  farmPayload,
  farmIsDestructive,
} from "./portal.farm.rules.js";

export const FARM_STATUS_KEYS = [
  "pending",
  "approved",
  "rejected",
  "cancelled",
];

export const FARM_LIMITS = {
  // سقف در انتظار هم‌عدد سرور (MAX_PENDING_REQUESTS)
  maxPending: FARM_MAX_PENDING,
  maxNoteLength: FARM_MAX_NOTE_LENGTH,
};

// ✅ موج ۱۳.۱۵: فهرست کلیدهای payload از `FARM_FORM_SPEC` مشتق می‌شود
// (`FARM_PAYLOAD_KEYS` در portal.farm.rules.js) — نسخهٔ دستی حذف شد.

// ✅ موج ۱۳.۱۵: `farmPayload` از portal.farm.rules.js صادر می‌شود
// (تایپ‌آگاه: عدد/بولین/آرایهٔ شناسه/ردیف تجهیزات — همه از spec).

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

  // 🔒 موج ۱۳.۱۰.۱ — تنها مقدار مجاز `scope`: رشتهٔ "all" (شامل گلهٔ بسته).
  //    هر مقدار دیگری دور ریخته می‌شود (سرور هم فقط "all" را می‌شناسد).
  async getDashboardAnalysis({ scope = "" } = {}) {
    const params = {};
    if (String(scope ?? "").trim().toLowerCase() === "all") params.scope = "all";
    return apiService.get(
      API_CONSTANTS.ENDPOINTS.PORTAL.DASHBOARD_ANALYSIS,
      params,
    );
  },

  // ============================================================
  // ✅ موج ۱۳.۱۰ — «مدارک من» (تنها مسیر فایل در پورتال)
  // ------------------------------------------------------------
  //  🔒 قواعد:
  //   ۱) هیچ شناسهٔ مشتری فرستاده نمی‌شود؛ سرور از توکن می‌سازد.
  //   ۲) `title`/`kind` متن آزاد نیستند: kind با فهرست سفید و title با
  //      بریدن طول پاک می‌شود (سرور هم دوباره پاک‌سازی می‌کند).
  //   ۳) حجم/نوع فایل **قبل** از ارسال سنجیده می‌شود تا مشتری با
  //      اینترنت کم‌سرعت ۵ مگابایت را بیهوده نفرستد؛ سرور هم مستقل
  //      همان سقف‌ها را دارد (multer + سهمیه).
  //   ۴) دانلود همیشه با هدر احراز هویت (apiService.download) — هیچ
  //      لینک عمومی/بدون توکن برای مدارک ساخته نمی‌شود.
  // ============================================================
  async getDocuments(params = {}) {
    return apiService.get(
      API_CONSTANTS.ENDPOINTS.PORTAL.DOCUMENTS,
      pageParams(params),
    );
  },

  // آپلود با FormData + نوار پیشرفت
  // (فیلد فایل عمداً «file» است — همان نامی که multer سرور انتظار دارد)
  async uploadDocument(file, { title = "", kind = "other", onProgress = null } = {}) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", documentTitle(title));
    formData.append("kind", documentKind(kind));

    return apiService.uploadFormData(
      API_CONSTANTS.ENDPOINTS.PORTAL.DOCUMENTS,
      formData,
      onProgress,
    );
  },

  // حذف (سرور: حذف نرم — فایل برای بازبینی می‌ماند)
  async deleteDocument(id) {
    return apiService.delete(
      API_CONSTANTS.ENDPOINTS.PORTAL.DOCUMENT_DELETE(rowId(id)),
    );
  },

  // دانلود فایل مدرک با توکن
  async downloadDocument(id, fileName = "document") {
    return apiService.download(
      API_CONSTANTS.ENDPOINTS.PORTAL.DOCUMENT_FILE(rowId(id)),
      fileName,
    );
  },

  // ============================================================
  // ✅ موج ۱۳.۱۱ — «درخواست‌های فارم» (الگوی ب)
  // ------------------------------------------------------------
  //  🔒 قواعد:
  //   ۱) هیچ شناسهٔ مشتری فرستاده نمی‌شود (سرور از توکن می‌سازد).
  //   ۲) `farmPayload` آینهٔ کلاینتیِ فهرست سفید سرور است: هر کلید
  //      ناشناخته در **کلاینت** هم دور ریخته می‌شود تا بدنهٔ درخواست
  //      دقیقاً همان چیزی باشد که فرم تولید کرده.
  //   ۳) شناسهٔ درخواست برای لغو فقط از پاسخ سرور می‌آید و با rowId
  //      اعتبارسنجی می‌شود.
  //   ۴) این‌ها «درخواست»‌اند، نه نوشتن: تا تأیید کارشناس هیچ ردیفی
  //      در واحد/سالن/جوجه‌ریزی ساخته نمی‌شود.
  // ============================================================
  async getFarmOptions() {
    return apiService.get(API_CONSTANTS.ENDPOINTS.PORTAL.FARM_OPTIONS);
  },

  async getFarmRequests(params = {}) {
    const query = pageParams(params);
    const status = String(params.status ?? "").trim();
    if (FARM_STATUS_KEYS.includes(status)) query.status = status;
    return apiService.get(
      API_CONSTANTS.ENDPOINTS.PORTAL.FARM_REQUESTS,
      query,
    );
  },

  async createFarmRequest(type, input = {}) {
    return apiService.post(API_CONSTANTS.ENDPOINTS.PORTAL.FARM_REQUESTS, {
      request_type: farmTypeKey(type),
      payload: farmPayload(type, input),
    });
  },

  async cancelFarmRequest(id) {
    return apiService.post(
      API_CONSTANTS.ENDPOINTS.PORTAL.FARM_REQUEST_CANCEL(rowId(id)),
      {},
    );
  },

  // ============================================================
  // ✅ موج ۱۳.۱۳/۱۳.۱۴/۱۳.۱۵ — «جزئیات ردیف خودم» برای پیش‌پرکردن فرم
  // ------------------------------------------------------------
  //  🔒 شناسه فقط از پاسخ فهرست/گزینه‌ها می‌آید و با rowId اعتبارسنجی
  //     می‌شود؛ سرور هم مالکیت را در همان کوئری می‌سنجد (۴۰۴).
  // ============================================================
  async getFarmHallDetails(id) {
    return apiService.get(
      API_CONSTANTS.ENDPOINTS.PORTAL.FARM_HALL_DETAILS(rowId(id)),
    );
  },

  async getFarmPlacementDetails(id) {
    return apiService.get(
      API_CONSTANTS.ENDPOINTS.PORTAL.FARM_PLACEMENT_DETAILS(rowId(id)),
    );
  },

  // ✅ ۱۳.۱۵: یک هفتهٔ ثبت‌شده (پنج آرایهٔ شناسه + اعداد) برای ویرایش
  async getFarmWeeklyDetails(id) {
    return apiService.get(
      API_CONSTANTS.ENDPOINTS.PORTAL.FARM_WEEKLY_DETAILS(rowId(id)),
    );
  },
};
