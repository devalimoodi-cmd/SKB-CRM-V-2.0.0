// ============================================================
// activity.service.js  (core/services)
// «ردّ فعالیت» (فاز ۱۲.۲) — لایهٔ نازک روی apiService
// ------------------------------------------------------------
// چه سؤالی را پاسخ می‌دهد؟
//   «چه کسی، چه زمانی، کدام رکورد را تغییر داد؟»
//   بک‌اند هر POST/PUT/PATCH/DELETE (+ ورود/خروج) را خودکار ثبت می‌کند؛
//   این سرویس فقط خواندنِ همان تاریخچه است.
//
// ⚠️ UI این سرویس در فاز ۱۲.۳ ساخته شد: پنل «فعالیت کاربران» در
//    admin-panel.html (features/activity-log) — فیلتر/صفحه‌بندی/مودال/CSV.
//    منطق خالص UI در activity-log.view.js است و همین سرویس را صدا می‌زند.
// ⚠️ چرا apiService و نه fetch خام؟ چون این‌ها درخواستِ صریح مدیر
//    هستند و باید مثل بقیهٔ سیستم رفتار کنند: توست خطا، پشتیبانی از
//    ۴۰۱ («نشست بسته شد») و ۴۰۳ (نبود مجوز users.activity.view).
// ⚠️ هیچ‌وقت `session_id` در پاسخ نیست — بک‌اند در buildItem حذفش
//    می‌کند (ستون داخلی برای همبستگی با user_sessions).
// ============================================================
import { apiService } from "./api.service.js";
import { API_CONSTANTS } from "../constants/api.const.js";

const E = API_CONSTANTS.ENDPOINTS.ACTIVITY;

// پرکردن الگوی «:id» در مسیر
const fill = (template, id) => String(template).replace(":id", id);

class ActivityService {
  // ===== فهرست ردّ فعالیت (کلید users.activity.view) =====
  // خروجی: { activities: [...], config, pagination }
  async list({
    userId = null,
    action = null,
    entity = null,
    entityId = null,
    method = null,
    success = null,
    from = null,
    to = null,
    page = 1,
    limit = 25,
  } = {}) {
    const params = { page, limit };
    if (userId) params.user_id = userId;
    if (action) params.action = action;
    if (entity) params.entity = entity;
    if (entityId) params.entity_id = entityId;
    if (method) params.method = method;
    // success می‌تواند false باشد ⇒ نباید با if ساده حذف شود
    if (success === true || success === false) params.success = success;
    if (from) params.from = from;
    if (to) params.to = to;

    const res = await apiService.get(E.LIST, params);
    return res?.data ?? null;
  }

  // ===== خلاصهٔ آماری (سرِ پنل مدیریت) =====
  // خروجی: { total, success, failed, unique_actors, by_action, by_entity, ... }
  async summary({ limit = 1000 } = {}) {
    const res = await apiService.get(E.SUMMARY, { limit });
    return res?.data ?? null;
  }

  // ===== جزئیات یک رویداد =====
  async getById(activityId) {
    const res = await apiService.get(fill(E.DETAIL, activityId));
    return res?.data ?? null;
  }
}

export const activityService = new ActivityService();

// ✅ دسترسی سراسری (مثل بقیهٔ سرویس‌های core)
if (typeof window !== "undefined") {
  window.activityService = activityService;
  window.ActivityService = ActivityService;
}
