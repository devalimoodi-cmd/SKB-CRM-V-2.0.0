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
        throw new Error(
          errorData.message || `HTTP error! status: ${response.status}`,
        );
      }

      return await response.json();
    } catch (error) {
      console.error("❌ API Request failed:", error);
      throw error;
    }
  }

  async get(endpoint, params = {}) {
    const url = new URL(
      endpoint.startsWith("http") ? endpoint : `${this.baseURL}${endpoint}`,
    );
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
        throw new Error(
          errorData.message || `HTTP error! status: ${response.status}`,
        );
      }
      return await response.json();
    } catch (error) {
      console.error("❌ API Request failed:", error);
      throw error;
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
        throw new Error(
          errorData.message || `HTTP error! status: ${response.status}`,
        );
      }
      return await response.json();
    } catch (error) {
      console.error("❌ API Request failed:", error);
      throw error;
    }
  }
}

export const apiService = new ApiService();
