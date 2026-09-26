// ============================================================
// hatchery.window-glue.js
// «چسب پنجره» بخش جوجه‌ریزی — نگاشت نام‌های سراسری HTML (onclick) به سرویس
// ------------------------------------------------------------
// چرا جدا شد؟ این بلوک ~۱۲۰ خط انتهای hatchery.service.js را می‌گرفت،
// اما هیچ منطق دامنه‌ای ندارد؛ فقط window.<name> را به متدهای
// HatcheryService / hatcheryFormService وصل می‌کند (موج ۲).
// ✅ سطح عمومی تغییر نکرده: همان نام‌های window.* با همان رفتار ثبت می‌شوند.
// ⚠️ باید «بعد از» ساخته‌شدن نمونهٔ سرویس اجرا شود؛ به همین دلیل به شکل
//    تابع ثبت صادر شده و در انتهای hatchery.service.js فراخوانی می‌شود.
// ============================================================
import { notificationService } from "../../../../core/services/notification.service.js";

export const registerHatcheryWindowGlue = ({
  hatcheryService,
  HatcheryService,
  hatcheryFormService,
}) => {
  if (typeof window === "undefined") return;

  window.hatcheryService = hatcheryService;
  window.HatcheryService = HatcheryService;
  window.refreshHatcheryManagement = () => hatcheryService.refresh();
  window.loadAllPeriodsList = () => hatcheryService.loadAllPeriodsList();
  window.refreshChickList = () => hatcheryService.loadFlocks();
  window.loadChickPeriodsList = () => hatcheryService.loadFlocks();
  window.loadAllHygieneHistory = () => hatcheryService.loadHygieneHistory();
  window.saveChickPeriodInfo = () => hatcheryService.savePeriod();
  window.saveChickRegister = () => hatcheryService.saveFlock();
  window.saveChickHygieneInfo = () => hatcheryService.saveHygiene();
  window.resetChickPeriodTab = () => hatcheryFormService.resetPeriodForm();
  window.resetChickRegisterTab = () => {
    hatcheryFormService.resetFlockForm();
    hatcheryService.refreshFlockPanel?.();
    hatcheryService.refreshExtraHalls?.();
  };
  window.resetChickHygieneTab = () => hatcheryFormService.resetHygieneForm();
  window.viewPeriod = (id) => hatcheryService.viewPeriod?.(id);
  window.editPeriod = (id) => hatcheryService.editPeriod(id);
  window.deletePeriod = (id) => hatcheryService.deletePeriod(id);
  window.completePeriod = (id) => hatcheryService.completePeriod(id);
  window.viewPeriodCompletion = (id) =>
    hatcheryService.viewPeriodCompletion(id);
  window.editPeriodCompletion = (id) =>
    hatcheryService.editPeriodCompletion(id);
  window.editFlock = (id) => hatcheryService.editFlock(id);
  window.editFlockGroup = (flockId) =>
    hatcheryService.editFlockGroup(flockId);
  window.deleteFlock = (id) => hatcheryService.deleteFlock(id);
  window.deleteFlockGroup = (flockId, fallbackId = null) =>
    hatcheryService.deleteFlockGroup(flockId, fallbackId);
  window.syncExtraHallDates = () => hatcheryService.syncExtraHallDates?.();
  window.toggleFlockStatus = (id) => hatcheryService.toggleFlockStatus(id);
  window.toggleFlockGroupStatus = (flockId) =>
    hatcheryService.toggleFlockGroupStatus(flockId);
  window.loadHallAreaForChick = (id) =>
    hatcheryService.loadHallAreaForFlock(id);
  window.calculateDensity = () => hatcheryService.calculateDensity();
  window.endActiveFlock = (flockId) => hatcheryService.endActiveFlock(flockId);
  window.endActiveFlockOf = (flockId) =>
    hatcheryService.completeFlockOf(flockId);
  window.completeFlockOf = (flockId) =>
    hatcheryService.completeFlockOf(flockId);
  window.editFlockCompletion = (flockId) =>
    hatcheryService.editFlockCompletion(flockId);
  window.hatcheryFormatToman = (el) =>
    hatcheryService.formatTomanInput(el);
  window.hatcheryRecalcCompletion = () =>
    hatcheryService.recalcCompletionInputs();
  window.hatcherySetPcMethod = (m) =>
    hatcheryService.setPcSlaughterMethod(m);
  window.hatcheryAddPcShip = () => hatcheryService.addPcShipRow();
  window.hatcheryRemovePcShip = (btn) => hatcheryService.removePcShip(btn);
  window.hatcheryUeRecalc = () => hatcheryService.ueRecalcSlaughterMethod();
  window.hatcherySetUeMethod = (m) =>
    hatcheryService.setUeSlaughterMethod(m);
  window.hatcheryAddUeShip = () => hatcheryService.addUeShipRow();
  window.hatcheryRemoveUeShip = (btn) => hatcheryService.removeUeShip(btn);
  window.addFlockBookmark = (flockId) => hatcheryService.addFlockBookmark(flockId);
  window.addFlockBookmarkOf = (flockId) =>
    hatcheryService.addFlockBookmark(flockId);
  window.sendFlockSms = (flockId) => hatcheryService.sendFlockSms(null, flockId);
  window.sendFlockSmsFlock = (flockId) =>
    hatcheryService.sendFlockSms(null, flockId);
  window.sendFlockSmsHall = (hallId) => hatcheryService.sendFlockSms(hallId, null);
  window.refreshFlockPanel = () => hatcheryService.refreshFlockPanel();
  window.printFlockCompletionReport = async (flockId) => {
    try {
      const { hatcheryReport } = await import("./hatchery.report.js");
      await hatcheryReport.generateFlockReport(flockId);
    } catch (error) {
      console.error("Error printing flock completion report:", error);
      notificationService.error("خطا در تولید گزارش پایان دوره گله");
    }
  };
  window.showFlockSmsHistory = () => hatcheryService.showFlockSmsHistory();
  window.printFlockSmsReport = async (flockId) => {
    try {
      const { hatcheryReport } = await import("./hatchery.report.js");
      await hatcheryReport.generateFlockSmsReport(flockId);
    } catch (error) {
      console.error("Error printing flock sms report:", error);
      notificationService.error("خطا در تولید گزارش پیامک‌های گله");
    }
  };
  window.generateChickReport = async () => {
    notificationService.showLoading("در حال آماده‌سازی گزارش جوجه‌ریزی...");
    try {
      const { hatcheryReport } = await import("./hatchery.report.js");
      await hatcheryReport.generateAndPrint("active");
    } catch (error) {
      console.error("❌ Error generating chick report:", error);
      notificationService.error("خطا در تولید گزارش");
    } finally {
      notificationService.hideLoading();
    }
  };
  window.generateChickHistoryReport = async () => {
    notificationService.showLoading("در حال آماده‌سازی گزارش تاریخچه جوجه‌ریزی...");
    try {
      const { hatcheryReport } = await import("./hatchery.report.js");
      await hatcheryReport.generateHistoryAndPrint();
    } catch (error) {
      console.error("❌ Error generating chick history report:", error);
      notificationService.error("خطا در تولید گزارش تاریخچه");
    } finally {
      notificationService.hideLoading();
    }
  };
  window.viewFlockDetails = (id) => hatcheryService.viewFlockDetails(id);
  window.viewFlockGroup = (flockId) =>
    hatcheryService.viewFlockGroup(flockId);
  window.viewHygieneRecord = (id, hallId) =>
    hatcheryService.viewHygiene(id, hallId);
  window.editHygieneRecord = (id, hallId) =>
    hatcheryService.editHygiene(id, hallId);
  window.deleteHygieneRecord = (id) => hatcheryService.deleteHygiene(id);
};
