// ============================================================
// dashboard.window-glue.js
// «چسب پنجره» داشبورد — نگاشت نام‌های سراسری HTML (onclick) به سرویس
// ------------------------------------------------------------
// چرا جدا شد؟ این بلوک ۱۲۳ خط انتهای dashboard.service.js را می‌گرفت، اما هیچ
// منطق دامنه‌ای ندارد؛ فقط window.<name> را به متدهای DashboardService وصل می‌کند.
// ✅ سطح عمومی تغییر نکرده: همان ۲۴ نام window.* با همان ترتیب و رفتار ثبت می‌شوند.
// ⚠️ باید «بعد از» ساخته‌شدن نمونهٔ سرویس اجرا شود؛ به همین دلیل به شکل تابع ثبت
//    صادر شده و در انتهای dashboard.service.js فراخوانی می‌شود (موج ۳.۲).
// ============================================================

export const registerDashboardWindowGlue = ({
  dashboardService,
  DashboardService,
}) => {
  if (typeof window === "undefined") return;

  window.dashboardService = dashboardService;
  window.DashboardService = DashboardService;
  window.showCreateBookmarkModal = (bookmarkId = null) =>
    dashboardService.showCreateBookmarkModal(bookmarkId);
  window.deleteBookmarkAction = (id) => dashboardService.deleteBookmark(id);
  window.showBookmarkDetail = (id) => dashboardService.showBookmarkDetail(id);
  window.showCustomerDetail = (customerId, flockId) =>
    dashboardService.showCustomerDetail(customerId, flockId);
  // ✅ مودال جزئیات مشتری: تب گله‌ها + نمایش تنبل جدول هفته‌ها
  window.switchCustomerDetailTab = (tabId) =>
    dashboardService.switchCustomerDetailTab(tabId);
  window.toggleCustomerDetailWeeks = (button) =>
    dashboardService.toggleCustomerDetailWeeks(button);
  // ✅ رفتن به پروفایل کامل مشتری از داخل مودال جزئیات
  window.openCustomerDetailProfile = () => {
    const customerId = dashboardService.customerDetailContext?.customerId;
    if (customerId) window.goToCustomerProfile(customerId);
  };
  window.goToCustomerProfile = (customerId) =>
    dashboardService.goToCustomerProfile(customerId);
  window.sendFlockCardSms = (flockId, hallId = null) =>
    dashboardService.sendFlockCardSms(flockId, hallId);
  window.selectFlockGroupForChart = (
    customerId,
    flockGroupId,
    customerName,
    flockNumber,
    weekNumber,
  ) =>
    dashboardService.selectFlockGroupForChart(
      customerId,
      flockGroupId,
      customerName,
      flockNumber,
      weekNumber,
    );
  window.selectFlockForChart = (
    customerId,
    flockId,
    customerName,
    flockNumber,
    weekNumber,
    hallName = null,
    flockGroupId = null,
  ) =>
    dashboardService.selectFlockForChart(
      customerId,
      flockId,
      customerName,
      flockNumber,
      weekNumber,
      hallName,
      flockGroupId,
    );
  window.sendSmsToCustomer = (
    customerId,
    customerName,
    flockId,
    weekNumber,
    flockNumber,
    cardElement,
  ) =>
    dashboardService.sendSmsToCustomer(
      customerId,
      customerName,
      flockId,
      weekNumber,
      flockNumber,
      cardElement,
    );
  window.removeTaskCard = (element, customerId, flockId) =>
    dashboardService.removeTaskCard(element, customerId, flockId);
  window.showSmsHistory = (customerId, flockId = null, flockPeriodId = null) =>
    dashboardService.showSmsHistory(customerId, flockId, flockPeriodId);
  window.refreshSmsStatus = (
    customerId,
    flockId = null,
    flockPeriodId = null,
    openModal = true,
  ) =>
    dashboardService.refreshSmsStatus(
      customerId,
      flockId,
      flockPeriodId,
      openModal,
    );
  window.refreshSmsHistoryFromModal = () =>
    dashboardService.refreshSmsHistoryFromModal();
  window.openChartComparePicker = () => dashboardService.openChartComparePicker();
  window.removeChartCompare = (scope, id) =>
    dashboardService.removeChartCompare(scope, id);
  window.toggleChartSeries = (chartKey, index, checked) =>
    dashboardService.toggleChartSeries(chartKey, index, checked);
  window.toggleChartValues = (checked) =>
    dashboardService.toggleChartValues(checked);
  window.toggleTaskCardHalls = (flockGroupId) => {
    const card = document.querySelector(
      `.task-card[data-flock-group-id="${flockGroupId}"]`,
    );
    if (!card) return;
    const body = card.querySelector(".flock-halls");
    const toggle = card.querySelector(".task-halls-toggle");
    if (!body) return;
    const open = body.classList.toggle("open");
    if (toggle) toggle.classList.toggle("open", open);
    const icon = toggle?.querySelector(".accordion-icon");
    if (icon) icon.style.transform = open ? "rotate(180deg)" : "rotate(0deg)";
  };
  window.toggleAccordion = (sectionId) => {
    const section = document.getElementById(sectionId);
    if (!section) return;
    const isHidden =
      section.style.display === "none" || section.style.display === "";
    section.style.display = isHidden ? "block" : "none";
    const icon = document.querySelector(
      `[data-section="${sectionId}"] .accordion-icon`,
    );
    if (icon)
      icon.style.transform = isHidden ? "rotate(180deg)" : "rotate(0deg)";
  };
};
