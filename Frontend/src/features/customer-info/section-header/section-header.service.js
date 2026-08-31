import { apiService } from "../../../core/services/api.service.js";
import { API_CONSTANTS } from "../../../core/constants/api.const.js";
import { stateService } from "../../../core/services/state.service.js";
import { notificationService } from "../../../core/services/notification.service.js";

class SectionHeaderService {
  constructor() {
    this.customerId = null;
    this.customerData = null;
    this.stats = null;
    this.weatherData = null;
    this.isLoadingWeather = false;
    this.initialized = false;
  }

  // ============================================
  // ✅ مقداردهی اولیه
  async init() {
    if (this.initialized) return;

    // ✅ دریافت customerId
    this.customerId =
      stateService.getCustomerId() ||
      new URLSearchParams(window.location.search).get("id");

    if (!this.customerId) {
      console.warn("⚠️ شناسه مشتری یافت نشد");
      return;
    }

    console.log("📌 SectionHeaderService customerId:", this.customerId);

    await this.loadHeaderData();
    await this.loadWeatherData();

    this.initialized = true;
    console.log("✅ SectionHeaderService initialized");
  }

  // ============================================
  // ✅ بارگذاری هدر اطلاعات مشتری
  // ============================================
  async loadHeaderData() {
    try {
      const response = await apiService.get(
        `/customer-header/${this.customerId}/header`,
      );

      if (response.success) {
        this.customerData = response.data.customer;
        this.stats = response.data.stats;
        this.fillHeaderInfo(response.data);
        console.log("✅ Header data loaded");
      } else {
        console.warn("⚠️ خطا در دریافت هدر:", response.message);
      }
    } catch (error) {
      console.error("❌ Error loading header:", error);
    }
  }

  // ============================================
  // ✅ پر کردن هدر
  // ============================================
  fillHeaderInfo(data) {
    const { customer, stats } = data;

    // ===== اطلاعات مشتری =====
    const fullNameEl = document.getElementById("customerFullName");
    const codeEl = document.getElementById("customerCode");
    const farmNameEl = document.getElementById("customerFarmName");

    if (fullNameEl) fullNameEl.textContent = customer.full_name || "نامشخص";
    if (codeEl) codeEl.textContent = customer.id || "....";
    if (farmNameEl) farmNameEl.textContent = customer.farm_name || "نامشخص";

    // ===== موقعیت مکانی =====
    const locationEl = document.getElementById("customerLocation");
    if (locationEl) {
      const location = [customer.province, customer.county]
        .filter(Boolean)
        .join("، ");
      locationEl.textContent = location || "نامشخص";
    }

    // ===== وضعیت مشتری =====
    const statusEl = document.querySelector(".customer-status");
    if (statusEl) {
      statusEl.className = customer.active
        ? "customer-status active"
        : "customer-status inactive";
    }

    // ===== آمار =====
    const activeUnitsEl = document.getElementById("activeUnits");
    const totalHallsEl = document.getElementById("totalHalls");
    const activeFlocksEl = document.getElementById("activeFlocks");
    const totalChicksEl = document.getElementById("totalChicks");
    const remainingChicksEl = document.getElementById("remainingChicks");

    if (activeUnitsEl) activeUnitsEl.textContent = stats.activeUnits || 0;
    if (totalHallsEl) totalHallsEl.textContent = stats.totalHalls || 0;
    if (activeFlocksEl) activeFlocksEl.textContent = stats.activeFlocks || 0;
    if (totalChicksEl) totalChicksEl.textContent = stats.totalChicks || 0;
    if (remainingChicksEl) remainingChicksEl.textContent = stats.remainingChicks || 0;

    // ===== اطلاعات متا =====
    this.renderMetaInfo(customer);
  }

