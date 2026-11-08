// ============================================================
// features/portal/portal.extra.js
// «پروفایل من» + «داشبورد تحلیلی» — موج ۱۳.۸
// ------------------------------------------------------------
//  چرا فایل جدا (mixin) و نه همه‌چیز در portal.service.js؟
//   • سرویس ۱۳.۳/۱۳.۴ (~۶۴۰ خط) فقط «فهرست‌های خواندنی» است و گارد
//     `test:customer-portal` آن را خط‌به‌خط می‌سنجد؛ ریختن ۴۰۰ خط تازه
//     در همان فایل هم بازبینی را سخت می‌کند هم گارد را شکننده.
//   • الگوی mixin در همین پروژه هست: Object.assign(X.prototype, obj).
//     (ابزار audit:service-surface هم همین را می‌شناسد.)
//
// 🔒 قواعد امنیتی این فایل (هم‌راستا با سرور):
//   ۱) شناسهٔ گله فقط از پاسخ /dashboard/options می‌آید، نه از ورودی آزاد.
//   ۲) هیچ شناسهٔ «مشتری» فرستاده نمی‌شود (سرور از توکن می‌سازد).
//   ۳) شمارهٔ موبایل فقط با کد پیامکی عوض می‌شود (مسیر جدا).
//   ۴) شمارهٔ موبایل هرگز در بدنهٔ PATCH پروفایل نمی‌رود.
//   ۵) اگر مدیر مجوزی را ببندد، تب/دکمه/نمودار همان‌جا حذف می‌شود و
//      هیچ درخواستی هم فرستاده نمی‌شود (سرور مستقل هم ۴۰۳ می‌دهد).
// ============================================================
import { portalApi } from "./portal.api.js";
import {
  renderProfileCard,
  renderProfileEditor,
  renderMobileChangePanel,
  renderDashboardOptions,
  renderDashboardSummary,
  renderDashboardCharts,
  renderDashboardTable,
  renderStandardsChart,
  buildDashboardCsv,
  renderNotice,
} from "./portal.renderer.js";
import { notificationService } from "../../core/services/notification.service.js";

// ============================================================
// پیکربندی دو تب تازه — کلید = مقدار data-portal-tab در HTML
// ============================================================
export const EXTRA_TABS = {
  profile: {
    permission: "customer.portal.profile",
    title: "پروفایل من",
    bodyId: "portalProfileBody",
    statusId: "portalProfileStatus",
  },
  dashboard: {
    permission: "customer.portal.dashboard",
    title: "داشبورد تحلیلی",
    bodyId: "portalDashboardBody",
    statusId: "portalDashboardStatus",
  },
};

// قالب موبایل ایران (هم‌قاعده با سرور: ۱۱ رقم و شروع ۰۹)
const MOBILE_PATTERN = /^09\d{9}$/;

// ارقام فارسی/عربی → لاتین
const toLatinDigits = (value) =>
  String(value ?? "")
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));

const payloadDataOf = (payload) => (payload && payload.data ? payload.data : {});

