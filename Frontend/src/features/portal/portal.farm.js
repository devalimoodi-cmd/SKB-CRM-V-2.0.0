// ============================================================
// features/portal/portal.farm.js
// تب «درخواست‌های فارم» — الگوی ب: درخواست مشتری + تأیید کارشناس
// موج ۱۳.۱۱ → ۱۳.۱۵ (۱۸ نوع درخواست)
// ------------------------------------------------------------
//  چرا فایل جدا (mixin) و نه همه‌چیز در portal.extra.js؟
//   • هم‌الگو با portal.documents.js: هر تب تازه یک mixin جدا دارد
//     تا portal.service.js فقط سه خط تغییر کند.
//   • گارد `test:customer-portal` این فایل را جدا می‌سنجد
//     (نبود customer_id در بدنه، نبود <form>، سقف‌ها، تأیید حذف).
//
// 🔒 قواعد این فایل:
//   ۱) هیچ شناسهٔ مشتری فرستاده نمی‌شود؛ سرور از توکن می‌سازد.
//   ۲) شناسهٔ درخواست/ردیف برای لغو و جزئیات فقط از پاسخ سرور می‌آید
//      و در portal.api با rowId() اعتبارسنجی می‌شود.
//   ۳) اعتبارسنجی فرم سمت کلاینت فقط «تجربهٔ بهتر» است؛ سرور
//      مستقل همان فهرست سفید/سقف‌ها را دارد.
//   ۴) دکمهٔ ارسال/لغو فقط اگر مجوزش باشد ساخته می‌شود
//      (features.farm_request / features.farm_cancel از سرور).
//   ۵) هیچ <form> ساخته نمی‌شود؛ ارسال با دکمهٔ type="button".
//   ۶) ✅ ۱۳.۱۵: چهار نوع حذفی «تأیید دوم» دارند (بازگشت‌ناپذیر).
// ============================================================
import { portalApi, FARM_REQUEST_TYPES, FARM_LIMITS } from "./portal.api.js";
import {
  FARM_DEFAULT_TYPE,
  FARM_MAX_ID_LIST_ITEMS,
  FARM_MAX_LIST_ITEMS,
  farmFieldId,
  farmIsDestructive,
  farmSpecOf,
} from "./portal.farm.rules.js";
import {
  farmItemRowHtml,
  renderFarmPanel,
} from "./portal.farm.renderer.js";
import {
  isoDateOf,
  weekPlanFor,
  weeklyDateError,
} from "./portal.farm.weeks.js";
import { notificationService } from "../../core/services/notification.service.js";
// برای واگذاری بارگذاری تب‌های دیگر (پروفایل/داشبورد/مدارک)
import { portalDocumentsMixin } from "./portal.documents.js";

// ثبت در همان رجیستری تب‌های خاص (portal.service آن را Object.assign
// می‌کند) ⇒ چرخهٔ پنهان‌سازی/فعال‌سازی و ALL_TAB_KEYS بدون تغییر دوم.
export const FARM_TABS = {
  farm: {
    permission: "customer.portal.farm",
    title: "درخواست‌های من",
    bodyId: "portalFarmBody",
    statusId: "portalFarmStatus",
  },
};

const payloadDataOf = (payload) => (payload && payload.data ? payload.data : {});

// ============================================================
// تقسیم‌بندی نوع‌ها بر اساس رفتار فرم
// ============================================================
// جزئیات سالن (چهار حوزه) — از /farm/halls/:id پیش‌پر می‌شوند
const HALL_DETAIL_TYPES = [
  "hall_physical_save",
  "hall_system_save",
  "hall_water_feed_save",
  "hall_hygiene_save",
];

// نیازمند جزئیات دوره (/farm/placements/:id)
const PLACEMENT_DETAIL_TYPES = [
  "placement_update",
  "weekly_create",
  "weekly_update",
  "weekly_delete",
];

// انواعی که «هیچ تغییری» در آن‌ها خطاست (سرور: nothing_to_change)
const CHANGE_TYPES = [
  "unit_update",
  "hall_update",
  ...HALL_DETAIL_TYPES,
  "placement_update",
  "weekly_update",
];

// ستون‌های هر حوزهٔ جزئیات سالن (هم‌ترتیب با hallDetailValidation)
const HALL_DETAIL_COLUMNS = {
  hall_physical_save: ["length", "width", "height", "area", "floor_type_id", "notes"],
  hall_system_save: [
    "fan_count",
    "fan_size",
    "fan_capacity",
    "heater_count",
    "heating_system_id",
    "cooling_system_id",
    "ventilation_system_id",
    "water_inlet_system_id",
    "lighting_system_id",
    "notes",
  ],
  hall_water_feed_save: [
    "waterer_type_id",
    "feeder_type_id",
    "water_lines_count",
    "feed_lines_count",
    "auto_feed_system",
    "notes",
  ],
  hall_hygiene_save: [
    "last_wash_date",
    "last_disinfect_date",
    "disinfectant_type",
    "description",
  ],
};


