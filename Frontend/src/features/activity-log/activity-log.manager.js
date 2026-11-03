// ============================================================
// features/activity-log/activity-log.manager.js
// «فعالیت کاربران» — بخش مدیریتی در پنل ادمین (فاز ۱۲.۳)
// ------------------------------------------------------------
//  • فهرست + فیلتر (عمل/وضعیت/کاربر/موجودیت/بازهٔ تاریخ) + صفحه‌بندی
//  • کارت خلاصه (کل/موفق/ناموفق/کاربران یکتا) — یک‌بار در ورود به بخش
//  • مودال جزئیات هر رویداد (فیلدهای تغییرکرده، مرورگر، مسیر)
//  • خروجی CSV سمت کلاینت (با BOM تا اکسل فارسی را درست بخواند)
//  • لینک رکورد هدف فقط با مجوز مقصد (بدون لینک مرده)
//  • ورودی «تاریخچهٔ رکورد/کاربر» از پنل و پروندهٔ مشتری (موج ۱۲.۴.۱):
//    queueHistory ⇒ applyPendingHistory (بدون وابستگی به آماده‌بودن بخش)
// ------------------------------------------------------------
//  ⚠️ دسترسی: کلید محتوایی users.activity.view (سرور هم همان را
//     enforce می‌کند)؛ کلید منو admin.menu.activity فقط سایدبار است.
//  ⚠️ هیچ pollingای نداریم: ردّ فعالیت سنگین است و مدیر با دکمهٔ
//     «به‌روزرسانی» تازه‌اش می‌کند (هم‌الگوی بخش‌های دیگر پنل).
// ============================================================
import { activityService } from "../../core/services/activity.service.js";
import { permissionService } from "../../core/services/permission.service.js";
import { notificationService } from "../../core/services/notification.service.js";
import { loaderService } from "../../shared/components/Loader/loader.service.js";
import { escapeHtml } from "../../core/utils/string.utils.js";
import { convertGregorianToPersian } from "../../core/utils/date.utils.js";
import {
  EMPTY_FILTERS,
  activeFilterCount,
  buildCsv,
  buildQuery,
  historyContext,
  persianDateFilterToIso,
  validateFilters,
} from "./activity-log.view.js";
import {
  renderActionOptions,
  renderDetail,
  renderEntityOptions,
  renderNotice,
  renderPager,
  renderShell,
  renderSummary,
  renderTable,
} from "./activity-log.renderer.js";

const CONTAINER = "#activityLogContainer";

class ActivityLogManager {
  constructor() {
    this.root = null;
    this.items = [];
    this.summary = null;
    this.pagination = { page: 1, limit: 25, total: 0, total_pages: 1 };
    this.filters = { ...EMPTY_FILTERS };
    this.loading = false;
    this.bound = false;
    this.initialized = false;
    // ✅ موج ۱۲.۴.۱ — درخواست تاریخچه‌ای که پیش از آماده‌شدن بخش می‌رسد
    this.pendingHistory = null;
  }

  can(key) {
    return permissionService.can(key);
  }

  // ===== راه‌اندازی (مثل بقیهٔ بخش‌ها یک‌بار صدا زده می‌شود) =====
  async init(selector = CONTAINER) {
    this.root = document.querySelector(selector);
    if (!this.root) return;

    this.root.innerHTML = renderShell();
    if (!this.bound) {
      this.bindEvents();
      this.bound = true;
    }

    this.syncFilterInputs();
    this.setupDatepickers();
    await this.refresh();
    // ✅ موج ۱۲.۴.۱ — اگر درخواست تاریخچه پیش از init رسیده باشد،
    //    همین‌جا اعمال می‌شود (وگرنه صف تا ابد بی‌مصرف می‌ماند).
    await this.applyPendingHistory();
    this.initialized = true;
    console.log("✅ ActivityLogManager initialized");
  }

