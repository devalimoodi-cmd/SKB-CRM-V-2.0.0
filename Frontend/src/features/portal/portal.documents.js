// ============================================================
// features/portal/portal.documents.js
// تب «مدارک من» — آپلود/دانلود/حذف نرم مدرک (موج ۱۳.۱۰)
// ------------------------------------------------------------
//  چرا فایل جدا (mixin) و نه همه‌چیز در portal.extra.js؟
//   • portal.extra.js (~۷۳۰ خط) تب‌های «پروفایل» و «داشبورد» را دارد؛
//     آپلود فایل نگرانی جدایی است (FormData، پیشرفت، سهمیه، حذف نرم)
//     و گارد `test:customer-portal` هم آن را جدا می‌سنجد.
//   • الگوی mixin همان است: Object.assign(X.prototype, obj).
//
// 🔒 قواعد این فایل:
//   ۱) هیچ شناسهٔ مشتری فرستاده نمی‌شود (سرور از توکن می‌سازد).
//   ۲) شناسهٔ مدرک فقط از `data-docs-*` پاسخ سرور می‌آید و
//      portal.api آن را با rowId() اعتبارسنجی می‌کند.
//   ۳) حجم/نوع فایل پیش از ارسال سنجیده می‌شود (۵MB · JPG/PNG/WEBP/PDF).
//   ۴) حذف دو مرحله‌ای و بدون `confirm` بومی؛ متن دکمه به مشتری
//      می‌گوید که حذف «نرم» است و بایگانی می‌ماند.
//   ۵) اگر مجوز آپلود/حذف بسته باشد، دکمه ساخته نمی‌شود و هیچ
//      درخواستی هم فرستاده نمی‌شود.
// ============================================================
import {
  portalApi,
  DOCUMENT_KINDS,
  DOCUMENT_MAX_FILE_BYTES,
  DOCUMENT_MAX_COUNT,
  documentFileError,
} from "./portal.api.js";
import {
  renderDocumentList,
  renderDocumentQuota,
  renderDocumentUploadBox,
} from "./portal.renderer.js";
import { notificationService } from "../../core/services/notification.service.js";
// برای واگذاری بارگذاری تب‌های دیگر (پروفایل/داشبورد) به همان mixin
import { portalExtraMixin } from "./portal.extra.js";

// ثبت در همان رجیستری تب‌های خاص (portal.service آن را Object.assign
// می‌کند) ⇒ چرخهٔ پنهان‌سازی/فعال‌سازی و ALL_TAB_KEYS بدون تغییر دوم.
export const DOCUMENT_TABS = {
  documents: {
    permission: "customer.portal.documents",
    title: "مدارک من",
    bodyId: "portalDocsBody",
    statusId: "portalDocsStatus",
  },
};

const payloadDataOf = (payload) => (payload && payload.data ? payload.data : {});