  // ============================================
  // ✅ رندر اطلاعات متا
  // ============================================
  renderMetaInfo(customer) {
    let metaInfoEl = document.querySelector(".customer-meta-info");

    if (!metaInfoEl) {
      const detailsEl = document.querySelector(".customer-details");
      if (detailsEl) {
        metaInfoEl = document.createElement("div");
        metaInfoEl.className = "customer-meta-info";
        metaInfoEl.style.cssText = `
                    margin-top: 10px;
                    padding-top: 10px;
                    border-top: 2px solid #eef2f6;
                    font-size: 12px;
                    color: #64748b;
                    display: flex;
                    flex-wrap: wrap;
                    gap: 12px 20px;
                    direction: rtl;
                `;
        detailsEl.appendChild(metaInfoEl);
      }
    }

    if (!metaInfoEl) return;

    const creatorName =
      customer.creator?.full_name || customer.creator?.username || "نامشخص";
    const registeredDate = customer.registered_at_formatted || "نامشخص";
    const isUpdated = customer.is_updated === true;

    let updaterName = "نامشخص";
    let updatedDate = "نامشخص";

    if (isUpdated && customer.updater) {
      updaterName =
        customer.updater.full_name || customer.updater.username || "نامشخص";
      updatedDate = customer.updated_at_formatted || "نامشخص";
    }

    let metaHTML = `
            <div class="meta-item" style="display:flex; align-items:center; gap:4px;">
                <i class="fas fa-user-plus" style="color:#2c7a6e;"></i>
                <span>ثبت‌کننده: <strong>${creatorName}</strong></span>
            </div>
            <div class="meta-item" style="display:flex; align-items:center; gap:4px;">
                <i class="fas fa-calendar-plus" style="color:#2c7a6e;"></i>
                <span>تاریخ ثبت: <strong>${registeredDate}</strong></span>
            </div>
        `;

    if (isUpdated) {
      metaHTML += `
                <div class="meta-item" style="display:flex; align-items:center; gap:4px;">
                    <i class="fas fa-user-edit" style="color:#f59e0b;"></i>
                    <span>آخرین بروزرسانی: <strong>${updaterName}</strong></span>
                </div>
                <div class="meta-item" style="display:flex; align-items:center; gap:4px;">
                    <i class="fas fa-calendar-edit" style="color:#f59e0b;"></i>
                    <span>تاریخ بروزرسانی: <strong>${updatedDate}</strong></span>
                </div>
            `;
    } else {
      metaHTML += `
                <div class="meta-item" style="display:flex; align-items:center; gap:4px; color:#94a3b8;">
                    <i class="fas fa-info-circle"></i>
                    <span>هنوز بروزرسانی نشده است</span>
                </div>
            `;
    }

    metaInfoEl.innerHTML = metaHTML;
  }