// ============================================================
// پیش‌پرکردن فرم از دادهٔ «فعلی» (بدون هیچ قاعدهٔ دوم)
// ============================================================
const emptyish = (value) => value === null || value === undefined;

// نگاشت نوع ⇒ کلید بخش در پاسخ /farm/halls/:id
const DETAIL_SECTION_OF = {
  hall_physical_save: "physical",
  hall_system_save: "system",
  hall_water_feed_save: "water_feed",
  hall_hygiene_save: "hygiene",
};

// ستون‌های مجاز یک بخش را با نرمال‌سازی سبک برمی‌گرداند
const pickColumns = (row, columns = []) => {
  const source = row && typeof row === "object" ? row : {};
  const out = {};
  columns.forEach((key) => {
    const value = source[key];
    if (key === "auto_feed_system") {
      // radio: مقدار «دارد/ندارد» به رشتهٔ true/false تبدیل می‌شود
      out[key] = emptyish(value) ? "" : String(Boolean(value));
      return;
    }
    if (/_date$/.test(key)) {
      out[key] = isoDateOf(value);
      return;
    }
    out[key] = emptyish(value) ? "" : value;
  });
  return out;
};

const farmValuesFromUnit = (unit = {}) => ({
  unit_id: emptyish(unit.id) ? "" : String(unit.id),
  unit_name: unit.unit_name || "",
  address: unit.address || "",
  hall_count: unit.hall_count ?? "",
  capacity: unit.capacity ?? "",
  manager_name: unit.manager_name || "",
  manager_phone: unit.manager_phone || "",
  longitude: unit.longitude ?? "",
  latitude: unit.latitude ?? "",
});

const farmValuesFromHall = (hall = {}) => ({
  hall_id: emptyish(hall.id) ? "" : String(hall.id),
  hall_name: hall.hall_name || "",
  hall_number: hall.hall_number || "",
  nominal_capacity: hall.nominal_capacity ?? "",
  altitude_above_sea: hall.altitude_above_sea ?? "",
  hall_type_id: hall.hall_type_id ?? "",
  construction_year: hall.construction_year ?? "",
  operator_name: hall.operator_name || "",
});

// ردیف‌های تجهیزات سالن (هم‌کلید با LIST_ITEM_ALLOWED_KEYS سرور)
const farmItemsOf = (system) => {
  const rows = system && Array.isArray(system.items) ? system.items : [];
  return rows.slice(0, 60).map((row) => ({
    category: row.category || "",
    type_id: row.type_id ?? "",
    quantity: row.quantity ?? "",
    spec: row.spec || "",
    size: row.size || "",
    capacity: row.capacity || "",
  }));
};

// پیش‌پرکردن چهار حوزهٔ جزئیات سالن (فقط بخش همان نوع — بدون تداخل notes)
const farmValuesFromHallDetails = (data = {}, type = "") => {
  const hall = data.hall || {};
  const details = data.details || {};
  const section = details[DETAIL_SECTION_OF[type]] || {};
  const values = {
    ...farmValuesFromHall(hall),
    ...pickColumns(section, HALL_DETAIL_COLUMNS[type] || []),
  };
  if (type === "hall_system_save") values.items = farmItemsOf(section);
  return values;
};

const farmValuesFromPlacement = (placement = {}) => ({
  chick_placement_id: emptyish(placement.id) ? "" : String(placement.id),
  placement_id: emptyish(placement.id) ? "" : String(placement.id),
  placement_date: isoDateOf(placement.placement_date),
  flock_number: placement.flock_number ?? "",
  chick_source_id: placement.chick_source_id ?? "",
  breed_id: placement.breed_id ?? "",
  chick_age_on_arrival: placement.chick_age_on_arrival ?? "",
  avg_initial_weight: placement.avg_initial_weight ?? "",
  total_chicks_count: placement.total_chicks_count ?? "",
  placement_density: placement.placement_density ?? "",
});

const idsOf = (value) =>
  Array.isArray(value)
    ? value
        .map((item) => Number(item))
        .filter((item) => Number.isInteger(item) && item > 0)
    : [];

