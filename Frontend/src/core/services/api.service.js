import { API_CONSTANTS } from "./../constants/api.const.js";
import { CacheService } from "./cache.service.js";

class ApiService {
  constructor() {
    this.timeout = API_CONSTANTS.TIMEOUT;
    this.retryCount = API_CONSTANTS.RETRY_COUNT;
    this.cache = new CacheService();
    this.isRedirectingToLogin = false;
  }

  // ===== پاک‌سازی نشست منقضی/نامعتبر =====
  // وقتی توکن 401 می‌گیرد، اطلاعات لاگین پاک و کاربر به صفحه ورود هدایت می‌شود
  handleUnauthorized() {
    // پاک‌سازی تمام کلیدهای لاگین از localStorage
    localStorage.removeItem("adminToken");
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    sessionStorage.clear();

    // جلوگیری از هدایت مکرر (چند درخواست هم‌زمان ممکن است 401 بدهند)
    if (!this.isRedirectingToLogin) {
      this.isRedirectingToLogin = true;
      const currentPath = window.location.pathname;
      if (!currentPath.includes("/login") && !currentPath.includes("/index")) {
        // ✅ نشانهٔ «انقضای نشست» برای صفحهٔ ورود (یکبارمصرف)
        // بدون این، کاربر بی‌صدا به صفحهٔ ورود پرت می‌شد و نمی‌فهمید چرا.
        try {
          sessionStorage.setItem("skb_session_expired", "1");
        } catch {
          /* دسترسی به sessionStorage ممکن نیست — بی‌صدا رد شو */
        }
        window.location.href = "/login";
      }
      // بعد از ۲ ثانیه دوباره اجازه هدایت داده می‌شود
      setTimeout(() => {
        this.isRedirectingToLogin = false;
      }, 2000);
    }
  }

  // ✅ baseURL بهصورت پویا مقدار میگیرد (در هر درخواست، از CONFIG لحظهای
  // بر اساس hostname مرورگر محاسبه میشود — لوکال یا سرور)
  get baseURL() {
    return (
      window.CONFIG?.API_BASE_URL ||
      API_CONSTANTS.BASE_URL ||
      "http://localhost:5000/api"
    );
  }

  getToken() {
    return localStorage.getItem("adminToken");
  }

  getHeaders() {
    const token = this.getToken();
    return {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  getFormDataHeaders() {
    const token = this.getToken();
    return {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  async request(endpoint, options = {}) {
    const url = endpoint.startsWith("http")
      ? endpoint
      : `${this.baseURL}${endpoint}`;

    const config = {
      headers: this.getHeaders(),
      ...options,
    };

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 401) {
          this.handleUnauthorized();
        }
        if (response.status === 403) {
          this.notifyPermissionDenied(endpoint, errorData);
        }
        // ✅ ۵۰۲ = بکاند در دسترس نیست (پروکسی فرانت این پرچم را می‌دهد)
        if (response.status === 502 && errorData.serverUnavailable === true) {
          this.notifyServerUnavailable(endpoint);
        }
        throw new Error(
          errorData.message || `HTTP error! status: ${response.status}`,
        );
      }

      return await response.json();
    } catch (error) {
      console.error("❌ API Request failed:", error);
      throw this.toRequestError(error, endpoint);
    }
  }

  // ============================================================
  // ✅ دانلود فایل با هدر احراز هویت (فاز ۱۳.۴ — پورتال مشتری)
  // ------------------------------------------------------------
  // چرا متد جدا؟ پاسخ این درخواست «فایل» است نه JSON، پس request()
  // کار نمی‌کند. هدرها از getFormDataHeaders() می‌آید (توکن Bearer،
  // بدون Content-Type) ⇒ فایل هیچ‌وقت با لینک عمومی سرو نمی‌شود و
  // فقط کاربر دارای مجوز می‌تواند آن را بگیرد.
  // ============================================================
  async download(endpoint, fallbackName = "download") {
    const url = endpoint.startsWith("http")
      ? endpoint
      : `${this.baseURL}${endpoint}`;

    const response = await fetch(url, { headers: this.getFormDataHeaders() });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (response.status === 401) this.handleUnauthorized();
      if (response.status === 403) {
        this.notifyPermissionDenied(endpoint, errorData);
      }
      throw new Error(
        errorData.message || `HTTP error! status: ${response.status}`,
      );
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const fileName =
      this.fileNameFromDisposition(
        response.headers.get("content-disposition"),
      ) || fallbackName;

    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);

    return fileName;
  }

