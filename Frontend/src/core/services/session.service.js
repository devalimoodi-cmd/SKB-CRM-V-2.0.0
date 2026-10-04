// ============================================================
// session.service.js  (core/services)
// «نشست‌های کاربران» (فاز ۱۲.۱) — لایهٔ نازک روی apiService
// ------------------------------------------------------------
// باگی که این سرویس به‌کاربر می‌بندد:
//   دکمهٔ «خروج از همهٔ دستگاه‌ها» در تنظیمات تا امروز فقط توکن
//   ذخیره‌شده در `users.token` را عوض می‌کرد؛ چون هر دستگاه توکن
//   مستقل خودش را دارد، عملاً هیچ دستگاه دیگری بیرون نمی‌افتاد.
//   حالا هر ورود یک ردیف `user_sessions` با `sid` دارد و بستنِ آن
//   ردیف ⇒ توکن همان دستگاه در درخواست بعدی ۴۰۱ می‌گیرد.
//
// ⚠️ در این فاز هیچ UIای ساخته نشده؛ فقط دسترسی برنامه‌ای به API
//    فراهم است تا ۱۲.۳ (پنل «فعالیت کاربران») و تب «دستگاه‌های فعال»
//    در صفحهٔ تنظیمات روی همین سرویس سوار شوند.
// ⚠️ چرا apiService و نه fetch خام؟ (تفاوت با presence.service.js)
//    heartbeat حضور، «بی‌صدا» و پس‌زمینه است؛ ولی این عملیات‌ها
//    درخواستِ صریح کاربر/مدیر هستند و باید مثل بقیهٔ سیستم رفتار کنند:
//    توست خطا، پشتیبانی از ۴۰۱ («نشست بسته شد» ⇒ پاک‌کردن توکن و
//    رفتن به صفحهٔ ورود) و لاگ قابل‌ردیابی.
// ============================================================
import { apiService } from "./api.service.js";
import { API_CONSTANTS } from "../constants/api.const.js";

const E = API_CONSTANTS.ENDPOINTS.SESSIONS;

// پرکردن هر دو الگوی «:id» و «:userId» در مسیر
const fill = (template, id) =>
  String(template).replace(":id", id).replace(":userId", id);

class SessionService {
  // ===== نشست‌های «من» (هر کاربر لاگین‌شده) =====
  // خروجی: { total, active, ended, unique_users, sessions: [...] }
  // نشستِ همین دستگاه با `current: true` علامت خورده است.
  async mine() {
    const res = await apiService.get(E.MINE);
    return res?.data ?? null;
  }

  // ===== فهرست نشست‌ها (فقط نقش‌های مدیریتی + مجوز مشاهده) =====
  async list({ userId = null, activeOnly = false, page = 1, limit = 20 } = {}) {
    const params = { page, limit };
    if (userId) params.user_id = userId;
    if (activeOnly) params.active_only = true;

    const res = await apiService.get(E.LIST, params);
    return res?.data ?? null;
  }

  // ===== خلاصهٔ نشست‌ها (سرِ پنل مدیریت) =====
  async summary({ activeOnly = false } = {}) {
    const params = activeOnly ? { active_only: true } : {};
    const res = await apiService.get(E.SUMMARY, params);
    return res?.data ?? null;
  }

  // ===== بستن یک نشست (کلید users.sessions.revoke) =====
  // آن دستگاه از درخواست بعدی ۴۰۱ می‌گیرد و به صفحهٔ ورود می‌رود.
  async revoke(sessionId) {
    const res = await apiService.post(fill(E.REVOKE, sessionId), {});
    return res?.data ?? null;
  }

  // ===== بستن همهٔ نشست‌های یک کاربر =====
  async revokeAll(userId) {
    const res = await apiService.post(fill(E.REVOKE_ALL, userId), {});
    return res?.data ?? null;
  }
}

export const sessionService = new SessionService();

// ✅ دسترسی سراسری (مثل بقیهٔ سرویس‌های core)
if (typeof window !== "undefined") {
  window.sessionService = sessionService;
  window.SessionService = SessionService;
}
