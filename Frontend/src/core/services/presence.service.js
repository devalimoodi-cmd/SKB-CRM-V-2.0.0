// ============================================================
// presence.service.js  (core/services)
// «حضور کاربران» — چه کسی آنلاین است و آخرین فعالیتش کِی بوده
// ------------------------------------------------------------
// ریشهٔ باگی که این سرویس رفع می‌کند:
//   قبلاً وضعیت آنلاین فقط هنگام ورود (true) و خروج (false) ست می‌شد؛
//   اگر کاربر مرورگر را می‌بست، اینترنت/برق قطع می‌شد یا تب ساعت‌ها رها
//   می‌شد، کاربر تا ابد «آنلاین» می‌ماند و گزارش حضور بی‌اعتبار بود.
//
// راه‌حل (سبک Polling — بدون هیچ زیرساخت Realtime):
//   ۱) heartbeat هر PRESENCE_HEARTBEAT_SECONDS ثانیه، فقط وقتی تب دیده می‌شود
//   ۲) سمت سرور «تازه‌بودنِ» last_seen_at تعیین‌کننده است
//      (PRESENCE_ONLINE_WINDOW_SECONDS) ⇒ توقف heartbeat = آفلاین شدن
//   ۳) بستن/خروج تب → یک پیام آفلاینِ تلاش‌کننده (fetch keepalive)
//
// ⚠️ چرا fetch خام و نه apiService؟
//   heartbeat باید «بی‌صدا» باشد: نه توست خطا، نه ریدایرکت خودکار به صفحهٔ
//   ورود، نه لاگ پرحجم. apiService برای درخواست‌های کاربرِ واقعی است.
// ⚠️ چرا navigator.sendBeacon نه؟
//   sendBeacon نمی‌تواند هدر Authorization بفرستد؛ اگر توکن را در query
//   بگذاریم در لاگ‌ها/تاریخ مرورگر لو می‌رود. گزینهٔ درست برای صفحهٔ در حال
//   بسته‌شدن، fetch با keepalive است که هدر را هم می‌فرستد.
// ============================================================
import { API_CONSTANTS } from "../constants/api.const.js";
import { CONFIG } from "../constants/config.const.js";

// بازهٔ heartbeat (ثانیه) — باید دست‌کم نصفِ پنجرهٔ آنلاین سرور باشد
// (پیش‌فرض سرور: ۱۲۰ ثانیه). نگهبان تست این هماهنگی را چک می‌کند.
const HEARTBEAT_SECONDS = 45;
const HEARTBEAT_MS = HEARTBEAT_SECONDS * 1000;

class PresenceService {
  constructor() {
    this.timer = null;
    this.listenersInstalled = false;
    this.lastBeatAt = 0;
    this.initialized = false;
  }

  // ✅ وضعیت لاگین را از توکن محلی می‌خوانیم (نه از authService) تا
  //    حلقهٔ وابستگی auth ↔ presence ایجاد نشود.
  hasSession() {
    try {
      return !!localStorage.getItem(CONFIG.TOKEN_KEY);
    } catch {
      return false;
    }
  }

  apiUrl(endpoint) {
    const base =
      window.CONFIG?.API_BASE_URL || API_CONSTANTS.BASE_URL || "/api";
    return `${base}${endpoint}`;
  }

  // ===== راه‌اندازی: نصب شنونده‌ها + شروع heartbeat اگر کاربر وارد شده =====
  init() {
    if (this.initialized) return true;
    this.initialized = true;
    this.installListeners();

    if (this.hasSession()) this.start();
    return true;
  }

  installListeners() {
    if (this.listenersInstalled || typeof document === "undefined") return;
    this.listenersInstalled = true;

    // ✅ تبِ مخفی = کاربرِ حاضر نیست ⇒ heartbeat نمی‌فرستیم؛
    //    با برگشت به تب، فوراً حضور تازه می‌شود («بازگشت از تب دیگر»)
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) this.beat(true);
    });

    // ✅ بستن/رفرش/رفت‌وبرگشت صفحه → پیام آفلاینِ تلاش‌کننده
    window.addEventListener("pagehide", () => this.sendOffline());
  }

  // ===== شروع (ورود موفق یا بالا آمدن صفحه با کاربر لاگین) =====
  start() {
    this.installListeners();
    if (!this.hasSession()) return false;
    if (this.timer) return true;

    this.beat(true);
    this.timer = setInterval(() => {
      if (!document.hidden) this.beat();
    }, HEARTBEAT_MS);

    return true;
  }

  // ===== توقف (خروج) — بدون پیام آفلاین (خودِ خروج، آفلاین را ست می‌کند) =====
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.lastBeatAt = 0;
  }

  // ===== یک ضربان =====
  async beat(force = false) {
    if (!this.hasSession()) {
      // توکن پاک شده (خروج) ⇒ حلقه را ببند
      this.stop();
      return false;
    }

    const now = Date.now();
    // ضد تکرار: اگر به‌تازگی فرستاده‌ایم، دوباره نفرست (مثلاً چند رویداد هم‌زمان)
    if (!force && now - this.lastBeatAt < HEARTBEAT_MS) return false;
    this.lastBeatAt = now;

    try {
      await fetch(this.apiUrl(API_CONSTANTS.ENDPOINTS.PRESENCE.HEARTBEAT), {
        method: "POST",
        headers: this.headers(),
        body: "{}",
      });
      return true;
    } catch {
      // بی‌صدا: heartbeat هرگز نباید تجربهٔ کاربر را خراب کند
      return false;
    }
  }

  // ===== «من دیگر آنلاین نیستم» (بستن تب / خروج) =====
  // keepalive: true ⇒ مرورگر اجازه نمی‌دهد درخواست با رفتن صفحه قطع شود
  sendOffline() {
    try {
      if (!this.hasSession()) return false;
      fetch(this.apiUrl(API_CONSTANTS.ENDPOINTS.PRESENCE.OFFLINE), {
        method: "POST",
        keepalive: true,
        headers: this.headers(),
        body: "{}",
      }).catch(() => {
        /* بی‌صدا */
      });
      return true;
    } catch {
      return false;
    }
  }

  // ===== خروج کاربر: توقف حلقه + اعلام آفلاین =====
  logout() {
    this.sendOffline();
    this.stop();
  }

  headers() {
    const token = localStorage.getItem(CONFIG.TOKEN_KEY);
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }
}

export const presenceService = new PresenceService();

// ✅ دسترسی سراسری (مثل بقیهٔ سرویس‌های core)
if (typeof window !== "undefined") {
  window.presenceService = presenceService;
  window.PresenceService = PresenceService;
}
