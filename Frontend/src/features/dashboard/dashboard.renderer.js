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

  // ===== رندر قدیمی کارت گله (غیرفعال — نسخه ۲ در انتهای فایل) =====

  renderFlockCardLegacy(card) {
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
      meta.push(`<span class="task-chip chip-flock"><i class="fas fa-feather"></i> گله ${flock.flockNumber}</span>`);
    if (flock?.unitName)
      meta.push(`<span class="task-chip chip-unit"><i class="fas fa-industry"></i> ${flock.unitName}</span>`);
    if (flock?.placementDate)
      meta.push(
        `<span class="task-chip chip-date"><i class="fas fa-calendar-alt"></i> ${convertToPersianDate(flock.placementDate)}</span>`,
      );
    if (flock?.flockAge != null)
      meta.push(`<span class="task-chip chip-age"><i class="fas fa-hourglass-half"></i> ${flock.flockAge} روز</span>`);

    const flockOverdue = [
      ...new Set(
        (activeHalls.length ? activeHalls : halls).flatMap(
          (h) => h.overdueWeeks || [],
        ),
      ),
    ].sort((a, b) => a - b);
    const headerWeekStatus =
      flock?.status === "danger" && flockOverdue.length
        ? `<span class="days-info overdue-pill" style="color:#dc2626; font-weight:600;"><i class="fas fa-exclamation-circle"></i> هفته‌های معوق: ${flockOverdue.join("، ")} — پس از ثبت کامل هفتگی حذف می‌شود</span>`
        : this.daysInfoHTML(flock?.weekEndDate, flock?.status);

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
              <span class="status-text" style="color:${st.color}; font-weight:700;">${st.text}</span>
            </div>
            <div class="task-meta-band">${meta.join("")}</div>
            ${
              defHall
                ? '<div class="fc-hint"><i class="fas fa-mouse-pointer"></i> کلیک روی گله: نمودار کل گله — کلیک روی سالن: نمودار همان سالن</div>'
                : ""
            }
          </div>
          <div class="task-card-actions">
            <div class="rail-status">
              ${headerWeekStatus}
              ${this.smsTodayHTML(flock?.smsToday)}
            </div>
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
            <span class="tooltip-container">
              <button class="btn-history" onclick="event.stopPropagation(); window.showSmsHistory(${customer?.id ?? 0}, null, ${flock?.id ?? 0})"><i class="fas fa-history"></i></button>
              <span class="tooltip tooltip-top">تاریخچه پیامک‌های گله</span>
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
    const fmtDateTime = (d) => {
      if (!d) return "";
      try {
        return new Intl.DateTimeFormat("fa-IR", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date(d));
      } catch {
        return "";
      }
    };
    const deliveredAtText = smsLog?.delivered_at
      ? fmtDateTime(smsLog.delivered_at)
      : "";
    const senderLine = sender
      ? `<div style="font-size:9px; opacity:0.85;">فرستنده: ${sender}</div>`
      : "";
    const deliveryLine = deliveredAtText
      ? `<div style="font-size:9px; opacity:0.85;">تحویل: ${deliveredAtText}</div>`
      : "";
    const chipHTML = smsInfo
      ? `<span class="sms-status" ${chipAttrs} style="display:inline-flex; flex-direction:column; align-items:flex-start; gap:1px; line-height:1.6; background:${smsInfo.bg}; color:${smsInfo.color}; padding:3px 9px; border-radius:10px; font-size:10px; font-weight:500;">${smsInfo.text}${senderLine}${deliveryLine}</span>`
      : "";

    const hallOverdue = Array.isArray(hall.overdueWeeks)
      ? hall.overdueWeeks.map(Number)
      : [];
    const hallDaysHTML =
      hall.status === "danger" && hallOverdue.length
        ? `<span class="days-info overdue-pill" style="color:#dc2626; font-weight:600;"><i class="fas fa-exclamation-circle"></i> معوق: هفته ${hallOverdue.join("، ")}</span>`
        : this.daysInfoHTML(hall.weekEndDate, hall.status);

    return `
      <div class="task-hall-row"
           data-customer-id="${customer?.id ?? 0}"
           data-flock-id="${hall.id}"
           data-week-number="${hall.weekNumber ?? 0}"
           data-flock-number="${flock?.flockNumber ?? 0}"
           onclick="event.stopPropagation(); window.selectFlockForChart(${customer?.id ?? 0}, ${hall.id}, '${csafe}', ${flock?.flockNumber ?? "null"}, ${hall.weekNumber ?? "null"}, '${hname}', ${flock?.id ?? 0})"
           title="کلیک: نمایش نمودار این سالن">
        <div class="th-head">
        <div class="th-main">
          <span class="th-selected-tag"><i class="fas fa-eye"></i> در حال نمایش</span>
          <span class="th-hall" style="font-weight:600; color:#1e293b;"><i class="fas fa-warehouse"></i> ${hname}</span>
          ${hall.breedName ? `<span class="th-info"><i class="fas fa-dna"></i> ${hall.breedName}</span>` : ""}
          <span class="th-info"><i class="fas fa-calendar-week"></i> هفته ${hall.weekNumber ?? "-"}</span>
          ${
            hall.weekStartDate
              ? `<span class="th-info"><i class="fas fa-calendar-alt"></i> ${convertToPersianDate(hall.weekStartDate)} تا ${convertToPersianDate(hall.weekEndDate)}</span>`
              : ""
          }
          <span class="th-info"><i class="fas fa-hourglass-half"></i> ${hall.ageDays ?? 0} روز</span>
          ${chipHTML}
        </div>
        <div class="hall-status-stack">
          <span class="status-text" style="color:${hSt.color}; font-weight:600;">${hSt.text}</span>
          ${hallDaysHTML}
          ${this.smsTodayHTML(hall.smsToday)}
        </div>
        <div class="task-hall-actions">
          <span class="tooltip-container">
            <button class="btn-sms" onclick="event.stopPropagation(); window.sendFlockCardSms(${flock?.id ?? 0}, ${hall.id})"><i class="fas fa-sms"></i></button>
            <span class="tooltip tooltip-top">ارسال پیامک این سالن</span>
          </span>
          <span class="tooltip-container">
            <button class="btn-refresh" onclick="event.stopPropagation(); window.refreshSmsStatus(${customer?.id ?? 0}, ${hall.id}, ${flock?.id ?? 0})"><i class="fas fa-sync-alt"></i></button>
            <span class="tooltip tooltip-top">بروزرسانی وضعیت پیامک این سالن</span>
          </span>
          <span class="tooltip-container">
            <button class="btn-history" onclick="event.stopPropagation(); window.showSmsHistory(${customer?.id ?? 0}, ${hall.id})"><i class="fas fa-history"></i></button>
            <span class="tooltip tooltip-top">تاریخچه پیامک‌های سالن</span>
          </span>
        </div>
        </div>
        <div class="th-stepper">
          <span class="stepper-label">پیشرفت هفته‌های سالن</span>
          <div class="steps-container">${this.renderWeeksBar(hall)}</div>
        </div>
      </div>
    `;
  },

  renderWeeksBar(hall) {
    const completed = Array.isArray(hall.completeWeeks)
      ? hall.completeWeeks.map(Number)
      : Array.isArray(hall.completedWeeks)
        ? hall.completedWeeks.map(Number)
        : [];
    const overdue = Array.isArray(hall.overdueWeeks)
      ? hall.overdueWeeks.map(Number)
      : [];
    const current = parseInt(hall.weekNumber) || 1;
    const maxCompleted = completed.length ? Math.max(...completed) : 0;
    const totalWeeks = Math.max(current, maxCompleted, 8);
    let html = "";
    for (let i = 1; i <= totalWeeks; i++) {
      const isCompleted = completed.includes(i);
      const isOverdue = overdue.includes(i);
      const isActive = i === current;
      let circleClass = "step-circle";
      if (isCompleted) circleClass += " completed";
      else if (isOverdue) circleClass += " overdue";
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
        ? `هفته ${i}: کامل ثبت شده`
        : isOverdue
          ? `هفته ${i}: معوق — ثبت نشده`
          : isActive
            ? `هفته ${i}: در حال انجام`
            : `هفته ${i}: ثبت نشده`;

      html += `
        <div class="${itemClass}">
          <div class="${circleClass}" title="${tip}">${i}</div>
        </div>`;
    }
    return html;
  },

  smsTodayHTML(today) {
    if (!today) return "";
    const parts = [];
    if (today.count > 0) {
      const sentRoles =
        today.roles && today.roles.length ? ` (${today.roles.join("، ")})` : "";
      const latest = today.latest || {};
      const senderName = latest.sender
        ? [latest.sender.first_name, latest.sender.last_name]
            .filter(Boolean)
            .join(" ") || latest.sender.username || ""
        : "";
      parts.push(
        `<span class="sms-today-pill ok" title="فرستنده: ${senderName}"><i class="fas fa-check-circle"></i> امروز ارسال شد${sentRoles}</span>`,
      );
    }
    if (today.remaining && today.remaining.length) {
      parts.push(
        `<span class="sms-today-pill pending"><i class="fas fa-exclamation-circle"></i> مانده: ${today.remaining.join("، ")}</span>`,
      );
    }
    return parts.join(" ");
  },

  statusUI(status) {
    const map = {
      danger: {
        type: "danger",
        text: "سررسید گذشته — نیاز به اقدام",
        color: "#dc2626",
        bg: "#fee2e2",
      },
      success: {
        type: "success",
        text: "نزدیک به سررسید",
        color: "#16a34a",
        bg: "#dcfce7",
      },
      normal: {
        type: "normal",
        text: "عادی",
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
      return `<span class="days-info" style="color:#dc2626; font-weight:600;"><i class="fas fa-exclamation-triangle"></i> ${
        Math.abs(diff) === 0
          ? "امروز سررسید است"
          : `${Math.abs(diff)} روز از سررسید گذشته`
      }</span>`;
    }
    if (status === "danger" || status === "success") {
      return `<span class="days-info" style="color:#16a34a; font-weight:600;"><i class="fas fa-hourglass-half"></i> ${diff} روز تا سررسید</span>`;
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
      pending: { text: "در انتظار", color: "#d97706", bg: "#fef3c7" },
      sent: { text: "ارسال شده", color: "#2563eb", bg: "#dbeafe" },
      delivered: { text: "تحویل داده شده", color: "#047857", bg: "#d1fae5" },
      failed: { text: "ناموفق", color: "#dc2626", bg: "#fee2e2" },
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

  // ============================================================
  // رندر فشرده کارت گله (نسخه ۲ — هدر + ریل وضعیت + سالن‌های جمع‌شونده)
  // ============================================================
  renderFlockCard(card) {
    const { customer, flock } = card || {};
    const halls = (flock?.halls || []).filter((h) => h.isActive);
    const st = this.statusUI(flock?.status);
    const defHall = halls[0] || null;
    const csafe = String(customer?.name || "").replace(/'/g, "");
    const customerInitial =
      String(customer?.name || "؟").trim().charAt(0) || "؟";
    const groupClick = flock?.id
      ? `window.selectFlockGroupForChart(${customer?.id ?? 0}, ${flock.id}, '${csafe}', ${flock?.flockNumber ?? "null"}, ${flock?.weekNumber ?? "null"})`
      : "";

    // ── متادیتای فشرده هدر ──
    const meta = [];
    if (flock?.flockNumber)
      meta.push(
        `<span class="fc-chip"><i class="fas fa-feather"></i> گله ${flock.flockNumber}</span>`,
      );
    if (flock?.placementDate)
      meta.push(
        `<span class="fc-chip"><i class="fas fa-calendar-alt"></i> ${convertToPersianDate(flock.placementDate)}</span>`,
      );
    if (flock?.flockAge != null)
      meta.push(
        `<span class="fc-chip"><i class="fas fa-hourglass-half"></i> ${flock.flockAge} روز</span>`,
      );

    // ── ردیف واحد/شهر ──
    const farmParts = [];
    const farmNameTxt = flock?.unitName || customer?.farmName || "";
    if (farmNameTxt)
      farmParts.push(`<i class="fas fa-warehouse"></i> ${farmNameTxt}`);
    if (customer?.city)
      farmParts.push(`<i class="fas fa-map-pin"></i> ${customer.city}`);
    const farmHTML = farmParts.length
      ? `<div class="fc-farm-line">${farmParts.join('<span class="fc-sep">|</span>')}</div>`
      : "";

    // ── روزهای مانده تا سررسید ──
    let diffDays = null;
    if (flock?.weekEndDate) {
      const endD = new Date(flock.weekEndDate);
      const nowD = new Date();
      endD.setHours(0, 0, 0, 0);
      nowD.setHours(0, 0, 0, 0);
      diffDays = Math.ceil((endD - nowD) / (1000 * 60 * 60 * 24));
    }
    let deadlineText = "زمان‌بندی عادی";
    if (flock?.status === "danger") deadlineText = "گذشته — نیاز به اقدام";
    else if (flock?.status === "success") {
      deadlineText =
        diffDays === 0
          ? "امروز سررسید است"
          : diffDays != null && diffDays > 0
            ? `${diffDays} روز تا سررسید`
            : "گذشته — نیاز به اقدام";
    }

    // ── هفته‌های معوق گله ──
    const flockOverdue = [
      ...new Set(halls.flatMap((h) => h.overdueWeeks || [])),
    ].sort((a, b) => a - b);

    // ── آیتم‌های ریل وضعیت ──
    const items = [];
    items.push(
      `<div class="fc-sitem"><span class="fc-sdot ${st.type}"></span><span class="fc-slbl">سررسید:</span><span class="fc-sval ${st.type}">${deadlineText}</span></div>`,
    );
    if (flock?.status === "danger" && flockOverdue.length) {
      items.push(
        `<div class="fc-sitem"><span class="fc-sdot danger"></span><span class="fc-slbl">معوق:</span><span class="fc-sval danger">هفته ${flockOverdue.join("، ")}</span></div>`,
      );
    }

    const today = flock?.smsToday || null;
    if (today && Number(today.count) > 0) {
      const roleTxt =
        today.roles && today.roles.length
          ? ` (${today.roles.join("، ")})`
          : "";
      const snd = today.latest?.sender || null;
      const senderName = snd
        ? [snd.first_name, snd.last_name].filter(Boolean).join(" ") ||
          snd.username ||
          ""
        : "";
      items.push(
        `<div class="fc-sitem"><i class="fas fa-check-circle fc-sicon success"></i><span class="fc-slbl">پیامک:</span><span class="fc-sval success"${senderName ? ` title="فرستنده: ${String(senderName).replace(/"/g, "")}"` : ""}>امروز ارسال شد${roleTxt}</span></div>`,
      );
    }
    if (today?.remaining && today.remaining.length) {
      items.push(
        `<div class="fc-sitem"><i class="fas fa-exclamation-circle fc-sicon warning"></i><span class="fc-slbl">مانده:</span><span class="fc-sval warning">${today.remaining.join("، ")}</span></div>`,
      );
    }

    // ── کارشناسان خدمات گله ──
    const experts = Array.isArray(flock?.experts) ? flock.experts : [];
    const expertText = experts.length
      ? experts
          .map(
            (e) =>
              `${e.name || "نامشخص"}${
                e.halls && e.halls.length ? ` (${e.halls.join("، ")})` : ""
              }`,
          )
          .join("، ")
      : "ثبت نشده";
    items.push(
      `<div class="fc-sitem"><i class="fas fa-user-tie fc-sicon expert"></i><span class="fc-slbl">کارشناس خدمات:</span><span class="fc-sval">${expertText}</span></div>`,
    );

    // ── سالن‌ها (همیشه داخل بخش جمع‌شونده) ──
    const hallRows = halls.length
      ? halls.map((h) => this.renderHallRow(card, h)).join("")
      : '<div class="flock-halls-empty">سالن فعالی در این گله نیست</div>';
    const hallsBlock = `
      <div class="task-halls-toggle" onclick="event.stopPropagation(); window.toggleTaskCardHalls(${flock?.id ?? 0})">
        <i class="fas fa-warehouse"></i>
        <span>سالن‌های گله</span>
        <span class="th-count-badge">${halls.length}</span>
        <span class="th-toggle-hint">${halls.length ? `${halls.length} سالن فعال` : "بدون سالن فعال"}</span>
        <i class="fas fa-chevron-down accordion-icon"></i>
      </div>
      <div class="flock-halls halls-collapsible">${hallRows}</div>`;

    return `
      <div class="task-card task-card-${flock?.status || "normal"} selectable-card flock-task-card"
           data-customer-id="${customer?.id ?? 0}"
           data-flock-group-id="${flock?.id ?? 0}"
           data-flock-id="${flock?.id ?? 0}"
           onclick="${groupClick}"
           style="cursor:pointer;">
        <div class="fc-top-strip"></div>

        <div class="fc-hdr">
          <div class="fc-avatar" style="color:${st.color}; border-color:${st.color}55;">
            ${customerInitial}
            <span class="fc-ring" style="background:${st.color};"></span>
          </div>
          <div class="fc-hdr-main">
            <div class="fc-title-line">
              <span class="fc-cust">${customer?.name || "نامشخص"}</span>
              ${customer?.id ? `<span class="fc-id-pill">#${customer.id}</span>` : ""}
            </div>
            ${farmHTML}
            <div class="fc-meta-row">${meta.join("")}</div>
          </div>
          <div class="fc-hdr-actions">
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
            <span class="tooltip-container">
              <button class="btn-refresh" onclick="event.stopPropagation(); window.refreshSmsStatus(${customer?.id ?? 0}, null, ${flock?.id ?? 0})"><i class="fas fa-sync-alt"></i></button>
              <span class="tooltip tooltip-top">بروزرسانی وضعیت پیامک‌های گله</span>
            </span>
            <span class="tooltip-container">
              <button class="btn-history" onclick="event.stopPropagation(); window.showSmsHistory(${customer?.id ?? 0}, null, ${flock?.id ?? 0})"><i class="fas fa-history"></i></button>
              <span class="tooltip tooltip-top">تاریخچه پیامک‌های گله</span>
            </span>
          </div>
        </div>

        <div class="fc-stats-sec">
          <div class="fc-sec-title"><i class="fas fa-bolt"></i> وضعیت‌ها</div>
          <div class="fc-stats-grid">${items.join("")}</div>
        </div>

        ${hallsBlock}
      </div>
    `;
  },

};
