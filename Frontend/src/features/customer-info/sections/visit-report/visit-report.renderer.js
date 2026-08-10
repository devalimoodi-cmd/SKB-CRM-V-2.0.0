import { convertToPersianDate } from "../../../../core/utils/date.utils.js";

export const visitReportRenderer = {
  // ===== رندر سلکت‌ها =====

  renderHallsSelect(halls) {
    const select = document.getElementById("visit-halls");
    if (!select) return;

    const currentValue = select.value;
    select.innerHTML = '<option value="">انتخاب سالن...</option>';

    halls.forEach((hall) => {
      const option = document.createElement("option");
      option.value = hall.id;
      option.textContent = `${hall.hall_name} (شماره ${hall.hall_number || "-"})`;
      select.appendChild(option);
    });

    if (
      currentValue &&
      Array.from(select.options).some((opt) => opt.value == currentValue)
    ) {
      select.value = currentValue;
    }
  },

  renderExpertsSelect(experts) {
    const select = document.getElementById("visit-experts");
    if (!select) return;

    const currentValue = select.value;
    select.innerHTML = '<option value="">انتخاب کارشناس...</option>';

    experts.forEach((expert) => {
      const option = document.createElement("option");
      option.value = expert.id;
      option.textContent =
        expert.name || `${expert.first_name} ${expert.last_name}`;
      select.appendChild(option);
    });

    if (
      currentValue &&
      Array.from(select.options).some((opt) => opt.value == currentValue)
    ) {
      select.value = currentValue;
    }
  },

  // رندر لیست واحدهای مرغداری (جایگزین دوره‌ها)
  renderUnitsSelect(units) {
    const select = document.getElementById("visit-unit");
    if (!select) return;

    const currentValue = select.value;
    select.innerHTML = '<option value="">انتخاب واحد مرغداری...</option>';

    units.forEach((unit) => {
      const option = document.createElement("option");
      option.value = unit.id;
      option.textContent = unit.unit_name || `واحد ${unit.id}`;
      select.appendChild(option);
    });

    if (
      currentValue &&
      Array.from(select.options).some((opt) => opt.value == currentValue)
    ) {
      select.value = currentValue;
    }
  },

  renderForwardUnitsSelect(units) {
    const select = document.getElementById("visit-forward");
    if (!select) return;

    const currentValue = select.value;
    select.innerHTML = '<option value="">انتخاب کنید...</option>';

    units.forEach((unit) => {
      const option = document.createElement("option");
      option.value = unit.id;
      option.textContent = unit.name;
      select.appendChild(option);
    });

    if (
      currentValue &&
      Array.from(select.options).some((opt) => opt.value == currentValue)
    ) {
      select.value = currentValue;
    }
  },

  // ===== رندر جدول گزارش‌ها =====

  renderReportsTable(reports) {
    const tbody = document.getElementById("visitsTableBody");
    if (!tbody) return;

    if (!reports || reports.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="11" style="text-align: center;">هیچ گزارشی ثبت نشده است</td></tr>';
      return;
    }

    const statusNames = { read: "خوانده شده", unread: "خوانده نشده" };
    const statusClass = { read: "read", unread: "unread" };

    let html = "";
    reports.forEach((visit, index) => {
      const hallsName = visit.Halls?.map((h) => h.hall_name) || [];
      const expertsName =
        visit.experts?.map((e) => `${e.first_name} ${e.last_name}`) || [];
      const unitName = visit.unit?.unit_name || `واحد ${visit.unit?.id}` || "-";

      // کاربر ثبت‌کننده
      const createdByUser = visit.CreatedBy || visit.created_by_user;
      const createdByName = createdByUser
        ? `${createdByUser.first_name || ""} ${createdByUser.last_name || ""}`.trim() ||
          createdByUser.username ||
          "-"
        : "-";

      // تاریخ و زمان ثبت
      let createdDateTime = "-";
      if (visit.created_at) {
        try {
          const date = new Date(visit.created_at);
          const persianDate = new Intl.DateTimeFormat("fa-IR", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }).format(date);
          const persianTime = new Intl.DateTimeFormat("fa-IR", {
            hour: "2-digit",
            minute: "2-digit",
          }).format(date);
          createdDateTime = `${persianDate} - ${persianTime}`;
        } catch (e) {
          createdDateTime = "-";
        }
      }

      // پیوست‌ها
      const attachments =
        visit.attachments || visit.VisitReportAttachments || [];
      const attachmentsCount = attachments.length;
      let attachmentsHtml = "-";
      if (attachmentsCount > 0) {
        attachmentsHtml = `
                    <div class="skb-attachments-preview">
                        <span class="skb-attachment-count" title="${attachmentsCount} فایل پیوست">
                            <i class="fas fa-paperclip"></i> ${attachmentsCount}
                        </span>
                        <button class="skb-download-all-btn" onclick="window.downloadAllAttachments(${visit.id})" title="دانلود همه پیوست‌ها">
                            <i class="fas fa-download"></i>
                        </button>
                    </div>
                `;
      }

      html += `
                <tr>
                    <td>${index + 1}</td>
                    <td>${convertToPersianDate(visit.visit_date)}</td>
                    <td>${unitName}</td>
                    <td>${hallsName.slice(0, 2).join(", ")}${hallsName.length > 2 ? "..." : ""}</td>
                    <td>${expertsName.slice(0, 2).join(", ")}${expertsName.length > 2 ? "..." : ""}</td>
                    <td>${this.getForwardName(visit.forward_to)}</td>
                    <td>${createdDateTime}</td>
                    <td>${createdByName}</td>
                    <td style="text-align: center;">${attachmentsHtml}</td>
                    <td><span class="status-badge ${statusClass[visit.status]}">${statusNames[visit.status]}</span></td>
                    <td>
                        <div class="skb-visit-actions-btns">
                            <button class="skb-visit-btn view" onclick="window.viewVisitReport(${visit.id})" title="مشاهده گزارش">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="skb-visit-btn edit" onclick="window.editVisitReport(${visit.id})" title="ویرایش گزارش">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="skb-visit-btn delete" onclick="window.deleteVisitReport(${visit.id})" title="حذف گزارش">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                            <button class="skb-visit-btn print" onclick="window.printVisitReport(${visit.id})" title="پرینت گزارش">
                                <i class="fas fa-print"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
    });

    tbody.innerHTML = html;
  },

  getForwardName(forwardTo) {
    const names = {
      nutrition: "واحد تغذیه",
      health: "واحد بهداشت",
      production: "واحد تولید",
      sales: "واحد فروش",
      quality: "واحد کنترل کیفیت",
      management: "مدیریت",
    };
    return names[forwardTo] || "-";
  },

  // ===== فرمت حجم فایل =====

  formatFileSize(bytes) {
    if (!bytes) return "";
    const sizes = ["بایت", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  },

  // ===== رندر مودال مشاهده گزارش =====

  renderReportModal(visit) {
    const modal = document.getElementById("viewVisitModal");
    const body = document.getElementById("viewVisitBody");
    if (!modal || !body) return;

    const hallsName = visit.Halls?.map((h) => h.hall_name) || [];
    const expertsName =
      visit.experts?.map((e) => `${e.first_name} ${e.last_name}`) || [];
    const unitName = visit.unit?.unit_name || `واحد ${visit.unit?.id}` || "-";

    const attachments = visit.attachments || visit.VisitReportAttachments || [];

    // تابع کمکی آیکون فایل
    const getFileIcon = (att) => {
      const name = att.file_name || "";
      if (name.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) return "fa-image";
      if (name.match(/\.(mp4|avi|mov|mkv|webm)$/i)) return "fa-video";
      if (name.match(/\.(xlsx|xls|csv)$/i)) return "fa-file-excel";
      if (name.match(/\.(pdf)$/i)) return "fa-file-pdf";
      if (name.match(/\.(doc|docx)$/i)) return "fa-file-word";
      return "fa-file";
    };

    const getFileColor = (att) => {
      const name = att.file_name || "";
      if (name.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) return "#8b5cf6";
      if (name.match(/\.(mp4|avi|mov|mkv|webm)$/i)) return "#ef4444";
      if (name.match(/\.(xlsx|xls|csv)$/i)) return "#10b981";
      if (name.match(/\.(pdf)$/i)) return "#ef4444";
      if (name.match(/\.(doc|docx)$/i)) return "#3b82f6";
      return "#64748b";
    };

    // تابع اصلاح نام فایل (رفع مشکل encoding فارسی)
    const fixFileName = (name) => {
      if (!name) return name;
      try {
        const fixed = Buffer.from(name, "latin1").toString("utf8");
        if (!fixed.includes("\uFFFD")) return fixed;
      } catch (e) {}
      return name;
    };

    let attachmentsHtml = "";
    if (attachments.length > 0) {
      attachmentsHtml = `
        <div class="skb-modal-attachments">
          <div class="skb-modal-attachments-header">
            <span><i class="fas fa-paperclip"></i> ${attachments.length} فایل پیوست</span>
            <button class="skb-modal-download-all" onclick="event.stopPropagation(); window.downloadAllAttachments(${visit.id})">
              <i class="fas fa-download"></i> دانلود همه
            </button>
          </div>
          <div class="skb-modal-attachments-grid">
            ${attachments
              .map(
                (att) => `
              <div class="skb-modal-attachment-card">
                <div class="skb-modal-attachment-icon" style="background: ${getFileColor(att)}18; color: ${getFileColor(att)};">
                  <i class="fas ${getFileIcon(att)}"></i>
                </div>
                <div class="skb-modal-attachment-info">
                  <span class="skb-modal-attachment-name" title="${fixFileName(att.file_name)}">${fixFileName(att.file_name)}</span>
                  <span class="skb-modal-attachment-size">${att.file_size ? this.formatFileSize(att.file_size) : ""}</span>
                </div>
                <button class="skb-modal-attachment-download" onclick="event.stopPropagation(); window.downloadAttachment(${att.id}, '${fixFileName(att.file_name)}')" title="دانلود">
                  <i class="fas fa-download"></i>
                </button>
              </div>
            `,
              )
              .join("")}
          </div>
        </div>
      `;
    }

    // اطلاعات ثبت‌کننده و زمان
    const createdByUser = visit.CreatedBy || visit.created_by_user;
    const createdByName = createdByUser
      ? `${createdByUser.first_name || ""} ${createdByUser.last_name || ""}`.trim() ||
        createdByUser.username ||
        "-"
      : "-";

    let createdDateTime = "-";
    if (visit.created_at) {
      try {
        const date = new Date(visit.created_at);
        createdDateTime = new Intl.DateTimeFormat("fa-IR", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        }).format(date);
      } catch (e) {}
    }

    body.innerHTML = `
      <div class="skb-visit-report-detail">

        <!-- ===== هدر خلاصه ===== -->
        <div class="skb-report-summary-bar">
          <div class="skb-summary-item">
            <div class="skb-summary-icon" style="background:#2c7a6e18; color:#2c7a6e;">
              <i class="fas fa-calendar-check"></i>
            </div>
            <div class="skb-summary-text">
              <span>تاریخ بازدید</span>
              <strong>${convertToPersianDate(visit.visit_date)}</strong>
            </div>
          </div>
          <div class="skb-summary-item">
            <div class="skb-summary-icon" style="background:#3b82f618; color:#3b82f6;">
              <i class="fas fa-warehouse"></i>
            </div>
            <div class="skb-summary-text">
              <span>واحد مرغداری</span>
              <strong>${unitName}</strong>
            </div>
          </div>
          <div class="skb-summary-item">
            <div class="skb-summary-icon" style="background:#8b5cf618; color:#8b5cf6;">
              <i class="fas fa-user-tie"></i>
            </div>
            <div class="skb-summary-text">
              <span>کارشناسان</span>
              <strong>${expertsName.length} نفر</strong>
            </div>
          </div>
          <div class="skb-summary-item">
            <div class="skb-summary-icon" style="background:#10b98118; color:#10b981;">
              <i class="fas fa-paperclip"></i>
            </div>
            <div class="skb-summary-text">
              <span>پیوست‌ها</span>
              <strong>${attachments.length} فایل</strong>
            </div>
          </div>
        </div>

        <!-- ===== جزئیات ===== -->
        <div class="skb-report-info-grid">
          <div class="skb-report-info-card" style="--accent:#2c7a6e;">
            <div class="skb-report-info-icon"><i class="fas fa-warehouse"></i></div>
            <div class="skb-report-info-content">
              <span class="skb-report-info-label">سالن‌های بازدید شده</span>
              <span class="skb-report-info-value">${hallsName.join("، ") || "-"}</span>
            </div>
          </div>
          <div class="skb-report-info-card" style="--accent:#8b5cf6;">
            <div class="skb-report-info-icon"><i class="fas fa-user-check"></i></div>
            <div class="skb-report-info-content">
              <span class="skb-report-info-label">کارشناسان بازدید کننده</span>
              <span class="skb-report-info-value">${expertsName.join("، ") || "-"}</span>
            </div>
          </div>
          <div class="skb-report-info-card" style="--accent:#f59e0b;">
            <div class="skb-report-info-icon"><i class="fas fa-share"></i></div>
            <div class="skb-report-info-content">
              <span class="skb-report-info-label">ارجاع به</span>
              <span class="skb-report-info-value">${this.getForwardName(visit.forward_to)}</span>
            </div>
          </div>
          <div class="skb-report-info-card" style="--accent:#64748b;">
            <div class="skb-report-info-icon"><i class="fas fa-user-edit"></i></div>
            <div class="skb-report-info-content">
              <span class="skb-report-info-label">ثبت‌کننده</span>
              <span class="skb-report-info-value">${createdByName}</span>
            </div>
          </div>
          <div class="skb-report-info-card" style="--accent:#64748b;">
            <div class="skb-report-info-icon"><i class="fas fa-clock"></i></div>
            <div class="skb-report-info-content">
              <span class="skb-report-info-label">تاریخ و ساعت ثبت</span>
              <span class="skb-report-info-value">${createdDateTime}</span>
            </div>
          </div>
        </div>

        <!-- ===== شرح گزارش ===== -->
        <div class="skb-report-description-section">
          <div class="skb-report-section-title">
            <i class="fas fa-file-alt"></i> شرح گزارش
          </div>
          <div class="skb-report-description">
            <p>${visit.report_text?.replace(/\n/g, "<br>") || "—"}</p>
          </div>
        </div>

        <!-- ===== پیوست‌ها ===== -->
        ${
          attachmentsHtml
            ? `
          <div class="skb-report-attachments-section">
            <div class="skb-report-section-title">
              <i class="fas fa-paperclip"></i> پیوست‌ها
            </div>
            ${attachmentsHtml}
          </div>
        `
            : ""
        }
      </div>
    `;

    modal.classList.add("active");
    document.body.style.overflow = "hidden";
  },

  // ===== رندر پرینت گزارش =====

  renderPrintReport(visit) {
    const hallsName = visit.Halls?.map((h) => h.hall_name) || [];
    const expertsName =
      visit.experts?.map((e) => `${e.first_name} ${e.last_name}`) || [];
    const unitName = visit.unit?.unit_name || `واحد ${visit.unit?.id}` || "-";

    const now = new Date().toLocaleDateString("fa-IR");
    const nowTime = new Date().toLocaleTimeString("fa-IR");

    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const userName = user.fullName || user.username || "کاربر ناشناس";

    let createdDateTime = "-";
    if (visit.created_at) {
      try {
        const date = new Date(visit.created_at);
        const persianDate = new Intl.DateTimeFormat("fa-IR", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(date);
        const persianTime = new Intl.DateTimeFormat("fa-IR", {
          hour: "2-digit",
          minute: "2-digit",
        }).format(date);
        createdDateTime = `${persianDate} - ${persianTime}`;
      } catch (e) {
        createdDateTime = "-";
      }
    }

    const createdByUser = visit.CreatedBy || visit.created_by_user;
    const createdByName = createdByUser
      ? `${createdByUser.first_name || ""} ${createdByUser.last_name || ""}`.trim() ||
        createdByUser.username ||
        "-"
      : "-";

    return `
            <!DOCTYPE html>
            <html dir="rtl">
            <head>
                <meta charset="UTF-8">
                <title>گزارش بازدید - ${convertToPersianDate(visit.visit_date)}</title>
                <style>
                    @font-face {
                        font-family: "Vazir";
                        src: url("/assets/fonts/Vazir-Regular-FD.ttf") format("truetype");
                        font-weight: 400;
                    }
                    @font-face {
                        font-family: "Vazir";
                        src: url("/assets/fonts/Vazir-Medium-FD.ttf") format("truetype");
                        font-weight: 500;
                    }
                    @font-face {
                        font-family: "Vazir";
                        src: url("/assets/fonts/Vazir-Bold-FD.ttf") format("truetype");
                        font-weight: 700;
                    }
                    @font-face {
                        font-family: "Vazir";
                        src: url("/assets/fonts/Vazir-Black-FD.ttf") format("truetype");
                        font-weight: 900;
                    }
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: 'Vazir', 'Tahoma', sans-serif; padding: 20px; line-height: 1.8; color: #1e293b; background: white; }
                    .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #667eea; padding-bottom: 20px; }
                    .header h2 { font-size: 22px; color: #2c7a6e; }
                    .header .sub { font-size: 13px; color: #64748b; margin-top: 5px; }
                    .header .report-info { font-size: 12px; color: #475569; margin-top: 10px; background: #f1f5f9; padding: 5px 20px; border-radius: 8px; display: inline-block; }
                    .header .meta-info { font-size: 13px; color: #475569; margin-top: 8px; padding: 8px 16px; background: #f8fafc; border-radius: 8px; display: inline-block; }
                    .section { margin: 20px 0; }
                    .section-title { font-size: 16px; font-weight: 700; color: #2c7a6e; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 15px; }
                    .info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; margin: 15px 0; }
                    .info-item { background: #f8fafc; padding: 12px 15px; border-radius: 8px; border-right: 3px solid #667eea; }
                    .info-label { font-weight: 600; color: #64748b; font-size: 12px; display: block; margin-bottom: 3px; }
                    .info-value { font-size: 14px; color: #1e293b; }
                    .description { background: #f8fafc; padding: 15px 20px; border-radius: 8px; margin: 15px 0; border-right: 3px solid #667eea; }
                    .description p { margin: 0; text-align: justify; }
                    .footer { text-align: center; font-size: 11px; color: #94a3b8; border-top: 2px solid #e2e8f0; padding-top: 20px; margin-top: 30px; }
                    .footer .report-by { background: #f1f5f9; padding: 5px 20px; border-radius: 8px; display: inline-block; font-size: 12px; color: #1e293b; margin-top: 10px; }
                    @media print { body { padding: 20px; } }
                </style>
            </head>
            <body>
                <div class="header">
                    <h2>📄 گزارش بازدید از فارم</h2>
                    <div class="sub">سامانه مدیریت اطلاعات، خدمات و ارتباطات با مشتریان (سِکاد)</div>
                    <div class="report-info">📅 تاریخ چاپ: ${now} - ساعت: ${nowTime}</div>
                    <div class="meta-info">
                        <span>📌 تاریخ ثبت گزارش: ${createdDateTime}</span>
                        <span style="margin-right: 15px;">👤 ثبت‌کننده: ${createdByName}</span>
                    </div>
                </div>

                <div class="section">
                    <div class="section-title">📋 اطلاعات بازدید</div>
                    <div class="info-grid">
                        <div class="info-item"><span class="info-label">تاریخ بازدید</span><span class="info-value">${convertToPersianDate(visit.visit_date)}</span></div>
                        <div class="info-item"><span class="info-label">واحد مرغداری</span><span class="info-value">${unitName}</span></div>
                        <div class="info-item"><span class="info-label">سالن‌های بازدید شده</span><span class="info-value">${hallsName.join("، ")}</span></div>
                        <div class="info-item"><span class="info-label">کارشناسان بازدید کننده</span><span class="info-value">${expertsName.join("، ")}</span></div>
                        <div class="info-item"><span class="info-label">ارجاع به</span><span class="info-value">${this.getForwardName(visit.forward_to)}</span></div>
                    </div>
                </div>

                <div class="section">
                    <div class="section-title">📝 شرح گزارش</div>
                    <div class="description">
                        <p>${visit.report_text?.replace(/\n/g, "<br>") || ""}</p>
                    </div>
                </div>

                <div class="footer">
                    <div class="report-by">📌 گزارش‌گیری توسط: <strong>${userName}</strong> | تاریخ: <strong>${now}</strong> | ساعت: <strong>${nowTime}</strong></div>
                    <p style="margin-top: 10px;">این گزارش توسط سامانه مدیریت اطلاعات، خدمات و ارتباطات با مشتریان (سِکاد)</p>
                    <p>کارخانه تولید خوراک دام و طیور ستاره کیان بیرجند تولید شده است.</p>
                </div>
            </body>
            </html>
        `;
  },
};