  // نام فایل از هدر Content-Disposition (پشتیبانی از UTF-8 / RFC 5987)
  fileNameFromDisposition(header) {
    const value = String(header || "");
    if (!value) return "";

    const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(value);
    if (utf8) {
      try {
        return decodeURIComponent(utf8[1].trim());
      } catch {
        return "";
      }
    }

    const plain = /filename="?([^";]+)"?/i.exec(value);
    return plain ? plain[1].trim() : "";
  }

  // ============================================================
  // ✅ ۴۰۳ = نبود مجوز ⇒ پیام قابل‌فهم به کاربر + هم‌راستاسازی UI
  // ------------------------------------------------------------
  // • پیام دقیق («دسترسی «حذف سالن» برای نقش شما بسته است»)
  // • سپس مجوزها تازه و گیت‌ها دوباره اعمال می‌شوند
  // • اگر خود درخواست مجوزها (‏/permissions/me) ۴۰۳ بدهد، اقدامی نمی‌کنیم
  //   تا حلقهٔ تازه‌سازی ایجاد نشود
  // ============================================================
  notifyPermissionDenied(endpoint, errorData) {
    if (!errorData || errorData.permissionDenied !== true) return;
    if (String(endpoint || "").includes("/permissions/me")) return;

    import("./permission.service.js")
      .then(({ permissionService }) =>
        permissionService.handleForbidden(errorData),
      )
      .catch(() => {
        /* بی‌صدا */
      });
  }

  // ============================================================
  // ✅ «سرور در دسترس نیست» (بک‌اند خواب) ⇒ پیام یک‌باره و ضدنکرار
  // ------------------------------------------------------------
  // پروکسی فرانت هنگام شکست ارتباط با بک‌اند، ۵۰۲ با پرچم
  // serverUnavailable=true برمی‌گرداند؛ اینجا فقط یک توست کوچک
  // به کاربر نشان می‌دهیم (با سقف نرخ) تا دلیل خطا روشن باشد.
  // ============================================================
  notifyServerUnavailable(endpoint) {
    if (String(endpoint || "").includes("/permissions/me")) return;

    import("./notification.service.js")
      .then(({ notificationService }) =>
        notificationService.notifyOnce({
          key: "server-unavailable",
          message:
            "⚠️ ارتباط با سرور برقرار نشد. لطفاً از اجرا بودن بک‌اند مطمئن شوید.",
          type: "error",
          cooldownMs: 30000,
          maxPerMinute: 3,
        }),
      )
      .catch(() => {
        /* بی‌صدا */
      });
  }

  // ============================================================
  // ✅ موج ۱۳.۲۴ — خطای «شبکه» از پاسخ HTTP ناموفق جدا می‌شود
  // ------------------------------------------------------------
  // fetch وقتی اصلاً به سرور نرسد TypeError با پیام «Failed to fetch»
  // / «NetworkError» / «Load failed» می‌دهد (بسته به مرورگر).
  // پاسخ‌های ۴xx/۵xx خطای شبکه نیستند و همین‌جا پیچیده نمی‌شوند.
  // ============================================================
  isNetworkError(error) {
    if (!error) return false;
    if (error.isNetworkError === true) return true;
    const name = String(error.name || "");
    if (name === "AbortError") return false;
    if (name === "TypeError") return true;
    const message = String(error.message || "");
    return /failed to fetch|network ?error|load failed|fetch failed|err_connection/i.test(
      message,
    );
  }

  // خطای نهاییِ قابل نمایش به کاربر: پیام فارسی + پرچم‌های قابل بررسی
  toRequestError(error, endpoint) {
    if (!this.isNetworkError(error)) return error;

    // یک توست کوچک (ضدنکرار) تا دلیل خطا روشن باشد
    this.notifyServerUnavailable(endpoint);

    const wrapped = new Error(
      "ارتباط با سرور برقرار نشد. اتصال شبکه و اجرا بودن سرور را بررسی کنید.",
    );
    wrapped.cause = error;
    wrapped.isNetworkError = true;
    wrapped.serverUnavailable = true;
    return wrapped;
  }

  async get(endpoint, params = {}) {
    const target = endpoint.startsWith("http")
      ? endpoint
      : `${this.baseURL}${endpoint}`;

    // ✅ پشتیبانی از آدرس نسبی (مثل /api/...) با base گرفتن از آدرس فعلی صفحه
    // (قبلاً new URL با آدرس نسبی خطای Invalid URL می‌داد)
    const base =
      typeof window !== "undefined" ? window.location.href : undefined;
    const url = new URL(target, base);
    Object.keys(params).forEach((key) => {
      if (
        params[key] !== undefined &&
        params[key] !== null &&
        params[key] !== ""
      ) {
        url.searchParams.append(key, params[key]);
      }
    });
    return this.request(url.toString(), { method: "GET" });
  }

  async post(endpoint, data) {
    return this.request(endpoint, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async put(endpoint, data) {
    return this.request(endpoint, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async patch(endpoint, data) {
    return this.request(endpoint, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async delete(endpoint) {
    return this.request(endpoint, { method: "DELETE" });
  }

  /**
   * ارسال FormData با پشتیبانی از نوار پیشرفت آپلود
   * @param {string} endpoint
   * @param {FormData} formData
   * @param {Function} [onProgress] - callback درصد پیشرفت (0 تا 100)
   */
  uploadFormData(endpoint, formData, onProgress = null) {
    const url = endpoint.startsWith("http")
      ? endpoint
      : `${this.baseURL}${endpoint}`;

    const token = this.getToken();

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.open("POST", url, true);
      if (token) {
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      }

      // نوار پیشرفت
      if (onProgress && xhr.upload) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            onProgress(percent);
          }
        };
      }

      xhr.onload = () => {
        try {
          const data = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(data);
          } else {
            reject(
              new Error(data.message || `HTTP error! status: ${xhr.status}`),
            );
          }
        } catch (e) {
          reject(new Error("پاسخ نامعتبر از سرور دریافت شد"));
        }
      };

      xhr.onerror = () => {
        reject(new Error("خطا در ارتباط با سرور"));
      };

      xhr.send(formData);
    });
  }

  async postFormData(endpoint, formData, onProgress = null) {
    // اگر callback پیشرفت داده شده بود از XHR استفاده کن
    if (onProgress) {
      return this.uploadFormData(endpoint, formData, onProgress);
    }

    const url = endpoint.startsWith("http")
      ? endpoint
      : `${this.baseURL}${endpoint}`;

    const config = {
      method: "POST",
      headers: this.getFormDataHeaders(),
      body: formData,
    };

    try {
      const response = await fetch(url, config);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 401) {
          this.handleUnauthorized();
        }
        if (response.status === 403) {
          this.notifyPermissionDenied(endpoint, errorData);
        }
        if (response.status === 502 && errorData.serverUnavailable === true) {
          this.notifyServerUnavailable(endpoint);
        }
        throw new Error(
          errorData.message || `HTTP error! status: ${response.status}`,
        );
      }
      return await response.json();
    } catch (error) {
      console.error("❌ API Request failed:", error);
      throw this.toRequestError(error, endpoint);
    }
  }

  async putFormData(endpoint, formData, onProgress = null) {
    // اگر callback پیشرفت داده شده بود از XHR استفاده کن
    if (onProgress) {
      const url = endpoint.startsWith("http")
        ? endpoint
        : `${this.baseURL}${endpoint}`;

      const token = this.getToken();

      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.open("PUT", url, true);
        if (token) {
          xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        }

        if (onProgress && xhr.upload) {
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const percent = Math.round((e.loaded / e.total) * 100);
              onProgress(percent);
            }
          };
        }

        xhr.onload = () => {
          try {
            const data = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(data);
            } else {
              reject(
                new Error(data.message || `HTTP error! status: ${xhr.status}`),
              );
            }
          } catch (e) {
            reject(new Error("پاسخ نامعتبر از سرور دریافت شد"));
          }
        };

        xhr.onerror = () => {
          reject(new Error("خطا در ارتباط با سرور"));
        };

        xhr.send(formData);
      });
    }

    const url = endpoint.startsWith("http")
      ? endpoint
      : `${this.baseURL}${endpoint}`;

    const config = {
      method: "PUT",
      headers: this.getFormDataHeaders(),
      body: formData,
    };

    try {
      const response = await fetch(url, config);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 401) {
          this.handleUnauthorized();
        }
        if (response.status === 403) {
          this.notifyPermissionDenied(endpoint, errorData);
        }
        if (response.status === 502 && errorData.serverUnavailable === true) {
          this.notifyServerUnavailable(endpoint);
        }
        throw new Error(
          errorData.message || `HTTP error! status: ${response.status}`,
        );
      }
      return await response.json();
    } catch (error) {
      console.error("❌ API Request failed:", error);
      throw this.toRequestError(error, endpoint);
    }
  }
}

export const apiService = new ApiService();
