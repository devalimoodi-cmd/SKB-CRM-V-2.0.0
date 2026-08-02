import { smsApi } from "./sms.api.js";
import { smsRenderer } from "./sms.renderer.js";
import { smsValidation } from "./sms.validation.js";
import { notificationService } from "../../core/services/notification.service.js";
import { authService } from "../../core/services/auth.service.js";
import { stateService } from "../../core/services/state.service.js";
import {
  convertToPersianDate,
  formatDate,
} from "../../core/utils/date.utils.js";

class SmsService {
  constructor() {
    this.history = [];
    this.templates = [];
    this.stats = null;
    this.credit = 0;
    this.currentPage = 1;
    this.pageSize = 20;
    this.totalPages = 0;
    this.totalItems = 0;
    this.filters = {
      status: "all",
      search: "",
      dateFrom: "",
      dateTo: "",
    };
    this.selectedCustomerId = null;
    this.selectedFlockId = null;
    this.initialized = false;
    this.isSending = false;
  }

  async init() {
    // بررسی دسترسی
    const hasAccess = await authService.checkExpertPageAccess();
    if (!hasAccess) return;

    await this.loadData();
    this.setupEvents();
    this.startAutoRefresh();
    this.initialized = true;
    console.log("✅ SmsService initialized");
  }

  // ===== بارگذاری داده‌ها =====

  async loadData() {
    try {
      await this.loadHistory();
      await this.loadTemplates();
      await this.loadCredit();
      await this.loadStats();
    } catch (error) {
      console.error("❌ Error loading SMS data:", error);
      notificationService.error("خطا در دریافت اطلاعات پیامک");
    }
  }

  async loadHistory() {
    try {
      const params = {
        page: this.currentPage,
        limit: this.pageSize,
        ...this.filters,
      };

      if (this.selectedCustomerId) {
        params.customer_id = this.selectedCustomerId;
      }

      if (this.selectedFlockId) {
        params.flock_id = this.selectedFlockId;
      }

      // حذف فیلترهای خالی
      Object.keys(params).forEach((key) => {
        if (params[key] === "all" || params[key] === "") {
          delete params[key];
        }
      });

      const response = await smsApi.getSmsHistory(null, params);
      if (response.success) {
        this.history = response.data.logs || [];
        this.totalItems = response.data.pagination?.total || 0;
        this.totalPages = response.data.pagination?.totalPages || 0;
        this.renderHistory();
        this.renderPagination();
      }
    } catch (error) {
      console.error("❌ Error loading SMS history:", error);
      this.history = [];
      this.renderHistory();
    }
  }

  async loadTemplates() {
    try {
      const response = await smsApi.getTemplates();
      if (response.success) {
        this.templates = response.data || [];
        this.renderTemplates();
      }
    } catch (error) {
      console.error("❌ Error loading templates:", error);
      this.templates = [];
    }
  }

  async loadCredit() {
    try {
      const response = await smsApi.getCredit();
      if (response.success) {
        this.credit = response.data.credit || 0;
        this.renderCredit();
      }
    } catch (error) {
      console.error("❌ Error loading credit:", error);
      this.credit = 0;
    }
  }

  async loadStats() {
    try {
      const response = await smsApi.getStats();
      if (response.success) {
        this.stats = response.data;
        this.renderStats();
      }
    } catch (error) {
      console.error("❌ Error loading stats:", error);
      this.stats = null;
    }
  }

  // ===== رندر =====

