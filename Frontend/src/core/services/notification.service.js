
import { loaderService } from "../../shared/components/Loader/loader.service.js";

class NotificationService {
  constructor() {
    this.toastConfig = {
      success: {
        icon: "success",
        position: "top",
        timer: 3000,
        background: "#f0fdf4",
        iconColor: "#10b981",
      },
      error: {
        icon: "error",
        position: "top",
        timer: 4000,
        background: "#fef2f2",
        iconColor: "#ef4444",
      },
      warning: {
        icon: "warning",
        position: "top",
        timer: 3000,
        background: "#fffbeb",
        iconColor: "#f59e0b",
      },
      info: {
        icon: "info",
        position: "top",
        timer: 3000,
        background: "#eff6ff",
        iconColor: "#3b82f6",
      },
    };

    // ✅ «کمهزاحمت»: وضعیت ضدتکرار و سقف نرخ برای پیامهای کاربر
    this._recentKeys = new Map(); // key → زمان آخرین نمایش
    this._recentTimes = []; // زمان پیامهای اخیر (برای سقف دقیقهای)
    this._pendingToast = null; // پیامی که چون پیام دیگری باز بود، در صف ماند
    this._flushTimer = null; // تایمر تخلیهٔ صف
  }

  _getSwal() {
    // ✅ بررسی صحیح وجود Swal
    if (typeof Swal !== "undefined") {
      return Swal;
    }
    if (typeof window.Swal !== "undefined") {
      return window.Swal;
    }
    if (typeof swal !== "undefined") {
      return swal;
    }
    // ✅ بررسی در jQuery
    if (typeof $ !== "undefined" && $.fn && $.fn.swal) {
      return $.fn.swal;
    }
    console.warn("⚠️ SweetAlert2 not found, using fallback alert");
    return null;
  }

  // نمایش توست (پایهٔ همهٔ پیام‌های نوع toast)
  _showToast(message, type = "info") {
    const config = this.toastConfig[type] || this.toastConfig.info;
    const swal = this._getSwal();

    if (swal && swal.fire) {
      swal.fire({
        icon: config.icon,
        title: message,
        toast: true,
        position: config.position || "top-start",
        showConfirmButton: false,
        timer: config.timer || 3000,
        timerProgressBar: true,
        background: config.background,
        iconColor: config.iconColor,
        width: "auto",
        padding: "0.8rem 1.2rem",
      });
      return true;
    }

    // ✅ fallback با console.log (وقتی SweetAlert2 در صفحه لود نشده باشد)
    console.log(`[${type.toUpperCase()}]`, message);
    return false;
  }

  toast(message, type = "info") {
    this._showToast(message, type);
  }

  // ================================================================
  // ✅ توست «کم‌مزاحمت» برای شکست عملیات‌هایی که کاربر خودش شروع کرده
  // ----------------------------------------------------------------
  // قواعد (سیاست پروژه: هیچ مزاحمتی برای کاربر):
  //  • فقط توست کوچک و خودبسته — هرگز مودال/دکمه نمی‌سازد
  //  • «یک پیام در لحظه»: اگر توست/مودال دیگری باز است، پیام در صف می‌ماند
  //  • ضدتکرار (cooldownMs) + سقف نرخ (maxPerMinute) → جلوگیری از سیل پیام
  //  • خاموشی سراسری: ?debug=1 یا localStorage.skb_user_toasts="off"
  // ================================================================
  notifyOnce({ key, message, type = "error", cooldownMs = 30000, maxPerMinute = 3 } = {}) {
    const text = typeof message === "string" ? message.trim() : "";
    if (!text) return false;

    const dedupeKey = key || text;

    // خاموشی سراسری یا حالت دیباگ → فقط کنسول
    if (this._userToastsDisabled()) {
      console.info(`[toast-off] ${text}`);
      return false;
    }

    const now = Date.now();

    // ۱) ضدتکرار: همان پیام در بازهٔ cooldown دوباره نمایش داده نمی‌شود
    const last = this._recentKeys.get(dedupeKey);
    if (last && now - last < cooldownMs) return false;

    // ۲) سقف نرخ: حداکثر maxPerMinute پیام در دقیقه
    this._recentTimes = this._recentTimes.filter((t) => now - t < 60000);
    if (this._recentTimes.length >= maxPerMinute) return false;

    // ۳) یک پیام در لحظه: پیام‌ها روی هم انبار نمی‌شوند
    if (this._anyVisible()) {
      this._pendingToast = { message: text, type };
      this._scheduleFlush();
      return false;
    }

    this._recentKeys.set(dedupeKey, now);
    this._recentTimes.push(now);
    return this._showToast(text, type);
  }

