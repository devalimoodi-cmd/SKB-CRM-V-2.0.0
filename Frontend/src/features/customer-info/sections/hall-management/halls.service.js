// ============================================================
// halls.service.js
// سرویس سالن‌ها — کلاس HallsService + ترکیب دامنه‌ها (موج ۳.۲c)
// ------------------------------------------------------------
// کلاس غول سابق (۷۱ عضو / ۲۲۵۹ خط) به ۸ دامنهٔ مستقل شکسته شد
// (halls.core/tabs/basic/list/edit-mode/units/systems/forms) و «چسب پنجره» به
// halls.window-glue.js منتقل شد. سطح عمومی دست‌نخورده است؛ سه لایه سنجش:
//  ۱) اسنپ‌شات static: docs/service-surface.json + npm run audit:surface
//  ۲) نگهبان زمان اجرا: npm run test:halls:surface
//  ۳) ابزار اندازه/رگرسیون: npm run audit:size · npm run lint
// ============================================================
import { hallsCoreMethods } from "./halls.core.js";
import { hallsTabMethods } from "./halls.tabs.js";
import { hallsBasicMethods } from "./halls.basic.js";
import { hallsListMethods } from "./halls.list.js";
import { hallsEditModeMethods } from "./halls.edit-mode.js";
import { hallsUnitMethods } from "./halls.units.js";
import { hallsSystemMethods } from "./halls.systems.js";
import { hallsFormMethods } from "./halls.forms.js";
import { registerHallsWindowGlue } from "./halls.window-glue.js";
class HallsService {
  constructor() {
    this.customerId = null;
    this.halls = [];
    this.periods = [];
    this.dictionaries = {};
    this.currentPeriodId = null;
    this.activeTab = "basic";
    this.initialized = false;
    this.physicalPeriodId = null;
    this.systemsPeriodId = null;
    this.waterFeedPeriodId = null;
    this.editingHallId = null;
    this.editModeButtonsState = {};
  }
}

// ===== ترکیب mixinهای دامنه‌ای سالن‌ها (موج ۳.۲c — دامنه‌های مستقل) =====
Object.assign(HallsService.prototype, hallsCoreMethods);
Object.assign(HallsService.prototype, hallsTabMethods);
Object.assign(HallsService.prototype, hallsBasicMethods);
Object.assign(HallsService.prototype, hallsListMethods);
Object.assign(HallsService.prototype, hallsEditModeMethods);
Object.assign(HallsService.prototype, hallsUnitMethods);
Object.assign(HallsService.prototype, hallsSystemMethods);
Object.assign(HallsService.prototype, hallsFormMethods);
export const hallsService = new HallsService();

// ===== چسب پنجره (window.*) — منتقل‌شده به halls.window-glue.js (موج ۳.۲c) =====
registerHallsWindowGlue({ hallsService, HallsService });
