import { convertToPersianDate } from "../../core/utils/date.utils.js";

export const bookmarksRenderer = {
  // ===== رندر آیتم بوکمارک =====

  renderBookmarkItem(bookmark) {
    const priorityText = this.getPriorityText(bookmark.priority);
    const priorityColor = this.getPriorityColor(bookmark.priority);
    const typeText = bookmark.type === "reminder" ? "🔔 یادآوری" : "📌 بوکمارک";
    const icon = bookmark.type === "reminder" ? "fa-bell" : "fa-bookmark";
    const iconColor = bookmark.type === "reminder" ? "#f59e0b" : "#3b82f6";
    const isOverdue =
      bookmark.due_date && new Date(bookmark.due_date) < new Date();

    let dueDateHTML = "";
    if (bookmark.due_date) {
      const persianDate = convertToPersianDate(bookmark.due_date);
      dueDateHTML = `
                <span class="due-date ${isOverdue ? "overdue" : ""}">
                    <i class="fas fa-calendar-alt"></i>
                    ${persianDate}
                    ${isOverdue ? " ⚠️" : ""}
                </span>
            `;
    }

    let statusHTML = "";
    if (bookmark.status === "read") {
      statusHTML =
        '<span class="status-badge read"><i class="fas fa-check-circle"></i> خوانده شده</span>';
    } else if (bookmark.status === "completed") {
      statusHTML =
        '<span class="status-badge completed"><i class="fas fa-check-double"></i> انجام شده</span>';
    } else if (bookmark.status === "archived") {
      statusHTML =
        '<span class="status-badge archived"><i class="fas fa-archive"></i> بایگانی شده</span>';
    } else if (bookmark.status === "cancelled") {
      statusHTML =
        '<span class="status-badge cancelled"><i class="fas fa-times-circle"></i> لغو شده</span>';
    } else {
      statusHTML =
        '<span class="status-badge active"><i class="fas fa-circle"></i> فعال</span>';
    }

    const customerName =
      bookmark.customer?.full_name || bookmark.customer_name || "شخصی";
    const description = bookmark.description
      ? `<div class="bookmark-description">${bookmark.description}</div>`
      : "";

    return `
            <div class="bookmark-item ${isOverdue ? "overdue" : ""}" data-id="${bookmark.id}">
                <div class="bookmark-header">
                    <div class="bookmark-icon-wrapper" style="background: ${priorityColor}20; color: ${priorityColor};">
                        <i class="fas ${icon}"></i>
                    </div>
                    <div class="bookmark-content">
                        <div class="bookmark-title">
                            <span style="color: ${priorityColor};">${bookmark.title}</span>
                            <span class="priority-badge ${bookmark.priority}">${priorityText}</span>
                        </div>
                        <div class="bookmark-meta">
                            <span class="bookmark-type">${typeText}</span>
                            <span class="bookmark-customer">
                                <i class="fas fa-user"></i> ${customerName}
                            </span>
                            ${dueDateHTML}
                            ${statusHTML}
                        </div>
                        ${description}
                    </div>
                </div>
                <div class="bookmark-actions">
                    <button class="action-btn view" onclick="window.viewBookmarkDetail(${bookmark.id})" title="مشاهده">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="action-btn edit" onclick="window.editBookmark(${bookmark.id})" title="ویرایش">
                        <i class="fas fa-edit"></i>
                    </button>
                    ${
                      bookmark.status !== "completed"
                        ? `
                        <button class="action-btn complete" onclick="window.completeBookmark(${bookmark.id})" title="انجام شد">
                            <i class="fas fa-check-double"></i>
                        </button>
                    `
                        : ""
                    }
                    <button class="action-btn delete" onclick="window.deleteBookmark(${bookmark.id})" title="حذف">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </div>
        `;
  },

  // ===== رندر لیست بوکمارک‌ها =====

  renderBookmarksList(bookmarks) {
    if (!bookmarks || bookmarks.length === 0) {
      return `
                <div class="empty-state">
                    <i class="fas fa-bookmark" style="font-size: 48px; color: #cbd5e1; display: block; margin-bottom: 16px;"></i>
                    <h4 style="font-size: 18px; color: #64748b; margin-bottom: 8px;">هیچ بوکمارکی وجود ندارد</h4>
                    <p style="font-size: 14px; color: #94a3b8;">برای شروع، یک بوکمارک جدید ایجاد کنید</p>
                </div>
            `;
    }

    return bookmarks.map((b) => this.renderBookmarkItem(b)).join("");
  },

  // ===== رندر فیلترها =====

  renderFilters(currentFilters = {}) {
    return `
            <div class="bookmark-filters">
                <div class="filter-group">
                    <input type="text" id="bookmarkSearch" class="filter-input" 
                           placeholder="جستجوی بوکمارک..." value="${currentFilters.search || ""}">
                    <i class="fas fa-search filter-icon"></i>
                </div>
                <div class="filter-group">
                    <select id="filterType" class="filter-select">
                        <option value="all" ${currentFilters.type === "all" ? "selected" : ""}>همه انواع</option>
                        <option value="bookmark" ${currentFilters.type === "bookmark" ? "selected" : ""}>📌 بوکمارک</option>
                        <option value="reminder" ${currentFilters.type === "reminder" ? "selected" : ""}>🔔 یادآوری</option>
                    </select>
                </div>
                <div class="filter-group">
                    <select id="filterStatus" class="filter-select">
                        <option value="all" ${currentFilters.status === "all" ? "selected" : ""}>همه وضعیت‌ها</option>
                        <option value="active" ${currentFilters.status === "active" ? "selected" : ""}>🟢 فعال</option>
                        <option value="read" ${currentFilters.status === "read" ? "selected" : ""}>📖 خوانده شده</option>
                        <option value="completed" ${currentFilters.status === "completed" ? "selected" : ""}>✅ انجام شده</option>
                        <option value="archived" ${currentFilters.status === "archived" ? "selected" : ""}>📦 بایگانی شده</option>
                        <option value="cancelled" ${currentFilters.status === "cancelled" ? "selected" : ""}>❌ لغو شده</option>
                    </select>
                </div>
                <div class="filter-group">
                    <select id="filterPriority" class="filter-select">
                        <option value="all" ${currentFilters.priority === "all" ? "selected" : ""}>همه اولویت‌ها</option>
                        <option value="critical" ${currentFilters.priority === "critical" ? "selected" : ""}>🔴 بحرانی</option>
                        <option value="high" ${currentFilters.priority === "high" ? "selected" : ""}>🟠 بالا</option>
                        <option value="medium" ${currentFilters.priority === "medium" ? "selected" : ""}>🟡 متوسط</option>
                        <option value="low" ${currentFilters.priority === "low" ? "selected" : ""}>🟢 پایین</option>
                    </select>
                </div>
                <button class="btn-reset-filters" id="resetFiltersBtn">
                    <i class="fas fa-undo"></i> ریست
                </button>
            </div>
        `;
  },

  // ===== رندر آمار =====

  renderStats(stats) {
    if (!stats) return "";

    return `
            <div class="bookmark-stats">
                <div class="stat-item">
                    <span class="stat-value" id="statTotal">${stats.total || 0}</span>
                    <span class="stat-label">کل</span>
                </div>
                <div class="stat-item">
                    <span class="stat-value active" id="statActive">${stats.active || 0}</span>
                    <span class="stat-label">فعال</span>
                </div>
                <div class="stat-item">
                    <span class="stat-value completed" id="statCompleted">${stats.completed || 0}</span>
                    <span class="stat-label">انجام شده</span>
                </div>
                <div class="stat-item">
                    <span class="stat-value expired" id="statExpired">${stats.expired || 0}</span>
                    <span class="stat-label">سررسید شده</span>
                </div>
                <div class="stat-item">
                    <span class="stat-value reminder" id="statReminders">${stats.reminders || 0}</span>
                    <span class="stat-label">یادآوری</span>
                </div>
            </div>
        `;
  },

  // ===== رندر صفحه‌بندی =====

  renderPagination(currentPage, totalPages) {
    if (totalPages <= 1) return "";

    let html = "";
    const start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, currentPage + 2);

    html += `<button class="page-btn" onclick="window.goToPage(${currentPage - 1})" ${currentPage === 1 ? "disabled" : ""}>
            <i class="fas fa-chevron-right"></i>
        </button>`;

    if (start > 1) {
      html += `<button class="page-btn" onclick="window.goToPage(1)">1</button>`;
      if (start > 2) html += '<span class="page-dots">...</span>';
    }

    for (let i = start; i <= end; i++) {
      html += `<button class="page-btn ${i === currentPage ? "active" : ""}" onclick="window.goToPage(${i})">${i}</button>`;
    }

    if (end < totalPages) {
      if (end < totalPages - 1) html += '<span class="page-dots">...</span>';
      html += `<button class="page-btn" onclick="window.goToPage(${totalPages})">${totalPages}</button>`;
    }

    html += `<button class="page-btn" onclick="window.goToPage(${currentPage + 1})" ${currentPage === totalPages ? "disabled" : ""}>
            <i class="fas fa-chevron-left"></i>
        </button>`;

    return html;
  },

  // ===== توابع کمکی =====

  getPriorityText(priority) {
    const texts = {
      critical: "بحرانی",
      high: "بالا",
      medium: "متوسط",
      low: "پایین",
    };
    return texts[priority] || "متوسط";
  },

  getPriorityColor(priority) {
    const colors = {
      critical: "#dc2626",
      high: "#ef4444",
      medium: "#f59e0b",
      low: "#6c757d",
    };
    return colors[priority] || "#6c757d";
  },

  getStatusText(status) {
    const texts = {
      active: "فعال",
      read: "خوانده شده",
      completed: "انجام شده",
      archived: "بایگانی شده",
      cancelled: "لغو شده",
    };
    return texts[status] || status;
  },

  getStatusIcon(status) {
    const icons = {
      active: "fa-circle",
      read: "fa-check-circle",
      completed: "fa-check-double",
      archived: "fa-archive",
      cancelled: "fa-times-circle",
    };
    return icons[status] || "fa-circle";
  },

  getStatusColor(status) {
    const colors = {
      active: "#10b981",
      read: "#3b82f6",
      completed: "#8b5cf6",
      archived: "#94a3b8",
      cancelled: "#dc2626",
    };
    return colors[status] || "#94a3b8";
  },
};