// پیش‌پرکردن یک هفته (اعداد + پنج آرایهٔ شناسه)
const farmValuesFromWeekly = (weekly = {}) => ({
  weekly_id: emptyish(weekly.id) ? "" : String(weekly.id),
  week_number: weekly.week_number ?? "",
  week_start_date: isoDateOf(weekly.week_start_date),
  week_end_date: isoDateOf(weekly.week_end_date),
  flock_age_days: weekly.flock_age_days ?? "",
  weekly_mortality: weekly.weekly_mortality ?? "",
  weekly_weight: weekly.weekly_weight ?? "",
  daily_feed_intake: weekly.daily_feed_intake ?? "",
  weekly_feed_intake: weekly.weekly_feed_intake ?? "",
  blackout_hours: weekly.blackout_hours ?? "",
  additional_notes: weekly.additional_notes || "",
  disease_ids: idsOf(weekly.disease_ids),
  vaccine_ids: idsOf(weekly.vaccine_ids),
  medicine_ids: idsOf(weekly.medicine_ids),
  feed_type_ids: idsOf(weekly.feed_type_ids),
  suggestion_ids: idsOf(weekly.suggestion_ids),
});

// مقایسهٔ «قبل/بعد» برای تشخیص nothing_to_change
const sameFarmValue = (left, right) => {
  const norm = (value) => {
    if (Array.isArray(value)) {
      return JSON.stringify(
        value.map((item) =>
          item && typeof item === "object"
            ? {
                category: item.category || "",
                type_id: item.type_id ?? "",
                quantity: item.quantity ?? "",
                spec: item.spec || "",
                size: item.size || "",
                capacity: item.capacity || "",
              }
            : Number(item) || 0,
        ),
      );
    }
    if (value === true || value === "true") return "true";
    if (value === false || value === "false") return "false";
    if (emptyish(value)) return "";
    const text = String(value).trim();
    const parsed = Number(text);
    return text !== "" && Number.isFinite(parsed) ? String(parsed) : text;
  };
  return norm(left) === norm(right);
};

// عدد از ورودی فرم (ارقام فارسی/عربی ⇒ لاتین) — null = خالی، NaN = نامعتبر
const farmNumber = (value) => {
  const text = String(value === null || value === undefined ? "" : value)
    .replace(/[\u06F0-\u06F9]/g, (ch) => String(ch.charCodeAt(0) - 0x06f0))
    .replace(/[\u0660-\u0669]/g, (ch) => String(ch.charCodeAt(0) - 0x0660))
    .replace(/[٫,]/g, ".")
    .trim();
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : NaN;
};

// خالی‌بودن مقدار یک فیلد (برای بررسی «اجباری»)
const farmEmpty = (value) =>
  emptyish(value) || String(value).trim() === "";

