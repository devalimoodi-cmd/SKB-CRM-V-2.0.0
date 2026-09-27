// ============================================================
// dashboard.bookmarks.js
// بوکمارک‌های داشبورد — مودال ایجاد/ویرایش، حذف و جزئیات
// ------------------------------------------------------------
// موج ۳.۲ (زیرموج ۳.۲a) — این دامنه از dashboard.service.js خارج شد
// متن متدها کلمه‌به‌کلمه منتقل شده است؛ تنها تفاوت با مبدأ «ویرگول پایان متد» است
// که برای اعتبار نحو object literal لازم است (گیت ۲۷ برگشت‌پذیری بایت‌به‌بایت را اثبات می‌کند).
// ترکیب: Object.assign(DashboardService.prototype, dashboardBookmarkMethods) در dashboard.service.js
// حجم: 5 متد / 567 خط
// ============================================================
import { apiService } from "../../core/services/api.service.js";
import { notificationService } from "../../core/services/notification.service.js";
import {
  convertPersianToGregorian,
  convertToPersianDate,
} from "../../core/utils/date.utils.js";

export const dashboardBookmarkMethods = {
  // ===== رندر بوکمارک‌ها =====

  renderBookmarks() {
    const container = document.getElementById("bookmarkList");
    if (!container) return;

    if (!this.bookmarks || this.bookmarks.length === 0) {
      container.innerHTML = `
                <div class="empty-list">
                    <i class="fas fa-bookmark" style="font-size: 32px; display: block; margin-bottom: 10px; color: #cbd5e1;"></i>
                    <span>هیچ بوکمارکی وجود ندارد</span>
                    <p style="font-size: 12px; margin-top: 8px; color: #cbd5e1;">
                        برای ایجاد بوکمارک جدید، روی دکمه <strong>+</strong> کلیک کنید
                    </p>
                </div>
            `;
      return;
    }

    // مرتب‌سازی بر اساس اولویت
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const sorted = [...this.bookmarks].sort((a, b) => {
      return (
        (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2)
      );
    });

    container.innerHTML = sorted
      .map((item) => this.renderBookmarkItem(item))
      .join("");
  },

  renderBookmarkItem(bookmark) {
    const priorityText = this.getPriorityText(bookmark.priority);
    const priorityColor = this.getPriorityColor(bookmark.priority);
    const typeText = bookmark.type === "reminder" ? "🔔 یادآوری" : "📌 بوکمارک";
    const icon = bookmark.type === "reminder" ? "fa-bell" : "fa-bookmark";
    const iconColor = bookmark.type === "reminder" ? "#f59e0b" : "#3b82f6";

    let dueDateHTML = "";
    if (bookmark.due_date) {
      const persianDate = convertToPersianDate(bookmark.due_date);
      const isOverdue = new Date(bookmark.due_date) < new Date();
      dueDateHTML = `
                <span style="color: ${isOverdue ? "#dc2626" : "#64748b"}; font-size: 11px;">
                    <i class="fas fa-calendar-alt"></i> ${persianDate}
                    ${isOverdue ? " ⚠️" : ""}
                </span>
            `;
    }

    let statusHTML = "";
    if (bookmark.status === "read") {
      statusHTML =
        '<span style="color: #16a34a; font-size: 11px;"><i class="fas fa-check-circle"></i> خوانده شده</span>';
    } else if (bookmark.status === "completed") {
      statusHTML =
        '<span style="color: #2563eb; font-size: 11px;"><i class="fas fa-check-double"></i> انجام شده</span>';
    }

    return `
            <div class="bookmark-item" data-id="${bookmark.id}">
                <div class="bookmark-info" onclick="window.showBookmarkDetail(${bookmark.id})" style="cursor: pointer;">
                    <div class="title" style="color: ${priorityColor};">
                        ${bookmark.type === "reminder" ? "🔔" : "📌"} ${bookmark.title}
                    </div>
                    <div class="sub">
                        <span>${bookmark.customer?.full_name || "شخصی"}</span>
                        <span class="priority-badge ${bookmark.priority}">${priorityText}</span>
                        <span class="type-badge">${typeText}</span>
                        ${dueDateHTML}
                        ${statusHTML}
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
                    <i class="fas ${icon} bookmark-icon" style="color: ${iconColor};"></i>
                    <button onclick="event.stopPropagation(); window.showCreateBookmarkModal(${bookmark.id})" 
                            style="background: none; border: none; color: #3b82f6; cursor: pointer; padding: 4px 6px; font-size: 14px; transition: all 0.2s ease; border-radius: 4px;"
                            onmouseover="this.style.background='#dbeafe'; this.style.transform='scale(1.1)'" 
                            onmouseout="this.style.background='transparent'; this.style.transform='scale(1)'"
                            title="ویرایش بوکمارک">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="event.stopPropagation(); window.deleteBookmarkAction(${bookmark.id})" 
                            style="background: none; border: none; color: #dc2626; cursor: pointer; padding: 4px 6px; font-size: 14px; transition: all 0.2s ease; border-radius: 4px;"
                            onmouseover="this.style.background='#fee2e2'; this.style.transform='scale(1.1)'" 
                            onmouseout="this.style.background='transparent'; this.style.transform='scale(1)'"
                            title="حذف بوکمارک">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </div>
        `;
  },

  // ===== متدهای بوکمارک =====

  /**
   * نمایش مودال ایجاد/ویرایش بوکمارک
   */
  async showCreateBookmarkModal(bookmarkId = null) {
    try {
      // دریافت لیست مشتریان برای انتخاب
      let customers = [];
      try {
        const customersRes = await apiService.get(
          "/customers?limit=100&page=1",
        );
        if (customersRes.success) {
          customers = customersRes.data.customers || customersRes.data || [];
        }
      } catch (e) {
        console.log("Could not load customers:", e);
      }

      const bookmark = bookmarkId
        ? this.bookmarks.find((b) => b.id === bookmarkId) || {}
        : {};

      const customerOptions = customers
        .map(
          (c) =>
            `<option value="${c.id}" ${bookmark.customer_id == c.id ? "selected" : ""}>${c.full_name || c.company_name || "-"}</option>`,
        )
        .join("");

      const currentPriority = bookmark.priority || "medium";

      if (typeof Swal !== "undefined") {
        Swal.fire({
          // عنوان در هدر گرافیکی قرار دارد؛ تایتل SweetAlert خالی می‌ماند تا تکراری نباشد
          title: "",
          html: `
            <div style="text-align: right; font-family: 'Vazir', 'Vazirmatn', sans-serif; direction: rtl;">
              <!-- ===== هدر گرافیکی ===== -->
              <div style="display:flex; align-items:center; gap:12px; background:linear-gradient(135deg,#2c7a6e 0%,#035552 100%); border-radius:14px; padding:12px 16px; margin-bottom:16px; color:#fff; position:relative; overflow:hidden;">
                <div style="position:absolute; top:0; left:0; right:0; height:4px; background:linear-gradient(135deg,#2c7a6e,#4a9e8f,#f59e0b); background-size:200% 200%; animation: bmShimmer 3s ease-in-out infinite;"></div>
                <div style="width:42px; height:42px; border-radius:12px; background:rgba(255,255,255,0.2); display:flex; align-items:center; justify-content:center; font-size:20px; flex-shrink:0;">
                  <i class="fas fa-bookmark"></i>
                </div>
                <div>
                  <div style="font-size:15px; font-weight:800; line-height:1.3;">${bookmarkId ? "✏️ ویرایش بوکمارک" : "📌 بوکمارک جدید"}</div>
                  <div style="font-size:11px; opacity:0.85; margin-top:1px;">${bookmarkId ? "بروزرسانی اطلاعات بوکمارک" : "ایجاد یک بوکمارک یا یادآوری جدید"}</div>
                </div>
              </div>

              <style>
                @keyframes bmShimmer { 0%,100%{background-position:0% 50%;} 50%{background-position:100% 50%;} }
                .bm-field { width:100%; padding:8px 12px; border:1.5px solid #e2e8f0; border-radius:10px; font-family:'Vazir','Vazirmatn',sans-serif; font-size:12.5px; transition:all 0.3s ease; background:white; color:#1e293b; margin-top:4px; box-sizing:border-box; }
                .bm-field:focus { outline:none; border-color:#2c7a6e; box-shadow:0 0 0 4px rgba(44,122,110,0.08); }
                .bm-label { display:block; font-size:12px; font-weight:600; color:#1e293b; }
                .bm-label .bm-req { color:#dc2626; }
                .bm-label .bm-hint { font-weight:400; font-size:10px; color:#94a3b8; }
                .bm-fg { margin-bottom:10px; animation:bmFieldIn 0.4s ease forwards; opacity:0; transform:translateY(8px); }
                .bm-fg:nth-child(1){animation-delay:0.04s;} .bm-fg:nth-child(2){animation-delay:0.08s;}
                .bm-fg:nth-child(3){animation-delay:0.12s;} .bm-fg:nth-child(4){animation-delay:0.16s;}
                .bm-fg:nth-child(5){animation-delay:0.20s;} .bm-fg:nth-child(6){animation-delay:0.24s;}
                @keyframes bmFieldIn { to { opacity:1; transform:translateY(0); } }
                .bm-col-2 { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
                select.bm-field { background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2364748b' d='M6 8L1 3h10z'/%3E%3C/svg%3E"); background-repeat:no-repeat; background-position:left 12px center; padding-left:36px; appearance:none; -webkit-appearance:none; }
                .bm-priority-group { display:flex; gap:6px; margin-top:4px; }
                .bm-priority-option { flex:1; min-width:0; padding:6px 3px; border:2px solid #e2e8f0; border-radius:8px; text-align:center; cursor:pointer; transition:all 0.3s cubic-bezier(0.34,1.56,0.64,1); font-size:10.5px; font-weight:600; background:white; color:#64748b; display:flex; flex-direction:column; align-items:center; gap:1px; }
                .bm-priority-option i { font-size:12px; }
                .bm-priority-option .pl { font-size:8.5px; font-weight:400; color:#94a3b8; }
                .bm-priority-option:hover { transform:translateY(-2px); box-shadow:0 2px 12px rgba(0,0,0,0.06); }
                .bm-priority-option[data-value="critical"]{border-color:#fca5a5; color:#dc2626;}
                .bm-priority-option[data-value="high"]{border-color:#fcd34d; color:#b45309;}
                .bm-priority-option[data-value="medium"]{border-color:#93c5fd; color:#3b82f6;}
                .bm-priority-option[data-value="low"]{border-color:#cbd5e1; color:#64748b;}
                .bm-priority-option.active{box-shadow:0 2px 8px rgba(0,0,0,0.08);}
                .bm-priority-option[data-value="critical"].active{background:#fee2e2; border-color:#dc2626;}
                .bm-priority-option[data-value="high"].active{background:#fef3c7; border-color:#f59e0b;}
                .bm-priority-option[data-value="medium"].active{background:#dbeafe; border-color:#3b82f6;}
                .bm-priority-option[data-value="low"].active{background:#e2e8f0; border-color:#64748b;}
                textarea.bm-field { resize:vertical; min-height:55px; }
              </style>

              <!-- عنوان (تمام عرض) -->
              <div class="bm-fg">
                <label class="bm-label">عنوان <span class="bm-req">*</span> <span class="bm-hint">(مشخص و کوتاه)</span></label>
                <input id="bookmarkTitle" class="bm-field" value="${bookmark.title || ""}" placeholder="مثال: پیگیری هفتگی گله">
              </div>

              <!-- نوع + مشتری (۲ ستونه) -->
              <div class="bm-col-2">
                <div class="bm-fg">
                  <label class="bm-label">نوع</label>
                  <select id="bookmarkType" class="bm-field">
                    <option value="bookmark" ${bookmark.type === "bookmark" ? "selected" : ""}>📌 بوکمارک</option>
                    <option value="reminder" ${bookmark.type === "reminder" ? "selected" : ""}>🔔 یادآوری</option>
                  </select>
                </div>

                <div class="bm-fg">
                  <label class="bm-label">مشتری</label>
                  <select id="bookmarkCustomer" class="bm-field">
                    <option value="">بدون مشتری (شخصی)</option>
                    ${customerOptions}
                  </select>
                </div>
              </div>

              <!-- اولویت (تمام عرض) -->
              <div class="bm-fg">
                <label class="bm-label">اولویت</label>
                <div class="bm-priority-group" id="bookmarkPriorityGroup">
                  <div class="bm-priority-option ${currentPriority === "critical" ? "active" : ""}" data-value="critical">
                    <i class="fas fa-circle" style="color:#dc2626;"></i>
                    بحرانی <span class="pl">فوری</span>
                  </div>
                  <div class="bm-priority-option ${currentPriority === "high" ? "active" : ""}" data-value="high">
                    <i class="fas fa-circle" style="color:#f59e0b;"></i>
                    بالا <span class="pl">مهم</span>
                  </div>
                  <div class="bm-priority-option ${currentPriority === "medium" ? "active" : ""}" data-value="medium">
                    <i class="fas fa-circle" style="color:#3b82f6;"></i>
                    متوسط <span class="pl">معمولی</span>
                  </div>
                  <div class="bm-priority-option ${currentPriority === "low" ? "active" : ""}" data-value="low">
                    <i class="fas fa-circle" style="color:#94a3b8;"></i>
                    پایین <span class="pl">کم</span>
                  </div>
                </div>
                <input type="hidden" id="bookmarkPriority" value="${currentPriority}">
              </div>

              <!-- تاریخ + توضیحات (۲ ستونه) -->
              <div class="bm-col-2">
                <div class="bm-fg">
                  <label class="bm-label">تاریخ سررسید <span class="bm-hint">(اختیاری - شمسی)</span></label>
                  <input type="text" id="bookmarkDueDate" class="bm-field" placeholder="۱۴۰۴/۰۱/۰۱" value="${bookmark.due_date ? convertToPersianDate(bookmark.due_date) : ""}">
                </div>

                <div class="bm-fg">
                  <label class="bm-label">توضیحات</label>
                  <textarea id="bookmarkDescription" class="bm-field" rows="2" placeholder="توضیحات تکمیلی...">${bookmark.description || ""}</textarea>
                </div>
              </div>
            </div>
          `,
          showCancelButton: true,
          confirmButtonText: bookmarkId
            ? "💾 ذخیره تغییرات"
            : "✅ ایجاد بوکمارک",
          cancelButtonText: "❌ انصراف",
          confirmButtonColor: "#2c7a6e",
          cancelButtonColor: "#64748b",
          reverseButtons: true,
          width: 620,
          padding: "20px 24px",
          background: "#ffffff",
          customClass: {
            container: "bm-swal-container",
            popup: "bm-swal-popup",
          },
          didOpen: () => {
            // انتخاب اولویت
            const priorityGroup = document.getElementById(
              "bookmarkPriorityGroup",
            );
            const priorityInput = document.getElementById("bookmarkPriority");
            if (priorityGroup) {
              priorityGroup
                .querySelectorAll(".bm-priority-option")
                .forEach((option) => {
                  option.addEventListener("click", function () {
                    priorityGroup
                      .querySelectorAll(".bm-priority-option")
                      .forEach((o) => o.classList.remove("active"));
                    this.classList.add("active");
                    priorityInput.value = this.dataset.value;
                  });
                });
            }

            // تقویم شمسی (Jalali) برای تاریخ سررسید
            const dueDateInput = document.getElementById("bookmarkDueDate");
            if (
              dueDateInput &&
              !dueDateInput.hasAttribute("data-datepicker-initialized")
            ) {
              try {
                if (typeof $.fn.persianDatepicker !== "undefined") {
                  $(dueDateInput).persianDatepicker({
                    format: "YYYY/MM/DD",
                    autoClose: true,
                    initialValue: false,
                    observer: true,
                    calendar: {
                      persian: {
                        locale: "fa",
                      },
                    },
                    onSelect: function () {
                      const selected = $(this).val();
                      if (selected) {
                        dueDateInput.dataset.selectedDate = selected;
                        dueDateInput.value = selected;
                      }
                    },
                  });
                }
              } catch (e) {
                console.warn("⚠️ Error initializing datepicker:", e);
              }
              dueDateInput.setAttribute("data-datepicker-initialized", "true");
            }
          },
          preConfirm: () => {
            const title = document
              .getElementById("bookmarkTitle")
              ?.value?.trim();
            const customerId =
              document.getElementById("bookmarkCustomer")?.value;
            if (!title) {
              Swal.showValidationMessage("لطفاً عنوان بوکمارک را وارد کنید");
              return false;
            }
            if (!customerId) {
              Swal.showValidationMessage("لطفاً یک مشتری را انتخاب کنید");
              return false;
            }
            // تبدیل تاریخ شمسی انتخاب‌شده به میلادی برای ذخیره در دیتابیس
            const dueDateValue =
              document.getElementById("bookmarkDueDate")?.value?.trim() || "";
            const dueDateGregorian = dueDateValue
              ? convertPersianToGregorian(dueDateValue)
              : null;
            return {
              title: title,
              type:
                document.getElementById("bookmarkType")?.value || "bookmark",
              customer_id: customerId,
              priority:
                document.getElementById("bookmarkPriority")?.value || "medium",
              due_date: dueDateGregorian,
              description:
                document.getElementById("bookmarkDescription")?.value || "",
            };
          },
        }).then(async (result) => {
          if (result.isConfirmed && result.value) {
            const data = result.value;
            try {
              let response;
              if (bookmarkId) {
                // fallback به API عمومی
                response = await apiService.put(
                  `/bookmarks/${bookmarkId}`,
                  data,
                );
              } else {
                response = await apiService.post("/bookmarks", data);
              }
              if (response.success) {
                Swal.fire({
                  icon: "success",
                  title: bookmarkId
                    ? "✅ بوکمارک بروزرسانی شد"
                    : "✅ بوکمارک ایجاد شد",
                  confirmButtonText: "باشه",
                  confirmButtonColor: "#2c7a6e",
                });
                await this.loadBookmarks();
                this.renderBookmarks();
              } else {
                notificationService.error(
                  response.message || "خطا در ذخیره بوکمارک",
                );
              }
            } catch (e) {
              console.error("❌ Error saving bookmark:", e);
              notificationService.error("خطا در ارتباط با سرور");
            }
          }
        });
      } else {
        notificationService.error("SweetAlert2 در دسترس نیست");
      }
    } catch (error) {
      console.error("❌ Error showing bookmark modal:", error);
      notificationService.error("خطا در نمایش فرم");
    }
  },

  /**
   * حذف بوکمارک
   */
  async deleteBookmark(id) {
    try {
      const confirmed = await notificationService.confirm({
        title: "🗑️ حذف بوکمارک",
        text: "آیا از حذف این بوکمارک اطمینان دارید؟",
        confirmText: "بله، حذف شود",
        cancelText: "انصراف",
      });
      if (!confirmed) return;

      const response = await apiService.delete(`/bookmarks/${id}`);

      if (response.success) {
        notificationService.success("✅ بوکمارک حذف شد");
        await this.loadBookmarks();
        this.renderBookmarks();
      } else {
        notificationService.error(response.message || "خطا در حذف بوکمارک");
      }
    } catch (error) {
      console.error("❌ Error deleting bookmark:", error);
      notificationService.error("خطا در ارتباط با سرور");
    }
  },

  /**
   * نمایش جزئیات بوکمارک (طراحی مدرن)
   */
  async showBookmarkDetail(id) {
    try {
      const bookmark = this.bookmarks.find((b) => b.id === id);
      if (!bookmark) {
        notificationService.error("بوکمارک یافت نشد");
        return;
      }

      if (typeof Swal !== "undefined") {
        const isReminder = bookmark.type === "reminder";
        const typeText = isReminder ? "یادآوری" : "بوکمارک";
        const typeIcon = isReminder ? "fa-bell" : "fa-bookmark";

        // استایل اولویت بر اساس رنگ‌ها
        const priorityStyles = {
          critical: {
            gradient: "#dc2626,#ef4444",
            shadow: "rgba(220,38,38,0.3)",
            bg: "#fee2e2",
            color: "#dc2626",
          },
          high: {
            gradient: "#f59e0b,#fbbf24",
            shadow: "rgba(245,158,11,0.3)",
            bg: "#fef3c7",
            color: "#b45309",
          },
          medium: {
            gradient: "#3b82f6,#60a5fa",
            shadow: "rgba(59,130,246,0.3)",
            bg: "#dbeafe",
            color: "#3b82f6",
          },
          low: {
            gradient: "#94a3b8,#cbd5e1",
            shadow: "rgba(148,163,184,0.3)",
            bg: "#e2e8f0",
            color: "#64748b",
          },
        };
        const pr = priorityStyles[bookmark.priority] || priorityStyles.medium;
        const priorityText = this.getPriorityText(bookmark.priority);

        const dueDate = bookmark.due_date
          ? convertToPersianDate(bookmark.due_date)
          : null;
        const isOverdue =
          bookmark.due_date && new Date(bookmark.due_date) < new Date();
        const customerName = bookmark.customer?.full_name || "شخصی";

        Swal.fire({
          title: "",
          html: `
            <div style="text-align:center; font-family:'Vazir','Vazirmatn',sans-serif; direction:rtl;">
              <!-- آیکون مدور -->
              <div style="width:72px; height:72px; border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 16px; font-size:30px; color:#fff; background:linear-gradient(135deg,${pr.gradient}); box-shadow:0 8px 32px ${pr.shadow}; position:relative;">
                <i class="fas ${typeIcon}"></i>
              </div>

              <!-- عنوان -->
              <div style="font-size:20px; font-weight:800; color:#1e293b; margin-bottom:4px;">${bookmark.title}</div>
              <div style="display:flex; align-items:center; justify-content:center; gap:8px; flex-wrap:wrap; margin-bottom:20px;">
                <span style="font-size:11px; padding:2px 12px; border-radius:20px; background:rgba(44,122,110,0.08); color:#2c7a6e; font-weight:600; display:inline-flex; align-items:center; gap:4px;">
                  <i class="fas fa-tag"></i> ${typeText}
                </span>
                <span style="color:#e2e8f0;">|</span>
                <span style="font-size:11px; padding:2px 10px; border-radius:20px; background:#f8fafc; color:#64748b; display:inline-flex; align-items:center; gap:4px;">
                  <i class="fas fa-hashtag"></i> #${bookmark.id}
                </span>
                ${
                  dueDate
                    ? `<span style="color:#e2e8f0;">|</span>
                       <span style="font-size:11px; color:#94a3b8;"><i class="fas fa-clock"></i> ${dueDate}</span>`
                    : ""
                }
              </div>

              <!-- اطلاعات -->
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:16px; text-align:right;">
                <div style="background:#fafbfc; border-radius:14px; padding:12px 16px; border:1px solid transparent;">
                  <div style="font-size:11px; font-weight:600; color:#64748b; display:flex; align-items:center; gap:6px; margin-bottom:2px;">
                    <i class="fas fa-user" style="color:#2c7a6e;"></i> مشتری
                  </div>
                  <div style="font-size:15px; font-weight:600; color:#2c7a6e; padding-right:4px;">${customerName}</div>
                </div>
                <div style="background:#fafbfc; border-radius:14px; padding:12px 16px; border:1px solid transparent;">
                  <div style="font-size:11px; font-weight:600; color:#64748b; display:flex; align-items:center; gap:6px; margin-bottom:2px;">
                    <i class="fas fa-flag" style="color:#2c7a6e;"></i> اولویت
                  </div>
                  <div style="font-size:15px; font-weight:600; padding-right:4px;">
                    <span style="font-size:12px; padding:2px 14px; border-radius:20px; font-weight:700; background:${pr.bg}; color:${pr.color}; display:inline-flex; align-items:center; gap:6px;">
                      <i class="fas fa-circle" style="font-size:8px;"></i> ${priorityText}
                    </span>
                  </div>
                </div>
                ${
                  dueDate
                    ? `<div style="grid-column:1/-1; background:#fafbfc; border-radius:14px; padding:12px 16px; border:1px solid transparent;">
                        <div style="font-size:11px; font-weight:600; color:#64748b; display:flex; align-items:center; gap:6px; margin-bottom:2px;">
                          <i class="fas fa-calendar-alt" style="color:#2c7a6e;"></i> تاریخ سررسید
                        </div>
                        <div style="font-size:15px; font-weight:600; padding-right:4px; color:${isOverdue ? "#dc2626" : "#1e293b"}; display:flex; align-items:center; gap:6px;">
                          <i class="fas ${isOverdue ? "fa-exclamation-circle" : "fa-calendar-check"}"></i> ${dueDate}
                          ${
                            isOverdue
                              ? '<span style="font-size:11px; font-weight:400; color:#dc2626; background:#fee2e2; padding:0 8px; border-radius:12px;">تأخیر</span>'
                              : ""
                          }
                        </div>
                      </div>`
                    : ""
                }
              </div>

              <!-- توضیحات -->
              <div style="background:linear-gradient(135deg,#fafbfc,#f8fafc); border-radius:14px; padding:14px 18px; border:1px solid #f1f5f9; text-align:right;">
                <div style="font-size:11px; font-weight:600; color:#64748b; display:flex; align-items:center; gap:6px; margin-bottom:4px;">
                  <i class="fas fa-align-left" style="color:#2c7a6e;"></i> توضیحات
                </div>
                <div style="font-size:14px; color:#1e293b; line-height:1.7; padding-right:4px; word-wrap:break-word; text-align:right;">${
                  bookmark.description || "—"
                }</div>
              </div>
            </div>
          `,
          showCancelButton: true,
          confirmButtonText: "✏️ ویرایش",
          cancelButtonText: "🗑️ حذف",
          confirmButtonColor: "#2c7a6e",
          cancelButtonColor: "#dc2626",
          reverseButtons: true,
          width: 520,
          padding: "24px 28px",
          didOpen: () => {
            document
              .querySelector(".swal2-popup")
              ?.style?.setProperty("border-radius", "24px");
          },
        }).then((result) => {
          if (result.isConfirmed) {
            this.showCreateBookmarkModal(id);
          } else if (result.dismiss === Swal.DismissReason.cancel) {
            this.deleteBookmark(id);
          }
        });
      }
    } catch (error) {
      console.error("❌ Error showing bookmark:", error);
    }
  },

};