// ============================================================
// mixin — متدها روی PortalService.prototype سوار می‌شوند
// ============================================================
export const portalExtraMixin = {
  // وضعیت داخلی دو تب تازه
  initExtra() {
    this.extra = {
      profile: { loaded: false, loading: false, profile: null, canEdit: false },
      dashboard: { loaded: false, loading: false, charts: null, analysis: null },
    };
    this.profileEditing = false;
    this.mobileStage = null; // null | "request" | "confirm"
    this.mobileChallenge = null; // { challenge_id, mobile_masked }
    this.dashboardSelection = { flockGroupId: "" };
    this.extraBound = false;
  },

  // گیت UI برای «ویرایش پروفایل» — منبع اول: پاسخ سرور (features)
  canEditProfile() {
    const features = this.data && this.data.features;
    if (features && typeof features.can_edit_profile === "boolean") {
      return features.can_edit_profile;
    }
    const service = typeof window !== "undefined" ? window.permissionService : null;
    if (!service || typeof service.can !== "function") return false;
    if (typeof service.hasData === "function" && !service.hasData()) return false;
    return Boolean(service.can("customer.portal.profile.edit"));
  },

  canExportDashboard() {
    const features = this.data && this.data.features;
    if (features && typeof features.dashboard_export === "boolean") {
      return features.dashboard_export;
    }
    return this.canPermission("customer.portal.dashboard.export");
  },

  canCompareDashboard() {
    const features = this.data && this.data.features;
    if (features && typeof features.dashboard_compare === "boolean") {
      return features.dashboard_compare;
    }
    return this.canPermission("customer.portal.dashboard.compare");
  },

  // کمکی: مجوز کلاینت با fail-open (هم‌قاعده با canSee)
  canPermission(key) {
    const service = typeof window !== "undefined" ? window.permissionService : null;
    if (!service || typeof service.can !== "function") return true;
    if (typeof service.hasData === "function" && !service.hasData()) return true;
    return Boolean(service.can(key));
  },

  // ===== اتصال رویدادها (یک‌بار) =====
  bindExtra() {
    if (this.extraBound) return;
    if (typeof document === "undefined" || !document.addEventListener) return;
    this.extraBound = true;

    const profileBody = this.el(EXTRA_TABS.profile.bodyId);
    if (profileBody) {
      profileBody.addEventListener("click", (event) => {
        const target = event.target;
        if (target.closest("[data-profile-edit]")) return this.showProfileEditor();
        if (target.closest("[data-profile-cancel]")) return this.hideProfileEditor();
        if (target.closest("[data-profile-save]")) return this.saveProfile();
        if (target.closest("[data-profile-mobile-open]")) return this.startMobileChange();
        if (target.closest("[data-mobile-request]")) return this.submitMobileRequest();
        if (target.closest("[data-mobile-resend]")) return this.submitMobileRequest(true);
        if (target.closest("[data-mobile-confirm]")) return this.submitMobileConfirm();
        if (target.closest("[data-mobile-cancel]")) return this.cancelMobileChange();
        return null;
      });
    }

    const dashboardBody = this.el(EXTRA_TABS.dashboard.bodyId);
    if (dashboardBody) {
      dashboardBody.addEventListener("click", (event) => {
        const target = event.target;
        if (target.closest("[data-dashboard-apply]")) return this.applyDashboardSelection();
        if (target.closest("[data-dashboard-export]")) return this.exportDashboardCsv();
        return null;
      });
      dashboardBody.addEventListener("change", (event) => {
        const select = event.target.closest("[data-dashboard-flock]");
        if (!select) return null;
        this.dashboardSelection = { flockGroupId: select.value || "" };
        return this.applyDashboardSelection();
      });
    }
  },

  // ===== ورود تب تازه =====
  async loadExtraTab(key) {
    const conf = EXTRA_TABS[key];
    if (!conf) return;
    if (key === "profile") return this.loadProfileTab();
    if (key === "dashboard") return this.loadDashboardTab();
    return undefined;
  },

  setExtraStatus(key, status, message = "") {
    const conf = EXTRA_TABS[key];
    const box = conf ? this.el(conf.statusId) : null;
    if (!box) return;
    if (status === "loading") {
      box.innerHTML = `<span class="portal-tab__loading"><i class="fas fa-spinner fa-spin" aria-hidden="true"></i> در حال دریافت…</span>`;
      return;
    }
    if (status === "error") {
      box.innerHTML = renderNotice(
        "دریافت این بخش ناموفق بود",
        message || "ارتباط با سرور برقرار نشد. سایر بخش‌های پورتال در دسترس هستند.",
        "error",
      );
      return;
    }
    box.innerHTML = "";
  },

  // ============================================================
  // تب «پروفایل من»
  // ============================================================
  async loadProfileTab() {
    const state = this.extra.profile;
    if (state.loading) return;
    state.loading = true;
    this.setExtraStatus("profile", "loading");

    try {
      const data = payloadDataOf(await portalApi.getProfile());
      state.profile = data.profile || null;
      state.canEdit =
        typeof data.can_edit === "boolean" ? data.can_edit : this.canEditProfile();
      state.loaded = true;
      state.loading = false;
      this.renderProfile();
      this.setExtraStatus("profile", "ready");
    } catch (error) {
      state.loading = false;
      this.setExtraStatus("profile", "error", this.errorMessageOf(error));
    }
  },

  renderProfile() {
    const body = this.el(EXTRA_TABS.profile.bodyId);
    const state = this.extra.profile;
    if (!body) return;

    if (!state.profile) {
      body.innerHTML = renderNotice(
        "پروفایل در دسترس نیست",
        "اطلاعات پروندهٔ شما دریافت نشد. لطفاً دوباره تلاش کنید.",
        "info",
      );
      return;
    }

    const editorOpen = this.profileEditing && state.canEdit;
    body.innerHTML = editorOpen
      ? renderProfileEditor(state.profile, {})
      : renderProfileCard(state.profile, { canEdit: state.canEdit });

    if (this.mobileStage) {
      body.insertAdjacentHTML(
        "beforeend",
        renderMobileChangePanel(state.profile, { stage: this.mobileStage }),
      );
    }
  },

  showProfileEditor() {
    if (!this.extra.profile.canEdit) return;
    this.profileEditing = true;
    this.mobileStage = null;
    this.renderProfile();
  },

  hideProfileEditor() {
    this.profileEditing = false;
    this.renderProfile();
  },

  // جمع‌آوری مقادیر فرم — فقط فیلدهای data-profile-field
  readProfileForm() {
    const body = this.el(EXTRA_TABS.profile.bodyId);
    const patch = {};
    if (!body) return patch;
    Array.from(body.querySelectorAll("[data-profile-field]")).forEach((input) => {
      const field = input.getAttribute("data-profile-field");
      if (!field) return;
      patch[field] = String(input.value ?? "").trim();
    });
    return patch;
  },

  showProfileErrors(errors = {}) {
    const box =
      this.el("portalProfileErrors") || this.el("portalMobileErrors");
    if (!box) return;
    const messages = Object.values(errors || {}).filter(Boolean);
    box.innerHTML = messages.length
      ? messages.map((message) => `<span>${String(message)}</span>`).join("")
      : "";
  },

  async saveProfile() {
    const state = this.extra.profile;
    if (!state.canEdit) return;

    const patch = this.readProfileForm();
    this.showProfileErrors({});

    try {
      const data = payloadDataOf(await portalApi.updateProfile(patch));
      state.profile = data.profile || state.profile;
      this.profileEditing = false;
      this.renderProfile();
      this.setExtraStatus("profile", "ready");

      const changed = Array.isArray(data.changed) ? data.changed.length : 0;
      notificationService.notifyOnce({
        key: "portal-profile-saved",
        message: changed
          ? `✅ پروفایل به‌روزرسانی شد (${changed} مورد)`
          : "ℹ️ تغییری برای ذخیره وجود نداشت",
        type: "success",
        cooldownMs: 8000,
      });

      // سرور ممکن است شمارنده‌های خلاصه را هم تحت تأثیر قرار دهد
      // (نام/نام مرغداری در هیرو) ⇒ بدون رفرش صفحه، خلاصه دوباره خوانده می‌شود.
      this.refreshSummarySilently();
    } catch (error) {
      const errors = (error && error.errors) || {};
      this.showProfileErrors(
        Object.keys(errors).length
          ? errors
          : { general: this.errorMessageOf(error) },
      );
      notificationService.notifyOnce({
        key: "portal-profile-save-error",
        message: `⚠️ ${this.errorMessageOf(error)}`,
        type: "error",
        cooldownMs: 15000,
      });
    }
  },

  // خلاصه را بی‌صدا (بدون تغییر وضعیت صفحه) تازه می‌کند
  async refreshSummarySilently() {
    try {
      const data = payloadDataOf(await portalApi.getSummary());
      if (!data || !data.customer) return;
      this.data = data;
      this.render(data);
    } catch {
      // نادیده: خلاصهٔ قدیمی هم قابل استفاده است
    }
  },

  // ============================================================
  // تغییر شمارهٔ موبایل — فقط با کد پیامکی (سه گام سمت کلاینت)
  //   ۱) باز کردن پنل  → ۲) درخواست کد → ۳) تأیید کد
  //   🔒 شمارهٔ فعلی هرگز با PATCH عوض نمی‌شود (سرور هم اجازه نمی‌دهد).
  // ============================================================
  startMobileChange() {
    if (!this.extra.profile.canEdit) return;
    this.profileEditing = false;
    this.mobileStage = "request";
    this.mobileChallenge = null;
    this.renderProfile();
  },

  cancelMobileChange() {
    this.mobileStage = null;
    this.mobileChallenge = null;
    this.renderProfile();
  },

  async submitMobileRequest(isResend = false) {
    const body = this.el(EXTRA_TABS.profile.bodyId);
    const input = body ? body.querySelector("[data-mobile-input]") : null;
    const raw = input ? input.value : "";
    const mobile = toLatinDigits(raw).replace(/\D/g, "");

    if (!MOBILE_PATTERN.test(mobile)) {
      this.showProfileErrors({
        mobile_number: "شمارهٔ موبایل باید ۱۱ رقم و با ۰۹ شروع شود",
      });
      return;
    }
    this.showProfileErrors({});

    try {
      const data = payloadDataOf(await portalApi.requestMobileChange(mobile));
      this.mobileStage = "confirm";
      this.mobileChallenge = {
        challenge_id: data.challenge_id || "",
        mobile_masked: data.mobile_masked || "",
        mobile_number: mobile,
      };
      this.renderProfile();
      notificationService.notifyOnce({
        key: "portal-mobile-otp-sent",
        message: isResend
          ? "🔄 کد تأیید دوباره ارسال شد"
          : "📩 کد تأیید به شمارهٔ جدید ارسال شد",
        type: "info",
        cooldownMs: 6000,
      });
    } catch (error) {
      this.showProfileErrors({ mobile_number: this.errorMessageOf(error) });
    }
  },

  async submitMobileConfirm() {
    const body = this.el(EXTRA_TABS.profile.bodyId);
    const input = body ? body.querySelector("[data-mobile-code]") : null;
    const code = toLatinDigits(input ? input.value : "").replace(/\D/g, "");

    if (code.length !== 6) {
      this.showProfileErrors({ code: "کد تأیید باید ۶ رقم باشد" });
      return;
    }
    if (!this.mobileChallenge || !this.mobileChallenge.challenge_id) {
      this.showProfileErrors({ code: "چالش تأیید منقضی شده است؛ کد را دوباره بگیرید" });
      return;
    }
    this.showProfileErrors({});

    try {
      const data = payloadDataOf(
        await portalApi.confirmMobileChange({
          challengeId: this.mobileChallenge.challenge_id,
          code,
        }),
      );
      this.mobileStage = null;
      this.mobileChallenge = null;
      if (data.profile) this.extra.profile.profile = data.profile;
      this.renderProfile();
      notificationService.notifyOnce({
        key: "portal-mobile-changed",
        message: "✅ شمارهٔ موبایل تغییر کرد",
        type: "success",
        cooldownMs: 10000,
      });
      this.refreshSummarySilently();
    } catch (error) {
      this.showProfileErrors({ code: this.errorMessageOf(error) });
    }
  },

  // پیام خطای قابل‌فهم (بدون متن خالی یا «HTTP error»)
  errorMessageOf(error) {
    const message = String((error && error.message) || "").trim();
    if (!message || /^HTTP error/i.test(message)) {
      return "ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کنید.";
    }
    return message;
  },

  // ============================================================
  // تب «داشبورد تحلیلی»
  // ------------------------------------------------------------
  //  مسیر داده (همه اسکوپ‌شده به پروندهٔ خودم در سرور):
  //   options  → گله‌های من + کدام نمودار مجاز است (charts)
  //   summary  → شمارنده‌های من (بدون آمار سایر مشتریان)
  //   charts   → سری‌های وزن/تلفات/دان (flockGroupId از options)
  //   analysis → وزن واقعی vs استاندارد نژاد
  // ============================================================
  async loadDashboardTab() {
    const state = this.extra.dashboard;
    if (state.loading) return;
    state.loading = true;
    this.setExtraStatus("dashboard", "loading");

    try {
      const [options, summary] = await Promise.all([
        portalApi.getDashboardOptions().then(payloadDataOf),
        portalApi.getDashboardSummary().then(payloadDataOf),
      ]);

      state.options = options || {};
      state.summary = summary || {};
      state.loaded = true;
      this.renderDashboardSummaryBlock();
      this.renderDashboardOptionsBlock();
      await this.loadDashboardCharts();
      state.loading = false;
      this.setExtraStatus("dashboard", "ready");
    } catch (error) {
      state.loading = false;
      this.setExtraStatus("dashboard", "error", this.errorMessageOf(error));
    }
  },

  renderDashboardOptionsBlock() {
    const box = this.el("portalDashboardOptions");
    const state = this.extra.dashboard;
    if (!box) return;
    box.innerHTML = renderDashboardOptions(state.options || {}, {
      canExport: this.canExportDashboard(),
      selectedFlockGroupId: this.dashboardSelection.flockGroupId,
    });
  },

  renderDashboardSummaryBlock() {
    const box = this.el("portalDashboardSummary");
    const state = this.extra.dashboard;
    if (!box) return;
    box.innerHTML = renderDashboardSummary(state.summary || {});
  },

  // گلهٔ انتخابی: فقط از گله‌های خودم (options)؛ اعتبارسنجی در portal.api
  applyDashboardSelection() {
    this.dashboardSelection = {
      flockGroupId: String(this.dashboardSelection.flockGroupId || "").trim(),
    };
    return this.loadDashboardCharts();
  },

  async loadDashboardCharts() {
    const state = this.extra.dashboard;
    const chartsBox = this.el("portalDashboardCharts");
    const tableBox = this.el("portalDashboardCompare");
    const standardsBox = this.el("portalDashboardStandards");
    const selection = {};
    if (this.dashboardSelection.flockGroupId) {
      selection.flockGroupId = this.dashboardSelection.flockGroupId;
    }

    if (chartsBox) {
      chartsBox.innerHTML = `<span class="portal-tab__loading">
        <i class="fas fa-spinner fa-spin" aria-hidden="true"></i> در حال دریافت نمودارها…
      </span>`;
    }

    const allowed = (state.options && state.options.charts) || {};

    try {
      const charts = payloadDataOf(await portalApi.getDashboardCharts(selection));
      state.charts = charts || {};
      if (chartsBox) {
        chartsBox.innerHTML = renderDashboardCharts(state.charts, { charts: allowed });
      }
      if (tableBox) {
        tableBox.innerHTML = renderDashboardTable(state.charts, {
          canCompare: this.canCompareDashboard(),
        });
      }
    } catch (error) {
      if (chartsBox) {
        chartsBox.innerHTML = renderNotice(
          "دریافت نمودارها ناموفق بود",
          this.errorMessageOf(error),
          "error",
        );
      }
    }

    // مقایسه با استاندارد نژاد — فقط اگر مجوزش باز باشد
    if (standardsBox && allowed.standards !== false) {
      try {
        const analysis = payloadDataOf(await portalApi.getDashboardAnalysis());
        state.analysis = analysis || {};
        standardsBox.innerHTML = renderStandardsChart(state.analysis, { charts: allowed });
      } catch (error) {
        standardsBox.innerHTML = renderNotice(
          "دریافت استاندارد نژاد ناموفق بود",
          this.errorMessageOf(error),
          "error",
        );
      }
    } else if (standardsBox) {
      standardsBox.innerHTML = "";
    }
  },

  // خروجی CSV از همان دادهٔ روی صفحه (بدون اندپوینت اضافه)
  // 🔒 فقط اگر کلید customer.portal.dashboard.export باز باشد.
  exportDashboardCsv() {
    if (!this.canExportDashboard()) return;
    const state = this.extra.dashboard;
    const charts = state.charts || {};
    const rows = Array.isArray(charts.flocks) ? charts.flocks : [];
    if (rows.length === 0) {
      notificationService.notifyOnce({
        key: "portal-dashboard-export-empty",
        message: "ℹ️ داده‌ای برای خروجی وجود ندارد",
        type: "info",
        cooldownMs: 8000,
      });
      return;
    }

    // BOM برای نمایش درست فارسی در Excel
    const csv = `\uFEFF${buildDashboardCsv(charts)}`;
    try {
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `portal-dashboard-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      notificationService.notifyOnce({
        key: "portal-dashboard-export-error",
        message: `⚠️ ${this.errorMessageOf(error)}`,
        type: "error",
        cooldownMs: 15000,
      });
    }
  },
};

// متدهای این فایل روی نمونهٔ PortalService سوار می‌شوند
// (هم‌الگو با mixinهای همین پروژه: Object.assign(X.prototype, obj))
export const applyPortalExtra = (ServiceClass) => {
  Object.assign(ServiceClass.prototype, portalExtraMixin);
  return ServiceClass;
};
