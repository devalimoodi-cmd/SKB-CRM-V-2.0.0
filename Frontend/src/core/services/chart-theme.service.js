// ============================================================
// core/services/chart-theme.service.js
// «تم نمودارها» — هماهنگ‌سازی Chart.js با تم روشن/تیره
// ------------------------------------------------------------
// • مقادیر رنگ را از توکن‌های CSS زندهٔ سایت می‌خواند (getComputedStyle)
// • Chart.defaults را به‌روز می‌کند (رنگ متن/خطوط) و روی تغییر تم
//   رویداد «theme:changed» را منتشر می‌کند تا نمودارها در صورت نیاز
//   دوباره رندر شوند.
// ============================================================
import { themeService } from "./theme.service.js";

const readToken = (name, fallback) => {
  if (typeof document === "undefined" || typeof getComputedStyle === "undefined") {
    return fallback;
  }
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return value || fallback;
};

export const chartThemeService = {
  _bound: false,

  // توکن‌های لازم برای پیکربندی نمودارها
  tokens() {
    return {
      text: readToken("--text-gray", "#64748b"),
      strong: readToken("--text-dark", "#1e293b"),
      grid: readToken("--border-color", "#e2e8f0"),
      surface: readToken("--bg-surface", "#ffffff"),
      primary: readToken("--primary", "#2c7a6e"),
    };
  },

  // اعمال پیش‌فرض‌های Chart.js
  apply() {
    if (typeof window === "undefined" || !window.Chart) return false;
    const Chart = window.Chart;
    const t = this.tokens();

    Chart.defaults.color = t.text;
    Chart.defaults.borderColor = t.grid;
    if (Chart.defaults.font) {
      Chart.defaults.font.family = "Vazir, Tahoma, Arial, sans-serif";
    }
    if (Chart.defaults.plugins?.legend?.labels) {
      Chart.defaults.plugins.legend.labels.color = t.strong;
    }
    if (Chart.defaults.plugins?.tooltip) {
      Chart.defaults.plugins.tooltip.backgroundColor = t.surface;
      Chart.defaults.plugins.tooltip.titleColor = t.strong;
      Chart.defaults.plugins.tooltip.bodyColor = t.text;
      Chart.defaults.plugins.tooltip.borderColor = t.grid;
    }
    return true;
  },

  // راه‌اندازی + اتصال به تغییر تم
  init() {
    this.apply();
    if (this._bound) return;
    this._bound = true;
    themeService.onChange(() => {
      this.apply();
      // صفحه‌ها می‌توانند به این رویداد گوش دهند و نمودارها را دوباره بسازند
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("theme:changed"));
      }
    });
  },
};

if (typeof window !== "undefined") {
  window.chartThemeService = chartThemeService;
}
