// ============================================================
// weekly.window-glue.js
// «چسب پنجره» هفتگی — نگاشت نام‌های سراسری HTML (onclick) به سرویس
// ------------------------------------------------------------
// چرا جدا شد؟ این بلوک ۱۹ خط انتهای weekly.service.js را می‌گرفت،
// اما هیچ منطق دامنه‌ای ندارد؛ فقط window.<name> را به متدهای WeeklyService وصل می‌کند.
// ✅ سطح عمومی تغییر نکرده: همان ۱۵ نام window.* با همان ترتیب و رفتار ثبت می‌شوند.
// ⚠️ باید «بعد از» ساخته‌شدن نمونهٔ سرویس اجرا شود؛ به همین دلیل به شکل تابع ثبت
//    صادر شده و در انتهای weekly.service.js فراخوانی می‌شود (موج ۳.۲b).
// ============================================================

export const registerWeeklyWindowGlue = ({
  weeklyService,
  WeeklyService,
}) => {
  if (typeof window === "undefined") return;

  window.weeklyService = weeklyService;
  window.WeeklyService = WeeklyService;
  window.refreshWeeksDisplay = () => weeklyService.loadFlocks();
  window.resetWeeksCache = () => weeklyService.resetCache();
  window.openAllWeeks = () => weeklyService.openAllWeeks();
  window.closeAllWeeks = () => weeklyService.closeAllWeeks();
  window.generateFullWeeklyReport = () => weeklyService.generateFullReport();
  window.generateWeeklyHistoryReport = () =>
    weeklyService.generateWeeklyHistoryReport();
  window.generateFlockReport = (flockId) => weeklyService.generateFlockReport(flockId);
  window.saveWeekFromForm = (btn) => weeklyService.saveWeek(btn);
  window.resetWeekForm = (btn) => weeklyService.resetWeekForm?.(btn);
  window.deleteWeekFromForm = (id) => weeklyService.deleteWeek(id);
  window.toggleWeekAccordion = (header) => weeklyService.toggleWeek(header);
  window.toggleFlockCard = (header) => weeklyService.toggleFlock?.(header);
  window.showMoreWeeks = (btn, flockId) =>
    weeklyService.showMoreWeeks(btn, flockId);
};
