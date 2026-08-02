import { chartDashboardApi } from "./chart-dashboard.api.js";
import { chartDashboardRenderer } from "./chart-dashboard.renderer.js";
import { notificationService } from "../../../../core/services/notification.service.js";
import { stateService } from "../../../../core/services/state.service.js";
import {
  toNumber,
  average,
  max,
  min,
} from "../../../../core/utils/number.utils.js";

class ChartDashboardService {
  constructor() {
    this.customerId = null;
    this.flocks = [];
    this.currentFlockId = null;
    this.chartInstances = {};
    this.initialized = false;
    this.accordionState = {};
  }

  async init(customerId) {
    // ✅ اگر customerId ارسال نشد، از state بگیر
    this.customerId =
      customerId ||
      stateService.getCustomerId() ||
      new URLSearchParams(window.location.search).get("id");

    if (!this.customerId) {
      notificationService.error("شناسه مشتری یافت نشد");
      return;
    }

    console.log("📌 ChartDashboardService customerId:", this.customerId);

    await this.loadData();
    this.setupAccordionControls();
    this.loadAccordionState();
    this.initialized = true;
    console.log("✅ ChartDashboardService initialized");
  }

  async loadData() {
    try {
      // دریافت گله‌ها
      const flocksRes = await chartDashboardApi.getFlocks(this.customerId);
      if (flocksRes.success) {
        this.flocks = flocksRes.data.placements || [];
        stateService.setFlocks(this.flocks);
      }

      // دریافت داده‌های نمودارها
      const chartsRes = await chartDashboardApi.getChartsData(this.customerId);
      if (chartsRes.success && chartsRes.data.flocks) {
        this.chartsData = chartsRes.data;
        this.renderCharts(chartsRes.data);
      }

      // دریافت خلاصه آماری
      const summaryRes = await chartDashboardApi.getSummary(this.customerId);
      if (summaryRes.success) {
        this.renderSummary(summaryRes.data);
      }
    } catch (error) {
      console.error("❌ Error loading chart data:", error);
      notificationService.error("خطا در دریافت داده‌های نمودارها");
    }
  }

  renderCharts(data) {
    const flocks = data.flocks || [];
    if (flocks.length === 0) {
      this.showEmptyState();
      return;
    }

    // رندر آکاردئون‌ها
    chartDashboardRenderer.renderAccordionItems(flocks);

    // ساخت نمودارها
    flocks.forEach((flock, index) => {
      setTimeout(
        () => {
          this.initChartsForFlock(flock, index);
        },
        200 * (index + 1),
      );
    });
  }

  initChartsForFlock(flock, index) {
    const item = document.querySelector(
      `.skb-charts-accordion-item[data-flock-id="${flock.id}"]`,
    );
    if (!item) return;

    // بررسی اینکه آیا قبلاً ساخته شده
    if (item.dataset.chartsInitialized === "true") return;

    const canvases = item.querySelectorAll("canvas");
    canvases.forEach((canvas) => {
      if (canvas.id && !this.chartInstances[canvas.id]) {
        const config = chartDashboardRenderer.getChartConfig(canvas.id, flock);
        if (config) {
          const ctx = canvas.getContext("2d");
          this.chartInstances[canvas.id] = new Chart(ctx, config);
        }
      }
    });

    item.dataset.chartsInitialized = "true";
  }

  renderSummary(data) {
    chartDashboardRenderer.renderSummary(data);
  }

  showEmptyState() {
    const container = document.querySelector(".skb-charts-container");
    if (container) {
      container.innerHTML = `
                <div class="charts-empty-state">
                    <i class="fas fa-chart-bar"></i>
                    <h4>هیچ داده‌ای برای نمایش وجود ندارد</h4>
                    <p>برای مشاهده نمودارها، ابتدا یک گله ثبت کنید</p>
                </div>
            `;
    }
  }

  // ===== مدیریت آکاردئون =====

  setupAccordionControls() {
    // دکمه باز کردن همه
    const openAllBtn = document.querySelector(
      ".accordion-control-btn.btn-expand",
    );
    if (openAllBtn) {
      openAllBtn.addEventListener("click", () => this.openAllAccordion());
    }

    // دکمه بستن همه
    const closeAllBtn = document.querySelector(
      ".accordion-control-btn.btn-collapse",
    );
    if (closeAllBtn) {
      closeAllBtn.addEventListener("click", () => this.closeAllAccordion());
    }

    // رویداد کلیک روی هدرهای آکاردئون (Event Delegation)
    document.addEventListener("click", (e) => {
      const header = e.target.closest(".skb-charts-accordion-header");
      if (header) {
        this.toggleAccordion(header);
      }
    });
  }

  toggleAccordion(header) {
    const item = header.closest(".skb-charts-accordion-item");
    if (!item) return;

    const wasOpen = item.classList.contains("open");
    const body = item.querySelector(".skb-charts-accordion-body");
    const icon = header.querySelector(".accordion-icon");

    if (wasOpen) {
      item.classList.remove("open");
      header.classList.remove("open");
      if (body) {
        body.classList.remove("open");
        body.style.display = "none";
      }
      if (icon) icon.style.transform = "rotate(0deg)";
    } else {
      item.classList.add("open");
      header.classList.add("open");
      if (body) {
        body.classList.add("open");
        body.style.display = "block";
      }
      if (icon) icon.style.transform = "rotate(180deg)";

      // ساخت نمودارها با تاخیر
      const flockId = item.dataset.flockId;
      const flock = this.flocks.find((f) => f.id == flockId);
      if (flock) {
        setTimeout(() => {
          this.initChartsForFlock(flock, 0);
        }, 150);
      }
    }

    this.saveAccordionState();
  }