  renderHistory() {
    const container = document.getElementById("smsHistoryList");
    if (!container) return;

    if (this.history.length === 0) {
      container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-sms" style="font-size: 48px; color: #cbd5e1; display: block; margin-bottom: 16px;"></i>
                    <h4 style="font-size: 18px; color: #64748b; margin-bottom: 8px;">هیچ پیامکی ارسال نشده است</h4>
                    <p style="font-size: 14px; color: #94a3b8;">برای شروع، یک پیامک ارسال کنید</p>
                </div>
            `;
      return;
    }

    const html = this.history
      .map((log) => smsRenderer.renderHistoryItem(log))
      .join("");

    container.innerHTML = html;
  }

  renderTemplates() {
    const select = document.getElementById("templateSelect");
    if (!select) return;

    select.innerHTML = `
            <option value="">انتخاب قالب...</option>
            ${this.templates
              .map(
                (t) => `
                <option value="${t.id}">${t.name} - ${t.description || ""}</option>
            `,
              )
              .join("")}
        `;
  }

  renderCredit() {
    const creditEl = document.getElementById("smsCredit");
    if (creditEl) {
      creditEl.textContent = this.credit.toLocaleString();
      creditEl.className =
        this.credit < 10
          ? "credit-low"
          : this.credit < 50
            ? "credit-medium"
            : "credit-high";
    }
  }

  renderStats() {
    if (!this.stats) return;

    const elements = {
      totalSent: document.getElementById("statTotalSent"),
      delivered: document.getElementById("statDelivered"),
      failed: document.getElementById("statFailed"),
      pending: document.getElementById("statPending"),
    };

    if (elements.totalSent)
      elements.totalSent.textContent = this.stats.totalSent || 0;
    if (elements.delivered)
      elements.delivered.textContent = this.stats.delivered || 0;
    if (elements.failed) elements.failed.textContent = this.stats.failed || 0;
    if (elements.pending)
      elements.pending.textContent = this.stats.pending || 0;
  }

  renderPagination() {
    const container = document.getElementById("smsPagination");
    if (!container) return;

    if (this.totalPages <= 1) {
      container.innerHTML = "";
      return;
    }

    let html = "";
    const start = Math.max(1, this.currentPage - 2);
    const end = Math.min(this.totalPages, this.currentPage + 2);

    html += `<button class="page-btn" onclick="window.goToSmsPage(${this.currentPage - 1})" ${this.currentPage === 1 ? "disabled" : ""}>
            <i class="fas fa-chevron-right"></i>
        </button>`;

    if (start > 1) {
      html += `<button class="page-btn" onclick="window.goToSmsPage(1)">1</button>`;
      if (start > 2) html += '<span class="page-dots">...</span>';
    }

    for (let i = start; i <= end; i++) {
      html += `<button class="page-btn ${i === this.currentPage ? "active" : ""}" onclick="window.goToSmsPage(${i})">${i}</button>`;
    }

    if (end < this.totalPages) {
      if (end < this.totalPages - 1)
        html += '<span class="page-dots">...</span>';
      html += `<button class="page-btn" onclick="window.goToSmsPage(${this.totalPages})">${this.totalPages}</button>`;
    }

    html += `<button class="page-btn" onclick="window.goToSmsPage(${this.currentPage + 1})" ${this.currentPage === this.totalPages ? "disabled" : ""}>
            <i class="fas fa-chevron-left"></i>
        </button>`;

    container.innerHTML = html;
  }

  // ===== ارسال پیامک =====

  async sendSms(customerId, message, templateId = null, variables = {}) {
    if (this.isSending) {
      notificationService.warning("در حال ارسال پیامک، لطفاً صبر کنید...");
      return;
    }

    // اعتبارسنجی
    const errors = smsValidation.validateMessage(message);
    if (errors.length > 0) {
      notificationService.showValidationErrors(errors);
      return;
    }

    // بررسی اعتبار
    if (this.credit <= 0) {
      notificationService.error(
        "⚠️ اعتبار پیامک کافی نیست. لطفاً با ادمین تماس بگیرید.",
      );
      return;
    }

    this.isSending = true;

    try {
      let response;
      if (templateId) {
        response = await smsApi.sendWithTemplate(
          customerId,
          templateId,
          variables,
        );
      } else {
        response = await smsApi.sendToCustomer(customerId, message);
      }

      if (response.success) {
        notificationService.success("✅ پیامک با موفقیت ارسال شد");
        await this.loadData();
        return response.data;
      } else {
        notificationService.error(response.message || "خطا در ارسال پیامک");
      }
    } catch (error) {
      console.error("❌ Error sending SMS:", error);
      notificationService.error("خطا در ارتباط با سرور");
    } finally {
      this.isSending = false;
    }
  }

  async sendBulkSms(customerIds, message) {
    if (this.isSending) {
      notificationService.warning("در حال ارسال پیامک، لطفاً صبر کنید...");
      return;
    }

    if (!customerIds || customerIds.length === 0) {
      notificationService.warning("لطفاً حداقل یک مشتری را انتخاب کنید");
      return;
    }

    // اعتبارسنجی
    const errors = smsValidation.validateMessage(message);
    if (errors.length > 0) {
      notificationService.showValidationErrors(errors);
      return;
    }

    // بررسی اعتبار (تعداد پیامک‌ها * اعتبار مورد نیاز)
    const estimatedCost = customerIds.length;
    if (this.credit < estimatedCost) {
      notificationService.error(
        `⚠️ اعتبار پیامک کافی نیست. نیاز به ${estimatedCost} اعتبار دارید.`,
      );
      return;
    }

    const confirmed = await notificationService.confirm({
      title: "📱 ارسال پیامک گروهی",
      text: `آیا از ارسال پیامک به ${customerIds.length} مشتری اطمینان دارید؟`,
      confirmText: "بله، ارسال شود",
      cancelText: "انصراف",
    });

    if (!confirmed) return;

    this.isSending = true;

    try {
      const response = await smsApi.sendBulkToCustomers(customerIds, message);
      if (response.success) {
        notificationService.success(
          `✅ پیامک به ${response.data.sentCount || customerIds.length} مشتری ارسال شد`,
        );
        await this.loadData();
      } else {
        notificationService.error(
          response.message || "خطا در ارسال پیامک گروهی",
        );
      }
    } catch (error) {
      console.error("❌ Error sending bulk SMS:", error);
      notificationService.error("خطا در ارتباط با سرور");
    } finally {
      this.isSending = false;
    }
  }

  // ===== وضعیت پیامک =====

  async checkSmsStatus(messageId) {
    try {
      const response = await smsApi.checkStatus(messageId);
      if (response.success) {
        return response.data;
      }
      return null;
    } catch (error) {
      console.error("❌ Error checking SMS status:", error);
      return null;
    }
  }

  async updateFlockStatus(customerId, flockId) {
    try {
      const response = await smsApi.updateFlockStatus(customerId, flockId);
      if (response.success) {
        notificationService.success("✅ وضعیت پیامک‌ها بروزرسانی شد");
        await this.loadHistory();
      } else {
        notificationService.error(response.message || "خطا در بروزرسانی وضعیت");
      }
    } catch (error) {
      console.error("❌ Error updating flock status:", error);
      notificationService.error("خطا در ارتباط با سرور");
    }
  }

  // ===== فیلترها =====

  applyFilters(filters) {
    this.filters = { ...this.filters, ...filters };
    this.currentPage = 1;
    this.loadHistory();
  }

  resetFilters() {
    this.filters = {
      status: "all",
      search: "",
      dateFrom: "",
      dateTo: "",
    };
    this.selectedCustomerId = null;
    this.selectedFlockId = null;
    this.currentPage = 1;

    // ریست فیلدها
    const searchInput = document.getElementById("smsSearch");
    if (searchInput) searchInput.value = "";

    const statusFilter = document.getElementById("filterStatus");
    if (statusFilter) statusFilter.value = "all";

    const dateFrom = document.getElementById("filterDateFrom");
    if (dateFrom) dateFrom.value = "";

    const dateTo = document.getElementById("filterDateTo");
    if (dateTo) dateTo.value = "";

    this.loadHistory();
  }

  // ===== رویدادها =====

  setupEvents() {
    // ارسال پیامک
    const sendBtn = document.getElementById("sendSmsBtn");
    if (sendBtn) {
      sendBtn.addEventListener("click", () => this.handleSendSms());
    }

    // انتخاب قالب
    const templateSelect = document.getElementById("templateSelect");
    if (templateSelect) {
      templateSelect.addEventListener("change", (e) => {
        const templateId = e.target.value;
        if (templateId) {
          this.applyTemplate(templateId);
        }
      });
    }

    // فیلترها
    const searchInput = document.getElementById("smsSearch");
    if (searchInput) {
      let debounceTimer;
      searchInput.addEventListener("input", () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          this.applyFilters({ search: searchInput.value });
        }, 300);
      });
    }

    const statusFilter = document.getElementById("filterStatus");
    if (statusFilter) {
      statusFilter.addEventListener("change", () => {
        this.applyFilters({ status: statusFilter.value });
      });
    }

    const dateFrom = document.getElementById("filterDateFrom");
    if (dateFrom) {
      dateFrom.addEventListener("change", () => {
        this.applyFilters({ dateFrom: dateFrom.value });
      });
    }

    const dateTo = document.getElementById("filterDateTo");
    if (dateTo) {
      dateTo.addEventListener("change", () => {
        this.applyFilters({ dateTo: dateTo.value });
      });
    }

    // دکمه ریست
    const resetBtn = document.getElementById("resetSmsFilters");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => this.resetFilters());
    }

    // دکمه رفرش
    const refreshBtn = document.getElementById("refreshSms");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", () => {
        this.loadData();
        notificationService.success("✅ اطلاعات بروزرسانی شد");
      });
    }

    // صفحه‌بندی
    const prevPageBtn = document.getElementById("prevPage");
    const nextPageBtn = document.getElementById("nextPage");

    if (prevPageBtn) {
      prevPageBtn.addEventListener("click", () => {
        if (this.currentPage > 1) {
          this.currentPage--;
          this.loadHistory();
        }
      });
    }

    if (nextPageBtn) {
      nextPageBtn.addEventListener("click", () => {
        if (this.currentPage < this.totalPages) {
          this.currentPage++;
          this.loadHistory();
        }
      });
    }
  }

  async handleSendSms() {
    const customerId = document.getElementById("smsCustomerId")?.value;
    const message = document.getElementById("smsMessage")?.value?.trim();
    const templateId = document.getElementById("templateSelect")?.value;

    if (!customerId) {
      notificationService.warning("لطفاً یک مشتری را انتخاب کنید");
      return;
    }

    if (!message) {
      notificationService.warning("لطفاً متن پیامک را وارد کنید");
      return;
    }

    await this.sendSms(customerId, message, templateId);
  }

  async applyTemplate(templateId) {
    try {
      const response = await smsApi.getTemplate(templateId);
      if (response.success) {
        const template = response.data;
        const messageInput = document.getElementById("smsMessage");
        if (messageInput) {
          messageInput.value = template.template;
        }
      }
    } catch (error) {
      console.error("❌ Error applying template:", error);
    }
  }

  // ===== رفرش خودکار =====

  startAutoRefresh() {
    // بروزرسانی هر 60 ثانیه
    this.refreshInterval = setInterval(() => {
      if (!document.hidden) {
        this.loadCredit();
        this.loadStats();
      }
    }, 60000);

    // بروزرسانی هنگام بازگشت به صفحه
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        this.loadData();
      }
    });
  }

  // ===== دیستروی =====

  destroy() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  // ===== توابع کمکی =====

  goToPage(page) {
    if (page < 1 || page > this.totalPages || page === this.currentPage) return;
    this.currentPage = page;
    this.loadHistory();
  }

  getHistory() {
    return this.history;
  }

  getStats() {
    return this.stats;
  }

  getCredit() {
    return this.credit;
  }

  refresh() {
    this.loadData();
  }
}

export const smsService = new SmsService();
