import { bookmarksApi } from "./bookmarks.api.js";
import { bookmarksService } from "./bookmarks.service.js";
import { notificationService } from "../../core/services/notification.service.js";
import {
  convertPersianToGregorian,
  convertToPersianDate,
} from "../../core/utils/date.utils.js";

export const bookmarksModalService = {
  modal: null,
  isOpen: false,
  isEditing: false,
  editingId: null,

  init() {
    this.modal = document.getElementById("bookmarkModal");
    if (!this.modal) {
      // ایجاد مودال اگر وجود ندارد
      this.createModal();
    }
  },

  createModal() {
    const modal = document.createElement("div");
    modal.id = "bookmarkModal";
    modal.className = "modal-overlay";
    modal.innerHTML = `
            <div class="modal-container modal-medium">
                <div class="modal-header">
                    <h3><i class="fas fa-bookmark"></i> <span id="modalTitle">بوکمارک جدید</span></h3>
                    <button class="modal-close" id="modalCloseBtn">&times;</button>
                </div>
                <div class="modal-body" id="modalBody">
                    <!-- محتوا توسط JS تولید می‌شود -->
                </div>
            </div>
        `;
    document.body.appendChild(modal);
    this.modal = modal;

    // رویداد بستن
    const closeBtn = modal.querySelector("#modalCloseBtn");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => this.closeModal());
    }

    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        this.closeModal();
      }
    });
  },

  openCreateModal(customers, selectedCustomerId = null) {
    this.isEditing = false;
    this.editingId = null;
    document.getElementById("modalTitle").textContent = "📌 بوکمارک جدید";
    document.getElementById("modalBody").innerHTML = this.getFormHTML(
      customers,
      null,
      selectedCustomerId,
    );
    this.openModal();
    this.initDatepickers();
    this.initEvents();
  },

  openEditModal(bookmark, customers) {
    this.isEditing = true;
    this.editingId = bookmark.id;
    document.getElementById("modalTitle").textContent = "✏️ ویرایش بوکمارک";
    document.getElementById("modalBody").innerHTML = this.getFormHTML(
      customers,
      bookmark,
    );
    this.openModal();
    this.initDatepickers();
    this.initEvents(bookmark);
  },

  openModal() {
    if (this.modal) {
      this.modal.classList.add("active");
      document.body.style.overflow = "hidden";
      this.isOpen = true;
    }
  },

  closeModal() {
    if (this.modal) {
      this.modal.classList.remove("active");
      document.body.style.overflow = "";
      this.isOpen = false;
      this.isEditing = false;
      this.editingId = null;
    }
  },

  getFormHTML(customers, bookmark = null, selectedCustomerId = null) {
    const isEdit = !!bookmark;
    const bm = bookmark || {};

    // گزینه‌های مشتریان
    const customerOptions = customers
      .map(
        (c) => `
            <option value="${c.id}" ${(selectedCustomerId && selectedCustomerId == c.id) || (bm.customer_id && bm.customer_id == c.id) ? "selected" : ""}>
                ${c.full_name} - ${c.farm_name || "بدون فارم"}
            </option>
        `,
      )
      .join("");

    return `
            <form id="bookmarkForm" class="bookmark-form">
                <div class="form-group">
                    <label>نوع بوکمارک <span class="required">*</span></label>
                    <select id="bookmarkType" class="form-control">
                        <option value="bookmark" ${bm.type === "bookmark" || !bm.type ? "selected" : ""}>📌 بوکمارک</option>
                        <option value="reminder" ${bm.type === "reminder" ? "selected" : ""}>🔔 یادآوری</option>
                    </select>
                </div>

                <div class="form-group">
                    <label>عنوان <span class="required">*</span></label>
                    <input type="text" id="bookmarkTitle" class="form-control" 
                           placeholder="عنوان بوکمارک..." value="${bm.title || ""}">
                </div>

                <div class="form-group">
                    <label>توضیحات</label>
                    <textarea id="bookmarkDescription" class="form-control" rows="3" 
                              placeholder="توضیحات تکمیلی...">${bm.description || ""}</textarea>
                </div>

                <div class="form-group">
                    <label>مشتری</label>
                    <select id="bookmarkCustomer" class="form-control">
                        <option value="">بدون مشتری (شخصی)</option>
                        ${customerOptions}
                    </select>
                </div>

                <div class="form-group" id="periodGroup" style="display: none;">
                    <label>دوره پرورش</label>
                    <select id="bookmarkPeriod" class="form-control">
                        <option value="">همه دوره‌ها</option>
                    </select>
                </div>

                <div class="form-group" id="flockGroup" style="display: none;">
                    <label>گله</label>
                    <select id="bookmarkFlock" class="form-control">
                        <option value="">همه گله‌ها</option>
                    </select>
                </div>

                <div class="form-group">
                    <label>سن گله (روز) - اختیاری</label>
                    <input type="number" id="bookmarkFlockAge" class="form-control" 
                           placeholder="مثال: 42" value="${bm.flock_age_days || ""}">
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label>اولویت <span class="required">*</span></label>
                        <select id="bookmarkPriority" class="form-control">
                            <option value="low" ${bm.priority === "low" ? "selected" : ""}>🟢 پایین</option>
                            <option value="medium" ${bm.priority === "medium" || !bm.priority ? "selected" : ""}>🟡 متوسط</option>
                            <option value="high" ${bm.priority === "high" ? "selected" : ""}>🟠 بالا</option>
                            <option value="critical" ${bm.priority === "critical" ? "selected" : ""}>🔴 بحرانی</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>وضعیت</label>
                        <select id="bookmarkStatus" class="form-control">
                            <option value="active" ${bm.status === "active" || !bm.status ? "selected" : ""}>🟢 فعال</option>
                            <option value="read" ${bm.status === "read" ? "selected" : ""}>📖 خوانده شده</option>
                            <option value="completed" ${bm.status === "completed" ? "selected" : ""}>✅ انجام شده</option>
                            <option value="archived" ${bm.status === "archived" ? "selected" : ""}>📦 بایگانی شده</option>
                            <option value="cancelled" ${bm.status === "cancelled" ? "selected" : ""}>❌ لغو شده</option>
                        </select>
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label>تاریخ سررسید</label>
                        <input type="text" id="bookmarkDueDate" class="form-control" 
                               placeholder="۱۴۰۴/۰۱/۰۱" value="${bm.due_date ? convertToPersianDate(bm.due_date) : ""}">
                    </div>
                    <div class="form-group">
                        <label>ساعت سررسید</label>
                        <input type="time" id="bookmarkDueTime" class="form-control" 
                               value="${bm.due_date ? new Date(bm.due_date).toTimeString().slice(0, 5) : ""}">
                    </div>
                </div>

                <div class="form-actions">
                    <button type="button" class="btn-submit" id="saveBookmarkBtn">
                        <i class="fas ${isEdit ? "fa-save" : "fa-plus"}"></i>
                        ${isEdit ? "بروزرسانی" : "ایجاد"} بوکمارک
                    </button>
                    <button type="button" class="btn-cancel" id="cancelBookmarkBtn">
                        <i class="fas fa-times"></i> انصراف
                    </button>
                </div>
            </form>
        `;
  },

  initDatepickers() {
    const dueDateInput = document.getElementById("bookmarkDueDate");
    if (!dueDateInput) return;

    if (dueDateInput.hasAttribute("data-datepicker-initialized")) return;

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
            dueDateInput.setAttribute("data-selected-date", selected);
          },
        });
        dueDateInput.setAttribute("data-datepicker-initialized", "true");
      } else {
        dueDateInput.placeholder = "۱۴۰۴/۰۱/۰۱";
        dueDateInput.setAttribute("data-datepicker-initialized", "true");
      }
    } catch (error) {
      console.warn("⚠️ Error initializing datepicker:", error);
      dueDateInput.placeholder = "۱۴۰۴/۰۱/۰۱";
      dueDateInput.setAttribute("data-datepicker-initialized", "true");
    }
  },

  initEvents(bookmark = null) {
    const saveBtn = document.getElementById("saveBookmarkBtn");
    const cancelBtn = document.getElementById("cancelBookmarkBtn");
    const customerSelect = document.getElementById("bookmarkCustomer");

    if (saveBtn) {
      saveBtn.addEventListener("click", () => {
        this.saveBookmark(bookmark);
      });
    }

    if (cancelBtn) {
      cancelBtn.addEventListener("click", () => {
        this.closeModal();
      });
    }

    if (customerSelect) {
      customerSelect.addEventListener("change", async (e) => {
        const customerId = e.target.value;
        const periodSelect = document.getElementById("bookmarkPeriod");
        const flockSelect = document.getElementById("bookmarkFlock");
        const periodGroup = document.getElementById("periodGroup");
        const flockGroup = document.getElementById("flockGroup");

        if (customerId) {
          periodGroup.style.display = "block";
          flockGroup.style.display = "block";

          // بارگذاری دوره‌ها
          try {
            const periods = await bookmarksApi.getCustomerPeriods(customerId);
            periodSelect.innerHTML = '<option value="">همه دوره‌ها</option>';
            if (periods.success && periods.data.periods) {
              periods.data.periods.forEach((p) => {
                const opt = document.createElement("option");
                opt.value = p.id;
                opt.textContent = `${p.period_name} (دوره ${p.period_number})`;
                periodSelect.appendChild(opt);
              });
            }
          } catch (error) {
            console.error("❌ Error loading periods:", error);
          }

          // بارگذاری گله‌ها
          try {
            const flocks = await bookmarksApi.getCustomerFlocks(customerId);
            flockSelect.innerHTML = '<option value="">همه گله‌ها</option>';
            if (flocks.success && flocks.data.placements) {
              flocks.data.placements.forEach((f) => {
                const opt = document.createElement("option");
                opt.value = f.id;
                opt.textContent = `گله ${f.flock_number}`;
                flockSelect.appendChild(opt);
              });
            }
          } catch (error) {
            console.error("❌ Error loading flocks:", error);
          }
        } else {
          periodGroup.style.display = "none";
          flockGroup.style.display = "none";
        }
      });

      // اگر در حالت ویرایش و مشتری انتخاب شده
      if (bookmark && bookmark.customer_id) {
        customerSelect.dispatchEvent(new Event("change"));
        // تنظیم مقادیر انتخاب شده
        setTimeout(() => {
          if (bookmark.period_id) {
            document.getElementById("bookmarkPeriod").value =
              bookmark.period_id;
          }
          if (bookmark.flock_id) {
            document.getElementById("bookmarkFlock").value = bookmark.flock_id;
          }
        }, 300);
      }
    }
  },

  async saveBookmark(bookmark = null) {
    const data = {
      title: document.getElementById("bookmarkTitle").value.trim(),
      description: document.getElementById("bookmarkDescription").value.trim(),
      type: document.getElementById("bookmarkType").value,
      priority: document.getElementById("bookmarkPriority").value,
      status: document.getElementById("bookmarkStatus").value,
      customer_id: document.getElementById("bookmarkCustomer").value || null,
      period_id: document.getElementById("bookmarkPeriod").value || null,
      flock_id: document.getElementById("bookmarkFlock").value || null,
      flock_age_days: document.getElementById("bookmarkFlockAge").value || null,
      due_date: document.getElementById("bookmarkDueDate").value || null,
      due_time: document.getElementById("bookmarkDueTime").value || null,
    };

    // اعتبارسنجی
    if (!data.title) {
      notificationService.warning("لطفاً عنوان بوکمارک را وارد کنید");
      return;
    }

    if (data.type === "reminder" && !data.due_date) {
      notificationService.warning("لطفاً تاریخ سررسید را وارد کنید");
      return;
    }

    // بستن مودال
    this.closeModal();

    if (this.isEditing && this.editingId) {
      await bookmarksService.updateBookmark(this.editingId, data);
    } else {
      await bookmarksService.createBookmark(data);
    }
  },
};
