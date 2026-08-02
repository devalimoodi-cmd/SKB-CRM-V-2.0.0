import { convertToPersianDate } from "../../core/utils/date.utils.js";

export const dashboardRenderer = {
  // ===== رندر کارت تسک =====
  renderTaskCard(item, type) {
    const { customer, flock } = item;
    const statusInfo = this.getStatusInfo(flock);
    const borderColor = statusInfo.color;
    const bgColor = statusInfo.bg;

    const smsStatus = item.smsStatus || "pending";
    const smsInfo = this.getSmsStatusInfo(smsStatus);

    let daysInfo = "";
    if (flock.daysRemaining !== undefined) {
      const days = flock.daysRemaining;
      if (statusInfo.type === "danger") {
        daysInfo = `📅 ${Math.abs(days)} روز از سررسید گذشته`;
      } else if (statusInfo.type === "success") {
        daysInfo = `⏳ ${days} روز تا سررسید`;
      }
    }

    const weekStartDate = flock.weekStartDate
      ? convertToPersianDate(flock.weekStartDate)
      : "-";
    const weekEndDate = flock.weekEndDate
      ? convertToPersianDate(flock.weekEndDate)
      : "-";

    return `
            <div class="task-card task-card-${statusInfo.type} selectable-card" 
                 data-customer-id="${customer.id}" 
                 data-flock-id="${flock.id}"
                 data-week-number="${flock.weekNumber}"
                 data-flock-number="${flock.flockNumber}"
                 onclick="window.selectFlockForChart(${customer.id}, ${flock.id}, '${customer.name}', ${flock.flockNumber}, ${flock.weekNumber})"
                 style="border-right-color: ${borderColor}; background: ${bgColor}; cursor: pointer;">
                
                <div class="task-card-info">
                    <div class="customer-name" style="font-weight: 600; color: #1e293b;">${customer.name}</div>
                    <div class="customer-farm" style="font-size: 13px; color: #64748b;">${customer.farmName} | ${customer.city}</div>
                    
                    <div class="week-info" style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-top: 4px; font-size: 13px; color: #475569;">
                        <span>🐣 گله ${flock.flockNumber}</span>
                        <span>📅 هفته ${flock.weekNumber}</span>
                        <span>📆 ${weekStartDate} - ${weekEndDate}</span>
                        <span>📊 سن گله: ${flock.flockAge} روز</span>
                        <span class="status-text" style="color: ${borderColor}; font-weight: 600; background: ${bgColor}; padding: 2px 10px; border-radius: 12px;">
                            ${statusInfo.icon} ${statusInfo.text}
                        </span>
                        ${daysInfo ? `<span class="days-info" style="color: ${borderColor}; font-weight: 500; background: ${statusInfo.type === "danger" ? "#fee2e2" : "#dcfce7"}; padding: 2px 10px; border-radius: 12px;">${daysInfo}</span>` : ""}
                    </div>
                    
                    <div style="display: flex; gap: 8px; margin-top: 4px; flex-wrap: wrap; align-items: center;">
                        <span class="sms-status" style="background: ${smsInfo.bg}; color: ${smsInfo.color}; padding: 2px 10px; border-radius: 12px; font-size: 10px; font-weight: 500;">
                            ${smsInfo.text}
                        </span>
                    </div>
                </div>
                
                <div class="task-card-actions" style="display: flex; gap: 4px; align-items: center; flex-shrink: 0;">
                    <button class="btn-profile" onclick="event.stopPropagation(); window.goToCustomerProfile(${customer.id})" title="مشاهده پروفایل">
                        <i class="fas fa-user"></i>
                    </button>
                    <button class="btn-detail" onclick="event.stopPropagation(); window.showCustomerDetail(${customer.id}, ${flock.id})" title="مشاهده جزئیات">
                        <i class="fas fa-info-circle"></i>
                    </button>
                    <button class="btn-sms" onclick="event.stopPropagation(); window.sendSmsToCustomer(${customer.id}, '${customer.name}', ${flock.id}, ${flock.weekNumber}, ${flock.flockNumber}, this.closest('.task-card'))" title="ارسال پیامک">
                        <i class="fas fa-sms"></i>
                    </button>
                    <button class="btn-history" onclick="event.stopPropagation(); window.showSmsHistory(${customer.id}, ${flock.id})" title="تاریخچه پیامک‌ها">
                        <i class="fas fa-history"></i>
                    </button>
                    <button class="btn-refresh" onclick="event.stopPropagation(); window.refreshSmsStatus(${customer.id}, ${flock.id})" title="بروزرسانی وضعیت">
                        <i class="fas fa-sync-alt"></i>
                    </button>
                    <button class="btn-remove-card" onclick="event.stopPropagation(); window.removeTaskCard(this, ${customer.id}, ${flock.id})" title="حذف از لیست">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
        `;
  },

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

  getEmptyStateHTML(message, color) {
    return `
            <div class="empty-list">
                <i class="fas fa-check-circle" style="color: ${color}; font-size: 32px; display: block; margin-bottom: 10px;"></i>
                <span>${message}</span>
            </div>
        `;
  },

  getStatusInfo(flock) {
    const today = new Date();
    const endDate = new Date(flock.weekEndDate);
    today.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
      return {
        type: "danger",
        text: "🔴 سررسید شده",
        icon: "🔴",
        color: "#dc2626",
        bg: "#fee2e2",
      };
    } else if (diffDays <= 2) {
      return {
        type: "success",
        text: "🟢 نزدیک به سررسید",
        icon: "🟢",
        color: "#16a34a",
        bg: "#dcfce7",
      };
    } else {
      return {
        type: "normal",
        text: "🔵 عادی",
        icon: "🔵",
        color: "#3b82f6",
        bg: "#dbeafe",
      };
    }
  },

  getSmsStatusInfo(status) {
    const map = {
      pending: { text: "⏳ در انتظار", color: "#f59e0b", bg: "#fef3c7" },
      sent: { text: "📱 ارسال شده", color: "#3b82f6", bg: "#dbeafe" },
      delivered: { text: "✅ تحویل داده شده", color: "#16a34a", bg: "#dcfce7" },
      failed: { text: "❌ ناموفق", color: "#dc2626", bg: "#fee2e2" },
    };
    return map[status] || map.pending;
  },

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
};
