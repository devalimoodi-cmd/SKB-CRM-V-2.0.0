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

  toast(message, type = "info") {
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
    } else {
      // ✅ fallback با console.log
      console.log(`[${type.toUpperCase()}]`, message);
      // ✅ یا با alert ساده
      // alert(message);
    }
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
      alert(message);
      return;
    }

    if (Array.isArray(message) && message.length > 0) {
      const errorList = message
        .map(
          (err, index) => `
                <div style="padding: 6px 0; font-size: 13px; color: #991b1b; border-bottom: 1px solid #fecaca; display: flex; align-items: flex-start; gap: 8px;">
                    <span style="color: #dc2626; font-weight: bold;">${index + 1}.</span>
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
                        <p style="font-size: 14px; color: #475569; margin-bottom: 16px;">
                            لطفاً موارد زیر را اصلاح کنید:
                        </p>
                        <div style="background: #fef2f2; border-right: 4px solid #dc2626; padding: 12px 16px; border-radius: 8px; text-align: right; max-height: 300px; overflow-y: auto;">
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

  async confirm(options = {}) {
    const swal = this._getSwal();
    if (!swal) {
      return confirm(options.text || "آیا مطمئن هستید؟");
    }

    const defaultOptions = {
      title: "تأیید عملیات",
      text: "آیا از انجام این عملیات اطمینان دارید؟",
      confirmText: "بله",
      cancelText: "انصراف",
      icon: "question",
    };

    const merged = { ...defaultOptions, ...options };

    const result = await swal.fire({
      title: merged.title,
      text: merged.text,
      icon: merged.icon,
      showCancelButton: true,
      confirmButtonColor: "#2c7a6e",
      cancelButtonColor: "#94a3b8",
      confirmButtonText: merged.confirmText,
      cancelButtonText: merged.cancelText,
      reverseButtons: true,
    });

    return result.isConfirmed;
  }

  showLoading(message = "در حال بارگذاری...") {
    const swal = this._getSwal();
    if (swal) {
      swal.fire({
        title: message,
        allowOutsideClick: false,
        showConfirmButton: false,
        willOpen: () => {
          swal.showLoading();
        },
      });
    }
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