export const portalFarmMixin = {
  // ===== وضعیت داخلی =====
  initFarmTab() {
    if (!this.extra || typeof this.extra !== "object") this.extra = {};
    this.extra.farm = { loaded: false, loading: false };
    this.farm = {
      options: {},
      meta: null,
      items: [],
      activeType: FARM_DEFAULT_TYPE,
      pendingCancelId: "",
      submitting: false,
      error: "",
      // ✅ ۱۳.۱۵ — پیش‌پرکردن/ویرایش
      values: {},
      weeks: [],
      loadingDetails: false,
      prefillNote: "",
      confirmOpen: false,
      itemsTouched: false,
      cache: new Map(),
    };
    this.farmBound = false;
  },

  // ===== گیت‌ها (منبع اول: پاسخ سرور، بعد مجوز کلاینت) =====
  canRequestFarm() {
    const features = this.data && this.data.features;
    if (features && typeof features.farm_request === "boolean") {
      return features.farm_request;
    }
    return this.canPermission("customer.portal.farm.request");
  },

  canCancelFarmRequest() {
    const features = this.data && this.data.features;
    if (features && typeof features.farm_cancel === "boolean") {
      return features.farm_cancel;
    }
    return this.canPermission("customer.portal.farm.cancel");
  },

  // ===== اتصال رویدادها (یک‌بار) =====
  bindFarm() {
    if (this.farmBound) return;
    if (typeof document === "undefined" || !document.addEventListener) return;
    this.farmBound = true;

    const body = this.el("portalFarmBody");
    if (!body) return;

    body.addEventListener("click", (event) => {
      const target = event.target;
      if (!target || !target.closest) return;

      const typeBtn = target.closest("[data-farm-type]");
      if (typeBtn) {
        return this.switchFarmType(typeBtn.getAttribute("data-farm-type"));
      }

      if (target.closest("[data-farm-submit]")) return this.submitFarmRequest();
      if (target.closest("[data-farm-abort]")) return this.abortFarmConfirm();

      const addItem = target.closest("[data-farm-item-add]");
      if (addItem) return this.addFarmItemRow(addItem);

      const removeItem = target.closest("[data-farm-item-remove]");
      if (removeItem) return this.removeFarmItemRow(removeItem);

      const askCancel = target.closest("[data-farm-cancel]");
      if (askCancel) {
        return this.requestCancelFarm(askCancel.getAttribute("data-farm-cancel"));
      }

      const confirmCancel = target.closest("[data-farm-cancel-confirm]");
      if (confirmCancel) {
        return this.confirmCancelFarm(
          confirmCancel.getAttribute("data-farm-cancel-confirm"),
        );
      }

      if (target.closest("[data-farm-cancel-cancel]")) {
        return this.abortCancelFarm();
      }

      if (target.closest("[data-farm-retry]")) return this.loadFarmTab();

      return undefined;
    });

    // ✅ ۱۳.۱۵: تغییر «هدف» (واحد/سالن/دوره/هفته) ⇒ پیش‌پرکردن فرم
    body.addEventListener("change", (event) => {
      const target = event.target;
      if (!target || !target.id) return;
      if (!String(target.id).startsWith("farmField_")) return;
      const key = String(target.id).replace("farmField_", "");
      return this.onFarmFieldChange(key, target);
    });

    // محاسبهٔ خودکار مساحت سالن از طول/عرض (همان کاری که کارشناس می‌کند)
    body.addEventListener("input", (event) => {
      const target = event.target;
      if (!target || !target.id) return;
      const key = String(target.id).replace("farmField_", "");
      if (key === "length" || key === "width") this.syncFarmArea();
    });
  },

  // ===== ورود تب: همهٔ تب‌های خاص از همین نقطه می‌گذرند =====
  async loadExtraTab(key) {
    if (key === "farm") return this.loadFarmTab();
    // پروفایل/داشبورد/مدارک همان منطق mixinهای قبلی
    return portalDocumentsMixin.loadExtraTab.call(this, key);
  },

  async loadFarmTab() {
    const state = this.extra && this.extra.farm;
    if (!state || state.loading) return;
    state.loading = true;
    this.setExtraStatus("farm", "loading");

    try {
      await this.loadFarm();
      state.loaded = true;
      state.loading = false;
      this.setExtraStatus("farm", "ready");
    } catch (error) {
      state.loading = false;
      this.setExtraStatus("farm", "error", this.errorMessageOf(error));
    }
  },

  // خواندن گزینه‌ها + فهرست (دو درخواست موازی)
  async loadFarm() {
    const [optionsPayload, listPayload] = await Promise.all([
      portalApi.getFarmOptions(),
      portalApi.getFarmRequests({ page: 1, limit: 50 }),
    ]);

    const optionsData = payloadDataOf(optionsPayload);
    const listData = payloadDataOf(listPayload);

    this.farm.options = optionsData.options || {};
    this.farm.meta = listData.meta || optionsData.meta || null;
    this.farm.items = Array.isArray(listData.items) ? listData.items : [];
    this.farm.error = "";
    this.farm.cache = new Map();
    this.renderFarm();
  },

  // ===== رندر =====
  renderFarm() {
    const body = this.el("portalFarmBody");
    if (!body) return;

    body.innerHTML = renderFarmPanel({
      options: this.farm.options,
      meta: this.farm.meta,
      items: this.farm.items,
      activeType: this.farm.activeType,
      canRequest: this.canRequestFarm(),
      canCancel: this.canCancelFarmRequest(),
      pendingCancelId: this.farm.pendingCancelId,
      error: this.farm.error,
      values: this.farm.values,
      weeks: this.farm.weeks,
      loading: this.farm.loadingDetails,
      prefillNote: this.farm.prefillNote,
      confirmOpen: this.farm.confirmOpen,
    });
  },

  setFarmError(message = "") {
    this.farm.error = String(message || "");
    const body = this.el("portalFarmBody");
    const box = body ? body.querySelector(".portal-farm__error") : null;
    if (box) {
      box.textContent = this.farm.error;
      return;
    }
    this.renderFarm();
  },

  // ===== تغییر نوع/هدف =====
  switchFarmType(type) {
    const key = String(type || "").trim();
    if (!farmSpecOf(key).length) return;
    this.farm.activeType = key;
    this.farm.error = "";
    this.resetFarmForm();
    this.renderFarm();
  },

  // پاک‌کردن مقادیر/هفته‌ها/تأیید (هنگام تغییر نوع یا هدف)
  resetFarmForm() {
    this.farm.values = {};
    this.farm.weeks = [];
    this.farm.prefillNote = "";
    this.farm.confirmOpen = false;
    this.farm.itemsTouched = false;
    this.farm.loadingDetails = false;
  },

  // فیلد «هدف» = نخستین فیلد هر فرم (واحد/سالن/دوره/هفته)
  farmTargetField() {
    const spec = farmSpecOf(this.farm.activeType);
    return spec.length ? spec[0] : null;
  },

  farmTargetValue() {
    const field = this.farmTargetField();
    if (!field) return "";
    const node = this.el(farmFieldId(field.key));
    return node ? String(node.value || "") : "";
  },

  // تغییر فیلدهای فرم — فقط «هدف» و «هفته» واکنش دارند
  async onFarmFieldChange(key, node) {
    if (key === "weekly_id") {
      return this.loadFarmWeeklyDetails(node && node.value);
    }

    const target = this.farmTargetField();
    if (!target || target.key !== key) return;

    this.farm.confirmOpen = false;
    this.farm.weeks = [];
    this.farm.values = {};
    this.farm.prefillNote = "";
    this.farm.itemsTouched = false;
    return this.loadFarmTargetDetails();
  },

  // ===== پیش‌پرکردن فرم از ردیف «هدف» =====
  async loadFarmTargetDetails() {
    const type = this.farm.activeType;
    const field = this.farmTargetField();
    const raw = field ? this.farmTargetValue() : "";

    this.farm.confirmOpen = false;
    this.farm.prefillNote = "";

    if (!raw) {
      this.farm.values = {};
      this.farm.weeks = [];
      this.renderFarm();
      return;
    }

    // انتخاب فعلی را نگه می‌داریم تا رندر «در حال بارگذاری» انتخاب را نبرد
    this.farm.values = { ...this.farm.values, [field.key]: String(raw) };

    // ---- ۱) واحد و سالن: از همان پاسخ گزینه‌ها (بدون درخواست دوم) ----
    if (type === "unit_update" || type === "unit_delete") {
      const unit = (this.farm.options.units || []).find(
        (row) => String(row.id) === String(raw),
      );
      if (!unit) return this.keepFarmSelection();
      if (type === "unit_delete") {
        return this.applyFarmValues(
          { ...farmValuesFromUnit(unit) },
          `نام ثبت‌شدهٔ این واحد: «${unit.unit_name}» — برای تأیید، همان نام را در کادر زیر بنویسید`,
        );
      }
      return this.applyFarmValues(
        { ...farmValuesFromUnit(unit) },
        "مقادیر فعلی بارگذاری شد؛ فقط موارد تغییرکرده را اصلاح کنید",
      );
    }

    if (type === "hall_update") {
      const hall = (this.farm.options.halls || []).find(
        (row) => String(row.id) === String(raw),
      );
      if (!hall) return this.keepFarmSelection();
      return this.applyFarmValues(
        { ...farmValuesFromHall(hall) },
        "مقادیر فعلی بارگذاری شد؛ فقط موارد تغییرکرده را اصلاح کنید",
      );
    }

    if (type === "hall_delete") return this.applyFarmValues({}, "");

    // ---- ۲) جزئیات چهار حوزهٔ سالن: از /farm/halls/:id ----
    if (HALL_DETAIL_TYPES.includes(type)) {
      const data = await this.fetchFarmDetails(`hall:${raw}`, () =>
        portalApi.getFarmHallDetails(raw),
      );
      if (!data) return this.keepFarmSelection();

      const section =
        (data.details || {})[DETAIL_SECTION_OF[type]] || null;
      const note = section
        ? "مقادیر فعلی این بخش بارگذاری شد؛ فقط موارد تغییرکرده را اصلاح کنید"
        : "این بخش قبلاً ثبت نشده است؛ مقادیر تازه برای کارشناس ارسال می‌شود";
      return this.applyFarmValues(
        farmValuesFromHallDetails(data, type),
        note,
      );
    }

    // ---- ۳) دوره و هفته: از /farm/placements/:id ----
    if (PLACEMENT_DETAIL_TYPES.includes(type)) {
      const data = await this.fetchFarmDetails(`placement:${raw}`, () =>
        portalApi.getFarmPlacementDetails(raw),
      );
      if (!data) return this.keepFarmSelection();

      const placement = data.placement || {};
      this.farm.weeks = Array.isArray(data.weeklies) ? data.weeklies : [];

      if (type === "weekly_create") {
        const plan = weekPlanFor({ placement, weeks: this.farm.weeks });
        return this.applyFarmValues(
          {
            ...farmValuesFromPlacement(placement),
            ...plan,
            chick_placement_id: String(raw),
          },
          this.farm.weeks.length
            ? `هفتهٔ ${plan.week_number} با تاریخ‌های پیشنهادی پر شد؛ در صورت نیاز اصلاح کنید`
            : "شمارهٔ هفته، تاریخ‌ها و سن گله خودکار پر شد",
        );
      }

      if (type === "placement_update") {
        return this.applyFarmValues(
          { ...farmValuesFromPlacement(placement) },
          "مقادیر فعلی بارگذاری شد؛ فقط موارد تغییرکرده را اصلاح کنید",
        );
      }

      // weekly_update / weekly_delete: فقط فهرست هفته‌ها لازم است
      return this.applyFarmValues(
        { chick_placement_id: String(raw) },
        this.farm.weeks.length
          ? "هفتهٔ موردنظر را انتخاب کنید"
          : "این دوره هنوز هفتهٔ ثبت‌شده ندارد",
      );
    }

    return this.applyFarmValues({}, "");
  },

  // انتخاب فعلی حفظ می‌شود ولی مقادیری پیش‌پر نمی‌شود (خطای شبکه/۴۰۴)
  keepFarmSelection() {
    this.farm.prefillNote = "";
    this.renderFarm();
  },

  // خواندن جزئیات با cache (هر ردیف یک‌بار)
  async fetchFarmDetails(cacheKey, loader) {
    if (this.farm.cache.has(cacheKey)) {
      return this.farm.cache.get(cacheKey);
    }

    this.farm.loadingDetails = true;
    this.renderFarm();

    try {
      const data = payloadDataOf(await loader());
      this.farm.cache.set(cacheKey, data);
      return data;
    } catch (error) {
      this.setFarmError(this.errorMessageOf(error));
      return null;
    } finally {
      this.farm.loadingDetails = false;
    }
  },

  // مقادیر پیش‌پر + یادداشت وضعیت را می‌نشاند و فرم را از نو می‌سازد
  applyFarmValues(values = {}, note = "") {
    this.farm.values = { ...(values || {}) };
    this.farm.prefillNote = String(note || "");
    this.farm.itemsTouched =
      Array.isArray(this.farm.values.items) && this.farm.values.items.length > 0;
    this.renderFarm();
  },

  // انتخاب یک هفته ⇒ پیش‌پرکردن اعداد و پنج آرایهٔ شناسه
  async loadFarmWeeklyDetails(weeklyId) {
    const raw = String(weeklyId || "").trim();
    this.farm.confirmOpen = false;

    if (!raw) {
      this.farm.prefillNote = "";
      this.renderFarm();
      return;
    }

    const data = await this.fetchFarmDetails(`weekly:${raw}`, () =>
      portalApi.getFarmWeeklyDetails(raw),
    );
    if (!data) {
      this.renderFarm();
      return;
    }

    const weekly = data.weekly || {};
    this.applyFarmValues(
      { ...this.farm.values, ...farmValuesFromWeekly(weekly) },
      `مقادیر فعلی هفتهٔ ${weekly.week_number || ""} بارگذاری شد؛ فقط موارد تغییرکرده را اصلاح کنید`,
    );
  },

  // مساحت = طول × عرض (فقط پیشنهاد؛ کاربر می‌تواند دستی عوض کند)
  syncFarmArea() {
    const lengthNode = this.el(farmFieldId("length"));
    const widthNode = this.el(farmFieldId("width"));
    const areaNode = this.el(farmFieldId("area"));
    if (!lengthNode || !widthNode || !areaNode) return;

    const length = farmNumber(lengthNode.value);
    const width = farmNumber(widthNode.value);
    if (!Number.isFinite(length) || !Number.isFinite(width)) return;
    if (length <= 0 || width <= 0) return;

    areaNode.value = String(Math.round(length * width * 100) / 100);
  },

  // ===== ردیف‌های تجهیزات (افزودن/حذف) =====
  addFarmItemRow(button) {
    const box =
      button && button.closest ? button.closest("[data-farm-items]") : null;
    if (!box) return;

    const rows = box.querySelectorAll("[data-farm-item-row]");
    if (rows.length >= FARM_MAX_LIST_ITEMS) {
      return this.setFarmError(
        `حداکثر ${FARM_MAX_LIST_ITEMS} ردیف تجهیزات برای هر سالن مجاز است`,
      );
    }

    const foot = box.querySelector(".portal-farm__items-foot");
    const html = farmItemRowHtml({}, rows.length);
    if (foot) {
      foot.insertAdjacentHTML("beforebegin", html);
    } else {
      box.insertAdjacentHTML("beforeend", html);
    }
    this.farm.itemsTouched = true;
    return undefined;
  },

  removeFarmItemRow(button) {
    const row =
      button && button.closest ? button.closest("[data-farm-item-row]") : null;
    if (!row) return;
    row.remove();
    this.farm.itemsTouched = true;
  },

  // بستن «تأیید دوم» حذف بدون ارسال
  abortFarmConfirm() {
    this.farm.confirmOpen = false;
    this.renderFarm();
  },

  // ===== خواندن مقدار فرم (بدون <form>) =====
  readFarmInputs() {
    const input = {};

    farmSpecOf(this.farm.activeType).forEach((field) => {
      if (field.type === "multi") {
        input[field.key] = this.readFarmMulti(field.key);
        return;
      }
      if (field.type === "items") {
        input[field.key] = this.readFarmItems();
        return;
      }
      if (field.type === "radio") {
        const body = this.el("portalFarmBody");
        const checked = body
          ? body.querySelector(`[data-farm-radio="${field.key}"] input:checked`)
          : null;
        input[field.key] = checked ? checked.value : "";
        return;
      }

      const node = this.el(farmFieldId(field.key));
      if (!node) return;
      if (field.type === "check") {
        input[field.key] = Boolean(node.checked);
        return;
      }
      input[field.key] = node.value;
    });

    return input;
  },

  // پنج گروه شناسهٔ هفتگی
  readFarmMulti(key) {
    const body = this.el("portalFarmBody");
    if (!body) return [];
    return [...body.querySelectorAll(`[data-farm-multi="${key}"] input:checked`)]
      .map((node) => node.getAttribute("data-farm-multi-value"))
      .slice(0, FARM_MAX_ID_LIST_ITEMS);
  },

  // ردیف‌های تجهیزات (هم‌ترتیب کلیدها با farmItemsOf برای مقایسه)
  readFarmItems() {
    const body = this.el("portalFarmBody");
    if (!body) return [];

    return [...body.querySelectorAll("[data-farm-items] [data-farm-item-row]")].map(
      (row) => {
        const read = (key) => {
          const node = row.querySelector(`[data-farm-item-field="${key}"]`);
          return node ? String(node.value || "").trim() : "";
        };
        return {
          category: read("category"),
          type_id: read("type_id"),
          quantity: read("quantity"),
          spec: read("spec"),
          size: read("size"),
          capacity: read("capacity"),
        };
      },
    );
  },

  // ===== اعتبارسنجی سبک سمت کلاینت (سرور مستقل همان را دارد) =====
  farmFormError() {
    const type = this.farm.activeType;
    const spec = farmSpecOf(type);
    const input = this.readFarmInputs();

    // ۱) فیلدهای اجباری (آرایه/ردیف جدا سنجیده می‌شوند)
    const missing = spec.find(
      (field) =>
        field.required &&
        field.type !== "check" &&
        field.type !== "multi" &&
        field.type !== "items" &&
        farmEmpty(input[field.key]),
    );
    if (missing) return `«${missing.label}» را کامل کنید`;

    // ۲) عدد معتبر بودن
    const badNumber = spec.find(
      (field) =>
        field.type === "number" &&
        !farmEmpty(input[field.key]) &&
        Number.isNaN(farmNumber(input[field.key])),
    );
    if (badNumber) return `«${badNumber.label}» باید عدد باشد`;

    // ۳) بازهٔ مجاز (همان min/max که در فیلد گذاشته شده)
    const outOfRange = spec.find((field) => {
      if (field.type !== "number" || farmEmpty(input[field.key])) return false;
      const value = farmNumber(input[field.key]);
      if (!Number.isFinite(value)) return false;
      if (field.min !== undefined && value < field.min) return true;
      if (field.max !== undefined && value > field.max) return true;
      return false;
    });
    if (outOfRange) {
      const min = outOfRange.min === undefined ? "—" : outOfRange.min;
      const max = outOfRange.max === undefined ? "—" : outOfRange.max;
      return `«${outOfRange.label}» باید بین ${min} و ${max} باشد`;
    }

    // ۴) تلفن مدیر
    if (input.manager_phone) {
      const digits = String(input.manager_phone).replace(/\D/g, "");
      if (digits.length !== 11) return "شمارهٔ تماس مدیر باید ۱۱ رقم باشد";
    }

    // ۵) بازهٔ تاریخ هفته (پایان پیش از شروع)
    const dateProblem = weeklyDateError(input);
    if (dateProblem) return dateProblem;

    // ۶) تطابق نام واحد برای حذف (سرور: confirm_name_mismatch)
    if (type === "unit_delete") {
      const unit = (this.farm.options.units || []).find(
        (row) => String(row.id) === String(input.unit_id || ""),
      );
      const typed = String(input.confirm_name || "").trim().toLowerCase();
      const current = String((unit && unit.unit_name) || "")
        .trim()
        .toLowerCase();
      if (unit && typed !== current) {
        return `نام واحد را عیناً بنویسید: «${unit.unit_name}»`;
      }
    }

    // ۷) «هیچ تغییری» — همان قاعدهٔ nothing_to_change سرور
    return this.farmNoChangeError(input, spec);
  },

  // مقایسهٔ مقادیر فرم با مقادیر پیش‌پر (فقط برای انواع ویرایش/ثبت جزئیات)
  farmNoChangeError(input, spec) {
    const type = this.farm.activeType;
    if (!CHANGE_TYPES.includes(type)) return "";

    const previous =
      this.farm.values && typeof this.farm.values === "object"
        ? this.farm.values
        : {};
    if (!Object.keys(previous).length) return "";

    const changed = spec
      .filter((field) => field.key !== "note" && field.payload !== false)
      .some((field) => !sameFarmValue(input[field.key], previous[field.key]));

    return changed ? "" : "هیچ تغییری نسبت به مقادیر فعلی وارد نشده است";
  },

  // ===== ارسال درخواست =====
  async submitFarmRequest() {
    if (this.farm.submitting) return;
    if (!this.canRequestFarm()) return;

    // ✅ ۱۳.۱۵: تأیید دوم برای چهار نوع حذفی (بدون confirm بومی)
    if (farmIsDestructive(this.farm.activeType) && !this.farm.confirmOpen) {
      this.setFarmError("");
      this.farm.confirmOpen = true;
      this.renderFarm();
      return;
    }

    const problem = this.farmFormError();
    if (problem) {
      this.farm.confirmOpen = false;
      this.renderFarm();
      return this.setFarmError(problem);
    }

    // سقف محلی (سرور هم مستقل ۴۲۹ می‌دهد)
    const counts = (this.farm.meta && this.farm.meta.counts) || {};
    const limits = (this.farm.meta && this.farm.meta.limits) || {};
    const pending = Number(counts.pending) || 0;
    const maxPending = Number(limits.max_pending) || FARM_LIMITS.maxPending;
    if (pending >= maxPending) {
      return this.setFarmError(
        `حداکثر ${maxPending} درخواست در انتظار تأیید می‌توانید داشته باشید`,
      );
    }

    // ردیف‌های تجهیزات فقط اگر کاربر آن‌ها را دیده/تغییر داده ارسال می‌شوند
    // (نبودن `items` یعنی «ردیف‌های قبلی دست‌نخورده بماند»).
    const input = this.readFarmInputs();
    if (!this.farm.itemsTouched) delete input.items;

    this.farm.submitting = true;
    this.setFarmError("");

    try {
      await portalApi.createFarmRequest(this.farm.activeType, input);

      notificationService.notifyOnce({
        key: "portal-farm-request-sent",
        message: "✅ درخواست شما ثبت شد؛ پس از تأیید کارشناس اعمال می‌شود",
        type: "success",
        cooldownMs: 8000,
      });

      this.farm.confirmOpen = false;
      this.resetFarmForm();
      await this.loadFarm();
      this.setExtraStatus("farm", "ready");
    } catch (error) {
      const message = this.errorMessageOf(error);
      this.farm.confirmOpen = false;
      this.setFarmError(message);
      this.renderFarm();
      notificationService.notifyOnce({
        key: "portal-farm-request-error",
        message: `⚠️ ${message}`,
        type: "error",
        cooldownMs: 15000,
      });
    } finally {
      this.farm.submitting = false;
    }
  },

  // ===== لغو درخواست — دو مرحله‌ای و بدون confirm بومی =====
  requestCancelFarm(id) {
    if (!this.canCancelFarmRequest()) return;
    this.farm.pendingCancelId = String(id ?? "");
    this.renderFarm();
  },

  abortCancelFarm() {
    this.farm.pendingCancelId = "";
    this.renderFarm();
  },

  async confirmCancelFarm(id) {
    if (!this.canCancelFarmRequest()) return;

    try {
      await portalApi.cancelFarmRequest(id);
      this.farm.pendingCancelId = "";
      notificationService.notifyOnce({
        key: "portal-farm-request-cancelled",
        message: "درخواست لغو شد",
        type: "success",
        cooldownMs: 8000,
      });
      await this.loadFarm();
      this.setExtraStatus("farm", "ready");
    } catch (error) {
      this.farm.pendingCancelId = "";
      this.setFarmError(this.errorMessageOf(error));
      notificationService.notifyOnce({
        key: "portal-farm-cancel-error",
        message: `⚠️ ${this.errorMessageOf(error)}`,
        type: "error",
        cooldownMs: 15000,
      });
    }
  },

  // فهرست نوع‌ها برای استفادهٔ احتمالی UI/تست
  farmTypes() {
    return FARM_REQUEST_TYPES.map((item) => ({ ...item }));
  },
};

// متدهای این فایل روی PortalService.prototype سوار می‌شوند
// ⚠️ ترتیب مهم است: بعد از applyPortalDocuments اجرا شود تا
//    loadExtraTab این فایل بتواند نسخهٔ لایه‌های قبلی را صدا بزند.
export const applyPortalFarm = (ServiceClass) => {
  Object.assign(ServiceClass.prototype, portalFarmMixin);
  return ServiceClass;
};
