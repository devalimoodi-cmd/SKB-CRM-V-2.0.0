// ============================================================
// features/portal-requests/portal-requests.manager.js
// مدیر صف «درخواست‌های پورتال» در پنل مدیریت — موج ۱۳.۱۱
// ------------------------------------------------------------
//  چرا فایل جدا و بارگذاری دینامیک؟
//   admin-panel.service.js بیش از ۲۵۰۰ خط است؛ صف تازه یک ماژول
//   مستقل است که فقط با `await import()` از همان سرویس بارگذاری
//   می‌شود (هم‌الگو با permission.manager / activity-log).
//
// 🔒 قواعد:
//  ۱) تأیید/رد فقط با مجوز portal.requests.review نمایش داده می‌شود؛
//     سرور هم مستقل همان را می‌سنجد (کلید در روتر).
//  ۲) تأیید = تراکنش در سرور؛ اگر خطا بدهد هیچ تغییری ثبت نشده و
//     پیام در همان مودال نمایش داده می‌شود.
//  ۳) کارشناس می‌تواند مقادیر را پیش از تأیید اصلاح کند؛ سرور همان
//     فهرست سفید/اعتبارسنجی را روی نسخهٔ اصلاح‌شده اجرا می‌کند.
//  ۴) هیچ شناسهٔ مشتری دستی وارد نمی‌شود؛ جست‌وجو فقط متن (نام/کد)
//     یا شناسهٔ پرونده است و سرور آن را محدود می‌کند.
// ============================================================
import { portalRequestsApi } from "./portal-requests.api.js";
import {
  REQUEST_TYPE_LABELS,
  renderQueue,
  renderReviewModalBody,
} from "./portal-requests.renderer.js";
import { notificationService } from "../../core/services/notification.service.js";
import { permissionService } from "../../core/services/permission.service.js";

const BADGE_ID = "portalRequestsMenuBadge";
const QUEUE_ID = "portalRequestsQueue";
const MODAL_ID = "portalRequestsModal";
const MODAL_BODY_ID = "portalRequestsModalBody";
const FILTER_IDS = {
  status: "prqStatusFilter",
  type: "prqTypeFilter",
  search: "prqSearchInput",
  refresh: "prqRefreshBtn",
};

const el = (id) => (typeof document === "undefined" ? null : document.getElementById(id));

const payloadDataOf = (payload) => (payload && payload.data ? payload.data : {});

const errorMessageOf = (error) =>
  (error && (error.message || (error.data && error.data.message))) ||
  "خطای نامشخص";

// آیا کاربر مجوز تصمیم‌گیری دارد؟ (سرور هم مستقل می‌سنجد)
const canReviewRequests = () => {
  try {
    if (permissionService.hasData && !permissionService.hasData()) return true;
    return Boolean(permissionService.can("portal.requests.review"));
  } catch {
    return true; // fail-open: سرور مانع می‌شود
  }
};