  // ===== رویدادها (فقط یک‌بار bind می‌شوند) =====
  bindEvents() {
    const on = (selector, event, handler) => {
      this.root.querySelector(selector)?.addEventListener(event, handler);
    };

    on("#alpApply", "click", () => this.applyFilters());
    on("#alpReset", "click", () => this.resetFilters());
    on("#alpRefresh", "click", () => this.refresh());
    on("#alpExport", "click", () => this.exportCsv());
    on("#alpLimit", "change", () => this.applyFilters());
    on("#alpDetailClose", "click", () => this.closeDetail());

    // Enter در فیلترها = اعمال فیلتر
    this.root.querySelectorAll(".alp-field input").forEach((input) => {
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") this.applyFilters();
      });
    });

    // کلیک روی ردیف ⇒ مودال جزئیات (لینک رکورد مستثنی است)
    on("#alpTableWrap", "click", (event) => {
      if (event.target.closest("a")) return;
      const row = event.target.closest(".alp-row");
      if (row) this.openDetail(Number(row.dataset.activityId));
    });

    // صفحه‌بندی
    on("#alpPager", "click", (event) => {
      const button = event.target.closest(".alp-pager-btn");
      if (!button || button.disabled) return;
      const page = Number(button.dataset.page);
      if (Number.isFinite(page) && page > 0) this.goToPage(page);
    });

    // بستن مودال: دکمه، کلیک بیرون، Esc
    const modal = this.root.querySelector("#alpDetailModal");
    modal?.addEventListener("click", (event) => {
      if (event.target === modal) this.closeDetail();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") this.closeDetail();
    });
  }

  // ===== خواندن فیلترها از DOM =====
  readFilters() {
    const value = (selector) => this.root.querySelector(selector)?.value ?? "";
    return {
      action: String(value("#alpAction")).trim(),
      success: String(value("#alpSuccess")).trim(),
      userId: String(value("#alpUserId")).trim(),
      entity: String(value("#alpEntity")).trim(),
      entityId: String(value("#alpEntityId")).trim(),
      // ⭐ ۱۲.۵: فیلتر «همهٔ تغییرات یک مشتری»
      customerId: String(value("#alpCustomerId")).trim(),
      // ⭐ ۱۲.۴.۲: ورودی تاریخ «شمسی» است و همیشه به ISO میلادی تبدیل می‌شود
      from: persianDateFilterToIso(value("#alpFrom")),
      to: persianDateFilterToIso(value("#alpTo")),
    };
  }

  // ===== تقویم شمسی فیلترهای تاریخ (موج ۱۲.۴.۲) =====
  //  • کتابخانه در admin-panel.html لود می‌شود (هم‌الگوی dashboard/customer-list).
  //  • اگر نبود یا خطا داد، ورودی «متن شمسی» دستی کار می‌کند (fail-soft).
  //  • یک منبع حقیقت: متنِ دیده‌شده در ورودی؛ تبدیل در persianDateFilterToIso.
  setupDatepickers() {
    const picker = window.$?.fn?.persianDatepicker;

    ["#alpFrom", "#alpTo"].forEach((selector) => {
      const input = this.root.querySelector(selector);
      if (!input) return;
      if (input.hasAttribute("data-datepicker-initialized")) return;
      input.setAttribute("data-datepicker-initialized", "true");

      if (!picker) {
        input.placeholder = "۱۴۰۴/۰۱/۰۱";
        return;
      }

      try {
        window.$(input).persianDatepicker({
          format: "YYYY/MM/DD",
          autoClose: true,
          initialValue: false,
          observer: true,
          calendar: {
            persian: {
              locale: "fa",
            },
          },
        });
      } catch (error) {
        console.warn("⚠️ تقویم فیلتر تاریخ راه‌اندازی نشد:", error.message);
        input.placeholder = "۱۴۰۴/۰۱/۰۱";
      }
    });
  }

  // ===== نشاندن state روی کنترل‌ها (بعد از «پاک‌کردن» یا deep-link) =====
  syncFilterInputs() {
    const set = (selector, value) => {
      const el = this.root.querySelector(selector);
      if (el) el.value = value ?? "";
    };

    // ISO ذخیره‌شده ⇒ نمایش شمسی در ورودی (خواندنش دوباره ISO می‌کند)
    const setDate = (selector, iso) => {
      set(selector, iso ? convertGregorianToPersian(iso) : "");
    };

    set("#alpAction", this.filters.action);
    set("#alpSuccess", this.filters.success);
    set("#alpUserId", this.filters.userId);
    set("#alpEntity", this.filters.entity);
    set("#alpEntityId", this.filters.entityId);
    set("#alpCustomerId", this.filters.customerId);
    setDate("#alpFrom", this.filters.from);
    setDate("#alpTo", this.filters.to);
    set("#alpLimit", String(this.pagination.limit || 25));
    this.renderFilterCount();
  }

  renderFilterCount() {
    const badge = this.root.querySelector("#alpFilterCount");
    if (!badge) return;
    const count = activeFilterCount(this.filters);
    badge.textContent = count ? `${count} فیلتر فعال` : "";
  }

  // ===== اعمال/پاک‌کردن فیلتر =====
  async applyFilters() {
    const next = this.readFilters();
    const errors = validateFilters(next);
    if (errors.length) {
      notificationService.warning(errors[0]);
      return;
    }

    this.filters = next;
    this.pagination = {
      ...this.pagination,
      page: 1,
      limit: Number(this.root.querySelector("#alpLimit")?.value) || 25,
    };
    this.renderFilterCount();
    await this.loadList();
  }

  async resetFilters() {
    this.filters = { ...EMPTY_FILTERS };
    this.pagination = { ...this.pagination, page: 1 };
    this.syncFilterInputs();
    await this.loadList();
  }

  async goToPage(page) {
    this.pagination = { ...this.pagination, page };
    await this.loadList();
  }

  // ===== تازه‌سازی کامل (خلاصه + فهرست) =====
  async refresh() {
    await Promise.all([this.loadSummary(), this.loadList()]);
  }

  // ===== خلاصهٔ آماری (یک‌بار در ورود به بخش + با دکمهٔ به‌روزرسانی) =====
  async loadSummary() {
    try {
      const data = await activityService.summary({ limit: 1000 });
      if (!data) return;

      this.summary = data;
      const host = this.root.querySelector("#alpSummary");
      if (host) host.innerHTML = renderSummary(data);

      const action = this.root.querySelector("#alpAction");
      if (action) {
        action.innerHTML = renderActionOptions(data.by_action, this.filters.action);
      }

      const entityList = this.root.querySelector("#alpEntityList");
      if (entityList) entityList.innerHTML = renderEntityOptions(data.by_entity);
    } catch (error) {
      // خلاصه «تزئینی» است: خطای آن نباید فهرست را از کار بیندازد
      console.error("❌ خطا در خلاصهٔ فعالیت:", error);
    }
  }

  // ===== فهرست =====
  async loadList() {
    if (this.loading) return;
    await this.setLoading(true);

    try {
      const query = buildQuery(this.filters, {
        page: this.pagination.page,
        limit: this.pagination.limit,
      });
      const data = await activityService.list(query);

      this.items = Array.isArray(data?.activities) ? data.activities : [];
      this.pagination = { ...this.pagination, ...(data?.pagination || {}) };
      this.renderTable();
      this.renderStatus(data?.where_keys);
    } catch (error) {
      console.error("❌ خطا در دریافت ردّ فعالیت:", error);
      const host = this.root.querySelector("#alpTableWrap");
      if (host) {
        host.innerHTML = renderNotice(
          "دریافت ردّ فعالیت ناموفق بود. اگر دسترسی «مشاهدهٔ ردّ فعالیت» را ندارید با مدیر تماس بگیرید.",
          "error",
        );
      }
      const pager = this.root.querySelector("#alpPager");
      if (pager) pager.innerHTML = "";
    } finally {
      await this.setLoading(false);
    }
  }

  renderTable() {
    const host = this.root.querySelector("#alpTableWrap");
    if (host) {
      host.innerHTML = renderTable(this.items, { can: (key) => this.can(key) });
    }
    const pager = this.root.querySelector("#alpPager");
    if (pager) pager.innerHTML = renderPager(this.pagination, this.pagination.page);
  }

  // فیلترهایی که سرور واقعاً اعمال کرده (شفافیت برای مدیر)
  renderStatus(whereKeys = []) {
    const host = this.root.querySelector("#alpStatus");
    if (!host) return;
    const keys = Array.isArray(whereKeys) ? whereKeys.filter(Boolean) : [];
    host.innerHTML = keys.length
      ? `<span class="alp-status-pill"><i class="fas fa-filter"></i> فیلتر سمت سرور: ${escapeHtml(
          keys.join(" · "),
        )}</span>`
      : "";
  }

  // ===== لودر سیستمی (پیرو انتخاب ادمین) با fallback ساده =====
  async setLoading(on) {
    if (!on) {
      this.loading = false;
      return;
    }
    this.loading = true;

    const host = this.root.querySelector("#alpTableWrap");
    if (!host) return;

    let markup = `<div class="alp-loading">در حال بارگذاری…</div>`;
    try {
      const html = await loaderService.inline({ text: "در حال بارگذاری فعالیت‌ها…", size: "sm" });
      if (html) markup = html;
    } catch {
      /* بی‌صدا — همان مارک‌آپ ساده کافی است */
    }

    // ⚠️ فقط اگر در این فاصله پاسخِ تازه‌ای جایگزین نشده باشد
    if (this.loading) host.innerHTML = markup;
  }

  // ===== خروجی CSV (سمت کلاینت — با BOM برای اکسل فارسی) =====
  exportCsv() {
    if (!this.items.length) {
      notificationService.warning("برای خروجی CSV باید حداقل یک ردیف نمایش داده شود");
      return;
    }

    try {
      const csv = buildCsv(this.items);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = `activity-log-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      notificationService.success(`خروجی ${this.items.length} ردیف دانلود شد`);
    } catch (error) {
      console.error("❌ خطا در خروجی CSV:", error);
      notificationService.error("ساخت خروجی CSV ناموفق بود");
    }
  }

  // ===== مودال جزئیات =====
  async openDetail(activityId) {
    if (!activityId) return;

    const modal = this.root.querySelector("#alpDetailModal");
    const body = this.root.querySelector("#alpDetailBody");
    if (!modal || !body) return;

    body.innerHTML = renderNotice("در حال دریافت جزئیات…");
    modal.classList.add("open");

    try {
      const data = await activityService.getById(activityId);
      body.innerHTML = data?.activity
        ? renderDetail(data.activity, { can: (key) => this.can(key) })
        : renderNotice("این رویداد پیدا نشد.", "error");
    } catch (error) {
      console.error("❌ خطا در جزئیات فعالیت:", error);
      body.innerHTML = renderNotice("دریافت جزئیات این رویداد ناموفق بود.", "error");
    }
  }

  closeDetail() {
    this.root?.querySelector("#alpDetailModal")?.classList.remove("open");
  }

  // ===== قلاب موج ۱۲.۴: تاریخچهٔ یک رکورد در همین بخش =====
  //   ⭐ باگ نسخهٔ ۱۲.۳: اگر بخش هنوز init نشده بود (root نداشت) این
  //      متد بی‌صدا هیچ کاری نمی‌کرد ⇒ ورودی «تاریخچه» بی‌اثر می‌شد.
  //      حالا زمینه در صف می‌نشیند و init خودش اعمالش می‌کند.
  queueHistory(input) {
    this.pendingHistory = historyContext(input);
    return this;
  }

  async applyPendingHistory() {
    if (!this.root || !this.pendingHistory) return;

    const ctx = this.pendingHistory;
    this.pendingHistory = null;

    this.filters = {
      ...EMPTY_FILTERS,
      entity: ctx.entity,
      entityId: ctx.entityId,
      // ⭐ ۱۲.۵: زمینهٔ تاریخچه اگر customerId داشت، فیلتر مشتری هم ست شود
      customerId: ctx.customerId ? String(ctx.customerId) : "",
      userId: ctx.userId ? String(ctx.userId) : "",
    };
    this.pagination = { ...this.pagination, page: 1 };

    this.syncFilterInputs();
    await this.loadList();
  }

  // سازگاری با گارد/فراخوانی‌های ۱۲.۳
  async openEntityHistory(entity, entityId) {
    this.queueHistory({ entity, entityId });
    await this.applyPendingHistory();
  }
}

export const activityLogManager = new ActivityLogManager();

// ✅ دسترسی سراسری (هم‌الگوی بقیهٔ سرویس‌های core)
if (typeof window !== "undefined") {
  window.activityLogManager = activityLogManager;
  window.ActivityLogManager = ActivityLogManager;
}