  // ===== کمکی‌های notifyOnce =====
  _userToastsDisabled() {
    if (typeof window === "undefined") return true;
    try {
      if (localStorage.getItem("skb_user_toasts") === "off") return true;
      return new URLSearchParams(window.location.search).has("debug");
    } catch {
      return false;
    }
  }

  _anyVisible() {
    const swal = this._getSwal();
    return !!(swal && typeof swal.isVisible === "function" && swal.isVisible());
  }

  _scheduleFlush(attempt = 0) {
    if (this._flushTimer || !this._pendingToast) return;

    this._flushTimer = setTimeout(() => {
      this._flushTimer = null;
      if (!this._pendingToast) return;

      // حداکثر ~۱۰ ثانیه انتظار (۲۰ × ۵۰۰ms) تا پیام بازِ قبلی بسته شود
      if (this._anyVisible() && attempt < 20) {
        this._scheduleFlush(attempt + 1);
        return;
      }

      const { message, type } = this._pendingToast;
      this._pendingToast = null;
      this._showToast(message, type);
    }, 500);
  }

  success(message) {
    this.toast(message, "success");
  }

  error(message) {
    this.toast(message, "error");
  }

  warning(message) {
    this.toast(message, "warning");
  }

  info(message) {
    this.toast(message, "info");
  }

  showError(message) {
    console.error("❌", message);
    const swal = this._getSwal();

    if (!swal) {
      // eslint-disable-next-line no-alert -- فالبک فقط وقتی SweetAlert2 در صفحه لود نشده باشد
      alert(message);
      return;
    }

    if (Array.isArray(message) && message.length > 0) {
      const errorList = message
        .map(
          (err, index) => `
                <div style="padding: 6px 0; font-size: 13px; color: var(--c-991b1b, #991b1b); border-bottom: 1px solid var(--danger-mist, #fecaca); display: flex; align-items: flex-start; gap: 8px;">
                    <span style="color: var(--danger, #dc2626); font-weight: bold;">${index + 1}.</span>
                    <span style="flex: 1;">${err}</span>
                </div>
            `,
        )
        .join("");

      swal.fire({
        icon: "error",
        title: "⚠️ خطاهای اعتبارسنجی",
        html: `
                    <div style="text-align: right; direction: rtl; font-family: 'Vazir', sans-serif;">
                        <p style="font-size: 14px; color: var(--text-slate, #475569); margin-bottom: 16px;">
                            لطفاً موارد زیر را اصلاح کنید:
                        </p>
                        <div style="background: var(--danger-soft, #fef2f2); border-right: 4px solid var(--danger, #dc2626); padding: 12px 16px; border-radius: 8px; text-align: right; max-height: 300px; overflow-y: auto;">
                            ${errorList}
                        </div>
                    </div>
                `,
        confirmButtonText: "متوجه شدم",
        confirmButtonColor: "#dc2626",
        width: "550px",
      });
      return;
    }

    if (typeof message === "string") {
      swal.fire({
        icon: "error",
        title: "❌ خطا",
        text: message,
        confirmButtonText: "متوجه شدم",
        confirmButtonColor: "#dc2626",
        timer: 5000,
        timerProgressBar: true,
      });
      return;
    }

    if (typeof message === "object" && message.message) {
      swal.fire({
        icon: "error",
        title: "❌ خطا",
        text: message.message,
        confirmButtonText: "متوجه شدم",
        confirmButtonColor: "#dc2626",
        timer: 5000,
        timerProgressBar: true,
      });
      return;
    }

    swal.fire({
      icon: "error",
      title: "❌ خطا",
      text: String(message) || "خطایی رخ داده است",
      confirmButtonText: "متوجه شدم",
      confirmButtonColor: "#dc2626",
    });
  }