  // ============================================
  // ✅ بارگذاری آب و هوا
  // ============================================
  async loadWeatherData() {
    if (this.isLoadingWeather) {
      notificationService.warning("در حال دریافت اطلاعات، لطفاً صبر کنید...");
      return;
    }

    if (!this.customerId) {
      notificationService.error("شناسه مشتری یافت نشد");
      return;
    }

    const token = localStorage.getItem("adminToken");
    if (!token) {
      notificationService.error("لطفاً وارد شوید");
      return;
    }

    this.isLoadingWeather = true;

    // نمایش وضعیت لودینگ
    this.showWeatherState("loading");

    try {
      console.log(`📤 دریافت آب و هوا برای مشتری: ${this.customerId}`);

      const endpoint = API_CONSTANTS.ENDPOINTS.WEATHER.GET.replace(
        ":customerId",
        this.customerId,
      );

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      const result = await Promise.race([
        apiService.get(endpoint),
        new Promise((_, reject) => {
          controller.signal.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
      ]);

      clearTimeout(timeoutId);

      console.log("📥 پاسخ آب و هوا:", result);

      if (result.success && result.data) {
        // بررسی اینکه آیا مختصات پیدا شده یا نه
        if (result.data.debug && !result.data.debug.found) {
          this.showWeatherState(
            "error",
            `شهرستان "${result.data.customer?.county}" در پایگاه داده یافت نشد`,
          );
          return;
        }

        if (!result.data.weather) {
          this.showWeatherState(
            "error",
            result.data.message || "اطلاعات آب و هوا در دسترس نیست",
          );
          return;
        }

        this.weatherData = result.data;
        this.showWeatherState("content", result.data);
        notificationService.success("اطلاعات آب و هوا دریافت شد");
      } else {
        this.showWeatherState(
          "error",
          result.message || "خطا در دریافت اطلاعات",
        );
      }
    } catch (error) {
      if (error.name === "AbortError") {
        console.warn("⏱️ تایم‌اوت");
        this.showWeatherState("error", "مدت زمان درخواست به پایان رسید");
      } else {
        console.error("❌ خطا:", error);
        this.showWeatherState("error", "خطا در دریافت اطلاعات");
      }
    } finally {
      this.isLoadingWeather = false;
    }
  }

  // ============================================
  // ✅ نمایش وضعیت ویجت آب و هوا
  // ============================================
  showWeatherState(state, data = null) {
    const inactiveEl = document.getElementById("weatherInactive");
    const loadingEl = document.getElementById("weatherLoading");
    const contentEl = document.getElementById("weatherContent");
    const errorEl = document.getElementById("weatherError");

    // مخفی کردن همه
    if (inactiveEl) inactiveEl.style.display = "none";
    if (loadingEl) loadingEl.style.display = "none";
    if (contentEl) contentEl.style.display = "none";
    if (errorEl) errorEl.style.display = "none";

    switch (state) {
      case "inactive":
        if (inactiveEl) inactiveEl.style.display = "flex";
        break;

      case "loading":
        if (loadingEl) {
          loadingEl.style.display = "flex";
          const activateBtn = document.querySelector(".weather-activate-btn");
          if (activateBtn) {
            activateBtn.disabled = true;
            activateBtn.innerHTML =
              '<i class="fas fa-spinner fa-spin"></i> در حال دریافت...';
          }
        }
        break;

      case "content":
        if (contentEl) {
          contentEl.style.display = "block";
          if (data) {
            this.updateWeatherContent(data, contentEl);
          }
        }
        break;

      case "error":
        if (errorEl) {
          errorEl.style.display = "flex";
          const message =
            typeof data === "string" ? data : "اطلاعات در دسترس نیست";
          errorEl.innerHTML = `
                        <i class="fas fa-cloud-sun"></i>
                        <span>${message}</span>
                        <button class="retry-btn" onclick="window.loadWeather()">
                            <i class="fas fa-redo"></i> تلاش مجدد
                        </button>
                    `;
        }
        break;
    }
  }

  // ============================================
  // ✅ بروزرسانی محتوای ویجت آب و هوا
  // ============================================
  updateWeatherContent(data, container) {
    if (!data || !data.weather) {
      container.innerHTML = `
                <div class="weather-error" style="display:flex; align-items:center; gap:10px; padding:10px; color:#94a3b8;">
                    <i class="fas fa-cloud-sun"></i>
                    <span>اطلاعات آب و هوا در دسترس نیست</span>
                    <button class="retry-btn" onclick="window.loadWeather()"
                        style="padding:4px 12px; background:#2c7a6e; color:white; border:none; border-radius:6px; cursor:pointer;">
                        <i class="fas fa-redo"></i> تلاش مجدد
                    </button>
                </div>
            `;
      return;
    }

    const weather = data.weather;
    const location = data.location;
    const elevation = data.elevation || null;

    // دریافت وضعیت آب و هوا
    const status = this.getWeatherStatus(weather.current?.weatherCode);
    const temp = weather.current?.temperature;
    const feelsLike = weather.current?.apparent_temperature;
    const humidity = weather.current?.humidity;
    const windSpeed = weather.current?.windSpeed;

    container.innerHTML = `
            <div class="weather-widget">
                <button class="weather-refresh-btn" onclick="window.loadWeather()" title="بروزرسانی">
                    <i class="fas fa-sync-alt"></i>
                </button>

                <div class="weather-main">
                    <div class="weather-icon" style="background: ${status.bg}; color: ${status.color}">
                        <i class="fas ${status.icon}"></i>
                    </div>
                    <div class="weather-info">
                        <div class="weather-temp-row">
                            <span class="temp-value">${temp !== undefined && temp !== null ? Math.round(temp) : "--"}</span>
                            <span class="temp-unit">°C</span>
                            <span class="temp-status">${status.text}</span>
                        </div>
                        ${feelsLike ? `<div class="weather-feels-like">🌡️ احساس: ${Math.round(feelsLike)}°C</div>` : ""}
                    </div>
                </div>

                <div class="weather-grid">
                    <div class="weather-grid-item">
                        <i class="fas fa-tint"></i>
                        <span class="grid-value">${humidity !== undefined && humidity !== null ? Math.round(humidity) : "--"}%</span>
                        <span class="grid-label">رطوبت</span>
                    </div>
                    <div class="weather-grid-item">
                        <i class="fas fa-wind"></i>
                        <span class="grid-value">${windSpeed !== undefined && windSpeed !== null ? Math.round(windSpeed) : "--"}</span>
                        <span class="grid-label">باد (km/h)</span>
                    </div>
                    <div class="weather-grid-item">
                        <i class="fas fa-mountain"></i>
                        <span class="grid-value">${elevation ? Math.round(elevation) : "--"}</span>
                        <span class="grid-label">ارتفاع (m)</span>
                    </div>
                </div>

                <div class="weather-footer">
                    <div class="weather-location">
                        <i class="fas fa-map-marker-alt"></i>
                        <span>${location?.city || "نامشخص"}${location?.state ? `، ${location.state}` : ""}</span>
                    </div>
                    <div class="update-time">
                        <i class="fas fa-clock"></i>
                        <span>${new Intl.DateTimeFormat("fa-IR", { hour: "2-digit", minute: "2-digit" }).format(new Date())}</span>
                    </div>
                </div>
            </div>
        `;
  }

  // ============================================
  // ✅ دریافت وضعیت آب و هوا بر اساس کد
  // ============================================
  getWeatherStatus(code) {
    const map = {
      0: { icon: "fa-sun", text: "آفتابی", color: "#f59e0b", bg: "#fef3c7" },
      1: {
        icon: "fa-cloud-sun",
        text: "نیمه ابری",
        color: "#fbbf24",
        bg: "#fef3c7",
      },
      2: { icon: "fa-cloud", text: "ابری", color: "#94a3b8", bg: "#f1f5f9" },
      3: { icon: "fa-cloud", text: "ابری", color: "#94a3b8", bg: "#f1f5f9" },
      45: { icon: "fa-smog", text: "مه‌آلود", color: "#94a3b8", bg: "#f1f5f9" },
      48: { icon: "fa-smog", text: "مه‌آلود", color: "#94a3b8", bg: "#f1f5f9" },
      51: {
        icon: "fa-cloud-rain",
        text: "باران ملایم",
        color: "#60a5fa",
        bg: "#dbeafe",
      },
      53: {
        icon: "fa-cloud-rain",
        text: "باران",
        color: "#60a5fa",
        bg: "#dbeafe",
      },
      55: {
        icon: "fa-cloud-showers-heavy",
        text: "باران سنگین",
        color: "#3b82f6",
        bg: "#dbeafe",
      },
      61: {
        icon: "fa-cloud-rain",
        text: "باران ملایم",
        color: "#60a5fa",
        bg: "#dbeafe",
      },
      63: {
        icon: "fa-cloud-rain",
        text: "باران",
        color: "#60a5fa",
        bg: "#dbeafe",
      },
      65: {
        icon: "fa-cloud-showers-heavy",
        text: "باران سنگین",
        color: "#3b82f6",
        bg: "#dbeafe",
      },
      71: {
        icon: "fa-snowflake",
        text: "برف",
        color: "#93c5fd",
        bg: "#dbeafe",
      },
      73: {
        icon: "fa-snowflake",
        text: "برف",
        color: "#93c5fd",
        bg: "#dbeafe",
      },
      75: {
        icon: "fa-snowflake",
        text: "برف سنگین",
        color: "#93c5fd",
        bg: "#dbeafe",
      },
      80: {
        icon: "fa-cloud-rain",
        text: "رگبار",
        color: "#60a5fa",
        bg: "#dbeafe",
      },
      81: {
        icon: "fa-cloud-rain",
        text: "رگبار",
        color: "#60a5fa",
        bg: "#dbeafe",
      },
      82: {
        icon: "fa-cloud-showers-heavy",
        text: "رگبار سنگین",
        color: "#3b82f6",
        bg: "#dbeafe",
      },
      95: { icon: "fa-bolt", text: "طوفان", color: "#7c3aed", bg: "#ede9fe" },
      96: { icon: "fa-bolt", text: "طوفان", color: "#7c3aed", bg: "#ede9fe" },
      99: { icon: "fa-bolt", text: "طوفان", color: "#7c3aed", bg: "#ede9fe" },
    };
    return (
      map[code] || {
        icon: "fa-cloud",
        text: "متغیر",
        color: "#94a3b8",
        bg: "#f1f5f9",
      }
    );
  }

  // ============================================
  // ✅ رفرش هدر
  // ============================================
  refresh() {
    this.loadHeaderData();
    this.loadWeatherData();
  }
}

// ============================================
// ✅ Export
// ============================================
export const sectionHeaderService = new SectionHeaderService();

// ============================================
// ✅ قرار دادن در window
// ============================================
if (typeof window !== "undefined") {
  window.sectionHeaderService = sectionHeaderService;
  window.loadWeather = () => sectionHeaderService.loadWeatherData();
  window.refreshHeader = () => sectionHeaderService.refresh();
}
