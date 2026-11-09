// ============================================================
// features/portal/portal.farm.js
// تب «درخواست‌های فارم» — الگوی ب: درخواست مشتری + تأیید کارشناس
// موج ۱۳.۱۱
// ------------------------------------------------------------
//  چرا فایل جدا (mixin) و نه همه‌چیز در portal.extra.js؟
//   • هم‌الگو با portal.documents.js: هر تب تازه یک mixin جدا دارد
//     تا portal.service.js فقط سه خط تغییر کند.
//   • گارد `test:customer-portal` این فایل را جدا می‌سنجد
//     (نبود customer_id در بدنه، نبود <form>، سقف‌ها).
//
// 🔒 قواعد این فایل:
//   ۱) هیچ شناسهٔ مشتری فرستاده نمی‌شود؛ سرور از توکن می‌سازد.
//   ۲) شناسهٔ درخواست برای لغو فقط از پاسخ سرور می‌آید و در
//      portal.api با rowId() اعتبارسنجی می‌شود.
//   ۳) اعتبارسنجی فرم سمت کلاینت فقط «تجربهٔ بهتر» است؛ سرور
//      مستقل همان فهرست سفید/سقف‌ها را دارد.
//   ۴) دکمهٔ ارسال/لغو فقط اگر مجوزش باشد ساخته می‌شود
//      (features.farm_request / features.farm_cancel از سرور).
//   ۵) هیچ <form> ساخته نمی‌شود؛ ارسال با دکمهٔ type="button".
// ============================================================
import { portalApi, FARM_REQUEST_TYPES, FARM_LIMITS } from "./portal.api.js";
import {
  FARM_FORM_SPEC,
  farmFieldId,
  renderFarmPanel,
} from "./portal.farm.renderer.js";
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

export const portalFarmMixin = {
  // ===== وضعیت داخلی =====
  initFarmTab() {
    if (!this.extra || typeof this.extra !== "object") this.extra = {};
    this.extra.farm = { loaded: false, loading: false };
    this.farm = {
      options: {},
      meta: null,
      items: [],
      activeType: "unit_create",
      pendingCancelId: "",
      submitting: false,
      error: "",
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
    });
  },

  setFarmError(message = "") {
    this.farm.error = String(message || "");
    const box = this.el("portalFarmBody")
      ? this.el("portalFarmBody").querySelector(".portal-farm__error")
      : null;
    if (box) {
      box.textContent = this.farm.error;
      return;
    }
    this.renderFarm();
  },

  switchFarmType(type) {
    const key = String(type || "").trim();
    if (!FARM_FORM_SPEC[key]) return;
    this.farm.activeType = key;
    this.farm.pendingCancelId = "";
    this.renderFarm();
  },

  // ===== خواندن مقدار فرم (بدون <form>) =====
  readFarmInputs() {
    const spec = FARM_FORM_SPEC[this.farm.activeType] || [];
    const input = {};

    spec.forEach((field) => {
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

  // اعتبارسنجی سبک سمت کلاینت (سرور مستقل همان را دارد)
  farmFormError() {
    const spec = FARM_FORM_SPEC[this.farm.activeType] || [];
    const input = this.readFarmInputs();

    const missing = spec.find(
      (field) =>
        field.required &&
        field.type !== "check" &&
        String(input[field.key] ?? "").trim() === "",
    );
    if (missing) return `«${missing.label}» را کامل کنید`;

    if (input.manager_phone) {
      const digits = String(input.manager_phone).replace(/\D/g, "");
      if (digits.length !== 11) return "شمارهٔ تماس مدیر باید ۱۱ رقم باشد";
    }

    return "";
  },

  // ===== ارسال درخواست =====
  async submitFarmRequest() {
    if (this.farm.submitting) return;
    if (!this.canRequestFarm()) return;

    const problem = this.farmFormError();
    if (problem) return this.setFarmError(problem);

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

    this.farm.submitting = true;
    this.setFarmError("");

    try {
      await portalApi.createFarmRequest(
        this.farm.activeType,
        this.readFarmInputs(),
      );

      notificationService.notifyOnce({
        key: "portal-farm-request-sent",
        message: "✅ درخواست شما ثبت شد؛ پس از تأیید کارشناس اعمال می‌شود",
        type: "success",
        cooldownMs: 8000,
      });

      await this.loadFarm();
      this.setExtraStatus("farm", "ready");
    } catch (error) {
      const message = this.errorMessageOf(error);
      this.setFarmError(message);
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
