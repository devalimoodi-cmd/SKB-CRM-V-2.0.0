import { convertToPersianDate } from "../../core/utils/date.utils.js";

export const dashboardRenderer = {
  // ===== رندر کارت تسک =====
  renderTaskCard(item, type) {
    const { customer, flock } = item;
    const statusInfo = this.getStatusInfo(flock);
    const borderColor = statusInfo.color;
    const bgColor = statusInfo.bg;

    const smsStatus = item.smsLog ? item.smsLog.status || "sent" : null;
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
                    
                    ${
                      smsInfo
                        ? `<div style="display: flex; gap: 8px; margin-top: 4px; flex-wrap: wrap; align-items: center;">
                        <span class="sms-status" style="background: ${smsInfo.bg}; color: ${smsInfo.color}; padding: 2px 10px; border-radius: 12px; font-size: 10px; font-weight: 500;">
                            ${smsInfo.text}
                        </span>
                    </div>`
                        : ""
                    }
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

  // ===== رندر کارت گله (دوره پرورش) با سالن‌های عضو =====

  renderFlockCard(card) {
    const { customer, flock } = card || {};
    const halls = flock?.halls || [];
    const activeHalls = halls.filter((h) => h.isActive);
    const st = this.statusUI(flock?.status);
    const defHall = activeHalls[0] || halls[0] || null;
    const csafe = String(customer?.name || "").replace(/'/g, "");
    const customerInitial = String(customer?.name || "؟")
      .trim()
      .charAt(0) || "؟";
    const groupClick = flock?.id
      ? `window.selectFlockGroupForChart(${customer?.id ?? 0}, ${flock.id}, '${csafe}', ${flock?.flockNumber ?? "null"}, ${flock?.weekNumber ?? "null"})`
      : "";

    const meta = [];
    if (flock?.flockNumber)
      meta.push(`<span class="task-chip">🐣 گله ${flock.flockNumber}</span>`);
    if (flock?.unitName)
      meta.push(`<span class="task-chip">🏢 ${flock.unitName}</span>`);
    if (flock?.placementDate)
      meta.push(
        `<span class="task-chip">📆 ${convertToPersianDate(flock.placementDate)}</span>`,
      );
    if (flock?.flockAge != null)
      meta.push(`<span class="task-chip">🎂 ${flock.flockAge} روز</span>`);

    const hallRows = activeHalls.length
      ? activeHalls.map((h) => this.renderHallRow(card, h)).join("")
      : '<div class="flock-halls-empty">سالن فعالی در این گله نیست</div>';

    // سالن‌های گله‌های چندسالنه داخل آکاردئون (پیش‌فرض بسته)
    const multi = activeHalls.length > 1;
    const hallsBlock = multi
      ? `
        <div class="task-halls-toggle" onclick="event.stopPropagation(); window.toggleTaskCardHalls(${flock?.id ?? 0})">
          <i class="fas fa-warehouse"></i>
          <span>سالن‌های گله</span>
          <span class="th-count-badge">${activeHalls.length}</span>
          <span class="th-toggle-hint">${activeHalls.length} سالن فعال</span>
          <i class="fas fa-chevron-down accordion-icon"></i>
        </div>
        <div class="flock-halls halls-collapsible">${hallRows}</div>`
      : `<div class="flock-halls">${hallRows}</div>`;

    return `
      <div class="task-card task-card-${flock?.status || "normal"} selectable-card flock-task-card"
           data-customer-id="${customer?.id ?? 0}"
           data-flock-group-id="${flock?.id ?? 0}"
           data-flock-id="${flock?.id ?? 0}"
           onclick="${groupClick}"
           style="cursor: pointer;">
        <div class="fc-top-strip"></div>
        <div class="task-card-info">
          <div class="fc-avatar" style="background:${st.color}22; color:${st.color}; border:1px solid ${st.color}55;">${customerInitial}</div>
          <div class="fc-main" style="flex:1; min-width:0;">
            <div class="fc-headline">
              <div style="flex:1; min-width:0;">
                <div class="customer-name" style="font-weight:700; color:#0f172a;">${customer?.name || "نامشخص"}</div>
                <div class="customer-farm" style="font-size:12px; color:#64748b;">${customer?.farmName || ""}${customer?.city ? " | " + customer.city : ""}</div>
              </div>
              <span class="status-text" style="color:${st.color}; font-weight:700; background:${st.bg}; padding:3px 12px; border-radius:999px; border:1px solid ${st.color}44;">${st.text}</span>
            </div>
            <div class="week-info" style="display:flex; gap:6px; flex-wrap:wrap; align-items:center; margin-top:8px; font-size:12px; color:#475569;">
              ${meta.join("")}
              ${this.daysInfoHTML(flock?.weekEndDate, flock?.status)}
            </div>
            ${
              defHall
                ? '<div class="fc-hint">🖱️ کلیک روی گله = نمودار کل گله | کلیک روی هر سالن = نمودار همان سالن</div>'
                : ""
            }
          </div>
          <div class="task-card-actions">
            <span class="tooltip-container">
              <button class="btn-profile" onclick="event.stopPropagation(); window.goToCustomerProfile(${customer?.id ?? 0})"><i class="fas fa-user"></i></button>
              <span class="tooltip tooltip-top">مشاهده پروفایل مرغدار</span>
            </span>
            <span class="tooltip-container">
              <button class="btn-detail" onclick="event.stopPropagation(); window.showCustomerDetail(${customer?.id ?? 0}, ${defHall ? defHall.id : "null"})"><i class="fas fa-info-circle"></i></button>
              <span class="tooltip tooltip-top">جزئیات مشتری</span>
            </span>
            <span class="tooltip-container">
              <button class="btn-sms" onclick="event.stopPropagation(); window.sendFlockCardSms(${flock?.id ?? 0}, null)"><i class="fas fa-sms"></i></button>
              <span class="tooltip tooltip-top">ارسال پیامک گله</span>
            </span>
          </div>
        </div>
        ${hallsBlock}
      </div>
    `;
  },

  renderHallRow(card, hall) {
    const { customer, flock } = card || {};
    const hSt = this.statusUI(hall.status);
    const csafe = String(customer?.name || "").replace(/'/g, "");
    const hname = String(hall.hallName || `سالن ${hall.hallId || ""}`).replace(
      /'/g,
      "",
    );
    const smsLog = hall.smsLog || null;
    const smsStatus = smsLog ? smsLog.status || "sent" : null;
    const smsInfo = smsStatus ? this.getSmsStatusInfo(smsStatus) : null;
    const sender = smsLog?.sender
      ? [
          smsLog.sender.first_name,
          smsLog.sender.last_name,
        ]
          .filter(Boolean)
          .join(" ") || smsLog.sender.username || ""
      : "";
    const chipAttrs = smsLog?.message_id
      ? ` data-message-id="${smsLog.message_id}" data-sender-name="${String(sender).replace(/"/g, "")}" data-sms-status="${smsStatus}"`
      : "";

    return `
      <div class="task-hall-row"
           data-customer-id="${customer?.id ?? 0}"
           data-flock-id="${hall.id}"
           data-week-number="${hall.weekNumber ?? 0}"
           data-flock-number="${flock?.flockNumber ?? 0}"
           onclick="window.selectFlockForChart(${customer?.id ?? 0}, ${hall.id}, '${csafe}', ${flock?.flockNumber ?? "null"}, ${hall.weekNumber ?? "null"}, '${hname}', ${flock?.id ?? 0})"
           title="کلیک: نمایش نمودار این سالن">
        <div class="th-head">
        <div class="th-main">
          <span class="th-selected-tag">✅ روی نمودار</span>
          <span class="th-hall" style="font-weight:600; color:#1e293b;"><i class="fas fa-warehouse"></i> ${hname}</span>
          ${hall.breedName ? `<span>🧬 ${hall.breedName}</span>` : ""}
          <span>📅 هفته ${hall.weekNumber ?? "-"}</span>
          ${
            hall.weekStartDate
              ? `<span>📆 ${convertToPersianDate(hall.weekStartDate)} تا ${convertToPersianDate(hall.weekEndDate)}</span>`
              : ""
          }
          <span>🎂 ${hall.ageDays ?? 0} روز</span>
          <span class="status-text" style="color:${hSt.color}; font-weight:600; background:${hSt.bg}; padding:1px 8px; border-radius:12px;">${hSt.text}</span>
          ${this.daysInfoHTML(hall.weekEndDate, hall.status)}
          ${
            smsInfo
              ? `<span class="sms-status" ${chipAttrs} style="background:${smsInfo.bg}; color:${smsInfo.color}; padding:2px 8px; border-radius:12px; font-size:10px; font-weight:500; display:inline-flex; align-items:center;">${smsInfo.text}</span>`
              : ""
          }
        </div>
        <div class="task-hall-actions">
          <span class="tooltip-container">
            <button class="btn-sms" onclick="event.stopPropagation(); window.sendFlockCardSms(${flock?.id ?? 0}, ${hall.id})"><i class="fas fa-sms"></i></button>
            <span class="tooltip tooltip-top">ارسال پیامک این سالن</span>
          </span>
          <span class="tooltip-container">
            <button class="btn-refresh" onclick="event.stopPropagation(); window.refreshSmsStatus(${customer?.id ?? 0}, ${hall.id})"><i class="fas fa-sync-alt"></i></button>
            <span class="tooltip tooltip-top">بروزرسانی وضعیت پیامک این سالن</span>
          </span>
          <span class="tooltip-container">
            <button class="btn-history" onclick="event.stopPropagation(); window.showSmsHistory(${customer?.id ?? 0}, ${hall.id})"><i class="fas fa-history"></i></button>
            <span class="tooltip tooltip-top">تاریخچه پیامک‌های سالن</span>
          </span>
        </div>
        </div>
        <div class="th-stepper">
          <span class="stepper-label">📊 هفته‌های سالن</span>
          <div class="steps-container">${this.renderWeeksBar(hall)}</div>
        </div>
      </div>
    `;
  },

  renderWeeksBar(hall) {
    const completed = Array.isArray(hall.completedWeeks)
      ? hall.completedWeeks.map(Number)
      : [];
    const current = parseInt(hall.weekNumber) || 1;
    const maxCompleted = completed.length ? Math.max(...completed) : 0;
    const totalWeeks = Math.max(current, maxCompleted, 8);
    let html = "";
    for (let i = 1; i <= totalWeeks; i++) {
      const isCompleted = completed.includes(i);
      const isActive = i === current;
      let circleClass = "step-circle";
      if (isCompleted) circleClass += " completed";
      else if (isActive) circleClass += " active";
      else circleClass += " pending";

      let itemClass = "step-item";
      if (i < totalWeeks) {
        const nextIsCompleted = completed.includes(i + 1);
        const nextIsActive = i + 1 === current;
        if (nextIsCompleted) itemClass += " completed-connector";
        else if (nextIsActive) itemClass += " active-connector";
      }

      const tip = isCompleted
        ? `✅ هفته ${i}: ثبت شده`
        : isActive
          ? `⏳ هفته ${i}: در حال انجام`
          : `❌ هفته ${i}: ثبت نشده`;

      html += `
        <div class="${itemClass}">
          <div class="${circleClass}" title="${tip}">${i}</div>
        </div>`;
    }
    return html;
  },

  statusUI(status) {
    const map = {
      danger: {
        type: "danger",
        text: "🔴 سررسید گذشته / نیاز به اقدام",
        color: "#dc2626",
        bg: "#fee2e2",
      },
      success: {
        type: "success",
        text: "🟢 نزدیک به سررسید",
        color: "#16a34a",
        bg: "#dcfce7",
      },
      normal: {
        type: "normal",
        text: "🔵 عادی",
        color: "#3b82f6",
        bg: "#dbeafe",
      },
    };
    return map[status] || map.normal;
  },

  daysInfoHTML(weekEndDate, status) {
    if (!weekEndDate) return "";
    const end = new Date(weekEndDate);
    const today = new Date();
    end.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    const diff = Math.ceil((end - today) / (1000 * 60 * 60 * 24));
    if (diff <= 0) {
      return `<span class="days-info" style="color:#dc2626; font-weight:500; background:#fee2e2; padding:2px 10px; border-radius:12px;">📅 ${
        Math.abs(diff) === 0
          ? "امروز سررسید است"
          : `${Math.abs(diff)} روز از سررسید گذشته`
      }</span>`;
    }
    if (status === "danger" || status === "success") {
      return `<span class="days-info" style="color:#16a34a; font-weight:500; background:#dcfce7; padding:2px 10px; border-radius:12px;">⏳ ${diff} روز تا سررسید</span>`;
    }
    return "";
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
      delivered: { text: "✅ تحویل داده شده", color: "#3b82f6", bg: "#dbeafe" },
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
