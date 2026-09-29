// ============================================================
// halls.window-glue.js
// «چسب پنجره» سالن‌ها — نگاشت نام‌های سراسری HTML (onclick) به سرویس
// ------------------------------------------------------------
// چرا جدا شد؟ این بلوک ۴۷ خطی انتهای halls.service.js را می‌گرفت،
// اما هیچ منطق دامنه‌ای ندارد؛ فقط window.<name> را به متدهای HallsService وصل می‌کند.
// ✅ سطح عمومی تغییر نکرده: همان ۳۳ نام window.* با همان ترتیب ثبت می‌شوند.
// ⚠️ باید «بعد از» ساخته‌شدن نمونهٔ سرویس اجرا شود؛ به همین دلیل به شکل تابع ثبت
//    صادر شده و در انتهای halls.service.js فراخوانی می‌شود (موج ۳.۲c).
// 🐞 رفع باگ (موج ۳.۲c): `loadPeriodsDropdown` پیش‌تر به متد ناموجود `loadPeriods` وصل بود
//    و روی شاخهٔ فالبک TypeError می‌داد؛ اکنون به `loadUnits` (همان بارگذاری دوره‌ها) وصل است.
// ============================================================
import { notificationService } from "../../../../core/services/notification.service.js";

export const registerHallsWindowGlue = ({ hallsService, HallsService }) => {
  if (typeof window === "undefined") return;

  window.hallsService = hallsService;
  window.HallsService = HallsService;
  window.loadAllHallsDropdowns = () => hallsService.updateHallsDropdowns();
  // ✅ پیش‌تر به متد ناموجود `loadPeriods()` اشاره می‌کرد که روی سرویس وجود
  // ندارد (TypeError در شاخهٔ فالبک)؛ `loadUnits` همان بارگذاری دوره‌هاست.
  window.loadPeriodsDropdown = () => hallsService.loadUnits();
  window.renderHallsList = () => hallsService.renderHallsList();
  window.refreshAllHallsDropdowns = () => hallsService.updateHallsDropdowns();
  window.checkHasActivePeriod = (id) => hallsService.checkActivePeriod();
  window.editHall = (id) => hallsService.editHall(id);
  window.toggleHallStatus = (id, s) => hallsService.toggleHallStatus(id, s);
  window.deleteHallRecord = (id) => hallsService.deleteHall(id);
  window.deleteUnitRecord = (id) => hallsService.deleteUnit(id);
  window.toggleHallCard = (h) => hallsService.toggleHallCard(h);
  window.toggleUnitCard = (h) => hallsService.toggleUnitCard(h);
  window.toggleUnitStatus = (id, s) => hallsService.toggleUnitStatus(id, s);
  window.saveBasicInfo = () => hallsService.saveBasicInfo();
  window.saveUnitInfo = () => hallsService.saveUnitInfo();
  window.addUnitExpertRow = () => hallsService.addUnitExpertRow();
  window.removeUnitExpertRow = (btn) => hallsService.removeUnitExpertRow(btn);
  window.loadUnitDetails = (id) => hallsService.loadUnitDetails(id);
  window.openUnitEdit = (id) => hallsService.openUnitEdit(id);
  window.updateUnitInfo = (id) => hallsService.updateUnitInfo(id);
  window.closeUnitEdit = (id) => hallsService.closeUnitEdit(id);
  window.addUnitEditExpertRow = (id) => hallsService.addUnitEditExpertRow(id);
  window.removeUnitEditExpertRow = (btn) =>
    hallsService.removeUnitEditExpertRow(btn);
  window.resetUnitTab = () => hallsService.resetTab("unitTab");
  window.resetTab = (t) => hallsService.resetTab(t + "Tab");
  window.savePhysicalInfo = () => hallsService.savePhysicalInfo();
  window.saveSystemsInfo = () => hallsService.saveSystemsInfo();
  window.addSystemItemRow = (cat) => hallsService.addSystemItemRow(cat);
  window.removeSystemItemRow = (btn) => hallsService.removeSystemItemRow(btn);
  window.saveWaterFoodInfo = () => hallsService.saveWaterFeedInfo();
  window.generateHallsReport = async () => {
    try {
      const { hallsReport } = await import("./halls.report.js");
      await hallsReport.generateAndPrint();
    } catch (error) {
      console.error("❌ Error generating halls report:", error);
      notificationService.error("خطا در تولید گزارش");
    }
  };
  window.refreshAllHallsDropdownsInPage = () =>
    hallsService.refreshAllDropdowns();
};