  // ================================================================
  // ✅ پیام نیازمند تأیید کاربر (مودال تک‌دکمه‌ای، بدون انصراف و بدون تایمر)
  // ----------------------------------------------------------------
  // کاربرد: ورود به صفحه/بخشی که برای نقش کاربر بسته شده است.
  // Promise پس از تأیید کاربر resolve می‌شود (تا هدایت صفحه بعد از
  // دیده‌شدن پیام انجام شود).
  // ================================================================
  async modalMessage({
    title = "⛔ عدم دسترسی",
    text = "",
    html = null,
    confirmText = "متوجه شدم",
    icon = "warning",
  } = {}) {
    const swal = this._getSwal();

    if (!swal) {
      // eslint-disable-next-line no-alert -- فالبک فقط وقتی SweetAlert2 در صفحه لود نشده باشد
      alert(`${title}${text ? `\n${text}` : ""}`);
      return true;
    }

    const result = await swal.fire({
      title,
      ...(html ? { html } : { text }),
      icon,
      confirmButtonText: confirmText,
      confirmButtonColor: "#2c7a6e",
      allowOutsideClick: false,
      allowEscapeKey: false,
    });

    return !!result?.isConfirmed;
  }

  // ===== تأیید عملیات با SweetAlert2 =====
  // گزینه‌ها: title، text، html (به‌جای text برای متن چندخطی)،
  //          confirmText، cancelText، icon، danger (دکمهٔ تأیید قرمز)
  async confirm(options = {}) {
    const swal = this._getSwal();
    if (!swal) {
      // eslint-disable-next-line no-alert -- فالبک فقط وقتی SweetAlert2 در صفحه لود نشده باشد
      return confirm(options.text || "آیا مطمئن هستید؟");
    }

    const defaultOptions = {
      title: "تأیید عملیات",
      text: "آیا از انجام این عملیات اطمینان دارید؟",
      confirmText: "بله",
      cancelText: "انصراف",
      icon: "question",
      danger: false,
    };

    const merged = { ...defaultOptions, ...options };

    const result = await swal.fire({
      title: merged.title,
      ...(merged.html ? { html: merged.html } : { text: merged.text }),
      icon: merged.icon,
      showCancelButton: true,
      confirmButtonColor: merged.danger ? "#dc2626" : "#2c7a6e",
      cancelButtonColor: "#94a3b8",
      confirmButtonText: merged.confirmText,
      cancelButtonText: merged.cancelText,
      reverseButtons: true,
    });

    return result.isConfirmed;
  }

  async showLoading(message = "در حال بارگذاری...") {
    const swal = this._getSwal();
    if (!swal) return;

    // ✅ لودر سیستمی (پیرو انتخاب ادمین) داخل مودال — به‌جای اسپینر پیش‌فرض سوئال
    const markup = await loaderService.inline({ text: message, size: "md" });

    swal.fire({
      html:
        markup ||
        `<div style="padding:6px 0;font-size:14px;color:var(--text-slate, #475569);">${message}</div>`,
      allowOutsideClick: false,
      showConfirmButton: false,
      width: "280px",
      padding: "1.4rem 1rem",
    });

    // اگر مارک‌آپ لودر در دسترس نبود، همان اسپینر پیش‌فرض سوئال
    if (!markup) swal.showLoading();
  }

  hideLoading() {
    const swal = this._getSwal();
    if (swal) {
      swal.close();
    }
  }

  showValidationErrors(errors) {
    if (!errors || errors.length === 0) return;
    this.showError(errors);
  }
}

export const notificationService = new NotificationService();