export const portalDocumentsMixin = {
  // ===== وضعیت داخلی =====
  initDocumentsTab() {
    if (!this.extra || typeof this.extra !== "object") this.extra = {};
    this.extra.documents = { loaded: false, loading: false };
    this.documents = {
      items: [],
      meta: null,
      uploading: false,
      progress: 0,
      pendingDelete: null,
    };
    this.documentsBound = false;
  },

  // ===== گیت‌ها (منبع اول: پاسخ سرور، بعد مجوز کلاینت، در نهایت باز) =====
  canUploadDocuments() {
    const features = this.data && this.data.features;
    if (features && typeof features.documents_upload === "boolean") {
      return features.documents_upload;
    }
    return this.canPermission("customer.portal.documents.upload");
  },

  canDeleteDocuments() {
    const features = this.data && this.data.features;
    if (features && typeof features.documents_delete === "boolean") {
      return features.documents_delete;
    }
    return this.canPermission("customer.portal.documents.delete");
  },

  // ===== اتصال رویدادها (یک‌بار) =====
  bindDocuments() {
    if (this.documentsBound) return;
    if (typeof document === "undefined" || !document.addEventListener) return;
    this.documentsBound = true;

    const body = this.el("portalDocsBody");
    if (!body) return;

    body.addEventListener("click", (event) => {
      const target = event.target;
      if (!target || !target.closest) return;

      if (target.closest("[data-docs-upload]")) return this.uploadDocument();

      const download = target.closest("[data-docs-download]");
      if (download) {
        return this.downloadDocument(
          download.getAttribute("data-docs-download"),
          download.getAttribute("data-docs-name") || "",
        );
      }

      const askDelete = target.closest("[data-docs-delete]");
      if (askDelete) {
        return this.requestDeleteDocument(
          askDelete.getAttribute("data-docs-delete"),
        );
      }

      const confirmDelete = target.closest("[data-docs-delete-confirm]");
      if (confirmDelete) {
        return this.confirmDeleteDocument(
          confirmDelete.getAttribute("data-docs-delete-confirm"),
        );
      }

      if (target.closest("[data-docs-delete-cancel]")) {
        return this.cancelDeleteDocument();
      }

      if (target.closest("[data-docs-retry]")) return this.loadDocumentsTab();

      return undefined;
    });
  },

  // ===== ورود تب: همهٔ تب‌های خاص از همین نقطه می‌گذرند =====
  async loadExtraTab(key) {
    if (key === "documents") return this.loadDocumentsTab();
    // پروفایل/داشبورد همان منطق قبلی portal.extra.js
    return portalExtraMixin.loadExtraTab.call(this, key);
  },

  async loadDocumentsTab() {
    const state = this.extra && this.extra.documents;
    if (!state || state.loading) return;
    state.loading = true;
    this.setExtraStatus("documents", "loading");

    try {
      await this.loadDocuments();
      state.loaded = true;
      state.loading = false;
      this.setExtraStatus("documents", "ready");
    } catch (error) {
      state.loading = false;
      this.setExtraStatus("documents", "error", this.errorMessageOf(error));
    }
  },

  // خواندن فهرست + سهمیه از سرور (یک درخواست)
  async loadDocuments() {
    const data = payloadDataOf(
      await portalApi.getDocuments({ page: 1, limit: 50 }),
    );
    const items = Array.isArray(data.items) ? data.items : [];
    const meta = data.meta || (data.pagination ? data.meta : null);

    this.documents.items = items;
    if (meta) this.documents.meta = meta;
    this.documents.pendingDelete = null;
    this.renderDocuments();
  },

  // ===== رندر: سهمیه + فرم + فهرست (هر سه از HTML موجود) =====
  renderDocuments() {
    const state = this.documents;
    const meta = state.meta || {};

    const quota = this.el("portalDocsQuota");
    if (quota) quota.innerHTML = renderDocumentQuota(meta);

    const slot = this.el("portalDocsFormSlot");
    if (slot) {
      slot.innerHTML = renderDocumentUploadBox({
        canUpload: this.canUploadDocuments(),
        kinds: Array.isArray(meta.kinds) && meta.kinds.length
          ? meta.kinds
          : DOCUMENT_KINDS,
      });
    }

    const list = this.el("portalDocsList");
    if (list) {
      list.innerHTML = renderDocumentList(state.items, {
        canDelete: this.canDeleteDocuments(),
        pendingDelete: state.pendingDelete,
      });
    }
  },

  // پیام خطای درون‌فرم (بدون alert)
  setDocumentsError(message = "") {
    const box = this.el("portalDocsError");
    if (box) box.innerHTML = message ? String(message) : "";
  },

  // نوار پیشرفت آپلود
  setDocumentsProgress(percent = 0, visible = false) {
    const box = this.el("portalDocsProgress");
    const bar = this.el("portalDocsBar");
    const label = this.el("portalDocsPercent");
    const safe = Math.min(100, Math.max(0, Math.round(Number(percent) || 0)));

    this.documents.progress = safe;
    if (box) box.hidden = !visible;
    if (bar) bar.style.width = `${safe}%`;
    if (label) label.textContent = `${safe}%`;
  },

  // مقادیر فرم (بدون <form>)
  readDocumentInputs() {
    const fileInput = this.el("portalDocsFile");
    const kindInput = this.el("portalDocsKind");
    const titleInput = this.el("portalDocsTitle");

    return {
      file: fileInput && fileInput.files ? fileInput.files[0] || null : null,
      kind: kindInput ? kindInput.value : "other",
      title: titleInput ? titleInput.value : "",
    };
  },

  // ===== آپلود =====
  async uploadDocument() {
    if (this.documents.uploading) return;
    if (!this.canUploadDocuments()) return;

    this.setDocumentsError("");
    const { file, kind, title } = this.readDocumentInputs();

    // ۱) بررسی کلاینت (سرور مستقل همان را می‌سنجد)
    const problem = documentFileError(file);
    if (problem) return this.setDocumentsError(problem);

    // ۲) سهمیهٔ محلی (اگر فهرست تازه است، جلوی ارسال بیهوده گرفته می‌شود)
    const meta = this.documents.meta || {};
    const maxCount = Number(meta.max_count) || DOCUMENT_MAX_COUNT;
    const count = Number(meta.count) || 0;
    if (count >= maxCount) {
      return this.setDocumentsError(
        `حداکثر ${maxCount} مدرک برای هر پرونده قابل ثبت است`,
      );
    }
    const maxTotal = Number(meta.max_total_bytes) || 0;
    const totalBytes = Number(meta.total_bytes) || 0;
    if (
      maxTotal > 0 &&
      totalBytes + (Number(file.size) || DOCUMENT_MAX_FILE_BYTES) > maxTotal
    ) {
      return this.setDocumentsError(
        "ظرفیت مدارک پرونده تکمیل شده است. ابتدا یکی از مدارک را حذف کنید.",
      );
    }

    // ۳) ارسال با نوار پیشرفت
    this.documents.uploading = true;
    this.setDocumentsProgress(0, true);

    try {
      await portalApi.uploadDocument(file, {
        title,
        kind,
        onProgress: (percent) => this.setDocumentsProgress(percent, true),
      });

      this.setDocumentsProgress(100, true);
      notificationService.notifyOnce({
        key: "portal-document-uploaded",
        message: "✅ مدرک با موفقیت ارسال شد",
        type: "success",
        cooldownMs: 8000,
      });

      await this.loadDocuments();
      this.setExtraStatus("documents", "ready");
    } catch (error) {
      this.setDocumentsError(this.errorMessageOf(error));
      notificationService.notifyOnce({
        key: "portal-document-upload-error",
        message: `⚠️ ${this.errorMessageOf(error)}`,
        type: "error",
        cooldownMs: 15000,
      });
    } finally {
      this.documents.uploading = false;
      this.setDocumentsProgress(0, false);
    }
  },

  // ===== حذف نرم — دو مرحله‌ای و بدون confirm بومی =====
  requestDeleteDocument(id) {
    if (!this.canDeleteDocuments()) return;
    this.documents.pendingDelete = String(id ?? "");
    this.renderDocuments();
  },

  cancelDeleteDocument() {
    this.documents.pendingDelete = null;
    this.renderDocuments();
  },

  async confirmDeleteDocument(id) {
    if (!this.canDeleteDocuments()) return;

    try {
      await portalApi.deleteDocument(id);
      notificationService.notifyOnce({
        key: "portal-document-deleted",
        message: "🗂️ مدرک از فهرست شما حذف شد",
        type: "success",
        cooldownMs: 8000,
      });
      await this.loadDocuments();
      this.setExtraStatus("documents", "ready");
    } catch (error) {
      this.documents.pendingDelete = null;
      this.renderDocuments();
      notificationService.notifyOnce({
        key: "portal-document-delete-error",
        message: `⚠️ ${this.errorMessageOf(error)}`,
        type: "error",
        cooldownMs: 15000,
      });
    }
  },

  // ===== دانلود با توکن (هیچ لینک عمومی) =====
  async downloadDocument(id, name = "") {
    try {
      await portalApi.downloadDocument(id, name || "document");
    } catch (error) {
      notificationService.notifyOnce({
        key: "portal-document-download-error",
        message: `⚠️ ${this.errorMessageOf(error)}`,
        type: "error",
        cooldownMs: 15000,
      });
    }
  },
};

// متدهای این فایل روی PortalService.prototype سوار می‌شوند
// ⚠️ ترتیب مهم است: بعد از applyPortalExtra اجرا شود تا
//    loadExtraTab این فایل بتواند نسخهٔ portal.extra.js را صدا بزند.
export const applyPortalDocuments = (ServiceClass) => {
  Object.assign(ServiceClass.prototype, portalDocumentsMixin);
  return ServiceClass;
};
