// ============================================================
// weekly.service.js
// سرویس هفتگی — کلاس WeeklyService + ترکیب دامنه‌ها (موج ۳.۲b)
// ------------------------------------------------------------
// کلاس غول سابق (۴۹ عضو / ۲۶۹۳ خط) به ۸ دامنهٔ مستقل شکسته شد
// (weekly.loading/flocks/cards/form/report.*) و «چسب پنجره» به
// weekly.window-glue.js منتقل شد. سطح عمومی دست‌نخورده است؛ سه لایه سنجش:
//  ۱) اسنپ‌شات static: docs/service-surface.json + npm run audit:surface
//  ۲) نگهبان زمان اجرا: npm run test:weekly:surface
//  ۳) تست‌های رندر: test:weekly / test:weekly:report / test:weekly:history
// ============================================================
import { weeklyLoadingMethods } from "./weekly.loading.js";
import { weeklyFlockMethods } from "./weekly.flocks.js";
import { weeklyCardMethods } from "./weekly.cards.js";
import { weeklyFormMethods } from "./weekly.form.js";
import { weeklyFullReportMethods } from "./weekly.report.full.js";
import { weeklyHistoryReportMethods } from "./weekly.report.history.js";
import { weeklyReportPickerMethods } from "./weekly.report.pickers.js";
import { weeklyHistoryHtmlMethods } from "./weekly.report.history.html.js";
import { registerWeeklyWindowGlue } from "./weekly.window-glue.js";
class WeeklyService {
  constructor() {
    this.customerId = null;
    this.flocks = [];
    this.units = [];
    this.halls = [];
    this.dictionaries = {};
    this.weeklyRecords = {};
    this.selectedFlockId = null;
    this.initialized = false;
    this.cache = {};
    this.flockWeeks = {};
    this.weeksShown = {};
    this._weekItemBuilders = {};
    this.MAX_DEFAULT_WEEKS = 10;
    this.WEEKS_PER_REVEAL = 10;
  }
}

// ===== ترکیب mixinهای دامنه‌ای هفتگی (موج ۳.۲b — دامنه‌های مستقل) =====
Object.assign(WeeklyService.prototype, weeklyLoadingMethods);
Object.assign(WeeklyService.prototype, weeklyFlockMethods);
Object.assign(WeeklyService.prototype, weeklyCardMethods);
Object.assign(WeeklyService.prototype, weeklyFormMethods);
Object.assign(WeeklyService.prototype, weeklyFullReportMethods);
Object.assign(WeeklyService.prototype, weeklyHistoryReportMethods);
Object.assign(WeeklyService.prototype, weeklyReportPickerMethods);
Object.assign(WeeklyService.prototype, weeklyHistoryHtmlMethods);
export const weeklyService = new WeeklyService();

// ===== چسب پنجره (window.*) — منتقل‌شده به weekly.window-glue.js (موج ۳.۲b) =====
registerWeeklyWindowGlue({ weeklyService, WeeklyService });
