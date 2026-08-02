import {
  convertToPersianDate,
  formatDate,
} from "../../core/utils/date.utils.js";

export const smsRenderer = {
  // ===== رندر آیتم تاریخچه =====

  renderHistoryItem(log) {
    const statusText = this.getStatusText(log.status);
    const statusColor = this.getStatusColor(log.status);
    const statusIcon = this.getStatusIcon(log.status);

    const senderName = log.sender
      ? `${log.sender.first_name || ""} ${log.sender.last_name || ""}`.trim() ||
        log.sender.username ||
        "-"
      : "-";

    const customerName = log.customer?.full_name || log.customer_name || "-";
    const mobile = log.mobile || log.customer?.mobile_number || "-";

    let sentTime = "-";
    if (log.sent_at) {
      sentTime =
        convertToPersianDate(log.sent_at) +
        " " +
        new Date(log.sent_at).toLocaleTimeString("fa-IR");
    }

    let deliveredTime = "-";
    if (log.delivered_at) {
      deliveredTime =
        convertToPersianDate(log.delivered_at) +
        " " +
        new Date(log.delivered_at).toLocaleTimeString("fa-IR");
    }

    const flockInfo = log.flock ? `گله ${log.flock.flock_number}` : "-";
    const weekInfo = log.week_number ? `هفته ${log.week_number}` : "-";

    return `
            <div class="sms-history-item ${log.status}" data-id="${log.id}">
                <div class="sms-item-header">
                    <div class="sms-item-info">
                        <span class="sms-customer">
                            <i class="fas fa-user"></i> ${customerName}
                        </span>
                        <span class="sms-mobile">
                            <i class="fas fa-phone"></i> ${mobile}
                        </span>
                        <span class="sms-flock">
                            <i class="fas fa-egg"></i> ${flockInfo}
                        </span>
                        <span class="sms-week">
                            <i class="fas fa-calendar-week"></i> ${weekInfo}
                        </span>
                    </div>
                    <div class="sms-item-status">
                        <span class="status-badge ${log.status}" style="background: ${statusColor}20; color: ${statusColor};">
                            <i class="fas ${statusIcon}"></i> ${statusText}
                        </span>
                    </div>
                </div>
                
                <div class="sms-item-body">
                    <div class="sms-message">${log.message || "-"}</div>
                    <div class="sms-meta">
                        <span>
                            <i class="fas fa-user-tie"></i> ارسال‌کننده: ${senderName}
                        </span>
                        <span>
                            <i class="fas fa-clock"></i> زمان ارسال: ${sentTime}
                        </span>
                        ${
                          log.delivered_at
                            ? `
                            <span>
                                <i class="fas fa-check-circle"></i> زمان تحویل: ${deliveredTime}
                            </span>
                        `
                            : ""
                        }
                        ${
                          log.message_id
                            ? `
                            <span>
                                <i class="fas fa-hashtag"></i> شناسه: ${log.message_id}
                            </span>
                        `
                            : ""
                        }
                    </div>
                </div>
                
                <div class="sms-item-actions">
                    ${
                      log.status === "pending" || log.status === "sent"
                        ? `
                        <button class="btn-check-status" onclick="window.checkSmsStatus('${log.message_id}')">
                            <i class="fas fa-sync-alt"></i> بروزرسانی وضعیت
                        </button>
                    `
                        : ""
                    }
                    <button class="btn-resend" onclick="window.resendSms(${log.id})">
                        <i class="fas fa-redo"></i> ارسال مجدد
                    </button>
                </div>
            </div>
        `;
  },

  // ===== رندر فرم ارسال =====

  renderSendForm(customers, templates = []) {
    const customerOptions = customers
      .map(
        (c) => `
            <option value="${c.id}">${c.full_name} - ${c.mobile_number || "بدون شماره"}</option>
        `,
      )
      .join("");

    const templateOptions = templates
      .map(
        (t) => `
            <option value="${t.id}">${t.name}</option>
        `,
      )
      .join("");

    return `
            <div class="sms-send-form">
                <div class="form-group">
                    <label>مشتری <span class="required">*</span></label>
                    <select id="smsCustomerId" class="form-control">
                        <option value="">انتخاب مشتری...</option>
                        ${customerOptions}
                    </select>
                </div>

                <div class="form-group">
                    <label>قالب پیامک</label>
                    <select id="templateSelect" class="form-control">
                        <option value="">انتخاب قالب...</option>
                        ${templateOptions}
                    </select>
                </div>

                <div class="form-group">
                    <label>متن پیامک <span class="required">*</span></label>
                    <textarea id="smsMessage" class="form-control" rows="6" 
                              placeholder="متن پیامک را وارد کنید..."></textarea>
                    <div class="char-counter">
                        <span id="charCount">0</span> / <span id="charLimit">500</span> کاراکتر
                    </div>
                </div>

                <div class="form-group">
                    <label>پیش‌نمایش</label>
                    <div id="smsPreview" class="sms-preview">
                        <div class="preview-content">
                            <i class="fas fa-sms" style="color: #94a3b8;"></i>
                            <span>پیش‌نمایش پیامک در اینجا نمایش داده می‌شود</span>
                        </div>
                    </div>
                </div>

                <div class="form-actions">
                    <button class="btn-send-sms" id="sendSmsBtn">
                        <i class="fas fa-paper-plane"></i> ارسال پیامک
                    </button>
                    <button class="btn-send-bulk" id="sendBulkSmsBtn">
                        <i class="fas fa-users"></i> ارسال گروهی
                    </button>
                    <button class="btn-clear" id="clearSmsForm">
                        <i class="fas fa-undo"></i> پاک کردن
                    </button>
                </div>
            </div>
        `;
  },

  // ===== رندر آمار =====

  renderStats(stats) {
    if (!stats) return "";

    return `
            <div class="sms-stats">
                <div class="stat-item">
                    <span class="stat-value">${stats.totalSent || 0}</span>
                    <span class="stat-label">کل ارسال</span>
                </div>
                <div class="stat-item">
                    <span class="stat-value delivered">${stats.delivered || 0}</span>
                    <span class="stat-label">تحویل داده شده</span>
                </div>
                <div class="stat-item">
                    <span class="stat-value failed">${stats.failed || 0}</span>
                    <span class="stat-label">ناموفق</span>
                </div>
                <div class="stat-item">
                    <span class="stat-value pending">${stats.pending || 0}</span>
                    <span class="stat-label">در انتظار</span>
                </div>
            </div>
        `;
  },

  // ===== رندر فیلترها =====

  renderFilters(currentFilters = {}) {
    return `
            <div class="sms-filters">
                <div class="filter-group">
                    <input type="text" id="smsSearch" class="filter-input" 
                           placeholder="جستجو..." value="${currentFilters.search || ""}">
                    <i class="fas fa-search filter-icon"></i>
                </div>
                <div class="filter-group">
                    <select id="filterStatus" class="filter-select">
                        <option value="all" ${currentFilters.status === "all" ? "selected" : ""}>همه وضعیت‌ها</option>
                        <option value="pending" ${currentFilters.status === "pending" ? "selected" : ""}>⏳ در انتظار</option>
                        <option value="sent" ${currentFilters.status === "sent" ? "selected" : ""}>📱 ارسال شده</option>
                        <option value="delivered" ${currentFilters.status === "delivered" ? "selected" : ""}>✅ تحویل داده شده</option>
                        <option value="failed" ${currentFilters.status === "failed" ? "selected" : ""}>❌ ناموفق</option>
                    </select>
                </div>
                <div class="filter-group">
                    <input type="date" id="filterDateFrom" class="filter-input" 
                           value="${currentFilters.dateFrom || ""}" placeholder="از تاریخ">
                </div>
                <div class="filter-group">
                    <input type="date" id="filterDateTo" class="filter-input" 
                           value="${currentFilters.dateTo || ""}" placeholder="تا تاریخ">
                </div>
                <button class="btn-reset-filters" id="resetSmsFilters">
                    <i class="fas fa-undo"></i> ریست
                </button>
            </div>
        `;
  },

  // ===== توابع کمکی =====

  getStatusText(status) {
    const map = {
      pending: "در انتظار",
      sent: "ارسال شده",
      delivered: "تحویل داده شده",
      failed: "ناموفق",
      cancelled: "لغو شده",
    };
    return map[status] || status;
  },

  getStatusColor(status) {
    const map = {
      pending: "#f59e0b",
      sent: "#3b82f6",
      delivered: "#16a34a",
      failed: "#dc2626",
      cancelled: "#94a3b8",
    };
    return map[status] || "#94a3b8";
  },

  getStatusIcon(status) {
    const map = {
      pending: "fa-clock",
      sent: "fa-paper-plane",
      delivered: "fa-check-circle",
      failed: "fa-times-circle",
      cancelled: "fa-ban",
    };
    return map[status] || "fa-circle";
  },
};