  openAllAccordion() {
    const items = document.querySelectorAll(".skb-charts-accordion-item");
    items.forEach((item) => {
      if (!item.classList.contains("open")) {
        const header = item.querySelector(".skb-charts-accordion-header");
        if (header) this.toggleAccordion(header);
      }
    });
  }

  closeAllAccordion() {
    const items = document.querySelectorAll(".skb-charts-accordion-item");
    items.forEach((item) => {
      if (item.classList.contains("open")) {
        const header = item.querySelector(".skb-charts-accordion-header");
        if (header) this.toggleAccordion(header);
      }
    });
  }

  openAccordionItem(index) {
    const items = document.querySelectorAll(".skb-charts-accordion-item");
    if (items[index] && !items[index].classList.contains("open")) {
      const header = items[index].querySelector(".skb-charts-accordion-header");
      if (header) this.toggleAccordion(header);
    }
  }

  saveAccordionState() {
    const items = document.querySelectorAll(".skb-charts-accordion-item");
    const state = Array.from(items).map((item) =>
      item.classList.contains("open"),
    );
    localStorage.setItem("chartAccordionState", JSON.stringify(state));
  }

  loadAccordionState() {
    const saved = localStorage.getItem("chartAccordionState");
    if (saved) {
      try {
        const state = JSON.parse(saved);
        const items = document.querySelectorAll(".skb-charts-accordion-item");
        items.forEach((item, index) => {
          if (state[index] && !item.classList.contains("open")) {
            const header = item.querySelector(".skb-charts-accordion-header");
            if (header) {
              // فقط باز کن بدون تریگر رویداد
              item.classList.add("open");
              header.classList.add("open");
              const body = item.querySelector(".skb-charts-accordion-body");
              const icon = header.querySelector(".accordion-icon");
              if (body) {
                body.classList.add("open");
                body.style.display = "block";
              }
              if (icon) icon.style.transform = "rotate(180deg)";
            }
          }
        });
      } catch (e) {
        console.warn("⚠️ Error loading accordion state:", e);
      }
    }
  }

  // ===== بروزرسانی نمودارها با داده‌های جدید =====

  async updateChartsForFlock(flockId) {
    try {
      const data = await chartDashboardApi.getChartsData(
        this.customerId,
        flockId,
      );
      if (data.success && data.data.flocks) {
        const flockData = data.data.flocks[0];
        if (flockData) {
          this.updateChartData(flockData);
        }
      }
    } catch (error) {
      console.error("❌ Error updating charts:", error);
    }
  }

  updateChartData(flockData) {
    // بروزرسانی هر نمودار با داده‌های جدید
    const chartTypes = [
      "weightTrendChart",
      "totalFeedTrendChart",
      "mortalityRateChart",
      "feedTypeChart",
    ];

    chartTypes.forEach((chartId) => {
      if (this.chartInstances[chartId]) {
        const chart = this.chartInstances[chartId];
        const dataKey = this.getDataKeyForChart(chartId);
        if (flockData.data && flockData.data[dataKey]) {
          chart.data.datasets[0].data = flockData.data[dataKey];
          chart.update();
        }
      }
    });

    // بروزرسانی آمار
    if (flockData.summary) {
      this.renderSummary(flockData.summary);
    }
  }

  getDataKeyForChart(chartId) {
    const map = {
      weightTrendChart: "weighting",
      totalFeedTrendChart: "feed",
      mortalityRateChart: "loss",
      feedTypeChart: "feedTypes",
    };
    return map[chartId] || chartId;
  }

  // ===== ابزارهای کمکی =====

  getFlocks() {
    return this.flocks;
  }

  getCurrentFlock() {
    return this.flocks.find((f) => f.id == this.currentFlockId) || null;
  }

  refresh() {
    // حذف نمودارهای موجود
    Object.keys(this.chartInstances).forEach((key) => {
      if (this.chartInstances[key]) {
        this.chartInstances[key].destroy();
        delete this.chartInstances[key];
      }
    });

    // بارگذاری مجدد
    this.loadData();
  }

  destroy() {
    Object.keys(this.chartInstances).forEach((key) => {
      if (this.chartInstances[key]) {
        this.chartInstances[key].destroy();
        delete this.chartInstances[key];
      }
    });
  }
}

export const chartDashboardService = new ChartDashboardService();
if (typeof window !== "undefined") {
  window.chartDashboardService = chartDashboardService;
  window.ChartDashboardService = ChartDashboardService;
  window.loadAccordionState = () => chartDashboardService.loadAccordionState();
  window.openAllAccordion = () => chartDashboardService.openAllAccordion();
  window.closeAllAccordion = () => chartDashboardService.closeAllAccordion();
}