export const portalRequestsManager = {
  state: {
    items: [],
    pagination: {},
    pending: 0,
    status: "pending",
    type: "",
    search: "",
    page: 1,
    activeId: null,
    loading: false,
    bound: false,
  },

  init(containerSelector = "#portal-requests") {
    const root =
      typeof document === "undefined"
        ? null
        : document.querySelector(containerSelector);
    if (!root) return;

    this.bind();
    return this.load();
  },

  // ===== اتصال رویدادها (یک‌بار) =====
  bind() {
    const root = el("portal-requests");
    if (!root || this.state.bound) return;
    this.state.bound = true;

    const statusFilter = el(FILTER_IDS.status);
    if (statusFilter) {
      statusFilter.addEventListener("change", () => {
        this.state.status = statusFilter.value;
        this.state.page = 1;
        this.load();
      });
    }

    const typeFilter = el(FILTER_IDS.type);
    if (typeFilter) {
      typeFilter.addEventListener("change", () => {
        this.state.type = typeFilter.value;
        this.state.page = 1;
        this.load();
      });
    }

    const searchInput = el(FILTER_IDS.search);
    if (searchInput) {
      searchInput.addEventListener("change", () => {
        this.state.search = searchInput.value;
        this.state.page = 1;
        this.load();
      });
    }

    const refreshBtn = el(FILTER_IDS.refresh);
    if (refreshBtn) refreshBtn.addEventListener("click", () => this.load());

    root.addEventListener("click", (event) => {
      const target = event.target;
      if (!target || !target.closest) return;

      const approveBtn = target.closest("[data-prq-approve]");
      if (approveBtn) {
        return this.openReview(approveBtn.getAttribute("data-prq-approve"));
      }

      const rejectBtn = target.closest("[data-prq-reject]");
      if (rejectBtn) {
        return this.openReview(rejectBtn.getAttribute("data-prq-reject"));
      }

      const pageBtn = target.closest("[data-prq-page]");
      if (pageBtn) {
        this.state.page = Number(pageBtn.getAttribute("data-prq-page")) || 1;
        return this.load();
      }

      if (target.closest("[data-prq-modal-close]")) return this.closeModal();
      if (target.closest("[data-prq-modal-approve]")) return this.approveActive();
      if (target.closest("[data-prq-modal-reject]")) return this.rejectActive();

      return undefined;
    });
  },

  // ===== بارگذاری صف =====
  async load() {
    if (this.state.loading) return;
    this.state.loading = true;

    const container = el(QUEUE_ID);
    if (container) {
      container.innerHTML = `
        <div class="prq-empty">
          <i class="fas fa-spinner fa-spin"></i>
          <p>در حال بارگذاری درخواست‌ها…</p>
        </div>`;
    }

    try {
      const data = payloadDataOf(
        await portalRequestsApi.list({
          status: this.state.status,
          type: this.state.type,
          search: this.state.search,
          page: this.state.page,
          limit: 20,
        }),
      );

      this.state.items = Array.isArray(data.items) ? data.items : [];
      this.state.pagination = data.pagination || {};
      this.state.pending = Number(data.pending) || 0;

      if (container) {
        container.innerHTML = renderQueue({
          items: this.state.items,
          pagination: this.state.pagination,
          canReview: canReviewRequests(),
        });
      }

      this.refreshBadge(this.state.pending);
    } catch (error) {
      if (container) {
        container.innerHTML = `
          <div class="prq-empty prq-empty--error">
            <i class="fas fa-triangle-exclamation"></i>
            <p>${errorMessageOf(error)}</p>
            <button type="button" class="prq-btn" data-prq-page="${this.state.page}">
              تلاش دوباره
            </button>
          </div>`;
      }
      notificationService.notifyOnce({
        key: "prq-load-error",
        message: `⚠️ ${errorMessageOf(error)}`,
        type: "error",
        cooldownMs: 15000,
      });
    } finally {
      this.state.loading = false;
    }
  },

  // شمارندهٔ منو (بهترین‌تلاش — خطا آن را متوقف نمی‌کند)
  async refreshBadge(fallback = null) {
    const badge = el(BADGE_ID);
    if (!badge) return;

    let pending = fallback;
    if (pending === null || pending === undefined) {
      try {
        const data = payloadDataOf(await portalRequestsApi.pendingCount());
        pending = Number(data.pending) || 0;
      } catch {
        return;
      }
    }

    const count = Number(pending) || 0;
    badge.textContent = String(count);
    badge.style.display = count > 0 ? "inline-block" : "none";
  },

  // ===== مودال بازبینی =====
  async openReview(id) {
    if (!canReviewRequests()) return;

    const modal = el(MODAL_ID);
    const body = el(MODAL_BODY_ID);
    if (!modal || !body) return;

    this.state.activeId = String(id ?? "");
    body.innerHTML = `
      <div class="prq-empty">
        <i class="fas fa-spinner fa-spin"></i>
        <p>در حال دریافت جزئیات…</p>
      </div>`;
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");

    try {
      const data = payloadDataOf(await portalRequestsApi.detail(id));
      const request = data.request || {};
      body.innerHTML = renderReviewModalBody(request);
    } catch (error) {
      body.innerHTML = `
        <div class="prq-empty prq-empty--error">
          <i class="fas fa-triangle-exclamation"></i>
          <p>${errorMessageOf(error)}</p>
        </div>`;
    }
  },

  closeModal() {
    const modal = el(MODAL_ID);
    if (!modal) return;
    this.state.activeId = null;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
  },

  // خواندن مقادیر اصلاح‌شده از مودال (فقط کلیدهای نمایش‌داده‌شده)
  readPayloadInputs() {
    const payload = {};
    const container = el("prqPayloadFields");
    if (!container) return payload;

    container.querySelectorAll("[data-prq-key]").forEach((node) => {
      const key = node.getAttribute("data-prq-key");
      const type = node.getAttribute("data-prq-type");
      if (!key) return;

      if (type === "boolean") {
        payload[key] = Boolean(node.checked);
        return;
      }

      const raw = String(node.value ?? "").trim();
      if (!raw) return;

      if (type === "number") {
        const parsed = Number(raw);
        if (Number.isFinite(parsed)) payload[key] = parsed;
        return;
      }

      payload[key] = raw.slice(0, 500);
    });

    return payload;
  },

  async approveActive() {
    const id = this.state.activeId;
    if (!id) return;

    try {
      await portalRequestsApi.approve(id, this.readPayloadInputs());
      notificationService.notifyOnce({
        key: "prq-approved",
        message: "✅ درخواست تأیید و در سیستم اعمال شد",
        type: "success",
        cooldownMs: 8000,
      });
      this.closeModal();
      await this.load();
    } catch (error) {
      notificationService.notifyOnce({
        key: "prq-approve-error",
        message: `⚠️ ${errorMessageOf(error)}`,
        type: "error",
        cooldownMs: 15000,
      });
    }
  },

  async rejectActive() {
    const id = this.state.activeId;
    if (!id) return;

    const reasonNode = el("prqRejectReason");
    const reason = reasonNode ? String(reasonNode.value ?? "").trim() : "";

    if (reason.length < 3) {
      notificationService.notifyOnce({
        key: "prq-reject-reason",
        message: "دلیل رد را بنویسید (حداقل ۳ کاراکتر)",
        type: "error",
        cooldownMs: 8000,
      });
      return;
    }

    try {
      await portalRequestsApi.reject(id, reason);
      notificationService.notifyOnce({
        key: "prq-rejected",
        message: "درخواست رد شد و دلیل برای مشتری ثبت گردید",
        type: "success",
        cooldownMs: 8000,
      });
      this.closeModal();
      await this.load();
    } catch (error) {
      notificationService.notifyOnce({
        key: "prq-reject-error",
        message: `⚠️ ${errorMessageOf(error)}`,
        type: "error",
        cooldownMs: 15000,
      });
    }
  },

  // برچسب نوع (برای استفادهٔ احتمالی تست/UI)
  typeLabel(key) {
    return REQUEST_TYPE_LABELS[key] || key;
  },
};

if (typeof window !== "undefined") {
  window.portalRequestsManager = portalRequestsManager;
}

export default portalRequestsManager;
